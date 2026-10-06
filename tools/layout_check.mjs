// Layout checks and top-down review image for layout.js.
//
//   node tools/layout_check.mjs            logic checks + docs/layout/topdown.svg + report
//   node tools/layout_check.mjs --png      also rasterise the SVG to docs/layout/topdown.png (Chromium)
//
// Sample/building sprites come from tools/out (run tools/measure_samples.mjs first); without them the
// samples and buildings are drawn as their measured bounding boxes only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// LAYOUT_FILE / LAYOUT_OUT allow checking a modified copy (used for negative tests) without touching docs/.
const L = createRequire(import.meta.url)(path.resolve(process.env.LAYOUT_FILE || path.join(root, 'layout.js')));
const docDir = process.env.LAYOUT_OUT ? path.resolve(process.env.LAYOUT_OUT) : path.join(root, 'docs', 'layout');
fs.mkdirSync(docDir, { recursive: true });

// ---------- rect helpers (all layout areas are axis-aligned rectangles [x0, z0, x1, z1]) ----------
const EPS = 1e-6;
const area = r => Math.max(0, r[2] - r[0]) * Math.max(0, r[3] - r[1]);
const inter = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
const overlapArea = (a, b) => { const i = inter(a, b); return i[2] > i[0] && i[3] > i[1] ? area(i) : 0; };
const contains = (outer, inner, tol = EPS) => inner[0] >= outer[0] - tol && inner[1] >= outer[1] - tol && inner[2] <= outer[2] + tol && inner[3] <= outer[3] + tol;
const pointIn = (r, x, z) => x >= r[0] - EPS && x <= r[2] + EPS && z >= r[1] - EPS && z <= r[3] + EPS;
const touches = (a, b, minShared = 0.5) => {   // overlap, or share an edge of at least minShared
  const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oz = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  return (ox > EPS && oz > EPS) || (Math.abs(ox) <= EPS && oz >= minShared) || (Math.abs(oz) <= EPS && ox >= minShared);
};
const rectDist = (a, b) => Math.hypot(Math.max(0, a[0] - b[2], b[0] - a[2]), Math.max(0, a[1] - b[3], b[1] - a[3]));
const isAxisRect = poly => poly.length === 4 && poly.every((p, i) => { const q = poly[(i + 1) % 4]; return p[0] === q[0] || p[1] === q[1]; });
const fmt = r => `[${r.map(v => +v.toFixed(2)).join(', ')}]`;

const results = [];   // {id, title, status: PASS|FAIL|WARN, details[]}
function check(id, title, fn) {
  const fails = [], warns = [], info = [];
  fn({ fail: m => fails.push(m), warn: m => warns.push(m), info: m => info.push(m) });
  results.push({ id, title, status: fails.length ? 'FAIL' : warns.length ? 'WARN' : 'PASS', details: [...fails.map(m => '✗ ' + m), ...warns.map(m => '△ ' + m), ...info.map(m => '· ' + m)] });
}

const H = L.BASE.half, M = L.BASE.margin, baseRect = [-H, -H, H, H], innerRect = [-H + M, -H + M, H - M, H - M];
const nodeById = Object.fromEntries(L.roadNodes.map(n => [n.id, n]));
const roadById = Object.fromEntries(L.roads.map(r => [r.id, r]));
const plotById = Object.fromEntries(L.plots.map(p => [p.id, p]));
const corridors = L.roads.map(r => ({ id: r.id, rect: L.corridorRect(r) }));
const surf = kind => L.surfaces.filter(s => s.kind === kind);
const alleyRects = L.alleys.map(a => ({ id: a.id, rect: a.rect }));
const walkRects = L.walkways.map(w => ({ id: w.id, rect: [w.poly[0][0], w.poly[0][1], w.poly[2][0], w.poly[2][1]] }));
const apronRects = L.aprons.map(a => ({ id: a.id, rect: [a.poly[0][0], a.poly[0][1], a.poly[2][0], a.poly[2][1]] }));
const plotRects = L.plots.map(p => ({ id: p.id, rect: p.rect }));

// ---------- C1 road network ----------
check('C1', '道路连接图连通，边界出口明确', ({ fail, info }) => {
  const adj = new Map(L.roadNodes.map(n => [n.id, new Set()]));
  for (const s of L.roadSegments) {
    const a = nodeById[s.from], b = nodeById[s.to];
    if (!a || !b) { fail(`${s.id} 引用了不存在的节点`); continue; }
    if (a.x !== b.x && a.z !== b.z) fail(`${s.id} 不是正交路段`);
    adj.get(a.id).add(b.id); adj.get(b.id).add(a.id);
  }
  const reach = (start, segs) => {
    const g = new Map(); for (const s of segs) { (g.get(s.from) || g.set(s.from, []).get(s.from)).push(s.to); (g.get(s.to) || g.set(s.to, []).get(s.to)).push(s.from); }
    const seen = new Set([start]), q = [start];
    while (q.length) for (const n of g.get(q.shift()) || []) if (!seen.has(n)) { seen.add(n); q.push(n); }
    return seen;
  };
  const all = reach('N02', L.roadSegments);
  const missing = L.roadNodes.filter(n => !all.has(n.id)).map(n => n.id);
  if (missing.length) fail(`与网络断开的节点：${missing.join(', ')}`);
  const mainSegs = L.roadSegments.filter(s => s.type !== 'alley');
  const mainNodes = new Set(mainSegs.flatMap(s => [s.from, s.to]));
  const mainReach = reach('N02', mainSegs);
  if ([...mainNodes].some(n => !mainReach.has(n))) fail('三条主要道路自身不连通');
  for (const n of L.roadNodes) {
    const deg = adj.get(n.id).size, onEdge = Math.abs(n.x) === H || Math.abs(n.z) === H;
    if (deg === 0) fail(`${n.id} 孤立`);
    if (n.kind === 'edge' && (!onEdge || deg !== 1)) fail(`${n.id} 标为边界出口，但不在底座边缘或度数=${deg}`);
    if (n.kind !== 'edge' && onEdge) fail(`${n.id} 位于底座边缘但未标为出口`);
    if (n.kind === 'intersection' && deg !== 4) fail(`${n.name} 应为十字交叉口，度数=${deg}`);
  }
  const ints = L.roadNodes.filter(n => n.kind === 'intersection');
  info(`节点 ${L.roadNodes.length}，路段 ${L.roadSegments.length}（道路 ${mainSegs.length}，内巷 ${L.roadSegments.length - mainSegs.length}），交叉口 ${ints.map(n => n.name).join('、')}`);
  const exits = L.roadNodes.filter(n => n.kind === 'edge').map(n => `${n.id}(${n.x},${n.z})←${L.roadSegments.find(s => s.from === n.id || s.to === n.id)?.road ?? '无路段'}`);
  info(`边界出口 ${exits.length} 个：${exits.join('，')}`);
});

// ---------- C2 corridors and blocks ----------
check('C2', '道路走廊与街区边界不重叠，均在底座内', ({ fail, info }) => {
  for (const c of corridors) if (!contains(baseRect, c.rect)) fail(`${c.id} 走廊越出底座 ${fmt(c.rect)}`);
  for (const r of L.roads) { const t = L.ROAD_TYPES[r.type]; info(`${r.id} ${r.name}：车行道 ${t.carriageway} + 两侧(路缘/设施带 ${t.band} + 人行道 ${t.sidewalk}) = 走廊 ${r.corridor}`); }
  for (const b of L.blocks) {
    if (!contains(innerRect, b.rect)) fail(`${b.id} 越出底座收边范围`);
    for (const c of corridors) { const o = overlapArea(b.rect, c.rect); if (o > EPS) fail(`${b.id} 与 ${c.id} 走廊重叠 ${o.toFixed(2)}`); }
    for (const o of L.blocks) if (o.id > b.id && overlapArea(b.rect, o.rect) > EPS) fail(`${b.id} 与 ${o.id} 重叠`);
    info(`${b.id} ${b.name} ${fmt(b.rect)} = ${b.rect[2] - b.rect[0]} × ${b.rect[3] - b.rect[1]}（${b.use}）`);
  }
});

// ---------- C3 plots ----------
check('C3', '地块互不重叠，不压道路/人行道/内巷/通道，街区完整分配', ({ fail, warn, info }) => {
  for (const p of L.plots) {
    if (!isAxisRect(p.poly)) fail(`${p.id} 不是轴对齐矩形（检查脚本假设）`);
    const b = L.blocks.find(b => b.id === p.block);
    if (!b) { fail(`${p.id} 所属街区不存在`); continue; }
    if (!contains(b.rect, p.rect)) fail(`${p.id} 越出街区 ${b.id}`);
    for (const o of [...corridors, ...alleyRects, ...walkRects, ...apronRects]) { const a = overlapArea(p.rect, o.rect); if (a > EPS) fail(`${p.id} 与 ${o.id} 重叠 ${a.toFixed(2)}`); }
    for (const o of L.plots) if (o.id > p.id) { const a = overlapArea(p.rect, o.rect); if (a > EPS) fail(`${p.id} 与 ${o.id} 重叠 ${a.toFixed(2)}`); }
  }
  for (const o of [...walkRects, ...apronRects]) {
    for (const c of corridors) if (overlapArea(o.rect, c.rect) > EPS) fail(`${o.id} 压在 ${c.id} 走廊上`);
    for (const a of alleyRects) if (overlapArea(o.rect, a.rect) > EPS) fail(`${o.id} 与 ${a.id} 重叠`);
  }
  for (const a of alleyRects) for (const c of corridors) if (overlapArea(a.rect, c.rect) > EPS) fail(`${a.id} 与 ${c.id} 走廊重叠`);
  for (const b of L.blocks) {
    const parts = [...plotRects, ...alleyRects, ...walkRects, ...apronRects].map(o => overlapArea(o.rect, b.rect)).reduce((s, v) => s + v, 0);
    const residual = area(b.rect) - parts;
    if (residual > 0.01) warn(`${b.id} 有 ${residual.toFixed(2)} 未分配用地`); else info(`${b.id} 完整分配：${L.plots.filter(p => p.block === b.id).length} 块地块${alleyRects.some(a => overlapArea(a.rect, b.rect) > 0) ? ' + 内巷' : ''}`);
  }
  const occ = L.plots.filter(p => p.status === 'occupied').map(p => `${p.id}←${p.sample || p.building}`);
  info(`地块 ${L.plots.length} 块：占用 ${occ.length}（${occ.join('，')}），其余 ${L.plots.length - occ.length} 块预留空置`);
});

