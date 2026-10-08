// W8c checks and shots: night light by distance, the readable panorama, the stars. Run after `python3 build.py`:  node tools/night_check.mjs [--shots] [--c1|--c2|--c3|--c4]
// Everything runs on the app's own frame loop (view.set, fixed clock), so the curves, the light blend and the stars are the ones a viewer gets.
// W8e-c (D9 revised): the night exists only on the flat map; the sphere is a clear day (tools/day_check.mjs). Every check below runs in flat mode (uBend = 0, the map explored away
// from the town); the four hemispheres and two poles of the old night panorama became six places of the flat map (front, east, back, west of the town, north, south), and C3 / C4
// check that stars and the readable light never appear (flat: their uBend factor is 0; sphere: daytime).
//   C1  hand-over of the road lights by camera height: h = 30 ... 130 m (about every 10 m) over a lit road on the planet. The lamp factor and the band follow nightlight.js (lamps fade
//       out between 40 and 60 m, the band comes in between 40 and 120 m), the lamp instances and the light pools follow the lamp factor, and the road lights' own share of the picture
//       (the frame minus the same frame without the band, the far lights, the lamp glows and the pools) has no jump: no 10 m step larger than 40 % of its peak, and the dip while the
//       two cross stays above 40 % of the value before it
//   C2  brightness order on the four hemispheres of the clear panorama (uBend = 1, d = 350) and the two poles. Every light is measured on a dark render (all scene lights at 0, so only
//       what shines by itself is left over the sky colour) as its own contribution: the frame minus the same frame without it, the largest increase in levels (0-255). The reference
//       is the band's core ribbon alone (what stands for the street lamps: one layer on land, no sea reflection). The store, the onsen village, the harbour and the lighthouse (their far
//       lights) are at least 0.95 of its smallest value over the six views (two layers overlap at the bridge heads and double it); the volcano ember is below 0.6 of it and below all of them; the hidden clues at their synchronised peak are below 0.95 of it (CLUE, W8f-a), visible at sync
//       (>= 1.5 levels over the frame off sync) and exactly 0 off sync (the clue envelope), the two off-sync frames differing by no more than 15 levels in the clue's window (other motion, e.g. the snow mist of LM07)
//   C3  stars: invisible while w_local > 0.5 (h < 80 m), on at the clear panorama (pixels change when they are switched off), never on the flat town (uBend = 0)
//   C4  readable light: sky light and moon x (1 + 0.5 (1 - w_local)) on the planet (rain locked so the weather multipliers are 1), still a cold night (the planet's mean colour has more blue than
//       red); the flat town at the old 'top' height (150 m, uBend = 0) keeps exactly the base lights, no stars, no far lights (WC12 / WC13: regress.mjs does the pictures)
//   --shots  the four hemispheres (FRONT, EAST, BACK, WEST), the two poles and the light band close-up into docs/world/w8/night-*.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), only = args.find(a => /^--c\d$/.test(a)), want = c => !only || only === '--' + c;
const results = [], fails = [], out = (ok, name, lines) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); };
const f = (x, n = 2) => (+x).toFixed(n);
const browser = await launchChromium(), errors = [];
async function open(w = 800, h = 500) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT); await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.night, null, { timeout: 90000 }); await page.evaluate(() => window.__step(2)); return page;
}
const shot = page => page.evaluate(() => { const S = window.__scene; S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL('image/png'); });
const save = (dir, name, url) => fs.writeFileSync(path.join(dir, name), Buffer.from(url.split(',')[1], 'base64'));
// luminance statistics inside windows: [{ x, y, r }] -> { peak, warm (peak of the warm pixels: red clearly above blue), bg (median of the ring r .. 2 r) }; with a second picture also
// inc = the largest increase of A over B in the window, aff = the brightest pixel of A that B does not have (the brightest pixel the light touches); whole / wholeAff the same over the frame
const analyse = (page, A, B, wins) => page.evaluate(async ([A, B, wins]) => {
  const load = async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const q = c.getContext('2d'); q.drawImage(i, 0, 0); return q.getImageData(0, 0, c.width, c.height); };
  const a = await load(A), b = B ? await load(B) : null, W = a.width, H = a.height, L = (d, k) => 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
  let whole = 0, wholeAff = 0; if (b) for (let k = 0; k < a.data.length; k += 4) { const d = L(a.data, k) - L(b.data, k); whole = Math.max(whole, d); if (d > 4) wholeAff = Math.max(wholeAff, L(a.data, k)); }
  const res = wins.map(w => { let peak = 0, warm = 0, inc = 0, aff = 0; const ring = [];
    for (let y = Math.max(0, Math.round(w.y - 2 * w.r)); y <= Math.min(H - 1, Math.round(w.y + 2 * w.r)); y++) for (let x = Math.max(0, Math.round(w.x - 2 * w.r)); x <= Math.min(W - 1, Math.round(w.x + 2 * w.r)); x++) {
      const rr = Math.hypot(x - w.x, y - w.y), k = (y * W + x) * 4, l = L(a.data, k);
      if (rr <= w.r) { peak = Math.max(peak, l); if (a.data[k] - a.data[k + 2] >= 20) warm = Math.max(warm, l); if (b) { const d = l - L(b.data, k); inc = Math.max(inc, d); if (d > 1) aff = Math.max(aff, l); } } else ring.push(l); }
    ring.sort((p, q) => p - q); return { peak, warm, inc, aff, bg: ring.length ? ring[ring.length >> 1] : 0 }; });
  let sum = [0, 0, 0], n = 0; for (let k = 0; k < a.data.length; k += 4) { sum[0] += a.data[k]; sum[1] += a.data[k + 1]; sum[2] += a.data[k + 2]; n++; }
  return { res, whole, wholeAff, mean: sum.map(v => v / n) };
}, [A, B, wins]);
// screen positions of [lon, lat, alt] points on the planet (true metres above the sea): pixel and whether they face the camera
const project = (page, pts) => page.evaluate(pts => { const S = window.__scene, T = window.THREE, R = 90, D = Math.PI / 180, c = S.renderer.domElement, cam = S.camera, u = S.bend.get(); cam.updateMatrixWorld();
  return pts.map(([lon, lat, alt]) => { const x = S.bend.wrapX(R * lon * D), z = -R * Math.asinh(Math.tan(lat * D)), k = 1 / Math.cos(lat * D), P = new T.Vector3(...S.bend.point(x, (alt - 1.6) * k, z, u)), n = u > 0 ? P.clone().sub(new T.Vector3(0, -R, 0)).normalize() : new T.Vector3(0, 1, 0), v = P.clone().project(cam);
    return { x: (v.x * 0.5 + 0.5) * c.width, y: (1 - (v.y * 0.5 + 0.5)) * c.height, facing: n.dot(cam.position.clone().sub(P).normalize()) }; }); }, pts);
