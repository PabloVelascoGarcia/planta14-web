import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { s3Storage } from '@payloadcms/storage-s3';
import sharp from 'sharp';
import { Users, Media } from './cms/collections';
import { cmsEnvironment } from './cms/environment';

const baseDir = path.dirname(fileURLToPath(import.meta.url));
const settings = cmsEnvironment();

export default buildConfig({
  secret: settings.secret,
  serverURL: process.env.CMS_SERVER_URL || 'http://localhost:3000',
  routes: { admin: '/cms', api: '/api/cms' },
  admin: { user: 'users', disable: !settings.enabled, importMap: { baseDir, importMapFile: path.resolve(baseDir, 'app/(payload)/cms/importMap.js') } },
  collections: [Users, Media],
  db: postgresAdapter({ pool: { connectionString: settings.databaseURL }, push: false, migrationDir: path.resolve(baseDir, 'cms/migrations') }),
  plugins: [s3Storage({
    enabled: settings.enabled,
    alwaysInsertFields: true,
    bucket: process.env.S3_BUCKET || 'disabled',
    collections: { media: true },
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
