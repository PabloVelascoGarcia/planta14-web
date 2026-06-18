import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";
import { AgendaList } from "@/components/agenda-list";
import { ArticleCard } from "@/components/article-card";
import { Newsletter } from "@/components/newsletter";
import { SectionHeading } from "@/components/section-heading";
import { getArticles } from "@/lib/cms";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home() {
  const articles = await getArticles();
  const mainArticle = articles.find((article) => article.main) ?? articles[0];
  const featured = articles.filter((article) => article.featured && article.slug !== mainArticle.slug);
  const latest = articles.filter((article) => article.slug !== mainArticle.slug).slice(0, 5);
  const caudal = articles.filter((article) => article.comarca === "Caudal").slice(0, 3);
  const nalon = articles.filter((article) => article.comarca === "Nalón").slice(0, 3);
  const opinion = articles.filter((article) => article.opinion);

  return (
    <div className="pb-10">
      <section className="container-p14 grid gap-8 border-y border-coal-900/15 py-8 lg:grid-cols-[1.4fr_0.8fr]">
        <article className="grid gap-5 md:grid-cols-[1fr_0.85fr] lg:grid-cols-1 xl:grid-cols-[1.1fr_0.9fr]">
          <Link href={`/noticia/${mainArticle.slug}`} className="overflow-hidden bg-coal-100">
            <img src={mainArticle.image} alt="" className="aspect-[16/10] h-full w-full object-cover" />
          </Link>
          <div className="flex flex-col justify-center">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-copper">Noticia principal</p>
            <h1 className="mt-2 font-serif text-4xl font-black leading-[0.95] text-coal-950 sm:text-6xl">
              <Link href={`/noticia/${mainArticle.slug}`} className="hover:text-copper">{mainArticle.title}</Link>
            </h1>
            <p className="mt-4 text-lg leading-7 text-coal-800">{mainArticle.excerpt}</p>
          </div>
        </article>
        <aside>
          <SectionHeading title="Últimas" />
          <div>
            {latest.map((article) => (
              <ArticleCard key={article.slug} article={article} variant="compact" />
            ))}
          </div>
        </aside>
      </section>

      <section className="container-p14 mt-10 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <SectionHeading eyebrow="Portada" title="Destacadas" />
          <div className="grid gap-6 md:grid-cols-3">
            {featured.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </div>
        <AdSlot tall />
      </section>

      <section className="container-p14 mt-12 grid gap-10 lg:grid-cols-2">
        <div>
          <SectionHeading eyebrow="Territorio" title="Caudal" />
          {caudal.map((article) => (
            <ArticleCard key={article.slug} article={article} variant="horizontal" />
          ))}
        </div>
        <div>
          <SectionHeading eyebrow="Territorio" title="Nalón" />
          {nalon.map((article) => (
            <ArticleCard key={article.slug} article={article} variant="horizontal" />
          ))}
        </div>
      </section>

      <section className="container-p14 mt-12">
        <SectionHeading eyebrow="Mapa informativo" title="Por concejos" />
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(territories).map(([comarca, concejos]) => (
            <div key={comarca} className="border-t-4 border-coal-950 bg-white/50 p-5">
              <h3 className="font-serif text-3xl font-black">{comarca}</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {concejos.map((concejo) => (
                  <Link
                    key={concejo}
                    href={`/concejo/${slugify(concejo)}`}
                    className="border-b border-coal-900/15 py-2 text-sm font-bold hover:text-copper"
                  >
                    {concejo}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-p14 mt-12 grid gap-8 lg:grid-cols-[1fr_0.85fr]">
        <div>
          <SectionHeading title="Opinión" />
          {opinion.map((article) => (
            <ArticleCard key={article.slug} article={article} variant="horizontal" />
          ))}
        </div>
        <div>
          <SectionHeading title="Agenda" />
          <AgendaList />
        </div>
      </section>

      <section className="container-p14 mt-12 grid gap-8 lg:grid-cols-[1fr_300px]">
        <Newsletter />
        <AdSlot />
      </section>
    </div>
  );
}
