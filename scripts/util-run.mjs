// Lanzador de npm run cms:patrimonio:importar, cms:rutas:importar y cms:servicios:importar (como scripts/fiestas-run.mjs):
// `payload run` no pasa argumentos al script. Con «-» lee el JSON de la entrada estándar.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [kind, ...args] = process.argv.slice(2);
const usage = `Uso: npm run cms:${kind}:importar -- archivo.json|- [--publicar] [--solo-comprobar]. No se ha hecho nada.`;
if (!['patrimonio', 'rutas', 'servicios'].includes(kind)) { console.error('Tipo no válido (patrimonio, rutas o servicios).'); process.exit(2); }
const env = { ...process.env, UTIL_IMPORT_KIND: kind, UTIL_IMPORT_JSON: '', UTIL_IMPORT_PUBLICAR: '', UTIL_IMPORT_SOLO_COMPROBAR: '' };
for (const arg of args) {
  if (arg === '--publicar' && kind !== 'servicios') env.UTIL_IMPORT_PUBLICAR = '1';
  else if (arg === '--solo-comprobar') env.UTIL_IMPORT_SOLO_COMPROBAR = '1';
  else if (!arg.startsWith('--') && !env.UTIL_IMPORT_JSON) env.UTIL_IMPORT_JSON = arg;
  else { console.error(`Opción no reconocida: ${arg}. ${usage}`); process.exit(2); }
}
if (!env.UTIL_IMPORT_JSON) { console.error(`Falta el archivo JSON (o «-» para leerlo de la entrada estándar). ${usage}`); process.exit(2); }
if (env.UTIL_IMPORT_JSON === '-') {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), `${kind}-`)), `${kind}.json`);
  writeFileSync(file, readFileSync(0));
  env.UTIL_IMPORT_JSON = file;
} else env.UTIL_IMPORT_JSON = path.resolve(env.UTIL_IMPORT_JSON);
const result = spawnSync(path.resolve('node_modules/.bin/payload'), ['run', 'scripts/util-importar.ts'], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
