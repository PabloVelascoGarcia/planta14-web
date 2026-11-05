import type { Metadata } from "next";
import { ArticleListPage } from "@/components/article-list-page";
import { getArticles } from "@/lib/cms";
import { LettersBlock } from "@/components/letters-block";
import { getLetters, lettersActive } from "@/lib/letters";
import { contentSource } from "@/lib/content-source";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Opinión",
  description: "Firmas y análisis sobre la actualidad del Caudal."
};

export default async function OpinionPage() {
  const articles = await getArticles();

  // Cartas de los lectores: solo con contenido real (la demo no tiene cartas) y con el ajuste «Cartas activas».
  const letters = contentSource() === "payload" && await lettersActive() ? await getLetters(5) : null;
  return (
    <>
      <ArticleListPage
        title="Opinión"
        description="Lecturas firmadas sobre territorio, servicios públicos, memoria y futuro de las cuencas."
        articles={articles.filter((article) => article.opinion || article.topic === "Opinión")}
      />
      {letters ? <div className="container-p14 max-w-[760px] pb-10"><LettersBlock letters={letters} more /></div> : null}
    </>
  );
}
