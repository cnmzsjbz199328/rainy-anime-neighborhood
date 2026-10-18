// W10d: compare height functions to the pre-W10d ref and verify terrain changes are confined to adding the town plain. Loads both worlds next to the
// current one and compares, with ===, W.height, W.regionAt (id) and W.coastDistance at
//   - every vertex of the global terrain lattice (terrain.js rings, both caps) and the four gradient probes vertex() takes around it,
//   - the first 15 m of the 9 town exits (0.5 m along, -6 .. 6 m across every 0.5 m),
//   - 200 000 points spread uniformly over the sphere (fixed seed),
// and then the whole terrain mesh data (buildFlat ring and rest, both caps) built on each world.js, array by array. Prints the timings of both.
//   node tools/height_check.mjs [--ref pre-w10d] [--random 200000]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const ref = arg('--ref', 'pre-w10d'), nRandom = Number(arg('--random', 200000));
const require = createRequire(import.meta.url);
const eqArr = (a, b) => a == null || b == null ? a === b : a.constructor === b.constructor && a.length === b.length &&
  Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'height-check-'));
for (const f of ['world.js', 'layout.js', 'terrain.js']) fs.writeFileSync(path.join(tmp, f), execFileSync('git', ['show', `${ref}:${f}`], { cwd: root }));
globalThis.LAYOUT = require(path.join(root, 'layout.js'));
const OLD = require(path.join(tmp, 'world.js')), NEW = require(path.join(root, 'world.js'));
const TERRAIN = require(path.join(root, 'terrain.js'));
const R = 90, D = Math.PI / 180;

// ---- the points
const pts = [];
const B = TERRAIN.builder(NEW), e = 0.75;
const lattice = (lat, lons) => { for (const lon of lons) { pts.push([lon, lat]); const s = Math.cos(lat * D), dlon = e / (R * s) / D, dlat = e / R / D; pts.push([lon + dlon, lat], [lon - dlon, lat], [lon, lat + dlat], [lon, lat - dlat]); } };
for (const lat of B.lats) lattice(lat, B.ringLons(lat));
for (let l = TERRAIN.FLAT_LAT; l < 90; l++) for (const sg of [1, -1]) lattice(sg * l, B.ringLons(sg * l));
pts.push([0, 90], [0, -90]);
const nLattice = pts.length;
const NET = NEW.roadNetwork;
for (const node of NET.nodes.filter(n => n.kind === 'town-exit')) {
  const edge = NET.edges.find(q => q.from === node.id || q.to === node.id), len = NET.edgeLength(edge);
  let S = NET.samplePath(edge, 0.5); if (edge.to === node.id) S = S.slice().reverse().map(p => ({ ...p, s: len - p.s }));
  const run = S.filter(p => p.s <= 15 + 1e-9);
  run.forEach((p, i) => { const a = run[Math.max(0, i - 1)], b = run[Math.min(run.length - 1, i + 1)], br = NEW.bearing(a, b);
    for (let o = -6; o <= 6 + 1e-9; o += 0.5) { const q = Math.abs(o) < 1e-9 ? p : NEW.destination(p, br + (o > 0 ? 90 : -90), Math.abs(o)); pts.push([q.lon, q.lat]); } });
}
const nExit = pts.length - nLattice;
let seed = 0x9e3779b9; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
for (let i = 0; i < nRandom; i++) pts.push([-180 + 360 * rnd(), Math.asin(2 * rnd() - 1) / D]);

