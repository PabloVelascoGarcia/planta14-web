// Bloque «Envío del boletín» de scripts/participacion-integration.mjs: documento «Boletín» en el CMS, prueba al
// propio correo, envío a todos con confirmación, por concejos, con baja en un clic, en lotes y con registro.
export async function run(ctx) {
  const { payload, users, web, mails, passed, assert, signIn, town } = ctx;
  // Lotes pequeños y sin pausas largas para la prueba (en producción, 20 por lote y 2 min entre lotes).
  await ctx.stop(); await ctx.start({ NEWSLETTER_BATCH_SIZE: '2', NEWSLETTER_BATCH_PAUSE_SECONDS: '1', NEWSLETTER_EMAIL_PAUSE_MS: '0' });
  const [lena, mieres, morcin] = [await town('lena'), await town('mieres'), await town('morcin')];
  const author = (await payload.find({ collection: 'authors', limit: 1, overrideAccess: true })).docs[0]
    ?? await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'Redacción de prueba', slug: 'redaccion-boletin' } });
  const section = (await payload.find({ collection: 'sections', where: { slug: { equals: 'sociedad' } }, overrideAccess: true })).docs[0];
  const now = new Date().toISOString();
  const article = (title, t) => payload.create({ collection: 'articles', overrideAccess: true, data: { title, excerpt: `Entradilla de ${title}.`, body: ['Texto.'], author: author.id, town: t.id, section: section.id, publishedAt: now, _status: 'published' } });
  const [aLena, aMieres] = [await article('Boletín: noticia de Lena', lena), await article('Boletín: noticia de Mieres', mieres)];
  // Los suscriptores del bloque anterior (alta y baja) ya no hacen falta: así los números del envío son exactos.
  await payload.delete({ collection: 'subscribers', where: { id: { exists: true } }, overrideAccess: true });
  const token = () => `tok-${Math.random().toString(36).slice(2)}`;
  const subscriber = (email, towns, status = 'confirmado') => payload.create({ collection: 'subscribers', overrideAccess: true,
    data: { email, status, towns: towns.map(t => t.id), topics: ['finde'], source: 'portada', unsubscribeToken: token(), confirmedAt: now, consent: { text: 'v1', acceptedAt: now } } });
  const sLena = await subscriber('lector-lena@example.org', [lena]);
  const sAll = await subscriber('lector-todos@example.org', []);
  const sMorcin = await subscriber('lector-morcin@example.org', [morcin]);
  await subscriber('lector-baja@example.org', [], 'baja');

  const json = cookie => ({ Cookie: cookie, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' });
  const editor = await signIn(users.editor.email);
  const municipal = await signIn(users.lena.email);
  assert.equal((await fetch(`${web}/api/cms/newsletters`, { method: 'POST', headers: json(municipal), body: JSON.stringify({ subject: 'x' }) })).status, 403, 'town halls cannot');
  assert.equal((await fetch(`${web}/api/cms/newsletters`, { method: 'POST', headers: json(''), body: JSON.stringify({ subject: 'x' }) })).status, 403, 'anonymous cannot');
  const created = await (await fetch(`${web}/api/cms/newsletters`, { method: 'POST', headers: json(editor), body: JSON.stringify({ subject: 'Lo que pasó esta semana', intro: 'Hola.\n\nEsto es lo más leído.' }) })).json();
  const id = created.doc?.id;
  assert.ok(id && created.doc.status === 'borrador', JSON.stringify(created).slice(0, 400));
  const doc = await payload.findByID({ collection: 'newsletters', id, depth: 0, overrideAccess: true });
  assert.ok([aLena.id, aMieres.id].every(a => doc.articles.includes(a)), 'by default, the published news of the last 7 days');
  await payload.update({ collection: 'newsletters', id, overrideAccess: true, data: { articles: [aLena.id, aMieres.id] } });

  // «Enviar a todos» exige antes una prueba de la versión guardada.
  const send = () => fetch(`${web}/api/cms/newsletters/${id}/enviar`, { method: 'POST', headers: json(editor), body: JSON.stringify({ confirmar: true }) });
  assert.equal((await send()).status, 409, 'no sending to everyone before a test');
  const before = (await mails()).length;
  const test = await fetch(`${web}/api/cms/newsletters/${id}/prueba`, { method: 'POST', headers: json(editor) });
  assert.equal(test.status, 200, await test.clone().text());
  const testMail = (await mails()).slice(before).find(m => m.to === users.editor.email);
  assert.ok(testMail && testMail.subject === '[Prueba] Lo que pasó esta semana' && testMail.html.includes('Prueba: solo te llega a ti') && testMail.text.includes('Boletín: noticia de Lena'), 'test only to the editor, HTML and plain text');
  assert.equal((await mails()).slice(before).length, 1, 'nobody else receives the test');
  const info = await (await fetch(`${web}/api/cms/newsletters/${id}/destinatarios`, { headers: json(editor) })).json();
  assert.equal(info.confirmed, 3, 'recipients: confirmed subscribers only');
  assert.equal((await fetch(`${web}/api/cms/newsletters/${id}/enviar`, { method: 'POST', headers: json(editor), body: JSON.stringify({}) })).status, 400, 'explicit confirmation required');
  assert.equal((await send()).status, 200);
  for (let i = 0; i < 100; i++) { if ((await payload.findByID({ collection: 'newsletters', id, depth: 0, overrideAccess: true })).status === 'enviado') break; await new Promise(r => setTimeout(r, 200)); }
  const sent = await payload.findByID({ collection: 'newsletters', id, depth: 0, overrideAccess: true });
  assert.equal(sent.status, 'enviado');
  assert.deepEqual([sent.stats.sent, sent.stats.failed, sent.stats.skipped, sent.stats.unsubscribed], [2, 0, 1, 0], `sent 2 (Lena and all), none failed, Morcín skipped (no news of its concejo): ${JSON.stringify(sent.stats)} ${sent.log}`);
  const out = (await mails()).slice(before + 1);
  const to = email => out.filter(m => m.to === email);
  const mLena = to(sLena.email)[0], mAll = to(sAll.email)[0];
  assert.ok(mLena.html.includes('Boletín: noticia de Lena') && !mLena.html.includes('Boletín: noticia de Mieres'), 'Lena subscriber: only Lena news');
  assert.ok(mAll.html.includes('Boletín: noticia de Lena') && mAll.html.includes('Boletín: noticia de Mieres'), 'no concejo chosen: all the news');
  assert.equal(to(sMorcin.email).length + to('lector-baja@example.org').length, 0, 'no email without news of its concejos, none to unsubscribed people');
  for (const m of [mLena, mAll]) {
    const sub = m.to === sLena.email ? sLena : sAll;
    assert.ok(m.headers['List-Unsubscribe'].includes(sub.unsubscribeToken) && m.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click', 'one-click unsubscribe header');
    assert.ok(m.html.includes(`/boletin/baja?t=${sub.unsubscribeToken}`) && m.text.includes(`/boletin/baja?t=${sub.unsubscribeToken}`), 'unsubscribe link in HTML and text');
    assert.ok(m.html.includes('medio editado por Agencia Social de Servicios Asturiana S.L. (ASSA)') && m.text.includes('NIF B33524216'), 'editor identification');
    assert.ok(m.html.includes('max-width:600px') && m.html.includes('role="presentation"') && !/<img|<script/i.test(m.html), 'sober table layout, no images or tracking');
  }
  assert.equal((await send()).status, 409, 'a sent newsletter cannot be sent again');
  await ctx.stop(); await ctx.start();
  passed('newsletter sending from the CMS (administration and newsroom; not town halls): subject, optional intro and published news (last 7 days by default); «Enviarme una prueba» only to the editor and required before «Enviar a todos» (with confirmation); each confirmed subscriber gets the news of their concejos (all if none chosen), with one-click unsubscribe and the editor identification; in batches with pauses; sent, failed, unsubscribed and skipped recorded; HTML for Gmail/Outlook plus plain text');
}
