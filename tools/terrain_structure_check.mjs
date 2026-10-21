// W10c bridges and tunnel against the ground cut (docs/world/BRIDGE_TUNNEL_TERRAIN_FIX_PLAN.md section 4). Run after `python3 build.py`:
//   node tools/terrain_structure_check.mjs [--ref <git ref>] [--report <path>] [--swiftshader]
// Every probe is a ray against the triangles that are actually displayed (after the road cut and the seam split), taken into the display frame the way the
// vertex shader of bend.js takes them (world matrix, the seam shift of each vertex, then the bend at uBend = 0, 0.5 and 1). The reference is the terrain
// lattice as it was built (the chunks' own positions and indices, before any cut), not the height sampler. Structure spans come from world.js (edge spans
// mapped onto each route's chainage here), not from the code under test.
//   TS0 geometry (TERRAIN_HOLE_REPAIR_PLAN 4.2): every displayed mesh is valid (attribute keys and counts, finite positions, indices in range) in the three states;
//       an invalid mesh fails here and is left out of the rays instead of dropping out unseen
//   TS1 under the bridges: every deck row and row midpoint of the three bridges (RN01-03, RN01-07+08+09, RN01-13), at the centre, +-2.5, +-4.9 m and outside
//       the deck at +-7, +-9 m: (a) the terrain meshes alone are hit where the uncut lattice is; (b) in the whole scene, from below the girder (the water is
//       left out: it is transparent and writes no depth), the first opaque surface is that near-side ground or a ground overlay within 0.3 m above it
//   TS2 tunnel cover: the RN01-05 rows where the uncut lattice covers the crown by >= 0.3 m: centre, +-2.7, +-5.4 m hit the terrain at the lattice height and
//       >= 0.3 m above the shell; from above, the first surface is that ground; the exposed lengths at the portals (actual hits on the centre line) <= 8 m
//   TS3 portals and abutments: sight lines from 4 m outside each portal into its opening reach the tunnel (void, ring) first; from 2 m outside each span
//       boundary to the portal face the road is the first surface from above (0.05 m apart, across +-5 m); at the six abutments road and deck are on top,
//       the uncut ground is under the first metre of the deck (0.05 m apart: the former 0.3 m end cap) and there is ground under every abutment wall column
//   TS1/TS3 in a ground occupancy (TERRAIN_HOLE_FOLLOWUP_PLAN B1, 2026-10-21; before, those probes failed as terrain missing): where the town's or a landmark's own ground
//       replaces the terrain (W10d; LM09's ground under RN01-13's tail), a probe checks that ground instead of the cut lattice: within 0.3 m of the lattice, the first
//       opaque surface from below the girder (TS1), the foot of a wall column in it (TS3)
//   TS4 modes: the terrain meshes are the same objects with the same geometry at uBend 0, 0.5 and 1 (no sphere-only patch or swap); TS1-TS3 run in all three
//   TS5 cut audit: no ground cut polygon (terrain.js roadPolygons, shared by cutGroundMeshes) overlaps a bridge deck or the tunnel interior beyond the portal
//       openings between each span boundary and its portal face; every polygon records its source, structure and chainage
//   TS6 tunnel clearance (2026-10-20, ride feedback): the structure read from the drawn shell and portal-ring meshes (their top arch and foot): roads.js's own envelope
//       coincides with them; no displayed terrain point lies inside the structure (2 mm; on its outer walls and faces the ground may meet it); on a 0.25 m grid the uncut
//       lattice inside the structure is gone and the hill over it is kept at its height; rays through the bore (vertical every 0.5 m, across at five heights every 0.25 m)
//       meet nothing but the tunnel and its road
// Report: docs/world/w10c/terrain-structure-review/report.json (not tracked); --ref builds that git ref in a temporary worktree and writes report-<ref>.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const ref = arg('--ref', null), soft = args.includes('--swiftshader');
const outDir = path.join(root, 'docs/world/w10c/terrain-structure-review'), reportFile = path.resolve(root, arg('--report', path.join(outDir, ref ? `report-${ref.replace(/[^\w.-]+/g, '_')}.json` : 'report.json')));
let failures = 0;
const check = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures++; };

let html = path.join(root, 'index.html'), cleanup = () => {}, commit;
if (ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsc-'));
  execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['build.py'], { cwd: dir, stdio: 'pipe' });
  html = path.join(dir, 'index.html'); commit = execFileSync('git', ['rev-parse', ref], { cwd: root, encoding: 'utf8' }).trim();
  cleanup = () => { try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'pipe' }); } catch { fs.rmSync(dir, { recursive: true, force: true }); } };
} else commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

