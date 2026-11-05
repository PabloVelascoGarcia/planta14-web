# Planta 14 v2: participación, recuperación de contraseña, cartas, sugerencias, estadísticas y «Útil»

Rama **`desarrollo/planta14-v2-participacion`**, creada desde `desarrollo/planta14-v2-revision-portada` (`9c19b92`). No se han tocado `main` ni el servidor. Sin PR.

**Documento único de instalación para Code local**: cubre todo lo de la rama, incluidas las importaciones.

> **Commit a instalar: `684c787`** (`684c7870909483032c3a6706d919d4a7f2670593`). El commit siguiente solo añade documentación: este documento y los manuales.
>
> **Batería completa: pasada** (una vez, al final de todo). Los fallos que encontró están corregidos, y las pruebas afectadas se han repetido sobre `684c787`. Detalle abajo.

## Commits (uno por bloque)

| Commit | Bloque |
|---|---|
| `de89639` | Periodista responsable por concejo y «Pendientes de revisar» |
| `d103290` | Fiestas de las Cuencas |
| `b81962d` | Suscripción al boletín (doble confirmación) |
| `e4f92d8` | Barra de «Última hora» |
| `4e1715c` | Google Discover |
| `07e6368` | Fechas del CMS en `dd/MM/yyyy HH:mm` |
| `a17acc7` | Manual (responsables, fiestas, boletín, última hora) |
| `f4d9e18` | Merge de `desarrollo/planta14-v2-recuperacion-contrasena` (`af0924b`) |
| `a6e52c8` | Contraseñas de al menos 12 caracteres en el servidor y revisión de la recuperación |
| `f17ddf5` | Cartas de los lectores |
| `30597ee` | Buzón de sugerencias en el panel municipal |
| `9283e1f` | Estadísticas propias sin cookies |
| `566a137` | Sección «Útil» |
| `38f2467` | Ocultar servicios de «Útil» por concejo |
| `4865c32` | Ajustes tras la batería completa |
| `684c787` | Zonas táctiles en móvil de «Útil» y del formulario del boletín (página del concejo) |
| (este documento) | Manual (contraseña, cartas, sugerencias, estadísticas, «Útil») y este documento |

**Migraciones nuevas.** Se aplican solas al desplegar, en este orden:
1. `20261104_195227_responsables`
2. `20261104_200318_fiestas`
3. `20261104_201144_suscriptores`
4. `20261104_202002_ultima_hora`
5. `20261104_205214_cartas`
6. `20261104_205655_sugerencias`
7. `20261104_210500_estadisticas` (tabla `stats_daily`)
8. `20261104_215338_util` (Patrimonio, Rutas, Servicios municipales y la tabla `external_cache`)
9. `20261104_221803_util_ocultar`

**Dependencia nueva:** `leaflet@1.9.4`, para dibujar los recorridos en el mapa. La instala la imagen al construirse.

**Variables del `.env`** (`infra/.env.production`):

| Variable | Para qué | Si falta |
|---|---|---|
| `SMTP_ENABLED=true` y la contraseña de avisos@planta14.com (`docs/PUESTA-EN-MARCHA-IONOS.md`, apartado 7) | Todos los correos: recuperación de contraseña, cartas, fiestas, boletín, pendientes, sugerencias y avisos de fuentes caídas | Los formularios públicos dicen que no están disponibles y no guardan nada. No se puede recuperar la contraseña. |
| **`AEMET_API_KEY`** (nueva) | Bloque «El tiempo» de «Útil». La clave se pide en `https://opendata.aemet.es/centrodedescargas/inicio`. Las claves nuevas duran tres meses. | El bloque del tiempo no se muestra; lo demás funciona. |

Pablo pone la clave directamente en el `.env` del servidor; no se pide por el chat. Sin variables opcionales nuevas: las `UTIL_*_URL` y `AEMET_BASE_URL` solo sirven para las pruebas.

## Qué hace cada bloque

El detalle para quien usa el CMS está en `docs/MANUAL-OPERACION.md` (apartados 12 y 14 a 22) y, para los ayuntamientos, en `docs/MANUAL-AYUNTAMIENTOS.md` (apartados 1 y 6).

