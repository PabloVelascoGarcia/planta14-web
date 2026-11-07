import { cmsEnabled } from "@/cms/environment";
import { panelAuthHeaders, panelCookie, readPanelToken, renewPanelSession, sameOrigin } from "@/lib/panel-session";

// Renovación con el uso: el panel la llama al abrirse. Si el token tiene más de un día, alarga la sesión a 14 días.
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!cmsEnabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const token = readPanelToken(request.headers);
  const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (!token) return new Response(JSON.stringify({ ok: false }), { status: 401, headers });
  const { contentClient } = await import("@/lib/payload-content");
  const payload = await contentClient();
  const { user } = await payload.auth({ headers: panelAuthHeaders(request.headers) });
  if (!user || user.collection !== "users") return new Response(JSON.stringify({ ok: false }), { status: 401, headers });
  const renewed = await renewPanelSession(payload, user.id as number, token);
  if (renewed) headers["Set-Cookie"] = panelCookie(renewed.token);
  return new Response(JSON.stringify({ ok: true, renewed: Boolean(renewed) }), { headers });
}
