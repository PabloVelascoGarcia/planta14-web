import Link from "next/link";
import type { ReactNode } from "react";
import { UTIL_BOX_LIMIT, UTIL_LINKS, type UtilData } from "@/lib/util";
import { townName, UTIL_TOWNS, type Cached } from "@/lib/util-sources";
import { formatDate } from "@/lib/utils";
import { UtilGrid } from "./util-grid";

// Bloques de la sección «Útil» (servidor). Cada dato automático (DGT, AEMET, BDNS, BOE) lleva la atribución que piden
// sus condiciones y la hora de consulta; si una fuente falla se enseña el último dato bueno con su hora, o un aviso, y el
// resto de la página sigue igual. Lo demás son enlaces claros a la fuente oficial, sin extraer datos.

const time = (iso: string | null) => iso ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : null;
const weekday = (day: string) => new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
const out = { target: "_blank", rel: "noopener noreferrer" } as const;

function Checked({ at, label = "Consultado" }: { at: string | null; label?: string }) {
  return at ? <> · {label}: <time dateTime={at}>{time(at)}</time></> : null;
}
function Stale({ error }: { error: string | null }) {
  return error ? <span className="util-stale" data-util-stale> · No se ha podido actualizar ahora: es el último dato disponible.</span> : null;
}
function Unavailable({ cached, what }: { cached: Cached<unknown>; what: string }) {
  return cached.data ? null : <p className="util-empty" data-util-unavailable>{cached.error ? `Ahora mismo no podemos consultar ${what}. Vuelve a intentarlo en unos minutos.` : `Consultando ${what}…`}</p>;
}
function Block({ id, title, kicker, children }: { id: string; title: string; kicker?: string; children: ReactNode }) {
  return <section className="util-block" data-util={id} aria-labelledby={`util-${id}`}>
    {kicker ? <p className="municipal-kicker">{kicker}</p> : null}<h3 id={`util-${id}`}>{title}</h3>{children}
  </section>;
}
/** Enlace claro a la fuente oficial (datos que no se extraen). */
function Official({ href, children }: { href: string; children: ReactNode }) {
  return <p className="util-official" data-util-link><a href={href} {...out} className="municipal-read-link">{children} ↗</a></p>;
}

/** «AAAA-MM-DDTHH:MM…» de AEMET (hora peninsular) → «DD/MM/AAAA HH:MM». */
const aemetTime = (iso: string) => iso.replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}).*$/, "$3/$2/$1 $4:$5");
/** Una hora o, si los concejos difieren, el intervalo («entre … y …»). */
function span(values: string[], format: (v: string) => string | null) {
  const sorted = [...new Set(values)].sort();
  if (!sorted.length) return null;
  return sorted.length === 1 ? format(sorted[0]) : `entre ${format(sorted[0])} y ${format(sorted[sorted.length - 1])}`;
}
/**
 * Atribución de AEMET, una sola vez al final del bloque del tiempo, como piden sus condiciones de reutilización: autoría
 * («© AEMET»), «Información elaborada por la Agencia Estatal de Meteorología» con enlace, y la fecha de elaboración y la
 * de consulta de los datos.
 */
function AemetSource({ forecasts }: { forecasts: Cached<{ issued: string | null }>[] }) {
  const issued = span(forecasts.flatMap(f => f.data?.issued ? [f.data.issued] : []), aemetTime);
  const checked = span(forecasts.flatMap(f => f.fetchedAt ? [f.fetchedAt] : []), time);
  return <p className="util-source util-source-end" data-util-source data-util-aemet>© AEMET. <a href={UTIL_LINKS.aemet} {...out}>Información elaborada por la Agencia Estatal de Meteorología</a>
    {issued ? <> · Elaborada: {issued} (hora peninsular)</> : null}{checked ? <> · Consultado: {checked}</> : null}.</p>;
}

/** «Ver todos (n)»: página propia con la lista completa de ese tipo y concejo. */
function More({ href, count, label = "Ver todos" }: { href: string; count: number; label?: string }) {
  return <Link href={href} className="municipal-read-link util-more" data-util-more>{label} ({count}) ↗</Link>;
}
const isTown = (scope: string) => UTIL_TOWNS.some(t => t.slug === scope);

/** Miniatura de la foto. Sin foto no se reserva hueco: el elemento va solo con texto, a todo el ancho. */
export function Thumb({ photo }: { photo: UtilData["heritage"][number]["photo"] }) {
  return photo ? <img className="util-thumb" src={photo.url} alt="" loading="lazy" decoding="async" width={88} height={66} /> : null;
}

