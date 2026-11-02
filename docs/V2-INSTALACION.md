# Planta 14 v2: rama de instalación

Rama **`desarrollo/planta14-v2-instalacion`**: `desarrollo/planta14-v2-mantenimiento` (`91c0728`) fusionada con `desarrollo/planta14-servidor` (`c22f59b`), sin conflictos, más los cambios de abajo. No se han tocado las demás ramas, `main` ni `mejora/presentacion-la-voz`. Sin PR, sin despliegues, sin contrataciones y sin secretos.

## Commit que se debe instalar

**`c29e02446361eeb5c3a7acaaab5d1bedbb4abf6e`** (`c29e024`)

Es el commit sobre el que se ejecutó la batería completa (abajo). El commit posterior, que añade este documento, solo cambia documentación. En la guía (`docs/PUESTA-EN-MARCHA-IONOS.md`) aparece como `COMMIT-VALIDADO`:

```bash
git fetch origin desarrollo/planta14-v2-instalacion
git checkout --detach c29e02446361eeb5c3a7acaaab5d1bedbb4abf6e
```

El servidor está en `86aed41`. Entre ese commit y este, los scripts del servidor (`infra/server/`) no cambian: repetir `setup-server.sh` debe dar 0 cambios.

## Qué se ha hecho

| Commit | Qué |
|---|---|
| `f061ac8` | Fusión con `desarrollo/planta14-servidor`: corrección de la swap y `restore-test.sh` con `docker rm -f -v` |
| `3c8ad32` | **Almacenamiento real de IONOS.** Tres buckets y una sola clave, con los endpoints oficiales y su origen documentado. La copia externa usa la clave única y nunca borra, sobrescribe ni crea el bucket. Nueva prueba `offsite-immutable-test.sh`, que lo comprueba por las peticiones HTTP |
| `0cf356b` | **pruebas.planta14.com** con la configuración de producción: `generate-production-env.sh --pruebas` y `CADDY_WWW_REDIRECT` (por defecto `on`: planta14.com sigue igual). El despliegue se niega a indexar un dominio que no sea planta14.com |
| `ae1d0bb` | Guía de instalación desde el servidor preparado (`86aed41`, 87.106.30.18) |
| `7bc6e40` | **Carga solo de estructura** (`npm run cms:structure`): 10 secciones de la navegación (incluida Opinión), los 6 concejos del Caudal y sus espacios municipales **inactivos**, sin contenido de demostración. Se puede repetir sin duplicar ni tocar lo existente. En la guía sustituye al importador de demostración |
| `91847d1` | «Contenido de ejemplo» en la página del concejo solo con `CONTENT_SOURCE=demo` |
| `5dc4fc4`, `4b80828` | Casilla **«Mostrar en la página del concejo»** en las noticias, marcada por defecto. Migración reversible `20261102_174946_mostrar_en_concejo` |
| `35392f0` | **Modo preproducción:** contraseña común en toda la web salvo `/api/health`, con el hash por variable. Se quita con `PREPRODUCTION_AUTH=off` y `aplicar-caddy.sh` (recrea solo Caddy, sin reconstruir). Tras la salida, `pruebas.planta14.com` redirige a `planta14.com` conservando la ruta. Procedimiento del día de la salida en la guía |
| `c29e024` | Preproducción **solo con periodistas** (cuentas `editor`); las cuentas municipales llegan después de la salida |

### Almacenamiento

| Bucket | Región | Endpoint |
|---|---|---|
| `planta14-originales-b11` (privado) | Berlín, `eu-central-3` | `https://s3.eu-central-3.ionoscloud.com` |
| `planta14-imagenes-b11` (lectura pública solo de `public/*`) | Berlín, `eu-central-3` | `https://s3.eu-central-3.ionoscloud.com` |
| `planta14-copias-b11` (compliance, 30 días) | Fráncfort, `eu-central-4` | `https://s3.eu-central-4.ionoscloud.com` |

