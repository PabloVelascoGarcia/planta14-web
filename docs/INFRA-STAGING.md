# Entorno de pruebas (staging) e infraestructura

Rama: `desarrollo/planta14-v2-infra`, creada desde `desarrollo/planta14-v2-fase1` (`0238c50`). Fecha: 2 de noviembre de 2026.

Este documento explica cómo levantar un entorno de pruebas en un servidor virtual (pensado para IONOS), cómo funcionan las copias y la restauración, el dimensionado y qué tiene que decidir o contratar Pablo. **No se ha contratado ni desplegado nada.** Netlify sigue alojando solo la demo ([NETLIFY-CONFIG.md](NETLIFY-CONFIG.md)).

## Qué hay en `infra/`

| Archivo | Para qué |
|---|---|
| `compose.staging.yaml` | App Next.js + Payload, migraciones, PostgreSQL 17, Caddy (HTTPS) y MinIO (S3 de pruebas, perfil `minio`). |
| `.env.staging.example` | Plantilla de variables, sin valores reales. |
| `generate-env.sh` | Crea `infra/.env.staging` con secretos aleatorios (permisos 600, ignorado por Git). |
| `app.Dockerfile` (+ `.dockerignore`) | Imagen de la app. Build con el CMS desactivado; se activa en ejecución. |
| `Caddyfile` | Proxy inverso, HTTPS automático (Let's Encrypt) o certificado interno, `noindex`, límite de subida 12 MB. |
| `minio/init.sh` | Bucket privado con versionado y una clave de la app limitada a ese bucket. |
| `backup/backup-postgres.sh` | `pg_dump` con fecha, SHA-256, cifrado opcional y retención. |
| `backup/backup-storage.sh` | Copia del bucket S3 (rclone) en `.tar.gz` con manifiesto SHA-256, cifrado opcional y retención. |
| `restore/restore-postgres.sh` | Restaura sobre una base **vacía** (se niega si tiene tablas). |
| `restore/restore-storage.sh` | Restaura en un bucket **vacío** y verifica el contenido. |
| `test/restore-test.sh` | Prueba completa de copia y restauración con contenedores desechables. |

Resultado de la prueba ejecutada: [INFRA-PRUEBA-RESTAURACION-2026-11-02.md](INFRA-PRUEBA-RESTAURACION-2026-11-02.md).

### Arquitectura

```
Internet ──80/443──> caddy ──(red edge)──> app:3000 ──(red backend, interna)──> postgres:5432
                                                     └───────────────────────> minio:9000 (o S3 real)
```

- Solo Caddy publica puertos. PostgreSQL no se publica. La consola de MinIO solo escucha en `127.0.0.1` del servidor (acceso por túnel SSH).
- La red `backend` es `internal`: PostgreSQL y MinIO no salen a Internet.
- El servicio `migrate` aplica `cms/migrations` (Payload tiene `push:false`) y la app no arranca hasta que termina bien.
- Las imágenes del CMS siguen siendo privadas: el bucket no se publica y Caddy no lo expone; se sirven a través de Payload.

## Levantar el entorno de pruebas

### 1. Servidor

1. Servidor virtual con Ubuntu 24.04 LTS (u otra LTS) y acceso SSH solo con clave.
2. Usuario sin privilegios para operar; SSH sin contraseña y sin `root`.
3. Cortafuegos (el del panel de IONOS y/o `ufw`): entrada 22 (idealmente solo desde IPs conocidas), 80 y 443 (TCP; 443/UDP para HTTP/3). Nada más.
4. Actualizaciones automáticas de seguridad (`unattended-upgrades`).
5. Docker Engine y el plugin Compose desde el repositorio oficial de Docker.
6. Opcional: 2–4 GB de swap; el build de Next.js consume mucha memoria.

### 2. DNS

Registro `A` (y `AAAA` si hay IPv6) de, por ejemplo, `staging.<dominio>` apuntando a la IP del servidor. Caddy necesita que el DNS ya resuelva y que el puerto 80 sea accesible para obtener el certificado.

### 3. Código y variables

```bash
git clone https://github.com/PabloVelascoGarcia/planta14-web.git
```

```bash
cd planta14-web && git checkout desarrollo/planta14-v2-infra
```

```bash
infra/generate-env.sh staging.example.org admin@example.org
```

Sustituye el dominio y el email por los reales. Revisa `infra/.env.staging`: con `CADDY_TLS=internal` Caddy usa un certificado propio (útil en local con `localhost`; el navegador avisará). `CMS_ENABLED=false` mantiene `/cms` cerrado; cámbialo a `true` cuando quieras probar el CMS. **Guarda una copia de ese archivo en un gestor de secretos** y no lo subas a Git (`infra/.gitignore` lo excluye).

### 4. Validar y arrancar

```bash
docker compose -f infra/compose.staging.yaml --env-file infra/.env.staging config --quiet
```

```bash
docker compose -f infra/compose.staging.yaml --env-file infra/.env.staging up -d --build
```

```bash
docker compose -f infra/compose.staging.yaml --env-file infra/.env.staging ps
```

Si faltan variables obligatorias, `config` se detiene y dice cuáles. Con un S3 real: `COMPOSE_PROFILES=` (vacío), y `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` y la clave del proveedor (HTTPS, `S3_FORCE_PATH_STYLE` solo si el proveedor lo pide).

### 5. Primer administrador (solo con `CMS_ENABLED=true`)

El comando se niega si ya hay usuarios. Para que la contraseña no quede en el historial:

```bash
read -rp 'Email: ' CMS_BOOTSTRAP_EMAIL && read -rsp 'Contraseña (16+): ' CMS_BOOTSTRAP_PASSWORD && export CMS_BOOTSTRAP_EMAIL CMS_BOOTSTRAP_PASSWORD
```

```bash
docker compose -f infra/compose.staging.yaml --env-file infra/.env.staging run --rm -e CMS_BOOTSTRAP_EMAIL -e CMS_BOOTSTRAP_PASSWORD migrate npm run cms:bootstrap
```

```bash
unset CMS_BOOTSTRAP_EMAIL CMS_BOOTSTRAP_PASSWORD
```

### 6. Comprobar

```bash
curl -sI https://staging.example.org/robots.txt
```

Debe responder 200 con `x-robots-tag: noindex, nofollow`. Con el CMS activo, `https://staging.example.org/cms` muestra el acceso de Payload.

### 7. Actualizar

```bash
git pull && docker compose -f infra/compose.staging.yaml --env-file infra/.env.staging up -d --build
```

Haz una copia de PostgreSQL antes de desplegar cambios que traigan migraciones.

## Copias de seguridad

Las variables (`BACKUP_*`, `PG_CONTAINER`, `S3_*`) se leen de `infra/.env.staging` con `--env-file`. Los archivos quedan en `BACKUP_DIR` con la fecha UTC en el nombre:

```
/var/backups/planta14/postgres/planta14-postgres-planta14-20261102T031500Z.dump.age
/var/backups/planta14/postgres/planta14-postgres-planta14-20261102T031500Z.dump.age.sha256
/var/backups/planta14/storage/planta14-storage-planta14-staging-20261102T033000Z.tar.gz.age
```

```bash
infra/backup/backup-postgres.sh --env-file infra/.env.staging
```

```bash
infra/backup/backup-storage.sh --env-file infra/.env.staging
```

- **PostgreSQL**: `pg_dump` en formato custom ejecutado dentro del contenedor (misma versión 17 que el servidor), comprobación con `pg_restore --list` antes de darla por buena, escritura atómica y bloqueo contra ejecuciones simultáneas.
- **Almacenamiento**: rclone (imagen oficial `rclone/rclone`, en la red interna) descarga el bucket, crea un manifiesto SHA-256 y empaqueta. Sirve para MinIO o cualquier S3. Para no usar la clave de la app, define `STORAGE_BACKUP_ACCESS_KEY_ID`/`STORAGE_BACKUP_SECRET_ACCESS_KEY` con una clave de solo lectura.
- **Cifrado** (`BACKUP_ENCRYPTION`): `none`, `age` (recomendado) o `gpg`. Con age, en el servidor solo está la clave **pública** (`BACKUP_AGE_RECIPIENT`); la privada se guarda fuera (gestor de contraseñas + copia offline). Sin la privada no se puede restaurar: probadlo.
- **Retención**: se borran las copias con fecha anterior a `BACKUP_RETENTION_DAYS` (14 por defecto), conservando siempre las `BACKUP_KEEP_MIN` más recientes (3), aunque sean antiguas. Se calcula con la fecha del nombre, no con la de modificación del archivo.
- **Programación** (ejemplo de `crontab` del usuario de operación; horas en UTC):

```
15 3 * * * cd /srv/planta14-web && infra/backup/backup-postgres.sh --env-file infra/.env.staging >> /var/log/planta14-backup.log 2>&1
30 3 * * * cd /srv/planta14-web && infra/backup/backup-storage.sh --env-file infra/.env.staging >> /var/log/planta14-backup.log 2>&1
```

- **Fuera del servidor**: una copia que vive en el mismo servidor no protege de su pérdida. Hay que sincronizar `BACKUP_DIR` a otro sitio (otro proveedor u otra región). Está en la lista de decisiones.
- Para producción, la copia completa diaria del bucket crecerá con las imágenes. Lo razonable es versionado en el bucket + réplica incremental a otro bucket (`rclone sync`), y dejar el `.tar.gz` para instantáneas periódicas.

## Restauración

Nunca se restaura encima de datos: ambos scripts comprueban que el destino está vacío.

```bash
BACKUP_AGE_IDENTITY=/ruta/segura/age-key.txt infra/restore/restore-postgres.sh --env-file infra/.env.staging --create /var/backups/planta14/postgres/ARCHIVO.dump.age planta14_restaurada
```

```bash
BACKUP_AGE_IDENTITY=/ruta/segura/age-key.txt infra/restore/restore-storage.sh --env-file infra/.env.staging /var/backups/planta14/storage/ARCHIVO.tar.gz.age planta14-restaurado
```

El bucket de destino tiene que existir y estar vacío. Tras restaurar en una base nueva, para ponerla en servicio se cambia `POSTGRES_DB` (o se renombra la base con la app parada). Verifica después cuentas, permisos e imágenes desde la aplicación.

### Prueba de restauración

```bash
infra/test/restore-test.sh
```

Requiere Docker, `age` y `openssl`. Crea contenedores desechables (nada real), aplica las migraciones de Payload si hay `node_modules` (`npm ci`), carga datos sintéticos, hace la copia cifrada, restaura en un PostgreSQL nuevo, compara `count(*)` de cada tabla y prueba también el almacenamiento con un S3 de pruebas (`rclone serve s3`). Termina con código distinto de 0 si algo no coincide. Conviene repetirla cada trimestre y tras cambios de esquema, y ensayar al menos una vez con una copia real en un servidor aparte.

## Dimensionado

Referencia: servidor virtual con **4 núcleos y 8 GB de RAM**.

| Componente | Memoria (límite) | Notas |
|---|---|---|
| Sistema + Docker | ~1 GB | |
| App Next.js + Payload | 2 GB (`APP_MEM_LIMIT`) | Sharp genera variantes de 800 y 1600 px; picos al subir imágenes. |
| PostgreSQL 17 | 2 GB (`POSTGRES_MEM_LIMIT`) | `shared_buffers=512MB`, `effective_cache_size=2GB`, 50 conexiones. |
| MinIO (pruebas) | ~0,5–1 GB | Desaparece con un S3 externo. |
| Caddy | <0,1 GB | |
| Margen y caché de disco | ~2 GB | |
| Build de la imagen | 2–3 GB puntuales | Construir con el sitio en marcha puede requerir swap, o construir la imagen fuera y subirla a un registro. |

Con 8 GB cabe staging completo con holgura. 4 GB sería justo (sobre todo el build). Para producción con MinIO en la misma máquina, 8 GB es el mínimo razonable; con S3 externo, sobra.

Disco (SSD), estimación inicial:

- Sistema, imágenes Docker y caché de build: 15–20 GB.
- PostgreSQL: menos de 1 GB al principio (texto y metadatos).
- Imágenes: hasta 10 MiB por original más dos variantes; con unas 5.000 imágenes, del orden de 20–40 GB.
- Copias locales: 14 días de volcados (pequeños) más las copias del bucket. Con copias completas diarias del bucket, el espacio se multiplica por la retención. Para staging basta; en producción, usar la réplica incremental.

Para staging: 80 GB. Para producción con MinIO local: 160 GB o más, o S3 externo. CPU: 4 núcleos dan margen para Sharp y el build; 2 núcleos funcionarían para staging con builds lentos.

## Lo que Pablo tiene que decidir o contratar

1. **Plan del servidor IONOS**: núcleos, RAM (8 GB recomendado), disco, centro de datos en la UE (España o Alemania) y si se contratan las copias o instantáneas del propio IONOS. ¿Un servidor para staging y otro para producción, o uno solo al principio?
2. **Dominio y DNS**: dominio definitivo, subdominio de staging y quién gestiona el DNS. Email de contacto para Let's Encrypt.
3. **Proveedor S3 definitivo**: IONOS S3 Object Storage, otro proveedor europeo o MinIO en el propio servidor. Requisitos: región UE, TLS, claves limitadas al bucket, versionado y coste de salida de datos.
4. **Imagen de MinIO**: la imagen oficial `minio/minio` ya no existe en Docker Hub (comprobado hoy: 404). La plantilla usa `quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z`, que **no se ha podido verificar** desde este entorno (el proxy bloquea quay.io). Opciones: confirmar esa imagen, compilar MinIO desde el código fuente, usar un fork comunitario (requiere revisar quién lo mantiene) o cambiar de servidor S3 de pruebas (p. ej. Garage o SeaweedFS). Si se elige un S3 externo, MinIO deja de hacer falta.
5. **Destino de las copias fuera del servidor**: otro proveedor u otra región, con retención propia (y, si es posible, bloqueo contra borrado).
6. **Claves de cifrado**: generar el par `age` fuera del servidor (`age-keygen`), dónde se guarda la clave privada y quién puede usarla.
7. **Gestor de secretos** para `.env.staging`, claves S3 y clave age (p. ej. un gestor de contraseñas de equipo).
8. **Proveedor de correo (SMTP)** para la recuperación de contraseñas de Payload. Hoy no hay ninguno.
9. **Monitorización y alertas**: disponibilidad (comprobación externa de HTTPS), espacio en disco, resultado de las copias (aviso si fallan).
10. **Acceso**: quién tiene SSH al servidor y acceso al panel de IONOS. Activar el segundo factor.
11. **RGPD**: contrato de encargo de tratamiento con IONOS y con el proveedor S3; registro de actividades cuando haya cuentas de usuarios.
12. **Netlify**: si se mantiene solo como demo y si se desactivan las previsualizaciones públicas de PR cuando haya datos reales.
13. **Registro de imágenes**: construir en el servidor o en CI y subir a un registro privado (GitHub Container Registry u otro).

## Lo que no se ha comprobado

- La imagen de la app (`infra/app.Dockerfile`) no se ha podido construir en el entorno del agente: dentro del build, `npm ci` no llega al registro de npm por el proxy de ese entorno. El `npm run build` de la app sí se verificó en la fase 1.
- El `Caddyfile` no se ha validado con `caddy validate`: Docker Hub limitó la descarga de la imagen (429).
- MinIO y `minio/init.sh` no se han ejecutado (ver el punto 4 de la lista anterior). La prueba de almacenamiento usó `rclone serve s3` como S3 de pruebas.
- El cifrado con `gpg` no se ha probado; el cifrado con `age` sí.
- No se ha levantado el stack completo ni se ha obtenido un certificado real.
