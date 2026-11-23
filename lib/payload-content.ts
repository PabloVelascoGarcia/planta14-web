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
import { isTemplate } from '../cms/article-images';
import { slugText } from './slug';
import type { Article as PayloadArticle, Author as PayloadAuthor, Media, MunicipalContent as PayloadMunicipalContent, MunicipalSpace as PayloadSpace, Section, Tag, Town } from '../cms/payload-types';
export type PublicImage = { url: string; srcSet?: string; alt: string; credit: string; width?: number; height?: number; focus?: string; ai?: boolean };

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
/**
 * Imagen para redes y Google Discover (Open Graph y JSON-LD): al menos 1200 px de ancho siempre que la foto los tenga.
 * Primero la variante «hero» (1600 px); si no existe (original más estrecho), el original; «card» (800 px) solo si
 * el original es aún más pequeño.
 */
export function shareImage(value?: number | Media | null): Article['shareImage'] {
  if (!value || typeof value === 'number' || mediaURL(value) === '/images/placeholder.svg') return undefined;
  const variant = (size: 'hero' | 'card') => {
    const v = value.sizes?.[size];
    const url = v?.filename ? publicURL(value, v.filename) : null;
    return url ? { url, width: v?.width ?? undefined, height: v?.height ?? undefined, alt: value.alt } : null;
  };
  const original = { url: mediaURL(value), width: value.width ?? undefined, height: value.height ?? undefined, alt: value.alt };
  return variant('hero') ?? ((value.width ?? 0) >= 1200 ? original : variant('card') ?? original);
}
/** Punto de interés de una imagen como `object-position` («50% 30%»); vacío si es el centro. */
export function imageFocus(value?: number | Media | null): string | undefined {
  if (!value || typeof value === 'number') return undefined;
  const x = Number(value.focalX ?? 50), y = Number(value.focalY ?? 50);
  return Number.isFinite(x) && Number.isFinite(y) && (Math.round(x) !== 50 || Math.round(y) !== 50) ? `${Math.round(x)}% ${Math.round(y)}%` : undefined;
}
const isAI = (value?: number | Media | null) => Boolean(value && typeof value === 'object' && value.imageKind === 'ia');
/** Imagen pública de un bloque del texto (o null si no es pública). */
export function publicImage(value?: number | Media | null): PublicImage | null {
  if (!value || typeof value === 'number' || mediaURL(value) === '/images/placeholder.svg') return null;
  return { url: mediaURL(value), ...(imageSrcSet(value) ? { srcSet: imageSrcSet(value) } : {}), alt: value.alt || '', credit: value.credit || '',
    ...(value.width ? { width: value.width, height: value.height ?? undefined } : {}), ...(imageFocus(value) ? { focus: imageFocus(value) } : {}), ...(isAI(value) ? { ai: true } : {}) };
}
type BlockNode = { type?: string; children?: BlockNode[]; fields?: Record<string, unknown> & { blockType?: string } };
const idOf = (value: unknown) => typeof value === 'number' ? value : value && typeof value === 'object' ? Number((value as { id?: unknown }).id) : NaN;
/**
 * Texto con los bloques «Imagen» y «Galería» resueltos a sus imágenes públicas (URL, srcset, pie, crédito, cartel). Un
 * bloque cuya imagen no es pública (sin derechos, sin copia) no se muestra.
 */
