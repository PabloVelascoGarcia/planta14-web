import { helpAccess, isManual } from "@/lib/help-access";

// «Descargar en PDF» de la Ayuda: el manual en A4 con portada e índice (lib/manual-pdf.ts), solo con su sesión. El
// apartado de administración, solo para la administración.
export const dynamic = "force-dynamic";
const cache = new Map<string, Buffer>();

export async function GET(request: Request) {
  const manual = new URL(request.url).searchParams.get("manual");
  if (!isManual(manual)) return new Response("No existe", { status: 404 });
  const access = await helpAccess(request.headers);
  if (!access.manuals.includes(manual)) return new Response("Inicia sesión", { status: 401 });
  const { getManual } = await import("@/lib/manuals");
  const doc = await getManual(manual, { admin: access.admin });
  const key = `${manual}:${access.admin}:${doc.generatedAt}`;
  let pdf = cache.get(key);
  if (!pdf) {
    const { manualPdf } = await import("@/lib/manual-pdf");
    const date = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date(doc.generatedAt));
    pdf = await manualPdf(manual, doc, `Versión del ${date}`);
    cache.set(key, pdf);
  }
  const name = manual === "redaccion" ? "planta14-manual-redaccion.pdf" : "planta14-manual-ayuntamiento.pdf";
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" } });
}
