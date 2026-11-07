import type { Metadata } from "next";
import Link from "next/link";
import { StatsScope } from "@/components/stats-beacon";
import { FireStrip, UtilBlocks, UtilTownRows, WeatherStrip } from "@/components/util-blocks";
import { getUtilData, utilCounts } from "@/lib/util";
import { UTIL_TOWNS } from "@/lib/util-sources";

export const metadata: Metadata = {
  title: "Útil: carreteras, tiempo, farmacias, ayudas y empleo",
  description: "Puertos de Pajares y San Isidro, estaciones de esquí, el tiempo, farmacias de guardia, subvenciones abiertas, empleo público, patrimonio y rutas de Mieres, Lena, Aller, Morcín, Riosa y Ribera de Arriba.",
  alternates: { canonical: "/util" },
};

export default async function UtilPage() {
  const data = await getUtilData(null);
  // Cada concejo activo: una fila de accesos con los mismos números que sus páginas «Ver todos».
  const towns = await Promise.all(UTIL_TOWNS.filter(t => data.activeTowns.includes(t.slug)).map(async t => ({ slug: t.slug, name: t.name, counts: utilCounts(await getUtilData(t.slug)) })));
  return <div className="container-p14 py-8 util-page" data-util-page>
    <StatsScope town="" section="util" />
    <header className="max-w-3xl border-b-2 border-coal-950 pb-5">
      <p className="editorial-kicker">Servicio</p>
      <h1 className="mt-2 font-serif text-5xl font-black leading-none">Útil</h1>
      <p className="mt-4 text-lg leading-7 text-coal-800">Lo práctico de las Cuencas en un sitio: carreteras y puertos, el tiempo, farmacias, ayudas, empleo público, patrimonio y rutas. Cada dato lleva su fuente y la hora a la que se actualizó.</p>
    </header>
    <WeatherStrip data={data} />
    <FireStrip data={data} />
    <nav aria-label="Útil por concejo" className="mt-6 flex flex-wrap gap-2">
      {/* Concejo activo: su «Útil»; inactivo: su página (nunca #util, que no tiene). */}
      {UTIL_TOWNS.map(t => <Link key={t.slug} href={data.activeTowns.includes(t.slug) ? `/${t.slug}/util` : `/${t.slug}`} className="inline-flex min-h-11 items-center border border-coal-900/25 px-4 text-[15px] font-bold hover:border-copper">{t.name}</Link>)}
    </nav>
    <div className="mt-8"><UtilBlocks data={data} /></div>
    <UtilTownRows towns={towns} />
  </div>;
}
