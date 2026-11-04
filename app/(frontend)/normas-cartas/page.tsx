import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Normas de las cartas de los lectores", alternates: { canonical: "/normas-cartas" } };

// TEXTO PROVISIONAL: pendiente de revisión por el abogado de Planta 14.
export default function NormasCartas() {
  return <LegalPage title="Normas de las cartas de los lectores">
    <p data-provisional><strong>Texto provisional, pendiente de revisión jurídica.</strong></p>
    <h2>Quién puede escribir</h2>
    <p>Cualquier persona mayor de edad, con su nombre y apellidos reales. Pedimos DNI o NIE, teléfono y correo para comprobar la identidad; no se publican nunca. Se publican el nombre, los apellidos y el concejo.</p>
    <h2>Extensión y frecuencia</h2>
    <ul><li>Como máximo 2.000 caracteres.</li><li>Una carta al mes por persona.</li><li>Las cartas deben ser originales y dirigidas a Planta 14; no publicamos textos ya difundidos en otros medios ni cartas abiertas a terceros.</li></ul>
    <h2>Qué no publicamos</h2>
    <ul><li>Insultos, descalificaciones personales, contenido discriminatorio o que incite al odio o a la violencia.</li><li>Acusaciones sin fundamento contra personas identificables o datos personales de terceros.</li><li>Publicidad, propaganda electoral o textos firmados en nombre de partidos, empresas o instituciones.</li><li>Textos anónimos, con seudónimo o cuya autoría no se pueda comprobar.</li></ul>
    <h2>Edición</h2>
    <p>La redacción puede corregir erratas, extractar o acortar las cartas y ponerles título, sin cambiar su sentido. Si una carta no se publica, te lo diremos con el motivo.</p>
    <h2>Responsabilidad</h2>
    <p>Las cartas expresan la opinión de sus autores. Planta 14 no comparte necesariamente las opiniones de los lectores. Quien escribe responde de lo que firma.</p>
    <h2>Tus datos</h2>
    <p>El DNI y el teléfono se guardan cifrados, solo los ven la administración y el periodista responsable de tu concejo, y se borran a los 24 meses. Más información en la <Link href="/privacidad">política de privacidad</Link>.</p>
  </LegalPage>;
}
