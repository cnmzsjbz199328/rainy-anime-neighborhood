// Planet layout data (W1): regions, height skeleton, rivers, landmarks and the global road network.
// Coordinates: longitude (-180, 180] east positive, latitude [-90, 90] north positive, degrees.
// R = 90, so 1 deg of arc = 1.5708 m. The town is the first landmark, anchored at (0, 0) and mapped with Mercator.
// Single source of truth for the planet; later stages and tools/world_check.mjs read from here. No THREE, no DOM.
// Check with: node tools/world_check.mjs   (see docs/world/W1_SPEC.md and docs/world/WORLD_LAYOUT_V1.md)
(function (global) {
'use strict';
const LAYOUT = typeof require !== 'undefined' ? require('./layout.js') : global.LAYOUT;

const R = 90;
const SEED = 20261006;
const TOWN_BASE_HEIGHT = 1.6;
const D = Math.PI / 180;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const round1 = v => Math.round(v * 10) / 10;
const wrapLon = lon => { let l = ((lon + 180) % 360 + 360) % 360 - 180; return l === -180 ? 180 : l; };

// ---------------------------------------------------------------- spherical helpers
const pt = p => (Array.isArray(p) ? { lon: p[0], lat: p[1] } : p);
const vec = (lon, lat) => { const c = Math.cos(lat * D); return [c * Math.cos(lon * D), c * Math.sin(lon * D), Math.sin(lat * D)]; };
const vecOf = p => { p = pt(p); return vec(p.lon, p.lat); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => { const n = norm(a); return [a[0] / n, a[1] / n, a[2] / n]; };
const lonLatOf = v => ({ lon: Math.atan2(v[1], v[0]) / D, lat: Math.asin(clamp(v[2] / norm(v), -1, 1)) / D });
const angleBetween = (va, vb) => Math.atan2(norm(cross(va, vb)), dot(va, vb));   // radians

function arcDistance(a, b) { return R * angleBetween(vecOf(a), vecOf(b)); }

// Initial bearing from a to b, degrees clockwise from north.
function bearing(a, b) {
  a = pt(a); b = pt(b);
  const f1 = a.lat * D, f2 = b.lat * D, dl = (b.lon - a.lon) * D;
  const y = Math.sin(dl) * Math.cos(f2), x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return ((Math.atan2(y, x) / D) % 360 + 360) % 360;
}

function destination(a, bearingDeg, meters) {
  a = pt(a);
  const f1 = a.lat * D, l1 = a.lon * D, th = bearingDeg * D, dr = meters / R;
  const f2 = Math.asin(Math.sin(f1) * Math.cos(dr) + Math.cos(f1) * Math.sin(dr) * Math.cos(th));
  const l2 = l1 + Math.atan2(Math.sin(th) * Math.sin(dr) * Math.cos(f1), Math.cos(dr) - Math.sin(f1) * Math.sin(f2));
  return { lon: wrapLon(l2 / D), lat: f2 / D };
}

function slerp(va, vb, t) {
  const w = angleBetween(va, vb);
  if (w < 1e-9) return va.slice();
  const s = Math.sin(w), k1 = Math.sin((1 - t) * w) / s, k2 = Math.sin(t * w) / s;
  return [k1 * va[0] + k2 * vb[0], k1 * va[1] + k2 * vb[1], k1 * va[2] + k2 * vb[2]];
}

// Points along the great circle from a to b, at most stepMeters apart, endpoints included.
function greatCirclePoints(a, b, stepMeters) {
  const va = vecOf(a), vb = vecOf(b), n = Math.max(1, Math.ceil(R * angleBetween(va, vb) / stepMeters));
  const out = [];
  for (let i = 0; i <= n; i++) { const p = lonLatOf(slerp(va, vb, i / n)); out.push([p.lon, p.lat]); }
  out[0] = [pt(a).lon, pt(a).lat]; out[n] = [pt(b).lon, pt(b).lat];
  return out;
}

// Signed angular distance (degrees) from a point to the great circle through circleA and circleB.
function crossTrack(point, circleA, circleB) {
  const n = unit(cross(vecOf(circleA), vecOf(circleB)));
  return Math.asin(clamp(dot(vecOf(point), n), -1, 1)) / D;
}

// Shortest distance (meters) from p to the great-circle arc a-b (all unit vectors).
function arcPointDistance(vp, va, vb) {
  const n = cross(va, vb), nn = norm(n);
  if (nn < 1e-12) return R * Math.min(angleBetween(vp, va), angleBetween(vp, vb));
  const nu = [n[0] / nn, n[1] / nn, n[2] / nn];
  const proj = [vp[0] - dot(vp, nu) * nu[0], vp[1] - dot(vp, nu) * nu[1], vp[2] - dot(vp, nu) * nu[2]];
  const pn = norm(proj);
  if (pn > 1e-12) {
    const q = [proj[0] / pn, proj[1] / pn, proj[2] / pn];
    if (dot(cross(va, q), nu) >= 0 && dot(cross(q, vb), nu) >= 0) return R * angleBetween(vp, q);
  }
  return R * Math.min(angleBetween(vp, va), angleBetween(vp, vb));
}

// ---------------------------------------------------------------- town mapping (Mercator)
const gd = t => Math.atan(Math.sinh(t));
const gdInv = f => Math.asinh(Math.tan(f));
function townToLonLat(x, z) { return { lon: x / R / D, lat: -gd(z / R) / D }; }
function lonLatToTown(lon, lat) { return { x: R * lon * D, z: -R * gdInv(lat * D) }; }
const TOWN_HALF = LAYOUT.BASE.half;
const _tc = townToLonLat(TOWN_HALF, TOWN_HALF);
const TOWN_PATCH = { lonMin: -_tc.lon, lonMax: _tc.lon, latMin: _tc.lat, latMax: -_tc.lat };

// Distance (meters, on the sphere) from a point to the town patch (a lon/lat rectangle); 0 inside.
function townPatchDistance(lon, lat) {
  const P = TOWN_PATCH, lonIn = lon >= P.lonMin && lon <= P.lonMax, latIn = lat >= P.latMin && lat <= P.latMax;
  if (lonIn && latIn) return 0;
  if (lonIn) return R * (Math.abs(lat) - P.latMax) * D;                                   // along the meridian to the nearest parallel
  if (latIn) return R * Math.asin(clamp(Math.cos(lat * D) * Math.sin((Math.abs(lon) - P.lonMax) * D), -1, 1)); // to the edge meridian
  return arcDistance([lon, lat], [Math.sign(lon) * P.lonMax, Math.sign(lat) * P.latMax]);  // nearest corner
}
const insideTownPatch = (lon, lat) => lon > TOWN_PATCH.lonMin && lon < TOWN_PATCH.lonMax && lat > TOWN_PATCH.latMin && lat < TOWN_PATCH.latMax;


// ---------------------------------------------------------------- regions
// zone: building | ocean | wild | ice (area-budget classes). kind: finer class. Higher priority wins; unclaimed = wild grassland.
// Polygon edges are great-circle arcs; rings do not contain a pole (the caps are lat-bands) and may use longitudes beyond 180.
const iceEdge = (base, waves, sign) => lon => sign * (base + waves.reduce((s, w) => s + w[0] * Math.sin(w[1] * lon * D + w[2]), 0));
const ICE_N = { base: 66.6, waves: [[2.0, 3, 0.4], [1.1, 5, 2.1], [0.6, 9, 4.0]] };
const ICE_S = { base: 66.6, waves: [[1.7, 2, 1.0], [1.2, 4, 0.3], [0.6, 8, 2.2]] };

const regions = [
  // ice caps (D5: 8 % in total)
  { id: 'ice-north', zone: 'ice', kind: 'ice-north', priority: 100, shape: { type: 'lat-band', hemisphere: 'N', ...ICE_N, edge: iceEdge(ICE_N.base, ICE_N.waves, 1) } },
  { id: 'ice-south', zone: 'ice', kind: 'ice-south', priority: 100, shape: { type: 'lat-band', hemisphere: 'S', ...ICE_S, edge: iceEdge(ICE_S.base, ICE_S.waves, -1) } },
  // oceans: east strait, west sea (with the south gulf), back ocean
  { id: 'east-strait', zone: 'ocean', kind: 'east-strait', priority: 80, shape: { type: 'polygon', ring: [
    [40, -66], [44, -56], [48, -46], [52, -36], [54, -26], [54, -17], [53, -9.5], [54, 0], [53, 10], [54, 20], [53, 32], [48, 44], [42, 54], [38, 66],
    [58, 66], [62, 56], [68, 46], [72, 36], [71.5, 24], [70.5, 12], [69.5, 0], [69.5, -9.5], [70.5, -18], [69.5, -28], [65, -40], [59, -52], [51, -62], [44, -66]] } },
  { id: 'west-sea', zone: 'ocean', kind: 'west-sea', priority: 80, shape: { type: 'polygon', ring: [
    [-58, 66], [-60, 58], [-67, 48], [-70, 38], [-60, 28], [-58, 16], [-56, 4], [-56, -8], [-56, -20], [-59, -30], [-62, -42], [-54, -51], [-44, -55], [-30, -54],
    [-16, -56], [-2, -55], [12, -57], [22, -59], [30, -62], [30, -66], [10, -66], [-30, -66], [-70, -66],
    [-100, -66], [-98, -54], [-101, -42], [-99, -30], [-97, -18], [-101, -6], [-99, 6], [-102, 18], [-98, 30], [-101, 42], [-99, 54], [-101, 66], [-80, 66]] } },
  { id: 'back-ocean', zone: 'ocean', kind: 'back-ocean', priority: 80, shape: { type: 'polygon', ring: [
    [130, -36], [146, -39], [166, -37], [186, -40], [204, -37], [211, -34],
    [210, -26], [207, -14], [211, 0], [208, 12], [211, 24], [207, 34], [211, 42],
    [194, 47], [172, 45], [150, 48], [134, 45],
    [128, 38], [128, 28], [125, 18], [121, 14], [114, 9], [113, 3], [118, -1], [126, -6], [128, -18], [127, -28]] } },
  { id: 'island-lm08', zone: 'wild', kind: 'island', priority: 95, shape: { type: 'cap', center: [190, -8], radiusMeters: 10 } },
  // building belt: town and outer settlements (the town maps to the real Mercator patch)
  { id: 'town', zone: 'building', kind: 'town', priority: 90, shape: { type: 'lonlat-rect', ...TOWN_PATCH } },
  { id: 'farmland-main', zone: 'building', kind: 'farmland', priority: 40, shape: { type: 'polygon', ring: [
    [-56, -40], [-44, -42], [-28, -43], [-10, -42], [8, -42], [24, -41], [36, -40], [44, -30], [44, -16], [45, -2], [44, 14], [45, 28], [42, 40], [30, 43], [14, 42], [0, 40],
    [-14, 38], [-30, 36], [-44, 38], [-54, 36], [-53, 20], [-52, 4], [-52, -12], [-53, -26]] } },
  { id: 'farmland-east', zone: 'building', kind: 'farmland', priority: 40, shape: { type: 'polygon', ring: [
    [70, -36], [90, -38], [92, -20], [91, -6], [88, 6], [84, 22], [72, 24], [70, 8], [69, -10], [70, -24]] } },
  { id: 'farmland-west', zone: 'building', kind: 'farmland', priority: 40, shape: { type: 'polygon', ring: [
    [-148, -12], [-134, -14], [-120, -10], [-108, -8], [-106, 8], [-118, 14], [-132, 12], [-146, 6]] } },
  { id: 'hamlets-back-south', zone: 'building', kind: 'village', priority: 40, shape: { type: 'polygon', ring: [
    [138, -44], [160, -43], [184, -44], [206, -46], [208, -60], [184, -63], [160, -62], [140, -58]] } },
  { id: 'hamlets-back-north', zone: 'building', kind: 'village', priority: 40, shape: { type: 'polygon', ring: [
    [140, 50], [164, 50], [190, 51], [208, 46], [210, 58], [186, 62], [160, 62], [142, 58]] } },
  { id: 'farmland-west-coast', zone: 'building', kind: 'farmland', priority: 40, shape: { type: 'polygon', ring: [
    [-150, -30], [-136, -32], [-134, -12], [-133, 12], [-136, 30], [-150, 36], [-152, 4]] } },
  { id: 'village-lm02', zone: 'building', kind: 'village', priority: 60, shape: { type: 'cap', center: [-50, 36], radiusMeters: 17 } },
  { id: 'ruin-lm03', zone: 'building', kind: 'ruin', priority: 60, shape: { type: 'cap', center: [86, -27], radiusMeters: 14 } },
  { id: 'ruin-lm04', zone: 'building', kind: 'ruin', priority: 60, shape: { type: 'cap', center: [-15, -42], radiusMeters: 15 } },
  { id: 'ruin-lm05', zone: 'building', kind: 'ruin', priority: 60, shape: { type: 'cap', center: [-126.9, 33], radiusMeters: 13 } },
  { id: 'ruin-lm06', zone: 'building', kind: 'ruin', priority: 60, shape: { type: 'cap', center: [-115, -32], radiusMeters: 16 } },
  { id: 'village-lm10', zone: 'building', kind: 'village', priority: 60, shape: { type: 'cap', center: [106, 5], radiusMeters: 20 } },
  // wild
  { id: 'forest-south', zone: 'wild', kind: 'forest', priority: 30, shape: { type: 'polygon', ring: [
    [-60, -54], [-44, -50], [-28, -48], [-10, -49], [8, -48], [24, -48], [38, -52], [42, -44], [40, -36], [24, -38], [8, -40], [-10, -40], [-28, -40], [-44, -38], [-58, -36]] } },
  { id: 'forest-northeast', zone: 'wild', kind: 'forest', priority: 30, shape: { type: 'polygon', ring: [
    [4, 46], [20, 44], [40, 48], [38, 58], [22, 62], [8, 58]] } },
  { id: 'forest-east', zone: 'wild', kind: 'forest', priority: 30, shape: { type: 'polygon', ring: [
    [72, -52], [100, -52], [106, -22], [102, 30], [98, 54], [74, 54], [68, 28], [72, -2]] } },
  { id: 'forest-west', zone: 'wild', kind: 'forest', priority: 30, shape: { type: 'polygon', ring: [
    [-148, 20], [-132, 18], [-112, 22], [-110, 42], [-124, 56], [-142, 52], [-149, 36]] } },
  { id: 'desert-west', zone: 'wild', kind: 'desert', priority: 30, shape: { type: 'polygon', ring: [
    [-148, -62], [-104, -64], [-102, -18], [-120, -14], [-140, -20], [-149, -32]] } },
  { id: 'lava-north', zone: 'wild', kind: 'lava', priority: 30, shape: { type: 'cap', center: [-28, 61], radiusMeters: 22 } },
];
const DEFAULT_REGION = { id: 'default-grassland', zone: 'wild', kind: 'grassland', priority: 0, shape: null };
const regionIndex = Object.fromEntries(regions.map(r => [r.id, r]));
const byPriorityDesc = regions.map((r, i) => ({ r, i })).sort((a, b) => b.r.priority - a.r.priority || a.i - b.i).map(x => x.r);
const byPriorityAsc = byPriorityDesc.slice().reverse();

// Compile a shape into {contains(lon, lat), paintRow(lat, put(lonA, lonB))}. Painting and point queries use the same densified ring.
function compileShape(shape) {
  if (shape.type === 'cap') {
    const c = vecOf(shape.center), c0 = pt(shape.center), cosR = Math.cos(shape.radiusMeters / R);
    return {
      contains: (lon, lat) => dot(vec(lon, lat), c) >= cosR,
      row(lat) {
        const cp = Math.cos(lat * D) * Math.cos(c0.lat * D);
        if (cp < 1e-9) return Math.abs(lat - c0.lat) <= shape.radiusMeters / R / D ? [[-180, 180]] : [];
        const k = (cosR - Math.sin(lat * D) * Math.sin(c0.lat * D)) / cp;
        if (k > 1) return [];
        if (k <= -1) return [[-180, 180]];
        const w = Math.acos(k) / D;
        return [[c0.lon - w, c0.lon + w]];
      },
    };
  }
  if (shape.type === 'lonlat-rect') {
    return {
      contains: (lon, lat) => lon >= shape.lonMin && lon < shape.lonMax && lat >= shape.latMin && lat < shape.latMax,
      row: lat => (lat >= shape.latMin && lat < shape.latMax ? [[shape.lonMin, shape.lonMax]] : []),
    };
  }
  if (shape.type === 'lat-band') {
    const N = shape.hemisphere === 'N';
    return {
      contains: (lon, lat) => (N ? lat >= shape.edge(lon) : lat <= shape.edge(lon)),
      band: true,
    };
  }
  if (shape.type === 'polygon') {
    const ring = shape.ring, pts = [];
    for (let i = 0; i < ring.length; i++) {
      const seg = greatCirclePoints(ring[i], ring[(i + 1) % ring.length], 1.5);
      for (let k = 0; k < seg.length - 1; k++) pts.push(seg[k]);
    }
    // unwrap longitudes continuously, then express them relative to the ring's centre
    const un = [pts[0].slice()];
    for (let i = 1; i < pts.length; i++) { let l = pts[i][0]; const prev = un[i - 1][0]; while (l - prev > 180) l -= 360; while (l - prev < -180) l += 360; un.push([l, pts[i][1]]); }
    const lons = un.map(p => p[0]), lats = un.map(p => p[1]);
    const cLon = (Math.min(...lons) + Math.max(...lons)) / 2;
    const rel = un.map(p => [p[0] - cLon, p[1]]);
    const latMin = Math.min(...lats), latMax = Math.max(...lats), relMin = Math.min(...rel.map(p => p[0])), relMax = Math.max(...rel.map(p => p[0]));
    const n = rel.length;
    const crossings = (lat) => {
      const xs = [];
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const a = rel[j], b = rel[i];
        if ((a[1] > lat) !== (b[1] > lat)) xs.push(a[0] + (lat - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
      return xs.sort((p, q) => p - q);
    };
    return {
      contains(lon, lat) {
        if (lat < latMin || lat > latMax) return false;
        const rl = ((lon - cLon + 540) % 360 + 360) % 360 - 180;
        if (rl < relMin || rl > relMax) return false;
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const a = rel[j], b = rel[i];
          if ((a[1] > lat) !== (b[1] > lat) && rl < a[0] + (lat - a[1]) / (b[1] - a[1]) * (b[0] - a[0])) inside = !inside;
        }
        return inside;
      },
      row(lat) {
        if (lat < latMin || lat > latMax) return [];
        const xs = crossings(lat), out = [];
        for (let k = 0; k + 1 < xs.length; k += 2) out.push([xs[k] + cLon, xs[k + 1] + cLon]);
        return out;
      },
      ring: un,
    };
  }
  throw new Error('unknown shape ' + shape.type);
}
const compiled = new Map(regions.map(r => [r.id, compileShape(r.shape)]));

function regionAt(lon, lat) {
  for (const r of byPriorityDesc) if (compiled.get(r.id).contains(lon, lat)) return r;
  return DEFAULT_REGION;
}

// Paint regions onto a cell raster (cell centres), lowest priority first. Returns {nx, ny, gridDeg, cell: Uint8Array of region index + 1}.
const rasterCache = new Map();
function zoneRaster(gridDeg) {
  gridDeg = gridDeg || 0.25;
  if (rasterCache.has(gridDeg)) return rasterCache.get(gridDeg);
  const nx = Math.round(360 / gridDeg), ny = Math.round(180 / gridDeg), cell = new Uint8Array(nx * ny);
  const order = regions.map((r, i) => i);
  const put = (y, idx, a, b) => {
    const xa = Math.ceil((a + 180) / gridDeg - 0.5), xb = Math.floor((b + 180) / gridDeg - 0.5);
    if (xb - xa >= nx) { for (let x = 0; x < nx; x++) cell[y * nx + x] = idx + 1; return; }
    for (let x = xa; x <= xb; x++) cell[y * nx + ((x % nx) + nx) % nx] = idx + 1;
  };
  const sorted = order.slice().sort((p, q) => regions[p].priority - regions[q].priority || p - q);
  for (const idx of sorted) {
    const c = compiled.get(regions[idx].id);
    if (c.band) {
      for (let x = 0; x < nx; x++) {
        const lon = -180 + (x + 0.5) * gridDeg;
        for (let y = 0; y < ny; y++) if (c.contains(lon, -90 + (y + 0.5) * gridDeg)) cell[y * nx + x] = idx + 1;
      }
      continue;
    }
    for (let y = 0; y < ny; y++) for (const [a, b] of c.row(-90 + (y + 0.5) * gridDeg)) put(y, idx, a, b);
  }
  const out = { nx, ny, gridDeg, cell };
  rasterCache.set(gridDeg, out);
  return out;
}

// Area shares on a sphere: every cell weighs cos(latitude). Returns fractions of the whole sphere.
function computeAreaShares(gridDeg) {
  const ras = zoneRaster(gridDeg || 0.25), zone = {}, kind = {}, byRegion = {};
  let total = 0;
  for (let y = 0; y < ras.ny; y++) {
    const w = Math.cos((-90 + (y + 0.5) * ras.gridDeg) * D);
    for (let x = 0; x < ras.nx; x++) {
      const i = ras.cell[y * ras.nx + x], r = i ? regions[i - 1] : DEFAULT_REGION;
      zone[r.zone] = (zone[r.zone] || 0) + w; kind[r.kind] = (kind[r.kind] || 0) + w; byRegion[r.id] = (byRegion[r.id] || 0) + w; total += w;
    }
  }
  for (const o of [zone, kind, byRegion]) for (const k in o) o[k] /= total;
  return { zone, kind, region: byRegion };
}


// ---------------------------------------------------------------- height skeleton
// Land height = shore ramp x (zone base + peaks + ridges + noise); ocean = -depth shaped by distance to the coast.
// Then: river carving, landmark platforms, and the town plain (1.6 m inside the patch, blending out over 24 m).
const heightField = {
  base: { building: 1.9, wild: 2.1, ice: 2.5, ocean: 0 },
  coast: { rampMeters: 14, shelfMeters: 24 },
  oceanDepth: { 'east-strait': 2.0, 'west-sea': 3.0, 'back-ocean': 6.0 },
  noise: { amp: 0.06, scale: 32, amp2: 0.02, scale2: 14, seed: SEED },
  features: [
    // peak: absolute `height` of the summit when given, else `amp`; flat = fraction of the radius that stays level
    { id: 'ameni-dake', type: 'peak', lon: -25, lat: 56, radiusMeters: 28, height: 26, flat: 0.15, sharp: 1.6 },
    { id: 'hill-lm05', type: 'peak', lon: -126.9, lat: 33, radiusMeters: 22, amp: 6, flat: 0.45, sharp: 1.0 },
    { id: 'hill-terraces-ameni', type: 'peak', lon: -4, lat: 50, radiusMeters: 12, amp: 5, flat: 0, sharp: 1.0 },
    { id: 'hill-south-forest', type: 'peak', lon: 22, lat: -50, radiusMeters: 14, amp: 5, flat: 0, sharp: 1.0 },
    { id: 'mesa-desert', type: 'peak', lon: -132, lat: -46, radiusMeters: 12, amp: 7, flat: 0.3, sharp: 1.0 },
    { id: 'ridge-ameni-west', type: 'ridge', points: [[-44, 60], [-52, 62], [-58, 64]], halfWidthMeters: 14, height: 17, sharp: 1.3 },
    { id: 'ridge-east-spine', type: 'ridge', points: [[99.5, -56], [99.5, -40], [99.5, -27], [95, -14], [90, -4], [89, 8], [89, 24], [91, 40], [89, 54]], halfWidthMeters: 9, height: 18, sharp: 1.3 },
    { id: 'ridge-west-spine', type: 'ridge', points: [[-140, 22], [-141, 36], [-139, 50]], halfWidthMeters: 10, height: 14, sharp: 1.3 },
    { id: 'ridge-back-north', type: 'ridge', points: [[152, 60], [172, 62], [192, 60]], halfWidthMeters: 12, height: 16, sharp: 1.3 },
    { id: 'ridge-back-south', type: 'ridge', points: [[150, -52], [172, -55], [196, -54]], halfWidthMeters: 10, height: 12, sharp: 1.3 },
    // plain: the town patch is level at TOWN_BASE_HEIGHT and blends into the surroundings
    { id: 'plain-town', type: 'plain', patch: true, height: TOWN_BASE_HEIGHT, falloffMeters: 24 },
    // basins: ocean depth (positive metres below sea level at full depth, reached `shelfMeters` from the coast)
    { id: 'basin-east-strait', type: 'basin', region: 'east-strait', depth: 2.0 },
    { id: 'basin-west-sea', type: 'basin', region: 'west-sea', depth: 3.0 },
    { id: 'basin-back-ocean', type: 'basin', region: 'back-ocean', depth: 6.0 },
  ],
};

function hash3(ix, iy, iz) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483647) ^ Math.imul(SEED, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296 * 2 - 1;
}
function valueNoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const c = (a, b, d) => hash3(ix + a, iy + b, iz + d);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u), x10 = lerp(c(0, 1, 0), c(1, 1, 0), u), x01 = lerp(c(0, 0, 1), c(1, 0, 1), u), x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}
function noiseAt(lon, lat) {
  const n = heightField.noise, v = vec(lon, lat);
  return n.amp * valueNoise(v[0] * R / n.scale, v[1] * R / n.scale, v[2] * R / n.scale)
    + n.amp2 * valueNoise(v[0] * R / n.scale2 + 17.3, v[1] * R / n.scale2 + 5.1, v[2] * R / n.scale2 + 9.7);
}

// Distance from p to a polyline of [lon, lat] points (metres); cached unit vectors.
function polylineDistance(vp, vs) {
  let best = Infinity;
  for (let i = 0; i + 1 < vs.length; i++) { const d = arcPointDistance(vp, vs[i], vs[i + 1]); if (d < best) best = d; }
  return best;
}
const bell = (t, sharp) => { const b = 0.5 * (1 + Math.cos(Math.PI * clamp(t, 0, 1))); return sharp === 1 ? b : Math.pow(b, sharp); };

let FIELD = null;
function field() {
  if (FIELD) return FIELD;
  const g = 0.5, ras = zoneRaster(g), nx = ras.nx, ny = ras.ny, N = nx * ny;
  const water = new Uint8Array(N), base = new Float32Array(N), weight = new Float32Array(N), cvec = new Float32Array(N * 3);
  for (let y = 0; y < ny; y++) {
    const lat = -90 + (y + 0.5) * g;
    for (let x = 0; x < nx; x++) {
      const i = y * nx + x, lon = -180 + (x + 0.5) * g, r = ras.cell[i] ? regions[ras.cell[i] - 1] : DEFAULT_REGION;
      water[i] = r.zone === 'ocean' ? 1 : 0;
      base[i] = heightField.base[r.zone] * (1 - water[i]); weight[i] = 1 - water[i];
      const v = vec(lon, lat); cvec[i * 3] = v[0]; cvec[i * 3 + 1] = v[1]; cvec[i * 3 + 2] = v[2];
    }
  }
  // normalised box blur of the zone bases over land cells (two passes of radius k in each direction)
  const blur = (b, w, k) => {
    const tb = new Float32Array(N), tw = new Float32Array(N);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      let sb = 0, sw = 0;
      for (let d = -k; d <= k; d++) { const j = y * nx + (((x + d) % nx) + nx) % nx; sb += b[j]; sw += w[j]; }
      tb[y * nx + x] = sb; tw[y * nx + x] = sw;
    }
    const ob = new Float32Array(N), ow = new Float32Array(N);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      let sb = 0, sw = 0;
      for (let d = -k; d <= k; d++) { const yy = clamp(y + d, 0, ny - 1), j = yy * nx + x; sb += tb[j]; sw += tw[j]; }
      ob[y * nx + x] = sb; ow[y * nx + x] = sw;
    }
    return [ob, ow];
  };
  let [bb, bw] = blur(base, weight, 6); [bb, bw] = blur(bb, bw, 6);
  for (let i = 0; i < N; i++) base[i] = bw[i] > 1e-6 ? bb[i] / bw[i] : 0;
  // signed distance to the coast, from the boundary midpoints between land and water cells
  const cut = 26, cutDeg = cut / R / D, min2 = new Float32Array(N).fill(4);
  const bpts = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const i = y * nx + x, lat = -90 + (y + 0.5) * g, lon = -180 + (x + 0.5) * g, xr = (x + 1) % nx;
    if (water[i] !== water[y * nx + xr]) bpts.push([lon + g / 2, lat]);
    if (y + 1 < ny && water[i] !== water[(y + 1) * nx + x]) bpts.push([lon, lat + g / 2]);
  }
  for (const [blon, blat] of bpts) {
    const bv = vec(blon, blat), y0 = Math.max(0, Math.floor((blat - cutDeg + 90) / g)), y1 = Math.min(ny - 1, Math.floor((blat + cutDeg + 90) / g));
    for (let y = y0; y <= y1; y++) {
      const lat = -90 + (y + 0.5) * g, cl = Math.max(Math.cos(Math.max(Math.abs(lat), Math.abs(blat)) * D), 0.02);
      const span = Math.min(Math.ceil(cutDeg / cl / g) + 1, nx >> 1), xc = Math.floor((blon + 180) / g);
      for (let dx = -span; dx <= span; dx++) {
        const i = y * nx + (((xc + dx) % nx) + nx) % nx;
        const a = cvec[i * 3] - bv[0], b = cvec[i * 3 + 1] - bv[1], c = cvec[i * 3 + 2] - bv[2], d2 = a * a + b * b + c * c;
        if (d2 < min2[i]) min2[i] = d2;
      }
    }
  }
  const sdf = new Float32Array(N);
  for (let i = 0; i < N; i++) { const d = min2[i] >= 4 ? 99 : Math.min(99, R * 2 * Math.asin(Math.sqrt(min2[i]) / 2)); sdf[i] = water[i] ? -d : d; }
  FIELD = { nx, ny, g, base, sdf };
  return FIELD;
}
function sampleGrid(arr, lon, lat) {
  const F = field(), fx = (lon + 180) / F.g - 0.5, fy = clamp((lat + 90) / F.g - 0.5, 0, F.ny - 1.001);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, nx = F.nx;
  const at = (x, y) => arr[y * nx + (((x % nx) + nx) % nx)];
  return lerp(lerp(at(x0, y0), at(x0 + 1, y0), tx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx), ty);
}
const coastDistance = (lon, lat) => sampleGrid(field().sdf, lon, lat);   // metres, positive on land

