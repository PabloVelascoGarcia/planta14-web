import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatsScope } from "@/components/stats-beacon";
import { UtilPlace } from "@/components/util-place";
import { getPlace, photoOf, utilShownInTown } from "@/lib/util";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = await getPlace("routes", (await params).slug);
  return doc && typeof doc.town === "object" && doc.town && await utilShownInTown(doc.town.slug, "rutas") ? { title: `${doc.name} · Rutas`, description: doc.description?.slice(0, 160) || undefined, alternates: { canonical: `/util/rutas/${doc.slug}` } } : { title: "Rutas" };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const doc = await getPlace("routes", (await params).slug);
  if (!doc) notFound();
  const town = typeof doc.town === "object" && doc.town ? doc.town.slug : "";
  // Solo si su concejo tiene el espacio municipal activo y no ha ocultado «rutas».
  if (!(await utilShownInTown(town, "rutas"))) notFound();
  return <><StatsScope town={town} section="util" /><UtilPlace doc={doc} kind="rutas" photo={await photoOf((doc as { image?: unknown }).image)} /></>;
}
