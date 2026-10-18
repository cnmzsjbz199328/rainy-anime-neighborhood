// Road street lights (W10c streetlight normalization, docs/world/STREETLIGHT_NORMALIZATION_PLAN.md): one lamp table for every ordinary road lamp of the world,
// one model family, one light rule. The town's alley lamps, the boardwalk and stair lamps, the stone lanterns, the navigation lights and the buildings' own
// lights are not road lamps and stay with their modules.
// Pure part: plan(ctx) (no THREE, no DOM) registers the town lamps of layout.js and the fixed W4 entrance sites at their frozen places, lays out
// the lamps of the RD01 routes (16 / 40 m by zone, none in the tunnel), the bridges (16 m), CR01 (a closed loop: a lamp at each junction, then <= 25 m apart,
// staggered) and the RN05 bus stop, and steps a blocked lamp along its road (<= 5 m), then across to the other side. It runs after the land cover, so a lamp
// makes way for the fields, ridges and trees, never the reverse. Every lamp keeps a stable id, its source, road and node, the place of its foot, head and
// light pool, and the reason it stands there; the same table gives the pools, the puddle ripples of the roads and the reflections in the town's puddles.
// Scene part: attach(...) builds the table once: per model an instanced body (with its ink hull) and an instanced lens, one light-pool mesh whose vertices
// follow the surfaces they light. tick() fades each lamp by its pole height on screen (1 -> 2 px, dithered like the land cover), the same window for body,
// ink, lens and pool; lens and pools are self-lit, so bend.js puts them out in the daytime of the sphere. Test hooks: window.__scene.streetlights.
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6, PERIOD = 2 * Math.PI * R;
// one family, sized by use (true metres): pole height, arm reach, pole radius at the foot, head scale; the light pool's radius, gain and lead (how far beyond
// the head, towards the road, its centre lies). Town = the town's curved-arm lamp; rural (RD03, CR01, the W4 entrance), trunk (RD01) and bridge keep the
// height classes of the former planet lamp (x 0.8, x 1, x 0.85).
const MODELS = {
  town: { poleH: 4.4, reach: 0.85, rBase: 0.06, head: 1.0, poolR: 3.6, poolGain: 0.32, poolLead: 0 },
  rural: { poleH: 4.96, reach: 0.92, rBase: 0.065, head: 1.1, poolR: 3.4, poolGain: 0.22, poolLead: 0.8 },
  trunk: { poleH: 6.2, reach: 1.15, rBase: 0.08, head: 1.25, poolR: 3.4, poolGain: 0.22, poolLead: 2.0 },
  bridge: { poleH: 5.27, reach: 0.98, rBase: 0.07, head: 1.15, poolR: 3.4, poolGain: 0.22, poolLead: 1.2 },
};
const COLOR = { light: '#ffd9a0', pole: '#596f80', arm: '#597082', collar: '#4d5f6d', housing: '#b7c6bb', lens: '#59616b' };
const COLLAR = { r: 0.1, h: 0.25 };                 // the pole's base cover: its radius is the foot used by every clearance rule
const FOOT_SINK = 0.08;
const SPACING = { RD01: { human: 16, wild: 40 }, bridge: 16, RD03: 25 };
const LIMIT = { RD03: 30, merge: 10 };               // RD03: the widest gap along a road before one more lamp goes in; merge: a pool this near a junction's node already lights it
// road: the foot's distance beyond a road's whole cross-section; margin: a placed foot stands this much beyond that (offsets and projections differ by cm on curves);
// lamp: the least distance between two feet; dup: two pools nearer than this light the same spot; search / step: the steps along a road before trying the other side
const CLEAR = { road: 0.5, margin: 0.12, lamp: 4.0, dup: 3.0, wire: 0.3, search: 5, step: 0.5 };
const PIXELS = [1, 2];                               // projected pole height: hidden below 1 px, whole above 2 px, dithered in between
const POOL_RINGS = [0, 0.1, 0.2, 0.3, 0.4, 0.55, 0.7, 0.85, 1], POOL_SEG = 24, POOL_LIFT = 0.02;
const poolProfile = t => (t < 0.4 ? 1 - 0.65 * t / 0.4 : 0.35 * (1 - (t - 0.4) / 0.6));     // the town's light-pool gradient (1 at the foot of the light, 0.35 at 40 %, 0 at the rim)
const REFLECT = { reach: 5.5, gain: 0.22 };

const flatOf = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) });
const llOf = (x, z) => ({ lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D });
const wrapDx = d => d - PERIOD * Math.round(d / PERIOD);
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const hash = (a, b) => { let h = Math.imul(Math.round(a * 97), 374761393) ^ Math.imul(Math.round(b * 131), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };   // roads.js
const lin = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255].map(c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
const inPoly = (p, x, z) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (((p[i][1] > z) !== (p[j][1] > z)) && (x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; return c; };
const segDist = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = clamp01(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1e-12)); return Math.hypot(x - ax - dx * t, z - az - dz * t); };
const polyDist = (p, x, z) => { let d = Infinity; for (let i = 0, j = p.length - 1; i < p.length; j = i++) d = Math.min(d, segDist(x, z, p[j][0], p[j][1], p[i][0], p[i][1])); return inPoly(p, x, z) ? -d : d; };

// ---- a swept line (route, bridge, stair, boardwalk) for projections: flat samples, stations, tangents, the lateral factor and a grid of its segments
function sweptLine(id, kind, S, F, T, cf, foot, extra) {
  const n = S.length, C = 8, PAD = 14, cells = new Map(), x0 = F[0].x, X = new Float64Array(n);     // a segment is listed in every cell within 14 flat units of it
  for (let i = 0; i < n; i++) X[i] = i ? X[i - 1] + wrapDx(F[i].x - F[i - 1].x) : x0;          // longitudes kept continuous along the line
  const key = (a, b) => a * 1000003 + b;
  for (let i = 0; i + 1 < n; i++) {
    const a0 = Math.floor((Math.min(X[i], X[i + 1]) - PAD) / C), a1 = Math.floor((Math.max(X[i], X[i + 1]) + PAD) / C), b0 = Math.floor((Math.min(F[i].z, F[i + 1].z) - PAD) / C), b1 = Math.floor((Math.max(F[i].z, F[i + 1].z) + PAD) / C);
    for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) { const k = key(a, b); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(i); }
  }
  // the nearest point of the line to a flat point: station, offset in grid metres (+ = right of travel), true distance; null when farther than reach (true
  // metres) or than the cells' 14 flat units
  const project = (x, z, reach = 6) => {
    let best = null;
    for (const shift of [0, PERIOD, -PERIOD]) {
      const px = x + shift, a = Math.floor(px / C), b = Math.floor(z / C), l = cells.get(key(a, b)); if (!l) continue;
      for (const i of l) {
        const ax = X[i], az = F[i].z, dx = X[i + 1] - ax, dz = F[i + 1].z - az, l2 = dx * dx + dz * dz || 1e-12, t = clamp01(((px - ax) * dx + (z - az) * dz) / l2);
        const qx = ax + dx * t, qz = az + dz * t, d2 = (px - qx) ** 2 + (z - qz) ** 2, raw = ((px - ax) * dx + (z - az) * dz) / l2;
        if (best && d2 >= best.d2) continue;
        const k = F[i].k + (F[i + 1].k - F[i].k) * t, c = cf[i] + (cf[i + 1] - cf[i]) * t, Tx = T[i][0] + (T[i + 1][0] - T[i][0]) * t, Tz = T[i][1] + (T[i + 1][1] - T[i][1]) * t;
        const side = (px - qx) * -Tz + (z - qz) * Tx >= 0 ? 1 : -1, d = Math.sqrt(d2) / k;
        const over = (i === 0 && raw < 0 ? -raw : i === n - 2 && raw > 1 ? raw - 1 : 0) * Math.sqrt(l2) / k;     // how far beyond the line's first or last sample (true metres)
        best = { d2, i, t, s: S[i].s + (S[i + 1].s - S[i].s) * t, o: side * d / c, d, over, end: over > 0 };
      }
    }
    return best && best.d <= reach ? best : null;
  };
  return { id, kind, S, F, T, cf, foot, n, project, length: S[n - 1].s, ...extra };
}
const routeLine = rt => sweptLine(rt.def.id, 'route', rt.samples, rt.flatOf, rt.tangent, rt.cf, rt.footprint, { rt });
function bridgeLine(b) {
  const F = b.samples.map(p => flatOf(p.lon, p.lat)), cf = b.samples.map((p, i) => { const [lo, la] = b.lateral(i, 1), f = flatOf(lo, la); return Math.hypot(wrapDx(f.x - F[i].x), f.z - F[i].z) / F[i].k; });
  return sweptLine(b.def.id, 'bridge', b.samples, F, b.tangent, cf, b.samples.map(() => [-5, 5, -5, 5]), { b });
}
function pathLine(id, kind, pts, half) {            // a sampled path with a constant half width (stairs, the boardwalk)
  const S = pts.map((p, i) => ({ ...p, s: p.s ?? i * 0.5 })), F = S.map(p => flatOf(p.lon, p.lat)), n = S.length;
  const T = F.map((f, i) => { const a = F[Math.max(0, i - 1)], b = F[Math.min(n - 1, i + 1)], dx = wrapDx(b.x - a.x), dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; });
  return sweptLine(id, kind, S, F, T, S.map(() => 1), S.map(() => [-half, half, -half, half]), {});
}
const lerpFoot = (L, q) => { const a = L.foot[q.i], b = L.foot[Math.min(L.n - 1, q.i + 1)]; return a.map((v, j) => v + (b[j] - v) * q.t); };

