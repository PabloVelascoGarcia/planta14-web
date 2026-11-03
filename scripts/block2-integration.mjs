import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import S3rver from 's3rver';
import sharp from 'sharp';
import pg from 'pg';

const databaseURL = 'postgres://planta14:local-development-only@127.0.0.1:55433/planta14_bloque2_test';
if (process.env.CMS_BLOCK2_TEST !== 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL !== databaseURL)) throw new Error('Use CMS_BLOCK2_TEST=true and the dedicated local database on port 55433');
Object.assign(process.env, { NODE_ENV: 'production', CMS_ENABLED: 'true', CONTENT_SOURCE: 'payload', PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: databaseURL,
  CMS_SERVER_URL: 'http://localhost:3041', S3_BUCKET: 'planta14-block2-test', S3_REGION: 'us-east-1', S3_ENDPOINT: 'http://127.0.0.1:59002', S3_FORCE_PATH_STYLE: 'true', S3_ACCESS_KEY_ID: 'S3RVER', S3_SECRET_ACCESS_KEY: 'S3RVER' });
// Only this disposable, named test database is reset. No phase-1/infra database is used.
const reset = new pg.Client({ connectionString: databaseURL });
await reset.connect();
await reset.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await reset.end();
const directory = await mkdtemp(path.join(os.tmpdir(), 'planta14-block2-'));
const s3 = new S3rver({ address: '127.0.0.1', port: 59002, directory, silent: true, configureBuckets: [{ name: 'planta14-block2-test' }] });
const children = [];
let payload;
const passed = name => console.log(`PASS: ${name}`);
try {
  await s3.run();
  const { getPayload } = await import('payload');
  const { sql } = await import('@payloadcms/db-postgres');
  const { default: config } = await import('../payload.config.ts');
  const { importMunicipalDemo, assertMunicipalProvenance } = await import('../cms/import-municipal.ts');
  const adapter = await import('../lib/payload-content.ts');
  payload = await getPayload({ config });
  await payload.db.migrate();
  const { REST_GET, REST_POST, REST_PATCH, REST_DELETE } = await import('@payloadcms/next/routes');
  const handlers = { GET: REST_GET, POST: REST_POST, PATCH: REST_PATCH, DELETE: REST_DELETE };
  const rest = (method, slug, body, token) => handlers[method](config)(new Request(`http://localhost:3041/api/cms/${slug.join('/')}`, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `JWT ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined,
  }), { params: Promise.resolve({ slug }) });
  const password = randomUUID() + randomUUID();
  const admin = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { email: 'admin@block2.example.test', password, name: 'Test admin', role: 'admin' } });
  const adminActor = { ...admin, collection: 'users' };
  const editor = await payload.create({ collection: 'users', overrideAccess: false, user: adminActor, data: { email: 'editor@block2.example.test', password, name: 'Test editor' } });
  assert.equal(editor.role, 'editor');
  const actor = { ...editor, collection: 'users' };
  const login = await rest('POST', ['users', 'login'], { email: editor.email, password });
  assert.equal(login.status, 200);
  assert(/;\s*Secure(?:=true)?(?:;|$)/i.test(login.headers.get('set-cookie')), 'Production cookie must carry Secure');
  const { token } = await login.json();
  passed('production login cookie includes Secure; new accounts default to editor');
  assert.equal((await rest('POST', ['users'], { name: 'Blocked', email: 'blocked@example.test', password, role: 'admin' }, token)).status, 403);
  assert.equal((await rest('PATCH', ['users', String(admin.id)], { name: 'Blocked' }, token)).status, 403);
  assert.equal((await rest('DELETE', ['users', String(admin.id)], undefined, token)).status, 403);
  assert.equal((await rest('PATCH', ['users', String(editor.id)], { role: 'admin' }, token)).status, 403);
  passed('editor cannot create, edit, delete users or elevate their own role');
  assertMunicipalProvenance();
  await importMunicipalDemo(payload);
  const counts = async () => Promise.all(['sections', 'towns', 'municipal-spaces', 'municipal-content', 'articles', 'authors', 'media'].map(async collection => (await payload.count({ collection, overrideAccess: true })).totalDocs));
  const first = await counts();
  await importMunicipalDemo(payload);
  assert.deepEqual(await counts(), first);
  assert.equal(first[1], 6); assert.equal(first[2], 6);
  assert.deepEqual(first.slice(4), [0, 0, 0]);
  const imported = await payload.find({ collection: 'municipal-content', pagination: false, depth: 0, overrideAccess: true });
  assert(imported.docs.every(d => d.provenance === 'planta14-municipal-demo-reviewed-2026-11-02'));
  assert.doesNotMatch(JSON.stringify(imported.docs), /la voz|agenda p[uú]blica|lavdg|avoz\.es|agendapublica/i);
  passed('idempotent import, six Caudal towns, verified municipal provenance, no editorial texts/authors/photos imported');

  const author = await payload.create({ collection: 'authors', overrideAccess: false, user: actor, data: { name: 'Equipo de prueba Planta 14', slug: 'equipo-prueba', role: 'Redacción', bio: 'Texto original de prueba automática.' } });
  const town = (await payload.find({ collection: 'towns', where: { slug: { equals: 'mieres' } } })).docs[0];
  const section = (await payload.find({ collection: 'sections', where: { slug: { equals: 'cultura' } } })).docs[0];
  assert.equal((await rest('PATCH', ['sections', String(section.id)], { name: 'Blocked' }, token)).status, 403);
  assert.equal((await rest('PATCH', ['towns', String(town.id)], { visible: false }, token)).status, 403);
  const municipalSpace = (await payload.find({ collection: 'municipal-spaces', limit: 1 })).docs[0];
  const notice = await payload.create({ collection: 'municipal-content', overrideAccess: false, user: actor, draft: true, data: { space: municipalSpace.id, type: 'notice', title: 'Aviso original de prueba', excerpt: 'Aviso de prueba', body: 'Contenido propio de la prueba automática.', origin: 'municipality', publishedAt: '2026-11-02', demo: true, _status: 'draft' } });
  assert.equal((await rest('GET', ['municipal-content', String(notice.id)])).status, 404);
  await payload.update({ collection: 'municipal-content', id: notice.id, user: actor, overrideAccess: false, data: { _status: 'published' } });
  assert.equal((await rest('GET', ['municipal-content', String(notice.id)])).status, 200);
  await payload.delete({ collection: 'municipal-content', id: notice.id, user: actor, overrideAccess: false });
  passed('editor publishes municipal content but cannot change sections or town configuration');
  const articleData = { slug: 'historia-original-prueba', title: 'Una historia original de prueba', excerpt: 'Contenido propio creado exclusivamente para validar el adaptador.', body: ['Este párrafo es una muestra original de la prueba automática.'], author: author.id, town: town.id, section: section.id, date: '2026-11-02', publishedAt: '2026-11-02T10:00:00.000Z', _status: 'published', main: true, provenance: 'original-automated-test' };
  const article = await payload.create({ collection: 'articles', overrideAccess: false, user: actor, data: articleData });
  const draft = await payload.create({ collection: 'articles', overrideAccess: false, user: actor, draft: true, data: { ...articleData, slug: 'borrador-prueba', title: 'Borrador privado de prueba', _status: 'draft', main: false } });
  assert.equal((await rest('GET', ['articles', String(draft.id)])).status, 404);
  assert.equal((await rest('GET', ['articles', String(article.id)])).status, 200);
  passed('editor creates and publishes articles; public REST cannot read a draft');

  const data = await sharp({ create: { width: 1800, height: 1000, channels: 3, background: '#24704a' } }).png().toBuffer();
  const file = { data, mimetype: 'image/png', name: 'original-test.png', size: data.length };
  await assert.rejects(payload.create({ collection: 'media', user: actor, overrideAccess: false, data: { alt: 'Missing rights', credit: 'Test' }, file }));
  const media = await payload.create({ collection: 'media', user: actor, overrideAccess: false, data: { alt: 'Original de prueba', credit: 'Planta 14 test', rightsHolder: 'Planta 14 test', rightsType: 'propia', rightsScope: 'demo' }, file });
  await assert.rejects(payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false, data: { image: media.id } }));
  await payload.update({ collection: 'media', id: media.id, user: actor, overrideAccess: false, data: { rightsScope: 'publicable' } });
  assert([403, 404].includes((await rest('GET', ['media', 'file', media.filename])).status), 'unlinked images remain private');
  await payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false, data: { image: media.id } });
  assert.equal((await rest('GET', ['media', String(media.id)])).status, 200);
  // Bloque 3: signed URLs are only issued to authenticated panels; the public site uses PUBLIC_MEDIA_BASE_URL.
  assert([403, 404].includes((await rest('GET', ['media', 'file', media.filename])).status));
  const redirect = await rest('GET', ['media', 'file', media.filename], undefined, token);
  assert.equal(redirect.status, 302);
  assert.equal(new URL(redirect.headers.get('location')).searchParams.get('X-Amz-Expires'), '60');
  assert.equal((await fetch(redirect.headers.get('location'))).status, 200);
  await assert.rejects(payload.update({ collection: 'media', id: media.id, user: actor, overrideAccess: false, data: { rightsScope: 'demo' } }));
  await assert.rejects(payload.delete({ collection: 'media', id: media.id, user: actor, overrideAccess: false }));
  await payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false, draft: false, data: { _status: 'draft' } });
  assert.equal((await rest('GET', ['articles', String(article.id)])).status, 404);
  assert([403, 404].includes((await rest('GET', ['media', 'file', media.filename])).status));
  await payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false, data: { _status: 'published' } });
  await payload.update({ collection: 'articles', id: article.id, user: actor, overrideAccess: false, data: { image: null } });
  assert([403, 404].includes((await rest('GET', ['media', 'file', media.filename])).status));
  passed('rights required, demo images cannot publish, linked-only public media, signed direct S3 download, revocation and deletion protections');

  const current = await payload.findByID({ collection: 'articles', id: article.id, depth: 2, overrideAccess: true });
  const fixture = { id: String(article.id), slug: articleData.slug, title: articleData.title, excerpt: articleData.excerpt, body: articleData.body,
    image: '/images/placeholder.svg', imageAlt: '', imageCredit: '', date: articleData.date, author: author.name, authorSlug: author.slug,
    comarca: 'Caudal', concejo: 'Mieres', topic: 'Cultura', status: 'published', publishedAt: articleData.publishedAt, seoTitle: articleData.title,
    seoDescription: articleData.excerpt, seoImage: '/images/placeholder.svg', main: true, featured: false, opinion: false };
  assert.deepEqual(JSON.parse(JSON.stringify(adapter.articleContract(current))), fixture);
  await writeFile(path.join(directory, 'articles.json'), JSON.stringify([fixture, { ...fixture, id: String(draft.id), slug: draft.slug, title: draft.title, status: 'draft', main: false }]));
  await writeFile(path.join(directory, 'authors.json'), JSON.stringify([{ name: author.name, slug: author.slug, role: 'Redacción', bio: 'Texto original de prueba automática.' }]));
  async function start(source, port) {
    const child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
      windowsHide: true, env: { ...process.env, CONTENT_SOURCE: source, DEMO_CONTENT: 'presentation', CMS_DEMO_DATA_DIR: directory, CMS_SERVER_URL: `http://localhost:${port}`, NEXT_TELEMETRY_DISABLED: '1', PLANTA14_TEST_TODAY: '2026-10-15' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    children.push(child);
    let logs = ''; child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(`HTTP server exited: ${logs.slice(-1500)}`);
      try { const response = await fetch(`http://127.0.0.1:${port}/robots.txt`); if (response.ok) return; } catch { /* starting */ }
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('HTTP server did not start');
  }
  await start('demo', 3040); await start('payload', 3041);
  const mainContent = html => (html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<!--.*?-->/g, '').replace(/\s+/g, ' ').trim();
  // Demo-only pieces (CONTENT_SOURCE=demo): header and footer notes, the demo-panel link, the magazine teaser,
  // the panel invitation and «Ejemplo»/«de muestra» labels. Everything else must render identically.
  const withoutDemoOnly = html => html
    .replace('<span>Edición de demostración</span>', '')
    .replace(/<a[^>]*href="\/aller\/panel"[^>]*>Demo municipal<\/a>/, '')
    .replace(/<p class="mt-3">Textos e imágenes utilizados únicamente con fines de demostración\. No se publican\.<\/p>/, '')
    .replace(/<section[^>]*aria-label="El semanal de Planta 14"[\s\S]*?<\/section>/, '')
    .replace(/<section class="municipal-panel-invite">[\s\S]*?<\/section>/, '')
    .replaceAll('Agenda de muestra · ', '')
    // Origin label of municipal cards only (data such as a place may legitimately contain «Ejemplo»).
    .replace(/(<span>[^<>]*?(?:<!-- -->)? · (?:<!-- -->)?)Ejemplo<\/span>/g, '$1Publicado por el ayuntamiento</span>')
    .replace(/(<small>[0-9:]+(?:<!-- -->)? h(?:<!-- -->)? · (?:<!-- -->)?)Ejemplo<\/small>/g, '$1Publicado por el ayuntamiento</small>');
  for (const route of ['/edicion', '/niebla', '/admin/login']) assert.equal((await fetch(`http://127.0.0.1:3041${route}`)).status, 404, `payload ${route} is demo-only (404)`);
  for (const route of ['/', '/lena', '/mieres', '/aller', '/morcin', '/riosa', '/ribera-de-arriba', '/agenda', '/noticia/historia-original-prueba']) {
    const [demo, cms] = await Promise.all([fetch(`http://127.0.0.1:3040${route}`), fetch(`http://127.0.0.1:3041${route}`)]);
    assert.equal(demo.status, 200, `demo ${route}`); assert.equal(cms.status, 200, `payload ${route}`);
    // The agenda list is compared elsewhere: with real content it shows upcoming events sorted by date (and the
    // general agenda), while the demo keeps its fixed sample order (scripts/ensayo-integration.mjs).
    const withoutAgenda = html => html.replace(/<div class="divide-y divide-coal-900\/15 border-y border-coal-900\/15">[\s\S]*?<\/article><\/div>/, '<div class="agenda"></div>');
    let expected = mainContent(withoutAgenda(withoutDemoOnly(await demo.text()))); const actual = mainContent(withoutAgenda(await cms.text()));
    // The concejo page's «Contenido de ejemplo» label belongs to the demo only (CONTENT_SOURCE=demo).
    const label = '<span class="municipal-example">Contenido de ejemplo</span>';
    if (/^\/(lena|mieres|aller|morcin|riosa|ribera-de-arriba)$/.test(route)) {
      const occurrences = text => text.split(label).length - 1;
      assert.equal(occurrences(expected), occurrences(actual) + 1, `demo shows the example label once more than payload: ${route}`);
      expected = expected.replace(label, '');
    }
    if (actual !== expected && process.env.BLOCK2_DIFF) { let i = 0; while (expected[i] === actual[i]) i++; console.log('DIFF', route, '\nDEMO   :', expected.slice(i - 150, i + 250), '\nPAYLOAD:', actual.slice(i - 150, i + 250)); }
    assert(expected.length > 0); assert(actual === expected, `same rendered body (header, content, footer): ${route}`);
  }
  assert.equal((await fetch('http://127.0.0.1:3041/noticia/borrador-prueba')).status, 404);
  assert.equal((await fetch('http://127.0.0.1:3041/niebla/adrian-barbon')).status, 404);
  assert.doesNotMatch(await (await fetch('http://127.0.0.1:3041/niebla')).text(), /agendapublica|sobrevia\.net/);
  passed('identical rendered body for demo/payload on nine public pages except demo-only pieces and the agenda list; /edicion, /niebla and /admin 404 in payload; HTTP draft 404 and magazine demo isolation');

  // Exercise downgrade/up inside real transactions after testing the protective editor guard.
  const migration = await import('../cms/migrations/20261102_094653_bloque2.ts');
  // Bloque 3 sits on top of bloque 2: roll it back first and reapply it at the end.
  const block3 = await import('../cms/migrations/20261102_105932_bloque3.ts');
  await assert.rejects(payload.db.drizzle.transaction(db => migration.down({ db, payload, req: {} })), /Retira las cuentas editor/);
  await payload.delete({ collection: 'users', id: editor.id, overrideAccess: true });
  // Later migrations first. Bloque 3 refuses to drop audit records: they are cleared explicitly here.
  const integration = await import('../cms/migrations/20261102_121412_integracion.ts');
  await payload.db.drizzle.transaction(db => integration.down({ db, payload, req: {} }));
  await assert.rejects(payload.db.drizzle.transaction(db => block3.down({ db, payload, req: {} })), /auditoría/);
  await payload.db.drizzle.execute(sql`DELETE FROM audit_log`);
  await payload.db.drizzle.transaction(db => block3.down({ db, payload, req: {} }));
  await payload.db.drizzle.transaction(db => migration.down({ db, payload, req: {} }));
  const absent = await payload.db.drizzle.execute(sql`SELECT to_regclass('public.articles') AS name`);
  assert.equal(absent.rows[0].name, null);
  await payload.db.drizzle.transaction(db => migration.up({ db, payload, req: {} }));
  await payload.db.drizzle.transaction(db => block3.up({ db, payload, req: {} }));
  await payload.db.drizzle.transaction(db => integration.up({ db, payload, req: {} }));
  assert.equal((await payload.count({ collection: 'articles', overrideAccess: true })).totalDocs, 0);
  assert.equal((await payload.count({ collection: 'users', overrideAccess: true })).totalDocs, 1);
  const oldMedia = await payload.findByID({ collection: 'media', id: media.id, overrideAccess: true });
  assert.equal(oldMedia.filename, media.filename);
  assert.equal(oldMedia.rightsScope, 'demo');
  assert.equal(oldMedia.rightsHolder, null);
  passed('forward migration, guarded rollback without role escalation, rollback and reapply preserve phase-1 admin');
} finally {
  for (const child of children) { if (child.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; } }
  if (payload) await payload.destroy();
  await s3.close();
  if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir())) throw new Error('Unexpected test cleanup directory');
  await rm(directory, { recursive: true, force: true });
}
