# Arreglo urgente: noticia con ilustración generada con IA (y pie de la foto principal)

Para Claude Code en el PC de Pablo (Code local), con el agente SSH cargado.

Rama **`desarrollo/planta14-v2-retoques-portada`**, sobre **`b8bd04a`** (lo instalado en pruebas). No se han tocado
`main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

**Commit a desplegar: `c133547`** (`c13354769f63fef5a5d899eabe1a646e24a63a4f`).

- **Una migración, solo de esquema:** `20261125_182900_pie_foto_principal` añade la columna vacía «Pie de foto» a las
  noticias y a su historial de versiones. **No cambia ninguna noticia** ni ningún otro dato.
- Arreglo de estilos de la imagen de IA, «Pie de foto» de la foto principal, manual de la redacción y pruebas.
- Caddy no cambia. No hay pasos después del despliegue.

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
3. **Decisión del 25/11** (tras hablarlo con la redacción): se añade. En la noticia, justo debajo de **Foto
   principal**, el campo opcional **Pie de foto** (hasta 300 caracteres; solo aparece si hay foto). En la web sale bajo
   la foto, delante de la autoría: «La pista de Masgaín, uno de los ocho proyectos financiados. Fotografía:
   Ayuntamiento de Lena». También en la vista previa. No se reutiliza el **texto alternativo**: ese describe lo que se
   ve para quien no puede verlo (lectores de pantalla y buscadores); el pie da el contexto periodístico, y usar el mismo
   texto haría que el lector de pantalla lo leyera dos veces.

El manual de la redacción lo explica en «La foto principal» y en «Dudas frecuentes», con la captura del formulario.

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
git checkout --detach c13354769f63fef5a5d899eabe1a646e24a63a4f
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production c13354769f63fef5a5d899eabe1a646e24a63a4f
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0, y decir «Migraciones aplicadas: 20261125_182900_pie_foto_principal». Después, `status.sh` otra vez: versión
`c133547`.

**Vuelta atrás a `b8bd04a`**, **sin deshacer la migración** (solo añade una columna que la versión anterior no usa;
los pies escritos se conservan y vuelven a salir al reinstalar esta versión):

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
4. **Pie de foto:** con una cuenta de la redacción, abre una noticia con foto: debajo de «Foto principal» está «Pie de
   foto». Escribe uno, publica y comprueba que sale bajo la foto, delante de «Fotografía: …». Sin pie, la noticia se ve
   como antes.

## Pruebas

Batería reducida (cambio acotado), y como hay una migración, también `production-deploy-test.sh`. Sobre `5fed270`
(la aplicación de `c133547`, que solo añade la captura del formulario), todo superado:

| Suite | Resultado |
|---|---|
| **`production-deploy-test.sh`** | **SUPERADO** (despliegue con la migración `pie_foto_principal`, mantenimiento, vuelta atrás y restauración asistida; las dos líneas «FALLO: /api/health no responde» son las vueltas atrás que la prueba provoca a propósito) |
| `npm test` | 11 PASS |
| Tipos | sin errores |
| Lint | 0 errores (29 avisos, los mismos de antes) |
| Compilación | correcta (manuales generados) |
| Instalación | 16 PASS |
| Participación (CMS, panel y seguridad: todos los bloques) | **72 PASS**, con las capturas del manual regeneradas |
| `shellcheck` de `infra/deploy` | sin avisos |
| `staging-e2e` | 9 PASS, SUPERADO |
| Limpieza | 0 volúmenes nuevos |

La primera pasada de `production-deploy-test.sh` y de la imagen de staging falló porque el disco del contenedor de
pruebas estaba lleno (caché de construcción de Docker). Tras liberarlo, las dos se repitieron enteras y salieron bien;
el resto no se vio afectado.

**Memoria de compilación** (mismo método de siempre): 1.724 MiB, frente a 1.744 MiB de `a4e8c86` y 1.673 MiB de
`b8bd04a`. Está dentro de la variación normal de la medida.

**Pruebas nuevas:**

- **Ilustración de IA** (bloque «redacción (imágenes en el texto)»). Carga una noticia con ilustración principal de IA,
  en ordenador (1366 px) y en móvil (390 px). Comprueba que el envoltorio mide lo que la imagen, que el pie de foto va
  justo debajo, que el cuerpo empieza justo debajo de la imagen, que el pie de página queda después del cuerpo y que el
  rótulo está en la esquina inferior izquierda de la imagen. Además recorre la noticia con bloque Imagen, /multimedia,
  la portada, un concejo, un espacio municipal y dos secciones, y comprueba que el rótulo queda dentro de cada imagen
  de IA. Con el CSS antiguo falla, como debía: el envoltorio medía 918 px con una imagen de 475 px y el pie de página
  quedaba por encima del cuerpo.
- **Fotos para la redacción** (bloque `participacion-retoques`), con una cuenta de rol editor en el navegador:
  - en la ficha de la imagen, el texto alternativo, la autoría o crédito, el enlace de origen y el titular se ven y se
    pueden editar, y el crédito nuevo sale bajo la foto principal;
  - en la noticia, «Pie de foto» se ve, se escribe, se guarda y sale bajo la foto, delante de la autoría;
  - los bloques Imagen y Galería tienen su «Pie de foto».
