import type { Metadata } from "next";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";
import { LetterForm } from "./letter-form";

export const metadata: Metadata = { title: "Escribe una carta", description: "Envía a Planta 14 tu carta de los lectores.", alternates: { canonical: "/cartas/enviar" } };

export default function EnviarCartaPage() {
  const towns = Object.values(territories).flat().map(name => ({ slug: slugify(name), name }));
  return <div className="container-p14 py-8">
    <header className="max-w-3xl border-b-2 border-coal-950 pb-5">
      <p className="editorial-kicker">Opinión</p>
      <h1 className="mt-2 font-serif text-5xl font-black leading-none">Escribe una carta</h1>
      <p className="mt-4 text-lg leading-7 text-coal-800">Hasta 2.000 caracteres, una al mes. Antes de publicarla, la redacción comprueba que es tuya y que cumple las normas.</p>
    </header>
    <div className="mt-8"><LetterForm towns={towns} /></div>
  </div>;
}
