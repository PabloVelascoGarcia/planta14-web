import type { Metadata } from "next";
import { territories } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";
import { FiestaForm } from "./fiesta-form";

export const metadata: Metadata = { title: "Envía tu fiesta", description: "Comisiones de fiestas y asociaciones: envía a Planta 14 las fechas y el programa de tu fiesta.", alternates: { canonical: "/fiestas/enviar" } };

export default function EnviarFiestaPage() {
  const towns = Object.values(territories).flat().map(name => ({ slug: slugify(name), name }));
  return (
    <div className="container-p14 py-8">
      <header className="max-w-3xl border-b-2 border-coal-950 pb-5">
        <p className="editorial-kicker">Fiestas de las Cuencas</p>
        <h1 className="mt-2 font-serif text-5xl font-black leading-none">Envía tu fiesta</h1>
        <p className="mt-4 text-lg leading-7 text-coal-800">Para comisiones de fiestas y asociaciones. Te pediremos que confirmes tu correo y la redacción de Planta 14 la revisará antes de publicarla.</p>
      </header>
      <div className="mt-8"><FiestaForm towns={towns} /></div>
    </div>
  );
}
