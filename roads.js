// Planet road network, batch W5a (W5_SPEC): RD01 trunk road with its town-exit transitions, RD02 bridges (bridge.js), the RD01 tunnel portals, the exits
// of the other classes (RD03 N04/N09/N10, RD05 N11-N13), street furniture of RD01/RD02 and the night light band (lightband.js).
// Pure part: plan(W, H) builds all data from world.js and a ground height function (no THREE, no DOM; tools/road_check.mjs runs it under Node).
// Scene part: attach(...) gives the stepped build that worldgen.js runs at start-up (W10a); the network shows in every view.
// Geometry is stored in flat Mercator coordinates and rolled onto the sphere by bend.js (docs/world/W3_SPEC.md section 2); instances are scaled by
// 1/cos(lat) so that bend.js shrinks them back to their true size. Test hooks: window.__scene.roads.
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (a, b) => { let h = Math.imul(Math.round(a * 97), 374761393) ^ Math.imul(Math.round(b * 131), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const lin = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255].map(c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));

// ---- the W5a plan. Routes are chains of edges swept as one strip (roadkit.route); the town end of every exit starts with the town's own asphalt and wears
// into the road class (W5_SPEC 3.0): RD01 9 m asphalt -> 7 m with gravel shoulders within 15 m; RD03 fraying edges, cracks, weeds; RD05 from a 4.5 m asphalt apron.
const ROUTES = [
  { id: 'N03-east', exit: 'N03', segs: [{ id: 'RN01-18' }, { id: 'RN01-19' }, { id: 'RN01-01' }, { id: 'RN01-02' }], opts: { wearMax: 0.35, wearLen: 30 }, furnish: { kind: 'RD01', firstLamp: 3, busStop: 10, barrier: ['end'] } },
  { id: 'N01-west', exit: 'N01', segs: [{ id: 'RN01-17', rev: true }, { id: 'RN01-16', rev: true }, { id: 'RN01-15', rev: true }, { id: 'RN01-14', rev: true }], opts: { wearMax: 0.35, wearLen: 30 }, furnish: { kind: 'RD01', firstLamp: 3, busStop: 11, barrier: ['end'] } },
  { id: 'RN01-ridge', segs: [{ id: 'RN01-04' }, { id: 'RN01-05' }, { id: 'RN01-06' }], opts: { wearMax: 0.3, wearLen: 40 }, furnish: { kind: 'RD01', firstLamp: 6, barrier: ['start', 'end'], tunnel: true } },
  { id: 'RN01-west', segs: [{ id: 'RN01-10' }, { id: 'RN01-11' }, { id: 'RN01-12' }], opts: { wearMax: 0.3, wearLen: 50 }, furnish: { kind: 'RD01', firstLamp: 6, barrier: ['start', 'end'] } },
  // Town streets, CR01 connections, ring and M01 south chain are swept as one network below.
  { id: 'N04-C01', exit: 'N04', segs: [{ id: 'RN02-04', rev: true }, { id: 'RN02-03', rev: true }, { id: 'RN02-02', rev: true }, { id: 'RN02-01', rev: true }], opts: { wearMax: 0.5, wearLen: 24 } },
  { id: 'N09-C01', exit: 'N09', segs: [{ id: 'RN03-02', rev: true }, { id: 'RN03-01', rev: true }], opts: { wearMax: 0.5, wearLen: 24 } },
  { id: 'N10-C01', exit: 'N10', segs: [{ id: 'RN03-03' }, { id: 'RN03-04' }], opts: { wearMax: 0.5, wearLen: 24 } },
  { id: 'N11-C01', exit: 'N11', segs: [{ id: 'RN13-02', rev: true }, { id: 'RN13-01', rev: true }], opts: { blend: 2, wearMax: 1, wearLen: 8, weedsPerBin: 4 } },
  { id: 'N12-C01', exit: 'N12', segs: [{ id: 'RN13-03' }, { id: 'RN13-04' }], opts: { blend: 2, wearMax: 1, wearLen: 6, weedsPerBin: 4 } },
  { id: 'N13-C01', exit: 'N13', segs: [{ id: 'RN14-02', rev: true }, { id: 'RN14-01', rev: true }], opts: { blend: 2, wearMax: 1, wearLen: 6, weedsPerBin: 4 } },
  { id: 'M01-south', segs: [{ id: 'RN02-05' }, { id: 'RN02-06' }, { id: 'RN02-07' }, { id: 'RN06-01' }, { id: 'RN06-02' }, { id: 'RN06-03' }], opts: { wearMax: 1, wearLen: 24, blend: 2 } },
  // CR01 is the town's orderly perimeter route: keep its RD03 section clean and continuous,
  // without the random edge fray and verge tufts used on older country roads.
  { id: 'CR01', segs: Array.from({ length: 18 }, (_, i) => ({ id: `RN04-${String(i + 1).padStart(2, '0')}` })), opts: { wearMax: 0, wearLen: 24, weeds: false, innerShoulderAsphalt: true, innerShoulderFlat: true } },
  // RN05-01 (T02-01 cut at the ring, W10b): from C01-T02 to LM02. The lamp, the bus stop and the poles beyond the cut keep their stations of the whole T02-01
  // (31, 38, 48 m from N04) less the 28.892 m cut; the lamp, poles and sign of the part inside the ring went with it.
  { id: 'RN05-RD03', segs: [{ id: 'RN05-01' }], opts: { wearMax: 0.5, wearLen: 24 }, furnish: { kind: 'RD03', lamps: [2.108], poles: [9.108, 19.108], mirror: 'bend', busStop: 2.108 } },
  // W5b: the RD05 branches off RN01 (start beyond the edge of the trunk road), the snow route RD08
  { id: 'RN07-RD05', segs: [{ id: 'RN07-01' }], opts: { trimStart: 5.2, wearMax: 0.3, wearLen: 20, taperStart: true, taperEnd: true }, furnish: { kind: 'RD05', post: true } },
  { id: 'RN08-RD05', segs: [{ id: 'RN08-01' }], opts: { trimStart: 5.2, wearMax: 0.35, wearLen: 40, taperStart: true, taperEnd: true }, furnish: { kind: 'RD05', post: true } },
  { id: 'RN09-RD05', segs: [{ id: 'RN09-01' }], opts: { trimStart: 5.2, wearMax: 0.3, wearLen: 20, taperStart: true, taperEnd: true }, furnish: { kind: 'RD05', stakes: true } },
  { id: 'RN10-RD08', segs: [{ id: 'RN10-01' }], opts: { wearMax: 0, weeds: false }, furnish: { kind: 'RD08', poleEvery: 8, shelter: 17.5 } },
];
const STAIRS = ['RN05-02', 'RN08-02'];
const BRIDGES = [
  { id: 'RN01-03', ids: ['RN01-03'] },
  { id: 'RN01-07+08+09', ids: ['RN01-07', 'RN01-08', 'RN01-09'], pylonJoint: 1, pylonShift: -4.5, access: { atJoint: 1, node: 'LM08-south' } },       // J-LM08 is the joint between RN01-08 and RN01-09; the tower stands 4.5 m before it, the RN12-01 stair at the node
  { id: 'RN01-13', ids: ['RN01-13'] },
];
const NAV_PERIOD = 6;                                // navigation lights: one slow pulse per 6 s (card: period >= 4 s, no flicker)
const SPACING = { human: 16, wild: 40 };            // RD01 lamps (card): inhabited land 16 m, wilderness 40 m

// RD01 street furniture on a swept route: lamps by zone, concrete barriers near bridges and portals, milestones, bus stops, the tunnel portal data.
function furnish(W, rt, cfg) {
  if (cfg.kind === 'RD03') return furnishRD03(W, rt, cfg);
  if (cfg.kind === 'RD05') return furnishRD05(W, rt, cfg);
  if (cfg.kind === 'RD08') return furnishRD08(W, rt, cfg);
  const S = rt.samples, n = S.length, add = (type, i, o, alt, ex = {}) => { const [lo, la] = rt.lateral(i, o); (rt.instances[type] = rt.instances[type] || []).push({ type, lon: lo, lat: la, alt, yaw: ex.yaw || 0, s: ex.s || [1, 1, 1], lean: ex.lean || [0, 0], tint: ex.tint || [1, 1, 1] }); };     // W8f-a: the lean is kept (it was dropped)
  const T = rt.tangent, yawAlong = i => Math.atan2(-T[i][1], T[i][0]), yawToward = (dx, dz) => Math.atan2(-dz, dx), yawFace = (dx, dz) => Math.atan2(dx, dz), right = i => [-T[i][1], T[i][0]];
  rt.lamps = [];
  let next = cfg.firstLamp || 3, side = 1;
  while (next < rt.length - 2) {
    const i = Math.min(n - 1, Math.round(next / 0.5)), zone = W.regionAt(S[i].lon, S[i].lat).zone, sp = zone === 'building' ? SPACING.human : SPACING.wild;
    if (S[i].span === 'tunnel') { next += 1; continue; }
    const r = right(i), it = add('lamp', i, side * 4.3, rt.surface(i, side * 4.3), { yaw: yawToward(-side * r[0], -side * r[1]) });
    rt.lamps.push({ i, s: S[i].s, zone: zone === 'building' ? 'human' : 'wild', side }); void it;
    add('lampPool', i, side * 1.5, rt.surface(i, side * 1.5) + 0.02, { yaw: Math.atan2(-T[i][1], T[i][0]), lean: [0, Math.atan((rt.bed[Math.min(n - 1, i + 2)] - rt.bed[Math.max(0, i - 2)]) / Math.max(1e-6, S[Math.min(n - 1, i + 2)].s - S[Math.max(0, i - 2)].s))] });      // W8f-a: tilted with the road (approaches climb to 14.8 %)
    side = -side; next += sp;
  }
  // concrete barriers on both shoulders: the last 14 m before a bridge abutment and 10 m outside each tunnel portal
  // W8f-a (W8_SPEC 12.1 C1, C2): next to an abutment the 1.98 m pieces stand at exact stations 1, 3, 5 ... m from the node, continuing the deck's parapet (flush with the
  // abutment, bridge.js), on the kerb line 4.85 m (x the deck's lateral factor) where the approach is RD01B, 4.62 m on the old shoulder before it; none in a junction mouth
  const near = [], mouths = rt.mouths || [], inMouth = (s, sd) => mouths.some(q => q.side === sd && s + 1 > q.s0 && s - 1 < q.s1) || (rt.kinks || []).some(k => Math.abs(s - k) < 2);
  const leanAt = i => Math.atan((rt.bed[Math.min(n - 1, i + 2)] - rt.bed[Math.max(0, i - 2)]) / Math.max(1e-6, S[Math.min(n - 1, i + 2)].s - S[Math.max(0, i - 2)].s));
  for (const end of ['start', 'end']) {
    if (!(cfg.barrier || []).includes(end)) continue;
    const ap = (rt.approaches || []).find(q => q.which === end);
    if (!ap) { near.push(end === 'start' ? [0, 14] : [rt.length - 14, rt.length]); continue; }
    const sN = end === 'end' ? rt.length : S[0].s;
    for (let k = 0; k < 7; k++) { const s = end === 'end' ? sN - 1 - 2 * k : sN + 1 + 2 * k, { i, t } = atS(rt, s), a = rt.approach[i] + (rt.approach[Math.min(n - 1, i + 1)] - rt.approach[i]) * t;
      for (const sd of [-1, 1]) { if (inMouth(s, sd)) continue; const o = sd * (4.62 + 0.23 * a), [lo, la] = latS(rt, s, o);
        (rt.instances.barrierConcrete = rt.instances.barrierConcrete || []).push({ type: 'barrierConcrete', lon: lo, lat: la, alt: surfS(rt, s, o), yaw: yawAlong(i), s: [1, 1, 1], lean: [0, leanAt(i)], tint: [1, 1, 1], station: s, side: sd }); } }
  }
  if (cfg.tunnel) { const tun = S.filter(p => p.span === 'tunnel'); if (tun.length) near.push([tun[0].s - 10, tun[0].s], [tun[tun.length - 1].s, tun[tun.length - 1].s + 10]); }
  for (const [a, b] of near) for (let s = Math.max(1, a); s < Math.min(rt.length - 0.5, b); s += 2) { const i = Math.min(n - 1, Math.round(s / 0.5)); if (S[i].span === 'tunnel') continue; for (const sd of [-1, 1]) if (!inMouth(s, sd)) add('barrierConcrete', i, sd * 4.62, rt.surface(i, sd * 4.62), { yaw: yawAlong(i), lean: [0, leanAt(i)] }); }
  // milestones every 25 m on the right shoulder (not inside the barrier zones), a bus stop sign
  for (let s = 12; s < rt.length - 4; s += 25) { const i = Math.round(s / 0.5); if (S[i].span === 'tunnel' || near.some(([a, b]) => s > a - 1 && s < b + 1)) continue; add('milestone', i, 4.1, rt.surface(i, 4.1), { yaw: yawAlong(i) + Math.PI / 2 }); }
  if (cfg.busStop) { const i = Math.round(cfg.busStop / 0.5), r = right(i); add('signBus', i, 4.2, rt.surface(i, 4.2), { yaw: yawFace(-r[0], -r[1]) }); }
  // tunnel: the samples of the span with the bed altitude (the arch geometry is made in the scene part)
  if (cfg.tunnel) { const idx = []; S.forEach((p, i) => { if (p.span === 'tunnel') idx.push(i); }); rt.tunnel = { idx, s0: S[idx[0]].s, s1: S[idx[idx.length - 1]].s, innerR: 4.7, wallH: 1.0, shell: 0.7 }; }
}

