import type { Metadata } from "next";
import { TokenForm } from "../token-form";
import { unsubscribe } from "../actions";

export const metadata: Metadata = { title: "Darse de baja del boletín", robots: { index: false, follow: false } };

export default async function BajaBoletin({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return <div className="container-p14 max-w-3xl py-12">
    <p className="editorial-kicker">Boletín de Planta 14</p>
    <h1 className="mt-2 font-serif text-4xl font-black leading-tight">Darte de baja</h1>
    <p className="mt-4 text-lg leading-8">Un clic y dejarás de recibir el boletín. Puedes volver a apuntarte cuando quieras.</p>
    <TokenForm token={typeof t === "string" ? t : ""} label="Darme de baja" action={unsubscribe} />
  </div>;
}
