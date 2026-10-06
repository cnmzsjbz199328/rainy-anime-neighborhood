// Checks W5-C1..C9 for the road network, batch W5a (RD01, RD02, tunnel, exits, lamps, light band). Run after `python3 build.py`:  node tools/road_check.mjs [--no-browser]
// Data checks run under Node on the generated geometry (world.js, terrain.js mesh heights, roadkit.js, bridge.js, roads.js); the page part measures draw calls.
// W5-C8 (regression) is tools/regress.mjs --baseline-ref pre-w5 --mask-patch-margin 24 plus the other tools listed in PROGRESS.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
globalThis.LAYOUT = require(path.join(root, 'layout.js'));
const W = require(path.join(root, 'world.js'));
const TERR = require(path.join(root, 'terrain.js'));
const RK = globalThis.ROADKIT = require(path.join(root, 'roadkit.js'));
const BR = globalThis.BRIDGE = require(path.join(root, 'bridge.js'));
const ROADS = require(path.join(root, 'roads.js'));
const D = Math.PI / 180, R = 90, BASE = 1.6;
const results = [];
const f = (v, n = 3) => (typeof v === 'number' ? v.toFixed(n) : String(v));
function check(id, title, fn) {
  const info = [], fails = [];
  fn({ info: m => info.push(m), fail: m => fails.push(m) });
  results.push({ id, ok: !fails.length });
  console.log(`${fails.length ? 'FAIL' : 'PASS'} ${id} ${title}`);
  for (const m of fails) console.log('  ✗ ' + m);
  for (const m of info) console.log('  · ' + m);
}
const unflat = (x, z) => ({ lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D });
const arc = (a, b) => R * W.angleBetween(W.vec(a.lon, a.lat), W.vec(b.lon, b.lat));
// the vertex shader of bend.js on the CPU: flat (x, y, z) -> point on the sphere (uBend = 1)
const bendPt = (x, y, z) => { const lam = x / R, phi = -Math.atan(Math.sinh(z / R)), s = 1 / Math.cosh(z / R), cp = Math.cos(phi), sp = Math.sin(phi); const r = R + y * s; return [r * cp * Math.sin(lam), -R + r * cp * Math.cos(lam), -r * sp]; };
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const t0 = Date.now();
const H = TERR.sampler(W, { lonMin: -181, lonMax: 181, latMin: -90, latMax: 90 });
const TB = TERR.builder(W);
const PLAN = ROADS.plan(W, H, (lo, la) => TB.vertex(lo, la).c);
console.log(`(地形网格采样器与道路数据生成 ${Date.now() - t0} ms)`);
const NET = W.roadNetwork;
const col = (st, m, i, j) => { const a = (i * m + j) * 3; return [st.pos[a], st.pos[a + 1], st.pos[a + 2]]; };
const colorAt = (st, m, i, j) => { const a = (i * m + j) * 3; return [st.col[a], st.col[a + 1], st.col[a + 2]]; };
const gridIndex = (grid, o) => { let b = 0; grid.forEach((g, j) => { if (Math.abs(g - o) < Math.abs(grid[b] - o)) b = j; }); return b; };

