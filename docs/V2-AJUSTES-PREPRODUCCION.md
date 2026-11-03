# Planta 14 v2: ajustes de la preproducción

Rama **`desarrollo/planta14-v2-ajustes-preproduccion`**, creada desde `desarrollo/planta14-v2-instalacion` (`9d91bf4`; en el servidor está instalado `c29e024`). No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

## Commit que se debe instalar

**`862379192f53b60f01e9fa553047c874601c0ab5`** (`8623791`)

Es el commit sobre el que se ejecutó la batería completa (abajo). El commit posterior, que añade este documento, solo cambia documentación.

## Qué se ha hecho

| Commit | Punto | Qué |
|---|---|---|
| `944f687` | 1 | **Sin restos de la demo con `CONTENT_SOURCE=payload`.** Fuera «Edición de demostración», el enlace «Demo municipal», «Textos e imágenes… fines de demostración», el bloque del semanal en portada y los textos de demo de contacto, publicidad, cookies y agenda. `/edicion`, `/niebla` y `/admin` dan 404. El panel municipal da 404 si el espacio está inactivo (decidido: el panel real sigue para espacios activos). La página del concejo no lee `localStorage` ni usa la fecha fija «2026-10-15»: el servidor quita lo caducado (fecha de Madrid). En payload no aparecen las etiquetas «Ejemplo» ni la invitación «Probar el panel · Demostración». **La demo queda igual.** |
| `383b88f` | 2 | **CMS en español:** i18n de Payload solo `es` y etiquetas en español en todas las colecciones (Usuarios, Imágenes, Noticias, Autores, Secciones, Concejos, Espacios municipales, Contenidos municipales…), sus campos, grupos y opciones de las listas. Sin cambios de esquema. |
| — | 3 | **Página del concejo con el espacio inactivo:** sin cambios de aspecto. La identidad del punto 5 carga los mismos valores; lo comprueba la prueba. |
| — | 4 | **Anulado** a petición de Pablo: se siguen viendo todas las pestañas, tengan contenido o no. |
| `b5cd0d2` | 5 | **Identidad visual de cada espacio municipal en el CMS** (detalle abajo), con migración de datos `20261103_000335_identidad_espacios`. |
| `d157108` | 6 | **Vista previa en vivo** de las noticias con el diseño público y **panel de inicio** del CMS según el rol. Campo «Creada por», con migración `20261103_001210_creado_por`. |
| `249ca17` | 7 | **`restore-test.sh`:** limpia lo que escribían los contenedores como root y sale con 0 si la prueba pasa. |
| `8623791` | — | Manuales: cambiar la foto, el lema y los colores de un concejo; escribir noticias en el CMS. |

### Identidad visual (punto 5)

En **Espacios municipales → Identidad visual**:
- **Foto de cabecera:** de **Imágenes**, que exige titular, tipo de derechos y ámbito «Publicable».
- **Foto actual (archivo de la web):** la que traía la web.
- **Foto:** descripción, autor y licencia (texto visible), enlace al original y enlace a la licencia.
- **Lema** y **Subtítulo.**
- **Escudo:** de Imágenes o el actual del archivo, con autor, licencia y enlaces.
- **Colores:** principal, oscuro, suave y bordes, en `#RRGGBB`.
- **Web oficial** y **Web de turismo** (`https://`).
- **Historias destacadas:** hasta 3.

Funcionamiento:
- **Permisos:** solo la administración edita estos campos (permiso de campo y de colección). La cuenta municipal los lee en solo lectura.
- **Copia pública:** una foto o escudo de Imágenes usado por un espacio publicado cuenta como uso publicado y obtiene copia pública, igual que las imágenes de las noticias. Al quitarlo, la copia se borra.
- **Datos actuales:** la migración carga los valores que la web tenía en `lib/demo/data/municipal-identities.json` y `lib/demo/aller.ts` en los seis espacios del Caudal que ya existen, y también en su última versión, la que abre el CMS. Así la web se ve igual tras desplegar. No sobrescribe nada que ya tenga valor. En instalaciones nuevas los pone `npm run cms:structure` al crear los espacios.
- **Campos vacíos:** se omite esa pieza. Sin los cuatro colores, colores neutros; sin escudo, el marcador «Escudo municipal»; sin créditos ni historias, no se muestran.

### Vista previa y panel de inicio (punto 6)

- **Vista previa en vivo.** En una noticia guardada, el botón **Previsualizar** abre la noticia con el diseño público (móvil, tableta o escritorio) y se actualiza mientras se escribe.
  - Ruta `/vista-previa/noticia/[id]`: solo con sesión del CMS de redacción o administración; 404 sin ella. Siempre `noindex` y fuera de `robots.txt`.
  - El cuerpo de la noticia está ahora en `components/article-view.tsx`, compartido con la página pública: el diseño es el mismo.
  - Se usa `@payloadcms/live-preview` 3.92.1, el paquete oficial y sin dependencias. La versión para React exige React ≥ 19.0.1 y el proyecto usa 19.0.0, así que no se cambió React.
