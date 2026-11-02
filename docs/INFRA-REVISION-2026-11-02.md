# Revisión de infraestructura — 2 de noviembre de 2026

Rama revisada y corregida: `desarrollo/planta14-v2-infra`, base `eb795d3` (incluye `044033b` y `56812db`). Copia de revisión independiente. No se han mezclado ni modificado bloque 2, bloque 3, main ni la demo. No hay PR, despliegue público ni contratación.

Se han leído `INFRA-STAGING.md`, `NETLIFY-CONFIG.md`, el informe original de restauración y todos los archivos de `infra/`, incluidos archivos ocultos, scripts, SQL, Dockerfile e ignore.

## Corregido en esta rama

- Compose fija `CMS_ENABLED=true` y `CONTENT_SOURCE=payload`, sin que una variable antigua reactive la demo accidentalmente.
- Caddy exige Basic Auth en todas las rutas de la aplicación. Usuario por variable y **hash bcrypt obligatorio** por `CADDY_BASIC_AUTH_HASH`. Compose rechaza configuraciones sin hash y Caddy también rechaza su configuración vacía.
- Se elimina el encabezado `Authorization` antes de llegar a Payload; las cuentas de la aplicación utilizan su cookie. El hash se guarda entre comillas simples en el env para conservar `$`.
- `noindex`, `no-store`, `nosniff`, política de referencia, HSTS, bloqueo de frames y restricciones de cámara/micrófono/geolocalización. Se ha añadido `handle_errors`: en una prueba real, los 401 no recibían inicialmente las cabeceras del handler normal. Ahora también se aplican en errores del proxy y desafíos de autenticación.
- El generador de entorno requiere bcrypt válido, valida dominio/email, no sobrescribe archivos y no guarda contraseñas exteriores en claro. El lector de env de copias admite comillas simples/dobles y CRLF sin ejecutar el archivo.
- Los fallos de `age`/GPG ya no quedan ocultos por la impresión del nombre de salida en una sustitución de comando. El cifrado se escribe en `.partial` y se publica tras éxito. Las copias incompletas no cuentan para la retención. Ante fallo se conserva el original local; no se anuncia éxito ni se ejecuta retención. Mantener `BACKUP_DIR` privado también es necesario para ese caso.
- La prueba de restauración puede migrar utilizando la imagen local de la aplicación en su red aislada (`RESTORE_TEST_APP_IMAGE`), sin instalar dependencias en el host. Ya no amplía los permisos de la clave age efímera al dar acceso a las carpetas de objetos de prueba.
- `.gitattributes` fija LF para infraestructura, evitando scripts con CRLF al trabajar desde Windows.

## Comprobaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| `shellcheck -x infra/generate-env.sh infra/lib/*.sh infra/backup/*.sh infra/restore/*.sh infra/minio/*.sh infra/test/*.sh` | Correcto, sin avisos |
| `bash infra/test/common-test.sh` | Correcto: fallos age/GPG, env con hash literal/CRLF y retención sin contar `.partial` |
| Generación de env con hash efímero | Correcta; preserva bcrypt, rechaza sobrescritura y hash ausente |
| `docker compose ... config --quiet` | Correcto con y sin perfil MinIO; hash ausente rechazado; se comprobaron valores CMS/payload y puertos |
| Caddy oficial `caddy:2.10.2-alpine`, `caddy validate` | Correcto; prueba negativa sin hash rechazada |
| `node infra/test/staging-config-test.mjs` | Correcto: 401 sin contraseña o con contraseña errónea, 200 autenticado contra backend de prueba y 502 al detenerlo; cabeceras también en 401/502 |
| `docker build -f infra/app.Dockerfile -t planta14-infra-review:local .` | Correcto: `npm ci`, build Next.js y exportación de imagen completos |
| Imagen runtime | `USER node`, UID 1000; sin `/app/.git`, `/app/infra` ni archivo de entorno staging |
| `RESTORE_TEST_APP_IMAGE=planta14-infra-review:local RESTORE_TEST_PAYLOAD=1 RESTORE_TEST_STORAGE=1 bash infra/test/restore-test.sh` | Correcto: 2 migraciones reales, 12 tablas y 20.251 filas idénticas; 45 objetos idénticos; age, SHA-256, retención y rechazo de destinos ocupados |

Las herramientas Bash, shellcheck y age se ejecutaron en un contenedor local Debian con el cliente oficial de Docker y Node 22.23.4. Los temporales se situaron en la ruta compartida con el motor de Docker: un `/tmp` exclusivo del contenedor de herramientas no se puede montar desde sus contenedores auxiliares. La primera prueba S3 detectó esa diferencia del entorno; la repetición completa con `TMPDIR` compartido fue satisfactoria. Los recursos y claves de prueba fueron efímeros.

La prueba de Caddy usa HTTPS con CA interna y puerto limitado a loopback, un backend simulado y credenciales aleatorias. La validación no publica el stack ni solicita certificados para dominios reales. Para repetir en un equipo con Node y Docker: `node infra/test/staging-config-test.mjs`.

No se observaron claves privadas ni credenciales reales en los archivos versionados revisados. Los hashes, env, claves age y copias generados se mantienen fuera de Git, bajo `infra/test/out` ignorado, y los tests los eliminan. Esta inspección no certifica todo el historial remoto ni secretos de paneles externos.

## Importante: pendiente, sin cambiar implementación