// generic placing helper for a swept route
function placer(rt) {
  const S = rt.samples, n = S.length, T = rt.tangent;
  const add = (type, i, o, alt, ex = {}) => { const [lo, la] = rt.lateral(i, o); const rec = { type, lon: lo, lat: la, alt, yaw: ex.yaw || 0, s: ex.s || [1, 1, 1], lean: ex.lean || [0, 0], tint: ex.tint || [1, 1, 1] }; (rt.instances[type] = rt.instances[type] || []).push(rec); return rec; };
  const idxAt = s => Math.min(n - 1, Math.max(0, Math.round((s - S[0].s) / 0.5)));
  return { add, idxAt, S, n, T, yawAlong: i => Math.atan2(-T[i][1], T[i][0]), yawAcross: i => Math.atan2(T[i][0], T[i][1]), yawToward: (dx, dz) => Math.atan2(-dz, dx), yawFace: (dx, dz) => Math.atan2(dx, dz), right: i => [-T[i][1], T[i][0]] };
}

// RD03 country road (card): lamps about every 25 m (junction and bus stop included), utility poles that are never in a perfect row (jittered along and across, a small
// lean), convex mirror, signs, a vending machine or a jizo shrine at the junction, a bus stop sign with a bench.
function furnishRD03(W, rt, cfg) {
  const P = placer(rt), { add, idxAt, S, n } = P; rt.lamps = []; rt.poles = [];
  let side = 1;
  for (const s of cfg.lamps) { const i = idxAt(s), r = P.right(i), o = 3.15 * side; add('lamp', i, o, rt.surface(i, o), { yaw: P.yawToward(-side * r[0], -side * r[1]), s: [0.8, 0.8, 0.8] }); add('lampPool', i, side * 1.3, rt.surface(i, side * 1.3) + 0.02); rt.lamps.push({ i, s: S[i].s, side, zone: 'rd03' }); side = -side; }
  cfg.poles.forEach((s0, k) => { const s = s0 + (hash(s0, 3) - 0.5) * 3, o = 3.9 + (hash(s0, 5) - 0.5) * 1.0, i = idxAt(s), rec = add('pole', i, o, rt.surface(i, o), { yaw: P.yawAcross(i) + (hash(s0, 7) - 0.5) * 0.25, lean: [(hash(s0, 9) - 0.5) * 0.07, (hash(s0, 11) - 0.5) * 0.07] }); rt.poles.push({ i, s: S[i].s, rec }); });
  for (const sg of (cfg.sign || [])) { const i = idxAt(sg.s), r = P.right(i), o = 2.9; add(sg.type, i, o, rt.surface(i, o), { yaw: P.yawFace(-r[0], -r[1]) }); }
  if (cfg.mirror) { let best = 0, bi = n - 2; if (cfg.mirror === 'end') bi = n - 8; else for (let i = 2; i < n - 2; i++) { const a = Math.abs(((rt.brg[i + 1] - rt.brg[i - 1] + 540) % 360) - 180); if (a > best) { best = a; bi = i; } } const r = P.right(bi); add('mirror', bi, -3.0, rt.surface(bi, -3.0), { yaw: P.yawFace(r[0], r[1]) }); }
  if (cfg.vending) { const i = idxAt(cfg.vending), o = 3.7; add('vending', i, o, rt.surface(i, o), { yaw: P.yawFace(-P.right(i)[0], -P.right(i)[1]) }); }
  if (cfg.jizo) { const i = idxAt(cfg.jizo), o = 3.0; add('jizo', i, o, rt.surface(i, o), { yaw: P.yawFace(-P.right(i)[0], -P.right(i)[1]) }); add('lantern', i, o + 0.8, rt.surface(i, o + 0.8), { yaw: 0 }); }
  if (cfg.busStop) { const i = idxAt(cfg.busStop), r = P.right(i); add('signBus', i, 2.9, rt.surface(i, 2.9), { yaw: P.yawFace(-r[0], -r[1]) }); add('busBench', i + 6 < n ? i + 6 : i, 3.1, rt.surface(i + 6 < n ? i + 6 : i, 3.1), { yaw: P.yawAlong(i) }); }
}
// RD05 dirt track: a stone post where it leaves the trunk road; the desert one (RN09-01) is marked by wooden stakes every 5 m
function furnishRD05(W, rt, cfg) {
  const P = placer(rt), { add, idxAt, S } = P;
  if (cfg.post) { const i = idxAt(S[0].s + 0.8); add('stonePost', i, -1.95, rt.surface(i, -1.95), { s: [0.9, 1, 0.9] }); }
  if (cfg.stakes) for (let s = S[0].s + 2.5; s < rt.length - 1; s += 5) for (const sd of [-1, 1]) { const i = idxAt(s), o = sd * (1.95 + 0.15 * hash(s, sd)); add('bollard', i, o, rt.surface(i, o) - 0.03, { yaw: hash(s, 3) * 6.28, s: [0.8, 1.1 + 0.4 * hash(s, 5), 0.8], lean: [(hash(s, 7) - 0.5) * 0.12, (hash(s, 9) - 0.5) * 0.12] }); }
}
// RD08 snow route (card): red-white poles 2 m high every 8 m on both sides of the 2 m compacted track, an orange refuge hut half buried in the snow half way
function furnishRD08(W, rt, cfg) {
  const P = placer(rt), { add, idxAt, S } = P; rt.poles8 = [];
  for (let s = S[0].s + 3; s < rt.length - 1; s += cfg.poleEvery) for (const sd of [-1, 1]) { const i = idxAt(s), o = sd * 1.9; add('snowPole', i, o, rt.surface(i, o), { yaw: P.yawAcross(i) + (sd > 0 ? Math.PI : 0) }); rt.poles8.push({ s: S[i].s, side: sd, i }); }
  { const i = idxAt(cfg.shelter), o = 3.6, g = rt.surface(i, o); add('shelterOrange', i, o, g - 0.8, { yaw: P.yawAcross(i) }); rt.shelter = { i, s: S[i].s, alt: g }; }
}

