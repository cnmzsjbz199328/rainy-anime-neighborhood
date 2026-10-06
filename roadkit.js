// Road cross-sections swept along world.js edges (W4): RD03 rural road, RD04 abandoned road, RD05 dirt road, RD07 boardwalk.
// Pure data (no THREE): the builder returns triangle strips in flat Mercator coordinates (see W3_SPEC section 2), instance records for the
// small parts (planks, piles, rope posts, lamps, weeds) and the edge lines used by the ink layer. section.js turns it into meshes.
// Every width and height below comes from the design cards (RD03, RD04, RD05, RD07) and world.js (the centre line is samplePath).
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6;
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255].map(srgb);
const hash = (a, b) => { let h = Math.imul(Math.round(a * 97), 374761393) ^ Math.imul(Math.round(b * 131), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// Profiles: lateral offset o (true metres, positive to the right of travel), lift l above the ground (or above the deck for the boardwalk), colour.
const COL = { asphalt: '#2f3645', asphaltL: '#3a4152', gravel: '#6a6458', gravelD: '#585349', grass: '#4f7d5b', grassD: '#3f6a50', ditch: '#27475a', ditchD: '#1f3a48', lip: '#7a7a82',
  crack: '#4a4e58', weed: '#5a6a48', dirt: '#6a5a46', dirtD: '#4a3f33', rut: '#3f362d', ruts: '#5a5040', deck: '#8a6a4c', deckD: '#6c5238', beam: '#5a4434', plankEdge: '#4a3a2c' };
const PROFILES = {
  // RD03: single carriageway 4.5 m (card: 4-5 m) with a gravel shoulder, a side ditch on the left and grass beyond
  RD03: { paved: [-2.25, 2.25], pts: [[-4.4, 0, 'grass'], [-3.7, 0, 'grassD'], [-3.55, -0.04, 'lip'], [-3.45, -0.3, 'ditchD'], [-2.95, -0.3, 'ditch'], [-2.85, -0.05, 'lip'], [-2.75, 0.0, 'gravel'], [-2.3, 0.02, 'gravelD'], [-2.25, 0.045, 'asphalt'], [2.25, 0.045, 'asphalt'], [2.3, 0.02, 'gravelD'], [2.75, 0.0, 'gravel'], [3.3, 0, 'grassD'], [4.2, 0, 'grass']] },
  // RD04: original width 5.5 m (card: 5-6 m), only 2.5 m (card: 2-3 m) still passable: cracked asphalt off-centre, weeds and gravel take the rest
  RD04: { paved: [-1.4, 1.1], pts: [[-3.6, 0, 'grass'], [-2.9, 0.0, 'weed'], [-2.75, 0.01, 'gravelD'], [-1.5, 0.02, 'weed'], [-1.4, 0.04, 'asphalt'], [1.1, 0.04, 'asphalt'], [1.2, 0.02, 'weed'], [2.75, 0.01, 'gravelD'], [2.9, 0.0, 'weed'], [3.6, 0, 'grass']] },
  // RD05: dirt track 3 m (card: 2.5-3.5 m), two ruts and a grass strip between them, grass verges
  RD05: { paved: [-1.5, 1.5], pts: [[-2.8, 0, 'grassD'], [-1.9, 0, 'grass'], [-1.55, 0.0, 'dirtD'], [-1.5, 0.01, 'dirt'], [-1.1, 0.0, 'rut'], [-0.7, 0.0, 'rut'], [-0.55, 0.02, 'dirt'], [-0.38, 0.06, 'grass'], [0.38, 0.06, 'grass'], [0.55, 0.02, 'dirt'], [0.7, 0.0, 'rut'], [1.1, 0.0, 'rut'], [1.5, 0.01, 'dirt'], [1.55, 0.0, 'dirtD'], [1.9, 0, 'grass'], [2.8, 0, 'grassD']] },
};
const DECK = { half: 1.0, planks: 0.32, pileEvery: 2.5, lampEvery: 10, minAbove: 0.9, followLift: 0.15 };   // boardwalk 2 m wide (card 1.5-2.5), piles 0.5-1.5 m above the water

// Sweep a profile along a polyline of {lon, lat}: triangle strips in flat Mercator coordinates; each profile point follows the terrain at its
// own lateral position (height() there) plus its lift. profile = [[offset (true m, + = right of travel), lift, colourKey], ...].
function sweep(W, pts, profile, name, jitter) {
  const n = pts.length, m = profile.length;
  const flat = p => ({ x: R * p.lon * D, z: -R * Math.asinh(Math.tan(p.lat * D)), k: 1 / Math.cos(p.lat * D) });
  const F = pts.map(flat), T = F.map((p, i) => { const a = F[Math.max(0, i - 1)], b = F[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; });
  const pos = [], col = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], br = W.bearing(a, b);
    for (let j = 0; j < m; j++) {
      const [o, l, c] = profile[j], q = o ? W.destination(pts[i], br + (o > 0 ? 90 : -90), Math.abs(o)) : pts[i], k = F[i].k, h = W.height(q.lon, q.lat);
      pos.push(F[i].x + (-T[i][1]) * o * k, (h + l - BASE) * k, F[i].z + T[i][0] * o * k);
      let cc = lin(COL[c]); if (jitter) cc = jitter(cc, o, pts[i].s || i);
      col.push(cc[0], cc[1], cc[2]);
    }
  }
  for (let i = 0; i + 1 < n; i++) for (let j = 0; j + 1 < m; j++) { const a = i * m + j, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d); }
  for (let t = 0; t < idx.length; t += 3) { const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3; const ny = (pos[B + 2] - pos[A + 2]) * (pos[C] - pos[A]) - (pos[B] - pos[A]) * (pos[C + 2] - pos[A + 2]); if (ny < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; } }
  return { name, pos: Float32Array.from(pos), col: Float32Array.from(col), index: Uint32Array.from(idx), vertexCount: n * m };
}

