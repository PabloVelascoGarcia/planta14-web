import type { Metadata } from "next";
import { ArticleListPage } from "@/components/article-list-page";
import { getGalleryArticles } from "@/lib/cms";
import { MULTIMEDIA_MIN, paginate } from "@/lib/taxonomy";

// Noticias con al menos una galería. La página existe siempre, pero solo se enlaza en el menú y se indexa cuando hay
// al menos 6 (lib/taxonomy.ts).
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { pagina } = await searchParams;
  const articles = await getGalleryArticles();
  const page = paginate(articles, pagina).current;
  return { title: "Multimedia: galerías de fotos", description: "Las galerías de fotos de Planta 14.",
    alternates: { canonical: page > 1 ? `/multimedia?pagina=${page}` : "/multimedia" },
    ...(articles.length < MULTIMEDIA_MIN ? { robots: { index: false, follow: true } } : {}) };
}

export default async function MultimediaPage({ searchParams }: PageProps) {
  const { pagina } = await searchParams;
  const page = paginate(await getGalleryArticles(), pagina);
  return <div data-multimedia-page><ArticleListPage kicker="Multimedia" title="Galerías" description="Noticias con galería de fotos, de la más reciente a la más antigua."
    articles={page.items} pagination={{ current: page.current, pages: page.pages, basePath: "/multimedia" }} empty="Todavía no hay galerías publicadas." /></div>;
}
