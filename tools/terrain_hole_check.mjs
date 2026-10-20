// Terrain holes (docs/world/TERRAIN_HOLE_REPAIR_PLAN.md): the geometry the page draws is valid, and the ground every cut takes away is replaced by a drawn surface.
// Run after `python3 build.py`:
//   node tools/terrain_hole_check.mjs [--ref <git ref>] [--report <path>] [--swiftshader]
// One page; every test at uBend = 0, 0.5 and 1 on the triangles that are actually displayed (world matrix, the seam shift, then the bend as bend.js's vertex
// shader does). The validity rules are this tool's own (not TERRAIN.geometryIssues of the code under test); an invalid mesh is reported and left out of H2/H3.
//   H1 geometry: every mesh, line set and point set of the scene: no attribute under an empty key, every attribute count equal to the position count (per-instance
//      attributes aside), finite positions, every index a whole number in [0, count), a triangle index count a multiple of 3; the page's own terrain gate
//      (terrain.stats.gate: after the occupancy cut and after bend.js subdivide) has no failure; the occupancy cut did add vertices (the path the old write-back
//      broke); the terrain meshes are the same objects and geometries in the three states
//   Surfaces: the displayed opaque triangles (not instanced, not water or other depth-less transparency, not additive, not rain), seen from their visible side; a
//   point's layers are the surfaces over it in the flat map (vertical faces have none).
//   H2-flat cut edges: every open edge of the displayed terrain (an edge of one terrain triangle only; the seam and the +-85 deg map edge aside), every 0.25 m,
//      2 cm (true) outside it: a layer within 5 cm of the edge's height, or a step closed by faces (at 20, 50 and 80 % of its height a face crosses the line from
//      5 cm inside the edge to 30 cm outside it, or the layer's object runs on over (under) the terrain from the edge until it meets it within 6 m: a road's side slope); an open step up to 0.6 m or a gap (no layer, or an open step over 0.6 m) fails. Grouped by the cut that took
//      the ground there (terrain.js roadPolygons by source, the ground occupancy meshes, the RN01-05 tunnel structure)
//   H2 uBend 0.5 / 1: the points joined in the flat map meet a surface on the local vertical (bent as the shader bends) from 0.5 m over to 0.6 m under the joint;
//      a miss whose neighbours 2 cm away (two of four) meet one is a crack under about 4 cm (the 2.2 cm chord of a 4 m edge, W10f): counted, not failed; where the
//      bend squeezes the vertical to under a quarter (uBend 0.5 near the town's antipode) the point is counted as degenerate and not tested
//   H3 areas: a layer over every point in the flat map, and bent a hit between 0.5 m over its top layer and 0.6 m under its lowest along the local vertical (the far
//      side of the sphere does not count): CR01 +-14 m round the whole ring every 0.25 m x 0.25 m, the square |x|, |z| <= 110 outside the town (|x|, |z| >= 47.5)
//      every 0.5 m (flat units), each landmark's anchor +-(radius + 8 m) every 0.25 m (true)
// Report: docs/world/w10c/terrain-hole/report.json (not tracked); --ref builds that git ref in a temporary worktree and writes report-<ref>.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const ref = arg('--ref', null), soft = args.includes('--swiftshader');
const outDir = path.join(root, 'docs/world/w10c/terrain-hole'), reportFile = path.resolve(root, arg('--report', path.join(outDir, ref ? `report-${ref.replace(/[^\w.-]+/g, '_')}.json` : 'report.json')));
let failures = 0;
const check = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures++; };

let html = path.join(root, 'index.html'), cleanup = () => {}, commit;
if (ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'thc-'));
  execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['build.py'], { cwd: dir, stdio: 'pipe' });
  html = path.join(dir, 'index.html'); commit = execFileSync('git', ['rev-parse', ref], { cwd: root, encoding: 'utf8' }).trim();
  cleanup = () => { try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'pipe' }); } catch { fs.rmSync(dir, { recursive: true, force: true }); } };
} else commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

