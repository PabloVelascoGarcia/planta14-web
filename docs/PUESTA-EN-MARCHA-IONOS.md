# Puesta en marcha de Planta 14 en IONOS

Salida pública: **4 de diciembre de 2026**. Rama de instalación: **desarrollo/planta14-v2-instalacion**. Se instala el commit concreto que indica `docs/V2-INSTALACION.md`, ya probado, y no una rama que pueda cambiar durante la operación. En esta guía se llama `COMMIT-VALIDADO`.

## Dónde estamos (2 de noviembre de 2026)

| Paso | Estado |
| --- | --- |
| VPS IONOS M+ (Ubuntu 24.04, IP **87.106.30.18**) | Contratado |
| Preparación del servidor (apartado 2) | **Hecha.** `check-server.sh` en verde, código en `/srv/planta14/app` en el commit `86aed41`. Detalle en `docs/SERVIDOR-PREPARADO.md` |
| Object Storage: tres buckets y una clave (apartado 3) | **Creados** por Pablo |
| La web | **No instalada** |
| Siguiente | Instalación de prueba en **pruebas.planta14.com** (apartado 5), sin indexar. Después se pasa a planta14.com (apartado 6) |

No repitas el apartado 2: empieza en el 4 y sigue el 5 en orden.

## 1. Lo contratado y lo que se va a usar

Pablo ya ha contratado **IONOS VPS Linux M+**, Ubuntu 24.04, **2 vCores, 4 GB RAM y 120 GB NVMe**. Este plan **no se amplía**. Si falta capacidad, se prepara otro servidor y se cambia con copia y restauración. No hace falta volver a contratar este VPS.

Todo el almacenamiento es **IONOS Object Storage** (el sencillo del panel): originales en un bucket privado y imágenes publicadas en otro público, en Berlín, y copias cifradas en un tercero en Fráncfort, con bloqueo de objetos. Ya están creados (apartado 3). El correo saldrá exclusivamente del buzón IONOS **avisos@planta14.com**, que la guía todavía no da por creado.

Los datos del contrato y de los tratamientos deben ser revisados por quien gestione la protección de datos. No se completa [REGISTRO MERCANTIL] sin los datos reales.

## 2. Desde dónde se trabaja: PC Windows y servidor Linux

> **Hecho el 2 de noviembre** (`docs/SERVIDOR-PREPARADO.md`). Este apartado queda como referencia, para un servidor nuevo o una mudanza. Para entrar ahora: `ssh planta14@87.106.30.18` desde PowerShell, con la clave `planta14_ionos` cargada en el agente SSH de Windows.

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
git clone --branch desarrollo/planta14-v2-instalacion https://github.com/PabloVelascoGarcia/planta14-web.git /srv/planta14/app
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

## 3. Almacenamiento: IONOS Object Storage

Pablo ya ha creado en el **Object Storage sencillo del panel de IONOS** tres buckets y **una sola clave de acceso**. Ese producto no tiene identidades ni permisos separados: la clave es del propietario y puede hacer todo en los tres buckets. La guía y la configuración están pensadas para eso.

| Bucket | Región | Endpoint | Para qué | Acceso |
| --- | --- | --- | --- | --- |
| `planta14-originales-b11` | Berlín, `eu-central-3` | `https://s3.eu-central-3.ionoscloud.com` | Originales de imágenes (`S3_BUCKET`) | Privado |
| `planta14-imagenes-b11` | Berlín, `eu-central-3` | `https://s3.eu-central-3.ionoscloud.com` | Copias públicas de las imágenes publicadas (`PUBLIC_MEDIA_BUCKET`) | Lectura anónima solo de `public/*` |
| `planta14-copias-b11` | Fráncfort, `eu-central-4` | `https://s3.eu-central-4.ionoscloud.com` | Copias cifradas fuera del servidor (`OFFSITE_BUCKET`) | Privado, **bloqueo de objetos en modo compliance, 30 días** |

