import config from '@payload-config';
import { REST_GET, REST_POST, REST_DELETE, REST_PATCH, REST_PUT, REST_OPTIONS } from '@payloadcms/next/routes';
import { cmsEnabled } from '@/cms/environment';
import { fromBridge } from '@/lib/panel-bridge';

const forbidden = () => new Response(JSON.stringify({ errors: [{ message: 'Las cuentas municipales solo pueden usar el panel de su concejo.' }] }),
  { status: 403, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });

/**
 * Las cuentas municipales no usan la API de Payload directamente: solo por el puente del panel (/api/panel/api, lista
 * cerrada de llamadas). Cualquier otra petición con credenciales de una cuenta municipal (cookie de Payload, cabecera
 * Authorization o token del panel) recibe 403 antes de llegar a Payload.
 */
async function municipalOutsideBridge(request: Request) {
  if (fromBridge(request.headers)) return false;
  const auth = request.headers.get('authorization') || '';
  const cookie = request.headers.get('cookie') || '';
  if (!auth && !/(^|;\s*)(payload-token|__Host-planta14_panel|planta14_panel)=/.test(cookie)) return false;
  const { getPayload } = await import('payload');
  const payload = await getPayload({ config });
  const headers = new Headers(request.headers);
  // El token del panel en la cookie también cuenta: se comprueba como cabecera, igual que el resto.
  const panelToken = /(?:^|;\s*)(?:__Host-planta14_panel|planta14_panel)=([^;]+)/.exec(cookie)?.[1];
  const users = [await payload.auth({ headers }).then(r => r.user).catch(() => null)];
  if (panelToken) users.push(await payload.auth({ headers: new Headers({ Authorization: `JWT ${decodeURIComponent(panelToken)}` }) }).then(r => r.user).catch(() => null));
  return users.some(user => user?.collection === 'users' && (user as { role?: string }).role === 'municipal');
}

const guarded = (handler: ReturnType<typeof REST_GET>) => async (...args: Parameters<typeof handler>) => {
  if (!cmsEnabled()) return new Response(null, { status: 404 });
  if (await municipalOutsideBridge(args[0])) return forbidden();
  const response = await handler(...args);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
};
export const GET = guarded(REST_GET(config));
export const POST = guarded(REST_POST(config));
export const DELETE = guarded(REST_DELETE(config));
export const PATCH = guarded(REST_PATCH(config));
export const PUT = guarded(REST_PUT(config));
export const OPTIONS = guarded(REST_OPTIONS(config));
