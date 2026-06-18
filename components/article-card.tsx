import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { formatDate, slugify } from "@/lib/utils";

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
        <Link href={`/noticia/${article.slug}`} className="block overflow-hidden bg-coal-100">
          <img src={article.image} alt="" className="h-36 w-full object-cover transition duration-300 hover:scale-105" />
        </Link>
        <div>
          <Meta article={article} />
          <Link href={`/noticia/${article.slug}`} className="mt-1 block font-serif text-2xl font-black leading-tight hover:text-copper">
            {article.title}
          </Link>
          <p className="mt-2 text-sm leading-6 text-coal-800">{article.excerpt}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="group">
      <Link href={`/noticia/${article.slug}`} className="block overflow-hidden bg-coal-100">
        <img src={article.image} alt="" className="aspect-[16/10] w-full object-cover transition duration-300 group-hover:scale-105" />
      </Link>
      <div className="mt-3">
        <Meta article={article} />
        <Link href={`/noticia/${article.slug}`} className="mt-1 block font-serif text-2xl font-black leading-tight hover:text-copper">
          {article.title}
        </Link>
        <p className="mt-2 text-sm leading-6 text-coal-800">{article.excerpt}</p>
      </div>
    </article>
  );
}

function Meta({ article }: { article: Article }) {
  return (
    <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-steel">
      <Link href={`/comarca/${slugify(article.comarca)}`} className="hover:text-copper">{article.comarca}</Link>
      <span>/</span>
      <Link href={`/concejo/${slugify(article.concejo)}`} className="hover:text-copper">{article.concejo}</Link>
      <span>/</span>
      <time dateTime={article.date}>{formatDate(article.date)}</time>
    </div>
  );
}
