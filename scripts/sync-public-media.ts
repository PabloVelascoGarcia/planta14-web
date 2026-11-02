import { getPayload } from 'payload';
import config from '../payload.config';
import { cmsEnvironment } from '../cms/environment';
import { publicMediaSettings, syncAllPublicMedia } from '../cms/public-media';

// Recalcula publishedUses y crea/borra las copias públicas de todas las imágenes.
// Usar tras aplicar la migración del bloque 3, restaurar una copia o cambiar PUBLIC_MEDIA_*.
if (!cmsEnvironment().enabled) throw new Error('Activa CMS_ENABLED antes de sincronizar imágenes públicas');
if (!publicMediaSettings().enabled) console.warn('PUBLIC_MEDIA_BASE_URL no está configurada: solo se recalcula publishedUses y se retiran copias públicas.');
const payload = await getPayload({ config });
try {
  const total = await syncAllPublicMedia(payload);
  payload.logger.info(`Imágenes revisadas: ${total}`);
} finally {
  await payload.destroy();
}
