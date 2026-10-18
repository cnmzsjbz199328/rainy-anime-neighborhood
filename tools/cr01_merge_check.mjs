// W10c CR01 merge check (docs/world/CR01_NW_REPAIR_PLAN.md section 5). Run after `python3 build.py`:  node tools/cr01_merge_check.mjs [--no-browser]
// Independent of the way roads.js merges the roads: the CR01 paving is rebuilt from the ring's final indexed triangles round the whole closed ring
// (tools/cr01_geometry.mjs), and every other road surface is tested against it with its own final triangles. Machine results only, no visual verdict.
//   M1 paving   no other road surface overlaps the CR01 paving by a positive area (every route, junction pad, extra and bridge; RN05 listed)
//   M2 owner    no other route overlaps the ring's side bands (gravel, ditch, verge): every point of the overlap belongs to one road
//   M3 probes   4 probes per swept cell of the ring and of the branches outside it: each covered by exactly one road surface (no hole, no double)
//   M4 ring     every CR01 paved triangle is the swept one, none cut; the closure row (C01-NW) is one cross-section
//   M5 seams    a branch vertex on the ring's surface outline lies on it (paving <= 0.02 m, side bands <= 0.02 m)
//   M6 ink      the route ink lines handed to road:ink:aerial: none inside the merged paving (a branch line on the ring paving, a ring edge line across a mouth)
//   M7 clear    furniture and plants keep clear of the ring's carriageway round the whole ring; plants stand on the final surface
//   B-ink       (page) the segments of the road:ink:aerial line sets themselves, the same rule
//   B-ground    (page) the NW corner: no ground cut by a road footprint is left without a road surface
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TOL_PAIR, flatOf, lonLatOf, area, intersect, bary, distance, triangles, gridIndex, ringParts, ringHeight } from './cr01_geometry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
globalThis.LAYOUT = require(path.join(root, 'layout.js'));
const W = require(path.join(root, 'world.js')), TERR = require(path.join(root, 'terrain.js'));
globalThis.ROADKIT = require(path.join(root, 'roadkit.js')); globalThis.BRIDGE = require(path.join(root, 'bridge.js')); globalThis.STEPS = require(path.join(root, 'steps.js'));
const ROADS = require(path.join(root, 'roads.js'));
let failures = 0;
const check = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures++; }, f = (v, n = 3) => v.toFixed(n);
const t0 = Date.now(), H = TERR.sampler(W, { lonMin: -181, lonMax: 181, latMin: -90, latMax: 90 }), TB = TERR.builder(W), PLAN = ROADS.plan(W, H, (lo, la) => TB.vertex(lo, la).c);
const ring = PLAN.routes.find(r => r.def.id === 'CR01'), RP = ringParts(ring), pavedSet = new Set(RP.paved), PAVED = [-2.25, 2.75], n = ring.samples.length, m = ring.grid.length;
const near = box => box[1] > -66 && box[0] < 66 && box[3] > -66 && box[2] < 66;
const others = [...PLAN.routes.filter(r => r !== ring).map(r => ({ id: r.def.id, rt: r, strip: r.strip })), ...PLAN.junctions.filter(j => j.strip && j.strip.index && j.strip.index.length).map(j => ({ id: 'junction ' + j.node, strip: j.strip })),
  ...(PLAN.extras || []).flatMap(e => e.strips.map(st => ({ id: 'extra ' + st.name, strip: st }))), ...PLAN.bridges.map(b => ({ id: 'bridge ' + b.def.id, strip: b.strips[0] }))];
const otherTris = others.flatMap(o => triangles(o.strip, o.id).filter(t => near(t.box)).map(t => Object.assign(t, { src: o })));
const routeTris = otherTris.filter(t => t.src.rt), routeIndex = gridIndex([...routeTris, ...RP.all], 1);
console.log(`计划生成 ${Date.now() - t0} ms；CR01 最终三角形 ${RP.all.length}（铺装 ${RP.paved.length}、侧带 ${RP.side.length}），环区其他道路三角形 ${otherTris.length}；roads.js 合并统计 ${JSON.stringify(PLAN.cr01 ? PLAN.cr01.stats : null)}`);

