import Link from "next/link";
import { magazineStories, season } from "@/lib/magazine";
import { MagazineFooter } from "@/components/magazine-footer";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

import "./niebla.css";

export const revalidate = 300;
export const metadata = {
  title: "Una voz para las Cuencas · El semanal",
  description: "El semanal de Planta 14: protagonistas y reportajes de Caudal y Nalón.",
  openGraph: { title: "Una voz para las Cuencas · El semanal de Planta 14", description: "Protagonistas y reportajes de Caudal y Nalón.", siteName: "Planta 14", locale: "es_ES", type: "website" }
};

export default async function Niebla() {
  const [lead, ...reports] = magazineStories;
  const leadPhoto = lead.cover ?? lead;
  return <div className="niebla">
    <section className="n-hero" aria-label="Una voz para las Cuencas">
      <img className="n-landscape" src="https://greentrekker.pt/site/assets/files/161680/img_e1263.jpg" alt="Paisaje de montaña con nubes bajas en el Parque Natural de Redes" fetchPriority="high" />
      <div className="n-shade" /><div className="n-mist" aria-hidden="true" />
      <nav className="n-nav" aria-label="Navegación de la revista"><Link href="/niebla" className="n-brand">Planta 14<span>Una voz para las Cuencas</span></Link><div><a href="#historias">Historias</a><a href="#reportajes">Reportajes</a><Link href="/">Ver portada diaria ↗</Link></div></nav>
      <div className="n-hero-copy"><p className="n-label">El semanal · Caudal y Nalón</p><h1>Una voz<br />para las<br /><em>Cuencas.</em></h1><div className="n-hero-bottom"><p>Orgullo de historia.<br />Mirada al futuro</p><a href="#historias" className="n-enter">Entrar en las historias <span aria-hidden="true">↓</span></a></div></div>
      <div className="n-bottom"><span>Un territorio. Muchas formas de vivirlo.</span><span>Número cero · Propuestas editoriales</span></div>
    </section>
    <div className="n-photo-credit">Paisaje de Redes · Fuente de la imagen: Green Trekker</div>
    <section id="historias" className="n-chapter n-future">
      <div className="n-chapter-heading"><span className="n-label">01 / Protagonistas</span><h2>Conversaciones<br />con futuro.</h2><p>Tiempo para preguntar.<br />Espacio para escuchar.</p></div>
      <article className="n-feature"><Link href={`/niebla/${lead.slug}`} className="n-feature-image" aria-label={`Ver propuesta: ${lead.title}`}><img src={leadPhoto.image} alt={leadPhoto.imageAlt} width={1280} height={720} loading="lazy" /><span>Propuesta de entrevista</span></Link><div className="n-feature-text"><p className="n-label">Protagonistas / Número cero</p><h3><Link href={`/niebla/${lead.slug}`}>{lead.title}<br /><em>{lead.subtitle}</em></Link></h3><p>Una conversación por preparar sobre empleo, oportunidades y el futuro del territorio.</p><p className="n-demo-note">{lead.notice}</p><Link className="n-story-link" href={`/niebla/${lead.slug}`}>Explorar la entrevista <span>↗</span></Link><small>{leadPhoto.credit}</small></div></article>
      <div className="n-season"><div className="n-season-intro"><span className="n-label">Calendario</span><h3>{season.title}</h3><p>{season.standfirst}</p></div><div><ul className="n-season-list">{season.phases.map(p=><li key={p.label}><span className="n-label">{p.label}</span><h4>{p.title}</h4><p>{p.text}</p></li>)}</ul><p className="n-demo-note">{season.note}</p></div></div>
    </section>
    <section className="n-life n-chapter" id="reportajes"><div className="n-chapter-heading"><span className="n-label">02 / Reportajes</span><h2>La vida<br /><em>aquí.</em></h2><p>Historias para detenerse.<br />Personas, tierra y memoria.</p></div><div className="n-life-grid">{reports.map((a,i)=><article key={a.slug} className={`n-life-story n-life-story-${i}`}><Link href={`/niebla/${a.slug}`} className="n-life-image" aria-label={`Ver propuesta: ${a.title}`}><img src={a.image} alt={a.imageAlt} width={480} height={320} loading="lazy" /><span aria-hidden="true">0{i+1}</span></Link><p className="n-label">Reportaje / Propuesta editorial</p><h3><Link href={`/niebla/${a.slug}`}>{a.title}</Link></h3><p>{a.subtitle}</p><small>{a.credit}</small></article>)}</div></section>
    <section className="n-territory n-chapter" id="territorio"><span className="n-label">03 / Nuestro lugar</span><h2>Dos valles.<br /><em>Mil historias.</em></h2><div className="n-valleys">{Object.entries(territories).map(([comarca,towns])=><div key={comarca}><Link href={`/comarca/${slugify(comarca)}`} className="n-valley-title">{comarca}<span>↗</span></Link><div>{towns.map(t=><Link key={t} href={`/concejo/${slugify(t)}`}>{t}</Link>)}</div></div>)}</div></section>
    <section className="n-out n-chapter"><div><span className="n-label">04 / Una conversación, varios formatos</span><h2>Leer.<br /><em>Escuchar.</em></h2></div><div className="n-format-copy"><p>Una entrevista que empieza con una conversación y continúa en la revista.</p><ul><li>La entrevista escrita, con tiempo para el contexto.</li><li>La conversación completa en vídeo.</li><li>Fragmentos para descubrirla en redes.</li></ul><p className="n-demo-note">Formato previsto. Todavía no hay entrevista grabada ni vídeo publicado.</p><Link className="n-story-link" href="/niebla/adrian-barbon">Ver la propuesta inaugural <span>↗</span></Link></div></section>
    <MagazineFooter />
  </div>;
}
