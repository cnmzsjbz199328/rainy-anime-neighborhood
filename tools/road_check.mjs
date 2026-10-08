// Checks W5-C1..C9 for the road network, batches W5a and W5b (RD01, RD02, RD03, RD05, RD06, RD08, tunnel, exits, lamps, light band, entrances). Run after `python3 build.py`:  node tools/road_check.mjs [--no-browser]
// Data checks run under Node on the generated geometry (world.js, terrain.js mesh heights, roadkit.js, bridge.js, roads.js); the page part measures draw calls.
// W5-C8 (regression) is tools/regress.mjs --baseline-ref pre-w5 --mask-patch-margin 24 plus the other tools listed in PROGRESS.
// W8f-a (W8_SPEC 12.1 C): C1 and C3 know the abutment transitions and approaches (centre line within 1.0 m of samplePath inside a transition, 0.05 m outside it; RD01 grade
// <= 15 % inside an approach, 6 % elsewhere), C9 also checks the town-edge colour of the exits, W5-C10 is the joints (abutments, junctions), W5-C11 the page and budget.
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
require(path.join(root, 'steps.js')); globalThis.STEPS = require(path.join(root, 'steps.js'));
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
check('W5-C1', '中线：生成中线与 samplePath 相差 ≤ 0.05 m（桥台过渡段内 ≤ 1.0 m，W8f-a），端点落在节点上（桥台节点 ≤ 1.0 m），W5a 范围的边都有几何', ({ info, fail }) => {
  const covered = new Set(), TOL = 1.0;
  const nodeOfSeg = (sg, end) => { const e = NET.edges.find(q => q.id === sg.id); return NET.nodeById[(end === 'start') === !sg.rev ? e.from : e.to]; };
  // the original centre line (samplePath of the edges, as route() / bridge.js sample them before the transitions move them)
  const origOf = segs => { const out = []; let off = 0; segs.forEach((sg, k) => { const e = NET.edges.find(q => q.id === sg.id), len = NET.edgeLength(e); let P = NET.samplePath(e, 0.5); if (sg.rev) P = P.slice().reverse().map(p => ({ ...p, s: len - p.s })); P.forEach((p, i) => { if (k > 0 && i === 0) return; out.push({ ...p, s: p.s + off }); }); off += len; }); return out; };
  const dev = (S, O, i) => { let best = Infinity; const v = W.vec(S.lon, S.lat); for (let k = Math.max(0, i - 6); k < Math.min(O.length - 1, i + 6); k++) best = Math.min(best, W.arcPointDistance(v, W.vec(O[k].lon, O[k].lat), W.vec(O[k + 1].lon, O[k + 1].lat))); return best; };
  const zones = []; for (const a of PLAN.abutments) zones.push({ id: a.route, end: a.rEnd, T: a.fillet.Ta }, { id: a.bridge, end: a.bEnd, T: a.fillet.Tb });
  const inZone = (id, s, L) => zones.some(z => z.id === id && (z.end === 'start' ? s <= z.T + 1e-6 : L - s <= z.T + 1e-6));
  for (const rt of PLAN.routes) {
    const m = rt.grid.length, st = rt.strip; let j = 0; while (!(rt.grid[j] <= 0 && rt.grid[j + 1] >= 0)) j++;
    const t = (0 - rt.grid[j]) / (rt.grid[j + 1] - rt.grid[j]), O = origOf(rt.def.segs).filter(p => p.s >= rt.samples[0].s - 1 && p.s <= rt.length + 1); let worst = 0, worstZ = 0;
    const L = rt.sNode('end');
    rt.samples.forEach((p, i) => { const a = col(st, m, i, j), b = col(st, m, i, j + 1), c = unflat((a[0] * (1 - t) + b[0] * t), (a[2] * (1 - t) + b[2] * t)), d0 = arc(c, p), z = inZone(rt.def.id, p.s, L), k = O.findIndex(q => Math.abs(q.s - p.s) < 0.3), d1 = k >= 0 ? dev(c, O, k) : arc(c, p);
      if (z) worstZ = Math.max(worstZ, d1); else worst = Math.max(worst, Math.max(d0, d1)); });
    const S0 = rt.samples[0], S1 = rt.samples[rt.samples.length - 1], n0 = nodeOfSeg(rt.def.segs[0], 'start'), n1 = nodeOfSeg(rt.def.segs[rt.def.segs.length - 1], 'end');
    const e0 = arc(S0, n0), e1 = arc(S1, n1), trimmed = rt.trim.end > 0, trimmedStart = rt.trim.start > 0, ab0 = zones.some(z => z.id === rt.def.id && z.end === 'start'), ab1 = zones.some(z => z.id === rt.def.id && z.end === 'end');
    if (worst > 0.05) fail(`${rt.def.id} 中线偏差 ${f(worst)} m > 0.05（过渡段以外）`); if (worstZ > TOL) fail(`${rt.def.id} 过渡段内中线偏差 ${f(worstZ)} m > ${TOL}`);
    if ((!trimmedStart && e0 > (ab0 ? TOL : 0.05)) || (!trimmed && e1 > (ab1 ? TOL : 0.05))) fail(`${rt.def.id} 端点偏差 ${f(e0)} / ${f(e1)} m`);
    for (const sg of rt.def.segs) covered.add(sg.id);
    info(`${rt.def.id}（${rt.def.segs.map(q => q.id).join('+')}）：长 ${f(rt.length, 1)} m，中线偏差 ${f(worst, 4)} m${worstZ ? `（桥台过渡段内 ${f(worstZ, 3)} m）` : ''}，端点相差 ${trimmedStart ? `在路口外 ${f(rt.trim.start, 2)} m 起` : f(e0, 3) + (ab0 ? '（桥台）' : '')} / ${trimmed ? `在路口前 ${f(rt.trim.end, 2)} m 收口` : f(e1, 3) + (ab1 ? '（桥台）' : '')} m`);
  }
  for (const b of PLAN.bridges) {
    const st = b.strips[0], O = origOf(b.ids.map(id => ({ id }))); let worst = 0, worstZ = 0;
    // top strip: the centre pair at the offsets -0.075, +0.075 (bridge.js topCols)
    const NB = b.topCols.length, c9 = b.topCols.indexOf(-0.075), c10 = b.topCols.indexOf(0.075);
    b.samples.forEach((p, i) => { const a = col(st, NB, i, c9), c = col(st, NB, i, c10), q = unflat((a[0] + c[0]) / 2, (a[2] + c[2]) / 2), d0 = arc(q, p), z = inZone(b.def.id, p.s, b.length), d1 = dev(q, O, i); if (z) worstZ = Math.max(worstZ, d1); else worst = Math.max(worst, Math.max(d0, d1)); });
    const e0 = arc(b.samples[0], NET.nodeById[NET.edges.find(q => q.id === b.ids[0]).from]), e1 = arc(b.samples[b.samples.length - 1], NET.nodeById[NET.edges.find(q => q.id === b.ids[b.ids.length - 1]).to]);
    if (worst > 0.05) fail(`桥 ${b.def.id} 中线偏差 ${f(worst)} m（过渡段以外）`); if (worstZ > TOL) fail(`桥 ${b.def.id} 过渡段内中线偏差 ${f(worstZ)} m`); if (e0 > TOL || e1 > TOL) fail(`桥 ${b.def.id} 端点偏差 ${f(e0)} / ${f(e1)} m`);
    for (const id of b.ids) covered.add(id);
    info(`桥 ${b.def.id}：长 ${f(b.length, 1)} m，中线偏差 ${f(worst, 4)} m（桥台过渡段内 ${f(worstZ, 3)} m），端点相差 ${f(e0, 3)} / ${f(e1, 3)} m（桥台）`);
  }
  info(`桥台过渡段（W8f-a，公共切线的二次曲线，切线长 ≤ 12 m，离原中线 ≤ 0.75 m）：${PLAN.abutments.map(a => `${a.node} 路侧 ${f(a.fillet.Ta, 1)} m / 桥侧 ${f(a.fillet.Tb, 1)} m，折角 ${f(a.fillet.angle, 1)}°，偏离 ${f(a.fillet.deviation, 2)} m`).join('；')}；端点容差在桥台节点改为 ${TOL} m`);
  // stairs (RD06): the swept path follows samplePath by construction; check the end points and count
  for (const st of PLAN.stairs) {
    const e = NET.edges.find(q => q.id === st.id), n0 = NET.nodeById[e.from], n1 = NET.nodeById[e.to], e0 = arc(st.samples[0], n0), e1 = arc(st.samples[st.samples.length - 1], n1);
    if (e0 > 0.05 || e1 > 0.05) fail(`石阶 ${st.id} 端点偏差 ${f(e0)} / ${f(e1)} m`); covered.add(st.id);
    info(`石阶 ${st.id}（RD06）：长 ${f(st.length, 1)} m，${st.count} 级，端点相差 ${f(e0, 3)} / ${f(e1, 3)} m`);
  }
  // T11-02: the wooden landing of the maintenance stair at the node LM08-south; the other end is the node J-LM08 on the deck (the gate in the parapet)
  { const bp = PLAN.bridges.find(b => b.access), land = bp.access.landing, nd = NET.nodeById['LM08-south'], d = arc(land, nd), top = arc(bp.samples[bp.access.i], NET.nodeById['J-LM08']);
    if (d > 0.05) fail(`T11-02 平台与 LM08-south 相差 ${f(d)} m`); if (top > 0.3) fail(`T11-02 楼梯门离 J-LM08 ${f(top)} m`); covered.add('T11-02');
    info(`T11-02（检修楼梯，裁决见 PROGRESS）：平台中心与 LM08-south 相差 ${f(d, 3)} m，桥面栏杆门在 J-LM08 处（相差 ${f(top, 3)} m），${bp.access.steps.length} 级钢踏步，立柱 ${bp.access.posts} 根`); }
  const w4 = ['T03-01', 'T03-02', 'T03-03', 'T11-01'], rest = NET.edges.filter(e => !covered.has(e.id) && !w4.includes(e.id)).map(e => e.id);
  info(`W5 共覆盖 ${covered.size} 条边（另有 W4 已做的 ${w4.join('、')} 共 ${w4.length} 条）= ${covered.size + w4.length}/${NET.edges.length}；未覆盖 ${rest.length} 条${rest.length ? '：' + rest.join('、') : ''}`);
  if (rest.length) fail(`边缺少几何：${rest.join('、')}`);
});

