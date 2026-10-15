import type { MetadataRoute } from "next";
import { siteUrl, indexable } from "@/lib/site-config";
export default function robots(): MetadataRoute.Robots {
 return indexable ? { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/buscar"] }, sitemap: `${siteUrl}/sitemap.xml` } : { rules: { userAgent: "*", disallow: "/" } };
}
