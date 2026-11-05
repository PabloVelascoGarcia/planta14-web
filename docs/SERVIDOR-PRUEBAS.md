# Instalación de prueba en pruebas.planta14.com

## Versión instalada ahora

**`684c7870909483032c3a6706d919d4a7f2670593`** (`684c787`, rama `desarrollo/planta14-v2-participacion`). Desplegada el **5 de noviembre de 2026 a las 08:48** (hora de Madrid), **con el contenido de ensayo todavía cargado**. La versión anterior es `af0924b`, y `deploy.sh` la conserva para poder volver a ella.

## Cuentas de la redacción en /cms

| Nombre | Correo | Rol | Firma por defecto |
|---|---|---|---|
| Andrés | velascolne@gmail.com | `editor` | Redacción Planta 14 |
| Juanfran Santos | juansantospolalena@gmail.com | `editor` | Redacción Planta 14 |
| Pablo Velasco (redactor) | pvelasco@assa.as | `editor` | Redacción Planta 14 |

Las contraseñas no están en el repositorio ni en el servidor. Están en la carpeta `OneDrive - BLACKELEVEN CAPITAL S.L\EMPRESA\PROYECTOS\PLANTA14\Claves` de Pablo: `planta14-cuentas-periodistas.txt` (Andrés y Juanfran) y `planta14-cuenta-pablo-editor.txt`.

**Cuenta municipal de prueba** (creada el 4 de noviembre de 2026):

| Nombre | Correo | Rol | Espacio |
|---|---|---|---|
| Prueba Ayuntamiento Mieres | pvelasco81@gmail.com | `municipal` | Ayuntamiento de Mieres |

Contraseña en `planta14-cuenta-municipal-prueba.txt`, en la misma carpeta `Claves`. Comprobado desde el servidor, pidiendo a la app directamente (repetido con `af0924b`, con el mismo resultado):
- entra (login 200, rol `municipal`) y `/mieres/panel` abre el panel de edición;
- `/lena/panel` y `/aller/panel` dicen «Tu cuenta no gestiona este espacio municipal.»;
- `/cms` la manda a `/cms/unauthorized` y la API le niega las noticias de Planta 14 (403);
- por la API solo ve el espacio de Mieres y sus 10 contenidos, ninguno de otro concejo;
- editar o borrar un contenido de Lena, editar el espacio de Lena y publicar en Lena: 403 en los cuatro casos;
- «He olvidado mi contraseña»: `forgot-password` respondió 200 («Éxito») y **el correo llegó** a pvelasco81@gmail.com a las 20:55, remitente `Planta 14 <avisos@planta14.com>`, asunto «Restablecer tu Contraseña». El enlace lleva a `/cms/reset/…`, aunque la cuenta es municipal y no puede usar `/cms`. **Corregido en `af0924b`** (ver abajo).

Es una cuenta de prueba: bórrala antes de la salida.

**Autores (firmas):**
- **Redacción Planta 14** (`redaccion-planta-14`): lo creó la carga del ensayo, pero ya estaba marcado como lote **definitivo**, así que la retirada del ensayo no lo borra.
- **Juanfran Santos** (`juanfran-santos`, rol «Redacción»): creado el 4 de noviembre, sin lote y sin vincular a ninguna cuenta. Juanfran puede elegirlo a mano en el campo de autor de una noticia.

### Actualización a 684c787: participación, cartas, estadísticas y «Útil» (5 de noviembre de 2026)

Guía seguida: `docs/V2-PARTICIPACION.md` (commit `2422ffa` de la misma rama). Todo se hizo en una conexión SSH, más una segunda solo de lectura para ver el error de la importación de servicios. No se han tocado el DNS, los buckets ni los demás secretos. Solo se ha añadido `AEMET_API_KEY` al `.env.production`, pasada por la entrada estándar. No hizo falta ninguna contraseña ni sudo interactivo. **El ensayo no se ha retirado.**

