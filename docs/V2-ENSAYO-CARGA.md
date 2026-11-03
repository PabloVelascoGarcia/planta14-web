# Planta 14 v2: carga del contenido de ensayo

Rama **`desarrollo/planta14-ensayo-carga`**: `desarrollo/planta14-v2-ajustes-preproduccion` (`8623791`) más `contenido-ensayo/` de `desarrollo/planta14-contenido-ensayo` (`d649125`). No se han tocado `main` ni el servidor. Sin PR.

## Commit que se debe instalar

**`f32f7bf539546059a0e46c457f40f27f97707978`** (`f32f7bf`)

El commit posterior, que añade este documento, solo cambia documentación.

## Qué se ha hecho

| Commit | Qué |
|---|---|
| `320d25a` | `contenido-ensayo/` (contenido.json, fotos.json y resumen.json), sin cambios. |
| `ff996fc` | **`npm run cms:ensayo:cargar`** y **`npm run cms:ensayo:retirar`** (`cms/ensayo.ts`, cargador nuevo; no usa ni adapta `import-municipal`), el lanzador del servidor `infra/deploy/ensayo.sh` y la migración `20261103_081533_lote_ensayo`. |
| `ddd1e8a` | `docs/ENSAYO-CONTENIDO.md` (guía para Pablo) y apartado 13 del manual de operación. |
| `f32f7bf` | Corrección de la prueba de producción (contaba las copias del almacenamiento antes de que existiera su carpeta). |

### Detalles

- **Migración `20261103_081533_lote_ensayo`:**
  - campo **Lote** (ensayo o definitivo) en Noticias, Contenidos municipales, Imágenes y Autores. Solo lo ve y lo cambia la administración; los periodistas no pueden marcar nada como ensayo;
  - **Agenda** (fecha y hora, y lugar) en Noticias, para la agenda general;
  - **estado previo** (oculto) en Espacios municipales.

  Su `down` se niega mientras quede contenido de ensayo, para no perder las marcas.
- **Carga:**
  - **Publicado:** 36 piezas (34 de ensayo y los 2 reportajes definitivos) y 20 contenidos municipales de Mieres y Lena, con sección, concejo, autor y «Mostrar en la página del concejo».
  - **Fechas:** las del JSON se ignoran. Las publicaciones se reparten en los 4 días anteriores, de 7:45 a 21:00, y los eventos quedan en las semanas siguientes; las fechas citadas en el texto se actualizan.
  - **Aviso de ensayo:** el párrafo «Contenido ficticio de ensayo…» va al final.
  - **Autores:** se crean los que falten.
  - **Espacios:** Mieres y Lena se activan, con su estado previo guardado.
- **Fotos:**
  - se descargan los 19 originales de Commons, comprobando que la resolución coincide con `fotos.json`;
  - se suben a Imágenes con autor, licencia, enlace a la ficha y una **declaración de derechos de la administración** que cita la fuente;
  - las fotos de los reportajes definitivos son «definitivas»;
  - las candidatas de cabecera solo se suben, no se asignan.

  La declaración la escribe el servidor (contexto de la API local) a nombre de un administrador; nunca se acepta como dato del cliente.
- **Agenda general:** la agenda de la portada y de `/agenda` muestra ahora, con contenido real, los eventos municipales y las actividades de la sección Agenda que tienen fecha. Salen solo las próximas, ordenadas por fecha y con enlace a la noticia. La demo no cambia.
- **Repetible:** busca por `legacyID` y `slug` (piezas), por ficha de Commons (imágenes), por `slug` (autores) y por el estado guardado (espacios). Una segunda carga no crea ni descarga nada.
- **`--solo-comprobar`** (carga y retirada): dice qué haría, sin escribir ni descargar. `payload run` no pasa argumentos, así que `scripts/ensayo-run.mjs` los recoge y **rechaza cualquier opción desconocida**: una errata nunca provoca una carga o una retirada real. Esto se detectó al probarlo: sin el lanzador, `--solo-comprobar` no llegaba al script.
- **Retirada:**
  - `infra/deploy/ensayo.sh retirar` hace antes la copia de PostgreSQL y del almacenamiento con `backup-postgres.sh` y `backup-storage.sh`. `npm run cms:ensayo:retirar` se niega sin esa copia;
  - borra **solo** lo marcado como ensayo, y las imágenes de ensayo que no use nada más, con sus copias públicas;
  - las imágenes y los autores del ensayo que use algo real se conservan y dejan de estar marcados;
  - conserva lo definitivo, devuelve Mieres y Lena a su estado previo (salvo que alguien los cambiara después) y deja constancia en Auditoría con el nombre de la copia previa.

