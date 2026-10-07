// W8b checks and ST05 shots: weather.js (where and when) and weather_fx.js (what it looks like). Run after `python3 build.py`:  node tools/weather_check.mjs [--shots]
//   WC13 / C1  the same (lon, lat, t) gives the same weather on two page loads and in any order (1000 deterministic samples); the locked-rain pictures are tools/regress.mjs --weather lock:rain
//   C2  place rules (W8_SPEC 4.2): 100 places per category; ice never rain, town never snow, desert rain <= 5 %, forest / coast / river valleys get fog after rain, the snow line is continuous in height
//   C3  slow and rain-first: 1 s steps over 6 hours, weight change <= 1/40 per second, rain (snow on the ice) the largest share and >= 50 % where rain is allowed
//   C4  distance blend: rain opacity, fog density and light multipliers follow w_local(h) at h = 40 / 80 / 120 (+-0.02); at h >= 120 every weather renders the same picture
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const results = [], fails = [], out = (ok, name, lines) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); };
const f = (x, n = 2) => (+x).toFixed(n);
const browser = await launchChromium(), errors = [];
async function open(w = 800, h = 500) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT); await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.weather, null, { timeout: 90000 }); await page.evaluate(() => window.__step(2)); return page;
}
const shot = page => page.evaluate(() => { const S = window.__scene; S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL('image/png'); });
const diff = (page, a, b) => page.evaluate(async ([a, b]) => { const load = async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const q = c.getContext('2d'); q.drawImage(i, 0, 0); return q.getImageData(0, 0, c.width, c.height).data; }; const A = await load(a), B = await load(b); let n = 0, mx = 0; for (let k = 0; k < A.length; k += 4) { const d = Math.max(Math.abs(A[k] - B[k]), Math.abs(A[k + 1] - B[k + 1]), Math.abs(A[k + 2] - B[k + 2])); if (d > 0) n++; if (d > mx) mx = d; } return { n, mx }; }, [a, b]);
const SAMPLES = () => { let s = 777; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; const a = []; for (let i = 0; i < 1000; i++) a.push([-180 + rnd() * 360, -84 + rnd() * 168, rnd() * 21600]); return a; };

