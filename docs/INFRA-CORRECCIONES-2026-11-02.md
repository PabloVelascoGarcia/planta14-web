# Correcciones de infraestructura: 2 de noviembre de 2026

Rama: `desarrollo/planta14-v2-infra`, sobre `819230d`. Responde a los puntos importantes de [INFRA-REVISION-2026-11-02.md](INFRA-REVISION-2026-11-02.md). Solo se han tocado `infra/` y `docs/`. Sin PR, sin despliegues y sin contrataciones. Guía de uso actualizada: [INFRA-STAGING.md](INFRA-STAGING.md).

| Punto de la revisión | Estado |
|---|---|
| 3. Copias de un S3 externo sin salida de red | **Corregido.** Red de salida propia (`planta14-backup-egress`) para los trabajos rclone, sin servicios del stack; los scripts se niegan si PostgreSQL está conectado a ella. La red `backend` sigue siendo interna. La red de lectura es automática según `S3_ENDPOINT`, y `PG_CONTAINER` y la red se derivan de `COMPOSE_PROJECT_NAME`. |
| 4. Sin copia fuera del servidor | **Corregido.** `offsite-sync.sh`: destino S3 configurable con credenciales propias. Solo añade (`copy --immutable`, nunca `sync`), solo sube copias cifradas y verifica con `rclone check`. `fetch-offsite.sh` recupera la copia. Probado con un emulador: se borran las copias locales y se restaura desde el destino externo. Retención y bloqueo contra borrado: en el proveedor (documentado). |
| 5. Credenciales PostgreSQL separadas | **Corregido.** Migrador propietario del esquema y aplicación con permisos solo de datos. Inicialización para bases nuevas (`initdb`) y procedimiento `apply-roles.sh` para bases existentes. La restauración deja los objetos al migrador. |
| 6. Restauración de archivos confiables | **Corregido.** `.sha256` obligatorio (`--allow-missing-checksum` explícito), con el nombre exacto del archivo. Se rechazan los enlaces simbólicos como entrada. El tar se valida antes de extraer (lista blanca, sin enlaces, especiales, rutas absolutas ni `..`), y el manifiesto se valida después. |
| 7. Imágenes por etiqueta | **Corregido** para PostgreSQL, Caddy, Node, rclone y el frontend Dockerfile (`etiqueta@sha256`), con el procedimiento de actualización documentado. **MinIO, sin digest**: su registro no es accesible desde aquí. |
| 2. Init de MinIO que ocultaba errores | Corregido de paso: sin `|| true`, rota el secreto en cada ejecución y crea el bucket público opcional. **No se ha ejecutado** (no hay imagen accesible). |

Preparación para el bloque 3:

- `PUBLIC_MEDIA_BASE_URL`, `PUBLIC_MEDIA_BUCKET`, `PUBLIC_MEDIA_PREFIX` y `PUBLIC_MEDIA_CACHE_CONTROL` en la plantilla y en la app, con un bucket público separado recomendado.
- Ruta `/media` de Caddy hacia el bucket público de MinIO, por una red propia sin acceso a PostgreSQL.
- Paso `npm run cms:media:sync-public` tras migrar.

## Comandos y resultados

Ejecutados en el entorno del agente: Docker 29.9.2, ShellCheck 0.11.0, Node 22.23.4. Payload se ejecutó desde `node_modules` en el host, instalado con `npm ci` en la misma copia de trabajo; no se reconstruyó la imagen de la app.

