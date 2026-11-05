import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UtilListPage, type ListParams } from "@/components/util-list-page";
import { isUtilListType, UTIL_LIST_TYPES } from "@/lib/util";
import { townName, UTIL_TOWNS } from "@/lib/util-sources";

// «Ver todos» de un concejo: /lena/util/servicios, /lena/util/patrimonio, /lena/util/rutas, /lena/util/subvenciones y
// /lena/util/empleo. 404 si el concejo no tiene el espacio municipal activo o ha ocultado ese servicio.
type Params = { municipality: string; tipo: string };
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { municipality, tipo } = await params;
  if (!isUtilListType(tipo) || !UTIL_TOWNS.some(t => t.slug === municipality)) return { title: "Útil" };
  return { title: `${UTIL_LIST_TYPES[tipo]} de ${townName(municipality)} · Útil`, alternates: { canonical: `/${municipality}/util/${tipo}` } };
}
export default async function Page({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<ListParams> }) {
  const { municipality, tipo } = await params;
  if (!isUtilListType(tipo)) notFound();
  return <UtilListPage town={municipality} type={tipo} params={await searchParams} />;
}
