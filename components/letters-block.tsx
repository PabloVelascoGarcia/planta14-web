import Link from "next/link";
import type { Letter } from "@/lib/letters";
import { LETTERS_DISCLAIMER } from "@/lib/letters";
import { formatDate } from "@/lib/utils";

/** «Cartas de los lectores» (Opinión y /cartas): nombre, apellidos y concejo; nunca otros datos. */
export function LettersBlock({ letters, heading = "h2", more = false }: { letters: Letter[]; heading?: "h1" | "h2"; more?: boolean }) {
  const Title = heading;
  return (
    <section className="mt-10" aria-labelledby="cartas-lectores" data-letters>
      <div className="border-t-4 border-coal-950 pt-4">
        <Title id="cartas-lectores" className="font-serif text-3xl font-black">Cartas de los lectores</Title>
        <p className="mt-2 text-[15px] italic text-steel" data-letters-disclaimer>{LETTERS_DISCLAIMER}</p>
        <p className="mt-2"><Link href="/cartas/enviar" className="inline-flex min-h-11 items-center font-bold text-copper hover:underline">Escribe una carta ↗</Link> <Link href="/normas-cartas" className="ml-4 inline-flex min-h-11 items-center text-[15px] underline">Normas</Link></p>
      </div>
      {letters.length ? <div className="mt-4 divide-y divide-coal-900/15">{letters.map(letter => (
        <article key={letter.id} className="py-6" data-letter={letter.id}>
          {letter.title ? <h3 className="font-serif text-2xl font-black leading-tight">{letter.title}</h3> : null}
          <div className="mt-3 space-y-4 font-serif text-lg leading-8 text-coal-900">{letter.text.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
          <p className="mt-3 text-[15px] font-bold text-coal-800">{letter.name} · {letter.town} <span className="font-normal text-steel">· {formatDate(letter.publishedAt.slice(0, 10))}</span></p>
        </article>
      ))}</div> : <p className="mt-4 text-coal-800">Todavía no hay cartas publicadas.</p>}
      {more && letters.length ? <p><Link href="/cartas" className="inline-flex min-h-11 items-center font-bold text-copper hover:underline">Todas las cartas ↗</Link></p> : null}
    </section>
  );
}
