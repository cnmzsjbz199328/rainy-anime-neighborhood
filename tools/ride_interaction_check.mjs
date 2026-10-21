// RI-01 / RI-02 (docs/world/RIDE_INTERACTION_FIX_PLAN.md): the ride's way in and out, and the pelican's head against the look round, on the built page (ANGLE Metal,
// as ride_check). Machine results only: no screenshots, nothing judged by eye.
//   node tools/ride_interaction_check.mjs [--only RI1,RI2,RI3] [--json path] [--scan 5] [--sweep 10]
// Deterministic page (road_views.mjs INIT: frames by hand at 1/60 s); real input through Playwright (keyboard, the mouse on the buttons and the canvas) for the ways in
// and out; every V / Esc / C / button action is read at the event by tools/ride_driver.mjs eventLog (before and after the scene's own listener).
//   RI1  spawns: the RI-01 repro (target (191.482, -85), view to the east: yaw -pi/2) and the same target looking west, entered with the button and with V; both ends
//        of every line but the stairs (0 / 0.5 / 3 m beyond the end, -1 / 0 / +1 m across, looking both ways along it), each also entered (ride.enter); a grid over the
//        flat frame (--scan m: x over one turn from the seam, |z| <= 200; four view directions): ground.spawn gives a sample that is the walkable surface of its own line
//        and layer there (the query ride.place makes)
//   RI2  in and out by real input (V, Esc, the button) on both maps at the town, a road outside it, the forest and the open sea far from the network, a deck, inside the
//        tunnel, by the seam, at high latitude and at the RI-01 repro: leaving at rest and riding (W held), entering again at once; leaving during a map switch (V, Esc,
//        the button), entering during one (refused with the hint, the button disabled) and after it. A leave: mode free, the map (the switch's goal), the target at the
//        rider's place at the event, the deck / tunnel level kept, distance 9-400, input cleared, the button enabled, no error. A sweep leaves and enters at points
//        every --sweep m along every line on both maps (DOM key events through the same listeners). Info rows: Shift / Ctrl / Alt / Meta + V, an IME keydown (Process)
//   RI3  the head (R2 card 3; plan RI-02): pelican.state.yaw after the damping and its goal (state.yawGoal, when the build has it) against lookYaw, driven through the
//        ride (ride.look, real mouse drags, C, V): 0 at 0, 0.6 theta for small angles, within +-1 rad, theta the same as theta +- 2 pi / 4 pi, continuous across +-pi
//        (largest change per step), two turns each way back to the centre, C, leaving and entering, riding / stopped / pushing, on the sphere and through a switch
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { INIT } from './road_views.mjs';
import { LANE } from './ride_routes.mjs';
import { install, eventLog } from './ride_driver.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), argv = process.argv.slice(2);
const opt = k => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const ONLY = opt('--only') ? opt('--only').split(',') : null, want = k => !ONLY || ONLY.includes(k);
const SCAN = +(opt('--scan') || 5), SWEEP = +(opt('--sweep') || 10);
const PER = 2 * Math.PI * 90, wdx = d => d - PER * Math.round(d / PER), flat = (lon, lat) => [90 * lon * Math.PI / 180, -90 * Math.asinh(Math.tan(lat * Math.PI / 180))];
let head = null; try { head = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim() + (execSync('git status --porcelain -- index.html *.js', { cwd: root }).toString().trim() ? ' (dirty)' : ''); } catch { /* no git */ }
const results = [], report = { tool: 'tools/ride_interaction_check.mjs', date: new Date().toISOString(), head, scan: SCAN, sweep: SWEEP, checks: {} };
const check = (id, ok, detail, lines = [], data = null) => { results.push([id, ok]); report.checks[id] = { ok, detail, lines, data }; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); for (const l of lines) console.log('  · ' + l); };
const f = (v, n = 3) => (v === null || v === undefined || Number.isNaN(v) ? '—' : (+v).toFixed(n));

