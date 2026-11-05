import type { Metadata } from "next";
import { UtilListPage, type ListParams } from "@/components/util-list-page";

// «Ver todas» de lo general (Principado, IDEPA y Estado); lo de cada ayuntamiento está en /[concejo]/util/subvenciones.
export const metadata: Metadata = { title: "Subvenciones abiertas en las Cuencas · Útil", alternates: { canonical: "/util/subvenciones" } };
export default async function Page({ searchParams }: { searchParams: Promise<ListParams> }) {
  return <UtilListPage town={null} type="subvenciones" params={await searchParams} />;
}
