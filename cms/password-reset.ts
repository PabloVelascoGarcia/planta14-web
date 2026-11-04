import type { PayloadRequest } from 'payload';

/**
 * Correo de «He olvidado mi contraseña» (sustituye al texto por defecto de Payload).
 *
 * - Cuentas de la redacción (admin, editor): el enlace lleva a /cms/reset/<token>, la página de Payload.
 * - Cuentas municipales: no pueden usar /cms. El enlace lleva a /<concejo>/panel/restablecer#token=<token>, en su
 *   propio panel. El token va tras «#», así que el navegador no lo envía al servidor ni queda en los registros.
 */
export const RESET_EXPIRATION_MS = 60 * 60 * 1000;
/** Mínimo para todas las cuentas; lo exige el servidor (cms/collections.ts, Users). */
export const MIN_PASSWORD_LENGTH = 12;
export const RESET_SUBJECT = 'Planta 14: cambia tu contraseña';

type ResetUser = { name?: string | null; role?: string | null; municipalSpace?: unknown };

export function escapeHTML(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Dirección del enlace del correo. `spaceSlug`: el concejo de la cuenta municipal (null en las demás). */
export function resetLink(serverURL: string, token: string, spaceSlug: string | null) {
  const base = serverURL.replace(/\/+$/, '');
  const safeToken = encodeURIComponent(token);
  return spaceSlug ? `${base}/${encodeURIComponent(spaceSlug)}/panel/restablecer#token=${safeToken}` : `${base}/cms/reset/${safeToken}`;
}

/** Correo en HTML, con el aspecto de Planta 14 y sin imágenes ni recursos externos. */
export function resetEmailHTML({ link, name, spaceName }: { link: string; name?: string | null; spaceName?: string | null }) {
  const greeting = name?.trim() ? `Hola, ${escapeHTML(name.trim())}:` : 'Hola:';
  const where = spaceName ? `del panel de ${escapeHTML(spaceName)} en Planta 14` : 'de la redacción de Planta 14';
  const href = escapeHTML(link);
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${RESET_SUBJECT}</title></head>
<body style="margin:0;padding:0;background:#f4efe6;color:#28241f;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe6"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffaf4;border-top:4px solid #28241f">
<tr><td style="padding:28px 32px 8px"><div style="font-size:30px;font-weight:700;letter-spacing:-1px">Planta 14</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8d7961;margin-top:2px">Una voz para las Cuencas</div></td></tr>
<tr><td style="padding:16px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6">
<p style="margin:0 0 14px">${greeting}</p>
<p style="margin:0 0 14px">Hemos recibido una petición para cambiar la contraseña de tu cuenta ${where}.</p>
<p style="margin:0 0 22px">Pulsa el botón para elegir una contraseña nueva. El enlace sirve <strong>una sola vez</strong> y caduca en <strong>una hora</strong>.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#a4522d"><a href="${href}" style="display:inline-block;padding:14px 22px;color:#fffaf4;font-weight:700;text-decoration:none;font-size:16px">Elegir una contraseña nueva</a></td></tr></table>
<p style="margin:22px 0 6px;font-size:14px;color:#5d5348">Si el botón no funciona, copia esta dirección en el navegador:</p>
<p style="margin:0 0 22px;font-size:13px;word-break:break-all"><a href="${href}" style="color:#a4522d">${href}</a></p>
<p style="margin:0 0 14px;font-size:14px;color:#5d5348">Si no lo has pedido tú, ignora este correo: tu contraseña no cambia. No compartas este enlace con nadie.</p>
</td></tr>
<tr><td style="padding:16px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8d7961;border-top:1px solid #e4d9c9">Planta 14 · avisos@planta14.com · Este correo se envía de forma automática.</td></tr>
</table></td></tr></table></body></html>`;
}

/** Concejo (slug y nombre) de una cuenta municipal, o null. */
async function municipalSpace(req: PayloadRequest | undefined, user: ResetUser) {
  if (user.role !== 'municipal' || !req) return null;
  const raw = user.municipalSpace;
  const id = typeof raw === 'object' && raw ? (raw as { id?: unknown }).id : raw;
  if (id == null) return null;
  const space = await req.payload.findByID({ collection: 'municipal-spaces', id: id as number, depth: 1, overrideAccess: true, req }).catch(() => null);
  // Misma dirección que la web pública del espacio (lib/payload-content.ts): identificador de origen o slug del concejo.
  const town = space?.town && typeof space.town === 'object' ? (space.town as { slug?: string }) : null;
  const slug = space?.legacyID || town?.slug;
  return space && slug ? { slug: String(slug), name: String(space.name ?? '') } : null;
}

export const forgotPasswordOptions = {
  expiration: RESET_EXPIRATION_MS,
  generateEmailSubject: () => RESET_SUBJECT,
  generateEmailHTML: async (args?: { req?: PayloadRequest; token?: string; user?: ResetUser }) => {
    const { req, token = '', user = {} } = args ?? {};
    const space = await municipalSpace(req, user);
    const serverURL = req?.payload.config.serverURL || process.env.CMS_SERVER_URL || 'http://localhost:3000';
    return resetEmailHTML({ link: resetLink(serverURL, token, space?.slug ?? null), name: user.name, spaceName: space?.name ?? null });
  },
};
