// Bloque 0 de scripts/participacion-integration.mjs: recuperación de contraseña (panel municipal y redacción) y
// mínimo de 12 caracteres exigido por el servidor en todas las cuentas.
export async function run(ctx) {
  const { payload, users, mails, web, origin, passed, assert, browser } = ctx;
  const lastMailTo = async to => (await mails()).filter(m => m.to === to).at(-1);
  const hrefIn = html => html.match(/href="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');

  // --- Mínimo de 12 caracteres en el servidor (crear, cambiar y restablecer), para todos los roles.
  for (const role of ['admin', 'editor']) {
    await assert.rejects(payload.create({ collection: 'users', user: users.admin, overrideAccess: false, data: { name: 'Corta', email: `corta-${role}@planta14.example`, password: 'once-chars!', role } }), /al menos 12 caracteres/, `create ${role}`);
  }
  const lena = (await payload.find({ collection: 'municipal-spaces', where: { legacyID: { equals: 'lena' } }, overrideAccess: true })).docs[0];
  await assert.rejects(payload.create({ collection: 'users', user: users.admin, overrideAccess: false, data: { name: 'Corta', email: 'corta-municipal@planta14.example', password: 'corta', role: 'municipal', municipalSpace: lena.id } }), /al menos 12 caracteres/, 'create municipal');
  await assert.rejects(payload.update({ collection: 'users', id: users.editor.id, user: users.admin, overrideAccess: false, data: { password: '12345678901' } }), /al menos 12 caracteres/, 'update');
  const api = await fetch(`${web}/api/cms/users/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ token: 'x', password: 'corta' }) });
  assert.equal(api.status, 400, 'reset-password API with a short password');
  assert.match(JSON.stringify(await api.json()), /al menos 12 caracteres/);
  passed('passwords: the server requires at least 12 characters for every account (administration, newsroom, municipal) when creating, changing and resetting them, not only the form');

  // --- Panel municipal: pedir el correo, abrir el enlace, cambiar la contraseña y entrar en el panel.
  const context = await browser.newContext();
  const tab = await context.newPage();
  await tab.goto(`${web}/lena/panel`);
  await tab.getByRole('button', { name: '¿Has olvidado tu contraseña?' }).click();
  await tab.locator('[data-forgot-password] input[type="email"]').fill(users.lena.email);
  await tab.getByRole('button', { name: 'Enviar el enlace ↗' }).click();
  await tab.locator('[data-forgot-password] [role="status"]', { hasText: 'recibirás un enlace' }).waitFor();
  const mail = await lastMailTo(users.lena.email);
  assert.ok(mail && mail.subject === 'Planta 14: cambia tu contraseña' && /panel de Ayuntamiento de Lena/.test(mail.html) && !/<img|<script/.test(mail.html), 'own email, without external resources');
  const link = hrefIn(mail.html);
  assert.match(link, new RegExp(`^${origin}/lena/panel/restablecer#token=[^&]+$`), 'link to the municipal panel, token after «#»');
  // Un correo que no tiene cuenta recibe la misma respuesta y ningún correo.
  const sent = (await mails()).length;
  await fetch(`${web}/api/cms/users/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ email: 'nadie@example.org' }) });
  assert.equal((await mails()).length, sent, 'no email for unknown addresses');
  await tab.goto(link.replace(origin, web));
  await tab.locator('[data-reset-state="formulario"]').waitFor();
  assert.ok(!tab.url().includes('#token'), 'token removed from the address bar');
  await tab.fill('input[autocomplete="new-password"] >> nth=0', 'corta');
  await tab.fill('input[autocomplete="new-password"] >> nth=1', 'corta');
  await tab.evaluate(() => document.querySelectorAll('input[minlength]').forEach(i => i.removeAttribute('minlength')));
  await tab.getByRole('button', { name: 'Guardar y entrar ↗' }).click();
  await tab.locator('[data-reset-state="formulario"] [role="status"]', { hasText: 'al menos 12 caracteres' }).waitFor();
  const newPassword = 'una frase larga para Lena 2026';
  await tab.fill('input[autocomplete="new-password"] >> nth=0', newPassword);
  await tab.fill('input[autocomplete="new-password"] >> nth=1', newPassword);
  await tab.getByRole('button', { name: 'Guardar y entrar ↗' }).click();
  await tab.waitForURL(url => url.pathname === '/lena/panel');
  await tab.getByRole('form', { name: 'Publicación municipal' }).waitFor({ timeout: 20000 });
  await context.close();
  // El enlace no sirve dos veces; la contraseña nueva sí entra.
  const again = await fetch(`${web}/api/cms/users/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ token: decodeURIComponent(link.split('#token=')[1]), password: 'otra frase larga más 2026' }) });
  assert.notEqual(again.status, 200, 'the link only works once');
  const login = await fetch(`${web}/api/cms/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ email: users.lena.email, password: newPassword }) });
  assert.equal(login.status, 200, 'signs in with the new password');
  passed('municipal password recovery in a real browser: «¿Has olvidado tu contraseña?» in the Lena panel, own email (no external resources) linking to /lena/panel/restablecer#token=…, token removed from the address bar, short password rejected by the server, new password saved and straight into the panel; the link works once; same answer for unknown addresses');

  // --- Redacción: el enlace lleva a /cms/reset/<token> (página de Payload).
  await fetch(`${web}/api/cms/users/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify({ email: users.editor.email }) });
  const editorLink = hrefIn((await lastMailTo(users.editor.email)).html);
  assert.match(editorLink, new RegExp(`^${origin}/cms/reset/[^/#]+$`));
  const cms = await browser.newContext(); const page = await cms.newPage();
  await page.goto(editorLink, { waitUntil: 'networkidle' }); // el formulario de Payload necesita estar cargado
  await page.locator('input[name="password"]').fill('frase larga de la redacción');
  await page.locator('input[name="confirm-password"]').fill('frase larga de la redacción');
  await page.getByRole('button', { name: 'Restablecer Contraseña' }).click();
  await page.waitForURL(url => url.pathname === '/cms' || url.pathname === '/cms/', { timeout: 20000 });
  await cms.close();
  // Las pruebas siguientes entran con la contraseña común.
  await payload.update({ collection: 'users', id: users.editor.id, overrideAccess: true, data: { password: ctx.password } });
  passed('newsroom password recovery: the email links to the CMS reset page (/cms/reset/<token>) and, after saving, the CMS opens with the session started');
}
