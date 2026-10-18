// WX3 checks (docs/world/WEATHER_COMPLETION_PLAN.md 6): the landform weather pieces. Run after `python3 build.py`:
//   node tools/weather_wx3_check.mjs [--report]       (--report writes docs/world/weather/wx3/report.json; no images)
//   X1  wetness memory (pure, weather.js): the same place and moment give the same wetness in any query order; bounded [0, 1]; change <= 1/40 per second; after
//       a wet spell it dries to 0 within WET_WINDOW; under a lock it is the locked state's own wetness
//   X2  surface responses in the shaders (snowCover, duneWet, poolWet, the paddies' mirror): the same frame rendered with the responses on (uWxK as the weather sets
//       it) and off (uWxK = 0) is identical where they must not act (locked rain in the town: the rain look is untouched; clear dry ground) and differs where they
//       must (snow on the ice, wet dunes after the rare rain, the lamp pools on dry ground, the paddies after the rain); uWxK is 0 at the panorama and on the sphere
//   X3  local pieces: leaf drips (under trees, in the forest, while it drips), ground mist (foggy places, mist), snow mist (where it snows), rain steam (lava, rain),
//       the fumaroles (BI08: lava, north / north-west of the summit, apart, off the roads; on the flat map in any weather, none on the sphere); none of them shows
//       where its weather is absent; the life steam of the town and LM02 / LM01 is not registered and does not change with the weather
//   X4  WX-0 again with the new pieces: lock clear at a forest, a coast, the ice and the lava: no drip or precipitation object drawn
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), require = createRequire(import.meta.url);
const fails = [], report = {}, out = (ok, name, lines, data) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); report[name.split(' ')[0]] = { ok, lines, data }; };
const f = (x, n = 2) => (x === null || x === undefined ? '—' : (+x).toFixed(n));

