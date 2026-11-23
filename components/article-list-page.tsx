import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import type { Article } from "@/lib/mock-data";

type ArticleListPageProps = {
  title: string;
  description: string;
  articles: Article[];
  /** Antetítulo (por defecto «Planta 14»). */
  kicker?: string;
  /** Paginación (?pagina=N): página actual, total y dirección base. */
  pagination?: { current: number; pages: number; basePath: string };
  empty?: string;
};

export function ArticleListPage({ title, description, articles, kicker = "Planta 14", pagination, empty = "No hay noticias publicadas en esta sección." }: ArticleListPageProps) {
  const href = (page: number) => (page <= 1 ? pagination!.basePath : `${pagination!.basePath}?pagina=${page}`);
  return (
    <div className="container-p14 py-8">
      <header className="max-w-3xl border-b-2 border-coal-950 pb-5">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-copper">{kicker}</p>
        <h1 className="mt-2 font-serif text-5xl font-black leading-none text-coal-950">{title}</h1>
        <p className="mt-4 text-lg leading-7 text-coal-800">{description}</p>
      </header>
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
      {articles.length === 0 ? (
        <p className="mt-8 border-y border-coal-900/15 py-8 text-coal-800">{empty}</p>
      ) : null}
      {pagination && pagination.pages > 1 ? (
        <nav aria-label="Páginas" className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-coal-900/15 pt-5 text-[15px]" data-pagination>
          {pagination.current > 1 ? <Link href={href(pagination.current - 1)} rel="prev" className="inline-flex min-h-11 items-center font-bold text-copper hover:underline">← Más recientes</Link> : <span />}
          <span className="text-steel">Página {pagination.current} de {pagination.pages}</span>
          {pagination.current < pagination.pages ? <Link href={href(pagination.current + 1)} rel="next" className="inline-flex min-h-11 items-center font-bold text-copper hover:underline">Más antiguas →</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
