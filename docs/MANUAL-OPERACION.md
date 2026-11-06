# Manual de operación de Planta 14

Para Pablo. Explica qué hacer en las situaciones habituales sin necesidad de programar. Cuando haya que escribir una orden, cópiala tal cual. **No pegues nunca contraseñas ni el archivo `.env` en un chat ni en un correo**, tampoco en una IA.

El VPS IONOS M+ ya está contratado: 2 vCores, 4 GB RAM y 120 GB NVMe. La instalación todavía debe comprobarse en el servidor real. Sigue primero PUESTA-EN-MARCHA-IONOS.md. Este plan no se amplía: una presión sostenida de memoria exige preparar una mudanza con copia y restauración.

Los comandos de este documento corresponden al **entorno privado de pruebas (staging)**. No los ejecutes sobre producción sin la guía específica de esa instalación. Si no tienes experiencia con el servidor, pide a la persona técnica que siga esos pasos contigo; tú puedes hacer las comprobaciones del navegador.

En las órdenes, «el servidor» será la máquina contratada. `ssh usuario@IP-del-servidor` y `/srv/planta14/app` son ejemplos que la persona técnica debe sustituir por los datos reales.

## 1. Vigilar que la web funciona (monitor gratuito con aviso al móvil)

La web tiene una dirección de salud: `https://planta14.com/api/health`. Responde «ok» si la web, la base de datos y el almacenamiento de imágenes funcionan, y da error en caso contrario. No muestra datos internos.

Para recibir un aviso en el móvil, por ejemplo con **UptimeRobot** (tiene plan gratuito):

1. Crea una cuenta en uptimerobot.com con el correo de Planta 14.
2. Pulsa **New monitor** y elige el tipo **HTTP(s)**.
3. En la dirección pon `https://planta14.com/api/health` y comprueba cada 5 minutos, el intervalo del plan gratuito.
4. Como contacto de alerta, deja el correo e instala la aplicación **UptimeRobot** en el móvil, con la misma cuenta, para recibir notificaciones.
5. Crea otro monitor igual para la portada, `https://planta14.com/`.

Otros servicios con plan gratuito parecido: Better Stack (Uptime) o Freshping. Los planes gratuitos cambian; revisa las condiciones al darte de alta.

## 2. Si la web se cae

1. **Comprueba si es solo tu conexión:** abre la web desde el móvil con datos, no con wifi.
2. **Mira qué falla:** abre `https://planta14.com/api/health`.
   - No carga nada: el servidor o la red. Ve al paso 3.
   - Dice `"database":"error"`: falla la base de datos. Ve al paso 4.
   - Dice `"storage":"error"`: falla el almacenamiento de imágenes. Mira el estado del proveedor y avísale.
3. **Servidor:** entra en el panel de IONOS y comprueba que el servidor está encendido. Si no puedes entrar por `ssh`, reinícialo desde el panel. Si sigue sin funcionar, abre una incidencia con el soporte de IONOS.
4. **Contenedores:** entra por `ssh` y escribe:

```bash
docker compose -f infra/compose.staging.yaml --env-file infra/.env.staging ps
```

Todos deben estar «running» o «healthy». Si alguno no lo está, reinicia el conjunto:

```bash
docker compose -f infra/compose.staging.yaml --env-file infra/.env.staging up -d
```

5. **Si no se arregla:** guarda los últimos mensajes de la aplicación y pide ayuda (apartado 7), adjuntando el archivo `app.log`. Revisa antes que no contenga contraseñas.

```bash
docker compose -f infra/compose.staging.yaml --env-file infra/.env.staging logs --tail 200 app > app.log
```

## 3. Comprobar las copias de seguridad

Las copias solo se harán cada noche después de que la persona técnica las programe y pruebe. Pídele confirmación del horario y de la última copia restaurada. Si una falla o el disco pasa del 80 %, se intenta enviar un correo cuando esté configurado. Un fallo de correo no se reintenta automáticamente; revisa también el registro. La ruta de ejemplo de avisos es `/var/backups/planta14/alerts.log`.

**Una vez por semana:**

```bash
ls -lt /var/backups/planta14/postgres | head -3
```

```bash
ls -lt /var/backups/planta14/storage | head -3
```

La primera línea de cada lista debe tener la fecha de hoy o de ayer. Mira también si hay avisos:

```bash
tail -5 /var/backups/planta14/alerts.log
```

**Una vez al mes:** pide a quien te ayude con la parte técnica que ejecute la prueba de restauración (`infra/test/restore-test.sh`) y la copia externa. Comprueba en la web del proveedor de copias que hay archivos recientes.

## 4. Restaurar una copia

Restaurar es delicado. **Nunca se restaura encima de la web en marcha.** Los scripts se niegan a hacerlo, pero aun así:

1. Si solo se ha borrado una publicación, normalmente se recupera desde el CMS (historial de versiones). No hace falta restaurar.
2. Si se ha perdido el servidor o la base de datos, pide ayuda (apartado 7) y sigue con esa persona la guía «Restauración» de `docs/INFRA-STAGING.md`. Hace falta:
   - la **clave privada de las copias** (una línea que empieza por `AGE-SECRET-KEY-1`), guardada **fuera del servidor**: en el gestor de contraseñas y en una copia impresa. Nunca se guarda en el servidor;
   - el archivo `.env` del servidor, guardado en el gestor de contraseñas.
3. Tras restaurar, comprueba que `api/health` dice «ok», que la portada y un espacio municipal se ven bien y que puedes entrar en `/cms`.

Si lo que ha fallado es una **actualización** de la web, no sigas este apartado: sigue el 9 (restauración asistida), que lo hace todo con una orden.

## 5. Crear una cuenta municipal

**Solo después de la salida.** Durante la preproducción en pruebas.planta14.com solo entran periodistas, con cuentas `editor` (`docs/PUESTA-EN-MARCHA-IONOS.md`, apartado 5, paso 6 ter); los ayuntamientos todavía no tienen cuenta. Antes de la primera cuenta municipal, sigue el final del apartado 7 de esa guía: activar los avisos municipales por correo y probar el panel.

1. Entra en `https://planta14.com/cms` con tu cuenta de administrador.
   - **Activa el espacio del concejo**, que la carga de estructura dejó inactivo. En **Municipal Spaces** abre el del concejo y en **Subscription** pon **Status:** `active` y **Starts At:** la fecha de inicio del contrato (AAAA-MM-DD), y **Ends At** si lo hay. Pulsa **Publish changes**. Sin esto, su panel no se abre.
2. Ve a **Users** (usuarios) y pulsa **Create new**.
3. Rellena:
   - **Email:** el correo de trabajo de la persona del ayuntamiento;
   - **Name:** su nombre y el ayuntamiento, por ejemplo «Ana Pérez (Ayto. de Lena)»;
   - **Password:** una contraseña larga generada por el gestor de contraseñas;
   - **Role:** `municipal`;
   - **Espacio municipal:** el de su ayuntamiento. Es obligatorio, y una cuenta municipal solo puede tener uno.
4. Guarda.
5. Envíale el enlace de su panel (`https://planta14.com/lena/panel`) y el manual (`docs/MANUAL-AYUNTAMIENTOS.md`) por correo. Dale **la contraseña por otra vía**, por ejemplo por teléfono.
6. Antes de dar acceso, el ayuntamiento debe haber firmado el contrato y el encargo de tratamiento (`docs/legal/ENCARGO-TRATAMIENTO-AYUNTAMIENTOS.md`).

