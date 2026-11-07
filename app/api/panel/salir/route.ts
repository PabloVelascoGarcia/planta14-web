import { cmsEnabled } from "@/cms/environment";
import { clearPanelCookie, panelUser, readPanelToken, revokeSession, sameOrigin, tokenSid } from "@/lib/panel-session";

// «Cerrar sesión» del panel: borra la sesión en el servidor (el token deja de valer aunque alguien lo haya copiado) y la
// cookie. No toca la sesión del CMS.
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!cmsEnabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const token = readPanelToken(request.headers);
  if (token) {
    const { contentClient } = await import("@/lib/payload-content");
    const payload = await contentClient();
    // También con el espacio desactivado: la sesión se cierra igual.
    const session = await panelUser(payload, request.headers, { requireActive: false });
    if (session) await revokeSession(payload, session.user.id as number, tokenSid(token));
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": clearPanelCookie() } });
}
