import config from '@payload-config';
import { RootPage } from '@payloadcms/next/views';
import { notFound } from 'next/navigation';
import { cmsEnabled } from '@/cms/environment';
import { importMap } from '../importMap';

export const dynamic = 'force-dynamic';
export default function Page({ params, searchParams }: {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
}) {
  if (!cmsEnabled()) notFound();
  return RootPage({ config, params, searchParams, importMap });
}
