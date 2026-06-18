import type { Metadata } from "next";
import { ArticleListPage } from "@/components/article-list-page";
import { getArticles } from "@/lib/cms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Opinión",
  description: "Firmas y análisis sobre la actualidad de Caudal y Nalón."
};

export default async function OpinionPage() {
  const articles = await getArticles();

  return (
    <ArticleListPage
      title="Opinión"
      description="Lecturas firmadas sobre territorio, servicios públicos, memoria y futuro de las cuencas."
      articles={articles.filter((article) => article.opinion || article.topic === "Opinión")}
    />
  );
}
