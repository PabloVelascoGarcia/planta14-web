// Lanzador de npm run cms:ensayo:cargar / cms:ensayo:retirar. `payload run` no pasa argumentos al script, así que
// este lanzador los lee y los entrega por variables de entorno. Rechaza cualquier opción desconocida: una errata en
// --solo-comprobar nunca debe convertirse en una carga o una retirada real.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const [accion, ...args] = process.argv.slice(2);
const scripts = { cargar: 'scripts/ensayo-cargar.ts', retirar: 'scripts/ensayo-retirar.ts' };
if (!scripts[accion]) { console.error('Uso: npm run cms:ensayo:cargar|cms:ensayo:retirar [-- --solo-comprobar] [--usuario correo-admin]'); process.exit(2); }
// MALLOC_ARENA_MAX=2: con sharp (varios hilos de libvips), glibc reparte la memoria en muchas arenas y el proceso
// no la devuelve; con dos, la carga de las fotos queda holgada en el contenedor de migraciones (768 MiB).
const env = { ...process.env, MALLOC_ARENA_MAX: process.env.MALLOC_ARENA_MAX || '2', ENSAYO_SOLO_COMPROBAR: '', ENSAYO_USUARIO: '' };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--solo-comprobar') env.ENSAYO_SOLO_COMPROBAR = '1';
  else if (args[i] === '--usuario' && args[i + 1] && !args[i + 1].startsWith('--')) env.ENSAYO_USUARIO = args[++i];
  else { console.error(`Opción no reconocida: ${args[i]}. Opciones: --solo-comprobar, --usuario correo-admin. No se ha hecho nada.`); process.exit(2); }
}
const payloadBin = path.resolve('node_modules/.bin/payload');
const result = spawnSync(payloadBin, ['run', scripts[accion]], { env, stdio: 'inherit' });
process.exit(result.status ?? 1);