// ---- W8f-a joints (W8_SPEC 12.1 C): the six RD01 / RD02 abutments, the RN01 chainage, the T junctions of a minor road with RD01 (three since W10b retired T04 / T05)
const FILLET_T = 12, FILLET_E = 0.75;                // abutment transitions: at most 12 m on each side of the node (tangent length), within 0.75 m of the original centre lines
const PAVE_LIFT = 0.01;                              // junction paving above the trunk's surface (flush: <= 0.02 m)
// RN01 round the planet in its order of travel (N03 east round to N01): pieces and their direction against the trunk's chainage
const RING = [['N03-east', 1], ['RN01-03', 1], ['RN01-ridge', 1], ['RN01-07+08+09', 1], ['RN01-west', 1], ['RN01-13', 1], ['N01-west', -1]];
// CR01 has ten explicit junctions. The two RN01 crossings and the shared M01/T03 south node are
// real multi-arm intersections; derive every arm from the edges meeting the node and never infer
// a T merely because a route happens to pass through it.
const CR01_JUNCTIONS = [
  { node: 'C01-N' },
  { node: 'C01-W-N09' },
  { node: 'C01-E-N10' },
  { node: 'C01-W-N11' },
  { node: 'C01-E-N12' },
  { node: 'C01-E-N13' },
  { node: 'C01-T02' },
  { node: 'C01-W-N01' },
  { node: 'C01-E-N03' },
  { node: 'C01-S' },
];
// The remaining legacy T junctions are outside CR01 and retain their rounded paving.
const JUNCTIONS = [
  { node: 'J-T07', trunk: 'RN01-ridge', branch: 'RN07-RD05', paving: 'dirt', r: 2 },
  { node: 'J-T08', trunk: 'RN01-west', branch: 'RN08-RD05', paving: 'dirt', r: 2 },
  { node: 'J-T09', trunk: 'RN01-west', branch: 'RN09-RD05', paving: 'dirt', r: 2 },
];
const wrap180 = a => (((a % 360) + 540) % 360) - 180;
// local plane at a node: gnomonic (great circles through the node are straight lines, azimuths at the node are true); coordinates east, north in metres
function plane(W, node) {
  return {
    to(p) { const d = W.arcDistance(node, p) / R, b = W.bearing(node, p) * D, rho = R * Math.tan(d); return [rho * Math.sin(b), rho * Math.cos(b)]; },
    from(g) { const rho = Math.hypot(g[0], g[1]); if (rho < 1e-12) return { lon: node.lon, lat: node.lat }; const q = W.destination(node, Math.atan2(g[0], g[1]) / D, R * Math.atan(rho / R)); return { lon: q.lon, lat: q.lat }; },
  };
}
// common-tangent transition at an abutment node (W8_SPEC 12.1 C1), in the node's gnomonic plane: a quadratic Bezier from A, Ta metres before the node on the road's own centre
// line (with its direction there), to B, Tb metres after it on the bridge's (with its direction), whose middle control point is where the two tangents meet: tangent at both
// ends, curvature nearly even (sin(angle) / 2T at the ends and in the middle). Ta stops 0.5 m short of a kink over 5 deg on the road (LM09-north, 10.5 m from J-W1, turns by 22 deg);
// the smaller kinks of the road's own nodes within 12 m (J-T04, J-T07, J-T09: 1-2 deg) are smoothed with the joint; both lengths shrink until the curve stays within FILLET_E
// of the original centre lines. road / bridge: centre-line points {lon, lat} from the node outward. at(t), t in [-Ta, Tb], walks the curve at a uniform rate (t < 0 on the road).
function transition(W, node, road, bridge, maxDeviation = FILLET_E) {
  // distances along both centre lines and along the curve are true metres on the sphere (the plane stretches by up to 2 % at 12 m from the node)
  const P = plane(W, node), poly = pts => { const g = pts.map(p => P.to(p)), c = [0]; for (let k = 1; k < g.length; k++) c.push(c[k - 1] + W.arcDistance(pts[k - 1], pts[k])); return { g, c }; };
  const Rd = poly(road), Bd = poly(bridge), unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
  const along = (L, d) => { let k = 0; while (k + 2 < L.g.length && L.c[k + 1] < d) k++; const f = (d - L.c[k]) / Math.max(1e-9, L.c[k + 1] - L.c[k]); return { p: [L.g[k][0] + (L.g[k + 1][0] - L.g[k][0]) * f, L.g[k][1] + (L.g[k + 1][1] - L.g[k][1]) * f], dir: unit([L.g[k + 1][0] - L.g[k][0], L.g[k + 1][1] - L.g[k][1]]) }; };
  const kinkAt = L => { for (let k = 1; k + 1 < L.g.length && L.c[k] < FILLET_T + 1; k++) { const a = unit([L.g[k][0] - L.g[k - 1][0], L.g[k][1] - L.g[k - 1][1]]), b = unit([L.g[k + 1][0] - L.g[k][0], L.g[k + 1][1] - L.g[k][1]]); if (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))) > 5 * D) return L.c[k]; } return Infinity; };
  const distTo = (L, q, dMax) => { let best = Infinity; for (let k = 0; k + 1 < L.g.length && L.c[k] < dMax; k++) { const a = L.g[k], b = L.g[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-12, t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / l2)); best = Math.min(best, Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dz * t)); } return best; };
  let Ta = Math.min(FILLET_T, kinkAt(Rd) - 0.5), Tb = Math.min(FILLET_T, kinkAt(Bd) - 0.5), curve = null, len = 0, E = 0;
  for (let it = 0; it < 40; it++) {
    const A = along(Rd, Ta), B = along(Bd, Tb), tA = [-A.dir[0], -A.dir[1]], tB = B.dir, det = tA[0] * -tB[1] - tA[1] * -tB[0];
    let V = [(A.p[0] + B.p[0]) / 2, (A.p[1] + B.p[1]) / 2];
    if (Math.abs(det) > 1e-9) { const rx = B.p[0] - A.p[0], rz = B.p[1] - A.p[1], lam = (rx * -tB[1] - rz * -tB[0]) / det; V = [A.p[0] + lam * tA[0], A.p[1] + lam * tA[1]]; }
    const N = 240, pts = [], cum = [0];
    const ll = []; for (let k = 0; k <= N; k++) { const u = k / N, w0 = (1 - u) * (1 - u), w1 = 2 * u * (1 - u), w2 = u * u; pts.push([w0 * A.p[0] + w1 * V[0] + w2 * B.p[0], w0 * A.p[1] + w1 * V[1] + w2 * B.p[1]]); ll.push(P.from(pts[k])); if (k) cum.push(cum[k - 1] + W.arcDistance(ll[k - 1], ll[k])); }
    E = Math.max(...pts.map(q => Math.min(distTo(Rd, q, Ta + 1), distTo(Bd, q, Tb + 1)))); curve = { pts, cum }; len = cum[N];
    if (E <= maxDeviation) break; Ta *= 0.92; Tb *= 0.92;
  }
  const at = t => {
    if (t <= -Ta) return P.from(along(Rd, -t).p); if (t >= Tb) return P.from(along(Bd, t).p);
    const l = (t + Ta) / (Ta + Tb) * len, { pts, cum } = curve; let k = 0; while (k + 2 < pts.length && cum[k + 1] < l) k++; const f = (l - cum[k]) / Math.max(1e-12, cum[k + 1] - cum[k]);
    return P.from([pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]);
  };
  const a0 = along(Rd, Ta).dir, b0 = along(Bd, Tb).dir, angle = Math.acos(Math.max(-1, Math.min(1, -a0[0] * b0[0] - a0[1] * b0[1]))) / D;
  return { at, Ta, Tb, T: Math.max(Ta, Tb), brg: W.bearing(at(-0.05), at(0.05)), angle, offset: W.arcDistance(at(0), node), deviation: E };
}
// centre-line points of a list of segments from one of its ends outward (as route() and bridge.js sample them)
function chainPoints(W, segs, fromEnd) {
  const NET = W.roadNetwork, out = [];
  segs.forEach((sg, k) => { const e = NET.edges.find(q => q.id === sg.id); let P = NET.samplePath(e, 0.5); if (sg.rev) P = P.slice().reverse(); P.forEach((p, i) => { if (k > 0 && i === 0) return; out.push({ lon: p.lon, lat: p.lat }); }); });
  return fromEnd ? out.reverse() : out;
}
// A curve at a node between consecutive route edges. `station` uses the same cumulative samplePath chainage
// as roadkit.route() and bridge.build(); the curve itself uses the same common-tangent construction as an abutment.
function nodeTurn(W, segs, node) {
  const NET = W.roadNetwork; let station = 0;
  for (let k = 1; k < segs.length; k++) {
    const prev = segs[k - 1], next = segs[k];
    station += NET.edgeLength(NET.edges.find(e => e.id === prev.id));
    if (routeNode(NET, prev, 'end') === node && routeNode(NET, next, 'start') === node) {
      // the road on both sides of the node as far as the route goes (W10b: RN01-15 before LM09-north is 8 m long, the fillet reaches on into RN01-16)
      const incoming = chainPoints(W, segs.slice(0, k).reverse().map(sg => ({ id: sg.id, rev: !sg.rev })), false), outgoing = chainPoints(W, segs.slice(k), false);
      return { node, station, fillet: transition(W, NET.nodeById[node], incoming, outgoing, node === 'LM09-north' ? 0.95 : FILLET_E) };
    }
  }
  throw new Error(`no route joint at ${node}: ${segs.map(q => q.id).join('+')}`);
}
// the node of a route's first / last segment
function routeNode(NET, sg, which) { const e = NET.edges.find(q => q.id === sg.id); return (which === 'start') === !sg.rev ? e.from : e.to; }
// a point of an edge about `d` metres from one of its nodes
function nearNode(W, edgeId, node, d = 1) { const NET = W.roadNetwork, e = NET.edges.find(q => q.id === edgeId), P = NET.samplePath(e, 0.5); let best = P[0], bd = Infinity; for (const p of P) { const q = Math.abs(W.arcDistance(p, node) - d); if (q < bd) { bd = q; best = p; } } return best; }
// the abutments: for every end of a bridge, the route that ends there, the fillet and the deck grade the approach climbs to
function abutments(W, BR, routeIds) {                // routeIds (W8g-b): only the abutments of these routes (each abutment depends on its own node only)
  const NET = W.roadNetwork, out = [];
  for (const bd of BRIDGES) for (const be of ['start', 'end']) {
    const node = be === 'start' ? NET.edges.find(q => q.id === bd.ids[0]).from : NET.edges.find(q => q.id === bd.ids[bd.ids.length - 1]).to;
    const rd = ROUTES.find(r => [routeNode(NET, r.segs[0], 'start'), routeNode(NET, r.segs[r.segs.length - 1], 'end')].includes(node)); if (!rd || (routeIds && !routeIds.includes(rd.id))) continue;
    const re = routeNode(NET, rd.segs[0], 'start') === node ? 'start' : 'end', N0 = NET.nodeById[node];
    const road = chainPoints(W, rd.segs, re === 'end'), bridge = chainPoints(W, bd.ids.map(id => ({ id })), be === 'end');
    out.push({ node, bridge: bd.id, bEnd: be, route: rd.id, rEnd: re, fillet: transition(W, N0, road, bridge), grade: BR.DECK.slope });
  }
  return out;
}
// chainage of the ring pieces: { c0, dir } with c = c0 + dir * s
function ringChain(W) {
  const NET = W.roadNetwork, byId = Object.fromEntries(NET.edges.map(e => [e.id, e])), len = id => NET.edgeLength(byId[id]), out = {}; let c = 0;
  for (const [id, dir] of RING) { const r = ROUTES.find(q => q.id === id), b = BRIDGES.find(q => q.id === id), segs = r ? r.segs : b.ids.map(x => ({ id: x })), lengths = segs.map(q => len(q.id)), town = segs.map(q => /^TOWN_/.test(byId[q.id].class));
    const firstRural = town.indexOf(false), townPrefix = firstRural < 0 ? lengths.reduce((a, v) => a + v, 0) : lengths.slice(0, firstRural).reduce((a, v) => a + v, 0), L = lengths.reduce((a, v, i) => a + (town[i] ? 0 : v), 0);
    out[id] = dir > 0 ? { c0: c - townPrefix, dir: 1 } : { c0: c + L + townPrefix, dir: -1 }; c += L; }
  return out;
}
// junction layout in the node's plane, from world.js alone (before any road is swept). The trunk is two straight legs through the node (it turns by 1-3 deg at J-T07 ... J-T09):
// its carriageway edge on the branch side (3.5 m) is one line per leg. Each of the branch's two paved edges meets the edge line of the leg it lands on;
// a corner arc of radius r is tangent to both (T1 on the trunk edge, T2 on the branch edge); the branch then starts 0.6 m beyond the farther T2. The mouth = the trunk stations
// where the paving outline lies in the ditch band (4.4-7.3 m from the centre), at least the branch's paved width + 1 m on each side: there the ditch is filled and no barrier stands.
function junctionPlan(W, J, RK) {
  const NET = W.roadNetwork, N0 = NET.nodeById[J.node], P = plane(W, N0), tr = ROUTES.find(r => r.id === J.trunk), br = ROUTES.find(r => r.id === J.branch);
  const unit = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }, dot = (a, b) => a[0] * b[0] + a[1] * b[1], right = d => [d[1], -d[0]];
  let sJ = 0, iSeg = 0; for (; iSeg < tr.segs.length; iSeg++) { if (routeNode(NET, tr.segs[iSeg], 'start') === J.node) break; sJ += NET.edgeLength(NET.edges.find(e => e.id === tr.segs[iSeg].id)); }
  const dF = unit(P.to(nearNode(W, tr.segs[iSeg].id, N0, 4))), dB = unit(P.to(nearNode(W, tr.segs[iSeg - 1].id, N0, 4)).map(v => -v)), dM = unit([dF[0] + dB[0], dF[1] + dB[1]]);
  const branchEnd = routeNode(NET, br.segs[br.segs.length - 1], 'end') === J.node ? 'end' : routeNode(NET, br.segs[0], 'start') === J.node ? 'start' : null;
  if (!branchEnd) throw new Error(`junction ${J.node}: branch ${J.branch} does not terminate at node`);
  const bEdge = branchEnd === 'end' ? br.segs[br.segs.length - 1].id : br.segs[0].id, bd = unit(P.to(nearNode(W, bEdge, N0, 4))), sigma = dot(bd, right(dM)) > 0 ? 1 : -1;
  const localBranchPaved = RK.PROFILES[NET.edges.find(e => e.id === bEdge).class].paved;
  const h = Math.max(Math.abs(localBranchPaved[0]), Math.abs(localBranchPaved[1])),
    frontHalf = Math.max(Math.abs(RK.PROFILES[NET.edges.find(e => e.id === tr.segs[iSeg].id).class].paved[0]), Math.abs(RK.PROFILES[NET.edges.find(e => e.id === tr.segs[iSeg].id).class].paved[1])),
    backHalf = Math.max(Math.abs(RK.PROFILES[NET.edges.find(e => e.id === tr.segs[iSeg - 1].id).class].paved[0]), Math.abs(RK.PROFILES[NET.edges.find(e => e.id === tr.segs[iSeg - 1].id).class].paved[1])), vE = Math.max(frontHalf, backHalf), r = J.r, nB = right(bd);
  const legs = { back: { d: dB, p: right(dB).map(v => v * sigma * vE) }, fwd: { d: dF, p: right(dF).map(v => v * sigma * vE) } };
  const meet = (p1, d1, p2, d2) => { const det = d1[0] * -d2[1] - d1[1] * -d2[0], rx = p2[0] - p1[0], rz = p2[1] - p1[1], l = (rx * -d2[1] - rz * -d2[0]) / det; return [p1[0] + l * d1[0], p1[1] + l * d1[1]]; };
  // station (signed metres from the node along the trunk) and distance from the trunk centre of a point of the plane (the nearer leg)
  const onTrunk = q => { const a = dot(q, dF), b = dot(q, dB); if (a >= 0) return { s: a, o: Math.abs(dot(q, right(dF))) }; return { s: b, o: Math.abs(dot(q, right(dB))) }; };
  // each branch edge meets the edge line of the leg it lands on at X; its corner opens along that line away from the branch: backward for the edge on the branch's back side
  // (smaller station), forward for the other (the acute and the obtuse corner of a skewed junction)
  const hits = [-1, 1].map(e => { const p2 = nB.map(v => v * e * h), Xf = meet(legs.fwd.p, legs.fwd.d, p2, bd), fwd = dot(Xf, dF) >= 0, X = fwd ? Xf : meet(legs.back.p, legs.back.d, p2, bd); return { e, p2, X, fwd, u: fwd ? dot(X, dF) : dot(X, dB) }; });
  const travel = branchEnd === 'start' ? bd : bd.map(v => -v), acute = Math.min(...[dF, dB].map(d => { const a = Math.acos(Math.max(-1, Math.min(1, dot(travel, d)))) / D; return Math.min(a, 180 - a); }));
  if (acute < 12) {
    const branchLength = br.segs.reduce((sum, q) => sum + NET.edgeLength(NET.edges.find(e => e.id === q.id)), 0);
    return { ...J, N0, P, toUV: q => P.to(q), fromUV: (x, y) => P.from([x, y]), sJ, sigma, h, vE, bd, nB, dF, dB, branchEnd, shallowMerge: true, mergeAngle: acute, mergeLength: Math.min(16, branchLength), lamEnd: 0, mouth: { s0: Math.max(0, sJ - 12), s1: sJ + 1, side: sigma, from: vE + 0.2, to: vE + 3.7 }, corners: [{ corner: acute }, { corner: 180 - acute }], coverage: 1, triangles: 0, pts: [] };
  }
  const edges = hits.map(hi => {
    const { e, p2, X, fwd } = hi, ahead = hi.u >= Math.min(...hits.map(q => q.u)) + 1e-9 ? 1 : -1, leg = fwd ? dF : dB, h1 = leg.map(v => v * ahead), cg = Math.max(-1, Math.min(1, dot(h1, bd))), g = Math.acos(cg), t = r / Math.tan(g / 2);
    const T1 = [X[0] + h1[0] * t, X[1] + h1[1] * t], T2 = [X[0] + bd[0] * t, X[1] + bd[1] * t], w = unit([h1[0] + bd[0], h1[1] + bd[1]]), C = [X[0] + w[0] * r / Math.sin(g / 2), X[1] + w[1] * r / Math.sin(g / 2)];
    const a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0]), a2 = Math.atan2(T2[1] - C[1], T2[0] - C[0]), da = Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
    const arc = Array.from({ length: 13 }, (_, k) => [C[0] + r * Math.cos(a1 + da * k / 12), C[1] + r * Math.sin(a1 + da * k / 12)]);
    return { e, X, leg: fwd ? 'fwd' : 'back', C, T1, T2, arc, lam: dot(T2, bd), corner: g / D, line: { p: p2, d: bd } };
  });
  const lamEnd = Math.max(...edges.map(q => q.lam)) + 0.6, band = [];
  for (const q of edges) { const end = [q.line.p[0] + lamEnd * bd[0], q.line.p[1] + lamEnd * bd[1]], line = [...q.arc, end]; for (let k = 0; k + 1 < line.length; k++) for (let f = 0; f <= 1; f += 0.1) { const c = onTrunk([line[k][0] + (line[k + 1][0] - line[k][0]) * f, line[k][1] + (line[k + 1][1] - line[k][1]) * f]); if (c.o >= vE + 0.9 && c.o <= vE + 3.8) band.push(c.s); } }
  const xc = onTrunk(bd.map(v => v * (vE + 1.6) / Math.max(0.2, Math.abs(dot(bd, right(dM)))))), half = h / Math.max(0.2, Math.abs(dot(bd, right(dM)))) + 1;
  const u0 = Math.min(...band, xc.s - half) - 0.3, u1 = Math.max(...band, xc.s + half) + 0.3;
  return { ...J, N0, P, toUV: q => P.to(q), fromUV: (x, y) => P.from([x, y]), sJ, sigma, h, vE, bd, nB, dF, dB, edges, lamEnd, mouth: { s0: sJ + u0, s1: sJ + u1, side: sigma, from: vE + 0.2, to: vE + 3.7 }, branchEnd };
}
// a route at a fractional station: index and fraction, lateral point (with the approach's lateral factor), surface altitude
const atS = (rt, s) => { const S = rt.samples, n = S.length; let i = 0; while (i + 2 < n && S[i + 1].s < s) i++; return { i, t: Math.max(0, Math.min(1, (s - S[i].s) / Math.max(1e-9, S[i + 1].s - S[i].s))) }; };
const latS = (rt, s, o) => { const { i, t } = atS(rt, s), a = rt.lateral(i, o * rt.cf[i]), b = rt.lateral(i + 1, o * rt.cf[i + 1]); return [a[0] + wrap180(b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
const surfS = (rt, s, o) => { const { i, t } = atS(rt, s); return rt.surface(i, o) + (rt.surface(i + 1, o) - rt.surface(i, o)) * t; };
// station and lateral offset (grid metres, + = right of travel) of a point near a route, searched within +-20 m of a station hint
function project(rt, lon, lat, hint) {
  const S = rt.samples, F = rt.flatOf, n = S.length, x = R * lon * D, z = -R * Math.asinh(Math.tan(lat * D)); let best = null;
  for (let i = 0; i + 1 < n; i++) {
    if (Math.abs(S[i].s - hint) > 20) continue;
    const ax = F[i].x, az = F[i].z, dx = F[i + 1].x - ax, dz = F[i + 1].z - az, px = x + 2 * Math.PI * R * Math.round((ax - x) / (2 * Math.PI * R)), l2 = dx * dx + dz * dz || 1e-12;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (z - az) * dz) / l2)), qx = ax + dx * t, qz = az + dz * t, d2 = (px - qx) ** 2 + (z - qz) ** 2;
    if (!best || d2 < best.d2) { const k = F[i].k, Tx = rt.tangent[i][0] + (rt.tangent[i + 1][0] - rt.tangent[i][0]) * t, Tz = rt.tangent[i][1] + (rt.tangent[i + 1][1] - rt.tangent[i][1]) * t, side = ((px - qx) * -Tz + (z - qz) * Tx) >= 0 ? 1 : -1;
      best = { d2, s: S[i].s + (S[i + 1].s - S[i].s) * t, o: side * Math.sqrt(d2) / k / (rt.cf[i] + (rt.cf[i + 1] - rt.cf[i]) * t), i, t }; }
  }
  return best;
}
// the junction paving in the node's plane: the outline runs along the trunk's actual carriageway edge (3.5 m, sampled from the swept trunk between the two corners), round the
// corner arc and up the branch edge on one side, across the branch's actual last row, and back down the other side; it is cut into triangles by ear clipping and every edge longer
// than 0.75 m is split at its midpoint (the same rule on both sides of an edge, no cracks), so that the heights - the trunk's surface (its mouth is flat on the bed) + PAVE_LIFT,
// which the branch's last row was lifted to - follow the ground. Returns the strip, the ink of both curb lines and the corner data.
function earClip(P) {
  const n = P.length, area = P.reduce((a, p, i) => { const q = P[(i + 1) % n]; return a + p[0] * q[1] - q[0] * p[1]; }, 0), V = Array.from({ length: n }, (_, i) => i);
  if (area < 0) V.reverse();
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]), out = [];
  const inside = (p, a, b, c) => cross(a, b, p) >= -1e-12 && cross(b, c, p) >= -1e-12 && cross(c, a, p) >= -1e-12;
  let guard = 0;
  while (V.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let k = 0; k < V.length; k++) {
      const i0 = V[(k + V.length - 1) % V.length], i1 = V[k], i2 = V[(k + 1) % V.length], a = P[i0], b = P[i1], c = P[i2];
      if (cross(a, b, c) <= 1e-12) continue;
      if (V.some(j => j !== i0 && j !== i1 && j !== i2 && inside(P[j], a, b, c))) continue;
      out.push(i0, i1, i2); V.splice(k, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (V.length === 3) out.push(V[0], V[1], V[2]);
  return out;
}
function paving(W, jp, trunk, branch) {
  const nodeS = branch.sNode(jp.branchEnd), endS = jp.branchEnd === 'end' ? nodeS - jp.lamEnd : nodeS + jp.lamEnd,
    iE = Math.max(0, Math.min(branch.samples.length - 1, atS(branch, endS).i)), branchBase = branch.colAlt.slice(), ends = [-1, 1].map(sd => { const [lo, la] = branch.lateral(iE, sd * jp.h * branch.cf[iE]); return jp.toUV({ lon: lo, lat: la }); });
  const branchSurface = (s, o) => {
    const { i, t } = atS(branch, s), row = k => { let j = 0; while (j + 2 < branch.grid.length && branch.grid[j + 1] < o) j++; const f = Math.max(0, Math.min(1, (o - branch.grid[j]) / (branch.grid[j + 1] - branch.grid[j]))); return branchBase[k * branch.grid.length + j] + (branchBase[k * branch.grid.length + j + 1] - branchBase[k * branch.grid.length + j]) * f; };
    return row(i) + (row(i + 1) - row(i)) * t;
  };
  const dLine = (q, p) => Math.abs((p[0] - q.line.p[0]) * -q.line.d[1] + (p[1] - q.line.p[1]) * q.line.d[0]), stOf = g => { const ll = jp.fromUV(g[0], g[1]); return project(trunk, ll.lon, ll.lat, jp.sJ).s; };
  const edgeAt = s => { const [lo, la] = latS(trunk, s, jp.sigma * jp.vE); return jp.toUV({ lon: lo, lat: la }); };          // the trunk's actual carriageway edge at station s
  const sides = jp.edges.map(q => { const sX = stOf(q.X), sT = stOf(q.T1); return { q, E: dLine(q, ends[0]) < dLine(q, ends[1]) ? ends[0] : ends[1], sX, X: edgeAt(sX), T1: edgeAt(sT), sT }; }).sort((a, b) => a.sX - b.sX);
  // the body: the branch's footprint down to the trunk edge (between the two X), with T2 on its sides; two corner fans from X over the arcs (T1 snapped onto the actual edge)
  const nB = Math.max(1, Math.ceil((sides[1].sX - sides[0].sX) / 0.5)), bottom = Array.from({ length: nB + 1 }, (_, k) => k === 0 ? sides[0].X : k === nB ? sides[1].X : edgeAt(sides[0].sX + (sides[1].sX - sides[0].sX) * k / nB));
  const body = [...bottom, sides[1].q.T2, sides[1].E, sides[0].E, sides[0].q.T2], V = body.map(p => p.slice()), tris = earClip(V);
  const left = [sides[0].T1, ...sides[0].q.arc.slice(1)], right = [sides[1].T1, ...sides[1].q.arc.slice(1)];
  for (const [sd, arc] of [[sides[0], left], [sides[1], right]]) { const x = V.push(sd.X.slice()) - 1, first = V.length; arc.forEach(p => V.push(p.slice())); for (let k = 0; k + 1 < arc.length; k++) tris.push(x, first + k, first + k + 1); }
  // the midpoint refinement (edges <= 0.75 m)
  const cache = new Map(), MAX2 = 0.75 * 0.75, idx = [];
  const mid = (a, b) => { const k = Math.min(a, b) * 1e6 + Math.max(a, b); let m = cache.get(k); if (m === undefined) { m = V.length; V.push([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2]); cache.set(k, m); } return m; };
  const long = (a, b) => (V[a][0] - V[b][0]) ** 2 + (V[a][1] - V[b][1]) ** 2 > MAX2;
  const st = []; for (let t = 0; t < tris.length; t += 3) st.push([tris[t], tris[t + 1], tris[t + 2]]);
  while (st.length) {
    const [p, q, r] = st.pop(), lp = long(p, q), lq = long(q, r), lr = long(r, p), k = lp + lq + lr;
    if (!k) { idx.push(p, q, r); continue; }
    if (k === 3) { const m1 = mid(p, q), m2 = mid(q, r), m3 = mid(r, p); st.push([p, m1, m3], [m1, q, m2], [m3, m2, r], [m1, m2, m3]); continue; }
    if (k === 1) { const [A, B, C] = lp ? [p, q, r] : lq ? [q, r, p] : [r, p, q], m = mid(A, B); st.push([A, m, C], [m, B, C]); continue; }
    const [A, B, C] = !lr ? [p, q, r] : !lp ? [q, r, p] : [r, p, q], m1 = mid(A, B), m2 = mid(B, C); st.push([m1, B, m2], [A, m1, m2], [A, m2, C]);
  }
  const pos = [], col = [], pts = [], C = jp.paving === 'asphalt' ? [lin('#2f3645'), lin('#353c4b')] : [lin('#6a5a46'), lin('#5a4c3b')],
    heightAt = ll => {
      const pr = project(trunk, ll.lon, ll.lat, jp.sJ), trunkH = surfS(trunk, pr.s, pr.o) + PAVE_LIFT,
        bp = project(branch, ll.lon, ll.lat, endS), branchH = bp ? branchSurface(bp.s, bp.o) : trunkH,
        fromNode = bp ? (jp.branchEnd === 'end' ? nodeS - bp.s : bp.s - nodeS) : 0,
        across = smooth(jp.vE, jp.vE + 1, Math.abs(pr.o)), w = branch.def.exit && jp.lamEnd > 1e-6 && bp ? smooth(0, jp.lamEnd, fromNode) * across : 0;
      return trunkH + (branchH - trunkH) * w;
    };
  if (branch.def.exit) {
    const m = branch.grid.length;
    for (let j = 0; j < m; j++) if (Math.abs(branch.grid[j]) <= jp.h + 1e-6) {
      const [lon, lat] = branch.lateral(iE, branch.grid[j] * branch.cf[iE]), h = heightAt({ lon, lat }), k = (iE * m + j) * 3;
      branch.colAlt[iE * m + j] = h; branch.strip.pos[k + 1] = (h - BASE) / Math.cos(lat * D);
    }
  }
  for (const g of V) {
    const ll = jp.fromUV(g[0], g[1]), pr = project(trunk, ll.lon, ll.lat, jp.sJ), h = heightAt(ll), k = 1 / Math.cos(ll.lat * D);
    pos.push(R * ll.lon * D, (h - BASE) * k, -R * Math.asinh(Math.tan(ll.lat * D))); pts.push({ lon: ll.lon, lat: ll.lat, h, s: pr.s, o: pr.o });
    const hz = hash(g[0] * 1.3, g[1] * 1.1), c = C[0].map((v2, ci) => (v2 + (C[1][ci] - v2) * hz) * (0.97 + 0.05 * hash(g[0] * 2.3, g[1] * 1.9))); col.push(c[0], c[1], c[2]);
  }
  // wound to face up in the flat frame (the coverage below shows that no two triangles overlap: the sum of their areas equals the outline's)
  for (let t = 0; t < idx.length; t += 3) { const A = idx[t] * 3, B = idx[t + 1] * 3, Cc = idx[t + 2] * 3; const ny = (pos[B + 2] - pos[A + 2]) * (pos[Cc] - pos[A]) - (pos[B] - pos[A]) * (pos[Cc + 2] - pos[A + 2]); if (ny < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; } }
  const outline = [...bottom.slice(0, 1), ...[...left].reverse(), sides[0].q.T2, sides[0].E, sides[1].E, sides[1].q.T2, ...[...right].reverse().slice(0, -1), right[0], ...bottom.slice(-1)];
  const polyA = P2 => Math.abs(P2.reduce((a, p, i) => { const q = P2[(i + 1) % P2.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
  let triArea = 0; for (let t = 0; t < idx.length; t += 3) { const [a, b2, c2] = [V[idx[t]], V[idx[t + 1]], V[idx[t + 2]]]; triArea += Math.abs((b2[0] - a[0]) * (c2[1] - a[1]) - (b2[1] - a[1]) * (c2[0] - a[0])) / 2; }
  const bodyArea = polyA(body), fanArea = [left, right].map((arc, k) => { const X = sides[k].X; let a = 0; for (let j = 0; j + 1 < arc.length; j++) a += Math.abs((arc[j][0] - X[0]) * (arc[j + 1][1] - X[1]) - (arc[j][1] - X[1]) * (arc[j + 1][0] - X[0])) / 2; return a; });
  const inkOf = line => { const ptsL = []; for (let k = 0; k + 1 < line.length; k++) for (let f = 0; f < 1; f += 0.25) ptsL.push([line[k][0] + (line[k + 1][0] - line[k][0]) * f, line[k][1] + (line[k + 1][1] - line[k][1]) * f]); ptsL.push(line[line.length - 1]);
    return ptsL.map(g => { const ll = jp.fromUV(g[0], g[1]); return { lon: ll.lon, lat: ll.lat, alt: heightAt(ll) + 0.06 }; }); };
  return { strip: { name: 'junction ' + jp.node, pos: Float32Array.from(pos), col: Float32Array.from(col), index: Uint32Array.from(idx), vertexCount: pos.length / 3 }, ink: [inkOf([...left, sides[0].E]), inkOf([...right, sides[1].E])], pts, outline, triangles: idx.length / 3,
    coverage: triArea / Math.max(1e-9, bodyArea + fanArea[0] + fanArea[1]), corners: sides.map(q => ({ leg: q.q.leg, corner: q.q.corner, s: q.sT, sX: q.sX })), ends: sides.map(q => q.E), surfaceAt: (lon, lat) => heightAt({ lon, lat }) };
}

// CR01 keeps its swept asphalt across every junction. The connected arms determine only where
// the other road sections end and where the ring's outer section opens for their mouths.
function convexHull(points) {
  const pts = [...new Map(points.map(p => [`${p[0].toFixed(7)},${p[1].toFixed(7)}`, p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), p) <= 1e-10) lower.pop(); lower.push(p); }
  for (const p of pts.slice().reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), p) <= 1e-10) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
const area2 = poly => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
function routePointAt(rt, s) {
  const S = rt.samples, q = Math.max(S[0].s, Math.min(S.at(-1).s, s)); let lo = 0, hi = S.length - 1;
  while (lo + 1 < hi) { const m = (lo + hi) >> 1; if (S[m].s < q) lo = m; else hi = m; }
  const a = S[lo], b = S[hi], t = Math.max(0, Math.min(1, (q - a.s) / Math.max(1e-9, b.s - a.s)));
  return { lon: a.lon + wrap180(b.lon - a.lon) * t, lat: a.lat + (b.lat - a.lat) * t };
}
function cr01JunctionPlan(W, J, byId, RK) {
  const NET = W.roadNetwork, N0 = NET.nodeById[J.node], P = plane(W, N0), flat = p => [R * p.lon * D, -R * Math.asinh(Math.tan(p.lat * D))], incident = NET.edges.filter(e => e.from === J.node || e.to === J.node), routeOf = new Map();
  for (const def of ROUTES) for (const sg of def.segs) routeOf.set(sg.id, def.id);
  const arms = incident.map(e => {
    const routeId = routeOf.get(e.id), rt = byId[routeId], sgAt = rt && rt.def.segs.find(q => q.id === e.id);
    if (!rt || !sgAt) throw new Error(`CR01 junction ${J.node}: no swept route for ${e.id}`);
    const isStart = routeNode(NET, sgAt, 'start') === J.node, isEnd = routeNode(NET, sgAt, 'end') === J.node;
    if (isStart === isEnd) throw new Error(`CR01 junction ${J.node}: ${e.id} is not a route endpoint at the node`);
    let off = 0, nodeS = null;
    for (const sg of rt.def.segs) { const edge = NET.edges.find(q => q.id === sg.id), len = NET.edgeLength(edge); if (sg.id === e.id) nodeS = off + (isStart ? 0 : len); off += len; }
    const classPavedHalf = Math.max(...RK.PROFILES[e.class].paved.map(Math.abs)), dir = isStart ? 1 : -1;
    // At a town exit the class blend can widen the actual paved mouth. Use its paved row at
    // the node; ditch and verge widths are handled separately only where they enter CR01.
    const near = rt.samples.reduce((best, p, i) => Math.abs(p.s - nodeS) < best.d ? { d: Math.abs(p.s - nodeS), i } : best, { d: Infinity, i: 0 }).i,
      sweptPavedHalf = Math.max(...rt.paved[near].map(Math.abs));
    return { edgeId: e.id, routeId, class: e.class, half: Math.max(classPavedHalf, sweptPavedHalf), nodeS, dir, edgeLength: NET.edgeLength(e), route: rt };
  });
  if (arms.length < 3) throw new Error(`CR01 junction ${J.node}: expected at least three connected arms, found ${arms.length}`);
  const armsWithReach = arms.map(a => ({ ...a, reach: Math.max(...arms.filter(b => b !== a).map(b => b.half)) + 0.25 }));
  const verticesUV = [];
  for (const a of armsWithReach) {
    const q = P.to(routePointAt(a.route, a.nodeS + a.dir * a.reach)), l = Math.hypot(q[0], q[1]) || 1, d = [q[0] / l, q[1] / l], n = [-d[1], d[0]];
    for (const side of [-1, 1]) verticesUV.push([q[0] + n[0] * a.half * side, q[1] + n[1] * a.half * side]);
  }
  const polygon = convexHull(verticesUV.map(q => flat(P.from(q))));
  if (polygon.length < 4 || Math.abs(area2(polygon)) < 1) throw new Error(`CR01 junction ${J.node}: invalid junction bounds`);
  const routes = [...new Set(arms.map(a => a.routeId))], edgeIds = arms.map(a => a.edgeId), xs = polygon.map(p => p[0]), zs = polygon.map(p => p[1]);
  return { ...J, kind: 'CR01', arms: armsWithReach.map(({ edgeId, routeId, class: cls, half, reach, nodeS, dir, edgeLength }) => ({ edgeId, routeId, class: cls, half, reach, nodeS, dir, edgeLength })), edgeIds, routes,
    polygon, bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }, area: Math.abs(area2(polygon)) / 2, P, N0 };
}
function pointInConvex(p, poly, tolerance = 1e-8) {
  const sign = area2(poly) >= 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], c = ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * sign; if (c < -tolerance) return false; }
  return true;
}
function pointSegmentDistance(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-12, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
}
function polygonDistance(p, poly) { if (pointInConvex(p, poly)) return 0; let d = Infinity; for (let i = 0; i < poly.length; i++) d = Math.min(d, pointSegmentDistance(p, poly[i], poly[(i + 1) % poly.length])); return d; }
function clipHalf(poly, a, b, sign, inside) {
  if (!poly.length) return [];
  const val = p => ((b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * sign,
    keeps = v => inside ? v >= -1e-9 : v <= 1e-9, out = [];
  let prev = poly.at(-1), vp = val(prev), pin = keeps(vp);
  for (const cur of poly) {
    const vc = val(cur), cin = keeps(vc);
    if (cin !== pin) { const t = vp / (vp - vc); out.push(prev.map((v, k) => v + (cur[k] - v) * t)); }
    if (cin) out.push(cur);
    prev = cur; vp = vc; pin = cin;
  }
  const clean = [];
  for (const p of out) if (!clean.length || Math.hypot(p[0] - clean.at(-1)[0], p[2] - clean.at(-1)[2]) > 1e-8) clean.push(p);
  if (clean.length > 2 && Math.hypot(clean[0][0] - clean.at(-1)[0], clean[0][2] - clean.at(-1)[2]) < 1e-8) clean.pop();
  return clean;
}
function clipToConvex(poly, clip, keepInside = true) {
  let out = poly, sign = area2(clip) >= 0 ? 1 : -1;
  for (let i = 0; i < clip.length && out.length; i++) out = clipHalf(out, clip[i], clip[(i + 1) % clip.length], sign, keepInside);
  return out;
}
function polyArea(poly) { return poly.length < 3 ? 0 : Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length], py = p.length > 2 ? p[2] : p[1], qy = q.length > 2 ? q[2] : q[1]; return s + p[0] * qy - q[0] * py; }, 0)) / 2; }
function clipStripOutside(st, polygon, shouldClip = () => true) {
  const pos = Array.from(st.pos), col = Array.from(st.col), indices = [], original = st.index, bb = {
    minX: Math.min(...polygon.map(p => p[0])), maxX: Math.max(...polygon.map(p => p[0])),
    minZ: Math.min(...polygon.map(p => p[1])), maxZ: Math.max(...polygon.map(p => p[1])),
  }, sign = area2(polygon) >= 0 ? 1 : -1;
  const offsets = st.clipOffset ? Array.from(st.clipOffset) : null;
  const read = k => [st.pos[k * 3], st.pos[k * 3 + 1], st.pos[k * 3 + 2], st.col[k * 3], st.col[k * 3 + 1], st.col[k * 3 + 2], offsets ? offsets[k] : 0],
    add = v => { const i = pos.length / 3; pos.push(v[0], v[1], v[2]); col.push(v[3], v[4], v[5]); if (offsets) offsets.push(v[6]); return i; };
  let removedArea = 0, clippedTriangles = 0, removedTriangles = 0;
  for (let t = 0; t < original.length; t += 3) {
    const ids = [original[t], original[t + 1], original[t + 2]], p0 = ids[0] * 3, p1 = ids[1] * 3, p2 = ids[2] * 3,
      minX = Math.min(st.pos[p0], st.pos[p1], st.pos[p2]), maxX = Math.max(st.pos[p0], st.pos[p1], st.pos[p2]),
      minZ = Math.min(st.pos[p0 + 2], st.pos[p1 + 2], st.pos[p2 + 2]), maxZ = Math.max(st.pos[p0 + 2], st.pos[p1 + 2], st.pos[p2 + 2]);
    if (maxX < bb.minX - 1e-7 || minX > bb.maxX + 1e-7 || maxZ < bb.minZ - 1e-7 || minZ > bb.maxZ + 1e-7) { indices.push(...ids); continue; }
    const tri = ids.map(read);
    if (!shouldClip(ids, tri)) { indices.push(...ids); continue; }
    const inside = clipToConvex(tri, polygon), overlap = polyArea(inside);
    if (overlap <= 1e-9) { indices.push(...ids); continue; }
    removedArea += overlap; clippedTriangles++;
    if (overlap >= polyArea(tri) - 1e-9) { removedTriangles++; continue; }
    let candidates = [tri], outside = [];
    for (let e = 0; e < polygon.length && candidates.length; e++) {
      const next = [];
      for (const p of candidates) {
        const qIn = clipHalf(p, polygon[e], polygon[(e + 1) % polygon.length], sign, true), qOut = clipHalf(p, polygon[e], polygon[(e + 1) % polygon.length], sign, false);
        if (polyArea(qOut) > 1e-10) outside.push(qOut); if (polyArea(qIn) > 1e-10) next.push(qIn);
      }
      candidates = next;
    }
    for (const p of outside) { const base = p.map(add); for (let k = 1; k + 1 < base.length; k++) {
      const a = base[0], b = base[k], c = base[k + 1], ax = Math.fround(pos[a * 3]), az = Math.fround(pos[a * 3 + 2]), bx = Math.fround(pos[b * 3]), bz = Math.fround(pos[b * 3 + 2]), cx = Math.fround(pos[c * 3]), cz = Math.fround(pos[c * 3 + 2]), area2 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
      if (Math.abs(area2) > 1e-7) indices.push(a, b, c);
    } }
  }
  st.pos = Float32Array.from(pos); st.col = Float32Array.from(col); st.index = Uint32Array.from(indices); st.vertexCount = st.pos.length / 3;
  if (offsets) st.clipOffset = Float32Array.from(offsets);
  return { clippedTriangles, removedTriangles, removedArea, before: original.length / 3, after: indices.length / 3 };
}
const INSTANCE_CLEARANCE = { weed: 0.8, tuft: 0.8, lampPool: 1.6, lamp: 1.0, lampSmall: 1.0, pole: 0.8, signBus: 0.8, busBench: 1.2, mirror: 0.7, vending: 1.0, jizo: 0.8, lantern: 0.6, stonePost: 0.6, bollard: 0.5, barrierConcrete: 0.75, gatePost: 0.5, snowPole: 0.45 };
function clearJunctionInstances(rt, junctions, ring) {
  const removed = [];
  const ringConflict = (p, radius) => {
    if (!ring || rt.def.id === 'CR01' || !junctions.some(j => polygonDistance(p, j.polygon) <= 18)) return null;
    const lon = p[0] / (R * D), lat = Math.atan(Math.sinh(-p[1] / R)) / D, pr = project(ring, lon, lat); if (!pr) return null;
    const nearest = junctions.map(j => { const a = j.arms.filter(q => q.routeId === 'CR01').reduce((best, q) => Math.abs(q.nodeS - pr.s) < best.d ? { d: Math.abs(q.nodeS - pr.s), s: q.nodeS } : best, { d: Infinity, s: 0 }), delta = Math.abs(a.s - pr.s); return { node: j.node, d: Math.min(delta, Math.max(0, ring.length - delta)), s: a.s }; }).sort((a, b) => a.d - b.d)[0];
    if (!nearest || nearest.d > 18) return null;
    const q = atS(ring, pr.s), bounds = ring.carriageway[q.i].map((v, side) => v + (ring.carriageway[q.i + 1][side] - v) * q.t);
    return pr.o >= bounds[0] - radius && pr.o <= bounds[1] + radius ? nearest.node : null;
  };
  for (const [type, list] of Object.entries(rt.instances || {})) {
    const radius = INSTANCE_CLEARANCE[type] ?? 0.6, keep = [];
    for (const it of list) {
      const p = [R * it.lon * D, -R * Math.asinh(Math.tan(it.lat * D))], jp = junctions.find(q => polygonDistance(p, q.polygon) <= radius), ringNode = jp ? null : ringConflict(p, radius);
      if (!jp && !ringNode) { keep.push(it); continue; }
      removed.push({ node: jp ? jp.node : ringNode, type, station: it.station === undefined ? null : it.station, x: p[0], z: p[1], clearance: radius });
    }
    rt.instances[type] = keep;
  }
  const lampKeep = [], lampRemoved = [];
  for (const l of rt.lamps || []) {
    const i = Math.max(0, Math.min(rt.samples.length - 1, l.i)), p = rt.samples[i], [lon, lat] = rt.lateral(i, 3.15 * l.side), q = [R * lon * D, -R * Math.asinh(Math.tan(lat * D))], center = [R * p.lon * D, -R * Math.asinh(Math.tan(p.lat * D))], jp = junctions.find(j => polygonDistance(center, j.polygon) <= 3.5), ringNode = jp ? null : ringConflict(q, 1.0);
    if (jp || ringNode) lampRemoved.push({ node: jp ? jp.node : ringNode, station: l.s, zone: l.zone, side: l.side }); else lampKeep.push(l);
  }
  rt.lamps = lampKeep; rt.junctionLampRemovals = [...(rt.junctionLampRemovals || []), ...lampRemoved];
  return removed;
}
function prepareCr01Junctions(W, routes, RK) {
  const byId = Object.fromEntries(routes.map(rt => [rt.def.id, rt])), plans = CR01_JUNCTIONS.map(j => cr01JunctionPlan(W, j, byId, RK)), ring = byId.CR01;
  ring.strip.clipOffset = Float32Array.from({ length: ring.strip.vertexCount }, (_, id) => ring.grid[id % ring.grid.length]);
  const flat = ([lon, lat]) => [R * lon * D, -R * Math.asinh(Math.tan(lat * D))];
  const corridor = (rt, s0, s1, half) => {
    const corners = [];
    const limits = Array.isArray(half) ? half : [-half, half];
    for (let s = s0; s <= s1 + 1e-6; s += 0.5) for (const offset of limits) corners.push(flat(latS(rt, Math.min(s, s1), offset)));
    for (const offset of limits) corners.push(flat(latS(rt, s1, offset)));
    return convexHull(corners);
  };
  const draw = plans.map(jp => {
    const ringS = jp.arms.find(a => a.routeId === 'CR01').nodeS,
      reach = Math.max(...jp.arms.filter(a => a.routeId !== 'CR01').map(a => byId[a.routeId].grid.at(-1) - byId[a.routeId].grid[0])) / 2 + 2,
      band = corridor(ring, Math.max(0, ringS - reach), Math.min(ring.length, ringS + reach), [-2.25, 2.75]);
    return { kind: 'CR01', node: jp.node, paving: 'continuous-asphalt', polygon: jp.polygon, bounds: jp.bounds, area: jp.area,
      edges: jp.edgeIds, routes: jp.routes, arms: jp.arms, ringBand: band, strip: { index: new Uint32Array(0) },
      coverage: 1, ink: [], cuts: [], mouths: [], removedInstances: [] };
  });
  for (const jp of plans) {
    const j = draw.find(q => q.node === jp.node);
    for (const routeId of jp.routes.filter(id => id !== 'CR01')) {
      const rt = byId[routeId], clipped = clipStripOutside(rt.strip, j.ringBand);
      j.cuts.push({ routeId, part: 'ring asphalt', ...clipped });
    }
    for (const arm of jp.arms.filter(a => a.routeId !== 'CR01')) {
      const rt = byId[arm.routeId],
        s1 = Math.max(0, Math.min(rt.length, arm.nodeS + arm.dir * 5)),
        widths = rt.samples.flatMap((p, i) => (p.s - arm.nodeS) * arm.dir >= -1e-6 && (p.s - arm.nodeS) * arm.dir <= 5 + 1e-6 ? [Math.min(-rt.paved[i][0], rt.paved[i][1])] : []),
        mouthHalf = Math.min(arm.half, ...widths), mouth = corridor(rt, Math.min(arm.nodeS, s1), Math.max(arm.nodeS, s1), mouthHalf);
      j.mouths.push({ edgeId: arm.edgeId, polygon: mouth });
      const clipped = clipStripOutside(ring.strip, mouth, (ids, tri) => {
        const offsets = tri.map(v => v[6]);
        return offsets.every(o => o <= -2.25 + 1e-6) || offsets.every(o => o >= 2.75 - 1e-6);
      });
      j.cuts.push({ routeId: 'CR01', edgeId: arm.edgeId, part: 'outer section', ...clipped });
    }
  }
  for (const rt of routes) {
    const removed = clearJunctionInstances(rt, draw, byId.CR01);
    for (const q of removed) draw.find(j => j.node === q.node).removedInstances.push({ routeId: rt.def.id, ...q });
  }
  return draw;
}