**Para dar de baja una cuenta:** en **Users**, ábrela y bórrala. Lo que publicó se mantiene y el registro de auditoría conserva quién lo hizo.

**Para retirar una publicación municipal:** lo más rápido es **Mis concejos** (apartado 27). También en `/cms`: ve a **Municipal Contents**, ábrela, marca **Retirado**, escribe el **Motivo** y pulsa **Save Draft** (guardar borrador). La retirada afecta también a la versión pública. Comprueba en una ventana privada que ya no aparece; el ayuntamiento verá el motivo en su panel. No restaures una versión anterior para eludir una retirada.

## 6. Tareas programadas (cron)

Las deja configuradas quien instale el servidor:

```
15 3 * * * cd /srv/planta14/app && infra/monitor/run-with-alert.sh "Copia de PostgreSQL" -- infra/backup/backup-postgres.sh --env-file infra/.env.staging >> /var/log/planta14-backup.log 2>&1
30 3 * * * cd /srv/planta14/app && infra/monitor/run-with-alert.sh "Copia de imágenes" -- infra/backup/backup-storage.sh --env-file infra/.env.staging >> /var/log/planta14-backup.log 2>&1
45 3 * * * cd /srv/planta14/app && infra/monitor/run-with-alert.sh "Copia externa" -- infra/backup/offsite-sync.sh --env-file infra/.env.staging >> /var/log/planta14-backup.log 2>&1
0 * * * *  cd /srv/planta14/app && infra/monitor/check-disk.sh --env-file infra/.env.staging >> /var/log/planta14-backup.log 2>&1
```

Para que lleguen los correos de alerta, cuando haya proveedor de correo, se rellenan `ALERT_SMTP_URL`, `ALERT_SMTP_USER`, `ALERT_SMTP_PASSWORD`, `ALERT_EMAIL_FROM` y `ALERT_EMAIL_TO` en el `.env` del servidor, se pone `ALERT_EMAIL_ENABLED=true` y se añade `ALERT_ENV_FILE=/srv/planta14/app/infra/.env.staging` al principio del cron.

## 7. A quién pedir ayuda

| Situación | A quién |
|---|---|
| El servidor no arranca, no hay red, hay que preparar la mudanza por falta de disco o memoria | Soporte de **IONOS** (panel de cliente o teléfono) |
| Las imágenes no cargan y `api/health` dice `storage: error` | Soporte del **proveedor de almacenamiento** |
| No llegan los correos de alerta o de contraseña | Soporte del **proveedor de correo** |
| La web da error, una función no va bien o hay que cambiar algo de la web | Una **IA de programación con acceso al repositorio** (por ejemplo Claude Code), o la persona técnica de confianza. Pídele que lea primero `docs/V2-INTEGRACION.md`, `docs/INFRA-STAGING.md` y este manual. |
| Restaurar copias, mover el servidor, actualizar imágenes de Docker | La persona técnica, o una IA de programación con acceso al repositorio y al servidor, siempre con una copia hecha antes |
| Dudas sobre textos legales, contratos con ayuntamientos o una reclamación de derechos | **Abogado** |
| Entender un mensaje de error o preparar un correo | Un asistente de IA general (por ejemplo Claude). **Sin pegar contraseñas, el `.env` ni datos personales** |
| Un ayuntamiento no puede entrar o publicar | Crea o revisa su cuenta (apartado 5); si persiste, la persona técnica |

## 8. Actualizar la web

Una actualización instala una versión nueva de la web (un «commit» o una «etiqueta» que te indique la persona técnica o la IA). La hace una sola orden, desde el servidor:

```bash
cd /srv/planta14/app
bash infra/deploy/deploy.sh --env-file infra/.env.production VERSIÓN
```

Mientras dura, que suelen ser unos minutos más lo que tarde en construirse la versión:

1. **Se construye la versión nueva.** La web sigue normal.
2. **Se activa el modo mantenimiento.** La web pública sigue funcionando y se puede leer todo, también en el `/cms` y en los paneles municipales. Lo que no se puede es **guardar cambios**: quien lo intente verá «Planta 14 se está actualizando. Durante unos minutos puedes consultarlo todo, pero no guardar cambios…». Así ningún cambio se queda fuera de la copia de seguridad.
3. **Se hace una copia de seguridad de la base de datos**, cifrada.
4. **Se aplican los cambios de la base de datos** (migraciones), si la versión los trae.
5. **Se arranca la versión nueva** y se comprueba que `https://planta14.com/api/health` dice «ok».
6. **Solo entonces se desactiva el modo mantenimiento.** Ya se puede escribir.

Avisa antes a los ayuntamientos y a la redacción de que durante unos minutos no podrán guardar, y elige una hora tranquila. Al terminar, la orden dice una de estas cosas:

| Mensaje final | Qué significa | Qué hacer |
|---|---|---|
| `Desplegada …` | Todo bien. | Nada. Abre la web y el `/cms` para verlo. |
| `La web funciona con la versión anterior` (código 1) | La versión nueva falló **sin** tocar la base de datos. Se ha vuelto sola a la anterior y se puede escribir. | Nada urgente. Pasa el mensaje a la persona técnica o a la IA para que lo revise. |
| `QUÉ HACER AHORA` (código 2) | La versión nueva falló **después** de cambiar la base de datos. Se ha vuelto a la versión anterior, pero sigue el modo mantenimiento (solo lectura). | La **restauración asistida** del apartado 9. |
| `Ya hay un despliegue en curso`, `Hay una restauración asistida pendiente` o un error antes de migrar (código 3) | No se ha cambiado nada. | Lee el mensaje. Si hay una restauración pendiente, hazla primera (apartado 9). |

Para ver en cualquier momento cómo está todo: versión, salud, modo mantenimiento y si hay algo pendiente:

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

## 9. Si una actualización falla: restauración asistida desde Windows

**Por qué no se hace sola.** La copia de seguridad está cifrada y la clave para abrirla (la clave privada, `AGE-SECRET-KEY-1…`) **no está en el servidor**: la tienes tú en el gestor de contraseñas y en papel. Así, si alguien entrara en el servidor, no podría leer las copias. Por eso, cuando hace falta restaurar, el servidor te pide la clave y tú se la das un momento desde tu PC.

**Qué ves.** La orden de actualización termina con un recuadro «QUÉ HACER AHORA» con la orden exacta. También te llega por correo, si las alertas están configuradas, y aparece en `status.sh`. Mientras tanto:

- la web pública funciona, con la versión anterior;
- el `/cms` y los paneles se pueden consultar, pero no guardar (modo mantenimiento);
- no se pierde nada, porque nadie puede escribir. **No hay prisa**: hazlo con calma.

**Paso a paso desde Windows:**

1. Abre el gestor de contraseñas y **copia** la clave privada de las copias de Planta 14: una sola línea que empieza por `AGE-SECRET-KEY-1`.
2. Abre **PowerShell** (menú Inicio → escribe «PowerShell»).
3. Escribe esta orden en **una sola línea**. Es la misma que aparece en el recuadro; usa la de allí si es distinta:

   ```powershell
   ssh -t -i "$env:USERPROFILE\.ssh\planta14_ionos" planta14@planta14.com "cd /srv/planta14/app && infra/deploy/restaurar.sh"
   ```

   Si el dominio aún no apunta al servidor, pon la IP del servidor en lugar de `planta14.com`. Si te pide la frase de paso de tu clave SSH, escríbela.
