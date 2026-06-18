import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  metadataBase: new URL("https://planta14.local"),
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
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
