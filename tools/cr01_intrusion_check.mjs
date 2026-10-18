// W10c CR01 houses and grass against the ring and its ten junctions (docs/world/CR01_HOUSE_GRASS_INTRUSION_PLAN.md section 4). Run after `python3 build.py`:
//   node tools/cr01_intrusion_check.mjs [--ref <git ref>] [--baseline <report.json>] [--report <path>] [--swiftshader]
// Everything expected comes from the displayed meshes and the plan's final road strips (the strips are first checked to be the displayed road meshes, vertex
// for vertex): a road point's zone is read from its triangle's own swept column offset and paved range (clipOffset, clipPaved: the merge carries them through
// every cut) and the row's footprint (roadkit.js FOOT: sh = shoulder, full = paved + shoulder + ditch); nothing is taken from the cut code under test.
// Probes: round the whole closed ring every 0.25 m along and 0.25 m across on a half-step lattice (no probe on a swept column line), 5.875 m either side of its
// centre line outside the town patch, and at each of the ten CR01 junctions the rows of every other arm within 14 m of the node, across its strip and 1 m beyond
// (the town's own streets are not this check's; the connectors from the town edge are). Every probe is a ray against the
// displayed triangles taken into the display frame as bend.js's vertex shader takes them (world matrix, seam shift, bend) at uBend 0, 0.5 and 1, along the local
// normal (tools/connector_ground_check.mjs, tools/terrain_structure_check.mjs). Opaque = not (transparent and no depth write / zero opacity), not additive,
// colour written; instanced meshes are expanded instance by instance (plants and furniture count here, unlike the ground checks). Lines are left out.
//   I1 paving     every probe on a road's paved range (CR01: -2.25 m outside to 2.75 m inside, the inner asphalt shoulder) or its shoulder: the first opaque surface
//                 is a road (anything else at most 1 mm nearer, plus the chord term when bent, counts as the road: the road materials carry a polygon offset), or the
//                 road's own furniture (barriers, posts; a lamp's arm or head) or its own edge weeds (roadkit.js: the wear along the paved edge), which are listed;
//                 a probe that hits no road at all (a crack) is listed and, with --baseline, fails when it is new
//   I2 ground     in the ditch zone (shoulder edge to the full section's edge) and on the paving: no terrain, ground overlay (cover:plots/ridges/..., sec:plots, a
//                 landmark lawn) above the road; on the road's own verge (beyond full) the ground over the road is listed, not failed (the verge lies on it)
//   I3 plants     every plant instance (cover:/sec: tufts, weeds, seedlings, flowers, shrubs, ferns; a road's own tufts and weeds) by its whole transformed geometry
//                 (plan convex hull) against the final road triangles of CR01 and of the arms within 14 m of its ten junction nodes: a foreign plant overlaps no
//                 road's full section (paving, shoulder, ditch) by more than 1e-5 m2; a road's own edge plants are listed
//   I4 structures every building, landmark, section and town part (its triangles in plan) against the same road triangles: a part over a paved zone lower
//                 than 4.5 m above the road (the clear height of a carriageway) fails; over the shoulder or the ditch, over the verge and higher over the paving
//                 it is listed with its least height and its least horizontal clearance to the CR01 paving; a tree's crown and road furniture are listed. LM09
//                 (PENDING): its east end lies where the user's W10b decision A put it; what of it reaches a road section is listed for the user's decision
//   I5 holes      every probe without a road: the uncut terrain or an overlay within 0.3 m above it is its first opaque surface (no hole, no far-side hit); with
//                 --baseline no new hole (a probe that held before)
//   I6 one display  the terrain, road and ground overlay meshes are the same objects and geometry at the three bend states; page errors 0; with --baseline the
//                 road geometry hash and layout.js / world.js / bend.js equal the baseline's
// Save the baseline from the unfixed version first (--ref <ref> --report .../report-before.json), then run with --baseline .../report-before.json.
// Report: docs/world/w10c/house-grass-review/report.json (not tracked); --ref builds that git ref in a temporary worktree and writes report-<ref>.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const ref = arg('--ref', null), soft = args.includes('--swiftshader'), baselineFile = arg('--baseline', null);
const outDir = path.join(root, 'docs/world/w10c/house-grass-review'), reportFile = path.resolve(root, arg('--report', path.join(outDir, ref ? `report-${ref.replace(/[^\w.-]+/g, '_')}.json` : 'report.json')));
let failures = 0;
const check = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures++; };

let srcDir = root, cleanup = () => {}, commit;
if (ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cic-'));
  execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['build.py'], { cwd: dir, stdio: 'pipe' });
  srcDir = dir; commit = execFileSync('git', ['rev-parse', ref], { cwd: root, encoding: 'utf8' }).trim();
  cleanup = () => { try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'pipe' }); } catch { fs.rmSync(dir, { recursive: true, force: true }); } };
} else commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const html = path.join(srcDir, 'index.html'), md5 = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
const files = Object.fromEntries(['index.html', 'layout.js', 'world.js', 'bend.js'].map(f => [f, md5(path.join(srcDir, f))]));