4. Cuando aparezca **«Pega la clave privada de las copias…»**, pégala con el **botón derecho del ratón** y pulsa **Intro**. No se ve nada al pegar: es normal, igual que una contraseña.
5. Espera. Verás «Clave correcta», luego la restauración y, al final, **«RESTAURACIÓN COMPLETADA»**. El modo mantenimiento se quita solo, y solo cuando la web responde bien.
6. Comprueba que en `https://planta14.com/cms` puedes guardar un cambio pequeño, que la portada y un espacio municipal se ven bien, y avisa a la persona técnica de que la versión nueva falló.

**La clave no se queda en ningún sitio.** Al pegarla en la ventana del servidor no se guarda en el historial de PowerShell ni en el del servidor. El servidor la usa solo en memoria durante la restauración: no la escribe en disco ni aparece en la lista de procesos. Tras usarla, el gestor de contraseñas suele vaciar el portapapeles. Si no lo hace, copia cualquier otra cosa.

**Alternativa sin teclear la clave**, si prefieres no usar el ratón: copia la clave al portapapeles y escribe en PowerShell:

```powershell
Get-Clipboard | ssh -i "$env:USERPROFILE\.ssh\planta14_ionos" planta14@planta14.com "cd /srv/planta14/app && infra/deploy/restaurar.sh"
```

**Si algo sale mal:**

| Mensaje | Qué pasa | Qué hacer |
|---|---|---|
| `Eso no parece una clave age` | Has pegado otra cosa o nada. | Repite desde el paso 1. No se ha cambiado nada. |
| `La clave no corresponde a la clave pública de las copias` | Es otra clave, o está incompleta. | Busca la clave correcta de Planta 14 (la impresa sirve: tecléala en el gestor). No se ha cambiado nada. |
| `No hay ninguna restauración pendiente` | Ya se hizo, o no hacía falta. | Mira `status.sh`. |
| Termina sin «RESTAURACIÓN COMPLETADA» | Algo no ha respondido. El modo mantenimiento sigue, así que no se pierde nada. | Pide ayuda (apartado 7) con el texto que salió en pantalla. |

La base de datos con los cambios de la versión fallida no se borra: queda como `planta14_fallida_FECHA` para que la persona técnica la analice. Cuando ya no haga falta, ella la borrará.

**Practica una vez al trimestre (simulacro).** Comprueba que tu clave guardada funciona, sin cambiar nada en la web:

```powershell
ssh -t -i "$env:USERPROFILE\.ssh\planta14_ionos" planta14@planta14.com "cd /srv/planta14/app && infra/deploy/restaurar.sh --solo-comprobar"
```

Pega la clave igual que arriba. Debe decir **«SIMULACRO CORRECTO»**. Si no lo dice, la clave guardada no sirve: avisa ya a la persona técnica, antes de necesitarla.

## 10. Modo mantenimiento a mano

Normalmente no hace falta: la actualización lo pone y lo quita sola. Si alguna vez necesitas que nadie escriba durante un rato, por ejemplo mientras se revisa algo, desde el servidor:

```bash
cd /srv/planta14/app
bash infra/deploy/mantenimiento.sh --env-file infra/.env.production activar "revisión de datos"
bash infra/deploy/mantenimiento.sh --env-file infra/.env.production estado
bash infra/deploy/mantenimiento.sh --env-file infra/.env.production desactivar
```

`activar` comprueba que las escrituras se rechazan de verdad. Si hay una restauración asistida pendiente, `desactivar` se niega: primero hay que restaurar (apartado 9). Solo la persona técnica, y por una razón clara, puede renunciar a esa restauración con `desactivar --forzar`, porque entonces la base se queda como la dejó la versión que falló.


## 11. Cambiar la foto, el lema o los colores de un concejo

Cada concejo tiene su **identidad visual**: la foto grande de cabecera, el lema, el escudo, los colores, los enlaces a la web oficial y de turismo, y tres «historias destacadas». Se cambia desde el CMS, sin tocar el código. **Solo la administración** puede hacerlo. Las cuentas municipales la ven, pero no pueden cambiarla.

**Cambiar la foto de cabecera**

1. **Sube la foto.** En `/cms` → **Imágenes** → **Crear**, sube la foto (JPEG, PNG o WebP; mejor apaisada y de al menos 1800 px de ancho). Rellena:
   - **Texto alternativo:** qué se ve, para quien no puede verla;
   - **Autoría o crédito;**
   - **Titular de los derechos** y **Tipo de derechos;**
   - **Ámbito:** `Publicable`.

   Guarda. Sin ámbito «Publicable» y derechos completos, la foto no se puede usar.
2. **Asígnala al concejo.** Ve a **Espacios municipales** y abre el del concejo, por ejemplo «Ayuntamiento de Lena». En **Identidad visual** → **Foto de cabecera**, elige la imagen que acabas de subir.
3. **Completa los créditos** de la foto: **Descripción de la foto**, **Autor y licencia de la foto (texto visible)**, **Enlace al original de la foto** y **Enlace a la licencia de la foto** (si es de Wikimedia o tiene licencia Creative Commons).
4. Pulsa **Publicar cambios**. La foto aparece en la página del concejo cuando el espacio está **activo**; con el espacio inactivo la página no muestra foto de cabecera.

La foto que elijas en Imágenes sustituye a la que venía con la web («Foto actual (archivo de la web)»). Si quitas la de Imágenes, vuelve a verse la del archivo.

**Cambiar el lema o el subtítulo:** en el mismo espacio, **Identidad visual** → **Lema** (la frase grande sobre la foto, por ejemplo «Lena, un lugar para quedarse.») y **Subtítulo**. Pulsa **Publicar cambios**.

**Escudo, colores, enlaces e historias**
- **Escudo:** igual que la foto: súbelo a Imágenes con sus derechos, elígelo en **Escudo** y rellena su autor, su licencia y sus enlaces.
- **Colores:** formato `#RRGGBB`, por ejemplo `#456477`. Hacen falta los cuatro (principal, oscuro, suave y bordes) para que se aplique el diseño propio del concejo. Si falta alguno, la página usa los colores neutros de Planta 14.
- **Web oficial** y **Web de turismo:** direcciones que empiezan por `https://`.
- **Historias destacadas:** hasta tres, cada una con etiqueta, título, texto y enlace.

**Si dejas un campo vacío**, esa parte no se muestra y la página sigue funcionando con el diseño neutro: sin foto, sin escudo (aparece el marcador «Escudo municipal»), sin créditos o sin historias. Antes de guardar, revisa la página del concejo en una ventana privada.

## 12. Escribir noticias en el CMS (redacción)

Al entrar en `/cms`, el **inicio** muestra estos accesos:
- **Nueva noticia:** abre el formulario vacío;
- **Mis borradores:** las noticias que has creado tú y aún no están publicadas, con su número;
- **Publicadas hoy:** las noticias publicadas con la fecha de hoy;
- **Pendientes de revisar:** lo que ha llegado de fuera de tus concejos (apartado 14);
- **Mis concejos:** las publicaciones de los ayuntamientos y las sugerencias de tus concejos (apartado 27). Debajo de los accesos tienes ya las últimas.

La administración ve todos los pendientes, los **espacios municipales** y los **usuarios**. En el CMS, las fechas se muestran como `dd/MM/aaaa HH:mm`.

### El formulario, pestaña a pestaña

Cada campo lleva debajo una ayuda breve. Solo son obligatorios título, entradilla, texto, autor, concejo y sección.

