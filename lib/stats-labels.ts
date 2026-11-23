// Nombres visibles de las estadísticas (sin dependencias: se usa también en el navegador).

/** Nombre visible de la «sección» guardada en las estadísticas («concejo» → «Página del concejo», «sociedad» → «Sociedad»). */
const SECTION_LABELS: Record<string, string> = {
  concejo: "Página del concejo", util: "Útil", agenda: "Agenda", fiestas: "Fiestas", opinion: "Opinión", multimedia: "Multimedia", etiqueta: "Etiquetas",
  sucesos: "Sucesos", economia: "Economía", empresas: "Empresas", politica: "Política", sociedad: "Sociedad", deportes: "Deportes", cultura: "Cultura", patrimonio: "Patrimonio",
};
export function sectionLabel(slug: string) {
  return SECTION_LABELS[slug] ?? (slug ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ") : "Otras");
}

