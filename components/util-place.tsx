import Link from "next/link";
import { UtilMap } from "./util-map";
import type { Photo } from "@/lib/util";

type Town = { name: string; slug: string };
type Doc = { name: string; town?: unknown; otherTowns?: unknown; place?: string | null; kind?: string | null; description?: string | null;
  protection?: string | null; protectionUrl?: string | null; coordinatesNote?: string | null; code?: string | null; start?: string | null; end?: string | null;
  distanceKm?: number | null; distanceNote?: string | null; elevationUp?: number | null; elevationDown?: number | null; difficulty?: string | null; duration?: string | null;
  gpxUrl?: string | null; gpxLabel?: string | null; alsoIn?: string | null; track?: unknown; lat?: number | null; lon?: number | null; sources?: { url: string }[] | null };
const out = { target: "_blank", rel: "noopener noreferrer" } as const;
const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };

/** Ficha de Patrimonio o de Ruta, con mapa de OpenStreetMap si tiene coordenadas y sus fuentes oficiales. */
export function UtilPlace({ doc, kind, photo }: { doc: Doc; kind: "patrimonio" | "rutas"; photo: Photo | null }) {
  const town = typeof doc.town === "object" && doc.town ? doc.town as Town : null;
  const others = Array.isArray(doc.otherTowns) ? (doc.otherTowns as unknown[]).filter((t): t is Town => typeof t === "object" && t !== null) : [];
  const track = Array.isArray(doc.track) ? doc.track as [number, number][][] : [];
  const point: [number, number] | null = typeof doc.lat === "number" && typeof doc.lon === "number" ? [doc.lat, doc.lon] : null;
  const km = (n: number) => `${String(n).replace(".", ",")} km`;
  const facts: [string, string][] = (kind === "rutas"
    ? [doc.code && ["Código", doc.code], doc.distanceKm != null && ["Distancia", `${km(doc.distanceKm)}${doc.distanceNote ? ` (${doc.distanceNote.toLowerCase()})` : ""}`],
       (doc.elevationUp != null || doc.elevationDown != null) && ["Desnivel", [doc.elevationUp != null ? `+${doc.elevationUp} m` : null, doc.elevationDown != null ? `−${doc.elevationDown} m` : null].filter(Boolean).join(" / ")],
       doc.difficulty && ["Dificultad", doc.difficulty], doc.duration && ["Duración", doc.duration], doc.start && ["Salida", doc.start], doc.end && doc.end !== doc.start && ["Llegada", doc.end],
       (doc.alsoIn || others.length) && ["También pasa por", doc.alsoIn || others.map(t => t.name).join(", ")]]
    : [doc.kind && ["Tipo", doc.kind], doc.place && ["Localidad", doc.place], doc.protection && ["Protección", doc.protection]]).filter((f): f is [string, string] => Array.isArray(f));
  return <article className="container-p14 py-8 util-place" data-util-place={kind}>
    <p className="editorial-kicker"><Link href={`/util/${kind}${town ? `?concejo=${town.slug}` : ""}`}>{kind === "rutas" ? "Rutas" : "Patrimonio"}</Link>{town ? <> · <Link href={`/${town.slug}#util`}>{town.name}</Link></> : null}</p>
    <h1 className="mt-2 font-serif text-5xl font-black leading-none">{doc.name}</h1>
    <dl className="util-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    <div className="util-place-body">
      <div>{kind === "patrimonio" ? photo ? <figure className="util-photo" data-util-photo><img src={photo.url} srcSet={photo.srcSet} sizes="(min-width: 1024px) 700px, calc(100vw - 32px)" alt={photo.alt} decoding="async" />
          <figcaption>Foto: {photo.source ? <a href={photo.source} {...out}>{photo.credit}</a> : photo.credit}</figcaption></figure>
        : <div className="util-neutral" data-util-neutral aria-hidden="true">{town?.name ?? "Patrimonio"}</div> : null}{String(doc.description ?? "").split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        {doc.gpxUrl ? <p data-util-download><a href={doc.gpxUrl} {...out} className="municipal-read-link">{doc.gpxLabel || "Descarga oficial del track"} ({host(doc.gpxUrl)}) ↗</a></p> : null}
        {doc.protectionUrl ? <p><a href={doc.protectionUrl} {...out} className="municipal-read-link">Norma de protección ↗</a></p> : null}
        {doc.sources?.length ? <p className="util-source" data-util-sources>Fuentes: {doc.sources.map((s, i) => <span key={s.url}>{i ? " · " : ""}<a href={s.url} {...out}>{host(s.url)}</a></span>)}. Texto de Planta 14.</p> : null}</div>
      {track.length ? <UtilMap track={track} title={doc.name} /> : point ? <div><UtilMap point={point} title={doc.name} />{doc.coordinatesNote ? <p className="util-source">Punto del mapa: {doc.coordinatesNote}</p> : null}</div> : null}
    </div>
  </article>;
}
