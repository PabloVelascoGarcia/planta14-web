import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionBeforeChangeHook, CollectionConfig, CollectionSlug, Payload, PayloadRequest } from 'payload';
import { adminOnly, editorialUser, relationID } from './access';
import { createPendingNotice } from './responsables';

const adminOnlyField = ({ req }: { req: PayloadRequest }) => adminOnly({ req });

/**
 * Registro de auditoría (inmutable) y avisos para Planta 14.
 * Ambos se escriben solo desde hooks del servidor; ninguna cuenta puede crearlos, editarlos ni borrarlos por la API
 * (los avisos solo admiten marcar la revisión).
 */
const auditActions = ['create', 'update', 'publish', 'unpublish', 'withdraw', 'reinstate', 'delete'] as const;
type AuditAction = typeof auditActions[number];

export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  labels: { singular: 'Registro de auditoría', plural: 'Auditoría' },
  admin: { useAsTitle: 'summary', defaultColumns: ['createdAt', 'action', 'targetCollection', 'title', 'userEmail'] },
  access: { read: editorialUser, create: () => false, update: () => false, delete: () => false },
  fields: [
    { name: 'action', type: 'select', required: true, index: true, options: [...auditActions] },
    { name: 'targetCollection', type: 'text', required: true, index: true },
    { name: 'documentID', type: 'text', required: true, index: true },
    { name: 'title', type: 'text' },
    { name: 'summary', type: 'text' },
    { name: 'space', type: 'relationship', relationTo: 'municipal-spaces', index: true },
    { name: 'user', type: 'relationship', relationTo: 'users' },
    // Copied so the record survives the deletion of the account.
    { name: 'userEmail', type: 'text' },
    { name: 'userRole', type: 'text' },
    { name: 'reason', type: 'textarea' },
  ],
};

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  labels: { singular: 'Pendiente de revisar', plural: 'Pendientes de revisar' },
  admin: { useAsTitle: 'title', defaultColumns: ['createdAt', 'title', 'kind', 'assignedTo', 'reviewed', 'emailStatus'],
    description: 'Lo que llega de fuera (publicaciones de los ayuntamientos, fiestas enviadas…), asignado al periodista responsable del concejo. Márcalo como revisado cuando lo hayas atendido.' },
  access: { read: editorialUser, create: () => false, update: editorialUser, delete: () => false },
  fields: [
    { name: 'kind', type: 'select', required: true, defaultValue: 'municipal-publication', options: ['municipal-publication', 'festival-submission', 'letter-submission'], access: { update: () => false } },
    // Periodista responsable del concejo (Concejos → Periodista responsable) cuando llegó el aviso.
    { name: 'assignedTo', label: 'Asignado a', type: 'relationship', relationTo: 'users', index: true, access: { update: adminOnlyField } },
    { name: 'content', type: 'relationship', relationTo: 'municipal-content', access: { update: () => false } },
    { name: 'festival', label: 'Fiesta', type: 'relationship', relationTo: 'festivals', access: { update: () => false } },
    { name: 'letter', label: 'Carta', type: 'relationship', relationTo: 'letters', access: { update: () => false } },
    { name: 'space', type: 'relationship', relationTo: 'municipal-spaces', index: true, access: { update: () => false } },
    { name: 'title', type: 'text', required: true, access: { update: () => false } },
    { name: 'publishedBy', type: 'relationship', relationTo: 'users', access: { update: () => false } },
    // Email delivery is prepared but disabled until a mail provider is contracted.
    { name: 'emailStatus', type: 'select', required: true, defaultValue: 'disabled', options: ['disabled', 'sent', 'failed'], access: { update: () => false } },
    { name: 'reviewed', type: 'checkbox', defaultValue: false, index: true },
  ],
};

type MainState = { status: string | null; withdrawn: boolean };
const stateKey = (collection: string, id: unknown) => `planta14:main:${collection}:${id}`;

async function mainState(req: PayloadRequest, collection: CollectionSlug, id: unknown): Promise<MainState | null> {
  if (id === undefined || id === null) return null;
  const doc = await req.payload.db.findOne<{ id: number | string; _status?: string; withdrawal?: { withdrawn?: boolean | null } }>({ collection, where: { id: { equals: id } }, req });
  return doc ? { status: doc._status ?? null, withdrawn: Boolean(doc.withdrawal?.withdrawn) } : null;
}

