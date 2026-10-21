// Planet terrain mesh (W3). Reads world.js (frozen planet layout) and builds:
//   - the terrain mesh in flat Mercator coordinates, rolled onto the sphere by bend.js (see docs/world/W3_SPEC.md section 2):
//       x = R lon, z = -R asinh(tan lat), y_flat = (height - 1.6) / cos lat   (bend multiplies y by cos lat again)
//   - continuous terrain through the town plain, split into build chunks only
//   - two polar caps (|lat| > 85 deg) in native sphere coordinates, excluded from the bend (material.userData.noBend)
// The mesh builder is pure (no THREE, no DOM) so tools/terrain_check.mjs can run it under Node.
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6, RING_M = 24, STEP = 1;                     // lattice: one ring of vertices per degree (1.5708 m)
const FLAT_LAT = 85;                                                                     // flat mesh covers -85..85, caps beyond
const CHUNK_DEG = 15, ANCHOR_LON = -25;                                                  // 24 x 12 chunks; the volcano meridian is a vertex column

const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255].map(srgb);
// Night palette (WORLD_SPEC): low-saturation blue-green plants, lilac-grey sand and ruins, blue-white ice, grey-cyan to indigo water.
const KIND_COLOR = {
  town: hex('#5d7658'), farmland: hex('#5d7658'),   // 'town' only occurs on vertices that sit exactly on the patch edge: use the farmland colour so there is no blue seam
  village: hex('#6f7758'), ruin: hex('#6b6d78'), forest: hex('#2f5a52'), grassland: hex('#55745a'),
  desert: hex('#8a8394'), lava: hex('#3a3436'), island: hex('#6e6a68'), 'ice-north': hex('#cfe0ee'), 'ice-south': hex('#cfe0ee'),
};
const ROCK = hex('#6f6b78'), SNOW = hex('#d6e4f0');
const SHALLOW = hex('#5f8fa0'), DEEP = hex('#1f3a66'), SAND = hex('#8a8794');
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// a piece's fan triangle narrower than 10 um in plan (the cut's collinear points): it covers nothing, and once sealOutline moves one of its corners it stands up as
// a thin wall over a road (TERRAIN_HOLE_REPAIR_PLAN 4.3); the terrain cuts leave it out
const sliverXZ = (a, b, c) => { const ar = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])), l = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(c[0] - b[0], c[1] - b[1]), Math.hypot(a[0] - c[0], a[1] - c[1])); return !(l > 0) || ar / l < 1e-5; };
// the corner a convex piece is fanned from: the first whose fan has no zero-width triangle (collinear points of a cut's outline then stay corners of the triangles along
// it, so the edge keeps the next surface's own vertices instead of one long chord past them, which leant over an end row on the sphere: TERRAIN_HOLE_FOLLOWUP_PLAN A7)
const fanOrigin = poly => { const n = poly.length; if (n <= 3) return 0; for (let o = 0; o < n; o++) { let ok = true; for (let k = 1; k + 1 < n && ok; k++) if (sliverXZ(poly[o], poly[(o + k) % n], poly[(o + k + 1) % n])) ok = false; if (ok) return o; } return 0; };
const polygonAreaXZ = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a * 0.5; };
const CUT_EPS = 1e-3; // 1 mm tolerance for Float32 road rows against double-precision cut polygons
const CUT_PAD = 0.12; // Keep ground a handspan outside the swept right-of-way so Float32 edges cannot leave grass slivers on the pavement.
const GROUND_CAP = 0.002; // m past a route's open end for the ground overlays that cutGroundMeshes cuts (not the terrain: TERRAIN_HOLE_FOLLOWUP_PLAN A1)
const SEAL_MAX = 1.2; // true metres: a cut edge takes the height of the surface that replaces it when they differ by no more (TERRAIN_HOLE_REPAIR_PLAN 4.3; a road's side slope can end 1.08 m over the ground)
// A cut vertex lies on the replacing surface's outline only to Float32 (about 0.01 mm here) and to the cut's own tolerance: the road cut's CUT_EPS is a cross product,
// so a vertex within 1 mm / edge length outside a clip edge counts as on it (2 mm on a row's 0.5 m side), the occupancy cut's 1e-8 is exact. The seal finds the surface
// within that reach of the vertex, the point clamped onto the triangle (no slope is extrapolated): 2.5 mm for the road surfaces, 0.5 mm for the ground occupancy (less
// than the overlays' 2 mm cap, GROUND_CAP: the terrain between an end row and a landmark ground meets each on its own side). TERRAIN_HOLE_FOLLOWUP_PLAN A1/A5: with the
// -1e-6 barycentric margin of before, a vertex 5 um off J-T07's paving found no surface and kept the lattice height 0.2 m under it.
const SEAL_TOL = 2.5e-3, SEAL_TOL_GROUND = 5e-4;
function weightsXZ(ax, az, bx, bz, cx, cz, x, z, tol = SEAL_TOL) {
  const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz), A = Math.abs(den); if (A < 1e-14) return null;
  const w0 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, w1 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, w2 = 1 - w0 - w1;
  if (w0 >= 0 && w1 >= 0 && w2 >= 0) return [w0, w1, w2];
  // w times the altitude over the opposite edge (|den| / its length) is the signed distance to that edge
  if (w0 * A / Math.hypot(cx - bx, cz - bz) < -tol || w1 * A / Math.hypot(ax - cx, az - cz) < -tol || w2 * A / Math.hypot(bx - ax, bz - az) < -tol) return null;
  const c0 = Math.max(0, w0), c1 = Math.max(0, w1), c2 = Math.max(0, w2), s = c0 + c1 + c2; return [c0 / s, c1 / s, c2 / s];
}
function splitPolygonXZ(poly, a, b, sign, eps = CUT_EPS) {
  const inside = [], outside = [], side = p => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q), ip = sp >= -eps, iq = sq >= -eps;
    if (ip) inside.push(p); else outside.push(p);
    // the crossing; where the tolerance counted one end on the line and both lie on its outer side, the line does not cross this edge: that end's projection onto the line
    // (on it, by that end), not a point past the end on the edge's extension, which made a non-convex piece whose fan folded over its neighbours (TERRAIN_HOLE_FOLLOWUP_PLAN,
    // unify_check U5 at M01-south's end)
    if (ip !== iq && sp !== sq) { const t = sp / (sp - sq); let x;
      if (t >= 0 && t <= 1) x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      else { const r = Math.abs(sp) < Math.abs(sq) ? p : q, sr = r === p ? sp : sq, gx = -sign * (b[1] - a[1]), gz = sign * (b[0] - a[0]), g2 = gx * gx + gz * gz; x = [r[0] - sr * gx / g2, r[1] - sr * gz / g2]; }
      inside.push(x); outside.push(x); }
  }
  const clean = p => p.filter((q, i) => Math.hypot(q[0] - p[(i + p.length - 1) % p.length][0], q[1] - p[(i + p.length - 1) % p.length][1]) > 1e-8);
  return [clean(inside), clean(outside)];
}
// A row interval of a swept road as convex pieces for the cuts (subtractConvexXZ takes a convex clip). It is a convex quad [a0, a1, b1, b0] unless its two
// rows cross, which they do on the inner side of a turn sharper than the half width (the swept cells fold there: C01-S); then it is the two triangles
// either side of the crossing point. A quad with one reflex corner is split along the diagonal from that corner. (CR01_HOUSE_GRASS_INTRUSION_PLAN.md: a
// crossed quad taken as one clip left the ground over M01-south's ditch outside the turn uncut.)
function convexPartsXZ(q) {
  const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), t = q.map((p, i) => turn(q[(i + 3) % 4], p, q[(i + 1) % 4]));
  if (t.every(v => v >= -1e-12) || t.every(v => v <= 1e-12)) return { parts: [q], kind: null };
  const meet = (a, b, c, d) => { const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-15) return null;
    const u = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, v = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den; return u > 0 && u < 1 && v > 0 && v < 1 ? [a[0] + r[0] * u, a[1] + r[1] * u] : null; };
  let X = meet(q[0], q[1], q[2], q[3]); if (X) return { parts: [[q[0], X, q[3]], [X, q[1], q[2]]], kind: 'crossed' };
  X = meet(q[1], q[2], q[3], q[0]); if (X) return { parts: [[q[0], q[1], X], [X, q[2], q[3]]], kind: 'crossed' };
  const sign = Math.sign(polygonAreaXZ(q)), k = t.findIndex(v => Math.abs(v) > 1e-12 && Math.sign(v) !== sign);
  return { parts: [[q[k], q[(k + 1) % 4], q[(k + 2) % 4]], [q[(k + 2) % 4], q[(k + 3) % 4], q[k]]], kind: 'reflex' };
}
function subtractConvexXZ(subject, clip, eps = CUT_EPS) {
  let rest = subject; const outside = [], sign = polygonAreaXZ(clip) >= 0 ? 1 : -1;
  for (let i = 0; i < clip.length && rest.length >= 3; i++) {
    const [inside, out] = splitPolygonXZ(rest, clip[i], clip[(i + 1) % clip.length], sign, eps);
    if (out.length >= 3 && Math.abs(polygonAreaXZ(out)) > 1e-10) outside.push(out);
    rest = inside;
  }
  return outside;
}
// the part of a convex polygon where the linear function f (of x, z) is > 0 (keep > 0) or < 0
function clipLinearXZ(poly, f, keepPositive) {
  const out = [], val = poly.map(p => (keepPositive ? f(p) : -f(p)));
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length, a = val[i], b = val[j];
    if (a > 0) out.push(poly[i]);
    if ((a > 0) !== (b > 0) && a !== b) { const t = a / (a - b), p = poly[i], q = poly[j]; out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out.length >= 3 && Math.abs(polygonAreaXZ(out)) > 1e-10 ? out : null;
}
// the plane through three points (plan [x, z], heights y) as a function of (x, z); null if they are collinear in plan
function planeXZ(p, y) {
  const den = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]); if (Math.abs(den) < 1e-14) return null;
  return q => { const w0 = ((p[1][1] - p[2][1]) * (q[0] - p[2][0]) + (p[2][0] - p[1][0]) * (q[1] - p[2][1])) / den, w1 = ((p[2][1] - p[0][1]) * (q[0] - p[2][0]) + (p[0][0] - p[2][0]) * (q[1] - p[2][1])) / den; return w0 * y[0] + w1 * y[1] + (1 - w0 - w1) * y[2]; };
}
// A structure's volume against one planar piece of ground (W10 tunnel fix): `parts` are roads.js tunnelEnvelope(): the top of the structure as triangles in the flat frame
// with the height of its foot under them. Inside a triangle the ground (plane g) lies in the structure where it is under the top and over the foot: both are planes there, so
// that is a convex polygon, and it goes from the piece. The ground keeps the hill over the top (its new edge is where it meets the top, on the structure's surface) and the
// ground under the foot. The parts are taken one after the other; the pieces stay convex. Returns null if the piece does not reach into the structure.
function cutStructureXZ(piece, g, parts) {
  let pieces = [piece], hit = false;
  const box = p => [Math.min(...p.map(q => q[0])), Math.max(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[1]))];
  for (const part of parts) {
    if (part.box[1] < box(piece)[0] || part.box[0] > box(piece)[1] || part.box[3] < box(piece)[2] || part.box[2] > box(piece)[3]) continue;
    const next = [];
    for (const pc of pieces) {
      const pb = box(pc), holes = [];
      for (const c of part.cells) {
        if (c.box[1] < pb[0] || c.box[0] > pb[1] || c.box[3] < pb[2] || c.box[2] > pb[3]) continue;
        for (const t of c.tris) {
          if (t.box[1] < pb[0] || t.box[0] > pb[1] || t.box[3] < pb[2] || t.box[2] > pb[3]) continue;
          let q = pc; for (let e = 0; e < 3 && q; e++) { const a = t.p[e], b = t.p[(e + 1) % 3], sg = t.sign; q = clipLinearXZ(q, r => sg * ((b[0] - a[0]) * (r[1] - a[1]) - (b[1] - a[1]) * (r[0] - a[0])), true); }
          if (!q) continue;
          q = clipLinearXZ(q, r => t.top(r) - g(r), true); if (q) q = clipLinearXZ(q, r => g(r) - t.foot(r), true);
          if (q) holes.push(q);
        }
      }
      if (!holes.length) { next.push(pc); continue; }
      hit = true; let rest = [pc];
      for (const h of holes) { const hb = box(h); rest = rest.flatMap(r => { const rb = box(r); return rb[1] < hb[0] || rb[0] > hb[1] || rb[3] < hb[2] || rb[2] > hb[3] ? [r] : subtractConvexXZ(r, h, 1e-9); }); }
      next.push(...rest);
    }
    pieces = next;
  }
  return hit ? pieces : null;
}
// the envelope parts with their bounding boxes and planes (once per build)
function prepareStructureParts(parts) {
  const box = p => [Math.min(...p.map(q => q[0])), Math.max(...p.map(q => q[0])), Math.min(...p.map(q => q[1])), Math.max(...p.map(q => q[1]))];
  return parts.map(part => {
    const cells = part.cells.map(c => ({ box: box(c.quad), tris: c.tris.map(t => ({ p: t.p, box: box(t.p), sign: polygonAreaXZ(t.p) >= 0 ? 1 : -1, top: planeXZ(t.p, t.top), foot: planeXZ(t.p, t.foot) })).filter(t => t.top && t.foot) }));
    return { kind: part.kind, end: part.end, cells, box: [Math.min(...cells.map(c => c.box[0])), Math.max(...cells.map(c => c.box[1])), Math.min(...cells.map(c => c.box[2])), Math.max(...cells.map(c => c.box[3]))] };
  });
}

