// Sphere surface lines (docs/world/SPHERE_SURFACE_LINE_FIX_PLAN.md): the town's painted lines, drains, wet patches and paving strips lie on the surface that
// carries them in every bend state. Run after `python3 build.py`:
//   node tools/sphere_surface_line_check.mjs [--ref <git ref> | --html <built page>] [--report <path>] [--swiftshader] [--no-gpu]
// One page; every measure on the triangles the page actually displays, at uBend 0, 0.25, 0.5, 0.75 and 1. A displayed point is what the vertex shader draws:
// the world position, the seam shift, bendPosition (bend.js), and a triangle is the straight interpolation of its displayed vertices; a vertex that carries
// drapeA/B/C + drapeW (bend.js drape) is drawn as drapeW . bendPosition(drapeA, B, C). The carriers are the up-facing displayed triangles of the town's route
// strips and junction paving, the raised pavement islands, the curb ramps and the plot slabs; the overlays are everything laid flat on them.
//   SL0 geometry: finite positions and drape attributes, whole indices in range, no zero-area overlay triangle, page errors none
//   SL1 registry: every LAYOUT marking (zebra, stop line, centre, edge, diamond, text) is drawn: its covered area (flat) is the source area, its
//       samples all find an overlay triangle (no hole), its material and texture mapping are the P3 ones (planar x/4, -z/4 for the stripes; the decal quad's
//       own 0..1 for the diamonds and the text)
//   SL2 lie on the carrier: for every sample of every gated item (grid 0.1 m along x 5 across, plus the overlay's own vertices and edge midpoints) the
//       highest carrier on the local vertical (the shader's normal of a flat up face at that point) within 6 cm is found and the signed gap measured
//       (+ above the carrier, - under it) to its own carrier: the surface nearest to it in the flat map (within 15 mm; samples another surface already covers
//       in the flat map are hidden on both maps and counted apart); fails on a missing carrier, |gap| > 1 mm or another surface of its layer over it that
//       is not there in the flat map, in any state (a cover counts 0.5 mm inside that surface's edges: a sample on the edge an overlay ends on is not covered). Reported per item: deepest burial, highest float,
//       buried share (gap < -0.25 mm), the longest buried stretch along the item, samples with two carriers within 1 mm
//   SL3 one carrier face: every displayed triangle of a gated overlay lies inside one carrier triangle of its layer (flat), so the bend cannot fold it against
//       its carrier; triangles with no carrier of their layer (a puddle's rim under a curb) are counted with their area
//   SL4 pavement: the islands' ink outline on the islands' faces (bent), the paving's planar UV, the eight rounded corners (every overlay within 5 m)
//   SL5 audit (the classes not in GATED): grates (boxes), the alley-lamp glows, the plot flats, the junction paving outside the town (laid 1 cm over its
//       trunk); the gated classes are the markings, the paving strips, the drains (gutters, alley channels) and the puddles
//   SLG pixels (the real shader on the GPU, no formula of this tool): each item drawn in an id colour with its own depth offset, alone and over the
//       carriers in the page's own cameras on a 1600 x 900 view, from the rider's eye (1.6 m), a raised look (4 m) and the free view from above (pitch 0.9) at each zebra crossing and along the main
//       street's edge lines; each item over its own layer of carriers (the street for paint, drains and puddles; street, islands and ramps for the paving
//       strips; the slabs for the plot flats); for the paint, the paving strips and the puddles the share of its pixels left must be >= 98 % in every state
//       where it covers 40 px or more (items within 9 m of the look point); SLG-drains: no gutter or channel drawn in part (5-95 %) and their mean share
//       alike (within 2 %) in every state; the other classes are reported (mean share shown, items drawn only in part)
// Report: docs/world/sphere-surface-lines/report.json (not tracked); --ref builds that git ref in a temporary worktree and writes report-<ref>.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const ref = arg('--ref', null), soft = args.includes('--swiftshader'), gpu = !args.includes('--no-gpu');
const outDir = path.join(root, 'docs/world/sphere-surface-lines'), reportFile = path.resolve(root, arg('--report', path.join(outDir, ref ? `report-${ref.replace(/[^\w.-]+/g, '_')}.json` : 'report.json')));
// the classes whose every sample must lie on its carrier (SL2, SL3; the classes bend.js drape lays); of them the ones drawn over their carrier (SLG >= 98 %); the
// drains lose to the street's depth offset on both maps (since W10e), so SLG asks them to look the same in every state, never drawn in part; the others are audited
const GATED = ['marking', 'pavement', 'drain', 'wet'], SHOWN = ['marking', 'pavement', 'wet'];
let failures = 0;
const check = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures++; };

let html = arg('--html', null) ? path.resolve(arg('--html')) : path.join(root, 'index.html'), cleanup = () => {}, commit;
if (ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slc-'));
  execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['build.py'], { cwd: dir, stdio: 'pipe' });
  html = path.join(dir, 'index.html'); commit = execFileSync('git', ['rev-parse', ref], { cwd: root, encoding: 'utf8' }).trim();
  cleanup = () => { try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'pipe' }); } catch { fs.rmSync(dir, { recursive: true, force: true }); } };
} else commit = arg('--html', null) ? null : execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

