"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { visibleTowns } from "@/lib/demo/territories";
import { territories, topics } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";
import news from "@/lib/demo/data/news.json";

const demoTopics = topics.filter(topic => topic === "Agenda" || news.some(article => article.topic === topic));

/**
 * La frase lateral en dos líneas, como era antes de los lemas editables («Donde otros<br />no llegan»): el corte va
 * tras un punto interior si lo hay; si no, en el espacio más cercano a la mitad.
 */
function twoLines(text: string) {
  const sentence = text.match(/^(.+?\.)\s+(.+)$/);
  if (sentence) return <>{sentence[1]}<br />{sentence[2]}</>;
  const spaces = [...text.matchAll(/ /g)].map(m => m.index ?? 0);
  if (!spaces.length) return text;
  const cut = spaces.reduce((best, i) => Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2) ? i : best);
  return <>{text.slice(0, cut)}<br />{text.slice(cut + 1)}</>;
}

export function Header({ sectionNames = demoTopics, townSlugs = visibleTowns().map(t => t.slug), navigationTerritories = territories, demo = true, tagline = "Una voz para las Cuencas", sideNote = "Donde otros no llegan" }: { sectionNames?: string[]; townSlugs?: string[]; navigationTerritories?: Record<string, string[]>; demo?: boolean; tagline?: string; sideNote?: string }) {
  const pathname = usePathname();
  if (townSlugs.some(slug => pathname === `/${slug}` || pathname === `/${slug}/panel`)) return null;
  return (
    <header className="bg-paper">
      <div className="container-p14">
        <div className="masthead-topline">
          <span>Asturias · El Caudal</span>
          {demo ? <span>Edición de demostración</span> : null}
        </div>
        <div className="masthead">
          <p className="masthead-note" data-motto="lateral">{twoLines(sideNote)}</p>
          <Link href="/" className="brand" aria-label="Planta 14 — Portada">Planta <span>14</span></Link>
          <Link href="/buscar" className="search-link"><span aria-hidden="true">⌕</span> Buscar</Link>
        </div>
        <p className="masthead-tagline" data-motto="cabecera">{tagline}</p>
        <nav aria-label="Territorio" className="territory-nav">
          {Object.entries(navigationTerritories).map(([comarca, concejos]) => (
            <div key={comarca} className="territory-group">
              <Link href={`/comarca/${slugify(comarca)}`} className="territory-name">{comarca}</Link>
              <div className="territory-towns">
                {concejos.map((concejo) => <Link key={concejo} href={`/${slugify(concejo)}`}>{concejo}</Link>)}
              </div>
            </div>
          ))}
        </nav>
        <details className="section-menu">
          <summary>Explorar secciones <span aria-hidden="true">+</span></summary>
          <nav aria-label="Secciones" className="topic-nav">
            {sectionNames.map((topic) => <Link key={topic} href={topic === "Opinión" ? "/opinion" : topic === "Agenda" ? "/agenda" : `/tema/${slugify(topic)}`}>{topic}</Link>)}
            <Link href="/fiestas">Fiestas</Link>
            <Link href="/util">Útil</Link>
          </nav>
        </details>
        <nav aria-label="Secciones destacadas" className="desktop-topics">
          {sectionNames.map((topic) => <Link key={topic} href={topic === "Opinión" ? "/opinion" : topic === "Agenda" ? "/agenda" : `/tema/${slugify(topic)}`}>{topic}</Link>)}
          <Link href="/fiestas">Fiestas</Link>
          <Link href="/util">Útil</Link>
        </nav>
      </div>
    </header>
  );
}
