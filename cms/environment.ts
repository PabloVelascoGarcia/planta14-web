export function cmsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.CMS_ENABLED === 'true';
}

export function cmsEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const enabled = cmsEnabled(env);
  const required = ['PAYLOAD_SECRET', 'DATABASE_URL', 'S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'CMS_SERVER_URL'] as const;
  if (enabled) {
    for (const key of required) if (!env[key]) throw new Error(`Falta configuración: ${key}`);
    if (env.PAYLOAD_SECRET!.length < 32) throw new Error('PAYLOAD_SECRET debe tener al menos 32 caracteres');
    if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL!)) throw new Error('DATABASE_URL debe ser PostgreSQL');
    const url = new URL(env.CMS_SERVER_URL!);
    if (env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error('CMS_SERVER_URL requiere HTTPS en producción');
  }
  return { enabled, secret: env.PAYLOAD_SECRET || 'disabled-cms-placeholder-never-use-for-auth', databaseURL: env.DATABASE_URL || 'postgres://disabled:disabled@127.0.0.1:5432/disabled' };
}
