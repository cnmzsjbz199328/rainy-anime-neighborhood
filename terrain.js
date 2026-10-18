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

const polygonAreaXZ = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a * 0.5; };
const CUT_EPS = 1e-3; // 1 mm tolerance for Float32 road rows against double-precision cut polygons
const CUT_PAD = 0.12; // Keep ground a handspan outside the swept right-of-way so Float32 edges cannot leave grass slivers on the pavement.
const CUT_CAP = 0.30; // The road rows are sampled every 0.5 m; cover their end rows as well as the intervals between them.
function splitPolygonXZ(poly, a, b, sign, eps = CUT_EPS) {
  const inside = [], outside = [], side = p => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q), ip = sp >= -eps, iq = sq >= -eps;
    if (ip) inside.push(p); else outside.push(p);
    if (ip !== iq && sp !== sq) { const t = sp / (sp - sq), x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; inside.push(x); outside.push(x); }
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

const TERRAIN = { R, BASE, RING_M, CHUNK_DEG, FLAT_LAT, RING_WINDOW, builder, sampler, samplerFromChunks, lazySampler };

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
  const add = (g, mat, kind, list, extra) => { const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.userData.terrain = { kind, ...extra }; root.add(m); list.push(m); return m; };
  // Once the unified road plan exists, remove the ground that a graded road replaces from the planetary ground: the swept cross-section between its rows
  // (and a short cap past each open end). This keeps the rendered terrain from sitting above roads between its much wider lattice samples.
  // W10c: a bridge stands over the ground and a tunnel runs under it, so neither replaces any: the seabed under a deck and the hill over RN01-05 stay.
  // The spans of world.js (roadkit.js gives them in each route's chainage) cut the rows they straddle at their exact ends (the row there interpolated, as
  // the mesh is linear between rows); a route that ends on an abutment has no cap there (the deck goes on from its last row). Every polygon keeps its
  // source (kind, route or junction, chainage); state.stats.groundCut lists the structures left uncut. The roads' full footprints stay as they are for
  // their other uses (paving, verges, the clearance of plants and furniture).
  const STRUCTURES = new Set(['tunnel', 'bridge']);
  function cutRoads(data) {
    const CELL = 2, PERIOD = 2 * Math.PI * R, polys = [], cells = new Map(), cellKey = (x, z) => `${x},${z}`, kept = [];
    const addPoly = (p, src) => {
      if (p.length < 3 || Math.abs(polygonAreaXZ(p)) < 1e-7) return;
      const centre = p.reduce((s, q) => s + q[0], 0) / p.length, copies = [p];
      if (centre > Math.PI * R) copies.push(p.map(q => [q[0] - PERIOD, q[1]]));
      else if (centre < -Math.PI * R) copies.push(p.map(q => [q[0] + PERIOD, q[1]]));
      for (const poly of copies) {
        const box = { x0: Math.min(...poly.map(q => q[0])), x1: Math.max(...poly.map(q => q[0])), z0: Math.min(...poly.map(q => q[1])), z1: Math.max(...poly.map(q => q[1])) };
        const id = polys.length; polys.push({ p: poly, box, src });
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
    const stripEdge = (rt, i) => {
      const boxes = corridors.get(rt); if (!boxes) return null;
      const F = rt.flatOf[i]; if (!boxes.some(b => F.x >= b.x0 && F.x <= b.x1 && F.z >= b.z0 && F.z <= b.z1)) return null;
      const m = rt.grid.length, t = rt.tangent[i], scale = rt.cf[i] * F.k, st = rt.strip.pos, off = j => { const k = (i * m + j) * 3; return ((st[k] - F.x) * -t[1] + (st[k + 2] - F.z) * t[0]) / scale; };
      return [off(0), off(m - 1)];
    };
    const routeRow = (rt, i, along = 0, nearX = rt.flatOf[i].x) => {
      const f = rt.footprint[i], e = stripEdge(rt, i);
      let lo = f[2] - CUT_PAD, hi = f[3] + CUT_PAD;
      if (e && (e[0] > lo || e[1] < hi)) { lo = Math.max(lo, e[0]); hi = Math.min(hi, e[1]); if (!limited.has(rt.def.id + ':' + i)) { limited.add(rt.def.id + ':' + i); connectorStats.limitedRows++; } }
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
    const addRoutePoly = (rt, p, src) => {
      const list = connectorsOf.get(rt);
      if (!list || !list.length) { addPoly(p, src); return; }
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
      if (!exits.length) { addPoly(p, src); return; }
      connectorStats.trimmed++; if (!parts.length) connectorStats.removed++; connectorStats.pieces += parts.length;
      for (const q of parts) addPoly(q, { ...src, connector: exits });
    };
    const info = new Map((data.routes || []).map(rt => [rt, structureRanges(rt)])), structurePolys = [], folds = { crossed: 0, reflex: 0, routes: {} };
    // a row interval as convex pieces (convexPartsXZ), the folded ones counted per route
    const rowParts = (rt, A, Bq) => { const r = convexPartsXZ([A[0], A[1], Bq[1], Bq[0]]); if (r.kind) { folds[r.kind]++; folds.routes[rt.def.id] = (folds.routes[rt.def.id] || 0) + 1; } return r.parts; };
    for (const rt of data.routes || []) for (let i = 0; i + 1 < rt.samples.length; i++) {
      const x = rt.flatOf[i].x, a = routeRow(rt, i, 0, x), b = routeRow(rt, i + 1, 0, x), sa = rt.samples[i].s, sb = rt.samples[i + 1].s, I = info.get(rt), row = s => (s === sa ? a : s === sb ? b : lerpRow(a, b, (s - sa) / (sb - sa)));
      for (const [p0, p1, tag] of pieces(sa, sb, I)) { const A = row(p0), Bq = row(p1); for (const q of rowParts(rt, A, Bq)) addRoutePoly(rt, q, { kind: 'route', id: rt.def.id, s0: +p0.toFixed(3), s1: +p1.toFixed(3), ...(tag ? { structure: tag } : {}), ...(limited.has(rt.def.id + ':' + i) || limited.has(rt.def.id + ':' + (i + 1)) ? { stripEdge: true } : {}) }); }
      for (const [p0, p1] of inside(sa, sb, I.ranges)) { const A = row(p0), Bq = row(p1); structurePolys.push(...rowParts(rt, A, Bq)); }      // the uncut footprint over the structure
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
    // Close the mask over the first and last half metre of each strip. The road mesh has a
    // complete cross-section at those rows, while an interval-only mask would leave the end
    // row exposed to the terrain and landmark lawns. A cap does not reach onto a structure.
    for (const rt of data.routes || []) if (rt.samples.length > 1) {
      const S = rt.samples, last = S.length - 1;
      for (const [i, c0, c1] of [[0, S[0].s - CUT_CAP, S[0].s], [last, S[last].s, S[last].s + CUT_CAP]]) for (const [p0, p1] of outside(c0, c1, info.get(rt).ranges)) {
        const A = routeRow(rt, i, p0 - S[i].s), Bq = routeRow(rt, i, p1 - S[i].s);
        for (const q of rowParts(rt, A, Bq)) addRoutePoly(rt, q, { kind: 'cap', id: rt.def.id, s0: +p0.toFixed(3), s1: +p1.toFixed(3), ...(limited.has(rt.def.id + ':' + i) ? { stripEdge: true } : {}) });
      }
    }
    for (const br of data.bridges || []) {
      kept.push({ type: 'bridge', bridge: br.def ? br.def.id : br.ids.join('+'), edges: br.ids, length: +br.length.toFixed(3) });
      const st = br.strips && br.strips[0], m = br.topCols && br.topCols.length; if (!st || !m) continue;
      for (let i = 0; i + 1 < br.samples.length; i++) { const x = br.flatOf[i].x, at = j => { let xx = st.pos[j * 3]; xx += PERIOD * Math.round((x - xx) / PERIOD); return [xx, st.pos[j * 3 + 2]]; };
        structurePolys.push([at(i * m), at(i * m + m - 1), at((i + 1) * m + m - 1), at((i + 1) * m)]); }      // the deck's plan: the ground under it stays
    }
    // junction paving cuts the ground it covers, but not over a tunnel or under a deck (the paving's triangles less the structures' footprints)
    const structureBoxes = structurePolys.map(p => ({ p, x0: Math.min(...p.map(q => q[0])), x1: Math.max(...p.map(q => q[0])), z0: Math.min(...p.map(q => q[1])), z1: Math.max(...p.map(q => q[1])) }));
    let junctionClipped = 0;
    for (const j of data.junctions || []) if (j.strip && j.strip.index) for (let t = 0; t + 2 < j.strip.index.length; t += 3) {
      const s = j.strip, at = k => { const n = s.index[t + k] * 3; return [s.pos[n], s.pos[n + 2]]; }, tri = [at(0), at(1), at(2)], src = { kind: 'junction', id: j.node || j.id };
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
    let trianglesBefore = 0, trianglesAfter = 0, clippedTriangles = 0, removedArea = 0;
    const meshes = [...state.ring, ...state.rest];
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
        if (area < 1e-10) { index.push(...ids); trianglesAfter++; continue; }
        if (remain >= area - Math.max(1e-7, area * 1e-7)) { index.push(...ids); trianglesAfter++; continue; }
        clippedTriangles++; meshClipped++; removedArea += Math.max(0, area - remain);
        const den = (v[1][2] - v[2][2]) * (v[0][0] - v[2][0]) + (v[2][0] - v[1][0]) * (v[0][2] - v[2][2]);
        const addVertex = p => {
          const w0 = ((v[1][2] - v[2][2]) * (p[0] - v[2][0]) + (v[2][0] - v[1][0]) * (p[1] - v[2][2])) / den, w1 = ((v[2][2] - v[0][2]) * (p[0] - v[2][0]) + (v[0][0] - v[2][0]) * (p[1] - v[2][2])) / den, w2 = 1 - w0 - w1, weights = [w0, w1, w2], out = pos.count + extraPos.length / 3;
          extraPos.push(p[0], weights.reduce((sum, w, k) => sum + w * v[k][1], 0), p[1]);
          if (normal) for (let c = 0; c < 3; c++) extraNorm.push(weights.reduce((sum, w, k) => sum + w * normal.array[ids[k] * 3 + c], 0));
          if (color) for (let c = 0; c < 3; c++) extraColor.push(weights.reduce((sum, w, k) => sum + w * color.array[ids[k] * 3 + c], 0));
          return out;
        };
        for (const poly of pieces) { const vids = poly.map(addVertex); for (let k = 1; k + 1 < vids.length; k++) { index.push(vids[0], vids[k], vids[k + 1]); trianglesAfter++; } }
      }
      if (meshClipped) {
        const basePos = Array.from(pos.array), baseNorm = normal ? Array.from(normal.array) : null, baseColor = color ? Array.from(color.array) : null;
        g.setAttribute('position', new THREE.Float32BufferAttribute(basePos.concat(extraPos), 3));
        if (normal) g.setAttribute('normal', new THREE.Float32BufferAttribute(baseNorm.concat(extraNorm), 3));
        if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(baseColor.concat(extraColor), 3));
        g.setIndex(new THREE.BufferAttribute(Uint32Array.from(index), 1)); g.computeBoundingSphere();
      }
    }
    state.stats.roadCut = { roadPolygons: polys.length, terrainMeshes: meshes.length, trianglesBefore, trianglesAfter, clippedTriangles, removedArea: +removedArea.toFixed(3) };
    return state.stats.roadCut;
  }
  // Reuse the exact road footprint for any sampled ground overlays which are built after the
  // road plan (section fields, landcover surfaces, and landmark lawns/ice). Interpolate every
  // vertex attribute, including UVs, so textured overlays keep their mapping at the new edge.
  function cutGroundMeshes(meshes, localYRange = null) {
    const polys = state.roadPolygons || [], CELL = 2, cells = new Map(), cellKey = (x, z) => `${x},${z}`;
    if (!polys.length || !meshes.length) return { meshes: 0, trianglesBefore: 0, trianglesAfter: 0, clippedTriangles: 0, removedArea: 0 };
    for (let id = 0; id < polys.length; id++) {
      const b = polys[id].box;
      for (let x = Math.floor((b.x0 - CUT_EPS) / CELL); x <= Math.floor((b.x1 + CUT_EPS) / CELL); x++) for (let z = Math.floor((b.z0 - CUT_EPS) / CELL); z <= Math.floor((b.z1 + CUT_EPS) / CELL); z++) {
        const k = cellKey(x, z); let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(id);
      }
    }
    const read = (a, i, c) => [a.getX, a.getY, a.getZ, a.getW][c].call(a, i), identity = new THREE.Matrix4();
    let trianglesBefore = 0, trianglesAfter = 0, clippedTriangles = 0, removedArea = 0, clippedMeshes = 0;
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
      }
    }
    return { meshes: clippedMeshes, trianglesBefore, trianglesAfter, clippedTriangles, removedArea: +removedArea.toFixed(3) };
  }
  // W10d: all marked town/landmark ground surfaces share one occupancy. After every module has
  // built, remove the terrain triangles beneath their upward-facing projected triangles.
  function cutTerrainByGround(meshes) {
    const CELL = 2, PERIOD = 2 * Math.PI * R, polys = [], cells = new Map(), cellKey = (x, z) => `${x},${z}`;
    const insert = p => {
      if (p.length !== 3 || Math.abs(polygonAreaXZ(p)) < 1e-8) return;
      const box = { x0: Math.min(...p.map(q => q[0])), x1: Math.max(...p.map(q => q[0])), z0: Math.min(...p.map(q => q[1])), z1: Math.max(...p.map(q => q[1])) };
      const id = polys.length; polys.push({ p, box });
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
        insert(p);
        if (centre > PERIOD / 2) insert(p.map(q => [q[0] - PERIOD, q[1]]));
        else if (centre < -PERIOD / 2) insert(p.map(q => [q[0] + PERIOD, q[1]]));
      }
    }
    if (!polys.length) return { meshes: 0, occupancyTriangles: 0, trianglesBefore: 0, trianglesAfter: 0, clippedTriangles: 0, removedArea: 0 };
    let trianglesBefore = 0, trianglesAfter = 0, clippedTriangles = 0, removedArea = 0, clippedMeshes = 0;
    const read = (a, i, c) => [a.getX, a.getY, a.getZ, a.getW][c].call(a, i);
    for (const mesh of [...state.ring, ...state.rest]) {
      const g = mesh.geometry, pos = g.attributes.position, ix = g.index, count = ix ? ix.count : pos.count, index = [], original = [], extras = [];
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
        if (!original.length) { for (const a of Object.values(g.attributes)) original.push(Array.from({ length: a.count * a.itemSize }, (_, j) => read(a, Math.floor(j / a.itemSize), j % a.itemSize))); }
        const attrs = Object.values(g.attributes), den = (v[1][2] - v[2][2]) * (v[0][0] - v[2][0]) + (v[2][0] - v[1][0]) * (v[0][2] - v[2][2]);
        const addVertex = p => {
          const w0 = ((v[1][2] - v[2][2]) * (p[0] - v[2][0]) + (v[2][0] - v[1][0]) * (p[1] - v[2][2])) / den,
            w1 = ((v[2][2] - v[0][2]) * (p[0] - v[2][0]) + (v[0][0] - v[2][0]) * (p[1] - v[2][2])) / den, weights = [w0, w1, 1 - w0 - w1], out = (original[0].length + extras[0].length) / attrs[0].itemSize;
          attrs.forEach((a, ai) => { for (let c = 0; c < a.itemSize; c++) extras[ai].push(weights.reduce((sum, w, k) => sum + w * read(a, ids[k], c), 0)); });
          return out;
        };
        if (!extras.length) attrs.forEach(a => extras.push([]));
        for (const p of pieces) { const vids = p.map(addVertex); for (let k = 1; k + 1 < vids.length; k++) { index.push(vids[0], vids[k], vids[k + 1]); trianglesAfter++; } }
      }
      if (changed) {
        Object.values(g.attributes).forEach((a, i) => g.setAttribute(a.name, new THREE.Float32BufferAttribute(original[i].concat(extras[i]), a.itemSize)));
        g.setIndex(new THREE.BufferAttribute(Uint32Array.from(index), 1)); g.computeBoundingSphere(); g.computeBoundingBox(); clippedMeshes++;
      }
    }
    return { meshes: clippedMeshes, occupancyTriangles: polys.length, trianglesBefore, trianglesAfter, clippedTriangles, removedArea: +removedArea.toFixed(3) };
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
  return state;
};

if (typeof module !== 'undefined' && module.exports) module.exports = TERRAIN;
else global.TERRAIN = TERRAIN;
})(typeof globalThis !== 'undefined' ? globalThis : this);
