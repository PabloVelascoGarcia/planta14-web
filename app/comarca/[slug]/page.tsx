import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleListPage } from "@/components/article-list-page";
import { getArticlesByComarca } from "@/lib/cms";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return Object.keys(territories).map((comarca) => ({ slug: slugify(comarca) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const name = Object.keys(territories).find((comarca) => slugify(comarca) === slug);
  return { title: name ? `${name}` : "Comarca" };
}

export default async function ComarcaPage({ params }: PageProps) {
  const { slug } = await params;
  const name = Object.keys(territories).find((comarca) => slugify(comarca) === slug);

  if (!name) {
    notFound();
  }

  return (
    <ArticleListPage
      title={name}
      description={`Actualidad local de la comarca del ${name}, ordenada desde sus concejos y pueblos.`}
      articles={await getArticlesByComarca(slug)}
    />
  );
}
