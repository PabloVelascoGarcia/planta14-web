# Instalar los retoques de portada (tras la retirada del ensayo)

Para Claude Code en el PC de Pablo (Code local), con el agente SSH cargado.

Rama **`desarrollo/planta14-v2-retoques-portada`**, creada desde **`a4e8c86`** (lo instalado en pruebas). No se han
tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

**Commit a desplegar: `b8bd04a`** (`b8bd04a730acc4b0144b4997b7e4b077eec0214e`).

- **Sin migraciones.** Los campos que se ocultan a la redacción solo dejan de verse en el formulario: no cambia la
  base de datos.
- **No borra ni modifica contenido**: ni noticias, ni imágenes, ni fiestas, ni patrimonio, rutas, servicios o espacios
  municipales. Solo cambia cómo se pinta lo que hay.
- **Caddy no cambia.** No hay pasos después del despliegue.

## Qué cambia

| Punto | Cambio |
|---|---|
| 1. Bloques vacíos | Un bloque sin contenido no se pinta, ni su título ni su «Ver todo». **Portada:** «La vida aquí», «Caudal», «Opinión / Más historias» y «Para salir» solo salen con algo dentro; si en una fila queda un solo bloque, ocupa todo el ancho; con una sola noticia, la principal va centrada sin columna lateral; el enlace «La agenda de las cuencas» solo sale si hay citas. **Espacios municipales activos sin publicaciones:** sin Agenda, Avisos, Ayudas ni pestañas vacías, con un texto breve («Todavía no hay publicaciones de …») y, si se abre una sección vacía, «Ahora mismo no hay … de …». **/agenda** sin citas: texto breve. **Concejo, sección y etiqueta** ya mostraban un texto breve cuando no hay noticias (sin cambios). |
| 2. «Para salir» | Sin cambio de criterio (ver abajo). Ahora, sin citas, el bloque no sale. |
| 3. Campos técnicos | La redacción ya no veía en la noticia «Identificador de origen», «Procedencia» ni «Lote de la carga de ensayo» (desde `593b0f1`). Ahora tampoco ve el identificador de importación de **fiestas, patrimonio, rutas y servicios** ni, en **imágenes**, los usos publicados, la clave, el almacenamiento y la dirección de la copia pública. La administración lo sigue viendo todo. |
| 4. Opinión | Ya estaba hecho (desde `593b0f1`): la casilla se marca o desmarca sola al guardar según la sección principal o secundaria, y no se puede tocar a mano. Sin cambios. |
| 5. Logotipo | Ya estaba hecho (desde `593b0f1`): logotipo de Planta 14 en la pantalla de acceso, icono en el menú y en la pestaña. Sin cambios. |
| 6. Manuales | Redacción: sección «Imágenes hechas con IA» con la norma; línea sobre las fotos de paisaje de los concejos de la biblioteca; fuera las referencias a la carga de ensayo que no aplican a la redacción. Ayuntamientos: una línea sobre las partes de su página que no salen hasta tener publicaciones. Capturas regeneradas con el CMS y el panel reales. |

## «Para salir»: por qué sale vacío y qué criterio aplica

El bloque muestra las **4 próximas citas**, sin límite de fechas hacia delante: noticias de la sección Agenda con fecha
del evento, eventos de los espacios municipales activos y fiestas que **no hayan terminado**. Una fiesta solo cuenta si
está **publicada** y con la fecha **confirmada**.

Las fiestas que entran desde el **catálogo de fiestas** (importador) entran siempre como **borrador** y, casi todas,
con la fecha «orientativa» o «pendiente». Así, mientras nadie confirme las fechas y las publique, no salen en la web, y
las que se publicaron con fecha de este verano ya han terminado. Por eso «Para salir» no tenía nada, aunque haya 50
fiestas cargadas.

El criterio ya es el razonable («las próximas que haya, aunque estén lejos»), así que no se ha cambiado. Mostrar
fechas sin confirmar en la web no sería prudente. Para que salgan: en **Fiestas**, abrir cada una, confirmar las
fechas de 2027 (o usar **Duplicar para el año siguiente** en las que se repiten), marcar «Confirmada» y publicar. La
lista de Fiestas muestra el estado de la fecha y si está publicada.

## Memoria de la compilación

Mismo método que en las entregas anteriores (etapa «build» de `infra/app.Dockerfile` en `node:22`,
`CMS_ENABLED=false`, `LOW_MEMORY_BUILD=true`, 768 MiB de montón; pico del contenedor):