**1. Responsables por concejo.**
- Concejos → «Periodista responsable». Solo lo cambia la administración y no es público.
- Lo que llega de fuera crea un pendiente asignado al responsable, que recibe un correo con el enlace:
  - publicaciones de los ayuntamientos;
  - fiestas enviadas;
  - cartas.
- `npm run cms:responsables` crea, si faltan, las cuentas de Andrés y Juanfran Santos y las asigna:
  - Andrés: Aller, Mieres y Morcín;
  - Juanfran: Lena, Riosa y Ribera de Arriba.

**2. Fiestas de las Cuencas.**
- Colección Fiestas y página `/fiestas`, con ficha.
- También salen en la agenda, en la página del concejo y en el bloque de portada.
- Formulario «Envía tu fiesta» con confirmación por correo.
- Botón «Duplicar para el año siguiente» en el CMS.
- Importador `npm run cms:fiestas:importar`.

**3. Boletín.** Solo captar y confirmar suscriptores:
- formulario en portada, pie, noticias y fiestas;
- doble confirmación y baja con un clic;
- colección Suscriptores, con exportación CSV.

El envío del boletín queda para otro encargo.

**4. Última hora:** barra roja bajo la cabecera, con caducidad.

**5. Google Discover:**
- `max-image-preview:large`, solo si la web es indexable;
- imagen de 1600 px en Open Graph y en JSON-LD.

**6. Fechas del CMS:** `dd/MM/yyyy HH:mm`.

**7. Recuperación de contraseña** (merge de `af0924b`, revisado):
- **Correo propio** de Planta 14.
- **Enlace según la cuenta:**
  - redacción: `/cms/reset/…`;
  - ayuntamientos: su panel, en `/<concejo>/panel/restablecer#token=…`. El token no llega a los registros del servidor.
- **«¿Has olvidado tu contraseña?»** en el panel municipal.
- **El enlace** dura una hora y sirve una vez.
- **Corregido en la revisión:** el enlace de los espacios municipales sin identificador de origen, como Riosa, usaba un identificador inexistente. Ahora usa el slug del concejo.
- **Mínimo en el servidor:** 12 caracteres en todas las cuentas, al crear, cambiar o restablecer la contraseña. Antes solo lo comprobaba el formulario.

**8. Cartas de los lectores:**
- **Formulario y normas:** `/cartas/enviar`, con normas provisionales en `/normas-cartas`.
- **Qué pide:** nombre, apellidos, DNI o NIE, teléfono, correo y concejo (obligatorio); texto de hasta 2000 caracteres; aceptar las normas y la política de privacidad. Una carta al mes por persona.
- **Recorrido:**
  1. Confirmación por correo.
  2. Pendiente para el periodista del concejo.
  3. El periodista aprueba, corrige o rechaza. El rechazo lleva un motivo obligatorio, que se envía por correo al autor.
- **Dónde salen:** en Opinión («Cartas de los lectores») y en `/cartas`, con nombre, apellidos y concejo, y el aviso «Planta 14 no comparte necesariamente las opiniones de los lectores».
- **Datos personales:** el DNI y el teléfono se guardan **cifrados** (AES-256-GCM, con la clave derivada de `PAYLOAD_SECRET`). Solo los ven la administración y el periodista del concejo. Se borran solos a los 24 meses.

**9. Buzón de sugerencias** en el panel municipal:
- casillas de servicios y un texto libre;
- colección Sugerencias, que ven la administración y el periodista del concejo;
- correo a los dos.

**10. Estadísticas propias:**
- **Qué guardan:** solo contadores por día, página, concejo, sección y procedencia (buscadores, redes, WhatsApp, directo…). Sin cookies, IP ni identificadores.
- **Qué no cuentan:** robots, vistas previas de enlaces, sesiones del CMS ni zonas privadas.
- **Dónde se ven:**
  - panel de la administración en `/cms/estadisticas`;
  - en el panel municipal, solo las de su concejo.
