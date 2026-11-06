import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import S3rver from 's3rver';
import sharp from 'sharp';
import pg from 'pg';

// Bloque 3: cuentas municipales, retirada, avisos, auditoría e imágenes públicas.
// Usa solo una base PostgreSQL desechable (compose.bloque3-test.yaml, puerto 55434) y S3rver local (59004).
const databaseURL = 'postgres://planta14:local-development-only@127.0.0.1:55434/planta14_bloque3_test';
if (process.env.CMS_BLOCK3_TEST !== 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL !== databaseURL)) throw new Error('Use CMS_BLOCK3_TEST=true and the dedicated local database on port 55434');
const s3Port = 59004, webPort = 3051;
const publicBase = `http://127.0.0.1:${s3Port}/planta14-block3-public`;
Object.assign(process.env, { NODE_ENV: 'production', CMS_ENABLED: 'true', CONTENT_SOURCE: 'payload', PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: databaseURL,
  CMS_SERVER_URL: `http://localhost:${webPort}`, S3_BUCKET: 'planta14-block3-private', S3_REGION: 'us-east-1', S3_ENDPOINT: `http://127.0.0.1:${s3Port}`, S3_FORCE_PATH_STYLE: 'true',
  S3_ACCESS_KEY_ID: 'S3RVER', S3_SECRET_ACCESS_KEY: 'S3RVER', PUBLIC_MEDIA_BASE_URL: publicBase, PUBLIC_MEDIA_BUCKET: 'planta14-block3-public', PUBLIC_MEDIA_PREFIX: 'public' });
