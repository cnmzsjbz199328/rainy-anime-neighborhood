// Review shots of the planet terrain (W3). Run after `python3 build.py`:  node tools/terrain_shots.mjs [outDir] [--only=a,b]   (default docs/world/w3)
//   hemispheres (front, east, back, west) and the two poles at uBend = 1, camera 300 m from the planet centre, fog off (the scene fog is W8's job)
//   the three street viewpoints N04 / N05 / N06 looking at the volcano summit (uBend = 1)
//   the four plinth corners at uBend = 0 and uBend = 1
//   three exit starts (RD01 east, RD03 north, RD05 field road), the longitude seam
// Deterministic: seeded Math.random, hand-driven frames; the canvas only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(root, 'docs', 'world', 'w3'));
fs.mkdirSync(outDir, { recursive: true });
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

const SHOTS = [
  // planet views: { sphere: [lon, lat], d }
  ['planet-front', 1, { sphere: [0, 0], d: 300, fog: 0 }],
  ['planet-east', 1, { sphere: [90, 0], d: 300, fog: 0 }],
  ['planet-back', 1, { sphere: [180, 0], d: 300, fog: 0 }],
  ['planet-west', 1, { sphere: [-90, 0], d: 300, fog: 0 }],
  ['planet-north-pole', 1, { sphere: [0, 90], d: 300, fog: 0, up: [0, 1, 0] }],
  ['planet-south-pole', 1, { sphere: [0, -90], d: 300, fog: 0, up: [0, 1, 0] }],
  ['planet-seam', 1, { sphere: [180, 20], d: 220, fog: 0 }],
  // street viewpoints looking at the summit: { eye: [x, z], summit: true }
  ['view-N04-summit', 1, { eye: [0, -48], look: 'summit' }],
  ['view-N05-summit', 1, { eye: [0, -33.5], look: 'summit' }],
  ['view-N06-summit', 1, { eye: [0, -15], look: 'summit' }],
  // corners: flat view parameters (camera outside the plinth, looking in); same shot at uBend 0 and 1
  ['corner-nw-flat', 0, { yaw: -2.36, pitch: 0.35, dist: 24, target: [-46, 0.5, -46] }],
  ['corner-ne-flat', 0, { yaw: 2.36, pitch: 0.35, dist: 24, target: [46, 0.5, -46] }],
  ['corner-se-flat', 0, { yaw: 0.785, pitch: 0.35, dist: 24, target: [46, 0.5, 46] }],
  ['corner-sw-flat', 0, { yaw: -0.785, pitch: 0.35, dist: 24, target: [-46, 0.5, 46] }],
  ['corner-nw-bent', 1, { yaw: -2.36, pitch: 0.35, dist: 24, target: [-46, 0.5, -46], bentView: true }],
  ['corner-ne-bent', 1, { yaw: 2.36, pitch: 0.35, dist: 24, target: [46, 0.5, -46], bentView: true }],
  ['corner-se-bent', 1, { yaw: 0.785, pitch: 0.35, dist: 24, target: [46, 0.5, 46], bentView: true }],
  ['corner-sw-bent', 1, { yaw: -0.785, pitch: 0.35, dist: 24, target: [-46, 0.5, 46], bentView: true }],
  // exit starts (uBend 0, looking outward from the town side)
  ['exit-N03-RD01-east', 0, { yaw: -Math.PI / 2, pitch: 0.3, dist: 14, target: [56, 0.3, 15] }],
  ['exit-N04-RD03-north', 0, { yaw: 0, pitch: 0.3, dist: 14, target: [0, 0.3, -56] }],
  ['exit-N12-RD05-field', 0, { yaw: -Math.PI / 2, pitch: 0.3, dist: 12, target: [53, 0.3, 32.25] }],
];

const INIT = `(() => {
  let s = 0x2f6e2b1;
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const queue = []; let frame = 0;
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.__step = n => { for (let i = 0; i < n; i++) { frame++; const ts = frame * 16.667, cbs = queue.splice(0); for (const cb of cbs) cb(ts); } return frame; };
  performance.now = () => frame * 16.667;
})();`;

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await page.addInitScript(INIT);
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__scene && window.__scene.terrain, null, { timeout: 90000 });
for (const [name, u, v] of SHOTS) {
  if (only.length && !only.includes(name)) continue;
  const r = await page.evaluate(([u, v]) => {
    const S = window.__scene, T = window.THREE, R = 90, D = Math.PI / 180, B = S.bend, cam = S.camera;
    const fog0 = S.scene.fog.density;
    S.bend.set(u);
    S.scene.fog.density = v.fog === 0 ? 0 : fog0;
    S.view.set({ mode: 'free', yaw: v.yaw ?? 2.5, pitch: v.pitch ?? 0.5, dist: v.dist ?? 34, target: v.target || [0, 1.2, 0] });
    window.__step(40);
    const basis = (x, z) => { const b = B.basis(x, z); return { east: new T.Vector3(...b.east), up: new T.Vector3(...b.up), south: new T.Vector3(...b.south) }; };
    const flat = (lon, lat) => [R * lon * D, -R * Math.asinh(Math.tan(lat * D))];
    cam.near = 0.1;
    if (v.sphere) {
      const [lon, lat] = v.sphere, cp = Math.cos(lat * D), dir = new T.Vector3(cp * Math.sin(lon * D), cp * Math.cos(lon * D), -Math.sin(lat * D));
      const north = new T.Vector3(-Math.sin(lat * D) * Math.sin(lon * D), -Math.sin(lat * D) * Math.cos(lon * D), -cp).multiplyScalar(1);
      const c = new T.Vector3(0, -R, 0);
      cam.position.copy(c).addScaledVector(dir, v.d); cam.up.copy(v.up ? new T.Vector3(...v.up) : north); cam.lookAt(c);
    } else if (v.eye) {
      const [x, z] = v.eye, p = B.point(x, 1.6, z, u), b = basis(x, z), lm = S.terrain && window.WORLD.landmarks.find(l => l.id === 'LM01');
      const [sx, sz] = flat(lm.lon, lm.lat), s = Math.cos(lm.lat * D), tgt = B.point(sx, (lm.baseHeight - 1.6) / s, sz, u);
      cam.position.set(...p); cam.up.copy(b.up); cam.lookAt(new T.Vector3(...tgt)); cam.fov = 46; cam.updateProjectionMatrix();
    } else if (v.bentView) {
      const t = v.target, yaw = v.yaw, pitch = v.pitch, d = v.dist;
      const cf = [t[0] + d * Math.sin(yaw) * Math.cos(pitch), t[1] + d * Math.sin(pitch), t[2] + d * Math.cos(yaw) * Math.cos(pitch)];
      const pc = B.point(cf[0], cf[1], cf[2], u), pt = B.point(t[0], t[1], t[2], u), b = basis(t[0], t[2]);
      cam.position.set(...pc); cam.up.copy(b.up); cam.lookAt(new T.Vector3(...pt));
    }
    cam.updateMatrixWorld();
    S.renderer.render(S.scene, S.camera);
    const url = S.renderer.domElement.toDataURL('image/png'), info = { calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles };
    cam.fov = 36; cam.near = 0.25; cam.up.set(0, 1, 0); cam.updateProjectionMatrix(); S.scene.fog.density = fog0; S.bend.set(0);
    return { url, info };
  }, [u, v]);
  fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
  console.log(`${name}.png  uBend ${u}  draw calls ${r.info.calls}  triangles ${r.info.triangles}`);
}
if (errors.length) { console.log('page errors:', errors.join(' | ')); process.exitCode = 1; }
await browser.close();
