# Contenido de ensayo: cargarlo y retirarlo

Para ver la web llena durante la preproducción, `contenido-ensayo/` trae 56 piezas preparadas. El ensayo se carga con una orden y se retira con otra. La retirada solo borra lo que se cargó como ensayo: nunca toca lo que escriban los periodistas.

## Qué se carga

| Tipo | Cuántas | Lote |
|---|---|---|
| Noticias | 24 | ensayo |
| Opiniones | 3 | ensayo |
| Carta del director («Darle al hierro») | 1 | ensayo (por indicación de Pablo; no se conserva) |
| Reportajes documentados (Bustiello y el segundo reportaje) | 2 | **definitivo**: se conservan al retirar |
| Agenda general (actividades en la sección Agenda) | 6 | ensayo |
| Contenidos municipales de Mieres y Lena (avisos, eventos, ayudas, tablón) | 20 | ensayo |
| Fotos de Wikimedia Commons (originales) | 19 | ensayo, salvo las de los reportajes definitivos |

- **Lote.** Cada documento lleva el campo **Lote de la carga de ensayo**, en la barra lateral. Solo lo ve y lo cambia la administración. Si una pieza se quiere conservar, se cambia a «Definitivo» antes de retirar.
- **Fechas.** Las de los archivos se ignoran. Las publicaciones se reparten en los **4 días anteriores a la carga**, entre las 7:45 y las 21:00. Las actividades de agenda y los eventos municipales quedan en las **semanas siguientes**, a horas habituales. Si el texto citaba la fecha antigua del evento, se sustituye por la nueva.
- **Aviso de ensayo.** El párrafo «Contenido ficticio de ensayo…» va al final de cada pieza.
- **Todo sale publicado**, con su sección, su concejo, su autor y la opción **Mostrar en la página del concejo** que trae cada pieza. La carta y las opiniones no salen en la página del concejo.
- **Autores.** Se crean los que falten: Pablo Velasco, Redacción Planta 14 y Firma invitada.
- **Agenda general.** Las 6 actividades aparecen en la agenda de la portada («Para salir») y en `/agenda`, junto a los eventos municipales, ordenadas por fecha y solo mientras no hayan pasado. Cada una enlaza a su noticia.
- **Espacios de Mieres y Lena.** Se activan para que se vean sus contenidos municipales. Antes se guarda su estado, que vuelve a quedar como estaba al retirar el ensayo.
- **Fotos:**
  - Se descargan los **originales** de Commons, se comprueba que tienen la resolución anotada y se suben a **Imágenes**. Llevan autor, licencia y enlace a la ficha, en «Autoría o crédito» y «Dirección de origen».
  - Cada una lleva una **declaración de derechos de la administración** que cita la fuente, el autor y la licencia.
  - Una misma foto puede ilustrar varias piezas. Las fotos solo son de contexto y nunca documentan los hechos ficticios.
  - Tres piezas no tienen foto válida (`p14-noticia-20`, `p14-noticia-24` y `p14-agenda-06`) y salen sin imagen.
  - **Candidatas de cabecera.** Están entre esas 19 fotos, pero **no se asignan** a los concejos. Si quieres usar una: **Espacios municipales → Identidad visual → Foto de cabecera** (`docs/MANUAL-OPERACION.md`, apartado 11).

## Cargar

En el servidor, como `planta14`, desde `/srv/planta14/app`. Primero comprueba qué haría, sin escribir nada:

```bash
bash infra/deploy/ensayo.sh --env-file infra/.env.production cargar --solo-comprobar
```

Dice cuántas noticias, contenidos municipales, imágenes y autores crearía y qué espacios activaría. Termina en «COMPROBACIÓN TERMINADA (sin cambios)». Después, de verdad:

```bash
bash infra/deploy/ensayo.sh --env-file infra/.env.production cargar
```

Tarda unos minutos, sobre todo por las fotos. Termina en «CARGA TERMINADA». **Se puede repetir sin miedo:**
- lo que ya está no se duplica ni se modifica;
- las fotos ya subidas no se vuelven a descargar;
- si se corta a medias (por ejemplo, si Commons no responde), al repetir se completa lo que falte.

Hace falta:
- la estructura cargada (`npm run cms:structure`, paso 6 bis de la guía de instalación);
- un administrador;
- salida a Internet desde el servidor hacia `upload.wikimedia.org`.

La orden registra al primer administrador como autor de la carga. Con `--usuario correo@…` se elige otro administrador.

## Retirar

Primero comprueba qué borraría:

```bash
bash infra/deploy/ensayo.sh --env-file infra/.env.production retirar --solo-comprobar
```

Después, de verdad:

```bash
bash infra/deploy/ensayo.sh --env-file infra/.env.production retirar
```

1. **Antes de borrar nada**, hace una copia de seguridad de la base de datos y de los originales de las imágenes con las herramientas de siempre (`backup-postgres.sh` y `backup-storage.sh`). Si falla la copia, no retira nada.
2. Borra **solo lo marcado como ensayo**: las piezas, los contenidos municipales, las imágenes que no use nada más, con sus copias públicas, y los autores que ya no firmen nada.
3. **Conserva:**
   - lo marcado como **definitivo** (los dos reportajes y sus fotos);
   - **todo lo que no lleve la marca**, aunque se haya creado después de la carga: las noticias de los periodistas;
   - las fotos del ensayo que use algo real, como una noticia nueva o la cabecera de un concejo. Dejan de estar marcadas como ensayo y quedan como imágenes normales.
4. **Espacios municipales.** Mieres y Lena vuelven a su estado previo, salvo que alguien los haya cambiado después de la carga. En ese caso se dejan como están y se avisa.
5. **Constancia.** Queda en **Auditoría** una entrada «Retirada del contenido de ensayo» con lo borrado y el nombre de la copia previa, además de una entrada por cada documento borrado. En el servidor queda en `historial.log`.

Termina en «RETIRADA TERMINADA». Repetirla no hace nada.

La orden `npm run cms:ensayo:retirar` no se debe lanzar directamente: se niega a borrar sin la copia previa, que es precisamente lo que añade `ensayo.sh`.

## Ojo

- Para conservar una pieza del ensayo, cambia su **Lote** a «Definitivo» (como administración) antes de retirar.
- Una vez cargado el ensayo, la migración del campo lote no se puede deshacer hasta retirarlo, para no perder las marcas.
- Si en el ensayo se cambia la foto de una pieza por otra de Imágenes que no es del ensayo, esa foto no se toca al retirar.
