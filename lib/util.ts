import type { Where } from "payload";
import { contentSource } from "./content-source";
import { aemetEnabled, aemetForecast, ensureUtilRefresher, openGrants, pajaresStatus, publicJobs, UTIL_TOWNS,
  type Cached, type Forecast, type Grant, type Job, type RoadIncident } from "./util-sources";

// Sección «Útil»: qué se enseña en /util y en la página de cada concejo. Cada servicio sale por defecto en todos los
// concejos; un ayuntamiento puede ocultarlo en su concejo desde su panel (en /util se quita lo de ese concejo).
// Solo cuatro fuentes son automáticas (DGT/Pajares, AEMET, BDNS y BOE); el resto son enlaces a la fuente oficial.

export { UTIL_SERVICES, type UtilService } from "./util-services";

/** Enlaces a la fuente oficial (sin extraer datos). Comprobados el 04/11/2026 (datos-servicios/fuentes-automaticas.md). */
export const UTIL_LINKS = {
  sanIsidro: "https://www.112asturias.es/estado-carreteras",
  valgrande: "https://www.valgrande-pajares.com/parte-de-nieve-meteo/",
  fuentes: "https://www.fuentesdeinvierno.com/es/parte-meteorologico.html",
  farmacias: "https://www.farmasturias.org/GESCOF/cms/Guardias/FarmaciaBuscar.asp?IdMenu=111",
  bopa: "https://miprincipado.asturias.es/bopa/disposiciones",
  idepa: "https://www.idepa.es/busca-financiacion",
  aemet: "https://www.aemet.es/es/eltiempo/prediccion/municipios",
  empleoMunicipal: {
    mieres: "https://www.mieres.es/anuncios-de-empleo", lena: "https://www.aytolena.es/empleo-y-formacion", aller: "https://www.aller.es/empleo",
    morcin: "https://www.morcin.es/empleo", riosa: "https://www.ayuntamientoriosa.com/seleccion-de-personal-y-provision-de-puestos",
    "ribera-de-arriba": "https://www.ayto-riberadearriba.es/empleo-publico",
  } as Record<string, string>,
};

export type Photo = { url: string; srcSet?: string; alt: string; credit: string; source: string | null };
export type Place = { slug: string; name: string; town: string; townName: string; summary: string | null; detail: string | null; photo: Photo | null; mapped: boolean; kind: string | null };
export type Service = { id: number; name: string; town: string; category: string; place: string | null; address: string | null; phone: string | null; email: string | null;
  web: string | null; hours: string | null; notes: string | null; sourceUrl: string | null; checkedAt: string | null };
export type UtilData = {
  town: string | null; hidden: string[]; hiddenByTown: Record<string, string[]>; activeTowns: string[];
  pajares: Cached<{ publishedAt: string | null; incidents: RoadIncident[] }>;
  forecasts: { town: string; forecast: Cached<Forecast> }[] | null;
  grants: Cached<Grant[]>; jobs: Cached<Job[]>;
  heritage: Place[]; routes: Place[]; services: Service[];
  /** En /util: número de servicios publicados de cada concejo activo. */
  servicesByTown: Record<string, number>;
};

const failed = <T,>(error: unknown): Cached<T> => ({ data: null, fetchedAt: null, error: error instanceof Error ? error.message : String(error) });
const safe = <T,>(promise: Promise<Cached<T>>) => promise.catch(failed<T>);
/** Primera frase de la descripción, para los listados. */
const summary = (text: string | null | undefined) => {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const first = t.match(/^.{20,220}?[.!?](\s|$)/)?.[0]?.trim() ?? t;
  return first.length > 220 ? `${first.slice(0, 217).replace(/\s+\S*$/, "")}…` : first;
};

