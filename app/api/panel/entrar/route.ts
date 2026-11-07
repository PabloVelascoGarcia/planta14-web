import { cmsEnabled } from "@/cms/environment";
import { clearPanelCookie, createPanelSession, panelCookie, revokeSession, sameOrigin, tokenSid, verifyPanelToken } from "@/lib/panel-session";

// Entrada al panel municipal: comprueba la contraseña con Payload (mismos intentos máximos y bloqueo) y abre la sesión
// del panel (cookie planta14_panel, 14 días). Solo para cuentas municipales: la redacción entra en /cms.
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200, cookie?: string) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) } });

export async function POST(request: Request) {
  if (!cmsEnabled()) return new Response(null, { status: 404 });
  if (!sameOrigin(request)) return json({ error: "Petición no válida" }, 403);
  const body = await request.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = String(body?.email ?? "").trim(), password = String(body?.password ?? "");
  if (!email || !password) return json({ error: "Escribe el correo y la contraseña." }, 400);
  const { contentClient } = await import("@/lib/payload-content");
  const payload = await contentClient();
  let result: { user: { id: number; role?: string | null }; token?: string };
  try {
    result = await payload.login({ collection: "users", data: { email, password } }) as never;
  } catch (error) {
    const message = error instanceof Error && /bloquead|locked|actualiz/i.test(error.message) ? error.message : "No se ha podido iniciar sesión. Revisa el correo y la contraseña.";
    return json({ error: message }, 401);
  }
  // payload.login abre de paso su propia sesión de 2 horas, que el panel no usa: se quita.
  await revokeSession(payload, result.user.id, result.token ? tokenSid(result.token) : undefined);
  if (result.user.role !== "municipal") return json({ error: "Esta cuenta es de Planta 14: entra en /cms." }, 403, clearPanelCookie());
  // Sesión nueva siempre (nunca se reutiliza una que llegue de fuera: sin fijación de sesión).
  const { token } = await createPanelSession(payload, result.user.id);
  if (!(await verifyPanelToken(payload, token))) {
    await revokeSession(payload, result.user.id, tokenSid(token));
    return json({ error: "El espacio municipal de esta cuenta no está activo. Escribe a Planta 14." }, 403, clearPanelCookie());
  }
  return json({ ok: true }, 200, panelCookie(token));
}
