import { ArticleCard } from "@/components/article-card";
import type { Article } from "@/lib/mock-data";

type ArticleListPageProps = {
  title: string;
  description: string;
  articles: Article[];
};

export function ArticleListPage({ title, description, articles }: ArticleListPageProps) {
  return (
    <div className="container-p14 py-8">
      <header className="max-w-3xl border-b-2 border-coal-950 pb-5">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-copper">Planta 14</p>
        <h1 className="mt-2 font-serif text-5xl font-black leading-none text-coal-950">{title}</h1>
        <p className="mt-4 text-lg leading-7 text-coal-800">{description}</p>
      </header>
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
      {articles.length === 0 ? (
        <p className="mt-8 border-y border-coal-900/15 py-8 text-coal-800">No hay noticias publicadas en esta sección.</p>
      ) : null}
    </div>
  );
}
