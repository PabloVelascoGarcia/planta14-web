// Bloque «Útil: cajas de 5 y Ver todos; activación por concejo» de scripts/participacion-integration.mjs. Usa las fichas
// y servicios que deja el bloque util (Santa Cristina en Lena, Bustiello en Mieres, rutas de Lena y Aller…).
export async function run(ctx) {
  const { payload, users, web, page, passed, assert, browser, signIn, town } = ctx;
  const block = (html, id) => html.split(`data-util="${id}"`)[1]?.split('</section>')[0] ?? null;
  const status = async path => (await fetch(`${web}${path}`, { redirect: 'manual' })).status;
  await ctx.activate(ctx.SIX);

  // 1. Cajas de 5 como máximo, con «Ver todos (n)» a su página; la página completa filtra por tipo y por texto.
  const lena = await town('lena');
  const extra = [];
  for (let i = 1; i <= 7; i++) extra.push(await payload.create({ collection: 'municipal-services', overrideAccess: true,
    data: { name: `Servicio de prueba ${i}`, town: lena.id, category: i <= 3 ? 'deportes' : 'cultura', place: 'Pola de Lena', order: 100 + i } }));
  const services = (await payload.find({ collection: 'municipal-services', overrideAccess: false, pagination: false, where: { 'town.slug': { equals: 'lena' } } })).docs.length;
  const lenaPage = await page(`${web}/lena`);
  const box = block(lenaPage, 'servicios');
  assert.equal((box.match(/<li data-util-service/g) ?? []).length, 5, 'at most 5 services in the box');
  assert.ok(box.includes('href="/lena/util/servicios"') && box.includes(`Ver todos (${services})`), `«Ver todos (n)»: ${box.slice(-400)}`);
  for (const id of ['patrimonio', 'rutas']) assert.ok(block(lenaPage, id).includes(`href="/lena/util/${id}"`), `«Ver todos» for ${id}`);
  const full = await page(`${web}/lena/util/servicios`);
  assert.equal((full.match(/<li data-util-service/g) ?? []).length, services, 'the full list');
  assert.ok(full.includes('data-util-filter') && full.includes('href="/lena/util/servicios?tipo=deportes"') && /<form[^>]*action="\/lena\/util\/servicios" method="get"/.test(full), `simple filters: ${full.slice(full.indexOf('<form'), full.indexOf('<form') + 900)}`);
  assert.equal(((await page(`${web}/lena/util/servicios?tipo=deportes`)).match(/<li data-util-service/g) ?? []).length, 3, 'filter by type');
  assert.equal(((await page(`${web}/lena/util/servicios?q=prueba%207`)).match(/<li data-util-service/g) ?? []).length, 1, 'search');
  assert.ok((await page(`${web}/lena/util/patrimonio`)).includes('Santa Cristina de Lena') && (await page(`${web}/lena/util/rutas`)).includes('Ruta de ejemplo en Aller'), 'heritage and routes, also shared routes');
  for (const type of ['subvenciones', 'empleo']) assert.equal(await status(`/lena/util/${type}`), 200, type);
  assert.equal(await status('/lena/util/otra-cosa'), 404, 'unknown type');
  assert.equal(await status('/util/subvenciones'), 200, 'regional grants: full list in /util');
  passed('Útil: each box shows at most 5 items (the most complete first) with «Ver todos (n)» to its own page per type and concejo (/lena/util/servicios, /patrimonio, /rutas, /subvenciones, /empleo) with the full list, filters by type and a search box');

  // 2. Concejo NO activo (Aller): solo cabecera, noticias de Planta 14 y fiestas; «Útil» y lo municipal fuera, con 404.
  const allerSpace = (await payload.find({ collection: 'municipal-spaces', where: { legacyID: { equals: 'aller' } }, overrideAccess: true })).docs[0];
  const adminCookie = await signIn(users.admin.email);
  const setStatus = value => fetch(`${web}/api/cms/municipal-spaces/${allerSpace.id}`, { method: 'PATCH', headers: { Cookie: adminCookie, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: { status: value, startsAt: '2026-01-01', endsAt: null } }) });
  assert.equal((await setStatus('inactive')).status, 200, 'the administration deactivates Aller in the CMS');
  const aller = await page(`${web}/aller`);
  assert.ok(aller.includes('data-municipal-active="false"') && aller.includes('municipal-masthead'), 'masthead kept');
  for (const marker of ['data-municipal-util', 'municipal-section-nav', 'municipal-notices', 'municipal-grant-preview', 'aller-discover', 'Historias del Caudal', 'aller-hero'])
    assert.ok(!aller.includes(marker), `inactive concejo: no ${marker}`);
  for (const type of ['servicios', 'patrimonio', 'rutas', 'subvenciones', 'empleo']) assert.equal(await status(`/aller/util/${type}`), 404, `/aller/util/${type}: 404`);
  assert.equal(await status('/util/rutas/ruta-de-ejemplo-en-aller-aller'), 404, 'its cards too');
  assert.equal(await status('/util/rutas?concejo=aller'), 404, 'and its filter');
  assert.ok(!(await page(`${web}/lena/util/rutas`)).includes('Ruta de ejemplo en Aller'), 'a shared route of an inactive concejo is not published elsewhere');
  const util = await page(`${web}/util`);
  assert.ok(!util.includes('data-util="concejo-aller"') && util.includes('data-util="concejo-lena"'), '/util: a block only for active concejos');
  assert.ok(util.includes('data-util-pajares') && util.includes('data-util="subvenciones"') && util.includes('data-util="farmacias"'), '/util: the regional part always (Pajares, grants, pharmacies; the weather is checked in the util block)');
  assert.ok(!util.includes('/aller/util/') && !util.includes('aller.es/empleo'), '/util: nothing of Aller');
  assert.ok((await payload.find({ collection: 'routes', where: { slug: { equals: 'ruta-de-ejemplo-en-aller-aller' } }, overrideAccess: true })).docs.length === 1, 'imported data kept in the CMS');
  const sitemap = (await import('node:fs')).readFileSync('app/(frontend)/sitemap.ts', 'utf8');
  assert.ok(sitemap.includes('activeTowns()') && sitemap.includes('/util/${type}'), 'sitemap: «Ver todos» pages of active concejos only');

  // 3. Activarlo se nota sin desplegar (cada página se genera en cada petición y el CMS revalida al guardar).
  assert.equal((await setStatus('active')).status, 200);
  const again = await page(`${web}/aller`);
  assert.ok(again.includes('data-municipal-active="true"') && again.includes('data-municipal-util') && (await status('/aller/util/rutas')) === 200 && (await page(`${web}/util`)).includes('data-util="concejo-aller"'), 'activated: visible at once, without redeploying');
  passed('activation per concejo: an inactive concejo shows only its masthead, Planta 14 news and fiestas (no Útil, notices, agenda, board or other services); its /[concejo]/util pages and cards give 404 and stay out of the sitemap; /util always shows the regional part and one block per active concejo; activating or deactivating in the CMS shows at once; imported data stays in the CMS');

  // 4. Maquetación: /util y los seis concejos a 1440, 1024, 768 y 390 px, en columnas sin huecos y sin desbordar.
  const measures = [];
  for (const width of [1440, 1024, 768, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, isMobile: width < 500, hasTouch: width < 500 });
    const tab = await context.newPage();
    for (const path of ['/util', ...ctx.SIX.map(t => `/${t}`)]) {
      await tab.goto(`${web}${path}`, { waitUntil: 'domcontentloaded' });
      const r = await tab.evaluate(() => {
        const grid = document.querySelector('[data-util-grid]');
        const blocks = [...grid.querySelectorAll(':scope > .util-block')].map(b => { const r = b.getBoundingClientRect(); return { x: Math.round(r.left), top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
        const columns = [...new Set(blocks.map(b => b.x))].sort((a, b) => a - b);
        // Hueco vertical entre cajas seguidas de la misma columna (debe ser el margen, 22 px).
        const gaps = columns.flatMap(x => { const col = blocks.filter(b => b.x === x).sort((a, b) => a.top - b.top); return col.slice(1).map((b, i) => b.top - col[i].bottom); });
        const order = blocks.map((b, i) => i === 0 || b.x > blocks[i - 1].x || (b.x === blocks[i - 1].x && b.top > blocks[i - 1].top));
        return { columns: columns.length, maxGap: Math.max(0, ...gaps), order: order.every(Boolean), overflow: document.scrollingElement.scrollWidth > window.innerWidth + 1, blocks: blocks.length,
          wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).slice(-3).map(e => `${e.tagName}.${e.className} ${Math.round(e.getBoundingClientRect().right)}: ${(e.textContent || '').slice(0, 60)}`) };
      });
      measures.push({ width, path, ...r });
    }
    await context.close();
  }
  for (const m of measures) {
    assert.ok(!m.overflow, `${m.path} at ${m.width}: no horizontal overflow ${JSON.stringify(m.wide)}`);
    assert.ok(m.maxGap <= 24, `${m.path} at ${m.width}: no gaps between boxes (${m.maxGap} px)`);
    assert.ok(m.order, `${m.path} at ${m.width}: reading order kept (top to bottom, column by column)`);
    if (m.width === 390) assert.equal(m.columns, 1, `${m.path} on mobile: one column`);
    if (m.width >= 1024 && m.blocks >= 3) assert.ok(m.columns >= 2, `${m.path} at ${m.width}: several columns (${m.columns})`);
  }
  console.log(`MEDIDA: columnas de «Útil» por ancho: ${[1440, 1024, 768, 390].map(w => `${w} px → ${[...new Set(measures.filter(m => m.width === w).map(m => m.columns))].join('/')}`).join(', ')}`);
  passed('Útil layout: boxes in columns without gaps (CSS columns, reading order kept) on /util and the six concejos at 1440, 1024, 768 and 390 px, one column on mobile, no horizontal overflow');

  for (const doc of extra) await payload.delete({ collection: 'municipal-services', id: doc.id, overrideAccess: true });
  await ctx.activate(['lena', 'mieres']);
}
