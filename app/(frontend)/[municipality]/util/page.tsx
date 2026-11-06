import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MunicipalMasthead } from "@/components/municipal-masthead";
import { StatsScope } from "@/components/stats-beacon";
import { UtilBlocks } from "@/components/util-blocks";
import { contentSource } from "@/lib/content-source";
import { sections, spaceIsActive } from "@/lib/demo/municipal";
import { getMunicipalSpace } from "@/lib/municipal-content";
import { hasTheme, identityStyle } from "@/lib/municipal-identity";
import { getUtilData } from "@/lib/util";
import { townName } from "@/lib/util-sources";

// «Útil» de un concejo con espacio municipal activo: el tiempo, puertos, farmacias, servicios, patrimonio, rutas, ayudas
// y empleo, con las cajas y los «Ver todos». Dentro del espacio municipal (su cabecera, identidad y pestañas). Un
// concejo inactivo da 404 (su página es la del periódico).
type Params = { municipality: string };
async function activeSpace(slug: string) {
  if (contentSource() !== "payload") return null;
  const space = await getMunicipalSpace(slug);
  return space && spaceIsActive(space) ? space : null;
}
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { municipality } = await params;
  const space = await activeSpace(municipality);
  return space ? { title: `Útil en ${townName(space.territory)}`, description: `El tiempo, farmacias, servicios municipales, patrimonio, rutas, ayudas y empleo de ${townName(space.territory)}.`, alternates: { canonical: `/${space.id}/util` } } : { title: "Útil" };
}
export default async function TownUtilPage({ params }: { params: Promise<Params> }) {
  const { municipality } = await params;
  const space = await activeSpace(municipality);
  if (!space) notFound();
  const identity = space.identity;
  const name = townName(space.territory);
  return <div className={`municipal-shell ${hasTheme(identity) ? "aller-theme" : ""}`} style={identityStyle(identity)} data-municipal-util-page={space.id}>
    <StatsScope town={space.territory} section="util" />
    <MunicipalMasthead space={space} />
    <nav className="municipal-section-nav" aria-label="Secciones municipales"><div className="container-p14">
      {sections.map(s => <Link key={s.id} href={s.id === "news" ? `/${space.id}` : `/${space.id}?seccion=${s.id}`}>{s.label}</Link>)}
      <Link href={`/${space.id}/util`} aria-current="page">Útil</Link>
    </div></nav>
    <div className="container-p14 municipal-page-body">
      <div className="municipal-section-heading"><div><p className="municipal-kicker">Servicio</p><h2>Útil en {name}</h2></div><Link href="/util" aria-label="Útil en todas las Cuencas">↗</Link></div>
      <div className="mt-6"><UtilBlocks data={await getUtilData(space.territory)} /></div>
    </div>
  </div>;
}
