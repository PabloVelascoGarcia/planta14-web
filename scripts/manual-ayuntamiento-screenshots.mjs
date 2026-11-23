// Capturas de docs/MANUAL-AYUNTAMIENTOS.md con el panel real. Las genera el bloque participacion-ayuda.mjs con
// MANUAL_AYUNTAMIENTO=<carpeta>. Cada captura es independiente: si una falla, se avisa y se sigue.
import { mkdir } from 'node:fs/promises';

export async function captureAyuntamiento({ browser, origin, slug, email, password, withdrawnTitle, dir }) {
  await mkdir(dir, { recursive: true });
  const problems = [];
  const attempt = async (name, fn) => { try { await fn(); } catch (error) { problems.push(`${name}: ${String(error).split('\n')[0]}`); } };
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, locale: 'es-ES' });
  await context.addCookies([{ name: 'planta14_consent', value: '1%3Arejected', url: origin }]);
  const page = await context.newPage();
  const panel = `${origin}/${slug}/panel`;
  const shot = async (file, locator) => { if (locator) { await locator.scrollIntoViewIfNeeded(); await locator.screenshot({ path: `${dir}/${file}` }); } else await page.screenshot({ path: `${dir}/${file}` }); };
  const form = () => page.getByRole('form', { name: 'Publicación municipal' });

  await attempt('entrar', async () => {
    await page.goto(panel, { waitUntil: 'load' });
    await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
    await shot('01-entrar.png');
  });
  await attempt('recuperar', async () => {
    await page.getByRole('button', { name: '¿Has olvidado tu contraseña?' }).click();
    await page.locator('[data-forgot-password] input[type="email"]').fill(email);
    await shot('02-recuperar.png');
    await page.goto(panel, { waitUntil: 'load' });
  });
  // Entrar.
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.locator('[data-panel-tabs]').waitFor();
  await attempt('pestañas', async () => { await page.evaluate(() => window.scrollTo(0, 0)); await shot('03-pestanas.png'); });
  const fill = async (type, extra) => {
    await page.goto(panel, { waitUntil: 'load' }); await form().waitFor();
    await form().getByLabel('Tipo').selectOption({ label: type });
    await form().getByLabel('Título').fill(extra.title);
    await form().getByLabel('Resumen').fill(extra.excerpt);
    await form().getByLabel('¿Qué deben saber los vecinos?').fill(extra.body);
    for (const [label, value] of extra.fields ?? []) await form().getByLabel(label).first().fill(value);
  };
  await attempt('aviso', async () => {
    await fill('Avisos', { title: 'Corte de agua en la calle Mayor', excerpt: 'El martes, de 9:00 a 13:00, por obras en la red.', body: 'Disculpen las molestias.', fields: [['Mostrar el aviso hasta', '2026-12-31']] });
    await shot('04-publicar-aviso.png', form());
  });
  await attempt('agenda', async () => {
    await fill('Agenda', { title: 'Concierto de Navidad de la banda municipal', excerpt: 'En la casa de cultura, con entrada libre.', body: 'Villancicos y piezas populares.', fields: [['Fecha del evento', '2026-12-20'], ['Hora', '19:00'], ['Lugar', 'Casa de cultura']] });
    await shot('05-publicar-agenda.png', form());
  });
  await attempt('ayuda', async () => {
    await fill('Ayudas y subvenciones', { title: 'Ayudas al comercio local 2027', excerpt: 'Para la modernización de pequeños comercios del concejo.', body: 'Bases en el ayuntamiento.', fields: [['Plazo de solicitud', '2027-01-31'], ['Mostrar la ayuda hasta', '2027-01-31']] });
    await shot('06-publicar-ayuda.png', form());
  });
  await attempt('imagen', async () => {
    await page.goto(panel, { waitUntil: 'load' }); await form().waitFor();
    const input = form().locator('input[type="file"]');
    await input.setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64') });
    await form().getByLabel('Descripción de la imagen').fill('Fachada del ayuntamiento');
    await form().getByLabel('Autoría o crédito').fill('Ayuntamiento');
    await form().locator('.municipal-declaration input').check();
    await form().locator('.municipal-declaration').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 220));
    await shot('07-imagen.png');
  });
  const tab = async id => { await page.goto(id === 'publicar' ? panel : `${panel}?pestana=${id}`, { waitUntil: 'load' }); await page.locator(`[data-panel-section="${id}"]`).first().waitFor(); await page.waitForTimeout(400); };
  await attempt('mis publicaciones', async () => { await tab('publicaciones'); await shot('08-mis-publicaciones.png', page.locator('[data-panel-section="publicaciones"]')); });
  await attempt('en la web', async () => {
    const tabWeb = await context.newPage();
    await tabWeb.goto(`${origin}/${slug}?seccion=notice`, { waitUntil: 'load' }); await tabWeb.waitForTimeout(500);
    await tabWeb.screenshot({ path: `${dir}/09-en-la-web.png` }); await tabWeb.close();
  });
  await attempt('útil', async () => { await tab('util'); await shot('10-util.png', page.locator('[data-panel-section="util"]')); });
  await attempt('directorio', async () => { await tab('directorio'); await shot('11-directorio.png', page.locator('[data-panel-section="directorio"]')); });
  await attempt('sugerencias', async () => { await tab('sugerencias'); await shot('12-sugerencias.png', page.locator('[data-panel-section="sugerencias"]')); });
  await attempt('visitas', async () => { await tab('visitas'); await shot('13-visitas.png', page.locator('[data-panel-section="visitas"]').first()); });
  await attempt('retirado', async () => {
    await tab('publicaciones');
    const row = page.locator('[data-panel-section="publicaciones"] li', { hasText: withdrawnTitle }).first();
    await shot('14-retirado.png', row);
  });
  await attempt('ayuda', async () => { await tab('ayuda'); await shot('15-ayuda.png'); });
  await attempt('cerrar sesión', async () => { await tab('publicar'); await page.evaluate(() => window.scrollTo(0, 0)); await shot('16-cerrar-sesion.png', page.locator('.municipal-demo-banner').first()); });
  await context.close();
  return problems;
}
