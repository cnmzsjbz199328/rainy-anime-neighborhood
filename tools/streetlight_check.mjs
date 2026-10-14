// W10c streetlight normalization check (docs/world/STREETLIGHT_NORMALIZATION_PLAN.md section 5). Run after `python3 build.py`:  node tools/streetlight_check.mjs
//   SL1 coverage: every road that should be lit has its rule; CR01 round the whole loop (first and last lamp included), its junctions; RD03 <= 30 m along the road
//   SL2 registry: stable unique ids; every former lamp (taken from the baseline commit) moved or removed with a reason; body, lens, pool and ripples one to one
//   SL3 clearance: feet outside every road's whole cross-section + 0.5 m, off fields, trunks, furniture, landmark sites, wires; frozen data unchanged
//   SL4 one family: no other road-lamp geometry in the page; sizes, heading, feet on the ground, the pole along the local radial on the sphere
//   SL5 display: the same camera gives the same windows; the 1-2 px window at both ends and between is shared by body, lens and pool; night light on the flat
//       map, none on the sphere; no doubled lamps while switching
//   SL6 page: no errors, the first frame is the whole world, capacities do not grow under panning and zooming
// Independent of streetlights.js: the road network comes from world.js (samplePath), the former lamps from the baseline commit (pre-w10c-streetlights: the old
// roads.js, bridge.js and section_plan.js run here under Node), distances and clearances are computed here, the page gives the actual instances.
// Report: docs/world/w10c/streetlights/report.json (git-ignored, like every review output of docs/world/w*/).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
const BASE_REF = 'pre-w10c-streetlights', R = 90, D = Math.PI / 180;
const outDir = path.join(root, 'docs/world/w10c/streetlights'); fs.mkdirSync(outDir, { recursive: true });
const results = [], report = { ref: BASE_REF, checks: {} };
const f = (v, n = 2) => (typeof v === 'number' ? v.toFixed(n) : String(v));
function check(id, title, fn) {
  const info = [], fails = []; fn({ info: m => info.push(m), fail: m => fails.push(m) });
  results.push({ id, ok: !fails.length }); report.checks[id] = { title, ok: !fails.length, fails, info };
  console.log(`${fails.length ? 'FAIL' : 'PASS'} ${id} ${title}`); for (const m of fails) console.log('  ✗ ' + m); for (const m of info) console.log('  · ' + m);
}

// ---------------------------------------------------------------- Node: the authoritative network and the baseline's lamps
globalThis.LAYOUT = require(path.join(root, 'layout.js'));
const L = globalThis.LAYOUT, W = globalThis.WORLD = require(path.join(root, 'world.js')), NET = W.roadNetwork;
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const frozenDiff = ['layout.js', 'world.js'].filter(p => { try { execFileSync('git', ['diff', '--quiet', BASE_REF, '--', p], { cwd: root }); return false; } catch { return true; } });
const old = (() => {
  const dir = path.join(root, 'tools/out/streetlight-baseline'); fs.mkdirSync(dir, { recursive: true });
  for (const p of ['terrain.js', 'roadkit.js', 'bridge.js', 'steps.js', 'roads.js', 'section_plan.js']) fs.writeFileSync(path.join(dir, p), git('show', `${BASE_REF}:${p}`));
  const TERR = require(path.join(dir, 'terrain.js')); globalThis.ROADKIT = require(path.join(dir, 'roadkit.js')); globalThis.BRIDGE = require(path.join(dir, 'bridge.js')); globalThis.STEPS = require(path.join(dir, 'steps.js'));
  const ROADS = require(path.join(dir, 'roads.js')), SECP = require(path.join(dir, 'section_plan.js'));
  const H = TERR.sampler(W, { lonMin: -181, lonMax: 181, latMin: -90, latMax: 90 }), TB = TERR.builder(W), P = ROADS.plan(W, H, (lo, la) => TB.vertex(lo, la).c);
  const routes = P.routes.map(rt => ({ id: rt.def.id, kind: rt.def.furnish && rt.def.furnish.kind, stations: (rt.lamps || []).map(l => l.s), removedAtJunction: (rt.junctionLampRemovals || []).map(q => q.station),
    instances: (rt.instances.lamp || []).map(it => ({ lon: it.lon, lat: it.lat })), pools: (rt.instances.lampPool || []).length }));
  const bridges = P.bridges.map(b => ({ id: b.def.id, stations: b.lamps.map(l => l.s), sides: b.lamps.map(l => l.side), instances: (b.instances.lamp || []).length }));
  return { routes, bridges, w4: (SECP.plan(W).items.lamp || []).map(it => ({ lon: it.lon, lat: it.lat })) };
})();
const SECP = require(path.join(root, 'section_plan.js')), PLW4 = SECP.plan(W);
const arc = (a, b) => W.arcDistance(a, b);
const flat = (lon, lat) => { const p = W.lonLatToTown(lon, lat); return { x: p.x, z: p.z, k: 1 / Math.cos(lat * D) }; };
// an edge (or a chain of edges, each possibly reversed) as points every 0.5 m with the station, flat position and the flat right-hand normal
function chain(segs) {
  const out = []; let off = 0;
  for (const { id, rev } of segs) { const e = NET.edges.find(q => q.id === id), len = NET.edgeLength(e); let P = NET.samplePath(e, 0.5); if (rev) P = P.slice().reverse().map(p => ({ ...p, s: len - p.s }));
    P.forEach((p, i) => { if (out.length && i === 0) return; out.push({ lon: p.lon, lat: p.lat, s: p.s + off, span: p.span, edge: id, ...flat(p.lon, p.lat) }); }); off += len; }
  out.forEach((p, i) => { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; p.r = [-dz / l, dx / l]; });
  return out;
}
const nearestOn = (C, lon, lat) => { const q = flat(lon, lat); let best = null; for (const p of C) { const d = Math.hypot(p.x - q.x, p.z - q.z); if (!best || d < best.d) best = { d, p }; } const p = best.p; return { s: p.s, edge: p.edge, d: arc(p, { lon, lat }), o: ((q.x - p.x) * p.r[0] + (q.z - p.z) * p.r[1]) / p.k, p }; };

// ---------------------------------------------------------------- the page
const browser = await launchChromium(), page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
const BENIGN = /build\/three\.(min\.)?js" are deprecated|GL Driver Message|GPU stall due to ReadPixels/;
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !BENIGN.test(m.text())) errors.push(m.text()); });
await page.addInitScript(INIT);
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__scene && window.__scene.streetlights && window.__scene.streetlights.state.built, null, { timeout: 180000 });
await page.evaluate(() => { window.__step(3); });
const T = await page.evaluate(() => {
  const S = window.__scene, SL = S.streetlights, Dt = SL.data(), pick = q => ({ id: q.id, model: q.model, owner: q.owner, reason: q.reason, source: q.source, line: q.line, edge: q.edge, node: q.node, station: q.station, side: q.side, offset: q.offset, shift: q.shift, sideSwapped: !!q.sideSwapped, zone: q.zone,
    lon: q.lon, lat: q.lat, alt: q.alt, x: q.x, y: q.y, z: q.z, k: q.k, scale: q.scale, yaw: q.yaw, face: q.face, head: q.head, pool: q.pool, townXZ: q.townXZ || null });
  const o = SL.objects, inst = o.bodies.map((m, j) => ({ name: m.name, count: m.count, lens: o.lenses[j].count, hull: o.hulls[j].count, mat: Array.from(m.instanceMatrix.array), sameMatrix: o.lenses[j].instanceMatrix === m.instanceMatrix && o.hulls[j].instanceMatrix === m.instanceMatrix }));
  const pg = o.pool.geometry, lampAttr = Array.from(pg.attributes.aLamp.array), rip = S.roads.state.ripples;
  return { lamps: Dt.lamps.map(pick), removed: Dt.removed, mapping: Dt.mapping, junctions: Dt.junctions, coverage: Dt.coverage, stats: Dt.stats, models: window.STREETLIGHTS.MODELS, PIXELS: window.STREETLIGHTS.PIXELS,
    inst, pool: { vertices: pg.attributes.position.count, lamp: lampAttr, alleySlot: Dt.pool.alleySlot, reflections: Dt.reflections.length },
    ripples: { table: Dt.ripples.map(r => [r.lon, r.lat, r.alt]), mesh: rip ? rip.spots.length : 0, meshLamp: rip ? rip.spots.slice(0, Dt.ripples.length).map(r => [r.lon, r.lat, r.alt]) : [] } };
});
report.table = { lamps: T.lamps.length, byModel: T.stats.byModel, removed: T.removed, mapping: T.mapping, junctions: T.junctions };

