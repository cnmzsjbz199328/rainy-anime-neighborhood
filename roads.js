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
  { id: 'N03-east', exit: 'N03', segs: [{ id: 'T01-01' }, { id: 'T01-02' }], opts: { lead: LEAD01, townStart: true, wearMax: 0.35, wearLen: 30 }, furnish: { firstLamp: 3, busStop: 10, barrier: ['end'] } },
  { id: 'N01-west', exit: 'N01', segs: [{ id: 'T01-15', rev: true }, { id: 'T01-14', rev: true }], opts: { lead: LEAD01, townStart: true, wearMax: 0.35, wearLen: 30 }, furnish: { firstLamp: 3, busStop: 11, barrier: ['end'] } },
  { id: 'T01-ridge', segs: [{ id: 'T01-04' }, { id: 'T01-05' }, { id: 'T01-06' }], opts: { wearMax: 0.3, wearLen: 40 }, furnish: { firstLamp: 6, barrier: ['start', 'end'], tunnel: true } },
  { id: 'T01-west', segs: [{ id: 'T01-10' }, { id: 'T01-11' }, { id: 'T01-12' }], opts: { wearMax: 0.3, wearLen: 50 }, furnish: { firstLamp: 6, barrier: ['start', 'end'] } },
  { id: 'N10-T04', exit: 'N10', segs: [{ id: 'T04-01' }], opts: { townStart: true, wearMax: 0.5, wearLen: 24, trimEnd: 3.6 } },
  { id: 'N04-T02', exit: 'N04', segs: [{ id: 'T02-01' }], opts: { townStart: true, wearMax: 0.5, wearLen: 24 } },
  { id: 'N09-T05', exit: 'N09', segs: [{ id: 'T05-01' }], opts: { townStart: true, wearMax: 0.5, wearLen: 24 } },
  { id: 'N11-T06', exit: 'N11', segs: [{ id: 'T06-01' }], opts: { lead: { cls: 'RD03', at: 3 }, blend: 2, townStart: true, wearMax: 1, wearLen: 8, weedsPerBin: 4 } },
  { id: 'N12-T06', exit: 'N12', segs: [{ id: 'T06-02' }], opts: { lead: { cls: 'RD03', at: 3 }, blend: 2, townStart: true, wearMax: 1, wearLen: 6, weedsPerBin: 4 } },
  { id: 'N13-T06', exit: 'N13', segs: [{ id: 'T06-03' }], opts: { lead: { cls: 'RD03', at: 3 }, blend: 2, townStart: true, wearMax: 1, wearLen: 6, weedsPerBin: 4 } },
];
const BRIDGES = [
  { id: 'T01-03', ids: ['T01-03'] },
  { id: 'T01-07+08+09', ids: ['T01-07', 'T01-08', 'T01-09'], pylonJoint: 1 },       // J-LM08 is the joint between T01-08 and T01-09
  { id: 'T01-13', ids: ['T01-13'] },
];
const NAV_PERIOD = 6;                                // navigation lights: one slow pulse per 6 s (card: period >= 4 s, no flicker)
const SPACING = { human: 16, wild: 40 };            // RD01 lamps (card): inhabited land 16 m, wilderness 40 m

// RD01 street furniture on a swept route: lamps by zone, concrete barriers near bridges and portals, milestones, bus stops, the tunnel portal data.
function furnish(W, rt, cfg) {
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
  for (const [a, b] of near) for (let s = Math.max(1, a); s < Math.min(rt.length - 0.5, b); s += 2) { const i = Math.min(n - 1, Math.round(s / 0.5)); if (S[i].span === 'tunnel') continue; for (const sd of [-1, 1]) add('barrierConcrete', i, sd * 4.62, rt.surface(i, sd * 4.62), { yaw: yawAlong(i) }); }
  // milestones every 25 m on the right shoulder (not inside the barrier zones), a bus stop sign
  for (let s = 12; s < rt.length - 4; s += 25) { const i = Math.round(s / 0.5); if (S[i].span === 'tunnel' || near.some(([a, b]) => s > a - 1 && s < b + 1)) continue; add('milestone', i, 4.1, rt.surface(i, 4.1), { yaw: yawAlong(i) + Math.PI / 2 }); }
  if (cfg.busStop) { const i = Math.round(cfg.busStop / 0.5), r = right(i); add('signBus', i, 4.2, rt.surface(i, 4.2), { yaw: yawFace(-r[0], -r[1]) }); }
  // tunnel: the samples of the span with the bed altitude (the arch geometry is made in the scene part)
  if (cfg.tunnel) { const idx = []; S.forEach((p, i) => { if (p.span === 'tunnel') idx.push(i); }); rt.tunnel = { idx, s0: S[idx[0]].s, s1: S[idx[idx.length - 1]].s, innerR: 4.7, wallH: 1.0, shell: 0.7 }; }
}

