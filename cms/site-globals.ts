import type { GlobalConfig } from 'payload';
import { adminOnly } from './access';

// Ajustes globales del sitio, visibles y editables solo por la administración (la web los lee en el servidor).

/** Lemas iniciales. Sin punto final en los tres (criterio unificado: son lemas, no frases). */
export const DEFAULT_MOTTOS = ['Una voz para las Cuencas', 'Donde otros no llegan', 'Orgullo de historia. Mirada al futuro'];
const mottoChoice = (name: string, label: string, def: string, description: string) => ({
  name, label, type: 'select' as const, required: true, defaultValue: def, options: [
    { label: 'Lema 1', value: 'lema1' }, { label: 'Lema 2', value: 'lema2' }, { label: 'Lema 3', value: 'lema3' },
  ], admin: { description },
});

export const Mottos: GlobalConfig = {
  slug: 'mottos',
  label: 'Lemas',
  access: { read: () => true, update: adminOnly },
  admin: { description: 'Los tres lemas de Planta 14 y dónde va cada uno. Sin punto final, como criterio. Solo la administración.' },
  fields: [
    { name: 'lema1', label: 'Lema 1', type: 'text', required: true, maxLength: 80, defaultValue: DEFAULT_MOTTOS[0] },
    { name: 'lema2', label: 'Lema 2', type: 'text', required: true, maxLength: 80, defaultValue: DEFAULT_MOTTOS[1] },
    { name: 'lema3', label: 'Lema 3', type: 'text', required: true, maxLength: 80, defaultValue: DEFAULT_MOTTOS[2] },
    mottoChoice('underMasthead', 'Bajo la cabecera', 'lema1', 'La línea bajo «Planta 14» en todas las páginas.'),
    mottoChoice('sideNote', 'Frase lateral', 'lema2', 'La frase pequeña a la izquierda de «Planta 14» (en escritorio).'),
    mottoChoice('footer', 'Pie de página', 'lema3', 'Bajo «Planta 14» en el pie.'),
  ],
};

export const FooterSettings: GlobalConfig = {
  slug: 'footer-settings',
  label: 'Pie de página',
  access: { read: () => true, update: adminOnly },
  admin: { description: 'Enlaces opcionales del pie. Solo la administración.' },
  fields: [
    { name: 'whatsapp', label: 'Enlace de WhatsApp', type: 'text', maxLength: 300,
      validate: (value: unknown) => !value || /^https:\/\/(wa\.me|chat\.whatsapp\.com|whatsapp\.com\/channel|www\.whatsapp\.com\/channel)\/\S+$/.test(String(value)) || 'Debe ser un enlace https de WhatsApp: wa.me/…, chat.whatsapp.com/… o whatsapp.com/channel/…',
      admin: { description: 'Vacío: el enlace «WhatsApp» no sale en el pie. Por ejemplo, el canal de Planta 14 (https://whatsapp.com/channel/…) o un número (https://wa.me/34…).' } },
  ],
};

/** Contenido inicial de /principios: breve y claramente provisional. Sin citar a personas reales. */
export const DEFAULT_PRINCIPLES = [
  { heading: 'Independencia editorial', body: 'Planta 14 decide qué publica con criterio periodístico propio. Ningún anunciante, institución ni ayuntamiento con espacio en la web decide sobre las informaciones de la redacción.' },
  { heading: 'Información, opinión y publicidad, separadas', body: 'Las noticias cuentan hechos comprobados. Las opiniones van firmadas y en la sección de Opinión. La publicidad se identifica siempre como tal y no se presenta como información.' },
  { heading: 'Contenido institucional identificado', body: 'Lo que publican los ayuntamientos en su espacio aparece siempre marcado como contenido del ayuntamiento, distinto de las informaciones de Planta 14. La redacción puede retirarlo indicando el motivo.' },
  { heading: 'Rectificaciones', body: 'Si publicamos un error, lo corregimos de forma visible e indicamos qué se ha cambiado. Puedes pedir una rectificación desde la página de contacto.' },
  { heading: 'Cartas de los lectores', body: 'Publicamos cartas de lectores identificados con nombre, apellidos y concejo. Comprobamos su identidad antes de publicarlas y no publicamos su DNI ni su teléfono.' },
  { heading: 'Protección de las fuentes', body: 'Protegemos la identidad de quienes nos dan información con la condición de no ser citados.' },
];

export const Principles: GlobalConfig = {
  slug: 'principles',
  label: 'Principios editoriales',
  access: { read: () => true, update: adminOnly },
  admin: { description: 'Texto de /principios (enlazado en el pie). Solo la administración.' },
  fields: [
    { name: 'provisional', label: 'Mostrar el aviso «Texto provisional pendiente de revisión.»', type: 'checkbox', defaultValue: true,
      admin: { description: 'Quítalo cuando el texto esté revisado y sea el definitivo.' } },
    { name: 'intro', label: 'Entradilla', type: 'textarea', maxLength: 600, defaultValue: 'Estos son los compromisos con los que trabaja la redacción de Planta 14.' },
    { name: 'sections', label: 'Principios', type: 'array', labels: { singular: 'Principio', plural: 'Principios' }, defaultValue: DEFAULT_PRINCIPLES,
      fields: [
        { name: 'heading', label: 'Título', type: 'text', required: true, maxLength: 120 },
        { name: 'body', label: 'Texto', type: 'textarea', required: true, maxLength: 2000, admin: { description: 'Párrafos separados por una línea en blanco.' } },
      ] },
  ],
};
