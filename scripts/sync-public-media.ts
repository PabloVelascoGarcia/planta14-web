import { getPayload } from 'payload';
import config from '../payload.config';
import { cmsEnvironment } from '../cms/environment';
import { cleanupPublicBucket, publicMediaSettings, syncAllPublicMedia } from '../cms/public-media';

// Uso:
//   npm run cms:media:sync-public
//       Recalcula publishedUses, crea/borra/repara copias públicas (también al cambiar de bucket)
//       y limpia los huérfanos anotados en public-media-ops (p. ej. tras revertirse una transacción SQL).
//   npm run cms:media:sync-public -- --inventory [--apply]
//       Además, inventario del bucket público ACTUAL: objetos bajo el prefijo sin imagen que los use.
//   npm run cms:media:sync-public -- --cleanup-bucket=<bucket anterior> [--prefix=public] [--apply]
//       Limpieza de un bucket público ANTERIOR tras cambiar PUBLIC_MEDIA_BUCKET/PREFIX.
// Sin --apply, el inventario y la limpieza solo informan (modo de prueba).
if (!cmsEnvironment().enabled) throw new Error('Activa CMS_ENABLED antes de sincronizar imágenes públicas');
const settings = publicMediaSettings();
if (!settings.enabled) console.warn('PUBLIC_MEDIA_BASE_URL no está configurada: solo se recalcula publishedUses y se retiran copias públicas.');
const args = process.argv.slice(2);
const option = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const apply = args.includes('--apply');
const payload = await getPayload({ config });
try {
  const total = await syncAllPublicMedia(payload);
  payload.logger.info(`Imágenes revisadas: ${total}. Huérfanos del registro limpiados: ${(total as number & { orphans?: number }).orphans ?? 0}`);
  const targets: [string, string][] = [];
  if (args.includes('--inventory')) targets.push([settings.bucket, settings.prefix]);
  const old = option('cleanup-bucket');
  if (old) targets.push([old, option('prefix') ?? settings.prefix]);
  for (const [bucket, prefix] of targets) {
    const found = await cleanupPublicBucket(payload, bucket, prefix, apply);
    payload.logger.info(`${apply ? 'Borrados' : 'Sin referencia (prueba, usa --apply para borrar)'} en ${bucket}/${prefix}: ${found.length} objetos`);
    for (const key of found.slice(0, 50)) payload.logger.info(`  ${key}`);
  }
} finally {
  await payload.destroy();
}
