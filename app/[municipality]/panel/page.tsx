import { notFound } from "next/navigation";
import { getMunicipalSpace, spaceIsActive } from "@/lib/demo/municipal";
import { MunicipalPanel } from "@/components/municipal-panel";
export const metadata = { title: "Panel municipal · Demostración", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ municipality: string }> }) {
  const { municipality } = await params;
  const space = getMunicipalSpace(municipality);
  if (!space || !spaceIsActive(space)) notFound();
  return <MunicipalPanel space={space} />;
}
