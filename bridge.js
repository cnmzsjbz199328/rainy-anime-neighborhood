// RD02 bridges and the RD01 tunnel (W5): pure data (no THREE, no DOM), driven by world.js and the ground height function it is given.
// build(W, ids) sweeps one bridge (a chain of consecutive RD02 edges) as a box girder along the great-circle centre line: deck top, two side
// faces, two chamfers and the underside as separate strips (each with its own computed normals), concrete parapets, lamps, expansion joints,
// twin-column piers with caps, waterline feet and seabed footings (all along the local radial), navigation lights and, at J-LM08, the low
// cable-stayed tower with its white stays. Every width and height below comes from the RD02 card and W5_SPEC; the plan comes from world.js.
// Geometry is stored in flat Mercator coordinates (see docs/world/W3_SPEC.md section 2): positions already carry the 1/cos(lat) factor and
// instance records give the altitude directly (section.js / roads.js scale them).
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6;
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255].map(srgb);
const hash = (a, b) => { let h = Math.imul(Math.round(a * 97), 374761393) ^ Math.imul(Math.round(b * 131), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const COL = { top: '#3a4152', asphalt: '#2f3645', asphaltL: '#3a4152', line: '#c9cfc4', concreteL: '#8a8f99', concrete: '#7c828c', concreteD: '#5f6672', stain: '#4a525e' };
// deck cross-section: width 10 m (card), girder 1.55 m deep; lane layout as RD01 (7 m carriageway, 1 m shoulders), 0.5 m concrete kerb outside
const DECK = { half: 5.0, girder: 1.55, side: 0.95, slope: 0.148, base: 4.2, hump: 1.8, humpHalf: 20, pierEvery: 11, lampEvery: 16, jointEvery: 12, towerAbove: 13.5, towerLegO: 5.9 };
const TOP = [[0.075, 0.046, 'dash'], [0.1, 0.045, 'asphalt'], [3.12, 0.03, 'asphalt'], [3.18, 0.032, 'line'], [3.3, 0.032, 'line'], [3.36, 0.03, 'asphalt'], [3.5, 0.025, 'asphalt'], [4.5, 0.015, 'asphaltL'], [4.6, 0.01, 'concreteL'], [5.0, 0.01, 'concreteL']];
const TOPCOLS = [...TOP.map(([o, l, c]) => [-o, l, c]).reverse(), ...TOP];

function build(W, ids, o = {}) {
  const NET = W.roadNetwork, edges = ids.map(id => NET.edges.find(e => e.id === id));
  const S = [], joints = []; let off = 0;
  edges.forEach((e, k) => { const P = NET.samplePath(e, 0.5); P.forEach((p, i) => { if (k > 0 && i === 0) return; S.push({ ...p, h: W.height(p.lon, p.lat), s: p.s + off }); }); off += NET.edgeLength(e); if (k + 1 < edges.length) joints.push(off); });
  // unwrapped longitudes: the chain across the dateline (T01-08) must be continuous in the flat frame (bend.js takes sin/cos of x / R, so x beyond +-283 m is fine)
  S.forEach((p, i) => { p.lonU = i === 0 ? p.lon : S[i - 1].lonU + ((p.lon - S[i - 1].lonU + 540) % 360 - 180); });
  const n = S.length, L = off, flat = p => ({ x: R * p.lonU * D, z: -R * Math.asinh(Math.tan(p.lat * D)), k: 1 / Math.cos(p.lat * D) });
  const F = S.map(flat), T = F.map((p, i) => { const a = F[Math.max(0, i - 1)], b = F[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; });
  const brg = S.map((p, i) => W.bearing(S[Math.max(0, i - 1)], S[Math.min(n - 1, i + 1)]));
  // bend.js scales lengths by (R + y)/R at height y above the sphere: lateral offsets on a deck (2-4 m above the town level) are reduced by that factor so that
  // the deck, the parapets and the piers are 10 m wide on the sphere (RD02 card), not 10.3-10.5 m (W5-C2)
  const cf = new Array(n).fill(1);
  const latRaw = (i, oo) => { if (!oo) return [S[i].lon, S[i].lat]; const q = W.destination(S[i], brg[i] + (oo > 0 ? 90 : -90), Math.abs(oo)); return [q.lon, q.lat]; };
  const lateral = (i, oo) => latRaw(i, oo * cf[i]);
  const ground = (i, oo) => { const [lo, la] = lateral(i, oo); return W.height(lo, la); };
  // ---- vertical alignment: climb at DECK.slope from each abutment to the base height, a hump at the tower (if any), rounded by a 2 m moving average
  const hS = S[0].h, hE = S[n - 1].h, humpS = o.pylonJoint !== undefined ? joints[o.pylonJoint] : o.pylonAt === undefined ? null : o.pylonAt;
  // the tower stands 4.5 m before the junction J-LM08 (towards J-P1) so that the maintenance stair of T11-02 has room at the node (W5b裁决)
  const pylonS = humpS === null ? null : humpS + (o.pylonShift || 0);
  const base = o.base || DECK.base;
  let A = S.map(p => Math.min(base, hS + DECK.slope * p.s, hE + DECK.slope * (L - p.s)));
  if (humpS !== null) A = A.map((a, i) => a + DECK.hump * (Math.abs(S[i].s - humpS) < DECK.humpHalf ? 0.5 * (1 + Math.cos(Math.PI * (S[i].s - humpS) / DECK.humpHalf)) : 0));
  A = A.map((a, i) => { const w = Math.min(4, i, n - 1 - i); let t = 0; for (let k = -w; k <= w; k++) t += A[i + k]; return t / (2 * w + 1); });
  for (let i = 0; i < n; i++) cf[i] = R / (R + (A[i] - BASE));
  const accessS = o.access ? (o.access.atJoint !== undefined ? joints[o.access.atJoint] : o.access.s) : null;
  const out = { ids, samples: S, alt: A, length: L, joints, strips: [], instances: {}, lines: {}, pylon: null, piers: [], navLights: [], lamps: [], flatOf: F, tangent: T, lateral, bearing: brg };
  const add = (type, i, oo, alt, extra = {}) => { const [lo, la] = lateral(i, oo); (out.instances[type] = out.instances[type] || []).push({ type, lon: lo, lat: la, alt, yaw: extra.yaw || 0, s: extra.s || [1, 1, 1], lean: extra.lean || [0, 0], tint: extra.tint || [1, 1, 1] }); return out.instances[type][out.instances[type].length - 1]; };
  const yawAlong = i => Math.atan2(-T[i][1], T[i][0]);              // local +x along the road
  const yawAcross = i => Math.atan2(T[i][0], T[i][1]);              // local +z along the road, +x across it (piers, caps, tower)
  const pitchAt = i => { const a = Math.max(0, i - 2), c = Math.min(n - 1, i + 2); return Math.atan((A[c] - A[a]) / Math.max(1e-6, S[c].s - S[a].s)); };   // the deck rises up to 14 %: rigid barrier pieces follow it
  const yawToward = (dx, dz) => Math.atan2(-dz, dx);
  const rightOf = i => [-T[i][1], T[i][0]];

  // ---- girder strips. cols: [offset, dy, colour]; outward: [lateral, vertical] direction the face looks
  const strip = (name, cols, outward, opts = {}) => {
    const m = cols.length, pos = [], col = [], idx = [];
    for (let i = 0; i < n; i++) {
      const k = F[i].k;
      for (let j = 0; j < m; j++) {
        const [oo, dy, ck] = cols[j]; let c = lin(COL[ck] || COL.concrete);
        if (ck === 'dash') { if (((S[i].s / 6) % 1) >= 0.45) c = lin(COL.asphalt); }
        if (opts.stain) { const f = 0.85 + 0.25 * hash(S[i].s * 0.7, oo * 3.3 + dy * 9); c = c.map(v => v * f); }
        const kk = 1 / Math.cos(lateral(i, oo)[1] * D);
        pos.push(F[i].x + (-T[i][1]) * oo * cf[i] * k, (A[i] + dy - BASE) * kk, F[i].z + T[i][0] * oo * cf[i] * k); col.push(c[0], c[1], c[2]);
      }
    }
    for (let i = 0; i + 1 < n; i++) for (let j = 0; j + 1 < m; j++) { const a = i * m + j, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d); }
    // winding: every triangle faces the requested direction (lateral component along the local right vector, vertical along +y)
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3, ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, i = Math.floor(idx[t] / m), r = rightOf(i);
      if (nx * r[0] * outward[0] + nz * r[1] * outward[0] + ny * outward[1] < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
    }
    out.strips.push({ name: 'bridge ' + ids.join('+') + ' ' + name, pos: Float32Array.from(pos), col: Float32Array.from(col), index: Uint32Array.from(idx), vertexCount: n * m, normals: true });
  };
  const gd = DECK.girder, sd = DECK.side;
  strip('top', TOPCOLS, [0, 1]);
  strip('side-left', [[-DECK.half, 0.01, 'concreteL'], [-DECK.half, -sd, 'concrete']], [-1, 0], { stain: true });
  strip('side-right', [[DECK.half, 0.01, 'concreteL'], [DECK.half, -sd, 'concrete']], [1, 0], { stain: true });
  strip('chamfer-left', [[-DECK.half, -sd, 'concrete'], [-3.2, -gd, 'concreteD']], [-0.35, -0.94], { stain: true });
  strip('chamfer-right', [[DECK.half, -sd, 'concrete'], [3.2, -gd, 'concreteD']], [0.35, -0.94], { stain: true });
  strip('under', [[-3.2, -gd, 'concreteD'], [3.2, -gd, 'concreteD']], [0, -1], { stain: true });

  // ---- parapets (concrete barrier pieces every 2 m on both kerbs), lamps (alternating sides every 16 m), expansion joints
  const jointSeg = [];
  for (let s = 1; s < L; s += 2) { const i = Math.min(n - 1, Math.round(s / 0.5)); for (const side of [-1, 1]) if (!(o.access && side === -1 && s > accessS - 1.2 && s < accessS + 2.4)) add('barrierConcrete', i, side * 4.85, A[i] + 0.01, { yaw: yawAlong(i), lean: [0, pitchAt(i)] }); }
  let lampN = 0;
  for (let s = DECK.lampEvery / 2; s < L; s += DECK.lampEvery) {
    const i = Math.min(n - 1, Math.round(s / 0.5)), side = lampN++ % 2 ? 1 : -1, r = rightOf(i);
    if (pylonS !== null && Math.abs(S[i].s - pylonS) < 2) continue;
    const it = add('lamp', i, side * 4.4, A[i] + 0.01, { yaw: yawToward(-side * r[0], -side * r[1]) }); it.s = [0.85, 0.85, 0.85];
    out.lamps.push({ i, s: S[i].s, side });
    add('lampPool', i, side * 1.2, A[i] + 0.03, {});
  }
  for (let s = DECK.jointEvery; s < L - 3; s += DECK.jointEvery) {
    const i = Math.min(n - 1), ii = Math.round(s / 0.5), [la, lb] = [lateral(ii, -DECK.half + 0.2), lateral(ii, DECK.half - 0.2)];
    jointSeg.push([{ lon: la[0], lat: la[1], alt: A[ii] + 0.06 }, { lon: lb[0], lat: lb[1], alt: A[ii] + 0.06 }]); void i;
  }
  out.lines.joints = jointSeg;
  out.lines.edgeL = S.map((p, i) => { const [lo, la] = lateral(i, -DECK.half); return { lon: lo, lat: la, alt: A[i] + 0.01 }; });
  out.lines.edgeR = S.map((p, i) => { const [lo, la] = lateral(i, DECK.half); return { lon: lo, lat: la, alt: A[i] + 0.01 }; });
  out.lines.edgeLU = S.map((p, i) => { const [lo, la] = lateral(i, -DECK.half); return { lon: lo, lat: la, alt: A[i] - sd }; });
  out.lines.edgeRU = S.map((p, i) => { const [lo, la] = lateral(i, DECK.half); return { lon: lo, lat: la, alt: A[i] - sd }; });

  // ---- piers: stations every ~11 m from 7 m inside each end; a pier stands where the girder underside is 0.6 m above the lowest seabed under it
  const nSt = Math.max(1, Math.round((L - 14) / DECK.pierEvery)), stations = [];
  for (let k = 0; k <= nSt; k++) stations.push(7 + (L - 14) * k / nSt);
  if (pylonS !== null) stations.push(pylonS);
  const pylonOffsets = [-DECK.towerLegO, DECK.towerLegO];
  for (const s of stations) {
    const i = Math.min(n - 1, Math.round(s / 0.5)), isTower = pylonS !== null && Math.abs(s - pylonS) < 0.3;
    if (isTower) continue;                                                    // the tower legs carry their own foundations
    const cols = [-2.6, 2.6].map(oo => ({ o: oo, g: ground(i, oo) })), seabed = Math.min(...cols.map(c => c.g)), under = A[i] - gd - 0.9;
    if (under - seabed < 0.6) continue;
    const pier = { i, s: S[i].s, seabed, capBottom: A[i] - gd - 0.9, capTop: A[i] - gd, columns: [] };
    add('pierCap', i, 0, A[i] - gd, { yaw: yawAcross(i) });
    for (const c of cols) {
      const g = c.g, foot = Math.max(g, seabed) + (g < -0.3 ? 0.8 : 0), len = under - foot;
      if (g < -0.3) add('pierFooting', i, c.o, g, { yaw: yawAcross(i) });
      add('pierColumn', i, c.o, foot, { yaw: yawAcross(i), s: [1, len, 1] });
      if (g < -0.9) add('pierFoot', i, c.o, 0, { yaw: yawAcross(i) });
      pier.columns.push({ o: c.o, ground: g, base: foot, top: under });
    }
    out.piers.push(pier);
    // navigation light on a deep-water pier: on the column's outer face 1.4 m above the sea, pulsing with a period of 6 s (phase per pier)
    if (seabed < -1.2) { for (const sd2 of [-1, 1]) { const oo = sd2 * (2.6 + 0.78), it = add('navLight', i, oo, 1.4, { yaw: 0, s: [1.6, 1.6, 1.6] }); out.navLights.push({ i, s: S[i].s, o: oo, alt: 1.4, phase: hash(S[i].s, sd2) }); void it; } }
  }

  // ---- cable-stayed tower at the junction of the two ocean spans
  if (pylonS !== null) {
    const i = Math.round(pylonS / 0.5), top = A[i] + DECK.towerAbove, legs = [];
    for (const oo of pylonOffsets) {
      const g = ground(i, oo), foot = Math.max(g, g < -0.3 ? g + 0.8 : g), len = A[i] + 0.5 - foot;
      if (g < -0.3) add('pierFooting', i, oo, g, { yaw: yawAcross(i), s: [0.9, 1, 0.9] });
      add('pierColumn', i, oo, foot, { yaw: yawAcross(i), s: [0.85, len, 0.85] });
      if (g < -0.9) add('pierFoot', i, oo, 0, { yaw: yawAcross(i), s: [0.8, 1, 0.8] });
      legs.push({ o: oo, ground: g, base: foot });
    }
    add('pylonTop', i, 0, A[i] + 0.5, { yaw: yawAcross(i) });
    // stays: from each leg head to the deck kerb on both sides along the road, 6 per direction per leg, fanned down the leg
    const stays = [];
    for (const oo of pylonOffsets) for (const dir of [-1, 1]) for (let k = 0; k < 6; k++) {
      const ii = Math.min(n - 1, Math.max(0, i + dir * Math.round((6 + k * 4) / 0.5))), sgn = Math.sign(oo), a = lateral(i, oo), b = lateral(ii, sgn * (DECK.half - 0.1));
      stays.push([{ lon: a[0], lat: a[1], alt: top - 0.5 - k * 0.55 }, { lon: b[0], lat: b[1], alt: A[ii] + 0.3 }]);
    }
    out.lines.stays = stays;
    out.pylon = { s: pylonS, i, lon: S[i].lon, lat: S[i].lat, deck: A[i], top, above: DECK.towerAbove, legs };
  }
  // ---- T11-02 maintenance stair (LM08 and RD02 cards): a gate in the north parapet, a gangway out to a two-flight steel stair hung on the north face of the girder
  // (flight A runs away from the gate, a landing, flight B returns to the node), ending on a small wooden landing at LM08-south; riser 0.2 m, tread 0.26 m
  if (o.access) {
    const s0 = accessS, i0 = Math.round(s0 / 0.5), top = A[i0], riser = 0.2, treadL = 0.26, nFl = Math.round((top - 0.04) / riser / 2), grd = ground(i0, -5.4), acc = { s: s0, i: i0, top, steps: [], posts: 0, landing: null };
    const dz = zz => -(5.0 + zz);                               // lateral offset (negative = north side) of a point zz metres outside the girder face
    const stairAlt = k => top - 0.05 - riser * (k + 1);
    const yawFwd = Math.atan2(-T[i0][1], T[i0][0]);              // local +x along the bridge
    const place = (type, xs, zz, alt, ex = {}) => { const ii = Math.min(n - 1, Math.max(0, i0 + Math.round(xs / 0.5))), r = add(type, ii, dz(zz), alt, { yaw: ex.yaw === undefined ? yawFwd : ex.yaw, s: ex.s }); return r; };
    // gangway from the gate (parapet gap) out to flight A: 1.2 m of plate at deck level
    place('steelPlate', 0.0 + 0.9, 0.9, top - 0.03, { s: [1.8, 1, 1.8] });
    // flight A (outer, z = 1.35): from x = 0.9 down to the landing; flight B (inner, z = 0.4): back to x = 0
    const xA0 = 1.6;
    for (let k = 0; k < nFl; k++) { const x = xA0 + k * treadL; place('steelStep', x, 1.45, stairAlt(k)); acc.steps.push({ k, x, z: 1.45, alt: stairAlt(k) }); }
    const xL = xA0 + nFl * treadL, aL = stairAlt(nFl - 1) - riser;
    place('steelPlate', xL + 0.5, 0.95, aL, { s: [1.0, 1, 2.2] });
    for (let k = 0; k < nFl; k++) { const x = xL - (k + 1) * treadL + 0.0, alt = aL - riser * (k + 1); place('steelStep', x, 0.45, alt); acc.steps.push({ k: nFl + k, x, z: 0.45, alt }); }
    // rail posts every 1.3 m on both flights' outer sides and a 1.1 m high rope-less steel rail drawn as lines in the scene
    out.stairRails = [];
    for (const [zz, sgn] of [[1.9, 1], [0.0, 1]]) { const line = []; for (let x = xA0 - 0.4; x <= xL + 0.2; x += 1.3) { const k = Math.min(nFl - 1, Math.max(0, Math.round((x - xA0) / treadL))); const alt = zz > 1 ? stairAlt(k) : (aL - riser * (nFl - Math.max(0, Math.round((xL - x) / treadL)))); const ii = Math.min(n - 1, i0 + Math.round(x / 0.5)); place('steelPost', x, zz, alt + 0.03); acc.posts++; const [lo, la] = lateral(ii, dz(zz)); line.push({ lon: lo, lat: la, alt: alt + 0.95 }); } out.stairRails.push(line); void sgn; }
    // landing at the node: 1.6 x 1.6 m wooden deck at the ground, flush with the beach
    const node = W.roadNetwork.nodeById[o.access.node], gl = Math.max(W.height(node.lon, node.lat), 0.04) + 0.1;
    const put = (type, lon, lat, alt, ex = {}) => { (out.instances[type] = out.instances[type] || []).push({ type, lon, lat, alt, yaw: ex.yaw || 0, s: ex.s || [1, 1, 1], lean: [0, 0], tint: [1, 1, 1] }); };
    acc.landing = { lon: node.lon, lat: node.lat, alt: gl, node: o.access.node };
    put('steelPlate', node.lon, node.lat, gl, { yaw: yawFwd, s: [1.6, 1, 1.6] });
    { const q = W.destination(node, W.bearing(S[i0], node) + 20, 1.1); put('lampSmall', q.lon, q.lat, gl, {}); }
    out.access = acc;
  }
  return out;
}

// ---- RD01 tunnel portals through the ridge (T01-05, span 6.5-29.5 m): the centre samples with the road bed altitude, for the arch geometry of roads.js
function tunnel(W, edgeId, bed) {
  const NET = W.roadNetwork, e = NET.edges.find(q => q.id === edgeId), sp = e.spans.find(q => q.type === 'tunnel'), S = NET.samplePath(e, 0.5);
  const idx = []; S.forEach((p, i) => { if (p.s >= sp.fromMeters - 1e-9 && p.s <= sp.toMeters + 1e-9) idx.push(i); });
  const F = S.map(p => ({ x: R * p.lon * D, z: -R * Math.asinh(Math.tan(p.lat * D)), k: 1 / Math.cos(p.lat * D) }));
  const T = F.map((p, i) => { const a = F[Math.max(0, i - 1)], b = F[Math.min(S.length - 1, i + 1)]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; });
  return { edge: edgeId, from: sp.fromMeters, to: sp.toMeters, length: sp.toMeters - sp.fromMeters, idx, samples: S, flatOf: F, tangent: T, bed: i => bed[i], innerR: 4.7, wallH: 1.0, shell: 0.7 };
}

const BRIDGE = { build, tunnel, DECK, COL };
if (typeof module !== 'undefined' && module.exports) module.exports = BRIDGE;
else global.BRIDGE = BRIDGE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
