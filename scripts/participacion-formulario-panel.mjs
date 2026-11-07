// Bloque «Formulario y textos del panel» de scripts/participacion-integration.mjs: tipo por defecto «Noticias»; «Mostrar
// … hasta» solo en avisos y ayudas, separado de «2 Imagen»; contador también en el resumen; «Publicar ahora» sin ↗ y
// «Guardar como borrador» como botón secundario visible; nota legible (13 px o más, contraste AA); pantalla de acceso sin
// el «1» suelto y con «en el espacio del Ayuntamiento de …»; y filas iguales en «Publicado por los ayuntamientos».
export async function run(ctx) {
  const { payload, users, password, origin, passed, assert, browser, signIn } = ctx;
  await ctx.activate(['lena', 'mieres']);
  const mieres = (await payload.find({ collection: 'municipal-spaces', where: { legacyID: { equals: 'mieres' } }, overrideAccess: true })).docs[0];
  const email = 'mieres-formulario@planta14.example';
  const account = (await payload.find({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true })).docs[0]
    ?? await payload.create({ collection: 'users', overrideAccess: true, user: users.admin, data: { name: 'Ayuntamiento de Mieres (formulario)', email, password, role: 'municipal', municipalSpace: mieres.id } });
  // Contraste WCAG entre el color del texto y el fondo efectivo.
  const contrast = async locator => locator.evaluate(el => {
    const rgb = s => (s.match(/[\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    let bg = null, node = el; while (node && !bg) { const c = rgb(getComputedStyle(node).backgroundColor); if (c.length >= 3 && (c[3] ?? 1) > 0) bg = c; node = node.parentElement; }
    const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(bg || [255, 255, 255])];
    return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), size: parseFloat(getComputedStyle(el).fontSize) };
  });

  for (const [w, h] of [[1280, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
    const tab = await context.newPage();
    // 4. Pantalla de acceso: sin «1» suelto y con el espacio del ayuntamiento.
    await tab.goto(`${origin}/mieres/panel`, { waitUntil: 'load' });
    await tab.getByLabel('Contraseña', { exact: true }).waitFor();
    const intro = tab.locator('.municipal-panel-heading > p').first();
    const heading = (await intro.evaluate(el => el.innerHTML.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ''))).replace(/\s+/g, ' ');
    assert.ok(heading.includes('aparece al momento en el espacio del Ayuntamiento de Mieres'), `access text: ${heading} ${await intro.evaluate(el => getComputedStyle(el).display)}`);
    assert.equal(await tab.locator('form .municipal-step > span').count(), 0, 'no lone step number on the access screen');
    await tab.getByLabel('Correo electrónico', { exact: true }).fill(email);
    await tab.getByLabel('Contraseña', { exact: true }).fill(password);
    await tab.getByRole('button', { name: /^Entrar/ }).click();
    const form = tab.getByRole('form', { name: 'Publicación municipal' });
    await form.waitFor();
    // 2. Tipo por defecto «Noticias»; «Mostrar … hasta» solo en avisos y ayudas.
    const type = form.locator('select').first();
    assert.equal(await type.inputValue(), 'news', 'default type: Noticias');
    for (const [value, shown] of [['news', false], ['notice', true], ['event', false], ['grant', true], ['announcement', false]]) {
      await type.selectOption(value);
      assert.equal(await form.locator('[data-expires-field]').count(), shown ? 1 : 0, `«Mostrar … hasta» for ${value}`);
    }
    await type.selectOption('notice');
    assert.ok((await form.locator('[data-expires-field]').innerText()).startsWith('Mostrar el aviso hasta'), 'notice label');
    // Separación clara entre ese campo y «2 Imagen (opcional)».
    const gap = await tab.evaluate(() => {
      const field = document.querySelector('[data-expires-field]').getBoundingClientRect(), step = document.querySelector('.municipal-step.is-separated');
      return { gap: step.getBoundingClientRect().top - field.bottom, border: getComputedStyle(step).borderTopStyle };
    });
    assert.ok(gap.gap >= 24 && gap.border === 'solid', `separated from «2 Imagen» (${JSON.stringify(gap)})`);
    // Contador también en el resumen.
    await form.getByLabel(/^Resumen/).fill('Doce letras');
    assert.equal(await form.locator('[data-excerpt-count]').innerText(), '11/300 caracteres', 'excerpt counter');
    // 3. Botones y nota.
    const publish = form.getByRole('button', { name: 'Publicar ahora', exact: true });
    assert.equal((await publish.innerText()).trim(), 'Publicar ahora', '«Publicar ahora» without ↗');
    const draft = form.locator('[data-save-draft]');
    const box = await draft.boundingBox(), size = await draft.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    assert.ok(box.height >= 44 && box.width >= 150 && size >= 13 && (await draft.innerText()).trim() === 'Guardar como borrador', `draft button visible (${JSON.stringify({ ...box, size })})`);
    const note = await contrast(form.locator('[data-publish-note]'));
    assert.ok(note.size >= 13 && note.ratio >= 4.5, `publish note legible (${JSON.stringify(note)})`);
    for (const small of await form.locator('label > small').all()) {
      const c = await contrast(small);
      assert.ok(c.size >= 13 && c.ratio >= 4.5, `field help legible (${JSON.stringify(c)})`);
    }
    assert.equal(await tab.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1), false, `no horizontal scroll at ${w}`);
    if (process.env.PANEL_SHOTS_DIR) await form.screenshot({ path: `${process.env.PANEL_SHOTS_DIR}/formulario-${w}.png` });
    await context.close();
  }

  // 5. Bandeja: misma disposición en todas las filas de «Publicado por los ayuntamientos», sea cual sea el título.
  for (const title of ['Corte', 'Aviso de longitud media sobre el cierre de la piscina municipal', 'Un título muy largo, muy largo, que no cabe en una sola línea de la bandeja aunque la pantalla sea ancha y que antes rompía la disposición de la fila entera']) {
    await payload.create({ collection: 'municipal-content', user: account, overrideAccess: false, data: { space: mieres.id, type: 'notice', title, excerpt: 'Resumen.', body: 'Texto.', origin: 'municipality', publishedAt: '2026-11-07', _status: 'published' } });
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await context.addCookies((await signIn('velascolne@gmail.com')).split('; ').map(x => { const [name, ...v] = x.split('='); return { name, value: v.join('='), url: origin }; }));
  const tab = await context.newPage();
  await tab.goto(`${origin}/cms/bandeja?concejo=mieres`, { waitUntil: 'load' });
  await tab.locator('[data-publication-item]').first().waitFor();
  const rows = await tab.evaluate(() => [...document.querySelectorAll('[data-publication-item]')].map(li => {
    const r = sel => li.querySelector(sel).getBoundingClientRect();
    const one = r('[data-publication-line="1"]'), two = r('[data-publication-line="2"]'), actions = r('[data-publication-actions]');
    return { one: Math.round(one.height), below: two.top >= one.bottom - 1, right: Math.round(actions.right), actionsLeftOfText: actions.left >= one.right - 1, height: Math.round(li.getBoundingClientRect().height) };
  }));
  assert.ok(rows.length >= 3, 'rows');
  assert.ok(rows.every(r => r.below && r.actionsLeftOfText) && new Set(rows.map(r => r.one)).size === 1 && new Set(rows.map(r => r.right)).size === 1 && new Set(rows.map(r => r.height)).size === 1,
    `same layout in every row ${JSON.stringify(rows)}`);
  if (process.env.PANEL_SHOTS_DIR) await tab.screenshot({ path: `${process.env.PANEL_SHOTS_DIR}/bandeja-filas.png`, fullPage: true });
  await context.close();
  passed('panel form and texts: default type «Noticias»; «Mostrar … hasta» only for notices and grants, clearly separated from «2 Imagen»; character counter on the summary; «Publicar ahora» without ↗ and «Guardar como borrador» as a visible secondary button; notes at 13 px or more with AA contrast; access screen without the lone «1» and «en el espacio del Ayuntamiento de Mieres»; no horizontal scroll at 1280 and 390 px. Inbox: every «Publicado por los ayuntamientos» row has the same layout (type and title on one line, concejo, status and date below, actions on the right), whatever the title length');
}
