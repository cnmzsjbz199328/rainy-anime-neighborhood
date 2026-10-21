// W9b (docs/world/SPHERE_RIDING_PLAN.md 6): machine checks of the ride on both maps and through the switch, on the built page (real GPU, ANGLE Metal, as ride_check).
//   node tools/sphere_ride_check.mjs [--only SR1,SR2,...] [--json docs/world/w9b/sphere-ride-report.json] [--no-perf] [--ref <dir with the baseline index.html>]
// Deterministic pages drive their animation frames by hand (road_views.mjs INIT: dt 1/60 s); the drawn geometry is the shader's mapping redone on the CPU
// (tools/sphere_ride_kit.mjs: world matrix, the seam shift, bend.js point at u) -- no plain flat ray counts as evidence.
//   SR1  the four combinations and the ways between them (V, Esc, the buttons): a map switch calls no ride.enter / exit / ground.spawn; leaving works during a switch
//   SR2  the same start, dt and input with and without switches (one and a reversal mid-way): the ride's state and the rider's animation the same (<= 1e-6)
//   SR3  the camera at u = 0 .. 1 and frame by frame through switches (both ways, reversed, the far side across the antimeridian, high latitude, across the seam, the
//        tunnel): finite, an orthonormal frame, no flip; per-frame movement and turn with their peaks explained
//   SR4  the tyres on the drawn surface (K2's classes), the drawn speed, wheelbase and camera distance by the scale formula (ride_view.js), the foot when stopped
//   SR5  the camera as drawn (K5's rules on the drawn camera): never in an occluder, over the surface, the horizontal limit, the narrow places, the tunnel lining, and
//        the drawn sight line against the bent scene: 0 violations
//   SR6  real input events on the sphere (desktop, touch): speed, braking, reverse, steering, 360 deg look, recentre, zoom, blur, pointercancel; the sphere's grab never
//        takes a pointer while riding (also a finger left on the screen)
//   SR7  the weather: none on the sphere near or far, the daylight on, the switch's fade continuous; back on the flat map the rider's own place, the time running on
//   SR8  spawns on the sphere equal the flat ones (place, layer, heading); leaving at the rider's place (a deck, the tunnel) with the free camera clear; leaving mid-switch,
//        at once again: no jump back, no input left
//   SR9  page errors; the rider's calls and triangles against R2; the logic with the drawn camera per frame; then (alone, its own browsers) tools/ride_perf.mjs --sphere
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { INIT } from './road_views.mjs';
import { ROUTES, LANE, SPAWN_PROBES } from './ride_routes.mjs';
import { install } from './ride_driver.mjs';
import { kit } from './sphere_ride_kit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), argv = process.argv.slice(2);
const opt = k => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const ONLY = opt('--only') ? opt('--only').split(',') : null, want = k => !ONLY || ONLY.includes(k);
const OUT = opt('--json') || path.join(root, 'docs/world/w9b/sphere-ride-report.json');
const results = [], report = { tool: 'tools/sphere_ride_check.mjs', date: new Date().toISOString(), checks: {} };
const check = (id, ok, detail, lines = [], data = null) => { results.push([id, ok]); report.checks[id] = { ok, detail, lines, data }; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); for (const l of lines) console.log('  · ' + l); };
const f = (v, n = 3) => (v === null || v === undefined || Number.isNaN(v) ? '—' : (+v).toFixed(n));
const R2 = { calls: 17, triangles: 12503 };          // the rider of R2 (PROGRESS「R2 实施记录」/「R3 实施记录」)

const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
async function open({ init = true, touch = false } = {}) {
  const page = await browser.newPage(touch ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  if (init) await page.addInitScript(INIT);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?quality=high', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__scene && window.__scene.ride && window.__scene.ground, null, { timeout: 240000, polling: 200 });
  if (init) await page.evaluate(() => window.__step(3)); else await page.waitForTimeout(800);
  await page.evaluate(install, { LANE });
  return page;
}
// in page: ride in the given map (frames run until the switch is over), the rider placed at p ({ x, z, heading, layer }) when given
const SETUP = ({ map, p }) => {
  const S = window.__scene, T = S.transition;
  if (!window.__SR) return 'no kit';
  if (S.view.get().mode !== 'roam') { if (T.mode !== 'flat' && !T.animating) {} S.view.set({ mode: 'roam' }); }
  if (T.mode !== map) { S.view.set({ mapMode: map }); }
  let k = 0; while (T.animating && k++ < 400) window.__step(1);
  if (S.view.get().mode !== 'roam') S.view.set({ mode: 'roam' });
  if (p) S.ride.set(p);
  window.__step(70);           // the hand-off of the camera is over
  return S.view.get().mode + '/' + T.mode + '/' + S.bend.get();
};

// ================================================================ deterministic page
const page = await open();
const kitInfo = await page.evaluate(kit);
console.log(`INFO 显示几何：可遮挡网格 ${kitInfo.sight}、可走面网格 ${kitInfo.walk}`);

// ---- SR1: the mode matrix
if (want('SR1')) {
  const r = await page.evaluate(() => {
    const S = window.__scene, T = S.transition, api = S.ride.api ? null : null; void api;
    S.view.set({ mode: 'roam' }); S.view.set({ mode: 'free' });
    const ride = S.ride.api(), G = S.ground, cnt = { enter: 0, exit: 0, spawn: 0 };
    const e0 = ride.enter, x0 = ride.exit, s0 = G.spawn; ride.enter = (...a) => { cnt.enter++; return e0.apply(ride, a); }; ride.exit = (...a) => { cnt.exit++; return x0.apply(ride, a); }; G.spawn = (...a) => { cnt.spawn++; return s0.apply(G, a); };
    const btn = () => document.getElementById('town-view-toggle'), map = () => document.getElementById('map-mode-toggle'), rows = [];
    const press = k => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k })); window.dispatchEvent(new KeyboardEvent('keyup', { key: k })); };
    const st = tag => { const v = S.view.get(); rows.push({ tag, mode: v.mode, map: v.mapMode, u: +S.bend.get().toFixed(4), anim: T.animating, text: btn().textContent.trim(), disabled: btn().disabled, rider: S.ride.riderApi().root.visible, cnt: { ...cnt } }); };
    if (T.mode !== 'flat') { S.view.set({ mapMode: 'flat' }); } let k = 0; while (T.animating && k++ < 400) window.__step(1); window.__step(70);
    st('平面自由');
    press('v'); window.__step(2); st('平面骑行（V）');
    map().click(); window.__step(30); st('骑行中切换（0.5 s）');
    window.__step(100); st('球形骑行');
    btn().click(); window.__step(2); st('球形自由（按钮）');
    window.__step(70); press('v'); window.__step(2); st('球形骑行（V）');
    map().click(); window.__step(30); press('Escape'); window.__step(2); st('切换中退出（Esc）');
    window.__step(100); st('切换结束：平面自由');
    map().click(); window.__step(10); press('v'); window.__step(2); st('未骑行时切换中按 V');
    window.__step(120); btn().click(); window.__step(2); st('球形骑行（按钮）');
    map().click(); window.__step(130); st('切回平面：平面骑行');
    press('v'); window.__step(2); st('平面自由（V）');
    ride.enter = e0; ride.exit = x0; G.spawn = s0;
    return rows;
  });
  const by = t => r.find(q => q.tag === t), ride = q => q.mode === 'roam' && q.rider && /自由视角/.test(q.text) && !q.disabled, free = q => q.mode === 'free' && !q.rider;
  const same = (a, b) => a.cnt.enter === b.cnt.enter && a.cnt.exit === b.cnt.exit && a.cnt.spawn === b.cnt.spawn;
  const rows = [
    ['四种稳定组合：平面自由、平面骑行、球形骑行、球形自由', free(by('平面自由')) && by('平面自由').map === 'flat' && ride(by('平面骑行（V）')) && by('平面骑行（V）').map === 'flat' && ride(by('球形骑行')) && by('球形骑行').u === 1 && free(by('球形自由（按钮）')) && by('球形自由（按钮）').map === 'sphere'],
    ['骑行中切图不退出、不重新出生：切换中与切换后 enter/exit/spawn 计数不变', ride(by('骑行中切换（0.5 s）')) && by('骑行中切换（0.5 s）').anim && same(by('平面骑行（V）'), by('骑行中切换（0.5 s）')) && same(by('平面骑行（V）'), by('球形骑行')) && same(by('球形骑行（按钮）'), by('切回平面：平面骑行'))],
    ['切换中退出可用（按钮不禁用），退出后地图继续到目标形态', !by('骑行中切换（0.5 s）').disabled && free(by('切换中退出（Esc）')) && by('切换中退出（Esc）').anim && by('切换中退出（Esc）').map === 'flat' && by('切换结束：平面自由').u === 0],
    ['未骑行时切换中进入不可用（按钮禁用、按 V 不进入）', by('未骑行时切换中按 V').mode === 'free' && by('未骑行时切换中按 V').disabled && by('未骑行时切换中按 V').cnt.enter === by('切换结束：平面自由').cnt.enter],
    ['球形 V、按钮直接进入与退出；平面 V 退出', ride(by('球形骑行（V）')) && ride(by('球形骑行（按钮）')) && free(by('平面自由（V）'))],
    ['进入 3 次、退出 3 次（每次进入两次出生查询：视线投影点与骑手出生点）', by('平面自由（V）').cnt.enter === 3 && by('平面自由（V）').cnt.exit === 3 && by('平面自由（V）').cnt.spawn === 6],
  ];
  check('SR1', rows.every(q => q[1]), `模式矩阵 ${rows.filter(q => q[1]).length}/${rows.length}`, [...rows.map(q => `${q[1] ? 'PASS' : 'FAIL'} ${q[0]}`), ...r.map(q => `${q.tag}：${q.mode}/${q.map} u=${q.u}${q.anim ? '（切换中）' : ''}，按钮「${q.text}」${q.disabled ? '禁用' : '可用'}，主体${q.rider ? '显示' : '隐藏'}，enter ${q.cnt.enter}、exit ${q.cnt.exit}、spawn ${q.cnt.spawn}`)], r);
}

