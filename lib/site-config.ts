export const voiceDemoEnabled = process.env.DEMO_CONTENT !== "example";
export const siteUrl = (process.env.SITE_URL || process.env.DEPLOY_PRIME_URL || process.env.URL || "http://localhost:3000").replace(/\/+$/, "");
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
  return /^\/(admin|cms|api|buscar|niebla)(\/|$)/.test(pathname) || /^\/[^/]+\/panel(\/|$)/.test(pathname);
}

/** Value for X-Robots-Tag, or null when the response may be indexed. */
export function robotsHeader(pathname: string, env: Record<string, string | undefined> = process.env) {
  return !isIndexable(env) || isPrivatePath(pathname) ? "noindex, nofollow" : null;
}

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${siteUrl}${path.startsWith("/") ? "" : "/"}${path}`);
