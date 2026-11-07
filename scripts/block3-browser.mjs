import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { withdrawThroughCMS } from './cms-browser-withdrawal.mjs';

export async function testMunicipalBrowser({ url, email, password, editorEmail }) {
  const modulePath = process.env.PLAYWRIGHT_MODULE || path.resolve('.local/review-tools/node_modules/playwright/index.mjs');
  const { chromium } = await import(pathToFileURL(modulePath).href);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${url}/lena/panel`);
    await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar ↗', exact: true }).click();
    const form = page.getByRole('form', { name: 'Publicación municipal' });
    await form.waitFor({ state: 'visible' });
    const title = 'Aviso original de prueba en navegador';
    await form.getByLabel(/^Título/).fill(title);
    await form.getByLabel(/^Resumen/).fill('Resumen propio del ensayo de navegador.');
    await form.getByLabel('¿Qué deben saber los vecinos?', { exact: true }).fill('Texto propio para comprobar publicación y retirada en el navegador real.');
    const responsePromise = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/cms/municipal-content'));
    await form.getByRole('button', { name: 'Publicar ahora', exact: true }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 201);
    const { doc } = await response.json();
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto(`${url}/lena`);
    assert((await publicPage.locator('body').innerText()).includes(title));
    const reason = 'Motivo de retirada del ensayo de navegador';
    const editor = await (await browser.newContext()).newPage();
    editor.on('pageerror', error => errors.push(error.message));
    await editor.goto(`${url}/cms/login`);
    await editor.locator('input[name="email"]').fill(editorEmail);
    await editor.locator('input[name="password"]').fill(password);
    await editor.locator('button[type="submit"]').click();
    await editor.waitForURL(location => !location.pathname.includes('/login'));
    await withdrawThroughCMS(editor, url, doc.id, reason);
    await publicPage.reload();
    assert(!(await publicPage.locator('body').innerText()).includes(title));
    await page.goto(`${url}/lena/panel?pestana=publicaciones`);
    const card = page.locator('[data-publication]').filter({ hasText: title });
    await card.getByText(reason, { exact: false }).waitFor();
    assert((await card.innerText()).includes('Retirado por Planta 14'));
    assert.equal(await card.getByRole('button', { name: 'Publicar', exact: true }).count(), 0);
    await page.goto(`${url}/mieres/panel`);
    await page.getByText('Tu cuenta no gestiona este espacio municipal.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('form', { name: 'Publicación municipal' }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: real Chrome/Playwright mobile login, publication, withdrawal through /cms Save Draft, public disappearance, persisted reason and cross-tenant denial');
  } finally { await browser.close(); }
}