| Pestaña | Qué hay |
|---|---|
| **Contenido** | Título, entradilla, texto y foto principal. |
| **Clasificación** | Autor (ya viene puesto si tu cuenta tiene firma), concejo, sección, «Es un artículo de opinión» y, solo para actividades, fecha y lugar de la **Agenda**. |
| **Portada** | **Principal** (la noticia grande de la portada; si hay varias, la más reciente; si no hay ninguna, la última noticia que no sea opinión ni agenda), **Destacada** (bloque de destacadas) y **Mostrar en la página del concejo** (viene marcada; si la desmarcas, la noticia sigue en portada, sección y buscador, pero no en la página del concejo). |
| **Publicación** | Fecha de publicación y publicación programada (abajo). |
| **Buscadores** | Título, descripción e imagen para Google y redes. **Opcionales:** si están vacíos se usan el título, la entradilla y la foto principal. |
| **Fuente** | Bloque plegado y opcional: **solo si la noticia procede de otro medio o de una nota de prensa** (medio, enlace y autor original). |

A la derecha, la **Dirección (slug)** se crea sola al guardar, a partir del título (sin tildes, eñes ni espacios; si ya existe, añade -2, -3…). Se puede cambiar, pero no hace falta. **Creada por** lo pone el CMS y no se cambia. El identificador de origen, la procedencia y el lote solo los ve la administración.

### Qué sale en la portada

- **Bloques de noticias** («En portada», «La vida aquí», Caudal y «Relacionadas» en cada noticia): solo noticias. Las piezas de la sección **Agenda** salen únicamente en la agenda («Para salir» y `/agenda`), y la **opinión**, en su bloque.
- **Sin repetidos:** una pieza aparece en un solo bloque de la portada; los bloques se rellenan con las siguientes noticias por fecha. «La vida aquí» empieza por las marcadas como **Destacada**.
- **Relacionadas:** primero las del mismo concejo y después las de la misma sección.
- **Tu ayuntamiento, aquí:** enlaza los espacios municipales activos y la lista de los seis concejos; nunca un panel.

### El texto

Se escribe o se pega como en un procesador de textos. La barra de arriba tiene:
- el desplegable **Texto normal**, para convertir un párrafo en **Encabezado 2 / 3** (ladillos), **Cita en bloque**, **Lista ordenada** o **Lista desordenada**;
- **negrita** (B o Ctrl+B), *cursiva* (I o Ctrl+I) y **enlace** (selecciona el texto y pulsa el eslabón).

No hay más formatos a propósito: la web mantiene un estilo uniforme.

### La foto

En **Foto principal**, **Elegir de los existentes** abre la biblioteca de Imágenes. Para una foto nueva, pulsa **Crear** (o arrástrala) sin salir de la noticia, y rellena:
- **Texto alternativo:** qué se ve en la foto;
- **Autoría o crédito:** cómo debe firmarse;
- **Titular de los derechos** y **Tipo de derechos** (Propia, Con licencia, Cedida con autorización, Institucional);
- la casilla **«Declaro que Planta 14 tiene derecho a publicar esta imagen…»**. Sin ella, la foto se guarda, pero la noticia no se puede publicar con ella. Queda registrado quién lo declaró y cuándo.

Pulsa **Guardar** en esa ventana y la foto queda puesta en la noticia.

### Fechas: publicar ya o programar

- **Fecha de publicación:** la que se ve en la noticia. Si la dejas vacía, se pone sola la hora a la que publiques. Puedes ponerla a mano, por ejemplo para una noticia de ayer, pero no en el futuro.
- **Publicación programada (opcional):** elige día y hora en el calendario y pulsa **Publicar cambios**. La noticia queda en estado *Publicado*, pero **no se ve en la web hasta esa hora**; entonces sale sola, con esa fecha. Para anularla, vacía el campo y pulsa **Publicar cambios** (sale en ese momento) o **Despublicar** en el menú ⋮.

Las fechas se muestran en hora de Madrid.

### Vista previa

Guarda una vez con **Guardar borrador**. Arriba aparecen dos botones:
- el **ojo** abre la **vista previa en vivo** a un lado, que cambia mientras escribes (Móvil, Tableta o Escritorio);
- el **cuadro con flecha** (**Vista previa**) abre la noticia en otra pestaña con el diseño de la web.

Solo la ve quien tiene sesión en el CMS: no es pública hasta que se publica. Las fotos aún no publicadas se ven en la vista previa, pero no en la web.

### Firma por defecto

Para que el autor venga puesto, la administración abre **Usuarios →** la cuenta de la persona → **Firma (autor vinculado)** y elige su autor. Se puede cambiar en cada noticia.

## 13. Contenido de ensayo (preproducción)

Para llenar la web de preproducción con noticias, opiniones, agenda y contenidos municipales de prueba, y quitarlo todo después sin tocar lo de los periodistas, sigue `docs/ENSAYO-CONTENIDO.md`. En resumen, desde el servidor:

```bash
cd /srv/planta14/app
bash infra/deploy/ensayo.sh --env-file infra/.env.production cargar --solo-comprobar
bash infra/deploy/ensayo.sh --env-file infra/.env.production cargar
bash infra/deploy/ensayo.sh --env-file infra/.env.production retirar --solo-comprobar
bash infra/deploy/ensayo.sh --env-file infra/.env.production retirar
```

La retirada hace antes una copia de seguridad, borra solo lo marcado como ensayo, conserva los dos reportajes definitivos y lo que hayan escrito los periodistas, devuelve Mieres y Lena a su estado anterior y lo deja anotado en Auditoría.

## 14. Periodistas responsables y «Pendientes de revisar»

Cada concejo tiene un **periodista responsable** (Concejos → el concejo → **Periodista responsable**). Solo lo cambia la administración, y no se publica en la web. Valores iniciales:

| Concejos | Responsable |
|---|---|
| Aller, Mieres y Morcín | Andrés (velascolne@gmail.com) |
| Lena, Riosa y Ribera de Arriba | Juanfran Santos (juansantospolalena@gmail.com) |

Los carga, una vez, `npm run cms:responsables` (lo hace Code local al instalar; ver el documento de la versión). Si las cuentas no existen, las crea con rol Redacción y una contraseña aleatoria que no se muestra a nadie: cada uno entra la primera vez con **«¿Olvidaste tu contraseña?»** en `/cms`. Se puede repetir: no cambia un responsable que ya esté elegido.

**Lo que llega de fuera** se asigna al responsable del concejo:
- las **publicaciones de los ayuntamientos** en su espacio;
- las **fiestas enviadas** por comisiones y asociaciones (apartado 15).

Cada entrada crea un aviso en **Pendientes de revisar** (antes «Avisos municipales»), asignado al responsable, que además recibe un **correo** (desde avisos@planta14.com, si el correo está activado). Para las publicaciones de los ayuntamientos, el correo lleva el título, el tipo y el enlace en la web; se puede desactivar en el perfil (apartado 27). Cuando lo hayas atendido, abre el pendiente y marca **Revisado**. Si un concejo no tiene responsable, el pendiente queda sin asignar y solo lo ve la administración.

Las **cartas de los lectores** siguen este mismo camino (apartado 19).

## 15. Fiestas de las Cuencas

**En la web:**
- **`/fiestas`:** «Este fin de semana» (de viernes a domingo; de lunes a jueves, el siguiente), el **calendario por meses** con las que aún no han terminado y un filtro por concejo. Sin carteles.
- **Ficha** (`/fiestas/nombre-pueblo-año`): fechas, programa, botones de compartir, la crónica si se enlaza y el **cartel pequeño y enmarcado** junto al programa.
- **Otros sitios:** también salen en la **agenda** y, como «Fiestas esta semana», en la **portada** y en la **página del concejo** (apartado 24). Hay un enlace «Fiestas» en el menú.

