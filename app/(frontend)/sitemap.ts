import { siteUrl, isIndexable } from "@/lib/site-config";
import type { MetadataRoute } from "next";
import { getArticles, getAuthors } from "@/lib/cms";
import { territories, topics } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

const baseUrl = siteUrl;
// Per request: only published content, and nothing unless SITE_INDEXABLE=true.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexable()) return [];
  const articles = await getArticles();
  const authors = await getAuthors();
  const spaces = await (await import('@/lib/payload-content')).payloadSpaces();
  const staticRoutes = ["", "/opinion", "/agenda", "/publicidad", "/contacto", "/principios"].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date()
  }));

  const articleRoutes = articles.map((article) => ({
    url: `${baseUrl}/noticia/${article.slug}`,
    lastModified: Number.isNaN(Date.parse(article.date)) ? undefined : new Date(article.date)
  }));

  const comarcaRoutes = Object.keys(territories).map((comarca) => ({
    url: `${baseUrl}/comarca/${slugify(comarca)}`,
    lastModified: new Date()
  }));

  const concejoRoutes = Object.values(territories).flat().map((concejo) => ({
    url: `${baseUrl}/concejo/${slugify(concejo)}`,
    lastModified: new Date()
  }));

  const topicRoutes = topics.map((topic) => ({
    url: `${baseUrl}/tema/${slugify(topic)}`,
    lastModified: new Date()
  }));

  const authorRoutes = authors.map((author) => ({
    url: `${baseUrl}/autor/${author.slug}`,
    lastModified: new Date()
  }));

  const municipalRoutes = spaces.map(space => ({ url: `${baseUrl}/${encodeURIComponent(space.id)}` }));
  // «Útil»: lo general siempre; las páginas «Ver todos» solo de los concejos con el espacio activo y el servicio visible.
  const { activeTowns, hiddenByConcejo, UTIL_LIST_TYPES } = await import("@/lib/util");
  const [active, hidden] = await Promise.all([activeTowns(), hiddenByConcejo()]);
  const utilRoutes = [
    ...["/util", "/util/patrimonio", "/util/rutas", "/util/subvenciones", "/util/empleo"].map(route => ({ url: `${baseUrl}${route}` })),
    ...[...active].flatMap(town => Object.keys(UTIL_LIST_TYPES).filter(type => !(hidden[town] ?? []).includes(type)).map(type => ({ url: `${baseUrl}/${town}/util/${type}` }))),
  ];
  return [...staticRoutes, ...utilRoutes, ...articleRoutes, ...comarcaRoutes, ...concejoRoutes, ...topicRoutes, ...authorRoutes, ...municipalRoutes];
}
