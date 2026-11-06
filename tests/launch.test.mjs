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
assert.equal(site.configuredSiteUrl({ SITE_URL: 'https://planta14.example/' }), 'https://planta14.example');
for (const value of ['javascript:alert(1)', 'https://user:secret@example.test', 'https://example.test/path', 'https://example.test/?a=1']) {
  assert.throws(() => site.configuredSiteUrl({ SITE_URL: value }));
}
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


const { createHealthProbe } = await load('lib/health-probe.ts');
let calls = 0, clock = 1, finish;
const probe = createHealthProbe(() => { calls++; return new Promise(resolve => { finish = resolve; }); }, { ttlMs: 20, timeoutMs: 5, now: () => clock });
assert.deepEqual(await Promise.all(Array.from({ length: 100 }, () => probe())), Array(100).fill(false));
assert.equal(calls, 1, 'concurrent health requests share one underlying query');
clock += 25; assert.equal(await probe(), false);
assert.equal(calls, 1, 'a timeout must not spawn more queries while the old query is pending');
finish(); await new Promise(resolve => setTimeout(resolve, 0));
clock += 25; const recovered = probe(); await new Promise(resolve => setTimeout(resolve, 0)); finish();
assert.equal(await recovered, true); assert.equal(calls, 2);
await probe(); assert.equal(calls, 2, 'successful result cached for the TTL');
console.log('PASS: health single-flight, bounded refresh, timeout without query buildup and recovery');
