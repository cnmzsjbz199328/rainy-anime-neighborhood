// Planet terrain mesh (W3). Reads world.js (frozen planet layout) and builds:
//   - the terrain mesh in flat Mercator coordinates, rolled onto the sphere by bend.js (see docs/world/W3_SPEC.md section 2):
//       x = R lon, z = -R asinh(tan lat), y_flat = (height - 1.6) / cos lat   (bend multiplies y by cos lat again)
//   - the TR01 ring (everything within 24 m of the town patch) as separate meshes that stay visible at uBend = 0
//   - two polar caps (|lat| > 85 deg) in native sphere coordinates, excluded from the bend (material.userData.noBend)
//   - short grey-box starts of the 9 town-exit roads
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
const EXIT_CLASS = { RD01: { w: 9, c: hex('#2e3646') }, RD03: { w: 4.5, c: hex('#2e3646') }, RD05: { w: 3, c: hex('#5c5344') } };   // asphalt, asphalt, packed earth
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

  // vertex data of one lattice point (height, flat position, local-frame normal, colour)
  function vertex(lon, lat) {
    const h = W.height(lon, lat), s = Math.cos(lat * D), yt = h - BASE;
    const e = 0.75, dlon = e / (R * s) / D, dlat = e / R / D;
    const gE = (W.height(lon + dlon, lat) - W.height(lon - dlon, lat)) / (2 * e), gN = (W.height(lon, lat + dlat) - W.height(lon, lat - dlat)) / (2 * e);
    let nx = -gE, ny = 1, nz = gN; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;   // x east, y up, z south
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
    return { x: flatX(lon), y: yt / s, z: flatZ(lat), nx, ny, nz, c, lon, lat, h };
  }

  // Build the flat mesh. opts: { ring: bool, rest: bool, window: {lonMin, lonMax, latMin, latMax} }
  function buildFlat(opts) {
    const win = opts.window || { lonMin: -181, lonMax: 181, latMin: -90, latMax: 90 };
    const rings = lats.map(l => ({ lat: l, lons: ringLons(l) }));
    const vmap = new Map(), V = [];
    const vid = (r, k) => { const key = r * 100000 + k; let i = vmap.get(key); if (i === undefined) { i = V.length; V.push(vertex(rings[r].lons[k], rings[r].lat)); vmap.set(key, i); } return i; };
    const tris = [];   // {a, b, c} as vertex ids, with chunk and ring flag resolved later
    const keep = (ra, ka, rb, kb, rc, kc) => {
      const A = [rings[ra].lons[ka], rings[ra].lat], B = [rings[rb].lons[kb], rings[rb].lat], C = [rings[rc].lons[kc], rings[rc].lat];
      if (inPatch(A[0], A[1]) && inPatch(B[0], B[1]) && inPatch(C[0], C[1])) return;                    // the town patch is the town's
      const lon = (A[0] + B[0] + C[0]) / 3, lat = (A[1] + B[1] + C[1]) / 3;
      if (lon < win.lonMin || lon > win.lonMax || lat < win.latMin || lat > win.latMax) return;
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
      const cx = Math.min(23, Math.floor((t.lon + 180) / CHUNK_DEG)), cy = Math.min(11, Math.floor((t.lat + 90) / CHUNK_DEG)), key = cy * 24 + cx;
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

  // Grey-box starts of the town-exit roads: a ribbon on the first min(15 m, edge length) of the edge that touches the exit.
  function buildStubs() {
    const NET = W.roadNetwork, out = [];
    for (const node of NET.nodes.filter(n => n.kind === 'town-exit')) {
      const edge = NET.edges.find(e => e.from === node.id || e.to === node.id), cls = EXIT_CLASS[edge.class];
      let S = NET.samplePath(edge, 0.5); const len = NET.edgeLength(edge);
      if (edge.to === node.id) S = S.slice().reverse().map(p => ({ ...p, s: len - p.s }));
      const L = Math.min(15, len), pts = S.filter(p => p.s <= L + 1e-9);
      const P2 = pts.map(p => { const c = Math.cos(p.lat * D); return { x: flatX(p.lon), z: flatZ(p.lat), y: (p.h - BASE + 0.02) / c, w: cls.w / c / 2, lon: p.lon, lat: p.lat, h: p.h }; });
      const n = P2.length, pos = new Float32Array(n * 6), nrm = new Float32Array(n * 6), col = new Float32Array(n * 6), idx = [];
      P2.forEach((p, k) => {
        const a = P2[Math.max(0, k - 1)], b = P2[Math.min(n - 1, k + 1)];
        let tx = b.x - a.x, tz = b.z - a.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const lx = p.x + tz * p.w, lz = p.z - tx * p.w, rx = p.x - tz * p.w, rz = p.z + tx * p.w;     // left / right edge in the flat plane
        pos.set([lx, p.y, lz, rx, p.y, rz], k * 6); nrm.set([0, 1, 0, 0, 1, 0], k * 6); col.set([...cls.c, ...cls.c], k * 6);
        if (k + 1 < n) { const i0 = k * 2; idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); }
      });
      // winding: make the triangles face +y whichever way the ribbon runs
      for (let t = 0; t < idx.length; t += 3) {
        const A = [pos[idx[t] * 3], pos[idx[t] * 3 + 1], pos[idx[t] * 3 + 2]], B = [pos[idx[t + 1] * 3], pos[idx[t + 1] * 3 + 1], pos[idx[t + 1] * 3 + 2]], C = [pos[idx[t + 2] * 3], pos[idx[t + 2] * 3 + 1], pos[idx[t + 2] * 3 + 2]];
        const ny = (B[2] - A[2]) * (C[0] - A[0]) - (B[0] - A[0]) * (C[2] - A[2]);
        if (ny < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
      }
      out.push({ exit: node.id, edge: edge.id, class: edge.class, width: cls.w, length: L, vertexCount: n * 2, pos, nrm, col, index: Uint32Array.from(idx), samples: P2 });
    }
    return out;
  }

  return { buildFlat, buildCap, buildStubs, vertex, lats, ringLons, inPatch, flatX, flatZ };
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

const TERRAIN = { R, BASE, RING_M, CHUNK_DEG, FLAT_LAT, RING_WINDOW, EXIT_CLASS, builder, sampler, samplerFromChunks };

// ---- scene part (needs THREE); the data builder above never touches it
// THREE.MathUtils.generateUUID draws from Math.random. The rain of scene.js draws from the same stream every frame, so creating terrain
// objects must not consume it (the town stays bit-identical): while terrain objects are made, Math.random is a private seeded stream.
function withPrivateRandom(fn) {
  const saved = Math.random; let s = 0x5eed1234;
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { return fn(); } finally { Math.random = saved; }
}

TERRAIN.withPrivateRandom = withPrivateRandom;

TERRAIN.attach = function (scene, makeMaterial, BEND) {
  const THREE = global.THREE, W = global.WORLD, B = builder(W);
  let material, capMat, restMat, stubMat, root;
  withPrivateRandom(() => {
    material = makeMaterial();
    capMat = material.clone(); capMat.userData = { noBend: true };
    restMat = material.clone();                                    // own material so the land around the town can fade in (W8a) without touching the ring's
    stubMat = material.clone(); stubMat.polygonOffset = true; stubMat.polygonOffsetFactor = -1; stubMat.polygonOffsetUnits = -1;
    root = new THREE.Group(); root.name = 'terrain'; scene.add(root);
  });
  const state = { ring: [], rest: [], caps: [], stubs: [], restBuilt: false, stats: {} };
  const geom = (c, index) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', c.posAttr || (c.posAttr = new THREE.BufferAttribute(c.pos, 3)));
    g.setAttribute('normal', c.nrmAttr || (c.nrmAttr = new THREE.BufferAttribute(c.nrm, 3)));
    g.setAttribute('color', c.colAttr || (c.colAttr = new THREE.BufferAttribute(c.col, 3)));
    g.setIndex(new THREE.BufferAttribute(index, 1)); return g;
  };
  const add = (g, mat, kind, list, extra) => { const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.userData.terrain = { kind, ...extra }; root.add(m); list.push(m); return m; };
  const t0 = performance.now();
  const ringData = B.buildFlat({ ring: true, rest: false, window: RING_WINDOW }), stubData = B.buildStubs();
  withPrivateRandom(() => {
    for (const c of ringData) if (c.ringIndex) add(geom(c, c.ringIndex), material, 'ring', state.ring, { cx: c.cx, cy: c.cy });
    for (const s of stubData) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(s.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(s.nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(s.col, 3)); g.setIndex(new THREE.BufferAttribute(s.index, 1));
      add(g, stubMat, 'stub', state.stubs, { exit: s.exit, edge: s.edge });
    }
  });
  state.stats.ringBuildMs = Math.round(performance.now() - t0);

  function buildRest() {
    if (state.restBuilt) return; state.restBuilt = true;
    const t = performance.now(), restData = B.buildFlat({ ring: false, rest: true }), capData = [true, false].map(north => B.buildCap(north));
    state.restData = restData;
    withPrivateRandom(() => {
      for (const c of restData) if (c.restIndex) { const m = add(geom(c, c.restIndex), restMat, 'rest', state.rest, { cx: c.cx, cy: c.cy }); m.visible = BEND.get() > 0 || state.fade.rest > 0; }
      capData.forEach((c, k) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(c.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(c.nrm, 3)); g.setAttribute('color', new THREE.BufferAttribute(c.col, 3)); g.setIndex(new THREE.BufferAttribute(c.index, 1));
        const m = add(g, capMat, 'cap', state.caps, { north: k === 0 }); m.visible = BEND.get() > 0.98;
      });
      if (BEND.seamSplit) BEND.seamSplit(root);                     // W8e-b: the chunks that cross the seam at -85 deg are cut along it
    });
    state.stats.restBuildMs = Math.round(performance.now() - t);
  }
  // opacity of a material that is opaque at 1 (the opaque pass and its sorting stay exactly as before while the fade is complete)
  const setOpacity = (m, o) => { const t = o < 1; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } m.opacity = o; };
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const exploreListeners = [];
  state.explore = false;
  state.onExplore = fn => exploreListeners.push(fn);
  state.setExplore = on => { if (on === state.explore) return; state.explore = on; for (const fn of exploreListeners) fn(); };
  state.fade = { rest: 0 };                                          // W8a: 0..1 visibility of the land around the town while the town is still flat (uBend = 0)
  function apply() {
    const u = BEND.get(), restOn = u > 0 || state.fade.rest > 0;
    if (restOn) buildRest();
    for (const m of state.rest) m.visible = restOn;
    if (state.restBuilt) setOpacity(restMat, u > 0 ? 1 : state.fade.rest);
    const cf = smooth(0.98, 1, u);
    for (const m of state.caps) m.visible = cf > 0;
    if (state.restBuilt) setOpacity(capMat, cf);
  }
  BEND.onChange(apply);
  state.ringData = ringData;
  // height of the rendered mesh over the whole planet (built on first use, from the chunks of the meshes; W.height inside the town patch)
  state.sampler = () => { if (!state.samplerFn) { buildRest(); state.samplerFn = samplerFromChunks(W, [...ringData, ...state.restData]); } return state.samplerFn; };
  state.setFade = f => { f = Math.max(0, Math.min(1, f)); if (f !== state.fade.rest) { state.fade.rest = f; apply(); } return f; };
  state.apply = apply; state.buildRest = buildRest; state.root = root;
  state.stats.triangles = () => [...state.ring, ...state.rest, ...state.caps, ...state.stubs].reduce((s, m) => s + m.geometry.index.count / 3, 0);
  return state;
};

if (typeof module !== 'undefined' && module.exports) module.exports = TERRAIN;
else global.TERRAIN = TERRAIN;
})(typeof globalThis !== 'undefined' ? globalThis : this);