// ---------- C4 plot sizes ----------
check('C4', '地块尺寸符合参考范围（面宽 × 进深）', ({ warn, info }) => {
  for (const p of L.plots) {
    const w = ['N', 'S'].includes(p.front) ? p.rect[2] - p.rect[0] : p.rect[3] - p.rect[1];
    const d = ['N', 'S'].includes(p.front) ? p.rect[3] - p.rect[1] : p.rect[2] - p.rect[0];
    const [[w0, w1], [d0, d1]] = L.PLOT_TYPES[p.type].size;
    const b = p.buildable, bw = b[2] - b[0], bd = b[3] - b[1];
    if (w < w0 || w > w1 || d < d0 || d > d1) warn(`${p.id} ${p.type} ${w} × ${d} 超出参考 ${w0}–${w1} × ${d0}–${d1}`);
    if (bw <= 0 || bd <= 0) warn(`${p.id} 扣除退界后无可建范围`);
  }
  const byType = {};
  for (const p of L.plots) (byType[p.type] ||= []).push(p.id);
  for (const [t, ids] of Object.entries(byType)) { const s = L.PLOT_TYPES[t]; info(`${t}（${s.size[0].join('–')} × ${s.size[1].join('–')}，退界 前${s.setback.front}/侧${s.setback.side}/后${s.setback.rear}，限高 ${s.maxHeight}）：${ids.join(' ')}`); }
});

// ---------- C5 entrances ----------
const walkables = [
  ...surf('sidewalk').map(s => ({ id: s.id, rect: s.rect })), ...alleyRects, ...walkRects, ...apronRects,
  ...L.crosswalks.filter(c => c.kind === 'zebra').map(c => ({ id: c.id, rect: c.rect })),
];
check('C5', '入口朝向道路，入口外侧为可步行面；车辆出入口避开斑马线与路口', ({ fail, info }) => {
  const opp = { N: 'S', S: 'N', E: 'W', W: 'E' };
  for (const p of L.plots) for (const e of p.entrances) {
    const [x0, z0, x1, z1] = p.rect;
    const onEdge = { N: Math.abs(e.z - z0) < EPS, S: Math.abs(e.z - z1) < EPS, E: Math.abs(e.x - x1) < EPS, W: Math.abs(e.x - x0) < EPS }[e.facing];
    const within = e.facing === 'N' || e.facing === 'S' ? e.x > x0 && e.x < x1 : e.z > z0 && e.z < z1;
    if (!onEdge || !within) { fail(`${p.id} 入口 (${e.x},${e.z}) 不在 ${e.facing} 边上`); continue; }
    if (!p.frontages.includes(e.facing)) fail(`${p.id} 入口朝 ${e.facing}，但该边不是临路边`);
    const [dx, dz] = L.DIRS[e.facing], probe = [e.x + dx * 0.3, e.z + dz * 0.3];
    const hit = walkables.filter(w => pointIn(w.rect, ...probe));
    if (!hit.length) fail(`${p.id} 入口 (${e.x},${e.z}) 外侧不是人行道/内巷/通道`);
    if (e.kind === 'vehicle') {
      const gate = [e.x - (dz ? 2 : 0), e.z - (dx ? 2 : 0), e.x + (dz ? 2 : 0), e.z + (dx ? 2 : 0)];   // 4 m driveway
      for (const c of L.crosswalks) { const d = rectDist(gate, c.rect); if (d < 3) fail(`${p.id} 车辆出入口距斑马线 ${c.id} 仅 ${d.toFixed(1)}`); }
      const own = hit.map(h => h.id.split('-')[0]);
      for (const c of corridors.filter(c => !own.includes(c.id))) { const d = rectDist(gate, c.rect); if (d < 8) fail(`${p.id} 车辆出入口距交叉道路 ${c.id} 仅 ${d.toFixed(1)}`); }
      for (const a of alleyRects) { const d = rectDist(gate, a.rect); if (d < 3) fail(`${p.id} 车辆出入口距巷口 ${a.id} 仅 ${d.toFixed(1)}`); }
      info(`${p.id} 车辆出入口 (${e.x},${e.z}) 朝 ${e.facing}，经 ${hit.map(h => h.id).join('/')}`);
    }
    void opp;
  }
  info(`入口 ${L.plots.reduce((s, p) => s + p.entrances.length, 0)} 个，均位于临路边并朝向道路/内巷/通道`);
});

