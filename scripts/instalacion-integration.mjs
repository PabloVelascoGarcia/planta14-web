import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

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
} finally {
  await payload?.destroy();
}
