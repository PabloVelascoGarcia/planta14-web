// Bloque «Seguridad de la sesión del panel» de scripts/participacion-integration.mjs (revisión del 7/11): cookie del panel,
// firma de los tokens y puente /api/panel/api. Una prueba por cada punto de la revisión.
export async function run(ctx) {
  const { payload, users, password, web, origin, passed, assert, signIn } = ctx;
  await ctx.activate(['lena', 'mieres']);
  const { SignJWT } = await import('jose');
  const { getFieldsToSign, JWT_AUTH_VERSION } = await import('payload');
  const find = async (collection, where) => (await payload.find({ collection, where, overrideAccess: true, depth: 0, pagination: false })).docs;
  const space = async slug => (await find('municipal-spaces', { legacyID: { equals: slug } }))[0];
  const lena = await space('lena'), mieres = await space('mieres');
  const account = async (email, s) => (await find('users', { email: { equals: email } }))[0]
    ?? payload.create({ collection: 'users', overrideAccess: true, user: users.admin, data: { name: `Cuenta ${email}`, email, password, role: 'municipal', municipalSpace: s.id } });
  const lenaUser = await account('lena-seguridad@planta14.example', lena), mieresUser = await account('mieres-seguridad@planta14.example', mieres);
  const login = ctx.panelSignIn;
  const cookieName = (await login(lenaUser.email)).split('=')[0];
  const tokenOf = cookie => cookie.slice(cookie.indexOf('=') + 1);
  const withToken = token => `${cookieName}=${token}`;
  // Petición al puente (o a otra ruta) como la haría un navegador desde la propia web, salvo lo que se cambie.
  const call = async (path, { method = 'POST', cookie, body, headers = { Origin: origin } } = {}) => {
    const r = await fetch(`${web}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json().catch(() => null), setCookie: r.headers.getSetCookie() };
  };
  const notice = title => ({ space: lena.id, type: 'notice', title, excerpt: 'Resumen.', body: 'Texto.', origin: 'municipality', publishedAt: '2026-11-07', _status: 'draft' });
  const works = async cookie => (await call('/api/panel/api/municipal-content?draft=true', { cookie, body: notice(`Prueba ${Math.random().toString(36).slice(2, 8)}`) })).status === 201;
  const panelShowsDrafts = async cookie => (await (await fetch(`${web}/lena/panel?pestana=publicaciones`, { headers: { Cookie: cookie } })).text()).includes('data-panel-tabs');

  // 1. Una cuenta municipal, por el puente, solo lo de su espacio y su concejo; nada de redacción ni administración.
  const lenaCookie = await login(lenaUser.email);
  const mieresItem = await payload.create({ collection: 'municipal-content', overrideAccess: true, data: { ...notice('Aviso de Mieres intocable'), space: mieres.id, _status: 'published' } });
  const mieresTown = (await find('towns', { slug: { equals: 'mieres' } }))[0];
  const mieresService = await payload.create({ collection: 'municipal-services', overrideAccess: true, data: { name: 'Servicio de Mieres intocable', town: mieresTown.id, category: 'cultura' } });
  const patchOther = await call(`/api/panel/api/municipal-content/${mieresItem.id}`, { method: 'PATCH', cookie: lenaCookie, body: { title: 'Cambiado por Lena' } });
  assert.ok(patchOther.status >= 400, `Lena cannot edit Mieres content (${patchOther.status})`);
  assert.equal((await payload.findByID({ collection: 'municipal-content', id: mieresItem.id, overrideAccess: true })).title, 'Aviso de Mieres intocable');
  const intoOther = await call('/api/panel/api/municipal-content?draft=true', { cookie: lenaCookie, body: { ...notice('Colado en Mieres'), space: mieres.id } });
  assert.ok(intoOther.status >= 400 || (await payload.findByID({ collection: 'municipal-content', id: intoOther.json.doc.id, overrideAccess: true, draft: true })).space === lena.id, 'cannot create content in another space');
  assert.ok((await call(`/api/panel/api/municipal-services/${mieresService.id}`, { method: 'DELETE', cookie: lenaCookie })).status >= 400, 'cannot delete another concejo’s service');
  assert.ok((await payload.findByID({ collection: 'municipal-services', id: mieresService.id, overrideAccess: true }).catch(() => null)), 'service still there');
  // No es un acceso general a la API: solo las llamadas del panel.
  for (const [method, path] of [['GET', 'users/me'], ['GET', 'municipal-content'], ['POST', 'articles'], ['POST', 'users'], ['PATCH', `users/${lenaUser.id}`], ['POST', 'notifications'],
    ['POST', 'globals/letters-settings'], ['GET', 'suggestions'], ['DELETE', `municipal-content/${mieresItem.id}`], ['POST', 'municipal-content/../users'], ['POST', 'users/login'], ['POST', 'users/logout']]) {
    const r = await call(`/api/panel/api/${path}`, { method, cookie: lenaCookie, body: method === 'GET' || method === 'DELETE' ? undefined : {} });
    assert.ok([404, 405].includes(r.status), `${method} ${path} through the bridge: ${r.status}`);
  }
  assert.equal((await call('/api/panel/api/municipal-content?depth=5&draft=true', { cookie: lenaCookie, body: notice('x') })).status, 400, 'no extra query parameters');
  // La sesión del CMS no sirve en el puente.
  const editorCms = await signIn(users.editor.email);
  assert.equal((await call('/api/panel/api/municipal-content?draft=true', { cookie: editorCms, body: notice('Desde el CMS') })).status, 401, 'a CMS session cannot use the bridge');
  assert.ok(await works(lenaCookie), 'Lena can save her own content');

  // 2. CSRF: nada que cambie datos desde otro sitio.
  for (const headers of [{ Origin: 'https://evil.example' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' }, {}]) {
    assert.equal((await call('/api/panel/api/municipal-content?draft=true', { cookie: lenaCookie, body: notice('CSRF'), headers })).status, 403, `bridge refuses ${JSON.stringify(headers)}`);
  }
  assert.equal((await call('/api/panel/salir', { cookie: lenaCookie, headers: { Origin: 'https://evil.example' } })).status, 403, 'logout from another site refused');
  assert.equal((await call('/api/panel/entrar', { body: { email: lenaUser.email, password }, headers: { Origin: 'https://evil.example' } })).status, 403, 'login from another site refused');
  assert.equal((await call('/api/panel/sesion', { cookie: lenaCookie, headers: { Origin: 'https://evil.example' } })).status, 403, 'renewal from another site refused');
  assert.ok(await works(lenaCookie), 'the session survives the attempts');

  // 3. «Cerrar sesión» invalida la sesión en el servidor: una copia de la cookie deja de valer.
  const copied = await login(lenaUser.email);
  const out = await call('/api/panel/salir', { cookie: copied });
  assert.ok(out.status === 200 && out.setCookie.some(c => c.startsWith(`${cookieName}=;`) && /Max-Age=0/.test(c)), 'logout clears the cookie');
  assert.equal(await works(copied), false, 'the copied cookie no longer works after logout');
  assert.equal(await panelShowsDrafts(copied), false, 'nor opens the panel');
  assert.ok(await works(lenaCookie), 'other sessions of the account are not affected');

  // 4. Contraseña cambiada o restablecida, rol o espacio cambiados, espacio desactivado o cuenta borrada: deja de valer.
  const beforeChange = await login(lenaUser.email);
  await payload.update({ collection: 'users', id: lenaUser.id, user: users.admin, overrideAccess: false, data: { password: `${password}-nueva` } });
  assert.equal(await works(beforeChange), false, 'password changed by the administration');
  assert.equal(await works(lenaCookie), false, 'every session of the account');
  await payload.update({ collection: 'users', id: lenaUser.id, overrideAccess: true, data: { password } });
  const beforeReset = await login(lenaUser.email);
  const resetToken = await payload.forgotPassword({ collection: 'users', data: { email: lenaUser.email }, disableEmail: true });
  await payload.resetPassword({ collection: 'users', data: { token: resetToken, password }, overrideAccess: true });
  assert.equal(await works(beforeReset), false, 'password reset');
  const beforeMove = await login(lenaUser.email);
  await payload.update({ collection: 'users', id: lenaUser.id, user: users.admin, overrideAccess: false, data: { municipalSpace: mieres.id } });
  assert.equal(await works(beforeMove), false, 'account moved to another space');
  await payload.update({ collection: 'users', id: lenaUser.id, user: users.admin, overrideAccess: false, data: { municipalSpace: lena.id } });
  const beforeOff = await login(lenaUser.email);
  await ctx.activate(['mieres']);
  assert.equal(await works(beforeOff), false, 'space deactivated');
  assert.equal((await call('/api/panel/entrar', { body: { email: lenaUser.email, password } })).status, 403, 'no login while the space is inactive');
  await ctx.activate(['lena', 'mieres']);
  assert.equal(await works(beforeOff), false, 'still invalid after reactivating the space');
  const throwaway = await account('lena-baja@planta14.example', lena);
  const beforeDelete = await login(throwaway.email);
  await payload.delete({ collection: 'users', id: throwaway.id, overrideAccess: true });
  assert.equal(await works(beforeDelete), false, 'account deleted');

  // 5. Cookie manipulada o copiada de otro sitio: sin acceso. Sin fijación de sesión.
  const good = tokenOf(await login(lenaUser.email));
  assert.ok(await works(withToken(good)));
  const [head, body, signature] = good.split('.');
  const forged = JSON.parse(Buffer.from(body, 'base64url').toString());
  const variants = {
    'firma cambiada': `${head}.${body}.${signature.slice(0, -2)}${signature.endsWith('AA') ? 'BB' : 'AA'}`,
    'datos cambiados (otra cuenta) con la firma original': `${head}.${Buffer.from(JSON.stringify({ ...forged, id: mieresUser.id, email: mieresUser.email })).toString('base64url')}.${signature}`,
    'sin firma (alg none)': `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${body}.`,
    'firmado con otra clave': await new SignJWT(forged).setProtectedHeader({ alg: 'HS256', authVersion: JWT_AUTH_VERSION, typ: 'JWT' }).sign(new TextEncoder().encode('otra-clave-cualquiera')),
    'caducado': await new SignJWT({ ...forged, iat: forged.iat - 30 * 86400, exp: forged.iat - 86400 }).setProtectedHeader({ alg: 'HS256', authVersion: JWT_AUTH_VERSION, typ: 'JWT' }).sign(new TextEncoder().encode(payload.secret)),
    'sesión de otra cuenta': await new SignJWT({ ...getFieldsToSign({ collectionConfig: payload.collections.users.config, email: mieresUser.email, user: { ...mieresUser, collection: 'users' } }), sid: forged.sid, aud: 'planta14-panel' })
      .setProtectedHeader({ alg: 'HS256', authVersion: JWT_AUTH_VERSION, typ: 'JWT' }).setIssuedAt().setExpirationTime('1d').sign(new TextEncoder().encode(payload.secret)),
    'token del CMS (Payload) como cookie del panel': (await signIn(lenaUser.email)).split('; ').find(c => c.startsWith('payload-token=')).slice('payload-token='.length),
    'basura': 'no-es-un-token',
  };
  for (const [what, token] of Object.entries(variants)) {
    assert.equal(await works(withToken(token)), false, `manipulated cookie: ${what}`);
    assert.equal(await panelShowsDrafts(withToken(token)), false, `manipulated cookie opens no panel: ${what}`);
  }
  // Fijación: al entrar siempre se crea una sesión nueva, aunque el navegador traiga otra; la cookie es __Host- (en
  // producción), con Secure, HttpOnly, SameSite=Lax, ruta / y sin Domain: otro subdominio no puede ponerla.
  const fixed = await call('/api/panel/entrar', { cookie: withToken(good), body: { email: lenaUser.email, password } });
  const issued = fixed.setCookie.find(c => c.startsWith(`${cookieName}=`));
  assert.ok(issued && !issued.includes(good) && /HttpOnly/.test(issued) && /SameSite=Lax/.test(issued) && /Path=\//.test(issued) && !/Domain=/i.test(issued) && /Secure/.test(issued) && cookieName === '__Host-planta14_panel', `fresh session on login: ${issued}`);
  assert.notEqual(JSON.parse(Buffer.from(tokenOf(issued.split(';')[0]).split('.')[1], 'base64url').toString()).sid, forged.sid, 'new session id');

  // 6. Mismo límite de intentos (Payload: 5 fallos bloquean la cuenta 10 minutos) y misma auditoría que el acceso normal.
  const limited = await account('lena-intentos@planta14.example', lena);
  for (let i = 0; i < 5; i++) assert.equal((await call('/api/panel/entrar', { body: { email: limited.email, password: 'contraseña-equivocada-123' } })).status, 401);
  const locked = await call('/api/panel/entrar', { body: { email: limited.email, password } });
  assert.equal(locked.status, 401, 'locked after five failures, even with the right password');
  assert.ok((await payload.findByID({ collection: 'users', id: limited.id, overrideAccess: true, showHiddenFields: true })).lockUntil, 'Payload lock recorded');
  const auditCookie = await login(lenaUser.email);
  const created = await call('/api/panel/api/municipal-content?draft=true', { cookie: auditCookie, body: notice('Aviso auditado por el puente') });
  assert.equal(created.status, 201);
  const audit = await find('audit-log', { documentID: { equals: String(created.json.doc.id) } });
  assert.ok(audit.some(e => e.action === 'create' && e.userEmail === lenaUser.email && e.userRole === 'municipal'), 'bridge writes are in the audit log with the municipal account');
  passed('panel session security: through /api/panel/api a municipal account only changes its own space and concejo (not another concejo, not newsroom or administration data) and only the panel calls exist (users, articles, globals, notifications, reads, extra parameters, path tricks: 404/405/400); CMS sessions cannot use it; CSRF refused (foreign Origin, cross-site or same-site, no headers) on the bridge, login, logout and renewal; logout revokes the session on the server (a copied cookie stops working); password change or reset, account moved, space deactivated (also after reactivating) or account deleted end the sessions; tampered, unsigned, foreign-key, expired, other-account, CMS-token and junk cookies give no access; login always creates a new session (no fixation) in a __Host- cookie (Secure, HttpOnly, SameSite=Lax, Path=/, no Domain); same login limit (five failures lock the account) and audit log as normal access');
}
