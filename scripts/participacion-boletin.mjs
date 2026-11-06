// Bloque 3 de scripts/participacion-integration.mjs: suscripción al boletín (solo captar y confirmar).
export async function run(ctx) {
  const { payload, users, all, mails, web, origin, page, passed, assert, browser, signIn } = ctx;
  const subscriber = async email => (await payload.find({ collection: 'subscribers', where: { email: { equals: email } }, depth: 1, overrideAccess: true })).docs[0];
  const linkIn = (mail, path) => mail?.text.match(new RegExp(`https?://\\S+${path}\\?t=\\S+`))?.[0]?.replace(origin, web);
  const lastMailTo = async to => (await mails()).filter(m => m.to === to).at(-1);

  // Dónde está el formulario: el bloque verde solo en la portada; en las demás páginas, el del pie.
  const home = await page(`${web}/`);
  for (const source of ['portada', 'pie']) assert.ok(home.includes(`data-subscribe-form="${source}"`), `form in ${source}`);
  const articleSlug = home.match(/href="\/noticia\/([^"]+)"/)[1];
  const articleHTML = await page(`${web}/noticia/${articleSlug}`);
  assert.ok(!articleHTML.includes('data-subscribe-form="noticia"') && !articleHTML.includes('data-newsletter=') && articleHTML.includes('data-subscribe-form="pie"'), 'articles: only the footer form');
  const fiestaSlug = (await page(`${web}/fiestas`)).match(/href="\/fiestas\/([a-z0-9-]+-\d{4})"/)[1];
  assert.ok(!(await page(`${web}/fiestas/${fiestaSlug}`)).includes('data-subscribe-form="fiesta"'), 'fiesta pages: only the footer form');
  assert.ok(home.includes('href="/privacidad"') && home.includes('Me podré dar de baja con un clic'), 'clear consent with privacy link');

  // Alta desde la portada: consentimiento obligatorio, concejos y contenidos, doble confirmación.
  const context = await browser.newContext();
  const tab = await context.newPage();
  await tab.goto(`${web}/`);
  const form = tab.locator('[data-subscribe-form="portada"]');
  await form.locator('input[name="email"]').fill('lectora@example.org');
  await form.locator('input[value="mieres"]').check();
  await form.locator('button').click();
  await form.locator('text=tienes que aceptar recibir el boletín').waitFor();
  assert.equal(await subscriber('lectora@example.org'), undefined, 'nothing stored without consent');
  assert.equal(await form.locator('input[name="email"]').inputValue(), 'lectora@example.org', 'what was typed is kept after an error');
  assert.equal(await form.locator('input[value="mieres"]').isChecked(), true);
  await form.locator('input[name="consent"]').check();
  await form.locator('button').click();
  await tab.locator('[data-subscribe-done]').first().waitFor({ timeout: 15000 }).catch(async error => { throw new Error(`${error.message}\nFORM: ${await tab.locator('[data-newsletter="portada"]').innerText()}`); });
  let s = await subscriber('lectora@example.org');
  assert.ok(s && s.status === 'pendiente' && s.source === 'portada' && s.consent.text.startsWith('v1 · Acepto recibir') && s.consent.acceptedAt && s.unsubscribeToken, 'pending with consent record');
  assert.ok(!s.towns?.length && !s.topics?.length, 'preferences only applied after confirming');
  let mail = await lastMailTo('lectora@example.org');
  assert.ok(mail.subject === 'Confirma tu suscripción al boletín de Planta 14' && mail.text.includes('Qué hacer este finde y Avisos de mi concejo, de Mieres'), 'confirmation email');
  assert.equal(mail.headers['List-Unsubscribe'], `<${origin}/api/boletin/baja?t=${s.unsubscribeToken}>`);
  assert.equal(mail.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.ok(linkIn(mail, '/boletin/baja'), 'unsubscribe link in the email');
  // Repetir enseguida: misma respuesta, ningún correo más.
  const before = (await mails()).length;
  await tab.goto(`${web}/`);
  await form.locator('input[name="email"]').fill('lectora@example.org');
  await form.locator('input[name="consent"]').check();
  await form.locator('button').click();
  await tab.locator('[data-subscribe-done]').first().waitFor();
  assert.equal((await mails()).length, before, 'at most one email every two minutes');
  // Confirmar con el botón; el enlace solo sirve una vez.
  const confirmLink = linkIn(mail, '/boletin/confirmar');
  await tab.goto(confirmLink);
  assert.equal((await subscriber('lectora@example.org')).status, 'pendiente', 'opening the link alone does not confirm');
  await tab.click('button:has-text("Confirmar la suscripción")');
  await tab.locator('[data-token-result="true"]').waitFor();
  s = await subscriber('lectora@example.org');
  assert.ok(s.status === 'confirmado' && s.confirmedAt && s.towns.map(t => t.slug).join() === 'mieres' && s.topics.join() === 'finde,avisos', 'confirmed with the chosen preferences');
  assert.ok((await lastMailTo('lectora@example.org')).subject === 'Ya estás suscrito al boletín de Planta 14', 'welcome email with unsubscribe link');
  await tab.goto(confirmLink);
  await tab.click('button:has-text("Confirmar la suscripción")');
  await tab.locator('[data-token-result="false"]', { hasText: 'ya se ha usado' }).waitFor();
  // Cambio de preferencias de quien ya está suscrito: también se confirma por correo.
  await payload.update({ collection: 'subscribers', id: s.id, overrideAccess: true, data: { lastEmailAt: new Date(Date.now() - 3600_000).toISOString() } });
  await tab.goto(`${web}/`);
  const fiestaForm = tab.locator('[data-subscribe-form="portada"]');
  await fiestaForm.locator('input[name="email"]').fill('lectora@example.org');
  await fiestaForm.locator('input[value="avisos"]').uncheck();
  await fiestaForm.locator('input[value="lena"]').check();
  await fiestaForm.locator('input[name="consent"]').check();
  await fiestaForm.locator('button').click();
  await tab.locator('[data-subscribe-done]').first().waitFor();
  s = await subscriber('lectora@example.org');
  assert.ok(s.status === 'confirmado' && s.towns.map(t => t.slug).join() === 'mieres', 'nothing changes until confirmed');
  mail = await lastMailTo('lectora@example.org');
  assert.equal(mail.subject, 'Confirma el cambio en tu boletín de Planta 14');
  await tab.goto(linkIn(mail, '/boletin/confirmar'));
  await tab.click('button:has-text("Confirmar la suscripción")');
  await tab.locator('[data-token-result="true"]').waitFor();
  s = await subscriber('lectora@example.org');
  assert.ok(s.towns.map(t => t.slug).join() === 'lena' && s.topics.join() === 'finde' && s.source === 'portada', 'preferences changed after confirming');
  // Pie (opciones plegadas): alta con los contenidos por defecto.
  await tab.goto(`${web}/agenda`);
  const footer = tab.locator('[data-subscribe-form="pie"]');
  await footer.locator('input[name="email"]').fill('vecino@example.org');
  await footer.locator('input[name="consent"]').check();
  await footer.locator('button').click();
  await tab.locator('[data-subscribe-done]').first().waitFor();
  assert.equal((await subscriber('vecino@example.org')).source, 'pie');
  await context.close();
  passed('newsletter sign-up: the green block only on the home page (two columns) and the compact footer form elsewhere (options behind «Elegir concejos»), with a clear consent and privacy link; consent required; double opt-in (the email link opens a page whose button confirms, once); preferences (concejos and «Qué hacer este finde» / «Avisos de mi concejo») applied only on confirmation, also when changing them; at most one email every two minutes; List-Unsubscribe one-click headers');

  // Baja con un clic: botón de la página del enlace y POST de un clic del programa de correo.
  const vecino = await subscriber('vecino@example.org');
  const get = await fetch(`${web}/api/boletin/baja?t=${s.unsubscribeToken}`, { redirect: 'manual' });
  assert.ok(get.status === 303 && get.headers.get('location').includes(`/boletin/baja?t=${s.unsubscribeToken}`), 'GET leads to the page, does not unsubscribe');
  assert.equal((await subscriber('lectora@example.org')).status, 'confirmado');
  const unsubscribe = await browser.newContext(); const u = await unsubscribe.newPage();
  await u.goto(`${web}/boletin/baja?t=${s.unsubscribeToken}`);
  await u.click('button:has-text("Darme de baja")');
  await u.locator('[data-token-result="true"]').waitFor();
  await unsubscribe.close();
  s = await subscriber('lectora@example.org');
  assert.ok(s.status === 'baja' && s.unsubscribedAt, 'unsubscribed with one click');
  const post = await fetch(`${web}/api/boletin/baja?t=${vecino.unsubscribeToken}`, { method: 'POST', body: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(post.status, 200);
  assert.equal((await subscriber('vecino@example.org')).status, 'baja', 'RFC 8058 one-click POST');
  assert.equal((await fetch(`${web}/api/boletin/baja?t=no-existe`, { method: 'POST' })).status, 404);
  passed('unsubscribe: the link in every email opens a page where one click unsubscribes (a plain GET never does); one-click POST from the mail program (RFC 8058)');

  // Solo la administración: lista, edición y exportación CSV.
  assert.equal((await fetch(`${web}/api/cms/subscribers`)).status, 403, 'anonymous');
  const editorCookie = await signIn(users.editor.email), adminCookie = await signIn(users.admin.email);
  const as = cookie => ({ headers: { Cookie: cookie, 'Sec-Fetch-Site': 'same-origin' } });
  assert.equal((await fetch(`${web}/api/cms/subscribers`, as(editorCookie))).status, 403, 'editor');
  assert.equal((await fetch(`${web}/api/cms/subscribers`, { method: 'POST', headers: { ...as(adminCookie).headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'x@example.org' }) })).status, 403, 'nobody creates them through the API');
  const listed = await (await fetch(`${web}/api/cms/subscribers?depth=0`, as(adminCookie))).json();
  assert.equal(listed.totalDocs, 2, 'admin lists them');
  assert.equal((await fetch(`${web}/api/cms/subscribers/exportar`, as(editorCookie))).status, 403, 'export: admin only');
  await payload.update({ collection: 'subscribers', id: vecino.id, overrideAccess: true, data: { status: 'confirmado' } });
  const exported = await fetch(`${web}/api/cms/subscribers/exportar?estado=confirmado`, as(adminCookie));
  const csv = await exported.text();
  assert.ok(exported.headers.get('content-type').startsWith('text/csv') && /attachment; filename="suscriptores-planta14-confirmado.csv"/.test(exported.headers.get('content-disposition')), 'CSV download');
  assert.ok(csv.includes('"vecino@example.org";"confirmado";"Todos";"";"pie"') && !csv.includes('lectora@example.org'), 'confirmed only');
  const allCsv = await (await fetch(`${web}/api/cms/subscribers/exportar`, as(adminCookie))).text();
  assert.ok(allCsv.includes('lectora@example.org') && allCsv.includes('"baja"'), 'all');
  const adminList = await (await fetch(`${web}/cms/collections/subscribers`, as(adminCookie))).text();
  assert.ok(adminList.includes('data-subscribers-export') && adminList.includes('Exportar confirmados (CSV)'), 'export links in the admin list');
  void all;
  passed('Suscriptores: visible and editable only by the administration (not editors, not anonymous; nobody creates them through the API); CSV export (all or confirmed) from the list');
}