- **Exportación:** CSV y PDF del mes.
- **Medida:** la visita se envía cuando el navegador está libre; el servidor responde en 5–6 ms.

**11. «Útil»**, en `/util` y al final de cada página de concejo. Cumple el ajuste de Pablo: solo **cuatro fuentes automáticas**, con atribución y hora:
- **Puerto de Pajares:** DGT DATEX II, licencia CC BY. Nunca dice «abierto».
- **El tiempo:** AEMET por municipio, solo con clave.
- **Subvenciones:** BDNS, con las de los seis ayuntamientos, el Principado, el IDEPA y el Estado; cada una enlaza a su convocatoria. Más un enlace fijo a «Busca financiación» del IDEPA.
- **Empleo público:** BOE, sección II.B.

San Isidro, Valgrande-Pajares, Fuentes de Invierno, farmacias de guardia, empleo en el BOPA y empleo en los ayuntamientos son **solo enlaces** a su fuente oficial.

Cómo funcionan las fuentes:
- **Caché en la base de datos** (`external_cache`): la página no espera a la fuente salvo la primera vez.
- **Si una fuente falla:**
  - se muestra el último dato con su hora, o un aviso en ese bloque;
  - la administración recibe un correo, como mucho uno cada 12 horas por fuente.

Contenidos propios:
- **Patrimonio:** foto de Commons con autor y licencia, o diseño neutro si no hay.
- **Rutas:** recorrido dibujado con Leaflet sobre OpenStreetMap, desde el GPX directo, el ZIP oficial (sin la variante ciclista) o un PLT con WGS 84. Si no se puede, solo el enlace de descarga.
- **Avisos en el CMS:** «Coordenadas pendientes» y «Dudoso».
- **Directorio de servicios municipales:** lo editan la administración y el ayuntamiento de su concejo desde su panel.

**12. Ocultar servicios de «Útil».**
- Por defecto salen todos.
- Cada ayuntamiento oculta los que quiera en su concejo desde su panel: solo el suyo, con el espacio activo y nunca noticias ni contenido editorial.
- En `/util` desaparece lo de ese concejo.
- En los concejos sin espacio activo decide la administración (CMS → «Útil: servicios ocultos»).

## Fuentes de «Útil»: condiciones de reutilización

Comprobadas por mí y contrastadas con `datos-servicios/fuentes-automaticas.md`.

| Fuente | ¿Se integra? | Motivo |
|---|---|---|
| DGT, NAP DATEX II v3.7 | Sí, solo Pajares (N-630) | El catálogo declara licencia CC BY. Se cita a la DGT y la hora del parte. |
| AEMET OpenData | Sí, con clave | La nota legal permite la reutilización citando a AEMET. Se muestra «© AEMET. Información elaborada por la Agencia Estatal de Meteorología», con la hora de elaboración. |
| BDNS (infosubvenciones.es) | Sí | El aviso legal del SNPSAP y las condiciones generales de reutilización de Hacienda lo permiten, limitando los abusos: consulta cada 6 horas con caché. Se cita la fuente y se indica que la convocatoria oficial es la que vale. |
| BOE (RSS II.B) | Sí | Las condiciones de reutilización del BOE lo permiten con atribución, enlace y fecha, indicando que es una selección y que el texto auténtico es el del BOE. |
| San Isidro (112 Asturias), Valgrande-Pajares, Fuentes de Invierno | **No: solo enlace** | Licencia de reutilización no confirmada. Por indicación de Pablo, sin campos manuales. |
| Farmacias de guardia (COF Asturias) | **No: solo enlace** | El Colegio no ha confirmado el permiso. **Por lo mismo, el importador no carga las 40 farmacias de `servicios-municipales.json`.** |
| BOPA | **No: solo enlace** | No hay API ni RSS de empleo verificados, y la reutilización del portal no está confirmada. |
| Empleo en los seis ayuntamientos | **No: solo enlace** | Son webs y documentos sin canal automático. |

## Importaciones de datos de servicios

Los datos están en la rama `desarrollo/planta14-contenido-ensayo`, **commit `bcc03e0`**:

| Archivo | Registros | Qué se importa |
|---|---|---|
| `datos-servicios/patrimonio.json` | 48 | 48 fichas |
| `datos-servicios/rutas.json` | 34 | 34 rutas |
| `datos-servicios/servicios-municipales.json` | 113 | 73 servicios; las 40 farmacias no se importan (ver arriba) |

**Fotos de patrimonio:**
- 33 fichas traen una foto de Commons: se sube a Imágenes (miniatura de 1920 px) con autor, licencia y la declaración de la administración. Las otras 15 usan el diseño neutro.
- **Comprobado aquí:** el proceso, con fotos simuladas en la prueba.
- **Sin comprobar aquí:** la descarga de las fotos reales. Desde esta máquina Wikimedia devolvía «429, demasiadas peticiones».
- **Si falla en el servidor:** la ficha queda sin foto, con un aviso, y se completa al repetir la importación.

**Coordenadas:**
- 14 fichas de patrimonio no tienen coordenadas WGS84 comprobadas: salen en la lista con «Coordenadas pendientes».
- Dos de ellas traen coordenadas UTM. No se convierten: se guardan como nota.

**Recorridos.** Comprobado con las descargas reales:
- **15 rutas** tienen recorrido dibujado:
  - 12 desde GPX directo;
  - el GR 206, desde su ZIP (2 etapas a pie, sin la variante ciclista);
  - la del ZIP del GR 106, con 3 PLT en WGS 84;
  - otra ruta con un PLT en WGS 84.
- **18 rutas** no tienen descarga oficial.
- **1 ruta** solo tiene un enlace a Wikiloc, que no se descarga.

**Avisos y repetición:**
- Los registros «comprobado con pendientes» o con dudas llevan el aviso «Dudoso» en el CMS, hasta que la redacción marca «Dudas revisadas».
- **Repetible:** se identifica cada registro por su `id`. Lo que ya existe no se duplica ni se modifica (para no pisar lo editado en el CMS); solo se completan la foto o el recorrido que faltaran.

## Qué debe hacer Code local

**1. Correo y clave de AEMET.** En `infra/.env.production`:
- `SMTP_ENABLED=true`, con la contraseña de avisos@planta14.com;
- `AEMET_API_KEY=…`, si Pablo ya tiene la clave. Sin clave, el bloque del tiempo no sale; se puede añadir más tarde y reiniciar la app.

**2. Desplegar el commit indicado.** Igual que siempre: `status.sh`, después `git fetch` y `git checkout --detach 684c787`, y después `deploy.sh`. Aplica las nueve migraciones.

**3. Variables de los comandos siguientes:**

```bash
installed=$(cut -c1-12 /srv/planta14/state/current)
```

```bash
migrate() { APP_IMAGE="planta14-app:$installed" docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -T migrate "$@"; }
```

**4. Cargar los responsables** (una vez; se puede repetir):

```bash
migrate npm run cms:responsables
```

Debe terminar en «RESPONSABLES CARGADOS». Andrés y Juanfran entran la primera vez en `/cms` con «¿Olvidaste tu contraseña?».

**5. Traer los datos de servicios** del commit `bcc03e0`:

```bash
git fetch origin desarrollo/planta14-contenido-ensayo
```

```bash
mkdir -p /tmp/datos-servicios && for f in patrimonio rutas servicios-municipales; do git show bcc03e0:datos-servicios/$f.json > /tmp/datos-servicios/$f.json; done
```

**6. Comprobar las importaciones** (no cambia nada):

```bash
migrate npm run cms:patrimonio:importar -- - --solo-comprobar < /tmp/datos-servicios/patrimonio.json
```

```bash
migrate npm run cms:rutas:importar -- - --solo-comprobar < /tmp/datos-servicios/rutas.json
```

```bash
migrate npm run cms:servicios:importar -- - --solo-comprobar < /tmp/datos-servicios/servicios-municipales.json
```

Deben decir «Se crearían 48 fichas de patrimonio», «Se crearían 34 rutas» y «Se crearían 73 servicios municipales» (con «No se importan: 40 farmacias»).