// abutment end wall: a vertical concrete curtain under the road's last cross-section, from its surface down to below the girder (|o| <= 5) or into the terrain (the embankment's
// end), facing the bridge: it closes the box girder's open end and the end of the approach's fill above the terrain
function abutWall(W, rt, ab, deckAlt) {
  const i = ab.rEnd === 'end' ? rt.samples.length - 1 : 0, m = rt.grid.length, st = rt.strip, pos = [], col = [], idx = [], dir = ab.rEnd === 'end' ? rt.tangent[i] : [-rt.tangent[i][0], -rt.tangent[i][1]];
  const c0 = lin('#7c828c'), c1 = lin('#5f6672');
  for (let j = 0; j < m; j++) {
    const a = (i * m + j) * 3, oo = rt.grid[j], [lo, la] = rt.lateral(i, oo * rt.cf[i]), top = rt.colAlt[i * m + j], g = W.height(lo, la), bot = Math.min(top - 0.05, Math.abs(oo) <= 5.0 ? deckAlt - 1.85 : g - 0.3), k = 1 / Math.cos(la * D);
    pos.push(st.pos[a], (top - 0.03 - BASE) * k, st.pos[a + 2], st.pos[a], (bot - BASE) * k, st.pos[a + 2]);      // 3 cm under the surface: no depth fight along the joint
    const f = 0.88 + 0.2 * hash(oo * 3.1, i); col.push(...c0.map(v => v * f), ...c1.map(v => v * f));
  }
  for (let j = 0; j + 1 < m; j++) { const a = 2 * j, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, c, b, d); }
  for (let t = 0; t < idx.length; t += 3) { const A = idx[t] * 3, B = idx[t + 1] * 3, Cc = idx[t + 2] * 3, ux = pos[B] - pos[A], uy = pos[B + 1] - pos[A + 1], uz = pos[B + 2] - pos[A + 2], vx = pos[Cc] - pos[A], vy = pos[Cc + 1] - pos[A + 1], vz = pos[Cc + 2] - pos[A + 2];
    const nx = uy * vz - uz * vy, nz = ux * vy - uy * vx; if (nx * dir[0] + nz * dir[1] < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; } }
  return { name: 'abutment wall ' + ab.node, pos: Float32Array.from(pos), col: Float32Array.from(col), index: Uint32Array.from(idx), vertexCount: pos.length / 3, normals: true };
}

