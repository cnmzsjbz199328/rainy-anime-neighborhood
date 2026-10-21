// W10f (docs/world/W10_SPEC.md 2.8): the one ground sampler of the world. The camera (its look target and the lift on the sphere) and the walk read the ground only here.
// Two layers of answers from one place:
//   ground  the shown ground under a point: the rendered terrain (the sea at altitude 0; the town's plain is the terrain at 1.6 m): y(x, z), alt(lon, lat)
//   walk    the walkable surfaces of the one road network (W10_SPEC 2.8: the roads, the pavements, the town's public areas), at(x, z, hint) -> one sample:
//           every road's paved width and shoulder (roadkit.js), the paved T junctions, the bridge decks, the stone stairs and the boardwalk, and in the town (layout.js) the carriageways,
//           alleys, pavements and facility bands, the curb ramps and driveways, the walkway W01 and the bus aprons; plots and everything off the network give null.
//           R1 (THIRD_PERSON_ROAM_PLAN 6.13): also the RN12-01 steel stair (two stair lines from bridge.js's access record: gate, gangway, flights, landing, foot plate),
//           a 1 m landing on each stone stair's axis beyond its ends, and the I9 public areas of the landmarks (kind 'site': LM02 east entrance <-> north-east entrance).
// A sample (x, z in the flat display frame, y its flat height): { x, z, y, alt (true metres), s (display scale: flat units per true metre, a function of the place:
// 1 in the town frame, 1 / cos(lat) from 15 m beyond it, a smoothstep between; the same on every road through a point), k (1 / cos(lat)), kind, layer ('ground' | 'deck' | 'tunnel'), line, route, edge, cls,
// station (m along the line), offset (true m, + right of travel), slope (rise per true metre along the line), margin (true m to the walkable edge across it) }.
// The flat display frame runs from the seam (bend.js SEAM) one circumference east; a query anywhere is wrapped into it, a sample's x lies in it.
// Pure: no THREE, no DOM; attach() reads the built roads (roads.data()) and the terrain sampler once, after the world is generated.
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6, PERIOD = 2 * Math.PI * R, HALF = Math.PI * R, CELL = 8, PAD = 14;
const TOWN_BLEND = 15;   // the display scale runs from the town frame's 1 to 1 / cos(lat) over the exits' 15 m width transition (W10_SPEC 2.2)
const STAIR_HALF = 0.8, STAIR_LANDING = 1.0, BOARD_HALF = 1.0, DECK_WALK = 4.6, PLANK_TOP = 0.08, PLANK_HALF = 0.135;   // steps.js STAIR.width / 2; roadkit.js boardwalk DECK.half; the deck's walk (rails beyond); flora.js plank: 0.08 m thick (its foot at the record's altitude), 0.27 m deep
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const flatOf = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) });
const llOf = (x, z) => ({ lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D });
const canonX = x => x - PERIOD * Math.floor((x + HALF) / PERIOD);                 // the data's longitudes: [-pi R, pi R)
const wrapDx = d => d - PERIOD * Math.round(d / PERIOD);
const inRect = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (((p[i][1] > z) !== (p[j][1] > z)) && (x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; return c; };

// ---- a sampled line (route, bridge, stairs, boardwalk): flat samples, stations, tangents, the lateral factor, the walkable half widths, a grid of its segments
function line(kind, id, S, F, T, cf, walk, extra) {
  const n = S.length, cells = new Map(), X = new Float64Array(n), key = (a, b) => a * 1000003 + b;
  for (let i = 0; i < n; i++) X[i] = i ? X[i - 1] + wrapDx(F[i].x - F[i - 1].x) : F[0].x;     // longitudes kept continuous along the line
  for (let i = 0; i + 1 < n; i++) {
    const a0 = Math.floor((Math.min(X[i], X[i + 1]) - PAD) / CELL), a1 = Math.floor((Math.max(X[i], X[i + 1]) + PAD) / CELL), b0 = Math.floor((Math.min(F[i].z, F[i + 1].z) - PAD) / CELL), b1 = Math.floor((Math.max(F[i].z, F[i + 1].z) + PAD) / CELL);
    for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) { const k = key(a, b); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(i); }
  }
  // the nearest point of the line to a canonical flat point within the cells: segment i, fraction t, station s, offset o (true m, + right of travel), true distance d,
  // how far beyond the first or last sample (true m); all = every segment (the spawn search) instead of the cells
  const project = (x, z, all) => {
    let best = null;
    for (const shift of [0, PERIOD, -PERIOD]) {
      const px = x + shift, l = all ? null : cells.get(key(Math.floor(px / CELL), Math.floor(z / CELL))); if (!all && !l) continue;
      const m = all ? n - 1 : l.length;
      for (let q = 0; q < m; q++) {
        const i = all ? q : l[q], ax = X[i], az = F[i].z, dx = X[i + 1] - ax, dz = F[i + 1].z - az, l2 = dx * dx + dz * dz || 1e-12, raw = ((px - ax) * dx + (z - az) * dz) / l2, t = clamp01(raw);
        const qx = ax + dx * t, qz = az + dz * t, d2 = (px - qx) ** 2 + (z - qz) ** 2;
        if (best && d2 >= best.d2) continue;
        const k = F[i].k + (F[i + 1].k - F[i].k) * t, c = cf[i] + (cf[i + 1] - cf[i]) * t, Tx = T[i][0] + (T[i + 1][0] - T[i][0]) * t, Tz = T[i][1] + (T[i + 1][1] - T[i][1]) * t;
        const side = (px - qx) * -Tz + (z - qz) * Tx >= 0 ? 1 : -1, d = Math.sqrt(d2) / k;
        const over = (i === 0 && raw < 0 ? -raw : i === n - 2 && raw > 1 ? raw - 1 : 0) * Math.sqrt(l2) / k;
        best = { d2, i, t, s: S[i].s + (S[i + 1].s - S[i].s) * t, o: side * d / c, d, over, k, c, T: [Tx, Tz], px: qx, pz: qz };
      }
    }
    return best;
  };
  // the flat point at station s, offset o (true m)
  const point = (s, o) => {
    let i = 0; while (i + 2 < n && S[i + 1].s < s) i++;
    const t = clamp01((s - S[i].s) / Math.max(1e-9, S[i + 1].s - S[i].s)), x = X[i] + (X[i + 1] - X[i]) * t, z = F[i].z + (F[i + 1].z - F[i].z) * t, k = F[i].k + (F[i + 1].k - F[i].k) * t, c = cf[i] + (cf[i + 1] - cf[i]) * t;
    const Tx = T[i][0] + (T[i + 1][0] - T[i][0]) * t, Tz = T[i][1] + (T[i + 1][1] - T[i][1]) * t, tl = Math.hypot(Tx, Tz) || 1;
    return { x: x - Tz / tl * o * c * k, z: z + Tx / tl * o * c * k, T: [Tx / tl, Tz / tl], i, t };
  };
  return { kind, id, S, F, T, cf, walk, n, project, point, length: S[n - 1].s, ...extra };
}
const pathOf = pts => {
  const S = pts.map((p, i) => ({ ...p, s: p.s ?? i * 0.5 })), F = S.map(p => flatOf(p.lon, p.lat)), n = S.length;
  const T = F.map((f, i) => { const a = F[Math.max(0, i - 1)], b = F[Math.min(n - 1, i + 1)], dx = wrapDx(b.x - a.x), dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; });
  return { S, F, T };
};
const lerpAt = (arr, q) => { const a = arr[q.i], b = arr[Math.min(arr.length - 1, q.i + 1)]; return Array.isArray(a) ? a.map((v, j) => v + (b[j] - v) * q.t) : a + (b - a) * q.t; };

