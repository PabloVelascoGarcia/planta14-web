import type { AdminViewServerProps, Payload } from "payload";
import Link from "next/link";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { CmsInboxActions } from "./cms-inbox-actions";
import { CmsWithdraw } from "./cms-withdraw";

type CmsUser = { id: number | string; role?: string | null; collection?: string };
type Notice = { id: number; kind: string; title: string; createdAt: string; town?: unknown; assignedTo?: unknown; festival?: unknown; letter?: unknown; suggestion?: unknown;
  reviewed?: boolean | null; decision?: string | null; rejectReason?: string | null; rejectNote?: string | null; resolvedBy?: unknown; resolvedAt?: string | null };
const when = (iso?: string | null) => iso ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "";
const row = { display: "flex", flexWrap: "wrap", gap: "4px 14px", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--theme-elevation-150)" } as const;
const small = { fontSize: 13, opacity: 0.75 } as const;
const link = { fontSize: 13, textDecoration: "underline" } as const;
const nameOf = (value: unknown) => value && typeof value === "object" ? String((value as { name?: string; email?: string }).name || (value as { email?: string }).email || "") : "";
const idOf = (value: unknown) => value && typeof value === "object" ? (value as { id: number }).id : typeof value === "number" ? value : null;
const DECISIONS: Record<string, string> = { aprobado: "Aprobado", rechazado: "Rechazado", revisado: "Revisado" };

/** Enlace a la ficha de lo que hay detrás de cada entrada. */
function target(n: Notice) {
  if (n.kind === "festival-submission" && n.festival) return `/cms/collections/festivals/${idOf(n.festival)}`;
  if (n.kind === "letter-submission" && n.letter) return `/cms/collections/letters/${idOf(n.letter)}`;
  if (n.kind === "suggestion" && n.suggestion) return `/cms/collections/suggestions/${idOf(n.suggestion)}`;
  return `/cms/collections/notifications/${n.id}`;
}
/** Una línea de contexto: dónde, cuándo, qué piden. */
function context(n: Notice) {
  if (n.kind === "festival-submission" && n.festival && typeof n.festival === "object") {
    const f = n.festival as { village?: string; startDate?: string | null; endDate?: string | null; dateStatus?: string };
    const day = (d?: string | null) => d ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short" }).format(new Date(d)) : "";
    return `${f.village ?? ""}${f.startDate ? ` · ${day(f.startDate)}${f.endDate && f.endDate !== f.startDate ? `–${day(f.endDate)}` : ""}` : ""}`;
  }
  if (n.kind === "letter-submission" && n.letter && typeof n.letter === "object") return String((n.letter as { text?: string }).text ?? "").replace(/\s+/g, " ").slice(0, 140);
  if (n.kind === "suggestion" && n.suggestion && typeof n.suggestion === "object") return String((n.suggestion as { summary?: string }).summary ?? "");
  return "";
}

/**
 * Bandeja «Pendiente de revisar»: lo que necesita intervención (fiestas enviadas, sugerencias y cartas), por fecha, con
 * su concejo y su responsable. Primero lo de tus concejos (los tuyos, los de quien esté fuera y los que no tienen
 * responsable, como Caudal); después, lo del resto: la bandeja es compartida. Debajo, lo resuelto con quién y cuándo.
 */
