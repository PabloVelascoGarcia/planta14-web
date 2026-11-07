# Instalar el panel municipal en pestañas y los retoques

Para Claude Code en el PC de Pablo (Code local), con el agente SSH cargado.

Rama **`desarrollo/planta14-v2-panel`**, creada desde `desarrollo/planta14-v2-final` (`ff10f48`). **En pruebas: `a2d7404`** (entrega del 6 de noviembre, más abajo). **Commit a instalar ahora: el del apartado «Entrega del 7 de noviembre».** No se han tocado `main`, `mejora/presentacion-la-voz` ni el servidor. Sin PR.

Se instala sobre `d7d348f` (la versión final de salida). Una migración nueva, `20261106_214802_redaccion`: amplía «Pendientes de revisar» (concejo, sugerencias, decisión, quién y cuándo), añade los motivos de rechazo, las preferencias «Resumen diario» y «Fuera hasta» de cada usuario y el concejo oculto **Caudal** para lo comarcal.

## Entrega del 7 de noviembre (sobre `a2d7404`, ya en pruebas)

**Commit a instalar: `HASH-CORTO`** (`HASH-NUEVO`). Se instala sobre `a2d7404`, que es lo que hay en pruebas. **Sin migraciones nuevas.** El commit siguiente solo completa este documento.

| Punto | Cambio |
|---|---|
| 1. Sesión del panel (grave) | Cookie `__Host-planta14_panel` en producción (ver la revisión de seguridad). **Causa:** el panel usaba la cookie de Payload (`payload-token`). (1) Payload solo la acepta si el navegador declara la navegación del mismo sitio (`Sec-Fetch-Site`): al abrir el panel en otra pestaña desde un enlace de otro sitio (correo web, WhatsApp, un documento) pedía la contraseña aunque la sesión siguiera viva (reproducido en un navegador real). (2) Caducaba a las 2 horas y el panel nunca la renovaba. (3) Era la misma que la del CMS: entrar o salir en uno echaba al otro en el mismo navegador. **Arreglo:** cookie propia del panel (httpOnly, Secure, SameSite=Lax, ruta /), compartida por todas las pestañas, 14 días renovados con el uso (al abrir el panel, si tiene más de un día). Es un token de Payload cuya sesión queda en el usuario, que Payload valida por cabecera, sin depender de `Sec-Fetch-Site`. Solo la borran «Cerrar sesión» o la caducidad. Rutas nuevas: `/api/panel/entrar`, `/api/panel/salir`, `/api/panel/sesion` y el puente `/api/panel/api/…`, limitado a las llamadas del panel. Sin sesión del panel, la del CMS no entra en el panel: sale la entrada con una nota. Tras el despliegue, **cada ayuntamiento tiene que volver a entrar una vez** en su panel (la cookie de Payload ya no abre el panel). Caddy (`infra/Caddyfile.production`): entrar, salir y renovar se permiten durante el mantenimiento, como el inicio de sesión del CMS (**hay que aplicar Caddy**, paso 3 bis). |
| 2. Formulario de publicar | Tipo por defecto «Noticias». «Mostrar el aviso hasta» (y «Mostrar la ayuda hasta») solo en avisos y ayudas, con su explicación, separado por una raya del paso «2 Imagen (opcional)». Contador de caracteres también en el resumen. |
| 3. Botones y textos | «Publicar ahora» sin ↗. «Guardar como borrador» como botón secundario, al lado y del mismo tamaño. Nota bajo los botones y ayudas de los campos a 13 px con contraste AA. |
| 4. Pantalla de acceso | Sin el «1» suelto (también en «¿Has olvidado tu contraseña?»). «Lo que publiques aparece al momento en el espacio del Ayuntamiento de …». |
| 5. Bandeja | «Publicado por los ayuntamientos»: todas las filas con la misma disposición (tipo y título en una línea, recortado con «…» si no cabe y completo al pasar el ratón; ayuntamiento, estado y fecha debajo; acciones a la derecha). «Retirar» abre el motivo debajo, a todo el ancho. |
| 6. Riesgo de incendios | Nivel diario del índice de 112 Asturias por concejo (1 Bajo a 5 Extremo, color y texto) en el resumen de cada concejo, en `/[concejo]/util` y en una fila de `/util`, con la fecha del índice, la hora de consulta, la fuente con su licencia y el enlace a la página oficial. Lo lee el servidor cada hora (misma caché que «Útil»); las visitas no consultan al 112. Si la lectura falla, el formato cambia o el índice no es de hoy, no sale ningún nivel, solo «Índice de riesgo de incendios (112 Asturias)». `UTIL_INCENDIOS=off` en el `.env` lo deja solo en enlace. Fuente y licencia: ver las dudas 26 y 27. |
| 7. Manuales | Ayuntamiento: sesión de 14 días (y que tras esta versión hay que volver a entrar una vez), formulario (tipo, «Mostrar … hasta», contador, botones), índice de incendios. Operación: sesión del panel (apartado 5) y la fuente nueva de «Útil» (apartado 22). |


