# Puesta en marcha de Planta 14 en IONOS

Salida pública: **4 de diciembre de 2026**. Rama de instalación: **desarrollo/planta14-v2-final**; se instala un commit concreto ya probado, no una rama que pueda cambiar durante la operación.

## 1. Lo contratado y lo que se va a usar

Pablo ya ha contratado **IONOS VPS Linux M+**, Ubuntu 24.04, **2 vCores, 4 GB RAM y 120 GB NVMe**. Este plan **no se amplía**. Si falta capacidad, se prepara otro servidor y se cambia con copia y restauración. No hace falta volver a contratar este VPS.

Todo el almacenamiento será **IONOS Cloud Object Storage**: originales en un bucket privado, imágenes publicadas en otro público y copias cifradas en un tercer bucket, en otra región de la UE. El correo saldrá exclusivamente del buzón IONOS **avisos@planta14.com**. Las instrucciones no dan por creados aún el buzón, los buckets ni sus claves.

Los datos del contrato y de los tratamientos deben ser revisados por quien gestione la protección de datos. No se completa [REGISTRO MERCANTIL] sin los datos reales.

## 2. Desde dónde se trabaja: PC Windows y servidor Linux

La IA de instalación trabajará **desde el PC Windows de Pablo**, abriendo una conexión SSH al servidor. Windows actúa como mando a distancia. Los comandos de Docker, preparación y despliegue se ejecutan **dentro del servidor Ubuntu**, en `/srv/planta14/app`; la imagen se construye allí. No se instala producción en Windows ni en Netlify.

Pablo conserva el control de las claves y contraseñas. La IA puede usar una conexión SSH que ya esté autorizada en su equipo. No hay que pegar contraseñas, claves privadas ni el archivo `.env` en el chat, en Git o en un correo.

### Crear la clave en Windows (PowerShell)