// ---- M1 / M2: positive-area overlap of the other roads' final triangles with the CR01 paving and with its side bands, round the whole ring
const overlap = (tris, index) => {
  const by = {}; let pairs = 0, total = 0;
  for (const t of tris) for (const r of index.query(t.box)) { const a = area(intersect(t.v, r.v)); if (a <= TOL_PAIR) continue; pairs++; total += a;
    const q = by[t.owner] || (by[t.owner] = { pairs: 0, area: 0, box: [Infinity, -Infinity, Infinity, -Infinity] }); q.pairs++; q.area += a; q.box = [Math.min(q.box[0], t.box[0]), Math.max(q.box[1], t.box[1]), Math.min(q.box[2], t.box[2]), Math.max(q.box[3], t.box[3])]; }
  return { pairs, total, by };
};
const show = by => Object.entries(by).map(([k, q]) => `${k} ${q.pairs} 对 ${f(q.area, 4)} m²（x ${f(q.box[0], 1)}…${f(q.box[1], 1)}, z ${f(q.box[2], 1)}…${f(q.box[3], 1)}）`).join('；') || '无';
const m1 = overlap(otherTris, RP.pavedIndex);
check('M1-paving', m1.pairs === 0, `CR01 全环铺装（最终索引三角形 ${RP.paved.length} 个，含闭环接缝）与其他道路最终三角形的正面积交叠（单对 > ${TOL_PAIR} m²）${m1.pairs} 对 / ${f(m1.total, 4)} m²；RN05 ${m1.by['RN05-RD03'] ? `${m1.by['RN05-RD03'].pairs} 对 ${f(m1.by['RN05-RD03'].area, 4)} m²` : '0'}；分布：${show(m1.by)}`);
const m2 = overlap(routeTris, gridIndex(RP.side, 1));
check('M2-owner', m2.pairs === 0, `CR01 侧带（碎石肩、边沟、草肩）与其他路线最终三角形的正面积交叠 ${m2.pairs} 对 / ${f(m2.total, 4)} m²：${show(m2.by)}`);

// ---- M3: probes in every swept cell of the ring and of the branches outside the ring square, each must lie in exactly one road surface
{
  const cellProbes = (rt, rows) => {
    const st = rt.strip, mm = rt.grid.length, P = k => [st.pos[k * 3], st.pos[k * 3 + 2]], out = [];
    for (const i of rows) for (let j = 0; j + 1 < mm; j++) {
      const a = P(i * mm + j), b = P(i * mm + j + 1), c = P((i + 1) * mm + j), d = P((i + 1) * mm + j + 1);
      if (area([a, b, d, c]) < 1e-4) continue;
      for (const [u, v] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const p0 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], p1 = [c[0] + (d[0] - c[0]) * u, c[1] + (d[1] - c[1]) * u]; out.push({ p: [p0[0] + (p1[0] - p0[0]) * v, p0[1] + (p1[1] - p0[1]) * v], rt: rt.def.id, i, j }); }
    }
    return out;
  };
  const probes = cellProbes(ring, [...Array(n - 1).keys()]);
  for (const rt of PLAN.routes) if (rt !== ring) {
    const rows = [...Array(rt.samples.length - 1).keys()].filter(i => { const p = rt.flatOf[i], q = rt.flatOf[i + 1], out = Math.max(Math.abs(p.x), Math.abs(p.z)), out2 = Math.max(Math.abs(q.x), Math.abs(q.z)); return rt.def.id === 'RN05-RD03' || (out > 54.05 && out2 > 54.05 && Math.max(out, out2) < 62); });
    probes.push(...cellProbes(rt, rows));
  }
  let holes = 0, doubles = 0; const ex = [], hx = [], holeBy = {};
  for (const q of probes) {
    const owners = new Set(); let covered = false;
    for (const t of routeIndex.at(q.p[0], q.p[1])) { if (!bary(t.v, q.p[0], q.p[1], 1e-6)) continue; covered = true; if (bary(t.v, q.p[0], q.p[1], -1e-6)) owners.add(t.owner); }
    if (!covered) { holes++; holeBy[q.rt] = (holeBy[q.rt] || 0) + 1; if (hx.length < 6) hx.push(`${q.rt}[${q.i},${q.j}] (${f(q.p[0], 2)},${f(q.p[1], 2)})`); }
    else if (owners.size > 1) { doubles++; if (ex.length < 6) ex.push(`${[...owners].join('+')} (${f(q.p[0], 2)},${f(q.p[1], 2)})`); }
  }
  check('M3-probes', holes === 0 && doubles === 0, `CR01 全环 ${n - 1} 行与环外支路的扫掠单元各 4 个探针，共 ${probes.length} 个：无路面 ${holes}${holes ? `（${Object.entries(holeBy).map(([k, v]) => `${k} ${v}`).join('、')}；例 ${hx.join('；')}）` : ''}、两条道路同时覆盖 ${doubles}${ex.length ? '（例 ' + ex.join('；') + '）' : ''}`);
}

