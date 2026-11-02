import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { spaceIsActive } from "@/lib/demo/municipal";
import { getMunicipalSpace, getMunicipalContents } from "@/lib/municipal-content";
import { getArticlesByConcejo } from "@/lib/cms";
import { visibleTowns } from "@/lib/demo/territories";
import { MunicipalPage } from "@/components/municipal-page";
import { getMunicipalIdentity } from "@/lib/demo/identities";
import { municipalMetadata } from "@/lib/seo";
import { contentSource } from "@/lib/content-source";

export function generateStaticParams() { return visibleTowns().map(t => ({ municipality: t.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ municipality: string }> }): Promise<Metadata> {
  const { municipality } = await params;
  const space = await getMunicipalSpace(municipality);
  if (!space) return { title: "Concejo" };
  // Indexing follows SITE_INDEXABLE (layout); share previews use the latest public image of the space.
  const contents = spaceIsActive(space) ? (await getMunicipalContents()).filter(c => c.space === space.id && c.status === "published") : [];
  const identity = getMunicipalIdentity(space.id);
  return municipalMetadata(space, contents, identity ? { url: identity.image, alt: identity.imageAlt } : undefined);
}
export default async function Page({ params }: { params: Promise<{ municipality: string }> }) {
  const { municipality } = await params;
  const space = await getMunicipalSpace(municipality);
  if (!space) notFound();
  return <MunicipalPage space={space} active={spaceIsActive(space)} contents={(await getMunicipalContents()).filter(c => c.space === space.id)} articles={await getArticlesByConcejo(space.territory)} demo={contentSource() === "demo"} />;
}
