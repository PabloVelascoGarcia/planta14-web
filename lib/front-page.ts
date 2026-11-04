import type { Article } from "./mock-data";
import { slugify } from "./utils";

// Reparto de la portada y de «Relacionadas». Las piezas de la sección Agenda solo salen en la agenda y la opinión
// solo en su bloque; ninguna pieza se repite en dos bloques (se rellena con las siguientes). `articles` llega
// ordenado de la más reciente a la más antigua.

export const isAgenda = (article: Article) => slugify(article.topic) === "agenda";
export const isOpinion = (article: Article) => Boolean(article.opinion) || slugify(article.topic) === "opinion";
/** Noticias de los bloques informativos: ni opinión ni agenda. */
export const isNews = (article: Article) => !isOpinion(article) && !isAgenda(article);

export type FrontPage = { main: Article; latest: Article[]; featured: Article[]; caudal: Article[]; opinion: Article[]; more: Article[] };

export function frontPage(articles: Article[]): FrontPage | null {
  const news = articles.filter(isNews);
  // La marcada «Principal de portada» (la más reciente si hay varias); si no, la noticia más reciente.
  const main = articles.find(article => article.main) ?? news[0] ?? articles[0];
  if (!main) return null;
  const used = new Set([main.slug]);
  const take = (list: Article[], count: number) => {
    const picked: Article[] = [];
    for (const article of list) {
      if (picked.length === count) break;
      if (used.has(article.slug)) continue;
      used.add(article.slug);
      picked.push(article);
    }
    return picked;
  };
  const latest = take(news, 4);
  const featured = take([...news.filter(article => article.featured), ...news], 3);
  const caudal = take(news.filter(article => article.comarca === "Caudal"), 3);
  const opinion = take(articles.filter(isOpinion), 3);
  const more = opinion.length ? [] : take(news, 2);
  return { main, latest, featured, caudal, opinion, more };
}

/** Relacionadas: del mismo concejo primero, después de la misma sección; nunca agenda ni la propia noticia. */
export function relatedArticles(article: Article, articles: Article[], count = 3): Article[] {
  const pool = articles.filter(item => item.slug !== article.slug && !isAgenda(item));
  const ordered = [...pool.filter(item => item.concejo === article.concejo), ...pool.filter(item => item.topic === article.topic)];
  return [...new Map(ordered.map(item => [item.slug, item])).values()].slice(0, count);
}
