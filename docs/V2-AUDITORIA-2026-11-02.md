# Planta 14 v2: auditoría de partida

Fecha: 2 de noviembre de 2026. Base de trabajo: `0127e1c3f9664b9f7b7964e4426f0f1dec2690ff`.

## Respaldo y aislamiento

- Consultadas las referencias remotas: `mejora/presentacion-la-voz` y `respaldo/estado-2026-11-02` apuntan exactamente a la base indicada.
- `main` apunta a `05b6b4bf982f77166a95540f1c34bbbbbcd9cbd1`. La rama avanzada tiene 22 commits adicionales.
- Copia de trabajo independiente en `planta14-v2`, rama `desarrollo/planta14-v2-fase1`. La carpeta original `planta14-demo` permanece intacta.
- Creado `../planta14-respaldo-2026-11-02.bundle` con historial completo y verificación Git correcta. No incluye archivos ignorados, secretos ni datos de servicios externos. Para recuperar: `git clone planta14-respaldo-2026-11-02.bundle planta14-recuperada`.
- No se han modificado `main`, la rama de demo ni la rama de respaldo. Los commits de desarrollo llevan `[skip netlify]` para evitar builds automáticos de Netlify.

## Netlify y datos externos

- GitHub devuelve estado `success` para `netlify/planta14/deploy-preview` del commit base, con destino `https://deploy-preview-1--planta14.netlify.app`.
- No existe `netlify.toml` ni enlace `.netlify` en esta copia. No se detectaron nombres de variables de credenciales Netlify/S3/PostgreSQL en el entorno del agente ni configuración local de Netlify en las ubicaciones revisadas.
- La búsqueda de conexiones no encontró un plugin de Netlify. El navegador disponible muestra la pantalla de inicio de sesión de `app.netlify.com`.
- Por tanto **no está certificado el respaldo operativo de Netlify**. Pendientes: configuración de build, rama de producción y branch deploys, contextos y variables, dominio/DNS, funciones, Forms, Blobs y posibles integraciones. No se han cambiado esas opciones ni disparado despliegues manuales.
- `lib/cms.ts` usa archivos locales `data/articles.json` y `data/authors.json`; `public/uploads` también es local. Están ignorados por Git y no quedan incluidos en el respaldo remoto. La producción y la demo bloquean las escrituras actuales. No se presupone que Netlify conserve esos archivos.
- Los contenidos de demostración municipales están versionados en `lib/demo/data`. El panel municipal guarda simulaciones únicamente en el navegador (`localStorage`), no en un servidor. No se han recogido ni migrado datos de navegadores ajenos.
- Hay imágenes y fuentes enlazadas desde servidores externos. `node scripts/audit-content.mjs` enumera los dominios sin descargar contenido. Un enlace no constituye una copia de seguridad. No se han importado imágenes o contenidos de demo al CMS real.

## Arquitectura de este bloque

Payload está integrado en la misma aplicación Next.js, con `/cms` y `/api/cms`, usuarios propios y biblioteca privada de imágenes S3. PostgreSQL persiste los registros. El acceso anterior de `/admin` sigue perteneciendo a la demo y no concede acceso al nuevo CMS.

El frontend se ha trasladado a un grupo de rutas `(frontend)` conservando el contenido de sus archivos y sus URLs públicas. `robots.ts` se conserva en la raíz para mantener `/robots.txt`. Componentes, estilos, datos, contratos `Article`/`Author` y funciones de `lib/cms.ts` permanecen iguales. Este bloque **no conecta todavía las noticias ni los espacios municipales a Payload**: corresponde al siguiente bloque, con adaptadores y migración explícita.

## Pruebas realizadas

- Generación de tipos e import map de Payload; TypeScript correcto.
- HTTP local: portada, seis concejos, panel municipal, robots y sitemap correctos; `noindex` conservado; CMS desactivado devuelve 404 y API anterior sin sesión devuelve 401. Panel Payload activo accesible y colecciones privadas devuelven 403 sin autenticación.
- Compilación de producción con Webpack correcta. Turbopack quedó detenido en compilación; `npm run build` utiliza Webpack de forma explícita.
- Pruebas existentes de sesión y proxy, más configuración y permisos del CMS.
- Integración con PostgreSQL 17.6 real en Docker y S3rver local: migraciones, bloqueo de primer registro público, login por REST, rechazo anónimo, subida y lectura de original y dos variantes, descarga privada mediante Payload y borrado de objetos.
- `pg_dump` de la base local y `pg_restore` en `planta14_restore_fase1`: las dos migraciones se recuperaron. El dump de prueba queda en `.local/backups`, excluido de Git. No acredita la restauración de datos de producción.
- El registro de MinIO no estuvo accesible. S3rver es un emulador de pruebas; queda pendiente certificar el proveedor S3 definitivo (IAM, TLS, región, cuotas, backups y CDN).

## Dependencias y límites de salida

Next.js actualizado de 16.3.8 a 16.4.3, Sharp a 0.35.5 y override de DOMPurify a 3.4.17, tras revisar la auditoría. Payload y sus adaptadores usan 3.92.1. No se ha aplicado `audit fix --force`.

Auditoría final de producción: **13 avisos (8 bajos, 5 moderados), sin altos ni críticos**. Árbol completo de desarrollo: **33 avisos (8 bajos, 22 moderados, 3 altos), sin críticos**. Los altos restantes afectan al emulador S3rver y sus dependencias Busboy/Dicer; solo se usa en pruebas locales, ligado a `127.0.0.1`, y no debe desplegarse. Persisten avisos de dependencias transitivas de Payload y herramientas de desarrollo. Revisarlos antes de una salida pública; este bloque no certifica seguridad de producción.

No hay proveedor de correo: recuperación de contraseñas y entrega de emails reales pendientes. Solo se habilitan administradores. Roles editoriales, permisos por ayuntamiento, auditoría editorial, publicación programada y migración de noticias/autores/territorios quedan para bloques posteriores. No se han contratado servicios ni desplegado producción.