// ---------------------------------------------------------------- the page part
async function probe({ modes }) {
  const S = window.__scene, T = window.THREE, B = S.bend, W = window.WORLD, D = S.roads.data(), TS = S.terrain, R = 90, BASE = 1.6, DEG = Math.PI / 180;
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const ch = z => Math.cosh(z / R), lonOf = x => ((x / (R * DEG) + 540) % 360) - 180, latOf = z => Math.atan(Math.sinh(-z / R)) / DEG, ZMAX = R * Math.asinh(Math.tan(85 * DEG));
  const sampler = TS.sampler(), latticeY = (x, z) => (sampler(lonOf(x), latOf(z)) - BASE) * ch(z);
  const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const pathName = o => { const n = []; for (let p = o; p && p !== S.scene; p = p.parent) if (p.name) n.push(p.name); return n.join(' < ') || o.type; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const rayHit = (o, d, A, C, E) => { const e1 = sub(C, A), e2 = sub(E, A), p = cross(d, e2), det = dot(e1, p); if (Math.abs(det) < 1e-13) return null; const inv = 1 / det, s = sub(o, A), u = dot(s, p) * inv; if (u < -1e-7 || u > 1 + 1e-7) return null; const q = cross(s, e1), v = dot(d, q) * inv; if (v < -1e-7 || u + v > 1 + 1e-7) return null; const t = dot(e2, q) * inv; return t > 0 ? { t, n: cross(e1, e2) } : null; };
  const terrainMeshes = new Set([...TS.ring, ...TS.rest, ...TS.caps]);

  // ---- H1: this tool's own validity rules
  const issues = (g, tri) => {
    const out = [], pos = g.attributes.position;
    for (const [k, a] of Object.entries(g.attributes)) { if (!k) out.push('empty attribute key'); else if (a.count !== pos.count && !a.isInstancedBufferAttribute) out.push(`${k} count ${a.count} != ${pos.count}`); }     // per-instance attributes count instances
    let bad = 0; for (let i = 0; i < pos.count; i++) if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) bad++;
    if (bad) out.push(`${bad} non-finite positions`);
    if (g.index) { const ix = g.index; let wrong = 0, max = -1; for (let i = 0; i < ix.count; i++) { const v = ix.getX(i); if (!(Number.isInteger(v) && v >= 0 && v < pos.count)) wrong++; if (v > max) max = v; }
      if (wrong) out.push(`${wrong} indices outside [0, ${pos.count}) (max ${max})`); if (tri && ix.count % 3) out.push(`index count ${ix.count} % 3`); }
    return out;
  };
  const signature = () => [...terrainMeshes].map(m => [m.uuid, m.geometry.uuid, m.geometry.index ? m.geometry.index.count : 0, m.geometry.attributes.position.count].join(':')).join('|');
  const out = { modes: {}, gate: TS.stats.gate || null, occupancyCut: TS.stats.occupancyCut || null, signatures: [] };
  const invalid = new Set();

  // ---- the cut sources: terrain.js road polygons (by source), the ground occupancy (upward faces of the marked meshes), the tunnel structure
  const P = B.PERIOD, CELL = 2, ck = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const srcCells = new Map(), srcList = [], addSrc = (p, label) => { const id = srcList.length; srcList.push({ p, label }); const xs = p.map(q => q[0]), zs = p.map(q => q[1]);
    for (let a = Math.floor(Math.min(...xs) / CELL); a <= Math.floor(Math.max(...xs) / CELL); a++) for (let b = Math.floor(Math.min(...zs) / CELL); b <= Math.floor(Math.max(...zs) / CELL); b++) { const k = `${a},${b}`; let l = srcCells.get(k); if (!l) srcCells.set(k, l = []); l.push(id); } };
  for (const q of TS.roadPolygons || []) addSrc(q.p.map(v => [B.wrapX(v[0]), v[1]]), `road ${q.src.kind}${q.src.structure ? '/' + q.src.structure : ''} ${q.src.id}`);
  S.scene.updateMatrixWorld(true);
  const occupancy = [];
  S.scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !o.userData.groundOccupancy || !o.geometry?.attributes?.position) return; occupancy.push(o); const g = o.geometry, p = g.attributes.position, ix = g.index, e = o.matrixWorld.elements, n = ix ? ix.count : p.count, label = `ground ${pathName(o).split(' < ').slice(-2).join(' < ')}`;
    for (let t = 0; t + 2 < n; t += 3) { const v = [0, 1, 2].map(k => { const i = ix ? ix.getX(t + k) : t + k, x = p.getX(i), y = p.getY(i), z = p.getZ(i); return [B.wrapX(e[0] * x + e[4] * y + e[8] * z + e[12]), e[2] * x + e[6] * y + e[10] * z + e[14]]; });
      if (v.some(q => !Number.isFinite(q[0]) || !Number.isFinite(q[1]))) continue; const ny = (v[1][1] - v[0][1]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][1] - v[0][1]); if (ny > 1e-10) addSrc(v, label); } });
  const tunnelRt = D.routes.find(r => r.tunnel), tn = tunnelRt && tunnelRt.tunnel;
  const inTunnel = (x, z) => { if (!tn) return false; for (let i = tn.idx[0]; i <= tn.idx[tn.idx.length - 1]; i++) { const f = tunnelRt.flatOf[i], tg = tunnelRt.tangent[i], sc = tunnelRt.cf[i] * f.k, dx = x - B.wrapX(f.x), dz = z - f.z;
    if (Math.abs(dx * tg[0] + dz * tg[1]) <= 0.6 * sc && Math.abs(-dx * tg[1] + dz * tg[0]) <= (tn.innerR + tn.shell + 1) * sc) return true; } return false; };
  const sourceAt = (x, z) => { const l = []; for (const id of srcCells.get(ck(x, z)) || []) if (inPoly(x, z, srcList[id].p)) l.push(srcList[id].label); if (inTunnel(x, z)) l.push('tunnel structure'); return [...new Set(l)].join(' + ') || 'none'; };

  // ---- H2 samples: the open edges of the displayed terrain
  const edgeUse = new Map(), q4 = v => `${Math.round(v[0] * 1e4)},${Math.round(v[2] * 1e4)}`, terrTris = [];
  for (const m of terrainMeshes) {
    const g = m.geometry; if (TS.caps.includes(m) || !visible(m)) continue;     // the caps (sphere frame, noBend) close the poles beyond the map edge
    if (issues(g, true).length) continue;
    const pos = g.attributes.position, ix = g.index, n = ix ? ix.count : pos.count;
    for (let t = 0; t + 2 < n; t += 3) {
      const v = [0, 1, 2].map(k => { const i = ix ? ix.getX(t + k) : t + k; return [B.wrapX(pos.getX(i)), pos.getY(i), pos.getZ(i)]; }), id = terrTris.length; terrTris.push(v);
      for (let k = 0; k < 3; k++) { const a = q4(v[k]), b = q4(v[(k + 1) % 3]); if (a === b) continue; const key = a < b ? a + '|' + b : b + '|' + a; const u = edgeUse.get(key); if (u) u.n++; else edgeUse.set(key, { n: 1, tri: id, k }); }
    }
  }
  const seamA = B.SEAM, seamB = B.SEAM + P, onMapEdge = (a, b) => (Math.abs(a[0] - seamA) < 0.01 && Math.abs(b[0] - seamA) < 0.01) || (Math.abs(a[0] - seamB) < 0.01 && Math.abs(b[0] - seamB) < 0.01) || (Math.abs(a[2]) > ZMAX - 0.05 && Math.abs(b[2]) > ZMAX - 0.05);
  const edgeSamples = []; let openEdges = 0, mapEdges = 0, edgeLength = 0;
  for (const e of edgeUse.values()) {
    if (e.n !== 1) continue; const v = terrTris[e.tri], a = v[e.k], b = v[(e.k + 1) % 3], c = v[(e.k + 2) % 3];
    if (onMapEdge(a, b)) { mapEdges++; continue; } openEdges++;
    const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz), k = ch((a[2] + b[2]) / 2); edgeLength += len / k;
    let nx = dz / len, nz = -dx / len; if (nx * (c[0] - a[0]) + nz * (c[2] - a[2]) > 0) { nx = -nx; nz = -nz; }     // away from the triangle
    const steps = Math.max(1, Math.ceil(len / k / 0.25));
    for (let s = 0; s < steps; s++) { const f = (s + 0.5) / steps, ex = a[0] + dx * f, ez = a[2] + dz * f, y = a[1] + (b[1] - a[1]) * f; edgeSamples.push({ x: B.wrapX(ex + nx * 0.02 * k), y, z: ez + nz * 0.02 * k, ex, ez, nx, nz, k, len: len / k / steps }); }
  }
  out.edges = { open: openEdges, mapEdges, lengthM: +edgeLength.toFixed(1), samples: edgeSamples.length, terrainTriangles: terrTris.length };

  // ---- H3 points
  const areaPts = [], addArea = (region, x, z, cell) => { if (Math.abs(z) > ZMAX - 1) return; areaPts.push({ region, x: B.wrapX(x), z, y: latticeY(B.wrapX(x), z), k: ch(z), cell }); };   // cell: the point's share in flat m^2
  const cr = D.routes.find(r => r.def.id === 'CR01');
  if (cr) for (let i = 0; i + 1 < cr.samples.length; i++) for (const f of [0, 0.5]) { const a = cr.flatOf[i], b = cr.flatOf[i + 1], tg = cr.tangent[i], sc = cr.cf[i] * a.k, x0 = a.x + (b.x - a.x) * f, z0 = a.z + (b.z - a.z) * f;
    for (let o = -14; o <= 14 + 1e-9; o += 0.25) addArea('CR01 +-14 m', x0 - tg[1] * o * sc, z0 + tg[0] * o * sc, 0.0625 * sc * sc); }
  for (let x = -110; x <= 110; x += 0.5) for (let z = -110; z <= 110; z += 0.5) if (Math.abs(x) >= 47.5 || Math.abs(z) >= 47.5) addArea('square 110 m', x + 0.125, z + 0.125, 0.25);
  // each landmark (world.js anchor and radius) +8 m, every 0.25 m true
  const lmBoxes = {};
  for (const lm of W.landmarks) { if (!/^LM/.test(lm.id)) continue; const cx = R * lm.lon * DEG, cz = -R * Math.asinh(Math.tan(lm.lat * DEG)), k = ch(cz), h = (lm.radius + 8) * k, st = 0.25 * k;
    lmBoxes[lm.id] = [cx - h, cz - h, cx + h, cz + h].map(v => +v.toFixed(2));
    for (let x = cx - h; x <= cx + h; x += st) for (let z = cz - h; z <= cz + h; z += st) addArea(`${lm.id} +-${lm.radius + 8} m`, x, z, st * st); }
  out.areas = { points: areaPts.length, landmarkBoxes: lmBoxes, regions: [...new Set(areaPts.map(p => p.region))] };

  // ---- the displayed opaque triangles in the cells of interest (flat frame; bent per state)
  const CK = (x, z) => `${Math.floor(x)},${Math.floor(z)}`, interest = new Set();
  for (const s of edgeSamples) interest.add(CK(s.x, s.z)); for (const p of areaPts) interest.add(CK(p.x, p.z));
  // flat layers (uBend 0): every displayed opaque triangle that is seen from above over (x, z), by height; vertical faces have no layer
  const layersAt = (cells, x, z) => { const l = []; for (const tri of cells.get(CK(x, z)) || []) { if (!tri.up) continue; const [a, b, c] = tri.v, den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-12) continue;
    const w0 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, w1 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den, w2 = 1 - w0 - w1; if (w0 < -1e-7 || w1 < -1e-7 || w2 < -1e-7) continue;
    l.push({ y: w0 * a[1] + w1 * b[1] + w2 * c[1], tri }); } return l; };
  const TUCK = [0.05, 0.15, 0.3, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
  for (const s of edgeSamples) for (const d of [...TUCK.map(t => -t), 0.3]) interest.add(CK(s.ex + s.nx * d * s.k, s.ez + s.nz * d * s.k));
  const h2flat = { samples: edgeSamples.length, ok: 0, closed: 0, step: 0, gap: 0, hist: { '<=1cm': 0, '<=3cm': 0, '<=5cm': 0, '<=10cm': 0, '<=30cm': 0, '<=60cm': 0, '>60cm': 0, none: 0 }, bySource: {} };
  for (const u of modes) {
    B.set(u); await frame(); await frame(); S.scene.updateMatrixWorld(true);
    out.signatures.push(signature());
    // H1 on everything drawn
    const h1 = { checked: 0, bad: [] };
    S.scene.traverse(o => { if (!(o.isMesh || o.isLineSegments || o.isLine || o.isPoints) || !o.geometry?.attributes?.position) return; h1.checked++; const why = issues(o.geometry, o.isMesh);
      if (why.length) { invalid.add(o); if (h1.bad.length < 40) h1.bad.push(`${pathName(o)}${terrainMeshes.has(o) ? ' [terrain]' : ''}: ${why.join(', ')}`); else h1.more = (h1.more || 0) + 1; } });
    const cells = new Map(), I = new T.Matrix4(), wv = new T.Vector3(); let triangles = 0;
    const bend = p => (u ? B.point(p[0], p[1], p[2], u) : p);
    S.scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || invalid.has(o) || !o.geometry?.attributes?.position || !visible(o)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some(m => m && m.userData && (m.userData.noBend || m.userData.noWrap))) return;
      if (mats.every(m => !m || (m.transparent && (m.depthWrite === false || m.opacity <= 0)) || m.blending === T.AdditiveBlending || m.colorWrite === false || m.visible === false)) return;
      const side = mats.some(m => m && m.side === T.DoubleSide) ? 2 : mats.every(m => !m || m.side === T.BackSide) ? 1 : 0;
      const g = o.geometry, pos = g.attributes.position, ix = g.index, count = ix ? ix.count : pos.count, moved = !o.matrixWorld.equals(I), name = pathName(o), terr = terrainMeshes.has(o);
      for (let t = 0; t + 2 < count; t += 3) {
        const v = [0, 1, 2].map(k => { const n = ix ? ix.getX(t + k) : t + k; if (moved) { wv.set(pos.getX(n), pos.getY(n), pos.getZ(n)).applyMatrix4(o.matrixWorld); return [B.wrapX(wv.x), wv.y, wv.z]; } return [B.wrapX(pos.getX(n)), pos.getY(n), pos.getZ(n)]; });
        // the box 5 cm wider: a point on a cell's edge also gets the triangles of the next cell, which the bent vertical may meet instead
        const x0 = Math.floor(Math.min(v[0][0], v[1][0], v[2][0]) - 0.05), x1 = Math.floor(Math.max(v[0][0], v[1][0], v[2][0]) + 0.05), z0 = Math.floor(Math.min(v[0][2], v[1][2], v[2][2]) - 0.05), z1 = Math.floor(Math.max(v[0][2], v[1][2], v[2][2]) + 0.05);
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 2500) continue;
        let tri = null;
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = `${x},${z}`; if (!interest.has(k)) continue;
          if (!tri) { const ny = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]); tri = { v, b: u ? v.map(bend) : v, side, up: side === 2 || (side === 0 ? ny > 1e-12 : ny < -1e-12), name, terr, o }; }
          let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(tri); triangles++; }
      }
    });
    // any hit on the segment A -> Z (its visible side) in the cells of the listed points
    const meets = (A, Z, pts, twoSided) => { const d = sub(Z, A), L = Math.hypot(...d), dir = d.map(c => c / L), seen = new Set();
      for (const p of pts) for (const tri of cells.get(CK(p[0], p[1])) || []) { if (seen.has(tri)) continue; seen.add(tri); const h = rayHit(A, dir, ...tri.b); if (!h || h.t > L) continue; const facing = dot(h.n, dir); if (!twoSided && (tri.side === 0 && facing > 0 || tri.side === 1 && facing < 0)) continue; return { t: h.t, name: tri.name }; }
      return null; };
    const scale = k => k * (1 - u) + u;     // flat units per true metre along the vertical (flat y is (alt - 1.6) cosh(z / R); the sphere is true metres)
    // the bent local vertical at (x, z) from 0.5 m over top to 0.6 m under bot meets a surface; else 'narrow' when two of the four points 2 cm (true) away do (a crack under
    // about 4 cm across: the chord of a 4 m edge sags 2.2 cm at R = 90, the W10f town rule), else false
    // Where the bend squeezes the vertical (uBend 0.5 near the town's antipode, lon 180 at the equator, the flat up and the sphere's up are opposite) the segment is
    // shorter than a quarter of its flat length: 'degenerate', counted apart and not tested
    const vertical = (x, z, top, bot, k) => { const sc = scale(k), seg = (a, b) => meets(bend([a, top + 0.5 * sc, b]), bend([a, bot - 0.6 * sc, b]), [[a, b]], false);
      { const A = bend([x, top + 0.5 * sc, z]), Z = bend([x, bot - 0.6 * sc, z]), Lf = top - bot + 1.1 * sc; if (Math.hypot(...sub(Z, A)) < 0.25 * Math.min(Lf, Lf / k)) return 'degenerate'; }     // flat units in the map, true metres on the sphere
      if (seg(x, z)) return true; const w = 0.02 * k; return [[x + w, z], [x - w, z], [x, z + w], [x, z - w]].filter(([a, b]) => seg(a, b)).length >= 2 ? 'narrow' : false; };
    const tally = (h, group, kind, s, extra) => { const g = h.bySource[group] || (h.bySource[group] = { gap: 0, step: 0, lengthM: 0, at: [] }); g[kind]++; g.lengthM += s.len; if (g.at.length < 6) g.at.push(`(${s.x.toFixed(2)}, ${s.z.toFixed(2)}) ${extra}`); };
    // H2: in the flat map the replacing layer and, for a step, its closing faces; bent, the same layers along the local vertical
    if (u === 0) {
      for (const s of edgeSamples) {
        const L = layersAt(cells, s.x, s.z); let best = null; for (const q of L) if (!best || Math.abs(q.y - s.y) < Math.abs(best.y - s.y)) best = q;
        const dy = best ? (best.y - s.y) / s.k : null, a = best ? Math.abs(dy) : Infinity; s.layer = best ? best.y : null;
        h2flat.hist[!best ? 'none' : a <= 0.01 ? '<=1cm' : a <= 0.03 ? '<=3cm' : a <= 0.05 ? '<=5cm' : a <= 0.1 ? '<=10cm' : a <= 0.3 ? '<=30cm' : a <= 0.6 ? '<=60cm' : '>60cm']++;
        if (a <= 0.05) { h2flat.ok++; s.state = 'ok'; continue; }
        // the step between the terrain edge and the layer: closed when at 20, 50 and 80 % of its height a face crosses the line from 5 cm inside the edge to 30 cm outside it
        let closed = !!best && a <= 5;
        for (const f of [0.2, 0.5, 0.8]) { if (!closed) break; const y = s.y + (best.y - s.y) * f, P0 = [s.ex - s.nx * 0.05 * s.k, y, s.ez - s.nz * 0.05 * s.k], P1 = [s.ex + s.nx * 0.3 * s.k, y, s.ez + s.nz * 0.3 * s.k];
          if (!meets(P0, P1, [[P0[0], P0[2]], [s.ex, s.ez], [s.x, s.z], [P1[0], P1[2]]], true)) closed = false; }
        // a layer over the edge that runs on over the terrain and into it (a road's side slope over the cut edge) hides the step: going in from the edge (true
        // 5 cm ... 6 m), the same object stays over the terrain until it comes within 5 cm of it or under it
        // (a layer under the edge that runs on under the terrain and comes up through it closes the pocket the same way: what shows in it is that layer's top)
        if (!closed && best) for (const d of TUCK) {
          const x = s.ex - s.nx * d * s.k, z = s.ez - s.nz * d * s.k, Lq = layersAt(cells, x, z), ground = Lq.filter(q => q.tri.terr), same = Lq.filter(q => q.tri.o === best.tri.o);
          if (!ground.length || !same.length) break; const yt = Math.max(...ground.map(q => q.y)), yr = dy > 0 ? Math.min(...same.map(q => q.y)) : Math.max(...same.map(q => q.y));
          if (dy > 0 ? yr <= yt + 0.05 * s.k : yr >= yt - 0.05 * s.k) { closed = 'tucked'; break; }
        }
        const src = sourceAt(s.x, s.z), what = best ? `dy ${dy.toFixed(3)} m ${best.tri.name}` : `no layer; near ${[...new Set((cells.get(CK(s.x, s.z)) || []).map(q => q.name))].slice(0, 4).join(' | ')}`;
        if (closed) { h2flat.closed++; if (closed === 'tucked') h2flat.tucked = (h2flat.tucked || 0) + 1; s.state = 'closed'; continue; }
        if (best && a <= 0.6) { h2flat.step++; s.state = 'step'; tally(h2flat, src, 'step', s, what); } else { h2flat.gap++; s.state = 'gap'; tally(h2flat, src, 'gap', s, what); }
      }
      for (const g of Object.values(h2flat.bySource)) g.lengthM = +g.lengthM.toFixed(2);
    }
    const h2 = { tested: 0, broken: 0, bySource: {}, triangles };
    if (u) for (const s of edgeSamples) {
      if (s.state !== 'ok' && s.state !== 'closed') continue; h2.tested++; const hit = vertical(s.x, s.z, Math.max(s.y, s.layer), Math.min(s.y, s.layer), s.k);
      if (hit === 'narrow') h2.narrow = (h2.narrow || 0) + 1; if (hit === 'degenerate') h2.degenerate = (h2.degenerate || 0) + 1; if (hit) continue;
      h2.broken++; tally(h2, sourceAt(s.x, s.z), 'gap', s, `layer ${((s.layer - s.y) / s.k).toFixed(3)} m not met`);
    }
    // H3: in the flat map some layer over the point; bent, a hit between 0.5 m over its top layer and 0.6 m under its lowest along the local vertical
    const h3 = { points: areaPts.length, gap: 0, byRegion: {} };
    for (const p of areaPts) {
      const reg = h3.byRegion[p.region] || (h3.byRegion[p.region] = { points: 0, gap: 0, areaM2: 0, at: [], sources: {} }); reg.points++;
      if (u === 0) { const L = layersAt(cells, p.x, p.z); p.top = L.length ? Math.max(...L.map(q => q.y)) : null; p.bot = L.length ? Math.min(...L.map(q => q.y)) : null; if (L.length) continue; }
      else { if (p.top === null) continue; const hit = vertical(p.x, p.z, p.top, p.bot, p.k); if (hit === 'narrow') reg.narrow = (reg.narrow || 0) + 1; if (hit === 'degenerate') reg.degenerate = (reg.degenerate || 0) + 1; if (hit) continue; }
      h3.gap++; reg.gap++; reg.areaM2 += p.cell / (p.k * p.k);
      const src = sourceAt(p.x, p.z); reg.sources[src] = (reg.sources[src] || 0) + 1; if (reg.at.length < 8) reg.at.push(`(${p.x.toFixed(2)}, ${p.z.toFixed(2)}) ${src}${u ? '' : `; near ${[...new Set((cells.get(CK(p.x, p.z)) || []).map(q => q.name))].slice(0, 3).join(' | ')}`}`);
    }
    for (const g of Object.values(h3.byRegion)) g.areaM2 = +g.areaM2.toFixed(2);
    out.modes[u] = { h1, h2, h3 };
  }
  out.h2flat = h2flat;
  B.set(0); await frame();
  out.invalidMeshes = invalid.size;
  return out;
}

