import type { Metadata } from "next";
import Link from "next/link";
import { StatsScope } from "@/components/stats-beacon";
import { getPlaces } from "@/lib/util";
import { Thumb } from "@/components/util-blocks";
import { UTIL_TOWNS } from "@/lib/util-sources";

export const metadata: Metadata = { title: "Patrimonio de las Cuencas", alternates: { canonical: "/util/patrimonio" } };

export default async function Page({ searchParams }: { searchParams: Promise<{ concejo?: string }> }) {
  const { concejo = "" } = await searchParams;
  const town = UTIL_TOWNS.find(t => t.slug === concejo)?.slug ?? null;
  const list = await getPlaces("heritage", town);
  return <div className="container-p14 py-8 util-page">
    <StatsScope town={town ?? ""} section="util" />
    <header className="max-w-3xl border-b-2 border-coal-950 pb-5"><p className="editorial-kicker"><Link href="/util">Útil</Link></p>
      <h1 className="mt-2 font-serif text-5xl font-black leading-none">Patrimonio</h1></header>
    <nav aria-label="Filtrar por concejo" className="mt-6 flex flex-wrap gap-2">
      <Link href="/util/patrimonio" aria-current={!town ? "page" : undefined} className="inline-flex min-h-11 items-center border border-coal-900/25 px-4 text-[15px] font-bold hover:border-copper">Todos</Link>
      {UTIL_TOWNS.map(t => <Link key={t.slug} href={`/util/patrimonio?concejo=${t.slug}`} aria-current={town === t.slug ? "page" : undefined} className="inline-flex min-h-11 items-center border border-coal-900/25 px-4 text-[15px] font-bold hover:border-copper">{t.name}</Link>)}
    </nav>
    {list.length ? <ul className="util-places mt-8" data-util-list="patrimonio">{list.map(p => <li key={p.slug}><Thumb photo={p.photo} /><Link href={`/util/patrimonio/${p.slug}`}><strong>{p.name}</strong><small>{[p.townName, p.detail].filter(Boolean).join(" · ")}</small>{p.summary ? <span>{p.summary}</span> : null}</Link></li>)}</ul>
      : <p className="mt-8">Todavía no hay fichas{town ? " en este concejo" : ""}.</p>}
  </div>;
}