**De dónde salen los endpoints:** son los oficiales de IONOS para buckets «de contrato», los del panel. Están en la tabla de la página [Endpoints de IONOS Object Storage](https://docs.ionos.com/cloud/storage-and-backup/ionos-object-storage/endpoints): Berlín `eu-central-3` → `s3.eu-central-3.ionoscloud.com` y Fráncfort `eu-central-4` → `s3.eu-central-4.ionoscloud.com`. Los buckets «de usuario» usan otras regiones (`de` = `s3.eu-central-1…`, `eu-south-2`) y **no** sirven aquí. Las páginas antiguas que dan Berlín como `eu-central-2` corresponden a otro tipo de bucket. Compara la región que muestra el panel en cada bucket; si no coincide, manda el panel.

Ya están puestos en `infra/.env.production.example`. Solo hay que añadir la clave en `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`, directamente en el servidor y en el gestor de contraseñas. `STORAGE_BACKUP_*` y `OFFSITE_*_KEY` se dejan **vacías**: entonces se usa la misma clave.

### Qué supone tener una sola clave

- La clave está en el servidor, porque la necesita la web. Si alguien tomara el servidor, podría leer, cambiar o borrar originales e imágenes públicas. Las defensas son el propio servidor (solo SSH con clave, cortafuegos, fail2ban, actualizaciones) y las copias.
- **Lo que protege las copias es el bloqueo de objetos del bucket de copias, en modo compliance y 30 días.** Durante esos 30 días, nadie puede borrar ni modificar una copia guardada: ni con esta clave, ni el propietario, ni IONOS ([Object Lock en IONOS](https://docs.ionos.com/cloud/storage-and-backup/s3-object-storage/settings/object-lock)). Como mucho, quien tenga la clave podría añadir un «marcador de borrado» que la oculta o subir otra versión con el mismo nombre. La versión original sigue intacta y se recupera listando las versiones.
- Por eso **la copia externa nunca intenta borrar ni sobrescribir**. `infra/backup/offsite-sync.sh` solo sube archivos nuevos (`rclone copy --immutable`): nunca `sync`, `move` ni `delete`. Si encuentra fuera un archivo con el mismo nombre y distinto contenido, se para con error en vez de reescribirlo. No vuelve a subir lo que ya está ni intenta crear el bucket. Lo comprueba `infra/test/offsite-immutable-test.sh`, que registra cada petición HTTP.
- Los originales no tienen bloqueo. Si se borraran, se recuperan de la copia nocturna del almacenamiento: como mucho se pierde lo subido desde la última copia.

### Bucket de imágenes: solo lectura pública de `public/*`

La web escribe las copias públicas en `public/…` de `planta14-imagenes-b11` y las muestra desde `PUBLIC_MEDIA_BASE_URL`, que en la plantilla es `https://planta14-imagenes-b11.s3.eu-central-3.ionoscloud.com`. El bucket necesita una **política** que permita a cualquiera **leer** objetos bajo `public/`, pero no listar, escribir ni borrar:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "LecturaPublicaDeImagenesPublicadas",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::planta14-imagenes-b11/public/*"
  }]
}
```

Se pone en el panel, en la configuración del bucket («Política del bucket» o «Bucket policy»). Si el panel no lo ofrece, la persona técnica la aplica con la clave desde su equipo: `aws s3api put-bucket-policy --endpoint-url https://s3.eu-central-3.ionoscloud.com --bucket planta14-imagenes-b11 --policy file://politica.json`. No hagas público el bucket entero: IONOS advierte de que un bucket público deja **listar** su contenido. Tampoco toques los otros dos.

### Comprobaciones antes de usarlo (con archivos de prueba)

En la instalación de prueba (apartado 5), la persona técnica comprueba con `curl` y sin clave:

1. Un original subido desde `/cms` **no** se puede leer sin clave: debe dar 403 en `https://planta14-originales-b11.s3.eu-central-3.ionoscloud.com/…`.
2. Listar el bucket de imágenes sin clave da 403: `https://planta14-imagenes-b11.s3.eu-central-3.ionoscloud.com/`.
3. La imagen de una publicación de prueba carga desde `PUBLIC_MEDIA_BASE_URL` (200) y deja de cargar al retirarla.
4. Tras la primera copia externa, el objeto tiene el bloqueo. `aws s3api head-object --endpoint-url https://s3.eu-central-4.ionoscloud.com --bucket planta14-copias-b11 --key planta14/pruebas/postgres/ARCHIVO` debe mostrar `ObjectLockMode: COMPLIANCE` y una fecha de retención a 30 días. **No** intentes borrar una copia para comprobarlo.

Si la URL pública del punto 3 no funciona con ese formato, usa la que muestre el panel para el bucket y cámbiala en `PUBLIC_MEDIA_BASE_URL`.

### Recuperar una copia oculta

Si una copia apareciera borrada en el bucket de copias, no lo está: el bloqueo la conserva como versión anterior. La persona técnica lista las versiones (`aws s3api list-object-versions … --prefix planta14/`, o `rclone ls --s3-versions`) y descarga la versión original por su identificador. Mientras tanto, conviene cambiar la clave en el panel y en el `.env`.

### Coste y retención de las copias externas

La copia externa no borra nunca, así que el bucket de copias crece cada noche: una copia de la base y otra del almacenamiento. En el servidor se guardan 14 días. **Hay que decidir cuánto tiempo se conservan fuera** y, si se quiere limitar, crear en el panel una regla de ciclo de vida que caduque los objetos del bucket de copias a partir de los 30 días del bloqueo, por ejemplo a los 90. Mientras no se decida, crecen sin límite. Revísalo el primer mes en la factura.

## 4. Configurar el buzón IONOS y el servidor

Crea o confirma el buzón **avisos@planta14.com** en el producto de correo de IONOS y prueba que puede enviar y recibir desde su webmail. Necesitas la contraseña del buzón, no la de la cuenta general de IONOS.

La configuración del código es **smtp.ionos.es, puerto 465, SSL/TLS**, usuario y remitente `avisos@planta14.com`. [Instrucciones oficiales de IONOS](https://www.ionos.es/ayuda/correo/otros-programas-de-correo/configurar-una-cuenta-de-correo-manualmente-en-thunderbird/).

Como `planta14`, dentro del servidor:

Los pasos 1 a 3 del apartado 5 dejan el código listo. Después, para la **instalación de prueba**:

```bash
cd /srv/planta14/app
bash infra/deploy/generate-production-env.sh --pruebas info@planta14.com
nano infra/.env.production
```

El generador no sobrescribe archivos existentes y deja permisos 600. Con `--pruebas` ya vienen puestos:
- `SITE_DOMAIN=pruebas.planta14.com`;
- `SITE_INDEXABLE=false`: el despliegue se niega a indexar otro dominio que no sea planta14.com;
- `CADDY_WWW_REDIRECT=off`, porque no existe `www.pruebas`;
- copias externas bajo `planta14/pruebas`.

Completa:
- `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY` con la clave única de Object Storage. Buckets, regiones, endpoints y `PUBLIC_MEDIA_BASE_URL` ya vienen puestos (apartado 3). Deja vacíos `STORAGE_BACKUP_*`, `OFFSITE_ACCESS_KEY_ID` y `OFFSITE_SECRET_ACCESS_KEY`: usan la misma clave.
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

### Instalación de prueba en pruebas.planta14.com, paso a paso

Se parte del servidor preparado (commit `86aed41`, sin web). Todo se hace como `planta14`, en una sesión SSH desde PowerShell: `ssh planta14@87.106.30.18`. Pablo escribe él mismo las contraseñas y claves; la IA no las ve.

**1. Código del commit validado.** Hoy `/srv/planta14/app` es de root; se pasa a `planta14` y se fija el commit:

```bash
sudo chown -R planta14: /srv/planta14
cd /srv/planta14/app
git fetch origin desarrollo/planta14-v2-instalacion
git checkout --detach COMMIT-VALIDADO
git log -1 --format='%h %s'
```

**2. Comprobar que el servidor sigue igual.** Los scripts del servidor no cambian entre `86aed41` y la rama de instalación, así que repetir la preparación debe dar **0 cambios**:

```bash
sudo bash infra/server/setup-server.sh --admin-user planta14 --ssh-key /root/clave-pablo.pub
sudo bash infra/server/check-server.sh --admin-user planta14
```

Deben terminar en «Terminado: 0 cambios» y «RESULTADO: servidor preparado». Si setup hiciera cambios, para y revisa por qué.

**3. DNS de la instalación de prueba.** En el panel de IONOS, en el dominio planta14.com, **añade** un registro **A** con nombre `pruebas` y valor `87.106.30.18`. **No toques** `@`, `www`, MX ni TXT: planta14.com, la redirección actual y el correo siguen igual. Comprueba desde PowerShell, en unos minutos, que responde la IP del servidor:

```powershell
Resolve-DnsName pruebas.planta14.com -Type A
```

Caddy pide el certificado de Let's Encrypt en el primer despliegue: el registro tiene que funcionar antes.

**4. Archivo `.env` y claves.** Apartado 4: `generate-production-env.sh --pruebas`, la clave de Object Storage, la clave **pública** age y el correo. En el panel, la política de lectura pública del bucket de imágenes (apartado 3).

**5. Desplegar.** Es la primera instalación: no hay modo mantenimiento ni copia previa, porque no hay datos. La construcción tarda varios minutos:

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production COMMIT-VALIDADO
```

Debe terminar en «Desplegada». Comprueba en el navegador `https://pruebas.planta14.com/api/health`: debe responder `"status":"ok"`, con un candado válido de Let's Encrypt.

**6. Primer administrador.** Pablo introduce la contraseña en el terminal, sin que se vea:

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

Comprueba que dice que el administrador está creado y entra en `https://pruebas.planta14.com/cms`. No ejecutes el importador de demostración: carga solo contenido de prueba propio o con derechos comprobados.

**7. Prueba completa de restauración y aislamiento, con la imagen de la web.** Es la que quedó a medias al preparar el servidor. Ahora debe pasar entera y no dejar volúmenes:

```bash
docker volume ls -q | sort > /tmp/volumenes-antes.txt
installed_commit=$(cat /srv/planta14/state/current)
RESTORE_TEST_APP_IMAGE="planta14-app:${installed_commit:0:12}" bash infra/test/restore-test.sh
docker volume ls -q | sort | diff /tmp/volumenes-antes.txt - && echo "Sin volúmenes nuevos"
```

Debe terminar en «prueba de restauración SUPERADA» y «Sin volúmenes nuevos».

**8. Almacenamiento y copias, una vez a mano.** Haz las comprobaciones del apartado 3: original privado, listado denegado, imagen publicada visible y retirada, y bloqueo en la copia externa. Después:

```bash
bash infra/backup/backup-postgres.sh --env-file infra/.env.production
bash infra/backup/backup-storage.sh --env-file infra/.env.production
bash infra/backup/offsite-sync.sh --env-file infra/.env.production
```

Los tres deben terminar sin error. El último dice «Copia externa verificada en p14off:planta14-copias-b11/planta14/pruebas».

**9. Mantenimiento y simulacro de restauración.**
- `bash infra/deploy/mantenimiento.sh --env-file infra/.env.production activar "prueba"`: intenta guardar en `/cms` y en un panel municipal, comprueba el mensaje y que la portada se ve, y luego `… desactivar`.
- Pablo, desde su PC: `restaurar.sh --solo-comprobar` (`docs/MANUAL-OPERACION.md`, apartado 9), con la clave del gestor y con la del papel. Las dos deben decir «SIMULACRO CORRECTO».

**10. Programar las tareas** (apartado 6) y repasar la lista de pruebas antes de abrir.

**Cómo se protege una actualización** (decidido por Pablo; detalle para él en `docs/MANUAL-OPERACION.md`, apartados 8 a 10):

1. **Modo mantenimiento.** Antes de la copia previa, `deploy.sh` pone el `/cms`, la API de escritura y los paneles municipales en **solo lectura**, con un mensaje claro para quien intente guardar. La web pública sigue funcionando. Se activa con un archivo en `/srv/planta14/mantenimiento`, que Caddy y la app consultan en cada petición: no hay que reconstruir ni reiniciar. Se desactiva **solo** cuando `/api/health` responde bien con la versión nueva. Así ningún cambio queda fuera de la copia.
2. **Si la versión nueva falla sin haber tocado la base**, se vuelve sola a la anterior y se quita el mantenimiento (código 1).
3. **Si falla después de cambiar la base** (código 2), se vuelve a la imagen anterior, se **deja el mantenimiento** y **no se restaura sola**, porque la clave privada no está en el servidor. La orden explica en lenguaje llano los pasos: Pablo ejecuta `infra/deploy/restaurar.sh` por SSH desde su PC y pega la clave cuando se la pide. La clave llega por la entrada estándar: no se escribe en disco, no aparece en el historial ni en la lista de procesos. El script restaura y quita el mantenimiento al comprobar la salud.
4. Mientras haya una restauración pendiente, `deploy.sh` no despliega otra versión.

Una restauración SQL no revierte por sí sola efectos en S3. Las copias públicas se reconcilian con `npm run cms:media:sync-public`, si la persona técnica lo considera necesario.

## 6. Pruebas antes de abrir y paso a planta14.com

### Lista de pruebas en pruebas.planta14.com

Con `SITE_INDEXABLE=false` comprueba:
- HTTPS real y que la web responde;
- sesión municipal, publicación y retirada con motivo desde el CMS;
- originales privados y copia pública retirada;
- recuperación de contraseña y llegada del aviso municipal;
- que llega una alerta sintética al destinatario;
- el modo mantenimiento y el simulacro de restauración (paso 9);
- una copia cifrada subida al bucket de Fráncfort y restaurada en un entorno vacío (paso 7).

Guarda el resultado: no basta con ver que existe un archivo.

Programa las tareas, solo después de probarlas:

```bash
sudo bash infra/deploy/schedule.sh --env-file /srv/planta14/app/infra/.env.production --user planta14
```

Copia PostgreSQL 03:15, originales 03:30, destino externo 03:45, disco cada hora y memoria cada minuto. Comprueba la primera noche y que los trabajos no se solapan. A más del **85 % de RAM durante 10 minutos**, el monitor intenta enviar un correo; repite como máximo cada seis horas durante el mismo episodio. Es la señal para revisar carga y preparar la mudanza, no para ampliar este plan. Una pausa larga en las muestras reinicia la medición. Si SMTP falla, consulta el registro y el monitor externo.

### Pasar de pruebas.planta14.com a planta14.com

Cuando las pruebas estén bien, la misma instalación pasa al dominio definitivo. Hasta entonces planta14.com sigue como está.

1. **Decide qué pasa con los datos de prueba** (decisión de Pablo):
   - **Conservarlos**, si lo creado en pruebas ya es contenido real: cuentas, publicaciones o imágenes. No hay que hacer nada más.
   - **Empezar de cero.** La persona técnica borra la base de datos de la instalación y vacía los buckets de originales e imágenes; esos dos no tienen bloqueo. Las copias de prueba del bucket de Fráncfort (`planta14/pruebas`) no se pueden borrar: caducan con el bloqueo, a los 30 días. Después se repite el administrador (paso 6 del apartado 5).
2. **DNS de planta14.com.** Antes de tocar nada, haz una captura de todos los registros del dominio. Baja el TTL de `@` y `www` un día antes, si el panel lo permite. Cambia el registro **A** de `@` a `87.106.30.18` y `www` a esa misma IP, o a un CNAME a `planta14.com`. **No cambies** MX ni TXT: el correo de info@planta14.com sigue igual. Quita un AAAA antiguo si lo hubiera: no hay IPv6 configurado. Comprueba con `Resolve-DnsName planta14.com -Type A` y `Resolve-DnsName www.planta14.com`.
3. **`.env`.** En `infra/.env.production` cambia:
   - `SITE_DOMAIN=planta14.com`;
   - `CADDY_WWW_REDIRECT=on`;
   - `OFFSITE_PREFIX=planta14/produccion`.

   Deja `SITE_INDEXABLE=false` hasta el 4 de diciembre.
4. **Volver a desplegar el mismo commit** para que Caddy y la web tomen el dominio nuevo y pidan los certificados:

   ```bash
   DEPLOY_FORCE=1 bash infra/deploy/deploy.sh --env-file infra/.env.production COMMIT-VALIDADO
   ```

   Comprueba `https://planta14.com/api/health`, y que `https://www.planta14.com/…` redirige a `https://planta14.com/…`.
5. **Borra el registro `pruebas`** del DNS: el servidor ya no sirve ese nombre. Envía de nuevo a los ayuntamientos el enlace de su panel con el dominio definitivo.

## 7. El 4 de diciembre y después

Solo con las pruebas y textos legales resueltos, cambia `SITE_INDEXABLE=true` y vuelve a desplegar el mismo commit con `DEPLOY_FORCE=1` (como en el paso 4 anterior). Solo se acepta con `SITE_DOMAIN=planta14.com`. Activa GA4 únicamente cuando su configuración y textos estén revisados; la casilla de consentimiento no configura una propiedad de Google por sí misma. Da de alta el monitor externo y envía los sitemaps a Search Console.

Revisa copia diaria y alertas cada mañana la primera semana. Guarda tres versiones locales y vigila el disco de 120 GB: el constructor conserva caché. La persona técnica revisará el espacio antes de limpiar **solo** caché del constructor; nunca use una limpieza general que borre volúmenes. Mantén las versiones anterior/actual y las copias.

Para mudarse: contratar el destino cuando Pablo lo autorice, preparar Ubuntu y claves, detener escrituras, hacer copia final SQL + originales, restaurar en vacío, ejecutar sincronización de copias públicas, comprobar cuentas/retiradas/derechos/correo, cambiar DNS y conservar el servidor anterior hasta verificar el resultado. No se amplía el VPS M+.

La demo Netlify y las ramas históricas no se eliminan ni se modifican con esta instalación. Cualquier retirada o redirección de la demo se decide aparte.
