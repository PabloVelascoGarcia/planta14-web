import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import pg from 'pg';
import S3rver from 's3rver';
import sharp from 'sharp';

// Participación: responsables por concejo, fiestas, suscriptores, última hora, Discover y fechas del CMS.
// Base PostgreSQL desechable de la prueba del ensayo (compose.ensayo-test.yaml, 55437; se vacía al empezar), S3rver
// y un buzón de correo de pruebas (PLANTA14_TEST_EMAIL_OUTBOX: los correos se escriben en un archivo).
const databaseURL = 'postgres://planta14:local-development-only@127.0.0.1:55437/planta14_ensayo_test';
if (process.env.CMS_PARTICIPACION_TEST !== 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL !== databaseURL)) throw new Error('Use CMS_PARTICIPACION_TEST=true and the dedicated local database on port 55437 (compose.ensayo-test.yaml)');
const s3Port = 59013, webPort = 3086, origin = `http://localhost:${webPort}`, web = `http://127.0.0.1:${webPort}`;
const directory = await mkdtemp(path.join(os.tmpdir(), 'planta14-participacion-'));
const outbox = path.join(directory, 'correo.jsonl');
await writeFile(outbox, '');
Object.assign(process.env, { NODE_ENV: 'production', CMS_ENABLED: 'true', CONTENT_SOURCE: 'payload', PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: databaseURL,
  CMS_SERVER_URL: origin, SITE_URL: origin, S3_BUCKET: 'planta14-participacion-private', S3_REGION: 'us-east-1', S3_ENDPOINT: `http://127.0.0.1:${s3Port}`, S3_FORCE_PATH_STYLE: 'true',
  S3_ACCESS_KEY_ID: 'S3RVER', S3_SECRET_ACCESS_KEY: 'S3RVER', PUBLIC_MEDIA_BASE_URL: `http://127.0.0.1:${s3Port}/planta14-participacion-public`, PUBLIC_MEDIA_BUCKET: 'planta14-participacion-public',
  PLANTA14_TEST_EMAIL_OUTBOX: outbox });
for (const key of ['SITE_INDEXABLE', 'SMTP_ENABLED']) delete process.env[key];
const reset = new pg.Client({ connectionString: databaseURL });
await reset.connect(); await reset.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); await reset.end();

const passed = name => console.log(`PASS: ${name}`);
const s3 = new S3rver({ address: '127.0.0.1', port: s3Port, directory, silent: true, configureBuckets: [{ name: 'planta14-participacion-private' }, { name: 'planta14-participacion-public' }] });
await s3.run();
const mails = async () => (await readFile(outbox, 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line));

let child, browser, payload, logs = '';
async function start(extraEnv = {}) {
  child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(webPort)], {
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`next exited: ${logs.slice(-1500)}`);
    try { if ((await fetch(`${web}/robots.txt`)).ok) return; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('next did not start');
}
async function stop() { if (child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise(r => child.once('exit', r)); } }
const page = async url => { const r = await fetch(url); assert.equal(r.status, 200, url); return (await r.text()).replaceAll('<!-- -->', ''); };