type Service = UtilData["services"][number]; type Place = UtilData["heritage"][number];
type Grant = NonNullable<UtilData["grants"]["data"]>[number]; type Job = NonNullable<UtilData["jobs"]["data"]>[number];
/** Elementos de las listas (cajas de «Útil» y páginas «Ver todos»). `town`: página de un concejo (no repite el concejo). */
export function ServiceItem({ s }: { s: Service }) {
  return <li data-util-service><strong>{s.name}</strong>
    {s.address || s.place ? <span>{[s.address, s.address?.includes(s.place ?? "@@") ? null : s.place].filter(Boolean).join(", ")}</span> : null}
    {s.phone ? <span>Tel. {s.phone.split(" · ").map((p, i) => <span key={p}>{i ? " · " : ""}<a href={`tel:${p.replace(/[^\d+]/g, "")}`}>{p}</a></span>)}</span> : null}
    {s.email ? <span><a href={`mailto:${s.email}`}>{s.email}</a></span> : null}{s.hours ? <span className="util-hours">{s.hours}</span> : null}
    {s.web ? <span><a href={s.web} {...out}>Web ↗</a></span> : null}{s.notes ? <small>{s.notes}</small> : null}</li>;
}
export function PlaceItem({ p, kind, town }: { p: Place; kind: "patrimonio" | "rutas"; town: string | null }) {
  return <li>{kind === "patrimonio" ? <Thumb photo={p.photo} /> : null}<Link href={`/util/${kind}/${p.slug}`}><strong>{p.name}</strong><small>{[!town ? p.townName : null, p.detail].filter(Boolean).join(" · ")}</small>{p.summary ? <span>{p.summary}</span> : null}</Link></li>;
}
export function GrantItem({ g, town }: { g: Grant; town: string | null }) {
  return <li data-util-grant={g.scope}><a href={g.url} {...out}>{g.title}</a>
    <small>{g.organ}{g.scope === "estado" ? " · Administración del Estado" : isTown(g.scope) && !town ? ` · ${townName(g.scope)}` : ""}
      {g.end ? ` · Solicitudes hasta el ${formatDate(g.end)}` : g.endText ? ` · ${g.endText}` : " · Plazo: consulta la convocatoria"}
      {g.office ? <> · <a href={g.office} {...out}>Sede electrónica ↗</a></> : null}</small></li>;
}
export function JobItem({ j, town }: { j: Job; town: string | null }) {
  return <li data-util-job><a href={j.url} {...out}>{j.title}</a>
    <small>BOE del {formatDate(j.date)} · {j.id}{isTown(j.scope) && !town ? ` · ${townName(j.scope)}` : ""}</small></li>;
}

