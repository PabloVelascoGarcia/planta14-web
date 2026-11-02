# Puesta en marcha de planta14.com en IONOS

Guía para Pablo, en lenguaje llano. Explica qué contratar, qué datos dar a la IA que haga la instalación, en qué orden irá todo, cómo cambiar el DNS sin perder el correo de **info@planta14.com**, cómo hacer la prueba final y qué hacer después con la demo de Netlify.

Salida pública: **4 de diciembre de 2026**. Conviene tener el servidor listo **una semana antes** (hacia el 27 de noviembre) y cambiar el DNS **dos o tres días antes**, con la web aún sin indexar en buscadores.

> Regla de oro: **las contraseñas y claves no se escriben en el chat de la IA ni en un correo.** Se guardan en el gestor de contraseñas, y en el servidor se escriben directamente en el archivo `.env` (abajo se explica cómo).

## 1. Qué contratar (lo contrata Blackeleven Capital)

| Qué | Exactamente | Por qué |
|---|---|---|
| **Servidor** | IONOS **VPS / Cloud Server** con **Ubuntu 24.04 LTS**, **4 vCPU, 8 GB de RAM, 160 GB SSD o más**, en un centro de datos de la **UE** (España o Alemania), con IPv4 pública | Donde vive la web, la base de datos y las copias locales |
| **Almacenamiento de objetos** | **IONOS S3 Object Storage**, en la misma región que el servidor si es posible. Hay que crear **dos buckets**: uno privado (p. ej. `planta14-privado`) y otro público (p. ej. `planta14-publico`) | Fotos originales (privadas) y copias de las publicadas (públicas) |
| **Destino de copias externo** | Un segundo almacenamiento S3 en **otra región o en otro proveedor europeo**, con un bucket (p. ej. `planta14-copias`) con **versionado o bloqueo de objetos** | Si se pierde el servidor o la cuenta, las copias siguen a salvo |
| **Correo transaccional** | Un proveedor europeo con **SMTP** (p. ej. Brevo, Mailjet o Scaleway Transactional Email) | Alertas, avisos de publicaciones municipales y recuperación de contraseñas |

No hace falta contratar el dominio: **planta14.com ya existe**. Solo hace falta acceso a su panel de DNS (apartado 4).

## 2. Qué datos pasar a la IA

**Se pueden decir en el chat (no son secretos):**

- La **IP del servidor** y el usuario inicial de IONOS (normalmente `root`).
- La **región y el endpoint S3** (p. ej. `https://s3.eu-central-3.ionoscloud.com`), y los **nombres de los buckets**.
- El **endpoint del destino de copias externo** y su bucket.
- El **servidor SMTP** del proveedor de correo (p. ej. `smtp-relay.brevo.com`, puerto 465 o 587) y el **remitente** (p. ej. `alertas@planta14.com`).
- El **correo para los avisos de Let's Encrypt** (p. ej. `info@planta14.com`).
- La **clave pública SSH** de quien vaya a entrar al servidor (un archivo que termina en `.pub`; es pública, se puede compartir).
- La **clave pública de las copias** (`age1…`; también es pública, ver el paso 3.4).
- El **ID de Google Analytics** (`G-…`), si se quiere analítica.
- Las **capturas del panel DNS** de planta14.com (apartado 4).

**NO se dicen en el chat (secretos):**

- La contraseña inicial de root del servidor. Úsala tú para la primera conexión, o dásela a la persona de confianza.
- Las **claves de acceso S3** (de la aplicación, de solo lectura y del destino externo).
- La **contraseña SMTP**.
- La **clave privada de las copias** (`age-key.txt`). Esta no va nunca al servidor.

Cuando la IA lo pida, se escriben en el servidor con:

```bash
nano /srv/planta14/app/infra/.env.production
```

Se guarda con Ctrl+O, se sale con Ctrl+X y el valor nunca aparece en la conversación.

## 3. Qué hará la IA, en este orden

Cada paso se puede repetir sin estropear nada. La IA te enseñará el resultado de cada comprobación.

### 3.1 Preparar el servidor (una vez, como root)

```bash
ssh root@IP-DEL-SERVIDOR
```

```bash
apt-get update && apt-get install -y git && git clone https://github.com/PabloVelascoGarcia/planta14-web.git /srv/planta14/app
```

```bash
cd /srv/planta14/app && git checkout <rama o etiqueta de la versión de salida>
```

```bash
bash infra/server/setup-server.sh --admin-user planta14 --ssh-key /root/clave-de-pablo.pub
```

Esto deja preparado el servidor:

- usuario `planta14`, que entra solo con clave;
- root sin acceso por SSH;
- cortafuegos con 22, 80 y 443;
- actualizaciones de seguridad automáticas, con reinicio a las 04:30 solo si hace falta;
- fail2ban contra intentos de acceso por SSH y en `/cms`;
- Docker y hora de Madrid.

**Antes de cerrar la sesión de root**, abre otra ventana y comprueba que entras:

```bash
ssh planta14@IP-DEL-SERVIDOR
```

Después, comprueba que todo ha quedado bien:

