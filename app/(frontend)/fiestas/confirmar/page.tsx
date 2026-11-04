import type { Metadata } from "next";
import { ConfirmForm } from "./confirm-form";

export const metadata: Metadata = { title: "Confirma tu fiesta", robots: { index: false, follow: false } };

export default async function ConfirmarFiestaPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const token = typeof (await searchParams).t === "string" ? (await searchParams).t! : "";
  const { contentSource } = await import("@/lib/content-source");
  let fiesta: { name: string; confirmed: boolean } | null = null;
  if (token && contentSource() === "payload") {
    const { contentClient } = await import("@/lib/payload-content");
    const { hashToken } = await import("@/cms/festivals");
    const doc = (await (await contentClient()).find({ collection: "festivals", draft: true, overrideAccess: true, depth: 0, limit: 1, where: { "submission.tokenHash": { equals: hashToken(token) } } })).docs[0];
    if (doc) fiesta = { name: doc.name, confirmed: Boolean(doc.submission?.confirmed) };
  }
  return (
    <div className="container-p14 max-w-3xl py-12">
      <p className="editorial-kicker">Fiestas de las Cuencas</p>
      <h1 className="mt-2 font-serif text-4xl font-black leading-tight">Confirma tu fiesta</h1>
      {fiesta && !fiesta.confirmed ? <><p className="mt-4 text-lg leading-8">Pulsa el botón para confirmar que has enviado «{fiesta.name}». Después llegará a la redacción.</p><ConfirmForm token={token} name={fiesta.name} /></>
        : <p className="mt-4 text-lg leading-8">Este enlace ya se ha usado o no es válido. Si acabas de confirmar, la fiesta ya está en la redacción.</p>}
    </div>
  );
}