// ---------------------------------------------------------------- the page part
async function probe({ modes }) {
  const S = window.__scene, T = window.THREE, B = S.bend, W = window.WORLD, NET = W.roadNetwork, D = S.roads.data(), TS = S.terrain;
  const R = 90, BASE = 1.6, P = B.PERIOD, PI_R = Math.PI * R, GIRDER = 1.55;
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const key = (x, z) => `${Math.floor(x)},${Math.floor(z)}`, ch = x => Math.cosh(x / R);
  const yOf = (alt, z) => (alt - BASE) * ch(z), altOf = (y, z) => y / ch(z) + BASE;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const rayHit = (o, d, A, C, E) => { const e1 = sub(C, A), e2 = sub(E, A), p = cross(d, e2), det = dot(e1, p); if (Math.abs(det) < 1e-13) return null; const inv = 1 / det, s = sub(o, A), u = dot(s, p) * inv; if (u < -1e-7 || u > 1 + 1e-7) return null; const q = cross(s, e1), v = dot(d, q) * inv; if (v < -1e-7 || u + v > 1 + 1e-7) return null; const t = dot(e2, q) * inv; return t > 0 ? t : null; };
  const bary = (x, z, v) => { const [a, b, c] = v, den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-12) return null; const w0 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, w1 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den, w2 = 1 - w0 - w1; return Math.min(w0, w1, w2) >= -1e-9 ? [w0, w1, w2] : null; };
  const orig = x => { let q = ((x + PI_R) % P + P) % P - PI_R; if (q >= PI_R) q -= P; return q; };      // the terrain chunks' own x range [-pi R, pi R)
  const edgeById = Object.fromEntries(NET.edges.map(e => [e.id, e])), spanEnd = (sp, len) => (sp.toMeters === 'end' ? len : sp.toMeters);

  // ---- structures from world.js
  const routeSpans = rt => { let off = 0; const out = []; for (const sg of rt.def.segs) { const e = edgeById[sg.id], len = NET.edgeLength(e); for (const sp of e.spans) if (sp.type === 'tunnel' || sp.type === 'bridge') { const a = sp.fromMeters, b = spanEnd(sp, len); out.push({ type: sp.type, edge: e.id, e0: a, e1: b, s0: off + (sg.rev ? len - b : a), s1: off + (sg.rev ? len - a : b) }); } off += len; } return out; };
  const edgeAtRoute = (rt, s) => { let off = 0; for (const sg of rt.def.segs) { const e = edgeById[sg.id], len = NET.edgeLength(e); if (s <= off + len + 1e-9) return { edge: e.id, s: +(sg.rev ? len - (s - off) : s - off).toFixed(3) }; off += len; } return null; };
  const edgeAtBridge = (b, s) => { let k = 0; while (k < b.joints.length && s > b.joints[k] + 1e-9) k++; return { edge: b.ids[k], s: +(s - (k ? b.joints[k - 1] : 0)).toFixed(3) }; };
  // the swept route mesh in the flat frame (terrain.js / roadkit.js: Mercator rows offset along tangent * cf), linear between rows
  const rowXZ = (rt, i, o) => { const f = rt.flatOf[i], t = rt.tangent[i], sc = rt.cf[i] * f.k; return [f.x - t[1] * o * sc, f.z + t[0] * o * sc]; };
  const rowAt = (rt, s) => { const Q = rt.samples; let i = 0; while (i + 2 < Q.length && Q[i + 1].s < s) i++; return { i, t: Math.max(0, Math.min(1, (s - Q[i].s) / (Q[i + 1].s - Q[i].s))) }; };
  const routeAt = (rt, s, o) => { const { i, t } = rowAt(rt, s), a = rowXZ(rt, i, o), b = rowXZ(rt, i + 1, o); let bx = b[0]; bx += P * Math.round((a[0] - bx) / P);
    const alt = rt.surface(i, o) + (rt.surface(i + 1, o) - rt.surface(i, o)) * t; return { x: a[0] + (bx - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, alt, bed: rt.bed[i] + (rt.bed[i + 1] - rt.bed[i]) * t }; };
  const deckRow = (b, i, o) => { const st = b.strips[0], g = b.topCols, m = g.length, col = j => [st.pos[(i * m + j) * 3], st.pos[(i * m + j) * 3 + 1], st.pos[(i * m + j) * 3 + 2]];
    if (Math.abs(o) > 5) { const c = deckRow(b, i, 0), e = col(o < 0 ? 0 : m - 1), f = Math.abs(o) / 5; return [c[0] + (e[0] - c[0]) * f, c[1], c[2] + (e[2] - c[2]) * f]; }
    let j = 0; while (j + 2 < m && g[j + 1] < o) j++; const a = col(j), c = col(j + 1), t = (o - g[j]) / (g[j + 1] - g[j]); return [0, 1, 2].map(k => a[k] + (c[k] - a[k]) * t); };
  const deckAt = (b, s, o) => { const Q = b.samples; let i = 0; while (i + 2 < Q.length && Q[i + 1].s < s) i++; const t = Math.max(0, Math.min(1, (s - Q[i].s) / (Q[i + 1].s - Q[i].s))), a = deckRow(b, i, o), c = deckRow(b, i + 1, o);
    return { x: a[0] + (c[0] - a[0]) * t, z: a[2] + (c[2] - a[2]) * t, top: altOf(a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t), alt: b.alt[i] + (b.alt[i + 1] - b.alt[i]) * t }; };

  const tunnelRt = D.routes.find(r => r.tunnel), tn = tunnelRt.tunnel, crownAbove = tn.wallH + tn.innerR + tn.shell, shellR = tn.innerR + tn.shell;
  const tunnelSpan = routeSpans(tunnelRt).find(q => q.type === 'tunnel'), face0 = tunnelRt.samples[tn.idx[0]].s, face1 = tunnelRt.samples[tn.idx[tn.idx.length - 1]].s;
  // the black void behind each portal face (roads.js buildTunnel), measured on the drawn meshes: its fan centre's distance behind the face row
  const voids = []; S.roads.state.root.traverse(o => { if (o.isMesh && o.name === 'road:tunnel void') voids.push(o.geometry.attributes.position); });
  const voidDepth = [tn.idx[0], tn.idx[tn.idx.length - 1]].map(i0 => { const F = tunnelRt.flatOf[i0], Tt = tunnelRt.tangent[i0]; let best = null; for (const p of voids) { const dx = p.getX(0) - F.x, dz = p.getZ(0) - F.z, d = Math.hypot(dx, dz); if (!best || d < best.d) best = { d, along: Math.abs(dx * Tt[0] + dz * Tt[1]) / F.k }; } return best ? best.along : 0; });

  // ---- probes: { id, kind, x, z (flat frame, any x), ... }
  const probes = [], sights = [];
  for (const b of D.bridges) {
    const n = b.samples.length;
    for (let k = 0; k <= 2 * (n - 1); k++) {
      const s = k % 2 ? (b.samples[(k - 1) / 2].s + b.samples[(k + 1) / 2].s) / 2 : b.samples[k / 2].s, at = edgeAtBridge(b, s);
      for (const o of [0, -2.5, 2.5, -4.9, 4.9, -7, 7, -9, 9]) { const d = deckAt(b, s, o); probes.push({ test: 'bridge', bridge: b.def.id, edge: at.edge, es: at.s, s: +s.toFixed(3), o, x: d.x, z: d.z, deck: d.alt, under: Math.abs(o) <= 5, joint: k === 0 || k === 2 * (n - 1) }); }
    }
  }
  const tRows = tunnelRt.samples.map((q, i) => ({ i, s: q.s })).filter(q => q.s >= tunnelSpan.s0 - 1e-9 && q.s <= tunnelSpan.s1 + 1e-9);
  const RING_DEPTH = 1.4, ringR = tn.innerR + 1.2;      // roads.js buildTunnel: the portal ring, 1.4 m deep behind each face, 1.2 m beyond the inner profile
  for (const { i, s } of tRows) { const at = edgeAtRoute(tunnelRt, s), Rr = s - face0 <= RING_DEPTH + 1e-6 || face1 - s <= RING_DEPTH + 1e-6 ? ringR : shellR;
    for (const o of [0, -2.7, 2.7, -shellR, shellR]) { const q = routeAt(tunnelRt, s, o), shellTop = tunnelRt.bed[i] + tn.wallH + Math.sqrt(Math.max(0, Rr * Rr - o * o)); probes.push({ test: 'tunnel', edge: at.edge, es: at.s, s: +s.toFixed(3), row: i, o: +o.toFixed(2), x: q.x, z: q.z, bed: tunnelRt.bed[i], shellTop, ring: Rr === ringR }); } }
  // portals: the approach from 2 m outside the span boundary to just before the portal face; sight lines from 4 m outside into the opening
  const portals = [{ end: 'start', face: face0, bound: tunnelSpan.s0, out: -1 }, { end: 'end', face: face1, bound: tunnelSpan.s1, out: 1 }];
  for (const pt of portals) {
    const a = pt.out < 0 ? pt.bound - 2 : pt.face + 0.02, b = pt.out < 0 ? pt.face - 0.02 : pt.bound + 2;
    for (let s = a; s <= b + 1e-9; s += 0.05) for (let o = -5; o <= 5 + 1e-9; o += 0.25) { const q = routeAt(tunnelRt, s, o), at = edgeAtRoute(tunnelRt, s); probes.push({ test: 'approach', portal: pt.end, edge: at.edge, es: at.s, s: +s.toFixed(3), o: +o.toFixed(2), x: q.x, z: q.z, road: q.alt, inside: (s - pt.bound) * pt.out < 0 }); }
    const vd = voidDepth[pt.out < 0 ? 0 : 1];
    for (let k = 0; k <= 10; k++) { const s = pt.face - pt.out * vd * k / 10;
      for (let o = -tn.innerR; o <= tn.innerR + 1e-9; o += tn.innerR / 16) { const q = routeAt(tunnelRt, s, o), at = edgeAtRoute(tunnelRt, s), prof = tn.wallH + Math.sqrt(Math.max(0, tn.innerR * tn.innerR - o * o)); probes.push({ test: 'mouth', portal: pt.end, edge: at.edge, es: at.s, s: +s.toFixed(3), o: +o.toFixed(3), x: q.x, z: q.z, road: q.alt, bed: q.bed, profile: q.bed + prof }); } }
    const rows = [[-3, [0.3, 1, 2, 3.5]], [0, [0.3, 1, 2, 3.5, 5]], [3, [0.3, 1, 2, 3.5]], [-4.6, [0.1, 0.3, 0.8]], [-4.4, [0.1, 0.3, 0.8]], [-4, [0.1, 0.3]], [4, [0.1, 0.3]], [4.4, [0.1, 0.3, 0.8]], [4.6, [0.1, 0.3, 0.8]]];
    for (const [o, hs] of rows) for (const h of hs) { const A = routeAt(tunnelRt, pt.face + pt.out * 4, o), Z = routeAt(tunnelRt, pt.face - pt.out * 0.5, o); sights.push({ portal: pt.end, o, h, a: [A.x, yOf(A.alt + h, A.z), A.z], b: [Z.x, yOf(Z.alt + h, Z.z), Z.z] }); }
  }
  // abutments: the first metre of the deck and the last metre of the road, 0.05 m apart; the wall's bottom columns
  const walls = [];
  for (const ab of D.abutments) {
    const b = D.bridges.find(q => q.def.id === ab.bridge), rt = D.routes.find(q => q.def.id === ab.route), L = b.samples[b.samples.length - 1].s, rS = rt.samples, r0 = rS[0].s, r1 = rS[rS.length - 1].s, tag = `${ab.route}:${ab.rEnd}/${ab.bridge}:${ab.bEnd}`;
    for (let k = 0; k <= 20; k++) { const s = ab.bEnd === 'start' ? k * 0.05 : L - k * 0.05, at = edgeAtBridge(b, s);
      for (const o of [-4.9, -3.5, -2.1, -0.7, 0, 0.7, 2.1, 3.5, 4.9]) { const d = deckAt(b, s, o); probes.push({ test: 'abut-deck', abut: tag, bridge: b.def.id, edge: at.edge, es: at.s, s: +s.toFixed(3), o, x: d.x, z: d.z, deck: d.top, deckAlt: d.alt, atJoint: k === 0 }); }
      const rs = ab.rEnd === 'end' ? r1 - k * 0.05 : r0 + k * 0.05, ra = edgeAtRoute(rt, rs);
      for (const o of [-3.4, -1.7, 0, 1.7, 3.4]) { const q = routeAt(rt, rs, o); probes.push({ test: 'abut-road', abut: tag, route: rt.def.id, edge: ra && ra.edge, es: ra && ra.s, s: +rs.toFixed(3), o, x: q.x, z: q.z, road: q.alt }); } }
    const wp = ab.wall.pos, m = rt.grid.length, iE = ab.rEnd === 'end' ? rS.length - 1 : 0, sg = ab.rEnd === 'end' ? 1 : -1, tE = rt.tangent[iE], kE = rt.flatOf[iE].k * 0.05 * sg;
    for (let j = 0; j < m; j++) if (Math.abs(rt.grid[j]) <= 5 + 1e-9) { const x = wp[(2 * j + 1) * 3] + tE[0] * kE, y = wp[(2 * j + 1) * 3 + 1], z = wp[(2 * j + 1) * 3 + 2] + tE[1] * kE; walls.push({ abut: tag, o: rt.grid[j] }); probes.push({ test: 'wall', abut: tag, o: rt.grid[j], x, z, bottom: altOf(y, z) }); }
  }
  for (const q of probes) { q.xd = B.wrapX(q.x); q.xo = orig(q.x); }
  // TERRAIN_HOLE_FOLLOWUP_PLAN B1 (its default, the user not having ruled otherwise): a ground occupancy (W10d: the town's and the landmarks' own ground, scene.js
  // userData.groundOccupancy) replaces the terrain where it lies, under a deck too (LM09's ground under RN01-13's tail, the user's layout C of 2026-10-18). So a TS1 or TS3
  // probe in it (in plan, in its upward triangles at uBend 0) checks that ground instead of the cut lattice: it lies within 0.3 m of the lattice there, and under a deck
  // the first opaque surface from below the girder is that ground (a wall column's foot lies in it). Before: every such probe failed as "terrain missing" (since 1bee33c).
  const occMeshes = new Set(), occCells = new Map(); S.scene.updateMatrixWorld(true);
  S.scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !o.userData.groundOccupancy || !o.geometry?.attributes?.position) return; occMeshes.add(o); const g = o.geometry, p = g.attributes.position, ix = g.index, e = o.matrixWorld.elements, n = ix ? ix.count : p.count;
    for (let t = 0; t + 2 < n; t += 3) { const v = [0, 1, 2].map(k => { const i = ix ? ix.getX(t + k) : t + k, x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [B.wrapX(e[0] * x + e[4] * y + e[8] * z + e[12]), e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; });
      const ny = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]); if (!(ny > 1e-10)) continue;
      for (let x = Math.floor(Math.min(v[0][0], v[1][0], v[2][0])); x <= Math.floor(Math.max(v[0][0], v[1][0], v[2][0])); x++) for (let z = Math.floor(Math.min(v[0][2], v[1][2], v[2][2])); z <= Math.floor(Math.max(v[0][2], v[1][2], v[2][2])); z++) { const k = key(x, z); let a = occCells.get(k); if (!a) occCells.set(k, a = []); a.push(v); } } });
  for (const q of probes) if (q.test === 'bridge' || q.test === 'abut-deck' || q.test === 'wall') { let y = null; for (const v of occCells.get(key(q.xd, q.z)) || []) { const w = bary(q.xd, q.z, v); if (w) { const h = w[0] * v[0][1] + w[1] * v[1][1] + w[2] * v[2][1]; if (y === null || h > y) y = h; } } if (y !== null) q.occAlt = altOf(y, q.z); }
  for (const q of sights) { q.a[0] = B.wrapX(q.a[0]); q.b[0] = B.wrapX(q.b[0]); }

  // ---- the uncut lattice
  const refCells = new Map(), want = new Set(); for (const q of probes) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) want.add(key(q.xo + dx, q.z + dz));
  for (const c of [...TS.ringData, ...TS.restData]) for (const index of [c.ringIndex, c.restIndex]) if (index) for (let t = 0; t + 2 < index.length; t += 3) {
    const v = [0, 1, 2].map(k => [c.pos[index[t + k] * 3], c.pos[index[t + k] * 3 + 1], c.pos[index[t + k] * 3 + 2]]);
    const x0 = Math.floor(Math.min(v[0][0], v[1][0], v[2][0])), x1 = Math.floor(Math.max(v[0][0], v[1][0], v[2][0])), z0 = Math.floor(Math.min(v[0][2], v[1][2], v[2][2])), z1 = Math.floor(Math.max(v[0][2], v[1][2], v[2][2]));
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = `${x},${z}`; if (!want.has(k)) continue; let a = refCells.get(k); if (!a) refCells.set(k, a = []); a.push(v); }
  }
  const refY = (x, z) => { const xo = orig(x); for (const v of refCells.get(key(xo, z)) || []) { const w = bary(xo, z, v); if (w) return w[0] * v[0][1] + w[1] * v[1][1] + w[2] * v[2][1]; } return null; };
  for (const q of probes) {
    for (const v of refCells.get(key(q.xo, q.z)) || []) { const w = bary(q.xo, q.z, v); if (!w) continue; const dx = q.xd - q.xo, tri = v.map(p => [p[0] + dx, p[1], p[2]]), y = w[0] * v[0][1] + w[1] * v[1][1] + w[2] * v[2][1];
      const e = [0, 1, 2].map(k => { const a = tri[k], b = tri[(k + 1) % 3], l = Math.hypot(a[0] - b[0], a[2] - b[2]); return { l, g: Math.abs(a[1] - b[1]) / Math.max(l, 1e-9) }; });
      q.ref = { tri, w, alt: altOf(y, q.z), y, edge: Math.max(...e.map(q => q.l)), slope: Math.max(...e.map(q => q.g)) }; break; }
  }

  // ---- the displayed scene, per mode
  const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const terrainMeshes = new Set([...TS.ring, ...TS.rest]), tunnelNames = /^road:tunnel /, roadNames = /^road:(route |bridge .* top$|junction paving$)/;
  const sightCells = new Set(); for (const q of sights) { const x0 = Math.floor(Math.min(q.a[0], q.b[0]) - 1), x1 = Math.floor(Math.max(q.a[0], q.b[0]) + 1), z0 = Math.floor(Math.min(q.a[2], q.b[2]) - 1), z1 = Math.floor(Math.max(q.a[2], q.b[2]) + 1); for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) sightCells.add(`${x},${z}`); }
  const interest = new Set([...probes.map(q => key(q.xd, q.z)), ...sightCells]);
  const signature = () => [...TS.ring, ...TS.rest].map(m => [m.uuid, m.geometry.uuid, m.geometry.index ? m.geometry.index.count : 0, m.geometry.attributes.position.count, visible(m)].join(':')).join('|');
  const out = { modes: {}, info: {} };
  out.info.bridges = D.bridges.map(b => { const xs = b.strips[0].pos.filter((_, i) => i % 3 === 0); return { id: b.def.id, edges: b.ids, rows: b.samples.length, length: +b.samples[b.samples.length - 1].s.toFixed(2), x: [Math.min(...xs), Math.max(...xs)].map(v => +v.toFixed(2)), seam: Math.min(...xs) < B.SEAM && Math.max(...xs) > B.SEAM, dateline: Math.max(...xs) > PI_R || Math.min(...xs) < -PI_R }; });
  out.info.tunnel = { route: tunnelRt.def.id, span: tunnelSpan, face0: +face0.toFixed(3), face1: +face1.toFixed(3), crownAbove, shellR, innerR: tn.innerR, voidDepth: voidDepth.map(v => +v.toFixed(4)) };
  for (const u of modes) {
    B.set(u); await frame(); await frame(); S.scene.updateMatrixWorld(true);
    const cells = new Map(), names = new Set(), wv = new T.Vector3(), I = new T.Matrix4(), invalid = []; let triangles = 0;
    const bend = p => (u ? B.point(p[0], p[1], p[2], u) : p);
    // TS0 (TERRAIN_HOLE_REPAIR_PLAN 4.2): a mesh is valid before its triangles are read (an index past the position count reads as NaN and its triangle drops out)
    const issues = g => { const out = [], pos = g.attributes.position; for (const [k, a] of Object.entries(g.attributes)) { if (!k) out.push('empty attribute key'); else if (a.count !== pos.count && !a.isInstancedBufferAttribute) out.push(`${k} count ${a.count} != ${pos.count}`); }
      let bad = 0; for (let i = 0; i < pos.count; i++) if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) bad++; if (bad) out.push(`${bad} non-finite positions`);
      if (g.index) { let wrong = 0; for (let i = 0; i < g.index.count; i++) { const v = g.index.getX(i); if (!(Number.isInteger(v) && v >= 0 && v < pos.count)) wrong++; } if (wrong) out.push(`${wrong} indices outside [0, ${pos.count})`); } return out; };
    S.scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position || !visible(o)) return;
      { const why = issues(o.geometry); if (why.length) { invalid.push(`${o.name || o.parent?.name || o.type}${terrainMeshes.has(o) ? ' [terrain]' : ''}: ${why.join(', ')}`); return; } }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some(m => m && m.userData && (m.userData.noBend || m.userData.noWrap))) return;
      const clear = mats.every(m => !m || (m.transparent && (m.depthWrite === false || m.opacity <= 0)) || m.blending === T.AdditiveBlending || m.colorWrite === false || m.visible === false);
      const terr = terrainMeshes.has(o), moved = !o.matrixWorld.equals(I), g = o.geometry, pos = g.attributes.position, ix = g.index, count = ix ? ix.count : pos.count, name = o.name || o.parent?.name || o.type;
      for (let t = 0; t + 2 < count; t += 3) {
        const v = [0, 1, 2].map(k => { const n = ix ? ix.getX(t + k) : t + k; if (moved) { wv.set(pos.getX(n), pos.getY(n), pos.getZ(n)).applyMatrix4(o.matrixWorld); return [B.wrapX(wv.x), wv.y, wv.z]; } return [B.wrapX(pos.getX(n)), pos.getY(n), pos.getZ(n)]; });
        const x0 = Math.floor(Math.min(v[0][0], v[1][0], v[2][0])), x1 = Math.floor(Math.max(v[0][0], v[1][0], v[2][0])), z0 = Math.floor(Math.min(v[0][2], v[1][2], v[2][2])), z1 = Math.floor(Math.max(v[0][2], v[1][2], v[2][2]));
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 2500) continue;
        let tri = null;
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = `${x},${z}`; if (!interest.has(k)) continue; if (!tri) { tri = { v, b: v.map(bend), terr, clear, name, tunnel: tunnelNames.test(name), road: roadNames.test(name), occ: occMeshes.has(o) }; if (!clear) names.add(name); } let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(tri); triangles++; }
      }
    });
    // first hits along one ray: the terrain alone, and the scene's opaque surfaces
    const cast = (A, dir, list) => { let terr = null, first = null; for (const tri of list) { if (tri.clear) continue; const t = rayHit(A, dir, ...tri.b); if (t === null) continue; if (tri.terr && (!terr || t < terr.t)) terr = { t, name: tri.name, tri }; if (!first || t < first.t - 1e-5 || (Math.abs(t - first.t) <= 1e-5 && tri.terr)) first = { t, name: tri.name, terr: tri.terr, tunnel: tri.tunnel, road: tri.road, occ: tri.occ }; } return { terr, first }; };
    const res = { triangles, invalid, names: [...names].sort(), signature: signature(), probes: [] };
    probes.forEach((q, qi) => {
      const list = cells.get(key(q.xd, q.z)) || [], r = { i: qi };
      const yTop = q.ref ? Math.max(q.ref.y, yOf((q.deck ?? q.road ?? q.ref.alt) + 0, q.z)) + 20 : yOf((q.deck ?? q.road ?? 0) + 20, q.z);
      const A = bend([q.xd, yTop, q.z]), Z = bend([q.xd, q.ref ? q.ref.y : yTop - 30, q.z]), dl = Math.hypot(...sub(Z, A)), dir = sub(Z, A).map(v => v / dl);
      if (q.ref) { const bt = q.ref.tri.map(bend); let t = rayHit(A, dir, ...bt); if (t === null) { const Zw = [0, 1, 2].map(k => bt.reduce((s, p, i) => s + q.ref.w[i] * p[k], 0)); t = dot(sub(Zw, A), dir); } r.tRef = t; r.tol = 0.002 + u * q.ref.edge * q.ref.edge * (1 + 2 * q.ref.slope) / (4 * R); }
      const h = cast(A, dir, list); r.first = h.first;
      if (h.terr) { const dev = Math.max(...h.terr.tri.v.map(p => { const y = refY(p[0], p[2]); return y === null ? Infinity : Math.abs(p[1] - y); })); r.terr = { t: h.terr.t, name: h.terr.name, dev }; }
      // the scene below the girder (bridges): a second ray that starts under the deck
      if (q.test === 'bridge' && q.ref) {
        const a0 = q.under ? q.deck - GIRDER - 0.35 : Math.max(q.deck, q.ref.alt) + 2;
        if (a0 <= q.ref.alt + 0.05) r.embedded = true;
        else { const A2 = bend([q.xd, yOf(a0, q.z), q.z]), d2 = sub(Z, A2), l2 = Math.hypot(...d2), dir2 = d2.map(v => v / l2), bt = q.ref.tri.map(bend); let t2 = rayHit(A2, dir2, ...bt); if (t2 === null) t2 = l2; const h2 = cast(A2, dir2, list); r.below = { tRef: t2, first: h2.first }; }
      }
      res.probes.push(r);
    });
    res.sights = sights.map(q => { const A = bend(q.a), Z = bend(q.b), d = sub(Z, A), l = Math.hypot(...d), dir = d.map(v => v / l), seen = new Set(), list = [];
      const x0 = Math.floor(Math.min(q.a[0], q.b[0]) - 1), x1 = Math.floor(Math.max(q.a[0], q.b[0]) + 1), z0 = Math.floor(Math.min(q.a[2], q.b[2]) - 1), z1 = Math.floor(Math.max(q.a[2], q.b[2]) + 1);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (const tri of cells.get(`${x},${z}`) || []) if (!seen.has(tri)) { seen.add(tri); list.push(tri); }
      const h = cast(A, dir, list), hits = list.filter(t => !t.clear).map(t => ({ t: rayHit(A, dir, ...t.b), name: t.name })).filter(q => q.t !== null && q.t <= l + 0.01).sort((p, q) => p.t - q.t).slice(0, 6).map(q => ({ t: +q.t.toFixed(3), name: q.name }));
      return { first: h.first && h.first.t <= l + 0.01 ? h.first : null, length: +l.toFixed(3), hits }; });
    out.modes[u] = res;
  }
  B.set(0); await frame();

  // ---- TS6: the tunnel's clearance, on the flat geometry (the cut is made there; the bend keeps the order along each vertical). The structure is read from the drawn
  // meshes, not from the code under test: the shell's arch between every two rows (vertex row * 15 + profile point, roads.js buildTunnel) with its foot (profile point 0),
  // each portal ring's outer arch over its depth (vertex point * 4 + 1 at the face, + 2 at the back) with its foot on the bed. A point counts as inside only 2 mm or more
  // from the structure's outer walls and faces in plan (on them the ground meets the structure).
  {
    S.scene.updateMatrixWorld(true);
    const t6 = {}, meshOf = re => { const l = []; S.roads.state.root.traverse(o => { if (o.isMesh && re.test(o.name)) l.push(o.geometry.attributes.position); }); return l; };
    const shellPos = meshOf(/^road:tunnel shell$/)[0], ringPos = meshOf(/^road:tunnel portal ring$/), nRow = tn.idx.length, mP = shellPos ? shellPos.count / nRow : 0, V3 = (pa, k) => [pa.getX(k), pa.getY(k), pa.getZ(k)];
    const MARGIN = 2e-3, PARTS = [], mkCell = (quad, outer, tris) => ({ quad, outer, tris, box: [Math.min(...quad.map(q => q[0])), Math.max(...quad.map(q => q[0])), Math.min(...quad.map(q => q[2])), Math.max(...quad.map(q => q[2]))] });
    if (shellPos) { const V = (a, j) => V3(shellPos, a * mP + j), cells = [];
      for (let a = 0; a + 1 < nRow; a++) { const q = [V(a, 1), V(a, mP - 2), V(a + 1, mP - 2), V(a + 1, 1)], f0 = V(a, 0)[1], f1 = V(a + 1, 0)[1], tris = [];
        for (let j = 1; j + 2 < mP; j++) tris.push({ v: [V(a, j), V(a + 1, j), V(a, j + 1)], foot: [f0, f1, f0] }, { v: [V(a, j + 1), V(a + 1, j), V(a + 1, j + 1)], foot: [f0, f1, f1] });
        cells.push(mkCell(q, [[1, 2], [3, 0], ...(a === 0 ? [[0, 1]] : []), ...(a === nRow - 2 ? [[2, 3]] : [])], tris)); }
      PARTS.push({ kind: 'shell', cells }); }
    ringPos.forEach((pa, k) => { const N = pa.count / 4, R4 = (a, kind) => V3(pa, a * 4 + kind), foot = R4(0, 1)[1], tris = [];
      for (let j = 1; j + 2 < N; j++) tris.push({ v: [R4(j, 1), R4(j + 1, 1), R4(j, 2)], foot: [foot, foot, foot] }, { v: [R4(j, 2), R4(j + 1, 1), R4(j + 1, 2)], foot: [foot, foot, foot] });
      PARTS.push({ kind: 'ring', end: k ? 'end' : 'start', cells: [mkCell([R4(1, 1), R4(N - 2, 1), R4(N - 2, 2), R4(1, 2)], [[0, 1], [1, 2], [2, 3], [3, 0]], tris)] }); });
    for (const p of PARTS) p.box = [Math.min(...p.cells.map(c => c.box[0])), Math.max(...p.cells.map(c => c.box[1])), Math.min(...p.cells.map(c => c.box[2])), Math.max(...p.cells.map(c => c.box[3]))];
    t6.parts = PARTS.map(p => `${p.kind}${p.end ? ':' + p.end : ''} ${p.cells.reduce((a, c) => a + c.tris.length, 0)}`);
    // (a) the code's own envelope (roads.js tunnelEnvelope, which terrain.js cuts with) is the drawn shell and rings: every vertex of its top triangles is a drawn vertex
    const drawn = new Set(); for (const pa of [shellPos, ...ringPos].filter(Boolean)) for (let i = 0; i < pa.count; i++) drawn.add(`${pa.getX(i).toFixed(3)},${pa.getY(i).toFixed(3)},${pa.getZ(i).toFixed(3)}`);
    let envVerts = 0, envMissing = 0; for (const part of tn.envelope || []) for (const c of part.cells) for (const t of c.tris) t.p.forEach((q, k) => { envVerts++; if (!drawn.has(`${Math.fround(q[0]).toFixed(3)},${Math.fround(t.top[k]).toFixed(3)},${Math.fround(q[1]).toFixed(3)}`)) envMissing++; });
    t6.envelope = { vertices: envVerts, missing: envMissing, drawnVertices: drawn.size };
    // the structure at a plan point: every part triangle that contains it (2 mm clear of the outer walls and faces), with its top and foot (flat y)
    const box6 = PARTS.reduce((b, p) => [Math.min(b[0], p.box[0]), Math.max(b[1], p.box[1]), Math.min(b[2], p.box[2]), Math.max(b[3], p.box[3])], [Infinity, -Infinity, Infinity, -Infinity]);
    const segD = (q, a, b) => { const dx = b[0] - a[0], dz = b[2] - a[2], l2 = dx * dx + dz * dz || 1e-24, t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[2]) * dz) / l2)); return Math.hypot(q[0] - a[0] - dx * t, q[1] - a[2] - dz * t); };
    const structAt = q => { const out = []; for (const p of PARTS) { if (q[0] < p.box[0] || q[0] > p.box[1] || q[1] < p.box[2] || q[1] > p.box[3]) continue; for (const c of p.cells) { if (q[0] < c.box[0] || q[0] > c.box[1] || q[1] < c.box[2] || q[1] > c.box[3]) continue;
      for (const t of c.tris) { const w = bary(q[0], q[1], t.v); if (!w) continue; if (c.outer.some(([i, j]) => segD(q, c.quad[i], c.quad[j]) < MARGIN)) break; out.push({ part: p.kind, top: w[0] * t.v[0][1] + w[1] * t.v[1][1] + w[2] * t.v[2][1], foot: w[0] * t.foot[0] + w[1] * t.foot[1] + w[2] * t.foot[2] }); break; } } } return out; };
    const depthIn = (st, y) => Math.max(-Infinity, ...st.map(v => Math.min(v.top - y, y - v.foot)));          // > 0: inside the structure by that much
    const PR = (() => { const arc = 12, inner = [[-tn.innerR, 0], [-tn.innerR, tn.wallH]]; for (let a = 1; a < arc; a++) { const th = Math.PI - Math.PI * a / arc; inner.push([tn.innerR * Math.cos(th), tn.wallH + tn.innerR * Math.sin(th)]); } inner.push([tn.innerR, tn.wallH], [tn.innerR, 0]); return { inner, outerR: tn.innerR + (tn.ringOut ?? 1.2) }; })();
    // (b1) every displayed terrain triangle over the structure: its vertices, edge midpoints and centroid lie outside it (2 mm for Float32)
    const TOL = 2e-3, tcell = new Map(), tk = (x, z) => `${Math.floor(x)},${Math.floor(z)}`; let tTris = 0, tSamples = 0, tInside = 0, tWorst = 0; const tWhere = [];
    for (const mesh of [...TS.ring, ...TS.rest]) { const g = mesh.geometry, pos = g.attributes.position, ix = g.index, count = ix ? ix.count : pos.count;
      for (let t = 0; t + 2 < count; t += 3) { const v = [0, 1, 2].map(k => { const n = ix ? ix.getX(t + k) : t + k; return [pos.getX(n), pos.getY(n), pos.getZ(n)]; });
        const x0 = Math.min(v[0][0], v[1][0], v[2][0]), x1 = Math.max(v[0][0], v[1][0], v[2][0]), z0 = Math.min(v[0][2], v[1][2], v[2][2]), z1 = Math.max(v[0][2], v[1][2], v[2][2]);
        if (x1 < box6[0] - 1 || x0 > box6[1] + 1 || z1 < box6[2] - 1 || z0 > box6[3] + 1) continue;
        for (let x = Math.floor(x0); x <= Math.floor(x1); x++) for (let z = Math.floor(z0); z <= Math.floor(z1); z++) { const k = `${x},${z}`; let a = tcell.get(k); if (!a) tcell.set(k, a = []); a.push(v); }
        if (x1 < box6[0] || x0 > box6[1] || z1 < box6[2] || z0 > box6[3]) continue; tTris++;
        const c = [0, 1, 2].map(k => (v[0][k] + v[1][k] + v[2][k]) / 3), pts = [...v, c, ...[0, 1, 2].map(e => v[e].map((a, k) => (a + v[(e + 1) % 3][k]) / 2))];
        for (const p of pts) { const st = structAt([p[0], p[2]]); if (!st.length) continue; tSamples++; const d = depthIn(st, p[1]); if (d > TOL) { tInside++; tWorst = Math.max(tWorst, d); if (tWhere.length < 6) tWhere.push({ x: +p[0].toFixed(2), z: +p[2].toFixed(2), depth: +d.toFixed(3) }); } } } }
    t6.terrainTriangles = { triangles: tTris, samples: tSamples, inside: tInside, worst: +tWorst.toFixed(4), where: tWhere };
    // (b2) a 0.25 m grid over the tunnel's plan (the faces' rows, out to the ring's outer radius) against the uncut lattice: ground inside the structure is gone,
    // the hill over it is there at the lattice's height, nothing displayed lies inside
    const lat = new Map(); for (const c of [...TS.ringData, ...TS.restData]) for (const index of [c.ringIndex, c.restIndex]) if (index) for (let t = 0; t + 2 < index.length; t += 3) {
      const v = [0, 1, 2].map(k => [c.pos[index[t + k] * 3], c.pos[index[t + k] * 3 + 1], c.pos[index[t + k] * 3 + 2]]), x0 = Math.min(v[0][0], v[1][0], v[2][0]), x1 = Math.max(v[0][0], v[1][0], v[2][0]), z0 = Math.min(v[0][2], v[1][2], v[2][2]), z1 = Math.max(v[0][2], v[1][2], v[2][2]);
      if (x1 < box6[0] - 1 || x0 > box6[1] + 1 || z1 < box6[2] - 1 || z0 > box6[3] + 1) continue;
      for (let x = Math.floor(x0); x <= Math.floor(x1); x++) for (let z = Math.floor(z0); z <= Math.floor(z1); z++) { const k = `${x},${z}`; let a = lat.get(k); if (!a) lat.set(k, a = []); a.push(v); } }
    const yAt = (cells, x, z) => { const ys = []; for (const v of cells.get(tk(x, z)) || []) { const w = bary(x, z, v); if (w) ys.push(w[0] * v[0][1] + w[1] * v[1][1] + w[2] * v[2][1]); } return ys; };
    const grid = { points: 0, inside: 0, hill: 0, hillKept: 0, hillMissing: 0, cut: 0, cutLeft: 0, underFoot: 0, shownInside: 0, maxShownDepth: 0, examples: [] };
    const ringR = PR.outerR, i0 = tn.idx[0], i1 = tn.idx[tn.idx.length - 1];
    for (let s = face0; s <= face1 + 1e-9; s += 0.25) for (let o = -ringR; o <= ringR + 1e-9; o += 0.25) {
      const q = routeAt(tunnelRt, s, o), st = structAt([q.x, q.z]); if (!st.length) continue; grid.points++;
      const ref = yAt(lat, q.x, q.z)[0], shown = yAt(tcell, q.x, q.z); if (ref === undefined) continue;
      const dRef = depthIn(st, ref), top = Math.max(...st.map(v => v.top)), foot = Math.min(...st.map(v => v.foot));
      for (const y of shown) { const d = depthIn(st, y); if (d > TOL) { grid.shownInside++; grid.maxShownDepth = Math.max(grid.maxShownDepth, d); if (grid.examples.length < 6) grid.examples.push({ s: +s.toFixed(2), o: +o.toFixed(2), above: +((y - (q.bed - BASE) * ch(q.z)) / ch(q.z)).toFixed(3), depth: +d.toFixed(3) }); } }
      if (dRef > TOL) { grid.inside++; if (shown.some(y => Math.abs(y - ref) <= TOL)) grid.cutLeft++; else grid.cut++; }
      else if (ref >= top + TOL) { grid.hill++; if (shown.some(y => Math.abs(y - ref) <= TOL)) grid.hillKept++; else { grid.hillMissing++; if (grid.examples.length < 6) grid.examples.push({ s: +s.toFixed(2), o: +o.toFixed(2), hillMissing: true }); } }
      else if (ref <= foot - TOL) grid.underFoot++;
    }
    t6.grid = grid;
    // (c) the bore: vertical rays from 0.1 m over the bed to 0.05 m under the drawn inner profile, every 0.5 m along and across, and rays across it at five heights every 0.25 m;
    // every opaque surface they meet that is not the tunnel's or its road's own counts (terrain and anything else)
    const own = /^(road:tunnel |road:route RN01-04\+RN01-05\+RN01-06$|ride:)/, profH = o => { const P = PR.inner; for (let k = 1; k + 1 < P.length; k++) { const a = P[k], b = P[k + 1]; if (o >= Math.min(a[0], b[0]) - 1e-9 && o <= Math.max(a[0], b[0]) + 1e-9 && Math.abs(b[0] - a[0]) > 1e-9) return a[1] + (b[1] - a[1]) * (o - a[0]) / (b[0] - a[0]); } return tn.wallH; };
    const solid = []; S.scene.traverse(o => { if (!(o.isMesh || o.isInstancedMesh) || !o.geometry?.attributes?.position) return; for (let p = o; p; p = p.parent) if (!p.visible) return; const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.every(m => !m || (m.transparent && m.depthWrite === false) || m.blending === T.AdditiveBlending || m.colorWrite === false)) return; let name = o.name || ''; for (let p = o.parent; p && !name; p = p.parent) name = p.name || ''; let top = o; while (top.parent && top.parent !== S.scene) top = top.parent; if (own.test(name) || own.test(top.name || '')) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld), r = o.geometry.boundingSphere.radius * Math.max(o.matrixWorld.getMaxScaleOnAxis(), 1);
      const mid = routeAt(tunnelRt, (face0 + face1) / 2, 0); if (o.isInstancedMesh || c.distanceTo(new T.Vector3(mid.x, yOf(mid.bed + 3, mid.z), mid.z)) < r + 20) solid.push(o); });
    const ray = new T.Raycaster(), A = new T.Vector3(), Bv = new T.Vector3(), bore = { rays: 0, hits: 0, byName: {}, examples: [] };
    const shoot = (a, b, tag) => { A.set(...a); Bv.set(...b); const d = Bv.clone().sub(A), len = d.length(); if (len < 0.05) return; ray.set(A, d.normalize()); ray.near = 0; ray.far = len; bore.rays++;
      const h = ray.intersectObjects(solid, false); if (!h.length) return; bore.hits++; const o = h[0].object; let top = o; while (top.parent && top.parent !== S.scene) top = top.parent; const name = TS.ring.includes(o) || TS.rest.includes(o) ? 'terrain' : (o.name || top.name || o.type); bore.byName[name] = (bore.byName[name] || 0) + 1; if (bore.examples.length < 8) bore.examples.push(`${name} ${tag}`); };
    for (let s = face0 + 0.05; s < face1 - 0.05 + 1e-9; s += 0.5) for (let o = -tn.innerR + 0.15; o <= tn.innerR - 0.15 + 1e-9; o += 0.5) { const q = routeAt(tunnelRt, s, o); shoot([q.x, yOf(q.bed + 0.1, q.z), q.z], [q.x, yOf(q.bed + profH(o) - 0.05, q.z), q.z], `s=${s.toFixed(2)} o=${o.toFixed(2)} 竖`); }
    for (let s = face0 + 0.05; s < face1 - 0.05 + 1e-9; s += 0.25) for (const dy of [0.5, 1.5, 2.5, 3.5, 4.5]) { const half = Math.sqrt(Math.max(0, tn.innerR ** 2 - Math.max(0, dy - tn.wallH) ** 2)) - 0.1; if (half <= 0.2) continue; const a = routeAt(tunnelRt, s, -half), b = routeAt(tunnelRt, s, half); shoot([a.x, yOf(a.bed + dy, a.z), a.z], [b.x, yOf(b.bed + dy, b.z), b.z], `s=${s.toFixed(2)} dy=${dy} 横`); }
    t6.bore = bore; t6.cut = TS.stats.roadCut ? TS.stats.roadCut.structure : null; t6.solidMeshes = solid.length;
    out.ts6 = t6;
  }

  // ---- TS5: the ground cut polygons against the structures (each pair compared one circumference apart at most)
  const area = p => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
  const clip = (subj, poly) => { let q = subj; const sg = area(poly) >= 0 ? 1 : -1; for (let i = 0; i < poly.length && q.length >= 3; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], side = p => sg * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])), nq = [];
      for (let k = 0; k < q.length; k++) { const p0 = q[k], p1 = q[(k + 1) % q.length], s0 = side(p0), s1 = side(p1); if (s0 >= 0) nq.push(p0); if ((s0 >= 0) !== (s1 >= 0)) { const t = s0 / (s0 - s1); nq.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]); } } q = nq; } return q.length >= 3 ? Math.abs(area(q)) : 0; };
  const structs = [];
  for (const b of D.bridges) { const st = b.strips[0], m = b.topCols.length; for (let i = 0; i + 1 < b.samples.length; i++) { const c = j => [st.pos[j * 3], st.pos[j * 3 + 2]]; structs.push({ zone: 'bridge', id: b.def.id, s: b.samples[i].s, p: [c(i * m), c(i * m + m - 1), c((i + 1) * m + m - 1), c((i + 1) * m)] }); } }
  { const rt = tunnelRt, m0 = face0 + voidDepth[0], m1 = face1 - voidDepth[1], cuts = [tunnelSpan.s0, face0, m0, m1, face1, tunnelSpan.s1], zoneOf = s => (s < face0 ? 'opening-start' : s < m0 ? 'mouth-start' : s < m1 ? 'tunnel' : s < face1 ? 'mouth-end' : 'opening-end');
    const st = [...new Set([...cuts, ...rt.samples.map(q => q.s).filter(s => s > tunnelSpan.s0 && s < tunnelSpan.s1)])].sort((a, b) => a - b);
    for (let k = 0; k + 1 < st.length; k++) { const a = st[k], b = st[k + 1]; if (b - a < 1e-6) continue; const { i: ia } = rowAt(rt, a), fa = rt.footprint[ia], la = routeAt(rt, a, fa[2]), ra = routeAt(rt, a, fa[3]), lb = routeAt(rt, b, fa[2]), rb = routeAt(rt, b, fa[3]);
      structs.push({ zone: zoneOf((a + b) / 2), id: 'RN01-05', s: a, s1: b, p: [[la.x, la.z], [ra.x, ra.z], [rb.x, rb.z], [lb.x, lb.z]] }); } }
  for (const q of structs) { q.cx = q.p.reduce((s, p) => s + p[0], 0) / 4; q.box = [Math.min(...q.p.map(p => p[0])), Math.max(...q.p.map(p => p[0])), Math.min(...q.p.map(p => p[1])), Math.max(...q.p.map(p => p[1]))]; }
  const grid = new Map(), gk = (x, z) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  structs.forEach((q, n) => { for (let x = Math.floor(q.box[0] / 4); x <= Math.floor(q.box[1] / 4); x++) for (let z = Math.floor(q.box[2] / 4); z <= Math.floor(q.box[3] / 4); z++) { const k = `${x},${z}`; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(n); } });
  const polys = TS.roadPolygons || [], overlap = {}, bySource = {}, offenders = []; let unlabelled = 0;
  for (const c of polys) {
    const src = c.src || null; if (!src) unlabelled++; else { const k = `${src.kind}:${src.structure || 'grade'}`; bySource[k] = (bySource[k] || 0) + 1; }
    const cx = c.p.reduce((s, p) => s + p[0], 0) / c.p.length, seen = new Set();
    for (const shift of [-P, 0, P]) { const bx0 = Math.min(...c.p.map(p => p[0])) + shift, bx1 = Math.max(...c.p.map(p => p[0])) + shift, bz0 = Math.min(...c.p.map(p => p[1])), bz1 = Math.max(...c.p.map(p => p[1]));
      for (let x = Math.floor(bx0 / 4); x <= Math.floor(bx1 / 4); x++) for (let z = Math.floor(bz0 / 4); z <= Math.floor(bz1 / 4); z++) for (const n of grid.get(`${x},${z}`) || []) {
        if (seen.has(n)) continue; seen.add(n); const q = structs[n]; if (q.box[1] < bx0 || q.box[0] > bx1 || q.box[3] < bz0 || q.box[2] > bz1) continue;
        const a = clip(c.p.map(p => [p[0] + shift, p[1]]), q.p); if (a <= 0) continue;
        const zk = `${q.zone}:${q.id}`; overlap[zk] = (overlap[zk] || 0) + a; if (a > 1e-4 && offenders.length < 40) offenders.push({ zone: q.zone, id: q.id, s: +q.s.toFixed(2), area: +a.toFixed(5), src, cx: +(cx + shift).toFixed(2) });
      } }
  }
  out.audit = { polygons: polys.length, unlabelled, bySource, overlap: Object.fromEntries(Object.entries(overlap).map(([k, v]) => [k, +v.toFixed(5)])), offenders, structures: TS.stats.groundCut || null, roadCut: TS.stats.roadCut || null,
    zones: Object.fromEntries(['bridge', 'tunnel', 'opening-start', 'opening-end', 'mouth-start', 'mouth-end'].map(z => [z, +structs.filter(q => q.zone === z).reduce((s, q) => s + Math.abs(area(q.p)), 0).toFixed(3)])) };
  out.probes = probes.map(q => { const { xd, xo, ref, ...rest } = q; return { ...rest, x: +q.x.toFixed(3), z: +q.z.toFixed(3), refAlt: ref ? +ref.alt.toFixed(4) : null }; });
  out.sights = sights.map(q => ({ portal: q.portal, o: q.o, h: q.h }));
  out.walls = walls;
  return out;
}

