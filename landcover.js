// Land cover of the planet (W6): the ground systems laid over the W3 terrain mesh, driven only by world.js, the terrain lattice height and fixed seeds.
// Batch W6b (this file): BI05 paddies and dry fields, TR04 fallow fields, BI06 terraces with tea rows, TR01 town edges (fences along the patch edge), with the instanced
// small things of the fields (seedlings, racks, scarecrows, sheds, weeds). The same machinery (global instance table, 16 m tiles, loading around the camera) is used by
// the later rows (forest, grassland, desert, highland).
// Pure part: build(W, H, avoid) returns the data (no THREE, no DOM). Scene part: attach(...) makes the meshes the first time the planet is shown.
// Geometry is stored in flat Mercator coordinates (docs/world/W3_SPEC.md section 2) and rolled onto the sphere by bend.js; instances are scaled by 1/cos(lat).
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6, SEED = 6006;
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255].map(srgb);
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash = (a, b) => { let h = Math.imul(Math.round(a * 997), 374761393) ^ Math.imul(Math.round(b * 1313), 668265263) ^ Math.imul(SEED, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const flatOf = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) });
const llOf = (x, z) => ({ lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D });
const wrapLon = lon => { let l = ((lon + 180) % 360 + 360) % 360 - 180; return l === -180 ? 180 : l; };

// colours (night palette of WORLD_SPEC / BI05 / TR04, the same as the W4 section)
const COL = { dry: lin('#5d6b46'), dry2: lin('#6b7650'), fall: lin('#66744a'), fall2: lin('#7a7456'), water: lin('#25414f'), ridge: lin('#6a604e'), ridgeD: lin('#4a4238'), ridgeTop: lin('#7b7260'), tea: lin('#3f6a4e'), teaD: lin('#2f5a42'), wall: lin('#7a7780'), wallD: lin('#5c5a66'), tread: lin('#5a6e48'), treadTea: lin('#4c6a48') };
const FARM = new Set(['farmland']), VILLAGE = new Set(['village']);
const GROUP = r => (FARM.has(r.kind) ? 'farm' : VILLAGE.has(r.kind) ? 'village' : null);
const SP = { du: 7.2, dv: 6.2, ju: 2.2, jv: 1.8, ridgeHalf: 0.18, ridgeH: 0.2, fallowBand: 8 };

// ---- polygon helpers (flat plane)
function clipHalf(poly, px, pz, nx, nz, off) {         // keep the part where (p - P) . n <= off
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], da = (a[0] - px) * nx + (a[1] - pz) * nz - off, db = (b[0] - px) * nx + (b[1] - pz) * nz - off;
    if (da <= 0) out.push(a);
    if ((da < 0) !== (db < 0) && da !== db) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