> **Seguimiento:** los puntos 3 a 7 se corrigen en [INFRA-CORRECCIONES-2026-11-02.md](INFRA-CORRECCIONES-2026-11-02.md). Los puntos 1 y 2 siguen pendientes.

1. **Falta integrar el código de contenidos.** Esta rama parte de fase 1: no existe un adaptador que interprete `CONTENT_SOURCE`. Las variables están corregidas, pero el frontend de esta rama todavía genera contenido demo. Integrar de forma coordinada los bloques de contenido y volver a probar la imagen resultante antes de levantar staging. No se ha hecho cherry-pick ni merge de otras ramas.
2. **Proveedor S3 e imagen MinIO sin resolver.** El perfil existente conserva la imagen Quay no validada; no se ha sustituido por un proveedor elegido por el agente. No usar el arranque con MinIO como una receta probada. Tampoco se ha confirmado que esa imagen incluya el cliente `mc` del healthcheck y del init. Además, `minio/init.sh` oculta errores al crear/asociar políticas con `|| true` y no comprueba rotación de credenciales existentes: revisar/reemplazar ese init cuando se elija el servidor, no dar por efectivos sus permisos sin probarlo.
3. **Copias de un S3 externo sin salida de red.** `run_rclone` usa por defecto `planta14-staging_backend`, que es `internal:true`. No podrá llegar a IONOS u otro S3 externo. Diseñar una red de salida para los trabajos de almacenamiento, manteniendo PostgreSQL sin puertos públicos; no se ha abierto la red interna para resolverlo de forma indiscriminada. MinIO tiene además una red no interna para publicar su consola en loopback: tampoco debe afirmarse que carece de salida. Si se cambia `COMPOSE_PROJECT_NAME`, también hay que ajustar `PG_CONTAINER` y `BACKUP_DOCKER_NETWORK`, cuyos valores de ejemplo no se derivan automáticamente.
4. **No hay copia fuera del servidor implementada.** Se generan copias locales únicamente. Falta destino, credenciales independientes, retención propia, protección contra borrado, calendario y alertas. `BACKUP_ENCRYPTION=none` continúa como valor inicial: decidir y configurar age/gestión de claves antes de usar datos reales. No equiparar sincronización de borrados con una copia recuperable.
5. **Credenciales PostgreSQL separadas.** La app y el migrador utilizan el usuario inicial de PostgreSQL, que la imagen crea como superusuario. Separar el usuario de migraciones del usuario de aplicación con permisos limitados requiere un cambio coordinado de roles, inicialización y rotación; queda sin modificar.
6. **Restauración de archivos confiables.** Falta de `.sha256` solo avisa y el tar de objetos se extrae sin validar una lista estricta de rutas/enlaces. Solo usar copias propias verificadas. Si se admite cualquier archivo externo, hay que endurecer validación y extracción antes de hacerlo; no se ha cambiado el contrato de restauración en esta revisión.
7. **Reproducibilidad estricta y tamaño de imagen.** Hay tres etapas, usuario no root y `npm ci` con lockfile. La base y frontend Dockerfile usan etiquetas, no digests fijados; no se demuestra un build bit a bit idéntico. El runtime copia código y dependencias de desarrollo para conservar el CLI Payload. Fijar digests y decidir un artefacto de migración separado/imagen mínima requiere política de actualización, no solo adelgazar a ciegas.

## Alternativas S3 para que decida Pablo

No se ha elegido, activado ni contratado ninguna:

| Alternativa | Qué aporta | Qué comprobar/decidir |
| --- | --- | --- |
| **IONOS Object Storage** | Servicio gestionado compatible S3; evita operar un servidor de objetos en el VPS | Cuenta/producto y región concreta, precio/egreso, claves por bucket, versionado y políticas de copia. Ensayar Payload, firmas y rclone con ese endpoint. |
| **Garage (Deuxfleurs)** | Alternativa libre autogestionada con API S3 y documentación de despliegue | Operación y actualizaciones propias, compatibilidad de las operaciones usadas, topología, retención y recuperación. Un solo nodo no proporciona redundancia. |
| **SeaweedFS comunitario** | Alternativa libre con interfaz S3 y contenedores documentados | Complejidad operativa, persistencia de metadatos y objetos, IAM/firmas, versión y recuperación. Distinguir la edición comunitaria de ofertas Enterprise. |
| **`rclone serve s3`** | Útil para restauración y pruebas efímeras; ya utilizado aquí | No se propone como almacenamiento de datos reales ni sustituye las pruebas de compatibilidad del proveedor definitivo. |

Fuentes primarias consultadas el 2 de noviembre de 2026: [Caddy Basic Auth](https://caddyserver.com/docs/caddyfile/directives/basic_auth), [IONOS Object Storage y buenas prácticas](https://docs.ionos.com/cloud/security-safeguards/best-practice-guideline/best-practice-cloud-storage-products), [Garage Quick Start](https://garagehq.deuxfleurs.fr/documentation/quick-start/), [SeaweedFS comunitario](https://github.com/seaweedfs/seaweedfs).

## No comprobado

Stack completo con contenido Payload integrado; proveedor S3/MinIO real; GPG positivo (solo se probó su propagación de fallo); DNS, certificados ACME públicos y cortafuegos de un VPS; copia externa y recuperación ante pérdida total del servidor. La configuración Netlify se revisó como transcripción de Pablo; no se accedió al panel ni se cambiaron ajustes.
