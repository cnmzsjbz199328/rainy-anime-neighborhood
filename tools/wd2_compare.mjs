// Same-browser WD2 model cost against a pre-WD2 offline build.
// Usage: node tools/wd2_compare.mjs --before /path/to/pre-wd2/index.html
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './landmark_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const idx = process.argv.indexOf('--before');
if (idx < 0 || !process.argv[idx + 1]) throw new Error('Pass --before /path/to/pre-wd2/index.html');
const beforeFile = path.resolve(process.argv[idx + 1]);
const outFile = path.join(root, 'docs/world/perf/wd2-near.json');
const views = [
  ['village', 0, 0, 36, 0.75, 0.8, 2],
  ['inn-a', -8.5, -4.5, 9, Math.PI / 2 + 0.25, 0.25, 1.6],
  ['inn-b', 1, -10.2, 8, 0, 0.25, 1.6],
  ['spring', -1, -2, 9, 0.6, 0.55, 0.4],
  ['village-entry', 0, 14.2, 9, 0, 0.3, 1.4],
];
const browser = await launchChromium();
try {
  const measure = async file => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(INIT);
    await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__scene?.landmarks?.info?.LM02, null, { timeout: 90000 });
    const rows = [];
    for (let pass = 0; pass < 2; pass++) for (const [name, x, z, dist, yaw, pitch, height] of views) {
      const row = await page.evaluate(({ x, z, dist, yaw, pitch, height }) => {
        const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === 'LM02');
        const d = Math.hypot(x, z), p = d < 1e-9 ? lm : W.destination(lm, Math.atan2(-x, z) * 180 / Math.PI, d);
        const t = W.lonLatToTown(p.lon, p.lat);
        S.weather.lock('rain'); S.weather.setTime(600);
        S.view.set({ mapMode: 'flat', mode: 'free', target: [t.x, height, t.z], dist, yaw, pitch });
        window.__step(2); S.renderer.render(S.scene, S.camera);
        return { calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles, textures: S.renderer.info.memory.textures };
      }, { x, z, dist, yaw, pitch, height });
      if (pass) rows.push({ name, ...row });
    }
    await page.close();
    return { pageErrors: errors, views: rows };
  };
  const before = await measure(beforeFile), after = await measure(path.join(root, 'index.html'));
  const delta = after.views.map((v, i) => ({ name: v.name, calls: v.calls - before.views[i].calls,
    triangles: v.triangles - before.views[i].triangles, textures: v.textures - before.views[i].textures }));
  const report = { method: 'Same Chromium session, fresh page per build, five 1280x800 flat/rain/t=600 views; warm-up pass then render. Whole-frame counts.',
    beforeFile, before, after, delta };
  await fs.writeFile(outFile, JSON.stringify(report, null, 2) + '\n');
  for (const d of delta) console.log(`${d.name}: calls ${d.calls}, triangles ${d.triangles}, textures ${d.textures}`);
  console.log(`Page errors ${before.pageErrors.length}/${after.pageErrors.length}; ${path.relative(root, outFile)}`);
  if (before.pageErrors.length || after.pageErrors.length) process.exitCode = 1;
} finally { await browser.close(); }
