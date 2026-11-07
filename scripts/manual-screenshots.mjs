// Capturas para docs/MANUAL-AYUNTAMIENTOS.md, con datos sintéticos (se ejecuta desde launch-integration.mjs
// con MANUAL_SCREENSHOTS=true). Escritorio 1280×900, que es como lo usará el personal municipal.
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

export async function captureManual({ browser, payload, url, lenaSpace }) {
  const dir = 'docs/img/manual-ayuntamientos';
  await mkdir(dir, { recursive: true });
  const password = randomUUID() + randomUUID();
  const email = 'personal@ayto-lena.example';
  await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { email, password, name: 'Personal del Ayuntamiento de Lena', role: 'municipal', municipalSpace: lenaSpace.id } });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await context.addCookies([{ name: 'planta14_consent', value: '1%3Arejected', url }]); // no cookie banner over the screenshots
  const page = await context.newPage();
  const shot = (name, locator) => (locator || page).screenshot({ path: `${dir}/${name}.png`, ...(locator ? {} : { fullPage: false }) });

  await page.goto(`${url}/lena/panel`);
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await shot('01-entrar');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar ↗', exact: true }).click();
  const form = page.getByRole('form', { name: 'Publicación municipal' });
  await form.waitFor();
  await form.locator('select').first().selectOption('notice');
  await form.getByLabel(/^Título/).fill('Corte de agua en la calle Mayor el jueves');
  await form.getByLabel(/^Resumen/).fill('El jueves, de 9:00 a 13:00, no habrá agua en la calle Mayor por obras.');
  await form.getByLabel('¿Qué deben saber los vecinos?', { exact: true }).fill('Ejemplo para el manual: el servicio se restablecerá a las 13:00. Disculpad las molestias.');
  await form.getByLabel(/^Mostrar el aviso hasta/).fill('2099-12-31');
  const png = await sharp({ create: { width: 1200, height: 675, channels: 3, background: '#2f6d8c' } }).png().toBuffer();
  await form.locator('input[type="file"]').setInputFiles({ name: 'calle-mayor.png', mimeType: 'image/png', buffer: png });
  await form.getByLabel('Descripción de la imagen', { exact: true }).fill('Calle Mayor de Pola de Lena');
  await form.getByLabel('Autoría o crédito', { exact: true }).fill('Ayuntamiento de Lena');
  await form.getByLabel(/declara que tiene los derechos necesarios/).check();
  await shot('02-formulario', form);
  const created = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/cms/municipal-content'));
  await form.getByRole('button', { name: 'Publicar ahora', exact: true }).click();
  const { doc } = await (await created).json();
  await page.getByRole('status').filter({ hasText: 'Publicado' }).waitFor();
  // Pestaña «Mis publicaciones»: solo el título y la primera fila (la publicación nueva), no toda la lista.
  await page.locator('[data-panel-tab="publicaciones"]').click();
  const section = page.locator('[data-panel-section="publicaciones"]');
  await section.evaluate(el => el.scrollIntoView({ block: 'start' }));
  const list = await section.boundingBox();
  const first = await section.locator('[data-publication]').first().boundingBox();
  await page.screenshot({ path: `${dir}/03-publicado.png`, clip: { x: list.x, y: list.y, width: list.width, height: first.y + first.height - list.y + 8 } });

  const visitor = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await visitor.addCookies([{ name: 'planta14_consent', value: '1%3Arejected', url }]);
  const web = await visitor.newPage();
  await web.goto(`${url}/lena`);
  const notices = web.locator('.municipal-notices');
  await notices.getByText('Corte de agua en la calle Mayor').first().waitFor();
  await notices.scrollIntoViewIfNeeded();
  await shot.call(null, '04-en-la-web', notices);

  await payload.update({ collection: 'municipal-content', id: doc.id, overrideAccess: true, data: { withdrawal: { withdrawn: true, reason: 'La fecha del corte era incorrecta. Publicad de nuevo el aviso con la fecha correcta.' } } });
  await page.goto(`${url}/lena/panel?pestana=publicaciones`);
  const card = page.locator('[data-publication]').filter({ hasText: 'Corte de agua en la calle Mayor' });
  await card.getByText('Motivo:').waitFor();
  await shot('05-retirado', card);
  await visitor.close(); await context.close();
  console.log(`Capturas del manual en ${dir}/`);
}
