import type { Payload } from 'payload';
import { getPayload } from 'payload';
import config from '../payload.config';
import { cargarResponsables } from '../cms/responsables';
import { cmsEnvironment } from '../cms/environment';

// npm run cms:responsables — cuentas y asignación iniciales de los periodistas responsables por concejo (repetible).
if (!cmsEnvironment().enabled) throw new Error('Requiere CMS_ENABLED=true');
const payload: Payload = await getPayload({ config });
try {
  for (const line of await cargarResponsables(payload)) console.log(line);
  console.log('RESPONSABLES CARGADOS');
} finally {
  await payload.destroy();
}
