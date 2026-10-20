// R3 (docs/world/THIRD_PERSON_ROAM_PLAN.md 6.11 K10): the ride's performance on a real GPU (headless Chromium, ANGLE Metal, quality high), one fresh browser per item,
// run alone (no other browser job at the same time; record the machine's memory state with the result).
//   ride views  S0, A01 mid, W01, CR01 south-east, RN01-03 mid-span, RN01-05 in the tunnel, LM07 west entrance: the rider placed there and standing (the scene's rain and
//               animations run), 3 s to settle, then 6 s of frame intervals from the page's own render loop (scene.js frame), as tools/perf_baseline.mjs counts them:
//               median <= 17 ms, p95 <= 25 ms; the draw calls and triangles of the frame, and the rider's own (<= 24 calls, <= 30k triangles)
//   logic       the ride's logic per frame (motion, collision, camera: ride.step at 1/60 s with throttle and steering, 600 steps timed together on a riding stretch)
//   free view   the default free view (rider hidden): draw calls and triangles against the same measure of the baseline build (--ref <dir with index.html>, default pre-ride)
// node tools/ride_perf.mjs [--out docs/world/perf/ride-r3.json] [--ref <dir>] [--only s0,a01,...] [--sphere]
// W9b (SPHERE_RIDING_PLAN 6 SR9): --sphere rides the views on the sphere (the map switched while riding, the rider placed again) and times the logic with the drawn camera
// there (the whole ride step: motion, collision, camera, display pass, rider; the rider's animation apart); the baseline is the reference build's free view on the sphere
// at the same places (9 m behind the rider's heading, pitch 0.5), the planet's existing frame time kept apart from this build's increment
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), argv = process.argv.slice(2), opt = k => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const OUT = opt('--out') || path.join(root, 'docs/world/perf/ride-r3.json'), REF = opt('--ref'), ONLY = opt('--only') ? opt('--only').split(',') : null, SPHERE = argv.includes('--sphere');
const FLAGS = ['--use-angle=metal', '--ignore-gpu-blocklist'];
// the views: [name, how to place the rider (in page: returns { x, z, heading, layer })]
const VIEWS = [
  ['s0', 'S0 便利店门前（R01 西行）', () => ({ x: -7, z: 16.75, heading: -Math.PI / 2 })],
  ['a01', 'A01 巷道中段', () => ({ x: -27, z: 32.25, heading: -Math.PI / 2 })],
  ['w01', 'W01 人行通道', () => ({ x: -18, z: 27.5, heading: Math.PI })],
  ['cr01se', 'CR01 东南', () => { const G = window.__scene.ground, ln = G.lines.find(l => l.id === 'CR01'), N = window.WORLD.roadNetwork, n = N.nodeById['C01-SE'], R = 90, D = Math.PI / 180, fx = R * n.lon * D, fz = -R * Math.asinh(Math.tan(n.lat * D)), q = ln.project(fx, fz, true), a = ln.point(q.s, -1.125), b = ln.point(q.s + 0.5, -1.125); return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z) }; }],
  ['rn0103', 'RN01-03 桥跨中', () => { const G = window.__scene.ground, ln = G.lines.find(l => l.id === 'RN01-03'), a = ln.point(ln.length / 2, -1.75), b = ln.point(ln.length / 2 + 0.5, -1.75); return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), layer: 'deck' }; }],
  ['rn0105', 'RN01-05 隧道内', () => { const G = window.__scene.ground, ln = G.lines.find(l => l.tunnel), s = (ln.tunnel[0] + ln.tunnel[1]) / 2, a = ln.point(s, -1.75), b = ln.point(s + 0.5, -1.75); return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), layer: 'tunnel' }; }],
  ['lm07w', 'LM07 西口（RN10-01 雪道端）', () => { const G = window.__scene.ground, ln = G.lines.find(l => l.id === 'RN10-RD08'), a = ln.point(ln.length - 3, 0), b = ln.point(ln.length - 2.5, 0); return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z) }; }],
];
const machine = () => { let swap = ''; try { swap = execSync('sysctl -n vm.swapusage').toString().trim(); } catch {} return { freeMemMB: Math.round(os.freemem() / 1048576), totalMemMB: Math.round(os.totalmem() / 1048576), swap, load: os.loadavg().map(v => +v.toFixed(2)) }; };
// only the page's own render loop (scene.js function frame) counts
const PROBE = () => { const P = window.__perf = { frames: [] }, raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => raf(ts => { cb(ts); if (cb.name === 'frame') P.frames.push(performance.now()); }); };

