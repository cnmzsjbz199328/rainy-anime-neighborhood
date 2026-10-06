// Review shots of the W5 road network. Run after `python3 build.py`:  node tools/road_shots.mjs [outDir] [--only=a,b]   (default docs/world/w5)
// Deterministic: seeded Math.random, hand-driven frames; the canvas only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { SHOTS, EXITS, INIT, renderShot } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(root, 'docs', 'world', 'w5'));
fs.mkdirSync(outDir, { recursive: true });
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await page.addInitScript(INIT);
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__scene && window.__scene.roads, null, { timeout: 90000 });
const urls = {};
for (const [name, v] of SHOTS) {
  if (only.length && !only.includes(name)) continue;
  const r = await renderShot(page, v); urls[name] = r.url;
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
  console.log(`${name}.png  draw calls ${r.info.calls}  triangles ${r.info.triangles}  ink g/a/p ${r.ink.ground.toFixed(2)}/${r.ink.aerial.toFixed(2)}/${r.ink.panorama.toFixed(2)}`);
}
// collage of the nine exits (W5-C9): 3 x 3, each shot at half size
if (EXITS.every(([n]) => urls['exit-' + n])) {
  const png = await page.evaluate(async list => {
    const c = document.createElement('canvas'); c.width = 1920; c.height = 1200; const q = c.getContext('2d'); q.fillStyle = '#111'; q.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < list.length; i++) { const img = new Image(); img.src = list[i][1]; await img.decode(); q.drawImage(img, (i % 3) * 640, Math.floor(i / 3) * 400, 640, 400); q.fillStyle = '#e8e5d9'; q.font = '20px sans-serif'; q.fillText(list[i][0], (i % 3) * 640 + 10, Math.floor(i / 3) * 400 + 26); }
    return c.toDataURL('image/png');
  }, EXITS.map(([n]) => [n, urls['exit-' + n]]));
  fs.writeFileSync(path.join(outDir, 'exits-mosaic.png'), Buffer.from(png.split(',')[1], 'base64')); console.log('exits-mosaic.png');
}
if (errors.length) { console.log('page errors:', errors.join(' | ')); process.exitCode = 1; }
await browser.close();
