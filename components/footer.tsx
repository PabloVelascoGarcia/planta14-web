import Link from "next/link";
import { SubscribeForm } from "./subscribe-form";
import { HideOnPanel } from "./hide-on-panel";
import { contentSource } from "@/lib/content-source";

// Títulos de columna: gris claro sobre el negro del pie, contraste ≥ 7:1 (AA y AAA para texto pequeño en negrita).
const heading = "text-sm font-bold uppercase tracking-[0.18em] text-paper/80";
// Zonas táctiles de 44 px en tableta y móvil; en ordenador (ratón, ≥ 1024 px), interlineado normal de lista (.footer-link).
const link = "footer-link hover:text-white";

/**
 * Pie de la web: Planta 14 y su lema en una fila; debajo, Proyecto, Participa y Boletín (alineadas arriba, para que la
 * primera y la tercera se contrapesen). En tableta, Proyecto y Participa juntas y el boletín debajo; en móvil, apilado,
 * con zonas táctiles de 44 px. El lema y el enlace de WhatsApp salen del CMS.
 */
export function Footer({ motto = "Orgullo de historia. Mirada al futuro", whatsapp = null, letters = false }: { motto?: string; whatsapp?: string | null; letters?: boolean }) {
  // Enlace y aviso de la demo solo con CONTENT_SOURCE=demo.
  const demo = contentSource() === "demo";
  return (
    <footer className="mt-16 bg-coal-950 text-paper" data-site-footer>
      {/* Fila superior: Planta 14 y su lema. Debajo, tres columnas alineadas arriba: Proyecto, Participa y Boletín. */}
      <div className="container-p14 pt-10">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-paper/15 pb-5" data-footer-col="planta14">
          <p className="font-serif text-4xl font-black">Planta 14</p>
          <p className="text-sm leading-6 text-paper/80" data-motto="pie">{motto}</p>
        </div>
        {demo ? <p className="mt-3">Textos e imágenes utilizados únicamente con fines de demostración. No se publican.</p> : null}
      </div>
      <div className="container-p14 grid items-start gap-8 py-8 md:grid-cols-2 lg:grid-cols-[1fr_0.8fr_1.3fr]">
        <nav aria-labelledby="pie-proyecto" className="text-sm" data-footer-col="proyecto">
          <p id="pie-proyecto" className={heading}>Proyecto</p>
          <ul className="footer-list">
            <li><Link href="/principios" className={link}>Principios editoriales</Link></li>
            <li><Link href="/publicidad" className={link}>Publicidad</Link></li>
            <li><Link href="/agenda" className={link}>Agenda</Link></li>
            <li><Link href="/util" className={link}>Útil</Link></li>
            <li><Link href="/contacto" className={link}>Contacto</Link></li>
          </ul>
          {demo ? <Link href="/aller/panel" className={link}>Demo municipal</Link> : null}
        </nav>
        <nav aria-labelledby="pie-participa" className="text-sm" data-footer-col="participa">
          <p id="pie-participa" className={heading}>Participa</p>
          <ul className="footer-list">
            <li><Link href="/contacto" className={link}>Cuéntanos algo</Link></li>
            {/* «Envía tu carta» solo con el ajuste «Cartas activas». */}
            {letters ? <li><Link href="/cartas/enviar" className={link}>Envía tu carta</Link></li> : null}
            <li><Link href="/fiestas/enviar" className={link}>Envía tu fiesta</Link></li>
            {whatsapp ? <li><a href={whatsapp} className={link} target="_blank" rel="noopener noreferrer" data-footer-whatsapp>WhatsApp</a></li> : null}
          </ul>
        </nav>
        {/* En el panel municipal no: el técnico del ayuntamiento no está ahí para suscribirse. */}
        <HideOnPanel><div className="md:col-span-2 lg:col-span-1" data-footer-newsletter data-footer-col="boletin">
          <p className={heading}>Boletín</p>
          <SubscribeForm source="pie" variant="compact" />
        </div></HideOnPanel>
      </div>
      <nav aria-label="Información legal" className="border-t border-paper/15">
        <div className="container-p14 flex flex-wrap items-center gap-x-6 py-3 text-[13px] text-paper/80">
          <span>Planta 14, medio editado por ASSA</span>
          <Link href="/aviso-legal" className={link}>Aviso legal</Link>
          <Link href="/privacidad" className={link}>Privacidad</Link>
          <Link href="/cookies" className={link}>Cookies</Link>
        </div>
      </nav>
    </footer>
  );
}
