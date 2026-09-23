import Link from "next/link";
import { territories, topics } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

export function Header() {
  return (
    <header className="bg-paper">
      <div className="container-p14">
        <div className="masthead-topline">
          <span>Asturias · Caudal y Nalón</span>
          <span>Edición de demostración</span>
        </div>
        <div className="masthead">
          <p className="masthead-note">Donde otros<br />no llegan.</p>
          <Link href="/" className="brand" aria-label="Planta 14 — Portada">Planta <span>14</span></Link>
          <Link href="/buscar" className="search-link"><span aria-hidden="true">⌕</span> Buscar</Link>
        </div>
        <p className="masthead-tagline">Una voz para las Cuencas</p>
        <nav aria-label="Territorio" className="territory-nav">
          {Object.entries(territories).map(([comarca, concejos]) => (
            <div key={comarca} className="territory-group">
              <Link href={`/comarca/${slugify(comarca)}`} className="territory-name">{comarca}</Link>
              <div className="territory-towns">
                {concejos.map((concejo) => <Link key={concejo} href={`/concejo/${slugify(concejo)}`}>{concejo}</Link>)}
              </div>
            </div>
          ))}
        </nav>
        <details className="section-menu">
          <summary>Explorar secciones <span aria-hidden="true">+</span></summary>
          <nav aria-label="Secciones" className="topic-nav">
            {topics.map((topic) => <Link key={topic} href={topic === "Opinión" ? "/opinion" : topic === "Agenda" ? "/agenda" : `/tema/${slugify(topic)}`}>{topic}</Link>)}
          </nav>
        </details>
        <nav aria-label="Secciones destacadas" className="desktop-topics">
          {["Empresas", "Economía", "Sociedad", "Cultura", "Patrimonio", "Deportes", "Opinión", "Agenda"].map((topic) => <Link key={topic} href={topic === "Opinión" ? "/opinion" : topic === "Agenda" ? "/agenda" : `/tema/${slugify(topic)}`}>{topic}</Link>)}
        </nav>
      </div>
    </header>
  );
}
