# Demo comercial del Caudal

Base: `7832807`, rama `mejora/presentacion-la-voz`. No cambia main, el dominio ni la infraestructura. No instala Payload ni una base de datos. El plan de producción queda en `PLAN-PRODUCCION-APLAZADO.md`.

## Recorrido de presentación

Portada → `/lena` → abrir un titular municipal → Avisos → Agenda → Ayudas → Contacto → Probar el panel. El mismo recorrido existe en `/mieres`, `/aller`, `/morcin`, `/riosa`, `/ribera-de-arriba` y sus rutas `/panel`.

El formulario permite escribir aviso o evento, revisar la tarjeta y simular su publicación. El dato queda en localStorage del navegador, aislado por concejo; no se envía a servidor ni se comparte con otros dispositivos. El botón «Borrar mis publicaciones de prueba» restablece el espacio. Navegación privada o restricciones de almacenamiento pueden impedir guardar; se muestra un mensaje y se conserva la vista previa.

Los escudos son marcadores declarados, no emblemas inventados. Solo sustituir por archivos de Wikimedia Commons tras comprobar licencia y conservar atribución. Las publicaciones municipales son ejemplos, no avisos ni convocatorias reales. Las siete noticias y sus imágenes existentes se conservan; la portada prioriza el Caudal y retiene las demás como archivo accesible. Todas las firmas son Redacción Planta 14. La demo fuerza noindex, robots bloqueado y sitemap vacío incluso si quedan variables antiguas en Netlify.

## Datos y futura migración

- `lib/demo/data/territories.json`: territorios jerárquicos con identificadores estables y visibilidad.
- `municipal-spaces.json`: relación con territorio y medio, escudo, contacto y suscripción.
- `municipal-content.json`: relación con espacio, tipo, origen, publicación, caducidad, fecha/lugar, plazo y adjuntos.
- `news.json` y `authors.json`: noticias y firmas. Noticias relacionadas con territorios mediante identificadores; conservan los campos de lectura actuales para el adaptador.
- `lib/demo/municipal.ts`: contrato de lectura y comprobación de actividad. `lib/cms.ts` y `lib/voice-demo.ts` son la frontera de acceso para las noticias existentes.

Estos archivos son los datos de la demo, no esquemas ejecutables de Payload. La futura integración sustituirá el acceso a archivos por consultas manteniendo el contrato que consumen las páginas. Validar permisos reales, medios, versiones, almacenamiento y suscripciones al retomar producción.

## Comprobaciones

`npm ci`, `npm run build`, `npm run lint`. Pruebas de navegador en `tests/demo-browser.mjs`, con Playwright aportado por el entorno de verificación. Variables opcionales: `PLAYWRIGHT_MODULE` (directorio del paquete), `CHROME_PATH`, `DEMO_TEST_URL`, `DEMO_CAPTURES` (guardar capturas fuera del repositorio).

La prueba cubre escritorio y móvil, seis espacios, enlaces, noindex/robots, pestañas, imágenes, publicación de aviso y evento, persistencia tras recarga, aislamiento entre navegadores y limpieza. El resultado corresponde al momento de ejecución; las fotografías remotas dependen de su servidor de origen.
