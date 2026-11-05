import Link from "next/link";
import type { ReactNode } from "react";
import { UTIL_LINKS, type UtilData } from "@/lib/util";
import { townName, UTIL_TOWNS, type Cached } from "@/lib/util-sources";
import { formatDate } from "@/lib/utils";

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

/** Miniatura de la foto o, sin foto, el diseño neutro. */
export function Thumb({ photo }: { photo: UtilData["heritage"][number]["photo"] }) {
  return photo ? <img className="util-thumb" src={photo.url} alt="" loading="lazy" decoding="async" /> : <span className="util-thumb is-neutral" aria-hidden="true" data-util-neutral />;
}

export function UtilBlocks({ data }: { data: UtilData }) {
  const show = (key: string) => !data.hidden.includes(key);
  const town = data.town;
  const pajares = data.pajares;
  const forecasts = data.forecasts?.filter(f => f.forecast.data || f.forecast.error) ?? null;
  // En /util, lo del concejo que ha ocultado un servicio no sale (Pajares y Valgrande son de Lena; San Isidro y Fuentes, de Aller).
  const townShows = (key: string, slug: string) => !(data.hiddenByTown[slug] ?? []).includes(key);
  const lenaWinter = town ? town === "lena" : townShows("invierno", "lena");
  const allerWinter = town ? town === "aller" : townShows("invierno", "aller");
  const winter = lenaWinter || allerWinter;
  return <div className="util-grid">
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
        <p className="util-source" data-util-source>© AEMET. <a href={UTIL_LINKS.aemet} {...out}>Información elaborada por la Agencia Estatal de Meteorología</a>
          {forecast.data?.issued ? <> · Elaborada: {forecast.data.issued.replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}).*$/, "$3/$2/$1 $4:$5")} (hora peninsular)</> : null}<Checked at={forecast.fetchedAt} /><Stale error={forecast.data ? forecast.error : null} /></p>
      </div>)}
    </Block> : null}

    {show("farmacias") ? <Block id="farmacias" title="Farmacias de guardia" kicker="Salud">
      <p>Las guardias las publica el Colegio Oficial de Farmacéuticos de Asturias.</p>
      <Official href={UTIL_LINKS.farmacias}>Buscador de farmacias de guardia del Colegio</Official>
    </Block> : null}

    {show("servicios") && town ? <Block id="servicios" title="Servicios municipales" kicker="Directorio">
      {data.services.length ? <ul className="util-services">{data.services.map(s => <li key={s.id} data-util-service><strong>{s.name}</strong>
        {s.address || s.place ? <span>{[s.address, s.address?.includes(s.place ?? "@@") ? null : s.place].filter(Boolean).join(", ")}</span> : null}
        {s.phone ? <span>Tel. {s.phone.split(" · ").map((p, i) => <span key={p}>{i ? " · " : ""}<a href={`tel:${p.replace(/[^\d+]/g, "")}`}>{p}</a></span>)}</span> : null}
        {s.email ? <span><a href={`mailto:${s.email}`}>{s.email}</a></span> : null}{s.hours ? <span>{s.hours}</span> : null}
        {s.web ? <span><a href={s.web} {...out}>Web ↗</a></span> : null}{s.notes ? <small>{s.notes}</small> : null}</li>)}</ul>
        : <p className="util-empty">Todavía no hay servicios en el directorio de este concejo.</p>}
    </Block> : null}

    {show("patrimonio") && data.heritage.length ? <Block id="patrimonio" title="Patrimonio" kicker="Conoce">
      <ul className="util-places">{data.heritage.slice(0, town ? 12 : 8).map(p => <li key={p.slug}><Thumb photo={p.photo} /><Link href={`/util/patrimonio/${p.slug}`}><strong>{p.name}</strong><small>{[!town ? p.townName : null, p.detail].filter(Boolean).join(" · ")}</small>{p.summary ? <span>{p.summary}</span> : null}</Link></li>)}</ul>
      <Link href={`/util/patrimonio${town ? `?concejo=${town}` : ""}`} className="municipal-read-link">Todo el patrimonio ↗</Link>
    </Block> : null}

    {show("rutas") && data.routes.length ? <Block id="rutas" title="Rutas" kicker="Sal al monte">
      <ul className="util-places">{data.routes.slice(0, town ? 12 : 8).map(p => <li key={p.slug}><Link href={`/util/rutas/${p.slug}`}><strong>{p.name}</strong><small>{[!town ? p.townName : null, p.detail].filter(Boolean).join(" · ")}</small>{p.summary ? <span>{p.summary}</span> : null}</Link></li>)}</ul>
      <Link href={`/util/rutas${town ? `?concejo=${town}` : ""}`} className="municipal-read-link">Todas las rutas ↗</Link>
    </Block> : null}

    {show("subvenciones") ? <Block id="subvenciones" title="Subvenciones abiertas" kicker="Ayudas">
      {data.grants.data ? data.grants.data.length ? <ul className="util-list">{data.grants.data.slice(0, 15).map(g => <li key={g.id} data-util-grant={g.scope}><a href={g.url} {...out}>{g.title}</a>
        <small>{g.organ}{g.scope === "estado" ? " · Administración del Estado" : UTIL_TOWNS.some(t => t.slug === g.scope) && !town ? ` · ${townName(g.scope)}` : ""}
          {g.end ? ` · Solicitudes hasta el ${formatDate(g.end)}` : g.endText ? ` · ${g.endText}` : " · Plazo: consulta la convocatoria"}
          {g.office ? <> · <a href={g.office} {...out}>Sede electrónica ↗</a></> : null}</small></li>)}</ul>
        : <p>No encontramos convocatorias abiertas ahora mismo {town ? "del ayuntamiento, del Principado, del IDEPA ni del Estado" : "de estos ayuntamientos, del Principado, del IDEPA ni del Estado"}.</p>
        : <Unavailable cached={data.grants} what="la Base de Datos Nacional de Subvenciones" />}
      <Official href={UTIL_LINKS.idepa}>Ayudas del IDEPA (Busca financiación)</Official>
      <p className="util-source" data-util-source>Fuente: <a href="https://www.infosubvenciones.es/bdnstrans/GE/es/index" {...out}>Base de Datos Nacional de Subvenciones</a> (Sistema Nacional de Publicidad de Subvenciones y Ayudas Públicas, IGAE).
        Selección de Planta 14; los datos pueden cambiar: la convocatoria oficial es la que vale<Checked at={data.grants.fetchedAt} /><Stale error={data.grants.data ? data.grants.error : null} />.
        {" "}<a href="https://www.infosubvenciones.es/bdnstrans/GE/es/avisolegal" {...out}>Aviso legal</a></p>
    </Block> : null}

    {show("empleo") ? <Block id="empleo" title="Empleo público" kicker="Oposiciones y bolsas">
      {data.jobs.data ? data.jobs.data.length ? <ul className="util-list">{data.jobs.data.slice(0, 12).map(j => <li key={j.id} data-util-job><a href={j.url} {...out}>{j.title}</a>
        <small>BOE del {formatDate(j.date)} · {j.id}{UTIL_TOWNS.some(t => t.slug === j.scope) && !town ? ` · ${townName(j.scope)}` : ""}</small></li>)}</ul>
        : <p>En los últimos 45 días el BOE no ha publicado convocatorias {town ? "de este ayuntamiento ni del Principado" : "de estos ayuntamientos ni del Principado"}.</p> : <Unavailable cached={data.jobs} what="el BOE" />}
      <p className="util-source" data-util-source>Fuente: <a href="https://www.boe.es/" {...out}>Agencia Estatal Boletín Oficial del Estado</a> (RSS de oposiciones y concursos, sección II.B). Selección por concejo de Planta 14;
        el texto auténtico es el publicado en el BOE<Checked at={data.jobs.fetchedAt} /><Stale error={data.jobs.data ? data.jobs.error : null} />.</p>
      <Official href={UTIL_LINKS.bopa}>Empleo en el BOPA (Boletín Oficial del Principado de Asturias)</Official>
      {(town ? [town] : Object.keys(UTIL_LINKS.empleoMunicipal).filter(slug => townShows("empleo", slug))).map(slug => UTIL_LINKS.empleoMunicipal[slug] ? <Official key={slug} href={UTIL_LINKS.empleoMunicipal[slug]}>Empleo en el Ayuntamiento de {townName(slug)}</Official> : null)}
    </Block> : null}
  </div>;
}