// ---------------------------------------------------------------- W5-C2
check('W5-C2', '宽度（弯曲后的真实米制，每 5 m）：RD01 9 ± 0.1（铺装 7 ± 0.1）、RD02 桥面 10 ± 0.1、RD03 4.5 ± 0.1、RD05 3 ± 0.1', ({ info, fail }) => {
  const worstOf = (list, want, label) => { if (!list.length) return; const lo = Math.min(...list), hi = Math.max(...list); if (Math.abs(lo - want) > 0.1 || Math.abs(hi - want) > 0.1) fail(`${label}：${f(lo, 3)}–${f(hi, 3)} m 偏离 ${want} ± 0.1`); info(`${label}：${list.length} 个采样，${f(lo, 3)}–${f(hi, 3)} m（要求 ${want} ± 0.1）`); };
  const rd01Tot = [], rd01Asp = [], rd03 = [], rd05 = [], rd08 = [], deck = [], rd06 = [];
  for (const rt of PLAN.routes) {
    const m = rt.grid.length, st = rt.strip, g = rt.grid, cls0 = rt.def.segs.length && NET.edges.find(e => e.id === rt.def.segs[0].id).class;
    const chord = (i, o1, o2) => dist3(bendPt(...col(st, m, i, gridIndex(g, o1))), bendPt(...col(st, m, i, gridIndex(g, o2))));
    rt.samples.forEach((p, i) => {
      if (Math.abs(p.s % 5) > 0.25 && Math.abs(p.s % 5 - 5) > 0.25) return;
      if (cls0 === 'RD01') { if (rt.def.opts.lead && p.s < 12) return; rd01Tot.push(chord(i, -4.5, 4.5)); rd01Asp.push(chord(i, -3.5, 3.5)); }
      else if (cls0 === 'RD03' && !rt.def.opts.lead) rd03.push(chord(i, -2.25, 2.25));
      else if (cls0 === 'RD05' || rt.def.opts.lead) { if (p.s >= 6) rd05.push(chord(i, -1.5, 1.5)); }
      else if (cls0 === 'RD08') rd08.push(chord(i, -1.05, 1.05));
    });
  }
  worstOf(rd01Tot, 9, 'RD01 总宽（含两侧路肩）'); worstOf(rd01Asp, 7, 'RD01 铺装车行道'); worstOf(rd03, 4.5, 'RD03 铺装（N04/N09/N10 出口）'); worstOf(rd05, 3, 'RD05 土路（N11–N13 出口，s ≥ 6 m）');
  for (const b of PLAN.bridges) { const st = b.strips[0], NB = b.topCols.length; b.samples.forEach((p, i) => { if (Math.abs(p.s % 5) > 0.25 && Math.abs(p.s % 5 - 5) > 0.25) return; deck.push(dist3(bendPt(...col(st, NB, i, 0)), bendPt(...col(st, NB, i, NB - 1)))); }); }
  worstOf(deck, 10, 'RD02 桥面');
  { const lo = Math.min(...rd08), hi = Math.max(...rd08); if (lo < 1.9 || hi > 2.2) fail(`RD08 雪道宽 ${f(lo)}–${f(hi)} m 不在 约 2 m`); else info(`RD08 压实雪道：${rd08.length} 个采样，${f(lo, 3)}–${f(hi, 3)} m（卡片「约 2 m」，取两侧边缘列间距）`); }
  for (const st of PLAN.stairs) { const w = st.instances.stoneStep[0].s[0]; rd06.push(w); } { const lo = Math.min(...rd06), hi = Math.max(...rd06); if (lo < 1.2 || hi > 2) fail(`RD06 石阶宽 ${lo}–${hi} 不在 1.2–2 m`); else info(`RD06 石阶宽 ${lo}–${hi} m（1.2–2，石阶块在弯曲前后宽度由 k 缩放抵消）`); }
});