// ---------------------------------------------------------------- the page part
async function probe({ modes, STEP }) {
  const S = window.__scene, T = window.THREE, B = S.bend, D = S.roads.data(), TS = S.terrain;
  const R = 90, BASE = 1.6, P = B.PERIOD, PI_R = Math.PI * R, BAND = 66, CR01_PAVED = [-2.25, 2.75], TOWN = window.LAYOUT.BASE.half;
  const FOOT = { RD01: [-4.5, 4.5, -5.6, 5.6], RD03: [-2.75, 2.75, -3.55, 2.75], RD04: [-2.75, 2.75, -2.75, 2.75], RD05: [-1.55, 1.55, -1.55, 1.55], RD08: [-1.4, 1.4, -1.4, 1.4] };
  const frame = () => new Promise(r => requestAnimationFrame(() => r()));
  const key = (x, z) => `${Math.floor(x)},${Math.floor(z)}`, ch = z => Math.cosh(z / R), altOf = (y, z) => y / ch(z) + BASE;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const rayHit = (o, d, A, C, E) => { const e1 = sub(C, A), e2 = sub(E, A), p = cross(d, e2), det = dot(e1, p); if (Math.abs(det) < 1e-13) return null; const inv = 1 / det, s = sub(o, A), u = dot(s, p) * inv; if (u < -1e-7 || u > 1 + 1e-7) return null; const q = cross(s, e1), v = dot(d, q) * inv; if (v < -1e-7 || u + v > 1 + 1e-7) return null; const t = dot(e2, q) * inv; return t > 0 ? t : null; };
  const bary = (x, z, v, tol = 1e-9) => { const [a, b, c] = v, den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-12) return null; const w0 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, w1 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den, w2 = 1 - w0 - w1; return Math.min(w0, w1, w2) >= -tol ? [w0, w1, w2] : null; };
  const orig = x => { let q = ((x + PI_R) % P + P) % P - PI_R; if (q >= PI_R) q -= P; return q; };
  const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const inBand = (x, z) => Math.abs(x) <= BAND && Math.abs(z) <= BAND, nearBand = (x, z) => Math.abs(x) <= BAND + 6 && Math.abs(z) <= BAND + 6;
  const I = new T.Matrix4(), wv = new T.Vector3(), M4 = new T.Matrix4();
  const roadNames = /^road:(route |bridge .* top$|junction paving$)/, terrainMeshes = new Set([...TS.ring, ...TS.rest]);
  S.scene.updateMatrixWorld(true);
  // plan polygons (x, z): signed area, convex clip, hull
  const sgn = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0), areaOf = p => (p.length < 3 ? 0 : Math.abs(sgn(p)) / 2);
  const clip = (a, b) => { let q = a; const s = sgn(b) >= 0 ? 1 : -1; for (let i = 0; i < b.length && q.length >= 3; i++) { const A = b[i], Bp = b[(i + 1) % b.length], f = r => ((Bp[0] - A[0]) * (r[1] - A[1]) - (Bp[1] - A[1]) * (r[0] - A[0])) * s, out = []; let pr = q[q.length - 1], fp = f(pr); for (const c of q) { const fc = f(c); if ((fc >= 0) !== (fp >= 0)) { const t = fp / (fp - fc); out.push([pr[0] + (c[0] - pr[0]) * t, pr[1] + (c[1] - pr[1]) * t]); } if (fc >= 0) out.push(c); pr = c; fp = fc; } q = out; } return q.length >= 3 ? q : []; };
  const hull = pts => { const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p; const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); } for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); } return lo.slice(0, -1).concat(up.slice(0, -1)); };

  // ---- the final road strips (plan) = the displayed road meshes, vertex for vertex
  const meshByName = new Map(); S.roads.state.root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && roadNames.test(o.name)) meshByName.set(o.name, o); });
  const stripCheck = [], roadTris = [], roadCells = new Map();
  // a route's centre line as an index: the nearest row segment of a flat point, its station and row (for the row's footprint)
  const frameOf = new Map(), routeFrame = rt => { let f = frameOf.get(rt); if (f) return f; const F = rt.flatOf, n = F.length, C = 2, cells = new Map(), reach = 12;
    for (let i = 0; i + 1 < n; i++) for (let a = Math.floor((Math.min(F[i].x, F[i + 1].x) - reach) / C); a <= Math.floor((Math.max(F[i].x, F[i + 1].x) + reach) / C); a++) for (let b = Math.floor((Math.min(F[i].z, F[i + 1].z) - reach) / C); b <= Math.floor((Math.max(F[i].z, F[i + 1].z) + reach) / C); b++) { const k = a * 1048576 + b; let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(i); }
    f = (x, z) => { let best = null; for (const i of cells.get(Math.floor(x / C) * 1048576 + Math.floor(z / C)) || []) { const ax = F[i].x, az = F[i].z, dx = F[i + 1].x - ax, dz = F[i + 1].z - az, l2 = dx * dx + dz * dz || 1e-12, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d2 = (x - ax - dx * t) ** 2 + (z - az - dz * t) ** 2; if (!best || d2 < best.d2) best = { d2, i: t < 0.5 ? i : i + 1, s: rt.samples[i].s + (rt.samples[i + 1].s - rt.samples[i].s) * t }; } return best; };
    frameOf.set(rt, f); return f; };
  const footOf = (rt, i) => { const f = rt.footprint && rt.footprint[i]; if (rt.def.id === 'CR01') return [CR01_PAVED[0] - 0.5, CR01_PAVED[1], ...FOOT.RD03.slice(2)]; return f ? [f[0], f[1], f[2], f[3]] : [-Infinity, Infinity, -Infinity, Infinity]; };
  for (const rt of D.routes) {
    const st = rt.strip, mesh = meshByName.get('road:' + st.name); if (!mesh) { stripCheck.push({ route: rt.def.id, mesh: false }); continue; }
    const g = mesh.geometry, gp = g.attributes.position.array, gi = g.index ? g.index.array : null;
    let same = mesh.matrixWorld.equals(I) && gi && gp.length === st.pos.length && gi.length === st.index.length;
    if (same) { for (let k = 0; k < gp.length && same; k++) if (gp[k] !== st.pos[k]) same = false; for (let k = 0; k < gi.length && same; k++) if (gi[k] !== st.index[k]) same = false; }
    stripCheck.push({ route: rt.def.id, mesh: true, same, offsets: !!st.clipOffset });
    if (!same || !st.clipOffset) continue;
    const Pp = st.pos, O = st.clipOffset, PV = st.clipPaved, isRing = rt.def.id === 'CR01';
    for (let t = 0; t < st.index.length; t += 3) {
      const ids = [st.index[t], st.index[t + 1], st.index[t + 2]], v = ids.map(k => [Pp[k * 3], Pp[k * 3 + 1], Pp[k * 3 + 2]]);
      if (!v.some(p => nearBand(p[0], p[2]))) continue;
      const tri = { v, o: ids.map(k => O[k]), pl: ids.map(k => (isRing ? CR01_PAVED[0] : PV[k * 2])), pr: ids.map(k => (isRing ? CR01_PAVED[1] : PV[k * 2 + 1])), rt, id: rt.def.id, name: 'road:' + st.name };
      tri.box = [Math.min(v[0][0], v[1][0], v[2][0]), Math.max(v[0][0], v[1][0], v[2][0]), Math.min(v[0][2], v[1][2], v[2][2]), Math.max(v[0][2], v[1][2], v[2][2])];
      roadTris.push(tri);
      for (let x = Math.floor(tri.box[0]); x <= Math.floor(tri.box[1]); x++) for (let z = Math.floor(tri.box[2]); z <= Math.floor(tri.box[3]); z++) { const k = `${x},${z}`; let a = roadCells.get(k); if (!a) roadCells.set(k, a = []); a.push(tri); }
    }
  }
  // the zone of a road point: paved (its row's paved range), shoulder, ditch (to the full section's edge), verge (the strip beyond, lying on the ground)
  const zoneAt = (tri, w, x, z) => { const o = w[0] * tri.o[0] + w[1] * tri.o[1] + w[2] * tri.o[2], pl = w[0] * tri.pl[0] + w[1] * tri.pl[1] + w[2] * tri.pl[2], pr = w[0] * tri.pr[0] + w[1] * tri.pr[1] + w[2] * tri.pr[2];
    if (o >= pl - 1e-4 && o <= pr + 1e-4) return { zone: 'paved', o };
    const fr = routeFrame(tri.rt)(x, z), f = footOf(tri.rt, fr ? fr.i : 0);
    return { zone: o >= f[0] - 1e-4 && o <= f[1] + 1e-4 ? 'shoulder' : o >= f[2] - 1e-4 && o <= f[3] + 1e-4 ? 'ditch' : 'verge', o, s: fr ? fr.s : null }; };
  const roadsAt = (x, z) => { const out = []; for (const t of roadCells.get(key(x, z)) || []) { const w = bary(x, z, t.v); if (w) out.push({ t, w, y: w[0] * t.v[0][1] + w[1] * t.v[1][1] + w[2] * t.v[2][1] }); } return out; };
  let hash = 2166136261; const mix = v => { hash ^= v; hash = Math.imul(hash, 16777619) >>> 0; };
  { const ms = [...meshByName.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)), f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
    for (const o of ms) { const p = o.geometry.attributes.position.array, ix = o.geometry.index ? o.geometry.index.array : []; for (let i = 0; i < p.length; i++) { f32[0] = p[i]; mix(u32[0]); } for (let i = 0; i < ix.length; i++) mix(ix[i]); mix(p.length); } }
  const roadHash = hash.toString(16);

  // ---- probes: round the ring, and the arms at the ten junctions
  const ring = D.routes.find(r => r.def.id === 'CR01'), RS = ring.samples;
  const rowPoint = (rt, i, o) => { const f = rt.flatOf[i], Tg = rt.tangent[i], sc = o * rt.cf[i] * f.k; return [f.x - Tg[1] * sc, f.z + Tg[0] * sc]; };
  const atS = (rt, s) => { const Sm = rt.samples; let i = 0; while (i + 2 < Sm.length && Sm[i + 1].s < s) i++; return { i, t: Math.max(0, Math.min(1, (s - Sm[i].s) / Math.max(1e-9, Sm[i + 1].s - Sm[i].s))) }; };
  const pointAt = (rt, s, o) => { const { i, t } = atS(rt, s), a = rowPoint(rt, i, o), b = rowPoint(rt, i + 1, o); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  const probes = [];
  const outsideTown = (x, z) => Math.max(Math.abs(x), Math.abs(z)) > TOWN + 1e-6 && inBand(x, z);           // (objects are taken 6 m beyond the probes' band)
  for (let s = RS[0].s + STEP / 2; s < RS[RS.length - 1].s; s += STEP) for (let o = -6 + STEP / 2; o < 6; o += STEP) { const [x, z] = pointAt(ring, s, o); if (outsideTown(x, z)) probes.push({ set: 'ring', s: +s.toFixed(3), o: +o.toFixed(3), x, z }); }
  const flatLL = n => [R * n.lon * Math.PI / 180, -R * Math.asinh(Math.tan(n.lat * Math.PI / 180))];
  const ringJunctions = D.junctions.filter(j => j.kind === 'CR01'), nodeXZ = ringJunctions.map(j => flatLL(window.WORLD.roadNetwork.nodeById[j.node]));
  for (const j of ringJunctions) {
    const nx = flatLL(window.WORLD.roadNetwork.nodeById[j.node]);
    for (const id of j.routes) { if (id === 'CR01') continue; const rt = D.routes.find(r => r.def.id === id); if (!rt) continue;
      const Sm = rt.samples, near = Sm.map((p, i) => i).filter(i => Math.hypot(rt.flatOf[i].x - nx[0], rt.flatOf[i].z - nx[1]) <= 14); if (!near.length) continue;
      const s0 = Sm[Math.min(...near)].s, s1 = Sm[Math.max(...near)].s, g0 = Math.floor(rt.grid[0]) - 1, g1 = Math.ceil(rt.grid[rt.grid.length - 1]) + 1;
      for (let s = s0 + STEP / 2; s < s1; s += STEP) for (let o = g0 + STEP / 2; o < g1; o += STEP) { const [x, z] = pointAt(rt, s, o); if (outsideTown(x, z)) probes.push({ set: 'junction', node: j.node, route: id, s: +s.toFixed(3), o: +o.toFixed(3), x, z }); } }
  }
  // the road at each probe (flat): the top road surface there, its route and zone
  for (const q of probes) { const r = roadsAt(q.x, q.z); q.xd = B.wrapX(q.x); q.xo = orig(q.x);
    if (r.length) { const top = r.reduce((a, b) => (b.y > a.y ? b : a)), z = zoneAt(top.t, top.w, q.x, q.z); q.road = top.t.id; q.roadY = top.y; q.zone = z.zone; q.ro = +z.o.toFixed(3); q.roads = r.length; } else { q.road = null; q.roadY = null; q.zone = null; } }

  // ---- the uncut lattice (terrain chunks before any cut), for the ground reference
  const refCells = new Map(), want = new Set(); for (const q of probes) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) want.add(key(q.xo + dx, q.z + dz));
  for (const c of [...TS.ringData, ...(TS.restData || [])]) for (const index of [c.ringIndex, c.restIndex]) if (index) for (let t = 0; t + 2 < index.length; t += 3) {
    const v = [0, 1, 2].map(k => [c.pos[index[t + k] * 3], c.pos[index[t + k] * 3 + 1], c.pos[index[t + k] * 3 + 2]]);
    for (let x = Math.floor(Math.min(v[0][0], v[1][0], v[2][0])); x <= Math.floor(Math.max(v[0][0], v[1][0], v[2][0])); x++) for (let z = Math.floor(Math.min(v[0][2], v[1][2], v[2][2])); z <= Math.floor(Math.max(v[0][2], v[1][2], v[2][2])); z++) { const k = `${x},${z}`; if (!want.has(k)) continue; let a = refCells.get(k); if (!a) refCells.set(k, a = []); a.push(v); }
  }
  for (const q of probes) for (const v of refCells.get(key(q.xo, q.z)) || []) { const w = bary(q.xo, q.z, v, 1e-7); if (!w) continue; const dx = q.xd - q.xo, tri = v.map(p => [p[0] + dx, p[1], p[2]]), y = w[0] * v[0][1] + w[1] * v[1][1] + w[2] * v[2][1];
    const e = [0, 1, 2].map(k => { const a = tri[k], b = tri[(k + 1) % 3], l = Math.hypot(a[0] - b[0], a[2] - b[2]); return { l, g: Math.abs(a[1] - b[1]) / Math.max(l, 1e-9) }; });
    q.ref = { tri, w, y, edge: Math.max(...e.map(k => k.l)), slope: Math.max(...e.map(k => k.g)) }; break; }

  // ---- what every displayed object is
  const topOf = o => { let p = o; while (p.parent && p.parent !== S.scene) p = p.parent; return p; };
  const labelOf = o => { for (let p = o; p && p !== S.scene; p = p.parent) if (p.name) return p.name; return o.type; };
  const townRoots = new Set(S.town.roots);
  const PLANT = /^(cover|sec|road):(tuft|weed|seedling|flower|shrubLow|shrub|fern|sapling|reed|grass|moss)(:ink)?$/, GROUND = /^(cover:(plots|ridges|ice|lava|dunes|town-edge|terrace-treads)|sec:plots|lm\d\d(Ground|Sando|Ice|Lawn).*)$/;
  const catOf = o => {
    if (terrainMeshes.has(o)) return 'terrain';
    if (roadNames.test(o.name)) return 'road';
    const label = labelOf(o), top = topOf(o);
    if (PLANT.test(label)) return /^road:/.test(label) ? 'roadPlant' : 'plant';
    if (GROUND.test(label) || (top.name && GROUND.test(top.name))) return 'ground';
    if (/^streetlights/.test(top.name) || /^road:/.test(label) || top.name === 'roads') return 'furniture';
    if (/^lm\d\d/.test(top.name) || /^lm\d\d/.test(label)) return 'landmark';
    if (/^sec:/.test(label) || top.name === 'section') return 'section';
    if (townRoots.has(top)) return 'town';
    if (/^cover:/.test(label)) return 'cover';
    return 'other';
  };
  const opaque = o => { const mats = Array.isArray(o.material) ? o.material : [o.material]; if (mats.some(m => m && m.userData && (m.userData.noBend || m.userData.noWrap))) return false;
    return !mats.every(m => !m || (m.transparent && (m.depthWrite === false || m.opacity <= 0)) || m.blending === T.AdditiveBlending || m.colorWrite === false || m.visible === false); };
  // the flat-frame triangles of every opaque object near the band (instances expanded)
  const objects = [];
  S.scene.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !visible(o) || !opaque(o)) return;
    const cat = catOf(o), label = labelOf(o), g = o.geometry, pos = g.attributes.position, ix = g.index, count = ix ? ix.count : pos.count;
    if (!g.boundingSphere) g.computeBoundingSphere(); const rad = g.boundingSphere.radius, gc = g.boundingSphere.center;
    const mats = o.isInstancedMesh ? Array.from({ length: o.count }, (_, i) => { o.getMatrixAt(i, M4); return M4.clone().premultiply(o.matrixWorld); }) : [o.matrixWorld];
    mats.forEach((mw, inst) => {
      wv.copy(gc).applyMatrix4(mw); const sc = mw.getMaxScaleOnAxis() * rad;
      if (Math.abs(wv.x) - sc > BAND + 8 || Math.abs(wv.z) - sc > BAND + 8) return;
      const moved = !mw.equals(I), V = new Float64Array(pos.count * 3);
      for (let n = 0; n < pos.count; n++) { if (moved) { wv.set(pos.getX(n), pos.getY(n), pos.getZ(n)).applyMatrix4(mw); V[n * 3] = wv.x; V[n * 3 + 1] = wv.y; V[n * 3 + 2] = wv.z; } else { V[n * 3] = pos.getX(n); V[n * 3 + 1] = pos.getY(n); V[n * 3 + 2] = pos.getZ(n); } }
      const tris = []; for (let t = 0; t + 2 < count; t += 3) { const a = ix ? ix.getX(t) : t, b = ix ? ix.getX(t + 1) : t + 1, c = ix ? ix.getX(t + 2) : t + 2; const v = [a, b, c].map(k => [V[k * 3], V[k * 3 + 1], V[k * 3 + 2]]); if (v.some(p => nearBand(p[0], p[2]))) tris.push(v); }
      if (tris.length) objects.push({ mesh: o, cat, label, inst: o.isInstancedMesh ? inst : null, tris, V });
    });
  });
  const stats = { objects: {} }; for (const ob of objects) { const k = ob.cat; stats.objects[k] = (stats.objects[k] || 0) + 1; }

  // ---- I3 plants by their whole shape, I4 structures by their triangles, against the final road triangles (flat frame)
  const roadOverlap = poly => { const box = [Math.min(...poly.map(p => p[0])), Math.max(...poly.map(p => p[0])), Math.min(...poly.map(p => p[1])), Math.max(...poly.map(p => p[1]))], seen = new Set(), out = [];
    for (let x = Math.floor(box[0]); x <= Math.floor(box[1]); x++) for (let z = Math.floor(box[2]); z <= Math.floor(box[3]); z++) for (const t of roadCells.get(`${x},${z}`) || []) { if (seen.has(t)) continue; seen.add(t); if (t.box[1] < box[0] || t.box[0] > box[1] || t.box[3] < box[2] || t.box[2] > box[3]) continue;
      const q = clip(poly, t.v.map(p => [p[0], p[2]])), a = areaOf(q); if (a <= 0) continue; const c = q.reduce((s, p) => [s[0] + p[0] / q.length, s[1] + p[1] / q.length], [0, 0]), w = bary(c[0], c[1], t.v, 1e-6); if (!w) continue;
      if (Math.max(Math.abs(c[0]), Math.abs(c[1])) <= TOWN + 1e-6) continue;                     // the town's own streets are not this check's (the connectors from the town edge are)
      if (t.id !== 'CR01' && !nodeXZ.some(n => Math.hypot(c[0] - n[0], c[1] - n[1]) <= 14)) continue;   // the ring and the arms of its ten junctions (the probes' domain)
      out.push({ a, zone: zoneAt(t, w, c[0], c[1]).zone, route: t.id, y: w[0] * t.v[0][1] + w[1] * t.v[1][1] + w[2] * t.v[2][1], c }); }
    return out; };
  const ringFrame = routeFrame(ring);
  const ringClear = (x, z) => { const fr = ringFrame(x, z); if (!fr || fr.d2 > 100) return null; // the lateral offset of a point from the ring's centre line (true metres) against the paving
    const i = fr.i, f = ring.flatOf[i], Tg = ring.tangent[i], o = ((x - f.x) * -Tg[1] + (z - f.z) * Tg[0]) / (ring.cf[i] * f.k); return { o, d: o < CR01_PAVED[0] ? CR01_PAVED[0] - o : o > CR01_PAVED[1] ? o - CR01_PAVED[1] : 0, s: fr.s }; };
  const plants = [], structures = new Map();
  for (const ob of objects) {
    if (ob.cat === 'plant' || ob.cat === 'roadPlant') {
      const pts = []; for (const tr of ob.tris) for (const p of tr) pts.push([p[0], p[2]]); const h = hull(pts); if (h.length < 3) continue;
      const ov = roadOverlap(h); if (!ov.length) continue;
      const byZone = {}; for (const q of ov) byZone[q.zone] = (byZone[q.zone] || 0) + q.a;
      const ys = ob.tris.flat().map(p => p[1]), c = h.reduce((s, p) => [s[0] + p[0] / h.length, s[1] + p[1] / h.length], [0, 0]), rc = ringClear(c[0], c[1]);
      plants.push({ label: ob.label, cat: ob.cat, inst: ob.inst, x: +c[0].toFixed(3), z: +c[1].toFixed(3), ring: rc ? { s: +rc.s.toFixed(2), o: +rc.o.toFixed(3) } : null, byZone: Object.fromEntries(Object.entries(byZone).map(([k, v]) => [k, +v.toFixed(6)])), routes: [...new Set(ov.map(q => q.route))], top: +Math.max(...ys).toFixed(3), base: +Math.min(...ys).toFixed(3) });
    } else if (['landmark', 'section', 'town', 'furniture', 'cover', 'other'].includes(ob.cat)) {
      const id = ob.inst === null ? `${ob.label}#${ob.mesh.id}` : `${ob.label}[${ob.inst}]`;
      let rec = structures.get(id);
      if (!rec) structures.set(id, rec = { id, label: ob.label, cat: ob.cat, byZone: {}, minAbove: {}, clear: Infinity, clearAt: null, box: [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity] });
      for (const tr of ob.tris) {
        for (const p of tr) { rec.box[0] = Math.min(rec.box[0], p[0]); rec.box[1] = Math.max(rec.box[1], p[0]); rec.box[2] = Math.min(rec.box[2], p[1]); rec.box[3] = Math.max(rec.box[3], p[1]); rec.box[4] = Math.min(rec.box[4], p[2]); rec.box[5] = Math.max(rec.box[5], p[2]);
          const rc = ringClear(p[0], p[2]); if (rc && rc.d < rec.clear) { rec.clear = rc.d; rec.clearAt = [+p[0].toFixed(3), +p[1].toFixed(3), +p[2].toFixed(3), +rc.s.toFixed(2), +rc.o.toFixed(3)]; } }
        const poly = tr.map(p => [p[0], p[2]]); if (areaOf(poly) < 1e-7) continue;
        const ov = roadOverlap(poly); if (!ov.length) continue;
        const den = (tr[1][2] - tr[2][2]) * (tr[0][0] - tr[2][0]) + (tr[2][0] - tr[1][0]) * (tr[0][2] - tr[2][2]);
        // only what rises above the road surface there (a part under the road is hidden by it: the town's base slab, a field below the road)
        for (const q of ov) {
          const w0 = ((tr[1][2] - tr[2][2]) * (q.c[0] - tr[2][0]) + (tr[2][0] - tr[1][0]) * (q.c[1] - tr[2][2])) / den, w1 = ((tr[2][2] - tr[0][2]) * (q.c[0] - tr[2][0]) + (tr[0][0] - tr[2][0]) * (q.c[1] - tr[2][2])) / den, y = w0 * tr[0][1] + w1 * tr[1][1] + (1 - w0 - w1) * tr[2][1];
          const above = altOf(y, q.c[1]) - altOf(q.y, q.c[1]); if (above <= 1e-3) continue;
          rec.byZone[q.zone] = (rec.byZone[q.zone] || 0) + q.a; rec.minAbove[q.zone] = Math.min(rec.minAbove[q.zone] ?? Infinity, above); (rec.routes = rec.routes || new Set()).add(q.route); }
      }
    }
  }
  const structureList = [...structures.values()].filter(r => r.clear < 3 || Object.keys(r.byZone).length).map(r => ({ ...r, clear: r.clear === Infinity ? null : +r.clear.toFixed(3), box: r.box.map(v => +v.toFixed(2)), byZone: Object.fromEntries(Object.entries(r.byZone).map(([k, v]) => [k, +v.toFixed(6)])), minAbove: Object.fromEntries(Object.entries(r.minAbove).map(([k, v]) => [k, +v.toFixed(3)])), routes: r.routes ? [...r.routes] : [] }));

  // ---- the rays, per bend state
  const interest = new Set(probes.map(q => key(q.xd, q.z)));
  const sigMeshes = [...TS.ring, ...TS.rest, ...meshByName.values()]; S.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && GROUND.test(labelOf(o))) sigMeshes.push(o); });
  const signature = () => sigMeshes.map(m => [m.uuid, m.geometry.uuid, m.geometry.index ? m.geometry.index.count : 0, m.geometry.attributes.position.count, visible(m)].join(':')).join('|');
  const labels = [], labelId = new Map(), lid = (cat, label) => { const k = cat + '|' + label; let i = labelId.get(k); if (i === undefined) { i = labels.length; labels.push([cat, label]); labelId.set(k, i); } return i; };
  const out = { modes: {}, labels, stripCheck, roadHash, roadTriangles: roadTris.length, junctions: ringJunctions.map(j => j.node), stats, plants, structures: structureList };
  try { const gl = S.renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); out.renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { out.renderer = null; }
  for (const u of modes) {
    B.set(u); await frame(); await frame(); S.scene.updateMatrixWorld(true);
    const bend = p => (u ? B.point(p[0], p[1], p[2], u) : p), cells = new Map(); let triangles = 0;
    // (the objects' flat triangles were taken at uBend 0; the town's sphere copy is a tessellation of the same surfaces, and the band holds only its edge)
    for (const ob of objects) { const id = lid(ob.cat, ob.label), terr = ob.cat === 'terrain', road = ob.cat === 'road';
      for (const v0 of ob.tris) { const v = v0.map(p => [B.wrapX(p[0]), p[1], p[2]]), x0 = Math.floor(Math.min(v[0][0], v[1][0], v[2][0])), x1 = Math.floor(Math.max(v[0][0], v[1][0], v[2][0])), z0 = Math.floor(Math.min(v[0][2], v[1][2], v[2][2])), z1 = Math.floor(Math.max(v[0][2], v[1][2], v[2][2]));
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 2500) continue; let tri = null;
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = `${x},${z}`; if (!interest.has(k)) continue; if (!tri) tri = { b: v.map(bend), id, terr, road, cat: ob.cat }; let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(tri); triangles++; } } }
    const res = { triangles, signature: signature(), first: [], dRoad: [], dRef: [], terr: [], tol: [] };
    for (const q of probes) {
      const list = cells.get(key(q.xd, q.z)) || [], baseY = q.ref ? q.ref.y : (q.roadY ?? 0), top = Math.max(baseY, q.roadY ?? -1e9) + 30, A = bend([q.xd, top, q.z]), Z = bend([q.xd, baseY - 1, q.z]), dl = Math.hypot(...sub(Z, A)), dir = sub(Z, A).map(v => v / dl);
      let tRef = null, tol = 0.002, chord = 0;
      if (q.ref) { const bt = q.ref.tri.map(bend); let t = rayHit(A, dir, ...bt); if (t === null) { const Zw = [0, 1, 2].map(k => bt.reduce((s, p, i) => s + q.ref.w[i] * p[k], 0)); t = dot(sub(Zw, A), dir); } tRef = t; chord = u * q.ref.edge * q.ref.edge * (1 + 2 * q.ref.slope) / (4 * R); tol += chord; }
      let first = null, road = null, terr = null;
      for (const tri of list) { const t = rayHit(A, dir, ...tri.b); if (t === null || t > dl + 2) continue; if (!first || t < first.t) first = { t, tri }; if (tri.road && (!road || t < road.t)) road = { t }; if (tri.terr && (!terr || t < terr.t)) terr = { t }; }
      res.first.push(first ? first.tri.id : -1);
      res.dRoad.push(first && road ? +(road.t - first.t).toFixed(5) : null);
      res.dRef.push(first && tRef !== null ? +(first.t - tRef).toFixed(5) : null);
      res.terr.push(terr && tRef !== null ? +(terr.t - tRef).toFixed(5) : null);
      res.tol.push(+(tol).toFixed(5));
    }
    out.modes[u] = res;
  }
  B.set(0); await frame();
  out.probes = probes.map(({ xd, xo, ref, roadY, ...q }) => ({ ...q, x: +q.x.toFixed(3), z: +q.z.toFixed(3), roadY: roadY === null ? null : +roadY.toFixed(4), ref: !!ref }));
  return out;
}

