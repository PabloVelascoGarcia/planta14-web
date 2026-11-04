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
import { CookieConsent } from "@/components/cookie-consent";
import { BreakingNewsBar } from "@/components/breaking-news-bar";
import { StatsBeacon } from "@/components/stats-beacon";
import { activeBreakingNews } from "@/cms/breaking-news";
import { analyticsId } from "@/lib/consent";

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
  // GA4 only exists when configured, and is only loaded in the browser after explicit consent.
  const gaId = analyticsId();
  // «Última hora» (CMS): solo con contenido real; caduca sola (la web se pinta en cada petición).
  const breaking = contentSource() === 'payload' ? activeBreakingNews(await (await (await import('@/lib/payload-content')).contentClient()).findGlobal({ slug: 'breaking-news', overrideAccess: false, depth: 0 }).catch(() => null)) : null;
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        <Header {...navigation} demo={contentSource() === "demo"} />
        {breaking ? <BreakingNewsBar text={breaking.text} link={breaking.link} townSlugs={"townSlugs" in navigation ? (navigation.townSlugs as string[]) : undefined} /> : null}
        <main id="contenido">{children}</main>
        <Footer cookieSettings={Boolean(gaId)} />
        {gaId ? <CookieConsent gaId={gaId} /> : null}
        {/* Estadísticas propias, sin cookies: solo con contenido real. */}
        {contentSource() === 'payload' ? <StatsBeacon /> : null}
      </body>
    </html>
  );
}
