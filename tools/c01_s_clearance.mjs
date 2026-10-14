// Independent C01-S fixture check against the road network's sampled centre lines.
// Run after build.py; checks section furniture and plants, which U4's road-instance pass omits.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const W = require(path.join(root, 'world.js'));
const P = require(path.join(root, 'section_plan.js')).plan(W);
const flat = q => W.lonLatToTown(q.lon, q.lat);
const segmentDistance = (p, a, b) => {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};
const ids = [...W.roadNetwork.m01South, ...W.roadNetwork.edges.filter(e => e.route === 'CR01').map(e => e.id)];
const roads = ids.map(id => {
  const e = W.roadNetwork.edges.find(q => q.id === id);
  return { id, half: { RD03: 3.55, RD04: 2.75, RD05: 2.0 }[e.class], pts: W.roadNetwork.samplePath(e, 0.25).map(flat) };
});
const errors = [], counts = {};
// W10c: the two entrance lamps are road lamps registered by streetlights.js at the sites section_plan.js keeps (lampSites); they are checked here at those sites
for (const [type, list] of [...Object.entries(P.items), ['lamp', P.lampSites]]) for (const it of list) {
  if (it.v < 0 || it.v > 24 || Math.abs(it.u) > 13) continue;
  // The bamboo mesh extends two metres to one side of its origin (flora.js).
  const p = flat(it), r = Math.max(it.clearance, type === 'fenceBamboo' ? 2.1 : 0) + 0.5;
  for (const road of roads) {
    const d = road.pts.slice(1).reduce((best, q, i) => Math.min(best, segmentDistance(p, road.pts[i], q)), Infinity);
    if (d < road.half + r - 0.01) {
      errors.push(`${type} (${it.u.toFixed(2)},${it.v.toFixed(2)}) vs ${road.id}: ${(d - road.half - r).toFixed(2)} m`);
      break;
    }
  }
  counts[type] = (counts[type] || 0) + 1;
}
const poleSet = new Set(P.items.pole || []);
if (P.wires.some(w => !poleSet.has(w.a) || !poleSet.has(w.b))) errors.push('wire references a removed pole');
for (const type of ['lamp', 'signRound', 'signBus', 'mirror', 'fenceBamboo', 'pole']) if (!counts[type]) errors.push(`${type} missing from entrance`);
console.log(`${errors.length ? 'FAIL' : 'PASS'} C01-S section clearance: ${Object.values(counts).reduce((a, b) => a + b, 0)} retained items, ${P.wires.length} connected wires, ${errors.length} conflicts`);
if (errors.length) { console.log(errors.slice(0, 30).join('\n')); process.exitCode = 1; }
