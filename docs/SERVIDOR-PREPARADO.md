# Servidor de producción preparado (sin la web)

Fecha: **2 de noviembre de 2026**. Fase: apartado 2 de `docs/PUESTA-EN-MARCHA-IONOS.md`, sin instalar la web.

| Dato | Valor |
| --- | --- |
| Servidor | IONOS VPS Linux M+, Ubuntu 24.04.5 LTS, IPv4 87.106.30.18 |
| Recursos vistos | 3,7 GiB de RAM, 116 GB de disco, 4 GiB de swap creada en esta fase |
| Huella del servidor (ED25519) | `SHA256:/zcA3G7MKSiA/o7KDDz8dsYwrVSbL+tWcDm9Z1q1BCI` |
| Clave de Pablo (`planta14_ionos.pub`) | `SHA256:unEKf8exiO0mX+JZlwwSsZNXxYGP41bCU1mo85qtvXs` |
| Código en el servidor | `/srv/planta14/app`, commit `86aed41` (19a00e9 + dos correcciones de swap) |
| Acceso | solo `ssh planta14@87.106.30.18` con la clave; root no entra por SSH |

## Qué se ha hecho

1. **Windows.** Pablo creó la clave `planta14_ionos` con frase de paso y activó el agente SSH de Windows (arranque automático). La IA se conecta usando el agente; no conoce la clave ni la frase.
2. **Firewall de IONOS.** Revisado por captura: política «Firewall Policy for My VPS» activa, entrada TCP permitida en 22, 80 y 443. También permite 8443 y 8447 (valores por defecto de IONOS): no se usan y el cortafuegos de Ubuntu los bloquea. No se cambió nada en el panel.
3. **Primera clave.** Pablo añadió su clave pública a `/root/.ssh/authorized_keys` con la contraseña de root, en su terminal. La pública se copió a `/root/clave-pablo.pub`.
4. **Código.** Clonado de `desarrollo/planta14-v2-final` en `/srv/planta14/app` y fijado en `19a00e9`.
5. **`setup-server.sh --admin-user planta14 --ssh-key /root/clave-pablo.pub`.** 20 cambios, sin errores: usuario `planta14` sin contraseña con sudo y grupo docker, SSH solo con clave y sin root, ufw (22 limitado, 80, 443), actualizaciones de seguridad automáticas, fail2ban, Docker 29.9.2 con rotación de registros, Europe/Madrid, carpetas y 4 GiB de swap.
6. **Acceso comprobado en conexión nueva.** `planta14` entra con la clave y usa sudo; `root` recibe «Permission denied (publickey)».
7. **Correcciones de los scripts** (rama `desarrollo/planta14-servidor`), explicadas abajo, y comprobación final.
8. **Prueba de restauración y aislamiento** (`infra/test/restore-test.sh`) en el servidor. Después se borraron por identificador los dos volúmenes anónimos que dejó y se corrigió su limpieza.

No se ha instalado la web, ni creado buckets, ni tocado DNS, correo o el panel de IONOS. No se ejecutó `server-setup-test.sh`.

## Resultado de check-server

```
sudo bash /srv/planta14/app/infra/server/check-server.sh --admin-user planta14
... 34 comprobaciones OK ...
RESULTADO: servidor preparado
```

Repetir `setup-server.sh` con la misma clave: **`Terminado: 0 cambios`**.

### Fallo encontrado y corregido: la swap

Con `19a00e9`, `check-server.sh` fallaba en «swap >= 4 GiB» y repetir `setup-server.sh` terminaba en error («/swapfile-planta14 ya existe sin completar el swap requerido»). Causas:

- **`swapon --show --output SIZE` no selecciona la columna** en util-linux 2.39 (Ubuntu 24.04). Imprime todas y el script sumaba el nombre del archivo: la swap contaba siempre como 0. Con una swap previa, setup habría creado 4 GiB de más. Corregido con `swapon --show=SIZE` (commit `86aed41`).
- **Cabecera del archivo de swap.** Un archivo de 4 GiB se anuncia como 4 GiB − 4 KiB. Ambos scripts aceptan ahora hasta 1 MiB por debajo del objetivo (commit `83ed271`).

