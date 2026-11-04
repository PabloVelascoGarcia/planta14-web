/** One IONOS mailbox for auth recovery and municipal notices. No network during config/build. */
export function smtpOptions(env: NodeJS.ProcessEnv = process.env) {
  if (env.SMTP_ENABLED !== 'true' || env.CMS_ENABLED !== 'true') return undefined;
  if (!env.SMTP_PASSWORD) throw new Error('SMTP_ENABLED requiere SMTP_PASSWORD del buzón avisos@planta14.com');
  return {
    defaultFromAddress: 'avisos@planta14.com', defaultFromName: 'Planta 14', skipVerify: true,
    transportOptions: {
      host: 'smtp.ionos.es', port: 465, secure: true,
      auth: { user: 'avisos@planta14.com', pass: env.SMTP_PASSWORD },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
      tls: { minVersion: 'TLSv1.2' as const },
    },
  };
}

import { appendFileSync } from 'node:fs';
import type { EmailAdapter } from 'payload';

/**
 * Solo pruebas automáticas: con PLANTA14_TEST_EMAIL_OUTBOX, los correos se escriben (JSON por línea) en ese archivo
 * en vez de enviarse. Nunca se configura en producción (no está en infra/.env.production.example).
 */
export function testOutboxAdapter(file: string): EmailAdapter {
  return () => ({ name: 'planta14-test-outbox', defaultFromAddress: 'avisos@planta14.com', defaultFromName: 'Planta 14',
    sendEmail: async (message) => { appendFileSync(file, `${JSON.stringify(message)}\n`); return {}; } });
}

/** ¿Hay correo de verdad (SMTP de avisos@planta14.com) o el buzón de pruebas? Sin él, nada se envía. */
export function emailAvailable(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.PLANTA14_TEST_EMAIL_OUTBOX) || (env.SMTP_ENABLED === 'true' && env.CMS_ENABLED === 'true');
}
