import { promises as fs } from "node:fs";
import path from "node:path";
import type { Article } from "@/lib/mock-data";
import { articles as seedArticles } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

const dataDir = path.join(process.cwd(), "data");
const articlesFile = path.join(dataDir, "articles.json");

export type ArticleInput = {
  title: string;
  excerpt: string;
  body: string;
  image: string;
  date: string;
  author: string;
  comarca: Article["comarca"];
  concejo: string;
  topic: string;
  featured?: boolean;
  main?: boolean;
};

export async function getArticles(): Promise<Article[]> {
  try {
    const file = await fs.readFile(articlesFile, "utf8");
    return JSON.parse(file) as Article[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [...seedArticles].sort(sortByDateDesc);
    }

    throw error;
  }
}

export async function saveArticle(input: ArticleInput): Promise<Article> {
  const currentArticles = await getArticles();
  const slug = uniqueSlug(slugify(input.title), currentArticles);
  const nextArticle: Article = {
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    body: input.body
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    image: input.image.trim(),
    date: input.date,
    author: input.author.trim(),
    comarca: input.comarca,
    concejo: input.concejo,
    topic: input.topic,
    slug,
    featured: Boolean(input.featured),
    main: Boolean(input.main),
    opinion: input.topic === "Opinión"
  };

  const nextArticles = [nextArticle, ...currentArticles.map((article) => ({
    ...article,
    main: input.main ? false : article.main
  }))].sort(sortByDateDesc);

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(articlesFile, `${JSON.stringify(nextArticles, null, 2)}\n`, "utf8");

  return nextArticle;
}

export async function getArticle(slug: string) {
  const allArticles = await getArticles();
  return allArticles.find((article) => article.slug === slug);
}

export async function getArticlesByComarca(comarca: string) {
  const allArticles = await getArticles();
  return allArticles.filter((article) => slugify(article.comarca) === comarca);
}

export async function getArticlesByConcejo(concejo: string) {
  const allArticles = await getArticles();
  return allArticles.filter((article) => slugify(article.concejo) === concejo);
}

export async function getArticlesByTopic(topic: string) {
  const allArticles = await getArticles();
  return allArticles.filter((article) => slugify(article.topic) === topic);
}

export async function getArticlesByAuthor(author: string) {
  const allArticles = await getArticles();
  return allArticles.filter((article) => slugify(article.author) === author);
}

function uniqueSlug(baseSlug: string, articles: Article[]) {
  const fallbackSlug = baseSlug || "noticia";
  const usedSlugs = new Set(articles.map((article) => article.slug));

  if (!usedSlugs.has(fallbackSlug)) {
    return fallbackSlug;
  }

  let counter = 2;
  while (usedSlugs.has(`${fallbackSlug}-${counter}`)) {
    counter += 1;
  }

  return `${fallbackSlug}-${counter}`;
}

function sortByDateDesc(a: Article, b: Article) {
  return b.date.localeCompare(a.date);
}