Comprueba que `ssh -V` funciona. Si Windows no reconoce la orden, activa el componente opcional **Cliente OpenSSH** en Configuración de Windows, con ayuda de la persona técnica.

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh"
ssh-keygen -t ed25519 -a 100 -f "$env:USERPROFILE\.ssh\planta14_ionos" -C "Pablo Planta14 IONOS"
```

Elige una frase de paso cuando la pida y guárdala en tu gestor de contraseñas. Si el archivo ya existe, **no lo sobrescribas**. Se crean dos archivos:

- `planta14_ionos`: clave privada, se queda en Windows y en una copia segura. No se sube al servidor.
- `planta14_ionos.pub`: clave pública, esta sí se entrega al servidor.

Si la IA utiliza el agente SSH de Windows, la persona técnica puede habilitar ese servicio y Pablo cargar la clave con `ssh-add "$env:USERPROFILE\.ssh\planta14_ionos"`. La frase de paso se introduce en el terminal, no en la conversación.

### Dar la clave al servidor por primera vez

Busca en el panel de IONOS la IPv4 y las credenciales iniciales. Si permite asociar una clave pública a ese VPS, entrega únicamente el archivo `.pub`. Si el servidor ya está creado con contraseña de root, utiliza esta vía inicial desde PowerShell, sustituyendo `IP-REAL`:

```powershell
scp "$env:USERPROFILE\.ssh\planta14_ionos.pub" root@IP-REAL:/root/clave-pablo.pub
ssh root@IP-REAL
```

Pablo escribe la contraseña inicial en el terminal cuando se solicite. En la primera conexión comprueba la huella del servidor por un canal fiable de IONOS o su consola; no aceptes una huella cambiada sin investigar. Conserva acceso a la consola de recuperación del panel.

Ya dentro de Ubuntu, la persona técnica ejecuta:

```bash
apt-get update && apt-get install -y git
mkdir -p /srv/planta14
git clone --branch desarrollo/planta14-v2-final https://github.com/PabloVelascoGarcia/planta14-web.git /srv/planta14/app
cd /srv/planta14/app
git checkout COMMIT-VALIDADO
bash infra/server/setup-server.sh --admin-user planta14 --ssh-key /root/clave-pablo.pub
```

`COMMIT-VALIDADO` es el identificador de la entrega aprobada, no texto para copiar literalmente. El script prepara usuario, SSH, cortafuegos, Docker, actualizaciones, fail2ban y **al menos 4 GiB de swap**. No apaga un swap activo para aumentarlo.

**No cierres la sesión inicial** hasta abrir una segunda ventana de PowerShell y comprobar:

```powershell
ssh -i "$env:USERPROFILE\.ssh\planta14_ionos" planta14@IP-REAL
```

En esa segunda sesión Linux:

```bash
sudo bash /srv/planta14/app/infra/server/check-server.sh --admin-user planta14
```

Debe terminar en «servidor preparado». Repetir setup con la misma clave debe dejar cero cambios. No ejecutes `server-setup-test.sh` en el servidor instalado: es un ensayo destructivo para una Ubuntu desechable.

## 3. Crear los tres buckets IONOS y separar las claves

Abre la **consola de IONOS Cloud Object Storage** de tu contrato. No uses las claves de administrador en el VPS.

1. Crea un bucket para originales, con nombre propio disponible, sin espacios ni puntos, por ejemplo `planta14-originales-IDENTIFICADOR`. Elige una región de la UE y **acceso privado**.
2. Crea otro para imágenes públicas, en la misma región y accesible con el mismo endpoint de la aplicación. Ejemplo: `planta14-imagenes-IDENTIFICADOR`. La política pública solo permitirá leer objetos de `public/*`; no permitirá listar el bucket, escribir ni borrar de forma anónima. No hagas público el bucket de originales.
3. Crea un tercero para copias, **en otra región de la UE**, privado. Ejemplo: `planta14-copias-IDENTIFICADOR`. Activa versionado y decide una retención/bloqueo de objetos con la persona técnica antes de guardar copias reales. Un versionado sin retención/bloqueo no garantiza que un atacante no sobrescriba una copia.
4. Anota los nombres, las regiones, los endpoints HTTPS y la URL de lectura del bucket público que muestre IONOS. Usa los valores del panel, no deduzcas la URL ni la región a partir de estos ejemplos.

### Claves con permisos mínimos

Los permisos S3 pertenecen a la identidad del usuario, no al nombre de la clave. Crear otra clave del mismo administrador no la hace más limitada. Haz que una identidad administradora custodiada por Pablo sea dueña/administradora de los buckets, y crea identidades técnicas separadas para el VPS. En Gestión de usuarios de IONOS Cloud da únicamente acceso al producto Object Storage a esas identidades; desde Object Storage genera sus pares **Access Key / Secret Key** y configura los permisos de cada bucket para el identificador que muestre IONOS. La persona técnica debe adaptar la política al tipo de bucket (de usuario o de contrato) y comprobar los permisos efectivos; no copies identificadores AWS inventados.

| Identidad | Puede hacer | No debe poder hacer |
| --- | --- | --- |
| Aplicación | Listar y leer/escribir/borrar originales; leer/escribir/borrar copias públicas bajo `public/`; operaciones multipart necesarias | Entrar en copias externas, cambiar políticas, borrar buckets o administrar usuarios |
| Lectura para copia | Listar y leer el bucket privado (incluido consultar su región) | Escribir o borrar originales, acceder al bucket externo |
| Escritura de copia externa | Listar/leer/verificar y añadir objetos en `planta14/produccion/` del bucket externo; multipart si hace falta | Borrar objetos/versiones, cambiar retención o políticas, entrar en originales |
| Restauración, fuera del VPS | Leer las copias y versiones necesarias; acceso temporal de escritura al destino de restauración | Uso cotidiano en la aplicación |

La aplicación necesita `ListBucket` para la comprobación de salud del bucket privado; los objetos requieren `GetObject`, `PutObject`, `DeleteObject` y, para cargas grandes, permisos multipart adecuados. La copia de lectura no recibe permisos de borrado. La copia externa usa `copy`, no sincronización destructiva. No otorgues `s3:*` ni acceso a todos los buckets como atajo. Verifica también restricciones explícitas si la identidad conserva permisos heredados del contrato.

Antes de darlo por válido, prueba con archivos sintéticos: original anónimo **403**, listado público anónimo **403**, imagen publicada conocida **200**; la clave de lectura no puede subir/borrar; la de aplicación no accede a copias; la externa puede subir y recuperar/verificar una copia, pero no borrarla. Retirar una publicación debe quitar su copia del origen público cuando no haya otros usos. El navegador o un CDN pueden conservar una copia durante su caché.

Guarda las claves directamente en el gestor de contraseñas y el `.env` del servidor. Nunca en Git. Si IONOS no permite conseguir el aislamiento indicado con las identidades disponibles, **no sustituyas las claves por las del administrador**: resuelve la política con su soporte antes de instalar.

Referencias oficiales: [seguridad de Object Storage](https://docs.ionos.com/cloud/security-safeguards/best-practice-guideline/best-practice-cloud-storage-products), [usuarios y tipos de bucket](https://learn.cloud.ionos.com/expert/en/courses/module-5/unit-5.2-object-storage.html). Los tres buckets son una decisión de este proyecto; los permisos efectivos se comprobarán en la cuenta real.

## 4. Configurar el buzón IONOS y el servidor

Crea o confirma el buzón **avisos@planta14.com** en el producto de correo de IONOS y prueba que puede enviar y recibir desde su webmail. Necesitas la contraseña del buzón, no la de la cuenta general de IONOS.

La configuración del código es **smtp.ionos.es, puerto 465, SSL/TLS**, usuario y remitente `avisos@planta14.com`. [Instrucciones oficiales de IONOS](https://www.ionos.es/ayuda/correo/otros-programas-de-correo/configurar-una-cuenta-de-correo-manualmente-en-thunderbird/).

Como `planta14`, dentro del servidor:

```bash
sudo chown -R planta14: /srv/planta14
cd /srv/planta14/app
bash infra/deploy/generate-production-env.sh info@planta14.com
nano infra/.env.production
```

El generador no sobrescribe archivos existentes y deja permisos 600. Completa:

- `SITE_INDEXABLE=false` antes del 4 de diciembre.
- `S3_*`, `PUBLIC_MEDIA_BUCKET` y `PUBLIC_MEDIA_BASE_URL` con los buckets privado/público.
- `STORAGE_BACKUP_*` con la identidad de lectura.
- `OFFSITE_*` con el tercer bucket y su endpoint de la otra región.
- `BACKUP_AGE_RECIPIENT` con la clave **pública** age (empieza por `age1`). La pareja se crea en Windows (siguiente apartado). La privada **nunca** va al servidor ni a este archivo: no rellenes `BACKUP_AGE_IDENTITY`.
- `SMTP_PASSWORD` con la contraseña de `avisos@planta14.com`; `SMTP_ENABLED=true` tras revisarla. La misma contraseña alimenta las alertas: deja `ALERT_SMTP_PASSWORD` vacío.
- `ALERT_EMAIL_TO` y `MUNICIPAL_NOTICE_EMAIL_TO` con el correo real de quien deba recibirlas; después `ALERT_EMAIL_ENABLED=true` y `MUNICIPAL_NOTICE_EMAIL_ENABLED=true`.

### Clave de las copias (age), en Windows

Las copias de la base de datos se cifran en el servidor con la clave **pública**. Solo se pueden abrir con la clave **privada**, que custodia Pablo: en el gestor de contraseñas y en una copia impresa guardada en lugar seguro. Así una intrusión en el servidor no da acceso a las copias. Cuando hay que restaurar, la clave se entrega un momento por SSH (`docs/MANUAL-OPERACION.md`, apartado 9).

En PowerShell, una sola vez:

```powershell
winget install --id FiloSottile.age
age-keygen
```

Si `winget` no está disponible, descarga `age` para Windows desde <https://github.com/FiloSottile/age/releases> con ayuda técnica. `age-keygen` sin más opciones **muestra la pareja en pantalla y no crea ningún archivo**:

- la línea `# public key: age1…` es la **pública**: cópiala en `BACKUP_AGE_RECIPIENT` del servidor;
- la línea `AGE-SECRET-KEY-1…` es la **privada**: cópiala en una entrada nueva del gestor de contraseñas («Planta 14 – clave privada de copias»), imprímela desde allí y guarda el papel con los documentos importantes.

Después cierra PowerShell. No la guardes en un archivo de texto, ni en el correo, ni la pegues en un chat o en una IA. Si se pierde la privada, las copias ya hechas no se pueden abrir: comprueba el papel y el gestor antes de seguir. Tras la primera copia, haz el simulacro del apartado 6.

No configures otro proveedor SMTP. No cambies los MX del dominio para publicar la web. Conserva SPF, DKIM y DMARC de IONOS; comprueba la autenticación en un correo recibido y no crees dos registros SPF.

El adaptador Payload envía recuperación y avisos; las alertas usan curl SMTP. Un fallo de aviso queda registrado y no tiene cola de reintentos. Debe probarse cada circuito antes de depender de él.

## 5. Memoria, construcción y primera instalación

La swap de 4 GiB es un colchón, no 4 GB extra de RAM rápida. Límites por defecto:

| Trabajo | RAM máxima |
| --- | --- |
| Aplicación | 1.024 MiB (heap Node 640 MiB) |
| PostgreSQL | 640 MiB (buffers 128 MiB, 30 conexiones, work_mem 4 MiB) |
| Caddy | 128 MiB |
| Migraciones, solo mientras se ejecutan | 768 MiB |
| Constructor BuildKit separado | 1.280 MiB, heap Node 768 MiB, un trabajador de build y dos CPUs |
| Cada trabajo rclone de copia | 256 MiB |

Web + PostgreSQL + Caddy + constructor suman **3 GiB de límites de RAM**, dejando aproximadamente 0,7–1 GiB para Ubuntu, Docker y otras tareas, según la RAM utilizable que muestre el VPS. El constructor se para al terminar. No programes una construcción a la vez que copias grandes o las actualizaciones/reinicio nocturno. La migración ocurre después de construir. Los límites pueden provocar un fallo controlado si no alcanza la memoria; no los elimines para forzar el despliegue.

La imagen se construye con `infra/deploy/build-image.sh`, mediante BuildKit limitado. **La web anterior sigue funcionando durante la construcción.** El cambio final de contenedor puede cortar el servicio unos segundos; no se promete ausencia total de interrupciones.

Desde `/srv/planta14/app` en la sesión SSH:

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production COMMIT-VALIDADO
```

**Cómo se protege una actualización** (decidido por Pablo; detalle para él en `docs/MANUAL-OPERACION.md`, apartados 8 a 10):

1. **Modo mantenimiento.** Antes de la copia previa, `deploy.sh` pone el `/cms`, la API de escritura y los paneles municipales en **solo lectura**, con un mensaje claro para quien intente guardar. La web pública sigue funcionando. Se activa con un archivo en `/srv/planta14/mantenimiento`, que Caddy y la app consultan en cada petición: no hay que reconstruir ni reiniciar. Se desactiva **solo** cuando `/api/health` responde bien con la versión nueva. Así ningún cambio queda fuera de la copia.
2. **Si la versión nueva falla sin haber tocado la base**, se vuelve sola a la anterior y se quita el mantenimiento (código 1).
3. **Si falla después de cambiar la base** (código 2), se vuelve a la imagen anterior, se **deja el mantenimiento** y **no se restaura sola**, porque la clave privada no está en el servidor. La orden explica en lenguaje llano los pasos: Pablo ejecuta `infra/deploy/restaurar.sh` por SSH desde su PC y pega la clave cuando se la pide. La clave llega por la entrada estándar: no se escribe en disco, no aparece en el historial ni en la lista de procesos. El script restaura y quita el mantenimiento al comprobar la salud.
4. Mientras haya una restauración pendiente, `deploy.sh` no despliega otra versión.

Una restauración SQL no revierte por sí sola efectos en S3. Las copias públicas se reconcilian con `npm run cms:media:sync-public`, si la persona técnica lo considera necesario.

Tras instalar, crea el primer administrador desde la sesión SSH. Pablo introduce la contraseña en ese terminal, de forma oculta:

```bash
cd /srv/planta14/app
read -rp 'Correo administrador: ' CMS_BOOTSTRAP_EMAIL
read -rsp 'Contraseña (16 caracteres o más): ' CMS_BOOTSTRAP_PASSWORD
printf '\n'
export CMS_BOOTSTRAP_EMAIL CMS_BOOTSTRAP_PASSWORD
installed_commit=$(cat /srv/planta14/state/current)
APP_IMAGE="planta14-app:${installed_commit:0:12}" docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -T -e CMS_BOOTSTRAP_EMAIL -e CMS_BOOTSTRAP_PASSWORD migrate npm run cms:bootstrap
unset CMS_BOOTSTRAP_EMAIL CMS_BOOTSTRAP_PASSWORD
```

Comprueba que informa de administrador creado y entra en `https://planta14.com/cms`. Después sigue `docs/MANUAL-OPERACION.md` para las cuentas municipales. No ejecutes el importador de demostración en producción. Carga exclusivamente contenido con origen y derechos comprobados.

## 6. DNS y prueba antes de abrir

Cuando el servidor esté preparado, cambia el registro A de `planta14.com` a su IPv4 y `www` a la configuración acordada. No cambies MX ni TXT del correo. Revisa/elimina un AAAA antiguo si no has configurado y comprobado IPv6; no dejes una ruta a otro servidor. Caddy necesita los puertos 80 y 443 abiertos para emitir el certificado. Comprueba el cortafuegos de IONOS además del de Ubuntu.

Con `SITE_INDEXABLE=false`, prueba dominio y www, HTTPS real, sesión municipal, publicación, retirada con motivo desde CMS, originales privados, copia pública retirada, recuperación de contraseña y llegada del aviso municipal. Envía una alerta sintética y comprueba que llega al destinatario. Prueba el modo mantenimiento (`infra/deploy/mantenimiento.sh … activar`): intenta guardar en `/cms` y en un panel, comprueba el mensaje, comprueba que la portada se ve y desactívalo. Con al menos una copia hecha, Pablo hace desde su PC el **simulacro de restauración** (`restaurar.sh --solo-comprobar`, `docs/MANUAL-OPERACION.md`, apartado 9) con la clave del gestor y con la del papel: los dos deben decir «SIMULACRO CORRECTO». Haz una copia cifrada, súbela al bucket de la otra región y restáurala en un entorno vacío. Guarda el resultado; no basta con ver que existe un archivo.

Programa las tareas, solo después de probarlas:

```bash
sudo bash infra/deploy/schedule.sh --env-file /srv/planta14/app/infra/.env.production --user planta14
```

Copia PostgreSQL 03:15, originales 03:30, destino externo 03:45, disco cada hora y memoria cada minuto. Comprueba la primera noche y que los trabajos no se solapan. A más del **85 % de RAM durante 10 minutos**, el monitor intenta enviar un correo; repite como máximo cada seis horas durante el mismo episodio. Es la señal para revisar carga y preparar la mudanza, no para ampliar este plan. Una pausa larga en las muestras reinicia la medición. Si SMTP falla, consulta el registro y el monitor externo.

## 7. El 4 de diciembre y después

Solo con las pruebas y textos legales resueltos, cambia `SITE_INDEXABLE=true` y actualiza el contenedor con la versión ya validada. Activa GA4 únicamente cuando su configuración y textos estén revisados; la casilla de consentimiento no configura una propiedad de Google por sí misma. Da de alta el monitor externo y envía los sitemaps a Search Console.

Revisa copia diaria y alertas cada mañana la primera semana. Guarda tres versiones locales y vigila el disco de 120 GB: el constructor conserva caché. La persona técnica revisará el espacio antes de limpiar **solo** caché del constructor; nunca use una limpieza general que borre volúmenes. Mantén las versiones anterior/actual y las copias.

Para mudarse: contratar el destino cuando Pablo lo autorice, preparar Ubuntu y claves, detener escrituras, hacer copia final SQL + originales, restaurar en vacío, ejecutar sincronización de copias públicas, comprobar cuentas/retiradas/derechos/correo, cambiar DNS y conservar el servidor anterior hasta verificar el resultado. No se amplía el VPS M+.

La demo Netlify y las ramas históricas no se eliminan ni se modifican con esta instalación. Cualquier retirada o redirección de la demo se decide aparte.
