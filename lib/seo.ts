import type { Metadata } from "next";
import type { Article } from "./mock-data";
import type { MunicipalContent, MunicipalSpace } from "./demo/municipal";
import { absoluteUrl, publisherName, siteName } from "./site-config";

const defaultImage = { url: "/opengraph-image.png", width: 1200, height: 630, alt: "Planta 14 · Una voz para las Cuencas" };
const isoDate = (value?: string) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined; };

/** Image for social previews: explicit share variant, then the article image if it is not the placeholder. */
export function articleShareImage(article: Article) {
  if (article.shareImage) return { ...article.shareImage, alt: article.shareImage.alt || article.imageAlt || article.title };
  const image = article.seoImage || article.image;
  return image && !image.endsWith("/placeholder.svg") ? { url: image, alt: article.imageAlt || article.title } : defaultImage;
}

/** Open Graph, Twitter card and canonical URL of a news article. */
export function articleMetadata(article: Article): Metadata {
  const title = article.seoTitle ?? article.title;
  const description = article.seoDescription ?? article.excerpt;
  const canonical = `/noticia/${article.slug}`;
  const image = articleShareImage(article);
  return {
    title, description, alternates: { canonical },
    openGraph: { type: "article", url: canonical, title, description, siteName, locale: "es_ES", images: [image],
      publishedTime: isoDate(article.publishedAt || article.date), authors: [article.author], section: article.topic },
    twitter: { card: "summary_large_image", title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}

/** schema.org NewsArticle for the article page. */
export function articleJsonLd(article: Article) {
  const image = articleShareImage(article);
  const published = isoDate(article.publishedAt || article.date);
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: (article.seoTitle ?? article.title).slice(0, 110),
    description: article.seoDescription ?? article.excerpt,
    image: [absoluteUrl(image.url)],
    datePublished: published,
    dateModified: published,
    articleSection: article.topic,
    inLanguage: "es-ES",
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(`/noticia/${article.slug}`) },
    author: [{ "@type": "Person", name: article.author, ...(article.authorSlug ? { url: absoluteUrl(`/autor/${article.authorSlug}`) } : {}) }],
    publisher: { "@type": "NewsMediaOrganization", name: siteName, legalName: publisherName, url: absoluteUrl("/"),
      logo: { "@type": "ImageObject", url: absoluteUrl("/icon.png") } },
  };
}

/** JSON for a <script type="application/ld+json">, safe inside HTML. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Open Graph of a municipal space: its latest public image, otherwise the identity panorama or the default. */
export function municipalMetadata(space: MunicipalSpace, contents: MunicipalContent[], fallbackImage?: { url: string; alt: string }): Metadata {
  const canonical = `/${space.id}`;
  const title = `${space.name} · Espacio municipal`;
  const latest = contents.find(c => c.image);
  const description = latest ? `${latest.title}. ${latest.excerpt}`.slice(0, 200) : `Avisos, agenda e información municipal de ${space.name} en Planta 14.`;
  const image = latest?.image ? { url: latest.image.share?.url || latest.image.url, width: latest.image.share?.width, height: latest.image.share?.height, alt: latest.image.alt }
    : fallbackImage || defaultImage;
  return {
    title, description, alternates: { canonical },
    openGraph: { type: "website", url: canonical, title, description, siteName, locale: "es_ES", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}
