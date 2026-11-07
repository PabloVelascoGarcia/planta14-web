import { cmsEnabled } from "@/cms/environment";
import { clearPanelCookie, panelAuthHeaders, readPanelToken, revokeSession, sameOrigin, tokenSid } from "@/lib/panel-session";

// «Cerrar sesión» del panel: quita la sesión del usuario y borra la cookie del panel. No toca la sesión del CMS.
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!cmsEnabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const token = readPanelToken(request.headers);
  if (token) {
    const { contentClient } = await import("@/lib/payload-content");
    const payload = await contentClient();
    const { user } = await payload.auth({ headers: panelAuthHeaders(request.headers) });
    if (user && user.collection === "users") await revokeSession(payload, user.id as number, tokenSid(token));
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": clearPanelCookie() } });
}
