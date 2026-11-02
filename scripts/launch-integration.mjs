import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import S3rver from 's3rver';
import sharp from 'sharp';
import pg from 'pg';

// Lanzamiento: noindex/indexación, Open Graph y JSON-LD, sitemaps, /api/health y consentimiento de cookies.
// Base PostgreSQL desechable (compose.lanzamiento-test.yaml, 55435) y S3rver local (59006). Datos sintéticos.
// MANUAL_SCREENSHOTS=true genera además las capturas de docs/MANUAL-AYUNTAMIENTOS.md.
const databaseURL = 'postgres://planta14:local-development-only@127.0.0.1:55435/planta14_lanzamiento_test';
if (process.env.CMS_LAUNCH_TEST !== 'true' || (process.env.DATABASE_URL && process.env.DATABASE_URL !== databaseURL)) throw new Error('Use CMS_LAUNCH_TEST=true and the dedicated local database on port 55435');
const s3Port = 59006, ports = { plain: 3061, indexable: 3062, brokenDb: 3063, brokenS3: 3064 };
const publicBase = `http://127.0.0.1:${s3Port}/planta14-launch-public`;
const gaId = 'G-TEST1234';
Object.assign(process.env, { NODE_ENV: 'production', CMS_ENABLED: 'true', CONTENT_SOURCE: 'payload', PAYLOAD_SECRET: randomUUID() + randomUUID(), DATABASE_URL: databaseURL,
  CMS_SERVER_URL: `http://localhost:${ports.plain}`, S3_BUCKET: 'planta14-launch-private', S3_REGION: 'us-east-1', S3_ENDPOINT: `http://127.0.0.1:${s3Port}`, S3_FORCE_PATH_STYLE: 'true',
  S3_ACCESS_KEY_ID: 'S3RVER', S3_SECRET_ACCESS_KEY: 'S3RVER', PUBLIC_MEDIA_BASE_URL: publicBase, PUBLIC_MEDIA_BUCKET: 'planta14-launch-public', PUBLIC_MEDIA_PREFIX: 'public' });
for (const key of ['SITE_INDEXABLE', 'GA4_MEASUREMENT_ID', 'SITE_URL', 'URL', 'DEPLOY_PRIME_URL']) delete process.env[key];
const reset = new pg.Client({ connectionString: databaseURL });
await reset.connect();
await reset.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
await reset.end();
const directory = await mkdtemp(path.join(os.tmpdir(), 'planta14-launch-'));
const s3 = new S3rver({ address: '127.0.0.1', port: s3Port, directory, silent: true, configureBuckets: [{ name: 'planta14-launch-private' }, { name: 'planta14-launch-public' }] });
const children = [];
let payload;
const passed = name => console.log(`PASS: ${name}`);
const meta = (html, attr, name) => html.match(new RegExp(`<meta[^>]*${attr}="${name.replace(/[:]/g, '\\:')}"[^>]*content="([^"]*)"`))?.[1]
  ?? html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attr}="${name}"`))?.[1];
const decode = value => value?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function start(name, env) {
  const port = ports[name];
  const child = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    windowsHide: true, env: { ...process.env, CMS_SERVER_URL: `http://localhost:${port}`, SITE_URL: `http://localhost:${port}`, NEXT_TELEMETRY_DISABLED: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  let logs = ''; child.stdout.on('data', b => { logs += b; }); child.stderr.on('data', b => { logs += b; });
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(`${name} exited: ${logs.slice(-1500)}`);
    try { if ((await fetch(`http://127.0.0.1:${port}/robots.txt`)).ok) return { url: `http://localhost:${port}`, logs: () => logs }; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`${name} did not start`);
}