// ---- the obstacles a lamp's foot and arm must keep clear of (flat frame, 8 m cells)
function obstacles(ctx, lines) {
  const W = ctx.W, C = 8, cells = new Map(), key = (a, b) => a * 1000003 + b, items = [];
  const add = f => { const a0 = Math.floor((f.box[0]) / C), a1 = Math.floor(f.box[1] / C), b0 = Math.floor(f.box[2] / C), b1 = Math.floor(f.box[3] / C); f.id = items.length; items.push(f);
    for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) { const k = key(a, b); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(f.id); } };
  const norm = x => x - PERIOD * Math.floor((x + PERIOD / 2) / PERIOD);
  const circle = (lon, lat, r, why) => { const f = flatOf(lon, lat), x = norm(f.x), rr = r * f.k; add({ c: [x, f.z], r: rr, why, box: [x - rr, x + rr, f.z - rr, f.z + rr] }); };
  const poly = (p, why) => { const x0 = norm(p[0][0]), q = p.map(([x, z]) => [x0 + wrapDx(x - p[0][0]), z]); add({ p: q, why, box: [Math.min(...q.map(v => v[0])), Math.max(...q.map(v => v[0])), Math.min(...q.map(v => v[1])), Math.max(...q.map(v => v[1]))] }); };
  // road furniture (true radius of the part's footprint); the plants of the verges (tufts, weeds) are not obstacles
  const RAD = { barrierConcrete: 1.0, milestone: 0.2, signBus: 0.25, busBench: 0.8, pole: 0.2, mirror: 0.35, vending: 0.6, jizo: 0.3, lantern: 0.3, stonePost: 0.2, bollard: 0.15, gatePost: 0.25, snowPole: 0.1, shelterOrange: 1.6, signRound: 0.3, signTri: 0.4, torii: 1.3, stoneStep: 0.8, mossStep: 0.8, guardrailMetal: 1.0, guardrail: 1.0, steelPlate: 0.6, steelStep: 0.5, steelPost: 0.05, pierColumn: 0.9, pierFooting: 1.8, pierFoot: 1.0, navLight: 0.15, lampSmall: 0.1, lifeRing: 0.2, ropePost: 0.05, pile: 0.1, plank: 1.0, beam: 0.5 };
  const PLANTS = new Set(['tuft', 'weed', 'seedling', 'flower', 'fern', 'weedShadow', 'grass', 'dryShrub', 'lichenPatch']);
  const RD = ctx.roads;
  for (const src of [...RD.routes.map(r => r.instances), ...RD.bridges.map(b => b.instances), ...RD.stairs.map(s => s.instances), ...(RD.extras || []).map(e => e.instances), { gatePost: RD.markers }])
    for (const [type, list] of Object.entries(src || {})) { if (PLANTS.has(type)) continue; for (const it of list) circle(it.lon, it.lat, (RAD[type] ?? 0.4) * Math.max(it.s ? it.s[0] : 1, it.s ? it.s[2] : 1), 'furniture:' + type); }
  // the W4 corridor's migrated props and global fields
  const PL = ctx.cover && ctx.cover.w4;
  for (const it of PL?.items || []) { if (PLANTS.has(it.type)) continue; circle(it.lon, it.lat, Math.max(it.clearance || 0.3, 0.2), 'w4:' + it.type); }
  // the land cover: the field cells with their ridges, the tree trunks and the larger props
  const COV = ctx.cover;
  for (const c of COV.cells || []) poly(c.outer, 'field');
  const TRUNK = { treeRound: 0.3, cedar: 0.35, pine: 0.35, bamboo: 0.6 }, PROP = { rack: 1.4, rackFallen: 1.4, scarecrow: 0.7, hutFarm: 1.7, hutRusty: 1.7, oldMachine: 1.3, shrub: 0.8, shrubLow: 0.7, rock: 0.55, rockBig: 1.1, mossRock: 0.6, reefRock: 0.9, log: 1.8, logMoss: 1.7, cairn: 0.4, rockPillar: 0.5, iceBlock: 0.8, ventCone: 0.6, tubeHole: 1.8, teaRow: 1.1, wallBlock: 1.0, tetra: 0.6, drift: 1.3, seaMark: 0.2, signFallen: 1.2, barrier: 1.0, fenceBamboo: 2.1, fenceWire: 1.1 };
  for (const it of COV.items || []) { const r = TRUNK[it.type] ? TRUNK[it.type] * Math.max(it.s[0], it.s[2]) : PROP[it.type]; if (r) circle(it.lon, it.lat, r * (TRUNK[it.type] ? 1 : Math.max(it.s[0], it.s[2])), TRUNK[it.type] ? 'tree' : 'cover:' + it.type); }
  for (const lm of W.landmarks) if (lm.id !== 'TOWN') circle(lm.lon, lm.lat, lm.radius, 'landmark:' + lm.id);
  for (const j of RD.junctions) { if (j.polygon) poly(j.polygon, 'junction:' + j.node); for (const m of j.mouths || []) poly(m.polygon, 'mouth:' + j.node); }
  const query = (x, z, r) => { const out = new Set(); for (const sx of [norm(x), norm(x) + PERIOD, norm(x) - PERIOD]) { const a0 = Math.floor((sx - r) / C), a1 = Math.floor((sx + r) / C), b0 = Math.floor((z - r) / C), b1 = Math.floor((z + r) / C); for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) for (const id of cells.get(key(a, b)) || []) out.add(id); } return [...out].map(id => items[id]); };
  const P = W.TOWN_PATCH, townX = R * P.lonMax * D, townZ = R * Math.asinh(Math.tan(P.latMax * D));
  // the reason a foot of radius r (true metres) at (lon, lat) is not free, or null; opts.owner: the swept line the lamp belongs to (a bridge lamp stands on its
  // own deck), opts.inTown: a town lamp (the town's frozen fixtures were placed by layout.js)
  function blocked(lon, lat, r, opts = {}) {
    const f = flatOf(lon, lat), x = norm(f.x), k = f.k, pad = CLEAR.road + r;
    if (!opts.inTown && Math.abs(f.x) < townX + 0.3 * k && Math.abs(f.z) < townZ + 0.3 * k) return 'town';
    if (opts.owner !== 'deck' && W.height(lon, lat) < 0.35) return 'water';
    for (const L of lines) {
      if (opts.ownerLine === L && L.kind === 'bridge') continue;
      const q = L.project(f.x, f.z, 12); if (!q || q.over > pad) continue;           // beyond a line's end by more than the clearance: free of it
      const fp = lerpFoot(L, q), c = L.cf[q.i];
      if (q.o >= fp[2] - pad / c && q.o <= fp[3] + pad / c) return (L.kind === 'route' ? 'road:' : L.kind + ':') + L.id;
      if (L.tunnel && q.s > L.tunnel[0] - 2 && q.s < L.tunnel[1] + 2 && Math.abs(q.o) < 7.5) return 'tunnel:' + L.id;
    }
    for (const it of query(x, f.z, 12 * k)) {
      if (it.c) { if (Math.hypot(wrapDx(x - it.c[0]), f.z - it.c[1]) < it.r + r * k) return it.why; }
      else if (polyDist(it.p, it.p[0][0] + wrapDx(x - it.p[0][0]), f.z) < r * k) return it.why;
    }
    return null;
  }
  return { blocked, count: items.length };
}

