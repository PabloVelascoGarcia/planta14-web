type AdSlotProps = {
  label?: string;
  tall?: boolean;
};

export function AdSlot({ label = "Espacio publicitario", tall = false }: AdSlotProps) {
  return (
    <aside
      className={`flex items-center justify-center border border-dashed border-coal-900/30 bg-white/45 p-5 text-center text-xs font-black uppercase tracking-[0.18em] text-coal-800/60 ${
        tall ? "min-h-72" : "min-h-28"
      }`}
    >
      {label}
    </aside>
  );
}