export async function Inbox({ payload, user, compact = false, highlight }: { payload: Payload; user: CmsUser; compact?: boolean; highlight?: number | null }) {
  const { townsWithResponsibles, inboxTownsFor, pendingInbox, INBOX_KINDS, KIND_LABELS, APPROVE_LABELS, rejectionReasons } = await import("@/cms/newsroom");
  const [towns, reasons, pending, resolved] = await Promise.all([
    townsWithResponsibles(payload), rejectionReasons(payload),
    payload.find({ collection: "notifications", overrideAccess: true, pagination: false, depth: 1, sort: "createdAt", where: pendingInbox }),
    compact ? null : payload.find({ collection: "notifications", overrideAccess: true, limit: 20, depth: 1, sort: "-resolvedAt", where: { and: [{ kind: { in: [...INBOX_KINDS] } }, { reviewed: { equals: true } }] } }),
  ]);
  const mine = new Set(inboxTownsFor(towns, Number(user.id)).map(t => t.id));
  const items = pending.docs as unknown as Notice[];
  const own = items.filter(n => mine.has(idOf(n.town) ?? -1)), others = items.filter(n => !mine.has(idOf(n.town) ?? -1));
  const townName = (n: Notice) => nameOf(n.town) || "Sin concejo";
  const responsibleName = (n: Notice) => nameOf(towns.find(t => t.id === idOf(n.town))?.responsible) || "sin responsable";
  const item = (n: Notice) => <li key={n.id} id={`pendiente-${n.id}`} style={{ ...row, ...(highlight === n.id ? { background: "var(--theme-elevation-50)", outline: "2px solid var(--theme-success-500)", paddingInline: 8 } : {}) }} data-inbox-item={n.id} data-inbox-kind={n.kind}>
    <span style={{ display: "grid", gap: 2, minWidth: 0, flex: "1 1 320px" }}>
      <span style={small}>{KIND_LABELS[n.kind]} · {when(n.createdAt)} · <span data-inbox-town>{townName(n)}</span> · responsable: <span data-inbox-responsible>{responsibleName(n)}</span></span>
      <a href={target(n)} style={{ fontWeight: 700 }}>{n.title}</a>
      {context(n) ? <span style={small}>{context(n)}</span> : null}
    </span>
    <CmsInboxActions id={n.id} approveLabel={APPROVE_LABELS[n.kind as keyof typeof APPROVE_LABELS] ?? "Aprobar"} reasons={reasons} />
  </li>;
  const list = (rows: Notice[], empty: string) => rows.length ? <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px" }}>{rows.map(item)}</ul> : <p style={{ ...small, margin: "0 0 20px" }}>{empty}</p>;
  const shownOthers = compact ? others.slice(0, Math.max(0, 5 - own.length)) : others;
  return <section data-inbox={compact ? "compact" : "full"} style={{ marginTop: compact ? 28 : 0 }}>
    {compact ? <h2 style={{ margin: "0 0 4px" }}>Pendiente de revisar</h2> : null}
    <p style={{ ...small, margin: "0 0 12px" }}>{items.length ? `${own.length} de tus concejos · ${items.length} en total. La bandeja es compartida: cualquiera puede resolverlo.` : "No hay nada pendiente."}{" "}
      {compact ? <Link href="/cms/bandeja" style={link} data-inbox-open>Abrir la bandeja</Link> : null}</p>
    <h3 style={{ margin: "0 0 4px" }}>De tus concejos</h3>
    {list(compact ? own.slice(0, 5) : own, "Nada pendiente en tus concejos.")}
    {shownOthers.length || !compact ? <><h3 style={{ margin: "0 0 4px" }}>Del resto de concejos</h3>{list(shownOthers, "Nada pendiente en el resto.")}</> : null}
    {resolved ? <><h3 style={{ margin: "0 0 4px" }}>Resuelto recientemente</h3>
      {resolved.docs.length ? <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px" }}>{(resolved.docs as unknown as Notice[]).map(n => <li key={n.id} style={row} data-inbox-resolved={n.id}>
        <a href={target(n)}>{n.title}</a>
        <span style={small}><strong data-inbox-decision>{DECISIONS[n.decision ?? ""] ?? "Resuelto"}</strong>{n.rejectReason ? `: ${n.rejectReason}${n.rejectNote ? ` (${n.rejectNote})` : ""}` : ""} · <span data-inbox-resolved-by>{nameOf(n.resolvedBy) || "—"}</span> · {when(n.resolvedAt)} · {townName(n)}</span>
      </li>)}</ul> : <p style={small}>Todavía nada.</p>}</> : null}
  </section>;
}

/**
 * Lo publicado por los ayuntamientos (no requiere intervención; llega en el resumen diario). Por si hay que retirar algo.
 * Por defecto, los concejos de los que te ocupas; «Todos» o cualquier concejo.
 */
