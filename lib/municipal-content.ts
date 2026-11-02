import { contentSource } from './content-source';
import { getMunicipalSpace as demoSpace, municipalContents } from './demo/municipal';

export async function getMunicipalSpace(slug: string) {
  if (contentSource() === 'demo') return demoSpace(slug);
  return (await (await import('./payload-content')).payloadSpaces()).find(space => space.id === slug);
}
export async function getMunicipalContents() {
  return contentSource() === 'demo' ? municipalContents : (await import('./payload-content')).payloadMunicipalContent();
}
