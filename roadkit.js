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
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / Math.max(1e-9, b - a))); return t * t * (3 - 2 * t); };

// Profiles: lateral offset o (true metres, positive to the right of travel), lift l above the ground (or above the deck for the boardwalk), colour.
const COL = { asphalt: '#2f3645', asphaltL: '#3a4152', gravel: '#6a6458', gravelD: '#585349', grass: '#4f7d5b', grassD: '#3f6a50', ditch: '#27475a', ditchD: '#1f3a48', lip: '#7a7a82',
  crack: '#4a4e58', line: '#c9cfc4', dash: '#c9cfc4', snowTrack: '#bccfe2', snowEdge: '#d4e4f0', concreteL: '#7c828c', weed: '#5a6a48', dirt: '#6a5a46', dirtD: '#4a3f33', rut: '#3f362d', ruts: '#5a5040', deck: '#8a6a4c', deckD: '#6c5238', beam: '#5a4434', plankEdge: '#4a3a2c',
  kerb: '#8a8f99', pavement: '#8f8a7c' };   // kerb = the RD02 deck's concrete kerb (bridge.js concreteL), for the approaches (W8f-a)
const INNER_SHOULDER_COLOR = lin(COL.asphalt);
const PROFILES = {
  // RD03: single carriageway 4.5 m (card: 4-5 m) with a gravel shoulder, a side ditch on the left and grass beyond
  RD03: { paved: [-2.25, 2.25], pts: [[-4.4, 0, 'grass'], [-3.7, 0, 'grassD'], [-3.55, -0.04, 'lip'], [-3.45, -0.3, 'ditchD'], [-2.95, -0.3, 'ditch'], [-2.85, -0.05, 'lip'], [-2.75, 0.0, 'gravel'], [-2.3, 0.02, 'gravelD'], [-2.25, 0.045, 'asphalt'], [2.25, 0.045, 'asphalt'], [2.3, 0.02, 'gravelD'], [2.75, 0.0, 'gravel'], [3.3, 0, 'grassD'], [4.2, 0, 'grass']] },
  // RD04: original width 5.5 m (card: 5-6 m), only 2.5 m (card: 2-3 m) still passable: cracked asphalt off-centre, weeds and gravel take the rest
  RD04: { paved: [-1.4, 1.1], pts: [[-3.6, 0, 'grass'], [-2.9, 0.0, 'weed'], [-2.75, 0.01, 'gravelD'], [-1.5, 0.02, 'weed'], [-1.4, 0.04, 'asphalt'], [1.1, 0.04, 'asphalt'], [1.2, 0.02, 'weed'], [2.75, 0.01, 'gravelD'], [2.9, 0.0, 'weed'], [3.6, 0, 'grass']] },
  // RD05: dirt track 3 m (card: 2.5-3.5 m), two ruts and a grass strip between them, grass verges
  RD05: { paved: [-1.5, 1.5], pts: [[-2.8, 0, 'grassD'], [-1.9, 0, 'grass'], [-1.55, 0.0, 'dirtD'], [-1.5, 0.01, 'dirt'], [-1.1, 0.0, 'rut'], [-0.7, 0.0, 'rut'], [-0.55, 0.02, 'dirt'], [-0.38, 0.06, 'grass'], [0.38, 0.06, 'grass'], [0.55, 0.02, 'dirt'], [0.7, 0.0, 'rut'], [1.1, 0.0, 'rut'], [1.5, 0.01, 'dirt'], [1.55, 0.0, 'dirtD'], [1.9, 0, 'grass'], [2.8, 0, 'grassD']] },
};
// RD01 (W5): carriageway 7 m with a gravel shoulder 1 m each side, edge lines, a dashed centre line and a side ditch on both sides.
// The bed is the smoothed centre-line terrain and the grass beyond follows the terrain: that is the cut and the fill.
const rd01 = () => {
  const sh = ['gravel', 'gravelD'];
  const right = [[0.075, 0.046, 'dash', 1], [0.1, 0.045, 'asphalt', 1], [3.12, 0.03, 'asphalt', 1], [3.18, 0.032, 'line', 1], [3.3, 0.032, 'line', 1], [3.36, 0.03, 'asphalt', 1], [3.5, 0.025, 'asphalt', 1], [3.6, 0.015, sh[1], 1], [4.5, 0.0, sh[0], 1], [4.6, -0.04, 'lip', 1], [4.8, -0.36, 'ditchD', 1], [5.2, -0.38, 'ditch', 1], [5.6, -0.12, 'lip', 1], [7.2, 0, 'grassD', 0.35], [9.5, 0, 'grass', 0]];
  const left = right.map(([o, l, c, m]) => [-o, l, c, m]).reverse();
  return { paved: [-3.5, 3.5], bed: true, pts: [...left, ...right] };
};
PROFILES.RD01 = rd01();
// Town road sections read alignment and width from world.js, which reads the frozen layout.js data.
PROFILES.TOWN_MAIN = { paved: [-3.5, 3.5], pts: [[-6, 0.15, 'concreteL'], [-4, 0.15, 'concreteL'], [-3.5, 0.02, 'asphalt'], [3.5, 0.02, 'asphalt'], [4, 0.15, 'concreteL'], [6, 0.15, 'concreteL']] };
PROFILES.TOWN_BRANCH = { paved: [-3, 3], pts: [[-6, 0.15, 'concreteL'], [-4, 0.15, 'concreteL'], [-3, 0.02, 'asphalt'], [3, 0.02, 'asphalt'], [4, 0.15, 'concreteL'], [6, 0.15, 'concreteL']] };
PROFILES.TOWN_ALLEY = { paved: [-1.75, 1.75], pts: [[-1.75, 0.15, 'pavement'], [1.75, 0.15, 'pavement']] };
// RD01B (W8f-a): the bridge approach, the deck's own cross-section on land (bridge.js TOP: lanes, asphalt shoulders, a 0.4 m concrete kerb at 4.6-5.0 m) and an embankment
// beyond it (bed level to 5.15 m, then down to the terrain): the last cross-section before a bridge matches the deck's first one (W8_SPEC 12.1 C1)
PROFILES.RD01B = (() => { const right = [[0.075, 0.046, 'dash', 1], [0.1, 0.045, 'asphalt', 1], [3.12, 0.03, 'asphalt', 1], [3.18, 0.032, 'line', 1], [3.3, 0.032, 'line', 1], [3.36, 0.03, 'asphalt', 1], [3.5, 0.025, 'asphalt', 1],
  [4.5, 0.015, 'asphaltL', 1], [4.6, 0.01, 'kerb', 1], [5.0, 0.01, 'kerb', 1], [5.15, 0, 'grassD', 1], [7.2, 0, 'grassD', 0.35], [9.5, 0, 'grass', 0]];
  return { paved: [-5.0, 5.0], bed: true, pts: [...right.map(([o, l, c, m]) => [-o, l, c, m]).reverse(), ...right] }; })();
