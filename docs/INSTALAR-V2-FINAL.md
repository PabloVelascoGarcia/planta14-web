# Instalar la versión final de salida (4 de diciembre)

Para Claude Code en el PC de Pablo (Code local), con el agente SSH cargado.

Rama **`desarrollo/planta14-v2-final`**, creada desde `desarrollo/planta14-v2-pulido` (`ee2d9a1`). **Commit a instalar: `d7d348f`** (`d7d348fcb9f873307b9f8ed5afa3c5f602c1c9fe`). El commit siguiente solo completa este documento. No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

Se instala sobre `a66deb2` (pulido), que es lo que hay en pruebas, o sobre cualquier versión anterior de la v2: aplica las migraciones que falten.

> **Batería completa: una pasada sobre `6614b28`.** Todo correcto salvo tres suites. `block2` y `ensayo` esperaban detalles de antes. `participacion` no pudo arrancar porque había un servidor de una prueba anterior ocupando su puerto. `d7d348f` solo cambia la clase del aviso de la demo en el pie y esas pruebas; repetidas las tres, correctas (participación, 41 PASS).

**Principio:** en la portada manda el periódico, con menos estructura y más contenido. Los espacios municipales de pago son el escaparate del ayuntamiento y conservan su identidad (foto, escudo, colores y lema).

## Qué cambia

### A. Imprescindible para la salida

| Punto | Cambio |
|---|---|
| 1. Concejo inactivo | Es una **página del periódico**: título («Morcín»), «Noticias de Morcín en Planta 14» y «Fiestas esta semana» si las hay, con la cabecera de Planta 14. Sin escudo, sin «Espacio municipal en Planta 14» ni lemas. Al activarse, vuelve sola su página municipal completa. |
| 2. «Tu ayuntamiento, aquí» | Solo sale si hay algún espacio activo; vuelve sola al activar uno. |
| 3. Fiestas | Despublicar, guardar como borrador y cambiar el estado de la fecha funcionan siempre. «Para publicar la fiesta, confirma sus fechas…» solo salta al **publicar** un borrador. Si una publicada pasa a «Pendiente», «Orientativa» o «Por regla», se despublica sola y deja un **Aviso** en el CMS. El mismo fallo estaba en la comprobación de derechos de las imágenes (noticias, contenido municipal, espacios y fiestas): corregido igual. |
| 4. Tablas legales | `/privacidad` y `/cookies`: cada tabla se desplaza en horizontal dentro de su caja; la página ya no se sale a 390 px. |
| 5. Sin GA4 | Fuera Google Analytics 4 del texto, del código (banner, consentimiento) y de los ajustes (`GA4_MEASUREMENT_ID`). La web no pone cookies a los lectores, no necesita banner y no carga nada de terceros. Para eso, los mapas de OpenStreetMap de las fichas se cargan solo al pulsar «Ver el mapa». El resto del texto legal y su aviso de revisión, igual. |

### B. «Útil», más útil y compacto

| Punto | Cambio |
|---|---|
| 6. Página del concejo activo | Al final, un **resumen compacto**: el tiempo de hoy y mañana con iconos, el puerto (Pajares en Lena, San Isidro en Aller), farmacias, una fila de accesos con recuento (Servicios 18 · Patrimonio 8 · …) y «Todo lo útil de [concejo]». Sin listas largas. Respeta lo oculto. |
| 7. `/[concejo]/util` | Página nueva con todo lo útil del concejo, dentro de su espacio municipal: cajas con «Ver todos» y columnas igualadas. 404 si está inactivo; en el sitemap solo si está activo. |
| 8. Pestaña «Útil» | En la barra del espacio municipal, tras Contacto. |
| 9. `/util` | Igual, salvo el bloque de cada concejo activo, que pasa a ser una fila compacta de accesos con «Todo lo útil de…». En la fila de nombres de arriba, los inactivos enlazan a su página (nunca a `#util`). |
| 10. «Ver todos» en el móvil | Búsqueda en una línea y filtros en una fila desplazable con etiquetas cortas: el primer resultado se ve en la primera pantalla. |
| 11. Fuente de los servicios | Cada servicio enseña «Fuente: aytolena.es · comprobado el 04/11/2026». Si no hay fuente, «Fuente pendiente de comprobar». Campo nuevo **Fecha de comprobación**, que se rellena al repetir la importación de servicios (paso 6). |

### C. Correcciones

