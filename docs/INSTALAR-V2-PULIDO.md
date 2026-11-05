# Instalar el pulido de «Útil», el pie, la cabecera y las cartas desactivadas

Para Claude Code en el PC de Pablo (Code local), con el agente SSH cargado.

Rama **`desarrollo/planta14-v2-pulido`**, creada desde `desarrollo/planta14-v2-util-activacion` (`b336a5f`). **Commit a instalar: `a66deb2`** (`a66deb2356e6c3d398aac6b455fa53d4991ce7aa`). El commit siguiente solo añade este documento y el manual ya va en el commit a instalar. No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

Se instala sobre `36c43c4`, la versión que hay en pruebas.

**Migración nueva:** `20261105_143455_cartas_activas`. Solo crea la tabla del ajuste «Cartas activas» y se aplica sola al desplegar. Sin variables nuevas en el `.env`.

**Importante:** al desplegar, **las cartas de los lectores dejan de verse y de aceptarse**, porque el ajuste nace desactivado. Es lo que pide el encargo. No se borra ninguna carta ni código.

> **Batería completa: pasada una vez sobre `a66deb2`, todo correcto.** Lleva todos los puntos del encargo (1 a 6 y 10 a 13).

## Qué cambia

| Punto | Cambio |
|---|---|
| 1. Empleo público | Un anuncio municipal del BOE solo entra si lo firma **expresamente** uno de los seis ayuntamientos («…, del Ayuntamiento de Lena (Asturias), …»), y solo sale en ese concejo. La causa del fallo: el BOE pone «(Asturias)» a todos los ayuntamientos asturianos, y el filtro tomaba eso como Principado. Por eso el anuncio de **Grado** (BOE-A-2026-23212) salía en `/util` y en todos los concejos. Ya no cuentan «(Asturias)», nombres de calles ni lugares, ni otros ayuntamientos, mancomunidades o consorcios. Lo que ya estaba en la caché (45 días) se vuelve a clasificar al leerlo, así que el de Grado desaparece en cuanto se despliega. |
| 1. Subvenciones (BDNS) | Ya se asignaban por el ayuntamiento convocante (campo de la BDNS), nunca por el texto. Ahora tienen prueba: Grado, Langreo o una mancomunidad no entran; Lena y Ribera de Arriba, cada una a su concejo. |
| 2. Columnas de «Útil» | Cada caja va, en orden, a la **columna más corta**. Las columnas quedan igualadas: la diferencia nunca pasa de la altura de la última caja de la columna larga. El orden de lectura se mantiene, porque cada caja empieza a la altura de la anterior o más abajo, y el HTML no cambia de orden (lectores de pantalla, tabulador). Sin JavaScript, o en el móvil (una columna), queda como antes. |
| 3. Patrimonio sin foto | Ni cuadro beis en las cajas y las listas ni panel en la ficha: van solo con texto, a todo el ancho. |
| 4. Título de las subvenciones | Se usa el título oficial de la BDNS, con la primera letra en mayúscula. Si es largo o viene cortado, se corta en un límite de palabra con «…», nunca en «de», «y»… Los títulos que ya estaban en la caché se arreglan al leerlos. |
| 5. Atribución de AEMET | Una sola vez, al final del bloque del tiempo: «© AEMET. Información elaborada por la Agencia Estatal de Meteorología» (con enlace), la hora de elaboración y la de consulta. Si los concejos difieren, se da el intervalo. Si un concejo no se ha podido actualizar, su nota sale junto a él. |
| 6. Recuento en «Ver todos» | Con búsqueda o filtro: «**2 de 18** en Aller» y un enlace «Quitar el filtro». Sin filtro, como antes: «18 elementos en Aller». |
| 10. Pie | Sin la columna «Concejos», que ya están en la cabecera. Cuatro columnas en el ordenador: **Planta 14 y lema / Participa / Proyecto / Boletín** (el boletín, igual). En el ordenador con ratón (desde 1024 px), las listas de enlaces son compactas, con interlineado normal y sin la zona de 44 px. En tableta y móvil se mantienen los 44 px. |
| 11. Cabecera | El historial muestra que el encargo del pie cambió algo que no se pidió en la frase lateral: quitó el salto de línea («Donde otros / no llegan») y añadió un ancho máximo, de modo que se partía como «Donde otros no / llegan». Vuelve a ser como antes: cursiva, Source Serif de 16 px, en dos líneas. Si se cambia el lema en el CMS, el corte va tras un punto interior o en el espacio más cercano a la mitad. La cursiva y el tamaño no habían cambiado, y «Una voz para las Cuencas» solo cambió de origen (ahora sale del CMS). **«Una voz para las Cuencas» sube de 10 px (9 px en el móvil) a 12 px**, sin romper la cabecera. |
| 13. Cartas, fuera de la web | Ajuste global nuevo, **«Cartas activas»** (solo administración), **desactivado por defecto**. Desactivado: `/cartas`, `/cartas/enviar`, `/cartas/confirmar` y `/normas-cartas` dan 404 y no están en el sitemap; no hay enlaces ni bloques de cartas (pie, portada, Opinión, `/principios`); el formulario y sus acciones no aceptan envíos ni confirmaciones; la colección queda oculta para la redacción y para la API pública. El código y las cartas guardadas se conservan. El borrado de DNI y teléfono a los 24 meses sigue funcionando, ahora también una vez al día en el servidor. En «Participa», **«Cuéntanos algo»** lleva a Contacto, que dice en una línea, sin formulario: «Para avisos, historias o sugerencias, escríbenos a info@planta14.com». Cómo reactivarlas: manual, apartado 19. |
| 12. El tiempo en `/util` | Sale de la rejilla y pasa a ser una **franja a todo el ancho bajo el título**, antes de las demás cajas. Para cada uno de los seis concejos: icono, estado del cielo, máxima y mínima de hoy, probabilidad de lluvia, y mañana en pequeño con icono y temperaturas. Cota de nieve y atribución de AEMET, una sola vez al final de la franja. Seis por fila en el ordenador, tres en tableta y dos en el móvil. En la página de cada concejo, el tiempo sigue siendo una caja. |

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

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente. **Anota la versión actual** (debería ser `36c43c4`): es a la que se vuelve si algo falla.

