// Netlify serves deploy previews under their own address. Fix the public URL at build time so that
// share images and canonical links of a preview point to the preview and not to the production site.
const context = process.env.CONTEXT;
const publicUrl = context && context !== "production"
  ? process.env.DEPLOY_PRIME_URL || process.env.SITE_URL || process.env.URL
  : process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL;

/** @type {import('next').NextConfig} */
const nextConfig = publicUrl ? { env: { SITE_URL: publicUrl } } : {};

export default nextConfig;
