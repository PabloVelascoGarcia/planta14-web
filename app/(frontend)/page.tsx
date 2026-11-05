import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";
import { AgendaList } from "@/components/agenda-list";
import { ArticleCard } from "@/components/article-card";
import { ArticleImage } from "@/components/article-image";
import { Newsletter } from "@/components/newsletter";
import { SectionHeading } from "@/components/section-heading";
import { getArticles } from "@/lib/cms";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";
import { contentSource } from "@/lib/content-source";
import { frontPage } from "@/lib/front-page";
import { getMunicipalSpaces } from "@/lib/municipal-content";
import { fiestaDates, fiestasDaysBefore, getFiestas, madridToday, thisWeek } from "@/lib/fiestas";

export const revalidate = 300;
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const articles = await getArticles();
  const front = frontPage(articles);
  if (!front) return <div className="container-p14 py-20"><h1 className="font-serif text-5xl">Las cuencas tienen mucho que contar.</h1><p className="mt-5">Pronto encontrarás aquí nuestras primeras historias.</p></div>;
  const { main: mainArticle, latest, featured, caudal, opinion, more } = front;
  // «Tu ayuntamiento, aquí»: los espacios municipales activos; si no hay ninguno, la lista de los seis concejos.
  const townNames = new Map(Object.values(territories).flat().map(name => [slugify(name), name]));
  const townOrder = [...townNames.keys()];
  const activeSpaces = (await getMunicipalSpaces({ activos: true })).filter(space => townNames.has(space.id))
    .sort((a, b) => townOrder.indexOf(a.id) - townOrder.indexOf(b.id));

  // «Fiestas esta semana»: solo texto (sin carteles), desde N días antes (ajuste del CMS) hasta su último día. Sin fiestas,
  // no sale. Solo publicadas y con fecha confirmada (getFiestas ya deja fuera los borradores y «Fecha pendiente»).
  const [allFiestas, daysBefore] = await Promise.all([getFiestas(), fiestasDaysBefore()]);
  const weekFiestas = thisWeek(allFiestas, madridToday(), daysBefore).slice(0, 6);

  return (
    <div className="pb-10">
      <section className="container-p14 front-opening">
        <article className="lead-story" data-block="principal">
          <div className="flex items-center gap-3 editorial-kicker"><Link href={`/concejo/${slugify(mainArticle.concejo)}`}>{mainArticle.concejo}</Link><span aria-hidden="true">/</span><span>{mainArticle.topic}</span></div>
          <h1><Link href={`/noticia/${mainArticle.slug}`}>{mainArticle.title}</Link></h1>
          <p className="lead-excerpt">{mainArticle.excerpt}</p>
          <Link href={`/noticia/${mainArticle.slug}`} className="lead-image" aria-label={`Leer: ${mainArticle.title}`}>
            <ArticleImage article={mainArticle} sizes="lead" priority width={1400} height={788} />
          </Link>
          {mainArticle.imageCredit ? <p className="mt-2 text-[10px] text-steel">Fotografía: {mainArticle.imageCredit}</p> : null}
          <div className="lead-byline"><span>{mainArticle.author}</span><Link href={`/noticia/${mainArticle.slug}`}>Leer la historia <span aria-hidden="true">↗</span></Link></div>
        </article>
        <aside className="opening-sidebar" data-block="en-portada">
          <SectionHeading eyebrow="El pulso del territorio" title="En portada" />
          {latest.map((article, index) => <div key={article.slug} className="numbered-story"><span className="story-number">0{index + 1}</span><ArticleCard article={article} variant="compact" /></div>)}
          <Link className="editorial-link" href="/agenda">La agenda de las cuencas <span aria-hidden="true">↗</span></Link>
        </aside>
      </section>

      <section className="container-p14 mt-10 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div data-block="la-vida-aqui">
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
        <div data-block="caudal">
          <SectionHeading eyebrow="Territorio" title="Caudal" href="/comarca/caudal" />
          {caudal.map((article) => (
            <ArticleCard key={article.slug} article={article} variant="horizontal" />
          ))}
        </div>
        <div data-block="ayuntamientos">
          <SectionHeading eyebrow="Cerca de ti" title="Tu ayuntamiento, aquí" />
          <p className="mt-4 text-lg leading-7 text-steel">Avisos, agenda y oportunidades. Un espacio propio para cada concejo, conectado con la vida del Caudal.</p>
          {activeSpaces.length ? <div className="mt-6 flex flex-wrap gap-3">{activeSpaces.map(space => <Link key={space.id} href={`/${space.id}`} className="municipal-cta">Descubre el espacio de {townNames.get(space.id)} <span>↗</span></Link>)}</div> : null}
          <Link href="#concejos" className="editorial-link mt-4">Los seis concejos del Caudal ↗</Link>
        </div>
      </section>

      {weekFiestas.length ? <section className="container-p14 mt-12" data-block="fiestas" aria-labelledby="fiestas-portada">
        <div className="border-t-4 border-coal-950 pt-4">
          <p className="editorial-kicker">Fiestas de las Cuencas</p>
          <h2 id="fiestas-portada" className="mt-2 font-serif text-3xl font-black">Fiestas esta semana</h2>
          <ul className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {weekFiestas.map(f => <li key={f.slug} className="border-b border-coal-900/15 py-3"><Link href={`/fiestas/${f.slug}`} className="block font-serif text-xl font-black leading-tight hover:text-copper">{f.name}</Link><span className="mt-1 block text-[15px] text-coal-800">{f.village} · {f.town} · {fiestaDates(f)}</span></li>)}
          </ul>
          <Link href="/fiestas" className="mt-4 inline-flex min-h-11 items-center font-bold text-copper hover:underline">Calendario de fiestas ↗</Link>
        </div>
      </section> : null}

      <section id="concejos" className="container-p14 mt-12 scroll-mt-24">
        <SectionHeading eyebrow="Mapa informativo" title="Los seis concejos del Caudal" />
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(territories).map(([comarca, concejos]) => (
            <div key={comarca} className="border-t-4 border-coal-950 bg-white/50 p-5">
              <h3 className="font-serif text-3xl font-black">{comarca}</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {concejos.map((concejo) => (
                  <Link
                    key={concejo}
                    href={`/${slugify(concejo)}`}
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
        <div data-block="opinion">
          <SectionHeading title={opinion.length ? "Opinión" : "Más historias"} />
          {(opinion.length ? opinion : more).map((article) => (
            <ArticleCard key={article.slug} article={article} variant="horizontal" />
          ))}
        </div>
        <div data-block="agenda">
          <SectionHeading title="Para salir" href="/agenda" />
          <AgendaList />
        </div>
      </section>

      {/* El semanal es una maqueta de la demo (/niebla): no aparece con contenido real. */}
      {contentSource() === "demo" ? <section className="container-p14 mt-12 border-y border-coal-900/20 py-8" aria-label="El semanal de Planta 14">
        <p className="editorial-kicker">Magazine · Concepto de presentación</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5"><div><h2 className="font-serif text-4xl font-black">El semanal de Planta 14</h2><p className="mt-3 text-sm text-steel">Protagonistas y reportajes. Historias para leer con tiempo.</p></div><Link href="/niebla" className="text-sm font-bold">Explorar el magazine ↗</Link></div>
        <nav className="mt-5 flex flex-wrap gap-5 text-sm" aria-label="Propuestas del semanal"><Link href="/niebla/adrian-barbon">Protagonistas: Adrián Barbón ↗</Link><Link href="/niebla/volver-a-la-tierra">Reportaje: Volver a la tierra ↗</Link><Link href="/niebla/la-fiesta-antes-de-la-fiesta">Reportaje: La fiesta antes de la fiesta ↗</Link></nav>
        <p className="mt-4 text-xs text-steel">Propuestas editoriales de demostración; entrevistas y reportajes pendientes de realización.</p>
      </section> : null}

      <section className="container-p14 mt-12 grid gap-8 lg:grid-cols-[1fr_300px]">
        <Newsletter />
        <AdSlot />
      </section>
    </div>
  );
}