// W8f-a: the abutments, the ring's chainage and the junction layout come first (the trunks' mouths and the branches' trims are known before any road is swept).
// Each plan depends only on its own junction and the frozen road network.
function routeContext(WS, junctions = JUNCTIONS, routeIds) {
  const RK = global.ROADKIT, BR = global.BRIDGE, lm09Turn = nodeTurn(WS, ROUTES.find(r => r.id === 'N01-west').segs, 'LM09-north');
  return { AB: abutments(WS, BR, routeIds), CH: ringChain(WS), lm09Turn, JP: junctions.map(J => junctionPlan(WS, J, RK)) };
}
// the options of a route
function routeOpts(def, ctx, tc) {
  const RK = global.ROADKIT, { AB, CH, lm09Turn, JP } = ctx, o = { ...def.opts, terrainColor: tc };
  if (CH[def.id]) o.chain = CH[def.id];
  if (def.id === 'N01-west') o.turns = [lm09Turn];
  for (const a of AB.filter(q => q.route === def.id)) (o.abut = o.abut || {})[a.rEnd] = { at: a.fillet.at, T: a.fillet.Ta, brg: a.fillet.brg, grade: a.grade };
  const ownAbuts = AB.filter(q => q.route === def.id);
  if (ownAbuts.length) {
    const cols = Object.values(RK.PROFILES).flatMap(p => p.pts.map(q => Math.abs(q[0]))).filter(x => x <= 5 + 1e-9);
    cols.push(0.075, 0.1, 0.3, 0.6, 1, 2, 3.6, 4.7, 4.8);
    o.abutGrid = [...new Set(cols.flatMap(x => [-x, x]))];
  }
  const mo = JP.filter(j => j.trunk === def.id).map(j => j.mouth); if (mo.length) o.mouths = mo;
  const jb = JP.find(j => j.branch === def.id);
  // The six town exits include a short connector between the frozen town boundary and CR01.
  // Keep that connector in the same route so its class blend and junction ramp happen outside
  // the town; trimming it to the junction fan moved the ramp onto the town boundary row.
  if (jb && !jb.shallowMerge && !def.exit) { if (jb.branchEnd === 'end') o.trimEnd = Math.max(o.trimEnd || 0, jb.lamEnd); else o.trimStart = Math.max(o.trimStart || 0, jb.lamEnd); }
  return o;
}
// branches: their last row is lifted to the paving (the trunk's surface + PAVE_LIFT); the change fades over 3-8 m (<= 6 % of extra grade)
const branchRamp = (jp, trunk) => ({ end: jp.branchEnd, len: jp.shallowMerge ? jp.mergeLength : d => Math.max(3, Math.min(8, d / 0.06)), target: (lo, la) => { const pr = project(trunk, lo, la, jp.sJ); return pr ? surfS(trunk, pr.s, pr.o) + PAVE_LIFT : null; } });
function* planSteps(W, H, tc) {
  const WS = Object.assign(Object.create(W), { height: H }), RK = global.ROADKIT, BR = global.BRIDGE;
  const ctx = routeContext(WS), { AB, CH, lm09Turn, JP } = ctx,
    bridgeTurnDefs = { 'RN01-07+08+09': ['J-P1', 'J-LM08'].map(node => nodeTurn(WS, BRIDGES.find(b => b.id === 'RN01-07+08+09').ids.map(id => ({ id })), node)) };
  void lm09Turn;
  yield;
  const optsOf = def => routeOpts(def, ctx, tc);
  const byId = {}, branchOf = def => JP.find(j => j.branch === def.id);
  for (const def of ROUTES.filter(d => !branchOf(d))) { const rt = RK.route(WS, def.segs, optsOf(def)); rt.def = def; rt.mouths = JP.filter(j => j.trunk === def.id).map(j => j.mouth); byId[def.id] = rt; yield; }
  for (const def of ROUTES.filter(branchOf)) {
    const jp = branchOf(def), trunk = byId[jp.trunk], o = optsOf(def);
    o.ramp = branchRamp(jp, trunk);
    const rt = RK.route(WS, def.segs, o); rt.def = def; byId[def.id] = rt;
    yield;
  }
  const routes = ROUTES.map(def => byId[def.id]);
  for (const rt of routes) if (rt.def.furnish) furnish(WS, rt, rt.def.furnish);
  const cr01Junctions = prepareCr01Junctions(WS, routes, RK);
  yield;
  // bridges: their ends on the shared fillets, starting at the approaches' altitude
  const bridges = BRIDGES.map(def => {
    const o = { ...def, chain: CH[def.id], abut: {} };
    if (bridgeTurnDefs[def.id]) o.turns = bridgeTurnDefs[def.id];
    const bridgeAbuts = AB.filter(q => q.bridge === def.id);
    for (const a of bridgeAbuts) { o.abut[a.bEnd] = { at: a.fillet.at, T: a.fillet.Tb, brg: a.fillet.brg }; o[a.bEnd === 'start' ? 'startAlt' : 'endAlt'] = byId[a.route].approaches.find(q => q.which === a.rEnd).alt; }
    o.jointColumns = bridgeAbuts.length ? Object.values(RK.PROFILES).flatMap(p => p.pts.map(q => Math.abs(q[0]))).filter(x => x <= 5 + 1e-9).flatMap(x => [-x, x]).concat([-0.075, 0, 0.075, -0.3, 0.3, -0.6, 0.6, -1, 1, -2, 2, -3.6, 3.6, -4.7, 4.7, -4.8, 4.8]) : [];
    const b = BR.build(WS, def.ids, o); b.def = def; return b;
  });
  yield;
  // the road's last cross-section takes the deck's first one vertex by vertex (|o| <= 5 m: the same offsets on both, mirrored where the two run against each other;
  // a deck laid out one circumference east of the road, RN01-07+08+09 at J-W3, is moved back by it: bend.js shifts the road there by the same amount)
  // shifted(x, k): the float32 value v k circumferences away from x such that the shader's float32 sum v - k * PERIOD (bend.js, exact for its uniform) is x again, bit for bit
  const shifted = (x, k) => { const P = Math.fround(2 * Math.PI * R), want = Math.fround(x), v0 = Math.fround(x + k * P), ulp = Math.abs(Math.fround(v0 * (1 + 2 ** -23)) - v0) || 1e-7;
    for (let q = 0; q <= 8; q++) for (const sg of [1, -1]) { const v = Math.fround(v0 + sg * q * ulp); if (Math.fround(v - k * P) === want) return v; } return v0; };
  for (const a of AB) {
    const rt = byId[a.route], b = bridges.find(q => q.def.id === a.bridge), m = rt.grid.length, iR = a.rEnd === 'end' ? rt.samples.length - 1 : 0, iB = a.bEnd === 'start' ? 0 : b.samples.length - 1, flip = a.rEnd === a.bEnd, tc = b.topCols, top = b.strips[0], P2 = 2 * Math.PI * R;
    rt.grid.forEach((o, j) => { if (Math.abs(o) > 5 + 1e-9) return; const jb = tc.findIndex(q => Math.abs(q - (flip ? -o : o)) < 1e-6); if (jb < 0) return; const s2 = (iB * tc.length + jb) * 3, d = (iR * m + j) * 3;
      const k = Math.round((rt.strip.pos[d] - top.pos[s2]) / P2); rt.strip.pos[d] = k ? shifted(top.pos[s2], k) : top.pos[s2]; rt.strip.pos[d + 1] = top.pos[s2 + 1]; rt.strip.pos[d + 2] = top.pos[s2 + 2]; });
  }
  const abuts = AB.map(a => { const rt = byId[a.route], ap = rt.approaches.find(q => q.which === a.rEnd); return { ...a, approach: ap, wall: abutWall(WS, rt, a, ap.alt) }; });
  const junctions = [...cr01Junctions, ...JP.map(jp => jp.shallowMerge ? jp : ({ ...jp, ...paving(WS, jp, byId[jp.trunk], byId[jp.branch]) }))];
  // Crossings share their road surface directly. A raised round pad here obscures the frozen crosswalks and creates a second material/height over the road.
  // lit polylines for the light band: RD01 along the bed (with a gap in the tunnel), RD02 along the deck; the sea parts for the reflections
  const lit = [], sea = [];
  for (const rt of routes) { if (!(rt.lamps && rt.lamps.length)) continue; let cur = []; rt.samples.forEach((p, i) => { if (p.span === 'tunnel') { if (cur.length > 1) lit.push(cur); cur = []; } else cur.push({ lon: p.lon, lat: p.lat, alt: rt.bed[i] }); }); if (cur.length > 1) lit.push(cur); }
  for (const b of bridges) { lit.push(b.samples.map((p, i) => ({ lon: p.lon, lat: p.lat, alt: b.alt[i] }))); let cur = []; b.samples.forEach((p, i) => { if (p.h < -0.2) cur.push({ lon: p.lon, lat: p.lat, alt: 0.03 }); else { if (cur.length > 1) sea.push(cur); cur = []; } }); if (cur.length > 1) sea.push(cur); }
  const stairs = STAIRS.map(id => global.STEPS.build(WS, id));
  // RN11-01 is the W4 shore boardwalk. Draw it in the unified network; section.js keeps only its fields and water.
  const extras = [RK.build(WS, 'RN11-01')];
  // closures at the landmark entrances: two guide posts across the end of the road that reaches the entrance (W5-C7); the entrance of LM04 belongs to the W4 section
  const markers = [], items = [...routes.map(rt => ({ kind: 'route', rt, hw: rt.def.furnish && rt.def.furnish.kind === 'RD05' ? 1.5 : rt.def.furnish && rt.def.furnish.kind === 'RD08' ? 1.0 : rt.def.furnish && rt.def.furnish.kind === 'RD03' ? 2.25 : 4.5 })), ...stairs.map(st => ({ kind: 'stairs', rt: st, hw: 0.8 }))];
  for (const nd of W.roadNetwork.nodes.filter(q => q.kind === 'landmark-entrance')) {
    let best = null; for (const it of items) { const S = it.rt.samples; for (const i of [0, S.length - 1, ...(it.kind === 'route' ? S.map((_, j) => j) : [])]) { const d = global.WORLD ? 0 : 0; void d; const dd = W.arcDistance(S[i], nd); if (dd < 0.4 && (!best || dd < best.d)) best = { d: dd, it, i }; } }
    if (!best && nd.id === 'LM09-north') {
      for (const it of items.filter(q => q.kind === 'route')) { const S = it.rt.samples; for (let i = 0; i < S.length; i++) { const dd = W.arcDistance(S[i], nd); if (dd <= 1.0 && (!best || dd < best.d)) best = { d: dd, it, i }; } }
    }
    if (!best) continue;
    const { it, i } = best, T = it.rt.tangent, yaw = Math.atan2(T[i][0], T[i][1]);
    for (const sd of [-1, 1]) { const [lo, la] = it.rt.lateral(i, sd * (it.hw + 0.75)); markers.push({ type: 'gatePost', lon: lo, lat: la, alt: (it.rt.surface ? it.rt.surface(i, sd * (it.hw + 0.75)) : WS.height(lo, la)), yaw, s: [1, 1, 1], lean: [0, 0], tint: [1, 1, 1], node: nd.id }); }
  }
  return { routes, bridges, stairs, extras, markers, lit, sea, WS, abutments: abuts, junctions };
}
function plan(W, H, tc) { const it = planSteps(W, H, tc); for (;;) { const r = it.next(); if (r.done) return r.value; } }

