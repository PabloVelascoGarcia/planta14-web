import Link from "next/link";
import { notFound } from "next/navigation";
import { StatsScope } from "@/components/stats-beacon";
import { GrantItem, JobItem, PlaceItem, ServiceItem } from "@/components/util-blocks";
import { getUtilData, utilShownInTown, UTIL_LIST_TYPES, type UtilListType } from "@/lib/util";
import { townName, UTIL_TOWNS } from "@/lib/util-sources";
import { serviceCategories } from "@/cms/util-options";

// Páginas «Ver todos» de «Útil»: la lista completa de un tipo en un concejo (/lena/util/servicios…) o, para las ayudas y
// el empleo generales, en /util. Filtros sencillos por GET (búsqueda y tipo), sin JavaScript. Un concejo sin espacio
// municipal activo, o que ha ocultado ese servicio, da 404.

export type ListParams = { q?: string; tipo?: string; ambito?: string };
const norm = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chip = "inline-flex min-h-11 items-center border border-coal-900/25 px-4 text-[15px] font-bold hover:border-copper aria-[current=page]:border-coal-950 aria-[current=page]:bg-coal-950 aria-[current=page]:text-paper";

export async function utilListAllowed(town: string | null, type: UtilListType) {
  if (town === null) return type === "subvenciones" || type === "empleo";
  return UTIL_TOWNS.some(t => t.slug === town) && await utilShownInTown(town, type);
}

export async function UtilListPage({ town, type, params }: { town: string | null; type: UtilListType; params: ListParams }) {
  if (!(await utilListAllowed(town, type))) notFound();
  const data = await getUtilData(town);
  const base = town ? `/${town}/util/${type}` : `/util/${type}`;
  const q = norm(String(params.q ?? "").trim().slice(0, 80));
  const match = (...texts: (string | null | undefined)[]) => !q || norm(texts.filter(Boolean).join(" ")).includes(q);
  const filter = String(params.tipo ?? params.ambito ?? "");
  // Opciones del filtro por tipo (solo las que tienen elementos) y la lista ya filtrada.
  let options: { value: string; label: string }[] = [];
  let list: React.ReactNode[] = [];
  let total = 0;
  const param = type === "subvenciones" || type === "empleo" ? "ambito" : "tipo";
  const scopeLabel = (scope: string) => scope === "estado" ? "Estado" : scope === "asturias" ? "Principado" : scope === "idepa" ? "IDEPA" : UTIL_TOWNS.some(t => t.slug === scope) ? `Ayuntamiento de ${townName(scope)}` : "Principado";
  if (type === "servicios") {
    total = data.services.length;
    options = serviceCategories.filter(c => data.services.some(s => s.category === c.value)).map(c => ({ value: c.value, label: c.label }));
    list = data.services.filter(s => (!filter || s.category === filter) && match(s.name, s.place, s.address, s.notes)).map(s => <ServiceItem key={s.id} s={s} />);
  } else if (type === "patrimonio" || type === "rutas") {
    const places = type === "patrimonio" ? data.heritage : data.routes;
    total = places.length;
    options = [...new Set(places.map(p => p.kind).filter((k): k is string => Boolean(k)))].sort((a, b) => a.localeCompare(b, "es")).map(k => ({ value: k, label: k }));
    list = places.filter(p => (!filter || p.kind === filter) && match(p.name, p.summary, p.detail, p.townName)).map(p => <PlaceItem key={p.slug} p={p} kind={type} town={town} />);
  } else if (type === "subvenciones") {
    const grants = (data.grants.data ?? []).filter(g => town || !UTIL_TOWNS.some(t => t.slug === g.scope));
    total = grants.length;
    options = [...new Set(grants.map(g => g.scope))].map(s => ({ value: s, label: scopeLabel(s) }));
    list = grants.filter(g => (!filter || g.scope === filter) && match(g.title, g.organ)).map(g => <GrantItem key={g.id} g={g} town={town} />);
  } else {
    const jobs = (data.jobs.data ?? []).filter(j => town || !UTIL_TOWNS.some(t => t.slug === j.scope));
    total = jobs.length;
    options = [...new Set(jobs.map(j => j.scope))].map(s => ({ value: s, label: scopeLabel(s) }));
    list = jobs.filter(j => (!filter || j.scope === filter) && match(j.title, j.organ)).map(j => <JobItem key={j.id} j={j} town={town} />);
  }
  const where = town ? townName(town) : "las Cuencas";
  const listClass = type === "servicios" ? "util-services" : type === "patrimonio" || type === "rutas" ? "util-places" : "util-list";
  return <div className="container-p14 py-8 util-page util-list-page" data-util-list-page={type}>
    <StatsScope town={town ?? ""} section="util" />
    <header className="max-w-3xl border-b-2 border-coal-950 pb-5">
      <p className="editorial-kicker"><Link href={town ? `/${town}#util` : "/util"} className="inline-flex min-h-11 items-center">Útil · {where}</Link></p>
      <h1 className="mt-1 font-serif text-4xl font-black leading-none sm:text-5xl">{UTIL_LIST_TYPES[type]}</h1>
      <p className="mt-3 text-coal-800">{total === 1 ? "1 elemento" : `${total} elementos`} en {where}.</p>
    </header>
    <form method="get" action={base} className="util-filter mt-6" role="search" aria-label={`Buscar en ${UTIL_LIST_TYPES[type].toLowerCase()}`}>
      <label htmlFor="util-q">Buscar</label>
      <input id="util-q" name="q" type="search" defaultValue={params.q ?? ""} maxLength={80} />
      {filter ? <input type="hidden" name={param} value={filter} /> : null}
      <button type="submit">Buscar</button>
    </form>
    {options.length > 1 ? <nav aria-label="Filtrar por tipo" className="mt-4 flex flex-wrap gap-2" data-util-filter>
      <Link href={q ? `${base}?q=${encodeURIComponent(params.q ?? "")}` : base} aria-current={!filter ? "page" : undefined} className={chip}>Todos</Link>
      {options.map(o => <Link key={o.value} href={`${base}?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), [param]: o.value })}`} aria-current={filter === o.value ? "page" : undefined} className={chip}>{o.label}</Link>)}
    </nav> : null}
    {list.length ? <ul className={`${listClass} util-full-list mt-8`} data-util-list={type}>{list}</ul>
      : <p className="mt-8" data-util-list-empty>{total ? "Ningún resultado con estos filtros." : "Todavía no hay nada publicado aquí."}</p>}
  </div>;
}