```bash
sudo bash /srv/planta14/app/infra/server/check-server.sh --admin-user planta14
```

Tiene que terminar en «RESULTADO: servidor preparado».

### 3.2 Configuración de producción

```bash
sudo chown -R planta14: /srv/planta14 && cd /srv/planta14/app
```

```bash
infra/deploy/generate-production-env.sh info@planta14.com
```

Crea `infra/.env.production` con contraseñas aleatorias. Después hay que rellenar en ese archivo, con `nano`:

- los datos S3 y de los buckets;
- el destino externo;
- el correo;
- la clave pública de las copias;
- y **`SITE_INDEXABLE=false`** hasta el día de la salida.

**Guarda una copia del archivo completo en el gestor de contraseñas.**

### 3.3 DNS

Ver el apartado 4. Se hace cuando el servidor esté listo, dos o tres días antes de la salida.

### 3.4 Clave de las copias (en tu ordenador, no en el servidor)

La IA te ayudará a crear un par de claves `age`. La **pública** va al `.env` (`BACKUP_AGE_RECIPIENT`). La **privada** (`age-key.txt`) se guarda en el gestor de contraseñas y en un USB guardado en lugar seguro. Sin ella no se pueden restaurar las copias.

### 3.5 Desplegar la versión

```bash
infra/deploy/deploy.sh --env-file infra/.env.production <etiqueta-de-la-version>
```

Construye la web en el servidor, hace una copia antes de tocar la base de datos, migra, arranca y comprueba `https://planta14.com/api/health`. Si algo falla, **vuelve sola a la versión anterior**: solo restaura la copia si la migración llegó a cambiar datos.

### 3.6 Primer administrador, cuentas municipales e imágenes

Primer administrador:

```bash
read -rp 'Correo: ' CMS_BOOTSTRAP_EMAIL && read -rsp 'Contraseña (16+): ' CMS_BOOTSTRAP_PASSWORD && export CMS_BOOTSTRAP_EMAIL CMS_BOOTSTRAP_PASSWORD
```

```bash
APP_IMAGE=planta14-app:$(cut -c1-12 /srv/planta14/state/current) docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -e CMS_BOOTSTRAP_EMAIL -e CMS_BOOTSTRAP_PASSWORD migrate npm run cms:bootstrap
```

Las cuentas municipales se crean en `/cms` (ver `docs/MANUAL-OPERACION.md`). Tras cargar contenido, ejecuta una vez `npm run cms:media:sync-public` con la misma orden, cambiando el último comando.

### 3.7 Copias, copia externa y alertas

```bash
sudo infra/deploy/schedule.sh --env-file /srv/planta14/app/infra/.env.production --user planta14
```

Programa copias diarias de la base de datos (03:15), de las imágenes (03:30) y la copia externa (03:45), además de la vigilancia del disco cada hora. Si algo falla, llega un correo cuando el correo esté activado (`ALERT_EMAIL_ENABLED=true`).

### 3.8 Monitor externo

Da de alta UptimeRobot u otro servicio parecido sobre `https://planta14.com/api/health`, con aviso al móvil (ver `docs/MANUAL-OPERACION.md`).

### 3.9 Estado en cualquier momento

```bash
infra/deploy/status.sh --env-file infra/.env.production
```

Muestra la versión actual y la anterior, los contenedores, la salud de la web, las últimas copias y los últimos despliegues.

## 4. Cambiar el DNS de planta14.com sin romper el correo

El correo de **info@planta14.com** depende de registros del DNS que **no hay que tocar**: los **MX** y los **TXT** (SPF, DKIM y DMARC). Si el correo funciona por **redirección** del proveedor del dominio, también depende de que el DNS siga en ese proveedor.

### 4.1 Antes de tocar nada: anotar cómo está

1. Entra en el panel del proveedor del dominio, en la sección DNS, y haz **capturas de pantalla de todos los registros**. Pásaselas a la IA.
2. Anota también si hay configurada una **redirección de correo** (por ejemplo, info@ → otra dirección) y a dónde va.
3. Comprueba desde fuera cómo responde el DNS. Si no usas terminal, utiliza https://toolbox.googleapps.com/apps/dig/ (escribe `planta14.com` y elige el tipo). Si usas terminal:

```bash
dig +short NS planta14.com
```

```bash
dig +short MX planta14.com
```

```bash
dig +short TXT planta14.com
```

```bash
dig +short TXT _dmarc.planta14.com
```

```bash
dig +short A planta14.com
```

```bash
dig +short CNAME www.planta14.com
```

Guarda las respuestas: son la «foto» de antes. **NS** dice dónde está el DNS, **MX** a dónde llega el correo, y **TXT** contiene el SPF (`v=spf1 …`).

4. Envía un correo de prueba a info@planta14.com desde otra cuenta y confirma que llega. Así sabrás que funcionaba antes del cambio.

### 4.2 El cambio (dos o tres días antes de la salida)

