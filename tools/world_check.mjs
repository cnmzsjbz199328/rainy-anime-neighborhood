// Planet layout checks WC1-WC11 (W1). Run: node tools/world_check.mjs [--write]
//   --write   also writes docs/world/survey/check-report.md and area-report.md
// WC12-WC14 belong to W2/W8 and are reported as PENDING.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const W = require(path.join(root, 'world.js'));
const LAYOUT = require(path.join(root, 'layout.js'));
const D = Math.PI / 180, R = W.R;
const t0 = Date.now();
const out = [];                       // lines of the full report
const say = s => { console.log(s); out.push(s); };
const results = [];
const pct = v => (v * 100).toFixed(2) + '%';
const fmt = (v, n = 1) => v.toFixed(n);

function check(id, title, fn) {
  const info = [], fails = [];
  const ctx = { info: m => info.push(m), fail: m => fails.push(m) };
  fn(ctx);
  const status = fails.length ? 'FAIL' : 'PASS';
  results.push({ id, status });
  say(`${status} ${id} ${title}`);
  for (const m of fails) say('  ✗ ' + m);
  for (const m of info) say('  · ' + m);
}
function pending(id, title) { results.push({ id, status: 'PENDING' }); say(`PENDING ${id} ${title}（待 W2/W8，不计失败）`); }

// ---------------------------------------------------------------- area model shared by WC1 and WC2
const shares = W.computeAreaShares(0.25);
const ras = W.zoneRaster(0.25);
function viewShares(clon, clat = 0) {
  const cv = W.vec(clon, clat), tot = {}; let T = 0;
  for (let y = 0; y < ras.ny; y++) {
    const lat = -90 + (y + 0.5) * ras.gridDeg, cl = Math.cos(lat * D);
    for (let x = 0; x < ras.nx; x++) {
      const lon = -180 + (x + 0.5) * ras.gridDeg;
      const dp = cl * (Math.cos(lon * D) * cv[0] + Math.sin(lon * D) * cv[1]) + Math.sin(lat * D) * cv[2];
      if (dp <= 0) continue;
      const wgt = cl * dp, i = ras.cell[y * ras.nx + x], z = i ? W.regions[i - 1].zone : 'wild';
      tot[z] = (tot[z] || 0) + wgt; T += wgt;
    }
  }
  for (const k in tot) tot[k] /= T;
  return tot;
}
const VIEWS = [['front', 0, 0], ['east', 90, 0], ['back', 180, 0], ['west', -90, 0]];
const views = Object.fromEntries(VIEWS.map(([n, lon, lat]) => [n, viewShares(lon, lat)]));

// ocean connectivity on a 0.5 degree raster (4-neighbour flood fill, wraps in longitude)
function oceanPieces() {
  const r = W.zoneRaster(0.5), nx = r.nx, ny = r.ny, lab = new Int32Array(nx * ny).fill(-1), isO = i => (r.cell[i] ? W.regions[r.cell[i] - 1].zone : 'wild') === 'ocean';
  const pieces = []; let total = 0;
  for (let y = 0; y < ny; y++) total += Math.cos((-90 + (y + 0.5) * r.gridDeg) * D) * nx;
  for (let s = 0; s < nx * ny; s++) {
    if (lab[s] >= 0 || !isO(s)) continue;
    const id = pieces.length, stack = [s]; lab[s] = id; let area = 0; const kinds = {};
    while (stack.length) {
      const i = stack.pop(), x = i % nx, y = (i - x) / nx;
      area += Math.cos((-90 + (y + 0.5) * r.gridDeg) * D);
      const k = W.regions[r.cell[i] - 1].kind; kinds[k] = (kinds[k] || 0) + 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const yy = y + dy; if (yy < 0 || yy >= ny) continue;
        const j = yy * nx + ((x + dx + nx) % nx);
        if (lab[j] < 0 && isO(j)) { lab[j] = id; stack.push(j); }
      }
    }
    pieces.push({ id, share: area / total, kinds });
  }
  return pieces;
}

