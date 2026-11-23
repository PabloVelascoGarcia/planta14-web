import type { ManualKey } from './manuals';

// Quién puede ver cada manual de la Ayuda: el de la redacción, la redacción y la administración (sesión del CMS); el
// del ayuntamiento, las cuentas municipales (sesión del panel) y la administración.
export async function helpAccess(headers: Headers): Promise<{ manuals: ManualKey[]; admin: boolean }> {
  const { contentClient } = await import('./payload-content');
  const payload = await contentClient();
  const { panelUser } = await import('./panel-session');
  const cms = await payload.auth({ headers }).then(r => r.user).catch(() => null) as { collection?: string; role?: string } | null;
  const editorial = cms?.collection === 'users' && (cms.role === 'admin' || cms.role === 'editor');
  const admin = editorial && cms!.role === 'admin';
  const municipal = Boolean(await panelUser(payload, headers).catch(() => null));
  const manuals: ManualKey[] = [];
  if (editorial) manuals.push('redaccion');
  if (municipal || admin) manuals.push('ayuntamiento');
  return { manuals, admin };
}
export const isManual = (value: unknown): value is ManualKey => value === 'redaccion' || value === 'ayuntamiento';