// ---------------------------------------------------------------- run and judge
const browser = await chromium.launch({ args: soft ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=metal', '--ignore-gpu-blocklist'] });
let data, errors = [];
const t0 = Date.now();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(html).href + '?quality=high');
  await page.waitForFunction(() => window.__scene && window.__scene.worldgen && window.__scene.worldgen.state.done && window.__scene.worldgen.state.firstFrameAt !== null, null, { timeout: 240000, polling: 200 });
  data = await page.evaluate(probe, { modes: [0, 0.5, 1], STEP: 0.25 });
} finally { await browser.close(); cleanup(); }

const MODES = Object.keys(data.modes), PR = data.probes, L = data.labels, f = (v, n = 3) => (typeof v === 'number' ? v.toFixed(n) : String(v));
const where = q => `${q.set === 'ring' ? 'CR01' : `${q.node}/${q.route}`} s=${f(q.s, 2)} o=${f(q.o, 2)} (${f(q.x, 2)}, ${f(q.z, 2)})`;
// PAVED: the paving and the shoulder; SECTION: the full section (to the ditch's outer lip). HEADROOM: a lamp arm or head this high over the road is the
// road's; CLEARANCE: the clear height over a carriageway (Japanese 建築限界 4.5 m), a building part over the paving any lower stands in the road.
// PENDING: the LM09 east end lies where the user's W10b decision A put it (W10_SPEC 2026-10-11: the platform east end 4.5 m shorter, the buffer stop on the
// west side of CR01); what of it still reaches a road section is listed for the user's decision, not failed (CR01_HOUSE_GRASS_INTRUSION_PLAN.md 3).
const PAVED = new Set(['paved', 'shoulder']), SECTION = new Set(['paved', 'shoulder', 'ditch']), HEADROOM = 2.5, CLEARANCE = 4.5, TOL_AREA = 1e-5, PENDING = /^lm09/;
const pending = label => PENDING.test(label), TREE = /^lm\d\dTree$|^(cover|sec):(treeRound|cedar|pine|bamboo)(_far)?(:ink)?$/;
const summary = { commit, ref, html: path.relative(root, html), files, errors, renderer: data.renderer, ms: Date.now() - t0, roadHash: data.roadHash, roadTriangles: data.roadTriangles, junctions: data.junctions, objects: data.stats.objects,
  stripCheck: { routes: data.stripCheck.length, mismatched: data.stripCheck.filter(s => s.mesh && !s.same).map(s => s.route), noOffsets: data.stripCheck.filter(s => s.mesh && s.same && !s.offsets).map(s => s.route) }, probes: { total: PR.length, ring: PR.filter(q => q.set === 'ring').length, junction: PR.filter(q => q.set === 'junction').length, byZone: {} }, modes: {} };
