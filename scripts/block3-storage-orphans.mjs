// Durable public-copy log: orphans after a SQL rollback are found and removed; old buckets can be cleaned.
import assert from 'node:assert/strict';
import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export async function testPublicOrphans({ payload, actor, article, file, image, oldBucket, newBucket, newBase }) {
  const { syncAllPublicMedia, cleanupPublicBucket } = await import('../cms/public-media.ts');
  const client = new S3Client({ region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT, forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
  const keys = async bucket => (await client.send(new ListObjectsV2Command({ Bucket: bucket }))).Contents?.map(o => o.Key).sort() || [];
  const ops = where => payload.find({ collection: 'public-media-ops', overrideAccess: true, pagination: false, where });
  const savedGrace = process.env.PUBLIC_MEDIA_ORPHAN_GRACE_SECONDS;
  const probe = await payload.create({ collection: 'media', user: actor, overrideAccess: false, file: file('rollback-probe.png'), data: { alt: 'Diagnóstico sintético', credit: 'Prueba', rightsHolder: 'Prueba', rightsType: 'propia', rightsScope: 'publicable' } });
  const before = new Set(await keys(oldBucket));
  const create = payload.create;
  try {
    // 1. A hook fails AFTER the public copy was written: the SQL transaction rolls back.
    payload.create = async function (args) {
      if (args.collection === 'audit-log') throw new Error('Injected SQL hook failure after public copy');
      return create.call(this, args);
    };
    await assert.rejects(payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false, data: { image: probe.id } }));
  } finally { payload.create = create; }
  const orphanKeys = (await keys(oldBucket)).filter(key => !before.has(key));
  assert.equal(orphanKeys.length, 3, 'original + two variants left behind by the rollback');
  assert.equal((await payload.findByID({ collection: 'media', id: probe.id, overrideAccess: true })).publicKey, null);
  const logged = (await ops({ mediaId: { equals: probe.id } })).docs;
  assert.equal(logged.length, 1, 'the operation log survived the rollback');
  assert.equal(logged[0].status, 'applied');
  assert.deepEqual([...logged[0].objects].sort(), orphanKeys);
  // Within the grace period nothing is touched (the transaction could still be open).
  await syncAllPublicMedia(payload);
  assert(orphanKeys.every(k => new Set(before).has(k) === false));
  assert.equal((await keys(oldBucket)).filter(k => orphanKeys.includes(k)).length, 3, 'grace period respected');
  process.env.PUBLIC_MEDIA_ORPHAN_GRACE_SECONDS = '0';
  const result = await syncAllPublicMedia(payload);
  assert(result.orphans >= 1);
  assert.equal((await keys(oldBucket)).filter(k => orphanKeys.includes(k)).length, 0, 'orphans removed by sync-public');
  assert.equal((await ops({ id: { equals: logged[0].id } })).docs[0].status, 'cleaned');
  await payload.delete({ collection: 'media', id: probe.id, overrideAccess: true });
  console.log('PASS: SQL rollback after a public copy leaves a durable log entry; sync-public removes the 3 orphan objects');

  // 2. Changing the public bucket: copies move; the old bucket is cleaned explicitly (dry run, then --apply).
  const live = await payload.findByID({ collection: 'media', id: image.id, overrideAccess: true });
  assert(live.publicKey && live.publicBucket === oldBucket);
  const stray = 'public/00000000-0000-4000-8000-000000000000/stray.png';
  await client.send(new PutObjectCommand({ Bucket: oldBucket, Key: stray, Body: 'x' }));
  const saved = { PUBLIC_MEDIA_BUCKET: process.env.PUBLIC_MEDIA_BUCKET, PUBLIC_MEDIA_BASE_URL: process.env.PUBLIC_MEDIA_BASE_URL };
  Object.assign(process.env, { PUBLIC_MEDIA_BUCKET: newBucket, PUBLIC_MEDIA_BASE_URL: newBase });
  try {
    await syncAllPublicMedia(payload);
    const moved = await payload.findByID({ collection: 'media', id: image.id, overrideAccess: true });
    assert.equal(moved.publicBucket, newBucket); assert.notEqual(moved.publicKey, live.publicKey);
    assert.equal((await fetch(moved.publicURL)).status, 200);
    assert(!(await keys(oldBucket)).some(k => k.startsWith(`${live.publicKey}/`)), 'the old copy is deleted on move');
    const dry = await cleanupPublicBucket(payload, oldBucket, 'public', false);
    assert(dry.includes(stray)); assert((await keys(oldBucket)).includes(stray), 'dry run deletes nothing');
    await cleanupPublicBucket(payload, oldBucket, 'public', true);
    assert(!(await keys(oldBucket)).some(k => k.startsWith('public/')), 'old public bucket emptied of unreferenced copies');
    await assert.rejects(cleanupPublicBucket(payload, process.env.S3_BUCKET, '', true), /bucket privado/);
    console.log('PASS: changing PUBLIC_MEDIA_BUCKET moves copies; cleanup mode lists (dry run) and removes leftovers in the old bucket');
  } finally {
    Object.assign(process.env, saved);
    await syncAllPublicMedia(payload);
    if (savedGrace === undefined) delete process.env.PUBLIC_MEDIA_ORPHAN_GRACE_SECONDS; else process.env.PUBLIC_MEDIA_ORPHAN_GRACE_SECONDS = savedGrace;
    client.destroy();
  }
}
