import { APIError, type Access, type CollectionBeforeChangeHook, type CollectionConfig, type Endpoint, type Field, type PayloadRequest } from 'payload';
import { revalidateAfterChange, revalidateAfterDelete } from './revalidate';
import { UTIL_SERVICES } from '../lib/util-services';
import { adminOnly, editorialUser, municipalSpaceOf, relationID } from './access';
import { auditAfterChange, auditAfterDelete } from './activity';
import { syncLinkedMedia, syncLinkedMediaAfterDelete } from './media-rights';
import { slugText } from './content-collections';

// Sección «Útil»: Patrimonio, Rutas y Directorio de servicios municipales (se cargan con los importadores desde
// datos-servicios/*.json y se editan en el CMS). Las fuentes automáticas están en lib/util-sources.ts.

/** Concejo (id de Towns) del espacio municipal de la cuenta conectada, o null. Se guarda en req.context. */
export async function municipalTownOf(req: PayloadRequest): Promise<number | null> {
  const space = municipalSpaceOf(req);
  if (space === null) return null;
  const cache = req.context as { municipalTown?: number | null };
  if (cache.municipalTown !== undefined) return cache.municipalTown;
  const doc = await req.payload.findByID({ collection: 'municipal-spaces', id: space, depth: 0, overrideAccess: true, req }).catch(() => null);
  cache.municipalTown = relationID(doc?.town);
  return cache.municipalTown;
}

const help = (description: string) => ({ admin: { description } });
const coordinates: Field[] = [{ type: 'row' as const, fields: [
  { name: 'lat', label: 'Latitud', type: 'number' as const, min: 42, max: 44.5, admin: { step: 0.000001, description: 'Por ejemplo 43.1234 (para el mapa de OpenStreetMap).' } },
  { name: 'lon', label: 'Longitud', type: 'number' as const, min: -7.5, max: -4.5, admin: { step: 0.000001, description: 'Por ejemplo -5.7654 (negativa en Asturias).' } },
] }];
const editorialOnly = { read: editorialUser, create: editorialUser, update: editorialUser };
const source: Field[] = [
  { name: 'sources', label: 'Fuentes oficiales', type: 'array', labels: { singular: 'Fuente', plural: 'Fuentes' }, fields: [{ name: 'url', label: 'Dirección', type: 'text', required: true }],
    ...help('Se publican al pie de la ficha.') },
  { name: 'doubts', label: 'Dudas pendientes (no se publica)', type: 'textarea', access: editorialOnly, ...help('Lo que falta por contrastar. Solo lo ve la redacción.') },
  { name: 'reviewed', label: 'Dudas revisadas', type: 'checkbox', defaultValue: false, access: editorialOnly, ...help('Márcalo cuando la redacción haya comprobado las dudas: quita el aviso «Dudoso».') },
  { name: 'externalID', label: 'Identificador de importación', type: 'text', unique: true, index: true, access: editorialOnly, admin: { position: 'sidebar', readOnly: true } },
];
// Aviso de revisión en el CMS (columna de la lista y aviso arriba de la ficha): coordenadas pendientes y dudoso.
export const reviewOptions = [
  { label: 'Correcto', value: 'ok' }, { label: 'Coordenadas pendientes', value: 'coordenadas' },
  { label: 'Dudoso', value: 'dudoso' }, { label: 'Dudoso y coordenadas pendientes', value: 'dudoso-coordenadas' },
];
const reviewField: Field = { name: 'review', label: 'Revisión', type: 'select', defaultValue: 'ok', options: reviewOptions, index: true, access: editorialOnly,
  admin: { position: 'sidebar', readOnly: true, description: 'Se calcula sola: faltan coordenadas (no sale en el mapa) o hay dudas sin revisar.' } };
const reviewNotice: Field = { name: 'reviewNotice', type: 'ui', admin: { components: { Field: '/components/util-review-notice#UtilReviewNotice' } } };
const setReview: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const next = { ...originalDoc, ...data };
  const hasTrack = Array.isArray(next.track) && next.track.length > 0;
  const missing = !(typeof next.lat === 'number' && typeof next.lon === 'number') && !hasTrack;
  const doubtful = Boolean(String(next.doubts ?? '').trim()) && !next.reviewed;
  data.review = doubtful && missing ? 'dudoso-coordenadas' : doubtful ? 'dudoso' : missing ? 'coordenadas' : 'ok';
  return data;
};
const published = { name: 'published', label: 'Publicado', type: 'checkbox' as const, defaultValue: true, index: true, admin: { position: 'sidebar' as const } };
const publicRead: Access = (args) => editorialUser(args) || { published: { equals: true } };

