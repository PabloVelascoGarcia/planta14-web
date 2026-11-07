// Índice de riesgo de incendios forestales de cada concejo, el que publica cada día 112 Asturias (Servicio de Emergencias
// del Principado de Asturias, SEPA) en https://www.112asturias.es/indice-incendios-asturias (niveles 1 Bajo a 5 Extremo).
//
// Fuente: la propia página del 112. No hay servicio de datos: la página trae los niveles en su HTML (lista
// «Índices de incendio para los concejos de Asturias») y el botón «Mañana» los pide a un fragmento HTML del mismo 112
// (ajax_indices_incendio.asp). El servidor de mapas del Principado (sig.asturias.es) publica capas de susceptibilidad
// a incendios (estáticas, CC BY 4.0), no este índice diario. Su aviso legal (/aviso-legal) son las condiciones de la
// aplicación móvil «Asturias 112»: no regulan ni prohíben reutilizar la información de la web. Su robots.txt permite la página.
//
// Es un dato de seguridad: el lector es estricto. Si falta la fecha, la lista o alguno de los seis concejos, o un nivel no
// cuadra con su clase, la lectura falla y no se muestra ningún nivel (solo el enlace a la página oficial).

export const FIRE_INDEX_PAGE = "https://www.112asturias.es/indice-incendios-asturias";
export const FIRE_INDEX_SOURCE = "112 Asturias · Servicio de Emergencias del Principado de Asturias (SEPA)";
/** No hay licencia publicada para este dato: se dice así, con la fuente y el enlace. */
export const FIRE_INDEX_LICENCE = "Información pública del 112 Asturias, sin licencia de reutilización publicada; consulta siempre la página oficial";

export type FireLevel = { level: 1 | 2 | 3 | 4 | 5; label: string; color: string };
export type FireIndex = { day: string; levels: Record<string, FireLevel> };

/** Clase de la página del 112 → nivel, texto y color de su leyenda. */
const CLASSES: Record<string, FireLevel> = {
  indice_bajo: { level: 1, label: "Bajo", color: "#2e7d32" },
  indice_moderado: { level: 2, label: "Moderado", color: "#c9a800" },
  indice_alto: { level: 3, label: "Alto", color: "#a85400" },
  indice_muy_alto: { level: 4, label: "Muy alto", color: "#c62828" },
  indice_extremo: { level: 5, label: "Extremo", color: "#5d1049" },
  indice_recurrencia: { level: 5, label: "Extremo (recurrencia)", color: "#5d1049" },
  indice_contaminacion: { level: 5, label: "Extremo (contaminación)", color: "#5d1049" },
};
/** Texto que debe ir sobre cada color para tener contraste AA. */
export const fireTextColor = (level: FireLevel["level"]) => (level === 2 ? "#1d1a14" : "#ffffff");

const normal = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const decode = (value: string) => value.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&([aeiou])acute;/gi, (_, v) => ({ a: "á", e: "é", i: "í", o: "ó", u: "ú" } as Record<string, string>)[v.toLowerCase()] ?? v)
  .replace(/&ntilde;/gi, "ñ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

export class FireIndexFormatError extends Error {}

/**
 * Lee la página del 112. `towns`: nombre oficial de cada concejo de Planta 14 por su slug. Lanza FireIndexFormatError
 * ante cualquier cambio de formato (no devuelve nunca un nivel dudoso).
 */
export function parseFireIndex(html: string, towns: Record<string, string>): FireIndex {
  const date = html.match(/<span class="fecha_incendios_actual">\s*(\d{2})\/(\d{2})\/(\d{4})\s*<\/span>/);
  if (!date) throw new FireIndexFormatError("No se encuentra la fecha del índice");
  const [, dd, mm, yyyy] = date;
  const day = `${yyyy}-${mm}-${dd}`;
  if (Number.isNaN(Date.parse(`${day}T12:00:00Z`)) || Number(mm) > 12 || Number(dd) > 31) throw new FireIndexFormatError("Fecha del índice no válida");
  const list = html.match(/<ul class="lista_indices_concejos">([\s\S]*?)<\/ul>/);
  if (!list) throw new FireIndexFormatError("No se encuentra la lista de concejos");
  const rows = [...list[1].matchAll(/<li>\s*<span class="([a-z_]+)">\s*([^<]*?)\s*<\/span>\s*([^<]+?)\s*<\/li>/g)];
  if (rows.length < 70) throw new FireIndexFormatError(`La lista tiene ${rows.length} concejos (se esperan los 78)`);
  const byName = new Map<string, { cls: string; number: string }>();
  for (const [, cls, number, name] of rows) byName.set(normal(decode(name)), { cls, number: decode(number).trim() });
  const levels: Record<string, FireLevel> = {};
  for (const [slug, name] of Object.entries(towns)) {
    const row = byName.get(normal(name));
    if (!row) throw new FireIndexFormatError(`Falta ${name} en la lista`);
    if (row.cls === "indice_sin_datos") continue; // «Sin información» en el 112: tampoco aquí.
    const known = CLASSES[row.cls];
    if (!known) throw new FireIndexFormatError(`Nivel desconocido para ${name}: ${row.cls}`);
    if (row.number !== String(known.level)) throw new FireIndexFormatError(`El nivel de ${name} no cuadra con su clase (${row.number} / ${row.cls})`);
    levels[slug] = known;
  }
  return { day, levels };
}

/** Lo que se puede mostrar: solo si la última lectura fue buena y el índice es de hoy (Madrid). */
export function fireIndexForToday(cached: { data: FireIndex | null; error: string | null }, today: string) {
  return !cached.error && cached.data && cached.data.day === today ? cached.data : null;
}
