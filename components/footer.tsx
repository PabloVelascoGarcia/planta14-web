import Link from "next/link";
import { CookieSettingsButton } from "./cookie-consent";
import { contentSource } from "@/lib/content-source";

export function Footer({ cookieSettings = false }: { cookieSettings?: boolean }) {
  // Enlace y aviso de la demo solo con CONTENT_SOURCE=demo.
  const demo = contentSource() === "demo";
  return (
    <footer className="mt-16 bg-coal-950 text-paper">
      <div className="container-p14 grid gap-8 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <p className="font-serif text-4xl font-black">Planta 14</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-paper/75">
            Orgullo de historia. Mirada al futuro
          </p>
        </div>
        <div className="text-sm">
          <p className="font-bold uppercase tracking-[0.18em] text-paper/55">Proyecto</p>
          <div className="mt-1 flex flex-col">
            <Link href="/publicidad" className="inline-flex min-h-11 items-center hover:text-white">Publicidad</Link>
            <Link href="/contacto" className="inline-flex min-h-11 items-center hover:text-white">Contacto</Link>
            <Link href="/agenda" className="inline-flex min-h-11 items-center hover:text-white">Agenda</Link>
            {demo ? <Link href="/aller/panel" className="inline-flex min-h-11 items-center hover:text-white">Demo municipal</Link> : null}
          </div>
        </div>
        <div className="text-sm leading-6 text-paper/70">
          <p className="font-bold uppercase tracking-[0.18em] text-paper/55">Redacción</p>
          <p className="mt-3">El Caudal, Asturias.</p>
          {demo ? <p className="mt-3">Textos e imágenes utilizados únicamente con fines de demostración. No se publican.</p> : null}
        </div>
      </div>
      <nav aria-label="Información legal" className="border-t border-paper/15">
        <div className="container-p14 flex flex-wrap items-center gap-x-6 py-3 text-[13px] text-paper/70">
          <span>Planta 14, medio editado por ASSA</span>
          <Link href="/aviso-legal" className="inline-flex min-h-11 items-center hover:text-white">Aviso legal</Link>
          <Link href="/privacidad" className="inline-flex min-h-11 items-center hover:text-white">Privacidad</Link>
          <Link href="/cookies" className="inline-flex min-h-11 items-center hover:text-white">Cookies</Link>
          <Link href="/condiciones-cuentas-municipales" className="inline-flex min-h-11 items-center hover:text-white">Condiciones de las cuentas municipales</Link>
          {cookieSettings ? <CookieSettingsButton /> : null}
        </div>
      </nav>
    </footer>
  );
}