| Paso | Resultado |
|---|---|
| Clave de AEMET | Añadida al `.env.production` (de 146 a 147 líneas; permisos `-rw-------` sin cambios). **No llega a la web**: ver «Fallos» |
| Estado previo (`status.sh`) | Correcto. Versión `af0924b`, `/api/health: ok` y mantenimiento desactivado |
| `git fetch` y `checkout --detach 684c787` | Correcto. `infra/test/out` estaba vacía |
| `deploy.sh … 684c787…` | **Código 0, «Desplegada».** Construcción de 10 minutos y copia previa `…20261105T074813Z.dump.age` (252K). **Las nueve migraciones están aplicadas**, de `20261104_195227_responsables` a `20261104_221803_util_ocultar`. El mantenimiento duró 17 segundos. Registro: `/srv/planta14/state/deploy-684c787.log` |
| `cms:responsables` | «RESPONSABLES CARGADOS». Las cuentas de Andrés y Juanfran ya existían y no se han tocado. Andrés lleva Aller, Mieres y Morcín, y Juanfran, Lena, Riosa y Ribera de Arriba |
| Comprobación de datos de servicios (`bcc03e0`, `--solo-comprobar`) | Lo esperado: 48 fichas de patrimonio, 34 rutas y 73 servicios municipales, con «No se importan: 40 farmacias» |
| Importación de patrimonio (`--publicar`) | **48 creadas y publicadas.** Las 33 fotos de Commons se descargaron, sin ningún fallo |
| Importación de rutas (`--publicar`) | **34 creadas y publicadas**, 15 de ellas con recorrido dibujado |
| Importación de servicios | **Falló (código 1)** después de crear 66 de los 73: ver «Fallos». No se ha repetido |
| Fiestas (`contenido-ensayo/fiestas-caudal.json`, `034b853`) | **`--solo-comprobar` falló (código 1)** con «El JSON debe ser una lista de fiestas». No se ha importado nada |
| Tarea nocturna de cartas | Añadida al crontab de `planta14` (todos los días a las 04:20), con el registro en `/var/log/planta14-cartas.log`. Ese archivo se creó con `sudo -n`. Lanzada a mano: «Cartas con DNI y teléfono borrados (más de 24 meses): 0», código 0 |
| Páginas | Responden 200: `/util`, `/lena`, `/mieres`, `/aller`, `/fiestas`, `/cartas`, `/cartas/enviar`, `/normas-cartas`, `/util/patrimonio`, `/util/rutas`, fichas y rutas con y sin foto o recorrido, y `/api/health` |
| Fuentes en vivo, según la app | DGT (Pajares): **responde**. BOE: **responde**. BDNS: **no responde a la app**: «HTTP 429 en www.infosubvenciones.es», aunque una consulta suelta con `curl` dio 200. AEMET: **sin datos**, porque la app no tiene la clave |

**Fallos (para Code nube; no se ha cambiado código):**
1. **AEMET:**
   - `infra/compose.production.yaml` no pasa `AEMET_API_KEY` a la app: no está en `x-app-env`. La clave está en el `.env.production`, pero dentro del contenedor la variable no existe, así que el bloque del tiempo no sale.
   - Hay que añadir `AEMET_API_KEY: ${AEMET_API_KEY:-}` y volver a desplegar.
   - `infra/compose.staging.yaml` tampoco la pasa.
2. **Servicios municipales:**
   - El registro `serv-ribera-ci-horreo` tiene un horario de 326 caracteres, y el campo «Horario» admite como mucho 200. Payload lo rechaza con «El siguiente campo es inválido: Horario».
   - La validación previa del importador no mira las longitudes, así que la importación se cortó a mitad: quedaron 66 servicios creados y faltan 7.
   - Hay que acortar ese horario en los datos o ampliar el campo, y validar las longitudes antes de crear nada. Después se repite la importación, que solo creará los que faltan.
3. **Fiestas:**
   - `contenido-ensayo/fiestas-caudal.json` es un catálogo documental: un objeto con `fiestas`, con 46 fichas. Usa `pueblo_o_parroquia`, `fechas_habituales` y `fechas_2025`, y en 35 fichas no hay fecha de 2025 localizada.
   - El importador espera la lista de `docs/ejemplos/fiestas.json`: `nombre`, `pueblo`, `concejo`, `inicio`, `fin`…
   - Hay que convertir el catálogo al formato del importador, decidiendo qué hacer con las fiestas sin fecha, o adaptar el importador.
4. **BDNS:** la app recibe un 429 de infosubvenciones.es. Puede ser por las varias peticiones seguidas (búsquedas y detalle de cada convocatoria). La app lo reintenta según su caché. Hay que vigilar si se mantiene.

**Pendiente de comprobar en el navegador:** el apartado 10 de `docs/V2-PARTICIPACION.md`:
- contraseña;
- cartas;
- sugerencias;
- estadísticas;
- «Útil»;
- ocultar servicios;
- responsables;
- boletín;
- última hora.

### Actualización a af0924b: recuperación de contraseña (4 de noviembre de 2026)

Guía seguida: `docs/V2-RECUPERACION-CONTRASENA.md` del mismo commit, con los pasos de siempre de `deploy.sh`. No se han tocado el DNS, los buckets, los secretos ni el `.env.production`. No hizo falta ninguna contraseña ni sudo interactivo. **El ensayo no se ha retirado.**

