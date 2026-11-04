import type { Metadata } from "next";
import Link from "next/link";
import { FiestaList } from "@/components/fiesta-list";
import { getFiestas, madridToday, monthLabel, overlaps, upcoming, weekend } from "@/lib/fiestas";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Fiestas de las Cuencas",
  description: "Fiestas de prao, patronales y de barrio en Mieres, Lena, Aller, Morcín, Riosa y Ribera de Arriba: este fin de semana y calendario por meses.",
  alternates: { canonical: "/fiestas" },
};

export default async function FiestasPage({ searchParams }: { searchParams: Promise<{ concejo?: string }> }) {
  const { concejo = "" } = await searchParams;
  const towns = Object.values(territories).flat();
  const selected = towns.find(t => slugify(t) === concejo);
  const all = (await getFiestas()).filter(f => !selected || f.townSlug === slugify(selected));
  const today = madridToday();
  const { from, to } = weekend(today);
  const thisWeekend = all.filter(f => overlaps(f, from, to) && f.endDay >= today);
  const next = upcoming(all, today).filter(f => !thisWeekend.includes(f));
  const months = [...new Set(next.map(f => f.startDay.slice(0, 7)))];
  return (
    <div className="container-p14 py-8">
      <header className="max-w-3xl border-b-2 border-coal-950 pb-5">
        <p className="editorial-kicker">Qué hacer</p>
        <h1 className="mt-2 font-serif text-5xl font-black leading-none">Fiestas de las Cuencas</h1>
        <p className="mt-4 text-lg leading-7 text-coal-800">Fiestas de prao, patronales y de barrio de los seis concejos del Caudal.</p>
        <p className="mt-4"><Link href="/fiestas/enviar" className="inline-flex min-h-11 items-center font-bold text-copper hover:underline">¿Organizas una fiesta? Envíanosla ↗</Link></p>
      </header>
      <nav aria-label="Filtrar por concejo" className="mt-6 flex flex-wrap gap-2" data-fiesta-filter>
        <Link href="/fiestas" aria-current={!selected ? "page" : undefined} className={`inline-flex min-h-11 items-center border px-4 text-[15px] font-bold ${!selected ? "border-coal-950 bg-coal-950 text-white" : "border-coal-900/25 hover:border-copper"}`}>Todos los concejos</Link>
        {towns.map(t => <Link key={t} href={`/fiestas?concejo=${slugify(t)}`} aria-current={selected === t ? "page" : undefined} className={`inline-flex min-h-11 items-center border px-4 text-[15px] font-bold ${selected === t ? "border-coal-950 bg-coal-950 text-white" : "border-coal-900/25 hover:border-copper"}`}>{t}</Link>)}
      </nav>
      <section className="mt-10" aria-labelledby="este-fin-de-semana" data-fiestas-weekend>
        <h2 id="este-fin-de-semana" className="font-serif text-3xl font-black">Este fin de semana</h2>
        {thisWeekend.length ? <div className="mt-4"><FiestaList fiestas={thisWeekend} /></div> : <p className="mt-3 text-coal-800">No tenemos fiestas este fin de semana{selected ? ` en ${selected}` : ""}.</p>}
      </section>
      <section className="mt-12" aria-labelledby="calendario" data-fiestas-calendar>
        <h2 id="calendario" className="font-serif text-3xl font-black">Calendario</h2>
        {months.length ? months.map(month => (
          <div key={month} className="mt-6">
            <h3 className="text-[13px] font-black uppercase tracking-[0.16em] text-steel" data-month={month}>{monthLabel(`${month}-01`)}</h3>
            <div className="mt-2"><FiestaList fiestas={next.filter(f => f.startDay.startsWith(month))} /></div>
          </div>
        )) : <p className="mt-3 text-coal-800">Aún no hay más fiestas en el calendario{selected ? ` de ${selected}` : ""}.</p>}
      </section>
    </div>
  );
}