/** Captures the stored (non-draft) state before the change, to tell publication from draft saves. */
export const rememberMainState: CollectionBeforeChangeHook = async ({ collection, originalDoc, req, data }) => {
  if (originalDoc?.id !== undefined) req.context[stateKey(collection.slug, originalDoc.id)] = await mainState(req, collection.slug, originalDoc.id);
  return data;
};

function actionFor(before: MainState | null, after: MainState | null, operation: 'create' | 'update'): AuditAction {
  const wasPublished = before?.status === 'published';
  const isPublished = after?.status === 'published';
  if (!before?.withdrawn && after?.withdrawn) return 'withdraw';
  if (before?.withdrawn && after && !after.withdrawn) return 'reinstate';
  if (!wasPublished && isPublished) return 'publish';
  if (wasPublished && !isPublished) return 'unpublish';
  return operation;
}

export async function audit(payload: Payload, req: PayloadRequest, entry: { action: AuditAction; collection: string; doc: Record<string, unknown>; reason?: string | null }) {
  const user = req.user?.collection === 'users' ? req.user : null;
  const title = String(entry.doc.title ?? entry.doc.alt ?? entry.doc.filename ?? entry.doc.email ?? entry.doc.id);
  await payload.create({ collection: 'audit-log', overrideAccess: true, req, data: {
    action: entry.action, targetCollection: entry.collection, documentID: String(entry.doc.id), title,
    summary: `${entry.action} · ${entry.collection} · ${title}`.slice(0, 250),
    space: relationID(entry.doc.space) ?? relationID(entry.doc.uploadedBySpace) ?? undefined,
    user: user?.id, userEmail: user?.email, userRole: user?.role, reason: entry.reason ?? undefined,
  } });
}

export async function sendMunicipalNoticeEmail(payload: Payload, notice: { title: string; spaceName?: string }): Promise<'disabled' | 'sent' | 'failed'> {
  const to = process.env.MUNICIPAL_NOTICE_EMAIL_TO;
  if (process.env.MUNICIPAL_NOTICE_EMAIL_ENABLED !== 'true' || !to) return 'disabled';
  try {
    await payload.sendEmail({ to, subject: `Publicación municipal: ${notice.title}`,
      text: `${notice.spaceName || 'Un ayuntamiento'} ha publicado «${notice.title}». Revísalo en /cms/collections/notifications.` });
    return 'sent';
  } catch (error) {
    payload.logger.error({ err: error, msg: 'No se pudo enviar el aviso municipal por correo' });
    return 'failed';
  }
}

export const auditAfterChange: CollectionAfterChangeHook = async ({ collection, doc, operation, req }) => {
  const versioned = Boolean(collection.versions);
  const before = operation === 'update' && versioned ? (req.context[stateKey(collection.slug, doc.id)] as MainState | null) ?? null : null;
  const after = versioned ? await mainState(req, collection.slug, doc.id) : null;
  const action = versioned ? actionFor(before, after, operation) : operation;
  await audit(req.payload, req, { action, collection: collection.slug, doc, reason: action === 'withdraw' ? doc.withdrawal?.reason : null });
  if (collection.slug === 'municipal-content' && action === 'publish' && req.user?.collection === 'users' && req.user.role === 'municipal') {
    const spaceID = relationID(doc.space);
    const space = spaceID ? await req.payload.findByID({ collection: 'municipal-spaces', id: spaceID, depth: 0, overrideAccess: true, req }) : null;
    const emailStatus = await sendMunicipalNoticeEmail(req.payload, { title: doc.title, spaceName: space?.name });
    // Pendiente asignado al periodista responsable del concejo, que recibe además un correo.
    const townID = relationID(space?.town);
    const town = townID ? await req.payload.findByID({ collection: 'towns', id: townID, depth: 0, overrideAccess: true, req }) : null;
    await createPendingNotice(req.payload, req, { kind: 'municipal-publication', title: doc.title, townID, townName: town?.name, fallbackEmailStatus: emailStatus,
      detail: `${space?.name || 'Un ayuntamiento'} ha publicado en su espacio de Planta 14: «${doc.title}».`,
      data: { content: doc.id, space: spaceID ?? undefined, publishedBy: req.user.id } });
  }
  return doc;
};

export const auditAfterDelete: CollectionAfterDeleteHook = async ({ collection, doc, req }) => {
  await audit(req.payload, req, { action: 'delete', collection: collection.slug, doc });
  return doc;
};
