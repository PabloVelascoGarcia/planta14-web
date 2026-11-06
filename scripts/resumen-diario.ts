import type { Payload } from 'payload';
import { getPayload } from 'payload';
import config from '../payload.config';
import { sendDailyDigests } from '../cms/newsroom';
import { cmsEnvironment } from '../cms/environment';

// npm run cms:resumen — envía ahora el resumen diario de la redacción (además del automático de las 8:00). Para
// comprobarlo o repetirlo a mano; no cambia el registro del envío automático.
if (!cmsEnvironment().enabled) throw new Error('Requiere CMS_ENABLED=true');
const payload: Payload = await getPayload({ config });
try {
  const sent = await sendDailyDigests(payload);
  for (const s of sent) console.log(`${s.email}: ${s.publications} publicaciones municipales, ${s.pending} pendientes`);
  console.log(sent.length ? `RESUMEN ENVIADO A ${sent.length}` : 'NADA QUE ENVIAR (o el correo no está activado)');
} finally {
  await payload.destroy();
}
