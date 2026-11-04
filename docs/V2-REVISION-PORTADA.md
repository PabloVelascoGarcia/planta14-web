# Planta 14 v2: revisión de portada, noticia y página del concejo

Rama **`desarrollo/planta14-v2-revision-portada`**, creada desde `desarrollo/planta14-ensayo-carga` (`c740cea`). No se han tocado `main` ni el servidor. Sin PR.

## Commit que se debe instalar

**`9c19b9232a54357697e2787b06a44e50dbe59898`** (`9c19b92`)

El commit posterior, que añade este documento, solo cambia documentación.

**Sin migraciones nuevas** y sin variables nuevas en el `.env`: el despliegue solo cambia la web. La única regla nueva del CMS es el texto de ayuda de «Principal».

## Qué cambia

| Punto | Cómo queda |
|---|---|
| 1. «Tu ayuntamiento, aquí» | Desaparece «Prueba cómo se publica un aviso». Con contenido real, ninguna página pública enlaza a un `/panel`. En lugar del botón fijo de Aller hay un botón **«Descubre el espacio de…» por cada espacio municipal activo**, en el orden de los concejos, y el enlace **«Los seis concejos del Caudal»** al mapa de concejos de la propia portada. Si no hay espacios activos, queda solo ese enlace. |
| 2. Noticia principal | La marcada **«Principal de portada»** (si hay varias, la más reciente). Si no hay ninguna, la noticia más reciente que no sea opinión ni agenda. La ayuda del campo en el CMS lo explica. |
| 3. Bloques | Las piezas de la sección **Agenda** solo salen en la agenda («Para salir» y `/agenda`), y la **opinión**, solo en su bloque. «En portada» (4), «La vida aquí» (3, primero las marcadas como Destacada) y Caudal (3) no repiten ninguna pieza y se rellenan con las siguientes noticias por fecha. El reparto está en `lib/front-page.ts`. |
| 4. Imágenes | Cada foto lleva `srcset` con los tamaños que Payload ya genera (800 y 1600 px) y el original, y `sizes` según su hueco: principal, tarjeta, tarjeta horizontal, noticia y página del concejo. El navegador descarga la que corresponde a su pantalla. Más abajo, el peso. |
| 5. Compartir | Bajo la firma de cada noticia: **WhatsApp, Facebook, X, Telegram** (enlaces directos, sin scripts de terceros ni cookies) y **Copiar enlace** (portapapeles del navegador). Botones de 44 px de alto. |
| 6. 404 | Página propia en español con el diseño de Planta 14: «Esta página no está en Planta 14.», buscador, enlace a la portada y a los seis concejos, y `noindex`. Ver la nota de abajo. |
| 7. Relacionadas | Primero las del mismo concejo, después las de la misma sección; nunca piezas de agenda ni la propia noticia. |
| 8. Publicidad | Los huecos sin anuncio muestran una autopromoción discreta, **«Anúnciate en Planta 14»**, con enlace a `/publicidad`. En `/publicidad` siguen los ejemplos de formato. |
| 9. Página del concejo | En «Noticias del concejo» van primero las noticias (municipales y «La mirada de Planta 14») y después las tres tarjetas fijas de la identidad. La lista de ayudas de esa pestaña va **sin foto**, que se ve en la sección Ayudas. Los avisos de la barra conservan su foto. |
| 10. Hora | Junto a la fecha, en la noticia y en las tarjetas: «03 de noviembre de 2026 · 19:05 h» (hora de Madrid). |
| 11. Móvil, página municipal | Ningún texto por debajo de 13 px (había textos de 6 a 12 px). Enlaces y botones de al menos 44 px de alto, y 24 px los créditos y licencias dentro de una frase. Sin desbordamiento horizontal. Se ajusta también el pie de toda la web. |

**Nota sobre la 404.**
- **Direcciones sin ninguna ruta** (`/noticia/a/b`, `/concejo/mieres/x/y`): reciben la página completa en el HTML (`app/global-not-found.tsx`, opción `experimental.globalNotFound` de Next.js).
- **Páginas que no existen** (un concejo, una noticia, un autor o una sección inexistentes): responden 404 con `noindex`. Next.js 16 entrega un armazón vacío y pinta la página en el navegador al cargar el JavaScript. El lector la ve igual. Sin JavaScript se vería en blanco, y los buscadores no la indexan.
- **Ya pasaba antes** en `c740cea`, con la 404 en inglés de Next. Lo provoca tener dos layouts raíz (web y CMS): se comprobó con un layout mínimo y una página que solo llama a `notFound()`.