El ensayo en contenedores no lo detectaba porque allí la swap se omite (sin systemd).

## Resultado de la prueba de aislamiento

En el Ubuntu nativo, con contenedores y redes de prueba con nombres aleatorios (`p14rt-…`):

```
OK    la red de salida no resuelve PostgreSQL
OK    la red de salida no llega a PostgreSQL por IP (Linux: Ubuntu 24.04.5 LTS)
OK    control: la red interna sí entra con esas credenciales
OK    PostgreSQL rechaza credenciales válidas desde la red de salida (pg_hba)
```

La red de copias no encuentra PostgreSQL por nombre ni lo alcanza por IP, y unas credenciales que funcionan desde la red interna no sirven desde ella. Es lo que falló en Docker Desktop.

**Alcance:** en Linux el rechazo lo produce la barrera de red: la conexión no llega a PostgreSQL, así que `pg_hba` (la segunda barrera) no llega a evaluarse. Queda demostrado que desde la red de copias no se entra en la base con credenciales válidas; no se ha observado `pg_hba` actuando por sí sola, porque exigiría abrir a propósito el paso entre redes en producción.

### Resto de restore-test.sh

Copia cifrada, restauración en base vacía, rechazo de copias manipuladas, copia externa y recuperación desde ella: **OK**. Tres comprobaciones **fallaron** por no haber migraciones de la web (no hay `node_modules` ni imagen de la app en el servidor, y la tabla `users` no existe):

```
FALLO hay tablas y filas que comparar
FALLO restaurada: la app lee los datos
FALLO restaurada: la app no borra tablas
```

No son fallos de aislamiento. Se repetirá la prueba completa durante la instalación, con `RESTORE_TEST_APP_IMAGE` apuntando a la imagen de la web construida.

### Limpieza

La prueba borró sus contenedores y redes, pero dejó dos volúmenes anónimos (170 MB, datos sintéticos de las dos bases de prueba). Se borraron por su identificador. Se conservan las imágenes `postgres:17.6-alpine` (398 MB) y `rclone/rclone:1.71.2` (110 MB), que usará la web. `restore-test.sh` usa ahora `docker rm -f -v`; la corrección no está todavía en el servidor ni se ha probado: se comprobará en esa misma repetición.

Estado tras la limpieza: 0 contenedores, 0 volúmenes, 0 redes de prueba, disco 6,9 GB usados de 116 GB.

## Incidencias de procedimiento

- **Sesión de root de seguridad.** Al lanzar `setup-server.sh` no había ninguna sesión de root abierta de Pablo (la comprobación se hizo en el mismo comando que el script, en vez de antes). Sin consecuencias: `planta14` entró a la primera. La consola KVM de IONOS con la contraseña de root sigue disponible como acceso de rescate.
- **Clave con BOM.** La primera copia de la pública desde PowerShell llegó con una marca de codificación al principio; se volvió a copiar con `scp`.

## Qué falta

1. **Decidir el commit validado.** El servidor está en `86aed41`. Las correcciones de swap y de limpieza están en `desarrollo/planta14-servidor`; hay que llevarlas a `desarrollo/planta14-v2-final` (o instalar desde esta rama) para que la instalación use un commit con ellas.
2. **Permisos de `/srv/planta14/app`.** Hoy es de root (se clonó como root). El apartado 4 de la guía hace `sudo chown -R planta14: /srv/planta14` antes de generar el `.env`.
3. **Apartados 3 a 7 de la guía:** buckets y claves de Object Storage, buzón `avisos@planta14.com`, `.env.production`, pareja de claves age, construcción y despliegue, primer administrador, DNS, pruebas antes de abrir y programación de tareas.
4. **Repetir `restore-test.sh` completa** con la imagen de la web: deben pasar las tres comprobaciones pendientes y no deben quedar volúmenes.
5. **Opcional:** quitar del firewall de IONOS las reglas 8443 y 8447, que no se usan (lo decide Pablo).
6. `/root/clave-pablo.pub` sigue en el servidor; es pública y no supone riesgo.
