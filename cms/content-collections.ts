import { APIError, type CollectionBeforeChangeHook, type CollectionBeforeOperationHook, type CollectionConfig, type Field, type FieldHook } from 'payload';
import { BlockquoteFeature, BoldFeature, FixedToolbarFeature, HeadingFeature, InlineToolbarFeature, ItalicFeature, LinkFeature, OrderedListFeature, ParagraphFeature, UnorderedListFeature, lexicalEditor } from '@payloadcms/richtext-lexical';
import { toLexical } from '../lib/rich-text';
import { adminOnly, articlesRead, editorialContentRead, editorialUser, editorialVersions, municipalContentCreate, municipalContentRead, municipalContentUpdate,
  municipalContentVersions, municipalSpaceOf, municipalSpaceRead, notMunicipal, relationID } from './access';
import { auditAfterChange, auditAfterDelete, rememberMainState } from './activity';
import { syncLinkedMedia, syncLinkedMediaAfterDelete, validatePublishedImages } from './media-rights';
import { loteField } from './lote';

const text = (name: string, required = false): Field => ({ name, type: 'text', required });
const key: Field = { name: 'legacyID', type: 'text', unique: true, index: true };
const provenance: Field[] = [text('provenance'), text('sourceUrl')];
const validateImages: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  await validatePublishedImages({ ...originalDoc, ...data }, req);
  return data;
};
const published = {
  versions: { drafts: true },
  access: { create: editorialUser, read: editorialContentRead, readVersions: editorialVersions, update: editorialUser, delete: editorialUser },
  hooks: {
    beforeChange: [rememberMainState, validateImages],
    afterChange: [syncLinkedMedia, auditAfterChange],
    afterDelete: [syncLinkedMediaAfterDelete, auditAfterDelete],
  },
} satisfies Partial<CollectionConfig>;

type Withdrawal = { withdrawn?: boolean | null; reason?: string | null; withdrawnAt?: string | null; withdrawnBy?: unknown };

/** A withdrawal by Planta 14 always applies to the live document, even from a "save draft" action. */
const withdrawalAppliesToLiveDocument: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation === 'restoreVersion') {
    const versionID = (args as { id?: number | string }).id;
    const result = await req.payload.db.findVersions({ collection: 'municipal-content', req, limit: 1, pagination: false, where: { id: { equals: versionID } } });
    const version = result.docs[0];
    const own = municipalSpaceOf(req);
    if (!editorialUser({ req }) && (!version || own === null || relationID(version.version.space) !== own)) throw new APIError('No puedes restaurar esta versión', 403);
    if (version) {
      const live = await req.payload.db.findOne<{ id: number; withdrawal?: Withdrawal }>({ collection: 'municipal-content', req, where: { id: { equals: relationID(version.parent) } } });
      if (live?.withdrawal?.withdrawn) throw new APIError('Restablece expresamente el contenido retirado antes de restaurar una versión', 403);
    }
  }
  const withdrawal = ((args as { data?: { withdrawal?: Withdrawal } }).data)?.withdrawal;
  if (operation === 'update' && editorialUser({ req }) && typeof withdrawal?.withdrawn === 'boolean') (args as { draft?: boolean }).draft = false;
  return args;
};

/**
 * Municipal accounts publish directly in their own space; Planta 14 editors can withdraw content with a reason.
 * Runs before field validation, so the values set here are the ones validated and stored.
 */
