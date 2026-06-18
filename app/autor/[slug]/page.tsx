import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleListPage } from "@/components/article-list-page";
import { getArticles, getArticlesByAuthor, getAuthors } from "@/lib/cms";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const articleAuthors = (await getArticles()).map((article) => slugify(article.author));
  const cmsAuthors = (await getAuthors()).map((author) => author.slug);
  return Array.from(new Set([...cmsAuthors, ...articleAuthors])).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const author = (await getAuthors()).find((item) => item.slug === slug);
  const articles = await getArticlesByAuthor(slug);
  return { title: author?.name ?? articles[0]?.author ?? "Autor" };
}

export default async function AuthorPage({ params }: PageProps) {
  const { slug } = await params;
  const author = (await getAuthors()).find((item) => item.slug === slug);
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
