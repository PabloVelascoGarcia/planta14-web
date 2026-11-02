import { APIError, type Access, type PayloadRequest, type Where } from 'payload';
import { editorialUser } from './access';

export async function publishedMediaIDs(req: PayloadRequest): Promise<number[]> {
  const ids = new Set<number>();
  for (const collection of ['articles', 'municipal-content'] as const) {
    const result = await req.payload.find({ collection, where: { _status: { equals: 'published' } }, depth: 0, pagination: false, overrideAccess: true, req });
    for (const doc of result.docs) for (const value of [doc.image, 'seoImage' in doc ? doc.seoImage : null]) {
      if (typeof value === 'number') ids.add(value);
    }
  }
  return [...ids];
}

export const readMedia: Access = async (args) => {
  if (editorialUser(args)) return true;
  const filter: Where = { and: [{ id: { in: await publishedMediaIDs(args.req) } }, { rightsScope: { equals: 'publicable' } }] };
  return filter;
};

export async function validatePublishedImages(data: Record<string, unknown>, req: PayloadRequest) {
  if (data._status !== 'published') return;
  for (const value of [data.image, data.seoImage]) {
    const id = typeof value === 'object' && value ? (value as { id: number }).id : value;
    if (!id) continue;
    const image = await req.payload.findByID({ collection: 'media', id: id as number, depth: 0, overrideAccess: true, req });
    if (image.rightsScope !== 'publicable' || !image.rightsHolder || !image.rightsType) throw new APIError('La imagen no tiene derechos publicables completos', 400);
  }
}