// ---- the plan
function plan(ctx) {
  const W = ctx.W, L = ctx.L, RD = ctx.roads, RK = ctx.RK, PL = ctx.cover && ctx.cover.w4, H = (lon, lat) => W.height(lon, lat);
  const routes = Object.fromEntries(RD.routes.map(rt => [rt.def.id, rt]));
  const lines = [...RD.routes.map(routeLine), ...RD.bridges.map(bridgeLine), ...RD.stairs.map(st => pathLine(st.id || 'stairs', 'stairs', st.samples, 1.2)), ...(RD.extras || []).map(ex => pathLine('RN11-01', 'boardwalk', ex.centre, 1.4))];
  const lineOf = Object.fromEntries(lines.map(l => [l.id, l]));
  for (const rt of RD.routes) if (rt.tunnel) lineOf[rt.def.id].tunnel = [rt.tunnel.s0, rt.tunnel.s1];
  const OB = obstacles(ctx, lines);
  const lamps = [], removed = [], mapping = [], log = [];
  // the wires a lamp head must keep clear of: the RD03 pole lines along the routes and the W4 entrance poles (3D, catenaries as polylines in true metres)
  const wires = [];
  { const local = [-0.8, 0, 0.8];
    const poleTop = (rec, o) => { const f = flatOf(rec.lon, rec.lat), c = Math.cos(rec.yaw), sn = Math.sin(rec.yaw); return { x: f.x + c * o * f.k, z: f.z - sn * o * f.k, y: rec.alt - BASE + 7.75 }; };
    for (const rt of RD.routes) { const ps = rt.poles || []; for (let a = 0; a + 1 < ps.length; a++) for (const o of local) wires.push({ a: poleTop(ps[a].rec, o), b: poleTop(ps[a + 1].rec, o), sag: 0.5 + 0.5 * hash(a + 1, rt.length) }); }
    for (const w of PL?.wires || []) for (const o of local) { const [alo, ala, blo, bla, sag] = w, top = (lon, lat) => { const f = flatOf(lon, lat), pole = PL.items.find(it => it.type === 'pole' && Math.abs(it.lon - lon) < 1e-6 && Math.abs(it.lat - lat) < 1e-6), c = Math.cos(pole?.yaw || 0), sn = Math.sin(pole?.yaw || 0); return { x: f.x + c * o * f.k, z: f.z - sn * o * f.k, y: H(lon, lat) - BASE + 7.75 }; }; wires.push({ a: top(alo, ala), b: top(blo, bla), sag }); } }
  const wireClash = lamp => {
    const m = MODELS[lamp.model], f = flatOf(lamp.lon, lamp.lat), hx = f.x + lamp.face[0] * m.reach * f.k, hz = f.z + lamp.face[1] * m.reach * f.k, top = lamp.alt - BASE + m.poleH + 0.3;
    for (const w of wires) for (let q = 0; q <= 10; q++) { const t = q / 10, x = w.a.x + wrapDx(w.b.x - w.a.x) * t, z = w.a.z + (w.b.z - w.a.z) * t, y = w.a.y + (w.b.y - w.a.y) * t - w.sag * 4 * t * (1 - t);
      const d = segDist(wrapDx(x - f.x), z, 0, f.z, wrapDx(hx - f.x), hz) / f.k; if (d < CLEAR.wire + 0.3 && y < top + CLEAR.wire && y > lamp.alt - BASE) return true; }
    return false;
  };
  const near = (lon, lat, r) => { const f = flatOf(lon, lat); return lamps.find(q => { const g = flatOf(q.lon, q.lat); return Math.hypot(wrapDx(g.x - f.x), g.z - f.z) / f.k < r; }); };
  // the surface a foot stands on: the terrain, or the route's own strip where it is higher (the outer columns of a road, an embankment)
  // (sunk 8 cm into it: the 25 cm base cover hides the step on a slope or where a crossing road's strip is clipped below the one sampled)
  const footAlt = (lon, lat, line) => { let a = H(lon, lat); if (line && line.kind === 'route') { const f = flatOf(lon, lat), q = line.project(f.x, f.z, 12); if (q && !q.end && q.o >= line.rt.grid[0] && q.o <= line.rt.grid[line.rt.grid.length - 1]) a = Math.max(a, RK.surfS(line.rt, q.s, q.o)); } return a - FOOT_SINK; };
  const edgeOf = (line, s) => { if (line.kind === 'route') { const { i } = RK.atS(line.rt, s); return line.rt.def.segs[line.rt.edgeOf[i]].id; } if (line.kind === 'bridge') { const b = line.b, j = b.joints ? b.joints.filter(q => q <= s).length : 0; return b.ids[Math.min(b.ids.length - 1, j)]; } return line.id; };
  // scale: the flat-frame size of a metre at the lamp. A lamp of the world is true size on the sphere (1 / cos lat on the flat map, as every planet instance);
  // a town lamp keeps the town's own frame (1 on the flat map) like the town's poles, wires and buildings beside it, so its arm stays under the frozen wires
  const record = o => {
    const m = MODELS[o.model], f = flatOf(o.lon, o.lat), sc = o.owner === 'town' ? 1 : f.k, hx = f.x + o.face[0] * m.reach * sc, hz = f.z + o.face[1] * m.reach * sc, lead = m.reach + m.poolLead, px = f.x + o.face[0] * lead * sc, pz = f.z + o.face[1] * lead * sc;
    const head = llOf(hx, hz), pool = llOf(px, pz);
    const lamp = { ...o, x: f.x, z: f.z, k: f.k, scale: sc, y: (o.alt - BASE) * f.k, yaw: Math.atan2(o.face[0], o.face[1]), head: { lon: head.lon, lat: head.lat, alt: o.alt + (m.poleH + 0.09) * sc / f.k }, pool: { lon: pool.lon, lat: pool.lat, x: px, z: pz } };
    lamps.push(lamp); return lamp;
  };
  // a lamp beside a swept line at station s on side (+1 right, -1 left): beyond the whole cross-section and 0.5 m more, facing the road; null and the
  // blocker when nothing within +-5 m on either side is free
  function besideRoad(line, s0, side0, opts) {
    const m = MODELS[opts.model], r = Math.max(COLLAR.r, m.rBase), why = {}, closed = !!opts.closed, Ls = line.length;
    const steps = [0]; for (let d = CLEAR.step; d <= CLEAR.search + 1e-9; d += CLEAR.step) if (opts.forward) steps.push(d); else steps.push(d, -d);
    for (const side of [side0, -side0]) for (const d of steps) {
      let s = s0 + d; if (closed) s = ((s % Ls) + Ls) % Ls; else if (s < line.S[0].s + 0.5 || s > Ls - 0.5) continue;
      const q = RK.atS(line.rt || line.b, s), fp = lerpFoot(line, q), oFoot = side > 0 ? fp[3] + (CLEAR.road + r + CLEAR.margin) / line.cf[q.i] : fp[2] - (CLEAR.road + r + CLEAR.margin) / line.cf[q.i];
      const o = opts.deck ? side * opts.deck : oFoot, ll = lateralAt(line, s, o);
      if (line.S[q.i].span === 'tunnel' || (line.S[q.i + 1] && line.S[q.i + 1].span === 'tunnel')) { why.tunnel = (why.tunnel || 0) + 1; continue; }
      const b = opts.deck ? null : OB.blocked(ll[0], ll[1], r, { ownerLine: line });
      if (b) { why[b] = (why[b] || 0) + 1; continue; }
      const other = near(ll[0], ll[1], CLEAR.lamp); if (other) { why['lamp:' + other.id] = (why['lamp:' + other.id] || 0) + 1; continue; }
      const T = line.T[q.i], face = side > 0 ? [T[1], -T[0]] : [-T[1], T[0]];
      const cand = { model: opts.model, lon: ll[0], lat: ll[1], alt: opts.deck ? deckAlt(line.b, s) + 0.01 : footAlt(ll[0], ll[1], line), face, line: line.id, edge: edgeOf(line, s), station: s, side, offset: o, shift: d, sideSwapped: side !== side0 };
      if (wireClash(cand)) { why.wire = (why.wire || 0) + 1; continue; }
      return { cand };
    }
    return { blockers: why };
  }
  // a point beside a swept line (grid offset o; a bridge's lateral() applies its own factor)
  const lateralAt = (line, s, o) => { if (line.kind !== 'bridge') return RK.latS(line.rt, s, o); const b = line.b, q = RK.atS(b, s), a = b.lateral(q.i, o), c = b.lateral(Math.min(b.samples.length - 1, q.i + 1), o), dl = c[0] - a[0] - 360 * Math.round((c[0] - a[0]) / 360); return [a[0] + dl * q.t, a[1] + (c[1] - a[1]) * q.t]; };
  const deckAlt = (b, s) => { const q = RK.atS(b, s); return b.alt[q.i] + (b.alt[Math.min(b.alt.length - 1, q.i + 1)] - b.alt[q.i]) * q.t; };
  const place = (line, s, side, opts, meta) => {
    const r = besideRoad(line, s, side, opts);
    if (!r.cand) { const ll = lateralAt(line, s, 0); removed.push({ ...meta, line: line.id, station: s, side, blockers: r.blockers, at: { lon: ll[0], lat: ll[1] } }); return null; }
    return record({ ...r.cand, ...meta });
  };

  // 1. the town: the 26 lamps of layout.js and the convenience-store lamp (the former sample), at their frozen places on the facility band, facing the street
  const LV = L.LEVELS, townLamp = (id, x, z, face, source) => { const ll = W.townToLonLat(x, z), k = 1 / Math.cos(ll.lat * D); return record({ id: 'SL-T-' + id, model: 'town', reason: 'fixed', owner: 'town', source, lon: ll.lon, lat: ll.lat, alt: BASE + LV.pavement / k, face, line: null, edge: null, node: null, station: null, side: null, townXZ: [x, z] }); };
  for (const f of L.furniture) {
    if (f.kind === 'lamp') { townLamp(f.id, f.x, f.z, f.face, 'layout:' + f.id); mapping.push({ from: 'layout:' + f.id, to: 'SL-T-' + f.id, change: 'model' }); }
    else if (f.kind === 'legacy' && f.group === 'streetLamp') { const road = L.roads.find(q => q.id === f.road), face = road.axis === 'x' ? [0, Math.sign(road.at - f.z)] : [Math.sign(road.at - f.x), 0];
      townLamp(f.id, f.x, f.z, face, 'scene:streetLamp'); mapping.push({ from: 'scene:streetLamp', to: 'SL-T-' + f.id, change: 'model, arm turned to the street, point light removed' }); }
  }
  // 2. the fixed W4 entrance lamps, facing the nearest road of the junction (M01 south or CR01)
  { const lampSites = [{ lon: -5.452807402309436, lat: -37.16203486805916, clearance: 0.6 }, { lon: 7.937819167847188, lat: -37.60766870871647, clearance: 0.6 }]; lampSites.forEach((site, k) => { const f = flatOf(site.lon, site.lat), [line, q] = ['M01-south', 'CR01'].map(id => [lineOf[id], lineOf[id].project(f.x, f.z, 14)]).filter(e => e[1]).sort((a, b) => a[1].d - b[1].d)[0];
      const T = line.T[q.i], face = q.o > 0 ? [T[1], -T[0]] : [-T[1], T[0]], id = 'SL-W4-' + (k + 1);
      record({ id, model: 'rural', reason: 'fixed', owner: 'w4', source: 'w4-entrance-lamp#' + k, lon: site.lon, lat: site.lat, alt: footAlt(site.lon, site.lat, line), face, line: line.id, edge: edgeOf(line, q.s), node: 'C01-S', station: q.s, side: Math.sign(q.o), offset: q.o, shift: 0 });
      mapping.push({ from: 'w4-entrance-lamp#' + k, to: id, change: 'model rural (was the 6.2 m planet lamp), arm turned to the road' }); }); }
  // 3. the bridges: every 16 m from 8 m, sides alternating, none within 2 m of the pylon; on the deck's hard strip (4.4 m), between the lanes and the parapet
  for (const b of RD.bridges) {
    const line = lineOf[b.def.id], S = b.samples, pylonS = b.pylon ? b.pylon.s : null; let n = 0, k = 0;
    for (let s0 = SPACING.bridge / 2; s0 < b.length; s0 += SPACING.bridge) {
      const s = S[Math.min(S.length - 1, Math.round(s0 / 0.5))].s, side = n++ % 2 ? 1 : -1; if (pylonS !== null && Math.abs(s - pylonS) < 2) continue;      // at a sample, as the W5 rule had it
      const id = `SL-${b.def.id}-${String(++k).padStart(2, '0')}`, src = `bridge:${b.def.id}#${k - 1}`;
      const l = place(line, s, side, { model: 'bridge', deck: 4.4 }, { id, reason: 'regular', owner: 'bridge', source: src, node: null });
      mapping.push({ from: src, to: l ? id : null, change: l ? 'model' : 'removed' });
    }
  }
  // 4. the RD01 routes: the stations of the W5 rule (first lamp, then 16 m on inhabited land and 40 m in the wild, sides alternating, none in the tunnel)
  for (const rt of RD.routes.filter(q => q.def.furnish && q.def.furnish.kind === 'RD01')) {
    const line = lineOf[rt.def.id], S = rt.samples, n = S.length; let next = rt.def.furnish.firstLamp || 3, side = 1, k = 0;
    while (next < rt.length - 2) {
      const i = Math.min(n - 1, Math.round(next / 0.5)), zone = W.regionAt(S[i].lon, S[i].lat).zone, sp = zone === 'building' ? SPACING.RD01.human : SPACING.RD01.wild;
      if (S[i].span === 'tunnel') { next += 1; continue; }
      const id = `SL-${rt.def.id}-${String(++k).padStart(2, '0')}`, src = `roads:${rt.def.id}#${k - 1}`;
      if (W.insideTownPatch(S[i].lon, S[i].lat)) {          // since W10b the route starts on the town's main street, which the town lamps light: the W5 rule had put a second lamp there
        removed.push({ id, source: src, line: rt.def.id, station: S[i].s, side, reason: 'town street (R01 is lit by the town lamps of layout.js)', blockers: { town: 1 } }); mapping.push({ from: src, to: null, change: 'removed: on the town street, a duplicate of the town lamps' });
        side = -side; next += sp; continue;
      }
      const l = place(line, S[i].s, side, { model: 'trunk' }, { id, reason: 'regular', owner: 'route', source: src, node: null, zone: zone === 'building' ? 'human' : 'wild' });
      mapping.push({ from: src, to: l ? id : null, change: l ? (l.shift || l.sideSwapped ? 'model, moved beyond the full cross-section' + (l.shift ? `, ${l.shift.toFixed(1)} m along` : '') + (l.sideSwapped ? ', other side' : '') : 'model, moved beyond the full cross-section') : 'removed' });
      side = -side; next += sp;
    }
  }
  // 5. RN05-01 (RD03): the bus-stop lamp, which also lights the C01-T02 junction; stepped along the road out of the ring's cross-section
  { const rt = routes['RN05-RD03'], line = lineOf['RN05-RD03'], cfg = rt.def.furnish;
    cfg.lamps.forEach((s, k) => { const id = `SL-RN05-RD03-${String(k + 1).padStart(2, '0')}`, src = `roads:RN05-RD03#${k}`;
      const l = place(line, s, k % 2 ? -1 : 1, { model: 'rural', forward: true }, { id, reason: 'bus-stop', owner: 'route', source: src, node: 'C01-T02' });
      mapping.push({ from: src, to: l ? id : null, change: l ? `model rural, lamp, pool and record together (the pool and record had been cut, the pole kept), ${l.shift.toFixed(1)} m along` : 'removed' }); }); }
  // 6. CR01: a lamp at each of the ten junctions (none where a lamp's pool already lies within 10 m of the node), then filled to <= 25 m along the closed loop
  const ring = routes.CR01, ringLine = lineOf.CR01, Lr = ring.length, cr01 = [];
  const ringJ = RD.junctions.filter(j => j.kind === 'CR01');
  const armSide = (j, arm) => { const rt = routes[arm.routeId], s = Math.max(0, Math.min(rt.length, arm.nodeS + arm.dir * 6)), ll = RK.latS(rt, s, 0), f = flatOf(ll[0], ll[1]), q = ringLine.project(f.x, f.z, 20); return q ? Math.sign(q.o) : 0; };
  const poolNear = (lon, lat, r) => { const f = flatOf(lon, lat); return lamps.find(q => Math.hypot(wrapDx(q.pool.x - f.x), q.pool.z - f.z) / f.k <= r); };
  for (const j of ringJ) {
    const nodeS = j.arms.find(a => a.routeId === 'CR01').nodeS, branches = j.arms.filter(a => a.routeId !== 'CR01'), sides = new Set(branches.map(a => armSide(j, a))), nd = W.roadNetwork.nodeById[j.node];
    const cover = poolNear(nd.lon, nd.lat, LIMIT.merge);
    if (cover) { log.push({ node: j.node, merged: cover.id }); continue; }
    const half = Math.max(...branches.map(a => a.half || 3)), both = sides.has(1) && sides.has(-1), side = both ? 1 : -[...sides][0] || 1, s = both ? nodeS + half + 2 : nodeS;
    const id = 'SL-CR01-J-' + j.node, l = place(ringLine, s, side, { model: 'rural', closed: true }, { id, reason: 'junction', owner: 'route', source: null, node: j.node });
    if (l) cr01.push(l); log.push({ node: j.node, lamp: l ? l.id : null });
  }
  // coverage points along the ring: every lamp whose pool centre lies within the ring's cross-section (its own lamps by construction)
  const onLine = (line, q) => { const g = line.project(q.pool.x, q.pool.z, 8); if (!g || g.end) return null; const fp = lerpFoot(line, g); return g.o >= fp[2] - 0.2 && g.o <= fp[3] + 0.2 ? g : null; };
  const ringPoints = () => lamps.map(q => { const g = onLine(ringLine, q); return g ? { s: q.line === 'CR01' && q.owner === 'route' ? q.station : g.s, side: q.line === 'CR01' && q.owner === 'route' ? q.side : Math.sign(g.o), lamp: q } : null; }).filter(Boolean).sort((a, b) => a.s - b.s);
  const ringGaps = pts => pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return { a: p, b: q, g: ((q.s - p.s) % Lr + Lr) % Lr || (pts.length === 1 ? Lr : 0) }; });
  for (const { a, g } of ringGaps(ringPoints().length ? ringPoints() : [{ s: 0, side: 1, lamp: null }])) {
    const n = Math.ceil(g / SPACING.RD03 - 1e-9) - 1; let side = -(a.side || 1);
    for (let k = 1; k <= n; k++) { const s = (a.s + g * k / (n + 1)) % Lr, l = place(ringLine, s, side, { model: 'rural', closed: true }, { id: null, reason: 'regular', owner: 'route', source: null, node: null }); if (l) { cr01.push(l); side = -l.side; } else side = -side; }
  }
  // a gap that the steps along the road widened beyond 30 m gets one more lamp, as long as one can be placed
  for (let guard = 0; guard < 20; guard++) {
    const wide = ringGaps(ringPoints()).filter(q => q.g > LIMIT.RD03).sort((p, q) => q.g - p.g)[0]; if (!wide) break;
    const l = place(ringLine, (wide.a.s + wide.g / 2) % Lr, -(wide.a.side || 1), { model: 'rural', closed: true }, { id: null, reason: 'gap', owner: 'route', source: null, node: null });
    if (!l) break; cr01.push(l);
  }
  { let k = 0; cr01.sort((a, b) => a.station - b.station).forEach(l => { if (!l.id) l.id = `SL-CR01-${String(++k).padStart(2, '0')}`; }); }
  // 7. duplicates of different sources (a lamp at a bridge head next to the route's last one, a junction lamp next to a fixed one): every placement already keeps
  // 4 m from the feet placed before it; two pools within 3 m of each other light the same spot, and the lower-ranked lamp goes
  const rank = { fixed: 0, junction: 1, 'bus-stop': 2, regular: 3, gap: 4 };
  for (const a of lamps.slice()) for (const b of lamps.slice()) {
    if (a === b || a.dropped || b.dropped || a.owner === b.owner && a.line === b.line) continue;
    const d = Math.hypot(wrapDx(a.pool.x - b.pool.x), a.pool.z - b.pool.z) / a.k; if (d >= CLEAR.dup) continue;
    const drop = (rank[a.reason] ?? 9) > (rank[b.reason] ?? 9) ? a : b; drop.dropped = true; removed.push({ id: drop.id, line: drop.line, station: drop.station, reason: 'duplicate of ' + (drop === a ? b : a).id, blockers: {} });
  }
  for (let i = lamps.length - 1; i >= 0; i--) if (lamps[i].dropped) lamps.splice(i, 1);

  // ---- coverage by road (along the stations of the lamps' own road; the other lamps count where their pool falls on its carriageway)
  const coverage = [];
  { for (const rt of RD.routes.filter(q => q.def.furnish && q.def.furnish.kind === 'RD01')) {
      const st = lamps.filter(q => q.line === rt.def.id && q.owner === 'route').sort((a, b) => a.station - b.station), out = rt.samples.find(p => !W.insideTownPatch(p.lon, p.lat)), s0 = out ? out.s : rt.samples[0].s;
      const tunnel = rt.tunnel ? [rt.tunnel.s0, rt.tunnel.s1] : null, gaps = st.slice(1).map((q, i) => ({ from: st[i].id, to: q.id, g: q.station - st[i].station, zone: q.zone === st[i].zone ? q.zone : 'mixed', tunnel: !!(tunnel && st[i].station < tunnel[1] && q.station > tunnel[0]) }));
      coverage.push({ road: rt.def.id, policy: 'RD01 16 m inhabited / 40 m wild, none in the tunnel (the town street is lit by the town lamps)', from: s0, lamps: st.length, gaps, ends: [st.length ? st[0].station - s0 : rt.length - s0, st.length ? rt.length - st[st.length - 1].station : rt.length - s0] }); }
    for (const b of RD.bridges) { const st = lamps.filter(q => q.line === b.def.id).sort((a, c) => a.station - c.station); coverage.push({ road: b.def.id, policy: 'RD02 every 16 m', lamps: st.length, gaps: st.slice(1).map((q, i) => ({ from: st[i].id, to: q.id, g: q.station - st[i].station })), ends: [st.length ? st[0].station : b.length, st.length ? b.length - st[st.length - 1].station : b.length] }); }
    { const pts = ringPoints(), gaps = ringGaps(pts).map(q => ({ from: q.a.lamp.id, to: q.b.lamp.id, g: q.g }));
      const nodes = ringJ.map(j => { const nd = W.roadNetwork.nodeById[j.node], f = flatOf(nd.lon, nd.lat); let best = null; for (const q of lamps) { const d = Math.hypot(wrapDx(q.pool.x - f.x), q.pool.z - f.z) / f.k; if (!best || d < best.d) best = { d, id: q.id }; } return { node: j.node, nearest: best.id, d: best.d }; });
      coverage.push({ road: 'CR01', policy: 'RD03 closed loop, <= 25 m planned, <= 30 m checked, a lamp at every junction', closed: true, length: Lr, lamps: pts.filter(p => p.lamp.line === 'CR01').length, gaps, nodes }); }
    { const rt = routes['RN05-RD03'], st = lamps.filter(q => q.line === 'RN05-RD03').sort((a, b) => a.station - b.station); coverage.push({ road: 'RN05-RD03', policy: 'RD03 25 m, the bus stop lit', lamps: st.length, gaps: st.slice(1).map((q, i) => ({ from: st[i].id, to: q.id, g: q.station - st[i].station })), ends: [st.length ? st[0].station - rt.samples[0].s : rt.length, st.length ? rt.length - st[st.length - 1].station : rt.length], busStop: st.length ? Math.abs(st[0].station - rt.def.furnish.busStop) : null }); }
    // the short links: the nine 6 m town connectors and RN06-01 (1.55 m, C01-S to the RD04): lit by the nearest town, junction or W4 lamp
    for (const id of ['RN02-01', 'RN03-01', 'RN03-04', 'RN13-01', 'RN13-04', 'RN14-01', 'RN02-07', 'RN01-16', 'RN01-19', 'RN06-01']) {
      const e = W.roadNetwork.edges.find(q => q.id === id), P = W.roadNetwork.samplePath(e, 0.5), mid = P[Math.floor(P.length / 2)], f = flatOf(mid.lon, mid.lat);
      let best = null; for (const q of lamps) { const d = Math.hypot(wrapDx(q.pool.x - f.x), q.pool.z - f.z) / f.k; if (!best || d < best.d) best = { d, id: q.id }; }
      coverage.push({ road: id, class: e.class, policy: e.class === 'RD05' ? 'RD05 unlit (card); alley lamps and the CR01 junction lamp nearby' : 'covered by the adjacent town / junction / W4 lamp', nearest: best.id, d: best.d, required: e.class !== 'RD05' }); }
  }

  // ---- the light pools: a disc of rings per lamp whose vertices take the height of the surface below: the town's streets and pavements, a route's strip, the
  // bare ground beside it; a bridge lamp lights its own deck only. No light where the surface is not the ground the pool lies on: the field cells (paddy water
  // and treads are levelled above or below it), the W4 paddies, the sea, the landmarks' own grounds, the town's plots. Flat frame positions, linear colours,
  // the lamp index per vertex.
  const town = townSurface(L), light = lin(COLOR.light);
  const fields = polyIndex((ctx.cover.cells || []).map(c => c.outer)), w4Fields = polyIndex(PL?.plotPolys || []), sites = W.landmarks.filter(lm => lm.id !== 'TOWN');
  const w4Farm = (lon, lat) => { const f = flatOf(lon, lat); return w4Fields(f.x, f.z); };
  const pos = [], col = [], lampIx = [], idx = [];
  const surfaceAt = (x, z, lamp) => {
    if (lamp.owner === 'bridge') { const Lb = lineOf[lamp.line], q = Lb.project(x, z, 8); if (q && !q.end && Math.abs(q.o) <= 4.6) return { y: (deckAlt(Lb.b, q.s) + 0.05 - BASE) * Lb.F[q.i].k, lit: true }; const ll = llOf(x, z); return { y: (deckAlt(Lb.b, lamp.station) + 0.05 - BASE) * flatOf(ll.lon, ll.lat).k, lit: false }; }
    const t = town(x, z); if (t) return t;
    const ll = llOf(x, z), k = flatOf(ll.lon, ll.lat).k, g = H(ll.lon, ll.lat); let y = g, road = false;
    for (const Lr2 of lamp.poolLines) { const q = Lr2.project(x, z, 10); if (!q || q.end || q.o < Lr2.rt.grid[0] || q.o > Lr2.rt.grid[Lr2.rt.grid.length - 1]) continue; const fp = lerpFoot(Lr2, q), a = RK.surfS(Lr2.rt, q.s, q.o); if (a > y) y = a; if (q.o >= fp[2] && q.o <= fp[3]) road = true; }
    const bare = !road && g >= 0.35 && !fields(x, z) && !w4Farm(ll.lon, ll.lat) && !sites.some(lm => W.arcDistance(ll, lm) < lm.radius);
    return { y: (y - BASE) * k, lit: road || bare };
  };
  lamps.forEach((lamp, li) => {
    const m = MODELS[lamp.model], c = lamp.pool, base = pos.length / 3, k = lamp.scale;
    lamp.poolLines = lines.filter(l => l.kind === 'route' && l.project(c.x, c.z, m.poolR + 8));
    POOL_RINGS.forEach((t, ri) => { for (let a = 0; a < (ri ? POOL_SEG : 1); a++) { const th = a / POOL_SEG * Math.PI * 2, x = c.x + Math.cos(th) * t * m.poolR * k, z = c.z + Math.sin(th) * t * m.poolR * k, s = surfaceAt(x, z, lamp), w = s.lit ? m.poolGain * poolProfile(t) : 0;
      pos.push(x, s.y + POOL_LIFT * k, z); col.push(light[0] * w, light[1] * w, light[2] * w); lampIx.push(li); } });
    for (let a = 0; a < POOL_SEG; a++) idx.push(base, base + 1 + (a + 1) % POOL_SEG, base + 1 + a);
    for (let ri = 1; ri + 1 < POOL_RINGS.length; ri++) for (let a = 0; a < POOL_SEG; a++) { const o0 = base + 1 + (ri - 1) * POOL_SEG, o1 = base + 1 + ri * POOL_SEG, a2 = (a + 1) % POOL_SEG; idx.push(o0 + a, o0 + a2, o1 + a, o0 + a2, o1 + a2, o1 + a); }
    delete lamp.poolLines;
  });
  // reflections of the lamps in the town's puddles: each puddle shows the light of the nearest lamp within 5.5 m (street lamps by their final pools, the alley
  // lamps by theirs), an ellipse over the puddle (the old glow decal: 1.4 x its short and 1.6 x its long axis); an alley lamp's index is the extra last slot
  const reflections = [], alleys = (ctx.town && ctx.town.alleyLamps) || [];
  for (const p of (ctx.town && ctx.town.puddles) || []) {
    let best = null;
    lamps.forEach((q, li) => { if (q.owner !== 'town') return; const d = Math.hypot(q.pool.x - p.x, q.pool.z - p.z); if (d < REFLECT.reach && (!best || d < best.d)) best = { d, li, c: COLOR.light, id: q.id }; });
    for (const a of alleys) { const d = Math.hypot(a.x - p.x, a.z - p.z); if (d < REFLECT.reach && (!best || d < best.d)) best = { d, li: lamps.length, c: a.c, id: null }; }
    if (!best) continue;
    const along = p.rx > p.rz ? [1, 0] : [0, 1], w = Math.min(p.rx, p.rz) * 1.4 / 2, h = Math.max(p.rx, p.rz) * 1.6 / 2, cc = lin(best.c), base = pos.length / 3, y = p.y + 0.004;
    POOL_RINGS.forEach((t, ri) => { for (let a = 0; a < (ri ? POOL_SEG : 1); a++) { const th = a / POOL_SEG * Math.PI * 2, u = Math.cos(th) * t * h, v = Math.sin(th) * t * w, g = REFLECT.gain * poolProfile(t);
      pos.push(p.x + along[0] * u - along[1] * v, y, p.z + along[1] * u + along[0] * v); col.push(cc[0] * g, cc[1] * g, cc[2] * g); lampIx.push(best.li); } });
    for (let a = 0; a < POOL_SEG; a++) idx.push(base, base + 1 + (a + 1) % POOL_SEG, base + 1 + a);
    for (let ri = 1; ri + 1 < POOL_RINGS.length; ri++) for (let a = 0; a < POOL_SEG; a++) { const o0 = base + 1 + (ri - 1) * POOL_SEG, o1 = base + 1 + ri * POOL_SEG, a2 = (a + 1) % POOL_SEG; idx.push(o0 + a, o0 + a2, o1 + a, o0 + a2, o1 + a2, o1 + a); }
    reflections.push({ puddle: [p.x, p.z], lamp: best.id, alley: best.id === null, d: best.d });
  }
  // the puddle ripples of the roads (RD01 card: two rings near each lamp's pool, the town keeps its own puddles): from the final lamps of the routes and bridges
  const ripples = [];
  for (const q of lamps) {
    const Lq = lineOf[q.line]; if (!Lq || q.owner === 'town' || (Lq.kind !== 'route' && Lq.kind !== 'bridge')) continue;
    for (let k = 0; k < 2; k++) {
      const o = (k ? -1 : 1) * (1.0 + 0.8 * hash(q.station, k)), n = Lq.S.length, s = q.station + (k ? -2.2 : 2.0), i = Math.max(0, Math.min(n - 1, Math.round((s - Lq.S[0].s) / 0.5)));
      if (Lq.kind === 'route') { const [lo, la] = Lq.rt.lateral(i, o); ripples.push({ lon: lo, lat: la, alt: Lq.rt.surface(i, o) + 0.012, phase: hash(q.station, k + 5), lamp: q.id }); }
      else { const [lo, la] = Lq.b.lateral(i, o); ripples.push({ lon: lo, lat: la, alt: Lq.b.alt[i] + 0.05, phase: hash(q.station, k + 5), lamp: q.id }); }
    }
  }
  const byModel = {}; for (const q of lamps) byModel[q.model] = (byModel[q.model] || 0) + 1;
  // WX2: the top of the roads at a flat point (true altitude), the receiving surface of the rain and the snow (weather_fx.js); null away from every road. A bridge deck
  // within 4.6 m of its axis (the deck its lamps light; under the deck nothing falls); a route's strip within its grid (the ground it replaces: cuttings, fills,
  // ditches), not inside a tunnel (the hill above is the surface there)
  const deckLines = lines.filter(l => l.kind === 'bridge'), routeLines = lines.filter(l => l.kind === 'route');
  const surface = (x, z) => {
    let y = null;
    for (const Lb of deckLines) { const q = Lb.project(x, z, 6); if (q && !q.end && Math.abs(q.o) <= 4.6) { const a = deckAlt(Lb.b, q.s); if (y === null || a > y) y = a; } }
    for (const Lr2 of routeLines) { const q = Lr2.project(x, z, 12); if (!q || q.end || q.o < Lr2.rt.grid[0] || q.o > Lr2.rt.grid[Lr2.rt.grid.length - 1]) continue;
      if (Lr2.tunnel && q.s > Lr2.tunnel[0] && q.s < Lr2.tunnel[1]) continue; const a = RK.surfS(Lr2.rt, q.s, q.o); if (y === null || a > y) y = a; }
    return y;
  };
  return { surface, lamps, removed, mapping, junctions: log, coverage, reflections, ripples, pool: { pos: Float32Array.from(pos), col: Float32Array.from(col), lamp: Float32Array.from(lampIx), index: Uint32Array.from(idx), alleySlot: lamps.length },
    stats: { lamps: lamps.length, byModel, removed: removed.length, obstacles: OB.count, poolVertices: pos.length / 3, poolTriangles: idx.length / 3, reflections: reflections.length, ripples: ripples.length } };
}

