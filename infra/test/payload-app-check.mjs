// Comprobación funcional con el usuario de APLICACIÓN de PostgreSQL: Payload arranca y hace
// altas, inicio de sesión (sesiones), lecturas, cambios y bajas. Ejecutar con "payload run".
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

if (process.env.PLANTA14_ROLE_CHECK !== 'true') throw new Error('Solo para infra/test/postgres-roles-test.sh');
const { getPayload } = await import('payload');
const { default: config } = await import('../../payload.config.ts');
const payload = await getPayload({ config });
try {
  const password = randomUUID() + randomUUID();
  const email = `roles-${randomUUID().slice(0, 8)}@example.test`;
  const user = await payload.create({ collection: 'users', overrideAccess: true, context: { cmsBootstrap: true }, data: { email, password, name: 'Prueba de permisos', role: 'admin' } });
  const login = await payload.login({ collection: 'users', data: { email, password } });
  assert(login.token, 'login writes the session with the application user');
  const updated = await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { name: 'Prueba actualizada' } });
  assert.equal(updated.name, 'Prueba actualizada');
  assert.equal((await payload.find({ collection: 'users', overrideAccess: true, where: { email: { equals: email } } })).totalDocs, 1);
  await payload.delete({ collection: 'users', id: user.id, overrideAccess: true });
  assert.equal((await payload.count({ collection: 'users', overrideAccess: true, where: { email: { equals: email } } })).totalDocs, 0);
  console.log('PASS: Payload works with the application user (create, login/session, read, update, delete)');
} finally {
  await payload.destroy();
}
