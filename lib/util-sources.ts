// Las cuatro fuentes automáticas de la sección «Útil» (datos-servicios/fuentes-automaticas.md, rama desarrollo/planta14-contenido-ensayo):
//   puerto de Pajares (DGT, NAP, DATEX II v3.7, CC BY) · predicción por municipio (AEMET OpenData, clave en AEMET_API_KEY)
//   · subvenciones (BDNS, infosubvenciones.es) · empleo público (BOE, RSS de la sección II.B).
// El resto (San Isidro, estaciones de esquí, farmacias, BOPA, empleo municipal) solo se enlaza: ver lib/util.ts.
// Cada consulta pasa por una caché en la base de datos (tabla external_cache): la web no espera a la fuente salvo la
// primera vez, una fuente caída no rompe la página (se enseña el último dato con su hora) y se avisa por correo a la
// administración (como mucho una vez cada 12 horas por fuente).

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

/** Descarga con tiempo máximo; un código HTTP que no sea 2xx es un error. */
export async function fetchSource(url: string, init: RequestInit = {}, timeoutMs = 10_000) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: "no-store", headers: { "User-Agent": "Planta14/1.0 (seccion Util)", ...init.headers } });
  if (!response.ok) throw new Error(`HTTP ${response.status} en ${new URL(url).host}`);
  return response;
}

const inFlight = new Map<string, Promise<void>>();
type Row = { value: unknown; fetched_at: Date | string | null; checked_at: Date | string; error: string | null; notified_at: Date | string | null };

/**
 * Dato de una fuente externa con caché: si es reciente se devuelve tal cual; si está caducado se devuelve el último
 * y se renueva en segundo plano; si no hay nada se espera a la fuente. Tras un fallo no se reintenta en 10 minutos.
 */
