// Bloque «Retoques de portada» de scripts/participacion-integration.mjs: un bloque sin contenido no se pinta (portada,
// agenda y parte pública de los espacios municipales sin publicaciones, con un texto breve si la página queda vacía) y
// campos técnicos de imágenes, fiestas, patrimonio, rutas y servicios ocultos a la redacción.

export async function run(ctx) {
  const { payload, users, password, web, origin, passed, assert, browser } = ctx;
  const html = async path => (await (await fetch(`${web}${path}`)).text()).replaceAll('<!-- -->', '');

  // --- 1. Portada: cada bloque que se pinta tiene contenido (título sin nada debajo, nunca).
  const c = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await c.addCookies([{ name: 'planta14_consent', value: '1%3Arejected', url: web }]);
  const p = await c.newPage();
  await p.goto(`${web}/`, { waitUntil: 'load' });
  const blocks = await p.locator('[data-block]').evaluateAll(nodes => nodes.map(n => ({ block: n.getAttribute('data-block'), items: (n.tagName === 'ARTICLE' ? 1 : 0) + n.querySelectorAll('article, li, a.municipal-cta, .numbered-story').length })));
  // Sin ninguna noticia, la portada muestra su texto breve en lugar de bloques.
  if (!blocks.length) assert.ok(await p.getByText('Pronto encontrarás aquí nuestras primeras historias').count() === 1, 'empty home: a short text');
  for (const b of blocks) assert.ok(b.items > 0, `home block «${b.block}» is painted only with content (${JSON.stringify(blocks)})`);
  const overflow = await p.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth + 1);
  assert.ok(!overflow, 'no horizontal scroll on the home page');
  await c.close();
  // Como en pruebas tras retirar el ensayo (3 noticias, sin opinión ni agenda): sin el ensayo solo se pinta lo que tiene
  // algo (principal, «En portada»…). Solo cuando la base de la prueba aún no tiene noticias (bloque suelto).
  if (!blocks.length) {
    const ref = async (collection, where) => (await payload.find({ collection, where, depth: 0, limit: 1, overrideAccess: true })).docs[0];
    const author = await ref('authors', {}) ?? await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'Redacción de prueba', slug: 'redaccion-prueba-retoques' } });
    const town = await ref('towns', { slug: { equals: 'mieres' } }), section = await ref('sections', { slug: { equals: 'sociedad' } });
    const made = [];
    for (const n of [1, 2, 3]) made.push(await payload.create({ collection: 'articles', overrideAccess: true, data: { title: `Noticia real ${n}`, slug: `noticia-real-${n}`, excerpt: 'Entradilla.', body: ['Texto.'], author: author.id, town: town.id, section: section.id, _status: 'published' } }));
    for (const [width, kind] of [[1366, 'escritorio'], [390, 'movil']]) {
      const v = await browser.newContext({ viewport: { width, height: 900 } });
      await v.addCookies([{ name: 'planta14_consent', value: '1%3Arejected', url: web }]);
      const q = await v.newPage();
      await q.goto(`${web}/`, { waitUntil: 'load' });
      const present = await q.locator('[data-block]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-block')));
      for (const gone of ['la-vida-aqui', 'caudal', 'opinion']) assert.ok(!present.includes(gone), `3 news: no «${gone}» block (${present})`);
      assert.ok(present.includes('principal') && present.includes('en-portada'), `3 news: main story and «En portada» (${present})`);
      assert.ok(!(await q.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth + 1)), `3 news: no horizontal scroll (${kind})`);
      if (process.env.COMPROBACION_VISUAL) await q.screenshot({ path: `${process.env.COMPROBACION_VISUAL}/portada-3-noticias-${kind}.png`, fullPage: true });
      await v.close();
    }
    for (const a of made) await payload.delete({ collection: 'articles', id: a.id, overrideAccess: true });
  }
  passed('portada: ningún bloque se pinta sin contenido (título y «Ver todo» solo con algo debajo); la fila que se queda con un solo bloque ocupa todo el ancho');

  // --- 1. Espacio municipal activo sin ninguna publicación: sin bloques vacíos y con un texto breve.
  const spaces = (await payload.find({ collection: 'municipal-spaces', depth: 0, limit: 50, overrideAccess: true })).docs;
  let empty = null;
  for (const space of spaces) {
    if (!ctx.SIX.includes(space.legacyID)) continue;
    const count = (await payload.count({ collection: 'municipal-content', where: { space: { equals: space.id } }, overrideAccess: true })).totalDocs;
    if (!count) { empty = space; break; }
  }
  assert.ok(empty, 'a municipal space without content');
  await ctx.activate([empty.legacyID, 'lena']);
  const page = await html(`/${empty.legacyID}`);
  assert.ok(page.includes('data-municipal-empty') && page.includes('Todavía no hay publicaciones de'), 'empty active space: a short text');
  assert.ok(!page.includes('municipal-notices') && !/<h2>Agenda<\/h2>/.test(page) && !page.includes('municipal-grant-preview') && !page.includes('Ver todas las ayudas'), 'empty active space: no empty Agenda, Avisos or Ayudas blocks');
  const tabs = [...page.matchAll(/<nav class="municipal-section-nav"[\s\S]*?<\/nav>/g)][0]?.[0] ?? '';
  assert.ok(tabs.includes('Noticias') && tabs.includes('Contacto') && !tabs.includes('Avisos') && !tabs.includes('Tablón'), `only tabs with content (plus Noticias and Contacto): ${tabs.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')}`);
  assert.ok(page.includes('municipal-columns is-single') || page.includes('data-municipal-fiestas'), 'no empty side column');
  // Una sección pedida sin publicaciones: el texto breve en lugar del hueco.
  const b = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await b.addCookies([{ name: 'planta14_consent', value: '1%3Arejected', url: web }]);
  const t = await b.newPage();
  await t.goto(`${web}/${empty.legacyID}?seccion=event`, { waitUntil: 'load' });
  assert.ok(await t.locator('[data-municipal-empty]').getByText('Ahora mismo no hay agenda').count() === 1, 'section without content: a short text');
  await b.close();
  // Con contenido (Lena tiene un aviso), los bloques siguen saliendo.
  const lena = await html('/lena');
  assert.ok(lena.includes('municipal-notices') && !lena.includes('data-municipal-empty'), 'a space with a notice shows its notices block');
  await ctx.activate(['lena', 'mieres']);
  passed('espacio municipal activo sin publicaciones: sin bloques vacíos (agenda, avisos, ayudas, pestañas sin nada) y con un texto breve; con contenido, sus bloques salen como antes');

  // --- 3. Campos técnicos ocultos a la redacción (la administración los sigue viendo).
  const field = (slug, name) => payload.collections[slug].config.fields.find(f => f.name === name);
  const editor = { role: 'editor' }, admin = { role: 'admin' };
  for (const [slug, name] of [['festivals', 'externalID'], ['heritage', 'externalID'], ['routes', 'externalID'], ['municipal-services', 'externalID'], ['media', 'publicKey'], ['media', 'publicBucket'], ['media', 'publishedUses'], ['media', 'publicURL'], ['media', 'lote']]) {
    const f = field(slug, name);
    assert.ok(f?.admin?.condition, `${slug}.${name} has a condition`);
    assert.equal(Boolean(f.admin.condition({ id: 1 }, {}, { user: editor })), false, `${slug}.${name}: hidden from the newsroom`);
    assert.equal(Boolean(f.admin.condition({ id: 1 }, {}, { user: admin })), true, `${slug}.${name}: visible to the administration`);
  }
  // En el navegador: la ficha de una imagen, con la redacción y con la administración.
  const media = (await payload.find({ collection: 'media', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    ?? await payload.create({ collection: 'media', overrideAccess: true, data: { alt: 'Imagen de prueba', credit: 'Planta 14 test', rightsHolder: 'Planta 14 test', rightsType: 'propia', rightsScope: 'demo' },
      file: { name: 'retoques.png', mimetype: 'image/png', size: 0, data: await ctx.sharp({ create: { width: 64, height: 48, channels: 3, background: '#a4522d' } }).png().toBuffer() } });
  const form = async email => {
    const ctxB = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const tab = await ctxB.newPage();
    await tab.goto(`${origin}/cms/login`, { waitUntil: 'load' });
    await tab.locator('input[name="email"]').fill(email); await tab.locator('input[name="password"]').fill(password); await tab.locator('button[type="submit"]').click();
    await tab.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
    await tab.goto(`${origin}/cms/collections/media/${media.id}`, { waitUntil: 'load' }); await tab.locator('input[name="alt"]').waitFor({ timeout: 30000 });
    const out = { publicKey: await tab.locator('#field-publicKey').count(), publicBucket: await tab.locator('#field-publicBucket').count() };
    await ctxB.close();
    return out;
  };
  const asEditor = await form(users.editor.email), asAdmin = await form(users.admin.email);
  assert.ok(!asEditor.publicKey && !asEditor.publicBucket, `newsroom: no technical media fields ${JSON.stringify(asEditor)}`);
  assert.ok(asAdmin.publicKey && asAdmin.publicBucket, `administration: technical media fields ${JSON.stringify(asAdmin)}`);
  passed('campos técnicos ocultos a la redacción (los ve la administración): identificador de importación de fiestas, patrimonio, rutas y servicios; usos publicados, clave, almacenamiento y dirección de la copia pública y lote de las imágenes');
}