// ---- SR3: the camera at fixed u and frame by frame through switches
// places: [name, how to place (in page), path for the frame runs (line id, s0, s1, o) or null]
const PLACES = [
  ['town', '城镇 S0（R01 西行）', () => ({ x: -7, z: 16.75, heading: -Math.PI / 2, speed: 4.0 }), null],
  ['back', '球背面 RN01-07+08+09 跨经度 180°', () => { const G = window.__scene.ground, ln = G.lines.find(l => l.id === 'RN01-07+08+09'), X = Math.PI * 90; let s = 0; for (let k = 0; k <= ln.length; k += 0.25) { if (ln.point(k, 0).x >= X - 7) { s = k; break; } } const a = ln.point(s, -1.75), b = ln.point(s + 0.5, -1.75); return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), layer: 'deck', speed: 4.0, path: ['RN01-07+08+09', s, Math.min(ln.length - 1, s + 40), -1.75] }; }],
  ['lm07', '高纬 LM07 西口（RN10-RD08）', () => { const G = window.__scene.ground, ln = G.lines.find(l => l.id === 'RN10-RD08'), a = ln.point(ln.length - 18, 0), b = ln.point(ln.length - 17.5, 0); return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), speed: 2.5, path: ['RN10-RD08', ln.length - 18, ln.length - 1, 0] }; }],
  ['seam', '经度接缝 RN01-13（切换中过接缝）', () => { const G = window.__scene.ground, S = window.__scene, ln = G.lines.find(l => l.id === 'RN01-13'), X = S.bend.SEAM; let s = null, prev = ln.point(0, 0).x; for (let k = 0.25; k <= ln.length; k += 0.25) { const x = ln.point(k, 0).x; if ((prev - X) * (x - X) <= 0 || Math.abs(x - prev) > 100) { s = k; break; } prev = x; } const s0 = Math.max(0, s - 6), a = ln.point(s0, -1.75), b = ln.point(s0 + 0.5, -1.75); return { x: G.wrap(a.x), z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), layer: 'deck', speed: 4.0, path: ['RN01-13', s0, Math.min(ln.length - 1, s0 + 30), -1.75], seamAt: s }; }],
  ['tunnel', 'RN01-05 隧道内', () => { const G = window.__scene.ground, ln = G.lines.find(l => l.tunnel), s = ln.tunnel[0] + 3, a = ln.point(s, -1.75), b = ln.point(s + 0.5, -1.75); return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), layer: 'tunnel', speed: 3.0, path: [ln.id, s, ln.tunnel[1] + 4, -1.75] }; }],
];
if (want('SR3')) {
  const lines = [], data = {}; let ok = true;
  for (const [name, label, place] of PLACES) {
    const r = await page.evaluate(({ src, name }) => {
      const S = window.__scene, T = S.transition, SR = window.__SR, RV = S.ride.view(), out = { statics: [], runs: {} };
      const p = (0, eval)('(' + src + ')')();
      // fixed u (the switch held by hand: TR.auto off)
      const sp = { x: p.x, z: p.z, heading: p.heading, layer: p.layer };
      if (S.view.get().mode !== 'roam') S.view.set({ mode: 'roam' }); S.ride.set(sp);
      for (const u of [0, 0.25, 0.5, 0.75, 1]) { RV.state.ref = null; const d = S.ride.display(u), fwd = [d.look[0] - d.position[0], d.look[1] - d.position[1], d.look[2] - d.position[2]], lf = Math.hypot(...fwd), lu = Math.hypot(...d.up);
        out.statics.push({ u, finite: [...d.position, ...d.look, ...d.up, ...d.q].every(Number.isFinite), up: +lu.toFixed(9), q: +Math.hypot(...d.q).toFixed(9), par: +(Math.abs(fwd[0] * d.up[0] + fwd[1] * d.up[1] + fwd[2] * d.up[2]) / (lf * lu)).toFixed(4), dist: +lf.toFixed(4) }); }
      // frame runs: [tag, the switches (frame -> click)]
      const path = p.path ? SR.linePath(...p.path) : null;
      const run = (tag, clicks, frames, from) => {
        // settle on the starting map with the rider placed
        const goal = from; if (T.mode !== goal) S.view.set({ mapMode: goal }); let k = 0; while (T.animating && k++ < 400) window.__step(1);
        S.ride.set({ ...sp, speed: p.speed }); window.__step(1); S.ride.set({ ...sp, speed: p.speed });
        const rec = []; let prev = null;
        for (let i = 0; i < frames; i++) {
          if (clicks.includes(i)) document.getElementById('map-mode-toggle').click();
          const inp = path ? SR.pursue(path, p.speed) : { throttle: 0.95, steer: 0 }; S.ride.hold(inp); window.__step(1);
          const c = SR.camNow(), g = S.ride.get(), u = S.bend.get(), rd = RV.point([g.x, g.root, g.z], u), fwd = c.fwd, upn = Math.hypot(...c.up);
          const q = { i, u, pos: c.pos, q: c.q, rel: [c.pos[0] - rd[0], c.pos[1] - rd[1], c.pos[2] - rd[2]], wraps: g.wraps, finite: [...c.pos, ...c.q, ...c.up].every(Number.isFinite), up: upn, par: Math.abs(fwd[0] * c.up[0] + fwd[1] * c.up[1] + fwd[2] * c.up[2]) / upn, s: g.s, v: RV.scale(g.root, g.z, u).v, x: g.x };
          if (prev) { q.d = Math.hypot(q.pos[0] - prev.pos[0], q.pos[1] - prev.pos[1], q.pos[2] - prev.pos[2]); q.dr = Math.hypot(q.rel[0] - prev.rel[0], q.rel[1] - prev.rel[1], q.rel[2] - prev.rel[2]); const dq = Math.abs(q.q[0] * prev.q[0] + q.q[1] * prev.q[1] + q.q[2] * prev.q[2] + q.q[3] * prev.q[3]); q.a = 2 * Math.acos(Math.min(1, dq)); q.wrap = q.wraps !== prev.wraps; }
          rec.push(q); prev = q;
        }
        S.ride.hold(null);
        return rec.map(q => ({ i: q.i, u: +q.u.toFixed(5), d: q.d ?? 0, dr: q.dr ?? 0, a: q.a ?? 0, wrap: !!q.wrap, finite: q.finite, up: q.up, par: q.par, s: q.s, v: q.v, x: +q.x.toFixed(3) }));
      };
      out.runs['flat→sphere'] = run('flat→sphere', [3], 140, 'flat');
      out.runs['sphere→flat'] = run('sphere→flat', [3], 140, 'sphere');
      out.runs['reversed'] = run('reversed', [3, 63], 190, 'flat');
      return out;
    }, { src: place.toString(), name });
    // per run: finite, the frame, the peaks (a frame's move or turn over 3 x the median of the 10 around it + a floor), wraps listed apart
    const rowsP = [];
    for (const [tag, rec] of Object.entries(r.runs)) {
      const bad = rec.filter(q => !q.finite || Math.abs(q.up - 1) > 1e-6 || q.par > 0.999), peaks = [], A = rec.slice(1);
      const med = (arr, i, key) => { const w = arr.slice(Math.max(0, i - 5), i).concat(arr.slice(i + 1, i + 6)).map(q => q[key]).sort((a, b) => a - b); return w.length ? w[w.length >> 1] : 0; };
      A.forEach((q, i) => { if (q.wrap) return; const unit = q.s * Math.max(q.v, 1e-3), dm = med(A, i, 'd'), am = med(A, i, 'a'), drm = med(A, i, 'dr');
        if (q.d > 3 * dm + 0.05 * unit) peaks.push(`第 ${q.i} 帧位移 ${f(q.d, 3)}（邻帧中位 ${f(dm, 3)}，u=${q.u}）`);
        if (q.dr > 3 * drm + 0.05 * unit) peaks.push(`第 ${q.i} 帧相对骑手位移 ${f(q.dr, 3)}（邻帧中位 ${f(drm, 3)}）`);
        if (q.a > 3 * am + 0.02) peaks.push(`第 ${q.i} 帧转角 ${f(q.a, 4)} rad（邻帧中位 ${f(am, 4)}）`); });
      const wraps = A.filter(q => q.wrap).map(q => `第 ${q.i} 帧过接缝（u=${q.u}）：镜头位移 ${f(q.d, 2)}（地图两边相距 (1 − u) × 2πR = ${f((1 - q.u) * 2 * Math.PI * 90, 2)}），相对骑手位移 ${f(q.dr, 4)}、转角 ${f(q.a, 4)} rad`);
      const wrapOk = A.filter(q => q.wrap).every(q => q.dr < 0.05 * q.s * Math.max(q.v, 1e-3) + 0.1 && q.a < 0.05);
      const maxD = Math.max(...A.map(q => q.wrap ? 0 : q.d)), maxA = Math.max(...A.map(q => q.a)), maxDr = Math.max(...A.map(q => q.wrap ? 0 : q.dr));
      const pass = !bad.length && !peaks.length && wrapOk && rec[rec.length - 1].u === (tag === 'sphere→flat' || tag === 'reversed' ? 0 : 1);
      if (!pass) ok = false;
      rowsP.push(`${pass ? 'PASS' : 'FAIL'} ${label} ${tag}：${rec.length} 帧，逐帧最大位移 ${f(maxD, 3)}、相对骑手 ${f(maxDr, 4)}、转角 ${f(maxA, 4)} rad；非有限/上方向失效 ${bad.length}；峰值 ${peaks.length ? peaks.slice(0, 4).join('；') : '无'}${wraps.length ? '；' + wraps.join('；') : ''}；终点 u = ${rec[rec.length - 1].u}`);
    }
    const st = r.statics, stOk = st.every(q => q.finite && Math.abs(q.up - 1) < 1e-6 && Math.abs(q.q - 1) < 1e-6 && q.par < 0.999 && q.dist > 0.5);
    if (!stOk) ok = false;
    lines.push(`${stOk ? 'PASS' : 'FAIL'} ${label} u = 0/0.25/0.5/0.75/1：有限 ${st.every(q => q.finite)}，|up| − 1 最大 ${f(Math.max(...st.map(q => Math.abs(q.up - 1))), 9)}，视线与上方向 |cos| 最大 ${f(Math.max(...st.map(q => q.par)), 4)}，镜头到看点 ${st.map(q => f(q.dist, 2)).join('/')}`, ...rowsP);
    data[name] = { statics: st, runs: Object.fromEntries(Object.entries(r.runs).map(([k, v]) => [k, { frames: v.length, maxMove: Math.max(...v.map(q => q.wrap ? 0 : q.d)), maxTurn: Math.max(...v.map(q => q.a)), wraps: v.filter(q => q.wrap).length }])) };
  }
  check('SR3', ok, `端点与过渡：${PLACES.length} 处 × 固定 u 5 档、逐帧 3 组（平面→球形、球形→平面、中途反向）`, lines, data);
}

