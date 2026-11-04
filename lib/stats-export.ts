import { simplePdf, type PdfLine } from "./simple-pdf";
import { sourceLabels, type StatsReport } from "./stats";

const TOWN_NAMES: Record<string, string> = { mieres: "Mieres", lena: "Lena", aller: "Aller", morcin: "Morcín", riosa: "Riosa", "ribera-de-arriba": "Ribera de Arriba" };
export const townName = (slug: string | null) => (slug ? TOWN_NAMES[slug] ?? slug : "Todos los concejos");
const monthName = (month: string) => new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

/** CSV (punto y coma, UTF-8 con BOM: se abre con Excel o LibreOffice) del informe mensual. */
export function statsCSV(report: StatsReport, month: string) {
  const rows: unknown[][] = [["Planta 14 · visitas", townName(report.town), monthName(month)], [], ["Día", "Visitas"], ...report.byDay.map(d => [d.day, d.views]), ["Total", report.total], [],
    ["Página", "Visitas"], ...report.topPages.map(p => [p.path, p.views]), [], ["Procedencia", "Visitas"], ...report.bySource.map(s => [sourceLabels[s.source], s.views]),
    ...(report.town ? [] : [[], ["Concejo", "Visitas"], ...report.byTown.map(t => [townName(t.town), t.views])]), [], ["Sección", "Visitas"], ...report.bySection.map(s => [s.section, s.views]),
    [], ["Sin cookies ni datos personales: solo contadores de páginas vistas. No incluye robots ni personas con sesión en el CMS."]];
  return `﻿${rows.map(r => r.map(csvCell).join(";")).join("\r\n")}\r\n`;
}

/** PDF sencillo para enseñar a ayuntamientos y anunciantes. */
export function statsPDF(report: StatsReport, month: string) {
  const max = Math.max(1, ...report.byDay.map(d => d.views));
  const external = report.bySource.filter(s => s.source !== "interna"), externalTotal = external.reduce((a, s) => a + s.views, 0) || 1;
  const lines: PdfLine[] = [
    { text: "Planta 14", size: 22, bold: true },
    { text: `Visitas · ${townName(report.town)} · ${monthName(month)}`, size: 14, gap: 4 },
    { text: `Páginas vistas en el mes: ${report.total.toLocaleString("es-ES")}`, size: 12, bold: true, gap: 14 },
    { text: "Por día", size: 12, bold: true, gap: 14 },
    ...report.byDay.map(d => ({ text: `${d.day.split("-").reverse().join("/")}    ${d.views.toLocaleString("es-ES")}`, bar: d.views / max })),
    { text: "Páginas más vistas", size: 12, bold: true, gap: 14 },
    ...report.topPages.slice(0, 15).map(p => ({ text: `${p.views.toLocaleString("es-ES").padStart(6)}   ${p.path.slice(0, 70)}` })),
    { text: "Procedencia (visitas que llegan de fuera de Planta 14)", size: 12, bold: true, gap: 14 },
    ...external.map(s => ({ text: `${sourceLabels[s.source]}: ${s.views.toLocaleString("es-ES")} (${Math.round((s.views / externalTotal) * 100)} %)`, bar: s.views / externalTotal })),
    ...(report.town ? [] : [{ text: "Por concejo", size: 12, bold: true, gap: 14 } as PdfLine, ...report.byTown.map(t => ({ text: `${townName(t.town)}: ${t.views.toLocaleString("es-ES")}` }))]),
    { text: "Sin cookies ni datos personales: solo contadores de páginas vistas. No incluye robots ni personas con sesión en el CMS.", size: 8, gap: 18 },
  ];
  return simplePdf(`Planta 14 · Visitas ${townName(report.town)} ${month}`, lines);
}