// ---------------------------------------------------------------- SL1
check('SL1', '覆盖：应照明道路都有策略；CR01 全环（含首尾）≤ 30 m、十个路口有灯；RD03 普通相邻灯距 ≤ 30 m；RD01 / 桥沿用 16 / 40 / 16 m', ({ info, fail }) => {
  const ringEdges = NET.edges.filter(e => e.route === 'RN04').map(e => e.id), ring = chain(ringEdges.map(id => ({ id }))), Lr = ring[ring.length - 1].s;
  // a lamp lights the ring where its pool centre falls within the ring's cross-section (RD03: 3.55 m on the ditch side, 2.75 m on the other; the ring runs
  // clockwise, its ditch is outside, offsets + towards the town)
  const pts = T.lamps.map(q => ({ q, n: nearestOn(ring, q.pool.lon, q.pool.lat) })).filter(e => e.n.d < 6 && e.n.o >= -3.55 - 0.2 && e.n.o <= 2.75 + 0.2).sort((a, b) => a.n.s - b.n.s);
  const gaps = pts.map((e, i) => { const nx = pts[(i + 1) % pts.length]; return { from: e.q.id, to: nx.q.id, g: ((nx.n.s - e.n.s) % Lr + Lr) % Lr }; });
  const worst = gaps.reduce((a, b) => (b.g > a.g ? b : a), { g: 0 });
  if (!pts.length || worst.g > 30) fail(`CR01 最大相邻间距 ${f(worst.g, 1)} m（${worst.from} → ${worst.to}）> 30 m`);
  info(`CR01 长 ${f(Lr, 1)} m：照亮环路的灯 ${pts.length} 盏（其中 CR01 自有 ${pts.filter(e => e.q.line === 'CR01' && e.q.owner === 'route').length} 盏），沿里程相邻间距 ${f(Math.min(...gaps.map(g => g.g)), 1)}–${f(worst.g, 1)} m，首尾接续 ${f(gaps[gaps.length - 1].g, 1)} m（${gaps[gaps.length - 1].from} → ${gaps[gaps.length - 1].to}）`);
  const nodes = NET.nodes.filter(n => /^C01-/.test(n.id) && NET.edges.filter(e => e.from === n.id || e.to === n.id).some(e => e.route !== 'RN04')).map(n => { const best = T.lamps.map(q => ({ id: q.id, d: arc(q.pool, n) })).sort((a, b) => a.d - b.d)[0]; return { node: n.id, ...best }; });
  for (const n of nodes) if (n.d > 12) fail(`路口 ${n.node} 最近光池 ${f(n.d, 1)} m > 12 m`);
  info(`CR01 路口 ${nodes.length} 个，最近光池：${nodes.map(n => `${n.node} ${n.id} ${f(n.d, 1)} m`).join('；')}`);
  report.cr01 = { length: Lr, lamps: pts.map(e => ({ id: e.q.id, s: e.n.s, o: e.n.o })), gaps, nodes };
  // every point of the RD03 edges outside the town within 15.5 m of a pool (half of 30 m along the road plus the pool's lateral offset); the RD05 links are unlit by card
  const rd03 = NET.edges.filter(e => e.class === 'RD03'), stretch = [];
  for (const e of rd03) { let w = { d: 0 }; for (const p of NET.samplePath(e, 1)) { if (W.insideTownPatch(p.lon, p.lat)) continue; let m = Infinity, id = null; for (const q of T.lamps) { const d = arc(q.pool, p); if (d < m) { m = d; id = q.id; } } if (m > w.d) w = { d: m, s: p.s, id }; } stretch.push({ edge: e.id, ...w }); if (w.d > 15.5) fail(`RD03 ${e.id} 在 ${f(w.s, 1)} m 处离最近光池 ${f(w.d, 1)} m > 15.5 m`); }
  info(`RD03 全部 ${rd03.length} 条边（CR01 18、RN05-01、RN06-01、四条 6 m 接线）每 1 m 到最近光池的最远距离 ${f(Math.max(...stretch.map(q => q.d)), 1)} m（${stretch.reduce((a, b) => (b.d > a.d ? b : a)).edge}）`);
  // RN05: the bus stop (2.108 m from C01-T02) is lit
  { const e = NET.edges.find(q => q.id === 'RN05-01'), stop = NET.samplePath(e, 0.1).reduce((a, p) => (Math.abs(p.s - 2.108) < Math.abs(a.s - 2.108) ? p : a)), best = T.lamps.map(q => ({ id: q.id, d: arc(q.pool, stop) })).sort((a, b) => a.d - b.d)[0];
    if (best.d > 8) fail(`RN05 公交站最近光池 ${f(best.d, 1)} m > 8 m`); info(`RN05-01 公交站最近光池 ${best.id} ${f(best.d, 1)} m`); }
  // RD01: along each route outside the town, adjacent lamps 16 m on inhabited land (<= 18), 40 m in the wild (<= 44); a gap across the tunnel does not count
  const routes = { 'N03-east': [['RN01-18'], ['RN01-19'], ['RN01-01'], ['RN01-02']], 'N01-west': [['RN01-17', 1], ['RN01-16', 1], ['RN01-15', 1], ['RN01-14', 1]], 'RN01-ridge': [['RN01-04'], ['RN01-05'], ['RN01-06']], 'RN01-west': [['RN01-10'], ['RN01-11'], ['RN01-12']] };
  const rd01 = [];
  for (const [id, segs] of Object.entries(routes)) {
    const C = chain(segs.map(([e, rev]) => ({ id: e, rev: !!rev }))), own = T.lamps.filter(q => q.line === id && q.owner === 'route').map(q => ({ q, n: nearestOn(C, q.lon, q.lat) })).sort((a, b) => a.n.s - b.n.s);
    const tun = C.filter(p => p.span === 'tunnel'), t0 = tun.length ? tun[0].s : null, t1 = tun.length ? tun[tun.length - 1].s : null;
    own.slice(1).forEach((e, i) => { const a = own[i], g = e.n.s - a.n.s, mid = C.reduce((b, p) => (Math.abs(p.s - (a.n.s + g / 2)) < Math.abs(b.s - (a.n.s + g / 2)) ? p : b)), human = W.regionAt(mid.lon, mid.lat).zone === 'building', overTunnel = t0 !== null && a.n.s < t1 && e.n.s > t0;
      rd01.push({ route: id, from: a.q.id, to: e.q.id, g, zone: human ? 'human' : 'wild', tunnel: overTunnel });
      if (!overTunnel && g > (human ? 18 : 44)) fail(`RD01 ${id} ${a.q.id} → ${e.q.id} 间距 ${f(g, 1)} m > ${human ? 18 : 44} m`); });
    const out = C.find(p => !W.insideTownPatch(p.lon, p.lat)), Lc = C[C.length - 1].s;
    info(`RD01 ${id}：城外 ${f(Lc - out.s, 1)} m ${own.length} 盏，站距 ${own.map(e => f(e.n.s, 1)).join('、') || '—'}；相邻 ${rd01.filter(q => q.route === id).map(q => `${f(q.g, 1)}${q.tunnel ? '（跨隧道不计）' : ''}`).join('、') || '—'}`);
  }
  report.rd01 = rd01;
  // the bridges: 16 m from 8 m (the deck's own rule), sides alternating
  for (const id of ['RN01-03', 'RN01-07+08+09', 'RN01-13']) {
    const C = chain(id.split('+').map((s, i) => ({ id: i ? 'RN01-' + s : s }))), own = T.lamps.filter(q => q.line === id).map(q => nearestOn(C, q.lon, q.lat)).sort((a, b) => a.s - b.s), g = own.slice(1).map((n, i) => n.s - own[i].s);
    if (own.length && (Math.abs(own[0].s - 8) > 1 || g.some(v => Math.abs(v - 16) > 2 && Math.abs(v - 32) > 2))) fail(`桥 ${id} 首灯 ${f(own[0].s, 1)} m、间距 ${g.map(v => f(v, 1)).join('、')}`);
    info(`桥 ${id}：${own.length} 盏，首灯 ${own.length ? f(own[0].s, 1) : '—'} m，间距 ${g.map(v => f(v, 1)).join('、')}（塔旁 2 m 内不设，跳过处为 32 m）`);
  }
  // the policy of every edge outside the town that a card asks to light
  const lit = new Set(['RD01', 'RD02', 'RD03']), covered = new Set([...ringEdges, 'RN05-01', 'RN06-01', 'RN02-01', 'RN02-07', 'RN03-01', 'RN03-04', ...Object.values(routes).flat().map(s => s[0]), 'RN01-03', 'RN01-07', 'RN01-08', 'RN01-09', 'RN01-13']);
  const missing = NET.edges.filter(e => lit.has(e.class) && !covered.has(e.id)).map(e => e.id); if (missing.length) fail(`没有布灯策略的 RD01/RD02/RD03 边：${missing.join('、')}`);
  info(`策略：RD01/RD02/RD03 边 ${NET.edges.filter(e => lit.has(e.class)).length} 条均有归属（RD01 路线 4 条、桥 3 座、CR01、RN05-01、RN06-01 与接线）；RD04/RD05/RD08 无灯（卡片），RD06 石灯笼、RD07 栈道矮灯各归原模块`);
  for (const c of T.coverage.filter(q => q.nearest)) info(`${c.road}（${c.class}）：最近光池 ${c.nearest} ${f(c.d, 1)} m${c.required ? '' : '（RD05 无灯）'}`);
  for (const c of T.coverage.filter(q => q.nearest && q.required && q.d > 15)) fail(`接线 ${c.road} 最近光池 ${f(c.d, 1)} m > 15 m`);
});