// ---------------------------------------------------------------- the page part
async function probe({ US, GATED, SHOWN, gpu }) {
  const S = window.__scene, B = S.bend, L = window.LAYOUT, T = window.THREE, H = L.BASE.half, LV = L.LEVELS, TOL = 0.001, BURIED = 0.00025, WIN = 0.2, LAYER = 0.015;   // WIN: a curb's top (13 cm) is seen over a puddle's edge
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  S.transition.auto = false; B.set(0); await frame();
  S.scene.updateMatrixWorld(true);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const hex = o => { const m = Array.isArray(o.material) ? o.material[0] : o.material; return m && m.color ? m.color.getHexString() : ''; };
  const pathName = o => { const n = []; for (let p = o; p && p !== S.scene; p = p.parent) n.push(p.name || p.type); return n.reverse().join('/'); };
  const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  // the 2D barycentre of (x, z) in a flat triangle; null outside (eps in the weights)
  const bary = (x, z, a, b, c, eps = 1e-7) => { const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(d) < 1e-14) return null;
    const w0 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, w1 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d, w2 = 1 - w0 - w1;
    return w0 >= -eps && w1 >= -eps && w2 >= -eps ? [w0, w1, w2] : null; };
  const area2 = (a, b, c) => Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2])) / 2;

  // ---- displayed geometry of a mesh: flat world vertices, triangles, and the displayed vertex at u (the shader's path, cached per u)
  function meshData(o) {
    const g = o.geometry, p = g.attributes.position, e = o.matrixWorld.elements, ix = g.index, n = Math.min(ix ? ix.count : p.count, g.drawRange.start + g.drawRange.count);
    const wrap = !(o.material && !Array.isArray(o.material) && o.material.userData && o.material.userData.noWrap);
    const V = new Float64Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); V[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; V[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; V[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
    const tris = []; for (let t = 0; t + 2 < n; t += 3) tris.push([ix ? ix.getX(t) : t, ix ? ix.getX(t + 1) : t + 1, ix ? ix.getX(t + 2) : t + 2]);
    const dA = g.attributes.drapeA, dB = g.attributes.drapeB, dC = g.attributes.drapeC, dW = g.attributes.drapeW, drape = !!(dA && dB && dC && dW);
    const cache = new Map();
    const disp = u => { let D = cache.get(u); if (D) return D; D = new Float64Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const sx = wrap ? B.shift(V[i * 3]) : 0;
        if (drape && u > 0) { let q = [0, 0, 0]; for (const [A, w] of [[dA, dW.getX(i)], [dB, dW.getY(i)], [dC, dW.getZ(i)]]) { const r = B.point(A.getX(i) + sx, A.getY(i), A.getZ(i), u); q = [q[0] + w * r[0], q[1] + w * r[1], q[2] + w * r[2]]; } D.set(q, i * 3); }
        else D.set(B.point(V[i * 3] + sx, V[i * 3 + 1], V[i * 3 + 2], u), i * 3);
      }
      cache.set(u, D); return D; };
    const at = (A, i) => [A[i * 3], A[i * 3 + 1], A[i * 3 + 2]];
    return { o, g, V, tris, disp, at, drape, name: pathName(o) };
  }
  // a uniform grid over flat x, z of triangles (each in the cells its box + pad covers)
  function gridOf(items, pad, cell) { const m = new Map(), key = (a, b) => a * 100003 + b;
    for (const it of items) { const xs = it.v.map(q => q[0]), zs = it.v.map(q => q[2]);
      for (let a = Math.floor((Math.min(...xs) - pad) / cell); a <= Math.floor((Math.max(...xs) + pad) / cell); a++) for (let b = Math.floor((Math.min(...zs) - pad) / cell); b <= Math.floor((Math.max(...zs) + pad) / cell); b++) { const k = key(a, b); let l = m.get(k); if (!l) m.set(k, l = []); l.push(it); } }
    return (x, z) => m.get(key(Math.floor(x / cell), Math.floor(z / cell))) || []; }

  // ---- SL0 validity of a geometry (this tool's own rules)
  const issues = (g, tri) => { const out = [], pos = g.attributes.position;
    for (const [k, a] of Object.entries(g.attributes)) { if (a.count !== pos.count) out.push(`${k} count ${a.count} != ${pos.count}`); let bad = 0; for (let i = 0; i < a.array.length; i++) if (!Number.isFinite(a.array[i])) bad++; if (bad) out.push(`${k}: ${bad} non-finite`); }
    if (g.index) { let wrong = 0; for (let i = 0; i < g.index.count; i++) { const v = g.index.getX(i); if (!(Number.isInteger(v) && v >= 0 && v < pos.count)) wrong++; } if (wrong) out.push(`${wrong} indices out of range`); if (tri && g.index.count % 3) out.push('index count % 3'); }
    return out; };

  // ---------------------------------------------------------------- the carriers
  const roadsRoot = S.roads.state.root, carriers = [];
  const inTown = (o, pad = 8) => { const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld); return !(bb.max.x < -H - pad || bb.min.x > H + pad || bb.max.z < -H - pad || bb.min.z > H + pad); };
  roadsRoot.traverse(o => { if (o.isMesh && !o.isInstancedMesh && /^road:(route |junction paving)/.test(o.name) && visible(o)) carriers.push({ o, kind: /junction paving/.test(o.name) ? 'junction' : 'road' }); });
  for (const o of S.scene.children) if (o.isMesh && o.userData.groundOccupancy && !o.material.polygonOffset && inTown(o)) carriers.push({ o, kind: hex(o) === '87908c' ? 'island' : 'ramp' });
  const plots = S.groups.plots; if (plots) plots.traverse(o => { if (o.isMesh && o.userData.groundOccupancy && !o.material.polygonOffset) carriers.push({ o, kind: 'slab' }); });   // the slabs (the flats on them carry a depth offset)
  // the 4 m cells the junction pavings (+ 2 m) reach: the street triangles there are carriers too (SL5)
  const jCells = new Set(), jKey = (x, z) => Math.floor(x / 4) * 100003 + Math.floor(z / 4);
  roadsRoot.traverse(o => { if (!o.isMesh || !/^road:junction paving/.test(o.name)) return; const p = o.geometry.attributes.position, e = o.matrixWorld.elements;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), wx = e[0] * x + e[4] * y + e[8] * z + e[12], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      for (const dx of [-2, 0, 2]) for (const dz of [-2, 0, 2]) jCells.add(jKey(wx + dx, wz + dz)); } });
  const nearJunction = (x, z) => jCells.has(jKey(x, z));
  const carrierTris = [], carrierData = new Map();
  for (const c of carriers) { const d = meshData(c.o); c.d = d; carrierData.set(c.o, d); const town = c.kind !== 'road' && c.kind !== 'junction';
    const side = (Array.isArray(c.o.material) ? c.o.material[0] : c.o.material).side;
    for (const t of d.tris) { const v = t.map(i => d.at(d.V, i)); const n = cross(sub(v[1], v[0]), sub(v[2], v[0])), l = Math.hypot(...n); if (l < 1e-12) continue;
      const ny = n[1] / l; if (!(ny > 0.2 || (side === T.DoubleSide && ny < -0.2))) continue;
      if (!town && !v.some(q => (Math.abs(q[0]) < H + 20 && Math.abs(q[2]) < H + 20) || nearJunction(q[0], q[2]))) continue;          // the town and its exits (CR01 at 54 m), the junction pavings
      const a2 = Math.hypot(...n), h = [0, 1, 2].map(k => a2 / Math.hypot(...sub(v[(k + 2) % 3], v[(k + 1) % 3])));   // each corner's altitude over the opposite edge
      carrierTris.push({ c, d, t, v, h }); } }
  const carrierAt = gridOf(carrierTris, 0.1, 1);
  // the carriers at a displayed point P on its local vertical n within WIN: every hit as the gap of P over it (+ P above the carrier), the highest carrier first
  // layer: [flat y, tolerance]: only carriers whose flat height at (x, z) is that close (the overlay's own layer; a raised slab over it is not its carrier)
  // metric: a hit up to that many metres outside a triangle counts (a point on a carrier's edge, float32 positions bent at R = 90)
  function carriersUnder(x, z, P, n, u, skip, eps = 1e-9, layer = null, metric = 0) {
    const O = [P[0] + n[0] * 0.1, P[1] + n[1] * 0.1, P[2] + n[2] * 0.1], D = [-n[0], -n[1], -n[2]], hits = [];
    for (const ct of carrierAt(x, z)) { if (skip && skip(ct)) continue;
      if (layer) { const w = bary(x, z, ...ct.v, 1e-3); if (!w || Math.abs(w[0] * ct.v[0][1] + w[1] * ct.v[1][1] + w[2] * ct.v[2][1] - layer[0]) > layer[1]) continue; } const Dd = ct.d.disp(u), A = ct.d.at(Dd, ct.t[0]), Bv = ct.d.at(Dd, ct.t[1]), C = ct.d.at(Dd, ct.t[2]);
      // the weight of each corner may go below 0 by eps, or by metric over that corner's altitude (metric metres outside the opposite edge)
      const eA = metric ? Math.max(eps, metric / ct.h[0]) : eps, eB = metric ? Math.max(eps, metric / ct.h[1]) : eps, eC = metric ? Math.max(eps, metric / ct.h[2]) : eps;
      const e1 = sub(Bv, A), e2 = sub(C, A), pp = cross(D, e2), det = dot(e1, pp); if (Math.abs(det) < 1e-14) continue; const inv = 1 / det, s = sub(O, A), a = dot(s, pp) * inv; if (a < -eB) continue;
      const q = cross(s, e1), b = dot(D, q) * inv; if (b < -eC || 1 - a - b < -eA) continue; const t = dot(e2, q) * inv, gap = t - 0.1; if (Math.abs(gap) <= WIN) hits.push({ gap, ct, strict: a >= 5e-4 / ct.h[1] && b >= 5e-4 / ct.h[2] && 1 - a - b >= 5e-4 / ct.h[0] }); }   // strict: 0.5 mm inside every edge
    hits.sort((p, q) => p.gap - q.gap); return hits; }
  const upAt = (x, z, u) => { const b = B.basis(B.wrapX(x), z); return norm([b.up[0] * u, 1 - u + b.up[1] * u, b.up[2] * u]); };

  // ---------------------------------------------------------------- the overlays and their items
  const overlays = [], items = [];
  const addItem = (it) => { it.samples = []; items.push(it); return it; };
  // the footprint as a frame: centre c, along a (unit, half length ha), across b (unit, half width hb); an ellipse when round
  const rectItem = (cls, kind, id, r, extra = {}) => { const lx = r[2] - r[0], lz = r[3] - r[1], alongX = lx >= lz;
    return addItem({ cls, kind, id, c: [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2], a: alongX ? [1, 0] : [0, 1], b: alongX ? [0, 1] : [1, 0], ha: Math.max(lx, lz) / 2, hb: Math.min(lx, lz) / 2, area: lx * lz, ...extra }); };
  const markings = S.groups.markings, drainage = S.groups.drainage, wet = S.groups.wetStreet, furniture = S.groups.streetFurniture;
  if (markings) for (const o of markings.children) if (o.isMesh) overlays.push({ o, cls: 'marking' });
  for (const m of L.markings) {
    if (m.rect) { rectItem('marking', m.kind, m.id, m.rect); continue; }
    const q = new T.Object3D(); q.rotation.set(-Math.PI / 2, Math.atan2(-m.heading[0], -m.heading[1]), 0, 'YXZ'); q.position.set(m.x, LV.carriageway, m.z); q.updateMatrixWorld(true);
    const ax = new T.Vector3(1, 0, 0).applyQuaternion(q.quaternion), ay = new T.Vector3(0, 1, 0).applyQuaternion(q.quaternion), alongY = m.size[1] >= m.size[0];
    addItem({ cls: 'marking', kind: m.kind, id: m.id, c: [m.x, m.z], a: alongY ? [ay.x, ay.z] : [ax.x, ax.z], b: alongY ? [ax.x, ax.z] : [ay.x, ay.z], ha: Math.max(...m.size) / 2, hb: Math.min(...m.size) / 2, area: m.size[0] * m.size[1], decal: { inv: q.matrixWorld.clone().invert(), w: m.size[0], h: m.size[1] } });
  }
  if (drainage) for (const o of drainage.children) if (o.isMesh) { const h = hex(o); overlays.push({ o, cls: h === '737c7d' || h === '5f6661' ? 'drain' : h === '9aa3a6' ? 'grate' : 'channel-bar' }); }
  for (const g of L.gutters) rectItem('drain', 'gutter', g.id, g.rect);
  for (const c of L.channels) rectItem('drain', 'channel', c.id, c.rect);
  for (const g of L.grates) { const [w, d] = L.DRAIN.grate, sx = g.line === 'z' ? w : d, sz = g.line === 'z' ? d : w; rectItem('grate', 'grate', g.id, [g.x - sx / 2, g.z - sz / 2, g.x + sx / 2, g.z + sz / 2]); }
  if (wet) for (const o of wet.children) if (o.isMesh) overlays.push({ o, cls: 'wet' });
  L.puddles.forEach((p, k) => addItem({ cls: 'wet', kind: 'puddle', id: p.id || `puddle-${k}`, c: [p.x, p.z], a: [1, 0], b: [0, 1], ha: p.rx, hb: p.rz, round: true, area: Math.PI * p.rx * p.rz }));
  if (furniture) for (const o of furniture.children) if (o.isMesh && o.material.blending === T.AdditiveBlending) overlays.push({ o, cls: 'glow' });
  (S.roads.state.townDetails && S.roads.state.townDetails.alleyLamps || []).forEach((l, k) => addItem({ cls: 'glow', kind: 'alley-lamp pool', id: `alley-lamp-${k}`, c: [l.x, l.z], a: [1, 0], b: [0, 1], ha: l.r, hb: l.r, round: true, area: Math.PI * l.r * l.r }));
  // the paving strips laid on the islands (facility bands, walkway, bus aprons) and the plots' buildable flats on their slabs: one item per mesh
  for (const o of S.scene.children) if (o.isMesh && o.userData.groundOccupancy && o.material.polygonOffset && inTown(o, 0)) {
    const h = hex(o), kind = h === '9aa29c' ? 'band' : h === '8d8c80' ? 'walkway' : h === '8c9ba3' ? 'apron' : 'pavement ' + h; overlays.push({ o, cls: 'pavement' });
    const g = o.geometry; g.computeBoundingBox(); const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld); rectItem('pavement', kind, `${kind}@${((bb.min.x + bb.max.x) / 2).toFixed(2)},${((bb.min.z + bb.max.z) / 2).toFixed(2)}`, [bb.min.x, bb.min.z, bb.max.x, bb.max.z]); }
  if (plots) plots.traverse(o => { if (o.isMesh && o.userData.groundOccupancy && o.material.polygonOffset) { overlays.push({ o, cls: 'plot' }); const g = o.geometry; g.computeBoundingBox(); const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
    rectItem('plot', 'buildable', `plot@${((bb.min.x + bb.max.x) / 2).toFixed(2)},${((bb.min.z + bb.max.z) / 2).toFixed(2)}`, [bb.min.x, bb.min.z, bb.max.x, bb.max.z]); } });
  roadsRoot.traverse(o => { if (o.isMesh && /^road:junction paving/.test(o.name)) overlays.push({ o, cls: 'junction' }); });

  // overlay triangles (flat) by class, the up-facing ones (a grate's top only)
  const ovTris = {}, sl0 = [];
  for (const ov of overlays) { const d = meshData(ov.o); ov.d = d; for (const s of issues(ov.o.geometry, true)) sl0.push(`${d.name}: ${s}`);
    for (const t of d.tris) { const v = t.map(i => d.at(d.V, i)), n = cross(sub(v[1], v[0]), sub(v[2], v[0])), l = Math.hypot(...n);
      if (l < 1e-12) { if (GATED.includes(ov.cls)) sl0.push(`${d.name}: zero-area triangle at ${v[0][0].toFixed(2)},${v[0][2].toFixed(2)}`); continue; }
      if (Math.abs(n[1] / l) < 0.9) continue; if (ov.cls === 'grate' && n[1] < 0) continue;
      (ovTris[ov.cls] = ovTris[ov.cls] || []).push({ ov, d, t, v }); } }
  const ovAt = {}; for (const [k, l] of Object.entries(ovTris)) ovAt[k] = gridOf(l, 0.01, 0.5);
  const inItem = (it, x, z, pad = 1e-4) => { const dx = x - it.c[0], dz = z - it.c[1], s = dx * it.a[0] + dz * it.a[1], t = dx * it.b[0] + dz * it.b[1];
    return it.round ? (s / (it.ha + pad)) ** 2 + (t / (it.hb + pad)) ** 2 <= 1 : Math.abs(s) <= it.ha + pad && Math.abs(t) <= it.hb + pad; };
  const itemsByCls = {}; for (const it of items) (itemsByCls[it.cls] = itemsByCls[it.cls] || []).push(it);
  const itemGrid = {}; for (const [k, l] of Object.entries(itemsByCls)) itemGrid[k] = gridOf(l.map(it => ({ it, v: [-1, 1].flatMap(sa => [-1, 1].map(sb => [it.c[0] + sa * it.ha * it.a[0] + sb * it.hb * it.b[0], 0, it.c[1] + sa * it.ha * it.a[1] + sb * it.hb * it.b[1]])) })), 0.01, 1);
  const ownerOf = (cls, x, z) => { const own = (itemGrid[cls] ? itemGrid[cls](x, z) : []).filter(q => inItem(q.it, x, z)); return own.length ? own[0].it : null; };
  // samples: a grid along x across in the footprint (2 mm inside its edges), then the overlay's own vertices and edge midpoints inside it
  const step = { marking: 0.1, pavement: 0.1, drain: 0.1, grate: 0.05, wet: 0.1, glow: 0.2, plot: 0.25, junction: 0.25 };
  for (const it of items) {
    const sa = step[it.cls] || 0.1, na = Math.max(2, Math.ceil((2 * it.ha - 0.004) / sa)), nb = 5;
    for (let i = 0; i <= na; i++) for (let j = 0; j < nb; j++) { const s = -it.ha + 0.002 + (2 * it.ha - 0.004) * i / na, t = -it.hb + 0.002 + (2 * it.hb - 0.004) * j / (nb - 1);
      if (it.round && (s / it.ha) ** 2 + (t / it.hb) ** 2 > 0.98) continue;
      it.samples.push({ x: it.c[0] + s * it.a[0] + t * it.b[0], z: it.c[1] + s * it.a[1] + t * it.b[1], s }); }
  }
  for (const [cls, list] of Object.entries(ovTris)) for (const tr of list) { const pts = [...tr.v, [(tr.v[0][0] + tr.v[1][0]) / 2, 0, (tr.v[0][2] + tr.v[1][2]) / 2], [(tr.v[1][0] + tr.v[2][0]) / 2, 0, (tr.v[1][2] + tr.v[2][2]) / 2], [(tr.v[2][0] + tr.v[0][0]) / 2, 0, (tr.v[2][2] + tr.v[0][2]) / 2]];
    for (const p of pts) { const it = ownerOf(cls, p[0], p[2]); if (it) it.samples.push({ x: p[0], z: p[2], s: (p[0] - it.c[0]) * it.a[0] + (p[2] - it.c[1]) * it.a[1], vertex: true }); } }
  // the overlay triangle drawn at each sample (its own class), the barycentre: the displayed point at u is the interpolation of the displayed vertices
  for (const it of items) for (const sp of it.samples) { for (const tr of (ovAt[it.cls] ? ovAt[it.cls](sp.x, sp.z) : [])) { const w = bary(sp.x, sp.z, ...tr.v, 1e-6); if (w) { sp.tr = tr; sp.w = w; break; } } }

  // ---------------------------------------------------------------- SL1 registry (markings)
  const sl1 = [], ownArea = new Map();
  for (const tr of ovTris.marking || []) { const cx = (tr.v[0][0] + tr.v[1][0] + tr.v[2][0]) / 3, cz = (tr.v[0][2] + tr.v[1][2] + tr.v[2][2]) / 3, it = ownerOf('marking', cx, cz);
    if (!it) { sl1.push(`marking triangle outside every LAYOUT marking at ${cx.toFixed(2)},${cz.toFixed(2)} (${tr.d.name})`); continue; }
    ownArea.set(it, (ownArea.get(it) || 0) + area2(...tr.v)); tr.item = it; }
  const uvErr = { rect: 0, decal: 0 };
  for (const tr of ovTris.marking || []) { const it = tr.item; if (!it) continue; const uv = tr.d.g.attributes.uv; if (!uv) { sl1.push(`${it.id}: no uv`); continue; }
    for (const i of tr.t) { const p = tr.d.at(tr.d.V, i); let eu, ev;
      if (it.decal) { const q = new T.Vector3(p[0], p[1], p[2]).applyMatrix4(it.decal.inv); eu = q.x / it.decal.w + 0.5; ev = q.y / it.decal.h + 0.5; uvErr.decal = Math.max(uvErr.decal, Math.hypot(uv.getX(i) - eu, uv.getY(i) - ev)); }
      else { eu = p[0] / 4; ev = -p[2] / 4; uvErr.rect = Math.max(uvErr.rect, Math.hypot(uv.getX(i) - eu, uv.getY(i) - ev)); } } }
  if (uvErr.rect > 1e-4 || uvErr.decal > 2e-3) sl1.push(`uv off the P3 mapping: stripes ${uvErr.rect.toExponential(2)}, decals ${uvErr.decal.toExponential(2)}`);
  const areaWorst = []; for (const it of itemsByCls.marking || []) { const a = ownArea.get(it) || 0, r = a / it.area - 1; if (Math.abs(r) > 0.005) sl1.push(`${it.id}: drawn area ${a.toFixed(4)} m2 of ${it.area.toFixed(4)}`); areaWorst.push(Math.abs(r)); }
  for (const it of itemsByCls.marking || []) { const holes = it.samples.filter(sp => !sp.tr).length; if (holes) sl1.push(`${it.id}: ${holes} of ${it.samples.length} samples on no overlay triangle`); }
  const matOf = o => { const m = o.material; return { color: m.color.getHexString(), opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite, offset: [m.polygonOffsetFactor, m.polygonOffsetUnits], map: !!m.map, type: m.type }; };
  const markMats = (overlays.filter(q => q.cls === 'marking')).map(q => matOf(q.o));
  for (const m of markMats) if (m.color !== 'c9cfc4' || Math.abs(m.opacity - 0.78) > 1e-6 || !m.transparent || m.depthWrite || m.offset[0] !== -3 || m.offset[1] !== -6 || m.type !== 'MeshBasicMaterial') sl1.push(`marking material changed: ${JSON.stringify(m)}`);
  const decalMaps = overlays.filter(q => q.cls === 'marking' && q.o.material.map).length, decalCount = L.markings.filter(m => !m.rect).length;
  if (decalMaps < decalCount) sl1.push(`${decalCount - decalMaps} decals without their texture`);

  // ---------------------------------------------------------------- SL2 per item and state; SL5 the same on the audited classes
  const perU = {}, worst = {};
  for (const u of US) {
    for (const it of items) {
      const r = { n: 0, min: Infinity, max: -Infinity, buried: 0, noCarrier: 0, uncovered: 0, multi: 0, flatCovered: 0, newCover: 0, kinds: {} }, buriedS = [];
      for (const sp of it.samples) {
        if (!sp.tr) { r.uncovered++; continue; }
        const D = sp.tr.d.disp(u), P = [0, 0, 0]; for (let k = 0; k < 3; k++) { const q = sp.tr.d.at(D, sp.tr.t[k]); P[0] += sp.w[k] * q[0]; P[1] += sp.w[k] * q[1]; P[2] += sp.w[k] * q[2]; }
        const all = carriersUnder(sp.x, sp.z, P, upAt(sp.x, sp.z, u), u, null, 1e-6, null, 1e-4);
        // the flat map decides: the sample's own carrier is the surface nearest to it there (within 15 mm), and a sample another surface already covers there is
        // counted apart (it is hidden on both maps); in every state the gap is taken to the own carrier, and any other surface over it is a new cover
        if (u === 0) { const own = all.filter(h => Math.abs(h.gap) <= LAYER).sort((p, q) => Math.abs(p.gap) - Math.abs(q.gap))[0]; sp.own = own ? own.ct.c.o : null;
          sp.covered = all.some(h => h.strict && h.gap < -TOL && h.ct.c.o !== sp.own); }      // strictly over it (not a curb's or a strip's edge it ends on)
        r.n++;
        if (sp.covered) { r.flatCovered++; continue; }
        const mine = all.filter(h => h.ct.c.o === sp.own);
        if (!mine.length) { r.noCarrier++; continue; }
        const own = mine.reduce((p, q) => (Math.abs(q.gap) < Math.abs(p.gap) ? q : p)), g = own.gap; r.kinds[own.ct.c.kind] = (r.kinds[own.ct.c.kind] || 0) + 1;
        // a new cover: another surface of the overlay's own layer that lies over the sample in the flat map too (0.5 mm inside its edges, flat height within
        // 15 mm: two street strips overlapping at a junction mouth) and comes over it in the bend; a neighbour that only meets the carrier at an edge is not one
        // (its edge chord along a parallel overhangs the seam by millimetres on the sphere, carrier against carrier, about 7 mm for 4 m at 20 deg)
        const flatY = h => { const w = bary(sp.x, sp.z, ...h.ct.v, 1); return w && w.every((q, k) => q >= 5e-4 / h.ct.h[k]) ? w[0] * h.ct.v[0][1] + w[1] * h.ct.v[1][1] + w[2] * h.ct.v[2][1] : Infinity; }, y0 = sp.w[0] * sp.tr.v[0][1] + sp.w[1] * sp.tr.v[1][1] + sp.w[2] * sp.tr.v[2][1];
        const cover = all.find(h => h.strict && h.ct.c.o !== sp.own && h.gap < -TOL && Math.abs(flatY(h) - y0) <= LAYER);
        if (cover) { r.newCover++; if (!r.newCoverAt) r.newCoverAt = { at: [+sp.x.toFixed(3), +sp.z.toFixed(3)], by: cover.ct.d.name, mm: +(cover.gap * 1000).toFixed(3) }; }
        const other = all.find(h => h.ct.c.o !== sp.own && Math.abs(h.gap - g) < 0.001); if (other) { r.multi++; if (!r.multiAt) r.multiAt = { at: [+sp.x.toFixed(2), +sp.z.toFixed(2)], carriers: [own.ct.d.name, other.ct.d.name] }; }
        if (g < r.min) { r.min = g; r.minAt = [+sp.x.toFixed(3), +sp.z.toFixed(3)]; r.minCarrier = own.ct.d.name; }
        if (g > r.max) { r.max = g; r.maxAt = [+sp.x.toFixed(3), +sp.z.toFixed(3)]; }
        if (g < -BURIED) { r.buried++; buriedS.push(sp.s); }
      }
      // the longest stretch along the item where samples are buried (merged when closer than 1.5 grid steps)
      buriedS.sort((a, b) => a - b); let best = 0, s0 = null, prev = null; const gapStep = 1.5 * (step[it.cls] || 0.1);
      for (const s of buriedS) { if (prev === null || s - prev > gapStep) s0 = s; prev = s; best = Math.max(best, s - s0); }
      r.longest = buriedS.length ? best + (step[it.cls] || 0.1) : 0; r.buriedShare = r.n ? r.buried / r.n : 0;
      (perU[u] = perU[u] || {})[it.id] = r;
    }
  }
  const fmt = v => (Number.isFinite(v) ? +(v * 1000).toFixed(3) : null);   // mm
  const summary = (cls, u, kind) => { const list = items.filter(it => it.cls === cls && (!kind || it.kind === kind)); if (!list.length) return null; const rs = list.map(it => [it, perU[u][it.id]]);
    const minR = rs.reduce((a, b) => (b[1].min < a[1].min ? b : a)), maxR = rs.reduce((a, b) => (b[1].max > a[1].max ? b : a)), longR = rs.reduce((a, b) => (b[1].longest > a[1].longest ? b : a));
    const n = rs.reduce((s, q) => s + q[1].n, 0), buried = rs.reduce((s, q) => s + q[1].buried, 0);
    return { items: list.length, samples: n, buriedShare: n ? +(buried / n).toFixed(4) : 0, itemsBuried: rs.filter(q => q[1].buried).length, deepestMm: fmt(minR[1].min), deepestId: minR[0].id, deepestAt: minR[1].minAt, deepestCarrier: minR[1].minCarrier,
      highestMm: fmt(maxR[1].max), highestId: maxR[0].id, longestBuriedM: +longR[1].longest.toFixed(2), longestId: longR[0].id,
      noCarrier: rs.reduce((s, q) => s + q[1].noCarrier, 0), uncovered: rs.reduce((s, q) => s + q[1].uncovered, 0), multi: rs.reduce((s, q) => s + q[1].multi, 0), flatCovered: rs.reduce((s, q) => s + q[1].flatCovered, 0), newCover: rs.reduce((s, q) => s + q[1].newCover, 0),
      carriers: rs.reduce((s, q) => { for (const [k, v] of Object.entries(q[1].kinds)) s[k] = (s[k] || 0) + v; return s; }, {}) }; };
  const classes = {}; for (const cls of Object.keys(itemsByCls)) { classes[cls] = {}; for (const u of US) classes[cls][u] = summary(cls, u); }
  // where two carriers meet under an item (within 1 mm in the flat map): the first sample of each such item
  const overlaps = items.filter(it => perU[0][it.id].multi).map(it => ({ id: it.id, cls: it.cls, samples: perU[0][it.id].multi, ...perU[0][it.id].multiAt }));
  const markingKinds = {}; for (const k of [...new Set((itemsByCls.marking || []).map(it => it.kind))]) { markingKinds[k] = {}; for (const u of US) markingKinds[k][u] = summary('marking', u, k); }
  const sl2 = []; for (const it of items.filter(q => GATED.includes(q.cls))) for (const u of US) { const r = perU[u][it.id];
    if (r.noCarrier) sl2.push(`${it.id} u=${u}: ${r.noCarrier} samples with no carrier within ${WIN * 100} cm`);
    if (r.min < -TOL || r.max > TOL) sl2.push(`${it.id} u=${u}: gap ${fmt(r.min)} .. ${fmt(r.max)} mm`);
    if (r.newCover) sl2.push(`${it.id} u=${u}: ${r.newCover} samples under another surface not over them in the flat map (${JSON.stringify(r.newCoverAt)})`); }
  // a per-item table for the markings (the worst state) and the items of every class that fail the 1 mm rule, worst first
  const itemTable = items.filter(it => it.cls === 'marking').map(it => { const w = US.map(u => [u, perU[u][it.id]]).reduce((a, b) => (b[1].min < a[1].min ? b : a));
    return { id: it.id, kind: it.kind, lengthM: +(2 * it.ha).toFixed(2), worstU: w[0], deepestMm: fmt(w[1].min), at: w[1].minAt, buriedShare: +w[1].buriedShare.toFixed(3), longestBuriedM: +w[1].longest.toFixed(2), highestMm: fmt(Math.max(...US.map(u => perU[u][it.id].max))), flatMm: [fmt(perU[0][it.id].min), fmt(perU[0][it.id].max)] }; })
    .sort((a, b) => a.deepestMm - b.deepestMm);

  // ---------------------------------------------------------------- SL3 one carrier face per gated overlay triangle (flat)
  const sl3 = { triangles: 0, straddling: 0, examples: [], unsupported: 0, unsupportedArea: 0 };
  for (const cls of GATED) for (const tr of ovTris[cls] || []) { sl3.triangles++;
    const cx = (tr.v[0][0] + tr.v[1][0] + tr.v[2][0]) / 3, cz = (tr.v[0][2] + tr.v[1][2] + tr.v[2][2]) / 3, cy = (tr.v[0][1] + tr.v[1][1] + tr.v[2][1]) / 3;
    // the carrier face under the centroid (of the overlay's own layer, the nearest in height in the flat map), then all three corners in it; none: a piece without
    // a carrier (it keeps its own vertices), counted apart
    let host = null, hd = Infinity; for (const ct of carrierAt(cx, cz)) { const w = bary(cx, cz, ...ct.v, 1e-9); if (!w) continue; const d = Math.abs(w[0] * ct.v[0][1] + w[1] * ct.v[1][1] + w[2] * ct.v[2][1] - cy); if (d <= LAYER && d < hd) { hd = d; host = ct; } }
    if (!host) { sl3.unsupported++; sl3.unsupportedArea += area2(...tr.v); continue; }
    // inside to 0.1 mm (the float32 positions of a corner on the carrier's edge)
    const inside = p => { const w = bary(p[0], p[2], ...host.v, 1); if (!w) return false; const A = host.v, a2 = Math.abs((A[1][0] - A[0][0]) * (A[2][2] - A[0][2]) - (A[2][0] - A[0][0]) * (A[1][2] - A[0][2]));
      return [0, 1, 2].every(k => { const e = Math.hypot(A[(k + 2) % 3][0] - A[(k + 1) % 3][0], A[(k + 2) % 3][2] - A[(k + 1) % 3][2]); return w[k] * a2 / e >= -1e-4; }); };
    const ok = host && tr.v.every(inside);
    if (!ok) { sl3.straddling++; if (sl3.examples.length < 8) sl3.examples.push({ overlay: tr.d.name, at: [+cx.toFixed(3), +cz.toFixed(3)], host: host ? host.d.name : null }); } }

  // ---------------------------------------------------------------- SL4 pavement: ink outline on the islands, planar UV, the rounded corners
  const sl4 = { ink: {}, uv: { islands: 0, maxErr: 0 }, corners: [] };
  const islands = carriers.filter(c => c.kind === 'island');
  for (const u of US) { let maxGap = 0, n = 0, missing = 0;
    for (const isl of islands) for (const ch of isl.o.children) { if (!ch.isLineSegments) continue; const d = meshData(ch), D = d.disp(u), p = ch.geometry.attributes.position, ix = ch.geometry.index, cnt = ix ? ix.count : p.count;
      for (let k = 0; k + 1 < cnt; k += 2) { const i0 = ix ? ix.getX(k) : k, i1 = ix ? ix.getX(k + 1) : k + 1, a = d.at(d.V, i0), b = d.at(d.V, i1);
        if (Math.abs(a[1] - LV.pavement) > 1e-4 || Math.abs(b[1] - LV.pavement) > 1e-4) continue;    // the top outline (the curb's top edge)
        const A = d.at(D, i0), Bq = d.at(D, i1), len = Math.hypot(b[0] - a[0], b[2] - a[2]), m = Math.max(1, Math.ceil(len / 0.1));
        for (let s = 0; s <= m; s++) { const t = s / m, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, P = [A[0] + (Bq[0] - A[0]) * t, A[1] + (Bq[1] - A[1]) * t, A[2] + (Bq[2] - A[2]) * t];
          const hits = carriersUnder(x, z, P, upAt(x, z, u), u, ct => ct.c !== isl, 1e-6); n++; if (!hits.length) { missing++; continue; } maxGap = Math.max(maxGap, Math.abs(hits.reduce((q, h) => (Math.abs(h.gap) < Math.abs(q.gap) ? h : q)).gap)); } } }
    sl4.ink[u] = { samples: n, missing, maxGapMm: fmt(maxGap) }; }
  for (const isl of islands) { const uv = isl.d.g.attributes.uv; if (!uv) continue; sl4.uv.islands++; const top = isl.d.tris.filter(t => t.every(i => Math.abs(isl.d.V[i * 3 + 1] - LV.pavement) < 1e-5));
    // planar mapping fitted on the first top triangle, checked on every top vertex
    if (!top.length) continue; const [i0, i1, i2] = top[0], P = [i0, i1, i2].map(i => [isl.d.V[i * 3], isl.d.V[i * 3 + 2], uv.getX(i), uv.getY(i)]);
    const det = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
    const fit = c => { const a = ((P[1][c] - P[0][c]) * (P[2][1] - P[0][1]) - (P[2][c] - P[0][c]) * (P[1][1] - P[0][1])) / det, b = ((P[2][c] - P[0][c]) * (P[1][0] - P[0][0]) - (P[1][c] - P[0][c]) * (P[2][0] - P[0][0])) / det; return (x, z) => P[0][c] + a * (x - P[0][0]) + b * (z - P[0][1]); };
    const fu = fit(2), fv = fit(3); for (const t of top) for (const i of t) sl4.uv.maxErr = Math.max(sl4.uv.maxErr, Math.hypot(uv.getX(i) - fu(isl.d.V[i * 3], isl.d.V[i * 3 + 2]), uv.getY(i) - fv(isl.d.V[i * 3], isl.d.V[i * 3 + 2]))); }
  for (const is of L.islands) { const [x0, z0, x1, z1] = is.rect, Rc = L.INTERSECTION.curbRadius;
    for (const [name, cx, cz] of [['NW', x0, z0], ['NE', x1, z0], ['SE', x1, z1], ['SW', x0, z1]]) { if (!is.round[name]) continue;
      const near = items.filter(it => Math.hypot(it.c[0] - cx, it.c[1] - cz) <= 5 + it.ha);
      const rec = { island: is.id, corner: name, at: [cx, cz], radius: Rc, byClass: {} };
      for (const u of US) for (const it of near) { const ss = it.samples.filter(sp => Math.hypot(sp.x - cx, sp.z - cz) <= 5); if (!ss.length) continue; const r = perU[u][it.id];
        const k = `${it.cls}/${it.kind}`, c = rec.byClass[k] = rec.byClass[k] || { items: new Set(), deepestMm: 0, deepestId: null, deepestU: null };
        c.items.add(it.id); if (fmt(r.min) < c.deepestMm) { c.deepestMm = fmt(r.min); c.deepestId = it.id; c.deepestU = u; } }
      for (const c of Object.values(rec.byClass)) c.items = c.items.size;
      sl4.corners.push(rec); } }

  // ---------------------------------------------------------------- SL5 the junction pavings of the network (laid PAVE_LIFT = 1 cm over the trunk): corners and centroid of each triangle
  const junction = {}; for (const u of US) { let min = Infinity, max = -Infinity, n = 0, none = 0, minAt = null;
    for (const tr of ovTris.junction || []) { const D = tr.d.disp(u);
      for (const w of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1 / 3, 1 / 3, 1 / 3]]) { const x = w[0] * tr.v[0][0] + w[1] * tr.v[1][0] + w[2] * tr.v[2][0], z = w[0] * tr.v[0][2] + w[1] * tr.v[1][2] + w[2] * tr.v[2][2], P = [0, 0, 0];
        for (let k = 0; k < 3; k++) { const q = tr.d.at(D, tr.t[k]); P[0] += w[k] * q[0]; P[1] += w[k] * q[1]; P[2] += w[k] * q[2]; }
        const hits = carriersUnder(x, z, P, upAt(x, z, u), u, ct => ct.c.kind === 'junction', 1e-6); n++; if (!hits.length) { none++; continue; } const g = hits[0].gap; if (g < min) { min = g; minAt = [+x.toFixed(2), +z.toFixed(2)]; } max = Math.max(max, g); } }
    junction[u] = { samples: n, noCarrier: none, lowestMm: Number.isFinite(min) ? +(min * 1000).toFixed(3) : null, lowestAt: minAt, highestMm: Number.isFinite(max) ? +(max * 1000).toFixed(3) : null }; }

  // ---------------------------------------------------------------- outside the town: overlay-like meshes over the route strips (lines are vertex colours there)
  const outside = {}; S.scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !visible(o)) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m || !m.polygonOffset) return; if (inTown(o, 0)) return;
    const k = pathName(o).replace(/\d+/g, '#') + ' | ' + m.type + (m.blending === T.AdditiveBlending ? ' additive' : '') + ` offset ${m.polygonOffsetFactor}/${m.polygonOffsetUnits}`; outside[k] = (outside[k] || 0) + 1; });

  // ---------------------------------------------------------------- SLG pixels on the GPU
  let slg = null;
  if (gpu) {
    // the page's own cameras (ride.js CFG: fov 46, near 0.08; the free view: fov 36, near 0.25) on a 1600 x 900 view: the depth offset's slope term is per pixel,
    // so a coarse view would hide more than a screen does
    const R = S.renderer, W = 1600, Hh = 900, rt = new T.WebGLRenderTarget(W, Hh, { depthBuffer: true }), buf = new Uint8Array(W * Hh * 4), cam = new T.PerspectiveCamera(46, W / Hh, 0.08, 400);
    const camOf = v => { const free = /above$/.test(v.id); cam.fov = free ? 36 : 46; cam.near = free ? 0.25 : 0.08; cam.updateProjectionMatrix(); };
    const scene = new T.Scene(); scene.background = new T.Color(0, 0, 0); scene.matrixWorldAutoUpdate = false;
    const proxy = (o, m) => { const q = new T.Mesh(o.geometry, m); q.matrixAutoUpdate = false; q.matrix.copy(o.matrixWorld); q.matrixWorld.copy(o.matrixWorld); q.frustumCulled = false; return q; };
    for (const c of carriers) { const m0 = Array.isArray(c.o.material) ? c.o.material[0] : c.o.material, m = new T.MeshBasicMaterial({ colorWrite: false, side: m0.side, polygonOffset: m0.polygonOffset, polygonOffsetFactor: m0.polygonOffsetFactor, polygonOffsetUnits: m0.polygonOffsetUnits });
      m.userData = { ...m0.userData }; const q = proxy(c.o, m); q.renderOrder = 0; q.userData.carrier = c.kind; scene.add(q); }
    // every item in an id colour (its index + 1 as r + 256 g, b = 1), one triangle soup per overlay mesh with the item of each triangle; the id colours write
    // depth so that one overlay in front of another hides it the same way alone and over the carriers
    const idOf = new Map(); items.forEach((it, k) => idOf.set(it, k + 1));
    for (const ov of overlays.filter(q => itemsByCls[q.cls])) { const g0 = ov.o.geometry.index ? ov.o.geometry.toNonIndexed() : ov.o.geometry.clone(), p = g0.attributes.position, col = new Float32Array(p.count * 3), e = ov.o.matrixWorld.elements;
      for (let t = 0; t + 2 < p.count; t += 3) { let cx = 0, cz = 0; for (let k = 0; k < 3; k++) { const x = p.getX(t + k), y = p.getY(t + k), z = p.getZ(t + k); cx += (e[0] * x + e[4] * y + e[8] * z + e[12]) / 3; cz += (e[2] * x + e[6] * y + e[10] * z + e[14]) / 3; }
        const it = ownerOf(ov.cls, cx, cz), id = it ? idOf.get(it) : 0; for (let k = 0; k < 3; k++) col.set([(id % 256) / 255, Math.floor(id / 256) / 255, 1], (t + k) * 3); }
      g0.setAttribute('color', new T.BufferAttribute(col, 3)); const m0 = ov.o.material, m = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false, depthWrite: true, side: m0.side, polygonOffset: m0.polygonOffset, polygonOffsetFactor: m0.polygonOffsetFactor, polygonOffsetUnits: m0.polygonOffsetUnits });
      m.userData = { ...m0.userData }; const q = proxy(ov.o, m); q.geometry = g0; q.renderOrder = 1; scene.add(q); }
    // per zebra crossing: the rider's eye (1.6 m, 5 m out, as the chase camera of ride.js), a raised look (4 m up, 8 m out) and the free view from above
    // (pitch 0.9, 12 m); along the main street's edge lines: the eye and the view from above. Measured: the items within 9 m of the look point
    const views = [];
    for (const c of L.crosswalks.filter(c => c.kind === 'zebra')) { const r = L.roads.find(q => q.id === c.road), cx = (c.rect[0] + c.rect[2]) / 2, cz = (c.rect[1] + c.rect[3]) / 2, node = L.roadNodes.find(n => n.id === c.node);
      const along = r.axis === 'x' ? [Math.sign(cx - node.x), 0] : [0, Math.sign(cz - node.z)], lane = r.axis === 'x' ? -along[0] : along[1];   // coming in on the left lane
      const off = r.axis === 'x' ? [0, -lane * 1.6] : [lane * 1.6, 0], look = [cx, LV.carriageway, cz];
      views.push({ id: `${c.id} eye`, eye: [cx + along[0] * 5 + off[0], 1.6, cz + along[1] * 5 + off[1]], look });
      views.push({ id: `${c.id} raised`, eye: [cx + along[0] * 8 + off[0], 4, cz + along[1] * 8 + off[1]], look });
      views.push({ id: `${c.id} above`, eye: [cx + along[0] * 12 * Math.cos(0.9), 12 * Math.sin(0.9), cz + along[1] * 12 * Math.cos(0.9)], look }); }
    for (const r of L.roads.filter(r => r.type === 'main')) { const P = [-30, -14].map(v => r.axis === 'x' ? [v, r.at] : [r.at, v]), look = [P[1][0], LV.carriageway, P[1][1]];
      views.push({ id: `${r.id} edge lines eye`, eye: [P[0][0], 1.6, P[0][1]], look });
      views.push({ id: `${r.id} edge lines above`, eye: [P[1][0] - 12 * Math.cos(0.9) * (r.axis === 'x' ? 1 : 0), 12 * Math.sin(0.9), P[1][1] - 12 * Math.cos(0.9) * (r.axis === 'x' ? 0 : 1)], look }); }
    const count = () => { R.setRenderTarget(rt); R.clear(); R.render(scene, cam); R.readRenderTargetPixels(rt, 0, 0, W, Hh, buf); R.setRenderTarget(null); const c = new Map(); for (let i = 0; i < buf.length; i += 4) { if (buf[i + 2] < 200) continue; const id = buf[i] + 256 * buf[i + 1]; if (id) c.set(id, (c.get(id) || 0) + 1); } return c; };
    // each item is tested against its own layer of carriers only: a marking against the street (a raised curb or the planet's curvature may hide a far one,
    // which is no fault of the paint), a paving strip against the street, the islands and the ramps, a plot's flat against the slabs
    const LAYERS = { street: ['road', 'junction'], pavement: ['road', 'junction', 'island', 'ramp'], plot: ['slab'] }, layerOf = cls => (cls === 'plot' ? 'plot' : cls === 'pavement' || cls === 'glow' ? 'pavement' : 'street');
    const gU = [0, 0.5, 1], res = [];
    const keep = { auto: R.autoClear }; R.autoClear = true;
    for (const u of gU) { B.set(u);
      for (const v of views) {
        const E = B.point(v.eye[0], v.eye[1], v.eye[2], u), Lk = B.point(v.look[0], v.look[1], v.look[2], u), up = upAt(v.eye[0], v.eye[2], u);
        camOf(v); cam.position.set(...E); cam.up.set(...up); cam.lookAt(...Lk); cam.updateMatrixWorld(true);
        const pass = layer => { for (const q of scene.children) q.visible = !q.userData.carrier || !!(layer && layer.includes(q.userData.carrier)); return count(); };
        const alone = pass(null), over = {}; for (const [k, l] of Object.entries(LAYERS)) over[k] = pass(l);
        for (const [id, n] of alone) { if (n < 40) continue; const it = items[id - 1]; if (!it || Math.hypot(it.c[0] - v.look[0], it.c[1] - v.look[2]) > 9 + it.ha) continue; const o = over[layerOf(it.cls)];
          res.push({ view: v.id, u, id: it.id, cls: it.cls, kind: it.kind, px: n, shown: +(((o.get(id) || 0) / n)).toFixed(4) }); } } }
    R.autoClear = keep.auto; B.set(0); rt.dispose();
    const gated = res.filter(r => SHOWN.includes(r.cls)), low = gated.filter(r => r.shown < 0.98).sort((a, b) => a.shown - b.shown);
    // the drains: hidden or shown alike in every state, never in part (the shards along the curbs on the sphere)
    const drains = res.filter(r => r.cls === 'drain'), partial = drains.filter(r => r.shown > 0.05 && r.shown < 0.95), shownBy = u => { const l = drains.filter(r => r.u === u); return l.length ? l.reduce((a, r) => a + r.shown, 0) / l.length : null; };
    // by class and state: the mean share shown and the items drawn in part (5-95 %: the broken, shard-like look)
    const byClass = {}; for (const r of res) { const k = `${r.cls}/${r.kind}`, c = byClass[k] = byClass[k] || {}, q = c[r.u] = c[r.u] || { n: 0, mean: 0, partial: 0, hidden: 0 }; q.n++; q.mean += r.shown; if (r.shown > 0.05 && r.shown < 0.95) q.partial++; if (r.shown <= 0.05) q.hidden++; }
    for (const c of Object.values(byClass)) for (const q of Object.values(c)) q.mean = +(q.mean / q.n).toFixed(3);
    slg = { views: views.map(v => ({ id: v.id, eye: v.eye, look: v.look })), states: gU, measured: gated.length, below98: low.length, worst: low.slice(0, 20), byClass, drains: { measured: drains.length, partial: partial.length, examples: partial.slice(0, 5), shown: Object.fromEntries(gU.map(u => [u, shownBy(u)])) }, all: res, byState: Object.fromEntries(gU.map(u => { const l = gated.filter(r => r.u === u); return [u, { items: l.length, minShown: l.length ? Math.min(...l.map(r => r.shown)) : null, below98: l.filter(r => r.shown < 0.98).length }]; })) };
  }
  B.set(0);

  // ---------------------------------------------------------------- a fixed reproduction: the deepest zebra stripe in the sphere
  const zebra = itemTable.filter(q => q.kind === 'zebra'), wz = zebra.length ? zebra[0] : null; let repro = null;
  if (wz) { const it = items.find(q => q.id === wz.id), cw = L.crosswalks.find(c => wz.id.startsWith(c.id + '-')), r = cw && L.roads.find(q => q.id === cw.road), node = cw && L.roadNodes.find(n => n.id === cw.node);
    if (cw && r && node) { const cx = (cw.rect[0] + cw.rect[2]) / 2, cz = (cw.rect[1] + cw.rect[3]) / 2, along = r.axis === 'x' ? [Math.sign(cx - node.x), 0] : [0, Math.sign(cz - node.z)], lane = r.axis === 'x' ? -along[0] : along[1];
      const off = r.axis === 'x' ? [0, -lane * 1.6] : [lane * 1.6, 0], fx = -along[0], fz = -along[1];
      repro = { stripe: wz.id, crosswalk: cw.id, node: node.name || node.id, stripeCentre: [+it.c[0].toFixed(2), +it.c[1].toFixed(2)], deepestMm: wz.deepestMm, worstU: wz.worstU,
        free: { mapMode: 'sphere', target: [+cx.toFixed(2), 0, +cz.toFixed(2)], yaw: +Math.atan2(-fx, -fz).toFixed(4), pitch: 0.35, dist: 9 },
        ride: { mapMode: 'sphere', position: [+(cx + along[0] * 9 + off[0]).toFixed(2), +(cz + along[1] * 9 + off[1]).toFixed(2)], heading: +Math.atan2(fx, fz).toFixed(4), note: 'enter the ride (V) and set position/heading via __scene.view.set({ mode: "roam", position, heading }); ride towards the crosswalk' } }; } }

  return { states: US, counts: { carriers: carriers.length, carrierTriangles: carrierTris.length, overlays: overlays.length, items: items.length, samples: items.reduce((s, it) => s + it.samples.length, 0), markings: (itemsByCls.marking || []).length, overlayTriangles: Object.fromEntries(Object.entries(ovTris).map(([k, l]) => [k, l.length])) },
    sl0, sl1: { problems: sl1, uvErr, areaWorstRel: areaWorst.length ? Math.max(...areaWorst) : null, materials: markMats.length ? markMats[0] : null, decals: [decalMaps, decalCount] },
    classes, markingKinds, junction, overlaps, sl2: { problems: sl2.length, examples: sl2.slice(0, 30) }, itemTable, sl3, sl4, outside, slg, repro,
    drape: (S.town && S.town.drape) || null, gated: GATED };
}