export function resolveBodyBlocks(body: unknown, media: (number | Media)[] | null | undefined): unknown {
  if (!body || typeof body !== 'object') return body;
  const byID = new Map((media ?? []).filter((m): m is Media => typeof m === 'object' && m !== null).map(m => [m.id, m]));
  const resolve = (value: unknown) => publicImage(typeof value === 'object' && value && 'url' in value ? value as Media : byID.get(idOf(value)) ?? null);
  const walk = (node: BlockNode): BlockNode | null => {
    if (node.type === 'block' && node.fields) {
      const f = node.fields;
      if (f.blockType === 'imagen') {
        const image = resolve(f.image);
        return image ? { ...node, fields: { blockType: 'imagen', image, caption: String(f.caption ?? ''), credit: String(f.credit ?? '') || image.credit, poster: Boolean(f.poster) } } : null;
      }
      if (f.blockType === 'galeria') {
        const images = ((f.images as { image?: unknown; caption?: unknown; credit?: unknown }[]) ?? []).map(item => {
          const image = resolve(item.image);
          return image ? { image, caption: String(item.caption ?? ''), credit: String(item.credit ?? '') || image.credit } : null;
        }).filter(Boolean);
        return images.length ? { ...node, fields: { blockType: 'galeria', images } } : null;
      }
      return null;
    }
    return node.children ? { ...node, children: node.children.map(walk).filter((n): n is BlockNode => n !== null) } : node;
  };
  const root = (body as { root?: BlockNode }).root;
  return root ? { ...body, root: walk(root) } : body;
}
/** Plantilla de la sección principal (o la elegida) cuando no hay foto: public/plantillas/[slug].png, crédito «Planta 14». */
function templateImage(doc: PayloadArticle, sectionSlug: string) {
  const chosen = doc.template && doc.template !== 'none' ? doc.template : null;
  const slug = chosen ?? (isTemplate(sectionSlug) ? sectionSlug : 'planta14');
  return { image: `/plantillas/${slug}.png`, imageAlt: '', imageCredit: 'Planta 14', imageTemplate: true as const };
}

