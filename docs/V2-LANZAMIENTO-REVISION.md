# Revisión del lanzamiento — 2 de noviembre de 2026

Base: `desarrollo/planta14-v2-lanzamiento`, `70b9300`. Copia de trabajo aislada. No se modifica `desarrollo/planta14-v2`, main ni la demo; no se fusiona el trabajo paralelo. Sin PR, despliegues, contrataciones, correo real ni secretos en Git.

## Correcciones realizadas

- Consentimiento mal formado o con campos sobrantes: falla cerrado y vuelve a pedir una elección. GA4 comprueba la cookie inmediatamente antes de insertar el script; no hay etiquetas de carga/preconexión antes de aceptar. Al retirar se activa `ga-disable`, se quita la etiqueta y se recarga. Se revalida al volver mediante Atrás/Adelante, recuperar visibilidad/foco y recibir un aviso de otra pestaña por BroadcastChannel, sin almacenamiento persistente adicional.
- Salud: resultados compartidos 15 segundos por proceso y una única operación de base de datos/S3 en curso. El plazo de respuesta de 4 segundos no olvida una consulta todavía pendiente ni permite acumular otras detrás; S3 usa cancelación y un único intento. Se conservan el formato mínimo, 200/503, no-store y noindex, sin hosts, credenciales ni trazas en la respuesta. No es un limitador distribuido de tráfico.
- SMTP: se escapan barras/comillas del archivo curl, se rechazan saltos de línea en credenciales/cabeceras y protocolos ajenos a SMTP, archivo privado de modo 600, limpieza mediante trap y credenciales retiradas del entorno del proceso curl. Un envío fallido devuelve error y deja «ENTREGA FALLIDA» en el registro cuando es escribible. La tarea de copia conserva su código original.
- Cookies: añadido `payload-theme` (365 días al elegir tema), sesión demo corregida a 8 horas y sesión Payload de 2 horas con posible renovación. GA se describe con identificadores seudónimos y caducidad renovable; no se atribuye anonimato a su cookie. La tabla distingue usos condicionales. Se contrastaron los nombres y plazos con `lib/auth.ts` y Payload 3.92.1 instalado.
- Contraseñas: los textos describen hash, no cifrado reversible. ASSA sigue como titular/responsable del sitio; no se inventan ni verifican externamente los datos societarios. **[REGISTRO MERCANTIL] se conserva literalmente**, igual que el resto de huecos pendientes. La privacidad no presenta como ya implantadas las medidas de una instalación aún pendiente.
- Sitemap: incluye espacios municipales publicados, omite fechas inválidas en lugar de romper XML y el sitemap de noticias deja de permitir cinco minutos de caché después de una despublicación. SITE_URL debe ser un origen HTTP(S), sin credenciales, ruta, parámetros ni fragmento.
- Manuales: no presentan proveedores o copias nocturnas como ya contratados/configurados; distinguen staging de producción. Se concreta cómo guardar una retirada en el CMS y se elimina la recomendación de crear otra publicación para eludirla. La imagen compartida/caché no se promete eliminar instantáneamente de todos los destinos.
- El ensayo destructivo de staging se niega si encuentra contenedores o volúmenes de ese proyecto, incluso parados. La prueba de restauración verifica al principio su dependencia de Python.

## Importante: decisiones pendientes, sin modificar

1. **Encargo RGPD y bases jurídicas.** La privacidad atribuye a ASSA cuentas/auditoría como responsable y el encargo incluye esas mismas operaciones como tratamiento por cuenta del ayuntamiento. La base contractual del personal tampoco se puede dar por resuelta solo porque el contrato se firme con su ayuntamiento. El abogado debe separar finalidades, responsabilidades, bases, instrucciones, retirada editorial y conservación. Se mantiene el modelo como borrador, sin atribuirle validez jurídica. Referencias: [artículo 28 RGPD (BOE)](https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807), [AEPD: contenido del encargo](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/8-responsable-y-encargado-del-tratamiento/FAQ-0238-cual-seria-el-contenido-del-contrato-de-encargo-de-tratamiento).
2. **Proveedores, transferencias y alcance de GA4.** Completar subencargados, ubicaciones, plazos, DPD si procede y evidencia de garantías de transferencia. El encargo dice que no se prevén transferencias fuera del EEE mientras la privacidad contempla Google/EE. UU.; hace falta delimitar tratamientos y revisar la medición en paneles y posibles URL con datos personales. No se ha certificado la configuración de una propiedad GA4 ni la adhesión de proveedores a un mecanismo de transferencia. No se han elegido proveedores.
3. **Textos aún no publicables como definitivos.** Conservar la señal de borrador hasta revisión jurídica y completar los huecos. El aviso legal no acredita por sí mismo autorizaciones sobre fotos/textos de la demo. Confirmar también derechos efectivos, medidas implantadas, procedimiento de ejercicio de derechos, conservación de auditoría y devolución/supresión de copias antes de firmar el modelo.
4. **No mezclar las ramas sin integración posterior.** Esta rama procede de `2bb8270` y no incorpora automáticamente las correcciones concurrentes de `desarrollo/planta14-v2` ni las decisiones sobre registro de copias públicas, bloqueo de imágenes y purga CDN. No se han traído aquí esos cambios grandes. La salida pública requiere integrar y repetir las pruebas.
5. **Alertas sin cola ni segundo canal.** No hay reintento automático del correo. Si SMTP falla, los wrappers preservan el resultado de la tarea; si además el registro no se puede escribir, falta persistencia fiable de la alerta. Decidir supervisión externa, prueba de entrega, retención y reintentos. Las alertas de infraestructura y el adaptador de correo de Payload son sistemas distintos.
6. **Aislamiento por IP no certificado.** `restore-test.sh` falla en «la red de salida no llega a PostgreSQL por IP»: en Docker Desktop sí llega. Se conservó la comprobación, sin suavizarla. Revisar Docker/cortafuegos en el host Linux elegido antes de afirmar aislamiento entre redes.
7. **Fechas editoriales.** El sitemap tolera una fecha defectuosa, pero los campos de fecha editorial siguen siendo texto; una fecha inválida puede romper páginas que la formatean. Añadir validación coherente a la entrada requiere revisar el contrato de contenidos y los datos existentes. `dateModified` del JSON-LD sigue usando publicación, no una fecha real de revisión editorial; definirla y propagarla antes de depender de ella.
8. **Cobertura CI y operación.** El flujo actual ejecuta pruebas unitarias, tipos, lint, build, shellcheck y construcción Docker. No ejecuta block2/block3/launch ni restauración; decidir su incorporación. Faltan producción sin BasicAuth, límites de tráfico en el frontal y supervisión real. El caché de salud es por proceso y puede tardar 15 segundos en reflejar un cambio; un despliegue con varios procesos genera una sonda por proceso.

