// Development emulator only. It is never used by the application or bound to the network.
import S3rver from 's3rver';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const directory = path.resolve('.local/s3');
await mkdir(directory, { recursive: true });
const server = new S3rver({ address: '127.0.0.1', port: 59000, directory, silent: true, configureBuckets: [{ name: 'planta14-development' }, { name: 'planta14-development-public' }] });
await server.run();
console.log('S3 de desarrollo: http://127.0.0.1:59000 (solo acceso local)');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