### Revisión de seguridad de la sesión del panel (antes de la batería)

Revisados la cookie del panel, la firma de los tokens y el puente `/api/panel/api`. Lo encontrado y corregido:

| # | Hallazgo en `6b0fb3a` | Corrección |
|---|---|---|
| S1 | El puente reenviaba **cualquier** ruta de la API de Payload (usuarios, noticias, ajustes, lecturas…). Las reglas de acceso de Payload frenaban lo indebido, pero el puente no se limitaba a lo necesario. | **Lista cerrada** con las nueve llamadas del panel (subir imagen; crear y editar su contenido; alta, cambio y baja de servicios; sugerencia; visibilidad de «Útil»; «¿Has olvidado tu contraseña?»), todas para cambiar datos; nada de lecturas ni parámetros extra (`depth`, `where`…). Lo demás: 404. |
| S2 | Sin cookie del panel, el puente reenviaba la petición **con la cookie del CMS**: un segundo acceso a la API para cualquier sesión del CMS. | El puente exige la sesión del panel (salvo «¿Has olvidado tu contraseña?») y nunca reenvía cookies. La cookie de Payload ya **no abre el panel**. |
| S3 | Un **token del CMS** servía como cookie del panel (los dos se firman igual). | Los tokens del panel llevan `aud: planta14-panel` y solo se aceptan esos. Además: cuenta municipal, con espacio y espacio activo, en cada petición. |
| S4 | **Desactivar el espacio** no cortaba las sesiones (el puente seguía aceptando escrituras, aunque la página diera 404); **cambiar el rol o el espacio** de la cuenta tampoco. | El panel y el puente rechazan un espacio inactivo en cada petición; al desactivarlo se borran las sesiones de sus cuentas (no reviven al reactivarlo). Cambiar el rol o el espacio de una cuenta borra sus sesiones. «Entrar» con el espacio inactivo: 403 con aviso. |
| S5 | La cookie se podía **fijar desde otro subdominio** (no llevaba prefijo). | En producción se llama `__Host-planta14_panel`: el navegador solo la acepta con Secure, ruta / y sin Domain. «Entrar» crea siempre una sesión nueva. |

**Ya estaba bien (comprobado con pruebas):** «Cerrar sesión» borra la sesión en el servidor (una copia de la cookie deja de valer); cambiar o restablecer la contraseña borra las sesiones (Payload); firma y caducidad las valida Payload; para cambiar datos, solo desde la propia web (Origin o `Sec-Fetch-Site: same-origin`; también entrar, salir y renovar); límite de intentos de Payload (5 fallos bloquean la cuenta 10 minutos) porque «Entrar» usa `payload.login`; las escrituras por el puente quedan en la auditoría con la cuenta municipal, como el acceso normal (Payload no registra los inicios de sesión en ningún acceso). **Una cookie copiada vale lo que una contraseña** hasta que se cierre sesión, caduque o se cambie la contraseña: es httpOnly (el JavaScript de la página no la lee) y Secure.

**Pruebas:** `scripts/participacion-seguridad-panel.mjs`, una por punto: aislamiento por concejo y rutas no permitidas; CSRF (Origin ajeno, `cross-site`, `same-site`, sin cabeceras; en el puente, entrar, salir y renovar); «Cerrar sesión» y copia de la cookie; contraseña cambiada y restablecida, cuenta movida de espacio, espacio desactivado (también tras reactivarlo) y cuenta borrada; firma cambiada, datos cambiados, sin firma, otra clave, caducado, sesión de otra cuenta, token del CMS y basura; fijación y atributos de la cookie; bloqueo por intentos y auditoría.

### Pasos en pruebas.planta14.com

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

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente, y la versión `a2d7404`.

**2. Fijar el commit y desplegar:**

```bash
git fetch origin desarrollo/planta14-v2-panel
```

```bash
git checkout --detach HASH-NUEVO
```

```bash
git log -1 --format='%h %s'
```

Debe mostrar `HASH-CORTO` y el asunto del commit.

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production HASH-NUEVO
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0. No aplica migraciones.

**3. Aplicar Caddy** (cambian las rutas permitidas durante el mantenimiento: entrar, salir y renovar la sesión del panel):

```bash
bash infra/deploy/aplicar-caddy.sh --env-file infra/.env.production
```

Debe terminar sin errores (recrea solo el contenedor de Caddy, unos segundos).

**4. Estado otra vez:**

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir `/api/health: ok` y la versión `HASH-CORTO`.

**5. Avisar a los ayuntamientos con cuenta** de que tienen que volver a entrar una vez en su panel (la sesión anterior ya no vale). Después, la sesión dura 14 días.

**6. Si algo falla:** si `deploy.sh` terminó con código 1 o 2, sigue lo que dice. Si fue bien pero algo no funciona, vuelve a `a2d7404`:

```bash
git checkout --detach a2d7404c1dbe06e74c5e02d9604fd58ec571d30e
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production a2d7404c1dbe06e74c5e02d9604fd58ec571d30e
```

