import type { Block, CollectionBeforeChangeHook } from 'payload';
import { relationID } from './access';

// Imágenes dentro del texto de una noticia (bloques «Imagen» y «Galería» del editor) y plantillas gráficas propias para
// cuando no hay foto. Las imágenes de los bloques cuentan como las demás: misma comprobación de derechos al publicar y
// misma copia pública (campo oculto `bodyImages`, que se rellena solo al guardar).

const poster = { name: 'poster', label: 'Mostrar entera (cartel)', type: 'checkbox' as const,
  admin: { description: 'Para carteles y documentos: la imagen se ve completa, sin recortar, con fondo neutro alrededor.' } };
const creditOverride = { name: 'credit', label: 'Crédito (opcional)', type: 'text' as const, maxLength: 160,
  admin: { description: 'Si lo dejas vacío, se usa la autoría guardada con la imagen en Imágenes.' } };

export const ImageBlock: Block = {
  slug: 'imagen', labels: { singular: 'Imagen', plural: 'Imágenes' }, interfaceName: 'ImageBlock',
  fields: [
    { name: 'image', label: 'Imagen', type: 'upload', relationTo: 'media', required: true,
      admin: { description: 'Elige una de Imágenes o súbela con «Crear»: pide descripción, autoría y la declaración de derechos.' } },
    { name: 'caption', label: 'Pie de foto', type: 'textarea', required: true, maxLength: 400, admin: { description: 'Qué se ve y dónde. Obligatorio.' } },
    creditOverride, poster,
  ],
};

export const GalleryBlock: Block = {
  slug: 'galeria', labels: { singular: 'Galería', plural: 'Galerías' }, interfaceName: 'GalleryBlock',
  fields: [
    { name: 'images', label: 'Imágenes de la galería', type: 'array', minRows: 2, maxRows: 12, required: true,
      labels: { singular: 'Imagen', plural: 'Imágenes' },
      admin: { description: 'De 2 a 12 imágenes. Se ven en cuadrícula; al pulsar, en grande (con flechas, teclado o deslizando en el móvil).' },
      fields: [
        { name: 'image', label: 'Imagen', type: 'upload', relationTo: 'media', required: true },
        { name: 'caption', label: 'Pie de foto', type: 'textarea', required: true, maxLength: 400 },
        creditOverride,
      ] },
  ],
};

type Node = { type?: string; children?: Node[]; fields?: { blockType?: string; image?: unknown; images?: { image?: unknown }[] } };

/** Imágenes (ids) de los bloques «Imagen» y «Galería» del texto, en orden y sin repetir. */
export function bodyImageIDs(body: unknown): number[] {
  const out: number[] = [];
  const walk = (node?: Node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'block' && node.fields) {
      if (node.fields.blockType === 'imagen') out.push(relationID(node.fields.image) ?? NaN);
      if (node.fields.blockType === 'galeria') for (const item of node.fields.images ?? []) out.push(relationID(item?.image) ?? NaN);
    }
    for (const child of node.children ?? []) walk(child);
  };
  walk((body as { root?: Node } | null)?.root);
  return [...new Set(out.filter(Number.isInteger))];
}
/** ¿Lleva alguna galería? (para /multimedia) */
export function hasGallery(body: unknown): boolean {
  let found = false;
  const walk = (node?: Node) => {
    if (!node || found) return;
    if (node.type === 'block' && node.fields?.blockType === 'galeria' && (node.fields.images ?? []).length >= 2) found = true;
    for (const child of node.children ?? []) walk(child);
  };
  walk((body as { root?: Node } | null)?.root);
  return found;
}

/** Rellena los campos ocultos `bodyImages` y `hasGallery` a partir del texto (antes de validar los derechos). */
export const deriveBodyImages: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const body = Object.prototype.hasOwnProperty.call(data, 'body') ? data.body : originalDoc?.body;
  data.bodyImages = bodyImageIDs(body);
  data.hasGallery = hasGallery(body);
  return data;
};

/** Plantillas gráficas propias (public/plantillas/*.png, 1600×1000), con el crédito «Planta 14». */
export const TEMPLATES = [
  ['sucesos', 'Sucesos'], ['economia', 'Economía'], ['empresas', 'Empresas'], ['politica', 'Política'], ['sociedad', 'Sociedad'],
  ['deportes', 'Deportes'], ['cultura', 'Cultura'], ['patrimonio', 'Patrimonio'], ['opinion', 'Opinión'], ['agenda', 'Agenda'],
  ['formacion', 'Formación'], ['ayudas', 'Ayudas'], ['empleo', 'Empleo'], ['fiestas', 'Fiestas'],
] as const;
export type TemplateSlug = typeof TEMPLATES[number][0];
export const templateOptions = TEMPLATES.map(([value, label]) => ({ value, label }));
export const isTemplate = (value: unknown): value is TemplateSlug => TEMPLATES.some(([slug]) => slug === value);
