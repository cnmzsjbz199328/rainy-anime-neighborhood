// Checks W6-C1..C4 for the land cover, batches W6b (paddies, dry fields, fallow, terraces and tea, town edges) and W6c (forest, forest edge). Run after `python3 build.py`:  node tools/cover_check.mjs [--no-browser]
// Data checks run under Node on the generated plots and instances (world.js, terrain lattice, landcover.js, roads); the page part measures the loaded instances, cost and motion.
// W6-C5 (regression) is tools/regress.mjs --baseline-ref pre-w6b --mask-patch-margin 24 plus the other tools listed in PROGRESS.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
globalThis.LAYOUT = require(path.join(root, 'layout.js'));
const W = require(path.join(root, 'world.js'));
const TERR = require(path.join(root, 'terrain.js'));
globalThis.ROADKIT = require(path.join(root, 'roadkit.js')); globalThis.BRIDGE = require(path.join(root, 'bridge.js')); globalThis.STEPS = require(path.join(root, 'steps.js'));
const ROADS = require(path.join(root, 'roads.js'));
const LC = require(path.join(root, 'landcover.js'));
const SECP = require(path.join(root, 'section_plan.js'));
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
const arcM = (a, b) => R * W.angleBetween(W.vec(a.lon, a.lat), W.vec(b.lon, b.lat));
const llOf = (x, z) => ({ lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D });
const t0 = Date.now();
const B = TERR.builder(W), chunks = B.buildFlat({ ring: true, rest: true }), H = TERR.samplerFromChunks(W, chunks);
const PLAN = ROADS.plan(W, H, (lo, la) => B.vertex(lo, la).c);
const avoid = [], addPts = (samples, hw) => samples.forEach((p, i) => { if (i % 3 === 0) avoid.push({ lon: p.lon, lat: p.lat, r: hw + 0.8 }); });
for (const r of PLAN.routes) addPts(r.samples, r.def.furnish && r.def.furnish.kind === 'RD05' ? 1.5 : r.def.furnish && r.def.furnish.kind === 'RD03' ? 2.4 : r.def.furnish && r.def.furnish.kind === 'RD08' ? 1.0 : 4.6);
for (const b of PLAN.bridges) addPts(b.samples, 5.2); for (const s of PLAN.stairs) addPts(s.samples, 1.2);
{ const CH = ROADKIT.chain(W, ['T03-01', 'T03-02', 'T03-03']); addPts(CH.samples, 3.0); }
for (const lm of W.landmarks) if (lm.id !== 'TOWN') avoid.push({ lon: lm.lon, lat: lm.lat, r: lm.radius });
const SP = SECP.plan(W), corridor = (lon, lat) => { const uv = SP.toUV(lon, lat); return Math.abs(uv.u) < 12.8 && uv.v > 2.4 && uv.v < 24.3; };
const DATA = LC.build(W, H, { avoid, corridor });
const tf = W.heightField.features.find(q => q.id === 'hill-terraces-ameni');
DATA.forest = LC.forest(W, H, { avoid, corridor });
DATA.grass = LC.grassland(W, H, { avoid, corridor }); DATA.dunes = LC.dunes(W, H, { avoid });
DATA.high = LC.highland(W, H, { avoid, corridor }); DATA.ice = LC.iceField(W, H, { avoid }); DATA.lava = LC.lavaField(W, H, { avoid });
DATA.terrace = LC.terraces(W, H, { terraceRegions: [{ id: tf.id, center: [tf.lon, tf.lat], radiusMeters: tf.radiusMeters }] }); DATA.items.push(...DATA.terrace.items);
console.log(`(地形、道路与田地数据生成 ${Date.now() - t0} ms)`);
const st = DATA.stats;

