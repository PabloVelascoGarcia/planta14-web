import { readFileSync } from 'node:fs';
import { getPayload } from 'payload';
import config from '../payload.config';
import { cmsEnvironment } from '../cms/environment';
import { importFiestas } from '../cms/fiestas-import';

// Ver cms/fiestas-import.ts. Se lanza con npm run cms:fiestas:importar (scripts/fiestas-run.mjs).
if (!cmsEnvironment().enabled) throw new Error('Requiere CMS_ENABLED=true');
const file = process.env.FIESTAS_JSON;
if (!file) throw new Error('Usa npm run cms:fiestas:importar -- archivo.json');
const items = JSON.parse(readFileSync(file, 'utf8'));
const opts = { publicar: process.env.FIESTAS_PUBLICAR === '1', soloComprobar: process.env.FIESTAS_SOLO_COMPROBAR === '1' };
const payload = await getPayload({ config });
try {
  const report = await importFiestas(payload, items, opts);
  if (report.errores.length) {
    console.log(`ERRORES (no se ha importado nada):\n  ${report.errores.join('\n  ')}`);
    process.exitCode = 1;
  } else {
    const verb = opts.soloComprobar ? 'Se crearían' : 'Creadas';
    console.log(`Formato: ${report.formato === 'catalogo' ? 'catálogo de fiestas (todas como borrador, sin fechas publicables)' : 'lista de fiestas con fecha'}`);
    console.log(`${verb} ${report.creadas.length} fiestas${opts.publicar ? ' publicadas' : ' como borrador'}${report.creadas.length ? `:\n  ${report.creadas.join('\n  ')}` : '.'}`);
    if (report.formato === 'catalogo') console.log(`De ellas: ${report.pendientes} con «Fecha pendiente» y ${report.orientativas} con «Fecha orientativa (2025)».`);
    console.log(`Ya existían ${report.existentes.length}${report.existentes.length ? ` (no se tocan):\n  ${report.existentes.join('\n  ')}` : '.'}`);
    console.log(opts.soloComprobar ? 'COMPROBACIÓN TERMINADA (sin cambios)' : 'IMPORTACIÓN TERMINADA');
  }
} finally {
  await payload.destroy();
}
// `payload run` no respeta process.exitCode: con errores se sale con 1 explícitamente.
if (process.exitCode) process.exit(process.exitCode);
