// Deterministic pixel regression for the built scene (W2, WC12).
//
//   node tools/regress.mjs --self                       build once, shoot twice, compare (proves the tool is deterministic)
//   node tools/regress.mjs --baseline-ref pre-w2        build that git ref in a temp worktree, shoot it and the current index.html, compare
//   node tools/regress.mjs --shots docs/world/w2 --bend 1   only save shots of the current build (optionally with uBend set); no comparison
//   options: --frames N (default 40)   --out DIR (keep the shots of both builds, default: temp)
//            --views a,b   only these views
//            --mask-patch-margin 24   (W3 and later) ignore the pixels where the terrain ring / exit starts are visible: the current build
//            is rendered a second time with those meshes hidden, the pixels that differ (dilated by 2 px) are the mask; everything
//            outside the mask must still match the baseline (max channel diff 0.. 2, same rule). Only pixels near the town patch may change.
//
// Determinism: Math.random is replaced by a seeded generator, requestAnimationFrame is driven by hand with the
// timestamp frame * 16.667 ms, performance.now follows the same clock. Shots are read from the WebGL canvas
// (toDataURL right after a render), so the HUD buttons are not part of the comparison.
// Pass rule: pixels with any channel differing by more than 2 must be at most 0.01 % of the image.
// No baseline image is stored in the repository.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { launchChromium } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const L = require(path.join(root, 'layout.js'));
const arg = (name, def) => { const i = process.argv.indexOf(name); return i < 0 ? def : process.argv[i + 1]; };
const has = name => process.argv.includes(name);
const FRAMES = Number(arg('--frames', 40));
const bendValue = arg('--bend', null);
const shotsDir = arg('--shots', null);
const keepDir = arg('--out', null);
const maskMargin = arg('--mask-patch-margin', null);

// Views: the five of tools/views.mjs, the scene's start view, a new building front and its cutaway.
const cafe = L.buildings.find(b => b.plot === 'B05-P03');
const main = cafe.parts.find(p => p.role === 'building').localBounds;
const [cx, cz] = L.toWorld(cafe, (main.min[0] + main.max[0]) / 2, (main.min[2] + main.max[2]) / 2);
const t = cafe.transform, fx = Math.sin(t.rotY) * cafe.frontDir[1] + Math.cos(t.rotY) * cafe.frontDir[0], fz = Math.cos(t.rotY) * cafe.frontDir[1] - Math.sin(t.rotY) * cafe.frontDir[0];
const front = Math.atan2(fx, fz), size = Math.max(main.max[0] - main.min[0], main.max[2] - main.min[2]), h = main.max[1], d = Math.max(9, size * 1.75);
const ALL_VIEWS = {
  default:      null,
  far:          { yaw: 2.5,  pitch: 0.82, dist: 140, target: [0, 0, 0] },
  storeCorner:  { yaw: 2.75, pitch: 0.2,  dist: 13,  target: [-9, 1.4, 22] },
  intersection: { yaw: 1.57, pitch: 0.2,  dist: 16,  target: [0, 0.3, 15] },
  top:          { yaw: 0,    pitch: 1.45, dist: 150, target: [0, 0, 0] },
  roamStreet:   { mode: 'roam', position: [-8, 15], heading: -Math.PI / 2 },
  cafeFront:    { yaw: front + 0.12, pitch: 0.1, dist: d, target: [cx, h * 0.45, cz] },
  cafeInterior: { yaw: front + 0.35, pitch: 1.0, dist: d * 1.05, target: [cx, 0.8, cz], cutaway: ['roof'] },
};
const onlyViews = arg('--views', null);
export const VIEWS = onlyViews ? Object.fromEntries(Object.entries(ALL_VIEWS).filter(([k]) => onlyViews.split(',').includes(k))) : ALL_VIEWS;

const INIT = `(() => {
  let s = 0x2f6e2b1;
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const queue = []; let frame = 0;
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.__step = n => { for (let i = 0; i < n; i++) { frame++; const ts = frame * 16.667, cbs = queue.splice(0); for (const cb of cbs) cb(ts); } return frame; };
  performance.now = () => frame * 16.667;
})();`;

function buildRef(ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'regress-'));
  execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['build.py'], { cwd: dir, stdio: 'pipe' });
  return { html: path.join(dir, 'index.html'), cleanup: () => { try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'pipe' }); } catch { fs.rmSync(dir, { recursive: true, force: true }); } } };
}

