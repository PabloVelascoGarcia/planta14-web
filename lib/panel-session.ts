import { randomUUID } from 'node:crypto';
import { decodeJwt } from 'jose';
import type { Payload } from 'payload';

/**
 * Sesión del panel municipal: una cookie propia, `planta14_panel` (httpOnly, Secure, SameSite=Lax, ruta /), compartida
 * por todas las pestañas, que dura 14 días y se renueva con el uso. Solo la borran «Cerrar sesión» o la caducidad.
 *
 * Por qué no la cookie de Payload (`payload-token`):
 * - Payload solo la acepta si el navegador declara la navegación del mismo sitio (Sec-Fetch-Site). Al abrir el panel
 *   desde un enlace de otro sitio (correo web, WhatsApp, un documento) pedía la contraseña aunque la sesión siguiera viva.
 * - Caducaba a las 2 horas y el panel nunca la renovaba.
 * - Es la misma que la del CMS: entrar o salir en uno echaba al otro en el mismo navegador.
 *
 * El valor es un token de Payload (mismo formato, firma y versión) cuya sesión queda en `users.sessions` con 14 días:
 * Payload lo valida como los suyos (usuario, sesión y caducidad) cuando llega en la cabecera `Authorization: JWT …`,
 * que no depende de Sec-Fetch-Site. Otro sitio no puede usarla salvo para navegar (SameSite=Lax); además, una petición
 * con un Origin ajeno no la usa.
 */
export const PANEL_COOKIE = 'planta14_panel';
export const PANEL_SESSION_DAYS = 14;
const PANEL_SESSION_SECONDS = PANEL_SESSION_DAYS * 24 * 3600;
/** Se renueva (nuevo vencimiento a 14 días) cuando el token tiene más de un día. */
const RENEW_AFTER_SECONDS = 24 * 3600;

type SessionUser = { id: number; email: string; collection?: string; sessions?: { id: string; createdAt?: string | Date | null; expiresAt: string | Date }[] | null } & Record<string, unknown>;

export function readPanelToken(headers: Headers): string | null {
  const raw = headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === PANEL_COOKIE && value.length) return decodeURIComponent(value.join('='));
  }
  return null;
}

/** ¿La petición viene de la propia web? Para todo lo que no sea leer (entrar, salir, guardar). */
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (origin) return origin === new URL(request.url).origin || allowedOrigins().includes(origin);
  return site === 'same-origin';
}
function allowedOrigins() {
  return [process.env.CMS_SERVER_URL, process.env.SITE_URL].filter(Boolean).map(value => new URL(String(value)).origin);
}

/**
 * Cabeceras con las que autenticar al usuario del panel: si hay cookie del panel, solo `Authorization: JWT …` (sin la
 * cookie del CMS, para que no se mezclen); si no, las de la petición, como hasta ahora (sesiones abiertas antes).
 * Una petición con un Origin de otro sitio nunca usa la cookie del panel.
 */
export function panelAuthHeaders(headers: Headers): Headers {
  const token = readPanelToken(headers);
  const origin = headers.get('origin');
  if (!token || (origin && !allowedOrigins().includes(origin) && !sameHost(origin, headers))) return headers;
  return new Headers({ Authorization: `JWT ${token}` });
}
function sameHost(origin: string, headers: Headers) {
  try { return new URL(origin).host === headers.get('host'); } catch { return false; }
}

export function panelCookie(token: string, maxAge = PANEL_SESSION_SECONDS) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${PANEL_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
export const clearPanelCookie = () => panelCookie('', 0);

async function sign(payload: Payload, user: SessionUser, sid: string) {
  const { getFieldsToSign, jwtSign } = await import('payload');
  const collectionConfig = payload.collections.users.config;
  const fieldsToSign = getFieldsToSign({ collectionConfig, email: user.email, user: { ...user, collection: 'users' } as never });
  const { token, exp } = await jwtSign({ fieldsToSign: { ...fieldsToSign, sid }, secret: payload.secret, tokenExpiration: PANEL_SESSION_SECONDS });
  return { token, exp };
}

async function rawUser(payload: Payload, id: number) {
  const user = await payload.db.findOne<SessionUser>({ collection: 'users', where: { id: { equals: id } } });
  if (!user) throw new Error('Usuario no encontrado');
  return user;
}
async function saveSessions(payload: Payload, user: SessionUser, sessions: NonNullable<SessionUser['sessions']>) {
  // Como Payload al iniciar sesión (addSessionToUser): el usuario tal cual está en la base de datos, con las sesiones
  // nuevas y updatedAt a null para no cambiar la fecha de modificación; sin hooks.
  await payload.db.updateOne({ collection: 'users', id: user.id, data: { ...user, sessions, updatedAt: null } as never, returning: false } as never);
}

/** Abre una sesión del panel de 14 días para el usuario y devuelve su token. */
export async function createPanelSession(payload: Payload, userID: number) {
  const user = await rawUser(payload, userID);
  const now = new Date(), sid = randomUUID();
  const live = (user.sessions ?? []).filter(s => new Date(s.expiresAt) > now);
  await saveSessions(payload, user, [...live, { id: sid, createdAt: now, expiresAt: new Date(now.getTime() + PANEL_SESSION_SECONDS * 1000) }]);
  return sign(payload, user, sid);
}

/** Quita una sesión (la del token que se cierra, o la que Payload abre de paso al comprobar la contraseña). */
export async function revokeSession(payload: Payload, userID: number, sid: string | undefined) {
  if (!sid) return;
  const user = await rawUser(payload, userID);
  const sessions = user.sessions ?? [];
  if (sessions.some(s => s.id === sid)) await saveSessions(payload, user, sessions.filter(s => s.id !== sid));
}

export const tokenSid = (token: string) => { try { return String(decodeJwt(token).sid ?? '') || undefined; } catch { return undefined; } };
const tokenIssuedAt = (token: string) => { try { return Number(decodeJwt(token).iat ?? 0); } catch { return 0; } };

/**
 * Renovación con el uso: si el token tiene más de un día, alarga su sesión a 14 días desde ahora y devuelve un token
 * nuevo con la misma sesión. Si no hace falta, null.
 */
export async function renewPanelSession(payload: Payload, userID: number, token: string) {
  if (Date.now() / 1000 - tokenIssuedAt(token) < RENEW_AFTER_SECONDS) return null;
  const sid = tokenSid(token);
  const user = await rawUser(payload, userID);
  const sessions = user.sessions ?? [];
  if (!sid || !sessions.some(s => s.id === sid)) return null;
  const expiresAt = new Date(Date.now() + PANEL_SESSION_SECONDS * 1000);
  await saveSessions(payload, user, sessions.map(s => s.id === sid ? { ...s, expiresAt } : s));
  return sign(payload, user, sid);
}
