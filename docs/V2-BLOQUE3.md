# Planta 14 v2: bloque 3

Base: `origin/desarrollo/planta14-v2-bloque2`, commit `4ca4f84`. Rama: `desarrollo/planta14-v2-bloque3`. No se han tocado `desarrollo/planta14-v2-infra`, `main`, `mejora/presentacion-la-voz` ni las ramas de respaldo. Sin PR, sin despliegues, sin servicios contratados y sin secretos en el repositorio. Commits con `[skip netlify]`.

Revisión posterior: [V2-BLOQUE3-REVISION.md](V2-BLOQUE3-REVISION.md). Actualiza el aislamiento y la restauración de versiones, recomienda un bucket público separado y documenta un límite importante confirmado: la reconciliación no identifica objetos huérfanos que hayan perdido su registro al revertirse una transacción SQL.

## Parte 1. Correcciones de la revisión del bloque 2

### Imágenes públicas: copia pública con caché larga

**Decisión.** El bucket de Payload sigue siendo privado. Cuando una imagen con derechos publicables (`rightsScope=publicable`, titular y tipo) se usa en una noticia o un contenido municipal **publicado**, se copia (original y variantes `card` y `hero`) a una ubicación pública:

```
<PUBLIC_MEDIA_BUCKET>/<PUBLIC_MEDIA_PREFIX>/<uuid aleatorio>/<archivo>
```

y la web pública la enlaza como `PUBLIC_MEDIA_BASE_URL/<prefijo>/<uuid>/<archivo>`. Los objetos se escriben con `Cache-Control: public, max-age=31536000, immutable` (configurable con `PUBLIC_MEDIA_CACHE_CONTROL`).

- **Sin depender del proveedor.** Solo usa operaciones S3 estándar (`GetObject`, `PutObject`, `DeleteObjects`), sin ACL ni API propias. Sirven las dos variantes:
  - **Recomendado: bucket público aparte** (`PUBLIC_MEDIA_BUCKET=<bucket>`). Mantener `S3_BUCKET` privado y limitar las credenciales de la aplicación a las operaciones necesarias en los dos buckets. La plantilla local propone `planta14-development-public`.
  - **Compatibilidad, no recomendado: prefijo en el mismo bucket** (`PUBLIC_MEDIA_BUCKET` vacío). Una política mal configurada podría exponer también los originales. No conceder nunca lectura anónima al bucket privado completo; comprobar la política real con peticiones sin credenciales. La compatibilidad se conserva, pero no se elige para un despliegue real.
  - `PUBLIC_MEDIA_BASE_URL` apunta a la raíz del bucket público o al CDN que lo tiene como origen. En producción se exige HTTPS.
- **Retirada.** Al despublicar, retirar, borrar o desvincular el contenido, los hooks recalculan el uso y, si ya no queda ninguno publicado, **borran la copia pública**. Una nueva publicación genera otro UUID, así que una URL antigua no vuelve a servir la imagen desde el origen y la caché puede ser inmutable. Lo que ya esté en la caché de un CDN o en los navegadores puede seguir sirviéndose hasta que caduque o se purgue: con un CDN real hay que purgar la ruta al retirar (pendiente de elegir proveedor) o reducir `PUBLIC_MEDIA_CACHE_CONTROL`.
- **URL firmadas solo en el panel autenticado.** `/api/cms/media/file/...` deniega el acceso anónimo (la función de acceso recibe `isReadingStaticFile`). Editores, administradores y cada ayuntamiento (con sus propias imágenes) siguen recibiendo la redirección firmada de 60 s. La API conserva `Cache-Control: private, no-store`, que ya no afecta a la web pública porque las imágenes públicas no pasan por la aplicación.
- **Sin `PUBLIC_MEDIA_BASE_URL`** no se crean copias públicas y la web muestra el marcador (`/images/placeholder.svg`), como hasta ahora con las imágenes sin derechos.
- Las escrituras S3 no forman parte de la transacción PostgreSQL. `npm run cms:media:sync-public` recalcula usos, crea/borra copias **registradas** y comprueba que existan el original y las variantes. No es una reconciliación completa del inventario: una reversión SQL puede dejar objetos sin clave registrada. No cambiar bucket/prefijo como si el comando migrase las copias antiguas automáticamente; conservar un inventario del origen. Ver el informe de revisión para el diseño pendiente de operaciones duraderas.

