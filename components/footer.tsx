import Link from "next/link";
import { CookieSettingsButton } from "./cookie-consent";
import { SubscribeForm } from "./subscribe-form";
import { contentSource } from "@/lib/content-source";

const TOWNS = [["Mieres", "mieres"], ["Lena", "lena"], ["Aller", "aller"], ["Morcín", "morcin"], ["Riosa", "riosa"], ["Ribera de Arriba", "ribera-de-arriba"]];
// Títulos de columna: gris claro sobre el negro del pie, contraste ≥ 7:1 (AA y AAA para texto pequeño en negrita).
const heading = "text-sm font-bold uppercase tracking-[0.18em] text-paper/80";
const link = "inline-flex min-h-11 items-center hover:text-white";

/**
 * Pie de la web: cuatro columnas (Planta 14 y su lema; Concejos; Participa y Proyecto; Boletín). En tableta, dos
 * columnas; en móvil, todo apilado con zonas táctiles de 44 px. El lema y el enlace de WhatsApp salen del CMS.
 */
export function Footer({ cookieSettings = false, motto = "Orgullo de historia. Mirada al futuro", whatsapp = null }: { cookieSettings?: boolean; motto?: string; whatsapp?: string | null }) {
  // Enlace y aviso de la demo solo con CONTENT_SOURCE=demo.
  const demo = contentSource() === "demo";
  return (
    <footer className="mt-16 bg-coal-950 text-paper" data-site-footer>
      <div className="container-p14 grid gap-8 py-10 md:grid-cols-2 lg:grid-cols-[1.1fr_0.8fr_1fr_1.4fr]">
        <div data-footer-col="planta14">
          <p className="font-serif text-4xl font-black">Planta 14</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-paper/80" data-motto="pie">{motto}</p>
          {demo ? <p className="mt-3">Textos e imágenes utilizados únicamente con fines de demostración. No se publican.</p> : null}
        </div>
        <nav aria-labelledby="pie-concejos" className="text-sm" data-footer-col="concejos">
          <p id="pie-concejos" className={heading}>Concejos</p>
          <ul className="mt-1 flex flex-col">{TOWNS.map(([name, slug]) => <li key={slug}><Link href={`/${slug}`} className={link}>{name}</Link></li>)}</ul>
        </nav>
        <div className="grid gap-6 text-sm" data-footer-col="participa">
          <nav aria-labelledby="pie-participa">
            <p id="pie-participa" className={heading}>Participa</p>
            <ul className="mt-1 flex flex-col">
              <li><Link href="/cartas/enviar" className={link}>Envía tu carta</Link></li>
              <li><Link href="/fiestas/enviar" className={link}>Envía tu fiesta</Link></li>
              {whatsapp ? <li><a href={whatsapp} className={link} target="_blank" rel="noopener noreferrer" data-footer-whatsapp>WhatsApp</a></li> : null}
            </ul>
          </nav>
          <nav aria-labelledby="pie-proyecto">
            <p id="pie-proyecto" className={heading}>Proyecto</p>
            <ul className="mt-1 flex flex-col">
              <li><Link href="/principios" className={link}>Principios editoriales</Link></li>
              <li><Link href="/publicidad" className={link}>Publicidad</Link></li>
              <li><Link href="/agenda" className={link}>Agenda</Link></li>
              <li><Link href="/util" className={link}>Útil</Link></li>
              <li><Link href="/contacto" className={link}>Contacto</Link></li>
            </ul>
            {demo ? <Link href="/aller/panel" className={link}>Demo municipal</Link> : null}
          </nav>
        </div>
        <div data-footer-newsletter data-footer-col="boletin">
          <p className={heading}>Boletín</p>
          <SubscribeForm source="pie" variant="compact" />
        </div>
      </div>
      <nav aria-label="Información legal" className="border-t border-paper/15">
        <div className="container-p14 flex flex-wrap items-center gap-x-6 py-3 text-[13px] text-paper/80">
          <span>Planta 14, medio editado por ASSA</span>
          <Link href="/aviso-legal" className={link}>Aviso legal</Link>
          <Link href="/privacidad" className={link}>Privacidad</Link>
          <Link href="/cookies" className={link}>Cookies</Link>
          <Link href="/condiciones-cuentas-municipales" className={link}>Condiciones de las cuentas municipales</Link>
          {cookieSettings ? <CookieSettingsButton /> : null}
        </div>
      </nav>
    </footer>
  );
}
