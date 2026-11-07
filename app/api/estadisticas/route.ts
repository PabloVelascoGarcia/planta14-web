import { headers } from "next/headers";

// Exportación mensual de las estadísticas: ?mes=AAAA-MM&formato=csv|pdf[&concejo=slug].
// Administración: todos los concejos o uno. Cuenta municipal: solo el suyo (se ignora ?concejo).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { contentClient } = await import("@/lib/payload-content");
  const payload = await contentClient();
  // Las descargas del panel municipal llegan con su cookie (planta14_panel); las del CMS, con la de Payload.
  const { panelUser } = await import("@/lib/panel-session");
  const requestHeaders = await headers();
  const user = (await panelUser(payload, requestHeaders))?.user ?? (await payload.auth({ headers: requestHeaders })).user;
  if (!user || user.collection !== "users") return new Response("Inicia sesión", { status: 401 });
  const params = new URL(request.url).searchParams;
  const { monthRange, statsReport, TOWNS } = await import("@/lib/stats");
  let town: string | null = null;
  if (user.role === "admin") town = (TOWNS as readonly string[]).includes(params.get("concejo") || "") ? params.get("concejo") : null;
  else if (user.role === "municipal") {
    const spaceID = typeof user.municipalSpace === "object" ? user.municipalSpace?.id : user.municipalSpace;
    const space = spaceID ? await payload.findByID({ collection: "municipal-spaces", id: spaceID, depth: 1, overrideAccess: true }) : null;
    town = space && typeof space.town === "object" ? space.town.slug : null;
    if (!town) return new Response("Sin concejo", { status: 403 });
  } else return new Response("Solo administración y cuentas municipales", { status: 403 });
  const { month, from, to } = monthRange(params.get("mes"));
  const report = await statsReport(from, to, town);
  const { statsCSV, statsPDF } = await import("@/lib/stats-export");
  const name = `planta14-visitas-${town ?? "todos"}-${month}`;
  if (params.get("formato") === "pdf") return new Response(new Uint8Array(statsPDF(report, month)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"`, "Cache-Control": "no-store" } });
  return new Response(statsCSV(report, month), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "no-store" } });
}
