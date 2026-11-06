// Bloque «Redacción» de scripts/participacion-integration.mjs (redactores a tiempo parcial: todo desde un solo sitio y
// sin avisos por lo que no requiere acción): concejo obligatorio con «Caudal» para lo comarcal; bandeja compartida
// «Pendiente de revisar» (lo de tus concejos primero, publicar/aprobar o rechazar con motivo de una lista editable, quién
// y cuándo); aviso inmediato solo al responsable, o al otro redactor si está «Fuera hasta»; resumen diario de las 8:00.
export async function run(ctx) {
  const { payload, users, password, web, origin, page, passed, assert, browser, signIn, mails } = ctx;
  const { createPendingNotice } = await import('../cms/responsables.ts');
  const { sendDailyDigests, dailyDigestTick, madridDay, DEFAULT_REJECTION_REASONS } = await import('../cms/newsroom.ts');
  await ctx.activate(['lena', 'mieres']);
  const find = async (collection, where) => (await payload.find({ collection, where, overrideAccess: true, depth: 0, pagination: false })).docs;
  const space = async slug => (await find('municipal-spaces', { legacyID: { equals: slug } }))[0];
  const town = async slug => (await find('towns', { slug: { equals: slug } }))[0];
  const lena = await space('lena');
  const municipal = async (s, email) => (await find('users', { email: { equals: email } }))[0]
    ?? payload.create({ collection: 'users', overrideAccess: true, user: users.admin, data: { name: `Ayuntamiento (${s.name})`, email, password, role: 'municipal', municipalSpace: s.id } });
  const lenaUser = await municipal(lena, 'lena-redaccion@planta14.example');
  const mailsTo = async (to, text) => (await mails()).filter(m => m.to === to && (m.subject + m.text).includes(text));
  const JUANFRAN = 'juansantospolalena@gmail.com', ANDRES = 'velascolne@gmail.com';
  const day = madridDay(), inDays = n => madridDay(new Date(Date.now() + n * 86400_000));

  // 14. Concejo obligatorio, con «Caudal» para lo comarcal (concejo oculto: sin página ni navegación).
  const caudal = await town('caudal');
  assert.ok(caudal && caudal.visible === false, 'Caudal exists and is hidden');
  const fiestaForm = await page(`${web}/fiestas/enviar`);
  assert.ok(/<select name="town" required/.test(fiestaForm) && fiestaForm.includes('value="caudal"'), 'public fiesta form: concejo required, with Caudal');
  assert.ok(!(await page(`${web}/`)).includes('href="/caudal"'), 'Caudal is not in the navigation');
  const section = (await find('sections', {}))[0] ?? await payload.create({ collection: 'sections', overrideAccess: true, data: { slug: 'sociedad', name: 'Sociedad' } });
  const author = (await find('authors', {}))[0] ?? await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'Redacción de prueba', slug: 'redaccion-prueba' } });
  await assert.rejects(payload.create({ collection: 'articles', overrideAccess: true, data: { title: 'Sin concejo', excerpt: 'x', body: ['x'], author: author.id, section: section.id, publishedAt: new Date().toISOString(), _status: 'published' } }), 'an article needs a concejo');
  const comarcal = await payload.create({ collection: 'articles', overrideAccess: true, data: { title: 'La comarca pide un tren mejor', excerpt: 'Comarcal.', body: ['Texto.'], author: author.id, town: caudal.id, section: section.id, publishedAt: new Date().toISOString(), _status: 'published' } });
  assert.ok((await page(`${web}/noticia/${comarcal.slug}`)).includes('Caudal'), 'a comarcal article reads «Caudal»');

  // 16. Aviso inmediato solo para lo que requiere intervención, al responsable del concejo, con enlace a la bandeja.
  const before = (await mails()).length;
  await payload.create({ collection: 'municipal-content', user: lenaUser, overrideAccess: false, data: { space: lena.id, type: 'event', title: 'Concierto de la banda en Pola de Lena', excerpt: 'Resumen.', body: 'Texto.', origin: 'municipality', publishedAt: day, eventAt: '2026-12-01T18:00', place: 'Casa de cultura', _status: 'published' } });
  assert.equal((await mails()).slice(before).length, 0, 'a municipal publication sends no email');
  const s1 = await payload.create({ collection: 'suggestions', user: lenaUser, overrideAccess: false, data: { services: ['agenda'], text: 'Primera sugerencia de prueba de la redacción' } });
  const n1 = (await find('notifications', { suggestion: { equals: s1.id } }))[0];
  const m1 = await mailsTo(JUANFRAN, 'Primera sugerencia de prueba');
  assert.ok(m1.length === 1 && m1[0].text.includes(`/cms/bandeja?pendiente=${n1.id}`) && !(await mailsTo(ANDRES, 'Primera sugerencia de prueba')).length, 'only the responsible, with a direct link');

  // «Fuera hasta»: el aviso va al otro redactor hasta esa fecha (cada uno cambia el suyo).
  const juanfranCookie = await signIn(JUANFRAN), andresCookie = await signIn(ANDRES);
  const prefs = (cookie, id, body) => fetch(`${web}/api/cms/users/${id}/preferencias`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', Origin: origin }, body: JSON.stringify(body) });
  assert.equal((await prefs(andresCookie, users.juanfran.id, { awayUntil: inDays(3) })).status, 403, 'only your own');
  assert.equal((await prefs(juanfranCookie, users.juanfran.id, { awayUntil: 'mañana' })).status, 400, 'a valid date');
  assert.equal((await prefs(juanfranCookie, users.juanfran.id, { awayUntil: inDays(3) })).status, 200);
  const s2 = await payload.create({ collection: 'suggestions', user: lenaUser, overrideAccess: false, data: { services: ['boletin'], text: 'Segunda sugerencia con Juanfran fuera' } });
  const m2 = await mailsTo(ANDRES, 'Segunda sugerencia con Juanfran fuera');
  assert.ok(m2.length === 1 && m2[0].text.includes('está fuera hasta el') && !(await mailsTo(JUANFRAN, 'Segunda sugerencia con Juanfran fuera')).length, 'away: to the other journalist');
  // Lo comarcal (Caudal, sin responsable): a los redactores presentes.
  const fiesta = await payload.create({ collection: 'festivals', overrideAccess: true, draft: true, data: { name: 'Ruta comarcal de prueba', village: 'Varios pueblos', town: caudal.id, startDate: '2026-12-12T12:00:00.000Z', endDate: '2026-12-13T12:00:00.000Z', dateStatus: 'confirmada', origin: 'publico', _status: 'draft' } });
  const n3 = await createPendingNotice(payload, undefined, { kind: 'festival-submission', title: 'Fiesta enviada: Ruta comarcal de prueba (Varios pueblos)', townID: caudal.id, townName: 'Caudal', detail: 'Enviada desde la web.', data: { festival: fiesta.id } });
  assert.ok((await mailsTo(ANDRES, 'Ruta comarcal de prueba')).length === 1 && !(await mailsTo(JUANFRAN, 'Ruta comarcal de prueba')).length, 'Caudal: to the journalists present');
  assert.equal((await prefs(juanfranCookie, users.juanfran.id, { awayUntil: null })).status, 200, 'back');

  // 15. Bandeja compartida: lo de tus concejos primero, con concejo y responsable; aprobar o rechazar en un clic.
  const cookies = cookie => cookie.split('; ').map(c => { const [name, ...v] = c.split('='); return { name, value: v.join('='), url: origin }; });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await context.addCookies(cookies(andresCookie));
  const tab = await context.newPage();
  // El navegador entra por el origen del CMS (CMS_SERVER_URL): Payload rechaza peticiones con cookie desde otro (CSRF).
  await tab.goto(`${origin}/cms/bandeja?pendiente=${n3.id}`, { waitUntil: 'networkidle' });
  const groups = await tab.evaluate(() => [...document.querySelectorAll('[data-inbox="full"] h3')].map(h => ({ title: h.textContent, ids: [...(h.nextElementSibling?.querySelectorAll('[data-inbox-item]') ?? [])].map(li => Number(li.getAttribute('data-inbox-item'))) })));
  const ownGroup = groups.find(g => g.title === 'De tus concejos'), otherGroup = groups.find(g => g.title === 'Del resto de concejos');
  assert.ok(ownGroup.ids.includes(n3.id) && !ownGroup.ids.includes(n1.id) && otherGroup.ids.includes(n1.id), `Andrés: Caudal first, Lena below (${JSON.stringify(groups)})`);
  const lenaRow = tab.locator(`[data-inbox-item="${n1.id}"]`);
  assert.equal(await lenaRow.locator('[data-inbox-town]').innerText(), 'Lena');
  assert.equal(await lenaRow.locator('[data-inbox-responsible]').innerText(), 'Juanfran Santos');
  assert.ok(await tab.locator(`#pendiente-${n3.id}`).evaluate(el => getComputedStyle(el).outlineStyle !== 'none'), 'the emailed item is highlighted');
  // Publicar la fiesta comarcal (Andrés no es su responsable: cualquiera puede resolver).
  await tab.locator(`[data-inbox-item="${n3.id}"] [data-inbox-approve]`).click();
  await tab.locator(`[data-inbox-resolved="${n3.id}"]`).waitFor();
  assert.equal((await payload.findByID({ collection: 'festivals', id: fiesta.id, overrideAccess: true })).
    _status, 'published', 'the fiesta is published');
  assert.ok((await tab.locator(`[data-inbox-resolved="${n3.id}"]`).innerText()).includes('Aprobado') && (await tab.locator(`[data-inbox-resolved="${n3.id}"] [data-inbox-resolved-by]`).innerText()) === 'Andrés', 'who resolved it');
  // Rechazar la sugerencia de Lena con un motivo de la lista y una nota.
  await lenaRow.locator('[data-inbox-reject]').click();
  assert.ok(await lenaRow.locator('[data-inbox-reject-confirm]').isDisabled(), 'a reason is required');
  await lenaRow.locator('[data-inbox-reason]').selectOption(DEFAULT_REJECTION_REASONS[2]);
  await lenaRow.locator('[data-inbox-note]').fill('Necesitamos el programa');
  await lenaRow.locator('[data-inbox-reject-confirm]').click();
  await tab.locator(`[data-inbox-resolved="${n1.id}"]`).waitFor();
  const r1 = await payload.findByID({ collection: 'notifications', id: n1.id, overrideAccess: true, depth: 0 });
  assert.ok(r1.reviewed && r1.decision === 'rechazado' && r1.rejectReason === DEFAULT_REJECTION_REASONS[2] && r1.rejectNote === 'Necesitamos el programa' && r1.resolvedBy === users.andres.id && r1.resolvedAt, 'rejected with reason, note, who and when');
  // Ya resuelto: lo dice. Motivo fuera de la lista: no.
  const resolve = (cookie, id, body) => fetch(`${web}/api/cms/notifications/${id}/resolver`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', Origin: origin }, body: JSON.stringify(body) });
  const again = await resolve(juanfranCookie, n1.id, { action: 'aprobar' });
  assert.ok(again.status === 409 && (await again.json()).error === 'Ya lo resolvió Andrés.', 'already resolved, by whom');
  const n2 = (await find('notifications', { suggestion: { equals: s2.id } }))[0];
  assert.equal((await resolve(juanfranCookie, n2.id, { action: 'rechazar', reason: 'Porque no' })).status, 400, 'reasons come from the list');
  assert.equal((await fetch(`${web}/api/cms/notifications/${n2.id}/resolver`, { method: 'POST', body: '{}' })).status, 403, 'newsroom only');
  // Lista editable (administración): el motivo nuevo sale en la bandeja.
  await payload.updateGlobal({ slug: 'newsroom-settings', overrideAccess: true, data: { rejectionReasons: [...DEFAULT_REJECTION_REASONS, 'Ya lo cubrimos con una noticia'].map(reason => ({ reason })) } });
  await tab.reload({ waitUntil: 'networkidle' });
  await tab.locator(`[data-inbox-item="${n2.id}"] [data-inbox-reject]`).click();
  assert.ok((await tab.locator(`[data-inbox-item="${n2.id}"] [data-inbox-reason] option`).allInnerTexts()).includes('Ya lo cubrimos con una noticia'), 'editable list of reasons');
  assert.equal((await resolve(juanfranCookie, n2.id, { action: 'aprobar' })).status, 200, 'suggestion attended');
  // Cartas (si se reactivan): publicar o rechazar desde la bandeja; el motivo, con la nota, llega al autor.
  const lettersWere = (await payload.findGlobal({ slug: 'letters-settings', overrideAccess: true })).active;
  await payload.updateGlobal({ slug: 'letters-settings', overrideAccess: true, data: { active: true } });
  const letter = await payload.create({ collection: 'letters', overrideAccess: true, context: { system: true }, data: { status: 'pendiente', text: 'Carta de prueba para la bandeja.', firstName: 'Rosa', lastName: 'Prueba', town: caudal.id, email: 'rosa-carta@example.org' } });
  const n4 = await createPendingNotice(payload, undefined, { kind: 'letter-submission', title: 'Carta de Rosa Prueba (Caudal)', townID: caudal.id, detail: 'Carta.', data: { letter: letter.id } });
  assert.equal((await resolve(juanfranCookie, n4.id, { action: 'rechazar', reason: DEFAULT_REJECTION_REASONS[3], note: 'Supera la extensión' })).status, 200);
  const rejected = await payload.findByID({ collection: 'letters', id: letter.id, overrideAccess: true });
  assert.ok(rejected.status === 'rechazada' && rejected.rejectionReason === `${DEFAULT_REJECTION_REASONS[3]}. Supera la extensión`, 'letter rejected with the reason');
  assert.ok((await mailsTo('rosa-carta@example.org', 'Supera la extensión')).length === 1, 'the author gets the reason');
  await payload.updateGlobal({ slug: 'letters-settings', overrideAccess: true, data: { active: Boolean(lettersWere) } });
  if (process.env.PANEL_SHOTS_DIR) { await tab.reload({ waitUntil: 'networkidle' }); await tab.screenshot({ path: `${process.env.PANEL_SHOTS_DIR}/bandeja.png`, fullPage: true }); }

  // Perfil: resumen diario y «Fuera hasta» (cada uno el suyo, sin «Guardar»).
  await context.clearCookies(); await context.addCookies(cookies(juanfranCookie));
  await tab.goto(`${origin}/cms/account`, { waitUntil: 'networkidle' });
  assert.ok(await tab.locator('[data-daily-digest]').isChecked(), 'daily summary on by default');
  await tab.locator('[data-away-until]').fill(inDays(5));
  await tab.locator('[data-away-save]').click();
  await tab.getByText('Guardado.').waitFor();
  assert.equal((await payload.findByID({ collection: 'users', id: users.juanfran.id, overrideAccess: true })).awayUntil, inDays(5), 'away date saved from the profile');
  if (process.env.PANEL_SHOTS_DIR) await tab.screenshot({ path: `${process.env.PANEL_SHOTS_DIR}/perfil.png` });
  await tab.locator('[data-away-clear]').click();
  await tab.getByText('Guardado.').waitFor();
  assert.equal((await payload.findByID({ collection: 'users', id: users.juanfran.id, overrideAccess: true })).awayUntil ?? null, null, 'back from the profile');
  await context.close();

  // 17. Resumen diario: lo publicado por los ayuntamientos de tus concejos y lo pendiente, con enlaces; solo si hay algo.
  const lenaPending = await payload.create({ collection: 'suggestions', user: lenaUser, overrideAccess: false, data: { services: ['agenda'], text: 'Tercera sugerencia para el resumen' } });
  const n5 = (await find('notifications', { suggestion: { equals: lenaPending.id } }))[0];
  let sent = await sendDailyDigests(payload);
  let digest = (await mails()).filter(m => m.to === JUANFRAN && m.subject.startsWith('Planta 14, resumen del día')).at(-1);
  assert.ok(sent.some(s => s.email === JUANFRAN) && digest.text.includes('Concierto de la banda en Pola de Lena') && digest.text.includes('/lena?seccion=event')
    && digest.text.includes(`/cms/bandeja?pendiente=${n5.id}`), `Juanfran: Lena publications and pending, with links\n${digest?.text}`);
  // Desactivado en el perfil: no llega. Fuera: tampoco, y lo suyo va en el del otro redactor.
  assert.equal((await prefs(andresCookie, users.andres.id, { dailyDigest: false })).status, 200);
  assert.equal((await prefs(juanfranCookie, users.juanfran.id, { awayUntil: inDays(2) })).status, 200);
  sent = await sendDailyDigests(payload);
  assert.ok(!sent.some(s => s.email === ANDRES) && !sent.some(s => s.email === JUANFRAN), 'off and away: nothing');
  assert.equal((await prefs(andresCookie, users.andres.id, { dailyDigest: true })).status, 200);
  sent = await sendDailyDigests(payload);
  digest = (await mails()).filter(m => m.to === ANDRES && m.subject.startsWith('Planta 14, resumen del día')).at(-1);
  assert.ok(sent.some(s => s.email === ANDRES) && digest.text.includes('Concierto de la banda en Pola de Lena'), 'Juanfran away: Lena goes in Andrés’s summary');
  assert.equal((await prefs(juanfranCookie, users.juanfran.id, { awayUntil: null })).status, 200);
  // Nada que contar: no se envía (dentro de unos días, sin publicaciones recientes y con la bandeja de Lena vacía).
  for (const n of await find('notifications', { and: [{ reviewed: { not_equals: true } }, { kind: { in: ['festival-submission', 'suggestion', 'letter-submission'] } }] })) await payload.update({ collection: 'notifications', id: n.id, overrideAccess: true, data: { reviewed: true } });
  assert.equal((await sendDailyDigests(payload, new Date(Date.now() + 3 * 86400_000))).length, 0, 'only if there is something');
  // A las 8:00 (Madrid), una vez al día: antes, nada; después, una sola vez aunque se repita.
  const at = (h) => new Date(`2030-01-15T${String(h - 1).padStart(2, '0')}:30:00Z`); // enero: Madrid = UTC+1
  assert.equal(await dailyDigestTick(payload, at(7)), null, 'not before 8:00');
  assert.ok(Array.isArray(await dailyDigestTick(payload, at(9))), 'runs after 8:00');
  assert.equal(await dailyDigestTick(payload, at(10)), null, 'once a day');
  passed('newsroom: concejo required everywhere with a hidden «Caudal» for comarcal items (public forms, articles); shared inbox «Pendiente de revisar» (/cms/bandeja) with fiestas, suggestions and letters by date, concejo and responsible, own concejos first; publish/approve or reject in one click with a reason from an editable list (plus optional note; letters email it to the author); who and when; «already resolved by …»; immediate email only for what needs action, only to the responsible (direct link), to the other journalist while «Fuera hasta», to those present for Caudal; no email for municipal publications; daily summary at 8:00 only if there is something (municipal publications of your concejos and pending items, with links), off in the profile, skipped while away and covered by the other journalist; once a day');
}