// ---- SR4 + SR5: ridden routes at a fixed u (the sphere, and u = 0.5 held by hand): the tyres and the drawn scale (SR4), the drawn camera (SR5)
const RUNS = [[1, ['RT-01', 'RT-02', 'RT-05', 'RT-06a', 'RT-07', 'RT-09a', 'RT-09b', 'RT-10']], [0.5, ['RT-02', 'RT-06a']]];
const SR4ROUTES = { 1: ['RT-01', 'RT-05', 'RT-06a', 'RT-07', 'RT-09a', 'RT-09b'], 0.5: ['RT-06a'] }, SR5ROUTES = { 1: ['RT-02', 'RT-05', 'RT-06a', 'RT-07', 'RT-09a', 'RT-09b', 'RT-10'], 0.5: ['RT-02', 'RT-06a'] };
if (want('SR4') || want('SR5')) {
  const rows = [];
  for (const [u, ids] of RUNS) {
    for (const id of ids) {
      const do4 = want('SR4') && SR4ROUTES[u].includes(id), do5 = want('SR5') && SR5ROUTES[u].includes(id); if (!do4 && !do5) continue;
      const rt = ROUTES.find(q => q.id === id);
      const r = await page.evaluate(({ rt, u, do4, do5 }) => {
        const S = window.__scene, T = S.transition, G = S.ground, SR = window.__SR, RV = S.ride.view(), W = S.ride.world(), CFG = S.ride.cfg, dt = 1 / 60;
        if (S.view.get().mode !== 'roam') S.view.set({ mode: 'roam' });
        if (u === 1) { T.auto = true; if (T.mode !== 'sphere') S.view.set({ mapMode: 'sphere' }); let k = 0; while (T.animating && k++ < 400) window.__step(1); }
        else { if (T.mode !== 'sphere') S.view.set({ mapMode: 'sphere' }); T.auto = false; S.bend.set(u); }
        window.__step(70);
        const { P, Lc, ev } = window.__RT.routePath(rt);
        const o4 = { n: 0, cls: {}, worst: null, speed: { n: 0, worst: 0 }, base: { n: 0, worst: 0 }, cam: { n: 0, worst: 0 }, foot: { n: 0, worst: 0 }, pitch: { n: 0, worst: 0 } };
        const o5 = { steps: 0, inside: 0, low: 0, horiz: 0, narrow: 0, narrowMin: Infinity, tunnel: 0, rays: 0, hits: 0, what: [], down: 0, downLow: 0, downMin: Infinity, pulled: 0, lifted: 0, inv: 0 };
        const boxDist = (Pp, x, z) => { let inside = true, d = Infinity; for (let i = 0, n = Pp.length; i < n; i++) { const a = Pp[i], b = Pp[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez || 1e-12, t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / l2)); d = Math.min(d, Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t)); if ((x - a[0]) * ez - (z - a[1]) * ex > 0) inside = false; } return inside ? 0 : d; };
        let prevRoot = null, prevW = null, prevH = null, prevV = 0, k = 0;
        const hook = () => {
          k++; const g = S.ride.get(), c = S.ride.camera(), s = g.s, cam = S.camera.position.toArray(), focusD = RV.point(c.focus, u), up = RV.upAt(c.focus[0], c.focus[2], u), sc = RV.scale(c.focus[1], c.focus[2], u);
          const rd = S.ride.riderApi().root.position, rootD = RV.point([rd.x, rd.y, rd.z], u);
          if (do4 && k % 6 === 0) {
            o4.n++;
            const wk = [g.kind, ...(g.wheelKinds || [])], cls = g.mode === 'push' || g.carry || wk.includes('stairs') ? 'push' : wk.includes('boardwalk') ? 'boardwalk' : g.kind === 'site' || wk.includes('site') ? 'site' : (window.__RT.links.some(l => l.kind === 'abutment' && Math.hypot(SR.wdx(l.x - g.x), l.z - g.z) < 3 * s)) ? 'abutment' : 'road';
            if (cls !== 'push') { const wh = SR.wheels(u), w0 = SR.wheels(0), sg = S.ride.sag() || [0, 0]; for (const key of ['F', 'R']) { const gp = wh[key].gap; const a = o4.cls[cls] || (o4.cls[cls] = { n: 0, worst: 0, miss: 0, disp: 0 }); if (gp === null) { a.miss++; continue; } a.n++;
                // the display's own part: this gap less the gap the same rider has drawn flat without the lowering (the drawn surface's depth, scene.js wheelSag)
                if (w0[key].gap !== null) { const dd = gp - (w0[key].gap + sg[key === 'F' ? 0 : 1] / s); a.disp = Math.max(a.disp, Math.abs(dd)); wh[key].disp = dd; } if (Math.abs(gp) > a.worst) { a.worst = Math.abs(gp); if (cls === 'road' && (!o4.worst || Math.abs(gp) > o4.worst.gap)) o4.worst = { gap: Math.abs(gp), at: [+g.x.toFixed(2), +g.z.toFixed(2)], kind: g.kind, line: g.line, under: wh[key].under }; } }
              // the wheelbase as drawn (the tangent part of front - rear) against 0.94 m x s x the horizontal scale
              const dF = wh.F.hub, dR = wh.R.hub, v = [dF[0] - dR[0], dF[1] - dR[1], dF[2] - dR[2]], vu = v[0] * up[0] + v[1] * up[1] + v[2] * up[2], th = Math.hypot(v[0] - up[0] * vu, v[1] - up[1] * vu, v[2] - up[2] * vu), sch = RV.scale(g.root, g.z, u).h;
              if (u === 1) { const e = Math.abs(th / (CFG.wheelbase * s * sch * Math.cos(Math.atan2(g.wheels[0] - g.wheels[1], CFG.wheelbase * s))) - 1); o4.base.n++; o4.base.worst = Math.max(o4.base.worst, e); }
              if (wh.F.disp !== undefined && wh.R.disp !== undefined && cls === 'road') { const pe = Math.abs(wh.F.disp - wh.R.disp) / CFG.wheelbase; o4.pitch.n++; o4.pitch.worst = Math.max(o4.pitch.worst, pe); } }
            const ft = SR.foot(u); if (ft) { const f0 = SR.foot(0), sg = S.ride.sag() || [0, 0], on = cls === 'road' || cls === 'abutment', d = f0 ? Math.abs(ft.gap - (f0.gap + (sg[0] + sg[1]) / 2 / s)) : null; const a = on ? o4.foot : (o4.footApart = o4.footApart || { n: 0, worst: 0 }); a.n++; a.worst = Math.max(a.worst, Math.abs(ft.gap)); if (d !== null) { o4.footDisp = Math.max(o4.footDisp || 0, d); } }
            // the camera distance as drawn against the scale formula (no display pull this step)
            const dk = S.ride.disp(); if ((!dk.init || dk.k >= 1 - 1e-9) && !(dk.lift > 0) && !(dk.tunnel > 0) && dk.why !== 'folded') { const of = [c.position[0] - c.focus[0], c.position[1] - c.focus[1], c.position[2] - c.focus[2]], hz = Math.hypot(of[0], of[2]), want = Math.hypot(hz * sc.h, of[1] * sc.v), got = Math.hypot(cam[0] - focusD[0], cam[1] - focusD[1], cam[2] - focusD[2]); if (want > 0.5 * s * sc.v) { const e = Math.abs(got / want - 1); o4.cam.n++; o4.cam.worst = Math.max(o4.cam.worst, e); } }
          }
          // the drawn speed: the drawn root's move per step against |v| x s x the horizontal scale (straight, no contact, no wrap)
          if (do4 && u === 1 && prevRoot && prevW === g.wraps && !g.contact && Math.abs(g.speed) > 0.5 && Math.abs(SR.wpi(g.heading - prevH)) < 0.002 && g.mode !== 'push') { const dd = [rootD[0] - prevRoot[0], rootD[1] - prevRoot[1], rootD[2] - prevRoot[2]], upr = RV.upAt(rd.x, rd.z, u), dv = dd[0] * upr[0] + dd[1] * upr[1] + dd[2] * upr[2], mv = Math.hypot(dd[0] - upr[0] * dv, dd[1] - upr[1] * dv, dd[2] - upr[2] * dv) / dt, want = Math.abs(g.speed) * s * RV.scale(g.root, g.z, u).h, e = Math.abs(mv / want - 1); if (e < 0.5) { o4.speed.n++; o4.speed.worst = Math.max(o4.speed.worst, e); } }
          prevRoot = rootD; prevW = g.wraps; prevH = g.heading; prevV = g.speed;
          if (do5) {
            o5.steps++; const dk = S.ride.disp(); if (dk.k < 1 - 1e-9) o5.pulled++; if (dk.lift > 0) o5.lifted++;
            const w = RV.inverse(cam, u, c.position); if (!w) { o5.inv++; return; }
            const boxes = W.occluders(w[0] - 0.3, w[2] - 0.3, w[0] + 0.3, w[2] + 0.3); if (boxes.some(o => w[1] > o.y0 - 0.15 * s && w[1] < o.y1 + 0.15 * s && boxDist(o.pts, w[0], w[2]) < 0.15 * s - 1e-6)) o5.inside++;
            const q0 = G.at(w[0], w[2], { y: g.y }), q = q0 && Math.abs(q0.y - g.y) < 3 * s ? q0 : null, floor = q ? q.y : G.y(w[0], w[2]); if (w[1] < floor + 0.12 * s - 2e-4 * s) o5.low++;
            const allowed = g.layer === 'deck' || g.layer === 'tunnel' || g.kind === 'boardwalk' ? 0 : 0.5 * s, fx = c.focus;
            if (!q) { const dx = fx[0] - w[0], dz = fx[2] - w[2], l = Math.hypot(dx, dz) || 1, q2 = allowed > 0 ? G.at(w[0] + dx / l * (allowed + 0.02 * s), w[2] + dz / l * (allowed + 0.02 * s), { y: g.y }) : null; if (allowed <= 0 || !q2 || Math.abs(q2.y - g.y) >= 3 * s) o5.horiz++; }
            if (g.kind === 'alley' || g.kind === 'walkway') { const d = Math.hypot(cam[0] - focusD[0], cam[1] - focusD[1], cam[2] - focusD[2]) / (s * sc.v); o5.narrowMin = Math.min(o5.narrowMin, d); if (d < 1.2 - 1e-3) o5.narrow++; }
            if (g.layer === 'tunnel' && q && q.layer === 'tunnel') { const o = Math.abs(q.offset || 0), h = (w[1] - q.y) / s; if (o > CFG.tunnel.r - CFG.tunnelClear + 2e-3 || h > CFG.tunnel.wall + Math.sqrt(Math.max(0, (CFG.tunnel.r - CFG.tunnelClear) ** 2 - o * o)) + 2e-3) o5.tunnel++; }
            if (k % 15 === 0) { o5.rays++; const hit = SR.sight(u, c.focus, w, focusD, cam, s); if (hit) { o5.hits++; if (o5.what.length < 8) o5.what.push(`${hit.name} @${hit.d.toFixed(2)}/${hit.len.toFixed(2)} ${g.kind} ${g.line} (${g.x.toFixed(1)}, ${g.z.toFixed(1)})`); }
              const upc = RV.upAt(w[0], w[2], u), dn = SR.down(u, w, cam, upc, 0, 3 * s * sc.v, false); if (dn) { o5.down++; const cl = dn.d / (s * sc.v); o5.downMin = Math.min(o5.downMin, cl); if (cl < 0.12 - 1e-3) o5.downLow++; } }
          }
        };
        const orig = S.ride.step; S.ride.step = (d, input) => { const res = orig(d, input); hook(); return res; };
        let drv; try { drv = window.__RT.drive(rt.id, P, Lc, ev); } finally { S.ride.step = orig; }
        if (u !== 1) { T.auto = true; }
        return { reached: drv.reached, steps: drv.steps, o4: do4 ? o4 : null, o5: do5 ? { ...o5, narrowMin: o5.narrowMin === Infinity ? null : o5.narrowMin, downMin: o5.downMin === Infinity ? null : o5.downMin } : null, bent: SR.stats() };
      }, { rt, u, do4, do5 });
      rows.push({ id, u, ...r });
      await page.evaluate(() => window.__SR.clear());
      console.log(`  · ${id} u=${u} ${r.reached ? '到达' : '未到'} ${r.steps} 步${r.o4 ? `；SR4 采样 ${r.o4.n}` : ''}${r.o5 ? `；SR5 射线 ${r.o5.rays} 命中 ${r.o5.hits}` : ''}`);
    }
  }
  // the settings back to the flat map
  await page.evaluate(() => { const S = window.__scene, T = S.transition; T.auto = true; if (T.mode !== 'flat') S.view.set({ mapMode: 'flat' }); let k = 0; while (T.animating && k++ < 400) window.__step(1); window.__step(5); });
  if (want('SR4')) {
    const r4 = rows.filter(q => q.o4), road = Math.max(0, ...r4.map(q => (q.o4.cls.road || { worst: 0 }).worst)), miss = r4.reduce((a, q) => a + Object.values(q.o4.cls).reduce((b, c) => b + c.miss, 0), 0);
    const apart = {}; for (const q of r4) for (const [k, v] of Object.entries(q.o4.cls)) if (k !== 'road') { apart[k] = apart[k] || { n: 0, worst: 0 }; apart[k].n += v.n; apart[k].worst = Math.max(apart[k].worst, v.worst); }
    const sp = Math.max(...r4.map(q => q.o4.speed.worst)), bs = Math.max(...r4.map(q => q.o4.base.worst)), cm = Math.max(...r4.map(q => q.o4.cam.worst)), ft = Math.max(...r4.map(q => q.o4.foot.worst)), pt = Math.max(...r4.map(q => q.o4.pitch.worst));
    const disp = Math.max(0, ...r4.map(q => Math.max(0, ...Object.values(q.o4.cls).map(v => v.disp || 0)))), fd = Math.max(0, ...r4.map(q => q.o4.footDisp || 0)), fa = Math.max(0, ...r4.map(q => (q.o4.footApart || { worst: 0 }).worst));
    // W9b's criterion is what the display adds (the gap less the same rider's gap drawn flat, K2's 0.01 m); the absolute gaps include the flat drawing's own (W10f meshes
    // against the sampler, unify_check U7) and are listed, a road gap over 0.01 m with it, as a baseline item
    const ok = r4.every(q => q.reached) && disp <= 0.01 && sp <= 0.02 && bs <= 0.02 && cm <= 0.02 && fd <= 0.01 && pt <= 0.01;
    check('SR4', ok, `前后轮离实际显示路面：显示引入（与同一时刻平面绘制之差）最大 ${f(disp, 4)} m（≤ 0.01，真实米），含平面绘制自身的绝对差最大 ${f(road, 4)} m${road > 0.01 ? '（超过 0.01 处为平面既有，单列）' : ''}；球面显示速度比例误差 ${f(sp * 100, 2)}%、轮距 ${f(bs * 100, 2)}%、镜头距离 ${f(cm * 100, 2)}%（按 ride_view.js 换算式，≤ 2%）；停车脚显示引入 ${f(fd, 4)} m（≤ 0.01；路面类绝对 ${f(ft, 3)} m，平面同值）；显示引入的两轮差合成俯仰 ${f(pt, 4)} rad（≤ 0.01）`,
      [...r4.map(q => `${q.id} u=${q.u} ${q.reached ? '到达' : '未到'}：采样 ${q.o4.n}，${Object.entries(q.o4.cls).map(([k, v]) => `${k} ${v.n} 轮次最大 ${f(v.worst, 4)} m（显示引入 ${f(v.disp, 4)}）${v.miss ? `（下方无可走面网格 ${v.miss}）` : ''}`).join('、')}；速度 ${q.o4.speed.n} 次（${f(q.o4.speed.worst * 100, 2)}%）、轮距 ${q.o4.base.n}（${f(q.o4.base.worst * 100, 2)}%）、镜头 ${q.o4.cam.n}（${f(q.o4.cam.worst * 100, 2)}%）、脚 ${q.o4.foot.n}（${f(q.o4.foot.worst, 3)} m）${q.o4.footApart ? `、木板/台阶/场地上的脚另计 ${q.o4.footApart.n} 次最大 ${f(q.o4.footApart.worst, 3)} m` : ''}`),
        `另判（K2 同口径）：${Object.entries(apart).map(([k, v]) => `${k} ${v.n} 次最大 ${f(v.worst, 4)} m`).join('、') || '无'}；未找到显示面的轮次 ${miss}（栈道木板缝、地标场地，不计）`, `路面类最大处：${JSON.stringify(r4.map(q => q.o4.worst).filter(Boolean).sort((a, b) => b.gap - a.gap)[0] || null)}`,
        `换算式：显示长度 = 真实米 × s × 比例；比例 竖直 (1 − u) + u·sb、水平 (1 − u) + u·sb·(R + y·sb)/R，sb = 1/cosh(z/R)（ride_view.js scale）；城外 s = 1/sb，球面上 1 真实米画作 (R + 海拔 − 1.6)/R`], rows.filter(q => q.o4).map(q => ({ id: q.id, u: q.u, ...q.o4 })));
  }
  if (want('SR5')) {
    const r5 = rows.filter(q => q.o5), ok = r5.every(q => q.reached && q.o5.inside === 0 && q.o5.low === 0 && q.o5.horiz === 0 && q.o5.narrow === 0 && q.o5.tunnel === 0 && q.o5.hits === 0 && q.o5.downLow === 0 && q.o5.inv === 0);
    check('SR5', ok, `显示几何镜头：${r5.length} 段 ${r5.reduce((a, q) => a + q.o5.steps, 0)} 步、显示视线射线 ${r5.reduce((a, q) => a + q.o5.rays, 0)} 条命中 ${r5.reduce((a, q) => a + q.o5.hits, 0)}`,
      r5.map(q => `${q.id} u=${q.u}${q.reached ? '' : '（未走通）'} ${q.o5.steps} 步：在遮挡体内 ${q.o5.inside}、离面 < 0.12 m ${q.o5.low}、超出水平约束 ${q.o5.horiz}、窄处 < 1.2 m ${q.o5.narrow}（最近 ${f(q.o5.narrowMin, 3)} m）、隧道越限 ${q.o5.tunnel}、反解失败 ${q.o5.inv}；显示视线射线 ${q.o5.rays} 命中 ${q.o5.hits}${q.o5.what.length ? ' ' + JSON.stringify(q.o5.what) : ''}；向下射线 ${q.o5.down} 条最近 ${f(q.o5.downMin, 3)} m（< 0.12 ${q.o5.downLow}）；显示层收近 ${q.o5.pulled} 步、抬高 ${q.o5.lifted} 步`), rows.filter(q => q.o5).map(q => ({ id: q.id, u: q.u, ...q.o5 })));
  }
}

