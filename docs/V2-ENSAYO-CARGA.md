# Planta 14 v2: carga del ensayo y formulario de noticia

Rama **`desarrollo/planta14-ensayo-carga`**: parte de `desarrollo/planta14-v2-ajustes-preproduccion` (`8623791`) y lleva `contenido-ensayo/` de `desarrollo/planta14-contenido-ensayo` en su versión **`1c11ab7`**. No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

Este es el único documento para instalar: qué cambia, cómo se ha probado y los pasos para Code local.

## Commit que se debe instalar

**`c740ceaca0160151bfb9c244472759a4709e482c`** (`c740cea`)

El commit posterior, que añade este documento, solo cambia documentación.

## Qué cambia

| Commit | Qué |
|---|---|
| `320d25a` … `26a9276` | Cargador y retirada del ensayo (`cms:ensayo:cargar` / `cms:ensayo:retirar`, `infra/deploy/ensayo.sh`), migración `20261103_081533_lote_ensayo`, agenda general y guía `docs/ENSAYO-CONTENIDO.md`. Ya documentado en la entrega anterior. |
| `30d9397` | `contenido-ensayo/` actualizado a **`1c11ab7`**: noticias, opiniones y municipales reescritos. Siguen 56 piezas, 19 fotos y las mismas 3 piezas sin foto, con los mismos ids, `legacyID` y slugs. |
| `75c8fdc` | **Fotos reducidas a 2560 px** en el lado largo (JPEG calidad 85) antes de subirlas. |
| `5def50b` | **Formulario de noticia para la redacción** y su migración `20261103_121545_formulario_noticias`. |
| `a2178d9` | Memoria contenida al cargar las fotos (ver «Memoria»). |
| `822013c` | La prueba de producción mide la memoria también desde el cgroup del contenedor. |
| `c740cea` | Tipos de Payload regenerados (solo comentarios de ayuda). |

### 1. Contenido `1c11ab7`

La carga funciona con él sin cambios en el cargador: `test:ensayo` y la sección 3d del ensayo de producción usan los archivos reales.

### 2. Fotos reducidas

- Se descarga el original de Commons y se comprueba su resolución, como antes.
- Después se reduce con sharp: lado largo de 2560 px como máximo, sin ampliar, con la orientación aplicada y sin metadatos, en JPEG de calidad 85. La mayor (8104 × 4559, unos 25 MiB) queda en 2560 × 1440, unos 620 KB.
- **Se conservan** autor, licencia y enlace: «Autoría o crédito» lleva «Autor / Wikimedia Commons / licencia (reducida de tamaño)», y «Dirección de origen», la ficha de Commons. La declaración de derechos de la administración añade: «Único cambio: reducida a 2560 px en el lado largo».
- El nombre del archivo subido termina en `-2560.jpg`.

### 3. Formulario de noticia

| Pedido | Cómo queda |
|---|---|
| Texto | Editor de texto enriquecido (Lexical de Payload) con párrafos, negrita, cursiva, enlaces, ladillos (H2/H3), citas y listas, y nada más. La web lo pinta con un componente propio: los párrafos simples dan el mismo HTML que antes, y los enlaces solo se admiten con `http(s)`, `mailto` o una ruta del sitio. |
| Buscador, sitemaps, lectura | Siguen trabajando con el texto plano de cada bloque, que se extrae del texto enriquecido. |
| Vista previa | La misma que la web, con el formato. |
| Cargador del ensayo | Guarda los cuerpos como texto enriquecido. La API también acepta una lista de párrafos, que se convierte sola, así que los clientes antiguos siguen funcionando. |
| Identificador de origen | Solo lo ve la administración, en solo lectura. Lo mismo la procedencia. |
| Slug | Se crea solo al guardar, a partir del título, sin tildes ni eñes. Si ya existe, añade -2, -3… Se puede editar. |
| Fechas | Selector de día y hora (calendario y lista de horas cada 5 minutos), en hora de Madrid. **Fecha de publicación:** si se deja vacía, toma la hora a la que se publica; no puede ser futura. **Publicación programada:** la noticia queda publicada pero oculta hasta esa hora, y entonces sale sola con esa fecha. El campo `date` interno ya no se ve: se calcula. |
| Foto | Botón **Crear** (o arrastrar) en la propia noticia. La ventana pide descripción, autoría, titular y tipo de derechos, y la casilla de declaración: al marcarla, la foto pasa a publicable y queda registrado quién y cuándo. Los campos técnicos y el ámbito no aparecen al crear. |
| Buscadores y redes | Opcionales: si están vacíos, se usan título, entradilla y foto. |
| Fuente | Bloque plegado y opcional: «Solo si la noticia procede de otro medio o de una nota de prensa». |
| Pestañas | Contenido, Clasificación, Portada (con la explicación de cada casilla), Publicación, Buscadores y Fuente. |
| Ayuda | Una frase en español bajo cada campo. |
| Autor | Nuevo campo **Firma (autor vinculado)** en Usuarios, que solo cambia la administración. Si está puesto, la noticia lo trae por defecto. |

