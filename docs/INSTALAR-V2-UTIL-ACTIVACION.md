# Instalar «Útil» por concejo, la activación de concejos y «Fiestas esta semana»

Rama **`desarrollo/planta14-v2-util-activacion`**, creada desde `desarrollo/planta14-v2-pie` (`6541bf7`). **Commit a instalar: `@COMMIT@`** (`@COMMIT_LARGO@`). El commit siguiente solo añade documentación: este documento. No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

Incluye todo lo de `desarrollo/planta14-v2-pie` y `desarrollo/planta14-v2-correcciones`. **Si en pruebas todavía no está instalado `c708a4e`**, puedes desplegar directamente este commit: aplica también las migraciones anteriores. Si vienes de antes de `1e0985a`, haz además los pasos 4 a 8 de `docs/INSTALAR-V2-CORRECCIONES.md` (variables, importaciones de servicios y fiestas).

> @BATERIA_RESUMEN@

## Qué cambia

| Punto | Cambio |
|---|---|
| 1a. Cajas de 5 y «Ver todos» | Cada caja de «Útil» enseña **5 elementos como máximo** (primero los más completos: con foto, recorrido o mapa) y debajo **«Ver todos (n)»**. Lleva a una página por tipo y concejo: `/lena/util/servicios`, `/lena/util/patrimonio`, `/lena/util/rutas`, `/lena/util/subvenciones` y `/lena/util/empleo`. Tienen la lista completa, una búsqueda, un filtro por tipo y una sola columna cómoda en el móvil. Las ayudas y el empleo generales tienen la suya en `/util/subvenciones` y `/util/empleo`. |
| 1b. Columnas sin huecos | Las cajas van en columnas de CSS (tipo *masonry*): sin huecos y con el mismo orden de lectura, de arriba abajo en cada columna. Hay 3 columnas a 1440 y 1024 px, 2 a 768 px y 1 a 390 px. Comprobado en `/util` y en los seis concejos. |
| 2. Concejo **no activo** | Su página muestra solo la cabecera, las **noticias de Planta 14** de ese concejo y «Fiestas esta semana». Desaparecen «Útil», los avisos, la agenda municipal, el tablón, las ayudas, la foto de cabecera, las tarjetas fijas y el enlace «Historias del Caudal». Sus páginas `/<concejo>/util/…` y las fichas de patrimonio y rutas de ese concejo dan **404** y no están en el sitemap. Sus eventos municipales salen de `/agenda`. |
| 2. Concejo **activo** | Todo, respetando lo que haya ocultado en «Útil». |
| 2. `/util` | Siempre lo regional: Pajares (DGT), el tiempo (AEMET), las ayudas y el empleo generales (BDNS y BOE) y el enlace de farmacias. Debajo, **un bloque por cada concejo activo**, con sus listas («Servicios municipales (n)», «Patrimonio (n)»…) y el enlace de empleo de su ayuntamiento. |
| 2. Sin redesplegar | Activar o desactivar un concejo, o cambiar lo que oculta, se ve **al momento**. Las páginas se generan en cada petición y, al guardar en el CMS, la web se revalida. Lo importado se queda en el CMS; solo cambia lo que se publica. |
| 3. «Fiestas esta semana» | En la portada (sustituye a «De fiesta este fin de semana» y «Próximas fiestas») y en la página de su concejo. Cada fiesta sale desde **7 días antes** de empezar hasta su último día. Los días se cambian en el ajuste global **«Fiestas en portada»** (0 a 30, lo cambia la redacción). Sin fiestas, el bloque no sale. Nunca salen borradores ni «Fecha pendiente». `/fiestas` y la agenda siguen igual. |
| Cabecera a 768 px | La fila de secciones de la cabecera general («Útil» al final) se salía de la pantalla entre 768 y unos 900 px. Ahora pasa a una segunda línea. |

**Migración nueva:** `20261105_102329_util_activacion`. Solo crea la tabla del ajuste «Fiestas en portada» y se aplica sola al desplegar. Hasta que alguien lo guarde, la web usa 7 días. Sin variables nuevas en el `.env`.

**Importante antes de desplegar.** Con esta versión, **los concejos sin espacio activo dejan de mostrar «Útil»**. En pruebas, revisa en CMS → **Municipal Spaces** cuáles están en `active`. Si quieres seguir viendo «Útil» de un concejo durante las pruebas, actívalo (manual, apartado 24).

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

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente. **Anota la versión actual**: es a la que se vuelve si algo falla.

**2. Fijar el commit y desplegar:**

```bash
git fetch origin desarrollo/planta14-v2-util-activacion
```

```bash
git checkout --detach @COMMIT_LARGO@
```