async function MunicipalPublications({ payload, user, filter }: { payload: Payload; user: CmsUser; filter?: string | null }) {
  const { townsWithResponsibles, townsCoveredBy } = await import("@/cms/newsroom");
  const { municipalTypeLabels } = await import("@/cms/activity");
  const towns = await townsWithResponsibles(payload);
  const mine = townsCoveredBy(towns, Number(user.id));
  const chosen = filter === "todos" ? "todos" : towns.some(t => t.slug === filter) ? filter! : mine.length ? "mios" : "todos";
  const selected = chosen === "todos" ? towns : chosen === "mios" ? mine : towns.filter(t => t.slug === chosen);
  const spaces = (await payload.find({ collection: "municipal-spaces", pagination: false, depth: 0, overrideAccess: true, where: { town: { in: selected.map(t => t.id).concat(0) } } })).docs as { id: number; name: string; legacyID?: string | null }[];
  const contents = await payload.find({ collection: "municipal-content", where: { space: { in: spaces.map(s => s.id).concat(0) } }, sort: "-updatedAt", limit: 30, depth: 0, overrideAccess: true });
  const option = (value: string, label: string) => <option key={value} value={value}>{label}</option>;
  return <section data-municipal-publications={chosen} style={{ marginTop: 12 }}>
    <h2 style={{ margin: "0 0 4px" }}>Publicado por los ayuntamientos</h2>
    <p style={{ ...small, margin: "0 0 10px" }}>No requiere intervención: te llega en el resumen diario de las 8:00. Aquí puedes verlo y, si hace falta, retirarlo con un motivo.</p>
    <form method="get" style={{ display: "flex", gap: 10, alignItems: "end", margin: "0 0 12px", flexWrap: "wrap" }}>
      <label style={{ display: "grid", gap: 4 }}>Concejos<select name="concejo" defaultValue={chosen} style={{ minHeight: 40 }} data-publications-filter>
        {mine.length ? option("mios", "Mis concejos") : null}{option("todos", "Todos los concejos")}{towns.map(t => option(t.slug, t.name))}</select></label>
      <button type="submit" className="btn btn--style-secondary btn--size-medium" style={{ margin: 0 }}>Ver</button>
    </form>
    {contents.docs.length ? <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>{contents.docs.map(raw => {
      const c = raw as unknown as { id: number; title: string; type: string; space: number; _status?: string; updatedAt?: string; withdrawal?: { withdrawn?: boolean | null; reason?: string | null } };
      const space = spaces.find(s => s.id === c.space);
      const withdrawn = Boolean(c.withdrawal?.withdrawn);
      return <li key={c.id} style={row} data-publication-item={c.id}>
        <span style={small}>{municipalTypeLabels[c.type] ?? c.type}</span><strong>{c.title}</strong>
        <span style={small}>{space?.name} · <span data-publication-status>{withdrawn ? `Retirado: ${c.withdrawal?.reason ?? ""}` : c._status === "published" ? "Publicado" : "Borrador"}</span> · {when(c.updatedAt)}</span>
        <span style={{ display: "flex", gap: 12, marginLeft: "auto", flexWrap: "wrap", alignItems: "center" }}>
          {c._status === "published" && !withdrawn ? <a href={`/${space?.legacyID ?? ""}${c.type !== "news" ? `?seccion=${c.type}` : ""}`} target="_blank" rel="noopener" style={link} data-publication-web>Ver en la web</a> : null}
          <a href={`/cms/collections/municipal-content/${c.id}`} style={link}>Abrir</a>
          {!withdrawn ? <CmsWithdraw id={c.id} title={c.title} /> : null}
        </span>
      </li>;
    })}</ul> : <p style={small}>No hay publicaciones de estos concejos.</p>}
  </section>;
}

/** /cms/bandeja (redacción y administración). */
export async function InboxView(props: AdminViewServerProps) {
  const { initPageResult, searchParams, params, i18n, payload, user, locale, permissions } = props;
  const me = initPageResult.req.user as CmsUser | null;
  const editorial = me?.collection === "users" && ["admin", "editor"].includes(String(me.role));
  const highlight = typeof searchParams?.pendiente === "string" ? Number(searchParams.pendiente) : null;
  return <DefaultTemplate i18n={i18n} locale={locale} params={params} payload={payload} permissions={permissions} searchParams={searchParams} user={user} visibleEntities={initPageResult.visibleEntities}>
    <div className="gutter--left gutter--right" style={{ paddingTop: 24, paddingBottom: 48, maxWidth: 1000 }} data-cms-inbox>
      <h1 style={{ marginBottom: 8 }}>Pendiente de revisar</h1>
      {editorial ? <>
        <Inbox payload={payload} user={me!} highlight={highlight} />
        <MunicipalPublications payload={payload} user={me!} filter={typeof searchParams?.concejo === "string" ? searchParams.concejo : null} />
      </> : <p>Solo para la redacción.</p>}
    </div>
  </DefaultTemplate>;
}