Se oculta además el enlace «API» de la noticia, que no sirve a la redacción. El manual de operación, en su apartado 12, explica el formulario.

**Fecha de publicación, un cambio de criterio.** Primero venía rellena con la hora a la que se abría el formulario. Al probarlo se vio el problema: un borrador publicado al día siguiente saldría con la fecha de la víspera. Ahora, vacía significa «la hora a la que se publique».

**Migración `20261103_121545_formulario_noticias`:**
- **Cuerpos:** pasan de lista de párrafos a texto enriquecido, un párrafo por elemento, sin pérdida de texto (se quitan los espacios sobrantes y los párrafos vacíos). Se convierten también las versiones guardadas.
- **Fechas:** `publishedAt`, `scheduledAt` y la fecha de la agenda pasan de texto a fecha y hora:
  - `AAAA-MM-DD` → a las 09:00 de Madrid;
  - `AAAA-MM-DDTHH:MM` → esa hora de Madrid;
  - ISO con zona → sin cambios;
  - vacío o ilegible → vacío.

  Una noticia sin `publishedAt` lo toma de su día. Si estaba programada, su fecha de publicación pasa a ser la programada. El día interno se recalcula.
- **Usuarios:** columna de firma vinculada.
- **`down`:** devuelve fechas y cuerpos al formato anterior; del texto enriquecido conserva el texto, pero pierde el formato.

**React 19.0.0 → 19.0.9** (y `react-dom`): `@payloadcms/richtext-lexical` 3.92.1 exige React 19.0.1 o superior. Está en `package.json` y en `package-lock.json`; la imagen se construye con ellos. No hay variables nuevas en el `.env`.

## Memoria del contenedor de migraciones

| Medida | Resultado |
|---|---|
| Reducir solo la foto de 8104 × 4559 (JPEG de 25 MiB con ruido, como una foto real), proceso completo de Node y sharp (`test:ensayo`) | pico **163 MiB** |
| Primera batería: carga completa en el contenedor de migraciones de producción (`docker stats`) | **671 MiB de 768**. **Falló** la comprobación de holgura (< 512 MiB) |
| Tras la corrección `a2178d9`, en la batería final: `docker stats` | **304 MiB de 768** |
| Ídem, desde el cgroup: memoria anónima máxima | **303 MiB** |
| Ídem, desde el cgroup: pico exacto del núcleo, con caché de archivos | **318 MiB de 768** |

**Causa.** En local, con Payload arrancado, cada foto reducida añadía entre 25 y 45 MiB al proceso, aunque el heap de JavaScript no cambiaba. Era la caché de libvips y las arenas de glibc con varios hilos, un problema conocido de sharp.

**Corrección:**
- durante la carga, sin caché de libvips y con un solo hilo (también en los tamaños que genera Payload);
- `MALLOC_ARENA_MAX=2` para el proceso de Payload;
- `ensayo.sh` llama al lanzador sin `npm`, que era un proceso de más.

En local, 6 reducciones más los tamaños de Payload pasaron de un pico de 378–393 MiB a 289 MiB. La web no cambia: solo afecta al proceso de la carga.

## Resultados

Batería completa ejecutada **una vez hasta el final**, el 3 de noviembre de 2026, sobre `822013c`, en Linux (Docker Engine nativo, cgroup v1). Una primera pasada se detuvo tras el ensayo de producción por el fallo de memoria; se corrigió y se repitió la batería entera. `c740cea` solo añade los tipos regenerados (comentarios y un campo opcional), y `npm run typecheck` pasa sobre él.