try {
  await s3.run();
  const { getPayload } = await import('payload');
  const { default: config } = await import('../payload.config.ts');
  const { importMunicipalDemo } = await import('../cms/import-municipal.ts');
  payload = await getPayload({ config });
  await payload.db.migrate();
  await importMunicipalDemo(payload);
  const town = (await payload.find({ collection: 'towns', overrideAccess: true, where: { slug: { equals: 'lena' } } })).docs[0];
  const section = (await payload.find({ collection: 'sections', overrideAccess: true, limit: 1 })).docs[0];
  const lenaSpace = (await payload.find({ collection: 'municipal-spaces', overrideAccess: true, where: { legacyID: { equals: 'lena' } } })).docs[0];
  const author = await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'Redacción de prueba', slug: 'redaccion-prueba' } });
  const png = await sharp({ create: { width: 2000, height: 1125, channels: 3, background: '#24704a' } }).png().toBuffer();
  const image = await payload.create({ collection: 'media', overrideAccess: true, file: { data: png, mimetype: 'image/png', name: 'portada-prueba.png', size: png.length },
    data: { alt: 'Imagen sintética de la noticia', credit: 'Planta 14 (prueba)', rightsHolder: 'Planta 14', rightsType: 'propia', rightsScope: 'publicable' } });
  const now = new Date().toISOString();
  const base = { excerpt: 'Entradilla original "con comillas" y <signos> para comprobar el escapado.', body: ['Texto original de la prueba de lanzamiento.'],
    author: author.id, town: town.id, section: section.id, date: now.slice(0, 10), publishedAt: now };
  await payload.create({ collection: 'articles', overrideAccess: true, data: { ...base, slug: 'noticia-publicada-lanzamiento', title: 'Noticia publicada para el lanzamiento', image: image.id, _status: 'published' } });
  await payload.create({ collection: 'articles', overrideAccess: true, draft: true, data: { ...base, slug: 'borrador-oculto-lanzamiento', title: 'Borrador que no debe aparecer', _status: 'draft' } });
  const unpublished = await payload.create({ collection: 'articles', overrideAccess: true, data: { ...base, slug: 'noticia-despublicada', title: 'Noticia despublicada', _status: 'published' } });
  await payload.update({ collection: 'articles', overrideAccess: true, id: unpublished.id, data: { _status: 'draft' } });
  const lenaImage = await payload.create({ collection: 'media', overrideAccess: true, file: { data: png, mimetype: 'image/png', name: 'aviso-lena.png', size: png.length },
    data: { alt: 'Imagen del aviso de Lena', credit: 'Ayuntamiento de Lena (prueba)', rightsHolder: 'Ayuntamiento de Lena', rightsType: 'institucional', rightsScope: 'publicable', uploadedBySpace: lenaSpace.id } });
  await payload.create({ collection: 'municipal-content', overrideAccess: true, data: { space: lenaSpace.id, type: 'notice', title: 'Aviso municipal con imagen', excerpt: 'Aviso sintético.', body: 'Texto.', origin: 'municipality', publishedAt: now.slice(0, 10), expiresAt: '2099-12-31', image: lenaImage.id, demo: false, _status: 'published' } });
  const removed = await payload.create({ collection: 'municipal-content', overrideAccess: true, data: { space: lenaSpace.id, type: 'notice', title: 'Aviso retirado que no debe aparecer', excerpt: 'Privado tras retirada.', body: 'Texto retirado.', publishedAt: now.slice(0, 10), _status: 'published' } });
  await payload.update({ collection: 'municipal-content', overrideAccess: true, id: removed.id, data: { withdrawal: { withdrawn: true, reason: 'Ensayo de metadatos' } } });
  const hiddenSpace = (await payload.find({ collection: 'municipal-spaces', overrideAccess: true, where: { legacyID: { equals: 'mieres' } } })).docs[0];
  await payload.update({ collection: 'municipal-spaces', overrideAccess: true, id: hiddenSpace.id, data: { _status: 'draft' } });
  const hero = (await payload.findByID({ collection: 'media', id: image.id, overrideAccess: true })).sizes.hero;
  const storedImage = await payload.findByID({ collection: 'media', id: image.id, overrideAccess: true });
  const heroURL = `${publicBase}/${storedImage.publicKey}/${hero.filename}`;
  assert.equal((await fetch(heroURL)).status, 200, 'public hero variant exists');

  const plain = await start('plain', { GA4_MEASUREMENT_ID: gaId });
  const indexable = await start('indexable', { SITE_INDEXABLE: 'true' });

  // --- 1. Without SITE_INDEXABLE=true, every response carries noindex.
  const html = async (url) => (await fetch(url)).text();
  const nextAsset = (await html(`${plain.url}/`)).match(/\/_next\/static\/[^"']+\.js/)?.[0];
  const routes = ['/', '/noticia/noticia-publicada-lanzamiento', '/lena', '/aviso-legal', '/privacidad', '/cookies', '/condiciones-cuentas-municipales',
    '/robots.txt', '/sitemap.xml', '/sitemap-noticias.xml', '/api/health', '/icon.png', '/opengraph-image.png', '/no-existe', nextAsset];
  for (const route of routes) {
    const response = await fetch(`${plain.url}${route}`);
    assert.match(response.headers.get('x-robots-tag') || '', /noindex/, `X-Robots-Tag on ${route}`);
  }
  for (const route of ['/', '/noticia/noticia-publicada-lanzamiento', '/lena', '/aviso-legal']) assert.match(await html(`${plain.url}${route}`), /<meta name="robots" content="noindex, nofollow"/, `meta robots on ${route}`);
  assert.match(await html(`${plain.url}/robots.txt`), /Disallow: \//);
  assert.doesNotMatch(await html(`${plain.url}/sitemap.xml`), /<loc>/);
  assert.doesNotMatch(await html(`${plain.url}/sitemap-noticias.xml`), /<loc>/);
  passed(`without SITE_INDEXABLE=true all ${routes.length} responses (pages, legal, API, sitemaps, robots, images, static JS, 404) are noindex; empty sitemaps; robots Disallow /`);

  // --- 2. Indexable: public pages indexable, private areas still noindex, robots/sitemaps.
  assert.equal((await fetch(`${indexable.url}/noticia/noticia-publicada-lanzamiento`)).headers.get('x-robots-tag'), null);
  assert.doesNotMatch(await html(`${indexable.url}/noticia/noticia-publicada-lanzamiento`), /noindex/);
  for (const route of ['/cms/login', '/api/health', '/lena/panel']) assert.match((await fetch(`${indexable.url}${route}`)).headers.get('x-robots-tag') || '', /noindex/, route);
  const robots = await html(`${indexable.url}/robots.txt`);
  assert.match(robots, /Allow: \//); assert.match(robots, /Disallow: \/cms/); assert.match(robots, /Sitemap: http:\/\/localhost:3062\/sitemap-noticias\.xml/);
  const invalidDate = await payload.create({ collection: 'articles', overrideAccess: true, data: { ...base, date: 'fecha-no-valida', slug: 'fecha-invalida', title: 'Fecha antigua mal importada', _status: 'published' } });
  const sitemap = await html(`${indexable.url}/sitemap.xml`);
  assert.match(sitemap, /<loc>http:\/\/localhost:3062\/noticia\/noticia-publicada-lanzamiento<\/loc>/);
  assert.doesNotMatch(sitemap, /borrador-oculto-lanzamiento/, 'drafts never listed');
  assert.doesNotMatch(sitemap, /noticia-despublicada|Invalid Date|NaN/);
  assert.match(sitemap, /<loc>http:\/\/localhost:3062\/lena<\/loc>/, 'published municipal spaces included');
  assert.doesNotMatch(sitemap, /<loc>http:\/\/localhost:3062\/mieres<\/loc>/, 'draft municipal spaces excluded');
  const news = await html(`${indexable.url}/sitemap-noticias.xml`);
  assert.match(news, /<news:title>Noticia publicada para el lanzamiento<\/news:title>/);
  assert.match(news, /<news:name>Planta 14<\/news:name>/);
  assert.doesNotMatch(news, /borrador-oculto/);
  assert.doesNotMatch(news, /noticia-despublicada|Aviso retirado/);
  assert.equal((await fetch(`${indexable.url}/sitemap-noticias.xml`)).headers.get('cache-control'), 'no-store');
  await payload.delete({ collection: 'articles', id: invalidDate.id, overrideAccess: true });
  passed('SITE_INDEXABLE=true: public pages indexable, private areas noindex; sitemap.xml and news sitemap list only published content');

  // --- 3. Open Graph, Twitter and JSON-LD of a published article.
  const page = await html(`${indexable.url}/noticia/noticia-publicada-lanzamiento`);
  assert.equal(decode(meta(page, 'property', 'og:title')), 'Noticia publicada para el lanzamiento');
  assert.equal(decode(meta(page, 'property', 'og:description')), base.excerpt);
  assert.equal(decode(meta(page, 'property', 'og:image')), heroURL, 'og:image is the absolute public hero variant');
  assert.equal(meta(page, 'property', 'og:image:width'), String(hero.width));
  assert.equal(meta(page, 'property', 'og:type'), 'article');
  assert.equal(decode(meta(page, 'property', 'og:url')), 'http://localhost:3062/noticia/noticia-publicada-lanzamiento');
  assert.equal(meta(page, 'name', 'twitter:card'), 'summary_large_image');
  assert.equal(decode(meta(page, 'name', 'twitter:image')), heroURL);
  assert.match(page, /<link rel="canonical" href="http:\/\/localhost:3062\/noticia\/noticia-publicada-lanzamiento"/);
  const ldRaw = page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert(ldRaw, 'JSON-LD present');
  assert(!ldRaw.includes('<signos>'), 'JSON-LD escapes "<" inside HTML');
  const ld = JSON.parse(ldRaw);
  assert.equal(ld['@context'], 'https://schema.org'); assert.equal(ld['@type'], 'NewsArticle');
  assert.equal(ld.headline, 'Noticia publicada para el lanzamiento');
  assert.deepEqual(ld.image, [heroURL]);
  assert(!Number.isNaN(Date.parse(ld.datePublished)));
  assert.equal(ld.author[0]['@type'], 'Person'); assert.equal(ld.author[0].name, 'Redacción de prueba');
  assert.equal(ld.publisher['@type'], 'NewsMediaOrganization'); assert.equal(ld.publisher.name, 'Planta 14');
  assert.equal(ld.publisher.legalName, 'Agencia Social de Servicios Asturiana S.L. (ASSA)');
  assert.equal(ld.mainEntityOfPage['@id'], 'http://localhost:3062/noticia/noticia-publicada-lanzamiento');
  const lena = await html(`${indexable.url}/lena`);
  assert.equal(decode(meta(lena, 'property', 'og:title')), 'Ayuntamiento de Lena · Espacio municipal');
  assert.match(decode(meta(lena, 'property', 'og:image')), new RegExp(`^${publicBase}/public/[0-9a-f-]{36}/`), 'municipal page shares its latest public image');
  assert.match(lena, /<link rel="canonical" href="http:\/\/localhost:3062\/lena"/);
  assert.doesNotMatch(lena, /Aviso retirado que no debe aparecer|Privado tras retirada/);
  assert.equal((await fetch(`${indexable.url}/noticia/noticia-despublicada`)).status, 404);
  assert.equal((await fetch(`${indexable.url}/noticia/borrador-oculto-lanzamiento`)).status, 404);
  passed('published article exposes og:title/description/image (absolute hero variant with size), twitter card, canonical and valid NewsArticle JSON-LD; municipal page shares its image');

  // --- 4. /api/health: 200 when everything answers, 503 without internal details when DB or storage fail.
  const health = await fetch(`${plain.url}/api/health`);
  assert.equal(health.status, 200); assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await health.json(), { status: 'ok', checks: { database: 'ok', storage: 'ok' } });
  const brokenDb = await start('brokenDb', { DATABASE_URL: 'postgres://planta14:local-development-only@127.0.0.1:59999/planta14_lanzamiento_test' });
  const dbDown = await fetch(`${brokenDb.url}/api/health`);
  const dbText = await dbDown.text();
  assert.equal(dbDown.status, 503);
  assert.deepEqual(JSON.parse(dbText), { status: 'error', checks: { database: 'error', storage: 'ok' } });
  assert.doesNotMatch(dbText, /59999|127\.0\.0\.1|ECONNREFUSED|postgres|planta14_lanzamiento|password|stack/i, 'no internal details');
  const brokenS3 = await start('brokenS3', { S3_ENDPOINT: 'http://127.0.0.1:59998' });
  const s3Down = await fetch(`${brokenS3.url}/api/health`);
  assert.equal(s3Down.status, 503);
  assert.deepEqual(await s3Down.json(), { status: 'error', checks: { database: 'ok', storage: 'error' } });
  passed('/api/health: 200 with database and storage up; 503 when the database or the storage fail, with no internal details');

  // --- 5. Cookie consent in a real browser (Chromium/Playwright). GA4 is stubbed: no request leaves the machine.
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-proxy-server'] });
  try {
    const context = await browser.newContext();
    const gaRequests = [];
    await context.route(/googletagmanager\.com|google-analytics\.com/, async route => {
      gaRequests.push(route.request().url());
      // Stub of gtag.js: behaves like GA4 by writing its first-party cookies.
      await route.fulfill({ contentType: 'text/javascript', body: `document.cookie="_ga=GA1.1.111.222; path=/; max-age=63072000"; document.cookie="_ga_TEST1234=GS1.1.333; path=/; max-age=63072000"; window.__launchGaLoaded=true;` });
    });
    const errors = []; context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
    const tab = await context.newPage();
    await tab.goto(`${plain.url}/noticia/noticia-publicada-lanzamiento`);
    const banner = tab.getByRole('dialog', { name: 'Cookies de medición' });
    await banner.waitFor();
    await tab.waitForTimeout(500);
    assert.equal(gaRequests.length, 0, 'GA4 not requested before consent');
    assert.equal(await tab.locator('script[src*="googletagmanager"], link[href*="googletagmanager"], link[href*="google-analytics"]').count(), 0, 'no script, preload or preconnect before consent');
    assert.deepEqual((await context.cookies()).map(c => c.name), [], 'no cookies at all before a decision');
    const [reject, accept] = [banner.getByRole('button', { name: 'Rechazar' }), banner.getByRole('button', { name: 'Aceptar' })];
    const [rb, ab] = [await reject.boundingBox(), await accept.boundingBox()];
    assert.equal(Math.round(rb.height), Math.round(ab.height)); assert(Math.abs(rb.width - ab.width) < 2, 'reject as prominent as accept');
    assert.equal(await reject.evaluate(e => getComputedStyle(e).backgroundColor), await accept.evaluate(e => getComputedStyle(e).backgroundColor));
    if (process.env.MANUAL_SCREENSHOTS === 'true') await tab.screenshot({ path: 'docs/img/lanzamiento-banner-cookies.png' });
    await reject.click();
    await tab.reload(); await tab.waitForTimeout(500);
    assert.equal(await banner.count(), 0, 'decision remembered');
    assert.equal(gaRequests.length, 0, 'GA4 never loaded after rejecting');
    assert.deepEqual((await context.cookies()).map(c => `${c.name}=${decodeURIComponent(c.value)}`), ['planta14_consent=1:rejected']);
    await tab.getByRole('button', { name: 'Configurar cookies' }).click();
    await banner.getByRole('button', { name: 'Aceptar' }).click();
    await tab.waitForFunction(() => document.cookie.includes('_ga='));
    assert(gaRequests.some(u => u.includes(`id=${gaId}`)), 'GA4 loaded after accepting');
    assert(errors.length === 0, errors.join('\n'));
    await tab.reload(); await tab.waitForTimeout(500);
    assert(gaRequests.length >= 2, 'accepted consent is remembered and GA4 loads on the next page');
    const mirror = await context.newPage();
    await mirror.goto(`${plain.url}/lena`);
    await mirror.waitForFunction(() => window.__launchGaLoaded === true);
    // Withdraw consent from the footer: GA cookies removed and GA4 no longer loaded.
    await tab.getByRole('button', { name: 'Configurar cookies' }).click();
    const before = gaRequests.length;
    await Promise.all([tab.waitForEvent('load'), mirror.waitForEvent('load'), banner.getByRole('button', { name: 'Rechazar' }).click()]);
    await tab.waitForTimeout(500);
    assert.deepEqual((await context.cookies()).map(c => c.name).filter(n => n.startsWith('_ga')), [], 'analytics cookies removed on withdrawal');
    assert.equal(gaRequests.length, before, 'GA4 not loaded after withdrawing consent');
    assert.equal(await tab.locator('#planta14-ga4').count(), 0);
    assert.equal(await mirror.locator('#planta14-ga4').count(), 0, 'withdrawal propagated to another open tab without persistent storage');
    await mirror.close();
    // An already visited page (and a warm script) must re-check consent when reached via Back.
    await tab.getByRole('button', { name: 'Configurar cookies' }).click();
    await banner.getByRole('button', { name: 'Aceptar' }).click();
    await tab.waitForFunction(() => document.cookie.includes('_ga='));
    await tab.goto('about:blank');
    await context.addCookies([{ name: 'planta14_consent', value: '1%3Arejected', url: plain.url }]);
    const beforeBack = gaRequests.length;
    await tab.goBack(); await tab.waitForTimeout(700);
    assert.equal(gaRequests.length, beforeBack, 'Back/Forward cannot load GA after consent was withdrawn in another tab');
    assert.equal(await tab.locator('#planta14-ga4').count(), 0);
    assert.deepEqual((await context.cookies()).filter(c => c.name.startsWith('_ga')), []);
    // Malformed cookies fail closed and show a working choice instead of throwing URIError.
    await context.addCookies([{ name: 'planta14_consent', value: '%E0%A4%A', url: plain.url }]);
    await tab.reload(); await banner.waitFor();
    assert.equal(gaRequests.length, beforeBack);
    // A site without GA4 configured shows no banner and sets no cookies.
    const other = await browser.newContext();
    const otherTab = await other.newPage();
    await otherTab.goto(`${indexable.url}/`);
    await otherTab.waitForTimeout(500);
    assert.equal(await otherTab.getByRole('dialog').count(), 0);
    assert.deepEqual(await other.cookies(), []);
    passed('cookies: no GA4 and no cookies before consent; reject as easy as accept; accept loads GA4; choice changed from the footer removes GA cookies');
    const { testCachedConsent } = await import('./launch-cached-consent.mjs');
    await testCachedConsent(browser, plain.url, gaId);

    if (process.env.MANUAL_SCREENSHOTS === 'true') {
      const { captureManual } = await import('./manual-screenshots.mjs');
      await captureManual({ browser, payload, url: plain.url, lenaSpace });
    }
  } finally { await browser.close(); }
} finally {
  for (const child of children) { if (child.exitCode === null) { const done = once(child, 'exit'); child.kill(); await done; } }
  if (payload) await payload.destroy();
  await s3.close();
  if (path.dirname(path.resolve(directory)) !== path.resolve(os.tmpdir())) throw new Error('Unexpected test cleanup directory');
  await rm(directory, { recursive: true, force: true });
}