// ---- M4: the CR01 paving is the swept one, complete round the ring, and the closure row is one cross-section
{
  const jL = ring.grid.indexOf(PAVED[0]), jR = ring.grid.indexOf(PAVED[1]), want = (n - 1) * 2 * (jR - jL), original = RP.paved.filter(t => t.ids.every(k => k < n * m)).length;
  const pavedArea = RP.paved.reduce((s, t) => s + area(t.v), 0);
  let expectArea = 0; for (let i = 0; i + 1 < n; i++) { const P = k => [ring.strip.pos[k * 3], ring.strip.pos[k * 3 + 2]]; expectArea += area([P(i * m + jL), P(i * m + jR), P((i + 1) * m + jR), P((i + 1) * m + jL)]); }
  let closeXZ = 0, closeY = 0; for (let j = 0; j < m; j++) { const a = j * 3, b = ((n - 1) * m + j) * 3, P = ring.strip.pos; closeXZ = Math.max(closeXZ, Math.hypot(P[a] - P[b], P[a + 2] - P[b + 2])); closeY = Math.max(closeY, Math.abs(P[a + 1] - P[b + 1])); }
  check('M4-ring', RP.paved.length === want && original === want && Math.abs(pavedArea - expectArea) < 1e-3 && closeXZ < 1e-5 && closeY < 1e-5,
    `CR01 铺装三角形 ${RP.paved.length}（应 ${want}，原扫掠 ${original}），面积 ${f(pavedArea, 3)} m²（逐行四边形 ${f(expectArea, 3)} m²）；闭环首末行（C01-NW）顶点最大平面差 ${f(closeXZ, 6)}、高差 ${f(closeY, 6)}（Mercator 单位）`);
}

// ---- M5: branch vertices on the ring's outline take the ring's surface
{
  let paved = 0, side = 0, nP = 0, nS = 0, whereP = '', whereS = '';
  for (const t of routeTris) for (let k = 0; k < 3; k++) {
    const [x, z] = t.v[k], r = ringHeight(RP, x, z, 1e-6); if (!r) continue;
    const dh = Math.abs(t.y[k] - r.h), isPaved = pavedSet.has(r.t);
    if (isPaved) { nP++; if (dh > paved) { paved = dh; whereP = `${t.owner} (${f(x, 2)},${f(z, 2)})`; } } else { nS++; if (dh > side) { side = dh; whereS = `${t.owner} (${f(x, 2)},${f(z, 2)})`; } }
  }
  check('M5-seams', paved <= 0.02 && side <= 0.02, `落在 CR01 网格上的支路顶点：铺装 ${nP} 个最大高差 ${f(paved, 4)} m（${whereP || '—'}），侧带 ${nS} 个最大高差 ${f(side, 4)} m（${whereS || '—'}），限 0.02 m`);
}

