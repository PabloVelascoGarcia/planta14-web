export const voiceDemoEnabled = process.env.DEMO_CONTENT !== "example";
export function configuredSiteUrl(env: Record<string, string | undefined> = process.env) {
  const value = env.SITE_URL || env.DEPLOY_PRIME_URL || env.URL || "http://localhost:3000";
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SITE_URL debe ser un origen http(s), sin credenciales, ruta ni parámetros');
  }
  return url.origin;
}
export const siteUrl = configuredSiteUrl();
export const siteName = "Planta 14";
export const publisherName = "Agencia Social de Servicios Asturiana S.L. (ASSA)";

/**
 * Indexing is opt-in: only SITE_INDEXABLE=true lets search engines index the site, and only with real
 * content (CONTENT_SOURCE=payload): demo content is never indexed. Read at request time (not inlined at
 * build), so the demo, staging and any copy without the variable stay noindex.
 */
export function isIndexable(env: Record<string, string | undefined> = process.env) {
  return env.SITE_INDEXABLE === "true" && env.CONTENT_SOURCE === "payload";
}

/** Areas that are never indexed, even with SITE_INDEXABLE=true. */
export function isPrivatePath(pathname: string) {
  return /^\/(admin|cms|api|buscar|niebla|vista-previa)(\/|$)/.test(pathname) || /^\/[^/]+\/panel(\/|$)/.test(pathname);
}

/** Value for X-Robots-Tag, or null when the response may be indexed. */
export function robotsHeader(pathname: string, env: Record<string, string | undefined> = process.env) {
  return !isIndexable(env) || isPrivatePath(pathname) ? "noindex, nofollow" : null;
}

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${siteUrl}${path.startsWith("/") ? "" : "/"}${path}`);
