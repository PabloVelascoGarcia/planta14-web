import Link from "next/link";
import { getArticles } from "@/lib/cms";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";
import { AgendaList } from "@/components/agenda-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Una voz para las Cuencas" };

export default async function EditorialEdition() {
  const articles = await getArticles();
  const lead = articles.find(a => a.main) ?? articles[0];
  if (!lead) return <div className="container-p14 py-16">Pronto, nuevas historias de las Cuencas.</div>;
  const others = articles.filter(a => a.slug !== lead.slug);
  const spotlight = others.find(a => a.topic === "Empresas") ?? others[0];
  const secondary = others.filter(a => a.slug !== spotlight?.slug).slice(0, 2);
  const remaining = others.filter(a => a.slug !== spotlight?.slug && !secondary.some(s => s.slug === a.slug));
  return <div className="editorial-edition">
    <div className="container-p14">
      <div className="edition-intro"><p>Una voz para las Cuencas<span>Actualidad, personas y futuro.</span></p><Link href="/agenda">Qué hacer en las Cuencas ↗</Link></div>
      <section className="edition-opening" aria-label="En portada">
        <article className="edition-lead">
          <p className="edition-kicker">{lead.concejo} <span>/ {lead.topic}</span></p>
          <h1><Link href={`/noticia/${lead.slug}`}>{lead.title}</Link></h1>
          <p className="edition-excerpt">{lead.excerpt}</p>
          <figure><Link href={`/noticia/${lead.slug}`} aria-label={`Leer: ${lead.title}`}><img src={lead.image} alt={lead.imageAlt ?? ""} width={768} height={480} fetchPriority="high" /></Link><figcaption>{lead.imageCredit}</figcaption></figure>
          <p className="edition-byline">{lead.author} <span>· Fuente: {lead.sourceName ?? "Planta 14"}</span></p>
        </article>
        <aside className="edition-secondary" aria-label="Más actualidad">{secondary.map(a => <article key={a.slug}>
          <p className="edition-kicker">{a.concejo} <span>/ {a.topic}</span></p>
          <h2><Link href={`/noticia/${a.slug}`}>{a.title}</Link></h2>
          <p>{a.excerpt}</p><Link className="edition-read" href={`/noticia/${a.slug}`}>Leer la noticia ↗</Link>
        </article>)}</aside>
      </section>
      {spotlight && <section className="edition-spotlight" aria-label="Historia destacada">
        <div className="edition-spotlight-label"><span>En el foco</span><span>Industria · Territorio · Futuro</span></div>
        <div className="edition-spotlight-grid"><div><p className="edition-kicker">{spotlight.concejo} / {spotlight.topic}</p><h2><Link href={`/noticia/${spotlight.slug}`}>{spotlight.title}</Link></h2><p>{spotlight.excerpt}</p><Link className="edition-read" href={`/noticia/${spotlight.slug}`}>Entender la noticia ↗</Link></div><figure><Link href={`/noticia/${spotlight.slug}`} aria-label={`Leer: ${spotlight.title}`}><img src={spotlight.image} alt={spotlight.imageAlt ?? ""} width={480} height={320} loading="lazy" /></Link><figcaption>{spotlight.imageCredit}</figcaption></figure></div>
      </section>}
      <section className="edition-stories" aria-label="Vida en las Cuencas"><div className="edition-section-heading"><h2>La vida, aquí.</h2><span>Cultura, encuentros y protagonistas</span></div><div className="edition-story-grid">{remaining.map(a => <article key={a.slug}><Link href={`/noticia/${a.slug}`} aria-label={`Leer: ${a.title}`}><img src={a.image} alt={a.imageAlt ?? ""} width={480} height={320} loading="lazy" /></Link><p className="edition-kicker">{a.concejo} / {a.topic}</p><h3><Link href={`/noticia/${a.slug}`}>{a.title}</Link></h3><p>{a.excerpt}</p><p className="edition-credit">{a.imageCredit}</p></article>)}</div></section>
      <section className="edition-local"><div><div className="edition-section-heading"><h2>Tu concejo.</h2></div><p className="edition-local-description">La información empieza cerca.</p>{Object.entries(territories).map(([comarca, towns]) => <div className="edition-valley" key={comarca}><Link href={`/comarca/${slugify(comarca)}`}>{comarca} ↗</Link><div>{towns.map(town => <Link key={town} href={`/concejo/${slugify(town)}`}>{town}</Link>)}</div></div>)}</div><div><div className="edition-section-heading"><h2>Para salir.</h2><Link href="/agenda">Agenda ↗</Link></div><AgendaList /></div></section>
      <p className="edition-source-note">Edición de demostración · Selección de noticias de La Voz de Asturias. Cada pieza enlaza a su fuente original.</p>
    </div>
  </div>;
}