const ROADS = { plan, planSteps, routeContext, routeOpts, furnish, ROUTES, STAIRS, BRIDGES, SPACING, NAV_PERIOD, JUNCTIONS: [...CR01_JUNCTIONS, ...JUNCTIONS], RING_JUNCTIONS: CR01_JUNCTIONS, RING, FILLET_T, FILLET_E, PAVE_LIFT, transition, plane, project, atS, latS, surfS };

// ---------------------------------------------------------------- scene part
ROADS.attach = function (scene, ctx, BEND, TERR, SEC) {
  const THREE = global.THREE, W = global.WORLD;
  const S = { built: false, stats: {}, root: null, band: null, nav: [], ink: {}, puddleWeight: 1 };
  const objs = { inst: [], hulls: [], glows: [], strips: [], lines: { aerial: [], bridge: [], near: [] }, nav: null };
  const tintC = new THREE.Color(), qE = new THREE.Euler(), qQ = new THREE.Quaternion(), mP = new THREE.Vector3(), mS = new THREE.Vector3(), mM = new THREE.Matrix4();
  const flatOf = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) });
  const matrixOfAlt = it => { const f = flatOf(it.lon, it.lat); qE.set(it.lean[0], it.yaw, it.lean[1], 'YXZ'); qQ.setFromEuler(qE); mM.compose(mP.set(f.x, (it.alt - BASE) * f.k, f.z), qQ, mS.set(f.k * it.s[0], f.k * it.s[1], f.k * it.s[2])); return mM.clone(); };
  let DATA = null;

  // W8g-a: a stepped build (TERRAIN.job); the root stays hidden until the last step, which leaves it visible as the single-call build did
  function* build() {
    const K = SEC.kit(), M = SEC.state.materials, H = TERR.sampler();
    const TB = TERR.builder || global.TERRAIN.builder(W); DATA = yield* planSteps(W, H, (lo, la) => TB.vertexColor(lo, la)); S.data = DATA;
    S.terrainCut = TERR.cutRoads ? TERR.cutRoads(DATA) : null;
    const plotGrounds = []; SEC.state.root.traverse(o => { if (o.isMesh && o.name === 'sec:plots') plotGrounds.push(o); });
    S.plotCut = TERR.cutGroundMeshes ? TERR.cutGroundMeshes(plotGrounds) : null;
    const root = new THREE.Group(); root.name = 'roads'; root.visible = false; scene.add(root); S.root = root;
    const townDetails = ctx.buildTownRoadDetails ? ctx.buildTownRoadDetails(root) : { puddles: [] };
    const townPuddles = townDetails.puddles || [];
    S.townDetails = townDetails; S.townPuddles = townPuddles;
    const inkColor = 0x273647;
    const bridgeMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp });
    const navMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const poolMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    { // lamp light pool: a disc that fades from warm amber at the foot of the lamp to black (additive, so black adds nothing)
      const radii = [0, 1.1, 2.2, 3.4], lum = [0.2, 0.12, 0.05, 0], seg = 24, pos = [], col = [], idx = [], amber = new THREE.Color('#ffc27a');
      radii.forEach((r, ri) => { for (let a = 0; a < (ri ? seg : 1); a++) { const th = a / seg * Math.PI * 2; pos.push(Math.cos(th) * r, 0.03, Math.sin(th) * r); col.push(amber.r * lum[ri], amber.g * lum[ri], amber.b * lum[ri]); } });
      for (let a = 0; a < seg; a++) idx.push(0, 1 + (a + 1) % seg, 1 + a);
      for (let ri = 1; ri < 3; ri++) for (let a = 0; a < seg; a++) { const o0 = 1 + (ri - 1) * seg, o1 = 1 + ri * seg, a2 = (a + 1) % seg; idx.push(o0 + a, o0 + a2, o1 + a, o0 + a2, o1 + a2, o1 + a); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); const nrm = new Float32Array(pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setIndex(idx); g.computeBoundingSphere(); S.poolGeo = g; }
    const lineMat = () => new THREE.LineBasicMaterial({ color: inkColor, transparent: true, opacity: 1, fog: false });
    S.materials = { bridgeMat, navMat, poolMat };

    // ---- strips: route surfaces (up normals, ground material) and bridge girder faces (computed normals)
    const stripMesh = (st, mat) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(st.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(st.col, 3)); g.setIndex(new THREE.BufferAttribute(st.index, 1));
      if (st.normal) g.setAttribute('normal', new THREE.BufferAttribute(st.normal, 3));
      else if (st.normals) g.computeVertexNormals(); else { const nrm = new Float32Array(st.pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); }
      g.computeBoundingSphere(); const m = new THREE.Mesh(g, mat); m.name = 'road:' + st.name; m.matrixAutoUpdate = false; root.add(m); objs.strips.push(m); return m;
    };
    for (const rt of DATA.routes) stripMesh({ ...rt.strip, normals: true }, M.groundMat);
    for (const ex of DATA.extras) for (const st of ex.strips) stripMesh(st, bridgeMat);
    for (const b of DATA.bridges) for (const st of b.strips) stripMesh(st, bridgeMat);
    // junction paving and abutment walls, each kind one mesh (one draw call)
    const merge = (name, parts, withUV) => { const pos = [], col = [], uv = [], idx = []; for (const q of parts) { const base = pos.length / 3; for (let k = 0; k < q.pos.length; k++) pos.push(q.pos[k]); for (let k = 0; k < q.col.length; k++) col.push(q.col[k]); if (withUV) for (let k = 0; k < q.pos.length; k += 3) uv.push(q.pos[k] / 4, -q.pos[k + 2] / 4); for (const v of q.index) idx.push(base + v); }
      return { name, pos: Float32Array.from(pos), col: Float32Array.from(col), uv: withUV ? Float32Array.from(uv) : null, index: Uint32Array.from(idx), vertexCount: pos.length / 3, normals: true }; };
    const pavingMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -6 });
    S.materials.pavingMat = pavingMat;
    const junctionPads = DATA.junctions.filter(j => j.strip && j.strip.index.length);
    if (junctionPads.length) stripMesh({ ...merge('junction paving', junctionPads.map(j => j.strip)), normals: false }, pavingMat);      // up normals: an even surface, no facets
    if (DATA.abutments.length) stripMesh(merge('abutment walls', DATA.abutments.map(a => a.wall)), bridgeMat);

    // ---- tunnel (RN01-05): a half-round arch tube along the bed, outer concrete shell, dark inner lining, a portal ring and a black void disc at each end
    for (const rt of DATA.routes) if (rt.tunnel) buildTunnel(rt, root, stripMesh, bridgeMat);

    // ---- instances
    const all = {};
    for (const rt of DATA.routes) for (const [t, list] of Object.entries(rt.instances)) (all[t] = all[t] || []).push(...list.map(it => ({ ...it, m: matrixOfAlt(it) })));
    for (const ex of DATA.extras) for (const [t, list] of Object.entries(ex.instances)) (all[t] = all[t] || []).push(...list.map(it => ({ ...it, m: matrixOfAlt(it) })));
    for (const b of DATA.bridges) for (const [t, list] of Object.entries(b.instances)) (all[t] = all[t] || []).push(...list.map(it => ({ ...it, m: matrixOfAlt(it) })));
    for (const st of DATA.stairs) for (const [t, list] of Object.entries(st.instances)) (all[t] = all[t] || []).push(...list.map(it => ({ ...it, m: matrixOfAlt(it) })));
    (all.gatePost = all.gatePost || []).push(...DATA.markers.map(it => ({ ...it, m: matrixOfAlt(it) })));
    S.counts = {};
    const lanternMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xb89870 }), poleGlowMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xcfe6ff });     // lanterns glow faintly (card: weak warm light); pole reflectors faintly cool
    const GLOW = { lamp: ['lampGlow', M.glowMat], navLight: ['navLightGlow', navMat], lantern: ['lanternGlowOut', lanternMat], vending: ['vendingGlow', M.glowMat], snowPole: ['snowPoleGlow', poleGlowMat] };
    const NOHULL = ['tuft', 'weed', 'lampPool', 'steelStep', 'steelPost'];
    for (const [type, list] of Object.entries(all)) {
      const geo = type === 'lampPool' ? S.poolGeo : K.geometries[type]; if (!geo || !list.length) continue; S.counts[type] = list.length;
      const mat = type === 'lampPool' ? poolMat : M.floraMat;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length); mesh.name = 'road:' + type;
      list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, tintC.setRGB(it.tint[0], it.tint[1], it.tint[2])); });
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); root.add(mesh); objs.inst.push(mesh);
      if (!NOHULL.includes(type)) { const hull = new THREE.InstancedMesh(geo, M.hullMat, list.length); hull.instanceMatrix = mesh.instanceMatrix; hull.count = list.length; hull.computeBoundingSphere(); hull.name = 'road:' + type + ':ink'; root.add(hull); objs.hulls.push(hull); }
      if (GLOW[type]) { const g = new THREE.InstancedMesh(K.geometries[GLOW[type][0]], GLOW[type][1], list.length); g.instanceMatrix = mesh.instanceMatrix; g.computeBoundingSphere(); g.name = 'road:' + type + ':glow'; if (type === 'navLight') { list.forEach((it, i) => g.setColorAt(i, tintC.setRGB(1, 1, 1))); g.instanceColor.needsUpdate = true; objs.nav = g; } root.add(g); objs.glows.push(g); }
    }
    // road puddle ripples (RD01 card, same look as the town's puddles): two rings near each lamp pool, scaled and faded by hand each frame (instanced, additive)
    { const spots = []; for (const rt of DATA.routes) for (const l of (rt.lamps || [])) for (let k = 0; k < 2; k++) { const o = (k ? -1 : 1) * (1.0 + 0.8 * hash(l.s, k)), i = Math.min(rt.samples.length - 1, Math.round((l.s + (k ? -2.2 : 2.0)) / 0.5)), [lo, la] = rt.lateral(i, o); spots.push({ lon: lo, lat: la, alt: rt.surface(i, o) + 0.012, phase: hash(l.s, k + 5) }); }
      for (const b of DATA.bridges) for (const l of b.lamps) for (let k = 0; k < 2; k++) { const o = (k ? -1 : 1) * (1.0 + 0.8 * hash(l.s, k)), i = Math.min(b.samples.length - 1, Math.round((l.s + (k ? -2.2 : 2.0)) / 0.5)), [lo, la] = b.lateral(i, o); spots.push({ lon: lo, lat: la, alt: b.alt[i] + 0.05, phase: hash(l.s, k + 5) }); }
      for (const [i, p] of townPuddles.entries()) for (let k = 0; k < (i % 3 ? 1 : 2); k++) { const dx = (hash(p.x + i, k + 7) - 0.5) * p.rx, dz = (hash(p.z + i, k + 13) - 0.5) * p.rz, q = W.townToLonLat(p.x + dx, p.z + dz); spots.push({ lon: q.lon, lat: q.lat, alt: BASE + p.y + 0.014, phase: hash(p.x + i, p.z + k), scale: Math.max(0.35, Math.min(p.rx, p.rz) * 0.65) }); }
      const rg = new THREE.RingGeometry(0.93, 1, 24); rg.rotateX(-Math.PI / 2);
      const rm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 });
      const mesh = new THREE.InstancedMesh(rg, rm, spots.length); mesh.name = 'road:ripple'; mesh.frustumCulled = false; for (let i = 0; i < spots.length; i++) { mesh.setMatrixAt(i, new THREE.Matrix4()); mesh.setColorAt(i, tintC.setRGB(0, 0, 0)); }
      root.add(mesh); S.ripples = { mesh, spots, mats: spots.map(sp => { const f = flatOf(sp.lon, sp.lat); return { x: f.x, y: (sp.alt - BASE) * f.k, z: f.z, k: f.k * (sp.scale || 1) }; }) }; objs.inst.push(mesh); S.counts.ripple = spots.length; }
    // navigation lights pulse slowly (period 6 s, phase per pier, never below 28 % of full): updated in tick
    S.nav = DATA.bridges.flatMap(b => b.navLights.map(n => n.phase));

    // ---- ink lines: route paved edges (aerial), bridge girder edges, joints and stays (ground and aerial)
    // a line keeps its longitudes continuous (no 360 degree jump where it crosses the date line, W8e-b): bend.js then moves each segment as a whole at the seam
    const poly = (pts, out) => { let prev = null, lon0 = null; for (const q of pts) { const lon = lon0 === null ? q.lon : lon0 + (((q.lon - lon0) % 360 + 540) % 360 - 180); lon0 = lon; const f = flatOf(lon, q.lat), p = [f.x, (q.alt - BASE) * f.k, f.z]; if (prev) out.push(...prev, ...p); prev = p; } };
    const addLines = (layer, segs, color) => { if (!segs.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); g.computeBoundingSphere(); const l = new THREE.LineSegments(g, color ? new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, fog: false }) : lineMat()); l.name = 'road:ink:' + layer; l.matrixAutoUpdate = false; root.add(l); objs.lines[layer].push(l); S.stats['ink_' + layer] = (S.stats['ink_' + layer] || 0) + segs.length / 6; return l; };
    { const segs = []; for (const rt of DATA.routes) { const clip = line => { let run = []; line.forEach((q, i) => { if (rt.samples[i].span === 'tunnel') { if (run.length > 1) poly(run, segs); run = []; } else run.push(q); }); if (run.length > 1) poly(run, segs); }; clip(rt.lines.edgeL); clip(rt.lines.edgeR); }
      for (const j of DATA.junctions) for (const line of (j.ink || [])) poly(line, segs); // shallow merges have no added curb outline
      addLines('aerial', segs); }
    { const segs = [], white = []; for (const b of DATA.bridges) { for (const k of ['edgeL', 'edgeR', 'edgeLU', 'edgeRU']) poly(b.lines[k], segs); for (const j of b.lines.joints) poly(j, segs); for (const st of (b.lines.stays || [])) poly(st, white); }
      addLines('bridge', segs); addLines('bridge', white, 0xe6ebf2); }

    // ---- near-only lines: rope handrails of the stairs, the steel rails of the RN12-01 stair, the wires between the RD03 utility poles
    { const rope = [], rail = [], wire = [], local = [[-0.8, 7.75, 0], [0, 7.75, 0], [0.8, 7.75, 0]];
      for (const st of DATA.stairs) for (const line of st.ropeSegments) poly(line, rope);
      for (const b of DATA.bridges) for (const line of (b.stairRails || [])) poly(line, rail);
      for (const rt of DATA.routes) { const ps = rt.poles || []; for (let a = 0; a + 1 < ps.length; a++) { const A = ps[a].rec, B = ps[a + 1].rec, MA = matrixOfAlt(A), MB = matrixOfAlt(B), kA = flatOf(A.lon, A.lat).k, sag = 0.5 + 0.5 * hash(a + 1, rt.length); for (let c = 0; c < 3; c++) { const pa = new THREE.Vector3(...local[c]).applyMatrix4(MA), pb = new THREE.Vector3(...local[c]).applyMatrix4(MB); let prev = null; for (let nn = 0; nn <= 10; nn++) { const t = nn / 10, p = [pa.x + (pb.x - pa.x) * t, pa.y + (pb.y - pa.y) * t - sag * 4 * t * (1 - t) * kA, pa.z + (pb.z - pa.z) * t]; if (prev) wire.push(...prev, ...p); prev = p; } } } }
      const addNear = (segs, color, op) => { if (!segs.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); g.computeBoundingSphere(); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, fog: false })); l.name = 'road:near-line'; l.matrixAutoUpdate = false; root.add(l); objs.lines.near.push(l); };
      addNear(rope, 0xb59a74, 0.95); addNear(rail, 0xaeb7c4, 0.95); addNear(wire, 0x1f2a38, 0.9); S.stats.wireSegments = wire.length / 6; }
    { const segs = []; for (const st of DATA.stairs) { poly(st.lines.edgeL, segs); poly(st.lines.edgeR, segs); } addLines('aerial', segs); }


    // ---- light band (RD01, RD02 and RD03 routes), with dots for the lanterns of the stairs and the small lamps of the boardwalk and the maintenance stair
    const dots = []; for (const st of DATA.stairs) for (const l of st.lanterns) dots.push({ lon: l.lon, lat: l.lat, alt: l.alt + 0.6 });
    for (const rec of DATA.extras.flatMap(r => r.instances.lampSmall || [])) dots.push({ lon: rec.lon, lat: rec.lat, alt: rec.alt + 1.2 });
    for (const b of DATA.bridges) for (const rec of (b.instances.lampSmall || [])) dots.push({ lon: rec.lon, lat: rec.lat, alt: rec.alt + 1.2 });
    const SHOW_CONTINUOUS_LIGHTBAND = false; // Temporarily hide the core/sea ribbons; keep discrete lamps.
    S.band = global.LIGHTBAND.make(THREE, root); S.band.build(SHOW_CONTINUOUS_LIGHTBAND ? DATA.lit : [], SHOW_CONTINUOUS_LIGHTBAND ? DATA.sea : [], dots); S.dots = dots.length;
    if (BEND.seamSplit) BEND.seamSplit(root);                       // W8e-b: the RN01-13 deck faces, its ink and the band are cut where the seam crosses the bridge
    root.visible = true; S.built = true;
    return root;
  }
  const job = global.TERRAIN.job(build, ms => { S.stats.buildMs = ms; });

  function buildTunnel(rt, root, stripMesh, mat) {
    const tn = rt.tunnel, idx = tn.idx, F = rt.flatOf, T = rt.tangent, n = idx.length;
    const arc = 12, prof = [];                                              // inner profile: wall up, then the half-round arch over (o, dy)
    prof.push([-tn.innerR, 0]); prof.push([-tn.innerR, tn.wallH]);
    for (let a = 1; a < arc; a++) { const th = Math.PI - Math.PI * a / arc; prof.push([tn.innerR * Math.cos(th), tn.wallH + tn.innerR * Math.sin(th)]); }
    prof.push([tn.innerR, tn.wallH]); prof.push([tn.innerR, 0]);
    const mk = (name, scale, color, inward) => {
      const m = prof.length, pos = [], col = [], ix = [], c0 = new THREE.Color(color);
      idx.forEach(i => { const k = F[i].k; prof.forEach(([o, dy], j) => { const ro = o * scale, ry = tn.wallH + (dy - tn.wallH) * scale + (scale > 1 ? 0 : 0); const jit = 0.9 + 0.2 * hash(rt.samples[i].s * 3, j); pos.push(F[i].x + (-T[i][1]) * ro * k, (rt.bed[i] + ry - BASE) * k, F[i].z + T[i][0] * ro * k); col.push(c0.r * jit, c0.g * jit, c0.b * jit); }); });
      for (let i = 0; i + 1 < n; i++) for (let j = 0; j + 1 < m; j++) { const a = i * m + j, b = a + 1, c = a + m, d = c + 1; ix.push(a, c, b, b, c, d); }
      // face toward the axis (inner lining) or away from it (outer shell): flip the winding by the sign of the normal against the direction to the centre line
      for (let t = 0; t < ix.length; t += 3) { const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]; const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const i = Math.floor(ix[t] / m), j = ix[t] % m; const q = prof[j], cx = (idx[i] >= 0 ? F[idx[i]].x : 0); void cx; const ox = (-T[idx[i]][1]) * q[0], oz = T[idx[i]][0] * q[0], oy = q[1] - tn.wallH * 0.5; const dir = nx * ox + nz * oz + ny * oy; if ((dir > 0) === inward) { const tmp = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = tmp; } }
      return stripMesh({ name: 'tunnel ' + name, pos: Float32Array.from(pos), col: Float32Array.from(col), index: Uint32Array.from(ix), vertexCount: n * m, normals: true }, mat);
    };
    mk('lining', 1, '#3b4250', true);
    mk('shell', 1 + tn.shell / tn.innerR, '#7c828c', false);
    // portal rings: a flat band between the inner profile (walls and arch) and a 1.2 m wider outer profile, 1.4 m deep, with moss on the upper half; a black fan fills the opening
    for (const [i0, dirSign] of [[idx[0], -1], [idx[n - 1], 1]]) {
      const k = F[i0].k, tx = T[i0][0], tz = T[i0][1], bx = -tz, bz = tx, base = rt.bed[i0], depth = 1.4, outerR = tn.innerR + 1.2;
      const at = (o, dy, back) => { const dz = back * -dirSign; return [F[i0].x + bx * o * k + tx * dz * k, (base + dy - BASE) * k, F[i0].z + bz * o * k + tz * dz * k]; };
      const outerOf = ([o, dy]) => { if (dy <= tn.wallH + 1e-6 && Math.abs(Math.abs(o) - tn.innerR) < 1e-6) return [Math.sign(o) * outerR, dy]; const vx = o, vy = dy - tn.wallH, l = Math.hypot(vx, vy); return [vx / l * outerR, tn.wallH + vy / l * outerR]; };
      const c0 = new THREE.Color('#8a8f99'), moss = new THREE.Color('#4f7a56'), dark = new THREE.Color('#5f6672'), ringPos = [], ringCol = [], ringIdx = [];
      prof.forEach((p, a) => { const q = outerOf(p), up = p[1] > tn.wallH + 0.2 ? 1 : 0; for (const [pt, back, kind] of [[p, 0, 0], [q, 0, 1], [q, depth, 2], [p, depth, 3]]) { ringPos.push(...at(pt[0], pt[1], back)); const mv = up ? 0.25 + 0.3 * hash(a, kind) : 0.08 * hash(a, kind); const c = (kind === 3 ? dark : c0).clone().lerp(moss, mv); ringCol.push(c.r, c.g, c.b); } });
      const m = 4, N = prof.length; for (let a = 0; a + 1 < N; a++) for (let j = 0; j < m; j++) { const j2 = (j + 1) % m, a0 = a * m + j, b0 = a * m + j2, c1 = (a + 1) * m + j, d0 = (a + 1) * m + j2; ringIdx.push(a0, c1, b0, b0, c1, d0); }
      stripMesh({ name: 'tunnel portal ring', pos: Float32Array.from(ringPos), col: Float32Array.from(ringCol), index: Uint32Array.from(ringIdx), vertexCount: ringPos.length / 3, normals: true }, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, side: THREE.DoubleSide }));
      // void: a fan from the road-level centre of the opening over the whole inner profile, recessed 0.2 m behind the ring face
      const vp = [...at(0, 0.05, 0.2)], vc = [0.03, 0.04, 0.06], vi = [];
      prof.forEach(p => { vp.push(...at(p[0], p[1], 0.2)); vc.push(0.02, 0.025, 0.04); });
      for (let a = 1; a < prof.length; a++) vi.push(0, a, a + 1);
      stripMesh({ name: 'tunnel void', pos: Float32Array.from(vp), col: Float32Array.from(vc), index: Uint32Array.from(vi), vertexCount: vp.length / 3, normals: true }, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    }
  }

  // ---------------------------------------------------------------- per-frame update, hooks
  function tick(t, camera) {
    if (!S.built || !S.root.visible) return;
    const ink = SEC.state.ink, g = ink.ground, a = ink.aerial;
    // the real lamps, their light pools, the small furniture and the navigation lights exist only near the surface (the light band stands for them from far away)
    const near = ink.distance < 120;
    // W8c: the lamps (heads, glows, light pools) hand over to the light band between 40 and 60 m of camera height (NIGHTLIGHT.lampOf); scene.js gives the numbers once per frame
    // through setNight(), so a tool that calls tick() by hand keeps the 120 m rule. The pools fade with it; the heads and glows are sub-pixel by then and go with it at 60 m.
    const N = S.night; S.night = null;
    const lampK = N ? N.lamp : (near ? 1 : 0), LAMP = /^road:(lamp|lampSmall|lampPool)(:glow|:ink)?$/;
    S.materials.poolMat.opacity = lampK;
    const FAR = /^road:(barrierConcrete|pierCap|pierColumn|pierFooting|pierFoot|pylonTop)(:ink)?$/;       // structures stay visible at the panorama distance, everything small does not
    for (const m of [...objs.inst, ...objs.glows]) if (!FAR.test(m.name)) m.visible = (LAMP.test(m.name) ? lampK > 0.001 : near) && (!/ripple/.test(m.name) || (SEC.state.settings.rain && S.puddleWeight > 0.001));
    for (const h of objs.hulls) h.visible = g > 0.01 && ((LAMP.test(h.name) ? lampK > 0.001 : near) || FAR.test(h.name));
    for (const l of (objs.lines.near || [])) l.visible = near;
    for (const l of objs.lines.aerial) { l.material.opacity = a; l.visible = a > 0.01; }
    for (const l of objs.lines.bridge) { const o = Math.min(1, g + a); if (l.userData.baseOpacity === undefined) l.userData.baseOpacity = l.material.opacity > 0.95 ? 1 : 0.9; l.material.opacity = Math.min(l.userData.baseOpacity, o); l.visible = o > 0.01; }
    if (S.ripples && near && SEC.state.settings.rain && S.puddleWeight > 0.001) { const { mesh, mats, spots } = S.ripples; for (let i = 0; i < spots.length; i++) { const p = (t * 0.6 + spots[i].phase) % 1, sc = (0.02 + p * 0.5) * mats[i].k, M = mats[i]; mM.compose(mP.set(M.x, M.y, M.z), qQ.identity(), mS.set(sc, 1, sc)); mesh.setMatrixAt(i, mM); const v = (1 - p) * 0.3 * S.puddleWeight; mesh.setColorAt(i, tintC.setRGB(v * 0.67, v * 0.85, v * 0.87)); } mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
    if (objs.nav) { const n = S.nav.length; for (let i = 0; i < n; i++) { const v = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / NAV_PERIOD + S.nav[i] * 6.283)); objs.nav.setColorAt(i, tintC.setRGB(v, v, v)); } objs.nav.instanceColor.needsUpdate = true; S.navValue = 0; }
    if (!S.bandManual) S.band.set(N ? { opacity: S.band.max * N.band } : { distance: ink.distance });
    S.band.breathe(t);
  }

  const api = {
    tick, state: S, job,                 // W8g-a: worldgen.js steps the job ahead of time
    setNight(v) { S.night = v; },                        // W8c: { band, lamp } for the next tick (nightlight.js)
    setPuddleWeight(v) { S.puddleWeight = Math.max(0, Math.min(1, +v || 0)); },
    setLightBand(v) { S.bandManual = v.distance !== undefined || v.opacity !== undefined; if (v.auto) S.bandManual = false; return S.band.set(v); },
    stats() { return { counts: S.counts, ...S.stats, band: S.band && S.band.stats }; },
    data: () => DATA, objects: objs,
  };
  global.ROADS_API = api;
  return api;
};

if (typeof module !== 'undefined' && module.exports) module.exports = ROADS;
else global.ROADS = ROADS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
