// Same-browser coast model cost against the pre-WD3 offline build.
// Usage: node tools/wd3_compare.mjs --before /path/to/pre-wd3/index.html
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './landmark_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const idx = process.argv.indexOf('--before');
if (idx < 0 || !process.argv[idx + 1]) throw new Error('Pass --before /path/to/pre-wd3/index.html');
const beforeFile = path.resolve(process.argv[idx + 1]), outFile = path.join(root, 'docs/world/perf/wd3-near.json');
const views = [
  ['LM10', 'harbour', 0, 0, 40, 0.8, 0.8, 1.8],
  ['LM10', 'boats', 23, -5, 12, 0.7, 0.55, 0.5],
  ['LM08', 'island', 0, 0, 26, 0.8, 0.85, 2],
  ['LM08', 'tower', 0, -1, 13, Math.PI / 2, 0.52, 5],
];
const browser = await launchChromium();
try {
  const measure = async file => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(INIT);
    await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__scene?.landmarks?.info?.LM10 && window.__scene?.landmarks?.info?.LM08, null, { timeout: 90000 });
    const rows = [];
    for (const [id, name, x, z, dist, yaw, pitch, height] of views) {
      const row = await page.evaluate(({ id, x, z, dist, yaw, pitch, height }) => {
        const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === id);
        const d = Math.hypot(x, z), p = d < 1e-9 ? lm : W.destination(lm, Math.atan2(-x, z) * 180 / Math.PI, d);
        const t = W.lonLatToTown(p.lon, p.lat);
        S.weather.lock('rain'); S.weather.setTime(600);
        S.transition.setMode('flat'); S.transition.step(3);
        S.view.set({ mapMode: 'flat', mode: 'free', target: [t.x, height, t.z], dist, yaw, pitch });
        window.__step(1); S.renderer.render(S.scene, S.camera);
        return { calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles, textures: S.renderer.info.memory.textures };
      }, { id, x, z, dist, yaw, pitch, height });
      rows.push({ id, name, ...row }); console.log(`${path.basename(path.dirname(file))} ${id} ${name} measured`);
    }
    await page.close(); return { pageErrors: errors, views: rows };
  };
  const before = await measure(beforeFile), after = await measure(path.join(root, 'index.html'));
  const delta = after.views.map((v, i) => ({ id: v.id, name: v.name, calls: v.calls - before.views[i].calls,
    triangles: v.triangles - before.views[i].triangles, textures: v.textures - before.views[i].textures }));
  await fs.writeFile(outFile, JSON.stringify({ method: 'Same Chromium session, fresh page per build, four 1280x800 flat/rain/t=600 views; one render after __step(1). Whole-frame counts.', beforeFile, before, after, delta }, null, 2) + '\n');
  for (const d of delta) console.log(`${d.id} ${d.name}: calls ${d.calls}, triangles ${d.triangles}, textures ${d.textures}`);
  console.log(`Page errors ${before.pageErrors.length}/${after.pageErrors.length}; ${path.relative(root, outFile)}`);
  if (before.pageErrors.length || after.pageErrors.length) process.exitCode = 1;
} finally { await browser.close(); }
