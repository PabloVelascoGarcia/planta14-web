import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lettersActive } from "@/lib/letters";
import { ConfirmLetter } from "./confirm-letter";

export const metadata: Metadata = { title: "Confirma tu carta", robots: { index: false, follow: false } };

export default async function ConfirmarCarta({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  if (!(await lettersActive())) notFound();
  const { t } = await searchParams;
  return <div className="container-p14 max-w-3xl py-12">
    <p className="editorial-kicker">Cartas de los lectores</p>
    <h1 className="mt-2 font-serif text-4xl font-black leading-tight">Confirma tu carta</h1>
    <p className="mt-4 text-lg leading-8">Pulsa el botón para confirmar que has enviado la carta desde este correo. Después llegará a la redacción.</p>
    <ConfirmLetter token={typeof t === "string" ? t : ""} />
  </div>;
}