// ---- compare the functions
const same = (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b));
const fails = { height: [], regionAt: [], coastDistance: [] };
const time = (W) => { const t = Date.now(); let s = 0; for (const [lon, lat] of pts) s += W.height(lon, lat); return { ms: Date.now() - t, s }; };
OLD.height(1, 50); NEW.height(1, 50);                                      // build the caches of both before timing
const tOld = time(OLD), tNew = time(NEW);
pts.forEach(([lon, lat], i) => {
  const ho = OLD.height(lon, lat), hn = NEW.height(lon, lat); if (!same(ho, hn)) fails.height.push({ i, lon, lat, old: ho, now: hn });
  const ro = OLD.regionAt(lon, lat).id, rn = NEW.regionAt(lon, lat).id; if (ro !== rn) fails.regionAt.push({ i, lon, lat, old: ro, now: rn });
  const co = OLD.coastDistance(lon, lat), cn = NEW.coastDistance(lon, lat); if (!same(co, cn)) fails.coastDistance.push({ i, lon, lat, old: co, now: cn });
});
const nPts = pts.length;
for (const [k, list] of Object.entries(fails)) console.log(`${list.length ? 'FAIL' : 'PASS'} ${k}：${nPts} 个点逐位相同${list.length ? `之外有 ${list.length} 处不同，例 ${JSON.stringify(list.slice(0, 3))}` : ''}（格点与梯度探针 ${nLattice}、出口前 15 m ${nExit}、随机 ${nRandom}）`);
console.log(`     W.height 全部 ${nPts} 点：${ref} ${tOld.ms} ms，当前 ${tNew.ms} ms`);

