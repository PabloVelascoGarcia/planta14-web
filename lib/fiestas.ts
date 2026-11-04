import { contentSource } from "./content-source";
import type { Fiesta } from "./fiestas-dates";

export * from "./fiestas-dates";

/** Fiestas publicadas, por fecha de inicio. La demo no tiene fiestas. */
export async function getFiestas(): Promise<Fiesta[]> {
  if (contentSource() !== "payload") return [];
  return (await import("./payload-content")).payloadFiestas();
}
export async function getFiesta(slug: string) {
  return (await getFiestas()).find(f => f.slug === slug);
}