```bash
git log -1 --format='%h %s'
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production @COMMIT_LARGO@
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0, y aplicar la migración `20261105_102329_util_activacion` (y las anteriores que falten):
- **código 1:** ha vuelto sola a la versión anterior;
- **código 2:** restauración asistida (`docs/MANUAL-OPERACION.md`, apartado 9).

**3. Comprobar:**

```bash
curl -s https://pruebas.planta14.com/api/health
```

Debe dar `"status":"ok"`. Lo demás se comprueba en el navegador (apartado siguiente), porque la web de pruebas pide la contraseña de preproducción.

**4. Si algo falla: volver a la versión anterior.** Si `deploy.sh` terminó con código 1 o 2, sigue lo que dice. Si el despliegue fue bien pero algo no funciona después, vuelve a desplegar la versión anotada en el paso 1. Por ejemplo, la del pie:

```bash
git checkout --detach c708a4ebd0af47728ab2c975c69ddefe4529e4a0
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production c708a4ebd0af47728ab2c975c69ddefe4529e4a0
```

La migración nueva solo **crea** una tabla de ajuste que la versión anterior no usa, así que no hace falta deshacerla. La versión anterior vuelve a mostrar «Útil» en todos los concejos y el bloque de fiestas antiguo. No se borra ningún dato: la activación solo cambia lo que se publica.

## Qué mirar en el navegador

- **Un concejo activo** (por ejemplo, el que tengas en `active`):
  - al final de su página, «Útil» en columnas sin huecos;
  - cada caja con 5 elementos como máximo y «Ver todos (n)»;
  - en «Ver todos»: la lista completa, la búsqueda y los filtros por tipo, también en el móvil.
- **Un concejo no activo:**
  - solo la cabecera, las noticias de Planta 14 y, si las hay, «Fiestas esta semana»;
  - `/<concejo>/util/servicios` da «Página no encontrada».
- **Activar y desactivar** (CMS → Municipal Spaces → Subscription → Status) y recargar: el cambio se ve al momento. Después déjalo como estaba.
- **`/util`:**
  - Pajares, el tiempo, ayudas, empleo y farmacias;
  - debajo, un bloque por concejo activo, y ninguno de los inactivos.
- **Portada:**
  - «Fiestas esta semana» con las fiestas confirmadas de los próximos 7 días;
  - si no hay ninguna, no sale.
  En CMS → Globales → **Fiestas en portada**, sube los días, guarda y recarga para ver más. Después vuelve a 7.
- **Anchos:** en el ordenador, en una tableta en vertical y en el móvil, `/util` y un concejo sin barra de desplazamiento horizontal.

## Resultados de la batería completa

@BATERIA@

## Dudas resueltas por prudencia

1. **Qué cuenta como «lo más útil» en cada caja:**
   - **servicios:** el orden que fija el CMS (campo «Orden»), como hasta ahora;
   - **patrimonio y rutas:** primero los que tienen foto, después los que tienen recorrido o punto en el mapa, y luego por nombre;
   - **ayudas:** por fecha de cierre;
   - **empleo:** por fecha del BOE.
   No me invento una puntuación.
2. **«Ver todos (n)»:** sale siempre que la caja tiene elementos, aunque sean 5 o menos. Así la lista completa, con búsqueda y filtros, se encuentra siempre en el mismo sitio.
3. **Rutas compartidas:** una ruta de un concejo **inactivo** que pasa por uno activo **no se publica** en el activo, porque su ficha pertenece al inactivo y daría 404.
4. **Fichas de patrimonio y rutas:** dan 404 si su concejo está inactivo **o si ese concejo ha ocultado** ese servicio. Antes, al ocultarlo, salían de las listas pero la ficha seguía abierta.
5. **`/util/patrimonio` y `/util/rutas`:**
   - se mantienen, solo con los concejos activos;
   - el filtro de un concejo inactivo da 404;
   - en `/util`, el patrimonio y las rutas van en el bloque de cada concejo, no en una caja general.
6. **Qué queda en la página de un concejo no activo:**
   - **se quitan** las tarjetas fijas («todo el año»), el enlace «Historias del Caudal» y la foto de cabecera, porque no son noticias;
   - **se mantiene** «Fiestas esta semana», porque es contenido editorial;
   - **se mantienen** los créditos del escudo, porque los exige su licencia.
7. **Eventos municipales en `/agenda`:** se quitan los de concejos inactivos, porque son «agenda municipal».
8. **«Fiestas en portada»:** lo puede cambiar la **redacción** (no solo la administración), porque las fiestas son editoriales. Máximo 30 días.
9. **La portada antes mostraba «Próximas fiestas»** cuando no había ninguna el fin de semana. Ahora, como pide el encargo, si no hay fiestas en los próximos 7 días el bloque no sale.
10. **Revalidación:** las páginas ya se generan en cada petición, así que el cambio se ve sin hacer nada. Aun así, al guardar un espacio municipal o lo que oculta un concejo, se revalida toda la web (`revalidatePath`), por si en el futuro alguna página pasa a tener caché.
11. **Cabecera a 768 px:** la fila de secciones se salía de la pantalla en `/util` y en cualquier página con la cabecera general. Es un fallo anterior que salió en la comprobación de anchos pedida. Lo corrijo dejando que pase a una segunda línea.
