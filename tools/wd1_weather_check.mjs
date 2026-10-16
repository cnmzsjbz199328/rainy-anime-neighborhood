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
  for (const [mode, weather] of [['flat', 'rain'], ['flat', 'after'], ['flat', 'clear'], ['sphere', 'rain'], ['flat', 'rain']]) {
    rows.push(await page.evaluate(({ mode, weather }) => {
      const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === 'LM09');
      const t = W.lonLatToTown(lm.lon, lm.lat);
      S.weather.lock(weather); S.weather.setTime(600);
      S.transition.setMode(mode); S.transition.step(3);
      S.view.set({ mapMode: mode, mode: 'free', target: [t.x, 1.8, t.z], dist: 15, yaw: 0, pitch: 0.3 });
      window.__step(8);
      const drips = [];
      S.scene.traverse(o => { if (o.name === 'lm09EaveDrip') drips.push(o.material.opacity); });
      const g = S.weather.get();
      return { mode: S.view.get().mapMode, weather, count: drips.length, min: Math.min(...drips), max: Math.max(...drips), wLocal: g.wLocal };
    }, { mode, weather }));
  }
  const ok = rows.every(r => r.count === 6) && rows[0].max > 0.05 && rows[1].max > 0.05 && rows[2].max === 0 && rows[3].max === 0 && rows[3].mode === 'sphere' && rows[4].max > 0.05 && errors.length === 0;
  for (const r of rows) console.log(`${r.mode} ${r.weather}: ${r.count} drips, opacity ${r.min.toFixed(3)}…${r.max.toFixed(3)}, wLocal ${r.wLocal.toFixed(3)}`);
  console.log(`${ok ? 'PASS' : 'FAIL'} WD1 LM09 eave drip weather; page errors ${errors.length}`);
  if (!ok) process.exitCode = 1;
} finally { await browser.close(); }
