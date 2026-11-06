import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { fiestaDates, type Fiesta } from "@/lib/fiestas-dates";
import type { Article } from "@/lib/mock-data";

/**
 * Página de un concejo SIN espacio municipal activo: una página del periódico, con su estilo (título, noticias de
 * Planta 14 y «Fiestas esta semana»). Sin escudo, sin rótulos de espacio municipal ni lemas: sin contrato no debe
 * parecer un espacio del ayuntamiento. Al activarse el concejo vuelve sola su página municipal (MunicipalPage).
 */
export function TownNewsPage({ name, slug, articles, fiestas }: { name: string; slug: string; articles: Article[]; fiestas: Fiesta[] }) {
  return <div className="container-p14 py-8" data-town-news={slug}>
    <header className="max-w-3xl border-b-2 border-coal-950 pb-5">
      <h1 className="font-serif text-5xl font-black leading-none text-coal-950">{name}</h1>
    </header>
    <div className={`mt-8 grid gap-10 ${fiestas.length ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
      <section aria-labelledby="noticias-concejo">
        <h2 id="noticias-concejo" className="font-serif text-3xl font-black">Noticias de {name} en Planta 14</h2>
        {articles.length ? <div className="mt-6 grid gap-6 md:grid-cols-2">{articles.map(article => <ArticleCard key={article.slug} article={article} />)}</div>
          : <p className="mt-6 border-y border-coal-900/15 py-8 text-coal-800">Todavía no hay noticias de {name}.</p>}
      </section>
      {fiestas.length ? <aside aria-labelledby="fiestas-concejo" data-municipal-fiestas>
        <h2 id="fiestas-concejo" className="border-b-2 border-coal-950 pb-3 font-serif text-2xl font-black">Fiestas esta semana</h2>
        <ul>{fiestas.map(f => <li key={f.slug} className="border-b border-coal-900/15 py-3">
          <Link href={`/fiestas/${f.slug}`} className="block font-serif text-xl font-black leading-tight hover:text-copper">{f.name}</Link>
          <span className="mt-1 block text-[15px] text-coal-800">{f.village} · {fiestaDates(f)}</span></li>)}</ul>
        <Link href={`/fiestas?concejo=${slug}`} className="mt-2 inline-flex min-h-11 items-center font-bold text-copper hover:underline">Todas las fiestas de {name}</Link>
      </aside> : null}
    </div>
  </div>;
}