// ---- the town frame (layout.js): which surface a point lies on, and its flat height (the shapes scene.js and the road strips build)
function townWalk(L) {
  const LV = L.LEVELS, H0 = L.BASE.half, Rc = L.INTERSECTION.curbRadius;
  const islands = L.islands.map(is => {
    const [x0, z0, x1, z1] = is.rect, C = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], names = ['NW', 'NE', 'SE', 'SW'], mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, pts = [];
    for (let i = 0; i < 4; i++) {
      const c = C[i], p = C[(i + 3) % 4], q = C[(i + 1) % 4];
      if (!is.round[names[i]]) { pts.push(c); continue; }
      const din = [Math.sign(c[0] - p[0]), Math.sign(c[1] - p[1])], dout = [Math.sign(q[0] - c[0]), Math.sign(q[1] - c[1])], o = [c[0] + Math.sign(mx - c[0]) * Rc, c[1] + Math.sign(mz - c[1]) * Rc];
      const A0 = Math.atan2(c[1] - din[1] * Rc - o[1], c[0] - din[0] * Rc - o[0]); let d = Math.atan2(c[1] + dout[1] * Rc - o[1], c[0] + dout[0] * Rc - o[0]) - A0;
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      for (let k = 0; k <= 12; k++) pts.push([o[0] + Rc * Math.cos(A0 + d * k / 12), o[1] + Rc * Math.sin(A0 + d * k / 12)]);
    }
    return pts;
  });
  const box = p => { const xs = p.map(v => v[0]), zs = p.map(v => v[1]); return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]; };
  const cuts = L.curbCuts.map(k => ({ k, rect: k.rect }));
  const ways = L.walkways.map(w => ({ id: w.id, rect: box(w.poly) })), aprons = L.aprons.map(a => ({ id: a.id, rect: box(a.poly) }));
  const bands = L.surfaces.filter(s => s.kind === 'band' || s.kind === 'sidewalk');
  // { kind, y, id } or null (a plot); y is null where the road strip gives the height (carriageways and alleys)
  return (x, z) => {
    if (Math.abs(x) > H0 || Math.abs(z) > H0) return undefined;
    const lift = Math.cosh(z / R);
    for (const p of L.plots) if (x > p.rect[0] && x < p.rect[2] && z > p.rect[1] && z < p.rect[3]) return null;
    for (const c of cuts) if (inRect(c.rect, x, z)) {
      const k = c.k, v = k.line === 'x' ? x : z, t = clamp01((v - k.at) / (k.dir * k.depth)), y = LV.carriageway * lift + (LV.pavement - LV.carriageway * lift) * t;
      // the alleys' mouths are part of their road strips (scene.js draws no ramp there): the strip gives the height
      return k.kind === 'driveway' && /^A0/.test(k.id) ? { kind: 'driveway', id: k.id, y: null, fallback: y } : { kind: k.kind === 'ramp' ? 'ramp' : 'driveway', id: k.id, y };
    }
    for (const w of ways) if (inRect(w.rect, x, z)) return { kind: 'walkway', id: w.id, y: LV.pavement };
    for (const a of aprons) if (inRect(a.rect, x, z)) return { kind: 'apron', id: a.id, y: LV.pavement };
    for (const a of L.alleys) if (inRect(a.rect, x, z)) return { kind: 'alley', id: a.id, y: null, fallback: LV.pavement * lift };
    for (const p of islands) if (inPoly(p, x, z)) { const b = bands.find(s => inRect(s.rect, x, z)); return { kind: b ? b.kind : 'sidewalk', id: b ? b.id : null, y: LV.pavement }; }
    return { kind: 'carriageway', id: null, y: null, fallback: LV.carriageway * lift };
  };
}

