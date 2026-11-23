# Instalar la Ayuda y los detalles del CMS

Para Claude Code en el PC de Pablo (Code local), con el agente SSH cargado.

Rama **`desarrollo/planta14-v2-ayuda`**, creada desde `desarrollo/planta14-v2-next-seguridad` (`d8a7fda`, que es
`7ef7adb` más su documento de instalación). No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor.
Sin PR.

**Commit a instalar: `593b0f1`** (`593b0f1170a9b90a3de4be8fc359fae6844fda75`). Se instala sobre **`7ef7adb`** (Next.js 16.4.5). El commit
siguiente solo completa este documento.

- **Una migración nueva**, `20261123_194605_firma_fija`: añade la columna «Firma fija» a las cuentas (`users`). **No
  toca noticias** ni ningún otro dato.
- **Un paso después de desplegar:** la firma «El Director» (paso 4).
- **Caddy no cambia.**

## Qué cambia

### A. Ayuda dentro del CMS y del panel

| Punto | Cambio |
|---|---|
| 1. Ayuda en el CMS | `/cms/ayuda`, solo con sesión de redacción o administración: el manual de la redacción con sus capturas, índice con enlaces y buscador (sin tildes ni mayúsculas). Sin términos técnicos ni rutas del repositorio. El apartado «Para la administración» solo lo ve la administración. |
| 2. Accesos | Enlace **Ayuda** en el menú lateral del CMS y tarjeta **Ayuda** en el inicio. |
| 3. PDF | **Descargar en PDF**: A4, portada (Planta 14, título y fecha), índice con números de página y el manual con sus capturas. Generado en el servidor, sin dependencias nuevas (fuentes estándar de PDF y las capturas en JPEG con sharp). El de la redacción, para la redacción (con el apartado de administración solo para la administración). |
| 4. Ayuda en el panel | Pestaña **Ayuda** en el panel municipal, solo con sesión municipal: el manual del ayuntamiento con índice, buscador y su PDF. |
| 5. Siempre al día | Los manuales se generan en cada compilación desde `docs/MANUAL-REDACCION.md` y `docs/MANUAL-AYUNTAMIENTOS.md` (`npm run build` → `scripts/generar-manuales.mjs` → `generated/manuales.json`). Las capturas se sirven solo con sesión. |
| 6. Manual de la redacción | Revisado y completo: lo básico del CMS, varios concejos y secciones, etiquetas, fotos y galerías en el texto, punto de interés, carteles, plantillas, IA con rótulo, imagen para redes y lo de este encargo (firma fija, opinión automática, Ayuda). Capturas nuevas. |
| 7. Manual del ayuntamiento | Nuevo y completo, para un técnico municipal que no conoce la web (entrar y recuperar la contraseña, cada tipo de publicación con sus fechas, borradores, editar y despublicar, Útil, directorio, sugerencias, visitas, normas y retiradas, ayuda, cerrar sesión, info@planta14.com). 16 capturas del panel real. |

### B. Detalles pendientes

| Punto | Cambio |
|---|---|
| 8. Firma «El Director» | Autor **El Director** (slug `el-director`, definitivo, sin foto ni biografía), creado por `infra/deploy/firma-direccion.sh`. Nuevo campo **Firma fija** en Usuarios: con él, la cuenta firma siempre con su firma vinculada (viene puesta y es la única que puede elegir; el servidor lo impone). El script lo deja en la cuenta de administración de Pablo y en «Pablo Velasco (redactor)» (`pvelasco@assa.as`). Se ve en la línea de firma, en las tarjetas de opinión y en los datos para buscadores (la imagen para redes no lleva firma). El autor de ensayo «Pablo Velasco» no se toca. |
| 9. Campos técnicos | «Identificador de origen», «Procedencia» y «Lote de la carga de ensayo» solo los ve la administración en la ficha de la noticia. |
| 10. Opinión | «Es un artículo de opinión» se marca sola al guardar si la sección principal o una secundaria es Opinión, y se desmarca si se quita (ya no se marca a mano). |
| 11. Cuenta municipal en el CMS | Con su contraseña correcta: «Las cuentas municipales entran por el panel de su concejo. Entra en tu panel: /lena/panel». Con una contraseña equivocada, la respuesta de siempre, igual para cualquier cuenta (no revela nada). |
| 12. Logotipo | Logotipo de Planta 14 en la pantalla de acceso del CMS, icono en el menú y en la pestaña del navegador. |

### C. Regla permanente

En `AGENTS.md` (instrucciones del repositorio): cada encargo que cambie lo que ven la redacción o los ayuntamientos
actualiza en el mismo encargo su manual y sus capturas.

## Memoria de la compilación

Mismo método que en las entregas anteriores (etapa «build» de `infra/app.Dockerfile` en la misma imagen `node:22`,
`CMS_ENABLED=false`, `LOW_MEMORY_BUILD=true`, 768 MiB de montón; pico del contenedor):

| Versión | Pico | Resultado |
|---|---|---|
| `7ef7adb` (Next.js 16.4.5, lo instalado) | 1.820 MiB | compila |
| **`593b0f1` (esta entrega)** | **1.811 MiB** | compila (−0,5 %: sin cambio apreciable) |

La generación de los manuales antes de compilar tarda menos de un segundo y no añade memoria.

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

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente, y la versión `7ef7adb`.

**2. Fijar el commit y desplegar** (copia previa, migración y arranque):

```bash
git fetch origin desarrollo/planta14-v2-ayuda
```

```bash
git checkout --detach 593b0f1170a9b90a3de4be8fc359fae6844fda75
```

```bash
git log -1 --format='%h %s'
```

Debe mostrar `593b0f1` y el asunto del commit.

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production 593b0f1170a9b90a3de4be8fc359fae6844fda75
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0, y decir «Migraciones aplicadas: 20261123_194605_firma_fija».

