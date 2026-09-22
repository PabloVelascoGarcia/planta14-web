# Actualización de la presentación

Por instrucción expresa del promotor, que confirma autorización para usar el contenido, la edición con siete noticias e imágenes de La Voz queda activada por defecto y sin contraseña. Se conserva la atribución. La cabecera completa «Planta 14» pasa a negro puro. La protección de administración y API permanece; el acceso de lectores es público. `DEMO_CONTENT=example` permite recuperar la muestra anterior. Las instrucciones de acceso privado del informe histórico siguiente quedan sustituidas por esta decisión.

# Planta 14 — revisión técnica y decisión de arquitectura

Fecha: 22 de septiembre de 2026. Alcance: revisión del repositorio, compilación, dependencias y recorrido público de la primera vista previa. No es una auditoría de penetración ni una prueba de carga.

## Decisión

Conservar Next.js, React, TypeScript, Tailwind y el diseño territorial. La aplicación es pequeña y adecuada para una web editorial. No hay motivo demostrado para migrar de framework o de Netlify. Sí debe sustituirse el CMS de archivos antes de operar una redacción real.

Separar frontend y contenido mediante una capa de acceso estable. `lib/cms.ts` ya concentra buena parte de esas operaciones; debe evolucionar a un adaptador, sin hacer que los componentes conozcan al proveedor.

## Hallazgos y actuaciones

| Área | Hallazgo en el código original | Actuación |
|---|---|---|
| Contenidos | `lib/cms.ts` lee/escribe JSON locales; escrituras concurrentes pueden sobrescribirse | Demo alojada de solo lectura; migración a CMS persistente antes del lanzamiento |
| Imágenes | `app/api/uploads/route.ts` escribe en `public/uploads` | No usar ese mecanismo en Netlify; conectar almacenamiento de objetos y CDN |
| Autenticación | Usuario con contraseña se serializaba íntegro en cookie; secretos y contraseñas por defecto en producción | Selección explícita de campos, caducidad verificada en servidor y configuración obligatoria en producción |
| Sesiones | Firma comprobada, pero sin expiración dentro del payload | Caducidad de ocho horas, rechazo de formato incorrecto y pruebas de regresión |
| Autorización | Proxy original solo comprobaba existencia de cookie en `/admin` | API del CMS verifica sesión; escrituras alojadas bloqueadas también en capa de datos |
| Roles | Un redactor puede mandar cambios a artículos ajenos como borrador; no existe propiedad ni revisión completa | No habilitar edición multiusuario real hasta definir permisos por contenido y flujo de aprobación |
| Login | Sin control persistente de intentos ni protección completa frente a abuso | Pendiente proveedor de autenticación, limitación de intentos y revisión de origen en operaciones de escritura |
| Dependencias | Auditoría inicial: 8 paquetes con avisos, uno crítico asociado a Next.js | Next actualizado de 16.2.9 a 16.3.5; actualización compatible del árbol y PostCSS; configuración ESLint alineada |
| SEO | Dominio `.local` en metadatos y sitemap; demo indexable | URL de entorno, `noindex` y robots restrictivo por defecto; activación explícita al lanzar |
| Newsletter/contacto | Formularios sin persistencia ni envío real | Sustituidos por estado próximo lanzamiento, sin recoger datos |
| Portada | Asume al menos una noticia | Estado vacío añadido |
| Presentación privada | El enlace de Netlify es público por defecto | Modo La Voz protegido por contraseña en producción; sin contraseña configurada devuelve 503 y no muestra contenido |

La cookie sigue siendo firmada, no cifrada. Solo contiene identidad mínima, rol y vencimiento; no debe llevar datos sensibles. Para producción conviene un proveedor que añada revocación y gestión de usuarios. Cambiar el formato invalida las sesiones antiguas. Las correcciones de esta rama no protegen aún la demo antigua en `main` hasta que se integren.

## Contenido de La Voz

