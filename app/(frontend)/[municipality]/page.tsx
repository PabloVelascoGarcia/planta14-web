import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { spaceIsActive } from "@/lib/demo/municipal";
import { getMunicipalSpace, getMunicipalContents } from "@/lib/municipal-content";
import { getArticlesByConcejo } from "@/lib/cms";
import { visibleTowns } from "@/lib/demo/territories";
import { MunicipalPage } from "@/components/municipal-page";
import { municipalMetadata } from "@/lib/seo";
import { contentSource } from "@/lib/content-source";
import { getFiestas, upcoming } from "@/lib/fiestas";
import { StatsScope } from "@/components/stats-beacon";

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
  const contents = (await getMunicipalContents()).filter(c => c.space === space.id && (demo || !c.expiresAt || c.expiresAt >= today));
  const fiestas = upcoming(await getFiestas()).filter(f => f.townSlug === space.territory).slice(0, 5);
  return <><StatsScope town={space.territory} section="concejo" /><MunicipalPage space={space} active={spaceIsActive(space)} contents={contents} articles={await getArticlesByConcejo(space.territory)} fiestas={fiestas} demo={demo} /></>;
}
