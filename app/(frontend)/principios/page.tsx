import type { Metadata } from "next";
import { getPrinciples } from "@/lib/site-texts";

export const metadata: Metadata = {
  title: "Principios editoriales",
  description: "Cómo trabaja la redacción de Planta 14: independencia, separación entre información, opinión y publicidad, rectificaciones y cartas de los lectores.",
  alternates: { canonical: "/principios" },
};

/** Principios editoriales (ajuste global del CMS, solo administración). El aviso de texto provisional se quita desde el CMS. */
export default async function PrinciplesPage() {
  const { provisional, intro, sections } = await getPrinciples();
  return <article className="container-p14 legal-page" data-principles>
    <h1>Principios editoriales</h1>
    {provisional ? <p className="legal-review" role="note" data-principles-provisional>Texto provisional pendiente de revisión.</p> : null}
    {intro ? <p>{intro}</p> : null}
    {sections.map(section => <section key={section.heading}>
      <h2>{section.heading}</h2>
      {section.body.split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p.trim()}</p>)}
    </section>)}
  </article>;
}
