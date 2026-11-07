// Prueba en navegador real (Chromium de Playwright) contra el staging levantado por staging-e2e.sh,
// a través de Caddy (HTTPS con CA interna y contraseña de staging). Datos sintéticos; nada real.
// Entrada por variables: E2E_DOMAIN, E2E_PORT, E2E_BASIC_USER, E2E_BASIC_PASSWORD, E2E_ADMIN_EMAIL,
// E2E_ADMIN_PASSWORD, E2E_OUT (directorio de capturas y estado).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { withdrawThroughCMS } from '../../scripts/cms-browser-withdrawal.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const env = name => { const v = process.env[name]; if (!v) throw new Error(`Falta ${name}`); return v; };
const domain = env('E2E_DOMAIN'), port = env('E2E_PORT'), out = env('E2E_OUT');
const origin = `https://${domain}${port === '443' ? '' : `:${port}`}`;
const basic = { username: env('E2E_BASIC_USER'), password: env('E2E_BASIC_PASSWORD') };
const pass = msg => console.log(`PASS: ${msg}`);
const password = randomUUID() + randomUUID();
const accounts = { editor: 'editor@staging.example.test', lena: 'lena@staging.example.test', mieres: 'mieres@staging.example.test' };

// Small valid PNG (crc32 by hand to avoid extra dependencies).
function png(width, height, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: width }, () => Buffer.from(rgb)))]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: ['--no-proxy-server'] });
const errors = [];
const newContext = async (credentials = basic) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, httpCredentials: credentials || undefined, viewport: { width: 390, height: 900 } });
  context.on('page', page => page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`)));
  return context;
};
const api = async (context, method, route, data) => {
  const response = await context.request.fetch(`${origin}/api/cms/${route}`, { method, data, headers: { Origin: origin } });
  return { status: response.status(), json: await response.json().catch(() => null) };
};
// La cuenta municipal usa la sesión del panel (cookie planta14_panel): sus llamadas van por el puente /api/panel/api.
const panelApi = async (context, method, route, data) => {
  const response = await context.request.fetch(`${origin}/api/panel/api/${route}`, { method, data, headers: { Origin: origin } });
  return { status: response.status(), json: await response.json().catch(() => null) };
};
try {
  // 1. Staging password (Caddy) on the site, the CMS, the API and /media.
  const anonymous = await newContext(null);
  for (const route of ['/', '/lena', '/cms', '/api/cms/users/me', '/media/public/x.png']) {
    const response = await anonymous.request.get(`${origin}${route}`, { maxRedirects: 0 });
    assert.equal(response.status(), 401, route);
    assert.match(response.headers()['www-authenticate'] || '', /Basic/);
  }
  const wrong = await newContext({ username: basic.username, password: 'incorrecta' });
  assert.equal((await wrong.request.get(`${origin}/`)).status(), 401);
  pass('staging password required for the site, /cms, the API and /media (wrong password rejected)');

  // 2. Public web in payload mode.
  const visitor = await newContext();
  const home = await visitor.newPage();
  assert.equal((await home.goto(`${origin}/`)).status(), 200);
  assert.match((await home.goto(`${origin}/lena`)).headers()['x-robots-tag'] || '', /noindex/);
  assert((await home.locator('body').innerText()).includes('Ayuntamiento de Lena'));
  assert.equal((await home.goto(`${origin}/niebla/adrian-barbon`)).status(), 404, 'demo magazine route is 404 in payload mode');
  await home.screenshot({ path: path.join(out, '01-lena-publica.png'), fullPage: false });
  pass('public web served through Caddy in payload mode (Lena space from Payload; demo-only route 404)');

  // 3. Accounts created by the administrator through the API (cookie session, CSRF origin).
  const adminCtx = await newContext();
  assert.equal((await api(adminCtx, 'POST', 'users/login', { email: env('E2E_ADMIN_EMAIL'), password: env('E2E_ADMIN_PASSWORD') })).status, 200);
  const spaces = (await api(adminCtx, 'GET', 'municipal-spaces?limit=50&depth=0')).json.docs;
  const space = id => spaces.find(s => s.legacyID === id).id;
  for (const [key, data] of Object.entries({ editor: { role: 'editor', name: 'Editora de staging' },
    lena: { role: 'municipal', name: 'Ayuntamiento de Lena', municipalSpace: space('lena') }, mieres: { role: 'municipal', name: 'Ayuntamiento de Mieres', municipalSpace: space('mieres') } })) {
    const r = await api(adminCtx, 'POST', 'users', { email: accounts[key], password, ...data });
    assert.equal(r.status, 201, `create ${key}: ${JSON.stringify(r.json)}`);
  }

  // 4. Editor logs in through the Payload admin form.
  const editorCtx = await newContext();
  const editor = await editorCtx.newPage();
  await editor.goto(`${origin}/cms/login`);
  await editor.locator('input[name="email"]').fill(accounts.editor);
  await editor.locator('input[name="password"]').fill(password);
  await editor.locator('button[type="submit"]').click();
  await editor.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30_000 });
  await editor.getByText(/municipal/i).first().waitFor({ timeout: 30_000 });
  await editor.screenshot({ path: path.join(out, '02-cms-editor.png') });
  pass('editor signs in through the /cms login form');

  // 4 bis. Sesión del panel compartida entre pestañas (fallo visto en pruebas): navegador limpio; a) entrar en la pestaña A
  // y recargar; b) abrir ?pestana=util en la pestaña B; c) volver a A y recargar. Las dos deben seguir dentro.
  {
    const sessionCtx = await newContext();
    const inside = async page => { await page.locator('[data-panel-tabs], input[autocomplete="current-password"]').first().waitFor(); return page.locator('[data-panel-tabs]').count(); };
    const a = await sessionCtx.newPage();
    await a.goto(`${origin}/lena/panel`, { waitUntil: 'load' });
    await a.getByLabel('Correo electrónico', { exact: true }).fill(accounts.lena);
    await a.getByLabel('Contraseña', { exact: true }).fill(password);
    await a.getByRole('button', { name: /^Entrar/ }).click();
    await a.locator('[data-panel-tabs]').waitFor();
    await a.reload({ waitUntil: 'load' });
    assert.equal(await inside(a), 1, 'a) F5 keeps the panel session');
    const b = await sessionCtx.newPage();
    await b.goto(`${origin}/lena/panel?pestana=util`, { waitUntil: 'load' });
    const cookies = (await sessionCtx.cookies()).map(c => `${c.name} path=${c.path} secure=${c.secure} httpOnly=${c.httpOnly} sameSite=${c.sameSite} expires=${c.expires > 0 ? new Date(c.expires * 1000).toISOString() : 'sesión'}`);
    assert.equal(await inside(b), 1, `b) tab B (?pestana=util) is signed in. Cookies: ${cookies.join(' | ')}`);
    await a.bringToFront();
    await a.reload({ waitUntil: 'load' });
    assert.equal(await inside(a), 1, `c) tab A is still signed in. Cookies: ${(await sessionCtx.cookies()).map(c => c.name).join(', ')}`);
    await b.reload({ waitUntil: 'load' });
    assert.equal(await inside(b), 1, 'c) tab B is still signed in');
    await sessionCtx.close();
    pass('panel session shared between tabs behind Caddy (HTTPS + staging password): a) sign in on A, F5 keeps it; b) ?pestana=util on B signed in; c) back on A and reload: both inside');
  }

  // 5. Lena: panel login, notice with image, declaration required, publication.
  const lenaCtx = await newContext();
  const lena = await lenaCtx.newPage();
  await lena.goto(`${origin}/lena/panel`);
  await lena.getByLabel('Correo electrónico', { exact: true }).fill(accounts.lena);
  await lena.getByLabel('Contraseña', { exact: true }).fill(password);
  await lena.getByRole('button', { name: 'Entrar ↗', exact: true }).click();
  const form = lena.getByRole('form', { name: 'Publicación municipal' });
  await form.waitFor({ state: 'visible' });
  const title = `Corte de agua programado en Pola de Lena ${randomUUID().slice(0, 6)}`;
  await form.locator('select').first().selectOption('notice');
  await form.getByLabel(/^Título/).fill(title);
  await form.getByLabel(/^Resumen/).fill('Aviso sintético de la prueba de staging.');
  await form.getByLabel('¿Qué deben saber los vecinos?', { exact: true }).fill('Texto propio de la prueba de extremo a extremo; no es un aviso real.');
  await form.getByLabel(/^Mostrar el aviso hasta/).fill('2099-12-31');
  await form.locator('input[type="file"]').setInputFiles({ name: 'aviso-lena.png', mimeType: 'image/png', buffer: png(900, 500, [36, 112, 74]) });
  await form.getByLabel('Descripción de la imagen', { exact: true }).fill('Imagen sintética del aviso');
  await form.getByLabel('Autoría o crédito', { exact: true }).fill('Ayuntamiento de Lena (prueba)');
  // Without the declaration the browser blocks the submission (required checkbox) and nothing is uploaded.
  let uploads = 0; lena.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/api/panel/api/media')) uploads++; });
  await form.getByRole('button', { name: 'Publicar ahora', exact: true }).click();
  await lena.waitForTimeout(800);
  assert.equal(uploads, 0, 'no upload without the rights declaration');
  await form.getByLabel(/declara que tiene los derechos necesarios/).check();
  const mediaResponse = lena.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/panel/api/media'));
  const contentResponse = lena.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/panel/api/municipal-content'));
  await form.getByRole('button', { name: 'Publicar ahora', exact: true }).click();
  const media = await (await mediaResponse).json();
  assert.equal((await mediaResponse).status(), 201);
  assert.equal(media.doc.rightsDeclaration.declared, true);
  assert.match(media.doc.rightsDeclaration.statement, /Ayuntamiento de Lena declara/);
  const content = await contentResponse;
  assert.equal(content.status(), 201);
  const notice = (await content.json()).doc;
  await lena.screenshot({ path: path.join(out, '03-panel-lena-publicado.png'), fullPage: true });
  pass('Lena signs in to her panel and publishes a notice with image; the rights declaration is required and stored');

  // 6. Appears on the public site, with the public image copy served through /media.
  const pub = await visitor.newPage();
  await pub.goto(`${origin}/lena`);
  await pub.getByText(title).first().waitFor();
  const img = pub.locator(`img[alt="Imagen sintética del aviso"]`).first();
  const src = await img.getAttribute('src');
  assert.match(src, new RegExp(`^${origin.replace(/[.]/g, '\\.')}/media/public/[0-9a-f-]{36}/`));
  const imageResponse = await visitor.request.get(src);
  assert.equal(imageResponse.status(), 200);
  assert.equal(imageResponse.headers()['content-type'], 'image/png');
  assert.equal((await anonymous.request.get(src)).status(), 401, 'image behind the staging password');
  await pub.screenshot({ path: path.join(out, '04-lena-con-aviso.png'), fullPage: true });
  pass(`the notice appears at once on /lena with its image from /media (200 with password, 401 without)`);

  // 7. Withdrawal through the actual /cms form (including Save Draft's live-withdrawal behavior).
  const reason = 'Contiene un dato personal; retirado en la prueba de staging';
  await withdrawThroughCMS(editor, origin, notice.id, reason);
  await pub.reload();
  assert(!(await pub.locator('body').innerText()).includes(title), 'withdrawn notice no longer public');
  assert.equal((await visitor.request.get(src)).status(), 404, 'withdrawn image no longer served');
  // Las publicaciones están en su pestaña del panel («Mis publicaciones»).
  await lena.goto(`${origin}/lena/panel?pestana=publicaciones`);
  const card = lena.locator('[data-publication]').filter({ hasText: title });
  await card.getByText(reason, { exact: false }).waitFor();
  assert((await card.innerText()).includes('Retirado por Planta 14'));
  await lena.screenshot({ path: path.join(out, '05-panel-lena-retirado.png'), fullPage: true });
  pass('withdrawal with reason: gone from the web, image 404, reason shown in Lena’s panel');

  // 8. Lena cannot use the Mieres panel.
  await lena.goto(`${origin}/mieres/panel`);
  await lena.getByText('Tu cuenta no gestiona este espacio municipal.', { exact: false }).waitFor();
  assert.equal(await lena.getByRole('form', { name: 'Publicación municipal' }).count(), 0);
  await lena.screenshot({ path: path.join(out, '06-lena-en-mieres.png') });
  pass('the Mieres panel rejects the Lena account (no form, no data)');

  // A second, still published notice with image so the backup/restore check covers a live public copy.
  const keptUpload = await lenaCtx.request.post(`${origin}/api/panel/api/media`, { headers: { Origin: origin }, multipart: {
    file: { name: 'mercado.png', mimeType: 'image/png', buffer: png(800, 450, [164, 82, 45]) },
    _payload: JSON.stringify({ alt: 'Imagen sintética del mercado', credit: 'Ayuntamiento de Lena (prueba)', rightsDeclaration: { declared: true } }) } });
  assert.equal(keptUpload.status(), 201);
  const keep = await panelApi(lenaCtx, 'POST', 'municipal-content', { type: 'news', title: 'Mercado semanal de Pola de Lena (prueba)', excerpt: 'Noticia sintética.', body: 'Texto propio.', image: (await keptUpload.json()).doc.id, _status: 'published' });
  assert.equal(keep.status, 201);
  await pub.goto(`${origin}/lena`);
  const keptSrc = await pub.locator('img[alt="Imagen sintética del mercado"]').first().getAttribute('src');
  assert.equal((await visitor.request.get(keptSrc)).status(), 200);
  assert.deepEqual(errors, [], `JavaScript errors: ${errors.join('\n')}`);
  writeFileSync(path.join(out, 'browser-state.json'), JSON.stringify({ password, accounts, withdrawnTitle: title, keptTitle: 'Mercado semanal de Pola de Lena (prueba)' }));
  pass('no JavaScript errors in the pages visited');
} finally {
  await browser.close();
}