1. **Un día antes del cambio**, baja el **TTL** de los registros `A` de `planta14.com` y de `www` a 300 segundos. Así el cambio se nota en minutos y, si hay que deshacerlo, también.
2. **No cambies los servidores de nombres (NS)** ni muevas el DNS a otro sitio: es lo que más fácilmente rompe el correo y las redirecciones.
3. Edita **solo estos registros**:
   - `planta14.com`, tipo **A**: la IP (IPv4) del servidor de IONOS. **No añadas de momento un registro AAAA (IPv6)**, y borra cualquier AAAA antiguo de la web: con IPv6, la protección contra intentos de acceso no vería la IP real de los visitantes.
   - `www.planta14.com`: tipo **A** con la misma IP, o **CNAME** a `planta14.com`.
   - Si había una «redirección web» o «reenvío de dominio» del proveedor para la web (no para el correo), desactívala: la redirección de `www` la hace ahora el servidor.
4. **No toques** MX, TXT (SPF, DKIM, DMARC), ni ningún registro relacionado con el correo o con la redirección de correo.
5. **Correo transaccional:** el proveedor pedirá añadir registros (DKIM y a veces un CNAME de verificación). Añádelos como registros **nuevos**. Si pide añadir algo al SPF, **edita el registro SPF que ya existe** añadiendo su `include:`: nunca debe haber dos registros `v=spf1`. Si dudas, pásale a la IA la captura y el texto que pide el proveedor.

### 4.3 Después del cambio

1. Comprueba que `dig +short A planta14.com` devuelve la IP nueva y que `dig +short MX planta14.com` **devuelve lo mismo que antes**.
2. Abre https://planta14.com: el candado debe estar bien (Let's Encrypt tarda uno o dos minutos la primera vez).
3. Envía de nuevo un correo de prueba a info@planta14.com y confirma que llega.
4. Si algo va mal, **vuelve a poner en los registros A los valores anotados** en el paso 4.1. Con el TTL bajo, se arregla en minutos.

## 5. Prueba final antes del 4 de diciembre

Hazla con `SITE_INDEXABLE=false` (la web ya responde en planta14.com pero los buscadores no la indexan):

- [ ] `infra/deploy/status.sh` sin errores y `https://planta14.com/api/health` dice «ok».
- [ ] `http://planta14.com` y `https://www.planta14.com` llevan a `https://planta14.com`.
- [ ] Portada, una noticia, un espacio municipal, las páginas legales y el banner de cookies se ven bien en el móvil y en el ordenador.
- [ ] Con una cuenta municipal de prueba: publicar un aviso con imagen y declaración, verlo en la web, retirarlo desde `/cms` con un motivo y comprobar que desaparece. Borra después la cuenta de prueba.
- [ ] Al día siguiente hay copias nuevas (`status.sh`) y en el destino externo.
- [ ] Prueba de restauración en el servidor, sin tocar la web:

```bash
RESTORE_TEST_PAYLOAD=0 infra/test/restore-test.sh
```

- [ ] Alerta de prueba: con el correo ya activado, debe llegar un correo «FALLO: Prueba de alerta».

```bash
ALERT_ENV_FILE=/srv/planta14/app/infra/.env.production infra/monitor/run-with-alert.sh "Prueba de alerta" -- false
```

- [ ] Monitor externo: para la web 5 minutos y comprueba que llega el aviso al móvil y, al arrancarla, el de recuperación.

```bash
docker compose -f infra/compose.production.yaml --env-file infra/.env.production stop app
```

- [ ] Vuelta atrás: despliega una versión anterior y vuelve a la definitiva con `deploy.sh`. Comprueba que `status.sh` refleja ambas.
- [ ] Revisión de abogado de los textos legales hecha y [REGISTRO MERCANTIL] completado.

**El día 4 de diciembre:** cambia `SITE_INDEXABLE=true` en el `.env`.

```bash
DEPLOY_FORCE=1 infra/deploy/deploy.sh --env-file infra/.env.production <la misma etiqueta>
```

Después da de alta el dominio en Google Search Console y envía `https://planta14.com/sitemap.xml` y `https://planta14.com/sitemap-noticias.xml`.

## 6. Qué hacer con la demo de Netlify tras la salida

La demo (proyecto `planta14` del equipo B11 en Netlify, con previsualizaciones públicas como `deploy-preview-1--planta14.netlify.app`) es **pública y sin contraseña**. Una vez planta14.com funcione:

1. **El mismo día de la salida:** en Netlify, desactiva las **previsualizaciones de PR** (Site configuration → Build & deploy → Deploy Previews: «Don't deploy pull requests»). Así ninguna rama de desarrollo se publica por accidente.
2. **Si se quiere conservar para presentaciones:** déjala tal cual. Lleva `noindex`, no tiene datos reales ni formularios, y se puede seguir enseñando en `planta14.netlify.app`. Evita enlazarla desde la web nueva.
3. **Cuando ya no haga falta** (recomendado dos o tres semanas después de una salida estable): en Netlify, Site configuration → **Delete site**. La configuración está documentada en `docs/NETLIFY-CONFIG.md` y el código sigue en GitHub, así que no se pierde nada.
4. No apuntes planta14.com a Netlify en ningún momento: el dominio va solo al servidor de IONOS.
