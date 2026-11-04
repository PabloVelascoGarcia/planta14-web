import { createRequire } from 'node:module';

// Comprobaciones de la revisión de portada (scripts/portada-integration.mjs): contenido del ensayo cargado.
export async function run({ web, payload, browser, assert, passed, pesoMovil, kib }) {
  const html = async url => { const r = await fetch(url); assert.equal(r.status, 200, url); return (await r.text()).replaceAll('<!-- -->', ''); };
  const all = async (collection, where) => (await payload.find({ collection, where, pagination: false, depth: 1, overrideAccess: true })).docs;
  const articles = (await all('articles', { _status: { equals: 'published' } })).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const sectionOf = a => a.section.slug;
  const isAgenda = a => sectionOf(a) === 'agenda';
  const isOpinion = a => a.opinion || sectionOf(a) === 'opinion';
  const bySlug = new Map(articles.map(a => [a.slug, a]));
  const { devices, chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
  void chromium;

  // Piezas enlazadas en cada bloque de la portada (data-block).
  async function blocks() {
    const context = await browser.newContext();
    const tab = await context.newPage();
    await tab.goto(`${web}/`);
    const result = await tab.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-block]')].map(block => [block.dataset.block,
      [...new Set([...block.querySelectorAll('a[href^="/noticia/"]')].map(a => a.getAttribute('href').slice('/noticia/'.length)))]])));
    await context.close();
    return result;
  }

  // --- 1. «Tu ayuntamiento, aquí»: sin enlaces a paneles; los espacios activos (Mieres y Lena) y la lista de concejos.
  const home = await html(`${web}/`);
  for (const url of ['/', '/mieres', '/lena', '/aller', '/agenda', `/noticia/${articles[0].slug}`, '/comarca/caudal', '/buscar?q=mieres']) {
    const page = await html(`${web}${url}`);
    assert.ok(!/href="[^"]*\/panel(\/|")/.test(page), `no link to a /panel from ${url}`);
  }
  assert.ok(!home.includes('Prueba cómo se publica un aviso'), 'no «Prueba cómo se publica un aviso»');
  const municipalBlock = home.slice(home.indexOf('data-block="ayuntamientos"'), home.indexOf('id="concejos"'));
  assert.ok(municipalBlock.includes('href="/mieres"') && municipalBlock.includes('Descubre el espacio de Mieres'), 'active space Mieres');
  assert.ok(municipalBlock.includes('href="/lena"') && municipalBlock.includes('Descubre el espacio de Lena'), 'active space Lena');
  assert.ok(!municipalBlock.includes('href="/aller"') && !municipalBlock.includes('Descubre el espacio de Aller'), 'Aller (inactive) is not offered');
  assert.ok(municipalBlock.includes('href="#concejos"') && home.includes('id="concejos"'), 'link to the list of the six concejos');
  for (const town of ['mieres', 'lena', 'aller', 'morcin', 'riosa', 'ribera-de-arriba']) assert.ok(home.includes(`href="/${town}"`), `concejo ${town} listed`);
  passed('«Tu ayuntamiento, aquí»: no «Prueba cómo se publica un aviso»; no public page links to a /panel; it offers the active spaces (Mieres and Lena, not Aller) and a link to the list of the six concejos');

  // --- 2 y 3. Principal, bloques sin agenda ni opinión fuera de su sitio, sin repetidos.
  let b = await blocks();
  const news = articles.filter(a => !isAgenda(a) && !isOpinion(a));
  assert.ok(!articles.some(a => a.main), 'the trial content marks no main article');
  assert.deepEqual(b.principal, [news[0].slug], 'no main marked: the most recent news (not opinion, not agenda)');
  const newsBlocks = ['principal', 'en-portada', 'la-vida-aqui', 'caudal'];
  const seen = new Map();
  for (const name of [...newsBlocks, 'opinion']) for (const slug of b[name] ?? []) {
    assert.ok(!seen.has(slug), `«${slug}» appears in ${seen.get(slug)} and ${name}`);
    seen.set(slug, name);
  }
  for (const name of newsBlocks) for (const slug of b[name]) {
    assert.ok(!isAgenda(bySlug.get(slug)), `agenda piece ${slug} in ${name}`);
    assert.ok(!isOpinion(bySlug.get(slug)), `opinion piece ${slug} in ${name}`);
  }
  assert.ok(b.opinion.length > 0 && b.opinion.every(slug => isOpinion(bySlug.get(slug))), 'opinion block: only opinion');
  assert.deepEqual([b['en-portada'].length, b['la-vida-aqui'].length, b.caudal.length], [4, 3, 3], 'blocks filled with the following news');
  assert.deepEqual([...b.principal, ...b['en-portada']], news.slice(0, 5).map(a => a.slug), 'main and «En portada» are the latest news, in order');
  assert.ok(articles.filter(isAgenda).length > 0 && b.agenda.every(slug => isAgenda(bySlug.get(slug))), 'the agenda links only agenda pieces');
  // Marcada como principal: esa (aunque sea antigua).
  const marked = news.at(-1);
  await payload.update({ collection: 'articles', id: marked.id, overrideAccess: true, data: { main: true } });
  b = await blocks();
  assert.deepEqual(b.principal, [marked.slug], '«Principal de portada» wins');
  assert.ok(!Object.entries(b).some(([name, slugs]) => name !== 'principal' && slugs.includes(marked.slug)), 'the main article is not repeated');
  await payload.update({ collection: 'articles', id: marked.id, overrideAccess: true, data: { main: false } });
  passed(`front page: main = «Principal de portada» or else the latest news (not opinion nor agenda); «En portada» 4, «La vida aquí» 3 and Caudal 3 without agenda or opinion pieces and without repeats (${seen.size} different pieces); opinion only in its block; agenda only in the agenda`);

  // --- 7. Relacionadas: mismo concejo primero, después misma sección; sin agenda ni la propia.
  for (const article of news.slice(0, 6)) {
    const context = await browser.newContext();
    const tab = await context.newPage();
    await tab.goto(`${web}/noticia/${article.slug}`);
    const related = await tab.$$eval('[data-block="relacionadas"] a[href^="/noticia/"]', links => [...new Set(links.map(a => a.getAttribute('href').slice(9)))]);
    await context.close();
    const pool = articles.filter(a => a.slug !== article.slug && !isAgenda(a));
    const expected = [...new Set([...pool.filter(a => a.town.id === article.town.id), ...pool.filter(a => a.section.id === article.section.id)].map(a => a.slug))].slice(0, 3);
    assert.deepEqual(related, expected, `related of ${article.slug}`);
  }
  passed('related: same concejo first, then same section; never agenda pieces or the article itself');

  // --- 4. Imágenes con srcset y sizes; peso en móvil.
  assert.match(home, /<img[^>]+srcSet="[^"]+ 800w, [^"]+ 1600w/i, 'srcset with the generated sizes');
  assert.match(home, /<img[^>]+sizes="\(min-width: 1212px\) 834px/, 'sizes of the lead image');
  const peso = await pesoMovil(`${web}/`);
  console.log(`MEDIDA: portada en móvil (iPhone 13) después: imágenes al abrir ${kib(peso.firstImages)} KiB; recorrida entera ${kib(peso.images)} KiB en ${peso.imageCount} imágenes; todo ${kib(peso.total)} KiB sin comprimir. Mayores: ${peso.biggest.join(', ')}`);
  assert.ok(peso.images < 3000 * 1024, `images on mobile under 3000 KiB (${kib(peso.images)} KiB)`);
  passed(`images: srcset (800, 1600 and the original) and sizes per slot; home on mobile ${kib(peso.firstImages)} KiB of images on opening, ${kib(peso.images)} KiB scrolled`);

  // --- 5 y 10. Noticia: compartir sin terceros ni cookies; hora de publicación.
  const article = news[0];
  const url = `http://localhost:${new URL(web).port}/noticia/${article.slug}`;
  const page = await html(`${web}/noticia/${article.slug}`);
  const u = encodeURIComponent(url);
  for (const href of [`https://wa.me/?text=${encodeURIComponent(`${article.title} ${url}?utm_source=whatsapp`)}`, `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    `https://x.com/intent/post?text=${encodeURIComponent(article.title)}&amp;url=${u}`, `https://t.me/share/url?url=${u}&amp;text=${encodeURIComponent(article.title)}`])
    assert.ok(page.includes(`href="${href}"`), `share link ${href.slice(0, 40)}`);
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const tab = await context.newPage();
  const external = [];
  tab.on('request', request => { if (!request.url().startsWith(web) && !request.url().startsWith('data:')) external.push(request.url()); });
  await tab.goto(`${web}/noticia/${article.slug}`, { waitUntil: 'networkidle' });
  const scripts = await tab.$$eval('script[src]', list => list.map(s => s.src));
  assert.ok(scripts.every(src => src.startsWith(web)), `only own scripts: ${scripts.filter(s => !s.startsWith(web))}`);
  await tab.click('[data-share-copy]');
  await tab.getByText('Enlace copiado', { exact: true }).waitFor();
  assert.equal(await tab.evaluate(() => navigator.clipboard.readText()), url, 'copy link');
  assert.deepEqual(await context.cookies(), [], 'no cookies');
  assert.ok(external.every(r => r.startsWith(process.env.PUBLIC_MEDIA_BASE_URL)), `no third-party requests: ${external.filter(r => !r.startsWith(process.env.PUBLIC_MEDIA_BASE_URL))}`);
  const time = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(article.publishedAt));
  assert.match(page, new RegExp(`<time dateTime="${article.publishedAt}">[^<]+ · ${time} h</time>`), 'article date with time');
  assert.ok(home.includes(` · ${time} h</time>`) || (await html(`${web}/tema/${sectionOf(article)}`)).includes(` · ${time} h</time>`), 'cards with time');
  await context.close();
  passed(`share: WhatsApp, Facebook, X and Telegram as direct links and «Copiar enlace» (clipboard), no third-party scripts, requests or cookies; publication time next to the date (${time} h) in the article and the lists`);

  // --- 8. Huecos publicitarios: autopromoción.
  assert.ok(!home.includes('Espacio publicitario') && !page.includes('Espacio publicitario'), 'no empty «Espacio publicitario» boxes');
  assert.ok(home.includes('data-ad-slot="autopromocion"') && home.includes('Anúnciate en Planta 14') && /data-ad-slot="autopromocion"[\s\S]*?href="\/publicidad"/.test(home), 'self-promotion to /publicidad');
  assert.ok(page.includes('Anúnciate en Planta 14'), 'also in the article');
  passed('ad slots without an ad: discreet «Anúnciate en Planta 14» linking to /publicidad');

  // --- 6. 404 propia. Las direcciones sin ruta llevan la página completa en el HTML (app/global-not-found.tsx); las
  // que llaman a notFound() (concejo, noticia o autor inexistentes) responden 404 y Next.js la pinta en el navegador.
  const towns = ['mieres', 'lena', 'aller', 'morcin', 'riosa', 'ribera-de-arriba'];
  for (const path of ['/noticia/a/b/c', '/concejo/mieres/x/y']) {
    const response = await fetch(`${web}${path}`);
    assert.equal(response.status, 404, path);
    const body = (await response.text()).replaceAll('<!-- -->', '');
    assert.ok(body.includes('Esta página no está en Planta 14.') && body.includes('action="/buscar"') && body.includes('href="/"') && body.includes('lang="es"') && /noindex/.test(body), `own 404 in the HTML at ${path}`);
    for (const town of towns) assert.ok(body.includes(`href="/${town}"`), `404 links ${town} at ${path}`);
    assert.ok(!body.includes('Edición de demostración'), `real-content header at ${path}`);
  }
  for (const path of ['/no-existe-esta-pagina', '/noticia/no-existe', '/autor/nadie', '/tema/nada']) {
    const context = await browser.newContext();
    const tab = await context.newPage();
    const response = await tab.goto(`${web}${path}`);
    assert.equal(response.status(), 404, path);
    await tab.locator('h1', { hasText: 'Esta página no está en Planta 14.' }).waitFor();
    assert.equal(await tab.locator('form[action="/buscar"] input[name="q"]').count(), 1, `search at ${path}`);
    assert.equal(await tab.locator('[data-not-found] a[href="/"]').count(), 1, `home link at ${path}`);
    for (const town of towns) assert.equal(await tab.locator(`[data-not-found] a[href="/${town}"]`).count(), 1, `${town} at ${path}`);
    assert.ok(await tab.locator('footer').count(), `site footer at ${path}`);
    await context.close();
  }
  passed('404: own page in Spanish with the Planta 14 design, search box and links to the home page and the six concejos; unmatched addresses get it in the HTML, missing concejo/article/author/section pages (404) in the browser');

  // --- 9. Página del concejo: noticias primero, tarjetas fijas después; ayudas sin foto en la lista.
  {
    const context = await browser.newContext();
    const tab = await context.newPage();
    await tab.goto(`${web}/mieres`);
    const order = await tab.evaluate(() => {
      const column = document.querySelector('.municipal-main-column');
      return [...column.querySelectorAll('.municipal-content-card:not(.is-compact), .municipal-editorial-card, .aller-discover, .municipal-grant-preview')]
        .map(e => e.classList.contains('aller-discover') ? 'fijas' : e.classList.contains('municipal-grant-preview') ? 'ayudas' : 'noticia');
    });
    const firstFixed = order.indexOf('fijas');
    assert.ok(firstFixed > 0 && order.slice(0, firstFixed).every(x => x === 'noticia') && !order.slice(firstFixed).includes('noticia'), `news first, fixed cards after: ${order.join(' ')}`);
    const grantImages = await tab.$$eval('.municipal-grant-preview img', list => list.length);
    assert.equal(grantImages, 0, 'grants list without photos');
    await context.close();
  }
  passed('concejo page: in «Noticias del concejo» the news (municipal and Planta 14) come first and the three fixed cards after; the grants list without photo');

  // --- 11. Móvil: textos de 13 px o más y zonas táctiles de 44 px (24 px en créditos dentro de una frase).
  for (const path of ['/mieres', '/lena']) {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const tab = await context.newPage();
    await tab.goto(`${web}${path}`, { waitUntil: 'networkidle' });
    const problems = await tab.evaluate(() => {
      const visible = e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0 && !e.closest('.sr-only'); };
      const out = [];
      if (document.scrollingElement.scrollWidth > window.innerWidth + 1) out.push(`desborda: ${document.scrollingElement.scrollWidth}px de ancho en ${window.innerWidth}px`);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, element = node.parentElement;
        if (!node.textContent.trim() || !visible(element)) continue;
        const size = parseFloat(getComputedStyle(element).fontSize);
        if (size > 0 && size < 13) out.push(`texto ${size}px «${node.textContent.trim().slice(0, 30)}»`);
      }
      for (const e of document.querySelectorAll('a, button, summary, select, input')) {
        if (!visible(e)) continue;
        const r = e.getBoundingClientRect();
        const inSentence = getComputedStyle(e).display === 'inline' || !!e.closest('.aller-asset-credit, figcaption');
        const min = inSentence ? 24 : 44;
        if (r.height < min || (r.width < min && !inSentence)) out.push(`toque ${Math.round(r.width)}×${Math.round(r.height)} «${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30)}»`);
      }
      return out;
    });
    await context.close();
    assert.deepEqual(problems, [], `${path} on mobile`);
  }
  for (const path of ['/', `/noticia/${news[0].slug}`, '/noticia/a/b/c', '/agenda']) {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const tab = await context.newPage();
    await tab.goto(`${web}${path}`, { waitUntil: 'networkidle' });
    const width = await tab.evaluate(() => [document.scrollingElement.scrollWidth, window.innerWidth]);
    await context.close();
    assert.ok(width[0] <= width[1] + 1, `${path} overflows on mobile: ${width}`);
  }
  passed('mobile: home, article, 404 and agenda without horizontal overflow; concejo page (Mieres and Lena): no horizontal overflow, no text under 13 px; links and buttons at least 44 px (credits inside a sentence, 24 px)');
}