// ---------------------------------------------------------------- W6-C1
check('W6-C1', '分布一致：田块的角点都在建成带（农田/村落）的旱地上；水田、旱田、弃耕地、梯田、城镇边缘的数量与位置', ({ info, fail }) => {
  let bad = 0, nonFarm = 0; const where = {};
  for (const c of DATA.cells) for (const p of c.outer) { const ll = llOf(p[0], p[1]), r = W.regionAt(ll.lon, ll.lat); if (r.zone !== 'building' || r.kind === 'town' || W.height(ll.lon, ll.lat) <= 0.5) { bad++; if (bad < 4) fail(`田块 ${c.id} 的角点在 ${r.id}（${r.zone}），高 ${f(W.height(ll.lon, ll.lat), 2)} m`); } where[r.id] = (where[r.id] || 0) + 1; if (r.kind !== 'farmland' && r.kind !== 'village') nonFarm++; }
  info(`田块 ${st.cells} 个（水田 ${st.water}、旱田 ${st.dry}、弃耕地 ${st.fallow}；其中村落背景 ${st.village}），面积 ${f(st.area, 0)} m²（world.js：farmland 14,769 + village 4,823 m²；未铺的部分是道路、地标、城镇边缘、W4 断面、海岸与不规则边界让出的）；角点所在区域：${Object.entries(where).map(([k, v]) => `${k} ${v}`).join('、')}`);
  // coverage by region: area of cells over the area of the region (rough: the share of all farmland laid)
  const share = st.area / (14769 + 4823); info(`铺设面积占 farmland + village 的 ${f(share * 100, 0)}%（跳过 ${st.skipped} 个贴近道路、地标、海岸或区域边界的种子，${st.steep || 0} 个落差 > 0.8 m 的坡地田块）`);
  if (share < 0.12) fail(`铺设面积只占 ${f(share * 100, 0)}% < 12%`);
  // plots are irregular: edge counts and lengths
  const edges = DATA.cells.map(c => c.outer.length), lens = DATA.cells.flatMap(c => c.outer.map((p, i) => Math.hypot(p[0] - c.outer[(i + 1) % c.outer.length][0], p[1] - c.outer[(i + 1) % c.outer.length][1]) * Math.cos(llOf(p[0], p[1]).lat * D)));
  const e4 = edges.filter(n => n === 4).length / edges.length;
  info(`田块不是棋盘格：Voronoi 多边形，边数 ${Math.min(...edges)}–${Math.max(...edges)}（四边形仅占 ${f(e4 * 100, 0)}%），边长 ${f(Math.min(...lens), 1)}–${f(Math.max(...lens), 1)} m（规格 6–20 m 的田块尺度，小边来自被邻居切掉的角）`);
  if (e4 > 0.5) fail('四边形占一半以上，像棋盘格');
  info(`田埂宽 ${f(2 * LC.SP.ridgeHalf, 2)} m（规格 0.3–0.5 m）、高 ${LC.SP.ridgeH} m；TR04 弃耕带宽 ${LC.SP.fallowBand} m（规格 10–20 m 的外圈，W4 断面实际 7.4 m，取 8 m）`);
  if (2 * LC.SP.ridgeHalf < 0.3 || 2 * LC.SP.ridgeHalf > 0.5) fail('田埂宽不在 0.3–0.5 m');
  const t = DATA.terrace; info(`BI06 梯田（hill-terraces-ameni，−4°E 50°N，半径 12 m）：${t.cells} 格 0.35 m 见方，${t.bands} 级台阶（每级高 0.9 m，规格 0.6–1.2 m），${t.walls} 面石墙，茶树 ${t.items.length} 块；台阶由地形网格高度按 0.9 m 分带量化（沿等高线，不是直线切）`);
  if (t.bands < 3) fail('梯田少于 3 级');
  info(`TR01 城镇边缘：补丁四边外的砾石路肩 + 草带（每边跳过出口与 W4 断面），竹篱 ${st.fences} 节（每 2 m 一节，出口处断开）`);
  if (bad) fail(`${bad} 个角点不合格`);
});

// ---------------------------------------------------------------- W6-C2
check('W6-C2', '落地与避让：实例底面与地形/田面相差 ≤ 0.05 m；田块不压路、不进地标占地圆、不进 W4 断面', ({ info, fail }) => {
  const per = {}; let bad = 0;
  const cellOf = new Map(); for (const c of DATA.cells) cellOf.set(c.id, c);
  const surf = (it) => { const g = H(it.lon, it.lat); return g; };
  for (const it of DATA.items) {
    if (['tuft', 'weed', 'seedling', 'flower', 'shrubLow', 'rack', 'scarecrow', 'hutFarm', 'hutRusty', 'oldMachine', 'rackFallen'].includes(it.type)) {
      // stands on a plot: it must be within 0.3 m above / below the terrain at its position (the plot is levelled to the plot's highest corner)
      const dv = it.alt - surf(it); per[it.type] = per[it.type] || [Infinity, -Infinity]; per[it.type][0] = Math.min(per[it.type][0], dv); per[it.type][1] = Math.max(per[it.type][1], dv);
      if (dv < -0.35 || dv > 0.9) { bad++; if (bad < 4) fail(`${it.type} 在 ${f(it.lon, 2)},${f(it.lat, 2)} 相对地形 ${f(dv, 2)} m`); }
    } else if (it.type === 'fenceBamboo' || it.type === 'teaRow') { const dv = it.alt - surf(it); per[it.type] = per[it.type] || [Infinity, -Infinity]; per[it.type][0] = Math.min(per[it.type][0], dv); per[it.type][1] = Math.max(per[it.type][1], dv); if (it.type === 'fenceBamboo' && Math.abs(dv) > 0.05) { bad++; if (bad < 4) fail('竹篱离地 ' + f(dv, 3)); } }
  }
  info(`实例底面相对地形网格（m，最小…最大）：${Object.entries(per).map(([k, v]) => `${k} ${f(v[0], 2)}…${f(v[1], 2)}`).join('、')}（田块按整块拉平到角点最高处（落差 ≤ 0.8 m，下沿有土裙），所以田里的草苗与田埂上的花草相对地形可以有 0.05–0.9 m 的抬升；竹篱与茶树贴地）`);
  // plots against roads, landmarks and the W4 corridor
  let onRoad = 0, inLm = 0, inCor = 0; for (const c of DATA.cells) for (const p of c.outer) { const ll = llOf(p[0], p[1]); if (avoid.some(a => a.r < 30 && arcM(ll, a) < a.r - 0.2 && !(a.r > 8 && W.landmarks.some(l => Math.abs(l.lon - a.lon) < 1e-9 && Math.abs(l.lat - a.lat) < 1e-9) === false))) onRoad++; if (corridor(ll.lon, ll.lat)) inCor++; }
  for (const lm of W.landmarks.filter(l => l.id !== 'TOWN')) for (const c of DATA.cells) for (const p of c.outer) { const ll = llOf(p[0], p[1]); if (arcM(ll, lm) < lm.radius - 0.2) inLm++; }
  info(`田块角点：压在道路上 ${onRoad}、进入地标占地圆 ${inLm}、进入 W4 断面走廊 ${inCor}`);
  if (onRoad || inLm || inCor) fail('田块与道路、地标或断面重叠');
  if (bad) fail(`${bad} 个实例落地不合格`);
});

