import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';
import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionConfig, type FieldHook, type Payload, type PayloadRequest } from 'payload';
import { adminOnly, editorialUser, relationID } from './access';
import { emailAvailable } from './email';
import { lettersEnabled } from './site-globals';

// Cartas de los lectores. Llegan por /cartas/enviar (confirmación del correo con enlace), entran como pendiente para
// el periodista responsable del concejo, que las aprueba (y edita) o las rechaza con un motivo que se envía al autor.
// DNI y teléfono: cifrados (AES-256-GCM), solo los ven la administración y el periodista del concejo, nunca son
// públicos y se borran a los 24 meses.

const keys = () => {
  const secret = process.env.PAYLOAD_SECRET;
  if (!secret) throw new Error('Falta PAYLOAD_SECRET');
  const derive = (info: string) => Buffer.from(hkdfSync('sha256', secret, 'planta14-cartas', info, 32));
  return { data: derive('datos-personales-v1'), person: derive('huella-persona-v1') };
};
export function encryptPersonal(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keys().data, iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`;
}
export function decryptPersonal(value?: string | null) {
  if (!value?.startsWith('v1:')) return null;
  const raw = Buffer.from(value.slice(3), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', keys().data, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}
/** Huella de la persona (DNI normalizado) para el límite de una carta al mes; no permite recuperar el DNI. */
export const personKey = (dni: string) => createHmac('sha256', keys().person).update(normalizeDNI(dni)).digest('hex');
export const normalizeDNI = (dni: string) => dni.toUpperCase().replace(/[\s.-]/g, '');
/** DNI (8 cifras y letra) o NIE (X/Y/Z, 7 cifras y letra) con la letra de control correcta. */
export function validDNI(value: string) {
  const dni = normalizeDNI(value);
  const match = /^([XYZ]?)(\d{7,8})([A-Z])$/.exec(dni);
  if (!match || (match[1] ? match[2].length !== 7 : match[2].length !== 8)) return false;
  const number = Number(`${'XYZ'.indexOf(match[1]) >= 0 && match[1] ? 'XYZ'.indexOf(match[1]) : ''}${match[2]}`);
  return 'TRWAGMYFPDXBNJZSQVHLCKE'[number % 23] === match[3];
}
export const PERSONAL_DATA_MONTHS = 24;
export const LETTER_MAX_LENGTH = 2000;

/** ¿Puede ver DNI y teléfono? La administración y el periodista responsable del concejo de la carta. */
export async function canSeePersonal(req: PayloadRequest, townID: unknown) {
  if (adminOnly({ req })) return true;
  if (!editorialUser({ req })) return false;
  const id = relationID(townID);
  if (id === null) return false;
  const town = await req.payload.findByID({ collection: 'towns', id, depth: 0, overrideAccess: true, req }).catch(() => null);
  return relationID(town?.responsible) === req.user!.id;
}
const reveal = (field: 'dniEnc' | 'phoneEnc'): FieldHook => async ({ siblingData, req }) => {
  if (!siblingData?.id || !await canSeePersonal(req, siblingData.town)) return undefined;
  // El campo cifrado no se entrega por la API: se lee de la base de datos solo para quien puede verlo.
  const stored = siblingData[field] ?? (await req.payload.db.findOne<{ id: number } & Record<string, string | null>>({ collection: 'letters', where: { id: { equals: siblingData.id } }, req }))?.[field];
  return decryptPersonal(stored) ?? undefined;
};

/** Borra DNI y teléfono de las cartas de hace más de 24 meses. Devuelve cuántas. */
export async function eraseExpiredPersonalData(payload: Payload, now = new Date()) {
  const limit = new Date(now); limit.setMonth(limit.getMonth() - PERSONAL_DATA_MONTHS);
  const expired = await payload.find({ collection: 'letters', overrideAccess: true, pagination: false, depth: 0,
    where: { and: [{ createdAt: { less_than: limit.toISOString() } }, { personalDataErasedAt: { exists: false } }] } });
  for (const letter of expired.docs) {
    await payload.update({ collection: 'letters', id: letter.id, overrideAccess: true, context: { system: true },
      data: { dniEnc: null, phoneEnc: null, personalDataErasedAt: now.toISOString() } as never });
  }
  return expired.docs.length;
}

const decision: CollectionBeforeChangeHook = ({ data, originalDoc, req, operation }) => {
  const merged = { ...originalDoc, ...data };
  data.summary = `${merged.firstName ?? ''} ${merged.lastName ?? ''} · ${String(merged.title || merged.text || '').replace(/\s+/g, ' ').slice(0, 60)}`;
  if (operation !== 'update' || req.context.system) return data;
  const status = data.status ?? originalDoc?.status;
  if (status !== originalDoc?.status) {
    if (originalDoc?.status === 'sin-confirmar' && !adminOnly({ req })) throw new APIError('Esta carta aún no tiene el correo confirmado', 400);
    if (status === 'rechazada' && !String(data.rejectionReason ?? originalDoc?.rejectionReason ?? '').trim()) throw new APIError('Escribe el motivo del rechazo: se enviará al autor de la carta', 400);
    if (status === 'aprobada' && !originalDoc?.publishedAt) data.publishedAt = new Date().toISOString();
    if (['aprobada', 'rechazada'].includes(status)) Object.assign(data, { decidedBy: req.user?.id ?? null, decidedAt: new Date().toISOString() });
  }
  return data;
};
const tellAuthor: CollectionAfterChangeHook = async ({ doc, previousDoc, req, operation }) => {
  if (operation !== 'update' || req.context.system || doc.status === previousDoc?.status || !emailAvailable()) return doc;
  const site = (process.env.SITE_URL || process.env.CMS_SERVER_URL || '').replace(/\/$/, '');
  const greeting = `Hola, ${doc.firstName}:`;
  const text = doc.status === 'rechazada'
    ? `${greeting}\n\nGracias por escribir a Planta 14. Tu carta no se va a publicar por este motivo:\n\n${doc.rejectionReason}\n\nPuedes consultar las normas de las cartas en ${site}/normas-cartas.\n\n— Redacción de Planta 14`
    : doc.status === 'aprobada' ? `${greeting}\n\nTu carta se ha publicado en Planta 14, en Opinión → Cartas de los lectores:\n${site}/cartas\n\nGracias por escribirnos.\n\n— Redacción de Planta 14` : null;
  if (text) await req.payload.sendEmail({ to: doc.email, subject: doc.status === 'rechazada' ? 'Tu carta a Planta 14 no se publicará' : 'Tu carta se ha publicado en Planta 14', text })
    .catch(error => req.payload.logger.error({ err: error, msg: 'No se pudo avisar al autor de una carta' }));
  return doc;
};

const editorialOnly = { read: editorialUser, create: () => false, update: editorialUser };
const hidden = { read: () => false, create: () => false, update: () => false };
const help = (description: string) => ({ admin: { description } });

export const Letters: CollectionConfig = {
  slug: 'letters',
  labels: { singular: 'Carta', plural: 'Cartas de los lectores' },
  access: {
    // El público solo ve las aprobadas (y solo nombre, apellidos, concejo, título, texto y fecha).
    // Con «Cartas activas» desactivado solo la administración la ve (la redacción ni siquiera la tiene en el menú).
    read: async (args) => adminOnly(args) || (await lettersEnabled(args.req.payload) && (editorialUser(args) || { status: { equals: 'aprobada' } })),
    create: () => false, update: async (args) => adminOnly(args) || (editorialUser(args) && await lettersEnabled(args.req.payload)), delete: adminOnly,
  },
  admin: { useAsTitle: 'summary', defaultColumns: ['summary', 'town', 'status', 'createdAt'],
    description: 'Cartas enviadas desde /cartas/enviar. Al confirmar el correo llegan a «Pendientes de revisar» del periodista del concejo. Apruébala (puedes editar el texto) o recházala con un motivo, que se envía al autor.' },
  hooks: { beforeChange: [decision], afterChange: [tellAuthor] },
  fields: [
    { name: 'summary', label: 'Carta', type: 'text', access: { read: editorialUser, create: () => false, update: () => false }, admin: { hidden: true } },
    { name: 'status', label: 'Estado', type: 'select', required: true, defaultValue: 'sin-confirmar', index: true,
      options: [{ label: 'Sin confirmar el correo', value: 'sin-confirmar' }, { label: 'Pendiente de revisar', value: 'pendiente' }, { label: 'Aprobada (publicada)', value: 'aprobada' }, { label: 'Rechazada', value: 'rechazada' }],
      admin: { position: 'sidebar', description: 'Aprobada: sale en Opinión → Cartas de los lectores. Rechazada: escribe el motivo; se envía al autor.' } },
    { name: 'rejectionReason', label: 'Motivo del rechazo', type: 'textarea', access: editorialOnly,
      admin: { position: 'sidebar', condition: data => data?.status === 'rechazada', description: 'Se envía por correo al autor. Sé breve y cita la norma que no cumple.' } },
    { name: 'title', label: 'Título (opcional, lo pone la redacción)', type: 'text', maxLength: 120 },
    { name: 'text', label: 'Texto de la carta', type: 'textarea', required: true, maxLength: LETTER_MAX_LENGTH, ...help('Puedes corregir erratas o acortarla siguiendo las normas. El texto original se guarda abajo.') },
    { type: 'row', fields: [
      { name: 'firstName', label: 'Nombre', type: 'text', required: true, access: { create: () => false, update: editorialUser } },
      { name: 'lastName', label: 'Apellidos', type: 'text', required: true, access: { create: () => false, update: editorialUser } },
    ] },
    { name: 'town', label: 'Concejo', type: 'relationship', relationTo: 'towns', required: true, index: true, access: { create: () => false, update: adminOnly } },
    { name: 'email', label: 'Correo (no se publica)', type: 'email', required: true, access: { read: editorialUser, create: () => false, update: () => false } },
    { name: 'dni', label: 'DNI o NIE (no se publica)', type: 'text', virtual: true, access: { read: editorialUser, create: () => false, update: () => false },
      admin: { readOnly: true, description: 'Cifrado. Solo lo ven la administración y el periodista responsable del concejo. Se borra a los 24 meses.' }, hooks: { afterRead: [reveal('dniEnc')] } },
    { name: 'phone', label: 'Teléfono (no se publica)', type: 'text', virtual: true, access: { read: editorialUser, create: () => false, update: () => false },
      admin: { readOnly: true, description: 'Cifrado. Solo lo ven la administración y el periodista responsable del concejo. Se borra a los 24 meses.' }, hooks: { afterRead: [reveal('phoneEnc')] } },
    { name: 'originalText', label: 'Texto original enviado', type: 'textarea', access: { read: editorialUser, create: () => false, update: () => false }, admin: { readOnly: true } },
    { name: 'publishedAt', label: 'Publicada el', type: 'date', admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' } } },
    { name: 'decidedBy', label: 'Decidida por', type: 'relationship', relationTo: 'users', access: editorialOnly, admin: { position: 'sidebar', readOnly: true } },
    { name: 'decidedAt', label: 'Decidida el', type: 'date', access: editorialOnly, admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' } } },
    { name: 'personalDataErasedAt', label: 'DNI y teléfono borrados el', type: 'date', access: editorialOnly, admin: { position: 'sidebar', readOnly: true, condition: data => Boolean(data?.personalDataErasedAt) } },
    { name: 'dniEnc', type: 'text', access: hidden, admin: { hidden: true } },
    { name: 'phoneEnc', type: 'text', access: hidden, admin: { hidden: true } },
    { name: 'personKey', type: 'text', index: true, access: hidden, admin: { hidden: true } },
    { name: 'tokenHash', type: 'text', index: true, access: hidden, admin: { hidden: true } },
    { name: 'tokenExpiresAt', type: 'date', access: hidden, admin: { hidden: true } },
  ],
};
