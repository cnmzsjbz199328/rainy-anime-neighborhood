// W10c town-exit connectors against the ground cut (docs/world/CONNECTOR_TERRAIN_HOLE_FIX_PLAN.md section 6). Run after `python3 build.py`:
//   node tools/connector_ground_check.mjs [--ref <git ref>] [--baseline <report.json>] [--report <path>] [--swiftshader]
// The nine exits come from world.js (an edge between a town node on the +-LAYOUT.BASE.half boundary and a C01-* node); everything expected is computed
// here from that data, the uncut terrain lattice (the chunks' own positions and indices, before any cut) and the meshes that are actually displayed, not from
// the cut code under test. Every probe is a ray against the displayed triangles, taken into the display frame as the vertex shader of bend.js takes them
// (world matrix, seam shift, bend), at uBend 0, 0.5 and 1, along the local normal (the same construction as tools/terrain_structure_check.mjs).
// A probe is "road" where the plan projection of a displayed road surface (road:route *, road:junction paving, road:bridge * top) covers it at uBend 0,
// otherwise "ground". Opaque = not (transparent and no depth write / zero opacity), not additive, colour written: sea, light pools and ripples never close
// a hole. Instanced meshes (plants, furniture) are left out, so a tree crown never stands in for the ground.
//   CG1 the 18 points of the plan (section 3: each exit 1.5 m outward, the carriageway half + 1 m to each side): ground points hit the near-side terrain at
//       the uncut lattice height, road points hit the road first; with --baseline the transitions from the baseline report are listed
//   CG2 full coverage: each exit from the town edge to 54.875 m outward (the ring centre line + 0.875 m), 0.125-7.875 m to both sides on a 0.25 m grid, plus 0.01/0.03/0.06 m past the
//       town edge and 0.01/0.03/0.06/0.12/0.20 m either side of the connector mesh's own side edge (found here by bisection on the displayed mesh):
//       every ground probe has the uncut terrain (terrain meshes alone, within the chord tolerance) and, in the whole scene, the terrain or an overlay within
//       0.3 m above it as its first opaque surface (no hole, no far-side hit; the cell lists hold only triangles near the probe in the flat frame)
//   CG3 roads stay on top: every road probe's first opaque surface is a road (a terrain/overlay hit within 1 mm of the road counts as the road: the road
//       materials carry a polygon offset); at the side edge, the terrain 0.01 m outside stands no more than 0.02 m above the road 0.01 m inside
//   CG4 bend states: CG1-CG3 at uBend 0, 0.5 and 1; the terrain is the same objects and geometry in all three (no sphere-only patch or swap)
//   CG5 cut sources: for each ground probe, the ground cut polygons (terrain.js roadPolygons, shared by cutGroundMeshes) that contain it, with their source;
//       a ground probe inside a cut polygon fails; every polygon has a source
//   CG6 one display, frozen data: the meshes near the probes are the same in the three states; page errors 0; with --baseline the road geometry hash and
//       the hashes of layout.js, world.js, bend.js equal the baseline's
// Report: docs/world/w10c/connector-ground-review/report.json (not tracked); --ref builds that git ref in a temporary worktree and writes report-<ref>.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const ref = arg('--ref', null), soft = args.includes('--swiftshader'), baselineFile = arg('--baseline', null);
const outDir = path.join(root, 'docs/world/w10c/connector-ground-review'), reportFile = path.resolve(root, arg('--report', path.join(outDir, ref ? `report-${ref.replace(/[^\w.-]+/g, '_')}.json` : 'report.json')));
let failures = 0;
const check = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures++; };

let srcDir = root, cleanup = () => {}, commit;
if (ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cgc-'));
  execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['build.py'], { cwd: dir, stdio: 'pipe' });
  srcDir = dir; commit = execFileSync('git', ['rev-parse', ref], { cwd: root, encoding: 'utf8' }).trim();
  cleanup = () => { try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'pipe' }); } catch { fs.rmSync(dir, { recursive: true, force: true }); } };
} else commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const html = path.join(srcDir, 'index.html'), md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const files = Object.fromEntries(['index.html', 'layout.js', 'world.js', 'bend.js'].map(f => [f, md5(path.join(srcDir, f))]));

