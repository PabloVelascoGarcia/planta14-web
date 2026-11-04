import type { Metadata } from "next";
import { TokenForm } from "../token-form";
import { confirmSubscription } from "../actions";

export const metadata: Metadata = { title: "Confirma tu suscripción", robots: { index: false, follow: false } };

export default async function ConfirmarBoletin({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return <div className="container-p14 max-w-3xl py-12">
    <p className="editorial-kicker">Boletín de Planta 14</p>
    <h1 className="mt-2 font-serif text-4xl font-black leading-tight">Confirma tu suscripción</h1>
    <p className="mt-4 text-lg leading-8">Pulsa el botón para confirmar que quieres recibir el boletín en este correo.</p>
    <TokenForm token={typeof t === "string" ? t : ""} label="Confirmar la suscripción" action={confirmSubscription} />
  </div>;
}
