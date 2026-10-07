// W8e-c checks: the sphere is a clear day at every zoom distance, the flat map keeps its night (docs/world/W8_SPEC.md 11.3, 11.4; D8 / D9 revised). Run after build.py.
//   node tools/day_check.mjs [--shots]
//   D1  weather on the sphere is always clear: six locked states x five places (rain belt by the town, ice, desert, forest, sea) x zoom 9 ... 400 m: no rain lines, no snow,
//       no fog (density 0, colour untinted), no ripples (town puddles, sea, paddies, road rings), no mist belt; the weather's light multipliers neutral; stars, light band and far lights 0
//   D2  the switch fades the weather linearly with uBend: rain opacity, ripple factors and the weather blend at uBend = 0, 0.25, 0.5, 0.75, 1 follow (1 - uBend); rainObj hidden at 1
//   D3  day light at render time: sky colour, the sun 50 deg above the target's local horizon on any target, the sky light along the local up; restored after the frame (the flat
//       lights untouched); emissive and additive light gone at uBend = 1 (the town's emissive store windows: frame with / without emissive identical)
//   D4  no flicker in the middle of the switch: at uBend = 0.25 / 0.5 / 0.75 the same frame twice is identical, the change from u - 0.01 to u and from u to u + 0.01 is even
//       (no spike: the larger of the two mean differences at most 3 x the smaller + 0.5 levels) and one-way (u - 0.01 -> u + 0.01 changes at least as much as either half)
//   --shots  (or --only-shots, without D1-D4) docs/world/w8e/: day-globe, day-farm, day-forest, day-coast, day-town (1280 x 800, sphere mode), day-switch-025 / 050 / 075 (the switch at uBend 0.25 / 0.5 / 0.75)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const fails = [], out = (ok, name, lines) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); };
const f = (x, n = 2) => (+x).toFixed(n);
const browser = await launchChromium(), errors = [];
async function open(w = 1280, h = 800) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT); await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__scene && window.__scene.transition, null, { timeout: 120000 }); await page.evaluate(() => window.__step(3)); return page;
}
const page = await open(800, 500), checks = !args.includes('--only-shots');   // --only-shots: the review images alone
const PLACES = [['城镇雨区', 0, 0], ['北冰原', 100, 74], ['沙漠', -115, -30], ['森林', -15, -40], ['海上', -80, -14]];

