# Revisión del bloque 3

Base revisada: `18c243d` (incluye `57ff821` y `befa1cf`), rama `desarrollo/planta14-v2-bloque3`. Copia local independiente. No se han mezclado ni modificado infraestructura, bloque 2, main ni demo. Sin PR, despliegues ni servicios contratados.

## Correcciones pequeñas realizadas

- **Aislamiento autenticado:** una cuenta municipal ya no lee contenido publicado, metadatos de imágenes u originales de otro ayuntamiento ni de Planta 14 por la API. Su espacio se filtra por ID, y las versiones de configuración de espacios quedan reservadas a la redacción. Una cuenta municipal sin espacio falla cerrada. Los filtros se aplican también a relaciones con `depth` y a rutas de archivo firmado.
- **Retirada frente a versiones:** la regla consulta el documento vigente en la base, no solo el último borrador. No se puede restaurar una versión mientras el documento esté retirado, ni siquiera con un editor: debe restablecerse expresamente por el procedimiento editorial antes. Una cuenta municipal tampoco restaura versiones históricas que pertenecían a otro espacio aunque un editor haya reasignado después el documento. La web pública y el recuento de usos excluyen además `withdrawal.withdrawn=true`, incluso si el estado publicado resultase incoherente. El panel prioriza el motivo de retirada vigente frente a un borrador.
- **S3 con fallos parciales:** se comprueban los errores por objeto de `DeleteObjects`, aunque S3 responda HTTP 200. El registro no se olvida como si el borrado hubiera terminado correctamente. Un fallo durante una copia intenta limpiar los objetos que ya se escribieron; si esa limpieza también falla, se propaga un error explícito. El reconciliador verifica originales y variantes con HEAD y rehace las copias registradas incompletas. Borrar un registro de imagen comprueba el uso real y limpia antes su copia conocida. Reemplazar un archivo fuerza renovar su copia pública.
- **Configuración recomendada:** `.env.cms.example` y la guía recomiendan un bucket público separado. El emulador local crea el bucket adicional. No se ha eliminado la compatibilidad con prefijo compartido, ni se ha elegido proveedor ni modificado políticas reales.
- **Destino de upload:** una cuenta municipal no puede elegir `prefix` al subir un archivo. Esto evita que solicite directamente el espacio de nombres público cuando se conserve la configuración heredada de bucket compartido.
- **Prueba existente corregida:** una publicación municipal hecha por editor no tenía fecha obligatoria y devolvía 400; el test no comprobaba la respuesta y afirmaba que no generaba aviso sin haber publicado nada. Ahora envía fecha y exige 201 antes de comprobar los avisos.

## Ataques y comprobaciones ejecutados

| Vía | Resultado local |
| --- | --- |
| REST por ID, listado, borrador, publicado, relaciones `depth=5` y query `overrideAccess=true` | Sesión de Lena no accede al contenido de Mieres; la query no concede privilegios. |
| Escrituras directas, publicación/despublicación, creación ajena, cambio de espacio y borrado | Denegadas fuera del espacio propio. |
| Versiones por listado/ID y restauración POST, con/sin `draft=true` | No hay acceso a versiones ajenas; retirada vigente impide restaurar versiones antiguas con cuenta municipal o editor. También se prueba un documento reasignado entre espacios. |
| Retirada por PATCH directo, borrador y actualización masiva | No permite republicación ni borrar/falsificar el motivo desde el ayuntamiento. La API pública no devuelve el retirado. |
| Imágenes por metadatos y descarga firmada | No permite imágenes ni originales ajenos con sesión municipal, aunque exista copia pública. |
| Upload multipart REST | El cliente no puede falsificar `uploadedBySpace`; lectura, edición y borrado desde otro ayuntamiento denegados. |
| Falsificación de filename, prefix, variantes, contador y clave pública | Payload sanea la identidad de archivo y los campos protegidos conservan sus valores del servidor. |
| GraphQL | `/api/cms/graphql` devuelve 404, tanto por handler REST como por HTTP: no hay ruta GraphQL montada. No se ha activado para esta revisión ni se afirma haber auditado resolvers que se monten en el futuro. |
| Panel municipal y `/cms` | El panel muestra solo datos propios; otro municipio recibe aviso sin formulario; una cuenta municipal no obtiene datos editoriales en `/cms`. |
| Retirar o borrar contenido con imagen propia | La copia pública da 404 en el origen cuando desaparece el último uso publicado. |
| Segundo PUT público falla | Se limpian los objetos ya copiados y la operación falla sin anunciar publicación correcta. |
| DeleteObjects borra solo parte y devuelve errores con HTTP 200 | La operación falla, SQL revierte y se conserva la clave; la sincronización repara las copias registradas que hayan quedado incompletas. |
| Falta una variante | Se ejecuta el proceso real del script `cms:media:sync-public`; vuelve a existir la copia completa con nueva clave. |

### Prueba en navegador real

Chrome instalado, automatizado con Playwright **1.64.1**, viewport móvil 390×900, `CONTENT_SOURCE=payload`, servidor local y datos originales sintéticos. Se hicieron login por formulario, publicación, comprobación en página pública anónima, retirada editorial y lectura del motivo en el panel. También se navegó al panel de otro ayuntamiento y se comprobó que no aparecía formulario. Sin errores JavaScript de página. No se utilizaron credenciales reales.

Para repetir (Chrome instalado o Chromium de Playwright):