const polyArea = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (((p[i][1] > z) !== (p[j][1] > z)) && (x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; return c; };

function build(W, H, ctx) {
  const avoid = ctx.avoid || [], corridor = ctx.corridor || null;
  const rnd = (a, b) => hash(a, b);
  // ---- seeds: rows every 6.2 true metres, a seed every 7.2 true metres along the row, jittered; the Voronoi cells of the seeds are the plots
  const seeds = []; const grid = new Map(), GS = 14, gkey = (x, z) => `${Math.floor(x / GS)},${Math.floor(z / GS)}`;
  { let lat = -64, row = 0; while (lat < 64) {
      const k = 1 / Math.cos(lat * D), dlat = SP.dv / (R * D); const dx = SP.du * k;
      const phase = (row % 2) * dx / 2;
      for (let x = -R * Math.PI + phase, i = 0; x < R * Math.PI; x += dx, i++) {
        const jx = (rnd(row * 31 + i, 1) - 0.5) * 2 * SP.ju * k, jz = (rnd(row * 31 + i, 2) - 0.5) * 2 * SP.jv * k;
        const sx = x + jx, sLat = lat + (rnd(row * 31 + i, 3) - 0.5) * 2 * SP.jv / (R * D), sz = -R * Math.asinh(Math.tan(sLat * D)), ll = llOf(sx, sz);
        const s = { id: seeds.length, x: sx, z: sz, lon: ll.lon, lat: ll.lat, k: 1 / Math.cos(ll.lat * D) };
        seeds.push(s); const key = gkey(sx, sz); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(s);
      }
      lat += dlat; row++;
    } }
  const neighbours = s => { const out = []; const r = Math.ceil(2.6 * SP.du * s.k / GS) + 1, gx = Math.floor(s.x / GS), gz = Math.floor(s.z / GS); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const l = grid.get(`${gx + a},${gz + b}`); if (l) for (const q of l) if (q !== s && Math.hypot(q.x - s.x, q.z - s.z) < 2.6 * SP.du * s.k) out.push(q); } return out; };
  const nearAvoid = (lon, lat, r) => avoid.some(a => { const dl = (a.lon - lon) * Math.cos(lat * D) * R * D, dt = (a.lat - lat) * R * D; return dl * dl + dt * dt < (a.r + r) * (a.r + r); });
  const farmAt = (lon, lat) => { const r = W.regionAt(lon, lat), g = GROUP(r); return g && W.height(lon, lat) > 0.5 ? g : null; };
  const inCorridor = (lon, lat) => corridor && corridor(lon, lat);
  // fallow: near the edge of the farmland (a non-farm region within 14 m), TR04
  const nearEdge = (lon, lat) => { for (let a = 0; a < 8; a++) for (const d of [3, 6, SP.fallowBand]) { const p = W.destination({ lon, lat }, a * 45, d); const r = W.regionAt(p.lon, p.lat); if (r.zone !== 'building') return true; } return false; };       // forest, grassland, sea or ice within 8 m (W4: the fallow band is 7.4 m wide)
  const cells = [], T = { tread: { pos: [], col: [], idx: [] }, ridge: { pos: [], col: [], idx: [] }, water: { pos: [], col: [], idx: [], shore: [] } };
  const pushV = (m, x, z, h, c) => { const k = 1 / Math.cos(llOf(x, z).lat * D); m.pos.push(x, (h - BASE) * k, z); m.col.push(c[0], c[1], c[2]); return m.pos.length / 3 - 1; };
  const stats = { cells: 0, water: 0, dry: 0, fallow: 0, village: 0, area: 0, skipped: 0, terraceCells: 0 };
  for (const s of seeds) {
    const g = farmAt(s.lon, s.lat); if (!g) continue;
    // the cell polygon: bisectors with the neighbouring seeds, then the same inset by the ridge half width
    let outer = [[s.x - 9 * s.k, s.z - 9 * s.k], [s.x + 9 * s.k, s.z - 9 * s.k], [s.x + 9 * s.k, s.z + 9 * s.k], [s.x - 9 * s.k, s.z + 9 * s.k]], inner = outer.slice();
    for (const n of neighbours(s)) { const dx = n.x - s.x, dz = n.z - s.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, mx = (s.x + n.x) / 2, mz = (s.z + n.z) / 2; outer = clipHalf(outer, mx, mz, ux, uz, 0); inner = clipHalf(inner, mx, mz, ux, uz, -SP.ridgeHalf * s.k); if (outer.length < 3 || inner.length < 3) break; }
    if (outer.length < 3 || inner.length < 3) continue;
    // the town patch (a rectangle |x|, |z| <= 48 in the flat frame) keeps a 3.4 m strip for TR01: a cell next to it is cut along the strip's outer edge
    { const P = W.TOWN_PATCH, X = R * P.lonMax * D, Zs = -R * Math.asinh(Math.tan(P.latMax * D)), Zn = -R * Math.asinh(Math.tan(P.latMin * D)), m = 3.4 * s.k;     // Zs < Zn
      const sides = [[1, 0, X + m - s.x], [-1, 0, s.x + X + m], [0, 1, s.z - (Zn + m)], [0, -1, (Zs - m) - s.z]];            // seed's margin from each side's outer edge (positive: outside that edge)
      if (Math.abs(s.x) < X + 6 * s.k + 8 && s.z > Zs - 14 * s.k && s.z < Zn + 14 * s.k || true) {
        const near = s.x > X - 14 * s.k ? 0 : s.x < -X + 14 * s.k ? 1 : null, nearZ = s.z > Zn - 14 * s.k ? 2 : s.z < Zs + 14 * s.k ? 3 : null;
        void sides; const cut = (p, ax) => { if (ax === 0) { p = clipHalf(p, X + m, 0, -1, 0, 0); } else if (ax === 1) { p = clipHalf(p, -X - m, 0, 1, 0, 0); } else if (ax === 2) { p = clipHalf(p, 0, Zn + m, 0, -1, 0); } else { p = clipHalf(p, 0, Zs - m, 0, 1, 0); } return p; };
        const inside = Math.abs(s.x) < X + 30 * s.k && s.z > Zs - 30 * s.k && s.z < Zn + 30 * s.k;
        if (inside) { const ax = [s.x - (X + m), -s.x - (X + m), s.z - (Zn + m), (Zs - m) - s.z]; const best = ax.indexOf(Math.max(...ax)); if (ax[best] > -4 * s.k) { outer = cut(outer, best); inner = cut(inner, best); } else if (W.townPatchDistance(s.lon, s.lat) < 20) continue; }
        void near; void nearZ;
      }
    }
    if (outer.length < 3 || inner.length < 3) continue;
    // every corner of the cell must be on dry land of the building belt (farmland, village), clear of roads and landmarks and of the W4 section's own corridor
    let ok = true; for (const p of outer) { const ll = llOf(p[0], p[1]), r = W.regionAt(ll.lon, ll.lat); const why = !(farmAt(ll.lon, ll.lat) === g || (r.zone === 'building' && r.kind !== 'town' && W.height(ll.lon, ll.lat) > 0.5)) ? 'region' : nearAvoid(ll.lon, ll.lat, 0.6) ? 'avoid' : inCorridor(ll.lon, ll.lat) ? 'corridor' : W.townPatchDistance(ll.lon, ll.lat) < 3.0 ? 'patch' : null; if (why) { ok = false; (stats.why = stats.why || {})[why] = ((stats.why || {})[why] || 0) + 1; break; } }
    if (!ok) { stats.skipped++; continue; }
    const areaTrue = Math.abs(polyArea(inner)) / (s.k * s.k); if (areaTrue < 3) continue;
    const kind = g === 'village' ? 'dry' : nearEdge(s.lon, s.lat) ? 'fallow' : rnd(s.id, 7) < 0.62 ? 'water' : 'dry';
    // heights: the lattice mesh under every vertex; the whole cell is levelled to its lowest corner + 0.04 (paddies are flat, the lattice differs by a few cm over a cell)
    const hv = ps => ps.map(p => { const ll = llOf(p[0], p[1]); return H(ll.lon, ll.lat); });
    const ho = hv(outer), hi = hv(inner), level = Math.max(...ho, ...hi), lowest = Math.min(...ho, ...hi);
    if (level - lowest > 0.8) { stats.steep = (stats.steep || 0) + 1; continue; }                    // a plot is level: ground that falls more than 0.8 m across it (ridge and hill flanks, the beach ramp) is not laid; up to 0.8 m is hidden by the earth skirt below
    const flatH = level;
    const cellId = cells.length, top = kind === 'water' ? flatH - 0.07 : kind === 'fallow' ? flatH + 0.01 : flatH + 0.03;
    const cc = kind === 'water' ? COL.water : kind === 'dry' ? (rnd(s.id, 11) > 0.5 ? COL.dry : COL.dry2) : (rnd(s.id, 13) > 0.5 ? COL.fall : COL.fall2);
    const cV = c => mix(c, [c[0] * 0.85, c[1] * 0.85, c[2] * 0.85], rnd(s.id, 17));
    // tread: a fan in two rings (centre, half way, inset polygon), levelled
    const m = T.tread, c0 = pushV(m, s.x, s.z, top, cV(cc)); const ringA = inner.map(p => pushV(m, s.x + (p[0] - s.x) * 0.5, s.z + (p[1] - s.z) * 0.5, top, cV(mix(cc, COL.ridge, 0.0)))), ringB = inner.map(p => pushV(m, p[0], p[1], top, mix(cV(cc), COL.ridge, kind === 'water' ? 0.18 : 0.1)));
    for (let i = 0; i < inner.length; i++) { const j = (i + 1) % inner.length; m.idx.push(c0, ringA[j], ringA[i], ringA[i], ringA[j], ringB[i], ringB[i], ringA[j], ringB[j]); }
    // ridges: a sloping band on the inner side of every cell edge up to the bisector line, 0.2 m high
    const r = T.ridge; const ro = outer.map(p => pushV(r, p[0], p[1], flatH + SP.ridgeH, mix(COL.ridge, COL.ridgeTop, 0.5 + 0.5 * Math.sin(p[0] * 7 + p[1] * 5)))), ri = inner.map(p => pushV(r, p[0], p[1], top, COL.ridge));
    // outer and inner polygons have a different vertex count when an edge is clipped away: connect each inner vertex to the nearest outer vertices by angle
    const ang = (p) => Math.atan2(p[1] - s.z, p[0] - s.x), ia = inner.map(ang), oa = outer.map(ang);
    const order = (arr) => arr.map((a, i) => ({ a, i })).sort((u, v) => u.a - v.a);
    const io = order(ia), oo = order(oa); let strip = [];
    for (const e of io) { let best = 0, bd = 9; oo.forEach((q, qi) => { let d = Math.abs(q.a - e.a); d = Math.min(d, 2 * Math.PI - d); if (d < bd) { bd = d; best = qi; } }); strip.push([e.i, oo[best].i]); }
    for (let i = 0; i < strip.length; i++) { const [a, ao] = strip[i], [b, bo] = strip[(i + 1) % strip.length]; r.idx.push(ri[a], ro[bo], ro[ao], ri[a], ri[b], ro[bo]); }
    // earth skirt: from the ridge top down to the terrain below each outer vertex (the bank of a level plot on a slope), only where the terrain is lower than the ridge
    { const sk = T.ridge; const tops = outer.map((p, i) => pushV(sk, p[0], p[1], flatH + SP.ridgeH, COL.ridge)), bots = outer.map((p, i) => { const ll = llOf(p[0], p[1]); return pushV(sk, p[0], p[1], Math.min(H(ll.lon, ll.lat), flatH + SP.ridgeH) - 0.06, COL.ridgeD); });
      for (let i = 0; i < outer.length; i++) { const j = (i + 1) % outer.length; sk.idx.push(tops[i], bots[i], tops[j], tops[j], bots[i], bots[j]); } }
    if (kind === 'water') { const w = T.water; const wc = pushV(w, s.x, s.z, flatH - 0.04, [0.12, 0.26, 0.34]); w.shore.push(9); const wr = inner.map(p => { const idx = pushV(w, p[0], p[1], flatH - 0.04, [0.12, 0.26, 0.34]); w.shore.push(9); return idx; }); for (let i = 0; i < inner.length; i++) w.idx.push(wc, wr[(i + 1) % inner.length], wr[i]); }
    cells.push({ id: cellId, seed: s, kind, outer, inner, top, flatH, area: areaTrue, group: g });
    stats.cells++; stats[kind]++; stats.area += areaTrue; if (g === 'village') stats.village++;
  }
  // ---- instances: seedlings in the paddies, racks / tufts / flowers on the ridges, scarecrows and sheds in the dry fields, weeds / shrubs / wrecks in the fallow fields
  const items = []; const put = (type, lon, lat, alt, o = {}) => items.push({ type, lon, lat, alt, yaw: o.yaw ?? rnd(lon * 91, lat * 77) * 6.283, s: o.s || [1, 1, 1], lean: o.lean || [0, 0], tint: o.tint || [1, 1, 1] });
  const tintOf = (a, b, k) => { const t = a + (b - a) * rnd(k, 5); return [t, t, t]; };
  for (const c of cells) {
    const s = c.seed, ax = c.inner.map(p => p[0]), az = c.inner.map(p => p[1]), x0 = Math.min(...ax), x1 = Math.max(...ax), z0 = Math.min(...az), z1 = Math.max(...az), k = s.k;
    const inside = (x, z, m) => inPoly(c.inner, x, z) && [[m, 0], [-m, 0], [0, m], [0, -m]].every(([a, b]) => inPoly(c.inner, x + a * k, z + b * k));
    if (c.kind === 'water') {
      for (let x = x0 + 0.3 * k; x < x1; x += 0.9 * k) for (let z = z0 + 0.3 * k; z < z1; z += 0.9 * k) { const jx = x + (rnd(x * 3, z * 5) - 0.5) * 0.2 * k, jz = z + (rnd(x * 7, z * 11) - 0.5) * 0.2 * k; if (!inside(jx, jz, 0.35)) continue; const ll = llOf(jx, jz); put('seedling', ll.lon, ll.lat, c.top - 0.0, { yaw: rnd(jx, jz) * 6.28, s: [1, 0.8 + 0.4 * rnd(jx * 2, jz), 1], tint: tintOf(0.9, 1.1, jx + jz) }); }
    } else if (c.kind === 'dry') {
      // dry crop rows: tufts in rows 0.7 m apart (low, sparse: the field reads as ploughed rows)
      for (let z = z0 + 0.4 * k; z < z1; z += 0.9 * k) for (let x = x0 + 0.3 * k; x < x1; x += 1.4 * k) { if (!inside(x, z, 0.3) || rnd(x * 13, z * 17) < 0.35) continue; const ll = llOf(x, z); put('tuft', ll.lon, ll.lat, c.top, { yaw: rnd(x, z) * 6.28, s: [0.7, 0.55 + 0.3 * rnd(x, z * 3), 0.7], tint: tintOf(0.8, 1.05, x * z) }); }
    } else {
      for (let z = z0 + 0.5 * k; z < z1; z += 1.6 * k) for (let x = x0 + 0.5 * k; x < x1; x += 1.6 * k) { const jx = x + (rnd(x, z) - 0.5) * 1.2 * k, jz = z + (rnd(x * 2, z) - 0.5) * 1.2 * k; if (!inside(jx, jz, 0.3) || rnd(jx * 5, jz * 3) < 0.45) continue; const ll = llOf(jx, jz); const t = rnd(jx * 7, jz * 9); put(t < 0.7 ? 'weed' : t < 0.92 ? 'tuft' : 'shrubLow', ll.lon, ll.lat, c.top, { yaw: rnd(jx, jz) * 6.28, s: t < 0.92 ? [1, 0.7 + 0.8 * rnd(jx, jz * 2), 1] : [0.8, 0.8 + 0.6 * rnd(jx, jz * 2), 0.8] }); }
    }
    // furniture: one rack on a ridge of about every third paddy, a scarecrow in some dry fields, a shed on the edge of some cells, wrecks in the fallow
    const h0 = rnd(s.id, 21), mid = llOf(s.x, s.z);
    if (c.kind === 'water' && h0 < 0.33) { const p = c.outer[Math.floor(rnd(s.id, 23) * c.outer.length)], ll = llOf(p[0], p[1]); put('rack', ll.lon, ll.lat, c.flatH + 0.2, { yaw: Math.atan2(p[0] - s.x, p[1] - s.z) + 1.57 }); }
    if (c.kind === 'dry' && h0 < 0.18) put('scarecrow', mid.lon, mid.lat, c.top, { yaw: rnd(s.id, 25) * 6.28 });
    if (c.kind === 'dry' && h0 > 0.93) { const p = c.outer[0], ll = llOf(s.x + (p[0] - s.x) * 0.55, s.z + (p[1] - s.z) * 0.55); put('hutFarm', ll.lon, ll.lat, c.top, { yaw: rnd(s.id, 27) * 6.28 }); }
    if (c.kind === 'fallow') { if (h0 < 0.12) put('hutRusty', mid.lon, mid.lat, c.top, { yaw: rnd(s.id, 29) * 6.28 }); else if (h0 < 0.2) put('oldMachine', mid.lon, mid.lat, c.top, { yaw: rnd(s.id, 31) * 6.28 }); else if (h0 < 0.34) put('rackFallen', mid.lon, mid.lat, c.top, { yaw: rnd(s.id, 33) * 6.28 }); }
    // weeds and flowers along the ridges
    for (let e = 0; e < c.outer.length; e++) { if (rnd(s.id * 7 + e, 35) > 0.5) continue; const a = c.outer[e], b = c.outer[(e + 1) % c.outer.length], t = rnd(s.id * 7 + e, 37), ll = llOf(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); put(rnd(s.id * 7 + e, 39) < 0.78 ? 'tuft' : 'flower', ll.lon, ll.lat, c.flatH + SP.ridgeH - 0.02, { s: [1, 0.9 + 0.5 * rnd(s.id, e), 1] }); }
  }
  // ---- TR01 town edge, all four sides of the patch: a gravel shoulder 1 m and a grass band 2.4 m wide along the edge (cut where a road leaves the patch and in the W4 corridor,
  // which has its own), and a bamboo fence every 2 m 3.9 m out (open where a road leaves)
  const edge = { pos: [], col: [], idx: [] }; const P = W.TOWN_PATCH, X = R * P.lonMax * D, Zs = -R * Math.asinh(Math.tan(P.latMax * D)), Zn = -R * Math.asinh(Math.tan(P.latMin * D));
  const exits = W.roadNetwork.nodes.filter(n => n.kind === 'town-exit').map(n => ({ ...flatOf(n.lon, n.lat), id: n.id }));
  const nearExit = (x, z, r) => exits.some(e => Math.hypot(x - e.x, z - e.z) < r * e.k);
  const sidesDef = [[[-X, Zs], [X, Zs], [0, -1]], [[X, Zs], [X, Zn], [1, 0]], [[X, Zn], [-X, Zn], [0, 1]], [[-X, Zn], [-X, Zs], [-1, 0]]];
  const offs = [[0, 0.03, COL.ridge], [0.1, 0.05, [0.6, 0.6, 0.65]], [0.9, 0.04, lin('#6a6458')], [1.0, 0.03, lin('#585349')], [1.1, 0, lin('#3f6a50')], [3.2, 0, lin('#4f7d5b')], [3.5, 0, lin('#3f6a50')]];
  for (const [a, b, nrm] of sidesDef) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(len), tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
    let prevRow = null;
    for (let i = 0; i <= n; i++) {
      const x = a[0] + tx * len * i / n, z = a[1] + tz * len * i / n, ll = llOf(x, z), k = flatOf(ll.lon, ll.lat).k;
      const skip = nearExit(x, z, 6) || (ctx.corridor && ctx.corridor(llOf(x + nrm[0] * 6, z + nrm[1] * 6).lon, llOf(x + nrm[0] * 6, z + nrm[1] * 6).lat));
      if (skip) { prevRow = null; continue; }
      const row = offs.map(([o, lift, c]) => { const px = x + nrm[0] * o * k, pz = z + nrm[1] * o * k, q = llOf(px, pz); return pushV(edge, px, pz, H(q.lon, q.lat) + lift, c); });
      if (prevRow) for (let j = 0; j + 1 < row.length; j++) edge.idx.push(prevRow[j], row[j], prevRow[j + 1], prevRow[j + 1], row[j], row[j + 1]);
      prevRow = row;
      if (i % 2 === 0 && i < n) { const fx = x + nrm[0] * 3.9 * k, fz = z + nrm[1] * 3.9 * k, fl = llOf(fx, fz); if (!nearAvoid(fl.lon, fl.lat, 1.0) && W.height(fl.lon, fl.lat) > 0.5) put('fenceBamboo', fl.lon, fl.lat, H(fl.lon, fl.lat), { yaw: Math.atan2(-tz, tx), lean: [0, (rnd(fx, fz) - 0.5) * 0.04], tint: tintOf(0.85, 1.05, fx + fz) }); }
    }
  }
  stats.fences = items.filter(i => i.type === 'fenceBamboo').length;
  return { seeds, cells, meshes: T, edge, items, stats };
}