// ---- D1
if (checks) {
  const r = await page.evaluate(PLACES => {
    const S = window.__scene, T = S.transition, W = window.WORLD, rows = [], bad = [];
    T.setMode('sphere'); T.step(3);
    const rain = S.scene.children.find(c => c.isLineSegments && c.geometry.attributes.position.count === 5600);
    for (const st of ['rain', 'after', 'overcast', 'clear', 'snow', 'fog']) for (const [name, lon, lat] of PLACES) for (const d of [9, 25, 60, 150, 400]) {
      const q = W.lonLatToTown(lon, lat); S.weather.lock(st); S.view.set({ target: [q.x, 1.2, q.z], dist: d, pitch: 0.6, yaw: 0.4 }); window.__step(3); S.renderer.render(S.scene, S.camera);
      const g = S.weather.get(), n = S.night.light.get(), O = S.ocean.uniforms, snow = S.scene.children.find(c => c.isPoints && c.material.size === 0.09);
      const v = { rain: rain.visible && rain.material.opacity > 0, snow: !!(snow && snow.visible && snow.material.opacity > 0), fog: S.scene.fog.density, fogTint: S.scene.fog.color.getHexString(), wl: g.wLocal, sea: O.uRain.value, mist: S.cover.objects.mist ? S.cover.objects.mist.material.opacity : 0, stars: n.stars, band: n.band, k: n.k };
      const ok = !v.rain && !v.snow && v.fog === 0 && v.wl === 0 && v.sea === 0 && v.mist === 0 && v.stars === 0 && v.band === 0 && v.k === 0;
      if (!ok && bad.length < 6) bad.push(`${st} ${name} d=${d} ${JSON.stringify(v)}`);
      rows.push(ok);
    }
    return { n: rows.length, ok: rows.filter(Boolean).length, bad };
  }, PLACES);
  out(r.ok === r.n, 'W8e-c D1 球形模式在任何缩放距离都晴朗：无雨、雪、雾、涟漪、雾带，星空/光带/可读性光照为 0', [`6 种锁定天气 × 5 处 × 5 个距离（9–400 m）= ${r.n} 个画面，全部满足 ${r.ok}`, ...r.bad]);
}
// ---- D2
if (checks) {
  const r = await page.evaluate(() => {
    const S = window.__scene, T = S.transition, rows = []; const rain = S.scene.children.find(c => c.isLineSegments && c.geometry.attributes.position.count === 5600);
    T.setMode('flat'); T.step(3); S.weather.lock('rain'); S.view.set({ target: [-7, 1.2, 20], dist: 34, yaw: 2.5, pitch: 0.5 }); window.__step(3);
    T.animating = false;   // uBend pinned by hand on the app's own path (fog, terrain and weather follow it as in the switch)
    for (const u of [0, 0.25, 0.5, 0.75, 1]) { S.bend.set(u); window.__step(2); const g = S.weather.get(); rows.push({ u, dry: g.dry, rain: rain.material.opacity, shown: rain.visible, sea: S.ocean.state.built ? S.ocean.uniforms.uRain.value : null }); }
    S.bend.set(0); T.setMode('flat'); T.step(3);
    return rows;
  });
  const ok = r.every(q => Math.abs(q.dry - (1 - q.u)) < 1e-12 && Math.abs(q.rain - 0.29 * (1 - q.u)) < 1e-9 && (q.sea === null || Math.abs(q.sea - (1 - q.u)) < 1e-12)) && r[4].shown === false && r[0].shown === true;
  out(ok, 'W8e-c D2 切换时天气随 uBend 线性淡出（锁雨，城镇默认机位）、uBend = 1 时雨丝对象隐藏', r.map(q => `uBend ${q.u}：天气系数 ${f(q.dry, 3)}，雨丝不透明度 ${f(q.rain, 4)}（应为 ${f(0.29 * (1 - q.u), 4)}），雨丝对象${q.shown ? '显示' : '隐藏'}${q.sea === null ? '' : `，海面涟漪 ${f(q.sea, 3)}`}`));
}
// ---- D3
if (checks) {
  const r = await page.evaluate(() => {
    const S = window.__scene, T = S.transition, W = window.WORLD, B = S.bend, hemi = S.scene.children.find(o => o.isHemisphereLight), moon = S.scene.children.find(o => o.isDirectionalLight), D = Math.PI / 180;
    T.setMode('sphere'); T.step(3); S.weather.lock('clear'); let worstEl = 0, worstUp = 0, restored = true, n = 0, el0 = null;
    let s = 4321; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 24; i++) { const lon = -180 + rnd() * 360, lat = -78 + rnd() * 156, q = W.lonLatToTown(lon, lat); S.view.set({ target: [q.x, 1.2, q.z], dist: 9 + rnd() * 390, yaw: rnd() * 6.28, pitch: 0.2 + rnd() * 1.2 }); window.__step(2);
      const before = [hemi.intensity, moon.intensity, hemi.color.getHex(), moon.color.getHex(), hemi.position.toArray().join(), moon.position.toArray().join(), S.scene.background.getHex()].join('|');
      S.renderer.render(S.scene, S.camera); const L = S.day.state.last, b = B.basis(B.wrapX(q.x), q.z);
      const el = Math.asin(L.sun[0] * b.up[0] + L.sun[1] * b.up[1] + L.sun[2] * b.up[2]) / D, up = Math.acos(Math.min(1, L.up[0] * b.up[0] + L.up[1] * b.up[1] + L.up[2] * b.up[2])) / D;
      if (el0 === null) el0 = el; worstEl = Math.max(worstEl, Math.abs(el - el0)); worstUp = Math.max(worstUp, up); n++;
      const after = [hemi.intensity, moon.intensity, hemi.color.getHex(), moon.color.getHex(), hemi.position.toArray().join(), moon.position.toArray().join(), S.scene.background.getHex()].join('|'); if (after !== before) restored = false; }
    const last = S.day.state.last;
    // emissive and additive light at uBend = 1: the frame does not change when every emissive colour is black and every additive object hidden
    S.view.set({ target: [-7, 1.2, 20], dist: 60, yaw: 2.5, pitch: 0.7 }); window.__step(3); S.renderer.render(S.scene, S.camera); const a = S.renderer.domElement.toDataURL();
    const em = [], hid = []; S.scene.traverse(o => { if (!o.material) return; for (const m of [].concat(o.material)) { if (m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b)) { em.push([m, m.emissive.clone()]); } if (m.blending === THREE.AdditiveBlending && o.visible) hid.push(o); } });
    for (const [m] of em) m.emissive.setRGB(0, 0, 0); for (const o of hid) o.visible = false;
    S.renderer.render(S.scene, S.camera); const b2 = S.renderer.domElement.toDataURL();
    for (const [m, c] of em) m.emissive.copy(c); for (const o of hid) o.visible = true;
    return { n, worstEl, el0, worstUp, restored, sky: last.sky, hemiI: last.hemi, sunI: last.sunI, same: a === b2, em: new Set(em.map(q => q[0])).size, add: hid.length };
  });
  out(r.worstEl < 0.05 && r.worstUp < 0.05 && r.restored && r.same, 'W8e-c D3 渲染时的白天光照：日光在任何目标点的局部天空里方向固定，天光沿局部向上，渲染后还原；自发光与加法混合的光为 0', [
    `${r.n} 个随机目标（d 9–400 m）：日光高度角 ${f(r.el0, 2)}°，各目标最大偏差 ${f(r.worstEl, 4)}°；天光方向与局部向上的最大夹角 ${f(r.worstUp, 4)}°；天空 #${r.sky}，天光 ${f(r.hemiI, 2)}，日光 ${f(r.sunI, 2)}`,
    `渲染前后天光、月光（强度、颜色、方向）与背景色逐值相同：${r.restored}（平面模式的灯光和天气系统读回的仍是自己的值）`,
    `城镇 d = 60：把 ${r.em} 个自发光材质设为黑、隐藏 ${r.add} 个加法混合物体后画面逐字节相同：${r.same}`]);
}
// ---- D4
if (checks) {
  const r = await page.evaluate(async () => {
    const S = window.__scene, T = S.transition; T.setMode('flat'); T.step(3); S.weather.lock('clear'); S.view.set({ target: [0, 1.2, 0], dist: 220, yaw: 2.5, pitch: 0.9 }); window.__step(3); T.animating = false;   // uBend pinned by hand on the app's own path (fog, terrain and weather follow it as in the switch)
    const img = () => { S.renderer.render(S.scene, S.camera); const c = S.renderer.domElement, g = c.getContext('webgl2') || c.getContext('webgl'); const d = new Uint8Array(c.width * c.height * 4); g.readPixels(0, 0, c.width, c.height, g.RGBA, g.UNSIGNED_BYTE, d); return d; };
    const md = (A, B) => { let s = 0, mx = 0; for (let k = 0; k < A.length; k += 4) { const d = Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])); s += d; if (d > mx) mx = d; } return { mean: s / (A.length / 4), max: mx }; };
    const rows = [];
    for (const u of [0.25, 0.5, 0.75]) {
      const at = v => { S.bend.set(v); window.__step(1); return img(); };
      const a = at(u - 0.01), b = at(u), b2 = img(), c = at(u + 0.01);
      rows.push({ u, twice: md(b, b2).max, lo: md(a, b).mean, hi: md(b, c).mean, span: md(a, c).mean });
    }
    S.bend.set(0); window.__step(2); return rows;
  });
  const ok = r.every(q => q.twice === 0 && Math.max(q.lo, q.hi) <= 3 * Math.min(q.lo, q.hi) + 0.5 && q.span >= Math.max(q.lo, q.hi));
  out(ok, 'W8e-c D4 切换中间帧无闪烁（uBend = 0.25 / 0.5 / 0.75）', r.map(q => `uBend ${q.u}：同一帧渲染两次最大通道差 ${q.twice}；u − 0.01 → u 平均差 ${f(q.lo, 3)}，u → u + 0.01 平均差 ${f(q.hi, 3)}（两侧均匀，无突变），u − 0.01 → u + 0.01 平均差 ${f(q.span, 3)}（≥ 任一半：单向渐变、不来回跳；2 秒动画在 60 帧/秒下每帧 uBend 最多变 0.0125）`));
}
// ---- shots
if (args.includes('--shots') || !checks) {
  const dir = path.join(root, 'docs/world/w8e'); fs.mkdirSync(dir, { recursive: true });
  const ps = await open(1280, 800);
  const V = await ps.evaluate(() => { const W = window.WORLD, q = (lon, lat) => { const p = W.lonLatToTown(lon, lat); return [p.x, 1.2, p.z]; }; return { globe: [0, 1.2, 0], farm: [-71.828978, 1.2, -12.320293], forest: q(-12, -39), coast: q(-51, -8), town: [-7, 1.2, 20] }; });
  const SHOTS = [['day-globe', { target: V.globe, dist: 330, yaw: 2.5, pitch: 1.1 }], ['day-farm', { target: V.farm, dist: 25, yaw: 2.5, pitch: 0.65 }], ['day-forest', { target: V.forest, dist: 30, yaw: 0.6, pitch: 0.5 }], ['day-coast', { target: V.coast, dist: 45, yaw: 1.2, pitch: 0.5 }], ['day-town', { target: V.town, dist: 60, yaw: 2.5, pitch: 0.75 }]];
  for (const [name, v] of SHOTS) {
    const url = await ps.evaluate(v => { const S = window.__scene; S.weather.lock('rain'); S.transition.setMode('sphere'); S.transition.step(3); S.view.set(v); window.__step(8); S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL('image/png'); }, v);
    fs.writeFileSync(path.join(dir, name + '.png'), Buffer.from(url.split(',')[1], 'base64')); console.log('shot', `docs/world/w8e/${name}.png`, JSON.stringify(v));
  }
  // three frames of the switch (uBend pinned on the app's own path: fog, sky and weather follow it), town target, d = 260
  for (const u of [0.25, 0.5, 0.75]) {
    const url = await ps.evaluate(u => { const S = window.__scene, T = S.transition; S.weather.lock('rain'); T.setMode('flat'); T.step(3); S.view.set({ target: [0, 1.2, 0], dist: 260, yaw: 2.5, pitch: 0.9 }); T.animating = false; S.bend.set(u); window.__step(4); S.renderer.render(S.scene, S.camera); const d = S.renderer.domElement.toDataURL('image/png'); S.bend.set(0); window.__step(2); return d; }, u);
    const name = 'day-switch-' + String(u * 100).padStart(3, '0'); fs.writeFileSync(path.join(dir, name + '.png'), Buffer.from(url.split(',')[1], 'base64')); console.log('shot', `docs/world/w8e/${name}.png`, `uBend ${u}`);
  }
  await ps.close();
}
if (errors.length) { console.log('page errors:', errors.slice(0, 5).join(' | ')); fails.push('page errors'); }
await browser.close();
console.log(fails.length ? `FAIL day_check：${fails.join('；')}` : 'PASS day_check');
process.exitCode = fails.length ? 1 : 0;
