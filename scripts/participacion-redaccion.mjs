// Bloque «Redacción» de scripts/participacion-integration.mjs: «Mis concejos» en el CMS (filtrado por defecto por los
// concejos de cada periodista, sin restringir), retirar con motivo desde ahí y el correo al responsable por cada
// publicación nueva de su ayuntamiento, con la opción de no recibirlos en su perfil.
export async function run(ctx) {
  const { payload, users, password, web, origin, page, passed, assert, browser, signIn, mails } = ctx;
  await ctx.activate(['lena', 'mieres']);
  const space = async slug => (await payload.find({ collection: 'municipal-spaces', where: { legacyID: { equals: slug } }, overrideAccess: true })).docs[0];
  const lena = await space('lena'), mieres = await space('mieres');
  const municipal = async (s, email) => (await payload.find({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true })).docs[0]
    ?? payload.create({ collection: 'users', overrideAccess: true, user: users.admin, data: { name: `Ayuntamiento (${s.name})`, email, password, role: 'municipal', municipalSpace: s.id } });
  const lenaUser = await municipal(lena, 'lena-redaccion@planta14.example'), mieresUser = await municipal(mieres, 'mieres-redaccion@planta14.example');
  const publish = (user, s, title, type = 'notice') => payload.create({ collection: 'municipal-content', user, overrideAccess: false,
    data: { space: s.id, type, title, excerpt: 'Resumen.', body: 'Texto.', origin: 'municipality', publishedAt: '2026-11-06', ...(type === 'event' ? { eventAt: '2026-12-01T18:00', place: 'Casa de cultura' } : {}), _status: 'published' } });
  const toJuanfran = async title => (await mails()).filter(m => m.to === 'juansantospolalena@gmail.com' && m.subject.endsWith(`: ${title}`));

  // 15. Correo por publicación: título, tipo y enlace; uno solo aunque se despublique y se vuelva a publicar.
  const lenaItem = await publish(lenaUser, lena, 'Concierto de la banda en Pola de Lena', 'event');
  const mieresItem = await publish(mieresUser, mieres, 'Obras en la plaza de Requejo');
  let sent = await toJuanfran('Concierto de la banda en Pola de Lena');
  assert.equal(sent.length, 1, 'one email to the responsible of Lena');
  assert.ok(sent[0].text.includes('Tipo: Agenda') && sent[0].text.includes('Título: Concierto de la banda en Pola de Lena') && sent[0].text.includes('/lena?seccion=event'), sent[0].text);
  assert.equal((await toJuanfran('Obras en la plaza de Requejo')).length, 0, 'Mieres goes to Andrés, not to Juanfran');
  assert.ok((await mails()).some(m => m.to === 'velascolne@gmail.com' && m.subject.endsWith(': Obras en la plaza de Requejo')), 'Andrés gets Mieres');
  await payload.update({ collection: 'municipal-content', id: lenaItem.id, user: lenaUser, overrideAccess: false, data: { _status: 'draft' } });
  await payload.update({ collection: 'municipal-content', id: lenaItem.id, user: lenaUser, overrideAccess: false, data: { _status: 'published' } });
  assert.equal((await toJuanfran('Concierto de la banda en Pola de Lena')).length, 1, 'no second email when re-published');

  // Preferencia en el perfil: cada uno la suya (la administración, cualquiera); sin correo, el pendiente se crea igual.
  const juanfranCookie = await signIn('juansantospolalena@gmail.com'), andresCookie = await signIn('velascolne@gmail.com');
  const setPref = (cookie, id, value) => fetch(`${web}/api/cms/users/${id}/avisos-municipales`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', Origin: origin }, body: JSON.stringify({ value }) });
  assert.equal((await setPref(andresCookie, users.juanfran.id, false)).status, 403, 'a journalist cannot change another one');
  assert.equal((await setPref(juanfranCookie, users.juanfran.id, false)).status, 200);
  const quiet = await publish(lenaUser, lena, 'Cambio de horario de la biblioteca');
  assert.equal((await toJuanfran('Cambio de horario de la biblioteca')).length, 0, 'no email with the option off');
  const quietNotice = (await payload.find({ collection: 'notifications', where: { content: { equals: quiet.id } }, overrideAccess: true })).docs[0];
  assert.ok(quietNotice && quietNotice.emailStatus === 'disabled' && (quietNotice.assignedTo?.id ?? quietNotice.assignedTo) === users.juanfran.id, 'pending item still created');

  // El interruptor del perfil del CMS (/cms/account) lo vuelve a activar. El navegador entra por el origen del CMS
  // (CMS_SERVER_URL): Payload rechaza peticiones con cookie desde otro origen (CSRF).
  const cookies = cookie => cookie.split('; ').map(c => { const [name, ...v] = c.split('='); return { name, value: v.join('='), url: origin }; });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await context.addCookies(cookies(juanfranCookie));
  const tab = await context.newPage();
  await tab.goto(`${origin}/cms/account`, { waitUntil: 'networkidle' });
  const toggle = tab.locator('[data-notify-municipal]');
  assert.equal(await toggle.isChecked(), false, 'profile shows the option off');
  await toggle.check();
  await tab.getByText('Guardado.').waitFor();
  assert.equal((await payload.findByID({ collection: 'users', id: users.juanfran.id, overrideAccess: true })).notifyMunicipalPublications, true, 'option saved from the profile');
  await publish(lenaUser, lena, 'Ayudas para el comercio local', 'grant');
  assert.equal((await toJuanfran('Ayudas para el comercio local')).length, 1, 'emails again with the option on');

  // 14. «Mis concejos»: en el inicio, filtrado por los concejos de cada uno; «Todos» y cualquier concejo, también.
  await payload.create({ collection: 'suggestions', user: lenaUser, overrideAccess: false, data: { services: ['agenda'], text: 'Sugerencia de Lena para la redacción' } });
  const html = async (cookie, path) => (await (await fetch(`${web}${path}`, { headers: { Cookie: cookie, 'Sec-Fetch-Site': 'same-origin' } })).text()).replaceAll('<!-- -->', '');
  const juanfranHome = await html(juanfranCookie, '/cms'), andresHome = await html(andresCookie, '/cms');
  assert.ok(juanfranHome.includes('data-my-towns="mios"') && juanfranHome.includes('Ayudas para el comercio local') && !juanfranHome.includes('Obras en la plaza de Requejo') && juanfranHome.includes('Sugerencia de Lena para la redacción'), 'Juanfran home: Lena, not Mieres, with the suggestion');
  assert.ok(andresHome.includes('Obras en la plaza de Requejo') && !andresHome.includes('Ayudas para el comercio local') && !andresHome.includes('Sugerencia de Lena'), 'Andrés home: Mieres, not Lena');
  assert.ok(juanfranHome.includes('href="/cms/mis-concejos"'), 'link to the full view');
  const all = await html(juanfranCookie, '/cms/mis-concejos?concejo=todos');
  assert.ok(all.includes('data-my-towns="todos"') && all.includes('Obras en la plaza de Requejo') && all.includes('Ayudas para el comercio local'), 'filter removable: every concejo');
  const one = await html(andresCookie, '/cms/mis-concejos?concejo=lena');
  assert.ok(one.includes('Ayudas para el comercio local') && !one.includes('Obras en la plaza de Requejo') && !one.includes('Sugerencia de Lena'), 'another concejo; suggestions keep their access');
  assert.ok(all.includes('href="/mieres"') || all.includes('href="/mieres?seccion=notice"'), 'open it on the web');

  // Retirar con motivo desde «Mis concejos» (la retirada que ya existe: motivo obligatorio, fuera de la web).
  const before = await page(`${web}/mieres?seccion=notice`);
  assert.ok(before.includes('Obras en la plaza de Requejo'), 'published on the web');
  await tab.goto(`${origin}/cms/mis-concejos?concejo=mieres`, { waitUntil: 'networkidle' });
  await tab.locator(`[data-withdraw-open="${mieresItem.id}"]`).click();
  await tab.locator(`[data-withdraw-form="${mieresItem.id}"] [data-withdraw-submit]`).click();
  await tab.getByText('Indica el motivo de la retirada.').waitFor();
  await tab.locator(`[data-withdraw-form="${mieresItem.id}"] [data-withdraw-reason]`).fill('Incluye un teléfono particular');
  await tab.locator(`[data-withdraw-form="${mieresItem.id}"] [data-withdraw-submit]`).click();
  await tab.locator(`[data-my-towns-item="${mieresItem.id}"] [data-my-towns-status]`).filter({ hasText: 'Retirado: Incluye un teléfono particular' }).waitFor();
  const stored = await payload.findByID({ collection: 'municipal-content', id: mieresItem.id, overrideAccess: true });
  assert.ok(stored.withdrawal.withdrawn && stored.withdrawal.reason === 'Incluye un teléfono particular' && (stored.withdrawal.withdrawnBy?.id ?? stored.withdrawal.withdrawnBy) === users.juanfran.id, 'withdrawn with reason and author');
  assert.ok(!(await page(`${web}/mieres?seccion=notice`)).includes('Obras en la plaza de Requejo'), 'gone from the web');
  const audit = await payload.find({ collection: 'audit-log', where: { and: [{ action: { equals: 'withdraw' } }, { documentID: { equals: String(mieresItem.id) } }] }, overrideAccess: true });
  assert.equal(audit.totalDocs, 1, 'withdrawal in the audit log');
  if (process.env.PANEL_SHOTS_DIR) { await tab.screenshot({ path: `${process.env.PANEL_SHOTS_DIR}/mis-concejos.png`, fullPage: true }); await tab.goto(`${origin}/cms`, { waitUntil: 'networkidle' }); await tab.screenshot({ path: `${process.env.PANEL_SHOTS_DIR}/cms-inicio.png`, fullPage: true }); await tab.goto(`${origin}/cms/account`, { waitUntil: 'networkidle' }); await tab.screenshot({ path: `${process.env.PANEL_SHOTS_DIR}/perfil.png` }); }
  await context.close();
  passed('«Mis concejos» in the CMS: each journalist sees on entering the latest municipal publications (with their status) and the suggestions of their concejos (Juanfran: Lena; Andrés: Mieres), a default filter that can be removed (all or any concejo); open on the web and withdraw with a mandatory reason from there (off the web, audited). One email to the responsible per new municipal publication (title, type, web link; not repeated when re-published), with an option in the CMS profile to stop them (own only; the pending item is still created)');
}