// ---------- C6 pedestrian network ----------
check('C6', '连续人行路径可到达每块用地', ({ fail, info }) => {
  const nodes = walkables, n = nodes.length, parent = nodes.map((_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (touches(nodes[i].rect, nodes[j].rect)) parent[find(i)] = find(j);
  const comps = new Map(); nodes.forEach((w, i) => (comps.get(find(i)) || comps.set(find(i), []).get(find(i))).push(w.id));
  if (comps.size !== 1) fail(`人行网络分成 ${comps.size} 块：${[...comps.values()].map(c => c.slice(0, 4).join('/')).join(' | ')}`);
  info(`人行面 ${n} 块（人行道 ${surf('sidewalk').length}、内巷 ${alleyRects.length}、通道 ${walkRects.length}、候车区 ${apronRects.length}、斑马线 ${L.crosswalks.filter(c => c.kind === 'zebra').length}），不依赖候选过街 N07-CW 即连通`);
  let reached = 0;
  for (const p of L.plots) {
    const e = p.entrances.find(e => e.kind === 'pedestrian') || p.entrances[0];
    const [dx, dz] = L.DIRS[e.facing];
    if (walkables.some(w => pointIn(w.rect, e.x + dx * 0.3, e.z + dz * 0.3))) reached++; else fail(`${p.id} 人行入口不接人行网络`);
  }
  info(`${reached}/${L.plots.length} 块用地的人行入口接入同一人行网络`);
  for (const r of L.roads) if (L.ROAD_TYPES[r.type].sidewalk < 2) fail(`${r.id} 人行道净宽 < 2`);
});

// ---------- C7 samples ----------
const sampleBoxes = [];   // world AABBs of every sample and new building part, for drawing and cross checks
for (const s of L.structures) for (const part of s.parts) {
  const { min, max, ground } = part.localBounds;
  const worldRect = (x0, z0, x1, z1) => {
    const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => L.toWorld(s, x, z));
    const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
    return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
  };
  sampleBoxes.push({ sample: s.id, group: part.group, role: part.role, rect: worldRect(min[0], min[2], max[0], max[2]), minY: min[1] * (s.transform.scale ?? L.SAMPLE_SCALE),
    ground: ground ? worldRect(...ground) : null, height: max[1] * (s.transform.scale ?? L.SAMPLE_SCALE) });
}
// Walking route from a sample's door to its plot entrance: 0.1 grid BFS inside the plot, around the
// walking-height footprints of every sample part inflated by half the clear width.
const CLEAR_WIDTH = 0.7, GRID = 0.1;
function doorRoute(s, p, e) {
  const obst = sampleBoxes.filter(b => b.ground).map(b => [b.ground[0] - CLEAR_WIDTH / 2, b.ground[1] - CLEAR_WIDTH / 2, b.ground[2] + CLEAR_WIDTH / 2, b.ground[3] + CLEAR_WIDTH / 2]);
  const [x0, z0, x1, z1] = p.rect, nx = Math.round((x1 - x0) / GRID), nz = Math.round((z1 - z0) / GRID);
  const cx = i => x0 + (i + 0.5) * GRID, cz = j => z0 + (j + 0.5) * GRID;
  const free = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && !obst.some(r => pointIn(r, cx(i), cz(j)));
  const cell = (x, z) => [Math.floor((x - x0) / GRID), Math.floor((z - z0) / GRID)];
  const [dx, dz] = L.DIRS[e.facing];
  let start = null;
  for (let t = 0; t <= 1.5 && !start; t += GRID / 2) { const c = cell(e.door[0] + dx * t, e.door[1] + dz * t); if (free(...c)) start = c; }
  if (!start) return null;
  const goal = ([i, j]) => { const x = cx(i), z = cz(j); return Math.abs((dx ? x : z) - (dx ? e.x : e.z)) <= GRID && Math.abs((dx ? z : x) - (dx ? e.z : e.x)) <= CLEAR_WIDTH / 2; };
  const prev = new Map([[start.join(), null]]), q = [start];
  while (q.length) {
    const c = q.shift();
    if (goal(c)) { const path = []; for (let k = c.join(); k; k = prev.get(k)) { const [i, j] = k.split(',').map(Number); path.unshift([cx(i), cz(j)]); } return [e.door, ...path, [e.x, e.z]]; }
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = [c[0] + a, c[1] + b]; if (!prev.has(n.join()) && free(...n)) { prev.set(n.join(), c.join()); q.push(n); } }
  }
  return null;
}
const routes = {};
check('C7', '已有样板与附属设施不越界，入口朝向匹配，统一尺度', ({ fail, info }) => {
  for (const s of L.samples) {
    const p = plotById[s.plot], t = s.transform;
    if (!p) { fail(`${s.id} 指向不存在的地块`); continue; }
    if (p.sample !== s.id || p.status !== 'occupied') fail(`${p.id} 未登记为 ${s.id} 的占用地块`);
    if ((t.scale ?? L.SAMPLE_SCALE) !== L.SAMPLE_SCALE) fail(`${s.id} 使用了非统一缩放`);
    if (Math.abs(Math.sin(2 * t.rotY)) > EPS) fail(`${s.id} 旋转不是 90° 的倍数（包围盒检查需要）`);
    for (const b of sampleBoxes.filter(b => b.sample === s.id)) {
      const limit = b.role === 'building' ? p.buildable : p.rect;
      if (!contains(limit, b.rect)) fail(`${s.id}/${b.group} ${fmt(b.rect)} 越出${b.role === 'building' ? '可建范围' : '地块'} ${fmt(limit)}`);
      const margin = Math.min(b.rect[0] - limit[0], b.rect[1] - limit[1], limit[2] - b.rect[2], limit[3] - b.rect[3]);
      info(`${s.id}/${b.group}（${b.role === 'building' ? '建筑' : '附属'}）${fmt(b.rect)}，距${b.role === 'building' ? '可建范围' : '地块'}边界最小 ${margin.toFixed(2)}，高 ${b.height.toFixed(2)}`);
      if (b.height > p.maxHeight) fail(`${s.id}/${b.group} 高 ${b.height} 超过限高 ${p.maxHeight}`);
    }
    const e = p.entrances[0], [fx, fz] = s.frontDir, c = Math.cos(t.rotY), n = Math.sin(t.rotY);
    const wf = [fx * c + fz * n, -fx * n + fz * c], want = L.DIRS[e.facing];
    if (Math.abs(wf[0] - want[0]) > EPS || Math.abs(wf[1] - want[1]) > EPS) fail(`${s.id} 正面朝向与地块入口 ${e.facing} 不一致`);
    const route = doorRoute(s, p, e);
    if (!route) fail(`${s.id} 门口到地块入口 (${e.x}, ${e.z}) 没有净宽 ${CLEAR_WIDTH} 的通行路径`);
    else {
      routes[s.id] = route;
      const len = route.slice(1).reduce((t, q, i) => t + Math.hypot(q[0] - route[i][0], q[1] - route[i][1]), 0);
      info(`${s.id} 门 (${e.door.join(', ')}) → 地块入口 (${e.x}, ${e.z}) 朝 ${e.facing}：净宽 ${CLEAR_WIDTH} 通行路径 ${len.toFixed(1)}，绕开附属设施`);
    }
  }
  for (let i = 0; i < sampleBoxes.length; i++) for (let j = i + 1; j < sampleBoxes.length; j++) {
    const a = sampleBoxes[i], b = sampleBoxes[j];
    if (a.sample !== b.sample && overlapArea(a.rect, b.rect) > EPS) fail(`${a.sample}/${a.group} 与 ${b.sample}/${b.group} 重叠`);
  }
  info(`统一尺度 SAMPLE_SCALE = ${L.SAMPLE_SCALE}`);
});

// ---------- C8 legacy street furniture ----------
check('C8', '原街道设施的临时位置位于路缘/设施带，不占人行道净宽', ({ fail, info }) => {
  for (const f of L.legacyFurniture) {
    const bands = L.surfaces.filter(s => s.kind === 'band' && s.road === f.slot.road);
    const b = bands.find(b => pointIn(b.rect, f.slot.x, f.slot.z));
    if (!b) fail(`${f.group} 立柱 (${f.slot.x}, ${f.slot.z}) 不在 ${f.slot.road} 设施带内`);
    else info(`${f.group} → ${b.id} (${f.slot.x}, ${f.slot.z})：${f.note}`);
    for (const c of L.crosswalks) if (pointIn(c.rect, f.slot.x, f.slot.z)) fail(`${f.group} 立柱落在斑马线 ${c.id} 上`);
  }
  for (const g of L.legacyGround) info(`${g.group}：${g.action}`);
});

// ---------- areas ----------
const sumArea = list => list.reduce((s, r) => s + area(r), 0);
const stats = [
  ['底座', area(baseRect)],
  ['车行道', (() => { // carriageways overlap at intersections; count the union once
    const cw = surf('carriageway').map(s => s.rect); let a = sumArea(cw);
    for (let i = 0; i < cw.length; i++) for (let j = i + 1; j < cw.length; j++) a -= overlapArea(cw[i], cw[j]);
    return a; })()],
  ['路缘/设施带', sumArea(surf('band').map(s => s.rect))],
  ['人行道', (() => { const sw = surf('sidewalk').map(s => s.rect); let a = sumArea(sw); for (let i = 0; i < sw.length; i++) for (let j = i + 1; j < sw.length; j++) a -= overlapArea(sw[i], sw[j]); return a; })()],
  ['内巷', sumArea(alleyRects.map(a => a.rect))],
  ['人行通道', sumArea(walkRects.map(a => a.rect))],
  ['公交候车区', sumArea(apronRects.map(a => a.rect))],
  ['预留地块', sumArea(L.plots.filter(p => p.status === 'reserved').map(p => p.rect))],
  ['已占用地块', sumArea(L.plots.filter(p => p.status === 'occupied').map(p => p.rect))],
];
const accounted = stats.slice(1).reduce((s, [, v]) => s + v, 0);
stats.push(['收边及路口转角余量', area(baseRect) - accounted]);

