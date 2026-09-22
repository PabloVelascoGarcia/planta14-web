export const voiceDemoEnabled = process.env.DEMO_CONTENT !== "example";
export const siteUrl = process.env.SITE_URL || process.env.DEPLOY_PRIME_URL || process.env.URL || "http://localhost:3000";
export const indexable = process.env.SITE_INDEXABLE === "true" && !voiceDemoEnabled;
