import { randomUUID } from 'node:crypto';
import { decodeJwt } from 'jose';
import type { Payload } from 'payload';

/**
 * Sesión del panel municipal: una cookie propia (httpOnly, Secure, SameSite=Lax, ruta /), compartida por todas las
 * pestañas, que dura 14 días y se renueva con el uso. Solo la borran «Cerrar sesión» o la caducidad.
 *
 * Por qué no la cookie de Payload (`payload-token`): Payload solo la acepta si el navegador declara la navegación del
 * mismo sitio (al abrir el panel desde un enlace de otro sitio pedía la contraseña), caducaba a las 2 horas sin
 * renovarse y era la misma que la del CMS (entrar o salir en uno echaba al otro).
 *
 * Seguridad (revisión del 7/11):
 * - Nombre `__Host-planta14_panel` en producción: el navegador solo la acepta con Secure, ruta / y sin Domain, así
 *   que ni otro subdominio ni una respuesta sin HTTPS pueden fijarla (fijación de sesión).
 * - El valor es un token firmado con el secreto de Payload, con su sesión (`sid`) guardada en el usuario y caducidad a
 *   14 días. Se acepta solo si (1) la firma es válida y no ha caducado, (2) la sesión sigue en el usuario (al cerrar
 *   sesión, cambiar o restablecer la contraseña, cambiar el rol o el espacio, o desactivar el espacio, se borra),
 *   (3) es un token del panel (`aud`), no uno del CMS, (4) la cuenta es municipal, con espacio, y el espacio está activo.
 * - Nunca se usa con un Origin de otro sitio. Para cambiar datos, solo desde la propia web (`sameOrigin`).
 * - Una cookie copiada vale lo que una contraseña: hasta que se cierre sesión, caduque o se cambie la contraseña.
 */
export const PANEL_AUDIENCE = 'planta14-panel';
export const PANEL_SESSION_DAYS = 14;
const PANEL_SESSION_SECONDS = PANEL_SESSION_DAYS * 24 * 3600;
/** Se renueva (nuevo vencimiento a 14 días) cuando el token tiene más de un día. */
const RENEW_AFTER_SECONDS = 24 * 3600;
const secureCookies = () => process.env.NODE_ENV === 'production';
/** `__Host-` exige Secure, ruta / y ningún Domain: solo en producción (HTTPS). */
export const panelCookieName = () => (secureCookies() ? '__Host-planta14_panel' : 'planta14_panel');

type Session = { id: string; createdAt?: string | Date | null; expiresAt: string | Date };
type SessionUser = { id: number; email: string; role?: string | null; municipalSpace?: unknown; collection?: string; sessions?: Session[] | null } & Record<string, unknown>;

export function readPanelToken(headers: Headers): string | null {
  const name = panelCookieName();
  for (const part of (headers.get('cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name && value.length) return decodeURIComponent(value.join('='));
  }
  return null;
}

function allowedOrigins() {
  return [process.env.CMS_SERVER_URL, process.env.SITE_URL].filter(Boolean).map(value => new URL(String(value)).origin);
}
/** ¿Petición de la propia web? Obligatorio para todo lo que cambia datos (entrar, salir, renovar, guardar). */
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) return origin === new URL(request.url).origin || allowedOrigins().includes(origin) || sameHost(origin, request.headers);
  return request.headers.get('sec-fetch-site') === 'same-origin';
}
/** El Origin es la misma web que atiende la petición (cabecera Host; detrás de Caddy, el dominio público). */
function sameHost(origin: string, headers: Headers) {
  try { return new URL(origin).host === headers.get('host'); } catch { return false; }
}
function foreignOrigin(headers: Headers) {
  const origin = headers.get('origin');
  return Boolean(origin) && !allowedOrigins().includes(origin!) && !sameHost(origin!, headers);
}

const claims = (token: string) => { try { return decodeJwt(token); } catch { return null; } };
export const tokenSid = (token: string) => String(claims(token)?.sid ?? '') || undefined;

/** ¿Espacio municipal activo? (Misma regla que la web pública: estado activo o demo y dentro de sus fechas.) */
async function spaceActive(payload: Payload, spaceID: unknown) {
  const id = typeof spaceID === 'object' && spaceID ? (spaceID as { id: number }).id : Number(spaceID);
  if (!Number.isFinite(id)) return false;
  const space = await payload.findByID({ collection: 'municipal-spaces', id, depth: 0, overrideAccess: true }).catch(() => null) as { subscription?: { status?: string; startsAt?: string | null; endsAt?: string | null } } | null;
  const s = space?.subscription;
  if (!s) return false;
  const now = new Date();
  return s.status === 'demo' || (s.status === 'active' && (!s.startsAt || new Date(s.startsAt) <= now) && (!s.endsAt || new Date(`${s.endsAt}T23:59:59`) >= now));
}

