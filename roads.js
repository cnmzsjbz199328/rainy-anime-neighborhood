// Planet road network, batch W5a (W5_SPEC): RD01 trunk road with its town-exit transitions, RD02 bridges (bridge.js), the RD01 tunnel portals, the exits
// of the other classes (RD03 N04/N09/N10, RD05 N11-N13), street furniture of RD01/RD02 and the night light band (lightband.js).
// Pure part: plan(W, H) builds all data from world.js and a ground height function (no THREE, no DOM; tools/road_check.mjs runs it under Node).
// Scene part: attach(...) makes the meshes the first time the planet is shown (uBend > 0 or the 'section' view mode), so the default town costs nothing.
// Geometry is stored in flat Mercator coordinates and rolled onto the sphere by bend.js (docs/world/W3_SPEC.md section 2); instances are scaled by
// 1/cos(lat) so that bend.js shrinks them back to their true size. Test hooks: window.__scene.roads.
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (a, b) => { let h = Math.imul(Math.round(a * 97), 374761393) ^ Math.imul(Math.round(b * 131), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// ---- the W5a plan. Routes are chains of edges swept as one strip (roadkit.route); the town end of every exit starts with the town's own asphalt and wears
// into the road class (W5_SPEC 3.0): RD01 9 m asphalt -> 7 m with gravel shoulders within 15 m; RD03 fraying edges, cracks, weeds; RD05 from a 4.5 m asphalt apron.
const LEAD01 = { cls: 'RD01T', at: 8 };
const ROUTES = [
  { id: 'N03-east', exit: 'N03', segs: [{ id: 'T01-01' }, { id: 'T01-02' }], opts: { lead: LEAD01, townStart: true, wearMax: 0.35, wearLen: 30 }, furnish: { kind: 'RD01', firstLamp: 3, busStop: 10, barrier: ['end'], barrierGap: [{ side: -1, s0: 8.8, s1: 15.8 }] } },
  { id: 'N01-west', exit: 'N01', segs: [{ id: 'T01-15', rev: true }, { id: 'T01-14', rev: true }], opts: { lead: LEAD01, townStart: true, wearMax: 0.35, wearLen: 30 }, furnish: { kind: 'RD01', firstLamp: 3, busStop: 11, barrier: ['end'] } },
  { id: 'T01-ridge', segs: [{ id: 'T01-04' }, { id: 'T01-05' }, { id: 'T01-06' }], opts: { wearMax: 0.3, wearLen: 40 }, furnish: { kind: 'RD01', firstLamp: 6, barrier: ['start', 'end'], tunnel: true } },
  { id: 'T01-west', segs: [{ id: 'T01-10' }, { id: 'T01-11' }, { id: 'T01-12' }], opts: { wearMax: 0.3, wearLen: 50 }, furnish: { kind: 'RD01', firstLamp: 6, barrier: ['start', 'end'] } },
  { id: 'N10-T04', exit: 'N10', segs: [{ id: 'T04-01' }], opts: { townStart: true, wearMax: 0.5, wearLen: 24, trimEnd: 3.6 }, furnish: { kind: 'RD03', lamps: [6, 25], poles: [10, 21], sign: [{ s: 15, type: 'signTri' }], mirror: 'end', vending: 23.5 } },
  { id: 'N04-T02', exit: 'N04', segs: [{ id: 'T02-01' }], opts: { townStart: true, wearMax: 0.5, wearLen: 24 }, furnish: { kind: 'RD03', lamps: [6, 31], poles: [9, 24, 38, 48], sign: [{ s: 13, type: 'signRound' }], mirror: 'bend', busStop: 31 } },
  { id: 'N09-T05', exit: 'N09', segs: [{ id: 'T05-01' }], opts: { townStart: true, wearMax: 0.5, wearLen: 24 }, furnish: { kind: 'RD03', lamps: [6, 30], poles: [11, 24], sign: [{ s: 14, type: 'signRound' }], jizo: 29 } },
  { id: 'N11-T06', exit: 'N11', segs: [{ id: 'T06-01' }], opts: { lead: { cls: 'RD03', at: 3 }, blend: 2, townStart: true, wearMax: 1, wearLen: 8, weedsPerBin: 4 } },
  { id: 'N12-T06', exit: 'N12', segs: [{ id: 'T06-02' }], opts: { lead: { cls: 'RD03', at: 3 }, blend: 2, townStart: true, wearMax: 1, wearLen: 6, weedsPerBin: 4 } },
  { id: 'N13-T06', exit: 'N13', segs: [{ id: 'T06-03' }], opts: { lead: { cls: 'RD03', at: 3 }, blend: 2, townStart: true, wearMax: 1, wearLen: 6, weedsPerBin: 4 } },
  // W5b: the RD05 branches off T01 (start beyond the edge of the trunk road), the snow route RD08
  { id: 'T07-RD05', segs: [{ id: 'T07-01' }], opts: { trimStart: 5.2, wearMax: 0.3, wearLen: 20 }, furnish: { kind: 'RD05', post: true } },
  { id: 'T08-RD05', segs: [{ id: 'T08-01' }], opts: { trimStart: 5.2, wearMax: 0.35, wearLen: 40 }, furnish: { kind: 'RD05', post: true } },
  { id: 'T09-RD05', segs: [{ id: 'T09-01' }], opts: { trimStart: 5.2, wearMax: 0.3, wearLen: 20 }, furnish: { kind: 'RD05', stakes: true } },
  { id: 'T10-RD08', segs: [{ id: 'T10-01' }], opts: { wearMax: 0, weeds: false }, furnish: { kind: 'RD08', poleEvery: 8, shelter: 17.5 } },
];
const STAIRS = ['T02-02', 'T08-02'];
const BRIDGES = [
  { id: 'T01-03', ids: ['T01-03'] },
  { id: 'T01-07+08+09', ids: ['T01-07', 'T01-08', 'T01-09'], pylonJoint: 1, pylonShift: -4.5, access: { atJoint: 1, node: 'LM08-south' } },       // J-LM08 is the joint between T01-08 and T01-09; the tower stands 4.5 m before it, the T11-02 stair at the node
  { id: 'T01-13', ids: ['T01-13'] },
];
const NAV_PERIOD = 6;                                // navigation lights: one slow pulse per 6 s (card: period >= 4 s, no flicker)
const SPACING = { human: 16, wild: 40 };            // RD01 lamps (card): inhabited land 16 m, wilderness 40 m

// RD01 street furniture on a swept route: lamps by zone, concrete barriers near bridges and portals, milestones, bus stops, the tunnel portal data.
function furnish(W, rt, cfg) {
  if (cfg.kind === 'RD03') return furnishRD03(W, rt, cfg);
  if (cfg.kind === 'RD05') return furnishRD05(W, rt, cfg);
  if (cfg.kind === 'RD08') return furnishRD08(W, rt, cfg);
  const S = rt.samples, n = S.length, add = (type, i, o, alt, ex = {}) => { const [lo, la] = rt.lateral(i, o); (rt.instances[type] = rt.instances[type] || []).push({ type, lon: lo, lat: la, alt, yaw: ex.yaw || 0, s: ex.s || [1, 1, 1], lean: [0, 0], tint: ex.tint || [1, 1, 1] }); };
  const T = rt.tangent, yawAlong = i => Math.atan2(-T[i][1], T[i][0]), yawToward = (dx, dz) => Math.atan2(-dz, dx), yawFace = (dx, dz) => Math.atan2(dx, dz), right = i => [-T[i][1], T[i][0]];
  rt.lamps = [];
  let next = cfg.firstLamp || 3, side = 1;
  while (next < rt.length - 2) {
    const i = Math.min(n - 1, Math.round(next / 0.5)), zone = W.regionAt(S[i].lon, S[i].lat).zone, sp = zone === 'building' ? SPACING.human : SPACING.wild;
    if (S[i].span === 'tunnel') { next += 1; continue; }
    const r = right(i), it = add('lamp', i, side * 4.3, rt.surface(i, side * 4.3), { yaw: yawToward(-side * r[0], -side * r[1]) });
    rt.lamps.push({ i, s: S[i].s, zone: zone === 'building' ? 'human' : 'wild', side }); void it;
    add('lampPool', i, side * 1.5, rt.surface(i, side * 1.5) + 0.02);
    side = -side; next += sp;
  }
  // concrete barriers every 2 m on both shoulders: the last 14 m before a bridge abutment and 10 m outside each tunnel portal
  const near = [];
  if ((cfg.barrier || []).includes('start')) near.push([0, 14]);
  if ((cfg.barrier || []).includes('end')) near.push([rt.length - 14, rt.length]);
  if (cfg.tunnel) { const tun = S.filter(p => p.span === 'tunnel'); if (tun.length) near.push([tun[0].s - 10, tun[0].s], [tun[tun.length - 1].s, tun[tun.length - 1].s + 10]); }
  for (const [a, b] of near) for (let s = Math.max(1, a); s < Math.min(rt.length - 0.5, b); s += 2) { const i = Math.min(n - 1, Math.round(s / 0.5)); if (S[i].span === 'tunnel') continue; for (const sd of [-1, 1]) if (!(cfg.barrierGap || []).some(g => g.side === sd && s > g.s0 && s < g.s1)) add('barrierConcrete', i, sd * 4.62, rt.surface(i, sd * 4.62), { yaw: yawAlong(i), lean: [0, Math.atan((rt.bed[Math.min(n - 1, i + 2)] - rt.bed[Math.max(0, i - 2)]) / Math.max(1e-6, S[Math.min(n - 1, i + 2)].s - S[Math.max(0, i - 2)].s))] }); }
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
// RD05 dirt track: a stone post where it leaves the trunk road; the desert one (T09-01) is marked by wooden stakes every 5 m
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

function plan(W, H, tc) {
  const WS = Object.assign(Object.create(W), { height: H }), RK = global.ROADKIT, BR = global.BRIDGE;
  const routes = ROUTES.map(def => { const rt = RK.route(WS, def.segs, { ...def.opts, terrainColor: tc }); rt.def = def; if (def.furnish) furnish(WS, rt, def.furnish); return rt; });
  const bridges = BRIDGES.map(def => { const b = BR.build(WS, def.ids, def); b.def = def; return b; });
  // lit polylines for the light band: RD01 along the bed (with a gap in the tunnel), RD02 along the deck; the sea parts for the reflections
  const lit = [], sea = [];
  for (const rt of routes) { if (!(rt.lamps && rt.lamps.length)) continue; let cur = []; rt.samples.forEach((p, i) => { if (p.span === 'tunnel') { if (cur.length > 1) lit.push(cur); cur = []; } else cur.push({ lon: p.lon, lat: p.lat, alt: rt.bed[i] }); }); if (cur.length > 1) lit.push(cur); }
  for (const b of bridges) { lit.push(b.samples.map((p, i) => ({ lon: p.lon, lat: p.lat, alt: b.alt[i] }))); let cur = []; b.samples.forEach((p, i) => { if (p.h < -0.2) cur.push({ lon: p.lon, lat: p.lat, alt: 0.03 }); else { if (cur.length > 1) sea.push(cur); cur = []; } }); if (cur.length > 1) sea.push(cur); }
  const stairs = STAIRS.map(id => global.STEPS.build(WS, id));
  // closures at the landmark entrances: two guide posts across the end of the road that reaches the entrance (W5-C7); the entrance of LM04 belongs to the W4 section
  const markers = [], items = [...routes.map(rt => ({ kind: 'route', rt, hw: rt.def.furnish && rt.def.furnish.kind === 'RD05' ? 1.5 : rt.def.furnish && rt.def.furnish.kind === 'RD08' ? 1.0 : rt.def.furnish && rt.def.furnish.kind === 'RD03' ? 2.25 : 4.5 })), ...stairs.map(st => ({ kind: 'stairs', rt: st, hw: 0.8 }))];
  for (const nd of W.roadNetwork.nodes.filter(q => q.kind === 'landmark-entrance')) {
    let best = null; for (const it of items) { const S = it.rt.samples; for (const i of [0, S.length - 1, ...(it.kind === 'route' ? S.map((_, j) => j) : [])]) { const d = global.WORLD ? 0 : 0; void d; const dd = W.arcDistance(S[i], nd); if (dd < 0.4 && (!best || dd < best.d)) best = { d: dd, it, i }; } }
    if (!best) continue;
    const { it, i } = best, T = it.rt.tangent, yaw = Math.atan2(T[i][0], T[i][1]);
    for (const sd of [-1, 1]) { const [lo, la] = it.rt.lateral(i, sd * (it.hw + 0.75)); markers.push({ type: 'gatePost', lon: lo, lat: la, alt: (it.rt.surface ? it.rt.surface(i, sd * (it.hw + 0.75)) : WS.height(lo, la)), yaw, s: [1, 1, 1], lean: [0, 0], tint: [1, 1, 1], node: nd.id }); }
  }
  return { routes, bridges, stairs, markers, lit, sea, WS };
}

const ROADS = { plan, furnish, ROUTES, STAIRS, BRIDGES, SPACING, NAV_PERIOD };

// ---------------------------------------------------------------- scene part
ROADS.attach = function (scene, ctx, BEND, TERR, SEC) {
  const THREE = global.THREE, W = global.WORLD;
  const S = { built: false, stats: {}, root: null, band: null, nav: [], ink: {} };
  const objs = { inst: [], hulls: [], glows: [], strips: [], lines: { aerial: [], bridge: [], near: [] }, nav: null };
  const tintC = new THREE.Color(), qE = new THREE.Euler(), qQ = new THREE.Quaternion(), mP = new THREE.Vector3(), mS = new THREE.Vector3(), mM = new THREE.Matrix4();
  const flatOf = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) });
  const matrixOfAlt = it => { const f = flatOf(it.lon, it.lat); qE.set(it.lean[0], it.yaw, it.lean[1], 'YXZ'); qQ.setFromEuler(qE); mM.compose(mP.set(f.x, (it.alt - BASE) * f.k, f.z), qQ, mS.set(f.k * it.s[0], f.k * it.s[1], f.k * it.s[2])); return mM.clone(); };
  let DATA = null;

  function build() {
    const t0 = Date.now();
    const K = SEC.kit(), M = SEC.state.materials, H = TERR.sampler();
    const TB = global.TERRAIN.builder(W); DATA = plan(W, H, (lo, la) => TB.vertex(lo, la).c); S.data = DATA;
    const root = new THREE.Group(); root.name = 'roads'; scene.add(root); S.root = root;
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
      if (st.normals) g.computeVertexNormals(); else { const nrm = new Float32Array(st.pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); }
      g.computeBoundingSphere(); const m = new THREE.Mesh(g, mat); m.name = 'road:' + st.name; m.matrixAutoUpdate = false; root.add(m); objs.strips.push(m); return m;
    };
    for (const rt of DATA.routes) stripMesh({ ...rt.strip, normals: true }, M.groundMat);
    for (const b of DATA.bridges) for (const st of b.strips) stripMesh(st, bridgeMat);

    // ---- tunnel (T01-05): a half-round arch tube along the bed, outer concrete shell, dark inner lining, a portal ring and a black void disc at each end
    for (const rt of DATA.routes) if (rt.tunnel) buildTunnel(rt, root, stripMesh, bridgeMat);

    // ---- instances
    const all = {};
    for (const rt of DATA.routes) for (const [t, list] of Object.entries(rt.instances)) (all[t] = all[t] || []).push(...list.map(it => ({ ...it, m: matrixOfAlt(it) })));
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
    { const spots = []; for (const rt of DATA.routes) for (const l of (rt.lamps || [])) for (let k = 0; k < 2; k++) { const it = (rt.instances.lamp || [])[0]; void it; const o = (k ? -1 : 1) * (1.0 + 0.8 * hash(l.s, k)), i = Math.min(rt.samples.length - 1, Math.round((l.s + (k ? -2.2 : 2.0)) / 0.5)), [lo, la] = rt.lateral(i, o); spots.push({ lon: lo, lat: la, alt: rt.surface(i, o) + 0.012, phase: hash(l.s, k + 5) }); }
      for (const b of DATA.bridges) for (const l of b.lamps) for (let k = 0; k < 2; k++) { const o = (k ? -1 : 1) * (1.0 + 0.8 * hash(l.s, k)), i = Math.min(b.samples.length - 1, Math.round((l.s + (k ? -2.2 : 2.0)) / 0.5)), [lo, la] = b.lateral(i, o); spots.push({ lon: lo, lat: la, alt: b.alt[i] + 0.05, phase: hash(l.s, k + 5) }); }
      const rg = new THREE.RingGeometry(0.93, 1, 24); rg.rotateX(-Math.PI / 2);
      const rm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 });
      const mesh = new THREE.InstancedMesh(rg, rm, spots.length); mesh.name = 'road:ripple'; mesh.frustumCulled = false; for (let i = 0; i < spots.length; i++) { mesh.setMatrixAt(i, new THREE.Matrix4()); mesh.setColorAt(i, tintC.setRGB(0, 0, 0)); }
      root.add(mesh); S.ripples = { mesh, spots, mats: spots.map(sp => { const f = flatOf(sp.lon, sp.lat); return { x: f.x, y: (sp.alt - BASE) * f.k, z: f.z, k: f.k }; }) }; objs.inst.push(mesh); S.counts.ripple = spots.length; }
    // navigation lights pulse slowly (period 6 s, phase per pier, never below 28 % of full): updated in tick
    S.nav = DATA.bridges.flatMap(b => b.navLights.map(n => n.phase));

    // ---- ink lines: route paved edges (aerial), bridge girder edges, joints and stays (ground and aerial)
    const poly = (pts, out) => { let prev = null; for (const q of pts) { const f = flatOf(q.lon, q.lat), p = [f.x, (q.alt - BASE) * f.k, f.z]; if (prev) out.push(...prev, ...p); prev = p; } };
    const addLines = (layer, segs, color) => { if (!segs.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); g.computeBoundingSphere(); const l = new THREE.LineSegments(g, color ? new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, fog: false }) : lineMat()); l.name = 'road:ink:' + layer; l.matrixAutoUpdate = false; root.add(l); objs.lines[layer].push(l); S.stats['ink_' + layer] = (S.stats['ink_' + layer] || 0) + segs.length / 6; return l; };
    { const segs = []; for (const rt of DATA.routes) { const clip = line => { let run = []; line.forEach((q, i) => { if (rt.samples[i].span === 'tunnel') { if (run.length > 1) poly(run, segs); run = []; } else run.push(q); }); if (run.length > 1) poly(run, segs); }; clip(rt.lines.edgeL); clip(rt.lines.edgeR); } addLines('aerial', segs); }
    { const segs = [], white = []; for (const b of DATA.bridges) { for (const k of ['edgeL', 'edgeR', 'edgeLU', 'edgeRU']) poly(b.lines[k], segs); for (const j of b.lines.joints) poly(j, segs); for (const st of (b.lines.stays || [])) poly(st, white); }
      addLines('bridge', segs); addLines('bridge', white, 0xe6ebf2); }

    // ---- near-only lines: rope handrails of the stairs, the steel rails of the T11-02 stair, the wires between the RD03 utility poles
    { const rope = [], rail = [], wire = [], local = [[-0.8, 7.75, 0], [0, 7.75, 0], [0.8, 7.75, 0]];
      for (const st of DATA.stairs) for (const line of st.ropeSegments) poly(line, rope);
      for (const b of DATA.bridges) for (const line of (b.stairRails || [])) poly(line, rail);
      for (const rt of DATA.routes) { const ps = rt.poles || []; for (let a = 0; a + 1 < ps.length; a++) { const A = ps[a].rec, B = ps[a + 1].rec, MA = matrixOfAlt(A), MB = matrixOfAlt(B), kA = flatOf(A.lon, A.lat).k, sag = 0.5 + 0.5 * hash(a + 1, rt.length); for (let c = 0; c < 3; c++) { const pa = new THREE.Vector3(...local[c]).applyMatrix4(MA), pb = new THREE.Vector3(...local[c]).applyMatrix4(MB); let prev = null; for (let nn = 0; nn <= 10; nn++) { const t = nn / 10, p = [pa.x + (pb.x - pa.x) * t, pa.y + (pb.y - pa.y) * t - sag * 4 * t * (1 - t) * kA, pa.z + (pb.z - pa.z) * t]; if (prev) wire.push(...prev, ...p); prev = p; } } } }
      const addNear = (segs, color, op) => { if (!segs.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); g.computeBoundingSphere(); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, fog: false })); l.name = 'road:near-line'; l.matrixAutoUpdate = false; root.add(l); objs.lines.near.push(l); };
      addNear(rope, 0xb59a74, 0.95); addNear(rail, 0xaeb7c4, 0.95); addNear(wire, 0x1f2a38, 0.9); S.stats.wireSegments = wire.length / 6; }
    { const segs = []; for (const st of DATA.stairs) { poly(st.lines.edgeL, segs); poly(st.lines.edgeR, segs); } addLines('aerial', segs); }

    // ---- light band (RD01, RD02 and RD03 routes), with dots for the lanterns of the stairs and the small lamps of the boardwalk and the maintenance stair
    const dots = []; for (const st of DATA.stairs) for (const l of st.lanterns) dots.push({ lon: l.lon, lat: l.lat, alt: l.alt + 0.6 });
    for (const rec of ((SEC.state.roadOut || []).flatMap(r => r.instances.lampSmall || []))) dots.push({ lon: rec.lon, lat: rec.lat, alt: rec.alt + 1.2 });
    for (const b of DATA.bridges) for (const rec of (b.instances.lampSmall || [])) dots.push({ lon: rec.lon, lat: rec.lat, alt: rec.alt + 1.2 });
    S.band = global.LIGHTBAND.make(THREE, root); S.band.build(DATA.lit, DATA.sea, dots); S.dots = dots.length;
    S.stats.buildMs = Date.now() - t0; S.built = true;
    return root;
  }

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

  // ---------------------------------------------------------------- visibility, per-frame update, hooks
  function ensure() { if (!S.built) { SEC.ensure(); global.TERRAIN.withPrivateRandom(build); } return S.root; }
  function visibility() {
    const show = BEND.get() > 0 || TERR.explore || SEC.state.mode;
    if (show) ensure();
    if (S.root) S.root.visible = show;
    if (S.built) for (const m of TERR.stubs) if (ROADS.ROUTES.some(r => r.exit === m.userData.terrain.exit)) m.visible = !show;     // the exit starts are replaced by the swept roads
  }
  BEND.onChange(visibility);
  TERR.onExplore(visibility);

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
    for (const m of [...objs.inst, ...objs.glows]) if (!FAR.test(m.name)) m.visible = (LAMP.test(m.name) ? lampK > 0.001 : near) && (!/ripple/.test(m.name) || SEC.state.settings.rain);
    for (const h of objs.hulls) h.visible = g > 0.01 && ((LAMP.test(h.name) ? lampK > 0.001 : near) || FAR.test(h.name));
    for (const l of (objs.lines.near || [])) l.visible = near;
    for (const l of objs.lines.aerial) { l.material.opacity = a; l.visible = a > 0.01; }
    for (const l of objs.lines.bridge) { const o = Math.min(1, g + a); if (l.userData.baseOpacity === undefined) l.userData.baseOpacity = l.material.opacity > 0.95 ? 1 : 0.9; l.material.opacity = Math.min(l.userData.baseOpacity, o); l.visible = o > 0.01; }
    if (S.ripples && near && SEC.state.settings.rain) { const { mesh, mats, spots } = S.ripples; for (let i = 0; i < spots.length; i++) { const p = (t * 0.6 + spots[i].phase) % 1, sc = (0.02 + p * 0.5) * mats[i].k, M = mats[i]; mM.compose(mP.set(M.x, M.y, M.z), qQ.identity(), mS.set(sc, 1, sc)); mesh.setMatrixAt(i, mM); const v = (1 - p) * 0.3; mesh.setColorAt(i, tintC.setRGB(v * 0.67, v * 0.85, v * 0.87)); } mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
    if (objs.nav) { const n = S.nav.length; for (let i = 0; i < n; i++) { const v = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / NAV_PERIOD + S.nav[i] * 6.283)); objs.nav.setColorAt(i, tintC.setRGB(v, v, v)); } objs.nav.instanceColor.needsUpdate = true; S.navValue = 0; }
    if (!S.bandManual) S.band.set(N ? { opacity: S.band.max * N.band } : { distance: ink.distance });
    S.band.breathe(t);
  }

  const api = {
    ensure, tick, state: S,
    setNight(v) { S.night = v; },                        // W8c: { band, lamp } for the next tick (nightlight.js)
    setLightBand(v) { ensure(); S.bandManual = v.distance !== undefined || v.opacity !== undefined; if (v.auto) S.bandManual = false; return S.band.set(v); },
    stats() { return { counts: S.counts, ...S.stats, band: S.band && S.band.stats }; },
    data: () => DATA, objects: objs,
  };
  global.ROADS_API = api;
  return api;
};

if (typeof module !== 'undefined' && module.exports) module.exports = ROADS;
else global.ROADS = ROADS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