| Paso | Resultado |
|---|---|
| 1. Estado previo (`status.sh`) | Correcto. Versión `9c19b92`, `/api/health: ok` y mantenimiento desactivado |
| 2. `git fetch` y `checkout --detach` | `af0924b web: recuperación de contraseña con correo propio y página en el panel municipal`. `infra/test/out` estaba vacía |
| 3. `deploy.sh … af0924b…` | **Código 0.** Construcción de 7 minutos, «Copia previa: …20261104T202131Z.dump.age (248K)», «**Sin migraciones nuevas**», «/api/health: ok» y «Desplegada». El mantenimiento duró 15 segundos. Registro: `/srv/planta14/state/deploy-af0924b.log` |
| 4. Cuenta `editor` Pablo Velasco (redactor) | Creada, con la firma «Redacción Planta 14». La contraseña (20 caracteres, aleatoria) llegó por la entrada estándar y no quedó en ningún archivo ni registro del servidor |
| 5. Cuenta municipal de prueba | Ya existía, así que no se ha tocado |
| 6. Editor en `/cms` | Login 200, rol `editor`, `/cms` 200 con el panel de redacción («Nueva noticia», «Mis borradores» y «Publicadas hoy») |
| 7. Municipal | Entra en `/mieres/panel`. `/lena/panel` y `/aller/panel` le dicen que no gestiona ese espacio, y `/cms` la manda a `/cms/unauthorized`. Por la API solo ve Mieres; editar, borrar o publicar en Lena da 403 |
| 8. Recuperación desde el panel | `/mieres/panel` muestra «¿Has olvidado tu contraseña?», y `/mieres/panel/restablecer` da 200 con `noindex, nofollow`. La misma petición que hace el formulario (`forgot-password` con pvelasco81@gmail.com) respondió **200 «Éxito»**, sin errores en el registro de la app. Payload espera la respuesta del servidor de correo antes de contestar, así que el SMTP de IONOS lo aceptó |

**Pendiente (Pablo):** abrir el enlace del correo de las 21:47 desde el buzón y comprobar:
- el asunto «Planta 14: cambia tu contraseña» y el aspecto del correo;
- que el enlace es `…/mieres/panel/restablecer#token=…`;
- que con la contraseña nueva entra en el panel de Mieres;
- que el mismo enlace, abierto otra vez, ya no vale.

La contraseña nueva sustituirá a la del archivo `planta14-cuenta-municipal-prueba.txt`.

### Actualización a 9c19b92 y cuentas de redacción (4 de noviembre de 2026)

Guía seguida: `docs/V2-REVISION-PORTADA.md` del commit `d451b49` de la misma rama, que solo añade el documento. No se han tocado el DNS, los buckets, los secretos ni el `.env.production`. No hizo falta ninguna contraseña ni sudo interactivo. **El ensayo no se ha retirado.**

| Paso | Resultado |
|---|---|
| 1. Estado previo (`status.sh`) | Correcto. Versión `c740cea`, `/api/health: ok`, mantenimiento desactivado y sin restauración pendiente |
| 2. `git fetch` y `checkout --detach` | `9c19b92 web: los avisos conservan su foto (solo la lista de ayudas va sin ella)…`. `infra/test/out` estaba vacía |
| 3. `deploy.sh … 9c19b92…` | **Código 0.** «Modo mantenimiento ACTIVADO», «Copia previa: …20261104T183741Z.dump.age (244K)», «**Sin migraciones nuevas**», «/api/health: ok», «Modo mantenimiento DESACTIVADO» y «Desplegada». El mantenimiento duró 15 segundos. Registro: `/srv/planta14/state/deploy-9c19b92.log` |
| 4. Cuentas `editor` | Creadas con la API local de Payload en el contenedor de migraciones; las contraseñas (20 caracteres, aleatorias) llegaron por la entrada estándar y no quedaron en ningún archivo ni registro del servidor |
| 5. Inicio de sesión | Las dos cuentas: `/api/cms/users/login` 200, rol `editor`, y `/cms` 200 con el panel de inicio de redacción («Nueva noticia», «Mis borradores» y «Publicadas hoy»). Comprobado desde el servidor, pidiendo a la app directamente |
| 6. `ensayo.sh retirar --solo-comprobar` | Código 0, sin cambios. Se borraría: 34 articles, 20 municipal-content, 17 media y **2 authors («Firma invitada» y «Pablo Velasco»)**; Lena y Mieres volverían a inactivos. **«Redacción Planta 14» no aparece.** Registro: `/srv/planta14/state/ensayo-retirar-comprobar.log` |

**Ojo antes de retirar el ensayo:** el autor **«Pablo Velasco»** está marcado como lote ensayo y se borraría. Si debe quedarse, márcalo como «Definitivo» en el CMS antes de la retirada.

**Pendiente de comprobar en el navegador** (hace falta la contraseña común): la lista del paso 4 de `docs/V2-REVISION-PORTADA.md` (portada, noticia, `/mieres` en el móvil y la 404).

