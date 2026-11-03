import { APIError, type CollectionBeforeChangeHook, type CollectionBeforeOperationHook, type CollectionConfig, type Field } from 'payload';
import { adminOnly, editorialContentRead, editorialUser, editorialVersions, municipalContentCreate, municipalContentRead, municipalContentUpdate,
  municipalContentVersions, municipalSpaceOf, municipalSpaceRead, notMunicipal, relationID } from './access';
import { auditAfterChange, auditAfterDelete, rememberMainState } from './activity';
import { syncLinkedMedia, syncLinkedMediaAfterDelete, validatePublishedImages } from './media-rights';

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
    { name: 'email', type: 'email', access: { read: editorialUser } }, { name: 'avatar', type: 'relationship', relationTo: 'media' }],
};

// Vista previa en vivo con el diseño público (app/(frontend)/vista-previa/noticia/[id]).
const previewURL = ({ data }: { data: { id?: number | string } }) => `${process.env.CMS_SERVER_URL || ''}/vista-previa/noticia/${data?.id ?? ''}`;

export const Articles: CollectionConfig = {
  slug: 'articles', ...published,
  admin: { useAsTitle: 'title', defaultColumns: ['title', '_status', 'date', 'town', 'createdBy'],
    livePreview: { url: previewURL, breakpoints: [{ name: 'movil', label: 'Móvil', width: 390, height: 844 }, { name: 'tableta', label: 'Tableta', width: 820, height: 1180 }, { name: 'escritorio', label: 'Escritorio', width: 1366, height: 900 }] },
    preview: (doc) => previewURL({ data: doc as { id?: number } }) },

  fields: [key, { name: 'slug', type: 'text', unique: true, required: true }, text('title', true),
    { name: 'excerpt', type: 'textarea', required: true },
    { name: 'body', type: 'json', required: true, validate: (value: unknown) => Array.isArray(value) && value.every(p => typeof p === 'string') || 'Usa una lista de párrafos de texto' },
    { name: 'image', type: 'relationship', relationTo: 'media' },
    { name: 'author', type: 'relationship', relationTo: 'authors', required: true },
    { name: 'town', type: 'relationship', relationTo: 'towns', required: true },
    { name: 'section', type: 'relationship', relationTo: 'sections', required: true },
    text('date', true), text('publishedAt'), text('scheduledAt'), text('seoTitle'), { name: 'seoDescription', type: 'textarea' },
    { name: 'seoImage', type: 'relationship', relationTo: 'media' },
    { name: 'featured', type: 'checkbox' }, { name: 'main', type: 'checkbox' }, { name: 'opinion', type: 'checkbox' },
    // Si se desmarca, la noticia sigue publicada (portada, sección, buscador) pero no sale en la página del concejo.
    { name: 'showInTown', label: 'Mostrar en la página del concejo', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
    text('sourceName'), text('sourceAuthor'), ...provenance,
    // Quién creó la noticia en el CMS (para «Mis borradores» del panel de inicio). Lo pone el servidor.
    { name: 'createdBy', label: 'Creada por', type: 'relationship', relationTo: 'users', index: true,
      admin: { position: 'sidebar', readOnly: true },
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
    { name: 'contact', type: 'group', fields: [text('place'), text('hours'), { name: 'note', type: 'textarea' }] }, identity, ...provenance],
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
    { name: 'demo', type: 'checkbox', defaultValue: true }, ...provenance,
    // Withdrawal by Planta 14. Only editors and administrators change it; the municipality reads the reason in its panel.
    { name: 'withdrawal', label: 'Retirada por Planta 14', type: 'group', access: { create: editorialUser, update: editorialUser }, fields: [
      { name: 'withdrawn', label: 'Retirado', type: 'checkbox', defaultValue: false, index: true },
      { name: 'reason', label: 'Motivo', type: 'textarea' },
      { name: 'withdrawnAt', type: 'date', admin: { readOnly: true } },
      { name: 'withdrawnBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    ] }],
};