async function openPage(dir) {
  const browser = await chromium.launch({ args: FLAGS }), page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message)); await page.addInitScript(PROBE);
  await page.goto(pathToFileURL(path.join(dir, 'index.html')).href + '?quality=high', { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.__scene && window.__scene.ground, null, { timeout: 300000, polling: 250 });
  await page.waitForTimeout(1500);
  return { browser, page, errors };
}
const frameStats = (page, settleMs, ms) => page.evaluate(([settleMs, ms]) => new Promise(res => { setTimeout(() => { const f0 = window.__perf.frames.length; setTimeout(() => {
  const fr = window.__perf.frames.slice(f0), gaps = fr.slice(1).map((t, i) => t - fr[i]).sort((a, b) => a - b), at = p => (gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))] : null), info = { ...window.__scene.renderer.info.render };
  res({ frames: fr.length, medianMs: +at(0.5).toFixed(2), p95Ms: +at(0.95).toFixed(2), maxMs: +(gaps.length ? gaps[gaps.length - 1] : 0).toFixed(2), calls: info.calls, triangles: info.triangles }); }, ms); }, settleMs); }), [settleMs, ms]);
const gpuOf = page => page.evaluate(() => { const gl = window.__scene.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });

const result = { tool: 'tools/ride_perf.mjs', sphere: SPHERE, date: new Date().toISOString(), commit: execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim(), dirty: !!execSync('git status --porcelain -- . ":!tools/out"', { cwd: root }).toString().trim(), flags: FLAGS, quality: 'high', budget: { medianMs: 17, p95Ms: 25, riderCalls: 24, riderTriangles: 30000, logicMs: 0.5 }, machineStart: machine(), views: {}, logic: null, free: null };
for (const [name, label, place] of VIEWS) {
  if (ONLY && !ONLY.includes(name)) continue;
  const { browser, page, errors } = await openPage(root);
  try {
    result.gpu = result.gpu || await gpuOf(page); result.browser = result.browser || browser.version();
    const placed = await page.evaluate(src => { const S = window.__scene; S.view.set({ mode: 'free', mapMode: 'flat' }); S.view.set({ mode: 'roam' }); const p = (0, eval)('(' + src + ')')(); const g = S.ride.set(p); return { p, ok: !!g, kind: g && g.kind, layer: g && g.layer, s: g && g.s }; }, place.toString());
    if (SPHERE) { await page.evaluate(() => window.__scene.view.set({ mapMode: 'sphere' })); await page.waitForFunction(() => !window.__scene.transition.animating && window.__scene.bend.get() === 1, null, { timeout: 30000, polling: 100 }); await page.evaluate(p => window.__scene.ride.set(p), placed.p); placed.mode = await page.evaluate(() => window.__scene.view.get().mode + '/' + window.__scene.transition.mode); }
    const f = await frameStats(page, 3000, 6000), rider = await page.evaluate(() => window.__scene.ride.rider());
    result.views[name] = { label, ...placed, ...f, rider: { calls: rider.drawCalls, triangles: rider.triangles }, errors: errors.length, machine: machine() };
    if (SPHERE && REF) { const r2 = await openPage(REF); try { await r2.page.evaluate(p => { const S = window.__scene; S.view.set({ mode: 'free', mapMode: 'sphere', target: [p.x, 1.2, p.z], yaw: p.heading + Math.PI, pitch: 0.5, dist: 9 }); }, placed.p); await r2.page.waitForFunction(() => !window.__scene.transition.animating && window.__scene.bend.get() === 1, null, { timeout: 30000, polling: 100 });
      const g = await frameStats(r2.page, 3000, 6000); result.views[name].refSphereFree = g; console.log(`  参照构建同处球形自由视角：${g.medianMs} / ${g.p95Ms} ms，${g.calls} 次绘制；本构建骑行增量 ${(f.medianMs - g.medianMs).toFixed(2)} / ${(f.p95Ms - g.p95Ms).toFixed(2)} ms`); } finally { await r2.browser.close(); } }
    console.log(`${name} ${label}：帧间隔中位数 ${f.medianMs} ms、p95 ${f.p95Ms} ms（${f.frames} 帧），整帧 ${f.calls} 次绘制、${f.triangles} 三角形；主体 ${rider.drawCalls} 次、${rider.triangles} 三角形；${placed.kind}/${placed.layer}`);
  } finally { await browser.close(); }
}
// the ride's logic per frame: 600 steps of 1/60 s riding R01 west and back (throttle, a slow weave), the camera included; also on the CR01 and in the tunnel
if (!ONLY || ONLY.includes('logic')) {
  const { browser, page } = await openPage(root);
  try {
    result.logic = await page.evaluate(() => {
      const S = window.__scene, out = {};
      S.view.set({ mode: 'free', mapMode: 'flat' }); S.view.set({ mode: 'roam' });
      const run = (name, x, z, h, layer) => { S.ride.set({ x, z, heading: h, layer }); for (let i = 0; i < 60; i++) S.ride.step(1 / 60, { throttle: 1, steer: 0 });
        const api = S.ride.api(), t0 = performance.now(); let n = 0; for (let i = 0; i < 600; i++) { api.step(1 / 60, { throttle: 1, steer: Math.sin(i / 50) * 0.35 }); n++; } const ms = (performance.now() - t0) / n; out[name] = +ms.toFixed(4); };
      run('town-R01', -7, 16.75, -Math.PI / 2);
      const G = S.ground, cr = G.lines.find(l => l.id === 'CR01'), a = cr.point(20, -1.125), b = cr.point(20.5, -1.125); run('CR01', a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z));
      const tn = G.lines.find(l => l.tunnel), c = tn.point(tn.tunnel[0] + 2, -1.75), d = tn.point(tn.tunnel[0] + 2.5, -1.75); run('tunnel', c.x, c.z, Math.atan2(d.x - c.x, d.z - c.z), 'tunnel');
      out.places = { cr: [a.x, a.z, Math.atan2(b.x - a.x, b.z - a.z)], tn: [c.x, c.z, Math.atan2(d.x - c.x, d.z - c.z)] };
      // the rider's animation (rider.js update), apart from the ride's logic
      const rider = S.ride.riderApi(), st = S.ride.api().state, t1 = performance.now(); for (let i = 0; i < 600; i++) rider.update(1 / 60, { x: st.x, root: st.root, z: st.z, heading: st.heading + i * 0.001, speed: 3, mode: 'ride', s: st.s, wheels: [st.yF, st.yB], lookYaw: 0, throttle: 1 });
      out.riderAnimationMs = +((performance.now() - t1) / 600).toFixed(4);
      return out; });
    if (SPHERE) {
      await page.evaluate(() => window.__scene.view.set({ mapMode: 'sphere' })); await page.waitForFunction(() => !window.__scene.transition.animating && window.__scene.bend.get() === 1, null, { timeout: 30000, polling: 100 });
      result.logic.sphere = await page.evaluate(pl => {
        const S = window.__scene, out = {};
        const run = (name, x, z, h, layer) => { S.ride.set({ x, z, heading: h, layer }); for (let i = 0; i < 60; i++) S.ride.step(1 / 60, { throttle: 1, steer: 0 });
          const api = S.ride.api(), t0 = performance.now(); for (let i = 0; i < 600; i++) api.step(1 / 60, { throttle: 1, steer: Math.sin(i / 50) * 0.35 }); const logic = (performance.now() - t0) / 600;
          S.ride.set({ x, z, heading: h, layer }); for (let i = 0; i < 60; i++) S.ride.step(1 / 60, { throttle: 1, steer: 0 });
          const t1 = performance.now(); for (let i = 0; i < 600; i++) S.ride.step(1 / 60, { throttle: 1, steer: Math.sin(i / 50) * 0.35 }); const all = (performance.now() - t1) / 600; out[name] = { logic: +logic.toFixed(4), all: +all.toFixed(4) }; };
        run('town-R01', -7, 16.75, -Math.PI / 2); run('CR01', ...pl.cr); run('tunnel', ...pl.tn, 'tunnel');
        for (const k of Object.keys(out)) out[k].logicCamera = +(out[k].all - pl.anim).toFixed(4);      // the whole step less the rider's animation (timed on the flat map)
        out.surfaces = S.ride.surfaces(); return out; }, { ...result.logic.places, anim: result.logic.riderAnimationMs });
    }
    console.log(`骑行逻辑每帧（运动 + 碰撞 + 镜头）：${JSON.stringify(result.logic)} ms`);
  } finally { await browser.close(); }
}
// the free view's default (rider hidden), this build and the reference build
if (!ONLY || ONLY.includes('free')) {
  const freeOf = async dir => { const { browser, page } = await openPage(dir); try { await page.evaluate(() => window.__scene.view.set({ mode: 'free', mapMode: 'flat', target: [-7, 1.2, 20], yaw: 2.5, pitch: 0.5, dist: 34 })); const f = await frameStats(page, 3000, 6000); return { ...f, gpu: await gpuOf(page) }; } finally { await browser.close(); } };
  const ref = REF || null;
  result.free = { build: await freeOf(root) };
  if (ref) result.free.ref = { dir: ref, ...(await freeOf(ref)) };
  console.log(`自由视角默认机位：本构建 ${result.free.build.calls} 次绘制、${result.free.build.triangles} 三角形、${result.free.build.medianMs} / ${result.free.build.p95Ms} ms${result.free.ref ? `；参照 ${result.free.ref.calls} 次、${result.free.ref.triangles} 三角形、${result.free.ref.medianMs} / ${result.free.ref.p95Ms} ms` : ''}`);
}
result.machineEnd = machine();
const v = Object.values(result.views);
result.summary = { viewsMedianMax: v.length ? Math.max(...v.map(q => q.medianMs)) : null, viewsP95Max: v.length ? Math.max(...v.map(q => q.p95Ms)) : null, riderCalls: v.length ? Math.max(...v.map(q => q.rider.calls)) : null, riderTriangles: v.length ? Math.max(...v.map(q => q.rider.triangles)) : null,
  logicMaxMs: result.logic ? Math.max(result.logic['town-R01'], result.logic.CR01, result.logic.tunnel) : null, sphereLogicCameraMaxMs: result.logic && result.logic.sphere ? Math.max(...['town-R01', 'CR01', 'tunnel'].map(k => result.logic.sphere[k].logicCamera)) : null,
  sphereIncrementMedianMax: SPHERE && REF && v.length ? Math.max(...v.filter(q => q.refSphereFree).map(q => +(q.medianMs - q.refSphereFree.medianMs).toFixed(2))) : null, freeCallsSame: result.free && result.free.ref ? result.free.build.calls === result.free.ref.calls : null };
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
console.log(`GPU ${result.gpu}；写入 ${path.relative(root, OUT)}；摘要 ${JSON.stringify(result.summary)}`);