/** Slug único a partir del nombre y el concejo. */
const slugFrom = (collection: 'heritage' | 'routes'): CollectionBeforeChangeHook => async ({ data, originalDoc, req }) => {
  const name = String(data.name ?? originalDoc?.name ?? '');
  const townID = relationID(data.town ?? originalDoc?.town);
  const town = townID ? await req.payload.findByID({ collection: 'towns', id: townID, depth: 0, overrideAccess: true, req }).catch(() => null) : null;
  let slug = slugText(String(data.slug || originalDoc?.slug || `${name} ${town?.slug ?? ''}`)).slice(0, 90);
  if (!slug) throw new APIError('Falta el nombre', 400);
  for (let n = 2; ; n++) {
    const clash = await req.payload.find({ collection, where: { and: [{ slug: { equals: slug } }, ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : [])] }, limit: 1, depth: 0, overrideAccess: true, req });
    if (!clash.docs.length) break;
    slug = `${slug.replace(/-\d+$/, '')}-${n}`;
  }
  data.slug = slug;
  return data;
};
const townField = { name: 'town', label: 'Concejo', type: 'relationship' as const, relationTo: 'towns' as const, required: true, index: true };
const slugField = { name: 'slug', label: 'Dirección (slug)', type: 'text' as const, unique: true, index: true, admin: { position: 'sidebar' as const, description: 'Se crea sola a partir del nombre.' } };


export const Heritage: CollectionConfig = {
  slug: 'heritage',
  labels: { singular: 'Patrimonio', plural: 'Patrimonio' },
  access: { read: publicRead, create: editorialUser, update: editorialUser, delete: editorialUser },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'town', 'kind', 'review', 'published'], description: 'Fichas de patrimonio de la sección «Útil» (con mapa de OpenStreetMap). Se pueden importar con npm run cms:patrimonio:importar.' },
  // La foto es una imagen normal de Imágenes: su copia pública se crea al publicar la ficha (como en las noticias).
  hooks: { beforeChange: [slugFrom('heritage'), setReview], afterChange: [syncLinkedMedia, auditAfterChange], afterDelete: [syncLinkedMediaAfterDelete, auditAfterDelete] },
  fields: [
    reviewNotice,
    { name: 'name', label: 'Nombre', type: 'text', required: true }, townField,
    { name: 'image', label: 'Foto (opcional)', type: 'upload', relationTo: 'media', ...help('Sin foto, la ficha usa el diseño neutro. Con foto, se publican su autoría y su licencia.') },
    { name: 'kind', label: 'Tipo', type: 'text', ...help('Por ejemplo: iglesia prerrománica, patrimonio minero.') },
    { name: 'place', label: 'Localidad', type: 'text', ...help('Pueblo, parroquia o paraje.') },
    { name: 'description', label: 'Descripción', type: 'textarea', ...help('Texto de la ficha. Párrafos separados por una línea en blanco.') },
    { type: 'row', fields: [
      { name: 'protection', label: 'Protección legal', type: 'text', admin: { description: 'Figura y norma. Por ejemplo: BIC, monumento (Decreto…).' } },
      { name: 'protectionUrl', label: 'Enlace a la norma', type: 'text' },
    ] },
    ...coordinates,
    { name: 'coordinatesNote', label: 'Nota sobre el punto del mapa', type: 'text', ...help('Por ejemplo: «Centro de interpretación; no delimita el conjunto». Sin coordenadas comprobadas la ficha sale en la lista pero no en el mapa.') },
    ...source, reviewField, slugField, published,
  ],
};

