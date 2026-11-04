import { classifySource, isBot, isTrackable, TOWNS } from "@/lib/stats";
import { siteUrl } from "@/lib/site-config";

// Contador de visitas propio (sin cookies ni datos personales). Recibe la baliza de components/stats-beacon.tsx y
// suma 1 al contador agregado del día; no guarda IP, navegador ni identificadores. Responde siempre 204 enseguida.
export const dynamic = "force-dynamic";
const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  try {
    if (process.env.CONTENT_SOURCE !== "payload" || process.env.CMS_ENABLED !== "true") return done();
    // Robots y personas con sesión en el CMS (redacción, administración y cuentas municipales) no cuentan.
    if (isBot(request.headers.get("user-agent")) || /(^|;\s*)payload-token=/.test(request.headers.get("cookie") || "")) return done();
    const raw = await request.text();
    if (raw.length > 2000) return done();
    const data = JSON.parse(raw || "{}") as { p?: string; r?: string; u?: string; t?: string; s?: string };
    const path = String(data.p || "").split(/[?#]/)[0];
    if (!isTrackable(path)) return done();
    const town = (TOWNS as readonly string[]).includes(String(data.t)) ? String(data.t) : "";
    const section = /^[a-z0-9-]{1,60}$/.test(String(data.s || "")) ? String(data.s) : "";
    const { recordView } = await import("@/lib/stats");
    await recordView({ path, town, section, source: classifySource(String(data.r || "").slice(0, 500), String(data.u || "").slice(0, 40), new URL(siteUrl).hostname) });
  } catch { /* una visita sin contar nunca rompe nada */ }
  return done();
}
