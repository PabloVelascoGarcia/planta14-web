// Lanzador de npm run cms:firma-direccion [-- --admin correo]. `payload run` no pasa argumentos al script: este lanzador
// los entrega por variables de entorno y rechaza cualquier opción desconocida.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const env = { ...process.env, FIRMA_ADMIN: '' };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--admin' && args[i + 1] && !args[i + 1].startsWith('--')) env.FIRMA_ADMIN = args[++i];
  else { console.error(`Opción no reconocida: ${args[i]}. Uso: --admin correo-de-administración. No se ha hecho nada.`); process.exit(2); }
}
const result = spawnSync(path.resolve('node_modules/.bin/payload'), ['run', 'scripts/firma-direccion.ts'], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
