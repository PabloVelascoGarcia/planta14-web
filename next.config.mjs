// Netlify serves deploy previews under their own address. Fix the public URL at build time so that
// share images and canonical links of a preview point to the preview and not to the production site.
import { withPayload } from '@payloadcms/next/withPayload';

const context = process.env.CONTEXT;
const publicUrl = context && context !== "production"
  ? process.env.DEPLOY_PRIME_URL || process.env.SITE_URL || process.env.URL
  : process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL;

/** @type {import('next').NextConfig} */
// Metadata (title, Open Graph, robots) always goes in <head>, never streamed into <body>: every client,
// including social previews (WhatsApp, Facebook) and search crawlers, sees it in the first response.
const nextConfig = { htmlLimitedBots: /.*/,
  ...(process.env.LOW_MEMORY_BUILD === 'true' ? { experimental: { cpus: 1, webpackMemoryOptimizations: true } } : {}),
  ...(publicUrl ? { env: { SITE_URL: publicUrl } } : {}) };

export default withPayload(nextConfig);