### `readMedia` sin recorrer el contenido

`Media` tiene un campo **indexado** `publishedUses` (índice `media_published_uses_idx`) con el número de documentos publicados que usan la imagen. La lectura anónima es un filtro fijo, sin consultas previas:

```ts
{ and: [{ publishedUses: { greater_than: 0 } }, { rightsScope: { equals: 'publicable' } }] }
```

Los hooks `afterChange` y `afterDelete` de noticias y contenidos municipales recalculan solo las imágenes afectadas (las de antes y las de después del cambio), con `count` sobre columnas de relación indexadas (`image_id`, `seo_image_id`) y `_status`. El recuento usa el documento vigente, no los borradores guardados encima. Las protecciones del bloque 2 (no retirar derechos ni borrar una imagen en uso) usan ahora ese campo en lugar de recorrer todo el contenido. La migración rellena `publishedUses` con los datos existentes.

## Parte 2. Cuentas municipales

Decisión de Pablo: el ayuntamiento publica directamente y Planta 14 puede retirar lo publicado.

| Regla | Implementación |
|---|---|
| Rol `municipal` vinculado a un único espacio | `users.role` admite `municipal`; `municipalSpace` es obligatorio para ese rol y está prohibido para los demás (hook `beforeChange`, error 400). Rol y espacio solo los asigna un administrador (acceso por campo y `create: adminOnly`). |
| Solo su espacio | La sesión municipal solo lee su propio espacio y contenido, incluidos borradores y publicados; no obtiene los publicados de otro ayuntamiento por la API autenticada. Las versiones se limitan a su espacio y una restauración comprueba también el propietario de la versión histórica. Crear/editar/publicar/despublicar solo en su espacio. El hook impone `space`, `origin=municipality`, `demo=false` y procedencia `municipal-account`, e impide cambiar de espacio. **No puede borrar**: despublica. La web anónima sigue mostrando el contenido publicado: no equivale a confidencialidad entre contenidos ya públicos. |
| Imágenes | Puede subirlas; el hook fija titular = nombre de su ayuntamiento, tipo `institucional`, ámbito `publicable` y `uploadedBySpace`. La API autenticada solo permite ver, editar, usar y descargar originales de su propio espacio; tampoco entrega originales de Planta 14 ni de otro ayuntamiento aunque tengan copia pública. La afirmación automática de derechos queda como decisión de producto pendiente, no como verificación documental. |
| Sin acceso a lo demás | Noticias y versiones de Planta 14, autores, secciones, concejos, usuarios (salvo su propia cuenta), avisos y auditoría: 403. Tampoco entra en `/cms` (`access.admin` solo para editores y administradores). |
| Publicación inmediata y marcada | El frontend es dinámico: lo publicado aparece en la siguiente petición. Las fichas muestran «Publicado por el ayuntamiento» (las de demo siguen mostrando «Ejemplo» o «Referencia»). |
| Aviso para Planta 14 | Cada paso a publicado hecho por una cuenta municipal crea un registro en `notifications` (contenido, espacio, autor, `emailStatus`). Lo ven editores y administradores, que solo pueden marcarlo como revisado. El correo está preparado (`MUNICIPAL_NOTICE_EMAIL_ENABLED`, `MUNICIPAL_NOTICE_EMAIL_TO`, `payload.sendEmail`) pero **desactivado**: queda `emailStatus=disabled`. Al contratar correo hay que configurar el adaptador de Payload y activar las variables. |
| Retirada | Un editor o administrador marca `withdrawal.withdrawn` con un motivo obligatorio. El hook lo pasa a no publicado, registra fecha y autor, y aplica la retirada al documento vigente aunque se use «guardar borrador». El ayuntamiento ve el motivo en su panel y **no puede volver a publicarlo**. Un editor puede restablecerlo (desmarcar la retirada) y después publicarlo de nuevo. |
| Auditoría | `audit-log`, inmutable para todos por la API: acción (`create`, `update`, `publish`, `unpublish`, `withdraw`, `reinstate`, `delete`), colección, documento, título, espacio, usuario, más una copia de su correo y su rol (para que sobreviva al borrado de la cuenta) y el motivo. Cubre noticias, contenidos municipales e imágenes. Para distinguir publicar de guardar un borrador se compara el estado vigente en la base antes y después del cambio. |

