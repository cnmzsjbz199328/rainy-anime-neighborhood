// W8a checks and ST04 shots: the town-to-planet transition. Run after `python3 build.py`:  node tools/transition_check.mjs [--shots] [--no-pixels]
//   C2  uBend(d) monotone and continuous (1 m steps: change <= 0.02), flat at d = 150 and d = 300; forward and backward zoom give the same state at the same d (no hysteresis)
//   C3  with uBend = 1 camera.up is the radial direction under the target (<= 0.01 degree) for 1000 deterministic random targets; the lifted camera stays >= 0.25 m above the rendered ground
//   C5  zoom steps of 10 m (9 .. 400): the mean frame-to-frame change of the picture has no jump larger than 3 times the mean of its neighbours
//   C4  (--shots) the eight ST04 frames into docs/world/w8/
// C1 (every d <= 150 view identical to W7 outside the patch) is tools/regress.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const results = [], fails = [], out = (ok, name, lines) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); };
const f = (x, n = 2) => (+x).toFixed(n);
const browser = await launchChromium(), errors = [];
async function open(w = 800, h = 500) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT); await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.transition, null, { timeout: 90000 }); await page.evaluate(() => window.__step(3)); return page;
}
// zoom to distance d as the wheel does (view.set + the pending flag), then n frames
const go = (page, d, n = 4) => page.evaluate(([d, n]) => { const S = window.__scene; S.view.set({ dist: d }); S.transition.pending = true; window.__step(n); }, [d, n]);
const state = page => page.evaluate(() => { const S = window.__scene, c = S.camera; return { bend: S.bend.get(), fog: S.scene.fog.density, fade: S.terrain.fade.rest, pos: c.position.toArray(), up: c.up.toArray(), far: c.far }; });
const shot = page => page.evaluate(() => { const S = window.__scene; S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL('image/png'); });
const diff = (page, a, b) => page.evaluate(async ([a, b]) => { const load = async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const q = c.getContext('2d'); q.drawImage(i, 0, 0); return q.getImageData(0, 0, c.width, c.height).data; }; const A = await load(a), B = await load(b); let n = 0, mx = 0, sum = 0; for (let k = 0; k < A.length; k += 4) { const d = Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])); if (d > 2) n++; if (d > mx) mx = d; sum += Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]); } return { over: n, max: mx, mean: sum / (A.length / 4) / 3, total: A.length / 4 }; }, [a, b]);

