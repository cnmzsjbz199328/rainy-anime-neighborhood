// W8g cold-start screenshots (W8_SPEC 13.0, 13.5): every shot from a fresh browser and page that has never been in sphere mode (joint_shots.mjs enters the
// sphere first, so the world is warm there and it cannot stand in for this). Deterministic (seeded Math.random, frames driven by hand, SwiftShader).
// Per shot: load, two frames, wait in real time for the background generation (worldgen.js; a build without it waits the same time), then
//   - exit <id>: the target moves frame by frame (60 frames) from the default view to 30 m beyond the town exit, 40 more frames, shot;
//   - sphere: the map button, 150 frames (the 2 s transition and some), shot.
// With --ref the same shots are taken on that git ref (built in a temporary worktree) and compared pixel by pixel: W8g-a, W8g-c and W8g-d require 0 differences.
//   node tools/cold_shots.mjs [--ref pre-w8g-a] [--out docs/world/w8g/cold] [--only N01,sphere]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const ref = arg('--ref', null), outDir = path.resolve(root, arg('--out', 'docs/world/w8g/cold')), only = arg('--only') ? arg('--only').split(',') : null;
const require = createRequire(import.meta.url), L = require(path.join(root, 'layout.js'));
const SHOTS = [...['N01', 'N03', 'N04', 'N08', 'N09', 'N10', 'N11', 'N12', 'N13'], 'sphere'].filter(id => !only || only.includes(id));
const WAIT_MS = 8000;
const exitTarget = id => { const n = L.roadNodes.find(q => q.id === id), side = Math.abs(n.x) >= Math.abs(n.z) ? [Math.sign(n.x), 0] : [0, Math.sign(n.z)]; return [n.x + 30 * side[0], 1.2, n.z + 30 * side[1]]; };

async function shoot(html, dir, label) {
  fs.mkdirSync(dir, { recursive: true });
  const info = {};
  for (const id of SHOTS) {
    const browser = await launchChromium(), page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }), errors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
    await page.addInitScript(INIT);
    await page.goto(pathToFileURL(html).href, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForFunction(() => window.__scene && window.__scene.view, null, { timeout: 180000 });
    await page.evaluate(() => window.__step(2));
    const t0 = Date.now();
    await page.waitForFunction(() => { const G = window.__scene.worldgen; return !G || (G.state.done && G.stats().gpu.readyAt); }, null, { timeout: 180000, polling: 200 });
    const gen = await page.evaluate(() => !!window.__scene.worldgen);
    if (Date.now() - t0 < WAIT_MS) await page.waitForTimeout(WAIT_MS - (Date.now() - t0));        // both builds wait at least as long, without frames
    const url = await page.evaluate(([id, to]) => {
      const S = window.__scene;
      if (id === 'sphere') { document.getElementById('map-mode-toggle').click(); window.__step(150); }
      else { const from = S.view.get().target; for (let k = 1; k <= 60; k++) { S.view.set({ target: from.map((v, i) => v + (to[i] - v) * k / 60) }); window.__step(1); } window.__step(40); }
      S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL('image/png');
    }, [id, id === 'sphere' ? null : exitTarget(id)]);
    fs.writeFileSync(path.join(dir, `${id}.png`), Buffer.from(url.split(',')[1], 'base64'));
    info[id] = { worldgen: gen, waitedMs: Date.now() - t0, errors };
    await browser.close();
    console.log(`${label} ${id}：${gen ? '预生成完成后' : '无预生成，等待'} ${Math.round(info[id].waitedMs / 1000)} s 出发${errors.length ? '；页面错误 ' + errors.slice(0, 2).join(' | ') : ''}`);
  }
  return info;
}

const cur = await shoot(path.join(root, 'index.html'), path.join(outDir, 'current'), '当前');
let fails = 0;
if (ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cold-'));
  execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { cwd: root, stdio: 'pipe' });
  try {
    execFileSync('python3', ['build.py'], { cwd: dir, stdio: 'pipe' });
    await shoot(path.join(dir, 'index.html'), path.join(outDir, ref), ref);
  } finally { try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'pipe' }); } catch { fs.rmSync(dir, { recursive: true, force: true }); } }
  // compare in a page (decode both PNGs)
  const browser = await launchChromium(), page = await browser.newPage();
  for (const id of SHOTS) {
    const [A, B] = ['current', ref].map(d => 'data:image/png;base64,' + fs.readFileSync(path.join(outDir, d, `${id}.png`)).toString('base64'));
    const r = await page.evaluate(async ([A, B]) => { const load = async s => { const im = new Image(); im.src = s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const q = c.getContext('2d'); q.drawImage(im, 0, 0); return q.getImageData(0, 0, c.width, c.height).data; };
      const x = await load(A), y = await load(B); let n = 0, mx = 0; for (let i = 0; i < x.length; i += 4) { let m = 0; for (let k = 0; k < 3; k++) m = Math.max(m, Math.abs(x[i + k] - y[i + k])); if (m > 0) n++; mx = Math.max(mx, m); } return { n, mx }; }, [A, B]);
    if (r.n) fails++;
    console.log(`${r.n ? 'FAIL' : 'PASS'} ${id}：与 ${ref} 不同的像素 ${r.n}，最大通道差 ${r.mx}`);
  }
  await browser.close();
  console.log(`${fails ? 'FAIL' : 'PASS'} 冷启动截图 ${SHOTS.length} 张与 ${ref} 逐位比较：${SHOTS.length - fails} 张相同`);
}
console.log(`→ ${path.relative(root, outDir)}/`);
process.exitCode = fails || Object.values(cur).some(q => q.errors.length) ? 1 : 0;
