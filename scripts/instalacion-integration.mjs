import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Rama de instalación: carga de estructura de producción (sin demostración), etiqueta «Contenido de ejemplo»,
// casilla «Mostrar en la página del concejo» y su migración. Base PostgreSQL desechable
// (compose.instalacion-test.yaml, puerto 55436). Datos sintéticos.
const databaseURL = 'postgres://planta14:local-development-only@127.0.0.1:55436/planta14_instalacion_test';
if (process.env.CMS_INSTALACION_TEST !== 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL !== databaseURL)) throw new Error('Use CMS_INSTALACION_TEST=true and the dedicated local database on port 55436');
Object.assign(process.env, { NODE_ENV: 'production', CMS_ENABLED: 'true', CONTENT_SOURCE: 'payload', PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: databaseURL,
  CMS_SERVER_URL: 'http://localhost:3071', S3_BUCKET: 'planta14-instalacion-private', S3_REGION: 'us-east-1', S3_ENDPOINT: 'http://127.0.0.1:59007', S3_FORCE_PATH_STYLE: 'true',
  S3_ACCESS_KEY_ID: 'S3RVER', S3_SECRET_ACCESS_KEY: 'S3RVER', PUBLIC_MEDIA_BASE_URL: 'http://127.0.0.1:59007/planta14-instalacion-public', PUBLIC_MEDIA_BUCKET: 'planta14-instalacion-public' });