```bash
bash infra/deploy/aplicar-caddy.sh --env-file infra/.env.production
```

Sin migraciones que deshacer. Al volver, los ayuntamientos vuelven a entrar con la sesión anterior (2 horas).

### Comprobaciones después del despliegue

En el ordenador y en el móvil (o el modo móvil del navegador, F12):
1. **Sesión, en un navegador limpio:** entra en `/mieres/panel` (pestaña A) y recarga; abre `/mieres/panel?pestana=util` en otra pestaña (B): dentro; vuelve a A y recarga: dentro. Abre también el panel desde un enlace en un correo: dentro. En el navegador (F12 → Aplicación → Cookies), `planta14_panel` con HttpOnly, Secure, SameSite Lax y caducidad a 14 días. Con el CMS abierto en el mismo navegador, los dos siguen dentro. «Cerrar sesión» saca de todas las pestañas del panel y no del CMS.
2. **Formulario:** tipo «Noticias» al entrar; «Mostrar el aviso hasta» solo en avisos y ayudas; contador del resumen; «Publicar ahora» sin flecha y «Guardar como borrador» como botón.
3. **Acceso:** sin el «1»; «…en el espacio del Ayuntamiento de Mieres».
4. **Bandeja:** con títulos largos y cortos, todas las filas iguales.
5. **Incendios:** en `/mieres` (resumen), `/mieres/util` y `/util`, el nivel de hoy con su color y texto, «Índice del dd/mm/aaaa, consultado a las hh:mm», la fuente y el enlace. Compara con https://www.112asturias.es/indice-incendios-asturias. La primera lectura llega en el primer minuto tras desplegar (la arranca `/api/health`).

6. **Seguridad, en el navegador:** con el panel abierto, F12 → Aplicación → Cookies: `__Host-planta14_panel` con HttpOnly, Secure, SameSite Lax, ruta / y caducidad a 14 días. Pulsa «Cerrar sesión» y recarga otra pestaña del panel: pide entrar. Con la cuenta de la redacción en el CMS, `/mieres/panel` muestra la entrada con la nota «Has entrado en el CMS como …».

### Resultados de la batería completa (esta entrega)

RESULTADOS-BATERIA

## Qué cambia

### A. Fallo de las casillas (bloqueante)

| Punto | Cambio |
|---|---|
| 1. Casillas y radios rotos en `/[concejo]/panel` | **Causa:** la regla general de los campos del panel (`.municipal-form input`, ancho 100 % y 48 px de alto) se aplicaba también a casillas y radios. Ahora excluye `checkbox`, `radio` y `hidden`. Las casillas recuperan su tamaño normal, con la zona táctil de 44 px en la etiqueta y el texto al lado. Revisadas en toda la web: panel, boletín (bloque verde y pie), formulario de fiestas, agenda y páginas de concejo. En el boletín de la portada, los concejos van ahora de dos en dos para que «Ribera de Arriba» no se parta a 1024 px. El CMS tiene sus propios estilos y no estaba afectado. |
| 2. Comprobación visual | Nueva en la batería (`scripts/participacion-panel.mjs`). A 1440, 1024, 768 y 390 px, en cada pestaña del panel, la portada, `/fiestas/enviar`, `/agenda`, `/mieres`, `/aller`, `/lena`, `/aller/util`, `/morcin` y el boletín del pie abierto, comprueba: ninguna casilla de más de 32 px, el texto en la misma fila que su casilla (y no una palabra por línea), y sin desplazamiento horizontal. Probada contra el CSS anterior: detecta el fallo (casilla de 579 px). |

### B. Panel más corto y ordenado

| Punto | Cambio |
|---|---|
| 3. Pestañas | **Publicar** (por defecto) · **Mis publicaciones** · **Útil** · **Directorio** · **Sugerencias** · **Visitas**. Cada una con su enlace (`/lena/panel?pestana=visitas`…). En el móvil, en una fila desplazable. |
| 4. Mis publicaciones | Una línea por publicación: tipo, título, estado y fecha; Editar, Publicar y Despublicar como enlaces pequeños a la derecha. 10 por página, con filtros por tipo y estado. «Editar» la abre en «Publicar». |
| 5. Directorio | Lista compacta con buscador. El formulario solo se abre con «Añadir servicio»; «Editar» lo abre en la misma fila. |
| 6. Visitas | Total, una fila de barras (una por día, con la cifra al pasar el ratón), páginas, fuentes y secciones como antes; CSV y PDF. |
| 7. Útil y Sugerencias | Casillas en dos columnas (una en el móvil), con el botón a la vista. |
| 8. Pie | Sin el bloque del boletín en el panel. |

### C. Retoques

| Punto | Cambio |
|---|---|
| 9. Condiciones | «Condiciones de las cuentas municipales» sale del pie y del aviso legal (allí queda como texto, sin enlace). La página lleva `noindex` y no está en el sitemap. Se enlaza solo, discretamente, desde la entrada al panel y el propio panel, como «Condiciones de uso del espacio municipal». El contenido no cambia. |
| 10. Escudos | Mieres, Aller y Lena en la misma caja: 84 px de alto (60 en el móvil), como mucho 64 px de ancho, con sus proporciones. |
| 11. Tiempo en `/[concejo]/util` | Con los mismos iconos y el mismo diseño que el resumen y la franja de `/util`: cuatro días, dos por fila. |
| 12. `/morcin` | La raya bajo el título ocupa todo el ancho del contenido. |