const municipalRules: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const live = originalDoc?.id ? await req.payload.db.findOne<{ id: number; withdrawal?: Withdrawal }>({ collection: 'municipal-content', req, where: { id: { equals: originalDoc.id } } }) : null;
  const previous = (live?.withdrawal || originalDoc?.withdrawal || {}) as Withdrawal;
  if (req.user?.collection === 'users' && req.user.role === 'municipal') {
    const own = municipalSpaceOf(req);
    if (own === null) throw new APIError('Cuenta municipal sin espacio asignado', 403);
    const target = relationID(data.space ?? originalDoc?.space);
    if (target !== null && target !== own) throw new APIError('Solo puedes gestionar el contenido de tu espacio municipal', 403);
    delete data.withdrawal;
    Object.assign(data, { space: own, origin: 'municipality', demo: false });
    if (operation === 'create') Object.assign(data, { legacyID: null, provenance: 'municipal-account', sourceUrl: null });
    else { delete data.legacyID; delete data.provenance; delete data.sourceUrl; }
    const status = data._status ?? originalDoc?._status;
    if (previous.withdrawn && status === 'published') throw new APIError(`Planta 14 retiró este contenido: ${previous.reason || 'sin motivo indicado'}. No se puede volver a publicar.`, 403);
    const image = relationID(data.image ?? originalDoc?.image);
    if (image !== null) {
      const media = await req.payload.findByID({ collection: 'media', id: image, depth: 0, overrideAccess: true, req });
      if (relationID(media.uploadedBySpace) !== own) throw new APIError('Usa una imagen subida por tu ayuntamiento', 403);
    }
    if (!data.publishedAt && !originalDoc?.publishedAt) data.publishedAt = new Date().toISOString().slice(0, 10);
    return data;
  }
  const requested = data.withdrawal as Withdrawal | undefined;
  if (requested?.withdrawn === true && !previous.withdrawn) {
    if (!requested.reason?.trim()) throw new APIError('Indica el motivo de la retirada', 400);
    data.withdrawal = { withdrawn: true, reason: requested.reason.trim(), withdrawnAt: new Date().toISOString(), withdrawnBy: req.user?.id ?? null };
    data._status = 'draft';
  } else if (requested?.withdrawn === false && previous.withdrawn) {
    data.withdrawal = { withdrawn: false, reason: null, withdrawnAt: null, withdrawnBy: null };
  } else if (previous.withdrawn && (data._status ?? originalDoc?._status) === 'published' && requested?.withdrawn !== false) {
    throw new APIError('Restablece el contenido retirado antes de volver a publicarlo', 400);
  }
  return data;
};

export const Sections: CollectionConfig = {
  slug: 'sections', admin: { useAsTitle: 'name' },
  access: { read: notMunicipal, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [{ name: 'slug', type: 'text', required: true, unique: true }, text('name', true), { name: 'position', type: 'number', defaultValue: 0 }],
};

export const Towns: CollectionConfig = {
  slug: 'towns', admin: { useAsTitle: 'name' },
  access: { read: notMunicipal, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [key, { name: 'slug', type: 'text', unique: true, required: true }, text('name', true),
    { name: 'comarca', type: 'select', required: true, options: ['Caudal', 'Nalón'] },
    { name: 'visible', type: 'checkbox', defaultValue: true }, ...provenance],
};

export const Authors: CollectionConfig = {
  slug: 'authors', admin: { useAsTitle: 'name' },
  access: { read: notMunicipal, create: editorialUser, update: editorialUser, delete: editorialUser },
  fields: [text('name', true), { name: 'slug', type: 'text', unique: true, required: true }, text('role'), { name: 'bio', type: 'textarea' },
    { name: 'email', type: 'email', access: { read: editorialUser } }, { name: 'avatar', type: 'relationship', relationTo: 'media' }, loteField],
};

/** Editor del texto de las noticias: párrafos, negrita, cursiva, enlaces, ladillos, citas y listas, y nada más. */
const articleEditor = lexicalEditor({ features: () => [ParagraphFeature(), BoldFeature(), ItalicFeature(), LinkFeature({ enabledCollections: [] }),
  HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }), BlockquoteFeature(), UnorderedListFeature(), OrderedListFeature(), FixedToolbarFeature(), InlineToolbarFeature()] });
/** Slug: se genera del título al crear si se deja vacío; siempre sin tildes, eñes ni espacios, y único. */
export function slugText(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90).replace(/-+$/, '');
}
const articleSlug: FieldHook = async ({ value, data, originalDoc, req }) => {
  const base = slugText(String(value || data?.title || originalDoc?.title || '')) || 'noticia';
  let candidate = base;
  for (let n = 2; n < 500; n++) {
    const clash = await req.payload.find({ collection: 'articles', where: { slug: { equals: candidate } }, limit: 1, depth: 0, overrideAccess: true, req, draft: true });
    if (!clash.docs[0] || clash.docs[0].id === originalDoc?.id) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
};

const madridDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(iso));
/**
 * Fechas sin solapamientos: «Fecha de publicación» es la que se muestra (por defecto, ahora; no puede ser futura).
 * «Publicación programada» (opcional): la noticia sale sola a esa hora, que pasa a ser su fecha de publicación.
 * El campo interno `date` (AAAA-MM-DD) se deriva siempre de la fecha de publicación.
 */