export function articleContract(doc: PayloadArticle): Article {
  const author = populated(doc.author);
  const town = populated(doc.town);
  const section = populated(doc.section);
  const image = typeof doc.image === 'object' ? doc.image : null;
  const others = (doc.otherTowns ?? []).filter((t): t is Town => typeof t === 'object' && t !== null && t.id !== town.id);
  const secondary = (doc.secondarySections ?? []).filter((t): t is Section => typeof t === 'object' && t !== null && t.id !== section.id).slice(0, 2);
  const tags = (doc.tags ?? []).filter((t): t is Tag => typeof t === 'object' && t !== null && Boolean(t.slug)).slice(0, 5);
  const hasPhoto = mediaURL(doc.image) !== '/images/placeholder.svg';
  const body = resolveBodyBlocks(doc.body, doc.bodyImages);
  return {
    id: doc.legacyID || String(doc.id), slug: doc.slug || String(doc.id), title: doc.title, excerpt: doc.excerpt,
    body: lexicalToParagraphs(doc.body), ...(toLexical(body) && !isPlainParagraphs(body) ? { bodyRich: toLexical(body)! } : {}),
    ...(hasPhoto ? { image: mediaURL(doc.image), ...(imageSrcSet(doc.image) ? { imageSrcSet: imageSrcSet(doc.image) } : {}), imageAlt: image?.alt || '', imageCredit: image?.credit || '',
      ...(imageFocus(image) ? { imageFocus: imageFocus(image) } : {}), ...(isAI(image) ? { imageAI: true } : {}),
      ...(image?.width && image.height ? { imageWidth: image.width, imageHeight: image.height } : {}) } : templateImage(doc, slugText(section.name))),
    ...(doc.imagePoster ? { imagePoster: true } : {}),
    date: doc.date || madridLocal(doc.publishedAt).slice(0, 10), author: author.name, authorSlug: author.slug,
    comarca: town.comarca, concejo: town.name, topic: section.name, status: 'published',
    ...(others.length ? { concejos: [town.name, ...others.map(t => t.name)] } : {}),
    ...(secondary.length ? { topics: [section.name, ...secondary.map(t => t.name)] } : {}),
    ...(tags.length ? { tags: tags.map(t => ({ name: t.name, slug: t.slug! })) } : {}),
    ...(doc.hasGallery ? { hasGallery: true } : {}), version: String(doc.updatedAt || doc.publishedAt || ''),
    publishedAt: doc.publishedAt || doc.date || '', scheduledAt: doc.scheduledAt || undefined,
    seoTitle: doc.seoTitle || doc.title, seoDescription: doc.seoDescription || doc.excerpt, seoImage: mediaURL(doc.seoImage || doc.image),
    main: Boolean(doc.main), featured: Boolean(doc.featured), opinion: Boolean(doc.opinion),
    // Optional keys only when present, so the presentation contract stays identical without them.
    ...(shareImage(doc.seoImage || doc.image) ? { shareImage: shareImage(doc.seoImage || doc.image) } : {}),
    ...(doc.seoImage && mediaURL(doc.seoImage) !== '/images/placeholder.svg' ? { customShareImage: true } : {}),
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
  const [sections, towns, galleries] = await Promise.all([
    payload.find({ collection: 'sections', overrideAccess: false, pagination: false, sort: 'position' }),
    payload.find({ collection: 'towns', overrideAccess: false, pagination: false, where: { visible: { equals: true } }, sort: 'id' }),
    // «Multimedia» entra en el menú solo con al menos 6 noticias publicadas con galería.
    payload.count({ collection: 'articles', overrideAccess: false, where: { and: [{ _status: { equals: 'published' } }, { hasGallery: { equals: true } }] } }),
  ]);
  const { MULTIMEDIA_MIN } = await import('./taxonomy');
  return { sectionNames: sections.docs.map(s => s.name), townSlugs: towns.docs.map(t => t.slug), multimedia: galleries.totalDocs >= MULTIMEDIA_MIN,
    navigationTerritories: Object.fromEntries([...new Set(towns.docs.map(t => t.comarca))].map(comarca => [comarca, towns.docs.filter(t => t.comarca === comarca).map(t => t.name)])) };
}

/** Fiestas publicadas (lib/fiestas.ts): sin organizador, contacto ni datos de quien las envía. */
export async function payloadFiestas(): Promise<import('./fiestas').Fiesta[]> {
  const payload = await contentClient();
  const result = await payload.find({ collection: 'festivals', overrideAccess: false, depth: 1, pagination: false, sort: 'startDay', where: { and: [{ _status: { equals: 'published' } }, { dateStatus: { equals: 'confirmada' } }, { startDay: { exists: true } }] } });
  // Solo fiestas publicadas con la fecha confirmada: un borrador o una fiesta del catálogo sin fecha nunca sale en la web.
  return result.docs.filter(doc => typeof doc.town === 'object' && doc.town && doc.startDay).map(doc => {
    const town = doc.town as Town;
    const image = typeof doc.image === 'object' && doc.image && mediaURL(doc.image) !== '/images/placeholder.svg' ? doc.image : null;
    const chronicle = typeof doc.chronicle === 'object' && doc.chronicle && doc.chronicle._status === 'published' ? doc.chronicle : null;
    return { slug: doc.slug!, name: doc.name, village: doc.village, town: town.name, townSlug: town.slug, startDay: doc.startDay!, endDay: doc.endDay || doc.startDay!, ...(doc.description ? { description: doc.description } : {}),
      recurring: Boolean(doc.recurring), ...(toLexical(doc.program) ? { program: toLexical(doc.program)! } : {}),
      ...(image ? { image: { url: mediaURL(image), ...(imageSrcSet(image) ? { srcSet: imageSrcSet(image) } : {}), alt: image.alt, credit: image.credit } } : {}),
      ...(chronicle ? { chronicle: { slug: chronicle.slug!, title: chronicle.title } } : {}) };
  });
}

/** Cartas de los lectores publicadas: solo nombre, apellidos, concejo, título, texto y fecha. */
export async function payloadLetters(limit?: number) {
  const payload = await contentClient();
  const result = await payload.find({ collection: 'letters', overrideAccess: false, depth: 1, pagination: Boolean(limit), limit: limit ?? 0, sort: '-publishedAt', where: { status: { equals: 'aprobada' } } });
  return result.docs.map(doc => ({ id: doc.id, name: `${doc.firstName} ${doc.lastName}`, town: typeof doc.town === 'object' && doc.town ? doc.town.name : '',
    title: doc.title || null, text: doc.text, publishedAt: doc.publishedAt || doc.createdAt }));
}
