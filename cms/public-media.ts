import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Payload, PayloadRequest } from 'payload';

/**
 * Copias públicas de imágenes publicables.
 *
 * El bucket privado de Payload no se publica nunca. Cuando una imagen con derechos publicables se usa en
 * contenido publicado, se copia (original y variantes) a una ubicación pública con una clave aleatoria
 * nueva, `<PUBLIC_MEDIA_PREFIX>/<uuid>/<archivo>`, en PUBLIC_MEDIA_BUCKET (por defecto, el mismo bucket).
 * PUBLIC_MEDIA_BASE_URL es la URL (CDN) que sirve la raíz de ese bucket. Al dejar de cumplirse las
 * condiciones, la copia se borra. Como cada publicación usa una clave nueva, la caché puede ser larga e
 * inmutable sin que una URL antigua vuelva a servir una imagen retirada desde el origen.
 */
export function publicMediaSettings(env: NodeJS.ProcessEnv = process.env) {
  const baseURL = (env.PUBLIC_MEDIA_BASE_URL || '').replace(/\/+$/, '');
  if (baseURL && !/^https?:\/\//.test(baseURL)) throw new Error('PUBLIC_MEDIA_BASE_URL debe ser una URL http(s)');
  if (baseURL && env.NODE_ENV === 'production' && !baseURL.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(baseURL)) {
    throw new Error('PUBLIC_MEDIA_BASE_URL requiere HTTPS en producción');
  }
  const prefix = (env.PUBLIC_MEDIA_PREFIX ?? 'public').replace(/^\/+|\/+$/g, '');
  if (prefix.includes('..')) throw new Error('PUBLIC_MEDIA_PREFIX no válido');
  return {
    enabled: Boolean(baseURL),
    baseURL,
    bucket: env.PUBLIC_MEDIA_BUCKET || env.S3_BUCKET || '',
    privateBucket: env.S3_BUCKET || '',
    prefix,
    cacheControl: env.PUBLIC_MEDIA_CACHE_CONTROL || 'public, max-age=31536000, immutable',
  };
}

type MediaFile = { filename?: string | null; prefix?: string | null; mimeType?: string | null; publicKey?: string | null;
  sizes?: Record<string, { filename?: string | null; mimeType?: string | null } | undefined> | null };

/** Every stored file of a media document: original and resized variants. */
export function mediaFiles(doc: MediaFile): { filename: string; mimeType: string }[] {
  const files = [doc.filename ? { filename: doc.filename, mimeType: doc.mimeType || 'application/octet-stream' } : null,
    ...Object.values(doc.sizes || {}).map(size => size?.filename ? { filename: size.filename, mimeType: size.mimeType || doc.mimeType || 'application/octet-stream' } : null)];
  return files.filter((file): file is { filename: string; mimeType: string } => Boolean(file));
}

export function publicURL(doc: MediaFile, filename = doc.filename, env: NodeJS.ProcessEnv = process.env): string | null {
  const settings = publicMediaSettings(env);
  if (!settings.enabled || !doc.publicKey || !filename) return null;
  return `${settings.baseURL}/${doc.publicKey.split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(filename)}`;
}

let client: S3Client | undefined;
function s3() {
  client ??= new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || 'disabled', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'disabled' },
  });
  return client;
}

async function copyToPublic(doc: MediaFile, publicKey: string) {
  const settings = publicMediaSettings();
  try {
    for (const file of mediaFiles(doc)) {
      const source = await s3().send(new GetObjectCommand({ Bucket: settings.privateBucket, Key: path.posix.join(doc.prefix || '', file.filename) }));
      const body = await source.Body!.transformToByteArray();
      await s3().send(new PutObjectCommand({ Bucket: settings.bucket, Key: `${publicKey}/${file.filename}`, Body: body,
        ContentType: source.ContentType || file.mimeType, CacheControl: settings.cacheControl }));
    }
  } catch (error) {
    // Do not silently leave the successful part of a failed multipart set public.
    try { await deletePublic(doc, publicKey); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Falló la copia pública y su limpieza; requiere revisión del bucket'); }
    throw error;
  }
}

async function deletePublic(doc: MediaFile, publicKey: string) {
  const objects = mediaFiles(doc).map(file => ({ Key: `${publicKey}/${file.filename}` }));
  if (objects.length) {
    const result = await s3().send(new DeleteObjectsCommand({ Bucket: publicMediaSettings().bucket, Delete: { Objects: objects, Quiet: true } }));
    if (result.Errors?.length) throw new Error(`S3 no pudo borrar ${result.Errors.length} objetos públicos; conserva el registro para reintentar`);
  }
}

async function publicCopyComplete(doc: MediaFile, key: string) {
  for (const file of mediaFiles(doc)) {
    try { await s3().send(new HeadObjectCommand({ Bucket: publicMediaSettings().bucket, Key: `${key}/${file.filename}` })); }
    catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return false;
      throw error;
    }
  }
  return true;
}

/** Published documents that reference the image. Indexed relationship columns, no full scan of content. */
export async function countPublishedUses(payload: Payload, id: number, req?: PayloadRequest) {
  const published = { _status: { equals: 'published' } } as const;
  const [articles, municipal] = await Promise.all([
    payload.count({ collection: 'articles', overrideAccess: true, req, where: { and: [published, { or: [{ image: { equals: id } }, { seoImage: { equals: id } }] }] } }),
    payload.count({ collection: 'municipal-content', overrideAccess: true, req, where: { and: [published, { 'withdrawal.withdrawn': { not_equals: true } }, { image: { equals: id } }] } }),
  ]);
  return articles.totalDocs + municipal.totalDocs;
}

/**
 * Recalcula `publishedUses` (campo indexado que usa la lectura anónima) y crea o borra la copia pública.
 * Se llama desde los hooks de noticias, contenidos municipales y la propia biblioteca.
 */
export async function syncPublicMedia(payload: Payload, id: number, req?: PayloadRequest, options: { refresh?: boolean; previous?: MediaFile; verify?: boolean } = {}) {
  const doc = await payload.db.findOne<MediaFile & { id: number; rightsScope?: string | null; rightsHolder?: string | null; rightsType?: string | null; publishedUses?: number | null }>({ collection: 'media', where: { id: { equals: id } }, req });
  if (!doc) return;
  const uses = await countPublishedUses(payload, id, req);
  const settings = publicMediaSettings();
  const shouldBePublic = settings.enabled && uses > 0 && doc.rightsScope === 'publicable' && Boolean(doc.rightsHolder && doc.rightsType);
  let publicKey = doc.publicKey || null;
  const incomplete = publicKey && shouldBePublic && options.verify ? !await publicCopyComplete(doc, publicKey) : false;
  if (publicKey && (!shouldBePublic || options.refresh || incomplete)) {
    await deletePublic(options.previous || doc, publicKey);
    publicKey = null;
  }
  if (shouldBePublic && !publicKey) {
    const key = [settings.prefix, randomUUID()].filter(Boolean).join('/');
    await copyToPublic(doc, key);
    publicKey = key;
  }
  if ((doc.publishedUses ?? 0) !== uses || (doc.publicKey || null) !== publicKey) {
    await payload.db.updateOne({ collection: 'media', id, data: { publishedUses: uses, publicKey }, req });
  }
}

/** Reconciliación completa (tras restaurar copias o cambiar de bucket público). */
export async function syncAllPublicMedia(payload: Payload) {
  const all = await payload.find({ collection: 'media', overrideAccess: true, depth: 0, pagination: false, select: {} });
  for (const doc of all.docs) await syncPublicMedia(payload, doc.id, undefined, { verify: true });
  return all.docs.length;
}
