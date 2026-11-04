import { randomBytes } from 'node:crypto';
import type { Payload, PayloadRequest } from 'payload';
import { relationID } from './access';
import { emailAvailable } from './email';

/**
 * Periodista responsable de cada concejo: recibe lo que llega de fuera (publicaciones de los ayuntamientos, fiestas
 * enviadas por comisiones y asociaciones…) como aviso asignado en «Pendientes de revisar» y por correo.
 */
export const responsablesIniciales = [
  { email: 'velascolne@gmail.com', name: 'Andrés', towns: ['aller', 'mieres', 'morcin'] },
  { email: 'juansantospolalena@gmail.com', name: 'Juanfran Santos', towns: ['lena', 'riosa', 'ribera-de-arriba'] },
] as const;

type Responsible = { id: number; email: string; name?: string | null };

export async function responsibleOfTown(payload: Payload, townID: unknown, req?: PayloadRequest): Promise<Responsible | null> {
  const id = relationID(townID);
  if (id === null) return null;
  const town = await payload.findByID({ collection: 'towns', id, depth: 1, overrideAccess: true, req }).catch(() => null);
  const user = town?.responsible;
  return user && typeof user === 'object' && user.email ? { id: user.id, email: user.email, name: user.name } : null;
}

const cmsURL = (path: string) => `${(process.env.CMS_SERVER_URL || '').replace(/\/$/, '')}${path}`;

/**
 * Crea el aviso pendiente asignado al responsable del concejo y le escribe. Devuelve el aviso.
 * `fallbackEmailStatus`: estado del correo general (si no hay responsable al que escribir).
 */
export async function createPendingNotice(payload: Payload, req: PayloadRequest | undefined, entry: {
  kind: 'municipal-publication' | 'festival-submission' | 'letter-submission'; title: string; townID: unknown; townName?: string;
  data?: Record<string, unknown>; detail: string; fallbackEmailStatus?: 'disabled' | 'sent' | 'failed';
}) {
  const responsible = await responsibleOfTown(payload, entry.townID, req);
  const notice = await payload.create({ collection: 'notifications', overrideAccess: true, req, data: {
    kind: entry.kind, title: entry.title, assignedTo: responsible?.id ?? null, emailStatus: entry.fallbackEmailStatus ?? 'disabled', ...entry.data } as never });
  if (responsible && emailAvailable()) {
    let status: 'sent' | 'failed' = 'sent';
    try {
      await payload.sendEmail({ to: responsible.email, subject: `Pendiente de revisar: ${entry.title}`,
        text: `Hola${responsible.name ? `, ${responsible.name}` : ''}:\n\n${entry.detail}\n\nEres el periodista responsable de ${entry.townName || 'este concejo'} en Planta 14. ` +
          `Revísalo en el CMS («Pendientes de revisar» en el inicio):\n${cmsURL(`/cms/collections/notifications/${notice.id}`)}\n\n— Planta 14` });
    } catch (error) {
      status = 'failed';
      payload.logger.error({ err: error, msg: 'No se pudo avisar por correo al responsable del concejo' });
    }
    await payload.update({ collection: 'notifications', id: notice.id, overrideAccess: true, req, data: { emailStatus: status } });
    return { ...notice, emailStatus: status };
  }
  return notice;
}

/**
 * npm run cms:responsables: crea las cuentas de redacción de los responsables iniciales si no existen (contraseña
 * aleatoria que no se muestra: entran con «¿Olvidaste tu contraseña?») y las asigna a los concejos que no tengan
 * responsable. Se puede repetir: no cambia un responsable ya elegido.
 */
export async function cargarResponsables(payload: Payload) {
  const report: string[] = [];
  for (const entry of responsablesIniciales) {
    let user = (await payload.find({ collection: 'users', where: { email: { equals: entry.email } }, limit: 1, depth: 0, overrideAccess: true })).docs[0];
    if (!user) {
      user = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true },
        data: { name: entry.name, email: entry.email, role: 'editor', password: randomBytes(24).toString('base64url') } });
      report.push(`Cuenta creada: ${entry.name} <${entry.email}> (Redacción). Entra con «¿Olvidaste tu contraseña?».`);
    } else report.push(`Cuenta existente: ${user.name} <${entry.email}> (${user.role}).`);
    if (!['editor', 'admin'].includes(user.role)) { report.push(`  AVISO: ${entry.email} no es de la redacción; no se asigna.`); continue; }
    for (const slug of entry.towns) {
      const town = (await payload.find({ collection: 'towns', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })).docs[0];
      if (!town) { report.push(`  AVISO: no existe el concejo ${slug} (carga antes la estructura con npm run cms:structure).`); continue; }
      const current = relationID(town.responsible);
      if (current === null) {
        await payload.update({ collection: 'towns', id: town.id, overrideAccess: true, data: { responsible: user.id } });
        report.push(`  ${town.name}: responsable ${entry.name}.`);
      } else report.push(`  ${town.name}: ya tenía responsable (${current === user.id ? entry.name : `usuario ${current}`}); no se cambia.`);
    }
  }
  return report;
}
