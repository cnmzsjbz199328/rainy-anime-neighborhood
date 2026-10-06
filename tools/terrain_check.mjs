// Checks W3-C1..C6 for the terrain mesh (W3). Run: node tools/terrain_check.mjs
// Pure data checks under Node: terrain.js builds the mesh from world.js, nothing is rendered here.
// (W3-C7, the pixel regression, is tools/regress.mjs --baseline-ref pre-w3 --mask-patch-margin 24.)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const W = require(path.join(root, 'world.js'));
const T = require(path.join(root, 'terrain.js'));
const D = Math.PI / 180, R = 90, BASE = 1.6, AREA = 4 * Math.PI * R * R, P = W.TOWN_PATCH;
const t0 = Date.now();
const results = [];
const f = (v, n = 3) => v.toFixed(n);
function check(id, title, fn) {
  const info = [], fails = [];
  fn({ info: m => info.push(m), fail: m => fails.push(m) });
  results.push({ id, ok: !fails.length });
  console.log(`${fails.length ? 'FAIL' : 'PASS'} ${id} ${title}`);
  for (const m of fails) console.log('  ✗ ' + m);
  for (const m of info) console.log('  · ' + m);
}

const B = T.builder(W);
const tb = Date.now();
const chunks = B.buildFlat({ ring: true, rest: true });
const caps = [B.buildCap(true), B.buildCap(false)];
const stubs = B.buildStubs();
const buildMs = Date.now() - tb;

// flat list of triangles with lon/lat/alt of their vertices
const tris = [];
for (const c of chunks) for (const [idx, ring] of [[c.ringIndex, true], [c.restIndex, false]]) if (idx) for (let t = 0; t < idx.length; t += 3) {
  const v = [idx[t], idx[t + 1], idx[t + 2]].map(i => ({ lon: c.lonlat[i * 2], lat: c.lonlat[i * 2 + 1], h: c.alt[i], x: c.pos[i * 3], y: c.pos[i * 3 + 1], z: c.pos[i * 3 + 2], i, c }));
  tris.push({ v, ring, c });
}
// chord-based spherical area of a small triangle (metres squared on the sphere of radius R)
const unit = (lon, lat) => [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
const triArea = v => {
  const a = unit(v[0].lon, v[0].lat), b = unit(v[1].lon, v[1].lat), c = unit(v[2].lon, v[2].lat);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return 0.5 * Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) * R * R;
};
const totalVerts = chunks.reduce((s, c) => s + c.vertexCount, 0) + caps.reduce((s, c) => s + c.vertexCount, 0);
const ringTris = tris.filter(t => t.ring).length, restTris = tris.length - ringTris, capTris = caps.reduce((s, c) => s + c.index.length / 3, 0);

check('W3-C0', '网格规模在预算内（≤ 90k 三角形、≤ 50k 顶点；环内 ≤ 12k 三角形）', ({ info, fail }) => {
  info(`地形块 ${chunks.length}，环内三角形 ${ringTris}，其余三角形 ${restTris}，极帽 ${capTris}，合计 ${ringTris + restTris + capTris} 个三角形、${totalVerts} 个顶点（含块边界重复）；出口起点 ${stubs.length} 条 ${stubs.reduce((s, q) => s + q.index.length / 3, 0)} 个三角形；构建 ${buildMs} ms（Node）`);
  if (ringTris + restTris + capTris > 90000) fail('三角形超过 90k');
  if (totalVerts > 50000) fail('顶点超过 50k');
  if (ringTris > 12000) fail('环内三角形超过 12k');
});

