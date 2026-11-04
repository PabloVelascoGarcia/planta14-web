// Bloque 4 de scripts/participacion-integration.mjs: «Última hora».
export async function run(ctx) {
  const { payload, users, page, passed, assert, web, start, stop, signIn } = ctx;

  // --- 4. Última hora: activable desde el CMS con texto, enlace y caducidad.
  assert.ok(!(await page(`${web}/`)).includes('data-breaking-news'), 'no bar while inactive');
  await assert.rejects(payload.updateGlobal({ slug: 'breaking-news', overrideAccess: false, data: { active: true, text: 'Anónimo' } }), 'anonymous cannot');
  await assert.rejects(payload.updateGlobal({ slug: 'breaking-news', user: users.editor, overrideAccess: false, data: { active: true, text: '' } }), /texto de la última hora/);
  await assert.rejects(payload.updateGlobal({ slug: 'breaking-news', user: users.editor, overrideAccess: false, data: { active: true, text: 'Corte', link: 'javascript:alert(1)' } }));
  await payload.updateGlobal({ slug: 'breaking-news', user: users.editor, overrideAccess: false,
    data: { active: true, text: 'Cortada la AS-112 en Moreda por un argayo', link: '/noticia/argayo-moreda', expiresAt: new Date(Date.now() + 3600_000).toISOString() } });
  for (const path of ['/', '/agenda', '/fiestas']) {
    const html = await page(`${web}${path}`);
    assert.ok(html.includes('data-breaking-news') && html.includes('Cortada la AS-112 en Moreda por un argayo') && html.includes('href="/noticia/argayo-moreda"'), `bar on ${path}`);
  }
  assert.ok(!(await page(`${web}/lena`)).includes('data-breaking-news'), 'not on concejo pages (they have their own masthead)');
  await payload.updateGlobal({ slug: 'breaking-news', overrideAccess: true, data: { expiresAt: new Date(Date.now() - 1000).toISOString() } });
  assert.ok(!(await page(`${web}/`)).includes('data-breaking-news'), 'expired: gone by itself');
  await payload.updateGlobal({ slug: 'breaking-news', overrideAccess: true, data: { expiresAt: null } });
  assert.ok((await page(`${web}/`)).includes('data-breaking-news'), 'without expiry it stays');
  await payload.updateGlobal({ slug: 'breaking-news', user: users.editor, overrideAccess: false, data: { active: false } });
  assert.ok(!(await page(`${web}/`)).includes('data-breaking-news'), 'unchecked: gone');
  passed('«Última hora»: the newsroom turns on a bar under the header with text, link and expiry (validated link, text required); it disappears at the expiry time or when unchecked; not on concejo pages');

}
