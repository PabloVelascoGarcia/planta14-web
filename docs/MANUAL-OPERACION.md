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

**Para retirar una publicación municipal:** en `/cms`, ve a **Municipal Contents**, ábrela, marca **Retirado**, escribe el **Motivo** y pulsa **Save Draft** (guardar borrador). La retirada afecta también a la versión pública. Comprueba en una ventana privada que ya no aparece; el ayuntamiento verá el motivo en su panel. No restaures una versión anterior para eludir una retirada.

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

Al entrar en `/cms`, el **inicio** muestra tres accesos:
- **Nueva noticia:** abre el formulario vacío;
- **Mis borradores:** las noticias que has creado tú y aún no están publicadas, con su número;
- **Publicadas hoy:** las noticias publicadas con la fecha de hoy.

La administración ve además los **avisos municipales sin revisar**, los **espacios municipales** y los **usuarios**.

**Vista previa en vivo.** Con una noticia abierta, guárdala una vez con **Guardar borrador** y pulsa **Previsualizar** (arriba). Se abre a un lado la noticia con el diseño de la web, y cambia mientras escribes. Puedes elegir **Móvil**, **Tableta** o **Escritorio**. Solo la ve quien tiene sesión en el CMS: no es pública hasta que pulses **Publicar**. Las imágenes que aún no se han publicado se ven en la vista previa, pero no en la web.

**Mostrar en la página del concejo.** En la barra lateral de cada noticia. Viene marcada; si la desmarcas, la noticia se publica (portada, sección, buscador), pero no aparece en la página del concejo.

**Creada por.** Lo pone el CMS solo, con la cuenta que creó la noticia; sirve para «Mis borradores» y no se puede cambiar.
