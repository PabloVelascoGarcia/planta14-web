// Las cuatro fuentes automáticas de la sección «Útil» (datos-servicios/fuentes-automaticas.md, rama desarrollo/planta14-contenido-ensayo):
//   puerto de Pajares (DGT, NAP, DATEX II v3.7, CC BY) · predicción por municipio (AEMET OpenData, clave en AEMET_API_KEY)
//   · subvenciones (BDNS, infosubvenciones.es) · empleo público (BOE, RSS de la sección II.B).
// El resto (San Isidro, estaciones de esquí, farmacias, BOPA, empleo municipal) solo se enlaza: ver lib/util.ts.
// Las visitas NUNCA consultan las fuentes: solo leen la caché de la base de datos (tabla external_cache). La renueva un
// refresco en el servidor (ensureUtilRefresher, arrancado por /api/health y al leer «Útil») con su intervalo por fuente, reintentos
// con espera creciente ante 429/5xx y la última copia buena si falla. Se avisa por correo a la administración (como
// mucho una vez cada 12 horas por fuente).

export const UTIL_TOWNS = [
  { slug: "mieres", name: "Mieres", aemet: "33037" }, { slug: "lena", name: "Lena", aemet: "33033" },
  { slug: "aller", name: "Aller", aemet: "33002" }, { slug: "morcin", name: "Morcín", aemet: "33038" },
  { slug: "riosa", name: "Riosa", aemet: "33058" }, { slug: "ribera-de-arriba", name: "Ribera de Arriba", aemet: "33057" },
] as const;
export type UtilTown = typeof UTIL_TOWNS[number]["slug"];
export const townName = (slug: string) => UTIL_TOWNS.find(t => t.slug === slug)?.name ?? ({ asturias: "Principado de Asturias", idepa: "IDEPA", estado: "Administración del Estado", villamanin: "Villamanín (León)" } as Record<string, string>)[slug] ?? slug;

export type Cached<T> = { data: T | null; fetchedAt: string | null; error: string | null };
const HOUR = 3600_000;
const normal = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const townBySpelling = (value: string) => UTIL_TOWNS.find(t => normal(t.name) === normal(value))?.slug ?? null;
const madridToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

async function db() {
  const { contentClient } = await import("./payload-content");
  const payload = await contentClient();
  const { sql } = await import("@payloadcms/db-postgres");
  return { payload, sql };
}

/** Error HTTP de una fuente: el código decide si se reintenta (429 y 5xx) y Retry-After cuánto se espera. */
export class SourceError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterMs: number | null = null) { super(message); }
}
const retryable = (error: unknown) => error instanceof SourceError ? error.status === 429 || error.status >= 500
  : error instanceof Error && (error.name === "TimeoutError" || /fetch failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket/i.test(error.message));

/** Descarga con tiempo máximo; un código HTTP que no sea 2xx es un error (SourceError). */
export async function fetchSource(url: string, init: RequestInit = {}, timeoutMs = 10_000) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: "no-store", headers: { "User-Agent": "Planta14/1.0 (seccion Util)", ...init.headers } });
  if (!response.ok) {
    const after = Number(response.headers.get("retry-after"));
    await response.body?.cancel().catch(() => undefined);
    throw new SourceError(`HTTP ${response.status} en ${new URL(url).host}`, response.status, Number.isFinite(after) && after > 0 ? after * 1000 : null);
  }
  return response;
}

type Row = { value: unknown; fetched_at: Date | string | null; checked_at: Date | string; error: string | null; notified_at: Date | string | null; attempts: number | null };
const readRow = async (key: string) => {
  const { payload, sql } = await db();
  return (await payload.db.drizzle.execute(sql`SELECT value, fetched_at, checked_at, error, notified_at, attempts FROM external_cache WHERE key = ${key}`)).rows[0] as Row | undefined;
};
/**
 * Lectura de la caché (lo único que hacen las páginas): las visitas NUNCA consultan las fuentes externas. El dato lo
 * renueva el refresco del servidor (ensureUtilRefresher). Sin dato todavía, el bloque muestra «Consultando…».
 */
export async function readCache<T>(key: string): Promise<Cached<T>> {
  const row = await readRow(key);
  return { data: (row?.value as T) ?? null, fetchedAt: row?.fetched_at ? new Date(row.fetched_at).toISOString() : null, error: row?.error ?? null };
}

