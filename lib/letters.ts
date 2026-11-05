import { contentSource } from "./content-source";

export type Letter = { id: number; name: string; town: string; title: string | null; text: string; publishedAt: string };
/** Cartas publicadas (la demo no tiene). */
export async function getLetters(limit?: number): Promise<Letter[]> {
  if (contentSource() !== "payload") return [];
  return (await import("./payload-content")).payloadLetters(limit);
}
/** ¿Están activas las cartas en la web? (ajuste «Cartas activas»; desactivadas por defecto y en la demo). */
export async function lettersActive(): Promise<boolean> {
  if (contentSource() !== "payload") return false;
  const [{ contentClient }, { lettersEnabled }] = await Promise.all([import("./payload-content"), import("../cms/site-globals")]);
  return lettersEnabled(await contentClient());
}
export const LETTERS_DISCLAIMER = "Planta 14 no comparte necesariamente las opiniones de los lectores.";