function plan(W, H, tc) {
  const WS = Object.assign(Object.create(W), { height: H }), RK = global.ROADKIT, BR = global.BRIDGE;
  const routes = ROUTES.map(def => { const rt = RK.route(WS, def.segs, { ...def.opts, terrainColor: tc }); rt.def = def; if (def.furnish) furnish(WS, rt, def.furnish); return rt; });
  const bridges = BRIDGES.map(def => { const b = BR.build(WS, def.ids, def); b.def = def; return b; });
  // lit polylines for the light band: RD01 along the bed (with a gap in the tunnel), RD02 along the deck; the sea parts for the reflections
  const lit = [], sea = [];
  for (const rt of routes) { if (!rt.def.furnish) continue; let cur = []; rt.samples.forEach((p, i) => { if (p.span === 'tunnel') { if (cur.length > 1) lit.push(cur); cur = []; } else cur.push({ lon: p.lon, lat: p.lat, alt: rt.bed[i] }); }); if (cur.length > 1) lit.push(cur); }
  for (const b of bridges) { lit.push(b.samples.map((p, i) => ({ lon: p.lon, lat: p.lat, alt: b.alt[i] }))); let cur = []; b.samples.forEach((p, i) => { if (p.h < -0.2) cur.push({ lon: p.lon, lat: p.lat, alt: 0.03 }); else { if (cur.length > 1) sea.push(cur); cur = []; } }); if (cur.length > 1) sea.push(cur); }
  return { routes, bridges, lit, sea, WS };
}

const ROADS = { plan, furnish, ROUTES, BRIDGES, SPACING, NAV_PERIOD };