function builder(W) {
  const P = W.TOWN_PATCH, EPS = 1e-9;
  const flatX = lon => R * lon * D, flatZ = lat => -R * Math.asinh(Math.tan(lat * D));

  // latitude rings: every degree, plus the rings on the patch's south and north edges
  const lats = [];
  for (let l = -FLAT_LAT; l <= FLAT_LAT; l += STEP) lats.push(l);
  lats.push(P.latMin, P.latMax); lats.sort((a, b) => a - b);
  const ringLons = lat => {
    const n = Math.max(8, Math.round(2 * Math.PI * R * Math.cos(lat * D) / (R * STEP * D))), dl = 360 / n;
    const must = [-180, 180, ANCHOR_LON, -P.lonMax, P.lonMax], set = new Set(must);
    for (let k = -Math.ceil(540 / dl); k <= Math.ceil(540 / dl); k++) {
      const v = ANCHOR_LON + k * dl;
      if (v <= -180 + 1e-6 || v >= 180 - 1e-6) continue;
      if (must.some(m => Math.abs(m - v) < 0.25 * dl)) continue;
      set.add(v);
    }
    return [...set].sort((a, b) => a - b);
  };

  const polyArea = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a * 0.5; };
  // W8g-b (W8_SPEC 13.2 B2): the cut of the ring under the exit heads: for every cell of a head's first L metres (rows 0 .. K), the strip's whole width, its outer
  // columns included (ruling 5 of the W8g-b breakdown: that contains the cross-section's footprint, paved + shoulder + ditch, plus 0.3 m for every class, and the outer
  // columns lie on the terrain, so the cut edge meets the road at the terrain's own height; a cut at the footprint + 0.3 m can end in a ditch or on a raised verge).
  // The polygon's sides are the strip's own outer edges. heads: [{ exit, rt, L, K }] (roads.js).
  // vertex data of one lattice point (height, flat position, local-frame normal, colour)
  const gradOf = (lon, lat) => {
    const s = Math.cos(lat * D), e = 0.75, dlon = e / (R * s) / D, dlat = e / R / D;
    return [(W.height(lon + dlon, lat) - W.height(lon - dlon, lat)) / (2 * e), (W.height(lon, lat + dlat) - W.height(lon, lat - dlat)) / (2 * e)];
  };
  function vertex(lon, lat) {
    const h = W.height(lon, lat), s = Math.cos(lat * D), yt = h - BASE;
    const [gE, gN] = gradOf(lon, lat);
    let nx = -gE, ny = 1, nz = gN; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;   // x east, y up, z south
    return { x: flatX(lon), y: yt / s, z: flatZ(lat), nx, ny, nz, c: colourOf(lon, lat, h, gE, gN), lon, lat, h };
  }
  // W8g-b: the colour alone (the verges of the roads take the terrain's own colour): the slope enters only above 3.5 m, so below it the four gradient heights are not
  // taken; the same numbers as vertex(lon, lat).c
  function vertexColor(lon, lat) { const h = W.height(lon, lat), g = h > 3.5 ? gradOf(lon, lat) : [0, 0]; return colourOf(lon, lat, h, g[0], g[1]); }
  function colourOf(lon, lat, h, gE, gN) {
    const reg = W.regionAt(lon, lat);
    let c;
    if (reg.zone === 'ocean') c = mix(SHALLOW, DEEP, Math.min(1, Math.max(0, -h) / 3));
    else {
      c = KIND_COLOR[reg.kind] || KIND_COLOR.grassland;
      const lift = Math.min(0.5, Math.max(0, h - 3) / 40) * (reg.kind === 'forest' ? 0.3 : 1);          // mountains read lighter (a forested ridge stays dark: W6c)
      c = mix(c, [0.72, 0.78, 0.86], lift * 0.55);                                                       // (the snow line below takes over the high ground)
      // BI09 / TR05: bare rock on steep slopes, snow above the snow line (20 m on ameni-dake, 18 m elsewhere), a wavering line (noise +-1.6 m of height) and a soft band 3 m deep
      if (h > 3.5) {
        const slope = Math.hypot(gE, gN), rock = Math.min(1, Math.max(0, (slope - 0.42) / 0.5)), vn = (x, y) => { const X = Math.floor(x), Y = Math.floor(y), fx = x - X, fy = y - Y, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), hh = (a, b) => (Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1; const q = (a, b) => Math.abs(hh(a, b)); return (q(X, Y) * (1 - u) + q(X + 1, Y) * u) * (1 - v) + (q(X, Y + 1) * (1 - u) + q(X + 1, Y + 1) * u) * v; };
        const peak = W.arcDistance({ lon, lat }, { lon: -25, lat: 56 }) < 30, line = (peak ? 20 : 18) + (vn(lon * 0.9, lat * 0.9) - 0.5) * 3.2 - slope * 1.2, snow = Math.min(1, Math.max(0, (h - line) / 3)) * (1 - 0.35 * rock);
        c = mix(c, ROCK, rock * 0.75 * (1 - snow)); c = mix(c, SNOW, snow);
      }
      if (h < 0.8 && reg.zone !== 'building') { const cd = W.coastDistance(lon, lat); if (cd < 7) c = mix(SAND, c, Math.min(1, Math.max(0, (cd - 2.5) / 4.5))); }   // TR02: beach 3-8 m wide
    }
    // TR05-TR07 and every other land boundary: the colour is softened over about 12 m (half the vertex's own colour, half the mean of the regions 6 m around), so
    // that grass fades into sand, forest into grass and so on instead of a lattice-jagged edge (W6d)
    if (reg.zone !== 'ocean' && reg.zone !== 'ice') {
      let acc = [0, 0, 0], n = 0;
      for (let a = 0; a < 8; a++) { const p = W.destination({ lon, lat }, a * 45 + 11, 6), r2 = W.regionAt(p.lon, p.lat); if (r2.zone === 'ocean' || r2.zone === 'ice') continue; const c2 = KIND_COLOR[r2.kind] || KIND_COLOR.grassland, lift2 = Math.min(0.5, Math.max(0, h - 3) / 40) * (r2.kind === 'forest' ? 0.3 : 1), c3 = mix(c2, [0.72, 0.78, 0.86], lift2); acc[0] += c3[0]; acc[1] += c3[1]; acc[2] += c3[2]; n++; }
      if (n) c = mix(c, [acc[0] / n, acc[1] / n, acc[2] / n], 0.5);
    }
    return c;
  }

  // W8g-a: vertex() is a pure function of the lattice point, so one builder keeps every vertex it has made and later buildFlat calls (the ring twice, the
  // sampler's chunks, the rest) reuse it instead of evaluating the height function again
  let RINGS = null; const vcache = new Map();
  const latticeRings = () => RINGS || (RINGS = lats.map(l => ({ lat: l, lons: ringLons(l) })));
  const latticeVertex = (rings, r, k) => { const key = r * 100000 + k; let v = vcache.get(key); if (v === undefined) { v = vertex(rings[r].lons[k], rings[r].lat); vcache.set(key, v); } return v; };
  const chunkKeyOf = (lon, lat) => Math.min(11, Math.floor((lat + 90) / CHUNK_DEG)) * 24 + Math.min(23, Math.floor((lon + 180) / CHUNK_DEG));

  // Build the flat mesh. opts: { ring: bool, rest: bool, window: {lonMin, lonMax, latMin, latMax}, chunks: Set of chunk keys (cy * 24 + cx) to keep }
  // With `chunks`, only the triangles of those chunks are made; each chunk comes out exactly as in the build without it (same triangles in the same order).
  function buildFlat(opts) {
    const win = opts.window || { lonMin: -181, lonMax: 181, latMin: -90, latMax: 90 };
    const rings = latticeRings();
    const vmap = new Map(), V = [];
    const vid = (r, k) => { const key = r * 100000 + k; let i = vmap.get(key); if (i === undefined) { i = V.length; V.push(latticeVertex(rings, r, k)); vmap.set(key, i); } return i; };
    const clippedV = new Map(), clippedVid = (p, triVerts) => {
      const x = Math.round(p[0] * 1e5) / 1e5, z = Math.round(p[1] * 1e5) / 1e5, key = `${Math.round(x * 1e5)},${Math.round(z * 1e5)}`;
      let i = clippedV.get(key); if (i === undefined) {
        const lon = x / (R * D), lat = Math.atan(Math.sinh(-z / R)) / D, [a, b, c] = triVerts, dx = b.x - a.x, dz = b.z - a.z, ex = c.x - a.x, ez = c.z - a.z, det = dx * ez - ex * dz;
        const wb = ((x - a.x) * ez - ex * (z - a.z)) / det, wc = (dx * (z - a.z) - (x - a.x) * dz) / det, wa = 1 - wb - wc, ws = [wa, wb, wc];
        const blend = keyName => ws.reduce((sum, w, j) => sum + w * triVerts[j][keyName], 0), blend3 = keyName => [0, 1, 2].map(k => ws.reduce((sum, w, j) => sum + w * triVerts[j][keyName][k], 0));
        const n = [blend('nx'), blend('ny'), blend('nz')], nl = Math.hypot(...n) || 1;
        i = V.length; V.push({ x, y: blend('y'), z, nx: n[0] / nl, ny: n[1] / nl, nz: n[2] / nl, c: blend3('c'), lon, lat, h: BASE + blend('y') * Math.cos(lat * D) }); clippedV.set(key, i);
      }
      return i;
    };
    const tris = [];   // {a, b, c} as vertex ids, with chunk and ring flag resolved later
    const keep = (ra, ka, rb, kb, rc, kc) => {
      const A = [rings[ra].lons[ka], rings[ra].lat], B = [rings[rb].lons[kb], rings[rb].lat], C = [rings[rc].lons[kc], rings[rc].lat];
      const lon = (A[0] + B[0] + C[0]) / 3, lat = (A[1] + B[1] + C[1]) / 3;
      if (lon < win.lonMin || lon > win.lonMax || lat < win.latMin || lat > win.latMax) return;
      if (opts.chunks && !opts.chunks.has(chunkKeyOf(lon, lat))) return;
      const isRing = W.townPatchDistance(lon, lat) < RING_M;
      if (isRing ? !opts.ring : !opts.rest) return;

      tris.push({ a: vid(ra, ka), b: vid(rb, kb), c: vid(rc, kc), lon, lat, ring: isRing });
    };
    for (let r = 0; r + 1 < rings.length; r++) {
      const S = rings[r].lons, N = rings[r + 1].lons;
      if (rings[r + 1].lat < win.latMin - 2 || rings[r].lat > win.latMax + 2) continue;
      let i = 0, j = 0;
      while (i < S.length - 1 || j < N.length - 1) {
        const adv = j === N.length - 1 || (i < S.length - 1 && S[i + 1] < N[j + 1]);
        if (adv) { keep(r, i, r, i + 1, r + 1, j); i++; } else { keep(r, i, r + 1, j + 1, r + 1, j); j++; }
      }
    }
    // chunks: 15 x 15 degrees by triangle centroid; ring and rest triangles of a chunk share one vertex buffer
    const chunks = new Map();
    for (const t of tris) {
      const cx = Math.min(23, Math.floor((t.lon + 180) / CHUNK_DEG)), cy = Math.min(11, Math.floor((t.lat + 90) / CHUNK_DEG)), key = cy * 24 + cx;   // = chunkKeyOf
      let c = chunks.get(key); if (!c) chunks.set(key, c = { cx, cy, ring: [], rest: [] });
      (t.ring ? c.ring : c.rest).push(t);
    }
    const out = [];
    for (const key of [...chunks.keys()].sort((a, b) => a - b)) {
      const c = chunks.get(key), local = new Map(), ids = [];
      const li = g => { let v = local.get(g); if (v === undefined) { v = ids.length; ids.push(g); local.set(g, v); } return v; };
      const ringIdx = [], restIdx = [];
      for (const t of c.ring) ringIdx.push(li(t.a), li(t.b), li(t.c));
      for (const t of c.rest) restIdx.push(li(t.a), li(t.b), li(t.c));
      const n = ids.length, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3), ll = new Float64Array(n * 2), alt = new Float32Array(n);
      ids.forEach((g, k) => { const v = V[g]; pos.set([v.x, v.y, v.z], k * 3); nrm.set([v.nx, v.ny, v.nz], k * 3); col.set(v.c, k * 3); ll[k * 2] = v.lon; ll[k * 2 + 1] = v.lat; alt[k] = v.h; });
      out.push({ cx: c.cx, cy: c.cy, vertexCount: n, pos, nrm, col, lonlat: ll, alt, ringIndex: ringIdx.length ? Uint32Array.from(ringIdx) : null, restIndex: restIdx.length ? Uint32Array.from(restIdx) : null });
    }
    return out;
  }

  // Polar caps in native sphere coordinates (not bent): radius R + (height - 1.6), 1 degree rings from 85 deg to the pole.
  function buildCap(north) {
    const sgn = north ? 1 : -1, ringsC = [];
    for (let l = FLAT_LAT; l < 90; l += STEP) ringsC.push({ lat: sgn * l, lons: l === FLAT_LAT ? ringLons(sgn * l) : ringLons(sgn * l) });
    const verts = [], idx = [], at = new Map();
    const sph = (lon, lat) => {
      const h = W.height(lon, lat), r = R + (h - BASE), cp = Math.cos(lat * D), sp = Math.sin(lat * D), cl = Math.cos(lon * D), sl = Math.sin(lon * D);
      const dir = [cp * sl, cp * cl, -sp];
      return { p: [dir[0] * r, -R + dir[1] * r, dir[2] * r], n: dir, c: KIND_COLOR[sgn > 0 ? 'ice-north' : 'ice-south'], lon, lat, h };
    };
    const vid = (r, k) => { const key = r * 100000 + k; let i = at.get(key); if (i === undefined) { i = verts.length; verts.push(sph(ringsC[r].lons[k], ringsC[r].lat)); at.set(key, i); } return i; };
    for (let r = 0; r + 1 < ringsC.length; r++) {
      const A = ringsC[r].lons, B = ringsC[r + 1].lons;       // A is nearer the equator
      let i = 0, j = 0;
      while (i < A.length - 1 || j < B.length - 1) {
        const adv = j === B.length - 1 || (i < A.length - 1 && A[i + 1] < B[j + 1]);
        const t = adv ? [vid(r, i), vid(r, i + 1), vid(r + 1, j)] : [vid(r, i), vid(r + 1, j + 1), vid(r + 1, j)];
        if (adv) i++; else j++;
        if (!north) t.reverse();                              // keep outward-facing winding in the southern cap
        idx.push(...t);
      }
    }
    // the pole itself: close the last ring with a fan
    const last = ringsC.length - 1, pole = verts.length; verts.push(sph(0, sgn * 90));
    for (let k = 0; k + 1 < ringsC[last].lons.length; k++) { const t = [vid(last, k), vid(last, k + 1), pole]; if (!north) t.reverse(); idx.push(...t); }
    const n = verts.length, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
    verts.forEach((v, k) => { pos.set(v.p, k * 3); nrm.set(v.n, k * 3); col.set(v.c, k * 3); });
    return { north, vertexCount: n, pos, nrm, col, index: Uint32Array.from(idx), lonlat: Float64Array.from(verts.flatMap(v => [v.lon, v.lat])), alt: Float32Array.from(verts.map(v => v.h)) };
  }

  // W8g-a: the rest chunks with the given keys, as the global rest build makes them (sorted by key; a key without rest triangles gives no chunk)
  function buildRestChunks(keys) {
    const set = new Set(keys), cxs = keys.map(k => k % 24), cys = keys.map(k => Math.floor(k / 24));
    const lonMin = -180 + Math.min(...cxs) * CHUNK_DEG - 1, lonMax = Math.max(...cxs) === 23 ? 181 : -180 + (Math.max(...cxs) + 1) * CHUNK_DEG + 1;
    const latMin = -90 + Math.min(...cys) * CHUNK_DEG - 1, latMax = Math.max(...cys) === 11 ? 90 : -90 + (Math.max(...cys) + 1) * CHUNK_DEG + 1;
    return buildFlat({ ring: false, rest: true, chunks: set, window: { lonMin, lonMax, latMin, latMax } });
  }
  const buildRestRow = cy => buildRestChunks(Array.from({ length: 24 }, (_, cx) => cy * 24 + cx));

  // W8g-b: the triangles of the sampler's 1-degree cell (i = floor(lon), j = floor(lat)) straight from the lattice, without making any chunk: every triangle of the
  // walk between two rings that is not inside the town patch, whose bounding box covers the cell, as [lon0, lat0, h0, lon1, lat1, h1, lon2, lat2, h2] with the
  // vertices in buildFlat's order and h the Float32 altitude a chunk stores. Ordered like the global index (samplerFromChunks over [...ring chunks, ...rest chunks]):
  // ring triangles before rest ones, then by chunk key, then by their place in the walk (ring pair r, step i + j of the merge). Only W.height of the vertices.
  const hcache = new Map(), hOf = (rings, r, k) => { const key = r * 100000 + k; let h = hcache.get(key); if (h === undefined) { const v = vcache.get(key); h = Math.fround(v ? v.h : W.height(rings[r].lons[k], rings[r].lat)); hcache.set(key, h); } return h; };
  function samplerCell(ci, cj) {
    const rings = latticeRings(), found = [];
    for (let r = 0; r + 1 < rings.length; r++) {
      if (rings[r].lat > cj + 1 + 1e-9 || rings[r + 1].lat < cj - 1e-9) continue;              // a triangle between these rings cannot reach the cell's latitudes
      const S = rings[r].lons, N = rings[r + 1].lons, la0 = rings[r].lat, la1 = rings[r + 1].lat;
      let i = 0, j = 0;
      while (i < S.length - 1 || j < N.length - 1) {
        const adv = j === N.length - 1 || (i < S.length - 1 && S[i + 1] < N[j + 1]), step = i + j;
        const A = [S[i], la0, r, i], Bv = adv ? [S[i + 1], la0, r, i + 1] : [N[j + 1], la1, r + 1, j + 1], C = [N[j], la1, r + 1, j];
        if (adv) i++; else j++;
        const lo0 = Math.min(A[0], Bv[0], C[0]), lo1 = Math.max(A[0], Bv[0], C[0]);
        if (Math.floor(lo0) > ci || Math.floor(lo1) < ci) continue;
        const lt0 = Math.min(A[1], Bv[1], C[1]), lt1 = Math.max(A[1], Bv[1], C[1]);
        if (Math.floor(lt0) > cj || Math.floor(lt1) < cj) continue;
        const lon = (A[0] + Bv[0] + C[0]) / 3, lat = (A[1] + Bv[1] + C[1]) / 3, ring = W.townPatchDistance(lon, lat) < RING_M;
        found.push({ ring, key: chunkKeyOf(lon, lat), r, step, tri: [A[0], A[1], hOf(rings, A[2], A[3]), Bv[0], Bv[1], hOf(rings, Bv[2], Bv[3]), C[0], C[1], hOf(rings, C[2], C[3])] });
      }
    }
    found.sort((a, b) => (a.ring === b.ring ? 0 : a.ring ? -1 : 1) || a.key - b.key || a.r - b.r || a.step - b.step);
    return found.map(q => q.tri);
  }

  return { buildFlat, buildRestChunks, buildRestRow, samplerCell, buildCap, vertex, vertexColor, lats, ringLons, flatX, flatZ, chunkKeyOf };
}

// Window around the town patch that contains the whole 24 m ring (the ring reaches 15.3 degrees of arc beyond the patch).
const RING_WINDOW = { lonMin: -52, lonMax: 52, latMin: -46, latMax: 46 };

// Height of the rendered mesh (barycentric on the same triangles buildFlat makes) inside a lon/lat window, W.height elsewhere (the town patch is the
// town's own surface). Objects and ground strips of a section sit on this, not on height(): the two differ by up to the W3-C1 tolerance.
function sampler(W, win) { return samplerFromChunks(W, builder(W).buildFlat({ ring: true, rest: true, window: win })); }
// Same lookup over chunks that already exist (buildFlat output, ring and rest parts may be separate lists): the global road builder uses the
// chunks the terrain meshes were made from, so the whole planet is not meshed a second time.
function samplerFromChunks(W, chunks) {
  const cells = new Map(), key = (i, j) => i * 4096 + j;
  for (const c of chunks) for (const idx of [c.ringIndex, c.restIndex]) if (idx) for (let t = 0; t < idx.length; t += 3) {
    const v = [0, 1, 2].map(k => { const i = idx[t + k]; return [c.lonlat[i * 2], c.lonlat[i * 2 + 1], c.alt[i]]; });
    const tri = [].concat(...v), lo0 = Math.min(v[0][0], v[1][0], v[2][0]), lo1 = Math.max(v[0][0], v[1][0], v[2][0]), la0 = Math.min(v[0][1], v[1][1], v[2][1]), la1 = Math.max(v[0][1], v[1][1], v[2][1]);
    for (let i = Math.floor(lo0); i <= Math.floor(lo1); i++) for (let j = Math.floor(la0); j <= Math.floor(la1); j++) { const k = key(i + 200, j + 100); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(tri); }
  }
  return (lon, lat) => {
    const l = cells.get(key(Math.floor(lon) + 200, Math.floor(lat) + 100));
    if (l) for (const [x0, y0, h0, x1, y1, h1, x2, y2, h2] of l) {
      const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2); if (Math.abs(d) < 1e-12) continue;
      const w1 = ((y1 - y2) * (lon - x2) + (x2 - x1) * (lat - y2)) / d, w2 = ((y2 - y0) * (lon - x2) + (x0 - x2) * (lat - y2)) / d, w3 = 1 - w1 - w2;
      if (w1 >= -1e-9 && w2 >= -1e-9 && w3 >= -1e-9) return w1 * h0 + w2 * h1 + w3 * h2;
    }
    return W.height(lon, lat);
  };
}

