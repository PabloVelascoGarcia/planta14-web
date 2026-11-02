import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { DeleteObjectsCommand, DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

export async function testPublicStorageFailures({ payload, actor, article, image, file }) {
  const { syncAllPublicMedia } = await import('../cms/public-media.ts');
  const client = new S3Client({ region: process.env.S3_REGION, endpoint: process.env.S3_ENDPOINT, forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
  const bucket = process.env.PUBLIC_MEDIA_BUCKET;
  const send = S3Client.prototype.send;
  let fault = '', puts = 0;
  S3Client.prototype.send = async function (command, ...args) {
    if (command.input.Bucket === bucket && fault === 'put' && command.constructor.name === 'PutObjectCommand' && ++puts === 2) throw new Error('Injected second public PUT failure');
    if (command.input.Bucket === bucket && fault === 'delete' && command.constructor.name === 'DeleteObjectsCommand') {
      const objects = command.input.Delete.Objects;
      await send.call(this, new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects.slice(0, 1) } }));
      return { Errors: objects.slice(1).map(object => ({ ...object, Code: 'AccessDenied' })), $metadata: { httpStatusCode: 200 } };
    }
    return send.call(this, command, ...args);
  };
  const keys = async () => (await client.send(new ListObjectsV2Command({ Bucket: bucket }))).Contents?.map(o => o.Key).sort() || [];
  const stored = id => payload.findByID({ collection: 'media', id, overrideAccess: true });
  try {
    const extra = await payload.create({ collection: 'media', user: actor, overrideAccess: false, file: file('storage-fault.png'),
      data: { alt: 'Original sintético', credit: 'Prueba', rightsHolder: 'Prueba propia', rightsType: 'propia', rightsScope: 'publicable' } });
    const before = await keys();
    fault = 'put';
    await assert.rejects(payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false, data: { image: extra.id } }));
    fault = '';
    assert.equal(puts, 2);
    assert.deepEqual(await keys(), before, 'a failed copy must clean the objects already written');
    assert.equal((await stored(extra.id)).publicKey, null);
    await payload.delete({ collection: 'media', id: extra.id, user: actor, overrideAccess: false });

    const original = await stored(image.id);
    fault = 'delete';
    await assert.rejects(payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false, data: { _status: 'draft' } }));
    fault = '';
    assert.equal((await stored(image.id)).publicKey, original.publicKey, 'HTTP 200 with per-object errors must not clear the database reference');
    assert.equal((await payload.findByID({ collection: 'articles', id: article.id, overrideAccess: true }))._status, 'published');
    await syncAllPublicMedia(payload);
    let repaired = await stored(image.id);
    assert.notEqual(repaired.publicKey, original.publicKey);
    assert.equal((await fetch(repaired.publicURL)).status, 200);
    for (const variant of Object.values(repaired.sizes)) assert.equal((await fetch(`${process.env.PUBLIC_MEDIA_BASE_URL}/${repaired.publicKey}/${variant.filename}`)).status, 200);
    // Missing one variant without changing SQL must be repaired by the same CLI reconciliation path.
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: `${repaired.publicKey}/${repaired.sizes.card.filename}` }));
    const cli = spawn(process.execPath, [path.resolve('node_modules/payload/bin.js'), 'run', 'scripts/sync-public-media.ts'], { windowsHide: true, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; cli.stdout.on('data', data => { output += data; }); cli.stderr.on('data', data => { output += data; });
    assert.equal((await once(cli, 'exit'))[0], 0, `sync-public CLI failed: ${output.slice(-1200)}`);
    const next = await stored(image.id);
    assert.notEqual(next.publicKey, repaired.publicKey);
    await payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false, data: { _status: 'draft' } });
    assert.equal((await fetch(next.publicURL)).status, 404);
    await payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false, data: { _status: 'published' } });
    repaired = await stored(image.id);
    assert.equal(repaired.publishedUses, 1);
    assert.equal((await fetch(repaired.publicURL)).status, 200);
    console.log('PASS: partial PUT cleanup, DeleteObjects per-key errors, SQL rollback detection, reconciliation of missing originals/variants and successful unpublication retry');
  } finally {
    S3Client.prototype.send = send;
    client.destroy();
  }
}
