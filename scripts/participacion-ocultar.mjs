// Bloque «Ocultar servicios de Útil por concejo» de scripts/participacion-integration.mjs (usa las fichas que deja el
// bloque util: Santa Cristina en Lena, Bustiello en Mieres…). Las fuentes automáticas no responden aquí: da igual.
export async function run(ctx) {
  const { payload, users, web, origin, passed, assert, browser, signIn, password, page } = ctx;
  const block = (html, id) => html.split(`data-util="${id}"`)[1]?.split('</section>')[0] ?? null;
  const town = async slug => (await payload.find({ collection: 'towns', where: { slug: { equals: slug } }, overrideAccess: true })).docs[0];
  const [lenaTown, mieresTown] = [await town('lena'), await town('mieres')];
  await payload.update({ collection: 'users', id: users.lena.id, overrideAccess: true, data: { password } });
  const lenaCookie = await signIn(users.lena.email);
  const post = (cookie, body) => fetch(`${web}/api/cms/util-visibility/concejo`, { method: 'POST', headers: { ...(cookie ? { Cookie: cookie } : {}), 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // Por defecto, todo sale.
  const before = await page(`${web}/lena`);
  for (const id of ['farmacias', 'patrimonio', 'rutas', 'subvenciones', 'empleo', 'servicios']) assert.ok(block(before, id) !== null, `by default ${id} is shown`);

  // El ayuntamiento oculta dos servicios desde su panel (navegador real).
  const panel = await browser.newContext();
  await panel.addCookies(lenaCookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: origin }; }));
  const tab = await panel.newPage();
  await tab.goto(`${origin}/lena/panel`);
  const form = tab.locator('[data-util-visibility]');
  await form.waitFor();
  assert.equal(await form.locator('input[type=checkbox]:checked').count(), 8, 'all services shown by default');
  await form.getByLabel('Patrimonio').uncheck();
  await form.getByLabel('Farmacias de guardia').uncheck();
  await form.getByRole('button', { name: 'Guardar ↗' }).click();
  await form.getByText('Guardado. Los servicios desmarcados ya no salen en tu concejo.').waitFor();
  const lena = await page(`${web}/lena`);
  assert.ok(block(lena, 'patrimonio') === null && block(lena, 'farmacias') === null && block(lena, 'rutas') !== null && block(lena, 'empleo') !== null, 'hidden on the concejo page');
  assert.ok(lena.includes('data-municipal-util') && lena.includes('municipal-section-heading'), 'the rest of the concejo page (news, editorial) is untouched');
  const util = await page(`${web}/util`);
  assert.ok(!block(util, 'patrimonio').includes('Santa Cristina') && block(util, 'patrimonio').includes('Bustiello') && block(util, 'farmacias') !== null, '/util: only Lena items are removed');
  assert.ok(!(await page(`${web}/util/patrimonio`)).includes('Santa Cristina') && (await page(`${web}/util/patrimonio`)).includes('Bustiello'), 'heritage list too');
  assert.ok(block(await page(`${web}/mieres`), 'farmacias') !== null, 'other concejos keep everything');
  // Lo vuelve a mostrar.
  await tab.reload();
  await form.waitFor();
  assert.equal(await form.locator('input[type=checkbox]:checked').count(), 6, 'the panel remembers the choice');
  await form.getByLabel('Patrimonio').check();
  await form.getByRole('button', { name: 'Guardar ↗' }).click();
  await form.getByText('Guardado.', { exact: false }).waitFor();
  assert.ok(block(await page(`${web}/lena`), 'patrimonio') !== null, 'shown again');
  await panel.close();

  // Reglas del servidor: solo su concejo, solo claves válidas, solo con el espacio activo; nadie más que la administración.
  assert.equal((await post(lenaCookie, { hidden: ['empleo'], town: mieresTown.id })).status, 200);
  const docs = (await payload.find({ collection: 'util-visibility', depth: 1, overrideAccess: true, pagination: false })).docs;
  assert.deepEqual(docs.map(d => [d.town.slug, d.hidden]), [['lena', ['empleo']]], 'a town hall only changes its own concejo');
  assert.equal((await post(lenaCookie, { hidden: ['noticias'] })).status, 400, 'news and editorial content cannot be hidden');
  assert.equal((await post(await signIn(users.editor.email), { hidden: [] })).status, 403, 'journalists cannot');
  assert.equal((await post(null, { hidden: [] })).status, 401, 'anonymous');
  assert.equal((await fetch(`${web}/api/cms/util-visibility`, { method: 'POST', headers: { Cookie: lenaCookie, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }, body: JSON.stringify({ town: lenaTown.id, hidden: [] }) })).status, 403, 'not through the generic API');
  const lenaSpace = (await payload.find({ collection: 'municipal-spaces', where: { legacyID: { equals: 'lena' } }, overrideAccess: true })).docs[0];
  const subscription = lenaSpace.subscription;
  await payload.update({ collection: 'municipal-spaces', id: lenaSpace.id, overrideAccess: true, data: { subscription: { ...subscription, status: 'inactive' } } });
  const inactive = await post(lenaCookie, { hidden: [] });
  assert.ok(inactive.status === 403 && (await inactive.json()).error.includes('lo decide la administración'), 'inactive space: the administration decides');
  await payload.update({ collection: 'municipal-spaces', id: lenaSpace.id, overrideAccess: true, data: { subscription } });
  // La administración decide en los concejos sin espacio activo (aquí, Riosa).
  const adminCookie = await signIn(users.admin.email);
  const riosa = await town('riosa');
  assert.equal((await post(adminCookie, { hidden: ['rutas', 'empleo'], town: riosa.id })).status, 200);
  const riosaPage = await page(`${web}/riosa`);
  assert.ok(block(riosaPage, 'rutas') === null && block(riosaPage, 'empleo') === null && block(riosaPage, 'subvenciones') !== null, 'administration choice applied');
  assert.ok(!block(await page(`${web}/util`), 'empleo').includes('ayuntamientoriosa.com'), '/util drops that concejo link');
  await post(adminCookie, { hidden: [], town: riosa.id }); await post(lenaCookie, { hidden: [] });
  passed('Útil per concejo: every service is shown by default; a town hall hides any of them in its concejo from its panel (only its own, only Útil services, only with an active space; also removed from /util), the administration decides for concejos without an active municipal space; journalists and anonymous visitors cannot');
}
