import type { Comarca } from "@/lib/mock-data";
import { authors, territories, topics } from "@/lib/mock-data";

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(new Date(`${date}T12:00:00`));
}

export function getAuthor(slug: string) {
  return authors.find((author) => author.slug === slug);
}

export function getComarcaFromConcejo(concejo: string): Comarca | undefined {
  return (Object.keys(territories) as Comarca[]).find((comarca) =>
    territories[comarca].some((item) => slugify(item) === concejo)
  );
}

export function allConcejos() {
  return Object.values(territories).flat();
}

export function sortedTopics() {
  return topics;
}