// ---- M6: the route ink lines handed to road:ink:aerial (rt.ink, or the source edge lines split at tunnels as the scene drew them before the merge).
// The paving of a branch is where its final triangles' swept column offset lies in their row's paved range (the sweep's own data, interpolated over the
// triangle); a sample is inside the merged paving when it, or the point 4 cm beyond its own road's paving edge on its outer side, lies on another road's
// paving at least 2 cm from that paving's outline (a cut end on an outline is not a line inside it); 4 cm stays inside the 5 cm roads.js tests with.
const branchPavedAt = (x, z) => {
  for (const t of routeIndex.at(x, z)) { if (t.owner === 'CR01' || !t.o) continue; const w = bary(t.v, x, z, 1e-9); if (!w) continue;
    const o = w[0] * t.o[0] + w[1] * t.o[1] + w[2] * t.o[2], pl = w[0] * t.paved[0][0] + w[1] * t.paved[1][0] + w[2] * t.paved[2][0], pr = w[0] * t.paved[0][1] + w[1] * t.paved[1][1] + w[2] * t.paved[2][1];
    if (o >= pl - 1e-4 && o <= pr + 1e-4) return t.owner; }
  return null;
};
const ringPavedAt = (x, z) => { const r = ringHeight(RP, x, z, 1e-7); return r && pavedSet.has(r.t) ? r : null; };
const well = (test, x, z, m = 0.02) => { const k = Math.cosh(z / 90) * m; if (!test(x, z)) return false; for (let a = 0; a < 8; a++) if (!test(x + k * Math.cos(a * Math.PI / 4), z + k * Math.sin(a * Math.PI / 4))) return false; return true; };
const inkRuns = rt => rt.ink || ['edgeL', 'edgeR'].flatMap(k => { const runs = []; let run = []; rt.lines[k].forEach((q, i) => { if (rt.samples[i].span === 'tunnel') { if (run.length > 1) runs.push(run); run = []; } else run.push(q); }); if (run.length > 1) runs.push(run); return runs; });
{
  const STEP = 0.05, DELTA = 0.04, by = {}; let samples = 0, inside = 0;
  // the point beyond a road's own paving edge in the strip's own frame (its Mercator rows, as the mesh): the source line segment k -> k + 1 a sample lies on
  // (the nearest one) gives the row pair and the fraction between them
  const rowPoint = (rt, i, o) => { const f = rt.flatOf[i], T = rt.tangent[i], sc = o * rt.cf[i] * f.k; return [f.x - T[1] * sc, f.z + T[0] * sc]; };
  for (const rt of PLAN.routes) {
    const isRing = rt === ring, other = isRing ? branchPavedAt : (xx, zz) => ringPavedAt(xx, zz), segs = [];
    for (const [key, sd] of [['edgeL', -1], ['edgeR', 1]]) rt.lines[key].forEach((q, k) => { if (k + 1 >= rt.lines[key].length) return; const a = flatOf(q.lon, q.lat), b = flatOf(rt.lines[key][k + 1].lon, rt.lines[key][k + 1].lat); if (near([Math.min(a[0], b[0]) - 1, Math.max(a[0], b[0]) + 1, Math.min(a[1], b[1]) - 1, Math.max(a[1], b[1]) + 1])) segs.push({ a, b, k, sd, box: [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1])] }); });
    const segIndex = gridIndex(segs, 1);
    for (const run of inkRuns(rt)) for (let k = 0; k + 1 < run.length; k++) {
      const a = flatOf(run[k].lon, run[k].lat), b = flatOf(run[k + 1].lon, run[k + 1].lat);
      if (!near([Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1])])) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-9) continue;
      for (let s = STEP / 2; s < len; s += STEP) {
        const x = a[0] + (b[0] - a[0]) * s / len, z = a[1] + (b[1] - a[1]) * s / len; samples++;
        let best = null; for (const g of segIndex.query([x, x, z, z], 0.05)) { const dx = g.b[0] - g.a[0], dz = g.b[1] - g.a[1], t = Math.max(0, Math.min(1, ((x - g.a[0]) * dx + (z - g.a[1]) * dz) / (dx * dx + dz * dz || 1e-24))), d = Math.hypot(x - g.a[0] - dx * t, z - g.a[1] - dz * t); if (!best || d < best.d) best = { d, g, t }; }
        if (!best) continue;
        const { g, t } = best, edge = i => (isRing ? PAVED : rt.paved[i])[g.sd < 0 ? 0 : 1], p0 = rowPoint(rt, g.k, edge(g.k) + g.sd * DELTA), p1 = rowPoint(rt, g.k + 1, edge(g.k + 1) + g.sd * DELTA), out = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
        if (well(other, x, z) || well(other, out[0], out[1])) { inside++; const key = `${rt.def.id} ${g.sd < 0 ? 'L' : 'R'}`, e = by[key] || (by[key] = { n: 0, s: [Infinity, -Infinity] }), st = rt.samples[g.k].s + (rt.samples[g.k + 1].s - rt.samples[g.k].s) * t; e.n++; e.s = [Math.min(e.s[0], st), Math.max(e.s[1], st)]; }
      }
    }
  }
  check('M6-ink', inside === 0, `${PLAN.routes.some(r => r.ink) ? '路线最终描边 rt.ink' : '（合并前）按隧道断开的源边线'}在环区 ${samples} 个 0.05 m 采样中，位于合并铺装内部 ${inside} 个（${f(inside * STEP, 2)} m）：${Object.entries(by).map(([k, e]) => `${k} ${e.n} 个（里程 ${f(e.s[0], 2)}–${f(e.s[1], 2)} m）`).join('；') || '无'}`);
  const src = ['edgeL', 'edgeR'].map(k => PLAN.routes.find(r => r.def.id === 'RN05-RD03').lines[k].filter(p => { const [x, z] = flatOf(p.lon, p.lat); return ringPavedAt(x, z); }).length);
  console.log(`  · 参考：RN05 源边线 edgeL / edgeR 采样点落入 CR01 铺装 ${src.join(' / ')}（源线保留，诊断用；验收看上面的最终描边）`);
}

