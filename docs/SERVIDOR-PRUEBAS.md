# Instalación de prueba en pruebas.planta14.com

Fecha: **2 de noviembre de 2026**. Servidor IONOS 87.106.30.18, usuario `planta14`. Commit instalado: **`c29e02446361eeb5c3a7acaaab5d1bedbb4abf6e`** (`c29e024`, rama `desarrollo/planta14-v2-instalacion`). Guía seguida: `docs/PUESTA-EN-MARCHA-IONOS.md`, apartados 4 a 6.

Este documento se fue escribiendo durante la instalación. Ningún secreto aparece aquí.

**Resultado: la web de prueba está instalada y funcionando en https://pruebas.planta14.com, con contraseña común, sin indexar y con copias cifradas programadas y comprobadas.**

## Avance

| Fase | Estado |
| --- | --- |
| 0. Comprobaciones previas (rama, SSH, DNS) | Hecha. `pruebas.planta14.com` resuelve a 87.106.30.18 (TTL 3600) |
| 1. Código en el commit validado, `chown` a `planta14`, setup (0 cambios) y check-server | Hecha. «Terminado: 0 cambios» y «RESULTADO: servidor preparado» |
| 2. Clave age | Hecha. Privada en el PC de Pablo (`C:\Users\pvela\planta14-age-privada.txt`, solo su usuario). Pública: `age15hrjslx2828ccskleft7n9tspuvmcjwt830f9quzh9467wj2ayrq6w7kcx` |
| 3. `infra/.env.production` | Hecha. `generate-production-env.sh --pruebas`, secretos entre comillas simples, `SMTP_ENABLED=true`, `ALERT_EMAIL_ENABLED=true`, hash de preproducción de `caddy hash-password` (contraseña por la entrada estándar). Huellas SHA-256: el cargador de los scripts y Compose (app y caddy) reciben exactamente los valores del archivo de secretos |
| 4. Buckets | Hecha. Regiones comprobadas (originales e imágenes `eu-central-3`, copias `eu-central-4`); copias con versionado y bloqueo COMPLIANCE de 30 días por defecto. Los tres estaban vacíos y sin política |
| 5. Política pública de `planta14-imagenes-b11` | Hecha, solo `s3:GetObject` sobre `public/*` (aplicada con `aws s3api put-bucket-policy` desde el contenedor `amazon/aws-cli`). Sin clave: objeto de prueba en `public/` 200; listar 403; fuera de `public/` 403; original 403 (dos formatos de URL); listar originales 403. Objetos de prueba borrados |
| 6. rclone → bucket con bloqueo | Hecha. Subida y verificación con `rclone copy --immutable` (rclone 1.71.2) aceptadas. El objeto `planta14/pruebas/_prueba-rclone/prueba-rclone-20261102T195624Z.txt` muestra `ObjectLockMode: COMPLIANCE` hasta el 2026-12-02. No se puede borrar: queda ahí 30 días (61 bytes) |
| 7. Despliegue (`deploy.sh … c29e024`) | Hecha: «Desplegada c29e0244…». Construcción 20:57–21:06 (hora de Madrid), 6 migraciones, `/api/health: ok`, certificado Let's Encrypt (emisor YE1, hasta el 31-01-2027). En los contenedores en marcha, `app` y `caddy` reciben exactamente los valores del archivo de secretos (huellas SHA-256 iguales). Primer intento parado al inicio sin cambiar nada: `/srv/planta14/mantenimiento` era de root porque lo creó Docker al montar la carpeta en una comprobación del hash (`docker compose run caddy`) hecha antes del despliegue. Se pasó a `planta14` y se relanzó |
| 8. Primer administrador (`cms:bootstrap`) | Hecha, con el correo de `ADMIN_EMAIL`. **La contraseña de `ADMIN_PASSWORD` no valía**: tiene 15 caracteres y `cms:bootstrap` exige 16 o más. Se generó otra de 24 caracteres, guardada en `C:\Users\pvela\planta14-admin-cms.txt` (solo tu usuario). Entrada comprobada: `/api/cms/users/login` 200 con rol `admin` y sesión válida en `/api/cms/users/me` |
| 9. Estructura (`cms:structure`) | Hecha: «Creados: 10 secciones, 6 concejos, 6 espacios municipales (inactivos). Sin contenido de demostración». No se usó el importador de demostración |
| 10. Contraseña de preproducción | Hecha. Sin contraseña o con otra: 401 en portada, `/cms` y `robots.txt` (desde el PC y desde el servidor). Con la común: 200 y la portada de Planta 14. `/api/health` abierto. `X-Robots-Tag: noindex, nofollow` y `robots.txt` con `Disallow: /` |
| 11. Alerta de prueba | Enviada por SMTP (smtp.ionos.es:465) a `ALERT_EMAIL_TO` sin error de curl a las 21:10. Falta confirmar que ha llegado al buzón |
| 12. Imagen real subida desde el CMS | Hecha. Subida por la API del CMS con el administrador (201): el original está en `planta14-originales-b11` y **sin clave da 403**; tampoco se sirve por la web sin sesión (403). No se publicó (no hay noticia), así que no hubo copia pública. Imagen de prueba borrada (200) |
| 13. Modo mantenimiento | Hecha. Activado: guardar en el CMS da 503 con el mensaje «Planta 14 se está actualizando…» y la portada sigue (200). Desactivado: guardar vuelve a funcionar (200) |
| 14. Copias a mano | Hechas las tres sin error: PostgreSQL (140 KB, cifrada con age), almacenamiento (cifrado) y copia externa «verificada en p14off:planta14-copias-b11/planta14/pruebas». La copia de PostgreSQL en Fráncfort tiene `ObjectLockMode: COMPLIANCE` hasta el 2026-12-02 |
| 15. `restore-test.sh` completo con la imagen de la web | **SUPERADA**, 33 comprobaciones OK, incluidas las tres que fallaron al preparar el servidor («hay tablas y filas que comparar», «la app lee los datos», «la app no borra tablas»). **Sin volúmenes nuevos.** El script terminó con código 1 solo porque no pudo borrar sus archivos sintéticos de `infra/test/out/` (creados como root por un contenedor); se borraron con sudo. Ver «Fallos encontrados» |
| 16. Simulacro `restaurar.sh --solo-comprobar` | **SIMULACRO CORRECTO.** Clave privada pasada desde el PC por la entrada estándar (solo la línea `AGE-SECRET-KEY-1…`, sin mostrarla): «Clave correcta» y descifra la última copia de PostgreSQL |
| 17. Programación (`schedule.sh`) | Hecha. `/etc/cron.d/planta14`: PostgreSQL 03:15, almacenamiento 03:30, copia externa 03:45 (hora de Madrid), disco cada hora y memoria cada minuto; rotación de registros |
| 18. Comprobación final | Hecha (21:57). Ver «Lo que salió bien» |
| 19. Limpieza | Hecha. En el servidor, el archivo de secretos y la contraseña del administrador borrados con `shred`, y la carpeta de trabajo eliminada. En el PC, `planta14-secretos.env` sobrescrito y borrado. La clave age se conserva. Registros de la instalación (sin secretos) en `/srv/planta14/state/` (`deploy.log`, `resto.log`, `restore-test.log`) |

