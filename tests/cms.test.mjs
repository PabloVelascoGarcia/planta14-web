import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function load(file) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const { cmsEnabled, cmsEnvironment } = await load('cms/environment.ts');
assert.equal(cmsEnabled({}), false);
assert.equal(cmsEnabled({ CMS_ENABLED: 'false' }), false);
assert.equal(cmsEnvironment({}).enabled, false);
assert.throws(() => cmsEnvironment({ CMS_ENABLED: 'true' }), /PAYLOAD_SECRET/);
const env = { CMS_ENABLED: 'true', PAYLOAD_SECRET: 'x'.repeat(40), DATABASE_URL: 'postgres://local/test', S3_BUCKET: 'test', S3_REGION: 'us-east-1', S3_ACCESS_KEY_ID: 'test', S3_SECRET_ACCESS_KEY: 'test', CMS_SERVER_URL: 'http://localhost:3000' };
assert.equal(cmsEnvironment(env).enabled, true);
assert.throws(() => cmsEnvironment({ ...env, PAYLOAD_SECRET: 'short' }), /32/);
assert.throws(() => cmsEnvironment({ ...env, DATABASE_URL: 'sqlite:test' }), /PostgreSQL/);
assert.equal(cmsEnvironment({ ...env, NODE_ENV: 'production' }).enabled, true);
assert.throws(() => cmsEnvironment({ ...env, NODE_ENV: 'production', CMS_SERVER_URL: 'http://example.com' }), /HTTPS/);
const { adminOnly, ownUserOrAdmin } = await load('cms/access.ts');
const request = (user) => ({ req: { user } });
assert.equal(adminOnly(request(null)), false);
assert.equal(adminOnly(request({ collection: 'legacy', role: 'admin' })), false);
assert.equal(adminOnly(request({ collection: 'users', role: 'writer' })), false);
assert.equal(adminOnly(request({ collection: 'users', role: 'admin' })), true);
assert.equal(ownUserOrAdmin(request(null)), false);
assert.deepEqual(ownUserOrAdmin(request({ id: 3, collection: 'users', role: 'writer' })), { id: { equals: 3 } });
console.log('PASS: CMS activation, configuration, HTTPS, anonymous access and role isolation');
