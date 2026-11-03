import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { formatDate, slugify } from "@/lib/utils";
import { AdSlot } from "@/components/ad-slot";
import { ArticleCard } from "@/components/article-card";

/** Cuerpo de una noticia con el diseño público. Lo usan la página pública y la vista previa del CMS. */
export function ArticleView({ article, related }: { article: Article; related: Article[] }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,760px)_300px]">
      <div>
        <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-copper">
          <Link href={`/comarca/${slugify(article.comarca)}`}>{article.comarca}</Link>
          <span>/</span>
          <Link href={`/concejo/${slugify(article.concejo)}`}>{article.concejo}</Link>
          <span>/</span>
          <Link href={`/tema/${slugify(article.topic)}`}>{article.topic}</Link>
        </div>
        <h1 className="mt-3 font-serif text-4xl font-black leading-[1.08] text-coal-950 sm:text-6xl">
          {article.title}
        </h1>
        <p className="mt-5 text-xl leading-8 text-coal-800">{article.excerpt}</p>
        <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 border-y border-coal-900/15 py-3 text-sm text-coal-800">
          <Link href={`/autor/${slugify(article.author)}`} className="font-bold hover:text-copper">
            {article.author}
          </Link>
          <time dateTime={article.date}>{formatDate(article.date)}</time>
          <span>· {Math.max(1, Math.ceil(article.body.join(" ").split(/\s+/).length / 220))} min de lectura</span>
        </div>
        <img src={article.image} alt={article.imageAlt ?? ""} className="mt-6 aspect-[16/10] w-full object-cover" />
        {article.imageCredit ? <p className="mt-2 text-xs text-steel">Fotografía: {article.imageCredit}</p> : null}
        <div className="mx-auto mt-8 max-w-[640px] space-y-6 font-serif text-xl leading-9 text-coal-900">
          {article.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>
      <aside className="space-y-8">
        <AdSlot tall />
        <div>
          <h2 className="border-b-2 border-coal-950 pb-2 font-serif text-2xl font-black">Relacionadas</h2>
          <div className="mt-2">
            {related.map((item) => (
              <ArticleCard key={item.slug} article={item} variant="compact" />
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
