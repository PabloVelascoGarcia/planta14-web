import { contentSource } from "./content-source";
import { DEFAULT_MOTTOS, DEFAULT_PRINCIPLES } from "../cms/site-globals";

// Lemas, enlaces del pie y principios editoriales (ajustes globales del CMS). Sin CMS (demo) o si el ajuste aún no se ha
// guardado, los valores iniciales.

export type SiteTexts = { underMasthead: string; sideNote: string; footer: string; whatsapp: string | null };
const clean = (v: unknown, fallback: string) => typeof v === "string" && v.trim() ? v.trim() : fallback;

export async function getSiteTexts(): Promise<SiteTexts> {
  const defaults = { underMasthead: DEFAULT_MOTTOS[0], sideNote: DEFAULT_MOTTOS[1], footer: DEFAULT_MOTTOS[2], whatsapp: null };
  if (contentSource() !== "payload") return defaults;
  const { contentClient } = await import("./payload-content");
  const payload = await contentClient();
  const [mottos, footer] = await Promise.all([
    payload.findGlobal({ slug: "mottos", depth: 0, overrideAccess: true }).catch(() => null),
    payload.findGlobal({ slug: "footer-settings", depth: 0, overrideAccess: true }).catch(() => null),
  ]);
  const lemas: Record<string, string> = { lema1: clean(mottos?.lema1, DEFAULT_MOTTOS[0]), lema2: clean(mottos?.lema2, DEFAULT_MOTTOS[1]), lema3: clean(mottos?.lema3, DEFAULT_MOTTOS[2]) };
  const pick = (choice: unknown, fallback: string) => lemas[String(choice)] ?? lemas[fallback];
  const whatsapp = clean(footer?.whatsapp, "");
  return { underMasthead: pick(mottos?.underMasthead, "lema1"), sideNote: pick(mottos?.sideNote, "lema2"), footer: pick(mottos?.footer, "lema3"),
    whatsapp: /^https:\/\//.test(whatsapp) ? whatsapp : null };
}

export type Principles = { provisional: boolean; intro: string; sections: { heading: string; body: string }[] };
export async function getPrinciples(): Promise<Principles> {
  const defaults = { provisional: true, intro: "Estos son los compromisos con los que trabaja la redacción de Planta 14.", sections: DEFAULT_PRINCIPLES };
  if (contentSource() !== "payload") return defaults;
  const { contentClient } = await import("./payload-content");
  const doc = await (await contentClient()).findGlobal({ slug: "principles", depth: 0, overrideAccess: true }).catch(() => null);
  if (!doc) return defaults;
  const sections = (doc.sections ?? []).filter(s => s?.heading && s?.body).map(s => ({ heading: s.heading, body: s.body }));
  return { provisional: doc.provisional !== false, intro: clean(doc.intro, ""), sections: sections.length ? sections : defaults.sections };
}
