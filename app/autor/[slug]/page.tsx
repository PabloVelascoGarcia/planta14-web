import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleListPage } from "@/components/article-list-page";
import { getArticles, getArticlesByAuthor } from "@/lib/cms";
import { authors } from "@/lib/mock-data";
import { getAuthor, slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const articleAuthors = (await getArticles()).map((article) => slugify(article.author));
  const staticAuthors = authors.map((author) => author.slug);
  return Array.from(new Set([...staticAuthors, ...articleAuthors])).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthor(slug);
  const articles = await getArticlesByAuthor(slug);
  return { title: author?.name ?? articles[0]?.author ?? "Autor" };
}

export default async function AuthorPage({ params }: PageProps) {
  const { slug } = await params;
  const author = getAuthor(slug);
  const articles = await getArticlesByAuthor(slug);

  if (!author && articles.length === 0) {
    notFound();
  }

  return (
    <ArticleListPage
      title={author?.name ?? articles[0].author}
      description={author ? `${author.role}. ${author.bio}` : "Archivo de noticias firmadas por este autor."}
      articles={articles}
    />
  );
}
