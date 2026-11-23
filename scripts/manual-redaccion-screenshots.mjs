// Capturas de docs/MANUAL-REDACCION.md (y comprobación visual en ordenador y móvil). Las genera el bloque
// participacion-redaccion-noticias.mjs con MANUAL_REDACCION=<carpeta> (y COMPROBACION_VISUAL=<carpeta> para las de
// comprobación, que no van al repositorio). Cada captura es independiente: si una falla, se avisa y se sigue.
import { mkdir, writeFile } from 'node:fs/promises';

export async function captureRedaccion({ browser, web, cmsOrigin = web, password, editorEmail, articles, media, dir, checkDir }) {
  await mkdir(dir, { recursive: true });
  const problems = [];
  const attempt = async (name, fn) => { try { await fn(); } catch (error) { problems.push(`${name}: ${String(error).split('\n')[0]}`); } };

  // --- CMS (ordenador, 1366 px), con la sesión de la redacción.
  const cms = await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1, locale: 'es-ES' });
  const page = await cms.newPage();
  await page.goto(`${cmsOrigin}/cms/login`, { waitUntil: 'load' });
  await page.locator('input[name="email"]').fill(editorEmail);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
  const open = async id => { await page.goto(`${cmsOrigin}/cms/collections/articles/${id}`, { waitUntil: 'load' }); await page.locator('input[name="title"]').waitFor({ timeout: 30000 }); await page.waitForTimeout(800); };
  const tab = async name => { await page.getByRole('button', { name, exact: true }).first().click(); await page.waitForTimeout(500); };
  const shotOf = async (file, locator) => { await locator.scrollIntoViewIfNeeded(); await locator.screenshot({ path: `${dir}/${file}` }); };
  const field = name => page.locator(`.field-type, [id^="field-"]`).filter({ has: page.locator(`[id="field-${name}"], [name="${name}"]`) }).first();

  await attempt('clasificación', async () => {
    await open(articles.multi.id); await tab('Clasificación');
    await page.screenshot({ path: `${dir}/01-clasificacion.png` });
  });
  await attempt('foto principal y cartel', async () => {
    await open(articles.poster.id);
    const box = page.locator('[id="field-image"]').locator('xpath=ancestor::div[contains(@class,"field-type")][1]');
    await page.locator('[id="field-imagePoster"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/02-foto-principal-cartel.png` });
    void box;
  });
  await attempt('plantilla', async () => {
    await open(articles.noPhoto.id);
    await page.locator('text=Sin foto: plantilla de Planta 14').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/03-plantilla.png` });
  });
  await attempt('bloques en el texto', async () => {
    await open(articles.gallery.id);
    await page.locator('.rich-text-lexical').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${dir}/04-bloques-en-el-texto.png` });
    // Menú «/» para añadir un bloque.
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.locator('p').last().click();
    await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('/', { delay: 50 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dir}/05-menu-imagen-galeria.png` });
    await page.keyboard.press('Escape');
  });
  await attempt('imagen: punto de interés', async () => {
    await page.goto(`${cmsOrigin}/cms/collections/media/${media.photo.id}`, { waitUntil: 'load' });
    await page.locator('input[name="alt"]').waitFor({ timeout: 30000 });
    await page.screenshot({ path: `${dir}/06-imagen-tipo.png` });
    await page.getByRole('button', { name: /Editar imagen|Editar/i }).first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${dir}/07-punto-de-interes.png` });
  });
  await cms.close();

  // --- Web pública: ordenador (1366) y móvil (390).
  const shots = [
    ['10-noticia-varios-concejos', `/noticia/${articles.multi.slug}`, 'desktop'],
    ['11-temas', `/noticia/${articles.multi.slug}`, 'desktop', '[data-article-tags]'],
    ['12-galeria-movil', `/noticia/${articles.gallery.slug}`, 'mobile', '[data-gallery]'],
    ['14-cartel', `/noticia/${articles.poster.slug}`, 'desktop'],
    ['15-foto-vertical', `/noticia/${articles.vertical.slug}`, 'desktop'],
    ['16-etiqueta', '/etiqueta/mineria', 'desktop'],
    ['17-multimedia', '/multimedia', 'desktop'],
    ['18-ilustracion-ia', `/noticia/${articles.ai.slug}`, 'desktop'],
    ['19-sin-foto-plantilla', `/noticia/${articles.noPhoto.slug}`, 'desktop'],
  ];
  const contexts = {
    desktop: await browser.newContext({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 }),
    mobile: await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }),
  };
  for (const c of Object.values(contexts)) await c.addCookies([{ name: 'planta14_consent', value: '1%3Arejected', url: web }]);
  for (const [name, path, kind, selector] of shots) await attempt(name, async () => {
    const tab = await contexts[kind].newPage();
    await tab.goto(`${web}${path}`, { waitUntil: 'load' });
    await tab.waitForTimeout(600);
    if (selector) { const el = tab.locator(selector).first(); await el.scrollIntoViewIfNeeded(); await tab.evaluate(() => window.scrollBy(0, -120)); }
    await tab.screenshot({ path: `${dir}/${name}.png` });
    await tab.close();
  });
  await attempt('galería ampliada', async () => {
    const tab = await contexts.mobile.newPage();
    await tab.goto(`${web}/noticia/${articles.gallery.slug}`, { waitUntil: 'load' });
    await tab.locator('[data-gallery-item="1"]').click();
    await tab.locator('[data-lightbox]').waitFor(); await tab.waitForTimeout(500);
    await tab.screenshot({ path: `${dir}/13-galeria-ampliada.png` });
    await tab.close();
  });
  await attempt('imagen para redes', async () => {
    const html = await (await fetch(`${web}/noticia/${articles.multi.slug}`)).text();
    const url = html.match(/<meta property="og:image" content="([^"]+)"/)[1].replaceAll('&amp;', '&').replace(/^https?:\/\/[^/]+/, web);
    await writeFile(`${dir}/20-imagen-para-redes.jpg`, Buffer.from(await (await fetch(url)).arrayBuffer()));
    const posterHtml = await (await fetch(`${web}/noticia/${articles.poster.slug}`)).text();
    const posterUrl = posterHtml.match(/<meta property="og:image" content="([^"]+)"/)[1].replaceAll('&amp;', '&').replace(/^https?:\/\/[^/]+/, web);
    await writeFile(`${dir}/21-imagen-para-redes-cartel.jpg`, Buffer.from(await (await fetch(posterUrl)).arrayBuffer()));
  });

  // --- Comprobación visual (punto 17): cada página en ordenador y móvil, página entera (no van al repositorio).
  if (checkDir) {
    await mkdir(checkDir, { recursive: true });
    const pages = [['vertical', `/noticia/${articles.vertical.slug}`], ['cartel', `/noticia/${articles.poster.slug}`], ['galeria', `/noticia/${articles.gallery.slug}`],
      ['tres-concejos', `/noticia/${articles.multi.slug}`], ['etiqueta', '/etiqueta/mineria'], ['multimedia', '/multimedia'], ['seccion-cultura', '/tema/cultura'],
      ['seccion-economia', '/tema/economia'], ['portada', '/'], ['lena', '/lena'], ['aller', '/concejo/aller']];
    for (const [name, path] of pages) for (const kind of ['desktop', 'mobile']) await attempt(`comprobación ${name} ${kind}`, async () => {
      const tab = await contexts[kind].newPage();
      await tab.goto(`${web}${path}`, { waitUntil: 'load' }); await tab.waitForTimeout(400);
      const overflow = await tab.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth + 1);
      if (overflow) problems.push(`desplazamiento horizontal en ${path} (${kind})`);
      await tab.screenshot({ path: `${checkDir}/${name}-${kind}.png`, fullPage: true });
      await tab.close();
    });
  }
  for (const c of Object.values(contexts)) await c.close();
  return problems;
}
