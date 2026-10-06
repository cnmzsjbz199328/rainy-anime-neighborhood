// Real-model review shots and render cost of one building or legacy sample (layout.js).
//
//   node tools/building_views.mjs <plot or building id> [outDir]     (default docs/buildings/screenshots/<plot>)
//
// Eight views of the actual model, framed from its own transform: front, rear, left, right (left/right as
// seen by a viewer facing the front), roof top, interior cutaway (roof and ceiling hidden for this shot
// only: the module's 'roof' layer; two-storey buildings add interiorGround, which also lifts the 'f2' layer), rainy-night front-right and rear-left obliques; plus the scene's default view and the whole town.
// Also reports page errors and draw calls / triangles / geometries / textures with the building shown and
// hidden at the same views. Look at every image; the exit code only covers errors.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { launchChromium } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const L = createRequire(import.meta.url)(path.join(root, 'layout.js'));
const key = process.argv[2] || L.buildings[0]?.plot;
const b = [...L.buildings, ...L.samples].find(b => b.plot === key || b.id === key);
if (!b) { console.log(`no building registered for ${key}`); process.exit(1); }
const isNewBuilding = L.buildings.includes(b);
const outDir = path.resolve(process.argv[3] || path.join(root, 'docs', 'buildings', 'screenshots', b.plot));
fs.mkdirSync(outDir, { recursive: true });

// Building frame: centre of the main part, its front direction in the world and the body height.
const main = b.parts.find(p => p.role === 'building').localBounds;
const [cx, cz] = L.toWorld(b, (main.min[0] + main.max[0]) / 2, (main.min[2] + main.max[2]) / 2);
const t = b.transform, fx = Math.sin(t.rotY) * b.frontDir[1] + Math.cos(t.rotY) * b.frontDir[0], fz = Math.cos(t.rotY) * b.frontDir[1] - Math.sin(t.rotY) * b.frontDir[0];
const front = Math.atan2(fx, fz);   // camera yaw that looks at the front face
const size = Math.max(main.max[0] - main.min[0], main.max[2] - main.min[2]), h = main.max[1];
const tgt = [cx, h * 0.45, cz], d = Math.max(9, size * 1.75);
const FRONT_PITCH = Number(process.env.FRONT_PITCH) || 0.1;   // FRONT_PITCH=0.45 lifts the front elevation over the buildings across the alley (north-row plots)
const REAR_PITCH = Number(process.env.REAR_PITCH) || 0.12;
const REAR_LEFT_PITCH = Number(process.env.REAR_LEFT_PITCH) || 0.32;   // REAR_LEFT_PITCH=0.6 lifts the rear-left oblique over a tall neighbour behind the plot
const VIEWS = {
  // Elevations: near-level; the sides look down over the neighbours' roofs (plots are only 9-10 wide).
  front:        { yaw: front + 0.12,          pitch: FRONT_PITCH, dist: d, target: tgt },
  rear:         { yaw: front + Math.PI,       pitch: REAR_PITCH, dist: d,  target: tgt },   // REAR_PITCH=0.4 lifts the camera over a tall neighbour behind the plot
  left:         { yaw: front - Math.PI / 2,   pitch: 0.45, dist: d,        target: tgt },   // viewer's left when facing the front
  right:        { yaw: front + Math.PI / 2,   pitch: 0.45, dist: d,        target: tgt },
  roof:         { yaw: front,                 pitch: 1.45, dist: d * 1.25, target: [cx, h * 0.85, cz] },
  interior:     { yaw: front + 0.35,          pitch: 1.0,  dist: d * 1.05, target: [cx, 0.8, cz], cutaway: true },
  frontRight:   { yaw: front + Math.PI / 4,   pitch: 0.32, dist: d * 1.15, target: tgt },
  rearLeft:     { yaw: front + Math.PI * 1.25, pitch: REAR_LEFT_PITCH, dist: d * 1.15, target: tgt },
  frontNear:    { yaw: front + 0.25,          pitch: 0.12, dist: 9,        target: [cx + fx * 2, 1.4, cz + fz * 2] },   // eye-level look through the glass
};
// Legacy samples have no tagged roof/cutaway layers. Use a close, front-facing interior-through-glass
// view instead of an overhead camera that would only show the intact roof and mislabel it as a cutaway.
if (!isNewBuilding) VIEWS.interior = {
  yaw: front + 0.12, pitch: 0.2, dist: Math.max(8, size * 1.15),
  target: [cx, 1.2, cz],
};
// Multi-storey buildings: a second cutaway also lifts the module's 'f2' layer (upper storey) to show the ground floor.
if (b.floors > 1) VIEWS.interiorGround = { yaw: front + 0.35, pitch: 1.0, dist: d * 1.05, target: [cx, 0.8, cz], cutaway: b.floors > 2 ? ['roof', 'f3', 'f2'] : ['roof', 'f2'] };
const groupsOf = b.parts.map(p => p.group);

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.waitForFunction(() => window.__scene && window.__scene.view);
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(outDir, 'default.png') });