// RD08: no pavement; a compacted snow track about 2 m wide (card), a slightly lighter edge, the snow of the terrain around it (the verge takes the terrain colour)
PROFILES.RD08 = { paved: [-1.0, 1.0], pts: [[-3.4, 0, 'grass', 0], [-2.4, 0, 'grassD', 0], [-1.4, 0.0, 'snowEdge', 0], [-1.05, -0.04, 'snowTrack', 0], [-0.3, -0.06, 'snowTrack', 0], [0.3, -0.06, 'snowTrack', 0], [1.05, -0.04, 'snowTrack', 0], [1.4, 0.0, 'snowEdge', 0], [2.4, 0, 'grassD', 0], [3.4, 0, 'grass', 0]] };
// W8g-b (W8_SPEC 13.2 B4): the footprint of each cross-section, lateral offsets of the outer edges: sh = the shoulder (gravel, dirt, kerb), full = the whole cross-section
// of the road (paved + shoulder + ditch, to the outer lip of the ditch); beyond it the verge follows the terrain
const FOOT = { RD01: { sh: [-4.5, 4.5], full: [-5.6, 5.6] }, RD01B: { sh: [-5.0, 5.0], full: [-5.0, 5.0] },
  RD03: { sh: [-2.75, 2.75], full: [-3.55, 2.75] }, RD04: { sh: [-2.75, 2.75], full: [-2.75, 2.75] }, RD05: { sh: [-1.55, 1.55], full: [-1.55, 1.55] }, RD08: { sh: [-1.4, 1.4], full: [-1.4, 1.4] } };
FOOT.TOWN_MAIN = { sh: [-4, 4], full: [-6, 6] }; FOOT.TOWN_BRANCH = { sh: [-4, 4], full: [-6, 6] }; FOOT.TOWN_ALLEY = { sh: [-1.75, 1.75], full: [-1.75, 1.75] };
for (const k of Object.keys(FOOT)) PROFILES[k].foot = FOOT[k];
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
    // planks across the deck, every 0.32 m: yaw = atan2(tx, tz) turns the plank's long local x across the tangent (no extra quarter turn)
    for (let s = 0.15; s < out.length - 0.1; s += DECK.planks) {
      const i = Math.min(n - 1, Math.round(s / 0.5)), dk = deck(S[i].h), yaw = Math.atan2(T[i][0], T[i][1]);      // the 2 m long axis (local x) across the deck (W8f-a)
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
    for (let b = 0; b < 10; b++) { const c = W.destination(S[iE], brg, 0.2 + b * DECK.planks); add('plank', c.lon, c.lat, dkE - 0.08, { yaw: endYaw, s: [1.5, 1, 1] }); }      // 3.0 m across, 10 planks = 3.2 m along
    for (const sd of [-1.2, 1.2]) { const c = W.destination(S[iE], brg, 3.0), c2 = W.destination(c, brg + 90, sd); add('bollard', c2.lon, c2.lat, dkE, {}); }
    for (const sd of [-1.2, 1.2]) for (const f of [0.3, 3.2]) { const c = W.destination(S[iE], brg, f), c2 = W.destination(c, brg + 90, sd); add('pile', c2.lon, c2.lat, W.height(c2.lon, c2.lat), { s: [1, Math.max(0.3, dkE - 0.1 - W.height(c2.lon, c2.lat)), 1] }); }
    out.landing = { lon: S[iE].lon, lat: S[iE].lat, brg, deck: dkE };
    return out;
  }
  throw new Error('roadkit: no profile for ' + cls);
}

