import { siteUrl, indexable } from "@/lib/site-config";
import type { Metadata } from "next";
import type { ReactNode } from "react";
// Gelasio sits behind Georgia so devices without Georgia (Android) show the same letterforms.
import "@fontsource/gelasio/400.css";
import "@fontsource/gelasio/400-italic.css";
import "@fontsource/gelasio/700.css";
import "@fontsource/gelasio/700-italic.css";
import "./globals.css";
import "./municipal.css";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { contentSource } from '@/lib/content-source';

// Content publication and removal must take effect without stale public page caches.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { index: indexable, follow: indexable },
  metadataBase: new URL(siteUrl),
  title: {
    default: "Planta 14 | Periódico digital de las cuencas mineras asturianas",
    template: "%s | Planta 14"
  },
  description:
    "Historias y vida local del Caudal: Mieres, Lena, Aller, Morcín, Riosa y Ribera de Arriba.",
  openGraph: {
    title: "Planta 14",
    description: "Periódico digital local de las cuencas mineras asturianas.",
    locale: "es_ES",
    siteName: "Planta 14",
    type: "website"
  },
  twitter: { card: "summary_large_image" }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const navigation = contentSource() === 'payload' ? await (await import('@/lib/payload-content')).payloadNavigation() : {};
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        <Header {...navigation} />
        <main id="contenido">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