// ---------------------------------------------------------------- run and judge
const browser = await chromium.launch({ args: soft ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=metal', '--ignore-gpu-blocklist'] });
let data, errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(html).href + '?quality=high');
  await page.waitForFunction(() => window.__scene && window.__scene.worldgen && window.__scene.worldgen.state.done && window.__scene.worldgen.state.firstFrameAt !== null, null, { timeout: 180000, polling: 200 });
  data = await page.evaluate(probe, { modes: [0, 0.5, 1] });
} finally { await browser.close(); cleanup(); }

const MODES = Object.keys(data.modes), P = data.probes, f = (v, n = 3) => (typeof v === 'number' ? v.toFixed(n) : String(v));
const errOf = (q, r) => (r.terr && r.tRef !== undefined ? r.terr.t - r.tRef : null);
// the nearest terrain triangle along the ray lies on the uncut lattice (its three flat vertices within 2 mm) and is hit where the lattice is (within the chord tolerance)
const terrOK = (q, r) => q.refAlt !== null && r.terr && r.terr.dev <= 2e-3 && Math.abs(r.terr.t - r.tRef) <= r.tol;
const summary = { commit, ref, html: path.relative(root, html), errors, info: data.info, audit: data.audit, modes: {} };
const fails = { TS1: [], TS2: [], TS3: [], TS4: [] }, add = (k, m) => { if (fails[k].length < 400) fails[k].push(m); };
const where = q => `${q.edge || q.bridge || q.abut} ${q.es !== undefined ? `@${q.es}` : ''} o=${q.o}`;
for (const u of MODES) {
  const M = data.modes[u], st = summary.modes[u] = { triangles: M.triangles, bridge: {}, tunnel: {}, approach: {}, mouth: {}, abutments: {}, walls: {}, sights: {}, maxErr: 0 };
  M.probes.forEach(r => {
    const q = P[r.i];
    if (q.test === 'bridge') {
      const b = st.bridge[q.bridge] || (st.bridge[q.bridge] = { probes: 0, noRef: 0, terrain: 0, missing: 0, off: 0, below: 0, belowOK: 0, holes: 0, embedded: 0, joint: 0, blocked: {}, maxErr: 0, maxDev: 0 });
      if (q.joint) { b.joint = (b.joint || 0) + 1; return; }       // the abutment row itself: the road's last row and the deck's first one (TS3 probes either side of it)
      b.probes++; if (q.refAlt === null) { b.noRef++; add('TS1', `${u} ${where(q)} 无参考三角形`); return; }
      if (q.occAlt !== undefined) { b.occupancy = (b.occupancy || 0) + 1;       // B1: in a ground occupancy, that ground is the near-side ground (0.3 m: as below; in ray units, flat at uBend 0)
        if (Math.abs(q.occAlt - q.refAlt) > 0.3) add('TS1', `${u} ${where(q)} 占地表面离格网 ${f(q.occAlt - q.refAlt)} m > 0.3`); else b.occupancyOK = (b.occupancyOK || 0) + 1;
        if (r.embedded) b.embedded++; else if (r.below) { b.below++; const h = r.below.first, lim = 0.3 * Math.cosh(q.z / 90);
          if (h && h.occ && Math.abs(h.t - r.below.tRef) <= lim) b.belowOK++; else if (h && h.t < r.below.tRef - lim) b.blocked[h.name] = (b.blocked[h.name] || 0) + 1;
          else { b.holes = (b.holes || 0) + 1; add('TS1', `${u} ${where(q)} 占地内桥下第一个不透明面 ${h ? `${h.name}（离格网 ${f(h.t - r.below.tRef, 2)}）` : '无命中'}`); } }
        return; }
      const e = errOf(q, r);
      if (!r.terr) { b.missing++; add('TS1', `${u} ${where(q)} 地形缺面（参考 ${f(q.refAlt)} m）`); }
      else if (!terrOK(q, r)) { b.off++; add('TS1', `${u} ${where(q)} 地形命中偏差 ${f(e, 4)} m（容差 ${f(r.tol, 4)}），顶点离未裁切地形 ${f(r.terr.dev, 4)}`); }
      else { b.terrain++; b.maxErr = Math.max(b.maxErr, Math.abs(e)); b.maxDev = Math.max(b.maxDev, r.terr.dev); st.maxErr = Math.max(st.maxErr, Math.abs(e)); }
      if (r.embedded) b.embedded++;
      else if (r.below) { b.below++; const h = r.below.first;
        if (h && h.t >= r.below.tRef - 0.3 && h.t <= r.below.tRef + r.tol) b.belowOK++;
        else if (h && h.t < r.below.tRef - 0.3) b.blocked[h.name] = (b.blocked[h.name] || 0) + 1;      // something nearer covers the view (island, embankment): no hole, not counted as seabed either
        else { const who = h ? `远于本侧地面 ${f(h.t - r.below.tRef, 2)} m：${h.name}` : '无命中'; b.holes = (b.holes || 0) + 1; add('TS1', `${u} ${where(q)} 桥下第一个不透明面 ${who}`); } }
    } else if (q.test === 'tunnel') {
      const t = st.tunnel, buried = q.refAlt !== null && q.refAlt - (q.o === 0 ? q.bed + data.info.tunnel.crownAbove : q.shellTop) >= 0.3;
      t.rows = t.rows || {}; const row = t.rows[q.s] || (t.rows[q.s] = { buriedRef: false, hit: null });
      if (q.o === 0) { row.buriedRef = buried; row.hit = r.terr && terrOK(q, r) ? q.refAlt - q.bed - data.info.tunnel.crownAbove : null; }
      if (!buried) { if (q.ring && q.refAlt !== null && q.refAlt - q.bed - data.info.tunnel.crownAbove < 0.3) t.portalOpen = (t.portalOpen || 0) + 1; return; }
      t.probes = (t.probes || 0) + 1;
      if (!r.terr) { t.missing = (t.missing || 0) + 1; add('TS2', `${u} ${where(q)} 隧道上方地形缺面（参考 ${f(q.refAlt)} m，壳顶 ${f(q.shellTop)} m）`); return; }
      if (!terrOK(q, r)) { t.off = (t.off || 0) + 1; add('TS2', `${u} ${where(q)} 地形命中偏差 ${f(errOf(q, r), 4)} m`); return; }
      t.ok = (t.ok || 0) + 1; st.maxErr = Math.max(st.maxErr, Math.abs(errOf(q, r)));
      const fh = r.first; if (!fh || !fh.terr && !(fh.t >= r.tRef - 0.3)) { t.covered = (t.covered || 0) + 1; add('TS2', `${u} ${where(q)} 俯视第一个面是 ${fh ? fh.name : '无'}`); }
    } else if (q.test === 'approach') {
      const a = st.approach[q.portal] || (st.approach[q.portal] = { probes: 0, road: 0, ground: 0, other: {}, insideSpan: 0 });
      a.probes++; if (q.inside) a.insideSpan++;
      const h = r.first; if (h && (h.road || h.tunnel)) a.road++; else { const who = h ? h.name : '无命中'; if (h && h.terr) a.ground++; a.other[who] = (a.other[who] || 0) + 1; add('TS3', `${u} 洞口 ${q.portal} ${where(q)} s=${q.s}${q.inside ? '（span 内）' : ''} 俯视第一个面 ${who}`); }
    } else if (q.test === 'mouth') {
      const a = st.mouth[q.portal] || (st.mouth[q.portal] = { probes: 0, aboveProfile: 0, aboveRoad: 0, maxAboveRoad: 0, left: 0 });
      a.probes++; if (q.refAlt === null) return;
      if (q.refAlt > q.profile - 1e-3) { a.aboveProfile++; add('TS3', `${u} 洞口 ${q.portal} 封面前 ${where(q)} s=${q.s} 原地形 ${f(q.refAlt)} m 高于开口轮廓 ${f(q.profile)} m（洞口裁切会删到开口上方山体）`); }
      if (q.refAlt > q.road) { a.aboveRoad++; a.maxAboveRoad = Math.max(a.maxAboveRoad, q.refAlt - q.road); }
      if (r.terr && terrOK(q, r) && q.refAlt > q.road + 0.02) a.left++;
    } else if (q.test === 'abut-deck' || q.test === 'abut-road') {
      const a = st.abutments[q.abut] || (st.abutments[q.abut] = { deck: 0, deckTop: 0, ground: 0, groundMissing: 0, road: 0, roadTop: 0 });
      if (q.test === 'abut-deck') { a.deck++; const h = r.first; if (h && h.road) a.deckTop++; else add('TS3', `${u} 桥台 ${q.abut} 桥面 ${where(q)} s=${q.s} 俯视第一个面 ${h ? h.name : '无'}`);
        if (q.atJoint) { a.jointRow = (a.jointRow || 0) + 1; return; }      // the shared row itself; the ground is checked from 0.05 m beyond it
        a.groundProbes = (a.groundProbes || 0) + 1;
        if (q.occAlt !== undefined && q.refAlt !== null && Math.abs(q.occAlt - q.refAlt) <= 0.3) { a.ground++; a.occupancy = (a.occupancy || 0) + 1; }      // B1: the occupancy's ground under the deck
        else if (q.refAlt !== null && terrOK(q, r)) a.ground++; else { a.groundMissing++; add('TS3', `${u} 桥台 ${q.abut} 桥下 ${where(q)} s=${q.s} 地形${r.terr ? `偏差 ${f(errOf(q, r), 4)}` : '缺面'}`); } }
      else { a.road++; const h = r.first; if (h && h.road) a.roadTop++; else add('TS3', `${u} 桥台 ${q.abut} 引道 ${where(q)} s=${q.s} 俯视第一个面 ${h ? h.name : '无'}`); }
    } else if (q.test === 'wall') {
      const w = st.walls[q.abut] || (st.walls[q.abut] = { columns: 0, buried: 0, gap: 0, minCover: Infinity });
      w.columns++; const ok = q.occAlt !== undefined ? q.refAlt !== null && Math.abs(q.occAlt - q.refAlt) <= 0.3 && q.occAlt >= q.bottom - 1e-3 : r.terr && terrOK(q, r) && q.refAlt >= q.bottom - 1e-3;      // (B1: or in the occupancy's ground)
      if (ok) { w.buried++; w.minCover = Math.min(w.minCover, q.refAlt - q.bottom); } else { w.gap++; add('TS3', `${u} 桥台端墙 ${q.abut} o=${q.o} 墙底 ${f(q.bottom)} m 下${r.terr ? `地面 ${f(q.refAlt)} m` : '地形缺面'}`); }
    }
  });
  M.sights.forEach((r, k) => { const q = data.sights[k], s = st.sights[q.portal] || (st.sights[q.portal] = { rays: 0, tunnel: 0, blocked: {}, examples: [] }); s.rays++; if (!(r.first && r.first.tunnel) && s.examples.length < 4) s.examples.push({ o: q.o, h: q.h, length: r.length, hits: r.hits });
    if (r.first && r.first.tunnel) s.tunnel++; else { const who = r.first ? r.first.name : '未闭合（无命中）'; s.blocked[who] = (s.blocked[who] || 0) + 1; add('TS3', `${u} 洞口 ${q.portal} 视线 o=${q.o} h=${q.h} 第一个面 ${who}`); } });
  // exposed lengths at the two portals from the actual hits on the centre line
  const rows = Object.entries(st.tunnel.rows || {}).map(([s, v]) => ({ s: +s, ...v })).sort((a, b) => a.s - b.s), cov = rows.filter(r => r.hit !== null && r.hit >= 0.3);
  st.tunnel.buriedRows = rows.filter(r => r.buriedRef).length; st.tunnel.coveredRows = cov.length;
  st.tunnel.exposed = cov.length ? [cov[0].s - data.info.tunnel.face0, data.info.tunnel.face1 - cov[cov.length - 1].s].map(v => +v.toFixed(2)) : null;
  const inner = cov.length ? rows.filter(r => r.s > cov[0].s && r.s < cov[cov.length - 1].s && !(r.hit !== null && r.hit >= 0.3)) : [];
  if (!cov.length || st.tunnel.exposed.some(v => v > 8) || inner.length) add('TS2', `${u} 隧道中线实际覆土 ≥ 0.3 m 的行 ${cov.length}，两端外露 ${st.tunnel.exposed ? st.tunnel.exposed.join(' / ') : '—'} m，中段缺 ${inner.length} 行`);
  delete st.tunnel.rows;
}
// TS4: one terrain for all three states
const sig = MODES.map(u => data.modes[u].signature), sameTerrain = sig.every(s => s === sig[0]);
const namesBy = Object.fromEntries(MODES.map(u => [u, data.modes[u].names])), allNames = [...new Set(Object.values(namesBy).flat())], onlySome = allNames.filter(n => MODES.some(u => !namesBy[u].includes(n)));
if (!sameTerrain) add('TS4', '地形网格在三个状态下不是同一组对象与几何');
if (onlySome.length) add('TS4', `只在部分状态出现在探针附近的网格：${onlySome.slice(0, 12).join('、')}`);
summary.modes4 = { sameTerrain, meshesNearProbes: allNames.length, onlySome };