**En el CMS** (Fiestas → Crear):

| Campo | Para qué |
|---|---|
| Nombre de la fiesta, pueblo o barrio, concejo | Lo que se ve; el concejo decide su página y quién la revisa. |
| Primer día y último día | Calendario (el mismo día si dura uno). |
| Programa | Texto con negrita, listas, ladillos y enlaces. |
| Cartel (opcional) | **Crear** y marcar la declaración de derechos, como en las noticias. Nunca sale en los listados. |
| Crónica | La noticia de la fiesta, cuando se publique. |
| Se repite cada año | Para duplicarla al año siguiente. |
| Organiza y Contacto | **No se publican**: solo para la redacción. |

La dirección se crea sola con el nombre, el pueblo y el año.

**Duplicar para el año siguiente:** abre la fiesta y pulsa el botón de la barra lateral. Crea un **borrador** 52 semanas después (cae en el mismo día de la semana: el sábado sigue siendo sábado), con el mismo programa y sin cartel ni crónica. Revisa las fechas y el programa antes de publicarla.

**«Envía tu fiesta»** (`/fiestas/enviar`, enlazado desde `/fiestas` y desde cada ficha):
1. La comisión o asociación rellena la fiesta, el programa, el cartel si quiere (con su declaración de derechos) y sus datos de contacto, que no se publican.
2. Recibe un correo y confirma con un botón. El enlace caduca en 7 días y sirve una vez. Sin confirmar, la fiesta no llega a nadie.
3. Al confirmar, entra como **borrador** y se crea un pendiente para el periodista responsable del concejo, que recibe un correo.
4. El periodista la revisa (fechas, programa, cartel) y la publica.

Hay un campo trampa contra robots y un límite de 5 envíos al día por correo. Si el correo de avisos@planta14.com no está activado, el formulario lo dice y no guarda nada.

**Precarga desde un JSON:** comprueba siempre antes con `--solo-comprobar`.

```bash
npm run cms:fiestas:importar -- fiestas.json --solo-comprobar
```

```bash
npm run cms:fiestas:importar -- fiestas.json
```

- **Formato:** el de `docs/ejemplos/fiestas.json`:
  - `nombre`, `pueblo` y `concejo` (slug o nombre);
  - `inicio` y `fin` en formato AAAA-MM-DD;
  - `programa`, con los párrafos separados por una línea en blanco;
  - `organizador` y `contacto`, que no se publican;
  - `seRepite`.
- **Borradores o publicadas:** entran como borrador; con `--publicar`, publicadas.
- **Errores:** primero se revisa todo el archivo; si hay un error, no se importa nada y se dice en qué fiesta está.
- **Repetible:** una fiesta que ya existe (mismo nombre, pueblo y año) no se toca.
- **En el servidor:** el archivo se pasa por la entrada estándar al contenedor de migraciones. El comando completo está en el documento de la versión.

**Estado de la fecha** (columna y filtro en Fiestas):

| Estado | Qué significa | ¿Se publica? |
|---|---|---|
| Confirmada | Fechas comprobadas para esta edición | Sí, al pulsar **Publicar** |
| Por regla, sin confirmar | La fecha que da la costumbre (por ejemplo, «24 de junio»), sin programa de la edición | No: confírmala antes |
| Fecha pendiente | Sin fecha | No |
| Fecha orientativa (2025) | Solo la referencia de 2025 | No |

- **Despublicar, guardar como borrador y cambiar el estado de la fecha** funcionan siempre. La comprobación «Para publicar la fiesta, confirma sus fechas…» solo salta al **publicar**.
- **Si una fiesta publicada pasa a «Pendiente», «Orientativa» o «Por regla» y se guarda,** se despublica sola. En la barra lateral queda el **Aviso** «Se ha despublicado sola…». Para volver a publicarla, pon «Confirmada» con sus fechas y pulsa **Publicar cambios**.
- **Fuente de la fecha y fecha de consulta:** de dónde sale la fecha (y la regla). Solo las ve la redacción.

**Catálogo con fechas** (`contenido-ensayo/fiestas-caudal-fechas.json`):
- Se importa con el mismo comando, primero con `--solo-comprobar`.
- Entran solo las de tipo «fiesta»; los eventos no se importan. Todas como **borrador**.
- **Las que ya existen** (por su identificador) **no se duplican**:
  - si siguen en borrador, se actualizan **solo** sus fechas, estado de la fecha, fuente y fecha de consulta (lo demás que hayas editado no se toca);
  - si ya están publicadas, solo la fuente y la fecha de consulta.
- Los comandos completos están en el documento de la versión.

## 16. Boletín: suscriptores

**Formulario.** Está en la portada, en el pie de todas las páginas, en cada noticia y en cada ficha de fiesta. Cada persona elige:
- **qué recibir:** «Qué hacer este finde» y/o «Avisos de mi concejo»;
- **sus concejos:** si no marca ninguno, recibirá los seis.

Debe aceptar el consentimiento, que enlaza a la política de privacidad. La política ya recoge el boletín y las fiestas enviadas, pero aún tiene huecos por rellenar, como el proveedor de correo y los plazos.

**Doble confirmación:**
1. Al apuntarse, se guarda como **Pendiente de confirmar** y recibe un correo.
2. El enlace abre una página con el botón **Confirmar la suscripción**. Así, los antivirus del correo no confirman solos.
3. Las preferencias solo se aplican al confirmar. Si alguien ya suscrito vuelve a apuntarse con otras preferencias, también tiene que confirmar el cambio.
4. Se envía como mucho un correo cada dos minutos a la misma dirección.

**Baja con un clic.** Cada correo lleva un enlace de baja, que abre una página con un único botón. Además, los programas de correo muestran su propio «Cancelar suscripción» (cabeceras `List-Unsubscribe`).

**En el CMS** (Suscriptores, solo la administración):
- **Estado:** Pendiente de confirmar, Confirmado o De baja.
- **Datos guardados:** concejos, contenidos, dónde se apuntó y el texto y la fecha del consentimiento.
- **Exportar:** sobre la lista, **Exportar confirmados (CSV)** y **Exportar todos (CSV)**. El archivo va separado por punto y coma y se abre con Excel o LibreOffice.
- **Borrar los datos de alguien** que lo pida: elimina su registro.

El **envío del boletín** todavía no existe: llegará en un encargo posterior. Por ahora solo se captan y confirman suscriptores. Todo el correo sale del SMTP de avisos@planta14.com.

## 17. Última hora

**Última hora**, en la barra lateral del CMS (sección Globales): marca **Mostrar la barra de última hora** y rellena:
- **Texto:** una frase de hasta 140 caracteres;
- **Enlace:** opcional; la noticia (`/noticia/…`) o una dirección `https://`;
- **Se quita sola el:** opcional; fecha y hora de caducidad.

Aparece una barra roja bajo la cabecera de todas las páginas, salvo las de concejo, que tienen su propia cabecera. Desaparece a la hora de caducidad o al desmarcarla. La puede activar cualquier persona de la redacción.

## 18. Contraseñas: mínimo 12 caracteres y «¿Has olvidado tu contraseña?»

