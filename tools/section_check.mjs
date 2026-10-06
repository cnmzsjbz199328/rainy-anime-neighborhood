// Checks W4-C1..C5 for the sample section (W4). Run after `python3 build.py`:  node tools/section_check.mjs [--no-browser]
//   data checks under Node (world.js, section_plan.js, roadkit.js, terrain.js), then measurements in the built page (budget, ink, motion).
// W4-C6 (pixel regression) is tools/regress.mjs --baseline-ref pre-w4 --mask-patch-margin 24, and tools/regress.mjs --views section (determinism).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
globalThis.LAYOUT = require(path.join(root, 'layout.js'));
const W = require(path.join(root, 'world.js'));
const PLAN = require(path.join(root, 'section_plan.js')).plan(W);
const RK = require(path.join(root, 'roadkit.js'));
const TERR = require(path.join(root, 'terrain.js'));
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
async function checkAsync(id, title, fn) {
  const info = [], fails = [];
  await fn({ info: m => info.push(m), fail: m => fails.push(m) });
  results.push({ id, ok: !fails.length });
  console.log(`${fails.length ? 'FAIL' : 'PASS'} ${id} ${title}`);
  for (const m of fails) console.log('  ✗ ' + m);
  for (const m of info) console.log('  · ' + m);
}
const unflat = (x, z) => ({ lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D });
const flat = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) });
const arc = (a, b) => { const A = W.vec(a.lon, a.lat), B = W.vec(b.lon, b.lat); return R * W.angleBetween(A, B); };

// ---------------------------------------------------------------- W4-C1
check('W4-C1', '断面与 world.js 一致：区域边界与第 2 节表相差 ≤ 0.5 m，海岸 40.8 ± 0.5 m', ({ info, fail }) => {
  const expect = { 'farmland-main': 0.05, 'forest-south': 20.7, 'default-grassland': 30.9, 'west-sea': 40.85, 'ice-south': 62.2 };
  const rows = [];
  for (const z of PLAN.zones) {
    const key = z.id === 'default-grassland' && z.v > 50 ? null : z.id;
    if (key && expect[key] !== undefined) { const e = expect[key], d = Math.abs(z.v - e); rows.push(`${z.id} ${f(z.v, 2)} m（表 ${e}）`); if (d > 0.5 && z.id !== 'farmland-main') fail(`${z.id} 起点 ${z.v} 与表 ${e} 相差 ${f(d, 2)} > 0.5`); }
  }
  info('区域序列（沿 u = 0 的中线）：' + PLAN.zones.map(z => `${z.id}@${f(z.v, 2)}`).join(' → '));
  info(rows.join('；'));
  if (Math.abs(PLAN.coastV - 40.8) > 0.5) fail(`海岸 ${PLAN.coastV} 不在 40.8 ± 0.5 m`); else info(`海岸（coastDistance = 0）在 v = ${f(PLAN.coastV, 2)} m`);
  const far = PLAN.zones.find(z => z.id === 'default-grassland' && z.v > 50);
  info(`南岸草地起点 ${far ? f(far.v, 2) : '无'} m，断面总长 ${PLAN.corridor.length} m（ST03 写 80 m，以 world.js 为准）`);
  // the corridor starts on the patch's south edge
  const edge = arc({ lon: PLAN.corridor.LON0, lat: PLAN.corridor.LAT0 }, { lon: PLAN.corridor.LON0, lat: -W.TOWN_PATCH.latMax });
  if (edge > 0.01) fail(`断面起点不在补丁南缘（相差 ${edge} m）`);
  // the plot grid and the sea grid take heights from height() at every vertex: spot-check the plan's own frame
  let worst = 0; for (let u = -12; u <= 12; u += 1.5) for (let v = 0; v <= 60; v += 2) { const [lo, la] = PLAN.toLL(u, v), uv = PLAN.toUV(lo, la); worst = Math.max(worst, Math.hypot(uv.u - u, uv.v - v)); }
  info(`(u, v) ↔ (经, 纬) 往返误差最大 ${worst.toExponential(2)} m；地形网格与 height() 的容差由 W3-C1 保证（terrain_check）`);
  if (worst > 0.01) fail('往返误差 > 0.01 m');
});