const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
const p = await browser.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await p.addInitScript('window.__realNow = performance.now.bind(performance);');
await p.addInitScript(INIT);
await p.goto(pathToFileURL(path.join(root, 'index.html')).href + '?quality=high', { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.waitForFunction(() => window.__scene && window.__scene.ride && window.__scene.ground, null, { timeout: 180000, polling: 200 });
await p.evaluate(() => window.__step(3));
await p.evaluate(install, { LANE });
await p.evaluate(eventLog);
const REACH = await p.evaluate(() => window.__scene.ride.cfg.half + window.__scene.ride.cfg.radius + 0.05);      // the rider's reach from its centre (true m)
// in-page: settle a map, a free view at a target
await p.evaluate(() => {
  const S = window.__scene, T = S.transition;
  window.__RIH = {
    settle(map) { if (T.mode !== map) S.view.set({ mapMode: map }); let k = 0; while (T.animating && k++ < 400) window.__step(1); return k; },
    free(map, tgt, yaw) { if (S.view.get().mode !== 'free') S.view.set({ mode: 'free' }); this.settle(map); S.view.set({ target: [tgt[0], 1.2, tgt[1]], yaw, pitch: 0.5, dist: 34 }); window.__step(2); },
  };
});
const step = n => p.evaluate(n => window.__step(n), n);
const logLen = () => p.evaluate(() => window.__RI.log.length);
const since = n => p.evaluate(n => window.__RI.log.slice(n), n);
const center = id => p.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
// one real action; the entry the ride's listeners logged for it (null: none, e.g. a disabled button fires no click)
async function act(how) {
  const n = await logLen();
  if (how === 'v') await p.keyboard.press('v'); else if (how === 'esc') await p.keyboard.press('Escape'); else if (how === 'c') await p.keyboard.press('c');
  else if (how === 'button') { const c = await center('town-view-toggle'); await p.mouse.click(c[0], c[1]); }
  else if (how === 'map') { const c = await center('map-mode-toggle'); await p.mouse.click(c[0], c[1]); return null; }
  else await p.keyboard.press(how);
  const e = await since(n); return e.length ? e[e.length - 1] : null;
}
const NAME = { v: 'V', esc: 'Esc', button: '按钮' };
// a leave read at the event: the checks apart
function leaveOf(e, map) {
  if (!e) return { ok: false, why: '无事件' };
  const r = e.pre.r, P = e.post, o = {
    mode: P.mode === 'free', map: P.map === map, at: !!r && Math.abs(wdx(P.target[0] - r.x)) < 1e-6 && Math.abs(P.target[2] - r.z) < 1e-6,
    level: !r || !['deck', 'tunnel'].includes(r.layer) || (!!P.exit && P.exit.level === r.layer), dist: P.dist >= 9 && P.dist <= 400,
    input: P.rideInput.throttle === 0 && P.rideInput.steer === 0 && P.input[0] === 0 && P.input[1] === 0, button: P.disabled === P.animating && P.text.includes('骑行'), errors: e.errors.length === 0 };
  return { ok: Object.values(o).every(Boolean), ...o, d: P.dist, ms: e.ms, speed: r && r.speed, layer: r && r.layer, line: r && r.line, x: r && r.x, z: r && r.z, exit: P.exit, animating: e.pre.animating, u: e.pre.u, how: e.how, key: e.key };
}
const failed = q => Object.entries(q).filter(([k, v]) => ['mode', 'map', 'at', 'level', 'dist', 'input', 'button', 'errors'].includes(k) && !v).map(([k]) => k).join('/') || '';
const enterOf = (e, map) => { if (!e) return { ok: false, why: '无事件' }; const P = e.post, sp = P.spawn, r = P.r, placed = !!r && !!sp && Math.hypot(wdx(r.x - sp.x), r.z - sp.z) <= REACH * (r.s || 1) && (sp.layer === undefined ? r.line === sp.line : r.layer === sp.layer && Math.abs(r.y - sp.y) <= 0.3 * (r.s || 1));
  const o = { mode: P.mode === 'roam', map: P.map === map, placed, button: !P.disabled && P.text.includes('自由视角'), errors: e.errors.length === 0 }; return { ok: Object.values(o).every(Boolean), ...o, ms: e.ms, hint: P.hint, r, sp, off: r && sp ? Math.hypot(wdx(r.x - sp.x), r.z - sp.z) : null }; };

// the places of RI2: targets (flat x, z), the view's yaw, the rider put inside the tunnel's bore (the spawn keeps out of a tunnel)
const PLACES = [
  { id: 'town', name: '城镇 便利店门前', target: [-7, 20], yaw: 2.5 },
  { id: 'road', name: '城外道路 CR01 东南', target: [33.56, 55.33], yaw: 2.5 },
  { id: 'forest', name: '城南森林（离路 > 10 m）', target: flat(15, -42), yaw: 2.5 },
  { id: 'sea', name: '开阔海面（离路很远）', target: flat(0, -60), yaw: 2.5 },
  { id: 'deck', name: 'RN01-03 桥下海面 → 桥面', line: 'RN01-03', yaw: 2.5 },
  { id: 'tunnel', name: 'RN01-05 隧道洞内', line: 'tunnel', yaw: 2.5, inside: true },
  { id: 'seam', name: '平面接缝西海 RN01-13 桥面', target: flat(-85, -12), yaw: 2.5 },
  { id: 'high', name: 'LM07 冰原（高纬，显示比例 4）', target: flat(72, 76.5), yaw: 2.5 },
  // RI-01: the nearest road point is a dead end (a line's end station): the spawn's sample was not found again at its shown point, the rider stayed where it was
  { id: 'iceWest', name: 'LM07 西侧冰原（最近为 RN10-RD08 西端）', target: [-133.5, -190], yaw: 2.5 },
  { id: 'lm02', name: 'LM02 村口外（最近为 RN05-RD03 末端）', line: 'RN05-RD03', end: 'end', beyond: 8, yaw: 2.5 },
  { id: 'repro', name: 'RI-01 复现点（RN01-ridge 东端）', target: [191.48231506347656, -85], yaw: -Math.PI / 2 },
];
async function targetOf(pl) {
  if (pl.target) return pl.target;
  return p.evaluate(({ id, end, beyond }) => { const G = window.__scene.ground, ln = id === 'tunnel' ? G.lines.find(l => l.tunnel) : G.lines.find(l => l.id === id);
    if (end) { const s = end === 'end' ? ln.length : 0, q = ln.point(s, 0), d = end === 'end' ? 1 : -1; return [q.x + d * q.T[0] * beyond, q.z + d * q.T[1] * beyond]; }
    const s = id === 'tunnel' ? (ln.tunnel[0] + ln.tunnel[1]) / 2 : ln.length / 2, q = ln.point(s, 0); return [q.x, q.z]; }, { id: pl.line, end: pl.end || null, beyond: pl.beyond || 0 });
}
const putInside = () => p.evaluate(() => { const S = window.__scene, G = S.ground, ln = G.lines.find(l => l.tunnel), s = (ln.tunnel[0] + ln.tunnel[1]) / 2, a = ln.point(s, -1.75), b = ln.point(s + 0.5, -1.75);
  const g = S.ride.set({ x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), layer: 'tunnel' }); return g ? g.layer : null; });

// ---------------------------------------------------------------- RI1: spawns
if (want('RI1')) {
  const rows = [];
  for (const how of ['button', 'v']) for (const yaw of [-Math.PI / 2, Math.PI / 2]) {
    await p.evaluate(({ yaw }) => window.__RIH.free('flat', [191.48231506347656, -85], yaw), { yaw });
    const e = await act(how), en = enterOf(e, 'flat'), sp = await p.evaluate(() => { const g = window.__scene.ride.get(); return window.__scene.view.get().mode === 'roam' ? { ...g.spawn, layer: g.layer, rx: g.x, rz: g.z } : null; });
    rows.push({ how, yaw, ok: en.ok, hint: en.hint, sp });
    if (sp) { await act(how); await step(1); }
  }
  const lines = rows.map(r => `${r.ok ? 'PASS' : 'FAIL'} ${NAME[r.how]}进入 目标 (191.48, −85) 视线${r.yaw < 0 ? '朝东（yaw −π/2，复现）' : '朝西（yaw π/2，反向对照）'}：${r.sp ? `出生 ${r.sp.line}/${r.sp.edge} ${r.sp.layer} (${f(r.sp.x, 2)}, ${f(r.sp.z, 2)})，航向 ${f(r.sp.heading, 3)}，距目标 ${f(r.sp.distance, 1)}，提示「${r.hint}」` : `未进入，提示「${r.hint}」`}`);
  const ends = await p.evaluate(() => {
    const S = window.__scene, G = S.ground, api = S.ride.api(), out = [], t0 = window.__realNow(), REACH = S.ride.cfg.half + S.ride.cfg.radius + 0.05;
    for (const ln of G.lines) { if (ln.kind === 'stairs') continue;
      for (const s of [0, ln.length]) { const c = ln.point(s, 0), dir = s === 0 ? -1 : 1;
        for (const ext of [0, 0.5, 3]) for (const lat of [-1, 0, 1]) for (const sg of [1, -1]) {
          const x = c.x + dir * c.T[0] * ext - c.T[1] * lat, z = c.z + dir * c.T[1] * ext + c.T[0] * lat, d = [sg * c.T[0], sg * c.T[1]], sp = G.spawn(x, z, d);
          const own = !!sp && G.layers(sp.x, sp.z).some(q => q.line === sp.line && q.layer === sp.layer && Math.abs(q.y - sp.y) < 1e-9);
          // placed: the rider stands at the spawn on its level: within its own reach (capsule half + radius, x s: at a dead end the body is pushed back onto the road,
          // and may stand on the surface joined there: a site, a stair landing)
          const en = sp ? api.enter(x, z, d) : null, st = api.state, placed = !!en && !!st.sample && Math.hypot(st.x - sp.x, st.z - sp.z) <= REACH * sp.s && st.sample.layer === sp.layer && Math.abs(st.y - sp.y) <= 0.3 * sp.s;
          out.push({ line: ln.id, kind: ln.kind, end: s ? 'end' : 'start', ext, lat, sg, ok: !!sp && own && placed, spawn: !!sp, own, placed, move: en ? Math.hypot(st.x - sp.x, st.z - sp.z) : null, spLine: sp && sp.line, onto: en && st.sample.line !== sp.line ? `${st.sample.line} ${st.sample.kind}` : null, mode: en ? st.mode : null, x, z });
        } } }
    api.exit(); return { rows: out, ms: window.__realNow() - t0 };
  });
  const eb = ends.rows.filter(r => !r.ok), lineIds = new Set(ends.rows.map(r => r.line));
  const onto = {}; for (const r of ends.rows) if (r.onto) onto[`${r.line} ${r.end} → ${r.onto}（${r.mode}）`] = (onto[`${r.line} ${r.end} → ${r.onto}（${r.mode}）`] || 0) + 1;
  lines.push(`${eb.length ? 'FAIL' : 'PASS'} 道路首尾探针（${lineIds.size} 条线 × 首尾 × 越出 0/0.5/3 m × 横向 −1/0/+1 m × 两个视线方向）：${ends.rows.length - eb.length}/${ends.rows.length} 出生有效（采样面属于出生线与层，ride.enter 后骑手在出生点车身半长 + 半径 + 0.05 = 0.87 m × s 内、同层同高）；进入后落在相接的面 ${Object.entries(onto).map(([k, v]) => `${k} ${v} 次`).join('、') || '无'}；进入后碰撞推出最大 ${(() => { const m = ends.rows.reduce((a, r) => (r.move > (a ? a.move : -1) ? r : a), null); return m ? `${f(m.move, 3)} m（${m.line} ${m.end}，越出 ${m.ext} m、横向 ${m.lat} m）` : '—'; })()}${eb.length ? '；失败 ' + [...new Set(eb.map(r => `${r.line} ${r.end}`))].join('、') : ''}`);
  const grid = await p.evaluate(({ SCAN }) => {
    const G = window.__scene.ground, bad = [], counts = { points: 0, spawns: 0, null: 0, invalid: 0 }, t0 = window.__realNow();
    for (let x = G.SEAM; x < G.SEAM + G.PERIOD; x += SCAN) for (let z = -200; z <= 200; z += SCAN) { counts.points++;
      for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { counts.spawns++; const sp = G.spawn(x, z, d);
        if (!sp) { counts.null++; if (bad.length < 40) bad.push({ x, z, d, why: 'null' }); continue; }
        if (!G.layers(sp.x, sp.z).some(q => q.line === sp.line && q.layer === sp.layer && Math.abs(q.y - sp.y) < 1e-9)) { counts.invalid++; if (bad.length < 40) bad.push({ x, z, d, why: 'invalid', line: sp.line }); } } }
    return { counts, bad, ms: window.__realNow() - t0 };
  }, { SCAN });
  lines.push(`${grid.counts.null + grid.counts.invalid ? 'FAIL' : 'PASS'} 全图出生扫描（${SCAN} m 网格 ${grid.counts.points} 点 × 4 个视线方向 = ${grid.counts.spawns} 次）：无出生 ${grid.counts.null}、出生面无效 ${grid.counts.invalid}${grid.bad.length ? '；前几处 ' + grid.bad.slice(0, 8).map(b => `(${f(b.x, 2)}, ${b.z}) [${b.d}] ${b.why}`).join('、') : ''}（${f(grid.ms / 1000, 1)} s）`);
  const ok = rows.every(r => r.ok) && rows.every(r => r.sp && r.sp.line === 'RN01-ridge') && !eb.length && !grid.counts.null && !grid.counts.invalid;
  check('RI1', ok, `出生：复现与反向 ${rows.filter(r => r.ok).length}/${rows.length}，首尾探针失败 ${eb.length}/${ends.rows.length}，全图扫描无出生 ${grid.counts.null}、无效 ${grid.counts.invalid}`, lines, { repro: rows, endsBad: eb, endsN: ends.rows.length, grid });
}

// ---------------------------------------------------------------- RI3: the head against the look round
if (want('RI3')) {
  const lines = [], data = {};
  const row = (name, ok, detail) => { lines.push(`${ok ? 'PASS' : 'FAIL'} ${name}：${detail}`); data[name] = { ok, detail }; return ok; };
  await p.evaluate(() => window.__RIH.free('flat', [-7, 20], 2.5)); await act('v'); await step(2);
  await p.evaluate(() => {
    const S = window.__scene, api = S.ride.api(), px = S.ride.cfg.yawPx;
    const H = () => { const st = S.ride.riderApi().pelican.state; return { yaw: st.yaw, goal: st.yawGoal ?? null, look: api.state.lookYaw }; };
    const lookTo = th => api.look((th - api.state.lookYaw) / px, 0);
    // n steps of the ride (ride.step + the rider + the camera, as a frame) with input; the largest change of the head and of its goal per step, and its largest size
    const run = (n, inp, track) => { let prev = H(), mY = 0, mG = 0, aY = Math.abs(prev.yaw), aG = prev.goal === null ? null : Math.abs(prev.goal);
      for (let i = 0; i < n; i++) { if (track) track(i); S.ride.step(1 / 60, inp || {}); const h = H(); mY = Math.max(mY, Math.abs(h.yaw - prev.yaw)); aY = Math.max(aY, Math.abs(h.yaw));
        if (h.goal !== null && prev.goal !== null) { mG = Math.max(mG, Math.abs(h.goal - prev.goal)); aG = Math.max(aG, Math.abs(h.goal)); } prev = h; }
      return { ...prev, mY, mG: prev.goal === null ? null : mG, aY, aG }; };
    // a steady turn of the look from a to b, d a step, measured from the head settled at a
    const sweep = (a, b, d, inp) => { const n = Math.max(1, Math.round(Math.abs(b - a) / d)); lookTo(a); run(240, inp); return run(n, inp, i => lookTo(a + (b - a) * (i + 1) / n)); };
    const settle = (th, inp) => { lookTo(th); return run(240, inp); };
    window.__HEAD = { H, lookTo, run, sweep, settle };
  });
  const H = fn => p.evaluate(fn);
  // a. zero, b. small angles
  const zero = await H(() => window.__HEAD.settle(0));
  row('零点回中', Math.abs(zero.yaw) < 1e-4, `lookYaw 0 → 头 ${f(zero.yaw, 6)} rad（目标 ${f(zero.goal, 6)}）`);
  const small = await H(() => [0.1, -0.1, 0.3, -0.3, 0.8, -0.8].map(th => ({ th, ...window.__HEAD.settle(th) })));
  row('小角度 0.6 θ', small.every(q => Math.abs(q.yaw - 0.6 * q.th) <= 1e-4), small.map(q => `θ ${q.th} → ${f(q.yaw, 4)}（0.6 θ = ${f(0.6 * q.th, 4)}，目标 ${f(q.goal, 4)}）`).join('，'));
  // c. limit over four turns each way, at 0.01 rad a step
  const lim = await H(() => { const A = window.__HEAD; const a = A.sweep(0, 4 * Math.PI, 0.01), b = A.sweep(4 * Math.PI, -4 * Math.PI, 0.01), c = A.sweep(-4 * Math.PI, 0, 0.01); const p1 = A.settle(1.7), p2 = A.settle(-1.7);
    return { aY: Math.max(a.aY, b.aY, c.aY), aG: a.aG === null ? null : Math.max(a.aG, b.aG, c.aG), mY: Math.max(a.mY, b.mY, c.mY), mG: a.mG === null ? null : Math.max(a.mG, b.mG, c.mG), p1: p1.yaw, p2: p2.yaw }; });
  row('限幅 ±1 rad', lim.aY <= 1 + 1e-9 && (lim.aG === null || lim.aG <= 1 + 1e-9) && Math.abs(lim.p1 - 1) < 1e-4 && Math.abs(lim.p2 + 1) < 1e-4,
    `θ 0 → 4π → −4π → 0（每步 0.01 rad）头最大 |${f(lim.aY, 4)}|、目标最大 |${f(lim.aG, 4)}|；θ ±1.7 → ${f(lim.p1, 4)} / ${f(lim.p2, 4)}；相邻步最大变化 头 ${f(lim.mY, 4)}、目标 ${f(lim.mG, 4)}`);
  row('连续多圈无突变（0.01 rad/步）', lim.mY <= 0.02 && (lim.mG === null || lim.mG <= 0.02), `相邻步最大变化 头 ${f(lim.mY, 4)} rad、目标 ${f(lim.mG, 4)} rad（≤ 0.02）`);
  // d. theta and theta + 2 k pi
  const per = await H(() => [0.3, 1.2, 2.0, 2.8, Math.PI, -0.7, -2.4].map(th => { const A = window.__HEAD, ref = A.settle(th).yaw; return { th, ref, k: [-2, -1, 1, 2].map(k => ({ k, yaw: A.settle(th + 2 * k * Math.PI).yaw })) }; }));
  const perD = Math.max(...per.flatMap(q => q.k.map(r => Math.abs(r.yaw - q.ref))));
  row('θ 与 θ ± 2π、± 4π 等价', perD <= 1e-5, `最大差 ${f(perD, 7)} rad；` + per.map(q => `θ ${f(q.th, 2)}：${f(q.ref, 4)} / ${q.k.map(r => f(r.yaw, 4)).join(' ')}`).join('；'));
  // e. across +-pi, slowly
  const pi = await H(() => { const A = window.__HEAD, P = Math.PI, r = [A.sweep(P - 0.5, P + 0.5, 0.002), A.sweep(P + 0.5, P - 0.5, 0.002), A.sweep(-P + 0.5, -P - 0.5, 0.002), A.sweep(-P - 0.5, -P + 0.5, 0.002)];
    return { mY: Math.max(...r.map(q => q.mY)), mG: r[0].mG === null ? null : Math.max(...r.map(q => q.mG)), atPi: A.settle(P).yaw, atMinusPi: A.settle(-P).yaw }; });
  row('跨 ±π 连续', pi.mY <= 0.005 && (pi.mG === null || pi.mG <= 0.005), `θ 在 π ± 0.5、−π ± 0.5 往返（每步 0.002 rad）相邻步最大变化 头 ${f(pi.mY, 5)}、目标 ${f(pi.mG, 5)}（≤ 0.005）；θ = π / −π 稳定后 ${f(pi.atPi, 5)} / ${f(pi.atMinusPi, 5)}`);
  // f. two turns each way (ride.look), back to the centre
  const turns = await H(() => { const A = window.__HEAD, a = A.sweep(0, 4 * Math.PI, 0.02), a1 = A.run(240), b = A.sweep(4 * Math.PI, -4 * Math.PI, 0.02), b1 = A.run(240), c = A.sweep(-4 * Math.PI, 0, 0.02), c1 = A.run(240);
    return { up: a1.yaw, down: b1.yaw, back: c1.yaw, mY: Math.max(a.mY, b.mY, c.mY), mG: a.mG === null ? null : Math.max(a.mG, b.mG, c.mG) }; });
  row('正反两圈后回中（ride.look）', [turns.up, turns.down, turns.back].every(v => Math.abs(v) < 1e-4), `正转两圈（θ = 4π）稳定后 ${f(turns.up, 5)}，反转四圈（θ = −4π）后 ${f(turns.down, 5)}，回到 0 后 ${f(turns.back, 5)}；相邻步最大变化 头 ${f(turns.mY, 4)}、目标 ${f(turns.mG, 4)}`);
  // g. real mouse drags on the canvas (grab style: right raises lookYaw), frames by hand between the moves
  // 10 px a frame (0.05 rad, 3 rad/s); a flip of the goal from one limit to the other would move the damped head about 0.13 rad in one frame
  const drag = async (x0, dx, moves) => { await p.mouse.move(x0, 420); await p.mouse.down(); let mY = 0, prev = (await H(() => window.__HEAD.H())).yaw;
    for (let i = 1; i <= moves; i++) { await p.mouse.move(x0 + dx * i, 420); const y = await p.evaluate(() => { window.__step(1); return window.__HEAD.H().yaw; }); mY = Math.max(mY, Math.abs(y - prev)); prev = y; }
    await p.mouse.up(); await step(20); return mY; };
  const settleFrames = () => p.evaluate(() => { let prev = window.__HEAD.H().yaw, mY = 0; for (let i = 0; i < 240; i++) { window.__step(1); const y = window.__HEAD.H().yaw; mY = Math.max(mY, Math.abs(y - prev)); prev = y; } return { ...window.__HEAD.H(), mY }; });
  await H(() => { window.__HEAD.settle(0); });
  let mDrag = 0; for (let k = 0; k < 3; k++) mDrag = Math.max(mDrag, await drag(200, 10, 80));
  const d1 = await settleFrames(), r1 = await H(() => { const A = window.__HEAD, th = A.H().look, y = A.settle(th - 4 * Math.PI).yaw; A.lookTo(th); A.run(240); return { th, ref: y }; });
  for (let k = 0; k < 6; k++) mDrag = Math.max(mDrag, await drag(1000, -10, 80));
  const d2 = await settleFrames(), r2 = await H(() => { const A = window.__HEAD, th = A.H().look, y = A.settle(th + 4 * Math.PI).yaw; A.lookTo(th); A.run(240); return { th, ref: y }; });
  for (let k = 0; k < 3; k++) mDrag = Math.max(mDrag, await drag(200, 10, 80));
  const d3 = await settleFrames();
  row('鼠标拖动正反多圈（真实指针事件、逐帧）', Math.abs(d1.yaw - r1.ref) <= 1e-4 && Math.abs(d2.yaw - r2.ref) <= 1e-4 && Math.abs(d3.look) < 1e-9 && Math.abs(d3.yaw) <= 1e-4 && mDrag <= 0.07,
    `正向三笔 θ = ${f(r1.th, 3)}：头 ${f(d1.yaw, 5)} = θ − 4π 处 ${f(r1.ref, 5)}；反向六笔 θ = ${f(r2.th, 3)}：头 ${f(d2.yaw, 5)} = θ + 4π 处 ${f(r2.ref, 5)}；拖回 θ = ${f(d3.look, 6)}：头 ${f(d3.yaw, 6)}；每帧 10 px（0.05 rad）拖动时头每帧最大变化 ${f(mDrag, 4)}（≤ 0.07）`);
  // h. C after more than two turns
  await H(() => { window.__HEAD.settle(4 * Math.PI + 2.2); });
  await act('c');
  const cr = await p.evaluate(() => { let prev = window.__HEAD.H(), mY = 0, mG = 0; for (let i = 0; i < 270; i++) { window.__step(1); const h = window.__HEAD.H(); mY = Math.max(mY, Math.abs(h.yaw - prev.yaw)); if (h.goal !== null) mG = Math.max(mG, Math.abs(h.goal - prev.goal)); prev = h; } return { ...prev, mY, mG }; });
  row('C 回正', Math.abs(cr.look) < 1e-9 && Math.abs(cr.yaw) <= 1e-4, `θ = 4π + 2.2 按 C：lookYaw → ${f(cr.look, 6)}，头 → ${f(cr.yaw, 6)}；回正中每帧最大变化 头 ${f(cr.mY, 4)}、目标 ${f(cr.mG, 4)}`);
  // i. leave and enter again
  const pre = await H(() => window.__HEAD.settle(1.4)); await act('v'); await act('v'); await step(1);
  const after = await H(() => window.__HEAD.H()), re = await H(() => window.__HEAD.run(240));
  row('退出后重进', Math.abs(after.look) < 1e-9 && Math.abs(re.yaw) <= 1e-4, `θ 1.4 时头 ${f(pre.yaw, 4)}；V 退出、V 进入后 lookYaw ${f(after.look, 6)}、头 ${f(after.yaw, 4)}（阻尼延续），4 s 后 ${f(re.yaw, 6)}`);
  // j. riding, stopped, pushing: one mapping
  const modes = await H(() => { const S = window.__scene, A = window.__HEAD, G = S.ground, ref = A.settle(0.5).yaw;
    S.ride.set({ x: -7, z: 16.75, heading: -Math.PI / 2 }); const stop = A.settle(2 * Math.PI + 0.5), ms = S.ride.get().mode, vs = S.ride.get().speed;
    S.ride.set({ x: -7, z: 16.75, heading: -Math.PI / 2 }); const ride = A.settle(2 * Math.PI + 0.5, { throttle: 1 }), mr = S.ride.get().mode, vr = S.ride.get().speed;
    const ln = G.lines.find(l => l.kind === 'stairs' && l.length > 6), a = ln.point(ln.length / 2, 0), b = ln.point(ln.length / 2 + 0.5, 0); S.ride.set({ x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z) });
    const push = A.settle(2 * Math.PI + 0.5), mp = S.ride.get().mode; S.ride.set({ x: -7, z: 16.75, heading: -Math.PI / 2 }); A.settle(0);
    return { ref, stop: stop.yaw, ms, vs, ride: ride.yaw, mr, vr, push: push.yaw, mp, stair: ln.id }; });
  row('骑行、停住、推车同一追视', [modes.stop, modes.ride, modes.push].every(v => Math.abs(v - modes.ref) <= 1e-4) && modes.mp === 'push' && modes.vr > 2,
    `θ = 2π + 0.5：停住（${modes.ms}，${f(modes.vs, 2)} m/s）${f(modes.stop, 5)}、骑行（${modes.mr}，${f(modes.vr, 2)} m/s）${f(modes.ride, 5)}、推车（${modes.mp}，${modes.stair}）${f(modes.push, 5)}；θ = 0.5 为 ${f(modes.ref, 5)}`);
  // k. on the sphere, and through a switch back to the flat map (frames by hand)
  await p.evaluate(() => window.__RIH.settle('sphere'));
  const sph = await p.evaluate(() => { const S = window.__scene, A = window.__HEAD; S.ride.set({ x: -7, z: 16.75, heading: -Math.PI / 2 }); A.lookTo(2 * Math.PI + 0.5); window.__step(240); return { ...A.H(), map: S.view.get().mapMode, mode: S.view.get().mode, u: S.bend.get() }; });
  await act('map'); await step(20);
  const sw = await p.evaluate(() => { const S = window.__scene, A = window.__HEAD; A.lookTo(-4 * Math.PI - 0.5); let prev = A.H().yaw, mY = 0, us = []; for (let i = 0; i < 240; i++) { window.__step(1); const y = A.H().yaw; mY = Math.max(mY, Math.abs(y - prev)); prev = y; if (i % 40 === 0) us.push(+S.bend.get().toFixed(3)); }
    return { ...A.H(), mY, us, map: S.view.get().mapMode, mode: S.view.get().mode }; });
  row('球形与切换中', Math.abs(sph.yaw - modes.ref) <= 1e-4 && Math.abs(sw.yaw + modes.ref) <= 1e-4 && sph.mode === 'roam' && sw.mode === 'roam' && sw.map === 'flat',
    `球形（u ${f(sph.u, 2)}）θ = 2π + 0.5：头 ${f(sph.yaw, 5)}；切回平面途中设 θ = −4π − 0.5（u 依次 ${sw.us.join(' → ')}）：头 ${f(sw.yaw, 5)}（−0.5 应为 ${f(-modes.ref, 5)}），每帧最大变化 ${f(sw.mY, 4)}`);
  await act('v'); await step(1);
  const ok = Object.values(data).every(q => q.ok);
  check('RI3', ok, `头颈追视 ${Object.values(data).filter(q => q.ok).length}/${Object.keys(data).length}${small[0].goal === null ? '（本构建无 yawGoal 读数，只验实际角）' : ''}`, lines, data);
}