| Comando | Resultado |
|---|---|
| `infra/test/production-deploy-test.sh` | **SUPERADO, 125 comprobaciones**, incluida la carga del ensayo con las medidas de memoria. 0 volúmenes nuevos. Las dos líneas «FALLO: /api/health» son las de los escenarios de vuelta atrás que provoca la propia prueba, como en baterías anteriores |
| `npm test` | 9 PASS |
| `npm run typecheck` | Sin errores |
| `npm run lint` | 0 errores, 16 avisos (los de siempre) |
| `npm run build` | Correcto |
| `npm run test:block2` | 8 PASS. La comparación demo/payload se hace con fecha ISO |
| `npm run test:block3` | 17 PASS |
| `npm run test:launch` | 6 PASS |
| `npm run test:instalacion` | **16 PASS** (3 nuevas, abajo) |
| `npm run test:ensayo` | 8 PASS, con el contenido `1c11ab7`, las fotos reducidas y la medida de memoria |
| **`npm run test:formulario`** (nueva) | **3 PASS** en Chromium real (abajo) |
| `shellcheck -x` de todo `infra/` | Sin avisos |
| `caddy validate` (acme e internal) | Válido |
| `common-test`, `staging-config-test`, `monitor-test`, `memory-test`, `staging-guard-test` | Correctos |
| `restore-test.sh` (root, con imagen y sin privilegios) | SUPERADA las tres, código 0, sin restos ni volúmenes |
| `offsite-immutable-test.sh`, `pruebas-config-test.sh`, `preproduccion-test.sh`, `postgres-roles-test.sh` | SUPERADAS |
| `staging-e2e.sh` | SUPERADO |

**`test:formulario`, en navegador real (Playwright y Chromium).** Una cuenta de redacción con firma vinculada lo hace todo solo con clics y teclado:
1. **Crear:**
   - entra, pulsa **Nueva noticia** y ve las seis pestañas, sin campos técnicos;
   - escribe título y entradilla, y en el texto una negrita (Ctrl+B), un ladillo, una cita y una lista con el desplegable de la barra;
   - sube una foto de 4000 × 3000 con **Crear** en la propia noticia: descripción, autoría, titular, «Propia» y la casilla de declaración. La foto queda publicable, con la declaración a su nombre;
   - la firma ya viene puesta; elige concejo y sección; la pestaña Portada explica sus casillas;
   - con **Guardar borrador**, la dirección se crea sola (`el-pleno-de-mieres-aprueba-el-presupuesto-de-2027`), y la web da 404.
2. **Previsualizar:** el botón **Vista previa** abre otra pestaña con el diseño de la web, el formato, la foto y la firma.
3. **Programar y publicar:**
   - elige día y hora en el calendario y pulsa **Publicar cambios**;
   - la noticia queda «Publicado», con fecha de publicación igual a la programada, pero da 404 y no sale en portada;
   - a esa hora **sale sola**: noticia con foto (copia pública), formato y firma, en portada y en el buscador.

**`test:instalacion`, comprobaciones nuevas:**
- **Texto enriquecido en la web:**
  - negrita, cursiva, enlace, ladillo, cita y lista se ven en la noticia;
  - un enlace `javascript:` no se pinta;
  - el buscador encuentra palabras de un ladillo.
- **Slug:** «Ñandú y cañadas…» da `nandu-y-canadas-…`, y otra noticia con el mismo título, `…-2`.
- **Fechas:**
  - una noticia programada está oculta hasta su hora, y una fecha de publicación futura sin programar se rechaza;
  - un borrador queda sin fecha de publicación y, al publicarlo, toma la hora de ese momento;
  - quitar la programación publica en ese momento.
- **Migración:**
  - `down` y luego datos «como antes»: párrafos con espacios y vacíos; fechas sin hora, con hora local, en ISO, programadas y vacías;
  - `up`: textos idénticos y cada fecha en su hora de Madrid;
  - `down`/`up` conserva el texto;
  - la noticia migrada se pinta con `<p>` como antes.
- **Firma por defecto:** el autor viene de la firma vinculada del usuario.

## Qué debe hacer Code local en pruebas.planta14.com

Desde el PC de Pablo, con el agente SSH cargado. No hay variables nuevas en el `.env`.

**1. Entrar y ver el estado:**

```bash
ssh planta14@87.106.30.18
```

```bash
cd /srv/planta14/app
```

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir:
- `/api/health: ok`;
- sin mantenimiento;
- sin restauración pendiente;
- versión actual `8623791…` (o `c29e024…` si aún no se instalaron los ajustes de preproducción).

**2. Fijar el commit validado:**

```bash
git fetch origin desarrollo/planta14-ensayo-carga
```

```bash
git checkout --detach c740ceaca0160151bfb9c244472759a4709e482c
```

```bash
git log -1 --format='%h %s'
```

```bash
ls infra/test/out 2>/dev/null && sudo rm -rf infra/test/out/*
```

`git log` debe mostrar `c740cea cms: tipos de Payload regenerados…`.

