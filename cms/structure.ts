import type { Payload, CollectionSlug, RequiredDataFromCollectionSlug } from 'payload';
import towns from '../lib/demo/data/territories.json';
import spaces from '../lib/demo/data/municipal-spaces.json';
import { siteSections } from '../lib/site-sections';

// Carga SOLO de estructura para producción (npm run cms:structure): las secciones de la navegación, los
// concejos visibles del Caudal y un espacio municipal por concejo en estado INACTIVO. Ningún contenido de
// demostración: ni noticias, ni avisos, ni autores, ni imágenes, ni los datos de contacto de ejemplo.
// Se puede repetir: lo que ya existe (por slug o identificador) no se toca ni se duplica.
export const structureProvenance = 'planta14-estructura-produccion';
export const sectionSlug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const caudalTowns = () => towns.filter(t => t.type === 'concejo' && t.parent === 'caudal' && t.visible);

export type StructureReport = { created: Record<'sections' | 'towns' | 'municipal-spaces', number>; existing: Record<'sections' | 'towns' | 'municipal-spaces', number> };

export async function loadStructure(payload: Payload): Promise<StructureReport> {
  const report: StructureReport = { created: { sections: 0, towns: 0, 'municipal-spaces': 0 }, existing: { sections: 0, towns: 0, 'municipal-spaces': 0 } };
  async function ensure<T extends 'sections' | 'towns' | 'municipal-spaces'>(collection: T, field: string, value: string | number, data: RequiredDataFromCollectionSlug<T>) {
    // draft: true también encuentra lo que exista solo como borrador; así nunca se duplica.
    const current = await payload.find({ collection: collection as CollectionSlug, where: { [field]: { equals: value } }, depth: 0, limit: 1, overrideAccess: true, draft: true });
    if (current.docs[0]) { report.existing[collection]++; return current.docs[0] as { id: number }; }
    report.created[collection]++;
    return payload.create({ collection, data, overrideAccess: true }) as Promise<{ id: number }>;
  }
  for (const [position, name] of siteSections.entries()) await ensure('sections', 'slug', sectionSlug(name), { slug: sectionSlug(name), name, position });
  for (const town of caudalTowns()) {
    const townDoc = await ensure('towns', 'slug', town.slug, { legacyID: town.id, slug: town.slug, name: town.name, comarca: 'Caudal', visible: true, provenance: structureProvenance });
    const space = spaces.find(s => s.territory === town.id);
    if (!space) throw new Error(`Falta el espacio municipal de ${town.name}`);
    // Un espacio por concejo (town es único): se busca por concejo, no por el identificador de la demo.
    await ensure('municipal-spaces', 'town', townDoc.id, { legacyID: space.id, town: townDoc.id, name: space.name, medium: space.medium,
      subscription: { status: 'inactive', startsAt: null, endsAt: null }, contact: { place: '', hours: '', note: '' }, provenance: structureProvenance, _status: 'published' });
  }
  return report;
}
