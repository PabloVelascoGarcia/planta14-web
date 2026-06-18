export function Newsletter() {
  return (
    <section className="bg-moss px-5 py-7 text-white sm:px-7">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">Boletín</p>
      <h2 className="mt-2 font-serif text-3xl font-black leading-tight">Las cuencas, cada mañana en tu correo</h2>
      <form className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="newsletter-email">Correo electrónico</label>
        <input
          id="newsletter-email"
          type="email"
          placeholder="tu@email.com"
          className="min-h-11 flex-1 border border-white/25 bg-white px-3 text-sm text-coal-950 outline-none focus:border-coal-950"
        />
        <button className="min-h-11 bg-coal-950 px-5 text-sm font-black uppercase tracking-[0.14em] text-white hover:bg-copper">
          Suscribirse
        </button>
      </form>
    </section>
  );
}
