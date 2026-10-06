// Per-1000 m2 cost of the W4 sample section by ground kind, and the extrapolation to the whole planet (W4_SPEC section 6). Run: node tools/section_extrapolate.mjs
// Counts come from section_plan.js (instances per region kind) and flora.js (triangles per type); no rendering. The section's measured draw calls are in section_check.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
globalThis.LAYOUT = require(path.join(root, 'layout.js'));
const W = require(path.join(root, 'world.js'));
const PLAN = require(path.join(root, 'section_plan.js')).plan(W);
const RK = require(path.join(root, 'roadkit.js'));
const THREE = require(path.join(root, 'three.min.js'));
const K = require(path.join(root, 'flora.js')).make(THREE), tri = n => (K.geometries[n] ? K.geometries[n].attributes.position.count / 3 : 0);
const TREES = new Set(['treeRound', 'cedar', 'pine', 'bamboo']), NOHULL = new Set(['weedShadow', 'seedling', 'tuft', 'weed', 'fern', 'flower', 'plank', 'pile']);

const kindOf = (lon, lat) => { const r = W.regionAt(lon, lat); return r.zone === 'ocean' ? 'ocean' : r.kind === 'ruin' ? 'farmland' : r.kind === 'ice-south' || r.kind === 'ice-north' ? 'ice' : r.kind; };
const area = {}; for (let u = -12; u < 12; u += 0.5) for (let v = 0; v < 59.5; v += 0.5) { const [lo, la] = PLAN.toLL(u + 0.25, v + 0.25), k = kindOf(lo, la); if (k !== 'town') area[k] = (area[k] || 0) + 0.25; }
const per = {};   // kind -> { inst, near, far, types:Set, hullTypes }
const add = (kind, type) => {
  const p = per[kind] = per[kind] || { inst: 0, near: 0, far: 0, types: new Set() };
  p.inst++; p.types.add(type);
  const near = tri(type) * (NOHULL.has(type) ? 1 : 2), far = TREES.has(type) ? tri(type + '_far') : tri(type);   // near = model + outline hull; far = the simple level (no hull)
  p.near += near; p.far += far;
};
for (const [type, list] of Object.entries(PLAN.items)) for (const it of list) add(kindOf(it.lon, it.lat), type);
for (const id of ['T03-01', 'T03-02', 'T03-03', 'T11-01']) for (const [type, list] of Object.entries(RK.build(W, id).instances)) for (const it of list) add(kindOf(it.lon, it.lat), type);

const AREAS = { forest: 7208, farmland: 14769, grassland: 19785, village: 4823, desert: 2773, lava: 1119, ice: 8407, ocean: 31510 };
const SUB = { village: ['farmland', 1.0, '以 farmland 的密度估算（建筑由 W7 的村庄套件另计）'], desert: ['grassland', 0.5, '以 grassland 密度的一半估算（岩石与枯草）'], lava: ['grassland', 0.25, '以 grassland 密度的 1/4 估算（只有岩石）'], ice: ['ocean', 1.0, '以 ocean 估算（平面，零星冰块）'] };
const fmt = (v, n = 0) => v.toLocaleString('en-US', { maximumFractionDigits: n, minimumFractionDigits: n });
console.log('| 地面 | 断面面积 m² | 实例 /1000 m² | 近景三角形 /1000 m² | 远景三角形 /1000 m² | 实例类型数 | 全球面积 m² | 全球实例上限 | 全球近景三角形 | 全球远景三角形 | 备注 |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
let totI = 0, totN = 0, totF = 0; const rows = {};
for (const kind of Object.keys(AREAS)) {
  let src = kind, k = 1, note = '断面实测';
  if (!per[kind] || !area[kind] || area[kind] < 100) { const s = SUB[kind] || [kind, 1, '']; src = s[0]; k = s[1]; note = s[2] || '断面面积不足'; }
  const p = per[src] || { inst: 0, near: 0, far: 0, types: new Set() }, a = area[src] || 1;
  const i1 = p.inst / a * 1000 * k, n1 = p.near / a * 1000 * k, f1 = p.far / a * 1000 * k, A = AREAS[kind];
  rows[kind] = { i1, n1, f1 }; totI += i1 * A / 1000; totN += n1 * A / 1000; totF += f1 * A / 1000;
  console.log(`| ${kind} | ${fmt(area[kind] || 0)} | ${fmt(i1, 1)} | ${fmt(n1)} | ${fmt(f1)} | ${p.types.size} | ${fmt(A)} | ${fmt(i1 * A / 1000)} | ${fmt(n1 * A / 1000)} | ${fmt(f1 * A / 1000)} | ${note} |`);
}
console.log(`| **合计** | | | | | | ${fmt(Object.values(AREAS).reduce((a, b) => a + b))} | **${fmt(totI)}** | **${fmt(totN)}** | **${fmt(totF)}** | 全部同时加载的上限 |`);
const DISC = Math.PI * 60 * 60, worst = Object.entries(rows).sort((a, b) => b[1].n1 - a[1].n1)[0];
console.log(`\n可见半径 60 m 的圆盘 ${fmt(DISC)} m²（BI02 的 3000 棵树预算对应 ≤ 0.27 棵/m²）：最重的地面 ${worst[0]} 为 ${fmt(worst[1].i1 * DISC / 1000)} 个实例、${fmt(worst[1].n1 * DISC / 1000)} 个近景三角形、${fmt(worst[1].f1 * DISC / 1000)} 个远景三角形（全盘最重的假设，实际视野里不会全是同一种地面）。`);
const trees = Object.entries(PLAN.items).filter(([t]) => TREES.has(t)).reduce((s, [, l]) => s + l.length, 0);
console.log(`断面森林面积 ${fmt(area.forest || 0)} m²，树 ${trees} 棵（含林缘与散树）；密度 ${fmt(trees / (area.forest || 1), 3)} 棵/m² ≤ 0.27。`);
console.log('断面分面积：' + Object.entries(area).map(([k, v]) => `${k} ${fmt(v)} m²`).join('，'));