## Resumen en lenguaje llano

La web de prueba de Planta 14 ya funciona en **https://pruebas.planta14.com**. Al entrar, el navegador pide un usuario y una contraseña comunes: el usuario es `planta14` y la contraseña, la de preproducción. Con ellos se ve la portada. Después, en `/cms`, cada persona entra con su propia cuenta. Google no la indexa. Hay un administrador creado y la estructura del periódico cargada (10 secciones, 6 concejos y sus 6 espacios municipales, apagados), **sin contenido de demostración**. Las copias de seguridad se hacen solas cada noche, cifradas, y se guardan también en Fráncfort, donde nadie puede borrarlas durante 30 días. Se ha comprobado que se pueden restaurar y que tu clave las abre.

### Lo que salió bien

- Instalado **exactamente** el commit `c29e02446361eeb5c3a7acaaab5d1bedbb4abf6e`. El servidor sigue «preparado» (0 cambios al repetir la preparación).
- `pruebas.planta14.com` ya resolvía a 87.106.30.18. No se ha tocado ningún registro DNS ni el correo.
- Certificado HTTPS real de Let's Encrypt, válido hasta el 31 de enero de 2027 (se renueva solo).
- **Contraseña común:** sin ella, o con una incorrecta, la portada, `/cms` y `robots.txt` dan 401. Con ella se ven (200). `/api/health` queda abierto para el monitor: `"status":"ok"`.
- **Administrador:** entra en `/cms` y su sesión funciona con rol `admin`.
- **Sin indexar:** `noindex, nofollow` en todas las respuestas y `robots.txt` con `Disallow: /`.
- **Secretos en `.env.production`:** escritos entre comillas simples, con permisos 600. Comparando las huellas SHA-256, sin ver los valores, los contenedores de la web y de Caddy y los scripts de copias reciben exactamente lo que había en el archivo de secretos.
- **Buckets:** regiones correctas. El de copias tiene bloqueo COMPLIANCE de 30 días. El de imágenes solo deja leer `public/*`: no se puede listar y fuera de `public/` da 403. Los originales no son accesibles sin clave: dan 403, también con una imagen real subida desde el CMS.
- **rclone** sube al bucket con bloqueo, y cada copia queda bloqueada 30 días.
- Copias de PostgreSQL, almacenamiento y externa, a mano y programadas.
- **Prueba de restauración completa SUPERADA**, sin dejar volúmenes.
- **Simulacro con tu clave age: CORRECTO.**
- Modo mantenimiento probado: impide guardar y la portada sigue funcionando.
- Alerta de prueba enviada sin error a `ALERT_EMAIL_TO`.
- No se ha activado nada de pago ni se han tocado `main`, `mejora/presentacion-la-voz` ni otras ramas.