// ---------- C9 step-free crossings and driveways ----------
check('C9', '斑马线两端有无台阶坡道，车辆出入口只降设施带，人行道保持连续', ({ fail, info }) => {
  const cuts = L.curbCuts || [], lv = L.LEVELS, cc = L.CURB_CUT, curb = lv.pavement - lv.carriageway;
  if (!cuts.length) { fail('layout.js 未定义 curbCuts'); return; }
  const roadOf = id => roadById[id], typeOf = k => L.ROAD_TYPES[roadOf(k.road).type];
  for (const c of L.crosswalks.filter(c => c.kind === 'zebra')) {
    const r = roadOf(c.road), span = r.axis === 'z' ? [c.rect[1], c.rect[3]] : [c.rect[0], c.rect[2]];
    const ends = cuts.filter(k => k.kind === 'ramp' && k.road === c.road && Math.abs(k.s0 - span[0]) < EPS && Math.abs(k.s1 - span[1]) < EPS);
    if (new Set(ends.map(k => k.dir)).size !== 2) fail(`${c.id} 两端坡道不全（找到 ${ends.length} 处）`);
  }
  for (const k of cuts) {
    const t = typeOf(k), slope = curb / k.depth, flatLeft = t.band + t.sidewalk - k.depth;
    if (k.kind === 'ramp') {
      if (slope > 1 / 8 + EPS) fail(`${k.id} 坡度 1:${(1 / slope).toFixed(1)} 陡于 1:8`);
      if (flatLeft < cc.minFlatSidewalk - EPS) fail(`${k.id} 坡道后人行道平段只剩 ${flatLeft.toFixed(2)}`);
    } else if (k.depth > t.band + EPS) fail(`${k.id} 车辆出入口降坡伸进人行道，人行道应保持连续`);
    // must sit on the straight part of an island edge, clear of the curb returns
    const is = L.islands.find(i => (k.line === 'x' ? [i.rect[0], i.rect[2]] : [i.rect[1], i.rect[3]]).some(v => Math.abs(v - k.at) < EPS)
      && (k.line === 'x' ? k.s0 >= i.rect[1] - EPS && k.s1 <= i.rect[3] + EPS : k.s0 >= i.rect[0] - EPS && k.s1 <= i.rect[2] + EPS));
    if (!is) { fail(`${k.id} 不在任何人行岛的路缘线上`); continue; }
    const [a, b] = k.line === 'x' ? [is.rect[1], is.rect[3]] : [is.rect[0], is.rect[2]], R = L.INTERSECTION.curbRadius;
    const lowSide = k.line === 'x' ? (Math.abs(k.at - is.rect[0]) < EPS ? 'W' : 'E') : (Math.abs(k.at - is.rect[1]) < EPS ? 'N' : 'S');
    const corners = k.line === 'x' ? [`N${lowSide}`, `S${lowSide}`] : [`${lowSide}W`, `${lowSide}E`];
    if ((is.round[corners[0]] && k.s0 < a + R - EPS) || (is.round[corners[1]] && k.s1 > b - R + EPS)) fail(`${k.id} 压到转角圆弧`);
    for (const f of L.legacyFurniture) if (pointIn(k.rect, f.slot.x, f.slot.z)) fail(`${f.group} 立柱落在 ${k.id} 坡道上`);
    for (const o of cuts) if (o.id > k.id && overlapArea(o.rect, k.rect) > EPS) fail(`${k.id} 与 ${o.id} 重叠`);
  }
  for (const a of L.alleys) for (const r of L.roads.filter(r => r.axis === 'z'))
    if (touches(a.rect, L.corridorRect(r), 1) && !cuts.some(k => k.id === `${a.id}-DW`)) fail(`${a.id} 巷口缺少车辆降坡`);
  for (const p of L.plots) p.entrances.filter(e => e.kind === 'vehicle').forEach((e, i) => { if (!cuts.some(k => k.id === `${p.id}-DW${i + 1}`)) fail(`${p.id} 车辆出入口缺少降坡`); });
  const ramps = cuts.filter(k => k.kind === 'ramp');
  info(`坡道 ${ramps.length} 处（坡度 1:${(ramps[0].depth / curb).toFixed(0)}，进深 ${ramps[0].depth.toFixed(2)}），车辆降坡 ${cuts.length - ramps.length} 处：${cuts.filter(k => k.kind !== 'ramp').map(k => k.id).join('、')}`);
  info(`路缘高 ${curb.toFixed(2)}：车行道 y=${lv.carriageway}，人行面 y=${lv.pavement}，地块 y=${lv.plot}`);
});
// ---------- C10 road details (P3) ----------
check('C10', '标线在车行道内且不冲突；设施不挡人行道与过街；排水连通到出口；路灯覆盖每个入口', ({ fail, info }) => {
  if (!L.markings) { fail('layout.js 未定义 P3 数据'); return; }
  const cw = r => { const h = L.ROAD_TYPES[r.type].carriageway / 2; return L.corridorRect(r).map((v, i) => (r.axis === 'x') === (i % 2 === 1) ? r.at + (i < 2 ? -h : h) : v); };
  const onCarriageway = q => L.roads.some(r => contains(cw(r), q));
  const zebras = L.markings.filter(m => m.kind === 'zebra'), stops = L.markings.filter(m => m.kind === 'stop-line');
  for (const m of L.markings) {
    if (m.rect && !onCarriageway(m.rect)) fail(`${m.id} 不在车行道内`);
    if (!m.rect && !L.roads.some(r => pointIn(cw(r), m.x, m.z))) fail(`${m.id} 不在车行道内`);
  }
  // nothing but the junction box itself may carry lane lines; stop lines sit 1 before their crosswalk
  const boxes = L.roadNodes.filter(n => n.kind === 'intersection').map(n => { const ew = L.roads.find(r => r.axis === 'x' && r.at === n.z), ns = L.roads.find(r => r.axis === 'z' && r.at === n.x); return [n.x - L.ROAD_TYPES[ns.type].carriageway / 2, n.z - L.ROAD_TYPES[ew.type].carriageway / 2, n.x + L.ROAD_TYPES[ns.type].carriageway / 2, n.z + L.ROAD_TYPES[ew.type].carriageway / 2]; });
  for (const m of L.markings.filter(m => m.kind === 'centre' || m.kind === 'edge')) {
    for (const b of boxes) if (overlapArea(m.rect, b) > EPS) fail(`${m.id} 画进了路口`);
    for (const z of [...zebras, ...stops]) if (overlapArea(m.rect, z.rect) > EPS) fail(`${m.id} 与 ${z.id} 重叠`);
  }
  for (const a of L.approaches) {
    const cwk = L.crosswalks.find(c => c.id === a.crosswalk), st = stops.find(m => m.id === `${a.id}-STOP`);
    if (!['signal', 'stop', 'priority'].includes(a.control)) fail(`${a.id} 没有通行控制`);
    if (a.control !== 'priority' && !st) fail(`${a.id} 缺少停止线`);
    if (st && rectDist(st.rect, cwk.rect) < L.MARKING.stopGap - EPS) fail(`${a.id} 停止线距斑马线不足 ${L.MARKING.stopGap}`);
    const r = roadById[a.road], h = L.ROAD_TYPES[r.type].carriageway / 2;
    if (st) { const [c0, c1] = r.axis === 'x' ? [st.rect[1], st.rect[3]] : [st.rect[0], st.rect[2]]; const half = a.lane < 0 ? [r.at - h, r.at] : [r.at, r.at + h]; if (Math.abs(c0 - half[0]) > EPS || Math.abs(c1 - half[1]) > EPS) fail(`${a.id} 停止线不在进口车道（靠左行驶）`); }
    const ctl = L.furniture.find(f => f.approach === a.id);
    if (a.control !== 'priority' && !ctl) fail(`${a.id} 缺少${a.control === 'signal' ? '信号灯' : '停车让行标志'}`);
  }
  for (const c of L.crosswalks.filter(c => c.kind === 'zebra')) if (!zebras.some(z => z.id.startsWith(c.id + '-'))) fail(`${c.id} 没有斑马线涂装`);
  // furniture: in a band (or at an alley edge), never on crosswalks, curb cuts, sidewalks or each other
  const bands = L.surfaces.filter(s => s.kind === 'band'), sidewalks = L.surfaces.filter(s => s.kind === 'sidewalk');
  for (const f of L.furniture) {
    if (f.alley) { const a = L.alleys.find(a => a.id === f.alley); if (!pointIn(a.rect, f.x, f.z) || Math.min(f.z - a.rect[1], a.rect[3] - f.z) > 0.3) fail(`${f.id} 不在 ${f.alley} 巷边`); }
    else if (!bands.some(b => pointIn(b.rect, f.x, f.z))) fail(`${f.id} (${f.x.toFixed(2)}, ${f.z.toFixed(2)}) 不在设施带内`);
    if (sidewalks.some(w => pointIn(w.rect, f.x, f.z) && !bands.some(b => pointIn(b.rect, f.x, f.z)))) fail(`${f.id} 占用人行道净宽`);
    for (const c of L.crosswalks) if (pointIn(c.rect, f.x, f.z)) fail(`${f.id} 立在斑马线上`);
    for (const k of L.curbCuts) if (pointIn(k.rect, f.x, f.z)) fail(`${f.id} 立在 ${k.id} 坡道上`);
    for (const o of L.furniture) if (o.id > f.id && Math.hypot(o.x - f.x, o.z - f.z) < 1.5) fail(`${f.id} 与 ${o.id} 间距不足 1.5`);
  }
  for (const pl of L.poleLines) {
    const byId = Object.fromEntries(L.furniture.map(f => [f.id, f]));
    for (const [a, b] of pl.spans) { const d = Math.hypot(byId[a].x - byId[b].x, byId[a].z - byId[b].z); if (d > L.FURNITURE.maxSpan + EPS) fail(`${pl.road} 电线 ${a}→${b} 跨距 ${d.toFixed(1)} 过长`); }
    if (pl.spans.length !== pl.poles.length - 1) fail(`${pl.road} 电杆线断开`);
  }
  // lighting: every plot entrance within reach of a lamp
  const lit = L.furniture.filter(f => f.kind === 'lamp' || f.kind === 'alley-lamp' || f.group === 'streetLamp'), reach = 12;
  let worst = 0;
  for (const p of L.plots) for (const e of p.entrances) {
    const d = Math.min(...lit.map(f => Math.hypot(f.x - e.x, f.z - e.z))); worst = Math.max(worst, d);
    if (d > reach) fail(`${p.id} 入口 (${e.x}, ${e.z}) 离最近路灯 ${d.toFixed(1)}，超过 ${reach}`);
  }
  // drainage: every gutter has grates no more than 15 apart along it; every run reaching the edge has an outlet
  for (const g of L.gutters) {
    const along = g.line === 'z' ? [g.rect[0], g.rect[2]] : [g.rect[1], g.rect[3]];
    const pts = L.grates.filter(q => pointIn([g.rect[0] - .2, g.rect[1] - .2, g.rect[2] + .2, g.rect[3] + .2], q.x, q.z)).map(q => g.line === 'z' ? q.x : q.z).sort((a, b) => a - b);
    if (!pts.length) { fail(`${g.id} 没有篦子`); continue; }
    const edgeEnds = along.filter(v => Math.abs(Math.abs(v) - H) < EPS);
    const stops2 = [...pts, ...edgeEnds].sort((a, b) => a - b);
    const ends = [along[0], ...stops2, along[1]];
    for (let i = 1; i < ends.length; i++) if (ends[i] - ends[i - 1] > 15 + EPS) fail(`${g.id} 在 ${ends[i - 1].toFixed(1)}–${ends[i].toFixed(1)} 之间没有排水点`);
    for (const v of edgeEnds) if (!L.outlets.some(o => Math.abs((g.line === 'z' ? o.x : o.z) - v) < EPS && pointIn([g.rect[0] - .3, g.rect[1] - .3, g.rect[2] + .3, g.rect[3] + .3], o.x, o.z))) fail(`${g.id} 到达底座边缘却没有出口`);
  }
  for (const c of L.channels) for (const v of [c.rect[0], c.rect[2]]) if (Math.abs(Math.abs(v) - H) < EPS && !L.outlets.some(o => o.id === `${c.alley}-OUT`)) fail(`${c.id} 没有边界出口`);
  const cnt = k => L.furniture.filter(f => f.kind === k).length;
  info(`标线：斑马线条 ${zebras.length}，停止线 ${stops.length}，中心线段 ${L.markings.filter(m => m.kind === 'centre').length}，主街边线 ${L.markings.filter(m => m.kind === 'edge').length}，菱形预告 ${L.markings.filter(m => m.kind === 'diamond').length}，止まれ ${L.markings.filter(m => m.kind === 'text').length}`);
  info(`控制：${L.approaches.map(a => `${a.id}=${{ signal: '信号', stop: '停车让行', priority: '优先' }[a.control]}`).join('，')}`);
  info(`设施：路灯 ${cnt('lamp')}，巷灯 ${cnt('alley-lamp')}，电杆 ${cnt('pole') + 1}（含原电杆），信号灯 ${cnt('signal') + 1}（含原信号灯），停车标志 ${cnt('stop-sign')}；入口到最近路灯最远 ${worst.toFixed(1)}`);
  info(`排水：边沟 ${L.gutters.length} 段，篦子 ${L.grates.length}，内巷暗沟 ${L.channels.length}，边界出口 ${L.outlets.length}；水洼 ${L.puddles.length}`);
});
// ---------- C11 reserved plots can take a real building (P4) ----------
// Packs each reserved plot: the candidate building stands in the buildable envelope (as close to the
// front setback line as the annexes allow); its annexes go anywhere on the plot clear of the building and the entrance path, and
// parking must touch the main frontage so cars can reach it. Building coverage is kept ≤ 60 %.
const fits = {};
check('C11', '每块预留地块都放得下候选建筑及其附属设施（停车、后勤等），建蔽率 ≤ 60%', ({ fail, info }) => {
  const step = 0.25, clearOf = (r, list) => list.every(q => overlapArea(r, q) <= EPS);
  for (const p of L.plots.filter(p => p.status === 'reserved')) {
    const f = L.PLOT_TYPES[p.type].fit;
    if (!f) { info(`${p.id} ${p.type}：开放空间，不放建筑`); continue; }
    const [bx0, bz0, bx1, bz1] = p.buildable, alongX = p.front === 'N' || p.front === 'S';
    const [dx, dz] = alongX ? f.building : [f.building[1], f.building[0]];
    const paths = p.entrances.map(e => { const [ux, uz] = L.DIRS[e.facing]; const len = 3; return ux ? [Math.min(e.x, e.x - ux * len), e.z - 0.6, Math.max(e.x, e.x - ux * len), e.z + 0.6] : [e.x - 0.6, Math.min(e.z, e.z - uz * len), e.x + 0.6, Math.max(e.z, e.z - uz * len)]; });
    // parking opens onto the main frontage only: no extra driveways on the side street of a corner plot
    const touchesFront = r => ({ N: Math.abs(r[1] - p.rect[1]), S: Math.abs(r[3] - p.rect[3]), W: Math.abs(r[0] - p.rect[0]), E: Math.abs(r[2] - p.rect[2]) })[p.front] < EPS;
    let found = null;
    const slots = [];
    // nearest the front setback line first: a set-back building is fine when the front yard is needed
    for (let x = bx0; x + dx <= bx1 + EPS; x += step) for (let z = bz0; z + dz <= bz1 + EPS; z += step) slots.push([x, z]);
    const frontGap = ([x, z]) => ({ N: z - bz0, S: bz1 - (z + dz), W: x - bx0, E: bx1 - (x + dx) })[p.front];
    slots.sort((a, b) => frontGap(a) - frontGap(b));
    for (const [x, z] of slots) {
      const bld = [x, z, x + dx, z + dz];
      const placed = [];
      for (const [w, d, name] of f.annexes) {
        let ok = null;
        for (const [aw, ad] of [[w, d], [d, w]]) {
          for (let ax = p.rect[0]; ax + aw <= p.rect[2] + EPS && !ok; ax += step) for (let az = p.rect[1]; az + ad <= p.rect[3] + EPS && !ok; az += step) {
            const r = [ax, az, ax + aw, az + ad];
            if (!clearOf(r, [bld, ...placed.map(q => q.rect), ...paths])) continue;
            if (name === '停车位' && !touchesFront(r)) continue;
            ok = { rect: r, name };
          }
          if (ok) break;
        }
        if (!ok) break;
        placed.push(ok);
      }
      if (placed.length === f.annexes.length) { found = { building: bld, annexes: placed }; break; }
    }
    const cover = (f.building[0] * f.building[1]) / area(p.rect);
    if (!found) { fail(`${p.id} ${p.type} 放不下候选建筑 ${f.building.join('×')} 及 ${f.annexes.map(a => a[2]).join('、')}`); continue; }
    if (cover > 0.6 + EPS) fail(`${p.id} 候选建筑建蔽率 ${(cover * 100).toFixed(0)}% 超过 60%`);
    fits[p.id] = found;
    info(`${p.id} ${p.type} ${fmt(p.rect)}：建筑 ${f.building.join('×')}（建蔽率 ${(cover * 100).toFixed(0)}%）+ ${found.annexes.map(a => `${a.name} ${+(a.rect[2] - a.rect[0]).toFixed(2)}×${+(a.rect[3] - a.rect[1]).toFixed(2)}`).join('、')}`);
  }
});