**2. Fijar el commit y desplegar:**

```bash
git fetch origin desarrollo/planta14-v2-pulido
```

```bash
git checkout --detach a66deb2356e6c3d398aac6b455fa53d4991ce7aa
```

```bash
git log -1 --format='%h %s'
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production a66deb2356e6c3d398aac6b455fa53d4991ce7aa
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0, y aplicar la migración `20261105_143455_cartas_activas`.
- **código 1:** ha vuelto sola a la versión anterior;
- **código 2:** restauración asistida (`docs/MANUAL-OPERACION.md`, apartado 9).

**3. Comprobar la salud:**

```bash
curl -s https://pruebas.planta14.com/api/health
```

Debe dar `"status":"ok"`.

**4. Comprobar en el servidor que Grado ya no sale.** Pide `/util` directamente a la app, dentro del contenedor. La contraseña de preproducción la pone Caddy, delante, así que aquí no se pide:

```bash
docker compose -f infra/compose.production.yaml --env-file infra/.env.production exec -T app node -e 'fetch("http://127.0.0.1:3000/util",{redirect:"manual"}).then(async r=>{const t=await r.text(); console.log("HTTP", r.status, /Ayuntamiento de Grado|BOE-A-2026-23212/.test(t) ? "SALE GRADO" : "sin Grado", /data-util-aemet/.test(t) ? "· AEMET al final" : "")})'
```

Debe decir `HTTP 200 sin Grado`, y `· AEMET al final` si hay clave de AEMET. Si dice `SALE GRADO`, vuelve a la versión anterior (paso 5) y avísame. Si el código no es 200, haz la comprobación en el navegador (apartado siguiente).

**5. Si algo falla: volver a la versión anterior.** Si `deploy.sh` terminó con código 1 o 2, sigue lo que dice. Si el despliegue fue bien pero algo no funciona después, vuelve a desplegar la versión anotada en el paso 1:

```bash
git checkout --detach 36c43c4bde21a96d0216b81d59334d3fbdf98588
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production 36c43c4bde21a96d0216b81d59334d3fbdf98588
```

La migración nueva solo **crea** una tabla que la versión anterior no usa, así que no hace falta deshacerla. La caché de las fuentes sirve para las dos versiones. La versión anterior vuelve a mostrar las cartas.

## Qué mirar en el navegador

- **`/util` y `/aller`, bloque «Empleo público»:** no sale «Ayuntamiento de Grado» ni ningún otro ayuntamiento que no sea de los seis.
- **`/aller` en una pantalla ancha (unos 2100 px) y a 1440, 1024, 768 y 390 px:** las columnas de «Útil» terminan casi a la vez, sin una columna mucho más corta. En el móvil, una sola columna.
- **Patrimonio sin foto** (en `/util/patrimonio` y en la caja de un concejo): sin cuadro beis; el texto ocupa todo el ancho. Su ficha empieza directamente por el texto.
- **Subvenciones:** títulos con mayúscula inicial. Si son largos, terminan en «…» en una palabra completa.
- **`/util`, bloque «El tiempo»:** «© AEMET…» una sola vez, al final, con «Elaborada: …» y «Consultado: …».
- **`/aller/util/servicios?q=polideportivo`:** «2 de 18 en Aller» (o los números que haya) y «Quitar el filtro», que vuelve a la lista completa.
- **Pie, en cualquier página:**
  - en el ordenador, cuatro columnas (Planta 14, Participa, Proyecto y Boletín), sin «Concejos», y las listas más juntas;
  - en el móvil y la tableta, los enlaces siguen cómodos de pulsar.
- **Cabecera:**
  - «Donde otros / no llegan» en dos líneas, en cursiva;
  - «UNA VOZ PARA LAS CUENCAS» se lee bien, en el ordenador y en el móvil.
- **Cartas:**
  - `/cartas/enviar` y `/normas-cartas` dan «Página no encontrada»;
  - en el pie, «Participa» dice «Cuéntanos algo» y abre Contacto;
  - en Opinión no hay bloque de cartas;
  - Contacto dice «Para avisos, historias o sugerencias, escríbenos a info@planta14.com», sin formulario;
  - con una cuenta de redacción, el CMS no muestra «Cartas de los lectores»; con la administración, sí, y en Globales aparece **«Cartas activas»**, sin marcar.
- **`/util`, franja del tiempo:**
  - justo debajo del título;
  - seis concejos en fila en el ordenador, tres en tableta y dos en el móvil;
  - la cota de nieve y «© AEMET…» una vez, al final.
  En la página de un concejo, el tiempo sigue en su caja.

## Resultados de la batería completa

**Batería completa sobre `a66deb2`:**

| Prueba | Resultado |
|---|---|
| `production-deploy-test.sh` | **SUPERADO**: construye la imagen y aplica la migración nueva, sin volúmenes nuevos |
| `npm test`, `typecheck`, `lint`, `build` | Correctos. El lint marcó 32 avisos: los 16 de estilo de siempre y su copia en `infra/test/out/`, restos de una pasada interrumpida (fuera de git), ya borrados. Repetido el lint: 0 errores y 16 avisos |
| `test:block2` / `block3` / `launch` / `instalacion` / `ensayo` / `formulario` | Correctos |
| `test:portada` | Correcto |
| `test:participacion` | **Correcto**. Incluye: el anuncio de Grado y los filtros de BOE y BDNS; títulos de BDNS; patrimonio sin foto; AEMET una vez; «2 de 18»; columnas a la más corta (/aller a 2133 px: 305 px de diferencia; el máximo en todas las páginas y anchos, 568 px, siempre menos que la última caja más el margen); franja del tiempo (6 / 3 / 2 por fila); pie sin «Concejos», compacto en ordenador y con 44 px en tableta y móvil; cabecera; y las cartas desactivadas y su reactivación |
| shellcheck, Caddy (acme e internal), `common-test`, `staging-config-test`, `monitor-test`, `memory-test`, `staging-guard-test` | Correctos |
| `restore-test.sh` (tres variantes), `offsite-immutable-test`, `pruebas-config-test`, `preproduccion-test`, `postgres-roles-test`, `staging-e2e.sh` | SUPERADAS, sin volúmenes nuevos ni restos |

## Dudas resueltas por prudencia

1. **Qué cuenta como «expresamente del concejo» en el BOE:** solo el organismo que firma, «del Ayuntamiento (o Concejo) de Mieres / Lena / Aller / Morcín / Riosa / Ribera de Arriba». No uso parroquias ni entidades menores: el BOE no publica convocatorias firmadas por ellas, y buscar sus nombres en el texto traería coincidencias falsas (calles, lugares). Un anuncio del Principado que nombre un concejo sigue siendo del Principado, no de ese concejo.
2. **La Universidad de Oviedo** sigue como regional, pero solo si el BOE la clasifica como universidad, no por aparecer en el texto.
3. **Título «oficial» de las subvenciones:** la BDNS solo guarda el título cortado a 255 caracteres, también en el detalle (lo comprobé con la convocatoria 938605). Uso el del detalle cuando existe; si no, el de la búsqueda. Lo corto a unos 180 caracteres en un límite de palabra, para que quepa en la caja. El título completo está en la convocatoria enlazada.
4. **Columnas igualadas sin cambiar el orden:** reparto «a la columna más corta» en el orden original. No reordeno cajas para igualar más, porque rompería el orden de lectura. La diferencia que queda nunca pasa de la última caja de la columna larga. Necesita JavaScript; sin él, quedan las columnas de CSS de antes.
5. **Patrimonio sin foto en la ficha:** quito también el panel beis con el nombre del concejo de la ficha (`/util/patrimonio/…`), no solo de las cajas y las listas, porque el encargo dice «la ficha va solo con texto».
6. **Horas de AEMET en `/util`:** con varios concejos, si las horas de elaboración o de consulta difieren, muestro el intervalo («entre … y …») en vez de una sola hora, para no dar por más reciente un dato que no lo es.
7. **Caché anterior:** en vez de esperar al siguiente refresco (BOE, cada 3 horas; BDNS, cada 6), los anuncios y títulos ya guardados se vuelven a filtrar y arreglar al leerlos, para que el cambio se vea nada más desplegar.
8. **Iconos del tiempo:** el encargo habla de «los iconos del punto 7», pero el punto 7 de este encargo es el de las pruebas y no me ha llegado ningún juego de iconos. Hago un juego propio y sencillo, en SVG dentro de la página (sin peticiones ni licencias de terceros): sol, intervalos, nubes, lluvia, nieve, tormenta y niebla, elegido por el texto del estado del cielo de AEMET. Si había otros iconos previstos, se cambian solo en `components/weather-icon.tsx`.
9. **Qué es «ordenador» en el pie compacto:** pantallas de 1024 px o más **con ratón** (`pointer: fine`). Una tableta grande en horizontal, que se usa con el dedo, mantiene los 44 px.
10. **Frase lateral con otros lemas:** como el lema se puede cambiar desde el CMS, no fijo el corte «Donde otros / no llegan» a mano. Va tras un punto interior si lo hay; si no, en el espacio más cercano a la mitad. Con el lema actual queda exactamente como antes.
11. **Tamaño de «Una voz para las Cuencas»:** 12 px en todas las pantallas, con un poco menos de espacio entre letras (0,2 em en el ordenador y 0,12 em en el móvil, antes 0,24 y 0,15) para que no ocupe más ancho del necesario. Es el mínimo pedido; no lo subo más para no cambiar el peso de la cabecera.
12. **Cota de nieve en la franja:** la de hoy, de los concejos que la tengan («Lena, 900 m · Aller, 1000 m»). Si ninguno la tiene, no sale la línea.
13. **No había una tarea nocturna** de borrado de DNI y teléfono: se borraban al llegar una carta, al abrir el CMS y con `npm run cms:cartas:caducar`. Con las cartas desactivadas ya no llegan cartas, así que añado un borrado **una vez al día dentro del servidor**, en el mismo proceso que refresca «Útil». No toca el servidor ni añade ningún cron. Los otros dos siguen igual.
14. **«Envía tu carta» al reactivar:** «Cuéntanos algo» se queda siempre. Si se reactivan las cartas, «Envía tu carta» vuelve a salir debajo, en «Participa».
15. **`/principios`:** su apartado «Cartas de los lectores» no sale mientras las cartas estén desactivadas, pero sigue guardado en el CMS, así que vuelve solo al reactivarlas. La descripción de la página para buscadores ya no menciona las cartas.
16. **Política de privacidad:** sigue explicando el tratamiento de los datos de las cartas, porque puede haber cartas antiguas guardadas y el borrado a los 24 meses sigue en marcha. No es un enlace ni un bloque de cartas.
17. **Confirmaciones pendientes:** una carta enviada antes de desactivar, y aún sin confirmar, ya no se puede confirmar: la página da 404 y la acción no la acepta. Prudente: con las cartas cerradas no entra nada nuevo a la redacción.
