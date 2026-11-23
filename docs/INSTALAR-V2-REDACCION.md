# Instalar la entrega de la redacción (24 de noviembre)

Para Claude Code en el PC de Pablo (Code local), con el agente SSH cargado.

Rama **`desarrollo/planta14-v2-redaccion`**, creada desde `desarrollo/planta14-v2-panel` (`19e10ec`: el código de
`474dddf`, que es lo que hay en pruebas, más el documento de instalación). No se han tocado `main`,
`mejora/presentacion-la-voz` ni el servidor. Sin PR.

**Commit a instalar: `HASH-CORTO`** (`HASH-NUEVO`). Se instala sobre `474dddf`. **Una migración nueva**,
`20261123_132459_redaccion_imagenes` (abajo). **Caddy no cambia** (no hace falta `aplicar-caddy.sh`). El commit
siguiente solo completa este documento.

## Qué cambia

### A. Noticias y clasificación

| Punto | Cambio |
|---|---|
| 1. Sección enlazada | En la noticia (migas), en las tarjetas («Mieres · Sociedad · fecha»), en la principal de portada y en la edición, la sección enlaza a su página: `/tema/[sección]`; Opinión y Agenda, a `/opinion` y `/agenda`, como el menú. |
| 2. Varios concejos | «Concejo» pasa a **Concejo principal** (obligatorio, el mismo campo y la misma columna: no se mueve ningún dato) y se añade **Otros concejos** (opcional, varios). La pieza sale en la página de todos sus concejos, en el boletín de quien sigue cualquiera de ellos y en las estadísticas de cada uno (sin duplicar el total); dirección, migas y etiqueta visible usan el principal. **Caudal** sigue siendo lo comarcal: portada y `/comarca/caudal`; no se combina con otros concejos ni puede ser secundario (el CMS lo explica). |
| 3. Varias secciones | **Sección principal** (obligatoria, misma columna) y **Secciones secundarias** (opcional, máximo 2): la pieza sale también en sus páginas. |
| 4. Etiquetas | Colección **Etiquetas** (nombre y slug únicos; el slug sale del nombre, sin tildes ni mayúsculas: «Minería», «mineria» y «MINERÍA» son la misma y el CMS dice cuál usar). Campo opcional en noticias y opinión, máximo 5, con búsqueda de las existentes y «+» para crearla desde la noticia. Página `/etiqueta/[slug]`, 24 por página, en el sitemap e indexable solo con 2 o más noticias. Al pie de la noticia, «Temas: …» enlazadas. «Relacionadas» empieza por las que comparten etiqueta. |

### B. Imágenes

| Punto | Cambio |
|---|---|
| 5. Imágenes en el texto | Bloques **Imagen** (pie obligatorio, crédito opcional: si se deja vacío, la autoría de la imagen; «Mostrar entera») y **Galería** (2 a 12, cada una con pie y crédito) en el editor (`/` o `+`). Misma comprobación de derechos que la principal y copia pública (campo oculto `bodyImages`). En la web, con `srcset`; la galería en cuadrícula y, al pulsar, en grande con flechas, teclado (← → Esc) y deslizando en el móvil; el foco vuelve a la miniatura. |
| 6. Multimedia | `/multimedia`: noticias con al menos una galería, paginada. En el menú y en el sitemap, e indexable, solo con 6 o más; antes existe pero no se enlaza ni se indexa. |
| 7. Punto de interés | Activado en la mediateca («Editar imagen» → punto focal). Lo respetan las tarjetas, la portada y la imagen para redes. La principal vertical se ve entera en la noticia, centrada y con altura máxima. |
| 8. Carteles | «Mostrar entera (cartel)» en la foto principal de noticias (también Agenda), en el bloque Imagen y en las fiestas (allí **marcada por defecto**). Nunca se recorta: completa sobre fondo neutro en la noticia o ficha, y completa dentro de su hueco en las tarjetas. |
| 9. Plantillas | 14 plantillas gráficas propias (una por sección y Agenda, Formación, Ayudas, Empleo y Fiestas; sin fotos ni IA), en `/plantillas/[slug].png` (1600×1000, generadas en el servidor). Se eligen con un clic en «Sin foto: plantilla de Planta 14»; sin elegir, la de la sección principal (antes salía un recuadro gris). Crédito «Planta 14». |
| 10. IA | Tipo de imagen «Ilustración generada con IA»: rótulo fijo sobre la imagen y en el pie (tarjetas, noticia, galería, fiestas, imagen para redes), nunca «Fotografía», y no se puede cambiar después a otro tipo. Anotado en el manual: su uso lo decide la dirección. |
| 11. Imagen para redes | `/noticia/[slug]/redes.jpg` (1200×630, JPEG): foto según su punto de interés (cartel completo sobre fondo neutro; plantilla de la sección si no hay foto), titular, concejo principal y marca; rótulo de IA si toca. Generada en el servidor con Satori y Resvg (incluidos en Next) y sharp, sin terceros: los textos se limpian de caracteres que la tipografía no tiene, para no pedir glifos a internet. 19–35 KB en las pruebas; la dirección lleva la versión (`?v=`) y se cachea un año (`immutable`); en memoria, las 60 últimas. Va en `og:image` y `twitter:image`. El JSON-LD de Google Discover sigue con la foto grande. |

