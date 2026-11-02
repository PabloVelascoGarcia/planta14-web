import fs from 'node:fs';
import path from 'node:path';
const files = ['lib/voice-demo.ts', 'lib/mock-data.ts', ...fs.readdirSync('lib/demo/data').filter(f => f.endsWith('.json')).map(f => path.join('lib/demo/data', f))];
const hosts = new Map();
for (const file of files) {
  const urls = fs.readFileSync(file, 'utf8').match(/https?:\/\/[^\s"'<>`\\]+/g) || [];
  for (const raw of urls) {
    const url = new URL(raw);
    hosts.set(url.hostname, (hosts.get(url.hostname) || 0) + 1);
  }
}
console.log(JSON.stringify({ scannedFiles: files.length, externalReferencesByHost: Object.fromEntries([...hosts].sort()), note: 'References are not backups. No remote files fetched.' }, null, 2));
