import config from '@payload-config';
import '@payloadcms/next/css';
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts';
import type { ServerFunctionClient } from 'payload';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { cmsEnabled } from '@/cms/environment';
import { importMap } from './cms/importMap';

const serverFunction: ServerFunctionClient = async (args) => {
  'use server';
  if (!cmsEnabled()) throw new Error('CMS desactivado');
  return handleServerFunctions({ ...args, config, importMap });
};

export default function CMSLayout({ children }: { children: ReactNode }) {
  if (!cmsEnabled()) notFound();
  return <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>{children}</RootLayout>;
}
