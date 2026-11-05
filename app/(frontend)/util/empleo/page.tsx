import type { Metadata } from "next";
import { UtilListPage, type ListParams } from "@/components/util-list-page";

// «Ver todas» de lo general (Principado, IDEPA y Estado); lo de cada ayuntamiento está en /[concejo]/util/empleo.
export const metadata: Metadata = { title: "Empleo público en las Cuencas · Útil", alternates: { canonical: "/util/empleo" } };
export default async function Page({ searchParams }: { searchParams: Promise<ListParams> }) {
  return <UtilListPage town={null} type="empleo" params={await searchParams} />;
}