Fuente: la tabla «Endpoints» de la documentación de IONOS para buckets «de contrato» (<https://docs.ionos.com/cloud/storage-and-backup/ionos-object-storage/endpoints>). Los buckets «de usuario» usan otras regiones, y las páginas antiguas que dan Berlín como `eu-central-2` corresponden a ese otro tipo. Desde este entorno la página no se pudo abrir directamente; su contenido se obtuvo del buscador. La guía pide comparar la región con la que muestra el panel en cada bucket.

## Resultados

Batería completa ejecutada **una vez**, el 2 de noviembre de 2026, sobre `c29e024`, en Linux (Docker Engine nativo). **Todo correcto.**

| Comando | Resultado |
|---|---|
| `infra/test/production-deploy-test.sh` | **SUPERADO**, 109 comprobaciones. Incluye la carga de estructura en el contenedor de producción y la sección nueva de preproducción (abajo). 0 volúmenes nuevos al terminar |
| `npm test` | 9 PASS |
| `npm run typecheck` | Sin errores |
| `npm run lint` | 0 errores, 16 avisos (los que ya había) |
| `npm run build` | Correcto |
| `npm run test:block2` | 8 PASS. La comparación demo/Payload de las páginas de concejo admite ahora que solo la demo lleva «Contenido de ejemplo» |
| `npm run test:block3` | 17 PASS |
| `npm run test:launch` | 6 PASS |
| `npm run test:instalacion` (nueva) | 5 PASS: estructura, carga repetible, etiqueta, casilla y migración reversible |
| `shellcheck -x` de todo `infra/` | Sin avisos |
| `caddy validate` (acme e internal) | `Valid configuration` |
| `common-test`, `staging-config-test`, `monitor-test`, `memory-test`, `staging-guard-test` | Correctos |
| `infra/test/restore-test.sh` | SUPERADA. **0 volúmenes nuevos** (limpieza con `docker rm -f -v`) |
| `RESTORE_TEST_APP_IMAGE=planta14-app:staging infra/test/restore-test.sh` | SUPERADA, como se hará en el servidor con la imagen de la web. Pasan las tres comprobaciones que fallaban en el servidor sin imagen. **0 volúmenes nuevos** |
| `infra/test/offsite-immutable-test.sh` (nueva) | SUPERADA, 17 comprobaciones |
| `infra/test/pruebas-config-test.sh` (nueva) | SUPERADA, 30 comprobaciones |
| `infra/test/preproduccion-test.sh` (nueva) | SUPERADA, 20 comprobaciones |
| `infra/test/postgres-roles-test.sh` | SUPERADA |
| `infra/test/staging-e2e.sh` (Playwright) | SUPERADO: 8 PASS y la restauración idéntica |

Corrección: `V2-MANTENIMIENTO.md` decía «27 PASS» en `test:launch`. Eran 6; el recuento estaba mal agrupado. Se corrige en este mismo commit.

### Lo que demuestran las pruebas nuevas

- **Copia externa** (`offsite-immutable-test.sh`, registrando cada petición HTTP de rclone):
  - la primera copia sube solo los 4 objetos nuevos, sin ningún DELETE ni intento de crear el bucket;
  - la repetición no escribe nada;
  - una copia local borrada no se borra fuera;
  - una copia local cambiada con el mismo nombre da error, sin escribir, y el objeto remoto queda intacto;
  - con `OFFSITE_*_KEY` vacías se usa la clave única.
- **pruebas.planta14.com** (`pruebas-config-test.sh`):
  - el generador pone dominio, `SITE_INDEXABLE=false`, sin www, contraseña de preproducción y copias bajo `planta14/pruebas`;
  - Compose da `SITE_URL` y `CMS_SERVER_URL` del dominio de prueba;
  - Caddy sirve solo `pruebas.planta14.com`, sin pedir un certificado imposible para `www.pruebas`;
  - planta14.com sigue con www → 301, también con un `.env` anterior sin la variable nueva;
  - el despliegue rechaza indexar pruebas, indexar con contraseña, la contraseña sin hash y la redirección del dominio anterior sin dominio.
- **Preproducción con HTTP real** (`preproduccion-test.sh` y la sección 3c del ensayo):
  - sin contraseña o con otra: 401 en portada, `/cms`, paneles, API, sitemap y robots;
  - con la común: 200;
  - `/api/health` y la comprobación de mantenimiento siguen abiertas;
  - con la contraseña puesta se entra en `/cms` con la sesión de Payload y una actualización funciona;
  - `aplicar-caddy.sh` la quita y **el contenedor de la web es el mismo** (no se reconstruye ni se reinicia);
  - tras la salida, `pruebas.planta14.com/ruta?x=1` → 301 a `https://planta14.com/ruta?x=1`.
- **Estructura** (`test:instalacion` y el ensayo):
  - 10 secciones en el orden de la navegación, con Opinión;
  - 6 concejos y 6 espacios inactivos y publicados, sin datos de contacto de ejemplo;
  - 0 noticias, avisos, autores, imágenes y usuarios;
  - la segunda ejecución no crea nada y respeta una sección renombrada y un espacio activado;
  - en el contenedor de producción, con el usuario de migraciones, completa las secciones que faltan tras la demo.
- **Casilla:**
  - viene marcada por defecto;
  - desmarcada, la noticia sigue publicada (página propia, portada o sección), pero no sale en la página del concejo;
  - al volver a marcarla, reaparece;
  - la migración baja (columnas fuera, noticias intactas) y sube (todas marcadas).

## Queda para decidir (Pablo)

1. **Retención de las copias externas.** La copia externa nunca borra, así que el bucket de Fráncfort crece cada noche. Hay que decidir cuánto se guarda y, si se quiere, poner en el panel una regla de ciclo de vida a partir de los 30 días del bloqueo (por ejemplo, 90 días).
2. **La clave única.** Con el Object Storage sencillo, el servidor tiene una clave que lo puede todo en los tres buckets. Los originales y las imágenes no tienen bloqueo: si se pierden, se recuperan de la copia nocturna (como mucho, un día). Si se quiere más aislamiento habría que pasar a un producto de IONOS con identidades separadas.
3. **Fecha y hora del día de la salida** y quién está presente: DNS, `.env` y despliegue (apartado 6 de la guía).
4. **Contraseña común de preproducción** y lista de periodistas con cuenta `editor`.
5. **Reglas de `[PRUEBA]`** para los periodistas. Lo que no lleve la marca se queda para el lanzamiento.
6. **Política del bucket de imágenes:** confirmar en el panel si se puede poner o si la aplica la persona técnica con `aws s3api`.

## Sin comprobar

- **IONOS real:**
  - los endpoints, la URL pública `https://planta14-imagenes-b11.s3.eu-central-3.ionoscloud.com` y la política de lectura de `public/*`;
  - que la subida a un bucket con bloqueo compliance acepta las cabeceras de integridad que envía rclone 1.71;
  - el bloqueo de 30 días en los objetos subidos.

  Todo eso se comprueba en la instalación de prueba (apartado 3 de la guía), con la clave real. Aquí el S3 es un sustituto (`rclone serve s3`) sin bloqueo de objetos.
- **Let's Encrypt, DNS y el servidor real:**
  - certificados de `pruebas.planta14.com`, `planta14.com`, `www` y la redirección del dominio anterior con DNS real;
  - el comportamiento con el monitor externo.

  Aquí todo usa certificado interno y resolución local.
- **El día de la salida de principio a fin.** Las piezas están probadas (preproducción, redirección, despliegue con `DEPLOY_FORCE=1`, guardas de `SITE_INDEXABLE`), pero no la secuencia completa con DNS real. El borrado de `[PRUEBA]` en `/cms` es manual y no se ha probado en un navegador; no está comprobado que el buscador de **Media** encuentre por el texto alternativo.
- **Navegador real con la contraseña de preproducción:** el diálogo del navegador y su recuerdo de la contraseña junto con la sesión de Payload. Se ha probado con `curl` (autenticación básica más la cookie de Payload).
- **Correo:** buzón `avisos@planta14.com`, recuperación de contraseña y alertas.
- **`infra/app.Dockerfile` dentro del despliegue:** el ensayo usa la imagen precompilada, porque aquí `npm ci` no funciona dentro de `docker build`.