function featureHeight(f, lon, lat, vp) {
  if (f.type === 'peak') {
    const d = arcDistance([lon, lat], [f.lon, f.lat]) / f.radiusMeters;
    if (d >= 1) return 0;
    return f.amp * bell((d - f.flat) / (1 - f.flat), f.sharp);
  }
  if (f.type === 'ridge') {
    if (!f._v) f._v = f.points.map(p => vec(p[0], p[1]));
    const d = polylineDistance(vp, f._v) / f.halfWidthMeters;
    return d >= 1 ? 0 : f.height * bell(d, f.sharp);
  }
  return 0;
}

// Raw terrain before rivers, platforms and the town plain.
function heightRaw(lon, lat, skip) {
  const vp = vec(lon, lat), c = coastDistance(lon, lat);
  if (c < 0) {
    const r = regionAt(lon, lat), depth = heightField.oceanDepth[r.kind] !== undefined ? heightField.oceanDepth[r.kind] : 2;
    return -depth * smoothstep(0, heightField.coast.shelfMeters, -c);
  }
  // the summit of an absolute-height peak stays free of noise so that it is exactly the highest point
  let quiet = 1;
  for (const f of heightField.features) if (f.type === 'peak' && f.height !== undefined) { const fr = f.flat * f.radiusMeters; quiet = Math.min(quiet, smoothstep(fr, fr + 10, arcDistance([lon, lat], [f.lon, f.lat]))); }
  let h = sampleGrid(field().base, lon, lat) + quiet * noiseAt(lon, lat);
  let m = 0;                                  // peaks and ridges combine by maximum: a ridge joining a summit never stacks on it
  for (const f of heightField.features) if (f !== skip && (f.type === 'peak' || f.type === 'ridge')) m = Math.max(m, featureHeight(f, lon, lat, vp));
  return (h + m) * smoothstep(0, heightField.coast.rampMeters, c);
}