check('WC1', '面积预算按球面面积计算，各项在容差以内', ({ info, fail }) => {
  const T = W.areaBudget.targets, tol = W.areaBudget.tolerance;
  for (const z of ['building', 'ocean', 'wild', 'ice']) {
    const v = shares.zone[z] || 0;
    info(`${z} ${pct(v)}（目标 ${pct(T[z])} ±${(tol * 100).toFixed(0)} 个百分点）`);
    if (Math.abs(v - T[z]) > tol) fail(`${z} ${pct(v)} 超出 ${pct(T[z])} ±${(tol * 100).toFixed(0)} 个百分点`);
  }
  info('细分占比：' + Object.entries(shares.kind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v)}`).join('，'));
  const pieces = oceanPieces().filter(p => p.share > 0.0005);
  info('海洋分片：' + pieces.map(p => `${Object.keys(p.kinds).join('+')} ${pct(p.share)}`).join('，'));
  if (pieces.length < 3) fail(`海洋只有 ${pieces.length} 片，需要至少 3 片`);
  for (const p of pieces) if (p.share < 0.03) fail(`海洋片 ${Object.keys(p.kinds).join('+')} 只有 ${pct(p.share)}，小于 3%`);
});

check('WC2', '四个方向的全景中，建筑带、海洋、荒野各占可见面积的 15% 以上', ({ info, fail }) => {
  for (const [n, lon, lat] of VIEWS) {
    const v = views[n];
    info(`${n}（${lat}°, ${lon}°）：建筑 ${pct(v.building || 0)}，海洋 ${pct(v.ocean || 0)}，荒野 ${pct(v.wild || 0)}，冰盖 ${pct(v.ice || 0)}`);
    for (const z of ['building', 'ocean', 'wild']) if ((v[z] || 0) < 0.15) fail(`${n} 方向 ${z} 只有 ${pct(v[z] || 0)}，小于 15%`);
  }
});

// ---------------------------------------------------------------- road helpers
const NET = W.roadNetwork, EDGES = NET.edges, NODES = NET.nodes;
const SLOPE_LIMIT = { RD01: 0.06, RD02: 0.15, RD03: 0.10, RD04: 0.15, RD05: 0.15, RD06: 0.15, RD07: 0.15, RD08: 0.15 };
const STAIRS_LIMIT = 0.60;
const samples = new Map();
for (const e of EDGES) samples.set(e.id, NET.samplePath(e, 1));
const landmarks = W.landmarks.filter(l => l.id !== 'TOWN');

check('WC3', '路网连通，9 个出口各有接续，10 个目的地都能由城镇到达', ({ info, fail }) => {
  const ids = new Set(NODES.map(n => n.id)), parent = {};
  const find = a => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  const union = (a, b) => { parent[find(a)] = find(b); };
  NODES.forEach(n => (parent[n.id] = n.id));
  for (const e of EDGES) {
    if (!ids.has(e.from) || !ids.has(e.to)) { fail(`${e.id} 的端点节点不存在`); continue; }
    const a = NET.nodeById[e.from], b = NET.nodeById[e.to], c = e.controls;
    if (W.arcDistance(c[0], a) > 0.01 || W.arcDistance(c[c.length - 1], b) > 0.01) fail(`${e.id} 的首尾控制点与端点节点不重合`);
    union(e.from, e.to);
  }
  const byLm = {};
  for (const n of NODES) { const g = n.landmark || (n.kind === 'town-exit' ? 'TOWN' : null); if (g) (byLm[g] = byLm[g] || []).push(n.id); }
  for (const g in byLm) for (const id of byLm[g]) union(byLm[g][0], id);   // a landmark joins its entrances; the town joins its exits
  const comps = new Set(NODES.map(n => find(n.id)));
  info(`节点 ${NODES.length}，边 ${EDGES.length}，总长 ${fmt(EDGES.reduce((s, e) => s + NET.edgeLength(e), 0), 0)} m，连通分量 ${comps.size}`);
  if (comps.size !== 1) fail(`路网不连通：${comps.size} 个分量`);
  const exits = NODES.filter(n => n.kind === 'town-exit');
  if (exits.length !== 9) fail(`城镇出口节点 ${exits.length} 个，应为 9`);
  for (const n of exits) if (!EDGES.some(e => e.from === n.id || e.to === n.id)) fail(`出口 ${n.id} 没有接续的边`);
  for (const lm of landmarks) {
    if (!byLm[lm.id]) { fail(`${lm.id} 没有入口节点`); continue; }
    if (find(byLm[lm.id][0]) !== find(exits[0].id)) fail(`${lm.id} 无法从城镇到达`);
  }
  info('出口：' + exits.map(n => n.id).join('、') + '；目的地入口：' + landmarks.map(l => `${l.id}(${(byLm[l.id] || []).length})`).join(' '));
});

// window slope: |h(s+2.5) - h(s-2.5)| / 5 on 1 m samples; windows touching a span are classed separately
const hAt = (arr, s) => { const i = Math.max(0, Math.min(arr.length - 2, Math.floor(s))); return arr[i].h + (arr[i + 1].h - arr[i].h) * (s - i); };
function edgeSlopes(e) {
  const S = samples.get(e.id), len = NET.edgeLength(e), res = { max: 0, maxAt: 0, stairsMax: 0, stairsAt: 0, free: 0 };
  const sc = len / (S.length - 1);                     // samples are ~1 m apart
  for (let k = 0; k < S.length; k++) {
    const s0 = S[k].s - 2.5, s1 = S[k].s + 2.5;
    if (s0 < 0 || s1 > len) continue;
    const inSpan = S.filter(p => p.s >= s0 - 1e-9 && p.s <= s1 + 1e-9 && p.span);
    const a = (s0 / sc), b = (s1 / sc);
    const slope = Math.abs(hAt(S, b) - hAt(S, a)) / 5;
    if (inSpan.length) {
      if (inSpan.every(p => p.span === 'stairs') && inSpan.length >= 5) { if (slope > res.stairsMax) { res.stairsMax = slope; res.stairsAt = S[k].s; } }
      continue;
    }
    res.free++;
    if (slope > res.max) { res.max = slope; res.maxAt = S[k].s; }
  }
  return res;
}
const slopeTable = [];
check('WC4', '每个道路等级的坡度不超过上限（5 m 窗口平均坡度；桥、隧道、栈道不计，石阶 ≤ 60%）', ({ info, fail }) => {
  for (const e of EDGES) {
    const lim = SLOPE_LIMIT[e.class], r = edgeSlopes(e), len = NET.edgeLength(e);
    slopeTable.push({ id: e.id, cls: e.class, len, ...r, lim });
    if (r.free && r.max > lim + 1e-9) fail(`${e.id} ${e.class} 在 ${fmt(r.maxAt)} m 处坡度 ${pct(r.max)} > ${pct(lim)}`);
    if (r.stairsMax > STAIRS_LIMIT + 1e-9) fail(`${e.id} 石阶在 ${fmt(r.stairsAt)} m 处坡度 ${pct(r.stairsMax)} > ${pct(STAIRS_LIMIT)}`);
    for (const sp of e.spans) {
      if (sp.type === 'tunnel') {
        const S = samples.get(e.id), sEnd = sp.toMeters === 'end' ? len : sp.toMeters, g = Math.abs(hAt(S, sEnd / (len / (S.length - 1))) - hAt(S, sp.fromMeters / (len / (S.length - 1)))) / (sEnd - sp.fromMeters);
        if (g > lim) fail(`${e.id} 隧道两端口高差坡度 ${pct(g)} > ${pct(lim)}`);
        info(`${e.id} 隧道 ${fmt(sp.fromMeters)}–${fmt(sEnd)} m（长 ${fmt(sEnd - sp.fromMeters)} m），端口间坡度 ${pct(g)}`);
      }
    }
  }
  const tight = slopeTable.filter(r => r.free).sort((a, b) => b.max / b.lim - a.max / a.lim).slice(0, 4);
  info('最紧的边：' + tight.map(r => `${r.id} ${pct(r.max)}/${pct(r.lim)}`).join('，'));
  const st = slopeTable.filter(r => r.stairsMax > 0);
  if (st.length) info('石阶最大坡度：' + st.map(r => `${r.id} ${pct(r.stairsMax)}`).join('，'));
  info('卡片没有给出坡度数字的等级（RD02/RD04/RD07/RD08）采用 RD05 的 15%，RD06 石阶上限取 60%（踏步高 0.17 / 踏面 0.28）');
});

check('WC5', '道路跨越水面（海、河）处都有桥或栈道', ({ info, fail }) => {
  let waterSamples = 0, bad = 0;
  for (const e of EDGES) {
    const S = samples.get(e.id); let first = null;
    for (const p of S) {
      const water = p.h < 0 || W.riverCrossing(p.lon, p.lat) <= 0 || W.regionAt(p.lon, p.lat).zone === 'ocean';
      if (!water) continue;
      waterSamples++;
      if (p.span !== 'bridge' && p.span !== 'boardwalk') { bad++; if (first === null) first = p.s; }
    }
    if (first !== null) fail(`${e.id} 在 ${fmt(first)} m 处的水面上没有桥或栈道`);
  }
  info(`水面采样点 ${waterSamples} 个，无桥或栈道 ${bad} 个`);
  const sp = EDGES.flatMap(e => e.spans.filter(s => s.type === 'bridge' || s.type === 'boardwalk').map(s => `${e.id}:${s.type}`));
  info('桥与栈道：' + sp.join('、'));
});

check('WC6', '道路不穿过地标内部、不进入城镇补丁（只经 9 个出口），只在入口处接入', ({ info, fail }) => {
  const exits = NODES.filter(n => n.kind === 'town-exit');
  let minClear = Infinity, minWho = '';
  for (const e of EDGES) {
    let inTown = 0, lmHit = {};
    for (const p of samples.get(e.id)) {
      if (W.insideTownPatch(p.lon, p.lat) && !exits.some(n => W.arcDistance(n, p) < 0.6)) inTown++;
      for (const lm of landmarks) {
        const d = W.arcDistance(p, lm), clear = d - lm.radius;
        if (clear < minClear) { minClear = clear; minWho = `${e.id}↔${lm.id}`; }
        if (clear < -0.2) lmHit[lm.id] = Math.max(lmHit[lm.id] || 0, -clear);
      }
    }
    if (inTown) fail(`${e.id} 有 ${inTown} 个采样点进入城镇补丁`);
    for (const id in lmHit) fail(`${e.id} 压入 ${id} 的占地半径 ${fmt(lmHit[id])} m`);
  }
  for (const n of NODES.filter(q => q.kind === 'landmark-entrance')) {
    const lm = W.landmarks.find(l => l.id === n.landmark), ent = lm.entrances.find(en => `${lm.id}-${en.id}` === n.id);
    if (!ent || W.arcDistance(n, ent) > 0.01) fail(`${n.id} 与地标登记的入口不一致`);
  }
  info(`与地标占地圆的最小间隙 ${fmt(minClear)} m（${minWho}）；占地半径取设计卡「尺度」一节的场地半径，LM01 取火山口与山顶局部模型范围`);
});

// town edge: points within 15 m (spherical) outside the patch
check('WC7', '城镇补丁外缘 15 m 内：|height−1.6| ≤ 0.05×距离+0.05，相邻 1 m 网格坡度 ≤ 5%', ({ info, fail }) => {
  const half = LAYOUT.BASE.half; let n = 0, worstDev = -Infinity, worstSlope = 0, devAt = '', slopeAt = '';
  const ll = (x, z) => W.townToLonLat(x, z);
  const hOf = (x, z) => { const p = ll(x, z); return W.height(p.lon, p.lat); };
  for (let x = -half - 20; x <= half + 20; x += 1) for (let z = -half - 20; z <= half + 20; z += 1) {
    const p = ll(x, z), d = W.townPatchDistance(p.lon, p.lat);
    if (d <= 0 || d > 15) continue;
    n++;
    const dev = Math.abs(W.height(p.lon, p.lat) - 1.6) - 0.05 * d;
    if (dev > worstDev) { worstDev = dev; devAt = `(${fmt(x)}, ${fmt(z)}) d=${fmt(d)}`; }
    const sc = 1 / Math.cos(p.lat * D), e = 0.5 * sc;       // 0.5 m on the sphere, in Mercator units
    const gx = (hOf(x + e, z) - hOf(x - e, z)) / 1, gz = (hOf(x, z + e) - hOf(x, z - e)) / 1;
    const sl = Math.hypot(gx, gz);
    if (sl > worstSlope) { worstSlope = sl; slopeAt = `(${fmt(x)}, ${fmt(z)}) d=${fmt(d)}`; }
  }
  info(`检查 ${n} 个点；max(|height−1.6| − 0.05×距离) = ${fmt(worstDev, 3)} m（须 ≤ 0.05）；最大坡度 ${pct(worstSlope)}（须 ≤ 5%）`);
  if (worstDev > 0.05 + 1e-9) fail(`高度偏差超限：|height−1.6| − 0.05×距离 = ${fmt(worstDev, 3)} m > 0.05（${devAt}）`);
  if (worstSlope > 0.05) fail(`坡度 ${pct(worstSlope)} > 5%（${slopeAt}）`);
});

check('WC8', '从 3 个街道视点能看到雨见岳山顶越过地平线', ({ info, fail }) => {
  const lm = W.landmarks.find(l => l.id === 'LM01'), baseR = 30;
  for (const [name, x, z] of [['N04', 0, -48], ['N05', 0, -33.5], ['N06', 0, -15]]) {
    const vp = W.townToLonLat(x, z), h0 = W.height(vp.lon, vp.lat) + 1.6, dist = W.arcDistance(vp, lm);
    const pts = W.greatCirclePoints(vp, lm, 1);
    let best = -Infinity, bestS = 0, bestH = 0, fg = -Infinity;
    pts.forEach((p, i) => {
      if (i === 0) return;
      const s = Math.min(i, dist), H = W.height(p[0], p[1]);
      const a = Math.atan2((R + H) * Math.cos(s / R) - (R + h0), (R + H) * Math.sin(s / R)) / D;
      if (a > best) { best = a; bestS = s; bestH = H; }
      if (dist - s > baseR && a > fg) fg = a;
    });
    const dip = Math.acos(R / (R + h0)) / D;      // the horizon of a sphere of radius R seen from eye height h0 lies this far below the horizontal
    info(`${name}：到山顶 ${fmt(dist)} m，视点高 ${fmt(h0)} m；最大仰角 ${fmt(best, 2)}°（出现在 ${fmt(bestS)} m 处，高 ${fmt(bestH)} m）；山体范围外中间点最大仰角 ${fmt(fg, 2)}°；球面地平线在水平线下 ${fmt(dip, 2)}°，山顶高出地平线 ${fmt(best + dip, 2)}°`);
    if (best + dip < 0.1) fail(`${name}：山顶没有越过地平线（仰角 ${fmt(best, 2)}° < 地平线 −${fmt(dip, 2)}°）`);
    if (bestH < 0.9 * 26) fail(`${name}：天际线最高点只有 ${fmt(bestH)} m，不在山顶`);
    if (best - fg < 0.1) fail(`${name}：山顶仰角只比前景最大仰角高 ${fmt(best - fg, 3)}° < 0.1°`);
    if (dist > Math.sqrt(2 * R * h0) + Math.sqrt(2 * R * 26)) fail(`${name}：超出地平线加山高极限`);
  }
  info('说明：平顶山体近端点的仰角必然大于山顶中心，故「山顶」按山体范围（半径 30 m）之外的中间点比较，并要求天际线最高点位于山顶 10% 高度内');
});

check('WC9', '河流全程向下游下降并入海，不穿过城镇补丁', ({ info, fail }) => {
  for (const rv of W.rivers) {
    const dense = []; for (let i = 0; i + 1 < rv.points.length; i++) { const seg = W.greatCirclePoints(rv.points[i], rv.points[i + 1], 1); seg.pop(); dense.push(...seg); } dense.push(rv.points[rv.points.length - 1]);
    let prev = Infinity, worst = 0, inTown = 0, maxH = -Infinity;
    const hs = dense.map(p => W.height(p[0], p[1]));
    for (let i = 0; i < hs.length; i++) { if (hs[i] - prev > worst) worst = hs[i] - prev; prev = hs[i]; if (hs[i] > maxH) maxH = hs[i]; if (W.insideTownPatch(dense[i][0], dense[i][1])) inTown++; }
    const last = dense[dense.length - 1], zone = W.regionAt(last[0], last[1]).zone, hl = hs[hs.length - 1];
    info(`${rv.id}：长 ${fmt(dense.length)} m，源头高 ${fmt(hs[0])} m，终点高 ${fmt(hl, 2)} m（${zone}），最大回升 ${fmt(worst, 3)} m`);
    if (worst > 0.05) fail(`${rv.id} 有回升 ${fmt(worst, 3)} m > 0.05`);
    if (zone !== 'ocean' || hl > 0) fail(`${rv.id} 终点不在海洋中或高度 > 0`);
    if (inTown) fail(`${rv.id} 穿过城镇补丁`);
  }
});

check('WC10', '地标锚点：区域、高度、坡度符合设计卡；地标之间不重叠', ({ info, fail }) => {
  for (const lm of W.landmarks) {
    const reg = W.regionAt(lm.lon, lm.lat), h = W.height(lm.lon, lm.lat);
    if (reg.zone !== lm.zone) fail(`${lm.id} 在 ${reg.zone}（${reg.id}），设计卡要求 ${lm.zone}`);
    if (Math.abs(lm.baseHeight - Math.round(h * 10) / 10) > 1e-9) fail(`${lm.id} baseHeight ${lm.baseHeight} 与 height() ${fmt(h, 2)} 不一致`);
    if (lm.check.height && (h < lm.check.height[0] || h > lm.check.height[1])) fail(`${lm.id} 高度 ${fmt(h, 2)} 不在 ${lm.check.height.join('–')} m`);
    let worst = 0;
    if (lm.check.maxSlope !== undefined) {
      const rmax = Math.max(1, lm.radius);
      for (let r = 0; r <= rmax; r += 1) for (let a = 0; a < 360; a += r === 0 ? 360 : Math.max(5, Math.round(360 / (2 * Math.PI * r)))) {
        const p = W.destination(lm, a, r), hp = W.height(p.lon, p.lat);
        if (hp < 0) continue;
        const q1 = W.destination(p, 90, 0.5), q2 = W.destination(p, 270, 0.5), q3 = W.destination(p, 0, 0.5), q4 = W.destination(p, 180, 0.5);
        if ([q1, q2, q3, q4].some(q => W.height(q.lon, q.lat) < 0)) continue;
        const sl = Math.hypot(W.height(q1.lon, q1.lat) - W.height(q2.lon, q2.lat), W.height(q3.lon, q3.lat) - W.height(q4.lon, q4.lat));
        if (sl > worst) worst = sl;
      }
      if (worst > lm.check.maxSlope + 1e-9) fail(`${lm.id} 占地内最大坡度 ${pct(worst)} > ${pct(lm.check.maxSlope)}`);
    }
    info(`${lm.id} ${lm.name}：(${fmt(lm.lat, 2)}°, ${fmt(lm.lon, 2)}°)，${reg.zone}/${reg.kind}（${reg.id}），底面 ${lm.baseHeight} m，占地半径 ${lm.radius} m${lm.check.maxSlope !== undefined ? `，占地内最大坡度 ${pct(worst)}（上限 ${pct(lm.check.maxSlope)}）` : ''}`);
  }
  for (let i = 0; i < W.landmarks.length; i++) for (let j = i + 1; j < W.landmarks.length; j++) {
    const a = W.landmarks[i], b = W.landmarks[j], d = W.arcDistance(a, b);
    if (d < a.radius + b.radius) fail(`${a.id} 与 ${b.id} 重叠：距离 ${fmt(d)} m < ${a.radius + b.radius} m`);
  }
  // highest point on the sphere: the volcano summit; the other ranges stay within 15-22 m
  let top = { h: -Infinity }, other = { h: -Infinity };
  for (let lat = -80; lat <= 80; lat += 0.5) for (let lon = -180; lon < 180; lon += 0.5) {
    const h = W.height(lon, lat);
    if (h > top.h) top = { h, lon, lat };
    if (W.arcDistance([lon, lat], W.landmarks[1]) > 36 && h > other.h) other = { h, lon, lat };
  }
  info(`全球最高点 ${fmt(top.h, 2)} m 位于 (${fmt(top.lat, 1)}°, ${fmt(top.lon, 1)}°)；雨见岳以外最高 ${fmt(other.h, 2)} m（山脉 15–22 m）`);
  const summit = W.height(W.landmarks[1].lon, W.landmarks[1].lat);
  if (top.h > summit + 0.01 || W.arcDistance(top, W.landmarks[1]) > 5) fail('全球最高点不在雨见岳山顶');
  if (other.h > 22.5) fail(`其他山脉高度 ${fmt(other.h, 2)} m 超过 22 m`);
});

check('WC11', 'LM05、LM06、LM07 在同一大圆上，误差不超过 0.5°', ({ info, fail }) => {
  const L = id => W.landmarks.find(l => l.id === id), x = W.crossTrack(L('LM05'), L('LM06'), L('LM07'));
  info(`LM05 到 LM06–LM07 大圆的偏差 ${fmt(x, 3)}°（LM05 ${L('LM05').lat}°N ${-L('LM05').lon}°W）`);
  if (Math.abs(x) > 0.5) fail(`偏差 ${fmt(x, 3)}° > 0.5°`);
});

pending('WC12', '弯曲为 0 时，现有布局检查与截图与改动前一致');
pending('WC13', '天气锁定为雨时现有检查与截图一致；天气可复现');
pending('WC14', '全景距离下没有雨丝和遮挡地表的云层');

const failed = results.filter(r => r.status === 'FAIL').length;
const summary = `${failed ? 'FAIL' : 'PASS'} world_check：WC1–WC11 ${results.filter(r => r.status === 'PASS').length}/11 通过，WC12–WC14 待后续阶段`;
out.push(summary);                                              // the written report stays deterministic: no timing in it
console.log(`${summary}；用时 ${((Date.now() - t0) / 1000).toFixed(1)} s`);

if (process.argv.includes('--write')) {
  const dir = path.join(root, 'docs/world/survey'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'check-report.md'), '# world_check 完整输出\n\n由 `node tools/world_check.mjs --write` 生成；确定性输出，重复运行结果一致。\n\n```\n' + out.join('\n') + '\n```\n');
  const a = [];
  a.push('# 星球面积报告', '', '由 `node tools/world_check.mjs --write` 生成。按球面面积计算：每个 0.25° 网格按 cos(纬度) 加权。', '');
  a.push('## WC1 面积预算', '', '| 类别 | 占比 | 目标 | 容差 | 结果 |', '| --- | --- | --- | --- | --- |');
  for (const z of ['building', 'ocean', 'wild', 'ice']) { const v = shares.zone[z], t = W.areaBudget.targets[z]; a.push(`| ${z} | ${pct(v)} | ${pct(t)} | ±2 个百分点 | ${Math.abs(v - t) <= 0.02 ? '通过' : '未通过'} |`); }
  a.push('', '### 细分', '', '| 细分 | 占比 |', '| --- | --- |');
  for (const [k, v] of Object.entries(shares.kind).sort((p, q) => q[1] - p[1])) a.push(`| ${k} | ${pct(v)} |`);
  a.push('', '### 按区域', '', '| 区域 | zone/kind | 占比 |', '| --- | --- | --- |');
  const allR = [...W.regions, { id: 'default-grassland', zone: 'wild', kind: 'grassland' }];
  for (const [k, v] of Object.entries(shares.region).sort((p, q) => q[1] - p[1])) { const r = allR.find(q => q.id === k); a.push(`| ${k} | ${r.zone}/${r.kind} | ${pct(v)} |`); }
  a.push('', '### 海洋分片（互不连通）', '', '| 片 | 占比 |', '| --- | --- |');
  for (const p of oceanPieces().filter(q => q.share > 0.0005)) a.push(`| ${Object.keys(p.kinds).join('+')} | ${pct(p.share)} |`);
  a.push('', '## WC2 四个方向的可见面积占比', '', '视图中心的 90° 内，按投影面积 cos(纬度) × cos(到视图中心的角距) 加权。', '', '| 方向 | 中心 | 建筑 | 海洋 | 荒野 | 冰盖 |', '| --- | --- | --- | --- | --- | --- |');
  for (const [n, lon, lat] of VIEWS) { const v = views[n]; a.push(`| ${n} | (${lat}°, ${lon}°) | ${pct(v.building || 0)} | ${pct(v.ocean || 0)} | ${pct(v.wild || 0)} | ${pct(v.ice || 0)} |`); }
  a.push('');
  fs.writeFileSync(path.join(dir, 'area-report.md'), a.join('\n'));
  say('已写入 docs/world/survey/check-report.md 与 area-report.md');
}
process.exit(failed ? 1 : 0);
