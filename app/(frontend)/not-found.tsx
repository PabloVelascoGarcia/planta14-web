import type { Metadata } from "next";
import { NotFoundContent } from "@/components/not-found-content";

export const metadata: Metadata = { title: "Página no encontrada", robots: { index: false, follow: true } };

// 404 de las páginas públicas, con la cabecera y el pie de la web. Next.js no la pinta en el servidor cuando el
// notFound() sale de un segmento hijo directo de este layout raíz, así que cada página con notFound() tiene su
// propio not-found.tsx con el mismo contenido. Las direcciones sin ruta usan app/global-not-found.tsx.
export default function NotFound() {
  return <NotFoundContent />;
}
