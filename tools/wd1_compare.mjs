// Compare WD1 fixed views with the WD0 offline build in one browser session.
// Usage: git worktree add --detach /tmp/wd1-wd0 f6c9a31
//        node tools/wd1_compare.mjs --before /tmp/wd1-wd0/index.html [--out path.json]
//        git worktree remove /tmp/wd1-wd0
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './landmark_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const beforeFile = arg('--before'), outFile = path.resolve(root, arg('--out') || 'docs/world/perf/wd1-near.json');
if (!beforeFile) throw new Error('Pass --before /path/to/wd0/index.html');
const views = [
  ['overview', 0, 0, 24, 2.6, 0.45, 1.8],
  ['shed-front', -2.5, -3.7, 9, 0, 0.3, 2.5],
  ['shed-rear', -2.5, -3.7, 9, Math.PI, 0.35, 2.5],
  ['car-platform', 1.8, -6.4, 9, 0, 0.3, 2.5],
  ['car-rear', 1.8, -6.4, 11, Math.PI, 0.35, 2.5],
  ['services', 4.2, 0.5, 10, 0.85, 0.38, 2.0],
  ['site', 0, 0, 40, 1.1, 1.2, 1.8],
];
const browser = await launchChromium();
const measure = async file => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene?.landmarks?.info?.LM09, null, { timeout: 90000 });
  const rows = [];
  // First pass compiles all view-specific materials and textures in each fresh page.
  for (let pass = 0; pass < 2; pass++) for (const [name, x, z, dist, yaw, pitch, height] of views) {
    const row = await page.evaluate(({ x, z, dist, yaw, pitch, height }) => {
      const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === 'LM09');
      const d = Math.hypot(x, z), p = d < 1e-9 ? lm : W.destination(lm, Math.atan2(-x, z) * 180 / Math.PI, d);
      const t = W.lonLatToTown(p.lon, p.lat);
      S.weather.lock('rain'); S.weather.setTime(600);
      S.view.set({ mapMode: 'flat', mode: 'free', target: [t.x, height, t.z], dist, yaw, pitch });
      window.__step(8);
      S.renderer.render(S.scene, S.camera);
      return { calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles,
        textures: S.renderer.info.memory.textures };
    }, { x, z, dist, yaw, pitch, height });
    if (pass === 1) rows.push({ name, ...row });
  }
  await page.close();
  const revision = execFileSync('git', ['-C', path.dirname(path.resolve(file)), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return { revision, pageErrors: errors, views: rows };
};
try {
  const before = await measure(beforeFile), after = await measure(path.join(root, 'index.html'));
  const delta = after.views.map((row, i) => ({ name: row.name,
    calls: row.calls - before.views[i].calls,
    triangles: row.triangles - before.views[i].triangles,
    textures: row.textures - before.views[i].textures }));
  const report = { method: 'Same Chromium session; fresh page per build; 1280x800 high; flat/rain/t=600; fixed WD1 views; warm-up pass then one render after __step(8). Counts are whole-frame, not isolated LM09 geometry.', before, after, delta };
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(report, null, 2) + '\n');
  for (const d of delta) console.log(`${d.name}: calls ${d.calls >= 0 ? '+' : ''}${d.calls}, triangles ${d.triangles >= 0 ? '+' : ''}${d.triangles}, textures ${d.textures >= 0 ? '+' : ''}${d.textures}`);
  console.log(`Page errors: WD0 ${before.pageErrors.length}, WD1 ${after.pageErrors.length}; report ${outFile}`);
  if (before.pageErrors.length || after.pageErrors.length) process.exitCode = 1;
} finally { await browser.close(); }
