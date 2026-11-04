import Link from "next/link";
import type { Fiesta } from "@/lib/fiestas";
import { fiestaDates } from "@/lib/fiestas";

/** Lista de fiestas en texto (sin carteles): nombre, pueblo, concejo y fechas. */
export function FiestaList({ fiestas, showTown = true }: { fiestas: Fiesta[]; showTown?: boolean }) {
  return (
    <ul className="divide-y divide-coal-900/15 border-y border-coal-900/15" data-fiesta-list>
      {fiestas.map(f => (
        <li key={f.slug} className="grid gap-1 py-4 sm:grid-cols-[190px_1fr] sm:gap-4">
          <span className="text-[13px] font-black uppercase tracking-[0.12em] text-copper">{fiestaDates(f)}</span>
          <span>
            <Link href={`/fiestas/${f.slug}`} className="font-serif text-xl font-black leading-tight hover:text-copper">{f.name}</Link>
            <span className="mt-1 block text-[15px] text-coal-800">{showTown ? `${f.village} · ${f.town}` : f.village}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
