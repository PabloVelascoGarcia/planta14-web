// Recorrido de una persona de la redacción por el formulario de noticia, solo con clics, teclado y el selector
// de archivos: nada de JSON, identificadores ni fechas escritas a mano. Lo llama scripts/formulario-integration.mjs.
export async function run({ tab, origin, email, password, photo, payload, firma, passed, assert }) {
  const web = origin.replace('localhost', '127.0.0.1');
  const madrid = (date, options) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', ...options }).format(date);
  // Desplegables de Payload: el control del campo por su nombre.
  const choose = async (name, option) => {
    await tab.locator(`label[for^="field-${name}"]`).last().locator('xpath=ancestor::div[contains(@class,"field-type")][1]').locator('.rs__control').click();
    await tab.locator('.rs__option', { hasText: option }).first().click();
  };
  const tabButton = name => tab.getByRole('button', { name, exact: true });

  // 1. Entrar y abrir «Nueva noticia» desde el panel de inicio.
  await tab.goto(`${origin}/cms/login`);
  await tab.locator('input[name="email"]').fill(email);
  await tab.locator('input[name="password"]').fill(password);
  await tab.locator('button[type="submit"]').click();
  await tab.waitForURL(/\/cms$/);
  await tab.locator('[data-dashboard-link="nueva"]').click();
  await tab.waitForURL(/\/collections\/articles\/create/);
  for (const name of ['Contenido', 'Clasificación', 'Portada', 'Publicación', 'Buscadores', 'Fuente']) assert.equal(await tabButton(name).count(), 1, `tab ${name}`);
  for (const technical of ['legacyID', 'provenance', 'lote', 'date']) assert.equal(await tab.locator(`input[name="${technical}"]:visible`).count(), 0, `${technical} hidden for the newsroom`);

  // 2. Contenido: titular, entradilla y texto con negrita, ladillo, cita y lista desde la barra del editor.
  const title = 'El pleno de Mieres aprueba el presupuesto de 2027';
  await tab.locator('input[name="title"]').fill(title);
  await tab.locator('textarea[name="excerpt"]').fill('Las cuentas salen adelante con los votos del gobierno local y la abstención de la oposición.');
  const editor = tab.locator('[contenteditable="true"]').first();
  await editor.click();
  await tab.keyboard.type('El Ayuntamiento aprobó anoche unas cuentas de ');
  await tab.keyboard.press('Control+b'); await tab.keyboard.type('42 millones de euros'); await tab.keyboard.press('Control+b');
  await tab.keyboard.type('.');
  const blockType = async option => { await tab.locator('.toolbar-popup__dropdown').first().click(); await tab.locator(`text="${option}" >> visible=true`).first().click(); };
  await tab.keyboard.press('Enter'); await blockType('Encabezado 2'); await tab.keyboard.type('Las inversiones');
  await tab.keyboard.press('Enter'); await tab.keyboard.type('La mayor partida es para la reforma de la plaza.');
  await tab.keyboard.press('Enter'); await blockType('Cita en bloque'); await tab.keyboard.type('Es un presupuesto para los barrios.');
  await tab.keyboard.press('Enter'); await blockType('Lista desordenada'); await tab.keyboard.type('Plaza de Requejo');
  await tab.keyboard.press('Enter'); await tab.keyboard.type('Piscina de Santullano');

  // 3. Foto nueva desde la propia noticia, con autoría, derechos y declaración.
  await tab.getByRole('button', { name: 'Crear', exact: true }).click();
  await tab.locator('input[type="file"]').last().setInputFiles(photo);
  await tab.locator('input[name="alt"]').fill('Concejales en el salón de plenos de Mieres');
  await tab.locator('input[name="credit"]').fill('Lucía Prueba');
  await tab.locator('input[name="rightsHolder"]').fill('Planta 14');
  assert.equal(await tab.locator('label[for^="field-rightsScope"]').count(), 0, 'the newsroom does not choose the scope: the declaration sets it');
  await choose('rightsType', 'Propia');
  await tab.locator('input[name="rightsConfirm"]').check();
  await tab.getByRole('button', { name: 'Guardar', exact: true }).click();
  await tab.getByText('foto-del-pleno', { exact: false }).first().waitFor();

  // 4. Clasificación: la firma ya viene puesta; concejo y sección.
  await tabButton('Clasificación').click();
  assert.match(await tab.locator('label[for^="field-author"]').last().locator('xpath=ancestor::div[contains(@class,"field-type")][1]').innerText(), /Lucía Prueba/, 'linked author by default');
  await choose('town', 'Mieres');
  await choose('section', 'Política');
  await tabButton('Portada').click();
  for (const help of ['La noticia grande de la portada', 'bloque de noticias destacadas', 'página de su concejo']) assert.ok(await tab.getByText(help, { exact: false }).count(), `Portada explains «${help}»`);

  // 5. Guardar borrador: la dirección (slug) se crea sola.
  await tab.getByRole('button', { name: 'Guardar borrador' }).click();
  await tab.waitForURL(/\/collections\/articles\/\d+/);
  const id = Number(tab.url().match(/articles\/(\d+)/)[1]);
  await tab.locator('input[name="slug"]').waitFor();
  for (let i = 0; i < 50 && !(await tab.locator('input[name="slug"]').inputValue()); i++) await tab.waitForTimeout(100);
  const slug = await tab.locator('input[name="slug"]').inputValue();
  assert.equal(slug, 'el-pleno-de-mieres-aprueba-el-presupuesto-de-2027', 'slug from the title');
  let doc = await payload.findByID({ collection: 'articles', id, draft: true, depth: 1, overrideAccess: true });
  assert.equal(doc._status, 'draft');
  assert.equal(doc.author.id, firma.id);
  assert.equal(doc.image.rightsScope, 'publicable', 'the declaration makes the photo publishable');
  assert.match(doc.image.rightsDeclaration.statement, /Lucía Prueba \(Planta 14\) declara/);
  assert.equal((await fetch(`${web}/noticia/${slug}`)).status, 404, 'a draft is not public');
  passed('newsroom form: «Nueva noticia» opens six tabs; title, excerpt and rich text (bold, subheading, quote, list) typed with the editor toolbar; a new photo uploaded from the article with credit, rights and declaration (publishable); author prefilled from the linked byline; slug created from the title; technical fields hidden');

  // 6. Vista previa con el diseño público, desde el botón del formulario.
  const [preview] = await Promise.all([tab.context().waitForEvent('page'), tab.locator('#preview-button').click()]);
  await preview.waitForLoadState();
  await preview.locator('h1', { hasText: title }).waitFor();
  const previewHTML = await preview.content();
  for (const html of ['<strong>42 millones de euros</strong>', 'Las inversiones</h2>', 'Es un presupuesto para los barrios.</blockquote>', '<li>Piscina de Santullano</li>', 'Lucía Prueba'])
    assert.ok(previewHTML.includes(html), `preview shows ${html}`);
  assert.ok(await preview.locator('img[alt="Concejales en el salón de plenos de Mieres"]').count(), 'preview shows the photo');
  await preview.close();
  passed('preview: the «Vista previa» button opens the draft with the public article design (text formatting, photo and byline)');

  // 7. Programar con el selector de fecha y hora (calendario y lista de horas) y publicar.
  const slot = new Date(Math.ceil((Date.now() + 75_000) / 300_000) * 300_000);
  await tabButton('Publicación').click();
  await tab.locator('[id^="field-scheduledAt"] input').first().click();
  const sameMonth = madrid(slot, { month: 'numeric' }) === madrid(new Date(), { month: 'numeric' });
  if (!sameMonth) await tab.locator('.react-datepicker__navigation--next').click();
  await tab.locator('.react-datepicker__day:not(.react-datepicker__day--outside-month)', { hasText: new RegExp(`^${Number(madrid(slot, { day: 'numeric' }))}$`) }).click();
  const hhmm = madrid(slot, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  await tab.locator('.react-datepicker__time-list-item', { hasText: new RegExp(`^${hhmm}$`) }).click();
  assert.equal(await tab.locator('[id^="field-scheduledAt"] input').first().inputValue(), `${madrid(slot, { day: '2-digit', month: '2-digit', year: 'numeric' })} ${hhmm}`);
  await tab.locator('#action-save').click();
  await tab.locator('.status__value', { hasText: 'Publicado' }).waitFor();
  doc = await payload.findByID({ collection: 'articles', id, depth: 0, overrideAccess: true });
  assert.equal(doc._status, 'published');
  assert.equal(new Date(doc.scheduledAt).getTime(), slot.getTime(), 'scheduled at the chosen time (Madrid)');
  assert.equal(new Date(doc.publishedAt).getTime(), slot.getTime(), 'its publication date is the scheduled one');
  assert.equal((await fetch(`${web}/noticia/${slug}`)).status, 404, 'scheduled: not public before its time');
  assert.ok(!(await (await fetch(`${web}/`)).text()).includes(title), 'not on the home page before its time');

  // 8. Sale sola a su hora.
  const deadline = slot.getTime() + 60_000;
  let status = 0;
  while (Date.now() < slot.getTime()) await new Promise(r => setTimeout(r, Math.min(5000, slot.getTime() - Date.now() + 50)));
  while (Date.now() < deadline && (status = (await fetch(`${web}/noticia/${slug}`)).status) !== 200) await new Promise(r => setTimeout(r, 1000));
  assert.equal(status, 200, 'out by itself at the scheduled time');
  const html = (await (await fetch(`${web}/noticia/${slug}`)).text()).replaceAll('<!-- -->', '');
  for (const part of [title, '<strong>42 millones de euros</strong>', 'Las inversiones</h2>', '<li>Plaza de Requejo</li>', 'Lucía Prueba', 'planta14-formulario-public'])
    assert.ok(html.includes(part), `public article shows ${part}`);
  assert.ok((await (await fetch(`${web}/`)).text()).includes(title), 'on the home page');
  assert.ok((await (await fetch(`${web}/buscar?q=Santullano`)).text()).includes(title), 'found by the search');
  passed(`scheduling: date and time chosen in the calendar (${hhmm} Madrid), «Publicar cambios» leaves it published but hidden; it comes out by itself at that time with photo, formatting and byline, on the home page and in the search`);
}
