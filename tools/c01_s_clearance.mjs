// Independent C01-S fixture check against the road network's sampled centre lines: the section's furniture and plants (and its two entrance lamp sites)
// against CR01 round the corridor and the roads of the C01-S mouth (M01 south). Run after build.py; U4's road-instance pass omits these.
// CR01_HOUSE_GRASS_INTRUSION_PLAN.md: the ring's edges are the world.js edges between two C01-* nodes (they belong to route RN04; the selection by
// route 'CR01' found none, so the ring was never tested), distances are true metres (the flat distance over the Mercator scale at the item), the ring's
// full section is 3.55 m outside (the ditch) and 2.75 m inside, and every item is its template's plan box (section_plan.js FOOTPRINT, turned by its yaw
// and scaled, the outline every 0.25 m) or, a tree or a lamp site, its clearance circle + 0.5 m.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const W = require(path.join(root, 'world.js'));
const SP = require(path.join(root, 'section_plan.js')), P = SP.plan(W), FOOTPRINT = SP.FOOTPRINT, R = 90;
const flat = q => W.lonLatToTown(q.lon, q.lat);
const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return { d: Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz), q: { x: a.x + t * dx, z: a.z + t * dz } };
};
const NET = W.roadNetwork, ring = NET.edges.filter(e => /^C01-/.test(e.from) && /^C01-/.test(e.to));
const roads = [...NET.m01South.map(id => NET.edges.find(q => q.id === id)), ...ring].map(e => ({ id: e.id, ring: ring.includes(e), half: { RD03: 3.55, RD04: 2.75, RD05: 1.55 }[e.class], pts: NET.samplePath(e, 0.25).map(flat) }));
// the full section's half width on the point's side in true metres, less the point's true distance from the centre line (> 0: clear)
const clearOf = (p, road) => {
  let best = { d: Infinity, q: null }; for (let i = 1; i < road.pts.length; i++) { const r = segmentDistance(p, road.pts[i - 1], road.pts[i]); if (r.d < best.d) best = r; }
  const half = road.ring ? (Math.max(Math.abs(p.x), Math.abs(p.z)) < Math.max(Math.abs(best.q.x), Math.abs(best.q.z)) ? 2.75 : 3.55) : road.half;
  return best.d / Math.cosh(p.z / R) - half;
};
const outline = it => { const e = FOOTPRINT[it.type], c = Math.cos(it.yaw), s = Math.sin(it.yaw), pts = [[0, 0]], cs = [[e[0], e[2]], [e[1], e[2]], [e[1], e[3]], [e[0], e[3]]];
  for (let i = 0; i < 4; i++) { const a = cs[i], b = cs[(i + 1) % 4], n = Math.max(1, Math.ceil(Math.hypot((b[0] - a[0]) * it.s[0], (b[1] - a[1]) * it.s[2]) / 0.25)); for (let j = 0; j < n; j++) pts.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]); }
  return pts.map(([x, z]) => { const [lon, lat] = P.toLL(it.u + x * it.s[0] * c + z * it.s[2] * s, it.v - x * it.s[0] * s + z * it.s[2] * c); return flat({ lon, lat }); }); };
const errors = [], counts = {};
// W10c: the two entrance lamps are road lamps registered by streetlights.js at the sites section_plan.js keeps (lampSites); they are checked here at those sites
for (const [type, list] of [...Object.entries(P.items), ['lamp', P.lampSites]]) for (const it of list) {
  if (it.v < 0 || it.v > 24 || Math.abs(it.u) > 13) continue;
  const shape = FOOTPRINT[type] ? outline(it) : null, p = flat(it), r = it.clearance + 0.5;
  for (const road of roads) {
    const d = shape ? Math.min(...shape.map(q => clearOf(q, road))) : clearOf(p, road) - r;
    if (d < -0.01) {
      errors.push(`${type} (${it.u.toFixed(2)},${it.v.toFixed(2)}) vs ${road.id}${road.ring ? ' (CR01)' : ''}: ${d.toFixed(2)} m`);
      break;
    }
  }
  counts[type] = (counts[type] || 0) + 1;
}
const poleSet = new Set(P.items.pole || []);
if (P.wires.some(w => !poleSet.has(w.a) || !poleSet.has(w.b))) errors.push('wire references a removed pole');
for (const type of ['lamp', 'signRound', 'signBus', 'mirror', 'pole']) if (!counts[type]) errors.push(`${type} missing from entrance`);
console.log(`${errors.length ? 'FAIL' : 'PASS'} C01-S section clearance: ${Object.values(counts).reduce((a, b) => a + b, 0)} retained items against ${roads.length} edges (${ring.length} of CR01), ${P.wires.length} connected wires, ${errors.length} conflicts`);
if (errors.length) { console.log(errors.slice(0, 30).join('\n')); process.exitCode = 1; }