// ---------------------------------------------------------------- the page part
async function probe({ modes }) {
  const S = window.__scene, T = window.THREE, B = S.bend, W = window.WORLD, L = window.LAYOUT, NET = W.roadNetwork, D = S.roads.data(), TS = S.terrain;
  const R = 90, BASE = 1.6, P = B.PERIOD, PI_R = Math.PI * R;
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const key = (x, z) => `${Math.floor(x)},${Math.floor(z)}`, ch = z => Math.cosh(z / R), altOf = (y, z) => y / ch(z) + BASE;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const rayHit = (o, d, A, C, E) => { const e1 = sub(C, A), e2 = sub(E, A), p = cross(d, e2), det = dot(e1, p); if (Math.abs(det) < 1e-13) return null; const inv = 1 / det, s = sub(o, A), u = dot(s, p) * inv; if (u < -1e-7 || u > 1 + 1e-7) return null; const q = cross(s, e1), v = dot(d, q) * inv; if (v < -1e-7 || u + v > 1 + 1e-7) return null; const t = dot(e2, q) * inv; return t > 0 ? t : null; };
  const bary = (x, z, v, tol = 1e-9) => { const [a, b, c] = v, den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-12) return null; const w0 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, w1 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den, w2 = 1 - w0 - w1; return Math.min(w0, w1, w2) >= -tol ? [w0, w1, w2] : null; };
  const orig = x => { let q = ((x + PI_R) % P + P) % P - PI_R; if (q >= PI_R) q -= P; return q; };
  const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const I = new T.Matrix4(), wv = new T.Vector3();
  const roadNames = /^road:(route |bridge .* top$|junction paving$)/, terrainMeshes = new Set([...TS.ring, ...TS.rest]);
  S.scene.updateMatrixWorld(true);

  // ---- the displayed road surfaces at uBend 0 (flat frame), for the classification and the side edges
  const roadTris = [], roadCells = new Map(), routeMesh = new Map();
  S.roads.state.root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !roadNames.test(o.name) || !visible(o)) return;
    const g = o.geometry, pos = g.attributes.position, ix = g.index, count = ix ? ix.count : pos.count, moved = !o.matrixWorld.equals(I);
    for (let t = 0; t + 2 < count; t += 3) {
      const v = [0, 1, 2].map(k => { const n = ix ? ix.getX(t + k) : t + k; if (moved) { wv.set(pos.getX(n), pos.getY(n), pos.getZ(n)).applyMatrix4(o.matrixWorld); return [wv.x, wv.y, wv.z]; } return [pos.getX(n), pos.getY(n), pos.getZ(n)]; });
      if (Math.max(...v.map(p => Math.abs(p[0]))) > 80 || Math.max(...v.map(p => Math.abs(p[2]))) > 80) continue;          // the town and its ring only
      const tri = { v, name: o.name }; roadTris.push(tri);
      for (let x = Math.floor(Math.min(v[0][0], v[1][0], v[2][0])); x <= Math.floor(Math.max(v[0][0], v[1][0], v[2][0])); x++) for (let z = Math.floor(Math.min(v[0][2], v[1][2], v[2][2])); z <= Math.floor(Math.max(v[0][2], v[1][2], v[2][2])); z++) { const k = `${x},${z}`; let a = roadCells.get(k); if (!a) roadCells.set(k, a = []); a.push(tri); }
    }
    if (o.name.startsWith('road:route ')) routeMesh.set(o.name, o);
  });
  const roadsAt = (x, z, only) => { const out = []; for (const t of roadCells.get(key(x, z)) || []) { if (only && t.name !== only) continue; const w = bary(x, z, t.v); if (w) out.push({ name: t.name, y: w[0] * t.v[0][1] + w[1] * t.v[1][1] + w[2] * t.v[2][1] }); } return out; };
  // a hash of every displayed road surface vertex and index (the final road geometry must not change)
  let hash = 2166136261; const mix = v => { hash ^= v; hash = Math.imul(hash, 16777619) >>> 0; };
  { const meshes = []; S.roads.state.root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && roadNames.test(o.name)) meshes.push(o); }); meshes.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
    for (const o of meshes) { const p = o.geometry.attributes.position.array, ix = o.geometry.index ? o.geometry.index.array : []; for (let i = 0; i < p.length; i++) { f32[0] = p[i]; mix(u32[0]); } for (let i = 0; i < ix.length; i++) mix(ix[i]); mix(p.length); } }
  const roadHash = hash.toString(16);

  // ---- the nine exits (world.js) and their connector routes
  const half = L.BASE.half, exits = [];
  for (const e of NET.edges) {
    const cFrom = /^C01-/.test(e.from), cTo = /^C01-/.test(e.to); if (cFrom === cTo) continue;
    const id = cFrom ? e.to : e.from, n = NET.nodeById[id], p = W.lonLatToTown(n.lon, n.lat);
    if (Math.abs(Math.max(Math.abs(p.x), Math.abs(p.z)) - half) > 1e-3) continue;
    const townEdge = NET.edges.find(q => (q.from === id || q.to === id) && /^TOWN_/.test(q.class)), rt = D.routes.find(r => r.def.segs.some(s => s.id === e.id));
    const axis = Math.abs(p.x) > Math.abs(p.z) ? 'x' : 'z', sign = Math.sign(p[axis]);
    exits.push({ id, edge: e.id, ring: cFrom ? e.from : e.to, route: rt ? rt.def.id : null, mesh: rt ? 'road:' + rt.strip.name : null, cls: townEdge ? townEdge.class : null, cw: townEdge ? NET.townClasses[townEdge.class].carriageway : null, axis, sign, at: axis === 'x' ? p.z : p.x });
  }
  exits.sort((a, b) => (a.id < b.id ? -1 : 1));
  const xzOf = (ex, along, lateral) => (ex.axis === 'x' ? [ex.sign * along, ex.at + lateral] : [ex.at + lateral, ex.sign * along]);
  // the connector mesh's own side edge at a station: the first lateral offset (outward from the centre line) where it stops covering, by bisection
  const sideEdge = (ex, along, dir) => { const covered = o => { const [x, z] = xzOf(ex, along, dir * o); return roadsAt(x, z, ex.mesh).length > 0; };
    if (!covered(0.05)) return null; let lo = 0.05, hi = 0.05; while (covered(hi) && hi < 12) { lo = hi; hi += 0.25; } if (hi >= 12) return null; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (covered(m)) lo = m; else hi = m; } return (lo + hi) / 2; };

  // ---- probes
  const probes = [], add = (ex, set, along, lat, extra = {}) => { const [x, z] = xzOf(ex, along, lat); probes.push({ exit: ex.id, set, along: +along.toFixed(4), lat: +lat.toFixed(4), x, z, ...extra }); };
  for (const ex of exits) {
    for (const dir of [-1, 1]) add(ex, 'CG1', half + 1.5, dir * (ex.cw / 2 + 1));
    const alongs = []; for (let a = half + 0.125; a <= half + 6.875 + 1e-9; a += 0.25) alongs.push(a);
    for (const a of alongs) for (const dir of [-1, 1]) for (let o = 0.125; o <= 7.875 + 1e-9; o += 0.25) add(ex, 'grid', a, dir * o, { cell: 0.0625 });
    for (const d of [0.01, 0.03, 0.06]) for (const dir of [-1, 1]) for (let o = 0.125; o <= 7.875 + 1e-9; o += 0.25) add(ex, 'town-edge', half + d, dir * o, { d });
    ex.edges = [];
    for (const a of alongs) for (const dir of [-1, 1]) { const e = sideEdge(ex, a, dir); if (e === null) continue; ex.edges.push({ a: +a.toFixed(3), dir, e: +e.toFixed(4) });
      for (const d of [0.01, 0.03, 0.06, 0.12, 0.2]) for (const sg of [-1, 1]) add(ex, 'side-edge', a, dir * (e + sg * d), { d: sg * d, edge: +e.toFixed(4), pair: `${ex.id}:${a.toFixed(3)}:${dir}` }); }
  }
  // classification at uBend 0
  for (const q of probes) { const r = roadsAt(q.x, q.z); q.road = r.length ? r.map(h => h.name.replace(/^road:/, '')).filter((v, i, a) => a.indexOf(v) === i) : null; q.roadY = r.length ? Math.max(...r.map(h => h.y)) : null; q.xd = B.wrapX(q.x); q.xo = orig(q.x); }

  // ---- the uncut lattice
  const refCells = new Map(), want = new Set(); for (const q of probes) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) want.add(key(q.xo + dx, q.z + dz));
  for (const c of [...TS.ringData, ...(TS.restData || [])]) for (const index of [c.ringIndex, c.restIndex]) if (index) for (let t = 0; t + 2 < index.length; t += 3) {
    const v = [0, 1, 2].map(k => [c.pos[index[t + k] * 3], c.pos[index[t + k] * 3 + 1], c.pos[index[t + k] * 3 + 2]]);
    for (let x = Math.floor(Math.min(v[0][0], v[1][0], v[2][0])); x <= Math.floor(Math.max(v[0][0], v[1][0], v[2][0])); x++) for (let z = Math.floor(Math.min(v[0][2], v[1][2], v[2][2])); z <= Math.floor(Math.max(v[0][2], v[1][2], v[2][2])); z++) { const k = `${x},${z}`; if (!want.has(k)) continue; let a = refCells.get(k); if (!a) refCells.set(k, a = []); a.push(v); }
  }
  // (a cut vertex is stored in Float32: on a lattice edge it can lie a few micrometres outside its triangle, and next to the town patch the triangle beyond
  // that edge does not exist, so the lookup accepts 1e-5 in the weights; a vertex on a cell line, e.g. the patch edge x = 48 after orig()'s rounding, is
  // looked up in the cells on both sides of it)
  const refY = (x, z) => { const xo = orig(x), keys = new Set(); for (const dx of [-1e-6, 0, 1e-6]) for (const dz of [-1e-6, 0, 1e-6]) keys.add(key(xo + dx, z + dz));
    for (const k of keys) for (const v of refCells.get(k) || []) { const w = bary(xo, z, v, 1e-5); if (w) return w[0] * v[0][1] + w[1] * v[1][1] + w[2] * v[2][1]; } return null; };
  for (const q of probes) for (const v of refCells.get(key(q.xo, q.z)) || []) { const w = bary(q.xo, q.z, v); if (!w) continue; const dx = q.xd - q.xo, tri = v.map(p => [p[0] + dx, p[1], p[2]]), y = w[0] * v[0][1] + w[1] * v[1][1] + w[2] * v[2][1];
    const e = [0, 1, 2].map(k => { const a = tri[k], b = tri[(k + 1) % 3], l = Math.hypot(a[0] - b[0], a[2] - b[2]); return { l, g: Math.abs(a[1] - b[1]) / Math.max(l, 1e-9) }; });
    q.ref = { tri, w, y, alt: altOf(y, q.z), edge: Math.max(...e.map(k => k.l)), slope: Math.max(...e.map(k => k.g)) }; break; }

  // ---- CG5: the ground cut polygons that contain each probe
  const polys = TS.roadPolygons || [], pCells = new Map(); let unlabelled = 0;
  polys.forEach((c, id) => { if (!c.src) unlabelled++; const b = c.box; if (b.x1 < -90 || b.x0 > 90 || b.z1 < -90 || b.z0 > 90) return; for (let x = Math.floor(b.x0); x <= Math.floor(b.x1); x++) for (let z = Math.floor(b.z0); z <= Math.floor(b.z1); z++) { const k = `${x},${z}`; let a = pCells.get(k); if (!a) pCells.set(k, a = []); a.push(id); } });
  const inPoly = (pt, poly) => { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], c = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]); if (Math.abs(c) < 1e-12) continue; if (s && Math.sign(c) !== s) return false; s = Math.sign(c); } return true; };
  for (const q of probes) { const ids = (pCells.get(key(q.x, q.z)) || []).filter(id => inPoly([q.x, q.z], polys[id].p)); q.cut = ids.length ? ids.map(id => { const s = polys[id].src || {}; return `${s.kind || '?'}:${s.id || '?'}${s.connector ? ':trimmed' : ''}${s.stripEdge ? ':strip' : ''}${s.s0 !== undefined ? '@' + s.s0 : ''}`; }) : null; }

  // ---- the displayed scene, per state
  const interest = new Set(probes.map(q => key(q.xd, q.z)));
  const signature = () => [...TS.ring, ...TS.rest].map(m => [m.uuid, m.geometry.uuid, m.geometry.index ? m.geometry.index.count : 0, m.geometry.attributes.position.count, visible(m)].join(':')).join('|');
  const out = { modes: {}, exits: exits.map(({ edges, ...e }) => ({ ...e, edgeStations: edges.length, edgeList: edges, edgeRange: edges.length ? [Math.min(...edges.map(q => q.e)), Math.max(...edges.map(q => q.e))] : null })), roadHash, polygons: polys.length, unlabelled,
    groundCut: TS.stats.groundCut ? { polygons: TS.stats.groundCut.polygons, connector: TS.stats.groundCut.connector || null } : null, roadCut: TS.stats.roadCut || null, terrainTriangles: TS.stats.triangles ? TS.stats.triangles() : null };
  try { const gl = S.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); out.renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { out.renderer = null; }
  for (const u of modes) {
    B.set(u); await frame(); await frame(); S.scene.updateMatrixWorld(true);
    const cells = new Map(), names = new Set(); let triangles = 0;
    const bend = p => (u ? B.point(p[0], p[1], p[2], u) : p);
    S.scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position || !visible(o)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some(m => m && m.userData && (m.userData.noBend || m.userData.noWrap))) return;
      const clear = mats.every(m => !m || (m.transparent && (m.depthWrite === false || m.opacity <= 0)) || m.blending === T.AdditiveBlending || m.colorWrite === false || m.visible === false);
      if (clear) return;
      const terr = terrainMeshes.has(o), road = roadNames.test(o.name), moved = !o.matrixWorld.equals(I), g = o.geometry, pos = g.attributes.position, ix = g.index, count = ix ? ix.count : pos.count, name = o.name || o.parent?.name || o.type;
      for (let t = 0; t + 2 < count; t += 3) {
        const v = [0, 1, 2].map(k => { const n = ix ? ix.getX(t + k) : t + k; if (moved) { wv.set(pos.getX(n), pos.getY(n), pos.getZ(n)).applyMatrix4(o.matrixWorld); return [B.wrapX(wv.x), wv.y, wv.z]; } return [B.wrapX(pos.getX(n)), pos.getY(n), pos.getZ(n)]; });
        const x0 = Math.floor(Math.min(v[0][0], v[1][0], v[2][0])), x1 = Math.floor(Math.max(v[0][0], v[1][0], v[2][0])), z0 = Math.floor(Math.min(v[0][2], v[1][2], v[2][2])), z1 = Math.floor(Math.max(v[0][2], v[1][2], v[2][2]));
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 2500) continue;
        let tri = null;
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = `${x},${z}`; if (!interest.has(k)) continue; if (!tri) { tri = { v, b: v.map(bend), terr, road, name }; names.add(name); } let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(tri); triangles++; }
      }
    });
    const cast = (A, dir, list) => { let terr = null, road = null, first = null; for (const tri of list) { const t = rayHit(A, dir, ...tri.b); if (t === null) continue; if (tri.terr && (!terr || t < terr.t)) terr = { t, tri }; if (tri.road && (!road || t < road.t)) road = { t, name: tri.name }; if (!first || t < first.t) first = { t, name: tri.name, terr: tri.terr, road: tri.road }; } return { terr, road, first }; };
    const res = { triangles, names: [...names].sort(), signature: signature(), probes: [] };
    for (const q of probes) {
      const list = cells.get(key(q.xd, q.z)) || [], r = {};
      const top = Math.max(q.ref ? q.ref.y : 0, q.roadY ?? -1e9) + 20, A = bend([q.xd, top, q.z]), Z = bend([q.xd, q.ref ? q.ref.y : top - 40, q.z]), dl = Math.hypot(...sub(Z, A)), dir = sub(Z, A).map(v => v / dl);
      if (q.ref) { const bt = q.ref.tri.map(bend); let t = rayHit(A, dir, ...bt); if (t === null) { const Zw = [0, 1, 2].map(k => bt.reduce((s, p, i) => s + q.ref.w[i] * p[k], 0)); t = dot(sub(Zw, A), dir); } r.tRef = t; r.chord = u * q.ref.edge * q.ref.edge * (1 + 2 * q.ref.slope) / (4 * R); r.tol = 0.002 + r.chord; }
      const h = cast(A, dir, list);
      if (h.first) r.first = { t: h.first.t, name: h.first.name, terr: h.first.terr, road: h.first.road };
      if (h.road) r.road = { t: h.road.t, name: h.road.name };
      if (h.terr) { const dev = Math.max(...h.terr.tri.v.map(p => { const y = refY(p[0], p[2]); return y === null ? Infinity : Math.abs(p[1] - y); })); r.terr = { t: h.terr.t, dev }; if (dev === Infinity) r.terr.noRef = h.terr.tri.v.filter(p => refY(p[0], p[2]) === null).map(p => p.map(c => +c.toFixed(5))); }
      res.probes.push(r);
    }
    out.modes[u] = res;
  }
  B.set(0); await frame();
  out.probes = probes.map(({ xd, xo, ref, ...rest }) => ({ ...rest, x: +rest.x.toFixed(4), z: +rest.z.toFixed(4), roadY: rest.roadY === null ? null : +rest.roadY.toFixed(4), refAlt: ref ? +ref.alt.toFixed(4) : null, refY: ref ? ref.y : null }));
  return out;
}

