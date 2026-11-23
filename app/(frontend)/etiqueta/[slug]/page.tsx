import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleListPage } from "@/components/article-list-page";
import { getArticlesByTag } from "@/lib/cms";
import { paginate, TAG_INDEX_MIN } from "@/lib/taxonomy";

// Página de una etiqueta (tema): sus noticias, paginadas. Se indexa (y va al sitemap) solo con al menos 2 noticias.
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { pagina } = await searchParams;
  const { name, articles } = await getArticlesByTag(slug);
  if (!name) return { title: "Etiqueta", robots: { index: false, follow: true } };
  const page = paginate(articles, pagina).current;
  return { title: `${name}: noticias`, description: `Noticias de Planta 14 sobre ${name}.`,
    alternates: { canonical: page > 1 ? `/etiqueta/${slug}?pagina=${page}` : `/etiqueta/${slug}` },
    ...(articles.length < TAG_INDEX_MIN ? { robots: { index: false, follow: true } } : {}) };
}

export default async function TagPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { pagina } = await searchParams;
  const { name, articles } = await getArticlesByTag(slug);
  if (!name) notFound();
  const page = paginate(articles, pagina);
  return <div data-tag-page={slug}><ArticleListPage kicker="Tema" title={name} description={`${page.total} ${page.total === 1 ? "noticia" : "noticias"} sobre ${name}, de todas las secciones y concejos.`}
    articles={page.items} pagination={{ current: page.current, pages: page.pages, basePath: `/etiqueta/${slug}` }} /></div>;
}
