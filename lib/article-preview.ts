import type { Article, Comarca } from "./mock-data";

// Convierte el borrador que envía el CMS (vista previa en vivo) en una noticia para ArticleView. Solo usa los datos
// recibidos: se ejecuta en el navegador. Las imágenes aún no publicadas se ven por su dirección autenticada del CMS.
type Related = Record<string, unknown> | number | string | null | undefined;
const rel = (value: Related) => (value && typeof value === "object" ? value as Record<string, unknown> : null);
const str = (value: unknown) => (typeof value === "string" ? value : "");

export function previewArticle(doc: Record<string, unknown>): Article {
  const author = rel(doc.author as Related), town = rel(doc.town as Related), section = rel(doc.section as Related), image = rel(doc.image as Related);
  const sizes = image?.sizes as Record<string, { url?: string | null } | undefined> | undefined;
  const imageURL = image ? str(image.publicURL) || str(sizes?.hero?.url) || str(image.url) || "/images/placeholder.svg" : "/images/placeholder.svg";
  const body = Array.isArray(doc.body) ? (doc.body as unknown[]).filter((p): p is string => typeof p === "string" && p.trim() !== "") : [];
  return {
    id: String(doc.id ?? ""), slug: str(doc.slug), title: str(doc.title) || "Sin título", excerpt: str(doc.excerpt), body,
    image: imageURL, imageAlt: str(image?.alt), imageCredit: str(image?.credit),
    date: str(doc.date), author: str(author?.name) || "Autor sin elegir", authorSlug: str(author?.slug),
    comarca: (str(town?.comarca) || "Caudal") as Comarca, concejo: str(town?.name) || "Concejo sin elegir", topic: str(section?.name) || "Sección sin elegir",
    status: "draft", publishedAt: str(doc.publishedAt) || str(doc.date),
  };
}
