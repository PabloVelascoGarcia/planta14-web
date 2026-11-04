import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Payload, PayloadRequest } from 'payload';
import { withPublicMediaLock } from './public-media-lock';

/**
 * Copias públicas de imágenes publicables.
 *
 * El bucket privado de Payload no se publica nunca. Cuando una imagen con derechos publicables se usa en
 * contenido publicado, se copia (original y variantes) a una ubicación pública con una clave aleatoria
 * nueva, `<PUBLIC_MEDIA_PREFIX>/<uuid>/<archivo>`, en PUBLIC_MEDIA_BUCKET (por defecto, el mismo bucket).
 * PUBLIC_MEDIA_BASE_URL es la URL (CDN) que sirve la raíz de ese bucket. Al dejar de cumplirse las
 * condiciones, la copia se borra. Cada publicación usa una clave nueva, así que una URL antigua no vuelve
 * a servir una imagen retirada desde el origen. La caché por defecto es de un día (no inmutable) y, cuando
 * haya CDN, un gancho de purga (CDN_PURGE_*) se llama al retirar, despublicar o borrar.
 *
 * Cada creación y borrado de objetos públicos se anota ANTES de tocar S3 en `public-media-ops`, con una
 * escritura propia fuera de la transacción de la petición: si la transacción SQL se revierte, el registro
 * queda y `cms:media:sync-public` localiza y borra los objetos huérfanos.
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
    cacheControl: env.PUBLIC_MEDIA_CACHE_CONTROL || 'public, max-age=86400',
    // Copies younger than this are never treated as orphans (their transaction may still be open).
    orphanGraceMs: Number(env.PUBLIC_MEDIA_ORPHAN_GRACE_SECONDS ?? 600) * 1000,
  };
}

type MediaFile = { filename?: string | null; prefix?: string | null; mimeType?: string | null; publicKey?: string | null; publicBucket?: string | null;
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

async function copyToPublic(doc: MediaFile, publicKey: string, bucket: string) {
  const settings = publicMediaSettings();
  try {
    for (const file of mediaFiles(doc)) {
      const source = await s3().send(new GetObjectCommand({ Bucket: settings.privateBucket, Key: path.posix.join(doc.prefix || '', file.filename) }));
      const body = await source.Body!.transformToByteArray();
      await s3().send(new PutObjectCommand({ Bucket: bucket, Key: `${publicKey}/${file.filename}`, Body: body,
        ContentType: source.ContentType || file.mimeType, CacheControl: settings.cacheControl }));
    }
  } catch (error) {
    // Do not silently leave the successful part of a failed multipart set public.
    try { await deleteKeys(bucket, objectKeys(doc, publicKey)); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Falló la copia pública y su limpieza; requiere revisión del bucket'); }
    throw error;
  }
}

const objectKeys = (doc: MediaFile, publicKey: string) => mediaFiles(doc).map(file => `${publicKey}/${file.filename}`);

async function deleteKeys(bucket: string, keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    const objects = keys.slice(i, i + 1000).map(Key => ({ Key }));
    const result = await s3().send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects, Quiet: true } }));
    if (result.Errors?.length) throw new Error(`S3 no pudo borrar ${result.Errors.length} objetos públicos; conserva el registro para reintentar`);
  }
}

// --- Gancho de purga del CDN (desactivado hasta que haya proveedor) ------------------------------------
export type PurgeResult = 'disabled' | 'sent' | 'failed' | 'none';
/**
 * Pide al CDN que olvide estas URL. Contrato genérico: POST JSON {"urls": [...]} a CDN_PURGE_URL con
 * "Authorization: Bearer CDN_PURGE_TOKEN". Desactivado salvo CDN_PURGE_ENABLED=true. Nunca bloquea la
 * retirada: el origen ya no sirve el objeto; un fallo queda anotado en public-media-ops para reintentar.
 */