// ---- W3-C1: heights
check('W3-C1', '高度一致：顶点 y_flat·cos φ = height − 1.6；确定性随机点上网格内插与 height() 的偏差在容差内', ({ info, fail }) => {
  let worst = 0, n = 0;
  for (const c of chunks) for (let i = 0; i < c.vertexCount; i++) {
    const s = Math.cos(c.lonlat[i * 2 + 1] * D), e = Math.abs(c.pos[i * 3 + 1] * s - (c.alt[i] - BASE));
    if (e > worst) worst = e; n++;
  }
  info(`${n} 个顶点，|y_flat·cos φ − (h − 1.6)| 最大 ${worst.toExponential(2)} m`);
  if (worst >= 0.001) fail(`顶点高度偏差 ${worst} ≥ 0.001 m`);
  // random points
  let seed = 123456789; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const byChunk = new Map();
  for (const t of tris) { const key = t.c.cy * 24 + t.c.cx; (byChunk.get(key) || byChunk.set(key, []).get(key)).push(t); }
  let low = 0, high = 0, worstLow = 0, worstHigh = 0, miss = 0, over = 0, wl = '', wh = '', ow = '', coastN = 0, coastWorst = 0;
  for (let k = 0; k < 5000; k++) {
    const lon = -180 + rnd() * 360, lat = -84 + rnd() * 168;
    if (B.inPatch(lon, lat)) continue;
    const cx = Math.min(23, Math.floor((lon + 180) / 15)), cy = Math.min(11, Math.floor((lat + 90) / 15));
    let found = null;
    for (let dy = -1; dy <= 1 && !found; dy++) for (let dx = -1; dx <= 1 && !found; dx++) {
      const list = byChunk.get((cy + dy) * 24 + ((cx + dx + 24) % 24)); if (!list) continue;
      for (const t of list) {
        const [a, b, c] = t.v, d = (b.lat - c.lat) * (a.lon - c.lon) + (c.lon - b.lon) * (a.lat - c.lat);
        if (Math.abs(d) < 1e-12) continue;
        const w1 = ((b.lat - c.lat) * (lon - c.lon) + (c.lon - b.lon) * (lat - c.lat)) / d, w2 = ((c.lat - a.lat) * (lon - c.lon) + (a.lon - c.lon) * (lat - c.lat)) / d, w3 = 1 - w1 - w2;
        if (w1 >= -1e-9 && w2 >= -1e-9 && w3 >= -1e-9) { found = { h: w1 * a.h + w2 * b.h + w3 * c.h }; break; }
      }
    }
    if (!found) { miss++; continue; }
    // linear interpolation error is at most (e^2 / 8) |f''|; f'' is the largest 1 m second difference over four directions
    const h0 = W.height(lon, lat), cs = Math.cos(lat * D), m1 = 1 / (R * D);
    let curv = 0;
    for (const [de, dn] of [[1, 0], [0, 1], [0.7071, 0.7071], [0.7071, -0.7071]]) {
      const a = W.height(lon + de * m1 / cs, lat + dn * m1), b = W.height(lon - de * m1 / cs, lat - dn * m1);
      curv = Math.max(curv, Math.abs(a - 2 * h0 + b));
    }
    const bound = (1.5708 ** 2 / 8) * curv * 3 + 0.02, err = Math.abs(found.h - h0), coast = Math.abs(W.coastDistance(lon, lat)) <= 3;   // the coast height jitters ~0.1 m on the 0.78 m grid of the signed-distance field
    if (coast) { coastN++; coastWorst = Math.max(coastWorst, err); }
    else if (curv <= 0.1) { low++; if (err > worstLow) { worstLow = err; wl = `(${f(lat, 2)}, ${f(lon, 2)})`; } } else { high++; if (err > worstHigh) { worstHigh = err; wh = `(${f(lat, 2)}, ${f(lon, 2)})`; } }
    if (!coast && err > bound) { over++; if (!ow) ow = `(${f(lat, 2)}, ${f(lon, 2)}) 偏差 ${f(err)} > 界 ${f(bound)}`; }
  }
  info(`随机点：二阶差分 ≤ 0.1 m 的平缓处 ${low} 个，最大偏差 ${f(worstLow)} m ${wl}（容差 0.06）；曲率更大的 ${high} 个（山脊、峰、滩坡），最大偏差 ${f(worstHigh)} m ${wh}；超出曲率界 (e²/8)·|f''|·3 + 0.02 的 ${over} 个${ow ? '，例 ' + ow : ''}；海岸线 3 m 内的 ${coastN} 个单列，最大偏差 ${f(coastWorst)} m（容差 0.15）；落在补丁内或极帽的未命中 ${miss}`);
  if (coastWorst > 0.15) fail(`海岸 3 m 内偏差 ${coastWorst} > 0.15 m`);
  if (worstLow > 0.06) fail(`平缓处偏差 ${worstLow} > 0.06 m`);
  if (over) fail(`${over} 个点超出曲率界`);
});

