/** Slug sin tildes, eñes, mayúsculas ni espacios (secciones, plantillas, etiquetas). */
export function slugText(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