- **Panel de inicio** de `/cms`:
  - **Nueva noticia**, **Mis borradores** (con su número) y **Publicadas hoy** (con su número);
  - la administración ve también **Avisos municipales sin revisar**, **Espacios municipales** y **Usuarios**.

  «Mis borradores» usa el campo nuevo **Creada por**, que pone el servidor al crear la noticia y no cambia después. Las noticias ya existentes quedan sin valor y no aparecen en «Mis borradores».

### restore-test.sh (punto 7)

- **Causa:** los S3 de prueba (`rclone serve`) corrían como root y escribían en `infra/test/out/`. Como `planta14` en el servidor, el `rm -rf` final fallaba y el script terminaba con código 1 aunque dijera «SUPERADA».
- **Cambio:**
  - esos contenedores corren ahora con el usuario que lanza la prueba;
  - si quedan archivos de root, los borra un contenedor;
  - la limpieza conserva el código de la prueba.
- **Comprobado con un usuario sin privilegios del grupo docker:**
  - la versión anterior da «SUPERADA» con **código 1** y archivos de root en `infra/test/out`;
  - la nueva da **código 0**, sin carpeta, contenedores ni volúmenes.

## Resultados

Batería completa ejecutada **una vez**, el 3 de noviembre de 2026, sobre `8623791`, en Linux (Docker Engine nativo). **Todo correcto.**

| Comando | Resultado |
|---|---|
| `infra/test/production-deploy-test.sh` | **SUPERADO**, 109 comprobaciones (el despliegue aplica las migraciones nuevas). 0 volúmenes nuevos |
| `npm test` | 9 PASS |
| `npm run typecheck` | Sin errores |
| `npm run lint` | 0 errores, 16 avisos (los que ya había) |
| `npm run build` | Correcto |
| `npm run test:block2` | 8 PASS. Incluye el HTML idéntico demo/payload en 9 páginas (salvo las piezas exclusivas de la demo) y `/edicion`, `/niebla` y `/admin` en 404 |
| `npm run test:block3` | 17 PASS |
| `npm run test:launch` | 6 PASS |
| `npm run test:instalacion` | **13 PASS** (detalle abajo) |
| `shellcheck -x` de todo `infra/` | Sin avisos |
| `caddy validate` (acme e internal) | `Valid configuration` |
| `common-test`, `staging-config-test`, `monitor-test`, `memory-test`, `staging-guard-test` | Correctos |
| `infra/test/restore-test.sh` (root) | SUPERADA, 0 volúmenes nuevos |
| `RESTORE_TEST_APP_IMAGE=planta14-app:staging infra/test/restore-test.sh` | SUPERADA, 0 volúmenes nuevos |
| `restore-test.sh` como **usuario sin privilegios** (grupo docker) | SUPERADA, **código 0**, 0 restos en `infra/test/out`, 0 volúmenes nuevos |
| `offsite-immutable-test.sh`, `pruebas-config-test.sh`, `preproduccion-test.sh` | SUPERADAS (17, 30 y 20 comprobaciones) |
| `infra/test/postgres-roles-test.sh` | SUPERADA |
| `infra/test/staging-e2e.sh` (Playwright) | SUPERADO |

`test:instalacion` comprueba lo nuevo:
1. **Identidad visual:**
   - los 6 espacios con los valores actuales, tanto por la carga de estructura como por la migración sobre espacios existentes, en su última versión incluida;
   - `/lena` inactiva conserva escudo, colores, créditos e historias y sigue sin foto de cabecera, como antes.
2. **Campos vacíos y parciales:** diseño neutro sin errores; con identidad parcial, solo se muestra lo que hay.
3. **Permisos:** la redacción y la cuenta municipal no pueden cambiar la identidad y el ayuntamiento la lee. Se validan colores y enlaces.
4. **Foto de Imágenes:** obtiene copia pública, sustituye a la del archivo y su copia se borra al quitarla. Se rechaza una imagen sin derechos publicables.
5. **CMS en español:** ningún campo visible sin etiqueta y la página de entrada en español.
6. **Sin restos de la demo** en payload, con la demo intacta.
7. **Vista previa en vivo con Playwright:** 404 sin sesión y `noindex`; el borrador se ve con el diseño público y se actualiza al enviar el formulario como lo hace el CMS. «Creada por» lo pone el servidor.
8. **Panel de inicio:** accesos según el rol y recuento de «Mis borradores».
9. Lo anterior (estructura, etiqueta, casilla y su migración) sigue pasando.

## Qué debe hacer Code local para desplegarlo en pruebas.planta14.com

Desde el PC de Pablo, con el agente SSH cargado. La contraseña común de preproducción no hace falta: `deploy.sh` comprueba `/api/health`, que está abierto. No hay variables nuevas en el `.env`.

**1. Entrar y comprobar el estado actual:**