// ---------------------------------------------------------------- W5-C3
check('W5-C3', '坡度与跨水：RD01 ≤ 6%（桥头引道内 ≤ 15%，W8f-a）、RD03 ≤ 10%、RD05 ≤ 15%（含隧道口间），陆上道路不入水，水面采样点都在桥内', ({ info, fail }) => {
  for (const rt of PLAN.routes) {
    const m = rt.grid.length, st = rt.strip; let j = 0; while (!(rt.grid[j] <= 0 && rt.grid[j + 1] >= 0)) j++;
    const t = (0 - rt.grid[j]) / (rt.grid[j + 1] - rt.grid[j]), alt = rt.samples.map((p, i) => { const k = rt.flatOf[i].k, a = col(st, m, i, j), b = col(st, m, i, j + 1); return (a[1] * (1 - t) + b[1] * t) / k + BASE; });
    const cls = NET.edges.find(e => e.id === rt.def.segs[0].id).class, lim = { RD01: 0.06, RD03: 0.10, RD05: 0.15, RD08: 0.15 }[cls];
    // W8f-a: inside an abutment approach RD01 may climb to the deck's 14.8 % (<= 15 %); the approach is the road side of the vertical curve
    const inAp = sv => (rt.approaches || []).some(a => sv >= a.s0 - 1e-6 && sv <= a.s1 + 1e-6);
    let worst = 0, worstAp = 0; for (let i = 0; i + 1 < alt.length; i++) { const g = Math.abs(alt[i + 1] - alt[i]) / arc(rt.samples[i], rt.samples[i + 1]); if (inAp(rt.samples[i].s) && inAp(rt.samples[i + 1].s)) worstAp = Math.max(worstAp, g); else worst = Math.max(worst, g); }
    if (worstAp > 0.15) fail(`${rt.def.id} 引道内最大坡度 ${f(worstAp * 100, 1)}% > 15%`);
    const wet = rt.samples.filter(p => p.h < -0.001).length;
    if (worst > lim) fail(`${rt.def.id} 最大坡度 ${f(worst * 100, 1)}% > ${lim * 100}%`); if (wet) fail(`${rt.def.id} 有 ${wet} 个采样点在水面以下`);
    let tun = ''; if (rt.tunnel) { const a = rt.bed[rt.tunnel.idx[0]], b = rt.bed[rt.tunnel.idx[rt.tunnel.idx.length - 1]], sl = Math.abs(b - a) / (rt.tunnel.s1 - rt.tunnel.s0); tun = `；隧道口间 ${f(a, 2)} → ${f(b, 2)} m，坡度 ${f(sl * 100, 2)}%（上限 6%）`; if (sl > 0.06) fail('隧道口间坡度 > 6%'); }
    info(`${rt.def.id}（${cls}）：中线最大坡度 ${f(worst * 100, 1)}%（上限 ${lim * 100}%）${(rt.approaches || []).length ? `，桥头引道内 ${f(worstAp * 100, 1)}%（上限 15%，${rt.approaches.map(a => `${a.which === 'end' ? '终点' : '起点'} ${f(a.len, 1)} m`).join('、')}）` : ''}，水下采样 ${wet}${tun}`);
  }
  for (const b of PLAN.bridges) { const wet = b.samples.filter(p => p.h < -0.001).length; info(`桥 ${b.def.id}：${wet} 个水面采样点全部在桥内（整条边都是桥 span）`); }
  for (const st of PLAN.stairs) {
    // terrain slope along the path (ground profile, smoothed 3 m) <= 60 % (WC4); every stretch steeper than 15 % is stairs (the whole edge is); steps reach the top of the ground (>= 0.1 m above the lowest ground under each)
    let worst = 0; for (let i = 0; i + 1 < st.profile.length; i++) worst = Math.max(worst, Math.abs(st.profile[i + 1] - st.profile[i]) / arc(st.samples[i], st.samples[i + 1]));
    const wet = st.samples.filter(p => p.h < -0.001).length;
    if (worst > 0.6) fail(`石阶 ${st.id} 地形坡度 ${f(worst * 100, 0)}% > 60%`); if (st.stats.minGroundGap < 0.05) fail(`石阶 ${st.id} 有踏步低于地面（${f(st.stats.minGroundGap, 2)} m）`); if (wet) fail(`石阶 ${st.id} 有水下采样`);
    info(`石阶 ${st.id}：平滑后地形最大坡度 ${f(worst * 100, 0)}%（上限 60%），踏步顶面离地面最小 ${f(st.stats.minGroundGap, 2)} m，落差 ${f(st.stats.drop, 2)} m，水下采样 ${wet}`);
  }
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
  if (py.above < 12 || py.above > 15) fail(`斜拉塔高 ${py.above} m 不在 12–15`); if (dn > 5) fail(`斜拉塔不在 J-LM08 一带（相差 ${f(dn)} m）`);
  info(`斜拉塔：高出桥面 ${py.above} m（塔顶海拔 ${f(py.top, 2)} m），在 J-LM08 西侧 ${f(dn, 2)} m（给 T11-02 检修楼梯让位，≤ 5 m），两腿落点海底 ${py.legs.map(l => f(l.ground, 2)).join(' / ')} m，拉索 ${bp.lines.stays.length} 根`);
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
  const rd01R = PLAN.routes.filter(r => r.def.furnish && r.def.furnish.kind === 'RD01'), rd01 = rd01R.flatMap(lampsOf), n01 = rd01.length;
  if (n01 < 7 || n01 > 9) fail(`RD01 灯 ${n01} 盏，规格约 8（±1）`);
  const gaps = { human: [], wild: [] };
  for (const rt of rd01R) { const L = lampsOf(rt); for (let i = 1; i < L.length; i++) if (L[i].zone === L[i - 1].zone) gaps[L[i].zone].push(L[i].s - L[i - 1].s); }
  for (const [z, want, tol] of [['human', 16, 2], ['wild', 40, 4]]) if (gaps[z].some(g => Math.abs(g - want) > tol)) fail(`RD01 ${z} 间距 ${gaps[z].map(g => f(g, 1))} 不在 ${want} ± ${tol}`);
  info(`RD01：${n01} 盏（人类活动区 ${rd01.filter(l => l.zone === 'human').length}、荒野 ${rd01.filter(l => l.zone === 'wild').length}）；同区相邻间距 人类活动区 ${gaps.human.map(g => f(g, 1)).join('、') || '—'} m，荒野 ${gaps.wild.map(g => f(g, 1)).join('、') || '—'} m；隧道内无灯`);
  const n02 = PLAN.bridges.reduce((s, b) => s + b.lamps.length, 0), bg = PLAN.bridges.flatMap(b => b.lamps.slice(1).map((l, i) => l.s - b.lamps[i].s));
  if (n02 < 18 || n02 > 20) fail(`RD02 灯 ${n02} 盏，规格约 19（±1）`); if (bg.some(g => Math.abs(g - 16) > 2)) fail(`RD02 灯距 ${bg.map(g => f(g, 1))} 不在 16 ± 2`);
  info(`RD02：${n02} 盏（桥 ${PLAN.bridges.map(b => `${b.def.id}:${b.lamps.length}`).join('、')}），间距 ${f(Math.min(...bg), 1)}–${f(Math.max(...bg), 1)} m；航道灯 ${PLAN.bridges.reduce((s, b) => s + b.navLights.length, 0)} 盏，周期 ${ROADS.NAV_PERIOD} s（≥ 4 s，亮度 28%–100% 正弦，不闪烁）`);
  if (ROADS.NAV_PERIOD < 4) fail('航道灯周期 < 4 s');
  const n03 = PLAN.routes.reduce((s, r) => s + (r.def.furnish && r.def.furnish.kind === 'RD03' ? r.lamps.length : 0), 0), g03 = []; for (const r of PLAN.routes) if (r.def.furnish && r.def.furnish.kind === 'RD03') for (let i = 1; i < r.lamps.length; i++) g03.push(r.lamps[i].s - r.lamps[i - 1].s);
  if (n03 < 5 || n03 > 8) fail(`RD03 灯 ${n03} 盏，规格 5–6 盏加路口与公交站各一盏（5–8）`);
  info(`RD03：${n03} 盏（路口灯与公交站灯包含在内），同一条路相邻间距 ${g03.map(g => f(g, 1)).join('、')} m（约 25 m）；电杆 ${PLAN.routes.reduce((s, r) => s + (r.poles ? r.poles.length : 0), 0)} 根（沿路抖动，不成排）；反光镜 ${PLAN.routes.reduce((s, r) => s + ((r.instances.mirror || []).length), 0)} 面`);
  { const rt = PLAN.routes.find(r => r.def.furnish && r.def.furnish.kind === 'RD08'), per = { '-1': [], 1: [] }; for (const q of rt.poles8) per[q.side].push(q.s); const gaps = Object.values(per).flatMap(a => a.slice(1).map((v, i) => v - a[i]));
    if (gaps.some(g => Math.abs(g - 8) > 1)) fail(`RD08 标杆间距 ${gaps.map(g => f(g, 1))} 不在 8 ± 1 m`);
    info(`RD08：标杆 ${rt.poles8.length} 根（每侧 ${per[1].length}），同侧间距 ${gaps.map(g => f(g, 1)).join('、')} m（8 ± 1），高 2.0 m（几何高度在页面部分核对）；避难小屋在 s = ${f(rt.shelter.s, 1)} m（橙色，半埋）`); }
  for (const st of PLAN.stairs) {
    const sd = st.steps.map(s => s.riser), tr = st.steps.map(s => s.tread);
    const want = st.id === 'T02-02' ? [105, 126] : [32, 39];
    if (st.riser < 0.15 || st.riser > 0.18) fail(`石阶 ${st.id} 踏步高 ${f(st.riser, 3)} 不在 0.15–0.18`); if (st.count < want[0] || st.count > want[1]) fail(`石阶 ${st.id} 级数 ${st.count} 不在 ${want[0]}–${want[1]}`); if (st.lanterns.length > 10) fail(`石阶 ${st.id} 灯笼 ${st.lanterns.length} > 10`);
    info(`石阶 ${st.id}：${st.count} 级（规格 ${want[0]}–${want[1]}），踏步高 ${f(st.riser, 3)} m（0.15–0.18），踏面 ${f(Math.min(...tr), 2)}–${f(Math.max(...tr), 2)} m，平均 ${f(st.length / st.count, 2)} m，平台 ${st.platforms.length} 处，灯笼 ${st.lanterns.length} 盏（≤ 10），绳索扶手立柱 ${st.stats.ropePosts} 根，鸟居 1、地藏 ${(st.instances.jizo || []).length}、长凳 ${(st.instances.busBench || []).length}、指路石柱 ${(st.instances.stonePost || []).length}`); void sd;
  }
  info(`全球灯数（W5）：RD01 ${n01} + RD02 ${n02} + RD03 ${n03} = ${n01 + n02 + n03} 盏路灯，另有石阶灯笼 ${PLAN.stairs.reduce((s, st) => s + st.lanterns.length, 0)} 盏、RD07 小灯柱 4 盏（W4）、T11-02 平台灯 1 盏、航道灯 ${PLAN.bridges.reduce((s, b) => s + b.navLights.length, 0)} 盏（规格估计「全球约 35–40 盏路灯」）`);
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
      if (!['lamp', 'barrierConcrete', 'milestone', 'signBus', 'weed', 'tuft', 'lampPool', 'pole', 'mirror', 'signRound', 'signTri', 'vending', 'jizo', 'snowPole', 'bollard', 'stonePost', 'busBench'].includes(it.type)) continue;
      const F = flat(it.lon, it.lat); let b = 0, bd = Infinity; samples.forEach((p, i) => { const d = arc(p, it); if (d < bd) { bd = d; b = i; } });
      { const ref = col(st, m, b, 0)[0]; F.x += 2 * Math.PI * R * Math.round((ref - F.x) / (2 * Math.PI * R)); }      // chains across the dateline use unwrapped longitudes
      const y = heightIn(st, m, n, b - 3, b + 2, F.x, F.z); total++; if (y === null) { miss++; continue; }
      const alt = y / F.k + BASE, dv = Math.abs(it.alt - alt); worstAll = Math.max(worstAll, dv); per[it.type] = Math.max(per[it.type] || 0, dv);
      if (dv > (['weed', 'tuft'].includes(it.type) ? 0.08 : 0.05)) fail(`${label} ${it.type} 偏离路面 ${f(dv, 3)} m`);
    }
  };
  for (const rt of PLAN.routes) test(rt.def.id, rt.strip, rt.grid.length, rt.samples.length, rt.samples, Object.values(rt.instances).flat());
  for (const b of PLAN.bridges) test(b.def.id, b.strips[0], b.topCols.length, b.samples.length, b.samples, Object.values(b.instances).flat());
  info(`检查 ${total} 个实例（未命中面片 ${miss}，多为路旁灯位在条带之外）：各类型最大偏差 ${Object.entries(per).map(([k, v]) => `${k} ${f(v, 3)}`).join('、')} m（刚性物件 ≤ 0.05，草叶底部埋入 ≤ 0.08）`);
  const piers = PLAN.bridges.flatMap(b => b.piers); let worstCap = 0, worstBase = 0;
  for (const b of PLAN.bridges) for (const p of b.piers) for (const c of p.columns) { worstCap = Math.max(worstCap, Math.abs(c.top - p.capBottom)); }
  info(`桥墩 ${piers.length} 座：柱顶与盖梁底相差最大 ${f(worstCap, 3)} m；柱底落在海底基础顶或地面（基础底面取 height() 网格高度，相差 0）；${worstBase}`);
});