// ---- X1 (Node)
{
  global.LAYOUT = require(path.join(root, 'layout.js')); const W = require(path.join(root, 'world.js')), WX = require(path.join(root, 'weather.js'));
  const a = WX.make(W), b = WX.make(W), rows = [];
  let s = 4242; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pts = [[0, 0]]; for (let i = 0; i < 40; i++) pts.push([-180 + rnd() * 360, -70 + rnd() * 140]);
  let same = 0, n = 0, bounded = true, maxRate = 0;
  for (const [lon, lat] of pts) { const ts = []; for (let t = 0; t < 7200; t += 37) ts.push(t);
    const va = ts.map(t => a.wetnessAt(lon, lat, t)), vb = ts.slice().reverse().map(t => b.wetnessAt(lon, lat, t)).reverse();
    for (let i = 0; i < ts.length; i++) { n++; if (Math.abs(va[i] - vb[i]) <= 1e-12) same++; if (!(va[i] >= 0 && va[i] <= 1)) bounded = false; } }
  for (const [lon, lat] of pts.slice(0, 12)) { let prev = null; for (let t = 0; t < 21600; t += 1) { const v = a.wetnessAt(lon, lat, t); if (prev !== null) maxRate = Math.max(maxRate, Math.abs(v - prev)); prev = v; } }
  // drying: the town after its first rain -> non-wet change; wet must be 0 WET_WINDOW after the last wet moment (when the next slots are clear)
  const dry = []; for (let t = 300; t < 21600 && dry.length < 3; t += 300) { const q = a.sample(0, 0, t + 60); if (q.weights.clear === 1 && a.sample(0, 0, t - 1).weights.rain > 0.99) { const r = [0, 150, 300, 450, 600, 900].map(dt => +a.wetnessAt(0, 0, t + dt).toFixed(3)); const later = [1, 2, 3].map(k => a.sample(0, 0, t + k * 300 + 60).state); dry.push({ t, r, later }); } }
  // the definition, by brute force: at random places and moments the memory equals the largest wetness(tau) x (1 - (t - tau) / WET_WINDOW)^2 over the window
  // sampled every 1 s (the analytic maximum is taken at the slot starts and fade ends, so it can only be the larger, by at most one second's change);
  // nothing older than WET_WINDOW counts, so a place is dry WET_WINDOW after its last wet moment
  const wetOf = w => { let v = 0; for (const k in w) v += w[k] * WX.EFFECT[k].wetness; return v; }; let brute = 0, bruteMax = 0, bruteMin = 0;
  for (let i = 0; i < 24; i++) { const lon = -180 + rnd() * 360, lat = -70 + rnd() * 140; for (let k = 0; k < 20; k++) { const t = 900 + rnd() * 20000, m = a.wetnessAt(lon, lat, t); let best = 0;
    for (let tau = Math.ceil(t - WX.WET_WINDOW); tau <= t; tau++) { const age = 1 - (t - tau) / WX.WET_WINDOW, v = wetOf(a.sample(lon, lat, tau).weights) * age * age; if (v > best) best = v; }
    best = Math.max(best, wetOf(a.sample(lon, lat, t).weights)); brute++; bruteMax = Math.max(bruteMax, m - best); bruteMin = Math.min(bruteMin, m - best); } }
  a.lock('clear'); const lc = a.wetnessAt(0, 0, 1000); a.lock('after'); const la = a.wetnessAt(0, 0, 1000); a.lock(null);
  const okDry = dry.length > 0 && dry.every(d => d.r[0] >= d.r[1] && d.r[1] >= d.r[2] && (d.later.some(s2 => s2 !== 'clear') || d.r[5] === 0)) && bruteMin >= -0.005 && bruteMax <= 0.03;   // the endpoints of a fade can miss an interior maximum only where the drying factor is small (< 0.005)
  out(same === n && bounded && maxRate <= 1 / 40 + 1e-9 && okDry && lc === 0 && la === 1, 'X1 湿润记忆：可复现、有界、缓慢，雨停后在窗口内干透；锁定时无记忆', [`${pts.length} 处 × ${n / pts.length} 个时刻，正序与倒序（两个实例）一致 ${same}/${n}，全部在 [0, 1]：${bounded}`, `12 处每 1 s 采样 6 小时：最大变化 ${f(maxRate, 4)} /s（上限 0.025）`, ...dry.map(d => `城镇 t = ${d.t} s 雨转晴：+0/150/300/450/600/900 s 湿润 ${d.r.join(' / ')}（其后三个时段 ${d.later.join('、')}）`), `按定义暴力核对 ${brute} 个（地点, 时刻）：解析结果与逐秒取样最大值之差在 ${f(bruteMin, 4)} 到 +${f(bruteMax, 4)} 之间（渐变中途的极大值只在干燥系数很小处被端点漏掉，限 −0.005；高出限 +0.03）；窗口之外的雨不再计入`, `锁晴 ${lc}、锁雨后 ${la}（WET_WINDOW = ${WX.WET_WINDOW} s，干燥 (1 − 间隔 / 窗口)²）`], { dry, maxRate });
}

const browser = await launchChromium(), errors = [];
async function open(w = 800, h = 500) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT); await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__scene && window.__scene.weather, null, { timeout: 120000 });
  await page.evaluate(() => {
    const S = window.__scene, Wx = S.weather, W = window.WORLD, U = window.WEATHER_FX.surface.uniforms;
    const find = (test, n = 80000, pre = null) => { let s = 917; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; for (let i = 0; i < n; i++) { const lon = -180 + rnd() * 360, lat = -76 + rnd() * 152; if (pre && !pre(lon, lat)) continue; const p = Wx.place(lon, lat); if (test(p, lon, lat)) return { lon, lat }; } return null; };
    const inside = (p, lon, lat, r = 8) => [0, 90, 180, 270].every(b => { const q = W.destination({ lon, lat }, b, r); return Wx.place(q.lon, q.lat).cat === p.cat; });
    const P = { town: { lon: 0, lat: 0 } };
    P.forest = find((p, lon, lat) => p.kind === 'forest' && p.fog === 1 && inside(p, lon, lat, 12));
    P.coast = find((p, lon, lat) => p.cat === 'foggy' && p.kind !== 'forest' && p.fog === 1 && W.coastDistance(lon, lat) < 10 && W.height(lon, lat) > 0.6 && inside(p, lon, lat, 4));
    P.ice = find((p, lon, lat) => p.cat === 'ice' && inside(p, lon, lat, 12));
    P.desert = find((p, lon, lat) => p.cat === 'desert' && inside(p, lon, lat, 12));
    P.lava = find((p, lon, lat) => p.cat === 'lava' && inside(p, lon, lat, 6));
    P.paddy = (() => { const pl = S.section.plan && S.section.plan(); return W.townToLonLat(0, 30); })();
    for (const k in P) if (P[k]) { const q = W.lonLatToTown(P[k].lon, P[k].lat); P[k].xz = [q.x, q.z]; }
    const go = (p, dist = 20, o = {}) => { S.view.set({ target: [p.xz[0], 1.2, p.xz[1]], dist, pitch: o.pitch ?? 0.5, yaw: o.yaw ?? 0.6 }); window.__step(o.frames ?? 3); };
    const pixels = () => { S.renderer.render(S.scene, S.camera); const gl = S.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
    const diff = (a, b) => { let n = 0, max = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d) { n++; if (d > max) max = d; } } return { n, max }; };
    // the responses on (as set) against off (uWxK = 0), same frame
    const toggle = () => { const k = U.uWxK.value, a = pixels(); U.uWxK.value = 0; const b = pixels(); U.uWxK.value = k; return { k, ...diff(a, b) }; };
    window.__x3 = { S, Wx, W, P, go, toggle, pixels, diff, U };
  });
  await page.evaluate(() => window.__step(3)); return page;
}
const page = await open();
const places = await page.evaluate(() => Object.fromEntries(Object.entries(window.__x3.P).map(([k, p]) => [k, p ? [+p.lon.toFixed(2), +p.lat.toFixed(2)] : null])));
report.places = places; console.log('地点：' + Object.entries(places).map(([k, p]) => `${k} ${p ? '(' + p.join(', ') + ')' : '未找到'}`).join('；'));

