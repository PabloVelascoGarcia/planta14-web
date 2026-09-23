# Planta 14: preparación de la presentación

## Entorno recuperado

Repositorio: PabloVelascoGarcia/planta14-web. Base: 05b6b4b.
Rama de trabajo: mejora/presentacion-la-voz. Main mantiene la demo anterior.

Para trabajar en otro equipo:

```sh
git clone https://github.com/PabloVelascoGarcia/planta14-web.git
cd planta14-web
git switch mejora/presentacion-la-voz
npm ci
npm run dev
```

Abrir http://localhost:3000. Validación: npm run build y npm run lint.

## Primera revisión

Se conservan identidad papel/negro/cobre, tipografía editorial y organización por Caudal/Nalón/concejo. Se mejora la cabecera, la apertura, la lectura en móvil y la navegación. Se añade búsqueda con filtros combinables por texto y concejo, sin servicios externos. Se corrige el fallo de portada sin artículos. Se explicitan las funciones de contacto y boletín aún no disponibles.

Recorrido de presentación: portada → comarca → concejo → noticia → búsqueda territorial → agenda → publicidad.

## Validación y pendientes

Compilación y TypeScript correctos. ESLint sin errores, con cuatro avisos sobre optimización de imágenes. Corregida la configuración de ESLint que analizaba artefactos generados en .next.

La demo publicada original se inspeccionó en navegador. El navegador remoto no accede a localhost; la primera vista previa se revisó después en Netlify, incluida la búsqueda combinada. La versión móvil y la edición privada con contenido de La Voz aún requieren revisión.

Antes de enseñar: revisar portada y artículo en escritorio y móvil; sustituir fotografías de archivo genéricas por imágenes territoriales con derechos y créditos; revisar las historias de muestra. Las noticias, autores y fechas de ejemplo no equivalen a información verificada. El boletín y el contacto no capturan datos.

Antes del lanzamiento: almacenamiento persistente para noticias e imágenes; revisión de autenticación y sesiones (configuración obligatoria en producción y exclusión de credenciales del payload); dominio y metadatos reales; flujo editorial acordado; canales de contacto reales; tratamiento de datos y textos legales; contenidos y agenda actualizados. La configuración ESLint heredada y las dependencias merecen una revisión posterior separada.

## Criterio editorial para la siguiente iteración

Mostrar un medio territorial reconocible: fotografía local, jerarquía clara, lectura cómoda, proyectos y personas. Evitar efectos que compitan con la noticia. Conservar todas las secciones; priorizar visualmente empresas, economía, sociedad, cultura y patrimonio. No afirmar una alianza con La Voz mientras siga en negociación.

Revisión técnica ampliada y activación de contenido real: ver `REVISION-ARQUITECTURA.md`.