// ---------------------------------------------------------------- SL2
check('SL2', '登记：稳定 id 唯一；旧灯（基线提交）逐盏迁移或注明移除原因；灯体、灯头、光池与涟漪和灯表一一对应；无近邻重复', ({ info, fail }) => {
  const ids = T.lamps.map(q => q.id); if (new Set(ids).size !== ids.length || ids.some(v => !v)) fail('灯 id 重复或为空');
  const byId = Object.fromEntries(T.lamps.map(q => [q.id, q])), mapTo = Object.fromEntries(T.mapping.map(m => [m.from, m]));
  for (const q of T.lamps) for (const k of ['model', 'owner', 'reason', 'lon', 'lat', 'alt', 'yaw', 'face', 'head', 'pool']) if (q[k] === undefined || q[k] === null) fail(`${q.id} 缺 ${k}`);
  // the town: the 26 lamps of layout.js and the store's lamp, at the very places of layout.js
  let town = 0; for (const fu of L.furniture.filter(q => q.kind === 'lamp' || (q.kind === 'legacy' && q.group === 'streetLamp'))) {
    const src = fu.kind === 'lamp' ? 'layout:' + fu.id : 'scene:streetLamp', m = mapTo[src], q = m && byId[m.to];
    if (!q) { fail(`城镇灯 ${src} 没有迁移`); continue; } const p = flat(q.lon, q.lat); if (Math.hypot(p.x - fu.x, p.z - fu.z) > 1e-6) fail(`${q.id} 离 layout 灯位 ${f(Math.hypot(p.x - fu.x, p.z - fu.z), 6)}`); else town++; }
  // the W4 entrance lamps of the baseline section plan
  let w4 = 0; old.w4.forEach((o, k) => { const m = mapTo['section_plan:lamp#' + k], q = m && byId[m.to]; if (!q || Math.abs(q.lon - o.lon) > 1e-9 || Math.abs(q.lat - o.lat) > 1e-9) fail(`W4 入口灯 #${k} 未在原位迁移`); else w4++; });
  // the routes: every station of the old W5 rule (drawn, cut at a junction or standing on the town street) is a lamp within 5 m along its road or a removal with a reason
  const rows = [], removedBy = src => T.removed.find(r => r.source === src);
  for (const o of old.routes.filter(q => q.kind === 'RD01' || q.kind === 'RD03')) {
    const all = [...o.stations, ...o.removedAtJunction].sort((a, b) => a - b), cfgOnly = o.kind === 'RD03' && !all.length;
    const list = cfgOnly ? [2.108] : all;          // RN05: the pole was drawn, its pool and record cut (station from the route's cfg)
    list.forEach((s, k) => { const src = `roads:${o.id}#${k}`, m = mapTo[src], q = m && m.to && byId[m.to], r = removedBy(src);
      if (q) { if (Math.abs(q.station - s) > 5 + 1e-6) fail(`${src} 新站 ${f(q.station, 2)} 与旧站 ${f(s, 2)} 相差 > 5 m`); rows.push({ src, old: s, to: q.id, station: q.station, change: m.change }); }
      else if (r) rows.push({ src, old: s, removed: r.reason, blockers: r.blockers });
      else fail(`${src}（旧站 ${f(s, 2)} m）既无新灯也无移除记录`); });
  }
  for (const o of old.bridges) o.stations.forEach((s, k) => { const src = `bridge:${o.id}#${k}`, m = mapTo[src], q = m && m.to && byId[m.to]; if (!q || Math.abs(q.station - s) > 0.01 || q.side !== o.sides[k]) fail(`${src} 未在原站迁移`); else rows.push({ src, old: s, to: q.id }); });
  const oldDrawn = 27 + old.routes.reduce((n, r) => n + r.instances.length, 0) + old.bridges.reduce((n, b) => n + b.instances, 0) + old.w4.length;
  const moved = rows.filter(r => r.to).length, gone = rows.filter(r => r.removed).length;
  info(`基线（${BASE_REF}）普通道路灯 ${oldDrawn} 盏绘制：城镇 ${town}/27 原位迁移，W4 ${w4}/2 原位迁移；路线/桥旧站 ${rows.length} 个（含 2 个路口净空曾删、RN05 失配灯杆 1 个）→ 迁移 ${moved}、移除 ${gone}`);
  for (const r of rows.filter(q => q.removed)) info(`移除 ${r.src}（旧站 ${f(r.old, 1)} m）：${r.removed}`);
  for (const r of rows.filter(q => q.to && q.change && /along|other side/.test(q.change))) info(`迁移 ${r.src} → ${r.to}（${f(r.station, 1)} m）：${r.change}`);
  report.mapping = rows;
  const fresh = T.lamps.filter(q => !q.source); info(`新增 ${fresh.length} 盏（CR01 路口 ${fresh.filter(q => q.reason === 'junction').length}、填充 ${fresh.filter(q => q.reason !== 'junction').length}），共 ${T.lamps.length} 盏：${Object.entries(T.stats.byModel).map(([k, v]) => `${k} ${v}`).join('、')}`);
  // one to one with the page: instances per model, lens and ink with the same matrices, a pool of 193 vertices per lamp, the ripples
  for (const m of T.inst) { const key = m.name.split(':')[1], n = T.lamps.filter(q => q.model === key).length; if (m.count !== n || m.lens !== n || m.hull !== n || !m.sameMatrix) fail(`${m.name}：实例 ${m.count}/灯头 ${m.lens}/墨线 ${m.hull}，灯表 ${n}`); }
  if (T.inst.reduce((a, m) => a + m.count, 0) !== T.lamps.length) fail('实例总数与灯表不符');
  const hist = new Map(); for (const v of T.pool.lamp) hist.set(Math.round(v), (hist.get(Math.round(v)) || 0) + 1);
  const ring = 1 + 8 * 24, short = T.lamps.map((q, i) => [q.id, hist.get(i) || 0]).filter(([, n]) => n < ring);
  if (short.length) fail(`光池顶点不足：${short.slice(0, 5).map(([id, n]) => id + ' ' + n).join('、')}`);
  if ([...hist.keys()].some(k => k < 0 || k > T.pool.alleySlot)) fail('光池顶点的灯序号越界');
  info(`光池 ${T.pool.vertices} 顶点：每盏灯 ≥ ${ring}（接缝切开处多出的点仍属同一盏），水洼反光 ${T.pool.reflections} 处（巷灯反光用末位 ${T.pool.alleySlot}）`);
  const owned = T.lamps.filter(q => q.owner !== 'town').length; if (T.ripples.table.length !== 2 * owned) fail(`道路涟漪 ${T.ripples.table.length} ≠ 2 × ${owned}`);
  if (JSON.stringify(T.ripples.table) !== JSON.stringify(T.ripples.meshLamp)) fail('涟漪网格的灯光涟漪与灯表不同');
  info(`道路涟漪：灯表 ${T.ripples.table.length} 处（每盏非城镇灯 2 处）全部进入唯一涟漪网格（共 ${T.ripples.mesh} 处，含城镇水洼）`);
  // near duplicates, also across sources, edges and the closed ring
  const pairs = []; for (let i = 0; i < T.lamps.length; i++) for (let j = i + 1; j < T.lamps.length; j++) { const a = T.lamps[i], b = T.lamps[j], d = arc(a, b), dp = arc(a.pool, b.pool); if (d < 8 || dp < 8) pairs.push({ a: a.id, b: b.id, foot: d, pool: dp }); }
  for (const p of pairs) if (p.foot < 4 || p.pool < 3) fail(`近邻重复 ${p.a} / ${p.b}：杆距 ${f(p.foot)} m、光池距 ${f(p.pool)} m`);
  info(`8 m 内的灯对 ${pairs.length} 对，最近杆距 ${pairs.length ? f(Math.min(...pairs.map(p => p.foot))) : '—'} m、最近光池距 ${pairs.length ? f(Math.min(...pairs.map(p => p.pool))) : '—'} m（限 4 / 3 m）`);
});