// ---- SR7: the weather on both maps and through the switch
if (want('SR7')) {
  const r = await page.evaluate(() => {
    const S = window.__scene, T = S.transition, Wx = S.weather, out = { flat: null, frames: [], sphere: [], back: null, snow: null };
    const W0 = window.WORLD, lonLat = (x, z) => { const ll = W0.townToLonLat(x, z); ll.lon = ((ll.lon + 180) % 360 + 360) % 360 - 180; return ll; };
    const look = () => { const g = Wx.get(), gn = Wx.gains(); return { u: S.bend.get(), dry: gn.dry, wl: g.wLocal, rain: g.rainAtTarget, fog: g.fogAdd, rainVis: S.rain.obj.visible, rainShown: S.rain.shown(), snow: !!(Wx.snow() && Wx.snow().o.visible), day: !!(S.day.state.last && S.day.state.active !== undefined) && S.bend.get() > 0, dayU: S.day.state.last ? S.day.state.last.u : null, lon: g.lon, lat: g.lat, time: g.time, h: g.h, d: g.d }; };
    Wx.lock('rain');
    if (T.mode !== 'flat') S.view.set({ mapMode: 'flat' }); let k = 0; while (T.animating && k++ < 400) window.__step(1);
    if (S.view.get().mode !== 'roam') S.view.set({ mode: 'roam' }); S.ride.set({ x: -7, z: 16.75, heading: -Math.PI / 2 }); window.__step(80);
    out.flat = look();
    document.getElementById('map-mode-toggle').click();
    for (let i = 0; i < 135; i++) { S.ride.hold({ throttle: 0.4, steer: 0 }); window.__step(1); out.frames.push(look()); }
    S.ride.hold(null);
    const api = S.ride.api(); api.zoom(0.1); window.__step(40); out.sphere.push({ dist: api.state.dist, ...look() }); api.zoom(10); window.__step(40); out.sphere.push({ dist: api.state.dist, ...look() });
    // ride on 20 m on the sphere, then back to the flat map: the weather at the rider's place then
    const x0 = S.ride.get().x; k = 0; while (Math.abs(S.ride.get().x - x0) < 20 && k++ < 900) { S.ride.hold({ throttle: 1, steer: 0 }); window.__step(1); } S.ride.hold(null);
    document.getElementById('map-mode-toggle').click(); const t0 = Wx.get().time, times = []; for (let i = 0; i < 135; i++) { window.__step(1); times.push(Wx.get().time); out.frames.push(look()); }
    const g = S.ride.get(), ll = lonLat(g.x, g.z); out.back = { ...look(), rider: [ll.lon, ll.lat], spawn: S.ride.get().spawn, t0, dts: times.slice(1).map((t, i) => t - times[i]) };
    // snow on the sphere (LM07, the snow road)
    Wx.lock('snow'); const G = S.ground, ln = G.lines.find(l => l.id === 'RN10-RD08'), a = ln.point(ln.length - 6, 0), b = ln.point(ln.length - 5.5, 0); S.ride.set({ x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z) }); window.__step(30); const flatSnow = look();
    document.getElementById('map-mode-toggle').click(); k = 0; while (T.animating && k++ < 400) window.__step(1); window.__step(20); out.snow = { flat: flatSnow, sphere: look() };
    document.getElementById('map-mode-toggle').click(); k = 0; while (T.animating && k++ < 400) window.__step(1); window.__step(5);
    Wx.lock(null);
    return out;
  });
  const fr = r.frames, cont = fr.slice(1).every((q, i) => Math.abs(q.dry - (1 - q.u)) < 1e-9 && Math.abs(q.dry - fr[i].dry) < 0.05), sph = r.sphere.every(q => q.u === 1 && q.dry === 0 && q.rain === 0 && q.fog === 0 && !q.rainVis && !q.snow && q.dayU === 1);
  const dts = r.back.dts, tOk = dts.every(d => d > 0 && d < 0.13), placeOk = Math.abs(r.back.lon - r.back.rider[0]) < 1e-9 && Math.abs(r.back.lat - r.back.rider[1]) < 1e-9 && r.back.u === 0 && r.back.dry === 1;
  const snowOk = r.snow.flat.snow && !r.snow.sphere.snow && r.snow.sphere.dry === 0;
  const ok = r.flat.rain > 0 && r.flat.rainVis && cont && sph && tOk && placeOk && snowOk;
  check('SR7', ok, `天气：平面雨 ${f(r.flat.rain, 2)}、雨丝 ${r.flat.rainVis}；切换中 dry = 1 − u 且逐帧连续 ${cont}；球形近/远（跟随 ${r.sphere.map(q => f(q.dist, 1)).join('/')} m）雨 ${r.sphere.map(q => q.rain).join('/')}、雾 ${r.sphere.map(q => q.fog).join('/')}、雨丝 ${r.sphere.map(q => q.rainVis).join('/')}、雪 ${r.sphere.map(q => q.snow).join('/')}、日光 u ${r.sphere.map(q => q.dayU).join('/')}`,
    [`回到平面：天气查询位置 (${f(r.back.lon, 4)}, ${f(r.back.lat, 4)}) = 骑手当前 (${f(r.back.rider[0], 4)}, ${f(r.back.rider[1], 4)})：${placeOk}；天气时间逐帧增量 ${f(Math.min(...dts), 4)}–${f(Math.max(...dts), 4)} s（不清零、不重复）`, `LM07 雪：平面雪层 ${r.snow.flat.snow}、球形 ${r.snow.sphere.snow}（dry ${r.snow.sphere.dry}）`, `骑行 h / d（平面）${f(r.flat.h, 2)} / ${f(r.flat.d, 2)}，球形 ${r.sphere.map(q => `${f(q.h, 2)} / ${f(q.d, 2)}`).join('、')}`], { flat: r.flat, sphere: r.sphere, back: { ...r.back, dts: undefined } });
}