async function shoot(browser, html, outDir, bend, withMask) {
  fs.mkdirSync(outDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(html).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__scene && window.__scene.view);
  const info = {};
  for (const [name, v] of Object.entries(VIEWS)) {
    const r = await page.evaluate(async ([name, v, frames, bend, withMask]) => {
      const S = window.__scene;
      if (bend !== null && S.bend) S.bend.set(bend);
      if (v) S.view.set(v); else if (S.view.get().mode === 'roam') S.view.set({ mode: 'free' });
      if (v && v.mode !== 'roam') S.view.set({ mode: 'free', ...v });
      const hidden = [];
      if (v && v.cutaway) for (const g of Object.values(S.groups)) g.traverse(o => { if ((o.isMesh || o.isLineSegments) && v.cutaway.includes(o.userData.layer)) { hidden.push(o); o.visible = false; } });
      window.__step(frames);
      S.renderer.render(S.scene, S.camera);
      const url = S.renderer.domElement.toDataURL('image/png'), calls = S.renderer.info.render.calls, tris = S.renderer.info.render.triangles;
      let hiddenUrl = null;
      if (withMask && S.terrain) {            // second render without the ring and the exit starts: the differing pixels are the mask
        const ring = [...S.terrain.ring, ...S.terrain.stubs], was = ring.map(m => m.visible);
        ring.forEach(m => { m.visible = false; });
        S.renderer.render(S.scene, S.camera); hiddenUrl = S.renderer.domElement.toDataURL('image/png');
        ring.forEach((m, i) => { m.visible = was[i]; });
      }
      for (const o of hidden) o.visible = true;
      return { url, calls, tris, hiddenUrl };
    }, [name, v, FRAMES, bend, withMask]);
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.url.split(',')[1], 'base64'));
    if (r.hiddenUrl) fs.writeFileSync(path.join(outDir, name + '.hidden.png'), Buffer.from(r.hiddenUrl.split(',')[1], 'base64'));
    info[name] = { calls: r.calls, triangles: r.tris };
  }
  await page.close();
  return { info, errors };
}

async function compare(browser, dirA, dirB, masked) {
  const page = await browser.newPage();
  const out = {};
  for (const name of Object.keys(VIEWS)) {
    const a = fs.readFileSync(path.join(dirA, name + '.png')).toString('base64'), b = fs.readFileSync(path.join(dirB, name + '.png')).toString('base64');
    const h = masked ? fs.readFileSync(path.join(dirB, name + '.hidden.png')).toString('base64') : null;
    out[name] = await page.evaluate(async ([a, b, h]) => {
      const load = s => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
      const [ia, ib, ih] = await Promise.all([load(a), load(b), h ? load(h) : null]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { error: 'size differs' };
      const data = i => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      const da = data(ia), db = data(ib), W = ia.width, H = ia.height;
      let mask = null, masked = 0;
      if (ih) {                                   // pixels where the ring/exit meshes are visible, dilated by 2 px
        const dh = data(ih), raw = new Uint8Array(W * H); mask = new Uint8Array(W * H);
        for (let k = 0; k < W * H; k++) raw[k] = (Math.abs(db[k * 4] - dh[k * 4]) + Math.abs(db[k * 4 + 1] - dh[k * 4 + 1]) + Math.abs(db[k * 4 + 2] - dh[k * 4 + 2])) > 0 ? 1 : 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (raw[y * W + x]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && xx < W && yy >= 0 && yy < H) mask[yy * W + xx] = 1; }
        for (let k = 0; k < W * H; k++) masked += mask[k];
      }
      let max = 0, over = 0;
      for (let k = 0; k < da.length; k += 4) { if (mask && mask[k / 4]) continue; let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(da[k + c] - db[k + c])); if (m > max) max = m; if (m > 2) over++; }
      return { max, over, total: da.length / 4, masked, fraction: over / (da.length / 4) };
    }, [a, b, h]);
  }
  await page.close();
  return out;
}

const browser = await launchChromium();
let exit = 0, cleanup = () => {};
try {
  const tmp = keepDir ? path.resolve(keepDir) : fs.mkdtempSync(path.join(os.tmpdir(), 'regress-shots-'));
  const current = path.join(root, 'index.html');
  if (shotsDir) {
    const r = await shoot(browser, current, path.resolve(shotsDir), bendValue === null ? null : Number(bendValue));
    console.log(`shots → ${shotsDir}`, JSON.stringify(r.info)); if (r.errors.length) { console.log('page errors:', r.errors.join(' | ')); exit = 1; }
  } else {
    let other = current, label = 'self';
    if (has('--baseline-ref')) { const b = buildRef(arg('--baseline-ref')); other = b.html; cleanup = b.cleanup; label = arg('--baseline-ref'); }
    const A = await shoot(browser, other, path.join(tmp, 'baseline'), null);
    const B = await shoot(browser, current, path.join(tmp, 'current'), bendValue === null ? 0 : Number(bendValue), maskMargin !== null);
    const cmp = await compare(browser, path.join(tmp, 'baseline'), path.join(tmp, 'current'), maskMargin !== null);
    console.log(`regress: ${label} vs current, ${FRAMES} frames per view`);
    for (const [name, r] of Object.entries(cmp)) {
      const ok = !r.error && r.fraction <= 0.0001;
      if (!ok) exit = 1;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${name.padEnd(13)} ${r.error || `max channel diff ${r.max}, pixels over 2: ${r.over}/${r.total} (${(r.fraction * 100).toFixed(4)}%)${maskMargin !== null ? `, masked ${r.masked} px (${(r.masked / r.total * 100).toFixed(2)}%)` : ''}`}  draw calls ${A.info[name].calls} → ${B.info[name].calls}, triangles ${A.info[name].triangles} → ${B.info[name].triangles}`);
    }
    for (const [who, e] of [['baseline', A.errors], ['current', B.errors]]) if (e.length) { console.log(`page errors (${who}):`, e.join(' | ')); exit = 1; }
    console.log(exit ? 'FAIL regress' : 'PASS regress');
    if (!keepDir) fs.rmSync(tmp, { recursive: true, force: true });
  }
} finally { cleanup(); await browser.close(); }
process.exit(exit);
