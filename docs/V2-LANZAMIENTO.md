# Planta 14 v2: preparación del lanzamiento (salida pública prevista el 4 de diciembre de 2026)

Revisión posterior de `70b9300`: [V2-LANZAMIENTO-REVISION.md](V2-LANZAMIENTO-REVISION.md). Corrige consentimiento/caché, frecuencia de salud, SMTP, cookies, sitemaps y manuales. Los resultados originales de este documento son históricos; el informe nuevo distingue las decisiones jurídicas pendientes y el fallo de aislamiento detectado en Docker Desktop.

Rama `desarrollo/planta14-v2-lanzamiento`, desde `origin/desarrollo/planta14-v2` (`2bb8270`). No se han tocado `desarrollo/planta14-v2` (en revisión), `main` ni `mejora/presentacion-la-voz`, ni tampoco `cms/public-media.ts`, las migraciones ni los scripts de test existentes. Sin PR, sin despliegues, sin contrataciones y sin secretos. El diseño se conserva: solo se añaden el pie legal, el banner de cookies y las páginas legales con el mismo estilo.

Medio editado por **Agencia Social de Servicios Asturiana S.L. (ASSA)**: NIF B33524216, Plaza La Salve, 14, bajo, 33900 Langreo (Asturias), 985 69 35 04, info@planta14.com. Queda pendiente el hueco visible **[REGISTRO MERCANTIL]** (tomo, folio y hoja). Los datos están en un único archivo, `lib/legal.ts`.

## Qué hay

| Entregable | Dónde |
|---|---|
| Páginas legales (pendientes de revisión por abogado) | `/aviso-legal` (LSSI), `/privacidad` (RGPD), `/cookies`, `/condiciones-cuentas-municipales`, enlazadas en el pie. Los huecos visibles son proveedores, plazos y registro. |
| Encargo de tratamiento para ayuntamientos | `docs/legal/ENCARGO-TRATAMIENTO-AYUNTAMIENTOS.md` |
| Declaración de derechos de imagen | `docs/legal/DECLARACION-DERECHOS-IMAGEN.md` (texto corto `v1`, que es el que se guarda; texto completo; campos que la prueban). El panel enlaza al texto completo. |
| Consentimiento de cookies | `components/cookie-consent.tsx`, `lib/consent.ts` (ver más abajo) |
| Compartir y buscadores | `lib/seo.ts`, `lib/site-config.ts`, `proxy.ts`, `app/robots.ts`, `app/(frontend)/sitemap.ts`, `app/(frontend)/sitemap-noticias.xml/route.ts` |
| Salud | `app/api/health/route.ts` |
| Alertas | `infra/lib/alert.sh`, `infra/monitor/check-disk.sh`, `infra/monitor/run-with-alert.sh` |
| CI | `.github/workflows/ci.yml` |
| Manuales | `docs/MANUAL-AYUNTAMIENTOS.md` (con capturas en `docs/img/manual-ayuntamientos/`) y `docs/MANUAL-OPERACION.md` |

### Cookies

- `GA4_MEASUREMENT_ID` (por ejemplo `G-XXXXXXXXXX`) se lee en el servidor. Sin ella, no hay banner ni analítica.
- Antes de decidir no se crea ninguna cookie: la del consentimiento es técnica y solo se escribe al elegir.
- GA4 se inserta únicamente tras **Aceptar**, sin señales publicitarias.
- **Rechazar** y **Aceptar** tienen el mismo tamaño y estilo.
- «Configurar cookies» en el pie vuelve a abrir el banner. Al retirar el consentimiento se borran `_ga*` y se recarga la página sin GA4.
- La elección dura 180 días y se versiona (`planta14_consent=1:accepted|rejected`).

### Indexación y vistas previas al compartir

- La web solo es indexable con `SITE_INDEXABLE=true` **y** contenido real (`CONTENT_SOURCE=payload`). El contenido de demostración nunca se indexa. Sin eso, toda respuesta lleva `X-Robots-Tag: noindex, nofollow` (también estáticos, API y 404), la meta `robots` es `noindex`, `robots.txt` dice `Disallow: /` y los sitemaps salen vacíos.
- `/cms`, `/api`, `/admin`, `/buscar`, `/niebla` y los paneles municipales son siempre `noindex`.
- Las noticias tienen `og:title`, `og:description`, `og:image` (URL absoluta de la variante `hero` de 1600 px de la copia pública, con su tamaño: ligera para WhatsApp y Facebook), `og:type=article`, tarjeta `summary_large_image`, URL canónica y JSON-LD `NewsArticle` (autor, editor `NewsMediaOrganization` con razón social ASSA, fechas e imagen), con `<` escapado.
- Los espacios municipales comparten su última imagen pública; si no tienen, el paisaje del concejo o la imagen por defecto.
- `sitemap.xml` (solo contenido publicado) y `sitemap-noticias.xml` (formato Google News, últimos 2 días). Ambos se calculan en cada petición.
- `htmlLimitedBots: /.*/` en `next.config.mjs` hace que los metadatos vayan siempre en `<head>`, sin streaming. Es más seguro para los rastreadores de redes sociales, y además el streaming hacía que el HTML variase entre peticiones, lo que rompía la comparación de `test:block2`.

### Salud y alertas

- `/api/health` responde `200 {"status":"ok","checks":{"database":"ok","storage":"ok"}}` cuando la web, la base de datos (`SELECT 1`) y el almacenamiento (`HeadBucket`) responden. Si algo falla, devuelve 503 con `error` en el componente afectado. Sin mensajes, hosts ni trazas (quedan en el log del servidor), con espera máxima de 4 s, `no-store` y `noindex`.
- Las alertas por correo usan curl SMTP y están **desactivadas** (`ALERT_EMAIL_ENABLED=false`); mientras tanto se anotan en `ALERT_LOG`. La contraseña SMTP se pasa por un archivo temporal privado, nunca por la línea de órdenes.
  - `run-with-alert.sh` avisa si falla una copia y conserva su código de salida.
  - `check-disk.sh` avisa por encima del 80 % (configurable).
