import { notFound } from "next/navigation";
import { spaceIsActive } from "@/lib/demo/municipal";
import { getMunicipalSpace } from "@/lib/municipal-content";
import { contentSource } from "@/lib/content-source";
import { MunicipalPanel } from "@/components/municipal-panel";
import { MunicipalCmsPanel } from "@/components/municipal-cms-panel";
export function generateMetadata() {
  return { title: contentSource() === "demo" ? "Panel municipal · Demostración" : "Panel municipal", robots: { index: false, follow: false } };
}
export default async function Page({ params, searchParams }: { params: Promise<{ municipality: string }>; searchParams: Promise<{ pestana?: string }> }) {
  const { municipality } = await params;
  const { pestana } = await searchParams;
  const space = await getMunicipalSpace(municipality);
  if (!space || !spaceIsActive(space)) notFound();
  // Demo source: the existing browser-only simulation, unchanged.
  if (contentSource() === "demo") return <MunicipalPanel space={space} />;
  const { municipalPanelState } = await import("@/lib/municipal-panel");
  const { MAINTENANCE_MESSAGE, maintenanceActive } = await import("@/cms/maintenance");
  return <MunicipalCmsPanel space={space} state={await municipalPanelState(space.id)} maintenance={maintenanceActive() ? MAINTENANCE_MESSAGE : null} initialTab={typeof pestana === "string" ? pestana : "publicar"} />;
}
