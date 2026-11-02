import config from '@payload-config';
import { REST_GET, REST_POST, REST_DELETE, REST_PATCH, REST_PUT, REST_OPTIONS } from '@payloadcms/next/routes';
import { cmsEnabled } from '@/cms/environment';

const guarded = (handler: ReturnType<typeof REST_GET>) => async (...args: Parameters<typeof handler>) => {
  if (!cmsEnabled()) return new Response(null, { status: 404 });
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