**3. Desplegar con las migraciones.** El despliegue construye la imagen (con React 19.0.9 y el editor de texto), activa el mantenimiento, hace la copia previa, aplica las migraciones y comprueba la salud:
- desde `8623791`: **`20261103_081533_lote_ensayo`** y **`20261103_121545_formulario_noticias`**;
- desde `c29e024`: además, `20261103_000335_identidad_espacios` y `20261103_001210_creado_por`.

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production c740ceaca0160151bfb9c244472759a4709e482c
```

```bash
echo "código: $?"
```

Debe mostrar «Migraciones aplicadas: …», con las anteriores, y «Desplegada», con código 0:
- **código 1:** ha vuelto sola a la versión anterior;
- **código 2:** restauración asistida (`docs/MANUAL-OPERACION.md`, apartado 9).

La migración del formulario convierte los cuerpos y las fechas de las noticias que ya existan en pruebas. No hay que hacer nada a mano.

**4. Comprobar la estructura y el acceso a Commons:**

```bash
installed=$(cut -c1-12 /srv/planta14/state/current)
```

```bash
APP_IMAGE="planta14-app:$installed" docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -T migrate npm run cms:structure
```

```bash
curl -sSI -A 'Planta14CargaEnsayo/1.0 (https://planta14.com)' 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Gallegos_%28Mieres%2C_Asturias%29.jpg' | head -1
```

- `cms:structure` debe decir «Estructura cargada»: no duplica nada.
- `curl` debe dar `HTTP/2 200`. Si no, el servidor no llega a Commons y la carga se detendría en la primera foto, sin dejar nada a medias.

**5. Comprobar y cargar el ensayo:**

```bash
bash infra/deploy/ensayo.sh --env-file infra/.env.production cargar --solo-comprobar
```

```bash
bash infra/deploy/ensayo.sh --env-file infra/.env.production cargar
```

- **La comprobación** debe anunciar:
  - «Se crearían: 19 imágenes, … autores, 36 articles, 20 municipal-content»;
  - los espacios de Mieres y Lena;
  - 3 avisos de piezas sin foto.

  Termina en «COMPROBACIÓN TERMINADA (sin cambios)».
- **La carga** termina en «CARGA TERMINADA». Tarda unos minutos por las fotos. Si se corta (por ejemplo, porque Commons no responde), basta con repetirla: completa lo que falte.

Opcional, para tener la medida en el servidor real: en otra sesión SSH, mientras dura la carga, ejecuta esto y anota el valor más alto. En el ensayo local fueron unos 300 MiB de 768.

```bash
docker stats --format '{{.Name}} {{.MemUsage}}' | grep --line-buffered migrate-run
```

**6. Comprobar en el navegador** (con la contraseña de preproducción):
- **Web:**
  - la portada, con noticias de los últimos 4 días y la agenda «Para salir»;
  - `/mieres` y `/lena`, con sus avisos, eventos, ayudas y tablón;
  - `/agenda`, con las actividades próximas;
  - `/noticia/darle-al-hierro` (la carta) y el reportaje de Bustiello, con el crédito de la foto («… (reducida de tamaño)»).
- **CMS, como administración:**
  - en **Usuarios**, pon la **Firma (autor vinculado)** de cada periodista. Así su nombre viene puesto en las noticias nuevas;
  - abre **Noticias → Crear** y comprueba las seis pestañas, el editor de texto, el botón **Crear** de la foto y el calendario de **Publicación programada**;
  - abre una noticia del ensayo: el texto se ve en el editor, con sus párrafos, y la barra lateral muestra el **Lote**.

**No retires** el ensayo ahora. Para hacerlo más adelante, sigue `docs/ENSAYO-CONTENIDO.md`: `ensayo.sh retirar --solo-comprobar` y después `ensayo.sh retirar`.

## Sin comprobar

- **La descarga real desde Commons.** Este entorno no llega a `upload.wikimedia.org`. Se ha probado con un sustituto de las mismas rutas y resoluciones, que sirve imágenes sintéticas, y la mayor lleva ruido para que pese como una foto real. El paso 4 comprueba el acceso antes de cargar.
- **La memoria en el servidor real.** Se ha medido en el contenedor de migraciones de producción en local, con el mismo límite de 768 MiB y cgroup v1. El servidor puede usar cgroup v2: la prueba mide en los dos, pero solo se ha ejecutado aquí. El paso 5 permite anotarla.
- **Pegar texto desde Word o desde el correo.** La prueba de navegador escribe con el teclado. No se ha probado qué conserva el editor al pegar documentos reales; debería quedarse solo con los formatos permitidos.
- **Las noticias que ya existan en pruebas.planta14.com.** La migración se ha probado con datos sintéticos en todos los formatos de fecha conocidos. Una fecha con un formato distinto quedaría vacía y la noticia tomaría la fecha de su día.