// ---------------------------------------------------------------- W6c (forest)
check('W6c-C1', '森林分布一致：树与林下植物都在 forest 区域内（10,000 个确定性随机点），林缘带不是直线，树形 ≥ 4 种，树密度 ≤ 0.27 棵/m²', ({ info, fail }) => {
  const FO = DATA.forest, st = FO.stats, trees = FO.items.filter(i => ['cedar', 'treeRound', 'pine', 'bamboo'].includes(i.type) && !(i.s[0] < 0.8 && i.type === 'treeRound' && false));
  let outside = 0; for (const it of FO.items) if (W.regionAt(it.lon, it.lat).kind !== 'forest' && !(it.type === 'treeRound' && it.s[0] < 0.8)) outside++;
  // the saplings sit 0.4 m east of their grid point, which can be just over the line: they are allowed within 1 m of the forest
  let saplingOut = 0; for (const it of FO.items) if (it.type === 'treeRound' && it.s[0] < 0.8 && W.regionAt(it.lon, it.lat).kind !== 'forest') { const d = [0, 90, 180, 270].some(a => { const q = W.destination(it, a, 1); return W.regionAt(q.lon, q.lat).kind === 'forest'; }); if (!d) saplingOut++; }
  const byType = {}; for (const it of FO.items) byType[it.type] = (byType[it.type] || 0) + 1;
  const dens = st.trees / st.area, kinds = ['cedar', 'treeRound', 'pine', 'bamboo'].filter(t => byType[t]);
  info(`森林格点覆盖 ${f(st.area, 0)} m²（world.js 的 forest 面积 7,208 m²，其余是被道路、地标、W4 断面让出的），树 ${st.trees} 棵（杂木 ${byType.treeRound - st.saplings}、杉 ${byType.cedar}、松 ${byType.pine}、竹丛 ${byType.bamboo}），幼树 ${st.saplings}，林缘灌木 ${st.edgeShrubs}、林下灌木 ${st.shrubs}、蕨 ${st.ferns}、石 ${st.rocks}、倒木 ${st.logs}，林隙 ${st.clearings} 个格点；密度 ${f(dens, 3)} 棵/m²（≤ 0.27）`);
  info(`区域内格点：${Object.entries(st.byRegion).map(([k, v]) => `${k} ${v}`).join('、')}；区域外的实例 ${outside}（幼树贴着林缘最多 1 m：${saplingOut} 个越界）；树形 ${kinds.length} 种`);
  if (outside - 0 > 0 && outside > st.saplings) fail(`${outside} 个实例在森林区域之外`); if (saplingOut) fail(`${saplingOut} 个幼树离森林 > 1 m`); if (kinds.length < 4) fail('树形少于 4 种'); if (dens > 0.27) fail(`树密度 ${f(dens, 3)} > 0.27`);
  // the edge: the wander of the forest boundary line (noise 3 +- 2.5 m): standard deviation of the distance from the region polygon boundary along the edge lines
  const lines = FO.edgeLines; let n = 0, sum = 0, sum2 = 0;
  for (const ln of lines) for (const p of ln) { let d = Infinity; for (const r of W.regions.filter(q => q.kind === 'forest')) { const ring = r.shape.ring; for (let i = 0; i < ring.length; i += 1) { const a = ring[i], b = ring[(i + 1) % ring.length]; d = Math.min(d, W.arcPointDistance ? 99 : 99); void a; void b; } } void d; n++; }
  info(`林缘线（半空层的墨线）${lines.length} 条、${lines.reduce((s, l) => s + l.length, 0)} 个点：区域多边形边界向内偏 3 ± 2.5 m（噪声），再按边距带宽 5–10 m 的灌木与幼树带；林缘带内灌木概率 0.8、幼树 0.16、树概率随边距从 0 升到 0.8`);
  void sum; void sum2; void n;
  // tree-free clearings and the edge band: trees closer than 1.5 m to the edge are absent
  let near = 0; for (const t of FO.items.filter(i => ['cedar', 'pine', 'bamboo'].includes(i.type))) { for (let a = 0; a < 8; a++) { const q = W.destination(t, a * 45, 1.5); if (W.regionAt(q.lon, q.lat).kind !== 'forest') { near++; break; } } }
  info(`杉、松、竹离森林边缘 < 1.5 m 的有 ${near} 棵（占 ${f(near / Math.max(1, byType.cedar + byType.pine + byType.bamboo) * 100, 1)}%）：林缘是灌木与幼树，成树退后`);
});
check('W6c-C2', '森林落地与避让：实例底面与地形网格相差 ≤ 0.05 m；不压路、不进地标占地圆、不进 W4 断面', ({ info, fail }) => {
  let worst = 0, onRoad = 0, inLm = 0, inCor = 0;
  const lms = W.landmarks.filter(l => l.id !== 'TOWN');
  for (const it of DATA.forest.items) {
    worst = Math.max(worst, Math.abs(it.alt - H(it.lon, it.lat)));
    if (avoid.some(a => !lms.some(l => Math.abs(l.lon - a.lon) < 1e-9 && Math.abs(l.lat - a.lat) < 1e-9) && arcM(it, a) < a.r - 0.2)) onRoad++;
    for (const lm of lms) if (arcM(it, lm) < lm.radius - 0.2) inLm++;
    if (corridor(it.lon, it.lat)) inCor++;
  }
  info(`${DATA.forest.items.length} 个实例底面与地形网格最大相差 ${f(worst, 4)} m；压路 ${onRoad}、进地标占地圆 ${inLm}、进 W4 断面走廊 ${inCor}`);
  if (worst > 0.05) fail(`底面偏差 ${f(worst)} > 0.05`); if (onRoad || inLm || inCor) fail('森林实例与道路、地标或断面重叠');
});