// ---- SR8: spawns on the sphere, leaving at the rider's place, leaving mid-switch
if (want('SR8')) {
  const r = await page.evaluate(({ probes }) => {
    const S = window.__scene, T = S.transition, G = S.ground, RT = window.__RT, SR = window.__SR, RV = S.ride.view(), W = window.WORLD, out = { spawns: [], exits: [], mid: null, again: null };
    const settle = map => { if (T.mode !== map) S.view.set({ mapMode: map }); let k = 0; while (T.animating && k++ < 400) window.__step(1); };
    const tgtOf = pr => { if (pr.target) return pr.target; if (pr.lonLat) return RT.flat(pr.lonLat[0], pr.lonLat[1]); const id = pr.edge || W.roadNetwork.edges.find(e => (e.from === pr.node[0] && e.to === pr.node[1]) || (e.to === pr.node[0] && e.from === pr.node[1])).id, ln = RT.lineOf(id), [s0, s1] = RT.range(ln, id), st = pr.s === 'mid' ? (s0 + s1) / 2 : s0 + pr.s, p = ln.point(st, 0); return [p.x, p.z]; };
    for (const pr of probes) {
      const tg = tgtOf(pr), view = { target: [tg[0], 1.2, tg[1]], yaw: pr.yaw ?? 2.5, pitch: 0.5, dist: 34 }, res = { id: pr.id, what: pr.what };
      for (const map of ['flat', 'sphere']) {
        S.view.set({ mode: 'free' }); settle(map); S.view.set(view); window.__step(2); S.view.set({ mode: 'roam' }); const v = S.view.get(), g = S.ride.get();
        res[map] = v.roam ? { x: g.x, z: g.z, layer: g.layer, line: g.line, heading: g.heading } : null;
      }
      S.view.set({ mode: 'free' });
      res.same = !!(res.flat && res.sphere) && Math.abs(SR.wdx(res.flat.x - res.sphere.x)) < 1e-6 && Math.abs(res.flat.z - res.sphere.z) < 1e-6 && res.flat.layer === res.sphere.layer && res.flat.line === res.sphere.line && Math.abs(SR.wpi(res.flat.heading - res.sphere.heading)) < 1e-6;
      out.spawns.push(res);
    }
    // leaving at the rider's place: the town, the RN01-03 deck, the RN01-05 tunnel; on both maps
    const places = [['城镇 R01', () => ({ x: -12, z: 16.75, heading: -Math.PI / 2 })], ['RN01-03 桥面', () => { const ln = G.lines.find(l => l.id === 'RN01-03'), a = ln.point(ln.length / 2, -1.75), b = ln.point(ln.length / 2 + 0.5, -1.75); return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), layer: 'deck' }; }],
      ['RN01-05 隧道中段', () => { const ln = G.lines.find(l => l.tunnel), s = (ln.tunnel[0] + ln.tunnel[1]) / 2, a = ln.point(s, -1.75), b = ln.point(s + 0.5, -1.75); return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), layer: 'tunnel' }; }],
      ['RN01-05 隧道口内 3 m', () => { const ln = G.lines.find(l => l.tunnel), s = ln.tunnel[0] + 3, a = ln.point(s, -1.75), b = ln.point(s + 0.5, -1.75); return { x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), layer: 'tunnel' }; }]];
    for (const [name, at] of places) for (const map of ['flat', 'sphere']) {
      S.view.set({ mode: 'free' }); settle(map); if (S.view.get().mode !== 'roam') S.view.set({ mode: 'roam' }); S.ride.set(at()); window.__step(80);
      const g = S.ride.get(), focusY = g.root + S.ride.cfg.focus * g.s; S.view.set({ mode: 'free' });
      const v = S.view.get(), info = S.ride.exitInfo(), look = S.transition.lookTarget(0); window.__step(75);
      const u = S.bend.get(), cam = S.camera.position.toArray(), lookD = RV.point(look, u), w = RV.inverse(cam, u, look), hit = w ? SR.sight(u, look, w, lookD, cam, g.s) : { name: 'no inverse' };
      const qc = w ? G.at(w[0], w[2], { y: w[1] }) : null, inBore = !!(qc && qc.layer === 'tunnel' && Math.abs(qc.offset || 0) < 4.7 && w[1] - qc.y > 0 && w[1] - qc.y < 5.7 * qc.s);
      out.exits.push({ name, map, mode: v.mode, mapMode: v.mapMode, at: [Math.abs(SR.wdx(v.target[0] - g.x)) < 1e-9, Math.abs(v.target[2] - g.z) < 1e-9], lookY: look[1], focusY, layer: g.layer, info, dist: v.dist, clear: !hit, hit: hit ? hit.name : null, inBore, blend: S.ride.blend() });
    }
    // leaving mid-switch with W held, then at once again: no jump back, no input left
    S.view.set({ mode: 'free' }); settle('flat'); S.view.set({ target: [-7, 1.2, 20], yaw: 2.5, pitch: 0.5, dist: 34 }); window.__step(2); S.view.set({ mode: 'roam' }); window.__step(70);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' })); window.__step(60);
    document.getElementById('map-mode-toggle').click(); window.__step(30); const g1 = S.ride.get();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' })); window.dispatchEvent(new KeyboardEvent('keyup', { key: 'v' })); window.__step(1);
    const v1 = S.view.get(), anim = T.animating, inp = S.ride.input(); window.__step(110); const v2 = S.view.get();
    out.mid = { mode: v1.mode, anim, goal: T.mode, u: S.bend.get(), at: Math.abs(SR.wdx(v1.target[0] - g1.x)) < 0.2 && Math.abs(v1.target[2] - g1.z) < 0.2, kept: Math.abs(v2.target[0] - v1.target[0]) < 1e-9 && Math.abs(v2.target[2] - v1.target[2]) < 1e-9, input: inp, keys: v1.input };
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
    // at once again: V twice (leave, enter) within two frames, on the sphere
    S.view.set({ mode: 'roam' }); window.__step(30); const g2 = S.ride.get(); S.view.set({ mode: 'free' }); window.__step(1); S.view.set({ mode: 'roam' }); window.__step(1); const g3 = S.ride.get();
    out.again = { mode: S.view.get().mode, map: T.mode, d: Math.hypot(SR.wdx(g3.x - g2.x), g3.z - g2.z) / g2.s, line: [g2.line, g3.line] };
    S.view.set({ mode: 'free' }); settle('flat');
    return out;
  }, { probes: SPAWN_PROBES.filter(p => ['RS-01', 'RS-04', 'RS-06', 'RS-07', 'RS-09', 'RS-10', 'RS-12', 'RS-13'].includes(p.id)) });
  const sp = r.spawns, ex = r.exits, m = r.mid, a = r.again;
  const exOk = ex.every(q => q.mode === 'free' && q.mapMode === q.map && q.at[0] && q.at[1] && Math.abs(q.lookY - q.focusY) < 1e-6 && q.clear && q.info && q.info.clear && q.dist >= 9 && (q.layer !== 'tunnel' || q.info.level === 'tunnel') && (q.layer !== 'deck' || q.info.level === 'deck'));
  const midOk = m.mode === 'free' && m.anim && m.goal === 'sphere' && m.u === 1 && m.at && m.kept && m.input.throttle === 0 && m.input.steer === 0 && m.keys[0] === 0 && m.keys[1] === 0;
  const againOk = a.mode === 'roam' && a.map === 'sphere' && a.d < 1;
  const ok = sp.every(q => q.same) && exOk && midOk && againOk;
  check('SR8', ok, `出生：球形与平面同一目标 ${sp.filter(q => q.same).length}/${sp.length} 相同；退出 ${ex.filter(q => q.clear && q.info && q.info.clear).length}/${ex.length} 处在当前位置且自由镜头无遮挡；切换中退出 ${midOk}；立即再进入 ${againOk}`,
    [...sp.map(q => `${q.same ? 'PASS' : 'FAIL'} ${q.id} ${q.what}：平面 ${q.flat ? `(${f(q.flat.x, 2)}, ${f(q.flat.z, 2)}) ${q.flat.layer} ${q.flat.line} 航向 ${f(q.flat.heading, 3)}` : '无'}；球形 ${q.sphere ? `(${f(q.sphere.x, 2)}, ${f(q.sphere.z, 2)}) ${q.sphere.layer} ${q.sphere.line} 航向 ${f(q.sphere.heading, 3)}` : '无'}`),
      ...ex.map(q => `${q.mode === 'free' && q.clear && q.info && q.info.clear ? 'PASS' : 'FAIL'} 退出 ${q.name}（${q.map}）：目标在骑手处 ${q.at.join('/')}，看点高度 ${f(q.lookY, 3)} = 焦点 ${f(q.focusY, 3)}（层 ${q.layer}，锚定 ${q.info && q.info.level}），距离 ${f(q.dist, 1)}，候选 ${q.info && q.info.tried} 个中第一个无遮挡 ${q.info && q.info.clear}（yaw ${f(q.info && q.info.yaw, 3)}、pitch ${f(q.info && q.info.pitch, 3)}），交接后显示视线 ${q.clear ? '无遮挡' : '被 ' + q.hit + ' 挡'}${q.layer === 'tunnel' ? `，镜头在洞内 ${q.inBore}` : ''}`),
      `切换中退出：${m.mode}，地图继续 ${m.anim} → ${m.goal} u=${m.u}，目标在骑手处 ${m.at}、之后不变 ${m.kept}，骑行输入 ${JSON.stringify(m.input)}、自由移动输入 ${JSON.stringify(m.keys)}`, `立即再操作（退出后下一帧再进入，球形）：${a.mode}/${a.map}，出生离退出处 ${f(a.d, 3)} m（${a.line.join(' → ')}）`], r);
}

