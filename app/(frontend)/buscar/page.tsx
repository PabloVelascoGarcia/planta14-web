import type { Metadata } from "next";
import { ArticleCard } from "@/components/article-card";
import { getArticles } from "@/lib/cms";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Buscar", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; concejo?: string }> }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const concejo = typeof params.concejo === "string" ? params.concejo : "";
  const words = slugify(query).split("-").filter(Boolean);
  const results = (await getArticles()).filter(article => {
    const text = slugify([article.title, article.excerpt, article.concejo, article.topic, article.author, ...article.body].join(" "));
    return words.every(word => text.includes(word)) && (!concejo || slugify(article.concejo) === concejo);
  });
  return <div className="container-p14 py-10">
    <p className="editorial-kicker">Explora tu territorio</p>
    <h1 className="mt-3 font-serif text-5xl font-bold">¿Qué quieres descubrir?</h1>
    <form action="/buscar" role="search" className="search-form">
      <label className="grid gap-2 text-sm font-bold">Palabras clave<input name="q" defaultValue={query} maxLength={200} placeholder="Una historia, una empresa, un lugar…" className="admin-input" /></label>
      <label className="grid gap-2 text-sm font-bold">Concejo<select name="concejo" defaultValue={concejo} className="admin-input"><option value="">Todos los concejos</option>{Object.entries(territories).map(([comarca, towns]) => <optgroup key={comarca} label={comarca}>{towns.map(town => <option key={town} value={slugify(town)}>{town}</option>)}</optgroup>)}</select></label>
      <button className="bg-coal-950 px-7 py-3 text-sm font-bold text-white hover:bg-copper">Buscar</button>
    </form>
    <p className="my-7 text-sm text-steel" role="status">{results.length} {results.length === 1 ? "noticia" : "noticias"}{query ? ` para «${query}»` : ""}</p>
    {results.length ? <div className="grid gap-x-7 gap-y-10 md:grid-cols-2 lg:grid-cols-3">{results.map(article => <ArticleCard key={article.slug} article={article} />)}</div> : <div className="border-y border-coal-900/20 py-12"><h2 className="font-serif text-3xl">No hemos encontrado esa historia.</h2><p className="mt-3">Prueba con otras palabras o selecciona todos los concejos.</p></div>}
  </div>;
}
