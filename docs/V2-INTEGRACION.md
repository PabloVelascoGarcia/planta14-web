# Planta 14 v2: integración

Revisión posterior de `2bb8270`: [V2-INTEGRACION-REVISION.md](V2-INTEGRACION-REVISION.md). Añade bloqueo PostgreSQL por imagen y prueba concurrente, retirada desde el formulario `/cms` y construcción del Dockerfile real. Incluye límites pendientes del registro, inventario y purga CDN; las comprobaciones originales de este documento son históricas.

Rama `desarrollo/planta14-v2`: `origin/desarrollo/planta14-v2-bloque3` (`c7c25da`) con `origin/desarrollo/planta14-v2-infra` (`ab159a9`) fusionada sin conflictos. Las ramas bloque2, bloque3 e infra quedan congeladas como histórico. No se han tocado `main`, `mejora/presentacion-la-voz` ni las ramas de respaldo. Sin PR, sin despliegues, sin contrataciones y sin secretos. Fecha: 2 de noviembre de 2026.

Leídos antes: [V2-BLOQUE3-REVISION.md](V2-BLOQUE3-REVISION.md) y [INFRA-CORRECCIONES-2026-11-02.md](INFRA-CORRECCIONES-2026-11-02.md).

## Pendientes cerrados

| # | Pendiente | Solución |
|---|---|---|
| 1 | Caché de imágenes públicas | `PUBLIC_MEDIA_CACHE_CONTROL` por defecto `public, max-age=86400` (ya no `immutable`). Gancho de purga del CDN (`CDN_PURGE_ENABLED=false`, `CDN_PURGE_URL`, `CDN_PURGE_TOKEN`; contrato genérico `POST {"urls":[...]}` con `Bearer`), llamado con las URL del original y sus variantes al retirar, despublicar o borrar. El resultado (`disabled`/`sent`/`failed`) queda en el registro. Probado con un servidor local que recibe las tres purgas. |
| 2 | Registro duradero y huérfanos | Colección `public-media-ops`: cada creación y borrado de objetos públicos se anota **antes** de tocar S3, con escritura propia fuera de la transacción de la petición. `cms:media:sync-public` borra las copias registradas que ya no son la vigente de su imagen, con un margen de 10 min para transacciones en curso, y reintenta los borrados fallidos. `Media.publicBucket` guarda el bucket de cada copia: al cambiar `PUBLIC_MEDIA_BUCKET` la copia se mueve. Modos `--inventory` y `--cleanup-bucket=<anterior>` (con `--apply`; sin él solo informan) para objetos que el registro no conoce. La reversión de la migración **conserva** el registro, así que los huérfanos se limpian también tras una reversión SQL. |
| 3 | Reversión del bloque 3 | `down` se niega si hay contenidos retirados (también en versiones) o registros de auditoría, además de cuentas municipales. Hay que exportarlos y resolverlos expresamente. La nueva migración `integracion` se niega si hay declaraciones de derechos. |
| 4 | Imágenes municipales | La cuenta municipal debe marcar la declaración y dar un autor o crédito no vacío; si no, la subida se rechaza (400). Se guardan el texto versionado de la declaración, quién (`declaredBy`, desde la sesión) y cuándo (`declaredAt`, del servidor). El cliente no puede falsificarla y nadie puede escribirla como dato. Las fichas municipales muestran la imagen con su crédito. |
| 5 | Staging `/media` | Servido por Caddy detrás de la misma contraseña que el resto. Comprobado en navegador: 401 sin contraseña y 200 con ella. |

También se ha corregido un fallo de la rama infra: con `PG_CONTAINER=` vacío (el valor de la plantilla), las copias y restauraciones usaban `pg_dump` del host. Ahora vacío significa `<proyecto>-postgres-1`, y `none`, las herramientas del host.

Migración nueva `20261102_121412_integracion`: `public_media_ops`, `media.public_bucket` y `media.rights_declaration_*`. `migrate:create` confirma que no queda ningún cambio de esquema pendiente.

## Prueba completa del staging en Docker

```bash
npm ci && npm run build && docker build -f infra/test/app-prebuilt.Dockerfile -t planta14-app:staging .
```

```bash
infra/test/staging-e2e.sh
```

