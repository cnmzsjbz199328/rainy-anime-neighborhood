// WC14 (W8d, W8_SPEC section 6): at panorama distance (camera height h >= 120 m) there is no rain and no cloud cover over the ground, and all four directions stay readable. Run after `python3 build.py`:
//   node tools/wc14_check.mjs [--ref pre-w7-lm01]
//   A  every weather state renders the same panorama: the picture (clear moonlit night) is bit for bit the same for rain, after, overcast, clear, snow and fog; no rain or snow object is drawn
//      (the rain lines and the snow flakes are hidden, no object named like a cloud exists). The stars are the sky, not weather, and stay.
//   B  the ground is not a flat colour: per direction (FRONT 0, EAST 90, BACK 180, WEST -90) and per region kind, the standard deviation of the brightness of the ground pixels is at least
//      0.8 x the value of the same measurement on the build of W6's end (the `--ref` tag, default pre-w7-lm01, the state before the first landmark), both measured with the 'panorama' light
//      preset and the same camera. The ground under each pixel comes from the ray against the planet's sphere and world.js regionAt (terrain height is ignored: a statistic, not a map)
//   C  the road light band is there in every direction: at least 1500 pixels (1280 x 800) that differ when the band is hidden
//   D  a landmark light is visible in every direction: at least one far light (store / onsen village / harbour / lighthouse) changes the picture by 40 levels or more when it is hidden
// Since W8e (D9 revised, D10) the panorama is the sphere mode, a clear day without the band and the lights: A and the app path of B run there; C and D, the night lights seen from
// panorama height, run on the flat map at 350 m over night_check's four places (the flat map's own panorama; the town is its default centre). Corrected in W8f-b, thresholds unchanged.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const ref = arg('--ref', 'pre-w7-lm01');
const results = [], fails = [], out = (ok, name, lines) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); };
const f = (x, n = 2) => (+x).toFixed(n);
const DIRS = [['FRONT', 0, 6], ['EAST', 90, 0], ['BACK', 180, 0], ['WEST', -90, 0]];
const browser = await launchChromium(), errors = [];
async function open(html, w = 1280, h = 800) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT); await page.goto(pathToFileURL(html).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__scene && window.__scene.view, null, { timeout: 120000 }); await page.evaluate(() => window.__step(2)); return page;
}
const shot = page => page.evaluate(() => { const S = window.__scene; S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL('image/png'); });
// the camera straight above (lon, lat), `fromCentre` metres from the planet's centre, the section's panorama light preset and ink (what the W5-W7 tools did by hand); works on builds without landmarks / weather
const place = (page, lon, lat, fromCentre) => page.evaluate(([lon, lat, dd]) => { const S = window.__scene, T = window.THREE, R = 90, D = Math.PI / 180, cam = S.camera;
  S.bend.set(1); S.section.setMode(true); S.section.ensure(); S.roads.ensure(); if (S.landmarks) S.landmarks.build(); if (S.ocean) S.ocean.ensure(); if (S.cover) S.cover.ensure();
  S.section.set({ rain: false, light: 'panorama', ink: 'panorama' }); const cp = Math.cos(lat * D), dir = new T.Vector3(cp * Math.sin(lon * D), cp * Math.cos(lon * D), -Math.sin(lat * D)), north = new T.Vector3(-Math.sin(lat * D) * Math.sin(lon * D), -Math.sin(lat * D) * Math.cos(lon * D), -cp), c = new T.Vector3(0, -R, 0);
  cam.near = 0.1; cam.far = 700; cam.position.copy(c).addScaledVector(dir, dd); cam.up.copy(north); cam.lookAt(c); cam.fov = 36; cam.updateProjectionMatrix(); cam.updateMatrixWorld(); S.scene.fog.density = 0;
  for (let i = 0; i < 2; i++) { S.section.tick(1.2, cam); S.roads.tick(1.2, cam); if (S.ocean) S.ocean.tick(1.2, cam); if (S.cover) S.cover.tick(1.2, cam); } S.section.forceLod(cam); }, [lon, lat, fromCentre]);
