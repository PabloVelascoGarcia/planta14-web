# Instalar las correcciones tras el despliegue de 684c787 en pruebas

Rama **`desarrollo/planta14-v2-correcciones`**. **Commit a instalar: `1e0985a`** (`1e0985a3062e244a8c2aeb7e3323917c5d697163`). El commit siguiente solo añade este documento. No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

> **Batería completa: pasada entera, a la primera, sobre `1e0985a`.** Ver los resultados abajo.
>
> **CI:** el run #85 (`01a0a43`) falló en «Imagen de la app» por falta de memoria al compilar; está corregido en `1e0985a` y el run #86 está en verde en los dos jobs. Ver «Fallo del CI» abajo.

## Qué cambia

| Punto | Cambio |
|---|---|
| 1. Variables | `AEMET_API_KEY` y `UTIL_BDNS_REFRESH_HOURS` llegan al contenedor: están en `x-app-env` de `infra/compose.production.yaml` y de `infra/compose.staging.yaml`. Ver la revisión completa abajo. |
| 2. Importadores | Antes de escribir nada (también con `--solo-comprobar`), los importadores de servicios, patrimonio, rutas y fiestas validan cada registro contra el **esquema real** de su colección: obligatorios, longitudes, valores de las listas, números y fechas. Informan de **todos** los errores de una vez. El horario de los servicios admite **500 caracteres**. Son **idempotentes** por identificador. |
| 3. Fiestas | El importador acepta el **catálogo** `contenido-ensayo/fiestas-caudal.json` (`034b853`). Las 46 fiestas entran **en borrador**: 35 con «Fecha pendiente» y 11 con «Fecha orientativa (2025)», nunca con fechas de 2026 o 2027. Campo nuevo **«Estado de la fecha»**, visible y filtrable en el CMS. Una fiesta en borrador o sin fecha confirmada **no sale nunca** en la web, en la agenda ni en la API pública, y no se puede publicar sin confirmar sus fechas. |
| 4. BDNS y demás fuentes | **Ninguna visita consulta la BDNS, la DGT, la AEMET ni el BOE.** Un refresco en el servidor renueva la caché: BDNS cada 6 horas (`UTIL_BDNS_REFRESH_HOURS`), BOE cada 3 horas, AEMET cada 2 horas y DGT cada 5 minutos. Ante un 429 o un 5xx reintenta con espera creciente y respeta `Retry-After`. Si falla, sirve la última copia buena con su fecha. Los errores quedan en el registro, sin datos personales ni la clave de AEMET. La BDNS va petición a petición, con pausa, y reutiliza 24 horas el detalle de cada convocatoria. |

**Migración nueva:** `20261105_081647_correcciones`. Se aplica sola al desplegar. Añade:
- en Fiestas: estado de la fecha, fecha orientativa, fechas habituales, descripción, fuentes, notas e identificador del catálogo;
- en la caché: la columna `attempts`.

Las fiestas que ya existen quedan con «Confirmada». El horario de los servicios no necesita cambiar la columna: ya era `varchar` sin límite y el máximo lo aplica la aplicación.

### Revisión de variables (punto 1)

He comparado todas las `process.env.*` del código con `.env.example`, `infra/.env.*.example` y el `x-app-env` de los dos `compose`.

| Variable | Antes | Ahora |
|---|---|---|
| `AEMET_API_KEY` | En ningún `compose` ni ejemplo: **no llegaba al contenedor** | En los dos `compose` (vacía por defecto) y en los tres ejemplos |
| `UTIL_BDNS_REFRESH_HOURS` (nueva) | — | En los dos `compose` (6 por defecto) y en los ejemplos |
| `SMTP_ENABLED`, `SMTP_PASSWORD` | Solo en producción | También en staging (`false` y vacía por defecto) |
| `MUNICIPAL_NOTICE_EMAIL_ENABLED`, `MUNICIPAL_NOTICE_EMAIL_TO` | Solo en producción | También en staging (`false` y vacía) |