// The camera follows view.set() on the next animation frame; wait for two frames before measuring.
const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const stats = () => frames().then(() => page.evaluate(() => { const { renderer, scene, camera } = window.__scene; renderer.info.autoReset = false; renderer.info.reset(); renderer.render(scene, camera);
  const i = renderer.info; return { calls: i.render.calls, triangles: i.render.triangles, lines: i.render.lines, geometries: i.memory.geometries, textures: i.memory.textures }; }));
const show = v => page.evaluate(([names, v]) => { for (const n of names) window.__scene.groups[n].visible = v; }, [groupsOf, v]);
const cost = [];
for (const [name, v] of [['default', null], ['front', VIEWS.front], ['far', { yaw: 2.5, pitch: 0.82, dist: 140, target: [0, 0, 0] }]]) {
  if (v) await page.evaluate(v => window.__scene.view.set(v), v);
  await page.waitForTimeout(300);
  const on = await stats(); await show(false); const off = await stats(); await show(true);
  cost.push({ view: name, on, off });
}
// Frame time at the front view (software WebGL here: only comparable within this environment).
const frameMs = async () => page.evaluate(() => new Promise(res => { let n = 0, t0 = 0; const f = t => { if (n === 1) t0 = t; if (n++ < 31) requestAnimationFrame(f); else res((t - t0) / 30); }; requestAnimationFrame(f); }));
const ms = {};
for (const [name, v] of [['default', { yaw: 2.5, pitch: 0.5, dist: 34, target: [-7, 1.2, 20] }], ['front', VIEWS.front]]) {
  await page.evaluate(v => window.__scene.view.set(v), v); await frames();
  const on = await frameMs(); await show(false); const off = await frameMs(); await show(true); ms[name] = [on, off];
}

// Local animation: effect objects (transparent, no depth write) change world height or vertex data.
const probe = () => page.evaluate(names => { const v = [], w = new THREE.Vector3(); for (const n of names) window.__scene.groups[n].traverse(o => {
  if (!(o.isMesh || o.isLineSegments) || !o.material.transparent || o.material.depthWrite !== false) return;
  v.push(o.isLineSegments ? +o.geometry.attributes.position.array.reduce((a, b) => a + b, 0).toFixed(3) : +o.getWorldPosition(w).y.toFixed(4)); }); return v; }, groupsOf);
const p0 = await probe(); await page.waitForTimeout(800); const p1 = await probe();
const moving = p0.filter((y, i) => y !== p1[i]).length;

for (const [name, v] of Object.entries(VIEWS)) {
  await page.evaluate(v => window.__scene.view.set(v), v);
  // Cutaway: lift off everything the module built on its 'roof' layer (roof, parapet, rooftop plant, ceiling).
  if (v.cutaway) await page.evaluate(([names, layers]) => { for (const n of names) window.__scene.groups[n].traverse(o => { if ((o.isMesh || o.isLineSegments) && layers.includes(o.userData.layer)) { o.userData.cutaway = true; o.visible = false; } }); }, [groupsOf, v.cutaway === true ? ['roof'] : v.cutaway]);
  await frames(); await page.waitForTimeout(800);   // SwiftShader: let a few frames render
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  if (v.cutaway) await page.evaluate(names => { for (const n of names) window.__scene.groups[n].traverse(o => { if (o.userData.cutaway) { o.visible = true; delete o.userData.cutaway; } }); }, groupsOf);
}
await page.evaluate(() => window.__scene.view.set({ yaw: 2.5, pitch: 0.82, dist: 140, target: [0, 0, 0] }));
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(outDir, 'town.png') });
await browser.close();

console.log(`${b.plot} ${b.name} (${isNewBuilding ? 'new building' : 'legacy sample'}): views in ${path.relative(root, outDir)}`);
for (const c of cost) console.log(`render ${c.view.padEnd(7)} with/without: calls ${c.on.calls}/${c.off.calls} (+${c.on.calls - c.off.calls}), triangles ${c.on.triangles}/${c.off.triangles} (+${c.on.triangles - c.off.triangles}), lines ${c.on.lines}/${c.off.lines}; geometries ${c.on.geometries}, textures ${c.on.textures}`);
for (const [name, [on, off]] of Object.entries(ms)) console.log(`frame time at ${name} view (SwiftShader, this machine only): ${on.toFixed(1)} ms with, ${off.toFixed(1)} ms without`);
console.log(`local animation: ${moving}/${p0.length} effect objects (drip/run batches, steam, light decals) changed in 0.8 s`);
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'page errors: none');
process.exit(errors.length || (isNewBuilding && !moving) ? 1 : 0);