## Resultados

Batería completa ejecutada **una vez**, el 3 de noviembre de 2026, sobre `ddd1e8a`, en Linux (Docker Engine nativo). Todo correcto salvo `production-deploy-test.sh`: se detuvo dentro de la sección nueva por un fallo de la propia prueba (ver «Detalles»). Se corrigió en `f32f7bf` y se repitió solo esa prueba: **SUPERADA, 123 comprobaciones**. Entre `ddd1e8a` y `f32f7bf` solo cambia esa prueba.

| Comando | Resultado |
|---|---|
| `infra/test/production-deploy-test.sh` (sobre `f32f7bf`) | **SUPERADO, 123 comprobaciones**, incluida la sección 3d (abajo). 0 volúmenes nuevos |
| `npm test` | 9 PASS |
| `npm run typecheck` | Sin errores |
| `npm run lint` | 0 errores, 16 avisos (los de siempre) |
| `npm run build` | Correcto |
| `npm run test:block2` | 8 PASS. La comparación demo/payload excluye ahora la lista de agenda (ordenada por fecha con contenido real); la agenda la comprueba `test:ensayo` |
| `npm run test:block3` | 17 PASS |
| `npm run test:launch` | 6 PASS |
| `npm run test:instalacion` | 13 PASS |
| **`npm run test:ensayo`** (nueva) | **8 PASS** (abajo) |
| `shellcheck -x` de todo `infra/` | Sin avisos |
| `caddy validate` (acme e internal) | Válido |
| `common-test`, `staging-config-test`, `monitor-test`, `memory-test`, `staging-guard-test` | Correctos |
| `restore-test.sh` (root, con imagen y sin privilegios) | SUPERADA las tres, código 0, sin restos ni volúmenes |
| `offsite-immutable-test.sh`, `pruebas-config-test.sh`, `preproduccion-test.sh`, `postgres-roles-test.sh` | SUPERADAS |
| `staging-e2e.sh` | SUPERADO |

**`test:ensayo`.** Datos reales de `contenido-ensayo/`, S3 local y un sustituto de Commons que sirve imágenes sintéticas con la misma ruta y resolución: este entorno no llega a Commons.
1. **`--solo-comprobar`:** anuncia 36 noticias, 20 contenidos municipales, 19 imágenes, 3 autores, 2 espacios y las 3 piezas sin foto, sin escribir ni descargar nada.
2. **Carga:**
   - todo publicado con su lote (2 reportajes definitivos);
   - fechas en los 4 días anteriores, repartidas en los 4, a horas entre las 7 y las 21;
   - los 12 eventos en las semanas siguientes, con la fecha del texto actualizada;
   - aviso de ensayo al final; la carta, con opinión y sin salir en la página del concejo.
3. **Fotos:**
   - 19 originales, cada uno descargado una vez y con la resolución comprobada;
   - con crédito, titular, ámbito publicable y declaración de la administración citando ficha y licencia;
   - las de los reportajes, definitivas; las candidatas de cabecera, sin asignar.
4. **Espacios y web:** Mieres y Lena activos; agenda general en `/agenda` con enlace a su noticia; crédito de la foto visible en el reportaje.
5. **Segunda carga:** no crea ni descarga nada. La migración no se deja deshacer con ensayo cargado.
6. **Retirada:**
   - `--solo-comprobar` no borra; sin copia previa se niega;
   - con la copia hecha por `backup-postgres.sh` borra exactamente lo anunciado: 34 noticias, 20 contenidos municipales, 15 imágenes y 2 autores.
7. **Después de retirar:**
   - quedan los 2 reportajes, una noticia real anterior y una noticia real creada después que reutiliza una foto del ensayo;
   - se conservan esa foto y otra usada como cabecera de Lena, que dejan de estar marcadas;
   - las demás fotos y sus copias públicas se borran; quedan los autores previos y el definitivo;
   - espacios restaurados; Auditoría con la entrada de carga, la de retirada (con quién y con la copia previa) y una por documento borrado;
   - Mieres vuelve a «El concejo en Planta 14» y las noticias de ensayo dan 404.
8. **Retirar otra vez** no hace nada.