- **Mínimo:** el servidor rechaza cualquier contraseña de menos de **12 caracteres**, en todas las cuentas (redacción, administración y ayuntamientos), tanto al crearla como al cambiarla o al restablecerla.
- **Redacción y administración:** en `/cms`, «¿Olvidaste tu contraseña?». El enlace lleva a `/cms/reset/…`.
- **Ayuntamientos:** en su panel (`/<concejo>/panel`), **«¿Has olvidado tu contraseña?»**. El correo («Planta 14: cambia tu contraseña») lleva a `/<concejo>/panel/restablecer`, con la imagen del concejo. Al guardar la contraseña nueva, entra directamente en su panel.
- **El enlace** sirve **una vez** y **caduca en una hora**. Si alguien pide el correo con una dirección que no tiene cuenta, la web responde lo mismo y no se envía nada.
- **Con el modo mantenimiento activado**, no se puede pedir el correo ni cambiar la contraseña.
- **Correo:** necesita el SMTP de avisos@planta14.com activado (`SMTP_ENABLED=true`).

## 19. Cartas de los lectores

> **Ahora están desactivadas.** Mientras el ajuste **«Cartas activas»** esté sin marcar (es lo normal desde esta versión), las cartas no existen para los lectores:
> - `/cartas`, `/cartas/enviar`, `/cartas/confirmar` y `/normas-cartas` dan «Página no encontrada» y no están en el sitemap;
> - no hay enlaces ni bloques de cartas en el pie, la portada, Opinión ni `/principios` (su apartado «Cartas de los lectores» sigue guardado en el CMS, pero no sale);
> - el formulario no acepta envíos ni confirmaciones, y la redacción no ve la colección en el CMS. La administración sí, por si quedara alguna carta antigua;
> - en el pie, «Participa» lleva **«Cuéntanos algo»**, que abre Contacto, y Contacto dice que para avisos, historias o sugerencias se escriba a info@planta14.com.
>
> El DNI y el teléfono de cartas antiguas se siguen borrando a los 24 meses: una vez al día en el servidor, al abrir el CMS y con `npm run cms:cartas:caducar`.
>
> **Para reactivarlas en el futuro** (solo administración):
> 1. Revisa antes las **normas** (`/normas-cartas`, texto provisional pendiente del abogado) y la **política de privacidad**. El texto de las normas está en `app/(frontend)/normas-cartas/page.tsx` y se cambia con un despliegue.
> 2. Comprueba que el correo funciona (`SMTP_ENABLED=true`): el autor confirma su carta por correo.
> 3. En el CMS: Globales → **Cartas activas** → marca **«Cartas de los lectores activas»** y guarda. Se ve al momento, sin desplegar.
> 4. Comprueba `/cartas/enviar`, el enlace «Envía tu carta» del pie (sale junto a «Cuéntanos algo») y el bloque de Opinión. Para volver a apagarlas, desmarca la casilla.

Con las cartas activas, funcionan así:

**En la web:**
- **Enviar una carta:** `/cartas/enviar`.
- **Normas:** `/normas-cartas`. El texto es provisional, pendiente de revisión.
- **Dónde salen:** en Opinión, en el bloque **«Cartas de los lectores»**, y en `/cartas`. De cada carta se publican nombre, apellidos, concejo y texto, con el aviso «Planta 14 no comparte necesariamente las opiniones de los lectores».

**Qué piden:**
- nombre, apellidos, DNI o NIE, teléfono, correo y concejo (obligatorio);
- el texto, de hasta 2000 caracteres;
- aceptar las normas y la política de privacidad.

Solo se admite **una carta al mes por persona**: se comprueba por el DNI y por el correo.

**Recorrido:**
1. La persona recibe un correo y confirma con el enlace, que caduca en 7 días. Sin confirmar, la carta no llega a nadie.
2. Al confirmar, queda **Pendiente de revisar** y se crea un pendiente para el periodista responsable del concejo, que recibe un correo.
3. En el CMS (**Cartas**), el periodista puede:
   - **aprobarla:** se publica;
   - **corregirla:** erratas o recortes. El texto original queda guardado;
   - **rechazarla:** con un **motivo obligatorio**, que se envía por correo a quien la escribió.

   Al aprobarla, la persona recibe también un correo.

**Datos personales:**
- **Quién los ve:** el DNI y el teléfono se guardan **cifrados** y solo los ven la administración y el periodista responsable de ese concejo. Nunca se publican.
- **Borrado:** se borran solos a los **24 meses**. Ocurre al recibir cartas y al abrir el CMS. Para hacerlo a mano o desde una tarea programada:

```bash
npm run cms:cartas:caducar
```

## 20. Buzón de sugerencias de los ayuntamientos

En su panel, cada ayuntamiento tiene un **Buzón de sugerencias**:
- casillas con servicios que le interesarían: publicidad institucional, boletín para sus vecinos, informes de visitas, cobertura de actos, agenda ampliada, formación y avisos urgentes;
- un texto libre.

**Dónde llegan:**
- En el CMS, en **Sugerencias**. Las ve la administración, y cada periodista ve las de los concejos de los que es responsable.
- Además, llega un correo a la administración y al periodista responsable.

## 21. Estadísticas propias (sin cookies)

**Qué se cuenta:** visitas por **día, página, concejo, sección y procedencia** (buscadores, redes sociales, WhatsApp, directo, otras webs, desde Planta 14).
- **Solo contadores sumados:** no se guarda IP, navegador ni ningún identificador, y no se usan cookies.
- **No cuentan:** robots, vistas previas de enlaces (WhatsApp, Telegram…), personas con sesión en el CMS y zonas privadas (CMS, paneles, vistas previas, confirmaciones).
- **Sin efecto en la carga:** el aviso de visita sale cuando el navegador está libre y no frena la página.

**Dónde verlas:**
- **Administración:** `/cms/estadisticas` (enlace **Estadísticas** en la portada del CMS). Muestra:
  - visitas por día;
  - páginas más vistas;
  - procedencia, concejos y secciones.

  Se puede elegir el mes y el concejo, y exportar el mes en **CSV** (se abre en Excel) o en **PDF** sencillo. La redacción no las ve.
- **Ayuntamientos:** en su panel, las visitas de **su concejo** del mes, con las mismas exportaciones. Solo pueden ver su concejo, aunque pidan otro.

## 22. Sección «Útil»

Está en **`/util`** (enlace «Útil» en el menú) y en **`/<concejo>/util`** (pestaña «Útil» de cada espacio municipal activo). La página del concejo lleva al final un resumen compacto (apartado 25). Cada dato automático lleva su **fuente** y la **hora** a la que se consultó.

**Datos automáticos.** Son cuatro fuentes, con permiso de reutilización comprobado:

| Bloque | Fuente | Detalles |
|---|---|---|
| Puerto de Pajares (N-630) | DGT, Punto de Acceso Nacional (licencia CC BY) | Dice si la DGT registra incidencias en la N-630 de Lena y Villamanín, con la hora del parte. **Nunca dice «abierto».** Se consulta cada 5 minutos como mucho. |
| El tiempo | AEMET OpenData, predicción por municipio | Solo sale si hay **`AEMET_API_KEY`** en el `.env` del servidor. Las claves nuevas de AEMET duran tres meses: renuévala a tiempo. |
| Subvenciones abiertas | Base de Datos Nacional de Subvenciones | Convocatorias abiertas de los seis ayuntamientos, del Principado, del IDEPA y de la Administración del Estado. No incluye concesiones directas ni nominativas. Cada una enlaza a su convocatoria oficial. Hay además un enlace fijo a las ayudas del IDEPA. |
| Empleo público | BOE (sección II.B) | Convocatorias de los seis ayuntamientos y del Principado de los últimos 45 días. Un anuncio municipal solo entra si lo firma uno de los seis ayuntamientos («del Ayuntamiento de Lena…») y solo sale en ese concejo; otros ayuntamientos asturianos (Grado, Langreo…) no entran aunque el BOE ponga «(Asturias)». |

