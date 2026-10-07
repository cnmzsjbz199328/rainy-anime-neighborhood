// Performance table of the planet work (W8d, W8_SPEC section 6): draw calls, triangles and the render time of one frame (SwiftShader: only for comparing views with each other, not a real GPU
// figure) in the views that matter. Run after `python3 build.py`:  node tools/w8_perf.mjs [--md]   (--md prints the table as Markdown for PROGRESS)
//   rows: the default view (rain locked), far, top, storeCorner; the transition (d = 160 ... 300, uBend rising); the four panorama directions; each landmark's close-up; the six weather states
//   at the default view; and the default view of the older builds (S0 baseline, before W2, before W8a) to check ROADMAP section 4 rule 6 (default view draw calls up by no more than 10 %)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), md = args.includes('--md');
const browser = await launchChromium();
async function open(html) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.addInitScript(INIT); await page.goto(pathToFileURL(html).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__scene && window.__scene.view, null, { timeout: 120000 }); await page.evaluate(() => window.__step(2)); return page;
}
// set the view the way the app does (zoom drives uBend), run n frames, render once and read the counters
// section = the planet's ground view (uBend locked at 1, the far world built, landmarks loaded) as the W5-W7 tools use it; the render time is the second of two renders (the first builds what is missing)
const measure = (page, v, n = 40, weather = 'rain', section = false) => page.evaluate(([v, n, weather, section]) => { const S = window.__scene; if (S.weather) S.weather.lock(weather); if (S.view.get().mode !== 'free') S.view.set({ mode: 'free' });
  if (section) { S.bend.set(1); S.view.set({ mode: 'section' }); S.landmarks.build(); S.view.set(v); } else { if (v.bend === 0) S.bend.set(0); S.view.set(v); if (S.transition) S.transition.pending = true; }
  window.__step(n); S.renderer.render(S.scene, S.camera);
  const t0 = Date.now(); S.renderer.render(S.scene, S.camera); S.renderer.getContext().finish(); const ms = Date.now() - t0; const i = S.renderer.info.render; return { calls: i.calls, tris: i.triangles, ms, u: S.bend.get() }; }, [v, n, weather, section]);
const rows = [], add = (group, name, r) => { rows.push({ group, name, ...r }); console.log(`${group} · ${name}：${r.calls} 次绘制调用，${r.tris} 个三角形，${r.ms} ms（uBend ${(+r.u).toFixed(2)}）`); };
const html = path.join(root, 'index.html'), page = await open(html);
const start = await page.evaluate(() => { const v = window.__scene.view.get(); return { yaw: v.yaw, pitch: v.pitch, dist: v.dist, target: v.target }; });
const V = { default: start, far: { yaw: 2.5, pitch: 0.82, dist: 140, target: [0, 0, 0] }, top: { yaw: 0, pitch: 1.45, dist: 150, target: [0, 0, 0] }, storeCorner: { yaw: 2.75, pitch: 0.2, dist: 13, target: [-9, 1.4, 22] } };
// the scene's own start view: nothing set, 40 frames
{ const r = await page.evaluate(() => { window.__step(40); const S = window.__scene; S.renderer.render(S.scene, S.camera); const t0 = Date.now(); S.renderer.render(S.scene, S.camera); S.renderer.getContext().finish(); const i = S.renderer.info.render; return { calls: i.calls, tris: i.triangles, ms: Date.now() - t0, u: S.bend.get() }; }); add('平面城镇（雨锁定）', '默认视角（场景起始机位）', r); }
for (const k of ['far', 'top', 'storeCorner']) add('平面城镇（雨锁定）', k, await measure(page, { ...V[k], bend: 0 }));
// the transition at a town target, uBend rising (the worst case is between 150 and 300 m)
for (const d of [160, 190, 225, 270, 300, 350]) add('卷曲过渡（目标在城镇）', `d = ${d}`, await measure(page, { target: [0, 1.2, 0], dist: d, pitch: 1.2, yaw: 0 }, 50, 'clear'));
// the four directions of the panorama
for (const [n, lon, lat] of [['FRONT', 0, 6], ['EAST', 90, 0], ['BACK', 180, 0], ['WEST', -90, 0]]) { const q = await page.evaluate(([lon, lat]) => window.WORLD.lonLatToTown(lon, lat), [lon, lat]); add('全景（d = 350）', n, await measure(page, { target: [q.x, 1.2, q.z], dist: 350, pitch: 1.5, yaw: 0 }, 50, 'clear')); }
// each landmark close-up: 30 m, a low oblique view over the site (the landmark and the ground cover load)
const lms = await page.evaluate(() => window.WORLD.landmarks.filter(l => l.id !== 'TOWN').map(l => ({ id: l.id, name: l.name, lon: l.lon, lat: l.lat })));
for (const l of lms) { const q = await page.evaluate(([lon, lat]) => window.WORLD.lonLatToTown(lon, lat), [l.lon, l.lat]); add('地标近景（30 m，球面地面视角）', l.id, await measure(page, { target: [q.x, 1.2, q.z], dist: 30, pitch: 0.45, yaw: 0.8 }, 50, 'rain', true)); }
// the six weather states at the default view and at a planet ground view (LM04 forest)
for (const st of ['rain', 'after', 'overcast', 'clear', 'snow', 'fog']) add('天气（平面城镇默认视角）', st, await measure(page, { ...V.default, bend: 0 }, 30, st));
await page.close();
// older builds: the default view only (ROADMAP section 4 rule 6)
const base = [];
for (const ref of ['pre-sample-upgrade', 'pre-w2', 'pre-w8a', 'pre-w8b']) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-')); try { execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { cwd: root, stdio: 'pipe' }); execFileSync('python3', ['build.py'], { cwd: dir, stdio: 'pipe' });
    const pg = await open(path.join(dir, 'index.html')), r = await pg.evaluate(() => { window.__step(40); const S = window.__scene; S.renderer.render(S.scene, S.camera); const i = S.renderer.info.render; return { calls: i.calls, tris: i.triangles }; }); await pg.close(); base.push({ ref, ...r }); console.log(`旧构建 ${ref} 默认视角：${r.calls} 次绘制调用，${r.tris} 个三角形`); }
  catch (e) { console.log(`旧构建 ${ref}：无法构建（${String(e.message).split('\n')[0]}）`); } finally { try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'pipe' }); } catch { fs.rmSync(dir, { recursive: true, force: true }); } }
}
await browser.close();
if (md) {
  console.log('\n| 分组 | 视角 | 绘制调用 | 三角形 | 单帧渲染 ms（SwiftShader） |\n| --- | --- | --- | --- | --- |');
  for (const r of rows) console.log(`| ${r.group} | ${r.name} | ${r.calls} | ${r.tris} | ${r.ms} |`);
  console.log('\n| 构建 | 默认视角绘制调用 | 三角形 |\n| --- | --- | --- |'); for (const b of base) console.log(`| ${b.ref} | ${b.calls} | ${b.tris} |`);
}
fs.mkdirSync(path.join(root, 'tools', 'out'), { recursive: true }); fs.writeFileSync(path.join(root, 'tools', 'out', 'w8_perf.json'), JSON.stringify({ rows, base }, null, 1));