const vnoise3 = (x, y, z, s) => { const X = x / s, Y = y / s, Z = z / s, i = Math.floor(X), j = Math.floor(Y), k = Math.floor(Z), fx = X - i, fy = Y - j, fz = Z - k, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz); const h = (a, b, c) => hash(a * 7 + c * 31 + 3, b * 13 + c * 17 + 5); const L = (a, b, t) => a + (b - a) * t; return L(L(L(h(i, j, k), h(i + 1, j, k), u), L(h(i, j + 1, k), h(i + 1, j + 1, k), u), v), L(L(h(i, j, k + 1), h(i + 1, j, k + 1), u), L(h(i, j + 1, k + 1), h(i + 1, j + 1, k + 1), u), v), w); };
// ---- generic region scatter for the ground-cover rows: jittered grid of true-metre cells over the sphere, noise helpers, distance to a region boundary by probing
const vnoise = (x, z, s) => { const X = x / s, Z = z / s, i = Math.floor(X), j = Math.floor(Z), fx = X - i, fz = Z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const h = (a, b) => hash(a * 7 + 3, b * 13 + 5); return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v; };
function scatterGrid(cell, latMax, fn) {            // calls fn(lon, lat, x, z, key) for a jittered grid with `cell` true metres between points
  let lat = -latMax, row = 0;
  while (lat < latMax) {
    const k = 1 / Math.cos(lat * D), dx = cell * k, dlat = cell / (R * D);
    for (let x = -R * Math.PI, i = 0; x < R * Math.PI; x += dx, i++) {
      const jx = (hash(row * 31 + i, 101) - 0.5) * dx, jl = lat + (hash(row * 31 + i, 103) - 0.5) * dlat, z = -R * Math.asinh(Math.tan(jl * D)), ll = llOf(x + jx, z);
      fn(ll.lon, ll.lat, x + jx, z, row * 100003 + i);
    }
    lat += dlat; row++;
  }
}
function edgeDistance(W, lon, lat, test, maxD) {      // metres to the nearest point where test(region) is false (8 directions, 2 m steps), maxD when none is found
  let best = maxD; for (let a = 0; a < 8; a++) for (let d = 2; d < best; d += 2) { const p = W.destination({ lon, lat }, a * 45 + 22.5, d); if (!test(W.regionAt(p.lon, p.lat))) { best = Math.min(best, d); break; } }
  return best;
}

// ---- BI02 forest and TR03 forest edge: four tree shapes by patch (cedar stands, broadleaf, pine, bamboo clumps), clearings, understory (shrubs, ferns, moss rocks, logs);
// the edge is a 5-10 m band of shrubs and saplings whose line wanders with noise; at most 0.27 trees per m2 (BI02 budget derivation, W6_SPEC 3.3)
function forest(W, H, ctx) {
  const avoid = ctx.avoid || [], corridor = ctx.corridor || null, items = [], stats = { trees: 0, shrubs: 0, ferns: 0, rocks: 0, logs: 0, saplings: 0, edgeShrubs: 0, area: 0, byRegion: {}, clearings: 0 };
  const nearAvoid = (lon, lat, r) => avoid.some(a => { const dl = (a.lon - lon) * Math.cos(lat * D) * R * D, dt = (a.lat - lat) * R * D; return dl * dl + dt * dt < (a.r + r) * (a.r + r); });
  const isForest = r => r.kind === 'forest', put = (type, lon, lat, alt, o = {}) => items.push({ type, lon, lat, alt, yaw: o.yaw ?? hash(lon * 91, lat * 77) * 6.283, s: o.s || [1, 1, 1], lean: o.lean || [0, 0], tint: o.tint || [1, 1, 1] });
  const tint = (a, b, k) => { const t = a + (b - a) * hash(k, 9), j = (hash(k, 11) - 0.5) * 0.08; return [t + j, t, t - j]; };
  const slopeAt = (lon, lat) => { const e = 1.0 / (R * D); return Math.hypot((H(lon + e / Math.cos(lat * D), lat) - H(lon - e / Math.cos(lat * D), lat)) / 2, (H(lon, lat + e) - H(lon, lat - e)) / 2); };
  scatterGrid(1.7, 75, (lon, lat, x, z, key) => {
    const reg = W.regionAt(lon, lat); if (!isForest(reg)) return;
    const h = H(lon, lat); if (h < 0.5 || nearAvoid(lon, lat, 1.2) || (corridor && corridor(lon, lat))) return;
    const e = edgeDistance(W, lon, lat, isForest, 12), wob = (vnoise(x, z, 7) - 0.5) * 5, ramp = Math.max(0, Math.min(1, (e + wob - 0.5) / 5.5)), ramp2 = ramp * ramp * (3 - 2 * ramp);
    const gap = vnoise(x + 311, z - 97, 13) > 0.8 && e > 6;      // a clearing: no trees, only understory
    if (gap) stats.clearings++;
    stats.byRegion[reg.id] = (stats.byRegion[reg.id] || 0) + 1;
    const patch = vnoise(x - 53, z + 17, 19), steep = slopeAt(lon, lat) > 1.3;
    if (!gap && !steep && hash(key, 1) < ramp2 * 0.8) {
      const type = patch < 0.3 ? 'cedar' : patch < 0.76 ? 'treeRound' : patch < 0.89 ? 'pine' : 'bamboo', sc = (type === 'bamboo' ? 0.85 + 0.3 * hash(key, 3) : 0.8 + 0.4 * hash(key, 3)) * (type === 'treeRound' && e < 8 ? 0.8 : 1);
      put(type, lon, lat, h, { s: [sc, sc * (0.9 + 0.2 * hash(key, 4)), sc], tint: tint(0.85, 1.12, key), lean: [(hash(key, 6) - 0.5) * 0.05, (hash(key, 7) - 0.5) * 0.05] }); stats.trees++;
    }
    // understory and the edge band
    if (e < 10 && hash(key, 21) < 0.8 * (1 - ramp2 * 0.55) && !steep) { put(hash(key, 22) < 0.7 ? 'shrub' : 'shrubLow', lon, lat, h, { s: [0.8 + 0.7 * hash(key, 23), 0.8 + 0.7 * hash(key, 24), 0.8 + 0.7 * hash(key, 23)], tint: tint(0.8, 1.15, key + 1) }); stats.edgeShrubs++; }
    else if (hash(key, 25) < 0.34) { put('shrub', lon, lat, h, { s: [0.7 + 0.7 * hash(key, 26), 0.7 + 0.7 * hash(key, 27), 0.7 + 0.7 * hash(key, 26)], tint: tint(0.75, 1.1, key + 2) }); stats.shrubs++; }
    if (e < 10 && e > 2 && hash(key, 31) < 0.16 && !steep) { const sc = 0.45 + 0.3 * hash(key, 32); put('treeRound', lon + 0.4 / (R * D), lat, H(lon + 0.4 / (R * D), lat), { s: [sc, sc, sc], tint: tint(0.9, 1.1, key + 3) }); stats.saplings++; }
    if (hash(key, 41) < 0.5 * (ramp2 > 0.2 ? 1 : 0.3)) { put('fern', lon + 0.6 / (R * D), lat + 0.4 / (R * D), H(lon + 0.6 / (R * D), lat + 0.4 / (R * D)), { s: [0.8 + 0.6 * hash(key, 42), 0.8 + 0.6 * hash(key, 43), 0.8 + 0.6 * hash(key, 42)] }); stats.ferns++; }
    if (hash(key, 51) < 0.045) { const sc = 0.7 + 0.8 * hash(key, 52); put(hash(key, 53) < 0.8 ? 'mossRock' : 'rock', lon, lat, h, { s: [sc, sc, sc] }); stats.rocks++; }
    if (hash(key, 61) < 0.008) { put(hash(key, 62) < 0.6 ? 'logMoss' : 'log', lon, lat, h, {}); stats.logs++; }
  });
  stats.area = Object.values(stats.byRegion).reduce((a, b) => a + b, 0) * 1.7 * 1.7;
  // forest edge line (aerial ink): every forest polygon boundary pushed inward by 3 +- 2.5 m of noise, 1.5 m segments
  const edgeLines = [];
  for (const r of W.regions.filter(q => q.kind === 'forest')) {
    const ring = r.shape.ring, pts = [];
    for (let i = 0; i < ring.length; i++) for (const p of W.greatCirclePoints(ring[i], ring[(i + 1) % ring.length], 1.5)) {
      const F = flatOf(p[0], p[1]), off = 3 + (vnoise(F.x, F.z, 6) - 0.5) * 5; let q = null;
      for (const sd of [90, 270]) { const brg = W.bearing({ lon: p[0], lat: p[1] }, { lon: ring[(i + 1) % ring.length][0], lat: ring[(i + 1) % ring.length][1] }), c = W.destination({ lon: p[0], lat: p[1] }, brg + sd, 2); if (isForest(W.regionAt(c.lon, c.lat))) { q = W.destination({ lon: p[0], lat: p[1] }, brg + sd, off); break; } }
      if (q && isForest(W.regionAt(q.lon, q.lat))) pts.push({ lon: q.lon, lat: q.lat, alt: H(q.lon, q.lat) + 0.12 }); else pts.push(null);
    }
    let run = []; for (const p of pts) { if (!p) { if (run.length > 1) edgeLines.push(run); run = []; } else run.push(p); } if (run.length > 1) edgeLines.push(run);
  }
  return { items, stats, edgeLines };
}