### Fallos encontrados y cómo se resolvieron

1. **La contraseña de administrador del archivo de secretos tenía 15 caracteres** y `cms:bootstrap` exige 16 o más. No se ha cambiado esa regla. Se creó el administrador con el correo indicado y una contraseña nueva de 24 caracteres, guardada en `C:\Users\pvela\planta14-admin-cms.txt`.
2. **Primer despliegue parado al empezar**, sin cambiar nada. Una comprobación previa (lanzar el contenedor de Caddy para verificar el hash) hizo que Docker creara `/srv/planta14/mantenimiento` como root. Se pasó a `planta14` y el segundo intento salió bien. Error del procedimiento, no del código.
3. **`restore-test.sh` termina con código 1 aunque la prueba sale SUPERADA.** Al final no puede borrar `infra/test/out/…/s3data`, porque esos archivos los crea como root el contenedor del S3 de prueba. Se borraron con sudo. Es un fallo menor del script, que conviene corregir en el repositorio: la limpieza debería hacerse con un contenedor o con sudo.
4. **SSH bloqueado unos segundos dos veces.** La regla `ufw limit` del puerto 22 corta a quien abre más de 6 conexiones en 30 segundos. Ocurrió por abrir muchas seguidas. No fue fail2ban y no hubo que cambiar nada: se espaciaron las conexiones.
5. Comprobación de la sesión del administrador con `curl`: Payload ignora la cookie si la petición no lleva la cabecera `Origin` del dominio, por su protección CSRF. Es lo correcto: el navegador sí la envía. Con ella, sesión `admin`.

### Pendiente

- **Confirmar que llegó la alerta de prueba** («[Planta 14] Alerta de prueba de la instalación», enviada a las 21:10) al buzón de `ALERT_EMAIL_TO`. El servidor de correo la aceptó, pero no se ha podido ver el buzón.
- **No probado todavía:** publicar y retirar una noticia `[PRUEBA]` con imagen, para ver la copia pública aparecer y desaparecer; la recuperación de contraseña por correo; y el navegador real con la contraseña común. Son pruebas de la lista del apartado 6 de la guía, para hacer con un periodista.
- Un objeto de prueba de 61 bytes, `planta14/pruebas/_prueba-rclone/…`, queda bloqueado en el bucket de copias hasta el 2 de diciembre. Después se puede borrar o dejar caducar.
- Corregir la limpieza de `restore-test.sh` (punto 3 de los fallos).
- Siguen pendientes las decisiones de `docs/V2-INSTALACION.md`: retención de las copias externas (regla de ciclo de vida), la clave única, fecha del día de la salida y lista de periodistas.

### Lo que tienes que hacer tú

1. **Guardar en el gestor de contraseñas** y luego borrar del PC:
   - `C:\Users\pvela\planta14-age-privada.txt`: la clave privada de las copias. Imprímela y guárdala con los documentos importantes. Después borra el archivo; la guía recomienda que no viva en un archivo de texto.
   - `C:\Users\pvela\planta14-admin-cms.txt`: la contraseña del administrador de `/cms`. Si prefieres otra, cámbiala en `/cms` → tu usuario, con 16 caracteres como mínimo.
   - `C:\Users\pvela\planta14-age-publica.txt` solo tiene la clave pública. No es secreta y se puede borrar.
2. **Mirar el buzón de alertas** y confirmar que llegó la alerta de prueba (revisa también el correo no deseado).
3. **Entrar tú en https://pruebas.planta14.com** con el usuario `planta14` y la contraseña de preproducción, y después en `/cms` con el administrador.
4. **Dar de alta el monitor externo** (UptimeRobot) sobre `https://pruebas.planta14.com/api/health` (`docs/MANUAL-OPERACION.md`, apartado 1).
5. **Crear las cuentas `editor` de los periodistas** (guía, paso 6 ter) y explicarles la regla `[PRUEBA]`.
6. Mañana, comprobar que las copias de las 03:15, 03:30 y 03:45 salieron bien: `bash infra/deploy/status.sh --env-file infra/.env.production` en el servidor, o `/var/log/planta14/tareas.log`.
7. Decidir la retención de las copias en Fráncfort y, si quieres limitarla, crear la regla de ciclo de vida en el panel. Mientras no se decida, crecen.
