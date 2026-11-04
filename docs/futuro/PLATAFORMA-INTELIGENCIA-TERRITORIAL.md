# Proyecto futuro: plataforma de inteligencia territorial (Territory Intelligence Platform)

Estado: proyecto separado del periódico, no funcionalidad de Planta 14. Fase 0 decidida el 4/11/2026: se hará en enero de 2027.

## Idea
- Planta 14 sería la primera aplicación visible de una infraestructura que captura de forma permanente información pública del territorio y la convierte en inteligencia. Los ayuntamientos pagan el periódico y, de hecho, financian la tecnología.
- Cadena: fuentes de datos, captación automática, normalización, data lake persistente, IA, productos (Planta 14, informes para ayuntamientos, alertas empresariales, seguimiento de licitaciones e inversiones, monitorización de empresas, búsquedas históricas, asistentes conversacionales).
- Data lake como memoria, no buscador: adjudicaciones, licencias, BOPA, ayudas, notas de prensa, agendas, PDF, estadísticas, empresas, asociaciones e inversiones, todo relacionado y fechado.
- El foso son las series históricas: lo que no se captura hoy no se reconstruye después.
- Territorio: Cuencas, luego Asturias, después otras comunidades.

## Encaje con lo construido
Fuentes automáticas de la sección Útil (BDNS, BOE, DGT, AEMET), servidor con PostgreSQL y almacenamiento S3, estadísticas propias, panel municipal y plan de IA tras las elecciones de mayo de 2027.

## Límites
1. Centrado en empresas, contratos, ayudas y expedientes; personas físicas solo en su papel público y con evaluación de impacto RGPD previa. Sin extracción de LinkedIn.
2. Otros medios: lectura para alertas internas; nunca reescritura ni publicación.
3. Conflicto de interés con los ayuntamientos clientes: a medio plazo, sociedad y marca separadas.
4. Cruces de datos sobre contrataciones: solo pistas internas; nada se publica sin verificación periodística.
5. Lo difícil y continuo: resolución de entidades y mantenimiento de los lectores.

## Fases
- Fase 0 (enero de 2027, decidida): archivador automático separado del periódico. Cada noche guarda, con fecha y huella, BOPA (sumario y anuncios de los seis concejos), contratación pública de los seis ayuntamientos y del Principado (Plataforma de Contratación del Sector Público), BDNS (convocatorias y concesiones a entidades), BOE y notas de prensa municipales. Almacenamiento S3 actual con copia en Fráncfort y aviso por correo si una fuente falla. Sin procesar, sin publicar, sin perfiles de personas. Extra: correo diario a cada periodista con lo aparecido ayer de sus concejos. Coste estimado: menos de 1 €/mes de almacenamiento y un encargo de uno o dos días.
- Fase 1 (tras las elecciones de mayo de 2027): IA para normalizar, relacionar y alertar a los periodistas.
- Fase 2: productos para terceros con marca propia.

## Pendientes
- Revisar la base legal (RGPD y propiedad intelectual) con el abogado.
- Decidir nombre e identidad propios separados de Planta 14.
- Encargo de la Fase 0 a Code nube en enero de 2027.