// ---- X2
{
  const r = await page.evaluate(() => {
    const { S, Wx, P, go, toggle, U } = window.__x3, T = S.transition, rows = [];
    const row = (name, fn, want) => { const q = fn(); rows.push({ name, want, ...q }); };
    row('城镇锁雨（默认机位）：雨的外观不变', () => { Wx.lock('rain'); S.view.set({ target: [-7, 1.2, 20], dist: 34, yaw: 2.5, pitch: 0.5 }); window.__step(3); return toggle(); }, 'same');
    row('城镇锁晴：路灯光池与水洼倒影在干地面上变暗', () => { Wx.lock('clear'); window.__step(3); return toggle(); }, 'differ');
    row('冰原锁雪：地面薄层增白', () => { Wx.lock('snow'); go(P.ice, 18); return toggle(); }, 'differ');
    row('冰原锁晴：无响应', () => { Wx.lock('clear'); go(P.ice, 18); return toggle(); }, 'same');
    // the desert after its rare rain: a natural moment with no rain but wetness memory > 0
    row('沙漠雨后（自然天气）：湿斑', () => { Wx.lock(null); const W0 = Wx.weather; let tw = null; for (let t = 300; t < 21600 * 4 && tw === null; t += 60) { const q = W0.sample(P.desert.lon, P.desert.lat, t); if (q.weights.rain === 0 && W0.wetnessAt(P.desert.lon, P.desert.lat, t) > 0.6) tw = t; } if (tw === null) return { k: null, n: -1, max: 0 }; Wx.setTime(tw); go(P.desert, 14, { pitch: 0.7 }); const o = toggle(); Wx.setTime(null); return { ...o, t: tw }; }, 'differ');
    row('沙漠锁晴（干）：无湿斑', () => { Wx.lock('clear'); go(P.desert, 14, { pitch: 0.7 }); return toggle(); }, 'same');
    row('水田锁雨后：水面像镜子', () => { Wx.lock('after'); go({ xz: [0, 34] }, 24, { pitch: 0.6, yaw: 3.1 }); return toggle(); }, 'differ');
    row('水田锁雨：与原先相同', () => { Wx.lock('rain'); go({ xz: [0, 34] }, 24, { pitch: 0.6, yaw: 3.1 }); return toggle(); }, 'same');
    const k = {}; Wx.lock('snow'); go(P.ice, 18); k.near = U.uWxK.value; S.view.set({ dist: 350, pitch: 0.9 }); window.__step(3); k.panorama = U.uWxK.value; T.setMode('sphere'); T.step(3); go(P.ice, 30); k.sphere = U.uWxK.value; T.setMode('flat'); T.step(3); window.__step(2);
    Wx.lock(null); return { rows, k };
  });
  const ok = r.rows.every(q => q.want === 'same' ? q.n === 0 : q.n > 0) && r.k.near === 1 && r.k.panorama === 0 && r.k.sphere === 0;
  out(ok, 'X2 着色器响应：只在该出现的地方出现（同帧开关对比）', [...r.rows.map(q => `${q.name}：uWxK ${f(q.k, 2)}，开/关差异像素 ${q.n}${q.max ? `（最大 ${q.max}）` : ''}${q.t ? `，t = ${q.t} s` : ''} → 要求${q.want === 'same' ? '相同' : '不同'}`), `uWxK：近处 ${r.k.near}、全景 ${r.k.panorama}、球形 ${r.k.sphere}`], r);
}

