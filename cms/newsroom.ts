import type { Endpoint, GlobalConfig, Payload, PayloadRequest, Where } from 'payload';
import { adminOnly, editorialUser, relationID } from './access';
import { emailAvailable } from './email';

/**
 * Redacción a tiempo parcial: todo lo que necesita intervención (fiestas enviadas, sugerencias de los ayuntamientos y
 * cartas) entra en una bandeja compartida, «Pendiente de revisar» (/cms/bandeja), y se resuelve allí con un clic.
 * Avisos inmediatos solo para eso, y solo al responsable del concejo (o al otro redactor si está «Fuera hasta»).
 * Lo publicado por los ayuntamientos llega una vez al día, en el resumen de las 8:00.
 */

/** Tipos de entrada que requieren intervención (las publicaciones municipales no: van al resumen diario). */
export const INBOX_KINDS = ['festival-submission', 'suggestion', 'letter-submission'] as const;
export type InboxKind = typeof INBOX_KINDS[number];
export const KIND_LABELS: Record<string, string> = { 'festival-submission': 'Fiesta enviada', suggestion: 'Sugerencia', 'letter-submission': 'Carta', 'municipal-publication': 'Publicación municipal' };
/** Botón de aprobar de cada tipo. */
export const APPROVE_LABELS: Record<InboxKind, string> = { 'festival-submission': 'Publicar', suggestion: 'Atendida', 'letter-submission': 'Publicar' };

export const DEFAULT_REJECTION_REASONS = [
  'Duplicado: ya está publicado o enviado',
  'Fuera de nuestra zona (Caudal)',
  'Falta información o no se puede comprobar',
  'No cumple las normas de publicación',
  'Publicidad o contenido comercial',
];

/** Ajustes de la redacción (solo administración): la lista de motivos de rechazo. */
export const NewsroomSettings: GlobalConfig = {
  slug: 'newsroom-settings',
  label: 'Motivos de rechazo',
  access: { read: editorialUser, update: adminOnly },
  admin: { description: 'Motivos que la redacción elige al rechazar algo en «Pendiente de revisar». Al rechazar se puede añadir un texto libre. En las cartas, el motivo se envía al autor.' },
  fields: [
    { name: 'rejectionReasons', label: 'Motivos de rechazo', type: 'array', labels: { singular: 'Motivo', plural: 'Motivos' },
      defaultValue: DEFAULT_REJECTION_REASONS.map(reason => ({ reason })),
      fields: [{ name: 'reason', label: 'Motivo', type: 'text', required: true, maxLength: 120 }] },
    // Día (AAAA-MM-DD, Madrid) del último resumen diario enviado: evita repetirlo si el servidor se reinicia.
    { name: 'digestSentDay', type: 'text', access: { update: () => false }, admin: { hidden: true } },
  ],
};

export async function rejectionReasons(payload: Payload): Promise<string[]> {
  const doc = await payload.findGlobal({ slug: 'newsroom-settings', depth: 0, overrideAccess: true }).catch(() => null) as { rejectionReasons?: { reason?: string | null }[] | null } | null;
  const list = (doc?.rejectionReasons ?? []).map(r => String(r.reason ?? '').trim()).filter(Boolean);
  return list.length ? list : DEFAULT_REJECTION_REASONS;
}

export const madridDay = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(date);
export const madridHour = (date = new Date()) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }).format(date));
type NewsroomUser = { id: number; email: string; name?: string | null; role?: string | null; awayUntil?: string | null; dailyDigest?: boolean | null };
/** «Fuera hasta» incluye ese día. */
export const isAway = (user: Pick<NewsroomUser, 'awayUntil'> | null | undefined, day = madridDay()) => Boolean(user?.awayUntil && user.awayUntil >= day);

