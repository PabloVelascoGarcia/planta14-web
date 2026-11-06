// Bloque «Buzón de sugerencias» del panel municipal (scripts/participacion-integration.mjs).
export async function run(ctx) {
  const { payload, users, mails, web, passed, assert, browser, signIn, password } = ctx;
  await payload.update({ collection: 'users', id: users.lena.id, overrideAccess: true, data: { password } });
  const context = await browser.newContext();
  const tab = await context.newPage();
  await tab.goto(`${ctx.origin}/lena/panel?pestana=sugerencias`); // mismo origen que CMS_SERVER_URL (Payload solo acepta la sesión desde él)
  await tab.getByLabel('Correo electrónico', { exact: true }).fill(users.lena.email);
  await tab.getByLabel('Contraseña', { exact: true }).fill(password);
  await tab.getByRole('button', { name: 'Entrar ↗', exact: true }).click();
  const form = tab.getByRole('form', { name: 'Buzón de sugerencias' });
  await form.waitFor();
  await form.getByRole('button', { name: 'Enviar la sugerencia ↗' }).click();
  await form.locator('[role="status"]', { hasText: 'Marca algún servicio' }).waitFor();
  await form.getByLabel('Informes de visitas de nuestro espacio').check();
  await form.getByLabel('Cobertura de actos y eventos del concejo').check();
  await form.locator('textarea').fill('Nos gustaría un apartado para las fiestas de prao de las parroquias altas.');
  await form.getByRole('button', { name: 'Enviar la sugerencia ↗' }).click();
  await form.locator('[role="status"]', { hasText: 'Hemos recibido tu sugerencia' }).waitFor({ timeout: 15000 }).catch(async error => { throw new Error(`${error.message}\nSTATUS: ${await form.locator('[role="status"]').innerText()}`); });
  await context.close();
  const [suggestion] = (await payload.find({ collection: 'suggestions', overrideAccess: true, depth: 0 })).docs;
  assert.ok(suggestion && suggestion.services.join() === 'estadisticas,cobertura' && suggestion.assignedTo === users.juanfran.id && suggestion.createdBy === users.lena.id, 'stored with the concejo journalist');
  const mail = (await mails()).filter(m => m.subject === 'Sugerencia de Ayuntamiento de Lena').at(-1);
  assert.ok(mail && mail.to.includes(users.admin.email) && mail.to.includes('juansantospolalena@gmail.com') && mail.text.includes('Informes de visitas de nuestro espacio') && mail.text.includes('parroquias altas'), 'email to the administration and the journalist');
  const count = async email => { const r = await fetch(`${web}/api/cms/suggestions`, { headers: { Cookie: await signIn(email), 'Sec-Fetch-Site': 'same-origin' } }); return r.status === 200 ? (await r.json()).totalDocs : r.status; };
  assert.equal(await count(users.admin.email), 1, 'administration');
  assert.equal(await count('juansantospolalena@gmail.com'), 1, 'concejo journalist');
  assert.equal(await count('velascolne@gmail.com'), 0, 'another journalist does not');
  assert.equal(await count(users.lena.email), 403, 'the municipal account sends, does not list');
  assert.equal((await fetch(`${web}/api/cms/suggestions`)).status, 403, 'anonymous');
  await assert.rejects(payload.create({ collection: 'suggestions', user: users.editor, overrideAccess: false, data: { text: 'x' } }), 'only municipal accounts send them');
  passed('suggestions box in the municipal panel (real browser): service checkboxes and free text; stored in Sugerencias with the concejo journalist; email to the administration and to the journalist; visible only to them');
}
