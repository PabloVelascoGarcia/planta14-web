import { APIError, type Access, type CollectionAfterChangeHook, type CollectionAfterDeleteHook, type PayloadRequest, type Where } from 'payload';
import { editorialUser, municipalSpaceOf, notMunicipal, relationID } from './access';
import { syncPublicMedia } from './public-media';
import { withPublicMediaLock } from './public-media-lock';

/** Anonymous visitors only see metadata of images in published content (indexed field kept by hooks). */
export const publicMediaFilter: Where = { and: [{ publishedUses: { greater_than: 0 } }, { rightsScope: { equals: 'publicable' } }] };

export const readMedia: Access = (args) => {
  if (editorialUser(args)) return true;
  const space = municipalSpaceOf(args.req);
  if (!notMunicipal(args)) return space === null ? false : { uploadedBySpace: { equals: space } };
  // Signed downloads through /api/cms/media/file are reserved for authenticated panels.
  // The public site uses the public copy (PUBLIC_MEDIA_BASE_URL).
  if ((args as { isReadingStaticFile?: boolean }).isReadingStaticFile) return false;
  return publicMediaFilter;
};

/**
 * ¿Este guardado publica de verdad? Al publicar (_status «published») o al guardar sin más algo que ya estaba
 * publicado. Guardar un borrador (_status «draft» o ?draft=true) o despublicar nunca cuenta como publicar: así las
 * comprobaciones de «para publicar…» no impiden despublicar ni guardar borradores.
 */
export function isPublishing(data: Record<string, unknown>, originalDoc: Record<string, unknown> | undefined | null, req: PayloadRequest) {
  const requested = data._status;
  if (requested === 'draft' || String((req.query as Record<string, unknown> | undefined)?.draft) === 'true') return false;
  return requested === 'published' || (requested === undefined && originalDoc?._status === 'published');
}

export async function validatePublishedImages(data: Record<string, unknown>, req: PayloadRequest, originalDoc?: Record<string, unknown> | null) {
  if (originalDoc !== undefined ? !isPublishing(data, originalDoc, req) : data._status !== 'published') return;
  if (originalDoc) data = { ...originalDoc, ...data };
  const identity = data.identity as { heroImage?: unknown; crestImage?: unknown } | undefined;
  for (const value of [data.image, data.seoImage, identity?.heroImage, identity?.crestImage]) {
    const id = relationID(value);
    if (!id) continue;
    const image = await req.payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true, req });
    if (image.rightsScope !== 'publicable' || !image.rightsHolder || !image.rightsType) throw new APIError('La imagen no tiene derechos publicables completos: ábrela en Imágenes y marca la declaración de derechos (o sube otra)', 400);
  }
}

const imageIDs = (doc?: Record<string, unknown> | null) => {
  if (!doc) return [];
  const identity = doc.identity as { heroImage?: unknown; crestImage?: unknown } | undefined;
  return [doc.image, doc.seoImage, identity?.heroImage, identity?.crestImage].map(relationID).filter((id): id is number => id !== null);
};

/** Keeps Media.publishedUses and the public copies in step with publication, unpublication and deletion. */
export const syncLinkedMedia: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const ids = [...new Set([...imageIDs(doc), ...imageIDs(previousDoc)])];
  for (const id of [...ids].sort((a, b) => a - b)) await withPublicMediaLock(req.payload, id, req, async () => undefined);
  for (const id of ids) await syncPublicMedia(req.payload, id, req);
  return doc;
};
export const syncLinkedMediaAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  for (const id of [...new Set(imageIDs(doc))].sort((a, b) => a - b)) await syncPublicMedia(req.payload, id, req);
  return doc;
};