### C. Seguridad (duda 36 de `INSTALAR-V2-PANEL.md`)

- **Reglas de acceso revisadas en todas las colecciones y globales para el rol municipal.** Lo que se cierra ahora: una
  cuenta municipal ya no lee cartas publicadas, patrimonio, rutas, ni el directorio y la visibilidad de «Útil» de otros
  concejos, ni ningún ajuste global (última hora, lemas, pie, principios, fiestas, cartas, redacción). Etiquetas: sin
  acceso. El resto ya estaba cerrado y ahora tiene prueba: noticias, fiestas, autores, secciones, concejos, pendientes,
  auditoría, suscriptores, boletines, sugerencias, copias públicas; de usuarios, solo la suya; contenidos, espacios,
  servicios e imágenes, solo los suyos.
- **Las cuentas municipales no usan la API de Payload ni el CMS:** `/api/cms/*` responde **403** a cualquier petición
  con credenciales de una cuenta municipal (cookie de Payload, cabecera `Authorization` o la cookie del panel), y
  `/api/cms/users/login` también. Solo pasan por el puente del panel (`/api/panel/api`, lista cerrada), que marca sus
  peticiones con un secreto aleatorio del proceso (`lib/panel-bridge.ts`). Su sesión solo se abre desde el panel.
  Restablecer la contraseña pasa por el puente y nunca devuelve la cookie ni el token de Payload.

### D. Panel

- Sin flecha ↗ en los botones de envío del panel: «Entrar», «Enviar el enlace», «Guardar y entrar», «Guardar» (Útil),
  «Añadir al directorio», «Guardar los cambios» y «Enviar la sugerencia» (los enlaces la conservan).
- **Visitas → Por sección:** nombres visibles («Página del concejo», «Útil», «Sociedad»…), también en CSV y PDF.

### E. Otros

- **Cabecera en el móvil:** la franja de concejos ensanchaba la página 67 px a 390 px (la prueba visual anterior no lo
  veía porque emulaba un móvil, que ensancha la ventana). Arreglado.
- **Memoria de compilación** (punto 15), abajo.

## Memoria de la compilación

El primer envío (`68a2a66`) **falló en el CI**: la imagen Docker se quedaba sin memoria (montón de 768 MiB, exit 134).
La versión de pruebas ya estaba al límite. Medido como siempre (etapa «build» de `infra/app.Dockerfile` en la misma
imagen `node:22`, `CMS_ENABLED=false`, `LOW_MEMORY_BUILD=true`, 768 MiB de montón; pico del contenedor, con la caché
de disco):

