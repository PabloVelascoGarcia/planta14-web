# Arreglo urgente: noticia con ilustración generada con IA

Para Claude Code en el PC de Pablo (Code local), con el agente SSH cargado.

Rama **`desarrollo/planta14-v2-retoques-portada`**, sobre **`b8bd04a`** (lo instalado en pruebas). No se han tocado
`main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

**Commit a desplegar: `dbb383c`** (`dbb383cdb25c6ce63172f9d37469b63eb54204ce`).

- **Sin migraciones.** Solo estilos, un atributo en la vista de la noticia, una aclaración en el manual de la
  redacción y pruebas.
- No toca contenido. Caddy no cambia. No hay pasos después del despliegue.

## El fallo y el arreglo

En una noticia cuya foto principal es una «Ilustración generada con IA», el envoltorio de la imagen (`.ai-image`)
tenía `height: 100%`. En la noticia, su contenedor de la rejilla lo estiraba a toda la columna (unos 3.659 px): la
imagen arriba, un hueco enorme debajo, el rótulo abajo del todo y el cuerpo por debajo del pie de página.

Ahora `.ai-image` mide lo que la imagen (`height: auto`) en todas partes: la noticia, los bloques Imagen y Galería
del cuerpo, las tarjetas con proporción fija, /multimedia y los espacios municipales. Solo la **tarjeta horizontal**
(Caudal, Más historias), que tiene un hueco de alto fijo, lo llena entero, con una clase aparte (`.is-fill`), igual
que antes. El rótulo queda siempre en la esquina inferior izquierda de la propia imagen.

Revisado donde se pinta una imagen de IA:

| Sitio | Cómo se pinta | Resultado |
|---|---|---|
| Foto principal de la noticia | envoltorio `.ai-image` | **era el fallo**; corregido |
| Bloques Imagen y Galería del cuerpo, galería ampliada | su propio marco, con el rótulo encima | sin cambio; bien |
| Tarjetas de portada, sección, etiqueta, concejo y /multimedia | `.ai-image` con la imagen en proporción fija | bien con `height: auto` |
| Tarjeta horizontal (alto fijo) | `.ai-image.is-fill` | llena el hueco, como antes |
| Espacios municipales («La mirada de Planta 14») | `.ai-image`, imagen de 145 px | bien |
| Ficha de fiesta | su propio marco | sin cambio; bien |
| Imagen para redes 1200×630 | se genera en el servidor, sin estos estilos | sin cambio; su prueba sigue en verde |

## Pie de foto de la foto principal (consulta de un redactor)

Comparado `a4e8c86` con `b8bd04a`, con una cuenta de rol editor:

1. **Dónde se escribe:** la foto principal **no tiene pie propio, ni lo ha tenido nunca** (tampoco en versiones
   anteriores). Bajo ella sale la **autoría o crédito** de su ficha («Fotografía: …»), que se cambia en la ficha de la
   imagen (en Imágenes o con el lápiz junto a la foto de la noticia). El **Pie de foto** existe solo en los bloques
   **Imagen** y **Galería** del texto, y es obligatorio allí.
2. **Lo ocultado en `b8bd04a`:** solo cuatro datos internos de la imagen (usos publicados, clave, almacenamiento y
   dirección de la copia pública). El texto alternativo, la autoría o crédito, el enlace de origen, el titular y el tipo
   de derechos **no se tocaron**: la redacción los ve y los edita igual que en `a4e8c86`. No había nada que restaurar.
3. **No se ha añadido** un pie propio para la foto principal. Si se quiere, es un cambio aparte (un campo en la
   noticia, con su migración solo de esquema).

Para el redactor, el manual tiene ahora en «Dudas frecuentes»: «¿Dónde pongo el pie de foto de la foto principal?».

## Pasos en pruebas.planta14.com

```bash
ssh planta14@87.106.30.18
```

```bash
cd /srv/planta14/app
```

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir `/api/health: ok` y la versión `b8bd04a`.

```bash
git fetch origin desarrollo/planta14-v2-retoques-portada
```

```bash
git checkout --detach dbb383cdb25c6ce63172f9d37469b63eb54204ce
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production dbb383cdb25c6ce63172f9d37469b63eb54204ce
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0 y sin migraciones nuevas. Después, `status.sh` otra vez: versión
`dbb383c`.

**Vuelta atrás a `b8bd04a`** (no hay nada que deshacer en la base de datos):

```bash
git checkout --detach b8bd04a730acc4b0144b4997b7e4b077eec0214e
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production b8bd04a730acc4b0144b4997b7e4b077eec0214e
```

## Comprobaciones después del despliegue

En el ordenador y en el móvil:

1. **La noticia del fallo**
   (`/noticia/casi-850-000-euros-para-transformar-la-montana-central-a-traves-de-ocho-proyectos-municipa`): la
   ilustración con su altura normal, el rótulo «Ilustración generada con IA» en su esquina inferior izquierda, el pie
   («Ilustración generada con IA. Autoría: …») justo debajo, el texto a continuación y el pie de página al final.
2. **Portada, su sección y su concejo:** la tarjeta de esa noticia con el rótulo dentro de la imagen.
3. **Compartir** la noticia (por ejemplo, en WhatsApp): la imagen para redes, como antes.

## Pruebas

Batería reducida (cambio acotado de estilos), una sola vez sobre `19cab8c` (la aplicación de `dbb383c`, que solo añade la
captura nueva del manual), todo superado:

| Suite | Resultado |
|---|---|
| `npm test` | 11 PASS |
| Tipos | sin errores |
| Lint | 0 errores (29 avisos, los mismos de antes) |
| Compilación | correcta |
| Instalación | 16 PASS |
| Participación (CMS, panel y seguridad: todos los bloques) | 71 PASS, con la prueba nueva en «redacción (imágenes en el texto)»; repetida sobre `dbb383c`: **72 PASS** (con la de las fotos para la redacción) |
| `staging-e2e` | SUPERADO |
| Limpieza | 0 volúmenes nuevos |

**La prueba nueva** carga una noticia con ilustración principal de IA, en ordenador (1366 px) y en móvil (390 px). Comprueba que:

- el envoltorio mide lo que la imagen;
- el pie de foto va justo debajo;
- el cuerpo empieza justo debajo de la imagen;
- el pie de página queda después del cuerpo;
- el rótulo está en la esquina inferior izquierda de la imagen.

Además recorre la noticia con bloque Imagen, /multimedia, la portada, un concejo, un espacio municipal y dos secciones, y comprueba que, en cada imagen de IA, el rótulo queda dentro de su imagen.

**Prueba de las fotos para la redacción** (bloque `participacion-retoques`), con una cuenta de la redacción en el navegador:

- en la ficha de la imagen, el texto alternativo, la autoría o crédito, el enlace de origen y el titular se ven y se pueden editar;
- al guardar, cambian, y el crédito nuevo sale bajo la foto principal de la noticia;
- en la noticia está «Foto principal»;
- los bloques Imagen y Galería tienen su «Pie de foto».

Sobre `dbb383c` se repitieron la compilación, los tipos y el lint, y la participación completa.

Antes de dar el arreglo por bueno, se pasó la prueba con el CSS antiguo y **falló**, como debía: el envoltorio medía
918 px con una imagen de 475 px y el pie de página quedaba por encima del cuerpo.