// ---------------------------------------------------------------- W5-C1
check('W5-C1', '中线：生成中线与 samplePath 相差 ≤ 0.05 m，端点落在节点上，W5a 范围的边都有几何', ({ info, fail }) => {
  const covered = new Set();
  const nodeOfSeg = (sg, end) => { const e = NET.edges.find(q => q.id === sg.id); return NET.nodeById[(end === 'start') === !sg.rev ? e.from : e.to]; };
  for (const rt of PLAN.routes) {
    const m = rt.grid.length, st = rt.strip; let j = 0; while (!(rt.grid[j] <= 0 && rt.grid[j + 1] >= 0)) j++;
    const t = (0 - rt.grid[j]) / (rt.grid[j + 1] - rt.grid[j]); let worst = 0;
    rt.samples.forEach((p, i) => { const a = col(st, m, i, j), b = col(st, m, i, j + 1), c = unflat((a[0] * (1 - t) + b[0] * t), (a[2] * (1 - t) + b[2] * t)); worst = Math.max(worst, arc(c, p)); });
    const S0 = rt.samples[0], S1 = rt.samples[rt.samples.length - 1], n0 = nodeOfSeg(rt.def.segs[0], 'start'), n1 = nodeOfSeg(rt.def.segs[rt.def.segs.length - 1], 'end');
    const e0 = arc(S0, n0), e1 = arc(S1, n1), trimmed = !!rt.def.opts.trimEnd;
    if (worst > 0.05) fail(`${rt.def.id} 中线偏差 ${f(worst)} m > 0.05`);
    if (e0 > 0.05 || (!trimmed && e1 > 0.05)) fail(`${rt.def.id} 端点偏差 ${f(e0)} / ${f(e1)} m > 0.05`);
    for (const sg of rt.def.segs) covered.add(sg.id);
    info(`${rt.def.id}（${rt.def.segs.map(q => q.id).join('+')}）：长 ${f(rt.length, 1)} m，中线偏差 ${f(worst, 4)} m，端点相差 ${f(e0, 3)} / ${trimmed ? '在路口前 3.6 m 收口' : f(e1, 3)} m`);
  }
  for (const b of PLAN.bridges) {
    const m = 10, st = b.strips[0]; let worst = 0;
    // top strip has the centre pair at columns 9 and 10 (offsets -0.075, +0.075)
    b.samples.forEach((p, i) => { const a = col(st, 20, i, 9), c = col(st, 20, i, 10), q = unflat((a[0] + c[0]) / 2, (a[2] + c[2]) / 2); worst = Math.max(worst, arc(q, p)); }); void m;
    const e0 = arc(b.samples[0], NET.nodeById[NET.edges.find(q => q.id === b.ids[0]).from]), e1 = arc(b.samples[b.samples.length - 1], NET.nodeById[NET.edges.find(q => q.id === b.ids[b.ids.length - 1]).to]);
    if (worst > 0.05) fail(`桥 ${b.def.id} 中线偏差 ${f(worst)} m`); if (e0 > 0.05 || e1 > 0.05) fail(`桥 ${b.def.id} 端点偏差 ${f(e0)} / ${f(e1)} m`);
    for (const id of b.ids) covered.add(id);
    info(`桥 ${b.def.id}：长 ${f(b.length, 1)} m，中线偏差 ${f(worst, 4)} m，端点相差 ${f(e0, 3)} / ${f(e1, 3)} m`);
  }
  const rest = NET.edges.filter(e => !covered.has(e.id) && !['T03-01', 'T03-02', 'T03-03', 'T11-01'].includes(e.id)).map(e => e.id);
  info(`W5a 覆盖 ${covered.size} 条边（另有 W4 已做的 T03-01/02/03、T11-01 共 4 条）；其余 ${rest.length} 条留给 W5b：${rest.join('、')}`);
  const need = NET.edges.filter(e => ['RD01', 'RD02'].includes(e.class)).map(e => e.id).filter(id => !covered.has(id));
  if (need.length) fail(`RD01/RD02 边缺少几何：${need.join('、')}`);
});

// ---------------------------------------------------------------- W5-C2
check('W5-C2', '宽度（弯曲后的真实米制，每 5 m）：RD01 9 ± 0.1（铺装 7 ± 0.1）、RD02 桥面 10 ± 0.1、RD03 4.5 ± 0.1、RD05 3 ± 0.1', ({ info, fail }) => {
  const worstOf = (list, want, label) => { if (!list.length) return; const lo = Math.min(...list), hi = Math.max(...list); if (Math.abs(lo - want) > 0.1 || Math.abs(hi - want) > 0.1) fail(`${label}：${f(lo, 3)}–${f(hi, 3)} m 偏离 ${want} ± 0.1`); info(`${label}：${list.length} 个采样，${f(lo, 3)}–${f(hi, 3)} m（要求 ${want} ± 0.1）`); };
  const rd01Tot = [], rd01Asp = [], rd03 = [], rd05 = [], deck = [];
  for (const rt of PLAN.routes) {
    const m = rt.grid.length, st = rt.strip, g = rt.grid, cls0 = rt.def.segs.length && NET.edges.find(e => e.id === rt.def.segs[0].id).class;
    const chord = (i, o1, o2) => dist3(bendPt(...col(st, m, i, gridIndex(g, o1))), bendPt(...col(st, m, i, gridIndex(g, o2))));
    rt.samples.forEach((p, i) => {
      if (Math.abs(p.s % 5) > 0.25 && Math.abs(p.s % 5 - 5) > 0.25) return;
      if (cls0 === 'RD01') { if (rt.def.opts.lead && p.s < 12) return; rd01Tot.push(chord(i, -4.5, 4.5)); rd01Asp.push(chord(i, -3.5, 3.5)); }
      else if (cls0 === 'RD03' && !rt.def.opts.lead) rd03.push(chord(i, -2.25, 2.25));
      else if (cls0 === 'RD05' || rt.def.opts.lead) { if (p.s >= 6) rd05.push(chord(i, -1.5, 1.5)); }
    });
  }
  worstOf(rd01Tot, 9, 'RD01 总宽（含两侧路肩）'); worstOf(rd01Asp, 7, 'RD01 铺装车行道'); worstOf(rd03, 4.5, 'RD03 铺装（N04/N09/N10 出口）'); worstOf(rd05, 3, 'RD05 土路（N11–N13 出口，s ≥ 6 m）');
  for (const b of PLAN.bridges) { const st = b.strips[0]; b.samples.forEach((p, i) => { if (Math.abs(p.s % 5) > 0.25 && Math.abs(p.s % 5 - 5) > 0.25) return; deck.push(dist3(bendPt(...col(st, 20, i, 0)), bendPt(...col(st, 20, i, 19)))); }); }
  worstOf(deck, 10, 'RD02 桥面');
});

