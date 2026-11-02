import { decodeSession } from "@/lib/session-codec";
import { NextRequest, NextResponse } from "next/server";

// Same rule as robotsHeader() in lib/site-config.ts (kept dependency-free here; tests/launch.test.mjs checks both agree):
// noindex unless SITE_INDEXABLE=true with real content (CONTENT_SOURCE=payload); private areas always noindex.
function robotsHeader(pathname: string) {
  const isPrivate = /^\/(admin|cms|api|buscar|niebla)(\/|$)/.test(pathname) || /^\/[^/]+\/panel(\/|$)/.test(pathname);
  const indexable = process.env.SITE_INDEXABLE === "true" && process.env.CONTENT_SOURCE === "payload"; // demo content: never
  return !indexable || isPrivate ? "noindex, nofollow" : null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // File-based persistence is for local development only; never accept ephemeral writes in hosted demos.
  const cmsDataApi = /^\/api\/(articles|authors|uploads)(\/|$)/.test(pathname);
  if (cmsDataApi) {
    const secret = process.env.CMS_AUTH_SECRET || (process.env.NODE_ENV !== "production" ? "planta14-local-development-only-secret" : "");
    if (!decodeSession(request.cookies.get("planta14_session")?.value || "", secret)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (cmsDataApi && !["GET", "HEAD", "OPTIONS"].includes(request.method) && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "La edición alojada es de solo lectura. La publicación requiere conectar almacenamiento persistente." }, { status: 503 });
  }
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !request.cookies.get("planta14_session")?.value) {
    const loginUrl = request.nextUrl.clone(); loginUrl.pathname = "/admin/login"; loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  const response = NextResponse.next();
  // Without SITE_INDEXABLE=true every response is noindex; private areas are always noindex.
  const robots = robotsHeader(pathname);
  if (robots) response.headers.set("X-Robots-Tag", robots);
  return response;
}
// Every route, static files included, so that "noindex" covers all responses of a non-indexable site.
export const config = { matcher: ["/:path*"] };
