// Measures the existing samples and the new buildings (layout.js `structures`) in a real browser (WebGL via Chromium) and renders
// a top-down orthographic sprite of each sample/building set for the layout check image.
//
//   node tools/measure_samples.mjs
//
// Writes tools/out/sample_bounds.json and tools/out/sprite_<set>.png, and compares the
// measurement with the bounds recorded in layout.js (fails on drift > 0.02).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { launchChromium } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tools', 'out');
fs.mkdirSync(outDir, { recursive: true });
const LAYOUT = createRequire(import.meta.url)(path.join(root, 'layout.js'));
const PX_PER_UNIT = 40;

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.waitForFunction(() => window.__scene && window.__scene.groups);
await page.waitForTimeout(500);

const sets = Object.fromEntries(LAYOUT.structures.map(s => [s.id, s.parts.map(p => p.group)]));
const result = await page.evaluate(({ sets, ppu }) => {
  const { scene, groups } = window.__scene;
  const r2 = v => Math.round(v * 100) / 100;
  // Groups are placed by layout.js transforms; measure in each group's own (sample-local) frame.
  const placed = Object.values(groups).map(g => [g, g.position.clone(), g.quaternion.clone(), g.scale.clone(), g.visible]);
  for (const [g] of placed) { g.position.set(0, 0, 0); g.quaternion.identity(); g.scale.set(1, 1, 1); g.visible = true; g.updateMatrixWorld(true); }
  const bounds = {};
  for (const [name, g] of Object.entries(groups)) {
    const b = new THREE.Box3().setFromObject(g, true);
    bounds[name] = { min: [r2(b.min.x), r2(b.min.y), r2(b.min.z)], max: [r2(b.max.x), r2(b.max.y), r2(b.max.z)] };
    // Walking-height footprint: meshes reaching into y 0.3–1.8 (canopies, signs and mats excluded;
    // rain drips and glows are additive effects, not obstacles).
    const f = new THREE.Box3(), m = new THREE.Box3();
    g.traverse(o => { if (!o.isMesh || (o.material.isMeshBasicMaterial && o.material.depthWrite === false)) return; m.setFromObject(o, true); if (m.max.y > 0.3 && m.min.y < 1.8) f.union(m); });
    bounds[name].ground = f.isEmpty() ? null : [r2(f.min.x), r2(f.min.z), r2(f.max.x), r2(f.max.z)];
  }
  // Top-down sprites: only the set's groups visible, no fog, transparent background.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22;
  renderer.setClearColor(0x000000, 0);
  const saved = { bg: scene.background, fog: scene.fog, vis: scene.children.map(c => c.visible) };
  scene.background = null; scene.fog = null;
  const sprites = {};
  for (const [id, names] of Object.entries(sets)) {
    scene.children.forEach(c => { c.visible = c.isLight || names.includes(c.name); });
    const b = new THREE.Box3(); names.forEach(n => b.expandByObject(groups[n], true));
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    const cam = new THREE.OrthographicCamera(b.min.x - cx, b.max.x - cx, cz - b.min.z, -(b.max.z - cz), .1, 200);
    cam.up.set(0, 0, -1); cam.position.set(cx, 80, cz); cam.lookAt(cx, 0, cz);
    renderer.setSize(Math.round((b.max.x - b.min.x) * ppu), Math.round((b.max.z - b.min.z) * ppu));
    renderer.render(scene, cam);
    sprites[id] = { minX: b.min.x, minZ: b.min.z, maxX: b.max.x, maxZ: b.max.z, png: renderer.domElement.toDataURL('image/png') };
  }
  scene.children.forEach((c, i) => { c.visible = saved.vis[i]; });
  scene.background = saved.bg; scene.fog = saved.fog; renderer.dispose();
  for (const [g, p, q, k, v] of placed) { g.position.copy(p); g.quaternion.copy(q); g.scale.copy(k); g.visible = v; g.updateMatrixWorld(true); }
  return { bounds, sprites };
}, { sets, ppu: PX_PER_UNIT });
await browser.close();

const sprites = {};
for (const [id, s] of Object.entries(result.sprites)) {
  const file = `sprite_${id}.png`;
  fs.writeFileSync(path.join(outDir, file), Buffer.from(s.png.split(',')[1], 'base64'));
  sprites[id] = { file, minX: s.minX, minZ: s.minZ, maxX: s.maxX, maxZ: s.maxZ };
}
fs.writeFileSync(path.join(outDir, 'sample_bounds.json'), JSON.stringify({ groups: result.bounds, sprites }, null, 1));

// Compare with the bounds recorded in layout.js.
let drift = 0;
for (const s of LAYOUT.structures) for (const part of s.parts) {
  const m = result.bounds[part.group];
  if (!m) { console.log(`MISSING group ${part.group}`); drift++; continue; }
  const rec = part.localBounds;
  const d = Math.max(...[0, 1, 2].flatMap(k => [Math.abs(m.min[k] - rec.min[k]), Math.abs(m.max[k] - rec.max[k])]));
  const gd = rec.ground && m.ground ? Math.max(...rec.ground.map((v, k) => Math.abs(v - m.ground[k]))) : (rec.ground || m.ground ? 1 : 0);
  if (d > 0.02 || gd > 0.02) { console.log(`DRIFT ${s.id}/${part.group}: measured ${JSON.stringify(m)} recorded ${JSON.stringify(rec)}`); drift++; }
}
console.log(JSON.stringify(result.bounds, null, 0).replace(/\},"/g, '},\n"'));
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'page errors: none');
console.log(drift ? `${drift} recorded bound(s) out of date` : 'recorded bounds match measurement');
process.exit(drift || errors.length ? 1 : 0);
