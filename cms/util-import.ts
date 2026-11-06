import type { Payload, Where } from 'payload';
import { slugText } from './content-collections';
import { validateRecord } from './import-validate';
import { reducirFoto } from './ensayo';
import { download, trackFrom, type Track } from './util-tracks';

/**
 * Importadores de la sección «Útil» desde datos-servicios/*.json (rama desarrollo/planta14-contenido-ensayo):
 *   npm run cms:patrimonio:importar -- patrimonio.json [--publicar] [--solo-comprobar]
 *   npm run cms:rutas:importar -- rutas.json [--publicar] [--solo-comprobar]
 *   npm run cms:servicios:importar -- servicios-municipales.json [--solo-comprobar]
 * El archivo es un objeto con la lista en «registros» (o directamente la lista). Cada registro lleva «id», que sirve para
 * no duplicar: se puede repetir y lo que ya existe no se toca. Primero se valida todo: si hay un error no se importa nada.
 * Patrimonio y rutas entran sin publicar salvo con --publicar. Las «dudas» (y los registros «comprobado_con_pendientes»)
 * quedan en un campo que solo ve la redacción, con el aviso «Dudoso» en el CMS; sin coordenadas WGS84 comprobadas, el aviso
 * «Coordenadas pendientes» (salen en la lista pero no en el mapa).
 * Fotos de patrimonio: la de Wikimedia Commons anotada en el registro se sube a Imágenes (miniatura de 1920 px) con su autor,
 * su licencia y la declaración de la administración; sin foto, la ficha usa el diseño neutro.
 * Recorridos: se descarga el GPX directo; si el enlace oficial es un ZIP se toman sus GPX (sin variantes ciclistas) o sus
 * PLT; un PLT solo se convierte si declara WGS 84. Si no se puede, queda solo el enlace de descarga oficial.
 * Al repetir, los registros existentes no se modifican, salvo para completar la foto o el recorrido que faltaran (p. ej.
 * si la descarga falló la vez anterior). No se importan las farmacias (el Colegio de Farmacéuticos no ha confirmado permiso
 * de reutilización; «Útil» enlaza su buscador).
 */