**7. Importar.** Patrimonio y rutas con `--publicar`, para que salgan ya; sin él, entran sin publicar. Necesita salida a internet hacia `www.turismoasturias.es`, `drive.google.com`, `drive.usercontent.google.com` y `upload.wikimedia.org`.

```bash
migrate npm run cms:patrimonio:importar -- - --publicar < /tmp/datos-servicios/patrimonio.json
```

```bash
migrate npm run cms:rutas:importar -- - --publicar < /tmp/datos-servicios/rutas.json
```

```bash
migrate npm run cms:servicios:importar -- - < /tmp/datos-servicios/servicios-municipales.json
```

Lee los «AVISOS» del final:
- Si faltan fotos o recorridos por un fallo de descarga (por ejemplo, un 429 de Wikimedia), repite el mismo comando más tarde: completa solo lo que falte.
- Si GPT amplía los datos, repite los pasos 5 a 7 con el commit nuevo: solo se crean los registros nuevos.

**8. Precargar fiestas** (opcional, si Pablo da un JSON con el formato de `docs/ejemplos/fiestas.json`):

```bash
migrate npm run cms:fiestas:importar -- - --solo-comprobar < fiestas.json
```

```bash
migrate npm run cms:fiestas:importar -- - < fiestas.json
```

**9. Tarea programada** (opcional; el borrado ya se hace solo al recibir cartas y al abrir el CMS). Borra el DNI y el teléfono de las cartas de más de 24 meses. Añade al cron:

```
20 4 * * * cd /srv/planta14/app && APP_IMAGE="planta14-app:$(cut -c1-12 /srv/planta14/state/current)" docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -T migrate npm run cms:cartas:caducar >> /var/log/planta14-cartas.log 2>&1
```

**10. Comprobar en el navegador** (con correos propios; borra después lo de prueba):
- **Contraseña:** en `/mieres/panel`, «¿Has olvidado tu contraseña?» con la cuenta de Mieres. Comprueba que llega el correo, que el enlace abre `/mieres/panel/restablecer`, que se cambia la contraseña y que entra en el panel. El mismo enlace, otra vez, debe decir que no vale.
- **Cartas:**
  1. Envía una desde `/cartas/enviar` y confírmala.
  2. Comprueba que le llega al periodista del concejo.
  3. Apruébala y mira Opinión.
  4. Envía otra y recházala con un motivo: debe llegar el correo.
- **Sugerencias:** envía una desde un panel municipal; debe aparecer en el CMS y llegar el correo.
- **Estadísticas:** visita varias páginas sin sesión y mira `/cms/estadisticas` y su CSV y PDF.
- **Útil:**
  - `/util` y `/lena#util`, con Pajares, tiempo (si hay clave), subvenciones, empleo y enlaces;
  - una ficha de patrimonio con foto y otra sin ella;
  - una ruta con recorrido (por ejemplo, la del Ferrocarril de Baltasara) y una sin descarga;
  - en el CMS, las columnas «Revisión».
- **Ocultar:** desde un panel municipal, desmarca un servicio, guarda y comprueba la página del concejo. Después déjalo como estaba.
- **Responsables, fiestas, boletín, última hora y CMS:** como en el apartado de esos bloques del manual.

## Resultados de la batería completa

**Primera pasada, completa** (sobre `38f2467`):

| Prueba | Resultado |
|---|---|
| `npm test`, `npm run typecheck`, `npm run build` | Correctos |
| `npm run lint` | 0 errores, 16 avisos de estilo (`<img>` en lugar de `<Image>` y similares) |
| `test:block3` | 17 PASS |
| `test:launch` | 6 PASS |
| `test:instalacion` | 16 PASS |
| `test:ensayo` | 8 PASS |
| `test:formulario` | 3 PASS |
| shellcheck, Caddy (acme e internal), `common-test`, `staging-config-test`, `monitor-test`, `memory-test` | Correctos |
| `restore-test.sh` (como root, con la imagen de staging y como usuario sin privilegios) | SUPERADA las tres veces, sin volúmenes ni restos |
| `offsite-immutable-test`, `pruebas-config-test`, `preproduccion-test`, `postgres-roles-test`, `staging-guard-test` | SUPERADAS |
| Imagen de staging y `staging-e2e.sh` | SUPERADO |
| `production-deploy-test.sh` | **Falló**: ver abajo |
| `test:block2` | **Falló**: ver abajo |
| `test:portada` | **Falló**: ver abajo |
| `test:participacion` | **Falló**: ver abajo |