// ---- W3-C2: areas
check('W3-C2', '面积一致：总面积 = 4πR²(−85°..85°) − 补丁面积；四类面积与 WC1 的栅格相差 ≤ 0.2 个百分点', ({ info, fail }) => {
  let total = 0; const zone = { building: 0, ocean: 0, wild: 0, ice: 0 };
  for (const t of tris) { const a = triArea(t.v), lon = (t.v[0].lon + t.v[1].lon + t.v[2].lon) / 3, lat = (t.v[0].lat + t.v[1].lat + t.v[2].lat) / 3; total += a; zone[W.regionAt(lon, lat).zone] += a; }
  const band = 4 * Math.PI * R * R * Math.sin(85 * D), patch = R * R * (2 * P.lonMax * D) * (2 * Math.sin(P.latMax * D)), expect = band - patch;
  info(`网格总面积 ${f(total, 0)} m²，期望 ${f(expect, 0)} m²（纬度带 ${f(band, 0)} − 补丁 ${f(patch, 0)}），相差 ${f((total / expect - 1) * 100, 3)}%`);
  if (Math.abs(total / expect - 1) > 0.005) fail('总面积偏差 > 0.5%');
  // raster expectation over the same domain
  const ras = W.zoneRaster(0.25), want = { building: 0, ocean: 0, wild: 0, ice: 0 };
  for (let y = 0; y < ras.ny; y++) { const lat = -90 + (y + 0.5) * ras.gridDeg; if (Math.abs(lat) > 85) continue; for (let x = 0; x < ras.nx; x++) { const lon = -180 + (x + 0.5) * ras.gridDeg; if (B.inPatch(lon, lat)) continue; const i = ras.cell[y * ras.nx + x], r = i ? W.regions[i - 1] : { zone: 'wild' }; want[r.zone] += Math.cos(lat * D) * (ras.gridDeg * D) ** 2 * R * R; } }
  for (const z of Object.keys(zone)) {
    const d = (zone[z] - want[z]) / AREA * 100;
    info(`${z}：网格 ${f(zone[z], 0)} m²，栅格 ${f(want[z], 0)} m²，相差 ${f(d, 3)} 个百分点`);
    if (Math.abs(d) > 0.2) fail(`${z} 面积相差 ${f(d, 3)} 个百分点 > 0.2`);
  }
});

// ---- W3-C3: peak
check('W3-C3', '峰值：最高顶点 26.00 m 在雨见岳锚点；其余山脊 ≤ 22.5 m', ({ info, fail }) => {
  const lm = W.landmarks.find(l => l.id === 'LM01'); let top = { h: -Infinity }, other = { h: -Infinity };
  for (const c of chunks) for (let i = 0; i < c.vertexCount; i++) {
    const h = c.alt[i], p = { lon: c.lonlat[i * 2], lat: c.lonlat[i * 2 + 1] };
    if (h > top.h) top = { h, ...p };
    if (W.arcDistance(p, lm) > 36 && h > other.h) other = { h, ...p };
  }
  const d = W.arcDistance(top, lm);
  let anchorH = null, farHigh = 0, nHigh = 0;
  for (const c of chunks) for (let i = 0; i < c.vertexCount; i++) {
    const lon = c.lonlat[i * 2], lat = c.lonlat[i * 2 + 1];
    if (lon === lm.lon && lat === lm.lat) anchorH = c.alt[i];
    if (c.alt[i] >= 25.99) { nHigh++; farHigh = Math.max(farHigh, W.arcDistance({ lon, lat }, lm)); }
  }
  info(`最高顶点 ${f(top.h, 3)} m（${f(top.lat, 2)}°, ${f(top.lon, 2)}°，在山顶平台内，距锚点 ${f(d, 2)} m）；锚点顶点高 ${anchorH === null ? '无' : f(anchorH, 3)} m；≥ 25.99 m 的顶点 ${nHigh} 个，最远距锚点 ${f(farHigh, 2)} m；其余最高 ${f(other.h, 2)} m`);
  if (anchorH === null) fail('雨见岳锚点不是顶点');
  else if (anchorH < top.h - 0.01) fail(`锚点顶点 ${anchorH} 比最高顶点 ${top.h} 低 > 0.01`);
  if (Math.abs(top.h - 26) > 0.1) fail(`最高顶点 ${top.h} 不是 26.00 ± 0.1`);
  if (farHigh > 6) fail(`≥ 25.99 m 的顶点离锚点 ${farHigh} > 6 m`);
  if (other.h > 22.5) fail(`其余山脊 ${other.h} > 22.5`);
});

