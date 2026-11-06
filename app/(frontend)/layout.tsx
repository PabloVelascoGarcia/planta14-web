import { siteUrl, isIndexable } from "@/lib/site-config";
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
import { BreakingNewsBar } from "@/components/breaking-news-bar";
import { StatsBeacon } from "@/components/stats-beacon";
import { activeBreakingNews } from "@/cms/breaking-news";

// Content publication and removal must take effect without stale public page caches.
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const indexable = isIndexable();
  return {
    // Google Discover: vista previa grande de las imágenes, solo si el sitio es indexable.
    robots: { index: indexable, follow: indexable, ...(indexable ? { 'max-image-preview': 'large' as const } : {}) },
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
}

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const navigation = contentSource() === 'payload' ? await (await import('@/lib/payload-content')).payloadNavigation() : {};
  // Las páginas de un espacio municipal ACTIVO llevan su propia cabecera; las de un concejo inactivo son del periódico.
  const municipalSlugs = contentSource() === 'payload' ? (await (await import('@/lib/municipal-content')).getMunicipalSpaces({ activos: true })).map(space => space.id) : undefined;
  // «Última hora» (CMS): solo con contenido real; caduca sola (la web se pinta en cada petición).
  const texts = await (await import('@/lib/site-texts')).getSiteTexts();
  const breaking = contentSource() === 'payload' ? activeBreakingNews(await (await (await import('@/lib/payload-content')).contentClient()).findGlobal({ slug: 'breaking-news', overrideAccess: false, depth: 0 }).catch(() => null)) : null;
  return (
    <html lang="es">
      {/* RSS de noticias en todas las páginas (los metadatos de cada página sustituyen los «alternates» del layout). */}
      <head><link rel="alternate" type="application/rss+xml" title="Planta 14 · Noticias" href="/rss.xml" /></head>
      <body className="min-h-screen antialiased">
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        <Header {...navigation} {...(municipalSlugs ? { townSlugs: municipalSlugs } : {})} demo={contentSource() === "demo"} tagline={texts.underMasthead} sideNote={texts.sideNote} />
        {breaking ? <BreakingNewsBar text={breaking.text} link={breaking.link} townSlugs={municipalSlugs} /> : null}
        <main id="contenido">{children}</main>
        <Footer motto={texts.footer} whatsapp={texts.whatsapp} letters={texts.letters} />
        {/* Estadísticas propias, sin cookies: solo con contenido real. */}
        {contentSource() === 'payload' ? <StatsBeacon /> : null}
      </body>
    </html>
  );
}
