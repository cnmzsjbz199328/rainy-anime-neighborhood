// RD06 stone stairs (W5b): pure data (no THREE, no DOM), driven by world.js and the ground height function it is given.
// build(W, edgeId) turns an RD06 edge into stone steps that follow the terrain: the ground profile along the path (the highest of three lateral points, smoothed 3 m,
// made monotone) is cut at multiples of the riser (0.15-0.18 m, card), so steep ground gets short treads and gentle ground gets long ones that read as platforms; the
// treads average about 0.77 m (W5_SPEC 3.1). Around the steps: rope handrails on the steep part (posts every third step), a small torii at the start, stone lanterns
// (at most 10 per stair, W5_SPEC 5.1), jizo statues, wooden benches on platforms and guide pillars. Everything uses the flat Mercator frame of the planet (positions
// carry 1/cos(lat) in the scene part); instance records give the altitude directly.
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180;
const hash = (a, b) => { let h = Math.imul(Math.round(a * 97), 374761393) ^ Math.imul(Math.round(b * 131), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const STAIR = { width: 1.6, riser: 0.17, minTread: 0.3, platform: 1.3, smooth: 6, maxLanterns: 10, ropeBelow: 0.62, baseDepth: 0.55 };

function build(W, edgeId, o = {}) {
  const NET = W.roadNetwork, edge = NET.edges.find(e => e.id === edgeId), S = NET.samplePath(edge, 0.5), n = S.length, L = NET.edgeLength(edge);
  const flat = p => ({ x: R * p.lon * D, z: -R * Math.asinh(Math.tan(p.lat * D)), k: 1 / Math.cos(p.lat * D) });
  const F = S.map(flat), T = F.map((p, i) => { const a = F[Math.max(0, i - 1)], b = F[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; });
  const brg = S.map((p, i) => W.bearing(S[Math.max(0, i - 1)], S[Math.min(n - 1, i + 1)]));
  const lateral = (i, off) => { if (!off) return [S[i].lon, S[i].lat]; const q = W.destination(S[i], brg[i] + (off > 0 ? 90 : -90), Math.abs(off)); return [q.lon, q.lat]; };
  const hAt = (i, off) => { const [lo, la] = lateral(i, off); return W.height(lo, la); };
  // ground profile: highest of the three lateral points under the stair, smoothed, then monotone (never lower than before) and pinned to the ground at the ends
  const raw = S.map((p, i) => Math.max(hAt(i, -0.8), hAt(i, 0), hAt(i, 0.8)));
  const w = STAIR.smooth, sm = raw.map((_, i) => { const a = Math.max(0, i - w), b = Math.min(n - 1, i + w); let t = 0; for (let k = a; k <= b; k++) t += raw[k]; return t / (b - a + 1); });
  const P = sm.slice(); for (let i = 1; i < n; i++) P[i] = Math.max(P[i], P[i - 1]);
  const h0 = S[0].h, h1 = S[n - 1].h; P[0] = Math.min(P[0], h0 + 0.0); P[n - 1] = Math.max(P[n - 1], h1);
  const Hlo = P[0], Hhi = P[n - 1], N = Math.max(1, Math.round((Hhi - Hlo) / STAIR.riser)), riser = (Hhi - Hlo) / N;
  // step k (1..N): its top is Hlo + k * riser; its front edge is where the profile first reaches that altitude; tread = distance from the previous front edge
  const cross = [0]; let j = 0;
  for (let k = 1; k <= N; k++) { const target = Hlo + k * riser - 1e-9; while (j < n - 1 && P[j] < target) j++; const t = j > 0 && P[j] > P[j - 1] ? (target - P[j - 1]) / (P[j] - P[j - 1]) : 1; cross.push(S[j - (j > 0 ? 1 : 0)].s + t * (S[j].s - S[Math.max(0, j - 1)].s)); }
  cross[N] = Math.min(cross[N], L);
  const sampleAt = s => { let i = 0; while (i + 2 < n && S[i + 1].s < s) i++; return Math.min(n - 1, Math.max(0, Math.round(i + (s - S[i].s) / Math.max(1e-6, S[i + 1].s - S[i].s)))); };
  const out = { id: edgeId, samples: S, length: L, riser, count: N, steps: [], instances: {}, lines: {}, ropeSegments: [], profile: P, flatOf: F, tangent: T, lateral, lanterns: [], platforms: [] };
  const add = (type, i, off, alt, ex = {}) => { const [lo, la] = lateral(i, off); const rec = { type, lon: lo, lat: la, alt, yaw: ex.yaw || 0, s: ex.s || [1, 1, 1], lean: ex.lean || [0, 0], tint: ex.tint || [1, 1, 1] }; (out.instances[type] = out.instances[type] || []).push(rec); return rec; };
  const yawAcross = i => Math.atan2(T[i][0], T[i][1]);      // local +z along the path, +x across it
  const yawFace = (dx, dz) => Math.atan2(dx, dz);
  const right = i => [-T[i][1], T[i][0]];
  // steps
  let minGroundGap = Infinity;
  for (let k = 1; k <= N; k++) {
    const sa = cross[k - 1], sb = Math.max(sa + 0.05, cross[k]), mid = (sa + sb) / 2, i = sampleAt(mid), tread = sb - sa, top = Hlo + k * riser;
    const g = Math.min(hAt(i, -0.8), hAt(i, 0), hAt(i, 0.8)), bottom = Math.min(top - STAIR.baseDepth, g - 0.12), tall = top - bottom;
    minGroundGap = Math.min(minGroundGap, top - g);
    // a tread longer than 2.6 m (gentle ground between two steps) is laid as several slabs 0.04 m apart; the rest is one block
    const pieces = tread > 2.6 ? Math.ceil(tread / 2.2) : 1;
    for (let q = 0; q < pieces; q++) {
      const a = sa + tread * q / pieces, b = sa + tread * (q + 1) / pieces - (pieces > 1 ? 0.04 : 0), im = sampleAt((a + b) / 2), gq = Math.min(hAt(im, -0.8), hAt(im, 0), hAt(im, 0.8)), bq = Math.min(top - STAIR.baseDepth, gq - 0.12);
      add('stoneStep', im, 0, bq, { yaw: yawAcross(im), s: [STAIR.width, top - bq, Math.max(b - a, STAIR.minTread * 0.8)], tint: (() => { const f = 0.85 + 0.3 * hash(k * 7 + q, 3); return [f, f, f]; })() });
    }
    out.steps.push({ k, i, s: mid, tread, top, bottom, riser, width: STAIR.width, lon: S[i].lon, lat: S[i].lat });
    if (tread >= STAIR.platform) out.platforms.push({ k, i, s: mid, tread, top });
  }
  // rope handrails on the steep part (tread below ropeBelow): a post on each side every third step, two ropes between
  const steepIdx = out.steps.filter(st => st.tread < STAIR.ropeBelow);
  const ropeLines = [[], [], [], []];
  steepIdx.forEach((st, a) => {
    for (const side of [-1, 1]) {
      const off = side * (STAIR.width / 2 + 0.08);
      if (a % 3 === 0) { add('ropePost', st.i, off, st.top, {}); }
    }
  });
  // ropes: through the posts, two heights per side (lines are made in the scene part from these point lists)
  const posts = (out.instances.ropePost || []);
  for (const sideIdx of [0, 1]) {
    const pts = posts.filter(p => (sideIdx === 0) === (arcSide(p) < 0));
    function arcSide(p) { let b = 0, bd = 1e9; S.forEach((q, i) => { const d = Math.abs(q.lon - p.lon) + Math.abs(q.lat - p.lat); if (d < bd) { bd = d; b = i; } }); const r = right(b), f = flat(p), dx = f.x - F[b].x, dz = f.z - F[b].z; return dx * r[0] + dz * r[1]; }
    for (const hh of [0.5, 0.88]) { const line = pts.map(p => ({ lon: p.lon, lat: p.lat, alt: p.alt + hh })); if (line.length > 1) out.ropeSegments.push(line); }
  }
  // torii at the start (scaled to fit the 1.6 m stair: 2.9 m wide gate x 0.7), guide pillars beside it
  const i0 = 0, r0 = right(i0);
  add('torii', i0, 0, Hlo, { yaw: yawAcross(i0), s: [0.62, 0.7, 0.7] });
  for (const side of [-1, 1]) add('stonePost', i0, side * 1.7, hAt(i0, side * 1.7), { s: [1.1, 1.3, 1.1] });
  void r0;
  // lanterns: every ~12 steps (at most 10), alternating sides; jizo on two platforms; benches on the two longest platforms
  const every = Math.max(8, Math.ceil(N / STAIR.maxLanterns));
  let side = 1;
  for (let k = every; k <= N && out.lanterns.length < STAIR.maxLanterns; k += every) {
    const st = out.steps[k - 1], r = right(st.i), off = side * (STAIR.width / 2 + 0.9), g = hAt(st.i, off), rec = add('lantern', st.i, off, g, { yaw: yawFace(-side * r[0], -side * r[1]) });
    out.lanterns.push({ k, i: st.i, s: st.s, lon: rec.lon, lat: rec.lat, alt: g }); side = -side;
  }
  const plat = out.platforms.slice().sort((a, b) => b.tread - a.tread).slice(0, 4);
  plat.forEach((pl, a) => { const r = right(pl.i);
    if (a < 2) { const off = (a % 2 ? -1 : 1) * (STAIR.width / 2 + 0.7); add('jizo', pl.i, off, hAt(pl.i, off), { yaw: yawFace(-Math.sign(off) * r[0], -Math.sign(off) * r[1]) }); }
    else { const off = (a % 2 ? -1 : 1) * (STAIR.width / 2 + 0.8); add('busBench', pl.i, off, hAt(pl.i, off), { yaw: yawAcross(pl.i) }); } });
  out.lines.edgeL = S.map((p, i) => { const [lo, la] = lateral(i, -STAIR.width / 2); return { lon: lo, lat: la, alt: P[i] + 0.03 }; });
  out.lines.edgeR = S.map((p, i) => { const [lo, la] = lateral(i, STAIR.width / 2); return { lon: lo, lat: la, alt: P[i] + 0.03 }; });
  out.stats = { riser, count: N, drop: Hhi - Hlo, avgTread: L / N, minTread: Math.min(...out.steps.map(s => s.tread)), maxTread: Math.max(...out.steps.map(s => s.tread)), platforms: out.platforms.length, lanterns: out.lanterns.length, ropePosts: posts.length, minGroundGap };
  return out;
}

const STEPS = { build, STAIR };
if (typeof module !== 'undefined' && module.exports) module.exports = STEPS;
else global.STEPS = STEPS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
