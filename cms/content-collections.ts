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

export const Articles: CollectionConfig = {
  slug: 'articles', admin: { useAsTitle: 'title' }, ...published,
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
    text('sourceName'), text('sourceAuthor'), ...provenance],
};

export const MunicipalSpaces: CollectionConfig = {
  slug: 'municipal-spaces', admin: { useAsTitle: 'name' },
  versions: { drafts: true },
  access: { read: municipalSpaceRead, readVersions: editorialVersions, create: adminOnly, update: adminOnly, delete: adminOnly },
  fields: [key, text('name', true), { name: 'town', type: 'relationship', relationTo: 'towns', required: true, unique: true },
    text('medium', true),
    { name: 'subscription', type: 'group', fields: [
      { name: 'status', type: 'select', required: true, options: ['demo', 'active', 'inactive'] }, text('startsAt'), text('endsAt')] },
    { name: 'contact', type: 'group', fields: [text('place'), text('hours'), { name: 'note', type: 'textarea' }] }, ...provenance],
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
