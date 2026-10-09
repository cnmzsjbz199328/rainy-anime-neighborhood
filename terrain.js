// Planet terrain mesh (W3). Reads world.js (frozen planet layout) and builds:
//   - the terrain mesh in flat Mercator coordinates, rolled onto the sphere by bend.js (see docs/world/W3_SPEC.md section 2):
//       x = R lon, z = -R asinh(tan lat), y_flat = (height - 1.6) / cos lat   (bend multiplies y by cos lat again)
//   - the TR01 ring (everything within 24 m of the town patch) as separate meshes that stay visible at uBend = 0
//   - two polar caps (|lat| > 85 deg) in native sphere coordinates, excluded from the bend (material.userData.noBend)
//   - W8g-b: the cut of the ring under the 9 exit heads (their first L metres of road come from roads.js exitHeads, made at start-up)
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

  const inPatch = (lon, lat) => lon >= -P.lonMax - EPS && lon <= P.lonMax + EPS && lat >= P.latMin - EPS && lat <= P.latMax + EPS;

  const polyArea = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a * 0.5; };
  // W8g-b (W8_SPEC 13.2 B2): the cut of the ring under the exit heads: for every cell of a head's first L metres (rows 0 .. K), the strip's whole width, its outer
  // columns included (ruling 5 of the W8g-b breakdown: that contains the cross-section's footprint, paved + shoulder + ditch, plus 0.3 m for every class, and the outer
  // columns lie on the terrain, so the cut edge meets the road at the terrain's own height; a cut at the footprint + 0.3 m can end in a ditch or on a raised verge).
  // The polygon's sides are the strip's own outer edges. heads: [{ exit, rt, L, K }] (roads.js).
  const exitPolygons = heads => {
    const out = [];
    for (const hd of heads || []) {
      const rt = hd.rt; if (!rt?.strip?.pos || !rt.grid?.length || !rt.footprint?.length) continue;
      const m = rt.grid.length, pos = rt.strip.pos;
      const pointAt = (i, o) => {
        let j = 0;
        while (j + 1 < m - 1 && rt.grid[j + 1] < o) j++;
        const t = (o - rt.grid[j]) / (rt.grid[j + 1] - rt.grid[j]), a = (i * m + j) * 3, b = a + 3;
        return [pos[a] + (pos[b] - pos[a]) * t, pos[a + 2] + (pos[b + 2] - pos[a + 2]) * t];
      };
      const lo = rt.grid[0], hi = rt.grid[m - 1];
      for (let i = 0; i < hd.K; i++) {
        const lo0 = lo, hi0 = hi, lo1 = lo, hi1 = hi;
        const quad = [pointAt(i, lo0), pointAt(i + 1, lo1), pointAt(i + 1, hi1), pointAt(i, hi0)];
        if (Math.abs(polyArea(quad)) < 1e-7) continue;
        // where the road bends, the inner edge of a band can fold the quad: then it is cut along its interior diagonal into two triangles (the subtraction needs convex pieces)
        const turn = k => { const a = quad[k], b = quad[(k + 1) % 4], c = quad[(k + 2) % 4]; return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); }, tn = [0, 1, 2, 3].map(turn), sg = Math.sign(polyArea(quad));
        const reflex = tn.findIndex(t => Math.sign(t) === -sg && Math.abs(t) > 1e-12);      // turn k is at vertex k + 1
        const pieces = reflex < 0 ? [quad] : (() => { const v = (reflex + 1) % 4; return [[quad[v], quad[(v + 1) % 4], quad[(v + 2) % 4]], [quad[v], quad[(v + 2) % 4], quad[(v + 3) % 4]]]; })();
        for (const polygon of pieces) {
          if (Math.abs(polyArea(polygon)) < 1e-9) continue;
          const xs = polygon.map(p => p[0]), zs = polygon.map(p => p[1]);
          out.push({ polygon, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), exit: hd.exit, s0: rt.samples[i].s, s1: rt.samples[i + 1].s });
        }
      }
    }
    return out;
  };
  const splitHalfPlane = (poly, a, b, sign) => {
    const side = p => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])), inside = [], outside = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q), ip = sp >= -1e-9, iq = sq >= -1e-9;
      if (ip) inside.push(p); else outside.push(p);
      if (ip !== iq) { const t = sp / (sp - sq), x = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; inside.push(x); outside.push(x); }
    }
    const clean = p => p.filter((q, i) => Math.hypot(q[0] - p[(i + p.length - 1) % p.length][0], q[1] - p[(i + p.length - 1) % p.length][1]) > 1e-8);
    return [clean(inside), clean(outside)];
  };
  const subtractConvex = (subject, clip) => {
    let rest = subject; const outside = [], sign = polyArea(clip) >= 0 ? 1 : -1;
    for (let i = 0; i < clip.length && rest.length >= 3; i++) {
      const [inside, out] = splitHalfPlane(rest, clip[i], clip[(i + 1) % clip.length], sign);
      if (out.length >= 3 && Math.abs(polyArea(out)) > 1e-10) outside.push(out);
      rest = inside;
    }
    // Any final `rest` is the portion inside the clearance rectangle and is intentionally replaced by road geometry.
    return outside;
  };

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
    // W8g-b: the cut polygons by 2 m cell of the flat frame; a triangle visits only the polygons of its cells, in their original order (the others are skipped by the
    // bounding-box test anyway), so the cut is the same
    const PB = 2, pcell = new Map();
    if (opts.exitPolygons?.length) opts.exitPolygons.forEach((r, k) => { for (let ix = Math.floor(r.minX / PB); ix <= Math.floor(r.maxX / PB); ix++) for (let iz = Math.floor(r.minZ / PB); iz <= Math.floor(r.maxZ / PB); iz++) { const key = ix * 100000 + iz; let l = pcell.get(key); if (!l) pcell.set(key, l = []); l.push(k); } });
    const candidates = box => { const set = new Set(); for (let ix = Math.floor((box.minX - 1e-8) / PB); ix <= Math.floor((box.maxX + 1e-8) / PB); ix++) for (let iz = Math.floor((box.minZ - 1e-8) / PB); iz <= Math.floor((box.maxZ + 1e-8) / PB); iz++) { const l = pcell.get(ix * 100000 + iz); if (l) for (const k of l) set.add(k); } return [...set].sort((a, b) => a - b).map(k => opts.exitPolygons[k]); };
    const keep = (ra, ka, rb, kb, rc, kc) => {
      const A = [rings[ra].lons[ka], rings[ra].lat], B = [rings[rb].lons[kb], rings[rb].lat], C = [rings[rc].lons[kc], rings[rc].lat];
      if (inPatch(A[0], A[1]) && inPatch(B[0], B[1]) && inPatch(C[0], C[1])) return;                    // the town patch is the town's
      const lon = (A[0] + B[0] + C[0]) / 3, lat = (A[1] + B[1] + C[1]) / 3;
      if (lon < win.lonMin || lon > win.lonMax || lat < win.latMin || lat > win.latMax) return;
      if (opts.chunks && !opts.chunks.has(chunkKeyOf(lon, lat))) return;
      const isRing = W.townPatchDistance(lon, lat) < RING_M;
      if (isRing ? !opts.ring : !opts.rest) return;
      if (opts.exitPolygons?.length) {
        let pieces = [[[flatX(A[0]), flatZ(A[1])], [flatX(B[0]), flatZ(B[1])], [flatX(C[0]), flatZ(C[1])]]], changed = false;
        const x0 = pieces[0].map(p => p[0]), z0 = pieces[0].map(p => p[1]), triBox = { minX: Math.min(...x0), maxX: Math.max(...x0), minZ: Math.min(...z0), maxZ: Math.max(...z0) };
        for (const rect of candidates(triBox)) {
          if (rect.maxX < triBox.minX - 1e-8 || rect.minX > triBox.maxX + 1e-8 || rect.maxZ < triBox.minZ - 1e-8 || rect.minZ > triBox.maxZ + 1e-8) continue;
          const before = pieces.reduce((sum, p) => sum + Math.abs(polyArea(p)), 0), next = [];
          for (const poly of pieces) {
            const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
            if (rect.maxX < Math.min(...xs) - 1e-8 || rect.minX > Math.max(...xs) + 1e-8 || rect.maxZ < Math.min(...zs) - 1e-8 || rect.minZ > Math.max(...zs) + 1e-8) next.push(poly);
            else next.push(...subtractConvex(poly, rect.polygon));
          }
          const after = next.reduce((sum, p) => sum + Math.abs(polyArea(p)), 0);
          if (after < before - 1e-8) { pieces = next; changed = true; }
        }
        if (changed) {
          const ids0 = [vid(ra, ka), vid(rb, kb), vid(rc, kc)], triVerts = ids0.map(i => V[i]);
          for (const poly of pieces) for (let k = 1; k + 1 < poly.length; k++) {
            const p0 = poly[0], p1 = poly[k], p2 = poly[k + 1]; if (Math.abs(polyArea([p0, p1, p2])) < 5e-5) continue;
            const x = (p0[0] + p1[0] + p2[0]) / 3, z = (p0[1] + p1[1] + p2[1]) / 3, lo = x / (R * D), la = Math.atan(Math.sinh(-z / R)) / D;
            const ring = W.townPatchDistance(lo, la) < RING_M;
            tris.push({ a: clippedVid(p0, triVerts), b: clippedVid(p1, triVerts), c: clippedVid(p2, triVerts), lon: lo, lat: la, ring });
          }
          return;
        }
      }
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
        if (inPatch(A[0], A[1]) && inPatch(Bv[0], Bv[1]) && inPatch(C[0], C[1])) continue;   // the town patch is the town's
        const lon = (A[0] + Bv[0] + C[0]) / 3, lat = (A[1] + Bv[1] + C[1]) / 3, ring = W.townPatchDistance(lon, lat) < RING_M;
        found.push({ ring, key: chunkKeyOf(lon, lat), r, step, tri: [A[0], A[1], hOf(rings, A[2], A[3]), Bv[0], Bv[1], hOf(rings, Bv[2], Bv[3]), C[0], C[1], hOf(rings, C[2], C[3])] });
      }
    }
    found.sort((a, b) => (a.ring === b.ring ? 0 : a.ring ? -1 : 1) || a.key - b.key || a.r - b.r || a.step - b.step);
    return found.map(q => q.tri);
  }

  return { buildFlat, buildRestChunks, buildRestRow, samplerCell, buildCap, exitPolygons, vertex, vertexColor, lats, ringLons, inPatch, flatX, flatZ, chunkKeyOf };
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

