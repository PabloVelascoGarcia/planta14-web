import type { Metadata } from "next";
import { AdSlot } from "@/components/ad-slot";

export const metadata: Metadata = {
  title: "Publicidad",
  description: "Formatos publicitarios de Planta 14 para marcas, comercios e instituciones locales."
};

export default function AdvertisingPage() {
  return (
    <div className="container-p14 py-8">
      <header className="max-w-3xl border-b-2 border-coal-950 pb-5">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-copper">Comercial</p>
        <h1 className="mt-2 font-serif text-5xl font-black leading-none">Publicidad</h1>
        <p className="mt-4 text-lg leading-7 text-coal-800">
          Planta 14 ofrece espacios para comercios, empresas e instituciones que quieren comunicarse con lectores de Caudal y Nalón.
        </p>
      </header>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <AdSlot label="Portada superior" />
        <AdSlot label="Robapáginas" tall />
        <AdSlot label="Patrocinio de sección" />
      </div>
      <section className="mt-10 max-w-3xl space-y-4 text-coal-800">
        <h2 className="font-serif text-3xl font-black text-coal-950">Formatos disponibles</h2>
        <p>Campañas por territorio, patrocinios de agenda, módulos en portada y presencia en boletín.</p>
        <p>Contacto comercial: publicidad@planta14.local</p>
      </section>
    </div>
  );
}