export type SourceDefinition = { key: string; label: string; intervalMs: number; fetch: (previous: unknown) => Promise<unknown> };
const envNumber = (name: string, fallback: number) => { const v = Number(process.env[name]); return Number.isFinite(v) && v > 0 ? v : fallback; };
/** Espera entre reintentos dentro de un mismo refresco (crece: base, base×4…). */
const retryBaseMs = () => envNumber("UTIL_RETRY_BASE_MS", 15_000);
/** Tras un refresco fallido, el siguiente intento espera 5, 10, 20, 40… minutos, como mucho el intervalo de la fuente. */
const backoffMs = (attempts: number, intervalMs: number) => Math.min(intervalMs, envNumber("UTIL_BACKOFF_BASE_MS", 5 * 60_000) * 2 ** Math.max(0, attempts - 1));

/** ¿Toca refrescar esta fuente? (sin dato, dato caducado o, tras un fallo, cuando ha pasado la espera creciente). */
export function isDue(row: Pick<Row, "fetched_at" | "checked_at" | "error" | "attempts"> | undefined, intervalMs: number, now = Date.now()) {
  if (!row) return true;
  if (row.error) return now - new Date(row.checked_at).getTime() >= backoffMs(row.attempts ?? 1, intervalMs);
  return !row.fetched_at || now - new Date(row.fetched_at).getTime() >= intervalMs;
}

/**
 * Refresca una fuente: hasta 3 intentos dentro del mismo refresco si responde 429, 5xx o no responde (con espera
 * creciente y respetando Retry-After hasta 2 minutos). Si falla, se conserva la última copia buena y su fecha, se anota
 * el error y se avisa a la administración (como mucho cada 12 horas). En el registro solo van la fuente, el código y el
 * intento: nunca datos personales ni la clave de AEMET (va en una cabecera, no en la dirección).
 */
export async function refreshSource(def: SourceDefinition) {
  const { payload, sql } = await db();
  const previous = await readRow(def.key);
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const value = await def.fetch(previous?.value ?? null);
      await payload.db.drizzle.execute(sql`INSERT INTO external_cache (key, value, fetched_at, checked_at, error, attempts) VALUES (${def.key}, ${JSON.stringify(value)}::jsonb, now(), now(), NULL, 0)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, fetched_at = now(), checked_at = now(), error = NULL, attempts = 0`);
      if (attempt > 1) payload.logger.info({ msg: `Útil: fuente ${def.label} recuperada`, attempt });
      return true;
    } catch (error) {
      lastError = error;
      const status = error instanceof SourceError ? error.status : null;
      payload.logger.warn({ msg: `Útil: falla la fuente ${def.label}`, status, attempt, reason: error instanceof Error ? (error.name === "TimeoutError" ? "sin respuesta a tiempo" : error.message) : String(error) });
      if (attempt === 3 || !retryable(error)) break;
      const wait = Math.min(120_000, Math.max(error instanceof SourceError && error.retryAfterMs ? error.retryAfterMs : 0, retryBaseMs() * 4 ** (attempt - 1)));
      await new Promise(r => setTimeout(r, wait));
    }
  }
  const message = lastError instanceof Error ? (lastError.name === "TimeoutError" ? "La fuente no respondió a tiempo" : lastError.message) : String(lastError);
  const notify = !previous?.notified_at || Date.now() - new Date(previous.notified_at).getTime() > 12 * HOUR;
  await payload.db.drizzle.execute(sql`INSERT INTO external_cache (key, value, checked_at, error, notified_at, attempts) VALUES (${def.key}, NULL, now(), ${message}, ${notify ? new Date().toISOString() : null}, 1)
    ON CONFLICT (key) DO UPDATE SET checked_at = now(), error = EXCLUDED.error, attempts = COALESCE(external_cache.attempts, 0) + 1, notified_at = COALESCE(EXCLUDED.notified_at, external_cache.notified_at)`);
  if (notify) await notifyAdmins(def.label, message, previous?.fetched_at ?? null).catch(() => undefined);
  return false;
}