// ---- W8g-b strip helpers (also used by roads.js and section.js for the road beyond a head)
// cells (triangles) of `index` whose vertices all lie in rows r0 .. r1 of a strip with m columns, in their order
const cellsIn = (index, m, r0, r1) => { const out = []; for (let t = 0; t < index.length; t += 3) { const a = index[t], b = index[t + 1], c = index[t + 2], lo = Math.floor(Math.min(a, b, c) / m), hi = Math.floor(Math.max(a, b, c) / m); if (lo >= r0 && hi <= r1) out.push(a, b, c); } return out; };
// vertex normals of a strip from the cells of `index` in rows n0 .. n1 (three.js computeVertexNormals on just those cells): a head (cells of rows 0 .. K + 1) and the
// road beyond it (cells of rows K - 1 .. end) sum the same triangles in the same order at the seam row K, so their normals there are the same numbers
function stripNormals(THREE, pos, index, m, n0, n1) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(cellsIn(index, m, n0, n1)); g.computeVertexNormals(); return g.getAttribute('normal').array; }
// one mesh per exit head (so the view culls them one by one): its plain cells keep the road's vertex colours and normals (as above); its pure town cells (the first
// 6 m: town asphalt, N11-N13 the paving colour of 12.4 G6) have their own vertices with the town colour as vertex colour, uv = one texture repeat per 4 m as the town's
// slabs, normals over those cells alone, and texW = 1: the head material (headMaterial) applies the asphalt grain only there. Each exit keeps only its rows 0 .. K.
// W8g-b (ruling 6): an end cap at row K, a wall from the road's last row to the terrain under it (H, the sampler), facing back into the town, capW = 1: where the
// road ends in the town view (the terrain resumes beyond), its ditch or its raised bed would leave an open slit; the material folds the cap away (uCap = 0) while the
// network road continues from row K (explore, sphere, section view), so the head and the road beyond still meet with the same vertices.
function headGeometry(THREE, heads, colours, H, terrainColour) {
  const out = [], R = 90, D = Math.PI / 180;
  for (const hd of heads) {
    const st = hd.rt.strip, m = hd.rt.grid.length, K = hd.K, last = hd.rt.samples.length - 1, P = { pos: [], col: [], nrm: [], uv: [], tw: [], cw: [], idx: [] };
    // (N08: the W4 section draws its strips with up normals, so its head does too)
    const gN = hd.upNormals ? Float32Array.from({ length: st.pos.length }, (_, k) => (k % 3 === 1 ? 1 : 0)) : stripNormals(THREE, st.pos, st.index, m, 0, Math.min(K + 1, last));
    const town = colours[['N11', 'N12', 'N13'].includes(hd.exit) ? 'paving' : 'asphalt'];
    const pushPart = (cells, normals, colour, w) => {
      if (!cells.length) return;
      const used = [...new Set(cells)].sort((a, b) => a - b), map = new Map(used.map((v, k) => [v, k])), base = P.pos.length / 3;
      let nTown = null;
      if (!normals) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(st.pos, 3)); g.setIndex(cells); g.computeVertexNormals(); nTown = g.getAttribute('normal').array; }
      for (const v of used) { for (let c = 0; c < 3; c++) { P.pos.push(st.pos[v * 3 + c]); P.col.push(colour ? colour[c] : st.col[v * 3 + c]); P.nrm.push((normals || nTown)[v * 3 + c]); } P.uv.push(st.pos[v * 3] / 4, -st.pos[v * 3 + 2] / 4); P.tw.push(w); P.cw.push(0); }
      for (const v of cells) P.idx.push(base + map.get(v));
    };
    pushPart(cellsIn(st.index, m, 0, K), gN, null, 0);
    pushPart(cellsIn(st.headIndex || [], m, 0, K), null, town, 1);
    if (H && K > 0) {                                                    // the end cap
      const a = K * m, b = (K - 1) * m + Math.floor(m / 2), c0 = a + Math.floor(m / 2), dx = st.pos[b * 3] - st.pos[c0 * 3], dz = st.pos[b * 3 + 2] - st.pos[c0 * 3 + 2], dl = Math.hypot(dx, dz) || 1, base = P.pos.length / 3;
      for (let j = 0; j < m; j++) {
        const v = a + j, x = st.pos[v * 3], y = st.pos[v * 3 + 1], z = st.pos[v * 3 + 2], lat = Math.atan(Math.sinh(-z / R)) / D, yt = (H(x / (R * D), lat) - 1.6) / Math.cos(lat * D);
        const tc = terrainColour ? terrainColour(x / (R * D), lat) : [st.col[v * 3], st.col[v * 3 + 1], st.col[v * 3 + 2]];        // an earth wall: the terrain's own colour, a little darker
        for (const yy of [y, yt]) { P.pos.push(x, yy, z); P.col.push(tc[0] * 0.85, tc[1] * 0.85, tc[2] * 0.85); P.nrm.push(dx / dl, 0, dz / dl); P.uv.push(0, 0); P.tw.push(0); P.cw.push(hd.exit === 'N08' ? 2 : 1); }   // 2: the W4 section's chain continues N08
      }
      for (let j = 0; j + 1 < m; j++) {                                 // both windings (the material draws front faces only): seen from the town side and from beyond
        const t0 = base + j * 2, b0 = t0 + 1, t1 = t0 + 2, b1 = t0 + 3;
        P.idx.push(t0, b0, t1, t1, b0, b1, t0, t1, b0, t1, b1, b0);
      }
    }
    if (!P.idx.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(P.col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(P.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(P.uv, 2)); g.setAttribute('texW', new THREE.Float32BufferAttribute(P.tw, 1)); g.setAttribute('capW', new THREE.Float32BufferAttribute(P.cw, 1)); g.setIndex(P.idx);
    g.computeBoundingSphere(); out.push({ exit: hd.exit, geometry: g, surface: ['N11', 'N12', 'N13'].includes(hd.exit) ? 'paving' : 'asphalt' });
  }
  return out;
}
// the material of the heads: toon with vertex colours and the town asphalt's grain, the grain applied only where texW = 1 (a select, not a blend, so a town cell renders
// as colour x texel exactly like the town's own textured material, and a road cell as its vertex colour exactly like the ground material of the road strips)
function headMaterial(THREE, makeMaterial, map, capU) {
  const mtl = makeMaterial(); mtl.map = map; mtl.polygonOffset = true; mtl.polygonOffsetFactor = -2; mtl.polygonOffsetUnits = -2;
  mtl.onBeforeCompile = shader => {
    shader.uniforms.uCap = capU;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float texW;\nattribute float capW;\nuniform vec2 uCap;\nvarying float vTexW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTexW = texW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nif ((capW > 0.5 && capW < 1.5 && uCap.x < 0.5) || (capW > 1.5 && uCap.y < 0.5)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTexW;').replace('#include <map_fragment>', '#ifdef USE_MAP\n  vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n  diffuseColor *= vTexW > 0.5 ? sampledDiffuseColor : vec4( 1.0 );\n#endif');
  };
  return mtl;
}
TERRAIN.cellsIn = cellsIn; TERRAIN.stripNormals = stripNormals;

// opts.exitHeads(sampler, builder) -> the exit heads (roads.js exitHeads): W8g-b, the town view's exit roads and the ring's cut are made from them at start-up
TERRAIN.attach = function (scene, makeMaterial, BEND, townAsphaltMaterial, opts = {}) {
  const THREE = global.THREE, W = global.WORLD, B = builder(W);
  let material, capMat, restMat, headMat, root; const capU = { value: new THREE.Vector2(1, 1) };     // the exit heads' end caps shown (1) while the road beyond is not: x the network's exits, y N08 (the W4 section)
  withPrivateRandom(() => {
    material = makeMaterial();
    capMat = material.clone(); capMat.userData = { noBend: true };
    restMat = material.clone();                                    // own material so the land around the town can fade in (W8a) without touching the ring's
    // W8g-b: the exit heads: the first 6 m in the town's own asphalt colour and grain (N11-N13: the paving colour of 12.4 G6 on the same grain), the rest as the
    // network's road strips (toon, vertex colours, polygon offset -2 / -2 as section.js groundMat), one material for all (headMaterial)
    headMat = headMaterial(THREE, makeMaterial, townAsphaltMaterial ? townAsphaltMaterial.map : null, capU);
    root = new THREE.Group(); root.name = 'terrain'; scene.add(root);
  });
  const state = { ring: [], heads: [], rest: [], caps: [], restBuilt: false, stats: {} };
  const geom = (c, index) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', c.posAttr || (c.posAttr = new THREE.BufferAttribute(c.pos, 3)));
    g.setAttribute('normal', c.nrmAttr || (c.nrmAttr = new THREE.BufferAttribute(c.nrm, 3)));
    g.setAttribute('color', c.colAttr || (c.colAttr = new THREE.BufferAttribute(c.col, 3)));
    g.setIndex(new THREE.BufferAttribute(index, 1)); return g;
  };
  const add = (g, mat, kind, list, extra) => { const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.userData.terrain = { kind, ...extra }; root.add(m); list.push(m); return m; };
  // W8g-a: the rest chunks by key, each made once (for the rest meshes or, earlier, for the sampler near a point); the same chunk objects as one global build
  const restChunk = new Map();
  const restChunks = keys => {
    const missing = keys.filter(k => !restChunk.has(k));
    if (missing.length) { for (const k of missing) restChunk.set(k, null); for (const c of B.buildRestChunks(missing)) restChunk.set(c.cy * 24 + c.cx, c); }
    return keys.slice().sort((a, b) => a - b).map(k => restChunk.get(k)).filter(Boolean);
  };
  const restRow = cy => restChunks(Array.from({ length: 24 }, (_, cx) => cy * 24 + cx));
  const t0 = performance.now();
  // the uncut ring: the planes of the rendered ground, which the sampler reads (inside a road's cut the road stands on that plane)
  const flatRingData = B.buildFlat({ ring: true, rest: false, window: RING_WINDOW });
  // height of the rendered mesh over the whole planet (W.height inside the town patch). W8g-a: before the rest exists, built cell by cell from the chunks near
  // the point (lazySampler: the same values as the global index over [...flatRingData, ...restData], without meshing the planet first); once the rest exists, the
  // global index itself (one pass over its chunks, for the planet-wide builds that ask everywhere)
  state.sampler = () => (state.restBuilt ? state.samplerFull || (state.samplerFull = samplerFromChunks(W, [...flatRingData, ...state.restData]))
    : state.samplerLazy || (state.samplerLazy = lazySampler(W, B.samplerCell)));
  // W8g-b (W8_SPEC 13.2 B1, B2): the exit heads, and one ring for the flat and the sphere view, cut under each head's whole cross-section (paved + shoulder + ditch)
  // plus 0.3 m (the road's verge beyond covers that margin)
  const th = performance.now(), heads = opts.exitHeads ? opts.exitHeads(state.sampler(), B) : [];
  state.stats.headsMs = Math.round(performance.now() - th);
  const exitPolygons = B.exitPolygons(heads);
  const ringData = exitPolygons.length ? B.buildFlat({ ring: true, rest: false, window: RING_WINDOW, exitPolygons }) : flatRingData;
  state.exitHeads = heads; state.stats.exitClearancePolygons = exitPolygons.length;
  state.headCaps = () => capU.value.toArray();
  state.setHeadCaps = (which, on) => { if (which === 'section') capU.value.y = on ? 1 : 0; else capU.value.x = on ? 1 : 0; };   // roads.js / section.js: off while their road continues
  withPrivateRandom(() => {
    for (const c of ringData) if (c.ringIndex) add(geom(c, c.ringIndex), material, 'ring', state.ring, { cx: c.cx, cy: c.cy });
    const townColour = { asphalt: new THREE.Color(townAsphaltMaterial ? townAsphaltMaterial.color : '#46505b').toArray(), paving: new THREE.Color('#8f8a7c').toArray() };
    for (const part of headGeometry(THREE, heads, townColour, state.sampler(), (lo, la) => B.vertexColor(lo, la))) add(part.geometry, headMat, 'head', state.heads, { exit: part.exit, surface: part.surface });
  });
  state.stats.ringBuildMs = Math.round(performance.now() - t0);

  // the land beyond the ring as a stepped build (W8_SPEC 13.1 A4): one step per chunk row, then the caps, then the meshes (the meshes in the build's private
  // stream exactly as the single withPrivateRandom call made them before)
  const restJob = TERRAIN.job(function* () {
    const restData = [];
    for (let cy = 0; cy < 12; cy++) { restData.push(...restRow(cy)); yield; }
    const capData = [true, false].map(north => B.buildCap(north));
    state.restData = restData;
    for (const c of restData) if (c.restIndex) { const m = add(geom(c, c.restIndex), restMat, 'rest', state.rest, { cx: c.cx, cy: c.cy }); m.visible = BEND.get() > 0 || state.fade.rest > 0; }
    capData.forEach((c, k) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(c.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(c.nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(c.col, 3)); g.setIndex(new THREE.BufferAttribute(c.index, 1));
      const m = add(g, capMat, 'cap', state.caps, { north: k === 0 }); m.visible = BEND.get() > 0.98;
    });
    if (BEND.seamSplit) BEND.seamSplit(root);                       // W8e-b: the chunks that cross the seam at -85 deg are cut along it
    state.restBuilt = true;
    state.stats.restBuildMs = restJob.stats.reduce((a, b) => a + b, 0);
  });
  function buildRest() { if (!state.restBuilt) restJob.finish(); }
  // opacity of a material that is opaque at 1 (the opaque pass and its sorting stay exactly as before while the fade is complete)
  const setOpacity = (m, o) => { const t = o < 1; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } m.opacity = o; };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const exploreListeners = [];
  state.explore = false;
  state.onExplore = fn => exploreListeners.push(fn);
  state.setExplore = on => { if (on === state.explore) return; state.explore = on; for (const fn of exploreListeners) fn(); };
  state.fade = { rest: 0 };                                          // W8a: 0..1 visibility of the land around the town while the town is still flat (uBend = 0)
  function apply() {
    const u = BEND.get(), restOn = u > 0 || state.fade.rest > 0;          // (W8g-b: the ring and the exit heads are the same in every view)
    if (restOn) buildRest();
    for (const m of state.rest) m.visible = restOn;
    if (state.restBuilt) setOpacity(restMat, u > 0 ? 1 : state.fade.rest);
    const cf = smooth(0.98, 1, u);
    for (const m of state.caps) m.visible = cf > 0;
    if (state.restBuilt) setOpacity(capMat, cf);
  }
  BEND.onChange(apply);
  state.ringData = ringData;
  state.restJob = restJob;
  state.samplerJob = TERRAIN.job(function* () { buildRest(); state.sampler(); });
  state.setFade = f => { f = Math.max(0, Math.min(1, f)); if (f !== state.fade.rest) { state.fade.rest = f; apply(); } return f; };
  state.apply = apply; state.buildRest = buildRest; state.root = root; state.builder = B;   // (B keeps its vertex cache: roads.js colours its verges with it)
  state.fadeMaterials = [restMat, capMat];                           // W8g-a: they switch between opaque and transparent (setOpacity): two shader programs each
  state.stats.triangles = () => [...state.ring, ...state.heads, ...state.rest, ...state.caps].reduce((s, m) => s + m.geometry.index.count / 3, 0);
  return state;
};

if (typeof module !== 'undefined' && module.exports) module.exports = TERRAIN;
else global.TERRAIN = TERRAIN;
})(typeof globalThis !== 'undefined' ? globalThis : this);
