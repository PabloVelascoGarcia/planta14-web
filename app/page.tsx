import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";
import { AgendaList } from "@/components/agenda-list";
import { ArticleCard } from "@/components/article-card";
import { Newsletter } from "@/components/newsletter";
import { SectionHeading } from "@/components/section-heading";
import { getArticles } from "@/lib/cms";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

export const revalidate = 300;

export default async function Home() {
  const articles = await getArticles();
  const mainArticle = articles.find((article) => article.main) ?? articles[0];
  if (!mainArticle) return <div className="container-p14 py-20"><h1 className="font-serif text-5xl">Las cuencas tienen mucho que contar.</h1><p className="mt-5">Pronto encontrarás aquí nuestras primeras historias.</p></div>;
  const secondary = articles.filter((article) => article.slug !== mainArticle.slug);
  const featured = [...secondary.filter(article => article.featured), ...secondary.filter(article => !article.featured)].slice(0, 3);
  const latest = articles.filter((article) => article.slug !== mainArticle.slug).slice(0, 5);
  const caudal = articles.filter((article) => article.comarca === "Caudal").slice(0, 3);
  const nalon = articles.filter((article) => article.comarca === "Nalón").slice(0, 3);
  const opinion = articles.filter((article) => article.opinion);

  return (
    <div className="pb-10">
      <section className="container-p14 front-opening">
        <article className="lead-story">
          <div className="flex items-center gap-3 editorial-kicker"><Link href={`/concejo/${slugify(mainArticle.concejo)}`}>{mainArticle.concejo}</Link><span aria-hidden="true">/</span><span>{mainArticle.topic}</span></div>
          <h1><Link href={`/noticia/${mainArticle.slug}`}>{mainArticle.title}</Link></h1>
          <p className="lead-excerpt">{mainArticle.excerpt}</p>
          <Link href={`/noticia/${mainArticle.slug}`} className="lead-image" aria-label={`Leer: ${mainArticle.title}`}>
            <img src={mainArticle.image} alt={mainArticle.imageAlt ?? ""} fetchPriority="high" width={1400} height={788} />
          </Link>
          {mainArticle.imageCredit ? <p className="mt-2 text-[10px] text-steel">Fotografía: {mainArticle.imageCredit}</p> : null}
          <div className="lead-byline"><span>{mainArticle.author}</span><Link href={`/noticia/${mainArticle.slug}`}>Leer la historia <span aria-hidden="true">↗</span></Link></div>
        </article>
        <aside className="opening-sidebar">
          <SectionHeading eyebrow="El pulso del territorio" title="En portada" />
          {latest.slice(0, 4).map((article, index) => <div key={article.slug} className="numbered-story"><span className="story-number">0{index + 1}</span><ArticleCard article={article} variant="compact" /></div>)}
          <Link className="editorial-link" href="/agenda">La agenda de las cuencas <span aria-hidden="true">↗</span></Link>
        </aside>
      </section>

      <section className="container-p14 mt-10 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <SectionHeading eyebrow="Portada" title="La vida aquí" />
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
          <SectionHeading eyebrow="Territorio" title="Caudal" href="/comarca/caudal" />
          {caudal.map((article) => (
            <ArticleCard key={article.slug} article={article} variant="horizontal" />
          ))}
        </div>
        <div>
          <SectionHeading eyebrow="Territorio" title="Nalón" href="/comarca/nalon" />
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
          <SectionHeading title={opinion.length ? "Opinión" : "Más historias"} />
          {(opinion.length ? opinion : articles.slice(-2)).map((article) => (
            <ArticleCard key={article.slug} article={article} variant="horizontal" />
          ))}
        </div>
        <div>
          <SectionHeading title="Para salir" href="/agenda" />
          <AgendaList />
        </div>
      </section>

      <section className="container-p14 mt-12 border-y border-coal-900/20 py-8" aria-label="El semanal de Planta 14">
        <p className="editorial-kicker">Magazine · Concepto de presentación</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5"><div><h2 className="font-serif text-4xl font-black">El semanal de Planta 14</h2><p className="mt-3 text-sm text-steel">Protagonistas y reportajes. Historias para leer con tiempo.</p></div><Link href="/niebla" className="text-sm font-bold">Explorar el magazine ↗</Link></div>
        <nav className="mt-5 flex flex-wrap gap-5 text-sm" aria-label="Propuestas del semanal"><Link href="/niebla/adrian-barbon">Protagonistas: Adrián Barbón ↗</Link><Link href="/niebla/volver-a-la-tierra">Reportaje: Volver a la tierra ↗</Link><Link href="/niebla/la-fiesta-antes-de-la-fiesta">Reportaje: La fiesta antes de la fiesta ↗</Link></nav>
        <p className="mt-4 text-xs text-steel">Propuestas editoriales de demostración; entrevistas y reportajes pendientes de realización.</p>
      </section>

      <section className="container-p14 mt-12 grid gap-8 lg:grid-cols-[1fr_300px]">
        <Newsletter />
        <AdSlot />
      </section>
    </div>
  );
}
