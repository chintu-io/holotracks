import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'www');

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

for (const file of ['index.html', 'app.js', 'styles.css']) {
  await cp(path.join(root, file), path.join(webDir, file));
}
for (const directory of ['assets', 'data']) {
  await cp(path.join(root, directory), path.join(webDir, directory), { recursive: true });
}

await build({
  entryPoints: [path.join(root, 'mobile', 'mobile-entry.js')],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['es2020'],
  outfile: path.join(webDir, 'mobile-bridge.js'),
  minify: true,
});

const indexPath = path.join(webDir, 'index.html');
const html = await readFile(indexPath, 'utf8');
if (!html.toLowerCase().includes('</body>')) {
  throw new Error('index.html has no closing body tag; cannot inject the mobile bridge.');
}
const updated = html.replace(/<\/body>/i, '  <script src="./mobile-bridge.js"></script>\n</body>');
await writeFile(indexPath, updated, 'utf8');

console.log('Prepared the HoloTracks web assets and Android-only YouTube app handoff in ./www');