/**
 * Valida el token del panel: firma, caducidad y sesión viva (Payload), que sea del panel y de una cuenta municipal con su
 * espacio activo. Devuelve el usuario o null.
 */
export async function verifyPanelToken(payload: Payload, token: string, { requireActive = true } = {}) {
  if (claims(token)?.aud !== PANEL_AUDIENCE) return null;
  const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}`, DisableAutologin: 'true' }) }).catch(() => ({ user: null }));
  if (!user || user.collection !== 'users' || user.role !== 'municipal' || !user.municipalSpace) return null;
  if (requireActive && !(await spaceActive(payload, user.municipalSpace))) return null;
  return user;
}

/** Usuario del panel de una petición (o null). Nunca con un Origin de otro sitio. */
export async function panelUser(payload: Payload, headers: Headers, options?: { requireActive?: boolean }) {
  const token = readPanelToken(headers);
  if (!token || foreignOrigin(headers)) return null;
  const user = await verifyPanelToken(payload, token, options);
  return user ? { user, token } : null;
}

export function panelCookie(token: string, maxAge = PANEL_SESSION_SECONDS) {
  return `${panelCookieName()}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookies() ? '; Secure' : ''}`;
}
export const clearPanelCookie = () => panelCookie('', 0);

async function sign(payload: Payload, user: SessionUser, sid: string) {
  const { getFieldsToSign, jwtSign } = await import('payload');
  const collectionConfig = payload.collections.users.config;
  const fieldsToSign = getFieldsToSign({ collectionConfig, email: user.email, user: { ...user, collection: 'users' } as never });
  return jwtSign({ fieldsToSign: { ...fieldsToSign, sid, aud: PANEL_AUDIENCE }, secret: payload.secret, tokenExpiration: PANEL_SESSION_SECONDS });
}

async function rawUser(payload: Payload, id: number) {
  const user = await payload.db.findOne<SessionUser>({ collection: 'users', where: { id: { equals: id } } });
  if (!user) throw new Error('Usuario no encontrado');
  return user;
}
async function saveSessions(payload: Payload, user: SessionUser, sessions: Session[]) {
  // Como Payload al iniciar sesión (addSessionToUser): el usuario tal cual está en la base de datos, con las sesiones
  // nuevas y updatedAt a null para no cambiar la fecha de modificación; sin hooks.
  await payload.db.updateOne({ collection: 'users', id: user.id, data: { ...user, sessions, updatedAt: null } as never, returning: false } as never);
}

/** Abre una sesión del panel de 14 días (sesión nueva siempre: nunca se reutiliza una que venga de fuera). */
export async function createPanelSession(payload: Payload, userID: number) {
  const user = await rawUser(payload, userID);
  const now = new Date(), sid = randomUUID();
  const live = (user.sessions ?? []).filter(s => new Date(s.expiresAt) > now);
  await saveSessions(payload, user, [...live, { id: sid, createdAt: now, expiresAt: new Date(now.getTime() + PANEL_SESSION_SECONDS * 1000) }]);
  return sign(payload, user, sid);
}

/** Quita una sesión del usuario (la del token que se cierra, o la que Payload abre de paso al comprobar la contraseña). */
export async function revokeSession(payload: Payload, userID: number, sid: string | undefined) {
  if (!sid) return;
  const user = await rawUser(payload, userID);
  const sessions = user.sessions ?? [];
  if (sessions.some(s => s.id === sid)) await saveSessions(payload, user, sessions.filter(s => s.id !== sid));
}

/** Quita todas las sesiones de los usuarios indicados (espacio desactivado, cuenta cambiada). */
export async function revokeAllSessions(payload: Payload, userIDs: number[]) {
  for (const id of userIDs) {
    const user = await rawUser(payload, id).catch(() => null);
    if (user?.sessions?.length) await saveSessions(payload, user, []);
  }
}

/**
 * Renovación con el uso: si el token tiene más de un día, alarga su sesión a 14 días desde ahora y devuelve un token
 * nuevo con la misma sesión. Si no hace falta, null.
 */
export async function renewPanelSession(payload: Payload, userID: number, token: string) {
  if (Date.now() / 1000 - Number(claims(token)?.iat ?? 0) < RENEW_AFTER_SECONDS) return null;
  const sid = tokenSid(token);
  const user = await rawUser(payload, userID);
  const sessions = user.sessions ?? [];
  if (!sid || !sessions.some(s => s.id === sid)) return null;
  const expiresAt = new Date(Date.now() + PANEL_SESSION_SECONDS * 1000);
  await saveSessions(payload, user, sessions.map(s => s.id === sid ? { ...s, expiresAt } : s));
  return sign(payload, user, sid);
}
