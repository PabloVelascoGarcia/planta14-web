import { decodeSession } from "@/lib/session-codec";
import { NextRequest, NextResponse } from "next/server";

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
  if (process.env.SITE_INDEXABLE !== "true" || process.env.DEMO_CONTENT !== "example") response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
