# Entorno de pruebas (staging) e infraestructura

Rama: `desarrollo/planta14-v2-infra`, creada desde `desarrollo/planta14-v2-fase1` (`0238c50`). Fecha: 2 de noviembre de 2026.

Este documento explica cómo levantar un entorno de pruebas en un servidor virtual (pensado para IONOS), cómo funcionan las copias y la restauración, el dimensionado y qué tiene que decidir o contratar Pablo. **No se ha contratado ni desplegado nada.** Netlify sigue alojando solo la demo ([NETLIFY-CONFIG.md](NETLIFY-CONFIG.md)).

**Revisión posterior:** [INFRA-REVISION-2026-11-02.md](INFRA-REVISION-2026-11-02.md); correcciones de sus puntos 3 a 7 en [INFRA-CORRECCIONES-2026-11-02.md](INFRA-CORRECCIONES-2026-11-02.md). Esta rama todavía parte de fase 1 y no tiene el adaptador de contenidos: configurar `CONTENT_SOURCE=payload` no basta hasta integrar el código de contenidos en un trabajo aparte. Tampoco está elegido ni validado el proveedor S3. No presentar esta plantilla como un staging completo listo para desplegar.

## Qué hay en `infra/`

| Archivo | Para qué |
|---|---|
| `compose.staging.yaml` | App Next.js + Payload, migraciones, PostgreSQL 17, Caddy (HTTPS) y MinIO (S3 de pruebas, perfil `minio`). |
| `.env.staging.example` | Plantilla de variables, sin valores reales. |
| `generate-env.sh` | Crea `infra/.env.staging` con secretos aleatorios (permisos 600, ignorado por Git). |
| `app.Dockerfile` (+ `.dockerignore`) | Imagen de la app. Build con el CMS desactivado; se activa en ejecución. |
| `Caddyfile` | Proxy inverso con contraseña obligatoria (hash bcrypt), HTTPS, `noindex` también en 401/errores y límite de subida 12 MB. |
| `minio/init.sh` | Bucket privado con versionado, bucket público opcional (solo lectura de objetos) y clave de la app limitada a ambos. Sin errores ocultos. |
| `postgres/roles.sql`, `postgres/grants.sql` | Usuarios separados: migrador (propietario del esquema) y aplicación (solo datos). Idempotentes. |
| `postgres/initdb/10-planta14-roles.sh` | Aplica lo anterior al crear una base **nueva** (volumen vacío). |
| `postgres/apply-roles.sh` | Procedimiento para una base **existente**. |
| `backup/offsite-sync.sh` | Copia **fuera del servidor**: sube las copias cifradas a un S3 externo, sin borrar ni sobrescribir. |
| `restore/fetch-offsite.sh` | Descarga una copia (y su `.sha256`) del destino externo. |
| `backup/backup-postgres.sh` | `pg_dump` con fecha, SHA-256, cifrado opcional y retención. |
| `backup/backup-storage.sh` | Copia del bucket S3 (rclone) en `.tar.gz` con manifiesto SHA-256, cifrado opcional y retención. |
| `restore/restore-postgres.sh` | Restaura sobre una base **vacía** (se niega si tiene tablas). |
| `restore/restore-storage.sh` | Restaura en un bucket **vacío** y verifica el contenido. |
| `test/restore-test.sh` | Prueba completa: copia, restauración local y **desde el destino externo**, usuarios separados y rechazos de seguridad. |
| `test/postgres-roles-test.sh` | Usuarios PostgreSQL separados en base nueva y existente; la app funciona y no puede hacer DDL. |
| `test/staging-config-test.mjs` | Compose, Caddy oficial, contraseña exterior, cabeceras y ruta `/media`. |

Resultado de la prueba ejecutada: [INFRA-PRUEBA-RESTAURACION-2026-11-02.md](INFRA-PRUEBA-RESTAURACION-2026-11-02.md).

### Arquitectura

```
Internet ──80/443──> caddy ──(edge)──> app:3000 ──(backend, interna)──> postgres:5432 / minio:9000
                       └──(public_media, interna)──> minio:9000  (solo /media → bucket público)

Trabajos de copia (contenedores rclone efímeros):
  MinIO local ──(backend)──> rclone           S3 externo / destino externo ──(planta14-backup-egress)──> rclone
```