// ---- terrain vertices outside the town patch remain bit-for-bit stable; W10d intentionally adds its continuous flat triangles.
const TOLD = require(path.join(tmp, 'terrain.js'));
const build = (T, W) => { const b = T.builder(W), t = Date.now(); const ring = b.buildFlat({ ring: true, rest: false, window: T.RING_WINDOW }), rest = b.buildFlat({ ring: false, rest: true }), caps = [true, false].map(n => b.buildCap(n)); return { ms: Date.now() - t, chunks: [...ring, ...rest], caps }; };
const mo = build(TOLD, OLD), mn = build(TERRAIN, NEW);
const inTown = (W, lon, lat) => lon >= W.TOWN_PATCH.lonMin - 1e-9 && lon <= W.TOWN_PATCH.lonMax + 1e-9 && lat >= W.TOWN_PATCH.latMin - 1e-9 && lat <= W.TOWN_PATCH.latMax + 1e-9;
const signatures = (chunks, W, omitTown) => {
  const out = new Set(); let town = 0;
  for (const c of chunks) for (const ix of [c.ringIndex, c.restIndex]) if (ix) for (let t = 0; t < ix.length; t += 3) {
    const ids = [ix[t], ix[t + 1], ix[t + 2]], inside = ids.every(i => inTown(W, c.lonlat[i * 2], c.lonlat[i * 2 + 1]));
    if (inside) town++; if (omitTown && inside) continue;
    const v = ids.map(i => [c.lonlat[i * 2], c.lonlat[i * 2 + 1], c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2], c.nrm[i * 3], c.nrm[i * 3 + 1], c.nrm[i * 3 + 2], c.col[i * 3], c.col[i * 3 + 1], c.col[i * 3 + 2]]);
    v.sort((a, b) => a[0] - b[0] || a[1] - b[1]); out.add(JSON.stringify(v));
  }
  return { out, town };
};
const oldMesh = signatures(mo.chunks, OLD, true), newMesh = signatures(mn.chunks, NEW, true), meshFail = [];
for (const key of oldMesh.out) if (!newMesh.out.has(key)) meshFail.push('旧三角面在城镇外缺失或改变');
for (const key of newMesh.out) if (!oldMesh.out.has(key)) meshFail.push('城镇外出现非 W10d 三角面变化');
let capsFail = [];
mo.caps.forEach((c, k) => { for (const key of ['pos', 'nrm', 'col', 'index', 'lonlat', 'alt']) if (!eqArr(c[key], mn.caps[k][key])) capsFail.push(`cap ${k} ${key}`); });
console.log(`${meshFail.length ? 'FAIL' : 'PASS'} 城镇外地形三角面（${oldMesh.out.size} 个）与 ${ref} 逐三角逐属性相同${meshFail.length ? '：' + meshFail.slice(0, 4).join('；') : ''}`);
console.log(`${oldMesh.town === 0 && newMesh.town > 0 ? 'PASS' : 'FAIL'} 连续城镇平原三角面：${ref} ${oldMesh.town}，当前 ${newMesh.town}（只新增城镇补丁内三角面）`);
console.log(`${capsFail.length ? 'FAIL' : 'PASS'} 两极帽数据${capsFail.length ? '：' + capsFail.join('；') : '逐数组逐位相同'}；构建 ${ref} ${mo.ms} ms，当前 ${mn.ms} ms`);
// ---- A3: the rest built row by row (W8g-a stepped build) and the lazy sampler, against the global rest and the global sampler index of the current terrain.js
const B2 = TERRAIN.builder(NEW), ringN = B2.buildFlat({ ring: true, rest: false, window: TERRAIN.RING_WINDOW }), rows = [];
for (let cy = 0; cy < 12; cy++) rows.push(...B2.buildRestRow(cy));
const restO = mn.chunks.slice(mn.chunks.length - rows.length), rowFail = [];
if (restO.length !== rows.length || mn.chunks.length !== ringN.length + rows.length) rowFail.push(`chunks ${restO.length} / ${rows.length}`);
rows.forEach((c, k) => { const d = restO[k]; if (!d || d.cx !== c.cx || d.cy !== c.cy) { rowFail.push(`chunk ${k} key`); return; } for (const key of ['pos', 'nrm', 'col', 'lonlat', 'alt', 'ringIndex', 'restIndex']) if (!eqArr(c[key], d[key])) rowFail.push(`chunk ${k} (${c.cx},${c.cy}) ${key}`); });
console.log(`${rowFail.length ? 'FAIL' : 'PASS'} 按行构建的 rest（${rows.length} 块）与一次全球构建逐数组逐位相同${rowFail.length ? '：' + rowFail.slice(0, 6).join('；') : ''}`);
const tg = Date.now(), globalS = TERRAIN.samplerFromChunks(NEW, mn.chunks), tgMs = Date.now() - tg;
const B3 = TERRAIN.builder(NEW), ringL = B3.buildFlat({ ring: true, rest: false, window: TERRAIN.RING_WINDOW }), made = new Map();
const restChunks = keys => { const miss = keys.filter(k => !made.has(k)); if (miss.length) { for (const k of miss) made.set(k, null); for (const c of B3.buildRestChunks(miss)) made.set(c.cy * 24 + c.cx, c); } return keys.slice().sort((a, b) => a - b).map(k => made.get(k)).filter(Boolean); };
const tl = Date.now(), lazyS = TERRAIN.lazySampler(NEW, B3.samplerCell); void restChunks; void ringL;
const nearTown = lazyS(3, -40); const firstMs = Date.now() - tl;
const sFail = [];
pts.forEach(([lon, lat], i) => { if (lat > 89.999 || lat < -89.999) return; const a = globalS(lon, lat), b = lazyS(lon, lat); if (!same(a, b)) sFail.push({ i, lon, lat, global: a, lazy: b }); });
console.log(`${sFail.length ? 'FAIL' : 'PASS'} 懒构建采样器与全球采样器逐位相同：${nPts} 点${sFail.length ? `中 ${sFail.length} 处不同，例 ${JSON.stringify(sFail.slice(0, 3))}` : ''}；城镇外第一次查询 ${firstMs} ms（全球索引需先建 rest，再建索引 ${tgMs} ms）；样例 ${nearTown}`);
fs.rmSync(tmp, { recursive: true, force: true });
process.exitCode = Object.values(fails).some(l => l.length) || meshFail.length || capsFail.length || oldMesh.town !== 0 || newMesh.town === 0 || rowFail.length || sFail.length ? 1 : 0;
