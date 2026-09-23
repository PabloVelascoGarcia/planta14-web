import { siteUrl, indexable } from "@/lib/site-config";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  robots: { index: indexable, follow: indexable },
  metadataBase: new URL(siteUrl),
  title: {
    default: "Planta 14 | Periódico digital de las cuencas mineras asturianas",
    template: "%s | Planta 14"
  },
  description:
    "Información local de Caudal y Nalón: Mieres, Lena, Aller, Langreo, Laviana y el resto de las cuencas mineras asturianas.",
  openGraph: {
    title: "Planta 14",
    description: "Periódico digital local de las cuencas mineras asturianas.",
    locale: "es_ES",
    siteName: "Planta 14",
    type: "website"
  },
  twitter: { card: "summary_large_image" }
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        <Header />
        <main id="contenido">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
