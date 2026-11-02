# Planta 14 v2: producción en IONOS

Rama `desarrollo/planta14-v2`, sobre `e2b207a`. Solo hay archivos nuevos de producción, más la barrera `pg_hba` en `restore-test.sh` y `.env.production` en `infra/.gitignore`. No se han tocado `infra/compose.staging.yaml`, `infra/.env.staging.example`, `infra/Caddyfile`, `desarrollo/planta14-v2-lanzamiento`, `main` ni `mejora/presentacion-la-voz`. Sin PR, sin despliegues reales, sin contrataciones y sin secretos.

Guía para Pablo: [PUESTA-EN-MARCHA-IONOS.md](PUESTA-EN-MARCHA-IONOS.md).

> **Dependencia:** `/api/health`, `SITE_INDEXABLE`, las páginas legales y las alertas (`infra/lib/alert.sh`, `infra/monitor/`) están en `desarrollo/planta14-v2-lanzamiento`, que se revisa en paralelo. La versión que se despliegue el 4 de diciembre debe incluir esa rama. Sus cambios y los de esta rama se fusionan sin conflictos (`git merge-tree`). El ensayo local despliega precisamente la fusión de ambas.

## Qué hay

| Archivo | Qué hace |
|---|---|
| `infra/compose.production.yaml` | App, migraciones (perfil `migrate`), PostgreSQL 17 y Caddy. Sin MinIO, con S3 externo obligatorio y `CONTENT_SOURCE=payload`. `SITE_INDEXABLE` **sin valor por defecto**: Compose se niega si no se decide `true` o `false`. Solo Caddy publica puertos; PostgreSQL está en red interna. Imágenes base fijadas por digest y registros rotados. |
| `infra/Caddyfile.production` | Web pública **sin contraseña**. HTTPS de Let's Encrypt para `planta14.com` y `www`, y `www` redirige de forma permanente a `planta14.com` conservando la ruta. `/api/health` abierto y sin caché. HSTS, `nosniff`, `X-Frame-Options`, sin cabecera `Server`, y registro JSON de accesos para fail2ban. `CADDY_TLS_MODE=internal` solo para ensayos. |
| `infra/.env.production.example` | Plantilla sin valores reales: dominio, decisión de indexación, S3 externo con dos buckets, copia externa, correo, cifrado `age` y despliegue. |
| `infra/postgres/pg_hba.conf` | PostgreSQL solo acepta TCP de su propia red (`samenet`) y del bucle local, siempre con contraseña. Los `docker exec` de copias y restauraciones usan el socket local. |
| `infra/server/setup-server.sh` | Preparación repetible de Ubuntu LTS: usuario sin root con clave, SSH solo con clave y sin root, ufw (22 limitado, 80, 443), actualizaciones de seguridad automáticas, fail2ban (SSH y logins de `/cms`, en la cadena `DOCKER-USER`), Docker oficial con rotación de registros, Europe/Madrid, carpetas y swap. Informa de los cambios hechos: la segunda ejecución debe decir 0. |
| `infra/server/check-server.sh` | Comprueba todo lo anterior (solo lee). |
| `infra/deploy/deploy.sh` | Despliegue de una etiqueta o commit: construye la imagen en el servidor, hace copia de PostgreSQL **antes de migrar**, migra con el usuario migrador, arranca y espera a que `/api/health` dé `ok` por HTTPS. Si falla, **vuelve sola** a la versión anterior. Solo si la migración llegó a cambiar datos, restaura la copia en una base nueva, la pone en servicio y conserva la fallida renombrada. Códigos de salida: 0 desplegada, 1 vuelta atrás correcta, 2 requiere intervención, 3 sin cambios. |
| `infra/deploy/status.sh` | Versión actual y anterior, contenedores, salud, últimas copias e historial. |
| `infra/deploy/generate-production-env.sh` | `.env.production` con contraseñas aleatorias y permisos 600. |
| `infra/deploy/schedule.sh` | `/etc/cron.d/planta14`: copia de PostgreSQL (03:15), del almacenamiento (03:30) y externa (03:45) a través de `run-with-alert.sh`, vigilancia del disco cada hora y rotación de registros. |
| `infra/test/production-deploy-test.sh` | Ensayo local completo (ver abajo). |
| `infra/test/server-setup-test.sh` | Ensayo de `infra/server` en una Ubuntu desechable. Exige confirmación explícita porque modifica la máquina. |

