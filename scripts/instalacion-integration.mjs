import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import os from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import S3rver from 's3rver';
import sharp from 'sharp';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

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
const s3Directory = await mkdtemp(path.join(os.tmpdir(), 'planta14-instalacion-'));
const s3 = new S3rver({ address: '127.0.0.1', port: 59007, directory: s3Directory, silent: true, configureBuckets: [{ name: 'planta14-instalacion-private' }, { name: 'planta14-instalacion-public' }] });
await s3.run();
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
// Sin los separadores <!-- --> que React pone entre textos contiguos.
const page = async url => { const response = await fetch(url); assert.equal(response.status, 200, url); return (await response.text()).replaceAll('<!-- -->', ''); };
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

  // --- Identidad visual del espacio municipal (CMS): valores iniciales, diseño neutro, permisos y foto de Imágenes.
  const { identitySeed } = await import('../cms/municipal-identity-seed.ts');
  const spaceBy = async legacyID => (await payload.find({ collection: 'municipal-spaces', overrideAccess: true, where: { legacyID: { equals: legacyID } }, depth: 0 })).docs[0];
  const sameAsSeed = (doc, legacyID) => {
    const seed = identitySeed[legacyID];
    const { heroImage, crestImage, stories, ...rest } = doc.identity;
    assert.equal(heroImage ?? null, null); assert.equal(crestImage ?? null, null);
    assert.deepEqual({ ...rest, stories: stories.map(({ label, title, text, href }) => ({ label, title, text, href })) }, seed, `${legacyID} identity`);
  };
  for (const town of towns) sameAsSeed(await spaceBy(town.id), town.id);
  // Instalación existente (la de c29e024): espacios sin identidad → la migración la carga en ellos y en su última versión.
  const identityMigration = await import('../cms/migrations/20261103_000335_identidad_espacios.ts');
  const migrationTx = fn => payload.db.drizzle.transaction(db => fn({ db, payload, req: {} }));
  await migrationTx(identityMigration.down);
  await migrationTx(identityMigration.up);
  for (const town of towns) sameAsSeed(await spaceBy(town.id), town.id);
  const { sql: rawSql } = await import('@payloadcms/db-postgres');
  const latest = (await payload.db.drizzle.execute(rawSql`SELECT count(*)::int AS n FROM _municipal_spaces_v v JOIN municipal_spaces s ON s.id = v.parent_id WHERE v.latest AND v.version_identity_title = s.identity_title`)).rows[0].n;
  assert.equal(latest, towns.length, 'the latest version (opened by the CMS) carries the same identity');
  const lenaHTML = await page(`${cms}/lena`);
  for (const piece of ['aller-theme', 'src="/lena/escudo.svg"', 'Escudo: Manuelfb55 · CC BY-SA 4.0', 'Licencia de la fotografía', 'Lena, todo el año', 'Santa Cristina de Lena']) assert.ok(lenaHTML.includes(piece), `inactive /lena keeps «${piece}»`);
  assert.ok(!lenaHTML.includes('aller-hero'), 'inactive page without hero, as before');
  passed('municipal identity in the CMS: the six Caudal spaces get the current values (new installs from the structure load; existing ones from the migration, latest version included); the inactive page keeps crest, colours, credits and stories');

  // Campos vacíos → diseño neutro; parciales → solo lo que hay.
  const riosa = await spaceBy('riosa');
  await payload.update({ collection: 'municipal-spaces', id: riosa.id, overrideAccess: true, data: { identity: { heroImagePath: null, heroImageAlt: null, heroImageCredit: null, heroImageSource: null, heroImageLicenseUrl: null, title: null, subtitle: null, crestPath: null, crestCredit: null, crestSource: null, crestLicenseUrl: null, colors: { accent: null, dark: null, soft: null, border: null }, official: null, tourism: null, stories: [] } } });
  const neutral = await page(`${cms}/riosa`);
  assert.ok(!neutral.includes('aller-theme') && !neutral.includes('aller-crest') && !neutral.includes('aller-asset-credit') && !neutral.includes('aller-discover'), 'empty identity → neutral design');
  assert.ok(neutral.includes('ESCUDO<br/>MUNICIPAL') || neutral.includes('Marcador para el escudo municipal'), 'neutral crest placeholder');
  const morcin = await spaceBy('morcin');
  await payload.update({ collection: 'municipal-spaces', id: morcin.id, overrideAccess: true, data: { identity: { colors: { accent: '#123456', dark: null, soft: null, border: null } } } });
  const partial = await page(`${cms}/morcin`);
  assert.ok(!partial.includes('aller-theme') && partial.includes('aller-crest') && partial.includes('Morcín, todo el año'), 'incomplete colours → neutral theme, other pieces kept');
  passed('empty identity fields keep the page working with the neutral design (no theme, crest placeholder, no credits or stories); partial identity shows only what exists');

  // Permisos: solo administración; la cuenta municipal lo ve en solo lectura; validaciones.
  const lenaSpace = await spaceBy('lena');
  const userPassword = randomUUID();
  const admin = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { name: 'Administración', email: 'admin-identidad@planta14.example', password: userPassword, role: 'admin' } });
  const editor = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { name: 'Redacción', email: 'redaccion-identidad@planta14.example', password: userPassword, role: 'editor' } });
  const municipal = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { name: 'Ayto. Lena', email: 'lena-identidad@planta14.example', password: randomUUID(), role: 'municipal', municipalSpace: lenaSpace.id } });
  await assert.rejects(payload.update({ collection: 'municipal-spaces', id: lenaSpace.id, user: editor, overrideAccess: false, data: { identity: { title: 'Cambio de la redacción' } } }), /permiso|not allowed|Forbidden|prohibido/i);
  await assert.rejects(payload.update({ collection: 'municipal-spaces', id: lenaSpace.id, user: municipal, overrideAccess: false, data: { identity: { title: 'Cambio del ayuntamiento' } } }), /permiso|not allowed|Forbidden|prohibido/i);
  const seenByMunicipal = await payload.findByID({ collection: 'municipal-spaces', id: lenaSpace.id, user: municipal, overrideAccess: false, depth: 0 });
  assert.equal(seenByMunicipal.identity.title, identitySeed.lena.title, 'the municipal account reads its identity');
  const fieldAccess = payload.collections['municipal-spaces'].config.fields.find(f => f.name === 'identity').access;
  assert.equal(fieldAccess.update({ req: { user: municipal } }), false); assert.equal(fieldAccess.update({ req: { user: editor } }), false); assert.equal(fieldAccess.update({ req: { user: admin } }), true);
  await payload.update({ collection: 'municipal-spaces', id: lenaSpace.id, user: admin, overrideAccess: false, data: { identity: { title: 'Lena, un lugar para quedarse.' } } });
  await assert.rejects(payload.update({ collection: 'municipal-spaces', id: lenaSpace.id, overrideAccess: true, data: { identity: { colors: { accent: 'azul' } } } }), /Color principal/);
  await assert.rejects(payload.update({ collection: 'municipal-spaces', id: lenaSpace.id, overrideAccess: true, data: { identity: { official: 'http://inseguro.example' } } }), /Web oficial/);
  passed('identity fields: only the administration edits them (editor and municipal account rejected, read-only for the municipality); colour and link validation');

  // Foto de cabecera elegida en Imágenes (con derechos): copia pública mientras el espacio esté publicado.
  const png = await sharp({ create: { width: 2000, height: 800, channels: 3, background: '#335577' } }).png().toBuffer();
  const photo = await payload.create({ collection: 'media', overrideAccess: true, file: { data: png, mimetype: 'image/png', name: 'cabecera-mieres.png', size: png.length },
    data: { alt: 'Paisaje de Mieres (prueba)', credit: 'Planta 14 (prueba)', rightsHolder: 'Planta 14', rightsType: 'propia', rightsScope: 'publicable' } });
  const mieresSpace = await spaceBy('mieres');
  await payload.update({ collection: 'municipal-spaces', id: mieresSpace.id, user: admin, overrideAccess: false, data: { identity: { heroImage: photo.id, title: 'Mieres, nuevo lema de prueba' } } });
  const published = await payload.findByID({ collection: 'media', id: photo.id, overrideAccess: true });
  assert.equal(published.publishedUses, 1, 'the identity photo counts as a published use'); assert.ok(published.publicKey, 'public copy created');
  const mieresHTML = await page(`${cms}/mieres`);
  assert.ok(mieresHTML.includes(`planta14-instalacion-public/${published.publicKey}/`), 'active page shows the CMS photo from the public bucket');
  assert.ok(mieresHTML.includes('Mieres, nuevo lema de prueba') && !mieresHTML.includes('/mieres/panorama.webp"'), 'the CMS photo and slogan replace the previous ones');
  await payload.update({ collection: 'municipal-spaces', id: mieresSpace.id, user: admin, overrideAccess: false, data: { identity: { heroImage: null } } });
  const unlinked = await payload.findByID({ collection: 'media', id: photo.id, overrideAccess: true });
  assert.equal(unlinked.publishedUses, 0); assert.equal(unlinked.publicKey ?? null, null, 'public copy removed when no longer used');
  assert.ok((await page(`${cms}/mieres`)).includes('/mieres/panorama.webp'), 'back to the photo of the web files');
  const draftPhoto = await payload.create({ collection: 'media', overrideAccess: true, file: { data: png, mimetype: 'image/png', name: 'sin-derechos.png', size: png.length },
    data: { alt: 'Sin derechos', credit: 'Prueba', rightsHolder: 'Prueba', rightsType: 'propia', rightsScope: 'demo' } });
  await assert.rejects(payload.update({ collection: 'municipal-spaces', id: mieresSpace.id, user: admin, overrideAccess: false, data: { identity: { heroImage: draftPhoto.id } } }), /derechos publicables/);
  passed('a header photo chosen in Imágenes gets a public copy while used by a published space and replaces the web file; removed when unlinked; images without publishable rights rejected');

  // --- CMS en español: idioma único y etiquetas de colecciones, campos, grupos y opciones.
  assert.deepEqual(Object.keys(payload.config.i18n.supportedLanguages), ['es']);
  const labels = Object.fromEntries(payload.config.collections.map(c => [c.slug, c.labels.plural]));
  for (const [slug, plural] of Object.entries({ users: 'Usuarios', media: 'Imágenes', articles: 'Noticias', authors: 'Autores', sections: 'Secciones', towns: 'Concejos', 'municipal-spaces': 'Espacios municipales', 'municipal-content': 'Contenidos municipales' })) assert.equal(labels[slug], plural, slug);
  const flat = fields => fields.flatMap(x => x.type === 'tabs' ? x.tabs.flatMap(t => flat(t.fields)) : (x.type === 'collapsible' || x.type === 'row') ? flat(x.fields) : [x]);
  const field = (slug, ...path) => { let fields = payload.collections[slug].config.fields; let f; for (const name of path) { f = flat(fields).find(x => x.name === name); fields = f?.fields; } return f; };
  assert.equal(field('articles', 'title').label, 'Título'); assert.equal(field('articles', 'town').label, 'Concejo');
  assert.equal(field('municipal-spaces', 'subscription').label, 'Suscripción'); assert.equal(field('municipal-spaces', 'subscription', 'status').label, 'Estado');
  assert.deepEqual(field('municipal-spaces', 'subscription', 'status').options.map(o => o.label), ['Demostración', 'Activo', 'Inactivo']);
  assert.deepEqual(field('users', 'role').options.map(o => [o.value, o.label]), [['admin', 'Administración'], ['editor', 'Redacción'], ['municipal', 'Ayuntamiento']]);
  const unlabeled = [];
  const walk = (slug, fields, prefix = '') => { for (const f of fields) { if (f.type === 'tabs') { for (const t of f.tabs) walk(slug, t.fields, prefix); continue; } if ((f.type === 'collapsible' || f.type === 'row') && f.fields) { walk(slug, f.fields, prefix); continue; } if (!f.name) continue; if (!f.label && !['id', 'createdAt', 'updatedAt', '_status', 'hash', 'salt', 'resetPasswordToken', 'resetPasswordExpiration', 'resetPasswordRequestedAt', 'loginAttempts', 'lockUntil', 'sessions', 'apiKey', 'enableAPIKey', 'apiKeyIndex', 'url', 'thumbnailURL', 'filename', 'mimeType', 'filesize', 'width', 'height', 'focalX', 'focalY', 'sizes', 'prefix'].includes(f.name)) unlabeled.push(`${slug}.${prefix}${f.name}`); if (f.fields && f.type !== 'group' ? false : f.fields) walk(slug, f.fields, `${prefix}${f.name}.`); } };
  for (const c of payload.config.collections.filter(c => !c.slug.startsWith('payload-'))) walk(c.slug, c.fields);
  assert.deepEqual(unlabeled, [], 'every visible field has a Spanish label');
  const login = await page(`${cms}/cms/login`);
  assert.match(login, /<html[^>]*lang="es"/); assert.match(login, /Iniciar sesión|Iniciar Sesión/);
  passed('CMS in Spanish only: Payload i18n es, Spanish labels for every collection, field, group and list option');

  // --- Restos de la demo: ninguno con CONTENT_SOURCE=payload; la demo sigue igual.
  const demoTexts = ['Edición de demostración', 'Demo municipal', 'fines de demostración', 'Propuestas editoriales de demostración', 'Esta edición de demostración', 'ejemplos de integración', 'panel de demostración', 'Agenda de muestra'];
  const visible = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  for (const route of ['/', '/agenda', '/contacto', '/publicidad', '/cookies', '/mieres', '/lena', '/aviso-legal', '/tema/sociedad', '/buscar']) {
    const html = visible(await page(`${cms}${route}`));
    for (const text of demoTexts) assert.ok(!html.includes(text), `payload ${route} shows «${text}»`);
    assert.doesNotMatch(html, /demostraci[oó]n|Contenido de ejemplo|>Ejemplo</i, `payload ${route} has no demo wording`);
  }
  assert.ok(!visible(await page(`${cms}/`)).includes('href="/niebla'), 'payload home has no link to the demo magazine');
  for (const route of ['/edicion', '/niebla', '/niebla/adrian-barbon', '/admin', '/admin/login', '/mieres/panel', '/lena/panel']) {
    assert.equal((await fetch(`${cms}${route}`, { redirect: 'manual' })).status === 404 || (await fetch(`${cms}${route}`)).status === 404, true, `payload ${route} → 404`);
  }
  const demoHome = await page(`${demo}/`);
  for (const text of ['Edición de demostración', 'Demo municipal', 'fines de demostración', 'Propuestas editoriales de demostración']) assert.ok(demoHome.includes(text), `demo home keeps «${text}»`);
  assert.equal((await fetch(`${demo}/edicion`)).status, 200); assert.equal((await fetch(`${demo}/niebla`)).status, 200); assert.equal((await fetch(`${demo}/aller/panel`)).status, 200);
  passed('no demo leftovers with CONTENT_SOURCE=payload (header, footer, home, contact, ads, cookies, agenda, concejo pages); /edicion, /niebla, /admin and inactive panels 404; the demo is unchanged');

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

  // --- CMS para periodistas: «Creada por», vista previa en vivo y panel de inicio según el rol.
  const signIn = async email => {
    const response = await fetch(`${cms}/api/cms/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ email, password: userPassword }) });
    assert.equal(response.status, 200, `login ${email}`);
    return response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  };
  const as = cookie => ({ headers: { Cookie: cookie, 'Sec-Fetch-Site': 'same-origin' } });
  const editorCookie = await signIn(editor.email), adminCookie = await signIn(admin.email);
  const draftArticle = await payload.create({ collection: 'articles', user: editor, overrideAccess: false, draft: true,
    data: { ...base, slug: 'borrador-de-la-redaccion', title: 'Borrador de la redacción', _status: 'draft', createdBy: admin.id } });
  assert.equal(draftArticle.createdBy?.id ?? draftArticle.createdBy, editor.id, '«Creada por» is the session user, not the client value');
  const edited = await payload.update({ collection: 'articles', id: draftArticle.id, user: admin, overrideAccess: false, draft: true, data: { title: 'Borrador de la redacción', createdBy: admin.id } });
  assert.equal(edited.createdBy?.id ?? edited.createdBy, editor.id, '«Creada por» never changes');
  const previewURL = `${cms}/vista-previa/noticia/${draftArticle.id}`;
  assert.equal((await fetch(previewURL)).status, 404, 'preview hidden without a CMS session');
  const preview = await fetch(previewURL, as(editorCookie));
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get('x-robots-tag') || '', /noindex/);
  const previewHTML = (await preview.text()).replaceAll('<!-- -->', '');
  assert.ok(previewHTML.includes('Borrador de la redacción') && previewHTML.includes('data-preview="on"') && previewHTML.includes('lg:grid-cols-[minmax(0,760px)_300px]'), 'draft rendered with the public article layout');
  assert.equal(payload.collections.articles.config.admin.livePreview.url({ data: { id: draftArticle.id } }), `http://localhost:3071/vista-previa/noticia/${draftArticle.id}`);
  // En vivo: el CMS envía el formulario por postMessage (mismo origen) y la vista se actualiza sin guardar.
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
  try {
    const context = await browser.newContext();
    await context.addCookies(editorCookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: 'http://localhost:3071' }; }));
    const tab = await context.newPage();
    await tab.goto(`http://localhost:3071/vista-previa/noticia/${draftArticle.id}`);
    await tab.waitForSelector('h1');
    const liveDoc = (await payload.findByID({ collection: 'articles', id: draftArticle.id, draft: true, depth: 2, overrideAccess: true }));
    await tab.evaluate(doc => window.postMessage({ type: 'payload-live-preview', collectionSlug: 'articles', data: { ...doc, title: 'Título escrito ahora mismo', excerpt: 'Entradilla en vivo' } }, window.location.origin), liveDoc);
    await tab.waitForFunction(() => document.querySelector('h1')?.textContent === 'Título escrito ahora mismo', null, { timeout: 10000 });
    assert.ok((await tab.content()).includes('Entradilla en vivo'));
  } finally { await browser.close(); }
  passed('live preview: drafts render with the public article design at /vista-previa/noticia/[id] (CMS session only, noindex) and update live from the CMS form; «Creada por» is set by the server');

  const dashboard = async cookie => (await (await fetch(`${cms}/cms`, as(cookie))).text()).replaceAll('<!-- -->', '');
  const editorHome = await dashboard(editorCookie), adminHome = await dashboard(adminCookie);
  assert.ok(editorHome.includes('data-cms-dashboard="editor"'), 'editor dashboard');
  for (const link of ['nueva', 'borradores', 'hoy']) assert.ok(editorHome.includes(`data-dashboard-link="${link}"`), `editor sees ${link}`);
  for (const link of ['avisos', 'espacios', 'usuarios']) assert.ok(!editorHome.includes(`data-dashboard-link="${link}"`), `editor does not see ${link}`);
  assert.ok(editorHome.includes(`createdBy][equals]=${editor.id}`), '«Mis borradores» filters by the session user');
  assert.match(editorHome, />1<\/span><strong[^>]*>Mis borradores/, 'one draft of mine');
  for (const link of ['nueva', 'borradores', 'hoy', 'avisos', 'espacios', 'usuarios']) assert.ok(adminHome.includes(`data-dashboard-link="${link}"`), `admin sees ${link}`);
  passed('CMS home: shortcuts «Nueva noticia», «Mis borradores» and «Publicadas hoy» with counts; the administration also sees municipal notices, spaces and users');

  // --- Formulario de noticia: texto enriquecido, slug automático y fechas con selector.
  const { sql: q } = await import('@payloadcms/db-postgres');
  const t = (text, format = 0) => ({ type: 'text', text, format, detail: 0, mode: 'normal', style: '', version: 1 });
  const el = (type, children, extra = {}) => ({ type, children, direction: 'ltr', format: '', indent: 0, version: 1, ...extra });
  const richBody = { root: el('root', [
    el('paragraph', [t('Texto con '), t('negrita', 1), t(' y '), t('cursiva', 2), t(' y un '),
      el('link', [t('enlace')], { fields: { url: 'https://example.org/fuente', newTab: true, linkType: 'custom' } }), t('.')]),
    el('heading', [t('Un ladillo')], { tag: 'h2' }),
    el('quote', [t('Una cita textual.')]),
    el('list', [el('listitem', [t('Primer punto')], { value: 1 }), el('listitem', [t('Segundo punto')], { value: 2 })], { listType: 'bullet', tag: 'ul', start: 1 }),
    el('paragraph', [el('link', [t('enlace peligroso')], { fields: { url: 'javascript:alert(1)', linkType: 'custom' } })]),
  ]) };
  const noDate = { ...base }; delete noDate.date;
  const rich = await payload.create({ collection: 'articles', overrideAccess: true, data: { ...noDate, title: 'Ñandú y cañadas: el texto enriquecido en Mieres', body: richBody } });
  assert.equal(rich.slug, 'nandu-y-canadas-el-texto-enriquecido-en-mieres', 'slug generated from the title, without accents or ñ');
  assert.equal(rich.date, '2026-11-02', 'day derived from the publication date (Madrid)');
  const twin = await payload.create({ collection: 'articles', overrideAccess: true, data: { ...noDate, title: 'Ñandú y cañadas: el texto enriquecido en Mieres', body: ['Otra.'] } });
  assert.equal(twin.slug, 'nandu-y-canadas-el-texto-enriquecido-en-mieres-2', 'unique slug');
  assert.equal(twin.body.root.children[0].children[0].text, 'Otra.', 'a list of paragraphs is accepted and stored as rich text');
  const richHTML = await page(`${cms}/noticia/${rich.slug}`);
  for (const html of ['<strong>negrita</strong>', '<em>cursiva</em>', 'href="https://example.org/fuente"', '>Un ladillo</h2>', 'Una cita textual.</blockquote>', '<li>Primer punto</li>'])
    assert.ok(richHTML.includes(html), `rich text renders ${html}`);
  assert.ok(!richHTML.includes('javascript:alert'), 'unsafe links are not rendered as links');
  assert.ok((await page(`${cms}/buscar?q=ladillo`)).includes('Ñandú y cañadas'), 'search finds words of the rich text');
  // Programada: sale sola a su hora; una fecha de publicación futura sin programar no se admite.
  const later = new Date(Date.now() + 3600_000).toISOString();
  const scheduled = await payload.create({ collection: 'articles', overrideAccess: true, data: { ...noDate, publishedAt: undefined, title: 'Noticia programada para dentro de una hora', scheduledAt: later } });
  assert.equal(scheduled.publishedAt, later, 'scheduled: the publication date is the scheduled one');
  assert.equal((await fetch(`${cms}/noticia/${scheduled.slug}`)).status, 404, 'scheduled article hidden until its time');
  assert.equal((await payload.find({ collection: 'articles', overrideAccess: false, where: { slug: { equals: scheduled.slug } } })).totalDocs, 0);
  await assert.rejects(payload.create({ collection: 'articles', overrideAccess: true, data: { ...noDate, title: 'Fecha futura sin programar', publishedAt: later } }), /Publicación programada/);
  await payload.update({ collection: 'articles', id: scheduled.id, overrideAccess: true, data: { scheduledAt: new Date(Date.now() - 1000).toISOString() } });
  assert.equal((await fetch(`${cms}/noticia/${scheduled.slug}`)).status, 200, 'out once its time has come');
  // Fecha de publicación vacía: se pone sola al publicar (no al abrir o guardar el borrador).
  const noDates = { ...noDate }; delete noDates.publishedAt;
  const undated = await payload.create({ collection: 'articles', overrideAccess: true, draft: true, data: { ...noDates, _status: 'draft', title: 'Borrador sin fecha de publicación' } });
  assert.equal(undated.publishedAt ?? null, null, 'a draft keeps an empty publication date');
  const publishTime = Date.now();
  const publishedNow = await payload.update({ collection: 'articles', id: undated.id, overrideAccess: true, data: { _status: 'published' } });
  assert.ok(new Date(publishedNow.publishedAt).getTime() >= publishTime - 1000, 'publishing fills it with the publication time');
  // Quitar la programación de una noticia aún no publicada la deja sin fecha futura.
  const unscheduled = await payload.create({ collection: 'articles', overrideAccess: true, data: { ...noDates, title: 'Programada y luego desprogramada', scheduledAt: later } });
  const cleared = await payload.update({ collection: 'articles', id: unscheduled.id, overrideAccess: true, data: { scheduledAt: null } });
  assert.equal(cleared.scheduledAt ?? null, null);
  assert.ok(new Date(cleared.publishedAt).getTime() <= Date.now(), 'clearing the schedule publishes it now');
  passed('article form: rich text (bold, italic, links, subheadings, quotes, lists) rendered on the web and searchable, unsafe links dropped; slug from the title (no accents, ñ → n, unique); scheduled articles stay hidden until their time; a future publication date requires «Publicación programada»; an empty publication date is filled when publishing; clearing a schedule publishes now');

  // Migración: noticias existentes (texto como lista de párrafos, fechas en texto) → texto enriquecido y fecha y hora.
  const formMigration = await import('../cms/migrations/20261103_121545_formulario_noticias.ts');
  const ftx = fn => payload.db.drizzle.transaction(db => fn({ db, payload, req: {} }));
  const colType = async () => (await payload.db.drizzle.execute(q`SELECT data_type FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'published_at'`)).rows[0].data_type;
  assert.equal(await colType(), 'timestamp with time zone');
  await ftx(formMigration.down);
  assert.equal(await colType(), 'character varying', 'down: dates back to text');
  const legacyBody = (await payload.db.drizzle.execute(q`SELECT body FROM articles WHERE id = ${rich.id}`)).rows[0].body;
  assert.deepEqual(legacyBody, ['Texto con negrita y cursiva y un enlace.', 'Un ladillo', 'Una cita textual.', 'Primer punto', 'Segundo punto', 'enlace peligroso'], 'down: rich text back to paragraphs (plain text)');
  // Como estaban antes: párrafos con espacios y vacíos, fechas sin hora, con hora local o en ISO, programadas y vacías.
  const legacy = [
    { id: shown.id, published: '2026-10-01', scheduled: '', date: '2026-10-01' },
    { id: hidden.id, published: '2026-10-02T08:30', scheduled: null, date: '2026-10-02' },
    { id: twin.id, published: '', scheduled: '2026-12-24T20:00', date: '2026-12-24' },
    { id: draftArticle.id, published: null, scheduled: null, date: '2026-07-15' },
  ];
  for (const row of legacy) await payload.db.drizzle.execute(q`UPDATE articles SET published_at = ${row.published}, scheduled_at = ${row.scheduled}, date = ${row.date}, body = ${JSON.stringify(['  Primer párrafo «con» comillas. ', '', 'Segundo párrafo.'])}::jsonb WHERE id = ${row.id}`);
  await ftx(formMigration.up);
  assert.equal(await colType(), 'timestamp with time zone');
  const after = Object.fromEntries((await payload.db.drizzle.execute(q`SELECT id, to_char(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS p, to_char(scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS s, date, body FROM articles`)).rows.map(r => [r.id, r]));
  assert.deepEqual([after[shown.id].p, after[shown.id].s, after[shown.id].date], ['2026-10-01T07:00', null, '2026-10-01'], 'date without time → 09:00 Madrid');
  assert.deepEqual([after[hidden.id].p, after[hidden.id].date], ['2026-10-02T06:30', '2026-10-02'], 'local time → Madrid');
  assert.deepEqual([after[twin.id].p, after[twin.id].s, after[twin.id].date], ['2026-12-24T19:00', '2026-12-24T19:00', '2026-12-24'], 'scheduled → publication date is the scheduled one');
  assert.deepEqual([after[draftArticle.id].p, after[draftArticle.id].date], ['2026-07-15T07:00', '2026-07-15'], 'no publication date → taken from the day');
  assert.deepEqual(after[rich.id].p, '2026-11-02T10:00', 'ISO dates unchanged');
  const { lexicalToParagraphs } = await import('../lib/rich-text.ts');
  assert.deepEqual(lexicalToParagraphs(after[shown.id].body), ['Primer párrafo «con» comillas.', 'Segundo párrafo.'], 'up: each paragraph becomes a rich-text paragraph, text unchanged');
  assert.deepEqual(lexicalToParagraphs(after[rich.id].body), legacyBody, 'down/up keeps the text');
  assert.ok((await page(`${cms}/noticia/${(await payload.findByID({ collection: 'articles', id: shown.id, depth: 0, overrideAccess: true })).slug}`)).includes('<p>Primer párrafo «con» comillas.</p>'));
  passed('migration 20261103_121545_formulario_noticias: existing bodies (lists of paragraphs) become rich text without losing text; text dates become date and time (date only → 09:00 Madrid, local → Madrid, ISO as is; scheduled → publication date; missing → from the day); down/up is reversible');
  // La firma vinculada del usuario se pone por defecto como autor.
  await payload.update({ collection: 'users', id: editor.id, overrideAccess: true, data: { author: author.id } });
  const authorField = payload.collections.articles.config.flattenedFields.find(f => f.name === 'author');
  assert.equal(await authorField.defaultValue({ user: { ...editor, author: author.id } }), author.id, 'author defaults to the linked author');
  assert.equal(await authorField.defaultValue({ user: { ...editor, author: { id: author.id } } }), author.id);
  assert.equal(await authorField.defaultValue({ user: { ...editor, author: null } }), undefined);
  passed('author defaults to the user\'s linked author');

  // --- Migración reversible.
  const migration = await import('../cms/migrations/20261102_174946_mostrar_en_concejo.ts');
  const tx = fn => payload.db.drizzle.transaction(db => fn({ db, payload, req: {} }));
  const { sql } = await import('@payloadcms/db-postgres');
  const columns = async () => (await payload.db.drizzle.execute(sql`SELECT table_name, column_name FROM information_schema.columns WHERE column_name IN ('show_in_town', 'version_show_in_town') ORDER BY table_name`)).rows.map(r => `${r.table_name}.${r.column_name}`);
  assert.deepEqual(await columns(), ['_articles_v.version_show_in_town', 'articles.show_in_town']);
  const articleCount = async () => (await payload.db.drizzle.execute(sql`SELECT count(*)::int AS n FROM articles`)).rows[0].n;
  const articlesBefore = await articleCount();
  await tx(migration.down);
  assert.deepEqual(await columns(), [], 'down removes both columns');
  assert.equal(await articleCount(), articlesBefore, 'down keeps the articles');
  await tx(migration.up);
  assert.deepEqual(await columns(), ['_articles_v.version_show_in_town', 'articles.show_in_town']);
  const flags = (await payload.db.drizzle.execute(sql`SELECT bool_and(show_in_town) AS all_true, bool_and(show_in_town IS NOT NULL) AS no_nulls FROM articles`)).rows[0];
  assert.deepEqual([flags.all_true, flags.no_nulls], [true, true], 'up marks existing articles as shown');
  passed('migration 20261102_174946_mostrar_en_concejo is reversible: down drops the columns and keeps the news; up restores them checked for existing news');
} finally {
  for (const child of children) child.kill('SIGTERM');
  await payload?.destroy();
  await s3.close();
  await rm(s3Directory, { recursive: true, force: true });
}