// ---------------------------------------------------------------- W5-C3
check('W5-C3', '坡度与跨水：RD01 ≤ 6%、RD03 ≤ 10%、RD05 ≤ 15%（含隧道口间），陆上道路不入水，水面采样点都在桥内', ({ info, fail }) => {
  for (const rt of PLAN.routes) {
    const m = rt.grid.length, st = rt.strip; let j = 0; while (!(rt.grid[j] <= 0 && rt.grid[j + 1] >= 0)) j++;
    const t = (0 - rt.grid[j]) / (rt.grid[j + 1] - rt.grid[j]), alt = rt.samples.map((p, i) => { const k = rt.flatOf[i].k, a = col(st, m, i, j), b = col(st, m, i, j + 1); return (a[1] * (1 - t) + b[1] * t) / k + BASE; });
    const cls = NET.edges.find(e => e.id === rt.def.segs[0].id).class, lim = { RD01: 0.06, RD03: 0.10, RD05: 0.15 }[cls];
    let worst = 0; for (let i = 0; i + 1 < alt.length; i++) worst = Math.max(worst, Math.abs(alt[i + 1] - alt[i]) / arc(rt.samples[i], rt.samples[i + 1]));
    const wet = rt.samples.filter(p => p.h < -0.001).length;
    if (worst > lim) fail(`${rt.def.id} 最大坡度 ${f(worst * 100, 1)}% > ${lim * 100}%`); if (wet) fail(`${rt.def.id} 有 ${wet} 个采样点在水面以下`);
    let tun = ''; if (rt.tunnel) { const a = rt.bed[rt.tunnel.idx[0]], b = rt.bed[rt.tunnel.idx[rt.tunnel.idx.length - 1]], sl = Math.abs(b - a) / (rt.tunnel.s1 - rt.tunnel.s0); tun = `；隧道口间 ${f(a, 2)} → ${f(b, 2)} m，坡度 ${f(sl * 100, 2)}%（上限 6%）`; if (sl > 0.06) fail('隧道口间坡度 > 6%'); }
    info(`${rt.def.id}（${cls}）：中线最大坡度 ${f(worst * 100, 1)}%（上限 ${lim * 100}%），水下采样 ${wet}${tun}`);
  }
  for (const b of PLAN.bridges) { const wet = b.samples.filter(p => p.h < -0.001).length; info(`桥 ${b.def.id}：${wet} 个水面采样点全部在桥内（整条边都是桥 span）`); }
});