// ---- SR2: the same start, dt and input with and without switches (two fresh deterministic pages)
if (want('SR2')) {
  const seq = async (clicks, label) => {
    const pg = await open(); await pg.evaluate(kit);
    const rt = ROUTES.find(q => q.id === 'RT-01');
    const r = await pg.evaluate(({ rt, clicks }) => {
      const S = window.__scene, SR = window.__SR, out = {};
      const runs = { town: { rt }, tunnel: { line: (() => { const ln = S.ground.lines.find(l => l.tunnel); return [ln.id, Math.max(0.5, ln.tunnel[0] - 6), ln.tunnel[1] + 6, -1.75]; })() } };
      for (const [name, def] of Object.entries(runs)) {
        const path = def.rt ? window.__RT.routePath(def.rt) : SR.linePath(...def.line), P = path.P;
        if (S.view.get().mode !== 'roam') S.view.set({ mode: 'roam' });
        const h0 = Math.atan2(SR.wdx(P[1][0] - P[0][0]), P[1][1] - P[0][1]); S.ride.set({ x: S.ground.wrap(P[0][0]), z: P[0][1], heading: h0, layer: def.line ? 'ground' : undefined }); window.__step(1); S.ride.set({ x: S.ground.wrap(P[0][0]), z: P[0][1], heading: h0, layer: def.line ? 'ground' : undefined });
        const rec = [];
        for (let i = 0; i < 420; i++) {
          if (clicks.includes(i)) document.getElementById('map-mode-toggle').click();
          S.ride.hold(SR.pursue(path)); window.__step(1);
          const g = S.ride.get(), rd = S.ride.rider(), wx = S.weather.get();
          rec.push([g.x, g.z, g.heading, g.speed, g.layer, g.mode, g.carry, g.wraps, rd.wheel, rd.crank, rd.gear, rd.lean, rd.steer, rd.pitch, rd.stopK, rd.pushK, S.bend.get(), wx ? wx.time : null]);
        }
        S.ride.hold(null); out[name] = rec;
        // the map back to flat between the runs: the same 130 frames on both pages
        if (S.transition.mode !== 'flat') S.view.set({ mapMode: 'flat' }); window.__step(130);
      }
      return out;
    }, { rt, clicks });
    await pg.close(); console.log(`  · SR2 ${label} 完成`); return r;
  };
  const A = await seq([], '不切图'), B = await seq([60, 100, 250], '切图 3 次（含第 100 帧中途反向）');
  const lines = [], data = {}; let ok = true;
  for (const name of Object.keys(A)) {
    const a = A[name], b = B[name], PER = 2 * Math.PI * 90; let dx = 0, dz = 0, dh = 0, dv = 0, cat = 0, anim = 0, wt = 0, uMax = 0;
    // the rider's accumulators (wheel, crank: from the run's first frame; gear, lean, bars, stop and push weights) must agree; its drawn pitch differs by the drawn surface's
    // depth under the wheels (ride_view.js surfaces, 0 on the flat map), listed apart; the weather clock from the run's first frame
    let pitch = 0; const a0 = a[0], b0 = b[0];
    for (let i = 0; i < a.length; i++) { const p = a[i], q = b[i]; dx = Math.max(dx, Math.abs(((p[0] - q[0]) % PER + 1.5 * PER) % PER - 0.5 * PER)); dz = Math.max(dz, Math.abs(p[1] - q[1])); dh = Math.max(dh, Math.abs(Math.atan2(Math.sin(p[2] - q[2]), Math.cos(p[2] - q[2])))); dv = Math.max(dv, Math.abs(p[3] - q[3]));
      if (p[4] !== q[4] || p[5] !== q[5] || p[6] !== q[6] || p[7] !== q[7]) cat++;
      for (const k of [8, 9]) anim = Math.max(anim, Math.abs((p[k] - a0[k]) - (q[k] - b0[k]))); for (const k of [10, 11, 12, 14, 15]) anim = Math.max(anim, Math.abs(p[k] - q[k])); pitch = Math.max(pitch, Math.abs(p[13] - q[13]));
      if (p[17] !== null) wt = Math.max(wt, Math.abs((p[17] - a0[17]) - (q[17] - b0[17]))); uMax = Math.max(uMax, q[16]); }
    const pass = dx <= 1e-6 && dz <= 1e-6 && dh <= 1e-6 && dv <= 1e-6 && cat === 0 && anim <= 1e-6 && wt <= 1e-9 && uMax > 0.99 && pitch <= 0.02;
    if (!pass) ok = false; const last = a[a.length - 1];
    lines.push(`${pass ? 'PASS' : 'FAIL'} ${name}（${a.length} 帧 dt 1/60 s，切图那一组 u 最大 ${f(uMax, 3)}）：位置差 x ${dx.toExponential(1)}（按周期）、z ${dz.toExponential(1)}，航向 ${dh.toExponential(1)}，速度 ${dv.toExponential(1)}；层/推车/接缝不一致 ${cat} 帧；主体动画累计量（轮角与曲柄的增量、档、倾、把、停车、推车）最大差 ${anim.toExponential(1)}；显示俯仰差 ${f(pitch, 4)} rad（贴面下压，平面为 0）；天气时间增量差 ${wt.toExponential(1)}；终点 (${f(last[0], 2)}, ${f(last[1], 2)}) ${last[4]} 速度 ${f(last[3], 2)}`);
    data[name] = { frames: a.length, dx, dz, dh, dv, cat, anim, pitch, wt, uMax };
  }
  check('SR2', ok, '同初态、同 dt 与输入：切图与不切图的逻辑轨迹与动画累计量一致（≤ 1e-6）', lines, data);
}
await page.close();

