// LM09 facility clearance (docs/world/LM09_BRIDGE_FACILITY_FIX_PLAN.md), called by CHECKS.LM09 in tools/landmark_specific.mjs (node tools/landmark_check.mjs LM09).
// The phone box and the bus stop's sign, bench and stop lamp are found by their bake-safe layers (landmarks/LM09.js facility()) and measured on the displayed
// meshes in world coordinates (the flat display frame) against what the scene really built; nothing expected is taken from LM09.js except the layer names and
// the turning circle (stats.circle, stats.circleAt):
//   LF1 identity   every facility is there as its own meshes after the bake; the stop lamp carries its one light pool
//   LF2 paving     the whole facility (base, pole, plates, arm and head, door) in plan is >= 0.5 m from every road's paving near the site: the route strips (checked
//                  equal to the displayed meshes vertex for vertex; paving = a triangle inside its row's paved range, clipOffset / clipPaved), bridge decks and
//                  junction paving; the phone box also keeps its door's 0.9 m swing off that margin
//   LF3 support    under the base (parts below 0.3 m) the station ground (lm09Ground) is there, within 0.05 m of the base, and no road surface (embankment
//                  included) rises above the base: a facility does not stand in a road's cross-section
//   LF4 site       >= 0.3 m from the turning circle (local frame); its ride boxes (scene.js landmarkSolids) >= 0.3 m in plan from the other facilities' and every
//                  other LM09 box whose height range overlaps
//   LF5 ride       no lm09Street ride box lies within 0.5 m of the paving (an obstacle left at the old places would show here)
//   LF6 pool       the stop lamp's pool lies on the station ground: its centre and core (0.45 r) have lm09Ground under them and no road above, centre >= 0.5 m off the paving
//   LF7 display    at uBend 0, 0.5 and 1 (bend.js point, as the vertex shader bends), vertical rays on a 0.1 m lattice over the paving within 13 m of the anchor:
//                  the first opaque surface is a road, never an LM09 object
// No screenshots; the picture is the user's.
export const LAYERS = { sign: 'lm09-bus-sign', bench: 'lm09-bus-bench', lamp: 'lm09-stop-lamp', phone: 'lm09-phone' };
const NAMES = { sign: '站牌', bench: '候车长椅', lamp: '公交站灯', phone: '电话亭' };
const PAVE_CLEAR = 0.5, DOOR_SWING = 0.9, SITE_CLEAR = 0.3, BASE_TOL = 0.05;