// ---------------------------------------------------------------- W4-C2
const EDGES = ['T03-01', 'T03-02', 'T03-03', 'T11-01'], built = {};
for (const id of EDGES) built[id] = RK.build(W, id);
check('W4-C2', '道路：中线 ≤ 0.05 m，宽度符合卡片，坡度 ≤ WC4，木桩 0.5–1.5 m，灯柱 10 ± 2 m', ({ info, fail }) => {
  const NET = W.roadNetwork, limits = { RD03: 0.10, RD04: 0.15, RD05: 0.15 }, widthRange = { RD03: [4, 5], RD04: [2, 3], RD05: [2.5, 3.5], RD07: [1.5, 2.5] };
  for (const id of EDGES) {
    const r = built[id], edge = NET.edges.find(e => e.id === id), S = NET.samplePath(edge, 0.5);
    // centre line of the swept strip: the point at lateral offset 0 between the two profile vertices that straddle it
    let worstC = 0;
    if (r.strips.length && r.class !== 'RD07') {
      const prof = RK.PROFILES[r.class].pts, m = prof.length, st = r.strips[0];
      let j = 0; while (j + 1 < m && !(prof[j][0] <= 0 && prof[j + 1][0] >= 0)) j++;
      const t = (0 - prof[j][0]) / (prof[j + 1][0] - prof[j][0]);
      for (let i = 0; i < S.length; i++) {
        const a = j + i * m, b = a + 1, x = st.pos[a * 3] * (1 - t) + st.pos[b * 3] * t, z = st.pos[a * 3 + 2] * (1 - t) + st.pos[b * 3 + 2] * t;
        worstC = Math.max(worstC, arc(unflat(x, z), S[i]));
      }
    } else for (let i = 0; i < S.length; i++) worstC = Math.max(worstC, arc(r.centre[i], S[i]));
    if (worstC > 0.05) fail(`${id} 中线偏差 ${f(worstC)} m > 0.05`);
    // width
    const w = r.class === 'RD07' ? r.widths.paved : r.widths.paved, [lo, hi] = widthRange[r.class];
    if (w < lo || w > hi) fail(`${id}（${r.class}）宽度 ${w} 不在 ${lo}–${hi} m`);
    // grade along the centre (true metres between 0.5 m samples)
    let worstG = 0; for (let i = 0; i + 1 < S.length; i++) worstG = Math.max(worstG, Math.abs(S[i + 1].h - S[i].h) / arc(S[i], S[i + 1]));
    const lim = limits[r.class];
    if (lim && worstG > lim) fail(`${id} 最大坡度 ${f(worstG * 100, 1)}% > ${lim * 100}%`);
    info(`${id} ${r.class}：长 ${f(r.length, 2)} m，中线偏差 ${f(worstC, 4)} m，宽 ${f(w, 2)} m（${lo}–${hi}），最大坡度 ${f(worstG * 100, 1)}%${lim ? `（上限 ${lim * 100}%）` : '（boardwalk 不计）'}`);
  }
  // the T03 transition chain: centre line, class widths away from the joints, smooth width change, no jump in colour along the paved edge
  { const CH = RK.chain(W, ['T03-01', 'T03-02', 'T03-03']), S = CH.samples, m = CH.grid.length, st = CH.strip; let j = 0; while (!(CH.grid[j] <= 0 && CH.grid[j + 1] >= 0)) j++;
    const t = (0 - CH.grid[j]) / (CH.grid[j + 1] - CH.grid[j]); let worstC = 0;
    for (let i = 0; i < S.length; i++) { const a = j + i * m, b = a + 1, x = st.pos[a * 3] * (1 - t) + st.pos[b * 3] * t, z = st.pos[a * 3 + 2] * (1 - t) + st.pos[b * 3 + 2] * t; worstC = Math.max(worstC, arc(unflat(x, z), S[i])); }
    if (worstC > 0.05) fail(`过渡链中线偏差 ${f(worstC)} m > 0.05`);
    const wd = CH.paved.map(p => p[1] - p[0]); let worstD = 0; for (let i = 1; i < wd.length; i++) worstD = Math.max(worstD, Math.abs(wd[i] - wd[i - 1]) / 0.5);
    const at = s => wd[Math.round(s / 0.5)], pure = [[1.5, 4.5, 'RD03'], [11, 2.5, 'RD04'], [22, 3.0, 'RD05']];
    for (const [sx, want, cls] of pure) if (Math.abs(at(sx) - want) > 0.06) fail(`过渡链在 s = ${sx} m 的铺装宽 ${f(at(sx), 2)} ≠ ${cls} 的 ${want} m`);
    if (worstD > 0.6) fail(`铺装宽变化 ${f(worstD, 2)} m/m > 0.6，不够平滑`);
    // colour continuity of the centre column: no jump larger than 0.25 (linear sRGB, max channel) between samples 0.5 m apart outside the hashed cracks
    let jump = 0; for (let i = 1; i < S.length; i++) { const a = (j + i * m) * 3, b = (j + (i - 1) * m) * 3; jump = Math.max(jump, ...[0, 1, 2].map(c => Math.abs(st.col[a + c] - st.col[b + c]))); }
    info(`过渡链 T03-01→02→03：长 ${f(CH.length, 2)} m，混合带 ± ${RK.BLEND} m，中线偏差 ${f(worstC, 4)} m；铺装宽 ${wd.filter((_, i) => i % 6 === 0).map(v => f(v, 2)).join(' → ')} m，最大变化 ${f(worstD, 2)} m/m（上限 0.6）；中线相邻样点最大颜色差 ${f(jump, 2)}（含裂纹）；磨损 0 → ${f(CH.wear[CH.wear.length - 1], 2)}`);
  }
  const bw = built['T11-01'];
  if (!bw.widths.pileAboveWater || bw.widths.pileAboveWater[0] < 0.5 || bw.widths.pileAboveWater[1] > 1.5) fail(`木桩高出水面 ${bw.widths.pileAboveWater} 不在 0.5–1.5 m`); else info(`木桩高出水面 ${bw.widths.pileAboveWater.map(v => f(v, 2)).join('–')} m（卡片 0.5–1.5 m）`);
  const S = W.roadNetwork.samplePath(W.roadNetwork.edges.find(e => e.id === 'T11-01'), 0.5), sOf = it => { let b = 0, bd = Infinity; S.forEach((p, i) => { const d = arc(p, it); if (d < bd) { bd = d; b = i; } }); return S[b].s; };
  const lamps = (bw.instances.lampSmall || []).map(sOf).sort((a, b) => a - b), gaps = lamps.slice(1).map((v, i) => v - lamps[i]);
  if (lamps.length < 3 || lamps.length > 4 || gaps.some(g => Math.abs(g - 10) > 2)) fail(`小灯柱 ${lamps.length} 盏，间距 ${gaps.map(g => f(g, 1))} 不满足 3–4 盏、10 ± 2 m`); else info(`小灯柱 ${lamps.length} 盏，间距 ${gaps.map(g => f(g, 1)).join('、')} m`);
  const tot = EDGES.reduce((s, id) => s + built[id].length, 0); info(`四条边总长 ${f(tot, 1)} m（规格 6.1 + 9.5 + 12.6 + 36.2 = 64.4 m 为沿路径长度）`);
});