for (const q of PR) { const z = q.zone || 'ground'; summary.probes.byZone[z] = (summary.probes.byZone[z] || 0) + 1; }
const fails = { I1: [], I2: [], I5: [], crack: [] }, addF = (k, m) => { if (fails[k].length < 400) fails[k].push(m); };
const keyOf = q => `${q.set}:${q.node || ''}:${q.route || ''}:${q.s}:${q.o}`;
const failed = { I1: new Map(), I2: new Map(), I5: new Map(), crack: new Map() }, note = (k, q, u, why) => { const id = keyOf(q); let r = failed[k].get(id); if (!r) failed[k].set(id, r = { q, modes: {} }); r.modes[u] = why; };
const tally = (o, k) => { o[k] = (o[k] || 0) + 1; };
for (const u of MODES) {
  const M = data.modes[u], st = summary.modes[u] = { triangles: M.triangles, I1: { probes: 0, fail: 0, by: {}, road: {}, pending: {}, cracks: 0 }, I2: { probes: 0, fail: 0, by: {}, verge: {} }, I5: { probes: 0, holes: 0, holeArea: 0, blocked: {} } };
  PR.forEach((q, i) => {
    const fid = M.first[i], fl = fid >= 0 ? L[fid] : null, dRoad = M.dRoad[i], tol = M.tol[i], margin = 1e-3 + (tol - 0.002);
    if (q.road) {
      // the first opaque surface over the road, when it is not the road and nearer than the road by more than the margin
      const over = fl && fl[0] !== 'road' && dRoad !== null && dRoad > margin ? { cat: fl[0], label: fl[1], d: dRoad } : null, noRoad = dRoad === null;
      if (PAVED.has(q.zone)) {
        st.I1.probes++;
        // the road's own furniture (barriers, posts, lamps: an arm or a head overhead) and its own edge weeds (roadkit.js: the wear along the paved edge) are
        // the road's; the LM09 east end is listed for the user's decision
        if (over && (over.cat === 'furniture' || over.cat === 'roadPlant')) tally(st.I1.road, `${over.label}${over.cat === 'furniture' && over.d >= HEADROOM ? '（高处）' : ''}`);
        else if (over && pending(over.label)) tally(st.I1.pending, over.label);
        else if (over) { st.I1.fail++; tally(st.I1.by, `${over.cat}:${over.label}`); note('I1', q, u, `${over.cat} ${over.label} 高出路面 ${f(over.d, 4)} m`); }
        else if (noRoad) { st.I1.cracks++; note('crack', q, u, fl ? `只命中 ${fl[1]}` : '无命中'); }
      }
      if (SECTION.has(q.zone)) { st.I2.probes++; if (over && ['terrain', 'ground'].includes(over.cat)) { st.I2.fail++; tally(st.I2.by, `${over.cat}:${over.label}:${q.zone}`); note('I2', q, u, `${over.cat} ${over.label} 高出 ${q.zone} ${f(over.d, 4)} m`); } }
      else if (q.zone === 'verge' && over && ['terrain', 'ground'].includes(over.cat)) tally(st.I2.verge, `${over.cat}:${over.label}`);
    } else if (q.ref) {
      st.I5.probes++;
      const dRef = M.dRef[i];
      // a hole: nothing opaque at or above the uncut ground (the ray goes through to below it or hits nothing)
      if (!fl || dRef === null || dRef > tol) { st.I5.holes++; st.I5.holeArea += 0.0625; note('I5', q, u, fl ? `第一个面低于原地形 ${f(dRef, 3)} m：${fl[1]}` : '无命中'); }
      else if (dRef < -0.3) tally(st.I5.blocked, `${fl[0]}:${fl[1]}`);
    }
  });
  st.I5.holeArea = +st.I5.holeArea.toFixed(4);
}
for (const k of ['I1', 'I2', 'I5', 'crack']) for (const [, r] of failed[k]) addF(k, `${where(r.q)} ${r.q.zone || 'ground'}${r.q.road ? ` ${r.q.road}` : ''}：${Object.entries(r.modes).map(([u, w]) => `u${u} ${w}`).join('；')}`);
// I3: plants by their whole shape: a foreign plant in a road's full section fails; a road's own edge plants are listed
const zoneArea = (p, set) => Object.entries(p.byZone).filter(([z]) => set.has(z)).reduce((s, [, a]) => s + a, 0);
const foreign = data.plants.filter(p => p.cat === 'plant' && zoneArea(p, SECTION) > TOL_AREA), own = data.plants.filter(p => p.cat === 'roadPlant' && zoneArea(p, SECTION) > TOL_AREA);
const plantLine = p => `${p.label}[${p.inst}] (${f(p.x, 2)}, ${f(p.z, 2)})${p.ring ? ` CR01 s=${p.ring.s} o=${p.ring.o}` : ''} ${Object.entries(p.byZone).map(([z, a]) => `${z} ${f(a, 4)} m²`).join(' ')} 顶 ${p.top}`;
// I4: structures. A building part over a paved zone lower than CLEARANCE fails; over the shoulder or the ditch, over the verge and high over the paving it is
// listed with its least height; a tree's crown and road furniture are listed; the LM09 east end is pending
const isBuilding = r => ['landmark', 'section', 'town', 'other', 'cover'].includes(r.cat) && !TREE.test(r.label), low = (r, z) => r.byZone[z] > TOL_AREA && r.minAbove[z] < CLEARANCE;
const blds = data.structures.filter(isBuilding), bldFail = blds.filter(r => low(r, 'paved') && !pending(r.label)), bldPending = blds.filter(r => pending(r.label) && Object.keys(r.byZone).some(z => SECTION.has(z)));
const bldSection = blds.filter(r => !pending(r.label) && !low(r, 'paved') && ['shoulder', 'ditch'].some(z => r.byZone[z] > TOL_AREA)), bldHigh = blds.filter(r => !pending(r.label) && r.byZone.paved > TOL_AREA && !low(r, 'paved'));
const trees = data.structures.filter(r => TREE.test(r.label) && Object.keys(r.byZone).length), furn = data.structures.filter(r => r.cat === 'furniture'), furnLow = furn.filter(r => low(r, 'paved'));
const sLine = r => `${r.id}（${r.cat}）${Object.entries(r.byZone).map(([z, a]) => `${z} ${f(a, 4)} m² 最低高出路面 ${f(r.minAbove[z], 2)} m`).join('，') || '无交叠'}；离 CR01 铺装最近 ${r.clear === null ? '—' : f(r.clear, 2) + ' m'}${r.clearAt ? ` @(${r.clearAt.slice(0, 3).join(', ')}) s=${r.clearAt[3]} o=${r.clearAt[4]}` : ''}${r.routes && r.routes.length ? `；道路 ${r.routes.join('、')}` : ''}`;
// I6
const sig = MODES.map(u => data.modes[u].signature), same = sig.every(s => s === sig[0]);
let base = null, baseCmp = null, newHoles = null, newCracks = null;
if (baselineFile) {
  base = JSON.parse(fs.readFileSync(path.resolve(root, baselineFile), 'utf8'));
  baseCmp = { roadHash: [base.roadHash, data.roadHash], files: Object.fromEntries(['layout.js', 'world.js', 'bend.js'].map(k => [k, base.files && base.files[k] === files[k]])), counts: base.counts };
  const before = new Set(base.holes || []); newHoles = [...failed.I5.keys()].filter(k => !before.has(k));
  const cracksBefore = new Set(base.cracks || []); newCracks = [...failed.crack.keys()].filter(k => !cracksBefore.has(k));
}
summary.baseline = baseCmp;
const zoneLine = () => Object.entries(summary.probes.byZone).map(([k, v]) => `${k} ${v}`).join('、');
console.log(`  探针 ${PR.length}（环 ${summary.probes.ring}、十路口 ${summary.probes.junction}；${zoneLine()}）；道路三角形 ${data.roadTriangles}；平面道路网格与计划条带一致 ${summary.stripCheck.mismatched.length ? '否：' + summary.stripCheck.mismatched.join('、') : '是'}；对象 ${JSON.stringify(data.stats.objects)}；渲染器 ${data.renderer}`);
for (const u of MODES) { const s = summary.modes[u]; console.log(`  · uBend ${u}：铺装/路肩 ${s.I1.probes} 点中首命中非道路 ${s.I1.fail}${s.I1.fail ? ' ' + JSON.stringify(s.I1.by) : ''}（道路自身设施与路沿杂草 ${JSON.stringify(s.I1.road)}；待裁决 ${JSON.stringify(s.I1.pending)}）；断面内地面压路 ${s.I2.fail}${s.I2.fail ? ' ' + JSON.stringify(s.I2.by) : ''}；道路草肩上的地面 ${JSON.stringify(s.I2.verge)}；路外地面 ${s.I5.probes} 点中空洞 ${s.I5.holes}（约 ${f(s.I5.holeArea, 3)} m²）`); }
check('I1', !fails.I1.length && !(newCracks && newCracks.length), `铺装与路肩首个不透明面为道路（或道路自身设施、路沿杂草）${fails.I1.length ? `；例：${fails.I1.slice(0, 8).join('；')}` : ''}；路面无命中（裂缝）${MODES.map(u => `u${u} ${summary.modes[u].I1.cracks}`).join('、')}${newCracks ? `，对照基线新增 ${newCracks.length}` : '（未给 --baseline，只列数）'}${fails.crack.length ? `：${fails.crack.slice(0, 4).join('；')}` : ''}`);
check('I2', !fails.I2.length, `断面内（铺装、路肩、边沟）没有地形或地面覆盖高出路面${fails.I2.length ? `；例：${fails.I2.slice(0, 8).join('；')}` : ''}`);
check('I3', !foreign.length, `植物实例（完整外形）与道路相交 ${data.plants.length} 个：外来植物入完整断面 ${foreign.length}${foreign.length ? '（' + foreign.slice(0, 10).map(plantLine).join('；') + '）' : ''}；道路自身路沿草簇/杂草在断面内 ${own.length}（设计如此，列出：${own.slice(0, 6).map(plantLine).join('；') || '—'}）`);
check('I4', !bldFail.length, `建筑/地标/断面/城镇实体 ${blds.length} 个在 CR01 3 m 内或与道路相交：在铺装上且低于 ${CLEARANCE} m ${bldFail.length}${bldFail.length ? '（' + bldFail.slice(0, 8).map(sLine).join('；') + '）' : ''}；只在路肩/边沟 ${bldSection.length}${bldSection.length ? '（' + bldSection.map(sLine).join('；') + '）' : ''}；高于 ${CLEARANCE} m 悬于铺装 ${bldHigh.length}${bldHigh.length ? '（' + bldHigh.map(sLine).join('；') + '）' : ''}；树冠 ${trees.length}${trees.length ? '（' + trees.map(sLine).join('；') + '）' : ''}；道路设施与路灯 ${furn.length} 个（悬于铺装上 ${furn.filter(r => r.byZone.paved > TOL_AREA).length}，其中低于 ${CLEARANCE} m ${furnLow.length}，均为道路自身设施，列出不判）`);
if (bldPending.length) console.log(`PENDING I4 LM09 东端（W10b 用户裁决 A 的位置，待用户裁决，不计失败）${bldPending.length} 个：${bldPending.map(sLine).join('；')}`);
check('I5', !(newHoles && newHoles.length), `路外地面空洞：${MODES.map(u => `u${u} ${summary.modes[u].I5.holes}`).join('、')}${newHoles ? `；对照基线新增 ${newHoles.length}${newHoles.length ? '（' + newHoles.slice(0, 8).join('；') + '）' : ''}` : '（未给 --baseline，只列数）'}${fails.I5.length ? `；例：${fails.I5.slice(0, 6).join('；')}` : ''}`);
const i6 = same && !errors.length && !summary.stripCheck.mismatched.length && (!baseCmp || (baseCmp.roadHash[0] === baseCmp.roadHash[1] && Object.values(baseCmp.files).every(Boolean)));
check('I6', i6, `三种弯曲状态地形、道路与地面覆盖网格同一组对象与几何 ${same}；页面错误 ${errors.length}${errors.length ? '（' + errors.slice(0, 3).join(' | ') + '）' : ''}；道路几何哈希 ${data.roadHash}${baseCmp ? `，基线 ${baseCmp.roadHash[0]}（${baseCmp.roadHash[0] === baseCmp.roadHash[1] ? '相同' : '不同'}）；layout.js / world.js / bend.js 与基线相同 ${Object.entries(baseCmp.files).map(([k, v]) => `${k} ${v}`).join('、')}` : '（未给 --baseline，不比较）'}`);
summary.fails = fails; summary.holes = [...failed.I5.keys()]; summary.cracks = [...failed.crack.keys()]; summary.plants = data.plants; summary.structures = data.structures;
summary.counts = { I1: failed.I1.size, I2: failed.I2.size, I3: { foreign: foreign.length, own: own.length }, I4: { fail: bldFail.length, section: bldSection.length, high: bldHigh.length, pending: bldPending.map(r => r.id), trees: trees.length, furniture: furn.length }, I5: failed.I5.size };
if (baseCmp && baseCmp.counts) console.log(`  对照基线：I1 ${baseCmp.counts.I1}→${summary.counts.I1}、I2 ${baseCmp.counts.I2}→${summary.counts.I2}、I3 外来植物 ${baseCmp.counts.I3.foreign}→${summary.counts.I3.foreign}、I4 ${baseCmp.counts.I4.fail ?? baseCmp.counts.I4.buildings}→${summary.counts.I4.fail}、I5 ${baseCmp.counts.I5}→${summary.counts.I5}`);
summary.failedProbes = Object.fromEntries(['I1', 'I2', 'I5', 'crack'].map(k => [k, [...failed[k].values()].slice(0, 3000).map(r => ({ ...r.q, modes: r.modes }))]));
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, JSON.stringify(summary, null, 1));
console.log(`报告：${path.relative(root, reportFile)}（探针 ${PR.length}；HEAD ${commit.slice(0, 7)}；index.html md5 ${files['index.html']}；${f(summary.ms / 1000, 1)} s）`);
console.log(failures ? `${failures} 项未通过` : '全部通过');
process.exit(failures ? 1 : 0);