// ---- BI03 grassland, BI04 desert, TR07: grass tufts in patches (low saturation, dry yellow near the desert), wild flowers, rocks 0.5-2 m, lone trees, cairns beside the dirt tracks,
// dry shrubs and rock pillars in the desert; the dunes are a separate overlay mesh (dunes()) that never changes height()
function grassland(W, H, ctx) {
  const avoid = ctx.avoid || [], corridor = ctx.corridor || null, items = [], stats = { tufts: 0, flowers: 0, rocks: 0, bigRocks: 0, trees: 0, cairns: 0, area: 0, dryTufts: 0, shrubs: 0, pillars: 0, desertRocks: 0, desertArea: 0 };
  const nearAvoid = (lon, lat, r) => avoid.some(a => { const dl = (a.lon - lon) * Math.cos(lat * D) * R * D, dt = (a.lat - lat) * R * D; return dl * dl + dt * dt < (a.r + r) * (a.r + r); });
  const put = (type, lon, lat, alt, o = {}) => items.push({ type, lon, lat, alt, yaw: o.yaw ?? hash(lon * 91, lat * 77) * 6.283, s: o.s || [1, 1, 1], lean: o.lean || [0, 0], tint: o.tint || [1, 1, 1] });
  const tint = (a, b, k) => { const t = a + (b - a) * hash(k, 9), j = (hash(k, 11) - 0.5) * 0.06; return [t + j, t, t - j]; };
  const slopeAt = (lon, lat) => { const e = 1.0 / (R * D); return Math.hypot((H(lon + e / Math.cos(lat * D), lat) - H(lon - e / Math.cos(lat * D), lat)) / 2, (H(lon, lat + e) - H(lon, lat - e)) / 2); };
  const isGrass = r => r.kind === 'grassland', isDesert = r => r.kind === 'desert';
  scatterGrid(1.4, 75, (lon, lat, x, z, key) => {
    const reg = W.regionAt(lon, lat), gr = isGrass(reg), de = isDesert(reg); if (!gr && !de) return;
    const h = H(lon, lat); if (h < 0.5 || nearAvoid(lon, lat, 0.9) || (corridor && corridor(lon, lat))) return;
    const steep = slopeAt(lon, lat) > 0.8; if (steep) return;
    if (gr && W.coastDistance(lon, lat) < 3.5) return;                                       // the beach is sand, not grass
    if (gr) {
      stats.area += 1.4 * 1.4;
      const ed = edgeDistance(W, lon, lat, r => !isDesert(r), 20), dryness = Math.max(0, 1 - ed / 18);       // TR07: the grass thins and dries toward the desert over 10-20 m
      const patch = vnoise(x, z, 6), accept = (0.25 + 0.75 * Math.max(0, Math.min(1, (patch - 0.32) / 0.38))) * (1 - 0.8 * dryness) * 0.62;
      if (hash(key, 1) < accept) { const sc = 0.5 + 0.65 * hash(key, 2) * (1 - 0.4 * dryness), dry = dryness > 0.25 || hash(key, 3) < 0.12; put(dry ? 'weed' : 'tuft', lon, lat, h, { s: [sc, sc * (0.8 + 0.4 * hash(key, 4)), sc], tint: dry ? tint(0.95, 1.2, key) : tint(0.8, 1.1, key) }); stats.tufts++; if (dry) stats.dryTufts++; }
      if (hash(key, 5) < 0.018 * (1 - dryness)) { put('flower', lon, lat, h, { s: [1, 0.9 + 0.5 * hash(key, 6), 1] }); stats.flowers++; }
      if (hash(key, 7) < 0.0075) { const sc = 0.4 + 1.3 * Math.pow(hash(key, 8), 2), big = sc > 1.0; put(big ? 'rockBig' : 'rock', lon, lat, h - 0.1 * sc, { s: big ? [sc * 0.8, sc * 0.7, sc * 0.8] : [sc * 1.3, sc * 1.3, sc * 1.3], tint: tint(0.85, 1.1, key + 5) }); if (big) stats.bigRocks++; else stats.rocks++; }
      if (hash(key, 9) < 0.0009 && ed >= 20) { const sc = 0.9 + 0.5 * hash(key, 10); put('treeRound', lon, lat, h, { s: [sc, sc, sc] }); stats.trees++; }
    } else {
      stats.desertArea += 1.4 * 1.4;
      if (hash(key, 11) < 0.045) { const sc = 0.7 + 0.8 * hash(key, 12); put('dryShrub', lon, lat, h, { s: [sc, sc, sc], tint: tint(0.85, 1.15, key) }); stats.shrubs++; }
      if (hash(key, 13) < 0.006) { const sc = 0.4 + 0.9 * hash(key, 14); put('rock', lon, lat, h - 0.1, { s: [sc * 1.2, sc * 1.2, sc * 1.2], tint: tint(0.9, 1.15, key + 7) }); stats.desertRocks++; }
      if (hash(key, 15) < 0.0042) { const hh = 5 + 7 * hash(key, 16), w = 1.0 + 0.8 * hash(key, 17); put('rockPillar', lon, lat, h - 0.1, { s: [w, hh, w], tint: tint(0.9, 1.15, key + 9) }); stats.pillars++; }
    }
  });
  // cairns beside the dirt tracks of T07, T08, T09 (RD05) and T02/T05 country roads in grassland: every ~14 m on the left side
  for (const e of W.roadNetwork.edges.filter(q => ['RD05', 'RD03'].includes(q.class))) {
    const S = W.roadNetwork.samplePath(e, 0.5); for (let s = 9; s < S.length - 4; s += 28) { const p = S[s], r = W.regionAt(p.lon, p.lat); if (!isGrass(r) || hash(s, e.id.length * 7 + e.id.charCodeAt(4)) > 0.9) continue; const brg = W.bearing(S[s - 1], S[s + 1]), q = W.destination(p, brg - 90, e.class === 'RD05' ? 2.1 : 2.9); if (nearAvoid(q.lon, q.lat, 0.1) && false) continue; put('cairn', q.lon, q.lat, H(q.lon, q.lat), {}); stats.cairns++; }
  }
  return { items, stats };
}
// dune overlay (BI04): a grid of 0.7 m cells over the desert, each vertex raised by an isotropic dune field of up to 3 m (crest to trough), faded out toward the desert edge, the
// roads and the landmarks; sand-coloured with a ripple modulation; the terrain mesh and height() are untouched
function dunes(W, H, ctx) {
  const avoid = ctx.avoid || [], reg = W.regions.find(q => q.kind === 'desert'), ring = reg.shape.ring, step = 0.7;
  let lon0 = 1e9, lon1 = -1e9, lat0 = 1e9, lat1 = -1e9; for (const p of ring) { lon0 = Math.min(lon0, p[0]); lon1 = Math.max(lon1, p[0]); lat0 = Math.min(lat0, p[1]); lat1 = Math.max(lat1, p[1]); }
  const out = { pos: [], col: [], idx: [] }, vid = new Map(); let maxH = 0, minH = 0, cells = 0;
  const mesa = W.heightField.features.find(q => q.id === 'mesa-desert'), lm6 = W.landmarks.find(q => q.id === 'LM06'), monoP = lm6 ? W.destination({ lon: lm6.lon, lat: lm6.lat }, lm6.entrances[0].heading + 180, 25) : null;
  const SAND = lin('#8a8394'), SAND2 = lin('#9a8f98'), WET = lin('#6a6470');
  const maskAt = (lon, lat) => {
    const r = W.regionAt(lon, lat); if (!isDesertKind(r)) return 0;
    const ed = edgeDistance(W, lon, lat, isDesertKind, 8);
    let m = Math.max(0, Math.min(1, (ed - 1.0) / 6)); m = m * m * (3 - 2 * m);
    for (const a of avoid) { const dl = (a.lon - lon) * Math.cos(lat * D) * R * D, dt = (a.lat - lat) * R * D, d = Math.hypot(dl, dt) - a.r; if (d < 5) m *= Math.max(0, d / 5); if (m <= 0) return 0; }
    if (lm6) { const d = R * W.angleBetween(W.vec(lon, lat), W.vec(lm6.lon, lm6.lat)) - lm6.radius; if (d < 5) m *= Math.max(0, d / 5); }
    if (mesa) { const d = R * W.angleBetween(W.vec(lon, lat), W.vec(mesa.lon, mesa.lat)) - mesa.radiusMeters; if (d < 6) m *= Math.max(0, d / 6); }
    if (monoP) { const d = R * W.angleBetween(W.vec(lon, lat), W.vec(monoP.lon, monoP.lat)) - 6; if (d < 5) m *= Math.max(0, d / 5); }       // the LM06 monolith stands on its own flat disc of sand (W7)
    return m;
  };
  function isDesertKind(r) { return r.kind === 'desert'; }
  const dune = (x, z) => (vnoise(x, z, 10) * 0.6 + vnoise(x + 71, z - 33, 4.3) * 0.3 + vnoise(x - 17, z + 61, 2.1) * 0.1 - 0.5) * 2 * 1.55;
  const vert = (i, j) => {
    const key = i * 100003 + j; let v = vid.get(key); if (v !== undefined) return v;
    const lat = lat0 + j * step / (R * D), kk = 1 / Math.cos(lat * D), lon = lon0 + i * step * kk / (R * D) / kk * 1 / Math.cos(lat * D) * Math.cos(lat * D) / 1; const lonU = lon0 + i * step / (R * D * Math.cos(lat * D));
    const F = flatOf(lonU, lat), m = maskAt(lonU, lat), h = H(lonU, lat), dh = dune(F.x, F.z) * m;
    maxH = Math.max(maxH, dh); minH = Math.min(minH, dh);
    const ripple = vnoise(F.x * 1.7, F.z * 1.7, 1.0) * 0.5 + vnoise(F.x * 0.6, F.z * 0.6, 1.0) * 0.5, wet = 0;
    let c = mix(SAND, SAND2, ripple); c = mix(c, WET, wet);
    const tcol = ctx.terrainColor ? ctx.terrainColor(lonU, lat) : c; c = mix(tcol, c, Math.min(1, m * 1.6));
    out.pos.push(F.x, (h + dh + 0.01 - BASE) * F.k, F.z); out.col.push(c[0], c[1], c[2]); v = out.pos.length / 3 - 1; vid.set(key, v); void lon; return v;
  };
  const nI = Math.ceil((lon1 - lon0) * D * R * Math.cos(((lat0 + lat1) / 2) * D) / step), nJ = Math.ceil((lat1 - lat0) * D * R / step);
  for (let j = 0; j < nJ; j++) for (let i = 0; i < nI; i++) {
    const lat = lat0 + (j + 0.5) * step / (R * D), lonU = lon0 + (i + 0.5) * step / (R * D * Math.cos(lat * D)); if (maskAt(lonU, lat) < 0.02) continue;
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1); out.idx.push(a, c, b, b, c, d); cells++;
  }
  return { mesh: out, stats: { cells, maxDune: maxH, minDune: minH, range: maxH - minH, triangles: out.idx.length / 3 } };
}

