import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import pg from 'pg';
import S3rver from 's3rver';
import sharp from 'sharp';

// Revisión de la portada, la noticia y la página del concejo con el contenido del ensayo cargado (cms/ensayo.ts).
// Base PostgreSQL desechable de la prueba del ensayo (compose.ensayo-test.yaml, 55437; se vacía al empezar), S3rver
// y un sustituto de Commons con fotos sintéticas «de textura» (ruido suavizado: pesan como fotos reales en JPEG).
// Con PORTADA_SOLO_MEDIR=1 solo mide el peso de la portada en móvil (para comparar antes y después).
const databaseURL = 'postgres://planta14:local-development-only@127.0.0.1:55437/planta14_ensayo_test';
if (process.env.CMS_PORTADA_TEST !== 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL !== databaseURL)) throw new Error('Use CMS_PORTADA_TEST=true and the dedicated local database on port 55437 (compose.ensayo-test.yaml)');
const s3Port = 59011, commonsPort = 59012, webPort = 3082;
const publicBucket = 'planta14-portada-public';
Object.assign(process.env, { NODE_ENV: 'production', CMS_ENABLED: 'true', CONTENT_SOURCE: 'payload', PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: databaseURL,
  CMS_SERVER_URL: `http://localhost:${webPort}`, S3_BUCKET: 'planta14-portada-private', S3_REGION: 'us-east-1', S3_ENDPOINT: `http://127.0.0.1:${s3Port}`, S3_FORCE_PATH_STYLE: 'true',
  S3_ACCESS_KEY_ID: 'S3RVER', S3_SECRET_ACCESS_KEY: 'S3RVER', PUBLIC_MEDIA_BASE_URL: `http://127.0.0.1:${s3Port}/${publicBucket}`, PUBLIC_MEDIA_BUCKET: publicBucket,
  ENSAYO_FOTOS_BASE: `http://127.0.0.1:${commonsPort}` });
for (const key of ['SITE_INDEXABLE', 'SITE_URL']) delete process.env[key];
const reset = new pg.Client({ connectionString: databaseURL });
await reset.connect(); await reset.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); await reset.end();

const passed = name => console.log(`PASS: ${name}`);
const directory = await mkdtemp(path.join(os.tmpdir(), 'planta14-portada-'));
const s3 = new S3rver({ address: '127.0.0.1', port: s3Port, directory, silent: true, configureBuckets: [{ name: 'planta14-portada-private' }, { name: publicBucket }] });
await s3.run();

// Sustituto de Commons: la resolución anotada de cada original, con textura (ruido gaussiano suavizado).
const fotos = JSON.parse(await readFile('contenido-ensayo/fotos.json', 'utf8'));
const byPath = new Map(fotos.catalogo.map(f => [new URL(f.archivoOriginal).pathname, f]));
const commons = http.createServer(async (req, res) => {
  const foto = byPath.get(req.url);
  if (!foto) { res.writeHead(404); res.end(); return; }
  const hue = [...foto.id].reduce((a, c) => a + c.charCodeAt(0), 0) % 120;
  const body = await sharp({ create: { width: foto.resolucion.ancho, height: foto.resolucion.alto, channels: 3, background: { r: 60 + hue, g: 110, b: 90 }, noise: { type: 'gaussian', mean: 120, sigma: 30 } } })
    .blur(1).jpeg({ quality: 88 }).toBuffer();
  res.writeHead(200, { 'content-type': 'image/jpeg' }); res.end(body);
});
await new Promise(r => commons.listen(commonsPort, '127.0.0.1', r));

let child, browser, payload;
let logs = '';
async function start() {
  child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(webPort)], {
    env: { ...process.env, SITE_URL: `http://localhost:${webPort}`, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`next exited: ${logs.slice(-1500)}`);
    try { if ((await fetch(`http://127.0.0.1:${webPort}/robots.txt`)).ok) return `http://127.0.0.1:${webPort}`; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('next did not start');
}
const kib = n => Math.round(n / 1024);

/** Peso de una página en un móvil (iPhone 13, 390 px, DPR 3): imágenes al abrir y tras recorrerla entera. */
async function pesoMovil(url) {
  const { devices } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const tab = await context.newPage();
  const responses = [];
  tab.on('response', async response => {
    try { responses.push({ url: response.url(), type: response.request().resourceType(), bytes: (await response.body()).length }); } catch { /* redirección o cancelada */ }
  });
  await tab.goto(url, { waitUntil: 'networkidle' });
  const sum = (list, type) => list.filter(r => !type || r.type === type).reduce((a, r) => a + r.bytes, 0);
  const firstImages = sum(responses, 'image');
  await tab.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
  await tab.waitForLoadState('networkidle');
  await tab.waitForTimeout(500);
  const result = { firstImages, images: sum(responses, 'image'), total: sum(responses), imageCount: responses.filter(r => r.type === 'image').length,
    biggest: responses.filter(r => r.type === 'image').sort((a, b) => b.bytes - a.bytes).slice(0, 3).map(r => `${path.basename(new URL(r.url).pathname)} ${kib(r.bytes)} KiB`) };
  await context.close();
  return result;
}

try {
  const { getPayload } = await import('payload');
  const { default: config } = await import('../payload.config.ts');
  const { loadStructure } = await import('../cms/structure.ts');
  const ensayo = await import('../cms/ensayo.ts');
  payload = await getPayload({ config });
  await payload.db.migrate();
  await loadStructure(payload);
  await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { name: 'Administración', email: 'admin-portada@planta14.example', password: randomUUID(), role: 'admin' } });
  await ensayo.cargar(payload, { dir: 'contenido-ensayo', soloComprobar: false, log: () => {} });
  const web = await start();
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
  browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });

  const peso = await pesoMovil(`${web}/`);
  console.log(`MEDIDA: portada en móvil (iPhone 13): imágenes al abrir ${kib(peso.firstImages)} KiB; recorrida entera ${kib(peso.images)} KiB en ${peso.imageCount} imágenes; todo ${kib(peso.total)} KiB sin comprimir. Mayores: ${peso.biggest.join(', ')}`);
  if (process.env.PORTADA_EXPLORE) { console.log(`EXPLORE READY ${web}`); setInterval(() => { console.log(logs); logs = ''; }, 2000); await new Promise(() => {}); }
  if (process.env.PORTADA_SOLO_MEDIR !== '1') {
    const { run } = await import('./portada-checks.mjs');
    await run({ web, payload, browser, assert, passed, pesoMovil, kib });
  }
} finally {
  await browser?.close();
  child?.kill('SIGTERM');
  await payload?.destroy();
  await s3.close();
  commons.close();
  await rm(directory, { recursive: true, force: true });
}