const cnt = (u, k) => Object.values(summary.modes[u][k]);
for (const u of MODES) {
  const s = summary.modes[u], b = Object.entries(s.bridge).map(([id, v]) => `${id} ${v.terrain}/${v.probes}（缺 ${v.missing}、偏 ${v.off}、最大偏差 ${f(v.maxErr, 4)} m、顶点离未裁切地形 ≤ ${f(v.maxDev, 5)}；桥下第一面为本侧地面 ${v.belowOK}/${v.below}、空洞 ${v.holes}、入梁 ${v.embedded}、桥台共用行 ${v.joint}${v.occupancy ? `、在地面占地内 ${v.occupancyOK || 0}/${v.occupancy}` : ''}${Object.keys(v.blocked).length ? `、更近的面 ${JSON.stringify(v.blocked)}` : ''}）`).join('；');
  console.log(`  · uBend ${u}：TS1 ${b}；最大命中偏差 ${f(s.maxErr, 4)} m`);
  console.log(`  · uBend ${u}：TS2 应埋藏探针 ${s.tunnel.ok || 0}/${s.tunnel.probes || 0}（缺 ${s.tunnel.missing || 0}、偏 ${s.tunnel.off || 0}、俯视被盖 ${s.tunnel.covered || 0}；洞口环 1.4 m 内未埋的合法开口探针 ${s.tunnel.portalOpen || 0}），中线参考应埋行 ${s.tunnel.buriedRows}、实际覆土 ≥ 0.3 m 行 ${s.tunnel.coveredRows}，两端外露 ${s.tunnel.exposed ? s.tunnel.exposed.join(' / ') : '—'} m`);
  console.log(`  · uBend ${u}：TS3 引道 ${Object.entries(s.approach).map(([k, v]) => `${k} ${v.road}/${v.probes}（span 内 ${v.insideSpan}，地面盖路 ${v.ground}）`).join('、')}；封面前开口 ${Object.entries(s.mouth).map(([k, v]) => `${k} ${v.probes} 点（原地形高出路面 ${v.aboveRoad} 点、最高 ${f(v.maxAboveRoad, 2)} m，高于开口轮廓 ${v.aboveProfile}，仍有地面高出路面 ${v.left}）`).join('、')}；视线 ${Object.entries(s.sights).map(([k, v]) => `${k} ${v.tunnel}/${v.rays}`).join('、')}；桥台 ${cnt(u, 'abutments').reduce((a, v) => a + v.deckTop, 0)}/${cnt(u, 'abutments').reduce((a, v) => a + v.deck, 0)} 桥面在上、${cnt(u, 'abutments').reduce((a, v) => a + v.ground, 0)}/${cnt(u, 'abutments').reduce((a, v) => a + (v.groundProbes || 0), 0)} 桥下有地（离共用行 0.05–1 m）、引道 ${cnt(u, 'abutments').reduce((a, v) => a + v.roadTop, 0)}/${cnt(u, 'abutments').reduce((a, v) => a + v.road, 0)}；端墙 ${cnt(u, 'walls').reduce((a, v) => a + v.buried, 0)}/${cnt(u, 'walls').reduce((a, v) => a + v.columns, 0)} 列墙底入地（最小埋深 ${f(Math.min(...cnt(u, 'walls').map(v => v.minCover)), 2)} m）`);
}
const A = data.audit, bridgeOver = Object.entries(A.overlap).filter(([k]) => k.startsWith('bridge:')).reduce((s, [, v]) => s + v, 0), tunnelOver = A.overlap['tunnel:RN01-05'] || 0;
{ const bad = Object.entries(data.modes).flatMap(([u, M]) => (M.invalid || []).map(q => `uBend ${u} ${q}`)); check('TS0', !bad.length, `几何合法：显示中的网格（三种弯曲状态）非法 ${bad.length}${bad.length ? '：' + bad.slice(0, 6).join('；') : ''}`); }
check('TS1', !fails.TS1.length, `桥下保留：三座桥（${data.info.bridges.map(b => `${b.id} ${b.edges.join('+')} ${b.rows} 行${b.seam ? '，跨 −85° 接缝' : ''}${b.dateline ? '，跨日界线' : ''}`).join('；')}）每行与行中点、中线/±2.5/±4.9/±7/±9 m，地形单独命中裁切前网格，桥下第一个不透明面为本侧地面${fails.TS1.length ? `；例：${fails.TS1.slice(0, 6).join('；')}` : ''}`);
check('TS2', !fails.TS2.length, `隧道覆土：RN01-05 span ${f(data.info.tunnel.span.s0, 3)}–${f(data.info.tunnel.span.s1, 3)} m（${data.info.tunnel.route} 里程，边内 ${data.info.tunnel.span.e0}–${data.info.tunnel.span.e1} m），洞口面 ${data.info.tunnel.face0} / ${data.info.tunnel.face1} m；拱顶高出路基 ${data.info.tunnel.crownAbove} m、壳外半径 ${data.info.tunnel.shellR} m${fails.TS2.length ? `；例：${fails.TS2.slice(0, 6).join('；')}` : ''}`);
check('TS3', !fails.TS3.length, `洞口与桥头：两端洞口视线与 span 边界两侧引道、6 个桥台的桥面/桥下/引道与端墙${fails.TS3.length ? `；例：${fails.TS3.slice(0, 6).join('；')}` : ''}`);
check('TS4', !fails.TS4.length, `模式一致：uBend 0 / 0.5 / 1 地形网格同一组对象与几何 ${sameTerrain}；探针附近网格 ${allNames.length} 个，只在部分状态出现 ${onlySome.length}${fails.TS4.length ? `；${fails.TS4.join('；')}` : ''}`);
const openings = ['opening-start', 'mouth-start', 'mouth-end', 'opening-end'].map(z => `${z} ${f(A.overlap[`${z}:RN01-05`] || 0, 3)} / ${f(A.zones[z], 3)} m²`).join('、');
const T5 = data.info.tunnel, regOpen = ((A.structures && A.structures.kept) || []).filter(k => k.type === 'tunnel-portal'), wantOpen = [[T5.span.s0, T5.face0], [T5.face1, T5.span.s1]];
const openOK = regOpen.length === 2 && wantOpen.every(([a, b]) => regOpen.some(k => Math.abs(k.s0 - a) < 2e-3 && Math.abs(k.s1 - b) < 2e-3)) && regOpen.every(k => k.length <= 0.51);
const ts5 = A.polygons > 0 && A.unlabelled === 0 && bridgeOver <= 1e-3 && tunnelOver <= 1e-3 && openOK;
check('TS5', ts5, `裁切审计：地面裁切多边形 ${A.polygons}（未登记来源 ${A.unlabelled}${Object.keys(A.bySource).length ? `；${Object.entries(A.bySource).map(([k, v]) => `${k} ${v}`).join('、')}` : ''}）；与桥面重叠 ${f(bridgeOver, 4)} / ${f(A.zones.bridge, 1)} m²，与隧道内部（洞口面之间）重叠 ${f(tunnelOver, 4)} / ${f(A.zones.tunnel, 1)} m²；洞口开口（span 边界到洞口面）${openings}，terrain.js 登记 ${regOpen.map(k => `${k.end} ${k.s0}–${k.s1}（${k.length} m）`).join('、') || '无'}${openOK ? '' : `，应为 ${wantOpen.map(([a, b]) => `${f(a)}–${f(b)}`).join('、')}`}；路口三角形被结构裁去 ${A.structures ? A.structures.junctionTrianglesClipped : '—'}${A.offenders.length ? `；例：${A.offenders.slice(0, 4).map(o => `${o.zone} ${o.id}@${o.s} ${o.area} m² ${o.src ? JSON.stringify(o.src) : '无来源'}`).join('；')}` : ''}`);
{ const t = data.ts6, g = t.grid, b = t.bore, e = t.envelope, tt = t.terrainTriangles;
  const ok = e.vertices > 0 && e.missing === 0 && tt.triangles > 0 && tt.inside === 0 && g.points > 0 && g.shownInside === 0 && g.cutLeft === 0 && g.hillMissing === 0 && b.rays > 0 && b.hits === 0;
  check('TS6', ok, `隧道净空：外包（${t.parts.join('、')}）顶面 ${e.vertices} 个顶点与所画外壳/洞口环顶点重合缺 ${e.missing}；外包上方显示地形三角形 ${tt.triangles} 个、取样 ${tt.samples} 点，进入结构 ${tt.inside}（最深 ${f(tt.worst, 4)} m，容差 0.002）${tt.where.length ? ` ${JSON.stringify(tt.where)}` : ''}；0.25 m 网格 ${g.points} 点：原地形在结构内 ${g.inside}（已切 ${g.cut}、残留 ${g.cutLeft}），高于结构顶 ${g.hill}（保留 ${g.hillKept}、缺失 ${g.hillMissing}），低于结构底 ${g.underFoot}，显示面在结构内 ${g.shownInside}（最深 ${f(g.maxShownDepth, 4)} m）${g.examples.length ? ` ${JSON.stringify(g.examples)}` : ''}；洞内射线 ${b.rays} 条命中衬砌以外的面 ${b.hits}${b.hits ? ` ${JSON.stringify(b.byName)} 例：${b.examples.join('；')}` : ''}；地形裁切 ${t.cut ? `${t.cut.triangles} 个三角形、${t.cut.removedArea} m²` : '—'}`);
  summary.ts6 = t; }
check('TS-page', !errors.length, `页面错误 ${errors.length}${errors.length ? '：' + errors.slice(0, 3).join(' | ') : ''}`);
summary.fails = fails;
summary.probes = data.probes.length; summary.sightLines = data.sights.length;
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify({ ...summary, probeList: data.probes.slice(0, 20000) }, null, 1));
console.log(`报告：${path.relative(root, reportFile)}（探针 ${data.probes.length}、视线 ${data.sights.length}）`);
console.log(failures ? `${failures} 项未通过` : '全部通过');
process.exit(failures ? 1 : 0);
