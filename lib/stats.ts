// Estadísticas propias de Planta 14: sin cookies ni datos personales. Se guardan solo contadores agregados por día,
// página, concejo, sección y procedencia (tabla stats_daily). Ni IP, ni navegador, ni identificadores.

export const TOWNS = ["mieres", "lena", "aller", "morcin", "riosa", "ribera-de-arriba"] as const;
export const SOURCES = ["buscadores", "redes", "whatsapp", "directo", "otros", "interna"] as const;
export type Source = typeof SOURCES[number];
export const sourceLabels: Record<Source, string> = { buscadores: "Buscadores", redes: "Redes sociales", whatsapp: "WhatsApp", directo: "Directo", otros: "Otras webs", interna: "Desde Planta 14" };

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link|whatsapp\/|telegrambot|preview|headless|lighthouse|pingdom|uptime|monitor|python|curl|wget|httpclient|java\/|go-http|axios|node-fetch|scrapy|feed/i;
/** Robots, comprobadores y vistas previas de enlaces (WhatsApp, Telegram…) no cuentan como visitas. */
export const isBot = (userAgent: string | null) => !userAgent || BOT.test(userAgent);
/** Zonas que no se cuentan: CMS, API, paneles, vistas previas y páginas de confirmación o baja. */
export const isTrackable = (path: string) => /^\/[^?#\s]{0,199}$/.test(path)
  && !/^\/(cms|api|admin|vista-previa|_next)(\/|$)/.test(path) && !/^\/[^/]+\/panel(\/|$)/.test(path)
  && !/^\/(boletin|cartas\/confirmar|fiestas\/confirmar)(\/|$)/.test(path);

const SEARCH = ["google.", "bing.com", "duckduckgo.com", "yahoo.", "ecosia.org", "qwant.com", "startpage.com", "yandex.", "search.brave.com"];
const SOCIAL = ["facebook.com", "instagram.com", "t.co", "x.com", "twitter.com", "linkedin.com", "lnkd.in", "tiktok.com", "bsky.app", "threads.net", "youtube.com", "reddit.com", "t.me", "telegram.org", "pinterest.com", "pinterest.es", "mastodon.social"];
const matches = (host: string, list: string[]) => list.some(d => d.endsWith(".") ? host.startsWith(d) || host.includes(`.${d}`) : host === d || host.endsWith(`.${d}`));
/** Procedencia a partir del referrer y de utm_source (el botón de WhatsApp lo añade: WhatsApp no envía referrer). */
export function classifySource(referrer: string, utm: string, siteHost: string): Source {
  if (/whatsapp/i.test(utm)) return "whatsapp";
  if (/^(facebook|x|twitter|telegram|instagram|linkedin|tiktok)$/i.test(utm)) return "redes";
  if (!referrer) return "directo";
  let host = "";
  try { host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, ""); } catch { return "otros"; }
  if (host === siteHost.replace(/^www\./, "")) return "interna";
  if (/(^|\.)whatsapp\.(com|net)$|^wa\.me$/.test(host)) return "whatsapp";
  if (matches(host, SEARCH)) return "buscadores";
  if (matches(host, SOCIAL)) return "redes";
  return "otros";
}
export const madridDay = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(date);

type Row = { day: string; path: string; town: string; section: string; source: string; views: number };
export type StatsReport = {
  from: string; to: string; town: string | null; total: number;
  byDay: { day: string; views: number }[]; topPages: { path: string; views: number }[];
  bySource: { source: Source; views: number }[]; byTown: { town: string; views: number }[]; bySection: { section: string; views: number }[];
};

async function db() {
  const { contentClient } = await import("./payload-content");
  const payload = await contentClient();
  const { sql } = await import("@payloadcms/db-postgres");
  return { payload, sql };
}

/** Suma una visita (una sola sentencia; no espera a nada más). */
export async function recordView(entry: { path: string; town: string; section: string; source: Source }) {
  const { payload, sql } = await db();
  await payload.db.drizzle.execute(sql`INSERT INTO stats_daily (day, path, town, section, source, views)
    VALUES (${madridDay()}, ${entry.path}, ${entry.town}, ${entry.section}, ${entry.source}, 1)
    ON CONFLICT (day, path, town, section, source) DO UPDATE SET views = stats_daily.views + 1`);
}

/** Informe de un periodo (días AAAA-MM-DD incluidos), de todos los concejos o de uno. */
export async function statsReport(from: string, to: string, town: string | null = null): Promise<StatsReport> {
  const { payload, sql } = await db();
  const where = town ? sql`day BETWEEN ${from} AND ${to} AND town = ${town}` : sql`day BETWEEN ${from} AND ${to}`;
  const rows = (await payload.db.drizzle.execute(sql`SELECT to_char(day, 'YYYY-MM-DD') AS day, path, town, section, source, views FROM stats_daily WHERE ${where}`)).rows as Row[];
  const sum = (key: keyof Row, onlyExternal = false) => {
    const map = new Map<string, number>();
    for (const row of rows) if (!onlyExternal || row.source !== "interna") map.set(String(row[key]), (map.get(String(row[key])) ?? 0) + Number(row.views));
    return [...map].map(([k, views]) => ({ k, views })).sort((a, b) => b.views - a.views);
  };
  const days: { day: string; views: number }[] = [];
  const byDayMap = new Map(sum("day").map(d => [d.k, d.views]));
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10); days.push({ day, views: byDayMap.get(day) ?? 0 });
  }
  return {
    from, to, town, total: rows.reduce((a, r) => a + Number(r.views), 0), byDay: days,
    topPages: sum("path").slice(0, 25).map(({ k, views }) => ({ path: k, views })),
    bySource: SOURCES.map(source => ({ source, views: rows.filter(r => r.source === source).reduce((a, r) => a + Number(r.views), 0) })).filter(s => s.views > 0),
    byTown: sum("town").filter(t => t.k).map(({ k, views }) => ({ town: k, views })),
    bySection: sum("section").filter(s => s.k).map(({ k, views }) => ({ section: k, views })),
  };
}
/** Primer y último día de un mes AAAA-MM (por defecto, el actual). */
export function monthRange(month?: string | null) {
  const value = month && /^\d{4}-\d{2}$/.test(month) ? month : madridDay().slice(0, 7);
  const [y, m] = value.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { month: value, from: `${value}-01`, to: `${value}-${String(last).padStart(2, "0")}` };
}
