// Review shots of the bend (W2). Run after `python3 build.py`:  node tools/bend_shots.mjs [outDir] [--only=name,name]   (default docs/world/w2)
// uBend = 1: the four plinth corners, the R01 intersection, a new building front, the utility wires, the street walk (rain);
// uBend = 0.25 / 0.5 / 0.75 from one oblique view. Deterministic (seeded Math.random, hand-driven frames); the canvas only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { launchChromium } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const L = require(path.join(root, 'layout.js'));
const outDir = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(root, 'docs', 'world', 'w2'));
fs.mkdirSync(outDir, { recursive: true });

const cafe = L.buildings.find(b => b.plot === 'B05-P03');
const main = cafe.parts.find(p => p.role === 'building').localBounds;
const [cx, cz] = L.toWorld(cafe, (main.min[0] + main.max[0]) / 2, (main.min[2] + main.max[2]) / 2);
const t = cafe.transform, fx = Math.sin(t.rotY) * cafe.frontDir[1] + Math.cos(t.rotY) * cafe.frontDir[0], fz = Math.cos(t.rotY) * cafe.frontDir[1] - Math.sin(t.rotY) * cafe.frontDir[0];
const front = Math.atan2(fx, fz), size = Math.max(main.max[0] - main.min[0], main.max[2] - main.min[2]), h = main.max[1], d = Math.max(9, size * 1.75);
const OBL = { yaw: 2.5, pitch: 0.5, dist: 120, target: [0, 0, 0] };
const SHOTS = [
  ['bend1-corner-nw', 1, { yaw: -2.36, pitch: 0.42, dist: 46, target: [-40, 1, -40] }],
  ['bend1-corner-ne', 1, { yaw: 2.36, pitch: 0.42, dist: 46, target: [40, 1, -40] }],
  ['bend1-corner-se', 1, { yaw: 0.785, pitch: 0.42, dist: 46, target: [40, 1, 40] }],
  ['bend1-corner-sw', 1, { yaw: -0.785, pitch: 0.42, dist: 46, target: [-40, 1, 40] }],
  ['bend1-intersection', 1, { yaw: 1.57, pitch: 0.2, dist: 16, target: [0, 0.3, 15] }],
  ['bend1-building-front', 1, { yaw: front + 0.12, pitch: 0.1, dist: d, target: [cx, h * 0.45, cz] }],
  ['bend1-wires', 1, { yaw: 0.9, pitch: 0.22, dist: 26, target: [-20, 5, 13] }],
  ['bend1-street-walk-rain', 1, { mode: 'roam', position: [-8, 15], heading: -Math.PI / 2 }],
  ['bend025-oblique', 0.25, OBL],
  ['bend050-oblique', 0.5, OBL],
  ['bend075-oblique', 0.75, OBL],
];

const INIT = `(() => {
  let s = 0x2f6e2b1;
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const queue = []; let frame = 0;
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.__step = n => { for (let i = 0; i < n; i++) { frame++; const ts = frame * 16.667, cbs = queue.splice(0); for (const cb of cbs) cb(ts); } return frame; };
  performance.now = () => frame * 16.667;
})();`;

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await page.addInitScript(INIT);
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__scene && window.__scene.bend);
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
for (const [name, u, v] of SHOTS) {
  if (only.length && !only.includes(name)) continue;
  const r = await page.evaluate(([u, v]) => {
    const S = window.__scene;
    S.bend.set(u);
    // the town is lowered by the roll (about 8 m at the cafe), so the camera aims at the bent position of the flat target
    S.view.set(v.mode === 'roam' ? v : { mode: 'free', ...v, target: S.bend.point(v.target[0], v.target[1], v.target[2], u) });
    window.__step(60);
    S.renderer.render(S.scene, S.camera);
    return { url: S.renderer.domElement.toDataURL('image/png'), calls: S.renderer.info.render.calls };
  }, [u, v]);
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
  console.log(`${name}.png  uBend ${u}  draw calls ${r.calls}`);
}
if (errors.length) { console.log('page errors:', errors.join(' | ')); process.exitCode = 1; }
await browser.close();
