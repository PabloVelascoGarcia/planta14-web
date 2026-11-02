import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contacto con la redacción de Planta 14."
};

export default function ContactPage() {
  return (
    <div className="container-p14 py-8">
      <header className="max-w-3xl border-b-2 border-coal-950 pb-5">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-copper">Redacción</p>
        <h1 className="mt-2 font-serif text-5xl font-black leading-none">Contacto</h1>
        <p className="mt-4 text-lg leading-7 text-coal-800">
          Escríbenos para enviar noticias, convocatorias, rectificaciones o propuestas de colaboración.
        </p>
      </header>
      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_1fr]">
        <section className="space-y-3 text-coal-800">
          <h2 className="font-serif text-3xl font-black text-coal-950">Una redacción cerca de ti</h2>
          <p>Noticias, historias locales, convocatorias y propuestas de colaboración.</p>
          <p>Los canales de contacto estarán disponibles con el lanzamiento de Planta 14. Esta edición de demostración no recoge mensajes ni datos personales.</p>
        </section>
      </div>
    </div>
  );
}
