# Instalar el panel municipal en pestañas y los retoques

Para Claude Code en el PC de Pablo (Code local), con el agente SSH cargado.

Rama **`desarrollo/planta14-v2-panel`**, creada desde `desarrollo/planta14-v2-final` (`ff10f48`). **Commit a instalar: `869527f`** (`869527f938d4f3142176a8ca7a52b6301e5b2b03`). Los commits siguientes solo cambian documentación (este documento y el manual del ayuntamiento). No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

Se instala sobre `d7d348f` (la versión final de salida). **No hay migraciones nuevas**: solo cambia el código de la web.

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

### D. Documentación

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
git checkout --detach 869527f938d4f3142176a8ca7a52b6301e5b2b03
```

```bash
git log -1 --format='%h %s'
```

Debe mostrar `869527f Panel municipal en pestañas, casillas corregidas y retoques [skip netlify]`.

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production 869527f938d4f3142176a8ca7a52b6301e5b2b03
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0. No aplica ninguna migración nueva.

**3. Comprobar el estado otra vez:**

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir `/api/health: ok` y la versión `869527f`.

**4. Si algo falla: volver a la versión anterior.** Si `deploy.sh` terminó con código 1 o 2, sigue lo que dice. Si el despliegue fue bien pero algo no funciona después, vuelve a desplegar la versión anotada en el paso 1:

```bash
git checkout --detach d7d348fcb9f873307b9f8ed5afa3c5f602c1c9fe
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production d7d348fcb9f873307b9f8ed5afa3c5f602c1c9fe
```

No hay migraciones que deshacer ni datos que tocar: todo lo de esta versión es código de la web. Los enlaces con `?pestana=` siguen abriendo el panel en la versión anterior (sin pestañas).

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
- **`/condiciones-cuentas-municipales`:** se abre igual, pero en el código fuente (Ctrl+U) lleva `<meta name="robots" content="noindex, nofollow">`; no aparece en `/sitemap.xml`.

## Resultados de la batería completa

(Se completa al terminar la pasada.)

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
