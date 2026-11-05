import { createHash, randomBytes } from 'node:crypto';
import { APIError, type Access, type CollectionBeforeChangeHook, type CollectionConfig, type Endpoint, type FieldHook, type Payload } from 'payload';
import { BoldFeature, FixedToolbarFeature, HeadingFeature, InlineToolbarFeature, ItalicFeature, LinkFeature, OrderedListFeature, ParagraphFeature, UnorderedListFeature, lexicalEditor } from '@payloadcms/richtext-lexical';
import { editorialUser, editorialVersions, notMunicipal, publishedFilter, relationID } from './access';
import { auditAfterChange, auditAfterDelete, rememberMainState } from './activity';
import { syncLinkedMedia, syncLinkedMediaAfterDelete, validatePublishedImages } from './media-rights';
import { toLexical } from '../lib/rich-text';
import { slugText } from './content-collections';

// Fiestas de las Cuencas. Las crea la redacción o llegan por el formulario público «Envía tu fiesta» (borrador,
// confirmado por correo y asignado al periodista responsable del concejo). El cartel es una imagen normal de
// Imágenes (campo `image`): sus derechos y su copia pública funcionan igual que en las noticias.

/** Día de Madrid (AAAA-MM-DD) de una fecha del selector; se guarda a las 12:00 UTC para que no cambie de día. */
export function madridDay(value: unknown): string | null {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(date);
}
export const dayToStored = (day: string) => `${day}T12:00:00.000Z`;
export function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}
export const festivalSlug = (name: string, village: string, day: string) =>
  `${name} ${village} ${day.slice(0, 4)}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90).replace(/-+$/, '');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(24).toString('base64url');

const festivalEditor = lexicalEditor({ features: () => [ParagraphFeature(), BoldFeature(), ItalicFeature(), LinkFeature({ enabledCollections: [] }),
  HeadingFeature({ enabledHeadingSizes: ['h3'] }), UnorderedListFeature(), OrderedListFeature(), FixedToolbarFeature(), InlineToolbarFeature()] });
const help = (description: string) => ({ admin: { description } });
const dateDay = { date: { pickerAppearance: 'dayOnly' as const, displayFormat: 'dd/MM/yyyy' } };
const editorialOnly = { read: editorialUser, create: editorialUser, update: editorialUser };
export const dateStatusOptions = [
  { label: 'Confirmada', value: 'confirmada' }, { label: 'Fecha pendiente', value: 'pendiente' }, { label: 'Fecha orientativa (2025), sin confirmar', value: 'orientativa' },
];
/** Público: solo fiestas publicadas y con la fecha confirmada. La redacción lo ve todo. */
const festivalsRead: Access = (args) => editorialUser(args) || (notMunicipal(args) ? { and: [publishedFilter, { dateStatus: { equals: 'confirmada' } }] } : false);

/**
 * Fechas y dirección: días de Madrid, fin ≥ inicio, slug del nombre, pueblo y año (único). Con «Estado de la fecha»
 * distinto de «Confirmada» (catálogo sin fecha o con fecha orientativa de otro año) la fiesta no lleva fechas y no se
 * puede publicar: nunca sale en la web ni en la agenda hasta que la redacción confirme las fechas.
 */
const festivalRules: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const status = String(data.dateStatus ?? originalDoc?.dateStatus ?? 'confirmada');
  const start = madridDay(data.startDate !== undefined ? data.startDate : originalDoc?.startDate);
  const end = madridDay(data.endDate !== undefined ? data.endDate : originalDoc?.endDate) ?? start;
  const publishing = (data._status ?? originalDoc?._status) === 'published';
  if (publishing && status !== 'confirmada') throw new APIError('Para publicar la fiesta, confirma sus fechas: pon «Estado de la fecha» en «Confirmada» y rellena el primer y el último día', 400);
  if (status === 'confirmada' && !start) throw new APIError('Indica la fecha de inicio de la fiesta (o marca «Fecha pendiente»)', 400);
  if (start && end! < start) throw new APIError('La fecha de fin no puede ser anterior a la de inicio', 400);
  if (start) Object.assign(data, { startDate: dayToStored(start), endDate: dayToStored(end!), startDay: start, endDay: end });
  else Object.assign(data, { startDate: null, endDate: null, startDay: null, endDay: null });
  const name = String(data.name ?? originalDoc?.name ?? ''), village = String(data.village ?? originalDoc?.village ?? '');
  const wanted = String(data.slug || originalDoc?.slug || festivalSlug(name, village, start ?? ''));
  let slug = slugText(wanted) || festivalSlug(name, village, start ?? '');
  for (let n = 2; ; n++) {
    const clash = await req.payload.find({ collection: 'festivals', where: { and: [{ slug: { equals: slug } }, ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : [])] }, limit: 1, depth: 0, overrideAccess: true, draft: true, req });
    if (!clash.docs.length) break;
    slug = `${slug.replace(/-\d+$/, '')}-${n}`;
  }
  data.slug = slug;
  await validatePublishedImages({ ...originalDoc, ...data }, req);
  return data;
};
const toRich: FieldHook = ({ value }) => toLexical(value) ?? value;

/** Copia como borrador para el año siguiente: mismas fechas en el mismo día de la semana (+52 semanas). */
export async function duplicateForNextYear(payload: Payload, id: number, user: unknown) {
  const source = await payload.findByID({ collection: 'festivals', id, depth: 0, overrideAccess: true, draft: true });
  if (!source.startDate || source.dateStatus !== 'confirmada') throw new APIError('Esta fiesta no tiene fechas confirmadas: confírmalas antes de duplicarla para el año siguiente', 400);
  const start = madridDay(source.startDate)!, end = madridDay(source.endDate)!;
  const nextStart = addDays(start, 364), nextEnd = addDays(end, 364);
  return payload.create({ collection: 'festivals', overrideAccess: true, draft: true, user: user as never, data: {
    name: source.name, village: source.village, town: relationID(source.town)!, startDate: dayToStored(nextStart), endDate: dayToStored(nextEnd),
    program: source.program, organizer: source.organizer, contact: source.contact, recurring: true, origin: 'redaccion',
    image: null, chronicle: null, slug: festivalSlug(source.name, source.village, nextStart), _status: 'draft' } as never });
}

const nextYearEndpoint: Endpoint = {
  path: '/:id/siguiente-ano', method: 'post',
  handler: async (req) => {
    if (!editorialUser({ req })) return Response.json({ error: 'No autorizado' }, { status: 403 });
    const id = relationID(req.routeParams?.id);
    if (id === null) return Response.json({ error: 'Fiesta no válida' }, { status: 400 });
    const copy = await duplicateForNextYear(req.payload, id, req.user);
    return Response.json({ id: copy.id, startDay: copy.startDay, endDay: copy.endDay });
  },
};

export const Festivals: CollectionConfig = {
  slug: 'festivals',
  labels: { singular: 'Fiesta', plural: 'Fiestas' },
  versions: { drafts: true },
  access: { create: editorialUser, read: festivalsRead, readVersions: editorialVersions, update: editorialUser, delete: editorialUser },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'village', 'town', 'startDate', 'dateStatus', '_status', 'origin'],
    description: 'Fiestas de las Cuencas: salen en /fiestas, en la agenda, en la página de su concejo y, el fin de semana, en la portada. Las que envían comisiones y asociaciones llegan como borrador a «Pendientes de revisar».' },
  endpoints: [nextYearEndpoint],
  hooks: {
    beforeChange: [rememberMainState, festivalRules],
    afterChange: [syncLinkedMedia, auditAfterChange],
    afterDelete: [syncLinkedMediaAfterDelete, auditAfterDelete],
  },
  fields: [
    { name: 'name', label: 'Nombre de la fiesta', type: 'text', required: true, ...help('Por ejemplo: San Juan, El Carmen, Fiestas de Santa Bárbara.') },
    { name: 'village', label: 'Pueblo o barrio', type: 'text', required: true, ...help('Dónde se celebra: pueblo, parroquia o barrio.') },
    { name: 'town', label: 'Concejo', type: 'relationship', relationTo: 'towns', required: true, index: true, ...help('Decide en qué página de concejo sale y quién la revisa.') },
    { type: 'row', fields: [
      { name: 'startDate', label: 'Primer día', type: 'date', admin: { ...dateDay, description: 'Día en que empieza. Obligatorio con la fecha confirmada.' } },
      { name: 'endDate', label: 'Último día', type: 'date', admin: { ...dateDay, description: 'Día en que termina (el mismo si dura un día).' } },
    ] },
    { name: 'dateStatus', label: 'Estado de la fecha', type: 'select', required: true, defaultValue: 'confirmada', index: true, options: dateStatusOptions,
      admin: { description: 'Solo con «Confirmada» y las fechas rellenas se puede publicar. Las fiestas del catálogo entran con «Fecha pendiente» o «Fecha orientativa (2025)».' } },
    { name: 'referenceDates', label: 'Fecha orientativa (2025)', type: 'textarea', maxLength: 1000, access: editorialOnly,
      admin: { condition: data => Boolean(data?.referenceDates), description: 'Solo de referencia: fechas documentadas en 2025. No se publican ni se trasladan a otro año.' } },
    { name: 'usualDates', label: 'Fechas habituales', type: 'textarea', maxLength: 600, access: editorialOnly, ...help('Cuándo se celebra normalmente, según las fuentes (no se publica).') },
    { name: 'description', label: 'Descripción', type: 'textarea', maxLength: 1000, ...help('Una o dos frases sobre la fiesta. Sale en la ficha.') },
    { name: 'program', label: 'Programa', type: 'richText', editor: festivalEditor, hooks: { beforeValidate: [toRich] },
      ...help('Actos por días y horas. Puedes usar negrita, listas y enlaces.') },
    { name: 'image', label: 'Cartel (opcional)', type: 'upload', relationTo: 'media',
      ...help('Se ve pequeño y enmarcado en la ficha; nunca en los listados. Súbelo con «Crear» y marca la declaración de derechos.') },
    { name: 'chronicle', label: 'Crónica', type: 'relationship', relationTo: 'articles', ...help('Cuando se publique la crónica de la fiesta, enlázala aquí.') },
    { name: 'recurring', label: 'Se repite cada año', type: 'checkbox', defaultValue: true, ...help('Las fiestas que se repiten se pueden duplicar para el año siguiente con un clic.') },
    { name: 'organizer', label: 'Organiza (no se publica)', type: 'text', access: editorialOnly, ...help('Comisión de fiestas, asociación… Solo lo ve la redacción.') },
    { name: 'contact', label: 'Contacto (no se publica)', type: 'textarea', access: editorialOnly, ...help('Teléfono o correo de la organización. Solo lo ve la redacción.') },
    { name: 'origin', label: 'Origen', type: 'select', defaultValue: 'redaccion', options: [{ label: 'Redacción', value: 'redaccion' }, { label: 'Enviada por el público', value: 'publico' }],
      access: { read: editorialUser, create: () => false, update: () => false }, admin: { position: 'sidebar', readOnly: true } },
    { name: 'submission', label: 'Envío del público', type: 'group', access: { read: editorialUser, create: () => false, update: () => false },
      admin: { position: 'sidebar', readOnly: true, condition: data => data?.origin === 'publico' }, fields: [
        { name: 'name', label: 'Quién la envía', type: 'text' },
        { name: 'email', label: 'Correo', type: 'email' },
        { name: 'confirmed', label: 'Correo confirmado', type: 'checkbox', defaultValue: false, index: true },
        { name: 'confirmedAt', label: 'Confirmado el', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' } } },
        { name: 'tokenHash', type: 'text', index: true, admin: { hidden: true } },
        { name: 'tokenExpiresAt', type: 'date', admin: { hidden: true } },
      ] },
    { name: 'sources', label: 'Fuentes (no se publican)', type: 'array', access: editorialOnly, labels: { singular: 'Fuente', plural: 'Fuentes' },
      fields: [{ name: 'url', label: 'Dirección', type: 'text', required: true, maxLength: 500 }, { name: 'title', label: 'Título', type: 'text', maxLength: 300 }] },
    { name: 'catalogNotes', label: 'Notas del catálogo (no se publican)', type: 'textarea', maxLength: 4000, access: editorialOnly,
      admin: { condition: data => Boolean(data?.catalogNotes), description: 'Actos habituales, carteles, dudas y verificación según el catálogo de fiestas.' } },
    { name: 'externalID', label: 'Identificador del catálogo', type: 'text', unique: true, index: true, access: editorialOnly, admin: { position: 'sidebar', readOnly: true } },
    { name: 'slug', label: 'Dirección (slug)', type: 'text', unique: true, index: true, admin: { position: 'sidebar', description: 'Se crea sola: nombre, pueblo y año.' } },
    { name: 'startDay', type: 'text', index: true, admin: { hidden: true } },
    { name: 'endDay', type: 'text', index: true, admin: { hidden: true } },
    { name: 'nextYear', type: 'ui', admin: { position: 'sidebar', components: { Field: '/components/festival-next-year#FestivalNextYear' } } },
  ],
};