- Solo Caddy publica puertos. PostgreSQL no se publica. La consola de MinIO solo escucha en `127.0.0.1` del servidor (acceso por túnel SSH).
- La red `backend` es `internal`: PostgreSQL no tiene salida a Internet. MinIO está también en `minio_admin`, una red no interna para su consola en loopback, por lo que no se debe asumir que carece de salida.
- El servicio `migrate` aplica `cms/migrations` (Payload tiene `push:false`) y la app no arranca hasta que termina bien.
- El bucket privado del CMS no se publica nunca. Con el bloque 3, las imágenes publicables de contenido publicado se copian a un **bucket público separado** (ver «Imágenes públicas»). Caddy llega a MinIO solo por `public_media` (sin acceso a `backend` ni a PostgreSQL), únicamente para GET/HEAD del bucket público, rechazando `..`, `\` y `%` en la ruta.
- **Red de salida de copias** (`BACKUP_EGRESS_NETWORK`, por defecto `planta14-backup-egress`): un puente propio que crean los scripts si no existe. Llega a Internet (S3 externo, destino de copias) pero no contiene ningún servicio del stack; los scripts se niegan a usarla si PostgreSQL está conectado a ella. La red `backend` sigue siendo interna. La red para **leer** el almacenamiento es automática: `backend` si `S3_ENDPOINT` es el MinIO del Compose, la de salida si es un S3 externo (`BACKUP_DOCKER_NETWORK` lo fija a mano). `PG_CONTAINER` vacío = `<COMPOSE_PROJECT_NAME>-postgres-1`.

### Usuarios de PostgreSQL

| Usuario | Para qué | Permisos |
|---|---|---|
| `POSTGRES_USER` (superusuario de la imagen) | Administración, copias y restauraciones | Todos. **La aplicación nunca lo usa.** |
| `POSTGRES_MIGRATOR_USER` (`planta14_migrator`) | Servicio `migrate` (`npm run cms:migrate`, `cms:media:sync-public`) | Propietario del esquema `public` y de sus objetos; `CONNECT`, `CREATE`, `TEMPORARY` en la base. Sin superusuario. |
| `POSTGRES_APP_USER` (`planta14_app`) | Aplicación | `CONNECT` y `USAGE` del esquema; `SELECT/INSERT/UPDATE/DELETE` en tablas y uso de secuencias. **No puede crear, borrar, vaciar ni alterar tablas**, ni crear esquemas o tablas temporales. Los privilegios por defecto le dan acceso a las tablas que cree el migrador en el futuro. |

`PUBLIC` pierde `CONNECT` y `CREATE`: otros usuarios del clúster no se conectan a la base.

**Base nueva:** `infra/postgres/initdb/10-planta14-roles.sh` se ejecuta automáticamente la primera vez (volumen vacío).

**Base existente** (creada antes de este cambio, con todo a nombre del superusuario):

1. Haz una copia: `infra/backup/backup-postgres.sh --env-file infra/.env.staging`.
2. Añade `POSTGRES_MIGRATOR_PASSWORD` y `POSTGRES_APP_PASSWORD` (16+ caracteres, `openssl rand -hex 24`) a `infra/.env.staging`.
3. Para la app y el migrador: `docker compose -f infra/compose.staging.yaml --env-file infra/.env.staging stop app migrate`.
4. Aplica usuarios, propiedad y permisos (idempotente; se puede repetir): `infra/postgres/apply-roles.sh --env-file infra/.env.staging`.
5. Comprueba que no quedan tablas de otro propietario: `docker exec <PG_CONTAINER> psql -U planta14 -d planta14 -c "SELECT tablename, tableowner FROM pg_tables WHERE schemaname='public' AND tableowner <> 'planta14_migrator'"` (debe salir vacío).
6. Arranca de nuevo: `docker compose ... up -d` (la app ya usa `POSTGRES_APP_USER`, `migrate` usa el migrador).
7. Si algo falla, la vuelta atrás es restaurar la copia del paso 1 en una base nueva; no hace falta tocar la base original.

Para cambiar contraseñas basta con editar el env y repetir el paso 4 (actualiza las contraseñas con `ALTER ROLE`) y el 6.

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

Genera primero el hash de acceso exterior con la imagen oficial de Caddy. No escribas la contraseña directamente en una orden ni la guardes en Git:

```bash
read -rsp 'Contraseña de acceso a staging: ' STAGING_PASSWORD
CADDY_BASIC_AUTH_HASH=$(printf '%s\n' "$STAGING_PASSWORD" | docker run --rm -i caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d caddy hash-password)
unset STAGING_PASSWORD
export CADDY_BASIC_AUTH_HASH
```

```bash
git clone https://github.com/PabloVelascoGarcia/planta14-web.git
```

```bash
cd planta14-web && git checkout desarrollo/planta14-v2-infra
```

```bash
infra/generate-env.sh staging.example.org admin@example.org
```

Después: `unset CADDY_BASIC_AUTH_HASH`. Sustituye el dominio y el email por los reales. Revisa `infra/.env.staging`: con `CADDY_TLS=internal` Caddy usa un certificado propio (útil en local con `localhost`; el navegador avisará). Compose fija `CMS_ENABLED=true` y `CONTENT_SOURCE=payload`. El generador exige un hash bcrypt y lo escribe entre comillas simples para preservar sus signos `$`; si lo rellenas manualmente, conserva esas comillas. **Guarda una copia de ese archivo en un gestor de secretos** y no lo subas a Git (`infra/.gitignore` lo excluye). La contraseña exterior y las cuentas individuales de Payload son controles distintos; la contraseña de Caddy no se reenvía a la app.

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

Sin credenciales debe responder **401**, con `WWW-Authenticate`, `x-robots-tag: noindex, nofollow` y `Cache-Control: private, no-store`. Con `curl -u planta14 -sI https://staging.example.org/robots.txt` se solicita la contraseña interactivamente y debe responder 200. El navegador pide primero la contraseña exterior; después `/cms` muestra el acceso individual de Payload. Para clientes API, usar Basic en la barrera exterior y la cookie de Payload para la sesión de la aplicación; el proxy elimina `Authorization` antes de reenviar.

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

