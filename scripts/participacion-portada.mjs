// Bloques 4 a 6 de scripts/participacion-integration.mjs: «Última hora», Google Discover y fechas del CMS.
export async function run(ctx) {
  const { payload, users, page, passed, assert, web, start, stop, signIn } = ctx;

  // --- 4. Última hora: activable desde el CMS con texto, enlace y caducidad.
  assert.ok(!(await page(`${web}/`)).includes('data-breaking-news'), 'no bar while inactive');
  await assert.rejects(payload.updateGlobal({ slug: 'breaking-news', overrideAccess: false, data: { active: true, text: 'Anónimo' } }), 'anonymous cannot');
  await assert.rejects(payload.updateGlobal({ slug: 'breaking-news', user: users.editor, overrideAccess: false, data: { active: true, text: '' } }), /texto de la última hora/);
  await assert.rejects(payload.updateGlobal({ slug: 'breaking-news', user: users.editor, overrideAccess: false, data: { active: true, text: 'Corte', link: 'javascript:alert(1)' } }));
  await payload.updateGlobal({ slug: 'breaking-news', user: users.editor, overrideAccess: false,
    data: { active: true, text: 'Cortada la AS-112 en Moreda por un argayo', link: '/noticia/argayo-moreda', expiresAt: new Date(Date.now() + 3600_000).toISOString() } });
  for (const path of ['/', '/agenda', '/fiestas']) {
    const html = await page(`${web}${path}`);
    assert.ok(html.includes('data-breaking-news') && html.includes('Cortada la AS-112 en Moreda por un argayo') && html.includes('href="/noticia/argayo-moreda"'), `bar on ${path}`);
  }
  assert.ok(!(await page(`${web}/lena`)).includes('data-breaking-news'), 'not on concejo pages (they have their own masthead)');
  await payload.updateGlobal({ slug: 'breaking-news', overrideAccess: true, data: { expiresAt: new Date(Date.now() - 1000).toISOString() } });
  assert.ok(!(await page(`${web}/`)).includes('data-breaking-news'), 'expired: gone by itself');
  await payload.updateGlobal({ slug: 'breaking-news', overrideAccess: true, data: { expiresAt: null } });
  assert.ok((await page(`${web}/`)).includes('data-breaking-news'), 'without expiry it stays');
  await payload.updateGlobal({ slug: 'breaking-news', user: users.editor, overrideAccess: false, data: { active: false } });
  assert.ok(!(await page(`${web}/`)).includes('data-breaking-news'), 'unchecked: gone');
  passed('«Última hora»: the newsroom turns on a bar under the header with text, link and expiry (validated link, text required); it disappears at the expiry time or when unchecked; not on concejo pages');

  // --- 5. Google Discover: max-image-preview:large solo si el sitio es indexable; imagen de ≥ 1200 px.
  const author = (await payload.find({ collection: 'authors', limit: 1, overrideAccess: true })).docs[0];
  const town = (await payload.find({ collection: 'towns', where: { slug: { equals: 'mieres' } }, overrideAccess: true })).docs[0];
  const section = (await payload.find({ collection: 'sections', where: { slug: { equals: 'sociedad' } }, overrideAccess: true })).docs[0];
  const sharp = ctx.sharp;
  const file = `${ctx.directory}/discover.jpg`;
  await sharp({ create: { width: 2560, height: 1440, channels: 3, background: '#557766' } }).jpeg().toFile(file);
  const media = await payload.create({ collection: 'media', user: users.editor, overrideAccess: false, filePath: file, data: { alt: 'Foto grande', credit: 'Planta 14', rightsHolder: 'Planta 14', rightsType: 'propia', rightsConfirm: true } });
  const article = await payload.create({ collection: 'articles', overrideAccess: true, data: { title: 'Noticia para Discover', excerpt: 'Entradilla.', body: ['Texto.'], author: author.id, town: town.id, section: section.id, image: media.id, _status: 'published' } });
  const robots = html => html.match(/<meta name="robots" content="([^"]+)"/)?.[1];
  const meta = (html, property) => html.match(new RegExp(`<meta property="${property}" content="([^"]+)"`))?.[1];
  let html = await page(`${web}/noticia/${article.slug}`);
  assert.equal(robots(html), 'noindex, nofollow', 'not indexable: noindex, no max-image-preview');
  await stop(); await start({ SITE_INDEXABLE: 'true' });
  html = await page(`${web}/noticia/${article.slug}`);
  assert.match(robots(html), /^index, follow, max-image-preview:large$/, 'indexable: max-image-preview:large');
  assert.match(robots(await page(`${web}/`)), /max-image-preview:large/, 'also on the home page');
  assert.ok(Number(meta(html, 'og:image:width')) >= 1200, `og:image of at least 1200 px (${meta(html, 'og:image:width')})`);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.ok(ld.image[0]['@type'] === 'ImageObject' && ld.image[0].width >= 1200 && ld.image[0].url === meta(html, 'og:image').replaceAll('&amp;', '&'), 'JSON-LD image of at least 1200 px, same as Open Graph');
  await stop(); await start();
  passed('Google Discover: robots «max-image-preview:large» only when the site is indexable (noindex otherwise); articles expose a ≥ 1200 px image in Open Graph (with its size) and in the NewsArticle JSON-LD (ImageObject with width and height)');

  // --- 6. Fechas del CMS: dd/MM/yyyy HH:mm.
  const cookie = await signIn(users.admin.email);
  const context = await ctx.browser.newContext();
  await context.addCookies(cookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: ctx.origin }; }));
  const tab = await context.newPage();
  await tab.goto(`${ctx.origin}/cms/collections/notifications`);
  const cell = tab.locator('td.cell-createdAt').first();
  await cell.waitFor();
  // La lista se pinta primero con «Cargando...»: se espera a la fecha.
  await tab.waitForFunction(() => /\d{2}\/\d{2}\/\d{4}/.test(document.querySelector('td.cell-createdAt')?.textContent ?? ''), null, { timeout: 30_000 }).catch(() => undefined);
  const shown = (await cell.innerText()).trim();
  await tab.goto(`${ctx.origin}/cms/collections/festivals`);
  await tab.locator('td.cell-startDate').first().waitFor();
  await tab.waitForFunction(() => /\d{2}\/\d{2}\/\d{4}/.test(document.querySelector('td.cell-startDate')?.textContent ?? ''), null, { timeout: 30_000 }).catch(() => undefined);
  const festivalDate = (await tab.locator('td.cell-startDate').first().innerText()).trim();
  await context.close();
  assert.match(shown, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/, `list dates as dd/MM/yyyy HH:mm (${shown})`);
  assert.match(festivalDate, /^\d{2}\/\d{2}\/\d{4}/, `fiesta days as dd/MM/yyyy (${festivalDate})`);
  const { default: config } = await import('../payload.config.ts');
  const resolved = await config;
  assert.equal(resolved.admin.dateFormat, 'dd/MM/yyyy HH:mm');
  passed('CMS dates as dd/MM/yyyy HH:mm (lists, document details and versions); date pickers already dd/MM/yyyy HH:mm (dd/MM/yyyy for fiesta days)');
}