async function probe({ layers, circleAt, circleR }) {
  const S = window.__scene, T = window.THREE, B = S.bend, D = S.roads.data(), info = S.landmarks.info.LM09, W = window.WORLD, R = 90, DEG = Math.PI / 180;
  if (!S.worldgen?.state?.done || !D || !info) return { error: '世界生成未完成、没有道路数据或没有 LM09' };
  const lm = W.landmarks.find(q => q.id === 'LM09'), ax = R * lm.lon * DEG, az = -R * Math.asinh(Math.tan(lm.lat * DEG)), cc = 1 / Math.cos(lm.lat * DEG), REACH = 40;
  const near = (x, z) => Math.hypot(x - ax, z - az) <= REACH, key = (x, z) => `${Math.floor(x)},${Math.floor(z)}`;
  const wv = new T.Vector3(), I = new T.Matrix4();
  S.scene.updateMatrixWorld(true);
  // ---- plan geometry (x, z)
  const bary = (x, z, v) => { const [a, b, c] = v, den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-12) return null;
    const w0 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, w1 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den, w2 = 1 - w0 - w1; return Math.min(w0, w1, w2) >= -1e-9 ? [w0, w1, w2] : null; };
  const yAt = (v, w) => w[0] * v[0][1] + w[1] * v[1][1] + w[2] * v[2][1];
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const hull = pts => { const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p; const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1)); };
  const inside = (P, q, tol = 0) => { if (P.length < 3) return false; const s = Math.sign(P.reduce((a, p, i) => a + cross([0, 0], p, P[(i + 1) % P.length]), 0)) || 1;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; if (s * cross(a, b, q) / l < -tol) return false; } return true; };
  const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-18, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); };
  const segCross = (a, b, c, d) => { const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d); return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)); };
  const polyDist = (P, Q) => { if (P.some(p => inside(Q, p)) || Q.some(q => inside(P, q))) return 0; let d = Infinity;
    for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) { const a = P[i], b = P[(i + 1) % P.length], c = Q[j], e = Q[(j + 1) % Q.length]; if (segCross(a, b, c, e)) return 0; d = Math.min(d, segDist(a, c, e), segDist(b, c, e), segDist(c, a, b), segDist(e, a, b)); }
    return d; };
  const bboxOf = P => [Math.min(...P.map(p => p[0])), Math.max(...P.map(p => p[0])), Math.min(...P.map(p => p[1])), Math.max(...P.map(p => p[1]))];
  const index = list => { const m = new Map(); for (const t of list) for (let x = Math.floor(t.box[0]); x <= Math.floor(t.box[1]); x++) for (let z = Math.floor(t.box[2]); z <= Math.floor(t.box[3]); z++) { const k = `${x},${z}`; let a = m.get(k); if (!a) m.set(k, a = []); a.push(t); } return m; };
  const triOf = (v, extra) => ({ v, p2: v.map(p => [p[0], p[2]]), box: [Math.min(v[0][0], v[1][0], v[2][0]), Math.max(v[0][0], v[1][0], v[2][0]), Math.min(v[0][2], v[1][2], v[2][2]), Math.max(v[0][2], v[1][2], v[2][2])], ...extra });
  const meshTris = (o, keep) => { const g = o.geometry, p = g.attributes.position.array, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.length / 3, moved = !o.matrixWorld.equals(I), out = [];
    const V = k => { if (!moved) return [p[k * 3], p[k * 3 + 1], p[k * 3 + 2]]; wv.set(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]).applyMatrix4(o.matrixWorld); return [wv.x, wv.y, wv.z]; };
    for (let t = 0; t + 2 < n; t += 3) { const v = [0, 1, 2].map(j => V(ix ? ix[t + j] : t + j)); if (!keep || v.some(q => keep(q[0], q[2]))) out.push(v); } return { out, V }; };
  const mats = o => (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);
  const additive = o => mats(o).some(m => m.blending === T.AdditiveBlending), opaque = o => !mats(o).every(m => (m.transparent && (m.depthWrite === false || m.opacity <= 0)) || m.blending === T.AdditiveBlending || m.colorWrite === false || m.visible === false);

  // ---- the roads near the site: route strips (= displayed meshes), bridge decks, junction paving
  const shown = new Map(); S.roads.state.root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && /^road:(route |bridge .* top$|junction paving$)/.test(o.name)) shown.set(o.name, o); });
  const roads = [], strips = { checked: [], mismatched: [] };
  for (const rt of D.routes) { const st = rt.strip; if (!st?.index) continue; let any = false; for (let k = 0; k < st.pos.length && !any; k += 3) any = near(st.pos[k], st.pos[k + 2]); if (!any) continue;
    const m = shown.get('road:' + st.name), g = m?.geometry, gp = g?.attributes.position.array, gi = g?.index?.array;
    let same = !!(m && m.matrixWorld.equals(I) && gi && gp.length === st.pos.length && gi.length === st.index.length && st.clipOffset && st.clipPaved);
    for (let k = 0; same && k < gp.length; k++) if (gp[k] !== st.pos[k]) same = false; for (let k = 0; same && k < gi.length; k++) if (gi[k] !== st.index[k]) same = false;
    (same ? strips.checked : strips.mismatched).push(rt.def.id); if (!same) continue;
    const P = st.pos, O = st.clipOffset, PV = st.clipPaved;
    for (let t = 0; t < st.index.length; t += 3) { const ids = [st.index[t], st.index[t + 1], st.index[t + 2]], v = ids.map(k => [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]]); if (!v.some(q => near(q[0], q[2]))) continue;
      roads.push(triOf(v, { id: rt.def.id, paved: ids.every(k => O[k] >= PV[k * 2] - 1e-4 && O[k] <= PV[k * 2 + 1] + 1e-4) })); } }
  for (const [name, o] of shown) { if (/^road:route /.test(name)) continue; for (const v of meshTris(o, near).out) roads.push(triOf(v, { id: name.replace(/^road:/, ''), paved: true })); }
  const paved = roads.filter(t => t.paved), roadCells = index(roads), pavedCells = index(paved);
  const roadTopAt = (x, z) => { let top = null; for (const t of roadCells.get(key(x, z)) || []) { const w = bary(x, z, t.v); if (w) { const y = yAt(t.v, w); if (!top || y > top.y) top = { y, t }; } } return top; };
  const pavedDist = (P, reach = 3) => { const b = bboxOf(P), seen = new Set(); let best = { d: Infinity, id: null };
    for (let x = Math.floor(b[0] - reach); x <= Math.floor(b[1] + reach); x++) for (let z = Math.floor(b[2] - reach); z <= Math.floor(b[3] + reach); z++) for (const t of pavedCells.get(`${x},${z}`) || []) { if (seen.has(t)) continue; seen.add(t);
      const d = polyDist(P, t.p2); if (d < best.d) best = { d, id: t.id }; } return best; };

  // ---- the station ground (lm09Ground: lawn, lane, circle) under a point
  const groundTris = []; for (const g of info.groups) if (g.name === 'lm09Ground') g.traverse(o => { if (o.isMesh && opaque(o)) for (const v of meshTris(o, near).out) groundTris.push(triOf(v, {})); });
  const groundCells = index(groundTris), groundAt = (x, z) => { let y = null; for (const t of groundCells.get(key(x, z)) || []) { const w = bary(x, z, t.v); if (w) { const q = yAt(t.v, w); if (y === null || q > y) y = q; } } return y; };

  // ---- the facilities, by layer
  const street = info.groups.find(g => g.name === 'lm09Street'), fac = {};
  for (const [name, layer] of Object.entries(layers)) {
    const F = fac[name] = { layer, meshes: 0, tris: 0, opaqueTris: 0, pts: [], base: [], low: Infinity, local: [], pools: [] };
    if (street) street.traverse(o => { if (!o.isMesh || o.userData.layer !== layer || !o.geometry?.attributes?.position) return; F.meshes++;
      const l = o.geometry.userData.local, { out, V } = meshTris(o, null), cnt = o.geometry.attributes.position.count;
      if (additive(o)) { F.pools.push({ vs: Array.from({ length: cnt }, (_, k) => V(k)), ls: Array.from({ length: cnt }, (_, k) => [l[k * 3], l[k * 3 + 1], l[k * 3 + 2]]) }); return; }
      F.tris += out.length; if (opaque(o)) F.opaqueTris += out.length;
      for (let k = 0; k < cnt; k++) { const w = V(k); F.pts.push([w[0], w[2]]); F.low = Math.min(F.low, w[1]); if (l) { F.local.push([l[k * 3], l[k * 3 + 1], l[k * 3 + 2]]); if (l[k * 3 + 1] <= 0.3) F.base.push([w[0], w[2]]); } } });
    F.hull = hull(F.pts); F.baseHull = hull(F.base);
  }
  const out = { anchor: [ax, az], cc, strips, roadTris: roads.length, pavedTris: paved.length, groundTris: groundTris.length, facilities: {}, pairs: [], boxes: { lm09: 0, near: [], street: [] } };
  const boxes = (S.ride?.landmarkBoxes || []).filter(b => b.lm === 'LM09');
  out.boxes.lm09 = boxes.length;
  // each LM09 ride box belongs to the facility whose hull holds it (the box of a polygonal cylinder, a pole or an arm, reaches ~0.025 m past the hull of its vertices)
  for (const b of boxes) b.owner = Object.keys(fac).find(n => fac[n].hull.length >= 3 && b.pts.every(p => inside(fac[n].hull, p, 0.05))) || null;
  // two sets of ride boxes: the least plan gap between boxes whose height ranges overlap (a 5 m lamp head over a bicycle is no collision; the flat frame
  // also draws high parts nearer the anchor, scene.js landmark map)
  const boxGap = (A, Bs) => { let best = { d: Infinity, group: null, owner: null }; for (const a of A) for (const b of Bs) { if (!(a.y0 < b.y1 && b.y0 < a.y1)) continue; const d = polyDist(a.pts, b.pts); if (d < best.d) best = { d, group: b.group, owner: b.owner }; } return best; };
  for (const [name, F] of Object.entries(fac)) {
    const r = out.facilities[name] = { layer: F.layer, meshes: F.meshes, tris: F.tris, opaqueTris: F.opaqueTris, pools: F.pools.length };
    if (F.hull.length < 3) continue;
    const c = F.hull.reduce((s, p) => [s[0] + p[0] / F.hull.length, s[1] + p[1] / F.hull.length], [0, 0]); r.centre = c; r.box = bboxOf(F.hull);
    const pd = pavedDist(F.hull, 4); r.paved = { d: pd.d, id: pd.id };
    // LF3: the base samples (hull corners, centre, half-way points)
    const bh = F.baseHull.length >= 3 ? F.baseHull : F.hull, bc = bh.reduce((s, p) => [s[0] + p[0] / bh.length, s[1] + p[1] / bh.length], [0, 0]), samples = [bc, ...bh, ...bh.map(p => [(p[0] + bc[0]) / 2, (p[1] + bc[1]) / 2])];
    const sup = r.support = { samples: samples.length, noGround: 0, gap: [Infinity, -Infinity], roadAbove: 0, roadAt: null };
    for (const [x, z] of samples) { const g = groundAt(x, z), top = roadTopAt(x, z);
      if (g === null) sup.noGround++; else { const d = (F.low - g) / cc; sup.gap[0] = Math.min(sup.gap[0], d); sup.gap[1] = Math.max(sup.gap[1], d); }
      if (top && top.y > F.low + 0.01 * cc) { const d = (top.y - F.low) / cc; if (d > sup.roadAbove) { sup.roadAbove = d; sup.roadAt = { id: top.t.id, paved: top.t.paved, x, z }; } } }
    // LF4: the turning circle in the local frame
    r.circleGap = F.local.length ? Math.min(...F.local.map(p => Math.hypot(p[0] - circleAt[0], p[2] - circleAt[1]))) - circleR : null;
    r.localBox = F.local.length ? [Math.min(...F.local.map(p => p[0])), Math.max(...F.local.map(p => p[0])), Math.min(...F.local.map(p => p[2])), Math.max(...F.local.map(p => p[2])), Math.max(...F.local.map(p => p[1]))] : null;
    const mine = boxes.filter(b => b.owner === name); r.boxes = mine.length; r.otherBox = boxGap(mine, boxes.filter(b => b.owner === null));
    // LF6: the light pool (bilinear over its own quad: s, t in [-1, 1] across the local square)
    if (F.pools.length) { const P = F.pools[0], lx = P.ls.map(q => q[0]), lz = P.ls.map(q => q[2]), x0 = Math.min(...lx), x1 = Math.max(...lx), z0 = Math.min(...lz), z1 = Math.max(...lz), rad = (x1 - x0) / 2;
      const corner = (sx, sz) => { let best = 0, bd2 = Infinity; P.ls.forEach((q, k) => { const d = (q[0] - (sx < 0 ? x0 : x1)) ** 2 + (q[2] - (sz < 0 ? z0 : z1)) ** 2; if (d < bd2) { bd2 = d; best = k; } }); return P.vs[best]; };
      const C = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], at = (s, t) => { const w = [(1 - s) * (1 - t), (1 + s) * (1 - t), (1 + s) * (1 + t), (1 - s) * (1 + t)].map(q => q / 4); return [0, 1, 2].map(k => C.reduce((a, p, i) => a + w[i] * p[k], 0)); };
      const pts = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [0.45 * Math.cos(i * Math.PI / 4), 0.45 * Math.sin(i * Math.PI / 4)])].map(([s, t]) => at(s, t)), cen = pts[0];
      const pool = r.pool = { radius: rad, centreLocal: [(x0 + x1) / 2, (z0 + z1) / 2], points: pts.length, noGround: 0, height: [Infinity, -Infinity], roadAbove: 0, paved: pavedDist([[cen[0], cen[2]], [cen[0] + 1e-4, cen[2]], [cen[0], cen[2] + 1e-4]], 4).d };
      for (const p of pts) { const g = groundAt(p[0], p[2]), top = roadTopAt(p[0], p[2]); if (g === null) pool.noGround++; else { const d = (p[1] - g) / cc; pool.height[0] = Math.min(pool.height[0], d); pool.height[1] = Math.max(pool.height[1], d); }
        if (top && g !== null && top.y > g + 0.01 * cc) pool.roadAbove = Math.max(pool.roadAbove, (top.y - g) / cc); } }
  }
  const names = Object.keys(fac).filter(n => fac[n].hull.length >= 3);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) out.pairs.push({ a: names[i], b: names[j], d: boxGap(boxes.filter(b => b.owner === names[i]), boxes.filter(b => b.owner === names[j])).d, hull: polyDist(fac[names[i]].hull, fac[names[j]].hull) });
  // LF5: the ride's LM09 boxes against the paving
  for (const b of boxes) { const d = pavedDist(b.pts, 2).d; if (d < 0.5) out.boxes.near.push({ group: b.group, d, pts: b.pts }); if (b.group === 'lm09Street' && d < 0.5) out.boxes.street.push({ d, pts: b.pts }); }

  // ---- LF7: rays at uBend 0 / 0.5 / 1 over the paving within 13 m of the anchor
  const objTris = []; for (const g of info.groups) { if (g.name === 'lm09Ground') continue; g.traverse(o => { if (!o.isMesh || !o.geometry?.attributes?.position || !opaque(o)) return; let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false; if (!vis) return;
    const label = g.name + (o.userData.layer ? ':' + o.userData.layer : ''); for (const v of meshTris(o, (x, z) => Math.hypot(x - ax, z - az) <= 16).out) objTris.push(triOf(v, { label })); }); }
  const rayRoads = []; for (const [, o] of shown) for (const v of meshTris(o, (x, z) => Math.hypot(x - ax, z - az) <= 16).out) rayRoads.push(triOf(v, { road: true }));
  const rayCells = index([...objTris, ...rayRoads]), probes = [];
  for (let x = ax - 13; x <= ax + 13; x += 0.1) for (let z = az - 13; z <= az + 13; z += 0.1) { if (Math.hypot(x - ax, z - az) > 13) continue; const top = roadTopAt(x, z); if (top && top.t.paved) probes.push([x, z, top.y]); }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const rayHit = (o, d, A, C, E) => { const e1 = sub(C, A), e2 = sub(E, A), p = crs(d, e2), det = dot(e1, p); if (Math.abs(det) < 1e-13) return null; const inv = 1 / det, s = sub(o, A), u = dot(s, p) * inv; if (u < -1e-7 || u > 1 + 1e-7) return null; const q = crs(s, e1), v = dot(d, q) * inv; if (v < -1e-7 || u + v > 1 + 1e-7) return null; const t = dot(e2, q) * inv; return t > 0 ? t : null; };
  out.rays = { probes: probes.length, objTris: objTris.length, modes: {} };
  for (const u of [0, 0.5, 1]) { const bend = p => B.point(B.wrapX(p[0]), p[1], p[2], u), res = out.rays.modes[u] = { over: 0, by: {}, cracks: 0, worst: null };
    for (const [x, z, y] of probes) { const A = bend([x, y + 7 * cc, z]), Z = bend([x, y - 0.5 * cc, z]), len = Math.hypot(...sub(Z, A)), dir = sub(Z, A).map(q => q / len);
      let road = null, obj = null; for (const t of rayCells.get(key(x, z)) || []) { if (!t.b) t.b = {}; const bv = t.b[u] || (t.b[u] = t.v.map(bend)), h = rayHit(A, dir, ...bv); if (h === null || h > len + 1) continue;
        if (t.road) { if (!road || h < road.t) road = { t: h }; } else if (!obj || h < obj.t) obj = { t: h, label: t.label }; }
      if (!road) { res.cracks++; continue; }
      if (obj && road.t - obj.t > 0.01) { res.over++; res.by[obj.label] = (res.by[obj.label] || 0) + 1; const d = (road.t - obj.t) / cc; if (!res.worst || d > res.worst.d) res.worst = { d, label: obj.label, x, z }; } } }
  return out;
}