// ---------------------------------------------------------------- scene part
ROADS.attach = function (scene, ctx, BEND, TERR, SEC) {
  const THREE = global.THREE, W = global.WORLD;
  const S = { built: false, stats: {}, root: null, band: null, nav: [], ink: {} };
  const objs = { inst: [], hulls: [], glows: [], strips: [], lines: { aerial: [], bridge: [] }, nav: null };
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
    S.counts = {};
    const GLOW = { lamp: ['lampGlow', M.glowMat], navLight: ['navLightGlow', navMat] };
    const NOHULL = ['tuft', 'weed', 'lampPool'];
    for (const [type, list] of Object.entries(all)) {
      const geo = type === 'lampPool' ? S.poolGeo : K.geometries[type]; if (!geo || !list.length) continue; S.counts[type] = list.length;
      const mat = type === 'lampPool' ? poolMat : M.floraMat;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length); mesh.name = 'road:' + type;
      list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, tintC.setRGB(it.tint[0], it.tint[1], it.tint[2])); });
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); root.add(mesh); objs.inst.push(mesh);
      if (!NOHULL.includes(type)) { const hull = new THREE.InstancedMesh(geo, M.hullMat, list.length); hull.instanceMatrix = mesh.instanceMatrix; hull.count = list.length; hull.computeBoundingSphere(); hull.name = 'road:' + type + ':ink'; root.add(hull); objs.hulls.push(hull); }
      if (GLOW[type]) { const g = new THREE.InstancedMesh(K.geometries[GLOW[type][0]], GLOW[type][1], list.length); g.instanceMatrix = mesh.instanceMatrix; g.computeBoundingSphere(); g.name = 'road:' + type + ':glow'; if (type === 'navLight') { list.forEach((it, i) => g.setColorAt(i, tintC.setRGB(1, 1, 1))); g.instanceColor.needsUpdate = true; objs.nav = g; } root.add(g); objs.glows.push(g); }
    }
    // navigation lights pulse slowly (period 6 s, phase per pier, never below 28 % of full): updated in tick
    S.nav = DATA.bridges.flatMap(b => b.navLights.map(n => n.phase));

    // ---- ink lines: route paved edges (aerial), bridge girder edges, joints and stays (ground and aerial)
    const poly = (pts, out) => { let prev = null; for (const q of pts) { const f = flatOf(q.lon, q.lat), p = [f.x, (q.alt - BASE) * f.k, f.z]; if (prev) out.push(...prev, ...p); prev = p; } };
    const addLines = (layer, segs, color) => { if (!segs.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); g.computeBoundingSphere(); const l = new THREE.LineSegments(g, color ? new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, fog: false }) : lineMat()); l.name = 'road:ink:' + layer; l.matrixAutoUpdate = false; root.add(l); objs.lines[layer].push(l); S.stats['ink_' + layer] = (S.stats['ink_' + layer] || 0) + segs.length / 6; return l; };
    { const segs = []; for (const rt of DATA.routes) { const clip = line => { let run = []; line.forEach((q, i) => { if (rt.samples[i].span === 'tunnel') { if (run.length > 1) poly(run, segs); run = []; } else run.push(q); }); if (run.length > 1) poly(run, segs); }; clip(rt.lines.edgeL); clip(rt.lines.edgeR); } addLines('aerial', segs); }
    { const segs = [], white = []; for (const b of DATA.bridges) { for (const k of ['edgeL', 'edgeR', 'edgeLU', 'edgeRU']) poly(b.lines[k], segs); for (const j of b.lines.joints) poly(j, segs); for (const st of (b.lines.stays || [])) poly(st, white); }
      addLines('bridge', segs); addLines('bridge', white, 0xe6ebf2); }

    // ---- light band
    S.band = global.LIGHTBAND.make(THREE, root); S.band.build(DATA.lit, DATA.sea);
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
    // portal rings: a flat annulus between the inner arch and a 1.2 m wider outer arch, 1.4 m deep, with moss on the upper half; a black half-disc fills the opening
    for (const [i0, dirSign] of [[idx[0], -1], [idx[n - 1], 1]]) {
      const k = F[i0].k, tx = T[i0][0], tz = T[i0][1], bx = -tz, bz = tx, base = rt.bed[i0], depth = 1.4;
      const outerR = tn.innerR + 1.2, N = 24, ringPos = [], ringCol = [], ringIdx = [];
      const ptAt = (r, th, back) => { const o = r * Math.cos(th), dy = tn.wallH + r * Math.sin(th), dz = back * -dirSign; return [F[i0].x + bx * o * k + tx * dz * k, (base + dy - BASE) * k, F[i0].z + bz * o * k + tz * dz * k]; };
      const c0 = new THREE.Color('#8a8f99'), moss = new THREE.Color('#4f7a56'), dark = new THREE.Color('#5f6672');
      for (let a = 0; a <= N; a++) { const th = Math.PI * a / N; for (const [r, b, kind] of [[tn.innerR, 0, 0], [outerR, 0, 1], [outerR, depth, 2], [tn.innerR, depth, 3]]) { ringPos.push(...ptAt(r, th, b)); const mv = th > 0.5 && th < 2.64 ? 0.25 + 0.3 * hash(a, kind) : 0; const c = (kind === 3 ? dark : c0).clone().lerp(moss, mv); ringCol.push(c.r, c.g, c.b); } }
      const m = 4; for (let a = 0; a < N; a++) for (let j = 0; j < m; j++) { const j2 = (j + 1) % m, a0 = a * m + j, b0 = a * m + j2, c0i = (a + 1) * m + j, d0 = (a + 1) * m + j2; ringIdx.push(a0, c0i, b0, b0, c0i, d0); }
      stripMesh({ name: 'tunnel portal ring', pos: Float32Array.from(ringPos), col: Float32Array.from(ringCol), index: Uint32Array.from(ringIdx), vertexCount: ringPos.length / 3, normals: true }, mat);
      // void disc: a fan from the road-level centre of the opening, recessed 0.2 m behind the ring face
      const vp = [...ptAt(0.001, Math.PI / 2, 0.2)], vc = [0.03, 0.04, 0.06], vi = []; vp[1] = (base + 0.05 - BASE) * k;
      for (let a = 0; a <= N; a++) { const th = Math.PI * a / N; vp.push(...ptAt(tn.innerR, th, 0.2)); vc.push(0.02, 0.025, 0.04); }
      for (let a = 1; a <= N; a++) vi.push(0, a, a + 1);
      stripMesh({ name: 'tunnel void', pos: Float32Array.from(vp), col: Float32Array.from(vc), index: Uint32Array.from(vi), vertexCount: vp.length / 3, normals: true }, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    }
  }

  // ---------------------------------------------------------------- visibility, per-frame update, hooks
  function ensure() { if (!S.built) { SEC.ensure(); global.TERRAIN.withPrivateRandom(build); } return S.root; }
  function visibility() {
    const show = BEND.get() > 0 || SEC.state.mode;
    if (show) ensure();
    if (S.root) S.root.visible = show;
    if (S.built) for (const m of TERR.stubs) if (ROADS.ROUTES.some(r => r.exit === m.userData.terrain.exit)) m.visible = !show;     // the exit starts are replaced by the swept roads
  }
  BEND.onChange(visibility);

  function tick(t, camera) {
    if (!S.built || !S.root.visible) return;
    const ink = SEC.state.ink, g = ink.ground, a = ink.aerial;
    // the real lamps, their light pools, the small furniture and the navigation lights exist only near the surface (the light band stands for them from far away)
    const near = ink.distance < 120;
    for (const m of [...objs.inst, ...objs.glows]) if (/road:(lamp|lampPool|tuft|weed|milestone|signBus|navLight)/.test(m.name)) m.visible = near;
    for (const h of objs.hulls) h.visible = g > 0.01 && (near || !/road:(lamp|milestone|signBus|navLight)/.test(h.name));
    for (const l of objs.lines.aerial) { l.material.opacity = a; l.visible = a > 0.01; }
    for (const l of objs.lines.bridge) { const o = Math.min(1, g + a); l.material.opacity = Math.min(l.material.opacity > 0.95 ? 1 : 0.9, o); l.visible = o > 0.01; }
    if (objs.nav) { const n = S.nav.length; for (let i = 0; i < n; i++) { const v = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / NAV_PERIOD + S.nav[i] * 6.283)); objs.nav.setColorAt(i, tintC.setRGB(v, v, v)); } objs.nav.instanceColor.needsUpdate = true; S.navValue = 0; }
    if (!S.bandManual) S.band.set({ distance: ink.distance });
  }

  const api = {
    ensure, tick, state: S,
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