### Panel `/[municipality]/panel`

- `CONTENT_SOURCE=demo`: la simulación anterior, sin cambios (mismo componente, título y textos).
- `CONTENT_SOURCE=payload`: panel real. Sin sesión muestra el inicio de sesión (REST de Payload, cookie `HttpOnly`). Con una cuenta municipal de **ese** espacio muestra el formulario (tipo, título, resumen, texto, fechas, lugar, imagen con autoría), «Publicar ahora», «Guardar como borrador» y la lista de sus publicaciones con su estado («Borrador», «Publicado», «Publicado · cambios sin publicar», «Retirado por Planta 14» con el motivo), más las acciones editar, publicar y despublicar. Una cuenta de otro ayuntamiento o de Planta 14 ve un aviso sin datos. Todas las lecturas del servidor usan la cuenta con `overrideAccess:false`, y el navegador escribe solo por la API REST, con el mismo control de acceso.
- La cookie se acepta solo en peticiones del mismo origen (`csrf` de Payload; sin `Origin`, se exige `Sec-Fetch-Site`). El test comprueba que una petición de otro sitio no reutiliza la sesión.
- Diseño: se reutilizan las clases y la estructura del panel de demostración. Solo se añade el estilo del `<select>`.

## Migración `20261102_105932_bloque3`

Añade el rol `municipal` (reemplazando el tipo enum dentro de la transacción, igual que en el bloque 2), `users.municipal_space_id`, `media.uploaded_by_space_id`, `published_uses` (indexado), `public_key`, la retirada en `municipal_content` y en sus versiones, y las tablas `notifications` y `audit_log`. Rellena `published_uses`.

La reversión **se detiene sin cambiar nada si existen cuentas municipales** (no se convierten en editores). Si no las hay, borra avisos y auditoría (respáldalos antes), la retirada y la atribución de imágenes. La reversión generada por Drizzle intentaba borrar dos restricciones que ya había eliminado `DROP TABLE ... CASCADE`; se ha corregido con `IF EXISTS`.

Tras aplicarla en una base con datos:

```powershell
npm run cms:migrate
npm run cms:media:sync-public
```

## Configuración nueva

```dotenv
PUBLIC_MEDIA_BASE_URL=          # https://cdn.example.org (raíz del bucket público)
PUBLIC_MEDIA_BUCKET=planta14-development-public  # recomendado: separado de S3_BUCKET
PUBLIC_MEDIA_PREFIX=public
PUBLIC_MEDIA_CACHE_CONTROL="public, max-age=31536000, immutable"
MUNICIPAL_NOTICE_EMAIL_ENABLED=false
MUNICIPAL_NOTICE_EMAIL_TO=
```

Dependencia nueva explícita: `@aws-sdk/client-s3` 3.1161.0, que ya se instalaba como dependencia de `@payloadcms/storage-s3`. En el lock solo cambia la declaración.

## Pruebas

```powershell
npm test
npm run typecheck
npm run lint
npm run build
docker compose -f compose.bloque2-test.yaml up -d --wait
$env:CMS_BLOCK2_TEST = 'true'; npm run test:block2
docker compose -f compose.bloque3-test.yaml up -d --wait
$env:CMS_BLOCK3_TEST = 'true'; npm run test:block3
```

`test:block3` usa su propia base desechable (puerto **55434**, proyecto `planta14-bloque3-test`, en `tmpfs`), S3rver en **59004** con un bucket privado y otro público, y la web en **3051**. Se niega a usar otra base.