- La copia completa diaria del bucket crecerá con las imágenes; en producción conviene valorar copias incrementales (pendiente, no implementado).

### Copia fuera del servidor

```bash
infra/backup/offsite-sync.sh --env-file infra/.env.staging
```

- Destino: cualquier S3 (`OFFSITE_BUCKET`, `OFFSITE_PREFIX`, `OFFSITE_ENDPOINT`, `OFFSITE_REGION`, `OFFSITE_FORCE_PATH_STYLE`) con **credenciales propias**, distintas de las de la app. Debe ser otro proveedor u otra región.
- Solo **añade**: `rclone copy --immutable`, nunca `sync`. Un borrado o un daño local no se propaga, y si un archivo remoto con el mismo nombre tiene otro contenido, la copia falla en lugar de sobrescribirlo. Tras subir, verifica con `rclone check`.
- Solo sube copias **cifradas** (`.age`/`.gpg`) y sus `.sha256`; las sin cifrar se avisan y se omiten (`OFFSITE_ALLOW_UNENCRYPTED=true` lo cambia, no recomendado). Por eso hay que activar `BACKUP_ENCRYPTION=age` antes de usarla.
- Se ejecuta en la red de salida, sin acceso a la red interna ni a PostgreSQL.
- La **retención** y la **protección contra borrado** del destino se configuran en el proveedor: regla de ciclo de vida (p. ej. 35–90 días), versionado o bloqueo de objetos, y una clave que pueda escribir pero no borrar. Así, ni un servidor comprometido puede borrar las copias externas.
- Programación (después de las copias locales):

```
45 3 * * * cd /srv/planta14-web && infra/backup/offsite-sync.sh --env-file infra/.env.staging >> /var/log/planta14-backup.log 2>&1
```

Recuperar desde el destino externo (por ejemplo, tras perder el servidor):

```bash
mkdir -p /var/restore && infra/restore/fetch-offsite.sh --env-file infra/.env.staging postgres --latest /var/restore
```

```bash
infra/restore/fetch-offsite.sh --env-file infra/.env.staging storage --latest /var/restore
```

Después, `restore-postgres.sh` y `restore-storage.sh` con los archivos descargados (y `BACKUP_AGE_IDENTITY`). La prueba automática borra todas las copias locales y restaura desde el destino externo.

## Restauración

Nunca se restaura encima de datos: ambos scripts comprueban que el destino está vacío. Además:

