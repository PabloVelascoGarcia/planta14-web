import Link from "next/link";
import { notFound } from "next/navigation";
import { magazineStories } from "@/lib/magazine";
import { MagazineFooter } from "@/components/magazine-footer";
import "../niebla.css";
export function generateStaticParams() { return magazineStories.map(({slug})=>({slug})); }
export async function generateMetadata({params}: {params:Promise<{slug:string}>}) {
  const {slug}=await params; const story=magazineStories.find(a=>a.slug===slug);
  return {title:story ? `${story.title} · El semanal` : "El semanal",robots:{index:false,follow:false}};
}
export default async function MagazineArticle({params}: {params:Promise<{slug:string}>}) {
  const {slug}=await params; const story=magazineStories.find(a=>a.slug===slug); if(!story) notFound();
  return <div className="niebla n-article"><nav className="n-nav n-article-nav" aria-label="Navegación de la revista"><Link href="/niebla" className="n-brand">Planta 14<span>Donde otros no llegan.</span></Link><div><Link href="/niebla">Volver al semanal ↗</Link></div></nav><article><header className="n-article-heading"><p className="n-label">El semanal / {story.category} / Número cero</p><h1>{story.title}</h1><p className="n-article-subtitle">{story.subtitle}</p><p className="n-demo-note">{story.notice}</p></header><figure className="n-article-photo"><img src={story.image} alt={story.imageAlt} width={1280} height={720} fetchPriority="high" /><figcaption>{story.credit} · <a href={story.source} target="_blank" rel="noopener noreferrer">Fuente de la fotografía ↗</a></figcaption></figure><div className="n-article-body"><p className="n-standfirst">{story.introduction}</p>{story.chapters.map((chapter,i)=><section key={chapter.title}><span className="n-label">0{i+1}</span><h2>{chapter.title}</h2><p>{chapter.text}</p></section>)}<aside className="n-article-disclosure"><h2>Sobre esta propuesta</h2><p>Esta página muestra el enfoque y la presentación previstos para el magazine. No contiene respuestas, testimonios ni trabajo de campo realizados por Planta 14.</p>{story.category==="Protagonistas" && <p>El formato previsto combina entrevista escrita y conversación en vídeo. Invitación, grabación y publicación pendientes; no hay vídeo disponible.</p>}</aside><Link className="n-story-link" href="/niebla">Seguir explorando el semanal <span>↗</span></Link></div></article><MagazineFooter /></div>;
}