**3. Estado otra vez:**

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir `/api/health: ok` y la versión `593b0f1`.

**4. Firma «El Director»** (una vez; se puede repetir). Pon el correo de tu cuenta de administración:

```bash
bash infra/deploy/firma-direccion.sh --env-file infra/.env.production --admin TU-CORREO-DE-ADMINISTRACIÓN
```

Debe decir «Creado el autor «El Director»…» y «Firma fija «El Director» en …» para tu cuenta de administración y para
`pvelasco@assa.as`. Si esa cuenta no existe todavía, avisa y prepara solo la de administración (créala en Usuarios y
repite el comando).

**5. Si algo falla:** si `deploy.sh` terminó con código 1 o 2, sigue lo que dice. Si fue bien pero algo no funciona,
vuelve a `7ef7adb` **sin deshacer la migración** (solo añade una columna que la versión anterior no usa):

```bash
git checkout --detach 7ef7adb8f71b7430a6b57c5f65fc06c658ec1a88
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production 7ef7adb8f71b7430a6b57c5f65fc06c658ec1a88
```

Con la versión anterior desaparece la Ayuda y la firma deja de ser fija; el autor «El Director» y las noticias
firmadas con él se conservan. No hace falta `aplicar-caddy.sh`.

## Comprobaciones después del despliegue

En el ordenador y en el móvil:

1. **Pantalla de acceso del CMS** (`/cms`): logotipo de Planta 14; tras entrar, el icono de Planta 14 arriba a la
   izquierda y la pestaña del navegador con el icono de Planta 14.
2. **Ayuda en el CMS:** enlace **Ayuda** en el menú y tarjeta en el inicio. En `/cms/ayuda`: índice, buscador (prueba
   «galería») y capturas. **Descargar en PDF**: portada, índice con páginas y capturas. Con tu cuenta de
   administración, el apartado «Para la administración»; con una cuenta de la redacción, no.
3. **Firma:** con tu cuenta (o «Pablo Velasco (redactor)»), una noticia nueva viene firmada por **El Director** y no se
   puede elegir otro autor. En la web, la firma «El Director» (sin punto final). Borra la noticia de prueba.
4. **Opinión:** en una noticia, pon Opinión como sección secundaria y guarda: «Es un artículo de opinión» queda
   marcada; quítala y guarda: desmarcada.
5. **Campos técnicos:** con una cuenta de la redacción, la ficha de la noticia no muestra «Identificador de origen»,
   «Procedencia» ni «Lote de la carga de ensayo».
6. **Panel municipal:** pestaña **Ayuda** con el manual del ayuntamiento, buscador y PDF.
7. **Cuenta municipal en el CMS:** con la cuenta y la contraseña de un ayuntamiento en `/cms`, el aviso «Entra en tu
   panel: /…/panel».

## Resultados de la batería recortada

Una sola vez sobre `593b0f1`, **todo superado**; no hizo falta repetir nada.

| Suite | Resultado |
|---|---|
| **`production-deploy-test.sh`** | **SUPERADO** (despliegue con la migración nueva, mantenimiento, vuelta atrás y restauración asistida; las dos líneas «FALLO: /api/health no responde» son los escenarios de vuelta atrás que la prueba provoca a propósito) |
| `npm test` | 11 PASS |
| Tipos | sin errores |
| Lint | 0 errores (29 avisos) |
| Compilación | correcta (con «Manuales generados: redaccion (82 bloques), ayuntamiento (76 bloques)») |
| Instalación | 16 PASS |
| Participación (CMS, panel y seguridad: todos los bloques) | **65 PASS** (los 60 anteriores y 5 nuevos de `participacion-ayuda`: Ayuda y PDF con sus accesos, firma «El Director», opinión automática, mensaje municipal y campos técnicos y logotipo) |
| `shellcheck` de `infra/deploy` (incluido `firma-direccion.sh`) | sin avisos |
| `staging-e2e` (navegador contra la imagen) | 9 PASS, SUPERADO |
| Limpieza | 0 volúmenes nuevos |

## Dudas resueltas por prudencia

1. **Cuentas de Pablo:** el correo de la cuenta de administración no está en el repositorio. La firma fija la prepara
   un comando (`firma-direccion.sh --admin correo`) en lugar de una migración: así ninguna migración toca cuentas ni
   noticias y no se adivina ninguna cuenta. Si solo hay una cuenta de administración, el comando la usa sin `--admin`.
2. **Firma fija al editar:** una cuenta con firma fija puede editar noticias de otros sin cambiarles la firma; solo no
   puede poner una firma distinta de la suya.
3. **Opinión:** la casilla ya no se marca a mano (queda de solo lectura con su explicación) y se actualiza al guardar,
   no mientras se escribe. Las noticias existentes no se tocan; si alguna tuviera la casilla en contradicción con su
   sección, se corrige sola la próxima vez que se guarde.
4. **Manual del ayuntamiento:** las normas («qué no se puede publicar») son las de las condiciones de uso ya
   publicadas, en palabras sencillas; no he añadido normas nuevas. Se mantiene el contacto **info@planta14.com**.
5. **Quién ve cada manual y su PDF:** el de la redacción, redacción y administración; el del ayuntamiento, las cuentas
   municipales y la administración (para poder revisarlo). Las capturas, igual, y solo con sesión.
6. **PDF:** fuentes estándar de PDF (Helvetica), sin incrustar; los símbolos que no tienen (flechas) se sustituyen por
   texto equivalente.
7. **Lint:** 29 avisos (antes 24), todos de `<img>` en componentes de la Ayuda y de las capturas, a propósito como en el
   resto de la web; 0 errores.