### D. Redacción: bandeja, avisos y resumen diario

Principio: los redactores son colaboradores a tiempo parcial. Todo se resuelve rápido y desde un solo sitio, sin avisos por lo que no requiere acción.

| Punto | Cambio |
|---|---|
| 14. Concejo obligatorio | En noticias y opinión (ya lo era), fiestas enviadas, sugerencias (el del ayuntamiento) y cartas. Para lo comarcal, **Caudal**: concejo oculto (sin página, sin espacio municipal, fuera del menú) que crea la migración; los formularios públicos `/fiestas/enviar` y `/cartas/enviar` lo ofrecen y no dejan enviar sin concejo. |
| 15. Bandeja «Pendiente de revisar» | `/cms/bandeja` (y su comienzo en el inicio del CMS): fiestas enviadas, sugerencias y cartas, por fecha, con concejo y responsable. Primero lo de tus concejos (los tuyos, los de quien esté fuera y los que no tienen responsable); después, el resto: es compartida, cualquiera lo ve y lo resuelve. En un clic: **Publicar** (fiesta, carta) o **Atendida** (sugerencia), o **Rechazar** con un motivo de una lista que edita la administración (**Motivos de rechazo**) y nota opcional (en las cartas, se envía al autor). Cada elemento muestra quién lo resolvió y cuándo. Debajo, lo publicado por los ayuntamientos, con **Retirar** (motivo obligatorio). Las sugerencias pasan a verlas toda la redacción. |
| 16. Avisos | Solo de lo que requiere intervención: un correo al responsable del concejo con el enlace directo al elemento en la bandeja. Con «Fuera hasta [fecha]» en su perfil, va al otro redactor hasta esa fecha. Sin responsable (Caudal), a los redactores presentes. Las sugerencias ya no escriben a la administración. |
| 17. Resumen diario | A las 8:00 (Madrid), solo si hay algo, a cada redactor: lo publicado por los ayuntamientos de sus concejos en las últimas 24 horas y lo pendiente en su bandeja, con enlaces. Se desactiva en el perfil. Ningún correo suelto por publicaciones municipales. Lo envía la propia web: un temporizador que arranca, como el refresco de «Útil», con `/api/health` (deploy.sh y el monitor), al leer «Útil» o al abrir el CMS; no hace falta cron. A mano: `npm run cms:resumen`. |
| 18. Manual y pruebas | Manual de operación, apartado 27 (y 12, 14, 15, 19 y 20 enlazan con él); manual del ayuntamiento (sugerencias). Bloque de pruebas `scripts/participacion-redaccion.mjs`; ajustadas las de responsables, sugerencias, `block2` e `instalacion` (un concejo más, Caudal). |

### E. Documentación

- `docs/MANUAL-OPERACION.md`: apartado 27, la redacción (bandeja, avisos, «Fuera hasta», resumen diario y Caudal); los apartados 5, 12, 14, 15, 19 y 20 enlazan con él.
- `docs/MANUAL-AYUNTAMIENTOS.md`: nuevo apartado «Las pestañas del panel» y apartados de «Mis publicaciones» y de las otras pestañas reescritos.
- Las capturas del manual son las de antes. `scripts/manual-screenshots.mjs` ya apunta a las pestañas nuevas: se regeneran con `MANUAL_SCREENSHOTS=true` al pasar `npm run test:launch`.

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

Debe decir `/api/health: ok`, sin mantenimiento ni restauración pendiente. **Anota la versión actual** (debería ser `d7d348f`).

**2. Fijar el commit y desplegar:**

```bash
git fetch origin desarrollo/planta14-v2-panel
```

```bash
git checkout --detach a2d7404c1dbe06e74c5e02d9604fd58ec571d30e
```

```bash
git log -1 --format='%h %s'
```