// ---------------------------------------------------------------- SL3 (in the page: the authoritative road strips, the land cover, the W4 plan, computed here)
const C3 = await page.evaluate(({ lamps }) => {
  const S = window.__scene, W = window.WORLD, L = window.LAYOUT, RD = S.roads.data(), COV = S.cover.data(), PL = S.section.plan(), R = 90, D = Math.PI / 180;
  const fl = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) }), P = 2 * Math.PI * R, wx = d => d - P * Math.round(d / P);
  const dist = (a, b) => { const p = fl(a.lon, a.lat), q = fl(b.lon, b.lat); return Math.hypot(wx(p.x - q.x), p.z - q.z) / ((p.k + q.k) / 2); };
  const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (((p[i][1] > z) !== (p[j][1] > z)) && (x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; return c; };
  const segD = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1e-12))); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  const polyD = (p, x, z) => { let d = Infinity; for (let i = 0, j = p.length - 1; i < p.length; j = i++) d = Math.min(d, segD(x, z, p[j], p[i])); return inPoly(p, x, z) ? -d : d; };
  const r = 0.1, out = [];
  // the road strips as drawn: for each route, the nearest sample, the lateral offset across its tangent, the whole cross-section there (footprint)
  const across = (rt, lon, lat) => { const q = fl(lon, lat); let bi = -1, bd = Infinity; rt.samples.forEach((p, i) => { const g = fl(p.lon, p.lat), d = Math.hypot(wx(g.x - q.x), g.z - q.z); if (d < bd) { bd = d; bi = i; } });
    const n = rt.samples.length, a = fl(rt.samples[Math.max(0, bi - 1)].lon, rt.samples[Math.max(0, bi - 1)].lat), b = fl(rt.samples[Math.min(n - 1, bi + 1)].lon, rt.samples[Math.min(n - 1, bi + 1)].lat), g = fl(rt.samples[bi].lon, rt.samples[bi].lat);
    const tx = wx(b.x - a.x), tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, o = (wx(q.x - g.x) * (-tz / l) + (q.z - g.z) * (tx / l)) / g.k / (rt.cf ? rt.cf[bi] : 1), along = (wx(q.x - g.x) * tx / l + (q.z - g.z) * tz / l) / g.k;
    return { i: bi, d: bd / g.k, o, end: (bi === 0 || bi === n - 1) && Math.abs(along) > 0.3 }; };
  const TRUNK = { treeRound: 0.16, cedar: 0.2, pine: 0.2, bamboo: 0.51 }, PROPS = { rack: 1.3, rackFallen: 1.3, hutFarm: 1.5, hutRusty: 1.5, oldMachine: 1.1, scarecrow: 0.4, shrub: 0.7, shrubLow: 0.6, rockBig: 1.0, rock: 0.5, mossRock: 0.5, log: 1.7, logMoss: 1.6 };
  const FURN = { barrierConcrete: 1.0, milestone: 0.15, signBus: 0.25, busBench: 0.8, pole: 0.15, mirror: 0.35, vending: 0.55, jizo: 0.25, lantern: 0.25, stonePost: 0.15, gatePost: 0.22, torii: 1.1, stoneStep: 0.7, pierColumn: 0.9, pierFooting: 1.3, signRound: 0.3 };
  const furn = []; for (const src of [...RD.routes.map(x => x.instances), ...RD.bridges.map(b => b.instances), ...RD.stairs.map(s => s.instances), ...(RD.extras || []).map(e => e.instances), { gatePost: RD.markers }]) for (const [t, list] of Object.entries(src || {})) if (FURN[t]) for (const it of list) furn.push({ t, it, r: FURN[t] * Math.max(it.s[0], it.s[2]) });
  // the W4 furniture by its clearance radius; the bamboo fence by its real extent: posts from -0.9 to +0.9 m and rails to -3 m along its local x (flora.js)
  const w4 = Object.entries(PL.items).flatMap(([t, list]) => ['tuft', 'weed', 'seedling', 'flower', 'fern', 'weedShadow'].includes(t) ? [] : list.map(it => ({ t, it, r: t === 'fenceBamboo' ? 0.05 : it.clearance, seg: t === 'fenceBamboo' ? [0.95, -3.05] : null })));
  const w4d = (q, e) => { if (!e.seg) return dist(q, e.it); const g = fl(e.it.lon, e.it.lat), p = fl(q.lon, q.lat), c = Math.cos(e.it.yaw), s = Math.sin(e.it.yaw), A = [g.x + c * e.seg[0] * g.k, g.z - s * e.seg[0] * g.k], B = [g.x + c * e.seg[1] * g.k, g.z - s * e.seg[1] * g.k]; return segD(g.x + wx(p.x - g.x), p.z, A, B) / g.k; };
  const trees = COV.items.filter(it => TRUNK[it.type] || PROPS[it.type]);
  const P0 = W.TOWN_PATCH, tX = R * P0.lonMax * D, tZ = R * Math.asinh(Math.tan(P0.latMax * D));
  for (const q of lamps) {
    if (q.owner === 'town') continue;
    const hits = [], soft = [], f = fl(q.lon, q.lat), frozen = q.owner === 'w4';     // the W4 lamps stand where the C01-S fix put them: only the roads are a hard rule for them
    if (Math.abs(f.x) < tX && Math.abs(f.z) < tZ) hits.push('城镇范围内');
    for (const rt of RD.routes) { const a = across(rt, q.lon, q.lat); if (a.d > 14 || a.end) continue; const fp = rt.footprint[a.i]; if (q.owner !== 'bridge' && a.o > fp[2] - 0.5 - r + 0.02 && a.o < fp[3] + 0.5 + r - 0.02) hits.push(`${rt.def.id} 完整断面 ${fp[2].toFixed(2)}…${fp[3].toFixed(2)}，杆基横距 ${a.o.toFixed(2)}`); }
    for (const b of RD.bridges) { const a = across(b, q.lon, q.lat); if (a.d > 12 || a.end) continue; if (q.owner === 'bridge' && q.line === b.def.id) { if (Math.abs(a.o) - r < 3.5 + 0.3 || Math.abs(a.o) + r > 4.7) hits.push(`桥面杆基 ${a.o.toFixed(2)} 不在车道 3.8 m 与护栏 4.7 m 之间`); } else if (Math.abs(a.o) < 5 + 0.5 + r) hits.push(`桥 ${b.def.id}`); }
    if (q.owner !== 'bridge') {
      for (const c of COV.cells || []) { const d = polyD(c.outer, f.x, f.z) / f.k; if (d < r) hits.push(`田块（含田埂）${d.toFixed(2)}`); }
      for (const it of trees) { const d = dist(q, it); if (d < 3 && d < (TRUNK[it.type] ? TRUNK[it.type] * Math.max(it.s[0], it.s[2]) : PROPS[it.type] * Math.max(it.s[0], it.s[2])) + r) hits.push(`${it.type} ${d.toFixed(2)}`); }
      for (const e of w4) { const d = w4d(q, e); if (d < e.r + r) (frozen ? soft : hits).push(`W4 ${e.t} ${d.toFixed(2)}`); }
      for (const lm of W.landmarks) if (lm.id !== 'TOWN' && W.arcDistance(q, lm) < lm.radius) (frozen ? soft : hits).push(`地标 ${lm.id} 场地圈内 ${W.arcDistance(q, lm).toFixed(1)} / ${lm.radius} m`);
      if (W.height(q.lon, q.lat) < 0.35) hits.push('海面');
    }
    for (const e of furn) { const d = dist(q, e.it); if (d < e.r + r && !(q.owner === 'bridge' && e.t === 'barrierConcrete' && d > 0.3)) hits.push(`${e.t} ${d.toFixed(2)}`); }
    out.push({ id: q.id, hits, soft });
  }
  // wires (the RD03 pole lines, the W4 entrance poles, the town's lines): the arm and head of every lamp keep 0.3 m
  // all in the flat display frame (the town's wires and lamps in the town's own frame, the planet's at height x 1/cos lat), distances back in metres (/ k)
  const wires = [], top = (it, o, alt) => { const g = fl(it.lon, it.lat), c = Math.cos(it.yaw), s = Math.sin(it.yaw); return [g.x + c * o * g.k, (alt - 1.6 + 7.75) * g.k, g.z - s * o * g.k]; };
  for (const rt of RD.routes) { const ps = rt.poles || []; for (let a = 0; a + 1 < ps.length; a++) for (const o of [-0.8, 0, 0.8]) wires.push([top(ps[a].rec, o, ps[a].rec.alt), top(ps[a + 1].rec, o, ps[a + 1].rec.alt), 0.5 * fl(ps[a].rec.lon, ps[a].rec.lat).k]); }
  for (const w of PL.wires) for (const o of [-0.8, 0, 0.8]) wires.push([top(w.a, o, W.height(w.a.lon, w.a.lat)), top(w.b, o, W.height(w.b.lon, w.b.lat)), w.sag * fl(w.a.lon, w.a.lat).k]);
  const byId = Object.fromEntries(L.furniture.map(x => [x.id, x]));
  for (const pl of L.poleLines) for (const [a, b] of pl.spans) { const A = byId[a], B = byId[b]; if (!A || !B || A.kind === 'legacy' || B.kind === 'legacy') continue; for (const o of [-0.5, 0, 0.5]) wires.push([[A.x + A.across[0] * o, L.LEVELS.pavement + 5.34, A.z + A.across[1] * o], [B.x + B.across[0] * o, L.LEVELS.pavement + 5.34, B.z + B.across[1] * o], 0.42]); }
  const wireRows = [];
  for (const q of lamps) { const m = window.STREETLIGHTS.MODELS[q.model], sc = q.scale, arm = [];       // the pole (every 0.25 m) and the arm with the head (every tenth of the reach)
    for (let h = 0; h <= m.poleH; h += 0.25) arm.push([q.x, q.y + h * sc, q.z]);
    for (let u = 0; u <= 1.0001; u += 0.1) arm.push([q.x + q.face[0] * m.reach * u * sc, q.y + (m.poleH + 0.2 + 0.06 * Math.sin(Math.PI * u) + 0.06 * u) * sc, q.z + q.face[1] * m.reach * u * sc]);
    let best = Infinity;
    for (const [A, B, sag] of wires) { if (Math.hypot(wx(A[0] - q.x), A[2] - q.z) > 60 && Math.hypot(wx(B[0] - q.x), B[2] - q.z) > 60) continue;
      for (let t = 0; t <= 1.0001; t += 0.02) { const x = A[0] + wx(B[0] - A[0]) * t, z = A[2] + (B[2] - A[2]) * t, y = A[1] + (B[1] - A[1]) * t - sag * 4 * t * (1 - t); for (const p of arm) { const d = Math.hypot(wx(x - p[0]), y - p[1], z - p[2]) / q.k; if (d < best) best = d; } } }
    wireRows.push({ id: q.id, owner: q.owner, d: best }); }
  // plot entrances within 12 m of a lamp (town lamps of the table, the alley lamps of layout.js)
  let entrance = 0; const lit = [...lamps.filter(q => q.owner === 'town').map(q => q.townXZ), ...L.furniture.filter(x => x.kind === 'alley-lamp').map(x => [x.x, x.z])];
  for (const p of L.plots) for (const e of p.entrances) entrance = Math.max(entrance, Math.min(...lit.map(([x, z]) => Math.hypot(x - e.x, z - e.z))));
  return { out, wireRows, wires: wires.length, entrance, counts: { furniture: furn.length, w4: w4.length, cover: trees.length, cells: (COV.cells || []).length } };
}, { lamps: T.lamps });
check('SL3', '净空：杆基在完整断面外 + 0.5 m，不入田块、田埂、树干、设施、地标场地，灯臂离电线 ≥ 0.3 m；冻结数据不变；城镇入口 ≤ 12 m', ({ info, fail }) => {
  for (const o of C3.out) if (o.hits.length) fail(`${o.id}：${o.hits.slice(0, 4).join('；')}`);
  for (const o of C3.out.filter(q => q.soft.length)) info(`${o.id}（W4 冻结灯位，C01-S 修复后的原位）邻近：${o.soft.join('；')}`);
  info(`非城镇灯 ${C3.out.length} 盏逐一核对：道路全断面（${'按实际路面网格的 footprint'}）、桥面、田块 ${C3.counts.cells} 块、树木与大件 ${C3.counts.cover} 件、道路设施 ${C3.counts.furniture} 件、W4 物件 ${C3.counts.w4} 件、地标场地 → 冲突 ${C3.out.filter(o => o.hits.length).length}`);
  // a lamp placed or moved here keeps 0.3 m (CLEAR.wire); a town lamp is where layout.js put it, under the town's lines: it must not touch them (0.1 m with the radii)
  const wNew = C3.wireRows.filter(r => r.owner !== 'town'), wTown = C3.wireRows.filter(r => r.owner === 'town'), mn = rows => rows.reduce((a, b) => (b.d < a.d ? b : a), { d: Infinity });
  for (const r of wNew.filter(q => q.d < 0.3)) fail(`${r.id} 灯杆/灯臂离电线 ${f(r.d)} m < 0.3 m`); for (const r of wTown.filter(q => q.d < 0.1)) fail(`${r.id} 碰到城镇电线（${f(r.d)} m）`);
  info(`电线 ${C3.wires} 段（RD03 杆线、W4 入口杆线、城镇杆线）：非城镇灯最近 ${f(mn(wNew).d)} m（${mn(wNew).id}，限 0.3 m）；城镇灯（layout 原位）最近 ${f(mn(wTown).d)} m（${mn(wTown).id}，不接触：限 0.1 m；与此前同一几何）`);
  if (frozenDiff.length) fail(`冻结文件与 ${BASE_REF} 不同：${frozenDiff.join('、')}`); info(`layout.js、world.js 与 ${BASE_REF} 逐字节相同：${!frozenDiff.length}（街道中线、宽度、地块、建筑、标线、水洼与设施位置均来自这两份数据）`);
  if (C3.entrance > 12) fail(`地块入口到最近路灯 ${f(C3.entrance, 1)} m > 12 m`); info(`38 个地块入口到最近路灯（灯表城镇灯 + layout 巷灯）最远 ${f(C3.entrance, 1)} m（限 12 m）`);
  const w4 = T.lamps.filter(q => q.owner === 'w4'); info(`W4 入口灯 ${w4.length} 盏原位（${w4.map(q => `${q.id} 朝向 ${q.line}`).join('、')}）；C01-S 专项另跑 tools/c01_s_clearance.mjs`);
});

