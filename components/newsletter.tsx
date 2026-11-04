import { SubscribeForm } from "./subscribe-form";

/** Bloque del boletín (portada, noticias y fichas de fiestas): alta con doble confirmación por correo. */
export function Newsletter({ source = "portada" }: { source?: "portada" | "noticia" | "fiesta" }) {
  return (
    <section className="bg-moss px-6 py-8 text-white sm:px-8" aria-labelledby={`boletin-${source}`} data-newsletter={source}>
      <p className="text-[13px] font-black uppercase tracking-[0.2em] text-white/75">Boletín gratuito</p>
      <h2 id={`boletin-${source}`} className="mt-3 font-serif text-3xl font-black leading-tight">Las cuencas, también en tu correo</h2>
      <p className="mt-3 max-w-lg text-[15px] leading-7 text-white/85">Qué hacer el fin de semana y los avisos de tu concejo. Tú eliges qué y de dónde.</p>
      <SubscribeForm source={source} />
    </section>
  );
}
