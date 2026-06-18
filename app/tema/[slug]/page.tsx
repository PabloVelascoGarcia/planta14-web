import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleListPage } from "@/components/article-list-page";
import { getArticlesByTopic } from "@/lib/cms";
import { slugify, sortedTopics } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return sortedTopics().map((topic) => ({ slug: slugify(topic) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const name = sortedTopics().find((topic) => slugify(topic) === slug);
  return { title: name ? `${name}` : "Tema" };
}

export default async function TopicPage({ params }: PageProps) {
  const { slug } = await params;
  const name = sortedTopics().find((topic) => slugify(topic) === slug);

  if (!name) {
    notFound();
  }

  return (
    <ArticleListPage
      title={name}
      description={`Noticias de ${name.toLowerCase()} en Caudal y Nalón, sin perder la referencia territorial.`}
      articles={await getArticlesByTopic(slug)}
    />
  );
}