const articleDates: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  // Lo que llega en el formulario manda (también un campo vaciado); si no llega, lo guardado.
  const value = (key: 'publishedAt' | 'scheduledAt') => (Object.prototype.hasOwnProperty.call(data, key) ? data[key] : originalDoc?.[key]) || null;
  const same = (a: unknown, b: unknown) => Boolean(a && b) && new Date(String(a)).getTime() === new Date(String(b)).getTime();
  const now = new Date().toISOString();
  const scheduled = value('scheduledAt');
  if (scheduled) data.publishedAt = scheduled;
  else {
    let published = value('publishedAt');
    // Se quitó la programación: la fecha que había era la programada, no una elegida a mano.
    if (published && same(published, originalDoc?.scheduledAt) && new Date(published).getTime() > Date.now()) published = null;
    // Vacía: al publicar se pone la hora de publicación.
    if (!published && (data._status ?? originalDoc?._status) === 'published') published = now;
    if (published && new Date(published).getTime() > Date.now() + 5 * 60 * 1000) throw new APIError('La fecha de publicación no puede ser futura. Para que la noticia salga más tarde, usa «Publicación programada».', 400);
    data.publishedAt = published;
  }
  data.date = madridDay(data.publishedAt || now);
  return data;
};
const dateTime = { date: { pickerAppearance: 'dayAndTime' as const, displayFormat: 'dd/MM/yyyy HH:mm', timeFormat: 'HH:mm', timeIntervals: 5 } };
const help = (description: string) => ({ admin: { description } });
const adminOnlyReadOnly = { readOnly: true, condition: (_: unknown, __: unknown, { user }: { user?: { role?: string } | null }) => user?.role === 'admin' };

// Vista previa en vivo con el diseño público (app/(frontend)/vista-previa/noticia/[id]).
const previewURL = ({ data }: { data: { id?: number | string } }) => `${process.env.CMS_SERVER_URL || ''}/vista-previa/noticia/${data?.id ?? ''}`;

