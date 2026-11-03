import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { Payload, Where } from 'payload';
import { paragraphsToLexical } from '../lib/rich-text';

/**
 * Carga y retirada del contenido de ensayo (contenido-ensayo/contenido.json y fotos.json).
 *
 * - Cada documento creado lleva `lote` = ensayo | definitivo (solo lo ve la administración).
 * - Es repetible: lo que ya existe (por legacyID, slug o ficha de Commons) no se duplica ni se modifica.
 * - La retirada solo borra lo marcado como `ensayo`; nunca lo que no lleve esa marca.
 * - No usa ni adapta el importador de la demo (cms/import-municipal.ts).
 */

type Lote = 'ensayo' | 'definitivo';
type Pieza = {
  id: string; tipo: string; lote: Lote; legacyID: string; slug: string; title: string; excerpt: string; body: string[] | string;
  section: string; town: string; showInTown: boolean; opinion: boolean; author: string; avisoEnsayo?: string;
  fotoNecesaria?: { imagen?: string };
  eventoGeneral?: { eventAt?: string | null; place?: string | null };
  space?: string; type?: string; eventAt?: string | null; place?: string | null; deadline?: string | null; expiresAt?: string | null;
};
type Foto = {
  id: string; paginaCommons: string; archivoOriginal: string; autor: string; licencia: string; enlaceLicencia: string;
  resolucion: { ancho: number; alto: number }; pieFoto: string; atribucion: string;
};
type Asignacion = { id: string; idPieza: string; uso: string; idFotografia: string };
type Conjunto = { piezas: Pieza[]; autores: { slug: string; name: string; role: string }[]; fotos: Foto[]; asignaciones: Asignacion[] };
type Ref = { id: number };
type Log = (line: string) => void;

export const ENSAYO_PROVENANCE = 'planta14-contenido-ensayo-2026-11';
const AVISO = /^Contenido ficticio de ensayo/;
const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export async function leerConjunto(dir: string): Promise<Conjunto> {
  const contenido = JSON.parse(await readFile(path.join(dir, 'contenido.json'), 'utf8'));
  const fotos = JSON.parse(await readFile(path.join(dir, 'fotos.json'), 'utf8'));
  const piezas = contenido.piezas as Pieza[];
  for (const p of piezas) if (p.lote !== 'ensayo' && p.lote !== 'definitivo') throw new Error(`Lote no válido en ${p.id}`);
  return { piezas, autores: contenido.autores, fotos: fotos.catalogo, asignaciones: fotos.asignaciones };
}