/** Datos de «Útil» de un concejo (o de todos con town = null). Nunca lanza: cada bloque trae su error. */
export async function getUtilData(town: string | null): Promise<UtilData> {
  const empty = { data: null, fetchedAt: null, error: null };
  if (contentSource() !== "payload") return { town, hidden: [], hiddenByTown: {}, activeTowns: [], pajares: empty, forecasts: null, grants: empty, jobs: empty, heritage: [], routes: [], services: [], servicesByTown: {} };
  ensureUtilRefresher();
  const { contentClient } = await import("./payload-content");
  const payload = await contentClient();
  const townWhere: Where = town ? { "town.slug": { equals: town } } : {};
  const towns = town ? UTIL_TOWNS.filter(t => t.slug === town) : UTIL_TOWNS;
  const showsPajares = !town || town === "lena";
  const [pajares, grants, jobs, forecasts, heritage, routes, services, hiddenByTown] = await Promise.all([
    showsPajares ? safe(pajaresStatus()) : Promise.resolve(empty), safe(openGrants()), safe(publicJobs()),
    aemetEnabled() ? Promise.all(towns.map(async t => ({ town: t.slug, forecast: await safe(aemetForecast(t.slug)!) }))) : Promise.resolve(null),
    getPlaces("heritage", town), getPlaces("routes", town),
    payload.find({ collection: "municipal-services", depth: 1, pagination: false, sort: "order", overrideAccess: false, where: townWhere }).then(r => r.docs).catch(() => []),
    hiddenByConcejo(),
  ]);
  const active = await activeTowns();
  const hidden = town ? hiddenByTown[town] ?? [] : [];
  // En /util (todos los concejos) se quita de cada servicio lo del concejo que lo ha ocultado.
  // (En la página de un concejo cuenta solo lo que ha ocultado ese concejo: `hidden`.)
  // Lo de cada concejo (servicios, patrimonio, rutas, ayudas y empleo de su ayuntamiento) solo se publica si su espacio
  // municipal está activo; lo regional de Planta 14 (Pajares, el tiempo, ayudas y empleo generales) siempre.
  const isTown = (scope: string) => UTIL_TOWNS.some(t => t.slug === scope);
  const shown = (key: string, scope: string) => (!isTown(scope) || active.has(scope)) && (Boolean(town) || !(hiddenByTown[scope] ?? []).includes(key));
  const inTown = (scope: string) => !town || scope === town || !isTown(scope);
  return {
    town, hidden, hiddenByTown, activeTowns: [...active], pajares,
    // El tiempo es regional (Planta 14): sale para los seis concejos, salvo el que lo haya ocultado en su página.
    forecasts: forecasts?.filter(f => town || !(hiddenByTown[f.town] ?? []).includes("tiempo")) ?? null,
    grants: { ...grants, data: grants.data?.filter(g => inTown(g.scope) && shown("subvenciones", g.scope)) ?? null },
    jobs: { ...jobs, data: jobs.data?.filter(j => inTown(j.scope) && shown("empleo", j.scope)) ?? null },
    // Una ficha solo se publica si el concejo al que pertenece está activo (también las rutas que pasan por otro concejo).
    heritage: heritage.filter(p => shown("patrimonio", town ?? p.town) && active.has(p.town)), routes: routes.filter(p => shown("rutas", town ?? p.town) && active.has(p.town)),
    servicesByTown: town ? {} : services.reduce<Record<string, number>>((acc, doc) => { const slug = townOf(doc).slug; if (active.has(slug) && !(hiddenByTown[slug] ?? []).includes("servicios")) acc[slug] = (acc[slug] ?? 0) + 1; return acc; }, {}),
    services: (town ? services : []).map(doc => ({ id: doc.id, name: doc.name, town: townOf(doc).slug, category: doc.category, place: doc.place || null, address: doc.address || null,
      phone: doc.phone || null, email: doc.email || null, web: doc.web || null, hours: doc.hours || null, notes: doc.notes || null, sourceUrl: doc.sourceUrl || null, checkedAt: (doc as { checkedAt?: string | null }).checkedAt || null })),
  };
}

const townOf = (doc: { town?: unknown }) => (typeof doc.town === "object" && doc.town ? doc.town as { slug: string; name: string } : { slug: "", name: "" });
/** Fichas publicadas de Patrimonio o Rutas (de un concejo o de todos; las rutas también por «otros concejos»). */
export async function getPlaces(collection: "heritage" | "routes", town: string | null): Promise<Place[]> {
  if (contentSource() !== "payload") return [];
  const { contentClient } = await import("./payload-content");
  const payload = await contentClient();
  const byTown: Where = !town ? {} : collection === "routes" ? { or: [{ "town.slug": { equals: town } }, { "otherTowns.slug": { equals: town } }] } : { "town.slug": { equals: town } };
  type Doc = { slug?: string | null; name: string; town?: unknown; description?: string | null; place?: string | null; kind?: string | null; distanceKm?: number | null; difficulty?: string | null; image?: unknown; track?: unknown; lat?: number | null };
  const docs = await payload.find({ collection, depth: 1, pagination: false, sort: "name", overrideAccess: false, where: { and: [{ published: { equals: true } }, byTown] } })
    .then(r => r.docs as Doc[]).catch(() => [] as Doc[]);
  return Promise.all(docs.map(async doc => ({ slug: doc.slug ?? "", name: doc.name, town: townOf(doc).slug, townName: townOf(doc).name, summary: summary(doc.description),
    detail: collection === "routes" ? [typeof doc.distanceKm === "number" ? `${String(doc.distanceKm).replace(".", ",")} km` : null, doc.difficulty].filter(Boolean).join(" · ") || null
      : [doc.kind, doc.place].filter(Boolean).join(" · ") || null, photo: await photoOf(doc.image),
    mapped: (Array.isArray(doc.track) && doc.track.length > 0) || typeof doc.lat === "number", kind: (collection === "routes" ? doc.difficulty : doc.kind) || null })))
    // Primero las más completas: con foto (patrimonio) o con recorrido o mapa; luego por nombre.
    .then(list => list.sort((a, b) => Number(Boolean(b.photo)) - Number(Boolean(a.photo)) || Number(b.mapped) - Number(a.mapped) || a.name.localeCompare(b.name, "es")));
}

