import { getPayload } from 'payload';
import config from '../payload.config';
import { loadStructure } from '../cms/structure';
import { cmsEnvironment } from '../cms/environment';
// Estructura de producción (secciones, concejos del Caudal y espacios municipales inactivos), sin contenido de
// demostración. Repetible: no duplica ni modifica lo que ya existe. Ver docs/PUESTA-EN-MARCHA-IONOS.md.
if (!cmsEnvironment().enabled) throw new Error('La carga de estructura requiere CMS_ENABLED=true');
const payload = await getPayload({ config });
try {
  const { created, existing } = await loadStructure(payload);
  payload.logger.info(`Estructura cargada. Creados: ${created.sections} secciones, ${created.towns} concejos, ${created['municipal-spaces']} espacios municipales (inactivos). Ya existían: ${existing.sections}, ${existing.towns} y ${existing['municipal-spaces']}. Sin contenido de demostración.`);
} finally { await payload.destroy(); }