const reset = new pg.Client({ connectionString: databaseURL });
await reset.connect();
await reset.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await reset.end();
const passed = name => console.log(`PASS: ${name}`);
let payload;
const children = [];
// Servidor Next ya compilado (npm run build) contra la base de prueba.
async function start(port, env) {
  const child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, CMS_SERVER_URL: `http://localhost:${port}`, SITE_URL: `http://localhost:${port}`, NEXT_TELEMETRY_DISABLED: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let logs = ''; child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`next exited: ${logs.slice(-1500)}`);
    try { if ((await fetch(`http://127.0.0.1:${port}/robots.txt`)).ok) return `http://127.0.0.1:${port}`; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('next did not start');
}
const page = async url => { const response = await fetch(url); assert.equal(response.status, 200, url); return response.text(); };
const exampleLabel = '<span class="municipal-example">Contenido de ejemplo</span>';
try {
  const { getPayload } = await import('payload');
  const { default: config } = await import('../payload.config.ts');
  const { loadStructure, caudalTowns } = await import('../cms/structure.ts');
  const { siteSections } = await import('../lib/site-sections.ts');
  payload = await getPayload({ config });
  await payload.db.migrate();
  const all = async collection => (await payload.find({ collection, overrideAccess: true, pagination: false, depth: 0, draft: true })).docs;
  const counts = async () => Object.fromEntries(await Promise.all(['sections', 'towns', 'municipal-spaces', 'municipal-content', 'articles', 'authors', 'media', 'users']
    .map(async c => [c, (await all(c)).length])));

  // --- 1. Estructura de producción: secciones, concejos y espacios inactivos; nada de demostración.
  const first = await loadStructure(payload);
  const towns = caudalTowns();
  assert.deepEqual(first.created, { sections: siteSections.length, towns: towns.length, 'municipal-spaces': towns.length });
  assert.deepEqual(await counts(), { sections: siteSections.length, towns: towns.length, 'municipal-spaces': towns.length, 'municipal-content': 0, articles: 0, authors: 0, media: 0, users: 0 });
  const sections = (await all('sections')).sort((a, b) => a.position - b.position);
  assert.deepEqual(sections.map(s => s.name), siteSections, 'same sections and order as the demo navigation');
  assert.ok(sections.some(s => s.name === 'Opinión' && s.slug === 'opinion'), 'Opinión included');
  assert.deepEqual((await all('towns')).map(t => t.slug).sort(), ['aller', 'lena', 'mieres', 'morcin', 'ribera-de-arriba', 'riosa']);
  for (const space of await all('municipal-spaces')) {
    assert.equal(space.subscription.status, 'inactive', `${space.name} inactive`);
    assert.equal(space._status, 'published', 'published so the town page exists');
    assert.deepEqual([space.contact.place, space.contact.hours, space.contact.note].filter(Boolean), [], 'no example contact data');
    assert.ok(!/demo/i.test(JSON.stringify(space)), 'no demo marks');
  }
  passed(`production structure: ${siteSections.length} sections (navigation order, Opinión included), ${towns.length} Caudal towns and their municipal spaces inactive; no news, notices, authors, images or example contacts`);

  // --- Repetible: no duplica ni toca lo que existe.
  const opinion = sections.find(s => s.slug === 'opinion');
  await payload.update({ collection: 'sections', id: opinion.id, overrideAccess: true, data: { name: 'Opinión y tribuna' } });
  const mieres = (await all('municipal-spaces')).find(s => s.legacyID === 'mieres');
  await payload.update({ collection: 'municipal-spaces', id: mieres.id, overrideAccess: true, data: { subscription: { status: 'active', startsAt: '2026-12-04', endsAt: null } } });
  const before = await counts();
  const second = await loadStructure(payload);
  assert.deepEqual(second.created, { sections: 0, towns: 0, 'municipal-spaces': 0 });
  assert.deepEqual(await counts(), before);
  assert.equal((await payload.findByID({ collection: 'sections', id: opinion.id, overrideAccess: true })).name, 'Opinión y tribuna', 'existing section untouched');
  assert.equal((await payload.findByID({ collection: 'municipal-spaces', id: mieres.id, overrideAccess: true })).subscription.status, 'active', 'existing space untouched');
  passed('structure load is repeatable: second run creates nothing, and edited sections and spaces are left as they are');

  // --- 2. «Contenido de ejemplo» solo con CONTENT_SOURCE=demo.
  const cms = await start(3071, {});
  const demo = await start(3072, { CONTENT_SOURCE: 'demo', CMS_ENABLED: 'false' });
  for (const town of ['mieres', 'lena']) {
    assert.ok(!(await page(`${cms}/${town}`)).includes(exampleLabel), `no example label with CONTENT_SOURCE=payload: ${town}`);
    assert.ok((await page(`${demo}/${town}`)).includes(exampleLabel), `example label with CONTENT_SOURCE=demo: ${town}`);
  }
  passed('the «Contenido de ejemplo» label on concejo pages appears only with CONTENT_SOURCE=demo');

  // --- 3. «Mostrar en la página del concejo»: marcada por defecto; desmarcada, la noticia no sale en el concejo.
  const mieresTown = (await all('towns')).find(t => t.slug === 'mieres');
  const section = (await all('sections')).find(s => s.slug === 'sociedad');
  const author = await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'Redacción de prueba', slug: 'redaccion-prueba' } });
  const base = { excerpt: 'Entradilla sintética.', body: ['Texto sintético.'], author: author.id, town: mieresTown.id, section: section.id, date: '2026-11-02', publishedAt: '2026-11-02T10:00:00.000Z', _status: 'published' };
  const shown = await payload.create({ collection: 'articles', overrideAccess: true, data: { ...base, slug: 'noticia-en-el-concejo', title: 'Noticia que sale en el concejo' } });
  const hidden = await payload.create({ collection: 'articles', overrideAccess: true, data: { ...base, slug: 'noticia-fuera-del-concejo', title: 'Noticia que no sale en el concejo', showInTown: false } });
  assert.equal(shown.showInTown, true, 'checked by default');
  assert.equal(hidden.showInTown, false);
  const mieresPage = await page(`${cms}/mieres`);
  assert.ok(mieresPage.includes('Noticia que sale en el concejo'), 'checked article on the concejo page');
  assert.ok(!mieresPage.includes('Noticia que no sale en el concejo'), 'unchecked article not on the concejo page');
  assert.ok((await page(`${cms}/noticia/noticia-fuera-del-concejo`)).includes('Noticia que no sale en el concejo'), 'unchecked article still published');
  assert.ok((await page(`${cms}/`)).includes('Noticia que no sale en el concejo') || (await page(`${cms}/tema/sociedad`)).includes('Noticia que no sale en el concejo'), 'unchecked article still listed elsewhere');
  await payload.update({ collection: 'articles', id: hidden.id, overrideAccess: true, data: { showInTown: true } });
  assert.ok((await page(`${cms}/mieres`)).includes('Noticia que no sale en el concejo'), 'checking it again brings it back');
  await payload.update({ collection: 'articles', id: hidden.id, overrideAccess: true, data: { showInTown: false } });
  passed('«Mostrar en la página del concejo» is checked by default; unchecked news stay published (article, home or section) but leave the concejo page');

  // --- Migración reversible.
  const migration = await import('../cms/migrations/20261102_174946_mostrar_en_concejo.ts');
  const tx = fn => payload.db.drizzle.transaction(db => fn({ db, payload, req: {} }));
  const { sql } = await import('@payloadcms/db-postgres');
  const columns = async () => (await payload.db.drizzle.execute(sql`SELECT table_name, column_name FROM information_schema.columns WHERE column_name IN ('show_in_town', 'version_show_in_town') ORDER BY table_name`)).rows.map(r => `${r.table_name}.${r.column_name}`);
  assert.deepEqual(await columns(), ['_articles_v.version_show_in_town', 'articles.show_in_town']);
  await tx(migration.down);
  assert.deepEqual(await columns(), [], 'down removes both columns');
  assert.equal((await payload.db.drizzle.execute(sql`SELECT count(*)::int AS n FROM articles`)).rows[0].n, 2, 'down keeps the articles');
  await tx(migration.up);
  assert.deepEqual(await columns(), ['_articles_v.version_show_in_town', 'articles.show_in_town']);
  const flags = (await payload.db.drizzle.execute(sql`SELECT bool_and(show_in_town) AS all_true, bool_and(show_in_town IS NOT NULL) AS no_nulls FROM articles`)).rows[0];
  assert.deepEqual([flags.all_true, flags.no_nulls], [true, true], 'up marks existing articles as shown');
  passed('migration 20261102_174946_mostrar_en_concejo is reversible: down drops the columns and keeps the news; up restores them checked for existing news');
} finally {
  for (const child of children) child.kill('SIGTERM');
  await payload?.destroy();
}
