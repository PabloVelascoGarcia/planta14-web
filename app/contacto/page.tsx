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
          <h2 className="font-serif text-3xl font-black text-coal-950">Canales</h2>
          <p><strong>Redacción:</strong> redaccion@planta14.local</p>
          <p><strong>Agenda:</strong> agenda@planta14.local</p>
          <p><strong>Publicidad:</strong> publicidad@planta14.local</p>
        </section>
        <form className="grid gap-4 border-t-4 border-coal-950 bg-white/55 p-5">
          <label className="grid gap-2 text-sm font-bold">
            Nombre
            <input className="min-h-11 border border-coal-900/20 px-3 font-normal outline-none focus:border-copper" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Correo
            <input type="email" className="min-h-11 border border-coal-900/20 px-3 font-normal outline-none focus:border-copper" />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            Mensaje
            <textarea rows={6} className="border border-coal-900/20 px-3 py-2 font-normal outline-none focus:border-copper" />
          </label>
          <button className="min-h-11 bg-coal-950 px-5 text-sm font-black uppercase tracking-[0.14em] text-white hover:bg-copper">
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
