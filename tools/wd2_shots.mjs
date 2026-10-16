// WD2 reproducible look points. The user judges the images; this script records machine state only.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './landmark_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs/world/wd2/model-preview');
await fs.mkdir(dir, { recursive: true });
const houses = [
  ['inn-a', -8.5, -4.5, Math.PI / 2 + 0.25, 9, 6, 'Genkan, shoe bays and reception'],
  ['inn-b', 1, -10.2, 0, 8, 5.5, 'Creek gallery and tea seating'],
  ['home-1', 9, -6, -Math.PI / 2 - 0.2, 6.5, 5, 'Family living room and kitchen'],
  ['home-2', -9.2, 6.5, Math.PI / 2 - 0.15, 5.5, 4.8, 'Tool-keeping home'],
  ['home-3', 8.6, 5.8, -Math.PI / 2 + 0.1, 5.2, 4.5, 'Quiet home and restrained light'],
  ['shop', -4.2, 11.2, Math.PI * 0.92, 5, 4.2, 'Village shop display and rear stock'],
];
const views = [{ name: 'overview', x: 0, z: 0, dist: 36, yaw: 0.75, pitch: 0.8, height: 2, look: 'Six-building village, brook and spring density' }];
for (const [id, x, z, ry, w, d, look] of houses) {
  const dist = Math.max(w, d) * 0.95;
  for (const [side, delta] of [['front', 0], ['rear', Math.PI], ['left', Math.PI / 2], ['right', -Math.PI / 2]])
    views.push({ name: `${id}-${side}`, x, z, dist, yaw: ry + delta, pitch: 0.25, height: 1.6, look: `${look}; ${side} facade and visible interior` });
  views.push({ name: `${id}-roof`, x, z, dist: Math.max(w, d) * 1.3, yaw: ry + 0.5, pitch: 1.15, height: 2.5, look: `${look}; roof and plot footprint` });
}
views.push(
  { name: 'spring', x: -1, z: -2, dist: 9, yaw: 0.6, pitch: 0.55, height: 0.4, look: 'Pool wall, entry steps, overflow and bamboo supports' },
  { name: 'source-hut', x: -7.2, z: -5.4, dist: 6, yaw: 0.4, pitch: 0.32, height: 1.2, look: 'Source pump, inspection bench and flume connections' },
  { name: 'bridge', x: 1.5, z: -5.2, dist: 6, yaw: 0.8, pitch: 0.45, height: 0.4, look: 'Bridge planks, beams, footings and brook' },
  { name: 'bus-vending', x: 0, z: 14.2, dist: 9, yaw: 0, pitch: 0.3, height: 1.4, look: 'Bus sheltering, vending controls and service side' },
);
const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene?.landmarks?.info?.LM02, null, { timeout: 90000 });
  const report = [];
  for (const v of views) {
    const state = await page.evaluate(({ x, z, dist, yaw, pitch, height }) => {
      const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === 'LM02');
      const d = Math.hypot(x, z), p = d < 1e-9 ? lm : W.destination(lm, Math.atan2(-x, z) * 180 / Math.PI, d);
      const t = W.lonLatToTown(p.lon, p.lat);
      S.weather.lock('rain'); S.weather.setTime(600);
      S.transition.setMode('flat'); S.transition.step(3);
      S.view.set({ mapMode: 'flat', mode: 'free', target: [t.x, height, t.z], dist, yaw, pitch });
      window.__step(2); S.renderer.render(S.scene, S.camera);
      return { target: [t.x, height, t.z], dist, yaw, pitch, mapMode: S.view.get().mapMode, weather: 'rain', time: 600,
        calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles, textures: S.renderer.info.memory.textures };
    }, v);
    const file = path.join(dir, `${v.name}.png`);
    await page.screenshot({ path: file });
    report.push({ name: v.name, file: path.relative(root, file), look: v.look, ...state });
  }
  for (const [name, dist] of [['sphere-region', 60], ['sphere-globe', 220]]) {
    const state = await page.evaluate(dist => {
      const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === 'LM02'), t = W.lonLatToTown(lm.lon, lm.lat);
      S.weather.lock('clear'); S.weather.setTime(600);
      S.transition.setMode('sphere'); S.transition.step(3);
      S.view.set({ mapMode: 'sphere', mode: 'free', target: [t.x, 1.8, t.z], dist, yaw: 0.7, pitch: 0.75 });
      window.__step(2); S.renderer.render(S.scene, S.camera);
      return { target: [t.x, 1.8, t.z], dist, yaw: 0.7, pitch: 0.75, mapMode: S.view.get().mapMode, weather: 'clear', time: 600,
        calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles, textures: S.renderer.info.memory.textures };
    }, dist);
    if (state.mapMode !== 'sphere') throw new Error(`${name}: sphere transition failed`);
    const file = path.join(dir, `${name}.png`);
    await page.screenshot({ path: file });
    report.push({ name, file: path.relative(root, file), look: 'Village density and warm-light hierarchy on clear daytime sphere', ...state });
  }
  await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify({ views: report, pageErrors: errors }, null, 2) + '\n');
  await fs.writeFile(path.join(dir, 'README.md'), `# WD2 温泉村固定机位\n\n共 ${report.length} 张 1280×800 PNG；准确位置、模式、天气和绘制量见 report.json。每栋建筑均有正、背、左右及屋顶视角；另有村庄、温泉、源泉小屋、溪桥、村口和球形两档。看点见 report.json 的 look。用户稍后统一判断构图、洞口后的空间层次、材质、场地与气氛；这些图片未由 Agent 审看。\n`);
  console.log(`WD2 look points: ${report.length} PNGs in ${path.relative(root, dir)}; page errors ${errors.length}`);
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
