import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload';
import { adminOnly, editorialUser, municipalSpaceOf, municipalUser, relationID } from './access';
import { emailAvailable } from './email';

// Buzón de sugerencias del panel municipal: qué servicios de Planta 14 interesarían al ayuntamiento y un texto libre.
// Lo ven la administración y el periodista responsable del concejo; a ambos les llega un correo.
export const suggestionServices = [
  { label: 'Campañas y publicidad institucional en Planta 14', value: 'publicidad' },
  { label: 'Boletín por correo para los vecinos del concejo', value: 'boletin' },
  { label: 'Informes de visitas de nuestro espacio', value: 'estadisticas' },
  { label: 'Cobertura de actos y eventos del concejo', value: 'cobertura' },
  { label: 'Agenda cultural y deportiva ampliada', value: 'agenda' },
  { label: 'Formación para publicar en el panel', value: 'formacion' },
  { label: 'Avisos urgentes a los vecinos (correo o móvil)', value: 'avisos-urgentes' },
] as const;

const fromMunicipality: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data;
  const space = municipalSpaceOf(req);
  if (space === null && !adminOnly({ req })) throw new APIError('Solo las cuentas municipales envían sugerencias', 403);
  const spaceID = space ?? relationID(data.space);
  const spaceDoc = spaceID ? await req.payload.findByID({ collection: 'municipal-spaces', id: spaceID, depth: 1, overrideAccess: true, req }) : null;
  if (!spaceDoc) throw new APIError('Espacio municipal no válido', 400);
  const town = typeof spaceDoc.town === 'object' ? spaceDoc.town : null;
  if (!String(data.text ?? '').trim() && !(data.services ?? []).length) throw new APIError('Marca algún servicio o escribe tu sugerencia', 400);
  return { ...data, space: spaceDoc.id, town: town?.id ?? null, assignedTo: relationID(town?.responsible) ?? null, createdBy: req.user?.id ?? null };
};

const notify: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create' || !emailAvailable()) return doc;
  const admins = (await req.payload.find({ collection: 'users', where: { role: { equals: 'admin' } }, pagination: false, depth: 0, overrideAccess: true, req })).docs.map(u => u.email);
  const responsible = doc.assignedTo ? await req.payload.findByID({ collection: 'users', id: relationID(doc.assignedTo)!, depth: 0, overrideAccess: true, req }).catch(() => null) : null;
  const space = await req.payload.findByID({ collection: 'municipal-spaces', id: relationID(doc.space)!, depth: 0, overrideAccess: true, req });
  const services = (doc.services || []).map((value: string) => suggestionServices.find(s => s.value === value)?.label ?? value);
  const to = [...new Set([...admins, ...(responsible ? [responsible.email] : [])])];
  if (!to.length) return doc;
  await req.payload.sendEmail({ to: to.join(', '), subject: `Sugerencia de ${space.name}`,
    text: `${space.name} ha enviado una sugerencia desde su panel municipal.\n\n${services.length ? `Servicios que le interesan:\n- ${services.join('\n- ')}\n\n` : ''}${doc.text ? `Sugerencia:\n${doc.text}\n\n` : ''}` +
      `Verla en el CMS: ${(process.env.CMS_SERVER_URL || '').replace(/\/$/, '')}/cms/collections/suggestions/${doc.id}\n\n— Planta 14` })
    .catch(error => req.payload.logger.error({ err: error, msg: 'No se pudo avisar de una sugerencia' }));
  return doc;
};

export const Suggestions: CollectionConfig = {
  slug: 'suggestions',
  labels: { singular: 'Sugerencia', plural: 'Sugerencias' },
  access: {
    create: (args) => municipalUser(args),
    // Administración: todas. Periodista: las de los concejos de los que es responsable.
    read: (args) => adminOnly(args) || (editorialUser(args) ? { assignedTo: { equals: args.req.user!.id } } : false),
    update: adminOnly, delete: adminOnly,
  },
  admin: { useAsTitle: 'summary', defaultColumns: ['summary', 'space', 'services', 'createdAt'],
    description: 'Sugerencias de los ayuntamientos desde su panel. Las ven la administración y el periodista responsable del concejo.' },
  hooks: { beforeChange: [fromMunicipality, ({ data, originalDoc }) => {
    const merged = { ...originalDoc, ...data };
    data.summary = String(merged.text || (merged.services || []).join(', ') || 'Sugerencia').replace(/\s+/g, ' ').slice(0, 80);
    return data;
  }], afterChange: [notify] },
  fields: [
    { name: 'summary', label: 'Sugerencia', type: 'text', admin: { hidden: true } },
    { name: 'space', label: 'Espacio municipal', type: 'relationship', relationTo: 'municipal-spaces', index: true, admin: { readOnly: true } },
    { name: 'town', label: 'Concejo', type: 'relationship', relationTo: 'towns', index: true, admin: { readOnly: true } },
    { name: 'services', label: 'Servicios que le interesan', type: 'select', hasMany: true, options: [...suggestionServices] },
    { name: 'text', label: 'Sugerencia', type: 'textarea', maxLength: 2000 },
    { name: 'assignedTo', label: 'Periodista del concejo', type: 'relationship', relationTo: 'users', index: true, admin: { readOnly: true } },
    { name: 'createdBy', label: 'Enviada por', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
};