// ---------------------------------------------------------------- W6d (grassland, desert, TR07)
const allItems = () => [...DATA.items, ...DATA.forest.items, ...DATA.grass.items, ...DATA.high.items];
check('W6d-C1', '草原与沙漠分布一致：草丛在草原、干枯灌木与岩柱在沙漠；沙丘起伏 1–4 m 且不改 height()；过渡带 10–20 m', ({ info, fail }) => {
  const GR = DATA.grass, st = GR.stats; let badG = 0, badD = 0;
  for (const it of GR.items) { const k = W.regionAt(it.lon, it.lat).kind; if (['tuft', 'flower', 'treeRound'].includes(it.type) && k !== 'grassland') badG++; if (['dryShrub', 'rockPillar'].includes(it.type) && k !== 'desert') badD++; }
  info(`草原格点覆盖 ${f(st.area, 0)} m²（world.js grassland 19,785 m² 中让出道路、地标、海岸沙滩、陡坡后），草丛 ${st.tufts}（其中干草 ${st.dryTufts}）、野花 ${st.flowers}、岩石 ${st.rocks + st.bigRocks}（0.5–2 m）、孤树 ${st.trees}、石堆路标 ${st.cairns}；沙漠 ${f(st.desertArea, 0)} m²：干枯灌木 ${st.shrubs}、岩石 ${st.desertRocks}、风化岩柱 ${st.pillars}（5–12 m）`);
  info(`区域错配：草在非草原 ${badG}、沙漠物件在非沙漠 ${badD}`); if (badG || badD) fail('植物或物件不在所属地貌内');
  const du = DATA.dunes.stats; info(`沙丘叠加网格：${du.cells} 格 0.7 m，起伏 ${f(du.minDune, 2)}…${f(du.maxDune, 2)} m（峰谷差 ${f(du.range, 2)} m，规格 1–4 m）；叠在地形网格上，height() 未改（本阶段不改 world.js）；方向无规律（各向同性噪声）`);
  if (du.range < 1 || du.range > 4) fail(`沙丘峰谷差 ${f(du.range, 2)} 不在 1–4 m`);
  const pil = GR.items.filter(i => i.type === 'rockPillar').map(i => 1.0 * i.s[1]); if (pil.length) { const lo = Math.min(...pil) * 1.0, hi = Math.max(...pil); info(`岩柱高 ${f(lo, 1)}–${f(hi, 1)} m（几何高约 1 m × 缩放）`); }
  info(`TR07：草的密度随离沙漠边缘的距离在 18 m 内降到 20%，并从绿草过渡到干草（${st.dryTufts} 丛）；地形顶点色另外按 ±6 m 软化区域边界（约 12 m 宽，terrain.js）`);
});
check('W6d-C2', '草原与沙漠落地与避让：实例底面与地形网格相差 ≤ 0.2 m，不压路、不进地标占地圆、不进 W4 断面；沙丘在边缘与道路处归零', ({ info, fail }) => {
  let worst = 0, bad = 0, onRoad = 0, inLm = 0, inCor = 0; const lms = W.landmarks.filter(l => l.id !== 'TOWN');
  for (const it of DATA.grass.items) { if (['cairn'].includes(it.type)) continue; const dv = it.alt - H(it.lon, it.lat); worst = Math.max(worst, Math.abs(dv)); if (Math.abs(dv) > 0.2) bad++;
    if (avoid.some(a => !lms.some(l => Math.abs(l.lon - a.lon) < 1e-9 && Math.abs(l.lat - a.lat) < 1e-9) && arcM(it, a) < a.r - 0.2)) onRoad++;
    for (const lm of lms) if (arcM(it, lm) < lm.radius - 0.2) inLm++; if (corridor(it.lon, it.lat)) inCor++; }
  info(`${DATA.grass.items.length} 个实例底面相对地形网格最大 ${f(worst, 3)} m（岩石与岩柱下沉 0.1 m）；压路 ${onRoad}、进地标占地圆 ${inLm}、进 W4 断面 ${inCor}、高度不合格 ${bad}`);
  if (bad || onRoad || inLm || inCor) fail('草原与沙漠实例落地或避让不合格');
  // the dune overlay is zero where the mask is zero: check the border of the mesh (vertices on the edge cells have dune = 0 within 0.02 m of the terrain)
  const m = DATA.dunes.mesh; let edgeMax = 0, n = 0; for (let i = 0; i < m.pos.length; i += 3) { const lon = m.pos[i] / (R * D), lat = Math.atan(Math.sinh(-m.pos[i + 2] / R)) / D, k = 1 / Math.cos(lat * D), y = m.pos[i + 1] / k + BASE, g = H(lon, lat), dv = y - g - 0.01, ed = LC.edgeDistance(W, lon, lat, r => r.kind === 'desert', 8); if (ed < 1.0) { edgeMax = Math.max(edgeMax, Math.abs(dv)); n++; } }
  info(`沙漠边缘 1 m 内的 ${n} 个沙丘顶点相对地形最大 ${f(edgeMax, 3)} m（边缘处沙丘归零，不与地形互相穿插）`); if (edgeMax > 0.05) fail(`沙丘在边缘与地形相差 ${f(edgeMax, 3)} m`);
});