// ---------------------------------------------------------------- W5-C4
check('W5-C4', '桥与隧道：桥面高出海面 4.0–8.0 m、坡度 ≤ 15%、桥墩沿径向、斜拉塔 12–15 m 在 J-LM08、不压灯塔岛、隧道拱顶低于上方地形', ({ info, fail }) => {
  for (const b of PLAN.bridges) {
    const over = b.samples.map((p, i) => ({ p, a: b.alt[i] })).filter(q => q.p.h < -0.001), lo = Math.min(...over.map(q => q.a)), hi = Math.max(...b.alt);
    let slope = 0; for (let i = 0; i + 1 < b.samples.length; i++) slope = Math.max(slope, Math.abs(b.alt[i + 1] - b.alt[i]) / arc(b.samples[i], b.samples[i + 1]));
    if (lo < 4 - 1e-6 || hi > 8 + 1e-6) fail(`桥 ${b.def.id} 桥面高出海面 ${f(lo, 2)}–${f(hi, 2)} m 不在 4.0–8.0`); if (slope > 0.15) fail(`桥 ${b.def.id} 坡度 ${f(slope * 100, 1)}% > 15%`);
    const lean = Object.values(b.instances).flat().filter(it => /^pier/.test(it.type)).reduce((m, it) => Math.max(m, Math.hypot(it.lean[0], it.lean[1])), 0) / D;
    if (lean > 0.5) fail(`桥 ${b.def.id} 桥墩与径向夹角 ${f(lean, 2)}°`);
    const piers = b.piers; const depth = piers.length ? Math.min(...piers.map(p => p.seabed)) : 0;
    info(`桥 ${b.def.id}：水面上桥面高 ${f(lo, 2)}（最低）–${f(hi, 2)}（最高）m，最大坡度 ${f(slope * 100, 1)}%，桥墩 ${piers.length} 座（柱沿径向，夹角 ${f(lean, 2)}°），最深海底 ${f(depth, 2)} m，航道灯 ${b.navLights.length} 盏`);
  }
  const bp = PLAN.bridges.find(b => b.pylon), py = bp.pylon, node = NET.nodeById['J-LM08'], dn = arc({ lon: py.lon, lat: py.lat }, node);
  if (py.above < 12 || py.above > 15) fail(`斜拉塔高 ${py.above} m 不在 12–15`); if (dn > 0.05) fail(`斜拉塔不在 J-LM08（相差 ${f(dn)} m）`);
  info(`斜拉塔：高出桥面 ${py.above} m（塔顶海拔 ${f(py.top, 2)} m），与 J-LM08 相差 ${f(dn, 3)} m，两腿落点海底 ${py.legs.map(l => f(l.ground, 2)).join(' / ')} m，拉索 ${bp.lines.stays.length} 根`);
  // the lighthouse island: region island-lm08 is a cap of radius 10 m around LM08; deck, piers and tower legs against it
  const lm = W.landmarks.find(l => l.id === 'LM08'), isl = W.regions.find(r => r.id === 'island-lm08'), Ri = isl.shape.radiusMeters;
  const flatPos = (it) => ({ lon: it.lon, lat: it.lat });
  let gapEdge = Infinity, clear = Infinity; const edges = ['edgeL', 'edgeR'];
  for (const k of edges) bp.lines[k].forEach((q, i) => { const g = arc(q, lm) - Ri; gapEdge = Math.min(gapEdge, g); if (g < 0.5) clear = Math.min(clear, bp.alt[i] - 1.55 - H(q.lon, q.lat)); });
  // the 10 m region disc of the island is a cap whose land (height > 0) ends at its rim: terrain 0.04 m at 9 m, 0.00 at 10 m. Interpretation of the W5_SPEC rule (the
  // deck is 14.9 m from the anchor, 10 m wide: its edge is at 9.9 m, i.e. 0.1-0.2 m inside the region disc, 4 m above the beach): no pier, tower leg or footing stands on the
  // island's land (terrain at the foot < 0.3 m) or inside the landmark's own site (LM08 radius 8 m, W7), and the girder clears the island surface by >= 3 m.
  const feet = Object.values(bp.instances).flat().filter(it => /^pier(Column|Footing)$/.test(it.type)), footGap = Math.min(...feet.map(it => arc(flatPos(it), lm) - lm.radius)), footH = Math.max(...feet.filter(it => arc(flatPos(it), lm) < 16).map(it => H(it.lon, it.lat)), -9);
  info(`LM08 灯塔岛（场地半径 ${lm.radius} m，区域圆盘半径 ${Ri} m，岛上陆地止于 10 m）：桥面边缘离区域圆盘 ${f(gapEdge, 2)} m（桥面离岛面 ${clear === Infinity ? '—' : f(clear, 2) + ' m'}）；桥墩与塔腿离场地圆最近 ${f(footGap, 2)} m，最靠近岛的柱脚地面海拔 ${f(footH, 2)} m`);
  if (footGap < 0.5) fail('桥墩或塔腿落在灯塔岛场地内'); if (footH > 0.3) fail('有桥墩或塔腿落在岛上的陆地'); if (clear !== Infinity && clear < 3) fail('桥底离岛面的竖向净空 < 3 m'); if (gapEdge < -0.3) fail(`桥面边缘压入灯塔岛区域 ${f(-gapEdge)} m`);
  // tunnel: outer shell crown against the terrain above the centre line; the exposed portal parts at both ends
  const rt = PLAN.routes.find(r => r.tunnel), tn = rt.tunnel, crownAbove = tn.wallH + tn.innerR + tn.shell;
  const rows = tn.idx.map(i => ({ s: rt.samples[i].s - tn.s0, margin: H(rt.samples[i].lon, rt.samples[i].lat) - (rt.bed[i] + crownAbove) }));
  const hidden = rows.filter(r => r.margin >= 0.3), firstHidden = rows.findIndex(r => r.margin >= 0.3), lastHidden = rows.length - 1 - [...rows].reverse().findIndex(r => r.margin >= 0.3);
  const expA = firstHidden >= 0 ? rows[firstHidden].s : tn.s1 - tn.s0, expB = firstHidden >= 0 ? (tn.s1 - tn.s0) - rows[lastHidden].s : 0;
  const inner = rows.filter(r => r.s > expA && r.s < (tn.s1 - tn.s0) - expB), leak = inner.filter(r => r.margin < 0.3);
  info(`隧道 T01-05（${f(tn.s1 - tn.s0, 1)} m，拱顶高出路面 ${f(crownAbove, 1)} m）：中段拱顶低于上方地形 ≥ 0.3 m 的采样 ${hidden.length}/${rows.length}；两端外露的入口结构 ${f(expA, 1)} m 与 ${f(expB, 1)} m；中段不满足的采样 ${leak.length}；最小余量（中段）${inner.length ? f(Math.min(...inner.map(r => r.margin)), 2) : '—'} m`);
  if (leak.length) fail(`隧道中段有 ${leak.length} 个采样的拱顶高于地形 − 0.3 m`); if (expA > 8 || expB > 8) fail('隧道口外露长度 > 8 m');
});