### Correo de planta14.com (consulta DNS, 4 de noviembre de 2026)

Solo consulta, sin cambios: SPF `v=spf1 include:_spf-eu.ionos.com ~all`; DKIM `s1-ionos._domainkey` y `s2-ionos._domainkey` (CNAME a `s1/s2.dkim.ionos.com`, con clave publicada); DMARC `_dmarc` (CNAME a `dmarc.ionos.es`: `v=DMARC1; p=none;`).

### Actualización a c740cea y carga del ensayo (3 de noviembre de 2026)

**`c740ceaca0160151bfb9c244472759a4709e482c`** (`c740cea`, rama `desarrollo/planta14-ensayo-carga`). Desplegada el **3 de noviembre de 2026 a las 20:58** (hora de Madrid), **con el contenido de ensayo cargado**.

Guía seguida: `docs/V2-ENSAYO-CARGA.md` del commit `9d117a1` de la misma rama, que solo añade el documento. No se han tocado el DNS, los buckets, los secretos ni el `.env.production`. No hizo falta ninguna contraseña ni sudo. **El ensayo no se ha retirado.**

| Paso | Resultado |
|---|---|
| 1. Estado previo (`status.sh`) | Correcto. Versión `8623791`, `/api/health: ok`, mantenimiento desactivado y sin restauración pendiente |
| 2. `git fetch` y `checkout --detach` | `c740cea cms: tipos de Payload regenerados (ayudas de Imágenes) [skip netlify]`. `infra/test/out` estaba vacía |
| 3. `deploy.sh … c740cea…` | **Código 0.** Salieron, en este orden: «Modo mantenimiento ACTIVADO», «Copia previa: …20261103T195757Z.dump.age (160K)», «**Migraciones aplicadas: 20261103_081533_lote_ensayo 20261103_121545_formulario_noticias**», «/api/health: ok», «Modo mantenimiento DESACTIVADO» y «Desplegada». El mantenimiento duró 16 segundos. Registro: `/srv/planta14/state/deploy-c740cea.log` |
| 4. `cms:structure` y acceso a Commons | «Estructura cargada. Creados: 0 secciones, 0 concejos, 0 espacios… Ya existían: 10, 6 y 6». No duplicó nada. El `curl` a `upload.wikimedia.org` dio `HTTP/2 200` |
| 5a. `ensayo.sh cargar --solo-comprobar` | Código 0 y «COMPROBACIÓN TERMINADA (sin cambios)». Anunciaba 19 imágenes, 3 autores, 36 articles y 20 municipal-content; la activación de Mieres y Lena; y los 3 avisos de piezas sin foto (`p14-noticia-20`, `p14-noticia-24`, `p14-agenda-06`). Registro: `/srv/planta14/state/ensayo-comprobar.log` |
| 5b. `ensayo.sh cargar` | Código 0 y **«CARGA TERMINADA»**, en unos 2 minutos. Creados: **19 imágenes, 3 autores, 36 noticias y 20 contenidos municipales (56 piezas)**. Mieres y Lena pasaron a activos, con los mismos 3 avisos. Registro: `/srv/planta14/state/ensayo-cargar.log` |
| Memoria del contenedor de migraciones | **Pico de 277 MiB de 768** con `docker stats` (36 muestras). El pico del núcleo según el cgroup, que incluye la caché de archivos, fue de **354 MiB**. En el ensayo local fueron 304 y 318 MiB. Muestras: `/srv/planta14/state/ensayo-memoria.log` |
| 6. Comprobaciones | Correctas (detalle abajo) |

**Comprobaciones del paso 6.** Se hicieron desde el servidor, pidiendo las páginas directamente a la app, porque no tengo la contraseña común.
- **En la base:**
  - 36 noticias, todas publicadas, y 20 contenidos municipales;
  - 19 imágenes, todas `-2560.jpg` y con «reducida de tamaño» en el crédito;
  - los cuerpos están guardados como texto enriquecido (Lexical).
- **Portada:** 200, con 11 enlaces a noticias y la agenda «Para salir».
- **`/mieres` y `/lena`:** 200, con sus avisos, eventos, ayudas y tablón. Se comprobaron cuatro títulos en cada uno.
- **`/agenda`:** 200, con las actividades próximas.
- **`/noticia/darle-al-hierro` y `/noticia/bustiello-la-vida-alrededor-de-la-mina`:** 200, con el crédito «… (reducida de tamaño)» y Wikimedia Commons. La foto se sirve desde la copia pública del bucket: 200, `image/jpeg`, 658 KB y 1,1 MB.
- **Buscador:** `/buscar?q=Bustiello` encuentra el reportaje.
- **A través de Caddy, sin contraseña:** la portada da 401 y `/api/health` da 200.

