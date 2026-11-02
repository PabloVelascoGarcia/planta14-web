# Configuración de Netlify (demo)

Configuración del proyecto en Netlify **leída por Pablo en el panel el 2 de noviembre de 2026** y transcrita aquí. Desde el entorno de desarrollo no hay acceso al panel de Netlify, así que estos datos no se han podido comprobar por otra vía. El repositorio no tiene `netlify.toml`: toda la configuración está en el panel. Si se cambia algo allí, hay que actualizar este documento.

Netlify solo aloja la **demo**. La producción futura irá en un servidor virtual de IONOS (ver [INFRA-STAGING.md](INFRA-STAGING.md)).

## Proyecto

| Ajuste | Valor |
|---|---|
| Proyecto | `planta14` |
| Equipo | B11 |
| Rama de producción | `main` (commit desplegado: `05b6b4b`) |
| Ramas que se despliegan | Solo `main` (sin *branch deploys* de otras ramas) |
| Previsualizaciones de PR | Activadas |

## Build

| Ajuste | Valor |
|---|---|
| Orden de build | `npm run build` (en el repo: `next build --webpack`) |
| Directorio de publicación | `.next` |
| Plugin | `@netlify/plugin-nextjs` v5 |
| Node | 22 |
| Región de las funciones | `us-east-2` (Ohio, EE. UU.) |

## Lo que NO está configurado

- Variables de entorno: ninguna.
- Dominio propio: ninguno (solo el subdominio `*.netlify.app`).
- Netlify Forms: no.
- Build hooks: no.
- Netlify Blobs: no.

## Acceso

- Producción y previsualizaciones son **públicas**, sin contraseña ni protección de acceso.
- La demo publicada en `https://deploy-preview-1--planta14.netlify.app` sale del commit `0127e1c` (base de la auditoría, rama `mejora/presentacion-la-voz`).

## Consecuencias para el trabajo v2

- Al no haber variables de entorno, el CMS (`CMS_ENABLED`) está desactivado en Netlify: `/cms` y `/api/cms/*` devuelven 404. Así debe seguir; la demo no debe conectarse a PostgreSQL ni a S3 reales.
- `next.config.mjs` usa las variables que pone Netlify (`CONTEXT`, `DEPLOY_PRIME_URL`, `URL`) para fijar `SITE_URL`. Fuera de Netlify, `SITE_URL` se define a mano (en staging lo pone `infra/compose.staging.yaml`).
- Como las previsualizaciones de PR están activadas y son públicas, **abrir un PR publica esa rama** en una URL pública. Los commits de desarrollo llevan `[skip netlify]`, pero eso no sustituye a decidir si se quiere previsualizar cada PR.
- Las funciones corren en EE. UU. (`us-east-2`). Hoy no tratan datos personales; si la demo llegara a tratarlos, habría que revisarlo desde el punto de vista del RGPD o moverlo al servidor europeo.
- No hay contraseña en las previsualizaciones: no se debe publicar contenido que no pueda ser público.
- Sin Forms ni Blobs no hay datos guardados en Netlify que haya que respaldar. El respaldo de Netlify se reduce a esta configuración y al código en Git.

## Pendiente de comprobar (no visible en el resumen)

- Encabezados y redirecciones definidos en el panel, si los hay.
- Notificaciones de despliegue y miembros del equipo B11 con acceso.
- Política de retención de despliegues antiguos.