// ---- W6e highland: BI09 scree and crags on steep mountain slopes, BI07 ice (undulation, cracks, cliffs at the edge, floating ice) and BI08 lava (rope texture, cracks, lichen,
// pioneer plants, vents with sulphur, one collapsed lava tube) as overlay meshes on the terrain; instanced details around the camera
function overlayGrid(W, H, region, step, fn) {                    // cells of `step` true metres over a region's bounding box; fn(lonU, lat, x, z) -> {h, color, keep}
  const out = { pos: [], col: [], idx: [] }, vid = new Map();
  let lon0 = 1e9, lon1 = -1e9, lat0 = 1e9, lat1 = -1e9;
  if (region.shape.type === 'cap') { const c = region.shape.center, rr = region.shape.radiusMeters / (R * D); lat0 = c[1] - rr; lat1 = c[1] + rr; lon0 = c[0] - rr / Math.cos(Math.min(85, Math.abs(c[1]) + rr / D) * D); lon1 = c[0] + rr / Math.cos(Math.min(85, Math.abs(c[1]) + rr / D) * D); }
  else { lat0 = region.shape.hemisphere === 'N' ? 55 : -90; lat1 = region.shape.hemisphere === 'N' ? 90 : -55; lon0 = -180; lon1 = 180; }
  const rows = Math.ceil((lat1 - lat0) * D * R / step); let cells = 0;
  const vert = (i, j, lat, lonU, x, z) => { const key = i * 1000003 + j; let v = vid.get(key); if (v !== undefined) return v; const r = fn(lonU, lat, x, z); out.pos.push(x, (r.h - BASE) / Math.cos(lat * D), z); out.col.push(r.color[0], r.color[1], r.color[2]); v = out.pos.length / 3 - 1; vid.set(key, v); return v; };
  for (let j = 0; j < rows; j++) {
    const lat = Math.min(89.5, lat0 + (j + 0.5) * step / (R * D)), kk = 1 / Math.cos(lat * D), dlon = step * kk / (R * D), n = Math.ceil((lon1 - lon0) / dlon);
    for (let i = 0; i < n; i++) {
      const lonU = lon0 + (i + 0.5) * dlon, ce = fn(lonU, lat, R * lonU * D, -R * Math.asinh(Math.tan(lat * D)), true); if (!ce) continue;
      const la0 = lat0 + j * step / (R * D), la1 = la0 + step / (R * D), lo0 = lon0 + i * dlon, lo1 = lo0 + dlon;
      const P = (lo, la, ii, jj) => vert(ii, jj, la, lo, R * lo * D, -R * Math.asinh(Math.tan(la * D)));
      out.idx.push(P(lo0, la0, i, j), P(lo0, la1, i, j + 1), P(lo1, la0, i + 1, j), P(lo1, la0, i + 1, j), P(lo0, la1, i, j + 1), P(lo1, la1, i + 1, j + 1)); cells++;
    }
  }
  return { mesh: out, cells };
}
function highland(W, H, ctx) {
  const avoid = ctx.avoid || [], items = [], stats = { scree: 0, crags: 0, iceBlocks: 0, lichen: 0, pioneers: 0, vents: 0, tubes: 0 };
  const nearAvoid = (lon, lat, r) => avoid.some(a => { const dl = (a.lon - lon) * Math.cos(lat * D) * R * D, dt = (a.lat - lat) * R * D; return dl * dl + dt * dt < (a.r + r) * (a.r + r); });
  const put = (type, lon, lat, alt, o = {}) => items.push({ type, lon, lat, alt, yaw: o.yaw ?? hash(lon * 91, lat * 77) * 6.283, s: o.s || [1, 1, 1], lean: o.lean || [0, 0], tint: o.tint || [1, 1, 1] });
  const tint = (a, b, k) => { const t = a + (b - a) * hash(k, 9); return [t, t, t]; };
  const slopeAt = (lon, lat) => { const e = 1.0 / (R * D); return Math.hypot((H(lon + e / Math.cos(lat * D), lat) - H(lon - e / Math.cos(lat * D), lat)) / 2, (H(lon, lat + e) - H(lon, lat - e)) / 2); };
  const lava = W.regions.find(q => q.kind === 'lava'), lm01 = W.landmarks.find(q => q.id === 'LM01');
  const isLava = r => r.kind === 'lava';
  // scree and crags on the slopes of mountains and hills (not forest: those are covered), 1.6 m grid
  scatterGrid(1.8, 75, (lon, lat, x, z, key) => {
    const reg = W.regionAt(lon, lat); if (reg.zone === 'ocean' || reg.zone === 'ice' || reg.kind === 'forest') return;
    const h = H(lon, lat); if (h < 3.5) return; const sl = slopeAt(lon, lat); if (sl < 0.28 || nearAvoid(lon, lat, 1.0) || (ctx.corridor && ctx.corridor(lon, lat))) return;
    if (hash(key, 1) < Math.min(0.5, (sl - 0.2) * 0.75)) { const sc = 0.4 + 1.4 * Math.pow(hash(key, 2), 2), big = sc > 1.15; put(big ? 'rockBig' : 'rock', lon, lat, h - 0.08 * sc, { s: big ? [sc * 0.8, sc * 0.7, sc * 0.8] : [sc * 1.2, sc * 1.1, sc * 1.2], tint: tint(0.8, 1.05, key) }); if (big) stats.crags++; else stats.scree++; }
  });
  // lava field items
  if (lava) scatterGrid(1.1, 75, (lon, lat, x, z, key) => {
    if (!isLava(W.regionAt(lon, lat))) return; const h = H(lon, lat); if (nearAvoid(lon, lat, 0.8)) return;
    const ed = edgeDistance(W, lon, lat, isLava, 10), plants = Math.max(0, 1 - ed / 9);
    if (hash(key, 3) < 0.11 + 0.28 * plants) { put(hash(key, 4) < 0.5 ? 'lichenPatch' : hash(key, 5) < 0.6 ? 'tuft' : 'fern', lon, lat, h, { s: [0.5 + 0.7 * hash(key, 6), 0.5 + 0.7 * hash(key, 7), 0.5 + 0.7 * hash(key, 6)], tint: tint(0.7, 1.0, key) }); stats.pioneers++; if (stats.pioneers % 3 === 0) stats.lichen++; }
    if (hash(key, 8) < 0.012) { const sc = 0.5 + 1.2 * hash(key, 9); put('rock', lon, lat, h - 0.06, { s: [sc, sc * 0.7, sc], tint: tint(0.55, 0.8, key) }); }
  });
  // vents with sulphur near the volcano side of the lava field and at the TR06 edge (the hot-spring vents), and the one collapsed lava tube
  if (lava && lm01) {
    const c = lava.shape.center, ventAt = [[0.35, 40], [0.5, 75], [0.28, 140], [0.6, 200], [0.42, 260], [0.5, 175], [0.7, 120], [0.62, 235], [0.8, 290], [0.55, 10], [0.75, 160], [0.65, 330]];
    ventAt.forEach(([rf, ang], i) => { const q = W.destination({ lon: c[0], lat: c[1] }, ang, lava.shape.radiusMeters * rf); if (!nearAvoid(q.lon, q.lat, 0.5) && W.regionAt(q.lon, q.lat).kind === 'lava' && stats.vents < 5) { put('ventCone', q.lon, q.lat, H(q.lon, q.lat), { yaw: hash(i, 3) * 6.28, s: [0.9 + 0.5 * hash(i, 4), 0.9 + 0.8 * hash(i, 5), 0.9 + 0.5 * hash(i, 4)] }); stats.vents++; } });
    const tube = W.destination({ lon: c[0], lat: c[1] }, 110, lava.shape.radiusMeters * 0.45); stats.tube = tube; put('tubeHole', tube.lon, tube.lat, H(tube.lon, tube.lat) - 0.1, { s: [1, 1, 1] }); stats.tubes++;
  }
  // floating ice off the coast of the ice edge (sea side, 0-6 m out): a few blocks on the water
  scatterGrid(2.6, 84, (lon, lat, x, z, key) => {
    const reg = W.regionAt(lon, lat); if (reg.zone !== 'ocean' || Math.abs(lat) < 60) return; const ed = edgeDistance(W, lon, lat, r => r.zone === 'ocean', 8);
    if (ed < 6 && hash(key, 1) < 0.18 && W.coastDistance(lon, lat) > -6) { const sc = 0.5 + 1.3 * hash(key, 2); put('iceBlock', lon, lat, -0.1, { s: [sc, sc, sc], tint: tint(0.9, 1.05, key) }); stats.iceBlocks++; }
  });
  return { items, stats };
}
function iceField(W, H, ctx) {                                      // BI07 ice undulation, cracks and cliffs as an overlay of 1.0 m cells over both ice caps
  const avoid = ctx.avoid || [], ICE = lin('#cfe0ee'), ICE2 = lin('#dcebf6'), BLU = lin('#9ec6dc'), CRK = lin('#6aa6bd'), CLF = lin('#b5cfe0');
  const stats = { cliffs: 0, cracks: 0, cells: 0, maxCliff: 0, minUnd: 0, maxUnd: 0 };
  const res = [];
  for (const rg of W.regions.filter(q => q.kind === 'ice-north' || q.kind === 'ice-south')) {
    const edge = rg.shape.edge, north = rg.shape.hemisphere === 'N';
    const fn = (lonU, lat, x, z, probe) => {
      const inIce = north ? lat > edge(lonU) : lat < edge(lonU); if (!inIce || Math.abs(lat) > 84.5) return probe ? false : { h: Math.abs(lat) > 84.5 ? H(lonU, Math.sign(lat) * 84.5) : H(lonU, lat), color: ICE };
      const dEdge = Math.abs(lat - edge(lonU)) * D * R;                              // metres from the edge into the ice
      let m = 1; for (const a of avoid) { const dl = (a.lon - lonU) * Math.cos(lat * D) * R * D, dt = (a.lat - lat) * R * D, d = Math.hypot(dl, dt) - a.r; if (d < 6) m *= Math.max(0, d / 6); if (m <= 0) break; }
      for (const lm of W.landmarks) if (lm.id !== 'TOWN') { const d = R * W.angleBetween(W.vec(lonU, lat), W.vec(lm.lon, lm.lat)) - lm.radius; if (d < 6) m *= Math.max(0, d / 6); }
      if (probe) return m > 0.01 || dEdge < 8;
      const cp = Math.cos(lat * D), px = R * cp * Math.sin(lonU * D), py = R * cp * Math.cos(lonU * D), pz = -R * Math.sin(lat * D);                   // the point on the sphere: 3D noise, isotropic and without a pole
      const und = (vnoise3(px, py, pz, 9) * 0.55 + vnoise3(px + 41, py - 17, pz + 9, 3.7) * 0.3 + vnoise3(px - 9, py + 33, pz - 21, 1.6) * 0.15 - 0.5) * 2 * 0.95 * m;
      const cliffH = (2.4 + 2.6 * vnoise3(px * 0.7, py * 0.7, pz * 0.7, 9)) * (() => { const t = Math.min(1, Math.max(0, 1 - dEdge / 5.0)); return t * t * (3 - 2 * t); })();       // the edge of the ice is a 3-5 m cliff, its face 5 m wide
      const base = H(lonU, lat), crackN = Math.abs(vnoise3(px + 7, py + 3, pz - 5, 4.2) - 0.5), crack = crackN < 0.018 && dEdge > 3 && m > 0.5;
      let c = mix(ICE, ICE2, vnoise3(px * 0.8, py * 0.8, pz * 0.8, 1.2)); c = mix(c, BLU, 0.25 * (1 - m)); if (crack) c = CRK; if (cliffH > 0.4) c = mix(c, CLF, Math.min(1, cliffH / 3));
      return { h: base + und + cliffH * m + 0.0, color: c, crack, cliff: cliffH, und };
    };
    const g = overlayGrid(W, H, rg, 1.0, fn); res.push(g);
  }
  return { grids: res };
}
function lavaField(W, H, ctx) {                                      // BI08 rope lava, cracks, rust-red volcanic sand and the faint embers near the crater: a 0.5 m overlay over the lava cap
  const lv = W.regions.find(q => q.kind === 'lava'), avoid = ctx.avoid || [], C1 = lin('#2a2528'), C2 = lin('#3a3436'), C3 = lin('#4a3c40'), SAND = lin('#5a4034'), EMB = lin('#6a3426'), LICH = lin('#5a6a58');
  const crater = W.landmarks.find(q => q.id === 'LM01'), stats = { cracks: 0, embers: 0, cells: 0, relief: 0 };
  const fn = (lonU, lat, x, z, probe) => {
    const r = W.regionAt(lonU, lat); if (r.kind !== 'lava') return probe ? false : { h: H(lonU, lat) + 0.01, color: C1 };
    const ed = edgeDistance(W, lonU, lat, q => q.kind === 'lava', 3); if (probe) return true;
    const gx = lonU * Math.cos(lat * D) * R * D, gz = lat * R * D;
    const rope = Math.sin((vnoise(gx, gz, 3.0) * 6.28 + gx * 1.3 + gz * 0.7) * 2.2) * 0.5 + 0.5;               // rope-like folds: sine of a warped phase (no overall direction)
    const relief = ((vnoise(gx, gz, 8) - 0.5) * 2 * 0.55 + (rope - 0.5) * 0.22) * Math.min(1, ed / 2);
    const crackN = Math.abs(vnoise(gx + 5, gz - 9, 2.4) - 0.5), crack = crackN < 0.02;
    let c = mix(mix(C1, C2, vnoise(gx * 1.4, gz * 1.4, 1)), C3, rope * 0.5); const sand = Math.max(0, 1 - ed / 5) * vnoise(gx, gz, 2); c = mix(c, SAND, sand * 0.7);
    if (vnoise(gx + 90, gz + 40, 2.2) > 0.78 && ed > 1.5) c = mix(c, LICH, 0.55);
    let ember = false; if (crack) { c = mix(c, C1, 0.7); if (crater) { const d = R * W.angleBetween(W.vec(lonU, lat), W.vec(crater.lon, crater.lat)); if (d < 26 && vnoise(gx, gz, 3) > 0.7) { c = mix(c, EMB, 0.35); ember = true; } } }
    return { h: H(lonU, lat) + relief + 0.01, color: c, crack, ember, relief };
  };
  const g = overlayGrid(W, H, lv, 0.5, fn); return { grid: g };
}