const page = await open(), only = args.find(a => /^--c\d$/.test(a)), want = c => !only || only === '--' + c;
// ---- C2
if (want('c2')) {
  const lines = [], r = await page.evaluate(() => { const T = window.__scene.transition.api, u = []; for (let d = 9; d <= 400; d += 1) u.push(T.bendOf(d)); return { u, a150: T.bendOf(150), a300: T.bendOf(300), d150: (T.bendOf(150.5) - T.bendOf(150)) / 0.5, d300: (T.bendOf(300) - T.bendOf(299.5)) / 0.5, t60: T.terrainOf(60), t150: T.terrainOf(150), c98: T.capsOf(0.98), c100: T.capsOf(1) }; });
  let mono = true, maxStep = 0; for (let i = 1; i < r.u.length; i++) { if (r.u[i] < r.u[i - 1]) mono = false; maxStep = Math.max(maxStep, r.u[i] - r.u[i - 1]); }
  let ok = mono && maxStep <= 0.02 && r.a150 === 0 && r.a300 === 1 && Math.abs(r.d150) < 1e-3 && Math.abs(r.d300) < 0.02;
  lines.push(`uBend(d)：d = 9…400 单调不减 ${mono}；相邻 1 m 的最大增量 ${f(maxStep, 4)}（≤ 0.02）；d = 150 处 ${r.a150}、d = 300 处 ${r.a300}；导数 d = 150 处 ${f(r.d150, 5)}、d = 300 处 ${f(r.d300, 5)}（取半米差分，两端为 0）；地形淡入 ${r.t60}→${r.t150}；极帽淡入 ${r.c98}→${r.c100}`);
  // no hysteresis: two fresh pages, one coming from 50 m, one from 400 m, to the same d; same frame count; state equal, picture compared
  const ds = [120, 190, 225, 270, 300, 350], rows = [];
  const pA = await open(), pB = await open();
  await go(pA, 50, 20); await go(pB, 400, 20);
  for (const d of ds) {
    await go(pA, d, 90); await go(pB, d, 90);
    const sa = await state(pA), sb = await state(pB), same = JSON.stringify(sa) === JSON.stringify(sb); if (!same) console.log('    A', JSON.stringify(sa), '\n    B', JSON.stringify(sb));
    let px = ''; if (!args.includes('--no-pixels')) { const a = await shot(pA), b = await shot(pB), df = await diff(pA, a, b); px = `；画面差 > 2 的像素 ${df.over}/${df.total}（最大通道差 ${df.max}）`; if (df.over > df.total * 0.0005) ok = false; }
    rows.push(`d = ${d}：状态${same ? '逐位相同' : '不同'}（uBend ${f(sa.bend, 4)}，雾 ${f(sa.fog, 5)}，地形淡入 ${f(sa.fade, 3)}）${px}`); if (!same) ok = false;
  }
  await pA.close(); await pB.close();
  out(ok, 'W8a-C2 uBend(d) 单调连续、两端导数为 0、正向与反向同一 d 同一画面（无滞回）', [...lines, ...rows, '做法：两个新页面，一个从 50 m 拉远、一个从 400 m 推近，到同一 d 后各走 90 帧（固定时钟与随机种子）再比较状态与画面；两页的帧数与时钟相同，画面应逐位相同（容差 0.05% 像素只为工具的不确定性留余地）']);
}
// ---- C3
if (want('c3')) {
  const r = await page.evaluate(async () => {
    const S = window.__scene, T = S.transition.api, B = S.bend, W = window.WORLD, R = B.R, D = Math.PI / 180; S.terrain.buildRest(); const samp = S.terrain.sampler();
    let s = 12345; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    let worstAng = 0, minClear = 1e9, minRaw = 1e9, lifted = 0; const cam = S.camera;
    for (let i = 0; i < 1000; i++) {
      const lon = -180 + rnd() * 360, lat = -84 + rnd() * 168, q = W.lonLatToTown(lon, lat), yaw = rnd() * 6.283, pitch = 0.05 + rnd() * 1.4, d = 300 + rnd() * 100, h0 = Math.max(0, samp(lon, lat) ?? 0);
      const fr = T.frame(B, [q.x, h0 + 1.2, q.z], d, yaw, pitch, 1), P = B.point(q.x, h0 + 1.2, q.z, 1), rv = [P[0], P[1] + R, P[2]], rl = Math.hypot(...rv), upv = fr.up;
      const ang = Math.acos(Math.max(-1, Math.min(1, (rv[0] * upv[0] + rv[1] * upv[1] + rv[2] * upv[2]) / rl))) / D; worstAng = Math.max(worstAng, ang);
      cam.position.set(...fr.position); const alt0 = (v => Math.hypot(v.x, v.y + R, v.z))(cam.position); S.transition.lift();
      const v = cam.position, r = Math.hypot(v.x, v.y + R, v.z), lam = Math.atan2(v.x, v.y + R), phi = Math.asin(-v.z / r), g = Math.max(0, samp(lam / D, phi / D) ?? 0);
      minRaw = Math.min(minRaw, alt0 - R - g); if (alt0 - R - g < 0.5) lifted++; minClear = Math.min(minClear, r - R - g);
    }
    return { worstAng, minClear, minRaw, lifted };
  });
  const ok = r.worstAng <= 0.01 && r.minClear >= 0.25;
  out(ok, 'W8a-C3 uBend = 1 时 camera.up 与目标点径向一致、相机不穿入地形', [`1000 个确定性随机目标（经度 ±180°、纬度 ±84°，d 300–400 m，俯仰 0.05–1.45 rad）：up 与径向的最大夹角 ${f(r.worstAng, 5)}°（≤ 0.01°）；相机到渲染地形的最小净空 ${f(r.minClear, 2)} m（≥ 0.25 m，相机每次径向抬升到地形上 0.5 m）；未抬升前的最小净空 ${f(r.minRaw, 2)} m，其中 ${r.lifted} 个需要抬升（d ≥ 300 时相机高度都在 25 m 以上，不需要抬升才是常态）`]);
}
// ---- C5
if (want('c5')) {
  const p5 = await open(640, 400); const frames = [], ds = []; for (let d = 9; d <= 400; d += 10) ds.push(d);
  await go(p5, 9, 30); const urls = [];
  for (const d of ds) { await go(p5, d, 60); urls.push(await shot(p5)); }
  const dif = []; for (let i = 1; i < urls.length; i++) dif.push((await diff(p5, urls[i - 1], urls[i])).mean);
  let worst = 0, at = 0; for (let i = 0; i < dif.length; i++) { const nb = [dif[i - 1], dif[i + 1]].filter(v => v !== undefined), m = nb.reduce((a, b) => a + b, 0) / nb.length; if (m > 0.5) { const r = dif[i] / m; if (r > worst) { worst = r; at = i; } } }
  const ok = worst <= 3; await p5.close();
  out(ok, 'W8a-C5 缩放每 10 m 一档：相邻档的画面变化无单帧突变（≤ 相邻均值的 3 倍）', [`${ds.length} 档（d = 9…399）；相邻档平均通道差 最小 ${f(Math.min(...dif))}、最大 ${f(Math.max(...dif))}；最大突变比 ${f(worst)}（在 d = ${ds[at]}→${ds[at + 1]}，相邻均值 > 0.5 才计）`]);
}
// ---- C4 shots
if (args.includes('--shots')) {
  const dir = path.join(root, 'docs', 'world', 'w8'); fs.mkdirSync(dir, { recursive: true });
  const ps = await open(1280, 800), seq = [[50, 'rain-town'], [120, 'fields-in-fog'], [190, 'curling-begins'], [225, 'half-rolled'], [270, 'nearly-closed'], [300, 'planet-caps'], [350, 'planet-night'], [50, 'back-to-town']];
  await ps.evaluate(() => { const S = window.__scene; S.view.set({ yaw: 2.5, pitch: 0.95, target: [0, 1.2, 0] }); });
  const lines = [];
  for (let k = 0; k < seq.length; k++) { const [d, name] = seq[k]; await go(ps, d, 120); const st = await state(ps); fs.writeFileSync(path.join(dir, `st04-${k + 1}-${name}.png`), Buffer.from((await shot(ps)).split(',')[1], 'base64')); lines.push(`${k + 1}  d = ${d}  uBend ${f(st.bend, 3)}  fog ${f(st.fog, 5)}  terrain ${f(st.fade, 2)}`); }
  out(true, 'W8a-C4 ST04 八格截图（docs/world/w8/st04-*.png，夜间，固定机位序列）', lines); await ps.close();
}
if (errors.length) { console.log('page errors:', errors.slice(0, 5).join(' | ')); fails.push('page errors'); }
await browser.close();
console.log(fails.length ? `FAIL transition_check：${fails.join('；')}` : `PASS transition_check（${results.length} 项）`);
process.exitCode = fails.length ? 1 : 0;
