import { getPayload } from 'payload';
import config from '../payload.config';
import { cmsEnvironment } from '../cms/environment';

// Explicit, one-time local API operation. There is no public first-user endpoint.
if (!cmsEnvironment().enabled) throw new Error('Activa CMS_ENABLED antes de crear el administrador');
const email = process.env.CMS_BOOTSTRAP_EMAIL;
const password = process.env.CMS_BOOTSTRAP_PASSWORD;
if (!email || !password || password.length < 16) throw new Error('Configura email y contraseña de al menos 16 caracteres');
const payload = await getPayload({ config });
try {
  const users = await payload.count({ collection: 'users', overrideAccess: true });
  if (users.totalDocs !== 0) throw new Error('Ya existen usuarios. No se modifica ninguna cuenta');
  await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { email, password, name: 'Administrador Planta 14', role: 'admin' } });
  payload.logger.info('Administrador creado. Retira CMS_BOOTSTRAP_PASSWORD del entorno.');
} finally {
  await payload.destroy();
}