// ---- M7: furniture and plants against the ring's carriageway round the whole ring (no window round the junction nodes), and plant heights on the final surface
{
  const require2 = createRequire(import.meta.url), SLP = require2(path.join(root, 'streetlights.js')).plan({ W: Object.assign(Object.create(W), { height: H }), L: globalThis.LAYOUT, roads: PLAN, RK: ROADS, cover: { cells: [], items: [] }, town: { puddles: [], alleyLamps: [] } });
  const clearance = { weed: 0.8, tuft: 0.8, shrubLow: 0.8, lamp: 1, lampSmall: 1, pole: 0.8, signBus: 0.8, busBench: 1.2, mirror: 0.7, vending: 1, jizo: 0.8, lantern: 0.6, stonePost: 0.6, bollard: 0.5, barrierConcrete: 0.75, gatePost: 0.5, snowPole: 0.45 };
  const placed = [...PLAN.routes.flatMap(rt => Object.entries(rt.instances || {}).flatMap(([type, list]) => list.map(it => ({ rt: rt.def.id, type, it })))), ...PLAN.markers.map(it => ({ rt: 'marker', type: 'gatePost', it })),
    ...SLP.lamps.filter(q => q.owner !== 'town').map(q => ({ rt: q.line, type: 'lamp', it: { lon: q.lon, lat: q.lat } }))];
  const leaks = [], plantErr = { max: 0, at: '' }; let tested = 0;
  for (const { rt: id, type, it } of placed) {
    const [x, z] = flatOf(it.lon, it.lat); if (!near([x, x, z, z])) continue; tested++;
    const radius = clearance[type] ?? 0.6, junction = PLAN.junctions.filter(j => j.kind === 'CR01').find(j => distance([x, z], j.polygon) <= radius);
    let why = junction && id !== 'CR01' ? `路口 ${junction.node}` : null;
    if (!why && id !== 'CR01') { const pr = ROADS.project(ring, it.lon, it.lat); if (pr) { const q = ROADS.atS(ring, pr.s), cw = ring.carriageway[q.i].map((v, e) => v + (ring.carriageway[q.i + 1][e] - v) * q.t); if (pr.o >= cw[0] - radius && pr.o <= cw[1] + radius && Math.abs(pr.o) < 8) why = `CR01 车行道 s=${f(pr.s, 1)}`; } }
    if (id === 'CR01') { const b = branchPavedAt(x, z); if (b) why = `${b} 铺装`; }
    if (why) leaks.push(`${id}/${type} (${f(x, 2)},${f(z, 2)}) ${why}`);
    if ((type === 'weed' || type === 'tuft') && it.station !== undefined) {
      let top = null; for (const t of routeIndex.at(x, z)) { const w = bary(t.v, x, z, 1e-6); if (w) { const h = w[0] * t.y[0] + w[1] * t.y[1] + w[2] * t.y[2]; if (top === null || h > top) top = h; } }
      if (top !== null && Math.abs(it.alt - top) > plantErr.max) { plantErr.max = Math.abs(it.alt - top); plantErr.at = `${id}/${type} (${f(x, 2)},${f(z, 2)})`; }
    }
  }
  const rn05 = PLAN.routes.find(r => r.def.id === 'RN05-RD03'), kept = Object.entries(rn05.instances).map(([k, l]) => `${k} ${l.length}`).join('、');
  check('M7-clear', !leaks.length && plantErr.max <= 0.02, `环区 ${tested} 个设施/植物/路灯（全环车行道净空，无 18 m 路口窗口）：侵入 ${leaks.length}${leaks.length ? '（' + leaks.slice(0, 8).join('；') + '）' : ''}；草簇与杂草和最终路面最大高差 ${f(plantErr.max, 4)} m（${plantErr.at || '—'}，限 0.02 m）；RN05 现有实例 ${kept}`);
}