export function UtilBlocks({ data }: { data: UtilData }) {
  const show = (key: string) => !data.hidden.includes(key);
  const town = data.town;
  const pajares = data.pajares;
  const forecasts = data.forecasts?.filter(f => f.forecast.data || f.forecast.error) ?? null;
  // En /util todo lo regional (Pajares, estaciones, el tiempo, farmacias, ayudas y empleo generales); en cada concejo, lo suyo.
  const lenaWinter = town ? town === "lena" : true;
  const allerWinter = town ? town === "aller" : true;
  const winter = lenaWinter || allerWinter;
  const base = town ? `/${town}/util` : "/util";
  // En /util, las ayudas y el empleo de los ayuntamientos van en el bloque de cada concejo activo.
  const grants = data.grants.data?.filter(g => town || !isTown(g.scope)) ?? null;
  const jobs = data.jobs.data?.filter(j => town || !isTown(j.scope)) ?? null;
  return <UtilGrid>
    {show("invierno") && winter ? <Block id="invierno" title="Puertos y estaciones de esquí" kicker="Invierno">
      {lenaWinter ? <div className="util-card" data-util-pajares>
        <h4>Puerto de Pajares (N-630)</h4>
        {pajares.data ? pajares.data.incidents.length ? <><p className="util-status is-aviso">La DGT registra {pajares.data.incidents.length === 1 ? "una incidencia" : `${pajares.data.incidents.length} incidencias`}:</p>
          <ul className="util-list">{pajares.data.incidents.map(i => <li key={i.id} data-util-incident><strong>N-630{i.km !== null ? `, km ${String(i.km).replace(".", ",")}` : ""}</strong> ({townName(i.town)}){i.direction ? ` · sentido ${i.direction.toLowerCase()}` : ""}: {i.what}
            {i.since ? <small> · desde el {formatDate(i.since.slice(0, 10))}, {i.since.slice(11, 16)} h</small> : null}</li>)}</ul></>
          : <p className="util-status">La DGT no registra incidencias en el puerto. Comprueba el estado antes de salir.</p> : <Unavailable cached={pajares} what="la DGT" />}
        <p className="util-source" data-util-source>Fuente: <a href="https://nap.dgt.es/es/dataset/incidencias-dgt-datex2-v3-7" {...out}>Dirección General de Tráfico (DGT), Punto de Acceso Nacional</a>, licencia CC BY
          <Checked at={pajares.data?.publishedAt ?? null} label="Parte de la DGT" /><Checked at={pajares.fetchedAt} /><Stale error={pajares.data ? pajares.error : null} /></p>
      </div> : null}
      {allerWinter ? <div className="util-card"><h4>Puerto de San Isidro (AS-112)</h4><Official href={UTIL_LINKS.sanIsidro}>Estado de las carreteras en 112 Asturias</Official></div> : null}
      {lenaWinter ? <div className="util-card"><h4>Estación de Valgrande-Pajares</h4><Official href={UTIL_LINKS.valgrande}>Parte de nieve oficial de la estación</Official></div> : null}
      {allerWinter ? <div className="util-card"><h4>Estación de Fuentes de Invierno</h4><Official href={UTIL_LINKS.fuentes}>Parte oficial de la estación</Official></div> : null}
    </Block> : null}

    {show("tiempo") && forecasts?.length ? <Block id="tiempo" title="El tiempo" kicker="Predicción">
      {forecasts.map(({ town: slug, forecast }) => <div key={slug} className="util-forecast" data-util-forecast={slug}>
        {!town ? <h4>{townName(slug)}</h4> : null}
        {forecast.data ? <ol>{forecast.data.days.slice(0, town ? 4 : 2).map(d => <li key={d.day}><strong>{weekday(d.day)}</strong><span>{d.sky}</span>
          <span>{d.max ?? "–"}° / {d.min ?? "–"}°</span>{d.rain !== null ? <span>Lluvia {d.rain}%</span> : null}{d.snowLevel ? <span>Cota de nieve {d.snowLevel} m</span> : null}</li>)}</ol> : <Unavailable cached={forecast} what="la predicción" />}
        {forecast.data && forecast.error ? <p className="util-source"><Stale error={forecast.error} /></p> : null}
      </div>)}
      <AemetSource forecasts={forecasts.map(f => f.forecast)} />
    </Block> : null}

    {show("farmacias") ? <Block id="farmacias" title="Farmacias de guardia" kicker="Salud">
      <p>Las guardias las publica el Colegio Oficial de Farmacéuticos de Asturias.</p>
      <Official href={UTIL_LINKS.farmacias}>Buscador de farmacias de guardia del Colegio</Official>
    </Block> : null}

    {show("servicios") && town ? <Block id="servicios" title="Servicios municipales" kicker="Directorio">
      {data.services.length ? <ul className="util-services">{data.services.slice(0, UTIL_BOX_LIMIT).map(s => <ServiceItem key={s.id} s={s} />)}</ul>
        : <p className="util-empty">Todavía no hay servicios en el directorio de este concejo.</p>}
      {data.services.length ? <More href={`${base}/servicios`} count={data.services.length} /> : null}
    </Block> : null}

    {show("patrimonio") && town && data.heritage.length ? <Block id="patrimonio" title="Patrimonio" kicker="Conoce">
      <ul className="util-places">{data.heritage.slice(0, UTIL_BOX_LIMIT).map(p => <PlaceItem key={p.slug} p={p} kind="patrimonio" town={town} />)}</ul>
      <More href={`${base}/patrimonio`} count={data.heritage.length} />
    </Block> : null}

    {show("rutas") && town && data.routes.length ? <Block id="rutas" title="Rutas" kicker="Sal al monte">
      <ul className="util-places">{data.routes.slice(0, UTIL_BOX_LIMIT).map(p => <PlaceItem key={p.slug} p={p} kind="rutas" town={town} />)}</ul>
      <More href={`${base}/rutas`} count={data.routes.length} label="Ver todas" />
    </Block> : null}

    {show("subvenciones") ? <Block id="subvenciones" title="Subvenciones abiertas" kicker="Ayudas">
      {grants ? grants.length ? <ul className="util-list">{grants.slice(0, UTIL_BOX_LIMIT).map(g => <GrantItem key={g.id} g={g} town={town} />)}</ul>
        : <p>No encontramos convocatorias abiertas ahora mismo {town ? "del ayuntamiento, del Principado, del IDEPA ni del Estado" : "del Principado, del IDEPA ni del Estado"}.</p>
        : <Unavailable cached={data.grants} what="la Base de Datos Nacional de Subvenciones" />}
      {grants?.length ? <More href={`${base}/subvenciones`} count={grants.length} label="Ver todas" /> : null}
      <Official href={UTIL_LINKS.idepa}>Ayudas del IDEPA (Busca financiación)</Official>
      <p className="util-source" data-util-source>Fuente: <a href="https://www.infosubvenciones.es/bdnstrans/GE/es/index" {...out}>Base de Datos Nacional de Subvenciones</a> (Sistema Nacional de Publicidad de Subvenciones y Ayudas Públicas, IGAE).
        Selección de Planta 14; los datos pueden cambiar: la convocatoria oficial es la que vale<Checked at={data.grants.fetchedAt} /><Stale error={data.grants.data ? data.grants.error : null} />.
        {" "}<a href="https://www.infosubvenciones.es/bdnstrans/GE/es/avisolegal" {...out}>Aviso legal</a></p>
    </Block> : null}

    {show("empleo") ? <Block id="empleo" title="Empleo público" kicker="Oposiciones y bolsas">
      {jobs ? jobs.length ? <ul className="util-list">{jobs.slice(0, UTIL_BOX_LIMIT).map(j => <JobItem key={j.id} j={j} town={town} />)}</ul>
        : <p>En los últimos 45 días el BOE no ha publicado convocatorias {town ? "de este ayuntamiento ni del Principado" : "del Principado"}.</p> : <Unavailable cached={data.jobs} what="el BOE" />}
      {jobs?.length ? <More href={`${base}/empleo`} count={jobs.length} label="Ver todas" /> : null}
      <p className="util-source" data-util-source>Fuente: <a href="https://www.boe.es/" {...out}>Agencia Estatal Boletín Oficial del Estado</a> (RSS de oposiciones y concursos, sección II.B). Selección por concejo de Planta 14;
        el texto auténtico es el publicado en el BOE<Checked at={data.jobs.fetchedAt} /><Stale error={data.jobs.data ? data.jobs.error : null} />.</p>
      <Official href={UTIL_LINKS.bopa}>Empleo en el BOPA (Boletín Oficial del Principado de Asturias)</Official>
      {town && UTIL_LINKS.empleoMunicipal[town] ? <Official href={UTIL_LINKS.empleoMunicipal[town]}>Empleo en el Ayuntamiento de {townName(town)}</Official> : null}
    </Block> : null}

    {!town ? data.activeTowns.length ? UTIL_TOWNS.filter(t => data.activeTowns.includes(t.slug)).map(t => <TownCard key={t.slug} data={data} slug={t.slug} name={t.name} />)
      : null : null}
  </UtilGrid>;
}

