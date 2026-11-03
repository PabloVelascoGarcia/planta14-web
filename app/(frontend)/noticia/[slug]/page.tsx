import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticle, getArticles } from "@/lib/cms";
import { ArticleView } from "@/components/article-view";
import { articleJsonLd, articleMetadata, jsonLdScript } from "@/lib/seo";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return {};
  }

  return articleMetadata(article);
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  const related = (await getArticles())
    .filter((item) => item.slug !== article.slug && (item.comarca === article.comarca || item.topic === article.topic))
    .slice(0, 3);

  return (
    <article className="container-p14 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd(article)) }} />
      <ArticleView article={article} related={related} />
    </article>
  );
}