const p1 = await open();
// ---- C1
{
  const smp = SAMPLES(), run = (page, order) => page.evaluate(([smp, order]) => { const Wx = window.__scene.weather, idx = smp.map((_, i) => i); if (order) idx.reverse(); const r = new Array(smp.length); for (const i of idx) { const q = Wx.at(...smp[i]); r[i] = q.state + ':' + Object.values(q.weights).map(v => v.toFixed(6)).join(','); } return r; }, [smp, order]);
  const a = await run(p1, false), p2 = await open(), b = await run(p2, true); await p2.close();
  let same = 0; for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  const nonRain = a.filter(x => !x.startsWith('rain')).length;
  out(same === a.length, 'W8b-C1 / WC13 可复现：同一 (lon, lat, t) 两次页面加载、正序与倒序得到同一天气', [`1000 个确定性样本（全星球、0–6 h）：一致 ${same}/1000；其中非雨状态 ${nonRain} 个（确实在变）；锁定为雨的逐位画面见 regress --weather lock:rain`]);
}
// ---- C2, C3
{
  const r = await p1.evaluate(() => {
    const Wx = window.__scene.weather, W = window.WORLD; let s = 99; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const want = { ice: 100, mountain: 100, desert: 100, lava: 100, foggy: 100, default: 100, town: 100 }, got = {}; for (const k in want) got[k] = [];
    for (let i = 0; i < 400000 && Object.keys(want).some(k => got[k].length < want[k]); i++) {
      const lon = -180 + rnd() * 360, lat = -84 + rnd() * 168, p = Wx.place(lon, lat), cat = W.regionAt(lon, lat).kind === 'town' ? 'town' : p.cat;
      if (W.regionAt(lon, lat).zone === 'ocean' && cat !== 'foggy') continue; if (got[cat] && got[cat].length < want[cat]) got[cat].push([lon, lat]);
    }
    const sim = (lon, lat, step, T) => { const c = { rain: 0, after: 0, overcast: 0, clear: 0, snow: 0, fog: 0 }; let maxRate = 0, prev = null; for (let t = 0; t <= T; t += step) { const q = Wx.at(lon, lat, t); for (const k in c) c[k] += q.weights[k]; if (prev) for (const k in c) maxRate = Math.max(maxRate, Math.abs(q.weights[k] - prev[k]) / step); prev = q.weights; } const n = T / step + 1; for (const k in c) c[k] /= n; return { c, maxRate }; };
    const res = {};
    for (const k in got) { const L = got[k]; let rainMax = 0, snowMax = 0, rainMin = 1, fogMin = 1, largestOk = 0, maxRate = 0, fogAny = 0;
      for (const [lon, lat] of L) { const { c, maxRate: mr } = sim(lon, lat, 30, 21600); maxRate = Math.max(maxRate, mr); rainMax = Math.max(rainMax, c.rain); rainMin = Math.min(rainMin, c.rain + (k === 'mountain' ? c.snow : 0)); snowMax = Math.max(snowMax, c.snow); if (c.fog > 0) fogAny++;
        const lead = k === 'ice' ? c.snow : k === 'desert' ? c.clear : c.rain + (k === 'mountain' ? c.snow : 0); if (Object.entries(c).every(([s, v]) => v <= lead + 1e-9)) largestOk++; }
      res[k] = { n: L.length, rainMax, rainMin, snowMax, fogAny, largestOk, maxRate };
    }
    // snow line: snow fraction against height on mountain places, sorted by height: continuous (no jump > 0.6 between heights 0.3 m apart)
    const mp = got.mountain.map(([lo, la]) => [W.height(lo, la), Wx.place(lo, la).snowFrac]).sort((a, b) => a[0] - b[0]); let jump = 0; for (let i = 1; i < mp.length; i++) if (mp[i][0] - mp[i - 1][0] < 0.3) jump = Math.max(jump, Math.abs(mp[i][1] - mp[i - 1][1]));
    // C3: 1 s steps over 6 hours at 12 rain-allowed places
    const c3 = []; for (const k of ['town', 'default', 'foggy', 'lava', 'mountain', 'ice']) for (const [lon, lat] of got[k].slice(0, 2)) { const { c, maxRate } = sim(lon, lat, 1, 21600); c3.push({ k, c, maxRate }); }
    return { res, jump, mountains: mp.length, c3 };
  });
  const R = r.res, L = [];
  for (const k in R) L.push(`${k}：${R[k].n} 处；雨占比 ${f(R[k].rainMin)}–${f(R[k].rainMax)}，雪最大 ${f(R[k].snowMax)}，出现雾的地点 ${R[k].fogAny}，主导状态正确 ${R[k].largestOk}/${R[k].n}（${k === 'ice' ? '雪' : k === 'desert' ? '晴夜' : '雨'}最多）`);
  const ok2 = R.ice.rainMax === 0 && R.town.snowMax === 0 && R.default.snowMax === 0 && R.desert.rainMax <= 0.05 && Object.values(R).every(q => q.largestOk === q.n) && R.foggy.fogAny === R.foggy.n && R.default.fogAny === 0 && r.jump <= 0.6;
  out(ok2, 'W8b-C2 位置规则（冰盖无雨、城镇无雪、沙漠下雨 ≤ 5%、森林/岸线/河谷雨后起雾、雪线随高度连续）', [...L, `雪线：${r.mountains} 个山地点按高度排序，相邻（高差 < 0.3 m）雪的比例最大跳变 ${f(r.jump)}（雨夹雪带为雪线上下 ±0.8 m 的高度带）`, '「沙漠」类只含 world.js 中 kind = desert 的地点；LM06 遗迹圈（kind = ruin）按规格 4.2 归入「其余」']);
  const c3 = r.c3, maxRate = Math.max(...c3.map(q => q.maxRate)); let ok3 = maxRate <= 1 / 40 + 1e-9; const L3 = [];
  for (const q of c3) { const lead = q.k === 'ice' ? q.c.snow : q.c.rain + (q.k === 'mountain' ? q.c.snow : 0), largest = Object.values(q.c).every(v => v <= lead + 1e-9); if (lead < 0.5 || !largest) ok3 = false; L3.push(`${q.k}：${q.k === 'ice' ? '雪' : '雨'} ${f(lead * 100, 1)}%（其余 ${Object.entries(q.c).filter(([s, v]) => v > 0 && !['rain', q.k === 'ice' || q.k === 'mountain' ? 'snow' : ''].includes(s)).map(([s, v]) => s + ' ' + f(v * 100, 1) + '%').join('、')}）`); }
  out(ok3, 'W8b-C3 缓慢、雨最久：每 1 s 采样 6 小时，强度变化率 ≤ 1/40 每秒，雨（冰盖为雪）占比 ≥ 50% 且最大', [`12 个地点；最大变化率 ${f(maxRate, 4)} /s（渐变 48 s，上限 0.025）；每个时段 300 s，同一状态平均停留数分钟`, ...L3]);
}
// ---- C4
{
  const r = await p1.evaluate(() => {
    const S = window.__scene, Wx = S.weather, W = window.WORLD, out = [];
    const base = { h: S.scene.children.find(o => o.isHemisphereLight).intensity, m: S.scene.children.find(o => o.isDirectionalLight).intensity, fog: S.scene.fog.density };
    const town = W.townToLonLat(0, 0); let foggy = null; for (let lon = -180; lon < 180 && !foggy; lon += 0.7) for (let lat = -60; lat < 60 && !foggy; lat += 0.7) if (Wx.place(lon, lat).cat === 'foggy') foggy = { lon, lat };
    for (const st of ['overcast', 'fog', 'clear']) for (const h of [40, 80, 120]) {
      const ll = st === 'fog' ? foggy : town; Wx.lock(st); Wx.setView({ lonLat: ll, h, target: [0, 1.2, 0] }); window.__step(2);
      const hemi = S.scene.children.find(o => o.isHemisphereLight).intensity, moon = S.scene.children.find(o => o.isDirectionalLight).intensity, g = Wx.get();
      out.push({ st, h, wl: g.wLocal, hemiK: hemi / base.h, moonK: moon / base.m, fogAdd: S.scene.fog.density - base.fog });
    }
    Wx.lock(null); Wx.setView(null); window.__step(2); return { out, base };
  });
  const MULT = { overcast: [0.75, 0.55, 0], fog: [0.9, 0.8, 0.03], clear: [1.1, 1.25, 0] }; let ok = true; const L = [];
  for (const q of r.out) { const wl = 1 - (x => { const t = Math.max(0, Math.min(1, (x - 40) / 80)); return t * t * (3 - 2 * t); })(q.h), m = MULT[q.st], eh = 1 + (m[0] - 1) * wl, em = 1 + (m[1] - 1) * wl, ef = m[2] * wl;
    const good = Math.abs(q.wl - wl) <= 0.02 && Math.abs(q.hemiK - eh) <= 0.02 && Math.abs(q.moonK - em) <= 0.02 && Math.abs(q.fogAdd - ef) <= 0.002; if (!good) ok = false;
    L.push(`${q.st}${q.st === 'fog' ? '（森林/岸线地点）' : '（城镇）'} h = ${q.h}：w_local ${f(q.wl)}（应为 ${f(wl)}），天光 ×${f(q.hemiK, 3)}（${f(eh, 3)}），月光 ×${f(q.moonK, 3)}（${f(em, 3)}），雾 +${f(q.fogAdd, 4)}（${f(ef, 4)}）`); }
  // h >= 120: every state renders the same picture (flat map since W8e-a, camera 274 m above the town; the sphere is always clear since W8e-c: tools/day_check.mjs)
  const pp = await open(640, 400); await pp.evaluate(() => { const S = window.__scene; S.view.set({ dist: 350, pitch: 0.9 }); S.transition.pending = true; window.__step(30); });
  const urls = {}; for (const st of ['rain', 'after', 'overcast', 'clear', 'snow', 'fog']) { await pp.evaluate(s => { const Wx = window.__scene.weather, g = Wx.get(); Wx.lock(s); Wx.tick(g.time, 0, { lonLat: { lon: g.lon, lat: g.lat }, h: g.h, target: [0, 1.2, 0] }); }, st); urls[st] = await shot(pp); }
  const hView = await pp.evaluate(() => window.__scene.weather.get().h);
  const L2 = ['同一帧、只换天气后重新应用（时钟不前进）']; for (const st of ['after', 'overcast', 'clear', 'snow', 'fog']) { const d = await diff(pp, urls.rain, urls[st]); if (d.n) ok = false; L2.push(`${st} 对雨：差异像素 ${d.n}`); }
  await pp.close();
  out(ok, 'W8b-C4 距离淡出：w_local(h) 混合（容差 0.02），h ≥ 120 m 时任何天气画面逐位相同', [...L, `全景（d = 350，相机离地 ${f(hView, 0)} m）：${L2.join('；')}`]);
}
// ---- shots
if (args.includes('--shots')) {
  const dir = path.join(root, 'docs', 'world', 'w8'); fs.mkdirSync(dir, { recursive: true });
  const ps = await open(1280, 800), L = [];
  const town = async (st, name, v = { dist: 22, pitch: 0.32, yaw: 2.2, target: [-7, 1.2, 20] }) => { await ps.evaluate(([st, v]) => { const S = window.__scene; S.weather.lock(st); S.view.set(v); window.__step(90); }, [st, v]); fs.writeFileSync(path.join(dir, `st05-${name}.png`), Buffer.from((await shot(ps)).split(',')[1], 'base64')); L.push(`st05-${name}.png`); };
  for (const st of ['rain', 'after', 'overcast', 'clear']) await town(st, st);
  // distance blend: overcast at increasing distance (camera height about 13, 36, 66, 90 m): the darkening fades out with the height
  for (const d of [22, 60, 110, 150]) await town('overcast', `distance-${d}`, { dist: d, pitch: 0.65, yaw: 2.2, target: [-7, 1.2, 20] });
  // fog: the town never fogs (it falls back to after-rain); a forest place near LM04 (uBend = 1, section mode), camera low
  await ps.evaluate(() => { const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === 'LM04'); let best = null; for (let a = 0; a < 360 && !best; a += 15) for (const r of [22, 28, 34]) { const p = W.destination(lm, a, r); if (S.weather.place(p.lon, p.lat).cat === 'foggy') { best = p; break; } }
    const q = W.lonLatToTown(best.lon, best.lat); S.bend.set(1); S.section.setMode(true); S.section.ensure(); S.landmarks.build(); S.weather.lock('fog'); S.view.set({ target: [q.x, 1.2, q.z], dist: 18, pitch: 0.3, yaw: 0.6 }); window.__step(120); });
  fs.writeFileSync(path.join(dir, 'st05-fog-forest.png'), Buffer.from((await shot(ps)).split(',')[1], 'base64')); L.push('st05-fog-forest.png');
  await ps.evaluate(() => { const S = window.__scene; S.weather.lock('rain'); window.__step(2); S.weather.lock('fog'); });
  await ps.evaluate(() => { const S = window.__scene; S.weather.lock('rain'); window.__step(120); });
  fs.writeFileSync(path.join(dir, 'st05-rain-forest.png'), Buffer.from((await shot(ps)).split(',')[1], 'base64')); L.push('st05-rain-forest.png（同一机位、雨，对照）');
  // snow: the ice-edge hut of LM07 (uBend = 1, section mode so the far world is built), camera close to the ground
  await ps.evaluate(() => { const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === 'LM07'), q = W.lonLatToTown(lm.lon, lm.lat); S.bend.set(1); S.section.setMode(true); S.section.ensure(); S.landmarks.build(); S.weather.lock('snow'); S.view.set({ target: [q.x, 1.2, q.z], dist: 16, pitch: 0.28, yaw: 1.2 }); window.__step(120); });
  fs.writeFileSync(path.join(dir, 'st05-snow-lm07.png'), Buffer.from((await shot(ps)).split(',')[1], 'base64')); L.push('st05-snow-lm07.png');
  await ps.evaluate(() => { const S = window.__scene; S.section.setMode(false); S.weather.lock('clear'); S.view.set({ target: [0, 1.2, 0], dist: 350, pitch: 0.9, yaw: 2.5 }); S.transition.pending = true; window.__step(60); });
  fs.writeFileSync(path.join(dir, 'st05-panorama-clear.png'), Buffer.from((await shot(ps)).split(',')[1], 'base64')); L.push('st05-panorama-clear.png');
  await ps.close(); out(true, 'W8b 截图（docs/world/w8/st05-*.png）', [L.join('、')]);
}
await p1.close();
if (errors.length) { console.log('page errors:', errors.slice(0, 5).join(' | ')); fails.push('page errors'); }
await browser.close();
console.log(fails.length ? `FAIL weather_check：${fails.join('；')}` : `PASS weather_check（${results.length} 项）`);
process.exitCode = fails.length ? 1 : 0;
