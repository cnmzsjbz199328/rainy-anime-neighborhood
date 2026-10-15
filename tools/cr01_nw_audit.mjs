// Read-only diagnosis of the CR01 / RN05 overlap in the generated index.html (docs/world/CR01_NW_REPAIR_PLAN.md section 3).
// This reports geometry, not visual acceptance. Run: node tools/cr01_nw_audit.mjs  (the complete check of the repair: node tools/cr01_merge_check.mjs)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  await page.waitForFunction(() => window.__scene?.worldgen?.state.done, null, { timeout: 120000 });
  const result = await page.evaluate(() => {
    const S = window.__scene, T = window.THREE, data = S.roads.data();
    const ring = data.routes.find(r => r.def.id === 'CR01');
    const branch = data.routes.find(r => r.def.id === 'RN05-RD03');
    const meshes = [];
    S.scene.updateMatrixWorld(true);
    S.roads.state.root.traverse(o => {
      if (o.isMesh && (o.name.includes('road:route RN04-01+') || o.name === 'road:route RN05-01')) meshes.push(o);
    });
    const rm = meshes.find(o => o.name.includes('RN04-01+')), bm = meshes.find(o => o !== rm);
    if (!rm || !bm || !ring.strip.clipOffset) throw new Error('Expected road meshes / clipOffset missing; adapt this diagnostic explicitly.');
    const ray = new T.Raycaster();
    const pavedHit = h => {
      const a = rm.geometry.attributes.position, f = h.face;
      const v = [f.a, f.b, f.c].map(i => new T.Vector3().fromBufferAttribute(a, i));
      const local = rm.worldToLocal(h.point.clone());
      const b = T.Triangle.getBarycoord(local, ...v, new T.Vector3());
      const offset = b.x * ring.strip.clipOffset[f.a] + b.y * ring.strip.clipOffset[f.b] + b.z * ring.strip.clipOffset[f.c];
      return offset > -2.25 + 1e-4 && offset < 2.75 - 1e-4;
    };
    const counts = { all: 0, paved: 0, branchAbovePaved: 0, nearCoplanarPaved: 0 }, examples = [];
    for (let x = -59; x <= -32; x += 0.5) for (let z = -60; z <= -48; z += 0.5) {
      ray.set(new T.Vector3(x, 30, z), new T.Vector3(0, -1, 0));
      const rh = ray.intersectObject(rm)[0], bh = ray.intersectObject(bm)[0];
      if (!rh || !bh) continue;
      counts.all++;
      if (!pavedHit(rh)) continue;
      counts.paved++;
      const dy = bh.point.y - rh.point.y;
      if (dy > 1e-4) counts.branchAbovePaved++;
      if (Math.abs(dy) < 0.001) counts.nearCoplanarPaved++;
      if (examples.length < 3 || x === -46 && z === -54) examples.push({ x, z, dy });
    }
    const ink = {};
    for (const key of ['edgeL', 'edgeR']) {
      const stations = [];
      branch.lines[key].forEach((q, i) => {
        const x = 90 * q.lon * Math.PI / 180, z = -90 * Math.asinh(Math.tan(q.lat * Math.PI / 180));
        ray.set(new T.Vector3(x, 30, z), new T.Vector3(0, -1, 0));
        const h = ray.intersectObject(rm)[0];
        if (h && pavedHit(h)) stations.push(branch.samples[i].s);
      });
      ink[key] = { samplesInsideRingPaving: stations.length, sRange: stations.length ? [Math.min(...stations), Math.max(...stations)] : [] };
    }
    // the final ink of RN05 (rt.ink, what road:ink:aerial draws since the CR01 merge): its points on the ring's paving, the ends of a cut excluded
    const finalInk = { points: 0, insideRingPaving: 0 };
    for (const run of branch.ink || []) for (const q of run) {
      const x = 90 * q.lon * Math.PI / 180, z = -90 * Math.asinh(Math.tan(q.lat * Math.PI / 180)); finalInk.points++;
      ray.set(new T.Vector3(x, 30, z), new T.Vector3(0, -1, 0)); const h = ray.intersectObject(rm)[0];
      if (h && pavedHit(h)) { const a = rm.geometry.attributes.position, f = h.face, v = [f.a, f.b, f.c].map(i => new T.Vector3().fromBufferAttribute(a, i)), b = T.Triangle.getBarycoord(rm.worldToLocal(h.point.clone()), ...v, new T.Vector3()), o = b.x * ring.strip.clipOffset[f.a] + b.y * ring.strip.clipOffset[f.b] + b.z * ring.strip.clipOffset[f.c]; if (o > -2.25 + 0.01 && o < 2.75 - 0.01) finalInk.insideRingPaving++; }
    }
    return { region: { x: [-59, -32], z: [-60, -48], step: 0.5 }, counts, examples, sourceInk: ink, finalInk, merge: data.cr01 ? { weld: data.cr01.stats.weld, removedArea: data.cr01.stats.removedArea['RN05-RD03'], inkCut: data.cr01.stats.ink['RN05-RD03'] } : null,
      note: 'all includes side bands; paved uses the actual CR01 hit triangle offset. sourceInk describes the source polylines (kept for diagnosis), finalInk the points of the drawn ink, not pixel visibility. Counts are probes, not area. The complete check is tools/cr01_merge_check.mjs.' };
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