// brightness spread per region kind: for the pixels (every 4th) whose ray hits the sphere, the kind of the ground there; mean and standard deviation of the luminance
const regionStats = (page, url) => page.evaluate(async url => { const S = window.__scene, T = window.THREE, W = window.WORLD, R = 90, D = Math.PI / 180, cam = S.camera;
  const img = new Image(); img.src = url; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const q = c.getContext('2d'); q.drawImage(img, 0, 0); const d = q.getImageData(0, 0, c.width, c.height).data, w = c.width, h = c.height;
  cam.updateMatrixWorld(); const m = cam.matrixWorld.elements, right = new T.Vector3(m[0], m[1], m[2]), up = new T.Vector3(m[4], m[5], m[6]), fwd = new T.Vector3(-m[8], -m[9], -m[10]), pos = cam.position, tf = Math.tan(cam.fov * D / 2), asp = w / h, ctr = new T.Vector3(0, -R, 0), oc = pos.clone().sub(ctr), cc = oc.lengthSq() - R * R;
  const acc = {}; for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { const nx = (2 * (x + 0.5) / w - 1) * tf * asp, ny = (1 - 2 * (y + 0.5) / h) * tf, dir = right.clone().multiplyScalar(nx).addScaledVector(up, ny).add(fwd).normalize(), b = oc.dot(dir), disc = b * b - cc; if (disc <= 0) continue; const t = -b - Math.sqrt(disc); if (t <= 0) continue;
    const P = pos.clone().addScaledVector(dir, t).sub(ctr), lon = Math.atan2(P.x, P.y) / D, lat = Math.asin(Math.max(-1, Math.min(1, -P.z / R))) / D, reg = W.regionAt(lon, lat), kind = reg.zone === 'ocean' ? 'ocean' : /^ice/.test(reg.kind) ? 'ice' : reg.kind, k = (y * w + x) * 4, l = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
    const a = acc[kind] || (acc[kind] = { n: 0, s: 0, s2: 0 }); a.n++; a.s += l; a.s2 += l * l; }
  const res = {}; for (const [k, a] of Object.entries(acc)) { const mean = a.s / a.n; res[k] = { n: a.n, mean, std: Math.sqrt(Math.max(0, a.s2 / a.n - mean * mean)) }; } return res; }, url);

