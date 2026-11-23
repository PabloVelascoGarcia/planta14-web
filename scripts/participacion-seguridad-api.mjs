// Bloque «Cuentas municipales y la API de Payload» de scripts/participacion-integration.mjs (duda 36 de
// docs/INSTALAR-V2-PANEL.md): reglas de acceso de todas las colecciones y globales para el rol municipal (API local con
// su usuario) y la API directa (/api/cms) y el CMS (/cms), que una cuenta municipal no puede usar fuera del panel.
export async function run(ctx) {
  const { payload, users, password, web, origin, passed, assert } = ctx;
  await ctx.activate(['lena', 'mieres']);
  const find = async (collection, where) => (await payload.find({ collection, where, overrideAccess: true, depth: 0, pagination: false })).docs;
  const space = async slug => (await find('municipal-spaces', { legacyID: { equals: slug } }))[0];
  const lena = await space('lena'), mieres = await space('mieres');
  const lenaTown = (await find('towns', { slug: { equals: 'lena' } }))[0], mieresTown = (await find('towns', { slug: { equals: 'mieres' } }))[0];
  const email = 'lena-api@planta14.example';
  const lenaUser = (await find('users', { email: { equals: email } }))[0]
    ?? await payload.create({ collection: 'users', overrideAccess: true, user: users.admin, data: { name: 'Cuenta API Lena', email, password, role: 'municipal', municipalSpace: lena.id } });
  const asLena = { ...lenaUser, collection: 'users' };

  // Datos de otros: contenido y servicio de Mieres, una foto de Mieres, una etiqueta, una noticia, una carta…
  const mieresItem = await payload.create({ collection: 'municipal-content', overrideAccess: true, data: { space: mieres.id, type: 'notice', title: 'Aviso de Mieres (API)', excerpt: 'R.', body: 'T.', origin: 'municipality', publishedAt: '2026-11-20', _status: 'published' } });
  const mieresService = await payload.create({ collection: 'municipal-services', overrideAccess: true, data: { name: 'Servicio de Mieres (API)', town: mieresTown.id, category: 'cultura' } });
  const lenaService = await payload.create({ collection: 'municipal-services', overrideAccess: true, data: { name: 'Servicio de Lena (API)', town: lenaTown.id, category: 'cultura' } });
  const tag = (await find('tags', { slug: { equals: 'prueba-api' } }))[0] ?? await payload.create({ collection: 'tags', overrideAccess: true, user: users.editor, data: { name: 'Prueba API' } });

  // 1. API local con el usuario municipal (las mismas reglas que aplica Payload a /api/cms y al puente).
  const read = async (collection, where) => (await payload.find({ collection, user: asLena, overrideAccess: false, depth: 0, pagination: false, ...(where ? { where } : {}) }).catch(() => ({ docs: [] }))).docs;
  const none = ['articles', 'festivals', 'letters', 'authors', 'sections', 'towns', 'tags', 'notifications', 'audit-log', 'subscribers', 'newsletters', 'suggestions', 'public-media-ops', 'heritage', 'routes'];
  for (const collection of none) assert.equal((await read(collection)).length, 0, `municipal account reads nothing from ${collection}`);
  assert.deepEqual((await read('users')).map(u => u.id), [lenaUser.id], 'users: only itself');
  assert.ok((await read('municipal-content')).every(d => d.space === lena.id), 'municipal-content: only its space');
  assert.ok(!(await read('municipal-content')).some(d => d.id === mieresItem.id), 'never Mieres content');
  assert.deepEqual((await read('municipal-spaces')).map(s => s.id), [lena.id], 'municipal-spaces: only its own');
  assert.ok((await read('municipal-services')).every(s => s.town === lenaTown.id) && (await read('municipal-services')).some(s => s.id === lenaService.id), 'municipal-services: only its concejo');
  assert.ok((await read('util-visibility')).every(v => v.town === lenaTown.id), 'util-visibility: only its concejo');
  assert.ok((await read('media')).every(m => m.uploadedBySpace === lena.id), 'media: only its uploads');
  for (const slug of ['newsroom-settings', 'breaking-news', 'mottos', 'footer-settings', 'principles', 'fiestas-settings', 'letters-settings']) {
    const denied = await payload.findGlobal({ slug, user: asLena, overrideAccess: false, depth: 0 }).then(() => false).catch(() => true);
    assert.ok(denied, `global ${slug} is not readable by a municipal account`);
  }
  const writeDenied = async fn => fn().then(() => false).catch(() => true);
  assert.ok(await writeDenied(() => payload.update({ collection: 'municipal-content', id: mieresItem.id, user: asLena, overrideAccess: false, data: { title: 'Cambiado' } })), 'cannot update Mieres content');
  assert.ok(await writeDenied(() => payload.delete({ collection: 'municipal-services', id: mieresService.id, user: asLena, overrideAccess: false })), 'cannot delete a Mieres service');
  assert.ok(await writeDenied(() => payload.create({ collection: 'tags', user: asLena, overrideAccess: false, data: { name: 'Colada' } })), 'cannot create tags');
  assert.ok(await writeDenied(() => payload.update({ collection: 'tags', id: tag.id, user: asLena, overrideAccess: false, data: { name: 'Cambiada' } })), 'cannot edit tags');
  assert.ok(await writeDenied(() => payload.create({ collection: 'articles', user: asLena, overrideAccess: false, data: { title: 'x' } })), 'cannot create articles');
  assert.ok(await writeDenied(() => payload.update({ collection: 'users', id: lenaUser.id, user: asLena, overrideAccess: false, data: { role: 'admin' } })), 'cannot change its own account');
  assert.ok(await writeDenied(() => payload.updateGlobal({ slug: 'breaking-news', user: asLena, overrideAccess: false, data: { text: 'x' } })), 'cannot change globals');
  passed('cuentas municipales (reglas de acceso): con la API local y su usuario, una cuenta municipal no lee nada de noticias, fiestas, cartas, autores, secciones, concejos, etiquetas, pendientes, auditoría, suscriptores, boletines, sugerencias, copias públicas, patrimonio ni rutas, ni los ajustes globales; de usuarios, solo la suya; de contenidos, espacios, directorio, visibilidad de «Útil» e imágenes, solo lo de su espacio y su concejo; no puede crear ni cambiar nada de otros (contenido y servicios de Mieres, etiquetas, noticias, su propia cuenta, globales)');

  // 2. API directa (/api/cms) y CMS (/cms): una cuenta municipal no los usa nunca, solo el panel.
  const http = async (path, { method = 'GET', headers = {}, body } = {}) => {
    const r = await fetch(`${web}${path}`, { method, redirect: 'manual', headers: { 'Sec-Fetch-Site': 'same-origin', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, text: await r.text(), setCookie: r.headers.getSetCookie() };
  };
  const login = await http('/api/cms/users/login', { method: 'POST', body: { email, password } });
  assert.equal(login.status, 403, `municipal login on /api/cms/users/login is refused (${login.status})`);
  assert.ok(!login.setCookie.some(c => c.startsWith('payload-token=')), 'no Payload cookie for a municipal account');
  // Aunque tuviera un token de Payload (p. ej. uno antiguo) o el del panel: 403 en toda la API directa.
  const { token: payloadToken } = await payload.login({ collection: 'users', data: { email, password } });
  const panelCookie = await ctx.panelSignIn(email);
  const panelToken = decodeURIComponent(panelCookie.slice(panelCookie.indexOf('=') + 1));
  const credentials = [{ Cookie: `payload-token=${payloadToken}` }, { Authorization: `JWT ${payloadToken}` }, { Cookie: panelCookie }, { Authorization: `JWT ${panelToken}` }];
  const calls = [['GET', 'users/me'], ['GET', `municipal-content/${mieresItem.id}`], ['GET', 'municipal-content'], ['GET', 'media'], ['GET', 'municipal-services'], ['GET', 'globals/breaking-news'],
    ['POST', 'municipal-content'], ['PATCH', `municipal-services/${lenaService.id}`], ['POST', 'users/refresh-token'], ['GET', 'payload-locked-documents'], ['GET', 'payload-preferences']];
  for (const headers of credentials) for (const [method, path] of calls) {
    const r = await http(`/api/cms/${path}`, { method, headers: { ...headers, Origin: origin }, body: method === 'GET' ? undefined : { title: 'x', name: 'x' } });
    assert.equal(r.status, 403, `${method} /api/cms/${path} with ${Object.keys(headers)[0]}: ${r.status}`);
  }
  assert.equal((await payload.findByID({ collection: 'municipal-services', id: lenaService.id, overrideAccess: true })).name, 'Servicio de Lena (API)', 'nothing changed through the direct API');
  // El CMS (/cms): sin panel de administración para una cuenta municipal.
  for (const headers of [{ Cookie: `payload-token=${payloadToken}` }, { Cookie: panelCookie }]) {
    const page = await http('/cms', { headers });
    assert.ok(!page.text.includes('data-dashboard') && !/Nueva noticia|Crear nuevo/.test(page.text), `no CMS dashboard for a municipal account (${page.status})`);
    assert.ok((await http('/cms/collections/articles', { headers })).text.indexOf('collection-list') === -1, 'no CMS lists');
  }
  // La redacción y la administración siguen usando la API directa.
  const editor = await http('/api/cms/users/login', { method: 'POST', body: { email: users.editor.email, password } });
  assert.equal(editor.status, 200, 'newsroom login still works');
  const editorCookie = editor.setCookie.map(c => c.split(';')[0]).join('; ');
  assert.equal((await http('/api/cms/articles?limit=1', { headers: { Cookie: editorCookie } })).status, 200, 'newsroom API still works');
  // Y el panel, por su puente, también.
  const viaBridge = await fetch(`${web}/api/panel/api/municipal-content?draft=true`, { method: 'POST', headers: { Cookie: panelCookie, Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ space: lena.id, type: 'notice', title: 'Desde el panel (API)', excerpt: 'R.', body: 'T.', origin: 'municipality', publishedAt: '2026-11-20', _status: 'draft' }) });
  assert.equal(viaBridge.status, 201, 'the panel bridge still works');
  passed('cuentas municipales (API directa y CMS): «Entrar» por /api/cms/users/login responde 403 y no da cookie de Payload; con un token de Payload o el del panel, en cookie o en cabecera, toda la API directa responde 403 (leer, crear, cambiar, renovar el token, documentos bloqueados, preferencias, globales) y no cambia nada; /cms no muestra el panel de administración; la redacción sigue entrando y usando la API, y el panel municipal sigue guardando por su puente');

  // 3. Restablecer la contraseña por el puente: funciona, pero el panel nunca recibe la cookie ni el token de Payload.
  const resetToken = await payload.forgotPassword({ collection: 'users', data: { email }, disableEmail: true });
  const reset = await fetch(`${web}/api/panel/api/users/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ token: resetToken, password }) });
  const resetBody = await reset.json().catch(() => null);
  assert.equal(reset.status, 200, `reset through the bridge: ${reset.status} ${JSON.stringify(resetBody)}`);
  assert.ok(!reset.headers.getSetCookie().length && !resetBody?.token, 'no Payload cookie or token after the reset');
  const direct = await http('/api/cms/users/reset-password', { method: 'POST', body: { token: await payload.forgotPassword({ collection: 'users', data: { email }, disableEmail: true }), password } });
  assert.equal(direct.status, 403, `direct reset on /api/cms for a municipal account: ${direct.status}`);
  passed('cuentas municipales (contraseña): restablecerla desde el panel pasa por su puente y nunca devuelve la cookie ni el token de Payload; por la API directa, 403');
}