**Imagen de la app:** `docker build -f infra/app.Dockerfile` vuelve a fallar en este entorno con `npm error Exit handler never called!` a los ~72 s de `npm ci`, porque el build no pasa por el proxy de salida. No se ha tocado `infra/app.Dockerfile`. La alternativa usada (`infra/test/app-prebuilt.Dockerfile`) empaqueta lo compilado en el host con el mismo Node 22.23.4, la misma base fijada por digest, el usuario `node`, el mismo `HEALTHCHECK` y `npm start`, y sin ningún ajuste de red. La imagen no contiene `.git`, `infra` ni archivos `.env` reales.

**Sustituto de MinIO:** la imagen de MinIO no es accesible desde aquí. `infra/test/compose.staging-e2e.yaml` lo sustituye por dos servicios de la imagen oficial de rclone fijada por digest:

- `rclone serve s3`, autenticado, en la red interna;
- `rclone serve http`, de solo lectura, que expone solo el directorio del bucket público, como upstream de `/media`.

Fue necesario desactivar la caché de directorios de `serve http`; si no, cortaba la respuesta de un archivo ya borrado en lugar de dar 404.

Recorrido:

1. Stack real de `infra/compose.staging.yaml` (Caddy con HTTPS por CA interna en `https://localhost`, contraseña bcrypt, PostgreSQL 17 con usuarios separados, app y `migrate`).
2. Migraciones con `planta14_migrator`; la app conecta como `planta14_app`.
3. `cms:bootstrap`, `cms:import:municipal` (con `NODE_ENV=development`, que exige el script) y `cms:media:sync-public`.
4. **Navegador real:** Chromium de Playwright 1.63 (HeadlessChrome 153, sin proxy, móvil 390×900) a través de Caddy:
   - contraseña de staging en web, `/cms`, API y `/media`;
   - web pública en modo payload;
   - inicio de sesión del editor por el formulario de `/cms`;
   - panel de Lena: el aviso no se sube sin la declaración; con ella se publica con imagen;
   - el aviso aparece en `/lena` con la imagen servida desde `/media`;
   - retirada con motivo hecha por el editor desde su sesión del navegador, por la API REST (no con los formularios de `/cms`): la imagen da 404 y el motivo aparece en el panel de Lena;
   - el panel de Mieres rechaza la cuenta de Lena;
   - sin errores de JavaScript.
5. **Copia** cifrada con age de PostgreSQL y del bucket privado. **Borrado** del entorno (`down -v` y datos de S3, verificado). **Restauración** en un entorno nuevo (objetos a nombre del migrador), arranque y sincronización de imágenes.
6. **Comparación:** HTML de siete páginas antes y después (se normaliza la clave aleatoria de `/media` y las etiquetas de streaming de Next), recuento de filas de todas las tablas de datos, la publicación vigente sigue, el aviso retirado sigue fuera, la imagen vigente se sirve y el administrador inicia sesión.

Salida (líneas de resultado):

