// WD1: LM09 eave drips follow the local flat-map weather and vanish on the sphere.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './landmark_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene?.landmarks?.info?.LM09, null, { timeout: 90000 });
  const rows = [];
  const cases = [
    { mode: 'flat', weather: 'rain', dist: 15 },
    { mode: 'flat', weather: 'after', dist: 15 },
    { mode: 'flat', weather: 'clear', dist: 15 },
    ...[9, 60, 220, 400].map(dist => ({ mode: 'sphere', weather: 'rain', dist })),
    ...['after', 'snow', 'fog', 'clear'].map(weather => ({ mode: 'sphere', weather, dist: 60 })),
    { mode: 'flat', weather: 'rain', dist: 15 },
  ];
  for (const { mode, weather, dist } of cases) {
    rows.push(await page.evaluate(({ mode, weather, dist }) => {
      const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === 'LM09');
      const t = W.lonLatToTown(lm.lon, lm.lat);
      S.weather.lock(weather); S.weather.setTime(600);
      S.transition.setMode(mode); S.transition.step(3);
      S.view.set({ mapMode: mode, mode: 'free', target: [t.x, 1.8, t.z], dist, yaw: 0, pitch: 0.3 });
      window.__step(2);
      const drips = [];
      S.scene.traverse(o => { if (o.name === 'lm09EaveDrip') drips.push(o.material.opacity); });
      const g = S.weather.get();
      return { mode: S.view.get().mapMode, weather, dist: S.view.get().dist, count: drips.length, min: Math.min(...drips), max: Math.max(...drips), wLocal: g.wLocal };
    }, { mode, weather, dist }));
  }
  const sphere = rows.filter(r => r.mode === 'sphere');
  const ok = rows.every(r => r.count === 6) && rows[0].max > 0.05 && rows[1].max > 0.05 && rows[2].max === 0 && sphere.length === 8 && sphere.every(r => r.max === 0 && r.wLocal === 0) && rows.at(-1).max > 0.05 && errors.length === 0;
  for (const r of rows) console.log(`${r.mode} ${r.weather} d${r.dist.toFixed(1)}: ${r.count} drips, opacity ${r.min.toFixed(3)}…${r.max.toFixed(3)}, wLocal ${r.wLocal.toFixed(3)}`);
  console.log(`${ok ? 'PASS' : 'FAIL'} WD1 LM09 eave drip weather; page errors ${errors.length}`);
  if (!ok) process.exitCode = 1;
} finally { await browser.close(); }
