import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Article, Author } from "@/lib/mock-data";
import { articles as seedArticles, authors as seedAuthors } from "@/lib/mock-data";
import { slugify } from "@/lib/utils";

const dataDir = path.join(process.cwd(), "data");
const articlesFile = path.join(dataDir, "articles.json");
const authorsFile = path.join(dataDir, "authors.json");

export type ArticleStatus = NonNullable<Article["status"]>;

export type ArticleInput = {
  id?: string;
  title: string;
  excerpt: string;
  body: string;
  image: string;
  date: string;
  author: string;
  authorSlug?: string;
  comarca: Article["comarca"];
  concejo: string;
  topic: string;
  status: ArticleStatus;
  publishedAt?: string;
  scheduledAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
  featured?: boolean;
  main?: boolean;
};

export type AuthorInput = {
  name: string;
  role: string;
  bio: string;
  email?: string;
  avatar?: string;
};

export async function getArticles(): Promise<Article[]> {
  return (await getAllArticles()).filter(isPublicArticle);
}

export async function getAllArticles(): Promise<Article[]> {
  const articles = await readJson<Article[]>(articlesFile, seedArticles.map(normalizeArticle));
  return articles.map(normalizeArticle).sort(sortByDateDesc);
}

export async function saveArticle(input: ArticleInput): Promise<Article> {
  const currentArticles = await getAllArticles();
  const existingArticle = input.id
    ? currentArticles.find((article) => article.id === input.id || article.slug === input.id)
    : undefined;
  const baseSlug = existingArticle?.slug ?? slugify(input.title);
  const slug = existingArticle ? existingArticle.slug : uniqueSlug(baseSlug, currentArticles);
  const authorSlug = input.authorSlug || slugify(input.author);

  const nextArticle: Article = normalizeArticle({
    ...existingArticle,
    id: existingArticle?.id ?? randomUUID(),
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    body: input.body
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    image: input.image.trim(),
    date: input.date,
    author: input.author.trim(),
    authorSlug,
    comarca: input.comarca,
    concejo: input.concejo,
    topic: input.topic,
    slug,
    status: resolveStatus(input.status, input.scheduledAt),
    publishedAt: input.publishedAt || (input.status === "published" ? input.date : undefined),
    scheduledAt: input.scheduledAt || undefined,
    seoTitle: input.seoTitle?.trim() || undefined,
    seoDescription: input.seoDescription?.trim() || undefined,
    seoImage: input.seoImage?.trim() || undefined,
    featured: Boolean(input.featured),
    main: Boolean(input.main),
    opinion: input.topic === "Opinión"
  });

  const retainedArticles: Article[] = currentArticles
    .filter((article) => article.id !== nextArticle.id && article.slug !== nextArticle.slug)
    .map((article): Article => ({
      ...article,
      main: input.main ? false : article.main
    }));

  const nextArticles: Article[] = [...retainedArticles, nextArticle].sort(sortByDateDesc);

  await writeJson(articlesFile, nextArticles);
  return nextArticle;
}

export async function deleteArticle(id: string) {
  const currentArticles = await getAllArticles();
  await writeJson(
    articlesFile,
    currentArticles.filter((article) => article.id !== id && article.slug !== id)
  );
}

export async function updateArticleStatus(id: string, status: ArticleStatus) {
  const currentArticles = await getAllArticles();
  const nextArticles = currentArticles.map((article) =>
    article.id === id || article.slug === id
      ? normalizeArticle({
          ...article,
          status,
          publishedAt: status === "published" ? article.publishedAt ?? today() : article.publishedAt
        })
      : article
  );
  await writeJson(articlesFile, nextArticles);
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
  return allArticles.filter((article) => slugify(article.authorSlug ?? article.author) === author);
}

export async function getAuthors(): Promise<Author[]> {
  const authors = await readJson<Author[]>(authorsFile, seedAuthors);
  return authors.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function saveAuthor(input: AuthorInput): Promise<Author> {
  const currentAuthors = await getAuthors();
  const slug = uniqueAuthorSlug(slugify(input.name), currentAuthors);
  const author: Author = {
    name: input.name.trim(),
    slug,
    role: input.role.trim(),
    bio: input.bio.trim(),
    email: input.email?.trim() || undefined,
    avatar: input.avatar?.trim() || undefined
  };

  await writeJson(authorsFile, currentAuthors.concat(author));
  return author;
}

export async function updateAuthor(slug: string, input: AuthorInput): Promise<Author> {
  const currentAuthors = await getAuthors();
  const author: Author = {
    name: input.name.trim(),
    slug,
    role: input.role.trim(),
    bio: input.bio.trim(),
    email: input.email?.trim() || undefined,
    avatar: input.avatar?.trim() || undefined
  };

  await writeJson(authorsFile, currentAuthors.map((item) => (item.slug === slug ? author : item)));
  return author;
}

export async function deleteAuthor(slug: string) {
  const currentAuthors = await getAuthors();
  await writeJson(authorsFile, currentAuthors.filter((author) => author.slug !== slug));
}

function normalizeArticle(article: Article): Article {
  const status = resolveStatus(article.status ?? "published", article.scheduledAt);
  return {
    ...article,
    id: article.id ?? article.slug,
    authorSlug: article.authorSlug ?? slugify(article.author),
    status,
    publishedAt: article.publishedAt ?? article.date,
    seoTitle: article.seoTitle ?? article.title,
    seoDescription: article.seoDescription ?? article.excerpt,
    seoImage: article.seoImage ?? article.image
  };
}

function isPublicArticle(article: Article) {
  return article.status === "published" || (article.status === "scheduled" && isPast(article.scheduledAt));
}

function resolveStatus(status: ArticleStatus, scheduledAt?: string): ArticleStatus {
  if (status === "scheduled" && isPast(scheduledAt)) {
    return "published";
  }

  return status;
}

function isPast(value?: string) {
  if (!value) {
    return false;
  }

  return new Date(value).getTime() <= Date.now();
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const contents = await fs.readFile(file, "utf8");
    return JSON.parse(contents) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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

function uniqueAuthorSlug(baseSlug: string, authors: Author[]) {
  const fallbackSlug = baseSlug || "autor";
  const usedSlugs = new Set(authors.map((author) => author.slug));

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
  return (b.publishedAt ?? b.date).localeCompare(a.publishedAt ?? a.date);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
