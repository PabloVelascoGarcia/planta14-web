import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticle, getArticles } from "@/lib/cms";
import { ArticleView } from "@/components/article-view";
import { Newsletter } from "@/components/newsletter";
import { relatedArticles } from "@/lib/front-page";
import { siteUrl } from "@/lib/site-config";
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

  const related = relatedArticles(article, await getArticles());

  return (
    <article className="container-p14 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd(article)) }} />
      <ArticleView article={article} related={related} shareUrl={`${siteUrl}/noticia/${article.slug}`} />
      <div className="mt-12 max-w-[760px]"><Newsletter source="noticia" /></div>
    </article>
  );
}