// ---- page part: the rendered ink segments and the ground at the NW corner
if (!process.argv.includes('--no-browser')) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.waitForFunction(() => window.__scene?.worldgen?.state.done, null, { timeout: 180000 });
    const r = await page.evaluate(() => {
      const S = window.__scene, RO = window.ROADS, Dg = S.roads.data(), R = 90, D = Math.PI / 180, ring = Dg.routes.find(q => q.def.id === 'CR01');
      const tris = (rt, st) => { const P = st.pos, ix = st.index, out = []; for (let t = 0; t < ix.length; t += 3) { const ids = [ix[t], ix[t + 1], ix[t + 2]], v = ids.map(k => [P[k * 3], P[k * 3 + 2]]); out.push({ rt, ids, v, o: st.clipOffset ? ids.map(k => st.clipOffset[k]) : null, box: [Math.min(...v.map(q => q[0])), Math.max(...v.map(q => q[0])), Math.min(...v.map(q => q[1])), Math.max(...v.map(q => q[1]))] }); } return out; };
      const bary = (v, x, z, tol) => { const [a, b, c] = v, den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-14) return null; const w0 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / den, w1 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / den, w2 = 1 - w0 - w1; return w0 >= -tol && w1 >= -tol && w2 >= -tol ? [w0, w1, w2] : null; };
      const all = [], cells = new Map(), key = (a, b) => a * 100000 + b, inRegion = b => b[1] > -66 && b[0] < 66 && b[3] > -66 && b[2] < 66;
      for (const rt of Dg.routes) for (const t of tris(rt, rt.strip)) if (inRegion(t.box)) all.push(t);
      for (const j of Dg.junctions) if (j.strip && j.strip.index && j.strip.index.length) for (const t of tris(null, j.strip)) if (inRegion(t.box)) all.push(t);
      all.forEach((t, id) => { for (let a = Math.floor(t.box[0]); a <= Math.floor(t.box[1]); a++) for (let b = Math.floor(t.box[2]); b <= Math.floor(t.box[3]); b++) { const k = key(a, b); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(id); } });
      const at = (x, z) => (cells.get(key(Math.floor(x), Math.floor(z))) || []).map(id => all[id]);
      const ringAt = (x, z) => { for (const t of at(x, z)) if (t.rt === ring) { const w = bary(t.v, x, z, 1e-9); if (w) return { t, w, o: w[0] * t.o[0] + w[1] * t.o[1] + w[2] * t.o[2] }; } return null; };
      const branchPaved = (x, z) => { for (const t of at(x, z)) { if (!t.rt || t.rt === ring || !t.o) continue; const w = bary(t.v, x, z, 1e-9); if (!w) continue; const P = t.rt.strip.clipPaved, o = w[0] * t.o[0] + w[1] * t.o[1] + w[2] * t.o[2], pl = w.reduce((s, wk, k) => s + wk * P[t.ids[k] * 2], 0), pr = w.reduce((s, wk, k) => s + wk * P[t.ids[k] * 2 + 1], 0); if (o >= pl - 1e-4 && o <= pr + 1e-4) return t.rt.def.id; } return null; };
      const ringPaved = (x, z) => { const q = ringAt(x, z); return q && q.o >= -2.25 - 1e-4 && q.o <= 2.75 + 1e-4; };
      const well = (test, x, z) => { const k = 0.02 * Math.cosh(z / R); if (!test(x, z)) return false; for (let a = 0; a < 8; a++) if (!test(x + k * Math.cos(a * Math.PI / 4), z + k * Math.sin(a * Math.PI / 4))) return false; return true; };
      // B-ink: every segment of the road:ink:aerial line sets within the ring region, sampled every 0.05 m
      let samples = 0, inside = 0; const ex = [];
      for (const l of S.roads.objects.lines.aerial) { const p = l.geometry.attributes.position.array;
        for (let k = 0; k + 5 < p.length; k += 6) {
          const a = [p[k], p[k + 2]], b = [p[k + 3], p[k + 5]]; if (Math.max(a[0], b[0]) < -66 || Math.min(a[0], b[0]) > 66 || Math.max(a[1], b[1]) < -66 || Math.min(a[1], b[1]) > 66) continue;
          if (Math.max(Math.abs(a[0]), Math.abs(a[1])) < 47 && Math.max(Math.abs(b[0]), Math.abs(b[1])) < 47) continue;
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1e-9) continue; const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len;
          for (let s = 0.025; s < len; s += 0.05) {
            const x = a[0] + (b[0] - a[0]) * s / len, z = a[1] + (b[1] - a[1]) * s / len, d = 0.04 * Math.cosh(z / R), rq = ringAt(x, z); samples++; let bad = false;
            if (rq && rq.o > -2.25 + 0.02 && rq.o < 2.75 - 0.02 && well(ringPaved, x, z)) {
              if (Math.abs(rq.o - 2.25) < 0.05) { const [A, B, C] = rq.t.v, [oa, ob, oc] = rq.t.o, den = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]), gx = ((ob - oa) * (C[1] - A[1]) - (oc - oa) * (B[1] - A[1])) / den, gz = ((B[0] - A[0]) * (oc - oa) - (C[0] - A[0]) * (ob - oa)) / den, g2 = gx * gx + gz * gz, step = (2.75 + 0.04 - rq.o) / g2;
                bad = well(branchPaved, x + gx * step, z + gz * step); }          // the ring's own inner edge line (on its asphalt): only where a branch's paving lies beyond the asphalt edge
              else bad = true;                                               // anything else drawn on the ring's paving
            } else { const pv = (xx, zz) => ringPaved(xx, zz) || !!branchPaved(xx, zz); bad = well(pv, x + nx * d, z + nz * d) && well(pv, x - nx * d, z - nz * d); }
            if (bad) { inside++; if (ex.length < 6) ex.push(`(${x.toFixed(2)},${z.toFixed(2)})`); }
          }
        } }
      // B-ground: the NW corner, every 0.25 m: a point inside a terrain road cut must lie on a road surface
      const polys = S.terrain.roadPolygons || [], inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
      const cutHere = polys.filter(q => q.box.x1 > -62 && q.box.x0 < -28 && q.box.z1 > -62 && q.box.z0 < -46); let probes = 0, holes = 0, capHoles = 0; const hx = [], cx = [];
      for (let x = -62; x <= -28; x += 0.25) for (let z = -62; z <= -46; z += 0.25) { const by = cutHere.filter(q => x >= q.box.x0 && x <= q.box.x1 && z >= q.box.z0 && z <= q.box.z1 && inPoly([x, z], q.p)); if (!by.length) continue; probes++;
        if (at(x, z).some(t => bary(t.v, x, z, 1e-6))) continue;
        // the 0.3 m terrain.js cuts past a road's open end (CUT_CAP) are listed apart: they belong to the route ends, not to this merge
        if (by.every(q => q.src.kind === 'cap')) { capHoles++; if (cx.length < 3) cx.push(`(${x},${z}) ${by[0].src.id}`); } else { holes++; if (hx.length < 6) hx.push(`(${x},${z}) ${by.map(q => q.src.kind + ' ' + q.src.id).join('/')}`); } }
      const st = S.roads.stats();
      return { ink: { samples, inside, ex }, ground: { polygons: cutHere.length, probes, holes, hx, capHoles, cx }, buildMs: st.buildMs, merge: Dg.cr01 ? Dg.cr01.stats : null };
    });
    check('B-ink', r.ink.inside === 0, `页面 road:ink:aerial 线段在环区 ${r.ink.samples} 个 0.05 m 采样中，位于合并铺装内部 ${r.ink.inside} 个${r.ink.ex.length ? '；例 ' + r.ink.ex.join(' ') : ''}`);
    check('B-ground', r.ground.holes === 0 && errors.length === 0, `西北角 x −62…−28、z −62…−46 每 0.25 m：地形道路裁切多边形 ${r.ground.polygons} 个，落在裁切内的探针 ${r.ground.probes} 个，其中无路面 ${r.ground.holes}${r.ground.hx.length ? '（' + r.ground.hx.join(' ') + '）' : ''}；另有路线端头 0.3 m 裁切（CUT_CAP）下无路面 ${r.ground.capHoles}${r.ground.cx.length ? '（' + r.ground.cx.join(' ') + '，既有，非本合并所致）' : ''}；页面错误 ${errors.length}`);
    console.log(`  · 路网分步构建 ${r.buildMs} ms；合并统计 ${JSON.stringify(r.merge)}`);
  } finally { await browser.close(); }
}
console.log(failures ? `\n${failures} 项未通过` : '\n全部通过');
process.exitCode = failures ? 1 : 0;
