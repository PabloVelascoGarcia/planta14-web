# Instalar el panel municipal en pestañas y los retoques

Para Claude Code en el PC de Pablo (Code local), con el agente SSH cargado.

Rama **`desarrollo/planta14-v2-panel`**, creada desde `desarrollo/planta14-v2-final` (`ff10f48`). **Commit a instalar: PENDIENTE.** En esta misma rama se añadirán en unos días los cambios que pidan los periodistas; entonces se pasará una sola vez la batería completa, se fijará aquí el commit (y su hash completo en los pasos) y se hará un único despliegue. No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

Se instala sobre `d7d348f` (la versión final de salida). Una migración nueva, `20261106_124731_redaccion`: amplía «Pendientes de revisar» (concejo, sugerencias, decisión, quién y cuándo), añade los motivos de rechazo, las preferencias «Resumen diario» y «Fuera hasta» de cada usuario y el concejo oculto **Caudal** para lo comarcal.

## Qué cambia

### A. Fallo de las casillas (bloqueante)

| Punto | Cambio |
|---|---|
| 1. Casillas y radios rotos en `/[concejo]/panel` | **Causa:** la regla general de los campos del panel (`.municipal-form input`, ancho 100 % y 48 px de alto) se aplicaba también a casillas y radios. Ahora excluye `checkbox`, `radio` y `hidden`. Las casillas recuperan su tamaño normal, con la zona táctil de 44 px en la etiqueta y el texto al lado. Revisadas en toda la web: panel, boletín (bloque verde y pie), formulario de fiestas, agenda y páginas de concejo. En el boletín de la portada, los concejos van ahora de dos en dos para que «Ribera de Arriba» no se parta a 1024 px. El CMS tiene sus propios estilos y no estaba afectado. |
| 2. Comprobación visual | Nueva en la batería (`scripts/participacion-panel.mjs`). A 1440, 1024, 768 y 390 px, en cada pestaña del panel, la portada, `/fiestas/enviar`, `/agenda`, `/mieres`, `/aller`, `/lena`, `/aller/util`, `/morcin` y el boletín del pie abierto, comprueba: ninguna casilla de más de 32 px, el texto en la misma fila que su casilla (y no una palabra por línea), y sin desplazamiento horizontal. Probada contra el CSS anterior: detecta el fallo (casilla de 579 px). |

### B. Panel más corto y ordenado

| Punto | Cambio |
|---|---|
| 3. Pestañas | **Publicar** (por defecto) · **Mis publicaciones** · **Útil** · **Directorio** · **Sugerencias** · **Visitas**. Cada una con su enlace (`/lena/panel?pestana=visitas`…). En el móvil, en una fila desplazable. |
| 4. Mis publicaciones | Una línea por publicación: tipo, título, estado y fecha; Editar, Publicar y Despublicar como enlaces pequeños a la derecha. 10 por página, con filtros por tipo y estado. «Editar» la abre en «Publicar». |
| 5. Directorio | Lista compacta con buscador. El formulario solo se abre con «Añadir servicio»; «Editar» lo abre en la misma fila. |
| 6. Visitas | Total, una fila de barras (una por día, con la cifra al pasar el ratón), páginas, fuentes y secciones como antes; CSV y PDF. |
| 7. Útil y Sugerencias | Casillas en dos columnas (una en el móvil), con el botón a la vista. |
| 8. Pie | Sin el bloque del boletín en el panel. |

### C. Retoques

| Punto | Cambio |
|---|---|
| 9. Condiciones | «Condiciones de las cuentas municipales» sale del pie y del aviso legal (allí queda como texto, sin enlace). La página lleva `noindex` y no está en el sitemap. Se enlaza solo, discretamente, desde la entrada al panel y el propio panel, como «Condiciones de uso del espacio municipal». El contenido no cambia. |
| 10. Escudos | Mieres, Aller y Lena en la misma caja: 84 px de alto (60 en el móvil), como mucho 64 px de ancho, con sus proporciones. |
| 11. Tiempo en `/[concejo]/util` | Con los mismos iconos y el mismo diseño que el resumen y la franja de `/util`: cuatro días, dos por fila. |
| 12. `/morcin` | La raya bajo el título ocupa todo el ancho del contenido. |

### D. Redacción: bandeja, avisos y resumen diario

