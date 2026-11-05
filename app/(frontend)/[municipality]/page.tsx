import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { spaceIsActive } from "@/lib/demo/municipal";
import { getMunicipalSpace, getMunicipalContents } from "@/lib/municipal-content";
import { getArticlesByConcejo } from "@/lib/cms";
import { visibleTowns } from "@/lib/demo/territories";
import { MunicipalPage } from "@/components/municipal-page";
import { municipalMetadata } from "@/lib/seo";
import { contentSource } from "@/lib/content-source";
import { fiestasDaysBefore, getFiestas, madridToday, thisWeek } from "@/lib/fiestas";
import { StatsScope } from "@/components/stats-beacon";
import { UtilBlocks } from "@/components/util-blocks";
import { getUtilData } from "@/lib/util";

export function generateStaticParams() { return visibleTowns().map(t => ({ municipality: t.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ municipality: string }> }): Promise<Metadata> {
  const { municipality } = await params;
  const space = await getMunicipalSpace(municipality);
  if (!space) return { title: "Concejo" };
  // Indexing follows SITE_INDEXABLE (layout); share previews use the latest public image of the space.
  const contents = spaceIsActive(space) ? (await getMunicipalContents()).filter(c => c.space === space.id && c.status === "published") : [];
  const identity = space.identity;
  return municipalMetadata(space, contents, identity?.image ? { url: identity.image, alt: identity.imageAlt ?? "" } : undefined);
}
export default async function Page({ params }: { params: Promise<{ municipality: string }> }) {
  const { municipality } = await params;
  const space = await getMunicipalSpace(municipality);
  if (!space) notFound();
  const demo = contentSource() === "demo";
  // With real content the server drops expired items (Madrid date); the demo keeps its client-side behaviour.
  // PLANTA14_TEST_TODAY (AAAA-MM-DD) only for tests that compare with the demo's fixed date.
  const today = process.env.PLANTA14_TEST_TODAY || new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  // Concejo sin espacio municipal activo: solo la cabecera, las noticias de Planta 14 de ese concejo y «Fiestas esta
  // semana» (las fiestas son contenido editorial). Nada de avisos, agenda municipal, tablón, sugerencias ni «Útil».
  const active = spaceIsActive(space);
  const contents = active ? (await getMunicipalContents()).filter(c => c.space === space.id && (demo || !c.expiresAt || c.expiresAt >= today)) : [];
  const [allFiestas, daysBefore] = await Promise.all([getFiestas(), fiestasDaysBefore()]);
  const fiestas = thisWeek(allFiestas.filter(f => f.townSlug === space.territory), madridToday(), daysBefore).slice(0, 5);
  // «Útil» solo con contenido real (las fuentes automáticas usan la caché de la base de datos) y con el espacio activo.
  const util = demo || !active ? null : <UtilBlocks data={await getUtilData(space.territory)} />;
  return <><StatsScope town={space.territory} section="concejo" /><MunicipalPage space={space} active={active} contents={contents} articles={await getArticlesByConcejo(space.territory)} fiestas={fiestas} demo={demo} util={util} /></>;
}
