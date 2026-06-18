import type { MetadataRoute } from "next";
import { getArticles, getAuthors } from "@/lib/cms";
import { territories, topics } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

const baseUrl = "https://planta14.local";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getArticles();
  const authors = await getAuthors();
  const staticRoutes = ["", "/opinion", "/agenda", "/publicidad", "/contacto"].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date()
  }));

  const articleRoutes = articles.map((article) => ({
    url: `${baseUrl}/noticia/${article.slug}`,
    lastModified: new Date(article.date)
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

  return [...staticRoutes, ...articleRoutes, ...comarcaRoutes, ...concejoRoutes, ...topicRoutes, ...authorRoutes];
}