- **La suma `.sha256` es obligatoria.** Sin ella, la restauración se niega salvo con `--allow-missing-checksum` (solo para copias propias de origen conocido). La suma debe tener una sola línea con el nombre exacto del archivo: no se acepta una suma de otro archivo.
- El archivo de copia debe ser un archivo regular con la extensión esperada; se rechazan los **enlaces simbólicos**. Nombres de base y bucket validados.
- Antes de extraer un `.tar.gz` de almacenamiento se valida su listado: solo `INFO`, `MANIFEST.sha256` y `objects/...`, **solo archivos y directorios** (sin enlaces simbólicos ni duros, dispositivos o FIFO), sin rutas absolutas, `..` ni `\`. Se extrae sin conservar propietarios ni permisos, se comprueba que no aparecen enlaces y se valida el manifiesto (formato, rutas y número de objetos) antes de verificar las sumas. Las credenciales S3 se cargan solo después de validar.
- Con `POSTGRES_MIGRATOR_USER` y `POSTGRES_APP_USER` definidos, los objetos restaurados pertenecen al migrador (`pg_restore --role`) y se aplican los permisos de la aplicación.

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

Requiere Docker, `age`, `openssl` y `python3`. Crea contenedores desechables (nada real) y aplica las migraciones de Payload si hay `node_modules` (`npm ci`) o `RESTORE_TEST_APP_IMAGE`. Después:

- carga datos sintéticos, hace la copia cifrada y la restaura en un PostgreSQL nuevo, con usuarios separados;
- compara `count(*)` de cada tabla;
- comprueba los rechazos de seguridad: falta de suma, suma ajena, enlaces, y tar con enlace, `..` o ruta absoluta;
- prueba el almacenamiento con un S3 de pruebas (`rclone serve s3`);
- prueba la copia externa en otro S3 de pruebas situado en una red de salida aislada, borra todas las copias locales y restaura desde el destino externo.

Termina con código distinto de 0 si algo no coincide. `infra/test/postgres-roles-test.sh` prueba aparte la separación de usuarios. Conviene repetirla cada trimestre y tras cambios de esquema, y ensayar al menos una vez con una copia real en un servidor aparte.

## Imágenes públicas (bloque 3)

El bloque 3 (otra rama) copia las imágenes publicables de contenido publicado a una ubicación pública con caché larga. Variables en `.env.staging.example`:

| Variable | Staging con MinIO | Con S3/CDN real |
|---|---|---|
| `PUBLIC_MEDIA_BUCKET` | `planta14-staging-public` (lo crea `minio-init` con lectura anónima de objetos, sin listado) | Bucket público **separado** del privado |
| `PUBLIC_MEDIA_BASE_URL` | `https://<STAGING_DOMAIN>/media` (lo pone `generate-env.sh`); Caddy lo sirve tras la contraseña de staging | URL HTTPS del CDN o del bucket público (raíz del bucket) |
| `PUBLIC_MEDIA_PREFIX` | `public` | `public` |
| `PUBLIC_MEDIA_CACHE_CONTROL` | `public, max-age=31536000, immutable` | Igual; purga del CDN al retirar |

Se recomienda el **bucket público separado**: el privado no necesita ninguna política pública y un error de configuración no lo expone. En staging, `/media` sigue tras la contraseña exterior y con `Cache-Control: private, no-store` de Caddy; la caché larga solo tiene efecto con un CDN real.

Tras integrar el bloque 3 y aplicar sus migraciones, ejecuta **una vez** la reconciliación (crea las copias públicas de lo ya publicado):

```bash
docker compose -f infra/compose.staging.yaml --env-file infra/.env.staging run --rm migrate npm run cms:migrate
```

```bash
docker compose -f infra/compose.staging.yaml --env-file infra/.env.staging run --rm migrate npm run cms:media:sync-public
```

Repítela tras restaurar una copia o cambiar `PUBLIC_MEDIA_*`. Las copias de seguridad del almacenamiento cubren el bucket privado: el público se regenera con esta orden.

## Actualizar imágenes (digests)

Las imágenes base están fijadas como `etiqueta@sha256:<digest>` en `compose.staging.yaml`, `.env.staging.example`, `app.Dockerfile` (también el frontend `docker/dockerfile`) y los tests. Docker usa el digest; la etiqueta solo documenta qué versión es.

| Imagen | Referencia actual |
|---|---|
| PostgreSQL | `postgres:17.6-alpine@sha256:ef257d85f76e48da1c64832459b59fcaba1a4dac97bf5d7450c77753542eee94` |
| Caddy | `caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d` |
| Node (build/app) | `node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da` |
| rclone | `rclone/rclone:1.71.2@sha256:3103526c506266a9ecdf064efe99bf3677d92ef6407af124d8c56b4f49cbaa51` |
| Frontend Dockerfile | `docker/dockerfile:1.28.0@sha256:bb22d9815c728170f72750f4e5b0d672e06176142e1d602c7e66c050100b7e5b` |
| MinIO | **Sin digest**: `quay.io` no es accesible desde el entorno de pruebas; queda como decisión pendiente. |

Procedimiento (una vez al mes y ante avisos de seguridad):

