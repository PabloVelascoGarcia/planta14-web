# Revisión de la integración v2 — 2 de noviembre de 2026

Base revisada: `desarrollo/planta14-v2`, `2bb8270`. Trabajo en una copia aislada. No se modifican las ramas lanzamiento, bloque2, bloque3, infra, main ni la demo. Sin PR, despliegues, contrataciones ni secretos.

## Correcciones

- Bloqueo consultivo transaccional PostgreSQL por imagen (`pg_advisory_xact_lock`, espacio de nombres `1345401933`). Se adquiere **antes de leer/recontar** la copia vigente y dura hasta COMMIT/ROLLBACK de la petición. No se libera al terminar S3. La CLI abre una transacción propia por imagen. Usa las sesiones del adaptador fijado Payload 3.92.1: revisar esta integración al actualizar Payload.
- Los hooks que cambian varias imágenes adquieren sus bloqueos por ID ascendente; después conservan el orden de copia nueva y retirada anterior. Las ediciones de Media bloquean antes de escribir la fila. El reconciliador del registro comparte el bloqueo y vuelve a leer la referencia dentro de la transacción, incluso con margen de huérfanos cero.
- Prueba automática `scripts/block3-concurrency.mjs`, incluida en `test:block3`: mantiene abierta una transacción después de escribir SQL/S3, lanza otra edición y la limpieza, comprueba **dos esperas reales en `pg_locks`**, confirma que no terminan antes de COMMIT y verifica una sola copia vigente, su contador y la URL accesible. Los ensayos existentes de rollback comprueban también que la sincronización posterior no queda bloqueada.
- Retirada real desde el formulario `/cms` con Playwright: login de editor, campo Retirado, Motivo y **Save Draft**, recarga del formulario y comprobación de persistencia, desaparición pública y motivo en el panel municipal. El ensayo de staging usa el mismo recorrido y comprueba también el 404 de la imagen. No se emite un PATCH desde el código de prueba para efectuar la retirada; solo se observa la respuesta del formulario.
- `staging-e2e.sh` se niega antes de instalar su limpieza si ya existen contenedores o volúmenes del proyecto `planta14-staging`, incluso parados: el ensayo es destructivo con su propio entorno desechable y no debe adoptar uno existente.
- Regresión de `PG_CONTAINER`: vacío toma el contenedor del proyecto, `none` selecciona herramientas del host, un nombre explícito se conserva. El arreglo original era correcto.
- `restore-test.sh` comprueba desde el principio la dependencia `python3` que ya utilizaba.

## Registro, migraciones y pruebas anteriores

Se revisaron `public-media-ops`, `sync-public`, las migraciones de integración/bloque 3 y los cambios de pruebas respecto a `c7c25da`.

El registro se escribe antes de S3, fuera de la transacción de contenido; conserva el manifiesto de objetos y bucket tras rollback. Pasan el fallo del segundo PUT, la limpieza parcial, DeleteObjects con HTTP 200 y errores por objeto, la reparación de originales/variantes, la ejecución de la CLI, los tres huérfanos tras rollback y el traslado de copias al segundo bucket con limpieza del anterior. No equivale a una transacción distribuida ni a una prueba de un proveedor real.

La migración de integración conserva el registro al revertir y se niega con declaraciones de derechos. Bloque 3 se niega con cuentas municipales, retiradas vigentes o históricas y auditoría. Se prueban down/up y el relleno del contador, además de limpiar la copia que quedó huérfana tras la reversión SQL. No se han cambiado estas migraciones.

`test:block2` conserva todas sus comprobaciones: las diferencias son el orden de reversiones y la limpieza explícita de auditoría en la base desechable **después de comprobar el rechazo**. Mantiene la comparación de HTML demo/payload. `test:block3` conserva los ataques de aislamiento y restauración, añade declaración/purga/registro/reversiones; la retirada por API del ensayo opcional de navegador se sustituye por la retirada desde `/cms`. No se han eliminado aserciones para conseguir resultados verdes.

## Importante, pendiente de decisión y sin rediseñar