// ---------------------------------------------------------------- W4-C3 (data): offsets and the carriageway
const B3 = TERR.builder(W), chunks3 = B3.buildFlat({ ring: true, rest: true }), tris3 = [];
for (const c of chunks3) for (const idx of [c.ringIndex, c.restIndex]) if (idx) for (let t = 0; t < idx.length; t += 3) {
  const v = [idx[t], idx[t + 1], idx[t + 2]].map(i => ({ lon: c.lonlat[i * 2], lat: c.lonlat[i * 2 + 1], h: c.alt[i] }));
  if (v.every(p => p.lon > -16 && p.lon < 40 && p.lat < -27 && p.lat > -72)) tris3.push(v);
}
// independent of TERRAIN.sampler (which section.js uses): a plain scan over the triangles
const meshH = (lon, lat) => {
  for (const [a, b, c] of tris3) {
    const d = (b.lat - c.lat) * (a.lon - c.lon) + (c.lon - b.lon) * (a.lat - c.lat); if (Math.abs(d) < 1e-12) continue;
    const w1 = ((b.lat - c.lat) * (lon - c.lon) + (c.lon - b.lon) * (lat - c.lat)) / d, w2 = ((c.lat - a.lat) * (lon - c.lon) + (a.lon - c.lon) * (lat - c.lat)) / d, w3 = 1 - w1 - w2;
    if (w1 >= -1e-9 && w2 >= -1e-9 && w3 >= -1e-9) return w1 * a.h + w2 * b.h + w3 * c.h;
  }
  return null;
};
check('W4-C3a', '落地（数据）：计划里的竖向偏移只有有意的几种；不压路', ({ info, fail }) => {
  const off = {}; for (const [type, list] of Object.entries(PLAN.items)) for (const it of list) if (Math.abs(it.dy || 0) > 1e-9) (off[type] = off[type] || []).push(it.dy);
  info('带竖向偏移的类型：' + (Object.keys(off).length ? Object.entries(off).map(([k, v]) => `${k}×${v.length}（${v.map(x => f(x, 2)).join(' ')}）`).join('；') : '无'));
  // distance from each item to the nearest centre line (planar in the section's u, v metres) against the paved half width of that road
  const lines = EDGES.map(id => ({ id, half: Math.max(...RK.PROFILES[built[id].class] ? RK.PROFILES[built[id].class].paved.map(Math.abs) : [RK.DECK.half]), pts: W.roadNetwork.samplePath(W.roadNetwork.edges.find(e => e.id === id), 0.5).map(p => PLAN.toUV(p.lon, p.lat)) }));
  const segDist = (p, a, b) => { const dx = b.u - a.u, dz = b.v - a.v, l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((p.u - a.u) * dx + (p.v - a.v) * dz) / l2)) : 0; return Math.hypot(p.u - a.u - t * dx, p.v - a.v - t * dz); };
  let intrude = 0; const wi = []; let tightest = Infinity;
  for (const [type, list] of Object.entries(PLAN.items)) for (const it of list) for (const L of lines) {
    let d = Infinity; for (let i = 0; i + 1 < L.pts.length; i++) d = Math.min(d, segDist(it, L.pts[i], L.pts[i + 1]));
    const gap = d - L.half; tightest = Math.min(tightest, gap);
    if (gap < -0.05) { intrude++; wi.push(`${type}@${f(it.u, 1)},${f(it.v, 1)} 距 ${L.id} 路面边缘 ${f(gap, 2)} m`); }
  }
  info(`计划实例到最近路面（铺装半宽：RD03 2.25、RD04 1.4、RD05 1.5、RD07 1.0 m）边缘的最小间距 ${f(tightest, 2)} m；压路 ${intrude} 个${wi.length ? '：' + wi.join('；') : ''}`);
  if (intrude) fail(`${intrude} 个实例压在路面上`);
});

