import Link from "next/link";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

/** Página 404 de Planta 14: buscador y enlaces a la portada y a los concejos. */
export function NotFoundContent() {
  const towns = Object.values(territories).flat();
  return (
    <div className="container-p14 py-14" data-not-found>
      <p className="editorial-kicker">Error 404</p>
      <h1 className="mt-3 max-w-3xl font-serif text-5xl font-black leading-[1.05]">Esta página no está en Planta 14.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-coal-800">Puede que la dirección esté mal escrita o que la noticia ya no esté publicada. Busca lo que querías leer o vuelve a la portada.</p>
      <form action="/buscar" role="search" className="mt-8 flex max-w-2xl flex-wrap gap-3">
        <label className="sr-only" htmlFor="buscar-404">Buscar en Planta 14</label>
        <input id="buscar-404" name="q" maxLength={200} placeholder="Una historia, un lugar, una persona…" className="admin-input min-h-12 flex-1 text-base" />
        <button className="min-h-12 bg-coal-950 px-7 text-base font-bold text-white hover:bg-copper">Buscar</button>
      </form>
      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_2fr]">
        <div>
          <h2 className="font-serif text-2xl font-black">Volver</h2>
          <Link href="/" className="mt-3 inline-flex min-h-11 items-center text-lg font-bold text-copper hover:underline">Ir a la portada ↗</Link>
        </div>
        <nav aria-label="Concejos">
          <h2 className="font-serif text-2xl font-black">Los concejos del Caudal</h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
            {towns.map(town => <li key={town}><Link href={`/${slugify(town)}`} className="flex min-h-11 items-center border-b border-coal-900/15 text-base font-bold hover:text-copper">{town}</Link></li>)}
          </ul>
        </nav>
      </div>
    </div>
  );
}