## Verificación

Datos sintéticos y recursos locales desechables. Node 26.7.0 y Chrome instalado en Windows; Node 22.23.4 y Chromium de Playwright 1.64.1 en el ejecutor Linux. Dependencias del proyecto sin cambios; Playwright auxiliar y logs ignorados.

| Comando/comprobación | Resultado |
| --- | --- |
| `npm ci --no-audit --no-fund` | correcto |
| `npm test` | exit 0; incluye 100 peticiones de salud compartiendo una operación y recuperación tras timeout |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0; 16 avisos de imágenes y cero errores |
| `npm run build` | exit 0 |
| `CMS_BLOCK2_TEST=true npm run test:block2` | exit 0 |
| `CMS_BLOCK3_TEST=true npm run test:block3` | exit 0 |
| `CMS_LAUNCH_TEST=true npm run test:launch` | exit 0 en Chrome; consentimiento, dos pestañas, Atrás, cookie mal formada, OG/JSON-LD, sitemaps y salud |
| `docker build -f infra/app.Dockerfile -t planta14-lanzamiento-review:local .` | correcto con npm ci dentro de Docker; runtime node UID 1000, sin .git/infra/.env |
| `shellcheck -x` de todos los scripts infra, incluidos monitor y PostgreSQL | exit 0 |
| `infra/test/common-test.sh` | exit 0 |
| `infra/test/monitor-test.sh` | exit 0: casos desactivado, disco/tarea fallida, contraseña con comillas/barra, modo 600, entorno curl y fallo SMTP |
| `node infra/test/staging-config-test.mjs` | 4 PASS: Compose, Caddy oficial, contraseña, cabeceras y /media |
| `infra/test/restore-test.sh` | **exit 1: 30 OK y un fallo de aislamiento por IP**; SQL, 45 objetos S3, cifrado, sumas, tar hostil y restauración desde copia externa correctos |
| `infra/test/postgres-roles-test.sh` | exit 0: base nueva/existente y app sin DDL |
| `infra/test/staging-e2e.sh` | exit 0: navegador detrás de Caddy, copia cifrada, borrado/restauración, siete páginas y filas iguales |

En `test:launch` se añaden noticias despublicadas y espacios municipales en borrador; no salen en sitemaps y la noticia despublicada devuelve 404. Un aviso retirado no aparece en el HTML ni en los metadatos del espacio municipal. Se comprueban URL absolutas, JSON-LD parseable y escapado dentro de HTML. Es validación local, no una certificación de Google News/Search Console.

La prueba de caché usa un service worker **solo dentro de un contexto aislado del test**, que precarga CacheStorage con un script sintético de analítica. Comprueba ejecución tras aceptar y ausencia de ejecución antes de aceptar o tras retirar, aunque la copia siga almacenada. La web no incorpora ese service worker. GA4 y su red se simulan: no se cargó código de Google ni se enviaron datos reales. Referencias de contraste: [AEPD, guía de cookies](https://www.aepd.es/guias/guia-cookies.pdf), [Google, configuración y caducidad de cookies](https://developers.google.com/analytics/devguides/collection/ga4/reference/config).

CI: se verificaron con `git ls-remote` en sus repositorios oficiales los cuatro SHA completos de checkout v7.0.1, setup-node v7.1.0, setup-buildx v4.4.1 y build-push v7.4.0. El flujo conserva `contents: read`, `persist-credentials: false`, sin referencias a secretos y `push: false`; no se modifica. No se ha supuesto que una ejecución remota nueva ya haya pasado.

Los ensayos infra se ejecutan en Linux con Docker Desktop local. Para roles, un adaptador **ignorado, exclusivo del ejecutor**, cambia la dirección de la base temporal de 127.0.0.1 a host.docker.internal para alcanzar los puertos dinámicos del host; no altera roles ni aserciones. Caddy se comprueba desde Windows. El staging destruye solo su entorno sintético; no es un despliegue externo.

Sin comprobar: revisión jurídica profesional, datos registrales, propiedad/configuración GA4 real, SMTP y entrega real, proveedores S3/IAM/MinIO/CDN, purga externa, HTTPS público, planes vigentes de monitores, programación nocturna instalada, todos los navegadores y una validación con una persona no técnica. Los manuales se revisaron por lectura y contraste con el código, sin probar acceso a un servidor contratado.
