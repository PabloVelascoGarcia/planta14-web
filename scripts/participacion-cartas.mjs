// Bloque «Cartas de los lectores» de scripts/participacion-integration.mjs.
export async function run(ctx) {
  const { payload, users, mails, web, origin, page, passed, assert, browser, signIn } = ctx;
  const lastMailTo = async to => (await mails()).filter(m => m.to === to).at(-1);
  const letters = async where => (await payload.find({ collection: 'letters', where, overrideAccess: true, depth: 1, pagination: false })).docs;
  const raw = async id => (await payload.db.findOne({ collection: 'letters', where: { id: { equals: id } } }));
  const body = 'Quiero agradecer a los vecinos de Campomanes el trabajo de estas semanas en la limpieza del río.\n\nEs un ejemplo de lo que podemos hacer juntos.';

  // Normas (texto provisional) y formulario.
  assert.ok((await page(`${web}/normas-cartas`)).includes('Texto provisional, pendiente de revisión jurídica.'), 'provisional rules page');
  const context = await browser.newContext();
  const tab = await context.newPage();
  const fill = async (values) => {
    await tab.goto(`${web}/cartas/enviar`);
    // Sin el límite del navegador: así se comprueba el del servidor.
    await tab.evaluate(() => document.querySelectorAll('[maxlength]').forEach(e => e.removeAttribute('maxlength')));
    for (const [name, value] of Object.entries(values)) {
      if (name === 'town') await tab.selectOption('select[name="town"]', value);
      else if (name === 'rules' || name === 'privacy') { if (value) await tab.check(`input[name="${name}"]`); }
      else await tab.fill(`[name="${name}"]`, value);
    }
    await tab.click('button:has-text("Enviar la carta")');
  };
  const good = { firstName: 'Lucía', lastName: 'Fernández Álvarez', dni: '12345678Z', phone: '600 111 222', email: 'lucia-carta@example.org', town: 'lena', body, rules: true, privacy: true };
  await fill({ ...good, dni: '12345678A', body: 'x'.repeat(2001) });
  await tab.locator('[role="alert"]', { hasText: 'Revisa los campos marcados.' }).waitFor();
  assert.ok(await tab.locator('#dni-error').count() && await tab.locator('#body-error').count(), 'wrong DNI letter and over 2,000 characters rejected');
  assert.equal(await tab.inputValue('input[name="lastName"]'), 'Fernández Álvarez', 'values kept');
  await fill(good);
  await tab.locator('[data-letter-sent]').waitFor();
  let [letter] = await letters({ email: { equals: 'lucia-carta@example.org' } });
  assert.equal(letter.status, 'sin-confirmar');
  const stored = await raw(letter.id);
  assert.ok(stored.dniEnc.startsWith('v1:') && !stored.dniEnc.includes('12345678') && stored.phoneEnc.startsWith('v1:') && !JSON.stringify(stored).includes('600111222'), 'DNI and phone encrypted at rest');
  assert.equal((await payload.find({ collection: 'notifications', where: { letter: { equals: letter.id } }, overrideAccess: true })).totalDocs, 0, 'nothing for the newsroom before confirming');
  const link = (await lastMailTo('lucia-carta@example.org')).text.match(/https?:\/\/\S+\/cartas\/confirmar\?t=\S+/)[0];
  await tab.goto(link.replace(origin, web));
  await tab.click('button:has-text("Confirmar mi carta")');
  await tab.locator('[data-letter-confirmed="true"]').waitFor();
  [letter] = await letters({ id: { equals: letter.id } });
  assert.equal(letter.status, 'pendiente');
  const notice = (await payload.find({ collection: 'notifications', where: { letter: { equals: letter.id } }, overrideAccess: true, depth: 0 })).docs[0];
  assert.ok(notice && notice.kind === 'letter-submission' && notice.assignedTo === users.juanfran.id && notice.emailStatus === 'sent', 'pending item for the responsible of Lena');
  assert.ok((await lastMailTo('juansantospolalena@gmail.com')).text.includes(`/cms/collections/letters/${letter.id}`));
  // Una carta al mes por persona (mismo DNI con otro correo).
  await fill({ ...good, email: 'otro-correo@example.org' });
  await tab.locator('[role="alert"]', { hasText: 'una carta al mes' }).waitFor();
  await context.close();
  passed('letters: public form (name, surnames, DNI/NIE with check letter, phone, email, concejo, up to 2,000 characters, rules and privacy) keeps what was typed on errors; DNI and phone stored encrypted; email confirmation by button; then a pending item and email for the concejo journalist; one letter a month per person');

  // DNI y teléfono: administración y periodista del concejo; nadie más.
  const read = async email => (await (await fetch(`${web}/api/cms/letters/${letter.id}?depth=0`, { headers: { Cookie: await signIn(email), 'Sec-Fetch-Site': 'same-origin' } })).json());
  const asAdmin = await read(users.admin.email), asJuanfran = await read('juansantospolalena@gmail.com'), asAndres = await read('velascolne@gmail.com');
  assert.deepEqual([asAdmin.dni, asAdmin.phone], ['12345678Z', '600111222'], 'administration sees them');
  assert.deepEqual([asJuanfran.dni, asJuanfran.phone], ['12345678Z', '600111222'], 'the concejo journalist sees them');
  assert.ok(!asAndres.dni && !asAndres.phone && asAndres.text, 'another journalist does not');
  assert.ok(!('dniEnc' in asAdmin) && !('personKey' in asAdmin) && !('tokenHash' in asAdmin), 'ciphertext never in the API');

  // Rechazo con motivo y aprobación con edición.
  await assert.rejects(payload.update({ collection: 'letters', id: letter.id, user: users.juanfran, overrideAccess: false, data: { status: 'rechazada' } }), /motivo del rechazo/);
  const juanfranUser = (await payload.find({ collection: 'users', where: { email: { equals: 'juansantospolalena@gmail.com' } }, overrideAccess: true })).docs[0];
  await payload.update({ collection: 'letters', id: letter.id, user: juanfranUser, overrideAccess: false, data: { status: 'aprobada', title: 'Gracias, Campomanes', text: body.replace('estas semanas', 'las últimas semanas') } });
  [letter] = await letters({ id: { equals: letter.id } });
  assert.ok(letter.publishedAt && letter.decidedBy.id === juanfranUser.id && letter.originalText === body, 'approved, edited, original kept');
  assert.equal((await lastMailTo('lucia-carta@example.org')).subject, 'Tu carta se ha publicado en Planta 14');
  const opinion = await page(`${web}/opinion`);
  assert.ok(opinion.includes('Cartas de los lectores') && opinion.includes('Planta 14 no comparte necesariamente las opiniones de los lectores.') && opinion.includes('Gracias, Campomanes') && opinion.includes('las últimas semanas') && opinion.includes('Lucía Fernández Álvarez · Lena'), 'published in Opinión');
  for (const secret of ['12345678Z', '600111222', 'lucia-carta@example.org']) assert.ok(!opinion.includes(secret) && !(await page(`${web}/cartas`)).includes(secret), `${secret} never public`);
  const publicAPI = await (await fetch(`${web}/api/cms/letters?depth=0`)).json();
  assert.ok(publicAPI.docs.length === 1 && publicAPI.docs.every(d => d.email === undefined && d.dni === undefined && d.phone === undefined && d.originalText === undefined), 'public API: approved only, no personal data');
  // Otra carta, rechazada con motivo enviado al autor.
  const second = await payload.create({ collection: 'letters', overrideAccess: true, data: { status: 'pendiente', firstName: 'Pedro', lastName: 'Gómez', email: 'pedro-carta@example.org', town: letter.town.id, text: 'Texto con insultos.', originalText: 'Texto con insultos.' } });
  await payload.update({ collection: 'letters', id: second.id, user: juanfranUser, overrideAccess: false, data: { status: 'rechazada', rejectionReason: 'Contiene descalificaciones personales (normas, «Qué no publicamos»).' } });
  const rejection = await lastMailTo('pedro-carta@example.org');
  assert.ok(rejection.subject === 'Tu carta a Planta 14 no se publicará' && rejection.text.includes('Contiene descalificaciones personales'), 'reason emailed to the author');
  assert.ok(!(await page(`${web}/opinion`)).includes('Pedro Gómez'), 'rejected not published');
  passed('letters: DNI and phone visible only to the administration and the concejo journalist (never to other journalists, the public or the API in clear); approve with edits (original text kept) or reject with a reason emailed to the author; «Cartas de los lectores» in Opinión and /cartas with name, surnames, concejo and «Planta 14 no comparte necesariamente las opiniones de los lectores»');

  // Borrado automático a los 24 meses.
  const { eraseExpiredPersonalData } = await import('../cms/letters.ts');
  const old = new Date(); old.setMonth(old.getMonth() - 25);
  await payload.db.updateOne({ collection: 'letters', id: letter.id, data: { createdAt: old.toISOString() } });
  assert.equal(await eraseExpiredPersonalData(payload), 1);
  const erased = await raw(letter.id);
  assert.ok(erased.dniEnc === null && erased.phoneEnc === null && erased.personalDataErasedAt, 'erased after 24 months');
  assert.equal((await read(users.admin.email)).dni, undefined);
  assert.equal(await eraseExpiredPersonalData(payload), 0, 'idempotent');
  passed('letters: DNI and phone erased automatically after 24 months (on new letters, on opening the CMS and with npm run cms:cartas:caducar); the letter stays published');
}
