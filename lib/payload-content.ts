import type { Article, Author } from './mock-data';
import type { MunicipalContent, MunicipalSpace } from './demo/municipal';
import type { MunicipalIdentity } from './municipal-identity';
import { isPlainParagraphs, lexicalToParagraphs, toLexical } from './rich-text';
/** Fecha y hora de Madrid en formato AAAA-MM-DDTHH:MM (agenda). */
function madridLocal(iso: string | null | undefined) {
  if (!iso || Number.isNaN(Date.parse(iso))) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
import { publicURL } from '../cms/public-media';
import type { Article as PayloadArticle, Author as PayloadAuthor, Media, MunicipalContent as PayloadMunicipalContent, MunicipalSpace as PayloadSpace, Town } from '../cms/payload-types';

export async function contentClient() {
  if (process.env.CMS_ENABLED !== 'true') throw new Error('CONTENT_SOURCE=payload requiere CMS_ENABLED=true');
  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('../payload.config')]);
  return getPayload({ config });
}
function populated<T>(value: number | T): T {
  if (typeof value === 'number') throw new Error('Relación de contenido no disponible');
  return value;
}
// Public pages only use the public copy (PUBLIC_MEDIA_BASE_URL, behind a CDN). Signed URLs are for authenticated panels.
export function mediaURL(value?: number | Media | null) {
  return value && typeof value !== 'number' && value.rightsScope === 'publicable' && value.rightsHolder && value.rightsType && value.publicURL ? value.publicURL : '/images/placeholder.svg';
}
/** srcset de la copia pública: tamaños generados («card» 800 px, «hero» 1600 px) y el original, de menor a mayor. */
export function imageSrcSet(value?: number | Media | null): string | undefined {
  if (!value || typeof value === 'number' || mediaURL(value) === '/images/placeholder.svg') return undefined;
  const entries = new Map<number, string>();
  for (const size of ['card', 'hero'] as const) {
    const variant = value.sizes?.[size];
    const url = variant?.filename && variant.width ? publicURL(value, variant.filename) : null;
    if (url && variant?.width) entries.set(variant.width, url);
  }
  if (value.width) entries.set(value.width, mediaURL(value));
  return entries.size > 1 ? [...entries].sort(([a], [b]) => a - b).map(([width, url]) => `${url} ${width}w`).join(', ') : undefined;
}
/** Social preview image: the "hero" variant (1600 px) of the public copy, falling back to "card" and the original. */
export function shareImage(value?: number | Media | null): Article['shareImage'] {
  if (!value || typeof value === 'number' || mediaURL(value) === '/images/placeholder.svg') return undefined;
  for (const size of ['hero', 'card'] as const) {
    const variant = value.sizes?.[size];
    const url = variant?.filename ? publicURL(value, variant.filename) : null;
    if (url) return { url, width: variant?.width ?? undefined, height: variant?.height ?? undefined, alt: value.alt };
  }
  return { url: mediaURL(value), width: value.width ?? undefined, height: value.height ?? undefined, alt: value.alt };
}
export function articleContract(doc: PayloadArticle): Article {
  const author = populated(doc.author);
  const town = populated(doc.town);
  const section = populated(doc.section);
  const image = typeof doc.image === 'object' ? doc.image : null;
  return {
    id: doc.legacyID || String(doc.id), slug: doc.slug || String(doc.id), title: doc.title, excerpt: doc.excerpt,
    body: lexicalToParagraphs(doc.body), ...(toLexical(doc.body) && !isPlainParagraphs(doc.body) ? { bodyRich: toLexical(doc.body)! } : {}), image: mediaURL(doc.image), ...(imageSrcSet(doc.image) ? { imageSrcSet: imageSrcSet(doc.image) } : {}), imageAlt: image?.alt || '', imageCredit: image?.credit || '',
    date: doc.date || madridLocal(doc.publishedAt).slice(0, 10), author: author.name, authorSlug: author.slug,
    comarca: town.comarca, concejo: town.name, topic: section.name, status: 'published',
    publishedAt: doc.publishedAt || doc.date || '', scheduledAt: doc.scheduledAt || undefined,
    seoTitle: doc.seoTitle || doc.title, seoDescription: doc.seoDescription || doc.excerpt, seoImage: mediaURL(doc.seoImage || doc.image),
    main: Boolean(doc.main), featured: Boolean(doc.featured), opinion: Boolean(doc.opinion),
    // Optional keys only when present, so the presentation contract stays identical without them.
    ...(shareImage(doc.seoImage || doc.image) ? { shareImage: shareImage(doc.seoImage || doc.image) } : {}),
    sourceName: doc.sourceName || undefined, sourceUrl: doc.sourceUrl || undefined, sourceAuthor: doc.sourceAuthor || undefined,
    ...(doc.showInTown === false ? { showInTown: false } : {}),
    ...(doc.agenda?.eventAt ? { eventAt: madridLocal(doc.agenda.eventAt), ...(doc.agenda.place ? { eventPlace: doc.agenda.place } : {}) } : {}),
  };
}
export async function payloadArticles(): Promise<Article[]> {
  const payload = await contentClient();
  const result = await payload.find({ collection: 'articles', overrideAccess: false, where: { _status: { equals: 'published' } }, depth: 2, pagination: false, sort: '-publishedAt' });
  return result.docs.map(articleContract).sort((a, b) => (b.publishedAt || b.date).localeCompare(a.publishedAt || a.date));
}
export function authorContract(doc: PayloadAuthor): Author {
  return { name: doc.name, slug: doc.slug, role: doc.role || '', bio: doc.bio || '' };
}
export async function payloadAuthors(): Promise<Author[]> {
  const payload = await contentClient();
  return (await payload.find({ collection: 'authors', overrideAccess: false, depth: 0, pagination: false })).docs.map(authorContract).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}
