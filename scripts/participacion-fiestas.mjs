import { spawn, spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

// Bloque 2 de scripts/participacion-integration.mjs: Fiestas de las Cuencas.
export async function run(ctx) {
  const { payload, users, all, town, mails, web, origin, page, passed, assert, browser, sharp, directory, signIn, password } = ctx;
  const { weekend, madridToday, fiestaDates } = await import('../lib/fiestas-dates.ts');
  const shift = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const today = madridToday(), { from } = weekend(today);
  const lena = await town('lena'), mieres = await town('mieres');
  const poster = path.join(directory, 'cartel.png');
  await sharp({ create: { width: 1240, height: 1754, channels: 3, background: { r: 190, g: 60, b: 40 } } }).png().toFile(poster);
  const posterMedia = await payload.create({ collection: 'media', user: users.editor, overrideAccess: false, filePath: poster,
    data: { alt: 'Cartel de San Juan', credit: 'Comisión de San Juan', rightsHolder: 'Comisión de San Juan', rightsType: 'autorización', rightsConfirm: true } });
  const program = { root: { type: 'root', direction: 'ltr', format: '', indent: 0, version: 1, children: [{ type: 'paragraph', direction: 'ltr', format: '', indent: 0, version: 1, textFormat: 0, textStyle: '', children: [{ type: 'text', text: 'Sábado: verbena con orquesta.', format: 0, detail: 0, mode: 'normal', style: '', version: 1 }] }] } };
  const base = { program, recurring: true, organizer: 'Comisión de San Juan', contact: 'Teléfono privado 600000000', _status: 'published' };
  const sanJuan = await payload.create({ collection: 'festivals', user: users.editor, overrideAccess: false, data: { ...base, name: 'San Juan', village: 'Pola de Lena', town: lena.id, startDate: `${from}T12:00:00.000Z`, endDate: `${shift(from, 2)}T12:00:00.000Z`, image: posterMedia.id } });
  const nextMonth = shift(today, 35);
  const carmen = await payload.create({ collection: 'festivals', user: users.editor, overrideAccess: false, data: { ...base, name: 'El Carmen', village: 'Turón', town: mieres.id, startDate: `${nextMonth}T12:00:00.000Z`, endDate: `${nextMonth}T12:00:00.000Z` } });
  const pasada = await payload.create({ collection: 'festivals', user: users.editor, overrideAccess: false, data: { ...base, name: 'Fiesta pasada', village: 'Ujo', town: mieres.id, startDate: `${shift(today, -40)}T12:00:00.000Z`, endDate: `${shift(today, -39)}T12:00:00.000Z` } });
  assert.equal(sanJuan.slug, `san-juan-pola-de-lena-${from.slice(0, 4)}`, 'slug: name, village and year');
  assert.deepEqual([sanJuan.startDay, sanJuan.endDay], [from, shift(from, 2)]);
  await assert.rejects(payload.create({ collection: 'festivals', user: users.editor, overrideAccess: false, data: { ...base, name: 'Al revés', village: 'Mieres', town: mieres.id, startDate: `${today}T12:00:00.000Z`, endDate: `${shift(today, -1)}T12:00:00.000Z` } }), /anterior a la de inicio/);

  // /fiestas: este fin de semana, calendario por meses y filtro por concejo; sin carteles.
  const list = await page(`${web}/fiestas`);
  const weekendBlock = list.slice(list.indexOf('data-fiestas-weekend'), list.indexOf('data-fiestas-calendar'));
  assert.ok(weekendBlock.includes(`href="/fiestas/${sanJuan.slug}"`) && !weekendBlock.includes(carmen.slug), 'this weekend: San Juan');
  const calendar = list.slice(list.indexOf('data-fiestas-calendar'));
  assert.ok(calendar.includes(`data-month="${nextMonth.slice(0, 7)}"`) && calendar.includes(`href="/fiestas/${carmen.slug}"`), 'calendar by month');
  assert.ok(!list.includes(pasada.slug), 'past fiestas not listed');
  assert.ok(!/<main[\s\S]*<img[\s\S]*<\/main>/.test(list), 'no posters in the listing');
  const filtered = await page(`${web}/fiestas?concejo=mieres`);
  assert.ok(filtered.includes(carmen.slug) && !filtered.includes(sanJuan.slug) && filtered.includes('aria-current="page"'), 'filter by concejo');
  // Ficha: cartel pequeño y enmarcado; organizador y contacto no salen.
  const ficha = await page(`${web}/fiestas/${sanJuan.slug}`);
  assert.ok(ficha.includes('Sábado: verbena con orquesta.') && ficha.includes(fiestaDates(sanJuan)) && ficha.includes('"@type":"Event"'), 'fiesta page with programme, dates and Event data');
  assert.ok(!ficha.includes('Teléfono privado'), 'contact is not public');
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const tab = await context.newPage();
    await tab.goto(`${web}/fiestas/${sanJuan.slug}`);
    const box = await tab.locator('[data-fiesta-poster]').boundingBox();
    assert.ok(box && box.width <= 220 && box.height <= 360, `small framed poster: ${JSON.stringify(box)}`);
    assert.equal(await tab.locator('[data-fiesta-poster] img').evaluate(img => img.complete && img.naturalWidth > 0), true, 'poster from the public copy');
    await tab.setViewportSize({ width: 390, height: 844 });
    const mobile = await tab.locator('[data-fiesta-poster]').boundingBox();
    assert.ok(mobile.width <= 170, `small on mobile too: ${mobile.width}`);
    await context.close();
  }
  const api = await (await fetch(`${web}/api/cms/festivals?depth=0`)).json();
  assert.ok(api.docs.length === 3 && api.docs.every(d => d.organizer === undefined && d.contact === undefined && d.submission === undefined), 'public API: published only, without private fields');
  // Agenda, concejo y portada (texto, sin carteles).
  const agenda = await page(`${web}/agenda`);
  assert.ok(agenda.includes(`href="/fiestas/${sanJuan.slug}"`) && agenda.includes(`href="/fiestas/${carmen.slug}"`), 'fiestas in the agenda');
  const lenaPage = await page(`${web}/lena`);
  assert.ok(lenaPage.includes('data-municipal-fiestas') && lenaPage.includes(`href="/fiestas/${sanJuan.slug}"`) && !lenaPage.includes(carmen.slug), 'fiestas on the concejo page');
  const author = await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'Redacción de prueba', slug: 'redaccion-prueba' } });
  const section = (await all('sections', { slug: { equals: 'sociedad' } }))[0];
  await payload.create({ collection: 'articles', overrideAccess: true, data: { title: 'Noticia de prueba para la portada', excerpt: 'Entradilla.', body: ['Texto.'], author: author.id, town: mieres.id, section: section.id, _status: 'published' } });
  const home = await page(`${web}/`);
  const block = home.slice(home.indexOf('data-block="fiestas"'), home.indexOf('id="concejos"'));
  assert.ok(block.includes('Fiestas esta semana') && block.includes(`href="/fiestas/${sanJuan.slug}"`) && !block.includes(carmen.slug) && !block.includes('<img'), `home: text-only «Fiestas esta semana» block: ${block.slice(0, 600) || home.slice(0, 300)}`);
  assert.ok(lenaPage.includes('Fiestas esta semana') && !(await page(`${web}/mieres`)).includes('data-municipal-fiestas'), 'concejo page: only this week; hidden when there are none');
  // «Fiestas esta semana»: desde N días antes (7 por defecto) hasta el último día; nunca borradores ni «Fecha pendiente».
  const { thisWeek } = await import('../lib/fiestas-dates.ts');
  const f = (slug, startDay, endDay) => ({ slug, name: slug, village: '', town: '', townSlug: '', startDay, endDay, recurring: false });
  const day = '2026-08-10';
  assert.deepEqual(thisWeek([f('a', shift(day, 7), shift(day, 8)), f('b', shift(day, 8), shift(day, 9)), f('c', shift(day, -3), day), f('d', shift(day, -3), shift(day, -1))], day, 7).map(x => x.slug), ['c', 'a'],
    'from 7 days before until its last day');
  assert.deepEqual(thisWeek([f('a', shift(day, 3), shift(day, 3))], day, 2), [], 'configurable number of days');
  const lejana = await payload.create({ collection: 'festivals', overrideAccess: true, data: { name: 'Fiesta lejana', village: 'Ujo', town: mieres.id, dateStatus: 'confirmada', startDate: `${shift(today, 20)}T12:00:00.000Z`, endDate: `${shift(today, 21)}T12:00:00.000Z`, recurring: true, _status: 'published' } });
  const homeBlock = html => html.slice(html.indexOf('data-block="fiestas"'), html.indexOf('id="concejos"'));
  assert.ok(!homeBlock(await page(`${web}/`)).includes(lejana.slug), 'in 20 days: not yet with 7 days');
  const settings = body => async cookie => fetch(`${web}/api/cms/globals/fiestas-settings`, { method: 'POST', headers: { Cookie: cookie, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await (settings({ daysBefore: 40 }))(await signIn(users.lena.email))).status, 403, 'town halls cannot change it');
  assert.equal((await (settings({ daysBefore: 31 }))(await signIn(users.editor.email))).status, 400, 'at most 30 days');
  assert.equal((await (settings({ daysBefore: 30 }))(await signIn(users.editor.email))).status, 200, 'the newsroom changes it from the CMS');
  const pendiente = await payload.create({ collection: 'festivals', overrideAccess: true, data: { name: 'Fiesta sin fecha', village: 'Ujo', town: mieres.id, dateStatus: 'pendiente', recurring: true } });
  const borrador = await payload.create({ collection: 'festivals', overrideAccess: true, data: { name: 'Fiesta en borrador', village: 'Ujo', town: mieres.id, dateStatus: 'confirmada', startDate: `${today}T12:00:00.000Z`, endDate: `${today}T12:00:00.000Z`, _status: 'draft' } });
  const wider = await page(`${web}/`);
  const widerBlock = wider.slice(wider.indexOf('data-block="fiestas"'), wider.indexOf('id="concejos"'));
  assert.ok(widerBlock.includes(lejana.slug) && !widerBlock.includes(carmen.slug) && !widerBlock.includes('Fiesta sin fecha') && !widerBlock.includes('Fiesta en borrador'), 'with 30 days the one in 20 days enters (El Carmen, in 35, does not); never drafts nor «Fecha pendiente»');
  assert.equal((await (settings({ daysBefore: 7 }))(await signIn(users.editor.email))).status, 200);
  for (const doc of [pendiente, borrador, lejana]) await payload.delete({ collection: 'festivals', id: doc.id, overrideAccess: true });
  passed('fiestas: /fiestas with «Este fin de semana», calendar by month and concejo filter (past ones hidden, no posters); fiesta page with programme, Event data and a small framed poster (≤ 220 px, 160 px on mobile); organizer and contact never public; also in the agenda; «Fiestas esta semana» (text only) on the home page and on the concejo page, from N days before (7 by default, editable by the newsroom, at most 30) until the last day, hidden when empty, never drafts nor «Fecha pendiente»');

  // Formulario público: confirmación por correo y borrador asignado al responsable del concejo.
  const pendingBefore = (await all('notifications')).length;
  const context = await browser.newContext();
  const tab = await context.newPage();
  await tab.goto(`${web}/fiestas/enviar`);
  await tab.click('button:has-text("Enviar la fiesta")');
  await tab.locator('[role="alert"]', { hasText: 'Revisa los campos marcados.' }).waitFor();
  assert.equal(await tab.locator('#email-error').count(), 1, 'validation messages');
  const startDay = shift(today, 60);
  await tab.fill('input[name="name"]', 'Santa Bárbara');
  await tab.fill('input[name="village"]', 'Felechosa');
  await tab.selectOption('select[name="town"]', 'lena');
  await tab.fill('input[name="startDay"]', startDay);
  await tab.fill('input[name="endDay"]', shift(startDay, 1));
  await tab.fill('textarea[name="program"]', 'Sábado\n13:00 Misa\n\nDomingo\n18:00 Baile');
  await tab.setInputFiles('input[name="poster"]', poster);
  await tab.fill('input[name="posterCredit"]', 'Asociación de Felechosa');
  await tab.check('input[name="posterRights"]');
  await tab.fill('input[name="organizer"]', 'Asociación vecinal de Felechosa');
  await tab.fill('input[name="submitterName"]', 'Marta Prueba');
  await tab.fill('input[name="email"]', 'marta-fiestas@example.org');
  await tab.check('input[name="privacy"]');
  await tab.click('button:has-text("Enviar la fiesta")');
  await tab.locator('[data-fiesta-sent]').waitFor();
  const draft = (await all('festivals', { 'submission.email': { equals: 'marta-fiestas@example.org' } }, 1))[0];
  assert.ok(draft && draft._status === 'draft' && draft.origin === 'publico' && draft.submission.confirmed === false, 'stored as an unconfirmed draft');
  assert.equal((await all('notifications')).length, pendingBefore, 'nothing reaches the newsroom before confirming');
  assert.equal((await fetch(`${web}/fiestas/${draft.slug}`)).status, 404, 'not public');
  const confirmMail = (await mails()).find(m => m.to === 'marta-fiestas@example.org');
  const link = confirmMail?.text.match(/https?:\/\/\S+\/fiestas\/confirmar\?t=\S+/)?.[0];
  assert.ok(link?.startsWith(`${origin}/fiestas/confirmar?t=`), 'confirmation email with link');
  await tab.goto(link.replace(origin, web));
  await tab.click('button:has-text("Confirmar el envío")');
  await tab.locator('[data-fiesta-confirmed="true"]').waitFor();
  await tab.goto(link.replace(origin, web));
  assert.ok((await tab.content()).includes('ya se ha usado'), 'the link only works once');
  await context.close();
  const confirmed = (await all('festivals', { id: { equals: draft.id } }, 1))[0];
  assert.ok(confirmed.submission.confirmed && !confirmed.submission.tokenHash && confirmed._status === 'draft', 'confirmed, still a draft');
  const notice = (await all('notifications', { festival: { equals: draft.id } }, 1))[0];
  assert.ok(notice && notice.kind === 'festival-submission' && notice.assignedTo.id === users.juanfran.id && notice.emailStatus === 'sent', 'pending item for the responsible of Lena');
  const journalistMail = (await mails()).find(m => m.to === 'juansantospolalena@gmail.com' && m.subject.includes('Santa Bárbara'));
  assert.ok(journalistMail?.text.includes(`/cms/collections/festivals/${draft.id}`), 'email to Juanfran with the draft');
  const posterDoc = await payload.findByID({ collection: 'media', id: confirmed.image.id, overrideAccess: true, depth: 0 });
  assert.ok(posterDoc.rightsScope === 'publicable' && posterDoc.rightsDeclaration.statement.includes('Marta Prueba <marta-fiestas@example.org>') && !posterDoc.publicKey, 'poster with the sender declaration, not public yet');
  await payload.update({ collection: 'festivals', id: draft.id, user: users.juanfran, overrideAccess: false, data: { _status: 'published' } });
  assert.ok((await page(`${web}/fiestas/${draft.slug}`)).includes('Felechosa'), 'published by the journalist');
  assert.ok((await payload.findByID({ collection: 'media', id: confirmed.image.id, overrideAccess: true })).publicKey, 'poster public once published');
  // Robots (campo trampa): «gracias», pero nada guardado.
  const honeypot = await browser.newContext(); const bot = await honeypot.newPage();
  await bot.goto(`${web}/fiestas/enviar`);
  await bot.evaluate(() => { document.querySelector('input[name="web"]').value = 'http://spam.example'; });
  await bot.click('button:has-text("Enviar la fiesta")');
  await bot.locator('[data-fiesta-sent]').waitFor();
  await honeypot.close();
  assert.equal((await all('festivals', { origin: { equals: 'publico' } })).length, 1, 'spam trap stores nothing');
  passed('«Envía tu fiesta»: validation messages; stored as a hidden unconfirmed draft; confirmation email whose page needs a button (single use); then a pending item and email for the concejo journalist (Juanfran, Lena); poster with the sender\'s rights declaration, public only once published; spam trap');

  // Duplicar para el año siguiente con un clic (botón del CMS).
  const browserContext = await browser.newContext();
  const cookie = await signIn(users.editor.email);
  await browserContext.addCookies(cookie.split('; ').map(pair => { const [name, ...value] = pair.split('='); return { name, value: value.join('='), url: origin }; }));
  const cms = await browserContext.newPage();
  await cms.goto(`${origin}/cms/collections/festivals/${sanJuan.id}`);
  await cms.click('[data-festival-next-year]');
  await cms.waitForURL(url => /\/festivals\/\d+$/.test(url.pathname) && !url.pathname.endsWith(`/${sanJuan.id}`));
  const copyID = Number(cms.url().split('/').pop());
  await browserContext.close();
  const copy = (await all('festivals', { id: { equals: copyID } }))[0];
  assert.deepEqual([copy._status, copy.startDay, copy.endDay, copy.image ?? null, copy.recurring], ['draft', shift(from, 364), shift(from, 366), null, true], 'next-year draft');
  assert.equal(new Date(`${copy.startDay}T12:00:00Z`).getUTCDay(), new Date(`${from}T12:00:00Z`).getUTCDay(), 'same weekday');
  assert.equal(copy.slug, `san-juan-pola-de-lena-${copy.startDay.slice(0, 4)}`);
  assert.equal((await fetch(`${web}/api/cms/festivals/${sanJuan.id}/siguiente-ano`, { method: 'POST' })).status, 403, 'only the newsroom');
  void password;
  passed('«Duplicar para el año siguiente»: one click in the CMS creates a draft 52 weeks later (same weekday), same programme, without poster or chronicle; only the newsroom can');

  // Importador JSON (precarga).
  const { importFiestas } = await import('../cms/fiestas-import.ts');
  const items = [{ nombre: 'Nuestra Señora', pueblo: 'Moreda', concejo: 'aller', inicio: shift(today, 90), fin: shift(today, 92), programa: 'Viernes\n\nSábado', organizador: 'Comisión', contacto: 'privado' },
    { nombre: 'San Roque', pueblo: 'Riosa', concejo: 'Riosa', inicio: shift(today, 100) }];
  const bad = await importFiestas(payload, [...items, { nombre: 'Sin concejo', pueblo: 'X', concejo: 'gijon', inicio: '2027-13-01' }], { publicar: false, soloComprobar: false });
  assert.ok(bad.errores.length === 1 && /concejo desconocido/.test(bad.errores[0]) && !bad.creadas.length, 'all-or-nothing validation');
  const file = path.join(directory, 'fiestas.json');
  await writeFile(file, JSON.stringify(items));
  const cli = spawnSync(process.execPath, ['scripts/fiestas-run.mjs', file, '--solo-comprobar'], { env: process.env, encoding: 'utf8' });
  assert.ok(cli.status === 0 && cli.stdout.includes('Se crearían 2 fiestas') && cli.stdout.includes('COMPROBACIÓN TERMINADA'), cli.stdout + cli.stderr);
  assert.equal(spawnSync(process.execPath, ['scripts/fiestas-run.mjs', file, '--publicr'], { encoding: 'utf8' }).status, 2, 'unknown options rejected');
  const imported = await importFiestas(payload, items, { publicar: true, soloComprobar: false });
  assert.equal(imported.creadas.length, 2);
  const again = await importFiestas(payload, items, { publicar: true, soloComprobar: false });
  assert.deepEqual([again.creadas.length, again.existentes.length], [0, 2], 'repeatable');
  assert.ok((await page(`${web}/fiestas?concejo=aller`)).includes('Nuestra Señora'), 'imported fiesta published');
  passed('npm run cms:fiestas:importar: validates the whole JSON first (nothing imported on error), --solo-comprobar, drafts or --publicar, repeatable without duplicates; unknown options rejected');

  // Catálogo de fiestas (formato de contenido-ensayo/fiestas-caudal.json): todo borrador, sin fechas inventadas.
  {
  const real = spawnSync('git', ['show', '034b853:contenido-ensayo/fiestas-caudal.json'], { encoding: 'utf8', maxBuffer: 1 << 24 });
  const catalog = real.status === 0 ? JSON.parse(real.stdout) : { fiestas: [
    { id: 'prueba-con-2025', nombre: 'Fiesta de prueba', pueblo_o_parroquia: 'Pueblo', concejo: 'Lena', fechas_habituales: { texto: 'Septiembre' }, fechas_2025: { inicio: '2025-09-26', fin: '2025-09-28', dias_confirmados: [], estado: 'confirmado' },
      descripcion: 'Descripción.', actos_tipicos: { actos: ['Misa'] }, organizador: { nombre: 'Comisión' }, se_repite_cada_ano: { valor: true }, fuentes_consultadas: [{ entidad: 'Ayuntamiento', titulo: 'Ficha', url: 'https://example.org/' }], carteles: [], dudas: [], verificacion: 'ok' },
    { id: 'prueba-sin-fecha', nombre: 'Otra fiesta', pueblo_o_parroquia: 'Aldea', concejo: 'Riosa', fechas_habituales: { texto: 'Agosto' }, fechas_2025: { inicio: null, fin: null, dias_confirmados: [], estado: 'no_localizado' },
      descripcion: 'Otra.', actos_tipicos: { actos: [] }, organizador: { nombre: null }, se_repite_cada_ano: { valor: true }, fuentes_consultadas: [], carteles: [], dudas: ['Fecha sin localizar'], verificacion: 'ok' },
  ] };
  if (real.status !== 0) console.log('AVISO: no está el commit 034b853; se prueba el catálogo con dos fiestas de ejemplo');
  const total = catalog.fiestas.length;
  const sinFecha = catalog.fiestas.filter(f => !f.fechas_2025?.inicio && !f.fechas_2025?.fin && !(f.fechas_2025?.dias_confirmados ?? []).length && !f.fechas_2025?.dia_principal && !f.fechas_2025?.festivo_laboral).length;
  const catalogFile = path.join(directory, 'fiestas-caudal.json');
  await writeFile(catalogFile, JSON.stringify(catalog));
  const run = (...args) => new Promise(resolve => {
    const child = spawn(process.execPath, ['scripts/fiestas-run.mjs', ...args], { env: process.env });
    let out = ''; child.stdout.on('data', b => { out += b; }); child.stderr.on('data', b => { out += b; });
    child.on('close', status => resolve({ status, out }));
  });
  const before = (await payload.count({ collection: 'festivals', overrideAccess: true })).totalDocs;
  const dry = await run(catalogFile, '--solo-comprobar');
  assert.ok(dry.status === 0 && dry.out.includes('Formato: catálogo de fiestas') && dry.out.includes(`Se crearían ${total} fiestas como borrador`)
    && dry.out.includes(`De ellas: ${sinFecha} con «Fecha pendiente» y ${total - sinFecha} con «Fecha orientativa (2025)»`), dry.out);
  assert.equal((await payload.count({ collection: 'festivals', overrideAccess: true })).totalDocs, before, 'dry run writes nothing');
  const rejected = await run(catalogFile, '--publicar');
  assert.ok(rejected.status === 1 && rejected.out.includes('El catálogo entra siempre como borrador'), rejected.out);
  const broken = path.join(directory, 'fiestas-mal.json');
  await writeFile(broken, JSON.stringify({ fiestas: [{ ...catalog.fiestas[0], id: 'mal-1', concejo: 'Gijón', descripcion: 'x'.repeat(1200) }, { ...catalog.fiestas[0], id: 'mal-2', nombre: '' }] }));
  const wrong = await run(broken, '--solo-comprobar');
  assert.ok(wrong.status === 1 && wrong.out.includes('concejo desconocido «Gijón»') && wrong.out.includes('«Descripción» tiene 1200 caracteres (máximo 1000)') && wrong.out.includes('falta «Nombre de la fiesta»'), `all errors at once: ${wrong.out}`);
  const done = await run(catalogFile);
  assert.ok(done.status === 0 && done.out.includes(`Creadas ${total} fiestas como borrador`), done.out);
  const repeated = await run(catalogFile);
  assert.ok(repeated.out.includes('Creadas 0 fiestas') && repeated.out.includes(`Ya existían ${total}`), 'repeatable by catalogue id');
  const imported2 = (await payload.find({ collection: 'festivals', where: { externalID: { exists: true } }, pagination: false, draft: true, overrideAccess: true, depth: 1 })).docs;
  assert.equal(imported2.length, total);
  assert.ok(imported2.every(f => f._status === 'draft' && !f.startDate && !f.startDay && f.dateStatus !== 'confirmada'), 'all drafts, no dates, never confirmed');
  assert.equal(imported2.filter(f => f.dateStatus === 'pendiente').length, sinFecha, '«Fecha pendiente»');
  const withRef = imported2.find(f => f.dateStatus === 'orientativa');
  assert.ok(withRef.referenceDates.startsWith('Fecha orientativa (2025):') && withRef.referenceDates.includes('/2025') && !/2026|2027/.test(withRef.referenceDates.replace('No es una fecha de 2026', '')), `2025 dates kept as a reference only: ${withRef.referenceDates}`);
  assert.ok(imported2.every(f => f.town && f.village && f.description), 'concejo, village and description kept');
  assert.ok(imported2.some(f => (f.sources ?? []).length), 'sources kept');
  // Nunca en la web pública ni en la agenda; tampoco por la API anónima.
  const name = withRef.name;
  for (const url of ['/fiestas', `/fiestas?concejo=${withRef.town.slug}`, '/agenda', `/${withRef.town.slug}`, '/']) assert.ok(!(await page(`${web}${url}`)).includes(`>${name}<`), `${name} not public in ${url}`);
  const anon = await (await fetch(`${web}/api/cms/festivals?where[name][equals]=${encodeURIComponent(name)}&limit=100&draft=true`)).json();
  assert.equal(anon.totalDocs, 0, `not readable anonymously: ${JSON.stringify(anon).slice(0, 200)}`);
  // No se puede publicar sin confirmar la fecha; al confirmarla, sí.
  const editorCookie = await ctx.signIn(ctx.users.editor.email);
  const headers = { Cookie: editorCookie, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' };
  const refused = await fetch(`${web}/api/cms/festivals/${withRef.id}`, { method: 'PATCH', headers, body: JSON.stringify({ _status: 'published' }) });
  assert.ok(refused.status === 400 && (await refused.text()).includes('confirma sus fechas'), 'cannot publish without a confirmed date');
  const confirmedNow = await fetch(`${web}/api/cms/festivals/${withRef.id}`, { method: 'PATCH', headers, body: JSON.stringify({ dateStatus: 'confirmada', startDate: `${shift(today, 30)}T12:00:00.000Z`, endDate: `${shift(today, 31)}T12:00:00.000Z`, _status: 'published' }) });
  assert.equal(confirmedNow.status, 200, await confirmedNow.clone().text());
  assert.ok((await page(`${web}/fiestas`)).includes(name), 'published once the date is confirmed');
  await payload.update({ collection: 'festivals', id: withRef.id, overrideAccess: true, data: { _status: 'draft' } });
  // En el CMS: columna y filtro «Estado de la fecha».
  const list = await (await fetch(`${web}/api/cms/festivals?where[dateStatus][equals]=pendiente&limit=0&draft=true`, { headers })).json();
  assert.equal(list.totalDocs, sinFecha, 'filterable by «Fecha pendiente»');
  passed(`fiestas catalogue (034b853, ${total} fiestas): converted with --solo-comprobar first (all errors at once), always drafts (--publicar refused), 2025 dates only as «Fecha orientativa (2025)», ${sinFecha} with «Fecha pendiente» (filterable in the CMS), concejo, village, description and sources kept; never public nor in the agenda until a journalist confirms the date; repeatable by id`);
  }
}
