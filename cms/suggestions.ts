import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload';
import { adminOnly, editorialUser, municipalSpaceOf, municipalUser, relationID } from './access';

// Buzón de sugerencias del panel municipal: qué servicios de Planta 14 interesarían al ayuntamiento y un texto libre.
// Entra en la bandeja compartida de la redacción («Pendiente de revisar») y avisa al periodista responsable del concejo.
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

// Entra en la bandeja «Pendiente de revisar» de la redacción; aviso solo al periodista responsable del concejo.
const notify: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc;
  const space = await req.payload.findByID({ collection: 'municipal-spaces', id: relationID(doc.space)!, depth: 0, overrideAccess: true, req });
  const services = (doc.services || []).map((value: string) => suggestionServices.find(s => s.value === value)?.label ?? value);
  const { createPendingNotice } = await import('./responsables');
  await createPendingNotice(req.payload, req, { kind: 'suggestion', title: `Sugerencia de ${space.name}`, townID: doc.town,
    detail: `${space.name} ha enviado una sugerencia desde su panel municipal.\n\n${services.length ? `Servicios que le interesan:\n- ${services.join('\n- ')}\n\n` : ''}${doc.text ? `Sugerencia:\n${doc.text}` : ''}`.trim(),
    data: { suggestion: doc.id, space: space.id } }).catch(error => req.payload.logger.error({ err: error, msg: 'No se pudo registrar una sugerencia en la bandeja' }));
  return doc;
};

export const Suggestions: CollectionConfig = {
  slug: 'suggestions',
  labels: { singular: 'Sugerencia', plural: 'Sugerencias' },
  access: {
    create: (args) => municipalUser(args),
    // La bandeja es compartida: toda la redacción las ve (por defecto, primero las de sus concejos).
    read: editorialUser,
    update: adminOnly, delete: adminOnly,
  },
  admin: { useAsTitle: 'summary', defaultColumns: ['summary', 'space', 'services', 'createdAt'],
    description: 'Sugerencias de los ayuntamientos desde su panel. Se resuelven en la bandeja «Pendiente de revisar» (/cms/bandeja); avisan al periodista responsable del concejo.' },
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
