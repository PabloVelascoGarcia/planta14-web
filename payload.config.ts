import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { s3Storage } from '@payloadcms/storage-s3';
import sharp from 'sharp';
import { Users, Media, PublicMediaOps } from './cms/collections';
import { cmsEnvironment } from './cms/environment';
import { Articles, Authors, Sections, Towns, MunicipalSpaces, MunicipalContent } from './cms/content-collections';
import { AuditLog, Notifications } from './cms/activity';
import { Festivals } from './cms/festivals';
import { nodemailerAdapter } from '@payloadcms/email-nodemailer';
import { smtpOptions, testOutboxAdapter } from './cms/email';
import { withMaintenanceGuard } from './cms/maintenance';
import { withSpanishLabels } from './cms/labels';
import { es } from '@payloadcms/translations/languages/es';

const baseDir = path.dirname(fileURLToPath(import.meta.url));
const settings = cmsEnvironment();
const smtp = smtpOptions();

export default buildConfig({
  secret: settings.secret,
  email: process.env.PLANTA14_TEST_EMAIL_OUTBOX ? testOutboxAdapter(process.env.PLANTA14_TEST_EMAIL_OUTBOX) : smtp ? nodemailerAdapter(smtp) : undefined,
  serverURL: process.env.CMS_SERVER_URL || 'http://localhost:3000',
  // CMS solo en español.
  i18n: { supportedLanguages: { es }, fallbackLanguage: 'es' },
  routes: { admin: '/cms', api: '/api/cms' },
  admin: { user: 'users', disable: !settings.enabled, components: { header: ['/components/cms-maintenance-banner#CmsMaintenanceBanner'], beforeDashboard: ['/components/cms-dashboard#CmsDashboard'] }, importMap: { baseDir, importMapFile: path.resolve(baseDir, 'app/(payload)/cms/importMap.js') } },
  // Solo lectura durante el modo mantenimiento (cms/maintenance.ts).
  collections: [Users, Media, Articles, Festivals, Authors, Sections, Towns, MunicipalSpaces, MunicipalContent, Notifications, AuditLog, PublicMediaOps].map(withMaintenanceGuard).map(withSpanishLabels),
  db: postgresAdapter({ pool: { connectionString: settings.databaseURL }, push: false, migrationDir: path.resolve(baseDir, 'cms/migrations') }),
  plugins: [s3Storage({
    enabled: settings.enabled,
    alwaysInsertFields: true,
    bucket: process.env.S3_BUCKET || 'disabled',
    collections: { media: true },
    signedDownloads: { expiresIn: 60 },
    config: {
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || 'disabled', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'disabled' },
    },
  })],
  sharp,
  upload: { limits: { fileSize: 10 * 1024 * 1024 }, abortOnLimit: true },
  typescript: { outputFile: path.resolve(baseDir, 'cms/payload-types.ts') },
  cors: process.env.CMS_SERVER_URL ? [process.env.CMS_SERVER_URL] : [],
  csrf: process.env.CMS_SERVER_URL ? [process.env.CMS_SERVER_URL] : [],
});
