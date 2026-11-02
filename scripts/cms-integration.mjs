import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import S3rver from 's3rver';
import sharp from 'sharp';

// This test is intentionally restricted to the dedicated local Compose database.
if (process.env.CMS_INTEGRATION_LOCAL !== 'true') throw new Error('Set CMS_INTEGRATION_LOCAL=true for the isolated local integration test');
if (process.env.DATABASE_URL && process.env.DATABASE_URL !== 'postgres://planta14:local-development-only@127.0.0.1:55432/planta14') throw new Error('Refusing to test against a different database');
Object.assign(process.env, {
  CMS_ENABLED: 'true', PAYLOAD_SECRET: randomUUID() + randomUUID(),
  DATABASE_URL: 'postgres://planta14:local-development-only@127.0.0.1:55432/planta14',
  CMS_SERVER_URL: 'http://localhost:3000', S3_BUCKET: 'planta14-integration', S3_REGION: 'us-east-1',
  S3_ENDPOINT: 'http://127.0.0.1:59000', S3_FORCE_PATH_STYLE: 'true', S3_ACCESS_KEY_ID: 'S3RVER', S3_SECRET_ACCESS_KEY: 'S3RVER',
});
const directory = await mkdtemp(path.join(os.tmpdir(), 'planta14-s3-test-'));
const s3 = new S3rver({ address: '127.0.0.1', port: 59000, directory, silent: true, configureBuckets: [{ name: 'planta14-integration' }] });
let payload;
let user;
let media;
try {
  await s3.run();
  const { getPayload } = await import('payload');
  const { default: config } = await import('../payload.config.ts');
  payload = await getPayload({ config });
  await payload.db.migrate();
  const { REST_GET, REST_POST } = await import('@payloadcms/next/routes');
  const rest = async (method, slug, body, token) => {
    const headers = { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `JWT ${token}` } : {}) };
    const request = new Request(`http://localhost:3000/api/cms/${slug.join('/')}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return (method === 'GET' ? REST_GET : REST_POST)(config)(request, { params: Promise.resolve({ slug }) });
  };
  const email = `integration-${randomUUID()}@example.test`;
  const password = randomUUID() + randomUUID();
  assert.equal((await rest('POST', ['users', 'first-register'], { email, password, name: 'Forbidden', role: 'admin' })).status, 403);
  assert.equal((await rest('GET', ['users'])).status, 403);
  await assert.rejects(payload.create({ collection: 'users', overrideAccess: true, data: { name: 'Forbidden', email, password, role: 'admin' } }));
  user = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { name: 'Integration', email, password, role: 'admin' } });
  const actor = { ...user, collection: 'users' };
  const login = await rest('POST', ['users', 'login'], { email, password });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  assert(token);
  await assert.rejects(payload.find({ collection: 'users', overrideAccess: false }));
  assert.equal((await payload.find({ collection: 'media', overrideAccess: false })).totalDocs, 0);
  const data = await sharp({ create: { width: 1800, height: 1000, channels: 3, background: '#24704a' } }).png().toBuffer();
  const file = { data, mimetype: 'image/png', name: `${randomUUID()}.png`, size: data.length };
  await assert.rejects(payload.create({ collection: 'media', overrideAccess: false, data: { alt: 'Forbidden', credit: 'Test' }, file }));
  media = await payload.create({ collection: 'media', overrideAccess: false, user: actor, data: { alt: 'Prueba de integración', credit: 'Planta 14 test', rightsHolder: 'Planta 14 test', rightsType: 'propia', rightsScope: 'demo' }, file });
  assert(media.filename && media.sizes.card.filename && media.sizes.hero.filename);
  assert.equal((await rest('GET', ['media', 'file', media.filename])).status, 403);
  const download = await rest('GET', ['media', 'file', media.filename], undefined, token);
  assert.equal(download.status, 302);
  assert.equal((await (await fetch(download.headers.get('location'))).arrayBuffer()).byteLength, media.filesize);
  const { S3Client, ListObjectsV2Command, GetObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({ region: 'us-east-1', endpoint: process.env.S3_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: 'S3RVER', secretAccessKey: 'S3RVER' } });
  try {
    const objects = await client.send(new ListObjectsV2Command({ Bucket: 'planta14-integration' }));
    assert.equal(objects.Contents.length, 3, 'original and two image variants persisted in S3');
    const stored = await client.send(new GetObjectCommand({ Bucket: 'planta14-integration', Key: media.filename }));
    assert.equal((await stored.Body.transformToByteArray()).length, media.filesize);
    await payload.delete({ collection: 'media', id: media.id, overrideAccess: false, user: actor });
    media = undefined;
    assert.equal((await client.send(new ListObjectsV2Command({ Bucket: 'planta14-integration' }))).KeyCount, 0);
  } finally { client.destroy(); }
  console.log('PASS: real PostgreSQL migrations, first-user protection, login, anonymous denial, S3 upload/read/delete and resized variants');
} finally {
  if (payload) {
    if (media) await payload.delete({ collection: 'media', id: media.id, overrideAccess: true });
    if (user) await payload.delete({ collection: 'users', id: user.id, overrideAccess: true });
    await payload.destroy();
  }
  await s3.close();
  await rm(directory, { recursive: true, force: true });
}