```text
$ shellcheck -x infra/generate-env.sh infra/lib/*.sh infra/backup/*.sh infra/restore/*.sh infra/minio/*.sh infra/postgres/*.sh infra/postgres/initdb/*.sh infra/test/*.sh
sin avisos (exit 0)

$ bash infra/test/common-test.sh
2026-11-02T11:38:28Z [planta14] Retención: borro test-20260923T113828Z.dump.age
PASS: encryption failures stop the backup, quoted env parsing and partial-file retention
PASS: mandatory checksum (explicit override only), exact file name, symlinks rejected
exit=0

$ docker compose -f infra/compose.staging.yaml --env-file <env generado> config --quiet   (con perfil minio)
exit=0
$ COMPOSE_PROFILES= docker compose ... config --quiet   (sin minio)
exit=0
$ docker compose ... --env-file infra/.env.staging.example config --quiet   (plantilla vacía: debe fallar)
exit=1 (esperado != 0)

$ node infra/test/staging-config-test.mjs
PASS: compose config, fixed CMS/payload, no public database/storage API ports, missing hash fails closed
PASS: official Caddy validates configuration and rejects missing password hash
PASS: /media serves only the public bucket, read-only, behind the staging password; traversal to the private bucket rejected
PASS: unauthenticated and wrong-password requests denied; authenticated proxy works; noindex/security headers on private responses
exit=0

$ infra/test/restore-test.sh
    [11:38:49] INFO: Migrated:  20261102_085958_fase1 (97ms)
    [11:38:49] INFO: Migrated:  20261102_090101_storage (4ms)
2026-11-02T11:38:50Z [restore-test] Tablas en origen: 12; filas: 20251
2026-11-02T11:38:51Z [restore-test] OK    nombre con fecha y cifrado
2026-11-02T11:38:51Z [restore-test] OK    el volcado cifrado no es legible sin la clave
2026-11-02T11:38:51Z [restore-test] OK    retención: quedan 3 copias (nueva + 3 y 5 días)
    public.media                                          120 |      120
    public.payload_kv                                       7 |        7
    public.payload_locked_documents_rels                    0 |        0
    public.payload_locked_documents                         0 |        0
    public.payload_migrations                               2 |        2
    public.payload_preferences_rels                        30 |       30
    public.payload_preferences                             30 |       30
    public.users_sessions                                  25 |       25
    public.users                                           25 |       25
    restore_test.concejos                                  12 |       12
    restore_test.noticias                               20000 |    20000
    restore_test.vacia                                      0 |        0
2026-11-02T11:38:55Z [restore-test] OK    mismo número de filas en todas las tablas
2026-11-02T11:38:55Z [restore-test] OK    hay tablas y filas que comparar
2026-11-02T11:38:56Z [restore-test] OK    se niega a restaurar sobre una base con datos
2026-11-02T11:38:56Z [restore-test] OK    restaurada: tablas de public del usuario de migraciones
2026-11-02T11:38:56Z [restore-test] OK    restaurada: la app lee los datos
2026-11-02T11:38:56Z [restore-test] OK    restaurada: la app no borra tablas
2026-11-02T11:38:56Z [restore-test] OK    sin .sha256 se niega
2026-11-02T11:38:56Z [restore-test] OK    sin .sha256 no crea la base
2026-11-02T11:38:58Z [restore-test] OK    sin .sha256 con --allow-missing-checksum restaura
2026-11-02T11:38:58Z [restore-test] OK    suma que nombra otro archivo: se niega
2026-11-02T11:38:58Z [restore-test] OK    enlace simbólico como copia: se niega
2026-11-02T11:38:58Z [restore-test] OK    tar con enlace, '..' o ruta absoluta (x): se niega
2026-11-02T11:38:58Z [restore-test] OK    tar con enlace, '..' o ruta absoluta (y): se niega
2026-11-02T11:38:58Z [restore-test] OK    tar con enlace, '..' o ruta absoluta (z): se niega
2026-11-02T11:38:58Z [restore-test] OK    nada se ha escrito fuera del directorio temporal
2026-11-02T11:39:02Z [restore-test] OK    copia de almacenamiento con fecha y cifrada
2026-11-02T11:39:05Z [restore-test] OK    mismo número de objetos
2026-11-02T11:39:05Z [restore-test] OK    contenido idéntico (rclone check origen/restaurado)
2026-11-02T11:39:06Z [restore-test] OK    se niega a restaurar sobre un bucket con objetos
2026-11-02T11:39:09Z [restore-test] OK    la red de salida no resuelve PostgreSQL
2026-11-02T11:39:12Z [restore-test] OK    la red de salida no llega a PostgreSQL por IP
2026-11-02T11:39:12Z [offsite-sync] AVISO: 1 copias sin cifrar NO se suben (configura BACKUP_ENCRYPTION=age)
2026-11-02T11:39:15Z [restore-test] OK    destino externo: copias cifradas de PostgreSQL y almacenamiento con sus sumas
2026-11-02T11:39:15Z [restore-test] OK    destino externo: no se suben copias sin cifrar
2026-11-02T11:39:16Z [offsite-sync] AVISO: 1 copias sin cifrar NO se suben (configura BACKUP_ENCRYPTION=age)
2026-11-02T11:39:17Z [restore-test] OK    repetir la copia externa no falla ni duplica
2026-11-02T11:39:18Z [restore-test] OK    un archivo local alterado no sobrescribe el externo
2026-11-02T11:39:21Z [restore-test] OK    descargadas con su .sha256
2026-11-02T11:39:22Z [restore-test] OK    desde el destino externo: mismo número de filas en todas las tablas
2026-11-02T11:39:25Z [restore-test] OK    desde el destino externo: contenido idéntico del almacenamiento
2026-11-02T11:39:25Z [restore-test] RESULTADO: prueba de restauración SUPERADA
exit=0
$ infra/test/postgres-roles-test.sh
2026-11-02T11:39:29Z [postgres-roles-test] OK    A: roles creados sin superusuario
    [11:39:32] INFO: Migrated:  20261102_085958_fase1 (74ms)
    [11:39:32] INFO: Migrated:  20261102_090101_storage (3ms)
    PASS: Payload works with the application user (create, login/session, read, update, delete)
2026-11-02T11:39:36Z [postgres-roles-test] OK    A: Payload funciona con el usuario de aplicación
2026-11-02T11:39:36Z [postgres-roles-test] OK    A: la app no crea tablas
2026-11-02T11:39:36Z [postgres-roles-test] OK    A: la app no borra tablas
2026-11-02T11:39:36Z [postgres-roles-test] OK    A: la app no vacía tablas
2026-11-02T11:39:36Z [postgres-roles-test] OK    A: la app no altera tablas
2026-11-02T11:39:36Z [postgres-roles-test] OK    A: la app no crea esquemas
2026-11-02T11:39:36Z [postgres-roles-test] OK    A: la app no crea tablas temporales
2026-11-02T11:39:39Z [postgres-roles-test] OK    A: la app no puede reiniciar ni migrar la base
2026-11-02T11:39:39Z [postgres-roles-test] OK    A: todas las tablas de public son del migrador
2026-11-02T11:39:39Z [postgres-roles-test] OK    A: el migrador crea y borra tablas
2026-11-02T11:39:40Z [postgres-roles-test] OK    A: lo que cree el migrador después es usable por la app
2026-11-02T11:39:40Z [postgres-roles-test] OK    A: otros usuarios no pueden conectarse a la base
    [11:39:45] INFO: Migrated:  20261102_085958_fase1 (100ms)
    [11:39:45] INFO: Migrated:  20261102_090101_storage (4ms)
2026-11-02T11:39:45Z [postgres-roles-test] OK    B: antes, las tablas son del superusuario
2026-11-02T11:39:46Z [postgres-roles-test] OK    B: apply-roles es idempotente y conserva los datos
    PASS: Payload works with the application user (create, login/session, read, update, delete)
2026-11-02T11:39:50Z [postgres-roles-test] OK    B: Payload funciona con el usuario de aplicación
2026-11-02T11:39:50Z [postgres-roles-test] OK    B: la app no crea tablas
2026-11-02T11:39:50Z [postgres-roles-test] OK    B: la app no borra tablas
2026-11-02T11:39:50Z [postgres-roles-test] OK    B: la app no vacía tablas
2026-11-02T11:39:50Z [postgres-roles-test] OK    B: la app no altera tablas
2026-11-02T11:39:50Z [postgres-roles-test] OK    B: la app no crea esquemas
2026-11-02T11:39:50Z [postgres-roles-test] OK    B: la app no crea tablas temporales
2026-11-02T11:39:53Z [postgres-roles-test] OK    B: la app no puede reiniciar ni migrar la base
2026-11-02T11:39:53Z [postgres-roles-test] OK    B: todas las tablas de public son del migrador
2026-11-02T11:39:53Z [postgres-roles-test] OK    B: el migrador crea y borra tablas
2026-11-02T11:39:54Z [postgres-roles-test] OK    B: lo que cree el migrador después es usable por la app
2026-11-02T11:39:54Z [postgres-roles-test] OK    B: otros usuarios no pueden conectarse a la base
2026-11-02T11:39:56Z [postgres-roles-test] OK    B: el migrador puede ejecutar migraciones
2026-11-02T11:39:56Z [postgres-roles-test] RESULTADO: usuarios PostgreSQL separados SUPERADA
exit=0
```

## Sin comprobar

- **Stack completo con el código de los bloques 2 y 3:** esta rama sigue en fase 1.
- **Proveedor S3, CDN o destino externo reales:** solo se ha probado con emuladores, sin bloqueo de objetos ni ciclo de vida.
- **MinIO:** ni la imagen, ni `mc`, ni `init.sh`.
- **Construcción de la imagen de la app con el digest de Node:** `npm ci` no pasa por el proxy dentro del build en este entorno.
- **Cifrado GPG en positivo.**
- **DNS, ACME público y cortafuegos.**
- **Ruta `/media`:** se probó con un MinIO simulado (servidor de archivos), no con MinIO real.
- **Aislamiento de la red de salida:** se comprobó por nombre y por IP en este Docker; en el servidor depende de las reglas de red de Docker del host.