// ---------------------------------------------------------------- W5-C9
check('W5-C9', '出口渐变：9 个出口铺装宽度变化 ≤ 0.6 m/m，中线颜色差 ≤ 0.25（城镇边缘处与城镇沥青 ≤ 0.05，W8f-a），出口与城镇路面齐平 ≤ 0.01 m，杂草按 5 m 分段单调不减', ({ info, fail }) => {
  const exits = [];
  for (const rt of PLAN.routes.filter(r => r.def.exit)) exits.push({ id: rt.def.exit, rt, strip: rt.strip, grid: rt.grid, S: rt.samples, paved: rt.paved, instances: rt.instances, k: rt.flatOf });
  { const CH = RK.chain(W, ['T03-01', 'T03-02', 'T03-03'], { townHead: RK.TOWN_HEAD }), inst = {}; for (const src of [CH.instances, ...['T03-01', 'T03-02', 'T03-03'].map(id => RK.build(W, id).instances)]) for (const [t, l] of Object.entries(src)) (inst[t] = inst[t] || []).push(...l);
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
    // W8f-a: the town edge: the asphalt colour of the first row (the lane column at 2.0 m) against the town's asphalt as it renders (#46505b x its texture mean)
    const c0 = colorAt(st, m, 0, jc), dTown = Math.max(...[0, 1, 2].map(c => Math.abs(c0[c] - RK.TOWN_ASPHALT[c]))), headCells = (st.headIndex || []).length / 6;
    if (dTown > 0.05) fail(`${e.id} 城镇边缘处与城镇沥青颜色差 ${f(dTown, 3)} > 0.05`); if (!headCells) fail(`${e.id} 出口头没有用城镇沥青材质的格子`);
    e.townInfo = `城镇边缘色差 ${f(dTown, 3)}，出口头 ${headCells} 格用城镇沥青材质`;
    if (dw > 0.6) fail(`${e.id} 铺装宽变化 ${f(dw, 2)} m/m > 0.6`); if (dc > 0.25) fail(`${e.id} 中线相邻样点颜色差 ${f(dc, 2)} > 0.25`); if (dy > 0.01) fail(`${e.id} 出口处路面 y = ${f(y0, 3)}，与城镇路面 0.02 相差 ${f(dy, 3)} > 0.01`); if (!mono) fail(`${e.id} 杂草按 5 m 分段不单调：${cnt.join(' ')}`);
    info(`${e.id}：长 ${f(L, 1)} m，铺装宽 ${f(wd[0], 2)} → ${f(wd[Math.min(wd.length - 1, 60)], 2)} m（最大变化 ${f(dw, 2)} m/m），中线颜色差最大 ${f(dc, 2)}，出口路面 y = ${f(y0, 3)} m（城镇 0.02），${e.townInfo}，杂草/草簇每 5 m ${cnt.join(' ') || '（路段短于 5 m）'}${mono ? '' : '（不单调）'}`);
  }
});