// ---------------------------------------------------------------- rivers
const rivers = [
  { id: 'ameni-gawa', width: 3, points: [[-49, 24], [-50, 15], [-51, 6], [-52, -4], [-52, -18], [-51, -32], [-48, -44], [-46, -53], [-45, -58]] },
  { id: 'east-river', width: 2.5, points: [[92, 24], [98, 26], [106, 30], [114, 32], [122, 33], [130, 33]] },
  { id: 'west-river', width: 2.5, points: [[-139, 42], [-144, 40], [-150, 40], [-155, 40]] },
];
function riverGeometry(rv) {
  if (rv._dense) return rv._dense;
  const pts = [];
  for (let i = 0; i + 1 < rv.points.length; i++) { const seg = greatCirclePoints(rv.points[i], rv.points[i + 1], 1); for (let k = 0; k < seg.length - 1; k++) pts.push(seg[k]); }
  pts.push(rv.points[rv.points.length - 1]);
  const vs = pts.map(p => vec(p[0], p[1])), s = [0];
  for (let i = 1; i < vs.length; i++) s.push(s[i - 1] + R * angleBetween(vs[i - 1], vs[i]));
  // bed profile: terrain minus the channel depth, forced to be non-increasing downstream
  const bed = []; let run = Infinity;
  for (let i = 0; i < pts.length; i++) { run = Math.min(run, heightPre(pts[i][0], pts[i][1]) - 0.35); bed.push(run); }
  rv._dense = { pts, vs, s, bed };
  return rv._dense;
}
function riverCrossing(lon, lat) {
  const vp = vec(lon, lat); let best = Infinity;
  for (const rv of rivers) { const d = polylineDistance(vp, riverGeometry(rv).vs) - rv.width / 2; if (d < best) best = d; }
  return best;
}
function riverCarve(lon, lat, h) {
  const vp = vec(lon, lat);
  for (const rv of rivers) {
    const G = riverGeometry(rv);
    let bi = -1, bd = Infinity;
    for (let i = 0; i < G.vs.length; i++) { const d = R * angleBetween(vp, G.vs[i]); if (d < bd) { bd = d; bi = i; } }
    const reach = rv.width / 2 + 5;
    if (bd > reach + 1.5) continue;
    const d = polylineDistance(vp, G.vs);
    if (d >= reach) continue;
    const w = 1 - smoothstep(rv.width / 2, reach, d);
    h = lerp(h, Math.min(h, G.bed[bi]), w);
  }
  return h;
}