export type UtilImportKind = 'patrimonio' | 'rutas' | 'servicios';
type Item = Record<string, unknown>;
const normal = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number') && String(value).trim() ? String(value).trim() : null;
const num = (value: unknown) => value === undefined || value === null || value === '' ? null : Number(String(value).replace(',', '.'));
const urls = (value: unknown) => (Array.isArray(value) ? value : [value]).map(text).filter((u): u is string => Boolean(u && /^https?:\/\//.test(u)));
const doubts = (value: unknown) => (Array.isArray(value) ? value.map(text).filter(Boolean).join('\n') : text(value)) || null;
/** Tipos de datos-servicios → tipos del directorio. «farmacia» no se importa. */
const SERVICE_TYPES: Record<string, string> = {
  ayuntamiento: 'ayuntamiento', 'atencion-primaria': 'salud', biblioteca: 'cultura', 'instalacion-deportiva': 'deportes', 'oficina-turismo': 'turismo',
  'informacion-turistica-municipal': 'turismo', 'punto-limpio': 'medio-ambiente', 'punto-limpio-fijo': 'medio-ambiente', 'punto-limpio-movil': 'medio-ambiente',
};
const OPERATIONAL: Record<string, string> = { 'cierre-anunciado': 'Cierre anunciado.', 'cierre-anunciado-pendiente-de-confirmacion': 'Cierre anunciado, pendiente de confirmar.', 'apertura-pendiente-de-confirmacion': 'Apertura pendiente de confirmar.' };

export async function importUtil(payload: Payload, kind: UtilImportKind, json: unknown, opts: { publicar: boolean; soloComprobar: boolean }) {
  const items = Array.isArray(json) ? json : (json as Record<string, unknown>)?.registros;
  if (!Array.isArray(items)) throw new Error('El JSON debe tener la lista en «registros»');
  const towns = (await payload.find({ collection: 'towns', pagination: false, depth: 0, overrideAccess: true })).docs;
  const townOf = (value: unknown) => towns.find(t => t.slug === normal(value) || normal(t.name) === normal(value));
  const report = { creadas: [] as string[], existentes: [] as string[], completadas: [] as string[], omitidas: [] as string[], avisos: [] as string[], errores: [] as string[] };
  const admin = (await payload.find({ collection: 'users', where: { role: { equals: 'admin' } }, sort: 'id', limit: 1, depth: 0, overrideAccess: true })).docs[0];
  const collection = kind === 'patrimonio' ? 'heritage' : kind === 'rutas' ? 'routes' : 'municipal-services';
  // 1. Se construyen todos los registros (sin descargas) y se validan contra el esquema real de la colección.
  //    Si hay algún error, se informan todos y no se escribe nada.
  const seen = new Set<string>();
  const valid = items.map((raw, index) => {
    const item = (raw ?? {}) as Item;
    const name = text(item.nombre), id = text(item.id);
    const town = townOf(item.concejo);
    const coords = (item.coordenadas ?? {}) as Item;
    // Solo WGS84: otras proyecciones (UTM) se conservan como nota y la ficha queda con «coordenadas pendientes».
    const wgs = !coords.sistema || /^WGS ?84$/i.test(String(coords.sistema));
    const lat = wgs ? num(coords.latitud) : null, lon = wgs ? num(coords.longitud) : null;
    const type = normal(item.tipo);
    const skip = kind === 'servicios' && type === 'farmacia';
    const where = `#${index + 1}${name ? ` «${name}»` : ''}${id ? ` (${id})` : ''}`;
    const problems = skip ? [] : [
      !name && 'falta el nombre', !id && 'falta el id', id && seen.has(id) && 'id repetido en el archivo', !town && `concejo desconocido «${item.concejo ?? ''}»`,
      (lat !== null && !(lat > 42 && lat < 44.5)) && 'latitud fuera de Asturias', (lon !== null && !(lon > -7.5 && lon < -4.5)) && 'longitud fuera de Asturias',
      (lat === null) !== (lon === null) && 'falta latitud o longitud',
      kind === 'servicios' && !SERVICE_TYPES[type] && `tipo desconocido «${item.tipo ?? ''}»`,
      kind === 'rutas' && item.distanciaKm != null && !Number.isFinite(num(item.distanciaKm)) && 'distanciaKm no es un número',
    ].filter(Boolean) as string[];
    if (id) seen.add(id);
    const data = skip || !name ? null : build(item, name, id ?? '', town ?? { id: undefined as unknown as number, slug: '' }, lat, lon, type);
    if (data) problems.push(...validateRecord(payload, collection, data, ['slug', 'image', 'track', 'trackNote', 'gpxLabel', 'review', 'reviewed']));
    if (problems.length) report.errores.push(`${where}: ${problems.join('; ')}`);
    return { item, name: name!, id: id!, town: town!, type, skip, data: data! };
  });
  if (report.errores.length) return report;
  const farmacias = valid.filter(v => v.skip).length;
  if (farmacias) report.omitidas.push(`${farmacias} farmacias (el Colegio de Farmacéuticos no ha confirmado permiso de reutilización: «Útil» enlaza su buscador)`);
  // 2. Escritura idempotente por «id»: lo que ya existe no se duplica ni se pisa (solo se completan foto o recorrido).
  for (const { item, name, id, town, skip, data } of valid) {
    if (skip) continue;
    const label = `${name} (${town.name})`;
    const where: Where = { externalID: { equals: id } };
    const existing = (await payload.find({ collection, where, limit: 1, depth: 0, overrideAccess: true })).docs[0] as { id: number; image?: unknown; track?: unknown; checkedAt?: string | null } | undefined;
    const foto = kind === 'patrimonio' ? (item.foto as Item | null) : null;
    const trackURL = kind === 'rutas' ? (urls(item.gpxOficial)[0] ?? urls(item.enlaceAlternativo).find(u => !/wikiloc\./i.test(u)) ?? null) : null;
    if (existing) {
      const patch: Record<string, unknown> = {};
      if (foto && !existing.image && !opts.soloComprobar) { const image = await photo(foto, name); if (image) patch.image = image; }
      if (trackURL && !(Array.isArray(existing.track) && existing.track.length) && !opts.soloComprobar) {
        const t = await route(trackURL, name); if (t.track) Object.assign(patch, { track: t.track, trackNote: t.note });
      }
      // Servicios: la fecha de comprobación, si faltaba (los importados antes de guardarla).
      if (kind === 'servicios' && !existing.checkedAt && (data as { checkedAt?: string | null }).checkedAt && !opts.soloComprobar) patch.checkedAt = (data as { checkedAt: string }).checkedAt;
      if (Object.keys(patch).length) { await payload.update({ collection, id: existing.id, overrideAccess: true, data: patch as never }); report.completadas.push(`${label}: ${Object.keys(patch).includes('image') ? 'foto' : Object.keys(patch).includes('track') ? 'recorrido' : 'fecha de comprobación'}`); }
      else report.existentes.push(label);
      continue;
    }
    report.creadas.push(label);
    if (opts.soloComprobar) continue;
    if (kind === 'patrimonio') data.image = foto ? await photo(foto, name) : null;
    if (kind === 'rutas') {
      const t = trackURL ? await route(trackURL, name) : { track: null, note: '' };
      const first = t.track?.[0]?.[0];
      const link = data.gpxUrl as string | null;
      Object.assign(data, { track: t.track, trackNote: t.note || null, lat: data.lat ?? first?.[0] ?? null, lon: data.lon ?? first?.[1] ?? null,
        gpxLabel: !link ? null : /wikiloc\./i.test(link) ? 'Ver la ruta en Wikiloc (enlace de la fuente)' : t.note.includes('PLT') || /PLT/.test(JSON.stringify(item.dudas ?? '')) ? 'Descarga oficial del track (OziExplorer PLT)' : t.note.startsWith('ZIP') ? 'Descarga oficial de los tracks (ZIP)' : 'Track GPX oficial' });
    }
    await payload.create({ collection, overrideAccess: true, data: data as never });
  }
  return report;

  /** Datos del registro tal como se guardarán (sin foto ni recorrido, que se descargan al escribir). */
  function build(item: Item, name: string, id: string, town: { id: number; slug: string }, lat: number | null, lon: number | null, type: string): Record<string, unknown> {
    const sources = urls(item.fuentesOficiales ?? item.fuentes).map(url => ({ url }));
    const dudoso = doubts(item.dudas) ?? (/pendientes/.test(String(item.estado ?? '')) ? 'Marcado como «comprobado con pendientes» en datos-servicios.' : null);
    if (kind === 'patrimonio') {
      const protection = (item.proteccionLegal ?? {}) as Item;
      const coords = (item.coordenadas ?? {}) as Item;
      const utm = lat === null && coords.sistema && !/^WGS/i.test(String(coords.sistema)) ? `Pendiente de convertir a WGS84 (origen en ${coords.sistema}: ${Object.entries(coords).filter(([k]) => !['sistema', 'referencia', 'fuente'].includes(k)).map(([k, v]) => `${k} ${v}`).join(', ')})` : null;
      return { name, town: town.id, kind: text(item.tipo), place: text(item.localidad), description: text(item.descripcion),
        protection: [text(protection.figura), text(protection.norma)].filter(Boolean).join(' · ') || null, protectionUrl: urls(protection.fuente)[0] ?? null,
        lat, lon, coordinatesNote: [text(coords.referencia), utm].filter(Boolean).join(' · ') || null, sources, doubts: dudoso, externalID: id, published: opts.publicar,
        slug: slugText(`${name} ${town.slug}`).slice(0, 90) };
    }
    if (kind === 'rutas') {
      const elevation = (item.desnivel ?? {}) as Item;
      const otherNames = ((item.otrosConcejos as unknown[]) ?? []).map(t => text(t)).filter((t): t is string => Boolean(t));
      const others = otherNames.map(t => townOf(t)?.id).filter((t): t is number => typeof t === 'number' && t !== town.id);
      return { name, town: town.id, code: text(item.codigo), otherTowns: others, alsoIn: otherNames.join(', ') || null, start: text(item.inicio), end: text(item.fin),
        distanceKm: num(item.distanciaKm), distanceNote: text(item.distanciaCorrespondeA), elevationUp: num(elevation.positivoMetros), elevationDown: num(elevation.negativoMetros),
        difficulty: text(item.dificultad), duration: text(item.tiempo), description: text(item.descripcion), gpxUrl: urls(item.gpxOficial)[0] ?? urls(item.enlaceAlternativo)[0] ?? null,
        lat, lon, sources, doubts: dudoso, externalID: id, published: opts.publicar, slug: slugText(`${name} ${town.slug}`).slice(0, 90) };
    }
    const phones = (Array.isArray(item.telefonos) ? item.telefonos : [item.telefonos]).map(text).filter(Boolean) as string[];
    return { name, town: town.id, category: SERVICE_TYPES[type], place: text(item.localidad), address: text(item.direccion),
      phone: phones.map(p => p.replace(/^(\d{3})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4')).join(' · ') || null, email: text(item.correo), web: urls(item.web)[0] ?? null,
      hours: text(item.horario), notes: OPERATIONAL[normal(item.estadoOperativo)] ?? null, sourceUrl: urls(item.fuentes)[0] ?? null,
      checkedAt: /^\d{4}-\d{2}-\d{2}$/.test(String(item.comprobacion ?? '')) ? String(item.comprobacion) : null,
      doubts: doubts(item.dudas), externalID: id, order: type === 'ayuntamiento' ? 1 : 100 };
  }

  /** Foto de Commons → Imágenes (o la que ya exista con la misma página de Commons). Si falla, la ficha queda sin foto. */
  async function photo(foto: Item, name: string): Promise<number | null> {
    const page = text(foto.paginaCommons), original = text(foto.archivoOriginal);
    if (!page || !original) return null;
    const found = (await payload.find({ collection: 'media', where: { sourceURL: { equals: page } }, limit: 1, depth: 0, overrideAccess: true })).docs[0];
    if (found) return found.id as number;
    if (!admin) { report.avisos.push(`${name}: sin foto (hace falta una cuenta de administración para declarar sus derechos)`); return null; }
    try {
      // Miniatura estándar de 1920 px de Commons (los anchos no estándar dan error); si el original es menor, el original.
      // Pausa entre fotos y reintentos con espera si Commons limita (HTTP 429), según su política de uso.
      const thumb = original.replace(/^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f]\/[0-9a-f]{2})\/([^/]+)$/, '$1/thumb/$2/$3/1920px-$3');
      const polite = async (url: string, max?: number) => {
        for (let attempt = 1; ; attempt++) {
          await new Promise(r => setTimeout(r, process.env.UTIL_IMPORT_PAUSE_MS ? Number(process.env.UTIL_IMPORT_PAUSE_MS) : 1000 * attempt));
          try { return await download(url, max); } catch (error) { if (attempt >= 3 || !String(error).includes('429')) throw error; }
        }
      };
      const file = thumb !== original ? await polite(thumb).catch(() => polite(original, 60 * 1024 * 1024)) : await polite(original, 60 * 1024 * 1024);
      if (!/^image\/(jpeg|png|webp)/.test(file.type)) throw new Error(`tipo ${file.type || 'desconocido'}`);
      const data = await reducirFoto(file.data);
      const author = text(foto.autor) ?? 'Autor desconocido', license = text(foto.licencia) ?? '';
      const statement = `v1 · Planta 14 (administración, ${admin.email}) declara que esta imagen procede de Wikimedia Commons (${page}), obra de ${author}, ` +
        `publicada con licencia ${license}${text(foto.enlaceLicencia) ? ` (${text(foto.enlaceLicencia)})` : ''}, y que se publica con esa atribución. Único cambio: tamaño reducido (miniatura de Commons, como mucho 2560 px).`;
      const doc = await payload.create({ collection: 'media', overrideAccess: true, user: admin, file: { data, mimetype: 'image/jpeg', name: `${slugText(name).slice(0, 60) || 'patrimonio'}-commons.jpg`, size: data.length },
        context: { adminRightsDeclaration: { statement } },
        data: { alt: text(foto.pie) ?? name, credit: `${author} / Wikimedia Commons / ${/public domain/i.test(license) ? 'Dominio público' : license}`, sourceURL: page,
          rightsHolder: author, rightsType: 'licencia', rightsScope: 'publicable' } as never });
      return doc.id as number;
    } catch (error) {
      report.avisos.push(`${name}: no se pudo descargar la foto (${error instanceof Error ? error.message : error}); queda sin foto`);
      return null;
    }
  }
  async function route(url: string, name: string): Promise<{ track: Track | null; note: string }> {
    try {
      const result = trackFrom((await download(url)).data);
      if (!result.track) report.avisos.push(`${name}: sin recorrido dibujado (${result.note}); queda el enlace de descarga oficial`);
      return result;
    } catch (error) {
      report.avisos.push(`${name}: no se pudo descargar el recorrido (${error instanceof Error ? error.message : error}); queda el enlace de descarga oficial`);
      return { track: null, note: '' };
    }
  }
}