function build(W, edgeId, opts = {}) {
  const NET = W.roadNetwork, edge = NET.edges.find(e => e.id === edgeId), S = NET.samplePath(edge, 0.5), n = S.length;
  const cls = edge.class, out = { id: edgeId, class: cls, strips: [], instances: {}, lines: {}, centre: S.map(p => ({ lon: p.lon, lat: p.lat, alt: p.h, s: p.s })), widths: {}, length: NET.edgeLength(edge) };
  const flat = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) });
  const F = S.map(p => flat(p.lon, p.lat));
  // tangent / right vectors in the flat plane (x east, z south): right of travel = (-tz, tx)
  const T = F.map((p, i) => { const a = F[Math.max(0, i - 1)], b = F[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; });
  const add = (type, lon, lat, alt, o = {}) => { (out.instances[type] = out.instances[type] || []).push({ type, lon, lat, alt, yaw: o.yaw || 0, s: o.s || [1, 1, 1], lean: o.lean || [0, 0], tint: o.tint || [1, 1, 1] }); };
  // lateral point on the ground: lon/lat at `o` metres to the right of sample i
  const lateral = (i, o) => { if (!o) return [S[i].lon, S[i].lat]; const a = S[Math.max(0, i - 1)], b = S[Math.min(n - 1, i + 1)], br = W.bearing(a, b), p = W.destination(S[i], br + (o > 0 ? 90 : -90), Math.abs(o)); return [p.lon, p.lat]; };

  if (PROFILES[cls]) {
    const prof = PROFILES[cls], m = prof.pts.length;
    const jitter = cls === 'RD04' ? (c, o, sPos) => (Math.abs(o) < 1.5 ? c.map(v => v * (0.75 + 0.5 * hash(sPos * 2, o * 5))) : c)
      : cls === 'RD05' ? (c, o, sPos) => (Math.abs(o) > 1.0 && Math.abs(o) < 1.5 ? c.map(v => v * (0.85 + 0.3 * hash(sPos * 3, o * 7))) : c) : null;
    out.strips.push(sweep(W, S.map(p => ({ lon: p.lon, lat: p.lat, s: p.s })), prof.pts, cls + ' surface', jitter));
    out.widths = { paved: prof.paved[1] - prof.paved[0], total: prof.pts[m - 1][0] - prof.pts[0][0], pavedRange: prof.paved };
    // paved edge lines for the ink layer
    out.lines.edgeL = S.map((p, i) => { const [lo, la] = lateral(i, prof.paved[0]); return { lon: lo, lat: la, alt: W.height(lo, la) + 0.07 }; });
    out.lines.edgeR = S.map((p, i) => { const [lo, la] = lateral(i, prof.paved[1]); return { lon: lo, lat: la, alt: W.height(lo, la) + 0.07 }; });
    // small parts along the road
    if (cls === 'RD04') for (let s = 0.6; s < out.length; s += 0.9) { const i = Math.round(s / 0.5), side = hash(s, 3) < 0.5 ? -1 : 1, o = side * (0.3 + 1.0 * hash(s, 5)); const [lo, la] = lateral(i, o); add('weed', lo, la, W.height(lo, la), { yaw: hash(s, 9) * 6.28, s: [0.8, 0.6 + 0.6 * hash(s, 11), 0.8] }); }
    if (cls === 'RD05') for (let s = 0.4; s < out.length; s += 0.8) for (const side of [-1, 1]) { const i = Math.round(s / 0.5), o = side * (1.65 + 0.5 * hash(s, side * 7)); const [lo, la] = lateral(i, o); add(hash(s, 2) < 0.4 ? 'shrubLow' : 'tuft', lo, la, W.height(lo, la), { yaw: hash(s, 13) * 6.28, s: [1.0, 0.9 + 0.5 * hash(s, 13 + side), 1.0] }); }
    if (cls === 'RD05') for (const s of [3.0, 10.5]) { const i = Math.round(s / 0.5), [lo, la] = lateral(i, -1.9); add('stonePost', lo, la, W.height(lo, la), { s: [0.9, 1.0, 0.9] }); }
    return out;
  }

  if (cls === 'RD07') {
    // boardwalk: deck height above the sea (altitude 0): follows the terrain +0.15 m on land, never lower than 0.9 m (piles 0.5-1.5 m above water)
    const deck = h => Math.max(DECK.minAbove, h + DECK.followLift);
    const planks = [], pos = [], col = [], idx = [];
    // continuous side beams as a thin strip under the deck edge
    for (let i = 0; i < n; i++) for (const o of [-DECK.half, -DECK.half + 0.14, DECK.half - 0.14, DECK.half]) {
      const [lo, la] = lateral(i, o), k = F[i].k, h = W.height(lo, la), dk = deck(S[i].h);
      pos.push(F[i].x + (-T[i][1]) * o * k, (dk - 0.1 - BASE) * k, F[i].z + T[i][0] * o * k); const c = lin(COL.beam); col.push(...c);
      void h;
    }
    for (let i = 0; i + 1 < n; i++) { for (const j of [0, 2]) { const a = i * 4 + j, b = a + 1, c = a + 4, d = c + 1; idx.push(a, c, b, b, c, d); } }
    for (let t = 0; t < idx.length; t += 3) { const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3; const ny = (pos[B + 2] - pos[A + 2]) * (pos[C] - pos[A]) - (pos[B] - pos[A]) * (pos[C + 2] - pos[A + 2]); if (ny < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; } }
    out.strips.push({ name: 'RD07 beams', pos: Float32Array.from(pos), col: Float32Array.from(col), index: Uint32Array.from(idx), vertexCount: n * 4 });
    out.widths = { paved: 2 * DECK.half, deckAbove: [], pileAbove: [] };
    // planks across the deck, every 0.32 m
    for (let s = 0.15; s < out.length - 0.1; s += DECK.planks) {
      const i = Math.min(n - 1, Math.round(s / 0.5)), dk = deck(S[i].h), yaw = Math.atan2(T[i][0], T[i][1]) + Math.PI / 2;
      add('plank', S[i].lon, S[i].lat, dk - 0.08, { yaw, s: [1, 1, 1], tint: (() => { const k = 0.85 + 0.3 * hash(s, 19); return [k, k, k]; })() });
    }
    // piles under both edges every 2.5 m, from the sea bed (or ground) up to the deck
    let pileMin = Infinity, pileMax = 0;
    for (let s = 0.0; s <= out.length + 1e-6; s += DECK.pileEvery) for (const o of [-DECK.half + 0.08, DECK.half - 0.08]) {
      const i = Math.min(n - 1, Math.round(s / 0.5)), [lo, la] = lateral(i, o), ground = W.height(lo, la), dk = deck(S[i].h), top = dk - 0.1, len = Math.max(0.3, top - ground);
      add('pile', lo, la, ground, { s: [1, len, 1], yaw: hash(s, o) * 6.28 });
      const water = Math.max(ground, 0); if (ground < 0.02) { pileMin = Math.min(pileMin, dk); pileMax = Math.max(pileMax, dk); }
      void water;
    }
    out.widths.pileAboveWater = pileMax ? [pileMin, pileMax] : null;      // the deck altitude over open water = the pile height above the sea surface
    // rope rails: a post every 2.5 m on both sides, two ropes between them (lines)
    const ropes = { L: [], R: [] };
    for (let s = 0.0; s <= out.length + 1e-6; s += DECK.pileEvery) for (const side of [-1, 1]) {
      const i = Math.min(n - 1, Math.round(s / 0.5)), [lo, la] = lateral(i, side * (DECK.half - 0.04)); add('ropePost', lo, la, deck(S[i].h), { yaw: 0 });
    }
    for (const side of [-1, 1]) for (const hh of [0.5, 0.85]) {
      const line = []; for (let i = 0; i < n; i += 2) { const [lo, la] = lateral(i, side * (DECK.half - 0.04)); line.push({ lon: lo, lat: la, alt: deck(S[i].h) + hh }); }
      (ropes[side < 0 ? 'L' : 'R']).push(line);
    }
    out.lines.ropes = [...ropes.L, ...ropes.R];
    // small lamps every 10 m on the right side, a life ring at 15 m, mooring bollards and a landing at the end
    for (let s = 5.0; s < out.length; s += DECK.lampEvery) { const i = Math.round(s / 0.5), [lo, la] = lateral(i, DECK.half + 0.12); add('lampSmall', lo, la, deck(S[i].h) - 0.1, { yaw: 0 }); }
    { const i = Math.round(15 / 0.5), [lo, la] = lateral(i, -(DECK.half - 0.04)); add('lifeRing', lo, la, deck(S[i].h), { yaw: Math.atan2(T[i][0], T[i][1]) }); }
    const iE = n - 1, endYaw = Math.atan2(T[iE][0], T[iE][1]), dkE = deck(S[iE].h);
    // landing platform 3 x 3 m beyond the last sample
    const brg = W.bearing(S[n - 2], S[n - 1]);
    for (let b = 0; b < 10; b++) { const c = W.destination(S[iE], brg, 0.2 + b * DECK.planks); add('plank', c.lon, c.lat, dkE - 0.08, { yaw: endYaw + Math.PI / 2, s: [1.5, 1, 1] }); }
    for (const sd of [-1.2, 1.2]) { const c = W.destination(S[iE], brg, 3.0), c2 = W.destination(c, brg + 90, sd); add('bollard', c2.lon, c2.lat, dkE, {}); }
    for (const sd of [-1.2, 1.2]) for (const f of [0.3, 3.2]) { const c = W.destination(S[iE], brg, f), c2 = W.destination(c, brg + 90, sd); add('pile', c2.lon, c2.lat, W.height(c2.lon, c2.lat), { s: [1, Math.max(0.3, dkE - 0.1 - W.height(c2.lon, c2.lat)), 1] }); }
    out.landing = { lon: S[iE].lon, lat: S[iE].lat, brg, deck: dkE };
    return out;
  }
  throw new Error('roadkit: no profile for ' + cls);
}

