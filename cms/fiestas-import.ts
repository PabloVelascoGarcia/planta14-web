import type { Payload, Where } from 'payload';
import { paragraphsToLexical } from '../lib/rich-text';
import { dayToStored, festivalSlug } from './festivals';
import { validateRecord } from './import-validate';

/**
 * npm run cms:fiestas:importar -- archivo.json [--publicar] [--solo-comprobar]
 * Acepta dos formatos:
 *
 * 1. Lista de fiestas con fecha (docs/ejemplos/fiestas.json): nombre, pueblo, concejo, inicio y fin (AAAA-MM-DD), programa
 *    (párrafos separados por una línea en blanco), organizador y contacto (no públicos) y seRepite. Entran como borrador
 *    salvo con --publicar. Una fiesta que ya existe (mismo nombre, pueblo y año) no se duplica ni se modifica.
 *
 * 2. Catálogo de fiestas (contenido-ensayo/fiestas-caudal.json, rama desarrollo/planta14-contenido-ensayo): objeto con la
 *    lista en «fiestas» (id, nombre, pueblo_o_parroquia, concejo, fechas_habituales, fechas_2025, descripcion,
 *    actos_tipicos, organizador, se_repite_cada_ano, fuentes_consultadas, carteles, dudas, verificacion).
 *    - TODAS entran como BORRADOR (se rechaza --publicar): los periodistas confirman las fechas.
 *    - Las fechas de 2025 se guardan solo como referencia («Fecha orientativa (2025)»); nunca se trasladan a otro año.
 *      Estado de la fecha: «Fecha orientativa (2025)» si hay alguna fecha de 2025 y «Fecha pendiente» si no.
 *    - Se conservan concejo, pueblo o parroquia, descripción, fechas habituales, organizador y fuentes; actos, carteles,
 *      dudas y verificación van a «Notas del catálogo» (no se publican).
 *    - Se puede repetir: se identifica cada fiesta por su «id»; lo que ya existe no se duplica ni se modifica.
 *
 * En los dos formatos se valida TODO antes de escribir (también con --solo-comprobar), contra el esquema real de la
 * colección: si hay errores se informan todos y no se importa nada.
 */
export type FiestaJSON = { nombre: string; pueblo: string; concejo: string; inicio: string; fin?: string; programa?: string; organizador?: string; contacto?: string; seRepite?: boolean };
type Item = Record<string, unknown>;
type Report = { formato: 'lista' | 'catalogo'; creadas: string[]; existentes: string[]; errores: string[]; pendientes: number; orientativas: number };

const normal = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const day = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
const es = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
const SKIP = ['slug', 'startDay', 'endDay', 'origin', 'submission', 'image', 'chronicle', 'program'];

/** Texto de referencia con las fechas documentadas en 2025 (o null si no hay ninguna). */
export function referenceDates2025(value: unknown): string | null {
  const f = (value ?? {}) as { inicio?: string | null; fin?: string | null; dias_confirmados?: string[]; dia_principal?: string | null; festivo_laboral?: string | null; estado?: string; nota?: string | null };
  const parts = [
    f.inicio && f.fin ? `del ${es(f.inicio)} al ${es(f.fin)}` : f.inicio ? `desde el ${es(f.inicio)} (fin sin confirmar)` : f.fin ? `hasta el ${es(f.fin)}` : null,
    f.dias_confirmados?.length ? `días ${f.dias_confirmados.filter(d => day.test(d)).map(es).join(', ')}` : null,
    f.dia_principal ? `día principal ${es(f.dia_principal)}` : null,
    f.festivo_laboral ? `festivo local el ${es(f.festivo_laboral)}` : null,
  ].filter(Boolean);
  if (!parts.length) return null;
  return `Fecha orientativa (2025): ${parts.join('; ')}. Estado en el catálogo: ${f.estado ?? 'sin indicar'}.${f.nota ? ` ${f.nota}` : ''} No es una fecha de 2026: confírmala antes de publicar.`;
}