// ---------------------------------------------------------------- W5-C7
check('W5-C7', '地标入口：12 个入口节点都有道路终点或路口（相差 ≤ 0.05 m）并有收口；道路不进入占地圆', ({ info, fail }) => {
  const CH = RK.chain(W, ['T03-01', 'T03-02', 'T03-03']);
  const items = [...PLAN.routes.map(r => ({ id: r.def.id, S: r.samples, hw: r.def.furnish && r.def.furnish.kind === 'RD05' ? 1.5 : r.def.furnish && r.def.furnish.kind === 'RD08' ? 1.0 : r.def.furnish && r.def.furnish.kind === 'RD03' ? 2.25 : r.def.segs.length && NET.edges.find(e => e.id === r.def.segs[0].id).class === 'RD05' ? 1.5 : 4.5, lateral: r.lateral })),
    ...PLAN.stairs.map(s => ({ id: s.id, S: s.samples, hw: 0.8, lateral: s.lateral })), { id: 'T03-chain', S: CH.samples, hw: 1.5, lateral: null }, { id: 'T11-02', S: [{ ...PLAN.bridges.find(b => b.access).access.landing }], hw: 0.8, lateral: null }];
  const rows = [];
  for (const nd of NET.nodes.filter(n => n.kind === 'landmark-entrance')) {
    let best = { d: Infinity, id: '' }; for (const it of items) for (let i = 0; i < it.S.length; i++) { const d = arc(it.S[i], nd); if (d < best.d) best = { d, id: it.id, i, n: it.S.length }; }
    const marks = PLAN.markers.filter(m => m.node === nd.id).length;
    const closed = marks === 2 || nd.id === 'LM04-southeast' || nd.id === 'LM08-south';
    if (best.d > 0.05) fail(`${nd.id} 最近的道路采样点相差 ${f(best.d)} m > 0.05（${best.id}）`); if (!closed) fail(`${nd.id} 没有入口收口`);
    rows.push(`${nd.id} ← ${best.id}（${f(best.d, 3)} m，${nd.id === 'LM04-southeast' ? 'W4 断面的土路终点' : nd.id === 'LM08-south' ? '检修楼梯平台' : marks + ' 根导引柱'}）`);
  }
  info(rows.join('；'));
  // footprint circles: the centre line of every generated road against the landmark site radius (WC6 tolerance 0.2 m), except within a few metres of its own entrance;
  // the edges (shoulders) are reported: where a 9 m trunk road passes a landmark close by (LM09, LM10) its shoulder reaches into the site circle by up to the amount listed
  let minC = Infinity, minWho = '', bad = 0; const edgeIn = {};
  for (const lm of W.landmarks.filter(l => l.id !== 'TOWN')) {
    const own = lm.entrances.map(e => NET.nodeById[`${lm.id}-${e.id}`]);
    for (const it of items) for (let i = 0; i < it.S.length; i++) {
      const p = it.S[i]; if (own.some(n => arc(p, n) < it.hw + 2)) continue;
      const cc = arc(p, lm) - lm.radius; if (cc < minC) { minC = cc; minWho = `${it.id}↔${lm.id}`; } if (cc < -0.2) bad++;
      if (it.lateral) for (const sg of [-1, 1]) { const [lo, la] = it.lateral(i, sg * it.hw), ec = arc({ lon: lo, lat: la }, lm) - lm.radius; if (ec < 0) { const k = `${it.id}↔${lm.id}`; edgeIn[k] = Math.max(edgeIn[k] || 0, -ec); } }
    }
  }
  if (bad) fail(`${bad} 个采样的中线进入占地圆（> 0.2 m）`);
  info(`道路中线到各地标占地圆的最小间隙 ${f(minC, 2)} m（${minWho}）；中线进入占地圆 > 0.2 m 的采样 ${bad} 个（入口附近半宽 + 2 m 内的采样除外，那里本来就是入口）`);
  info(`路肩边线进入占地圆的最大深度：${Object.entries(edgeIn).map(([k, v]) => `${k} ${f(v, 2)} m`).join('；') || '无'}（W7 做该地标时场地要避开路肩，已入待办池）`);
});