// ---- X3
{
  const r = await page.evaluate(() => {
    const { S, Wx, W, P, go } = window.__x3, T = S.transition, res = [];
    const local = () => Wx.local() && Wx.local().shown ? { ...Wx.local().shown } : { drips: 0, mist: 0, snowMist: 0, steam: 0, vents: 0 };
    const at = (pk, st, d = 18) => { Wx.lock(st); go(P[pk], d, { frames: 4 }); return local(); };
    res.push(['森林 雨', 'drips', at('forest', 'rain'), '>0'], ['森林 雨后', 'drips', at('forest', 'after'), '>0'], ['森林 晴', 'drips', at('forest', 'clear'), '0'], ['城镇 雨', 'drips', at('town', 'rain'), '0']);
    res.push(['森林 雾', 'mist', at('forest', 'fog'), '>0'], ['海岸 雾', 'mist', at('coast', 'fog'), '>0'], ['森林 雨', 'mist', at('forest', 'rain'), '0'], ['城镇 雨后', 'mist', at('town', 'after'), '0']);
    res.push(['冰原 雪', 'snowMist', at('ice', 'snow'), '>0'], ['冰原 晴', 'snowMist', at('ice', 'clear'), '0']);
    res.push(['熔岩 雨', 'steam', at('lava', 'rain'), '>0'], ['熔岩 晴', 'steam', at('lava', 'clear'), '0'], ['森林 雨', 'steam', at('forest', 'rain'), '0']);
    // the drips hang under their trees: every shown drip lies within its tree's crown and between its foot and its crown
    Wx.lock('rain'); go(P.forest, 18, { frames: 4 }); const L = Wx.local(), pos = L.dripPos, sel = L.sel; let off = 0, nd = L.shown.drips;
    for (let i = 0; i < nd; i++) { const x = pos[i * 6], y = pos[i * 6 + 1], z = pos[i * 6 + 2]; if (!sel.some(t => Math.hypot(t.x - x, t.z - z) <= t.r * 1.0 + 1e-6 && y >= t.y - 0.01 && y <= t.y + t.h + 0.01)) off++; }
    // the fumaroles
    const V = Wx.fumaroles(), lm = W.landmarks.find(q => q.id === 'LM01'), vs = V.map(v => ({ d: W.arcDistance(v, lm), cat: Wx.place(v.lon, v.lat).cat, road: S.roads && window.STREETLIGHTS ? null : null }));
    let apart = Infinity; for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) apart = Math.min(apart, W.arcDistance(V[i], V[j]));
    const surfRoad = S.streetlights.data().surface, onRoad = V.filter(v => surfRoad(v.x, v.z) != null).length;
    const vf = W.lonLatToTown(lm.lon, lm.lat), ventShown = {};
    for (const st of ['rain', 'clear', 'snow', 'fog']) { Wx.lock(st); S.view.set({ target: [V[0].x, 1.2, V[0].z], dist: 30, pitch: 0.5, yaw: 0.4 }); window.__step(3); ventShown[st] = local().vents; }
    T.setMode('sphere'); T.step(3); window.__step(3); ventShown.sphere = local().vents; const sphereAll = local(); T.setMode('flat'); T.step(3); window.__step(2);
    // life steam: not registered, and its visibility does not change with the weather
    const reg = new Set(Wx.effectObjects()), life = []; S.scene.traverse(o => { if (o.name && /steam|^lm01Vent|^lm02Live/i.test(o.name) && !/^weather:/.test(o.name)) life.push(o); });
    const vis = () => life.map(o => o.visible).join('') + '|' + life.filter(o => reg.has(o)).length;
    Wx.lock('rain'); window.__step(2); const v1 = vis(); Wx.lock('clear'); window.__step(2); const v2 = vis();
    Wx.lock(null); void vf;
    return { res, off, nd, vents: V.length, vs, apart, onRoad, ventShown, sphereAll, life: life.length, lifeSame: v1 === v2, lifeReg: +v1.split('|')[1] };
  });
  const rows = r.res.map(([name, k, v, want]) => ({ name, k, v: v[k], want, ok: want === '0' ? v[k] === 0 : v[k] > 0 }));
  const vOk = r.vents >= 4 && r.vs.every(q => q.cat === 'lava' && q.d >= 11.9 && q.d <= 34.1) && r.apart >= 5.99 && r.onRoad === 0 && ['rain', 'clear', 'snow', 'fog'].every(s => r.ventShown[s] === r.vents * 5) && r.ventShown.sphere === 0 && Object.values(r.sphereAll).every(v => v === 0);
  out(rows.every(q => q.ok) && r.off === 0 && vOk && r.lifeSame && r.lifeReg === 0, 'X3 局部天气件：叶尖滴水、贴地雾、雪雾、熔岩雨汽只在其天气处；喷气孔在平面任何天气都有、球形无；生活蒸汽不受影响', [
    ...rows.map(q => `${q.name}：${q.k} ${q.v}（要求 ${q.want}）`), `叶尖滴水 ${r.nd} 条全部在所属树的树冠半径内、树脚与树冠之间：越界 ${r.off}`,
    `喷气孔 ${r.vents} 处：均为熔岩、距山顶 ${r.vs.map(q => q.d.toFixed(1)).join(' / ')} m，最近相距 ${f(r.apart, 1)} m，在路面上 ${r.onRoad}；平面 雨/晴/雪/雾 显示 ${['rain', 'clear', 'snow', 'fog'].map(s => r.ventShown[s]).join(' / ')} 团，球形 ${r.ventShown.sphere}（球形时全部局部件 ${JSON.stringify(r.sphereAll)}）`,
    `非天气蒸汽对象 ${r.life} 个（建筑的 *Steam 组、LM01 火山口喷气、LM02 温泉动画组）：登记为天气效果的 ${r.lifeReg}，锁雨与锁晴可见性${r.lifeSame ? '相同' : '不同'}`], r);
}