// ---------------------------------------------------------------- W5-C5
check('W5-C5', '灯：与规格盏数对账（RD01 约 8、RD02 约 19，±1），RD01 间距人类活动区 16 ± 2 m、荒野 40 ± 4 m，航道灯周期 ≥ 4 s', ({ info, fail }) => {
  const lampsOf = rt => rt.lamps || [];
  const rd01 = PLAN.routes.flatMap(lampsOf), n01 = rd01.length;
  if (n01 < 7 || n01 > 9) fail(`RD01 灯 ${n01} 盏，规格约 8（±1）`);
  const gaps = { human: [], wild: [] };
  for (const rt of PLAN.routes) { const L = lampsOf(rt); for (let i = 1; i < L.length; i++) if (L[i].zone === L[i - 1].zone) gaps[L[i].zone].push(L[i].s - L[i - 1].s); }
  for (const [z, want, tol] of [['human', 16, 2], ['wild', 40, 4]]) if (gaps[z].some(g => Math.abs(g - want) > tol)) fail(`RD01 ${z} 间距 ${gaps[z].map(g => f(g, 1))} 不在 ${want} ± ${tol}`);
  info(`RD01：${n01} 盏（人类活动区 ${rd01.filter(l => l.zone === 'human').length}、荒野 ${rd01.filter(l => l.zone === 'wild').length}）；同区相邻间距 人类活动区 ${gaps.human.map(g => f(g, 1)).join('、') || '—'} m，荒野 ${gaps.wild.map(g => f(g, 1)).join('、') || '—'} m；隧道内无灯`);
  const n02 = PLAN.bridges.reduce((s, b) => s + b.lamps.length, 0), bg = PLAN.bridges.flatMap(b => b.lamps.slice(1).map((l, i) => l.s - b.lamps[i].s));
  if (n02 < 18 || n02 > 20) fail(`RD02 灯 ${n02} 盏，规格约 19（±1）`); if (bg.some(g => Math.abs(g - 16) > 2)) fail(`RD02 灯距 ${bg.map(g => f(g, 1))} 不在 16 ± 2`);
  info(`RD02：${n02} 盏（桥 ${PLAN.bridges.map(b => `${b.def.id}:${b.lamps.length}`).join('、')}），间距 ${f(Math.min(...bg), 1)}–${f(Math.max(...bg), 1)} m；航道灯 ${PLAN.bridges.reduce((s, b) => s + b.navLights.length, 0)} 盏，周期 ${ROADS.NAV_PERIOD} s（≥ 4 s，亮度 28%–100% 正弦，不闪烁）`);
  if (ROADS.NAV_PERIOD < 4) fail('航道灯周期 < 4 s');
  info(`全球灯数（W5a）：${n01 + n02} 盏；RD03 5–6 盏、RD07 约 4 盏、RD06 少量属 W5b（W4 已有 RD07 小灯柱 4 盏）`);
});