```text
2026-11-02T12:37:18Z [staging-e2e] == Entorno: contraseña de staging, secretos aleatorios, buckets vacíos
2026-11-02T12:37:19Z [staging-e2e] == Arranque: postgres, s3, migraciones (migrador), app y Caddy
2026-11-02T12:37:34Z [staging-e2e] == Bootstrap del administrador, importación municipal y sincronización de imágenes
[12:37:39] INFO: Administrador creado. Retira CMS_BOOTSTRAP_PASSWORD del entorno.
[12:37:44] INFO: Estructura y demostración municipal importadas. No se importan noticias editoriales, autores ni archivos.
[12:37:49] INFO: Imágenes revisadas: 0. Huérfanos del registro limpiados: 0
2026-11-02T12:37:49Z [staging-e2e] La app usa el usuario PostgreSQL planta14_app; las migraciones, planta14_migrator
2026-11-02T12:37:49Z [staging-e2e] == Navegador real detrás de Caddy
PASS: staging password required for the site, /cms, the API and /media (wrong password rejected)
PASS: public web served through Caddy in payload mode (Lena space from Payload; demo-only route 404)
PASS: editor signs in through the /cms login form
PASS: Lena signs in to her panel and publishes a notice with image; the rights declaration is required and stored
PASS: the notice appears at once on /lena with its image from /media (200 with password, 401 without)
PASS: withdrawal with reason: gone from the web, image 404, reason shown in Lena’s panel
PASS: the Mieres panel rejects the Lena account (no form, no data)
PASS: no JavaScript errors in the pages visited
2026-11-02T12:38:02Z [staging-e2e] Páginas y recuento de filas guardados: 23 tablas, 181 filas
2026-11-02T12:38:02Z [staging-e2e] == Copia de seguridad (cifrada con clave age efímera)
2026-11-02T12:38:02Z [backup-postgres] Volcando la base planta14 (usuario planta14)
2026-11-02T12:38:03Z [backup-postgres] Copia creada: infra/test/out/e2e-9b43b196/backups/postgres/planta14-postgres-planta14-20261102T123802Z.dump.age (148K)
2026-11-02T12:38:03Z [backup-storage] Descargando objetos del bucket planta14-staging
2026-11-02T12:38:03Z [backup-storage] Objetos descargados: 4
2026-11-02T12:38:03Z [backup-storage] Copia creada: infra/test/out/e2e-9b43b196/backups/storage/planta14-storage-planta14-staging-20261102T123803Z.tar.gz.age (4.0K)
2026-11-02T12:38:03Z [staging-e2e] Copias: planta14-postgres-planta14-20261102T123802Z.dump.age, planta14-storage-planta14-staging-20261102T123803Z.tar.gz.age
2026-11-02T12:38:03Z [staging-e2e] == Borrado completo del entorno (contenedores, volúmenes y datos de S3)
2026-11-02T12:38:06Z [staging-e2e] == Restauración en un entorno nuevo
2026-11-02T12:38:09Z [restore-postgres] Suma SHA-256 verificada
2026-11-02T12:38:09Z [restore-postgres] Restaurando en planta14 (propietario planta14_migrator)
2026-11-02T12:38:10Z [restore-postgres] Restauración completada en planta14
2026-11-02T12:38:10Z [restore-storage] Suma SHA-256 verificada
2026-11-02T12:38:11Z [restore-storage] Subiendo 4 objetos a planta14-staging
2026-11-02T12:38:12Z [restore-storage] Restauración del almacenamiento completada: 4 objetos verificados en planta14-staging
[12:38:24] INFO: Imágenes revisadas: 2. Huérfanos del registro limpiados: 0
2026-11-02T12:38:27Z [staging-e2e] == Comparación antes / después
2026-11-02T12:38:27Z [staging-e2e] Registro de copias públicas tras restaurar: 5 operaciones (incluye la nueva copia)
2026-11-02T12:38:27Z [staging-e2e] OK    _.html idéntico
2026-11-02T12:38:27Z [staging-e2e] OK    _agenda.html idéntico
2026-11-02T12:38:27Z [staging-e2e] OK    _aller.html idéntico
2026-11-02T12:38:27Z [staging-e2e] OK    _comarca_caudal.html idéntico
2026-11-02T12:38:27Z [staging-e2e] OK    _edicion.html idéntico
2026-11-02T12:38:27Z [staging-e2e] OK    _lena.html idéntico
2026-11-02T12:38:27Z [staging-e2e] OK    _mieres.html idéntico
2026-11-02T12:38:27Z [staging-e2e] OK    filas-datos.txt idéntico
2026-11-02T12:38:27Z [staging-e2e] OK    la publicación vigente de Lena sigue en /lena
2026-11-02T12:38:27Z [staging-e2e] OK    el aviso retirado sigue fuera de la web
2026-11-02T12:38:27Z [staging-e2e] OK    la imagen pública vigente se sirve tras restaurar y sincronizar
2026-11-02T12:38:27Z [staging-e2e] OK    el administrador restaurado inicia sesión
2026-11-02T12:38:27Z [staging-e2e] RESULTADO: staging de extremo a extremo SUPERADO
```

## Resto de comprobaciones