// --- Índice de riesgo de incendios del 112 Asturias (lib/fire-index.ts): página oficial leída por el servidor cada
// hora; las visitas solo leen la caché. UTIL_INCENDIOS=off lo quita (entonces solo sale el enlace a la página oficial).
const FIRE_URL = () => process.env.UTIL_INCENDIOS_URL || "https://www.112asturias.es/indice-incendios-asturias";
export const fireIndexEnabled = () => process.env.UTIL_INCENDIOS !== "off";
async function fetchFireIndex() {
  const { parseFireIndex } = await import("./fire-index");
  const response = await fetchSource(FIRE_URL(), {}, 20_000);
  // La página del 112 va en ISO-8859-1 (Windows-1252); si la cabecera dice otra cosa, se respeta.
  const charset = /charset=([\w-]+)/i.exec(response.headers.get("content-type") ?? "")?.[1]?.toLowerCase();
  const html = new TextDecoder(charset && charset !== "iso-8859-1" ? charset : "windows-1252").decode(await response.arrayBuffer());
  return parseFireIndex(html, Object.fromEntries(UTIL_TOWNS.map(t => [t.slug, t.name])));
}
export const fireIndexStatus = () => readCache<import("./fire-index").FireIndex>("incendios:112");

/** Las fuentes automáticas y cada cuánto se refrescan (BDNS: UTIL_BDNS_REFRESH_HOURS, 6 por defecto). */
export function utilSources(): SourceDefinition[] {
  return [
    { key: "dgt:pajares", label: "DGT: puerto de Pajares", intervalMs: 5 * 60_000, fetch: fetchPajares },
    { key: "bdns:abiertas", label: "BDNS: subvenciones", intervalMs: envNumber("UTIL_BDNS_REFRESH_HOURS", 6) * HOUR, fetch: fetchGrants },
    { key: "boe:empleo", label: "BOE: oposiciones y concursos", intervalMs: 3 * HOUR, fetch: previous => fetchJobs(previous as Job[] | null) },
    ...(fireIndexEnabled() ? [{ key: "incendios:112", label: "112 Asturias: índice de riesgo de incendios", intervalMs: HOUR, fetch: fetchFireIndex }] : []),
    ...(aemetEnabled() ? UTIL_TOWNS.map(t => ({ key: `aemet:${t.aemet}`, label: `AEMET: predicción de ${t.name}`, intervalMs: 2 * HOUR, fetch: () => fetchForecast(t) })) : []),
  ];
}

let running = false;
/** Refresca, una tras otra, las fuentes a las que les toca. Nunca dos refrescos a la vez. */
export async function refreshDueSources() {
  if (running) return;
  running = true;
  try {
    for (const def of utilSources()) if (isDue(await readRow(def.key), def.intervalMs)) await refreshSource(def);
    await eraseLettersDaily();
  } finally { running = false; }
}
/**
 * Una vez al día (y al arrancar), borra DNI y teléfono de las cartas de hace más de 24 meses, también con las cartas
 * desactivadas: ya no llegan cartas nuevas que lo disparen y puede quedar algún dato antiguo.
 */
async function eraseLettersDaily() {
  const flags = globalThis as typeof globalThis & { __planta14LettersErasedAt?: number };
  if (Date.now() - (flags.__planta14LettersErasedAt ?? 0) < 24 * HOUR) return;
  flags.__planta14LettersErasedAt = Date.now();
  try {
    const { payload } = await db();
    const erased = await (await import("../cms/letters")).eraseExpiredPersonalData(payload);
    if (erased) console.log(`Cartas: DNI y teléfono borrados en ${erased} (más de 24 meses).`);
  } catch (error) { console.warn(`Cartas: no se ha podido hacer el borrado diario de DNI y teléfono: ${error instanceof Error ? error.message : error}`); }
}
/**
 * Arranca, una sola vez por proceso, el refresco en segundo plano: comprueba cada minuto (UTIL_REFRESH_CHECK_SECONDS)
 * qué fuentes toca renovar. Se llama desde /api/health (lo consulta deploy.sh nada más desplegar y luego el monitor) y
 * al leer «Útil»; nunca durante la compilación ni sin CMS. Sin instrumentation.ts: compilarlo arrastraba todo Payload
 * a una entrada aparte y la compilación de la imagen se quedaba sin memoria.
 */
export function ensureUtilRefresher() {
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.CONTENT_SOURCE !== "payload" || process.env.CMS_ENABLED !== "true" || process.env.UTIL_REFRESH_DISABLED === "true") return;
  const flags = globalThis as typeof globalThis & { __planta14UtilRefresher?: boolean };
  if (flags.__planta14UtilRefresher) return;
  flags.__planta14UtilRefresher = true;
  const run = () => { refreshDueSources().catch(error => console.warn(`Útil: refresco de fuentes interrumpido: ${error instanceof Error ? error.message : error}`)); };
  setTimeout(run, envNumber("UTIL_REFRESH_START_SECONDS", 5) * 1000).unref?.();
  setInterval(run, envNumber("UTIL_REFRESH_CHECK_SECONDS", 60) * 1000).unref?.();
}