// ---- point-in-polygon over many polygons (flat frame, 8 m cells)
function polyIndex(polys) {
  const C = 8, cells = new Map(), key = (a, b) => a * 1000003 + b;
  polys.forEach((p, id) => { const xs = p.map(v => v[0]), zs = p.map(v => v[1]); for (let a = Math.floor(Math.min(...xs) / C); a <= Math.floor(Math.max(...xs) / C); a++) for (let b = Math.floor(Math.min(...zs) / C); b <= Math.floor(Math.max(...zs) / C); b++) { const k = key(a, b); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(id); } });
  return (x, z) => (cells.get(key(Math.floor(x / C), Math.floor(z / C))) || []).some(id => inPoly(polys[id], x, z));
}
// ---- the town's ground for the light pools (flat frame): the raised pavement islands with their rounded corners (layout.js, the shapes scene.js extrudes),
// the curb ramps between carriageway and pavement, the plots (they cover the pavement: no light), the carriageways and alleys of the unified road
function townSurface(L) {
  const LV = L.LEVELS, H0 = L.BASE.half, Rc = L.INTERSECTION.curbRadius;
  const islands = L.islands.map(is => {
    const [x0, z0, x1, z1] = is.rect, C = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], names = ['NW', 'NE', 'SE', 'SW'], mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, pts = [];
    for (let i = 0; i < 4; i++) {
      const c = C[i], p = C[(i + 3) % 4], n = C[(i + 1) % 4];
      if (!is.round[names[i]]) { pts.push(c); continue; }
      const din = [Math.sign(c[0] - p[0]), Math.sign(c[1] - p[1])], dout = [Math.sign(n[0] - c[0]), Math.sign(n[1] - c[1])], o = [c[0] + Math.sign(mx - c[0]) * Rc, c[1] + Math.sign(mz - c[1]) * Rc];
      const A0 = Math.atan2(c[1] - din[1] * Rc - o[1], c[0] - din[0] * Rc - o[0]); let d = Math.atan2(c[1] + dout[1] * Rc - o[1], c[0] + dout[0] * Rc - o[0]) - A0;
      while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      for (let k = 0; k <= 12; k++) pts.push([o[0] + Rc * Math.cos(A0 + d * k / 12), o[1] + Rc * Math.sin(A0 + d * k / 12)]);
    }
    return pts;
  });
  const cuts = L.curbCuts.map(k => { const a = k.at, b = k.at + k.dir * k.depth; return { k, rect: k.line === 'x' ? [Math.min(a, b), k.s0, Math.max(a, b), k.s1] : [k.s0, Math.min(a, b), k.s1, Math.max(a, b)], a, b }; });
  const alleys = L.alleys.map(a => a.rect);
  return (x, z) => {
    if (Math.abs(x) > H0 || Math.abs(z) > H0) return null;
    const lift = Math.cosh(z / R);
    for (const p of L.plots) if (x > p.rect[0] && x < p.rect[2] && z > p.rect[1] && z < p.rect[3]) return { y: LV.pavement, lit: false };
    for (const c of cuts) if (x >= c.rect[0] && x <= c.rect[2] && z >= c.rect[1] && z <= c.rect[3]) { const v = c.k.line === 'x' ? x : z, t = clamp01((v - c.a) / (c.b - c.a)); return { y: LV.carriageway * lift + (LV.pavement - LV.carriageway * lift) * t, lit: true }; }
    for (const r of alleys) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]) return { y: LV.pavement * lift, lit: true };
    for (const p of islands) if (inPoly(p, x, z)) return { y: LV.pavement, lit: true };
    return { y: LV.carriageway * lift, lit: true };
  };
}

