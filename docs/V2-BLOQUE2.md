# Planta 14 v2 — bloque 2

Base: `origin/desarrollo/planta14-v2-fase1`, commit `0238c508211c23e950948bbed8ba76292bb328d5`. Rama de trabajo: `desarrollo/planta14-v2-bloque2`. No se modifica la rama de infraestructura paralela. No hay PR, despliegue ni contratación de servicios.

## Cambios

`Users` admite `admin` y `editor`. Las cuentas nuevas tienen por defecto `editor`; solo un administrador puede gestionar usuarios, sus roles y la configuración de secciones, concejos y espacios municipales. El editor puede crear, revisar, publicar y borrar noticias, autores, contenidos municipales y archivos. La cookie de autenticación se configura expresamente con `secure:true` cuando `NODE_ENV=production` (Payload serializa el atributo como `Secure=true`). El primer administrador sigue creándose mediante el comando local de bootstrap.

Los modelos nuevos conservan los contratos de presentación:

| Colección | Campos principales |
| --- | --- |
| `articles` | slug, título, entradilla, párrafos, imagen, autor, concejo, sección, fecha, publicación/programación, SEO, destacados y procedencia |
| `authors` | nombre, slug, cargo, biografía, correo restringido y relación de avatar |
| `sections` | slug, nombre y orden de navegación |
| `towns` | clave anterior, slug, nombre, comarca, visibilidad y procedencia |
| `municipal-spaces` | clave anterior, concejo, nombre, medio, estado y fechas de suscripción, contacto y procedencia |
| `municipal-content` | espacio, tipo (noticia, aviso, evento, ayuda, tablón), título, entradilla, cuerpo, origen, fechas/plazos, lugar, adjuntos, imagen y marca demo |

Noticias, espacios y contenidos municipales tienen versiones y borradores de Payload. El acceso público filtra `_status=published`; el adaptador nunca usa acceso privilegiado. En Payload no se publica automáticamente por `scheduledAt`: el campo se conserva para un bloque posterior de programación.

`lib/payload-content.ts` convierte relaciones y datos de Payload al formato que usan las páginas. La web conserva componentes y estilos. Las identidades visuales, escudos y panoramas locales permanecen como recursos estáticos existentes, con su información de licencia previa; no se transfieren al bucket ni se importan al CMS. Las imágenes editoriales sin relación publicable usan un marcador SVG propio. La biblioteca de autores aún no entrega avatares públicos mediante el adaptador.

## Selección de fuente

```dotenv
CONTENT_SOURCE=demo
```

Es el valor por defecto, incluso con el CMS activado. Conserva la selección de demostración anterior. `CMS_DEMO_DATA_DIR`, opcional, permite cargar noticias/autores de una carpeta de fixtures local sin modificar los datos originales; se utiliza en las pruebas de equivalencia.

Para leer contenido de Payload:

```dotenv
CMS_ENABLED=true
CONTENT_SOURCE=payload
```

Se necesitan las variables PostgreSQL/S3 de la fase 1. Si falta configuración o falla Payload, se devuelve el error: **no hay sustitución silenciosa por contenido de demo**. La edición se realiza en `/cms`; las escrituras del panel antiguo no se conectan al backend nuevo. El panel municipal anterior continúa siendo una simulación local, claramente identificada.

El frontend se sirve dinámicamente para que la retirada de publicaciones tenga efecto sin esperar a la antigua caché de cinco minutos. La selección de datos se hace en servidor y no se expone como variable pública. El diseño no cambia; sí cambia la estrategia de caché, que deberá optimizarse con invalidación explícita en un bloque posterior.

Los artículos de magazine en `/niebla/*`, incluidos los basados en Agenda Pública, siguen disponibles solo con fuente demo. En modo Payload devuelven 404 y `/niebla` muestra un anuncio sin esas fotografías ni textos. No se han migrado esos contenidos.

## Derechos y entrega de imágenes

`Media` añade titular (`rightsHolder`), tipo (`propia`, `licencia`, `autorización`, `institucional`) y ámbito (`demo`, `publicable`). El hook exige titular y tipo al crear/modificar un archivo. Las columnas de titular/tipo admiten nulos para no inventar derechos en archivos anteriores; estos quedan pendientes de revisión y no se pueden publicar. El ámbito inicial es `demo`.

Publicar una noticia o contenido municipal con una imagen sin derechos completos y ámbito `publicable` devuelve error. También se valida la imagen SEO. No se pueden retirar derechos ni borrar una imagen mientras esté vinculada a una publicación. Al retirarse o desvincularse el contenido, el acceso público al archivo deja de concederse. La lectura pública de la biblioteca se limita a imágenes publicables enlazadas a contenido publicado; no se hace público el bucket completo.

> **Actualizado en el bloque 3** ([V2-BLOQUE3.md](V2-BLOQUE3.md)): la web pública usa copias públicas en `PUBLIC_MEDIA_BASE_URL`; las URL firmadas quedan solo para paneles autenticados y `readMedia` usa el campo indexado `publishedUses`.

**Opción elegida: URLs S3 firmadas de 60 segundos.** Se conserva el control de acceso de Payload. `/api/cms/media/file/...` comprueba el permiso y devuelve `302` al objeto firmado; los bytes se descargan directamente de S3. La respuesta de la API lleva `Cache-Control: private, no-store`. No se utiliza `disablePayloadAccessControl`. Se prueban originales y variantes mediante el adaptador oficial.

Una URL ya emitida es una capacidad temporal: puede seguir funcionando hasta esos 60 segundos tras retirar una publicación. No se promete revocación instantánea de enlaces emitidos ni de copias ya descargadas. En el proveedor definitivo, configurar caché de objetos/CDN compatible con este límite y evitar registrar URLs firmadas. Un CDN privado futuro debe validar firmas y mantener el bucket privado; no basta con cambiar un hostname dentro de la firma S3. No se ha creado ni configurado ningún CDN.

