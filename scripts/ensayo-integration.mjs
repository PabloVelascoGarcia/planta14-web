import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import pg from 'pg';
import S3rver from 's3rver';
import sharp from 'sharp';

// Carga y retirada del contenido de ensayo (cms/ensayo.ts) con datos reales de contenido-ensayo/.
// Base PostgreSQL desechable (compose.ensayo-test.yaml, 55437), S3rver (59008) y un sustituto de Commons (59009) que
// sirve imágenes sintéticas con la misma ruta y resolución que los originales (este entorno no llega a Commons).
const databaseURL = 'postgres://planta14:local-development-only@127.0.0.1:55437/planta14_ensayo_test';
if (process.env.CMS_ENSAYO_TEST !== 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL !== databaseURL)) throw new Error('Use CMS_ENSAYO_TEST=true and the dedicated local database on port 55437');
const s3Port = 59008, commonsPort = 59009, webPort = 3081;
const publicBucket = 'planta14-ensayo-public';
Object.assign(process.env, { NODE_ENV: 'production', CMS_ENABLED: 'true', CONTENT_SOURCE: 'payload', PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: databaseURL,
  CMS_SERVER_URL: `http://localhost:${webPort}`, S3_BUCKET: 'planta14-ensayo-private', S3_REGION: 'us-east-1', S3_ENDPOINT: `http://127.0.0.1:${s3Port}`, S3_FORCE_PATH_STYLE: 'true',
  S3_ACCESS_KEY_ID: 'S3RVER', S3_SECRET_ACCESS_KEY: 'S3RVER', PUBLIC_MEDIA_BASE_URL: `http://127.0.0.1:${s3Port}/${publicBucket}`, PUBLIC_MEDIA_BUCKET: publicBucket,
  ENSAYO_FOTOS_BASE: `http://127.0.0.1:${commonsPort}` });
for (const key of ['SITE_INDEXABLE', 'SITE_URL']) delete process.env[key];
const reset = new pg.Client({ connectionString: databaseURL });
await reset.connect(); await reset.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); await reset.end();

const passed = name => console.log(`PASS: ${name}`);
const directory = await mkdtemp(path.join(os.tmpdir(), 'planta14-ensayo-'));
const s3 = new S3rver({ address: '127.0.0.1', port: s3Port, directory, silent: true, configureBuckets: [{ name: 'planta14-ensayo-private' }, { name: publicBucket }] });
await s3.run();

