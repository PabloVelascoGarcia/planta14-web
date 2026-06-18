import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleListPage } from "@/components/article-list-page";
import { getArticlesByConcejo } from "@/lib/cms";
import { allConcejos, getComarcaFromConcejo, slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return allConcejos().map((concejo) => ({ slug: slugify(concejo) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const name = allConcejos().find((concejo) => slugify(concejo) === slug);
  return { title: name ? `${name}` : "Concejo" };
}

export default async function ConcejoPage({ params }: PageProps) {
  const { slug } = await params;
  const name = allConcejos().find((concejo) => slugify(concejo) === slug);
  const comarca = getComarcaFromConcejo(slug);

  if (!name || !comarca) {
    notFound();
  }

  return (
    <ArticleListPage
      title={name}
      description={`Noticias de ${name}, en la comarca del ${comarca}, con seguimiento de servicios, política local, cultura y vida vecinal.`}
      articles={await getArticlesByConcejo(slug)}
    />
  );
}
