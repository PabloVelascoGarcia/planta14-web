"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";

// Reparto de las cajas de «Útil» en columnas igualadas: cada caja, en orden, va a la columna más corta (a igualdad, la
// de la izquierda). Así las columnas terminan casi a la vez y el orden de lectura se mantiene: cada caja empieza a la
// misma altura o más abajo que la anterior, y el HTML (lectores de pantalla, tabulador) conserva el orden original.
// Sin JavaScript, o a una columna, quedan las columnas de CSS (.util-grid en municipal.css).

const GAP = 22, MIN_COLUMN = 300, MAX_COLUMNS = 3;

export function UtilGrid({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    let frame = 0;
    const place = () => {
      const boxes = [...grid.children] as HTMLElement[];
      const width = grid.clientWidth;
      const columns = Math.max(1, Math.min(MAX_COLUMNS, Math.floor((width + GAP) / (MIN_COLUMN + GAP))));
      grid.dataset.utilColumns = String(columns);
      if (columns === 1) {
        grid.classList.remove("is-placed");
        grid.style.height = "";
        for (const box of boxes) { box.style.width = box.style.left = box.style.top = ""; }
        return;
      }
      const columnWidth = (width - GAP * (columns - 1)) / columns;
      grid.classList.add("is-placed");
      for (const box of boxes) box.style.width = `${columnWidth}px`;
      const heights = boxes.map(box => box.offsetHeight); // todas las medidas juntas, después de fijar el ancho
      const ends = Array<number>(columns).fill(0);
      boxes.forEach((box, i) => {
        const column = ends.indexOf(Math.min(...ends));
        box.style.left = `${column * (columnWidth + GAP)}px`;
        box.style.top = `${ends[column]}px`;
        ends[column] += heights[i] + GAP;
      });
      grid.style.height = `${Math.max(...ends) - GAP}px`;
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(place); };
    place();
    // Se recoloca si cambia el ancho o la altura de una caja (imágenes que cargan, fuentes, giro del móvil).
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    for (const box of grid.children) observer.observe(box);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, []);
  return <div ref={ref} className="util-grid" data-util-grid>{children}</div>;
}
