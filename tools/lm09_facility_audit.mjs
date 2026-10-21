// Read-only geometry audit for LM09's bus sign and stop lamp. No browser or screenshots.
// Run: node tools/lm09_facility_audit.mjs > docs/world/audits/lm09-facilities-2026-10-21.json
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url), read = p => fs.readFileSync(path.join(root, p), 'utf8');
globalThis.LAYOUT = require('../layout.js');
const W = require('../world.js'), TERR = require('../terrain.js');
globalThis.ROADKIT = require('../roadkit.js');
globalThis.BRIDGE = require('../bridge.js');
globalThis.STEPS = require('../steps.js');
const ROADS = require('../roads.js'), H = TERR.sampler(W, { lonMin: -181, lonMax: 181, latMin: -90, latMax: 90 });
const TB = TERR.builder(W), RD = ROADS.plan(W, H, (lo, la) => TB.vertex(lo, la).c);
const lm = W.landmarks.find(q => q.id === 'LM09'), h = H(lm.lon, lm.lat), D = Math.PI / 180;
// Same point transform as scene.js landmarkJob.map, including height-dependent horizontal compensation.
function map(x, y, z) {
  const d = Math.hypot(x, z) * 90 / (90 + Math.max(-1.6, h + y - 1.6));
  const ll = W.destination(lm, lm.entrances[0].heading + Math.atan2(-x, z) / D, d);
  const f = W.lonLatToTown(ll.lon, ll.lat);
  return { x: f.x, y: (h + y - 1.6) / Math.cos(ll.lat * D), z: f.z };
}
const surfaces = [...RD.routes.map(r => ({ id: r.def.id, strip: r.strip })),
  ...RD.bridges.map(b => ({ id: b.def.id, strip: b.strips.find(s => s.name.endsWith(' top')) }))];
// Vertical intersection against the generated, indexed road/bridge triangles, not a class-width assumption.
function under(p) {
  const hits = [];
  for (const { id, strip: s } of surfaces) {
    let highest = null;
    for (let i = 0; i < s.index.length; i += 3) {
      const [a, b, c] = [0, 1, 2].map(j => s.index[i + j] * 3), v = s.pos;
      const ax = v[a], az = v[a + 2], bx = v[b], bz = v[b + 2], cx = v[c], cz = v[c + 2];
      const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(den) < 1e-12) continue;
      const u = ((bz - cz) * (p.x - cx) + (cx - bx) * (p.z - cz)) / den;
      const t = ((cz - az) * (p.x - cx) + (ax - cx) * (p.z - cz)) / den;
      if (u < -1e-8 || t < -1e-8 || u + t > 1 + 1e-8) continue;
      const y = u * v[a + 1] + t * v[b + 1] + (1 - u - t) * v[c + 1];
      if (!highest || y > highest.y) highest = { id, triangle: i / 3, y };
    }
    if (highest) hits.push(highest);
  }
  return hits;
}
function nearest(p) {
  let best;
  for (const r of RD.routes) for (let i = 0; i + 1 < r.samples.length; i++) {
    const a = r.flatOf[i], b = r.flatOf[i + 1], dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
    const x = a.x + t * dx, z = a.z + t * dz, d = Math.hypot(p.x - x, p.z - z);
    if (best && best.distanceFlat <= d) continue;
    const k = a.k + t * (b.k - a.k), cf = r.cf[i] + t * (r.cf[i + 1] - r.cf[i]);
    const o = ((p.x - x) * -dz + (p.z - z) * dx) / Math.hypot(dx, dz) / k / cf;
    best = { route: r.def.id, station: r.samples[i].s + t * (r.samples[i + 1].s - r.samples[i].s),
      distanceFlat: d, offsetGrid: o, row: i, paved: r.paved[i], cf, k };
  }
  return best;
}
function measure(name, x, z, height) {
  const foot = map(x, 0, z), top = map(x, height, z), road = under(foot), nr = nearest(foot);
  let low = 0, high = height;
  for (let i = 0; i < 40; i++) {
    const y = (low + high) / 2, p = map(x, y, z), hits = under(p);
    const surface = hits.find(q => q.id === nr.route);
    if (surface && p.y < surface.y) low = y; else high = y;
  }
  const crossing = map(x, (low + high) / 2, z);
  return { name, local: { x, z, height }, foot, top, roadUnderFoot: road, nearest: nr,
    poleRoadCrossing: { localY: (low + high) / 2, point: crossing, surfaces: under(crossing) } };
}
const source = read('landmarks/LM09.js');
const boardX = Number(source.match(/BOARD_X = ([\d.]+)/)[1]), lampX = Number(source.match(/STOP_LAMP_X = ([\d.]+)/)[1]);
const sourceFiles = ['scene.js', 'landmarks/LM09.js', 'roads.js', 'roadkit.js', 'bridge.js', 'terrain.js', 'world.js', 'streetlights.js'];
const html = read('index.html');
const output = {
  scope: 'LM09 stop lamp and timetable sign; flat generated geometry; pole centreline intersects actual indexed road triangles. Not visual acceptance or complete model-envelope clearance.',
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirtyAtAudit: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim().split('\n'),
  embeddedSourcesMatch: Object.fromEntries(sourceFiles.map(p => [p, html.includes('<script>\n' + read(p).replaceAll('</script', '<\\/script') + '\n</script>')])),
  landmark: { id: lm.id, anchor: [lm.lon, lm.lat], sampledAltitude: h },
  current: [measure('BOARD_X: sign and timetable', boardX, 9, 2.51), measure('STOP_LAMP_X: stop lamp', lampX, 8, 5.2)],
  bridgeEnd: { id: 'RN01-13', point: W.lonLatToTown(...(() => { const p = RD.bridges.find(b => b.def.id === 'RN01-13').samples.at(-1); return [p.lon, p.lat]; })()) },
  candidateOnly: [measure('sign candidate; full envelope and site obstacles not checked', 5, 4.5, 2.51), measure('lamp candidate; full envelope and site obstacles not checked', 6, 4, 5.2)]
};
console.log(JSON.stringify(output, null, 2));