const html = path.join(root, 'index.html');
const page = await open(html);
// ---- A: every weather the same, no weather particles
{
  const L = []; let ok = true;
  await page.evaluate(() => { const S = window.__scene; S.weather.lock('clear'); S.transition.setMode('sphere'); S.transition.step(3); S.view.set({ target: [0, 1.2, 0], dist: 350, pitch: 1.5, yaw: 0 }); window.__step(60); });
  const info = await page.evaluate(() => { const S = window.__scene, g = S.weather.get(); return { h: g.h, time: g.time, lon: g.lon, lat: g.lat }; }), urls = {};
  const states = ['rain', 'after', 'overcast', 'clear', 'snow', 'fog'];
  for (const st of states) {
    await page.evaluate(([st, info]) => { const Wx = window.__scene.weather; Wx.lock(st); Wx.tick(info.time, 0, { lonLat: { lon: info.lon, lat: info.lat }, h: info.h, target: [0, 1.2, 0] }); }, [st, info]);
    urls[st] = await shot(page);
    const parts = await page.evaluate(() => { const S = window.__scene, rain = S.scene.children.find(o => o.isLineSegments && o.material && o.material.color && o.material.color.getHex() === 0xa9c9df), snow = S.scene.children.find(o => o.isPoints && o.material && o.material.color && o.material.color.getHex() === 0xeef4fb), cloud = []; S.scene.traverse(o => { if (/cloud/i.test(o.name || '')) cloud.push(o.name); }); return { rain: rain ? rain.visible : null, snow: snow ? snow.visible : false, cloud: cloud.length }; });
    if (parts.rain || parts.snow || parts.cloud) ok = false; L.push(`${st}：雨丝对象${parts.rain === null ? '不存在' : parts.rain ? '显示' : '隐藏'}，雪${parts.snow ? '显示' : '隐藏'}，云对象 ${parts.cloud} 个`);
  }
  const diffs = []; for (const st of states.slice(1)) { const d = await page.evaluate(async ([a, b]) => { const load = async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const q = c.getContext('2d'); q.drawImage(i, 0, 0); return q.getImageData(0, 0, c.width, c.height).data; }; const A = await load(a), B = await load(b); let n = 0; for (let k = 0; k < A.length; k += 4) if (A[k] !== B[k] || A[k + 1] !== B[k + 1] || A[k + 2] !== B[k + 2]) n++; return n; }, [urls.rain, urls[st]]); diffs.push(`${st} 对雨 ${d}`); if (d) ok = false; }
  out(ok, 'WC14-A 全景（相机离地 ' + f(info.h, 0) + ' m）任何天气画面逐位相同，没有雨丝、雪、云', [...L, `差异像素：${diffs.join('；')}`, '做法：同一帧、只换天气再应用（时钟不前进），与 W8b-C4 相同']);
}
// ---- B on the app's own panorama path (the sphere), C and D on the flat map at night
const curStats = {}, shots = {}, FLAT = [['FRONT', -25, 32], ['EAST', 90, 0], ['BACK', 180, 0], ['WEST', -125, 0]];
{
  await page.evaluate(() => { const S = window.__scene; S.weather.lock('clear'); S.transition.setMode('sphere'); S.transition.step(3); });
  for (const [name, lon, lat] of DIRS) {
    await page.evaluate(([lon, lat]) => { const S = window.__scene, q = window.WORLD.lonLatToTown(lon, lat); S.view.set({ target: [q.x, 1.2, q.z], dist: 350, pitch: 1.5, yaw: 0 }); window.__step(60); }, [lon, lat]);
    const A = await shot(page); shots[name] = A; curStats[name] = await regionStats(page, A);
  }
  await page.evaluate(() => { const S = window.__scene; S.transition.setMode('flat'); S.transition.step(3); });
  const rows = [], bandPx = {}, farPeak = {};
  for (const [name, lon, lat] of FLAT) {
    await page.evaluate(([lon, lat]) => { const S = window.__scene, q = window.WORLD.lonLatToTown(lon, lat); S.view.set({ target: [q.x, 1.2, q.z], dist: 350, pitch: 1.5, yaw: 0 }); window.__step(60); }, [lon, lat]);
    const A = await shot(page);
    const noBand = await page.evaluate(() => { const S = window.__scene, l = S.roads.state.band.meshes, was = l.map(m => m.visible); l.forEach(m => { m.visible = false; }); S.renderer.render(S.scene, S.camera); const u = S.renderer.domElement.toDataURL('image/png'); l.forEach((m, i) => { m.visible = was[i]; }); return u; });
    const noFar = await page.evaluate(() => { const S = window.__scene, m = S.night.light.far().mesh, was = m.visible; m.visible = false; S.renderer.render(S.scene, S.camera); const u = S.renderer.domElement.toDataURL('image/png'); m.visible = was; return u; });
    const cnt = await page.evaluate(async ([a, b, c]) => { const load = async u => { const i = new Image(); i.src = u; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const q = cv.getContext('2d'); q.drawImage(i, 0, 0); return q.getImageData(0, 0, cv.width, cv.height).data; }; const A = await load(a), B = await load(b), C = await load(c), L = (d, k) => 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; let band = 0, far = 0; for (let k = 0; k < A.length; k += 4) { if (L(A, k) - L(B, k) > 8) band++; far = Math.max(far, L(A, k) - L(C, k)); } return { band, far }; }, [A, noBand, noFar]);
    bandPx[name] = cnt.band; farPeak[name] = cnt.far; rows.push(`${name}：光带像素 ${cnt.band}，最亮的远景暖光点比隐藏它时亮 ${f(cnt.far, 0)} 级`);
  }
  const okC = FLAT.every(([n]) => bandPx[n] >= 1500), okD = FLAT.every(([n]) => farPeak[n] >= 40), at = ([n, lon, lat]) => `${n}（${lon}°, ${lat}°）`;
  out(okC, 'WC14-C 道路光带在四个方向的像素数 ≥ 1500（平面夜间，离地 350 m）', FLAT.map(d => `${at(d)} ${bandPx[d[0]]}`));
  out(okD, 'WC14-D 四个方向都能看到地标的光点（远景暖光点隐藏前后画面差 ≥ 40 级；平面夜间，离地 350 m）', FLAT.map(d => `${at(d)} ${f(farPeak[d[0]], 0)} 级`));
}
await page.close();
// the baseline: the build of W6's end, direct placement with the panorama preset; the current build measured the same way
{
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'wc14-')); execFileSync('git', ['worktree', 'add', '--detach', worktree, ref], { cwd: root, stdio: 'pipe' }); execFileSync('python3', ['build.py'], { cwd: worktree, stdio: 'pipe' });
  const base = {}, cur = {};
  for (const [label, file, into] of [['基线 ' + ref, path.join(worktree, 'index.html'), base], ['当前', html, cur]]) {
    const pg = await open(file); void label;
    for (const [name, lon, lat] of DIRS) { await place(pg, lon, lat, 400); into[name] = await regionStats(pg, await shot(pg)); }
    await pg.close();
  }
  let ok = true; const rows = [];
  for (const [name] of DIRS) for (const kind of Object.keys(base[name])) { const b = base[name][kind], c = cur[name][kind], app = curStats[name][kind]; if (b.n < 300 || !c || c.n < 300) continue;
    const need = 0.8 * b.std, good = c.std >= need && (!app || app.n < 300 || app.std >= need); if (!good) ok = false; rows.push(`${name} ${kind}（${b.n} 个采样）：基线 ${f(b.std, 1)}，当前 ${f(c.std, 1)}，应用路径 ${app ? f(app.std, 1) : '—'}，阈值 ${f(need, 1)} ${good ? '' : '← 未达标'}`); }
  out(ok, 'WC14-B 四个方向、按地貌类别的地表亮度标准差 ≥ W6 完成时（' + ref + '）的 0.8 倍（不能是平涂）', rows);
  try { execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: root, stdio: 'pipe' }); } catch { fs.rmSync(worktree, { recursive: true, force: true }); }
}
if (errors.length) { console.log('page errors:', errors.slice(0, 5).join(' | ')); fails.push('page errors'); }
await browser.close();
console.log(fails.length ? `FAIL wc14_check：${fails.join('；')}` : `PASS wc14_check（${results.length} 项）`);
process.exitCode = fails.length ? 1 : 0;
