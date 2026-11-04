# Planta 14 v2: recuperación de contraseña

Rama **`desarrollo/planta14-v2-recuperacion-contrasena`**, creada desde `desarrollo/planta14-v2-revision-portada` (`d451b49`, que instala `9c19b92`). No se han tocado `main` ni el servidor. Sin PR.

## Problema

Al probar «He olvidado mi contraseña» con la cuenta municipal de prueba de Mieres en pruebas.planta14.com (4 de noviembre de 2026), el correo llegó, pero:
1. **Llevaba a `/cms/reset/<token>`**, y las cuentas municipales no pueden usar `/cms`: al terminar, Payload las mandaba a `/cms/unauthorized` en lugar de a su panel.
2. **Era el texto por defecto de Payload**: «Restablecer tu Contraseña», «Por favor haz clic…», sin el estilo de Planta 14.
3. **El panel municipal no tenía «¿Has olvidado tu contraseña?»**: solo se podía pedir desde `/cms/forgot`.

## Qué cambia

| Punto | Cómo queda |
|---|---|
| Correo | Asunto **«Planta 14: cambia tu contraseña»**. HTML propio con la cabecera de Planta 14, saludo con el nombre (escapado), botón «Elegir una contraseña nueva», la dirección en texto por si el botón no funciona, aviso de que **sirve una vez y caduca en una hora**, y «si no lo has pedido tú, ignora este correo». Sin imágenes ni recursos externos. `cms/password-reset.ts` |
| Enlace según la cuenta | **Redacción** (admin, editor): `/cms/reset/<token>`, la página de Payload, como antes. **Municipal**: `/<concejo>/panel/restablecer#token=<token>`, en su propio panel. El token va tras «#»: el navegador no lo envía al servidor, así que no queda en los registros de Caddy ni de la app, y la página lo quita de la barra de direcciones al abrirse. La dirección base es `CMS_SERVER_URL` (la de la configuración, nunca la cabecera `Host` de la petición) |
| Caducidad | **Una hora**, explícita en la configuración (era el valor por defecto de Payload) |
| Página nueva `/<concejo>/panel/restablecer` | Con la cabecera e identidad visual del concejo. Pide la contraseña dos veces, al menos 12 caracteres. Al guardar, Payload deja la sesión iniciada y se vuelve a **`/<concejo>/panel`**. Si el enlace no vale o ha caducado, lo dice y explica cómo pedir otro. `noindex` y `no-referrer`. Solo existe con el CMS real y en espacios activos, como el panel |
| Panel municipal | En la pantalla de entrada, **«¿Has olvidado tu contraseña?»**: pide el correo y envía el enlace. Responde lo mismo exista o no la cuenta, para no revelar qué correos tienen cuenta |
| Modo mantenimiento | Pedir el correo y guardar la contraseña nueva siguen bloqueados (Caddy y la app); los dos formularios muestran el aviso de mantenimiento |
| Móvil | Los textos y enlaces nuevos tienen al menos 13 px y 44 px de alto, como pide la revisión de la página municipal |

No hay migraciones nuevas ni variables nuevas en el `.env`.

## Resultados (en Windows, sin Docker)

| Comando | Resultado |
|---|---|
| `npm test` | 10 PASS, con el nuevo `tests/password-reset.test.mjs`: enlace de redacción y municipal, token codificado, nombre escapado, cuenta municipal sin espacio (vuelve al enlace de `/cms` sin romper el envío), asunto, caducidad y ausencia de recursos externos |
| `npm run typecheck` | Sin errores |
| `npm run lint` | 0 errores, 12 avisos (los mismos que antes) |
| `npm run build` | Correcto |
| Vista del correo | Revisada en Chrome a 900 px |

## Sin comprobar

Esta máquina no tiene Docker, así que **no se han ejecutado las pruebas de integración** (`test:block3`, `staging-e2e`, etc.) **ni el recorrido completo en un navegador**: pedir el correo desde el panel, abrir el enlace, cambiar la contraseña y entrar en el panel. Hay que hacerlo en Linux con la batería completa, o en pruebas.planta14.com después de desplegar:
1. En `https://pruebas.planta14.com/mieres/panel`, «¿Has olvidado tu contraseña?» con `pvelasco81@gmail.com`.
2. Comprobar el correo: asunto, aspecto en Gmail (escritorio y móvil) y que el enlace es `…/mieres/panel/restablecer#token=…`.
3. Abrir el enlace, poner una contraseña nueva y comprobar que entra en el panel de Mieres.
4. Abrir el mismo enlace otra vez: debe decir que no es válido.
5. Con una cuenta `editor`, pedirlo desde `/cms/forgot`: el enlace debe seguir siendo `/cms/reset/…`.