Principio: los redactores son colaboradores a tiempo parcial. Todo se resuelve rápido y desde un solo sitio, sin avisos por lo que no requiere acción.

| Punto | Cambio |
|---|---|
| 14. Concejo obligatorio | En noticias y opinión (ya lo era), fiestas enviadas, sugerencias (el del ayuntamiento) y cartas. Para lo comarcal, **Caudal**: concejo oculto (sin página, sin espacio municipal, fuera del menú) que crea la migración; los formularios públicos `/fiestas/enviar` y `/cartas/enviar` lo ofrecen y no dejan enviar sin concejo. |
| 15. Bandeja «Pendiente de revisar» | `/cms/bandeja` (y su comienzo en el inicio del CMS): fiestas enviadas, sugerencias y cartas, por fecha, con concejo y responsable. Primero lo de tus concejos (los tuyos, los de quien esté fuera y los que no tienen responsable); después, el resto: es compartida, cualquiera lo ve y lo resuelve. En un clic: **Publicar** (fiesta, carta) o **Atendida** (sugerencia), o **Rechazar** con un motivo de una lista que edita la administración (**Motivos de rechazo**) y nota opcional (en las cartas, se envía al autor). Cada elemento muestra quién lo resolvió y cuándo. Debajo, lo publicado por los ayuntamientos, con **Retirar** (motivo obligatorio). Las sugerencias pasan a verlas toda la redacción. |
| 16. Avisos | Solo de lo que requiere intervención: un correo al responsable del concejo con el enlace directo al elemento en la bandeja. Con «Fuera hasta [fecha]» en su perfil, va al otro redactor hasta esa fecha. Sin responsable (Caudal), a los redactores presentes. Las sugerencias ya no escriben a la administración. |
| 17. Resumen diario | A las 8:00 (Madrid), solo si hay algo, a cada redactor: lo publicado por los ayuntamientos de sus concejos en las últimas 24 horas y lo pendiente en su bandeja, con enlaces. Se desactiva en el perfil. Ningún correo suelto por publicaciones municipales. Lo envía la propia web (`instrumentation.ts`): no hace falta cron. A mano: `npm run cms:resumen`. |
| 18. Manual y pruebas | Manual de operación, apartado 27 (y 12, 14, 15, 19 y 20 enlazan con él); manual del ayuntamiento (sugerencias). Bloque de pruebas `scripts/participacion-redaccion.mjs`; ajustadas las de responsables, sugerencias, `block2` e `instalacion` (un concejo más, Caudal). |

### E. Documentación

- `docs/MANUAL-OPERACION.md`: apartado 27, la redacción (bandeja, avisos, «Fuera hasta», resumen diario y Caudal); los apartados 5, 12, 14, 15, 19 y 20 enlazan con él.
- `docs/MANUAL-AYUNTAMIENTOS.md`: nuevo apartado «Las pestañas del panel» y apartados de «Mis publicaciones» y de las otras pestañas reescritos.
- Las capturas del manual son las de antes. `scripts/manual-screenshots.mjs` ya apunta a las pestañas nuevas: se regeneran con `MANUAL_SCREENSHOTS=true` al pasar `npm run test:launch`.

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

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente. **Anota la versión actual** (debería ser `d7d348f`).

**2. Fijar el commit y desplegar:**

```bash
git fetch origin desarrollo/planta14-v2-panel
```

```bash
git checkout --detach HASH-PENDIENTE
```

```bash
git log -1 --format='%h %s'
```

Debe mostrar el commit fijado arriba (pendiente).

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production HASH-PENDIENTE
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0, y aplicar `20261106_124731_redaccion`.

**3. Comprobar el estado otra vez:**

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir `/api/health: ok` y la versión fijada (pendiente).

**4. Si algo falla: volver a la versión anterior.** Si `deploy.sh` terminó con código 1 o 2, sigue lo que dice. Si el despliegue fue bien pero algo no funciona después, vuelve a desplegar la versión anotada en el paso 1:

```bash
git checkout --detach d7d348fcb9f873307b9f8ed5afa3c5f602c1c9fe
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production d7d348fcb9f873307b9f8ed5afa3c5f602c1c9fe
```

La migración nueva solo **añade** columnas, una tabla de ajustes, un tipo de pendiente («sugerencia») y el concejo oculto Caudal, que la versión anterior no usa: no hace falta deshacerla. Si se deshiciera, se borran antes los pendientes de tipo sugerencia; Caudal se queda (puede tener noticias o fiestas). Los enlaces con `?pestana=` siguen abriendo el panel en la versión anterior (sin pestañas).

