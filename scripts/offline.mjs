import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const base = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}
const files = (await walk('out')).filter(p => !p.endsWith('sw.js')).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(file));
const urls = files.map(p => base + '/' + path.relative('out', p).replaceAll('\\', '/'));
const template = await readFile('public/sw.js', 'utf8');
await writeFile('out/sw.js', template.replace('/* BUILD_CONFIG */', 'const VERSION = "' + hash.digest('hex').slice(0,16) + '"; const ASSETS = ' + JSON.stringify(urls) + ';'));
console.log('Offline package: ' + urls.length + ' files');