/** Concejos con el espacio municipal activo: solo en ellos se publica su «Útil» municipal. */
export async function activeTowns(): Promise<Set<string>> {
  const { getMunicipalSpaces } = await import("./municipal-content");
  return new Set((await getMunicipalSpaces({ activos: true })).map(space => space.territory));
}
/** ¿Se publica el servicio `key` de «Útil» de este concejo? Solo con el espacio activo y si no lo ha ocultado. */
export async function utilShownInTown(town: string, key: string): Promise<boolean> {
  if (contentSource() !== "payload") return false;
  const [active, hidden] = await Promise.all([activeTowns(), hiddenByConcejo()]);
  return active.has(town) && !(hidden[town] ?? []).includes(key);
}
/** Páginas «Ver todos» de cada concejo: /[concejo]/util/[tipo]. */
export const UTIL_LIST_TYPES = {
  servicios: "Servicios municipales", patrimonio: "Patrimonio", rutas: "Rutas", subvenciones: "Subvenciones abiertas", empleo: "Empleo público",
} as const;
export type UtilListType = keyof typeof UTIL_LIST_TYPES;
export const isUtilListType = (value: string): value is UtilListType => Object.hasOwn(UTIL_LIST_TYPES, value);
/** Accesos con recuento de un concejo (los mismos números que sus páginas «Ver todos»), sin lo que haya ocultado. */
export function utilCounts(data: UtilData): { key: UtilListType; label: string; count: number; href: string }[] {
  const town = data.town ?? "";
  const counts: [UtilListType, string, number][] = [["servicios", "Servicios", data.services.length], ["patrimonio", "Patrimonio", data.heritage.length],
    ["rutas", "Rutas", data.routes.length], ["subvenciones", "Ayudas", data.grants.data?.length ?? 0], ["empleo", "Empleo", data.jobs.data?.length ?? 0]];
  return counts.filter(([key, , count]) => count > 0 && !data.hidden.includes(key)).map(([key, label, count]) => ({ key, label, count, href: `/${town}/util/${key}` }));
}
/** Máximo de elementos por caja de «Útil»; el resto, en la página «Ver todos». */
export const UTIL_BOX_LIMIT = 5;

/** Foto publicable (copia pública) o null: sin foto, el diseño neutro. */
export async function photoOf(value: unknown): Promise<Photo | null> {
  if (!value || typeof value !== "object") return null;
  const { mediaURL, imageSrcSet } = await import("./payload-content");
  const media = value as Parameters<typeof mediaURL>[0] & { alt?: string; credit?: string; sourceURL?: string | null };
  const url = mediaURL(media);
  if (url === "/images/placeholder.svg") return null;
  return { url, srcSet: imageSrcSet(media), alt: media?.alt || "", credit: media?.credit || "", source: media?.sourceURL || null };
}

/** Servicios de «Útil» ocultos en cada concejo (slug del concejo → claves). */
export async function hiddenByConcejo(): Promise<Record<string, string[]>> {
  if (contentSource() !== "payload") return {};
  const { contentClient } = await import("./payload-content");
  const payload = await contentClient();
  const docs = await payload.find({ collection: "util-visibility", depth: 1, pagination: false, overrideAccess: true }).then(r => r.docs).catch(() => []);
  return Object.fromEntries(docs.filter(d => typeof d.town === "object" && d.town).map(d => [(d.town as { slug: string }).slug, (d.hidden ?? []) as string[]]));
}

export async function getPlace(collection: "heritage" | "routes", slug: string) {
  if (contentSource() !== "payload") return null;
  const { contentClient } = await import("./payload-content");
  const payload = await contentClient();
  const doc = (await payload.find({ collection, depth: 1, limit: 1, overrideAccess: false, where: { and: [{ slug: { equals: slug } }, { published: { equals: true } }] } })).docs[0];
  return doc ?? null;
}