1. **Purga CDN fallida sin reintento efectivo.** `removePublicCopy` guarda `status=applied, purge=failed`; `cleanupLoggedOrphans` no selecciona ese estado. La promesa de reintento del comentario original no se cumple. Hace falta una cola de purga con las URL originales y reintentos/alertas. La retirada del origen sí se comprueba; una caché puede conservar la imagen hasta su TTL.
2. **Cambio de CDN/base URL.** Se conserva el bucket y el manifiesto S3, pero no la base URL histórica. Al cambiar bucket y dominio a la vez se construye la purga con la URL nueva, y un huérfano de un bucket anterior no se purga. Guardar URL/base por operación y definir la transición con el proveedor. Cambiar solo `PUBLIC_MEDIA_PREFIX` no relocaliza automáticamente copias existentes: `moved` compara el bucket.
3. **Inventario con escrituras activas.** La limpieza del registro ya comparte el bloqueo, pero `cleanupPublicBucket --apply` usa una fotografía de referencias y la edad del objeto; no conoce la transacción propietaria de un objeto desconocido. Una operación larga o dos inventarios pueden competir. Usar ventana sin escrituras hasta diseñar coordinación global/revalidación. Además, `--inventory` sin `--apply` solo deja el *inventario* en modo informativo: la CLI ejecuta antes `syncAllPublicMedia`, que sí crea, mueve y borra copias. No es un comando de solo lectura.
4. **Capacidad del pool PostgreSQL.** El registro autónomo usa el mismo pool que las transacciones de petición. Si todas las conexiones están ocupadas, una petición puede esperar una conexión para anotar la operación mientras las demás esperan su bloqueo. El bloqueo por imagen resuelve la carrera comprobada, pero no certifica carga arbitraria. Decidir pool separado/reserva para el registro, límites de concurrencia, tiempos máximos y ensayo de saturación antes de producción.
5. **Reconciliación operativa.** Un error S3 aborta la ejecución antes de revisar el resto de imágenes; hay que reintentar y monitorizar. Cada reintento fallido puede añadir otra operación de borrado. Falta una política de crecimiento/retención del registro que preserve la evidencia necesaria.
6. **Reversiones y conservación legal.** Los bloqueos evitan pérdidas silenciosas, pero no prueban que se haya exportado la evidencia antes de vaciarla manualmente. Definir exportación, custodia y autorización. El registro conservado no hace compatible el código actual con un esquema ya revertido: las pruebas lo usan después de reaplicar las migraciones.
7. **Aislamiento de red no certificado en Docker Desktop.** `restore-test.sh` devuelve exit 1: 30 comprobaciones correctas y una fallida, «la red de salida no llega a PostgreSQL por IP». La prueba sí consigue alcanzarlo por IP desde esa red, aunque no por nombre. No se ha quitado ni suavizado la aserción. Revisar en el host Linux elegido las reglas Docker/cortafuegos y el aislamiento entre redes; las declaraciones Compose por sí solas no bastan como evidencia. No se han cambiado redes ni cortafuegos del equipo del usuario.

## Validación

Datos exclusivamente sintéticos, PostgreSQL y S3 locales desechables. En Windows se ejecutan Node 26.7.0 y Chrome instalado; en Docker, Node 22.23.4 y Chromium de Playwright 1.64.1. Los ejecutores auxiliares y logs quedan ignorados; no se añaden dependencias al proyecto.

| Comando | Resultado |
| --- | --- |
| `npm ci --no-audit --no-fund` | correcto |
| `npm test` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0; 16 avisos de imágenes, 0 errores |
| `npm run build` | exit 0 |
| `CMS_BLOCK2_TEST=true npm run test:block2` | exit 0 |
| `CMS_BLOCK3_TEST=true CMS_BLOCK3_BROWSER_TEST=true npm run test:block3` | exit 0, incluido Chrome y concurrencia |
| `docker build -f infra/app.Dockerfile -t planta14-integracion-review:local .` | correcto, incluido `npm ci` dentro de Docker; sin alternativa precompilada |
| `shellcheck -x` de scripts de infra | exit 0, incluidos PostgreSQL e inicialización |
| `bash infra/test/common-test.sh` | 3 PASS |
| `node infra/test/staging-config-test.mjs` | 4 PASS desde Windows: Compose, Caddy oficial, cabeceras, contraseña y `/media` |
| `infra/test/restore-test.sh` | **exit 1: 30 OK y un fallo de aislamiento por IP**; restauraciones SQL/S3, cifrado, sumas, rutas hostiles y recuperación externa correctas |
| `infra/test/postgres-roles-test.sh` | exit 0, base nueva y existente; app sin permisos DDL |
| `infra/test/staging-e2e.sh` | exit 0: Chromium, retirada desde `/cms`, imagen 404, copia cifrada, borrado/restauración, siete páginas y datos idénticos |
| `infra/test/staging-guard-test.sh` | exit 0: conserva tanto un contenedor parado como un volumen preexistente y se niega a ejecutar el ensayo destructivo |

Para repetir el navegador fuera de staging: instalar Playwright en `.local/review-tools` (o indicar `PLAYWRIGHT_MODULE`), tener Chrome (`CHROME_PATH` opcional), construir la web, levantar `compose.bloque3-test.yaml` y usar las dos variables del comando de la tabla. Para staging se usa el Chromium del ejecutor Linux y la imagen construida con el Dockerfile real.

La imagen final ejecuta como `uid=1000(node)`; comprobado que no contiene `.git`, `infra` ni `.env`. No se modifica el Dockerfile de producción. El ejecutor Linux lleva Docker CLI/Compose, shellcheck, age, Python y Playwright; monta dependencias Linux en un volumen separado. Caddy se comprobó desde Windows porque el ejecutor no alcanzaba su puerto dinámico. La prueba de roles necesitó cambiar **solo en el ejecutor ignorado** `127.0.0.1` por `host.docker.internal` en la URL de su base temporal; no se alteraron permisos ni aserciones. El staging usa los puertos fijos locales y pasó con el ejecutor Linux. Ambos proyectos de las pruebas block2/block3 se detienen al terminar; el staging elimina exclusivamente sus recursos desechables.

Sin comprobar: S3/IAM/versionado y políticas de un proveedor, MinIO real, CDN/purga real, correo, DNS/ACME y HTTPS externo; saturación del pool y todos los órdenes posibles de operaciones concurrentes. No se han activado servicios reales.
