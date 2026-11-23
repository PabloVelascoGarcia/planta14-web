// Firma de la dirección: crea (si no existe) el autor «El Director» (slug el-director, definitivo, sin foto ni biografía)
// y lo deja como firma fija de las cuentas de Pablo: «Pablo Velasco (redactor)» (pvelasco@assa.as) y su cuenta de
// administración (FIRMA_ADMIN; si no se indica y solo hay una cuenta de administración, esa). No toca noticias.
// Se puede repetir: no duplica nada. Uso: infra/deploy/firma-direccion.sh [--admin correo] (o npm run cms:firma-direccion).
import { getPayload } from 'payload';
import config from '../payload.config';

const REDACTOR = 'pvelasco@assa.as';
const payload = await getPayload({ config });
const found = await payload.find({ collection: 'authors', where: { slug: { equals: 'el-director' } }, depth: 0, limit: 1, overrideAccess: true });
const director = found.docs[0] ?? await payload.create({ collection: 'authors', overrideAccess: true, data: { name: 'El Director', slug: 'el-director', lote: 'definitivo' } });
console.log(`${found.docs[0] ? 'Ya existía' : 'Creado'} el autor «${director.name}» (id ${director.id}, slug ${director.slug}).`);

const admins = (await payload.find({ collection: 'users', where: { role: { equals: 'admin' } }, depth: 0, pagination: false, overrideAccess: true })).docs;
const adminEmail = (process.env.FIRMA_ADMIN || '').trim().toLowerCase();
const admin = adminEmail ? admins.find(u => u.email.toLowerCase() === adminEmail) : admins.length === 1 ? admins[0] : undefined;
if (!admin) {
  console.error(adminEmail ? `No hay ninguna cuenta de administración con el correo ${adminEmail}.` : `Hay ${admins.length} cuentas de administración (${admins.map(u => u.email).join(', ')}): indica la de Pablo con --admin correo.`);
  process.exit(2);
}
const redactor = (await payload.find({ collection: 'users', where: { email: { equals: REDACTOR } }, depth: 0, limit: 1, overrideAccess: true })).docs[0];
if (!redactor) console.warn(`Aviso: no existe la cuenta ${REDACTOR}; solo se prepara la de administración.`);
for (const user of [admin, redactor].filter(Boolean)) {
  await payload.update({ collection: 'users', id: user!.id, overrideAccess: true, data: { author: director.id, authorLocked: true } });
  console.log(`Firma fija «El Director» en ${user!.email}.`);
}
process.exit(0);