export async function cachedSource<T>(key: string, label: string, ttlMs: number, fetcher: (previous: T | null) => Promise<T>): Promise<Cached<T>> {
  const { payload, sql } = await db();
  const read = async () => ((await payload.db.drizzle.execute(sql`SELECT value, fetched_at, checked_at, error, notified_at FROM external_cache WHERE key = ${key}`)).rows[0] as Row | undefined);
  const result = (row: Row | undefined): Cached<T> => ({ data: (row?.value as T) ?? null, fetchedAt: row?.fetched_at ? new Date(row.fetched_at).toISOString() : null, error: row?.error ?? null });
  const refresh = () => {
    if (!inFlight.has(key)) inFlight.set(key, (async () => {
      const previous = await read();
      try {
        const value = await fetcher((previous?.value as T) ?? null);
        await payload.db.drizzle.execute(sql`INSERT INTO external_cache (key, value, fetched_at, checked_at, error) VALUES (${key}, ${JSON.stringify(value)}::jsonb, now(), now(), NULL)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, fetched_at = now(), checked_at = now(), error = NULL`);
      } catch (error) {
        const message = error instanceof Error ? (error.name === "TimeoutError" ? "La fuente no respondió a tiempo" : error.message) : String(error);
        const notify = !previous?.notified_at || Date.now() - new Date(previous.notified_at).getTime() > 12 * HOUR;
        await payload.db.drizzle.execute(sql`INSERT INTO external_cache (key, value, checked_at, error, notified_at) VALUES (${key}, NULL, now(), ${message}, ${notify ? new Date().toISOString() : null})
          ON CONFLICT (key) DO UPDATE SET checked_at = now(), error = EXCLUDED.error, notified_at = COALESCE(EXCLUDED.notified_at, external_cache.notified_at)`);
        payload.logger.warn({ msg: `Útil: falla la fuente ${label}`, err: message });
        if (notify) await notifyAdmins(label, message, previous?.fetched_at ?? null).catch(() => undefined);
      }
    })().finally(() => inFlight.delete(key)));
    return inFlight.get(key)!;
  };
  const row = await read();
  const age = row?.fetched_at ? Date.now() - new Date(row.fetched_at).getTime() : Infinity;
  const retryWait = row?.error && Date.now() - new Date(row.checked_at).getTime() < 10 * 60_000;
  if (age < ttlMs || retryWait) return result(row);
  if (row?.value != null) { void refresh(); return result(row); }
  await refresh();
  return result(await read());
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
export const pajaresStatus = () => cachedSource("dgt:pajares", "DGT: puerto de Pajares", 5 * 60_000, async () => parseDgt(await (await fetchSource(DGT_URL(), {}, 20_000)).text()));

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
export function aemetForecast(slug: string) {
  const town = UTIL_TOWNS.find(t => t.slug === slug);
  if (!town || !aemetEnabled()) return null;
  return cachedSource(`aemet:${town.aemet}`, `AEMET: predicción de ${town.name}`, 2 * HOUR, async () => {
    const control = await aemetJSON(`${AEMET_BASE()}/api/prediccion/especifica/municipio/diaria/${town.aemet}`) as { estado?: number; datos?: string; descripcion?: string };
    if (control.estado !== 200 || !control.datos) throw new Error(`AEMET: ${control.descripcion || `estado ${control.estado}`}`);
    return parseAemet(town.slug, await aemetJSON(control.datos));
  });
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
type BdnsItem = { numeroConvocatoria: string; descripcion: string; nivel1: string; nivel2: string; nivel3: string; fechaRecepcion: string };
type BdnsDetail = { abierto?: boolean; tipoConvocatoria?: string; fechaFinSolicitud?: string | null; textFin?: string | null; sedeElectronica?: string | null };
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
export const openGrants = () => cachedSource("bdns:abiertas", "BDNS: subvenciones", 6 * HOUR, async () => {
  const [asturias, spain] = await Promise.all([search(`regiones=${REGIONS_ASTURIAS}`), search(`regiones=${REGION_SPAIN}&tipoAdministracion=C`)]);
  const seen = new Set<string>();
  const candidates = [...asturias, ...spain].filter(item => !seen.has(item.numeroConvocatoria) && seen.add(item.numeroConvocatoria))
    .map(item => ({ item, scope: bdnsScope(item) })).filter((c): c is { item: BdnsItem; scope: GrantScope } => c.scope !== null);
  // Como mucho 70 consultas de detalle cada 6 horas: todas las municipales y las más recientes del resto.
  const rank: Record<string, number> = { idepa: 1, asturias: 2, estado: 3 };
  const picked = [...candidates.filter(c => !rank[c.scope]), ...["idepa", "asturias", "estado"].flatMap(scope => candidates.filter(c => c.scope === scope).slice(0, 20))].slice(0, 70);
  const today = madridToday();
  const grants: Grant[] = [];
  for (let i = 0; i < picked.length; i += 4) {
    const details = await Promise.all(picked.slice(i, i + 4).map(async ({ item, scope }) => {
      const detail = await (await fetchSource(`${BDNS_BASE()}/api/convocatorias?vpd=GE&numConv=${encodeURIComponent(item.numeroConvocatoria)}`)).json() as BdnsDetail;
      return { item, scope, detail };
    }));
    for (const { item, scope, detail } of details) {
      if (/directa/i.test(detail.tipoConvocatoria ?? "")) continue;
      const end = detail.fechaFinSolicitud ? String(detail.fechaFinSolicitud).slice(0, 10) : null;
      if (end ? end < today : detail.abierto !== true) continue;
      grants.push({ id: item.numeroConvocatoria, title: tidy(item.descripcion), organ: tidy(item.nivel3 || item.nivel2), scope, end, endText: detail.textFin ? tidy(detail.textFin) : null,
        url: `https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias/${encodeURIComponent(item.numeroConvocatoria)}`,
        office: detail.sedeElectronica && /^https?:\/\//.test(detail.sedeElectronica) ? detail.sedeElectronica : null });
    }
  }
  return grants.sort((a, b) => (a.end ?? "9999").localeCompare(b.end ?? "9999"));
});

// ---------------------------------------------------------------- BOE: oposiciones y concursos (II.B)

export type Job = { id: string; title: string; organ: string; scope: string; date: string; url: string };
const BOE_URL = () => process.env.UTIL_BOE_RSS_URL || "https://www.boe.es/rss/boe.php?s=2B";
const LOCAL_ORGAN = new RegExp(`Ayuntamiento de (${UTIL_TOWNS.map(t => t.name).join("|")})\\b`, "i");
/** Convocatorias de los seis ayuntamientos, del Principado o de la Universidad de Oviedo. */
export function boeScope(title: string, categories: string[]): string | null {
  const local = title.match(LOCAL_ORGAN);
  if (local) return townBySpelling(local[1]);
  if (categories.some(c => /PRINCIPADO DE ASTURIAS/i.test(c)) || /Universidad de Oviedo|\(Asturias\)|Principado de Asturias/i.test(title)) return "asturias";
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
export const publicJobs = () => cachedSource<Job[]>("boe:empleo", "BOE: oposiciones y concursos", 3 * HOUR, async previous => {
  const response = await fetchSource(BOE_URL());
  const bytes = new Uint8Array(await response.arrayBuffer());
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 200));
  const xml = new TextDecoder(/encoding="utf-8"/i.test(head) ? "utf-8" : "latin1").decode(bytes);
  if (!/<rss\b/.test(xml)) throw new Error("BOE: la respuesta no es un RSS");
  const limit = new Date(Date.now() - 45 * 24 * HOUR).toISOString().slice(0, 10);
  const merged = new Map([...(previous ?? []), ...parseBoe(xml)].filter(j => j.date >= limit).map(j => [j.id, j]));
  return [...merged.values()].sort((a, b) => b.date.localeCompare(a.date));
});