type TownRow = { id: number; name: string; slug: string; responsible: NewsroomUser | null };
export async function townsWithResponsibles(payload: Payload, req?: PayloadRequest): Promise<TownRow[]> {
  const towns = (await payload.find({ collection: 'towns', pagination: false, depth: 1, overrideAccess: true, req, sort: 'name' })).docs;
  return towns.map(t => ({ id: t.id, name: t.name, slug: t.slug, responsible: t.responsible && typeof t.responsible === 'object' ? t.responsible as unknown as NewsroomUser : null }));
}
/** Redactores: las cuentas de la redacción responsables de algún concejo. */
export function newsroom(towns: TownRow[]): NewsroomUser[] {
  const byID = new Map<number, NewsroomUser>();
  for (const t of towns) if (t.responsible && ['editor', 'admin'].includes(String(t.responsible.role))) byID.set(t.responsible.id, t.responsible);
  return [...byID.values()];
}
/**
 * A quién avisar de lo que entra en un concejo: a su responsable; si está fuera, a los demás redactores que no lo estén;
 * si el concejo no tiene responsable (p. ej., Caudal), a todos los redactores presentes. Sin nadie, a nadie (sigue en la bandeja).
 */
export function recipientsFor(towns: TownRow[], townID: number | null, day = madridDay()): NewsroomUser[] {
  const town = towns.find(t => t.id === townID);
  const present = newsroom(towns).filter(u => !isAway(u, day));
  if (town?.responsible && !isAway(town.responsible, day)) return [town.responsible];
  return present.filter(u => u.id !== town?.responsible?.id);
}
/** Concejos de los que se ocupa hoy un redactor: los suyos, los de quien esté fuera y los que no tienen responsable. */
export function townsCoveredBy(towns: TownRow[], userID: number, day = madridDay()): TownRow[] {
  return towns.filter(t => recipientsFor(towns, t.id, day).some(u => u.id === userID));
}

/** Lo que la bandeja pone primero: lo que cubre el redactor; a quien no es redactor (administración), todo. */
export function inboxTownsFor(towns: TownRow[], userID: number, day = madridDay()): TownRow[] {
  return newsroom(towns).some(u => u.id === userID) ? townsCoveredBy(towns, userID, day) : towns;
}

const cmsBase = () => (process.env.CMS_SERVER_URL || process.env.SITE_URL || '').replace(/\/$/, '');
export const inboxURL = (noticeID?: number | string) => `${cmsBase()}/cms/bandeja${noticeID ? `?pendiente=${noticeID}#pendiente-${noticeID}` : ''}`;

