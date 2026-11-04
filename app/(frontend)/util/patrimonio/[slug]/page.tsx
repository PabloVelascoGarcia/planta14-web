import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatsScope } from "@/components/stats-beacon";
import { UtilPlace } from "@/components/util-place";
import { getPlace, photoOf } from "@/lib/util";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = await getPlace("heritage", (await params).slug);
  return doc ? { title: `${doc.name} · Patrimonio`, description: doc.description?.slice(0, 160) || undefined, alternates: { canonical: `/util/patrimonio/${doc.slug}` } } : { title: "Patrimonio" };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const doc = await getPlace("heritage", (await params).slug);
  if (!doc) notFound();
  const town = typeof doc.town === "object" && doc.town ? doc.town.slug : "";
  return <><StatsScope town={town} section="util" /><UtilPlace doc={doc} kind="patrimonio" photo={await photoOf((doc as { image?: unknown }).image)} /></>;
}
