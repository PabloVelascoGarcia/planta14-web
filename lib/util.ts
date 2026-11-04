import type { Where } from "payload";
import { contentSource } from "./content-source";
import { aemetEnabled, aemetForecast, openGrants, pajaresStatus, publicJobs, UTIL_TOWNS,
  type Cached, type Forecast, type Grant, type Job, type RoadIncident } from "./util-sources";

// Sección «Útil»: qué se enseña en /util y en la página de cada concejo. Cada servicio sale por defecto en todos los
// concejos; un ayuntamiento puede ocultarlo en su concejo desde su panel (bloque 5).
// Solo cuatro fuentes son automáticas (DGT/Pajares, AEMET, BDNS y BOE); el resto son enlaces a la fuente oficial.

export const UTIL_SERVICES = [
  { key: "invierno", label: "Puertos y estaciones de esquí" },
  { key: "tiempo", label: "El tiempo (AEMET)" },
  { key: "farmacias", label: "Farmacias de guardia" },
  { key: "servicios", label: "Directorio de servicios municipales" },
  { key: "patrimonio", label: "Patrimonio" },
  { key: "rutas", label: "Rutas" },
  { key: "subvenciones", label: "Subvenciones abiertas" },
  { key: "empleo", label: "Empleo público" },
] as const;
export type UtilService = typeof UTIL_SERVICES[number]["key"];

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
export type Place = { slug: string; name: string; town: string; townName: string; summary: string | null; detail: string | null; photo: Photo | null };
export type Service = { id: number; name: string; town: string; category: string; place: string | null; address: string | null; phone: string | null; email: string | null;
  web: string | null; hours: string | null; notes: string | null; sourceUrl: string | null };
export type UtilData = {
  town: string | null; hidden: string[];
  pajares: Cached<{ publishedAt: string | null; incidents: RoadIncident[] }>;
  forecasts: { town: string; forecast: Cached<Forecast> }[] | null;
  grants: Cached<Grant[]>; jobs: Cached<Job[]>;
  heritage: Place[]; routes: Place[]; services: Service[];
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
  if (contentSource() !== "payload") return { town, hidden: [], pajares: empty, forecasts: null, grants: empty, jobs: empty, heritage: [], routes: [], services: [] };
  const { contentClient } = await import("./payload-content");
  const payload = await contentClient();
  const townWhere: Where = town ? { "town.slug": { equals: town } } : {};
  const towns = town ? UTIL_TOWNS.filter(t => t.slug === town) : UTIL_TOWNS;
  const showsPajares = !town || town === "lena";
  const [pajares, grants, jobs, forecasts, heritage, routes, services, hidden] = await Promise.all([
    showsPajares ? safe(pajaresStatus()) : Promise.resolve(empty), safe(openGrants()), safe(publicJobs()),
    aemetEnabled() ? Promise.all(towns.map(async t => ({ town: t.slug, forecast: await safe(aemetForecast(t.slug)!) }))) : Promise.resolve(null),
    getPlaces("heritage", town), getPlaces("routes", town),
    town ? payload.find({ collection: "municipal-services", depth: 1, pagination: false, sort: "order", overrideAccess: false, where: townWhere }).then(r => r.docs).catch(() => []) : Promise.resolve([]),
    town ? hiddenServices(town) : Promise.resolve([] as string[]),
  ]);
  const inTown = (scope: string) => !town || scope === town || !UTIL_TOWNS.some(t => t.slug === scope);
  return {
    town, hidden, pajares, forecasts,
    grants: { ...grants, data: grants.data?.filter(g => inTown(g.scope)) ?? null },
    jobs: { ...jobs, data: jobs.data?.filter(j => inTown(j.scope)) ?? null },
    heritage, routes,
    services: services.map(doc => ({ id: doc.id, name: doc.name, town: townOf(doc).slug, category: doc.category, place: doc.place || null, address: doc.address || null,
      phone: doc.phone || null, email: doc.email || null, web: doc.web || null, hours: doc.hours || null, notes: doc.notes || null, sourceUrl: doc.sourceUrl || null })),
  };
}

const townOf = (doc: { town?: unknown }) => (typeof doc.town === "object" && doc.town ? doc.town as { slug: string; name: string } : { slug: "", name: "" });
/** Fichas publicadas de Patrimonio o Rutas (de un concejo o de todos; las rutas también por «otros concejos»). */
export async function getPlaces(collection: "heritage" | "routes", town: string | null): Promise<Place[]> {
  if (contentSource() !== "payload") return [];
  const { contentClient } = await import("./payload-content");
  const payload = await contentClient();
  const byTown: Where = !town ? {} : collection === "routes" ? { or: [{ "town.slug": { equals: town } }, { "otherTowns.slug": { equals: town } }] } : { "town.slug": { equals: town } };
  type Doc = { slug?: string | null; name: string; town?: unknown; description?: string | null; place?: string | null; kind?: string | null; distanceKm?: number | null; difficulty?: string | null; image?: unknown };
  const docs = await payload.find({ collection, depth: 1, pagination: false, sort: "name", overrideAccess: false, where: { and: [{ published: { equals: true } }, byTown] } })
    .then(r => r.docs as Doc[]).catch(() => [] as Doc[]);
  return Promise.all(docs.map(async doc => ({ slug: doc.slug ?? "", name: doc.name, town: townOf(doc).slug, townName: townOf(doc).name, summary: summary(doc.description),
    detail: collection === "routes" ? [typeof doc.distanceKm === "number" ? `${String(doc.distanceKm).replace(".", ",")} km` : null, doc.difficulty].filter(Boolean).join(" · ") || null
      : [doc.kind, doc.place].filter(Boolean).join(" · ") || null, photo: await photoOf(doc.image) })));
}

/** Foto publicable (copia pública) o null: sin foto, el diseño neutro. */
export async function photoOf(value: unknown): Promise<Photo | null> {
  if (!value || typeof value !== "object") return null;
  const { mediaURL, imageSrcSet } = await import("./payload-content");
  const media = value as Parameters<typeof mediaURL>[0] & { alt?: string; credit?: string; sourceURL?: string | null };
  const url = mediaURL(media);
  if (url === "/images/placeholder.svg") return null;
  return { url, srcSet: imageSrcSet(media), alt: media?.alt || "", credit: media?.credit || "", source: media?.sourceURL || null };
}

/** Servicios de «Útil» que un concejo ha ocultado (bloque 5). */
export async function hiddenServices(town: string): Promise<string[]> {
  void town;
  return [];
}

export async function getPlace(collection: "heritage" | "routes", slug: string) {
  if (contentSource() !== "payload") return null;
  const { contentClient } = await import("./payload-content");
  const payload = await contentClient();
  const doc = (await payload.find({ collection, depth: 1, limit: 1, overrideAccess: false, where: { and: [{ slug: { equals: slug } }, { published: { equals: true } }] } })).docs[0];
  return doc ?? null;
}