### Limitación de intentos en `/cms`

Caddy no trae limitación de peticiones sin compilar un módulo externo, así que hay dos capas:

1. **Payload** bloquea cada cuenta 10 minutos tras 5 contraseñas fallidas (ya existía).
2. **fail2ban** lee el registro de accesos de Caddy y banea durante 1 hora la IP que acumule 10 inicios de sesión fallidos (401, 403 o 429 en `POST /api/cms/users/login`) en 10 minutos, tanto en `/cms` como en los paneles municipales.

El baneo se aplica en la cadena `DOCKER-USER`, porque el tráfico hacia contenedores no pasa por `INPUT`. Las redes privadas no se banean nunca, para no bloquear la pasarela de Docker. Por eso se recomienda publicar solo el registro A (IPv4): el tráfico IPv6 llegaría a Caddy con la IP de la pasarela.

### Aislamiento de la red de copias (punto 4)

En Docker Desktop, la red de salida de las copias llegaba a PostgreSQL por IP. Ahora hay dos barreras independientes, y `restore-test.sh` comprueba ambas:

1. **Red:** en Docker para Linux nativo (el servidor de IONOS), la red de salida no debe alcanzar PostgreSQL ni por nombre ni por IP. Es obligatorio. En Docker Desktop, si lo alcanza, se informa sin dar fallo.
2. **PostgreSQL:** `pg_hba` con `samenet` rechaza una conexión con **credenciales válidas** desde la red de salida, en cualquier plataforma. Como control, las mismas credenciales funcionan desde la red interna.

## Resultados

RESULTADOS_PENDIENTES

## Sin comprobar

- **Servidor real de IONOS:** no hay ninguno contratado. `setup-server.sh` y `check-server.sh` no se han ejecutado de principio a fin: ensayarlos en la máquina del agente lo bloqueó su control de permisos, porque crea usuarios, sudoers y SSH; no había imagen Ubuntu descargable para un contenedor (Docker Hub limitado y ECR bloqueado); y apt por HTTP plano no pasa el proxy en contenedores. Por partes sí se ha probado:
  - la configuración efectiva de SSH, con el `sshd` de Ubuntu 24.04 (`sshd -G`), incluido el caso de `50-cloud-init.conf`;
  - el filtro de fail2ban, con el `fail2ban-regex` de Ubuntu 24.04 sobre logins reales del Caddy de producción;
  - shellcheck de todo.

  **Lo primero en el servidor nuevo:** ejecutar `setup-server.sh` dos veces y `check-server.sh`. La guía lo indica.
- **Let's Encrypt real, DNS y correo:** el ensayo usa `CADDY_TLS_MODE=internal`. La emisión real necesita el DNS de planta14.com apuntando al servidor.
- **ufw, fail2ban baneando de verdad, unattended-upgrades y swap en marcha:** requieren systemd; los comprueba `check-server.sh` en el servidor.
- **IONOS S3:** el ensayo usa `rclone serve s3` como S3 externo. Políticas del bucket público, claves limitadas y versionado del destino externo, pendientes de contratar.
- **`infra/app.Dockerfile` dentro del despliegue:** aquí `npm ci` no funciona dentro de `docker build`, así que el ensayo usa `DEPLOY_BUILD_COMMAND` con la imagen precompilada. El Dockerfile real se construyó correctamente en el CI de GitHub (rama de lanzamiento) y en la revisión de integración.
- **Carga y concurrencia del despliegue:** la web está parada unos segundos durante el cambio de versión (no es *zero downtime*), y no se ha medido.
