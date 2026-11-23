import { APIError, type CollectionConfig, type FieldHook } from 'payload';
import { adminOnly, editorialUser, notMunicipal } from './access';
import { auditAfterChange, auditAfterDelete } from './activity';
import { revalidateAfterChange, revalidateAfterDelete } from './revalidate';

/** Slug de una etiqueta: sin tildes, eñes, mayúsculas ni espacios. Dos nombres con el mismo slug son la misma etiqueta. */
export function tagSlug(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}
/** Nombre limpio: sin espacios repetidos ni al principio o al final. */
export const tagName = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);

/**
 * El slug sale siempre del nombre (no se elige a mano) y no se puede repetir: «Minería», «mineria» y «MINERÍA» son la
 * misma etiqueta. Si ya existe, el error dice cuál usar.
 */
const slugFromName: FieldHook = async ({ data, originalDoc, req }) => {
  const name = tagName(data?.name ?? originalDoc?.name);
  const slug = tagSlug(name);
  if (!slug) throw new APIError('Escribe el nombre de la etiqueta', 400, undefined, true);
  const clash = await req.payload.find({ collection: 'tags', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true, req });
  const other = clash.docs[0];
  if (other && other.id !== originalDoc?.id) throw new APIError(`Ya existe la etiqueta «${other.name}»: búscala y elígela en la lista.`, 400, undefined, true);
  return slug;
};

/** Etiquetas (temas) de las noticias y la opinión: /etiqueta/[slug]. Las crea y edita la redacción; borrar, la administración. */
export const Tags: CollectionConfig = {
  slug: 'tags',
  labels: { singular: 'Etiqueta', plural: 'Etiquetas' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'slug', 'updatedAt'], description: 'Temas que agrupan noticias de distintas secciones y concejos (p. ej. «Minería», «Fiestas de San Juan»). Cada etiqueta tiene su página en /etiqueta/….' },
  // Lectura pública (como las secciones), nunca para las cuentas municipales.
  access: { read: notMunicipal, create: editorialUser, update: editorialUser, delete: adminOnly },
  hooks: {
    beforeValidate: [({ data }) => { if (data && 'name' in data) data.name = tagName(data.name); return data; }],
    afterChange: [revalidateAfterChange, auditAfterChange],
    afterDelete: [revalidateAfterDelete, auditAfterDelete],
  },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true, maxLength: 60,
      admin: { description: 'Corto y en minúscula salvo nombres propios: «minería», «Hunosa», «fiestas de San Juan».' } },
    { name: 'slug', label: 'Dirección (slug)', type: 'text', unique: true, index: true,
      hooks: { beforeValidate: [slugFromName] },
      admin: { readOnly: true, position: 'sidebar', description: 'Se crea sola a partir del nombre.' } },
  ],
};