| Punto | Cambio |
|---|---|
| 12. Agenda | Los eventos municipales enlazan a la agenda de su espacio (`/[concejo]?seccion=event`), con la entradilla. |
| 13. Opinión | Todas sus tarjetas (búsqueda, relacionadas, secciones, portada y `/opinion`) llevan la etiqueta «Opinión» y la firma. |
| 14. Desplegables | Avisos y agenda municipal: «+» cerrado y «−» abierto. ↗ queda solo para enlaces a otra página. |
| 15. RSS | `/rss.xml`: las 30 últimas noticias y opiniones (sin contenido municipal), enlazado en el `<head>` de todas las páginas. |
| 16. Empleo vacío y AEMET | «…convocatorias de los ayuntamientos del Caudal» en `/util` (que ahora también lista el empleo de los ayuntamientos activos) y «…de este ayuntamiento» en cada concejo. Si la hora de consulta inicial y final coinciden, una sola. |
| 17. Cabecera municipal en el móvil | El crédito de la foto ya no se monta sobre «Descubre tu espacio municipal». Misma altura y diseño. |

### D. Portada y pie

| Punto | Cambio |
|---|---|
| 18-19 | Sin antetítulos que repiten el título («El pulso del territorio», «Cerca de ti», «Portada», «Territorio», «Fiestas de las Cuencas») y sin el bloque «Mapa informativo / Los seis concejos del Caudal». |
| 20 | La autopromoción «Anúnciate en Planta 14» mide lo que su contenido. |
| 21 | Las miniaturas de «Caudal» cubren su hueco (sin banda gris). |
| 22 | Bloque verde del boletín más compacto. A la izquierda, título, frase, correo y botón. A la derecha, qué recibir y los concejos, en casillas pequeñas. Debajo, el consentimiento y la privacidad en letra pequeña. **Solo en la portada**: fuera de las noticias y de las fichas de fiestas. |
| 23 | Pie: «Planta 14» y el lema en una fila. Debajo, Proyecto, Participa y Boletín, alineadas arriba. Boletín más compacto, con «Elegir concejos» como enlace discreto. En el móvil, apilado y con 44 px. |
| 24 | Cabecera del periódico en el móvil más compacta: a 390 × 844 la foto de apertura empieza en la primera pantalla. Los concejos van en una fila desplazable con 44 px de zona táctil. |
| 25 | Fechas en tarjetas y listas, de 12 px o más y con formato corto («Mieres · 5 nov 2026»). |
| 26 | Texto de ejemplo del correo corto («tu@correo.es»), que cabe entero. |

### E. Envío del boletín

CMS → **Boletines** (administración y redacción):
- Cada boletín tiene asunto, entradilla opcional y noticias publicadas (por defecto, las de los últimos 7 días).
- **Enviarme una prueba** te llega solo a ti, y es obligatoria antes de **Enviar a todos**, que pide confirmación.
- Cada suscriptor confirmado recibe las noticias de sus concejos (todas si no eligió ninguno), con la baja en un clic y la identificación del editor.
- Se envía por el SMTP de avisos@planta14.com, en lotes. Se registran los enviados, los fallos y las bajas.
- La plantilla es HTML sobrio, con tablas y sin imágenes, y lleva su alternativa en texto plano.

**Límites que uso:** 20 correos por lote, 1 s entre correos y 2 min entre lotes, unos 480 a la hora. Son prudentes: no he podido confirmar los límites exactos del plan de IONOS. Se cambian con `NEWSLETTER_BATCH_SIZE`, `NEWSLETTER_EMAIL_PAUSE_MS` y `NEWSLETTER_BATCH_PAUSE_SECONDS`, opcionales y sin tocar el `.env`.

### F. Fiestas: importación con fechas

El importador acepta `contenido-ensayo/fiestas-caudal-fechas.json` (`cb90d19`):
- solo las 47 de tipo «fiesta», todas como borrador; los 29 eventos no entran;
- estado de la fecha: «Confirmada», **«Por regla, sin confirmar»** (estado nuevo, no se publica) o «Fecha pendiente»;
- guarda la fecha de inicio y fin, la fuente de la fecha y la fecha de consulta;
- las existentes en borrador se actualizan solo en esos campos; las ya publicadas, solo en la fuente y la fecha de consulta.

**Migraciones nuevas** (se aplican solas al desplegar):
- `20261106_093606_fiestas_aviso`: el aviso de despublicación;
- `20261106_095011_final`: los boletines, la fecha de comprobación de los servicios y, en las fiestas, «Por regla», la fuente y la fecha de consulta.

Las dos se probaron hacia delante y hacia atrás. **Sin variables nuevas obligatorias en el `.env`**; `GA4_MEASUREMENT_ID` sobra y se puede borrar.

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

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente. **Anota la versión actual** (debería ser `a66deb2`).

