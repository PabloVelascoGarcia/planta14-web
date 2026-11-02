# Fase 1: Payload, PostgreSQL e imágenes

Esta guía corresponde a la rama de desarrollo v2. El CMS está **desactivado por defecto**. La web sigue usando los datos de demostración y mantiene `noindex`.

## Arranque local

Requisitos: Node `^22.23.4 || >=24.22.1`, Docker con motor Linux, npm. No utilices credenciales, base de datos ni bucket de producción.

1. `npm ci`
2. `docker compose -f compose.cms.yaml up -d postgres`
3. En otra terminal, `npm run cms:s3:local`. El emulador crea `planta14-development` y guarda objetos en `.local/s3`. Solo sirve para desarrollo.
4. Copia `.env.cms.example` a `.env.local`. Genera un `PAYLOAD_SECRET` aleatorio de al menos 32 caracteres. Cambia `CMS_ENABLED=true`.
5. `npm run cms:migrate`. La sincronización automática de esquema está desactivada (`push:false`); las migraciones están versionadas en `cms/migrations`.
6. Configura temporalmente `CMS_BOOTSTRAP_EMAIL` y una contraseña única de al menos 16 caracteres en `.env.local`; ejecuta `npm run cms:bootstrap`. El comando se niega a actuar si existen usuarios. Retira ambas variables al terminar.
7. `npm run dev` y abre `http://localhost:3000/cms`. Para compilación: `npm run build` y `npm start`.

El primer usuario no puede registrarse por una página pública ni por REST. El comando local autorizado evita ese acceso público mediante un contexto interno. Las cookies de la demo no son válidas en Payload. Las cargas admiten JPEG, PNG y WebP, hasta 10 MiB, con texto alternativo y crédito obligatorios. Se crean tamaños de 800 y 1600 píxeles. Las imágenes permanecen privadas y pasan por el control de acceso de Payload.

La base y los objetos persisten por separado: volumen Docker para PostgreSQL y `.local/s3` para el emulador. `docker compose -f compose.cms.yaml stop` detiene la base sin borrar su volumen. No uses `down -v` para conservar datos.

## Verificación reproducible

```powershell
npm run typecheck
npm run lint
npm test
npm run build
# Con la web iniciada en el puerto 3020 y CMS_ENABLED=false:
node tests/public-http.mjs
# Detén antes cms:s3:local para liberar el puerto 59000.
$env:CMS_INTEGRATION_LOCAL = 'true'
npm run test:cms:integration
```

La integración se limita a la URL exacta de la base de prueba de Compose; rechaza otras bases configuradas. Levanta un bucket temporal, crea cuentas e imágenes de prueba y las elimina al terminar. Ejecuta las migraciones, pero no borra las tablas ni las cuentas existentes. No la ejecutes en paralelo con otra prueba S3 ni contra recursos reales.

Para cambios de esquema: `npm run cms:migrate:create -- nombre`, revisar el SQL generado, `npm run cms:migrate`, `npm run cms:types` y `npm run cms -- generate:importmap`. No ejecutar migraciones de retroceso sobre datos reales sin respaldo y ensayo independiente.

## Conectar un S3 real más adelante

Configura bucket de desarrollo dedicado, región, endpoint si es compatible S3, clave limitada al bucket y secreto mediante el gestor de secretos del alojamiento. `S3_FORCE_PATH_STYLE=true` solo cuando el proveedor lo necesite. No publiques el bucket ni configures URLs que eludan los permisos de Payload. `CMS_SERVER_URL` debe ser el origen exacto de la aplicación; en producción se exige HTTPS, con excepción del loopback para pruebas locales. El endpoint S3 y PostgreSQL también deben usar cifrado y certificados verificados según el proveedor.

`CMS_ENABLED=true` exige todas las variables esenciales y un secreto suficientemente largo. Sin activación, `/cms` y `/api/cms/*` devuelven 404. Cambia el secreto si ha sido expuesto; no lo subas a Git ni compartas `.env.local`.

## Copias y restauración

El código, PostgreSQL y S3 requieren copias distintas. Un commit no incluye registros ni objetos. Antes de habilitar un entorno real: programar `pg_dump` con retención y cifrado; activar versionado/retención y réplica o copia independiente de objetos; conservar configuración del proveedor y secretos en un gestor seguro. Ensayar `pg_restore` sobre otra base y restaurar originales y variantes del bucket. Verificar cuentas, permisos y archivos mediante la aplicación. No restaurar encima de producción como prueba.

Revisar [la auditoría](V2-AUDITORIA-2026-11-02.md) para pruebas ejecutadas, riesgos de dependencias y pendientes de Netlify. No desplegar esta rama ni conectar datos de producción como parte del arranque local.