// ctx = { W: WORLD, L: LAYOUT, terrain: (lon, lat) -> rendered terrain altitude, roads: roads.data(), ROADS: global.ROADS, BRIDGE: global.BRIDGE, SEAM }
function attach(ctx) {
  const W = ctx.W, L = ctx.L, H = ctx.terrain, RD = ctx.roads, RK = ctx.ROADS, BR = ctx.BRIDGE, SEAM = ctx.SEAM, NET = W.roadNetwork, edgeOf = Object.fromEntries(NET.edges.map(e => [e.id, e]));
  const show = x => SEAM + ((x - SEAM) % PERIOD + PERIOD) % PERIOD;           // into the flat display frame [SEAM, SEAM + PERIOD)
  const lines = [];
  for (const rt of RD.routes) lines.push(line('route', rt.def.id, rt.samples, rt.flatOf, rt.tangent, rt.cf, rt.footprint.map(f => [f[0], f[1]]), { rt, tunnel: rt.tunnel ? [rt.tunnel.s0, rt.tunnel.s1] : null }));
  for (const b of RD.bridges) {
    const F = b.samples.map(p => flatOf(p.lon, p.lat)), cf = b.samples.map((p, i) => { const [lo, la] = b.lateral(i, 1), f = flatOf(lo, la); return Math.hypot(wrapDx(f.x - F[i].x), f.z - F[i].z) / F[i].k; });
    lines.push(line('bridge', b.def.id, b.samples, F, b.tangent, cf, b.samples.map(() => [-DECK_WALK, DECK_WALK]), { b }));
  }
  // R1: a stone stair (RD06) has a 1 m landing on its axis before its first tread and beyond its last, at its foot's and its top's height (the steps are pinned to the
  // ground there): a stair that leaves a road at an angle is entered from its axis, between the legs of its torii
  for (const st of RD.stairs) { const P = pathOf(st.samples); lines.push(line('stairs', st.id, P.S, P.F, P.T, P.S.map(() => 1), P.S.map(() => [-STAIR_HALF, STAIR_HALF]), { st, landing: STAIR_LANDING })); }
  // R1 (THIRD_PERSON_ROAM_PLAN 6.13): RN12-01, the steel maintenance stair of the bridge to LM08-south (bridge.js access), is a stair line too: from the deck through the gate in
  // the north parapet, the gangway, flight A, the landing, flight B, to the foot plate at the node (the plate is the line's last, level part). Its treads are bridge.js's
  // (riser 0.2 m, tread 0.26 m, the step box 0.05 m thick about its altitude); the lowest steps of flight B lie under the foot plate and the beach, so the plate's top is their floor.
  for (const b of RD.bridges) { if (!b.access) continue;
    const bl = lines.find(l => l.kind === 'bridge' && l.b === b), acc = b.access, s0 = acc.s, A = acc.steps.filter(q => q.z > 1), B = acc.steps.filter(q => q.z <= 1), STEP_TOP = 0.025, PLATE_TOP = 0.03;
    const foot = acc.landing.alt + PLATE_TOP, ff = flatOf(acc.landing.lon, acc.landing.lat), fq = bl.project(ff.x, ff.z, true), fx = fq.s - s0, fo = fq.o, xL = Math.max(...A.map(q => q.x)) + 0.13, aL = Math.min(...A.map(q => q.alt)) - 0.2 + PLATE_TOP;
    // the path in the bridge's (station - s0, lateral true m) frame with its floor: steps carry their own tops
    const P = [[0.9, -4.3, acc.top], [0.9, -5.9, acc.top], [1.45, -6.45, acc.top], [xL, -6.45, null], [xL + 0.35, -6.4, aL], [xL + 0.35, -5.5, aL], [xL - 0.05, -5.45, null], [B[B.length - 1].x - 0.13, -5.45, null], [fx, fo, foot]];
    const pts = []; for (let i = 0; i + 1 < P.length; i++) { const [x0, o0] = P[i], [x1, o1] = P[i + 1], l = Math.hypot(x1 - x0, o1 - o0), n = Math.max(1, Math.ceil(l / 0.25)); for (let k = i ? 1 : 0; k <= n; k++) pts.push([x0 + (x1 - x0) * k / n, o0 + (o1 - o0) * k / n]); }
    let acc_s = 0; const S = pts.map((p, i) => { if (i) acc_s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); return { s: acc_s }; });
    const F = pts.map(([x, o]) => { const q = bl.point(s0 + x, o); return { x: q.x, z: q.z, k: Math.cosh(q.z / R) }; }), n = F.length;
    const T = F.map((f, i) => { const a = F[Math.max(0, i - 1)], c = F[Math.min(n - 1, i + 1)], dx = c.x - a.x, dz = c.z - a.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; });
    const along = (x, o) => { let best = 0, bd = Infinity; pts.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - o); if (d < bd) { bd = d; best = S[i].s; } }); return best; };
    const steps = [...A, ...B].map(q => ({ s: along(q.x, q.z > 1 ? -6.45 : -5.45), tread: 0.26, top: Math.max(foot, q.alt + STEP_TOP) }));
    const floor = S.map(p => { const st = steps.find(q => Math.abs(q.s - p.s) <= 0.13 + 1e-6); return st ? st.top : null; });
    for (let i = 0; i < n; i++) if (floor[i] === null) { const ip = P.findIndex(q => Math.abs(along(q[0], q[1]) - S[i].s) < 0.13 && q[2] !== null); floor[i] = ip >= 0 ? P[ip][2] : null; }
    for (let i = 0; i < n; i++) if (floor[i] === null) { let a = i, c = i; while (a > 0 && floor[a] === null) a--; while (c < n - 1 && floor[c] === null) c++; floor[i] = floor[a] ?? floor[c] ?? acc.top; }
    // the walk: the treads' width (0.8 m); the landing plate (1.0 x 2.2 m) and the foot plate (1.6 m) wider. Flight B and the foot plate run back under the gangway, so the stair
    // is two lines (one height per line and point): the upper part to the landing's middle, the lower part from there (stations go on from the upper part's end)
    const top = pts.findIndex(([x, o]) => x >= 1.45 - 1e-9 && o <= -6.45 + 1e-9);      // the gangway plate (1.8 x 1.8 m) ends where flight A starts
    const walk = pts.map(([x, o], i) => (i <= top ? [-0.8, 0.8] : (x > xL - 0.1 && o < -5.3 && o > -6.6) || Math.hypot(x - fx, o - fo) < 0.8 ? [-0.6, 0.6] : [-0.42, 0.42]));
    const cut = pts.findIndex(([x, o]) => x >= xL + 0.3 && o > -5.96), part = (i0, i1, id, extra) => { const sl = a => a.slice(i0, i1 + 1), SS = sl(S), base = SS[0].s;
      return line('stairs', id, SS.map(q => ({ s: q.s - base })), sl(F), sl(T), SS.map(() => 1), sl(walk), { st: { id, steps: steps.filter(q => q.s >= base - 0.13 && q.s <= SS[SS.length - 1].s + 0.13).map(q => ({ ...q, s: q.s - base })), profile: sl(floor) }, edgeId: 'RN12-01', ...extra }); };
    lines.push(part(0, cut, 'RN12-01', { gate: { line: bl.id, station: s0 + 0.9 } }), part(cut, n - 1, 'RN12-01:lower', {}));
  }
  // the boardwalk: its planks are the surface (each at its own altitude; roadkit.js lays them every 0.32 m), so the walk stands on the top of the plank nearest along it
  for (const ex of RD.extras || []) { const P = pathOf(ex.centre), ln = line('boardwalk', ex.id, P.S, P.F, P.T, P.S.map(() => 1), P.S.map(() => [-BOARD_HALF, BOARD_HALF]), { ex });
    ln.planks = (ex.instances.plank || []).map(r => { const f = flatOf(r.lon, r.lat), q = ln.project(f.x, f.z, true); return [q.s, r.alt + PLANK_TOP]; }).sort((a, b) => a[0] - b[0]); lines.push(ln); }
  const town = townWalk(L);
  // R1 (I9, THIRD_PERSON_ROAM_PLAN 6.13): the public areas of the landmarks, in each landmark's local frame (landmarks/<id>.js: origin the anchor, +Z towards the first
  // entrance, +X to its left, true metres), mapped like the landmark's own vertices (scene.js: the distance shortened by R / (R + altitude), the height h + y). A polygon's
  // floor is its local height; outside it the floor runs on down at 10 % (`fall`), so neighbouring polygons meet without a step; `ramp` [z0, z1] runs the floor from the
  // polygon's height at z0 to the height of the road end it meets at z1.
  const SITES = [
    // LM02: the stone street from the east entrance (RN05-01's end, 0.25 m lower than the slabs: a 2.8 m ramp) to the plaza's north edge, then north of house 3
    // (the slab path from the north-east entrance runs through it) on the grass to a pad just short of the north-east entrance, where RN05-02's stairs start (at local
    // (14.63, 8.79), running to +z, a small torii over the first tread): the pad stops at the stairs' first edge, so the stairs are entered from their foot only
    // (LM02.js: slab tops 0.11 m, grass 0.02 m)
    { lm: 'LM02', road: 'RN05-01', polys: [
      { id: 'street', pts: [[-1.3, 8.6], [1.3, 8.6], [1.3, 17.4], [-1.3, 17.4]], y: 0.11, fall: 0.1, ramp: [14.6, 17.08] },
      { id: 'north-of-house-3', pts: [[0.6, 9.15], [11.3, 9.15], [12.1, 6.6], [16.0, 6.6], [16.0, 8.79], [13.4, 8.79], [12.6, 10.85], [0.6, 10.85]], y: 0.02 } ] },
  ].map(sd => {
    const lm = W.landmarks.find(q => q.id === sd.lm), h = H(lm.lon, lm.lat), head = lm.entrances[0].heading, kkOf = y => R / (R + Math.max(-1.6, h + y - 1.6));
    const toFlat = (x, z, y) => { const d0 = Math.hypot(x, z); if (d0 < 1e-9) return flatOf(lm.lon, lm.lat); const q = W.destination({ lon: lm.lon, lat: lm.lat }, head + Math.atan2(-x, z) / D, d0 * kkOf(y)); return flatOf(lm.lon + (((q.lon - lm.lon + 540) % 360) - 180), q.lat); };
    const road = lines.find(l => l.kind === 'route' && l.rt.def.segs.some(sg => sg.id === sd.road)), yEnd = road ? RK.surfS(road.rt, road.length, 0) - h : 0;
    const a = toFlat(0, 0, 0), reach = Math.max(...sd.polys.flatMap(p => p.pts.map(q => Math.hypot(q[0], q[1])))) + 2;
    const distOut = (p, x, z) => { if (inPoly(p.pts, x, z)) return 0; let d = Infinity; for (let i = 0, j = p.pts.length - 1; i < p.pts.length; j = i++) { const [ax, az] = p.pts[j], [bx, bz] = p.pts[i], dx = bx - ax, dz = bz - az, t = clamp01(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)); d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return d; };
    const yOf = (p, z) => p.ramp ? p.y + (yEnd - p.y) * clamp01((z - p.ramp[0]) / (p.ramp[1] - p.ramp[0])) : p.y;
    // flat (canonical) -> local; null beyond the site
    const local = (cx, z) => { if (Math.abs(wrapDx(cx - a.x)) > reach * a.k * 1.3 || Math.abs(z - a.z) > reach * a.k * 1.3) return null; const ll = llOf(cx, z), p = { lon: ll.lon, lat: ll.lat }, d = W.arcDistance(lm, p);
      if (d > reach) return null; const th = (W.bearing(lm, p) - head) * D, d0 = d / kkOf(0.06); return [-d0 * Math.sin(th), d0 * Math.cos(th)]; };
    const floor = (x, z) => { let y = null; for (const p of sd.polys) { const d = distOut(p, x, z); if (d > 0 && !p.fall) continue; const v = yOf(p, z) - (p.fall || 0) * d; if (y === null || v > y) y = v; } return y; };
    const inside = (x, z) => sd.polys.some(p => inPoly(p.pts, x, z));
    // outlines for the boundary pieces (ride_world.js): each polygon edge cut to <= 0.5 m, flat points
    const outlines = sd.polys.map(p => { const out = []; for (let i = 0; i < p.pts.length; i++) { const [ax, az] = p.pts[i], [bx, bz] = p.pts[(i + 1) % p.pts.length], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5)); for (let k = 0; k < m; k++) { const x = ax + (bx - ax) * k / m, z = az + (bz - az) * k / m, f = toFlat(x, z, p.y); out.push([f.x, f.z]); } } return { id: p.id, pts: out }; });
    return { id: sd.lm, lm, h, head, toFlat, local, floor, inside, outlines };
  });
  const siteAt = (cx, z) => { for (const st of SITES) { const q = st.local(cx, z); if (!q || !st.inside(q[0], q[1])) continue; const y = st.floor(q[0], q[1]); if (y === null) continue; return { st, alt: st.h + y }; } return null; };
  // I6: the display scale at a canonical flat point (continuous: no step at the town edge or where two roads meet)
  const scaleAt = (cx, z) => { const H0 = L.BASE.half, d = Math.hypot(Math.max(0, Math.abs(cx) - H0), Math.max(0, Math.abs(z) - H0)); if (d <= 0) return 1;
    const t = clamp01(d / TOWN_BLEND), w = t * t * (3 - 2 * t), k = 1 / Math.cos(llOf(cx, z).lat * D); return 1 + (k - 1) * w; };
  // the paved T junctions of the trunk (roads.js junction strips: their own triangles, flat frame) are walkable; the ring's junctions are its own continuous paving
  const junctions = (RD.junctions || []).filter(j => j.strip && j.strip.pos && j.strip.index && j.strip.index.length).map(j => {
    const P = j.strip.pos, I = j.strip.index, tris = [];
    for (let t = 0; t + 2 < I.length; t += 3) { const v = [I[t], I[t + 1], I[t + 2]].map(i => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); tris.push({ v, b: [Math.min(v[0][0], v[1][0], v[2][0]), Math.min(v[0][2], v[1][2], v[2][2]), Math.max(v[0][0], v[1][0], v[2][0]), Math.max(v[0][2], v[1][2], v[2][2])] }); }
    return { node: j.node, tris, b: [Math.min(...tris.map(q => q.b[0])), Math.min(...tris.map(q => q.b[1])), Math.max(...tris.map(q => q.b[2])), Math.max(...tris.map(q => q.b[3]))] };
  });
  const junctionY = (x, z) => {
    let y = null, node = null;
    for (const j of junctions) for (const sh of [0, PERIOD, -PERIOD]) { const px = x + sh; if (!inRect(j.b, px, z)) continue;
      for (const q of j.tris) { if (!inRect(q.b, px, z)) continue; const [a, b, c] = q.v, d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-12) continue;
        const u = ((b[2] - c[2]) * (px - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, v = ((c[2] - a[2]) * (px - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, w = 1 - u - v;
        if (u >= -1e-9 && v >= -1e-9 && w >= -1e-9) { const h = u * a[1] + v * b[1] + w * c[1]; if (y === null || h > y) { y = h; node = j.node; } } } }
    return y === null ? null : { y, node };
  };
  const atS = (ln, s) => { const S = ln.S, n = S.length; let i = 0; while (i + 2 < n && S[i + 1].s < s) i++; return { i, t: clamp01((s - S[i].s) / Math.max(1e-9, S[i + 1].s - S[i].s)) }; };
  // true altitude of a line's walking surface at station s, offset o
  const altOf = (ln, s, o) => {
    if (ln.kind === 'route') return RK.surfS(ln.rt, s, o);
    if (ln.kind === 'bridge') { const q = atS(ln, s), A = ln.b.alt; return A[q.i] + (A[Math.min(A.length - 1, q.i + 1)] - A[q.i]) * q.t + BR.topLift(o); }
    if (ln.kind === 'stairs') { const st = ln.st; for (const p of st.steps) if (Math.abs(s - p.s) <= p.tread / 2 + 1e-6) return p.top; const q = atS(ln, s); return st.profile[q.i] + (st.profile[Math.min(st.profile.length - 1, q.i + 1)] - st.profile[q.i]) * q.t; }
    // the plank under the point (0.27 m deep along the walk), else in a gap the higher of the two planks either side
    let under = null, before = null, after = null; for (const pk of ln.planks) { if (Math.abs(pk[0] - s) <= PLANK_HALF && (!under || pk[1] > under[1])) under = pk; if (pk[0] <= s && (!before || pk[0] >= before[0])) before = pk; if (pk[0] >= s && (!after || pk[0] < after[0])) after = pk; }
    return under ? under[1] : Math.max(before ? before[1] : -Infinity, after ? after[1] : -Infinity);
  };
  const edgeAt = (ln, q) => {
    if (ln.kind === 'route') return ln.rt.def.segs[ln.rt.edgeOf[q.i]].id;
    if (ln.kind === 'bridge') { const b = ln.b, j = b.joints ? b.joints.filter(v => v <= q.s).length : 0; return b.ids[Math.min(b.ids.length - 1, j)]; }
    return ln.edgeId || ln.id;
  };
  const candidates = (x, z) => {
    const cx = canonX(x), ll = llOf(cx, z), k = 1 / Math.cos(ll.lat * D), sc = scaleAt(cx, z), out = [];
    for (const ln of lines) {
      const q = ln.project(cx, z); if (!q || q.over > (ln.kind === 'boardwalk' ? PLANK_HALF : ln.landing || 0)) continue;     // the end planks overhang the boardwalk's line by half a plank; a stone stair's landings
      const w = lerpAt(ln.walk, q); if (q.o < w[0] - 1e-9 || q.o > w[1] + 1e-9) continue;
      const tun = ln.tunnel && q.s > ln.tunnel[0] && q.s < ln.tunnel[1], alt = altOf(ln, q.s, q.o), edge = edgeAt(ln, q), e = edgeOf[edge];
      let kind = ln.kind === 'bridge' ? 'deck' : ln.kind;
      if (ln.kind === 'route') { const p = lerpAt(ln.rt.paved, q); kind = q.o >= p[0] - 1e-9 && q.o <= p[1] + 1e-9 ? (e && e.class === 'RD08' ? 'snow' : e && e.class === 'TOWN_ALLEY' ? 'alley' : 'carriageway') : 'shoulder'; }
      const a0 = altOf(ln, Math.max(0, q.s - 0.25), q.o), a1 = altOf(ln, Math.min(ln.length, q.s + 0.25), q.o), span = Math.min(ln.length, q.s + 0.25) - Math.max(0, q.s - 0.25);
      out.push({ alt, y: (alt - BASE) * k, s: sc, k, kind, layer: ln.kind === 'bridge' ? 'deck' : tun ? 'tunnel' : 'ground', line: ln.id, route: e ? e.route : null, edge, cls: e ? e.class : null,
        station: q.s, offset: q.o, slope: span > 0 ? (a1 - a0) / span : 0, margin: Math.min(q.o - w[0], w[1] - q.o), heading: Math.atan2(q.T[0], q.T[1]) });
    }
    // CR01 (W10c): the ring's swept asphalt runs on through its ten junctions and the branches are cut at its paving, so on the ring's paving and its inner shoulder the
    // ring is the surface; its outer shoulder and ditch make way at a branch mouth, so there a branch is
    const ring = out.find(c => c.line === 'CR01'), ringLine = ring && lines.find(l => l.id === 'CR01');
    if (ring) { const q = ringLine.project(cx, z), p = lerpAt(ringLine.rt.paved, q); if (ring.offset >= p[0] - 1e-9) { for (let i = out.length - 1; i >= 0; i--) if (out[i] !== ring && out[i].layer === 'ground') out.splice(i, 1); }
      else if (out.some(c => c !== ring && c.layer === 'ground')) out.splice(out.indexOf(ring), 1); }
    const jn = junctionY(cx, z);
    if (jn) { const near = out.filter(c => c.layer === 'ground').sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset))[0];
      out.push({ alt: BASE + jn.y / k, y: jn.y, s: sc, k, kind: 'junction', layer: 'ground', line: near ? near.line : null, route: near ? near.route : null, edge: near ? near.edge : null, cls: near ? near.cls : null,
        station: near ? near.station : null, offset: near ? near.offset : null, slope: 0, margin: null, heading: near ? near.heading : null, junction: jn.node }); }
    const sa = siteAt(cx, z);
    if (sa) out.push({ alt: sa.alt, y: (sa.alt - BASE) * k, s: sc, k, kind: 'site', layer: 'ground', line: sa.st.id, route: null, edge: null, cls: 'site', station: null, offset: null, slope: 0, margin: null, heading: null, site: sa.st.id });
    const t = town(cx, z);
    if (t === null) return [];                                                // a plot: nothing on the network stands there
    if (t !== undefined) {
      // the town frame: layout.js decides the surface; a carriageway or an alley takes its height (and its road) from the road strip under it
      const road = out.filter(c => c.layer === 'ground' && c.kind !== 'shoulder').sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset))[0] || out.find(c => c.layer === 'ground') || null;
      // where an alley's strip runs over the pavement (its mouth), the strip is the top surface
      const alley = out.filter(c => c.cls === 'TOWN_ALLEY' && c.kind === 'alley').reduce((a, c) => (a && a.y >= c.y ? a : c), null);
      const y = Math.max(t.y !== null ? t.y : road ? road.y : t.fallback, alley ? alley.y : -Infinity);
      return [{ alt: BASE + y / k, y, s: sc, k, kind: t.kind, layer: 'ground', line: road ? road.line : null, route: road ? road.route : null, edge: road ? road.edge : null, cls: road ? road.cls : null,
        station: road ? road.station : null, offset: road ? road.offset : null, slope: 0, margin: null, heading: road ? road.heading : null, town: t.id }];
    }
    return out;
  };
  // with a height hint: the top surface within the hint's band (0.3 true m; two surfaces on one level: the one that shows), else the nearest in height
  const pick = (list, hint) => {
    if (!list.length) return null;
    if (hint && hint.y != null) { const band = (hint.band ?? 0.3) * list[0].s, near = list.filter(c => Math.abs(c.y - hint.y) <= band); if (near.length) return near.reduce((a, b) => (b.y > a.y ? b : a)); return list.reduce((a, b) => (Math.abs(b.y - hint.y) < Math.abs(a.y - hint.y) ? b : a)); }
    if (hint && hint.layer) { const l = list.filter(c => c.layer === hint.layer); if (l.length) return l[0]; }
    const order = { ground: 0, deck: 1, tunnel: 2 };
    return list.slice().sort((a, b) => order[a.layer] - order[b.layer] || b.y - a.y)[0];
  };
  const api = {
    lines,
    // I9: the public areas of the landmarks (outlines for ride_world.js)
    sites: SITES,
    // I1: the walkable surface under (x, z) on the layer nearest the hint ({ y } of the walker, or { layer }); null off the walkable surfaces
    at(x, z, hint) { const c = pick(candidates(x, z), hint); return c ? { x: show(x), z, ...c } : null; },
    // I3: every walkable layer at (x, z)
    layers(x, z) { return candidates(x, z).map(c => ({ x: show(x), z, ...c })); },
    // the shown ground under (x, z): the rendered terrain, never below the sea (flat y); alt(lon, lat) its true altitude
    alt(lon, lat) { const h = H(lon, lat); return Math.max(0, h == null ? W.height(lon, lat) : h); },
    y(x, z) { const ll = llOf(canonX(x), z); return (api.alt(ll.lon, ll.lat) - BASE) / Math.cos(ll.lat * D); },
    // I6: the display scale s(x, z) (on and off the walkable surfaces)
    scale(x, z) { return scaleAt(canonX(x), z); },
    // I7: the display frame of the flat map
    wrap: show, SEAM, PERIOD,
    // I8: where a walk starts for a view target: the nearest point of a carriageway (roads, decks, the boardwalk, the snow road; not the stairs, not inside a tunnel:
    // there the nearer portal + 5 m), facing along the road the way the view looks (dir = [dx, dz]; across the road: the line's own direction), in the left lane of a
    // carriageway 4.5 m wide or more (a quarter of its width), else on the paved centre
    spawn(x, z, dir) {
      const cx = canonX(x); let best = null;
      for (const ln of lines) { if (ln.kind === 'stairs') continue; const q = ln.project(cx, z, true); if (q && (!best || q.d2 < best.q.d2)) best = { ln, q }; }
      if (!best) return null;
      const { ln } = best; let s = best.q.s;
      if (ln.tunnel && s > ln.tunnel[0] && s < ln.tunnel[1]) s = s - ln.tunnel[0] < ln.tunnel[1] - s ? Math.max(0, ln.tunnel[0] - 5) : Math.min(ln.length, ln.tunnel[1] + 5);
      const c = ln.point(s, 0), dl = Math.hypot(dir[0], dir[1]) || 1, dot = (c.T[0] * dir[0] + c.T[1] * dir[1]) / dl, sign = Math.abs(dot) < 0.2 ? 1 : Math.sign(dot);
      let p = [0, 0];
      if (ln.kind === 'route') p = lerpAt(ln.rt.paved, c); else if (ln.kind === 'bridge') p = [-3.5, 3.5]; else p = lerpAt(ln.walk, c);
      const w = p[1] - p[0], o = w >= 4.5 ? (p[0] + p[1]) / 2 - sign * w / 4 : (p[0] + p[1]) / 2;
      // the line's own surface there (an I9 site may overlap a road's end), as a fresh query finds it at the point handed out (ride.place asks G.layers there).
      // RI-01 (docs/world/RIDE_INTERACTION_FIX_PLAN.md): point(s, o) offsets along the tangent interpolated at s while the sampler bounds a line by its first and last
      // chord, so at a curved end the lane's point can lie mm past that bound; at an end station the point sits on the bound itself and the display wrap's rounding
      // (show) tips it either way. Where the line's own surface is missing for that reason, the station is taken back by the overshoot the line reports at the shown
      // point (+1 nm against rounding; a line's stations run from S[0].s, not always 0): the same road, lane and level, at most a few mm in
      let at = ln.point(s, o), xs = show(at.x), own = null;
      for (let k = 0; k < 6; k++) {
        own = candidates(xs, at.z).find(c => c.line === ln.id); if (own) break;
        const q = ln.project(canonX(xs), at.z, true); if (!q || !(q.over > 0)) break;
        const s0 = ln.S[0].s; s = Math.min(ln.length, Math.max(s0, s + (q.s - s0 < ln.length - q.s ? 1 : -1) * (q.over + 1e-9))); at = ln.point(s, o); xs = show(at.x);
      }
      const sample = own ? { x: xs, z: at.z, ...own } : api.at(xs, at.z, { layer: ln.kind === 'bridge' ? 'deck' : 'ground' });
      return sample ? { ...sample, heading: Math.atan2(sign * c.T[0], sign * c.T[1]), from: [show(x), z], distance: Math.hypot(wrapDx(show(x) - sample.x), z - sample.z) } : null;
    },
    // I3: the places where the layers meet: the bridges' ends (deck <-> ground), the tunnels' portals (ground <-> tunnel), the stairs' ends
    links() {
      const out = [];
      for (const ln of lines) {
        const end = (s, kind) => { const p = ln.point(s, 0); out.push({ kind, line: ln.id, station: s, x: show(p.x), z: p.z }); };
        if (ln.kind === 'bridge') { end(0, 'abutment'); end(ln.length, 'abutment'); }
        if (ln.kind === 'stairs') { end(0, ln.gate ? 'gate' : 'stair-end'); end(ln.length, 'stair-end'); }
        if (ln.tunnel) { end(ln.tunnel[0], 'portal'); end(ln.tunnel[1], 'portal'); }
      }
      return out;
    },
  };
  return api;
}

const GROUND = { attach, townWalk, flatOf, llOf, R, BASE, PERIOD };
if (typeof module !== 'undefined' && module.exports) module.exports = GROUND;
else global.GROUND = GROUND;
})(typeof globalThis !== 'undefined' ? globalThis : this);