## Qué mirar en el navegador

En el ordenador (1440 y 1024 px), la tableta (768) y el móvil (390), sin barra de desplazamiento horizontal:

- **`/mieres/panel` con una cuenta municipal de Mieres** (o la de otro concejo activo):
  - al entrar, la pestaña «Publicar»; arriba, las seis pestañas (en el móvil, en una fila que se desliza);
  - en «Publicar», la casilla de los derechos de la imagen, pequeña y con el texto al lado;
  - «Mis publicaciones»: una línea por publicación, 10 por página, los filtros por tipo y estado; «Editar» la abre en «Publicar»;
  - «Útil» y «Sugerencias»: casillas en dos columnas (una en el móvil) y el botón a la vista;
  - «Directorio»: buscador, «Añadir servicio» abre el formulario; «Editar» lo abre en su fila;
  - «Visitas»: total, una fila de barras, CSV y PDF;
  - al pie, «Condiciones de uso del espacio municipal» y sin el bloque del boletín;
  - recarga la página en cada pestaña: se queda en la misma.
- **`/mieres`, `/aller`, `/lena`:** los escudos, de la misma altura.
- **`/aller/util`:** el tiempo con iconos, dos días por fila.
- **`/morcin`:** la raya bajo el título, de lado a lado.
- **Portada:** las casillas del boletín verde, pequeñas y con su texto al lado; los concejos de dos en dos.
- **Pie de cualquier página:** sin «Condiciones de las cuentas municipales»; «Elegir concejos» abre casillas pequeñas.
- **CMS con la cuenta de Andrés o de Juanfran:**
  - en el inicio, debajo de los accesos, «Pendiente de revisar» con lo de sus concejos y sus botones;
  - en `/cms/bandeja`, «De tus concejos», «Del resto de concejos», «Resuelto recientemente» y «Publicado por los ayuntamientos»;
  - en tu cuenta (arriba a la derecha), «Avisos y resumen»: resumen diario marcado y «Fuera hasta» vacío.
- **Formularios públicos:** en `/fiestas/enviar`, el concejo es obligatorio y ofrece «Caudal (varios concejos o toda la comarca)». En el menú no aparece Caudal.
- **Administración:** en el inicio, «Motivos de rechazo» con los cinco motivos iniciales.
- **Prueba del aviso** (con una cuenta municipal de prueba de un concejo de Juanfran, si la hay; si no, déjalo para la primera sugerencia real): envía una sugerencia desde su panel; a Juanfran le llega «Pendiente de revisar: Sugerencia de …» con el enlace a la bandeja. Márcala como **Atendida**: aparece en «Resuelto recientemente» con tu nombre y la hora.
- **Resumen:** al día siguiente, a partir de las 8:00, si hay algo, llega «Planta 14, resumen del día». Para probarlo antes: `migrate npm run cms:resumen`.
- **`/condiciones-cuentas-municipales`:** se abre igual, pero en el código fuente (Ctrl+U) lleva `<meta name="robots" content="noindex, nofollow">`; no aparece en `/sitemap.xml`.

## Resultados de la batería completa

**Pendiente.** Se pasará una sola vez, cuando se decida desplegar (después de los cambios que pidan los periodistas). Hasta entonces, solo pruebas rápidas de lo tocado: ver el informe de cada entrega.

## Dudas resueltas por prudencia

