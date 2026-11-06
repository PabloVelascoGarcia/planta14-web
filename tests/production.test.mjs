import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
const code = ts.transpileModule(fs.readFileSync('cms/email.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { smtpOptions } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
assert.equal(smtpOptions({}), undefined);
assert.equal(smtpOptions({ SMTP_ENABLED: 'true', CMS_ENABLED: 'false' }), undefined);
assert.throws(() => smtpOptions({ SMTP_ENABLED: 'true', CMS_ENABLED: 'true' }), /SMTP_PASSWORD/);
const options = smtpOptions({ SMTP_ENABLED: 'true', CMS_ENABLED: 'true', SMTP_PASSWORD: 'synthetic-only' });
assert.equal(options.transportOptions.host, 'smtp.ionos.es');
assert.equal(options.transportOptions.port, 465); assert.equal(options.transportOptions.secure, true);
assert.equal(options.transportOptions.auth.user, 'avisos@planta14.com');
let message;
const factory = await nodemailerAdapter({ ...options, transport: { sendMail: async value => { message = value; return {}; } } });
const adapter = factory();
await adapter.sendEmail({ to: 'synthetic@example.test', subject: 'Recovery/notice', text: 'Synthetic message' });
assert.match(message.from, /avisos@planta14.com/);
assert.equal(message.subject, 'Recovery/notice');
await assert.rejects((await nodemailerAdapter({ ...options, transport: { sendMail: async () => { throw new Error('synthetic SMTP failure'); } } }))().sendEmail({ to: 'synthetic@example.test' }), /synthetic SMTP failure/);
console.log('PASS: IONOS TLS SMTP, explicit enable/credentials, no config-time network, adapter delivery and error propagation');

// Sin instrumentation.ts: Next lo compila como entrada aparte con todo Payload y la imagen se queda sin memoria al
// compilar (CI del 5/11 y del 6/11, exit 134). Las tareas del servidor arrancan desde /api/health (ensureUtilRefresher,
// ensureDigestTicker).
for (const file of ['instrumentation.ts', 'instrumentation.js', 'instrumentation.mjs', 'src/instrumentation.ts', 'instrumentation-client.ts']) {
  assert.equal(fs.existsSync(file), false, `${file} no debe existir: la compilación de la imagen se queda sin memoria`);
}
console.log('PASS: no instrumentation.ts (it pulls Payload into a separate build entry and the image build runs out of memory)');