// ---------------------------------------------------------------- landmarks
// lon/lat is the site anchor (local-plane centre); entrances are where roads attach, offset along `heading` (W1 ruling, see WORLD_LAYOUT_V1.md).
const LM = (id, name, lon, lat, zone, kind, card, radius, entrances, check) => ({ id, name, lon, lat, zone, kind, card, radius, entrances, check: check || {} });
const landmarks = [
  LM('TOWN', '雨音街角', 0, 0, 'building', 'town', 'layout v1', TOWN_HALF, [], { height: [TOWN_BASE_HEIGHT - 0.05, TOWN_BASE_HEIGHT + 0.05] }),
  LM('LM01', '雨见岳', -25, 56, 'wild', 'volcano', 'docs/world/cards/LM01.md', 8, [{ id: 'west', heading: 300, offset: 10 }, { id: 'north', heading: 15, offset: 27.5 }], { height: [25.9, 26.1] }),
  LM('LM02', '湯けむり温泉村', -50, 36, 'building', 'village', 'docs/world/cards/LM02.md', 15, [{ id: 'east', heading: 100, offset: 17 }, { id: 'northeast', heading: 41, offset: 17 }], { maxSlope: 0.15 }),
  LM('LM03', '苔石古坟群', 86, -27, 'building', 'ruin', 'docs/world/cards/LM03.md', 12, [{ id: 'north', heading: 0, offset: 14 }], { maxSlope: 0.15 }),
  LM('LM04', '森中废神社', -15, -42, 'building', 'ruin', 'docs/world/cards/LM04.md', 15, [{ id: 'southeast', heading: 120, offset: 17 }], { maxSlope: 0.15 }),
  LM('LM05', '星见石环', -126.9, 33, 'building', 'ruin', 'docs/world/cards/LM05.md', 10, [{ id: 'west', heading: 300, offset: 12 }], { maxSlope: 0.05 }),
  LM('LM06', '砂没驿', -115, -32, 'building', 'ruin', 'docs/world/cards/LM06.md', 15, [{ id: 'north', heading: 0, offset: 17 }], { maxSlope: 0.15 }),
  LM('LM07', '冰封轮廓', 100, 76, 'ice', 'ice-field', 'docs/world/cards/LM07.md', 8, [{ id: 'west', heading: 280, offset: 10 }], { maxSlope: 0.15 }),
  LM('LM08', '灯塔岛', 190, -8, 'wild', 'island', 'docs/world/cards/LM08.md', 8, [{ id: 'south', heading: 180, offset: 9.5 }], { maxSlope: 0.4 }),
  LM('LM09', '乡间无人站', -40, -18, 'building', 'farmland', 'docs/world/cards/LM09.md', 10, [{ id: 'north', heading: 0, offset: 13.35 }], { maxSlope: 0.10 }),
  LM('LM10', '小渔港', 106, 5, 'building', 'village', 'docs/world/cards/LM10.md', 17, [{ id: 'south', heading: 180, offset: 22.78 }], { maxSlope: 0.4 }),
];
for (const lm of landmarks) {
  lm.heading = lm.entrances.length ? lm.entrances[0].heading : 180;
  lm.entrances.forEach(e => { const p = destination(lm, e.heading, e.offset); e.lon = p.lon; e.lat = p.lat; });
  lm.entrance = lm.entrances.length ? { lon: lm.entrances[0].lon, lat: lm.entrances[0].lat } : townToLonLat(0, -48);
  lm.footprint = { type: 'cap', radiusMeters: lm.radius };
}