## Peso de la portada en móvil

Medido en `test:portada` con Chromium emulando un iPhone 13 (390 px, densidad 3) y el contenido del ensayo cargado. Las fotos son sintéticas, de la resolución real y con textura, para que pesen como fotos en JPEG.

| | Antes (`c740cea`) | Después (`9c19b92`) |
|---|---|---|
| Imágenes al abrir (primera pantalla) | **2619 KiB** | **1104 KiB** (−58 %) |
| Imágenes recorriendo toda la portada | **4601 KiB** (7 fotos, todas de 2560 px) | **2254 KiB** (−51 %; 9 fotos, la mayoría de 1600 px) |
| Total de la página, sin comprimir | 5255 KiB | 2930 KiB |

Con densidad 3, una foto a todo el ancho del móvil necesita unos 1170 px, así que el navegador elige la de 1600 px. Una foto vertical cuyo original mide menos de 1600 px de ancho se descarga en su tamaño original, que es lo correcto. Un tamaño intermedio de unos 1200 px lo bajaría algo más, pero exige una migración y regenerar las imágenes: queda como posible mejora.

## Resultados

Batería completa ejecutada una vez hasta el final, el 4 de noviembre de 2026, sobre `9c19b92`, en Linux (Docker Engine nativo).

Una pasada anterior, sobre `e6b8b80`, tuvo dos fallos:
- **`staging-e2e`:** fallo real. Al pasar a lista sin foto también los avisos de la barra (el encargo solo pedía las ayudas), el aviso con imagen de Lena dejaba de verse con su foto. Se devolvió la foto a los avisos en `9c19b92`.
- **`test:formulario`:** fallo intermitente de la propia prueba. Leía la firma antes de que Payload terminara de cargarla; ahora la espera.

Después se repitió la batería entera.

| Comando | Resultado |
|---|---|
| `infra/test/production-deploy-test.sh` | **SUPERADO, 125 comprobaciones**. Memoria del contenedor de migraciones en la carga del ensayo: 316 MiB de 768 (pico del núcleo). 0 volúmenes nuevos. Las dos líneas «FALLO: /api/health» son las de los escenarios de vuelta atrás que provoca la propia prueba |
| `npm test` | 9 PASS |
| `npm run typecheck` | Sin errores |
| `npm run lint` | 0 errores, 12 avisos |
| `npm run build` | Correcto |
| `test:block2` | 8 PASS. La demo y el contenido real pintan igual la portada, la noticia y los concejos |
| `test:block3` | 17 PASS |
| `test:launch` | 6 PASS |
| `test:instalacion` | 16 PASS |
| `test:ensayo` | 8 PASS |
| `test:formulario` | 3 PASS (navegador real) |
| **`test:portada`** (nueva) | **9 PASS** (abajo) |
| `shellcheck -x` de todo `infra/` | Sin avisos |
| `caddy validate` (acme e internal) | Válido |
| `common-test`, `staging-config-test`, `monitor-test`, `memory-test`, `staging-guard-test` | Correctos |
| `restore-test.sh` (root, con imagen y sin privilegios) | SUPERADA las tres, sin restos ni volúmenes |
| `offsite-immutable-test.sh`, `pruebas-config-test.sh`, `preproduccion-test.sh`, `postgres-roles-test.sh` | SUPERADAS |
| `staging-e2e.sh` | SUPERADO |

**`test:portada`.** Base de la prueba del ensayo (`compose.ensayo-test.yaml`), con el contenido de `contenido-ensayo/` cargado con el cargador real; Chromium mediante Playwright.
1. **Ayuntamientos:**
   - ninguna página pública (portada, Mieres, Lena, Aller, agenda, noticia, comarca y buscador) enlaza a un `/panel`;
   - se ofrecen Mieres y Lena (activos), no Aller, y se enlaza la lista de concejos.
2. **Principal y bloques:**
   - sin marcada, la última noticia; al marcar una antigua como principal, sale ella y no se repite;
   - ningún bloque de noticias lleva agenda ni opinión, y ninguna pieza aparece en dos bloques;
   - los bloques están llenos (4, 3 y 3) y la agenda solo enlaza piezas de agenda.
