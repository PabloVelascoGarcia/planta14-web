import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
// Modo mantenimiento: guardián de Payload (cms/maintenance.ts) y coherencia con Caddy y Compose de producción.
const source = fs.readFileSync('cms/maintenance.ts', 'utf8').replace("from 'payload'", `from '${import.meta.resolve('payload')}'`);
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const m = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planta14-maint-'));
const flag = path.join(dir, 'activo');
delete process.env.MAINTENANCE_FLAG_FILE;
assert.equal(m.maintenanceActive(), false, 'sin variable: nunca en mantenimiento');
process.env.MAINTENANCE_FLAG_FILE = flag;
assert.equal(m.maintenanceActive(), false);
for (const operation of ['create', 'update', 'delete']) assert.doesNotThrow(() => m.maintenanceGuard({ operation }));
fs.writeFileSync(flag, 'motivo=prueba\n');
assert.equal(m.maintenanceActive(), true, 'se lee en cada llamada, sin reiniciar');
for (const operation of ['create', 'update', 'delete', 'autosave', 'restoreVersion', 'forgotPassword', 'resetPassword']) {
  assert.throws(() => m.maintenanceGuard({ operation }), error => error.status === 503 && error.isPublic === true && error.message === m.MAINTENANCE_MESSAGE, operation);
}
for (const operation of ['read', 'count', 'login', 'refresh', 'readDistinct']) assert.doesNotThrow(() => m.maintenanceGuard({ operation }), operation);
fs.rmSync(flag);
assert.equal(m.maintenanceActive(), false, 'al quitar el archivo se vuelve a escribir');
const own = () => undefined;
const guarded = m.withMaintenanceGuard({ slug: 'x', fields: [], hooks: { beforeOperation: [own], afterChange: [own] } });
assert.deepEqual(guarded.hooks.beforeOperation, [m.maintenanceGuard, own]);
assert.deepEqual(guarded.hooks.afterChange, [own]);
assert.deepEqual(m.withMaintenanceGuard({ slug: 'y', fields: [] }).hooks.beforeOperation, [m.maintenanceGuard]);
fs.rmSync(dir, { recursive: true });

const config = fs.readFileSync('payload.config.ts', 'utf8');
assert.match(config, /\]\.map\(withMaintenanceGuard\)/, 'todas las colecciones con el guardián');
const caddy = fs.readFileSync('infra/Caddyfile.production', 'utf8');
const compose = fs.readFileSync('infra/compose.production.yaml', 'utf8');
assert.match(caddy, /root \/srv\/mantenimiento\s+try_files \/activo/);
assert.ok(caddy.includes(JSON.stringify(m.MAINTENANCE_MESSAGE).slice(1, -1)), 'Caddy y la app dan el mismo mensaje');
assert.match(caddy, /not method GET HEAD OPTIONS/);
assert.match(compose, /\$\{MAINTENANCE_DIR:-\/srv\/planta14\/mantenimiento\}:\/srv\/mantenimiento:ro/);
assert.match(compose, /\$\{MAINTENANCE_DIR:-\/srv\/planta14\/mantenimiento\}:\/run\/planta14-mantenimiento:ro/);
assert.match(compose, /MAINTENANCE_FLAG_FILE: \/run\/planta14-mantenimiento\/activo/);
const migrate = compose.slice(compose.indexOf('\n  migrate:'), compose.indexOf('\n  postgres:'));
assert.doesNotMatch(migrate, /MAINTENANCE_FLAG_FILE/, 'las migraciones no quedan bloqueadas por el mantenimiento');
console.log('PASS: maintenance mode blocks Payload writes per request (no restart), allows reads/login, same flag and message in Caddy, app and Compose');
