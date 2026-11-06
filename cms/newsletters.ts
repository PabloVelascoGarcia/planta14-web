import type { CollectionBeforeChangeHook, CollectionConfig, Endpoint, Payload, PayloadRequest } from 'payload';
import { adminOnly, editorialUser, relationID } from './access';
import { emailAvailable } from './email';

// Boletín: envío mínimo desde el CMS (administración y redacción). Un documento con asunto, entradilla opcional y una
// selección de noticias publicadas (por defecto, las de los últimos 7 días). Primero «Enviarme una prueba» (al correo
// de quien lo pide); luego «Enviar a todos», con confirmación. Cada suscriptor confirmado recibe las noticias de sus
// concejos (todas si no eligió ninguno), con baja en un clic y la identificación del editor. Se envía por el SMTP de
// avisos@planta14.com en lotes con pausas (NEWSLETTER_BATCH_SIZE, NEWSLETTER_BATCH_PAUSE_SECONDS) y se registran
// enviados, fallos, bajas y quienes no tenían noticias de sus concejos. Sin editor de diseño, programación ni
// estadísticas de apertura.

/** Lotes prudentes para el SMTP de IONOS: 20 correos por lote, 1 s entre correos y 2 min entre lotes (≈ 480/h). */
export const sendingLimits = (env: NodeJS.ProcessEnv = process.env) => ({
  batch: Math.max(1, Number(env.NEWSLETTER_BATCH_SIZE) || 20),
  pauseMs: Math.max(0, Number(env.NEWSLETTER_BATCH_PAUSE_SECONDS ?? 120)) * 1000,
  gapMs: Math.max(0, Number(env.NEWSLETTER_EMAIL_PAUSE_MS ?? 1000)),
});
const siteURL = async () => (await import('../lib/site-config')).siteUrl;
const mask = (email: string) => email.replace(/^(.)[^@]*(@.).*(\..+)$/, '$1…$2…$3');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
type Doc = { id: number; subject: string; intro?: string | null; articles?: unknown[]; status?: string; testSentAt?: string | null; contentChangedAt?: string | null;
  stats?: { sent?: number; failed?: number; skipped?: number; unsubscribed?: number }; sentTo?: number[] | null; log?: string | null };