// ---------------------------------------------------------------- final height()
let PREPARED = false;
const platforms = [];
function prepare() {
  if (PREPARED) return;
  PREPARED = true;
  for (const f of heightField.features) if (f.type === 'peak' && f.height !== undefined) f.amp = f.height - heightRaw(f.lon, f.lat, f);
  for (const lm of landmarks) {
    if (lm.id === 'TOWN' || lm.check.maxSlope === undefined || lm.check.maxSlope > 0.15) continue;
    const f = { id: 'plat-' + lm.id, type: 'plain', lon: lm.lon, lat: lm.lat, radiusMeters: lm.radius, falloffMeters: 10 };
    f.height = heightRaw(lm.lon, lm.lat);
    platforms.push(f); heightField.features.push(f);
  }
}
// terrain with landmark platforms, before the river channels and the town plain
function heightPre(lon, lat) {
  prepare();
  let h = heightRaw(lon, lat);
  for (const f of platforms) {
    const d = arcDistance([lon, lat], [f.lon, f.lat]);
    if (d < f.radiusMeters + f.falloffMeters) h = lerp(h, f.height, 1 - smoothstep(f.radiusMeters, f.radiusMeters + f.falloffMeters, d));
  }
  return h;
}
function height(lon, lat) {
  if (insideTownPatch(lon, lat)) return TOWN_BASE_HEIGHT;
  let h = riverCarve(lon, lat, heightPre(lon, lat));
  const dt = townPatchDistance(lon, lat), fall = heightField.features.find(f => f.id === 'plain-town').falloffMeters;
  if (dt < fall) h = TOWN_BASE_HEIGHT + (h - TOWN_BASE_HEIGHT) * smoothstep(0, fall, dt);
  return h;
}
for (const lm of landmarks) Object.defineProperty(lm, 'baseHeight', { enumerable: true, get() { return round1(height(lm.lon, lm.lat)); } });