El resto de las que faltan en los `compose` no son de la aplicación en marcha:
- **Pruebas:** `CMS_*_TEST`, `PARTICIPACION_*`, `PLANTA14_TEST_*`, `AEMET_BASE_URL`, `UTIL_*_URL`, `UTIL_REFRESH_*`, `UTIL_RETRY_BASE_MS`, `UTIL_BACKOFF_BASE_MS` y `UTIL_BDNS_PAUSE_MS`.
- **Demo o Netlify:** `CMS_ADMIN_*`, `CMS_REDACTOR_*`, `CMS_AUTH_SECRET`, `DEMO_CONTENT`, `CMS_DEMO_DATA_DIR`, `CONTEXT`, `URL` y `DEPLOY_PRIME_URL`.
- **Lanzadores y scripts**, que las fijan ellos mismos: `FIESTAS_*`, `UTIL_IMPORT_*`, `ENSAYO_*`, `CMS_BOOTSTRAP_*`, `IMPORT_MUNICIPAL_DEMO` y `MALLOC_ARENA_MAX`.
- **Compilación:** `LOW_MEMORY_BUILD`.
- **`MAINTENANCE_FLAG_FILE`:** ya va en el servicio `app` de producción.

### Fallo del CI de `01a0a43` (exit 134) y arreglo

**Causa real:** falta de memoria de Node al compilar la imagen, provocada por `instrumentation.ts`, que se añadió en este mismo encargo para arrancar el refresco de fuentes.
- `instrumentation.ts` importaba `lib/util-sources`, y Next compila esa entrada aparte con todo el grafo de Payload.
- El montón de Node que fija `infra/app.Dockerfile` (`--max-old-space-size=768`) se agotaba a los 40–55 s de `next build` («JavaScript heap out of memory», `Aborted`, código 134).
- Reproducido aquí con los mismos ajustes del Dockerfile: `01a0a43` aborta y, sin ese archivo, compila.

**Arreglo (`1e0985a`):**
- Se quita `instrumentation.ts`.
- El refresco se arranca una vez por proceso desde `/api/health`, que `deploy.sh` consulta nada más desplegar y luego el monitor, y al leer «Útil».
- Nunca arranca durante la compilación ni sin CMS.

**Memoria:**
- `NODE_OPTIONS` sigue en 768 MiB, el límite del constructor del VPS M+ (1.280 MiB de RAM más swap, `docs/PUESTA-EN-MARCHA-IONOS.md`, apartado 5).
- Pico de la compilación medido en contenedor, con los mismos ajustes del Dockerfile: **1.965 MiB** con `1e0985a` frente a **1.899 MiB** con `684c787`, la versión que ya se construyó en el VPS (+3,5 %).
- Imagen construida con Docker y sin caché, correcta.

**Las fuentes no se consultan al compilar:** las páginas de «Útil», concejos y fiestas son dinámicas (`ƒ` en la salida de `next build`) y solo leen la caché en ejecución. El registro de la compilación no tiene ninguna consulta a BDNS, DGT, AEMET ni BOE. Sin caché, la página sale con su aviso.

## Pasos en pruebas.planta14.com

Desde el PC de Pablo, con el agente SSH cargado.

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

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente, y versión actual `684c787…`. **Anota la versión actual**: es a la que se vuelve si algo falla.

**2. Comprobar el `.env`** (sin mostrar la clave):

```bash
grep -c '^AEMET_API_KEY=.\+' infra/.env.production
```

Debe dar `1`. Si da `0`, añade la línea `AEMET_API_KEY=` con la clave al final de `infra/.env.production`; Pablo la pone directamente, sin pasarla por el chat. Si quieres otro intervalo para la BDNS, añade `UTIL_BDNS_REFRESH_HOURS=6` (es el valor por defecto).

**3. Fijar el commit y desplegar:**

```bash
git fetch origin desarrollo/planta14-v2-correcciones
```

```bash
git checkout --detach 1e0985a3062e244a8c2aeb7e3323917c5d697163
```