**Solo enlaces a la fuente oficial,** sin datos copiados: puerto de San Isidro (112 Asturias), Valgrande-Pajares, Fuentes de Invierno, farmacias de guardia (Colegio de Farmacéuticos), empleo en el BOPA y empleo en cada ayuntamiento. No se copian porque no hay permiso de reutilización confirmado o no hay una fuente automática fiable.

**Si una fuente falla:**
- La página sigue funcionando: se ve el último dato bueno, con su hora y la nota «No se ha podido actualizar ahora», o un aviso en ese bloque.
- La administración recibe un correo («Útil: no responde la fuente…»), como mucho uno cada 12 horas por fuente.
- Se reintenta sola.

**Las consultas se guardan en caché:** la web no espera a la fuente salvo la primera vez.

**Patrimonio y Rutas** (CMS → Patrimonio / Rutas):
- **Ficha:** cada una tiene su página (`/util/patrimonio/…`, `/util/rutas/…`) y salen en la lista de su concejo. En Rutas, también en la de los otros concejos de las Cuencas por los que pasan.
- **Mapa:** de OpenStreetMap.
  - Patrimonio: un punto.
  - Rutas: el recorrido dibujado, si hay track oficial; si no, solo el enlace de descarga.
- **Foto de patrimonio:** viene de Wikimedia Commons, con autor y licencia. Sin foto, la ficha y su elemento en las listas van solo con texto, sin hueco.
- **Columna «Revisión» y aviso arriba de la ficha:**
  - **Coordenadas pendientes:** sale en la lista, pero no en el mapa. Completa latitud y longitud (WGS84) cuando estén comprobadas.
  - **Dudoso:** hay dudas por revisar (campo «Dudas pendientes», que no se publica). Cuando estén comprobadas, marca **«Dudas revisadas»**.
- **Publicado:** casilla en la barra lateral.

**Directorio de servicios municipales** (CMS → Servicios municipales):
- Lo editan la administración y cada ayuntamiento, el de su concejo, desde su panel.
- Sale en el bloque «Servicios municipales» de la página de cada concejo.
- No incluye farmacias, porque el permiso de reutilización no está confirmado. Las guardias se consultan en el enlace del Colegio.

**Importar desde `datos-servicios`** (rama `desarrollo/planta14-contenido-ensayo`, commit `bcc03e0`). Comprueba siempre antes con `--solo-comprobar`; los comandos completos en el servidor están en el documento de la versión.

```bash
npm run cms:patrimonio:importar -- patrimonio.json --solo-comprobar
```

```bash
npm run cms:patrimonio:importar -- patrimonio.json --publicar
```

```bash
npm run cms:rutas:importar -- rutas.json --publicar
```

```bash
npm run cms:servicios:importar -- servicios-municipales.json
```

- **Repetible:** cada registro tiene un `id`. Lo que ya existe no se duplica ni se modifica, así que se puede volver a importar cuando se amplíen los datos.
- **Si una foto o un recorrido no se pudo descargar**, se completa al repetir la importación. Los avisos salen al final, en «AVISOS».
- **Errores:** primero se revisa todo el archivo; si hay un error, no se importa nada.
- **Recorridos:**
  - se usa el GPX directo;
  - del ZIP oficial del GR 206 se toman los GPX de las etapas a pie, sin la variante ciclista;
  - los PLT de OziExplorer se convierten solo si declaran WGS 84;
  - los enlaces de Wikiloc solo se enlazan.
- **Necesita salida a internet** hacia `www.turismoasturias.es`, `drive.google.com`, `drive.usercontent.google.com` y `upload.wikimedia.org`.

**Ocultar servicios en un concejo:**
- Cada ayuntamiento elige en su panel qué servicios de «Útil» salen en su concejo. Por defecto salen todos.
- Lo que oculta también desaparece de `/util` para su concejo.
- Las noticias y el contenido de Planta 14 no se pueden ocultar.
- En los concejos **sin espacio municipal activo** decide la administración, en CMS → **Útil: servicios ocultos**.


## 23. Lemas, enlace de WhatsApp y principios editoriales (solo administración)

Los tres se cambian en el CMS, en la barra lateral, sección **Globales**. La redacción no puede cambiarlos.

**Lemas** (Globales → **Lemas**):
- **Lema 1, Lema 2 y Lema 3:** los textos. Valores iniciales: «Una voz para las Cuencas», «Donde otros no llegan» y «Orgullo de historia. Mirada al futuro». Se escriben **sin punto final**, todos igual.
- **Dónde va cada uno:** elige qué lema sale **bajo la cabecera** (debajo de «Planta 14», en todas las páginas), en la **frase lateral** (a la izquierda de «Planta 14», solo en pantallas grandes) y en el **pie**.
- Pulsa **Guardar**: el cambio se ve al momento.
- Las páginas de cada concejo, los correos y la imagen para redes mantienen «Una voz para las Cuencas».

**Enlace de WhatsApp** (Globales → **Pie de página**):
- Pega el enlace del canal o del grupo de Planta 14 (`https://whatsapp.com/channel/…`, `https://chat.whatsapp.com/…` o `https://wa.me/34…`) y guarda. Aparece «WhatsApp» en la columna **Participa** del pie.
- Si lo dejas vacío, el enlace no sale. Solo se admiten enlaces de WhatsApp.

**Principios editoriales** (Globales → **Principios editoriales**, página `/principios`, enlazada en el pie):
- **Entradilla** y **Principios** (título y texto de cada uno; párrafos separados por una línea en blanco). Puedes añadir, quitar y reordenar principios.
- El texto inicial es **provisional** y sale con el aviso «Texto provisional pendiente de revisión.». Cuando esté revisado, desmarca **Mostrar el aviso** y guarda.


## 24. Concejo activo o no activo, «Útil» por concejo y «Fiestas esta semana»

**Activar o desactivar un concejo** (solo administración): CMS → **Municipal Spaces** → el del concejo → **Subscription**. **Status:** `active` (con **Starts At** y, si lo hay, **Ends At**) o `inactive`. Pulsa **Publish changes**: el cambio se ve en la web al momento, sin desplegar. Lo importado (servicios, patrimonio, rutas) **se queda en el CMS** aunque el concejo esté inactivo; solo cambia lo que se publica.

| | Concejo **activo** | Concejo **no activo** |
|---|---|---|
| Página del concejo (`/<concejo>`) | El espacio del ayuntamiento, con su identidad: foto de cabecera, escudo y lema, avisos, agenda municipal, tablón, ayudas, tarjetas fijas, el resumen de «Útil» y «Fiestas esta semana» | **Una página del periódico**: título («Morcín»), «Noticias de Morcín en Planta 14» y, si las hay, «Fiestas esta semana». Sin escudo, sin rótulos de espacio municipal ni lemas, con la cabecera de Planta 14 |
| «Útil» del concejo (`/<concejo>/util`, sus «Ver todos» y las fichas de patrimonio y rutas) | Sí, salvo lo que haya ocultado (apartado 22) | **No**: esas páginas dan «no encontrada» (404) y no están en el sitemap |
| Fila del concejo en `/util` | Sí | No (su nombre, arriba, enlaza a su página) |
| «Tu ayuntamiento, aquí» en la portada | Sale si hay **algún** concejo activo | Si no hay ninguno activo, la sección no sale |
| Agenda municipal en `/agenda` | Sí | No |
| Panel del ayuntamiento | Sí | No se abre |
| Fiestas | Sí: son contenido de la redacción | Sí, igual |

