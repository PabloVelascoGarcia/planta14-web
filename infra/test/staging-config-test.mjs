// Local configuration/proxy validation only. No staging stack or external domain is deployed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import https from 'node:https';

const root = path.resolve(import.meta.dirname, '../..');
const out = path.join(root, 'infra/test/out');
mkdirSync(out, { recursive: true });
const work = mkdtempSync(path.join(out, 'staging-config-'));
const id = randomBytes(6).toString('hex');
const front = `p14-review-caddy-${id}`, backend = `p14-review-backend-${id}`, network = `p14-review-${id}`;
const image = process.env.CADDY_IMAGE || 'caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d';
const media = `p14-review-media-${id}`;
const password = randomBytes(24).toString('hex');
const docker = (args, options = {}) => execFileSync('docker', args, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
const hash = docker(['run', '--rm', '-i', image, 'caddy', 'hash-password'], { input: password + '\n' }).trim();
const env = { ...process.env, STAGING_DOMAIN: 'localhost:8443', CADDY_TLS: 'internal', CADDY_BASIC_AUTH_USER: 'planta14', CADDY_BASIC_AUTH_HASH: hash, PUBLIC_MEDIA_BUCKET: 'planta14-staging-public', PUBLIC_MEDIA_UPSTREAM: 'minio:9000' };
const envArgs = ['-e', 'STAGING_DOMAIN', '-e', 'CADDY_TLS', '-e', 'CADDY_BASIC_AUTH_USER', '-e', 'CADDY_BASIC_AUTH_HASH', '-e', 'PUBLIC_MEDIA_BUCKET', '-e', 'PUBLIC_MEDIA_UPSTREAM'];
const configMount = `type=bind,source=${path.join(root, 'infra/Caddyfile')},target=/etc/caddy/Caddyfile,readonly`;
const request = (port, route, authorization, method = 'GET') => new Promise((resolve, reject) => {
  // Only a disposable loopback endpoint, with the internal CA created in this test container.
  const req = https.request({ method, hostname: '127.0.0.1', port, path: route, servername: 'localhost', rejectUnauthorized: false,
    headers: { Host: 'localhost:8443', ...(authorization ? { Authorization: authorization } : {}) } }, res => { let body = ''; res.setEncoding('utf8'); res.on('data', c => { body += c; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body })); });
  req.end();
  req.setTimeout(3000, () => req.destroy(new Error('Local proxy test timeout')));
  req.on('error', reject);
});
try {
  const values = { STAGING_DOMAIN: 'localhost', CADDY_TLS: 'internal', CADDY_BASIC_AUTH_HASH: `'${hash}'`, PAYLOAD_SECRET: randomBytes(32).toString('hex'), POSTGRES_PASSWORD: randomBytes(24).toString('hex'), POSTGRES_MIGRATOR_PASSWORD: randomBytes(24).toString('hex'), POSTGRES_APP_PASSWORD: randomBytes(24).toString('hex'), S3_ACCESS_KEY_ID: 'test-' + id, S3_SECRET_ACCESS_KEY: randomBytes(24).toString('hex') };
  const contents = readFileSync(path.join(root, 'infra/.env.staging.example'), 'utf8').replace(/^([A-Z_0-9]+)=$/gm, (line, key) => values[key] ? `${key}=${values[key]}` : line);
  const envFile = path.join(work, 'test.env');
  writeFileSync(envFile, contents, { mode: 0o600 });
  const composeArgs = ['compose', '-f', 'infra/compose.staging.yaml', '--env-file', envFile];
  for (const profile of ['', 'minio']) {
    const composeEnv = { ...process.env, COMPOSE_PROFILES: profile, CMS_ENABLED: 'false', CONTENT_SOURCE: 'demo' };
    docker([...composeArgs, 'config', '--quiet'], { env: composeEnv });
    const config = JSON.parse(docker([...composeArgs, 'config', '--format', 'json'], { env: composeEnv }));
    assert.equal(config.services.app.environment.CMS_ENABLED, 'true');
    assert.equal(config.services.app.environment.CONTENT_SOURCE, 'payload');
    // `compose config` escapes literal dollars for re-reading the rendered configuration.
    assert(config.services.caddy.environment.CADDY_BASIC_AUTH_HASH.replaceAll('$$', '$') === hash, 'bcrypt hash must survive Compose rendering');
    assert(!config.services.postgres.ports?.length);
    assert(!config.services.app.ports?.length);
    if (config.services.minio) assert(config.services.minio.ports.every(p => p.host_ip === '127.0.0.1' && p.target === 9001));
    // Separate PostgreSQL users: the app never uses the superuser nor the migrator.
    const appURL = new URL(config.services.app.environment.DATABASE_URL), migrateURL = new URL(config.services.migrate.environment.DATABASE_URL);
    assert.equal(appURL.username, 'planta14_app'); assert.equal(migrateURL.username, 'planta14_migrator');
    assert.equal(config.services.postgres.environment.POSTGRES_APP_USER, 'planta14_app');
    assert(config.services.postgres.volumes.some(v => v.target === '/docker-entrypoint-initdb.d' && v.read_only));
    // Base images pinned by digest (MinIO excepted: its registry is not reachable to resolve one).
    for (const [name, service] of Object.entries(config.services)) if (!name.startsWith('minio') && name !== 'app' && name !== 'migrate') assert.match(service.image, /@sha256:[0-9a-f]{64}$/, name);
    assert.match(config.services.app.build.args.NODE_IMAGE, /@sha256:[0-9a-f]{64}$/);
    // Caddy reaches only the edge and the public-media network, never the backend (PostgreSQL).
    assert.deepEqual(Object.keys(config.services.caddy.networks).sort(), ['edge', 'public_media']);
    assert.equal(config.networks.public_media.internal, true); assert.equal(config.networks.backend.internal, true);
    assert.equal(config.services.app.environment.PUBLIC_MEDIA_PREFIX, 'public');
    assert.equal(config.services.app.environment.PUBLIC_MEDIA_CACHE_CONTROL, 'public, max-age=31536000, immutable');
  }
  const missing = path.join(work, 'missing.env');
  writeFileSync(missing, contents.replace(/^CADDY_BASIC_AUTH_HASH=.*$/m, ''), { mode: 0o600 });
  assert.throws(() => docker(['compose', '-f', 'infra/compose.staging.yaml', '--env-file', missing, 'config', '--quiet'], { env: { ...process.env, CADDY_BASIC_AUTH_HASH: '' } }));
  console.log('PASS: compose config, fixed CMS/payload, no public database/storage API ports, missing hash fails closed');
  docker(['run', '--rm', ...envArgs, '--mount', configMount, image, 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'], { env });
  assert.throws(() => docker(['run', '--rm', ...envArgs, '--mount', configMount, image, 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'], { env: { ...env, CADDY_BASIC_AUTH_HASH: '' } }));
  console.log('PASS: official Caddy validates configuration and rejects missing password hash');
  docker(['network', 'create', network]);
  docker(['run', '-d', '--name', backend, '--network', network, '--network-alias', 'app', image, 'caddy', 'file-server', '--listen', ':3000', '--root', '/usr/share/caddy']);
  // Fake MinIO: a public and a private "bucket" directory.
  docker(['run', '-d', '--name', media, '--network', network, '--network-alias', 'minio', '--entrypoint', 'sh', image, '-c',
    'mkdir -p /srv/planta14-staging-public/public/abc /srv/planta14-staging && echo publico > /srv/planta14-staging-public/public/abc/foto.txt && echo SECRETO > /srv/planta14-staging/privado.txt && exec caddy file-server --listen :9000 --root /srv']);
  docker(['run', '-d', '--name', front, '--network', network, '-p', '127.0.0.1::8443', ...envArgs, '--mount', configMount, image], { env });
  const port = Number(docker(['port', front, '8443/tcp']).trim().split(':').at(-1));
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await request(port, '/')).status === 401) { ready = true; break; } } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert(ready, 'local Caddy did not become ready');
  for (const route of ['/', '/cms', '/api/cms/media', '/_next/static/test.js', '/robots.txt']) {
    const response = await request(port, route);
    assert.equal(response.status, 401, route);
    assert.match(response.headers['www-authenticate'], /Basic/i);
    assert.match(response.headers['x-robots-tag'], /noindex/);
    assert.equal(response.headers['cache-control'], 'private, no-store');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['x-frame-options'], 'DENY');
    assert(!response.headers.server);
  }
  assert.equal((await request(port, '/', 'Basic ' + Buffer.from('planta14:incorrect').toString('base64'))).status, 401);
  const authenticated = await request(port, '/', 'Basic ' + Buffer.from(`planta14:${password}`).toString('base64'));
  assert.equal(authenticated.status, 200);
  assert.match(authenticated.headers['x-robots-tag'], /noindex/);
  const auth = 'Basic ' + Buffer.from(`planta14:${password}`).toString('base64');
  assert.equal((await request(port, '/media/public/abc/foto.txt')).status, 401, 'public media also behind the staging password');
  const mediaOK = await request(port, '/media/public/abc/foto.txt', auth);
  assert.equal(mediaOK.status, 200); assert.equal(mediaOK.body.trim(), 'publico');
  for (const route of ['/media/../planta14-staging/privado.txt', '/media/%2e%2e/planta14-staging/privado.txt', '/media/%252e%252e/planta14-staging/privado.txt', '/media/..%2fplanta14-staging/privado.txt']) {
    const r = await request(port, route, auth);
    assert.notEqual(r.status, 200, route); assert(!r.body.includes('SECRETO'), route);
  }
  assert.equal((await request(port, '/media/public/abc/foto.txt', auth, 'PUT')).status, 405);
  assert.equal((await request(port, '/media/public/abc/foto.txt', auth, 'DELETE')).status, 405);
  console.log('PASS: /media serves only the public bucket, read-only, behind the staging password; traversal to the private bucket rejected');
  docker(['stop', backend]);
  const unavailable = await request(port, '/', 'Basic ' + Buffer.from(`planta14:${password}`).toString('base64'));
  assert.equal(unavailable.status, 502);
  assert.match(unavailable.headers['x-robots-tag'], /noindex/);
  assert.equal(unavailable.headers['cache-control'], 'private, no-store');
  console.log('PASS: unauthenticated and wrong-password requests denied; authenticated proxy works; noindex/security headers on private responses');
} finally {
  for (const container of [front, backend, media]) { try { docker(['rm', '-f', container]); } catch { /* not created */ } }
  try { docker(['network', 'rm', network]); } catch { /* not created */ }
  if (path.dirname(path.resolve(work)) !== out) throw new Error('Unexpected cleanup path');
  rmSync(work, { recursive: true, force: true });
}