```bash
ssh planta14@87.106.30.18
cd /srv/planta14/app
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir:
- versión actual `c29e024…`;
- `/api/health: ok`;
- modo mantenimiento desactivado;
- **sin** «restauración asistida pendiente».

Si no es así, para y avisa.

**2. Traer y fijar el commit validado:**

```bash
git fetch origin desarrollo/planta14-v2-ajustes-preproduccion
git checkout --detach 862379192f53b60f01e9fa553047c874601c0ab5
git log -1 --format='%h %s'
```

Debe mostrar `8623791 docs: identidad visual de los concejos y CMS para la redacción en el manual [skip netlify]`. Las herramientas de despliegue que se ejecutan son las de esta copia, así que el checkout va antes del despliegue.

**3. Quitar restos de la prueba de restauración anterior**, si los hay. Son archivos de root que dejaba la versión vieja de `restore-test.sh`:

```bash
ls infra/test/out 2>/dev/null && sudo rm -rf infra/test/out/*
```

**4. Desplegar.** Construye la imagen (varios minutos; la web sigue funcionando). Después:
- activa el modo mantenimiento;
- hace la copia previa;
- **aplica las migraciones** `20261103_000335_identidad_espacios` (campos de identidad y valores actuales de los seis concejos) y `20261103_001210_creado_por`;
- arranca la versión nueva y quita el mantenimiento al comprobar la salud.

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production 862379192f53b60f01e9fa553047c874601c0ab5
echo "código: $?"
```

En la salida deben aparecer «Modo mantenimiento ACTIVADO», «Copia previa: …», «**Migraciones aplicadas: 20261103_000335_identidad_espacios 20261103_001210_creado_por**», «/api/health: ok», «Modo mantenimiento DESACTIVADO» y «Desplegada». Código 0.

| Código | Qué ha pasado | Qué hacer |
|---|---|---|
| 1 | La versión nueva falló sin tocar la base; ha vuelto sola a la anterior. | Guardar la salida y avisar. |
| 2 | Falló después de migrar; sigue la anterior en modo mantenimiento. | Restauración asistida, `docs/MANUAL-OPERACION.md`, apartado 9: Pablo pega la clave age. |
| 3 | No se cambió nada. | Leer el motivo. |

**5. Comprobar** (con la contraseña de preproducción en el navegador):
- `https://pruebas.planta14.com/`: sin «Edición de demostración» arriba ni «Demo municipal» o «fines de demostración» en el pie. `/edicion` y `/niebla` dan 404.
- `https://pruebas.planta14.com/lena` (y los demás concejos): igual que antes, con escudo, colores, créditos e historias.
- `/cms`:
  - en español;
  - el inicio con «Nueva noticia», «Mis borradores» y «Publicadas hoy»;
  - en **Espacios municipales**, cada uno con su **Identidad visual** rellena.
- Una noticia de `[PRUEBA]`: **Guardar borrador** → **Previsualizar** muestra la noticia con el diseño de la web y cambia al escribir.

**6. Prueba de restauración con la imagen instalada.** Debe terminar en «SUPERADA», `código: 0` y «Sin volúmenes nuevos»:

```bash
docker volume ls -q | sort > /tmp/volumenes-antes.txt
RESTORE_TEST_APP_IMAGE="planta14-app:$(cut -c1-12 /srv/planta14/state/current)" bash infra/test/restore-test.sh; echo "código: $?"
docker volume ls -q | sort | diff /tmp/volumenes-antes.txt - && echo "Sin volúmenes nuevos"
```

## Para revisar en el CMS

- **Aller, primera historia destacada:** enlaza a `/noticia/fuentes-invierno-actividad-todo-el-ano`, una noticia de la demo que no existe con contenido real (404). Se cargó tal cual para que la web se viera igual. Conviene cambiarla en **Espacios municipales → Ayuntamiento de Aller → Identidad visual → Historias destacadas** por una noticia real o un enlace oficial.
- **Fotos y escudos:** siguen siendo los archivos de la web, de Wikimedia Commons con sus créditos. Si se cambian, se suben a Imágenes con sus derechos (manual, apartado 11). Los escudos nuevos deben ser JPEG, PNG o WebP: la colección de imágenes no admite SVG.

## Sin comprobar

- **El despliegue real en el servidor** (no se ha tocado) ni la migración sobre los datos reales de pruebas.planta14.com. En el ensayo de producción y en `test:instalacion` se comprobó sobre espacios creados como en la instalación.
- **La vista previa dentro del iframe de `/cms`** con un navegador. Se comprobó la página de vista previa y la actualización en vivo enviando el mensaje como lo envía el CMS, pero no haciendo clic en «Previsualizar» dentro de la interfaz de Payload. Tampoco con la contraseña de preproducción por delante (es el mismo origen, así que el navegador la reutiliza).
- **El aspecto visual del CMS en español** y del panel de inicio en un navegador. Las etiquetas, la página de entrada y el HTML del inicio se comprobaron por código.
- **Que la página del concejo inactiva sea idéntica píxel a píxel a la de `c29e024`.** Se comprobaron las piezas (escudo, colores, créditos e historias), y la comparación demo/payload del bloque 2 da el mismo HTML con la identidad completa.