export async function purgeCDN(urls: string[], env: NodeJS.ProcessEnv = process.env): Promise<PurgeResult> {
  if (!urls.length) return 'none';
  if (env.CDN_PURGE_ENABLED !== 'true') return 'disabled';
  if (!env.CDN_PURGE_URL || !/^https?:\/\//.test(env.CDN_PURGE_URL)) return 'failed';
  try {
    const response = await fetch(env.CDN_PURGE_URL, { method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json', ...(env.CDN_PURGE_TOKEN ? { Authorization: `Bearer ${env.CDN_PURGE_TOKEN}` } : {}) },
      body: JSON.stringify({ urls }) });
    return response.ok ? 'sent' : 'failed';
  } catch { return 'failed'; }
}

// --- Registro duradero (fuera de la transacción de la petición) ----------------------------------------
type Op = { id: number; kind: 'create' | 'delete'; mediaId: number; bucket: string; keyPrefix: string; objects: string[]; status: string; createdAt: string };
async function logOp(payload: Payload, data: Omit<Op, 'id' | 'createdAt' | 'status'> & { status?: string }) {
  // No `req`: autocommit on the pool, so the record survives a rollback of the surrounding transaction.
  return payload.db.create({ collection: 'public-media-ops', data: { status: 'pending', ...data } }) as Promise<Op>;
}
async function setOp(payload: Payload, id: number, data: Record<string, unknown>) {
  await payload.db.updateOne({ collection: 'public-media-ops', id, data });
}
async function settleCreateOps(payload: Payload, bucket: string, keyPrefix: string) {
  const open = await payload.db.find<Op>({ collection: 'public-media-ops', pagination: false, limit: 0,
    where: { and: [{ kind: { equals: 'create' } }, { bucket: { equals: bucket } }, { keyPrefix: { equals: keyPrefix } }, { status: { not_equals: 'cleaned' } }] } });
  for (const op of open.docs) await setOp(payload, op.id, { status: 'cleaned' });
}

async function createPublicCopy(payload: Payload, doc: MediaFile & { id: number }, bucket: string, key: string) {
  const op = await logOp(payload, { kind: 'create', mediaId: doc.id, bucket, keyPrefix: key, objects: objectKeys(doc, key) });
  try { await copyToPublic(doc, key, bucket); }
  catch (error) {
    // copyToPublic already tried to clean up; a failed cleanup leaves the op open for the reconciler.
    await setOp(payload, op.id, { status: error instanceof AggregateError ? 'failed' : 'cleaned', error: String((error as Error).message).slice(0, 500) });
    throw error;
  }
  await setOp(payload, op.id, { status: 'applied' });
}

/** Deletes a public copy, logged before touching S3, then asks the CDN (if any) to purge its URLs. */
async function removePublicCopy(payload: Payload, mediaId: number, bucket: string, keys: string[], keyPrefix: string, urls: string[]) {
  const op = await logOp(payload, { kind: 'delete', mediaId, bucket, keyPrefix, objects: keys });
  try { await deleteKeys(bucket, keys); }
  catch (error) { await setOp(payload, op.id, { status: 'failed', error: String((error as Error).message).slice(0, 500) }); throw error; }
  const purge = await purgeCDN(urls);
  await setOp(payload, op.id, { status: 'applied', purge });
  await settleCreateOps(payload, bucket, keyPrefix);
}

async function publicCopyComplete(doc: MediaFile, key: string, bucket: string) {
  for (const file of mediaFiles(doc)) {
    try { await s3().send(new HeadObjectCommand({ Bucket: bucket, Key: `${key}/${file.filename}` })); }
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
  const [articles, municipal, spaces, festivals, heritage] = await Promise.all([
    payload.count({ collection: 'articles', overrideAccess: true, req, where: { and: [published, { or: [{ image: { equals: id } }, { seoImage: { equals: id } }] }] } }),
    payload.count({ collection: 'municipal-content', overrideAccess: true, req, where: { and: [published, { 'withdrawal.withdrawn': { not_equals: true } }, { image: { equals: id } }] } }),
    // Foto de cabecera y escudo de la identidad visual de un espacio municipal publicado.
    payload.count({ collection: 'municipal-spaces', overrideAccess: true, req, where: { and: [published, { or: [{ 'identity.heroImage': { equals: id } }, { 'identity.crestImage': { equals: id } }] }] } }),
    // Cartel de una fiesta publicada.
    payload.count({ collection: 'festivals', overrideAccess: true, req, where: { and: [published, { image: { equals: id } }] } }),
    // Foto de una ficha de patrimonio publicada («Útil»).
    payload.count({ collection: 'heritage', overrideAccess: true, req, where: { and: [{ published: { equals: true } }, { image: { equals: id } }] } }),
  ]);
  return articles.totalDocs + municipal.totalDocs + spaces.totalDocs + festivals.totalDocs + heritage.totalDocs;
}

/**
 * Recalcula `publishedUses` (campo indexado que usa la lectura anónima) y crea o borra la copia pública.
 * Se llama desde los hooks de noticias, contenidos municipales y la propia biblioteca.
 */
export async function syncPublicMedia(payload: Payload, id: number, req?: PayloadRequest, options: { refresh?: boolean; previous?: MediaFile; verify?: boolean } = {}) {
  return withPublicMediaLock(payload, id, req, lockedReq => syncLockedPublicMedia(payload, id, lockedReq, options));
}

async function syncLockedPublicMedia(payload: Payload, id: number, req: PayloadRequest, options: { refresh?: boolean; previous?: MediaFile; verify?: boolean }) {
  const doc = await payload.db.findOne<MediaFile & { id: number; rightsScope?: string | null; rightsHolder?: string | null; rightsType?: string | null; publishedUses?: number | null }>({ collection: 'media', where: { id: { equals: id } }, req });
  if (!doc) return;
  const uses = await countPublishedUses(payload, id, req);
  const settings = publicMediaSettings();
  const shouldBePublic = settings.enabled && uses > 0 && doc.rightsScope === 'publicable' && Boolean(doc.rightsHolder && doc.rightsType);
  let publicKey = doc.publicKey || null;
  // Records from before the bucket was stored belong to the bucket configured at the time (assumed current).
  let publicBucket = publicKey ? doc.publicBucket || settings.bucket : null;
  const moved = Boolean(publicKey && publicBucket !== settings.bucket);
  const incomplete = publicKey && shouldBePublic && !moved && options.verify ? !await publicCopyComplete(doc, publicKey, publicBucket!) : false;
  if (publicKey && (!shouldBePublic || options.refresh || incomplete || moved)) {
    const old = options.previous || doc;
    const urls = mediaFiles(old).map(file => publicURL({ ...old, publicKey }, file.filename)).filter((url): url is string => Boolean(url));
    await removePublicCopy(payload, doc.id, publicBucket!, objectKeys(old, publicKey), publicKey, urls);
    publicKey = null; publicBucket = null;
  }
  if (shouldBePublic && !publicKey) {
    const key = [settings.prefix, randomUUID()].filter(Boolean).join('/');
    await createPublicCopy(payload, doc, settings.bucket, key);
    publicKey = key; publicBucket = settings.bucket;
  }
  if ((doc.publishedUses ?? 0) !== uses || (doc.publicKey || null) !== publicKey || (doc.publicBucket || null) !== publicBucket) {
    await payload.db.updateOne({ collection: 'media', id, data: { publishedUses: uses, publicKey, publicBucket }, req });
  }
}

/**
 * Huérfanos según el registro: copias creadas (o a medio crear) cuya clave ya no es la vigente de su imagen
 * — p. ej. porque la transacción SQL se revirtió tras escribir en S3 — y borrados que fallaron.
 */
export async function cleanupLoggedOrphans(payload: Payload, now = Date.now()) {
  const settings = publicMediaSettings();
  const open = await payload.db.find<Op>({ collection: 'public-media-ops', pagination: false, limit: 0,
    where: { or: [
      { and: [{ kind: { equals: 'create' } }, { status: { in: ['pending', 'applied', 'failed'] } }] },
      { and: [{ kind: { equals: 'delete' } }, { status: { in: ['pending', 'failed'] } }] },
    ] } });
  let cleaned = 0;
  for (const op of open.docs) {
    if (now - new Date(op.createdAt).getTime() < settings.orphanGraceMs) continue;
    await withPublicMediaLock(payload, op.mediaId, undefined, async req => {
    const media = await payload.db.findOne<MediaFile & { id: number }>({ collection: 'media', where: { id: { equals: op.mediaId } }, req });
    const live = media?.publicKey === op.keyPrefix && (media.publicBucket || settings.bucket) === op.bucket;
    if (op.kind === 'create' && live) { if (op.status !== 'applied') await setOp(payload, op.id, { status: 'applied' }); return; }
    if (op.kind === 'delete' && op.status === 'applied') return;
    // A failed delete whose transaction rolled back: the key is still the live copy, so it must not be removed
    // (verify/refresh of the media record repairs it if it is incomplete).
    if (op.kind === 'delete' && live) { await setOp(payload, op.id, { status: 'cleaned' }); return; }
    // Orphan copy, or a delete to retry: remove the logged objects (idempotent) and settle the record.
    const keys = Array.isArray(op.objects) ? op.objects : [];
    await removePublicCopy(payload, op.mediaId, op.bucket, keys, op.keyPrefix, keys.map(k => settings.enabled && op.bucket === settings.bucket ? `${settings.baseURL}/${k.split('/').map(encodeURIComponent).join('/')}` : '').filter(Boolean));
    if (op.kind === 'delete') await setOp(payload, op.id, { status: 'applied' });
    cleaned++;
    });
  }
  return cleaned;
}

/**
 * Inventario de un bucket público (el actual o uno anterior tras cambiar PUBLIC_MEDIA_BUCKET/PREFIX):
 * objetos bajo el prefijo que no correspondan a la copia vigente de ninguna imagen. Sin `apply`, solo informa.
 */
export async function cleanupPublicBucket(payload: Payload, bucket: string, prefix: string, apply: boolean, now = Date.now()) {
  const settings = publicMediaSettings();
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  if (!bucket) throw new Error('Indica el bucket a limpiar');
  if (!cleanPrefix && (bucket === settings.privateBucket)) throw new Error('Sin prefijo, el bucket privado no se puede limpiar: se borrarían los originales');
  if (cleanPrefix.includes('..')) throw new Error('Prefijo no válido');
  const referenced = new Set((await payload.db.find<MediaFile & { id: number }>({ collection: 'media', pagination: false, limit: 0, where: { publicKey: { exists: true } } }))
    .docs.filter(m => m.publicKey && (m.publicBucket || settings.bucket) === bucket).map(m => m.publicKey!));
  const unreferenced: string[] = [];
  let token: string | undefined;
  do {
    const page = await s3().send(new ListObjectsV2Command({ Bucket: bucket, Prefix: cleanPrefix ? `${cleanPrefix}/` : undefined, ContinuationToken: token }));
    for (const object of page.Contents || []) {
      if (!object.Key) continue;
      const group = object.Key.split('/').slice(0, (cleanPrefix ? cleanPrefix.split('/').length : 0) + 1).join('/');
      const recent = object.LastModified && now - object.LastModified.getTime() < settings.orphanGraceMs;
      if (!referenced.has(group) && !recent) unreferenced.push(object.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  if (apply && unreferenced.length) {
    const groups = [...new Set(unreferenced.map(k => k.split('/').slice(0, -1).join('/')))];
    for (const group of groups) await removePublicCopy(payload, 0, bucket, unreferenced.filter(k => k.startsWith(`${group}/`)), group, []);
  }
  return unreferenced;
}

/** Reconciliación completa (tras restaurar copias o cambiar de bucket público). */
export async function syncAllPublicMedia(payload: Payload) {
  const all = await payload.find({ collection: 'media', overrideAccess: true, depth: 0, pagination: false, select: {} });
  for (const doc of all.docs) await syncPublicMedia(payload, doc.id, undefined, { verify: true });
  const orphans = await cleanupLoggedOrphans(payload);
  return Object.assign(all.docs.length, { orphans }) as number & { orphans: number };
}
