// Lanzador de npm run cms:fiestas:importar. `payload run` no pasa argumentos al script: este los lee y los entrega por
// variables de entorno, y rechaza cualquier opción desconocida. Con «-» lee el JSON de la entrada estándar (útil en el
// contenedor de migraciones del servidor: ... run --rm -T migrate npm run cms:fiestas:importar -- - < fiestas.json).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const env = { ...process.env, FIESTAS_JSON: '', FIESTAS_PUBLICAR: '', FIESTAS_SOLO_COMPROBAR: '' };
for (const arg of args) {
  if (arg === '--publicar') env.FIESTAS_PUBLICAR = '1';
  else if (arg === '--solo-comprobar') env.FIESTAS_SOLO_COMPROBAR = '1';
  else if (!arg.startsWith('--') && !env.FIESTAS_JSON) env.FIESTAS_JSON = arg;
  else { console.error(`Opción no reconocida: ${arg}. Uso: npm run cms:fiestas:importar -- archivo.json|- [--publicar] [--solo-comprobar]. No se ha hecho nada.`); process.exit(2); }
}
if (!env.FIESTAS_JSON) { console.error('Falta el archivo JSON (o «-» para leerlo de la entrada estándar). No se ha hecho nada.'); process.exit(2); }
if (env.FIESTAS_JSON === '-') {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'fiestas-')), 'fiestas.json');
  writeFileSync(file, readFileSync(0));
  env.FIESTAS_JSON = file;
} else env.FIESTAS_JSON = path.resolve(env.FIESTAS_JSON);
const result = spawnSync(path.resolve('node_modules/.bin/payload'), ['run', 'scripts/fiestas-importar.ts'], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
