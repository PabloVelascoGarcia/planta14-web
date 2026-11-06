import { SubscribeForm } from "./subscribe-form";

/**
 * Bloque verde del boletín, solo en la portada: a la izquierda título, frase, correo y botón; a la derecha qué recibir y
 * los concejos; consentimiento y privacidad debajo, en letra pequeña. En las demás páginas basta el formulario del pie.
 */
export function Newsletter({ source = "portada" }: { source?: "portada" | "noticia" | "fiesta" }) {
  return (
    <section className="bg-moss px-6 py-6 text-white sm:px-8" aria-labelledby={`boletin-${source}`} data-newsletter={source}>
      <SubscribeForm source={source} variant="split" intro={<>
        <h2 id={`boletin-${source}`} className="font-serif text-3xl font-black leading-tight">Las cuencas, también en tu correo</h2>
        <p className="mt-2 max-w-lg text-[15px] leading-6 text-white/85">Qué hacer el fin de semana y los avisos de tu concejo. Tú eliges qué y de dónde.</p>
      </>} />
    </section>
  );
}