1. Elige la nueva etiqueta (misma versión mayor de PostgreSQL: 17.x; Node 22 LTS) y lee sus notas de versión.
2. Obtén el digest del **índice multiplataforma**:

```bash
docker buildx imagetools inspect postgres:17.7-alpine --format '{{json .Manifest.Digest}}'
```

   (o `docker pull postgres:17.7-alpine && docker image inspect --format '{{index .RepoDigests 0}}' postgres:17.7-alpine`).
3. Sustituye `etiqueta@digest` en todos los archivos: `grep -rn 'postgres:17' infra/`.
4. Ejecuta `docker compose ... config --quiet`, `node infra/test/staging-config-test.mjs`, `infra/test/restore-test.sh` e `infra/test/postgres-roles-test.sh`, y reconstruye la app.
5. Haz commit con el cambio de digest y el resultado de las pruebas. Para volver atrás basta con revertir el commit.

Las actualizaciones menores de PostgreSQL 17 no requieren volcado; un cambio de versión mayor (18) sí exige `pg_dump`/restauración o `pg_upgrade` y un ensayo aparte.

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

## Lo que no se ha comprobado

Resultados de las pruebas: [INFRA-CORRECCIONES-2026-11-02.md](INFRA-CORRECCIONES-2026-11-02.md) (y la revisión anterior en [INFRA-REVISION-2026-11-02.md](INFRA-REVISION-2026-11-02.md)).

- **Stack completo con el código de contenidos:** esta rama sigue partiendo de fase 1, así que no se ha levantado con los bloques 2 y 3.
- **Proveedor S3 real, CDN y destino externo real:** el destino externo se ha probado con un emulador (`rclone serve s3`), sin bloqueo de objetos ni reglas de ciclo de vida.
- **MinIO y `minio/init.sh`:** no se han ejecutado, porque la imagen no es accesible. Tampoco se ha comprobado que la imagen incluya `mc`.
- **Cifrado con GPG en positivo.**
- **DNS, certificados ACME públicos y cortafuegos del VPS.**
- **Imagen de la app con el Dockerfile fijado por digest:** no se ha reconstruido en este entorno, porque `npm ci` dentro del build no pasa por el proxy. La revisión anterior sí construyó la imagen con la etiqueta.

## Lo que Pablo tiene que contratar o decidir

Costes **orientativos**, sin IVA, consultados el 2 de noviembre de 2026 en las páginas de los proveedores y en comparativas. Verifica en la web del proveedor antes de contratar: los precios cambian y suelen tener promociones iniciales.

| # | Qué | Recomendación | Coste orientativo |
|---|---|---|---|
| 1 | **Servidor IONOS** | VPS Linux con 4 vCPU, 8 GB, ~240 GB NVMe, centro de datos en la UE | ≈ 10–25 €/mes (promociones iniciales desde ≈ 7–8 €/mes) |
| 2 | **Almacenamiento de objetos** | S3 gestionado en la UE (IONOS Object Storage u otro), con un bucket privado y uno público separado. Mirar el coste de salida de datos | ≈ 0,005–0,015 €/GB/mes; con decenas de GB, < 5 €/mes más la salida de datos |
| 3 | **Correo transaccional** | Recuperación de contraseñas y avisos municipales: Brevo, Postmark o Amazon SES | 0 € (planes gratuitos con límite diario) a ≈ 15 €/mes por 10.000 correos |
| 4 | **Dominio de staging** | Un subdominio del dominio que ya tenga Planta 14 (`staging.<dominio>`) | 0 € si ya hay dominio; un dominio nuevo, ≈ 10–20 €/año |
| 5 | **Destino de las copias** | Otro proveedor o región, con versionado/bloqueo de objetos y clave sin permiso de borrado | ≈ 1–5 €/mes para el volumen de staging |

Decisiones sin coste directo que bloquean el uso con datos reales: activar `BACKUP_ENCRYPTION=age` y guardar la clave privada fuera del servidor; elegir la imagen de MinIO o prescindir de ella con un S3 gestionado; integrar el código de contenidos (bloques 2 y 3) en la rama que se despliegue; definir el acceso SSH y el segundo factor; firmar los contratos de encargo de tratamiento (RGPD).

Fuentes de precios: [IONOS VPS](https://www.ionos.com/servers/vps), [IONOS Object Storage](https://www.ionos.com/enterprise-cloud/object-storage/prices), [comparativa de correo transaccional 2026](https://clone.surecontact.com/smtp-pricing-2026/), [precios de Postmark 2026](https://www.activepieces.com/blog/postmark-pricing-plans-costs-by-volume-2026-guide.md).