// ---------------------------------------------------------------- RI2: in and out by real input
if (want('RI2')) {
  const lines = [], data = { places: [], switches: [], inputs: [], sweep: null };
  for (const map of ['flat', 'sphere']) for (const pl of PLACES) {
    const tgt = await targetOf(pl);
    await p.evaluate(({ map, tgt, yaw }) => window.__RIH.free(map, tgt, yaw), { map, tgt, yaw: pl.yaw });
    const e0 = await act('v'), en0 = enterOf(e0, map); await step(1);
    const res = { place: pl.id, name: pl.name, map, enter: en0, leaves: [], agains: [] };
    if (en0.ok) for (const how of ['v', 'esc', 'button']) {
      if (pl.inside) await putInside(); await step(30);
      const l1 = leaveOf(await act(how), map); l1.state = 'rest'; res.leaves.push(l1);
      const a1 = enterOf(await act('v'), map); a1.d = a1.r && l1.x !== null ? Math.hypot(wdx(a1.r.x - l1.x), a1.r.z - l1.z) / (a1.r.s || 1) : null; res.agains.push(a1); await step(2);
      if (pl.inside) await putInside();
      await p.keyboard.down('w'); await step(45);
      const l2 = leaveOf(await act(how), map); l2.state = 'riding'; await p.keyboard.up('w'); res.leaves.push(l2);
      const a2 = enterOf(await act('v'), map); a2.d = a2.r && l2.x !== null ? Math.hypot(wdx(a2.r.x - l2.x), a2.r.z - l2.z) / (a2.r.s || 1) : null; res.agains.push(a2); await step(2);
    }
    if ((await p.evaluate(() => window.__scene.view.get().mode)) === 'roam') { await act('v'); await step(1); }
    res.ok = en0.ok && res.leaves.length === 6 && res.leaves.every(q => q.ok) && res.agains.every(q => q.ok);
    data.places.push(res);
    const lv = res.leaves;
    lines.push(`${res.ok ? 'PASS' : 'FAIL'} ${map === 'flat' ? '平面' : '球形'} ${pl.name}：V 进入 ${en0.ok ? `${en0.r ? `${en0.r.line} ${en0.r.layer}` : ''}` : en0.mode ? `后骑手不在出生点（出生 ${en0.sp && en0.sp.line} (${f(en0.sp && en0.sp.x, 1)}, ${f(en0.sp && en0.sp.z, 1)})，骑手 ${en0.r && en0.r.line} (${f(en0.r && en0.r.x, 1)}, ${f(en0.r && en0.r.z, 1)})，相距 ${f(en0.off, 1)} m，提示「${en0.hint}」）` : `失败「${en0.hint || ''}」`}${lv.length ? `；退出 ${lv.filter(q => q.ok).length}/${lv.length}（${lv.map(q => `${NAME[q.how === 'button' ? 'button' : q.key === 'Escape' ? 'esc' : 'v']}${q.state === 'riding' ? '骑行中' : '停住'}${q.ok ? '' : ' ✗' + failed(q)}`).join('、')}），层 ${[...new Set(lv.map(q => q.layer))].join('/')}，事件时速度 ${f(Math.min(...lv.map(q => q.speed)), 2)}–${f(Math.max(...lv.map(q => q.speed)), 2)} m/s，距离 ${f(Math.min(...lv.map(q => q.d)), 1)}–${f(Math.max(...lv.map(q => q.d)), 1)}，处理 ≤ ${f(Math.max(...lv.map(q => q.ms)), 1)} ms；立即再进入 ${res.agains.filter(q => q.ok).length}/${res.agains.length}，离退出点 ≤ ${f(Math.max(...res.agains.map(q => q.d || 0)), 2)} m` : ''}`);
  }
  // leaving during a map switch (riding, W held), the map's goal kept; then entering at once after it
  for (const [from, how] of [['flat', 'v'], ['sphere', 'esc'], ['flat', 'button']]) {
    const to = from === 'flat' ? 'sphere' : 'flat';
    await p.evaluate(({ from }) => window.__RIH.free(from, [-7, 20], 2.5), { from }); await act('v'); await step(30);
    await p.keyboard.down('w'); await step(30); await act('map'); await step(30);
    const l = leaveOf(await act(how), to); await p.keyboard.up('w');
    const fin = await p.evaluate(() => { let k = 0; while (window.__scene.transition.animating && k++ < 400) window.__step(1); const v = window.__scene.view.get(); return { mode: v.mode, map: v.mapMode, u: window.__scene.bend.get(), target: v.target, dist: v.dist, frames: k }; });
    const kept = Math.abs(wdx(fin.target[0] - l.x)) < 1e-6 && Math.abs(fin.target[2] - l.z) < 1e-6, again = enterOf(await act('v'), to); await step(2);
    const ok = l.ok && l.animating && fin.mode === 'free' && fin.map === to && fin.u === (to === 'sphere' ? 1 : 0) && kept && fin.dist >= 9 && fin.dist <= 400 && again.ok;
    data.switches.push({ from, to, how, leave: l, fin, kept, again, ok });
    lines.push(`${ok ? 'PASS' : 'FAIL'} 切换中退出 ${from}→${to}（${NAME[how]}，骑行中，事件时 u ${f(l.u, 3)}、切换中 ${l.animating}）：${l.ok ? '模式/地图目标/位置/距离/输入/按钮均符合' : '✗' + failed(l)}，处理 ${f(l.ms, 1)} ms；切换继续 ${fin.frames} 帧到 ${fin.map}（u ${fin.u}），目标不动 ${kept}，距离 ${f(fin.dist, 1)}；切换完立即再进入 ${again.ok}`);
    await act('v'); await step(1);
  }
  // entering during a switch is refused (hint, the button disabled); after it, allowed
  {
    await p.evaluate(() => window.__RIH.free('flat', [-7, 20], 2.5)); await act('map'); await step(10);
    const ev = await act('v'), eb = await act('button'), st = await p.evaluate(() => ({ mode: window.__scene.view.get().mode, disabled: document.getElementById('town-view-toggle').disabled, title: document.getElementById('town-view-toggle').title }));
    await p.evaluate(() => window.__RIH.settle('sphere')); const later = enterOf(await act('v'), 'sphere'); await step(1);
    const ok = !!ev && ev.post.mode === 'free' && ev.pre.disabled && /地图切换中/.test(ev.post.hint) && eb === null && st.mode === 'free' && st.disabled && later.ok;
    data.switches.push({ enterDuring: { ev, button: eb, st, later, ok } });
    lines.push(`${ok ? 'PASS' : 'FAIL'} 切换中进入：按 V 仍为 ${ev && ev.post.mode}、提示「${ev && ev.post.hint}」、按钮禁用 ${st.disabled}（title「${st.title}」）、点按钮无点击事件 ${eb === null}；切换结束后按 V 进入 ${later.ok}`);
    await act('v'); await step(1); await p.evaluate(() => window.__RIH.settle('flat'));
  }
  // the ways of pressing V (info): modifiers, the focus on the button, an IME keydown
  {
    await p.evaluate(() => window.__RIH.free('flat', [-7, 20], 2.5));
    const mode = () => p.evaluate(() => window.__scene.view.get().mode), rowsI = [];
    for (const k of ['Shift+V', 'Control+v', 'Alt+v', 'Meta+v']) { const m0 = await mode(); await p.keyboard.press(k); const m1 = await mode(); rowsI.push(`${k}：${m0} → ${m1}`); if (m1 !== m0) { await act('v'); } await step(1); }
    const cdp = await p.context().newCDPSession(p), m0 = await mode();
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Process', code: 'KeyV', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229 }); await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86 });
    const m1 = await mode(); rowsI.push(`输入法组合态 keydown（key=Process，code=KeyV）：${m0} → ${m1}`); if (m1 !== m0) await act('v');
    const c = await center('town-view-toggle'); await p.mouse.click(c[0], c[1]); const fe = await act('v'); rowsI.push(`点按钮进入后焦点在按钮上按 V（事件目标 ${fe && fe.target}）：${fe && fe.pre.mode} → ${fe && fe.post.mode}`); await step(1);
    data.inputs = rowsI; lines.push(`INFO 按键方式：${rowsI.join('；')}`);
  }
  // the sweep: leave and enter at points along every line on both maps (DOM key events through the same listeners)
  const sweep = await p.evaluate(({ SWEEP }) => {
    const S = window.__scene, G = S.ground, out = { points: 0, unplaced: 0, bad: [], maxMs: 0, maps: {} }, key = () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', bubbles: true })); document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'v', code: 'KeyV', bubbles: true })); return window.__RI.log[window.__RI.log.length - 1]; };
    for (const map of ['flat', 'sphere']) {
      window.__RIH.free(map, [-7, 20], 2.5); key(); window.__step(1); const m = out.maps[map] = { points: 0, leaves: 0, enters: 0 };
      for (const ln of G.lines) { if (ln.kind === 'stairs') continue;
        for (let s = 2; s < ln.length - 2; s += SWEEP) {
          const a = ln.point(s, 0), b = ln.point(s + 0.5, 0), layer = ln.kind === 'bridge' ? 'deck' : ln.tunnel && s > ln.tunnel[0] && s < ln.tunnel[1] ? 'tunnel' : 'ground';
          if (S.view.get().mode !== 'roam') key();
          const g = S.ride.set({ x: a.x, z: a.z, heading: Math.atan2(b.x - a.x, b.z - a.z), layer }); if (!g) { out.unplaced++; continue; }
          window.__step(1); out.points++; m.points++;
          const e = key(), r = e.pre.r, P = e.post, okL = e.pre.mode === 'roam' && P.mode === 'free' && P.map === map && !!r && Math.abs(P.target[0] - r.x) < 1e-6 && Math.abs(P.target[2] - r.z) < 1e-6 && P.dist >= 9 && P.dist <= 400 && (!['deck', 'tunnel'].includes(r.layer) || (P.exit && P.exit.level === r.layer)) && !e.errors.length;
          const e2 = key(), r2 = e2.post.r, sp2 = e2.post.spawn, okE = e2.post.mode === 'roam' && !!r2 && !!sp2 && Math.hypot(r2.x - sp2.x, r2.z - sp2.z) <= (S.ride.cfg.half + S.ride.cfg.radius + 0.05) * (r2.s || 1) && (sp2.layer === undefined || (r2.layer === sp2.layer && Math.abs(r2.y - sp2.y) <= 0.3 * (r2.s || 1))) && !e2.errors.length; out.maxMs = Math.max(out.maxMs, e.ms);
          if (okL) m.leaves++; if (okE) m.enters++;
          if ((!okL || !okE) && out.bad.length < 30) out.bad.push({ map, line: ln.id, s, layer, okL, okE, mode: P.mode, map2: P.map, dist: P.dist, level: P.exit && P.exit.level, rl: r && r.layer, hint: e2.post.hint, errors: e.errors.concat(e2.errors) });
        } }
      if (S.view.get().mode === 'roam') key(); window.__step(1);
    }
    window.__RIH.settle('flat'); return out;
  }, { SWEEP });
  data.sweep = sweep;
  const swOk = !sweep.bad.length && Object.values(sweep.maps).every(m => m.leaves === m.points && m.enters === m.points);
  lines.push(`${swOk ? 'PASS' : 'FAIL'} 沿线扫描（每 ${SWEEP} m，DOM 键盘事件经同一监听）：${Object.entries(sweep.maps).map(([k, m]) => `${k === 'flat' ? '平面' : '球形'} ${m.points} 点，退出 ${m.leaves}、再进入 ${m.enters}`).join('；')}；放不上 ${sweep.unplaced}；退出处理最长 ${f(sweep.maxMs, 1)} ms${sweep.bad.length ? '；失败 ' + sweep.bad.slice(0, 6).map(b => `${b.map} ${b.line} s ${f(b.s, 1)} ${b.layer}`).join('、') : ''}`);
  const ok = data.places.every(q => q.ok) && data.switches.every(q => q.ok !== false && (!q.enterDuring || q.enterDuring.ok)) && swOk;
  check('RI2', ok, `进出：${data.places.filter(q => q.ok).length}/${data.places.length} 个地点 × 地图，切换中 ${data.switches.filter(q => q.ok || (q.enterDuring && q.enterDuring.ok)).length}/${data.switches.length}，沿线 ${swOk}`, lines, data);
}

await browser.close();
check('errors', !errors.length, errors.length ? errors.slice(0, 5).join(' | ') : '无页面错误');
if (opt('--json')) { fs.mkdirSync(path.dirname(path.resolve(opt('--json'))), { recursive: true }); fs.writeFileSync(opt('--json'), JSON.stringify(report, null, 1)); }
const bad = results.filter(r => !r[1]);
console.log(`${bad.length ? 'FAIL' : 'PASS'} ride_interaction_check${ONLY ? ' --only ' + ONLY.join(',') : ''} (${results.length - bad.length}/${results.length})`);
process.exitCode = bad.length ? 1 : 0;
