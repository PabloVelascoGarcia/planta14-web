import * as payloadRest from "@/app/(payload)/api/cms/[...slug]/route";
import { panelAuthHeaders, readPanelToken, sameOrigin } from "@/lib/panel-session";

// Puente del panel municipal a la API de Payload (/api/cms/…): con la cookie del panel, la petición llega a Payload con
// `Authorization: JWT …` y sin la cookie del CMS (así no se mezclan las dos sesiones en el mismo navegador). Sin cookie
// del panel, pasa tal cual (sesiones abiertas antes de este cambio). Para guardar, solo desde la propia web.
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slug: string[] }> };

function forward(method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT") {
  return async (request: Request, context: Context) => {
    const { slug } = await context.params;
    const hasPanel = Boolean(readPanelToken(request.headers));
    if (hasPanel && method !== "GET" && !sameOrigin(request)) return new Response(JSON.stringify({ errors: [{ message: "Petición no válida" }] }), { status: 403, headers: { "Content-Type": "application/json" } });
    const url = new URL(request.url);
    url.pathname = `/api/cms/${slug.map(encodeURIComponent).join("/")}`;
    const headers = new Headers(request.headers);
    if (hasPanel) {
      headers.delete("cookie");
      headers.set("authorization", panelAuthHeaders(request.headers).get("authorization") ?? "");
    }
    const body = method === "GET" ? undefined : await request.arrayBuffer();
    const inner = new Request(url, { method, headers, body });
    const handler = payloadRest[method] as unknown as (request: Request, context: Context) => Promise<Response>;
    return handler(inner, { params: Promise.resolve({ slug }) });
  };
}
export const GET = forward("GET");
export const POST = forward("POST");
export const PATCH = forward("PATCH");
export const DELETE = forward("DELETE");
export const PUT = forward("PUT");