// ---- terraces (BI06): the hills of hill-terraces-ameni (and gentle farm hills) are cut into steps along the contours: a grid of 0.5 m cells, each cell at the top of its 0.9 m band, with a
// stone wall (vertical quads) wherever neighbouring cells differ, and rows of tea bushes on the treads
function terraces(W, H, ctx) {
  const step = 0.35, rise = 0.9, out = { tread: { pos: [], col: [], idx: [] }, wall: { pos: [], col: [], idx: [] }, items: [], cells: 0, walls: 0, bands: 0 };
  const zones = ctx.terraceRegions || [];
  for (const rg of zones) {
    const c = rg.center, rad = rg.radiusMeters + 2, lat0 = c[1], k = 1 / Math.cos(lat0 * D), n = Math.ceil(rad / step), cells = new Map(), base = Math.min(...[0, 90, 180, 270].map(a => { const q = W.destination({ lon: c[0], lat: c[1] }, a, rad); return H(q.lon, q.lat); }), 2.4);
    const bandOf = h => Math.floor((h - base) / rise);
    const at = (i, j) => { const x = i * step * k + R * c[0] * D, z = -R * Math.asinh(Math.tan(lat0 * D)) + j * step * k, ll = llOf(x, z); return { x, z, lon: ll.lon, lat: ll.lat }; };
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const p = at(i, j), r = Math.hypot(i, j) * step; if (r > rg.radiusMeters) continue;
      const q = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b2]) => { const l = at(i + a * 2, j + b2 * 2); return H(l.lon, l.lat); }), h = (H(p.lon, p.lat) * 2 + q.reduce((x, y) => x + y, 0)) / 6;          // lightly smoothed (the lattice and the noise would jag the contours)
      const slopeAt = (() => { const e = 0.5 * k, a1 = at(i + 1.4, j), a2 = at(i - 1.4, j), b1 = at(i, j + 1.4), b2 = at(i, j - 1.4); return Math.hypot((H(a1.lon, a1.lat) - H(a2.lon, a2.lat)) / 1.0, (H(b1.lon, b1.lat) - H(b2.lon, b2.lat)) / 1.0) / 2; void e; })();
      if (h < base + 0.45 || h > base + 5.6 || slopeAt > 0.5) continue; const b = bandOf(h);                // only the terraced hill itself: not the flank of the volcano that it leans on (slope < 50 %, within 5.6 m of its foot)                  // the hill above its foot (the summit is 5 m over the plain)
      cells.set(`${i},${j}`, { i, j, p, h, b, top: base + (b + 1) * rise });
    }
    const pv = (m, x, y, z, col) => { const kk = 1 / Math.cos(llOf(x, z).lat * D); m.pos.push(x, (y - BASE) * kk, z); m.col.push(col[0], col[1], col[2]); return m.pos.length / 3 - 1; };
    for (const cell of cells.values()) {
      const { p, top } = cell, hx = step * k / 2, jit = 0.85 + 0.3 * hash(cell.i, cell.j), col = mix(COL.tread, COL.treadTea, hash(cell.b, 3)).map(v => v * jit);
      const a = pv(out.tread, p.x - hx, top, p.z - hx, col), b = pv(out.tread, p.x + hx, top, p.z - hx, col), c2 = pv(out.tread, p.x + hx, top, p.z + hx, col), d = pv(out.tread, p.x - hx, top, p.z + hx, col);
      out.tread.idx.push(a, d, b, b, d, c2); out.cells++;
      // walls on the sides where the neighbour is lower: a face from the neighbour's top (or the terrain) up to this cell's top
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nb = cells.get(`${cell.i + di},${cell.j + dj}`), nTop = nb ? nb.top : H(at(cell.i + di, cell.j + dj).lon, at(cell.i + di, cell.j + dj).lat);
        if (nb && nb.top >= top - 1e-6) continue; if (!nb && nTop >= top - 0.05) continue;
        const lowY = nb ? nb.top : Math.min(nTop, top - 0.05);
        const e0 = di ? [p.x + di * hx, p.z - hx] : [p.x - hx, p.z + dj * hx], e1 = di ? [p.x + di * hx, p.z + hx] : [p.x + hx, p.z + dj * hx];
        const w = out.wall, wc = mix(COL.wall, COL.wallD, hash(cell.i * 3 + di, cell.j * 5 + dj));
        const v0 = pv(w, e0[0], top, e0[1], wc), v1 = pv(w, e1[0], top, e1[1], wc), v2 = pv(w, e1[0], lowY, e1[1], COL.wallD), v3 = pv(w, e0[0], lowY, e0[1], COL.wallD);
        const flip = (di + dj) > 0; if (flip) w.idx.push(v0, v1, v2, v0, v2, v3); else w.idx.push(v0, v2, v1, v0, v3, v2); out.walls++;
      }
    }
    // tea rows: along the contour (perpendicular to the terrain gradient), one bush block every 1.4 m, rows 1.1 m apart on the treads of 3+ cells width
    const rows = new Map(); for (const cell of cells.values()) rows.set(`${cell.i},${cell.j}`, cell);
    for (const cell of cells.values()) {
      if ((cell.i + 2 * cell.j) % 3 !== 0 || hash(cell.i, cell.j * 7) < 0.2) continue;
      const gx = H(cell.p.lon + 0.2 / (R * D * Math.cos(cell.p.lat * D)), cell.p.lat) - H(cell.p.lon - 0.2 / (R * D * Math.cos(cell.p.lat * D)), cell.p.lat), gz = H(cell.p.lon, cell.p.lat + 0.2 / (R * D)) - H(cell.p.lon, cell.p.lat - 0.2 / (R * D));
      // all four neighbours must be on the same band: the middle of a tread
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => { const n = rows.get(`${cell.i + a},${cell.j + b}`); return n && n.top === cell.top; })) continue;
      out.items.push({ type: 'teaRow', lon: cell.p.lon, lat: cell.p.lat, alt: cell.top, yaw: Math.atan2(gx, -gz) + 1.5708, s: [1, 0.85 + 0.3 * hash(cell.i, cell.j), 1], lean: [0, 0], tint: [0.9 + 0.2 * hash(cell.j, cell.i), 0.95, 0.9] });
    }
    out.bands += new Set([...cells.values()].map(q => q.b)).size;
  }
  return out;
}

const LANDCOVER = { vnoise3, build, terraces, forest, grassland, dunes, highland, iceField, lavaField, overlayGrid, scatterGrid, vnoise, edgeDistance, SP, COL, SEED };