// W8g-a (W8_SPEC 13.1 A3): the same lookup as samplerFromChunks over [...ring chunks, ...rest chunks], built one 1-degree cell at a time, so a height near the town
// no longer needs the whole planet meshed. cellOf(i, j) gives a cell's triangles in the global index's order (builder.samplerCell, W8g-b: straight from the lattice,
// one W.height per vertex); the first triangle that contains the point, and the returned double, are therefore the same.
function lazySampler(W, cellOf) {
  const cells = new Map(), key = (i, j) => i * 4096 + j;
  return (lon, lat) => {
    const i = Math.floor(lon), j = Math.floor(lat), k = key(i + 200, j + 100);
    let l = cells.get(k); if (!l) cells.set(k, l = cellOf(i, j));
    for (const [x0, y0, h0, x1, y1, h1, x2, y2, h2] of l) {
      const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2); if (Math.abs(d) < 1e-12) continue;
      const w1 = ((y1 - y2) * (lon - x2) + (x2 - x1) * (lat - y2)) / d, w2 = ((y2 - y0) * (lon - x2) + (x0 - x2) * (lat - y2)) / d, w3 = 1 - w1 - w2;
      if (w1 >= -1e-9 && w2 >= -1e-9 && w3 >= -1e-9) return w1 * h0 + w2 * h1 + w3 * h2;
    }
    return W.height(lon, lat);
  };
}

const TERRAIN = { R, BASE, RING_M, CHUNK_DEG, FLAT_LAT, RING_WINDOW, builder, sampler, samplerFromChunks, lazySampler, cutStructureXZ, prepareStructureParts, planeXZ, subtractConvexXZ };
// TERRAIN_HOLE_REPAIR_PLAN 4.2: what makes a geometry unfit to draw ([] when none): an attribute under an empty key, an attribute count unlike the position
// count, a position that is not finite, an index that is not a whole number in [0, count), an index count that is not a multiple of 3. The terrain's gate
// runs it after its cuts and after bend.js subdivide; the check tools (tools/terrain_hole_check.mjs, unify_check, terrain_structure_check) run it on what they read.
TERRAIN.geometryIssues = function (g) {
  const out = [], pos = g && g.attributes && g.attributes.position;
  if (!pos) return ['no position'];
  for (const [k, a] of Object.entries(g.attributes)) { if (!k) out.push('empty attribute key'); else if (a.count !== pos.count) out.push(`${k} count ${a.count} != ${pos.count}`); }
  const p = pos.array, n = pos.count * pos.itemSize; let bad = 0;
  if (pos.isInterleavedBufferAttribute) { for (let i = 0; i < pos.count; i++) if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) bad++; }
  else for (let i = 0; i < n; i++) if (!Number.isFinite(p[i])) bad++;
  if (bad) out.push(`${bad} non-finite position values`);
  if (g.index) {
    const ix = g.index.array; let wrong = 0, max = -1;
    for (let i = 0; i < ix.length; i++) { const v = ix[i]; if (!(v >= 0 && v < pos.count && v === Math.floor(v))) wrong++; if (v > max) max = v; }
    if (wrong) out.push(`${wrong} indices outside [0, ${pos.count}) (max ${max})`);
    if (g.index.count % 3) out.push(`index count ${g.index.count} not a multiple of 3`);
  }
  return out;
};

// ---- scene part (needs THREE); the data builder above never touches it
// THREE.MathUtils.generateUUID draws from Math.random. The rain of scene.js draws from the same stream every frame, so creating terrain
// objects must not consume it (the town stays bit-identical): while terrain objects are made, Math.random is a private seeded stream.
function withPrivateRandom(fn) {
  const saved = Math.random; let s = 0x5eed1234;
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return fn(); } finally { Math.random = saved; }
}

TERRAIN.withPrivateRandom = withPrivateRandom;
// W8g-a: a build that can be run in steps. make() returns an iterator (a generator); step() runs it to its next yield, finish() to its end. Every step runs
// inside the build's own private stream, which starts where withPrivateRandom starts and continues across the steps, so the build draws exactly the numbers
// one withPrivateRandom(build) call would have drawn. stats: ms of each step.
TERRAIN.job = function (make, onDone) {
  let it = null, s = 0x5eed1234, done = false, value;
  const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const J = { stats: [], get done() { return done; }, get value() { return value; },
    step() {
      if (done) return true;
      const saved = Math.random, t0 = Date.now(); Math.random = rand;
      try { if (!it) it = make(); const r = it.next(); if (r.done) { done = true; value = r.value; } }
      finally { Math.random = saved; J.stats.push(Date.now() - t0); }
      if (done && onDone) onDone(J.stats.reduce((a, b) => a + b, 0));
      return done;
    },
    finish() { while (!J.step()); return value; } };
  return J;
};
// run a generator to its end (the synchronous form of a stepped build)
TERRAIN.runAll = it => { for (;;) { const r = it.next(); if (r.done) return r.value; } };

