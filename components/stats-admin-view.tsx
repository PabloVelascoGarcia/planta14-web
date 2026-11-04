import type { AdminViewServerProps } from "payload";
import { DefaultTemplate } from "@payloadcms/next/templates";
import { StatsReportView } from "./stats-report-view";

const towns = [["", "Todos los concejos"], ["mieres", "Mieres"], ["lena", "Lena"], ["aller", "Aller"], ["morcin", "Morcín"], ["riosa", "Riosa"], ["ribera-de-arriba", "Ribera de Arriba"]];

/** /cms/estadisticas: visitas de todos los concejos (solo administración). */
export async function StatsAdminView(props: AdminViewServerProps) {
  const { initPageResult, searchParams, params, i18n, payload, user, locale, permissions } = props;
  const isAdmin = initPageResult.req.user?.collection === "users" && initPageResult.req.user.role === "admin";
  const { monthRange, statsReport, TOWNS } = await import("@/lib/stats");
  const month = typeof searchParams?.mes === "string" ? searchParams.mes : null;
  const town = typeof searchParams?.concejo === "string" && (TOWNS as readonly string[]).includes(searchParams.concejo) ? searchParams.concejo : null;
  const range = monthRange(month);
  const report = isAdmin ? await statsReport(range.from, range.to, town) : null;
  return <DefaultTemplate i18n={i18n} locale={locale} params={params} payload={payload} permissions={permissions} searchParams={searchParams} user={user} visibleEntities={initPageResult.visibleEntities}>
    <div className="gutter--left gutter--right" style={{ paddingTop: 24, paddingBottom: 48, maxWidth: 1000 }} data-cms-stats>
      <h1 style={{ marginBottom: 8 }}>Estadísticas</h1>
      {!report ? <p>Solo la administración ve las estadísticas de todos los concejos.</p> : <>
        <form method="get" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", margin: "8px 0 24px" }}>
          <label style={{ display: "grid", gap: 4 }}>Mes<input type="month" name="mes" defaultValue={range.month} style={{ minHeight: 40 }} /></label>
          <label style={{ display: "grid", gap: 4 }}>Concejo<select name="concejo" defaultValue={town ?? ""} style={{ minHeight: 40 }}>{towns.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button type="submit" className="btn btn--style-primary btn--size-medium" style={{ margin: 0 }}>Ver</button>
        </form>
        <StatsReportView report={report} exportBase={`/api/estadisticas?mes=${range.month}${town ? `&concejo=${town}` : ""}`} />
      </>}
    </div>
  </DefaultTemplate>;
}
