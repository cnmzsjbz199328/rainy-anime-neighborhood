// R1 (docs/world/THIRD_PERSON_ROAM_PLAN.md 6.6, 6.13.2): what the ride runs into, built from the one ground sampler (ground.js) and the data of the modules that place
// things on the walkable surfaces. Pure: no THREE, no DOM; attach() after the world is generated (the landmark boxes are recorded by scene.js before baking).
//   I2 boundaries  candidate edges (every walkable line's edges and ends, the paved T junctions' outlines, the town shapes of layout.js, the I9 site outlines) cut into
//                  <= 0.5 m pieces; each piece is sampled on both sides (+-0.03 flat units) with ground.layers(): a side whose surface finds no surface on the other side
//                  within 0.05 m x s in height (0.25 m beside a stair: its riser; 0.16 m at the boardwalk: its planks and its raised ends) gets a one-sided record facing it (a curb, 0.13 m, is
//                  a record on each side). A record: the piece, the unit normal into its free side, the free side's flat height and display scale, its type (rail, rope,
//                  wall, stair, curb, plot, edge). Built per 8 m cell on first use; the town's cells when the ride first starts.
//   I4 obstacles   circles, capsule segments and boxes (flat frame, with a flat height range): layout.js furniture and the legacy fixtures' slots, the road lamp table
//                  (streetlights.js), the instances of the roads, bridges, stairs and boardwalk (radius or box from their flora.js templates), the landmarks' solid meshes.
//   I5 occluders   R2: what the camera may not enter or look through (low-poly boxes, never the rendered meshes): the town's buildings and their attachments (layout.js
//                  parts' measured localBounds placed by their transforms), every landmark solid box at any height; the bridges are kept by the camera's deck limit (the
//                  pylon legs stand outside the deck), the tunnel lining and the terrain are tested analytically by ride.js
// Records and obstacles are kept in the display frame [SEAM, SEAM + PERIOD); a query near the seam also reads the other end, shifted by one turn.
(function (global) {
'use strict';
const CELL = 8, EPS = 0.03, PIECE = 0.5, R = 90, D = Math.PI / 180, BASE = 1.6;
const STEP = 0.05, STEP_STAIR = 0.25, STEP_BOARD = 0.16;
// flora.js templates (true metres, before the instance scale): circle radius or box half extents (local x, local z), height
const TEMPLATE = {
  barrierConcrete: { box: [0.99, 0.17], h: 0.82 }, milestone: { box: [0.115, 0.085], h: 0.65 }, signBus: { r: 0.04, h: 2.5 }, busBench: { box: [0.75, 0.2], h: 0.5 },
  shelterOrange: { box: [1.4, 1.1], h: 2.0 }, pole: { r: 0.14, h: 8.5 }, mirror: { r: 0.04, h: 2.6 }, stonePost: { box: [0.1, 0.1], h: 0.8 }, bollard: { r: 0.12, h: 0.55 },
  snowPole: { r: 0.045, h: 2.0 }, ropePost: { r: 0.035, h: 0.95 }, steelPost: { r: 0.03, h: 0.9 }, lampSmall: { r: 0.05, h: 1.8 }, lifeRing: { box: [0.26, 0.06], y0: 0.52, h: 1.04 },
  lantern: { box: [0.25, 0.25], h: 1.7 }, jizo: { box: [0.25, 0.25], h: 1.0 }, torii: { legs: [-1.0, 1.0], r: 0.17, h: 2.6 },
};
// scene.js street furniture (layout.js kinds; the street lamps are in the road lamp table)
const FURNITURE = { 'alley-lamp': { r: 0.045, h: 3.2 }, pole: { r: 0.1, h: 5.7 }, signal: { r: 0.05, h: 4.5 }, 'stop-sign': { r: 0.035, h: 2.5 } };
const LEGACY = { trafficSignal: { pole: [5.1, -4.75], r: 0.05, h: 4.5 }, utilityPole: { pole: [-4.7, -3.85], r: 0.1, h: 5.7 }, guardRail: { rail: [[-2.1, 3.13], [0.4, 3.13]], r: 0.05, h: 0.95 } };

const flatOf = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) });
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (((p[i][1] > z) !== (p[j][1] > z)) && (x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; return c; };

// ctx = { ground, L: LAYOUT, roads: roads.data(), lamps: streetlights.data().lamps, landmarkBoxes: [{ lm, pts: [[x, z] x 4], y0, y1 }] }
function attach(ctx) {
  const G = ctx.ground, L = ctx.L, RD = ctx.roads, PERIOD = G.PERIOD, SEAM = G.SEAM, show = G.wrap, xMax = SEAM + PERIOD;
  const key = (a, b) => a * 100003 + b, cand = new Map(), built = new Map(), obstacles = new Map(), stats = { candidates: 0, cellsBuilt: 0, records: 0, buildMs: 0, obstacles: 0 };
  const bucket = (map, x, z, item) => { const k = key(Math.floor(x / CELL), Math.floor(z / CELL)); let l = map.get(k); if (!l) map.set(k, l = []); l.push(item); };
  // ---- candidate pieces (display frame by their midpoint)
  const addPiece = (ax, az, bx, bz, src) => { const mx = show((ax + bx) / 2), sh = mx - (ax + bx) / 2; bucket(cand, mx, (az + bz) / 2, { ax: ax + sh, az, bx: bx + sh, bz, src }); stats.candidates++; };
  const addEdge = (ax, az, bx, bz, src) => { const l = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(l / PIECE)); for (let k = 0; k < n; k++) addPiece(ax + (bx - ax) * k / n, az + (bz - az) * k / n, ax + (bx - ax) * (k + 1) / n, az + (bz - az) * (k + 1) / n, src); };
  const addRing = (pts, src) => { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; addEdge(a[0], a[1], b[0], b[1], src); } };
  for (const ln of G.lines) {
    const n = ln.n, edge = (i, side) => { const w = ln.walk[i]; return ln.point(ln.S[i].s, side < 0 ? w[0] : w[1]); };
    for (let i = 0; i + 1 < n; i++) for (const sd of [-1, 1]) { const a = edge(i, sd), b = edge(i + 1, sd); addEdge(a.x, a.z, b.x, b.z, ln.id); }
    for (const i of [0, n - 1]) { const a = edge(i, -1), b = edge(i, 1); addEdge(a.x, a.z, b.x, b.z, ln.id + ':end'); }
  }
  for (const j of RD.junctions || []) { const st = j.strip; if (!st || !st.pos || !st.index) continue; const P = st.pos, I = st.index, cnt = new Map();
    for (let t = 0; t + 2 < I.length; t += 3) for (let e = 0; e < 3; e++) { const a = I[t + e], b = I[t + (e + 1) % 3], k = a < b ? a + ',' + b : b + ',' + a; cnt.set(k, (cnt.get(k) || 0) + 1); }
    for (const [k, c] of cnt) if (c === 1) { const [a, b] = k.split(',').map(Number); addEdge(P[a * 3], P[a * 3 + 2], P[b * 3], P[b * 3 + 2], 'junction ' + j.node); } }
  // the town (scene.js): pavement islands with their curb returns and the notches of the curb cuts, plots, alleys, the walkway, the bus aprons, the cuts, the frame
  const H0 = L.BASE.half, Rc = L.INTERSECTION.curbRadius, rect = (r, src) => addRing([[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]], src);
  for (const is of L.islands) { const [x0, z0, x1, z1] = is.rect, C = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], names = ['NW', 'NE', 'SE', 'SW'], mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, pts = [];
    for (let i = 0; i < 4; i++) { const c = C[i], p = C[(i + 3) % 4], q = C[(i + 1) % 4];
      if (is.round[names[i]]) { const din = [Math.sign(c[0] - p[0]), Math.sign(c[1] - p[1])], dout = [Math.sign(q[0] - c[0]), Math.sign(q[1] - c[1])], o = [c[0] + Math.sign(mx - c[0]) * Rc, c[1] + Math.sign(mz - c[1]) * Rc];
        const A0 = Math.atan2(c[1] - din[1] * Rc - o[1], c[0] - din[0] * Rc - o[0]); let d = Math.atan2(c[1] + dout[1] * Rc - o[1], c[0] + dout[0] * Rc - o[0]) - A0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        for (let k = 0; k <= 12; k++) pts.push([o[0] + Rc * Math.cos(A0 + d * k / 12), o[1] + Rc * Math.sin(A0 + d * k / 12)]); }
      else pts.push(c);
      const ax = c[1] === q[1] ? 'z' : 'x', v = ax === 'z' ? c[1] : c[0], sg = ax === 'z' ? Math.sign(q[0] - c[0]) : Math.sign(q[1] - c[1]), P = (s, o) => (ax === 'z' ? [s, v + o] : [v + o, s]), j = ax === 'z' ? 0 : 1, lo = Math.min(c[j], q[j]), hi = Math.max(c[j], q[j]);
      for (const k of L.curbCuts.filter(k => k.line === ax && k.at === v && k.s0 >= lo && k.s1 <= hi).sort((a, b) => sg * (a.s0 - b.s0))) { const [a, b] = sg > 0 ? [k.s0, k.s1] : [k.s1, k.s0]; pts.push(P(a, 0), P(a, k.dir * k.depth), P(b, k.dir * k.depth), P(b, 0)); } }
    addRing(pts, 'island'); }
  for (const p of L.plots) rect(p.rect, 'plot ' + p.id);
  for (const a of L.alleys) rect(a.rect, 'alley ' + a.id);
  for (const w of L.walkways) addRing(w.poly, 'walkway ' + w.id);
  for (const a of L.aprons) addRing(a.poly, 'apron ' + a.id);
  for (const c of L.curbCuts) rect(c.rect, 'cut ' + c.id);
  rect([-H0, -H0, H0, H0], 'town frame');
  for (const st of G.sites || []) for (const o of st.outlines) addRing(o.pts, 'site ' + st.id + ' ' + o.id);
  const inPlot = (x, z) => Math.abs(x) <= H0 && Math.abs(z) <= H0 && L.plots.some(p => x > p.rect[0] && x < p.rect[2] && z > p.rect[1] && z < p.rect[3]);
  // ---- classify one cell's pieces into records
  const tolOf = (a, b) => (a.kind === 'stairs' || b.kind === 'stairs' ? STEP_STAIR : a.kind === 'boardwalk' || b.kind === 'boardwalk' ? STEP_BOARD : STEP);
  const typeOf = (a, others, px, pz) => (a.kind === 'deck' ? 'rail' : a.kind === 'boardwalk' ? 'rope' : a.layer === 'tunnel' ? 'wall' : a.kind === 'stairs' ? 'stair' : others.length ? 'curb' : inPlot(px, pz) ? 'plot' : 'edge');
  const build = k => {
    const t0 = Date.now(), list = cand.get(k) || [], out = [];
    for (const p of list) {
      const dx = p.bx - p.ax, dz = p.bz - p.az, l = Math.hypot(dx, dz); if (l < 1e-6) continue;
      const nx = -dz / l, nz = dx / l, mx = (p.ax + p.bx) / 2, mz = (p.az + p.bz) / 2;
      const A = G.layers(mx - nx * EPS, mz - nz * EPS), B = G.layers(mx + nx * EPS, mz + nz * EPS);
      for (const [side, own, other, sg] of [['a', A, B, -1], ['b', B, A, 1]]) for (const a of own) {
        if (other.some(b => Math.abs(b.y - a.y) <= tolOf(a, b) * a.s)) continue;
        const px = mx - sg * nx * EPS * 2, pz = mz - sg * nz * EPS * 2;      // a point just beyond the piece on the other side
        out.push({ ax: p.ax, az: p.az, bx: p.bx, bz: p.bz, nx: sg * nx, nz: sg * nz, y: a.y, s: a.s, kind: a.kind, layer: a.layer, type: typeOf(a, other, px, pz), src: p.src });
        void side;
      }
    }
    built.set(k, out); stats.cellsBuilt++; stats.records += out.length; stats.buildMs += Date.now() - t0; return out;
  };
  const cellRecords = k => built.get(k) || build(k);
  // ---- obstacles
  const addObstacle = o => { const xs = o.c ? [o.c[0] - o.r, o.c[0] + o.r] : o.seg ? [Math.min(o.seg[0], o.seg[2]) - o.r, Math.max(o.seg[0], o.seg[2]) + o.r] : [Math.min(...o.pts.map(q => q[0])), Math.max(...o.pts.map(q => q[0]))];
    const zs = o.c ? [o.c[1] - o.r, o.c[1] + o.r] : o.seg ? [Math.min(o.seg[1], o.seg[3]) - o.r, Math.max(o.seg[1], o.seg[3]) + o.r] : [Math.min(...o.pts.map(q => q[1])), Math.max(...o.pts.map(q => q[1]))];
    const mx = show((xs[0] + xs[1]) / 2), sh = mx - (xs[0] + xs[1]) / 2;
    if (sh) { if (o.c) o.c = [o.c[0] + sh, o.c[1]]; if (o.seg) o.seg = [o.seg[0] + sh, o.seg[1], o.seg[2] + sh, o.seg[3]]; if (o.pts) o.pts = o.pts.map(q => [q[0] + sh, q[1]]); }
    if (o.pts) { let a = 0; for (let i = 0, j = o.pts.length - 1; i < o.pts.length; j = i++) a += (o.pts[j][0] - o.pts[i][0]) * (o.pts[j][1] + o.pts[i][1]); if (a < 0) o.pts.reverse(); }     // one winding for the edge normals
    for (let a = Math.floor((xs[0] + sh) / CELL); a <= Math.floor((xs[1] + sh) / CELL); a++) for (let b = Math.floor(zs[0] / CELL); b <= Math.floor(zs[1] / CELL); b++) { const k = key(a, b); let l = obstacles.get(k); if (!l) obstacles.set(k, l = []); l.push(o); }
    stats.obstacles++; };
  const LV = L.LEVELS;
  for (const f of L.furniture) { const t = FURNITURE[f.kind]; if (!t) continue; addObstacle({ c: [f.x, f.z], r: t.r, y0: LV.pavement, y1: LV.pavement + t.h, src: f.id }); }
  for (const f of L.legacyFurniture) { const t = LEGACY[f.group]; if (!t) continue; const { x, z, rotY } = f.slot, c = Math.cos(rotY), n = Math.sin(rotY), [ax, az] = f.anchor;
    const at = ([lx, lz]) => { const u = lx - ax, v = lz - az; return [x + u * c + v * n, z - u * n + v * c]; };
    if (t.pole) addObstacle({ c: at(t.pole), r: t.r, y0: LV.pavement, y1: LV.pavement + t.h, src: 'legacy ' + f.group });
    if (t.rail) { const a = at(t.rail[0]), b = at(t.rail[1]); addObstacle({ seg: [a[0], a[1], b[0], b[1]], r: t.r, y0: LV.pavement, y1: LV.pavement + t.h, src: 'legacy ' + f.group }); } }
  for (const lp of ctx.lamps || []) { const sc = lp.scale || 1, m = { town: 4.4, rural: 4.96, trunk: 6.2, bridge: 5.27 }[lp.model] || 5; addObstacle({ c: [lp.x, lp.z], r: 0.1 * sc, y0: lp.y, y1: lp.y + m * sc, src: lp.id }); }
  const instances = (owner, inst) => { for (const [type, list] of Object.entries(inst || {})) { const t = TEMPLATE[type]; if (!t || (owner === 'bridge' && type === 'barrierConcrete')) continue;
    for (const it of list) { const f = flatOf(it.lon, it.lat), s = it.s || [1, 1, 1], k = f.k, y0 = (it.alt - BASE) * k + (t.y0 || 0) * s[1] * k, y1 = (it.alt - BASE) * k + t.h * s[1] * k, cy = Math.cos(it.yaw || 0), sy = Math.sin(it.yaw || 0);
      const loc = (lx, lz) => [f.x + (lx * cy + lz * sy) * k, f.z + (-lx * sy + lz * cy) * k];
      if (t.r && !t.legs) addObstacle({ c: [f.x, f.z], r: t.r * s[0] * k, y0, y1, src: type });
      else if (t.legs) for (const lx of t.legs) addObstacle({ c: loc(lx * s[0], 0), r: t.r * s[0] * k, y0, y1, src: type });
      else { const [hx, hz] = [t.box[0] * s[0], t.box[1] * s[2]]; addObstacle({ pts: [loc(-hx, -hz), loc(hx, -hz), loc(hx, hz), loc(-hx, hz)], y0, y1, src: type }); } } } };
  for (const rt of RD.routes) instances('route', rt.instances);
  for (const b of RD.bridges) instances('bridge', b.instances);
  for (const st of RD.stairs) instances('stairs', st.instances);
  for (const ex of RD.extras || []) instances('extra', ex.instances);
  for (const bx of ctx.landmarkBoxes || []) addObstacle({ pts: bx.pts.map(q => [q[0], q[1]]), y0: bx.y0, y1: bx.y1, src: bx.lm });
  // ---- I5: the camera's occluders (boxes with a flat height range) in their own grid
  const occl = new Map();
  const addOccluder = o => { const xs = o.pts.map(q => q[0]), zs = o.pts.map(q => q[1]), mx = show((Math.min(...xs) + Math.max(...xs)) / 2), sh = mx - (Math.min(...xs) + Math.max(...xs)) / 2; if (sh) o.pts = o.pts.map(q => [q[0] + sh, q[1]]);
    let a2 = 0; for (let i = 0, j = o.pts.length - 1; i < o.pts.length; j = i++) a2 += (o.pts[j][0] - o.pts[i][0]) * (o.pts[j][1] + o.pts[i][1]); if (a2 < 0) o.pts.reverse();
    o.bb = [Math.min(...o.pts.map(q => q[0])), Math.min(...o.pts.map(q => q[1])), Math.max(...o.pts.map(q => q[0])), Math.max(...o.pts.map(q => q[1]))];
    for (let a = Math.floor(o.bb[0] / CELL); a <= Math.floor(o.bb[2] / CELL); a++) for (let b = Math.floor(o.bb[1] / CELL); b <= Math.floor(o.bb[3] / CELL); b++) { const k = key(a, b); let l = occl.get(k); if (!l) occl.set(k, l = []); l.push(o); }
    stats.occluders = (stats.occluders || 0) + 1; };
  for (const st of L.structures) for (const p of st.parts) { if (p.role !== 'building' && p.role !== 'attachment') continue; const b = p.localBounds, k = st.transform.scale ?? L.SAMPLE_SCALE;
    addOccluder({ pts: [[b.min[0], b.min[2]], [b.max[0], b.min[2]], [b.max[0], b.max[2]], [b.min[0], b.max[2]]].map(([x, z]) => L.toWorld(st, x, z)), y0: b.min[1] * k, y1: b.max[1] * k, src: st.plot + ' ' + p.group }); }
  for (const bx of ctx.landmarkBoxes || []) addOccluder({ pts: bx.pts.map(q => [q[0], q[1]]), y0: bx.y0, y1: bx.y1, src: bx.lm });
  // ---- queries
  // the cells under the box [x - r, x + r] x [z - r, z + r]; near the seam the other end too (its items shifted by one turn): visit(item list, shift, cell key)
  const around = (x, z, r, visit) => {
    const pass = (x0, x1, sh) => { for (let a = Math.floor(x0 / CELL); a <= Math.floor(x1 / CELL); a++) for (let b = Math.floor((z - r) / CELL); b <= Math.floor((z + r) / CELL); b++) visit(key(a, b), sh); };
    pass(x - r, x + r, 0); if (x - r < SEAM) pass(x - r + PERIOD, x + r + PERIOD, -PERIOD); if (x + r > xMax) pass(x - r - PERIOD, x + r - PERIOD, PERIOD);
  };
  const api = {
    stats,
    // the boundary records and obstacles near (x, z) (within r flat units of the point), shifted next to x; the records on the rider's level (|free side - y| <= band)
    near(x, z, y, r, band) {
      const rec = [], obs = [], seen = new Set();
      around(x, z, r, (k, sh) => {
        for (const q of cellRecords(k)) if (Math.abs(q.y - y) <= band) rec.push(sh ? { ...q, ax: q.ax + sh, bx: q.bx + sh } : q);
        for (const o of obstacles.get(k) || []) { if (seen.has(o)) continue; seen.add(o); obs.push(sh ? { ...o, c: o.c && [o.c[0] + sh, o.c[1]], seg: o.seg && [o.seg[0] + sh, o.seg[1], o.seg[2] + sh, o.seg[3]], pts: o.pts && o.pts.map(q => [q[0] + sh, q[1]]) } : o); }
      });
      return { records: rec, obstacles: obs };
    },
    // build the records of the cells within r of (x, z) now; at most `max` cells (the rest on later calls); returns the cells still missing
    prefetch(x, z, r, max = Infinity) { let n = 0, missing = 0; around(x, z, r, k => { if (built.has(k)) return; if (n < max) { build(k); n++; } else missing++; }); return missing; },
    built: k => built.has(k), CELL,
    // I5: the occluder boxes whose footprint meets the box [x0, x1] x [z0, z1] (shifted next to x0 near the seam)
    occluders(x0, z0, x1, z1) { const out = [], seen = new Set(), cx = (x0 + x1) / 2, r = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) / 2 + 0.5;
      around(cx, (z0 + z1) / 2, r, (k, sh) => { for (const o of occl.get(k) || []) { if (seen.has(o)) continue; seen.add(o); out.push(sh ? { ...o, pts: o.pts.map(q => [q[0] + sh, q[1]]), bb: [o.bb[0] + sh, o.bb[1], o.bb[2] + sh, o.bb[3]] } : o); } });
      return out; },
    // the town's cells (the first ride start)
    prepareTown() { const t0 = Date.now(); this.prefetch(0, 0, H0 + 2); return Date.now() - t0; },
  };
  return api;
}

const RIDE_WORLD = { attach, TEMPLATE, FURNITURE, LEGACY };
if (typeof module !== 'undefined' && module.exports) module.exports = RIDE_WORLD;
else global.RIDE_WORLD = RIDE_WORLD;
})(typeof globalThis !== 'undefined' ? globalThis : this);