**Un dato que no viene de esta instalación.** El espacio de **Aller** ya estaba activo antes de la carga: lo activó alguien desde el CMS el 3 de noviembre a las 09:34 y volvió a guardarlo a las 13:00. Ahora están activos Aller, Lena y Mieres; Morcín, Ribera de Arriba y Riosa siguen inactivos.

**Pendiente de hacer en el navegador** (hace falta la contraseña común y el administrador):
- ver la portada, `/mieres`, `/lena` y `/agenda`;
- en **Usuarios**, poner la **Firma (autor vinculado)** de cada periodista;
- en **Noticias → Crear**, revisar las seis pestañas, el editor, el botón **Crear** de la foto y el calendario de publicación programada;
- abrir una noticia del ensayo: el texto debe verse en el editor y el **Lote**, en la barra lateral.

### Actualización a 8623791 (3 de noviembre de 2026)

Guía seguida: `docs/V2-AJUSTES-PREPRODUCCION.md`, pasos 1 a 6. Esa guía está en el commit `577cdd6` de la misma rama, que solo añade el documento. No se han tocado el DNS, los buckets, los secretos ni el `.env.production`. No hizo falta ninguna contraseña ni sudo.

| Paso | Resultado |
|---|---|
| 1. Estado previo (`status.sh`) | Correcto. Versión `c29e024`, `/api/health: ok`, mantenimiento desactivado y sin restauración asistida pendiente. Las copias de las 03:15 y las 03:30 se hicieron solas |
| 2. `git fetch` y `checkout --detach` | `8623791 docs: identidad visual de los concejos y CMS para la redacción en el manual [skip netlify]` |
| 3. Restos en `infra/test/out` | No había ninguno: la carpeta estaba vacía y no hizo falta `sudo rm` |
| 4. `deploy.sh … 862379192f53…` | **Código 0.** Salieron, en este orden: «Modo mantenimiento ACTIVADO», «Copia previa: …20261103T082024Z.dump.age (140K)», «**Migraciones aplicadas: 20261103_000335_identidad_espacios 20261103_001210_creado_por**», «/api/health: ok», «Modo mantenimiento DESACTIVADO» y «Desplegada». El mantenimiento duró unos 17 segundos. Registro: `/srv/planta14/state/deploy-8623791.log` |
| 5. Comprobaciones | Correctas (detalle abajo) |
| 6. `restore-test.sh` con `planta14-app:862379192f53` | **SUPERADA**, **código 0**, 33 OK, «Sin volúmenes nuevos» y 0 restos en `infra/test/out`. El arreglo del punto 7 funciona. Registro: `/srv/planta14/state/restore-test-8623791.log` |

**Comprobaciones del paso 5.** Se hicieron desde el servidor, pidiendo las páginas directamente a la app, porque ya no tengo la contraseña común: el archivo de secretos se borró al terminar la instalación.
- **Portada:** 200. No aparecen «Edición de demostración», «Demo municipal», «fines de demostración», «Probar el panel» ni «Ejemplo».
- **Páginas de la demo:** `/edicion` y `/niebla` dan 404. `/admin` redirige a `/admin/login`, que da 404.
- **Los seis concejos** (`/aller`, `/lena`, `/mieres`, `/morcin`, `/ribera-de-arriba` y `/riosa`): 200, cada uno con su lema propio y sus créditos de Wikimedia. Ninguno muestra el marcador «Escudo municipal».
- **En la base:** los 6 espacios tienen la identidad rellena (lema, colores, escudo y foto), también en su última versión, la que abre el CMS. Hay 18 historias destacadas y existe la columna nueva «Creada por» (`created_by_id`).
- **CMS:** `/cms/login` responde 200 en español (`lang="es"`, «Iniciar sesión»).
- **Vista previa:** `/vista-previa/noticia/1` sin sesión da 404, con `X-Robots-Tag: noindex, nofollow`.
- **A través de Caddy, sin contraseña:** la portada y `/cms` dan 401. `/api/health` da 200, con la base y el almacenamiento `ok`.

**Pendiente de comprobar en un navegador** (hace falta la contraseña común y el administrador):
- el aspecto del CMS en español;
- el panel de inicio con «Nueva noticia», «Mis borradores» y «Publicadas hoy»;
- la pestaña Identidad visual de cada espacio;
- una noticia `[PRUEBA]`: Guardar borrador → Previsualizar, y comprobar que cambia al escribir;
- que los concejos se ven igual que antes.

También queda cambiar la primera historia destacada de Aller, que enlaza a una noticia de la demo que da 404 (`docs/V2-AJUSTES-PREPRODUCCION.md`, «Para revisar en el CMS»).

---

## Instalación inicial (2 de noviembre de 2026)