/** En /util, un bloque por cada concejo con el espacio municipal activo, con lo que ese ayuntamiento publica. */
function TownCard({ data, slug, name }: { data: UtilData; slug: string; name: string }) {
  const hidden = data.hiddenByTown[slug] ?? [];
  const on = (key: string) => !hidden.includes(key);
  const heritage = data.heritage.filter(p => p.town === slug), routes = data.routes.filter(p => p.town === slug);
  const grants = data.grants.data?.filter(g => g.scope === slug) ?? [], jobs = data.jobs.data?.filter(j => j.scope === slug) ?? [];
  const services = data.servicesByTown[slug] ?? 0;
  const items = [
    on("servicios") && services ? [`/${slug}/util/servicios`, `Servicios municipales (${services})`] : null,
    on("patrimonio") && heritage.length ? [`/${slug}/util/patrimonio`, `Patrimonio (${heritage.length})`] : null,
    on("rutas") && routes.length ? [`/${slug}/util/rutas`, `Rutas (${routes.length})`] : null,
    on("subvenciones") && grants.length ? [`/${slug}/util/subvenciones`, `Ayudas del ayuntamiento (${grants.length})`] : null,
    on("empleo") && jobs.length ? [`/${slug}/util/empleo`, `Empleo del ayuntamiento (${jobs.length})`] : null,
  ].filter((x): x is string[] => Boolean(x));
  return <Block id={`concejo-${slug}`} title={name} kicker="Tu concejo">
    {items.length ? <ul className="util-list" data-util-town-links>{items.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul> : <p className="util-empty">Todavía no hay servicios publicados.</p>}
    {on("empleo") && UTIL_LINKS.empleoMunicipal[slug] ? <Official href={UTIL_LINKS.empleoMunicipal[slug]}>Empleo en el Ayuntamiento de {name}</Official> : null}
    <Link href={`/${slug}#util`} className="municipal-read-link">Todo lo útil de {name} ↗</Link>
  </Block>;
}