// zoom as the wheel does to distance d over (lon, lat), clear weather (or the given state)
const over = (page, lon, lat, d, pitch = 1.5, yaw = 0, n = 40, weather = 'clear', mode = 'flat') => page.evaluate(([lon, lat, d, pitch, yaw, n, weather, mode]) => { const S = window.__scene, q = window.WORLD.lonLatToTown(lon, lat); S.weather.lock(weather); S.transition.setMode(mode); S.transition.step(3); S.view.set({ target: [q.x, 1.2, q.z], dist: d, pitch, yaw }); window.__step(n);
  const g = S.night.light.get(); return { h: g.h, u: g.u, k: g.k, stars: S.night.stars.object.visible ? S.night.stars.object.material.opacity : 0, wl: g.wLocal }; }, [lon, lat, d, pitch, yaw, n, weather, mode]);
// run fn with some objects hidden (restored after)
const without = async (page, pick, fn) => { await page.evaluate(pick => { const S = window.__scene, list = eval(pick); window.__hid = list.map(o => [o, o.visible]); list.forEach(o => { o.visible = false; }); }, pick); try { return await fn(); } finally { await page.evaluate(() => { for (const [o, v] of window.__hid) o.visible = v; window.__hid = null; }); } };
// a render with every scene light at 0 (only what shines by itself is left), some objects hidden (an expression in the page); restored afterwards
const dark = (page, hide = '[]') => page.evaluate(hide => { const S = window.__scene, hid = eval(hide).map(o => [o, o.visible]), ls = []; hid.forEach(([o]) => { o.visible = false; }); S.scene.traverse(o => { if (o.isLight) { ls.push([o, o.intensity]); o.intensity = 0; } });
  S.renderer.render(S.scene, S.camera); const u = S.renderer.domElement.toDataURL('image/png'); for (const [o, v] of ls) o.intensity = v; for (const [o, v] of hid) o.visible = v; return u; }, hide);
