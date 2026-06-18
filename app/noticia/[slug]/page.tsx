import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getArticle, getArticles } from "@/lib/cms";
import { formatDate, slugify } from "@/lib/utils";
import { AdSlot } from "@/components/ad-slot";
import { ArticleCard } from "@/components/article-card";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return {};
  }

  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: [article.image]
    }
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    notFound();
  }

  const related = (await getArticles())
    .filter((item) => item.slug !== article.slug && (item.comarca === article.comarca || item.topic === article.topic))
    .slice(0, 3);

  return (
    <article className="container-p14 py-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,760px)_300px]">
        <div>
          <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-copper">
            <Link href={`/comarca/${slugify(article.comarca)}`}>{article.comarca}</Link>
            <span>/</span>
            <Link href={`/concejo/${slugify(article.concejo)}`}>{article.concejo}</Link>
            <span>/</span>
            <Link href={`/tema/${slugify(article.topic)}`}>{article.topic}</Link>
          </div>
          <h1 className="mt-3 font-serif text-5xl font-black leading-[0.98] text-coal-950 sm:text-6xl">
            {article.title}
          </h1>
          <p className="mt-5 text-xl leading-8 text-coal-800">{article.excerpt}</p>
          <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 border-y border-coal-900/15 py-3 text-sm text-coal-800">
            <Link href={`/autor/${slugify(article.author)}`} className="font-bold hover:text-copper">
              {article.author}
            </Link>
            <span>{formatDate(article.date)}</span>
          </div>
          <img src={article.image} alt="" className="mt-6 aspect-[16/10] w-full object-cover" />
          <div className="mt-8 space-y-6 font-serif text-xl leading-9 text-coal-900">
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
    </article>
  );
}
