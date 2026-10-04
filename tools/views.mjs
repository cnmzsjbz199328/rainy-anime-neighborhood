// Real-browser check of the built scene: first frame, console errors, input handling and review shots.
//
//   node tools/views.mjs [outDir]        (default docs/layout/views)
//
// Shots: far view of the whole plinth, default view, store corner close-up, low intersection
// close-up (seams / z-fighting), and straight top-down. Look at every image; the exit code only
// covers errors and input checks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'docs', 'layout', 'views'));
fs.mkdirSync(outDir, { recursive: true });

export const VIEWS = {
  far:          { yaw: 2.5,  pitch: 0.82, dist: 140, target: [0, 0, 0] },
  storeCorner:  { yaw: 2.75, pitch: 0.32, dist: 14,  target: [-9, 1.4, 22] },
  intersection: { yaw: 0.9,  pitch: 0.2,  dist: 16,  target: [0, 0.3, 15] },
  top:          { yaw: 0,    pitch: 1.45, dist: 150, target: [0, 0, 0] },
};

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.waitForFunction(() => window.__scene && window.__scene.view);
await page.waitForTimeout(1500);

const results = [];
await page.screenshot({ path: path.join(outDir, 'default.png') });   // the scene's own start view
const view = () => page.evaluate(() => window.__scene.view.get());
const near = (a, b) => Math.abs(a - b) < 1e-6;

// Input: orbit (left drag), zoom (wheel), pan (right drag), and the pan limit.
const v0 = await view();
await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(700, 430, { steps: 4 }); await page.mouse.up();
const v1 = await view();
results.push(['左键拖动旋转', !near(v0.yaw, v1.yaw) && !near(v0.pitch, v1.pitch)]);
await page.mouse.wheel(0, 600); await page.waitForTimeout(100);
const v2 = await view();
results.push(['滚轮缩放', v2.dist > v1.dist]);
await page.mouse.move(640, 400); await page.mouse.down({ button: 'right' }); await page.mouse.move(560, 360, { steps: 4 }); await page.mouse.up({ button: 'right' });
const v3 = await view();
results.push(['右键平移（目标点在地面上移动，高度不变）', (!near(v2.target[0], v3.target[0]) || !near(v2.target[2], v3.target[2])) && near(v2.target[1], v3.target[1])]);
await page.evaluate(() => { for (let i = 0; i < 400; i++) window.__scene.view.pan(-200, -200); });
const v4 = await view();
const lim = 46;
results.push([`平移边界（目标点限制在 ±${lim}）：(${v4.target[0].toFixed(1)}, ${v4.target[2].toFixed(1)})`, Math.abs(v4.target[0]) <= lim + 1e-6 && Math.abs(v4.target[2]) <= lim + 1e-6 && (Math.abs(v4.target[0]) > lim - 1e-3 || Math.abs(v4.target[2]) > lim - 1e-3)]);
await page.evaluate(() => window.__scene.view.set({ dist: 1e4 }));
results.push(['缩放上限 150', (await view()).dist === 150]);
await page.evaluate(() => window.__scene.view.set({ dist: 0 }));
results.push(['缩放下限 9', (await view()).dist === 9]);

for (const [name, v] of Object.entries(VIEWS)) {
  await page.evaluate(v => window.__scene.view.set(v), v);
  await page.waitForTimeout(1200);   // SwiftShader: let a few frames render
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}
await browser.close();

for (const [t, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${t}`);
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'page errors: none');
console.log(`screenshots in ${path.relative(root, outDir)}`);
process.exit(errors.length || results.some(r => !r[1]) ? 1 : 0);