export const Articles: CollectionConfig = {
  slug: 'articles', ...published,
  access: { ...published.access, read: articlesRead },
  hooks: { ...published.hooks, beforeChange: [articleDates, ...published.hooks.beforeChange] },
  admin: { useAsTitle: 'title', hideAPIURL: true, defaultColumns: ['title', '_status', 'publishedAt', 'town', 'createdBy'],
    livePreview: { url: previewURL, breakpoints: [{ name: 'movil', label: 'Móvil', width: 390, height: 844 }, { name: 'tableta', label: 'Tableta', width: 820, height: 1180 }, { name: 'escritorio', label: 'Escritorio', width: 1366, height: 900 }] },
    preview: (doc) => previewURL({ data: doc as { id?: number } }) },
  fields: [
    { type: 'tabs', tabs: [
      { label: 'Contenido', fields: [
        { name: 'title', label: 'Título', type: 'text', required: true, ...help('El titular, claro y concreto. Aparece en la portada, en la noticia y en los buscadores.') },
        { name: 'excerpt', label: 'Entradilla', type: 'textarea', required: true, ...help('Una o dos frases que resumen la noticia. Sale bajo el titular y en las tarjetas de la portada.') },
        { name: 'body', label: 'Texto', type: 'richText', required: true, editor: articleEditor,
          hooks: { beforeValidate: [({ value }) => toLexical(value) ?? value] },
          ...help('Escribe o pega el texto. Puedes usar negrita, cursiva, enlaces, ladillos (títulos intermedios), citas y listas.') },
        { name: 'image', label: 'Foto principal', type: 'upload', relationTo: 'media',
          ...help('Elige una foto de Imágenes o súbela aquí con «Crear» (o arrastrándola): pide descripción, autoría, derechos y la declaración de derechos.') },
      ] },
      { label: 'Clasificación', fields: [
        { name: 'author', label: 'Autor', type: 'relationship', relationTo: 'authors', required: true,
          defaultValue: ({ user }: { user?: { author?: number | { id: number } | null } | null }) => (user?.author && typeof user.author === 'object' ? user.author.id : user?.author) ?? undefined,
          ...help('La firma de la noticia. Si tu cuenta tiene una firma vinculada, ya viene puesta.') },
        { name: 'town', label: 'Concejo', type: 'relationship', relationTo: 'towns', required: true, ...help('El concejo del que trata. Decide en qué página de concejo puede salir.') },
        { name: 'section', label: 'Sección', type: 'relationship', relationTo: 'sections', required: true, ...help('Sección de la web (Sociedad, Deportes, Opinión, Agenda…).') },
        { name: 'opinion', label: 'Es un artículo de opinión', type: 'checkbox', ...help('Márcalo en columnas y tribunas: se presentan como opinión, no como información.') },
        { name: 'agenda', label: 'Agenda', type: 'group', ...help('Solo para actividades de la sección Agenda: con fecha, aparecen en la agenda de la web hasta que pasan.'), fields: [
          { name: 'eventAt', label: 'Fecha y hora de la actividad', type: 'date', admin: { ...dateTime, description: 'Cuándo empieza la actividad.' } },
          { name: 'place', label: 'Lugar', type: 'text', ...help('Dónde es la actividad (local, calle, pueblo).') },
        ] },
      ] },
      { label: 'Portada', fields: [
        { name: 'main', label: 'Principal', type: 'checkbox', ...help('La noticia grande de la portada. Si hay varias marcadas, sale la más reciente; si no hay ninguna, la última noticia (ni opinión ni agenda).') },
        { name: 'featured', label: 'Destacada', type: 'checkbox', ...help('Entra en el bloque de noticias destacadas de la portada.') },
        { name: 'showInTown', label: 'Mostrar en la página del concejo', type: 'checkbox', defaultValue: true,
          ...help('Desmárcala si la noticia no debe aparecer en la página de su concejo (sigue en portada, sección y buscador).') },
      ] },
      { label: 'Publicación', fields: [
        { name: 'publishedAt', label: 'Fecha de publicación', type: 'date',
          admin: { ...dateTime, description: 'La fecha y hora que se muestran en la noticia. Déjala vacía y se pone sola la hora a la que publiques (ahora). Puedes cambiarla a mano, pero no a una hora futura: para eso está la publicación programada.' } },
        { name: 'scheduledAt', label: 'Publicación programada (opcional)', type: 'date',
          admin: { ...dateTime, description: 'Si pones una fecha y hora futuras y pulsas «Publicar cambios», la noticia no se ve hasta ese momento y entonces sale sola, con esa fecha. Déjalo vacío para publicar ya.' } },
      ] },
      { label: 'Buscadores', fields: [
        { name: 'seoTitle', label: 'Título para buscadores y redes (opcional)', type: 'text', ...help('Si lo dejas vacío, se usa el título.') },
        { name: 'seoDescription', label: 'Descripción para buscadores y redes (opcional)', type: 'textarea', ...help('Si la dejas vacía, se usa la entradilla.') },
        { name: 'seoImage', label: 'Imagen para redes (opcional)', type: 'upload', relationTo: 'media', ...help('Si la dejas vacía, se usa la foto principal.') },
      ] },
      { label: 'Fuente', fields: [
        { type: 'collapsible', label: 'Fuente (opcional)', admin: { initCollapsed: true, description: 'Solo si la noticia procede de otro medio o de una nota de prensa.' }, fields: [
          { name: 'sourceName', label: 'Medio u organismo', type: 'text', ...help('Por ejemplo, el medio original o la entidad que emitió la nota.') },
          { name: 'sourceUrl', label: 'Enlace a la fuente', type: 'text', ...help('Dirección completa, empezando por https://') },
          { name: 'sourceAuthor', label: 'Autor original', type: 'text', ...help('Quién firmaba la información original, si consta.') },
        ] },
      ] },
    ] },
    // Barra lateral: la dirección (slug) y, solo para la administración, los datos de origen.
    { name: 'slug', label: 'Dirección (slug)', type: 'text', unique: true, index: true,
      hooks: { beforeValidate: [articleSlug] },
      admin: { position: 'sidebar', description: 'Se crea sola a partir del título. Puedes cambiarla; se quitan tildes, eñes y espacios, y no se repite.' } },
    { name: 'date', type: 'text', admin: { hidden: true } },
    { ...key, label: 'Identificador de origen', admin: { position: 'sidebar', ...adminOnlyReadOnly } } as Field,
    { name: 'provenance', label: 'Procedencia', type: 'text', admin: { position: 'sidebar', ...adminOnlyReadOnly } },
    loteField,
    // Quién creó la noticia en el CMS (para «Mis borradores» del panel de inicio). Lo pone el servidor.
    { name: 'createdBy', label: 'Creada por', type: 'relationship', relationTo: 'users', index: true,
      admin: { position: 'sidebar', readOnly: true, condition: data => Boolean(data?.id), description: 'Lo pone el sistema al crear la noticia.' },
      // Siempre el usuario de la sesión al crear; después no cambia, envíe lo que envíe el cliente.
      hooks: { beforeChange: [({ operation, req, originalDoc }) => operation === 'create'
        ? (req.user?.collection === 'users' ? req.user.id : null) : (originalDoc?.createdBy ?? null)] } }],
};