3. **Relacionadas:** en 6 noticias, coinciden con «mismo concejo y después misma sección, sin agenda ni la propia».
4. **Imágenes:** `srcset` (800w y 1600w) y `sizes`, y peso medido en móvil.
5. **Compartir y hora:**
   - los cuatro enlaces con la dirección y el título codificados;
   - «Copiar enlace» deja la dirección en el portapapeles;
   - ningún script, petición ni cookie de terceros;
   - hora de Madrid en la noticia y en las tarjetas.
6. **Publicidad:** sin «Espacio publicitario»; aparece «Anúnciate en Planta 14» con enlace a `/publicidad`, en la portada y en la noticia.
7. **404:**
   - en dos direcciones sin ruta, el HTML completo, con cabecera de contenido real (no de demostración);
   - en un concejo, una noticia, un autor y una sección inexistentes, estado 404 y, en el navegador, título, buscador, portada, los seis concejos y el pie.
8. **Página del concejo** (Mieres): primero las noticias y después las tarjetas fijas; la lista de ayudas, sin fotos.
9. **Móvil:**
   - portada, noticia, 404 y agenda sin desbordamiento horizontal;
   - en Mieres y Lena, ningún texto visible por debajo de 13 px y ningún enlace ni botón por debajo de 44 px (24 px en créditos dentro de una frase).

## Qué debe hacer Code local en pruebas.planta14.com

Desde el PC de Pablo, con el agente SSH cargado. Se parte de `c740cea`, instalado con el ensayo cargado. Si no se instaló, sigue antes `docs/V2-ENSAYO-CARGA.md` de la rama `desarrollo/planta14-ensayo-carga`; las migraciones pendientes se aplican igual al desplegar este commit.

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
- versión actual `c740cea…`.

**2. Fijar el commit validado:**

```bash
git fetch origin desarrollo/planta14-v2-revision-portada
```

```bash
git checkout --detach 9c19b9232a54357697e2787b06a44e50dbe59898
```

```bash
git log -1 --format='%h %s'
```

```bash
ls infra/test/out 2>/dev/null && sudo rm -rf infra/test/out/*
```

`git log` debe mostrar `9c19b92 web: los avisos conservan su foto…`.

**3. Desplegar:**

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production 9c19b9232a54357697e2787b06a44e50dbe59898
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0. Desde `c740cea` no hay migraciones pendientes:
- **código 1:** ha vuelto sola a la versión anterior;
- **código 2:** restauración asistida (`docs/MANUAL-OPERACION.md`, apartado 9).

**4. Comprobar en el navegador** (con la contraseña de preproducción), mejor en un móvil:
- **Portada:**
  - la noticia principal no es de opinión ni de agenda;
  - ninguna noticia se repite entre «En portada», «La vida aquí» y Caudal;
  - las actividades de la Agenda salen solo en «Para salir»;
  - «Tu ayuntamiento, aquí» muestra «Descubre el espacio de Mieres» y «…de Lena» y el enlace «Los seis concejos del Caudal», sin «Prueba cómo se publica un aviso»;
  - los huecos de publicidad dicen «Anúnciate en Planta 14».
- **Una noticia:**
  - hora junto a la fecha;
  - botones WhatsApp, Facebook, X, Telegram y Copiar enlace (prueba uno desde el móvil);
  - Relacionadas del mismo concejo.
- **`/mieres` en el móvil:** textos legibles, sin desplazamiento lateral, noticias antes que las tres tarjetas fijas y ayudas sin foto en esa lista.
- **404:** `/esta-pagina-no-existe` y `/noticia/a/b` muestran la 404 de Planta 14, con buscador y concejos.

Opcional, si quieres medir el peso en el móvil real: en Chrome, abre las herramientas de desarrollo, ve a **Red**, filtra por **Img**, recarga la portada con el modo móvil y anota el total transferido.

## Sin comprobar

- **El peso con fotos reales.** Se ha medido con fotos sintéticas de textura; las de Commons pueden pesar algo más o algo menos. La proporción entre antes y después debería mantenerse.
- **El aspecto en móviles reales**, con sus tipografías y tamaños. Se ha comprobado con la emulación de iPhone 13 de Chromium.
- **Los botones de compartir con las apps instaladas.** Los enlaces son los oficiales de cada red y se ha comprobado que llevan la dirección y el título; abrir WhatsApp o Telegram depende del móvil.
- **La 404 sin JavaScript** en páginas inexistentes (ver la nota): comportamiento de Next.js 16 que ya existía.
