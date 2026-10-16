// Reproducible WD1 look points. Generates PNGs for the user's visual review; does not judge them.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './landmark_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs/world/wd1/model-preview');
await fs.mkdir(dir, { recursive: true });
const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(INIT);
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__scene?.landmarks?.info?.LM09, null, { timeout: 90000 });
const views = [
  ['overview', 0, 0, 24, 2.6, 0.45, 1.8, 'Station and surrounding fields'],
  ['shed-front', -2.5, -3.7, 9, 0, 0.3, 2.5, 'Open timber frame, bench and timetable'],
  ['shed-rear', -2.5, -3.7, 9, Math.PI, 0.35, 2.5, 'Rear wall, gutter and complete roof'],
  ['car-platform', 1.8, -6.4, 9, 0, 0.3, 2.5, 'Car windows, interior layers and doors'],
  ['car-rear', 1.8, -6.4, 11, Math.PI, 0.35, 2.5, 'Rear car side, bogies and equipment'],
  ['services', 4.2, 0.5, 10, 0.85, 0.38, 2.0, 'Vending controls, phone booth, bus and bicycle bay'],
  ['site', 0, 0, 40, 1.1, 1.2, 1.8, 'Platform, path and road clearance'],
];
const report = [];
for (const [name, x, z, dist, yaw, pitch, height, look] of views) {
  const state = await page.evaluate(({ x, z, dist, yaw, pitch, height }) => {
    const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === 'LM09');
    const d = Math.hypot(x, z), p = d < 1e-9 ? lm : W.destination(lm, Math.atan2(-x, z) * 180 / Math.PI, d);
    const t = W.lonLatToTown(p.lon, p.lat);
    S.weather.lock('rain'); S.weather.setTime(600);
    S.view.set({ mapMode: 'flat', mode: 'free', target: [t.x, height, t.z], dist, yaw, pitch });
    window.__step(8);
    S.renderer.render(S.scene, S.camera);
    return { target: [t.x, height, t.z], dist, yaw, pitch, mapMode: 'flat', weather: 'rain', time: 600,
      calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles, textures: S.renderer.info.memory.textures };
  }, { x, z, dist, yaw, pitch, height });
  const file = path.join(dir, `${name}.png`);
  await page.screenshot({ path: file });
  report.push({ name, file: path.relative(root, file), look, ...state });
}
await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify({ views: report, pageErrors: errors }, null, 2) + '\n');
console.log(`WD1 look points: ${report.length} PNGs in ${path.relative(root, dir)}; page errors ${errors.length}`);
await browser.close();
if (errors.length) process.exitCode = 1;
