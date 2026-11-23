// Se ejecuta antes de cada compilación (npm run build → prebuild): convierte los manuales del repositorio
// (docs/MANUAL-REDACCION.md y docs/MANUAL-AYUNTAMIENTOS.md) en generated/manuales.json, que usa la Ayuda del CMS y del
// panel. Así la Ayuda está siempre al día con lo instalado, sin reenviar nada.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseManual } from '../lib/manual-parse.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const manuals = { redaccion: 'docs/MANUAL-REDACCION.md', ayuntamiento: 'docs/MANUAL-AYUNTAMIENTOS.md' };
const out = { generatedAt: new Date().toISOString() };
for (const [key, file] of Object.entries(manuals)) out[key] = parseManual(await readFile(path.join(root, file), 'utf8'));
await mkdir(path.join(root, 'generated'), { recursive: true });
await writeFile(path.join(root, 'generated/manuales.json'), JSON.stringify(out));
console.log(`Manuales generados: ${Object.keys(manuals).map(k => `${k} (${out[k].blocks.length} bloques)`).join(', ')}`);