// ---- W3-C4: seams
check('W3-C4', '无缝：块边界顶点位置与法线逐位相同；内部边都配对；经度 ±180° 两排顶点在 uBend = 1 时重合', ({ info, fail }) => {
  const key = (lon, lat) => `${Math.round(lon * 1e7)},${Math.round(lat * 1e7)}`;
  const first = new Map(); let dup = 0, bad = 0;
  for (const c of chunks) for (let i = 0; i < c.vertexCount; i++) {
    const k = key(c.lonlat[i * 2], c.lonlat[i * 2 + 1]), rec = [c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2], c.nrm[i * 3], c.nrm[i * 3 + 1], c.nrm[i * 3 + 2]];
    const g = first.get(k); if (!g) { first.set(k, rec); continue; }
    dup++; if (g.some((v, j) => v !== rec[j])) bad++;
  }
  info(`${first.size} 个不同位置，${dup} 个跨块重复顶点，位置或法线不同 ${bad} 个`);
  if (bad) fail(`${bad} 个重复顶点不一致`);
  // edge pairing on lon/lat keys (lon -180 and 180 are the same meridian)
  const kk = (lon, lat) => key(lon === 180 ? -180 : lon, lat), edges = new Map();
  for (const t of tris) for (let e = 0; e < 3; e++) {
    const a = t.v[e], b = t.v[(e + 1) % 3], ka = kk(a.lon, a.lat), kb = kk(b.lon, b.lat), ek = ka < kb ? ka + '|' + kb : kb + '|' + ka;
    edges.set(ek, (edges.get(ek) || 0) + 1);
  }
  let single = 0, many = 0, strayAt = '';
  for (const [ek, n] of edges) {
    if (n > 2) many++;
    if (n === 1) {
      const [a, b] = ek.split('|').map(s => s.split(',').map(v => +v / 1e7));
      const onPatch = (p, q) => (Math.abs(Math.abs(p[0]) - P.lonMax) < 1e-6 && Math.abs(Math.abs(q[0]) - P.lonMax) < 1e-6 && Math.abs(p[1]) <= P.latMax + 1e-6 && Math.abs(q[1]) <= P.latMax + 1e-6) || (Math.abs(Math.abs(p[1]) - P.latMax) < 1e-6 && Math.abs(Math.abs(q[1]) - P.latMax) < 1e-6 && Math.abs(p[0]) <= P.lonMax + 1e-6 && Math.abs(q[0]) <= P.lonMax + 1e-6);
      const onEdge85 = Math.abs(Math.abs(a[1]) - 85) < 1e-6 && Math.abs(Math.abs(b[1]) - 85) < 1e-6;
      if (!onPatch(a, b) && !onEdge85) { single++; if (!strayAt) strayAt = `(${a[1]}, ${a[0]})–(${b[1]}, ${b[0]})`; }
    }
  }
  info(`三角形边 ${edges.size} 条；只属于一个三角形的边（除补丁边线与 ±85° 外沿）${single} 条${strayAt ? '，例 ' + strayAt : ''}；被三个以上三角形共用 ${many} 条`);
  if (single) fail(`${single} 条内部边没有配对（裂缝）`);
  if (many) fail(`${many} 条边被三个以上三角形共用`);
  // antimeridian: bent positions of the -180 and +180 vertices of the same ring
  const bend = (x, y, z) => { const tz = z / R, lam = x / R, phi = -Math.atan(Math.sinh(tz)), s = 1 / Math.cosh(tz), k = R + y * s; return [k * Math.cos(phi) * Math.sin(lam), -R + k * Math.cos(phi) * Math.cos(lam), -k * Math.sin(phi)]; };
  let seam = 0, pairs = 0; const west = new Map(), east = new Map();
  for (const c of chunks) for (let i = 0; i < c.vertexCount; i++) {
    const lon = c.lonlat[i * 2], lat = c.lonlat[i * 2 + 1];
    if (lon === -180) west.set(lat, [c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2]]); else if (lon === 180) east.set(lat, [c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2]]);
  }
  for (const [lat, w] of west) { const e = east.get(lat); if (!e) continue; pairs++; const a = bend(...w), b = bend(...e); seam = Math.max(seam, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); }
  info(`经度接缝：${pairs} 对顶点，uBend = 1 时最大间距 ${seam.toExponential(2)} m`);
  if (!pairs || seam > 1e-3) fail(`接缝间距 ${seam} > 1e-3 m 或没有配对`);
  // caps meet the flat mesh at 85 degrees
  let capGap = 0, capPairs = 0;
  for (const cap of caps) for (let i = 0; i < cap.vertexCount; i++) {
    const lon = cap.lonlat[i * 2], lat = cap.lonlat[i * 2 + 1]; if (Math.abs(Math.abs(lat) - 85) > 1e-9) continue;
    for (const c of chunks) for (let j = 0; j < c.vertexCount; j++) if (c.lonlat[j * 2] === lon && c.lonlat[j * 2 + 1] === lat) { const b = bend(c.pos[j * 3], c.pos[j * 3 + 1], c.pos[j * 3 + 2]); capGap = Math.max(capGap, Math.hypot(b[0] - cap.pos[i * 3], b[1] - cap.pos[i * 3 + 1], b[2] - cap.pos[i * 3 + 2])); capPairs++; break; }
  }
  info(`极帽外沿与平面网格 85° 环：${capPairs} 对顶点，uBend = 1 时最大间距 ${capGap.toExponential(2)} m`);
  if (!capPairs || capGap > 1e-3) fail(`极帽与网格间距 ${capGap} > 1e-3 m`);
});