const STREETLIGHTS = { plan, MODELS, COLOR, COLLAR, SPACING, LIMIT, CLEAR, PIXELS, POOL_RINGS, POOL_SEG, REFLECT, flatOf, llOf };

// ---------------------------------------------------------------- scene part
STREETLIGHTS.attach = function (scene, ctx, BEND, TERR, LOOK_API) {
  const THREE = global.THREE, W = global.WORLD;
  const S = { built: false, data: null, stats: {}, root: null, lastKey: '', win: null, px: null };
  const objs = { bodies: [], hulls: [], lenses: [], pool: null, materials: null };
  const qQ = new THREE.Quaternion(), qE = new THREE.Euler(), mP = new THREE.Vector3(), mS = new THREE.Vector3(), mM = new THREE.Matrix4(), white = new THREE.Color(1, 1, 1);
  // one geometry recipe for every model: base cover, tapered pole, the curved arm of the town lamp, the head housing; the lens is the self-lit part (local +z = towards the road)
  function geometries(K, m) {
    const hs = m.head, r0 = m.rBase, r1 = r0 * 0.8, top = m.poleH, reach = m.reach, b = K.builder();
    b.add(new THREE.CylinderGeometry(COLLAR.r * 0.85, COLLAR.r, COLLAR.h, 8).translate(0, COLLAR.h / 2, 0), COLOR.collar);
    b.add(new THREE.CylinderGeometry(r1, r0, top, 8).translate(0, top / 2, 0), COLOR.pole);
    const arm = new THREE.CatmullRomCurve3([[0, top - 0.05, 0], [0, top + 0.2, 0.05], [0, top + 0.26, reach * 0.53], [0, top + 0.2, reach]].map(p => new THREE.Vector3(...p)));
    b.add(new THREE.TubeGeometry(arm, 14, 0.045 * (r0 / 0.06), 6, false), COLOR.arm);
    b.add(new THREE.BoxGeometry(0.25 * hs, 0.12 * hs, 0.48 * hs).translate(0, top + 0.16, reach), COLOR.housing);
    const lens = K.builder().add(new THREE.BoxGeometry(0.19 * hs, 0.015, 0.39 * hs).translate(0, top + 0.09, reach), COLOR.light).build();
    return { body: b.build(), lens };
  }
  function* build() {
    const RDA = global.ROADS_API, COV = global.LANDCOVER_API, K = LOOK_API.kit(), H = TERR.sampler();
    const WS = Object.assign(Object.create(W), { height: H });
    yield;
    const DATA = plan({ W: WS, L: global.LAYOUT, roads: RDA.data(), RK: global.ROADS, cover: COV.data(), town: RDA.state.townDetails });
    S.data = DATA;
    yield;
    const root = new THREE.Group(); root.name = 'streetlights'; root.visible = false; scene.add(root); S.root = root;
    // body and ink: the land cover's dithered copies of the shared object and hull materials (the same programs; the hull's opacity follows the ground ink there)
    const LC = global.LANDCOVER, LM = COV.objects.lodMaterials, body = LM.flora, hull = LM.hull;
    const lens = new THREE.MeshToonMaterial({ color: COLOR.lens, emissive: COLOR.light, gradientMap: ctx.ramp });
    lens.onBeforeCompile = shader => LC.lodDither(shader); lens.customProgramCacheKey = () => 'bend|lod|sl-lens';
    const N = DATA.lamps.length + 1, winU = { value: Array.from({ length: N }, () => new THREE.Vector2(0, 1)) };
    const poolMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    poolMat.onBeforeCompile = shader => { shader.uniforms.uLampWin = winU; LC.lodDither(shader, `attribute float aLamp;\nuniform vec2 uLampWin[${N}];`, 'uLampWin[int(aLamp + 0.5)]'); global.WEATHER_FX.poolWet(shader); };   // WX3: brighter on wet ground
    poolMat.customProgramCacheKey = () => 'bend|lod|sl-pool|' + N;
    objs.materials = { body, hull, lens, pool: poolMat, win: winU };
    // per model: the instances in table order (their windows are written by lamp in tick)
    const models = Object.keys(MODELS).filter(k => DATA.lamps.some(q => q.model === k));
    S.slots = [];
    for (const key of models) {
      const list = DATA.lamps.map((q, i) => ({ q, i })).filter(e => e.q.model === key), G = geometries(K, MODELS[key]), n = list.length;
      const withWin = geo => { geo.setAttribute('aWin', new THREE.InstancedBufferAttribute(new Float32Array(n * 2).fill(1).map((v, j) => (j % 2 ? 1 : 0)), 2).setUsage(THREE.DynamicDrawUsage)); return geo; };
      withWin(G.body); withWin(G.lens);
      const mk = (geo, mat, name) => { const m = new THREE.InstancedMesh(geo, mat, n); m.name = name; return m; };
      const bm = mk(G.body, body, 'streetlights:' + key), hm = mk(G.body, hull, 'streetlights:' + key + ':ink'), lm = mk(G.lens, lens, 'streetlights:' + key + ':lens');
      list.forEach(({ q }, j) => { qE.set(0, q.yaw, 0, 'YXZ'); qQ.setFromEuler(qE); mM.compose(mP.set(q.x, q.y, q.z), qQ, mS.set(q.scale, q.scale, q.scale)); bm.setMatrixAt(j, mM); bm.setColorAt(j, white); });
      hm.instanceMatrix = bm.instanceMatrix; lm.instanceMatrix = bm.instanceMatrix;
      for (const m of [bm, hm, lm]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); root.add(m); }
      bm.instanceColor.needsUpdate = true;
      objs.bodies.push(bm); objs.hulls.push(hm); objs.lenses.push(lm);
      S.slots.push({ model: key, lamps: list.map(e => e.i), body: G.body.attributes.aWin, lens: G.lens.attributes.aWin, meshes: [bm, hm, lm] });
    }
    { const P = DATA.pool, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(P.col, 3)); g.setAttribute('aLamp', new THREE.BufferAttribute(P.lamp, 1));
      const nrm = new Float32Array(P.pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setIndex(new THREE.BufferAttribute(P.index, 1)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, poolMat); m.name = 'streetlights:pool'; m.matrixAutoUpdate = false; root.add(m); objs.pool = m; }
    // the lamps' size and place for the selection: flat and sphere position of the mid pole, the pole's height on the flat map (h) and on the sphere (h / cos-lat factor)
    const n = DATA.lamps.length; S.sel = { n, F: new Float64Array(n * 3), P: new Float64Array(n * 3), h: new Float64Array(n), hs: new Float64Array(n) };
    DATA.lamps.forEach((q, i) => { const m = MODELS[q.model], y = q.y + m.poleH / 2 * q.scale, p = BEND.point(q.x, y, q.z, 1); S.sel.F.set([q.x, y, q.z], i * 3); S.sel.P.set(p, i * 3); S.sel.h[i] = m.poleH * q.scale; S.sel.hs[i] = m.poleH * q.scale / q.k; });
    S.win = new Float32Array(n * 2); S.px = new Float32Array(n);
    RDA.setLampRipples(DATA.ripples);
    if (BEND.seamSplit) BEND.seamSplit(root);          // a pool that crosses the -85 deg seam is cut along it (aLamp is copied to the cut points)
    S.stats = { ...DATA.stats, drawObjects: root.children.length };
    root.visible = true; S.built = true;
    return root;
  }
  const job = global.TERRAIN.job(build, ms => { S.stats.buildMs = ms; });
  // the selection from the camera alone (position, field of view, height of the drawing buffer, bend, seam): no history. px = the pole's height in the display
  // frame (flat -> sphere by uBend) x pixels per metre / distance; window [0, f) with f = (px - 1) / (2 - 1), the same for body, ink, lens and pool
  function select(camera, force) {
    if (!S.built) return;
    const u = BEND.get(), Hpx = ctx.renderer ? ctx.renderer.domElement.height : 800, wrap = BEND.wrapUniform ? BEND.wrapUniform.value.x : 0, cp = camera.position;
    const key = [cp.x, cp.y, cp.z, camera.fov, Hpx, u, wrap].join(',');
    if (!force && key === S.lastKey) return; S.lastKey = key;
    const PPM = Hpx / (2 * Math.tan(camera.fov * D / 2)), T = S.sel;
    for (let i = 0; i < T.n; i++) {
      const fx = T.F[i * 3], sx = fx + BEND.shift(fx), dx = sx + (T.P[i * 3] - sx) * u - cp.x, dy = T.F[i * 3 + 1] + (T.P[i * 3 + 1] - T.F[i * 3 + 1]) * u - cp.y, dz = T.F[i * 3 + 2] + (T.P[i * 3 + 2] - T.F[i * 3 + 2]) * u - cp.z;
      const px = (T.h[i] + (T.hs[i] - T.h[i]) * u) * PPM / Math.max(0.01, Math.sqrt(dx * dx + dy * dy + dz * dz));
      S.px[i] = px; S.win[i * 2] = 0; S.win[i * 2 + 1] = clamp01((px - PIXELS[0]) / (PIXELS[1] - PIXELS[0]));
    }
    for (const sl of S.slots) { let any = false; sl.lamps.forEach((li, j) => { const f = S.win[li * 2 + 1]; sl.body.array[j * 2] = 0; sl.body.array[j * 2 + 1] = f; sl.lens.array[j * 2] = 0; sl.lens.array[j * 2 + 1] = f; if (f > 0) any = true; });
      sl.body.needsUpdate = true; sl.lens.needsUpdate = true; sl.visible = any; }
    const W2 = objs.materials.win.value; for (let i = 0; i < T.n; i++) W2[i].set(0, S.win[i * 2 + 1]);
  }
  function tick(t, camera) {
    if (!S.built) return;
    select(camera, false);
    const ink = LOOK_API.state.ink, u = BEND.get();
    for (const sl of S.slots) { sl.meshes[0].visible = sl.visible; sl.meshes[1].visible = sl.visible && ink.ground > 0.01; sl.meshes[2].visible = sl.visible; }
    objs.pool.visible = u < 1 && S.slots.some(sl => sl.visible);               // additive: bend.js fades it with 1 - uBend; at uBend = 1 it adds nothing and is not drawn
  }
  const api = { tick, job, state: S, objects: objs, data: () => S.data, select: camera => select(camera, true), stats: () => ({ ...S.stats }) };
  global.STREETLIGHTS_API = api;
  return api;
};

if (typeof module !== 'undefined' && module.exports) module.exports = STREETLIGHTS;
else global.STREETLIGHTS = STREETLIGHTS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