// ---- X4
{
  const r = await page.evaluate(() => {
    const { S, Wx, P, go } = window.__x3, rows = [];
    const drawnLocal = () => { const L = Wx.local(); if (!L || !L.built) return 0; let n = 0; const list = [L.drips, S.rain.obj, Wx.snow() && Wx.snow().o].filter(Boolean), keep = list.map(o => o.onBeforeRender); list.forEach(o => { o.onBeforeRender = () => { n++; }; }); S.renderer.render(S.scene, S.camera); list.forEach((o, i) => { o.onBeforeRender = keep[i]; }); return n; };
    for (const pk of ['forest', 'coast', 'ice', 'lava']) for (const d of [9, 40]) { Wx.lock(pk === 'ice' ? 'snow' : 'rain'); go(P[pk], d, { frames: 3 }); Wx.lock('clear'); window.__step(1); rows.push({ pk, d, n: drawnLocal() }); }
    Wx.lock(null); return rows;
  });
  out(r.every(q => q.n === 0), 'X4 WX-0 复核：锁晴后叶尖滴水、雨丝、雪都不绘制（森林、海岸、冰原、熔岩，d = 9 / 40）', r.map(q => `${q.pk} d=${q.d}：绘制 ${q.n}`), r);
}

await page.close();
if (errors.length) { console.log('page errors:', errors.slice(0, 5).join(' | ')); fails.push('page errors'); }
await browser.close();
if (args.includes('--report')) { const dir = path.join(root, 'docs', 'world', 'weather', 'wx3'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ date: new Date().toISOString().slice(0, 10), fails, report }, null, 1)); console.log('报告：docs/world/weather/wx3/report.json'); }
console.log(fails.length ? `FAIL weather_wx3_check：${fails.join('；')}` : `PASS weather_wx3_check（${Object.keys(report).filter(k => k !== 'places').length} 项）`);
process.exitCode = fails.length ? 1 : 0;
