import { getPayload } from 'payload';
import config from '../payload.config';
import { retirar, resumen } from '../cms/ensayo';
import { cmsEnvironment } from '../cms/environment';
// npm run cms:ensayo:retirar [-- --solo-comprobar] [-- --usuario correo-admin]
// Borra SOLO lo marcado como lote ensayo y restaura los espacios municipales. Exige ENSAYO_COPIA_PREVIA (la copia de
// seguridad hecha justo antes): úsalo a través de infra/deploy/ensayo.sh retirar, que la hace con las herramientas de copia.
// Opciones desde scripts/ensayo-run.mjs (payload run no pasa argumentos).
if (process.env.ENSAYO_SOLO_COMPROBAR === undefined) throw new Error('Ejecuta esta orden con npm run (scripts/ensayo-run.mjs)');
const soloComprobar = process.env.ENSAYO_SOLO_COMPROBAR === '1';
const usuario = process.env.ENSAYO_USUARIO || undefined;
if (!cmsEnvironment().enabled) throw new Error('La retirada del ensayo requiere CMS_ENABLED=true');
const payload = await getPayload({ config });
try {
  const log = (line: string) => console.log(line);
  log(soloComprobar ? 'SOLO COMPROBAR: no se borra nada.' : `Retirada del contenido de ensayo (copia previa: ${process.env.ENSAYO_COPIA_PREVIA ?? 'ninguna'})`);
  const informe = await retirar(payload, { soloComprobar, copiaPrevia: process.env.ENSAYO_COPIA_PREVIA, usuario, log });
  log(`${soloComprobar ? 'Se borraría' : 'Borrado'}: ${resumen(informe.borrados)}.`);
  for (const line of informe.conservados) log(`Se conserva: ${line}`);
  for (const line of informe.espacios) log(`Espacio ${line}`);
  log(soloComprobar ? 'COMPROBACIÓN TERMINADA (sin cambios).' : 'RETIRADA TERMINADA.');
} finally { await payload.destroy(); }
