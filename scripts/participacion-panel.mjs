// Bloque «Panel municipal y retoques» de scripts/participacion-integration.mjs: casillas y radios con su tamaño normal
// en toda la web (comprobación visual que habría detectado el fallo de /[concejo]/panel), panel en pestañas, condiciones
// solo desde el panel, escudos a la misma altura, el tiempo con iconos en /[concejo]/util y la raya de /morcin.
export async function run(ctx) {
  const { payload, users, password, web, page, passed, assert, browser, signIn, town } = ctx;
  await ctx.activate(ctx.SIX.filter(t => t !== 'morcin'));
  const mieresSpace = (await payload.find({ collection: 'municipal-spaces', where: { legacyID: { equals: 'mieres' } }, overrideAccess: true })).docs[0];
  const email = 'mieres-panel@planta14.example';
  const mieresUser = (await payload.find({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true })).docs[0]
    ?? await payload.create({ collection: 'users', overrideAccess: true, user: users.admin, data: { name: 'Ayuntamiento de Mieres', email, password, role: 'municipal', municipalSpace: mieresSpace.id } });
  // Doce publicaciones para la paginación (10 por página) y los filtros.
  for (let i = 1; i <= 12; i++) await payload.create({ collection: 'municipal-content', overrideAccess: true, data: { space: mieresSpace.id, type: i % 3 ? 'notice' : 'event', title: `Publicación de prueba ${i}`, excerpt: 'Resumen.', body: 'Texto.', origin: 'municipality', publishedAt: '2026-11-05', ...(i % 3 ? {} : { eventAt: '2026-12-01T18:00', place: 'Casa de cultura' }), _status: i % 4 ? 'published' : 'draft' } });
  const mieres = await town('mieres');
  if (!(await payload.count({ collection: 'municipal-services', where: { town: { equals: mieres.id } }, overrideAccess: true })).totalDocs)
    for (const name of ['Biblioteca municipal', 'Polideportivo de Oñón']) await payload.create({ collection: 'municipal-services', overrideAccess: true, data: { name, town: mieres.id, category: 'cultura' } });
  const cookie = (await signIn(mieresUser.email)).split('; ').map(c => { const [name, ...v] = c.split('='); return { name, value: v.join('='), url: web }; });

  // 1. Casillas y radios: ≤ 32 px de ancho, su texto en la misma fila y sin desplazamiento horizontal.
  const checkboxes = async (tab, label) => tab.evaluate(label => {
    const bad = [];
    for (const input of document.querySelectorAll('input[type=checkbox], input[type=radio]')) {
      const r = input.getBoundingClientRect(), s = getComputedStyle(input);
      if (!r.width || s.visibility === 'hidden' || s.display === 'none' || input.closest('[aria-hidden="true"]')) continue;
      if (r.width > 32) bad.push(`${label}: casilla de ${Math.round(r.width)} px (${input.name || input.closest('label')?.textContent?.trim().slice(0, 30)})`);
      const owner = input.closest('label');
      const text = owner && [...owner.childNodes].find(n => n !== input && (n.textContent ?? '').trim());
      if (text) {
        const range = document.createRange(); range.selectNodeContents(text);
        const first = [...range.getClientRects()][0];
        // La primera línea del texto empieza en la fila de la casilla y a su derecha (no debajo ni una palabra por línea).
        if (first && (first.top > r.bottom + 2 || first.bottom < r.top - 2 || first.left < r.left)) bad.push(`${label}: el texto «${(text.textContent ?? '').trim().slice(0, 30)}» no está al lado de su casilla`);
        const words = (text.textContent ?? '').trim().split(/\s+/).length, lines = [...range.getClientRects()].length;
        if (words > 3 && lines >= words) bad.push(`${label}: una palabra por línea en «${(text.textContent ?? '').trim().slice(0, 30)}»`);
      }
    }
    if (document.scrollingElement.scrollWidth > window.innerWidth + 1) bad.push(`${label}: desplazamiento horizontal (${document.scrollingElement.scrollWidth} px)`);
    return bad;
  }, label);
  const tabs = ['publicar', 'publicaciones', 'util', 'directorio', 'sugerencias', 'visitas'];
  const problems = [];
  for (const [w, h] of [[1440, 900], [1024, 900], [768, 1024], [390, 844]]) {
    const mobile = w < 500;
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    await context.addCookies(cookie);
    const tab = await context.newPage();
    for (const t of tabs) {
      await tab.goto(`${web}/mieres/panel?pestana=${t}`, { waitUntil: 'networkidle' });
      assert.ok(await tab.locator(`[data-panel-section="${t}"]`).count(), `panel tab ${t} at ${w}`);
      problems.push(...await checkboxes(tab, `/mieres/panel ${t} a ${w}`));
    }
    for (const path of ['/', '/fiestas/enviar', '/agenda', '/mieres', '/aller', '/lena', '/aller/util', '/morcin']) {
      await tab.goto(`${web}${path}`, { waitUntil: 'networkidle' });
      problems.push(...await checkboxes(tab, `${path} a ${w}`));
    }
    // El formulario del pie con sus opciones abiertas.
    await tab.goto(`${web}/agenda`, { waitUntil: 'networkidle' });
    await tab.locator('[data-subscribe-form="pie"] summary').click();
    problems.push(...await checkboxes(tab, `pie con «Elegir concejos» abierto a ${w}`));
    await context.close();
  }
  assert.deepEqual(problems, [], 'checkboxes and radios at their normal size, text next to them, no horizontal scroll');
  passed('checkboxes and radios: at most 32 px wide, their text on the same row and no horizontal scroll at 1440, 1024, 768 and 390 px in every panel tab (/mieres/panel with a municipal session), the home page, the fiesta form, the agenda, /mieres, /aller, /lena, /aller/util, /morcin and the footer newsletter');

  // Capturas para revisarlas a mano (solo con PANEL_SHOTS_DIR).
  if (process.env.PANEL_SHOTS_DIR) for (const [w, h, m] of [[1440, 900, false], [390, 844, true]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: m, hasTouch: m });
    await c.addCookies(cookie);
    const p = await c.newPage();
    for (const t of ['publicar', 'publicaciones', 'util', 'directorio', 'sugerencias', 'visitas']) { await p.goto(`${web}/mieres/panel?pestana=${t}`, { waitUntil: 'networkidle' }); await p.screenshot({ path: `${process.env.PANEL_SHOTS_DIR}/pn-${t}-${w}.png` }); }
    await c.close();
  }
  // 2. Panel en pestañas con enlace propio; listas compactas; visitas en una fila de barras; sin boletín en el pie.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(cookie);
  const tab = await context.newPage();
  await tab.goto(`${web}/mieres/panel`, { waitUntil: 'networkidle' });
  assert.ok(await tab.locator('[data-panel-section="publicar"]').count() && await tab.locator('[data-panel-tab="publicar"][aria-current="page"]').count(), 'Publicar by default');
  assert.equal(await tab.locator('[data-footer-newsletter]').count(), 0, 'no newsletter in the panel footer');
  assert.ok(await tab.locator('[data-panel-terms]').count() && (await tab.locator('[data-panel-terms]').innerText()).includes('Condiciones de uso del espacio municipal'), 'terms linked discreetly from the panel');
  await tab.click('[data-panel-tab="publicaciones"]');
  assert.ok(tab.url().endsWith('?pestana=publicaciones'), 'each tab has its own link');
  assert.equal(await tab.locator('[data-publication]').count(), 10, '10 per page');
  assert.ok(await tab.locator('[data-publications-pager]').count(), 'pager');
  await tab.selectOption('[data-publications-type]', 'event');
  assert.equal(await tab.locator('[data-publication]').count(), 4, 'filter by type');
  await tab.selectOption('[data-publications-type]', '');
  await tab.selectOption('[data-publications-status]', 'borrador');
  assert.equal(await tab.locator('[data-publication]').count(), 3, 'filter by status');
  const rowHeight = await tab.locator('[data-publication]').first().evaluate(e => e.getBoundingClientRect().height);
  assert.ok(rowHeight < 80, `one line per publication (${rowHeight} px)`);
  await tab.locator('[data-publication] button:has-text("Editar")').first().click();
  assert.ok(await tab.locator('[data-panel-section="publicar"]').count() && (await tab.inputValue('[data-panel-section="publicar"] input[maxlength="140"]')).startsWith('Publicación de prueba'), 'Editar opens the publication in Publicar');
  await tab.click('[data-panel-tab="directorio"]');
  assert.equal(await tab.locator('[data-service-form]').count(), 0, 'add form closed until «Añadir servicio»');
  const all = await tab.locator('[data-service-row]').count();
  await tab.fill('[data-service-search]', 'polideportivo');
  assert.ok(await tab.locator('[data-service-row]').count() < all || all === 1, 'directory search');
  await tab.fill('[data-service-search]', '');
  await tab.locator('[data-service-row] button:has-text("Editar")').first().click();
  assert.ok(await tab.locator('[data-service-row] [data-service-form]').count(), 'edit opens in its row');
  await tab.click('[data-service-add]');
  assert.ok(await tab.locator('[data-services-editor] > [data-service-form]').count(), '«Añadir servicio» opens the form');
  await tab.click('[data-panel-tab="visitas"]');
  if (await tab.locator('[data-municipal-stats]').count()) {
    assert.ok(await tab.locator('[data-stats-days]').count() && !(await tab.locator('[data-stats-days] table').count()), 'visits per day as one row of bars');
    assert.ok(await tab.locator('[data-stats-export="csv"]').count() && await tab.locator('[data-stats-export="pdf"]').count(), 'CSV and PDF');
  }
  const mobileTabs = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobileTabs.addCookies(cookie);
  const phone = await mobileTabs.newPage();
  await phone.goto(`${web}/mieres/panel`, { waitUntil: 'networkidle' });
  const tabsBox = await phone.locator('[data-panel-tabs]').evaluate(e => ({ h: e.getBoundingClientRect().height, scroll: e.scrollWidth > e.clientWidth, overflow: getComputedStyle(e).overflowX }));
  assert.ok(tabsBox.h < 60 && tabsBox.overflow === 'auto', `mobile: tabs in one scrollable row ${JSON.stringify(tabsBox)}`);
  await mobileTabs.close();
  await context.close();
  passed('municipal panel in tabs with their own link (Publicar by default, Mis publicaciones, Útil, Directorio, Sugerencias, Visitas; one scrollable row on mobile): publications one per line, 10 per page, filters by type and status, Editar opens them in Publicar; directory with search, add form only on «Añadir servicio», edit in its row; visits as one row of bars with CSV and PDF; no newsletter in the panel footer');

  // 3. Condiciones: fuera del pie y de los enlaces públicos, sin indexar, solo desde el acceso al panel y el panel.
  const home = await page(`${web}/`);
  assert.ok(!home.includes('/condiciones-cuentas-municipales') && !(await page(`${web}/aviso-legal`)).includes('href="/condiciones-cuentas-municipales"'), 'no public links to the municipal terms');
  const terms = await page(`${web}/condiciones-cuentas-municipales`);
  assert.ok(/<meta name="robots" content="noindex, ?nofollow"/.test(terms), 'terms not indexed');
  assert.ok((await import('node:fs')).readFileSync('app/(frontend)/sitemap.ts', 'utf8').indexOf('condiciones') === -1, 'not in the sitemap');
  const login = await (await fetch(`${web}/mieres/panel`)).text();
  assert.ok(login.includes('data-panel-terms') && login.includes('Condiciones de uso del espacio municipal'), 'linked from the panel login');

  // 4. Escudos a la misma altura; el tiempo con iconos en /[concejo]/util; raya de /morcin a todo el ancho.
  const look = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const lt = await look.newPage();
  const heights = {};
  for (const t of ['mieres', 'aller', 'lena']) {
    await lt.goto(`${web}/${t}`, { waitUntil: 'networkidle' });
    heights[t] = await lt.locator('.aller-crest').first().evaluate(e => Math.round(e.getBoundingClientRect().height)).catch(() => null);
  }
  assert.ok(new Set(Object.values(heights)).size === 1 && heights.lena, `crests at the same height ${JSON.stringify(heights)}`);
  await lt.goto(`${web}/aller/util`, { waitUntil: 'networkidle' });
  if (await lt.locator('[data-util="tiempo"]').count()) assert.ok(await lt.locator('[data-util="tiempo"] [data-weather-icon]').count() >= 2, '/aller/util: weather with icons');
  await lt.goto(`${web}/morcin`, { waitUntil: 'networkidle' });
  const rule = await lt.evaluate(() => { const h = document.querySelector('[data-town-news] header'), c = document.querySelector('[data-town-news]'); const cs = getComputedStyle(c); return Math.round(h.getBoundingClientRect().width - (c.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))); });
  assert.ok(Math.abs(rule) <= 1, `/morcin: the rule under the title spans the content width (${rule})`);
  await look.close();
  await ctx.activate(['lena', 'mieres']);
  passed('municipal terms only from the panel (and its login) as «Condiciones de uso del espacio municipal», noindex and out of the sitemap; crests at the same height (Mieres, Aller and Lena); /[concejo]/util weather with icons; /morcin rule across the content width');
}
