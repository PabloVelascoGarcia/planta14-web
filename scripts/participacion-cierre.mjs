// Bloque de cierre de scripts/participacion-integration.mjs: correcciones y diseño de la portada y del pie, y
// comprobación de anchos (ordenador 2133, 1440 y 1024; tableta 820 y 768; móvil 390) sin desplazamiento horizontal.
export async function run(ctx) {
  const { payload, web, page, passed, assert, browser, town } = ctx;
  await ctx.activate(['lena', 'mieres']);
  const mieres = await town('mieres');
  const author = (await payload.find({ collection: 'authors', limit: 1, overrideAccess: true })).docs[0];
  const section = (await payload.find({ collection: 'sections', where: { slug: { equals: 'sociedad' } }, overrideAccess: true })).docs[0];
  const opinionSection = (await payload.find({ collection: 'sections', where: { slug: { equals: 'opinion' } }, overrideAccess: true })).docs[0] ?? section;
  const opinion = await payload.create({ collection: 'articles', overrideAccess: true, data: { title: 'Columna de prueba sobre el Caudal', excerpt: 'Una opinión.', body: ['Texto.'], author: author.id, town: mieres.id, section: opinionSection.id, opinion: true, publishedAt: new Date().toISOString(), _status: 'published' } });
  const lenaSpace = (await payload.find({ collection: 'municipal-spaces', where: { legacyID: { equals: 'lena' } }, overrideAccess: true })).docs[0];
  const eventAt = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 16);
  await payload.create({ collection: 'municipal-content', overrideAccess: true, data: { space: lenaSpace.id, type: 'event', title: 'Concierto municipal de prueba', excerpt: 'En la casa de cultura.', body: 'Detalle del concierto.', origin: 'municipality', publishedAt: new Date().toISOString().slice(0, 10), eventAt, place: 'Casa de cultura', _status: 'published' } });

  // Un servicio en Lena para medir «Ver todos» en el móvil (si el bloque util no los ha importado).
  const lenaTown = await town('lena');
  if (!(await payload.count({ collection: 'municipal-services', where: { town: { equals: lenaTown.id } }, overrideAccess: true })).totalDocs)
    await payload.create({ collection: 'municipal-services', overrideAccess: true, data: { name: 'Ayuntamiento de Lena (prueba)', town: lenaTown.id, category: 'ayuntamiento', sourceUrl: 'https://www.aytolena.es/', checkedAt: '2026-11-04' } });
  // C12 Agenda municipal enlazada; C13 Opinión con etiqueta y firma; C15 RSS; C14 desplegables con indicador propio.
  const agenda = await page(`${web}/agenda`);
  assert.ok(/<a[^>]*href="\/lena\?seccion=event"[^>]*>Concierto municipal de prueba<\/a>/.test(agenda), 'municipal events in the agenda link to their content');
  for (const path of ['/opinion', '/buscar?q=Columna', '/']) {
    const html = await page(`${web}${path}`);
    const card = html.slice(Math.max(0, html.indexOf('Columna de prueba sobre el Caudal') - 1500), html.lastIndexOf('Columna de prueba sobre el Caudal'));
    assert.ok(card.includes('data-opinion-tag') && card.includes(`>${author.name}<`), `${path}: opinion cards with «Opinión» and the author`);
  }
  const rss = await (await fetch(`${web}/rss.xml`)).text();
  const items = rss.match(/<item>/g) ?? [];
  assert.ok(rss.startsWith('<?xml') && rss.includes('<rss version="2.0"') && items.length > 0 && items.length <= 30 && rss.includes('Columna de prueba sobre el Caudal') && rss.includes('<category>Opinión</category>') && !rss.includes('Concierto municipal de prueba'), 'RSS: latest news and opinion, no municipal content');
  assert.ok((await page(`${web}/`)).includes('<link rel="alternate" type="application/rss+xml"') && (await page(`${web}/agenda`)).includes('href="/rss.xml"'), 'RSS linked in the head of every page');
  const lenaPage = await page(`${web}/lena?seccion=event`);
  assert.ok(lenaPage.includes('data-details-toggle') && !/<summary>[\s\S]{0,300}?↗<\/span><\/summary>/.test(lenaPage), 'dropdowns: own toggle indicator, ↗ only for links');

  // D18-D20 Portada: sin antetítulos ni mapa; autopromoción a la altura de su contenido; D22 boletín compacto.
  const home = await page(`${web}/`);
  for (const text of ['El pulso del territorio', 'Cerca de ti', 'Mapa informativo', 'Los seis concejos del Caudal', 'Fiestas de las Cuencas</p>']) assert.ok(!home.includes(text), `home without «${text}»`);
  const measures = [];
  for (const [w, h] of [[2133, 1100], [1440, 900], [1024, 900], [820, 1180], [768, 1024], [390, 844]]) {
    const mobile = w < 500;
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
    const tab = await context.newPage();
    const article = home.match(/href="\/noticia\/([^"]+)"/)[1];
    for (const path of ['/', `/noticia/${article}`, '/opinion', '/tema/sociedad', '/lena', '/lena/util', '/morcin', '/util', '/fiestas', '/agenda', '/contacto', '/privacidad', '/cookies']) {
      await tab.goto(`${web}${path}`, { waitUntil: 'networkidle' });
      const r = await tab.evaluate(() => ({ overflow: document.scrollingElement.scrollWidth > window.innerWidth + 1,
        wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).slice(-2).map(e => `${e.tagName}.${String(e.className).slice(0, 40)}`) }));
      assert.ok(!r.overflow, `${path} at ${w} px: no horizontal scroll ${JSON.stringify(r.wide)}`);
      if (path === '/') measures.push({ w, ...(await tab.evaluate(() => {
        const px = s => parseFloat(getComputedStyle(s).fontSize);
        const ads = [...document.querySelectorAll('[data-ad-slot="autopromocion"]')].map(a => Math.round(a.getBoundingClientRect().height));
        const thumbs = [...document.querySelectorAll('[data-block="caudal"] [data-card-thumb]')].map(l => { const img = l.querySelector('img'); return img ? Math.abs(img.getBoundingClientRect().height - l.getBoundingClientRect().height) : 0; });
        const dates = [...document.querySelectorAll('[data-article-meta]')].map(px);
        const lead = document.querySelector('.lead-image')?.getBoundingClientRect().top ?? 9999;
        const towns = [...document.querySelectorAll('.territory-towns a')].map(a => Math.round(a.getBoundingClientRect().height));
        const email = document.querySelector('[data-subscribe-form="portada"] input[name="email"]');
        const canvas = document.createElement('canvas').getContext('2d'); const cs = getComputedStyle(email); canvas.font = `${cs.fontSize} ${cs.fontFamily}`;
        const fits = canvas.measureText(email.placeholder).width <= email.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const nl = document.querySelector('[data-newsletter="portada"]').getBoundingClientRect().height;
        return { ads, thumbs, dates, lead: Math.round(lead + window.scrollY), towns, fits, nl: Math.round(nl), placeholder: email.placeholder };
      })) });
      if (path === '/lena' && mobile) {
        const overlap = await tab.evaluate(() => {
          const cap = document.querySelector('.aller-hero figcaption')?.getBoundingClientRect(), link = document.querySelector('.aller-hero-copy > a')?.getBoundingClientRect();
          return cap && link ? !(cap.top >= link.bottom || cap.bottom <= link.top || cap.left >= link.right || cap.right <= link.left) : null;
        });
        assert.notEqual(overlap, true, '/lena on mobile: the photo credit does not overlap «Descubre tu espacio municipal»');
      }
      if (path === '/util' && mobile) {
        await tab.goto(`${web}/lena/util/servicios`, { waitUntil: 'networkidle' });
        const first = await tab.evaluate(() => document.querySelector('[data-util-list] li')?.getBoundingClientRect().top ?? 9999);
        assert.ok(first < 844, `«Ver todos» on mobile: first result on the first screen (${Math.round(first)} px)`);
      }
    }
    await context.close();
  }
  for (const m of measures) {
    assert.ok(m.ads.every(h => h < 300), `${m.w}: self-promotion only as tall as its content (${m.ads})`);
    assert.ok(m.thumbs.every(d => d < 2), `${m.w}: Caudal thumbnails fill their box (${m.thumbs})`);
    assert.ok(m.dates.length && m.dates.every(px => px >= 12), `${m.w}: date metadata at 12 px or more (${[...new Set(m.dates)]})`);
    assert.ok(m.fits, `${m.w}: e-mail placeholder «${m.placeholder}» fits`);
  }
  const phone = measures.find(m => m.w === 390);
  assert.ok(phone.lead < 844, `mobile: the lead photo starts on the first screen (${phone.lead} px)`);
  assert.ok(phone.towns.every(h => h >= 44), `mobile: concejo links with 44 px touch areas (${phone.towns})`);
  console.log(`MEDIDA: portada a 390 × 844: la foto de apertura empieza a ${phone.lead} px; bloque del boletín: ${measures.map(m => `${m.w} px → ${m.nl} px`).join(', ')}; autopromoción: ${[...new Set(measures.flatMap(m => m.ads))].join('/')} px`);
  await payload.delete({ collection: 'articles', id: opinion.id, overrideAccess: true });
  passed('final design checks: agenda municipal events linked; «Opinión» tag and author on opinion cards; RSS in /rss.xml linked in the head; dropdowns with their own toggle; home without kickers or the six-concejo map; self-promotion as tall as its content; Caudal thumbnails filled; date metadata ≥ 12 px; e-mail placeholder fits; compact mobile header (lead photo on the first screen, concejo links 44 px); photo credit apart on mobile; «Ver todos» first result on the first screen; no horizontal scroll at 2133, 1440, 1024, 820, 768 and 390 px on the home page, an article, /opinion, a section, an active concejo and its /util, an inactive concejo, /util, /fiestas, /agenda, /contacto, /privacidad and /cookies');
}