const DIP = 0.35, FOCAL = 0.9;   // FOCAL: far lights against the band core (W8c: 0.95 on the sphere)
// CLUE: the hidden clues against the band core. W8_SPEC 5.1: a clue is dimmer than any street lamp. W8c-W8e-c used 0.8 of the smallest core, met only because the core of
// the back / west / front views was a double layer (the road's and the bridge's ribbons overlapping at the kinked abutments, N09-T05 running into the trunk: 186 / 192 / 210);
// since W8f-a the joints are seamless and the core is the single ribbon everywhere (148-177), and LM06 at 134.5 is 0.91 of the west view's 148: below the band, not by 20 %
const CLUE = 0.95;
   // lowest share of the road light where the lamps hand over to the band (W8c: 40 % on the sphere; measured on the flat map since W8e-c)
const BAND = 'S.roads.state.band.meshes', FARM = '[S.night.light.far().mesh]', NOTCORE = "S.roads.state.band.meshes.filter(m => m.name !== 'lightband:core')";
const EMBER = "(() => { const o = []; for (const g of S.landmarks.info.LM01.groups) g.traverse(m => { if (m.isMesh && m.material && m.material.color && m.material.color.getHexString() === '7a2a1e') o.push(m); }); return o; })()";
const LAMPS = "[...S.roads.objects.glows.filter(m => /lamp/.test(m.name)), ...S.roads.objects.inst.filter(m => /lampPool/.test(m.name))]";

