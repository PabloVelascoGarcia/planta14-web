// Bloque «Redacción: noticias e imágenes» de scripts/participacion-integration.mjs (entrega del 24/11): sección enlazada,
// varios concejos y secciones, etiquetas, imágenes y galerías en el texto, /multimedia, punto de interés, fotos
// verticales, carteles, plantillas, ilustraciones generadas con IA e imagen para redes.
export async function run(ctx) {
  const { payload, users, page, passed, assert, web, start, stop } = ctx;
  await ctx.activate(['lena', 'mieres']);
  const sharp = ctx.sharp;
  const one = async (collection, slug) => (await payload.find({ collection, where: { slug: { equals: slug } }, overrideAccess: true, depth: 0 })).docs[0];
  const [mieres, lena, aller, caudal] = await Promise.all(['mieres', 'lena', 'aller', 'caudal'].map(s => one('towns', s)));
  const [sociedad, cultura, economia, deportes] = await Promise.all(['sociedad', 'cultura', 'economia', 'deportes'].map(s => one('sections', s)));
  const author = (await payload.find({ collection: 'authors', limit: 1, overrideAccess: true })).docs[0]
    ?? await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'Redacción', slug: 'redaccion' } });
  const editor = { user: users.editor, overrideAccess: false };
  let n = 0;
  // Con MANUAL_REDACCION (capturas del manual), paisajes y un cartel dibujados en SVG; si no, colores lisos.
  const art = (width, height, i, poster) => Buffer.from(poster
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f3e3c2"/><rect x="6%" y="5%" width="88%" height="90%" fill="none" stroke="#7a2e3a" stroke-width="18"/><text x="50%" y="22%" font-family="DejaVu Serif" font-weight="bold" font-size="${width / 9}" text-anchor="middle" fill="#7a2e3a">FIESTAS</text><text x="50%" y="34%" font-family="DejaVu Serif" font-size="${width / 14}" text-anchor="middle" fill="#7a2e3a">de Santa Bárbara</text><circle cx="50%" cy="56%" r="${width / 5}" fill="#e0a43a"/><text x="50%" y="82%" font-family="DejaVu Sans" font-size="${width / 22}" text-anchor="middle" fill="#3a2a20">Mieres · 4 de diciembre</text><text x="50%" y="88%" font-family="DejaVu Sans" font-size="${width / 30}" text-anchor="middle" fill="#3a2a20">Verbena · Misa · Comida popular</text></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${['#9cc3e0', '#f2b880', '#b9d4e8', '#c9dfc2'][i % 4]}"/><stop offset="1" stop-color="#f4efe6"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#s)"/><path d="M0 ${height * 0.62} Q ${width * 0.25} ${height * 0.42} ${width * 0.5} ${height * 0.6} T ${width} ${height * 0.5} V ${height} H 0 Z" fill="${['#4f6b4a', '#6d7f45', '#3f5d4a', '#5b6e3c'][i % 4]}"/><path d="M0 ${height * 0.78} Q ${width * 0.4} ${height * 0.62} ${width} ${height * 0.8} V ${height} H 0 Z" fill="#2f4030"/><rect x="${width * 0.18}" y="${height * 0.36}" width="${width * 0.05}" height="${height * 0.3}" fill="#5a3b2a"/><rect x="${width * 0.15}" y="${height * 0.33}" width="${width * 0.11}" height="${height * 0.04}" fill="#7a5038"/></svg>`);
  const image = async (width, height, data = {}, poster = false) => {
    const file = `${ctx.directory}/redaccion-${++n}.jpg`;
    if (process.env.MANUAL_REDACCION) await sharp(art(width, height, n, poster)).jpeg({ quality: 85 }).toFile(file);
    else await sharp({ create: { width, height, channels: 3, background: ['#557766', '#995533', '#335599', '#777733'][n % 4] } }).jpeg().toFile(file);
    return payload.create({ collection: 'media', ...editor, filePath: file, data: { alt: `Imagen ${n}`, credit: `Autora ${n}`, rightsHolder: 'Planta 14', rightsType: 'propia', rightsConfirm: true, ...data } });
  };
  const text = t => ({ type: 'paragraph', direction: 'ltr', format: '', indent: 0, version: 1, textFormat: 0, textStyle: '', children: [{ type: 'text', text: t, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] });
  const block = fields => ({ type: 'block', version: 2, format: '', fields: { id: Math.random().toString(16).slice(2, 26), blockName: '', ...fields } });
  const body = (...children) => ({ root: { type: 'root', direction: 'ltr', format: '', indent: 0, version: 1, children } });
  const article = data => payload.create({ collection: 'articles', ...editor, data: { excerpt: 'Entradilla.', body: body(text('Texto de la noticia.')), author: author.id, town: mieres.id, section: sociedad.id, _status: 'published', ...data } });
  const html = async path => page(`${web}${path}`);

  // --- 2, 3 y 4. Varios concejos y secciones, etiquetas.
  const mineria = await payload.create({ collection: 'tags', ...editor, data: { name: 'Minería' } });
  assert.equal(mineria.slug, 'mineria', 'tag slug without accents');
  for (const name of ['MINERÍA', 'mineria', '  Minería ']) await assert.rejects(payload.create({ collection: 'tags', ...editor, data: { name } }), /Ya existe la etiqueta «Minería»/, `no duplicate for «${name}»`);
  const hunosa = await payload.create({ collection: 'tags', ...editor, data: { name: 'Hunosa' } });
  const extraTags = [];
  for (const name of ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco']) extraTags.push((await payload.create({ collection: 'tags', ...editor, data: { name: `Etiqueta ${name}` } })).id);
  const photo = await image(2000, 1200);
  await payload.update({ collection: 'media', id: photo.id, overrideAccess: true, data: { focalX: 20, focalY: 30 } });
  const multi = await article({ title: 'Plan de empleo para tres concejos', otherTowns: [lena.id, aller.id, mieres.id], secondarySections: [cultura.id, economia.id], tags: [mineria.id, hunosa.id], image: photo.id });
  assert.deepEqual(multi.otherTowns.map(t => t.id ?? t), [lena.id, aller.id], 'the principal is not repeated among the other concejos');
  await assert.rejects(article({ title: 'Tres secundarias', secondarySections: [cultura.id, economia.id, deportes.id] }), 'at most 2 secondary sections');
  await assert.rejects(article({ title: 'Seis etiquetas', tags: [mineria.id, ...extraTags] }), 'at most 5 tags');
  await assert.rejects(article({ title: 'Caudal y más', town: caudal.id, otherTowns: [lena.id] }), /Caudal/, 'Caudal does not combine with other concejos');
  await assert.rejects(article({ title: 'Caudal secundario', otherTowns: [caudal.id] }), /Caudal/, 'Caudal is never a secondary concejo');
  const multiPage = await html(`/noticia/${multi.slug}`);
  assert.ok(/<a (?=[^>]*href="\/tema\/sociedad")(?=[^>]*data-article-section)[^>]*>/.test(multiPage), `the section links to /tema/sociedad in the breadcrumbs: ${multiPage.match(/.{300}data-article-section.{100}/)?.[0] ?? multiPage.slice(0, 500)}`);
  assert.ok(multiPage.includes('data-article-tags') && multiPage.includes('href="/etiqueta/mineria"') && multiPage.includes('href="/etiqueta/hunosa"'), '«Temas:» with linked tags');
  assert.ok(multiPage.includes('object-position:20% 30%'), 'the main photo respects its focal point');
  for (const path of ['/mieres', '/lena', '/concejo/aller', '/tema/cultura', '/tema/economia', '/tema/sociedad', '/etiqueta/mineria']) assert.ok((await html(path)).includes('Plan de empleo para tres concejos'), `on ${path}`);
  assert.ok((await html('/tema/sociedad')).includes('data-card-section'), 'cards link their section');
  assert.ok(!(await html('/concejo/morcin')).includes('Plan de empleo para tres concejos'), 'not on other concejos');
  const comarcal = await article({ title: 'Noticia comarcal del Caudal', town: caudal.id });
  assert.ok((await html('/comarca/caudal')).includes(comarcal.title) && (await html('/')).includes(comarcal.title), 'Caudal: front page and /comarca/caudal');
  for (const path of ['/mieres', '/lena', '/concejo/aller']) assert.ok(!(await html(path)).includes(comarcal.title), `Caudal not on ${path}`);
  passed('redacción (clasificación): la sección enlaza a su página en las migas y las tarjetas; una noticia con concejo principal y «otros concejos» sale en la página de todos ellos y no en los demás, sin repetir el principal; «Caudal» sale en portada y en /comarca/caudal, no se combina con otros concejos ni puede ser secundario; con dos secciones secundarias sale en sus páginas (máximo 2); etiquetas con slug sin tildes y sin duplicados por mayúsculas o tildes (máximo 5), al pie como «Temas:» enlazadas');

  // Estadísticas: cuenta en las de cada concejo, sin duplicar el total.
  const beacon = body => fetch(`${web}/api/v`, { method: 'POST', headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0' }, body: JSON.stringify(body) });
  await beacon({ p: `/noticia/${multi.slug}`, r: '', u: '', t: 'mieres', s: 'sociedad', x: 'lena,aller,mieres,inventado' });
  const { statsReport, madridDay } = await import('../lib/stats.ts');
  const day = madridDay();
  const visits = async town => (await statsReport(day, day, town)).topPages.find(p => p.path === `/noticia/${multi.slug}`)?.views ?? 0;
  assert.deepEqual([await visits('mieres'), await visits('lena'), await visits('aller'), await visits('morcin')], [1, 1, 1, 0], 'counted in the stats of each of its concejos');
  assert.equal(await visits(null), 1, 'once in the total');
  passed('redacción (estadísticas): una visita a una noticia en varios concejos cuenta en las estadísticas de cada uno (y en ninguno más), y una sola vez en el total');

  // Etiquetas: /etiqueta/[slug], paginada; indexable solo con al menos 2 noticias.
  const vertical = await image(1000, 1600);
  const verticalArticle = await article({ title: 'Foto vertical de la mina', image: vertical.id, tags: [mineria.id] });
  const tagPage = await html('/etiqueta/mineria');
  assert.ok(tagPage.includes('data-tag-page="mineria"') && tagPage.includes(verticalArticle.title) && tagPage.includes(multi.title), 'tag page with its articles');
  assert.equal((await fetch(`${web}/etiqueta/no-existe`)).status, 404, 'unknown tag: 404');
  for (let i = 0; i < 24; i++) await payload.create({ collection: 'articles', overrideAccess: true, data: { title: `Relleno de minería ${i}`, excerpt: 'E.', body: ['T.'], author: author.id, town: mieres.id, section: sociedad.id, tags: [mineria.id], _status: 'published' } });
  const second = await html('/etiqueta/mineria?pagina=2');
  assert.ok(second.includes('data-pagination') && second.includes('Página 2 de 2'), 'paginated');

  // --- 7. Foto vertical entera en la noticia; 8. carteles.
  assert.ok((await html(`/noticia/${verticalArticle.slug}`)).includes('data-article-image-whole'), 'a vertical main photo is shown whole');
  assert.ok(!multiPage.includes('data-article-image-whole'), 'a horizontal one keeps its 16:10 crop');
  const poster = await image(1240, 1754, {}, true);
  const posterArticle = await article({ title: 'Cartel de las fiestas de Santa Bárbara', image: poster.id, imagePoster: true, section: cultura.id });
  assert.ok((await html(`/noticia/${posterArticle.slug}`)).includes('data-article-image-whole'), 'poster whole in the article');
  const culture = await html('/tema/cultura');
  assert.ok(culture.slice(culture.indexOf('aria-label="Leer: Cartel de las fiestas de Santa Bárbara"')).slice(0, 1500).includes('data-image-whole'), 'poster whole inside its card');
  passed('redacción (fotos y carteles): página /etiqueta/[slug] con sus noticias, paginada (24 por página), 404 si no existe; la foto principal vertical se ve entera; con «Mostrar entera (cartel)» se ve completa en la noticia y dentro de su hueco en las tarjetas; la horizontal mantiene su recorte respetando el punto de interés');

  // --- 5 y 10. Imagen y galería en el texto; ilustración generada con IA.
  const ai = await image(1600, 1000, { imageKind: 'ia' });
  await assert.rejects(payload.update({ collection: 'media', id: ai.id, ...editor, data: { imageKind: 'foto' } }), /no se puede cambiar/, 'an AI illustration can never become a photograph');
  const g = [await image(1600, 1000), await image(1600, 1000), await image(1000, 1500)];
  const withGallery = await article({ title: 'Galería del descenso del Nalón', section: deportes.id,
    body: body(text('Antes de la galería.'), block({ blockType: 'imagen', image: ai.id, caption: 'Recreación del puente', credit: '' }),
      block({ blockType: 'galeria', images: g.map((m, i) => ({ id: `g${i}`, image: m.id, caption: `Foto ${i + 1} del descenso`, credit: i === 1 ? 'Crédito propio' : '' })) }), text('Después.')) });
  const galleryPage = await html(`/noticia/${withGallery.slug}`);
  assert.ok(galleryPage.includes('data-gallery="3"') && galleryPage.includes('Foto 3 del descenso') && galleryPage.includes('Crédito propio') && galleryPage.includes('Autora'), 'gallery with captions and credits');
  assert.ok(galleryPage.includes('data-body-image') && galleryPage.includes('Recreación del puente') && galleryPage.includes('data-ai-label') && galleryPage.includes('Ilustración generada con IA'), 'image block with the AI label');
  assert.ok(/srcSet="[^"]+ 800w/.test(galleryPage), 'body images with srcset');
  const stored = await payload.findByID({ collection: 'articles', id: withGallery.id, overrideAccess: true, depth: 0 });
  assert.ok(stored.hasGallery && [ai.id, ...g.map(m => m.id)].every(id => stored.bodyImages.includes(id)), 'body images and gallery flag kept by the server');
  for (const m of [ai, ...g]) assert.ok((await payload.findByID({ collection: 'media', id: m.id, overrideAccess: true })).publicKey, 'body images get their public copy');
  const noRights = await payload.create({ collection: 'media', overrideAccess: true, filePath: `${ctx.directory}/redaccion-1.jpg`, data: { alt: 'Sin derechos', credit: 'X', rightsHolder: 'X', rightsType: 'propia', rightsScope: 'demo' } });
  await assert.rejects(article({ title: 'Imagen sin derechos', body: body(block({ blockType: 'imagen', image: noRights.id, caption: 'Pie' })) }), /derechos publicables/, 'the same rights check as the main image');
  // La ilustración con IA como foto principal: rótulo en la tarjeta y en el pie.
  const aiMain = await article({ title: 'Ilustración del futuro pozo', image: ai.id });
  const aiPage = await html(`/noticia/${aiMain.slug}`);
  assert.ok(aiPage.includes('data-ai-label') && aiPage.includes('data-ai-caption') && !aiPage.includes('Fotografía: Autora'), 'AI label over the image and in its caption, never «Fotografía»');
  // La ilustración principal mide lo que la imagen (no la columna entera): el cuerpo empieza justo debajo y el pie de la
  // página queda después del cuerpo, en ordenador y en móvil. El rótulo, en la esquina inferior izquierda de la imagen.
  // Y en el resto de sitios donde sale una imagen de IA (bloque Imagen, tarjetas, /multimedia, concejo, sección), el
  // rótulo siempre dentro de su imagen.
  {
    const pw = ctx.browser ?? await (await import('playwright')).chromium.launch();
    const badgeInside = async (tab, where) => {
      const boxes = await tab.locator('[data-ai-label]').evaluateAll(nodes => nodes.filter(n => n.offsetParent !== null).map(n => {
        const holder = n.parentElement, img = holder.querySelector('img'), b = n.getBoundingClientRect(), r = img.getBoundingClientRect(), h = holder.getBoundingClientRect();
        return { badge: [b.left, b.top, b.right, b.bottom].map(Math.round), img: [r.left, r.top, r.right, r.bottom].map(Math.round), holder: Math.round(h.height), imgHeight: Math.round(r.height) };
      }));
      for (const x of boxes) {
        const [bl, bt, br, bb] = x.badge, [il, it, ir, ib] = x.img;
        assert.ok(bl >= il - 1 && br <= ir + 1 && bt >= it - 1 && bb <= ib + 1 && bl - il <= 24 && ib - bb <= 24, `${where}: AI label on the bottom-left corner of its image ${JSON.stringify(x)}`);
        assert.ok(x.holder <= x.imgHeight + 40, `${where}: the AI wrapper is as tall as its image ${JSON.stringify(x)}`);
      }
      return boxes.length;
    };
    for (const [width, height, kind] of [[1366, 900, 'desktop'], [390, 844, 'mobile']]) {
      const v = await pw.newContext({ viewport: { width, height } });
      await v.addCookies([{ name: 'planta14_consent', value: '1%3Arejected', url: web }]);
      const tab = await v.newPage();
      await tab.goto(`${web}/noticia/${aiMain.slug}`, { waitUntil: 'load' });
      const geo = await tab.evaluate(() => {
        const r = s => document.querySelector(s)?.getBoundingClientRect();
        const wrap = r('article [data-ai-image]') ?? r('[data-ai-image]'), img = document.querySelector('[data-ai-image] img').getBoundingClientRect();
        const body = r('[data-article-body]'), footer = r('[data-site-footer]'), credit = r('[data-article-credit]');
        const y = rect => rect ? { top: Math.round(rect.top + scrollY), bottom: Math.round(rect.bottom + scrollY), height: Math.round(rect.height) } : null;
        return { wrap: y(wrap), img: y(img), credit: y(credit), body: y(body), footer: y(footer) };
      });
      assert.ok(Math.abs(geo.wrap.height - geo.img.height) <= 2, `${kind}: the AI wrapper is as tall as the image ${JSON.stringify(geo)}`);
      assert.ok(geo.credit.top >= geo.img.bottom && geo.credit.top - geo.img.bottom <= 24, `${kind}: credit right under the image ${JSON.stringify(geo)}`);
      assert.ok(geo.body.top > geo.img.bottom && geo.body.top - geo.img.bottom <= 120, `${kind}: body starts right under the image ${JSON.stringify(geo)}`);
      assert.ok(geo.footer.top >= geo.body.bottom, `${kind}: footer after the body ${JSON.stringify(geo)}`);
      assert.ok(await badgeInside(tab, `${kind} article`) >= 1, `${kind}: AI label on the main image`);
      if (process.env.COMPROBACION_VISUAL) await tab.screenshot({ path: `${process.env.COMPROBACION_VISUAL}/noticia-ia-${kind}.png`, fullPage: true });
      for (const path of [`/noticia/${withGallery.slug}`, '/multimedia', '/', '/concejo/aller', '/mieres', '/tema/sociedad', '/tema/cultura']) {
        await tab.goto(`${web}${path}`, { waitUntil: 'load' });
        const found = await badgeInside(tab, `${kind} ${path}`);
        if (['/tema/sociedad', '/mieres', `/noticia/${withGallery.slug}`].includes(path)) assert.ok(found >= 1, `${kind} ${path}: an AI image checked`);
        if (process.env.COMPROBACION_VISUAL) await tab.screenshot({ path: `${process.env.COMPROBACION_VISUAL}/ia-${kind}${path.replace(/[^a-z0-9]+/gi, '-')}.png`, fullPage: true });
      }
      await v.close();
    }
  }
  passed('redacción (imágenes en el texto): bloques «Imagen» (pie y crédito, el de la imagen si se deja vacío) y «Galería» (cuadrícula con pies y créditos) con srcset; sus imágenes pasan la misma comprobación de derechos y tienen copia pública; «Ilustración generada con IA» lleva siempre su rótulo sobre la imagen y en el pie, nunca «Fotografía», y no se puede cambiar a fotografía');

  // Lightbox: teclado y deslizando.
  const browser = ctx.browser ?? await (await import('playwright')).chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const tab = await context.newPage();
  await tab.goto(`${web}/noticia/${withGallery.slug}`, { waitUntil: 'load' });
  await tab.locator('[data-gallery-item="0"]').click();
  await tab.locator('[data-lightbox]').waitFor();
  assert.equal(await tab.locator('[data-lightbox-count]').textContent(), '1 / 3');
  await tab.keyboard.press('ArrowRight');
  assert.equal(await tab.locator('[data-lightbox-count]').textContent(), '2 / 3', 'keyboard: next');
  await tab.keyboard.press('ArrowLeft'); await tab.keyboard.press('ArrowLeft');
  assert.equal(await tab.locator('[data-lightbox-count]').textContent(), '3 / 3', 'keyboard: previous wraps');
  await tab.locator('[data-lightbox]').dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 300, clientY: 400 }], changedTouches: [{ identifier: 1, clientX: 300, clientY: 400 }] });
  await tab.locator('[data-lightbox]').dispatchEvent('touchend', { touches: [], changedTouches: [{ identifier: 1, clientX: 80, clientY: 400 }] });
  assert.equal(await tab.locator('[data-lightbox-count]').textContent(), '1 / 3', 'swipe left: next');
  await tab.keyboard.press('Escape');
  await tab.locator('[data-lightbox]').waitFor({ state: 'detached' });
  assert.equal(await tab.evaluate(() => document.activeElement?.getAttribute('data-gallery-item')), '0', 'focus back to the thumbnail');
  // Sin desplazamiento horizontal a 390 px (sin emulación de móvil, que ensancharía la ventana y lo ocultaría).
  for (const path of [`/noticia/${withGallery.slug}`, `/noticia/${multi.slug}`, '/', '/etiqueta/mineria']) {
    await tab.goto(`${web}${path}`, { waitUntil: 'load' });
    assert.ok(await tab.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1), `no horizontal scroll at 390 px on ${path}`);
  }
  await context.close();
  if (!ctx.browser) await browser.close();
  passed('redacción (galería): al pulsar una imagen se abre en grande; flechas del teclado, deslizar en el móvil y Escape (el foco vuelve a la miniatura); sin desplazamiento horizontal a 390 px');

  // --- 6. /multimedia: existe siempre; en el menú y en los buscadores solo con 6 galerías.
  assert.ok((await html('/multimedia')).includes(withGallery.title), '/multimedia lists it');
  assert.ok(!(await html('/')).includes('data-nav-multimedia'), 'not in the menu with fewer than 6');
  for (let i = 0; i < 5; i++) await article({ title: `Galería extra ${i}`, body: body(block({ blockType: 'galeria', images: g.slice(0, 2).map((m, j) => ({ id: `x${i}${j}`, image: m.id, caption: 'Pie' })) })) });
  assert.ok((await html('/')).includes('data-nav-multimedia'), 'in the menu with 6');

  // --- 9. Plantillas.
  const noPhoto = await article({ title: 'Sin foto: plantilla de Deportes', section: deportes.id });
  const chosen = await article({ title: 'Sin foto: plantilla elegida', template: 'fiestas' });
  assert.ok((await html(`/noticia/${noPhoto.slug}`)).includes('src="/plantillas/deportes.png"') && (await html(`/noticia/${noPhoto.slug}`)).includes('Imagen: Planta 14'), 'section template by default, credit Planta 14');
  assert.ok((await html(`/noticia/${chosen.slug}`)).includes('src="/plantillas/fiestas.png"'), 'chosen template');
  const png = await fetch(`${web}/plantillas/deportes.png`);
  assert.equal(png.headers.get('content-type'), 'image/png');
  const meta = await sharp(Buffer.from(await png.arrayBuffer())).metadata();
  assert.deepEqual([meta.width, meta.height], [1600, 1000], 'template 1600×1000');
  assert.equal((await fetch(`${web}/plantillas/inventada.png`)).status, 404);
  passed('redacción (multimedia y plantillas): /multimedia lista las noticias con galería y entra en el menú solo con 6; sin foto, la plantilla de la sección (o la elegida) con el crédito «Planta 14», 1600×1000');

  // --- 11. Imagen para redes.
  const og = async slug => {
    const pageHtml = await html(`/noticia/${slug}`);
    const url = pageHtml.match(/<meta property="og:image" content="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
    assert.ok(url && url.includes(`/noticia/${slug}/redes.jpg?v=`), `og:image for ${slug}`);
    assert.ok(pageHtml.includes(`<meta name="twitter:image" content="${url.replaceAll('&', '&amp;')}"`) || pageHtml.includes('name="twitter:image"'), 'twitter card');
    const r = await fetch(url.replace(/^https?:\/\/[^/]+/, web));
    const buffer = Buffer.from(await r.arrayBuffer());
    const m = await sharp(buffer).metadata();
    return { status: r.status, type: r.headers.get('content-type'), cache: r.headers.get('cache-control'), size: buffer.length, width: m.width, height: m.height };
  };
  const sizes = [];
  for (const a of [multi, posterArticle, noPhoto, aiMain]) {
    const r = await og(a.slug);
    assert.equal(r.status, 200); assert.equal(r.type, 'image/jpeg'); assert.deepEqual([r.width, r.height], [1200, 630], '1200×630');
    assert.match(r.cache, /immutable/, 'cached'); assert.ok(r.size < 200_000, `light (${r.size} bytes)`);
    sizes.push(r.size);
  }
  passed(`redacción (imagen para redes): cada noticia tiene su imagen 1200×630 en JPEG (foto según su punto de interés, cartel completo, plantilla sin foto, rótulo de IA), en og:image y twitter:image, cacheada (immutable con su versión) y ligera (${sizes.map(s => Math.round(s / 1024)).join(', ')} KB)`);

  // Indexación (con SITE_INDEXABLE): etiqueta con 1 noticia y /multimedia con menos de 6, noindex.
  await stop(); await start({ SITE_INDEXABLE: 'true' });
  const robots = h => h.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? '';
  assert.match(robots(await html('/etiqueta/hunosa')), /noindex/, 'tag with 1 article: noindex');
  assert.doesNotMatch(robots(await html('/etiqueta/mineria')), /noindex/, 'tag with 2 or more: indexable');
  assert.doesNotMatch(robots(await html('/multimedia')), /noindex/, '/multimedia with 6: indexable');
  const sitemap = await (await fetch(`${web}/sitemap.xml`)).text();
  assert.ok(sitemap.includes('/etiqueta/mineria') && !sitemap.includes('/etiqueta/hunosa') && sitemap.includes('/multimedia'), 'sitemap: tags with 2 or more and /multimedia with 6');
  if (process.env.MANUAL_REDACCION) {
    const { captureRedaccion } = await import('./manual-redaccion-screenshots.mjs');
    const problems = await captureRedaccion({ browser: ctx.browser ?? await (await import('playwright')).chromium.launch(), web, cmsOrigin: ctx.origin, password: ctx.password, editorEmail: users.editor.email,
      articles: { multi, poster: posterArticle, noPhoto, gallery: withGallery, vertical: verticalArticle, ai: aiMain }, media: { photo }, dir: process.env.MANUAL_REDACCION, checkDir: process.env.COMPROBACION_VISUAL });
    console.log(`CAPTURAS: ${problems.length ? problems.join(' | ') : 'todas'}`);
  }
  await stop(); await start();
  passed('redacción (buscadores): una etiqueta con menos de 2 noticias no se indexa ni va al sitemap; con 2 o más, sí; /multimedia, solo con al menos 6 galerías');
}