/** Noticias del boletín con lo que hace falta para el correo (solo publicadas). */
async function articlesOf(payload: Payload, doc: Doc) {
  const ids = (doc.articles ?? []).map(relationID).filter((id): id is number => id !== null);
  if (!ids.length) return [];
  const found = (await payload.find({ collection: 'articles', where: { and: [{ id: { in: ids } }, { _status: { equals: 'published' } }] }, depth: 1, pagination: false, overrideAccess: true })).docs as unknown as
    { id: number; title: string; excerpt?: string; slug: string; opinion?: boolean; town?: { id: number; name: string } | number; author?: { name?: string } | number }[];
  const site = await siteURL();
  return ids.map(id => found.find(a => a.id === id)).filter((a): a is NonNullable<typeof a> => Boolean(a)).map(a => ({
    townID: typeof a.town === 'object' && a.town ? a.town.id : typeof a.town === 'number' ? a.town : null,
    title: a.title, excerpt: a.excerpt ?? '', url: `${site}/noticia/${a.slug}`, town: typeof a.town === 'object' && a.town ? a.town.name : '', opinion: Boolean(a.opinion),
    author: typeof a.author === 'object' && a.author?.name ? a.author.name : 'Planta 14',
  }));
}
async function compose(doc: Doc, articles: Awaited<ReturnType<typeof articlesOf>>, unsubscribeUrl: string, test = false) {
  const { renderNewsletter } = await import('../lib/newsletter-email');
  return renderNewsletter({ subject: doc.subject, intro: doc.intro ?? null, articles, siteUrl: await siteURL(), unsubscribeUrl, test });
}
const unsubscribe = async (token: string) => { const site = await siteURL(); return { url: `${site}/boletin/baja?t=${token}`,
  headers: { 'List-Unsubscribe': `<${site}/api/boletin/baja?t=${token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }; };

/** Envíos en marcha en este proceso (si el servidor se reinicia a mitad, «Enviar a todos» lo reanuda sin repetir). */
const running = () => { const g = globalThis as typeof globalThis & { __planta14Newsletters?: Set<number> }; return (g.__planta14Newsletters ??= new Set()); };

export async function sendToAll(payload: Payload, id: number, limits = sendingLimits()) {
  const doc = await payload.findByID({ collection: 'newsletters', id, depth: 0, overrideAccess: true }) as unknown as Doc;
  const articles = await articlesOf(payload, doc);
  const stats = { sent: doc.stats?.sent ?? 0, failed: doc.stats?.failed ?? 0, skipped: doc.stats?.skipped ?? 0, unsubscribed: doc.stats?.unsubscribed ?? 0 };
  const sentTo = new Set(doc.sentTo ?? []);
  const log: string[] = doc.log ? [doc.log] : [];
  const save = (data: Record<string, unknown>) => payload.update({ collection: 'newsletters', id, overrideAccess: true, context: { newsletterSending: true }, data: { stats, sentTo: [...sentTo], log: log.join('\n').slice(-20000), ...data } as never });
  const recipients = (await payload.find({ collection: 'subscribers', where: { status: { equals: 'confirmado' } }, depth: 0, pagination: false, overrideAccess: true, sort: 'id' })).docs as unknown as
    { id: number; email: string; towns?: unknown[]; unsubscribeToken?: string | null }[];
  let inBatch = 0;
  for (const r of recipients) {
    if (sentTo.has(r.id)) continue;
    // Quien se dio de baja durante el envío no lo recibe.
    const now = await payload.findByID({ collection: 'subscribers', id: r.id, depth: 0, overrideAccess: true }).catch(() => null) as { status?: string } | null;
    if (now?.status !== 'confirmado') { stats.unsubscribed++; sentTo.add(r.id); continue; }
    const towns = (r.towns ?? []).map(relationID).filter((t): t is number => t !== null);
    const mine = towns.length ? articles.filter(a => a.townID !== null && towns.includes(a.townID)) : articles;
    if (!mine.length || !r.unsubscribeToken) { stats.skipped++; sentTo.add(r.id); continue; }
    if (inBatch >= limits.batch) { await save({}); await sleep(limits.pauseMs); inBatch = 0; }
    const out = await unsubscribe(r.unsubscribeToken);
    const { html, text } = await compose(doc, mine, out.url);
    try {
      await payload.sendEmail({ to: r.email, subject: doc.subject, html, text, headers: out.headers });
      stats.sent++;
      await payload.update({ collection: 'subscribers', id: r.id, overrideAccess: true, data: { lastEmailAt: new Date().toISOString() } as never }).catch(() => undefined);
    } catch (error) {
      stats.failed++;
      log.push(`Fallo con ${mask(r.email)}: ${error instanceof Error ? error.message.slice(0, 160) : 'error'}`);
    }
    sentTo.add(r.id);
    inBatch++;
    if (limits.gapMs) await sleep(limits.gapMs);
  }
  log.push(`Terminado el ${new Date().toISOString()}: ${stats.sent} enviados, ${stats.failed} fallos, ${stats.unsubscribed} bajas durante el envío, ${stats.skipped} sin noticias de sus concejos.`);
  await save({ status: 'enviado', finishedAt: new Date().toISOString() });
  return stats;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const docOf = async (req: PayloadRequest) => {
  const id = Number(req.routeParams?.id);
  return Number.isInteger(id) ? await req.payload.findByID({ collection: 'newsletters', id, depth: 0, overrideAccess: true }).catch(() => null) as unknown as Doc | null : null;
};

const testEndpoint: Endpoint = {
  path: '/:id/prueba', method: 'post',
  handler: async (req) => {
    if (!editorialUser({ req })) return json({ error: 'Solo la administración y la redacción' }, 403);
    if (!emailAvailable()) return json({ error: 'El correo no está configurado (SMTP_ENABLED).' }, 503);
    const doc = await docOf(req);
    if (!doc) return json({ error: 'Guarda el boletín antes de probarlo' }, 404);
    const articles = await articlesOf(req.payload, doc);
    if (!articles.length) return json({ error: 'Elige al menos una noticia publicada' }, 400);
    const to = String(req.user!.email);
    const { html, text } = await compose(doc, articles, `${await siteURL()}/boletin/baja`, true);
    await req.payload.sendEmail({ to, subject: `[Prueba] ${doc.subject}`, html, text });
    const at = new Date().toISOString();
    await req.payload.update({ collection: 'newsletters', id: doc.id, overrideAccess: true, context: { newsletterSending: true }, data: { testSentAt: at } as never });
    return json({ ok: true, to, articles: articles.length });
  },
};
const recipientsEndpoint: Endpoint = {
  path: '/:id/destinatarios', method: 'get',
  handler: async (req) => {
    if (!editorialUser({ req })) return json({ error: 'Solo la administración y la redacción' }, 403);
    const doc = await docOf(req);
    if (!doc) return json({ error: 'No encontrado' }, 404);
    const confirmed = await req.payload.count({ collection: 'subscribers', where: { status: { equals: 'confirmado' } }, overrideAccess: true });
    return json({ confirmed: confirmed.totalDocs, status: doc.status, running: running().has(doc.id), testSentAt: doc.testSentAt ?? null });
  },
};
const sendEndpoint: Endpoint = {
  path: '/:id/enviar', method: 'post',
  handler: async (req) => {
    if (!editorialUser({ req })) return json({ error: 'Solo la administración y la redacción' }, 403);
    if (!emailAvailable()) return json({ error: 'El correo no está configurado (SMTP_ENABLED).' }, 503);
    const doc = await docOf(req);
    if (!doc) return json({ error: 'No encontrado' }, 404);
    const body = await req.json?.().catch(() => ({})) as { confirmar?: boolean };
    if (body?.confirmar !== true) return json({ error: 'Falta la confirmación' }, 400);
    if (doc.status === 'enviado') return json({ error: 'Este boletín ya se envió. Para otro envío, crea un boletín nuevo.' }, 409);
    if (running().has(doc.id)) return json({ error: 'El envío ya está en marcha' }, 409);
    // Primero una prueba, y de la versión guardada: si el asunto, la entradilla o las noticias cambiaron después, otra.
    // (Se compara con «contentChangedAt», no con updatedAt, que también cambia al anotar el progreso del envío.)
    if (!doc.testSentAt || (doc.contentChangedAt && new Date(doc.contentChangedAt).getTime() > new Date(doc.testSentAt).getTime())) return json({ error: 'Antes de enviarlo a todos, envíate una prueba de la versión guardada' }, 409);
    if (!(await articlesOf(req.payload, doc)).length) return json({ error: 'Elige al menos una noticia publicada' }, 400);
    await req.payload.update({ collection: 'newsletters', id: doc.id, overrideAccess: true, context: { newsletterSending: true },
      data: { status: 'enviando', startedAt: new Date().toISOString(), sentBy: req.user!.id } as never });
    // En segundo plano, en este proceso: la petición vuelve enseguida y el progreso queda en el documento.
    const payload = req.payload;
    running().add(doc.id);
    void sendToAll(payload, doc.id).catch(async error => {
      await payload.update({ collection: 'newsletters', id: doc.id, overrideAccess: true, context: { newsletterSending: true },
        data: { status: 'interrumpido', log: `${doc.log ?? ''}\nEnvío interrumpido: ${error instanceof Error ? error.message : error}`.trim() } as never }).catch(() => undefined);
    }).finally(() => running().delete(doc.id));
    return json({ ok: true, started: true });
  },
};

/** Al crear: sin noticias elegidas, las publicadas de los últimos 7 días (el editor quita o añade las que quiera). */
const defaults: CollectionBeforeChangeHook = async ({ data, operation, req, context, originalDoc }) => {
  if (context?.newsletterSending) return data;
  if (operation === 'create' && !(data.articles as unknown[] | undefined)?.length) {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    data.articles = (await req.payload.find({ collection: 'articles', where: { and: [{ _status: { equals: 'published' } }, { publishedAt: { greater_than_equal: since } }] }, sort: '-publishedAt', limit: 30, depth: 0, overrideAccess: true, req })).docs.map(a => a.id);
  }
  // Lo enviado no se cambia (sí se puede leer).
  if (operation === 'update' && originalDoc?.status && originalDoc.status !== 'borrador') {
    for (const key of ['subject', 'intro', 'articles']) delete data[key];
  }
  if (operation === 'create') { data.status = 'borrador'; delete data.testSentAt; }
  // Cada guardado del contenido pide una prueba nueva antes de «Enviar a todos».
  if (operation === 'create' || ['subject', 'intro', 'articles'].some(key => key in data)) data.contentChangedAt = new Date().toISOString();
  return data;
};

const readOnly = { create: () => false, update: () => false };
export const Newsletters: CollectionConfig = {
  slug: 'newsletters',
  labels: { singular: 'Boletín', plural: 'Boletines' },
  access: { read: editorialUser, create: editorialUser, update: editorialUser, delete: adminOnly },
  admin: { useAsTitle: 'subject', defaultColumns: ['subject', 'status', 'finishedAt', 'updatedAt'],
    description: 'Envío del boletín a los suscriptores confirmados. Escribe el asunto, una entradilla si quieres y elige las noticias (al crearlo salen las de los últimos 7 días). Guarda, pulsa «Enviarme una prueba» y, si está bien, «Enviar a todos».' },
  endpoints: [testEndpoint, recipientsEndpoint, sendEndpoint],
  hooks: { beforeChange: [defaults] },
  fields: [
    { name: 'subject', label: 'Asunto', type: 'text', required: true, maxLength: 150 },
    { name: 'intro', label: 'Entradilla (opcional)', type: 'textarea', maxLength: 1500, admin: { description: 'Unas líneas antes de las noticias. Párrafos separados por una línea en blanco.' } },
    { name: 'articles', label: 'Noticias', type: 'relationship', relationTo: 'articles', hasMany: true, filterOptions: { _status: { equals: 'published' } },
      admin: { description: 'Solo noticias publicadas, en este orden. Cada suscriptor recibe las de sus concejos (todas, si no eligió ninguno).' } },
    { name: 'send', type: 'ui', admin: { position: 'sidebar', components: { Field: '/components/newsletter-send#NewsletterSend' } } },
    { name: 'status', label: 'Estado', type: 'select', defaultValue: 'borrador', access: readOnly, admin: { position: 'sidebar', readOnly: true },
      options: [{ label: 'Borrador', value: 'borrador' }, { label: 'Enviando', value: 'enviando' }, { label: 'Enviado', value: 'enviado' }, { label: 'Interrumpido', value: 'interrumpido' }] },
    { name: 'testSentAt', label: 'Última prueba', type: 'date', access: readOnly, admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' } } },
    { name: 'startedAt', label: 'Envío iniciado', type: 'date', access: readOnly, admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' } } },
    { name: 'finishedAt', label: 'Envío terminado', type: 'date', access: readOnly, admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime', displayFormat: 'dd/MM/yyyy HH:mm' } } },
    { name: 'sentBy', label: 'Enviado por', type: 'relationship', relationTo: 'users', access: readOnly, admin: { position: 'sidebar', readOnly: true } },
    { name: 'stats', label: 'Resultado', type: 'group', access: readOnly, admin: { readOnly: true }, fields: [
      { type: 'row', fields: [
        { name: 'sent', label: 'Enviados', type: 'number', defaultValue: 0 },
        { name: 'failed', label: 'Fallos', type: 'number', defaultValue: 0 },
        { name: 'unsubscribed', label: 'Bajas durante el envío', type: 'number', defaultValue: 0 },
        { name: 'skipped', label: 'Sin noticias de sus concejos', type: 'number', defaultValue: 0 },
      ] },
    ] },
    { name: 'log', label: 'Registro', type: 'textarea', access: readOnly, admin: { readOnly: true, description: 'Fallos (correo enmascarado) y resumen del envío.' } },
    { name: 'contentChangedAt', type: 'date', access: { read: editorialUser, ...readOnly }, admin: { hidden: true } },
    { name: 'sentTo', type: 'json', access: { read: adminOnly, ...readOnly }, admin: { hidden: true } },
  ],
};