| Comando | Resultado |
|---|---|
| `npm test` | 4 PASS |
| `npm run typecheck` | sin errores |
| `npm run lint` | 0 errores, 16 avisos `<img>` (15 previos y uno nuevo por la imagen de la ficha municipal; la misma regla) |
| `npm run build` | correcto |
| `npm run test:block2` (PostgreSQL 55433) | 8/8 PASS |
| `npm run test:block3` (PostgreSQL 55434) | 16/16 PASS |
| `shellcheck -x` de todos los scripts de `infra/` | sin avisos |
| `bash infra/test/common-test.sh` | 2 PASS |
| `docker compose ... config --quiet` | correcto con y sin MinIO; la plantilla vacía y el override sin `E2E_S3_DIR` fallan, como deben |
| `node infra/test/staging-config-test.mjs` | 4 PASS |
| `infra/test/restore-test.sh` | SUPERADA, 31 OK (cinco migraciones reales, 26 tablas, 20.254 filas, restauración desde el destino externo) |
| `infra/test/postgres-roles-test.sh` | SUPERADA, 28 OK (base nueva y base existente; Payload funciona con el usuario de la app; sin DDL para la app) |
| `infra/test/staging-e2e.sh` | SUPERADO (salida arriba) |

En `test:block3` se han añadido estas pruebas:

- declaración municipal obligatoria y no falsificable;
- purga del CDN en retirada, despublicación y borrado;
- huérfanos tras una reversión de transacción, que el registro detecta y limpia (antes era solo un diagnóstico);
- cambio de bucket con limpieza del anterior (en prueba y con `--apply`), y negativa a limpiar el bucket privado sin prefijo;
- reversiones bloqueadas por declaraciones, cuentas municipales, retiradas y auditoría;
- copia huérfana tras la reversión SQL, limpiada mediante el registro.

`test:block2` revierte antes la migración de integración y vacía expresamente la auditoría antes de revertir el bloque 3.

## Lo que falta para producción

1. **Contratar:** servidor IONOS, almacenamiento de objetos con un bucket público separado (y CDN, si se quiere), correo transaccional, dominio y destino externo de las copias. Costes orientativos en [INFRA-STAGING.md](INFRA-STAGING.md).
2. **Construir la imagen con `infra/app.Dockerfile`** en un entorno con acceso normal a npm (CI o el servidor) y publicarla en un registro privado. Aquí solo se ha probado la alternativa precompilada.
3. **S3 real:** probar Payload, firmas, políticas anónimas del bucket público (solo lectura de objetos, sin listado), versionado, rclone y `sync-public` con el proveedor elegido. Elegir y probar la imagen de MinIO, o prescindir de ella.
4. **CDN:** adaptar `purgeCDN` al API concreto (o a un servicio intermedio), decidir el TTL definitivo y probar la purga real.
5. **Correo:** adaptador de Payload, recuperación de contraseñas y activación del aviso por correo de las publicaciones municipales.
6. **Copias:** activar `BACKUP_ENCRYPTION=age` con la clave privada fuera del servidor, programar copias, copia externa y alertas, y configurar retención y bloqueo de objetos en el destino.
7. **Despliegue HTTPS público:** DNS, certificado ACME real, cortafuegos, acceso SSH con segundo factor y monitorización.
8. **Concurrencia de copias públicas:** dos transacciones simultáneas sobre la misma imagen pueden competir; falta un bloqueo por imagen. El registro y el margen de 10 min reducen el riesgo, pero no lo eliminan.
9. **Producto y legal:** texto definitivo de la declaración de derechos (hoy `v1`) revisado por quien corresponda, contratos de encargo de tratamiento (RGPD) y procedimiento de exportación de auditoría y retiradas antes de cualquier reversión.
10. **Lo abierto en revisiones anteriores:** auditoría campo a campo, adjuntos PDF en el panel, programación de publicaciones y migración del contenido editorial real.

## Sin comprobar

- **`infra/app.Dockerfile` en este entorno**, por la limitación de red descrita.
- **MinIO real y `minio/init.sh`:** el S3 y `/media` se probaron con rclone.
- **Google Chrome:** la prueba usó el Chromium de Playwright, no Chrome de marca.
- **Retirada desde el formulario de `/cms`:** se hizo por la API REST con la sesión del editor en el navegador.
- **Servicios reales:** CDN y purga, S3 de un proveedor, correo, DNS, ACME y cortafuegos.
- **Carreras concurrentes** en las copias públicas.
