import spaceRecords from "./data/municipal-spaces.json";
import contentRecords from "./data/municipal-content.json";
import { visibleTowns } from "./territories";

export type MunicipalType = "news" | "notice" | "event" | "grant" | "announcement";
export type MunicipalContent = {
  id: string; space: string; type: MunicipalType; title: string; excerpt: string; body: string;
  origin: "municipality"; status: "published"; publishedAt: string;
  expiresAt: string | null; eventAt: string | null; place: string | null; deadline: string | null;
  attachments: { url: string; title: string }[]; demo: boolean;
};
export type MunicipalSpace = typeof spaceRecords[number];
export const municipalContents = contentRecords as MunicipalContent[];
export function getMunicipalSpace(slug: string) {
  return visibleTowns().some(t => t.slug === slug) ? spaceRecords.find(s => s.id === slug) : undefined;
}
export function spaceIsActive(space: MunicipalSpace, now = new Date()) {
  const subscription = space.subscription;
  return subscription.status === "demo" || (subscription.status === "active" &&
    (!subscription.startsAt || new Date(subscription.startsAt) <= now) &&
    (!subscription.endsAt || new Date(subscription.endsAt + "T23:59:59") >= now));
}
export const sections = [
  { id: "news", label: "Noticias" }, { id: "notice", label: "Avisos" },
  { id: "event", label: "Agenda" }, { id: "grant", label: "Ayudas y subvenciones" },
  { id: "announcement", label: "Tablón de anuncios" }, { id: "contact", label: "Contacto" }
] as const;
export function storageKey(space: string) { return `planta14:municipal-demo:v1:${space}`; }

// Treat browser storage as untrusted input; accept only the public demo contract.
export function readBrowserContent(raw: string | null, space: string): MunicipalContent[] {
  if (!raw || raw.length > 200_000) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is MunicipalContent => !!item && typeof item === "object" &&
      item.space === space && (item.type === "notice" || item.type === "event") &&
      typeof item.id === "string" && typeof item.title === "string" && item.title.length <= 140 &&
      typeof item.body === "string" && item.body.length <= 2500 && typeof item.excerpt === "string" &&
      typeof item.publishedAt === "string" && !Number.isNaN(Date.parse(item.publishedAt)) &&
      (item.eventAt === null || (typeof item.eventAt === "string" && !Number.isNaN(Date.parse(item.eventAt)))) &&
      (item.expiresAt === null || (typeof item.expiresAt === "string" && !Number.isNaN(Date.parse(item.expiresAt)))) &&
      (item.place === null || typeof item.place === "string") && item.origin === "municipality" &&
      item.status === "published" && item.demo === true).slice(0, 20).map(item => ({ ...item, attachments: [] }));
  } catch { return []; }
}
