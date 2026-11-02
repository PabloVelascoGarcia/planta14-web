import type { ReactNode } from "react";
import { legalVersionDate } from "@/lib/legal";

/** Common frame of the legal pages: visible "pending legal review" notice and version date. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <article className="container-p14 legal-page">
    <h1>{title}</h1>
    <p className="legal-review" role="note">Texto pendiente de revisión por abogado. No es la versión definitiva; los datos entre corchetes están pendientes.</p>
    <p className="legal-meta">Última actualización: {legalVersionDate}.</p>
    {children}
  </article>;
}
