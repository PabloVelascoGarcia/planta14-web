// Fechas y tipos de las fiestas, sin dependencias de servidor (también los usa la página municipal, que es de cliente).
import type { LexicalState } from "./rich-text";

/** Fiesta tal como la usa la web pública (solo publicadas; sin organizador ni contacto). */
export type Fiesta = {
  slug: string; name: string; village: string; town: string; townSlug: string;
  startDay: string; endDay: string; program?: LexicalState; recurring: boolean;
  image?: { url: string; srcSet?: string; alt: string; credit: string };
  chronicle?: { slug: string; title: string };
};

/** Hoy en Madrid (AAAA-MM-DD). PLANTA14_TEST_TODAY solo en pruebas con fecha fija. */
export const madridToday = () => process.env.PLANTA14_TEST_TODAY || new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
const shift = (day: string, days: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

/** Este fin de semana (viernes a domingo). De lunes a jueves, el siguiente; en viernes, sábado o domingo, el actual. */
export function weekend(today = madridToday()) {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 domingo … 6 sábado
  const friday = weekday === 0 ? shift(today, -2) : weekday === 6 ? shift(today, -1) : shift(today, 5 - weekday);
  return { from: friday, to: shift(friday, 2) };
}
export const overlaps = (f: Pick<Fiesta, "startDay" | "endDay">, from: string, to: string) => f.startDay <= to && f.endDay >= from;

/** Las que aún no han terminado. */
export const upcoming = (fiestas: Fiesta[], today = madridToday()) => fiestas.filter(f => f.endDay >= today);

const dayMonth = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
const dayOnly = new Intl.DateTimeFormat("es-ES", { day: "numeric", timeZone: "UTC" });
const weekdayName = new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "UTC" });
const at = (day: string) => new Date(`${day}T12:00:00Z`);

/** «del 14 al 16 de agosto», «del 30 de julio al 2 de agosto» o «sábado 15 de agosto». */
export function fiestaDates(f: Pick<Fiesta, "startDay" | "endDay">) {
  if (f.startDay === f.endDay) return `${weekdayName.format(at(f.startDay))} ${dayMonth.format(at(f.startDay))}`;
  const sameMonth = f.startDay.slice(0, 7) === f.endDay.slice(0, 7);
  return `del ${sameMonth ? dayOnly.format(at(f.startDay)) : dayMonth.format(at(f.startDay))} al ${dayMonth.format(at(f.endDay))}`;
}
export const monthLabel = (day: string) => new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(at(day));