## Importación municipal

```powershell
# En el entorno de desarrollo configurado según V2-FASE1.md:
npm run cms:migrate
$env:IMPORT_MUNICIPAL_DEMO = 'true'
npm run cms:import:municipal
```

El comando exige CMS activado, consentimiento explícito mediante esa variable y un entorno distinto de producción. Importa seis concejos del Caudal, sus espacios, etiquetas de sección y las fichas municipales de demostración/referencia. No importa noticias editoriales, autores, archivos, fotos, magazine, La Voz de Asturias ni Agenda Pública.

La procedencia se restringe a tres archivos concretos versionados: `territories.json`, `municipal-spaces.json`, `municipal-content.json`. Sus hashes canónicos están fijados tras revisar el conjunto. Para fichas con referencia se admite únicamente la lista explícita de dominios municipales/turísticos conocidos; sin referencia se exige la marca demo del archivo revisado. Cualquier cambio del conjunto obliga a revisar procedencia y hashes antes de importarlo. No se siguen enlaces, se descargan textos ni se incorporan imágenes. Cada registro guarda `planta14-municipal-demo-reviewed-2026-11-02` como procedencia.

Las claves únicas (`slug`, `legacyID`, relación única concejo/espacio) impiden duplicados. Si un registro existe, se conserva sin sobrescribir las modificaciones editoriales. Repetir el comando no crea nuevas versiones ni cambia el número de registros. No usar la base de demostración como base editorial de producción.

## Migración

`20261102_094653_bloque2` añade modelos, versiones, derechos y rol editor. La ampliación del enum de roles usa reemplazo de tipo para funcionar dentro de una transacción PostgreSQL. Se ha probado la migración desde fase 1, la reversión y su reaplicación con PostgreSQL real.

La reversión borra las colecciones y versiones del bloque 2, incluidos sus contenidos. Antes de revertir una base con datos, respaldar y ensayar la restauración. Si existen cuentas editor, la reversión **se detiene antes de cambiar nada**: hay que retirarlas mediante un procedimiento explícito previo. Nunca se promueven automáticamente a administradores. Los administradores y archivos de fase 1 se conservan; las columnas nuevas de derechos se eliminan al volver al esquema anterior.

## Pruebas y resultados

```powershell
npm test
npm run typecheck
npm run lint
npm run build
docker compose -f compose.bloque2-test.yaml up -d --wait
$env:CMS_BLOCK2_TEST = 'true'
npm run test:block2
docker compose -f compose.bloque2-test.yaml stop
```

Los cuatro comandos npm requeridos pasan. Lint conserva los 15 avisos previos de `<img>`, sin errores. La integración también pasa:

| Criterio | Test automático |
| --- | --- |
| Misma presentación con los mismos datos | Comparación del cuerpo HTML completo, cabecera/contenido/pie, en portada, edición, seis concejos, agenda y noticia. Datos editoriales originales de prueba, sin copiar fuentes excluidas; solo se eliminan scripts de hidratación y comentarios técnicos al comparar. |
| Borradores no públicos | REST de noticia y ficha municipal devuelve 404; página de noticia borrador devuelve 404 por HTTP. Se prueba también retirar una publicación existente. |
| Importación idempotente | Dos ejecuciones; recuentos idénticos de todas las colecciones, seis concejos y seis espacios. |
| Editor sin gestión de usuarios/configuración | Crear, editar y borrar usuarios: 403. Elevar su propio rol: 403. Modificar sección o concejo: 403. Puede publicar noticia y aviso municipal. |
| Cookie Secure en producción | Login REST real con `NODE_ENV=production`; comprobación de `Set-Cookie`, sin guardar el token en archivos. |
| Migración reversible | `up`, protección de `down` con editores, `down` tras retirar editor y nuevo `up` en transacciones reales; administrador previo conservado. |
| Importación sin fuentes excluidas | Verificación de hashes, lista de fuentes, procedencia por registro y ausencia de La Voz/Agenda Pública; noticias/autores/media permanecen vacíos tras importar. |
| Derechos y descarga sin proxy de bytes | Rechazo de imagen sin derechos o demo al publicar; lectura pública solo al enlazar; 302 firmado, descarga directa S3, retirada y protección frente a borrado. |

La integración utiliza otra instancia PostgreSQL efímera, puerto **55433**, proyecto Compose `planta14-bloque2-test`, sin volumen persistente, y S3rver en **59002**. Reinicia exclusivamente el esquema de `planta14_bloque2_test` en esa instancia; rechaza URLs de otra base. Los servidores HTTP de prueba usan 3040/3041 y se cierran automáticamente. No comparte la base 55432 de la fase 1 ni servicios de la rama de infraestructura.

Limitaciones verificables: S3 probado con emulador local, no contra proveedor real; Secure comprobado en la respuesta HTTP, no en un dominio HTTPS público. No se han probado CDN, TLS, IAM ni Netlify y no se ha desplegado nada. Siguen pendientes el correo real, permisos por ayuntamiento, planificación de publicaciones y el editor municipal definitivo. Los avisos transitivos de dependencias documentados en fase 1 no se resuelven en este bloque.

Fuentes y APIs contrastadas: [cookies de Payload](https://payloadcms.com/docs/authentication/cookies), [adaptadores de almacenamiento y descargas firmadas](https://payloadcms.com/docs/upload/storage-adapters); comportamiento de descarga comprobado además en el código instalado de `@payloadcms/storage-s3` 3.92.1. Las convenciones Next.js se contrastaron con la documentación incluida en `node_modules/next/dist/docs`.
