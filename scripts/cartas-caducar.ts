import { getPayload } from 'payload';
import config from '../payload.config';
import { cmsEnvironment } from '../cms/environment';
import { eraseExpiredPersonalData, PERSONAL_DATA_MONTHS } from '../cms/letters';

// Borra DNI y teléfono de las cartas de hace más de 24 meses (también se hace al recibir cartas y al abrir el CMS).
if (!cmsEnvironment().enabled) throw new Error('Requiere CMS_ENABLED=true');
const payload = await getPayload({ config });
try { console.log(`Cartas con DNI y teléfono borrados (más de ${PERSONAL_DATA_MONTHS} meses): ${await eraseExpiredPersonalData(payload)}`); }
finally { await payload.destroy(); }
