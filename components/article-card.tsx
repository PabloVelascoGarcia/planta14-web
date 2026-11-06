import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { shortPublished, slugify } from "@/lib/utils";
import { ArticleImage } from "@/components/article-image";

type ArticleCardProps = {
  article: Article;
  variant?: "default" | "compact" | "horizontal";
};

export function ArticleCard({ article, variant = "default" }: ArticleCardProps) {
  if (variant === "compact") {
    return (
      <article className="border-t border-coal-900/15 py-4">
        <Meta article={article} />
        <Link href={`/noticia/${article.slug}`} className="mt-1 block font-serif text-xl font-black leading-tight hover:text-copper">
          {article.title}
        </Link>
      </article>
    );
  }

  if (variant === "horizontal") {
    return (
      <article className="grid gap-4 border-t border-coal-900/15 py-5 sm:grid-cols-[180px_1fr]">
        {/* Hueco de alto fijo, sin estirarse a la fila; la imagen lo cubre entero (sin banda gris debajo). */}
        <Link href={`/noticia/${article.slug}`} aria-label={`Leer: ${article.title}`} className="block h-36 self-start overflow-hidden bg-coal-100 sm:h-[120px]" data-card-thumb>
          <ArticleImage article={article} sizes="horizontal" className="h-full w-full object-cover transition duration-300 hover:scale-105" />
        </Link>
        <div>
          <Meta article={article} />
          <Link href={`/noticia/${article.slug}`} className="mt-1 block font-serif text-2xl font-black leading-tight hover:text-copper">
            {article.title}
          </Link>
          <p className="mt-2 text-sm leading-6 text-coal-800">{article.excerpt}</p>
        {article.sourceName ? <p className="mt-3 text-[12px] text-steel">Fuente: {article.sourceName}</p> : null}
        </div>
      </article>
    );
  }

  return (
    <article className="group">
      <Link href={`/noticia/${article.slug}`} aria-label={`Leer: ${article.title}`} className="block overflow-hidden bg-coal-100">
        <ArticleImage article={article} sizes="card" className="aspect-[16/10] w-full object-cover transition duration-300 group-hover:scale-105" />
      </Link>
      <div className="mt-3">
        <Meta article={article} />
        <Link href={`/noticia/${article.slug}`} className="mt-1 block font-serif text-2xl font-black leading-tight hover:text-copper">
          {article.title}
        </Link>
        <p className="mt-2 text-sm leading-6 text-coal-800">{article.excerpt}</p>
        {article.sourceName ? <p className="mt-3 text-[12px] text-steel">Fuente: {article.sourceName}</p> : null}
      </div>
    </article>
  );
}

/**
 * Concejo (o «Opinión» y la firma) y fecha, en 12 px o más y con formato corto: «Mieres · 5 nov 2026». Las piezas de
 * opinión llevan siempre la etiqueta y la firma, para no confundirlas con noticias.
 */
function Meta({ article }: { article: Article }) {
  const opinion = article.opinion || article.topic === "Opinión";
  return (
    <div className="article-meta flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-steel" data-article-meta>
      {opinion ? <><span className="opinion-tag" data-opinion-tag>Opinión</span><span className="font-bold text-coal-900" data-opinion-author>{article.author}</span></>
        : <Link href={`/concejo/${slugify(article.concejo)}`} className="font-bold text-coal-900 hover:text-copper">{article.concejo}</Link>}
      <span aria-hidden="true">·</span>
      <time dateTime={article.publishedAt || article.date}>{shortPublished(article)}</time>
    </div>
  );
}
