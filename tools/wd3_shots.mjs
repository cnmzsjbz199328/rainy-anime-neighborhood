// WD3 fixed views for the user's later visual review. No image judgement here.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './landmark_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs/world/wd3/model-preview');
await fs.mkdir(dir, { recursive: true });
const views = [];
const add = (lm, name, x, z, dist, yaw, pitch, height, look) => views.push({ lm, name: `${lm.toLowerCase()}-${name}`, x, z, dist, yaw, pitch, height, look });
add('LM10', 'overview', 0, 0, 40, 0.8, 0.8, 1.8, 'Harbour density, land and water relationship');
for (const [name, x, z, ry, size, look] of [
  ['warehouse', 3.5, -3.5, Math.PI / 2, 9, 'Roller shutter, racks and loading path'],
  ['ice-hut', 5.2, 7.8, Math.PI / 2, 3.2, 'Ice machine, chute and rear ventilation'],
  ['home-a', -6.5, -7, Math.PI / 2 - 0.1, 6.5, 'Two-floor fishing home'],
  ['home-b', -6.8, 7, Math.PI / 2 + 0.12, 6, 'Single-floor fishing home'],
]) {
  for (const [face, turn] of [['front', 0], ['rear', Math.PI], ['left', Math.PI / 2], ['right', -Math.PI / 2]])
    add('LM10', `${name}-${face}`, x, z, Math.max(6, size), ry + turn, 0.27, 1.7, `${look}; ${face} facade`);
  add('LM10', `${name}-roof`, x, z, size * 1.3, ry + 0.5, 1.12, 2.5, `${look}; roof and footprint`);
}
add('LM10', 'boats', 23, -5, 12, 0.7, 0.55, 0.5, 'Five hulls, cabins, deck hatches, winches and fenders');
add('LM10', 'breakwater', 20, 3.2, 15, 0.4, 0.65, 0.2, 'Mooring bollards, ladders, tide line and lamp tip');
add('LM10', 'fishery', 7, -2, 9, 0.7, 0.4, 1.2, 'Net mesh, weights, crates and yard work');
add('LM10', 'vending', 7, 10.5, 5, Math.PI / 2, 0.23, 1.3, 'Product bays, payment, pickup and service side');
add('LM08', 'overview', 0, 0, 26, 0.8, 0.85, 2, 'Island, tower, cottage, jetty and bridge relation');
for (const [face, yaw] of [['entrance', Math.PI / 2], ['rear', -Math.PI / 2], ['north', Math.PI], ['south', 0]])
  add('LM08', `tower-${face}`, 0, -1, 13, yaw, 0.52, 5, `Tower ${face}; shell, stair, gallery and lens`);
add('LM08', 'tower-door', 0, -1, 5, Math.PI / 2, 0.2, 1.4, 'Door opening, interior stair and threshold');
add('LM08', 'tower-window', 0, -1, 8, Math.PI / 2, 0.34, 5.5, 'Window opening and stair depth');
add('LM08', 'tower-roof', 0, -1, 18, 0.6, 1.15, 6, 'Gallery connection, optical room and roof');
for (const [face, yaw] of [['front', 0], ['rear', Math.PI], ['left', Math.PI / 2], ['right', -Math.PI / 2]])
  add('LM08', `cottage-${face}`, -3.7, 2.6, 7, yaw, 0.3, 1.6, `Keeper cottage ${face}; living and repair depth`);
add('LM08', 'cottage-roof', -3.7, 2.6, 9, 0.5, 1.12, 2.3, 'Cottage roof, servicing and site path');
add('LM08', 'jetty-boat', 0, -12, 8, 0.6, 0.5, 0.4, 'Jetty beams, braces, boat interior and mooring line');

const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene?.landmarks?.info?.LM10 && window.__scene?.landmarks?.info?.LM08, null, { timeout: 90000 });
  const report = [];
  for (const v of views) {
    const state = await page.evaluate(({ lm: id, x, z, dist, yaw, pitch, height }) => {
      const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === id);
      const d = Math.hypot(x, z), p = d < 1e-9 ? lm : W.destination(lm, Math.atan2(-x, z) * 180 / Math.PI, d);
      const t = W.lonLatToTown(p.lon, p.lat);
      S.weather.lock('rain'); S.weather.setTime(600); S.transition.setMode('flat'); S.transition.step(3);
      S.view.set({ mapMode: 'flat', mode: 'free', target: [t.x, height, t.z], dist, yaw, pitch });
      window.__step(2); S.renderer.render(S.scene, S.camera);
      return { target: [t.x, height, t.z], dist, yaw, pitch, mapMode: S.view.get().mapMode, weather: 'rain', time: 600,
        calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles, textures: S.renderer.info.memory.textures };
    }, v);
    const file = path.join(dir, `${v.name}.png`); await page.screenshot({ path: file });
    report.push({ name: v.name, file: path.relative(root, file), look: v.look, ...state });
  }
  for (const id of ['LM10', 'LM08']) for (const [kind, dist] of [['region', 60], ['globe', 220]]) {
    const state = await page.evaluate(({ id, dist }) => {
      const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === id), t = W.lonLatToTown(lm.lon, lm.lat);
      S.weather.lock('clear'); S.weather.setTime(600); S.transition.setMode('sphere'); S.transition.step(3);
      S.view.set({ mapMode: 'sphere', mode: 'free', target: [t.x, 1.8, t.z], dist, yaw: 0.7, pitch: 0.75 });
      window.__step(2); S.renderer.render(S.scene, S.camera);
      return { target: [t.x, 1.8, t.z], dist, yaw: 0.7, pitch: 0.75, mapMode: S.view.get().mapMode, weather: 'clear', time: 600,
        calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles, textures: S.renderer.info.memory.textures };
    }, { id, dist });
    if (state.mapMode !== 'sphere') throw new Error(`${id} ${kind}: sphere transition failed`);
    const name = `${id.toLowerCase()}-sphere-${kind}`, file = path.join(dir, `${name}.png`);
    await page.screenshot({ path: file }); report.push({ name, file: path.relative(root, file), look: 'Clear daytime regional identity and density', ...state });
  }
  await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify({ views: report, pageErrors: errors }, null, 2) + '\n');
  await fs.writeFile(path.join(dir, 'README.md'), `# WD3 海岸固定机位\n\n${report.length} 张 1280×800 PNG。LM10 四栋及 LM08 小屋各有正背左右和屋顶；灯塔有四面、入口、窗口、顶部；另有船、码头、设备及两地球形机位。准确 target/dist/yaw/pitch、天气和绘制统计见 report.json，逐张看点见 look。Agent 未打开或判断图像；用户稍后统一验收。\n`);
  console.log(`WD3 look points: ${report.length} PNGs in ${path.relative(root, dir)}; page errors ${errors.length}`);
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