// ================================================================ SR6: real input events on the sphere (live frames)
if (want('SR6')) {
  const rows = [], add = (name, ok) => rows.push([name, ok]);
  const p = await open({ init: false });
  const get = () => p.evaluate(() => ({ v: window.__scene.view.get(), r: window.__scene.ride.get(), input: window.__scene.ride.input(), sc: window.__scene.sphereCamera.state(), u: window.__scene.bend.get() }));
  const until = async (fn, ms, arg) => { try { await p.waitForFunction(fn, arg, { timeout: ms, polling: 16 }); return true; } catch { return false; } };
  await p.evaluate(() => window.__scene.view.set({ mode: 'free', target: [-7, 1.2, 20], yaw: 2.5, pitch: 0.5, dist: 34 })); await p.click('#map-mode-toggle'); await until(() => window.__scene.bend.get() === 1 && !window.__scene.transition.animating, 8000);
  await p.keyboard.press('v'); await p.waitForTimeout(300); let s = await get();
  add(`球形按 V 直接进入骑行（${s.v.mode}/${s.v.mapMode}）`, s.v.mode === 'roam' && s.v.mapMode === 'sphere');
  const sc0 = s.sc;
  await p.keyboard.down('w'); await p.waitForTimeout(4000); s = await get(); add(`按 W 4 s 后速度 4.2 ± 0.1 m/s（${f(s.r.speed, 2)}）`, Math.abs(s.r.speed - 4.2) <= 0.1); await p.keyboard.up('w');
  await p.keyboard.down('s'); const t0 = Date.now(); const stopped = await until(() => window.__scene.ride.get().speed <= 0.001, 2500); const tStop = (Date.now() - t0) / 1000; await p.waitForTimeout(1500); const rev = (await get()).r.speed; await p.keyboard.up('s');
  add(`按 S ${f(tStop, 2)} s 停住（≤ 1.6），继续按倒推 ${f(rev, 2)} m/s`, stopped && tStop <= 1.6 && rev < -0.05 && rev >= -0.8 - 1e-6);
  await until(() => Math.abs(window.__scene.ride.get().speed) < 0.01, 3000);
  await p.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2, speed: 2.0 })); await p.keyboard.down('w'); await p.waitForTimeout(150); let h0 = (await get()).r.heading; await p.keyboard.down('a'); await p.waitForTimeout(450); await p.keyboard.up('a'); let h1 = (await get()).r.heading;
  await p.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2, speed: 2.0 })); await p.waitForTimeout(150); let h2 = (await get()).r.heading; await p.keyboard.down('d'); await p.waitForTimeout(450); await p.keyboard.up('d'); let h3 = (await get()).r.heading; await p.keyboard.up('w');
  add(`A 左转、D 右转（${f(h1 - h0, 3)} / ${f(h3 - h2, 3)} rad）`, h1 - h0 > 0.05 && h3 - h2 < -0.05);
  await until(() => Math.abs(window.__scene.ride.get().speed) < 0.01, 4000);
  await p.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2 })); await p.waitForTimeout(100); const a = (await get()).r;
  await p.mouse.move(640, 400); await p.mouse.down(); const midDrag = []; for (let i = 1; i <= 10; i++) { await p.mouse.move(640 + i * 126, 400); if (i === 5) midDrag.push(await get()); } await p.mouse.up(); const b = (await get());
  add(`拖动 1260 px 环视 ${f(b.r.lookYaw - a.lookYaw, 2)} rad（≥ 2π = 360°）、航向不变 ${f(Math.abs(b.r.heading - a.heading), 5)}；星球抓取未启动（拖动中 ${midDrag[0].sc.dragging}），星球朝向不变`, b.r.lookYaw - a.lookYaw >= 2 * Math.PI - 0.01 && Math.abs(b.r.heading - a.heading) < 1e-3 && !midDrag[0].sc.dragging && !b.sc.dragging && b.sc.normal.every((v, i) => Math.abs(v - sc0.normal[i]) < 1e-9));
  await p.keyboard.press('c'); await p.waitForTimeout(600); const rc = (await get()).r.lookYaw;
  await p.mouse.move(640, 400); await p.mouse.down(); await p.mouse.move(800, 380, { steps: 4 }); await p.mouse.up(); await p.mouse.dblclick(640, 400); await p.waitForTimeout(600); const rd = (await get()).r.lookYaw;
  add(`C 与双击回正（${f(rc, 4)} / ${f(rd, 4)}）`, Math.abs(rc) < 1e-3 && Math.abs(rd) < 1e-3);
  await p.mouse.move(640, 400); await p.mouse.wheel(0, 4000); await p.waitForTimeout(150); const dMax = (await get()).r.dist; await p.mouse.wheel(0, -8000); await p.waitForTimeout(150); const dMin = (await get()).r.dist; const zs = await get();
  add(`滚轮只调跟随距离 [2.5, 6]（${f(dMax, 2)} / ${f(dMin, 2)}），自由视角距离不变（${zs.v.dist}）`, Math.abs(dMax - 6) < 1e-9 && Math.abs(dMin - 2.5) < 1e-9);
  await p.keyboard.down('w'); await p.waitForTimeout(200); await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.waitForTimeout(100); s = await get(); await p.keyboard.up('w');
  add(`失焦清空输入（${s.input.throttle} / ${s.input.steer}）`, s.input.throttle === 0 && s.input.steer === 0);
  await p.keyboard.down('d'); await p.mouse.move(600, 400); await p.mouse.down(); await p.mouse.move(640, 400, { steps: 3 }); await p.waitForTimeout(100);
  await p.evaluate(() => { const c = window.__scene.renderer.domElement; c.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true })); window.dispatchEvent(new Event('blur')); }); await p.waitForTimeout(100); s = await get(); await p.mouse.up(); await p.keyboard.up('d');
  add(`指针取消与失焦后无残留输入、星球抓取未启动（${s.input.throttle} / ${s.input.steer}，${s.sc.dragging}）`, s.input.throttle === 0 && s.input.steer === 0 && !s.sc.dragging);
  await p.close();
  // touch: the stick, a one-finger look, a pinch, the finger left on the screen after a pinch, a double tap; never the sphere's grab
  const tp = await open({ init: false, touch: true });
  const tget = () => tp.evaluate(() => ({ v: window.__scene.view.get(), r: window.__scene.ride.get(), input: window.__scene.ride.input(), sc: window.__scene.sphereCamera.state() }));
  await tp.evaluate(() => window.__scene.view.set({ mode: 'free', target: [-7, 1.2, 20], yaw: 2.5, pitch: 0.5, dist: 34 }));
  const mb = await tp.locator('#map-mode-toggle').boundingBox(); await tp.touchscreen.tap(mb.x + mb.width / 2, mb.y + mb.height / 2); await tp.waitForFunction(() => window.__scene.bend.get() === 1 && !window.__scene.transition.animating, null, { timeout: 8000 }).catch(() => {});
  const tb = await tp.locator('#town-view-toggle').boundingBox(); await tp.touchscreen.tap(tb.x + tb.width / 2, tb.y + tb.height / 2); await tp.waitForTimeout(300); let ts = await tget();
  add(`触屏按钮在球形进入骑行（${ts.v.mode}/${ts.v.mapMode}）`, ts.v.mode === 'roam' && ts.v.mapMode === 'sphere');
  const cdp = await tp.context().newCDPSession(tp), touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ id: q.id ?? i + 1, x: q.x, y: q.y, radiusX: 6, radiusY: 6, force: 1 })) });
  const sb = await tp.locator('#town-walk-stick').boundingBox(), sc0t = ts.sc;
  if (sb) { const cx = sb.x + sb.width / 2, cy = sb.y + sb.height / 2; await tp.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2 })); await touch('touchStart', [{ x: cx, y: cy }]); await touch('touchMove', [{ x: cx, y: cy - 45 }]); await tp.waitForTimeout(2000); const v2 = (await tget()).r; await touch('touchEnd', []);
    add(`球形摇杆向上推满 2 s 速度 ${f(v2.speed, 2)} m/s（3.0 ± 5%）`, Math.abs(v2.speed - 3.0) / 3.0 <= 0.05); } else add('触屏摇杆可见', false);
  await tp.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2 })); ts = await tget();
  const ly0 = ts.r.lookYaw, hh0 = ts.r.heading; await touch('touchStart', [{ x: 250, y: 400 }]); for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: 250 + i * 15, y: 400 }]); const tmid = await tget(); await touch('touchEnd', []); ts = await tget();
  add(`单指拖动环视 ${f(ts.r.lookYaw - ly0, 3)} rad、航向不变，星球抓取未启动（${tmid.sc.dragging}）`, ts.r.lookYaw - ly0 > 0.2 && Math.abs(ts.r.heading - hh0) < 1e-3 && !tmid.sc.dragging);
  const d0 = ts.r.dist; await tp.evaluate(() => { window.__pids = []; window.__scene.renderer.domElement.addEventListener('pointerdown', e => window.__pids.push(e.pointerId)); });
  await touch('touchStart', [{ id: 1, x: 180, y: 400 }, { id: 2, x: 220, y: 400 }]); for (let i = 1; i <= 6; i++) await touch('touchMove', [{ id: 1, x: 180 - i * 12, y: 400 }, { id: 2, x: 220 + i * 12, y: 400 }]); const dPinch = (await tget()).r.dist;
  // lift one finger (its own pointerup: a CDP move cannot lift one of two touches): the one left goes on as a look drag, not as the sphere's grab
  await tp.evaluate(() => { const c = window.__scene.renderer.domElement, id = window.__pids[window.__pids.length - 1]; c.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, pointerType: 'touch', bubbles: true })); });
  const ly1 = (await tget()).r.lookYaw; for (let i = 1; i <= 4; i++) await touch('touchMove', [{ id: 1, x: 108 + i * 15, y: 400 }, { id: 2, x: 292, y: 400 }]); const left = await tget(); await touch('touchEnd', []); ts = await tget();
  add(`双指捏合调跟随距离（${f(d0, 2)} → ${f(dPinch, 2)}），剩余单指继续环视（${f(left.r.lookYaw - ly1, 3)} rad）且星球抓取未启动（${left.sc.dragging}），星球朝向不变`, dPinch < d0 - 0.2 && dPinch >= 2.5 && left.r.lookYaw - ly1 > 0.1 && !left.sc.dragging && ts.sc.normal.every((v, i) => Math.abs(v - sc0t.normal[i]) < 1e-9));
  await touch('touchStart', [{ x: 250, y: 500 }]); await touch('touchEnd', []); await tp.waitForTimeout(80); await touch('touchStart', [{ x: 252, y: 501 }]); await touch('touchEnd', []); await tp.waitForTimeout(600); ts = await tget();
  add(`双击画面回正（${f(ts.r.lookYaw, 4)}）`, Math.abs(ts.r.lookYaw) < 1e-3);
  await tp.close();
  check('SR6', rows.every(q => q[1]), `球形输入 ${rows.filter(q => q[1]).length}/${rows.length}`, rows.map(q => `${q[1] ? 'PASS' : 'FAIL'} ${q[0]}`));
}