```bash
git log -1 --format='%h %s'
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production 1e0985a3062e244a8c2aeb7e3323917c5d697163
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0, y aplicar la migración `20261105_081647_correcciones`:
- **código 1:** ha vuelto sola a la versión anterior;
- **código 2:** restauración asistida (`docs/MANUAL-OPERACION.md`, apartado 9).

**4. Comprobar que la clave de AEMET llega al contenedor y que AEMET responde** (no muestra la clave, solo su longitud):

```bash
docker compose -f infra/compose.production.yaml --env-file infra/.env.production exec -T app node -e 'const k=process.env.AEMET_API_KEY||""; console.log(k ? `AEMET_API_KEY definida (${k.length} caracteres)` : "AEMET_API_KEY VACÍA"); if (k) fetch("https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/diaria/33037",{headers:{api_key:k}}).then(r=>r.json()).then(j=>console.log("AEMET:", j.estado, j.descripcion)).catch(e=>console.log("AEMET sin respuesta:", e.message))'
```

Debe decir `AEMET_API_KEY definida (… caracteres)` y `AEMET: 200 exito`. Con 401, la clave no es válida o ha caducado; con 429, AEMET está limitando: espera y repite.

**5. Variables de los comandos siguientes:**

```bash
installed=$(cut -c1-12 /srv/planta14/state/current)
```

```bash
migrate() { APP_IMAGE="planta14-app:$installed" docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -T migrate "$@"; }
```

**6. Relanzar los servicios municipales** (los 7 que faltaron):

```bash
git fetch origin desarrollo/planta14-contenido-ensayo
```

```bash
mkdir -p /tmp/datos-servicios && git show bcc03e0:datos-servicios/servicios-municipales.json > /tmp/datos-servicios/servicios-municipales.json
```

```bash
migrate npm run cms:servicios:importar -- - --solo-comprobar < /tmp/datos-servicios/servicios-municipales.json
```

Debe decir «Se crearían 7 servicios municipales», «No se importan: 40 farmacias» y «Ya existían 66», sin errores. Si sale algún error, para aquí y pásamelo. Después, de verdad:

```bash
migrate npm run cms:servicios:importar -- - < /tmp/datos-servicios/servicios-municipales.json
```

Debe decir «Creados 7 servicios municipales» e «IMPORTACIÓN TERMINADA». Repetirlo después debe dar «Creados 0».

**7. Importar las fiestas** (46 borradores):

```bash
git show 034b853:contenido-ensayo/fiestas-caudal.json > /tmp/fiestas-caudal.json
```

```bash
migrate npm run cms:fiestas:importar -- - --solo-comprobar < /tmp/fiestas-caudal.json
```

Debe decir:
- «Formato: catálogo de fiestas»;
- «Se crearían 46 fiestas como borrador»;
- «De ellas: 35 con «Fecha pendiente» y 11 con «Fecha orientativa (2025)»»;
- sin errores.

Después, de verdad, **sin `--publicar`** (el catálogo lo rechaza):

```bash
migrate npm run cms:fiestas:importar -- - < /tmp/fiestas-caudal.json
```

Debe decir «Creadas 46 fiestas como borrador». Repetirlo debe dar «Creadas 0» y «Ya existían 46».

**8. Comprobar la caché de la BDNS** y de las demás fuentes (unos minutos después de desplegar):

```bash
docker compose -f infra/compose.production.yaml --env-file infra/.env.production exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "${POSTGRES_DB:-planta14}" -c "SELECT key, fetched_at, checked_at, attempts, left(error, 60) AS error FROM external_cache ORDER BY key"'
```

Debe haber una fila por fuente: `bdns:abiertas`, `boe:empleo`, `dgt:pajares` y, con clave, seis `aemet:…`.
- **Sin error:** `fetched_at` es reciente y `attempts` vale 0.
- **Si la BDNS sigue con 429:** `error` lo dice y `attempts` crece. La web sigue mostrando la última copia buena con su fecha, o «Ahora mismo no podemos consultar…» si nunca la hubo. El refresco reintenta solo, con espera creciente.

Los avisos del registro:

```bash
docker compose -f infra/compose.production.yaml --env-file infra/.env.production logs --since 30m app | grep -i 'Útil:' | tail -20
```

Muestran la fuente, el código HTTP y el intento; nunca la clave ni datos personales. Para comprobar que las visitas no llaman a la BDNS, recarga varias veces `/util` y `/lena`: `checked_at` de `bdns:abiertas` no debe cambiar.

**9. Si algo falla: volver a la versión anterior.**

Si `deploy.sh` terminó con código 1 o 2, sigue lo que dice (vuelta automática o restauración asistida, `docs/MANUAL-OPERACION.md`, apartado 9).

Si el despliegue fue bien pero algo no funciona después, vuelve a desplegar la versión anotada en el paso 1:

```bash
git checkout --detach 684c7870909483032c3a6706d919d4a7f2670593
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production 684c7870909483032c3a6706d919d4a7f2670593
```

La migración nueva solo **añade** columnas, con valores por defecto, así que la versión anterior funciona con la base ya migrada; no hace falta deshacerla. Las fiestas importadas siguen en borrador y la versión anterior tampoco las publica. Si quieres retirarlas, bórralas desde el CMS: en Fiestas, filtra por «Estado de la fecha».

## Qué mirar en el navegador

- **`/util` y `/lena#util`:**
  - el bloque **El tiempo** aparece, con «© AEMET» y la hora de elaboración;
  - **Subvenciones**, con su fecha de consulta;
  - si la BDNS no responde, el aviso, no un error de la página.