// ---------------------------------------------------------------- run and judge
const browser = await chromium.launch({ args: soft ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=metal', '--ignore-gpu-blocklist'] });
let data, errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(html).href + '?quality=high');
  await page.waitForFunction(() => window.__scene && window.__scene.worldgen && window.__scene.worldgen.state.done && window.__scene.worldgen.state.firstFrameAt !== null, null, { timeout: 240000, polling: 200 });
  data = await page.evaluate(probe, { modes: [0, 0.5, 1] });
} finally { await browser.close(); cleanup(); }

const MODES = Object.keys(data.modes), PR = data.probes, f = (v, n = 3) => (typeof v === 'number' ? v.toFixed(n) : String(v));
const where = q => `${q.exit} ${q.set} (${f(q.x, 2)}, ${f(q.z, 2)})${q.d !== undefined ? ` d=${q.d}` : ''}`;
// ground: the near-side terrain at the uncut lattice (its vertices within 2 mm, hit within the chord tolerance); the first opaque surface that terrain or an
// overlay at most 0.3 m above it. road: the first opaque surface a road; anything else at most 1 mm nearer counts as the road (the road materials carry a
// polygon offset; a verge lies on the ground), plus, when bent, the chord term of the lattice triangle there (the 1.57 m terrain triangles and the 0.5 m
// road rows sag differently between their vertices)
const roadMargin = r => 1e-3 + (r.chord || 0);
const judge = (q, r) => {
  if (q.road) {
    if (!r.road) return { ok: false, why: '道路无命中' };
    if (r.first && !r.first.road && r.first.t < r.road.t - roadMargin(r)) return { ok: false, why: `路面被 ${r.first.name} 盖住 ${f(r.road.t - r.first.t, 4)} m（容差 ${f(roadMargin(r), 4)}）` };
    return { ok: true };
  }
  if (q.refAlt === null) return { ok: false, why: '无参考地形三角形' };
  if (!r.terr) return { ok: false, why: '地形缺面' };
  if (r.terr.dev > 2e-3 || Math.abs(r.terr.t - r.tRef) > r.tol) return { ok: false, why: `地形命中偏差 ${f(r.terr.t - r.tRef, 4)} m（容差 ${f(r.tol, 4)}），顶点离未裁切地形 ${f(r.terr.dev, 4)}` };
  if (!r.first) return { ok: false, why: '无命中' };
  if (r.first.t > r.tRef + r.tol) return { ok: false, why: `第一个面远于本侧地面 ${f(r.first.t - r.tRef, 3)} m：${r.first.name}` };
  if (r.first.t < r.tRef - 0.3) return { ok: true, blocked: r.first.name };
  return { ok: true };
};
const summary = { commit, ref, html: path.relative(root, html), files, errors, renderer: data.renderer, exits: data.exits, roadHash: data.roadHash, polygons: data.polygons, unlabelled: data.unlabelled, groundCut: data.groundCut, roadCut: data.roadCut, terrainTriangles: data.terrainTriangles, modes: {} };
const fails = { CG1: [], CG2: [], CG3: [], CG5: [] }, addF = (k, m) => { if (fails[k].length < 400) fails[k].push(m); };
const cg1 = {};
for (const u of MODES) {
  const M = data.modes[u], st = summary.modes[u] = { triangles: M.triangles, byExit: {}, holeArea: 0, blocked: {}, cutGround: 0, terrainOverRoad: 0, step: { pairs: 0, maxUp: -Infinity, maxDown: -Infinity, worst: null } };
  const pairs = new Map();
  PR.forEach((q, i) => {
    const r = M.probes[i], j = judge(q, r), e = st.byExit[q.exit] || (st.byExit[q.exit] = { ground: 0, groundOK: 0, road: 0, roadOK: 0, holes: 0 });
    if (q.road) { e.road++; if (j.ok) e.roadOK++; } else { e.ground++; if (j.ok) e.groundOK++; else e.holes++; }
    if (j.blocked) st.blocked[j.blocked] = (st.blocked[j.blocked] || 0) + 1;
    if (!j.ok && !q.road && q.cell) st.holeArea += q.cell;
    if (q.set === 'CG1') { (cg1[`${q.exit} (${f(q.x, 2)}, ${f(q.z, 2)})`] = cg1[`${q.exit} (${f(q.x, 2)}, ${f(q.z, 2)})`] || {})[u] = { cls: q.road ? 'road' : 'ground', ok: j.ok, first: r.first ? r.first.name : null, why: j.why || null, cut: q.cut }; if (!j.ok) addF('CG1', `${u} ${where(q)} ${q.road ? '应为道路' : '应为地面'}：${j.why}`); }
    else if (!j.ok) addF(q.road ? 'CG3' : 'CG2', `${u} ${where(q)} ${j.why}${q.cut ? `；裁切来源 ${q.cut.join(' ')}` : ''}`);
    if (!q.road && q.cut) { st.cutGround++; if (u === '0') addF('CG5', `${where(q)} 无道路但被裁：${q.cut.join(' ')}`); }
    if (q.road && r.terr && r.road && r.terr.t < r.road.t - roadMargin(r)) st.terrainOverRoad++;
    if (q.road && r.terr && r.road) st.maxTerrainAboveRoad = Math.max(st.maxTerrainAboveRoad ?? -Infinity, r.road.t - r.terr.t);
    if (q.set === 'side-edge' && Math.abs(q.d) === 0.01) { const p = pairs.get(q.pair) || {}; p[q.d > 0 ? 'out' : 'in'] = { q, r }; pairs.set(q.pair, p); }
  });
  // the step at the connector's side edge: the terrain 0.01 m outside against the road 0.01 m inside (heights along the ray, so in metres in every state)
  for (const [k, p] of pairs) { if (!p.in || !p.out || !p.in.r.road || !p.out.r.terr) continue; st.step.pairs++;
    const up = p.in.r.road.t - p.out.r.terr.t;      // > 0: the terrain outside stands above the road inside
    if (up > st.step.maxUp) { st.step.maxUp = up; st.step.worst = k; } st.step.maxDown = Math.max(st.step.maxDown, -up);
    const be = (st.step.byExit = st.step.byExit || {})[p.in.q.exit] || (st.step.byExit[p.in.q.exit] = { pairs: 0, roadAboveMin: Infinity, roadAboveMax: -Infinity });
    be.pairs++; be.roadAboveMin = +Math.min(be.roadAboveMin, -up).toFixed(4); be.roadAboveMax = +Math.max(be.roadAboveMax, -up).toFixed(4);
    if (up > 0.02) addF('CG3', `${u} 侧边 ${k}：边外 0.01 m 地形高出边内 0.01 m 路面 ${f(up, 4)} m`); }
  st.holeArea = +st.holeArea.toFixed(4);
}
// CG4 / CG6: one terrain and the same meshes near the probes in all three states
const sig = MODES.map(u => data.modes[u].signature), sameTerrain = sig.every(s => s === sig[0]);
const namesBy = Object.fromEntries(MODES.map(u => [u, data.modes[u].names])), allNames = [...new Set(Object.values(namesBy).flat())], onlySome = allNames.filter(n => MODES.some(u => !namesBy[u].includes(n)));
summary.cg4 = { sameTerrain, meshesNearProbes: allNames.length, onlySome, names: allNames };
let base = null, transitions = null, baseCmp = null;
if (baselineFile) {
  base = JSON.parse(fs.readFileSync(path.resolve(root, baselineFile), 'utf8'));
  transitions = Object.entries(cg1).map(([k, v]) => { const b = base.cg1 && base.cg1[k]; return { point: k, before: b ? MODES.map(u => (b[u] ? (b[u].ok ? 'ok' : 'fail') : '—')).join('/') : '—', after: MODES.map(u => (v[u].ok ? 'ok' : 'fail')).join('/'), cls: v['0'].cls }; });
  baseCmp = { roadHash: [base.roadHash, data.roadHash], files: Object.fromEntries(['layout.js', 'world.js', 'bend.js'].map(k => [k, base.files && base.files[k] === files[k]])) };
}
summary.cg1 = cg1; summary.transitions = transitions; summary.baseline = baseCmp;

