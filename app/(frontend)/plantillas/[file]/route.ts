import { templatePng } from "@/lib/social-image";

// Plantillas gráficas de Planta 14 para noticias sin foto: /plantillas/[sección].png (1600×1000, generadas en el
// servidor y cacheadas).
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const slug = /^([a-z0-9-]+)\.png$/.exec(file)?.[1];
  const png = slug ? await templatePng(slug) : null;
  if (!png) return new Response("No existe", { status: 404 });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
}
