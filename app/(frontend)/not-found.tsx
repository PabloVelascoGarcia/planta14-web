import type { Metadata } from "next";
import { NotFoundContent } from "@/components/not-found-content";

export const metadata: Metadata = { title: "Página no encontrada", robots: { index: false, follow: true } };

// 404 de las páginas públicas (noticia, concejo, autor… que no existen), con la cabecera y el pie de la web.
// Next.js 16 responde 404 y, con dos layouts raíz (web y CMS), la pinta en el navegador al cargar la página (el HTML
// inicial es un armazón vacío; ya pasaba antes con su 404 en inglés). Las direcciones sin ninguna ruta usan
// app/global-not-found.tsx, que sí va completa en el HTML.
export default function NotFound() {
  return <NotFoundContent />;
}