**2. Fijar el commit y desplegar:**

```bash
git fetch origin desarrollo/planta14-v2-final
```

```bash
git checkout --detach d7d348fcb9f873307b9f8ed5afa3c5f602c1c9fe
```

```bash
git log -1 --format='%h %s'
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production d7d348fcb9f873307b9f8ed5afa3c5f602c1c9fe
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0, y aplicar `20261106_093606_fiestas_aviso` y `20261106_095011_final`.
- **código 1:** ha vuelto sola a la versión anterior;
- **código 2:** restauración asistida (`docs/MANUAL-OPERACION.md`, apartado 9).

**3. Comprobar:**

```bash
curl -s https://pruebas.planta14.com/api/health
```

Debe dar `"status":"ok"`.

```bash
docker compose -f infra/compose.production.yaml --env-file infra/.env.production exec -T app node -e 'Promise.all(["/rss.xml","/util","/cookies"].map(p=>fetch("http://127.0.0.1:3000"+p,{redirect:"manual"}).then(async r=>[p,r.status,await r.text()]))).then(rs=>{for(const [p,s,t] of rs) console.log(p,s,p==="/rss.xml"?(t.match(/<item>/g)||[]).length+" noticias":p==="/cookies"?(/Google|Analytics/.test(t)?"MENCIONA GA4":"sin GA4"):(/data-util-weather-strip/.test(t)?"con el tiempo":""))})'
```

Debe dar `/rss.xml 200 … noticias`, `/util 200` y `/cookies 200 sin GA4`.

**4. Variables de los comandos siguientes:**

```bash
installed=$(cut -c1-12 /srv/planta14/state/current)
```

```bash
migrate() { APP_IMAGE="planta14-app:$installed" docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -T migrate "$@"; }
```

```bash
git fetch origin desarrollo/planta14-contenido-ensayo
```

**5. Importar las fiestas con fechas.** Primero, solo comprobar:

```bash
git show cb90d19:contenido-ensayo/fiestas-caudal-fechas.json > /tmp/fiestas-caudal-fechas.json
```

```bash
migrate npm run cms:fiestas:importar -- - --solo-comprobar < /tmp/fiestas-caudal-fechas.json
```

Si nadie ha publicado todavía ninguna de las 46, debe decir:
- «Formato: catálogo con fechas (solo las de tipo «fiesta», todas como borrador)»;
- «Se crearían 4 fiestas como borrador» (Santa Bárbara y San Antón de Mieres, Santa Apolonia de Pedroso y el Antroxu de Moreda);
- «Se actualizarían 43 existentes en borrador»;
- «1 confirmadas, 21 por regla y 25 pendientes. Eventos no importados: 29.»;
- «Ya existentes que ahora son eventos: 3 (no se tocan)»: Mercáu de Serüenda, Afuegal Pitu y Mercáu de Otoño;
- sin errores.

Si la redacción ya publicó alguna, sale en «Ya publicadas» y no se cuenta en las 43. Si sale algún error, para aquí y pásamelo. Después, de verdad (sin `--publicar`, que se rechaza):

```bash
migrate npm run cms:fiestas:importar -- - < /tmp/fiestas-caudal-fechas.json
```

Debe decir «Creadas 4 fiestas como borrador» e «IMPORTACIÓN TERMINADA». Repetirlo debe dar «Creadas 0», sin duplicados.

**6. Fecha de comprobación de los servicios** (rellena la de los 73 ya importados):

```bash
mkdir -p /tmp/datos-servicios && git show bcc03e0:datos-servicios/servicios-municipales.json > /tmp/datos-servicios/servicios-municipales.json
```

```bash
migrate npm run cms:servicios:importar -- - < /tmp/datos-servicios/servicios-municipales.json
```

Debe decir «Creados 0» y «Completadas … (foto, recorrido o fecha de comprobación que faltaba)», con «…: fecha de comprobación» en los servicios que no la tenían. No crea ni duplica nada.

**7. Boletín de prueba, solo al administrador.** No pulses «Enviar a todos».
1. Entra en `https://pruebas.planta14.com/cms` con la cuenta de **administración**.
2. Boletines → Crear → asunto «Prueba de boletín» → Guardar.
3. Pulsa **Enviarme una prueba**. Debe llegar un único correo, «[Prueba] Prueba de boletín», al correo de esa cuenta. Debe llevar el aviso «Prueba: solo te llega a ti» y verse bien en el móvil y en Gmail u Outlook.
4. Comprueba que no llegó nada a nadie más: en el boletín, «Resultado» sigue a 0.
5. Si no hace falta, borra ese boletín (solo la administración puede).