// Sustituto de Commons: JPEG sintético con la resolución anotada de cada original; cuenta las descargas.
const fotos = JSON.parse(await readFile('contenido-ensayo/fotos.json', 'utf8'));
const byPath = new Map(fotos.catalogo.map(f => [new URL(f.archivoOriginal).pathname, f]));
const downloads = []; const imageCache = new Map();
const commons = http.createServer(async (req, res) => {
  const foto = byPath.get(req.url);
  downloads.push(req.url);
  if (!foto) { res.writeHead(404); res.end(); return; }
  if (!imageCache.has(foto.id)) {
    const hue = [...foto.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 200;
    imageCache.set(foto.id, await sharp({ create: { width: foto.resolucion.ancho, height: foto.resolucion.alto, channels: 3, background: { r: 40 + hue / 2, g: 90, b: 60 + hue / 3 } } }).jpeg({ quality: 40 }).toBuffer());
  }
  res.writeHead(200, { 'content-type': 'image/jpeg', 'user-agent-received': req.headers['user-agent'] || '' }); res.end(imageCache.get(foto.id));
});
await new Promise(r => commons.listen(commonsPort, '127.0.0.1', r));

const children = [];
async function start(port) {
  const child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, CMS_SERVER_URL: `http://localhost:${port}`, SITE_URL: `http://localhost:${port}`, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let logs = ''; child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`next exited: ${logs.slice(-1500)}`);
    try { if ((await fetch(`http://127.0.0.1:${port}/robots.txt`)).ok) return `http://127.0.0.1:${port}`; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('next did not start');
}
const page = async url => { const r = await fetch(url); assert.equal(r.status, 200, url); return (await r.text()).replaceAll('<!-- -->', ''); };
const publicObjects = async () => { try { return (await readdir(path.join(directory, publicBucket), { recursive: true })).filter(f => !f.endsWith('_S3rver_metadata.json') && !f.endsWith('_S3rver_object.md5')).length; } catch { return 0; } };

let payload;
try {
  const { getPayload } = await import('payload');
  const { default: config } = await import('../payload.config.ts');
  const { loadStructure } = await import('../cms/structure.ts');
  const ensayo = await import('../cms/ensayo.ts');
  payload = await getPayload({ config });
  await payload.db.migrate();
  await loadStructure(payload);
  const contenido = JSON.parse(await readFile('contenido-ensayo/contenido.json', 'utf8'));
  const piezas = contenido.piezas;
  const articulos = piezas.filter(p => !p.space), municipales = piezas.filter(p => p.space);
  const password = randomUUID();
  const admin = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { name: 'Administración', email: 'admin-ensayo@planta14.example', password, role: 'admin' } });
  const editor = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { name: 'Redacción', email: 'redaccion-ensayo@planta14.example', password, role: 'editor' } });
  const all = async (collection, where) => (await payload.find({ collection, where, pagination: false, depth: 0, overrideAccess: true, draft: true })).docs;
  const counts = async () => Object.fromEntries(await Promise.all(['articles', 'municipal-content', 'media', 'authors', 'municipal-spaces', 'sections', 'towns'].map(async c => [c, (await all(c)).length])));
  const spaceState = async () => Object.fromEntries((await all('municipal-spaces')).map(s => [s.legacyID, `${s.subscription.status}|${s.subscription.startsAt ?? ''}|${s._status}`]));

  // Contenido que NO es del ensayo, anterior a la carga.
  const town = slug => all('towns', { slug: { equals: slug } }).then(d => d[0].id);
  const section = slug => all('sections', { slug: { equals: slug } }).then(d => d[0].id);
  const autorPrevio = await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'Autora previa', slug: 'autora-previa' } });
  const previa = await payload.create({ collection: 'articles', overrideAccess: true, user: editor, data: { slug: 'noticia-real-previa', title: 'Noticia real anterior al ensayo', excerpt: 'Real.', body: ['Texto real.'],
    author: autorPrevio.id, town: await town('mieres'), section: await section('sociedad'), date: '2026-10-01', publishedAt: '2026-10-01T09:00:00.000Z', _status: 'published' } });
  const before = await counts(), spacesBefore = await spaceState();

  // --- Solo comprobar: dice qué haría y no escribe nada.
  const now = new Date();
  const lines = [];
  const plan = await ensayo.cargar(payload, { dir: 'contenido-ensayo', soloComprobar: true, now, log: l => lines.push(l) });
  assert.deepEqual(plan.creados, { 'imágenes': 19, autores: 3, articles: articulos.length, 'municipal-content': municipales.length });
  assert.deepEqual(await counts(), before, '--solo-comprobar writes nothing');
  assert.deepEqual(await spaceState(), spacesBefore);
  assert.equal(downloads.length, 0, '--solo-comprobar downloads nothing');
  assert.ok(lines.some(l => l.includes('Bustiello: la vida alrededor de la mina')) && plan.espacios.length === 2);
  assert.deepEqual(plan.avisos.map(a => a.split(':')[0]).sort(), ['p14-agenda-06', 'p14-noticia-20', 'p14-noticia-24']);
  passed(`--solo-comprobar: plans ${articulos.length} articles, ${municipales.length} municipal items, 19 images, 3 authors and 2 spaces without writing or downloading anything`);

  // --- Carga.
  const informe = await ensayo.cargar(payload, { dir: 'contenido-ensayo', soloComprobar: false, now, log: () => {} });
  assert.deepEqual(informe.creados, plan.creados);
  const loaded = await all('articles', { lote: { exists: true } });
  assert.equal(loaded.length, articulos.length);
  assert.equal(loaded.filter(a => a.lote === 'definitivo').length, 2); assert.ok(loaded.filter(a => a.lote === 'definitivo').every(a => /reportaje/.test(a.legacyID)));
  assert.ok(loaded.every(a => a._status === 'published'), 'everything published');
  const mc = await all('municipal-content', { lote: { exists: true } });
  assert.equal(mc.length, municipales.length); assert.ok(mc.every(m => m._status === 'published' && m.lote === 'ensayo' && m.demo === false));
  // Fechas: publicaciones en los 4 días anteriores, horas verosímiles; eventos en las semanas siguientes.
  const day = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
  const today = day(now), shift = n => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const window = [shift(-4), shift(-3), shift(-2), shift(-1)];
  for (const doc of [...loaded, ...mc]) {
    const local = day(new Date(doc.publishedAt));
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hourCycle: 'h23' }).format(new Date(doc.publishedAt)));
    assert.ok(window.includes(local), `${doc.legacyID} published within the 4 previous days (${local})`);
    assert.ok(hour >= 7 && hour <= 21, `${doc.legacyID} plausible hour (${hour})`);
    if (doc.date) assert.equal(doc.date, local);
  }
  assert.equal(new Set(loaded.map(a => a.date)).size, 4, 'spread over the 4 days');
  const events = [...loaded.filter(a => a.agenda?.eventAt).map(a => a.agenda.eventAt), ...mc.filter(m => m.type === 'event').map(m => m.eventAt)];
  assert.equal(events.length, 12);
  for (const at of events) { assert.match(at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/); assert.ok(at.slice(0, 10) > today && at.slice(0, 10) <= shift(45), `event in the following weeks (${at})`); }
  // Aviso de ensayo al final; fechas del texto actualizadas; opciones de concejo.
  for (const doc of [...loaded, ...mc]) {
    const parrafos = Array.isArray(doc.body) ? doc.body : doc.body.split('\n\n');
    const idx = parrafos.findIndex(t => t.startsWith('Contenido ficticio de ensayo'));
    if (idx >= 0) assert.equal(idx, parrafos.length - 1, `${doc.legacyID}: notice paragraph last`);
  }
  const agenda1 = loaded.find(a => a.legacyID === 'p14-agenda-01');
  assert.ok(!JSON.stringify(agenda1.body).includes('2026-12-12') && JSON.stringify(agenda1.body).includes(ensayo.formatoFecha(agenda1.agenda.eventAt.slice(0, 10))), 'event date in the text updated');
  const carta = loaded.find(a => a.legacyID === 'p14-carta-director-001');
  assert.equal(carta.showInTown, false); assert.equal(carta.opinion, true); assert.equal(carta.lote, 'ensayo');
  passed('load: articles, opinions, letter, reports, general agenda and municipal items published with lote (2 definitive reports); dates in the 4 previous days at plausible hours, events in the following weeks; test notice moved to the end');

  // Fotos: originales de Commons subidos con autor, licencia, enlace y declaración de la administración citando la fuente.
  const images = await all('media', { lote: { exists: true } });
  assert.equal(images.length, 19); assert.equal(new Set(downloads).size, 19);
  for (const image of images) {
    const foto = fotos.catalogo.find(f => f.paginaCommons === image.sourceURL);
    assert.ok(foto, 'linked to its Commons page');
    const long = Math.max(foto.resolucion.ancho, foto.resolucion.alto), scale = Math.min(1, 2560 / long);
    assert.equal(Math.max(image.width, image.height), Math.round(long * scale), 'reduced to 2560 px on the long side');
    assert.ok(Math.abs(image.width / image.height - foto.resolucion.ancho / foto.resolucion.alto) < 0.01, 'aspect ratio kept');
    assert.equal(image.mimeType, 'image/jpeg');
    assert.equal(image.credit, `${foto.autor} / Wikimedia Commons / ${foto.licencia} (reducida de tamaño)`); assert.equal(image.rightsHolder, foto.autor); assert.equal(image.rightsScope, 'publicable');
    assert.equal(image.rightsDeclaration.declared, true); assert.equal(image.rightsDeclaration.declaredBy, admin.id);
    assert.ok(image.rightsDeclaration.statement.includes(foto.paginaCommons) && image.rightsDeclaration.statement.includes(foto.licencia) && image.rightsDeclaration.statement.includes('administración'));
  }
  const reportPhotos = new Set(loaded.filter(a => a.lote === 'definitivo').map(a => a.image));
  assert.ok([...reportPhotos].every(id => images.find(i => i.id === id).lote === 'definitivo'), 'photos of definitive reports are definitive');
  assert.ok((await all('municipal-spaces')).every(s => !s.identity?.heroImage), 'header candidates are uploaded, not assigned');
  assert.ok(loaded.filter(a => a.image).length >= articulos.length - 3);
  // Memoria: reducir la foto más grande (8104 × 4559, con ruido como una foto real) en un proceso aparte.
  const biggest = fotos.catalogo.reduce((a, b) => a.resolucion.ancho * a.resolucion.alto >= b.resolucion.ancho * b.resolucion.alto ? a : b);
  const bigFile = path.join(directory, 'mayor.jpg');
  await sharp({ create: { width: biggest.resolucion.ancho, height: biggest.resolucion.alto, channels: 3, background: '#557766', noise: { type: 'gaussian', mean: 128, sigma: 40 } } }).jpeg({ quality: 92 }).toFile(bigFile);
  const bigBytes = (await import('node:fs')).statSync(bigFile).size;
  const measureScript = path.join(directory, 'medir.mts');
  (await import('node:fs')).writeFileSync(measureScript, `
    import { readFileSync } from 'node:fs'; import sharp from ${JSON.stringify(pathToFileURL(createRequire(import.meta.url).resolve('sharp')).href)}; import { reducirFoto } from ${JSON.stringify(path.resolve('cms/ensayo.ts'))};
    const out = await reducirFoto(readFileSync(${JSON.stringify(bigFile)}));
    const meta = await sharp(out).metadata();
    console.log(JSON.stringify({ maxRSS: process.resourceUsage().maxRSS, width: meta.width, height: meta.height, bytes: out.length }));`);
  const measure = JSON.parse(execFileSync(path.resolve('node_modules/.bin/tsx'), [measureScript], { cwd: process.cwd() }).toString().trim().split('\n').pop());
  const peakMiB = Math.round(measure.maxRSS / 1024);
  assert.equal(measure.width, 2560); assert.equal(measure.height, Math.round(2560 * biggest.resolucion.alto / biggest.resolucion.ancho));
  assert.ok(peakMiB < 384, `peak memory ${peakMiB} MiB must leave room in the 768 MiB migration container`);
  console.log(`MEDIDA: reducir ${biggest.resolucion.ancho} × ${biggest.resolucion.alto} (${Math.round(bigBytes / 1048576)} MiB JPEG) → 2560 × ${measure.height} (${Math.round(measure.bytes / 1024)} KiB): pico ${peakMiB} MiB del proceso completo (Node + sharp)`);
  passed(`photos: 19 Commons originals downloaded once (resolution checked), reduced to 2560 px (JPEG 85) and uploaded with author, licence, link and an administration rights declaration citing the source; header candidates not assigned; reducing the largest one peaks at ${peakMiB} MiB`);

  // Espacios y web pública.
  const spacesLoaded = await spaceState();
  assert.match(spacesLoaded.mieres, /^active\|/); assert.match(spacesLoaded.lena, /^active\|/); assert.equal(spacesLoaded.aller, spacesBefore.aller);
  const web = await start(webPort);
  const mieres = await page(`${web}/mieres`);
  assert.ok(mc.filter(m => municipales.find(p => p.legacyID === m.legacyID).space === 'mieres' && m.type === 'news').every(m => mieres.includes(m.title)) || mieres.includes('Tu espacio de información municipal'));
  assert.ok(mieres.includes('Tu espacio de información municipal'), 'Mieres active');
  const agendaHTML = await page(`${web}/agenda`);
  for (const a of loaded.filter(a => a.agenda?.eventAt)) assert.ok(agendaHTML.includes(a.title), `general agenda «${a.title}» in /agenda`);
  assert.ok(agendaHTML.includes(`/noticia/${agenda1.slug}`), 'agenda links to the article');
  assert.ok((await page(`${web}/`)).includes('Para salir'));
  assert.ok((await page(`${web}/noticia/bustiello-la-vida-alrededor-de-la-mina`)).includes('Wikimedia Commons'), 'photo credit shown');
  passed('spaces of Mieres and Lena active (previous state kept); general agenda listed in /agenda with links; pages render');

  // --- Segunda carga: no duplica nada.
  const afterFirst = await counts(); const downloadsBefore = downloads.length;
  const again = await ensayo.cargar(payload, { dir: 'contenido-ensayo', soloComprobar: false, now: new Date(now.getTime() + 86400000), log: () => {} });
  assert.deepEqual(again.creados, {}); assert.deepEqual(await counts(), afterFirst); assert.equal(downloads.length, downloadsBefore, 'nothing downloaded again');
  assert.ok(again.espacios.every(e => e.includes('ya activado')));
  const loteMigration = await import('../cms/migrations/20261103_081533_lote_ensayo.ts');
  await assert.rejects(payload.db.drizzle.transaction(db => loteMigration.down({ db, payload, req: {} })), /retíralo/, 'migration down refused while test content is loaded');
  passed('second load: nothing duplicated, nothing downloaded, spaces untouched; the lote migration refuses to roll back while test content is loaded');

  // --- Después de la carga, alguien trabaja: una noticia nueva (sin lote) reutiliza una foto del ensayo; otra se edita.
  const ensayoOnlyPhoto = images.find(i => i.lote === 'ensayo');
  const nueva = await payload.create({ collection: 'articles', user: editor, overrideAccess: false, data: { slug: 'noticia-real-con-foto-del-ensayo', title: 'Noticia real con una foto del ensayo', excerpt: 'Real.', body: ['Texto.'],
    author: autorPrevio.id, town: await town('lena'), section: await section('cultura'), date: today, publishedAt: now.toISOString(), image: ensayoOnlyPhoto.id, _status: 'published' } });
  assert.equal(nueva.lote ?? null, null, 'an editor cannot set or see lote');
  await payload.update({ collection: 'articles', id: nueva.id, user: editor, overrideAccess: false, data: { lote: 'ensayo' } });
  assert.equal((await payload.findByID({ collection: 'articles', id: nueva.id, overrideAccess: true })).lote ?? null, null, 'an editor cannot mark content as test');
  const editada = loaded.find(a => a.lote === 'ensayo' && a.legacyID === 'p14-noticia-02');
  await payload.update({ collection: 'articles', id: editada.id, user: editor, overrideAccess: false, data: { title: `${editada.title} (editada)` } });
  const lenaPhotoAsHeader = images.find(i => i.lote === 'ensayo' && i.id !== ensayoOnlyPhoto.id);
  const lenaSpace = (await all('municipal-spaces')).find(s => s.legacyID === 'lena');
  await payload.update({ collection: 'municipal-spaces', id: lenaSpace.id, user: admin, overrideAccess: false, data: { identity: { heroImage: lenaPhotoAsHeader.id } } });

  // --- Retirada: solo comprobar, sin copia previa, y de verdad.
  const beforeRetire = await counts(); const publicBefore = await publicObjects();
  const dry = await ensayo.retirar(payload, { soloComprobar: true, log: () => {} });
  assert.deepEqual(await counts(), beforeRetire, 'retire --solo-comprobar deletes nothing');
  assert.equal(dry.borrados.articles, articulos.length - 2); assert.equal(dry.borrados['municipal-content'], municipales.length);
  await assert.rejects(ensayo.retirar(payload, { soloComprobar: false, log: () => {} }), /copia de seguridad previa/);
  const backupDir = path.join(directory, 'copias');
  const dump = execFileSync('bash', ['infra/backup/backup-postgres.sh'], { env: { ...process.env, PG_CONTAINER: 'planta14-ensayo-test-postgres-1', POSTGRES_USER: 'planta14', POSTGRES_DB: 'planta14_ensayo_test', BACKUP_DIR: backupDir, BACKUP_ENCRYPTION: 'none' } }).toString().trim().split('\n').pop();
  assert.match(path.basename(dump), /^planta14-postgres-planta14_ensayo_test-.*\.dump$/);
  const result = await ensayo.retirar(payload, { soloComprobar: false, copiaPrevia: path.basename(dump), log: () => {} });
  assert.deepEqual(result.borrados, dry.borrados, 'what --solo-comprobar announced is what was deleted');
  passed(`retire: --solo-comprobar deletes nothing; refuses without a prior backup; with the backup made by backup-postgres.sh it deletes ${(await import('../cms/ensayo.ts')).resumen(result.borrados)}`);

  // Queda: lo definitivo, lo que no era del ensayo y las imágenes que siguen en uso.
  const remaining = await all('articles');
  assert.deepEqual(remaining.map(a => a.slug).sort(), ['bustiello-la-vida-alrededor-de-la-mina', loaded.find(a => a.legacyID === 'p14-reportaje-02').slug, 'noticia-real-con-foto-del-ensayo', 'noticia-real-previa'].sort());
  assert.ok(remaining.find(a => a.id === previa.id), 'previous real article untouched');
  assert.equal((await all('municipal-content')).length, 0);
  const remainingMedia = await all('media');
  for (const id of reportPhotos) assert.ok(remainingMedia.find(m => m.id === id), 'definitive photos kept');
  assert.ok(remainingMedia.find(m => m.id === ensayoOnlyPhoto.id), 'test photo reused by a real article kept');
  assert.ok(remainingMedia.find(m => m.id === lenaPhotoAsHeader.id), 'test photo used as a space header kept');
  assert.ok(remainingMedia.every(m => m.lote !== 'ensayo'), 'no test photo left: the rest deleted, the reused ones become normal images');
  assert.equal(remainingMedia.find(m => m.id === ensayoOnlyPhoto.id).lote ?? null, null);
  assert.equal(remainingMedia.length, 19 - 15 + 0, 'only definitive and reused photos remain');
  assert.ok(result.conservados.some(c => c.includes('Noticia real con una foto del ensayo')) && result.conservados.some(c => c.includes('Ayuntamiento de Lena')));
  assert.ok(await publicObjects() < publicBefore, 'public copies of deleted photos removed');
  for (const m of remainingMedia.filter(m => m.publishedUses > 0)) assert.ok(m.publicKey, 'kept photos still public');
  const authors = (await all('authors')).map(a => a.slug).sort();
  assert.deepEqual(authors, ['autora-previa', 'redaccion-planta-14'], 'test-only authors deleted, definitive and previous ones kept');
  const spacesAfter = await spaceState();
  assert.equal(spacesAfter.mieres, spacesBefore.mieres, 'Mieres restored'); assert.equal(spacesAfter.lena, spacesBefore.lena, 'Lena restored');
  assert.ok((await all('municipal-spaces')).every(s => !s.ensayoPrevio));
  const audit = await all('audit-log', { targetCollection: { equals: 'ensayo' } });
  assert.deepEqual(audit.map(a => a.action).sort(), ['create', 'delete']);
  const retireAudit = audit.find(a => a.action === 'delete');
  assert.ok(retireAudit.reason.includes(path.basename(dump)) && retireAudit.userEmail === admin.email, 'audit records who and the backup');
  assert.ok((await all('audit-log', { and: [{ action: { equals: 'delete' } }, { targetCollection: { equals: 'articles' } }] })).length >= articulos.length - 2, 'each deletion audited');
  const mieresAfter = await page(`${web}/mieres`);
  assert.ok(mieresAfter.includes('El concejo en Planta 14') && !mieresAfter.includes('Ensayo:'), 'Mieres back to inactive, no test content');
  assert.equal((await fetch(`${web}/noticia/${loaded.find(a => a.legacyID === 'p14-noticia-01').slug}`)).status, 404);
  assert.equal((await page(`${web}/noticia/bustiello-la-vida-alrededor-de-la-mina`)).includes('Bustiello'), true);
  passed('after retiring only the definitive reports, previous content and content created later remain; photos still in use kept, the rest and their public copies deleted; test-only authors deleted; spaces restored; audit with the backup name');

  // Retirar otra vez: nada.
  const twice = await ensayo.retirar(payload, { soloComprobar: false, copiaPrevia: path.basename(dump), log: () => {} });
  assert.deepEqual(twice.borrados, {}); assert.deepEqual(twice.espacios, []);
  passed('retiring again does nothing');
} finally {
  for (const child of children) child.kill('SIGTERM');
  await payload?.destroy();
  commons.close();
  await s3.close();
  await rm(directory, { recursive: true, force: true });
}
