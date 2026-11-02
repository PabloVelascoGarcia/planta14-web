import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { spaceIsActive } from "@/lib/demo/municipal";
import { getMunicipalSpace, getMunicipalContents } from "@/lib/municipal-content";
import { getArticlesByConcejo } from "@/lib/cms";
import { visibleTowns } from "@/lib/demo/territories";
import { MunicipalPage } from "@/components/municipal-page";

export function generateStaticParams() { return visibleTowns().map(t => ({ municipality: t.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ municipality: string }> }): Promise<Metadata> {
  const { municipality } = await params;
  const space = await getMunicipalSpace(municipality);
  return { title: space ? `${space.name} · Espacio municipal` : "Concejo", robots: { index: false, follow: false } };
}
export default async function Page({ params }: { params: Promise<{ municipality: string }> }) {
  const { municipality } = await params;
  const space = await getMunicipalSpace(municipality);
  if (!space) notFound();
  return <MunicipalPage space={space} active={spaceIsActive(space)} contents={(await getMunicipalContents()).filter(c => c.space === space.id)} articles={await getArticlesByConcejo(space.territory)} />;
}