const hexColor = (value: unknown) => !value || /^#[0-9a-fA-F]{6}$/.test(String(value)) || 'Usa un color en formato #RRGGBB';
const httpsURL = (value: unknown) => !value || /^https:\/\/\S+$/.test(String(value)) || 'Usa una dirección que empiece por https://';
const sitePath = (value: unknown) => !value || /^\/[a-z0-9-]+\/[a-z0-9.-]+\.(webp|jpg|jpeg|png|svg)$/.test(String(value)) || 'Ruta de un archivo de la web, p. ej. /lena/panorama.webp';
const adminField = { create: adminOnly, update: adminOnly };
const desc = (description: string) => ({ admin: { description } });

/** Identidad visual del espacio: la edita solo la administración; la cuenta municipal la ve en solo lectura. */
const identity: Field = {
  name: 'identity', label: 'Identidad visual', type: 'group', access: adminField,
  admin: { description: 'Foto de cabecera, lema, escudo, colores y enlaces de la página del concejo. Solo la administración puede cambiarlos. Si un campo queda vacío, esa parte usa el diseño neutro.' },
  fields: [
    { name: 'heroImage', label: 'Foto de cabecera', type: 'upload', relationTo: 'media',
      ...desc('Elige o sube una imagen en Imágenes, con su titular y tipo de derechos y el ámbito «Publicable». Sustituye a la foto actual del archivo de la web.') },
    { name: 'heroImagePath', label: 'Foto actual (archivo de la web)', type: 'text', validate: sitePath,
      ...desc('Foto que venía con la web. Se usa solo si no hay foto de cabecera elegida en Imágenes.') },
    { name: 'heroImageAlt', label: 'Descripción de la foto (texto alternativo)', type: 'text' },
    { name: 'heroImageCredit', label: 'Autor y licencia de la foto (texto visible)', type: 'text' },
    { name: 'heroImageSource', label: 'Enlace al original de la foto', type: 'text', validate: httpsURL },
    { name: 'heroImageLicenseUrl', label: 'Enlace a la licencia de la foto', type: 'text', validate: httpsURL },
    { name: 'title', label: 'Lema', type: 'text', ...desc('Frase grande sobre la foto, p. ej. «Lena, un lugar para quedarse.»') },
    { name: 'subtitle', label: 'Subtítulo', type: 'text' },
    { name: 'crestImage', label: 'Escudo', type: 'upload', relationTo: 'media',
      ...desc('Imagen del escudo en Imágenes (JPEG, PNG o WebP), con sus derechos. Sustituye al escudo actual del archivo de la web.') },
    { name: 'crestPath', label: 'Escudo actual (archivo de la web)', type: 'text', validate: sitePath },
    { name: 'crestCredit', label: 'Autor y licencia del escudo (texto visible)', type: 'text' },
    { name: 'crestSource', label: 'Enlace al original del escudo', type: 'text', validate: httpsURL },
    { name: 'crestLicenseUrl', label: 'Enlace a la licencia del escudo', type: 'text', validate: httpsURL },
    { name: 'colors', label: 'Colores', type: 'group', ...desc('Formato #RRGGBB. Hacen falta los cuatro para aplicar el diseño propio del concejo.'), fields: [
      { name: 'accent', label: 'Color principal', type: 'text', validate: hexColor },
      { name: 'dark', label: 'Color oscuro', type: 'text', validate: hexColor },
      { name: 'soft', label: 'Color suave (fondos)', type: 'text', validate: hexColor },
      { name: 'border', label: 'Color de bordes', type: 'text', validate: hexColor },
    ] },
    { name: 'official', label: 'Web oficial del ayuntamiento', type: 'text', validate: httpsURL },
    { name: 'tourism', label: 'Web de turismo', type: 'text', validate: httpsURL },
    { name: 'stories', label: 'Historias destacadas', type: 'array', maxRows: 3, ...desc('Hasta tres enlaces bajo las noticias («… todo el año»).'), fields: [
      { name: 'label', label: 'Etiqueta', type: 'text', required: true },
      { name: 'title', label: 'Título', type: 'text', required: true },
      { name: 'text', label: 'Texto', type: 'textarea', required: true },
      { name: 'href', label: 'Enlace', type: 'text', required: true,
        validate: (value: unknown) => /^(https:\/\/\S+|\/[^\s]*)$/.test(String(value ?? '')) || 'Usa https://… o una ruta de la web que empiece por /' },
    ] },
  ],
};