| Versión | Pico | Resultado |
|---|---|---|
| `19e10ec` (lo instalado, con la caché de webpack) | 2.665 MiB | compila |
| `68a2a66` (esta entrega, con la caché) | — | **sin memoria** |
| `19e10ec` sin la caché de webpack | 1.781 MiB | compila |
| **Esta entrega sin la caché de webpack** | **1.804 MiB** | compila (+1,3 % sobre la anterior sin caché) |

**Arreglo:** con `LOW_MEMORY_BUILD=true` (solo la imagen Docker) se desactiva la caché persistente de webpack, que
guarda todo lo compilado en memoria para escribirlo al final y no sirve en una compilación limpia. El pico baja de
2.665 a 1.804 MiB (**−32 %**), así que en el servidor la swap debería quedar claramente por debajo de los 1.103 MiB de
la última vez. Además, `next/og` se carga en tiempo de ejecución, fuera de la compilación.
**Si aun así la swap del servidor sube**, lo siguiente sería compilar la imagen en el CI y que el servidor solo la
descargue (no compilaría nada).

## Migración `20261123_132459_redaccion_imagenes`

- Tablas nuevas `tags`, `articles_rels` y `_articles_v_rels` (otros concejos, secciones secundarias, etiquetas e
  imágenes del texto, vacías al empezar).
- Columnas nuevas: `media.image_kind` (por defecto «foto»), `articles.image_poster`, `articles.template` (por defecto
  «none»), `articles.has_gallery`, `festivals.image_poster` (por defecto **sí**) y sus versiones;
  `stats_daily.extra_towns` (por defecto vacío).
- El concejo y la sección de cada noticia **no se mueven**: siguen siendo el principal, en las mismas columnas.
- Probada desde cero, hacia atrás y otra vez adelante. Solo **añade**: la versión anterior funciona con la base ya
  migrada.

## Pasos en pruebas.planta14.com

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

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente, y la versión `474dddf`.

**2. Fijar el commit y desplegar** (hace la copia previa, aplica la migración y arranca):

```bash
git fetch origin desarrollo/planta14-v2-redaccion
```

```bash
git checkout --detach HASH-NUEVO
```

```bash
git log -1 --format='%h %s'
```

Debe mostrar `HASH-CORTO` y el asunto del commit.

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production HASH-NUEVO
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0, y decir «Migraciones aplicadas: 20261123_132459_redaccion_imagenes».

**3. Memoria (punto 15):** durante la compilación del paso 2, en otra terminal:

```bash
free -m
```

Anota el máximo de la línea «Swap» (la última vez, 1.103 MiB). Si sale claramente más alto, dímelo.

**4. Estado otra vez:**

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir `/api/health: ok` y la versión `HASH-CORTO`.

**5. Si algo falla:** si `deploy.sh` terminó con código 1 o 2, sigue lo que dice (si la migración llegó a aplicarse,
`deploy.sh` deja el modo mantenimiento y las instrucciones de restauración asistida). Si fue bien pero algo no
funciona, vuelve a `474dddf` **sin deshacer la migración** (solo añade; la versión anterior no usa lo nuevo):

```bash
git checkout --detach 474dddf8dc4b5136fab16c16e5306e65832c1b7d
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production 474dddf8dc4b5136fab16c16e5306e65832c1b7d
```

Con la versión anterior, las noticias se ven con su concejo y sección principales (sin otros concejos, etiquetas ni
galerías), y las cuentas municipales vuelven a tener la API de Payload como antes. Lo escrito en esos días (etiquetas,
otros concejos…) se conserva y reaparece al volver a instalar esta entrega. No hace falta `aplicar-caddy.sh`.

## Comprobaciones después del despliegue

En el ordenador y en el móvil (o el modo móvil del navegador, F12). Las capturas de `docs/MANUAL-REDACCION.md`
muestran cómo debe verse cada cosa.

1. **CMS, noticia nueva:** pestaña Clasificación con «Concejo principal», «Otros concejos», «Sección principal»,
   «Secciones secundarias» y «Etiquetas». Crea la etiqueta «Prueba»; intenta crear «PRUEBA»: avisa de que ya existe.
