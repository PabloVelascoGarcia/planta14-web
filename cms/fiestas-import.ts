import type { Payload } from 'payload';
import { paragraphsToLexical } from '../lib/rich-text';
import { dayToStored, festivalSlug } from './festivals';

/**
 * npm run cms:fiestas:importar -- archivo.json [--publicar] [--solo-comprobar]
 * Precarga de fiestas desde un JSON: una lista de objetos con
 *   nombre, pueblo, concejo (slug o nombre: «mieres», «Ribera de Arriba»), inicio y fin (AAAA-MM-DD),
 *   programa (texto; párrafos separados por una línea en blanco), organizador y contacto (no públicos),
 *   seRepite (true/false, por defecto true).
 * Entran como borrador salvo con --publicar. Se puede repetir: una fiesta que ya existe (mismo nombre, pueblo y año)
 * no se duplica ni se modifica.
 */
export type FiestaJSON = { nombre: string; pueblo: string; concejo: string; inicio: string; fin?: string; programa?: string; organizador?: string; contacto?: string; seRepite?: boolean };

const normal = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const day = /^\d{4}-\d{2}-\d{2}$/;

export async function importFiestas(payload: Payload, items: unknown, opts: { publicar: boolean; soloComprobar: boolean }) {
  if (!Array.isArray(items)) throw new Error('El JSON debe ser una lista de fiestas');
  const towns = (await payload.find({ collection: 'towns', pagination: false, depth: 0, overrideAccess: true })).docs;
  const report = { creadas: [] as string[], existentes: [] as string[], errores: [] as string[] };
  // Primero se valida todo: si hay un error, no se importa nada.
  const valid = items.map((raw, index) => {
    const item = raw as FiestaJSON;
    const where = `#${index + 1}${item?.nombre ? ` «${item.nombre}»` : ''}`;
    const town = towns.find(t => t.slug === normal(String(item?.concejo ?? '')));
    const problems = [
      !item?.nombre?.trim() && 'falta el nombre', !item?.pueblo?.trim() && 'falta el pueblo', !town && `concejo desconocido «${item?.concejo}»`,
      !day.test(String(item?.inicio)) && 'inicio no es AAAA-MM-DD', item?.fin && !day.test(String(item.fin)) && 'fin no es AAAA-MM-DD',
      item?.fin && day.test(String(item.fin)) && String(item.fin) < String(item.inicio) && 'fin anterior al inicio',
    ].filter(Boolean);
    if (problems.length) report.errores.push(`${where}: ${problems.join(', ')}`);
    return { item, town };
  });
  if (report.errores.length) return report;
  for (const { item, town } of valid) {
    const end = item.fin || item.inicio;
    const slug = festivalSlug(item.nombre.trim(), item.pueblo.trim(), item.inicio);
    const label = `${item.nombre.trim()} (${item.pueblo.trim()}, ${item.inicio})`;
    const exists = await payload.find({ collection: 'festivals', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true, draft: true });
    if (exists.docs.length) { report.existentes.push(label); continue; }
    report.creadas.push(label);
    if (opts.soloComprobar) continue;
    const program = String(item.programa ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    await payload.create({ collection: 'festivals', overrideAccess: true, draft: !opts.publicar, data: {
      name: item.nombre.trim(), village: item.pueblo.trim(), town: town!.id, startDate: dayToStored(item.inicio), endDate: dayToStored(end), slug,
      ...(program.length ? { program: paragraphsToLexical(program) } : {}), organizer: item.organizador?.trim() || null, contact: item.contacto?.trim() || null,
      recurring: item.seRepite !== false, _status: opts.publicar ? 'published' : 'draft' } as never });
  }
  return report;
}