/** Correo inmediato de lo que requiere intervención, con el enlace directo al elemento en la bandeja. */
export async function notifyInbox(payload: Payload, req: PayloadRequest | undefined, notice: { id: number; title: string }, townID: number | null, detail: string): Promise<'disabled' | 'sent' | 'failed'> {
  if (!emailAvailable()) return 'disabled';
  const towns = await townsWithResponsibles(payload, req);
  const town = towns.find(t => t.id === townID);
  const to = recipientsFor(towns, townID);
  if (!to.length) return 'disabled';
  const away = town?.responsible && isAway(town.responsible) ? `${town.responsible.name || town.responsible.email} está fuera hasta el ${town.responsible.awayUntil!.split('-').reverse().join('/')}: te llega a ti.\n\n` : '';
  try {
    for (const user of to) await payload.sendEmail({ to: user.email, subject: `Pendiente de revisar: ${notice.title}`,
      text: `Hola${user.name ? `, ${user.name}` : ''}:\n\n${away}${detail}\n\nResuélvelo en un clic en la bandeja «Pendiente de revisar»:\n${inboxURL(notice.id)}\n\n` +
        `Concejo: ${town?.name ?? 'sin concejo'}. La bandeja es compartida: si ya lo ha resuelto otra persona, lo verás allí.\n\n— Planta 14` });
    return 'sent';
  } catch (error) {
    payload.logger.error({ err: error, msg: 'No se pudo enviar el aviso de «Pendiente de revisar»' });
    return 'failed';
  }
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
/**
 * POST /api/cms/notifications/:id/resolver { action: 'aprobar' | 'rechazar', reason?, note? }: resuelve en un clic.
 * Fiesta: publicar (o, al rechazar, se queda en borrador). Carta: publicar o rechazar (el motivo se envía al autor).
 * Sugerencia: atendida o descartada. Cualquier persona de la redacción; queda quién y cuándo.
 */
export const resolveEndpoint: Endpoint = {
  path: '/:id/resolver', method: 'post',
  handler: async (req) => {
    if (!editorialUser({ req })) return json({ error: 'Solo la redacción' }, 403);
    const id = Number(req.routeParams?.id);
    const body = await req.json?.().catch(() => null) as { action?: string; reason?: string; note?: string } | null;
    const notice = Number.isInteger(id) ? await req.payload.findByID({ collection: 'notifications', id, depth: 1, overrideAccess: true, req }).catch(() => null) : null;
    if (!notice || !(INBOX_KINDS as readonly string[]).includes(notice.kind)) return json({ error: 'No está en la bandeja' }, 404);
    if (notice.reviewed) {
      const by = typeof notice.resolvedBy === 'object' && notice.resolvedBy ? notice.resolvedBy.name || notice.resolvedBy.email : 'otra persona';
      return json({ error: `Ya lo resolvió ${by}.` }, 409);
    }
    const action = body?.action;
    if (action !== 'aprobar' && action !== 'rechazar') return json({ error: 'Acción no válida' }, 400);
    const reasons = await rejectionReasons(req.payload);
    const reason = String(body?.reason ?? '').trim(), note = String(body?.note ?? '').trim().slice(0, 1000);
    if (action === 'rechazar' && !reasons.includes(reason)) return json({ error: 'Elige un motivo de la lista' }, 400);
    const kind = notice.kind as InboxKind;
    try {
      if (kind === 'festival-submission' && notice.festival) {
        const festivalID = relationID(notice.festival)!;
        if (action === 'aprobar') await req.payload.update({ collection: 'festivals', id: festivalID, user: req.user, overrideAccess: false, req, data: { _status: 'published' } as never });
      } else if (kind === 'letter-submission' && notice.letter) {
        const letterID = relationID(notice.letter)!;
        await req.payload.update({ collection: 'letters', id: letterID, user: req.user, overrideAccess: false, req,
          data: (action === 'aprobar' ? { status: 'aprobada' } : { status: 'rechazada', rejectionReason: note ? `${reason}. ${note}` : reason }) as never });
      }
    } catch (error) {
      return json({ error: `${(error as Error).message || 'No se pudo resolver'}. Ábrelo para completarlo.` }, 400);
    }
    const resolved = await req.payload.update({ collection: 'notifications', id, overrideAccess: true, req, context: { inboxResolution: true },
      data: { reviewed: true, decision: action === 'aprobar' ? 'aprobado' : 'rechazado', rejectReason: action === 'rechazar' ? reason : null,
        rejectNote: action === 'rechazar' && note ? note : null, resolvedBy: req.user!.id, resolvedAt: new Date().toISOString() } as never });
    return json({ ok: true, decision: resolved.decision });
  },
};

/** Marca de quién y cuándo también cuando se resuelve a mano (casilla «Revisado» de la ficha). */
export function stampResolution({ data, originalDoc, req }: { data: Record<string, unknown>; originalDoc?: Record<string, unknown>; req: PayloadRequest }) {
  if (req.context.inboxResolution) return data;
  if (data.reviewed === true && originalDoc && !originalDoc.reviewed) Object.assign(data, { resolvedBy: req.user?.id ?? null, resolvedAt: new Date().toISOString(), decision: data.decision ?? 'revisado' });
  if (data.reviewed === false && originalDoc?.reviewed) Object.assign(data, { resolvedBy: null, resolvedAt: null, decision: null, rejectReason: null, rejectNote: null });
  return data;
}

/** Pendientes de la bandeja (sin resolver). */
export const pendingInbox: Where = { and: [{ kind: { in: [...INBOX_KINDS] } }, { reviewed: { not_equals: true } }] };

/**
 * Resumen diario (8:00, Madrid), solo si hay algo, para cada redactor con el resumen activado y que no esté fuera: lo
 * publicado por los ayuntamientos de sus concejos en las últimas 24 horas y lo que sigue pendiente en la bandeja.
 * Devuelve a quién se ha enviado.
 */
export async function sendDailyDigests(payload: Payload, now = new Date()) {
  const sent: { email: string; publications: number; pending: number }[] = [];
  if (!emailAvailable()) return sent;
  const day = madridDay(now);
  const towns = await townsWithResponsibles(payload);
  const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const [publications, pending, spaces] = await Promise.all([
    payload.find({ collection: 'notifications', overrideAccess: true, pagination: false, depth: 1, sort: 'createdAt',
      where: { and: [{ kind: { equals: 'municipal-publication' } }, { createdAt: { greater_than: since } }, { createdAt: { less_than_equal: now.toISOString() } }] } }),
    payload.find({ collection: 'notifications', overrideAccess: true, pagination: false, depth: 0, sort: 'createdAt', where: pendingInbox }),
    payload.find({ collection: 'municipal-spaces', overrideAccess: true, pagination: false, depth: 0 }),
  ]);
  const site = (await import('../lib/site-config')).siteUrl.replace(/\/$/, '');
  const { municipalTypeLabels } = await import('./activity');
  for (const user of newsroom(towns)) {
    if (user.dailyDigest === false || isAway(user, day)) continue;
    const mine = new Set(townsCoveredBy(towns, user.id, day).map(t => t.id));
    const pubs = publications.docs.filter(n => {
      const space = spaces.docs.find(s => s.id === relationID(n.space));
      return space && mine.has(relationID(space.town)!) && typeof n.content === 'object' && n.content && n.content._status === 'published' && !n.content.withdrawal?.withdrawn;
    });
    const todo = pending.docs.filter(n => mine.has(relationID(n.town) ?? -1));
    if (!pubs.length && !todo.length) continue;
    const pubLines = pubs.map(n => {
      const c = n.content as { id: number; title: string; type: string };
      const space = spaces.docs.find(s => s.id === relationID(n.space))!;
      return `- ${space.name} · ${municipalTypeLabels[c.type] ?? 'Publicación'}: ${c.title}\n  ${site}/${space.legacyID ?? ''}${c.type !== 'news' ? `?seccion=${c.type}` : ''}`;
    });
    const todoLines = todo.map(n => `- ${KIND_LABELS[n.kind] ?? n.kind} · ${towns.find(t => t.id === relationID(n.town))?.name ?? 'sin concejo'}: ${n.title}\n  ${inboxURL(n.id)}`);
    const text = `Hola${user.name ? `, ${user.name}` : ''}:\n\n` +
      (pubLines.length ? `Publicado por los ayuntamientos de tus concejos (últimas 24 horas):\n${pubLines.join('\n')}\n\n` : '') +
      (todoLines.length ? `Pendiente en la bandeja:\n${todoLines.join('\n')}\n\n` : '') +
      `Bandeja: ${inboxURL()}\nPara no recibir este resumen, desmárcalo en tu perfil del CMS («Avisos y resumen»).\n\n— Planta 14`;
    const parts = [pubs.length ? `${pubs.length} ${pubs.length === 1 ? 'publicación municipal' : 'publicaciones municipales'}` : '', todo.length ? `${todo.length} pendiente${todo.length === 1 ? '' : 's'}` : ''].filter(Boolean);
    try {
      await payload.sendEmail({ to: user.email, subject: `Planta 14, resumen del día: ${parts.join(' y ')}`, text });
      sent.push({ email: user.email, publications: pubs.length, pending: todo.length });
    } catch (error) { payload.logger.error({ err: error, msg: `No se pudo enviar el resumen diario a ${user.email}` }); }
  }
  return sent;
}

/**
 * Lo llama cada pocos minutos el servidor (instrumentation.ts): a partir de las 8:00 (Madrid), una vez al día. Si el
 * servidor estaba parado a las 8:00, sale al arrancar. El día enviado queda guardado para no repetirlo.
 */
export async function dailyDigestTick(payload: Payload, now = new Date()) {
  const hour = Number(process.env.NEWSROOM_DIGEST_HOUR || 8);
  if (madridHour(now) < hour) return null;
  const day = madridDay(now);
  const settings = await payload.findGlobal({ slug: 'newsroom-settings', depth: 0, overrideAccess: true }).catch(() => null) as { digestSentDay?: string | null } | null;
  if (settings?.digestSentDay === day) return null;
  await payload.updateGlobal({ slug: 'newsroom-settings', overrideAccess: true, data: { digestSentDay: day } as never });
  return sendDailyDigests(payload, now);
}