// ---------------------------------------------------------------- run
const modes = [0, 0.5, 1];
let data, pageErrors = [];
const browser = await chromium.launch({ args: soft ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  page.on('pageerror', e => pageErrors.push(e.message)); page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });
  await page.goto(pathToFileURL(html).href + '?quality=high');
  await page.waitForFunction(() => window.__scene && window.__scene.worldgen && window.__scene.worldgen.state.done && window.__scene.worldgen.state.firstFrameAt !== null, null, { timeout: 180000, polling: 200 });
  data = await page.evaluate(probe, { modes });
} finally { await browser.close(); cleanup(); }

const M = data.modes, f = n => n.toLocaleString('en-US');
const gate = data.gate, gateOK = !!gate && ['occupancy cut', 'subdivide'].every(k => gate[k] && gate[k].bad === 0), added = data.occupancyCut && data.occupancyCut.addedVertices;
check('H1-scene', modes.every(u => M[u].h1.bad.length === 0), modes.map(u => `uBend ${u}：${f(M[u].h1.checked)} 个网格/线/点，非法 ${M[u].h1.bad.length + (M[u].h1.more || 0)}`).join('；') + (M[0].h1.bad.length ? `；例：${M[0].h1.bad.slice(0, 6).join('；')}` : ''));
check('H1-gate', gateOK && added > 0, gate ? `页面地形闸门 ${Object.entries(gate).map(([k, g]) => `${k} ${g.bad}/${g.meshes} 网格（${g.ms} ms）`).join('、')}；占地裁切新增顶点 ${added}` : `页面没有地形闸门（terrain.stats.gate）；占地裁切新增顶点 ${added ?? '未记录'}`);
check('H1-modes', new Set(data.signatures).size === 1, `地形网格在 uBend 0 / 0.5 / 1 下为同一对象与几何：${new Set(data.signatures).size === 1 ? '是' : '否'}`);
const e = data.edges;
{ const h = data.h2flat, top = Object.entries(h.bySource).sort((a, b) => b[1].gap + b[1].step - a[1].gap - a[1].step).slice(0, 10);
  check('H2-flat', h.gap === 0 && h.step === 0, `地形开放边 ${f(e.open)} 条（地图边缘 ${f(e.mapEdges)} 条不计）、${f(e.lengthM)} m，${f(h.samples)} 个外侧 2 cm 点：5 cm 内有接替表面 ${f(h.ok)}、台阶有竖面封住或被接替面盖过并扎入地形 ${f(h.closed)}（其中盖过 ${f(h.tucked || 0)}）、未封台阶 ≤ 60 cm ${f(h.step)}、缺口 ${f(h.gap)}；最近表面高差分布 ${JSON.stringify(h.hist)}${top.length ? `；按来源：${top.map(([k, g]) => `${k}：缺口 ${g.gap}、台阶 ${g.step}（${g.lengthM} m）例 ${g.at.slice(0, 2).join('；')}`).join(' ‖ ')}` : ''}`); }
