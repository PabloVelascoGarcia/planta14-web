// Bloque «Sesión del panel municipal» de scripts/participacion-integration.mjs. Fallo visto en pruebas: entrar en
// /mieres/panel (pestaña A), abrir /mieres/panel?pestana=util en otra pestaña (B) y volver a A: pedían la contraseña.
// Causas: la cookie de Payload solo vale si el navegador declara la navegación del mismo sitio (al abrir B desde un
// enlace de otro sitio no valía), caducaba a las 2 horas y era la misma que la del CMS. Ahora el panel tiene su cookie
// (planta14_panel, lib/panel-session.ts): compartida entre pestañas, 14 días renovados con el uso, solo se borra al cerrar
// sesión o al caducar, y no se mezcla con la del CMS.
export async function run(ctx) {
  const { payload, users, password, origin, web, passed, assert, browser, signIn } = ctx;
  await ctx.activate(['lena', 'mieres']);
  const mieres = (await payload.find({ collection: 'municipal-spaces', where: { legacyID: { equals: 'mieres' } }, overrideAccess: true })).docs[0];
  const email = 'mieres-sesion@planta14.example';
  const user = (await payload.find({ collection: 'users', where: { email: { equals: email } }, overrideAccess: true })).docs[0]
    ?? await payload.create({ collection: 'users', overrideAccess: true, user: users.admin, data: { name: 'Ayuntamiento de Mieres (sesión)', email, password, role: 'municipal', municipalSpace: mieres.id } });
  const inside = async tab => { await tab.locator('[data-panel-tabs], input[autocomplete="current-password"]').first().waitFor(); return (await tab.locator('[data-panel-tabs]').count()) === 1; };
  const sessions = async () => (await payload.db.findOne({ collection: 'users', where: { id: { equals: user.id } } })).sessions ?? [];

  // Navegador recién limpiado: un contexto nuevo, sin cookies.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  // a) Pestaña A: entrar con la cuenta municipal; se ven las pestañas; F5 mantiene la sesión.
  const a = await context.newPage();
  await a.goto(`${origin}/mieres/panel`, { waitUntil: 'load' });
  await a.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await a.getByLabel('Contraseña', { exact: true }).fill(password);
  await a.getByRole('button', { name: /^Entrar/ }).click();
  await a.locator('[data-panel-tabs]').waitFor();
  await a.reload({ waitUntil: 'load' });
  assert.ok(await inside(a), 'a) F5 keeps the session');
  // b) Pestaña B: /mieres/panel?pestana=util, dentro y en «Útil».
  const b = await context.newPage();
  await b.goto(`${origin}/mieres/panel?pestana=util`, { waitUntil: 'load' });
  assert.ok(await inside(b) && await b.locator('[data-panel-section="util"]').count() === 1, 'b) tab B is signed in, on «Útil»');
  // c) Volver a A y recargar: las dos pestañas siguen dentro.
  await a.bringToFront();
  await a.reload({ waitUntil: 'load' });
  assert.ok(await inside(a), 'c) tab A is still signed in');
  await b.reload({ waitUntil: 'load' });
  assert.ok(await inside(b), 'c) tab B is still signed in');

  // La causa real: B abierta desde un enlace de otro sitio (correo web, WhatsApp, un documento). Antes pedía la contraseña.
  const c = await context.newPage();
  await c.setContent(`<a id="enlace" href="${origin}/mieres/panel?pestana=util">Panel</a>`);
  await c.click('#enlace'); await c.waitForURL(/pestana=util/); await c.waitForLoadState('load');
  assert.ok(await inside(c), 'a link from another site keeps the session');
  await a.reload({ waitUntil: 'load' });
  assert.ok(await inside(a), 'and tab A is still inside');
  await c.close();

  // La cookie: httpOnly, Secure, SameSite=Lax, ruta /, unos 14 días; la de Payload no se usa en el panel.
  const cookie = (await context.cookies(origin)).find(x => x.name === '__Host-planta14_panel');
  const days = (cookie.expires * 1000 - Date.now()) / 86400_000;
  assert.ok(cookie.httpOnly && cookie.secure && cookie.sameSite === 'Lax' && cookie.path === '/' && days > 13.9 && days <= 14.01, `panel cookie attributes ${JSON.stringify(cookie)}`);
  assert.ok(!(await context.cookies(origin)).some(x => x.name === 'payload-token'), 'no Payload cookie from the panel login');
  assert.equal((await sessions()).length, 1, 'one session for the panel (the 2-hour one from the password check is removed)');
  // Guardar desde la pestaña B con la sesión del panel (va por /api/panel/api).
  await b.locator('[data-panel-tab="publicar"]').click();
  await b.getByLabel(/^Título/).fill('Aviso de prueba de sesión');
  await b.getByLabel(/^Resumen/).fill('Resumen de la prueba de sesión.');
  await b.getByLabel(/¿Qué deben saber los vecinos\?/).fill('Texto de la prueba de sesión.');
  await b.getByRole('button', { name: /^Guardar como borrador/ }).click();
  await b.getByText(/Borrador guardado/).waitFor();
  const saved = (await payload.find({ collection: 'municipal-content', where: { title: { equals: 'Aviso de prueba de sesión' } }, overrideAccess: true, draft: true })).docs[0];
  assert.ok(saved && (saved.space === mieres.id || saved.space?.id === mieres.id), 'saved with the panel session');
  // Desde otro sitio no se puede guardar con la cookie del panel.
  const forged = await context.request.post(`${web}/api/panel/api/municipal-content`, { headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, data: { title: 'x' } });
  assert.equal(forged.status(), 403, 'cross-site write refused');

  // Convive con el CMS en el mismo navegador: entrar en /cms (redacción) no echa del panel, y al revés.
  const cmsCookie = (await signIn(users.editor.email)).split('; ').map(x => { const [name, ...v] = x.split('='); return { name, value: v.join('='), url: origin }; });
  await context.addCookies(cmsCookie);
  await a.reload({ waitUntil: 'load' });
  assert.ok(await inside(a), 'panel still inside with a CMS session in the same browser');
  const cms = await context.newPage();
  await cms.goto(`${origin}/cms`, { waitUntil: 'load' });
  await cms.locator('[data-cms-dashboard], input[name="password"]').first().waitFor();
  assert.ok(await cms.locator('[data-cms-dashboard]').count(), 'CMS still inside with the panel session');
  // El panel guarda como el ayuntamiento, no como la cuenta del CMS.
  await a.locator('[data-panel-tab="publicar"]').click();
  await a.getByLabel(/^Título/).fill('Aviso con las dos sesiones');
  await a.getByLabel(/^Resumen/).fill('Resumen.');
  await a.getByLabel(/¿Qué deben saber los vecinos\?/).fill('Texto.');
  await a.getByRole('button', { name: /^Guardar como borrador/ }).click();
  await a.getByText(/Borrador guardado/).waitFor();
  const both = (await payload.find({ collection: 'audit-log', where: { title: { equals: 'Aviso con las dos sesiones' } }, overrideAccess: true, depth: 0 })).docs[0];
  assert.equal(both?.userEmail, email, 'saved as the municipal account, not as the CMS one');

  // Renovación con el uso: con un token de más de un día, abrir el panel alarga la sesión a 14 días desde ahora.
  const { SignJWT } = await import('jose');
  const { getFieldsToSign, JWT_AUTH_VERSION } = await import('payload');
  const sid = (await sessions())[0].id;
  const old = Math.floor(Date.now() / 1000) - 3 * 86400;
  const fields = getFieldsToSign({ collectionConfig: payload.collections.users.config, email, user: { ...(await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true, depth: 0 })), collection: 'users' } });
  const oldToken = await new SignJWT({ ...fields, sid, aud: 'planta14-panel' }).setProtectedHeader({ alg: 'HS256', authVersion: JWT_AUTH_VERSION, typ: 'JWT' }).setIssuedAt(old).setExpirationTime(old + 14 * 86400).sign(new TextEncoder().encode(payload.secret));
  // (Una cookie __Host- no se puede poner a mano en el navegador: se pide la renovación como la hace el panel al abrirse.)
  const renewal = await fetch(`${web}/api/panel/sesion`, { method: 'POST', headers: { Cookie: `__Host-planta14_panel=${oldToken}`, Origin: origin } });
  assert.equal(renewal.status, 200, 'a 3-day-old panel session is still valid');
  const issued = renewal.headers.getSetCookie().find(c => c.startsWith('__Host-planta14_panel='));
  assert.ok(issued && !issued.includes(oldToken) && /Max-Age=1209600/.test(issued) && /HttpOnly/.test(issued) && /Secure/.test(issued) && /SameSite=Lax/.test(issued), `renewed to 14 days with use: ${issued}`);
  assert.ok(new Date((await sessions()).find(s => s.id === sid).expiresAt).getTime() > Date.now() + 13.9 * 86400_000, 'server session renewed too');
  const fresh = await fetch(`${web}/api/panel/sesion`, { method: 'POST', headers: { Cookie: issued.split(';')[0], Origin: origin } });
  assert.ok(fresh.status === 200 && !fresh.headers.getSetCookie().length, 'a fresh token is not renewed again (once a day at most)');

  // «Cerrar sesión»: sale del panel (en todas las pestañas), borra la sesión y no toca la del CMS.
  await a.getByRole('button', { name: /Cerrar sesión/ }).click();
  await a.getByLabel('Contraseña', { exact: true }).waitFor();
  await b.reload({ waitUntil: 'load' });
  assert.ok(!(await inside(b)), 'logout signs out every tab');
  assert.ok(!(await context.cookies(origin)).some(x => x.name === '__Host-planta14_panel') && !(await sessions()).some(s => s.id === sid), 'cookie and session removed');
  await cms.reload({ waitUntil: 'load' });
  await cms.locator('[data-cms-dashboard], input[name="password"]').first().waitFor();
  assert.ok(await cms.locator('[data-cms-dashboard]').count(), 'the CMS session is untouched');
  await context.close();
  passed('municipal panel session (real browser, clean profile): a) sign in on tab A, F5 keeps it; b) /mieres/panel?pestana=util on tab B signed in; c) back on A and reload: both inside. Also from a link on another site; own cookie planta14_panel (httpOnly, Secure, SameSite=Lax, path /, 14 days, renewed with use, one session); saving goes through /api/panel/api as the municipal account, cross-site writes refused; coexists with a CMS session in the same browser; «Cerrar sesión» signs out every tab and leaves the CMS alone');
}