export async function importFiestas(payload: Payload, json: unknown, opts: { publicar: boolean; soloComprobar: boolean }): Promise<Report> {
  const catalog = !Array.isArray(json) && Array.isArray((json as Item)?.fiestas);
  if (!Array.isArray(json) && !catalog) throw new Error('El JSON debe ser una lista de fiestas o un catálogo con la lista en «fiestas»');
  const towns = (await payload.find({ collection: 'towns', pagination: false, depth: 0, overrideAccess: true })).docs;
  const townOf = (v: unknown) => towns.find(t => t.slug === normal(String(v ?? '')) || normal(t.name) === normal(String(v ?? '')));
  const report: Report = { formato: catalog ? 'catalogo' : 'lista', creadas: [], existentes: [], errores: [], pendientes: 0, orientativas: 0 };
  if (catalog && opts.publicar) { report.errores.push('El catálogo entra siempre como borrador: quita --publicar (los periodistas confirman las fechas y publican).'); return report; }
  const items = (catalog ? (json as Item).fiestas : json) as unknown[];

  // 1. Se construyen y validan todos los registros antes de escribir nada.
  const seen = new Set<string>();
  const records = items.map((raw, index) => {
    const item = (raw ?? {}) as Item;
    const problems: string[] = [];
    let data: Record<string, unknown>, key = '', label = '';
    if (catalog) {
      const id = text(item.id), name = text(item.nombre), village = text(item.pueblo_o_parroquia), town = townOf(item.concejo);
      label = `${name ?? '¿?'} (${village ?? '¿?'})`;
      if (!id) problems.push('falta el id'); else if (seen.has(id)) problems.push('id repetido en el archivo'); else seen.add(id);
      if (!town) problems.push(`concejo desconocido «${item.concejo ?? ''}»`);
      const reference = referenceDates2025(item.fechas_2025);
      const usual = (item.fechas_habituales ?? {}) as Item, repeats = (item.se_repite_cada_ano ?? {}) as Item, organizer = (item.organizador ?? {}) as Item;
      const actos = (item.actos_tipicos ?? {}) as Item;
      const sources = ((item.fuentes_consultadas as Item[]) ?? []).filter(f => text(f?.url)).map(f => ({ url: String(f.url), title: [text(f.entidad), text(f.titulo)].filter(Boolean).join(': ').slice(0, 300) || null }));
      const notes = [
        Array.isArray(actos.actos) && actos.actos.length ? `Actos habituales (${actos.estado ?? 'sin estado'}): ${(actos.actos as string[]).join(', ')}.${actos.nota ? ` ${actos.nota}` : ''}` : null,
        ...((item.carteles as Item[]) ?? []).map(c => `Cartel: ${c.url_publicacion ?? c.url_archivo ?? ''}${c.nota ? ` (${c.nota})` : ''}`),
        repeats.nota ? `Periodicidad: ${repeats.estado ?? ''}. ${repeats.nota}` : null,
        ...((item.dudas as unknown[]) ?? []).map(d => `Duda: ${typeof d === 'string' ? d : JSON.stringify(d)}`),
        text(item.verificacion) ? `Verificación: ${item.verificacion}` : null,
      ].filter(Boolean).join('\n');
      key = id ?? '';
      data = { name, village, town: town?.id, dateStatus: reference ? 'orientativa' : 'pendiente', startDate: null, endDate: null,
        referenceDates: reference, usualDates: text(usual.texto), description: text(item.descripcion), organizer: text(organizer.nombre),
        recurring: repeats.valor !== false, sources, catalogNotes: notes || null, externalID: id, _status: 'draft' };
    } else {
      const f = item as unknown as FiestaJSON;
      const town = townOf(f.concejo);
      label = `${text(f.nombre) ?? '¿?'} (${text(f.pueblo) ?? '¿?'}, ${f.inicio ?? '¿?'})`;
      if (!town) problems.push(`concejo desconocido «${f.concejo ?? ''}»`);
      if (!day.test(String(f.inicio))) problems.push('inicio no es AAAA-MM-DD');
      if (f.fin && !day.test(String(f.fin))) problems.push('fin no es AAAA-MM-DD');
      if (f.fin && day.test(String(f.fin)) && String(f.fin) < String(f.inicio)) problems.push('fin anterior al inicio');
      const program = String(f.programa ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
      key = text(f.nombre) && text(f.pueblo) && day.test(String(f.inicio)) ? festivalSlug(f.nombre.trim(), f.pueblo.trim(), f.inicio) : '';
      if (key && seen.has(key)) problems.push('fiesta repetida en el archivo'); else if (key) seen.add(key);
      data = { name: text(f.nombre), village: text(f.pueblo), town: town?.id, dateStatus: 'confirmada',
        startDate: day.test(String(f.inicio)) ? dayToStored(f.inicio) : null, endDate: day.test(String(f.fin || f.inicio)) ? dayToStored(f.fin || f.inicio) : null,
        ...(program.length ? { program: paragraphsToLexical(program) } : {}), organizer: text(f.organizador), contact: text(f.contacto),
        recurring: f.seRepite !== false, slug: key || undefined, _status: opts.publicar ? 'published' : 'draft' };
    }
    problems.push(...validateRecord(payload, 'festivals', data, SKIP));
    if (problems.length) report.errores.push(`#${index + 1} ${label}: ${problems.join('; ')}`);
    return { data, key, label };
  });
  if (report.errores.length) return report;

  // 2. Escritura idempotente: por el id del catálogo o, en la lista, por nombre, pueblo y año.
  for (const { data, key, label } of records) {
    const where: Where = catalog ? { externalID: { equals: key } } : { slug: { equals: key } };
    const exists = await payload.find({ collection: 'festivals', where, limit: 1, depth: 0, overrideAccess: true, draft: true });
    if (exists.docs.length) { report.existentes.push(label); continue; }
    report.creadas.push(label);
    if (data.dateStatus === 'pendiente') report.pendientes++;
    if (data.dateStatus === 'orientativa') report.orientativas++;
    if (opts.soloComprobar) continue;
    await payload.create({ collection: 'festivals', overrideAccess: true, draft: data._status !== 'published', data: data as never });
  }
  return report;
}
