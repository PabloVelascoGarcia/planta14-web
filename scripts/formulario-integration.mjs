import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import os from 'node:os';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import S3rver from 's3rver';
import sharp from 'sharp';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

// Formulario de noticia en un navegador real (Playwright): una persona de la redacción crea, previsualiza, programa
// y publica una noticia con foto sin escribir nada técnico. Base PostgreSQL desechable de la prueba de instalación
// (compose.instalacion-test.yaml, puerto 55436; se vacía al empezar). Datos sintéticos.
const databaseURL = 'postgres://planta14:local-development-only@127.0.0.1:55436/planta14_instalacion_test';
if (process.env.CMS_FORMULARIO_TEST !== 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL !== databaseURL)) throw new Error('Use CMS_FORMULARIO_TEST=true and the dedicated local database on port 55436');
const port = 3074, origin = `http://localhost:${port}`;
Object.assign(process.env, { NODE_ENV: 'production', CMS_ENABLED: 'true', CONTENT_SOURCE: 'payload', PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: databaseURL,
  CMS_SERVER_URL: origin, S3_BUCKET: 'planta14-formulario-private', S3_REGION: 'us-east-1', S3_ENDPOINT: 'http://127.0.0.1:59010', S3_FORCE_PATH_STYLE: 'true',
  S3_ACCESS_KEY_ID: 'S3RVER', S3_SECRET_ACCESS_KEY: 'S3RVER', PUBLIC_MEDIA_BASE_URL: 'http://127.0.0.1:59010/planta14-formulario-public', PUBLIC_MEDIA_BUCKET: 'planta14-formulario-public' });
for (const key of ['SITE_INDEXABLE', 'SITE_URL']) delete process.env[key];
const reset = new pg.Client({ connectionString: databaseURL });
await reset.connect();
await reset.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await reset.end();
const passed = name => console.log(`PASS: ${name}`);
let payload, child, browser;
const s3Directory = await mkdtemp(path.join(os.tmpdir(), 'planta14-formulario-'));
const s3 = new S3rver({ address: '127.0.0.1', port: 59010, directory: s3Directory, silent: true, configureBuckets: [{ name: 'planta14-formulario-private' }, { name: 'planta14-formulario-public' }] });
await s3.run();
let logs = '';
try {
  const { getPayload } = await import('payload');
  const { default: config } = await import('../payload.config.ts');
  const { loadStructure } = await import('../cms/structure.ts');
  payload = await getPayload({ config });
  await payload.db.migrate();
  await loadStructure(payload);
  const password = randomUUID();
  await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { name: 'Administración', email: 'admin-formulario@planta14.example', password, role: 'admin' } });
  const firma = await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'Lucía Prueba', slug: 'lucia-prueba' } });
  const editor = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { name: 'Lucía Prueba', email: 'lucia-formulario@planta14.example', password, role: 'editor' } });
  await payload.update({ collection: 'users', id: editor.id, overrideAccess: true, data: { author: firma.id } });
  // Foto sintética como la de un móvil (4000 × 3000).
  const photo = path.join(s3Directory, 'foto-del-pleno.jpg');
  await writeFile(photo, await sharp({ create: { width: 4000, height: 3000, channels: 3, background: { r: 90, g: 120, b: 150 } } }).jpeg({ quality: 80 }).toBuffer());

  child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    env: { ...process.env, SITE_URL: origin, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
  for (let i = 0; ; i++) {
    if (child.exitCode !== null) throw new Error(`next exited: ${logs.slice(-1500)}`);
    try { if ((await fetch(`http://127.0.0.1:${port}/robots.txt`)).ok) break; } catch { /* starting */ }
    if (i > 150) throw new Error('next did not start');
    await new Promise(r => setTimeout(r, 200));
  }

  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  const tab = await context.newPage();
  tab.setDefaultTimeout(20000);
  if (process.env.FORMULARIO_EXPLORE) {
    await writeFile(process.env.FORMULARIO_EXPLORE, JSON.stringify({ origin, email: editor.email, password, photo }));
    console.log('EXPLORE READY'); await new Promise(() => {});
  }
  const { run } = await import('./formulario-navegador.mjs');
  try { await run({ tab, origin, email: editor.email, password, photo, payload, firma, passed, assert }); }
  catch (error) { console.error(`--- registro del servidor (últimos 4000 caracteres) ---\n${logs.slice(-4000)}`); throw error; }
} finally {
  await browser?.close();
  child?.kill('SIGTERM');
  await payload?.destroy();
  await s3.close();
  await rm(s3Directory, { recursive: true, force: true });
}
