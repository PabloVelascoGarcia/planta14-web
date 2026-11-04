import type { Metadata } from "next";
import { NotFoundContent } from "@/components/not-found-content";

// 404 propia dentro del diseño de la web (ver app/(frontend)/not-found.tsx).
export const metadata: Metadata = { title: "Página no encontrada", robots: { index: false, follow: true } };
export default function NotFound() {
  return <NotFoundContent />;
}