**Ensayo de producción, sección 3d.** Ejecuta `infra/deploy/ensayo.sh` en el contenedor de migraciones de producción:
- `cargar --solo-comprobar` no escribe;
- `cargar` publica 34 + 2 piezas, 20 municipales y 19 imágenes con copia pública, y activa Mieres y Lena;
- la carta se ve en la web;
- una segunda carga no duplica nada;
- `retirar --solo-comprobar` no borra;
- `retirar` hace antes las copias de PostgreSQL y del almacenamiento, deja solo los 2 reportajes y lo que no era del ensayo, restaura los espacios y queda en Auditoría y en `historial.log`.

## Qué debe hacer Code local en pruebas.planta14.com

Desde el PC de Pablo, con el agente SSH cargado. No hay variables nuevas en el `.env`.

**1. Entrar y ver el estado:**

```bash
ssh planta14@87.106.30.18
cd /srv/planta14/app
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
git checkout --detach f32f7bf539546059a0e46c457f40f27f97707978
git log -1 --format='%h %s'
ls infra/test/out 2>/dev/null && sudo rm -rf infra/test/out/*
```

**3. Desplegar con la migración.** Construye la imagen, activa el mantenimiento, hace la copia previa, aplica **`20261103_081533_lote_ensayo`** y comprueba la salud. Si se viene de `c29e024`, aplica también `20261103_000335_identidad_espacios` y `20261103_001210_creado_por`.

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production f32f7bf539546059a0e46c457f40f27f97707978
echo "código: $?"
```

Debe mostrar «Migraciones aplicadas: … 20261103_081533_lote_ensayo» y «Desplegada», con código 0. Con código 1, ha vuelto sola a la versión anterior. Con código 2, restauración asistida (`docs/MANUAL-OPERACION.md`, apartado 9).

**4. Comprobar la estructura y el acceso a Commons:**

```bash
installed=$(cut -c1-12 /srv/planta14/state/current)
APP_IMAGE="planta14-app:$installed" docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -T migrate npm run cms:structure
curl -sSI -A 'Planta14CargaEnsayo/1.0 (https://planta14.com)' 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Gallegos_%28Mieres%2C_Asturias%29.jpg' | head -1
```

- `cms:structure` debe decir «Estructura cargada»: no duplica nada.
- `curl` debe dar `HTTP/2 200`. Si no, el servidor no llega a Commons y la carga se detendría al descargar la primera foto, sin dejar nada a medias.

**5. Comprobar y cargar:**

```bash
bash infra/deploy/ensayo.sh --env-file infra/.env.production cargar --solo-comprobar
bash infra/deploy/ensayo.sh --env-file infra/.env.production cargar
```

- La comprobación debe anunciar «Se crearían: 19 imágenes, … autores, 36 articles, 20 municipal-content», los espacios de Mieres y Lena y 3 avisos de piezas sin foto. Termina en «COMPROBACIÓN TERMINADA (sin cambios)».
- La carga termina en «CARGA TERMINADA». Si se corta (por ejemplo, porque Commons no responde), se repite y completa lo que falte.

**6. Comprobar en el navegador** (con la contraseña de preproducción):
- la portada con noticias de los últimos 4 días y la agenda «Para salir»;
- `/mieres` y `/lena` con sus avisos, eventos, ayudas y tablón;
- `/agenda` con las actividades próximas;
- `/noticia/darle-al-hierro` (la carta) y el reportaje de Bustiello, con el crédito de la foto;
- en `/cms`, como administración, el campo **Lote** en la barra lateral de las piezas.

**No retires** ahora. Para retirar más adelante, sigue `docs/ENSAYO-CONTENIDO.md`: `ensayo.sh retirar --solo-comprobar` y después `ensayo.sh retirar`.

## Sin comprobar

- **La descarga real desde Commons.** Este entorno no tiene acceso a `upload.wikimedia.org`, así que se probó con un sustituto de las mismas rutas y resoluciones. Sin comprobar: las resoluciones reales, la cabecera `Content-Type` real y el tamaño de los originales (algunos de hasta 8104 × 4559, quizá más de 10 MB; la API local no aplica el límite de 10 MB de las subidas por HTTP). El paso 4 comprueba el acceso antes de cargar.
- **Que IONOS Object Storage acepte los originales grandes** y genere sus tamaños dentro del límite de memoria del contenedor de migraciones (768 MiB). En local, con imágenes sintéticas de la misma resolución, funcionó.
- **La carga sobre los datos reales de pruebas.planta14.com**, con las cuentas y noticias que ya existan. Por diseño no toca nada sin lote; probado con contenido previo y posterior a la carga.
- **El aspecto de la web con el ensayo cargado** en un navegador real. Se comprobaron el HTML y los estados.
