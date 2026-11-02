import { getArticles } from "@/lib/cms";
import { isIndexable, siteName, siteUrl } from "@/lib/site-config";

// Google News sitemap: published articles of the last 2 days (maximum 1000). Empty unless SITE_INDEXABLE=true.
export const dynamic = "force-dynamic";
const escape = (value: string) => value.replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export async function GET() {
  const since = Date.now() - 2 * 24 * 3600 * 1000;
  const articles = isIndexable() ? (await getArticles()).filter(a => {
    const time = new Date(a.publishedAt || a.date).getTime();
    return Number.isFinite(time) && time >= since && time <= Date.now();
  }).slice(0, 1000) : [];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${articles.map(a => `  <url>
    <loc>${escape(`${siteUrl}/noticia/${a.slug}`)}</loc>
    <news:news>
      <news:publication><news:name>${escape(siteName)}</news:name><news:language>es</news:language></news:publication>
      <news:publication_date>${new Date(a.publishedAt || a.date).toISOString()}</news:publication_date>
      <news:title>${escape(a.title)}</news:title>
    </news:news>
  </url>`).join("\n")}
</urlset>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" } });
}