Fecha: **2 de noviembre de 2026**. Servidor IONOS 87.106.30.18, usuario `planta14`. Commit instalado entonces: **`c29e02446361eeb5c3a7acaaab5d1bedbb4abf6e`** (`c29e024`, rama `desarrollo/planta14-v2-instalacion`). Guía seguida: `docs/PUESTA-EN-MARCHA-IONOS.md`, apartados 4 a 6.

Este documento se fue escribiendo durante la instalación. Ningún secreto aparece aquí.

**Resultado: la web de prueba está instalada y funcionando en https://pruebas.planta14.com, con contraseña común, sin indexar y con copias cifradas programadas y comprobadas.**

## Avance

| Fase | Estado |
| --- | --- |
| 0. Comprobaciones previas (rama, SSH, DNS) | Hecha. `pruebas.planta14.com` resuelve a 87.106.30.18 (TTL 3600) |
| 1. Código en el commit validado, `chown` a `planta14`, setup (0 cambios) y check-server | Hecha. «Terminado: 0 cambios» y «RESULTADO: servidor preparado» |
| 2. Clave age | Hecha. Privada en el PC de Pablo (`C:\Users\pvela\planta14-age-privada.txt`, solo su usuario). Pública: `age15hrjslx2828ccskleft7n9tspuvmcjwt830f9quzh9467wj2ayrq6w7kcx` |
| 3. `infra/.env.production` | Hecha. `generate-production-env.sh --pruebas`, secretos entre comillas simples, `SMTP_ENABLED=true`, `ALERT_EMAIL_ENABLED=true`, hash de preproducción de `caddy hash-password` (contraseña por la entrada estándar). Huellas SHA-256: el cargador de los scripts y Compose (app y caddy) reciben exactamente los valores del archivo de secretos |
| 4. Buckets | Hecha. Regiones comprobadas (originales e imágenes `eu-central-3`, copias `eu-central-4`); copias con versionado y bloqueo COMPLIANCE de 30 días por defecto. Los tres estaban vacíos y sin política |
| 5. Política pública de `planta14-imagenes-b11` | Hecha, solo `s3:GetObject` sobre `public/*` (aplicada con `aws s3api put-bucket-policy` desde el contenedor `amazon/aws-cli`). Sin clave: objeto de prueba en `public/` 200; listar 403; fuera de `public/` 403; original 403 (dos formatos de URL); listar originales 403. Objetos de prueba borrados |
| 6. rclone → bucket con bloqueo | Hecha. Subida y verificación con `rclone copy --immutable` (rclone 1.71.2) aceptadas. El objeto `planta14/pruebas/_prueba-rclone/prueba-rclone-20261102T195624Z.txt` muestra `ObjectLockMode: COMPLIANCE` hasta el 2026-12-02. No se puede borrar: queda ahí 30 días (61 bytes) |
| 7. Despliegue (`deploy.sh … c29e024`) | Hecha: «Desplegada c29e0244…». Construcción 20:57–21:06 (hora de Madrid), 6 migraciones, `/api/health: ok`, certificado Let's Encrypt (emisor YE1, hasta el 31-01-2027). En los contenedores en marcha, `app` y `caddy` reciben exactamente los valores del archivo de secretos (huellas SHA-256 iguales). Primer intento parado al inicio sin cambiar nada: `/srv/planta14/mantenimiento` era de root porque lo creó Docker al montar la carpeta en una comprobación del hash (`docker compose run caddy`) hecha antes del despliegue. Se pasó a `planta14` y se relanzó |
| 8. Primer administrador (`cms:bootstrap`) | Hecha, con el correo de `ADMIN_EMAIL`. **La contraseña de `ADMIN_PASSWORD` no valía**: tiene 15 caracteres y `cms:bootstrap` exige 16 o más. Se generó otra de 24 caracteres, guardada en `C:\Users\pvela\planta14-admin-cms.txt` (solo tu usuario). Entrada comprobada: `/api/cms/users/login` 200 con rol `admin` y sesión válida en `/api/cms/users/me` |
| 9. Estructura (`cms:structure`) | Hecha: «Creados: 10 secciones, 6 concejos, 6 espacios municipales (inactivos). Sin contenido de demostración». No se usó el importador de demostración |
| 10. Contraseña de preproducción | Hecha. Sin contraseña o con otra: 401 en portada, `/cms` y `robots.txt` (desde el PC y desde el servidor). Con la común: 200 y la portada de Planta 14. `/api/health` abierto. `X-Robots-Tag: noindex, nofollow` y `robots.txt` con `Disallow: /` |
| 11. Alerta de prueba | Enviada por SMTP (smtp.ionos.es:465) a `ALERT_EMAIL_TO` sin error de curl a las 21:10. Falta confirmar que ha llegado al buzón |
| 12. Imagen real subida desde el CMS | Hecha. Subida por la API del CMS con el administrador (201): el original está en `planta14-originales-b11` y **sin clave da 403**; tampoco se sirve por la web sin sesión (403). No se publicó (no hay noticia), así que no hubo copia pública. Imagen de prueba borrada (200) |
| 13. Modo mantenimiento | Hecha. Activado: guardar en el CMS da 503 con el mensaje «Planta 14 se está actualizando…» y la portada sigue (200). Desactivado: guardar vuelve a funcionar (200) |
| 14. Copias a mano | Hechas las tres sin error: PostgreSQL (140 KB, cifrada con age), almacenamiento (cifrado) y copia externa «verificada en p14off:planta14-copias-b11/planta14/pruebas». La copia de PostgreSQL en Fráncfort tiene `ObjectLockMode: COMPLIANCE` hasta el 2026-12-02 |
| 15. `restore-test.sh` completo con la imagen de la web | **SUPERADA**, 33 comprobaciones OK, incluidas las tres que fallaron al preparar el servidor («hay tablas y filas que comparar», «la app lee los datos», «la app no borra tablas»). **Sin volúmenes nuevos.** El script terminó con código 1 solo porque no pudo borrar sus archivos sintéticos de `infra/test/out/` (creados como root por un contenedor); se borraron con sudo. Ver «Fallos encontrados» |
| 16. Simulacro `restaurar.sh --solo-comprobar` | **SIMULACRO CORRECTO.** Clave privada pasada desde el PC por la entrada estándar (solo la línea `AGE-SECRET-KEY-1…`, sin mostrarla): «Clave correcta» y descifra la última copia de PostgreSQL |
| 17. Programación (`schedule.sh`) | Hecha. `/etc/cron.d/planta14`: PostgreSQL 03:15, almacenamiento 03:30, copia externa 03:45 (hora de Madrid), disco cada hora y memoria cada minuto; rotación de registros |
| 18. Comprobación final | Hecha (21:57). Ver «Lo que salió bien» |
| 19. Limpieza | Hecha. En el servidor, el archivo de secretos y la contraseña del administrador borrados con `shred`, y la carpeta de trabajo eliminada. En el PC, `planta14-secretos.env` sobrescrito y borrado. La clave age se conserva. Registros de la instalación (sin secretos) en `/srv/planta14/state/` (`deploy.log`, `resto.log`, `restore-test.log`) |