export function spaceContract(doc: PayloadSpace): MunicipalSpace {
  const town = populated<Town>(doc.town);
  const identity = identityContract(doc.identity, town.name);
  return { id: doc.legacyID || town.slug, territory: town.slug, medium: doc.medium, name: doc.name, crest: null,
    subscription: { status: doc.subscription?.status || 'inactive', startsAt: doc.subscription?.startsAt || null, endsAt: doc.subscription?.endsAt || null },
    contact: { place: doc.contact?.place || '', hours: doc.contact?.hours || '', note: doc.contact?.note || '' },
    ...(identity ? { identity } : {}) };
}
/** Public URL of an identity image chosen in Imágenes (hero variant when it exists); null if not public. */
function identityImageURL(value: unknown, variant?: 'hero') {
  if (!value || typeof value !== 'object') return null;
  const media = value as Media;
  if (mediaURL(media) === '/images/placeholder.svg') return null;
  const file = variant ? media.sizes?.[variant]?.filename : null;
  return (file ? publicURL(media, file) : null) || mediaURL(media);
}
/** Identidad visual del espacio (CMS). Vacía → undefined: la página usa el diseño neutro. */
export function identityContract(value: PayloadSpace['identity'], townName: string): MunicipalIdentity | undefined {
  if (!value) return undefined;
  const hero = identityImageURL(value.heroImage, 'hero');
  const heroMedia = hero && typeof value.heroImage === 'object' ? value.heroImage as Media : null;
  const crest = identityImageURL(value.crestImage);
  const text = (v?: string | null) => v?.trim() || undefined;
  const identity: MunicipalIdentity = {
    name: townName,
    image: hero || text(value.heroImagePath), imageAlt: text(value.heroImageAlt) ?? heroMedia?.alt ?? undefined,
    imageCredit: text(value.heroImageCredit) ?? heroMedia?.credit ?? undefined, imageSource: text(value.heroImageSource), imageLicenseUrl: text(value.heroImageLicenseUrl),
    title: text(value.title), subtitle: text(value.subtitle),
    crest: crest || text(value.crestPath), crestCredit: text(value.crestCredit), crestSource: text(value.crestSource), crestLicenseUrl: text(value.crestLicenseUrl),
    accent: text(value.colors?.accent), dark: text(value.colors?.dark), soft: text(value.colors?.soft), border: text(value.colors?.border),
    official: text(value.official), tourism: text(value.tourism),
    stories: (value.stories || []).map((story, i) => ({ id: String(i), number: String(i + 1).padStart(2, '0'), label: story.label, title: story.title, text: story.text, href: story.href })),
  };
  const filled = Object.entries(identity).some(([key, v]) => key !== 'name' && (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  return filled ? identity : undefined;
}
export async function payloadSpaces(): Promise<MunicipalSpace[]> {
  const payload = await contentClient();
  const result = await payload.find({ collection: 'municipal-spaces', overrideAccess: false, depth: 1, pagination: false, where: { _status: { equals: 'published' } } });
  return result.docs.filter(doc => typeof doc.town === 'object' && doc.town.visible).map(spaceContract);
}
export function municipalContract(doc: PayloadMunicipalContent): MunicipalContent {
  const space = populated(doc.space);
  const image = typeof doc.image === 'object' && doc.image ? doc.image : null;
  return { id: doc.legacyID || String(doc.id), space: space.legacyID!, type: doc.type, title: doc.title, excerpt: doc.excerpt, body: doc.body,
    origin: 'municipality', status: 'published', publishedAt: doc.publishedAt, expiresAt: doc.expiresAt || null, eventAt: doc.eventAt || null,
    place: doc.place || null, deadline: doc.deadline || null, attachments: (doc.attachments || []).map(({ url, title }) => ({ url, title })),
    demo: Boolean(doc.demo), ...(doc.sourceUrl ? { sourceUrl: doc.sourceUrl } : {}),
    ...(image && mediaURL(image) !== '/images/placeholder.svg' ? { image: { url: mediaURL(image), ...(imageSrcSet(image) ? { srcSet: imageSrcSet(image) } : {}), alt: image.alt, credit: image.credit, share: shareImage(image) } } : {}) };
}
export async function payloadMunicipalContent(): Promise<MunicipalContent[]> {
  const payload = await contentClient();
  const result = await payload.find({ collection: 'municipal-content', overrideAccess: false, depth: 1, pagination: false, sort: 'id', where: { _status: { equals: 'published' } } });
  return result.docs.filter(doc => typeof doc.space === 'object' && doc.space?._status === 'published').map(municipalContract);
}

export async function payloadNavigation() {
  const payload = await contentClient();
  const [sections, towns] = await Promise.all([
    payload.find({ collection: 'sections', overrideAccess: false, pagination: false, sort: 'position' }),
    payload.find({ collection: 'towns', overrideAccess: false, pagination: false, where: { visible: { equals: true } }, sort: 'id' }),
  ]);
  return { sectionNames: sections.docs.map(s => s.name), townSlugs: towns.docs.map(t => t.slug),
    navigationTerritories: Object.fromEntries([...new Set(towns.docs.map(t => t.comarca))].map(comarca => [comarca, towns.docs.filter(t => t.comarca === comarca).map(t => t.name)])) };
}