**8. Si algo falla: volver a la versión anterior.** Si `deploy.sh` terminó con código 1 o 2, sigue lo que dice. Si el despliegue fue bien pero algo no funciona después, vuelve a desplegar la versión anotada en el paso 1:

```bash
git checkout --detach a66deb2356e6c3d398aac6b455fa53d4991ce7aa
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production a66deb2356e6c3d398aac6b455fa53d4991ce7aa
```

Las migraciones nuevas solo **añaden** tablas, columnas y un valor nuevo («por-regla») al estado de la fecha, que la versión anterior no usa. No hace falta deshacerlas, y los datos (boletines, fiestas importadas) se conservan. Si de verdad hiciera falta deshacerlas, la vuelta atrás de la migración pasa antes las fiestas «Por regla» a «Fecha pendiente»; pídemelo y lo hacemos juntos.

## Qué mirar en el navegador

En el ordenador (2133, 1440 y 1024 px), en la tableta (820 y 768) y en el móvil (390), sin barra de desplazamiento horizontal:

- **Portada:**
  - sin antetítulos sobre «En portada», «La vida aquí», «Caudal» ni «Fiestas esta semana», y sin «Mapa informativo»;
  - la autopromoción, del tamaño de su texto;
  - las miniaturas de «Caudal», llenas;
  - el boletín verde, compacto y a dos columnas;
  - en el móvil, la foto de apertura en la primera pantalla.
- **Concejo inactivo** (`/morcin`, `/ribera-de-arriba`): página del periódico, «Morcín» y «Noticias de Morcín en Planta 14», sin escudo ni «Espacio municipal».
- **Concejo activo:**
  - su identidad intacta;
  - la pestaña «Útil»;
  - al final, el resumen compacto;
  - en `/[concejo]/util`, todas las cajas;
  - en `/[concejo]/util/servicios` en el móvil, el primer resultado en la primera pantalla y la fuente de cada servicio.
- **`/util`:** la franja del tiempo arriba y, al final, una fila por concejo activo.
- **Una noticia:** sin bloque verde; solo el formulario del pie.
- **`/opinion` y la búsqueda:** etiqueta «Opinión» y firma.
- **`/agenda`:** los eventos municipales enlazan a su espacio.
- **Desplegables de avisos:** «+» y «−».
- **Pie:** «Planta 14» y el lema arriba; Proyecto, Participa y Boletín debajo.
- **Fiestas en el CMS:**
  - despublica una y vuelve a publicarla;
  - pasa una publicada a «Pendiente»: se despublica sola, con el aviso;
  - las importadas, en borrador, con «Por regla» o «Fecha pendiente», su fuente y su fecha de consulta.
- **`/privacidad` y `/cookies` en el móvil:** las tablas se desplazan dentro de su caja.
- **`/cookies`:** sin Google Analytics.

## Resultados de la batería completa

**Batería completa sobre `6614b28`:**

| Prueba | Resultado |
|---|---|
| `production-deploy-test.sh` | **SUPERADO**: construye la imagen y aplica las migraciones nuevas, sin volúmenes nuevos |
| `npm test`, `typecheck`, `lint`, `build` | Correctos; lint con 0 errores y los 16 avisos de estilo de siempre |
| `test:block3` / `launch` / `instalacion` / `formulario` / `portada` | Correctos. `launch` comprueba ahora que no hay banner, ni cookies para los lectores, ni peticiones a terceros |
| `test:block2` | **Falló**: comparaba la portada de la demo con la real incluyendo el número interno de las acciones de servidor (no es contenido), una clase del aviso de la demo en el pie y la pestaña «Útil» (solo con contenido real) |
| `test:ensayo` | **Falló**: esperaba el rótulo antiguo «El concejo en Planta 14» en un concejo inactivo, que ahora es la página del periódico |
| `test:participacion` | **No arrancó**: el puerto 3086 lo ocupaba un servidor de una prueba anterior que se había quedado abierto |
| shellcheck, Caddy (acme e internal), `common-test`, `staging-config-test`, `monitor-test`, `memory-test`, `staging-guard-test` | Correctos |
| `restore-test.sh` (tres variantes), `offsite-immutable-test`, `pruebas-config-test`, `preproduccion-test`, `postgres-roles-test`, `staging-e2e.sh` | SUPERADAS, sin volúmenes nuevos ni restos |