- El monitor externo gratuito con aviso al móvil está explicado en `docs/MANUAL-OPERACION.md`.

### CI

`.github/workflows/ci.yml` se ejecuta en cada push a `desarrollo/**`. Hace `npm ci`, `test`, `typecheck`, `lint`, `build` (CMS desactivado) y `shellcheck` de `infra/`, y construye `infra/app.Dockerfile` con `push: false`. Las acciones están fijadas por SHA, con `permissions: contents: read`, `persist-credentials: false` y sin secretos. No publica ni despliega.

## Pruebas

Se ha añadido `npm run test:launch` (`scripts/launch-integration.mjs`). Usa PostgreSQL desechable (`compose.lanzamiento-test.yaml`, puerto 55435), S3rver (59006) y servidores `next start` (3061 a 3064). Con `MANUAL_SCREENSHOTS=true` genera también las capturas del manual.

| Criterio | Prueba automática |
|---|---|
| Sin consentimiento no se carga GA4 ni se crea ninguna cookie de analítica | `test:launch`, en Chromium. gtag.js está simulado y ninguna petición sale del equipo. Comprueba que antes de decidir no hay peticiones a Google ni ninguna cookie; que Rechazar y Aceptar tienen el mismo tamaño y color; que al rechazar solo queda `planta14_consent`; que al aceptar se carga GA4 con el ID; que la elección se recuerda; que retirar desde el pie borra `_ga*` y GA4 no vuelve a cargarse; y que sin ID no hay banner ni cookies. Además, `tests/launch.test.mjs` (en `npm test`) valida el ID, la cookie y su versión. |
| Una noticia publicada expone `og:title`, `og:description`, `og:image` y JSON-LD válido | `test:launch`: valores exactos, imagen absoluta de la variante `hero` con su anchura, `og:url`, canónica, tarjeta de Twitter, y JSON-LD que se puede leer como JSON con los campos de `NewsArticle`. El espacio municipal comparte su imagen. |
| `sitemap.xml` lista solo contenido publicado | `test:launch`: la noticia publicada aparece y el borrador no, tampoco en el sitemap de noticias. El borrador da 404. |
| Sin `SITE_INDEXABLE=true`, toda respuesta lleva noindex | `test:launch`: 15 respuestas (páginas, legales, API, sitemaps, `robots.txt`, imágenes, JS estático y 404) con `X-Robots-Tag` y meta `noindex`; sitemaps vacíos. Con la variable, las páginas públicas son indexables y las privadas no. `tests/launch.test.mjs` comprueba que el proxy y `site-config` aplican la misma regla. |
| `/api/health` responde 200, o 503 si falla la base de datos, sin detalles internos | `test:launch`: 200 con todo bien; 503 con la base de datos caída (sin `ECONNREFUSED`, host, puerto, nombre de base ni traza); 503 con el almacenamiento caído. |
| Alertas | `infra/test/monitor-test.sh`: disco por encima del umbral, copia fallida, correo desactivado y envío preparado con un `curl` simulado (destinatarios, asunto, contraseña fuera de la línea de órdenes y archivo temporal borrado). |

Resultados: ver el resumen de la entrega. Pasan `npm test`, `typecheck`, `lint`, `build`, `test:block2`, `test:block3`, `test:launch`, `monitor-test.sh`, `shellcheck` y `docker compose config`.

## Pendiente para el 4 de diciembre

1. **Abogado:** revisar los cuatro textos legales, el encargo de tratamiento y la declaración de imagen. Completar [REGISTRO MERCANTIL], proveedores, plazos de conservación y delegado de protección de datos. Valorar el Esquema Nacional de Seguridad para los ayuntamientos.
2. **Producción sin contraseña exterior:** el `Caddyfile` de staging exige siempre la contraseña de Caddy. Para la salida pública hace falta una variante de producción sin `basic_auth` (manteniendo cabeceras y HTTPS), con `/api/health` accesible para el monitor. No se ha hecho aquí para no tocar la configuración de staging.
3. **Variables de producción:** `CONTENT_SOURCE=payload`, `SITE_INDEXABLE=true` (solo ese día), `SITE_URL=https://planta14.com` y `GA4_MEASUREMENT_ID`. En GA4, configurar la retención de datos y desactivar Google Signals.
4. **Google Search Console** (y Google News, si se solicita): dar de alta el dominio y enviar `sitemap.xml` y `sitemap-noticias.xml`. Comprobar la vista previa con el depurador de compartir de Facebook y enviando un enlace por WhatsApp.
5. **Correo:** contratar el proveedor y activar `ALERT_EMAIL_ENABLED`, el correo de Payload y los avisos municipales.
6. **Monitor externo:** darlo de alta (manual de operación, apartado 1).
7. **CI:** la primera ejecución en GitHub ([ejecución 41451215780](https://github.com/PabloVelascoGarcia/planta14-web/actions/runs/41451215780), commit `e011b9c`) terminó **con éxito**: tests, tipos, lint, build, shellcheck y la construcción de `infra/app.Dockerfile` sin publicar. Es la primera vez que ese Dockerfile se construye con éxito, porque en el entorno del agente no se puede. Falta que alguien con acceso a Docker la arranque como imagen de producción.
8. Los pendientes de `docs/V2-INTEGRACION.md` (S3, CDN, copias activas, migración del contenido real).