// ---------- C12 new buildings: the real, measured model (not the C11 candidate) ----------
// Bounds are the ones measured in Chromium by tools/measure_samples.mjs (eaves, awnings, signs, pipes and
// downpipes included); tools/out/sample_bounds.json, when present, must still match what layout.js records.
const measured = (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'tools', 'out', 'sample_bounds.json'), 'utf8')).groups; } catch { return null; } })();
check('C12', '新建筑实测模型：主体在可建范围、附属在地块内，限高、步行占地、入口路径、遮雨与单文件嵌入一致', ({ fail, warn, info }) => {
  const html = (() => { try { return fs.readFileSync(path.join(root, 'index.html'), 'utf8'); } catch { return ''; } })();
  if (!L.buildings.length) info('尚无新建筑');
  for (const s of L.buildings) {
    const p = plotById[s.plot], t = s.transform;
    if (!p) { fail(`${s.id} 指向不存在的地块`); continue; }
    if (p.building !== s.id || p.status !== 'occupied' || p.sample) fail(`${p.id} 未登记为新建筑 ${s.id} 的占用地块`);
    if ((t.scale ?? L.SAMPLE_SCALE) !== L.SAMPLE_SCALE) fail(`${s.id} 使用了非统一缩放`);
    if (Math.abs(Math.sin(2 * t.rotY)) > EPS) fail(`${s.id} 旋转不是 90° 的倍数`);
    const src = path.join(root, 'buildings', `${s.module}.js`);
    if (!fs.existsSync(src)) fail(`缺少建模源码 buildings/${s.module}.js`);
    else if (!html.includes(fs.readFileSync(src, 'utf8').split('\n').find(l => l.includes(`['${s.module}']`)) || '\u0000')) fail(`index.html 未嵌入 buildings/${s.module}.js（运行 python3 build.py）`);
    const boxes = sampleBoxes.filter(b => b.sample === s.id);
    if (!boxes.some(b => b.role === 'building')) fail(`${s.id} 没有登记主体（role building）`);
    for (const b of boxes) {
      const part = s.parts.find(q => q.group === b.group);
      // Only the inherited store reflection may occupy its original public-sidewalk area.
      // World envelope from the old local light ranges (x -2.5..4.3, z 4.1..5.9), including half-size.
      const spill = part.legacyStoreReflection === true;
      if (spill && !(s.id === 'mart' && s.plot === 'B05-P01' && b.group === 'martReflection' && b.role === 'ground' && !b.ground && measured?.[b.group]?.lightOnly))
        fail(`${s.id}/${b.group} 既有倒影必须是实测无实体的透明光斑`);
      const limit = spill ? [-14.8625,18.87,-7.9375,21.13] : b.role === 'building' ? p.buildable : p.rect;
      const where = spill ? '旧便利店人行道倒影范围' : b.role === 'building' ? '可建范围' : '地块';
      if (spill && (b.minY < L.LEVELS.pavement || b.height > L.LEVELS.pavement + .02)) fail(`${s.id}/${b.group} 倒影未贴合人行道`);
      if (!contains(limit, b.rect)) fail(`${s.id}/${b.group} 实测 ${fmt(b.rect)} 越出${where} ${fmt(limit)}`);
      if (b.ground && !contains(limit, b.ground)) fail(`${s.id}/${b.group} 步行高度占地 ${fmt(b.ground)} 越出${where}`);
      if (b.height > p.maxHeight) fail(`${s.id}/${b.group} 最高点 ${b.height.toFixed(2)} 超过限高 ${p.maxHeight}`);
      if (!spill && b.minY < L.LEVELS.plot - 0.02) fail(`${s.id}/${b.group} 最低点 ${b.minY.toFixed(2)} 低于地块面 ${L.LEVELS.plot}（穿地）`);
      const margin = Math.min(b.rect[0] - limit[0], b.rect[1] - limit[1], limit[2] - b.rect[2], limit[3] - b.rect[3]);
      info(`${s.id}/${b.group}（${{ building: '主体', attachment: '附属', ground: '地坪/光斑' }[b.role] || b.role}）${fmt(b.rect)}，距${where}边界最小 ${margin.toFixed(2)}，高 ${b.minY.toFixed(2)}–${b.height.toFixed(2)}${b.ground ? `，步行占地 ${fmt(b.ground)}` : ''}`);
      const m = measured && measured[b.group], rec = s.parts.find(q => q.group === b.group).localBounds;
      if (measured && !m) fail(`${s.id}/${b.group} 没有实测数据（运行 tools/measure_samples.mjs）`);
      if (m) { const d = Math.max(...[0, 1, 2].flatMap(k => [Math.abs(m.min[k] - rec.min[k]), Math.abs(m.max[k] - rec.max[k])])); if (d > 0.02) fail(`${s.id}/${b.group} 登记包围盒与实测相差 ${d.toFixed(2)}，需重新测量登记`); }
    }
    for (const b of boxes) for (const o of sampleBoxes.filter(o => o.sample !== s.id)) if (overlapArea(b.rect, o.rect) > EPS) fail(`${s.id}/${b.group} 与 ${o.sample}/${o.group} 重叠`);
    const main = boxes.find(b => b.role === 'building');
    if (main && main.ground) {
      const cover = area(main.ground) / area(p.rect);
      if (cover > 0.6 + EPS) fail(`${s.id} 建蔽率 ${(cover * 100).toFixed(0)}% 超过 60%`);
      info(`${s.id} 主体步行占地 ${+(main.ground[2] - main.ground[0]).toFixed(2)} × ${+(main.ground[3] - main.ground[1]).toFixed(2)}，建蔽率 ${(cover * 100).toFixed(0)}%`);
    }
    // Rain shelter: every registered roof/awning rect lies inside the measured building, and the roof covers the walls.
    const shelters = (s.shelter || []).map(r => { const pts = [[r[0], r[1]], [r[2], r[3]]].map(([x, z]) => L.toWorld(s, x, z)); return [Math.min(pts[0][0], pts[1][0]), Math.min(pts[0][1], pts[1][1]), Math.max(pts[0][0], pts[1][0]), Math.max(pts[0][1], pts[1][1])]; });
    if (!shelters.length) fail(`${s.id} 未登记屋顶/雨棚遮雨区（shelter）`);
    for (const r of shelters) if (main && !contains(main.rect, r, 0.01)) fail(`${s.id} 遮雨区 ${fmt(r)} 越出实测主体 ${fmt(main.rect)}`);
    const walls = main && main.ground && shelters.find(r => r[0] <= main.ground[0] + 0.45 && r[2] >= main.ground[2] - 0.45 && r[1] <= main.ground[1] + 0.8 && r[3] >= main.ground[3] - 0.45);
    if (shelters.length && !walls) fail(`${s.id} 没有覆盖墙体的屋顶遮雨区`);
    info(`${s.id} 遮雨区（降雨排除）${shelters.length} 块：${shelters.map(fmt).join('，')}，共 ${shelters.reduce((a, r) => a + area(r), 0).toFixed(1)} 平方单位`);
    const e = p.entrances[0], [fx, fz] = s.frontDir, c = Math.cos(t.rotY), n = Math.sin(t.rotY);
    const wf = [fx * c + fz * n, -fx * n + fz * c], want = L.DIRS[e.facing];
    if (Math.abs(wf[0] - want[0]) > EPS || Math.abs(wf[1] - want[1]) > EPS) fail(`${s.id} 正面朝向与地块入口 ${e.facing} 不一致`);
    // The frozen frontage anchor drives street furniture (C10); legacy samples may have a documented,
    // small lateral door offset. Validate that exact offset and keep the independent clear-route check below.
    const mid = e.facing === 'N' || e.facing === 'S' ? (p.rect[0] + p.rect[2]) / 2 : (p.rect[1] + p.rect[3]) / 2, at = e.at ?? mid;
    const offset = (e.facing === 'N' || e.facing === 'S' ? e.x : e.z) - at;
    if (Math.abs(offset - (s.doorOffset ?? 0)) > 0.01) fail(`${s.id} 门位相对冻结入口偏移 ${offset.toFixed(2)}，登记值为 ${s.doorOffset ?? 0}`);
    const route = doorRoute(s, p, e);
    if (!route) fail(`${s.id} 门口到地块入口 (${e.x}, ${e.z}) 没有净宽 ${CLEAR_WIDTH} 的通行路径`);
    else { routes[s.id] = route; const len = route.slice(1).reduce((q, r, i) => q + Math.hypot(r[0] - route[i][0], r[1] - route[i][1]), 0);
      info(`${s.id} 门 (${e.door.join(', ')}) → 地块入口 (${e.x}, ${e.z}) 朝 ${e.facing}：净宽 ${CLEAR_WIDTH} 通行路径 ${len.toFixed(1)}，相对冻结设施锚点偏移 ${offset.toFixed(2)}`); }
    info(`${s.id} 地坪 ${s.floor}，${s.floors} 层；源码 buildings/${s.module}.js 已嵌入 index.html`);
  }
});