1. **Causa raíz:** la corrijo en la regla general (excluir casillas y radios), no con parches en cada formulario. Así no puede volver a pasar en un formulario nuevo.
2. **CMS:** sus casillas son de Payload, con sus propios estilos; no las toca la regla rota. Las reviso, pero no cambio nada.
3. **Pestañas:** se cambian en el navegador, sin recargar, y actualizan la dirección (`?pestana=`). «Publicar» no lleva parámetro. Funcionan con los botones Atrás y Adelante.
4. **Fecha en «Mis publicaciones»:** es la del último cambio, que es la que sirve para encontrar lo que se acaba de tocar.
5. **Filtro de estado:** «Publicado» incluye «Publicado · cambios sin publicar»; «Retirado» es filtro propio.
6. **Barras de visitas:** solo en el panel. El CMS de la administración mantiene la tabla por días, que es más útil para revisar cifras.
7. **Condiciones:** las enlazo desde la entrada al panel y desde el panel ya abierto. En el aviso legal quito el enlace y dejo el texto («conforme a las condiciones de uso de las cuentas municipales»), para no cambiar su contenido legal. La página no cambia.
8. **Escudos:** alto fijo y ancho máximo, con `object-fit: contain`: ningún escudo se deforma ni se recorta.
9. **Tiempo en `/[concejo]/util`:** cuatro días, dos por fila, con el diseño de la franja de `/util`.
10. **Boletín en el panel:** lo escondo solo en `/[concejo]/panel` (y sus subpáginas), no en el resto del pie.
11. **Boletín de la portada:** la comprobación nueva encontró que a 1024 px «Ribera de Arriba» partía en dos líneas y la casilla quedaba entre ambas. Pongo los concejos de dos en dos en ese bloque.
12. **Panel de demostración** (sin CMS): no cambia.
13. **Capturas del manual:** no las regenero en este encargo; el script ya está preparado para las pestañas.
14. **Caudal como concejo oculto:** un concejo más en la base de datos (`visible: false`), sin página ni espacio municipal. Así «Concejo» sigue siendo un único campo obligatorio en todo, y las tarjetas dicen «Caudal». Las pruebas que contaban seis concejos ahora cuentan siete. No tiene responsable: lo suyo avisa a los redactores presentes y sale en la bandeja de todos como «de tus concejos». La administración le puede poner responsable en **Concejos**.
15. **Bandeja sobre «Pendientes de revisar»:** la bandeja es la colección que ya existía, ampliada; no hay una segunda lista. Las publicaciones municipales siguen registrándose allí (para el resumen), pero ya resueltas: no esperan nada. La migración marca así las antiguas.
16. **«Aprobar» en cada tipo:** fiesta = publicarla (si no se puede, por ejemplo sin fechas confirmadas, la bandeja dice por qué y se abre la ficha); carta = publicarla; sugerencia = «Atendida». **Rechazar:** la fiesta se queda en borrador (sin correo a quien la envió, como hasta ahora); la carta se rechaza y el motivo, con la nota, se envía al autor (como hasta ahora); la sugerencia queda descartada, sin aviso al ayuntamiento.
17. **Motivos de rechazo:** una sola lista para todo, editable solo por la administración (como los lemas). Cinco motivos iniciales.
18. **Sugerencias para toda la redacción:** antes solo las veía su responsable; la bandeja compartida lo exige. Ajustado el manual del ayuntamiento. Los DNI y teléfonos de las cartas siguen viéndolos solo la administración y el responsable del concejo.
19. **Avisos:** las sugerencias ya no escriben a la administración (solo al responsable). «El otro redactor»: los demás responsables de algún concejo que no estén fuera; si no hay ninguno, el aviso no se envía y queda en la bandeja.
20. **Resumen diario:** «lo publicado ese día» son las últimas 24 horas antes del envío (a las 8:00 del día apenas hay nada). Solo publicaciones aún publicadas y no retiradas. Quien está fuera no lo recibe; lo de sus concejos va en el del otro redactor. Lo dispara la propia web (sin cron en el servidor): si estuviera parada a las 8:00, sale al arrancar; nunca dos veces el mismo día.
21. **Aviso general de publicaciones municipales** (`MUNICIPAL_NOTICE_EMAIL_ENABLED`, a un buzón de la administración y desactivado por defecto): no lo toco; es un ajuste del servidor, no un aviso a los redactores.
22. **«Mis concejos»** (de la entrega anterior) desaparece como página propia: su lista de publicaciones municipales con **Retirar** queda al final de la bandeja, y la preferencia del perfil se convierte en «Resumen diario» y «Fuera hasta». El correo por cada publicación municipal se quita.
23. **Pruebas que leían el panel sin pestaña** (de la entrega de las pestañas): `block3-integration`, `block3-browser`, `infra/test/staging-browser.mjs` y `manual-screenshots` buscaban las publicaciones en `/lena/panel`; ahora van a `?pestana=publicaciones`. `block3` pasa. `block3-browser` (opcional, `CMS_BLOCK3_BROWSER_TEST`) no se puede ejecutar aquí (le falta una herramienta local) y `staging-browser` va en la batería: usan los mismos selectores que ya prueba el bloque del panel.

