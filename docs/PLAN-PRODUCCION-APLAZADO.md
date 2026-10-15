# Plan de producción — aplazado el 15 de octubre de 2026

La prioridad actual es una demo comercial en Netlify. No instalar Payload, PostgreSQL ni infraestructura de producción en esta etapa. No indicar empresa titular: pendiente de decisión.

Decisiones para retomar: Next.js, Payload integrado, PostgreSQL con copias automáticas y restauración comprobada, fotos originales y variantes en S3 con créditos y derechos, GA4 condicionado al consentimiento y plataforma de consentimiento certificada. Producción prevista en IONOS, pendiente de comprobar el contrato; no contratar servicios.

## Fases futuras

1. Espacios municipales reales, usuarios aislados por concejo, suscripciones y moderación administrativa. Panel móvil sencillo. Caudal visible y Nalón activable mediante datos.
2. Roles: administración, edición, redacción, colaborador territorial, comercial y ayuntamiento. Comprobaciones de permisos en API y servidor, incluidas imágenes y PDF.
3. Migrar noticias y autores a Payload. Borrador, pendiente de revisión, publicada y despublicada; programación, versiones, papelera y API de agente limitada a pendientes.
4. GA4/consentimiento, NewsArticle, sitemap de noticias y textos legales cuando se decida el titular. Despliegue con pruebas de recuperación de base y archivos.

Colecciones previstas: medios, territorios jerárquicos, espacios municipales, suscripciones, usuarios, contenidos municipales, noticias, autores, archivos, anunciantes y actividad. Los archivos de `lib/demo/data/` son contratos de datos de demostración que podrá consumir un adaptador de Payload, no una instalación del CMS.

Paquete municipal previsto: 6.000 €/año más IVA; 3.000 € por semestre y mínimo seis meses; dos noticias semanales de redacción, dos entrevistas y dos reportajes anuales y espacio municipal. Pendiente confirmar reglas de suspensión, permisos de ocultación y datos legales.

Estimación inicial, no presupuesto contratado: 40–80 €/mes más IVA para servidor, almacenamiento, copias y auxiliares; revisar precios y alcance al retomar. Propuesta técnica de inicio: Linux, 4 núcleos, 8 GB, Node.js persistente, PostgreSQL, HTTPS, tareas programadas, correo transaccional y almacenamiento S3 externo.

No utilizar `feature/payload-cms` hasta que se autorice retomar producción. La demo sigue en `mejora/presentacion-la-voz`.