TERRAIN.attach = function (scene, makeMaterial, BEND) {
  const THREE = global.THREE, W = global.WORLD, B = builder(W);
  let material, capMat, root;
  withPrivateRandom(() => {
    material = makeMaterial();
    capMat = material.clone(); capMat.userData = { noBend: true };
    root = new THREE.Group(); root.name = 'terrain'; scene.add(root);
  });
  const state = { ring: [], rest: [], caps: [], restBuilt: false, stats: {} };
  const geom = (c, index) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', c.posAttr || (c.posAttr = new THREE.BufferAttribute(c.pos, 3)));
    g.setAttribute('normal', c.nrmAttr || (c.nrmAttr = new THREE.BufferAttribute(c.nrm, 3)));
    g.setAttribute('color', c.colAttr || (c.colAttr = new THREE.BufferAttribute(c.col, 3)));
    g.setIndex(new THREE.BufferAttribute(index, 1)); return g;
  };
  // a flat position as a number (to 0.01 mm; |x| < 432, |z| < 283), read back from Float32 positions: sealOutline and the cut's outline record share it
  const posKey = (x, z) => Math.round(x * 1e5) * 1e8 + Math.round(z * 1e5) + 5e7;
  const add = (g, mat, kind, list, extra) => { const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.userData.terrain = { kind, ...extra }; m.userData.chunkPosition = g.attributes.position; root.add(m); list.push(m); return m; };
  // Once the unified road plan exists, remove the ground that a graded road replaces from the planetary ground: the swept cross-section between its rows.
  // This keeps the rendered terrain from sitting above roads between its much wider lattice samples.
  // W10c: a bridge stands over the ground and a tunnel runs under it, so neither replaces any: the seabed under a deck and the hill over RN01-05 stay. The tunnel's own
  // volume is cut in three dimensions below (cutStructureXZ): where the hill is lower than the shell, the ground inside the shell and the portal rings goes.
  // The spans of world.js (roadkit.js gives them in each route's chainage) cut the rows they straddle at their exact ends (the row there interpolated, as
  // the mesh is linear between rows); a route that ends on an abutment has no cap there (the deck goes on from its last row). Every polygon keeps its
  // source (kind, route or junction, chainage); state.stats.groundCut lists the structures left uncut. The roads' full footprints stay as they are for
  // their other uses (paving, verges, the clearance of plants and furniture).
  const STRUCTURES = new Set(['tunnel', 'bridge']);
  function cutRoads(data) {
    const CELL = 2, PERIOD = 2 * Math.PI * R, polys = [], cells = new Map(), cellKey = (x, z) => `${x},${z}`, kept = [];
    const addPoly = (p, src, list = polys) => {
      if (p.length < 3 || Math.abs(polygonAreaXZ(p)) < 1e-7) return;
      const centre = p.reduce((s, q) => s + q[0], 0) / p.length, copies = [p];
      if (centre > Math.PI * R) copies.push(p.map(q => [q[0] - PERIOD, q[1]]));
      else if (centre < -Math.PI * R) copies.push(p.map(q => [q[0] + PERIOD, q[1]]));
      for (const poly of copies) {
        const box = { x0: Math.min(...poly.map(q => q[0])), x1: Math.max(...poly.map(q => q[0])), z0: Math.min(...poly.map(q => q[1])), z1: Math.max(...poly.map(q => q[1])) };
        const id = list.length; list.push({ p: poly, box, src }); if (list !== polys) continue;
        for (let x = Math.floor((box.x0 - CUT_EPS) / CELL); x <= Math.floor((box.x1 + CUT_EPS) / CELL); x++) for (let z = Math.floor((box.z0 - CUT_EPS) / CELL); z <= Math.floor((box.z1 + CUT_EPS) / CELL); z++) {
          const k = cellKey(x, z); let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(id);
        }
      }
    };
    // Cut along the swept mesh's actual projected cross-section. `route.lateral()` returns a
    // geodesic offset for furniture placement, while the road mesh itself offsets its Mercator
    // rows along `tangent * cf`; mixing those coordinate paths left narrow wedges of ground at
    // the road centreline, especially at landmark entrances and around the ring.
    const flatLateral = (rt, i, o, along, nearX) => { const f = rt.flatOf[i], t = rt.tangent[i], scale = rt.cf[i] * f.k; let x = f.x + t[0] * along - t[1] * o * scale; x += PERIOD * Math.round((nearX - x) / PERIOD); return [x, f.z + t[1] * along + t[0] * o * scale]; };
    // W10c town-exit connectors (docs/world/CONNECTOR_TERRAIN_HOLE_FIX_PLAN.md): roads.js removed the side strips of the nine connectors from the road
    // mesh (rt.connectorCuts, each with its rectangle). Within an exit's corridor (the box of its two rectangles, 0.5 m more for the row that straddles
    // the town edge) the route's cut is limited to the ground its own strip actually replaces: a row reaches no further than the strip's outer columns
    // (the alley mouths are narrower there than their footprint and pad), and the row and cap polygons lose the removed rectangles exactly (addRoutePoly,
    // below). Outside the corridors nothing changes; the other roads keep their own cuts (CR01's paving; its verges lie on the ground as round the ring).
    const connectorStats = { routes: 0, trimmed: 0, removed: 0, pieces: 0, releasedArea: 0, limitedRows: 0, byExit: {} };
    const connectorsOf = new Map((data.routes || []).map(rt => [rt, (rt.connectorCuts || []).filter(c => c.polygon && c.polygon.length >= 3).map(c => ({ exit: c.exit, p: c.polygon,
      x0: Math.min(...c.polygon.map(q => q[0])), x1: Math.max(...c.polygon.map(q => q[0])), z0: Math.min(...c.polygon.map(q => q[1])), z1: Math.max(...c.polygon.map(q => q[1])) }))]));
    const corridors = new Map(), limited = new Set();
    for (const [rt, list] of connectorsOf) {
      if (!list.length) continue; connectorStats.routes++;
      const boxes = {}; for (const c of list) { const b = boxes[c.exit] || (boxes[c.exit] = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }); b.x0 = Math.min(b.x0, c.x0 - 0.5); b.x1 = Math.max(b.x1, c.x1 + 0.5); b.z0 = Math.min(b.z0, c.z0 - 0.5); b.z1 = Math.max(b.z1, c.z1 + 0.5); }
      corridors.set(rt, Object.values(boxes));
    }
    // the strip's own outer edge at row i (its first and last columns, true metres in the row frame), inside a corridor; null elsewhere
    const stripCols = (rt, i) => {
      const F = rt.flatOf[i], m = rt.grid.length, t = rt.tangent[i], scale = rt.cf[i] * F.k, st = rt.strip.pos, off = j => { const k = (i * m + j) * 3; return ((st[k] - F.x) * -t[1] + (st[k + 2] - F.z) * t[0]) / scale; };
      return [off(0), off(m - 1)];
    };
    const stripEdge = (rt, i) => {
      const boxes = corridors.get(rt); if (!boxes) return null;
      const F = rt.flatOf[i]; if (!boxes.some(b => F.x >= b.x0 && F.x <= b.x1 && F.z >= b.z0 && F.z <= b.z1)) return null;
      return stripCols(rt, i);
    };
    // TERRAIN_HOLE_REPAIR_PLAN 4.3: outside the corridors too a row reaches no further than its strip's outer columns: where a strip narrows to its paved width (an RD05
    // end's taper, a junction mouth) the pad would cut ground that nothing replaces; where verges or side slopes run on past the footprint the pad lies under them
    // TERRAIN_HOLE_FOLLOWUP_PLAN A3: a row cuts the ground it replaces (roadkit.js rt.cut: the full footprint, over a fill side slope out to where it comes back to the terrain)
    const routeRow = (rt, i, along = 0, nearX = rt.flatOf[i].x) => {
      const f = rt.cut ? rt.cut[i] : rt.footprint[i].slice(2), e = stripEdge(rt, i);
      let lo = f[0] - CUT_PAD, hi = f[1] + CUT_PAD;
      if (e && (e[0] > lo || e[1] < hi)) { lo = Math.max(lo, e[0]); hi = Math.min(hi, e[1]); if (!limited.has(rt.def.id + ':' + i)) { limited.add(rt.def.id + ':' + i); connectorStats.limitedRows++; } }
      else if (!e) { const c = stripCols(rt, i); if (c[0] > lo || c[1] < hi) { lo = Math.max(lo, c[0]); hi = Math.min(hi, c[1]); connectorStats.stripRows = (connectorStats.stripRows || 0) + 1; } }
      return [flatLateral(rt, i, lo, along, nearX), flatLateral(rt, i, hi, along, nearX)];
    };
    // the chainage ranges of a route that stand on structures: its tunnel and bridge spans, and beyond an end that meets an abutment. A tunnel's portals
    // stand on its first and last rows inside the span (roads.js buildTunnel): the strip between the span's end and the portal face is the open approach in
    // front of the portal, cut like it so that no ground lies over the road there, and registered as a portal opening
    const structureRanges = rt => {
      const S = rt.samples, n = S.length, ranges = [], openings = [];
      for (const q of rt.spans || []) if (STRUCTURES.has(q.type)) {
        let a = q.s0, b = q.s1;
        if (q.type === 'tunnel' && rt.tunnel) { a = Math.max(a, rt.tunnel.s0); b = Math.min(b, rt.tunnel.s1); if (a > q.s0) openings.push({ s0: q.s0, s1: a, end: 'start' }); if (b < q.s1) openings.push({ s0: b, s1: q.s1, end: 'end' }); }
        ranges.push([a, b]); kept.push({ type: q.type, route: rt.def.id, edge: q.edge, s0: +q.s0.toFixed(3), s1: +q.s1.toFixed(3), kept: [+a.toFixed(3), +b.toFixed(3)] });
      }
      for (const op of openings) kept.push({ type: 'tunnel-portal', route: rt.def.id, end: op.end, s0: +op.s0.toFixed(3), s1: +op.s1.toFixed(3), length: +(op.s1 - op.s0).toFixed(3) });
      for (const ap of rt.approaches || []) { const s = ap.which === 'end' ? S[n - 1].s : S[0].s; ranges.push(ap.which === 'end' ? [s, Infinity] : [-Infinity, s]); kept.push({ type: 'abutment', route: rt.def.id, end: ap.which, s: +s.toFixed(3) }); }
      return { ranges, openings };
    };
    // [a, b] less the ranges (or, inside, their intersection with it); the parts within a portal opening are labelled
    const outside = (a, b, ranges) => {
      let parts = [[a, b]];
      for (const [r0, r1] of ranges) parts = parts.flatMap(([p0, p1]) => (r1 <= p0 || r0 >= p1 ? [[p0, p1]] : [...(r0 > p0 ? [[p0, r0]] : []), ...(r1 < p1 ? [[r1, p1]] : [])]));
      return parts.filter(([p0, p1]) => p1 - p0 > 1e-6);
    };
    const inside = (a, b, ranges) => ranges.map(([r0, r1]) => [Math.max(a, r0), Math.min(b, r1)]).filter(([p0, p1]) => p1 - p0 > 1e-6);
    const pieces = (a, b, I) => outside(a, b, I.ranges).flatMap(([p0, p1]) => {
      let parts = [[p0, p1, null]];
      for (const op of I.openings) parts = parts.flatMap(([q0, q1, tag]) => (tag || op.s1 <= q0 || op.s0 >= q1 ? [[q0, q1, tag]] : [...(op.s0 > q0 ? [[q0, op.s0, null]] : []), [Math.max(q0, op.s0), Math.min(q1, op.s1), 'tunnel-portal'], ...(op.s1 < q1 ? [[op.s1, q1, null]] : [])]));
      return parts.filter(([q0, q1]) => q1 - q0 > 1e-6);
    });
    const lerpRow = (a, b, t) => [0, 1].map(k => [a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t]);
    // the connector rectangles leave this route's row and cap polygons, exactly (no tolerance: the ground then ends on the road's cut edge); a trimmed piece
    // keeps its source and records the exits
    const addRoutePoly = (rt, p, src, into = polys) => {
      const list = connectorsOf.get(rt);
      if (!list || !list.length) { addPoly(p, src, into); return; }
      let parts = [p]; const exits = [];
      for (const c of list) {
        const next = [];
        for (const q of parts) {
          const x0 = Math.min(...q.map(v => v[0])), x1 = Math.max(...q.map(v => v[0])), z0 = Math.min(...q.map(v => v[1])), z1 = Math.max(...q.map(v => v[1]));
          if (c.x1 < x0 || c.x0 > x1 || c.z1 < z0 || c.z0 > z1) { next.push(q); continue; }
          const out = subtractConvexXZ(q, c.p, 1e-9), before = Math.abs(polygonAreaXZ(q)), after = out.reduce((s, r) => s + Math.abs(polygonAreaXZ(r)), 0);
          if (before - after <= 1e-9) { next.push(q); continue; }
          next.push(...out); connectorStats.releasedArea += before - after; connectorStats.byExit[c.exit] = (connectorStats.byExit[c.exit] || 0) + (before - after);
          if (!exits.includes(c.exit)) exits.push(c.exit);
        }
        parts = next;
      }
      if (!exits.length) { addPoly(p, src, into); return; }
      if (into !== polys) { for (const q of parts) addPoly(q, { ...src, connector: exits }, into); return; }
      connectorStats.trimmed++; if (!parts.length) connectorStats.removed++; connectorStats.pieces += parts.length;
      for (const q of parts) addPoly(q, { ...src, connector: exits });
    };
    const info = new Map((data.routes || []).map(rt => [rt, structureRanges(rt)])), structurePolys = [], folds = { crossed: 0, reflex: 0, routes: {} };
    // a row interval as convex pieces (convexPartsXZ), the folded ones counted per route
    const rowParts = (rt, A, Bq) => { const r = convexPartsXZ([A[0], A[1], Bq[1], Bq[0]]); if (r.kind) { folds[r.kind]++; folds.routes[rt.def.id] = (folds.routes[rt.def.id] || 0) + 1; } return r.parts; };
    for (const rt of data.routes || []) for (let i = 0; i + 1 < rt.samples.length; i++) {
      const x = rt.flatOf[i].x, a = routeRow(rt, i, 0, x), b = routeRow(rt, i + 1, 0, x), sa = rt.samples[i].s, sb = rt.samples[i + 1].s, I = info.get(rt), row = s => (s === sa ? a : s === sb ? b : lerpRow(a, b, (s - sa) / (sb - sa)));
      for (const [p0, p1, tag] of pieces(sa, sb, I)) { const A = row(p0), Bq = row(p1); for (const q of rowParts(rt, A, Bq)) addRoutePoly(rt, q, { kind: 'route', id: rt.def.id, s0: +p0.toFixed(3), s1: +p1.toFixed(3), ...(tag ? { structure: tag } : {}), ...(limited.has(rt.def.id + ':' + i) || limited.has(rt.def.id + ':' + (i + 1)) ? { stripEdge: true } : {}) }); }
      for (const [p0, p1] of inside(sa, sb, I.ranges)) { const A = row(p0), Bq = row(p1), tunnel = !!rt.tunnel && p1 > rt.tunnel.s0 - 1 && p0 < rt.tunnel.s1 + 1; for (const q of rowParts(rt, A, Bq)) { q.tunnel = tunnel; structurePolys.push(q); } }      // the uncut footprint over the structure
    }
    // A tunnel mouth: the ground inside the opening between the portal face and the black void behind it (rt.tunnel.voidDepth) would stand in front of the
    // void, so it is cut within the opening's width (the inner profile, +-innerR). Only this short strip: the hill over the tunnel stays (tools/
    // terrain_structure_check.mjs checks that the ground cut there lies under the opening's profile, nothing above the crown).
    for (const rt of data.routes || []) if (rt.tunnel && rt.tunnel.voidDepth) {
      const tn = rt.tunnel, S = rt.samples, rowO = (s, o, nearX) => { let i = 0; while (i + 2 < S.length && S[i + 1].s < s) i++; const t = (s - S[i].s) / (S[i + 1].s - S[i].s), a = flatLateral(rt, i, o, 0, nearX), b = flatLateral(rt, i + 1, o, 0, nearX); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
      for (const [end, f0, f1] of [['start', tn.s0, tn.s0 + tn.voidDepth], ['end', tn.s1 - tn.voidDepth, tn.s1]]) {
        const x = rt.flatOf[tn.idx[0]].x, A = [rowO(f0, -tn.innerR, x), rowO(f0, tn.innerR, x)], Bq = [rowO(f1, -tn.innerR, x), rowO(f1, tn.innerR, x)];
        addPoly([A[0], A[1], Bq[1], Bq[0]], { kind: 'tunnel-mouth', id: rt.def.id, end, s0: +f0.toFixed(3), s1: +f1.toFixed(3), structure: 'tunnel-portal' });
        kept.push({ type: 'tunnel-mouth', route: rt.def.id, end, s0: +f0.toFixed(3), s1: +f1.toFixed(3), halfWidth: tn.innerR });
      }
    }
    // A route's open end cuts the terrain along its end row and nothing past it. TERRAIN_HOLE_REPAIR_PLAN 4.3 had a cap past it, 0.3 m and then 2 mm, to keep the
    // ground off the end row (Float32 and the end row's piecewise cross-section left the ground's edge a few mm over the road there); TERRAIN_HOLE_FOLLOWUP_PLAN A1:
    // in the terrain the 2 mm cap was itself a slit that nothing replaced, and on the sphere a lattice chord north of about 70 degrees shifted past it (RN10-RD08). Now
    // the terrain's edge meets the end row vertex for vertex at the row's own heights (endColumns, sealOutline), so it neither stands over the road nor leaves a slit.
    // The ground overlays and landmark grounds that cutGroundMeshes cuts by these polygons are not sealed to the road: they keep the 2 mm cap (state.capPolygons; the
    // terrain under that 2 mm meets both), else their edge stands a few mm to cm over the end row (unify_check U2). A cap does not reach onto a structure.
    const capPolys = [];
    for (const rt of data.routes || []) if (rt.samples.length > 1) {
      const S = rt.samples, last = S.length - 1;
      for (const [i, c0, c1] of [[0, S[0].s - GROUND_CAP, S[0].s], [last, S[last].s, S[last].s + GROUND_CAP]]) for (const [p0, p1] of outside(c0, c1, info.get(rt).ranges)) {
        const A = routeRow(rt, i, p0 - S[i].s), Bq = routeRow(rt, i, p1 - S[i].s);
        for (const q of convexPartsXZ([A[0], A[1], Bq[1], Bq[0]]).parts) addRoutePoly(rt, q, { kind: 'cap', id: rt.def.id, s0: +p0.toFixed(3), s1: +p1.toFixed(3) }, capPolys);
      }
    }
    state.capPolygons = capPolys;
    // the strip's columns on those caps' far edges (each end row's columns 2 mm on): cutGroundMeshes splits an overlay's cut edge there (TERRAIN_HOLE_FOLLOWUP_PLAN A7)
    const capColumns = [];
    for (const rt of data.routes || []) { const S = rt.samples, n = S.length, m = rt.grid.length, st = rt.strip.pos, I = info.get(rt); if (n < 2) continue;
      for (const [i, sg] of [[0, -1], [n - 1, 1]]) { if (I.ranges.some(([r0, r1]) => S[i].s >= r0 - 1e-6 && S[i].s <= r1 + 1e-6)) continue; const t = rt.tangent[i];
        for (let j = 0; j < m; j++) { const k = (i * m + j) * 3, x = st[k] + t[0] * sg * GROUND_CAP, z = st[k + 2] + t[1] * sg * GROUND_CAP; capColumns.push([x, z]); if (Math.abs(x) > Math.PI * R) capColumns.push([x - PERIOD * Math.sign(x), z]); } } }
    state.capColumns = capColumns;
    for (const br of data.bridges || []) {
      kept.push({ type: 'bridge', bridge: br.def ? br.def.id : br.ids.join('+'), edges: br.ids, length: +br.length.toFixed(3) });
      const st = br.strips && br.strips[0], m = br.topCols && br.topCols.length; if (!st || !m) continue;
      for (let i = 0; i + 1 < br.samples.length; i++) { const x = br.flatOf[i].x, at = j => { let xx = st.pos[j * 3]; xx += PERIOD * Math.round((x - xx) / PERIOD); return [xx, st.pos[j * 3 + 2]]; };
        structurePolys.push([at(i * m), at(i * m + m - 1), at((i + 1) * m + m - 1), at((i + 1) * m)]); }      // the deck's plan: the ground under it stays
    }
    // junction paving cuts the ground it covers, but not over a tunnel or under a deck (the paving's triangles less the structures' footprints)
    const structureBoxes = structurePolys.map(p => ({ p, tunnel: !!p.tunnel, x0: Math.min(...p.map(q => q[0])), x1: Math.max(...p.map(q => q[0])), z0: Math.min(...p.map(q => q[1])), z1: Math.max(...p.map(q => q[1])) }));
    let junctionClipped = 0;
    for (const j of data.junctions || []) if (j.strip && j.strip.index) for (let t = 0; t + 2 < j.strip.index.length; t += 3) {
      const s = j.strip, at = k => { const n = s.index[t + k] * 3; return [s.pos[n], s.pos[n + 2]]; }, tri = [at(0), at(1), at(2)], src = { kind: 'junction', id: j.node || j.id, y: [0, 1, 2].map(k => s.pos[s.index[t + k] * 3 + 1]), tri };
      const x0 = Math.min(...tri.map(q => q[0])), x1 = Math.max(...tri.map(q => q[0])), z0 = Math.min(...tri.map(q => q[1])), z1 = Math.max(...tri.map(q => q[1]));
      let parts = [tri], hit = false;
      for (const b of structureBoxes) { const k = PERIOD * Math.round(((x0 + x1) / 2 - (b.x0 + b.x1) / 2) / PERIOD); if (b.x1 + k < x0 || b.x0 + k > x1 || b.z1 < z0 || b.z0 > z1) continue;
        const clipP = k ? b.p.map(q => [q[0] + k, q[1]]) : b.p, next = parts.flatMap(p => subtractConvexXZ(p, clipP));
        if (Math.abs(next.reduce((a, p) => a + Math.abs(polygonAreaXZ(p)), 0) - parts.reduce((a, p) => a + Math.abs(polygonAreaXZ(p)), 0)) > 1e-9) { parts = next; hit = true; } }
      if (hit) junctionClipped++;
      for (const p of parts) addPoly(p, hit ? { ...src, structure: 'clipped' } : src);
    }

    state.roadPolygons = polys;
    const bySource = {}; for (const q of polys) bySource[q.src.kind] = (bySource[q.src.kind] || 0) + 1;
    connectorStats.releasedArea = +connectorStats.releasedArea.toFixed(4); for (const k of Object.keys(connectorStats.byExit)) connectorStats.byExit[k] = +connectorStats.byExit[k].toFixed(4);
    state.stats.groundCut = { kept, polygons: bySource, structureFootprints: structurePolys.length, junctionTrianglesClipped: junctionClipped, connector: connectorStats, rowFolds: folds };
    // the tunnel's volume (roads.js tunnelEnvelope; a copy one circumference away where it reaches past the date line): the ground inside the shell and the portal
    // rings goes, the hill over them stays (cutStructureXZ)
    const STRUCT = [], structureCut = { triangles: 0, removedArea: 0 };
    for (const part of prepareStructureParts((data.routes || []).flatMap(rt => (rt.tunnel && rt.tunnel.envelope) || []))) {
      STRUCT.push(part); const k = part.box[1] > Math.PI * R ? -PERIOD : part.box[0] < -Math.PI * R ? PERIOD : 0;
      if (k) STRUCT.push(prepareStructureParts([{ ...part, cells: part.cells.map(c => ({ quad: c.quad.map(q => [q[0] + k, q[1]]), tris: c.tris.map(t => ({ p: t.p.map(q => [q[0] + k, q[1]]), top: t.top, foot: t.foot })) })) }])[0]);
    }
    let trianglesBefore = 0, trianglesAfter = 0, clippedTriangles = 0, removedArea = 0;
    const meshes = [...state.ring, ...state.rest], outline = new Set();
    // the paving's height at a point of its outline (the highest junction triangle there, its copy one circumference away included); null off every paving
    const paveCells = new Map(); polys.forEach((q, id) => { if (q.src.kind !== 'junction' || !q.src.y) return;
      for (let x = Math.floor((q.box.x0 - CUT_EPS) / CELL); x <= Math.floor((q.box.x1 + CUT_EPS) / CELL); x++) for (let z = Math.floor((q.box.z0 - CUT_EPS) / CELL); z <= Math.floor((q.box.z1 + CUT_EPS) / CELL); z++) { const k = cellKey(x, z); let a = paveCells.get(k); if (!a) paveCells.set(k, a = []); a.push(id); } });
    const pavingAt = (x, z, tol = SEAL_TOL) => { let h = null; for (const id of paveCells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) || []) { const b = polys[id].box; if (x < b.x0 - SEAL_TOL || x > b.x1 + SEAL_TOL || z < b.z0 - SEAL_TOL || z > b.z1 + SEAL_TOL) continue;
      const q = polys[id].src, t = q.tri, k = PERIOD * Math.round((x - t[0][0]) / PERIOD), w = weightsXZ(t[0][0] + k, t[0][1], t[1][0] + k, t[1][1], t[2][0] + k, t[2][1], x, z, tol);
      if (!w) continue; const y = w[0] * q.y[0] + w[1] * q.y[1] + w[2] * q.y[2]; if (h === null || y > h) h = y; } return h; };
    for (const mesh of meshes) {
      const g = mesh.geometry, pos = g.attributes.position, normal = g.attributes.normal, color = g.attributes.color, ix = g.index;
      const count = ix ? ix.count : pos.count, index = [], extraPos = [], extraNorm = [], extraColor = []; let meshClipped = 0;
      for (let t = 0; t + 2 < count; t += 3) {
        const ids = [0, 1, 2].map(k => ix ? ix.getX(t + k) : t + k), v = ids.map(i => [pos.getX(i), pos.getY(i), pos.getZ(i)]), tri = v.map(p => [p[0], p[2]]);
        trianglesBefore++;
        const box = { x0: Math.min(...tri.map(p => p[0])), x1: Math.max(...tri.map(p => p[0])), z0: Math.min(...tri.map(p => p[1])), z1: Math.max(...tri.map(p => p[1])) }, nx0 = Math.floor(box.x0 / CELL), nx1 = Math.floor(box.x1 / CELL), nz0 = Math.floor(box.z0 / CELL), nz1 = Math.floor(box.z1 / CELL), found = new Set();
        if ((nx1 - nx0 + 1) * (nz1 - nz0 + 1) <= 256) {
          for (let x = nx0; x <= nx1; x++) for (let z = nz0; z <= nz1; z++) for (const id of cells.get(cellKey(x, z)) || []) found.add(id);
        } else {
          for (let id = 0; id < polys.length; id++) { const b = polys[id].box; if (b.x1 >= box.x0 && b.x0 <= box.x1 && b.z1 >= box.z0 && b.z0 <= box.z1) found.add(id); }
        }
        const candidates = [...found].filter(id => { const b = polys[id].box; return b.x1 >= box.x0 - CUT_EPS && b.x0 <= box.x1 + CUT_EPS && b.z1 >= box.z0 - CUT_EPS && b.z0 <= box.z1 + CUT_EPS; });
        const structure = STRUCT.filter(p => p.box[1] >= box.x0 && p.box[0] <= box.x1 && p.box[3] >= box.z0 && p.box[2] <= box.z1);
        if (!candidates.length && !structure.length) { index.push(...ids); trianglesAfter++; continue; }
        // the structure first, on the whole lattice triangle (its pieces are convex), then the road polygons: the 1 mm tolerance of the road cut can leave a sliver piece
        // that is not convex where two cut lines run a few millimetres apart (J-T07's paving at the RN01-05 portal face), and the structure cut takes convex pieces only
        let pieces = [tri];
        const g3 = structure.length ? planeXZ(tri, v.map(p => p[1])) : null, cutS = g3 ? cutStructureXZ(tri, g3, structure) : null;
        if (cutS) { pieces = cutS; structureCut.triangles++; structureCut.removedArea += Math.max(0, Math.abs(polygonAreaXZ(tri)) - pieces.reduce((sum, p) => sum + Math.abs(polygonAreaXZ(p)), 0)); }
        for (const id of candidates) {
          if (!pieces.length) break;
          const cut = polys[id], next = [];
          for (const poly of pieces) {
            const pb = { x0: Math.min(...poly.map(q => q[0])), x1: Math.max(...poly.map(q => q[0])), z0: Math.min(...poly.map(q => q[1])), z1: Math.max(...poly.map(q => q[1])) };
            if (cut.box.x1 < pb.x0 - 1e-7 || cut.box.x0 > pb.x1 + 1e-7 || cut.box.z1 < pb.z0 - 1e-7 || cut.box.z0 > pb.z1 + 1e-7) next.push(poly);
            else next.push(...subtractConvexXZ(poly, cut.p));
          }
          pieces = next;
        }
        const area = Math.abs(polygonAreaXZ(tri)), remain = pieces.reduce((sum, p) => sum + Math.abs(polygonAreaXZ(p)), 0);
        if (area < 1e-10) { index.push(...ids); trianglesAfter++; continue; }
        if (remain >= area - Math.max(1e-7, area * 1e-7)) { index.push(...ids); trianglesAfter++; continue; }
        clippedTriangles++; meshClipped++; removedArea += Math.max(0, area - remain);
        const den = (v[1][2] - v[2][2]) * (v[0][0] - v[2][0]) + (v[2][0] - v[1][0]) * (v[0][2] - v[2][2]);
        const addVertex = p => {
          const w0 = ((v[1][2] - v[2][2]) * (p[0] - v[2][0]) + (v[2][0] - v[1][0]) * (p[1] - v[2][2])) / den, w1 = ((v[2][2] - v[0][2]) * (p[0] - v[2][0]) + (v[0][0] - v[2][0]) * (p[1] - v[2][2])) / den, w2 = 1 - w0 - w1, weights = [w0, w1, w2], out = pos.count + extraPos.length / 3;
          extraPos.push(p[0], weights.reduce((sum, w, k) => sum + w * v[k][1], 0), p[1]);
          if (!v.some(q => Math.abs(q[0] - p[0]) < 1e-9 && Math.abs(q[2] - p[1]) < 1e-9)) outline.add(posKey(Math.fround(p[0]), Math.fround(p[1])));     // on a cut's outline (not a lattice corner)
          if (normal) for (let c = 0; c < 3; c++) extraNorm.push(weights.reduce((sum, w, k) => sum + w * normal.array[ids[k] * 3 + c], 0));
          if (color) for (let c = 0; c < 3; c++) extraColor.push(weights.reduce((sum, w, k) => sum + w * color.array[ids[k] * 3 + c], 0));
          return out;
        };
        for (const poly of pieces) { const vids = poly.map(addVertex), o = fanOrigin(poly), n = poly.length; for (let k = 1; k + 1 < n; k++) { const b = (o + k) % n, c = (o + k + 1) % n; if (sliverXZ(poly[o], poly[b], poly[c])) continue; index.push(vids[o], vids[b], vids[c]); trianglesAfter++; } }
      }
      if (meshClipped) {
        const basePos = Array.from(pos.array), baseNorm = normal ? Array.from(normal.array) : null, baseColor = color ? Array.from(color.array) : null;
        g.setAttribute('position', new THREE.Float32BufferAttribute(basePos.concat(extraPos), 3));
        if (normal) g.setAttribute('normal', new THREE.Float32BufferAttribute(baseNorm.concat(extraNorm), 3));
        if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(baseColor.concat(extraColor), 3));
        g.setIndex(new THREE.BufferAttribute(Uint32Array.from(index), 1)); g.computeBoundingSphere();
      }
    }
    structureCut.removedArea = +structureCut.removedArea.toFixed(4); structureCut.parts = STRUCT.map(p => p.kind + (p.end ? ':' + p.end : ''));
    // a route's strip at a point (its row interval from the polygon's chainage; the strip's own triangles a, c, b and b, c, d). Every column of those rows, by its
    // cell's box: a column's place differs from its grid offset where the cross-section narrows (an RD05 end's taper puts the 2.8 m column at 1.6 m; TERRAIN_HOLE_FOLLOWUP_PLAN A5)
    const routeById = new Map((data.routes || []).map(rt => [rt.def.id, rt])), routeCells = new Map();
    polys.forEach((q, id) => { if (q.src.kind !== 'route' || (q.src.structure && q.src.structure !== 'tunnel-portal') || !routeById.has(q.src.id)) return;      // (the approach in front of a portal face is road)
      for (let x = Math.floor((q.box.x0 - CUT_EPS) / CELL); x <= Math.floor((q.box.x1 + CUT_EPS) / CELL); x++) for (let z = Math.floor((q.box.z0 - CUT_EPS) / CELL); z <= Math.floor((q.box.z1 + CUT_EPS) / CELL); z++) { const k = cellKey(x, z); let a = routeCells.get(k); if (!a) routeCells.set(k, a = []); a.push(id); } });
    const stripAt = (rt, i0, x, z, tol = SEAL_TOL) => {
      const S = rt.samples, n = S.length, m = rt.grid.length, st = rt.strip.pos; let h = null;
      for (let i = Math.max(0, i0 - 1); i <= Math.min(n - 2, i0 + 1); i++) {
        const F = rt.flatOf[i], xx = x + PERIOD * Math.round((F.x - x) / PERIOD);
        for (let jj = 0; jj <= m - 2; jj++) { const a = i * m + jj, b = a + 1, c = a + m, d = c + 1;
          if (xx < Math.min(st[a * 3], st[b * 3], st[c * 3], st[d * 3]) - SEAL_TOL || xx > Math.max(st[a * 3], st[b * 3], st[c * 3], st[d * 3]) + SEAL_TOL || z < Math.min(st[a * 3 + 2], st[b * 3 + 2], st[c * 3 + 2], st[d * 3 + 2]) - SEAL_TOL || z > Math.max(st[a * 3 + 2], st[b * 3 + 2], st[c * 3 + 2], st[d * 3 + 2]) + SEAL_TOL) continue;
          for (const [A, Bq, Cq] of [[a, c, b], [b, c, d]]) { const w = weightsXZ(st[A * 3], st[A * 3 + 2], st[Bq * 3], st[Bq * 3 + 2], st[Cq * 3], st[Cq * 3 + 2], xx, z, tol); if (!w) continue;
            const y = w[0] * st[A * 3 + 1] + w[1] * st[Bq * 3 + 1] + w[2] * st[Cq * 3 + 1]; if (h === null || y > h) h = y; } }
      }
      return h; };
    const routeAt = (x, z, tol = SEAL_TOL) => { let h = null; for (const id of routeCells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) || []) { const q = polys[id], b = q.box; if (x < b.x0 - SEAL_TOL || x > b.x1 + SEAL_TOL || z < b.z0 - SEAL_TOL || z > b.z1 + SEAL_TOL) continue;
      const rt = routeById.get(q.src.id), S = rt.samples; let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid].s <= q.src.s0 + 1e-9) lo = mid; else hi = mid; }
      const y = stripAt(rt, lo, x, z, tol); if (y !== null && (h === null || y > h)) h = y; } return h; };
    // the terrain's edge takes the height of what replaces the ground there (sealOutline): a junction's paving (its triangles are cut exactly, no slope runs on past
    // them) or the route's own strip (in an exit corridor the cut ends on the strip's outer column; elsewhere the strip's side slope runs over the cut edge)
    // except the ground that the structures keep as built, as tools/terrain_structure_check.mjs reads it on the uncut lattice (TERRAIN_HOLE_FOLLOWUP_PLAN A2): under every
    // deck row and row midpoint at o = 0, +-2.5, +-4.9 m and beside the deck at +-7, +-9 m (TS1), under the first metre of each deck at its abutments and 5 cm past the road
    // under each end wall column (TS3), over the tunnel's structure (its envelope in plan: the hill over the shell and the portal rings, TS2 and TS6) and in its mouths
    // between each face and its void (TS3). A vertex keeps its height when a terrain triangle that uses it, or has it inside an edge, holds one of those points or meets
    // that plan. (It was any vertex within 11.5 m of a deck's axis and 2.5 m past its ends, 8 m of the tunnel's and 0.5 m past its faces: that also kept cut edges no check
    // reads, J-T07 by the RN01-05 portal, the bridge approaches' embankments, the road in front of the east portal.) A point in a ground occupancy holds no terrain
    // triangle, so the occupancy's edge is sealed as anywhere else.
    const protPts = new Map(), protPolys = [], protCells = new Map(), pk = (x, z) => cellKey(Math.floor(x / CELL), Math.floor(z / CELL));
    const addPt = (x, z) => { for (const xx of [x, x - PERIOD, x + PERIOD]) { if (Math.abs(xx) > Math.PI * R + 4) continue; const k = pk(xx, z); let l = protPts.get(k); if (!l) protPts.set(k, l = []); l.push([xx, z]); } };
    const addProt = p => { for (const k of [0, -PERIOD, PERIOD]) { const q = k ? p.map(v => [v[0] + k, v[1]]) : p, box = [Math.min(...q.map(v => v[0])), Math.max(...q.map(v => v[0])), Math.min(...q.map(v => v[1])), Math.max(...q.map(v => v[1]))];
      if (box[1] < -Math.PI * R - 4 || box[0] > Math.PI * R + 4) continue; const id = protPolys.length; protPolys.push({ p: q, box });
      for (let x = Math.floor(box[0] / CELL); x <= Math.floor(box[1] / CELL); x++) for (let z = Math.floor(box[2] / CELL); z <= Math.floor(box[3] / CELL); z++) { const c = cellKey(x, z); let l = protCells.get(c); if (!l) protCells.set(c, l = []); l.push(id); } } };
    for (const br of data.bridges || []) { const st = br.strips && br.strips[0], g = br.topCols, m = g && g.length, Q = br.samples, n = Q.length; if (!st || !m || n < 2) continue;
      // the deck's plan at lateral o (its top columns; past them along the line from the centre through the edge column, as TS1 places o = +-7, +-9)
      const col = (i, j) => [st.pos[(i * m + j) * 3], st.pos[(i * m + j) * 3 + 2]];
      const rowAt = (i, o) => { if (Math.abs(o) > 5) { const c = rowAt(i, 0), e = col(i, o < 0 ? 0 : m - 1), f = Math.abs(o) / 5; return [c[0] + (e[0] - c[0]) * f, c[1] + (e[1] - c[1]) * f]; }
        let j = 0; while (j + 2 < m && g[j + 1] < o) j++; const a = col(i, j), b = col(i, j + 1), t = (o - g[j]) / (g[j + 1] - g[j]); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
      const deckAt = (s, o) => { let i = 0; while (i + 2 < n && Q[i + 1].s < s) i++; const t = Math.max(0, Math.min(1, (s - Q[i].s) / (Q[i + 1].s - Q[i].s))), a = rowAt(i, o), b = rowAt(i + 1, o); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
      for (let k = 1; k < 2 * (n - 1); k++) { const s = k % 2 ? (Q[k >> 1].s + Q[(k >> 1) + 1].s) / 2 : Q[k >> 1].s; for (const o of [0, -2.5, 2.5, -4.9, 4.9, -7, 7, -9, 9]) addPt(...deckAt(s, o)); }
      for (let k = 1; k <= 20; k++) for (const s of [k * 0.05, Q[n - 1].s - k * 0.05]) for (const o of [-4.9, -3.5, -2.1, -0.7, 0, 0.7, 2.1, 3.5, 4.9]) addPt(...deckAt(s, o));
    }
    for (const ab of data.abutments || []) { const rt = routeById.get(ab.route), wp = ab.wall && ab.wall.pos; if (!rt || !wp) continue;
      const iE = ab.rEnd === 'end' ? rt.samples.length - 1 : 0, tE = rt.tangent[iE], kE = rt.flatOf[iE].k * 0.05 * (ab.rEnd === 'end' ? 1 : -1);
      for (let j = 0; j < rt.grid.length; j++) if (Math.abs(rt.grid[j]) <= 5 + 1e-9) addPt(wp[(2 * j + 1) * 3] + tE[0] * kE, wp[(2 * j + 1) * 3 + 2] + tE[1] * kE); }
    // the tunnel's structure for the seal (roads.js tunnelEnvelope): its top triangles in plan with the planes of their top and foot, each with its cell's outer edges (on
    // them the ground may meet the structure, TS6)
    const envTris = [], envCells = new Map();
    for (const rt of data.routes || []) if (rt.tunnel && rt.tunnel.envelope) for (const part of rt.tunnel.envelope) part.cells.forEach((c, ci) => {
      const outer = part.kind === 'shell' ? [[1, 2], [3, 0], ...(ci === 0 ? [[0, 1]] : []), ...(ci === part.cells.length - 1 ? [[2, 3]] : [])] : [[0, 1], [1, 2], [2, 3], [3, 0]];
      for (const t of c.tris) { const top = planeXZ(t.p, t.top), foot = planeXZ(t.p, t.foot); if (!top || !foot) continue; const id = envTris.length, box = [Math.min(...t.p.map(v => v[0])), Math.max(...t.p.map(v => v[0])), Math.min(...t.p.map(v => v[1])), Math.max(...t.p.map(v => v[1]))];
        envTris.push({ p: t.p, top, foot, topMin: Math.min(...t.top), box, quad: c.quad, outer });
        for (let x = Math.floor(box[0] / CELL); x <= Math.floor(box[1] / CELL); x++) for (let z = Math.floor(box[2] / CELL); z <= Math.floor(box[3] / CELL); z++) { const k = cellKey(x, z); let l = envCells.get(k); if (!l) envCells.set(k, l = []); l.push(id); } } });
    const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-24, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
    // a point inside the structure: in a top triangle's plan, more than 2 mm from its cell's outer edges, between its foot and its top by more than 2 mm
    const inStructure = (x, z, y) => { for (const id of envCells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) || []) { const e = envTris[id], [a, b, c] = e.p, den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-14) continue;
      const w0 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / den, w1 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / den; if (w0 < -1e-9 || w1 < -1e-9 || 1 - w0 - w1 < -1e-9) continue;
      if (e.outer.some(([i, j]) => segDist(x, z, e.quad[i], e.quad[j]) < 2e-3)) continue; if (y > e.foot([x, z]) + 2e-3 && y < e.top([x, z]) - 2e-3) return true; } return false; };
    for (const q of polys) if (q.src.kind === 'tunnel-mouth') addProt(q.p);
    // a plan triangle tri = [[x, z] x 3] holds a protected point or meets a protected plan (separating axes, 1 cm inclusive)
    const sepAxis = (A, Bp) => { for (const P of [A, Bp]) for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], nx = b[1] - a[1], nz = a[0] - b[0], l = Math.hypot(nx, nz); if (l < 1e-12) continue;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const v of A) { const d = (v[0] * nx + v[1] * nz) / l; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } for (const v of Bp) { const d = (v[0] * nx + v[1] * nz) / l; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      if (a1 < b0 - 0.01 || b1 < a0 - 0.01) return true; } return false; };
    const protectedTri = (tri, ys) => {
      const x0 = Math.min(tri[0][0], tri[1][0], tri[2][0]), x1 = Math.max(tri[0][0], tri[1][0], tri[2][0]), z0 = Math.min(tri[0][1], tri[1][1], tri[2][1]), z1 = Math.max(tri[0][1], tri[1][1], tri[2][1]), seen = new Set();
      const [a, b, c] = tri, den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      for (let x = Math.floor(x0 / CELL); x <= Math.floor(x1 / CELL); x++) for (let z = Math.floor(z0 / CELL); z <= Math.floor(z1 / CELL); z++) {
        if (Math.abs(den) > 1e-14) for (const q of protPts.get(cellKey(x, z)) || []) { const w0 = ((b[1] - c[1]) * (q[0] - c[0]) + (c[0] - b[0]) * (q[1] - c[1])) / den, w1 = ((c[1] - a[1]) * (q[0] - c[0]) + (a[0] - c[0]) * (q[1] - c[1])) / den; if (w0 >= -1e-6 && w1 >= -1e-6 && 1 - w0 - w1 >= -1e-6) return true; }
        for (const id of protCells.get(cellKey(x, z)) || []) { if (seen.has(id)) continue; seen.add(id); const P = protPolys[id]; if (P.box[1] < x0 - 0.01 || P.box[0] > x1 + 0.01 || P.box[3] < z0 - 0.01 || P.box[2] > z1 + 0.01) continue; if (!sepAxis(tri, P.p)) return true; }
        // the hill over the tunnel: a triangle over a top triangle of the structure that reaches above it (under it, by the rings' feet, the ground may meet the road)
        if (ys) for (const id of envCells.get(cellKey(x, z)) || []) { if (seen.has('e' + id)) continue; seen.add('e' + id); const e = envTris[id]; if (e.box[1] < x0 - 0.01 || e.box[0] > x1 + 0.01 || e.box[3] < z0 - 0.01 || e.box[2] > z1 + 0.01) continue; if (Math.max(...ys) >= e.topMin - 0.01 && !sepAxis(tri, e.p)) return true; } }
      return false; };
    // an extra seal point within reach of protected ground (a lattice triangle round it may hold a protected point)
    const nearProtected = (x, z) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const k = cellKey(Math.floor(x / CELL) + a, Math.floor(z / CELL) + b); if ((protPts.get(k) || []).length || (protCells.get(k) || []).length) return true; } return false; };
    // under a structure's footprint (a tunnel's or bridge span's rows, a deck's plan): the ground kept there
    const footCells = new Map(); structureBoxes.forEach(b => { for (let x = Math.floor(b.x0 / CELL); x <= Math.floor(b.x1 / CELL); x++) for (let z = Math.floor(b.z0 / CELL); z <= Math.floor(b.z1 / CELL); z++) { const k = cellKey(x, z); let a = footCells.get(k); if (!a) footCells.set(k, a = []); a.push(b); } });
    const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    const underStructure = (x, z) => [x, x + PERIOD, x - PERIOD].some(xx => (footCells.get(cellKey(Math.floor(xx / CELL), Math.floor(z / CELL))) || []).some(b => xx >= b.x0 && xx <= b.x1 && z >= b.z0 && z <= b.z1 && inPoly(xx, z, b.p)));
    const keepTri = (tri, ys) => protectedTri(tri, ys), underTri = tri => underStructure((tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3);
    // a moved triangle (its new heights) that would reach into the tunnel's structure: its corners, edge midpoints and centre, as TS6 samples it
    const intoStructure = (tri, ys) => { if (!envTris.length) return false; const pts = [0, 1, 2].map(k => [tri[k][0], tri[k][1], ys[k]]); for (let k = 0; k < 3; k++) { const a = pts[k], b = pts[(k + 1) % 3]; pts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]); }
      pts.push([(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3, (ys[0] + ys[1] + ys[2]) / 3]); return pts.some(q => inStructure(q[0], q[1], q[2])); };
    state.keepGround = { tri: keepTri, under: underTri, point: nearProtected, moved: intoStructure };      // the occupancy cut seals by the same rules (cutTerrainByGround)
    state.stats.protectedGround = { points: [...protPts.values()].reduce((a, l) => a + l.length, 0), polygons: protPolys.length };
    // (where a paving and a strip meet at different heights the lower: the terrain never stands over either road surface; the higher one's edge keeps its few cm)
    const sealHeight = (x, z, tol = SEAL_TOL) => { const a = pavingAt(x, z, tol), b = routeAt(x, z, tol); return a === null ? b : b === null ? a : Math.min(a, b); };
    state.roadSurfaceAt = sealHeight;      // the road surface at a point of its outline (the occupancy cut's corner faces, kerbFaces)
    // the strip's columns on every open end row (a route's first and last row, not on a structure): the ground's edge runs straight along that row with vertices only
    // where lattice edges cross it, and between them it would not follow the cross-section (RD05's grass ridge 6 cm up, RD08's snow track 6 cm down); sealOutline
    // splits the edge at these points first (TERRAIN_HOLE_FOLLOWUP_PLAN A1). A copy one circumference away where the row lies past the date line.
    const endColumns = [];
    for (const rt of data.routes || []) { const S = rt.samples, n = S.length, m = rt.grid.length, st = rt.strip.pos, I = info.get(rt); if (n < 2) continue;
      for (const i of [0, n - 1]) { if (I.ranges.some(([r0, r1]) => S[i].s >= r0 - 1e-6 && S[i].s <= r1 + 1e-6)) continue;
        for (let j = 0; j < m; j++) { const k = (i * m + j) * 3, x = st[k], z = st[k + 2]; endColumns.push([x, z]); if (Math.abs(x) > Math.PI * R) endColumns.push([x - PERIOD * Math.sign(x), z]); } } }
    const sealed = sealOutline(sealHeight, new Map([...routeCells, ...paveCells]), CELL, outline, state.keepGround, endColumns);
    state.stats.roadCut = { roadPolygons: polys.length, terrainMeshes: meshes.length, trianglesBefore, trianglesAfter, clippedTriangles, removedArea: +removedArea.toFixed(3), structure: structureCut, sealed };
    return state.stats.roadCut;
  }
  // Reuse the exact road footprint for any sampled ground overlays which are built after the
  // road plan (section fields, landcover surfaces, and landmark lawns/ice). Interpolate every
  // vertex attribute, including UVs, so textured overlays keep their mapping at the new edge.
  function cutGroundMeshes(meshes, localYRange = null) {
    const polys = [...(state.roadPolygons || []), ...(state.capPolygons || [])], CELL = 2, cells = new Map(), cellKey = (x, z) => `${x},${z}`;
    if (!polys.length || !meshes.length) return { meshes: 0, trianglesBefore: 0, trianglesAfter: 0, clippedTriangles: 0, removedArea: 0 };
    for (let id = 0; id < polys.length; id++) {
      const b = polys[id].box;
      for (let x = Math.floor((b.x0 - CUT_EPS) / CELL); x <= Math.floor((b.x1 + CUT_EPS) / CELL); x++) for (let z = Math.floor((b.z0 - CUT_EPS) / CELL); z <= Math.floor((b.z1 + CUT_EPS) / CELL); z++) {
        const k = cellKey(x, z); let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(id);
      }
    }
    const read = (a, i, c) => [a.getX, a.getY, a.getZ, a.getW][c].call(a, i), identity = new THREE.Matrix4();
    let trianglesBefore = 0, trianglesAfter = 0, clippedTriangles = 0, removedArea = 0, clippedMeshes = 0, splits = 0;
    const capCells = new Map(); for (const [x, z] of state.capColumns || []) { const k = cellKey(Math.floor(x / CELL), Math.floor(z / CELL)); let l = capCells.get(k); if (!l) capCells.set(k, l = []); l.push([x, z]); }
    for (const mesh of meshes) {
      const g = mesh.geometry, pos = g && g.attributes && g.attributes.position;
      if (!pos || mesh.isInstancedMesh) continue;
      mesh.updateWorldMatrix(true, false); if (!mesh.matrixWorld.equals(identity)) continue;
      const ix = g.index, count = ix ? ix.count : pos.count, attrs = Object.entries(g.attributes).map(([name, a]) => ({ name, itemSize: a.itemSize, data: Array.from({ length: a.count * a.itemSize }, (_, j) => read(a, Math.floor(j / a.itemSize), j % a.itemSize)), extra: [] })), byName = new Map(attrs.map(a => [a.name, a])), index = [];
      let meshClipped = 0;
      for (let t = 0; t + 2 < count; t += 3) {
        const ids = [0, 1, 2].map(k => ix ? ix.getX(t + k) : t + k), v = ids.map(i => [pos.getX(i), pos.getY(i), pos.getZ(i)]), tri = v.map(p => [p[0], p[2]]);
        trianglesBefore++;
        const local = g.userData.local;
        if (localYRange && local && ids.some(i => local[i * 3 + 1] < localYRange[0] - 1e-6 || local[i * 3 + 1] > localYRange[1] + 1e-6)) { index.push(...ids); trianglesAfter++; continue; }
        const box = { x0: Math.min(...tri.map(p => p[0])), x1: Math.max(...tri.map(p => p[0])), z0: Math.min(...tri.map(p => p[1])), z1: Math.max(...tri.map(p => p[1])) }, nx0 = Math.floor(box.x0 / CELL), nx1 = Math.floor(box.x1 / CELL), nz0 = Math.floor(box.z0 / CELL), nz1 = Math.floor(box.z1 / CELL), found = new Set();
        if ((nx1 - nx0 + 1) * (nz1 - nz0 + 1) <= 256) { for (let x = nx0; x <= nx1; x++) for (let z = nz0; z <= nz1; z++) for (const id of cells.get(cellKey(x, z)) || []) found.add(id); }
        else for (let id = 0; id < polys.length; id++) { const b = polys[id].box; if (b.x1 >= box.x0 && b.x0 <= box.x1 && b.z1 >= box.z0 && b.z0 <= box.z1) found.add(id); }
        const candidates = [...found].filter(id => { const b = polys[id].box; return b.x1 >= box.x0 - CUT_EPS && b.x0 <= box.x1 + CUT_EPS && b.z1 >= box.z0 - CUT_EPS && b.z0 <= box.z1 + CUT_EPS; });
        if (!candidates.length) { index.push(...ids); trianglesAfter++; continue; }
        let pieces = [tri];
        for (const id of candidates) {
          const cut = polys[id], next = [];
          for (const poly of pieces) {
            const pb = { x0: Math.min(...poly.map(q => q[0])), x1: Math.max(...poly.map(q => q[0])), z0: Math.min(...poly.map(q => q[1])), z1: Math.max(...poly.map(q => q[1])) };
            if (cut.box.x1 < pb.x0 - 1e-7 || cut.box.x0 > pb.x1 + 1e-7 || cut.box.z1 < pb.z0 - 1e-7 || cut.box.z0 > pb.z1 + 1e-7) next.push(poly);
            else next.push(...subtractConvexXZ(poly, cut.p));
          }
          pieces = next; if (!pieces.length) break;
        }
        const area = Math.abs(polygonAreaXZ(tri)), remain = pieces.reduce((sum, p) => sum + Math.abs(polygonAreaXZ(p)), 0);
        if (area < 1e-10 || remain >= area - Math.max(1e-7, area * 1e-7)) { index.push(...ids); trianglesAfter++; continue; }
        clippedTriangles++; meshClipped++; removedArea += Math.max(0, area - remain);
        const den = (v[1][2] - v[2][2]) * (v[0][0] - v[2][0]) + (v[2][0] - v[1][0]) * (v[0][2] - v[2][2]);
        const addVertex = p => {
          const w0 = ((v[1][2] - v[2][2]) * (p[0] - v[2][0]) + (v[2][0] - v[1][0]) * (p[1] - v[2][2])) / den, w1 = ((v[2][2] - v[0][2]) * (p[0] - v[2][0]) + (v[0][0] - v[2][0]) * (p[1] - v[2][2])) / den, weights = [w0, w1, 1 - w0 - w1], positionAttr = byName.get('position'), out = (positionAttr.data.length + positionAttr.extra.length) / 3;
          for (const a of attrs) for (let c = 0; c < a.itemSize; c++) a.extra.push(weights.reduce((sum, w, k) => sum + w * read(g.attributes[a.name], ids[k], c), 0));
          return out;
        };
        for (const poly of pieces) { const vids = poly.map(addVertex); for (let k = 1; k + 1 < vids.length; k++) { index.push(vids[0], vids[k], vids[k + 1]); trianglesAfter++; } }
      }
      if (meshClipped) {
        for (const a of attrs) g.setAttribute(a.name, new THREE.Float32BufferAttribute(a.data.concat(a.extra), a.itemSize));
        g.clearGroups(); g.setIndex(new THREE.BufferAttribute(Uint32Array.from(index), 1)); g.computeBoundingSphere(); g.computeBoundingBox(); clippedMeshes++;
        splits += splitOpenEdges(g, capCells);
      }
    }
    return { meshes: clippedMeshes, trianglesBefore, trianglesAfter, clippedTriangles, removedArea: +removedArea.toFixed(3), capSplits: splits };
  }
  // TERRAIN_HOLE_FOLLOWUP_PLAN A7: an overlay's edge along a road's end cap runs from one cut point to the next, metres apart; bent onto the sphere north of about 70 degrees
  // that chord swings centimetres off the end row's own chords (LM07's ice over RN10-RD08's end, unify_check U2). Its open edges are split at the strip's columns on the
  // cap's far edge (cells: 'cx,cz' -> [[x, z]], 2 m), every attribute linear along the edge, so the edge runs beside the end row column for column.
  function splitOpenEdges(g, cells) {
    const ix = g.index, P = g.attributes.position; if (!ix || !cells.size) return 0;
    const names = Object.keys(g.attributes), base = names.map(nm => g.attributes[nm]), n0 = P.count, extra = names.map(() => []), get = (ai, i, c) => (i < n0 ? [base[ai].getX, base[ai].getY, base[ai].getZ, base[ai].getW][c].call(base[ai], i) : extra[ai][(i - n0) * base[ai].itemSize + c]);
    const pi = names.indexOf('position'), X = i => get(pi, i, 0), Z = i => get(pi, i, 2), kOf = i => posKey(X(i), Z(i)), idx = Array.from(ix.array), uses = new Map(), ek = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
    for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { const q = ek(kOf(idx[t + e]), kOf(idx[t + (e + 1) % 3])); uses.set(q, (uses.get(q) || 0) + 1); }
    const hitOn = (a, b) => { const ax = X(a), az = Z(a), dx = X(b) - ax, dz = Z(b) - az, l2 = dx * dx + dz * dz; if (l2 < 1.6e-7) return null; const l = Math.sqrt(l2);
      for (let cx = Math.floor(Math.min(ax, ax + dx) / 2); cx <= Math.floor(Math.max(ax, ax + dx) / 2); cx++) for (let cz = Math.floor(Math.min(az, az + dz) / 2); cz <= Math.floor(Math.max(az, az + dz) / 2); cz++)
        for (const q of cells.get(`${cx},${cz}`) || []) { const f = ((q[0] - ax) * dx + (q[1] - az) * dz) / l2; if (f * l > 2e-4 && (1 - f) * l > 2e-4 && Math.abs((q[0] - ax) * dz - (q[1] - az) * dx) / l < 2e-4) return f; } return null; };
    let n = n0, splits = 0; const out = [];
    for (let t = 0; t < idx.length; t += 3) {
      const stack = [[idx[t], idx[t + 1], idx[t + 2], [0, 1, 2].map(e => uses.get(ek(kOf(idx[t + e]), kOf(idx[t + (e + 1) % 3]))) === 1)]]; let guard = 0;
      while (stack.length) { const [p0, p1, p2, open] = stack.pop(), tri = [p0, p1, p2]; let f = null, e = 0;
        if (guard++ < 64) for (; e < 3; e++) if (open[e] && (f = hitOn(tri[e], tri[(e + 1) % 3])) !== null) break;
        if (f === null) { out.push(p0, p1, p2); continue; }
        const a = tri[e], b = tri[(e + 1) % 3], c = tri[(e + 2) % 3], v = n++; names.forEach((nm, ai) => { for (let k = 0; k < base[ai].itemSize; k++) extra[ai].push(get(ai, a, k) + (get(ai, b, k) - get(ai, a, k)) * f); });
        splits++; stack.push([a, v, c, [true, false, open[(e + 2) % 3]]], [v, b, c, [true, open[(e + 1) % 3], false]]); } }
    if (!splits) return 0;
    names.forEach((nm, ai) => { const s2 = base[ai].itemSize, arr = []; for (let i = 0; i < n0; i++) for (let k = 0; k < s2; k++) arr.push(get(ai, i, k)); g.setAttribute(nm, new THREE.Float32BufferAttribute(arr.concat(extra[ai]), s2)); });
    g.setIndex(new THREE.BufferAttribute(Uint32Array.from(out), 1)); g.computeBoundingSphere(); g.computeBoundingBox(); return splits;
  }
  // W10d: all marked town/landmark ground surfaces share one occupancy. After every module has
  // built, remove the terrain triangles beneath their upward-facing projected triangles.
  function cutTerrainByGround(meshes) {
    const CELL = 2, PERIOD = 2 * Math.PI * R, polys = [], cells = new Map(), cellKey = (x, z) => `${x},${z}`;
    const insert = (p, y) => {
      if (p.length !== 3 || Math.abs(polygonAreaXZ(p)) < 1e-8) return;
      const box = { x0: Math.min(...p.map(q => q[0])), x1: Math.max(...p.map(q => q[0])), z0: Math.min(...p.map(q => q[1])), z1: Math.max(...p.map(q => q[1])) };
      const id = polys.length; polys.push({ p, box, y });
      for (let x = Math.floor(box.x0 / CELL); x <= Math.floor(box.x1 / CELL); x++) for (let z = Math.floor(box.z0 / CELL); z <= Math.floor(box.z1 / CELL); z++) {
        const k = cellKey(x, z); let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(id);
      }
    };
    const seen = new Set();
    for (const mesh of meshes) {
      const g = mesh.geometry, pos = g?.attributes?.position; if (!pos || mesh.isInstancedMesh) continue;
      mesh.updateWorldMatrix(true, false); const e = mesh.matrixWorld.elements, ix = g.index, count = ix ? ix.count : pos.count;
      for (let t = 0; t + 2 < count; t += 3) {
        const ids = [0, 1, 2].map(k => ix ? ix.getX(t + k) : t + k), v = ids.map(i => {
          const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
          return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
        });
        const normalY = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]);
        if (normalY <= 1e-10) continue;
        const p = v.map(q => [q[0], q[2]]), key = p.map(q => `${Math.round(q[0] * 1e4)},${Math.round(q[1] * 1e4)}`).sort().join('|');
        if (seen.has(key)) continue; seen.add(key);
        const centre = p.reduce((s, q) => s + q[0], 0) / 3;
        const y = v.map(q => q[1]); insert(p, y);
        if (centre > PERIOD / 2) insert(p.map(q => [q[0] - PERIOD, q[1]]), y);
        else if (centre < -PERIOD / 2) insert(p.map(q => [q[0] + PERIOD, q[1]]), y);
      }
    }
    if (!polys.length) return { meshes: 0, occupancyTriangles: 0, trianglesBefore: 0, trianglesAfter: 0, clippedTriangles: 0, addedVertices: 0, removedArea: 0, geometryGate: gate('occupancy cut') };
    let trianglesBefore = 0, trianglesAfter = 0, clippedTriangles = 0, removedArea = 0, clippedMeshes = 0, addedVertices = 0;
    const read = (a, i, c) => [a.getX, a.getY, a.getZ, a.getW][c].call(a, i);
    // the height of the marked ground at a point of its outline (the highest of its triangles there); null off it
    const groundAt = (x, z) => { let h = null; for (const id of cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) || []) { const { p, y } = polys[id], w = weightsXZ(p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1], x, z, SEAL_TOL_GROUND);
      if (!w) continue; const q = w[0] * y[0] + w[1] * y[1] + w[2] * y[2]; if (h === null || q > h) h = q; } return h; };
    for (const mesh of [...state.ring, ...state.rest]) {
      const g = mesh.geometry, pos = g.attributes.position, ix = g.index, count = ix ? ix.count : pos.count, index = [];
      // the attributes by their keys in g.attributes (a BufferAttribute's own .name is '' here, it is not the key); read through getX..getW, so the values
      // are denormalised and the Float32 copies need no normalized flag
      const names = Object.keys(g.attributes), at = names.indexOf('position'), original = [], extras = names.map(() => []);
      let changed = false;
      for (let t = 0; t + 2 < count; t += 3) {
        const ids = [0, 1, 2].map(k => ix ? ix.getX(t + k) : t + k), v = ids.map(i => [pos.getX(i), pos.getY(i), pos.getZ(i)]), tri = v.map(p => [p[0], p[2]]);
        trianglesBefore++;
        const box = { x0: Math.min(...tri.map(p => p[0])), x1: Math.max(...tri.map(p => p[0])), z0: Math.min(...tri.map(p => p[1])), z1: Math.max(...tri.map(p => p[1])) };
        const found = new Set();
        for (let x = Math.floor(box.x0 / CELL); x <= Math.floor(box.x1 / CELL); x++) for (let z = Math.floor(box.z0 / CELL); z <= Math.floor(box.z1 / CELL); z++) for (const id of cells.get(cellKey(x, z)) || []) found.add(id);
        const candidates = [...found].filter(id => { const b = polys[id].box; return b.x1 > box.x0 + 1e-7 && b.x0 < box.x1 - 1e-7 && b.z1 > box.z0 + 1e-7 && b.z0 < box.z1 - 1e-7; });
        if (!candidates.length) { index.push(...ids); trianglesAfter++; continue; }
        let pieces = [tri];
        for (const id of candidates) {
          const cut = polys[id], next = [];
          for (const q of pieces) {
            const qb = { x0: Math.min(...q.map(p => p[0])), x1: Math.max(...q.map(p => p[0])), z0: Math.min(...q.map(p => p[1])), z1: Math.max(...q.map(p => p[1])) };
            if (cut.box.x1 <= qb.x0 + 1e-7 || cut.box.x0 >= qb.x1 - 1e-7 || cut.box.z1 <= qb.z0 + 1e-7 || cut.box.z0 >= qb.z1 - 1e-7) next.push(q);
            else next.push(...subtractConvexXZ(q, cut.p, 1e-8));
          }
          pieces = next; if (!pieces.length) break;
        }
        const area = Math.abs(polygonAreaXZ(tri)), remain = pieces.reduce((sum, p) => sum + Math.abs(polygonAreaXZ(p)), 0);
        if (area < 1e-10 || remain >= area - Math.max(1e-7, area * 1e-7)) { index.push(...ids); trianglesAfter++; continue; }
        changed = true; clippedTriangles++; removedArea += Math.max(0, area - remain);
        if (!original.length) for (const k of names) { const a = g.attributes[k]; original.push(Array.from({ length: a.count * a.itemSize }, (_, j) => read(a, Math.floor(j / a.itemSize), j % a.itemSize))); }
        const den = (v[1][2] - v[2][2]) * (v[0][0] - v[2][0]) + (v[2][0] - v[1][0]) * (v[0][2] - v[2][2]);
        const addVertex = p => {
          const w0 = ((v[1][2] - v[2][2]) * (p[0] - v[2][0]) + (v[2][0] - v[1][0]) * (p[1] - v[2][2])) / den,
            w1 = ((v[2][2] - v[0][2]) * (p[0] - v[2][0]) + (v[0][0] - v[2][0]) * (p[1] - v[2][2])) / den, weights = [w0, w1, 1 - w0 - w1], out = (original[at].length + extras[at].length) / 3;
          names.forEach((name, ai) => { const a = g.attributes[name]; for (let c = 0; c < a.itemSize; c++) extras[ai].push(weights.reduce((sum, w, k) => sum + w * read(a, ids[k], c), 0)); });
          return out;
        };
        for (const p of pieces) { const vids = p.map(addVertex), o = fanOrigin(p), n = p.length; for (let k = 1; k + 1 < n; k++) { const b = (o + k) % n, c = (o + k + 1) % n; if (sliverXZ(p[o], p[b], p[c])) continue; index.push(vids[o], vids[b], vids[c]); trianglesAfter++; } addedVertices += vids.length; }
      }
      if (changed) {
        names.forEach((name, i) => g.setAttribute(name, new THREE.Float32BufferAttribute(original[i].concat(extras[i]), g.attributes[name].itemSize)));
        g.setIndex(new THREE.BufferAttribute(Uint32Array.from(index), 1)); g.computeBoundingSphere(); g.computeBoundingBox(); clippedMeshes++;
      }
    }
    // W10_SPEC W10d U5: the ground's edge meets the terrain within 0.01 m. The town's islands stand 0.15 m over the plain with no outer face (and the plain's lattice
    // has columns on the town's edge); a landmark's ground sits a few cm off the lattice: the terrain's edge takes the ground's height (sealOutline), not near a
    // structure (the road cut's rule: the ground under a deck stays the lattice)
    // (a vertex this cut made on a road's outline, where the ground's outline crosses an end row or a strip's edge, takes the road's height: the road seal ran before it)
    const roadAt = state.roadSurfaceAt || (() => null), seal = sealOutline((x, z) => { const h = groundAt(x, z); return h !== null ? h : roadAt(x, z); }, cells, CELL, null, state.keepGround || null);
    // last, every terrain mesh loses its zero-width slivers (the cuts' collinear points; sliverXZ): they cover nothing and stand up as thin walls where a corner moved
    let slivers = 0; for (const m of [...state.ring, ...state.rest]) { const g = m.geometry, p = g.attributes.position, ix = g.index.array, keep = [];
      for (let t = 0; t < ix.length; t += 3) { if (sliverXZ([p.getX(ix[t]), p.getZ(ix[t])], [p.getX(ix[t + 1]), p.getZ(ix[t + 1])], [p.getX(ix[t + 2]), p.getZ(ix[t + 2])])) { slivers++; continue; } keep.push(ix[t], ix[t + 1], ix[t + 2]); }
      if (keep.length < ix.length) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(keep), 1)); }
    seal.slivers = slivers;
    seal.kerbs = state.roadSurfaceAt ? kerbFaces(groundAt, cells, CELL) : null;
    return { meshes: clippedMeshes, occupancyTriangles: polys.length, trianglesBefore, trianglesAfter, clippedTriangles, addedVertices, removedArea: +removedArea.toFixed(3), seal, geometryGate: gate('occupancy cut') };
  }
  // TERRAIN_HOLE_REPAIR_PLAN 4.3: the cut terrain meets the surface that replaces it. A used terrain vertex on that surface's outline (the remaining triangles lie
  // outside it, so a vertex of theirs on it is on its edge; heightAt gives the surface's height there, null off it) takes that height when the two differ by no more
  // than SEAL_MAX, a lattice corner and all its copies as well as a new vertex of the cut. First every T-junction there is closed: where such a point lies inside an
  // edge of a remaining triangle that does not use it (the cut met a lattice edge from one side only), and where any used vertex lies inside an edge whose end moves,
  // that triangle is split there, so moving the points opens no crack.
  // near(x, z): the point is within reach of the surface (cheap); C: the size of near's cells (a mesh outside every such cell is passed over)
  // extras: [[x, z], ...] points of the outline that need not be vertices yet (cutRoads: the strip's columns on its open end rows): an open edge through one is split
  // there and the new vertex takes the surface's height, so the cut edge follows the surface's own vertices
  function sealOutline(heightAt, nearCells, C, candidates = null, keep = null, extras = null) {
    // numeric keys (a position to 0.01 mm, a cell of C m): |x| < 432, |z| < 283 in the flat frame
    const meshes = [...state.ring, ...state.rest], key = posKey, target = new Map(), cell = (cx, cz) => (cx + 4096) * 8192 + cz + 4096, cellOf = (x, z) => cell(Math.floor(x / C), Math.floor(z / C)), tcells = new Map();
    const stats = { vertices: 0, points: 0, split: 0, meshes: 0, maxStep: 0 }, t0 = performance.now();
    // the surface's cells (the caller's map of 'cx,cz' keys, C m), and the same in 16 C blocks to pass over the meshes away from all of them
    const nearSet = new Set(), blocks = new Set(); for (const k of nearCells.keys()) { const [cx, cz] = k.split(',').map(Number); nearSet.add(cell(cx, cz)); blocks.add(cell(Math.floor(cx / 16), Math.floor(cz / 16))); }
    // a mesh's reach from its chunk (15 degrees, a 2 degree margin for the triangles placed by their centres): no pass over its vertices
    const near = (x, z) => nearSet.has(cellOf(x, z)), reach = (m, set) => { const t = m.userData.terrain, B16 = 16 * C, lon0 = t.cx * CHUNK_DEG - 182, lat0 = Math.max(-FLAT_LAT, t.cy * CHUNK_DEG - 92), lat1 = Math.min(FLAT_LAT, t.cy * CHUNK_DEG - 73);
      const x0 = R * lon0 * D, x1 = R * (lon0 + CHUNK_DEG + 4) * D, z0 = -R * Math.asinh(Math.tan(lat1 * D)), z1 = -R * Math.asinh(Math.tan(lat0 * D));
      for (let x = Math.floor(x0 / B16); x <= Math.floor(x1 / B16); x++) for (let z = Math.floor(z0 / B16); z <= Math.floor(z1 / B16); z++) if (set.has(cell(x, z))) return true; return false; };
    const list = meshes.filter(m => reach(m, blocks)), usedOf = g => { const u = new Uint8Array(g.attributes.position.count); for (const i of g.index.array) u[i] = 1; return u; }, vkeys = new Set();
    for (const m of list) { const g = m.geometry, p = g.attributes.position, used = usedOf(g);
      for (let i = 0; i < p.count; i++) { if (!used[i]) continue; const x = p.getX(i), z = p.getZ(i); if (!near(x, z)) continue; const k = key(x, z); if (extras) vkeys.add(k); if (target.has(k) || (candidates && !candidates.has(k))) continue;
        const h = heightAt(x, z); if (h === null) continue; const step = Math.abs(h - p.getY(i)) / Math.cosh(z / R); if (step < 1e-7 || step > SEAL_MAX) continue;
        target.set(k, { x, z, h }); stats.maxStep = Math.max(stats.maxStep, step); const c = cellOf(x, z); let l = tcells.get(c); if (!l) tcells.set(c, l = []); l.push(target.get(k)); } }
    // the points of a triangle that keeps its ground stay (keep.tri: the ground the structure checks read, TERRAIN_HOLE_FOLLOWUP_PLAN A2), its corners and any point inside
    // one of its edges (a split there would bend it); under a structure's footprint (keep.under) a corner does not rise: the ground kept under a deck or a tunnel's road
    // would come up through it (it may go down to meet the road in front of a portal, A2)
    const inEdge = (q, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; if (l2 < 1e-12) return false; const t = ((q.x - a[0]) * dx + (q.z - a[1]) * dz) / l2; return t > 0 && t < 1 && Math.abs((q.x - a[0]) * dz - (q.z - a[1]) * dx) / Math.sqrt(l2) < 2e-4; };
    if (keep && target.size) for (const m of list) { const g = m.geometry, p = g.attributes.position, ix = g.index.array;
      for (let t = 0; t < ix.length; t += 3) { const P3 = [0, 1, 2].map(e => [p.getX(ix[t + e]), p.getZ(ix[t + e])]), k3 = P3.map(v => key(v[0], v[1])), inside = [];
        let hit = k3.some(k => target.has(k)); const x0 = Math.min(P3[0][0], P3[1][0], P3[2][0]), x1 = Math.max(P3[0][0], P3[1][0], P3[2][0]), z0 = Math.min(P3[0][1], P3[1][1], P3[2][1]), z1 = Math.max(P3[0][1], P3[1][1], P3[2][1]);
        for (let cx = Math.floor(x0 / C); cx <= Math.floor(x1 / C); cx++) for (let cz = Math.floor(z0 / C); cz <= Math.floor(z1 / C); cz++) for (const q of tcells.get(cell(cx, cz)) || []) if (target.get(key(q.x, q.z)) === q && [0, 1, 2].some(e => inEdge(q, P3[e], P3[(e + 1) % 3]))) inside.push(q);
        if (!hit && !inside.length) continue;
        if (keep.under && keep.under(P3)) for (let e = 0; e < 3; e++) { const q = target.get(k3[e]); if (q && q.h > p.getY(ix[t + e]) && target.delete(k3[e])) stats.kept = (stats.kept || 0) + 1; }
        if (!keep.tri(P3, [0, 1, 2].map(e => p.getY(ix[t + e])))) continue;
        for (const k of [...k3, ...inside.map(q => key(q.x, q.z))]) if (target.delete(k)) stats.kept = (stats.kept || 0) + 1; } }
    // a triangle whose moved corners would take it into a structure keeps them (keep.moved), twice over for the corners that a first pass leaves
    if (keep && keep.moved && target.size) for (let pass = 0; pass < 2; pass++) for (const m of list) { const g = m.geometry, p = g.attributes.position, ix = g.index.array;
      for (let t = 0; t < ix.length; t += 3) { const k3 = [0, 1, 2].map(e => key(p.getX(ix[t + e]), p.getZ(ix[t + e]))); if (!k3.some(k => target.has(k))) continue;
        const P3 = [0, 1, 2].map(e => [p.getX(ix[t + e]), p.getZ(ix[t + e])]), Y3 = [0, 1, 2].map(e => (target.get(k3[e]) || { h: p.getY(ix[t + e]) }).h);
        if (keep.moved(P3, Y3)) for (const k of k3) if (target.delete(k)) stats.kept = (stats.kept || 0) + 1; } }
    for (const [c, l] of tcells) { const r = l.filter(q => target.get(key(q.x, q.z)) === q); if (r.length) tcells.set(c, r); else tcells.delete(c); }
    // the extra points that are no vertex yet (a vertex there follows the rule above); none within reach of protected ground
    const xtra = []; if (extras) for (const [x, z] of extras) { if (!near(x, z)) continue; const k = key(x, z); if (target.has(k) || vkeys.has(k) || (keep && keep.point(x, z))) continue;
      const h = heightAt(x, z); if (h === null) continue; const q = { x, z, h }; target.set(k, q); xtra.push(q); const c = cellOf(x, z); let l = tcells.get(c); if (!l) tcells.set(c, l = []); l.push(q); }
    stats.extras = xtra.length;
    stats.points = target.size;
    const pts = new Map(), around = new Set();
    for (const c of tcells.keys()) { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) around.add(c + a * 8192 + b); }
    const tblocks = new Set(); for (const c of around) tblocks.add(cell(Math.floor((Math.floor(c / 8192) - 4096) / 16), Math.floor((c % 8192 - 4096) / 16)));
    const moving = list.filter(m => reach(m, tblocks));     // the meshes that may hold a T-junction at a point that moves
    // a T-junction lies inside an edge that one triangle uses (in a conforming mesh two do): the edges near the moving points, counted over all meshes by their ends
    const ids = new Map(), idXZ = [], idOf = (k, x, z) => { let v = ids.get(k); if (v === undefined) { ids.set(k, v = ids.size); idXZ.push({ x, z }); } return v; }, ekey = (a2, b2) => (a2 < b2 ? a2 * 67108864 + b2 : b2 * 67108864 + a2), uses = new Map(), cellsOf = (x0, x1, z0, z1, f) => { for (let cx = Math.floor(x0 / C); cx <= Math.floor(x1 / C); cx++) for (let cz = Math.floor(z0 / C); cz <= Math.floor(z1 / C); cz++) if (f(cell(cx, cz))) return true; return false; };
    const nearTri = (p, ix, t) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (let k = 0; k < 3; k++) { const i = ix[t + k], x = p.getX(i), z = p.getZ(i); if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } return cellsOf(x0, x1, z0, z1, c => around.has(c)); };
    if (target.size) for (const m of moving) { const g = m.geometry, p = g.attributes.position, ix = g.index.array;
      for (let t = 0; t < ix.length; t += 3) { if (!nearTri(p, ix, t)) continue; const k = [0, 1, 2].map(e => { const x = p.getX(ix[t + e]), z = p.getZ(ix[t + e]); return idOf(key(x, z), x, z); });
        for (let e = 0; e < 3; e++) { const q = ekey(k[e], k[(e + 1) % 3]); uses.set(q, (uses.get(q) || 0) + 1); } } }
    // the points that may sit inside an edge: every vertex of those triangles in and around the cells of the points that move
    for (const v of [...idXZ, ...xtra]) { const c = cellOf(v.x, v.z); if (!around.has(c)) continue; let l = pts.get(c); if (!l) pts.set(c, l = []); l.push(v); }
    if (target.size) for (const m of moving) {
      const g = m.geometry, names = Object.keys(g.attributes), base = names.map(n => g.attributes[n]), n0 = base[0].count, extra = names.map(() => []);
      const P = names.indexOf('position'), get = (ai, i, c) => (i < n0 ? base[ai].array[i * base[ai].itemSize + c] : extra[ai][(i - n0) * base[ai].itemSize + c]), X = i => get(P, i, 0), Z = i => get(P, i, 2);
      let n = n0, splits = 0, dropped = 0; const idx = g.index.array, out = [], pos = g.attributes.position, thin = (i, j, k) => sliverXZ([X(i), Z(i)], [X(j), Z(j)], [X(k), Z(k)]);
      // inside the edge: within 0.2 mm of its line (Float32 positions of cut points sit up to ~0.05 mm off it) and more than 0.2 mm from both ends (no re-splitting
      // at a point that a split already made an end)
      const onEdge = (a, b, q) => { const ax = X(a), az = Z(a), dx = X(b) - ax, dz = Z(b) - az, l2 = dx * dx + dz * dz; if (l2 < 1.6e-7) return -1;
        const l = Math.sqrt(l2), t = ((q.x - ax) * dx + (q.z - az) * dz) / l2; if (t * l <= 2e-4 || (1 - t) * l <= 2e-4) return -1; return Math.abs((q.x - ax) * dz - (q.z - az) * dx) / l < 2e-4 ? t : -1; };
      // an open edge is split at a used vertex inside it when an end moves, else at a point that moves; the halves stay open, the new inner edges are shared
      const split = (a, b) => { const ka = key(X(a), Z(a)), kb = key(X(b), Z(b)), from = target.has(ka) || target.has(kb) ? pts : tcells, ax = X(a), bx = X(b), az = Z(a), bz = Z(b); let hit = null;
        cellsOf(Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz), c => { for (const q of from.get(c) || []) { const f = onEdge(a, b, q); if (f >= 0) { hit = { f, q }; return true; } } return false; }); return hit; };
      for (let t = 0; t < idx.length; t += 3) {
        if (!nearTri(pos, idx, t)) { out.push(idx[t], idx[t + 1], idx[t + 2]); continue; }
        if (thin(idx[t], idx[t + 1], idx[t + 2])) { dropped++; continue; }      // a zero-width sliver there would stand up as a wall once a corner moves
        const kk = [0, 1, 2].map(e => ids.get(key(X(idx[t + e]), Z(idx[t + e])))), stack = [[idx[t], idx[t + 1], idx[t + 2], [0, 1, 2].map(e => uses.get(ekey(kk[e], kk[(e + 1) % 3])) === 1)]];
        let guard = 0;
        while (stack.length) {
          const [p0, p1, p2, open] = stack.pop(), tri = [p0, p1, p2]; let hit = null, e = 0;
          if (guard++ < 64) for (; e < 3; e++) if (open[e] && (hit = split(tri[e], tri[(e + 1) % 3]))) break;
          if (!hit) { if (thin(p0, p1, p2)) dropped++; else out.push(p0, p1, p2); continue; }
          const a = tri[e], b = tri[(e + 1) % 3], c = tri[(e + 2) % 3], v = n++, oc1 = open[(e + 1) % 3], oc2 = open[(e + 2) % 3];
          // the new vertex on the edge itself (q may sit 0.05 mm off it: the halves cover the triangle exactly); a moving q's height goes to it
          names.forEach((nm, ai) => { const s2 = base[ai].itemSize; for (let k = 0; k < s2; k++) extra[ai].push(get(ai, a, k) + (get(ai, b, k) - get(ai, a, k)) * hit.f); });
          { const vx = Math.fround(extra[P][(v - n0) * 3]), vz = Math.fround(extra[P][(v - n0) * 3 + 2]), tq = target.get(key(hit.q.x, hit.q.z)); if (tq && !target.has(key(vx, vz))) { const tv = { x: vx, z: vz, h: tq.h }; target.set(key(vx, vz), tv); const c = cellOf(vx, vz); let l = tcells.get(c); if (!l) tcells.set(c, l = []); l.push(tv); } }
          splits++;
          stack.push([a, v, c, [true, false, oc2]], [v, b, c, [true, oc1, false]]);
        }
      }
      if (splits || dropped) { names.forEach((nm, ai) => g.setAttribute(nm, new THREE.Float32BufferAttribute(Array.from(base[ai].array.subarray(0, n0 * base[ai].itemSize)).concat(extra[ai]), base[ai].itemSize)));
        g.setIndex(new THREE.BufferAttribute(Uint32Array.from(out), 1)); stats.split += splits; stats.slivers = (stats.slivers || 0) + dropped; }
    }
    for (const m of target.size ? moving : []) {
      const g = m.geometry, used = usedOf(g); let p = g.attributes.position, moved = 0;
      for (let i = 0; i < p.count; i++) { if (!used[i]) continue; const x = p.getX(i), z = p.getZ(i); if (!tcells.has(cellOf(x, z))) continue; const q = target.get(key(x, z)); if (!q || p.getY(i) === q.h) continue;
        if (!moved && p === m.userData.chunkPosition) { p = p.clone(); g.setAttribute('position', p); }
        p.setY(i, q.h); moved++; }
      if (moved) { stats.vertices += moved; stats.meshes++; g.computeBoundingSphere(); g.computeBoundingBox(); }
    }
    stats.maxStep = +stats.maxStep.toFixed(4); stats.ms = +(performance.now() - t0).toFixed(1);
    return stats;
  }
  // TERRAIN_HOLE_FOLLOWUP_PLAN A4: where three surfaces meet in a corner, a cut vertex lies on a road's outline and on a ground occupancy's, and the occupancy seal put it at
  // the ground's height (a town island's top at an exit mouth, LM04's ground at CR01's edge over the road; LM02's grass under RN05-RD03's raised end, B2). Along the road the
  // terrain's edge then runs from that corner to the next vertex at the road's height and leaves a wedge open between it and the road's edge: a real step, the higher
  // surface's edge. It gets its own face, the vertical triangle from the corner and its counterpart on the road's edge to that next vertex (W10d U5 allows a kerb face on
  // the higher side; nothing else is covered).
  function kerbFaces(groundAt, occCells, C) {
    // (a corner lies on the road's outline itself, within the ground's own 0.5 mm: the terrain's 2 mm strip between an end row and an overlay's capped edge is the riser there)
    const roadAt = state.roadSurfaceAt, key = posKey, cellOk = (x, z) => occCells.has(`${Math.floor(x / C)},${Math.floor(z / C)}`), corners = new Map(), stats = { corners: 0, faces: 0 };
    const meshes = [...state.ring, ...state.rest];
    for (const m of meshes) { const g = m.geometry, p = g.attributes.position, used = new Uint8Array(p.count); for (const i of g.index.array) used[i] = 1;
      for (let i = 0; i < p.count; i++) { if (!used[i]) continue; const x = p.getX(i), z = p.getZ(i); if (!cellOk(x, z)) continue; const k = key(x, z); if (corners.has(k)) continue;
        const h = roadAt(x, z, SEAL_TOL_GROUND); if (h === null || groundAt(x, z) === null) continue; const up = Math.abs(p.getY(i) - h) / Math.cosh(z / R); if (up > 5e-3 && up <= 0.6) corners.set(k, h); } }
    stats.corners = corners.size; if (!corners.size) return stats;
    // the edges at those corners, counted over every mesh by their ends (an open edge is used once)
    const uses = new Map(), ek = (a, b) => (a < b ? a + '|' + b : b + '|' + a), touched = [];
    for (const m of meshes) { const g = m.geometry, p = g.attributes.position, ix = g.index.array; let any = false;
      for (let t = 0; t < ix.length; t += 3) { const k3 = [0, 1, 2].map(e => key(p.getX(ix[t + e]), p.getZ(ix[t + e]))); if (!k3.some(k => corners.has(k))) continue; any = true;
        for (let e = 0; e < 3; e++) { const q = ek(k3[e], k3[(e + 1) % 3]); uses.set(q, (uses.get(q) || 0) + 1); } }
      if (any) touched.push(m); }
    for (const m of touched) {
      const g = m.geometry, names = Object.keys(g.attributes), base = names.map(nm => g.attributes[nm]), n0 = base[0].count, extra = names.map(() => []), out = Array.from(g.index.array), P = names.indexOf('position'), N = names.indexOf('normal');
      const p = g.attributes.position, ix = g.index.array; let n = n0;
      for (let t = 0; t < ix.length; t += 3) { const id = [ix[t], ix[t + 1], ix[t + 2]], k3 = id.map(i => key(p.getX(i), p.getZ(i)));
        for (let e = 0; e < 3; e++) { const c = id[e], o = id[(e + 1) % 3], w = id[(e + 2) % 3]; for (const [a, b] of [[c, o], [o, c]]) {
          const ka = key(p.getX(a), p.getZ(a)), kb = key(p.getX(b), p.getZ(b)); if (!corners.has(ka) || uses.get(ek(ka, kb)) !== 1) continue;
          // (between two corners, the face is the quad over that edge: each corner's triangle, the second from the far corner's counterpart, once per edge)
          const xb = p.getX(b), zb = p.getZ(b), hb = corners.has(kb) ? corners.get(kb) : roadAt(xb, zb); if (corners.has(kb) && ka > kb) continue;
          if (hb === null || (!corners.has(kb) && Math.abs(p.getY(b) - hb) / Math.cosh(zb / R) > 5e-3)) continue;
          // the corner's counterpart on the road's edge, a new vertex over or under it; the face looks away from the triangle's third corner (at the road)
          const ax = p.getX(a), az = p.getZ(a), dx = xb - ax, dz = zb - az, l = Math.hypot(dx, dz); if (l < 1e-6) continue; let nx = dz / l, nz = -dx / l; if (nx * (p.getX(w) - ax) + nz * (p.getZ(w) - az) > 0) { nx = -nx; nz = -nz; }
          const foot = n++; names.forEach((nm, ai) => { const s2 = base[ai].itemSize; for (let k = 0; k < s2; k++) extra[ai].push(ai === P && k === 1 ? corners.get(ka) : ai === N ? [nx, 0, nz][k] : base[ai].array[a * s2 + k]); });
          // (a top, foot, b) or (a top, b, foot): counter-clockwise seen from the outward side
          const v1 = [0, corners.get(ka) - p.getY(a), 0], v2 = [dx, p.getY(b) - p.getY(a), dz], cr = [v1[1] * v2[2] - v1[2] * v2[1], v1[2] * v2[0] - v1[0] * v2[2], v1[0] * v2[1] - v1[1] * v2[0]];
          if (cr[0] * nx + cr[2] * nz > 0) out.push(a, foot, b); else out.push(a, b, foot); stats.faces++;
          if (corners.has(kb)) { const foot2 = n++; names.forEach((nm, ai) => { const s2 = base[ai].itemSize; for (let k = 0; k < s2; k++) extra[ai].push(ai === P && k === 1 ? hb : ai === N ? [nx, 0, nz][k] : base[ai].array[b * s2 + k]); });
            if (cr[0] * nx + cr[2] * nz > 0) out.push(foot, foot2, b); else out.push(foot, b, foot2); stats.faces++; } } } }
      if (n > n0) { names.forEach((nm, ai) => g.setAttribute(nm, new THREE.Float32BufferAttribute(Array.from(base[ai].array.subarray(0, n0 * base[ai].itemSize)).concat(extra[ai]), base[ai].itemSize)));
        g.setIndex(new THREE.BufferAttribute(Uint32Array.from(out), 1)); g.computeBoundingSphere(); g.computeBoundingBox(); }
    }
    return stats;
  }
  // The geometry gate (TERRAIN_HOLE_REPAIR_PLAN 4.2): every terrain mesh after the cuts and again after bend.js subdivide (scene.js), before the first frame. A mesh
  // fails on an attribute under an empty key, an attribute count unlike the position count, a position that is not finite, or an index that is not a whole number
  // in [0, count) (or an index count not a multiple of 3). A failure is logged as a page error (console.error) and kept in stats.gate[label].
  function gate(label) {
    const t0 = performance.now(), res = { meshes: 0, triangles: 0, bad: 0, examples: [] };
    for (const m of [...state.ring, ...state.rest, ...state.caps]) {
      res.meshes++; const g = m.geometry; res.triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
      const why = TERRAIN.geometryIssues(g);
      if (why.length) { res.bad++; if (res.examples.length < 8) res.examples.push(`${m.userData.terrain.kind} ${m.userData.terrain.cx ?? ''},${m.userData.terrain.cy ?? ''}: ${why.join(', ')}`); }
    }
    res.ms = +(performance.now() - t0).toFixed(1);
    (state.stats.gate || (state.stats.gate = {}))[label] = res;
    if (res.bad) console.error(`terrain geometry gate (${label}): ${res.bad} / ${res.meshes} meshes fail: ${res.examples.join('; ')}`);
    return res;
  }
  // W8g-a: the rest chunks by key, each made once (for the rest meshes or, earlier, for the sampler near a point); the same chunk objects as one global build
  const restChunk = new Map();
  const restChunks = keys => {
    const missing = keys.filter(k => !restChunk.has(k));
    if (missing.length) { for (const k of missing) restChunk.set(k, null); for (const c of B.buildRestChunks(missing)) restChunk.set(c.cy * 24 + c.cx, c); }
    return keys.slice().sort((a, b) => a - b).map(k => restChunk.get(k)).filter(Boolean);
  };
  const restRow = cy => restChunks(Array.from({ length: 24 }, (_, cx) => cy * 24 + cx));
  const t0 = performance.now();
  // the ring: the planes of the rendered ground, which the sampler reads
  const flatRingData = B.buildFlat({ ring: true, rest: false, window: RING_WINDOW });
  const ringData = flatRingData;
  // height of the rendered mesh over the whole planet (W.height inside the town patch). W8g-a: before the rest exists, built cell by cell from the chunks near
  // the point (lazySampler: the same values as the global index over [...flatRingData, ...restData], without meshing the planet first); once the rest exists, the
  // global index itself (one pass over its chunks, for the planet-wide builds that ask everywhere)
  state.sampler = () => (state.restBuilt ? state.samplerFull || (state.samplerFull = samplerFromChunks(W, [...flatRingData, ...state.restData]))
    : state.samplerLazy || (state.samplerLazy = lazySampler(W, B.samplerCell)));
  withPrivateRandom(() => {
    for (const c of ringData) if (c.ringIndex) add(geom(c, c.ringIndex), material, 'ring', state.ring, { cx: c.cx, cy: c.cy });
  });
  state.stats.ringBuildMs = Math.round(performance.now() - t0);

  // the land beyond the ring as a stepped build (W8_SPEC 13.1 A4): one step per chunk row, then the caps, then the meshes (the meshes in the build's private
  // stream exactly as the single withPrivateRandom call made them before)
  const restJob = TERRAIN.job(function* () {
    const restData = [];
    for (let cy = 0; cy < 12; cy++) { restData.push(...restRow(cy)); yield; }
    const capData = [true, false].map(north => B.buildCap(north));
    state.restData = restData;
    for (const c of restData) if (c.restIndex) add(geom(c, c.restIndex), material, 'rest', state.rest, { cx: c.cx, cy: c.cy });     // W10a: the ring and the rest share one material and one display rule
    capData.forEach((c, k) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(c.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(c.nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(c.col, 3)); g.setIndex(new THREE.BufferAttribute(c.index, 1));
      const m = add(g, capMat, 'cap', state.caps, { north: k === 0 }); m.visible = BEND.get() > 0.98;
    });
    if (BEND.seamSplit) BEND.seamSplit(root);                       // W8e-b: the chunks that cross the seam at -85 deg are cut along it
    state.restBuilt = true;
    state.stats.restBuildMs = restJob.stats.reduce((a, b) => a + b, 0);
  });
  // the polar caps (sphere coordinates, noBend) blend in over the last 2 % of the bend: part of the projection, not a view rule; opaque at 1, so the opaque
  // pass and its sorting stay as they are once the sphere is complete (a flip between opaque and transparent needs a new program: needsUpdate)
  function applyCaps() {
    const u = BEND.get(), t = Math.max(0, Math.min(1, (u - 0.98) / 0.02)), o = t * t * (3 - 2 * t);
    for (const m of state.caps) m.visible = t > 0;
    if (capMat.transparent !== (o < 1)) { capMat.transparent = o < 1; capMat.needsUpdate = true; } capMat.opacity = o;
  }
  BEND.onChange(applyCaps);
  state.ringData = ringData;
  state.restJob = restJob;
  state.samplerJob = TERRAIN.job(function* () { state.sampler(); });   // after restJob (worldgen.js deps): the global sampler index over the ring and the rest
  state.root = root; state.builder = B;   // (B keeps its vertex cache: roads.js colours its verges with it)
  state.stats.triangles = () => [...state.ring, ...state.rest, ...state.caps].reduce((s, m) => s + m.geometry.index.count / 3, 0);
  state.cutRoads = cutRoads;
  state.cutGroundMeshes = cutGroundMeshes;
  state.cutTerrainByGround = cutTerrainByGround;
  state.gate = gate;
  return state;
};

if (typeof module !== 'undefined' && module.exports) module.exports = TERRAIN;
else global.TERRAIN = TERRAIN;
})(typeof globalThis !== 'undefined' ? globalThis : this);
