import Link from "next/link";

type AdSlotProps = {
  /** Solo en /publicidad: nombre del formato, para enseñar dónde iría cada anuncio. */
  label?: string;
  tall?: boolean;
};

// Hueco publicitario. Mientras no haya anuncio, autopromoción discreta hacia /publicidad (sin scripts ni cookies).
export function AdSlot({ label, tall = false }: AdSlotProps) {
  const size = tall ? "min-h-72" : "min-h-28";
  if (label) {
    return (
      <aside className={`flex items-center justify-center border border-dashed border-coal-900/30 bg-white/45 p-5 text-center text-xs font-black uppercase tracking-[0.18em] text-coal-800/60 ${size}`}>
        {label}
      </aside>
    );
  }
  return (
    <aside aria-label="Publicidad" data-ad-slot="autopromocion" className={`flex flex-col items-center justify-center gap-2 border border-coal-900/15 bg-white/45 p-5 text-center ${size}`}>
      <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-steel">Publicidad</span>
      <Link href="/publicidad" className="inline-flex min-h-11 items-center font-serif text-xl font-black text-coal-900 hover:text-copper">
        Anúnciate en Planta 14 <span aria-hidden="true" className="ml-1">↗</span>
      </Link>
      <span className="text-[13px] text-steel">Llega a los lectores del Caudal.</span>
    </aside>
  );
}