// ---------- report ----------
const failed = results.filter(r => r.status === 'FAIL').length, warned = results.filter(r => r.status === 'WARN').length;
let report = `# 布局检查报告\n\n由 \`node tools/layout_check.mjs\` 根据 layout.js 生成，勿手工编辑。\n\n结果：${results.length} 项检查，失败 ${failed}，警告 ${warned}。\n\n`;
for (const r of results) report += `## ${r.id} ${r.title} — ${r.status}\n\n${r.details.map(d => `- ${d}`).join('\n')}\n\n`;
report += `## 面积统计（平方单位）\n\n| 类别 | 面积 | 占底座 |\n| --- | ---: | ---: |\n${stats.map(([k, v]) => `| ${k} | ${v.toFixed(1)} | ${(100 * v / area(baseRect)).toFixed(1)}% |`).join('\n')}\n`;
fs.writeFileSync(path.join(docDir, 'layout-report.md'), report);

// ---------- SVG ----------
const S = 11, PAD = 40, MAPW = 2 * H * S;          // main map: 11 px per unit
const DS = 26, detail = [-47, 19.5, -4.5, 47];      // B05 detail view window and scale
const DW = (detail[2] - detail[0]) * DS, DH = (detail[3] - detail[1]) * DS;
const W = PAD * 2 + Math.max(MAPW + 640, DW), Hh = PAD * 2 + MAPW + 90 + DH + 60;
const C = { trim: '#2c3949', ground: '#d9d6c4', plotRes: '#e8ead2', plotOcc: '#f1d9b4', build: '#8a8f6e', cw: '#47566a', band: '#8d99a3', sw: '#c9cfd1', alley: '#bfae8e', walk: '#d6c6a3', apron: '#b9d3df', zebra: '#ffffff', ink: '#273647', node: '#c0504d', ped: '#2f7d5b', veh: '#d07a2a', bld: '#c0392b', att: '#e08a1e', ramp: '#f3e08a', drive: '#e0a96d' };
const sprites = (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'tools', 'out', 'sample_bounds.json'), 'utf8')).sprites; } catch { return null; } })();
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function layer(tx, tz, k, win) {   // world → svg mapping helpers for a view
  const X = x => tx + (x - win[0]) * k, Z = z => tz + (z - win[1]) * k;
  const R = (r, attrs) => { const a = inter(r, win); if (a[2] <= a[0] || a[3] <= a[1]) return ''; return `<rect x="${X(a[0]).toFixed(1)}" y="${Z(a[1]).toFixed(1)}" width="${((a[2] - a[0]) * k).toFixed(1)}" height="${((a[3] - a[1]) * k).toFixed(1)}" ${attrs}/>`; };
  const T = (x, z, s, size, attrs = '') => pointIn(win, x, z) ? `<text x="${X(x).toFixed(1)}" y="${Z(z).toFixed(1)}" font-size="${size}" ${attrs}>${esc(s)}</text>` : '';
  return { X, Z, R, T };
}
function drawView(tx, tz, k, win, detailed) {
  const { X, Z, R, T } = layer(tx, tz, k, win), clip = `clip${tx}_${tz}`;
  let o = `<clipPath id="${clip}"><rect x="${tx}" y="${tz}" width="${(win[2] - win[0]) * k}" height="${(win[3] - win[1]) * k}"/></clipPath><g clip-path="url(#${clip})">`;
  o += R(win, `fill="${C.trim}"`);
  for (const b of L.blocks) o += R(b.rect, `fill="${C.ground}"`);
  for (const p of L.plots) {
    o += R(p.rect, `fill="${p.status === 'occupied' ? C.plotOcc : C.plotRes}" stroke="${C.ink}" stroke-width="1"`);
    o += R(p.buildable, `fill="none" stroke="${C.build}" stroke-width="1" stroke-dasharray="4 3"`);
  }
  for (const s of surf('carriageway')) o += R(s.rect, `fill="${C.cw}"`);
  for (const s of surf('band')) o += R(s.rect, `fill="${C.band}"`);
  for (const s of surf('sidewalk')) o += R(s.rect, `fill="${C.sw}"`);
  // Carriageway square at intersections drawn on top so sidewalks never cover it.
  for (const n of L.roadNodes.filter(n => n.kind === 'intersection')) {
    const ew = L.roads.find(r => r.axis === 'x' && r.at === n.z), ns = L.roads.find(r => r.axis === 'z' && r.at === n.x);
    const a = L.ROAD_TYPES[ns.type].carriageway / 2, b = L.ROAD_TYPES[ew.type].carriageway / 2, rr = L.INTERSECTION.curbRadius;
    o += R([n.x - a - rr, n.z - b, n.x + a + rr, n.z + b], `fill="${C.cw}"`) + R([n.x - a, n.z - b - rr, n.x + a, n.z + b + rr], `fill="${C.cw}"`);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {   // curb returns
      const cx = n.x + sx * (a + rr), cz = n.z + sz * (b + rr);
      if (pointIn(win, cx, cz)) o += `<path d="M ${X(n.x + sx * a)} ${Z(cz)} A ${rr * k} ${rr * k} 0 0 ${sx * sz > 0 ? 1 : 0} ${X(cx)} ${Z(n.z + sz * b)} L ${X(n.x + sx * a)} ${Z(n.z + sz * b)} Z" fill="${C.cw}"/>`
        + `<path d="M ${X(n.x + sx * a)} ${Z(cz)} A ${rr * k} ${rr * k} 0 0 ${sx * sz > 0 ? 1 : 0} ${X(cx)} ${Z(n.z + sz * b)}" fill="none" stroke="#e7e2cf" stroke-width="1.5"/>`;
    }
  }
  for (const a of alleyRects) o += R(a.rect, `fill="${C.alley}" stroke="${C.ink}" stroke-width=".6"`);
  for (const w of walkRects) o += R(w.rect, `fill="${C.walk}" stroke="${C.ink}" stroke-width=".6"`);
  for (const a of apronRects) o += R(a.rect, `fill="${C.apron}" stroke="${C.ink}" stroke-width=".6"`);
  for (const c of L.crosswalks) {
    if (c.kind === 'candidate') { o += R(c.rect, `fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 3"`); continue; }
    const r = c.rect, alongX = r[2] - r[0] < r[3] - r[1];   // stripes parallel to traffic
    const len = alongX ? r[3] - r[1] : r[2] - r[0];
    for (let t = 0.25; t < len - 0.2; t += 0.9) o += R(alongX ? [r[0], r[1] + t, r[2], r[1] + t + 0.45] : [r[0] + t, r[1], r[0] + t + 0.45, r[3]], `fill="${C.zebra}" opacity=".9"`);
  }
  for (const [, f] of Object.entries(fits)) { o += R(f.building, `fill="#c9b48a" fill-opacity=".35" stroke="#8a6d3b" stroke-width="1" stroke-dasharray="2 2"`); for (const a of f.annexes) o += R(a.rect, `fill="${a.name === '停车位' ? '#9fb7c9' : '#d8c9a8'}" fill-opacity=".45" stroke="#6b7c8a" stroke-width=".7" stroke-dasharray="2 2"`); }
  for (const k of L.curbCuts || []) o += R(k.rect, `fill="${k.kind === 'ramp' ? C.ramp : C.drive}" stroke="${C.ink}" stroke-width=".5"`);
  if (detailed && sprites) for (const s of L.structures) {
    const sp = sprites[s.id]; if (!sp) continue;
    const png = fs.readFileSync(path.join(root, 'tools', 'out', sp.file)).toString('base64');
    const t = s.transform, kk = t.scale ?? L.SAMPLE_SCALE;
    o += `<g transform="translate(${X(t.x)} ${Z(t.z)}) rotate(${-t.rotY * 180 / Math.PI}) scale(${k * kk})"><image href="data:image/png;base64,${png}" x="${sp.minX}" y="${sp.minZ}" width="${sp.maxX - sp.minX}" height="${sp.maxZ - sp.minZ}" preserveAspectRatio="none"/></g>`;
  }
  if (detailed) for (const b of sampleBoxes) if (b.ground) o += R(b.ground, `fill="none" stroke="#1d6fa5" stroke-width="1" stroke-dasharray="2 2"`);
  for (const b of sampleBoxes) o += R(b.rect, `fill="${detailed ? 'none' : (b.role === 'building' ? '#b9806a' : 'none')}" stroke="${b.role === 'building' ? C.bld : C.att}" stroke-width="${detailed ? 1.6 : 1}" ${b.role === 'building' ? '' : 'stroke-dasharray="3 2"'}`);
  for (const f of L.legacyFurniture) if (pointIn(win, f.slot.x, f.slot.z)) o += `<circle cx="${X(f.slot.x)}" cy="${Z(f.slot.z)}" r="${detailed ? 5 : 3}" fill="#6a4c93" stroke="#fff" stroke-width="1"/>` + (detailed ? T(f.slot.x + 0.4, f.slot.z - 0.3, f.group, 11, 'fill="#4b2f73" font-weight="600"') : '');
  // Entrances
  for (const p of L.plots) for (const e of p.entrances) {
    const [dx, dz] = L.DIRS[e.facing], len = detailed ? 1.4 : 2.2, col = e.kind === 'vehicle' ? C.veh : C.ped;
    if (!pointIn(win, e.x, e.z)) continue;
    const x1 = X(e.x - dx * len), z1 = Z(e.z - dz * len), x2 = X(e.x + dx * 0.5), z2 = Z(e.z + dz * 0.5);
    o += `<line x1="${x1}" y1="${z1}" x2="${x2}" y2="${z2}" stroke="${col}" stroke-width="${detailed ? 3 : 2}" marker-end="url(#arr-${e.kind})"/>`;
    const route = routes[p.sample || p.building];
    if (route && detailed) o += `<polyline points="${route.filter((q, i) => i % 3 === 0 || i === route.length - 1).map(q => `${X(q[0]).toFixed(1)},${Z(q[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="2.2" stroke-dasharray="5 3"/><circle cx="${X(e.door[0])}" cy="${Z(e.door[1])}" r="4.5" fill="${col}"/>`;
  }
  // Network overlay: centrelines and nodes
  for (const sg of L.roadSegments) {
    const a = nodeById[sg.from], b = nodeById[sg.to];
    o += `<line x1="${X(a.x)}" y1="${Z(a.z)}" x2="${X(b.x)}" y2="${Z(b.z)}" stroke="${sg.type === 'alley' ? '#7a5a2a' : '#f2d27a'}" stroke-width="${detailed ? 1.5 : 1.2}" stroke-dasharray="6 4" opacity=".9"/>`;
  }
  for (const n of L.roadNodes) if (pointIn(win, n.x, n.z)) {
    o += `<circle cx="${X(n.x)}" cy="${Z(n.z)}" r="${n.kind === 'edge' ? 5 : 4}" fill="${n.kind === 'edge' ? '#fff' : C.node}" stroke="${C.node}" stroke-width="2"/>`;
    if (!detailed || n.kind !== 'edge') o += T(n.x + (n.x >= H ? -5.2 : 0.8), n.z + (n.z >= H ? -1 : n.z <= -H ? 2.2 : -0.8), n.name ? `${n.id}/${n.name}` : n.id, detailed ? 12 : 11, `fill="${C.node}" font-weight="700" ${n.x >= H ? 'text-anchor="start"' : ''}`);
  }
  // Labels
  const lab = (x, z, s, size, col, extra = '') => T(x, z, s, size, `fill="${col}" text-anchor="middle" ${extra}`);
  for (const p of L.plots) {
    const cx = (p.rect[0] + p.rect[2]) / 2, cz = (p.rect[1] + p.rect[3]) / 2;
    if (detailed) { const ly = p.status === 'occupied' ? p.rect[3] - 1.6 : p.rect[1] + (p.front === 'N' ? 2.6 : 1.4); o += lab(cx, ly, `${p.id}`, 13, C.ink, 'font-weight="700"') + lab(cx, ly + 1, `${p.uses.join('/')} · ${p.status === 'occupied' ? '已占用' : '预留'}`, 11, C.ink); }
    else { const occ = p.status === 'occupied'; o += lab(cx, cz - (occ ? 2.6 : 0.2), p.id.slice(4), 10, C.ink, 'font-weight="700"') + lab(cx, cz + (occ ? -1.4 : 1.1), p.building ? p.uses[p.uses.length - 1] : p.uses[0], 9, '#4d5a63'); }
  }
  if (!detailed) {
    for (const b of L.blocks) o += T(b.rect[0] + 0.3, b.rect[1] - 0.45, `${b.id} ${b.name}`, 12, `fill="${b.rect[1] <= -H + M ? '#e8ecef' : '#1f4e5a'}" font-weight="800"`);
    for (const r of L.roads) { const t = r.axis === 'x' ? [-30, r.at + 0.45] : [r.at + 0.4, -40]; o += lab(...t, `${r.id} ${r.name}`, 11, '#fdf6dc', `font-weight="700" ${r.axis === 'z' ? `transform="rotate(-90 ${X(t[0])} ${Z(t[1])})"` : ''}`); }
    for (const a of alleyRects) o += lab(a.rect[0] + 6, (a.rect[1] + a.rect[3]) / 2 + 0.45, a.id, 10, '#3b2d14', 'font-weight="700"');
    for (const w of walkRects) o += lab((w.rect[0] + w.rect[2]) / 2, w.rect[1] - 0.2, w.id, 9, '#3b2d14', 'font-weight="700"');
    for (const a of apronRects) o += lab((a.rect[0] + a.rect[2]) / 2, (a.rect[1] + a.rect[3]) / 2 + 0.45, a.id, 9, '#1f3b4d', 'font-weight="700"');
  } else {
    o += lab(-30, 15.4, 'R01 主街', 13, '#fdf6dc', 'font-weight="700"') + lab(-25, 32.6, 'A01 内巷', 12, '#3b2d14', 'font-weight="700"') + lab(-18, 22.2, 'W01', 11, '#3b2d14', 'font-weight="700"');
  }
  return o + '</g>';
}

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" font-family="'Noto Sans CJK SC','Noto Sans SC','Microsoft YaHei',sans-serif">
<defs>${['pedestrian', 'vehicle'].map(k => `<marker id="arr-${k}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${k === 'vehicle' ? C.veh : C.ped}"/></marker>`).join('')}</defs>
<rect width="100%" height="100%" fill="#f4f1e8"/>
<text x="${PAD}" y="${PAD - 12}" font-size="20" font-weight="800" fill="${C.ink}">道路与地块俯视检查图 · 96 × 96（1 格 = 4 单位，北在上，+X 东，+Z 南）</text>`;
// grid
const gx = PAD, gy = PAD;
svg += drawView(gx, gy, S, baseRect, false);
for (let v = -H; v <= H; v += 4) svg += `<line x1="${gx + (v + H) * S}" y1="${gy}" x2="${gx + (v + H) * S}" y2="${gy + MAPW}" stroke="#000" stroke-opacity="${v % 16 === 0 ? .12 : .04}"/><line x1="${gx}" y1="${gy + (v + H) * S}" x2="${gx + MAPW}" y2="${gy + (v + H) * S}" stroke="#000" stroke-opacity="${v % 16 === 0 ? .12 : .04}"/>`;
for (let v = -H; v <= H; v += 16) svg += `<text x="${gx + (v + H) * S}" y="${gy + MAPW + 14}" font-size="10" text-anchor="middle" fill="#555">${v}</text><text x="${gx - 4}" y="${gy + (v + H) * S + 3}" font-size="10" text-anchor="end" fill="#555">${v}</text>`;
svg += `<rect x="${gx + (detail[0] + H) * S}" y="${gy + (detail[1] + H) * S}" width="${(detail[2] - detail[0]) * S}" height="${(detail[3] - detail[1]) * S}" fill="none" stroke="#c0392b" stroke-width="2" stroke-dasharray="8 4"/>`;
// legend + results
const lx = gx + MAPW + 30; let ly = gy + 6;
const leg = [[C.cw, '车行道'], [C.band, '路缘/设施带'], [C.sw, '人行道（净宽 2）'], [C.alley, '内巷（共享 3.5）'], [C.walk, '人行通道'], [C.apron, '公交候车区'], [C.ramp, '无台阶过街坡道（1:10）'], [C.drive, '车辆出入口降坡（仅设施带）'], [C.plotRes, '预留空地'], [C.plotOcc, '已占用地块（样板/新建筑）'], [C.trim, '底座收边'], ['#e3d8c0', '候选建筑占地（C11 试排）'], ['#cdd8e0', '候选停车位/附属设施']];
svg += `<text x="${lx}" y="${ly}" font-size="15" font-weight="800" fill="${C.ink}">图例</text>`; ly += 12;
for (const [c, t] of leg) { svg += `<rect x="${lx}" y="${ly}" width="22" height="13" fill="${c}" stroke="${C.ink}" stroke-width=".6"/><text x="${lx + 30}" y="${ly + 11}" font-size="12" fill="${C.ink}">${t}</text>`; ly += 19; }
const legL = [['line', C.build, '4 3', '可建范围（扣除退界）'], ['line', C.bld, '', '样板建筑实测包围盒'], ['line', C.att, '3 2', '附属设施实测包围盒'], ['line', '#1d6fa5', '2 2', '行走高度占地（y 0.3–1.8）'], ['line', '#f2d27a', '6 4', '道路中心线（连接图）'], ['line', '#7a5a2a', '6 4', '内巷中心线'], ['arrow', C.ped, '', '人行入口与朝向'], ['arrow', C.veh, '', '车辆出入口'], ['dot', C.node, '', '道路节点 / ○ 边界出口'], ['dot', '#6a4c93', '', '原街道设施临时位置'], ['zebra', '#fff', '', '斑马线（虚线框=候选过街）']];
for (const [k, c, d, t] of legL) {
  if (k === 'line') svg += `<line x1="${lx}" y1="${ly + 7}" x2="${lx + 22}" y2="${ly + 7}" stroke="${c}" stroke-width="2.5" ${d ? `stroke-dasharray="${d}"` : ''}/>`;
  if (k === 'arrow') svg += `<line x1="${lx}" y1="${ly + 7}" x2="${lx + 18}" y2="${ly + 7}" stroke="${c}" stroke-width="2.5" marker-end="url(#arr-${c === C.veh ? 'vehicle' : 'pedestrian'})"/>`;
  if (k === 'dot') svg += `<circle cx="${lx + 11}" cy="${ly + 7}" r="5" fill="${c}"/>`;
  if (k === 'zebra') svg += `<rect x="${lx}" y="${ly}" width="22" height="13" fill="${C.cw}"/>${[0, 1, 2, 3].map(i => `<rect x="${lx + 2 + i * 5}" y="${ly + 1}" width="2.5" height="11" fill="#fff"/>`).join('')}`;
  svg += `<text x="${lx + 30}" y="${ly + 11}" font-size="12" fill="${C.ink}">${t}</text>`; ly += 19;
}
ly += 14; svg += `<text x="${lx}" y="${ly}" font-size="15" font-weight="800" fill="${C.ink}">检查结果（${failed ? `失败 ${failed}` : '全部通过'}${warned ? `，警告 ${warned}` : ''}）</text>`; ly += 8;
for (const r of results) { ly += 19; svg += `<text x="${lx}" y="${ly}" font-size="12.5" fill="${r.status === 'FAIL' ? '#b03a2e' : r.status === 'WARN' ? '#b9770e' : '#1e7d4f'}" font-weight="700">${r.status === 'PASS' ? '✓' : r.status === 'WARN' ? '△' : '✗'} ${r.id} ${esc(r.title)}</text>`; }
ly += 30; svg += `<text x="${lx}" y="${ly}" font-size="15" font-weight="800" fill="${C.ink}">面积统计</text>`;
for (const [k, v] of stats) { ly += 18; svg += `<text x="${lx}" y="${ly}" font-size="12" fill="${C.ink}">${k}</text><text x="${lx + 250}" y="${ly}" font-size="12" text-anchor="end" fill="${C.ink}">${v.toFixed(0)}</text><text x="${lx + 310}" y="${ly}" font-size="12" text-anchor="end" fill="#666">${(100 * v / area(baseRect)).toFixed(1)}%</text>`; }
ly += 30;
for (const line of ['道路：R01 车行 7 + 两侧(设施带 0.5 + 人行 2)', 'R02/R03 车行 6 + 两侧(设施带 1 + 人行 2)', '走廊均为 12；路口转角半径 3；斑马线宽 3', '样板统一尺度 1（实测），仅平移与绕 Y 旋转 180°', '地块编号仅用于检查图，不进入最终场景']) { svg += `<text x="${lx}" y="${ly}" font-size="11.5" fill="#444">${line}</text>`; ly += 17; }
// detail view
const dy = gy + MAPW + 70;
svg += `<text x="${PAD}" y="${dy - 12}" font-size="17" font-weight="800" fill="${C.ink}">B05 局部（${DS} px/单位）：已有样板实测俯视渲染按 layout.js 变换放入地块；红框=建筑包围盒，橙虚框=附属设施，蓝点框=行走高度占地，绿虚线=门口到地块入口的净宽 0.7 路径</text>`;
svg += drawView(PAD, dy, DS, detail, true);
svg += `<rect x="${PAD}" y="${dy}" width="${DW}" height="${DH}" fill="none" stroke="#c0392b" stroke-width="2"/>`;
for (let v = Math.ceil(detail[0] / 2) * 2; v <= detail[2]; v += 2) svg += `<text x="${PAD + (v - detail[0]) * DS}" y="${dy + DH + 14}" font-size="10" text-anchor="middle" fill="#555">${v}</text>`;
for (let v = Math.ceil(detail[1] / 2) * 2; v <= detail[3]; v += 2) svg += `<text x="${PAD - 4}" y="${dy + (v - detail[1]) * DS + 3}" font-size="10" text-anchor="end" fill="#555">${v}</text>`;
svg += '</svg>';
fs.writeFileSync(path.join(docDir, 'topdown.svg'), svg);

for (const r of results) console.log(`${r.status.padEnd(4)} ${r.id} ${r.title}${r.status !== 'PASS' ? '\n  ' + r.details.filter(d => !d.startsWith('·')).join('\n  ') : ''}`);
console.log(`areas: ${stats.map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')}`);
console.log(`wrote docs/layout/layout-report.md, docs/layout/topdown.svg${sprites ? '' : ' (no sample sprites: run tools/measure_samples.mjs)'}`);

if (process.argv.includes('--png')) {
  const { launchChromium } = await import('./browser.mjs');
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: W, height: Hh } });
  await page.goto(pathToFileURL(path.join(docDir, 'topdown.svg')).href);
  await page.screenshot({ path: path.join(docDir, 'topdown.png') });   // fullPage hangs on SVG documents
  await browser.close();
  console.log('wrote docs/layout/topdown.png');
}
process.exit(failed ? 1 : 0);
