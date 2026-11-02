// Optional diagnostic reproducer, not a claim that durable reconciliation is implemented.
import assert from 'node:assert/strict';
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

export async function probePublicOrphans({ payload, actor, article, file }) {
  assert.equal(process.env.PUBLIC_MEDIA_BUCKET, 'planta14-block3-public');
  const { syncAllPublicMedia } = await import('../cms/public-media.ts');
  const client = new S3Client({ region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: 'S3RVER', secretAccessKey: 'S3RVER' } });
  const bucket = process.env.PUBLIC_MEDIA_BUCKET;
  const keys = async () => (await client.send(new ListObjectsV2Command({ Bucket: bucket }))).Contents?.map(o => o.Key) || [];
  const probe = await payload.create({ collection: 'media', user: actor, overrideAccess: false, file: file('rollback-probe.png'), data: { alt: 'Diagnóstico sintético', credit: 'Prueba', rightsHolder: 'Prueba', rightsType: 'propia', rightsScope: 'publicable' } });
  const before = new Set(await keys());
  const create = payload.create;
  let orphanKeys = [];
  try {
    payload.create = async function (args) {
      if (args.collection === 'audit-log') throw new Error('Injected SQL hook failure after public copy');
      return create.call(this, args);
    };
    await assert.rejects(payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false, data: { image: probe.id } }));
    payload.create = create;
    orphanKeys = (await keys()).filter(key => !before.has(key));
    assert.equal(orphanKeys.length, 3);
    assert.equal((await payload.findByID({ collection: 'media', id: probe.id, overrideAccess: true })).publicKey, null);
    await syncAllPublicMedia(payload);
    const after = new Set(await keys());
    assert(orphanKeys.every(key => after.has(key)), 'diagnostic: unknown rollback objects are NOT reconciled');
    console.log('KNOWN LIMITATION CONFIRMED: SQL rollback leaves 3 untracked public objects; sync-public cannot identify them. Requires durable operation/object manifest.');
  } finally {
    payload.create = create;
    if (orphanKeys.length) await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: orphanKeys.map(Key => ({ Key })) } }));
    await payload.delete({ collection: 'media', id: probe.id, overrideAccess: true });
    client.destroy();
  }
}
