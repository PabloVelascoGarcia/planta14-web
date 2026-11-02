import assert from 'node:assert/strict';

/** Only user-interface actions; the response is observed, never issued by the test. */
export async function withdrawThroughCMS(page, origin, id, reason) {
  await page.goto(`${origin}/cms/collections/municipal-content/${id}`);
  // Payload lazily renders groups outside the viewport.
  await page.getByText('Retirada por Planta 14', { exact: true }).scrollIntoViewIfNeeded();
  await page.getByLabel('Retirado', { exact: true }).check();
  await page.getByLabel('Motivo', { exact: true }).fill(reason);
  const saved = page.waitForResponse(response => response.request().method() === 'PATCH'
    && new URL(response.url()).pathname === `/api/cms/municipal-content/${id}`);
  // Deliberately use Save Draft: a withdrawal must still affect the live document immediately.
  await page.locator('#action-save-draft').click();
  const response = await saved;
  const body = await response.json();
  assert.equal(response.status(), 200, JSON.stringify(body));
  assert.equal(body.doc.withdrawal.withdrawn, true);
  assert.equal(body.doc.withdrawal.reason, reason);
  assert.equal(body.doc._status, 'draft');
  await page.reload();
  assert.equal(await page.getByLabel('Retirado', { exact: true }).isChecked(), true);
  assert.equal(await page.getByLabel('Motivo', { exact: true }).inputValue(), reason);
}
