// Eight-view review shots of one landmark (W7). Run after `python3 build.py`:  node tools/landmark_shots.mjs LM01 [outDir]   (default docs/world/landmarks/LM01)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT, renderShot, shots } from './landmark_views.mjs';

const id = process.argv[2]; if (!/^LM\d\d$/.test(id || '')) { console.error('usage: node tools/landmark_shots.mjs LMxx [outDir]'); process.exit(2); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : path.join(root, 'docs', 'world', 'landmarks', id));
fs.mkdirSync(outDir, { recursive: true });
const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await page.addInitScript(INIT);
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__scene && window.__scene.landmarks, null, { timeout: 90000 });
for (const [name, v] of shots(id)) {
  const r = await renderShot(page, v);
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
  console.log(`${id}/${name}.png  draw calls ${r.info.calls}  triangles ${r.info.triangles}`);
}
if (errors.length) { console.log('page errors:', errors.join(' | ')); process.exitCode = 1; }
await browser.close();
