# Planta 14 v2: modo mantenimiento y restauración asistida

Rama `desarrollo/planta14-v2-mantenimiento`, creada desde `desarrollo/planta14-v2-final` (`19a00e9`). Responde al punto 2 de «Importante, pendiente de decisión» de `V2-FINAL.md`, según lo decidido por Pablo. No se han tocado `desarrollo/planta14-v2-final`, `main`, `mejora/presentacion-la-voz` ni otras ramas. Sin PR, sin despliegues reales, sin contrataciones y sin secretos.

## Qué se ha hecho

### 1. Modo mantenimiento (solo lectura durante una actualización)

Se activa creando el archivo `activo` en `MAINTENANCE_DIR` (por defecto `/srv/planta14/mantenimiento`). Esa carpeta está montada en solo lectura en Caddy y en la app, que lo comprueban **en cada petición**: no se reconstruye ni se reinicia nada.

| Capa | Qué hace |
|---|---|
| Caddy (`infra/Caddyfile.production`) | Rechaza con **503** y un mensaje JSON en español cualquier petición que no sea GET, HEAD u OPTIONS. Por tanto la web pública, el `/cms` y los paneles se siguen leyendo. Deja pasar iniciar y cerrar sesión, las lecturas de Payload por POST (`X-Payload-HTTP-Method-Override: GET`) y las funciones de servidor del `/cms`. Funciona con **cualquier imagen**, también con la anterior tras una vuelta atrás. |
| App (`cms/maintenance.ts`) | Un guardián `beforeOperation` en todas las colecciones rechaza crear, editar, borrar, autoguardar, restaurar versiones y las operaciones de contraseña (503, mensaje público). Así se cubren también las funciones de servidor del `/cms`, que Caddy deja pasar. |
| Aviso visible | Banda en la cabecera del `/cms` (`components/cms-maintenance-banner.tsx`). En los paneles municipales, un aviso y los botones de publicar desactivados. El mensaje de error de la API es el mismo, así que el panel lo muestra si alguien lo intenta. |
| `deploy.sh` | Lo activa **antes de la copia previa**. Comprueba que Caddy lo aplica de verdad y, si no, recrea Caddy. Lo desactiva **solo** cuando `/api/health` responde «ok» con la versión nueva. En la primera instalación no se usa, porque no hay nada que proteger. Si ya estaba activado a mano, lo respeta. |
| `infra/deploy/mantenimiento.sh` | `estado`, `activar ["motivo"]` y `desactivar`. Con una restauración pendiente, `desactivar` se niega salvo con `--forzar`, que la descarta y lo deja anotado. |
| `status.sh` | Muestra el modo mantenimiento y, si la hay, la restauración pendiente con sus instrucciones. |

Las migraciones (servicio `migrate`) no reciben el archivo, así que no se bloquean.

### 2. Restauración asistida (la clave privada nunca en el servidor)

- **Versión que falla sin cambiar la base:** vuelta atrás **automática** y mantenimiento desactivado. Código 1.
- **Versión que falla después de cambiar la base:**
  - vuelve a la imagen anterior;
  - **deja el mantenimiento activado**;
  - **no restaura**;
  - anota `restauracion-pendiente` con la copia, las versiones y el motivo;
  - imprime y envía por alerta los pasos en lenguaje llano, con la orden exacta para PowerShell. Código 2.
- **Mientras haya una restauración pendiente**, `deploy.sh` no despliega otra versión. Código 3.
- **`infra/deploy/restaurar.sh`** recibe la clave por la **entrada estándar**:
  - por `ssh -t` pidiéndola de forma oculta, o con `Get-Clipboard | ssh …`;
  - admite el final de línea de Windows y el BOM;
  - comprueba que corresponde a `BACKUP_AGE_RECIPIENT` antes de tocar nada;
  - la pasa a `age` por una tubería (`/dev/fd/3`): nunca como argumento ni como archivo;
  - restaura en una base nueva, que pone en servicio; la fallida se conserva como `planta14_fallida_<fecha>`;
  - reinicia la app y **desactiva el mantenimiento solo si `/api/health` responde bien**.
- **`--solo-comprobar`** es un simulacro: comprueba la clave y descifra la última copia sin cambiar nada.

### 3. Documentación para Pablo

- `docs/MANUAL-OPERACION.md`, apartados nuevos:
  - 8, «Actualizar la web»: qué ocurre y qué significa cada mensaje final;
  - 9, «Si una actualización falla: restauración asistida desde Windows»: paso a paso, errores posibles y simulacro trimestral;
  - 10, «Modo mantenimiento a mano».
- `docs/PUESTA-EN-MARCHA-IONOS.md`:
  - cómo crear la clave age en Windows sin que quede en ningún archivo y dónde guardarla;
  - el procedimiento de actualización decidido, que sustituye al párrafo «pendiente de decidir»;
  - el simulacro y la prueba del mantenimiento antes de abrir.
- `docs/V2-FINAL.md`: el punto 2 se marca como decidido y aplicado aquí.

## Resultados

Ejecutado el 2 de noviembre de 2026 en Linux (Docker Engine nativo). Todo con resultado correcto.

