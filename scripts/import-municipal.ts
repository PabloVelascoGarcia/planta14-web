import { getPayload } from 'payload';
import config from '../payload.config';
import { importMunicipalDemo } from '../cms/import-municipal';
import { cmsEnvironment } from '../cms/environment';
if (!cmsEnvironment().enabled || process.env.IMPORT_MUNICIPAL_DEMO !== 'true' || process.env.NODE_ENV === 'production') throw new Error('La importación requiere CMS_ENABLED=true, IMPORT_MUNICIPAL_DEMO=true y un entorno de desarrollo');
const payload = await getPayload({ config });
try { await importMunicipalDemo(payload); payload.logger.info('Estructura y demostración municipal importadas. No se importan noticias editoriales, autores ni archivos.'); }
finally { await payload.destroy(); }