delete process.env.MUNICIPAL_NOTICE_EMAIL_ENABLED;
const reset = new pg.Client({ connectionString: databaseURL });
await reset.connect();
await reset.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await reset.end();
const directory = await mkdtemp(path.join(os.tmpdir(), 'planta14-block3-'));
const s3 = new S3rver({ address: '127.0.0.1', port: s3Port, directory, silent: true, configureBuckets: [{ name: 'planta14-block3-private' }, { name: 'planta14-block3-public' }, { name: 'planta14-block3-public2' }] });
const children = [];
let payload;
const passed = name => console.log(`PASS: ${name}`);
const denied = status => [403, 404].includes(status);
const idOf = value => (value && typeof value === 'object' ? value.id : value);
try {
  await s3.run();
  const { getPayload } = await import('payload');
  const { sql } = await import('@payloadcms/db-postgres');
  const { default: config } = await import('../payload.config.ts');
  const { importMunicipalDemo } = await import('../cms/import-municipal.ts');
  const { readMedia } = await import('../cms/media-rights.ts');
  payload = await getPayload({ config });
  await payload.db.migrate();
  const { REST_GET, REST_POST, REST_PATCH, REST_DELETE } = await import('@payloadcms/next/routes');
  const handlers = { GET: REST_GET, POST: REST_POST, PATCH: REST_PATCH, DELETE: REST_DELETE };
  const rest = async (method, route, body, token) => {
    const [pathname, search = ''] = route.split('?');
    const slug = pathname.split('/').filter(Boolean);
    const response = await handlers[method](config)(new Request(`http://localhost:${webPort}/api/cms/${slug.join('/')}${search ? `?${search}` : ''}`, {
      method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `JWT ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined,
    }), { params: Promise.resolve({ slug }) });
    const text = await response.text();
    let json; try { json = JSON.parse(text); } catch { json = null; }
    return { status: response.status, json, headers: response.headers };
  };
  const password = randomUUID() + randomUUID();
  const admin = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { email: 'admin@block3.example.test', password, name: 'Admin', role: 'admin' } });
  const login = async email => { const r = await rest('POST', 'users/login', { email, password }); assert.equal(r.status, 200, `login ${email}`); return r.json.token; };
  const adminToken = await login(admin.email);
  await importMunicipalDemo(payload);
  const space = async id => (await payload.find({ collection: 'municipal-spaces', overrideAccess: true, where: { legacyID: { equals: id } } })).docs[0];
  const [lenaSpace, mieresSpace] = [await space('lena'), await space('mieres')];

  // --- Cuentas municipales: solo el administrador las crea; espacio obligatorio solo para ese rol.
  const editorRes = await rest('POST', 'users', { email: 'editor@block3.example.test', password, name: 'Editor', role: 'editor' }, adminToken);
  assert.equal(editorRes.status, 201);
  const editorToken = await login('editor@block3.example.test');
  assert.equal((await rest('POST', 'users', { email: 'x@block3.example.test', password, name: 'X', role: 'municipal', municipalSpace: lenaSpace.id }, editorToken)).status, 403);
  assert.equal((await rest('POST', 'users', { email: 'y@block3.example.test', password, name: 'Y', role: 'municipal' }, adminToken)).status, 400);
  assert.equal((await rest('POST', 'users', { email: 'z@block3.example.test', password, name: 'Z', role: 'editor', municipalSpace: lenaSpace.id }, adminToken)).status, 400);
  const lenaUser = (await rest('POST', 'users', { email: 'lena@block3.example.test', password, name: 'Ayuntamiento de Lena', role: 'municipal', municipalSpace: lenaSpace.id }, adminToken)).json.doc;
  const mieresUser = (await rest('POST', 'users', { email: 'mieres@block3.example.test', password, name: 'Ayuntamiento de Mieres', role: 'municipal', municipalSpace: mieresSpace.id }, adminToken)).json.doc;
  assert(lenaUser?.id && mieresUser?.id);
  assert.equal((await rest('PATCH', `users/${lenaUser.id}`, { municipalSpace: mieresSpace.id }, editorToken)).status, 403);
  const lena = await login(lenaUser.email), mieres = await login(mieresUser.email);
  passed('only an administrator creates municipal accounts; the space is required for that role and forbidden for others');

  // --- Aislamiento entre ayuntamientos (API).
  const item = (title, extra = {}) => ({ type: 'news', title, excerpt: `${title}: resumen`, body: `${title}: texto original de prueba.`, ...extra });
  const mieresDraft = (await rest('POST', 'municipal-content?draft=true', item('Borrador privado de Mieres', { _status: 'draft' }), mieres)).json.doc;
  const mieresPublished = (await rest('POST', 'municipal-content', item('Publicación de Mieres', { _status: 'published' }), mieres)).json.doc;
  assert(mieresDraft?.id && mieresPublished?.id);
  assert(denied((await rest('GET', `municipal-content/${mieresPublished.id}?depth=5&overrideAccess=true`, undefined, lena)).status), 'published content is still tenant-scoped; a query cannot override access');
  assert(denied((await rest('GET', `municipal-spaces/${mieresSpace.id}?depth=5`, undefined, lena)).status));
  assert(denied((await rest('GET', 'municipal-spaces/versions?depth=5', undefined, lena)).status));
  const mieresVersion = (await payload.findVersions({ collection: 'municipal-content', overrideAccess: true, where: { parent: { equals: mieresPublished.id } }, sort: '-createdAt', limit: 1 })).docs[0];
  assert(denied((await rest('GET', `municipal-content/versions/${mieresVersion.id}?depth=5`, undefined, lena)).status));
  assert(denied((await rest('POST', `municipal-content/versions/${mieresVersion.id}`, {}, lena)).status));
  assert.equal(mieresDraft.demo, false); assert.equal(idOf(mieresDraft.space), mieresSpace.id);
  assert(denied((await rest('GET', `municipal-content/${mieresDraft.id}`, undefined, lena)).status));
  assert(denied((await rest('GET', `municipal-content/${mieresDraft.id}?draft=true`, undefined, lena)).status));
  const lenaList = await rest('GET', `municipal-content?draft=true&limit=200&where[space][equals]=${mieresSpace.id}`, undefined, lena);
  assert.equal(lenaList.status, 200);
  assert(!lenaList.json.docs.some(d => d.id === mieresDraft.id), 'Lena must not list Mieres drafts');
  const versions = await rest('GET', 'municipal-content/versions?limit=500', undefined, lena);
  assert(versions.status === 403 || !versions.json.docs.some(v => v.parent === mieresDraft.id || v.parent?.id === mieresDraft.id), 'Lena must not read Mieres versions');
  assert(denied((await rest('PATCH', `municipal-content/${mieresPublished.id}`, { title: 'Hackeado' }, lena)).status));
  assert(denied((await rest('PATCH', `municipal-content/${mieresDraft.id}`, { _status: 'published' }, lena)).status));
  assert(denied((await rest('PATCH', `municipal-content/${mieresPublished.id}`, { _status: 'draft' }, lena)).status));
  assert(denied((await rest('DELETE', `municipal-content/${mieresPublished.id}`, undefined, lena)).status));
  assert(denied((await rest('DELETE', `municipal-content/${mieresDraft.id}`, undefined, lena)).status));
  assert(denied((await rest('POST', 'municipal-content', item('Intrusión en Mieres', { space: mieresSpace.id, _status: 'published' }), lena)).status));
  const lenaMovesOwn = (await rest('POST', 'municipal-content?draft=true', item('Borrador de Lena', { _status: 'draft' }), lena)).json.doc;
  assert(denied((await rest('PATCH', `municipal-content/${lenaMovesOwn.id}`, { space: mieresSpace.id }, lena)).status));
  const stillMieres = await payload.findByID({ collection: 'municipal-content', id: mieresPublished.id, overrideAccess: true, draft: true });
  assert.equal(stillMieres.title, 'Publicación de Mieres'); assert.equal(stillMieres._status, 'published');
  assert.equal(idOf((await payload.findByID({ collection: 'municipal-content', id: lenaMovesOwn.id, overrideAccess: true, draft: true })).space), lenaSpace.id);
  passed('a Lena account cannot read drafts, edit, publish, unpublish, delete or create content of Mieres through the API');

  // --- Sin acceso a noticias de Planta 14, usuarios, secciones, concejos, autores ni actividad.
  const town = (await payload.find({ collection: 'towns', overrideAccess: true, where: { slug: { equals: 'lena' } } })).docs[0];
  const section = (await payload.find({ collection: 'sections', overrideAccess: true, limit: 1 })).docs[0];
  const author = await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'Redacción de prueba', slug: 'redaccion-prueba' } });
  const article = await payload.create({ collection: 'articles', overrideAccess: true, data: { slug: 'noticia-bloque3', title: 'Noticia de Planta 14', excerpt: 'Resumen original', body: ['Texto original.'], author: author.id, town: town.id, section: section.id, date: '2026-11-02', _status: 'published' } });
  for (const route of ['articles', `articles/${article.id}`, 'articles/versions', 'sections', `sections/${section.id}`, 'towns', `towns/${town.id}`, 'authors', 'notifications', 'audit-log', `users/${admin.id}`]) {
    const r = await rest('GET', route, undefined, lena);
    assert(denied(r.status), `municipal GET ${route} → ${r.status}`);
  }
  const users = await rest('GET', 'users', undefined, lena);
  assert(users.status === 403 || (users.json.docs.length === 1 && users.json.docs[0].id === lenaUser.id), 'municipal only sees its own account');
  assert(denied((await rest('POST', 'articles', { slug: 'x', title: 'x' }, lena)).status));
  assert(denied((await rest('PATCH', `articles/${article.id}`, { title: 'x' }, lena)).status));
  assert(denied((await rest('PATCH', `sections/${section.id}`, { name: 'x' }, lena)).status));
  assert(denied((await rest('PATCH', `towns/${town.id}`, { visible: false }, lena)).status));
  assert(denied((await rest('PATCH', `municipal-spaces/${lenaSpace.id}`, { name: 'x' }, lena)).status));
  assert.notEqual((await rest('GET', 'access', undefined, lena)).json.canAccessAdmin, true, 'no /cms access');
  assert.equal((await rest('GET', 'access', undefined, editorToken)).json.canAccessAdmin, true);
  passed('a municipal account cannot access Planta 14 articles, users, sections, towns, authors, activity or the /cms administration');
  assert.equal((await rest('POST', 'graphql', { query: '{ Articles { docs { id title } } }' }, lena)).status, 404, 'GraphQL is not mounted in this application');
  const moved = (await rest('POST', 'municipal-content?draft=true', item('Histórico reservado a Mieres', { _status: 'draft' }), mieres)).json.doc;
  const oldTenantVersion = (await payload.findVersions({ collection: 'municipal-content', overrideAccess: true, where: { parent: { equals: moved.id } }, limit: 1 })).docs[0];
  assert.equal((await rest('PATCH', `municipal-content/${moved.id}?draft=true`, { space: lenaSpace.id, title: 'Documento reasignado a Lena' }, editorToken)).status, 200);
  assert(denied((await rest('POST', `municipal-content/versions/${oldTenantVersion.id}?draft=true`, {}, lena)).status), 'moving a document does not grant access to historical versions from another tenant');
  await payload.delete({ collection: 'municipal-content', id: moved.id, overrideAccess: true });

  // --- Imágenes: copia pública con caché larga; borradores y demo no son públicos; despublicar la retira.
  const png = await sharp({ create: { width: 1800, height: 1000, channels: 3, background: '#24704a' } }).png().toBuffer();
  const file = name => ({ data: png, mimetype: 'image/png', name, size: png.length });
  const editorActor = { ...(await payload.findByID({ collection: 'users', id: editorRes.json.doc.id, overrideAccess: true })), collection: 'users' };
  const lenaActor = { ...(await payload.findByID({ collection: 'users', id: lenaUser.id, overrideAccess: true })), collection: 'users' };
  const mieresActor = { ...(await payload.findByID({ collection: 'users', id: mieresUser.id, overrideAccess: true })), collection: 'users' };
  const image = await payload.create({ collection: 'media', user: editorActor, overrideAccess: false, file: file('publicable.png'), data: { alt: 'Imagen publicable', credit: 'Planta 14 test', rightsHolder: 'Planta 14 test', rightsType: 'propia', rightsScope: 'publicable', rightsConfirm: true } });
  const demoImage = await payload.create({ collection: 'media', user: editorActor, overrideAccess: false, file: file('demo.png'), data: { alt: 'Imagen demo', credit: 'Test', rightsHolder: 'Test', rightsType: 'propia', rightsScope: 'demo' } });
  const media = id => payload.findByID({ collection: 'media', id, overrideAccess: true });
  assert.equal((await media(image.id)).publicKey, null);
  assert(denied((await rest('GET', `media/${image.id}`)).status), 'unlinked image is not public');
  await payload.update({ collection: 'articles', id: article.id, overrideAccess: false, user: editorActor, data: { image: image.id } });
  let linked = await media(image.id);
  assert.equal(linked.publishedUses, 1);
  assert.match(linked.publicKey, /^public\/[0-9a-f-]{36}$/);
  assert(linked.publicURL.startsWith(`${publicBase}/public/`));
  const anonymous = await rest('GET', `media/${image.id}`);
  assert.equal(anonymous.status, 200);
  assert.equal(anonymous.json.publicURL, linked.publicURL);
  assert(denied((await rest('GET', `media/${image.id}?depth=5`, undefined, lena)).status), 'municipal account cannot read Planta 14 public media through authenticated API');
  assert(denied((await rest('GET', `media/file/${linked.filename}`, undefined, lena)).status), 'municipal account cannot obtain signed originals of Planta 14');
  const publicFile = await fetch(linked.publicURL);
  assert.equal(publicFile.status, 200);
  assert.match(publicFile.headers.get('cache-control') || '', /public, max-age=86400/);
  for (const size of ['card', 'hero']) assert.equal((await fetch(`${publicBase}/${linked.publicKey}/${linked.sizes[size].filename}`)).status, 200, `public ${size} variant`);
  // Signed URLs only for authenticated panels.
  assert(denied((await rest('GET', `media/file/${linked.filename}`)).status), 'anonymous file route is not a signed-URL proxy');
  const signed = await rest('GET', `media/file/${linked.filename}`, undefined, editorToken);
  assert.equal(signed.status, 302);
  assert.equal(new URL(signed.headers.get('location')).searchParams.get('X-Amz-Expires'), '60');
  await assert.rejects(payload.update({ collection: 'articles', id: article.id, overrideAccess: false, user: editorActor, data: { seoImage: demoImage.id } }));
  assert(denied((await rest('GET', `media/${demoImage.id}`)).status));
  assert.equal((await media(demoImage.id)).publicKey, null);
  // Draft content: the image stays private.
  const draftArticle = await payload.create({ collection: 'articles', overrideAccess: false, user: editorActor, draft: true, data: { slug: 'borrador-bloque3', title: 'Borrador', excerpt: 'x', body: ['x'], author: author.id, town: town.id, section: section.id, date: '2026-11-02', _status: 'draft', image: demoImage.id } });
  assert.equal((await media(demoImage.id)).publishedUses, 0);
  assert(denied((await rest('GET', `media/${demoImage.id}`)).status));
  // Municipal uploads require an explicit rights declaration and a credit; the evidence is set by the server.
  await assert.rejects(payload.create({ collection: 'media', user: lenaActor, overrideAccess: false, file: file('sin-declaracion.png'), data: { alt: 'Sin declaración', credit: 'Ayuntamiento de Lena' } }), /declaración de derechos/);
  await assert.rejects(payload.create({ collection: 'media', user: lenaActor, overrideAccess: false, file: file('sin-credito.png'), data: { alt: 'Sin crédito', credit: '   ', rightsDeclaration: { declared: true } } }), /autor o crédito/);
  const lenaImage = await payload.create({ collection: 'media', user: lenaActor, overrideAccess: false, file: file('lena.png'),
    data: { alt: 'Fiesta en Pola de Lena', credit: 'Ayuntamiento de Lena', rightsDeclaration: { declared: true, declaredBy: mieresUser.id, declaredAt: '2000-01-01T00:00:00.000Z', statement: 'falsificada' } } });
  assert.equal(lenaImage.rightsDeclaration.declared, true);
  assert.equal(idOf(lenaImage.rightsDeclaration.declaredBy), lenaUser.id, 'declaredBy comes from the session');
  assert(Date.now() - Date.parse(lenaImage.rightsDeclaration.declaredAt) < 60_000, 'declaredAt set by the server');
  assert.match(lenaImage.rightsDeclaration.statement, /^v1 · Ayuntamiento de Lena declara que tiene los derechos/);
  const editorForged = await payload.create({ collection: 'media', user: editorActor, overrideAccess: false, file: file('editor.png'), data: { alt: 'Editor', credit: 'Planta 14', rightsHolder: 'Planta 14', rightsType: 'propia', rightsDeclaration: { declared: true, declaredBy: lenaUser.id } } });
  assert.equal(editorForged.rightsDeclaration?.declared ?? false, false, 'nobody can write a declaration as client data');
  await payload.delete({ collection: 'media', id: editorForged.id, overrideAccess: true });
  passed('municipal image upload requires rights declaration and credit; who/when/what stored server-side, not forgeable');
  assert.equal(lenaImage.rightsHolder, 'Ayuntamiento de Lena'); assert.equal(lenaImage.rightsType, 'institucional'); assert.equal(idOf(lenaImage.uploadedBySpace), lenaSpace.id);
  const lenaImageDraft = (await rest('POST', 'municipal-content?draft=true', item('Borrador con imagen', { _status: 'draft', image: lenaImage.id }), lena)).json.doc;
  const managedFields = await rest('PATCH', `media/${lenaImage.id}`, { filename: image.filename, prefix: 'another-tenant', sizes: { card: { filename: image.filename } }, uploadedBySpace: mieresSpace.id, publishedUses: 999, publicKey: 'public/forged' }, lena);
  assert.equal(managedFields.status, 200, 'managed upload fields are sanitized by Payload');
  const safeFile = await media(lenaImage.id);
  assert.equal(safeFile.filename, lenaImage.filename, 'tenant cannot forge stored source filename');
  assert.equal(safeFile.prefix, lenaImage.prefix);
  assert.equal(safeFile.sizes.card.filename, lenaImage.sizes.card.filename, 'tenant cannot forge variant source keys');
  assert.equal(idOf(safeFile.uploadedBySpace), lenaSpace.id);
  assert.equal(safeFile.publishedUses, 0);
  assert.equal(safeFile.publicKey, null);
  assert.equal((await media(lenaImage.id)).publicKey, null);
  assert(denied((await rest('GET', `media/${lenaImage.id}`)).status), 'image of a draft is not public');
  assert(denied((await rest('GET', `media/${lenaImage.id}`, undefined, mieres)).status), 'Mieres cannot read Lena private images');
  assert(denied((await rest('POST', 'municipal-content?draft=true', item('Imagen ajena', { _status: 'draft', image: lenaImage.id }), mieres)).status));
  assert.equal((await rest('PATCH', `municipal-content/${lenaImageDraft.id}`, { _status: 'published' }, lena)).status, 200);
  const lenaPublic = await media(lenaImage.id);
  assert(denied((await rest('GET', `media/${lenaImage.id}?depth=5`, undefined, mieres)).status), 'published municipal images remain scoped in authenticated API');
  assert(denied((await rest('GET', `media/file/${lenaImage.filename}`, undefined, mieres)).status));
  assert.equal((await fetch(lenaPublic.publicURL)).status, 200);
  // Unpublishing removes the public copy; republishing uses a new key.
  await payload.update({ collection: 'articles', id: article.id, overrideAccess: false, user: editorActor, data: { _status: 'draft' } });
  const afterUnpublish = await media(image.id);
  assert.equal(afterUnpublish.publishedUses, 0); assert.equal(afterUnpublish.publicKey, null);
  assert.equal((await fetch(linked.publicURL)).status, 404);
  assert(denied((await rest('GET', `media/${image.id}`)).status));
  await payload.update({ collection: 'articles', id: article.id, overrideAccess: false, user: editorActor, data: { _status: 'published' } });
  const republished = await media(image.id);
  assert.notEqual(republished.publicKey, linked.publicKey);
  linked = republished;
  await assert.rejects(payload.update({ collection: 'media', id: image.id, user: editorActor, overrideAccess: false, data: { rightsScope: 'demo' } }));
  await assert.rejects(payload.delete({ collection: 'media', id: image.id, user: editorActor, overrideAccess: false }));
  await payload.delete({ collection: 'articles', id: draftArticle.id, overrideAccess: true });
  passed('publishable images of published content are served from PUBLIC_MEDIA_BASE_URL with the configured cache (1 day); drafts and demo images are not public; unpublishing removes the copy');

  // --- Lectura pública sin recorrer el contenido: filtro sobre un campo indexado, sin consultas.
  const forbiddenPayload = new Proxy({}, { get() { throw new Error('anonymous media read must not query content'); } });
  const filter = await readMedia({ req: { user: null, payload: forbiddenPayload } });
  assert.deepEqual(filter, { and: [{ publishedUses: { greater_than: 0 } }, { rightsScope: { equals: 'publicable' } }] });
  const index = await payload.db.drizzle.execute(sql`SELECT indexname FROM pg_indexes WHERE tablename = 'media' AND indexname = 'media_published_uses_idx'`);
  assert.equal(index.rows.length, 1);
  passed('anonymous media reads use the indexed publishedUses field and never scan published content');

  // --- Web pública: publicación inmediata, marca municipal, retirada con motivo y panel real.
  const child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(webPort)], {
    windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let logs = ''; child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
  for (let i = 0; ; i++) {
    if (child.exitCode !== null) throw new Error(`HTTP server exited: ${logs.slice(-1500)}`);
    try { if ((await fetch(`http://127.0.0.1:${webPort}/robots.txt`)).ok) break; } catch { /* starting */ }
    if (i > 150) throw new Error('HTTP server did not start');
    await new Promise(r => setTimeout(r, 200));
  }
  const page = async (route, token) => { const r = await fetch(`http://127.0.0.1:${webPort}${route}`, { headers: token ? { Cookie: `payload-token=${token}`, 'Sec-Fetch-Site': 'same-origin' } : {} }); return { status: r.status, html: await r.text() }; };
  const fresh = (await rest('POST', 'municipal-content', item('Mercado semanal de Pola de Lena', { _status: 'published' }), lena)).json.doc;
  const freshVersion = (await payload.findVersions({ collection: 'municipal-content', overrideAccess: true, where: { parent: { equals: fresh.id } }, sort: '-createdAt', limit: 1 })).docs[0];
  let lenaPage = await page('/lena');
  assert.equal(lenaPage.status, 200);
  assert(lenaPage.html.includes('Mercado semanal de Pola de Lena'), 'published municipal content appears at once');
  assert(lenaPage.html.includes('Publicado por el ayuntamiento'), 'municipal content is labelled');
  assert(!lenaPage.html.includes('Borrador de Lena'));
  assert(!(await page('/mieres')).html.includes('Borrador privado de Mieres'));
  const articlePage = await page('/noticia/noticia-bloque3');
  assert.equal(articlePage.status, 200);
  assert(articlePage.html.includes(linked.publicURL.replace(/&/g, '&amp;')), 'public article uses the public media URL');
  assert(!articlePage.html.includes('/api/cms/media/file/'), 'public pages never use signed/proxied media URLs');
  passed('municipal publications appear immediately on their public page, labelled as municipal content');

  assert.equal((await rest('PATCH', `municipal-content/${fresh.id}`, { withdrawal: { withdrawn: true } }, editorToken)).status, 400, 'reason required');
  assert(denied((await rest('PATCH', `municipal-content/${fresh.id}`, { withdrawal: { withdrawn: true, reason: 'x' } }, lena)).status) ||
    (await payload.findByID({ collection: 'municipal-content', id: fresh.id, overrideAccess: true })).withdrawal.withdrawn === false, 'municipality cannot withdraw');
  const reason = 'Contiene datos personales de un vecino';
  // Even a "save draft" from the admin applies the withdrawal to the live document.
  assert.equal((await rest('PATCH', `municipal-content/${fresh.id}?draft=true`, { withdrawal: { withdrawn: true, reason } }, editorToken)).status, 200);
  lenaPage = await page('/lena');
  assert(!lenaPage.html.includes('Mercado semanal de Pola de Lena'), 'withdrawn content disappears from the public site');
  assert(denied((await rest('GET', `municipal-content/${fresh.id}`)).status));
  const ownView = await rest('GET', `municipal-content/${fresh.id}?draft=true`, undefined, lena);
  assert.equal(ownView.json.withdrawal.reason, reason);
  const republish = await rest('PATCH', `municipal-content/${fresh.id}`, { _status: 'published' }, lena);
  assert.equal(republish.status, 403, 'a municipality cannot republish withdrawn content');
  for (const token of [lena, editorToken]) for (const query of ['', '?draft=true']) {
    assert(denied((await rest('POST', `municipal-content/versions/${freshVersion.id}${query}`, {}, token)).status), 'historical restore cannot bypass a live withdrawal');
  }
  assert.equal((await rest('PATCH', `municipal-content/${fresh.id}?draft=true`, { _status: 'published', withdrawal: { withdrawn: false, reason: null } }, lena)).status, 403);
  const bulk = await rest('PATCH', `municipal-content?where[id][equals]=${fresh.id}`, { _status: 'published' }, lena);
  assert(denied(bulk.status) || bulk.json.errors?.length > 0, 'bulk update cannot republish withdrawn content');
  const storedWithdrawal = await payload.findByID({ collection: 'municipal-content', id: fresh.id, overrideAccess: true });
  assert.equal(storedWithdrawal._status, 'draft'); assert.equal(storedWithdrawal.withdrawal.reason, reason);
  const lenaPanel = await page('/lena/panel?pestana=publicaciones', lena);
  assert.equal(lenaPanel.status, 200);
  assert(lenaPanel.html.includes(reason), 'the municipality sees the reason in its panel');
  assert(lenaPanel.html.includes('Borrador de Lena') && lenaPanel.html.includes('Retirado por Planta 14'));
  const audit = (await payload.find({ collection: 'audit-log', overrideAccess: true, pagination: false, where: { documentID: { equals: String(fresh.id) } }, sort: 'createdAt' })).docs;
  const withdrawn = audit.find(e => e.action === 'withdraw');
  assert(withdrawn, 'withdrawal is audited');
  assert.equal(withdrawn.reason, reason); assert.equal(withdrawn.userEmail, 'editor@block3.example.test'); assert.equal(withdrawn.targetCollection, 'municipal-content');
  assert(audit.some(e => e.action === 'publish' && e.userEmail === lenaUser.email && e.userRole === 'municipal'));
  passed('a withdrawal removes the content from the site, shows the reason to the municipality and is recorded in the audit log');

  // Panel isolation over HTTP: Lena's session cannot manage Mieres.
  const crossPanel = await page('/mieres/panel?pestana=publicaciones', lena);
  assert(crossPanel.html.includes('Tu cuenta no gestiona este espacio municipal'));
  assert(!crossPanel.html.includes('Borrador privado de Mieres') && !crossPanel.html.includes('Publicación de Mieres'));
  assert((await page('/mieres/panel?pestana=publicaciones', mieres)).html.includes('Borrador privado de Mieres'));
  assert((await page('/lena/panel')).html.includes('Entra con la cuenta de tu ayuntamiento'));
  const crossSite = await fetch(`http://127.0.0.1:${webPort}/lena/panel`, { headers: { Cookie: `payload-token=${lena}`, Origin: 'https://evil.example' } });
  assert(!(await crossSite.text()).includes('Borrador de Lena'), 'a cross-site request does not reuse the session cookie');
  assert((await page('/lena/panel', editorToken)).html.includes('Gestiona los contenidos desde /cms'));
  passed('the real municipal panel requires login and only shows the account’s own space');

  // --- Avisos: uno por cada publicación municipal, correo preparado pero desactivado.
  const municipalPublications = (await payload.find({ collection: 'audit-log', overrideAccess: true, pagination: false, where: { and: [{ action: { equals: 'publish' } }, { targetCollection: { equals: 'municipal-content' } }, { userRole: { equals: 'municipal' } }] } })).docs;
  const notices = (await payload.find({ collection: 'notifications', overrideAccess: true, pagination: false, depth: 0 })).docs;
  assert.equal(municipalPublications.length, 3);
  assert.equal(notices.length, municipalPublications.length);
  assert.deepEqual(new Set(notices.map(n => n.content)), new Set([mieresPublished.id, lenaImageDraft.id, fresh.id]));
  assert(notices.every(n => n.emailStatus === 'disabled' && n.kind === 'municipal-publication' && n.publishedBy));
  assert.equal((await rest('GET', 'notifications', undefined, editorToken)).json.totalDocs, 3);
  assert.equal((await rest('PATCH', `notifications/${notices[0].id}`, { reviewed: true }, editorToken)).status, 200);
  assert(denied((await rest('POST', 'notifications', { title: 'x' }, editorToken)).status));
  assert(denied((await rest('DELETE', `audit-log/${audit[0].id}`, undefined, adminToken)).status));
  assert(denied((await rest('PATCH', `audit-log/${audit[0].id}`, { reason: 'x' }, adminToken)).status));
  // Editors publishing municipal content do not create notices.
  assert.equal((await rest('POST', 'municipal-content', item('Aviso de la redacción', { space: lenaSpace.id, _status: 'published', publishedAt: '2026-11-02' }), editorToken)).status, 201);
  assert.equal((await payload.count({ collection: 'notifications', overrideAccess: true })).totalDocs, 3);
  passed('each municipal publication creates one notice for Planta 14 (email prepared, disabled); audit log is immutable');

  // Real multipart REST upload: tenant ownership cannot be supplied/spoofed by the client.
  const form = new FormData();
  form.set('file', new Blob([png], { type: 'image/png' }), 'upload-rest.png');
  form.set('_payload', JSON.stringify({ alt: 'Carga REST propia', credit: 'Ayuntamiento de Lena', uploadedBySpace: mieresSpace.id, rightsDeclaration: { declared: true } }));
  const uploadedResponse = await REST_POST(config)(new Request(`http://localhost:${webPort}/api/cms/media`, { method: 'POST', headers: { Authorization: `JWT ${lena}` }, body: form }), { params: Promise.resolve({ slug: ['media'] }) });
  assert.equal(uploadedResponse.status, 201);
  const uploaded = (await uploadedResponse.json()).doc;
  assert.equal(idOf(uploaded.uploadedBySpace), lenaSpace.id);
  const prefixForm = new FormData();
  prefixForm.set('file', new Blob([png], { type: 'image/png' }), 'prefix-spoof.png');
  prefixForm.set('_payload', JSON.stringify({ alt: 'Destino falsificado', credit: 'Prueba', prefix: 'public/forged', rightsDeclaration: { declared: true } }));
  const prefixAttempt = await REST_POST(config)(new Request(`http://localhost:${webPort}/api/cms/media`, { method: 'POST', headers: { Authorization: `JWT ${lena}` }, body: prefixForm }), { params: Promise.resolve({ slug: ['media'] }) });
  assert.equal(prefixAttempt.status, 403, 'municipal uploads cannot target a public storage namespace');
  assert(denied((await rest('GET', `media/${uploaded.id}?depth=5`, undefined, mieres)).status));
  assert(denied((await rest('PATCH', `media/${uploaded.id}`, { alt: 'Intrusión' }, mieres)).status));
  assert(denied((await rest('DELETE', `media/${uploaded.id}`, undefined, mieres)).status));
  assert.equal((await fetch(`http://127.0.0.1:${webPort}/api/cms/graphql`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{ Articles { docs { id title } } }' }) })).status, 404);
  const cmsPage = await page('/cms', lena);
  assert(!cmsPage.html.includes('Noticia de Planta 14'), 'CMS panel cannot reveal editorial records to a municipal cookie');
  passed('multipart upload fixes tenant ownership; other tenants cannot read/edit/delete it; GraphQL is not mounted');
  // CDN purge hook (disabled by default) is called with the URLs on withdrawal, unpublication and deletion.
  const purges = [];
  const purgeServer = http.createServer((req, res) => { let b = ''; req.on('data', c => { b += c; }); req.on('end', () => { purges.push({ auth: req.headers.authorization, ...JSON.parse(b) }); res.end('ok'); }); });
  await new Promise(r => purgeServer.listen(0, '127.0.0.1', r));
  Object.assign(process.env, { CDN_PURGE_ENABLED: 'true', CDN_PURGE_URL: `http://127.0.0.1:${purgeServer.address().port}/purge`, CDN_PURGE_TOKEN: 'token-de-prueba' });
  const unpublishPost = (await rest('POST', 'municipal-content', item('Prueba de despublicación con imagen', { publishedAt: '2026-11-02', space: lenaSpace.id, image: uploaded.id, _status: 'published' }), editorToken)).json.doc;
  const unpublishURL = (await media(uploaded.id)).publicURL;
  assert.equal((await fetch(unpublishURL)).status, 200);
  assert.equal((await rest('PATCH', `municipal-content/${unpublishPost.id}`, { _status: 'draft' }, editorToken)).status, 200);
  assert.equal((await fetch(unpublishURL)).status, 404);
  assert(purges.at(-1)?.urls.includes(unpublishURL) && purges.at(-1).auth === 'Bearer token-de-prueba', 'purge on unpublish');
  await rest('DELETE', `municipal-content/${unpublishPost.id}`, undefined, editorToken);
  const withdrawalImagePost = (await rest('POST', 'municipal-content', item('Prueba editorial de imagen municipal', { publishedAt: '2026-11-02', space: lenaSpace.id, image: uploaded.id, _status: 'published' }), editorToken)).json.doc;
  assert(withdrawalImagePost?.id);
  const withdrawalURL = (await media(uploaded.id)).publicURL;
  assert.equal((await fetch(withdrawalURL)).status, 200);
  assert.equal((await rest('PATCH', `municipal-content/${withdrawalImagePost.id}`, { withdrawal: { withdrawn: true, reason: 'Ensayo de retirada con imagen' } }, editorToken)).status, 200);
  assert.equal((await fetch(withdrawalURL)).status, 404);
  assert(purges.at(-1)?.urls.includes(withdrawalURL), 'purge on withdrawal');
  const deletionImagePost = (await rest('POST', 'municipal-content', item('Prueba editorial de borrado con imagen', { publishedAt: '2026-11-02', space: lenaSpace.id, image: uploaded.id, _status: 'published' }), editorToken)).json.doc;
  const deletionURL = (await media(uploaded.id)).publicURL;
  assert.equal((await fetch(deletionURL)).status, 200);
  assert.equal((await rest('DELETE', `municipal-content/${deletionImagePost.id}`, undefined, editorToken)).status, 200);
  assert.equal((await fetch(deletionURL)).status, 404);
  assert(purges.at(-1)?.urls.includes(deletionURL), 'purge on deletion');
  assert(purges.every(p => p.urls.length === 3), 'original and both variants purged');
  const purgeOps = await payload.find({ collection: 'public-media-ops', overrideAccess: true, pagination: false, where: { and: [{ kind: { equals: 'delete' } }, { purge: { equals: 'sent' } }] } });
  assert(purgeOps.totalDocs >= 3, 'purge result recorded in the operation log');
  for (const k of ['CDN_PURGE_ENABLED', 'CDN_PURGE_URL', 'CDN_PURGE_TOKEN']) delete process.env[k];
  purgeServer.close();
  passed('public copies disappear from the origin on withdrawal, unpublication and deletion; CDN purge hook called with their URLs');
  const { testPublicStorageFailures } = await import('./block3-storage-failures.mjs');
  await testPublicStorageFailures({ payload, actor: editorActor, article, image, file });
  const { testPublicConcurrency } = await import('./block3-concurrency.mjs');
  await testPublicConcurrency({ payload, actor: editorActor, article, image });
  const { testPublicOrphans } = await import('./block3-storage-orphans.mjs');
  await testPublicOrphans({ payload, actor: editorActor, article, file, image, oldBucket: 'planta14-block3-public', newBucket: 'planta14-block3-public2', newBase: `http://127.0.0.1:${s3Port}/planta14-block3-public2` });
  if (process.env.CMS_BLOCK3_BROWSER_TEST === 'true') {
    const { testMunicipalBrowser } = await import('./block3-browser.mjs');
    await testMunicipalBrowser({ url: `http://localhost:${webPort}`, email: lenaUser.email, password, editorEmail: editorRes.json.doc.email });
  }

  // --- Migración reversible, protegida si hay cuentas municipales.
  await payload.update({ collection: 'articles', id: article.id, user: editorActor, overrideAccess: false, data: { seoImage: image.id } });
  assert.equal((await media(image.id)).publishedUses, 1, 'image and SEO use in the same document count once');
  const migration = await import('../cms/migrations/20261102_105932_bloque3.ts');
  const integration = await import('../cms/migrations/20261102_121412_integracion.ts');
  const tx = fn => payload.db.drizzle.transaction(db => fn({ db, payload, req: {} }));
  const liveKeyBefore = (await media(image.id)).publicKey;
  // Bloque 3 refuses with municipal accounts, withdrawals or audit records; each is resolved explicitly
  // (accounts are retired through the API while the full schema is still in place).
  await assert.rejects(tx(migration.down), /Retira las cuentas municipales/);
  for (const user of [lenaActor, mieresActor]) await payload.delete({ collection: 'users', id: user.id, overrideAccess: true });
  await assert.rejects(tx(migration.down), /retirados por Planta 14/);
  await payload.db.drizzle.execute(sql`UPDATE municipal_content SET withdrawal_withdrawn = false; UPDATE _municipal_content_v SET version_withdrawal_withdrawn = false`);
  await assert.rejects(tx(migration.down), /auditoría/);
  await payload.db.drizzle.execute(sql`DELETE FROM audit_log`); // explicit, after exporting it
  // Integration migration: refuses while rights declarations exist; keeps the durable operation log.
  await assert.rejects(tx(integration.down), /declaraciones de derechos/);
  await payload.db.drizzle.execute(sql`UPDATE media SET rights_declaration_declared = false`); // explicit, after exporting them
  await tx(integration.down);
  assert.notEqual((await payload.db.drizzle.execute(sql`SELECT to_regclass('public.public_media_ops') AS t`)).rows[0].t, null, 'operation log kept by down');
  await tx(migration.down);
  const gone = await payload.db.drizzle.execute(sql`SELECT to_regclass('public.audit_log') AS audit, to_regclass('public.notifications') AS notices,
    (SELECT count(*) FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'published_uses') AS col`);
  assert.equal(gone.rows[0].audit, null); assert.equal(gone.rows[0].notices, null); assert.equal(Number(gone.rows[0].col), 0);
  await tx(migration.up);
  await tx(integration.up);
  const back = await payload.db.drizzle.execute(sql`SELECT published_uses, public_key FROM media WHERE id = ${image.id}`);
  assert.equal(Number(back.rows[0].published_uses), 1, 'up backfills publishedUses from published content');
  assert.equal(back.rows[0].public_key, null, 'the SQL downgrade forgot the public key');
  const { syncAllPublicMedia } = await import('../cms/public-media.ts');
  process.env.PUBLIC_MEDIA_ORPHAN_GRACE_SECONDS = '0';
  await syncAllPublicMedia(payload);
  delete process.env.PUBLIC_MEDIA_ORPHAN_GRACE_SECONDS;
  const relinked = await media(image.id);
  assert(relinked.publicKey && relinked.publicKey !== liveKeyBefore);
  assert.equal((await fetch(relinked.publicURL)).status, 200);
  assert.equal((await fetch(`${publicBase}/${liveKeyBefore}/${relinked.filename}`)).status, 404, 'copy orphaned by the SQL downgrade removed via the durable log');
  assert.equal((await payload.count({ collection: 'users', overrideAccess: true })).totalDocs, 2);
  passed('migrations: refuse to roll back with declarations, municipal accounts, withdrawals or audit; roll back and reapply; orphaned copies cleaned after the SQL downgrade');
} finally {
  for (const child of children) { if (child.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; } }
  if (payload) await payload.destroy();
  await s3.close();
  if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir())) throw new Error('Unexpected test cleanup directory');
  await rm(directory, { recursive: true, force: true });
}
