// Bloque «Estadísticas propias» de scripts/participacion-integration.mjs.
export async function run(ctx) {
  const { payload, users, web, origin, passed, assert, browser, signIn, password } = ctx;
  const { sql } = await import('@payloadcms/db-postgres');
  const rows = async () => (await payload.db.drizzle.execute(sql`SELECT path, town, section, source, views FROM stats_daily ORDER BY path, source`)).rows;
  const views = async where => (await rows()).filter(where).reduce((a, r) => a + r.views, 0);
  const waitFor = async (check, label) => { for (let i = 0; i < 60; i++) { if (await check()) return; await new Promise(r => setTimeout(r, 250)); } assert.fail(label); };
  await payload.db.drizzle.execute(sql`DELETE FROM stats_daily`);
  const columns = (await payload.db.drizzle.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'stats_daily' ORDER BY ordinal_position`)).rows.map(r => r.column_name);
  assert.deepEqual(columns, ['day', 'path', 'town', 'section', 'source', 'views'], 'only aggregated counters: no IP, browser or identifiers');

  // Visitas de personas (navegador normal): portada, concejo, noticia desde Google y desde WhatsApp.
  const human = { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' };
  const context = await browser.newContext(human);
  const tab = await context.newPage();
  let article = (await payload.find({ collection: 'articles', where: { _status: { equals: 'published' } }, limit: 1, depth: 1, overrideAccess: true })).docs[0];
  if (!article) {
    const author = await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'Redacción estadísticas', slug: 'redaccion-estadisticas' } });
    const town = (await payload.find({ collection: 'towns', where: { slug: { equals: 'lena' } }, overrideAccess: true })).docs[0];
    const section = (await payload.find({ collection: 'sections', where: { slug: { equals: 'sociedad' } }, overrideAccess: true })).docs[0];
    const created = await payload.create({ collection: 'articles', overrideAccess: true, data: { title: 'Noticia para las estadísticas', excerpt: 'Entradilla.', body: ['Texto.'], author: author.id, town: town.id, section: section.id, _status: 'published' } });
    article = await payload.findByID({ collection: 'articles', id: created.id, depth: 1, overrideAccess: true });
  }
  await tab.goto(`${web}/`);
  await waitFor(async () => (await views(r => r.path === '/')) === 1, 'home counted');
  await tab.goto(`${web}/lena`);
  await waitFor(async () => (await views(r => r.path === '/lena' && r.town === 'lena')) === 1, 'concejo page counted with its town');
  await tab.goto(`${web}/noticia/${article.slug}`, { referer: 'https://www.google.es/' });
  await waitFor(async () => (await views(r => r.path === `/noticia/${article.slug}` && r.source === 'buscadores' && r.town === article.town.slug && r.section === article.section.slug)) === 1, 'article from a search engine, with town and section');
  await tab.goto(`${web}/noticia/${article.slug}?utm_source=whatsapp`);
  await waitFor(async () => (await views(r => r.source === 'whatsapp')) === 1, 'WhatsApp (utm_source of the share button)');
  await tab.goto(`${web}/fiestas`, { referer: 'https://www.facebook.com/' });
  await waitFor(async () => (await views(r => r.path === '/fiestas' && r.source === 'redes')) === 1, 'social networks');
  assert.deepEqual(await context.cookies(), [], 'no cookies');
  await context.close();
  const before = await views(() => true);
  // No cuentan: robots, personas con sesión en el CMS, zonas privadas, rutas no válidas.
  const beacon = (body, headers = {}) => fetch(`${web}/api/v`, { method: 'POST', headers: { 'User-Agent': human.userAgent, ...headers }, body: JSON.stringify(body) });
  assert.equal((await beacon({ p: '/' }, { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' })).status, 204);
  await beacon({ p: '/' }, { 'User-Agent': 'WhatsApp/2.23.20.0' });
  await beacon({ p: '/' }, { Cookie: await signIn(users.editor.email) });
  for (const p of ['/cms', '/lena/panel', '/api/cms/users', '/vista-previa/noticia/1', '/boletin/confirmar', 'https://evil.example/']) await beacon({ p });
  await beacon({ p: '/', t: 'gijon', s: '<script>' });
  assert.equal(await views(() => true), before + 1, 'only the last one counts (with town and section discarded)');
  // Que no frene: la respuesta es inmediata.
  const times = [];
  for (let i = 0; i < 20; i++) { const t = performance.now(); await beacon({ p: '/medida' }); times.push(performance.now() - t); }
  times.sort((a, b) => a - b);
  console.log(`MEDIDA: baliza de estadísticas: mediana ${times[10].toFixed(1)} ms, p95 ${times[18].toFixed(1)} ms (respuesta 204; el navegador la envía con sendBeacon cuando está libre)`);
  assert.ok(times[18] < 250, 'fast');
  passed('own statistics: page views per page, concejo, section, day and source (search engines, social networks, WhatsApp, direct) without cookies, IP or identifiers; bots, link previews, CMS sessions and private areas are not counted; the beacon answers at once (sendBeacon when idle)');

  // Panel del CMS (administración) y exportaciones.
  const adminCookie = await signIn(users.admin.email);
  const as = cookie => ({ headers: { Cookie: cookie, 'Sec-Fetch-Site': 'same-origin' } });
  const admin = await browser.newContext();
  await admin.addCookies(adminCookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: origin }; }));
  const cms = await admin.newPage();
  await cms.goto(`${origin}/cms/estadisticas`);
  await cms.locator('[data-stats-total]').waitFor();
  const total = Number((await cms.locator('[data-stats-total]').innerText()).replace(/\D/g, ''));
  assert.equal(total, await views(() => true), 'CMS panel total');
  for (const source of ['buscadores', 'whatsapp', 'redes', 'directo']) assert.ok(await cms.locator(`[data-stats-source="${source}"]`).count(), `source ${source}`);
  await cms.goto(`${origin}/cms/estadisticas?concejo=lena`);
  assert.equal(Number((await cms.locator('[data-stats-total]').innerText()).replace(/\D/g, '')), await views(r => r.town === 'lena'), 'filter by concejo');
  await admin.close();
  const editorPage = await (await fetch(`${web}/cms/estadisticas`, as(await signIn(users.editor.email)))).text();
  assert.ok(editorPage.includes('Solo la administración ve las estadísticas') && !editorPage.includes('data-stats-total'), 'editors do not see it');
  const csvBytes = Buffer.from(await (await fetch(`${web}/api/estadisticas?formato=csv`, as(adminCookie))).arrayBuffer());
  const csv = csvBytes.toString('utf8');
  assert.ok(csvBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), 'CSV with BOM (opens in Excel)');
  assert.ok(csv.includes('"Planta 14 · visitas";"Todos los concejos"') && csv.includes('"WhatsApp";"1"') && csv.includes('"/lena";"1"'), `monthly CSV: ${csv.slice(0, 400)}`);
  const pdf = Buffer.from(await (await fetch(`${web}/api/estadisticas?formato=pdf&concejo=lena`, as(adminCookie))).arrayBuffer());
  assert.ok(pdf.subarray(0, 8).toString('latin1') === '%PDF-1.4' && pdf.toString('latin1').includes('(Visitas \\267 Lena') && pdf.toString('latin1').trimEnd().endsWith('%%EOF'), 'monthly PDF');
  assert.equal((await fetch(`${web}/api/estadisticas?formato=csv`)).status, 401, 'anonymous');
  assert.equal((await fetch(`${web}/api/estadisticas?formato=csv`, as(await signIn(users.editor.email)))).status, 403, 'editor');
  passed('statistics panel in the CMS (/cms/estadisticas, administration only): visits per day, most viewed pages, sources, concejos and sections, by month and concejo; monthly CSV and simple PDF');

  // Panel municipal: solo su concejo, también en las exportaciones.
  await payload.update({ collection: 'users', id: users.lena.id, overrideAccess: true, data: { password } });
  const lenaCookie = await signIn(users.lena.email);
  const lenaCSV = await (await fetch(`${web}/api/estadisticas?formato=csv&concejo=mieres`, as(lenaCookie))).text();
  assert.ok(lenaCSV.includes('"Lena"') && lenaCSV.includes('"/lena";"1"') && !lenaCSV.includes('"/fiestas"') && !lenaCSV.includes('"/";'), 'municipal export: only its concejo');
  const panel = await browser.newContext();
  await panel.addCookies(lenaCookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: origin }; }));
  const lena = await panel.newPage();
  await lena.goto(`${origin}/lena/panel`);
  await lena.locator('[data-municipal-stats] [data-stats-total]').waitFor();
  assert.equal(Number((await lena.locator('[data-municipal-stats] [data-stats-total]').innerText()).replace(/\D/g, '')), await views(r => r.town === 'lena'), 'municipal panel: own concejo');
  assert.equal(await lena.locator('[data-municipal-stats] [data-stats-export="pdf"]').count(), 1);
  await panel.close();
  passed('municipal panel: each town hall sees only its concejo\'s visits (also in the CSV/PDF export, whatever it asks for)');
}
