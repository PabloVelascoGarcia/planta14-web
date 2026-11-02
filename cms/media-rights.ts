import { APIError, type Access, type CollectionAfterChangeHook, type CollectionAfterDeleteHook, type PayloadRequest, type Where } from 'payload';
import { editorialUser, municipalSpaceOf, relationID } from './access';
import { syncPublicMedia } from './public-media';

/** Anonymous visitors only see metadata of images in published content (indexed field kept by hooks). */
export const publicMediaFilter: Where = { and: [{ publishedUses: { greater_than: 0 } }, { rightsScope: { equals: 'publicable' } }] };

export const readMedia: Access = (args) => {
  if (editorialUser(args)) return true;
  const space = municipalSpaceOf(args.req);
  if (space !== null) return { or: [{ uploadedBySpace: { equals: space } }, publicMediaFilter] };
  // Signed downloads through /api/cms/media/file are reserved for authenticated panels.
  // The public site uses the public copy (PUBLIC_MEDIA_BASE_URL).
  if ((args as { isReadingStaticFile?: boolean }).isReadingStaticFile) return false;
  return publicMediaFilter;
};

export async function validatePublishedImages(data: Record<string, unknown>, req: PayloadRequest) {
  if (data._status !== 'published') return;
  for (const value of [data.image, data.seoImage]) {
    const id = relationID(value);
    if (!id) continue;
    const image = await req.payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true, req });
    if (image.rightsScope !== 'publicable' || !image.rightsHolder || !image.rightsType) throw new APIError('La imagen no tiene derechos publicables completos', 400);
  }
}

const imageIDs = (doc?: Record<string, unknown> | null) => doc ? [doc.image, doc.seoImage].map(relationID).filter((id): id is number => id !== null) : [];

/** Keeps Media.publishedUses and the public copies in step with publication, unpublication and deletion. */
export const syncLinkedMedia: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  for (const id of new Set([...imageIDs(doc), ...imageIDs(previousDoc)])) await syncPublicMedia(req.payload, id, req);
  return doc;
};
export const syncLinkedMediaAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  for (const id of new Set(imageIDs(doc))) await syncPublicMedia(req.payload, id, req);
  return doc;
};
