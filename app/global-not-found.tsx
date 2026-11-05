// 404 de las direcciones que no corresponden a ninguna ruta (p. ej. /noticia/a/b). Next.js la sirve sin pasar por
// los layouts (hay dos raíz: web y CMS), así que trae aquí los estilos, la cabecera y el pie de la web.
import "@fontsource/gelasio/400.css";
import "@fontsource/gelasio/700.css";
import "./(frontend)/globals.css";
import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { NotFoundContent } from "@/components/not-found-content";
import { contentSource } from "@/lib/content-source";

// Se pinta en cada petición: la cabecera depende de CONTENT_SOURCE (demo o contenido real), que no existe al compilar.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Página no encontrada | Planta 14", robots: { index: false, follow: true } };

export default async function GlobalNotFound() {
  const navigation = contentSource() === "payload" ? await (await import("@/lib/payload-content")).payloadNavigation().catch(() => ({})) : {};
  const texts = await (await import("@/lib/site-texts")).getSiteTexts().catch(() => null);
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <Header {...navigation} demo={contentSource() === "demo"} tagline={texts?.underMasthead} sideNote={texts?.sideNote} />
        <main id="contenido"><NotFoundContent /></main>
        <Footer cookieSettings={false} motto={texts?.footer} whatsapp={texts?.whatsapp ?? null} />
      </body>
    </html>
  );
}