export const Routes: CollectionConfig = {
  slug: 'routes',
  labels: { singular: 'Ruta', plural: 'Rutas' },
  access: { read: publicRead, create: editorialUser, update: editorialUser, delete: editorialUser },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'town', 'difficulty', 'review', 'published'], description: 'Rutas de la sección «Útil» (recorrido dibujado sobre OpenStreetMap cuando hay track oficial). Se pueden importar con npm run cms:rutas:importar.' },
  hooks: { beforeChange: [slugFrom('routes'), setReview], afterChange: [auditAfterChange], afterDelete: [auditAfterDelete] },
  fields: [
    reviewNotice,
    { name: 'name', label: 'Nombre', type: 'text', required: true }, townField,
    { name: 'code', label: 'Código', type: 'text', ...help('PR, GR o SL homologado, si lo tiene.') },
    { name: 'otherTowns', label: 'Otros concejos de las Cuencas', type: 'relationship', relationTo: 'towns', hasMany: true, ...help('La ruta sale también en la página de estos concejos.') },
    { name: 'alsoIn', label: 'También pasa por', type: 'text', ...help('Todos los demás concejos por los que pasa, como texto (también los de fuera de las Cuencas).') },
    { type: 'row', fields: [
      { name: 'start', label: 'Salida', type: 'text' },
      { name: 'end', label: 'Llegada', type: 'text' },
    ] },
    { type: 'row', fields: [
      { name: 'distanceKm', label: 'Distancia (km)', type: 'number', min: 0, admin: { step: 0.01 } },
      { name: 'distanceNote', label: 'La distancia corresponde a', type: 'text', admin: { description: 'Por ejemplo: ida y vuelta, distancia total.' } },
    ] },
    { type: 'row', fields: [
      { name: 'elevationUp', label: 'Desnivel positivo (m)', type: 'number', min: 0 },
      { name: 'elevationDown', label: 'Desnivel negativo (m)', type: 'number', min: 0 },
    ] },
    { type: 'row', fields: [
      { name: 'difficulty', label: 'Dificultad', type: 'text', admin: { description: 'Como la publica la fuente. Por ejemplo: «Media», «Fácil, según FEMPA».' } },
      { name: 'duration', label: 'Duración', type: 'text' },
    ] },
    { name: 'description', label: 'Descripción', type: 'textarea', ...help('Texto de la ficha. Párrafos separados por una línea en blanco.') },
    { name: 'gpxUrl', label: 'Descarga oficial del track', type: 'text', ...help('GPX, ZIP o PLT de la fuente oficial. Se enlaza siempre.') },
    { name: 'gpxLabel', label: 'Texto del enlace de descarga', type: 'text', ...help('Por ejemplo: «Track GPX oficial» o «Descarga oficial (PLT)».') },
    { name: 'track', label: 'Recorrido (simplificado)', type: 'json', admin: { readOnly: true, description: 'Lo rellena el importador a partir de la descarga oficial; sin recorrido, la ficha solo enlaza la descarga.' } },
    { name: 'trackNote', label: 'Origen del recorrido', type: 'text', access: editorialOnly, admin: { readOnly: true } },
    ...coordinates, ...source, reviewField, slugField, published,
  ],
};

export { serviceCategories } from './util-options';
import { serviceCategories } from './util-options';

/** Administración: todo. Cuenta municipal: solo los servicios de su concejo (no puede cambiar el concejo). */
const servicesWrite: Access = async (args) => {
  if (adminOnly(args)) return true;
  const town = await municipalTownOf(args.req);
  return town === null ? false : { town: { equals: town } };
};
const servicesCreate: Access = async (args) => {
  if (adminOnly(args)) return true;
  return (await municipalTownOf(args.req)) !== null;
};
const serviceTown: CollectionBeforeChangeHook = async ({ data, req }) => {
  // Sin usuario: importador o tareas del servidor (API local).
  if (!req.user || adminOnly({ req })) return data;
  const town = await municipalTownOf(req);
  if (town === null) throw new APIError('No autorizado', 403);
  data.town = town;
  return data;
};

export const MunicipalServices: CollectionConfig = {
  slug: 'municipal-services',
  labels: { singular: 'Servicio municipal', plural: 'Servicios municipales' },
  access: { read: () => true, create: servicesCreate, update: servicesWrite, delete: servicesWrite },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'town', 'category', 'phone'], description: 'Directorio de servicios municipales de la sección «Útil». Lo edita la administración y cada ayuntamiento el de su concejo desde su panel. Se puede importar con npm run cms:servicios:importar.' },
  hooks: { beforeChange: [serviceTown], afterChange: [auditAfterChange], afterDelete: [auditAfterDelete] },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true, maxLength: 160 }, townField,
    { name: 'category', label: 'Tipo', type: 'select', required: true, defaultValue: 'ayuntamiento', options: [...serviceCategories] },
    { name: 'place', label: 'Localidad', type: 'text', maxLength: 120 },
    { name: 'address', label: 'Dirección', type: 'text', maxLength: 200 },
    { type: 'row', fields: [
      { name: 'phone', label: 'Teléfono', type: 'text', maxLength: 80, admin: { description: 'Varios, separados por « · ».' } },
      { name: 'email', label: 'Correo', type: 'text', maxLength: 120 },
    ] },
    { name: 'web', label: 'Web', type: 'text', maxLength: 300, validate: (value: unknown) => !value || /^https?:\/\/\S+$/.test(String(value)) || 'La web debe empezar por https://' },
    { name: 'hours', label: 'Horario', type: 'textarea', maxLength: 500, admin: { description: 'Hasta 500 caracteres.' } },
    { name: 'notes', label: 'Observaciones', type: 'textarea', maxLength: 600 },
    { name: 'sourceUrl', label: 'Fuente', type: 'text', maxLength: 300, admin: { description: 'Página oficial de la que sale el dato.' } },
    { name: 'doubts', label: 'Dudas pendientes (no se publica)', type: 'textarea', access: editorialOnly },
    { name: 'externalID', label: 'Identificador de importación', type: 'text', unique: true, index: true, access: editorialOnly, admin: { position: 'sidebar', readOnly: true } },
    { name: 'order', label: 'Orden', type: 'number', defaultValue: 100, admin: { position: 'sidebar', description: 'Los números más bajos salen antes dentro de su tipo.' } },
  ],
};