2. **Varios concejos y secciones:** publica una noticia de prueba en Mieres con Lena y Aller y con dos secciones
   secundarias. Sale en `/mieres`, `/lena`, `/aller` (o `/concejo/aller`) y en las tres secciones; las migas dicen
   Mieres y la sección principal, que enlaza a `/tema/…`. Con «Caudal» como principal y otro concejo, el CMS no deja.
3. **Foto vertical, cartel y galería:** en esa noticia, una foto vertical (se ve entera), otra con «Mostrar entera
   (cartel)» y un bloque «Galería» de 3 fotos: en el móvil, al pulsar una se ve en grande y se pasa deslizando.
4. **Etiqueta:** `/etiqueta/prueba` lista la noticia.
5. **`/multimedia`** existe; con menos de 6 galerías no está en el menú.
6. **Sin foto:** otra noticia sin foto lleva la plantilla de su sección y «Imagen: Planta 14».
7. **Imagen para redes:** pega la dirección de la noticia en un chat de WhatsApp contigo mismo (o en
   https://www.opengraph.xyz): foto encuadrada, titular, concejo y marca.
8. **Cuenta municipal:** con la de un ayuntamiento, el panel funciona como siempre (publicar, directorio, «Útil»,
   sugerencias, visitas con «Página del concejo» en «Por sección»). En `/cms` no entra.
9. Borra o despublica las noticias de prueba.

## Dudas resueltas por prudencia

1. **Rama:** creada desde la punta de `desarrollo/planta14-v2-panel` (`19e10ec`), que es `474dddf` más el documento de
   instalación; el código es el mismo.
2. **Enlace de la sección:** Opinión y Agenda llevan a `/opinion` y `/agenda` (como el menú); las demás, a
   `/tema/[sección]`.
3. **Concejo principal:** se reutiliza el campo y la columna de «Concejo» (y de «Sección»): la migración no mueve
   datos, así que no hay nada que perder.
4. **Caudal con otros concejos:** el CMS lo rechaza con un mensaje, en lugar de ignorarlo en silencio.
5. **Etiquetas:** el slug sale siempre del nombre; corregir el nombre cambia la dirección de la etiqueta. Borrar, solo
   la administración.
6. **Crédito en los bloques:** opcional en el bloque porque la autoría ya es obligatoria en la imagen; si se deja vacío,
   se usa esa.
7. **Noticias sin foto:** sin plantilla elegida se usa la de la sección principal (antes, un recuadro gris); una
   sección sin plantilla propia lleva la genérica «Planta 14».
8. **IA:** una imagen guardada como «Ilustración generada con IA» no se puede cambiar a otro tipo, tampoco la
   administración (hay que subirla de nuevo). El rótulo sale también en galerías, fiestas e imagen para redes.
9. **Imagen para redes:** si se elige una «Imagen para redes» a mano, se usa esa foto dentro del mismo diseño; el
   JSON-LD de Google Discover conserva la foto grande.
10. **Galerías sin foto principal:** su tarjeta lleva la plantilla; el manual recomienda poner foto principal (no se
    toma la primera de la galería, para no repetirla arriba).
11. **Estadísticas:** las visitas a una noticia cuentan en todos sus concejos desde ahora; las anteriores no se recalculan.
12. **Ajustes globales:** cerrados para las cuentas municipales (la web pública los sigue leyendo sin sesión).
13. **Prueba visual a 390 px:** sin emulación de móvil, que ensancha la ventana y ocultaba el desbordamiento de la cabecera.
14. **Next.js 16.4.3:** al compilar, Next avisa de una vulnerabilidad publicada para esta versión y recomienda
    actualizar. No he actualizado (cambia la base de todo y no lo habías pedido); la compilación sigue al repetirla.
    Si quieres, lo hago en una rama aparte con la batería.

## Resultados de la batería completa (esta entrega)

RESULTADOS-BATERIA