## Resumen en lenguaje llano

La web de prueba de Planta 14 ya funciona en **https://pruebas.planta14.com**. Al entrar, el navegador pide un usuario y una contraseña comunes: el usuario es `planta14` y la contraseña, la de preproducción. Con ellos se ve la portada. Después, en `/cms`, cada persona entra con su propia cuenta. Google no la indexa. Hay un administrador creado y la estructura del periódico cargada (10 secciones, 6 concejos y sus 6 espacios municipales, apagados), **sin contenido de demostración**. Las copias de seguridad se hacen solas cada noche, cifradas, y se guardan también en Fráncfort, donde nadie puede borrarlas durante 30 días. Se ha comprobado que se pueden restaurar y que tu clave las abre.

### Lo que salió bien

- Instalado **exactamente** el commit `c29e02446361eeb5c3a7acaaab5d1bedbb4abf6e`. El servidor sigue «preparado» (0 cambios al repetir la preparación).
- `pruebas.planta14.com` ya resolvía a 87.106.30.18. No se ha tocado ningún registro DNS ni el correo.
- Certificado HTTPS real de Let's Encrypt, válido hasta el 31 de enero de 2027 (se renueva solo).
- **Contraseña común:** sin ella, o con una incorrecta, la portada, `/cms` y `robots.txt` dan 401. Con ella se ven (200). `/api/health` queda abierto para el monitor: `"status":"ok"`.
- **Administrador:** entra en `/cms` y su sesión funciona con rol `admin`.
- **Sin indexar:** `noindex, nofollow` en todas las respuestas y `robots.txt` con `Disallow: /`.
- **Secretos en `.env.production`:** escritos entre comillas simples, con permisos 600. Comparando las huellas SHA-256, sin ver los valores, los contenedores de la web y de Caddy y los scripts de copias reciben exactamente lo que había en el archivo de secretos.
- **Buckets:** regiones correctas. El de copias tiene bloqueo COMPLIANCE de 30 días. El de imágenes solo deja leer `public/*`: no se puede listar y fuera de `public/` da 403. Los originales no son accesibles sin clave: dan 403, también con una imagen real subida desde el CMS.
- **rclone** sube al bucket con bloqueo, y cada copia queda bloqueada 30 días.
- Copias de PostgreSQL, almacenamiento y externa, a mano y programadas.
- **Prueba de restauración completa SUPERADA**, sin dejar volúmenes.
- **Simulacro con tu clave age: CORRECTO.**
- Modo mantenimiento probado: impide guardar y la portada sigue funcionando.
- Alerta de prueba enviada sin error a `ALERT_EMAIL_TO`.
- No se ha activado nada de pago ni se han tocado `main`, `mejora/presentacion-la-voz` ni otras ramas.

