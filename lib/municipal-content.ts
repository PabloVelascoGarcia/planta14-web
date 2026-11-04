import { contentSource } from './content-source';
import { getMunicipalSpace as demoSpace, municipalContents, spaceIsActive, type MunicipalSpace } from './demo/municipal';
import { visibleTowns } from './demo/territories';

export async function getMunicipalSpace(slug: string) {
  if (contentSource() === 'demo') return demoSpace(slug);
  return (await (await import('./payload-content')).payloadSpaces()).find(space => space.id === slug);
}
export async function getMunicipalContents() {
  return contentSource() === 'demo' ? municipalContents : (await import('./payload-content')).payloadMunicipalContent();
}
/** Espacios municipales visibles; `activos` deja solo los que tienen la suscripción en vigor (o la demo). */
export async function getMunicipalSpaces({ activos = false } = {}): Promise<MunicipalSpace[]> {
  const spaces = contentSource() === 'demo'
    ? visibleTowns().map(town => demoSpace(town.slug)).filter((space): space is MunicipalSpace => Boolean(space))
    : await (await import('./payload-content')).payloadSpaces();
  return activos ? spaces.filter(space => spaceIsActive(space)) : spaces;
}