Debe mostrar `a2d7404 Resumen diario: el día enviado se guarda en external_cache, no en los ajustes [skip netlify]`.

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production a2d7404c1dbe06e74c5e02d9604fd58ec571d30e
```

```bash
echo "código: $?"
```

Debe terminar en «Desplegada», con código 0, y aplicar `20261106_214802_redaccion`.

**3. Comprobar el estado otra vez:**

```bash
bash infra/deploy/status.sh --env-file infra/.env.production
```

Debe decir `/api/health: ok` y la versión `a2d7404`.

**4. Si algo falla: volver a la versión anterior.** Si `deploy.sh` terminó con código 1 o 2, sigue lo que dice. Si el despliegue fue bien pero algo no funciona después, vuelve a desplegar la versión anotada en el paso 1:

```bash
git checkout --detach d7d348fcb9f873307b9f8ed5afa3c5f602c1c9fe
```

```bash
bash infra/deploy/deploy.sh --env-file infra/.env.production d7d348fcb9f873307b9f8ed5afa3c5f602c1c9fe
```

La migración nueva solo **añade** columnas, una tabla de ajustes, un tipo de pendiente («sugerencia») y el concejo oculto Caudal, que la versión anterior no usa: no hace falta deshacerla. Si se deshiciera, se borran antes los pendientes de tipo sugerencia; Caudal se queda (puede tener noticias o fiestas). Los enlaces con `?pestana=` siguen abriendo el panel en la versión anterior (sin pestañas).

## Comprobaciones después del despliegue

**5. Desde el servidor** (sigue en `/srv/planta14/app`). Una sola orden que consulta la web por dentro y resume lo que debe salir:

```bash
docker compose -f infra/compose.production.yaml --env-file infra/.env.production exec -T app node -e 'const g=p=>fetch("http://127.0.0.1:3000"+p,{redirect:"manual"}).then(async r=>[r.status,await r.text()]);(async()=>{const [,home]=await g("/");const [cs,ct]=await g("/condiciones-cuentas-municipales");const [,sm]=await g("/sitemap.xml");const [caudal]=await g("/caudal");const [,fe]=await g("/fiestas/enviar");console.log("pie sin condiciones:",!home.includes("condiciones-cuentas-municipales"));console.log("condiciones noindex:",cs,/<meta name="robots" content="noindex, ?nofollow"/.test(ct));console.log("condiciones fuera del sitemap:",!sm.includes("condiciones-cuentas-municipales"));console.log("Caudal oculto (menú, sin página):",!home.includes("href=\"/caudal\""),caudal);console.log("Caudal en el formulario de fiestas:",fe.includes("value=\"caudal\""))})()'
```

Debe decir `true` en todo, `200 true` en «condiciones noindex» y `404` en «Caudal oculto».

**6. En el navegador.** En el ordenador (1440 y 1024 px) y en el móvil (390 px; en el ordenador vale el modo móvil del navegador, F12), sin barra de desplazamiento horizontal. Para el panel hace falta una cuenta municipal de un concejo activo (Mieres o Lena); si no hay ninguna de prueba, crea una en **Usuarios** (rol municipal y su espacio) y bórrala al terminar.

1. **Pestañas del panel municipal** (`/mieres/panel` o `/lena/panel`):
   - al entrar, «Publicar»; arriba, **Publicar · Mis publicaciones · Útil · Directorio · Sugerencias · Visitas**; en el móvil, en una sola fila que se desliza con el dedo;
   - cada pestaña cambia la dirección (`?pestana=…`) y, al recargar, se queda en la misma;
   - «Mis publicaciones»: una línea por publicación, 10 por página, filtros por tipo y estado; «Editar» la abre en «Publicar»;
   - «Directorio»: buscador; el formulario solo se abre con «Añadir servicio»; «Editar» lo abre en su fila;
   - «Visitas»: el total, una fila de barras, CSV y PDF;
   - al pie del panel, «Condiciones de uso del espacio municipal» y **sin** el bloque del boletín.
2. **Casillas con su tamaño normal** (ordenador y móvil): en las pestañas **Útil** y **Sugerencias** (buzón), cada casilla es pequeña (como la de un formulario normal, no una barra a todo el ancho) y su texto va a su lado, en la misma fila; dos columnas en el ordenador y una en el móvil; el botón «Guardar» / «Enviar la sugerencia» se ve sin buscarlo. Igual en «Publicar» (casilla de derechos de la imagen), en el boletín verde de la portada y en «Elegir concejos» del pie.
3. **Bandeja `/cms/bandeja`** (con la cuenta de Andrés o de Juanfran): «De tus concejos», «Del resto de concejos», «Resuelto recientemente» y «Publicado por los ayuntamientos». En el inicio del CMS, debajo de los accesos, el bloque «Pendiente de revisar». En tu cuenta (arriba a la derecha), «Avisos y resumen» con el resumen diario marcado y «Fuera hasta» vacío. Con la cuenta de administración, en el inicio, «Motivos de rechazo» con los cinco motivos.
4. **Concejo «Caudal» oculto:** no aparece en el menú de concejos ni en la portada; `/caudal` da «no encontrada»; en `/fiestas/enviar` el concejo es obligatorio y ofrece «Caudal (varios concejos o toda la comarca)»; en el CMS, al crear una noticia, «Caudal» está en la lista de concejos.
5. **«Condiciones de uso del espacio municipal» fuera del pie público:** en el pie de la portada y de cualquier página no hay ningún enlace a las condiciones; solo en la entrada al panel y en el panel. La página se abre igual (lo comprueba el paso 5).
6. **Escudos del mismo tamaño:** en `/mieres`, `/aller` y `/lena`, el escudo de la cabecera tiene la misma altura en los tres (ninguno más grande), sin deformarse; también en el móvil.
7. **Iconos del tiempo en `/[concejo]/util`** (`/aller/util`, `/lena/util`): la caja del tiempo lleva un icono por día (sol, nubes, lluvia…), con máxima y mínima, dos días por fila, como la franja de `/util`. Si AEMET no ha respondido todavía, sale «Consultando…»: vuelve a mirarlo en unos minutos.
8. **Raya del título de Morcín:** en `/morcin`, la raya bajo «Morcín» va de lado a lado del contenido (no a media anchura).

**7. Aviso y resumen** (cuando haya una sugerencia o una fiesta enviada real, o con una cuenta municipal de prueba de un concejo de Juanfran): al enviar una sugerencia, a Juanfran le llega «Pendiente de revisar: Sugerencia de …» con el enlace a la bandeja; márcala como **Atendida** y aparece en «Resuelto recientemente» con tu nombre y la hora. El resumen diario llega a partir de las 8:00 si hay algo. Para probarlo antes, en `/srv/planta14/app` (la imagen recién desplegada):

```bash
migrate() { APP_IMAGE="planta14-app:$(git rev-parse HEAD | cut -c1-12)" docker compose -f infra/compose.production.yaml --env-file infra/.env.production --profile migrate run --rm -T migrate "$@"; }
```

```bash
migrate npm run cms:resumen
```

Debe terminar en «RESUMEN ENVIADO A …» o «NADA QUE ENVIAR».

## Resultados de la batería completa

**Batería completa, una sola pasada, sobre `dfcec0c`:**

| Prueba | Resultado |
|---|---|
| `production-deploy-test.sh` | **Una comprobación fallida** de 142: tras la restauración asistida, «mismo número de filas en todas las tablas que antes». El resto (imagen, migraciones, despliegue, vuelta atrás automática, mantenimiento, preproducción, ensayo, cron) correcto, sin volúmenes nuevos |
| `npm test`, `typecheck`, `lint`, `build` | Correctos; lint con 0 errores y los 16 avisos de estilo de siempre |
| `test:block2` (8 PASS), `block3` (17), `launch` (5), `instalacion` (16), `ensayo` (8), `formulario` (3), `portada` (9) | Correctos |
| `test:participacion` | Correcto, 45 PASS: casillas de 32 px o menos con su texto al lado y sin desbordes a 1440, 1024, 768 y 390 px; panel en pestañas; condiciones solo desde el panel; escudos; tiempo con iconos; raya de Morcín; bandeja, avisos, «Fuera hasta», resumen diario y Caudal. Medidas: a 390 × 844 la foto de apertura empieza a 318 px; columnas de «Útil» 3/3/3/2/1 |
| shellcheck (sin avisos), Caddy (acme e internal), `common-test`, `staging-config-test`, `monitor-test`, `memory-test`, `staging-guard-test` | Correctos |
| `restore-test.sh` (tres variantes), `offsite-immutable-test`, `pruebas-config-test`, `preproduccion-test`, `postgres-roles-test`, `staging-e2e.sh` (incluye el panel en su pestaña) | SUPERADAS, sin volúmenes nuevos ni restos |

**Causa y arreglo (`a2d7404`):**
- **Causa:** el temporizador del resumen diario arranca con `/api/health` (lo consulta `deploy.sh`) y, pasadas las 8:00, guardaba el día enviado en el ajuste `newsroom-settings`, que además escribía la primera vez sus cinco motivos por defecto. Esas filas aparecían o desaparecían alrededor de la restauración. No era un fallo de la restauración, sino estado de la web en marcha guardado entre la configuración.
- **Arreglo:** el día se reserva de forma atómica en `external_cache`, la tabla de estado que ya usa «Útil» y que esa comprobación excluye; solo el primero que la consigue envía, aunque haya reinicios o varios procesos. `newsroom-settings` queda solo con los motivos de rechazo. La migración `redaccion`, que no estaba desplegada, se regenera sin esa columna (`20261106_214802_redaccion`, mismo SQL propio); probada desde cero, hacia atrás y otra vez adelante.
- **Repetidas:** `production-deploy-test.sh` (**SUPERADO**, también «mismo número de filas»), `test:instalacion` (16 PASS), el bloque de redacción de participación, `npm test`, tipos, lint y build: correctos.
- **Orden del paso 5:** probada contra la web en local con el CMS activo; da `true` en todo, `200 true` y `404`.

## Dudas resueltas por prudencia

1. **Causa raíz:** la corrijo en la regla general (excluir casillas y radios), no con parches en cada formulario. Así no puede volver a pasar en un formulario nuevo.
2. **CMS:** sus casillas son de Payload, con sus propios estilos; no las toca la regla rota. Las reviso, pero no cambio nada.
3. **Pestañas:** se cambian en el navegador, sin recargar, y actualizan la dirección (`?pestana=`). «Publicar» no lleva parámetro. Funcionan con los botones Atrás y Adelante.
4. **Fecha en «Mis publicaciones»:** es la del último cambio, que es la que sirve para encontrar lo que se acaba de tocar.
5. **Filtro de estado:** «Publicado» incluye «Publicado · cambios sin publicar»; «Retirado» es filtro propio.
6. **Barras de visitas:** solo en el panel. El CMS de la administración mantiene la tabla por días, que es más útil para revisar cifras.
7. **Condiciones:** las enlazo desde la entrada al panel y desde el panel ya abierto. En el aviso legal quito el enlace y dejo el texto («conforme a las condiciones de uso de las cuentas municipales»), para no cambiar su contenido legal. La página no cambia.
8. **Escudos:** alto fijo y ancho máximo, con `object-fit: contain`: ningún escudo se deforma ni se recorta.
9. **Tiempo en `/[concejo]/util`:** cuatro días, dos por fila, con el diseño de la franja de `/util`.
10. **Boletín en el panel:** lo escondo solo en `/[concejo]/panel` (y sus subpáginas), no en el resto del pie.
11. **Boletín de la portada:** la comprobación nueva encontró que a 1024 px «Ribera de Arriba» partía en dos líneas y la casilla quedaba entre ambas. Pongo los concejos de dos en dos en ese bloque.
12. **Panel de demostración** (sin CMS): no cambia.
13. **Capturas del manual:** no las regenero en este encargo; el script ya está preparado para las pestañas.
14. **Caudal como concejo oculto:** un concejo más en la base de datos (`visible: false`), sin página ni espacio municipal. Así «Concejo» sigue siendo un único campo obligatorio en todo, y las tarjetas dicen «Caudal». Las pruebas que contaban seis concejos ahora cuentan siete. No tiene responsable: lo suyo avisa a los redactores presentes y sale en la bandeja de todos como «de tus concejos». La administración le puede poner responsable en **Concejos**.
15. **Bandeja sobre «Pendientes de revisar»:** la bandeja es la colección que ya existía, ampliada; no hay una segunda lista. Las publicaciones municipales siguen registrándose allí (para el resumen), pero ya resueltas: no esperan nada. La migración marca así las antiguas.
16. **«Aprobar» en cada tipo:** fiesta = publicarla (si no se puede, por ejemplo sin fechas confirmadas, la bandeja dice por qué y se abre la ficha); carta = publicarla; sugerencia = «Atendida». **Rechazar:** la fiesta se queda en borrador (sin correo a quien la envió, como hasta ahora); la carta se rechaza y el motivo, con la nota, se envía al autor (como hasta ahora); la sugerencia queda descartada, sin aviso al ayuntamiento.
17. **Motivos de rechazo:** una sola lista para todo, editable solo por la administración (como los lemas). Cinco motivos iniciales.
18. **Sugerencias para toda la redacción:** antes solo las veía su responsable; la bandeja compartida lo exige. Ajustado el manual del ayuntamiento. Los DNI y teléfonos de las cartas siguen viéndolos solo la administración y el responsable del concejo.
19. **Avisos:** las sugerencias ya no escriben a la administración (solo al responsable). «El otro redactor»: los demás responsables de algún concejo que no estén fuera; si no hay ninguno, el aviso no se envía y queda en la bandeja.
20. **Resumen diario:** «lo publicado ese día» son las últimas 24 horas antes del envío (a las 8:00 del día apenas hay nada). Solo publicaciones aún publicadas y no retiradas. Quien está fuera no lo recibe; lo de sus concejos va en el del otro redactor. Lo dispara la propia web (sin cron en el servidor): si estuviera parada a las 8:00, sale al arrancar; nunca dos veces el mismo día.
21. **Aviso general de publicaciones municipales** (`MUNICIPAL_NOTICE_EMAIL_ENABLED`, a un buzón de la administración y desactivado por defecto): no lo toco; es un ajuste del servidor, no un aviso a los redactores.
22. **«Mis concejos»** (de la entrega anterior) desaparece como página propia: su lista de publicaciones municipales con **Retirar** queda al final de la bandeja, y la preferencia del perfil se convierte en «Resumen diario» y «Fuera hasta». El correo por cada publicación municipal se quita.
23. **Pruebas que leían el panel sin pestaña** (de la entrega de las pestañas): `block3-integration`, `block3-browser`, `infra/test/staging-browser.mjs` y `manual-screenshots` buscaban las publicaciones en `/lena/panel`; ahora van a `?pestana=publicaciones`. `block3` pasa. `block3-browser` (opcional, `CMS_BLOCK3_BROWSER_TEST`) no se puede ejecutar aquí (le falta una herramienta local) y `staging-browser` va en la batería: usan los mismos selectores que ya prueba el bloque del panel.
24. **Fallo del CI de `d61759c` (exit 134) y arreglo `fce84f0`:** el disparador del resumen estaba en `instrumentation.ts`, que importa Payload; Next lo compila como entrada aparte con todo Payload y el montón de 768 MiB se agota (la misma causa que `1e0985a` el 5/11). Se quita: el temporizador (`ensureDigestTicker`, cada 5 minutos, una vez por proceso) arranca desde `/api/health`, al leer «Útil» y al abrir el inicio del CMS, el mismo arranque probado del refresco de «Útil». **Para Code local no cambia nada** (ni crontab ni `.env`). Tras un despliegue, `deploy.sh` consulta `/api/health` y lo arranca; si el contenedor se reiniciara solo, arranca con la siguiente consulta del monitor (cada 5 minutos), con la primera visita a «Útil» o al CMS; si a las 8:00 no estaba en marcha, el resumen sale al arrancar, una sola vez ese día. `npm test` falla si vuelve a aparecer un `instrumentation.ts`.
    **Memoria de la compilación** (etapa «build» de `infra/app.Dockerfile` repetida en la misma imagen base, `npm ci` limpio, `CMS_ENABLED=false`, 768 MiB de montón; pico del contenedor, incluye la caché de disco): `ff10f48` 2.594 MiB, compila · `d61759c` aborta sin memoria a 1.319 MiB · `fce84f0` 2.568 MiB, compila (−1 %).
25. **Día del resumen enviado:** se guarda en `external_cache` (clave `newsroom:resumen-diario`), junto a la caché de «Útil», porque es estado de la web en marcha y no configuración. Si se restaura una copia, como mucho se repite un resumen ese día, igual que la caché de «Útil» se vuelve a consultar.
26. **Fuente del índice de incendios:** la página del 112 no carga los niveles de ningún servicio de datos: vienen en su HTML y el botón «Mañana» los pide a un fragmento HTML del propio 112 (`ajax_indices_incendio.asp`). En el servidor de mapas del Principado (sig.asturias.es) solo constan capas de **susceptibilidad** a incendios (estáticas, CC BY 4.0), no el índice diario; desde esta sesión no se pudo abrir sig.asturias.es para revisar su catálogo completo (el dominio no está permitido en la red de la sesión). Por eso se lee la página oficial del 112, como pide el encargo cuando no hay servicio de datos. Nada de Copernicus, EFFIS ni terceros.
27. **Licencia:** el «Aviso legal» de la web del 112 son en realidad las condiciones de la aplicación móvil «Asturias 112»: prohíben copiar o redistribuir la aplicación, pero no regulan la información de la web ni prohíben reutilizarla; tampoco publican una licencia para el índice. Su `robots.txt` permite la página. Por prudencia, la web lo dice tal cual («Información pública del 112 Asturias, sin licencia de reutilización publicada; consulta siempre la página oficial»), enlaza siempre la página oficial y se puede quitar con `UTIL_INCENDIOS=off`. **Conviene confirmarlo con el SEPA** (informacion.sepa@asturias.org) o, si publican el índice en sig.asturias.es o en datos abiertos, cambiar a ese servicio.
28. **Índice que no es de hoy o lectura fallida:** no se muestra el último nivel bueno (al revés que el resto de «Útil»), porque un nivel de ayer puede ser peligroso. Si el 112 no da nivel de un concejo («Sin información»), en ese concejo sale solo el enlace.
29. **Hora del dato:** la página del 112 solo da la fecha del índice, no la hora; se muestra la fecha del índice y la hora a la que la consultamos.
30. **Colores:** los de la leyenda de niveles (verde, amarillo, naranja, rojo, granate), con el naranja oscurecido para que el texto blanco tenga contraste AA; el nivel va siempre también en texto. Los ayuntamientos no lo pueden ocultar (dato de seguridad).
31. **Cuentas abiertas antes del despliegue:** tras la revisión de seguridad, la cookie de Payload ya no abre el panel (era la vía de los hallazgos S2 y S3): cada ayuntamiento entra una vez tras el despliegue. Una cuenta de la redacción en el panel ve la entrada con una nota («Has entrado en el CMS como … Para el panel, entra con la cuenta del ayuntamiento»), no «Sin acceso», para que se pueda entrar en el panel sin salir del CMS.
32. **Renovación:** la cookie se renueva al abrir el panel si tiene más de un día (no en cada petición), para no escribir en la base de datos a cada clic.
33. **«Mostrar la ayuda hasta»:** en las ayudas el campo se llama así (en los avisos, «Mostrar el aviso hasta»), con la misma función; se guarda igual que el de los avisos.
34. **Nombre de la cookie:** en producción `__Host-planta14_panel` (en lugar de `planta14_panel`): el prefijo hace que el navegador la rechace si no viene con Secure, ruta / y sin Domain, que es lo que impide fijarla desde otro subdominio. En desarrollo sin HTTPS sigue siendo `planta14_panel`.
35. **Inicios de sesión en la auditoría:** el acceso normal (Payload) no los registra; el del panel tampoco, para que sean iguales. Sí quedan, como siempre, todas las escrituras con la cuenta. Registrar entradas y salidas exigiría ampliar el registro de auditoría (migración): lo dejo para cuando se pida.
36. **Acceso directo a la API de Payload con una cuenta municipal** (`/api/cms/users/login` y luego `/api/cms/…`): es el acceso normal de Payload, anterior a este cambio, con sus reglas de acceso (cada ayuntamiento solo su espacio) y su protección CSRF; el panel ya no lo usa. No lo cierro aquí para no tocar las pruebas que lo usan; si se quiere cerrar a las cuentas municipales, es un cambio aparte.