### Fallos encontrados y cómo se resolvieron

1. **La contraseña de administrador del archivo de secretos tenía 15 caracteres** y `cms:bootstrap` exige 16 o más. No se ha cambiado esa regla. Se creó el administrador con el correo indicado y una contraseña nueva de 24 caracteres, guardada en `C:\Users\pvela\planta14-admin-cms.txt`.
2. **Primer despliegue parado al empezar**, sin cambiar nada. Una comprobación previa (lanzar el contenedor de Caddy para verificar el hash) hizo que Docker creara `/srv/planta14/mantenimiento` como root. Se pasó a `planta14` y el segundo intento salió bien. Error del procedimiento, no del código.
3. **`restore-test.sh` termina con código 1 aunque la prueba sale SUPERADA.** Al final no puede borrar `infra/test/out/…/s3data`, porque esos archivos los crea como root el contenedor del S3 de prueba. Se borraron con sudo. Es un fallo menor del script, que conviene corregir en el repositorio: la limpieza debería hacerse con un contenedor o con sudo.
4. **SSH bloqueado unos segundos dos veces.** La regla `ufw limit` del puerto 22 corta a quien abre más de 6 conexiones en 30 segundos. Ocurrió por abrir muchas seguidas. No fue fail2ban y no hubo que cambiar nada: se espaciaron las conexiones.
5. Comprobación de la sesión del administrador con `curl`: Payload ignora la cookie si la petición no lleva la cabecera `Origin` del dominio, por su protección CSRF. Es lo correcto: el navegador sí la envía. Con ella, sesión `admin`.

### Pendiente

- **Confirmar que llegó la alerta de prueba** («[Planta 14] Alerta de prueba de la instalación», enviada a las 21:10) al buzón de `ALERT_EMAIL_TO`. El servidor de correo la aceptó, pero no se ha podido ver el buzón.
- **No probado todavía:** publicar y retirar una noticia `[PRUEBA]` con imagen, para ver la copia pública aparecer y desaparecer; la recuperación de contraseña por correo; y el navegador real con la contraseña común. Son pruebas de la lista del apartado 6 de la guía, para hacer con un periodista.
- Un objeto de prueba de 61 bytes, `planta14/pruebas/_prueba-rclone/…`, queda bloqueado en el bucket de copias hasta el 2 de diciembre. Después se puede borrar o dejar caducar.
- Corregir la limpieza de `restore-test.sh` (punto 3 de los fallos).
- Siguen pendientes las decisiones de `docs/V2-INSTALACION.md`: retención de las copias externas (regla de ciclo de vida), la clave única, fecha del día de la salida y lista de periodistas.

### Lo que tienes que hacer tú

1. **Guardar en el gestor de contraseñas** y luego borrar del PC:
   - `C:\Users\pvela\planta14-age-privada.txt`: la clave privada de las copias. Imprímela y guárdala con los documentos importantes. Después borra el archivo; la guía recomienda que no viva en un archivo de texto.
   - `C:\Users\pvela\planta14-admin-cms.txt`: la contraseña del administrador de `/cms`. Si prefieres otra, cámbiala en `/cms` → tu usuario, con 16 caracteres como mínimo.
   - `C:\Users\pvela\planta14-age-publica.txt` solo tiene la clave pública. No es secreta y se puede borrar.
2. **Mirar el buzón de alertas** y confirmar que llegó la alerta de prueba (revisa también el correo no deseado).
3. **Entrar tú en https://pruebas.planta14.com** con el usuario `planta14` y la contraseña de preproducción, y después en `/cms` con el administrador.
4. **Dar de alta el monitor externo** (UptimeRobot) sobre `https://pruebas.planta14.com/api/health` (`docs/MANUAL-OPERACION.md`, apartado 1).
5. ~~Crear las cuentas `editor` de los periodistas~~ (hecho el 4 de noviembre: Andrés y Juanfran Santos). Falta darles su contraseña y la común, y explicarles la regla `[PRUEBA]`.
6. Mañana, comprobar que las copias de las 03:15, 03:30 y 03:45 salieron bien: `bash infra/deploy/status.sh --env-file infra/.env.production` en el servidor, o `/var/log/planta14/tareas.log`.
7. Decidir la retención de las copias en Fráncfort y, si quieres limitarla, crear la regla de ciclo de vida en el panel. Mientras no se decida, crecen.
