import path from 'node:path';
import { getPayload } from 'payload';
import config from '../payload.config';
import { cargar, resumen } from '../cms/ensayo';
import { cmsEnvironment } from '../cms/environment';
// npm run cms:ensayo:cargar [-- --solo-comprobar] [-- --usuario correo-admin]
// Carga contenido-ensayo/ en el CMS (lote ensayo o definitivo). Repetible: no duplica. Ver docs/ENSAYO-CONTENIDO.md.
// Opciones desde scripts/ensayo-run.mjs (payload run no pasa argumentos).
if (process.env.ENSAYO_SOLO_COMPROBAR === undefined) throw new Error('Ejecuta esta orden con npm run (scripts/ensayo-run.mjs)');
const soloComprobar = process.env.ENSAYO_SOLO_COMPROBAR === '1';
const usuario = process.env.ENSAYO_USUARIO || undefined;
if (!cmsEnvironment().enabled) throw new Error('La carga de ensayo requiere CMS_ENABLED=true');
const payload = await getPayload({ config });
try {
  const log = (line: string) => console.log(line);
  log(soloComprobar ? 'SOLO COMPROBAR: no se escribe nada.' : 'Carga del contenido de ensayo');
  const informe = await cargar(payload, { dir: path.resolve(process.env.ENSAYO_DIR || 'contenido-ensayo'), soloComprobar, usuario, log });
  log(`${soloComprobar ? 'Se crearían' : 'Creados'}: ${resumen(informe.creados)}. Ya existían: ${resumen(informe.existentes)}.`);
  for (const line of informe.espacios) log(`Espacio ${line}`);
  for (const line of informe.avisos) log(`Aviso: ${line}`);
  log(soloComprobar ? 'COMPROBACIÓN TERMINADA (sin cambios).' : 'CARGA TERMINADA.');
} finally { await payload.destroy(); }