// ---------------------------------------------------------------- SL4
const C4 = await page.evaluate(() => {
  const S = window.__scene, THREE = window.THREE, SL = S.streetlights, Dt = SL.data(), B = S.bend, R = 90, M = window.STREETLIGHTS.MODELS;
  const stray = [], lights = []; S.scene.traverse(o => { if (o.isPointLight) { let p = o, path = []; while (p) { if (p.name) path.push(p.name); p = p.parent; } lights.push(path.reverse().join('/')); }
    if ((o.isMesh || o.isInstancedMesh) && /^(road:lamp(Pool)?|sec:lamp)(:|$)/.test(o.name)) stray.push(o.name); if (o.name === 'streetLamp') stray.push('group streetLamp'); });
  const roots = new Set(); S.scene.traverse(o => { if (o.isInstancedMesh && /^streetlights:/.test(o.name)) roots.add(o.parent && o.parent.name); });
  const geo = SL.objects.bodies.map(m => { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox, key = m.name.split(':')[1]; return { key, minY: b.min.y, maxY: b.max.y, maxZ: b.max.z, poleH: M[key].poleH, reach: M[key].reach }; });
  // per instance: position, scale (1 / cos lat), heading, the ground below the foot (a ray against the drawn surfaces) and the pole on the sphere
  const mats = [], q4 = new THREE.Quaternion(), p4 = new THREE.Vector3(), s4 = new THREE.Vector3(), m4 = new THREE.Matrix4();
  SL.state.slots.forEach((sl, j) => sl.lamps.forEach((li, n) => { m4.fromArray(SL.objects.bodies[j].instanceMatrix.array, n * 16); m4.decompose(p4, q4, s4); const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q4); mats[li] = { p: p4.toArray(), s: s4.toArray(), face: [z.x, z.z], up: new THREE.Vector3(0, 1, 0).applyQuaternion(q4).y }; }));
  const surfaces = []; const keep = o => o.isMesh && !o.isInstancedMesh && o.visible !== false && !(o.material && o.material.transparent);
  S.scene.traverse(o => { if (!keep(o)) return; let p = o; while (p && !['terrain', 'roads', 'section', 'landcover'].includes(p.name) && p.parent) p = p.parent; if (p && ['terrain', 'roads', 'section', 'landcover'].includes(p.name)) surfaces.push(o); });
  for (const r of S.town.roots) r.traverse(o => { if (keep(o)) surfaces.push(o); });
  const ray = new THREE.Raycaster(), rows = [];
  Dt.lamps.forEach((q, i) => {
    const m = M[q.model], k = q.scale, mt = mats[i];
    let hit = null; for (const sx of [0, B.PERIOD, -B.PERIOD]) { ray.set(new THREE.Vector3(q.x + sx, q.y + 3, q.z), new THREE.Vector3(0, -1, 0)); ray.far = 6; const h = ray.intersectObjects(surfaces, false)[0]; if (h && (!hit || h.distance < hit.distance)) hit = h; }   // a deck laid out one circumference east
    const F = B.point(q.x, q.y, q.z, 1), topFlat = new THREE.Vector3(0, m.poleH, 0).applyMatrix4(m4.compose(new THREE.Vector3(...mt.p), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), q.yaw), new THREE.Vector3(k, k, k))), Tb = B.point(topFlat.x, topFlat.y, topFlat.z, 1);
    const ax = [Tb[0] - F[0], Tb[1] - F[1], Tb[2] - F[2]], al = Math.hypot(...ax), rad = [F[0], F[1] + R, F[2]], rl = Math.hypot(...rad), ang = Math.acos(Math.min(1, (ax[0] * rad[0] + ax[1] * rad[1] + ax[2] * rad[2]) / al / rl)) * 180 / Math.PI;
    const W0 = window.WORLD, hs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => { const p = W0.destination({ lon: q.lon, lat: q.lat }, Math.atan2(a, b) * 180 / Math.PI, 1); return W0.height(p.lon, p.lat); }), slope = Math.hypot((hs[0] - hs[1]) / 2, (hs[2] - hs[3]) / 2);
    rows.push({ id: q.id, model: q.model, owner: q.owner, slope, want: m.poleH * q.scale / q.k, dp: Math.hypot(mt.p[0] - q.x, mt.p[1] - q.y, mt.p[2] - q.z), ds: Math.max(...mt.s.map(v => Math.abs(v - k))), face: mt.face[0] * q.face[0] + mt.face[1] * q.face[1], up: mt.up,
      ground: hit ? q.y - hit.point.y : null, groundOn: hit ? hit.object.name || hit.object.parent && hit.object.parent.name : null, radial: ang, trueH: al, lat: q.lat });
  });
  // heading towards the road: a town lamp faces its street axis; every other lamp the nearest point of its own line
  const RD = S.roads.data(), fl = (lon, lat) => ({ x: R * lon * Math.PI / 180, z: -R * Math.asinh(Math.tan(lat * Math.PI / 180)) }), lines = Object.fromEntries([...RD.routes.map(r => [r.def.id, r.samples]), ...RD.bridges.map(b => [b.def.id, b.samples])]);
  const toward = Dt.lamps.map(q => { if (q.owner === 'town') { const rd = window.LAYOUT.roads.map(r => ({ r, d: Math.abs((r.axis === 'x' ? q.townXZ[1] : q.townXZ[0]) - r.at) })).sort((a, b) => a.d - b.d)[0].r, want = rd.axis === 'x' ? [0, Math.sign(rd.at - q.townXZ[1])] : [Math.sign(rd.at - q.townXZ[0]), 0]; return want[0] * q.face[0] + want[1] * q.face[1]; }
    const Sm = lines[q.line]; let best = null; for (const p of Sm) { const g = fl(p.lon, p.lat), d = Math.hypot(g.x - q.x, g.z - q.z); if (!best || d < best.d) best = { d, g }; } const v = [best.g.x - q.x, best.g.z - q.z], l = Math.hypot(...v) || 1; return (v[0] * q.face[0] + v[1] * q.face[1]) / l; });
  return { stray, lights, roots: [...roots], geo, rows, toward, surfaces: surfaces.length };
});
check('SL4', '一套模型：页面只有 streetlights 一套普通道路灯；尺寸、朝向、实例位置与缩放正确；杆脚贴实际地面/桥面；球形下灯杆沿当地径向', ({ info, fail }) => {
  if (C4.stray.length) fail(`仍有旧路灯网格：${C4.stray.join('、')}`); if (C4.roots.length !== 1 || C4.roots[0] !== 'streetlights') fail(`路灯实例不止一个装配根：${C4.roots.join('、')}`);
  info(`旧路径 road:lamp / road:lampPool / sec:lamp / streetLamp 网格 0；普通道路灯实例全部在 ${C4.roots.join('、')} 下（${C4.geo.length} 个型号各一套 灯体+墨线+灯头）；点光源 ${C4.lights.length} 个：${C4.lights.join('、') || '—'}（建筑自身光源，旧样板灯的点光源已去掉）`);
  for (const g of C4.geo) { if (Math.abs(g.minY) > 1e-6 || g.maxY < g.poleH + 0.2 || g.maxY > g.poleH + 0.4 || Math.abs(g.maxZ - g.reach) > 0.35) fail(`${g.key} 包围盒 y ${f(g.minY)}…${f(g.maxY)}，z ≤ ${f(g.maxZ)}`); }
  info(`型号尺寸（本地米制，原点在杆脚）：${C4.geo.map(g => `${g.key} 杆高 ${g.poleH} m、包围盒高 ${f(g.maxY, 3)} m、臂长 ${g.reach} m、灯头外沿 ${f(g.maxZ, 3)} m`).join('；')}`);
  report.models = C4.geo;
  const bad = C4.rows.filter(r => r.dp > 1e-3 || r.ds > 1e-5 || r.face < 0.9999 || Math.abs(r.up - 1) > 1e-6); for (const r of bad.slice(0, 5)) fail(`${r.id} 实例与灯表不符：位置差 ${f(r.dp, 4)}，缩放差 ${f(r.ds, 6)}，朝向点积 ${f(r.face, 5)}`);
  const away = C4.toward.map((v, i) => [C4.rows[i].id, v]).filter(([, v]) => v < 0.9); for (const [id, v] of away.slice(0, 5)) fail(`${id} 灯臂没有朝向车道（点积 ${f(v, 3)}）`);
  info(`实例与灯表：位置差最大 ${f(Math.max(...C4.rows.map(r => r.dp)), 6)}，缩放（城外灯 1/cos 纬度，城镇灯 1）差最大 ${f(Math.max(...C4.rows.map(r => r.ds)), 8)}；灯臂朝向车道点积最小 ${f(Math.min(...C4.toward), 3)}`);
  const noGround = C4.rows.filter(r => r.ground === null), off = C4.rows.filter(r => r.ground !== null && (r.ground > 0.005 || r.ground < -0.15));
  for (const r of noGround) fail(`${r.id} 杆脚下方 3 m 内没有地面`); for (const r of off.slice(0, 8)) fail(`${r.id} 杆脚离地面 ${f(r.ground, 3)} m（${r.groundOn}）`);
  const g = C4.rows.filter(r => r.ground !== null).map(r => r.ground);
  info(`杆脚对实际绘制地面（地形、道路条带、桥面、城镇铺装，竖直射线 ${C4.surfaces} 个网格）：高差 ${f(Math.min(...g), 3)}…${f(Math.max(...g), 3)} m（灯座下沉 0.08 m，坡地取高处；城镇灯立在设施带上为 0）；桥上 ${C4.rows.filter(r => r.owner === 'bridge').length} 盏 ${f(Math.min(...C4.rows.filter(r => r.owner === 'bridge').map(r => r.ground)), 3)}…${f(Math.max(...C4.rows.filter(r => r.owner === 'bridge').map(r => r.ground)), 3)} m`);
  const steep = C4.rows.filter(r => r.owner !== 'town' && r.owner !== 'bridge').reduce((a, b) => (b.slope > a.slope ? b : a));
  info(`坡地：城外路侧灯脚下地形坡度最大 ${f(steep.slope * 100, 1)}%（${steep.id}，杆脚高差 ${f(steep.ground, 3)} m）`);
  const rad = Math.max(...C4.rows.map(r => r.radial)); if (rad > 0.5) fail(`球形灯杆偏离径向 ${f(rad, 3)}°`);
  const tH = C4.rows.map(r => r.trueH / r.want); if (tH.some(v => Math.abs(v - 1) > 0.01)) fail(`球形灯杆高度偏差 ${f(Math.min(...tH), 4)}…${f(Math.max(...tH), 4)}`);
  const townH = C4.rows.filter(r => r.owner === 'town').map(r => r.trueH);
  const hi = C4.rows.reduce((a, b) => (Math.abs(b.lat) > Math.abs(a.lat) ? b : a));
  info(`球形（uBend = 1，bend.js 的 CPU 镜像）：灯杆与当地径向夹角最大 ${f(rad, 5)}°，高度 / 应有 ${f(Math.min(...tH), 5)}…${f(Math.max(...tH), 5)}（城外灯为真高；城镇灯随城镇框架 × cos 纬度：${f(Math.min(...townH), 2)}–${f(Math.max(...townH), 2)} m）；最高纬度 ${hi.id} ${f(hi.lat, 1)}°（平面缩放 ${f(1 / Math.cos(hi.lat * D), 3)}）`);
  report.instances = C4.rows;
});

