import Link from "next/link";
import type { Article } from "@/lib/mock-data";
import { formatPublished, slugify } from "@/lib/utils";
import { AdSlot } from "@/components/ad-slot";
import { ArticleCard } from "@/components/article-card";
import { RichText } from "@/components/rich-text";
import { AI_LABEL, ArticleImage } from "@/components/article-image";
import { concejoHref, sectionHref } from "@/lib/taxonomy";
import { ShareButtons } from "@/components/share-buttons";

/** Cuerpo de una noticia con el diseño público. Lo usan la página pública y la vista previa del CMS. */
export function ArticleView({ article, related, shareUrl }: { article: Article; related: Article[]; shareUrl?: string }) {
  const whole = Boolean(article.imagePoster || (article.imageWidth && article.imageHeight && article.imageHeight > article.imageWidth));
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,760px)_300px]">
      <div>
        <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-copper">
          <Link href={`/comarca/${slugify(article.comarca)}`}>{article.comarca}</Link>
          <span>/</span>
          <Link href={concejoHref(article.concejo)}>{article.concejo}</Link>
          <span>/</span>
          <Link href={sectionHref(article.topic)} data-article-section>{article.topic}</Link>
        </div>
        <h1 className="mt-3 font-serif text-4xl font-black leading-[1.08] text-coal-950 sm:text-6xl">
          {article.title}
        </h1>
        <p className="mt-5 text-xl leading-8 text-coal-800">{article.excerpt}</p>
        <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 border-y border-coal-900/15 py-3 text-sm text-coal-800">
          <Link href={`/autor/${slugify(article.author)}`} className="font-bold hover:text-copper">
            {article.author}
          </Link>
          <time dateTime={article.publishedAt || article.date}>{formatPublished(article)}</time>
          <span>· {Math.max(1, Math.ceil(article.body.join(" ").split(/\s+/).length / 220))} min de lectura</span>
        </div>
        {shareUrl ? <ShareButtons url={shareUrl} title={article.title} /> : null}
        {/* Cartel o foto vertical: entera, centrada y con una altura máxima, sobre fondo neutro (nunca recortada). */}
        {whole
          ? <div className="mt-6 flex justify-center bg-[#e9e4dc] p-2" data-article-image-whole><ArticleImage article={article} sizes="article" priority whole width={article.imageWidth ?? 1000} height={article.imageHeight ?? 1400} className="h-auto max-h-[min(80vh,900px)] w-auto max-w-full" /></div>
          : <ArticleImage article={article} sizes="article" priority width={1600} height={1000} className="mt-6 aspect-[16/10] w-full object-cover" />}
        <p className="mt-2 text-xs text-steel" data-article-credit>{article.imageAI ? <><strong data-ai-caption>{AI_LABEL}.</strong> {article.imageCredit ? `Autoría: ${article.imageCredit}` : null}</>
          : article.imageTemplate ? "Imagen: Planta 14" : article.imageCredit ? `Fotografía: ${article.imageCredit}` : null}</p>
        <div className="mx-auto mt-8 max-w-[640px] space-y-6 font-serif text-xl leading-9 text-coal-900" data-article-body>
          {article.bodyRich ? <RichText value={article.bodyRich} /> : article.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {article.tags?.length ? <p className="mx-auto mt-10 max-w-[640px] border-t border-coal-900/15 pt-4 text-[15px] text-coal-800" data-article-tags>
          <strong>Temas:</strong> {article.tags.map((tag, i) => <span key={tag.slug}>{i ? ", " : ""}<Link href={`/etiqueta/${tag.slug}`} className="text-copper underline underline-offset-2 hover:no-underline">{tag.name}</Link></span>)}
        </p> : null}
      </div>
      <aside className="space-y-8">
        <AdSlot tall />
        <div data-block="relacionadas">
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
