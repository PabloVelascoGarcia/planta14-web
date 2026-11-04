import { unsubscribeByToken } from "@/app/(frontend)/boletin/actions";

// Baja con un clic desde el programa de correo (cabecera List-Unsubscribe-Post, RFC 8058). Un GET (enlace abierto
// en el navegador) lleva a la página con el botón, para que los antivirus del correo no den de baja a nadie.
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t") || "";
  const result = await unsubscribeByToken(token);
  return Response.json({ ok: result.ok }, { status: result.ok ? 200 : 404 });
}
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") || "";
  return Response.redirect(new URL(`/boletin/baja?t=${encodeURIComponent(token)}`, request.url), 303);
}