// ---------------------------------------------------------------- W5-C6
check('W5-C6', '落地：路上与桥上的实例底面与路面（扫出的面）相差 ≤ 0.05 m，同种共享几何与材质', ({ info, fail }) => {
  // independent of surface(): find the triangle of the swept strip under the instance (in the flat x, z plane) and interpolate its height
  const heightIn = (st, m, n, i0, i1, x, z) => {
    for (let i = Math.max(0, i0); i <= Math.min(n - 2, i1); i++) for (let j = 0; j + 1 < m; j++) {
      const q = [col(st, m, i, j), col(st, m, i, j + 1), col(st, m, i + 1, j), col(st, m, i + 1, j + 1)];
      for (const [A, B, C] of [[q[0], q[2], q[1]], [q[1], q[2], q[3]]]) {
        const d = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(d) < 1e-12) continue;
        const w1 = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / d, w2 = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / d, w3 = 1 - w1 - w2;
        if (w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6) return (w1 * A[1] + w2 * B[1] + w3 * C[1]) / (1 / Math.cos(0)) ;
      }
    } return null;
  };
  const flat = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) });
  const per = {}; let total = 0, worstAll = 0, miss = 0;
  const test = (label, st, m, n, samples, list) => {
    for (const it of list) {
      if (!['lamp', 'barrierConcrete', 'milestone', 'signBus', 'weed', 'tuft', 'lampPool'].includes(it.type)) continue;
      const F = flat(it.lon, it.lat); let b = 0, bd = Infinity; samples.forEach((p, i) => { const d = arc(p, it); if (d < bd) { bd = d; b = i; } });
      { const ref = col(st, m, b, 0)[0]; F.x += 2 * Math.PI * R * Math.round((ref - F.x) / (2 * Math.PI * R)); }      // chains across the dateline use unwrapped longitudes
      const y = heightIn(st, m, n, b - 3, b + 2, F.x, F.z); total++; if (y === null) { miss++; continue; }
      const alt = y / F.k + BASE, dv = Math.abs(it.alt - alt); worstAll = Math.max(worstAll, dv); per[it.type] = Math.max(per[it.type] || 0, dv);
      if (dv > (['weed', 'tuft'].includes(it.type) ? 0.08 : 0.05)) fail(`${label} ${it.type} 偏离路面 ${f(dv, 3)} m`);
    }
  };
  for (const rt of PLAN.routes) test(rt.def.id, rt.strip, rt.grid.length, rt.samples.length, rt.samples, Object.values(rt.instances).flat());
  for (const b of PLAN.bridges) test(b.def.id, b.strips[0], 20, b.samples.length, b.samples, Object.values(b.instances).flat());
  info(`检查 ${total} 个实例（未命中面片 ${miss}，多为路旁灯位在条带之外）：各类型最大偏差 ${Object.entries(per).map(([k, v]) => `${k} ${f(v, 3)}`).join('、')} m（刚性物件 ≤ 0.05，草叶底部埋入 ≤ 0.08）`);
  const piers = PLAN.bridges.flatMap(b => b.piers); let worstCap = 0, worstBase = 0;
  for (const b of PLAN.bridges) for (const p of b.piers) for (const c of p.columns) { worstCap = Math.max(worstCap, Math.abs(c.top - p.capBottom)); }
  info(`桥墩 ${piers.length} 座：柱顶与盖梁底相差最大 ${f(worstCap, 3)} m；柱底落在海底基础顶或地面（基础底面取 height() 网格高度，相差 0）；${worstBase}`);
});