// ---------------------------------------------------------------- run
const US = [0, 0.25, 0.5, 0.75, 1];
let data, pageErrors = [];
const browser = await chromium.launch({ args: soft ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.on('pageerror', e => pageErrors.push(e.message)); page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
  await page.goto(pathToFileURL(html).href + '?quality=high');
  await page.waitForFunction(() => window.__scene && window.__scene.worldgen && window.__scene.worldgen.state.done && window.__scene.worldgen.state.firstFrameAt !== null, null, { timeout: 420000, polling: 200 });
  const t0 = Date.now(); data = await page.evaluate(probe, { US, GATED, SHOWN, gpu }); data.ms = Date.now() - t0;
} finally { await browser.close(); cleanup(); }

const mm = v => (v === null || v === undefined ? '-' : `${v} mm`);
check('SL0', !data.sl0.length && !pageErrors.length, `geometry ${data.sl0.length ? data.sl0.slice(0, 4).join('; ') : 'valid'}; page errors ${pageErrors.length}`);
check('SL1', !data.sl1.problems.length, `${data.counts.markings} markings registered; ${data.sl1.problems.length ? data.sl1.problems.slice(0, 4).join('; ') : 'all drawn, area within 0.5 %, P3 material and UV'} (area worst ${(data.sl1.areaWorstRel * 100).toFixed(3)} %, uv ${data.sl1.uvErr.rect.toExponential(1)} / ${data.sl1.uvErr.decal.toExponential(1)})`);
for (const cls of GATED) for (const u of US) { const s = data.classes[cls] && data.classes[cls][u]; if (!s) continue;
  console.log(`  ${cls} u=${u}: deepest ${mm(s.deepestMm)} (${s.deepestId}), highest ${mm(s.highestMm)}, buried ${(s.buriedShare * 100).toFixed(1)} % of ${s.samples} samples in ${s.itemsBuried}/${s.items} items, longest buried ${s.longestBuriedM} m (${s.longestId}), no carrier ${s.noCarrier}, two carriers ${s.multi}, newly covered ${s.newCover}${u === 0 ? `, under another surface in the flat map ${s.flatCovered}` : ''}`); }
check('SL2', data.sl2.problems === 0, `${data.sl2.problems} item-states off their carrier by more than 1 mm or without one (gated: ${GATED.join(', ')})${data.sl2.problems ? '; e.g. ' + data.sl2.examples.slice(0, 3).join('; ') : ''}`);
check('SL3', data.sl3.straddling === 0, `${data.sl3.straddling} of ${data.sl3.triangles} gated overlay triangles reach over a carrier edge; ${data.sl3.unsupported} without a carrier of their layer (${data.sl3.unsupportedArea.toFixed(4)} m2, kept on their own vertices)`);
const ink = US.map(u => data.sl4.ink[u]), inkMax = Math.max(...ink.map(q => q.maxGapMm)), inkMiss = ink.reduce((s, q) => s + q.missing, 0);
check('SL4', inkMax <= 1 && !inkMiss && data.sl4.uv.maxErr < 1e-4, `island ink on its faces ${inkMax} mm max (${inkMiss} samples off), paving UV planar to ${data.sl4.uv.maxErr.toExponential(1)} on ${data.sl4.uv.islands} islands; ${data.sl4.corners.length} rounded corners reported`);
for (const cls of Object.keys(data.classes).filter(c => !GATED.includes(c))) { const s = data.classes[cls][1], s0 = data.classes[cls][0];
  console.log(`AUDIT SL5 ${cls}: flat ${mm(s0.deepestMm)} .. ${mm(s0.highestMm)}; sphere deepest ${mm(s.deepestMm)} (${s.deepestId}), buried ${(s.buriedShare * 100).toFixed(1)} %, longest ${s.longestBuriedM} m, no carrier ${s.noCarrier}`); }
for (const u of US) { const j = data.junction[u]; if (j && j.samples) console.log(`AUDIT SL5 junction paving u=${u}: ${j.samples} samples, ${mm(j.lowestMm)} .. ${mm(j.highestMm)} over the trunk (intended 10 mm), no carrier ${j.noCarrier}`); }
if (data.slg) { for (const [k, c] of Object.entries(data.slg.byClass)) console.log(`  pixels ${k}: ` + Object.entries(c).map(([u, q]) => `u=${u} ${(q.mean * 100).toFixed(1)} % shown, ${q.partial}/${q.n} in part, ${q.hidden} hidden`).join('; '));
  const dr = data.slg.drains, drShown = Object.values(dr.shown).filter(v => v !== null), drSpread = drShown.length ? Math.max(...drShown) - Math.min(...drShown) : 0;
  check('SLG-drains', dr.partial === 0 && drSpread <= 0.02, `${dr.measured} gutter/channel views: ${dr.partial} drawn in part; shown ${Object.entries(dr.shown).map(([u, v]) => `u=${u} ${v === null ? '-' : (v * 100).toFixed(1) + ' %'}`).join(', ')} (alike in every state)`);
  check('SLG', data.slg.below98 === 0, `${data.slg.measured} item views of ${SHOWN.join(', ')} (${data.slg.views.length} views x u ${data.slg.states.join('/')}): ${data.slg.below98} show < 98 % of their pixels over the carriers${data.slg.below98 ? '; worst ' + data.slg.worst.slice(0, 3).map(r => `${r.id}@${r.view} u=${r.u} ${(r.shown * 100).toFixed(1)} %`).join(', ') : ''}`); }
if (data.repro) console.log(`repro: ${data.repro.stripe} (${data.repro.crosswalk}) ${mm(data.repro.deepestMm)} at u=${data.repro.worstU}; free ${JSON.stringify(data.repro.free)}; ride ${JSON.stringify(data.repro.ride)}`);
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify({ commit, ref, html: arg('--html', null), date: new Date().toISOString(), renderer: soft ? 'swiftshader' : 'metal', failures, pageErrors, ...data }, null, 1));
console.log(`${failures ? 'FAIL' : 'PASS'} ${failures} failed; report ${path.relative(root, reportFile)} (${data.ms} ms)`);
process.exitCode = failures ? 1 : 0;