// ---------------------------------------------------------------- SL5
const C5 = await page.evaluate(() => {
  const S = window.__scene, SL = S.streetlights, THREE = window.THREE, T = S.transition, n = SL.data().lamps.length;
  const snap = () => ({ win: Array.from(SL.state.win), pool: SL.objects.materials.win.value.map(v => [v.x, v.y]), body: SL.state.slots.map(sl => Array.from(sl.body.array)), lens: SL.state.slots.map(sl => Array.from(sl.lens.array)) });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  T.setMode('flat'); T.step(3); S.weather.lock('rain');
  const A = { target: [-7, 1.2, 20], dist: 34, yaw: 2.5, pitch: 0.5 }, B2 = { target: [-30, 1.2, 54], dist: 60, yaw: 1.2, pitch: 0.8 };
  S.view.set(A); window.__step(3); const a1 = snap(); S.view.set(B2); window.__step(3); const b1 = snap(); S.view.set(A); window.__step(3); const a2 = snap();
  // the window from the camera alone: a probe camera at the distance where the chosen lamp is 0.8, 1.5 and 2.5 px tall (canvas height of the page)
  const q = SL.data().lamps.find(x => x.line === 'CR01'), i = SL.data().lamps.indexOf(q), m = window.STREETLIGHTS.MODELS[q.model], Hpx = S.renderer.domElement.height, ppm = Hpx / (2 * Math.tan(S.camera.fov * Math.PI / 360));
  const probe = S.camera.clone(), rows = [];
  for (const px of [0.8, 1.5, 2.5]) { const d = m.poleH * q.scale * ppm / px, mid = [q.x, q.y + m.poleH / 2 * q.scale, q.z]; probe.position.set(mid[0], mid[1] + d, mid[2]); probe.updateMatrixWorld(); SL.select(probe);
    const sl = SL.state.slots.find(s => s.lamps.includes(i)), j = sl.lamps.indexOf(i); rows.push({ px, measured: SL.state.px[i], win: SL.state.win[i * 2 + 1], body: sl.body.array[j * 2 + 1], lens: sl.lens.array[j * 2 + 1], pool: SL.objects.materials.win.value[i].y }); }
  SL.select(S.camera);
  // flat night: lamps on, the lens self-lit, the pools drawn; the sphere: no pool, and the frame does not change when the lenses' emission is black
  const night = { pool: SL.objects.pool.visible, emissive: SL.objects.materials.lens.emissive.getHexString(), bodies: SL.state.slots.filter(s => s.visible).length };
  T.setMode('sphere'); T.step(3); S.weather.lock('clear'); const c = SL.data().lamps.find(x => x.line === 'CR01'); S.view.set({ target: [c.x, 1.2, c.z], dist: 20, yaw: 0.4, pitch: 0.7 }); window.__step(4);
  const shot = () => { S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL(); };
  const lensMat = SL.objects.materials.lens, e0 = lensMat.emissive.clone(), s1 = shot(); lensMat.emissive.setRGB(0, 0, 0); const s2 = shot(); lensMat.emissive.copy(e0);
  const sphere = { pool: SL.objects.pool.visible, emissionFree: s1 === s2, u: S.bend.get(), bodies: SL.state.slots.filter(s => s.visible).length };
  // the switch: half way, one set of lamps (the same instances, no other lamp meshes)
  T.setMode('flat'); T.step(3); T.animating = false; S.bend.set(0.5); window.__step(2); let lampMeshes = 0; S.scene.traverse(o => { if (o.isInstancedMesh && /lamp/i.test(o.name) && !/lampSmall/.test(o.name)) lampMeshes++; });
  const half = { counts: SL.objects.bodies.reduce((s, b) => s + b.count, 0), others: lampMeshes, pool: SL.objects.pool.visible };
  S.bend.set(0); T.step(3); window.__step(2);
  return { stable: same(a1, a2), moved: !same(a1, b1), rows, night, sphere, half, n };
});
check('SL5', '显示：同一相机结果一致；1–2 px 两端与中间灯体、灯头、光池同一窗口；平面夜间发光，球形无光池且自发光贡献为 0；切换中无重复灯', ({ info, fail }) => {
  if (!C5.stable) fail('同一相机两次到访的显示窗口不同'); info(`默认机位 → CR01 → 默认机位：窗口逐值相同 ${C5.stable}（中间机位不同：${C5.moved}）`);
  for (const r of C5.rows) { const want = Math.max(0, Math.min(1, (r.px - 1) / 1)); if (Math.abs(r.measured - r.px) > 0.02 || Math.abs(r.win - want) > 0.02 || r.body !== r.win || r.lens !== r.win || Math.abs(r.pool - r.win) > 1e-6) fail(`${r.px} px：实测 ${f(r.measured, 3)} px，窗口 ${f(r.win, 3)}（应 ${f(want, 3)}），灯体 ${f(r.body, 3)} 灯头 ${f(r.lens, 3)} 光池 ${f(r.pool, 3)}`); }
  info(`像素规则（投影杆高，${C5.rows.map(r => `${r.px} px → 窗口 ${f(r.win, 2)}，灯体/灯头/光池 ${f(r.body, 2)}/${f(r.lens, 2)}/${f(r.pool, 2)}`).join('；')}）：低于 1 px 不画，高于 2 px 完整，之间 8 × 8 抖动交接；光池随灯同窗口，无孤立光池`);
  if (!C5.night.pool || C5.night.emissive !== 'ffd9a0' || !C5.night.bodies) fail('平面夜间灯头不发光或光池未绘制');
  if (C5.sphere.pool || !C5.sphere.emissionFree || C5.sphere.u !== 1) fail(`球形：光池 ${C5.sphere.pool}，灯头自发光置黑前后画面相同 ${C5.sphere.emissionFree}`);
  info(`平面夜间：灯头自发光 #${C5.night.emissive}、光池绘制 ${C5.night.pool}；球形白天（uBend = ${C5.sphere.u}）：光池不画 ${!C5.sphere.pool}，灯头自发光置黑前后画面逐字节相同 ${C5.sphere.emissionFree}，灯杆仍按像素规则显示（${C5.sphere.bodies} 个型号可见）`);
  if (C5.half.counts !== C5.n || C5.half.others) fail(`切换中实例 ${C5.half.counts}/${C5.n}，其他灯网格 ${C5.half.others}`); info(`切换到 uBend = 0.5：实例 ${C5.half.counts} = 灯表 ${C5.n}，其他普通路灯网格 ${C5.half.others}`);
  report.display = C5;
});

