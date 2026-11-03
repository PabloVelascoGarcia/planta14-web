import type { MetadataRoute } from "next";
import { siteUrl, isIndexable } from "@/lib/site-config";

// Evaluated per request so SITE_INDEXABLE (runtime) decides, not the build.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/cms", "/api/", "/buscar", "/niebla", "/vista-previa", "/*/panel"] },
    sitemap: [`${siteUrl}/sitemap.xml`, `${siteUrl}/sitemap-noticias.xml`],
  };
}
