import { headers } from 'next/headers';
import { contentClient } from './payload-content';
import { relationID } from '../cms/access';
import type { MunicipalContent as PayloadMunicipalContent } from '../cms/payload-types';

export type PanelItem = {
  id: number; type: PayloadMunicipalContent['type']; title: string; excerpt: string; body: string;
  publishedAt: string; expiresAt: string | null; eventAt: string | null; place: string | null; deadline: string | null;
  /** Status of the live document (what the public sees) and whether a newer draft exists. */
  live: 'published' | 'draft'; hasDraft: boolean;
  withdrawn: boolean; withdrawalReason: string | null; withdrawnAt: string | null; image: number | null; updatedAt: string;
};
export type PanelState =
  | { kind: 'login'; cmsEmail?: string }
  | { kind: 'forbidden'; email: string; reason: string }
  | { kind: 'editor'; email: string; name: string; spaceID: number; items: PanelItem[]; stats: import('./stats').StatsReport | null; statsMonth: string;
      services: import('../components/municipal-services-editor').ServiceRow[]; utilHidden: string[] };

/**
 * Server-side state of the real municipal panel (CONTENT_SOURCE=payload). Every query runs with the
 * signed-in user and Payload access control (overrideAccess:false): no privileged reads.
 */
export async function municipalPanelState(slug: string): Promise<PanelState> {
  const payload = await contentClient();
  // Sesión del panel (cookie planta14_panel, 14 días; lib/panel-session.ts); sin ella, la de Payload como antes.
  const { panelAuthHeaders, readPanelToken } = await import('./panel-session');
  const requestHeaders = await headers();
  const { user } = await payload.auth({ headers: panelAuthHeaders(requestHeaders) });
  if (!user || user.collection !== 'users') return { kind: 'login' };
  // Sin sesión del panel, la del CMS no entra en el panel: se ofrece la entrada (las dos sesiones no se mezclan). Solo una
  // sesión de Payload de una cuenta municipal (abierta antes de la cookie del panel) sigue valiendo hasta que caduque.
  if (user.role !== 'municipal') return readPanelToken(requestHeaders)
    ? { kind: 'forbidden', email: user.email, reason: 'Esta cuenta es de Planta 14. Gestiona los contenidos desde /cms.' }
    : { kind: 'login', cmsEmail: user.email };
  const spaces = await payload.find({ collection: 'municipal-spaces', user, overrideAccess: false, depth: 0, limit: 1, where: { legacyID: { equals: slug } } });
  const space = spaces.docs[0];
  if (!space || relationID(user.municipalSpace) !== space.id) return { kind: 'forbidden', email: user.email, reason: 'Tu cuenta no gestiona este espacio municipal.' };
  const query = { collection: 'municipal-content' as const, user, overrideAccess: false, depth: 0, pagination: false as const, sort: '-updatedAt', where: { space: { equals: space.id } } };
  const [latest, live] = await Promise.all([payload.find({ ...query, draft: true }), payload.find(query)]);
  const liveStatus = new Map(live.docs.map(doc => [doc.id, doc._status]));
  const liveWithdrawal = new Map(live.docs.filter(doc => doc.withdrawal?.withdrawn).map(doc => [doc.id, doc.withdrawal]));
  const items = latest.docs.map((doc): PanelItem => ({
    id: doc.id, type: doc.type, title: doc.title, excerpt: doc.excerpt, body: doc.body, publishedAt: doc.publishedAt,
    expiresAt: doc.expiresAt || null, eventAt: doc.eventAt || null, place: doc.place || null, deadline: doc.deadline || null,
    live: liveStatus.get(doc.id) === 'published' ? 'published' : 'draft', hasDraft: doc._status === 'draft' && liveStatus.get(doc.id) === 'published',
    withdrawn: Boolean((liveWithdrawal.get(doc.id) || doc.withdrawal)?.withdrawn), withdrawalReason: (liveWithdrawal.get(doc.id) || doc.withdrawal)?.reason || null, withdrawnAt: (liveWithdrawal.get(doc.id) || doc.withdrawal)?.withdrawnAt || null,
    image: relationID(doc.image), updatedAt: doc.updatedAt,
  }));
  // Visitas del mes, solo de su concejo (estadísticas propias, sin datos personales).
  const { monthRange, statsReport } = await import('./stats');
  const town = await payload.findByID({ collection: 'towns', id: relationID(space.town)!, depth: 0, overrideAccess: true }).catch(() => null);
  const range = monthRange(null);
  const stats = town ? await statsReport(range.from, range.to, town.slug).catch(() => null) : null;
  // Directorio de servicios municipales de «Útil» (con los permisos de la cuenta: solo su concejo).
  const services = (await payload.find({ collection: 'municipal-services', user, overrideAccess: false, depth: 0, pagination: false, sort: 'order', where: { town: { equals: relationID(space.town) } } })).docs
    .map(doc => ({ id: doc.id, name: doc.name, category: doc.category, address: doc.address ?? null, phone: doc.phone ?? null, email: doc.email ?? null, web: doc.web ?? null, hours: doc.hours ?? null, notes: doc.notes ?? null, order: doc.order ?? null }));
  // Servicios de «Útil» que el ayuntamiento ha ocultado en su concejo.
  const visibility = (await payload.find({ collection: 'util-visibility', overrideAccess: false, user, depth: 0, limit: 1, where: { town: { equals: relationID(space.town) } } })).docs[0];
  return { kind: 'editor', email: user.email, name: user.name, spaceID: space.id, items, stats, statsMonth: range.month, services, utilHidden: (visibility?.hidden ?? []) as string[] };
}