// Servicios de «Útil» ocultos en un concejo. Lo decide el ayuntamiento desde su panel (solo su concejo y solo con el
// espacio municipal activo); en los concejos sin espacio activo, la administración (aquí o en el CMS).
const utilServiceOptions = UTIL_SERVICES.map(s => ({ label: s.label, value: s.key }));
const visibilityEndpoint: Endpoint = {
  path: '/concejo', method: 'post',
  handler: async (req) => {
    const body = await req.json?.().catch(() => null) as { hidden?: unknown; town?: unknown } | null;
    const hidden = Array.isArray(body?.hidden) ? [...new Set(body!.hidden.map(String))] : null;
    if (!hidden || hidden.some(key => !UTIL_SERVICES.some(s => s.key === key))) return Response.json({ error: 'Servicios no válidos' }, { status: 400 });
    let town: number | null;
    if (adminOnly({ req })) town = relationID(body?.town);
    else {
      const space = municipalSpaceOf(req);
      if (space === null) return Response.json({ error: 'No autorizado' }, { status: req.user ? 403 : 401 });
      const doc = await req.payload.findByID({ collection: 'municipal-spaces', id: space, depth: 0, overrideAccess: true, req }).catch(() => null);
      const sub = doc?.subscription;
      const now = new Date();
      const active = sub?.status === 'demo' || (sub?.status === 'active' && (!sub.startsAt || new Date(sub.startsAt) <= now) && (!sub.endsAt || new Date(sub.endsAt) >= now));
      if (!active) return Response.json({ error: 'Con el espacio municipal inactivo, lo decide la administración' }, { status: 403 });
      town = relationID(doc?.town);
    }
    if (town === null) return Response.json({ error: 'Concejo no válido' }, { status: 400 });
    const existing = (await req.payload.find({ collection: 'util-visibility', where: { town: { equals: town } }, limit: 1, depth: 0, overrideAccess: true, req })).docs[0];
    const data = { town, hidden: hidden as never, updatedBy: req.user!.id };
    if (existing) await req.payload.update({ collection: 'util-visibility', id: existing.id, data, overrideAccess: true, req });
    else await req.payload.create({ collection: 'util-visibility', data, overrideAccess: true, req });
    return Response.json({ hidden });
  },
};

export const UtilVisibility: CollectionConfig = {
  slug: 'util-visibility',
  labels: { singular: 'Útil: servicios ocultos', plural: 'Útil: servicios ocultos' },
  access: { read: () => true, create: adminOnly, update: adminOnly, delete: adminOnly },
  admin: { useAsTitle: 'summary', defaultColumns: ['town', 'hidden', 'updatedBy', 'updatedAt'],
    description: 'Servicios de «Útil» que no salen en un concejo. Cada ayuntamiento los elige desde su panel; en los concejos sin espacio municipal activo, decide la administración. Las noticias y lo editorial no se pueden ocultar.' },
  endpoints: [visibilityEndpoint],
  hooks: { beforeChange: [async ({ data, originalDoc, req }) => {
    const townID = relationID(data.town ?? originalDoc?.town);
    const town = townID ? await req.payload.findByID({ collection: 'towns', id: townID, depth: 0, overrideAccess: true, req }).catch(() => null) : null;
    data.summary = town?.name ?? 'Concejo';
    return data;
  }], afterChange: [auditAfterChange, revalidateAfterChange], afterDelete: [revalidateAfterDelete] },
  fields: [
    { name: 'summary', type: 'text', admin: { hidden: true } },
    { name: 'town', label: 'Concejo', type: 'relationship', relationTo: 'towns', required: true, unique: true, index: true },
    { name: 'hidden', label: 'Servicios ocultos en este concejo', type: 'select', hasMany: true, options: utilServiceOptions },
    { name: 'updatedBy', label: 'Cambiado por', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
};
