import { readFileSync } from 'node:fs';
import { getPayload } from 'payload';
import config from '../payload.config';
import { cmsEnvironment } from '../cms/environment';
import { importUtil, type UtilImportKind } from '../cms/util-import';

// Ver cms/util-import.ts. Se lanza con npm run cms:patrimonio:importar, cms:rutas:importar o cms:servicios:importar (scripts/util-run.mjs).
if (!cmsEnvironment().enabled) throw new Error('Requiere CMS_ENABLED=true');
const kind = process.env.UTIL_IMPORT_KIND as UtilImportKind;
const file = process.env.UTIL_IMPORT_JSON;
if (!file || !['patrimonio', 'rutas', 'servicios'].includes(kind)) throw new Error('Usa npm run cms:patrimonio:importar -- archivo.json');
const json = JSON.parse(readFileSync(file, 'utf8'));
const opts = { publicar: process.env.UTIL_IMPORT_PUBLICAR === '1', soloComprobar: process.env.UTIL_IMPORT_SOLO_COMPROBAR === '1' };
const payload = await getPayload({ config });
const noun = kind === 'patrimonio' ? 'fichas de patrimonio' : kind === 'rutas' ? 'rutas' : 'servicios municipales';
try {
  const report = await importUtil(payload, kind, json, opts);
  if (report.errores.length) {
    console.log(`ERRORES (no se ha importado nada):\n  ${report.errores.join('\n  ')}`);
    process.exitCode = 1;
  } else {
    const how = kind === 'servicios' ? '' : opts.publicar ? ' publicadas' : ' sin publicar';
    console.log(`${opts.soloComprobar ? 'Se crearían' : 'Creados'} ${report.creadas.length} ${noun}${how}${report.creadas.length ? `:\n  ${report.creadas.join('\n  ')}` : '.'}`);
    if (report.completadas.length) console.log(`Completadas ${report.completadas.length} (foto, recorrido o fecha de comprobación que faltaba):\n  ${report.completadas.join('\n  ')}`);
    if (report.avisos.length) console.log(`AVISOS:\n  ${report.avisos.join('\n  ')}`);
    if (report.omitidas.length) console.log(`No se importan: ${report.omitidas.join('; ')}.`);
    console.log(`Ya existían ${report.existentes.length}${report.existentes.length ? ` (no se tocan):\n  ${report.existentes.join('\n  ')}` : '.'}`);
    console.log(opts.soloComprobar ? 'COMPROBACIÓN TERMINADA (sin cambios)' : 'IMPORTACIÓN TERMINADA');
  }
} finally {
  await payload.destroy();
}
// `payload run` no respeta process.exitCode: con errores se sale con 1 explícitamente.
if (process.exitCode) process.exit(process.exitCode);
