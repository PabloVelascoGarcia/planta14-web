import type { CollectionConfig, Endpoint } from 'payload';
import { adminOnly } from './access';

// Suscriptores del boletín. Solo la administración los ve, edita y exporta. Se crean y confirman únicamente desde
// el formulario público (acciones del servidor en app/(frontend)/boletin), con doble confirmación por correo.
export const topicOptions = [
  { label: 'Qué hacer este finde', value: 'finde' },
  { label: 'Avisos de mi concejo', value: 'avisos' },
] as const;
/** Texto exacto que acepta quien se suscribe (se guarda con cada alta). */
export const consentText = 'v1 · Acepto recibir por correo el boletín de Planta 14 con los contenidos y concejos elegidos. Puedo darme de baja en cualquier momento desde el enlace de cada correo. Política de privacidad: /privacidad.';

const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const exportEndpoint: Endpoint = {
  path: '/exportar', method: 'get',
  handler: async (req) => {
    if (!adminOnly({ req })) return new Response('No autorizado', { status: 403 });
    const status = new URL(req.url || 'http://x').searchParams.get('estado');
    const result = await req.payload.find({ collection: 'subscribers', depth: 1, pagination: false, overrideAccess: true, sort: 'createdAt',
      where: status ? { status: { equals: status } } : undefined });
    const rows = [['correo', 'estado', 'concejos', 'contenidos', 'origen', 'alta', 'confirmado', 'baja'],
      ...result.docs.map(s => [s.email, s.status, (s.towns || []).map(t => (typeof t === 'object' ? t.name : t)).join(' | ') || 'Todos',
        (s.topics || []).map(t => topicOptions.find(o => o.value === t)?.label ?? t).join(' | '), s.source, s.createdAt, s.confirmedAt, s.unsubscribedAt])];
    const body = `﻿${rows.map(r => r.map(csv).join(';')).join('\r\n')}\r\n`;
    return new Response(body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="suscriptores-planta14${status ? `-${status}` : ''}.csv"`, 'Cache-Control': 'no-store' } });
  },
};
const date = { date: { pickerAppearance: 'dayAndTime' as const, displayFormat: 'dd/MM/yyyy HH:mm' } };
const serverOnly = { create: () => false, update: () => false };

export const Subscribers: CollectionConfig = {
  slug: 'subscribers',
  labels: { singular: 'Suscriptor', plural: 'Suscriptores' },
  access: { read: adminOnly, create: () => false, update: adminOnly, delete: adminOnly },
  admin: { useAsTitle: 'email', defaultColumns: ['email', 'status', 'towns', 'topics', 'createdAt'], hidden: ({ user }) => user?.role !== 'admin',
    description: 'Altas del boletín (doble confirmación por correo). Solo las «confirmadas» reciben el boletín. Para borrar los datos de alguien, elimina su registro.',
    components: { beforeListTable: ['/components/subscribers-export#SubscribersExport'] } },
  endpoints: [exportEndpoint],
  hooks: { beforeChange: [({ data, originalDoc }) => {
    if (data.status === 'baja' && originalDoc?.status !== 'baja') data.unsubscribedAt = new Date().toISOString();
    return data;
  }] },
  fields: [
    { name: 'email', label: 'Correo', type: 'email', required: true, unique: true, index: true, access: serverOnly },
    { name: 'status', label: 'Estado', type: 'select', required: true, defaultValue: 'pendiente', index: true,
      options: [{ label: 'Pendiente de confirmar', value: 'pendiente' }, { label: 'Confirmado', value: 'confirmado' }, { label: 'De baja', value: 'baja' }],
      admin: { description: 'Solo cambia por los enlaces del correo; la administración puede dar de baja a mano.' } },
    { name: 'towns', label: 'Concejos de interés', type: 'relationship', relationTo: 'towns', hasMany: true, access: serverOnly, admin: { description: 'Vacío: los seis concejos.' } },
    { name: 'topics', label: 'Qué quiere recibir', type: 'select', hasMany: true, options: [...topicOptions], access: serverOnly },
    { name: 'source', label: 'Dónde se apuntó', type: 'text', access: serverOnly, admin: { readOnly: true } },
    { name: 'consent', label: 'Consentimiento', type: 'group', access: serverOnly, admin: { readOnly: true }, fields: [
      { name: 'text', label: 'Texto aceptado', type: 'textarea' },
      { name: 'acceptedAt', label: 'Aceptado el', type: 'date', admin: date },
    ] },
    { name: 'confirmedAt', label: 'Confirmado el', type: 'date', access: serverOnly, admin: { ...date, readOnly: true } },
    { name: 'unsubscribedAt', label: 'Baja el', type: 'date', admin: { ...date, readOnly: true } },
    // Preferencias pedidas, pendientes de confirmar por correo (alta nueva o cambio de quien ya está suscrito).
    { name: 'pending', type: 'group', access: { read: adminOnly, ...serverOnly }, admin: { hidden: true }, fields: [
      { name: 'towns', type: 'relationship', relationTo: 'towns', hasMany: true },
      { name: 'topics', type: 'select', hasMany: true, options: [...topicOptions] },
      { name: 'source', type: 'text' },
      { name: 'tokenHash', type: 'text', index: true },
      { name: 'expiresAt', type: 'date' },
    ] },
    // Enlace de baja de cada correo (también para los boletines que se enviarán más adelante).
    { name: 'unsubscribeToken', type: 'text', unique: true, index: true, access: { read: adminOnly, ...serverOnly }, admin: { hidden: true } },
    { name: 'lastEmailAt', type: 'date', access: { read: adminOnly, ...serverOnly }, admin: { hidden: true } },
  ],
};