`lib/voice-demo.ts` incorpora siete resúmenes originales basados en noticias verificadas de La Voz de Asturias, con enlaces, firma de la fuente, fecha y crédito fotográfico. No copia los artículos completos ni atribuye nuestros resúmenes a periodistas de La Voz. No existe importación automatizada ni acuerdo de sindicación implícito.

Se conserva la fecha de las noticias de archivo. La agenda deriva de dos convocatorias publicadas. Las imágenes se referencian en origen, lo que depende de la disponibilidad y política de ese servidor. Antes de una explotación pública, acordar uso, derechos, créditos y copia a un almacenamiento propio. Algunas fotos proceden de terceros, no del medio.

Activación: variables `DEMO_CONTENT=lavoz` y `DEMO_ACCESS_PASSWORD` (secreto aleatorio de al menos 16 caracteres) en el contexto **Deploy Previews** de Netlify, seguido de un nuevo despliegue. Usuario del aviso de acceso: puede utilizarse `demo`; la verificación se realiza sobre la contraseña. No ponerla en el repositorio ni en una URL. Dejar `SITE_INDEXABLE=false`. Sin activar estas variables, la vista previa conserva los contenidos de ejemplo.

El control de acceso está preparado en la aplicación. No cambia la visibilidad del repositorio GitHub, que es público. La protección del despliegue no hace privado el código. No subir información empresarial confidencial al repositorio.

## Arquitectura de lanzamiento

1. **Frontend:** mantener Next.js. Portada, concejos y artículos con generación estática o caché e invalidación al publicar. Ahora están en `force-dynamic`; es aceptable para la demo, pero innecesario para cada visita de un medio.
2. **Redacción:** preferir el CMS que La Voz pueda operar cómodamente. Si puede entregar contenido por API o feed autorizado, integrar esa entrada con revisión y publicación en Planta 14. Si necesita editar directamente, conectar un CMS gestionado con usuarios, borradores, versiones, programación y biblioteca multimedia. Elegir proveedor después de concretar su flujo, no por moda.
3. **Datos e imágenes:** contenido estructurado persistente; imágenes en almacenamiento de objetos con variantes, crédito y texto alternativo. Si se conserva un backend propio, usar una base transaccional y control de versiones, no JSON compartidos.
4. **Seguridad y operación:** cuentas individuales, roles editor/redactor, registro de cambios, copias de seguridad, control de intentos de login, validación de cargas y monitorización.
5. **Distribución:** canonical correcto, sitemap de publicados, metadatos sociales y datos estructurados de artículos; boletín conectado a un servicio real cuando se acuerde.

No introducir microservicios, buscador externo, Data Lake ni infraestructura de IA en esta fase. La búsqueda local sirve para la muestra; con un catálogo grande debe resolverse en el CMS/base de datos, con paginación.

## Fuentes técnicas consultadas

- Next.js, autenticación y controles junto al dato: https://nextjs.org/docs/app/guides/authentication
- Netlify, compatibilidad con Next.js: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- Netlify, funciones en un entorno efímero: https://docs.netlify.com/build/functions/overview/
- Netlify Blobs, almacenamiento persistente disponible: https://docs.netlify.com/build/data-and-storage/netlify-blobs/

El diagnóstico de código y las recomendaciones son propios; las fuentes confirman capacidades de plataforma. Los resultados de `npm audit` corresponden al registro consultado durante esta revisión, no garantizan ausencia de vulnerabilidades futuras.

## Verificación de esta iteración

- Build de producción con `DEMO_CONTENT=lavoz`: correcto; TypeScript correcto.
- Sesiones: pruebas de ausencia de contraseña, firma, formato, secreto y caducidad correctas.
- Proxy: pruebas de cierre sin configuración, desafío de acceso, no-cache, verificación de sesión y bloqueo de escrituras correctas.
- Contenido: siete slugs únicos con fuente, firma original y crédito de imagen.
- Primera vista previa: portada revisada visualmente y búsqueda combinada «montaña» + Aller comprobada en navegador (un resultado pertinente).
- Pendiente: activar las variables privadas de Netlify y revisar allí las siete piezas, las imágenes y la versión móvil. No se ha certificado todavía el aspecto final de esa edición.
