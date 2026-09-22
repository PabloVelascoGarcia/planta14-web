import { decodeSession } from "@/lib/session-codec";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const privateDemo = process.env.DEMO_CONTENT === "lavoz" && process.env.NODE_ENV === "production";
  if (privateDemo) {
    const password = process.env.DEMO_ACCESS_PASSWORD;
    if (!password || password.length < 16) {
      return new NextResponse("Demo privada pendiente de configurar. Establece DEMO_ACCESS_PASSWORD en el alojamiento.", { status: 503, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
    }
    const auth = request.headers.get("authorization") || "";
    let supplied = "";
    if (auth.startsWith("Basic ")) {
      try { const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8"); supplied = decoded.slice(decoded.indexOf(":") + 1); } catch { /* invalid credentials */ }
    }
    const matches = timingSafeEqual(createHash("sha256").update(password).digest(), createHash("sha256").update(supplied).digest());
    if (!matches) return new NextResponse("Acceso privado a la presentación de Planta 14", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Planta 14 - Presentacion", charset="UTF-8"', "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  }
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
  if (process.env.SITE_INDEXABLE !== "true" || privateDemo) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  if (privateDemo) response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
