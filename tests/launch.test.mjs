import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const site = await load('lib/site-config.ts');
assert.equal(site.isIndexable({}), false);
assert.equal(site.isIndexable({ SITE_INDEXABLE: '1' }), false, 'only the exact value "true" enables indexing');
assert.equal(site.isIndexable({ SITE_INDEXABLE: 'true' }), false, 'demo content is never indexable');
assert.equal(site.isIndexable({ SITE_INDEXABLE: 'true', CONTENT_SOURCE: 'payload' }), true);
const live = { SITE_INDEXABLE: 'true', CONTENT_SOURCE: 'payload' };
for (const path of ['/', '/noticia/x', '/lena', '/aviso-legal', '/sitemap.xml', '/_next/static/chunk.js']) assert.equal(site.robotsHeader(path, {}), 'noindex, nofollow', path);
for (const path of ['/', '/noticia/x', '/lena', '/aviso-legal']) assert.equal(site.robotsHeader(path, live), null, path);
for (const path of ['/cms', '/cms/login', '/api/health', '/api/cms/users', '/admin', '/buscar', '/lena/panel', '/niebla/x']) assert.equal(site.robotsHeader(path, live), 'noindex, nofollow', path);
// The proxy (which sets X-Robots-Tag) applies exactly the same rule.
const { default: Module } = await import('node:module');
const path = await import('node:path');
const loadCJS = (file, deps) => { const filename = path.resolve(file); const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const req = mod.require.bind(mod); mod.require = name => deps[name] || req(name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename); return mod.exports; };
const { proxy } = loadCJS('proxy.ts', { '@/lib/session-codec': loadCJS('lib/session-codec.ts', {}) });
const { NextRequest } = await import('next/server.js');
for (const [value, source] of [[undefined, 'payload'], ['true', undefined], ['true', 'payload']]) {
  if (value) process.env.SITE_INDEXABLE = value; else delete process.env.SITE_INDEXABLE;
  if (source) process.env.CONTENT_SOURCE = source; else delete process.env.CONTENT_SOURCE;
  for (const path of ['/', '/noticia/x', '/lena', '/lena/panel', '/cms', '/api/health', '/buscar', '/niebla', '/aviso-legal', '/icon.png']) {
    assert.equal(proxy(new NextRequest('https://p14.example' + path)).headers.get('x-robots-tag'), site.robotsHeader(path, process.env), `${value}: ${path}`);
  }
}
delete process.env.SITE_INDEXABLE; delete process.env.CONTENT_SOURCE;
console.log('PASS: noindex unless SITE_INDEXABLE=true with real content (never for demo); private areas always noindex; proxy and site-config agree');

const consent = await load('lib/consent.ts');
assert.equal(consent.analyticsId({}), null);
assert.equal(consent.analyticsId({ GA4_MEASUREMENT_ID: 'UA-123' }), null);
assert.equal(consent.analyticsId({ GA4_MEASUREMENT_ID: '<script>' }), null);
assert.equal(consent.analyticsId({ GA4_MEASUREMENT_ID: ' G-ABC123XYZ ' }), 'G-ABC123XYZ');
assert.equal(consent.readConsent(''), null);
assert.equal(consent.readConsent('a=1; planta14_consent=1%3Aaccepted'), 'accepted');
assert.equal(consent.readConsent('planta14_consent=1:rejected; b=2'), 'rejected');
assert.equal(consent.readConsent('planta14_consent=0:accepted'), null, 'old versions ask again');
assert.equal(consent.readConsent('planta14_consent=1:maybe'), null);
assert.match(consent.consentCookie('rejected', true), /^planta14_consent=1%3Arejected; Max-Age=15552000; Path=\/; SameSite=Lax; Secure$/);
for (const name of ['_ga', '_ga_ABC123', '_gid', '_gat', '_gat_UA']) assert(consent.isAnalyticsCookie(name), name);
for (const name of ['planta14_consent', 'payload-token', '_gax']) assert(!consent.isAnalyticsCookie(name), name);
console.log('PASS: GA4 id validation, consent cookie format/versioning and analytics cookie detection');