**Fallos y arreglos** (commits `4865c32` y `684c787`):

| Prueba | Qué pasaba | Arreglo |
|---|---|---|
| `production-deploy-test.sh` | La comprobación «en mantenimiento no cambia ningún dato» contaba la caché de «Útil». Esa caché se escribe al servir páginas públicas, también en mantenimiento. | La caché (`external_cache`) y los contadores de visitas (`stats_daily`) no son contenido: ya no cuentan en esa comprobación. En la segunda repetición, la máquina de pruebas se quedó sin disco por la caché de Docker; liberada, pasa. |
| `test:block2` | Compara la página de cada concejo en demo y con el CMS real; «Útil» solo existe con el CMS real. | La prueba excluye la sección «Útil». |
| `test:portada` | En móvil, en la página del concejo había textos de «Útil» de 12 px y enlaces pequeños (de «Útil» y del formulario del boletín del pie, que venía del bloque del boletín y no había pasado por esta prueba). | Textos de al menos 13 px y zonas táctiles de 44 px (24 px dentro de una frase). En las casillas, la zona de toque es su etiqueta, que ya medía 44 px. El campo trampa contra robots, oculto, no cuenta. |
| `test:participacion` | No llegó a arrancar: un servidor de una ejecución anterior ocupaba el puerto. Al repetirla, la última comprobación leyó «Cargando...» en una lista del CMS. | La prueba espera a que la lista pinte la fecha. |

**Repetición sobre `684c787`** (todas correctas):

| Prueba | Resultado |
|---|---|
| `production-deploy-test.sh` | **Ensayo de producción SUPERADO**: 125 comprobaciones. Aplica las nueve migraciones nuevas; los dos «FALLO: /api/health» del registro son de las versiones de ensayo que deben fallar a propósito. Pico de memoria del contenedor de migraciones: 304 MiB de 768 MiB. |
| `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` | Correctos; lint con 0 errores y 16 avisos |
| `test:block2` | 8 PASS |
| `test:portada` | 9 PASS. Portada en móvil: 1103 KiB de imágenes al abrir, 2254 KiB recorrida entera. |
| `test:participacion` | **29 PASS**: responsables, contraseñas (incluido el recorrido real en el navegador: pedir el correo, abrir el enlace, cambiar la contraseña y entrar en el panel municipal), cartas, sugerencias, estadísticas, «Útil» (importadores, fotos, avisos, recorridos dibujados, fuentes y sus fallos, directorio), ocultar servicios, fiestas, boletín, última hora, Discover y fechas. Baliza de estadísticas: mediana de 8,4 ms. Los tres archivos reales de `bcc03e0` se validan sin errores (48, 34 y 73 registros). |

## Sin comprobar

- **El correo real desde IONOS:** las pruebas usan un buzón de archivo. No se ha comprobado la entrega real, el spam ni el «Cancelar suscripción» de los programas de correo.
- **Fuentes reales con la web desplegada:**
  - **AEMET:** sin clave, solo se ha probado con un servidor simulado con su formato.
  - **BDNS:** dejó de responder desde aquí durante el desarrollo; se ha probado con su formato real y un servidor simulado.
  - **DGT y BOE:** se han leído sus datos reales.
- **Fotos reales de Commons:** limitadas aquí por Wikimedia (429).
- **Textos legales:** las normas de las cartas son provisionales. La política de privacidad tiene ya las cartas, el boletín, las fiestas y el contador de visitas, pero conserva los huecos que tenía; debe revisarla quien lleve la parte legal antes de abrir las cartas y el boletín al público.
