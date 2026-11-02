import config from '@payload-config';
import { RootPage } from '@payloadcms/next/views';
import { notFound } from 'next/navigation';
import { cmsEnabled } from '@/cms/environment';
import { importMap } from '../importMap';

export const dynamic = 'force-dynamic';
export default async function Page({ params, searchParams }: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
}) {
  if (!cmsEnabled()) notFound();
  if ((await params).segments?.[0] === 'create-first-user') {
    return <section style={{ maxWidth: 600, margin: '6rem auto', padding: '2rem' }}><h1>Acceso pendiente de preparación</h1><p>El administrador debe preparar las cuentas antes de utilizar el panel de Planta 14.</p></section>;
  }
  return RootPage({ config, params, searchParams, importMap });
}