| Comando | Resultado |
|---|---|
| `infra/test/production-deploy-test.sh` | **SUPERADO: 96 comprobaciones, 0 fallidas** (detalle abajo) |
| `npm test` | 9 PASS, incluida la nueva `tests/maintenance.test.mjs` |
| `npm run typecheck` | Sin errores |
| `npm run lint` | 0 errores, 16 avisos (los que ya había) |
| `npm run build` | Correcto |
| `npm run test:block2` | 8 PASS |
| `npm run test:block3` | 17 PASS |
| `npm run test:launch` | 27 PASS |
| `shellcheck -x` de todo `infra/` | Sin avisos |
| `caddy validate` de `Caddyfile.production` (acme e internal) | `Valid configuration` |
| `infra/test/common-test.sh`, `staging-config-test.mjs`, `monitor-test.sh`, `memory-test.sh`, `staging-guard-test.sh` | Correctos |
| `infra/test/restore-test.sh` | SUPERADA. En Linux, la red de salida no llega a PostgreSQL por IP y `pg_hba` rechaza credenciales válidas. |
| `infra/test/postgres-roles-test.sh` | SUPERADA |
| `infra/test/staging-e2e.sh` (Playwright, imagen reconstruida) | SUPERADO: 8 PASS y la restauración idéntica |

### Detalle del ensayo de producción

1. **Modo mantenimiento con la versión buena** (activado con `mantenimiento.sh`):
   - la portada, la página de un concejo y `/api/health` responden;
   - la API de Payload se lee con sesión, también por POST con `X-Payload-HTTP-Method-Override: GET`;
   - crear, editar, borrar, subir imagen y recuperar contraseña dan **503** con el mensaje «Planta 14 se está actualizando…»;
   - la **app también lo rechaza sin pasar por Caddy** (petición directa dentro del contenedor);
   - aviso visible en `/cms` con sesión y en el panel de Lena;
   - el número de filas de todas las tablas no cambia;
   - al desactivarlo se vuelve a escribir y el aviso desaparece.
2. **Versión que falla con una migración que cambia datos.** Código 2, y además:
   - el mantenimiento se activó **antes** de la copia previa;
   - la migración se aplicó y se detectó;
   - **no se restauró**: los datos siguen cambiados y no se creó ninguna base nueva;
   - la app funciona con la imagen anterior: web pública 200, `/api/health` ok y escrituras rechazadas;
   - las instrucciones (con la orden para Windows) aparecen en la salida y en la alerta, y `status.sh` avisa;
   - no deja desplegar otra versión ni quitar el mantenimiento.
3. **Restauración asistida:**
   - el simulacro `--solo-comprobar` es correcto y no cambia nada;
   - un texto que no es una clave, o una clave age distinta, dan código 3 sin cambiar nada;
   - con la clave buena por la entrada estándar, con final de línea de Windows, da código 0 y «RESTAURACIÓN COMPLETADA»;
   - títulos originales, mismo número de filas, sin la tabla ni la migración de la versión mala, objetos del usuario de migraciones, base fallida conservada;
   - el mantenimiento se desactivó tras comprobar la salud y se vuelve a escribir.
4. **La clave no deja rastro:**
   - no aparece en ~3.950 líneas de `ps` tomadas cada 0,2 s durante la restauración;
   - no está en ningún archivo nuevo o modificado del ensayo, de `/tmp` ni de `$HOME`;
   - no está en el contenedor de PostgreSQL ni en el historial de órdenes;
   - no queda ninguna copia descifrada.
5. **Versión que falla sin migración:** código 1, vuelta atrás automática sin restaurar. El mantenimiento se activó durante el intento y se desactivó al volver, y se vuelve a escribir.
6. **Actualización correcta** (redespliegue forzado):
   - un proceso que escribe cada medio segundo recibió **503** durante el cambio;
   - el registro confirma el orden: mantenimiento, copia previa, `/api/health` ok, fin del mantenimiento;
   - al terminar se vuelve a escribir.
7. **Resto de comprobaciones de siempre:** HTTPS, `www`, cabeceras, `noindex`, `SITE_INDEXABLE`, `status.sh`, cron y alertas.

Una primera ejecución del ensayo dio 6 fallos, ninguno del código. Lo que se corrigió fue la propia prueba:
- la comprobación del aviso en `/cms` no enviaba la cabecera de navegador que Payload exige para aceptar la cookie;
- el simulacro se añadió después de empezar aquel ensayo;
- la construcción de la versión mala sin migración se quedó sin disco; se liberó la caché de construcción de Docker.

## Sin comprobar

- **SSH real desde Windows.** No hay servidor ni PC Windows en este entorno. La clave se ha pasado por la entrada estándar igual que lo haría `ssh` (con `\r\n`), pero no se ha probado `ssh -t` con pegado oculto, ni `Get-Clipboard |` desde PowerShell, ni el comportamiento del portapapeles del gestor de contraseñas.
- **`winget install --id FiloSottile.age`** en Windows no se ha probado. La guía da la alternativa de descargarlo de GitHub.
- **Navegador real en el `/cms` en mantenimiento.** El aviso se ha comprobado en el HTML del servidor y los rechazos en la API. No se ha visto con Playwright cómo muestra Payload el mensaje 503 al intentar guardar desde el formulario del `/cms`.
- **Funciones de servidor del `/cms` que escriben sin pasar por la API REST** (p. ej. programar publicación). Las bloquea el guardián de la app, pero solo en imágenes que lo incluyan. La primera versión anterior a la que se vuelva tras desplegar esta rama no lo tendrá; Caddy sí bloquea la API REST con cualquier imagen. Los bloqueos de documentos y las preferencias de Payload no se bloquean, porque son datos internos de trabajo y no contenido.
- **Efectos en S3.** Restaurar la base no revierte copias públicas en S3 (`cms:media:sync-public` si hace falta). Sin cambios respecto a `V2-FINAL.md`.
- **Servidor IONOS real.** Sigue lo pendiente de `V2-FINAL.md`: VPS, Let's Encrypt, DNS, buckets, correo y la barrera de PostgreSQL en Ubuntu nativo del VPS.
- **Commits por punto.** El commit del punto 1 ya incluye en `deploy.sh` la vuelta atrás que deja el mantenimiento y remite a `restaurar.sh`, que llega en el commit del punto 2. Se subieron juntos. Las pruebas se ejecutaron sobre el estado final.