export async function lm09FacilityCheck({ page, info, fail, f, M }) {
  const st = M.stats || {}, circleR = (st.circle || 12) / 2, circleAt = st.circleAt || [0, 1];
  const r = await page.evaluate(probe, { layers: LAYERS, circleAt, circleR });
  if (r.error) { fail(`LM09 设施检查无法运行：${r.error}`); return; }
  const F = r.facilities, at = st.facilities || {}, xz = p => `(${f(p[0], 2)}, ${f(p[1], 2)})`, list = (a, n = 6) => a.slice(0, n).join('；');
  info.push(`LF 设施锚点（局部 x 西、z 北，[x, z, 朝向]）：${Object.keys(LAYERS).map(k => `${NAMES[k]} ${at[k] ? `[${at[k].map(v => f(v, 2)).join(', ')}]` : '—'}`).join('、')}；道路三角形 ${r.roadTris}（铺装 ${r.pavedTris}，路线条带与显示网格逐点一致：${r.strips.checked.join('、') || '—'}${r.strips.mismatched.length ? `；不一致 ${r.strips.mismatched.join('、')}` : ''}）；站场地面三角形 ${r.groundTris}`);
  if (r.strips.mismatched.length) fail(`LF2 道路条带与显示网格不一致：${r.strips.mismatched.join('、')}`);
  if (!r.strips.checked.includes('N01-west')) fail('LF2 没有拿到 N01-west 的显示条带');
  // LF1
  const missing = Object.keys(LAYERS).filter(k => !F[k] || !F[k].meshes || !F[k].opaqueTris);
  info.push(`LF1 设施识别：${Object.keys(LAYERS).map(k => `${NAMES[k]} ${F[k]?.meshes ?? 0} 网格 / ${F[k]?.tris ?? 0} 三角形${F[k]?.pools ? `、光池 ${F[k].pools}` : ''}`).join('；')}`);
  if (missing.length) fail(`LF1 烘焙后找不到设施：${missing.map(k => NAMES[k]).join('、')}`);
  if (F.lamp && F.lamp.pools !== 1) fail(`LF1 公交站灯光池 ${F.lamp?.pools ?? 0} 个（应为 1）`);
  const have = Object.keys(LAYERS).filter(k => F[k]?.centre);
  const noBox = have.filter(k => !F[k].boxes); if (noBox.length) fail(`LF1 设施在骑行实体盒中找不到：${noBox.map(k => NAMES[k]).join('、')}`);
  // LF2
  const need = k => PAVE_CLEAR + (k === 'phone' ? DOOR_SWING : 0), lf2 = have.filter(k => !(F[k].paved.d >= need(k)));
  info.push(`LF2 整体（底座、杆、牌面、灯臂灯头${'、电话亭门扇'}）离铺装：${have.map(k => `${NAMES[k]} ${f(F[k].paved.d, 3)} m${F[k].paved.id ? `（${F[k].paved.id}）` : ''}`).join('；')}（要求 ≥ ${PAVE_CLEAR} m；电话亭 ≥ ${PAVE_CLEAR + DOOR_SWING} m，含 ${DOOR_SWING} m 门扇开启）`);
  if (lf2.length) fail(`LF2 设施压到或贴近道路铺装：${list(lf2.map(k => `${NAMES[k]} ${f(F[k].paved.d, 3)} m（${F[k].paved.id}）`))}`);
  // LF3
  const lf3 = have.filter(k => { const s = F[k].support; return s.noGround || s.roadAbove > 0 || s.gap[0] < -BASE_TOL || s.gap[1] > BASE_TOL; });
  info.push(`LF3 底部支撑（${have.map(k => F[k].support.samples).join('/')} 个采样）：${have.map(k => { const s = F[k].support; return `${NAMES[k]} 站场地面${s.noGround ? `缺 ${s.noGround} 点` : '齐全'}、底面−地面 ${f(s.gap[0], 3)}…${f(s.gap[1], 3)} m、${s.roadAbove > 0 ? `道路高出底面 ${f(s.roadAbove, 3)} m（${s.roadAt.id}${s.roadAt.paved ? ' 铺装' : ' 路堤/边坡'}）` : '无道路面高于底面'}`; }).join('；')}（要求地面齐全、相差 ≤ ${BASE_TOL} m、无道路面）`);
  if (lf3.length) fail(`LF3 设施没有站在站场地面上（埋入路堤/路面或悬空）：${list(lf3.map(k => NAMES[k]))}`);
  // LF4
  const lf4c = have.filter(k => !(F[k].circleGap >= SITE_CLEAR)), lf4p = r.pairs.filter(p => !(p.d >= SITE_CLEAR)), lf4b = have.filter(k => !(F[k].otherBox.d >= SITE_CLEAR));
  info.push(`LF4 站场内：离回车场（中心 ${xz(circleAt)}、半径 ${circleR} m）${have.map(k => `${NAMES[k]} ${f(F[k].circleGap, 2)}`).join('、')} m；设施之间最近 ${r.pairs.length ? f(Math.min(...r.pairs.map(p => p.d)), 2) : '—'} m（${r.pairs.map(p => `${NAMES[p.a]}–${NAMES[p.b]} ${f(p.d, 2)}`).join('、')}）（同高度骑行实体盒；平面外包 ${r.pairs.map(p => f(p.hull, 2)).join('/')}）；离其他 LM09 同高度骑行实体盒 ${have.map(k => `${NAMES[k]}（${F[k].boxes} 盒）${f(F[k].otherBox.d, 2)}${F[k].otherBox.group ? `（${F[k].otherBox.group}）` : ''}`).join('、')} m（各要求 ≥ ${SITE_CLEAR} m）`);
  if (lf4c.length) fail(`LF4 设施进入回车场：${list(lf4c.map(k => NAMES[k]))}`);
  if (lf4p.length) fail(`LF4 设施互相重叠或过近：${list(lf4p.map(p => `${NAMES[p.a]}–${NAMES[p.b]} ${f(p.d, 2)} m`))}`);
  if (lf4b.length) fail(`LF4 设施与站场其他实体重叠或过近：${list(lf4b.map(k => `${NAMES[k]}–${F[k].otherBox.group} ${f(F[k].otherBox.d, 2)} m`))}`);
  // LF5
  info.push(`LF5 骑行实体盒：LM09 共 ${r.boxes.lm09} 个；离铺装 < 0.5 m 的 ${r.boxes.near.length} 个${r.boxes.near.length ? `（${[...new Set(r.boxes.near.map(b => b.group))].join('、')}，最近 ${f(Math.min(...r.boxes.near.map(b => b.d)), 3)} m）` : ''}；其中站外设施组 lm09Street ${r.boxes.street.length} 个`);
  if (r.boxes.street.length) fail(`LF5 lm09Street 有 ${r.boxes.street.length} 个骑行实体盒在铺装 0.5 m 内（旧位置残留或设施侵入道路）`);
  // LF6
  const pool = F.lamp?.pool;
  if (pool) { info.push(`LF6 公交站灯光池：半径 ${f(pool.radius, 2)} m、局部中心 ${xz(pool.centreLocal)}；中心与核心圈（0.45 r）${pool.points} 点${pool.noGround ? `缺地面 ${pool.noGround}` : '都有站场地面'}，高出地面 ${f(pool.height[0], 3)}…${f(pool.height[1], 3)} m，${pool.roadAbove > 0 ? `道路高出地面 ${f(pool.roadAbove, 3)} m` : '上方无道路面'}；中心离铺装 ${f(pool.paved, 2)} m`);
    if (pool.noGround || pool.roadAbove > 0 || pool.height[0] < -0.02 || pool.height[1] > 0.12 || !(pool.paved >= PAVE_CLEAR)) fail('LF6 公交站灯光池没有落在站场地面上（埋在道路下、悬空或贴近铺装）'); }
  // LF7
  const M7 = r.rays.modes, bad = Object.entries(M7).filter(([, m]) => m.over);
  info.push(`LF7 显示（射线 ${r.rays.probes} 点，铺装上 13 m 内，0.1 m 网格；LM09 实体三角形 ${r.rays.objTris}）：${Object.entries(M7).map(([u, m]) => `uBend ${u} 首个不透明面为 LM09 实体 ${m.over}${m.over ? ` ${JSON.stringify(m.by)}，最高 ${f(m.worst.d, 3)} m` : ''}、无道路命中 ${m.cracks}`).join('；')}`);
  if (!r.rays.probes) fail('LF7 没有生成铺装射线');
  if (bad.length) fail(`LF7 有 LM09 实体立在路面上：${bad.map(([u, m]) => `uBend ${u} ${m.over} 点`).join('、')}`);
}
