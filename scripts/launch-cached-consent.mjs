import assert from 'node:assert/strict';

/** Warm a real browser CacheStorage with a synthetic gtag. No Google code or external request.
 * The worker exists only in this isolated test context; the application ships no service worker.
 */
export async function testCachedConsent(browser, origin, gaId) {
  const context = await browser.newContext();
  const scriptURL = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  let external = 0;
  await context.route(/googletagmanager\.com|google-analytics\.com/, route => {
    external++; return route.fulfill({ contentType: 'text/javascript', body: '' });
  });
  const cachedScript = 'window.__cachedGaRuns=(window.__cachedGaRuns||0)+1; document.cookie="_ga=cached-test; path=/";';
  await context.route(`${origin}/review-consent-worker.js`, route => route.fulfill({ contentType: 'text/javascript', body: `
    self.addEventListener('install', event => event.waitUntil((async () => {
      const cache = await caches.open('review-ga-cache');
      await cache.put(${JSON.stringify(scriptURL)}, new Response(${JSON.stringify(cachedScript)}, {headers:{'Content-Type':'text/javascript'}}));
      await self.skipWaiting();
    })()));
    self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
    self.addEventListener('fetch', event => {
      if (event.request.url === ${JSON.stringify(scriptURL)}) event.respondWith(caches.match(event.request));
    });` }));
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/review-consent-worker.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    assert.equal(await page.evaluate(url => caches.match(url).then(Boolean), scriptURL), true);
    assert.equal(await page.evaluate(() => window.__cachedGaRuns || 0), 0, 'warm cached gtag does not execute without consent');
    const banner = page.getByRole('dialog', { name: 'Cookies de medición' });
    await banner.getByRole('button', { name: 'Aceptar' }).click();
    await page.waitForFunction(() => window.__cachedGaRuns === 1);
    await page.getByRole('button', { name: 'Configurar cookies' }).click();
    await Promise.all([page.waitForEvent('load'), banner.getByRole('button', { name: 'Rechazar' }).click()]);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(url => caches.match(url).then(Boolean), scriptURL), true, 'cache remains warm after withdrawal');
    assert.equal(await page.evaluate(() => window.__cachedGaRuns || 0), 0, 'cached script not executed after withdrawal');
    assert.equal(await page.locator('#planta14-ga4').count(), 0);
    assert.equal(external, 0, 'all synthetic analytics served from local CacheStorage, never Google');
    assert.deepEqual((await context.cookies()).filter(cookie => cookie.name.startsWith('_ga')), []);
    console.log('PASS: warm browser CacheStorage cannot execute analytics before acceptance or after withdrawal');
  } finally { await context.close(); }
}
