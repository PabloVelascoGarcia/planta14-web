// Se ejecuta una vez al arrancar el servidor de Next. Arranca el refresco en segundo plano de las fuentes de «Útil»
// (DGT, AEMET, BDNS y BOE): las visitas solo leen la caché y nunca consultan las fuentes (lib/util-sources.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.CONTENT_SOURCE !== 'payload' || process.env.CMS_ENABLED !== 'true' || process.env.UTIL_REFRESH_DISABLED === 'true') return;
  const { startUtilRefresher } = await import('./lib/util-sources');
  startUtilRefresher();
}