// ---------------------------------------------------------------- road network
// Spans are stretches where the road leaves the terrain: bridge, tunnel, boardwalk (RD07 piles) and stairs (RD06 steps).
const LATR = townToLonLat(0, 15).lat;                                   // R01 centre line, the latitude of T01 near the town
const townExit = id => { const n = LAYOUT.roadNodes.find(q => q.id === id); const p = townToLonLat(n.x, n.z); return { id, lon: p.lon, lat: p.lat, kind: 'town-exit' }; };
const entranceNode = (lmId, entId) => {
  const lm = landmarks.find(l => l.id === lmId), e = lm.entrances.find(q => q.id === entId);
  return { id: `${lmId}-${entId}`, lon: e.lon, lat: e.lat, kind: 'landmark-entrance', landmark: lmId };
};
const J = (id, lon, lat, kind) => ({ id, lon, lat, kind: kind || 'junction' });
const lmById = id => landmarks.find(l => l.id === id);
// Stairs wind around a hill or the cone so that the steps stay at or below 60 %: intermediate points from (r0, b0) to (r1, b1) around a landmark.
const spiral = (lmId, from, to, steps) => {
  const lm = lmById(lmId), r0 = arcDistance(lm, from), b0 = bearing(lm, from), ent = lm.entrances.find(e => e.id === to);
  const sweep = -(((b0 - ent.heading) % 360) + 360) % 360;                // counter-clockwise from the start to the entrance bearing
  const out = [];
  for (let k = 1; k < steps; k++) { const f = k / steps, q = destination(lm, b0 + sweep * f, lerp(r0, ent.offset, f)); out.push([q.lon, q.lat]); }
  return out;
};
const nodes = [
  ...['N01', 'N03', 'N04', 'N08', 'N09', 'N10', 'N11', 'N12', 'N13'].map(townExit),
  // bridge abutments sit at least the 14 m beach ramp inland of the coast, so that the road leaves the terrain before the slope starts
  J('J-T04', 38.5, LATR), J('J-E1', 43.3, LATR), J('J-E2', 79.2, LATR), J('J-T07', 81, LATR), J('J-E3', 116.9, LATR), J('J-P1', 151, -14.5),
  J('J-LM08', 190, -17.5), J('J-W3', -142.9, -12), J('J-T08', -128, -12), J('J-T09', -116, -12), J('J-W2', -108.8, -12), J('J-W1', -46.3, -12),
  J('J-T03a', 1, -33), J('J-T03b', 2, -39), J('J-T08b', -127.5, 15),
  J('E-N11', -35.5, -25, 'endpoint'), J('E-N12', 35.5, -21, 'endpoint'), J('E-N13', 35.5, 22, 'endpoint'), J('E-T11', 24, -61, 'endpoint'),
  ...[['LM01', 'west'], ['LM01', 'north'], ['LM02', 'east'], ['LM02', 'northeast'], ['LM03', 'north'], ['LM04', 'southeast'], ['LM05', 'west'], ['LM06', 'north'], ['LM07', 'west'], ['LM08', 'south'], ['LM09', 'north'], ['LM10', 'south']].map(a => entranceNode(...a)),
];
const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]));