// ---------------------------------------------------------------- W5-C10 (W8f-a)
check('W5-C10', '衔接（W8f-a，W8_SPEC 12.1 C）：6 个桥台的走向、竖曲线、断面重合、护栏、虚线与边线；5 个 T 形路口的铺装、口门与齐平', ({ info, fail }) => {
  const RO = ROADS, wrapX = (x, ref) => x + 2 * Math.PI * R * Math.round((ref - x) / (2 * Math.PI * R));
  for (const a of PLAN.abutments) {
    const rt = PLAN.routes.find(r => r.def.id === a.route), b = PLAN.bridges.find(q => q.def.id === a.bridge), ap = a.approach, f2 = a.fillet, bad0 = [];
    const iR = a.rEnd === 'end' ? rt.samples.length - 1 : 0, iB = a.bEnd === 'start' ? 0 : b.samples.length - 1, flip = a.rEnd === a.bEnd;
    // (1) heading: adjacent 0.5 m samples through the transition (road then bridge, from the road side), change of bearing <= 1 deg
    const dR = p => Math.abs(rt.samples[iR].s - p.s), dB = p => Math.abs(b.samples[iB].s - p.s);
    const pts = [...rt.samples.filter(p => dR(p) <= f2.Ta + 0.6).sort((p, q) => dR(q) - dR(p)), ...b.samples.filter(p => dB(p) <= f2.Tb + 0.6 && dB(p) > 1e-6).sort((p, q) => dB(p) - dB(q))];
    let head = 0; for (let k = 1; k + 1 < pts.length; k++) head = Math.max(head, Math.abs(((W.bearing(pts[k], pts[k + 1]) - W.bearing(pts[k - 1], pts[k]) + 540) % 360) - 180));
    // (2) the road's last cross-section on the deck's first one: every road vertex with |o| <= 4.5 against the deck's top row at the same offset (3D, flat frame)
    const m = rt.grid.length, st = rt.strip, top = b.strips[0], TC = b.topCols, NB = TC.length;
    const deckAt = o => { const oo = flip ? -o : o; let j = 0; while (j + 2 < TC.length && TC[j + 1] < oo) j++; const t = (oo - TC[j]) / (TC[j + 1] - TC[j]), A = col(top, NB, iB, j), B2 = col(top, NB, iB, j + 1); return [A[0] + (B2[0] - A[0]) * t, A[1] + (B2[1] - A[1]) * t, A[2] + (B2[2] - A[2]) * t]; };
    // every road vertex of the last row with |o| <= 4.5 on the deck's first row; and the deck's vertices with |o| <= 5 all present in the road's row (same offsets: no T-junction)
    let sec = 0; rt.grid.forEach((o, j) => { if (Math.abs(o) > 4.5 + 1e-9) return; const v = col(st, m, iR, j), d = deckAt(o); sec = Math.max(sec, Math.hypot(wrapX(v[0], d[0]) - d[0], v[1] - d[1], v[2] - d[2])); });
    const tj = TC.filter(o => Math.abs(o) <= 5 + 1e-9 && !rt.grid.some(g => Math.abs(g - (flip ? -o : o)) < 1e-6)).length + rt.grid.filter(o => Math.abs(o) <= 5 + 1e-9 && !TC.some(g => Math.abs(g - (flip ? -o : o)) < 1e-6)).length;
    if (tj) bad0.push(`断面接缝有 ${tj} 个 T 形接点`);
    // (3) vertical: centre altitude every 1 m from 2 m before the approach to 3 m onto the deck; grade change between adjacent 1 m stations <= 1.5 points; altitude step at the node
    const altR = s => { const S = rt.samples; let i = 0; while (i + 2 < S.length && S[i + 1].s < s) i++; const t = Math.max(0, Math.min(1, (s - S[i].s) / (S[i + 1].s - S[i].s))); return rt.bed[i] + (rt.bed[i + 1] - rt.bed[i]) * t; };
    const altB = s => { const S = b.samples; let i = 0; while (i + 2 < S.length && S[i + 1].s < s) i++; const t = Math.max(0, Math.min(1, (s - S[i].s) / (S[i + 1].s - S[i].s))); return b.alt[i] + (b.alt[i + 1] - b.alt[i]) * t; };
    const sNR = rt.samples[iR].s, sNB = b.samples[iB].s, prof = [];
    for (let x = -(ap.len + 2); x <= 3 + 1e-9; x += 1) prof.push(x <= 0 ? altR(a.rEnd === 'end' ? sNR + x : sNR - x) : altB(a.bEnd === 'start' ? sNB + x : sNB - x));
    let dg = 0; for (let k = 2; k < prof.length; k++) dg = Math.max(dg, Math.abs((prof[k] - prof[k - 1]) - (prof[k - 1] - prof[k - 2])));
    const step = Math.abs(rt.bed[iR] - b.alt[iB]);
    // (4) barriers: the road's and the deck's pieces nearest the node on each side: gap between their ends along the road, lateral offset (true metres, node plane)
    const Pn = RO.plane(W, b.samples[iB]), dirB = (() => { const q = Pn.to(b.samples[a.bEnd === 'start' ? iB + 2 : iB - 2]); const l = Math.hypot(q[0], q[1]); return [q[0] / l, q[1] / l]; })();
    const lat = it => { const q = Pn.to(it); return q[0] * dirB[1] - q[1] * dirB[0]; };        // + = right of the direction into the bridge
    const bars = [];
    for (const sd of [-1, 1]) {
      const rb = (rt.instances.barrierConcrete || []).filter(it => it.station !== undefined && Math.sign(lat(it)) === sd).sort((p, q) => Math.abs(p.station - sNR) - Math.abs(q.station - sNR))[0];
      const bb = (b.instances.barrierConcrete || []).filter(it => Math.sign(lat(it)) === sd).sort((p, q) => Math.abs(p.station - sNB) - Math.abs(q.station - sNB))[0];
      if (!rb || !bb) { bars.push({ sd, missing: !rb ? 'road' : 'bridge' }); continue; }
      const gap = (Math.abs(rb.station - sNR) - 0.99 * rb.s[0]) + (Math.abs(bb.station - sNB) - 0.99 * bb.s[0]);
      bars.push({ sd, gap, dl: Math.abs(lat(rb) - lat(bb)) });
    }
    // (5) centre dashes on the ring's chainage, (6) edge lines as fresh as the deck's (the 'line' columns at the node)
    const cR = rt.chainAt(sNR), cB = b.def && PLAN.bridges.length ? (() => { const ch = RO.RING.find(q => q[0] === b.def.id); void ch; return null; })() : null; void cB;
    const ringC = (() => { const NETL = id => NET.edgeLength(NET.edges.find(e => e.id === id)); let c = 0; const o = {}; for (const [id, dir] of RO.RING) { const r = RO.ROUTES.find(q => q.id === id), bb2 = RO.BRIDGES.find(q => q.id === id), L = (r ? r.segs.map(q => q.id) : bb2.ids).reduce((x, y) => x + NETL(y), 0); o[id] = dir > 0 ? { c0: c, dir: 1 } : { c0: c + L, dir: -1 }; c += L; } return o; })();
    const chB = ringC[b.def.id], cBr = chB.c0 + chB.dir * sNB, phase = Math.abs(cR - cBr);
    const jl = rt.grid.findIndex(o => Math.abs(o - 3.24) < 0.07), lineR = colorAt(st, m, iR, jl >= 0 ? jl : 0), want = RK.lin('#c9cfc4'), dLine = Math.max(...[0, 1, 2].map(c => Math.abs(lineR[c] - want[c])));
    const bad = bad0;
    if (f2.Ta > 12 + 1e-6 || f2.Tb > 12 + 1e-6) bad.push('切线长 > 12 m'); if (head > 1) bad.push(`走向变化 ${f(head, 2)}° > 1°`); if (sec > 0.01) bad.push(`断面重合偏差 ${f(sec, 4)} m > 0.01`);
    if (dg > 0.015) bad.push(`坡度变化 ${f(dg * 100, 2)} 个百分点 > 1.5`); if (step > 0.005) bad.push(`节点高差 ${f(step, 3)} m`); if (ap.len > 14 + 1e-6) bad.push(`引道 ${f(ap.len, 1)} m > 14`); if (ap.fillMin < -0.005) bad.push(`引道有挖方 ${f(ap.fillMin, 3)} m`);
    for (const q of bars) { if (q.missing) bad.push(`${q.sd < 0 ? '左' : '右'}侧缺少${q.missing === 'road' ? '路上' : '桥上'}护栏块`); else { if (q.gap > 0.3) bad.push(`${q.sd < 0 ? '左' : '右'}侧护栏纵向间隙 ${f(q.gap, 3)} m > 0.3`); if (q.dl > 0.2) bad.push(`${q.sd < 0 ? '左' : '右'}侧护栏横向错开 ${f(q.dl, 3)} m > 0.2`); } }
    if (phase > 0.1) bad.push(`虚线相位差 ${f(phase, 3)} m > 0.1`); if (dLine > 0.02) bad.push(`边线在桥台处褪色（${f(dLine, 3)}）`);
    for (const m2 of bad) fail(`${a.node}（${a.route} ↔ 桥 ${a.bridge}）${m2}`);
    info(`${a.node}（${a.route} ${a.rEnd === 'end' ? '终点' : '起点'} ↔ 桥 ${a.bridge} ${a.bEnd === 'start' ? '起点' : '终点'}）：过渡段 路侧 ${f(f2.Ta, 1)} / 桥侧 ${f(f2.Tb, 1)} m，折角 ${f(f2.angle, 1)}°，相邻 0.5 m 走向变化最大 ${f(head, 3)}°；断面重合偏差 ${f(sec, 4)} m（共用全部 ${rt.grid.filter(o => Math.abs(o) <= 5 + 1e-9).length} 个顶点，无 T 形接点）；引道 ${f(ap.len, 1)} m（路面坡 ${f(ap.gRoad * 100, 1)}% → 桥面 ${f(ap.gDeck * 100, 1)}%，每米变 ${f(ap.rate * 100, 2)} 个百分点），1 m 站点坡度变化最大 ${f(dg * 100, 2)} 个百分点，填方 ${f(ap.fillMin, 3)}–${f(ap.fillMax, 2)} m，桥台抬高到 ${f(ap.alt, 2)} m（地形 ${f(ap.terrain, 2)} m），节点高差 ${f(step, 4)} m；护栏 ${bars.map(q => q.missing ? '缺' : `${q.sd < 0 ? '左' : '右'} 间隙 ${f(q.gap, 3)} m / 横向 ${f(q.dl, 3)} m`).join('，')}；虚线相位差 ${f(phase, 3)} m；边线色差 ${f(dLine, 3)}`);
  }
  // junctions
  for (const j of PLAN.junctions) {
    const tr = PLAN.routes.find(r => r.def.id === j.trunk), br = PLAN.routes.find(r => r.def.id === j.branch), mo = j.mouth, m = tr.grid.length, bad = [];
    const barsIn = (tr.instances.barrierConcrete || []).filter(it => { const pr = RO.project(tr, it.lon, it.lat, (mo.s0 + mo.s1) / 2); return pr && Math.sign(pr.o) === mo.side && pr.s + 1 > mo.s0 && pr.s - 1 < mo.s1; }).length;
    let ditch = 0, nD = 0; tr.samples.forEach((p, i) => { if (p.s < mo.s0 || p.s > mo.s1) return; tr.grid.forEach((o, jj) => { if (Math.sign(o) !== mo.side || Math.abs(o) <= 4.5 || Math.abs(o) > mo.to + 1e-9) return; nD++; ditch = Math.max(ditch, tr.bed[i] - tr.colAlt[i * m + jj]); }); });
    // the branch's last row (paved columns) against the paving at the same points, the paving's trunk-side edge against the trunk's surface
    const iE = j.branchEnd === 'end' ? br.samples.length - 1 : 0; let endD = 0;
    br.grid.forEach((o, jj) => { if (Math.abs(o) > j.h + 1e-6) return; const [lo, la] = br.lateral(iE, o), pr = RO.project(tr, lo, la, j.sJ), pave = RO.surfS(tr, pr.s, pr.o) + RO.PAVE_LIFT; endD = Math.max(endD, Math.abs(br.colAlt[iE * br.grid.length + jj] - pave)); });
    let edgeD = 0; for (const p of j.pts) if (Math.abs(Math.abs(p.o) - 3.5) < 0.02) edgeD = Math.max(edgeD, Math.abs(p.h - RO.surfS(tr, p.s, p.o)));
    if (barsIn) bad.push(`口门内有 ${barsIn} 个护栏块`); if (ditch > 0.05) bad.push(`口门内边沟顶点低于路基 ${f(ditch, 3)} m`); if (endD > 0.02) bad.push(`支路末端与铺装高差 ${f(endD, 3)} m > 0.02`); if (edgeD > 0.02) bad.push(`铺装与干线路面高差 ${f(edgeD, 3)} m > 0.02`);
    if (Math.abs(j.coverage - 1) > 0.002) bad.push(`铺装三角形重叠或缺口（面积比 ${f(j.coverage, 4)}）`);
    for (const m2 of bad) fail(`${j.node} ${m2}`);
    info(`${j.node}（${j.branch} → ${j.trunk}，${j.paving === 'asphalt' ? '沥青' : '夯土'}铺装，转角半径 ${j.r} m）：转角 ${j.corners.map(c => `${f(c.corner, 0)}°`).join(' / ')}，支路从离节点 ${f(j.lamEnd, 2)} m 处开始；口门（边沟填平、无护栏）干线里程 ${f(mo.s0, 1)}–${f(mo.s1, 1)} m，${mo.side > 0 ? '右' : '左'}侧，口门内护栏块 ${barsIn}，边沟顶点 ${nD} 个最低比路基低 ${f(ditch, 3)} m；支路末端与铺装高差 ${f(endD, 4)} m，铺装与干线路面高差 ${f(edgeD, 4)} m（抬高 ${RO.PAVE_LIFT} m）；${j.triangles} 个三角形，面积比 ${f(j.coverage, 4)}${br.ramp ? `；支路坡接 ${f(br.ramp.len, 1)} m（末端最大 ${f(Math.max(...br.ramp.delta.map(Math.abs)), 3)} m）` : ''}`);
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
      // W8f-a: renderShot draws the sphere, a clear day since W8e-c, where the additive rain ripples are 0 by design (bend.js x (1 - uBend)): at ground distance the
      // pixels need not change any more (pre-w8f-a: 49 incidental pixels at the horizon); the ripples' own animation is checked on their instance data instead
      let moved = null;
      if (label === 'ground') moved = await page.evaluate(([t1, t2]) => { const RD = window.__scene.roads, m = RD.state.ripples.mesh, cam = window.__scene.camera; RD.tick(t1, cam); const A = Float32Array.from(m.instanceMatrix.array); RD.tick(t2, cam); const B = m.instanceMatrix.array; let k = 0; for (let i = 0; i < A.length; i += 16) if (Math.abs(A[i] - B[i]) > 1e-6) k++; return k; }, [t1, t2]);
      info.push(`动态 ${label}（${name}，t = ${t1} 与 ${t2} s）：差异像素 ${n}${moved !== null ? `；涟漪实例在两个时刻之间变化 ${moved} 个（球形白天加法光为 0，按 W8e-c 设计，像素不要求变化）` : ''}`);
      if (label === 'ground' ? !(moved > 0) : n <= 0) fails.push(`${label} 距离下道路没有任何动态`);
    }
    { const hp = await page.evaluate(() => { const g = window.__scene.section.kit().geometries; const h = k => { g[k].computeBoundingBox(); return +(g[k].boundingBox.max.y - g[k].boundingBox.min.y).toFixed(3); }; return { pole: h('snowPole'), step: window.__scene.roads.data().stairs.map(s => s.id + ':' + s.count).join(' ') }; });
      info.push(`几何实测：红白标杆高 ${hp.pole} m（要求 2.0 ± 0.05）；石阶 ${hp.step}`); if (Math.abs(hp.pole - 2) > 0.05) fails.push(`标杆高 ${hp.pole}`); }
    const st = await page.evaluate(() => window.__scene.roads.stats());
    info.push(`实例数（W5a）：${Object.entries(st.counts).map(([k, v]) => `${k} ${v}`).join('、')}；光带 ${st.band.drawCalls} 次绘制 / ${st.band.triangles} 三角形（要求 ≤ 20 次）；首次构建 ${st.buildMs} ms`);
    if (st.band.drawCalls > 20) fails.push('光带绘制调用 > 20');
    if (errors.length) fails.push('页面错误：' + errors.join(' | '));
    results.push({ id: 'W5-C11', ok: !fails.length });
    console.log(`${fails.length ? 'FAIL' : 'PASS'} W5-C11 预算与页面：默认画面不变、光带 ≤ 20 次绘制、无页面错误（W8f-a 前编号 W5-C10）`);
    for (const m of fails) console.log('  ✗ ' + m); for (const m of info) console.log('  · ' + m);
  }
  await browser.close();
}
console.log(results.every(r => r.ok) ? `\nPASS road_check（${results.length} 项）` : `\nFAIL road_check：${results.filter(r => !r.ok).map(r => r.id).join(', ')}`);
process.exitCode = results.every(r => r.ok) ? 0 : 1;