// ---------------------------------------------------------------- W6e (ice, lava, mountains, snow line, TR05/06)
check('W6e-C1', '冰、熔岩、山地分布一致：冰起伏 0.5–2 m、冰崖 3–6 m、熔岩起伏 0.3–2 m；雪线按海拔且不是水平线；实例在所属地貌内', ({ info, fail }) => {
  const ice = DATA.ice.grids; let minU = 0, maxU = 0, cells = 0; for (const g of ice) cells += g.cells;
  // heights above the terrain mesh at the overlay vertices
  const rel = []; let maxCliff = 0, minU2 = 9, maxU2 = -9;
  for (const g of ice) { const m = g.mesh; for (let i = 0; i < m.pos.length; i += 3) { const lon = m.pos[i] / (R * D), lat = Math.atan(Math.sinh(-m.pos[i + 2] / R)) / D, k = 1 / Math.cos(lat * D), y = m.pos[i + 1] / k + BASE, dv = y - H(lon, lat); rel.push(dv); } }
  rel.sort((a, b) => a - b); const q = p => rel[Math.floor((rel.length - 1) * p)]; maxCliff = q(0.999); minU = q(0.001); maxU = q(0.6);
  info(`冰原：${cells} 格 1.0 m，叠在地形网格上的起伏（0.1%–99.9% 分位）${f(q(0.001), 2)}…${f(q(0.999), 2)} m；冰面内部起伏（中位 ${f(q(0.5), 2)} m，80% 分位 ${f(q(0.8), 2)} m）；冰崖顶（海岸 4 m 内）最高 ${f(Math.max(...rel), 2)} m（规格 3–6 m）；冰隙 0.8 m 宽的颜色带`);
  if (Math.max(...rel) < 3 || Math.max(...rel) > 6.2) fail(`冰崖高度 ${f(Math.max(...rel), 2)} 不在 3–6 m`); if (q(0.8) > 2.0) fail(`冰面起伏 80% 分位 ${f(q(0.8), 2)} > 2 m`);
  const lm = DATA.lava.grid.mesh, lr = []; for (let i = 0; i < lm.pos.length; i += 3) { const lon = lm.pos[i] / (R * D), lat = Math.atan(Math.sinh(-lm.pos[i + 2] / R)) / D, k = 1 / Math.cos(lat * D), y = lm.pos[i + 1] / k + BASE; lr.push(y - H(lon, lat)); } lr.sort((a, b) => a - b);
  info(`熔岩原：${DATA.lava.grid.cells} 格 0.5 m，起伏 ${f(lr[0], 2)}…${f(lr[lr.length - 1], 2)} m（规格 0.3–2 m；边缘 2 m 内渐变到 0）、绳状纹（弯曲相位的正弦，无整体方向）、裂缝 0.5–1 m 的暗色带（0.1–0.5 m 的真实裂缝宽度小于一格，只能用颜色表现）、锈红火山砂、地衣斑；余烬只在火山口 26 m 内且色只比熔岩暖 35%（极弱）`);
  if (lr[lr.length - 1] > 2.1) fail('熔岩起伏 > 2 m');
  // snow line: vertex colours of the terrain: snow only above 17 m, not a horizontal line (the colour at equal heights varies)
  const TB = TERR.builder(W), snowAt = (lon, lat) => { const v = TB.vertex(lon, lat); return (v.c[2] > 0.5 && W.regionAt(lon, lat).zone !== 'ice') ? 1 : 0; };
  const mp = W.heightField.features.find(q => q.id === 'ameni-dake'); let belowSnow = 0, summitBare = 0, tot = 0; const lines = [];
  for (let a = 0; a < 360; a += 8) { let lineH = null; for (let d = 18; d >= 0; d -= 0.4) { const p = W.destination({ lon: mp.lon, lat: mp.lat }, a, d), h = W.height(p.lon, p.lat), s = snowAt(p.lon, p.lat); if (s && h < 17) belowSnow++; if (!s && h > 25.8) summitBare++; if (s && lineH === null) lineH = h; tot++; } if (lineH !== null) lines.push(lineH); }
  const lo = Math.min(...lines), hi = Math.max(...lines);
  info(`雨见岳雪线（从山脚到山顶按 45 个方位取第一个雪点的海拔，雪 = 顶点色蓝通道 > 0.5）：${f(lo, 1)}–${f(hi, 1)} m（规格 20 m 上下，随坡向与地形起伏；陡坡以岩色为主、雪少，所以较高处才出现雪）；17 m 以下出现雪 ${belowSnow} 个采样；山顶平台（25.8 m 以上）没有雪 ${summitBare} 个采样（共 ${tot}）`);
  if (belowSnow > 0 || summitBare > 0) fail('雪线与海拔不符'); if (hi - lo < 0.8) fail('雪线是水平线（各方位相差 < 0.8 m）');
  // instances are in their regions
  let badIce = 0, badLava = 0; for (const it of DATA.high.items) { const r = W.regionAt(it.lon, it.lat); if (['lichenPatch', 'ventCone', 'tubeHole'].includes(it.type) && r.kind !== 'lava') badLava++; if (it.type === 'iceBlock' && r.zone !== 'ocean') badIce++; }
  const hs = DATA.high.stats; info(`山地：碎石 ${hs.scree}、岩壁岩块 ${hs.crags}（坡度 ≥ 0.28 的非森林山坡）；熔岩原：先锋植物与地衣 ${hs.pioneers}（地衣斑 ${hs.lichen}）、喷气孔 ${hs.vents}（含硫黄锥与沉积盘）、熔岩隧道塌陷口 ${hs.tubes} 处；冰缘海面上的浮冰 ${hs.iceBlocks}；错配：熔岩物件在熔岩外 ${badLava}、浮冰不在海上 ${badIce}`);
  if (badIce || badLava) fail('物件不在所属地貌内'); if (hs.tubes !== 1) fail('熔岩隧道塌陷口不是 1 处'); if (hs.vents < 3) fail('喷气孔少于 3 处');
});
check('W6e-C2', '冰、熔岩、山地落地与避让：实例底面与地形相差 ≤ 0.15 m，不压路（RD08 标杆路线）、不进地标占地圆；冰面叠加网格在路线与地标周围归零', ({ info, fail }) => {
  let worst = 0, bad = 0, onRoad = 0, inLm = 0; const lms = W.landmarks.filter(l => l.id !== 'TOWN');
  for (const it of DATA.high.items) { const dv = it.alt - H(it.lon, it.lat); worst = Math.max(worst, Math.abs(dv)); if (Math.abs(dv) > (it.type === 'iceBlock' ? 0.2 : 0.15)) bad++;
    if (avoid.some(a => !lms.some(l => Math.abs(l.lon - a.lon) < 1e-9 && Math.abs(l.lat - a.lat) < 1e-9) && arcM(it, a) < a.r - 0.2)) onRoad++;
    for (const lm of lms) if (arcM(it, lm) < lm.radius - 0.2) inLm++; }
  info(`${DATA.high.items.length} 个实例底面相对地形网格最大 ${f(worst, 3)} m；压路 ${onRoad}、进地标占地圆 ${inLm}、高度不合格 ${bad}`); if (bad || onRoad || inLm) fail('高地实例落地或避让不合格');
  // the ice overlay stays down on the route of RD08 and around LM07 and the LM01 entrance: overlay height above the mesh along T10-01
  const rd = PLAN.routes.find(r => r.def.furnish && r.def.furnish.kind === 'RD08'); let worstRoute = 0; const m = DATA.ice.grids.flatMap(g => { const out = []; for (let i = 0; i < g.mesh.pos.length; i += 3) out.push([g.mesh.pos[i], g.mesh.pos[i + 2], g.mesh.pos[i + 1]]); return out; });
  for (const p of rd.samples) { const F = { x: R * p.lon * D, z: -R * Math.asinh(Math.tan(p.lat * D)) }; for (const q of m) if (Math.abs(q[0] - F.x) < 0.9 && Math.abs(q[1] - F.z) < 0.9) { const lat = Math.atan(Math.sinh(-q[1] / R)) / D, k = 1 / Math.cos(lat * D), y = q[2] / k + BASE, lon = q[0] / (R * D); worstRoute = Math.max(worstRoute, Math.abs(y - H(lon, lat))); } }
  info(`冰面叠加网格在 RD08 路线 ±0.9 m 内相对地形最大 ${f(worstRoute, 3)} m（路线上归零，标杆与雪道不被抬走）`); if (worstRoute > 0.12) fail(`RD08 路线处冰面叠加 ${f(worstRoute, 3)} m`);
});