// ================================================================ SR9: stability and performance
if (want('SR9')) {
  const p = await open({ init: false });
  const r = await p.evaluate(() => {
    const S = window.__scene, T = S.transition, out = {};
    S.view.set({ mode: 'roam' });
    const time = (name, x, z, h, layer) => { S.ride.set({ x, z, heading: h, layer }); for (let i = 0; i < 60; i++) S.ride.step(1 / 60, { throttle: 1, steer: 0 });
      const api = S.ride.api(), t0 = performance.now(); for (let i = 0; i < 600; i++) api.step(1 / 60, { throttle: 1, steer: Math.sin(i / 50) * 0.35 }); const logic = (performance.now() - t0) / 600;
      S.ride.set({ x, z, heading: h, layer }); for (let i = 0; i < 60; i++) S.ride.step(1 / 60, { throttle: 1, steer: 0 });
      const t1 = performance.now(); for (let i = 0; i < 600; i++) S.ride.step(1 / 60, { throttle: 1, steer: Math.sin(i / 50) * 0.35 }); const all = (performance.now() - t1) / 600;
      const rd = S.ride.riderApi(), st = api.state, t2 = performance.now(); for (let i = 0; i < 600; i++) rd.update(1 / 60, { x: st.x, root: st.root, z: st.z, heading: st.heading + i * 0.001, speed: 3, mode: 'ride', s: st.s, wheels: [st.yF, st.yB], lookYaw: 0, throttle: 1 }); const anim = (performance.now() - t2) / 600;
      out[name] = { logic: +logic.toFixed(4), all: +all.toFixed(4), anim: +anim.toFixed(4), logicCamera: +(all - anim).toFixed(4) }; };
    const G = S.ground, tn = G.lines.find(l => l.tunnel), c = tn.point(tn.tunnel[0] + 2, -1.75), d = tn.point(tn.tunnel[0] + 2.5, -1.75);
    time('flat town-R01', -7, 16.75, -Math.PI / 2);
    S.view.set({ mapMode: 'sphere' }); return new Promise(res => { const wait = () => { if (T.animating) return setTimeout(wait, 100); time('sphere town-R01', -7, 16.75, -Math.PI / 2); time('sphere tunnel', c.x, c.z, Math.atan2(d.x - c.x, d.z - c.z), 'tunnel'); out.surfaces = S.ride.surfaces(); out.rider = S.ride.rider(); res(out); }; wait(); });
  });
  await p.close();
  const rider = r.rider, lc = Math.max(r['sphere town-R01'].logicCamera, r['sphere tunnel'].logicCamera);
  const ok = rider.drawCalls <= 24 && rider.triangles <= 30000 && rider.drawCalls === R2.calls && rider.triangles === R2.triangles && lc <= 0.5;
  check('SR9', ok, `主体 ${rider.drawCalls} 次绘制、${rider.triangles} 三角形（R2 ${R2.calls} / ${R2.triangles}，预算 24 / 30,000）；骑行逻辑 + 显示镜头每帧：平面 ${r['flat town-R01'].logicCamera} ms，球形城镇 ${r['sphere town-R01'].logicCamera} ms、隧道 ${r['sphere tunnel'].logicCamera} ms（≤ 0.5；主体动画另计 ${r['sphere town-R01'].anim} ms）`,
    [`逐项（ms/帧）：${JSON.stringify({ flat: r['flat town-R01'], sphere: r['sphere town-R01'], tunnel: r['sphere tunnel'] })}`, `可走面显示索引：${JSON.stringify(r.surfaces)}（首次弯曲绘制骑手时建立）`, '帧时间与自由视角绘制调用：tools/ride_perf.mjs --sphere（本检查关闭浏览器后单独运行，结果见下）'], r);
}
await browser.close();
check('errors', !errors.length, errors.length ? errors.slice(0, 5).join(' | ') : '无页面错误');
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(report, null, 1) + '\n');
const bad = results.filter(q => !q[1]);
console.log(`${bad.length ? 'FAIL' : 'PASS'} sphere_ride_check${ONLY ? ' --only ' + ONLY.join(',') : ''} (${results.length - bad.length}/${results.length})；报告 ${path.relative(root, OUT)}`);
// SR9 frame times, run alone after this check's browser is closed (docs/world/w9b/ride-perf-sphere.json)
if (want('SR9') && !argv.includes('--no-perf')) {
  const args = ['tools/ride_perf.mjs', '--sphere', '--out', path.join(root, 'docs/world/w9b/ride-perf-sphere.json'), ...(opt('--ref') ? ['--ref', opt('--ref')] : [])];
  console.log(`INFO 运行 node ${args.join(' ')}`); const pr = spawnSync('node', args, { cwd: root, stdio: 'inherit' }); if (pr.status !== 0) { console.log('FAIL SR9-perf ride_perf 退出码 ' + pr.status); process.exitCode = 1; }
}
process.exitCode = process.exitCode || (bad.length ? 1 : 0);