const edges = [];
// spans: [type, fromMeters, toMeters | 'end']
const E = (id, route, cls, from, to, mids, spans) => edges.push({ id, route, class: cls, from, to, controls: [[nodeById[from].lon, nodeById[from].lat], ...(mids || []), [nodeById[to].lon, nodeById[to].lat]], spans: (spans || []).map(([type, a, b]) => ({ type, fromMeters: a, toMeters: b })) });
const ALL = 'end';
E('T01-01', 'T01', 'RD01', 'N03', 'J-T04');
E('T01-02', 'T01', 'RD01', 'J-T04', 'J-E1');
E('T01-03', 'T01', 'RD02', 'J-E1', 'J-E2', [], [['bridge', 0, ALL]]);
E('T01-04', 'T01', 'RD01', 'J-E2', 'J-T07');
E('T01-05', 'T01', 'RD01', 'J-T07', 'LM10-south', [], [['tunnel', 6.5, 29.5]]);
E('T01-06', 'T01', 'RD01', 'LM10-south', 'J-E3');
E('T01-07', 'T01', 'RD02', 'J-E3', 'J-P1', [[134, -12]], [['bridge', 0, ALL]]);
E('T01-08', 'T01', 'RD02', 'J-P1', 'J-LM08', [[172, -17]], [['bridge', 0, ALL]]);
E('T01-09', 'T01', 'RD02', 'J-LM08', 'J-W3', [[-160, -16]], [['bridge', 0, ALL]]);
E('T01-10', 'T01', 'RD01', 'J-W3', 'J-T08');
E('T01-11', 'T01', 'RD01', 'J-T08', 'J-T09');
E('T01-12', 'T01', 'RD01', 'J-T09', 'J-W2');
E('T01-13', 'T01', 'RD02', 'J-W2', 'J-W1', [], [['bridge', 0, ALL]]);
E('T01-14', 'T01', 'RD01', 'J-W1', 'LM09-north');
E('T01-15', 'T01', 'RD01', 'LM09-north', 'N01');
E('T02-01', 'T02', 'RD03', 'N04', 'LM02-east', [[-12, 31], [-26, 33]]);
E('T02-02', 'T02', 'RD06', 'LM02-northeast', 'LM01-west', spiral('LM01', nodeById['LM02-northeast'], 'west', 14), [['stairs', 0, ALL]]);
E('T03-01', 'T03', 'RD03', 'N08', 'J-T03a');
E('T03-02', 'T03', 'RD04', 'J-T03a', 'J-T03b');
E('T03-03', 'T03', 'RD05', 'J-T03b', 'LM04-southeast');
E('T04-01', 'T04', 'RD03', 'N10', 'J-T04', [[37, 4]]);
E('T05-01', 'T05', 'RD03', 'N09', 'LM09-north', [[-35, 1]]);
E('T06-01', 'T06', 'RD05', 'N11', 'E-N11');
E('T06-02', 'T06', 'RD05', 'N12', 'E-N12');
E('T06-03', 'T06', 'RD05', 'N13', 'E-N13');
E('T07-01', 'T07', 'RD05', 'J-T07', 'LM03-north');
E('T08-01', 'T08', 'RD05', 'J-T08', 'J-T08b');
E('T08-02', 'T08', 'RD06', 'J-T08b', 'LM05-west', spiral('LM05', nodeById['J-T08b'], 'west', 8), [['stairs', 0, ALL]]);
E('T09-01', 'T09', 'RD05', 'J-T09', 'LM06-north');
E('T10-01', 'T10', 'RD08', 'LM01-north', 'LM07-west');
E('T11-01', 'T11', 'RD07', 'LM04-southeast', 'E-T11', [[-1, -55.5], [12, -58.5]], [['boardwalk', 0, ALL]]);
E('T11-02', 'T11', 'RD07', 'J-LM08', 'LM08-south', [], [['boardwalk', 0, ALL]]);