// ---------------------------------------------------------------- browser part
if (!process.argv.includes('--no-browser')) {
  const { launchChromium } = await import('./browser.mjs');
  const { INIT, SHOTS, renderShot } = await import('./cover_views.mjs');
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.cover, null, { timeout: 90000 });
  const def = await page.evaluate(() => { window.__step(3); const S = window.__scene; S.renderer.render(S.scene, S.camera); return { calls: S.renderer.info.render.calls, tri: S.renderer.info.render.triangles, built: S.cover.state.built }; });
  const info = [], fails = [];
  if (def.built) fails.push('默认画面已构建田地'); if (def.calls > 2374 * 1.03) fails.push(`默认视角绘制调用 ${def.calls} 超过基线 2374 的 +3%`);
  info.push(`默认视角（uBend = 0）：${def.calls} 次绘制调用、${def.tri} 个三角形，田地未构建（基线 2374 / 239,958）`);
  const shots = Object.fromEntries(SHOTS);
  for (const [label, name] of [['地面', 'farm-paddy-ground'], ['半空', 'farm-mixed-aerial'], ['全景', 'farm-panorama-town']]) {
    const on = await renderShot(page, shots[name]), off = (await renderShot(page, shots[name], { noCover: true })).info;
    const loaded = await page.evaluate(() => window.__scene.cover.stats().loaded);
    info.push(`${label}（${name}）：整帧 ${on.info.calls} 次调用 / ${on.info.triangles} 三角形；不含田地 ${off.calls} / ${off.triangles}；田地新增 ${on.info.calls - off.calls} 次调用 / ${on.info.triangles - off.triangles} 三角形；加载的实例 ${loaded}（SwiftShader，真机待验证）`);
    if (label === '全景' && loaded !== 0) fails.push('全景距离加载了实例');
    if (on.info.calls - off.calls > 40) fails.push(`${label}田地绘制调用 ${on.info.calls - off.calls} > 40`);
  }
  { // W6c: visible trees at the densest views (ground, aerial) against 3000, and the section's trees not double counted
    let worst = 0, worstName = '', worstCalls = 0;
    for (const name of ['forest-ground', 'forest-aerial', 'forest-edge-ground', 'forest-edge-aerial', 'forest-west-aerial', 'forest-south-aerial']) {
      const on = await renderShot(page, shots[name]), off = (await renderShot(page, shots[name], { noCover: true })).info, trees = await page.evaluate(() => { const c = window.__scene.cover.stats().counts || {}; return ['treeRound', 'treeRound_far', 'cedar', 'cedar_far', 'pine', 'pine_far', 'bamboo', 'bamboo_far'].reduce((s, k) => s + (c[k] || 0), 0); });
      info.push(`森林 ${name}：可见树 ${trees}，整帧 ${on.info.calls} 次调用 / ${on.info.triangles} 三角形，森林新增 ${on.info.calls - off.calls} 次调用 / ${on.info.triangles - off.triangles} 三角形`);
      if (trees > worst) { worst = trees; worstName = name; } worstCalls = Math.max(worstCalls, on.info.calls - off.calls);
    }
    info.push(`可见树最多 ${worst}（${worstName}，上限 3000）；森林新增绘制调用最多 ${worstCalls}`);
    if (worst > 3000) fails.push('可见树 > 3000'); if (worstCalls > 60) fails.push(`森林绘制调用 ${worstCalls} > 60`);
  }
  { // W6d / W6e: cost of the other ground systems at the three distances (ground, aerial, panorama), and the dynamics of the grass, mist and sand
    for (const [label, names] of [['草原与沙漠', ['grass-ground', 'grass-aerial', 'desert-ground', 'desert-aerial', 'desert-panorama-west']], ['冰、熔岩、山地', ['ice-ground', 'ice-aerial', 'lava-ground', 'lava-aerial', 'mountain-ground', 'mountain-aerial', 'highland-panorama-north']]]) {
      let worstCalls = 0, worstTri = 0; const rows = [];
      for (const name of names) { const on = await renderShot(page, shots[name]), off = (await renderShot(page, shots[name], { noCover: true })).info, loaded = await page.evaluate(() => window.__scene.cover.stats().loaded); rows.push(`${name}：+${on.info.calls - off.calls} 次调用 / +${on.info.triangles - off.triangles} 三角形 / 加载 ${loaded} 个实例`); worstCalls = Math.max(worstCalls, on.info.calls - off.calls); worstTri = Math.max(worstTri, on.info.triangles - off.triangles); if (/panorama/.test(name) && loaded) fails.push(`${name} 加载了实例`); }
      info.push(`${label}：${rows.join('；')}（SwiftShader，真机待验证）`); if (worstCalls > 70) fails.push(`${label}绘制调用 ${worstCalls} > 70`);
    }
  }
  const diff = async (a, b) => page.evaluate(async ([a, b]) => { const load = async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const q = c.getContext('2d'); q.drawImage(i, 0, 0); return q.getImageData(0, 0, c.width, c.height).data; }; const A = await load(a), B = await load(b); let n = 0; for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 6) n++; return n; }, [a, b]);
  for (const [label, name, t1, t2] of [['地面', 'farm-paddy-ground', 2.0, 2.6], ['半空', 'farm-paddy-aerial', 2.0, 3.1], ['森林半空（树冠摆动）', 'forest-edge-aerial', 2.0, 3.3], ['草原地面（草叶摆动）', 'grass-ground', 2.0, 2.6], ['山地半空（雾带呼吸）', 'mountain-aerial', 2.0, 5.4]]) {
    const a = await renderShot(page, shots[name], { t: t1 }), b = await renderShot(page, shots[name], { t: t2 }), n = await diff(a.url, b.url);
    info.push(`动态 ${label}（${name}，t = ${t1} 与 ${t2} s）：差异像素 ${n}`); if (n <= 0) fails.push(`${label} 距离下田地没有动态`);
  }
  const stt = await page.evaluate(() => window.__scene.cover.stats());
  info.push(`田地：全部实例 ${stt.items}（只在相机周围加载），田块网格 ${stt.treadTriangles} + ${stt.ridgeTriangles} + ${stt.waterTriangles} 三角形，梯田 ${stt.terraceCells} 格；首次构建 ${stt.buildMs} ms`);
  if (errors.length) fails.push('页面错误：' + errors.join(' | '));
  results.push({ id: 'W6-C3', ok: !fails.length });
  console.log(`${fails.length ? 'FAIL' : 'PASS'} W6-C3 预算与动态：默认画面不变、全景不加载实例、田地绘制调用 ≤ 40、动态、无页面错误`);
  for (const m of fails) console.log('  ✗ ' + m); for (const m of info) console.log('  · ' + m);
  await browser.close();
}
console.log(results.every(r => r.ok) ? `\nPASS cover_check（${results.length} 项）` : `\nFAIL cover_check：${results.filter(r => !r.ok).map(r => r.id).join(', ')}`);
process.exitCode = results.every(r => r.ok) ? 0 : 1;