// ---- W3-C5: town edge
check('W3-C5', '城镇边缘：补丁边界顶点在边线上、高度 1.6；补丁外 15 m 内偏差与坡度达标；底座侧面被地形遮住', ({ info, fail }) => {
  let nb = 0, offLine = 0, offH = 0;
  for (const c of chunks) for (let i = 0; i < c.vertexCount; i++) {
    const lon = c.lonlat[i * 2], lat = c.lonlat[i * 2 + 1], onLon = Math.abs(Math.abs(lon) - P.lonMax) < 1e-9 && Math.abs(lat) <= P.latMax + 1e-9, onLat = Math.abs(Math.abs(lat) - P.latMax) < 1e-9 && Math.abs(lon) <= P.lonMax + 1e-9;
    if (!onLon && !onLat) continue;
    nb++;
    const x = c.pos[i * 3], z = c.pos[i * 3 + 2];
    const dx = onLon ? Math.abs(Math.abs(x) - 48) : 0, dz = onLat ? Math.abs(Math.abs(z) - 48) : 0;
    if (Math.max(dx, dz) > 0.01) offLine++;
    if (Math.abs(c.alt[i] - 1.6) > 0.001) offH++;
  }
  info(`补丁边界顶点 ${nb} 个；偏离边线 > 0.01 m 的 ${offLine} 个；高度偏离 1.6 > 0.001 的 ${offH} 个`);
  if (!nb || offLine || offH) fail('补丁边界顶点不在边线上或高度不是 1.6');
  // 15 m band: height deviation per vertex, slope per facet (metres on the sphere)
  let worstDev = -Infinity, worstSlope = 0, nv = 0, nf = 0, minRing = Infinity;
  for (const t of tris) {
    const cl = (t.v[0].lon + t.v[1].lon + t.v[2].lon) / 3, ct = (t.v[0].lat + t.v[1].lat + t.v[2].lat) / 3, d = W.townPatchDistance(cl, ct);
    if (d > 15) continue;
    for (const v of t.v) if (W.townPatchDistance(v.lon, v.lat) <= 15 && v.h < minRing) minRing = v.h;
    for (const v of t.v) { const dv = W.townPatchDistance(v.lon, v.lat); if (dv <= 15) { nv++; worstDev = Math.max(worstDev, Math.abs(v.h - 1.6) - 0.05 * dv); } }
    // facet slope in local metres (east, north)
    const lat0 = ct * D, m = v => [(v.lon - cl) * D * R * Math.cos(lat0), (v.lat - ct) * D * R, v.h];
    const [a, b, c] = t.v.map(m), ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; if (Math.abs(nz) < 1e-12) continue;
    const slope = Math.hypot(nx, ny) / Math.abs(nz); nf++; if (slope > worstSlope) worstSlope = slope;
  }
  info(`补丁外 15 m 内：${nv} 个顶点 max(|h−1.6| − 0.05d) = ${f(worstDev)} m（须 ≤ 0.05）；${nf} 个三角面最大坡度 ${f(worstSlope * 100, 2)}%（须 ≤ 5%）`);
  if (worstDev > 0.05) fail(`高度偏差 ${worstDev} > 0.05`);
  if (worstSlope > 0.05) fail(`三角面坡度 ${worstSlope} > 5%`);
  info(`补丁外 15 m 内最低顶点海拔 ${f(minRing, 3)} m（底座侧面在海拔 [0, 1.6] 即 y ∈ [−1.6, 0]；该带内地形不低于 1.6 时侧面被遮住）`);
  if (minRing < 1.6 - 0.02) fail(`补丁外 15 m 内有顶点低于 1.6 m：${minRing}，底座侧面可能外露`);
});

