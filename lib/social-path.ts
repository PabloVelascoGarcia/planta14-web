import type { Article } from "./mock-data";

// Dirección de la imagen para redes de una noticia (la genera lib/social-image.ts).
/** Versión corta de la noticia para la dirección de su imagen para redes. */
export function socialVersion(article: Pick<Article, "version" | "title" | "concejo" | "image">) {
  let h = 0;
  for (const ch of `${article.version ?? ""}|${article.title}|${article.concejo}|${article.image}`) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}
export const socialImagePath = (article: Article) => `/noticia/${article.slug}/redes.jpg?v=${socialVersion(article)}`;