for (const u of modes.filter(u => u)) {
  const h = M[u].h2, top = Object.entries(h.bySource).sort((a, b) => b[1].gap - a[1].gap).slice(0, 6);
  check(`H2 uBend ${u}`, h.broken === 0, `平面已接上的 ${f(h.tested)} 个边外点，沿弯曲后的当地竖直线断开 ${f(h.broken)}（< 4 cm 细分弦差 ${f(h.narrow || 0)} 不计；弯曲压扁竖直线、不测 ${f(h.degenerate || 0)}）${top.length ? `：${top.map(([k, g]) => `${k} ${g.gap}（${g.lengthM} m）例 ${g.at.slice(0, 2).join('；')}`).join(' ‖ ')}` : ''}`);
}
for (const u of modes) {
  const h = M[u].h3;
  check(`H3 uBend ${u}`, h.gap === 0, `区域扫描 ${f(h.points)} 点，缺口 ${f(h.gap)}：${Object.entries(h.byRegion).map(([k, g]) => `${k} ${f(g.points)} 点缺 ${g.gap}${g.narrow ? `（< 4 cm 弦差 ${g.narrow} 不计）` : ''}${g.degenerate ? `（竖直线被压扁不测 ${g.degenerate}）` : ''}${g.gap ? `（约 ${g.areaM2} m²；来源 ${JSON.stringify(g.sources)}；例 ${g.at.slice(0, 3).join('；')}）` : ''}`).join('、')}`);
}
check('H-errors', !pageErrors.length, pageErrors.slice(0, 4).join('；') || '无页面错误');
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify({ commit, ref, date: new Date().toISOString(), renderer: soft ? 'swiftshader' : 'metal', failures, pageErrors, ...data, signatures: undefined }, null, 1));
console.log(`报告 ${path.relative(root, reportFile)}；${failures ? `${failures} 项未通过` : '全部通过'}`);
process.exit(failures ? 1 : 0);
