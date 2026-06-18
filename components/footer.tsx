import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 bg-coal-950 text-paper">
      <div className="container-p14 grid gap-8 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <p className="font-serif text-4xl font-black">Planta 14</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-paper/75">
            Periodismo local para leer las cuencas desde sus concejos, sus barrios y sus pueblos.
          </p>
        </div>
        <div className="text-sm">
          <p className="font-bold uppercase tracking-[0.18em] text-paper/55">Proyecto</p>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/publicidad" className="hover:text-white">Publicidad</Link>
            <Link href="/contacto" className="hover:text-white">Contacto</Link>
            <Link href="/agenda" className="hover:text-white">Agenda</Link>
            <Link href="/admin" className="hover:text-white">Administración</Link>
          </div>
        </div>
        <div className="text-sm leading-6 text-paper/70">
          <p className="font-bold uppercase tracking-[0.18em] text-paper/55">Redacción</p>
          <p className="mt-3">Caudal y Nalón, Asturias.</p>
          <p>redaccion@planta14.local</p>
        </div>
      </div>
    </footer>
  );
}