async function notifyAdmins(label: string, message: string, lastGood: Date | string | null) {
  const { emailAvailable } = await import("../cms/email");
  if (!emailAvailable()) return;
  const { payload } = await db();
  const admins = (await payload.find({ collection: "users", where: { role: { equals: "admin" } }, pagination: false, depth: 0, overrideAccess: true })).docs.map(u => u.email);
  if (!admins.length) return;
  const when = lastGood ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" }).format(new Date(lastGood)) : null;
  await payload.sendEmail({ to: admins.join(", "), subject: `Útil: no responde la fuente «${label}»`,
    text: `La sección «Útil» de Planta 14 no ha podido actualizar la fuente «${label}».\n\nError: ${message}\n\n` +
      `${when ? `La web sigue enseñando el último dato bueno (del ${when}), con su hora.` : "Mientras tanto, ese bloque enseña un aviso en la web."} ` +
      `La página sigue funcionando y se reintentará sola. No se enviará otro aviso de esta fuente en 12 horas.\n\n— Planta 14` });
}

// ---------------------------------------------------------------- DGT: puerto de Pajares (DATEX II v3.7)

export type RoadIncident = { id: string; road: string; km: number | null; town: "lena" | "villamanin"; direction: string; what: string; since: string | null };
const DGT_URL = () => process.env.UTIL_DGT_URL || "https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml";
const DGT_LABELS: Record<string, string> = {
  roadMaintenance: "Obras", vehicleObstruction: "Vehículo detenido", environmentalObstruction: "Obstáculo natural", accident: "Accidente",
  obstruction: "Obstáculo en la calzada", infrastructureDamageObstruction: "Daños en la vía", poorEnvironment: "Meteorología adversa", abnormalTraffic: "Tráfico irregular",
  roadworks: "Obras", maintenanceWork: "Obras de mantenimiento", resurfacingWork: "Asfaltado", rockfalls: "Desprendimientos", landslips: "Corrimiento de tierras", avalanches: "Aludes", flooding: "Inundación", fallenTrees: "Árboles caídos",
  objectOnTheRoad: "Objeto en la calzada", obstructionOnTheRoad: "Obstáculo en la calzada", snowfall: "Nevada", heavySnowfall: "Nevada intensa",
  blizzard: "Ventisca", ice: "Hielo", blackIce: "Placas de hielo", snowDrifts: "Ventisqueros", visibilityReduced: "Visibilidad reducida", fog: "Niebla",
  denseFog: "Niebla densa", strongWinds: "Viento fuerte", heavyRain: "Lluvia intensa", roadSurfaceInPoorCondition: "Firme en mal estado", slowTraffic: "Tráfico lento",
  stationaryTraffic: "Tráfico detenido", queuingTraffic: "Retenciones", laneClosures: "Carril cortado", carriagewayClosures: "Calzada cortada", roadClosed: "Carretera cortada",
  singleAlternateLineTraffic: "Paso alternativo", narrowLanes: "Carriles estrechos", lanesDeviated: "Carriles desviados", newRoadworksLayout: "Nuevo trazado por obras",
  intermittentShortTermClosures: "Cortes intermitentes", useOfSpecifiedLanesOrCarriagewaysAllowed: "Circulación por carriles habilitados",
  doNotUseSpecifiedLanesOrCarriageways: "Carriles no utilizables", weightRestrictionInOperation: "Restricción por peso", speedRestrictionInOperation: "Limitación de velocidad",
  snowChainsMandatory: "Cadenas obligatorias", snowTyresMandatory: "Neumáticos de invierno obligatorios", snowChainsOrTyresMandatory: "Cadenas o neumáticos de invierno",
  winterEquipmentRecommended: "Se recomienda equipamiento de invierno", heavyVehiclesProhibited: "Prohibido el paso de camiones", driveCarefully: "Circule con precaución",
};
const decode = (value: string) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const tag = (xml: string, name: string) => { const m = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`)); return m ? decode(m[1].trim()) : ""; };
const describe = (value: string) => DGT_LABELS[value] ?? value.replace(/([A-Z])/g, " $1").toLowerCase();

/** Puerto de Pajares: incidencias activas de la N-630 en Lena (Asturias) y Villamanín (León). */
export function parseDgt(xml: string): { publishedAt: string | null; incidents: RoadIncident[] } {
  const incidents: RoadIncident[] = [];
  for (const match of xml.matchAll(/<sit:situationRecord\b([^>]*)>([\s\S]*?)<\/sit:situationRecord>/g)) {
    const record = match[2];
    const municipality = normal(tag(record, "lse:municipality")), province = tag(record, "lse:province"), road = tag(record, "loc:roadName");
    const town = road !== "N-630" ? null : province === "Asturias" && municipality === "lena" ? "lena" : province === "León" && municipality === "villamanin" ? "villamanin" : null;
    if (!town) continue;
    if (tag(record, "com:validityStatus") && !/active/i.test(tag(record, "com:validityStatus"))) continue;
    const types = [...record.matchAll(/<sit:(\w+Type)>(\w+)<\/sit:\1>/g)].filter(m => m[1] !== "causeType").map(m => m[2]);
    const cause = tag(record, "sit:causeType");
    const what = [...new Set([...types.map(describe), ...(cause && !types.length ? [describe(cause)] : [])])];
    if (cause && types.length && !what.includes(describe(cause))) what.unshift(describe(cause));
    const km = Number(tag(record, "lse:kilometerPoint"));
    incidents.push({ id: (match[1].match(/id="([^"]+)"/)?.[1]) ?? String(incidents.length), road, km: Number.isFinite(km) && tag(record, "lse:kilometerPoint") ? km : null,
      town, direction: tag(record, "loc:roadDestination"), what: what.join(" · ") || "Incidencia", since: tag(record, "com:overallStartTime") || null });
  }
  incidents.sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  return { publishedAt: tag(xml, "com:publicationTime") || null, incidents };
}
/** Nunca se afirma «abierto»: solo se dice si la DGT registra o no incidencias, con la hora de su publicación. */
const fetchPajares = async () => parseDgt(await (await fetchSource(DGT_URL(), {}, 20_000)).text());
export const pajaresStatus = () => readCache<{ publishedAt: string | null; incidents: RoadIncident[] }>("dgt:pajares");

// ---------------------------------------------------------------- AEMET: predicción por municipio

export type ForecastDay = { day: string; sky: string; max: number | null; min: number | null; rain: number | null; snowLevel: string | null };
export type Forecast = { town: string; issued: string | null; days: ForecastDay[] };
export const aemetEnabled = () => Boolean(process.env.AEMET_API_KEY?.trim());
const AEMET_BASE = () => (process.env.AEMET_BASE_URL || "https://opendata.aemet.es/opendata").replace(/\/$/, "");
type Period = { value?: string | number; periodo?: string; descripcion?: string };
const pick = (list: Period[] | undefined, field: "value" | "descripcion") => {
  const items = (list ?? []).filter(p => p[field] !== undefined && p[field] !== "");
  return (items.find(p => p.periodo === "00-24") ?? items.find(p => !p.periodo) ?? items[0])?.[field] ?? null;
};
export function parseAemet(town: string, json: unknown): Forecast {
  const data = (Array.isArray(json) ? json[0] : json) as { elaborado?: string; prediccion?: { dia?: Array<{ fecha: string; estadoCielo?: Period[]; probPrecipitacion?: Period[]; cotaNieveProv?: Period[]; temperatura?: { maxima?: number; minima?: number } }> } };
  const days = (data?.prediccion?.dia ?? []).slice(0, 4).map(d => {
    const rain = (d.probPrecipitacion ?? []).filter(p => p.value !== "" && p.value !== undefined);
    return { day: String(d.fecha).slice(0, 10), sky: String(pick(d.estadoCielo, "descripcion") ?? ""),
      max: typeof d.temperatura?.maxima === "number" ? d.temperatura.maxima : null, min: typeof d.temperatura?.minima === "number" ? d.temperatura.minima : null,
      rain: rain.length ? Math.max(...rain.map(p => Number(p.value))) : null, snowLevel: pick(d.cotaNieveProv, "value") ? String(pick(d.cotaNieveProv, "value")) : null };
  });
  if (!days.length) throw new Error("AEMET: respuesta sin predicción");
  return { town, issued: data.elaborado ?? null, days };
}
/** AEMET sirve el JSON en ISO-8859-15. */
async function aemetJSON(url: string) {
  const response = await fetchSource(url, { headers: { api_key: process.env.AEMET_API_KEY!.trim(), Accept: "application/json" } });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const charset = response.headers.get("content-type")?.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase() || "iso-8859-15";
  let text: string;
  try { text = new TextDecoder(charset).decode(bytes); } catch { text = new TextDecoder("latin1").decode(bytes); }
  return JSON.parse(text);
}
async function fetchForecast(town: typeof UTIL_TOWNS[number]) {
  const control = await aemetJSON(`${AEMET_BASE()}/api/prediccion/especifica/municipio/diaria/${town.aemet}`) as { estado?: number; datos?: string; descripcion?: string };
  if (control.estado === 429) throw new SourceError("AEMET: demasiadas peticiones", 429);
  if (control.estado !== 200 || !control.datos) throw new Error(`AEMET: ${control.descripcion || `estado ${control.estado}`}`);
  return parseAemet(town.slug, await aemetJSON(control.datos));
}
export function aemetForecast(slug: string) {
  const town = UTIL_TOWNS.find(t => t.slug === slug);
  if (!town || !aemetEnabled()) return null;
  return readCache<Forecast>(`aemet:${town.aemet}`);
}

// ---------------------------------------------------------------- BDNS: subvenciones abiertas

export type GrantScope = "estado" | "asturias" | "idepa" | UtilTown;
export type Grant = { id: string; title: string; organ: string; scope: GrantScope; end: string | null; endText: string | null; url: string; office: string | null };
const BDNS_BASE = () => (process.env.UTIL_BDNS_URL || "https://www.infosubvenciones.es/bdnstrans").replace(/\/$/, "");
// Identificadores del catálogo de regiones de la BDNS (/api/regiones, comprobado el 04/11/2026): 1 «ES - ESPAÑA»,
// 8 «ES12 - PRINCIPADO DE ASTURIAS» y 9 «ES120 - Asturias». tipoAdministracion=C es la Administración del Estado.
const REGION_SPAIN = "1", REGIONS_ASTURIAS = "8,9";
const tidy = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  const letters = t.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, "");
  return letters && letters.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "").length / letters.length > 0.7 ? t.charAt(0) + t.slice(1).toLowerCase() : t;
};
/**
 * Título de una convocatoria. La BDNS guarda el título oficial cortado a 255 caracteres (también en el detalle) y a
 * veces empieza en minúscula («convocan subvenciones…»): primera letra en mayúscula y, si es largo o viene cortado,
 * corte en un límite de palabra con puntos suspensivos.
 */
export function grantTitle(raw: string, max = 180): string {
  let t = tidy(raw).replace(/[\s.,;:]+$/, "");
  const truncated = raw.trim().length >= 250 && !/[.)»"]$/.test(raw.trim());
  if (t.length > max || truncated) {
    let cut = t.length > max ? t.slice(0, max + 1).replace(/\s+\S*$/, "") : t.replace(/\s+\S*$/, "");
    // Sin terminar en «de», «y», «del»… ni en signos de puntuación.
    while (/\s(?:a|al|con|de|del|e|el|en|la|las|lo|los|o|para|por|que|se|su|sus|u|un|una|y)$/i.test(cut)) cut = cut.replace(/\s+\S+$/, "");
    t = `${cut.replace(/[\s.,;:(«"-]+$/, "")}…`;
  }
  return t.charAt(0).toLocaleUpperCase("es") + t.slice(1);
}
type BdnsItem = { numeroConvocatoria: string; descripcion: string; nivel1: string; nivel2: string; nivel3: string; fechaRecepcion: string };
type BdnsDetail = { descripcion?: string | null; abierto?: boolean; tipoConvocatoria?: string; fechaFinSolicitud?: string | null; textFin?: string | null; sedeElectronica?: string | null };
/** Ámbito: Estado, Principado, IDEPA o uno de los seis ayuntamientos; null si no interesa (otros ayuntamientos, nominativas, convenios…). */
export function bdnsScope(item: Pick<BdnsItem, "nivel1" | "nivel2" | "nivel3" | "descripcion">): GrantScope | null {
  if (/nominativa|convenio|propuesta (de )?resoluci|adenda/i.test(item.descripcion)) return null;
  if (item.nivel1 === "LOCAL") return townBySpelling(item.nivel2) as UtilTown | null;
  if (/DESARROLLO ECON[OÓ]MICO DEL PRINCIPADO|IDEPA/i.test(`${item.nivel2} ${item.nivel3}`)) return "idepa";
  if (item.nivel1 === "AUTONOMICA" && /ASTURIAS/i.test(item.nivel2)) return "asturias";
  if (item.nivel1 === "ESTATAL") return "estado";
  return null;
}
const search = async (params: string) => {
  const since = new Date(Date.now() - 180 * 24 * HOUR);
  const desde = `${String(since.getDate()).padStart(2, "0")}/${String(since.getMonth() + 1).padStart(2, "0")}/${since.getFullYear()}`;
  const url = `${BDNS_BASE()}/api/convocatorias/busqueda?vpd=GE&page=0&pageSize=200&order=fechaRecepcion&direccion=desc&fechaDesde=${encodeURIComponent(desde)}&${params}`;
  return ((await (await fetchSource(url, {}, 20_000)).json()) as { content?: BdnsItem[] }).content ?? [];
};
/**
 * Convocatorias abiertas aplicables: las de los seis ayuntamientos, el Principado y el IDEPA (regiones de Asturias) y
 * las de la Administración del Estado de ámbito nacional o asturiano. Se descartan concesiones directas y nominativas.
 */
type BdnsCache = { grants: Grant[]; details: Record<string, { detail: BdnsDetail; at: string }> };
/** Lo que leen las páginas: solo la lista (las cachés antiguas eran directamente la lista). */
export const openGrants = async (): Promise<Cached<Grant[]>> => {
  const cached = await readCache<BdnsCache | Grant[]>("bdns:abiertas");
  const grants = Array.isArray(cached.data) ? cached.data : cached.data?.grants ?? null;
  // Los títulos de la caché anterior se arreglan también al leer (grantTitle no cambia un título ya arreglado).
  return { ...cached, data: grants?.map(g => ({ ...g, title: grantTitle(g.title) })) ?? null };
};
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
/**
 * Las peticiones a la BDNS van de una en una, con pausa (UTIL_BDNS_PAUSE_MS, 400 ms), y el detalle de cada convocatoria
 * se reutiliza durante 24 horas: así un refresco hace pocas peticiones y no provoca un 429.
 */
async function fetchGrants(previous: unknown): Promise<BdnsCache> {
  const known = (previous && !Array.isArray(previous) ? (previous as BdnsCache).details : null) ?? {};
  const gap = envNumber("UTIL_BDNS_PAUSE_MS", 400);
  const asturias = await search(`regiones=${REGIONS_ASTURIAS}`);
  await pause(gap);
  const spain = await search(`regiones=${REGION_SPAIN}&tipoAdministracion=C`);
  const seen = new Set<string>();
  const candidates = [...asturias, ...spain].filter(item => !seen.has(item.numeroConvocatoria) && seen.add(item.numeroConvocatoria))
    .map(item => ({ item, scope: bdnsScope(item) })).filter((c): c is { item: BdnsItem; scope: GrantScope } => c.scope !== null);
  // Como mucho 70 consultas de detalle cada 6 horas: todas las municipales y las más recientes del resto.
  const rank: Record<string, number> = { idepa: 1, asturias: 2, estado: 3 };
  const picked = [...candidates.filter(c => !rank[c.scope]), ...["idepa", "asturias", "estado"].flatMap(scope => candidates.filter(c => c.scope === scope).slice(0, 20))].slice(0, 70);
  const today = madridToday();
  const grants: Grant[] = [];
  const details: BdnsCache["details"] = {};
  for (const { item, scope } of picked) {
    const reuse = known[item.numeroConvocatoria];
    let detail: BdnsDetail;
    if (reuse && Date.now() - new Date(reuse.at).getTime() < 24 * HOUR) detail = reuse.detail;
    else {
      await pause(gap);
      detail = await (await fetchSource(`${BDNS_BASE()}/api/convocatorias?vpd=GE&numConv=${encodeURIComponent(item.numeroConvocatoria)}`)).json() as BdnsDetail;
    }
    details[item.numeroConvocatoria] = { detail: { descripcion: detail.descripcion ?? null, abierto: detail.abierto, tipoConvocatoria: detail.tipoConvocatoria, fechaFinSolicitud: detail.fechaFinSolicitud, textFin: detail.textFin, sedeElectronica: detail.sedeElectronica }, at: reuse && detail === reuse.detail ? reuse.at : new Date().toISOString() };
    {
      if (/directa/i.test(detail.tipoConvocatoria ?? "")) continue;
      const end = detail.fechaFinSolicitud ? String(detail.fechaFinSolicitud).slice(0, 10) : null;
      if (end ? end < today : detail.abierto !== true) continue;
      grants.push({ id: item.numeroConvocatoria, title: grantTitle(detail.descripcion || item.descripcion), organ: tidy(item.nivel3 || item.nivel2), scope, end, endText: detail.textFin ? tidy(detail.textFin) : null,
        url: `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${encodeURIComponent(item.numeroConvocatoria)}`,
        office: detail.sedeElectronica && /^https?:\/\//.test(detail.sedeElectronica) ? detail.sedeElectronica : null });
    }
  }
  return { grants: grants.sort((a, b) => (a.end ?? "9999").localeCompare(b.end ?? "9999")), details };
}

// ---------------------------------------------------------------- BOE: oposiciones y concursos (II.B)

export type Job = { id: string; title: string; organ: string; scope: string; date: string; url: string };
const BOE_URL = () => process.env.UTIL_BOE_RSS_URL || "https://www.boe.es/rss/boe.php?s=2B";
/** Organismo local que firma el anuncio: «…, del Ayuntamiento de Grado (Asturias), …» → «Grado». */
const LOCAL_ORGAN = /\b(?:del?|la)\s+(?:Ayuntamiento|Concejo)\s+de\s+([^,(;]+?)\s*(?:\(|,|;|$)/i;
/**
 * Convocatorias de los seis ayuntamientos (cada una solo al suyo), del Principado o de la Universidad de Oviedo. Un
 * anuncio municipal entra solo si lo firma expresamente uno de los seis ayuntamientos; nunca por coincidencias como
 * «(Asturias)», que el BOE pone a todos los ayuntamientos asturianos, ni por el nombre de una calle o un lugar.
 */
export function boeScope(title: string, categories: string[]): string | null {
  // Administración local: solo si el ayuntamiento que firma es uno de los seis, y solo para ese concejo.
  if (categories.some(c => /ADMINISTRACI[OÓ]N LOCAL/i.test(c))) {
    const organ = title.match(LOCAL_ORGAN)?.[1];
    return organ ? townBySpelling(organ) : null;
  }
  if (categories.some(c => /PRINCIPADO DE ASTURIAS/i.test(c))) return "asturias";
  if (categories.some(c => /UNIVERSIDAD/i.test(c)) && /\bUniversidad de Oviedo\b/i.test(title)) return "asturias";
  return null;
}
export function parseBoe(xml: string): Job[] {
  const jobs: Job[] = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = tag(item, "title"), link = tag(item, "link"), categories = [...item.matchAll(/<category>([^<]*)<\/category>/g)].map(m => decode(m[1].trim()));
    if (!/Oposiciones y concursos/i.test(categories.join(" "))) continue;
    const scope = boeScope(title, categories);
    if (!scope) continue;
    const date = new Date(tag(item, "pubDate"));
    jobs.push({ id: link.match(/id=([A-Z0-9-]+)/)?.[1] ?? link, title, organ: categories.find(c => !/Oposiciones y concursos/i.test(c)) ?? "", scope,
      date: Number.isNaN(date.getTime()) ? madridToday() : new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(date), url: link });
  }
  return jobs;
}
/** El RSS solo trae el BOE del día: se acumulan las convocatorias de los últimos 45 días. */
/** Vuelve a clasificar con el filtro actual lo guardado antes (p. ej., el anuncio de Grado que entró como «asturias»). */
const rescope = (jobs: Job[]) => jobs.flatMap(j => { const scope = boeScope(j.title, ["Oposiciones y concursos", j.organ]); return scope ? [{ ...j, scope }] : []; });
export const publicJobs = async (): Promise<Cached<Job[]>> => {
  const cached = await readCache<Job[]>("boe:empleo");
  return { ...cached, data: cached.data ? rescope(cached.data) : null };
};
async function fetchJobs(previous: Job[] | null): Promise<Job[]> {
  const response = await fetchSource(BOE_URL());
  const bytes = new Uint8Array(await response.arrayBuffer());
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 200));
  const xml = new TextDecoder(/encoding="utf-8"/i.test(head) ? "utf-8" : "latin1").decode(bytes);
  if (!/<rss\b/.test(xml)) throw new Error("BOE: la respuesta no es un RSS");
  const limit = new Date(Date.now() - 45 * 24 * HOUR).toISOString().slice(0, 10);
  const merged = new Map([...rescope(previous ?? []), ...parseBoe(xml)].filter(j => j.date >= limit).map(j => [j.id, j]));
  return [...merged.values()].sort((a, b) => b.date.localeCompare(a.date));
}
