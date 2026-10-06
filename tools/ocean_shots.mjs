// Review shots of the ocean and coast (W6a). Run after `python3 build.py`:  node tools/ocean_shots.mjs [outDir] [--only=a,b]   (default docs/world/w6a)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { SHOTS, INIT, renderShot } from './ocean_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(root, 'docs', 'world', 'w6a'));
fs.mkdirSync(outDir, { recursive: true });
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await page.addInitScript(INIT);
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__scene && window.__scene.ocean, null, { timeout: 90000 });
for (const [name, v] of SHOTS) {
  if (only.length && !only.includes(name)) continue;
  const r = await renderShot(page, v);
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
  console.log(`${name}.png  draw calls ${r.info.calls}  triangles ${r.info.triangles}  ink g/a/p ${r.ink.ground.toFixed(2)}/${r.ink.aerial.toFixed(2)}/${r.ink.panorama.toFixed(2)}`);
}
if (errors.length) { console.log('page errors:', errors.join(' | ')); process.exitCode = 1; }
await browser.close();
