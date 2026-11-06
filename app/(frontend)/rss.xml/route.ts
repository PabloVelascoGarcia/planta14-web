import { getArticles } from "@/lib/cms";
import { siteName, siteUrl } from "@/lib/site-config";

// RSS de noticias: las 30 últimas noticias y opiniones publicadas (sin contenido municipal, que no son artículos).
export const dynamic = "force-dynamic";
const escape = (value: string) => value.replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
const when = (a: { publishedAt?: string; date: string }) => new Date(a.publishedAt || `${a.date}T12:00:00Z`);

export async function GET() {
  const articles = (await getArticles()).filter(a => { const t = when(a).getTime(); return Number.isFinite(t) && t <= Date.now(); })
    .sort((a, b) => when(b).getTime() - when(a).getTime()).slice(0, 30);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escape(siteName)}</title>
    <link>${escape(siteUrl)}</link>
    <atom:link href="${escape(`${siteUrl}/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>Noticias y opinión de las cuencas mineras asturianas: Mieres, Lena, Aller, Morcín, Riosa y Ribera de Arriba.</description>
    <language>es-ES</language>
${articles.map(a => `    <item>
      <title>${escape(a.title)}</title>
      <link>${escape(`${siteUrl}/noticia/${a.slug}`)}</link>
      <guid isPermaLink="true">${escape(`${siteUrl}/noticia/${a.slug}`)}</guid>
      <pubDate>${when(a).toUTCString()}</pubDate>
      <dc:creator>${escape(a.author)}</dc:creator>
      <category>${escape(a.opinion || a.topic === "Opinión" ? "Opinión" : a.topic)}</category>
      <description>${escape(a.excerpt)}</description>
    </item>`).join("\n")}
  </channel>
</rss>
`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "no-store" } });
}
