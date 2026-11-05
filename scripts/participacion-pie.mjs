// Bloque «Pie de página, lemas y principios» de scripts/participacion-integration.mjs.
import { DEFAULT_MOTTOS } from '../cms/site-globals.ts';

export async function run(ctx) {
  const { users, web, passed, assert, browser, signIn, page } = ctx;
  const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const footerOf = html => html.split('data-site-footer')[1]?.split('</footer>')[0] ?? '';
  const as = cookie => ({ Cookie: cookie, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' });
  const adminCookie = await signIn(users.admin.email), editorCookie = await signIn(users.editor.email);
  const setGlobal = (slug, data, cookie = adminCookie) => fetch(`${web}/api/cms/globals/${slug}`, { method: 'POST', headers: as(cookie), body: JSON.stringify(data) });

  // Pie: cuatro columnas y su contenido; sin «Redacción» ni «El Caudal, Asturias.».
  const home = await page(`${web}/`);
  const footer = footerOf(home);
  for (const col of ['planta14', 'concejos', 'participa', 'boletin']) assert.ok(footer.includes(`data-footer-col="${col}"`), `column ${col}`);
  for (const [name, slug] of [['Mieres', 'mieres'], ['Lena', 'lena'], ['Aller', 'aller'], ['Morcín', 'morcin'], ['Riosa', 'riosa'], ['Ribera de Arriba', 'ribera-de-arriba']]) assert.ok(new RegExp(`href="/${slug}"[^>]*>${name}</a>`).test(footer), `concejo ${name}`);
  for (const [label, href] of [['Envía tu carta', '/cartas/enviar'], ['Envía tu fiesta', '/fiestas/enviar'], ['Principios editoriales', '/principios'], ['Publicidad', '/publicidad'], ['Agenda', '/agenda'], ['Útil', '/util'], ['Contacto', '/contacto']]) assert.ok(footer.includes(`href="${href}"`) && footer.includes(`>${label}</a>`), `${label} → ${href}`);
  assert.ok(!footer.includes('data-footer-whatsapp') && !/>Redacción</.test(footer) && !footer.includes('El Caudal, Asturias.'), 'no WhatsApp without a link; no «Redacción» column');
  assert.ok(footer.includes('data-subscribe-form="pie"') && footer.includes('name="email"') && footer.includes('name="towns"') && footer.includes('name="topics"') && footer.includes('name="consent"') && footer.includes('href="/privacidad"'), 'full newsletter form');
  assert.ok(footer.includes('Planta 14, medio editado por ASSA') && footer.includes('href="/aviso-legal"'), 'bottom strip kept');

  // Lemas: valores iniciales (sin punto final) y cambios desde el CMS (solo administración).
  assert.ok(home.includes(`data-motto="cabecera">${DEFAULT_MOTTOS[0]}<`) && home.includes(`data-motto="lateral">${DEFAULT_MOTTOS[1]}<`) && home.includes(`data-motto="pie">${DEFAULT_MOTTOS[2]}<`), 'initial mottos');
  assert.ok(DEFAULT_MOTTOS.every(m => !m.endsWith('.')), 'same final punctuation (none)');
  assert.equal((await setGlobal('mottos', { lema2: 'Lema de prueba' }, editorCookie)).status, 403, 'journalists cannot change mottos');
  assert.equal((await fetch(`${web}/api/cms/globals/mottos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lema2: 'x' }) })).status, 403, 'anonymous cannot');
  const changed = await setGlobal('mottos', { lema1: DEFAULT_MOTTOS[0], lema2: 'Lema de prueba', lema3: DEFAULT_MOTTOS[2], underMasthead: 'lema3', sideNote: 'lema1', footer: 'lema2' });
  assert.equal(changed.status, 200, await changed.clone().text());
  const after = await page(`${web}/agenda`);
  assert.ok(after.includes(`data-motto="cabecera">${DEFAULT_MOTTOS[2]}<`) && after.includes(`data-motto="lateral">${DEFAULT_MOTTOS[0]}<`) && after.includes('data-motto="pie">Lema de prueba<'), 'each place shows the chosen motto');

  // WhatsApp: solo con un enlace válido de WhatsApp.
  assert.equal((await setGlobal('footer-settings', { whatsapp: 'https://example.org/grupo' })).status, 400, 'only WhatsApp links');
  assert.equal((await setGlobal('footer-settings', { whatsapp: 'https://whatsapp.com/channel/PRUEBA123' }, editorCookie)).status, 403);
  assert.equal((await setGlobal('footer-settings', { whatsapp: 'https://whatsapp.com/channel/PRUEBA123' })).status, 200);
  assert.ok(footerOf(await page(`${web}/`)).includes('href="https://whatsapp.com/channel/PRUEBA123"'), 'WhatsApp link in «Participa»');

  // /principios: aviso provisional que se quita desde el CMS (solo administración).
  const principles = await page(`${web}/principios`);
  assert.ok(principles.includes('data-principles-provisional') && principles.includes('Texto provisional pendiente de revisión.'), 'provisional notice');
  for (const h of ['Independencia editorial', 'Información, opinión y publicidad, separadas', 'Contenido institucional identificado', 'Rectificaciones', 'Cartas de los lectores', 'Protección de las fuentes']) assert.ok(principles.includes(`<h2>${h}</h2>`), h);
  assert.equal((await setGlobal('principles', { provisional: false }, editorCookie)).status, 403);
  assert.equal((await setGlobal('principles', { provisional: false, intro: 'Entradilla revisada.' })).status, 200);
  const revised = await page(`${web}/principios`);
  assert.ok(!revised.includes('data-principles-provisional') && revised.includes('Entradilla revisada.') && revised.includes('<h2>Rectificaciones</h2>'), 'notice removed from the CMS');
  // El sitemap solo se publica con SITE_INDEXABLE=true (aquí no): se comprueba que la ruta está en su lista.
  assert.ok((await import('node:fs')).readFileSync('app/(frontend)/sitemap.ts', 'utf8').includes('"/principios"'), 'in the sitemap routes');
  passed('mottos editable in the CMS (administration only): three initial mottos without final full stop, each placed under the masthead, as the side phrase or in the footer; WhatsApp link only when set (WhatsApp links only); /principios editable, with a removable «Texto provisional pendiente de revisión.» notice, linked in the footer');

  // Maquetación: 4 columnas en escritorio, 2 en tableta, apiladas en móvil; zonas táctiles de 44 px; contraste AA.
  const layout = async (width, height) => {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: width < 500, isMobile: width < 500 });
    const tab = await context.newPage();
    await tab.goto(`${web}/`, { waitUntil: 'networkidle' });
    const result = await tab.evaluate(() => {
      const box = sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + window.scrollY), w: Math.round(r.width) }; };
      const cols = ['planta14', 'concejos', 'participa', 'boletin'].map(c => box(`[data-footer-col="${c}"]`));
      const footer = document.querySelector('[data-site-footer]');
      const small = [];
      for (const e of footer.querySelectorAll('a, button, summary, input, select')) {
        const s = getComputedStyle(e); const r0 = e.getBoundingClientRect();
        if (s.visibility === 'hidden' || s.display === 'none' || !r0.width || e.closest('[aria-hidden="true"]')) continue;
        const target = /^(checkbox|radio)$/.test(e.getAttribute('type') || '') && e.closest('label') ? e.closest('label') : e;
        const r = target.getBoundingClientRect();
        if (r.height < 44 || (r.width < 44 && getComputedStyle(e).display !== 'inline')) small.push(`${(e.textContent || e.getAttribute('name') || '').trim().slice(0, 25)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      // Contraste de los títulos de columna (color con transparencia mezclado sobre el fondo del pie).
      const parse = c => c.match(/[\d.]+/g).map(Number);
      const bg = parse(getComputedStyle(footer).backgroundColor);
      const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratios = [...footer.querySelectorAll('#pie-concejos, #pie-participa, #pie-proyecto, [data-footer-newsletter] > p')].map(h => {
        const [r, g, b, a = 1] = parse(getComputedStyle(h).color);
        const mix = [r, g, b].map((v, i) => v * a + bg[i] * (1 - a));
        const [l1, l2] = [lum(mix), lum(bg)].sort((x, y) => y - x);
        return (l1 + 0.05) / (l2 + 0.05);
      });
      return { cols, small, ratios, overflow: document.scrollingElement.scrollWidth > window.innerWidth + 1 };
    });
    await context.close();
    return result;
  };
  const desktop = await layout(1440, 900), tablet = await layout(820, 1180), mobile = await layout(390, 844);
  const sameRow = (a, b) => Math.abs(a.y - b.y) < 4;
  assert.ok(desktop.cols.every(c => sameRow(c, desktop.cols[0])) && new Set(desktop.cols.map(c => c.x)).size === 4, `desktop: four columns ${JSON.stringify(desktop.cols)}`);
  assert.ok(sameRow(tablet.cols[0], tablet.cols[1]) && sameRow(tablet.cols[2], tablet.cols[3]) && tablet.cols[2].y > tablet.cols[0].y && tablet.cols[0].x === tablet.cols[2].x, `tablet: two columns ${JSON.stringify(tablet.cols)}`);
  assert.ok(mobile.cols.every((c, i) => i === 0 || c.y > mobile.cols[i - 1].y) && new Set(mobile.cols.map(c => c.x)).size === 1, `mobile: stacked ${JSON.stringify(mobile.cols)}`);
  assert.deepEqual(mobile.small, [], 'mobile: touch targets of at least 44 px');
  assert.ok(!desktop.overflow && !tablet.overflow && !mobile.overflow, 'no horizontal overflow');
  const minRatio = Math.min(...desktop.ratios);
  assert.ok(desktop.ratios.length === 4 && minRatio >= 4.5, `column headings contrast AA: ${desktop.ratios.map(r => r.toFixed(1))}`);
  console.log(`MEDIDA: contraste de los títulos de columna del pie: ${minRatio.toFixed(1)}:1 (mínimo AA para texto pequeño: 4,5:1)`);
  passed('footer: four columns on desktop (Planta 14 and motto; Concejos; Participa and Proyecto; Boletín), two on tablet, stacked on mobile with 44 px touch targets and no overflow; column headings with AA contrast');

  // Se deja todo como estaba para los bloques siguientes.
  await setGlobal('mottos', { lema1: DEFAULT_MOTTOS[0], lema2: DEFAULT_MOTTOS[1], lema3: DEFAULT_MOTTOS[2], underMasthead: 'lema1', sideNote: 'lema2', footer: 'lema3' });
  await setGlobal('footer-settings', { whatsapp: null });
  await setGlobal('principles', { provisional: true, intro: 'Estos son los compromisos con los que trabaja la redacción de Planta 14.' });
  void text;
}