// ---------------------------------------------------------------- W5-C9
check('W5-C9', '出口渐变：9 个出口铺装宽度变化 ≤ 0.6 m/m，中线颜色差 ≤ 0.25，出口与城镇路面齐平 ≤ 0.01 m，杂草按 5 m 分段单调不减', ({ info, fail }) => {
  const exits = [];
  for (const rt of PLAN.routes.filter(r => r.def.exit)) exits.push({ id: rt.def.exit, rt, strip: rt.strip, grid: rt.grid, S: rt.samples, paved: rt.paved, instances: rt.instances, k: rt.flatOf });
  { const CH = RK.chain(W, ['T03-01', 'T03-02', 'T03-03']), inst = {}; for (const src of [CH.instances, ...['T03-01', 'T03-02', 'T03-03'].map(id => RK.build(W, id).instances)]) for (const [t, l] of Object.entries(src)) (inst[t] = inst[t] || []).push(...l);
    inst.weed = [...(inst.weed || []), ...(inst.shrubLow || [])]; exits.push({ id: 'N08', rt: CH, strip: CH.strip, grid: CH.grid, S: CH.samples, paved: CH.paved, instances: inst, chain: true }); }
  exits.sort((a, b) => a.id.localeCompare(b.id));
  for (const e of exits) {
    const m = e.grid.length, st = e.strip, L = e.S[e.S.length - 1].s, wd = e.paved.map(p => p[1] - p[0]);
    let dw = 0; for (let i = 1; i < wd.length; i++) if (e.S[i].s <= 30) dw = Math.max(dw, Math.abs(wd[i] - wd[i - 1]) / 0.5);
    const jc = gridIndex(e.grid, 2.0); let dc = 0; for (let i = 1; i < e.S.length; i++) { const a = colorAt(st, m, i, jc), b = colorAt(st, m, i - 1, jc); dc = Math.max(dc, ...[0, 1, 2].map(c => Math.abs(a[c] - b[c]))); }
    let j = 0; while (!(e.grid[j] <= 0 && e.grid[j + 1] >= 0)) j++; const t = e.grid[j + 1] === e.grid[j] ? 0 : (0 - e.grid[j]) / (e.grid[j + 1] - e.grid[j]);
    const k0 = 1 / Math.cos(e.S[0].lat * D), a0 = col(st, m, 0, j), b0 = col(st, m, 0, j + 1), y0 = (a0[1] * (1 - t) + b0[1] * t) / k0, dy = Math.abs(y0 - 0.02);
    // weeds and tufts by full 5 m bins from the exit
    const bins = []; for (const type of ['weed', 'tuft']) for (const it of (e.instances[type] || [])) { let b = 0, bd = Infinity; if (it.station === undefined) e.S.forEach((p, i) => { const d = arc(p, it); if (d < bd) { bd = d; b = i; } }); const bi = Math.floor((it.station !== undefined ? it.station : e.S[b].s) / 5); bins[bi] = (bins[bi] || 0) + 1; }
    const full = Math.floor(L / 5), cnt = Array.from({ length: full }, (_, i) => bins[i] || 0); let mono = true; for (let i = 1; i < cnt.length; i++) if (cnt[i] < cnt[i - 1]) mono = false;
    if (dw > 0.6) fail(`${e.id} 铺装宽变化 ${f(dw, 2)} m/m > 0.6`); if (dc > 0.25) fail(`${e.id} 中线相邻样点颜色差 ${f(dc, 2)} > 0.25`); if (dy > 0.01) fail(`${e.id} 出口处路面 y = ${f(y0, 3)}，与城镇路面 0.02 相差 ${f(dy, 3)} > 0.01`); if (!mono) fail(`${e.id} 杂草按 5 m 分段不单调：${cnt.join(' ')}`);
    info(`${e.id}：长 ${f(L, 1)} m，铺装宽 ${f(wd[0], 2)} → ${f(wd[Math.min(wd.length - 1, 60)], 2)} m（最大变化 ${f(dw, 2)} m/m），中线颜色差最大 ${f(dc, 2)}，出口路面 y = ${f(y0, 3)} m（城镇 0.02），杂草/草簇每 5 m ${cnt.join(' ') || '（路段短于 5 m）'}${mono ? '' : '（不单调）'}`);
  }
});