const BLEND = 3.2;
// ---- W5 route builder: Any list of edges (each optionally reversed) is swept as ONE strip; neighbouring classes
// blend their whole cross-section over 2 x blend metres; a virtual lead class (the town's own asphalt) wears into the first real class; the
// wear value frays the paved edge, cracks the surface and grows weeds in 5 m bins (a count per bin that never decreases away from the town).
// Classes with bed:true (RD01) lie on a smoothed centre-line bed (with a straight run through tunnels), the others follow the terrain.
// W8f-a (W8_SPEC 12.1 C) joins the routes to the bridges and to each other:
//   o.abut = { start | end: { at(t) -> { lon, lat }, T, brg, grade } }: an RD02 abutment at that end. Within T metres of the node the centre line follows the common-tangent
//     fillet at(t) (t < 0 on the road, > 0 on the bridge; brg = its bearing of increasing t at the node), and the end sample takes that bearing, so the road's last cross-section
//     and the deck's first one are the same line. An approach on the road side carries a parabolic vertical curve from the road's grade to the deck's grade (fill only, the
//     node is raised; the bridge starts at that altitude); the cross-section blends into RD01B (the deck's lanes, shoulders and kerb, an embankment instead of the ditch) over
//     the APB metres before the approach, the surface wear goes to 0 and the lateral offsets take the deck's factor R / (R + alt - 1.6) (bridge.js) toward the node.
//   o.chain = { c0, dir }: the centre dashes follow the chainage c0 + dir * s of the whole T01 ring (continuous over the bridges).
//   o.mouths = [{ s0, s1, side, to }]: the trunk at a T junction: between the stations s0 and s1 the columns of that side from 4.5 m out to `to` lie flat on the bed (no ditch).
//   o.ramp = { end: 'start' | 'end', len, target(lon, lat) }: a branch meets the junction paving: its last row is lifted (or lowered) to target() for the paved columns, the
//     change fades over len metres along the road and to nothing at the outer edge of the verge.
const ASPH = { asphalt: 1, asphaltL: 1 }, APB = 8;          // APB: metres before an approach over which the cross-section becomes RD01B (paved width 7 -> 10 m at <= 0.6 m/m, W5-C9)
function route(W, segs, o = {}) {
  const NET = W.roadNetwork, BL = o.blend || BLEND, AB = o.abut || {}, ENDS = ['start', 'end'].filter(k => AB[k]), TURNS = o.turns || [];
  const edges = segs.map(sg => NET.edges.find(e => e.id === sg.id));
  let classes = edges.map(e => e.class);
  const S = [], edgeOf = []; let off = 0; let joints = [];
  edges.forEach((e, k) => {
    let P = NET.samplePath(e, 0.5); const len = NET.edgeLength(e);
    if (segs[k].rev) P = P.slice().reverse().map(p => ({ ...p, s: len - p.s }));
    P.forEach((p, i) => { if (k > 0 && i === 0) return; S.push({ ...p, h: W.height(p.lon, p.lat), s: p.s + off }); edgeOf.push(k); });
    off += len; if (k + 1 < edges.length) joints.push(off);
  });
  if (joints.some((jt, k) => k && jt <= joints[k - 1])) throw new Error(`roadkit.route ${segs.map(q => q.id).join('+')}: class joints out of order (${joints.join(', ')})`);
  if (o.trimStart) { while (S.length > 2 && S[0].s < o.trimStart) { S.shift(); edgeOf.shift(); } }      // start beyond the edge of a wider road it branches from
  if (o.trimEnd) { while (S.length > 2 && S[S.length - 1].s > off - o.trimEnd) { S.pop(); edgeOf.pop(); } }       // stop short of a junction on a wider road
  const n = S.length, total = S[n - 1].s, flat = p => ({ x: R * p.lon * D, z: -R * Math.asinh(Math.tan(p.lat * D)), k: 1 / Math.cos(p.lat * D) });
  const sNodeOf = which => (which === 'end' ? off : 0);
  // W8f-a abutment curves and W8f-c node turns can overlap on the short RN01-14 approach to J-W1.
  // Blend their centre-line offsets smoothly through the shared station range so neither curve is
  // overwritten at the overlap edge (which would create a visible heading kink at the bridge).
  const P2 = 2 * Math.PI * R, flatX = p => R * p.lon * D, flatZ = p => -R * Math.asinh(Math.tan(p.lat * D));
  const transitions = [];
  for (const which of ENDS) {
    const J = AB[which], sN = sNodeOf(which), T = J.Ta ?? J.T;
    transitions.push({ lo: which === 'start' ? 0 : sN - T, hi: which === 'start' ? T : sN,
      at: s => J.at(-Math.abs(sN - s)) });
  }
  for (const q of TURNS) transitions.push({ lo: q.station - q.fillet.Ta, hi: q.station + q.fillet.Tb, at: s => q.fillet.at(s - q.station) });
  transitions.sort((a, b) => a.lo - b.lo);
  const smoother = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / Math.max(1e-9, b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < n; i++) {
    const s = S[i].s, active = transitions.filter(q => s >= q.lo - 1e-9 && s <= q.hi + 1e-9);
    if (!active.length) continue;
    let p;
    const pair = transitions.length === 2 && Math.min(transitions[0].hi, transitions[1].hi) > Math.max(transitions[0].lo, transitions[1].lo)
      ? (() => { const a = transitions[0], b = transitions[1], unionLo = Math.min(a.lo, b.lo), unionHi = Math.max(a.hi, b.hi), margin = 0.5, lo = Math.max(unionLo, Math.max(a.lo, b.lo) - margin), hi = Math.min(unionHi, Math.min(a.hi, b.hi) + margin); return s >= lo && s <= hi ? { a, b, lo, hi } : null; })()
      : null;
    if (pair) {
      const a = pair.a.at(s), b = pair.b.at(s), refX = flatX(S[i]), ax0 = flatX(a), bx0 = flatX(b), ax = ax0 + P2 * Math.round((refX - ax0) / P2), bx = bx0 + P2 * Math.round((refX - bx0) / P2), az = flatZ(a), bz = flatZ(b), w = smoother(pair.lo, pair.hi, s), x = ax + (bx - ax) * w, z = az + (bz - az) * w;
      p = { lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D };
    }
    else if (active.length === 1) p = active[0].at(s);
    else {
      let a = active[0].at(s), ax = flatX(a), az = flatZ(a), refX = flatX(S[i]); ax += P2 * Math.round((refX - ax) / P2);
      for (let k = 1; k < active.length; k++) {
        const prev = active[k - 1], next = active[k], b = next.at(s), bx0 = flatX(b), bz = flatZ(b), bx = bx0 + P2 * Math.round((refX - bx0) / P2), lo = Math.max(prev.lo, next.lo), hi = Math.min(prev.hi, next.hi), w = hi > lo ? smoother(lo, hi, s) : (s >= hi ? 1 : 0);
        ax += (bx - ax) * w; az += (bz - az) * w;
      }
      const lat = Math.atan(Math.sinh(-az / R)) / D, lon = ax / (R * D); p = { lon, lat };
    }
    S[i] = { ...S[i], lon: p.lon, lat: p.lat, h: W.height(p.lon, p.lat) };
  }
  const F = S.map(flat), T = F.map((p, i) => { const a = F[Math.max(0, i - 1)], b = F[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; });
  const brg = S.map((p, i) => W.bearing(S[Math.max(0, i - 1)], S[Math.min(n - 1, i + 1)]));
  for (const which of ENDS) { const i = which === 'end' ? n - 1 : 0, b = (AB[which].brg + (which === 'end' ? 0 : 180)) % 360; brg[i] = b; T[i] = [Math.sin(b * D), -Math.cos(b * D)]; }
  const lateral = (i, off2) => { if (!off2) return [S[i].lon, S[i].lat]; const q = W.destination(S[i], brg[i] + (off2 > 0 ? 90 : -90), Math.abs(off2)); return [q.lon, q.lat]; };
  // road bed: smoothed centre-line terrain; inside a tunnel the straight run between the two portals
  // the bed never sinks below the terrain mesh anywhere across the 9 m width (the mesh is piecewise linear and differs from the centre-line height across the road)
  const raw = S.map((p, i) => { let h = p.h; if (PROFILES[classes[0]].bed || classes.some(c => PROFILES[c].bed)) for (const oo of [-4.5, -2.25, 2.25, 4.5]) { const [lo, la] = (() => { const q = W.destination(p, W.bearing(S[Math.max(0, i - 1)], S[Math.min(S.length - 1, i + 1)]) + (oo > 0 ? 90 : -90), Math.abs(oo)); return [q.lon, q.lat]; })(); if (i > 5 && i < S.length - 6) h = Math.max(h, Math.min(W.height(lo, la), p.h + 0.08)); } return h; }); const bed = new Array(n);
  { let i = 0; while (i < n) { if (S[i].span === 'tunnel') { let j = i; while (j < n && S[j].span === 'tunnel') j++; const a = Math.max(0, i - 1), b = Math.min(n - 1, j); for (let k = i; k < j; k++) raw[k] = raw[a] + (raw[b] - raw[a]) * (S[k].s - S[a].s) / Math.max(1e-6, S[b].s - S[a].s); i = j; } else i++; } }
  const avg = (arr, win) => arr.map((_, i) => { const w = Math.min(win, i, n - 1 - i); let a = 0; for (let k = -w; k <= w; k++) a += arr[i + k]; return a / (2 * w + 1); });
  { const b1 = avg(raw, 6).map((v, i) => Math.max(v, raw[i])), b2 = avg(b1, 3); for (let i = 0; i < n; i++) bed[i] = Math.max(b2[i], raw[i]);
    // grade limit 4 % along the bed (two passes), the two ends stay on the terrain so that bridges, junctions and the town edge meet it exactly
    const lim = (a, b) => 0.04 * Math.abs(S[b].s - S[a].s); const e0 = bed[0], e1 = bed[n - 1];
    for (let pass = 0; pass < 2; pass++) { for (let i = 1; i < n; i++) bed[i] = Math.max(bed[i - 1] - lim(i - 1, i), Math.min(bed[i - 1] + lim(i - 1, i), bed[i])); for (let i = n - 2; i >= 0; i--) bed[i] = Math.max(bed[i + 1] - lim(i, i + 1), Math.min(bed[i + 1] + lim(i, i + 1), bed[i])); }
    void e0; void e1; }
  // W8f-a approaches: grade of the bed toward the node at station s (over 2 m); length = (deck grade - road grade) / rate, 6-14 m; z(tau) = z0 + g0 tau + k tau^2 / 2 from the
  // approach start (tau = 0) to the node (tau = len), k = (deck grade - g0) / len: continuous and differentiable at both ends, the change of grade per metre is k
  const near = s => { let b = 0; for (let i = 1; i < n; i++) if (Math.abs(S[i].s - s) < Math.abs(S[b].s - s)) b = i; return b; };
  const aW = new Array(n).fill(0), approaches = [];
  for (const which of ENDS) {
    const J = AB[which], sN = sNodeOf(which), dir = which === 'end' ? 1 : -1;
    const gradeAt = s => { const a = near(s - dir), b = near(s + dir); return (bed[b] - bed[a]) / Math.max(1e-6, dir * (S[b].s - S[a].s)); };
    // the shortest length (6, 6.5 ... 14 m) whose change of grade per metre stays within the rate (1.35 points per metre, under the 1.5 of W5-C10)
    let len = J.maxLen || 14; for (let L0 = J.minLen || 6; L0 <= (J.maxLen || 14) + 1e-9; L0 += 0.5) { const iA0 = near(sN - dir * L0); if ((J.grade - gradeAt(S[iA0].s)) / Math.abs(sN - S[iA0].s) <= (J.rate || 0.0135)) { len = L0; break; } }
    const iA = near(sN - dir * len), L = Math.abs(sN - S[iA].s), z0 = bed[iA], g0 = gradeAt(S[iA].s), k = (J.grade - g0) / L, orig = bed.slice();
    let fillMin = Infinity, fillMax = -Infinity;
    for (let i = 0; i < n; i++) { const tau = L - Math.abs(sN - S[i].s); if (tau < -1e-9) continue; const z = z0 + g0 * tau + 0.5 * k * tau * tau; fillMin = Math.min(fillMin, z - orig[i]); fillMax = Math.max(fillMax, z - orig[i]); bed[i] = z; }
    for (let i = 0; i < n; i++) { const tau = L - Math.abs(sN - S[i].s); aW[i] = Math.max(aW[i], tau >= -1e-9 ? 1 : smooth(-APB, 0, tau)); }
    approaches.push({ which, node: which === 'end' ? n - 1 : 0, start: iA, s0: Math.min(S[iA].s, sN), s1: Math.max(S[iA].s, sN), len: L, alt: z0 + L * (g0 + J.grade) / 2, gRoad: g0, gDeck: J.grade, rate: k, fillMin, fillMax, terrain: S[which === 'end' ? n - 1 : 0].h });
  }
  const cf = bed.map((b, i) => 1 + aW[i] * (R / (R + b - BASE) - 1));        // the deck's lateral factor (bridge.js) toward the node
  // W8f-a: a route with an abutment has every column the deck's top has (bridge.js JOINT): the last cross-section shares all its vertices with the deck's first one
  const abG = ENDS.length;
  const grid = [...new Set([...classes, ...(abG ? ['RD01B'] : [])].flatMap(c => PROFILES[c].pts.map(q => +q[0].toFixed(3))).concat([-0.6, -0.3, 0, 0.3, 0.6, -1.0, 1.0, -2.0, 2.0], abG ? [-4.8, -4.7, -3.6, 3.6, 4.7, 4.8] : [], o.abutGrid || []))].sort((a, b) => a - b), m = grid.length;
  const evalP = (prof, oo, tc, cls) => {          // lift, colour (linear), bed mix, asphalt share of a profile at lateral offset oo; tc = the terrain's own colour there
    const P = prof.pts, colOf = key => (tc && key === 'grass' ? tc : tc && key === 'grassD' ? tc.map(v => v * 0.92) : lin(COL[key])), at = q => {
      let c = o.innerShoulderAsphalt && cls === 'RD03' && q[0] > 2.25 && q[0] <= 2.75 ? INNER_SHOULDER_COLOR : colOf(q[2]);
      // W8f-c G4: RD05 keeps its darker inner grass, then blends to the exact terrain colour at the outside edge.
      if (tc && cls === 'RD05' && Math.abs(oo) > 1.9) { const u = smooth(1.9, 2.8, Math.abs(oo)); c = c.map((v, i) => v + (tc[i] - v) * u); }
      return { l: q[1], c, m: q[3] || 0, a: ASPH[q[2]] || 0 };
    };
    if (oo <= P[0][0]) return at(P[0]); if (oo >= P[P.length - 1][0]) return at(P[P.length - 1]);
    let j = 0; while (P[j + 1][0] < oo) j++;
    const t = (oo - P[j][0]) / (P[j + 1][0] - P[j][0]), a = at(P[j]), b = at(P[j + 1]);
    return { l: a.l + (b.l - a.l) * t, c: a.c.map((v, i) => v + (b.c[i] - v) * t), m: a.m + (b.m - a.m) * t, a: a.a + (b.a - a.a) * t };
  };
  const wearMax = o.wearMax === undefined ? 1 : o.wearMax, wearLen = o.wearLen || total * 0.85, MO = o.mouths || [];
  const townEnd = joints.reduce((at, jt, k) => /^TOWN_/.test(classes[k]) && !/^TOWN_/.test(classes[k + 1]) ? jt : at, 0);
  const chainAt = s => (o.chain ? o.chain.c0 + o.chain.dir * s : s);
  const pos = [], col = [], idx = [], paved = [], carriageway = [], foot = [], wearOf = [], bedAlt = [], colAlt = [];
  // altitude of the swept surface at sample i, lateral offset oo (linear between the two profile columns): where things on the road must stand
  const surface = (i, oo) => { let j = 0; while (j + 2 < m && grid[j + 1] < oo) j++; const t = Math.max(0, Math.min(1, (oo - grid[j]) / (grid[j + 1] - grid[j]))); return colAlt[i * m + j] + (colAlt[i * m + j + 1] - colAlt[i * m + j]) * t; };
  let previousBlendEnd = -Infinity;
  const blendRanges = joints.map((jt, k) => {
    const from = classes[k], to = classes[k + 1];
    if (from === to) return null;
    const fromTown = /^TOWN_/.test(from), toTown = /^TOWN_/.test(to);
    if (fromTown !== toTown) {
      const townClass = fromTown ? from : to, len = townClass === 'TOWN_MAIN' ? 6 : townClass === 'TOWN_ALLEY' ? 5 : 15,
        lo = fromTown ? jt : jt - len, hi = fromTown ? jt + len : jt;
      previousBlendEnd = hi; return [lo, hi];
    }
    const lo = Math.max(jt - BL, previousBlendEnd + (Number.isFinite(previousBlendEnd) ? 1 : 0)), hi = Math.max(jt + BL, lo + 2 * BL);
    previousBlendEnd = hi; return [lo, hi];
  });
  const wts = i => {
    const s = S[i].s, weights = new Array(classes.length).fill(0); let active = 0;
    for (let k = 0; k < joints.length; k++) {
      if (classes[k] === classes[k + 1]) { active = k + 1; continue; }
      const range = blendRanges[k];
      if (s < range[0]) break;
      if (s < range[1]) { const t = Math.max(0, Math.min(1, (s - range[0]) / (range[1] - range[0]))); weights[k] = 1 - t; weights[k + 1] = t; return weights; }
      active = k + 1;
    }
    weights[active] = 1; return weights;
  };
  // Town coordinates are already expressed in the flat Mercator frame used by layout.js.
  // Convert their frozen metre widths to true geographic offsets before projecting them back
  // to that frame; otherwise the extra sec(latitude) factor widens each half by about 5 cm.
  // Keep the existing bridge/deck correction and blend the map-frame correction across class joints.
  for (let i = 0; i < n; i++) {
    const townWeight = wts(i).reduce((sum, wk, k) => sum + (/^TOWN_/.test(classes[k]) ? wk : 0), 0);
    cf[i] *= 1 + (Math.cos(S[i].lat * D) - 1) * townWeight;
  }
  // one column of sample i: profile mix of the classes, the approach blend into RD01B, the junction mouths
  const shoulderScale = (oo, sP) => {
    if (!classes.includes('RD05') || Math.abs(oo) <= 1.5) return 1;
    let width = 1;
    if (o.taperStart) width = Math.min(width, smooth(0, 3, Math.max(0, sP - S[0].s)));
    if (o.taperEnd) width = Math.min(width, smooth(0, 3, Math.max(0, S[n - 1].s - sP)));
    return width;
  };
  const roadOffset = (oo, sP) => Math.abs(oo) <= 1.5 ? oo : Math.sign(oo) * (1.5 + (Math.abs(oo) - 1.5) * shoulderScale(oo, sP));
  const southRingTurn = segs.findIndex(q => q.id === 'RN06-01'), southRingStation = southRingTurn > 0 ? joints[southRingTurn - 1] : null;
  // The shared grid contains offsets from every class on the route. Limit each row to
  // its own blended profile, otherwise an RD01B column paints concrete far across a town road.
  const rowLimits = S.map((_, i) => {
    const w = wts(i), a = aW[i], bound = end => {
      const v = w.reduce((sum, wk, k) => sum + wk * PROFILES[classes[k]].pts[end ? PROFILES[classes[k]].pts.length - 1 : 0][0], 0);
      const bridge = PROFILES.RD01B.pts[end ? PROFILES.RD01B.pts.length - 1 : 0][0];
      return v + (bridge - v) * a;
    };
    const limits = [bound(false), bound(true)];
    if (southRingStation !== null) {
      const k = 1 - smooth(4, 6, Math.abs(S[i].s - southRingStation));
      const half = w.reduce((sum, wk, j) => sum + wk * Math.max(Math.abs(PROFILES[classes[j]].paved[0]), Math.abs(PROFILES[classes[j]].paved[1])), 0) + 0.5;
      limits[0] += (Math.max(limits[0], -half) - limits[0]) * k;
      limits[1] += (Math.min(limits[1], half) - limits[1]) * k;
    }
    return limits;
  });
  const townCarriageways = global.LAYOUT ? [
    ...global.LAYOUT.roads.map(r => ({ axis: r.axis, at: r.at, half: global.LAYOUT.ROAD_TYPES[r.type].carriageway / 2 })),
    ...global.LAYOUT.alleys.map(a => ({ axis: 'x', at: (a.rect[1] + a.rect[3]) / 2, half: (a.rect[3] - a.rect[1]) / 2 })),
  ] : [];
  const column = (i, j, w) => {
    const oo = grid[j], effectiveO = Math.max(rowLimits[i][0], Math.min(rowLimits[i][1], oo)), sP = S[i].s, oPhys = roadOffset(effectiveO, sP), a = aW[i], [lo, la] = lateral(i, oPhys * cf[i]), g = W.height(lo, la),
      renderX = F[i].x - T[i][1] * oPhys * cf[i] * F[i].k, renderZ = F[i].z + T[i][0] * oPhys * cf[i] * F[i].k,
      tc = o.terrainColor && Math.abs(effectiveO) > 1.8 ? o.terrainColor(renderX / (R * D), Math.atan(Math.sinh(-renderZ / R)) / D) : null;
    let lift = 0, mix = 0, asp = 0, c = [0, 0, 0]; w.forEach((wk, kk) => { if (wk > 1e-4) { const e = evalP(PROFILES[classes[kk]], effectiveO, tc, classes[kk]); lift += wk * e.l; mix += wk * e.m; asp += wk * e.a; c = c.map((v, ci) => v + wk * e.c[ci]); } });
    if (a > 0) { const e = evalP(PROFILES.RD01B, effectiveO, tc); lift += (e.l - lift) * a; mix += (e.m - mix) * a; asp += (e.a - asp) * a; c = c.map((v, ci) => v + (e.c[ci] - v) * a); }
    for (const q of MO) if (Math.abs(effectiveO) > (q.from ?? 4.5) && sP >= q.s0 && sP <= q.s1 && Math.sign(effectiveO) === q.side && Math.abs(effectiveO) <= q.to + 1e-9) { lift = 0; mix = 1; }
    const taper = shoulderScale(effectiveO, sP);
    if (taper < 1 - 1e-9) {
      const edgeO = Math.sign(oo) * 1.5; let edgeLift = 0, edgeMix = 0;
      w.forEach((wk, kk) => { if (wk > 1e-4) { const e = evalP(PROFILES[classes[kk]], edgeO, null, classes[kk]); edgeLift += wk * e.l; edgeMix += wk * e.m; } });
      if (a > 0) { const e = evalP(PROFILES.RD01B, edgeO, null); edgeLift += (e.l - edgeLift) * a; edgeMix += (e.m - edgeMix) * a; }
      lift = edgeLift + (lift - edgeLift) * taper; mix = edgeMix + (mix - edgeMix) * taper;
    }
    if (tc && a < 1e-6 && (oo <= rowLimits[i][0] || oo >= rowLimits[i][1]) && w.some((wk, kk) => wk > 0 && ['RD03', 'RD04', 'RD05'].includes(classes[kk]))) c = tc;
    const townPaved = w.reduce((sum, wk, kk) => sum + wk * Math.max(...PROFILES[classes[kk]].paved.map(Math.abs)), 0);
    const activeTown = w.findIndex((wk, kk) => wk > 0.99 && /^TOWN_/.test(classes[kk])), ownAxis = Math.abs(T[i][0]) > Math.abs(T[i][1]) ? 'x' : 'z';
    const townCrossing = activeTown >= 0 && (Math.abs(effectiveO) > townPaved + 1e-6 || classes[activeTown] === 'TOWN_ALLEY') &&
      Math.abs(renderX) < 48 && Math.abs(renderZ) < 48 && townCarriageways.some(r => r.axis !== ownAxis && Math.abs((r.axis === 'x' ? renderZ : renderX) - r.at) <= r.half + 0.5);
    const ringCrossing = !o.innerShoulderAsphalt && Math.abs(effectiveO) > townPaved + 1e-6 &&
      ((Math.abs(Math.abs(renderX) - 54) <= 2.75 && Math.abs(renderZ) < 46) || (Math.abs(Math.abs(renderZ) - 54) <= 2.75 && Math.abs(renderX) < 46));
    if (townCrossing || ringCrossing) {
      lift = 0.015; mix = 1; c = lin(COL.asphalt); asp = 1;
    }
    return { oo, geomO: oPhys, lo, la, g, lift, mix, asp, c, base: g + (bed[i] - g) * mix };
  };
  // W8f-a ramp of a branch: the change of each column at the end row (paved columns to the target, the verge columns follow the nearer paved edge and taper to nothing)
  const RP = o.ramp || null, rampD = new Array(m).fill(0), iR = RP ? (RP.end === 'end' ? n - 1 : 0) : -1; let rampLen = 0;
  if (RP) {
    const w = wts(iR), ph = w.reduce((s2, v, k) => s2 + v * PROFILES[classes[k]].paved[1], 0), outer = Math.max(...grid.map(Math.abs));
    for (let j = 0; j < m; j++) { const v = column(iR, j, w); if (Math.abs(v.oo) <= ph + 1e-6) { const tg = RP.target(v.lo, v.la); rampD[j] = tg === null || tg === undefined ? 0 : tg - (v.base + v.lift); } }
    const edgeJ = side => { let b = -1; for (let j = 0; j < m; j++) if (Math.abs(grid[j]) <= ph + 1e-6 && Math.sign(grid[j]) === side && (b < 0 || Math.abs(grid[j]) > Math.abs(grid[b]))) b = j; return b; };
    const eL = edgeJ(-1), eR = edgeJ(1);
    for (let j = 0; j < m; j++) if (Math.abs(grid[j]) > ph + 1e-6) { const e = grid[j] < 0 ? eL : eR; rampD[j] = (e >= 0 ? rampD[e] : 0) * (1 - smooth(ph, outer, Math.abs(grid[j]))); }
    rampLen = typeof RP.len === 'function' ? RP.len(Math.max(...rampD.map(Math.abs))) : RP.len;
  }
  for (let i = 0; i < n; i++) {
    const w = wts(i), a = aW[i], townWeight = w.reduce((sum, wk, k) => sum + (/^TOWN_/.test(classes[k]) ? wk : 0), 0),
      wear = wearMax * smooth(townEnd, townEnd + wearLen, S[i].s) * (1 - a) * (1 - townWeight);
    wearOf.push(wear);
    let pl = w.reduce((s2, v, k) => s2 + v * PROFILES[classes[k]].paved[0], 0), pr = w.reduce((s2, v, k) => s2 + v * PROFILES[classes[k]].paved[1], 0);
    if (a > 0) { pl += (PROFILES.RD01B.paved[0] - pl) * a; pr += (PROFILES.RD01B.paved[1] - pr) * a; }
    paved.push([pl, pr]);
    let cl = w.reduce((s2, v, k) => s2 + v * PROFILES[classes[k]].paved[0], 0), cr = w.reduce((s2, v, k) => s2 + v * PROFILES[classes[k]].paved[1], 0);
    if (a > 0) { cl += (PROFILES.RD01.paved[0] - cl) * a; cr += (PROFILES.RD01.paved[1] - cr) * a; }
    carriageway.push([cl, cr]);
    { const fp = ['sh', 'full'].flatMap(key => [0, 1].map(e => { const v = w.reduce((s2, wk, k) => s2 + wk * PROFILES[classes[k]].foot[key][e], 0); return a > 0 ? v + (PROFILES.RD01B.foot[key][e] - v) * a : v; })); foot.push(fp); }
    const rampK = RP ? 1 - smooth(0, rampLen, Math.abs(S[i].s - S[iR].s)) : 0;
    for (let j = 0; j < m; j++) {
      const v = column(i, j, w), oo = v.oo, sP = S[i].s; let c = v.c, asp = v.asp, dashOn = false;
      let delta = rampD[j];
      if (RP && classes.includes('RD05') && Math.abs(grid[j]) > 1.5 && (o.taperStart || o.taperEnd)) {
        let e = j; for (let q = 0; q < m; q++) if (Math.sign(grid[q]) === Math.sign(grid[j]) && Math.abs(grid[q] - Math.sign(grid[j]) * 1.5) < Math.abs(grid[e] - Math.sign(grid[j]) * 1.5)) e = q;
        const taper = shoulderScale(grid[j], S[i].s); delta = rampD[e] + (rampD[j] - rampD[e]) * taper;
      }
      const base = v.base + delta * rampK;
      const distEdge = Math.min(Math.abs(oo - pl), Math.abs(oo - pr)), inside = oo > pl && oo < pr;
      const hz = hash(sP * 2.1, oo * 9.3), hz2 = hash(sP * 0.7, oo * 3.1);
      // centre dashes (6 m period, 45 % paint, on the ring's chainage) and edge lines that fade with the wear (fresh on the approaches, like the deck's)
      if (w.some((wk, kk) => wk > 0.5 && /^RD01/.test(classes[kk])) || a > 0.5) {
        if (Math.abs(oo) < 0.09) { const ph = ((chainAt(sP) / 6) % 1 + 1) % 1, on = ph < 0.45; dashOn = on; if (!on) { c = lin(COL.asphalt); asp = 1; } }      // the gap between dashes is asphalt (the town head too)
        if (Math.abs(Math.abs(oo) - 3.24) < 0.1) { const f = 1 - (0.55 * wear + 0.4 * hash(sP * 1.7, oo * 4.1)) * (1 - a); const as = lin(COL.asphalt); c = c.map((cv, ci) => as[ci] + (cv - as[ci]) * f); }
      }
      if (distEdge < 0.9 && wear > 0.05) { const fray = (inside ? 0.0 : 0.35) + wear * 0.8, mixv = Math.max(0, Math.min(1, (hz - (1 - fray * (1 - distEdge / 0.9))) * 4)); if (mixv > 0) { const gc = lin(hz2 < 0.5 ? COL.weed : COL.gravel); c = c.map((cv, ci) => cv + (gc[ci] - cv) * mixv); } }
      if (inside && wear > 0.1) { const crack = hash(sP * 3.3, oo * 5.7); if (crack > 1 - 0.18 * wear) { const gc = lin(COL.crack); c = c.map((cv, ci) => cv + (gc[ci] - cv) * 0.7); } c = c.map(cv => cv * (1 - 0.1 * wear + 0.2 * wear * hz2)); }
      // W8f-c G5: the painted dashes blend linearly to bridge white within the final 14 m of each abutment approach.
      if (dashOn && ENDS.length) { const blend = Math.max(...ENDS.map(which => Math.max(0, 1 - Math.abs(sNodeOf(which) - sP) / 14))); if (blend > 0) { const white = lin(COL.dash); c = c.map((cv, ci) => cv + (white[ci] - cv) * blend); } }
      pos.push(F[i].x + (-T[i][1]) * v.geomO * cf[i] * F[i].k, (base + v.lift - BASE) / Math.cos(v.la * D), F[i].z + T[i][0] * v.geomO * cf[i] * F[i].k); col.push(c[0], c[1], c[2]); colAlt.push(base + v.lift);
    }
    bedAlt.push(bed[i]);
  }
  const pushFace = (u, v, w) => {
    const U = u * 3, V = v * 3, Q = w * 3;
    const area2 = (pos[V] - pos[U]) * (pos[Q + 2] - pos[U + 2]) - (pos[V + 2] - pos[U + 2]) * (pos[Q] - pos[U]);
    if (Math.abs(area2) > 1e-10) idx.push(u, v, w);
  };
  for (let i = 0; i + 1 < n; i++) for (let j = 0; j + 1 < m; j++) { const a = i * m + j, b = a + 1, c = a + m, d = c + 1; pushFace(a, c, b); pushFace(b, c, d); }
  for (let t = 0; t < idx.length; t += 3) { const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3; const ny = (pos[B + 2] - pos[A + 2]) * (pos[C] - pos[A]) - (pos[B] - pos[A]) * (pos[C + 2] - pos[A + 2]); if (ny < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; } }
  // weeds and tufts along the paved edge: a deterministic count per 5 m bin that grows with the wear (none at the town edge)
  const instances = {}, add = (type, i, oo, extra = {}) => { const off2 = oo, [lo, la] = lateral(i, oo); (instances[type] = instances[type] || []).push({ type, lon: lo, lat: la, alt: surface(i, off2), yaw: extra.yaw || 0, s: extra.s || [1, 1, 1], lean: [0, 0], tint: extra.tint || [1, 1, 1], station: extra.station }); };
  const sBase = S[0].s;
  // W8f-a: the sharp kinks of the centre line (a node where the route turns by more than 15 deg: LM09-north, 22 deg): the swept cells fold on the inner side there, so no
  // weeds (and no barrier pieces, roads.js) stand within a metre or two of it
  const kinks = []; for (let i = 1; i + 1 < n; i++) { const d = Math.abs(((brg[i + 1] - brg[i - 1] + 540) % 360) - 180); if (d > 15 && !(kinks.length && Math.abs(S[i].s - kinks[kinks.length - 1]) < 1.5)) kinks.push(S[i].s); }
  if (o.weeds !== false) for (let b0 = sBase; b0 < total - 2.4; b0 += 5) {
    const len = Math.min(5, total - b0), mid = b0 + len / 2, wr = wearMax * smooth(townEnd, townEnd + wearLen, mid), cnt = Math.round(wr * (o.weedsPerBin || 5) * len / 5);
    for (let k = 0; k < cnt; k++) for (const side of [-1, 1]) {
      const st = b0 + 0.6 + (len - 1.2) * hash(b0 + k * 3.1, side * 7), i = Math.min(n - 1, Math.max(0, Math.round((st - sBase) / 0.5))); if (S[i].span === 'tunnel' || S[i].span === 'bridge') continue;
      const oo = (side < 0 ? paved[i][0] : paved[i][1]) + side * (0.1 + 0.9 * hash(st, 47 + side));
      if (MO.some(q => q.side === side && st > q.s0 - 0.5 && st < q.s1 + 0.5) || kinks.some(k => Math.abs(st - k) < 1.5)) continue;           // junction paving / sharp merge clear the whole swept row
      add(hash(st, 49) < 0.5 ? 'tuft' : 'weed', i, oo, { yaw: hash(st, 53) * 6.28, s: [0.9, 0.6 + 0.6 * hash(st, 59), 0.9], station: st });
    }
  }
  // Roadside plants sit on the actual swept triangles. At a short, curved junction edge the
  // nearest centreline row can differ from the row used to place the plant, so re-sample the
  // local mesh instead of leaving its provisional cross-section height in the instance data.
  const snapPlant = it => {
    const i0 = Math.max(0, Math.min(n - 2, Math.round((it.station - sBase) / 0.5))), P2 = 2 * Math.PI * R;
    const f = flat(it.lon, it.lat), x = f.x + P2 * Math.round((F[i0].x - f.x) / P2), z = f.z, bary = (A, B, C) => {
      const den = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]); if (Math.abs(den) < 1e-12) return null;
      const w1 = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / den, w2 = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / den, w3 = 1 - w1 - w2;
      return w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6 ? w1 * A[1] + w2 * B[1] + w3 * C[1] : null;
    };
    for (let i = Math.max(0, i0 - 3); i <= Math.min(n - 2, i0 + 3); i++) for (let j = 0; j + 1 < m; j++) {
      const v = q => [pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]], a = i * m + j, b = a + 1, c = a + m, d = c + 1;
      const h = bary(v(a), v(c), v(b)) ?? bary(v(b), v(c), v(d)); if (h !== null) { it.alt = BASE + h * Math.cos(it.lat * D); return; }
    }
  };
  for (const t of ['weed', 'tuft']) for (const it of instances[t] || []) if (it.station !== undefined) snapPlant(it);
  const lines = { edgeL: S.map((p, i) => { const [lo, la] = lateral(i, paved[i][0] * cf[i]); return { lon: lo, lat: la, alt: bedAlt[i] + 0.07 }; }), edgeR: S.map((p, i) => { const [lo, la] = lateral(i, paved[i][1] * cf[i]); return { lon: lo, lat: la, alt: bedAlt[i] + 0.07 }; }) };
  return { ids: segs.map(q => q.id), classes, joints, samples: S, turns: TURNS, edgeOf, instances, strip: { name: 'route ' + segs.map(q => q.id).join('+'), pos: Float32Array.from(pos), col: Float32Array.from(col), index: Uint32Array.from(idx), vertexCount: n * m }, grid, paved, carriageway, footprint: foot, wear: wearOf, lines, length: total, bed: bedAlt, brg, lateral, tangent: T, flatOf: F, surface, colAlt, cf, approach: aW, approaches, chainAt, sNode: sNodeOf, trim: { start: o.trimStart || 0, end: o.trimEnd || 0 }, mouths: MO, kinks, ramp: RP ? { end: RP.end, len: rampLen, delta: rampD.slice(), i: iR } : null };
}

const ROADKIT = { build, sweep, route, PROFILES, DECK, COL, lin, BLEND };
if (typeof module !== 'undefined' && module.exports) module.exports = ROADKIT;
else global.ROADKIT = ROADKIT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
