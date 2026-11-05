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

/** Días antes del comienzo para «Fiestas esta semana» (ajuste del CMS «Fiestas en portada»; 7 si no se ha guardado). */
export async function fiestasDaysBefore(): Promise<number> {
  if (contentSource() !== "payload") return 7;
  const { contentClient } = await import("./payload-content");
  const doc = await (await contentClient()).findGlobal({ slug: "fiestas-settings", depth: 0, overrideAccess: true }).catch(() => null);
  const days = Number(doc?.daysBefore);
  return Number.isInteger(days) && days >= 0 && days <= 30 ? days : 7;
}