| Versión | Pico |
|---|---|
| `a4e8c86` (lo instalado) | 1.744 MiB |
| **`b8bd04a` (esta entrega)** | **1.673 MiB** (−4 %: sin aumento; la diferencia entra en la variación normal de la medida) |

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

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente, y la versión `a4e8c86`.

**2. Fijar el commit y desplegar:**

```bash
git fetch origin desarrollo/planta14-v2-retoques-portada
```

```bash
git checkout --detach b8bd04a730acc4b0144b4997b7e4b077eec0214e
```

```bash
git log -1 --format='%h %s'
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production b8bd04a730acc4b0144b4997b7e4b077eec0214e
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0 y **sin migraciones nuevas**.

**3. Estado otra vez:**

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir `/api/health: ok` y la versión `b8bd04a`.

**4. Si algo falla:** si `deploy.sh` terminó con código 1 o 2, sigue lo que dice. Si fue bien pero algo no funciona,
vuelve a `a4e8c86` (no hay nada que deshacer en la base de datos):

```bash
git checkout --detach a4e8c86732548e77598532bc230d1b22527dbe64
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production a4e8c86732548e77598532bc230d1b22527dbe64
```

## Comprobaciones después del despliegue

En el ordenador y en el móvil:

1. **Portada:** con las 3 noticias, la principal y «En portada» con las otras dos; debajo, «Tu ayuntamiento, aquí» y
   el boletín. Ya no salen «La vida aquí», «Caudal», «Más historias» ni «Para salir» vacíos.
2. **Un espacio municipal** (por ejemplo `/lena`): sin Agenda, Avisos ni Ayudas vacíos; el texto «Todavía no hay
   publicaciones de …», los reportajes de «Descubre…» si los tiene y «Útil». Las pestañas: Noticias, Contacto y Útil.
3. **/agenda:** el texto «No hay citas próximas…» mientras no haya citas.
4. **Campos técnicos:** con una cuenta de la redacción, en una imagen no salen la clave ni el almacenamiento de la
   copia pública, y en una fiesta, un patrimonio o una ruta no sale el identificador; con la administración, sí.
5. **Ayuda del CMS:** la sección «Imágenes hechas con IA» y la línea de las fotos de paisaje de la biblioteca.

## Pruebas

Batería reducida, la que corresponde a un cambio acotado (no la completa: no hay migraciones, ni cambios de despliegue,
de Caddy o de copias). Sobre `17c1633` (la aplicación de `b8bd04a`, que solo añade ajustes de pruebas y las capturas):

| Suite | Resultado |
|---|---|
| `npm test` | 11 PASS |
| Tipos | sin errores |
| Lint | 0 errores (29 avisos, los mismos de antes) |
| Compilación | correcta, con los manuales generados |
| Instalación | 16 PASS |
| Participación (CMS, panel y seguridad: todos los bloques) | **71 PASS** (los 68 anteriores y 3 nuevos de `participacion-retoques`: portada sin bloques vacíos, también con 3 noticias como en pruebas, en ordenador y móvil y sin desplazamiento horizontal; espacio municipal activo sin publicaciones; campos técnicos ocultos a la redacción) |
| `staging-e2e` | SUPERADO |
| Limpieza | 0 volúmenes nuevos |

En la primera pasada, la participación falló por dos pruebas, no por la web: una de fiestas recortaba la portada hasta
el bloque de Opinión, que ahora no se pinta cuando está vacío, y la nueva no contaba la noticia principal como
contenido. Corregidas (`b8bd04a`), la participación completa se repitió entera: 71 PASS, con las capturas de los dos
manuales regeneradas con el CMS y el panel reales.

## Dudas resueltas por prudencia

1. **«Para salir»:** no se muestran fiestas con fecha orientativa o pendiente; el criterio no cambia (ver arriba).
2. **Pestañas del espacio municipal:** Noticias y Contacto salen siempre (Contacto tiene siempre contenido); Avisos,
   Agenda, Ayudas y Tablón, solo con alguna publicación. Si alguien abre una sección vacía por un enlace, ve un texto
   breve con un botón para volver a Noticias.
3. **Imágenes:** además de la clave y el almacenamiento de la copia pública, también se ocultan a la redacción los
   «usos publicados» y la dirección pública de la copia: son datos internos. La administración los ve.
4. **Fiestas:** las «Fuentes» y las «Notas del catálogo» se mantienen visibles para la redacción: son información de
   trabajo, no datos técnicos.
5. **Opinión y logotipo:** ya estaban hechos; no se han tocado.