// ---- transition chain (user review of W4): the three rural edges of T03 are swept as ONE strip whose cross-section changes gradually, so an asphalt
// street turns into a cracked lane, then into a dirt track with weeds creeping in, instead of three profiles that meet at a hard joint.
// Every profile is sampled on one common lateral grid; at each sample the two neighbouring road classes are blended with a smoothstep over
// 2 x BLEND metres around their joint, and a wear value (0 at the town edge, 1 at the end) frays the paved edge and cracks the surface.
const BLEND = 3.2;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function evalProfile(prof, o) {          // lift and linear colour of a profile at lateral offset o (clamped at the ends)
  const P = prof.pts; if (o <= P[0][0]) return { l: P[0][1], c: lin(COL[P[0][2]]) }; if (o >= P[P.length - 1][0]) return { l: P[P.length - 1][1], c: lin(COL[P[P.length - 1][2]]) };
  let j = 0; while (P[j + 1][0] < o) j++;
  const t = (o - P[j][0]) / (P[j + 1][0] - P[j][0]), ca = lin(COL[P[j][2]]), cb = lin(COL[P[j + 1][2]]);
  return { l: P[j][1] + (P[j + 1][1] - P[j][1]) * t, c: ca.map((v, i) => v + (cb[i] - v) * t) };
}
function chain(W, ids) {
  const NET = W.roadNetwork, edges = ids.map(id => NET.edges.find(e => e.id === id)), classes = edges.map(e => e.class);
  const S = [], edgeOf = []; let off = 0; const joints = [];
  edges.forEach((e, k) => { const P = NET.samplePath(e, 0.5); P.forEach((p, i) => { if (k > 0 && i === 0) return; S.push({ ...p, s: p.s + off }); edgeOf.push(k); }); off += NET.edgeLength(e); if (k + 1 < edges.length) joints.push(off); });
  const n = S.length, total = off, flat = p => ({ x: R * p.lon * D, z: -R * Math.asinh(Math.tan(p.lat * D)), k: 1 / Math.cos(p.lat * D) });
  const F = S.map(flat), T = F.map((p, i) => { const a = F[Math.max(0, i - 1)], b = F[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; });
  const grid = [...new Set(classes.flatMap(c => PROFILES[c].pts.map(q => +q[0].toFixed(3))).concat([-0.6, -0.3, 0.3, 0.6, -1.0, 1.0, -2.0, 2.0]))].sort((a, b) => a - b), m = grid.length;
  const pos = [], col = [], idx = [], paved = [], wearOf = [];
  const profile = i => {                 // class k = u(k-1) - u(k), where u(k) steps 0 -> 1 over 2 x BLEND metres around joint k
    const u = joints.map(jt => smooth(jt - BLEND, jt + BLEND, S[i].s)), w = classes.map((_, k) => (k === 0 ? 1 : u[k - 1]) - (k < joints.length ? u[k] : 0));
    return w;
  };
  for (let i = 0; i < n; i++) {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(n - 1, i + 1)], br = W.bearing(a, b), w = profile(i), wear = smooth(0, total * 0.85, S[i].s);
    wearOf.push(wear);
    const pl = w.reduce((s, v, k) => s + v * PROFILES[classes[k]].paved[0], 0), pr = w.reduce((s, v, k) => s + v * PROFILES[classes[k]].paved[1], 0);
    paved.push([pl, pr]);
    for (let j = 0; j < m; j++) {
      const o = grid[j], q = o ? W.destination(S[i], br + (o > 0 ? 90 : -90), Math.abs(o)) : S[i], k = F[i].k, h = W.height(q.lon, q.lat);
      let lift = 0, c = [0, 0, 0]; w.forEach((wk, kk) => { if (wk > 1e-4) { const e = evalProfile(PROFILES[classes[kk]], o); lift += wk * e.l; c = c.map((v, ci) => v + wk * e.c[ci]); } });
      // wear: the paved edge frays (a hashed mix toward gravel and weed) and the surface cracks more as the road gets older
      const distEdge = Math.min(Math.abs(o - pl), Math.abs(o - pr)), inside = o > pl && o < pr;
      const hz = hash(S[i].s * 2.1, o * 9.3), hz2 = hash(S[i].s * 0.7, o * 3.1);
      if (distEdge < 0.9 && wear > 0.05) { const fray = (inside ? 0.0 : 0.35) + wear * 0.8, mixv = Math.max(0, Math.min(1, (hz - (1 - fray * (1 - distEdge / 0.9))) * 4)); if (mixv > 0) { const g = lin(hz2 < 0.5 ? COL.weed : COL.gravel); c = c.map((v, ci) => v + (g[ci] - v) * mixv); } }
      if (inside && wear > 0.1) { const crack = hash(S[i].s * 3.3, o * 5.7); if (crack > 1 - 0.18 * wear) { const g = lin(COL.crack); c = c.map((v, ci) => v + (g[ci] - v) * 0.7); } c = c.map(v => v * (1 - 0.1 * wear + 0.2 * wear * hz2)); }
      pos.push(F[i].x + (-T[i][1]) * o * k, (h + lift - BASE) * k, F[i].z + T[i][0] * o * k); col.push(c[0], c[1], c[2]);
    }
  }
  for (let i = 0; i + 1 < n; i++) for (let j = 0; j + 1 < m; j++) { const a = i * m + j, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d); }
  for (let t = 0; t < idx.length; t += 3) { const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3; const ny = (pos[B + 2] - pos[A + 2]) * (pos[C] - pos[A]) - (pos[B] - pos[A]) * (pos[C + 2] - pos[A + 2]); if (ny < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; } }
  // weeds and tufts creep in along the paved edge: none at the town edge, more and more with wear (the RD04 / RD05 parts add their own in build())
  const instances = {};
  for (let st = 1.5; st < joints[0]; st += 0.7) {
    const i = Math.round(st / 0.5), wear = wearOf[i]; if (hash(st, 41) > wear * 1.2) continue;
    const side = hash(st, 43) < 0.5 ? -1 : 1, o = (side < 0 ? paved[i][0] : paved[i][1]) + side * (0.1 + 0.9 * hash(st, 47)), a = S[Math.max(0, i - 1)], b = S[Math.min(n - 1, i + 1)], q = W.destination(S[i], W.bearing(a, b) + (side > 0 ? 90 : -90), Math.abs(o));
    const type = hash(st, 49) < 0.5 ? 'tuft' : 'weed'; (instances[type] = instances[type] || []).push({ type, lon: q.lon, lat: q.lat, alt: W.height(q.lon, q.lat), yaw: hash(st, 53) * 6.28, s: [0.9, 0.6 + 0.6 * hash(st, 59), 0.9], lean: [0, 0], tint: [1, 1, 1] });
  }
  const lateral = (i, o) => { const a = S[Math.max(0, i - 1)], b = S[Math.min(n - 1, i + 1)], br = W.bearing(a, b), q = W.destination(S[i], br + (o > 0 ? 90 : -90), Math.abs(o)); return [q.lon, q.lat]; };
  const lines = { edgeL: S.map((p, i) => { const [lo, la] = lateral(i, paved[i][0]); return { lon: lo, lat: la, alt: W.height(lo, la) + 0.07 }; }), edgeR: S.map((p, i) => { const [lo, la] = lateral(i, paved[i][1]); return { lon: lo, lat: la, alt: W.height(lo, la) + 0.07 }; }) };
  return { ids, classes, joints, samples: S, instances, strip: { name: 'T03 transition chain', pos: Float32Array.from(pos), col: Float32Array.from(col), index: Uint32Array.from(idx), vertexCount: n * m }, grid, paved, wear: wearOf, lines, length: total };
}

const ROADKIT = { build, sweep, chain, PROFILES, DECK, COL, lin, BLEND };
if (typeof module !== 'undefined' && module.exports) module.exports = ROADKIT;
else global.ROADKIT = ROADKIT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
