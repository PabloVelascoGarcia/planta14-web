import type { Article } from "./mock-data";
import { slugify } from "./utils";

// Varios concejos y secciones por noticia: el principal manda en la dirección, las migas y la etiqueta visible; los
// demás solo hacen que la pieza salga también en sus páginas, boletines y estadísticas.

/** Todos los concejos de la noticia (nombres), el principal primero. */
export const articleConcejos = (article: Pick<Article, "concejo" | "concejos">) => article.concejos?.length ? article.concejos : [article.concejo];
/** Todas las secciones de la noticia (nombres), la principal primero. */
export const articleTopics = (article: Pick<Article, "topic" | "topics">) => article.topics?.length ? article.topics : [article.topic];
export const inConcejo = (article: Article, slug: string) => articleConcejos(article).some(name => slugify(name) === slug);
export const inTopic = (article: Article, slug: string) => articleTopics(article).some(name => slugify(name) === slug);
export const hasTag = (article: Article, slug: string) => (article.tags ?? []).some(tag => tag.slug === slug);

/** Página de una sección: Opinión y Agenda tienen la suya; las demás, /tema/[sección] (igual que en el menú). */
export function sectionHref(name: string) {
  const slug = slugify(name);
  return slug === "opinion" ? "/opinion" : slug === "agenda" ? "/agenda" : `/tema/${slug}`;
}
/** Página de un concejo (las páginas /concejo/… llevan al espacio municipal si lo tiene). */
export const concejoHref = (name: string) => `/concejo/${slugify(name)}`;

/** Páginas de listados: 24 piezas por página, ?pagina=N. */
export const PAGE_SIZE = 24;
export function paginate<T>(items: T[], page: unknown, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(pages, Math.max(1, Number.parseInt(String(page ?? "1"), 10) || 1));
  return { items: items.slice((current - 1) * size, current * size), current, pages, total: items.length };
}
/** /multimedia sale en el menú (y se indexa) solo con al menos 6 noticias con galería. */
export const MULTIMEDIA_MIN = 6;
/** Una etiqueta se indexa (y va al sitemap) con al menos 2 noticias. */
export const TAG_INDEX_MIN = 2;