```powershell
npm install --prefix .local/review-tools --no-save --package-lock=false playwright@1.64.1
$env:CMS_BLOCK3_TEST = 'true'
$env:CMS_BLOCK3_BROWSER_TEST = 'true'
npm run test:block3
```

En Windows el helper utiliza el Chrome de `C:/Program Files/Google/Chrome/Application/chrome.exe`, o `CHROME_PATH`. En otro sistema se necesita el navegador de Playwright. `PLAYWRIGHT_MODULE` permite indicar otra instalación. La herramienta se instala bajo `.local`, ignorado por Git, sin cambiar dependencias de aplicación ni lockfile.

## Migración y prueba del bloque 2

La migración **no usa `ADD VALUE`**: ya reemplazaba el tipo enum dentro de una transacción, conservando admin/editor y añadiendo municipal. No había que corregir ese punto. Se probaron `up`, reversión bloqueada con cuentas municipales, `down` tras retirarlas y nuevo `up`. El relleno de `publishedUses` cuenta una sola vez un documento que use la misma imagen como principal y SEO; se ha añadido la exclusión defensiva de retirados.

Los cambios originales en `test:block2` se limitaban a exigir sesión para URL firmada y a revertir/aplicar el bloque 3 alrededor de la reversión del bloque 2. No eliminaban comprobaciones: se conserva el rechazo anónimo, la URL firmada de 60 segundos para el editor y la comparación de diez páginas completas. **No se ha modificado ese archivo durante esta revisión.** `npm run test:block2` pasa.

## Importante: confirmado y dejado sin rediseñar

> **Seguimiento:** los puntos 1 a 6 se resuelven en `desarrollo/planta14-v2`. Ver [V2-INTEGRACION.md](V2-INTEGRACION.md). Siguen abiertas las carreras entre transacciones concurrentes.

1. **No hay atomicidad S3/PostgreSQL ni registro duradero de operaciones.** El diagnóstico opcional `CMS_BLOCK3_ORPHAN_PROBE=true` inyectó un fallo del hook de auditoría después de escribir S3: PostgreSQL revirtió la clave y quedaron **tres objetos públicos sin registro**. La sincronización no los identificó ni borró. Se limpiaron explícitamente solo esos objetos del bucket efímero de prueba. El diagnóstico termina con éxito cuando reproduce esta limitación; no es una certificación de seguridad. Hace falta un manifiesto/outbox duradero y reconciliación de inventario con reintentos. También permanece el riesgo de carreras entre transacciones concurrentes al actualizar el contador y las copias. La comprobación HEAD añadida verifica existencia, no integridad binaria ni inventario completo.
2. **Cambiar bucket o prefijo no migra ni limpia automáticamente el origen anterior.** `Media` solo almacena `publicKey`, no bucket/prefijo histórico e inventario de operaciones. No cambiar `PUBLIC_MEDIA_*` dando por hecho que el comando retirará las copias antiguas. Requiere un procedimiento explícito y conservar la ubicación de origen; no se ha añadido un esquema nuevo para ello.
3. **Retirada inmediata frente a caché:** sigue el valor de un año e `immutable`. Borrar el origen no retira copias en CDN/navegadores. Pablo debe decidir TTL y purga del proveedor; no se ha elegido CDN ni cambiado esa política. Una URL pública deja de ser un control de acceso revocable una vez descargada.
4. **Derechos municipales automáticos:** subir con cuenta municipal asigna titular institucional y ámbito publicable. Eso no verifica licencia/autorización ni solicita una declaración explícita. Decidir el circuito de derechos y responsabilidad; no se ha cambiado esa política del producto.
5. **Reversión destructiva del bloque:** `down` elimina retirada, avisos, auditoría y atribución municipal. Exige retirar las cuentas municipales, pero no exige resolver/exportar retiradas antes. Aunque el contenido quede como borrador, una futura reaplicación ya no conserva su interdicción anterior. Decidir bloqueo adicional o conservación de tombstones antes de permitir downgrade con datos reales; no se ha modificado ese contrato destructivo.
6. **Staging privado:** una copia servida por un bucket/CDN público no pasa por la contraseña de Caddy. Mantener desactivadas las copias públicas en un staging que deba ser privado, o decidir protección equivalente en el origen/CDN antes de activarlas. No se ha modificado infraestructura ni creado una excepción a su contraseña.

El aislamiento de la API autenticada no puede convertir en confidencial lo que la web publica anónimamente: un usuario puede cerrar sesión y leer publicaciones o URLs que ya sean públicas. Las restricciones nuevas impiden usar su sesión para acceder a datos o originales de otro ámbito.

## Resultado de comandos y límites

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:block2` y `npm run test:block3`: correctos. Lint conserva los 15 avisos previos de `<img>`, sin errores. Las pruebas usan únicamente los proyectos Compose desechables del bloque 2 (55433) y bloque 3 (55434), S3rver local y servidores HTTP de prueba, que se detienen al terminar.

No se han comprobado S3/IAM reales, políticas anónimas del bucket, CDN/purga, HTTPS público, entrega de correo ni recuperación de cuentas. S3rver no demuestra que las políticas de un proveedor real protejan el bucket privado. GraphQL no está expuesto y la futura activación requiere repetir la matriz con sus resolvers. El diagnóstico de huérfanos confirma un pendiente importante: que las suites terminen con código 0 no significa que haya atomicidad completa ni retirada garantizada de cachés.
