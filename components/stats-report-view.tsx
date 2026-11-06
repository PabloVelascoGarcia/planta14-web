import type { StatsReport } from "@/lib/stats";

const sourceLabels: Record<string, string> = { buscadores: "Buscadores", redes: "Redes sociales", whatsapp: "WhatsApp", directo: "Directo", otros: "Otras webs", interna: "Desde Planta 14" };
const towns: Record<string, string> = { mieres: "Mieres", lena: "Lena", aller: "Aller", morcin: "Morcín", riosa: "Riosa", "ribera-de-arriba": "Ribera de Arriba" };
const n = (value: number) => value.toLocaleString("es-ES");
const bar = (value: number, max: number) => ({ display: "inline-block", height: 10, width: `${Math.max(2, Math.round((value / Math.max(1, max)) * 100))}%`, background: "#a4522d", borderRadius: 2 } as const);
const table = { width: "100%", borderCollapse: "collapse", fontSize: 14 } as const;
const cell = { padding: "6px 8px", borderBottom: "1px solid #e4d9c9", textAlign: "left", verticalAlign: "middle" } as const;

/**
 * Visitas por día en una sola fila de barras (panel municipal): cada barra, un día del mes; el número exacto, al
 * pasar por encima o en la lista accesible.
 */
function DayBars({ days, max }: { days: StatsReport["byDay"]; max: number }) {
  const label = (d: { day: string; views: number }) => `${d.day.slice(8, 10)}/${d.day.slice(5, 7)}: ${n(d.views)}`;
  return <section data-stats-days><h3>Visitas por día</h3>
    <div aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80, borderBottom: "1px solid #c9bba6", paddingTop: 4 }}>
      {days.map(d => <span key={d.day} title={label(d)} data-stats-day={d.day} style={{ flex: "1 1 0", minWidth: 3, height: `${Math.max(2, Math.round((d.views / max) * 100))}%`, background: d.views ? "#a4522d" : "#e4d9c9", borderRadius: "2px 2px 0 0" }} />)}
    </div>
    <div aria-hidden="true" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.75, marginTop: 4 }}><span>{days[0] ? label(days[0]).slice(0, 5) : ""}</span><span>Máximo: {n(max)} en un día</span><span>{days.at(-1) ? label(days.at(-1)!).slice(0, 5) : ""}</span></div>
    <ul className="sr-only">{days.map(d => <li key={d.day}>{label(d)}</li>)}</ul>
  </section>;
}

/** Informe de visitas (CMS y panel municipal). Solo números agregados: sin cookies ni datos personales. */
export function StatsReportView({ report, exportBase, compact = false }: { report: StatsReport; exportBase: string; compact?: boolean }) {
  const maxDay = Math.max(1, ...report.byDay.map(d => d.views));
  const external = report.bySource.filter(s => s.source !== "interna");
  const externalTotal = external.reduce((a, s) => a + s.views, 0);
  return <div data-stats-report style={{ display: "grid", gap: 28 }}>
    <p style={{ fontSize: 16, margin: 0 }}><strong style={{ fontSize: 28 }} data-stats-total>{n(report.total)}</strong> páginas vistas del {report.from.split("-").reverse().join("/")} al {report.to.split("-").reverse().join("/")}{report.town ? ` · ${towns[report.town] ?? report.town}` : " · todos los concejos"}</p>
    <p style={{ margin: 0, display: "flex", gap: 16, flexWrap: "wrap" }}>
      <a href={`${exportBase}&formato=csv`} download data-stats-export="csv" style={{ fontWeight: 700, minHeight: 44, display: "inline-flex", alignItems: "center" }}>Descargar CSV</a>
      <a href={`${exportBase}&formato=pdf`} download data-stats-export="pdf" style={{ fontWeight: 700, minHeight: 44, display: "inline-flex", alignItems: "center" }}>Descargar PDF</a>
    </p>
    {compact ? <DayBars days={report.byDay} max={maxDay} /> : <section><h3>Visitas por día</h3><table style={table}><tbody>{report.byDay.map(d => <tr key={d.day}><td style={{ ...cell, width: 110 }}>{d.day.split("-").reverse().join("/")}</td><td style={{ ...cell, width: 80, textAlign: "right" }}>{n(d.views)}</td><td style={cell}><span style={bar(d.views, maxDay)} /></td></tr>)}</tbody></table></section>}
    <section><h3>Páginas más vistas</h3>{report.topPages.length ? <table style={table}><tbody>{report.topPages.map(p => <tr key={p.path}><td style={cell}><a href={p.path} target="_blank" rel="noopener noreferrer">{p.path}</a></td><td style={{ ...cell, width: 90, textAlign: "right" }}>{n(p.views)}</td></tr>)}</tbody></table> : <p>Sin visitas en este periodo.</p>}</section>
    <section><h3>Procedencia</h3><p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.75 }}>Visitas que llegan de fuera de Planta 14. «Directo»: dirección escrita, favoritos o aplicaciones que no dicen de dónde vienen.</p>
      <table style={table}><tbody>{external.map(s => <tr key={s.source} data-stats-source={s.source}><td style={{ ...cell, width: 160 }}>{sourceLabels[s.source]}</td><td style={{ ...cell, width: 90, textAlign: "right" }}>{n(s.views)}</td><td style={{ ...cell, width: 60, textAlign: "right" }}>{externalTotal ? Math.round((s.views / externalTotal) * 100) : 0} %</td><td style={cell}><span style={bar(s.views, externalTotal)} /></td></tr>)}</tbody></table></section>
    {!report.town && report.byTown.length ? <section><h3>Por concejo</h3><table style={table}><tbody>{report.byTown.map(t => <tr key={t.town}><td style={cell}>{towns[t.town] ?? t.town}</td><td style={{ ...cell, width: 90, textAlign: "right" }}>{n(t.views)}</td></tr>)}</tbody></table></section> : null}
    {report.bySection.length ? <section><h3>Por sección</h3><table style={table}><tbody>{report.bySection.map(s => <tr key={s.section}><td style={cell}>{s.section}</td><td style={{ ...cell, width: 90, textAlign: "right" }}>{n(s.views)}</td></tr>)}</tbody></table></section> : null}
    <p style={{ fontSize: 13, opacity: 0.75, margin: 0 }}>Estadísticas propias de Planta 14, sin cookies ni datos personales: solo se cuentan páginas vistas. No incluyen robots ni personas con sesión en el CMS.</p>
  </div>;
}
