import type { Comarca } from "@/lib/mock-data";
import { authors, topics } from "@/lib/mock-data";
import { territoryRecords } from "@/lib/demo/territories";

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
  const town = territoryRecords.find(t => t.type === "concejo" && t.slug === concejo);
  return territoryRecords.find(t => t.id === town?.parent)?.name as Comarca | undefined;
}

export function allConcejos() {
  return territoryRecords.filter(t => t.type === "concejo").map(t => t.name);
}

export function sortedTopics() {
  return topics;
}
