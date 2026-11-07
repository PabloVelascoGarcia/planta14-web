import { cmsEnabled } from "@/cms/environment";
import { clearPanelCookie, panelCookie, panelUser, renewPanelSession, sameOrigin } from "@/lib/panel-session";

// Renovación con el uso: el panel la llama al abrirse. Si el token tiene más de un día, alarga la sesión a 14 días. Si la
// sesión ya no vale (cerrada, contraseña cambiada, cuenta o espacio desactivados), borra la cookie.
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!cmsEnabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  const { contentClient } = await import("@/lib/payload-content");
  const payload = await contentClient();
  const session = await panelUser(payload, request.headers);
  if (!session) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { ...headers, "Set-Cookie": clearPanelCookie() } });
  const renewed = await renewPanelSession(payload, session.user.id as number, session.token);
  if (renewed) headers["Set-Cookie"] = panelCookie(renewed.token);
  return new Response(JSON.stringify({ ok: true, renewed: Boolean(renewed) }), { headers });
}
