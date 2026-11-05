// Servicios de la sección «Útil». Cada uno sale por defecto en todos los concejos; el ayuntamiento puede ocultar
// cualquiera en su concejo desde su panel (colección util-visibility). Las noticias y lo editorial no se ocultan.
export const UTIL_SERVICES = [
  { key: "invierno", label: "Puertos y estaciones de esquí" },
  { key: "tiempo", label: "El tiempo (AEMET)" },
  { key: "farmacias", label: "Farmacias de guardia" },
  { key: "servicios", label: "Directorio de servicios municipales" },
  { key: "patrimonio", label: "Patrimonio" },
  { key: "rutas", label: "Rutas" },
  { key: "subvenciones", label: "Subvenciones abiertas" },
  { key: "empleo", label: "Empleo público" },
] as const;
export type UtilService = typeof UTIL_SERVICES[number]["key"];
