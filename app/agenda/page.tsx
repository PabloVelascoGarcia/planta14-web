import type { Metadata } from "next";
import { AgendaList } from "@/components/agenda-list";
import { AdSlot } from "@/components/ad-slot";

export const metadata: Metadata = {
  title: "Agenda",
  description: "Actividades culturales, sociales y vecinales en Caudal y Nalón."
};

export default function AgendaPage() {
  return (
    <div className="container-p14 grid gap-10 py-8 lg:grid-cols-[minmax(0,760px)_300px]">
      <section>
        <header className="border-b-2 border-coal-950 pb-5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-copper">Qué hacer</p>
          <h1 className="mt-2 font-serif text-5xl font-black leading-none">Agenda</h1>
          <p className="mt-4 text-lg leading-7 text-coal-800">
            Actividad cultural, social, deportiva y vecinal en las cuencas.
          </p>
        </header>
        <div className="mt-8">
          <AgendaList />
        </div>
      </section>
      <AdSlot tall />
    </div>
  );
}
