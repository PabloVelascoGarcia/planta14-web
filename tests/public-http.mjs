import assert from 'node:assert/strict';
const base = process.env.PLANTA14_TEST_URL || 'http://127.0.0.1:3020';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('This smoke test is local-only');
for (const route of ['/', '/lena', '/mieres', '/aller', '/morcin', '/riosa', '/ribera-de-arriba', '/lena/panel', '/robots.txt', '/sitemap.xml']) {
  const response = await fetch(base + route);
  assert.equal(response.status, 200, route);
  assert.match(response.headers.get('x-robots-tag'), /noindex/, route);
}
assert.match(await (await fetch(base + '/robots.txt')).text(), /Disallow: \//);
for (const route of ['/cms', '/api/cms/users', '/api/cms/media']) assert.equal((await fetch(base + route)).status, 404, route);
assert.equal((await fetch(base + '/api/cms/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
assert.equal((await fetch(base + '/api/articles')).status, 401);
console.log('PASS: public and municipal routes, robots/sitemap, noindex, disabled CMS and legacy API guard');