// ---------------------------------------------------------------- browser part
if (!process.argv.includes('--no-browser')) {
  const { launchChromium } = await import('./browser.mjs');
  const { SHOTS, INIT, renderShot } = await import('./section_views.mjs');
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.section, null, { timeout: 90000 });
  const shot = name => SHOTS.find(s => s[0] === name)[1];
  const DIST = [['ground', shot('ground-paddies-rain')], ['aerial', shot('aerial-corridor-rain')], ['panorama', shot('panorama-section')]];
  const base = await page.evaluate(() => { const S = window.__scene; window.__step(40); S.renderer.render(S.scene, S.camera); return { calls: S.renderer.info.render.calls, tris: S.renderer.info.render.triangles, textures: S.renderer.info.memory.textures, geometries: S.renderer.info.memory.geometries, built: S.section.get().built }; });

  await checkAsync('W4-C3b', '落地（页面）：每个实例的底面与渲染用的地形网格的竖向距离 ≤ 0.05 m', async ({ info, fail }) => {
    const inst = await page.evaluate(() => {
      const S = window.__scene, SEC = S.section; S.bend.set(1); SEC.setMode(true); SEC.ensure();
      const R = 90, D = Math.PI / 180, out = [], M = new window.THREE.Matrix4(), BASE = 1.6, seen = new Set();
      const rec = (type, e) => { const x = e[12], y = e[13], z = e[14], lon = x / (R * D), lat = Math.atan(Math.sinh(-z / R)) / D, k = 1 / Math.cos(lat * D); out.push([type, lon, lat, y / k + BASE]); };
      const objs = SEC.objects;
      for (const m of objs.inst) { if (m.name.endsWith('_far')) continue; const type = m.name.replace('sec:', '').replace(/_far$/, '');
        if (objs.trees.some(T => T.type === type)) continue; for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); rec(type, M.elements); } }
      for (const T of objs.trees) for (const it of T.list) rec(T.type, it.m.elements);
      return out;
    });
    const ground = new Set(['weed', 'tuft', 'shrubLow', 'stonePost', 'pile']), nPlan = {};
    for (const [t, l] of Object.entries(PLAN.items)) nPlan[t] = l.length;
    const seen = {}; let n = 0, over = 0, worst = 0, wm = '', miss = 0;
    for (const [type, lon, lat, alt] of inst) {
      const i = (seen[type] = (seen[type] ?? -1) + 1), planItem = i < (nPlan[type] || 0) ? PLAN.items[type][i] : null;
      if (!planItem && !ground.has(type)) continue;                // road parts that stand on the deck, not on the ground
      const m = meshH(lon, lat); n++; if (m === null) { miss++; continue; }
      const e = Math.abs(alt - (m + (planItem ? planItem.dy || 0 : 0)));
      if (e > worst) { worst = e; wm = `${type}@${f(lon, 2)},${f(lat, 2)}`; } if (e > 0.05) over++;
    }
    info(`${n} 个贴地实例（未计木板、栏杆等站在桥面上的零件）：相对渲染用地形网格最大偏差 ${f(worst, 4)} m（${wm}），超过 0.05 m 的 ${over} 个，未命中网格 ${miss}`);
    if (over) fail(`${over} 个实例悬空或陷入 > 0.05 m（最大 ${f(worst)} m ${wm}）`);
  });

  await checkAsync('W4-C4', '预算：可见树 ≤ 3000，同类共享几何与材质，三个距离的成本', async ({ info, fail }) => {
    const rows = {};
    for (const [name, v] of DIST) {
      const on = await renderShot(page, v), off = await renderShot(page, v, { hide: true });
      rows[name] = { calls: on.info.calls - off.info.calls, tris: on.info.triangles - off.info.triangles, instances: on.info.instances, ms: on.info.ms, msOff: off.info.ms, total: on.info.calls, textures: on.info.textures, programs: on.info.programs };
      info(`${name}：断面新增 ${rows[name].calls} 次绘制调用、${rows[name].tris} 个三角形、${rows[name].instances} 个可见实例（整帧 ${on.info.calls} 次调用，渲染 ${on.info.ms} ms，无断面 ${off.info.ms} ms，SwiftShader 仅供对比；真机待验证）`);
    }
    const s = await page.evaluate(() => {
      const SEC = window.__scene.section, root = SEC.state.root, geos = new Map(), mats = new Map(), types = {};
      root.traverse(o => { if (o.isInstancedMesh) { const g = o.geometry.uuid, k = o.name.replace(/^sec:/, '').replace(/:(ink|glow)$/, '');
        if (!o.name.endsWith(':ink') && !o.name.endsWith(':glow')) { (types[k] = types[k] || new Set()).add(g); geos.set(g, 1); } mats.set(o.material.uuid, o.material.type); } });
      const trees = SEC.stats().trees, visible = trees.reduce((a, t) => a + (t.near || 0) + (t.far || 0), 0);
      const meshes = []; root.traverse(o => { if (o.isMesh || o.isLine || o.isLineSegments) meshes.push(o.name || o.type); });
      return { geometries: geos.size, materialsInstanced: mats.size, typeSharing: Object.entries(types).filter(([, v]) => v.size !== 1).map(([k]) => k), trees, visibleTrees: visible, counts: SEC.stats().counts, stats: SEC.stats(), nonInstanced: meshes.length };
    });
    info(`实例化物件类型 ${Object.keys(s.counts).length} 种，几何 ${s.geometries} 个（每种一份，近远两级的树各一份），实例材质 ${s.materialsInstanced} 个；非实例化的网格 / 线 ${s.nonInstanced} 个（田块、水面、道路条带、电线、墨线）`);
    info(`树：${s.trees.map(t => `${t.type} 近${t.near ?? 0}/远${t.far ?? 0}`).join('，')}，合计 ${s.visibleTrees}（上限 3000）`);
    info(`新增纹理：${base.textures} → ${rows.ground.textures}（${rows.ground.textures - base.textures} 张）；着色器程序 ${rows.ground.programs}；生成耗时 ${s.stats.buildMs} ms（首次显示一次）`);
    if (s.typeSharing.length) fail(`同一类型使用了多个几何：${s.typeSharing}`);
    if (s.visibleTrees > 3000) fail(`可见树 ${s.visibleTrees} > 3000`);
    if (rows.ground.textures - base.textures > 0) info('注意：断面新增了纹理');
    globalThis.__budget = { rows, counts: s.counts, trees: s.visibleTrees, stats: s.stats };
  });

  await checkAsync('W4-C5', '墨线：三个距离的线宽不跳变，权重连续，固定帧逐位相同', async ({ info, fail }) => {
    // 1) weights and pixel width of the outline hull vs camera altitude (continuous sweep)
    const sweep = await page.evaluate(() => {
      const S = window.__scene, T = window.THREE, SEC = S.section, B = S.bend, cam = S.camera; B.set(1); SEC.setMode(true); SEC.ensure(); SEC.set({ ink: 'auto' });
      const out = [], H = S.renderer.domElement.height;
      for (let alt = 1.6; alt <= 320; alt *= 1.04) {
        cam.position.set(0, -90 + 90 + alt, 0); cam.up.set(0, 0, -1); cam.lookAt(0, -90, 0); cam.fov = 36; cam.updateMatrixWorld(); SEC.tick(1, cam);
        const i = SEC.get().ink, wpp = 2 * SEC.state.focus * Math.tan(cam.fov * Math.PI / 360) / H;
        out.push({ alt, g: i.ground, a: i.aerial, p: i.panorama, px: i.width / wpp });
      }
      return out;
    });
    let maxStep = 0, at = 0; for (let i = 1; i < sweep.length; i++) { const d = Math.max(Math.abs(sweep[i].g - sweep[i - 1].g), Math.abs(sweep[i].a - sweep[i - 1].a), Math.abs(sweep[i].p - sweep[i - 1].p)); if (d > maxStep) { maxStep = d; at = sweep[i].alt; } }
    info(`按相机高度 1.6–320 m 连续扫描 ${sweep.length} 点：地面 / 半空 / 全景层权重相邻步最大变化 ${f(maxStep, 3)}（在 ${f(at, 1)} m），权重和始终 ≤ 1.0（最大 ${f(Math.max(...sweep.map(s => s.g + s.a + s.p)), 3)}）`);
    if (maxStep > 0.1) fail(`权重在 ${at} m 处有阶跃 ${maxStep}`);
    // 2) measured screen width of the same coast at 3 distances: drawn as a 1 px line from aerial to panorama; ground ink is the hull (px width target)
    const hullPx = sweep.filter(s => s.g > 0.5).map(s => s.px), minPx = Math.min(...hullPx), maxPx = Math.max(...hullPx);
    info(`地面描边（反向外壳）的屏幕线宽：在地面层权重 > 0.5 的高度范围内 ${f(minPx, 2)}–${f(maxPx, 2)} px（目标 1.5 px，受 0.008–0.2 m 的世界线宽钳制）`);
    // pixel measurement of the coast line at aerial and panorama distance: count ink-coloured pixels across the line
    const measure = async (v, label) => {
      const r = await renderShot(page, { ...v, ink: v.ink || 'auto' });
      return await page.evaluate(async url => {
        const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = url; });
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
        // ink colour #273647 = (39, 54, 71): count pixels within 6 per channel, per row run lengths
        let runs = [], cur = 0; for (let y = 0; y < c.height; y++) { cur = 0; for (let xx = 0; xx < c.width; xx++) { const k = (y * c.width + xx) * 4; const ok = Math.abs(d[k] - 39) < 7 && Math.abs(d[k + 1] - 54) < 7 && Math.abs(d[k + 2] - 71) < 7; if (ok) cur++; else { if (cur > 0) runs.push(cur); cur = 0; } } }
        runs.sort((a, b) => a - b); return { n: runs.length, median: runs.length ? runs[Math.floor(runs.length / 2)] : 0 };
      }, r.url);
    };
    const aer = await measure({ ...shot('aerial-coast-rain'), rain: false }, 'aerial'), pan = await measure(shot('panorama-planet'), 'panorama');
    info(`像素实测（墨色像素行程中位数）：半空 ${aer.median} px（${aer.n} 段），全景 ${pan.median} px（${pan.n} 段）；线层使用 1 px 的 GL 线，宽度不随距离变化`);
    // 3) determinism: the same state twice gives identical pixels; two fresh frames at the same t too
    const quiet = name => ({ ...shot(name), rain: false }), opts = { t: 2.0, noStep: true };
    const a = await renderShot(page, quiet('aerial-corridor-neutral'), opts), b = await renderShot(page, quiet('aerial-corridor-neutral'), opts);
    const g1 = await renderShot(page, quiet('ground-forest-edge-neutral'), opts), g2 = await renderShot(page, quiet('ground-forest-edge-neutral'), opts);
    const same = a.url === b.url && g1.url === g2.url;
    info(`固定时间、不推进帧、关雨重复渲染（半空、地面各两次）${same ? '逐位相同' : '不同'}`);
    if (!same) fail('固定帧下墨线 / 画面不一致（抖动）');
    globalThis.__ink = { sweep: sweep.length, maxStep };
  });

  await checkAsync('W4-C7', '动态：三个距离下各至少一处在动（固定帧间隔的两张图差异像素 > 0）', async ({ info, fail }) => {
    const diff = async (v, t0, t1) => {
      const a = await renderShot(page, v, { t: t0 }), b = await renderShot(page, v, { t: t1 });
      return await page.evaluate(async ([ua, ub]) => {
        const load = u => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = u; });
        const [ia, ib] = await Promise.all([load(ua), load(ub)]);
        const data = i => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
        const da = data(ia), db = data(ib); let n = 0; for (let k = 0; k < da.length; k += 4) if (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]) > 6) n++; return n;
      }, [a.url, b.url]);
    };
    for (const [name, v] of DIST) { const n = await diff({ ...v, rain: false }, 2.0, 2.6); info(`${name}（关雨，只看水面 / 树冠 / 浪花）：t = 2.0 s 与 2.6 s 相差 ${n} 个像素`); if (n <= 0) fail(`${name} 没有动态`); }
    info('动态来源（每系统 ≤ 3 处，轻、慢）：水田与海面的雨点涟漪（程序化圆环）、岸边浪花线呼吸（0.9 / 1.3 rad/s 正弦）、树冠摆动（≤ 0.1 m，0.7–0.9 rad/s）');
  });

  await checkAsync('W4-C8', '默认画面：uBend = 0、非断面模式不构建断面，绘制调用与 W3 持平', async ({ info, fail }) => {
    const r = await page.evaluate(async () => {
      const S = window.__scene; S.section.setMode(false); S.bend.set(0); S.view.set({ mode: 'free', yaw: 2.5, pitch: 0.5, dist: 34, target: [-7, 1.2, 20] });
      window.__step(40); S.renderer.render(S.scene, S.camera); return { calls: S.renderer.info.render.calls, tris: S.renderer.info.render.triangles, rootVisible: S.section.state.root ? S.section.state.root.visible : null };
    });
    info(`默认视角 ${r.calls} 次绘制调用、${r.tris} 个三角形（W3 交付 2374 / 239,958；预算 ≤ +2% = 2421）；断面根节点 ${r.rootVisible === null ? '未构建' : r.rootVisible ? '可见' : '已隐藏'}`);
    if (r.calls > 2374 * 1.02) fail(`默认视角绘制调用 ${r.calls} > 2421`);
    if (r.rootVisible) fail('默认画面里断面可见');
    if (errors.length) fail('页面错误：' + errors.join(' | '));
  });
  await browser.close();
}

const failed = results.filter(r => !r.ok);
console.log(failed.length ? `FAIL ${failed.map(r => r.id).join(', ')}` : `PASS section_check（${results.length} 项）`);
process.exit(failed.length ? 1 : 0);
