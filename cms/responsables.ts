import { randomBytes } from 'node:crypto';
import type { Payload, PayloadRequest } from 'payload';
import { relationID } from './access';

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


/**
 * Crea la entrada de «Pendientes de revisar» con su concejo y su responsable. Si requiere intervención (fiestas,
 * cartas, sugerencias), avisa al momento solo al responsable del concejo (o al otro redactor si está «Fuera hasta»),
 * con el enlace directo a la bandeja. Las publicaciones municipales (`email: false`) solo quedan registradas.
 */
export async function createPendingNotice(payload: Payload, req: PayloadRequest | undefined, entry: {
  kind: 'municipal-publication' | 'festival-submission' | 'letter-submission' | 'suggestion'; title: string; townID: unknown; townName?: string;
  data?: Record<string, unknown>; detail: string; fallbackEmailStatus?: 'disabled' | 'sent' | 'failed'; email?: false; reviewed?: boolean;
}) {
  const responsible = await responsibleOfTown(payload, entry.townID, req);
  const townID = relationID(entry.townID);
  const notice = await payload.create({ collection: 'notifications', overrideAccess: true, req, data: {
    kind: entry.kind, title: entry.title, town: townID, assignedTo: responsible?.id ?? null, emailStatus: entry.fallbackEmailStatus ?? 'disabled',
    reviewed: entry.reviewed ?? false, ...entry.data } as never });
  if (entry.email === false) return notice;
  const { notifyInbox } = await import('./newsroom');
  const status = await notifyInbox(payload, req, notice, townID, entry.detail);
  if (status === 'disabled') return notice;
  await payload.update({ collection: 'notifications', id: notice.id, overrideAccess: true, req, data: { emailStatus: status } });
  return { ...notice, emailStatus: status };
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