| Criterio | Test automático (`scripts/block3-integration.mjs`) |
|---|---|
| Lena no lee borradores, edita, publica ni borra contenido de Mieres (API y panel) | Lectura por id con y sin `draft`, listado y versiones; PATCH de contenido, de publicación y de despublicación; DELETE; creación en el espacio ajeno; mover su contenido a Mieres. Por HTTP, `/mieres/panel` con la sesión de Lena no muestra datos de Mieres. |
| Sin acceso a noticias de Planta 14, usuarios, secciones, concejos | GET y escritura de `articles`, `articles/versions`, `sections`, `towns`, `authors`, `notifications`, `audit-log`, `municipal-spaces` y otro usuario: 403/404. `users` solo devuelve su cuenta. `canAccessAdmin` no es verdadero. |
| Publicación inmediata en su página pública | Publica por REST y `/lena` la muestra en la siguiente petición, con «Publicado por el ayuntamiento». |
| Retirada: fuera de la web, motivo visible, auditada | El motivo es obligatorio; la retirada funciona incluso con `?draft=true`; desaparece de `/lena` y de la API pública; el ayuntamiento lee el motivo por la API y en `/lena/panel`; no puede volver a publicar; `audit-log` registra `withdraw` con el motivo y el editor. |
| Un aviso por publicación municipal | Tres publicaciones municipales generan tres avisos con `emailStatus=disabled`; una publicación de un editor no genera aviso; los avisos no se crean por la API; la auditoría no se edita ni se borra. |
| Imagen publicable servida desde la URL pública con caché larga; borradores y demo, no; al despublicar, deja de serlo | Copia en el bucket público con `Cache-Control: public, max-age=31536000, immutable`, variantes incluidas; `publicURL` en la API anónima; la página de la noticia usa esa URL y nunca `/api/cms/media/file`; ruta firmada denegada a anónimos y 302 de 60 s para el editor; las imágenes de borradores y las de ámbito demo no son públicas; al despublicar, la URL pública da 404 y al republicar cambia la clave. |
| La lectura pública ya no recorre el contenido | `readMedia` anónimo devuelve el filtro sobre `publishedUses` con un `payload` que falla ante cualquier consulta; el índice existe en PostgreSQL. |
| Demo sin cambios | `npm run test:block2` pasa (HTML idéntico demo/Payload en diez páginas). |
| Migraciones aplican y se deshacen | `up`, reversión bloqueada con cuentas municipales, `down` tras retirarlas, `up` de nuevo con el relleno de `publishedUses`. |
| `npm test`, typecheck, lint, build | `tests/cms.test.mjs` añade pruebas unitarias de los accesos municipales. Lint mantiene los 15 avisos previos de `<img>`, sin errores. |

**Cambios en `test:block2`**, porque este bloque cambia a propósito dos comportamientos que comprobaba:

1. La descarga firmada se comprueba ahora con la sesión del editor, y se añade la comprobación de que un anónimo ya no la obtiene.
2. La prueba de reversión del bloque 2 revierte antes el bloque 3 y lo vuelve a aplicar al final.

El resto del test, incluida la comparación HTML demo/Payload, no cambia.

## Limitaciones y pendientes

- S3 y el bucket público se han probado con S3rver, no con un proveedor real. No hay CDN: falta elegir proveedor, configurar el origen (solo `public/*` o el bucket público) y la purga al retirar.
- No hay proveedor de correo: el aviso por email está desactivado. La recuperación de contraseña de las cuentas municipales sigue pendiente; las crea y restablece un administrador.
- El panel muestra el formulario y la lista; no tiene vista previa ni adjuntos PDF (el modelo admite `attachments`, que el panel no edita).
- La auditoría registra quién, qué, cuándo y la acción, no un diff campo a campo (las versiones de Payload guardan el contenido de cada versión).
- No se ha probado en navegador real ni con HTTPS público; las pruebas HTTP usan `next start` en local.