// ---- W3-C6: exit starts
check('W3-C6', '9 个出口起点：首点在出口节点上、贴地 0.02 m、宽度与等级一致、不进入补丁', ({ info, fail }) => {
  const want = { RD01: 9, RD03: 4.5, RD05: 3 }, ids = new Set();
  for (const s of stubs) {
    ids.add(s.exit);
    const node = W.roadNetwork.nodeById[s.exit], p0 = s.samples[0], d0 = W.arcDistance({ lon: p0.lon, lat: p0.lat }, node);
    let lift = 0, wErr = 0, inside = 0;
    s.samples.forEach((p, k) => {
      const c = Math.cos(p.lat * D); lift = Math.max(lift, Math.abs(p.y * c - (p.h - BASE) - 0.02));
      const L = [s.pos[k * 6], s.pos[k * 6 + 2]], Rr = [s.pos[k * 6 + 3], s.pos[k * 6 + 5]];
      wErr = Math.max(wErr, Math.abs(Math.hypot(L[0] - Rr[0], L[1] - Rr[1]) * c - want[s.class]));
      if (k > 0 && B.inPatch(p.lon, p.lat) && W.townPatchDistance(p.lon, p.lat) === 0 && Math.abs(Math.abs(p.lon) - P.lonMax) > 1e-9 && Math.abs(Math.abs(p.lat) - P.latMax) > 1e-9) inside++;
    });
    info(`${s.exit}（${s.edge} ${s.class}）：长 ${f(s.length, 1)} m，首点距出口 ${f(d0, 4)} m，贴地抬高误差 ${lift.toExponential(1)} m，宽度误差 ${wErr.toExponential(1)} m`);
    if (d0 > 0.05) fail(`${s.exit} 首点距出口 ${d0} > 0.05 m`);
    if (lift > 1e-4) fail(`${s.exit} 贴地抬高不是 0.02 m`);
    if (wErr > 0.01) fail(`${s.exit} 宽度与 ${s.class} 不符`);
    if (inside) fail(`${s.exit} 有 ${inside} 个采样点进入补丁`);
  }
  if (ids.size !== 9) fail(`出口起点 ${ids.size} 条，应为 9`);
});

const failed = results.filter(r => !r.ok).length;
console.log(`${failed ? 'FAIL' : 'PASS'} terrain_check：${results.filter(r => r.ok).length}/${results.length} 项通过；用时 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failed ? 1 : 0);
