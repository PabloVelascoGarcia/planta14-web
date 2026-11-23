import { getArticle } from "@/lib/cms";
import { socialImageJpeg } from "@/lib/social-image";
import { socialVersion } from "@/lib/social-path";

// Imagen para compartir la noticia en WhatsApp, Facebook, X y Telegram (Open Graph y Twitter card, 1200×630), con el
// diseño de Planta 14. La dirección lleva la versión (?v=…): esa versión se cachea un año; sin ella, cinco minutos.
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return new Response("No existe", { status: 404 });
  const jpeg = await socialImageJpeg(article);
  const current = new URL(request.url).searchParams.get("v") === socialVersion(article);
  return new Response(new Uint8Array(jpeg), { headers: { "Content-Type": "image/jpeg", "Content-Length": String(jpeg.length),
    "Cache-Control": current ? "public, max-age=31536000, immutable" : "public, max-age=300" } });
}
