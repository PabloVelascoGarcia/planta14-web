import Link from "next/link";
import { getArticles } from "@/lib/cms";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";
import { AgendaList } from "@/components/agenda-list";
import "./niebla.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entre la niebla · Una voz para las Cuencas" };

export default async function Niebla() {
  const articles = await getArticles();
  const lead = articles.find(a => a.main) ?? articles[0];
  const industry = articles.find(a => a.topic === "Empresas" && a.slug !== lead?.slug);
  const life = articles.filter(a => a.slug !== lead?.slug && a.slug !== industry?.slug).slice(0, 4);
  return <div className="niebla">
    <section className="n-hero" aria-label="Una voz para las Cuencas">
      <img className="n-landscape" src="https://greentrekker.pt/site/assets/files/161680/img_e1263.jpg" alt="Paisaje de montaña con nubes bajas en el Parque Natural de Redes" fetchPriority="high" />
      <div className="n-shade" /><div className="n-mist" aria-hidden="true" />
      <nav className="n-nav" aria-label="Navegación de la revista"><Link href="/niebla" className="n-brand">Planta 14<span>Donde otros no llegan.</span></Link><div><a href="#historias">Historias</a><a href="#territorio">Territorio</a><Link href="/">Ver portada diaria ↗</Link></div></nav>
      <div className="n-hero-copy"><p className="n-label">Asturias · Caudal y Nalón</p><h1>Una voz<br />para las<br /><em>Cuencas.</em></h1><div className="n-hero-bottom"><p>Venimos de muy dentro.<br />Miramos hacia delante.</p><a href="#historias" className="n-enter">Entrar en las historias <span aria-hidden="true">↓</span></a></div></div>
      <div className="n-bottom"><span>Un territorio. Muchas formas de vivirlo.</span><span>Edición de demostración · 01</span></div>
    </section>
    <div className="n-photo-credit">Paisaje de Redes · Fuente de la imagen: Green Trekker</div>
    <section id="historias" className="n-chapter n-future">
      <div className="n-chapter-heading"><span className="n-label">01 / Lo que viene</span><h2>El futuro también<br />se escribe aquí.</h2><p>Industria, montaña y nuevas posibilidades.<br />Las Cuencas en movimiento.</p></div>
      {lead && <article className="n-feature"><Link href={`/noticia/${lead.slug}`} className="n-feature-image" aria-label={`Leer: ${lead.title}`}><img src={lead.image} alt={lead.imageAlt ?? ""} width={1280} height={720} loading="lazy" /><span>{lead.concejo} / {lead.topic}</span></Link><div className="n-feature-text"><p className="n-label">Montaña · Todo el año</p><h3><Link href={`/noticia/${lead.slug}`}>{lead.title}</Link></h3><p>{lead.excerpt}</p><Link className="n-story-link" href={`/noticia/${lead.slug}`}>Descubrir la historia <span>↗</span></Link><small>{lead.imageCredit}</small></div></article>}
      {industry && <article className="n-industry"><span className="n-label">{industry.concejo}<br />{industry.topic}</span><h3><Link href={`/noticia/${industry.slug}`}>{industry.title}</Link></h3><Link href={`/noticia/${industry.slug}`} className="n-round-link" aria-label={`Leer: ${industry.title}`}>↗</Link></article>}
    </section>
    <section className="n-life n-chapter"><div className="n-chapter-heading"><span className="n-label">02 / Lo que somos</span><h2>La vida<br /><em>aquí.</em></h2><p>Lo que nos reúne.<br />Lo que merece contarse.</p></div><div className="n-life-grid">{life.map((a,i)=><article key={a.slug} className={`n-life-story n-life-story-${i}`}><Link href={`/noticia/${a.slug}`} className="n-life-image" aria-label={`Leer: ${a.title}`}><img src={a.image} alt={a.imageAlt ?? ""} width={480} height={320} loading="lazy" /><span aria-hidden="true">0{i+1}</span></Link><p className="n-label">{a.concejo} / {a.topic}</p><h3><Link href={`/noticia/${a.slug}`}>{a.title}</Link></h3><p>{a.excerpt}</p><small>{a.imageCredit}</small></article>)}</div></section>
    <section className="n-territory n-chapter" id="territorio"><span className="n-label">03 / Nuestro lugar</span><h2>Dos valles.<br /><em>Mil historias.</em></h2><div className="n-valleys">{Object.entries(territories).map(([comarca,towns])=><div key={comarca}><Link href={`/comarca/${slugify(comarca)}`} className="n-valley-title">{comarca}<span>↗</span></Link><div>{towns.map(t=><Link key={t} href={`/concejo/${slugify(t)}`}>{t}</Link>)}</div></div>)}</div></section>
    <section className="n-out n-chapter"><div><span className="n-label">04 / Nos vemos fuera</span><h2>Para<br /><em>salir.</em></h2><Link className="n-story-link" href="/agenda">Toda la agenda <span>↗</span></Link></div><AgendaList /></section>
    <footer className="n-footer"><Link href="/" className="n-footer-brand">Planta 14</Link><p>Orgullosos de nuestra historia.<br />Con la mirada en el futuro.</p><div><Link href="/">Portada diaria ↗</Link><Link href="/contacto">Contacto ↗</Link><a href="#contenido">Volver arriba ↑</a></div><small>Edición de demostración. Noticias seleccionadas de La Voz de Asturias, con fuente y créditos en cada pieza.</small></footer>
  </div>;
}