// Dense geometry of an edge (great-circle legs between controls), cached.
function edgeGeometry(edge) {
  if (edge._geo) return edge._geo;
  const pts = [];
  for (let i = 0; i + 1 < edge.controls.length; i++) { const seg = greatCirclePoints(edge.controls[i], edge.controls[i + 1], 0.5); for (let k = 0; k < seg.length - 1; k++) pts.push(seg[k]); }
  pts.push(edge.controls[edge.controls.length - 1]);
  const vs = pts.map(p => vec(p[0], p[1])), s = [0];
  for (let i = 1; i < vs.length; i++) s.push(s[i - 1] + R * angleBetween(vs[i - 1], vs[i]));
  edge._geo = { vs, s, length: s[s.length - 1] };
  return edge._geo;
}
const edgeLength = edge => edgeGeometry(edge).length;
const spanEnd = (sp, len) => (sp.toMeters === 'end' ? len : sp.toMeters);
// Samples along an edge every stepMeters: {lon, lat, s (metres from the start), h (terrain), span (type or null)}.
function samplePath(edge, stepMeters) {
  const G = edgeGeometry(edge), n = Math.max(1, Math.round(G.length / stepMeters)), out = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = G.length * k / n;
    while (j + 2 < G.s.length && G.s[j + 1] < s) j++;
    const t = G.s[j + 1] > G.s[j] ? clamp((s - G.s[j]) / (G.s[j + 1] - G.s[j]), 0, 1) : 0;
    const p = lonLatOf(unit([lerp(G.vs[j][0], G.vs[j + 1][0], t), lerp(G.vs[j][1], G.vs[j + 1][1], t), lerp(G.vs[j][2], G.vs[j + 1][2], t)]));
    const span = edge.spans.find(sp => s >= sp.fromMeters - 1e-9 && s <= spanEnd(sp, G.length) + 1e-9);
    out.push({ lon: p.lon, lat: p.lat, s, h: height(p.lon, p.lat), span: span ? span.type : null });
  }
  return out;
}
const roadNetwork = { nodes, edges, nodeById, edgeLength, samplePath, LATR };

const areaBudget = { computeAreaShares, targets: { building: 0.30, ocean: 0.30, wild: 0.32, ice: 0.08 }, tolerance: 0.02 };

const WORLD = { R, SEED, TOWN_BASE_HEIGHT, TOWN_PATCH, townToLonLat, lonLatToTown, arcDistance, bearing, greatCirclePoints, crossTrack, destination,
  regions, regionAt, zoneRaster, computeAreaShares, areaBudget, heightField, height, coastDistance, townPatchDistance, insideTownPatch,
  rivers, riverCrossing, landmarks, roadNetwork, vec, angleBetween, arcPointDistance };
if (typeof module !== 'undefined' && module.exports) module.exports = WORLD;
else global.WORLD = WORLD;
})(typeof globalThis !== 'undefined' ? globalThis : this);