// ---------------------------------------------------------------- SL6
const C6 = await page.evaluate(() => {
  const S = window.__scene, SL = S.streetlights, T = S.transition, cap = () => JSON.stringify({ inst: SL.objects.bodies.map(m => [m.count, m.instanceMatrix.array.length, m.geometry.attributes.aWin.array.length]), pool: SL.objects.pool.geometry.attributes.position.count, win: SL.objects.materials.win.value.length, rip: S.roads.state.ripples.spots.length });
  const before = cap(), wg = S.worldgen.stats();
  T.setMode('flat'); T.step(3);
  for (let i = 0; i < 40; i++) { S.view.set({ target: [-60 + i * 4, 1.2, 50 - i * 2], dist: 9 + i * 9, yaw: i * 0.3, pitch: 0.3 + (i % 5) * 0.2 }); window.__step(1); }
  T.setMode('sphere'); T.step(3); for (let i = 0; i < 10; i++) { S.view.set({ dist: 40 + i * 36 }); window.__step(1); } T.setMode('flat'); T.step(3); window.__step(2);
  return { before, after: cap(), done: wg.done, doneAt: wg.doneAt, firstFrameAt: wg.firstFrameAt, buildMs: SL.stats().buildMs, step: wg.steps.find(s => s.name === 'streetlights') };
});
check('SL6', '页面：无新增错误；首帧即完整世界；连续平移/缩放/切换后实例容量不增长', ({ info, fail }) => {
  if (errors.length) fail(`页面错误：${errors.slice(0, 3).join(' | ')}`);
  if (!C6.done || !(C6.firstFrameAt >= C6.doneAt)) fail('首帧早于世界生成完成');
  if (C6.before !== C6.after) fail(`容量变化：${C6.before} → ${C6.after}`);
  info(`页面错误 ${errors.length}；世界生成完成后才出首帧 ${C6.firstFrameAt >= C6.doneAt}；路灯步骤 ${C6.step.ms} ms（最长一步 ${C6.step.longestMs} ms）；40 次平面机位 + 10 次球形缩放与往返后容量不变 ${C6.before === C6.after}`);
});

await browser.close();
report.results = results;
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
console.log(`→ docs/world/w10c/streetlights/report.json`);
const bad = results.filter(r => !r.ok);
console.log(bad.length ? `FAIL streetlight_check：${bad.map(r => r.id).join('、')}` : 'PASS streetlight_check');
process.exitCode = bad.length ? 1 : 0;