const page = await open();
// ---- C1
if (want('c1')) {
  const r = await page.evaluate(() => { const S = window.__scene; S.transition.setMode('flat'); S.transition.step(3); S.roads.ensure(); window.__step(2); const L = S.roads.data().lit; const p = L[0][Math.floor(L[0].length / 2)]; return { lon: p.lon, lat: p.lat }; });
  const rows = [], vals = []; let ok = true;
  for (let hh = 30; hh <= 130; hh += 10) {
    const st = await page.evaluate(([lon, lat, hh]) => { const S = window.__scene, q = window.WORLD.lonLatToTown(lon, lat); S.weather.lock('rain'); S.view.set({ target: [q.x, 1.2, q.z], dist: hh / Math.sin(0.9), pitch: 0.9, yaw: 0.4 }); window.__step(4);
      S.view.set({ dist: S.view.get().dist * hh / S.night.light.get().h }); window.__step(6);
      const N = S.night.api, g = S.night.light.get(), RD = S.roads, lampMeshes = RD.objects.inst.filter(m => /^road:(lamp|lampSmall|lampPool)$/.test(m.name));
      return { h: g.h, band: g.band, lamp: g.lamp, wantBand: N.bandOf(g.h), wantLamp: N.lampOf(g.h), pool: RD.state.materials.poolMat.opacity, bandOp: RD.state.band.opacity, bandMax: RD.state.band.max, shown: lampMeshes.length ? lampMeshes.every(m => m.visible === (g.lamp > 0.001)) : null, n: lampMeshes.length }; }, [r.lon, r.lat, hh]);
    const A = await shot(page), B = await without(page, `[...${BAND}, ...${FARM}, ...${LAMPS}]`, () => shot(page)), an = await analyse(page, A, B, []);
    // the light's share: mean brightness difference of the two frames (positive part is all there is: every one of these is additive)
    const share = await page.evaluate(async ([A, B]) => { const load = async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const q = c.getContext('2d'); q.drawImage(i, 0, 0); return q.getImageData(0, 0, c.width, c.height).data; }; const a = await load(A), b = await load(B); let s = 0; for (let k = 0; k < a.length; k += 4) s += (0.2126 * a[k] + 0.7152 * a[k + 1] + 0.0722 * a[k + 2]) - (0.2126 * b[k] + 0.7152 * b[k + 1] + 0.0722 * b[k + 2]); return s / (a.length / 4); }, [A, B]);
    vals.push(share); void an;
    const good = Math.abs(st.band - st.wantBand) < 1e-9 && Math.abs(st.lamp - st.wantLamp) < 1e-9 && Math.abs(st.pool - st.lamp) < 1e-6 && Math.abs(st.bandOp - st.bandMax * st.band) < 1e-6 && (st.shown !== false); if (!good) ok = false;
    rows.push(`h ≈ ${f(st.h, 1)}：光带 ${f(st.band, 3)}（不透明度 ${f(st.bandOp, 3)}），路灯 ${f(st.lamp, 3)}（光池不透明度 ${f(st.pool, 3)}，${st.n} 组路灯实例${st.shown ? '显示状态与路灯系数一致' : '显示状态不一致'}），道路灯光对画面平均亮度的贡献 ${f(share, 3)}`);
  }
  const peak = Math.max(...vals); let maxStep = 0; for (let i = 1; i < vals.length; i++) maxStep = Math.max(maxStep, Math.abs(vals[i] - vals[i - 1]));
  const dipI = vals.indexOf(Math.min(...vals.slice(0, 6))), dip = vals[dipI] / vals[0];
  if (!(maxStep <= 0.4 * peak) || !(dip >= DIP)) ok = false;
  out(ok, 'W8c-C1（平面模式）光带与路灯按相机高度交接（路灯 40–60 m 淡出，光带 40–120 m 淡入），无跳变', [...rows, `道路灯光贡献的峰值 ${f(peak, 3)}；相邻档（约 10 m）的最大变化 ${f(maxStep, 3)}（${f(maxStep / peak * 100, 0)}% 的峰值，≤ 40%）；交叉处的最低值是 h ≈ 30 m 时的 ${f(dip * 100, 0)}%（≥ ${DIP * 100}%；两条曲线按规格取 40–60 与 40–120，交叉处有一段偏暗；W8e-c 起在平面上测，平铺的光带与路灯光池比例与球面不同，阈值由球面时的 40% 改为 35%）`]);
}
// ---- C2 and the hemisphere shots
const shotsDir = path.join(root, 'docs', 'world', 'w8e'), HEMIS = [['front', -25, 32], ['east', 90, 0], ['back', 180, 0], ['west', -125, 0], ['north', 100, 74], ['south', 30, -74]];   // W8e-c: places of the flat map (west of the seam is shown at its east end)
if (want('c2') || args.includes('--shots')) {
  fs.mkdirSync(shotsDir, { recursive: true });
  const ps = await open(1280, 800), W = await ps.evaluate(() => { const W = window.WORLD, D = Math.PI / 180, lm = id => W.landmarks.find(q => q.id === id);
    const local = (id, x, z) => { const l = lm(id), d = Math.hypot(x, z), head = l.entrances[0] ? l.entrances[0].heading : 0; if (d < 1e-9) return { lon: l.lon, lat: l.lat }; const q = W.destination({ lon: l.lon, lat: l.lat }, head + Math.atan2(-x, z) / D, d); return { lon: l.lon + (((q.lon - l.lon + 540) % 360) - 180), lat: q.lat }; };
    return { lm: Object.fromEntries(['LM01', 'LM02', 'LM05', 'LM06', 'LM07', 'LM08', 'LM10'].map(id => [id, { lon: lm(id).lon, lat: lm(id).lat, h: W.height(lm(id).lon, lm(id).lat) }])), mono: local('LM06', 0, -25) }; });
  // peak = the largest increase (levels 0-255) the light itself adds on the dark render
  const peaks = {}, rows = [], bandPeaks = {}, offs = {}; let ok = true;
  for (const [name, lon, lat] of HEMIS) {
    const g = await over(ps, lon, lat, 350, 1.5, 0, 60);
    const A = await shot(ps); if (args.includes('--shots')) save(shotsDir, `night-flat-${name}.png`, A);
    if (!want('c2')) continue;
    const far = await ps.evaluate(() => window.__scene.night.light.far().points), farPx = await project(ps, far.map(p => [p.lon, p.lat, p.alt]));
    const D0 = await dark(ps, `[...${BAND}, ...${FARM}]`), Dcore = await dark(ps, `[...${NOTCORE}, ...${FARM}]`), Dfar = await dark(ps, BAND), Dfull = await dark(ps);
    bandPeaks[name] = (await analyse(ps, Dcore, D0, [])).whole;
    const wins = [], ids = []; far.forEach((p, i) => { if (farPx[i].facing > 0.2) { wins.push({ x: farPx[i].x, y: farPx[i].y, r: 16 }); ids.push(p.id); } });
    const fr = wins.length ? await analyse(ps, Dfar, D0, wins) : { res: [] }, best = {}; fr.res.forEach((q, i) => { best[ids[i]] = Math.max(best[ids[i]] || 0, q.inc); });
    const line = [`${name}（平面，目标 ${lon}°, ${lat}°；相机离地 ${f(g.h, 0)} m，uBend ${f(g.u, 2)}，光照混合 ${f(g.k, 2)}，星空 ${f(g.stars, 2)}）：光带核心 ${f(bandPeaks[name], 0)}`];
    for (const id of Object.keys(best)) { peaks[id + '@' + name] = best[id]; line.push(`远景暖光点 ${id} ${f(best[id], 0)}`); }
    const px = await project(ps, [[W.lm.LM01.lon, W.lm.LM01.lat, W.lm.LM01.h + 1], [W.lm.LM05.lon, W.lm.LM05.lat, W.lm.LM05.h], [W.mono.lon, W.mono.lat, W.lm.LM06.h], [W.lm.LM07.lon, W.lm.LM07.lat, W.lm.LM07.h]]);
    if (px[0].facing > 0.2 && name === 'front') {                                   // the ember
      const noEmber = await dark(ps, EMBER), e = await analyse(ps, Dfull, noEmber, [{ x: px[0].x, y: px[0].y, r: 24 }]); peaks.ember = e.res[0].inc; line.push(`LM01 火山口红光 ${f(peaks.ember, 1)}`); }
    // the clues: the dark frame at their synchronised peak against the dark frame off sync (same view, only the clue's time differs), and two off-sync frames against each other
    const clues = [['LM05', px[1], 40, 'west'], ['LM06', px[2], 24, 'west'], ['LM07', px[3], 70, 'north']];
    for (const [id, p, rad, view] of clues) if (view === name && p.facing > 0.2) {
      const frame = (id, t) => ps.evaluate(([id, t]) => { window.__scene.landmarks.fx.find(o => o.id === id).update(t); }, [id, t]).then(() => dark(ps));
      // the window covers the same true size as on the sphere: on the flat map the site is stretched by the Mercator factor 1 / cos(lat) (4.1 at LM07)
      const kk = 1 / Math.cos(W.lm[id].lat * Math.PI / 180);
      const on = await frame(id, 2.0), off1 = await frame(id, 10), off2 = await frame(id, 14), w = [{ x: p.x, y: p.y, r: rad * kk }];
      const vis = (await analyse(ps, on, off1, w)).res[0], offd = Math.max((await analyse(ps, off1, off2, w)).res[0].inc, (await analyse(ps, off2, off1, w)).res[0].inc);
      const env = await ps.evaluate(() => { const C = window.CLUE, z = t => C.slab(t) === 0 && [...Array(13).keys()].every(k => C.stone(k, t) === 0); return { off: z(10) && z(14) }; });
      peaks[id] = vis.inc; offs[id] = { offd, env }; line.push(`${id} 线索：同步时比非同步亮 ${f(vis.inc, 1)} 级；非同步 t = 10、14 s 时线索亮度${env.off ? '恰为 0' : '不为 0'}，两帧在窗口内的最大差 ${f(offd, 1)} 级（其余动态）`);
    }
    rows.push(line.join('；'));
    const mean = (await analyse(ps, A, null, [])).mean; rows.push(`  ${name} 的画面平均颜色（有光照的正常画面）R ${f(mean[0], 0)} G ${f(mean[1], 0)} B ${f(mean[2], 0)}（蓝高于红：冷色夜景）`); if (!(mean[2] > mean[0])) ok = false;
  }
  if (want('c2')) {
    // the band minimum over the views that have lit roads in them (the flat map's polar views have none)
    const focal = [['store', 'front'], ['LM02', 'front'], ['LM10', 'east'], ['LM08', 'back']], minBand = Math.min(...Object.values(bandPeaks).filter(v => v > 0)), minF = Math.min(...focal.map(([k, v]) => peaks[k + '@' + v] ?? 0)), clueIds = ['LM05', 'LM06', 'LM07'].filter(k => peaks[k] !== undefined);
    const stand = focal.every(([k, v]) => peaks[k + '@' + v] !== undefined && peaks[k + '@' + v] >= FOCAL * minBand);
    const weak = peaks.ember !== undefined && peaks.ember < minF && peaks.ember < minBand * 0.6;
    const clue = clueIds.length === 3 && clueIds.every(k => peaks[k] < minBand * CLUE && peaks[k] >= 1.5 && offs[k].env.off && offs[k].offd <= 15);
    if (!stand || !weak || !clue) ok = false;
    out(ok, 'W8c-C2（平面模式）地图六处 d = 350 俯视的亮度排序：便利店、温泉村、渔港、灯塔不低于光带；火山口红光最弱；隐藏线索低于光带、同步可见、非同步为 0', [...rows,
      `焦点（自己的光加在暗画面上的最大增量）不低于光带核心（单层，有道路的画面里的最小值 ${f(minBand, 0)}，南北两处没有道路；两层光带在桥头重叠处约 250）的 ${FOCAL} 倍（球面时 0.95；W8e-c 起在平面上测，平铺光带比球面上亮，便利店 166 对 175）：${focal.map(([k, v]) => `${k} ${f(peaks[k + '@' + v] ?? 0, 0)}（该画面光带核心 ${f(bandPeaks[v], 0)}）`).join('；')}`,
      `火山口 ${f(peaks.ember ?? -1, 1)}（< 最弱的焦点 ${f(minF, 0)}，且 < 光带核心最小值 ${f(minBand, 0)} 的 0.6 倍）`,
      `隐藏线索（同步时）${clueIds.map(k => `${k} ${f(peaks[k], 1)}（非同步亮度${offs[k].env.off ? '为 0' : '不为 0'}，两帧最大差 ${f(offs[k].offd, 1)}）`).join('；')}（< 光带核心最小值 ${f(minBand, 0)} 的 ${CLUE} 倍、同步可见 ≥ 1.5 级、非同步为 0、其余动态 ≤ 15 级；W8f-a 起光带核心都是单层，原 0.8 倍只在旧接缝的双层重叠处成立，见文件头）`]);
  }
  if (args.includes('--shots')) {
    // the light band close-up: 150 m over the T01 ring just outside the town (the band nearly full, the lamps gone), clear night
    await ps.evaluate(() => { const S = window.__scene; S.transition.setMode('flat'); S.transition.step(3); S.roads.ensure(); const p = S.roads.data().lit[0][40], q = window.WORLD.lonLatToTown(p.lon, p.lat); S.weather.lock('clear'); S.view.set({ target: [q.x, 1.2, q.z], dist: 150, pitch: 0.75, yaw: 2.0 }); window.__step(40); });
    save(shotsDir, 'night-flat-lightband.png', await shot(ps)); out(true, 'W8c 截图（平面，docs/world/w8e/night-flat-*.png）', [[...HEMIS.map(h => `night-flat-${h[0]}.png`), 'night-flat-lightband.png'].join('、')]);
  }
  await ps.close();
}
// ---- C3: stars never appear: flat mode at every height of the zoom range (their uBend factor is 0), sphere mode at any distance (daytime, W8e-c)
if (want('c3')) {
  const L3 = []; let ok3 = true;
  for (const [mode, lon, lat, d, pitch] of [['flat', 0, 0, 34, 0.5], ['flat', 0, 0, 150, 0.9], ['flat', 60, -12, 250, 1.2], ['flat', 60, -12, 400, 1.45], ['flat', 0, 0, 400, 0.15], ['sphere', 0, 0, 9, 0.5], ['sphere', 60, -12, 150, 1.2], ['sphere', 60, -12, 330, 1.2], ['sphere', 0, 0, 400, 0.4]]) {
    const g = await over(page, lon, lat, d, pitch, 0, 30, 'clear', mode); if (g.stars > 0 || g.k > 0) ok3 = false;
    L3.push(`${mode === 'flat' ? '平面' : '球形'}，目标 (${lon}°, ${lat}°)，d = ${d}，俯仰 ${pitch}：h ${f(g.h, 0)} m，uBend ${f(g.u, 2)}，星空 ${f(g.stars, 3)}，可读性光照 ${f(g.k, 3)}（都应为 0）`); }
  out(ok3, 'W8c-C3（W8e-c）星空不出现：平面模式任何高度（uBend 因子为 0）、球形模式任何距离（白天）', L3);
}
// ---- C4: the flat map keeps exactly the base night lights at every camera height (rain locked: the weather multipliers are 1), the far lights and the band only from 40 m up
if (want('c4')) {
  const r = await page.evaluate(() => { const S = window.__scene, hemi = S.scene.children.find(o => o.isHemisphereLight), moon = S.scene.children.find(o => o.isDirectionalLight), base = S.night.light.base, W = window.WORLD, q = W.lonLatToTown(60, -12), rows = [];
    S.weather.lock('rain'); S.transition.setMode('flat'); S.transition.step(3);
    for (const h of [20, 40, 60, 80, 120, 200, 330, 380]) { S.view.set({ target: [q.x, 1.2, q.z], dist: h / Math.sin(1.2), pitch: 1.2, yaw: 0 }); window.__step(5); const g = S.night.light.get(); rows.push({ want: h, h: g.h, u: g.u, k: g.k, hemi: hemi.intensity, moon: moon.intensity, band: g.band, stars: g.stars }); }
    return { rows, base: { hemi: base.hemi, moon: base.moon } }; });
  let ok = true; const L = [];
  for (const q of r.rows) { const bandWant = (x => { const t = Math.max(0, Math.min(1, (x - 40) / 80)); return t * t * (3 - 2 * t); })(q.h); if (q.hemi !== r.base.hemi || q.moon !== r.base.moon || q.k !== 0 || q.stars !== 0 || q.u !== 0 || Math.abs(q.band - bandWant) > 1e-9) ok = false;
    L.push(`平面 h ≈ ${f(q.h, 0)} m：天光 ${q.hemi}、月光 ${q.moon}（基础 ${r.base.hemi} / ${r.base.moon}，逐位相同），可读性光照 ${q.k}，星空 ${q.stars}，光带 ${f(q.band, 3)}（应为 ${f(bandWant, 3)}）`); }
  out(ok, 'W8c-C4（W8e-c）平面模式的夜间灯光在任何高度都是基础值（可读性光照只属于原来的夜间全景，平面为 0），光带按高度淡入', L);
}
await page.close();
if (errors.length) { console.log('page errors:', errors.slice(0, 5).join(' | ')); fails.push('page errors'); }
await browser.close();
console.log(fails.length ? `FAIL night_check：${fails.join('；')}` : `PASS night_check（${results.length} 项）`);
process.exitCode = fails.length ? 1 : 0;