**Arreglo y repetición (`d7d348f`):**
- **Código:** el aviso de la demo en el pie recupera su clase.
- **`block2`:** iguala esa numeración y deja fuera la pestaña.
- **`ensayo`:** espera la página periodística.
- **Repetidas `block2`, `ensayo` y `participacion`:** correctas. Participación da 41 PASS:
  - las pruebas nuevas: concejo inactivo, fiestas (despublicar y catálogo con fechas), Útil compacto y su página, boletín (prueba, envío por concejos, baja y lotes), pie, cabecera y cierre en seis anchos;
  - las medidas: a 390 × 844 la foto de apertura empieza a 318 px; la autopromoción mide 141 px; las columnas de «Útil» quedan 3/3/3/2/1.

## Dudas resueltas por prudencia

1. **Concejo inactivo:** uso la cabecera de Planta 14 y una página tipo sección («Morcín» y sus noticias). Las tarjetas son las del periódico, sin la foto de cabecera del ayuntamiento ni sus colores. Los créditos del escudo no salen, porque no hay escudo.
2. **Mieres, con contrato desde el 4 de diciembre,** cuenta como inactivo hasta ese día: hasta entonces su página es la del periódico. El día 4 pasa sola a ser su espacio municipal.
3. **Validación de fiestas:** «Por regla» también despublica sola una fiesta publicada (además de «Pendiente» y «Orientativa»), porque no es una fecha confirmada. El aviso queda como campo de solo lectura en la barra lateral, porque Payload no permite mensajes emergentes desde el servidor.
4. **Mismo patrón en otras colecciones:** encontrado y corregido en la comprobación de derechos de las imágenes, que se aplicaba al guardar borradores de algo ya publicado. No encontré otros casos con el mismo efecto.
5. **Mapas de OpenStreetMap:** cargaban teselas de un tercero al abrir la ficha. Ahora se cargan solo al pulsar «Ver el mapa», que avisa de que vienen de OpenStreetMap. La web no carga nada de terceros por sí sola.
6. **Iconos y resumen del tiempo:** el resumen del concejo lleva su atribución de AEMET abreviada en la misma línea, como piden sus condiciones.
7. **`/util` y empleo:** para que el aviso de «sin convocatorias de los ayuntamientos del Caudal» sea cierto, la caja de empleo de `/util` lista ahora el empleo del Principado y el de los ayuntamientos activos, cada uno con su concejo. Los enlaces fijos al empleo de cada ayuntamiento quedan en su `/[concejo]/util`.
8. **Fecha de comprobación de los servicios:** si hay fuente pero no fecha, sale «fecha de comprobación pendiente». Una edición del ayuntamiento desde su panel no cambia la fecha: es la de la comprobación de Planta 14.
9. **Hora en las tarjetas:** la mantengo («5 nov 2026 · 10:30 h»), porque se pidió en una revisión anterior. Solo simplifico el formato (sin comarca ni mayúsculas) y subo el tamaño a 13 px.
10. **Boletín verde:** lo quito también de las fichas de fiestas, porque el encargo dice «solo en la portada». En todas las demás páginas queda el formulario del pie.
11. **Cabecera del periódico en el móvil:** escondo la línea superior «Asturias · El Caudal», que iba a 8 px. La marca se queda en 46 px. Los concejos van en una fila desplazable.
12. **Envío del boletín:**
    - **Límites de IONOS:** no he podido confirmar los exactos de su plan. Uso valores prudentes, unos 480 a la hora, que se pueden cambiar.
    - **Sin noticias de sus concejos:** quien no tiene ninguna no recibe ese boletín.
    - **Contenidos elegidos** («Qué hacer este finde» y «Avisos de mi concejo»): no filtran, porque el boletín es de noticias.
    - **Envío en segundo plano:** va dentro de la propia app. Si el servidor se reinicia a mitad, se reanuda pulsando otra vez, sin repetir.
    - **Antes de «Enviar a todos»:** hace falta una prueba de la versión guardada.
13. **Fiestas importadas:** el encargo esperaba actualizar 46, pero por identificador coinciden **43**. Hay 4 nuevas, y 3 de las existentes (Mercáu de Serüenda, Afuegal Pitu y Mercáu de Otoño) el catálogo nuevo las considera «evento». Esas 3 no se tocan ni se borran: siguen en borrador y el importador las lista para que decida la redacción. En las existentes en borrador solo se actualizan las fechas, el estado, la fuente y la fecha de consulta. Así no se pisa nada que haya editado la redacción. Las ya publicadas no cambian de fechas.
14. **Migraciones:** las nuevas tienen su vuelta atrás probada. Una migración anterior a este encargo (`util_ocultar`) tiene en su vuelta atrás el mismo fallo del generador de Payload (borra dos veces una restricción). No afecta a la instalación, que nunca la deshace, y no la he tocado.