export const MunicipalSpaces: CollectionConfig = {
  slug: 'municipal-spaces', admin: { useAsTitle: 'name' },
  versions: { drafts: true },
  access: { read: municipalSpaceRead, readVersions: editorialVersions, create: adminOnly, update: adminOnly, delete: adminOnly },
  // Las fotos de la identidad de un espacio publicado son públicas (copia pública, como las de las noticias).
  hooks: { beforeChange: [validateImages], afterChange: [syncLinkedMedia], afterDelete: [syncLinkedMediaAfterDelete] },
  fields: [key, text('name', true), { name: 'town', type: 'relationship', relationTo: 'towns', required: true, unique: true },
    text('medium', true),
    { name: 'subscription', type: 'group', fields: [
      { name: 'status', type: 'select', required: true, options: ['demo', 'active', 'inactive'] }, text('startsAt'), text('endsAt')] },
    { name: 'contact', type: 'group', fields: [text('place'), text('hours'), { name: 'note', type: 'textarea' }] }, identity, ...provenance,
    // Estado de la suscripción antes de activar el espacio para el ensayo; lo restaura cms:ensayo:retirar.
    { name: 'ensayoPrevio', label: 'Estado previo al ensayo', type: 'json', access: { read: adminOnly, create: adminOnly, update: adminOnly }, admin: { hidden: true } }],
};

export const MunicipalContent: CollectionConfig = {
  slug: 'municipal-content', admin: { useAsTitle: 'title', defaultColumns: ['title', 'space', '_status', 'withdrawal.withdrawn', 'updatedAt'] }, ...published,
  access: { create: municipalContentCreate, read: municipalContentRead, readVersions: municipalContentVersions, update: municipalContentUpdate, delete: editorialUser },
  hooks: { ...published.hooks, beforeOperation: [withdrawalAppliesToLiveDocument], beforeChange: [rememberMainState, municipalRules, validateImages] },
  fields: [key, { name: 'space', type: 'relationship', relationTo: 'municipal-spaces', required: true },
    { name: 'type', type: 'select', required: true, options: ['news', 'notice', 'event', 'grant', 'announcement'] },
    text('title', true), { name: 'excerpt', type: 'textarea', required: true }, { name: 'body', type: 'textarea', required: true },
    { name: 'origin', type: 'select', required: true, defaultValue: 'municipality', options: ['municipality'] },
    text('publishedAt', true), text('expiresAt'), text('eventAt'), text('place'), text('deadline'),
    { name: 'attachments', type: 'array', fields: [text('url', true), text('title', true)] },
    { name: 'image', type: 'relationship', relationTo: 'media' },
    { name: 'demo', type: 'checkbox', defaultValue: true }, loteField, ...provenance,
    // Withdrawal by Planta 14. Only editors and administrators change it; the municipality reads the reason in its panel.
    { name: 'withdrawal', label: 'Retirada por Planta 14', type: 'group', access: { create: editorialUser, update: editorialUser }, fields: [
      { name: 'withdrawn', label: 'Retirado', type: 'checkbox', defaultValue: false, index: true },
      { name: 'reason', label: 'Motivo', type: 'textarea' },
      { name: 'withdrawnAt', type: 'date', admin: { readOnly: true } },
      { name: 'withdrawnBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    ] }],
};