**`/util` siempre** muestra lo regional: el tiempo de los seis concejos en una franja bajo el título (AEMET), Pajares (DGT), las ayudas y el empleo generales (BDNS y BOE: Principado, IDEPA y Estado) y el enlace de farmacias. Debajo, una fila compacta por cada concejo **activo**, con sus accesos y su recuento («Servicios 18 · Patrimonio 8…») y «Todo lo útil de…».

**Cajas de «Útil»:** cada caja enseña como mucho **5** elementos (primero los más completos: con foto, con recorrido o mapa) y debajo **«Ver todos (n)»**, que lleva a la lista completa de ese tipo en ese concejo, con búsqueda y filtro por tipo:
- `/<concejo>/util/servicios`, `/<concejo>/util/patrimonio`, `/<concejo>/util/rutas`, `/<concejo>/util/subvenciones` y `/<concejo>/util/empleo`;
- las ayudas y el empleo generales, en `/util/subvenciones` y `/util/empleo`.

**«Fiestas esta semana»** (portada y página de cada concejo):
- Sale cada fiesta desde **7 días antes** de empezar hasta su último día. Si no hay ninguna, el bloque no sale.
- Solo fiestas **publicadas** y con **fecha confirmada**: nunca borradores ni «Fecha pendiente».
- Los días se cambian en CMS → Globales → **Fiestas en portada** (de 0 a 30). Lo puede cambiar la redacción.
- Las fiestas siguen en `/fiestas` y en la agenda como siempre.


## 25. «Útil» de cada concejo

- **Página del concejo** (`/<concejo>`), al final, un **resumen compacto**:
  - el tiempo de hoy y de mañana, con iconos;
  - el puerto de Pajares en Lena y el de San Isidro en Aller;
  - las farmacias de guardia;
  - una fila de accesos con recuento (Servicios 18 · Patrimonio 8 · Rutas 7 · Ayudas 1 · Empleo 1);
  - «Todo lo útil de [concejo]».
- **`/<concejo>/util`:** todo lo útil del concejo, dentro de su espacio municipal (con su cabecera y su pestaña **Útil**): el tiempo, puertos, farmacias, servicios, patrimonio, rutas, ayudas y empleo, en cajas con «Ver todos». Da 404 si el concejo no está activo.
- Lo que el ayuntamiento oculte desde su panel no sale en ninguno de los dos sitios.
- **Servicios municipales:** cada uno enseña su **fuente** y la **fecha de comprobación** («Fuente: aytolena.es · comprobado el 04/11/2026»). Sin fuente, «Fuente pendiente de comprobar». La fecha se edita en el campo **Fecha de comprobación** (AAAA-MM-DD). Al repetir `npm run cms:servicios:importar` se rellena en los que no la tenían.

## 26. Enviar el boletín (administración y redacción)

1. CMS → **Boletines** → **Crear**. Escribe el **asunto** y, si quieres, una **entradilla**.
2. **Noticias:** al crearlo salen las publicadas en los últimos 7 días. Quita o añade las que quieras; solo se pueden elegir noticias publicadas. Pulsa **Guardar**.
3. Pulsa **Enviarme una prueba**, en la barra lateral: te llega solo a ti. Revísala en el móvil y en el ordenador.
4. Si está bien, pulsa **Enviar a todos** y confirma. Si cambias algo después de la prueba, guarda y envíate otra: sin prueba de la versión guardada, no deja enviar.
5. El envío va por lotes, en segundo plano. Recarga la página para ver el **Resultado**: enviados, fallos, bajas durante el envío y suscriptores sin noticias de sus concejos. El **Registro** muestra los fallos, con el correo enmascarado.

**A quién le llega:**
- solo a los suscriptores **confirmados**;
- cada uno recibe las noticias de **sus concejos** (todas, si no eligió ninguno);
- si no hay ninguna de sus concejos, ese boletín no le llega.

Cada correo lleva la **baja en un clic** y quién edita Planta 14.

**Límites:** se envía por avisos@planta14.com, en lotes de 20 correos, con 1 segundo entre correos y 2 minutos entre lotes (unos 480 por hora). Se cambian con `NEWSLETTER_BATCH_SIZE`, `NEWSLETTER_EMAIL_PAUSE_MS` y `NEWSLETTER_BATCH_PAUSE_SECONDS` en el `.env`.

**Si el servidor se reinicia a mitad,** el boletín queda «Enviando». Pulsa otra vez **Enviar a todos**: sigue sin repetir a quien ya lo recibió.

**Un boletín enviado no se puede reenviar ni cambiar.** Para otro envío, crea uno nuevo.

## 27. «Mis concejos» y avisos de publicaciones municipales (redacción)

**Mis concejos** reúne lo que hacen los ayuntamientos de los concejos de los que eres responsable (apartado 14: Andrés, Aller, Mieres y Morcín; Juanfran, Lena, Riosa y Ribera de Arriba).

- **En el inicio del CMS**, debajo de los accesos, ves las 6 últimas publicaciones de tus ayuntamientos (avisos, agenda, ayudas, tablón y noticias) y las 3 últimas sugerencias. **Ver más u otros concejos** abre la página completa, `/cms/mis-concejos`, con las 30 últimas publicaciones y las 15 últimas sugerencias.
- **Es un filtro, no una restricción.** En **Concejos** elige **Todos los concejos** o cualquier concejo y pulsa **Ver**. Las **sugerencias** son la excepción: cada periodista solo ve las de sus concejos (la administración, todas), como ya se les dice a los ayuntamientos.
- Cada publicación ocupa una línea: **tipo**, **título**, ayuntamiento, **estado** (Publicado, Borrador o «Retirado: motivo») y fecha del último cambio. A la derecha:
  - **Ver en la web:** la abre en la sección de su concejo (solo si está publicada);
  - **Abrir:** la ficha completa en el CMS;
  - **Retirar:** escribe el **motivo** (obligatorio; lo verá el ayuntamiento en su panel) y pulsa **Retirar la publicación**. Es la misma retirada de siempre: sale de la web al momento, queda en la auditoría con tu nombre y el ayuntamiento no puede volver a publicarla. Para restablecerla, ábrela en el CMS (**Abrir**) y desmarca **Retirado**; queda en borrador hasta que se vuelva a publicar.

**Correo por cada publicación nueva.** Cuando un ayuntamiento publica algo nuevo, su periodista responsable recibe un correo con el **título**, el **tipo** y el **enlace en la web**, y cómo retirarla desde «Mis concejos». Es uno por publicación: si el ayuntamiento la despublica y la vuelve a publicar, no se repite. Usa el envío de correo ya configurado (avisos@planta14.com).

**Dejar de recibirlos:** en el CMS, pulsa tu cuenta (arriba a la derecha) y, en **Avisos por correo**, desmarca «Recibir un correo por cada publicación nueva de los ayuntamientos de mis concejos». Se guarda al momento, sin pulsar Guardar. Lo nuevo sigue apareciendo en **Mis concejos** y en **Pendientes de revisar**. Cada periodista cambia solo el suyo; la administración puede cambiar el de cualquiera desde **Usuarios**. Los correos de fiestas, cartas y sugerencias no cambian.
