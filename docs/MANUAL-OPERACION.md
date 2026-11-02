# Manual de operación de Planta 14

Para Pablo. Explica qué hacer en las situaciones habituales sin necesidad de programar. Cuando haya que escribir una orden, cópiala tal cual. **No pegues nunca contraseñas ni el archivo `.env` en un chat ni en un correo**, tampoco en una IA.

Este manual todavía no acredita una instalación en producción. La persona técnica debe entregar primero la dirección del servidor, el acceso, la carpeta instalada, los horarios de copia y los contactos de los proveedores elegidos. No des por contratados IONOS, correo ni monitorización.

Los comandos de este documento corresponden al **entorno privado de pruebas (staging)**. No los ejecutes sobre producción sin la guía específica de esa instalación. Si no tienes experiencia con el servidor, pide a la persona técnica que siga esos pasos contigo; tú puedes hacer las comprobaciones del navegador.

En las órdenes, «el servidor» será la máquina contratada. `ssh usuario@IP-del-servidor` y `/srv/planta14-web` son ejemplos que la persona técnica debe sustituir por los datos reales.

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
   - la **clave privada de las copias** (archivo `age-key.txt`), guardada fuera del servidor, en el gestor de contraseñas y en una copia en papel o USB;
   - el archivo `.env` del servidor, guardado en el gestor de contraseñas.
3. Tras restaurar, comprueba que `api/health` dice «ok», que la portada y un espacio municipal se ven bien y que puedes entrar en `/cms`.

## 5. Crear una cuenta municipal

1. Entra en `https://planta14.com/cms` con tu cuenta de administrador.
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
15 3 * * * cd /srv/planta14-web && infra/monitor/run-with-alert.sh "Copia de PostgreSQL" -- infra/backup/backup-postgres.sh --env-file infra/.env.staging >> /var/log/planta14-backup.log 2>&1
30 3 * * * cd /srv/planta14-web && infra/monitor/run-with-alert.sh "Copia de imágenes" -- infra/backup/backup-storage.sh --env-file infra/.env.staging >> /var/log/planta14-backup.log 2>&1
45 3 * * * cd /srv/planta14-web && infra/monitor/run-with-alert.sh "Copia externa" -- infra/backup/offsite-sync.sh --env-file infra/.env.staging >> /var/log/planta14-backup.log 2>&1
0 * * * *  cd /srv/planta14-web && infra/monitor/check-disk.sh --env-file infra/.env.staging >> /var/log/planta14-backup.log 2>&1
```

Para que lleguen los correos de alerta, cuando haya proveedor de correo, se rellenan `ALERT_SMTP_URL`, `ALERT_SMTP_USER`, `ALERT_SMTP_PASSWORD`, `ALERT_EMAIL_FROM` y `ALERT_EMAIL_TO` en el `.env` del servidor, se pone `ALERT_EMAIL_ENABLED=true` y se añade `ALERT_ENV_FILE=/srv/planta14-web/infra/.env.staging` al principio del cron.

## 7. A quién pedir ayuda

| Situación | A quién |
|---|---|
| El servidor no arranca, no hay red, hay que ampliar disco o memoria | Soporte de **IONOS** (panel de cliente o teléfono) |
| Las imágenes no cargan y `api/health` dice `storage: error` | Soporte del **proveedor de almacenamiento** |
| No llegan los correos de alerta o de contraseña | Soporte del **proveedor de correo** |
| La web da error, una función no va bien o hay que cambiar algo de la web | Una **IA de programación con acceso al repositorio** (por ejemplo Claude Code), o la persona técnica de confianza. Pídele que lea primero `docs/V2-INTEGRACION.md`, `docs/INFRA-STAGING.md` y este manual. |
| Restaurar copias, mover el servidor, actualizar imágenes de Docker | La persona técnica, o una IA de programación con acceso al repositorio y al servidor, siempre con una copia hecha antes |
| Dudas sobre textos legales, contratos con ayuntamientos o una reclamación de derechos | **Abogado** |
| Entender un mensaje de error o preparar un correo | Un asistente de IA general (por ejemplo Claude). **Sin pegar contraseñas, el `.env` ni datos personales** |
| Un ayuntamiento no puede entrar o publicar | Crea o revisa su cuenta (apartado 5); si persiste, la persona técnica |