try {
  const { getPayload } = await import('payload');
  const { default: config } = await import('../payload.config.ts');
  const { loadStructure } = await import('../cms/structure.ts');
  payload = await getPayload({ config });
  await payload.db.migrate();
  await loadStructure(payload);
  const password = randomUUID();
  const users = {};
  users.admin = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { name: 'Administración', email: 'admin-participacion@planta14.example', password, role: 'admin' } });
  users.editor = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { name: 'Otra redactora', email: 'redaccion-participacion@planta14.example', password, role: 'editor' } });
  const all = async (collection, where, depth = 0) => (await payload.find({ collection, where, pagination: false, depth, overrideAccess: true, draft: true })).docs;
  const town = async slug => (await all('towns', { slug: { equals: slug } }, 1))[0];
  const space = async slug => (await all('municipal-spaces', { legacyID: { equals: slug } }))[0];
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
  const ctx = { payload, users, password, all, town, space, mails, web, origin, page, passed, assert, browser, start, stop, sharp, directory, logs: () => logs };

  // --- 1. Responsables por concejo.
  const { cargarResponsables } = await import('../cms/responsables.ts');
  const first = await cargarResponsables(payload);
  assert.ok(first.some(l => l.startsWith('Cuenta creada: Andrés <velascolne@gmail.com>')) && first.some(l => l.startsWith('Cuenta creada: Juanfran Santos <juansantospolalena@gmail.com>')), first.join('\n'));
  users.andres = (await all('users', { email: { equals: 'velascolne@gmail.com' } }))[0];
  users.juanfran = (await all('users', { email: { equals: 'juansantospolalena@gmail.com' } }))[0];
  assert.deepEqual([users.andres.role, users.juanfran.role], ['editor', 'editor']);
  const expected = { aller: users.andres.id, mieres: users.andres.id, morcin: users.andres.id, lena: users.juanfran.id, riosa: users.juanfran.id, 'ribera-de-arriba': users.juanfran.id };
  for (const [slug, id] of Object.entries(expected)) assert.equal((await town(slug)).responsible.id, id, `responsible of ${slug}`);
  // Repetible y sin pisar una elección hecha después.
  await payload.update({ collection: 'towns', id: (await town('riosa')).id, overrideAccess: true, data: { responsible: users.editor.id } });
  const second = await cargarResponsables(payload);
  assert.ok(second.some(l => l.includes('Riosa: ya tenía responsable')) && !second.some(l => l.startsWith('Cuenta creada')), second.join('\n'));
  assert.equal((await town('riosa')).responsible.id, users.editor.id, 'a later choice is kept');
  await payload.update({ collection: 'towns', id: (await town('riosa')).id, overrideAccess: true, data: { responsible: users.juanfran.id } });
  // Solo la administración lo cambia; no es público.
  await assert.rejects(payload.update({ collection: 'towns', id: (await town('lena')).id, user: users.editor, overrideAccess: false, data: { responsible: users.editor.id } }));
  await payload.update({ collection: 'towns', id: (await town('lena')).id, user: users.admin, overrideAccess: false, data: { responsible: users.juanfran.id } });
  const anonymous = await payload.find({ collection: 'towns', overrideAccess: false, depth: 0 });
  assert.ok(anonymous.docs.length === 6 && anonymous.docs.every(t => t.responsible === undefined), 'responsible not public');
  // Lo que llega de fuera: publicación de un ayuntamiento → pendiente asignado y correo al responsable.
  const lenaSpace = await space('lena'), mieresSpace = await space('mieres');
  for (const s of [lenaSpace, mieresSpace]) await payload.update({ collection: 'municipal-spaces', id: s.id, overrideAccess: true, data: { subscription: { status: 'active', startsAt: '2026-01-01', endsAt: null } } });
  users.lena = await payload.create({ collection: 'users', overrideAccess: true, user: users.admin, data: { name: 'Ayuntamiento de Lena', email: 'lena-participacion@planta14.example', password, role: 'municipal', municipalSpace: lenaSpace.id } });
  await payload.create({ collection: 'municipal-content', user: users.lena, overrideAccess: false, data: { space: lenaSpace.id, type: 'notice', title: 'Corte de agua en Campomanes', excerpt: 'Aviso de prueba.', body: 'Texto del aviso de prueba.', origin: 'municipality', publishedAt: '2026-11-04', _status: 'published' } });
  const notices = await all('notifications', undefined, 1);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].assignedTo.id, users.juanfran.id, 'assigned to the responsible of Lena');
  assert.equal(notices[0].emailStatus, 'sent');
  const mail = (await mails()).find(m => m.to === 'juansantospolalena@gmail.com');
  assert.ok(mail && mail.subject === 'Pendiente de revisar: Corte de agua en Campomanes' && mail.text.includes(`${origin}/cms/collections/notifications/${notices[0].id}`) && mail.text.includes('responsable de Lena'), 'email to the responsible');
  ctx.notices = notices;
  passed('responsables: npm run cms:responsables creates Andrés (Aller, Mieres, Morcín) and Juanfran Santos (Lena, Riosa, Ribera de Arriba) as newsroom accounts and assigns them; repeatable, never overrides a later choice; only the administration changes it and it is not public; a Lena publication becomes a pending item assigned to Juanfran with an email linking it');

  await start();
  const signIn = async email => {
    const response = await fetch(`${web}/api/cms/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ email, password }) });
    assert.equal(response.status, 200, `login ${email}`);
    return response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  };
  ctx.signIn = signIn;
  for (const u of [users.andres, users.juanfran]) await payload.update({ collection: 'users', id: u.id, overrideAccess: true, data: { password } });
  const dashboard = async email => (await (await fetch(`${web}/cms`, { headers: { Cookie: await signIn(email), 'Sec-Fetch-Site': 'same-origin' } })).text()).replaceAll('<!-- -->', '');
  const juanfranHome = await dashboard('juansantospolalena@gmail.com'), andresHome = await dashboard('velascolne@gmail.com');
  const pendingCount = html => Number(html.match(/data-dashboard-link="pendientes"[^>]*>(?:<span[^>]*>(\d+)<\/span>)/)?.[1]);
  assert.equal(pendingCount(juanfranHome), 1, 'Juanfran: 1 pending');
  assert.equal(pendingCount(andresHome), 0, 'Andrés: 0 pending');
  assert.ok(juanfranHome.includes(`assignedTo][equals]=${users.juanfran.id}`), 'link filtered to the user');
  passed('«Pendientes de revisar» in the CMS home: each journalist sees what was assigned to them (Juanfran 1, Andrés 0), linked to the filtered list');

  const blocks = ['participacion-contrasena.mjs', 'participacion-cartas.mjs', 'participacion-fiestas.mjs', 'participacion-boletin.mjs', 'participacion-portada.mjs'];
  // PARTICIPACION_BLOQUES=contrasena,cartas… para pasar solo algunos (pruebas rápidas); por defecto, todos.
  const only = (process.env.PARTICIPACION_BLOQUES || '').split(',').filter(Boolean);
  for (const file of blocks.filter(f => !only.length || only.some(o => f === `participacion-${o}.mjs`))) {
    const block = await import(`./${file}`).catch(error => (error.code === 'ERR_MODULE_NOT_FOUND' ? null : Promise.reject(error)));
    if (block) await block.run(ctx);
  }
  if (process.env.PARTICIPACION_EXPLORE) { console.log(`EXPLORE READY ${web}`); await new Promise(() => {}); }
} catch (error) {
  console.error(`--- registro del servidor (últimos 3000 caracteres) ---\n${logs.slice(-3000)}`);
  throw error;
} finally {
  await browser?.close();
  await stop();
  await payload?.destroy();
  await s3.close();
  await rm(directory, { recursive: true, force: true });
}
