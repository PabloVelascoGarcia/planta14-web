import { createHash } from 'node:crypto';
import type { Payload, CollectionSlug, RequiredDataFromCollectionSlug } from 'payload';
import towns from '../lib/demo/data/territories.json';
import spaces from '../lib/demo/data/municipal-spaces.json';
import contents from '../lib/demo/data/municipal-content.json';
import { identitySeed } from './municipal-identity-seed';

export const municipalSectionNames = ['Economía', 'Empresas', 'Deportes', 'Cultura', 'Patrimonio', 'Agenda'];
const provenance = 'planta14-municipal-demo-reviewed-2026-11-02';
const officialHosts = new Set(['www.mieres.es', 'www.aytolena.es', 'www.valgrande-pajares.com', 'www.aller.es', 'www.asturiesculturaenrede.es', 'www.morcin.es', 'www.turismoasturias.es', 'www.ayuntamientoriosa.com']);
export function assertMunicipalProvenance() {
  const datasets = [towns, spaces, contents];
  const checksums = ['f31316f1c866ff1aa3054fa1d30b2745c72bed83eaa26b9a42e9e46694cb8e2e', '1090409f9a4e0b615fc9303b648ccd8c557968b7e68e3fcd546ec491789176f6', '0128d12c1f875870ab82a21484c1786a0f4f67f826f167c300f331d2e62a1e34'];
  datasets.forEach((data, i) => {
    if (createHash('sha256').update(JSON.stringify(data)).digest('hex') !== checksums[i]) throw new Error('El conjunto municipal ha cambiado: revisa su procedencia antes de importarlo');
  });
  if (/la voz|agenda p[uú]blica|lavdg|avoz\.es|agendapublica/i.test(JSON.stringify(datasets))) throw new Error('Fuente editorial excluida de la importación');
  for (const item of contents) {
    if (item.attachments.length || ('image' in item)) throw new Error('Esta importación no admite archivos ni imágenes');
    if (item.sourceUrl ? !officialHosts.has(new URL(item.sourceUrl).hostname) : !item.demo) throw new Error(`Origen no verificado: ${item.id}`);
  }
  return provenance;
}
export async function importMunicipalDemo(payload: Payload) {
  assertMunicipalProvenance();
  async function upsert<T extends CollectionSlug>(collection: T, field: string, value: string, data: RequiredDataFromCollectionSlug<T>) {
    const current = await payload.find({ collection, where: { [field]: { equals: value } }, depth: 0, limit: 1, overrideAccess: true });
    // Never overwrite editorial changes on subsequent runs.
    if (current.docs[0]) return current.docs[0];
    return payload.create({ collection, data, overrideAccess: true });
  }
  for (const [position, name] of municipalSectionNames.entries()) {
    const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    await upsert('sections', 'slug', slug, { slug, name, position });
  }
  for (const town of towns.filter(t => t.type === 'concejo' && t.parent === 'caudal' && t.visible)) {
    const townDoc = await upsert('towns', 'slug', town.slug, { legacyID: town.id, slug: town.slug, name: town.name, comarca: 'Caudal', visible: true, provenance });
    const space = spaces.find(s => s.territory === town.id)!;
    const spaceDoc = await upsert('municipal-spaces', 'legacyID', space.id, { legacyID: space.id, town: townDoc.id, name: space.name, medium: space.medium,
      subscription: { status: 'demo', startsAt: space.subscription.startsAt, endsAt: space.subscription.endsAt }, contact: space.contact, identity: identitySeed[space.id], provenance, _status: 'published' });
    for (const item of contents.filter(c => c.space === space.id)) {
      await upsert('municipal-content', 'legacyID', item.id, { legacyID: item.id, space: spaceDoc.id, type: item.type as 'news' | 'notice' | 'event' | 'grant' | 'announcement', title: item.title,
        excerpt: item.excerpt, body: item.body, origin: 'municipality', publishedAt: item.publishedAt, expiresAt: item.expiresAt, eventAt: item.eventAt, place: item.place,
        deadline: item.deadline, attachments: [], demo: item.demo, sourceUrl: item.sourceUrl, provenance, _status: 'published' });
    }
  }
}
