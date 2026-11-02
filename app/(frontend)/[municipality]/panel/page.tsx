import { notFound } from "next/navigation";
import { spaceIsActive } from "@/lib/demo/municipal";
import { getMunicipalSpace } from "@/lib/municipal-content";
import { contentSource } from "@/lib/content-source";
import { MunicipalPanel } from "@/components/municipal-panel";
import { MunicipalCmsPanel } from "@/components/municipal-cms-panel";
export function generateMetadata() {
  return { title: contentSource() === "demo" ? "Panel municipal · Demostración" : "Panel municipal", robots: { index: false, follow: false } };
}
export default async function Page({ params }: { params: Promise<{ municipality: string }> }) {
  const { municipality } = await params;
  const space = await getMunicipalSpace(municipality);
  if (!space || !spaceIsActive(space)) notFound();
  // Demo source: the existing browser-only simulation, unchanged.
  if (contentSource() === "demo") return <MunicipalPanel space={space} />;
  const { municipalPanelState } = await import("@/lib/municipal-panel");
  return <MunicipalCmsPanel space={space} state={await municipalPanelState(space.id)} />;
}
