"use server";
import { territories } from "@/lib/mock-data";
import { siteUrl } from "@/lib/site-config";
import { slugify } from "@/lib/utils";

export type SubscribeState = { ok: boolean; message?: string; errors?: Record<string, string>; values?: { email: string; towns: string[]; topics: string[]; consent: boolean } };
const TOPICS = ["finde", "avisos"] as const;
const SOURCES = ["portada", "pie", "fiesta", "noticia"] as const;
const topicLabel: Record<string, string> = { finde: "Qué hacer este finde", avisos: "Avisos de mi concejo" };

async function services() {
  const [{ contentClient }, { hashToken, newToken }, { consentText }, { emailAvailable }] = await Promise.all([
    import("@/lib/payload-content"), import("@/cms/festivals"), import("@/cms/subscribers"), import("@/cms/email")]);
  return { payload: await contentClient(), hashToken, newToken, consentText, emailAvailable };
}
const unsubscribeURL = (token: string) => `${siteUrl}/boletin/baja?t=${token}`;
/** Cabeceras de baja con un clic (RFC 8058): los programas de correo muestran «Cancelar suscripción». */
const unsubscribeHeaders = (token: string) => ({ "List-Unsubscribe": `<${siteUrl}/api/boletin/baja?t=${token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });

/** Alta (o cambio de preferencias): nada se aplica hasta que la persona confirma desde su correo. */
export async function subscribe(_previous: SubscribeState, form: FormData): Promise<SubscribeState> {
  const done: SubscribeState = { ok: true, message: "Casi está: te hemos enviado un correo. Pulsa el enlace y confirma para empezar a recibir el boletín." };
  if (String(form.get("web") ?? "")) return done; // campo trampa para robots
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const towns = Object.values(territories).flat().map(slugify);
  const chosenTowns = form.getAll("towns").map(String).filter(t => towns.includes(t));
  const topics = form.getAll("topics").map(String).filter((t): t is typeof TOPICS[number] => (TOPICS as readonly string[]).includes(t));
  const source = (SOURCES as readonly string[]).includes(String(form.get("source"))) ? String(form.get("source")) : "portada";
  const errors: Record<string, string> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Escribe un correo válido.";
  if (!topics.length) errors.topics = "Elige al menos qué quieres recibir.";
  if (form.get("consent") !== "on") errors.consent = "Para suscribirte tienes que aceptar recibir el boletín.";
  // Se devuelven los valores para que el formulario no se vacíe al mostrar los errores.
  const values = { email, towns: chosenTowns, topics, consent: form.get("consent") === "on" };
  if (Object.keys(errors).length) return { ok: false, errors, values, message: "Revisa los campos marcados." };
  const { payload, hashToken, newToken, consentText, emailAvailable } = await services();
  if (!emailAvailable()) return { ok: false, message: "La suscripción no está disponible en este momento. Inténtalo más tarde." };
  try {
    const townDocs = chosenTowns.length ? (await payload.find({ collection: "towns", where: { slug: { in: chosenTowns } }, pagination: false, depth: 0, overrideAccess: true })).docs : [];
    const existing = (await payload.find({ collection: "subscribers", where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })).docs[0];
    // Como mucho un correo cada dos minutos a la misma dirección (la respuesta es siempre la misma).
    if (existing?.lastEmailAt && Date.now() - new Date(existing.lastEmailAt).getTime() < 2 * 60 * 1000) return done;
    const token = newToken();
    const pending = { towns: townDocs.map(t => t.id), topics, source, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() };
    const now = new Date().toISOString();
    const subscriber = existing
      ? await payload.update({ collection: "subscribers", id: existing.id, overrideAccess: true, data: { pending, lastEmailAt: now, ...(existing.status === "baja" ? { status: "pendiente" } : {}) } as never })
      : await payload.create({ collection: "subscribers", overrideAccess: true, data: { email, status: "pendiente", pending, source, unsubscribeToken: newToken(), lastEmailAt: now,
          consent: { text: consentText, acceptedAt: now } } as never });
    const change = existing?.status === "confirmado";
    const what = topics.map(t => topicLabel[t]).join(" y "), where = townDocs.length ? townDocs.map(t => t.name).join(", ") : "los seis concejos del Caudal";
    await payload.sendEmail({ to: email, headers: unsubscribeHeaders(subscriber.unsubscribeToken!),
      subject: change ? "Confirma el cambio en tu boletín de Planta 14" : "Confirma tu suscripción al boletín de Planta 14",
      text: `${change ? "Has pedido cambiar tu suscripción" : "Has pedido suscribirte al boletín de Planta 14"}: ${what}, de ${where}.\n\n` +
        `Para ${change ? "aplicar el cambio" : "empezar a recibirlo"}, confirma aquí (caduca en 7 días):\n${siteUrl}/boletin/confirmar?t=${token}\n\n` +
        `Si no has sido tú, ignora este correo: no te escribiremos más.\n\nDarte de baja: ${unsubscribeURL(subscriber.unsubscribeToken!)}\n\n— Planta 14` });
    return done;
  } catch (error) {
    payload.logger.error({ err: error, msg: "No se pudo tramitar una suscripción al boletín" });
    return { ok: false, message: "No hemos podido tramitar la suscripción. Inténtalo de nuevo en unos minutos." };
  }
}

export type TokenState = { ok: boolean; message: string };

/** Botón de /boletin/confirmar: aplica las preferencias pendientes y escribe la bienvenida (con su enlace de baja). */
export async function confirmSubscription(_previous: TokenState, form: FormData): Promise<TokenState> {
  const token = String(form.get("t") ?? "");
  const { payload, hashToken } = await services();
  const subscriber = token ? (await payload.find({ collection: "subscribers", where: { "pending.tokenHash": { equals: hashToken(token) } }, limit: 1, depth: 0, overrideAccess: true })).docs[0] : undefined;
  if (!subscriber?.pending?.tokenHash) return { ok: false, message: "Este enlace ya se ha usado o no es válido." };
  if (!subscriber.pending.expiresAt || new Date(subscriber.pending.expiresAt) < new Date()) return { ok: false, message: "El enlace ha caducado. Vuelve a apuntarte, por favor." };
  const now = new Date().toISOString();
  const updated = await payload.update({ collection: "subscribers", id: subscriber.id, overrideAccess: true, depth: 1, data: {
    status: "confirmado", towns: subscriber.pending.towns ?? [], topics: subscriber.pending.topics ?? [], source: subscriber.pending.source || subscriber.source,
    confirmedAt: subscriber.confirmedAt || now, unsubscribedAt: null, pending: { towns: [], topics: [], source: null, tokenHash: null, expiresAt: null } } as never });
  const where = (updated.towns || []).map(t => (typeof t === "object" ? t.name : "")).filter(Boolean).join(", ") || "los seis concejos del Caudal";
  await payload.sendEmail({ to: updated.email, headers: unsubscribeHeaders(updated.unsubscribeToken!), subject: "Ya estás suscrito al boletín de Planta 14",
    text: `Suscripción confirmada: ${(updated.topics || []).map(t => topicLabel[t]).join(" y ")}, de ${where}.\n\nDarte de baja, con un clic: ${unsubscribeURL(updated.unsubscribeToken!)}\n\n— Planta 14` }).catch(error => payload.logger.error({ err: error, msg: "No se pudo enviar la bienvenida del boletín" }));
  return { ok: true, message: "¡Hecho! Ya estás suscrito al boletín de Planta 14." };
}

/** Baja (botón de /boletin/baja y POST de un clic de /api/boletin/baja). */
export async function unsubscribeByToken(token: string): Promise<TokenState> {
  if (!token) return { ok: false, message: "Este enlace no es válido." };
  const { payload } = await services();
  const subscriber = (await payload.find({ collection: "subscribers", where: { unsubscribeToken: { equals: token } }, limit: 1, depth: 0, overrideAccess: true })).docs[0];
  if (!subscriber) return { ok: false, message: "Este enlace no es válido." };
  if (subscriber.status !== "baja") await payload.update({ collection: "subscribers", id: subscriber.id, overrideAccess: true,
    data: { status: "baja", unsubscribedAt: new Date().toISOString(), pending: { towns: [], topics: [], source: null, tokenHash: null, expiresAt: null } } as never });
  return { ok: true, message: "Te has dado de baja del boletín. No te escribiremos más." };
}
export async function unsubscribe(_previous: TokenState, form: FormData): Promise<TokenState> {
  return unsubscribeByToken(String(form.get("t") ?? ""));
}