// --- Fechas (hora de Madrid) --------------------------------------------------------------------------
function madridDate(date: Date) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(date); }
function addDays(day: string, days: number) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
/** Instante UTC (ISO) de una fecha y hora de Madrid. */
export function madridToISO(day: string, time: string) {
  const guess = new Date(`${day}T${time}:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' }).formatToParts(guess).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const [, sign, hours, minutes] = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(offset) ?? ['', '+', '1', '0'];
  const ms = (Number(hours) * 60 + Number(minutes ?? 0)) * 60000 * (sign === '-' ? -1 : 1);
  return new Date(guess.getTime() - ms).toISOString();
}
function hash(text: string) { let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
const horasPublicacion = ['07:45', '08:20', '09:05', '09:50', '10:35', '11:15', '12:10', '13:05', '16:40', '17:30', '18:15', '19:05', '20:10', '21:00'];
const horasEvento = { laborable: ['18:00', '18:30', '19:00', '19:30'], sabado: ['11:00', '12:00', '17:30'], domingo: ['11:30', '12:30'] };
export function formatoFecha(day: string) { const [y, m, d] = day.split('-').map(Number); return `${d} de ${meses[m - 1]} de ${y}`; }

/** Publicaciones repartidas en los 4 días anteriores a la carga; eventos en las semanas siguientes. */
export function calendario(conjunto: Conjunto, now: Date) {
  const today = madridDate(now);
  const publicacion = new Map<string, { date: string; publishedAt: string }>();
  conjunto.piezas.forEach((p, i) => {
    const date = addDays(today, -(4 - (i % 4)));
    const time = horasPublicacion[hash(p.legacyID) % horasPublicacion.length];
    publicacion.set(p.legacyID, { date, publishedAt: madridToISO(date, time) });
  });
  const evento = new Map<string, string>();
  conjunto.piezas.filter(p => p.tipo === 'agenda_general' || p.type === 'event').forEach((p, k) => {
    const day = addDays(today, 6 + k * 3 + (hash(p.legacyID) % 3));
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const slots = weekday === 6 ? horasEvento.sabado : weekday === 0 ? horasEvento.domingo : horasEvento.laborable;
    evento.set(p.legacyID, `${day}T${slots[hash(p.slug) % slots.length]}`);
  });
  return { today, publicacion, evento };
}

/** El aviso «Contenido ficticio de ensayo…» pasa al final; la fecha antigua del evento se sustituye por la nueva. */
export function cuerpo(p: Pieza, oldDay: string | null, newDay: string | null): string[] {
  let parrafos = (Array.isArray(p.body) ? p.body : p.body.split(/\n\n+/)).map(t => t.trim()).filter(Boolean);
  if (oldDay && newDay) parrafos = parrafos.map(t => t.replaceAll(oldDay, formatoFecha(newDay)));
  const aviso = parrafos.filter(t => AVISO.test(t) || (p.avisoEnsayo && t === p.avisoEnsayo));
  return [...parrafos.filter(t => !aviso.includes(t)), ...aviso];
}

// --- Plan ---------------------------------------------------------------------------------------------
type Contexto = {
  admin: { id: number; email: string; role: string; collection: 'users' };
  sections: Map<string, number>; towns: Map<string, number>; spaces: Map<string, { id: number; subscription: { status: string; startsAt?: string | null; endsAt?: string | null }; ensayoPrevio?: unknown; _status?: string | null }>;
  authors: Map<string, Ref>;
};

async function adminUser(payload: Payload, email?: string) {
  const where: Where = email ? { and: [{ role: { equals: 'admin' } }, { email: { equals: email } }] } : { role: { equals: 'admin' } };
  const admin = (await payload.find({ collection: 'users', where, sort: 'id', limit: 1, depth: 0, overrideAccess: true })).docs[0];
  if (!admin) throw new Error(email ? `No hay ningún administrador con el correo ${email}` : 'No hay ningún administrador: créalo antes con npm run cms:bootstrap');
  // Documento completo (los hooks y la auditoría leen su rol, correo e id).
  return { ...admin, id: admin.id as number, email: admin.email as string, role: 'admin', collection: 'users' as const };
}

async function contexto(payload: Payload, usuario?: string): Promise<Contexto> {
  const all = async (collection: 'sections' | 'towns' | 'authors') => (await payload.find({ collection, pagination: false, depth: 0, overrideAccess: true })).docs as unknown as { id: number; slug: string }[];
  const towns = new Map((await all('towns')).map(t => [t.slug, t.id]));
  const spaces = new Map<string, Contexto['spaces'] extends Map<string, infer V> ? V : never>();
  for (const space of (await payload.find({ collection: 'municipal-spaces', pagination: false, depth: 0, overrideAccess: true, draft: true })).docs as unknown as { id: number; town: number }[]) {
    const slug = [...towns].find(([, id]) => id === space.town)?.[0];
    if (slug) spaces.set(slug, space as never);
  }
  return {
    admin: await adminUser(payload, usuario),
    sections: new Map((await all('sections')).map(s => [s.slug, s.id])), towns, spaces,
    authors: new Map((await all('authors')).map(a => [a.slug, { id: a.id }])),
  };
}

const findOne = async (payload: Payload, collection: 'articles' | 'municipal-content' | 'media', where: Where) =>
  (await payload.find({ collection, where, limit: 1, depth: 0, overrideAccess: true, draft: true })).docs[0] as { id: number; lote?: Lote | null } | undefined;

export type Informe = { creados: Record<string, number>; existentes: Record<string, number>; espacios: string[]; avisos: string[] };

// --- Fotos --------------------------------------------------------------------------------------------
const USER_AGENT = 'Planta14CargaEnsayo/1.0 (https://planta14.com; carga de ensayo, uso editorial con atribución)';
/** ENSAYO_FOTOS_BASE sustituye https://upload.wikimedia.org (solo pruebas sin acceso a Commons). */
function urlDescarga(original: string) {
  const base = process.env.ENSAYO_FOTOS_BASE;
  return base ? original.replace('https://upload.wikimedia.org', base.replace(/\/$/, '')) : original;
}
async function descargar(foto: Foto) {
  let last: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(urlDescarga(foto.archivoOriginal), { headers: { 'User-Agent': USER_AGENT } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = response.headers.get('content-type') || '';
      if (!/^image\/(jpeg|png|webp)/.test(type)) throw new Error(`tipo ${type || 'desconocido'}`);
      const data = Buffer.from(await response.arrayBuffer());
      const meta = await sharp(data).metadata();
      // Se comprueba que es el original anotado en fotos.json (misma resolución).
      if (meta.width !== foto.resolucion.ancho || meta.height !== foto.resolucion.alto) throw new Error(`resolución ${meta.width}×${meta.height}, se esperaba ${foto.resolucion.ancho}×${foto.resolucion.alto}`);
      const name = decodeURIComponent(foto.archivoOriginal.split('/').pop() || foto.id).replace(/\.[A-Za-z0-9]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '-');
      return { data: await reducirFoto(data), mimetype: 'image/jpeg', name: `${name}-2560.jpg` };
    } catch (error) { last = error; await new Promise(r => setTimeout(r, 1500 * attempt)); }
  }
  throw new Error(`No se pudo descargar ${foto.paginaCommons}: ${last instanceof Error ? last.message : String(last)}`);
}
/** Lado largo máximo de las fotos del ensayo: se reduce el original de Commons antes de subirlo (JPEG calidad 85). */
export const LADO_MAXIMO = 2560;
/**
 * Reduce una foto a LADO_MAXIMO px en el lado largo (sin ampliar), con la orientación aplicada y sin metadatos.
 * libvips decodifica el JPEG reduciendo ya al leer (shrink-on-load) y trabaja por franjas: la memoria no crece con
 * los megapíxeles del original (medido en scripts/ensayo-integration.mjs con 8104 × 4559).
 */
export async function reducirFoto(data: Buffer) {
  return sharp(data, { failOn: 'error' }).rotate()
    .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}
export const declaracionAdministracion = (foto: Foto, email: string) =>
  `v1 · Planta 14 (administración, ${email}) declara que esta imagen procede de Wikimedia Commons (${foto.paginaCommons}), obra de ${foto.autor}, ` +
  `publicada con licencia ${foto.licencia} (${foto.enlaceLicencia}), y que se publica con esa atribución. Único cambio: reducida a ${LADO_MAXIMO} px en el lado largo.`;

// --- Carga --------------------------------------------------------------------------------------------
export async function cargar(payload: Payload, opts: { dir: string; soloComprobar: boolean; now?: Date; usuario?: string; log: Log }): Promise<Informe> {
  const { log } = opts;
  const conjunto = await leerConjunto(opts.dir);
  const ctx = await contexto(payload, opts.usuario);
  const informe: Informe = { creados: {}, existentes: {}, espacios: [], avisos: [] };
  const count = (kind: 'creados' | 'existentes', key: string) => { informe[kind][key] = (informe[kind][key] ?? 0) + 1; };
  const { publicacion, evento } = calendario(conjunto, opts.now ?? new Date());
  const user = ctx.admin;
  const write = !opts.soloComprobar;

  // Estructura imprescindible.
  for (const p of conjunto.piezas) {
    if (!ctx.towns.has(p.town)) throw new Error(`Falta el concejo ${p.town}: carga antes la estructura (npm run cms:structure)`);
    if (!p.space && !ctx.sections.has(p.section)) throw new Error(`Falta la sección ${p.section}: carga antes la estructura (npm run cms:structure)`);
    if (p.space && !ctx.spaces.has(p.space)) throw new Error(`Falta el espacio municipal de ${p.space}: carga antes la estructura (npm run cms:structure)`);
  }

  // Lote de cada original: definitivo si lo usa alguna pieza definitiva.
  const piezaPorId = new Map(conjunto.piezas.map(p => [p.id, p]));
  const fotoDePieza = new Map(conjunto.asignaciones.filter(a => a.uso === 'contenido').map(a => [a.id, a.idFotografia]));
  const loteFoto = new Map<string, Lote>();
  for (const a of conjunto.asignaciones) {
    const pieza = piezaPorId.get(a.idPieza);
    if (pieza?.lote === 'definitivo' || loteFoto.get(a.idFotografia) === 'definitivo') loteFoto.set(a.idFotografia, 'definitivo');
    else loteFoto.set(a.idFotografia, 'ensayo');
  }

  // 1. Imágenes (los 19 originales; las candidatas de cabecera solo se suben).
  const media = new Map<string, number | null>();
  for (const foto of conjunto.fotos) {
    const existing = await findOne(payload, 'media', { sourceURL: { equals: foto.paginaCommons } });
    if (existing) { media.set(foto.id, existing.id); count('existentes', 'imágenes'); continue; }
    count('creados', 'imágenes');
    if (!write) { log(`  imagen nueva (${loteFoto.get(foto.id)}): ${foto.paginaCommons}`); media.set(foto.id, null); continue; }
    const file = await descargar(foto);
    const doc = await payload.create({
      collection: 'media', overrideAccess: true, user, file: { ...file, size: file.data.length },
      context: { adminRightsDeclaration: { statement: declaracionAdministracion(foto, user.email) } },
      data: { alt: foto.pieFoto, credit: `${foto.autor} / Wikimedia Commons / ${foto.licencia} (reducida de tamaño)`, sourceURL: foto.paginaCommons,
        rightsHolder: foto.autor, rightsType: 'licencia', rightsScope: 'publicable', lote: loteFoto.get(foto.id) ?? 'ensayo' },
    });
    media.set(foto.id, doc.id as number);
    log(`  imagen subida: ${foto.paginaCommons}`);
  }

  // 2. Autores que falten.
  for (const autor of conjunto.autores) {
    if (ctx.authors.has(autor.slug)) { count('existentes', 'autores'); continue; }
    count('creados', 'autores');
    const lote: Lote = conjunto.piezas.some(p => p.author === autor.slug && p.lote === 'definitivo' && !p.space) ? 'definitivo' : 'ensayo';
    if (!write) { log(`  autor nuevo (${lote}): ${autor.name}`); continue; }
    const doc = await payload.create({ collection: 'authors', overrideAccess: true, user, data: { name: autor.name, slug: autor.slug, role: autor.role, lote } });
    ctx.authors.set(autor.slug, { id: doc.id as number });
  }

  // 3. Espacios de Mieres y Lena activos (se guarda su estado previo para restaurarlo al retirar).
  for (const slug of ['mieres', 'lena']) {
    const space = ctx.spaces.get(slug)!;
    if (space.ensayoPrevio) { informe.espacios.push(`${slug}: ya activado por el ensayo`); continue; }
    const startsAt = madridDate(opts.now ?? new Date());
    informe.espacios.push(`${slug}: ${space.subscription.status} → active desde ${startsAt}`);
    if (!write) continue;
    const previo = { subscription: { status: space.subscription.status, startsAt: space.subscription.startsAt ?? null, endsAt: space.subscription.endsAt ?? null }, aplicado: { status: 'active', startsAt }, fecha: new Date().toISOString() };
    await payload.update({ collection: 'municipal-spaces', id: space.id, overrideAccess: true, user,
      data: { subscription: { status: 'active', startsAt, endsAt: null }, ensayoPrevio: previo, _status: 'published' } });
  }

  // 4. Piezas (noticias, opiniones, carta, reportajes y agenda general) y contenidos municipales, publicados.
  for (const p of conjunto.piezas) {
    const municipal = Boolean(p.space);
    const collection = municipal ? 'municipal-content' : 'articles';
    const existing = await findOne(payload, collection, { legacyID: { equals: p.legacyID } })
      ?? (municipal ? undefined : await findOne(payload, 'articles', { slug: { equals: p.slug } }));
    if (existing) { count('existentes', collection); continue; }
    count('creados', collection);
    const dates = publicacion.get(p.legacyID)!;
    const oldEvent = (p.eventoGeneral?.eventAt ?? p.eventAt ?? null)?.slice(0, 10) ?? null;
    const newEvent = evento.get(p.legacyID) ?? null;
    const body = cuerpo(p, oldEvent, newEvent?.slice(0, 10) ?? null);
    const fotoID = p.fotoNecesaria?.imagen ? fotoDePieza.get(p.fotoNecesaria.imagen) : undefined;
    const image = fotoID ? media.get(fotoID) ?? null : null;
    if (!fotoID) informe.avisos.push(`${p.id}: sin foto válida en fotos.json`);
    if (!write) { log(`  ${collection} nuevo (${p.lote}): ${p.title}`); continue; }
    if (municipal) {
      await payload.create({ collection: 'municipal-content', overrideAccess: true, user, data: {
        legacyID: p.legacyID, space: ctx.spaces.get(p.space!)!.id, type: p.type as 'notice', title: p.title, excerpt: p.excerpt, body: body.join('\n\n'),
        origin: 'municipality', publishedAt: dates.publishedAt, expiresAt: null, eventAt: p.type === 'event' ? newEvent : null,
        place: p.place ?? null, deadline: p.deadline ?? null, attachments: [], image, demo: false, lote: p.lote, provenance: ENSAYO_PROVENANCE, _status: 'published',
      } });
    } else {
      await payload.create({ collection: 'articles', overrideAccess: true, user, data: {
        legacyID: p.legacyID, slug: p.slug, title: p.title, excerpt: p.excerpt, body: paragraphsToLexical(body) as never, image,
        author: ctx.authors.get(p.author)!.id, town: ctx.towns.get(p.town)!, section: ctx.sections.get(p.section)!,
        date: dates.date, publishedAt: dates.publishedAt, opinion: p.opinion, showInTown: p.showInTown,
        // La fecha de la actividad es hora de Madrid; el campo de fecha guarda el instante (ISO).
        agenda: p.tipo === 'agenda_general' ? { eventAt: newEvent ? madridToISO(newEvent.slice(0, 10), newEvent.slice(11, 16)) : null, place: p.eventoGeneral?.place ?? null } : undefined,
        lote: p.lote, provenance: ENSAYO_PROVENANCE, _status: 'published',
      } });
    }
  }

  if (write && Object.keys(informe.creados).length) {
    await payload.create({ collection: 'audit-log', overrideAccess: true, user, data: {
      action: 'create', targetCollection: 'ensayo', documentID: ENSAYO_PROVENANCE, title: 'Carga del contenido de ensayo',
      summary: `create · ensayo · ${resumen(informe.creados)}`.slice(0, 250), userEmail: user.email, userRole: 'admin', user: user.id,
    } });
  }
  return informe;
}

// --- Retirada -----------------------------------------------------------------------------------------
export type InformeRetirada = { borrados: Record<string, number>; conservados: string[]; espacios: string[] };

export async function retirar(payload: Payload, opts: { soloComprobar: boolean; copiaPrevia?: string; usuario?: string; log: Log }): Promise<InformeRetirada> {
  const { log } = opts;
  if (!opts.soloComprobar && !opts.copiaPrevia) {
    throw new Error('Falta la copia de seguridad previa (ENSAYO_COPIA_PREVIA). Retira el ensayo con infra/deploy/ensayo.sh retirar, que la hace antes con las herramientas de copia.');
  }
  const user = await adminUser(payload, opts.usuario);
  const informe: InformeRetirada = { borrados: {}, conservados: [], espacios: [] };
  const write = !opts.soloComprobar;
  const ensayo: Where = { lote: { equals: 'ensayo' } };
  const list = async (collection: 'articles' | 'municipal-content' | 'media' | 'authors', where: Where) =>
    (await payload.find({ collection, where, pagination: false, depth: 0, overrideAccess: true, draft: true })).docs as unknown as Record<string, unknown>[];
  const remove = async (collection: 'articles' | 'municipal-content' | 'media' | 'authors', doc: Record<string, unknown>, label: string) => {
    informe.borrados[collection] = (informe.borrados[collection] ?? 0) + 1;
    log(`  ${write ? 'borrado' : 'se borraría'} (${collection}): ${label}`);
    if (write) await payload.delete({ collection, id: doc.id as number, overrideAccess: true, user });
  };

  // 1. Piezas y contenidos municipales del lote ensayo (sus copias públicas se recalculan al borrar).
  const articles = await list('articles', ensayo);
  const municipal = await list('municipal-content', ensayo);
  for (const doc of articles) await remove('articles', doc, String(doc.title));
  for (const doc of municipal) await remove('municipal-content', doc, String(doc.title));
  const gone = { articles: new Set(articles.map(d => d.id)), municipal: new Set(municipal.map(d => d.id)) };

  // 2. Imágenes del ensayo que ya no use nada que no sea del ensayo (ni noticias, ni contenidos, ni espacios, ni autores).
  for (const image of await list('media', ensayo)) {
    const id = image.id as number;
    const users = [
      ...(await list('articles', { or: [{ image: { equals: id } }, { seoImage: { equals: id } }] })).filter(d => !gone.articles.has(d.id)).map(d => `noticia «${d.title}»`),
      ...(await list('municipal-content', { image: { equals: id } })).filter(d => !gone.municipal.has(d.id)).map(d => `contenido municipal «${d.title}»`),
      ...((await payload.find({ collection: 'municipal-spaces', pagination: false, depth: 0, overrideAccess: true, draft: true,
        where: { or: [{ 'identity.heroImage': { equals: id } }, { 'identity.crestImage': { equals: id } }] } })).docs).map(d => `espacio «${d.name}»`),
      ...(await list('authors', { avatar: { equals: id } })).map(d => `autor «${d.name}»`),
    ];
    if (users.length) {
      // Se queda como imagen normal: deja de ser del ensayo (no se volverá a proponer para borrar).
      informe.conservados.push(`imagen «${image.alt}»: la usa ${users.join(', ')}; deja de estar marcada como ensayo`);
      if (write) await payload.update({ collection: 'media', id, overrideAccess: true, user, data: { lote: null } });
      continue;
    }
    await remove('media', image, String(image.sourceURL || image.alt));
  }

  // 3. Autores del ensayo sin ninguna noticia que no sea del ensayo.
  for (const author of await list('authors', ensayo)) {
    const used = (await list('articles', { author: { equals: author.id as number } })).filter(d => !gone.articles.has(d.id));
    if (used.length) {
      informe.conservados.push(`autor «${author.name}»: firma ${used.length} noticia(s) que no son del ensayo; deja de estar marcado como ensayo`);
      if (write) await payload.update({ collection: 'authors', id: author.id as number, overrideAccess: true, user, data: { lote: null } });
      continue;
    }
    await remove('authors', author, String(author.name));
  }

  // 4. Espacios activados por el ensayo: vuelven a su estado previo, salvo que alguien los haya cambiado después.
  const spaces = (await payload.find({ collection: 'municipal-spaces', pagination: false, depth: 0, overrideAccess: true, draft: true, where: { ensayoPrevio: { exists: true } } })).docs;
  for (const space of spaces as unknown as { id: number; name: string; subscription: { status: string; startsAt?: string | null }; ensayoPrevio?: { subscription: { status: 'demo' | 'active' | 'inactive'; startsAt: string | null; endsAt: string | null }; aplicado: { status: string; startsAt: string } } | null }[]) {
    const previo = space.ensayoPrevio;
    if (!previo) continue;
    const intact = space.subscription.status === previo.aplicado.status && (space.subscription.startsAt ?? null) === previo.aplicado.startsAt;
    informe.espacios.push(intact ? `${space.name}: vuelve a ${previo.subscription.status}` : `${space.name}: se deja como está (se cambió después de la carga)`);
    if (!write) continue;
    await payload.update({ collection: 'municipal-spaces', id: space.id, overrideAccess: true, user,
      data: { ...(intact ? { subscription: previo.subscription } : {}), ensayoPrevio: null, _status: 'published' } });
  }

  if (write) {
    await payload.create({ collection: 'audit-log', overrideAccess: true, user, data: {
      action: 'delete', targetCollection: 'ensayo', documentID: ENSAYO_PROVENANCE, title: 'Retirada del contenido de ensayo',
      summary: `delete · ensayo · ${resumen(informe.borrados)}`.slice(0, 250), userEmail: user.email, userRole: 'admin', user: user.id,
      reason: `Copia previa: ${opts.copiaPrevia}. Borrado: ${resumen(informe.borrados)}. Conservado: ${informe.conservados.length}. Espacios: ${informe.espacios.join('; ') || 'ninguno'}.`.slice(0, 2000),
    } });
  }
  return informe;
}

export function resumen(counts: Record<string, number>) {
  return Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') || 'nada';
}