// ---------------------------------------------------------------- scene part
LANDCOVER.attach = function (scene, ctx, BEND, TERR, SEC) {
  const THREE = global.THREE, W = global.WORLD;
  const S = { built: false, stats: {}, root: null, loaded: 0, last: null };
  const objs = { strips: [], water: [], hulls: [], inst: {}, types: [], twoSided: null, lines: [] };
  const tintC = new THREE.Color(), qE = new THREE.Euler(), qQ = new THREE.Quaternion(), mP = new THREE.Vector3(), mS = new THREE.Vector3(), mM = new THREE.Matrix4();
  let DATA = null, INDEX = null;
  const TIMEU = { value: 0 };
  let WATERK = null;                                   // made on first use, inside the private random stream (the town's rain must not see its uuids)

  // ---- the instance table: a 16 m tile index, loaded around the camera
  function indexItems(items) {
    const tiles = new Map(); const bandDeg = 16 / (R * D);
    const f = new Float32Array(items.length * 12), types = [];
    const typeId = {}; items.forEach((it, i) => { if (typeId[it.type] === undefined) { typeId[it.type] = types.length; types.push(it.type); } const o = i * 12, F = flatOf(it.lon, it.lat); f[o] = F.x; f[o + 1] = F.z; f[o + 2] = it.alt; f[o + 3] = it.yaw; f[o + 4] = it.s[0]; f[o + 5] = it.s[1]; f[o + 6] = it.s[2]; f[o + 7] = it.tint[0]; f[o + 8] = it.tint[1]; f[o + 9] = it.tint[2]; f[o + 10] = it.lean[0]; f[o + 11] = it.lean[1]; });
    items.forEach((it, i) => { const band = Math.floor(it.lat / bandDeg), lonBin = Math.floor(it.lon * Math.cos((band + 0.5) * bandDeg * D) / bandDeg), key = band * 100000 + lonBin; let t = tiles.get(key); if (!t) tiles.set(key, t = []); t.push(i); });
    return { f, types, typeId, tiles, bandDeg, type: items.map(it => typeId[it.type]) };
  }
  function camLL(camera) {
    const u = BEND.get(); if (u < 0.5) {
      const ll = W.townToLonLat(camera.position.x, camera.position.z); ll.lon = ((ll.lon + 180) % 360 + 360) % 360 - 180;   // W8e-b: the flat map runs to 275 deg, the table is in -180..180
      return { ...ll, alt: Math.max(0, camera.position.y - Math.max(0, ((TERR.sampler()(ll.lon,ll.lat) ?? BASE)-BASE)/Math.cos(ll.lat*D))) };
    }
    const dx = camera.position.x, dy = camera.position.y + R, dz = camera.position.z, l = Math.hypot(dx, dy, dz);
    return { lon: Math.atan2(dx, dy) / D, lat: -Math.asin(dz / l) / D, alt: l - R };
  }
  function buildMeshes(K, M) {
    const root = new THREE.Group(); root.name = 'landcover'; scene.add(root); S.root = root;
    objs.twoSided = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const stripMesh = (m, mat, name, normals) => {
      if (!m.idx.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(m.col, 3)); g.setIndex(m.idx);
      if (normals) g.computeVertexNormals(); else { const nrm = new Float32Array(m.pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); }
      g.computeBoundingSphere(); const mesh = new THREE.Mesh(g, mat); mesh.name = name; mesh.matrixAutoUpdate = false; root.add(mesh); objs.strips.push(mesh); return mesh;
    };
    const T = DATA.meshes;
    for (const m of [T.tread]) { /* triangles may face down: fix winding below */ for (let i = 0; i < m.idx.length; i += 3) { const a = m.idx[i] * 3, b = m.idx[i + 1] * 3, c = m.idx[i + 2] * 3, ny = (m.pos[b + 2] - m.pos[a + 2]) * (m.pos[c] - m.pos[a]) - (m.pos[b] - m.pos[a]) * (m.pos[c + 2] - m.pos[a + 2]); if (ny < 0) { const tmp = m.idx[i + 1]; m.idx[i + 1] = m.idx[i + 2]; m.idx[i + 2] = tmp; } } }
    stripMesh(T.tread, M.groundMat, 'cover:plots'); stripMesh(T.ridge, objs.twoSided, 'cover:ridges');
    { const w = T.water; for (let i = 0; i < w.idx.length; i += 3) { const a = w.idx[i] * 3, b = w.idx[i + 1] * 3, c = w.idx[i + 2] * 3, ny = (w.pos[b + 2] - w.pos[a + 2]) * (w.pos[c] - w.pos[a]) - (w.pos[b] - w.pos[a]) * (w.pos[c + 2] - w.pos[a + 2]); if (ny < 0) { const tmp = w.idx[i + 1]; w.idx[i + 1] = w.idx[i + 2]; w.idx[i + 2] = tmp; } }
      if (w.idx.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(w.pos, 3)); const wc = new Float32Array((w.pos.length / 3) * 4); for (let i = 0; i < wc.length; i += 4) { wc[i] = 0.12; wc[i + 1] = 0.26; wc[i + 2] = 0.34; wc[i + 3] = 0.55; } g.setAttribute('color', new THREE.BufferAttribute(wc, 4)); g.setAttribute('aShore', new THREE.Float32BufferAttribute(w.shore, 1)); g.setIndex(w.idx); g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, WATERK.paddy); mesh.name = 'cover:paddy-water'; mesh.matrixAutoUpdate = false; mesh.renderOrder = 2; root.add(mesh); objs.water.push(mesh); } }
    const fixWind = m => { for (let i = 0; i < m.idx.length; i += 3) { const a = m.idx[i] * 3, b = m.idx[i + 1] * 3, c = m.idx[i + 2] * 3, ny = (m.pos[b + 2] - m.pos[a + 2]) * (m.pos[c] - m.pos[a]) - (m.pos[b] - m.pos[a]) * (m.pos[c + 2] - m.pos[a + 2]); if (ny < 0) { const tmp = m.idx[i + 1]; m.idx[i + 1] = m.idx[i + 2]; m.idx[i + 2] = tmp; } } };
    for (const g of DATA.ice.grids) if (g.mesh.idx.length) { fixWind(g.mesh); stripMesh(g.mesh, M.groundMat, 'cover:ice', true); }
    if (DATA.lava.grid.mesh.idx.length) { fixWind(DATA.lava.grid.mesh); stripMesh(DATA.lava.grid.mesh, M.groundMat, 'cover:lava', true); }
    // mist belt around ameni-dake (BI09): an open band of 2 m rising to 13 m, additive, breathing slowly; and one around the highest ridge crests
    { const mp = W.heightField.features.find(q => q.id === 'ameni-dake'), ring = 36, pos = [], col = [], idx = [], levels = [[0, 7.5, 0], [1, 9.5, 0.5], [2, 12, 0.35], [3, 14.5, 0]];
      for (const [li, y, al] of levels) for (let a = 0; a <= ring; a++) { const th = a / ring * 2 * Math.PI, q = W.destination({ lon: mp.lon, lat: mp.lat }, th / D, mp.radiusMeters * (0.62 - li * 0.06) + 3), F = flatOf(q.lon, q.lat); pos.push(F.x, (y - BASE) * F.k, F.z); col.push(0.62, 0.72, 0.85, al * (0.7 + 0.3 * Math.sin(a * 2.1 + li))); }
      for (let li = 0; li + 1 < levels.length; li++) for (let a = 0; a < ring; a++) { const i0 = li * (ring + 1) + a, i1 = i0 + 1, i2 = i0 + ring + 1, i3 = i2 + 1; idx.push(i0, i2, i1, i1, i2, i3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.computeBoundingSphere();
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: false }); const mesh = new THREE.Mesh(g, mat); mesh.name = 'cover:mist'; mesh.matrixAutoUpdate = false; mesh.renderOrder = 4; root.add(mesh); objs.mist = mesh; }
    if (DATA.dunes && DATA.dunes.mesh.idx.length) { const d = DATA.dunes.mesh; for (let i = 0; i < d.idx.length; i += 3) { const a = d.idx[i] * 3, b = d.idx[i + 1] * 3, c = d.idx[i + 2] * 3, ny = (d.pos[b + 2] - d.pos[a + 2]) * (d.pos[c] - d.pos[a]) - (d.pos[b] - d.pos[a]) * (d.pos[c + 2] - d.pos[a + 2]); if (ny < 0) { const tmp = d.idx[i + 1]; d.idx[i + 1] = d.idx[i + 2]; d.idx[i + 2] = tmp; } } const m = stripMesh(d, M.groundMat, 'cover:dunes', true); void m; }
    if (DATA.edge && DATA.edge.idx.length) { const e = DATA.edge; for (let i = 0; i < e.idx.length; i += 3) { const a = e.idx[i] * 3, b = e.idx[i + 1] * 3, c = e.idx[i + 2] * 3, ny = (e.pos[b + 2] - e.pos[a + 2]) * (e.pos[c] - e.pos[a]) - (e.pos[b] - e.pos[a]) * (e.pos[c + 2] - e.pos[a + 2]); if (ny < 0) { const tmp = e.idx[i + 1]; e.idx[i + 1] = e.idx[i + 2]; e.idx[i + 2] = tmp; } } stripMesh(e, M.groundMat, 'cover:town-edge'); }
    if (DATA.terrace) { const t = DATA.terrace.tread; for (let i = 0; i < t.idx.length; i += 3) { const a = t.idx[i] * 3, b = t.idx[i + 1] * 3, c = t.idx[i + 2] * 3, ny = (t.pos[b + 2] - t.pos[a + 2]) * (t.pos[c] - t.pos[a]) - (t.pos[b] - t.pos[a]) * (t.pos[c + 2] - t.pos[a + 2]); if (ny < 0) { const tmp = t.idx[i + 1]; t.idx[i + 1] = t.idx[i + 2]; t.idx[i + 2] = tmp; } } stripMesh(DATA.terrace.tread, M.groundMat, 'cover:terrace-treads'); stripMesh(DATA.terrace.wall, M.floraMat, 'cover:terrace-walls', true); }
  }
  // instanced meshes: one per type with a capacity; filled from the tiles around the camera
  function buildInstances(K, M) {
    const cap = { iceBlock: 200, ventCone: 30, lichenPatch: 300, tubeHole: 4, dryShrub: 400, rockPillar: 40, cairn: 60, treeRound_: 1, shrub: 1800, fern: 2200, mossRock: 500, rock: 300, logMoss: 150, log: 100, fenceBamboo: 400, seedling: 7000, tuft: 2500, weed: 2500, flower: 600, shrubLow: 500, rack: 600, scarecrow: 300, hutFarm: 200, hutRusty: 200, oldMachine: 150, rackFallen: 250, teaRow: 1500 };
    const NOHULL = ['seedling', 'tuft', 'weed', 'flower', 'teaRow'];
    const TREES = ['treeRound', 'cedar', 'pine', 'bamboo'], NEAR = { treeRound: 700, cedar: 450, pine: 250, bamboo: 200 }, FAR = { treeRound: 600, cedar: 450, pine: 200, bamboo: 150 };   // near + far <= 3000 visible trees (BI02)
    const make = (key, type, geo, c, mat, hmat) => {
      const total = INDEX.type.filter(t => INDEX.types[t] === type).length, cc = Math.min(c, Math.max(1, total));
      const mesh = new THREE.InstancedMesh(geo, mat, cc); mesh.name = 'cover:' + key; mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < cc; i++) mesh.setColorAt(i, tintC.setRGB(1, 1, 1)); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); S.root.add(mesh);
      const o = { mesh, hull: null, cap: cc, total };
      if (hmat) { const hull = new THREE.InstancedMesh(geo, hmat, cc); hull.instanceMatrix = mesh.instanceMatrix; hull.count = 0; hull.frustumCulled = false; hull.name = 'cover:' + key + ':ink'; S.root.add(hull); o.hull = hull; objs.hulls.push(hull); }
      objs.inst[key] = o;
    };
    // grass sways a little (ground detail of BI03): the same slow wave as the trees, on the blades only (the lowest 0.8 m), phase by instance position
    const SWAYG = 'float sw = smoothstep(0.05, 0.7, position.y); transformed.x += sin(uTime * 1.3 + instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.6) * 0.07 * sw; transformed.z += cos(uTime * 1.1 + instanceMatrix[3].z * 0.8) * 0.05 * sw;';
    const grassMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, side: THREE.DoubleSide });
    grassMat.onBeforeCompile = shader => { shader.uniforms.uTime = TIMEU; shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAYG); };
    grassMat.customProgramCacheKey = () => 'bend|grassSway';
    for (const type of INDEX.types) {
      if (TREES.includes(type)) { make(type, type, K.geometries[type], NEAR[type], M.treeMat, M.treeHullMat); make(type + '_far', type, K.geometries[type + '_far'], FAR[type], M.treeMat, null); continue; }
      const geo = K.geometries[type] || (type === 'teaRow' ? teaGeo(K) : null); if (!geo) continue;
      const total = INDEX.type.filter(t => INDEX.types[t] === type).length, c = Math.min(cap[type] || 800, Math.max(1, total));
      const mesh = new THREE.InstancedMesh(geo, ['tuft', 'weed', 'fern'].includes(type) ? grassMat : M.floraMat, c); mesh.name = 'cover:' + type; mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < c; i++) mesh.setColorAt(i, tintC.setRGB(1, 1, 1)); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); S.root.add(mesh);
      const o = { mesh, hull: null, cap: c, total };
      if (!NOHULL.includes(type)) { const hull = new THREE.InstancedMesh(geo, M.hullMat, c); hull.instanceMatrix = mesh.instanceMatrix; hull.count = 0; hull.frustumCulled = false; hull.name = 'cover:' + type + ':ink'; S.root.add(hull); o.hull = hull; objs.hulls.push(hull); }
      objs.inst[type] = o;
    }
  }
  function teaGeo(K) { const b = K.builder(); b.add(new THREE.BoxGeometry(1, 1, 1), '#3f6a4e', { p: [0, 0.4, 0], s: [1.0, 0.8, 2.0], top: '#4c7a58', noise: 0.08 }); K.geometries.teaRow = b.build(); return K.geometries.teaRow; }
  const TREE_SET = new Set(['treeRound', 'cedar', 'pine', 'bamboo']);
  function load(camera, force) {
    const ll = camLL(camera); if (!ll || ll.alt > 110) { for (const o of Object.values(objs.inst)) { o.mesh.count = 0; if (o.hull) o.hull.count = 0; } S.loaded = 0; S.last = null; return; }
    if (!force && S.last && Math.abs(S.last.lon - ll.lon) * Math.cos(ll.lat * D) * R * D < 1e-9 && Math.abs(S.last.lat - ll.lat) * R * D < 1e-9 && Math.abs(S.last.alt - ll.alt) < 1e-9 && S.last.bend === BEND.get()) return;
    S.last = { ...ll, bend: BEND.get() };
    const radius = Math.min(80, Math.max(30, 20 + ll.alt * 1.2)), band = INDEX.bandDeg, b0 = Math.floor((ll.lat - radius / (R * D)) / band), b1 = Math.floor((ll.lat + radius / (R * D)) / band);
    const counts = {}; for (const key of Object.keys(objs.inst)) counts[key] = 0; let total = 0;
    const cx = flatOf(ll.lon, ll.lat);
    for (let b = b0; b <= b1; b++) {
      const cosb = Math.cos((b + 0.5) * band * D), l0 = Math.floor((ll.lon - radius / (R * D * cosb)) * cosb / band), l1 = Math.floor((ll.lon + radius / (R * D * cosb)) * cosb / band);
      for (let lb = l0; lb <= l1; lb++) { const tile = INDEX.tiles.get(b * 100000 + lb); if (!tile) continue;
        for (const i of tile) {
          const o = i * 12, x = INDEX.f[o], z = INDEX.f[o + 1], k = 1 / Math.cos(Math.atan(Math.sinh(-z / R))); const dx = (x - cx.x) / k, dz = (z - cx.z) / k; if (dx * dx + dz * dz > radius * radius) continue;
          let type = INDEX.types[INDEX.type[i]]; if (TREE_SET.has(type)) { const d3 = Math.hypot(dx, dz, ll.alt); if (d3 >= 26) type += '_far'; } const inst = objs.inst[type]; if (!inst || counts[type] >= inst.cap) continue;
          qE.set(INDEX.f[o + 10], INDEX.f[o + 3], INDEX.f[o + 11], 'YXZ'); qQ.setFromEuler(qE); mM.compose(mP.set(x, (INDEX.f[o + 2] - BASE) * k, z), qQ, mS.set(k * INDEX.f[o + 4], k * INDEX.f[o + 5], k * INDEX.f[o + 6]));
          const n = counts[type]++; inst.mesh.setMatrixAt(n, mM); inst.mesh.setColorAt(n, tintC.setRGB(INDEX.f[o + 7], INDEX.f[o + 8], INDEX.f[o + 9])); total++;
        } }
    }
    // Transparent hull sorting also uses these bounds; stale centres made identical views path-dependent.
    for (const [type, o] of Object.entries(objs.inst)) { o.mesh.count = counts[type]; if (o.hull) o.hull.count = counts[type]; o.mesh.instanceMatrix.needsUpdate = true; if (o.mesh.instanceColor) o.mesh.instanceColor.needsUpdate = true; o.mesh.computeBoundingSphere(); if (o.hull) o.hull.computeBoundingSphere(); }
    S.loaded = total; S.counts = counts;
  }
  function buildLines() {
    const segs = []; for (const line of DATA.forest.edgeLines) { let prev = null; for (const q of line) { const F = flatOf(q.lon, q.lat), p = [F.x, (q.alt - BASE) * F.k, F.z]; if (prev) segs.push(...prev, ...p); prev = p; } }
    if (segs.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); g.computeBoundingSphere(); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x273647, transparent: true, opacity: 0, fog: false })); l.name = 'cover:ink:forest-edge'; l.matrixAutoUpdate = false; S.root.add(l); objs.lines.push(l); S.edgeSegments = segs.length / 6; }
  }
  function build_() {
    const t0 = Date.now(), K = SEC.kit(), M = SEC.state.materials, H = TERR.sampler(); WATERK = global.WATER.make(THREE);
    const RD = global.ROADS_API && (global.ROADS_API.ensure(), global.ROADS_API.data()); const avoid = [];
    const addPts = (samples, hw) => samples.forEach((p, i) => { if (i % 3 === 0) avoid.push({ lon: p.lon, lat: p.lat, r: hw + 0.8 }); });
    if (RD) { for (const r of RD.routes) addPts(r.samples, r.def.furnish && r.def.furnish.kind === 'RD05' ? 1.5 : r.def.furnish && r.def.furnish.kind === 'RD03' ? 2.4 : r.def.furnish && r.def.furnish.kind === 'RD08' ? 1.0 : 4.6); for (const b of RD.bridges) addPts(b.samples, 5.2); for (const s of RD.stairs) addPts(s.samples, 1.2); }
    if (SEC.state.chain) addPts(SEC.state.chain.samples, 3.0); for (const r of (SEC.state.roadOut || [])) if (r.centre) addPts(r.centre, 2.0);
    for (const lm of W.landmarks) if (lm.id !== 'TOWN') avoid.push({ lon: lm.lon, lat: lm.lat, r: lm.radius });
    const PL = SEC.plan(), corridor = (lon, lat) => { const uv = PL.toUV(lon, lat); return Math.abs(uv.u) < 12.8 && uv.v > 2.4 && uv.v < 24.3; };
    DATA = build(W, H, { avoid, corridor });
    const reg = W.heightField.features.filter(f => f.id === 'hill-terraces-ameni').map(f => ({ id: f.id, center: [f.lon, f.lat], radiusMeters: f.radiusMeters }));
    DATA.terrace = terraces(W, H, { terraceRegions: reg }); DATA.items.push(...DATA.terrace.items);
    DATA.forest = forest(W, H, { avoid, corridor }); DATA.items.push(...DATA.forest.items);
    DATA.grass = grassland(W, H, { avoid, corridor }); DATA.items.push(...DATA.grass.items);
    DATA.high = highland(W, H, { avoid, corridor }); DATA.items.push(...DATA.high.items);
    DATA.ice = iceField(W, H, { avoid }); DATA.lava = lavaField(W, H, { avoid });
    { const TB = global.TERRAIN.builder(W); DATA.dunes = dunes(W, H, { avoid, terrainColor: (lo, la) => TB.vertex(lo, la).c }); }
    INDEX = indexItems(DATA.items); S.data = DATA;
    buildMeshes(K, M); buildInstances(K, M); buildLines(); if (BEND.seamSplit) BEND.seamSplit(S.root);     // W8e-b: ice and other cover meshes that cross the seam are cut along it
    S.stats = { ...DATA.stats, forest: DATA.forest.stats, grass: DATA.grass.stats, dunes: DATA.dunes.stats, high: DATA.high.stats, iceCells: DATA.ice.grids.reduce((a, g) => a + g.cells, 0), lavaCells: DATA.lava.grid.cells, edgeSegments: S.edgeSegments, terraceCells: DATA.terrace.cells, terraceWalls: DATA.terrace.walls, terraceBands: DATA.terrace.bands, items: DATA.items.length, buildMs: Date.now() - t0, treadTriangles: DATA.meshes.tread.idx.length / 3, ridgeTriangles: DATA.meshes.ridge.idx.length / 3, waterTriangles: DATA.meshes.water.idx.length / 3 };
    S.built = true; return S.root;
  }
  function ensure() { if (!S.built) { SEC.ensure(); global.TERRAIN.withPrivateRandom(build_); } return S.root; }
  function visibility() { const show = BEND.get() > 0 || TERR.explore || SEC.state.mode; if (show) ensure(); if (S.root) S.root.visible = show; }
  BEND.onChange(visibility);
  TERR.onExplore(visibility);
  function tick(t, camera) {
    TIMEU.value = t; if (WATERK) { WATERK.uniforms.uTime.value = t; WATERK.uniforms.uRain.value = SEC.state.settings.rain ? 1 : 0; }
    if (!S.built || !S.root.visible) return;
    load(camera, false);
    if (objs.mist) { objs.mist.material.opacity = 0.5 + 0.12 * Math.sin(t * 0.35); objs.mist.visible = SEC.state.ink.distance > 8; }
    const ink = SEC.state.ink, g = ink.ground, a = ink.aerial; for (const h of objs.hulls) h.visible = g > 0.01; for (const l of objs.lines) { l.material.opacity = a; l.visible = a > 0.01; }
  }
  const api = { ensure, tick, state: S, data: () => DATA, objects: objs, reload: camera => load(camera, true), stats: () => ({ ...S.stats, loaded: S.loaded, counts: S.counts }) };
  global.LANDCOVER_API = api;
  return api;
};

if (typeof module !== 'undefined' && module.exports) module.exports = LANDCOVER;
else global.LANDCOVER = LANDCOVER;
})(typeof globalThis !== 'undefined' ? globalThis : this);
