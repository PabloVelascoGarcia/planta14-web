import * as payloadRest from "@/app/(payload)/api/cms/[...slug]/route";
import { panelUser, sameOrigin } from "@/lib/panel-session";

// Puente del panel municipal a la API de Payload (/api/cms/…). No es un acceso general: solo las llamadas que hace el
// panel (lista cerrada), solo para cambiar datos y solo desde la propia web (CSRF). Llega a Payload como la cuenta
// municipal de la sesión del panel (`Authorization: JWT …`), sin la cookie del CMS; Payload aplica después sus reglas
// de acceso (cada ayuntamiento, solo lo de su espacio y su concejo). Sin sesión del panel válida: 401.
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ slug: string[] }> };
type Method = "POST" | "PATCH" | "DELETE";

const ID = "[1-9][0-9]{0,9}";
/** Llamadas del panel: método, ruta y si necesita sesión (solo «¿Has olvidado tu contraseña?» no). */
const ROUTES: { method: Method; path: RegExp; anonymous?: true }[] = [
  { method: "POST", path: /^users\/forgot-password$/, anonymous: true },
  { method: "POST", path: /^media$/ },
  { method: "POST", path: /^municipal-content$/ },
  { method: "PATCH", path: new RegExp(`^municipal-content/${ID}$`) },
  { method: "POST", path: /^municipal-services$/ },
  { method: "PATCH", path: new RegExp(`^municipal-services/${ID}$`) },
  { method: "DELETE", path: new RegExp(`^municipal-services/${ID}$`) },
  { method: "POST", path: /^suggestions$/ },
  { method: "POST", path: /^util-visibility\/concejo$/ },
];
/** Parámetros de consulta que usa el panel (nada de depth, where, select…). */
const QUERY = new Set(["draft"]);

const json = (status: number, message: string) => new Response(JSON.stringify({ errors: [{ message }] }), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

function forward(method: Method) {
  return async (request: Request, context: Context) => {
    const { slug } = await context.params;
    const path = slug.join("/");
    const route = ROUTES.find(r => r.method === method && r.path.test(path));
    if (!route) return json(404, "No encontrado");
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some(key => !QUERY.has(key))) return json(400, "Parámetros no permitidos");
    if (!sameOrigin(request)) return json(403, "Petición no válida");
    const headers = new Headers();
    for (const name of ["content-type", "accept", "accept-language"]) { const value = request.headers.get(name); if (value) headers.set(name, value); }
    headers.set("DisableAutologin", "true");
    if (!route.anonymous) {
      const { contentClient } = await import("@/lib/payload-content");
      const session = await panelUser(await contentClient(), request.headers);
      if (!session) return json(401, "Tu sesión del panel ha caducado. Vuelve a entrar.");
      headers.set("authorization", `JWT ${session.token}`);
    }
    url.pathname = `/api/cms/${path}`;
    const inner = new Request(url, { method, headers, body: await request.arrayBuffer() });
    const handler = payloadRest[method] as unknown as (request: Request, context: Context) => Promise<Response>;
    return handler(inner, { params: Promise.resolve({ slug }) });
  };
}
export const POST = forward("POST");
export const PATCH = forward("PATCH");
export const DELETE = forward("DELETE");
