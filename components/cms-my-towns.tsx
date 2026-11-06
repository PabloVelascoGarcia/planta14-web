import type { AdminViewServerProps, Payload, Where } from "payload";
import Link from "next/link";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { CmsWithdraw } from "./cms-withdraw";

type CmsUser = { id: number | string; role?: string | null; collection?: string };
const TYPES: Record<string, string> = { news: "Noticia", notice: "Aviso", event: "Agenda", grant: "Ayudas", announcement: "Tablón" };
const day = (iso?: string | null) => iso ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" }).format(new Date(iso)) : "";
const row = { display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--theme-elevation-150)" } as const;
const small = { fontSize: 13, opacity: 0.75 } as const;
const action = { fontSize: 13, textDecoration: "underline" } as const;

/**
 * «Mis concejos»: lo último que publican los ayuntamientos y las sugerencias recibidas, filtrado por defecto por los
 * concejos de los que eres responsable (Concejos → Periodista responsable). Es un filtro, no una restricción: «Todos»
 * o cualquier otro concejo. Las sugerencias siguen su acceso: cada periodista ve las de sus concejos.
 */
export async function MyTowns({ payload, user, filter, compact = false }: { payload: Payload; user: CmsUser; filter?: string | null; compact?: boolean }) {
  const towns = (await payload.find({ collection: "towns", pagination: false, depth: 0, overrideAccess: true, sort: "name" })).docs as { id: number; name: string; slug: string; responsible?: unknown }[];
  const mine = towns.filter(t => (typeof t.responsible === "object" && t.responsible ? (t.responsible as { id: unknown }).id : t.responsible) === user.id);
  const chosen = filter === "todos" ? "todos" : towns.some(t => t.slug === filter) ? filter! : mine.length ? "mios" : "todos";
  const selected = chosen === "todos" ? towns : chosen === "mios" ? mine : towns.filter(t => t.slug === chosen);
  const ids = selected.map(t => t.id);
  const spaces = (await payload.find({ collection: "municipal-spaces", pagination: false, depth: 0, overrideAccess: true, where: { town: { in: ids } } })).docs as { id: number; name: string; legacyID?: string | null; town?: unknown }[];
  const spaceIDs = spaces.map(s => s.id);
  const contentWhere: Where = { space: { in: spaceIDs.length ? spaceIDs : [0] } };
  const [contents, suggestions] = await Promise.all([
    payload.find({ collection: "municipal-content", where: contentWhere, sort: "-updatedAt", limit: compact ? 6 : 30, depth: 0, overrideAccess: true }),
    payload.find({ collection: "suggestions", where: { town: { in: ids.length ? ids : [0] } }, sort: "-createdAt", limit: compact ? 3 : 15, depth: 0, user, overrideAccess: false }),
  ]);
  const spaceOf = (id: unknown) => spaces.find(s => s.id === id);
  const option = (value: string, label: string) => <option key={value} value={value}>{label}</option>;
  return <section data-my-towns={chosen} style={{ marginTop: compact ? 28 : 0 }}>
    {compact ? <h2 style={{ margin: "0 0 4px" }}>Mis concejos</h2> : null}
    <p style={{ ...small, margin: "0 0 10px" }}>{chosen === "mios" ? `Filtrado por tus concejos: ${mine.map(t => t.name).join(", ")}.` : chosen === "todos" ? "Todos los concejos." : `Concejo: ${selected[0]?.name}.`}{" "}
      {compact ? <Link href="/cms/mis-concejos" style={action} data-my-towns-more>Ver más u otros concejos</Link> : null}</p>
    {!compact ? <form method="get" style={{ display: "flex", gap: 10, alignItems: "end", margin: "0 0 20px", flexWrap: "wrap" }}>
      <label style={{ display: "grid", gap: 4 }}>Concejos<select name="concejo" defaultValue={chosen} style={{ minHeight: 40 }} data-my-towns-filter>
        {mine.length ? option("mios", "Mis concejos") : null}{option("todos", "Todos los concejos")}{towns.map(t => option(t.slug, t.name))}</select></label>
      <button type="submit" className="btn btn--style-primary btn--size-medium" style={{ margin: 0 }}>Ver</button>
    </form> : null}
    <h3 style={{ margin: "0 0 4px" }}>Publicaciones de los ayuntamientos</h3>
    {contents.docs.length ? <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px" }}>{contents.docs.map(raw => {
      const c = raw as unknown as { id: number; title: string; type: string; space: number; _status?: string; updatedAt?: string; withdrawal?: { withdrawn?: boolean | null; reason?: string | null } };
      const space = spaceOf(c.space);
      const withdrawn = Boolean(c.withdrawal?.withdrawn);
      const status = withdrawn ? `Retirado: ${c.withdrawal?.reason ?? ""}` : c._status === "published" ? "Publicado" : "Borrador";
      const web = `/${space?.legacyID ?? ""}${c.type !== "news" ? `?seccion=${c.type}` : ""}`;
      return <li key={c.id} style={row} data-my-towns-item={c.id}>
        <span style={small}>{TYPES[c.type] ?? c.type}</span><strong>{c.title}</strong>
        <span style={small}>{space?.name} · <span data-my-towns-status>{status}</span> · {day(c.updatedAt)}</span>
        <span style={{ display: "flex", gap: 12, marginLeft: "auto", flexWrap: "wrap" }}>
          {c._status === "published" && !withdrawn ? <a href={web} target="_blank" rel="noopener" style={action} data-my-towns-web>Ver en la web</a> : null}
          <a href={`/cms/collections/municipal-content/${c.id}`} style={action}>Abrir</a>
          {!withdrawn ? <CmsWithdraw id={c.id} title={c.title} /> : null}
        </span>
      </li>;
    })}</ul> : <p style={small}>No hay publicaciones de estos concejos.</p>}
    <h3 style={{ margin: "0 0 4px" }}>Sugerencias recibidas</h3>
    {suggestions.docs.length ? <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{suggestions.docs.map(raw => {
      const s = raw as unknown as { id: number; summary?: string; space?: number; createdAt?: string };
      return <li key={s.id} style={row} data-my-towns-suggestion={s.id}><a href={`/cms/collections/suggestions/${s.id}`}><strong>{s.summary || "Sugerencia"}</strong></a>
        <span style={small}>{spaceOf(s.space)?.name} · {day(s.createdAt)}</span></li>;
    })}</ul> : <p style={small}>{chosen === "mios" || user.role === "admin" ? "No hay sugerencias." : "No hay sugerencias que puedas ver: cada periodista ve las de los concejos de los que es responsable."}</p>}
  </section>;
}

/** /cms/mis-concejos (redacción y administración). */
export async function MyTownsView(props: AdminViewServerProps) {
  const { initPageResult, searchParams, params, i18n, payload, user, locale, permissions } = props;
  const me = initPageResult.req.user as CmsUser | null;
  const editorial = me?.collection === "users" && ["admin", "editor"].includes(String(me.role));
  return <DefaultTemplate i18n={i18n} locale={locale} params={params} payload={payload} permissions={permissions} searchParams={searchParams} user={user} visibleEntities={initPageResult.visibleEntities}>
    <div className="gutter--left gutter--right" style={{ paddingTop: 24, paddingBottom: 48, maxWidth: 1000 }} data-cms-my-towns>
      <h1 style={{ marginBottom: 8 }}>Mis concejos</h1>
      {editorial ? <MyTowns payload={payload} user={me!} filter={typeof searchParams?.concejo === "string" ? searchParams.concejo : null} /> : <p>Solo para la redacción.</p>}
    </div>
  </DefaultTemplate>;
}