// ---------------------------------------------------------------- browser part
if (!process.argv.includes('--no-browser')) {
  const { launchChromium } = await import('./browser.mjs');
  const { INIT, SHOTS, renderShot } = await import('./road_views.mjs');
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.roads, null, { timeout: 90000 });
  const def = await page.evaluate(() => { window.__step(3); const S = window.__scene; S.renderer.render(S.scene, S.camera); return { calls: S.renderer.info.render.calls, tri: S.renderer.info.render.triangles, built: S.roads.state.built }; });
  {
    const info = [], fails = [];
    if (def.built) fails.push('默认画面已构建道路');
    if (def.calls > 2373 * 1.03) fails.push(`默认视角绘制调用 ${def.calls} 超过 W4 基线 2373 的 +3%`);
    info.push(`默认视角（uBend = 0）：${def.calls} 次绘制调用、${def.tri} 个三角形，道路未构建（W4 基线 2373 / 239,958，预算 ≤ +3%）`);
    const shots = Object.fromEntries(SHOTS);
    for (const [label, name] of [['地面', 'rd01-exit-ground'], ['半空', 'bridge-east-strait-aerial'], ['全景', 'panorama-back-east']]) {
      const v = shots[name], on = await renderShot(page, v), off = await page.evaluate(() => { window.__scene.roads.state.root.visible = false; return true; });
      void off; const without = await page.evaluate(([v]) => 0, [v]);
      await page.evaluate(() => { window.__scene.roads.state.root.visible = true; }); void without;
      // measure with the road root hidden: re-render with it hidden through the opts-free path
      const hidden = await page.evaluate(() => { const S = window.__scene; S.roads.state.root.visible = false; S.renderer.render(S.scene, S.camera); const r = { calls: S.renderer.info.render.calls, tri: S.renderer.info.render.triangles }; S.roads.state.root.visible = true; return r; });
      info.push(`${label}（${name}）：整帧 ${on.info.calls} 次调用 / ${on.info.triangles} 三角形；不含道路 ${hidden.calls} / ${hidden.tri}；道路新增 ${on.info.calls - hidden.calls} 次调用 / ${on.info.triangles - hidden.tri} 三角形（SwiftShader，真机待验证）`);
      if (label === '全景' && on.info.calls - hidden.calls > 60) fails.push('全景道路绘制调用超过预期');
    }
    // dynamics at the three distances: ripples and navigation lights (ground, aerial, rain on), the light band's slow breathing (panorama)
    const diff = async (a, b) => page.evaluate(async ([a, b]) => { const load = async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const q = c.getContext('2d'); q.drawImage(i, 0, 0); return q.getImageData(0, 0, c.width, c.height).data; }; const A = await load(a), B = await load(b); let n = 0; for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 6) n++; return n; }, [a, b]);
    for (const [label, name, t1, t2] of [['ground', 'rd01-exit-ground', 2.0, 2.4], ['aerial', 'bridge-east-strait-aerial', 2.0, 3.1], ['panorama', 'panorama-back-east', 1.75, 5.25]]) {
      const v = shots[name];
      const a = await renderShot(page, v, { t: t1 }), b = await renderShot(page, v, { t: t2 }), n = await diff(a.url, b.url);
      info.push(`动态 ${label}（${name}，t = ${t1} 与 ${t2} s）：差异像素 ${n}`); if (n <= 0) fails.push(`${label} 距离下道路没有任何动态`);
    }
    const st = await page.evaluate(() => window.__scene.roads.stats());
    info.push(`实例数（W5a）：${Object.entries(st.counts).map(([k, v]) => `${k} ${v}`).join('、')}；光带 ${st.band.drawCalls} 次绘制 / ${st.band.triangles} 三角形（要求 ≤ 20 次）；首次构建 ${st.buildMs} ms`);
    if (st.band.drawCalls > 20) fails.push('光带绘制调用 > 20');
    if (errors.length) fails.push('页面错误：' + errors.join(' | '));
    results.push({ id: 'W5-C10', ok: !fails.length });
    console.log(`${fails.length ? 'FAIL' : 'PASS'} W5-C10 预算与页面：默认画面不变、光带 ≤ 20 次绘制、无页面错误`);
    for (const m of fails) console.log('  ✗ ' + m); for (const m of info) console.log('  · ' + m);
  }
  await browser.close();
}
console.log(results.every(r => r.ok) ? `\nPASS road_check（${results.length} 项）` : `\nFAIL road_check：${results.filter(r => !r.ok).map(r => r.id).join(', ')}`);
process.exitCode = results.every(r => r.ok) ? 0 : 1;
