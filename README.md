# Planta 14

Web editorial para un periódico digital local centrado en las cuencas mineras asturianas. La navegación principal prioriza el territorio: Caudal, Nalón y sus concejos.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Datos mock iniciales
- SEO básico con metadata de Next.js
- Preparada para desplegar en Vercel

## Ejecutar en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

El panel de administración está en `http://localhost:3000/admin`.

## CMS

El proyecto incluye un CMS funcional dentro de Next.js:

- `app/admin/page.tsx`: panel para crear noticias.
- `app/api/articles/route.ts`: API interna de publicación.
- `lib/cms.ts`: lectura y escritura de noticias.
- `data/articles.json`: archivo que se crea automáticamente al publicar la primera noticia.

El panel está protegido con login en `/admin/login`. Configura estas variables en local o en Netlify:

```bash
CMS_AUTH_SECRET=change-this-long-random-secret
CMS_ADMIN_EMAIL=admin@example.com
CMS_ADMIN_PASSWORD=change-this-password
CMS_REDACTOR_EMAIL=redactor@example.com
CMS_REDACTOR_PASSWORD=change-this-password-too
```

Si no defines variables, existen credenciales de desarrollo:

```text
Administrador: admin@planta14.local / admin1234
Redactor: redactor@planta14.local / redactor1234
```

Funciones incluidas:

- Login con cookie segura.
- Roles: Administrador y Redactor.
- Administrador: publicar, despublicar, programar, borrar noticias y gestionar autores.
- Redactor: crear y editar borradores.
- Crear y editar noticias.
- Borradores, publicar, despublicar y programación.
- Campos SEO por noticia.
- Subida de imágenes a `public/uploads`.
- Gestión de autores: crear, editar y borrar.

Al crear o publicar una noticia desde `/admin`, se guarda con slug automático y aparece en portada, comarca, concejo, temática, autor y opinión si corresponde.

Para producción en Netlify o Vercel, cambia la persistencia de `lib/cms.ts` por una base de datos o servicio persistente, porque el sistema de archivos serverless no conserva escrituras de forma permanente.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Despliegue en Vercel

1. Sube este proyecto a un repositorio.
2. Crea un nuevo proyecto en Vercel.
3. Selecciona el repositorio.
4. Vercel detectará Next.js automáticamente.
5. Despliega con la configuración por defecto.

## Estructura

- `app/`: páginas y rutas del App Router.
- `components/`: piezas reutilizables de portada, listados, cabecera y pie.
- `lib/mock-data.ts`: datos iniciales de noticias, territorios, temas, autores y agenda.
- `lib/utils.ts`: helpers de filtrado y formato.

Las imágenes mock usan URLs remotas para facilitar una primera demo sin añadir assets pesados al repositorio.