const exitLine = u => Object.entries(summary.modes[u].byExit).map(([id, e]) => `${id} 地面 ${e.groundOK}/${e.ground}、道路 ${e.roadOK}/${e.road}`).join('；');
for (const u of MODES) { const s = summary.modes[u]; console.log(`  · uBend ${u}：${exitLine(u)}；地面空洞估计面积（0.25 m 网格）${f(s.holeArea, 3)} m²；无道路但被裁 ${s.cutGround}；地形高于路面（超容差）${s.terrainOverRoad}，道路探针处地形最多高出路面 ${f(s.maxTerrainAboveRoad, 4)} m；侧边台阶（边外地形 − 边内路面）${s.step.pairs} 对，最高 ${f(s.step.maxUp, 4)} m（${s.step.worst}），路面高出地形最多 ${f(s.step.maxDown, 4)} m（按出口 ${Object.entries(s.step.byExit || {}).map(([k, v]) => `${k} ${f(v.roadAboveMin, 3)}–${f(v.roadAboveMax, 3)}`).join('、')}）${Object.keys(s.blocked).length ? `；更近的非地面遮挡 ${JSON.stringify(s.blocked)}` : ''}`); }
const cg1Rows = Object.entries(cg1).map(([k, v]) => `${k} ${v['0'].cls}:${MODES.map(u => (v[u].ok ? '✓' : '✗')).join('')}`).join('、');
check('CG1', !fails.CG1.length, `方案第 3 节 18 点（出口外 1.5 m，车行道半宽 + 1 m）：${cg1Rows}${transitions ? `；对照基线：${transitions.filter(t => t.before !== t.after).map(t => `${t.point} ${t.before}→${t.after}`).join('、') || '无变化'}` : ''}${fails.CG1.length ? `；例：${fails.CG1.slice(0, 6).join('；')}` : ''}`);
const probeCounts = ['grid', 'town-edge', 'side-edge'].map(s => `${s} ${PR.filter(q => q.set === s).length}`).join('、');
check('CG2', !fails.CG2.length, `完整覆盖：九个出口（${data.exits.map(e => `${e.id} ${e.route} 侧边 ${e.edgeRange ? e.edgeRange.map(v => f(v, 3)).join('–') : '—'} m`).join('；')}），探针 ${probeCounts}；地面探针全部命中本侧原地形且第一个不透明面为地面${fails.CG2.length ? `；例：${fails.CG2.slice(0, 6).join('；')}` : ''}`);
check('CG3', !fails.CG3.length, `道路在上：道路探针第一个不透明面为道路，侧边外地形不高出边内路面 0.02 m 以上${fails.CG3.length ? `；例：${fails.CG3.slice(0, 6).join('；')}` : ''}`);
check('CG4', sameTerrain && !onlySome.length, `uBend 0 / 0.5 / 1：CG1–CG3 三种状态各跑一遍（见上），地形网格同一组对象与几何 ${sameTerrain}；探针附近不透明网格 ${allNames.length} 个，只在部分状态出现 ${onlySome.length}${onlySome.length ? `：${onlySome.slice(0, 8).join('、')}` : ''}`);
check('CG5', !fails.CG5.length && data.unlabelled === 0, `裁切来源：地面裁切多边形 ${data.polygons}（未登记来源 ${data.unlabelled}${data.groundCut && data.groundCut.connector ? `；连接段修正 ${JSON.stringify(data.groundCut.connector.total || data.groundCut.connector)}` : ''}）；无道路却在裁切多边形内的地面探针 ${summary.modes['0'].cutGround}${fails.CG5.length ? `；例：${fails.CG5.slice(0, 6).join('；')}` : ''}`);
const cg6ok = !errors.length && (!baseCmp || (baseCmp.roadHash[0] === baseCmp.roadHash[1] && Object.values(baseCmp.files).every(Boolean)));
check('CG6', cg6ok, `单一显示与冻结：页面错误 ${errors.length}${errors.length ? '（' + errors.slice(0, 3).join(' | ') + '）' : ''}；道路几何哈希 ${data.roadHash}${baseCmp ? `，基线 ${baseCmp.roadHash[0]}（${baseCmp.roadHash[0] === baseCmp.roadHash[1] ? '相同' : '不同'}）；layout.js / world.js / bend.js 与基线相同 ${Object.entries(baseCmp.files).map(([k, v]) => `${k} ${v}`).join('、')}` : '（未给 --baseline，不比较）'}；渲染器 ${data.renderer}`);
summary.fails = fails; summary.probes = PR.length;
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify({ ...summary, failedProbes: PR.map((q, i) => ({ q, r: MODES.map(u => ({ u, ...judge(q, data.modes[u].probes[i]), first: data.modes[u].probes[i].first ? data.modes[u].probes[i].first.name : null, ...(data.modes[u].probes[i].terr && data.modes[u].probes[i].terr.noRef ? { noRef: data.modes[u].probes[i].terr.noRef } : {}) })) })).filter(x => x.r.some(y => !y.ok)).slice(0, 4000) }, null, 1));
console.log(`报告：${path.relative(root, reportFile)}（探针 ${PR.length}；HEAD ${commit.slice(0, 7)}；index.html md5 ${files['index.html']}）`);
console.log(failures ? `${failures} 项未通过` : '全部通过');
process.exit(failures ? 1 : 0);