- **`/ribera-de-arriba#util`:** en Servicios municipales, el centro de interpretación con su horario largo completo.
- **CMS → Fiestas:**
  - la columna «Estado de la fecha»; filtra por «Fecha pendiente» (35) y por «Fecha orientativa (2025), sin confirmar» (11);
  - abre una orientativa: la fecha de 2025 sale como referencia, sin fechas en «Primer día» ni «Último día»;
  - intenta publicarla sin cambiar nada: debe decir que hay que confirmar las fechas;
  - pon fechas reales y «Confirmada»: ya se puede publicar.
- **`/fiestas`, `/agenda` y la portada:** ninguna de las 46 fiestas del catálogo mientras sigan en borrador.
- **CMS → Servicios municipales:** 73 servicios y ninguna farmacia.

## Resultados de la batería completa (sobre `1e0985a`)

| Prueba | Resultado |
|---|---|
| `production-deploy-test.sh` | **SUPERADO.** Construye la imagen en el servidor de ensayo y aplica la migración nueva. Pico del contenedor de migraciones: 292 MiB de 768. |
| `npm test`, `typecheck`, `lint`, `build` | Correctos; lint con 0 errores y 16 avisos de estilo |
| `test:block2` / `block3` / `launch` / `instalacion` | 8 / 17 / 6 / 16 PASS |
| `test:ensayo` / `formulario` / `portada` | 8 / 3 / 9 PASS |
| `test:participacion` | **31 PASS**, con los nuevos: validación de importadores con todos los errores de una vez, idempotencia (solo se crea lo que falta), catálogo de fiestas (46, todas borrador, nunca públicas), refresco en el servidor con 429, reintentos y reutilización del detalle de la BDNS |
| shellcheck, Caddy (acme e internal), `common-test`, `staging-config-test`, `monitor-test`, `memory-test`, `staging-guard-test` | Correctos |
| `restore-test.sh` (root, imagen de staging y usuario sin privilegios), `offsite-immutable-test`, `pruebas-config-test`, `preproduccion-test`, `postgres-roles-test` | SUPERADAS, sin volúmenes nuevos ni restos |
| Imagen de staging y `staging-e2e.sh` | SUPERADO |

## Dudas resueltas por prudencia

1. **Punto de partida de la rama:** la creé desde la punta de `desarrollo/planta14-v2-participacion` (`2422ffa`), no desde `684c787`. El código es idéntico; `2422ffa` solo añade los manuales y el documento de instalación de esa rama, que así no se pierden.
2. **«Con su migración» del horario:** en PostgreSQL la columna ya es `varchar` sin límite; el máximo de 500 lo aplica la aplicación. La migración nueva lo documenta y no cambia la columna, porque no hace falta.
3. **«Lo salta o lo actualiza»:** elegí **saltar** los registros que ya existen (por su identificador), sin pisar lo que se haya editado en el CMS. Solo se completan la foto o el recorrido que faltaran.
4. **Fiestas con fecha de 2025:** además de las 35 «Fecha pendiente», las 11 con alguna fecha de 2025 tampoco tienen fecha confirmada. Quedan con un estado aparte, «Fecha orientativa (2025)», también filtrable, y con la referencia en texto. Ninguna tiene «Primer día» ni «Último día» hasta que un periodista las confirme.
5. **Publicar una fiesta:** solo se puede con «Estado de la fecha: Confirmada» y las fechas rellenas; si no, el CMS lo rechaza con un mensaje. La web, la agenda y la API pública solo muestran fiestas publicadas y confirmadas.
6. **Datos de las fiestas que no se publican:** actos habituales, carteles, dudas, verificación, fuentes y la fecha orientativa son solo para la redacción. Se publican el nombre, el pueblo, el concejo, la descripción y, al confirmarlas, las fechas.
7. **Variables de staging:** además de `AEMET_API_KEY`, añadí al `compose` de staging las de correo que solo estaban en producción, con valores por defecto apagados. No cambia nada si no se rellenan.
8. **Arranque del refresco:** sin `instrumentation.ts`, arranca con la primera consulta a `/api/health` (la hace `deploy.sh` al desplegar y luego el monitor) o a una página de «Útil». Tras reiniciar el contenedor sin desplegar, arranca con la primera consulta del monitor.
9. **El refresco y el modo mantenimiento:** el refresco escribe en la caché también en mantenimiento. No es contenido y la comprobación del ensayo ya lo excluía; solo actualiza datos públicos de fuentes externas.
