// WX2 checks (docs/world/WEATHER_COMPLETION_PLAN.md 5.5): the weather drives the page where each effect is. Run after `python3 build.py`:
//   node tools/weather_integration_check.mjs [--report] [--only I4,I8]       (--report writes docs/world/weather/wx2/report.json; no images; --only runs the named checks)
//   I1  six locked states x the landforms that allow them: rain lines, snow, rain impacts (surface map, road rings, pond rings), drips and mist follow the field at
//       their own place (ice never rain lines, the town never snow, a mountain's sleet band shows both)
//   I2  lock clear: no impacts on the sea, the paddies, the roads, the ponds; after-rain: no rain lines, no impacts, wet ground and drips go on
//   I3  two places, two weathers at the same moment (the desert edge at t = 100: rain beside clear): the map, the rain drops and the road rings follow each place
//   I4  heights: rain and snow end on the receiving surface (high ground, a slope, a bridge deck, the sea, LM04's hall roof, LM07's ice): no drop under it, rays from
//       above meet nothing between a drop's floor and the drop; the old culling spots [-72, 1.2, -12], [150, 1.2, 40] submit the rain when it rains
//   I5  the sphere: d = 9 / 40 / 140 / 400, six states: every weather effect 0 and not drawn, the permanent ice and the sea stay; the switch at u = 0 ... 1 applies
//       (1 - u) once
//   I6  no drift: lock rain -> clear -> fog -> rain and flat -> sphere -> flat give back the exact lights, fog and colours; a repeated visit gives the same weather
//   I7  panning over the whole map: the caches stay bounded, the particle counts fixed, the low tier keeps the rules and sizes, no page errors; tick + apply cost
//   I8  WX-0 (clear weather and rain lines): rain -> clear at the town, an old repro spot, a forest, a coast and the ice edge at d = 9 / 40 / 140 / 400, a cold start
//       in natural clear weather, after-rain -> clear, unlock, flat <-> sphere, the old rain switch: at the final render no precipitation object is drawn; the
//       same frame with every registered precipitation object hidden is identical, pixel for pixel
//   I9  a natural rain -> clear fade: the weights and the time left are reported, the rain lines thin with the rain weight and are 0 at the end
//   R   the registry: every animated building line in the drip colours and every additive ring (but the chozu spouts) is registered; the landmarks' tags
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null, want = k => !only || only.includes(k);
const fails = [], report = {}, out = (ok, name, lines, data) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); report[name.split(' ')[0]] = { ok, lines, data }; };
const f = (x, n = 2) => (x === null || x === undefined ? '—' : (+x).toFixed(n));
const browser = await launchChromium(), errors = [];
async function open(w = 800, h = 500, query = '') {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => { window.__perfNow = performance.now.bind(performance); });    // the real clock, before INIT drives performance.now by frames
  await page.addInitScript(INIT); await page.goto(pathToFileURL(path.join(root, 'index.html')).href + query, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__scene && window.__scene.weather, null, { timeout: 120000 });
  await page.evaluate(HELPERS); await page.evaluate(() => window.__step(3)); return page;
}
// page helpers: places, a view setter, the drawn-object counter of one render, the pixel diff of two renders
const HELPERS = () => {
  const S = window.__scene, Wx = S.weather, W = window.WORLD, D = Math.PI / 180;
  // a deterministic scattered scan (not row by row, which would always find the first match by the south ice); `inside` keeps the place 3 m clear of hard region edges
  const find = (test, n = 60000, pre = null) => { let s = 917; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; for (let i = 0; i < n; i++) { const lon = -180 + rnd() * 360, lat = -76 + rnd() * 152; if (pre && !pre(lon, lat)) continue; const p = Wx.place(lon, lat); if (test(p, lon, lat)) return { lon, lat }; } return null; };
  const inside = (p, lon, lat) => [0, 90, 180, 270].every(b => { const q = W.destination({ lon, lat }, b, 3); return Wx.place(q.lon, q.lat).cat === p.cat; });
  const P = {};
  P.town = { lon: 0, lat: 0, xz: [-7, 20] };
  P.repro1 = { xz: [-72, -12] }; P.repro2 = { xz: [150, 40] };
  P.forest = find((p, lon, lat) => p.kind === 'forest' && p.fog === 1 && inside(p, lon, lat));
  P.coast = find((p, lon, lat) => p.cat === 'foggy' && p.kind !== 'forest' && p.fog === 1 && W.coastDistance(lon, lat) < 12 && W.height(lon, lat) > 0.5 && inside(p, lon, lat));
  P.grass = find((p, lon, lat) => p.cat === 'default' && p.kind === 'grassland' && W.townPatchDistance(lon, lat) > 40 && inside(p, lon, lat));
  P.sleet = find(p => p.cat === 'mountain' && p.snowFrac > 0.3 && p.snowFrac < 0.7, 400000, (lon, lat) => W.height(lon, lat) > 17);
  P.ice = find((p, lon, lat) => { if (p.cat !== 'ice') return false; const q = W.destination({ lon, lat }, 90, 6); return Wx.place(q.lon, q.lat).cat === 'default'; });
  P.desert = find((p, lon, lat) => p.cat === 'desert' && inside(p, lon, lat)); P.lava = find((p, lon, lat) => p.cat === 'lava' && inside(p, lon, lat));
  P.desertEdge = find((p, lon, lat) => { if (p.cat !== 'desert') return false; const q = W.destination({ lon, lat }, 90, 9), g = Wx.place(q.lon, q.lat); return g.cat === 'default' && g.kind !== 'town'; });
  P.sea = find((p, lon, lat) => W.height(lon, lat) < -3 && W.coastDistance(lon, lat) < -15);      // coastDistance is negative at sea
  for (const k in P) if (P[k] && !P[k].xz) { const q = W.lonLatToTown(P[k].lon, P[k].lat); P[k].xz = [q.x, q.z]; }
  for (const k in P) if (P[k] && P[k].lon === undefined) { const ll = W.townToLonLat(P[k].xz[0], P[k].xz[1]); P[k].lon = ll.lon; P[k].lat = ll.lat; }
  const go = (p, dist = 20, o = {}) => { S.view.set({ target: [p.xz[0], 1.2, p.xz[1]], dist, pitch: o.pitch ?? 0.6, yaw: o.yaw ?? 0.4 }); window.__step(o.frames ?? 3); };
  // the precipitation objects drawn in one render: counted by onBeforeRender (an object that is not drawn never calls it)
  const precip = () => { const list = [['rain', S.rain.obj]]; const sn = Wx.snow(); if (sn) list.push(['snow', sn.o]); const lc = Wx.local && Wx.local(); if (lc && lc.built) list.push(['leaf-drips', lc.drips]); /* WX3: the forest's leaf drips */ Wx.effectObjects().forEach((o, i) => { const e = Wx.effects()[i]; if (e.kind === 'drip' || e.kind === 'impact') list.push([e.kind + ':' + e.src, o]); }); return list; };
  const drawn = () => { const list = precip(), seen = {}; const saved = list.map(([, o]) => o.onBeforeRender); list.forEach(([k, o]) => { o.onBeforeRender = () => { seen[k] = (seen[k] || 0) + 1; }; }); S.renderer.render(S.scene, S.camera); list.forEach(([, o], i) => { o.onBeforeRender = saved[i]; }); return seen; };
  const pixels = () => { S.renderer.render(S.scene, S.camera); const gl = S.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
  const diff = (a, b) => { let n = 0, max = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) { max = Math.max(max, d); if (i % 4 === 0 || d) n++; } } return { n, max }; };
  const texel = (lon, lat) => { const m = Wx.map(); if (!m.box) return null; const a = Math.round(((((lon - m.box.lon0) % 360) + 540) % 360 - 180) / m.STEP), b = Math.round((lat - m.box.lat0) / m.STEP); if (a < 0 || b < 0 || a >= m.N || b >= m.N) return null; const o = (b * m.N + a) * 4; return [m.data[o], m.data[o + 1], m.data[o + 2], m.data[o + 3]]; };
  window.__wx = { S, Wx, W, P, go, drawn, pixels, diff, texel, precip, D };
};

const page = await open();
const places = await page.evaluate(() => Object.fromEntries(Object.entries(window.__wx.P).map(([k, p]) => [k, p ? { lon: +p.lon.toFixed(3), lat: +p.lat.toFixed(3), xz: p.xz.map(v => +v.toFixed(1)) } : null])));
report.places = places;
console.log('地点：' + Object.entries(places).map(([k, p]) => `${k} ${p ? `(${p.lon}, ${p.lat})` : '未找到'}`).join('；'));

// ---- R: the registry
if (want('R')) {
  const r = await page.evaluate(() => { const { S, Wx } = window.__wx, reg = new Set(Wx.effectObjects()), by = {}, missing = [];
    for (const e of Wx.effects()) { const k = e.kind + ' ' + (e.src.startsWith('building:') ? 'building' : e.src); by[k] = (by[k] || 0) + 1; }
    for (const r of S.town.roots) r.traverse(o => { if (!o.material || reg.has(o)) return; let live = false; for (let p = o.parent; p; p = p.parent) if (p.userData && p.userData.live) { live = true; break; } if (!live) return; let top = o; while (top.parent && top.parent !== S.scene) top = top.parent;
      const hex = o.material.color && o.material.color.getHexString(); if (o.isLineSegments && ['cee7e5', 'c1e4df', 'd4ecea'].includes(hex)) missing.push('line ' + top.name); if (o.isMesh && o.geometry.type === 'RingGeometry' && o.material.blending === 2 && !/Chozu$/.test(top.name)) missing.push('ring ' + top.name); });
    const tags = []; S.scene.traverse(o => { if (o.userData && o.userData.weather && !reg.has(o)) tags.push(o.userData.weather); });
    return { by, missing, tags, n: reg.size }; });
  out(r.missing.length === 0 && r.tags.length === 0 && r.n > 100, 'R 登记表：建筑动画滴水线、雨击环与地标标记全部登记（只改不透明度与可见性）', [`共 ${r.n} 个：${Object.entries(r.by).map(([k, v]) => `${k} ${v}`).join('，')}`, `未登记的滴水色动画线或雨击环：${r.missing.length ? r.missing.join('、') : '无'}（手水舍水盆的环来自竹筒流水，不是天气，不登记）；未登记的地标标记：${r.tags.length}`], r);
}

// ---- I1
if (want('I1')) {
  const r = await page.evaluate(() => {
    const { S, Wx, P, go } = window.__wx, rows = [], bad = [], o = {};
    const plan = [['town', ['rain', 'after', 'overcast', 'clear', 'fog', 'snow']], ['grass', ['rain', 'after', 'overcast', 'clear']], ['forest', ['rain', 'after', 'fog', 'clear']], ['coast', ['rain', 'fog', 'clear']], ['sleet', ['rain', 'snow', 'clear']], ['ice', ['snow', 'rain', 'clear']], ['desert', ['rain', 'clear']], ['lava', ['rain', 'clear']]];
    for (const [pk, states] of plan) { const p = P[pk]; if (!p) { bad.push(pk + ' 未找到'); continue; }
      for (const s of states) { Wx.lock(s); go(p, 20, { frames: 4 }); const e = Wx.field(p.lon, p.lat, {}), sn = Wx.snow(), shownSnow = sn && sn.o.visible ? sn.shown : 0, rainShown = S.rain.obj.visible ? S.rain.shown() : 0;
        const eff = Wx.effects().filter(q => Math.abs(q.lon - p.lon) < 2 && Math.abs(q.lat - p.lat) < 2);
        const row = { place: pk, lock: s, rain: +e.rain.toFixed(3), snow: +e.snow.toFixed(3), wet: +e.wetness.toFixed(3), drip: +e.drip.toFixed(3), mist: +e.mist.toFixed(3), rainShown, snowShown: shownSnow, effK: eff.map(q => q.kind + ':' + q.k.toFixed(2)).slice(0, 3) };
        // rules: rain lines exactly where the field rains (all drops of the box share the box's weight here: the place is uniform), snow likewise, legal states only
        const c = [p.xz[0], 1.2, p.xz[1]], boxRain = Wx.boxHas(c, 'rain') || e.rain > 0, boxSnow = Wx.boxHas(c, 'snow') || e.snow > 0;
        let ok = (e.rain > 0 ? rainShown > 0 : true) && (rainShown > 0 ? boxRain : true) && (e.snow > 0 ? shownSnow > 0 : true) && (shownSnow > 0 ? boxSnow : true);
        if (pk === 'ice' && e.rain > 0) ok = false; if (pk === 'town' && e.snow > 0) ok = false; if (pk === 'sleet' && s === 'rain' && !(rainShown > 0 && shownSnow > 0)) ok = false;
        for (const q of eff) { const want = q.kind === 'drip' ? e.drip : q.kind === 'impact' ? e.rain : q.kind === 'snow-mist' ? e.snow : Math.max(e.mist, e.wetness); if (Math.abs(q.k - want) > 0.02) ok = false; }
        if (!ok && bad.length < 8) bad.push(JSON.stringify(row)); rows.push(row); } }
    Wx.lock(null); return { rows, bad };
  });
  const L = r.rows.map(q => `${q.place}/${q.lock}：雨 ${q.rain} 雪 ${q.snow} 湿 ${q.wet} 滴 ${q.drip} 雾 ${q.mist} → 雨丝 ${q.rainShown}/2800，雪 ${q.snowShown}/900${q.effK.length ? '，登记效果 ' + q.effK.join(' ') : ''}`);
  out(r.bad.length === 0, 'I1 六种锁定 × 允许的地貌：雨丝、雪、雨击、滴水与雾按所在地的场', [...L, ...r.bad.map(b => '不符：' + b)], r.rows);
}

// ---- I2
if (want('I2')) {
  const r = await page.evaluate(() => {
    const { S, Wx, P, go } = window.__wx, res = {};
    for (const s of ['clear', 'after', 'rain']) { Wx.lock(s); go(P.town, 34, { pitch: 0.5, yaw: 2.5, frames: 3 }); const m = Wx.map(); let rMax = 0, gMin = 255; for (let i = 0; i < m.data.length; i += 4) { rMax = Math.max(rMax, m.data[i]); gMin = Math.min(gMin, m.data[i + 1]); }
      const R = S.roads.state.ripples, ripVis = S.roads.objects.inst.filter(q => /ripple/.test(q.name)).some(q => q.visible), eff = Wx.effects();
      const tw = window.__wx.texel(0, 0); res[s] = { rainShown: S.rain.obj.visible ? S.rain.shown() : 0, mapRainMax: rMax, mapWetMin: gMin, townWet: tw && tw[1], uRain: S.ocean.uniforms.uRain.value, ripVis, ripAny: R ? R.any : null, pond: eff.filter(e => e.kind === 'impact').map(e => +e.k.toFixed(2)), drip: eff.filter(e => e.kind === 'drip' && e.src.startsWith('building')).every(e => e.visible && Math.abs(e.k - (s === 'clear' ? 0 : 1)) < 1e-9), dripAny: eff.filter(e => e.kind === 'drip' && e.visible).length, wet: Wx.field(0, 0, {}).wetness }; }
    Wx.lock(null); return res;
  });
  const c = r.clear, a = r.after, w = r.rain;
  const ok = c.mapRainMax === 0 && !c.ripVis && c.pond.every(k => k === 0) && c.rainShown === 0 && c.dripAny === 0 && a.rainShown === 0 && a.mapRainMax === 0 && !a.ripVis && a.drip && a.wet === 1 && a.townWet === 255 && w.rainShown === 2800 && w.ripVis && w.drip && w.mapRainMax === 255;
  out(ok, 'I2 锁晴：海/田/路/池无雨击；雨后：无雨丝、无雨击，湿润与滴水继续', [
    `晴：雨丝 ${c.rainShown}，天气图雨击最大 ${c.mapRainMax}/255（海面与水田着色器乘它），路面水洼环 ${c.ripVis ? '显示' : '隐藏'}（有雨的点 ${c.ripAny}），池塘环系数 ${c.pond.join(' ')}，显示中的滴水 ${c.dripAny}`,
    `雨后：雨丝 ${a.rainShown}，雨击最大 ${a.mapRainMax}，水洼环 ${a.ripVis ? '显示' : '隐藏'}，建筑滴水全部显示且系数 1：${a.drip}，城镇湿润 ${a.wet}，天气图城镇格湿润 ${a.townWet}/255`,
    `雨：雨丝 ${w.rainShown}/2800，雨击最大 ${w.mapRainMax}，水洼环 ${w.ripVis ? '显示' : '隐藏'}，滴水 ${w.drip}；海面 uRain（开关 × (1 − uBend) × w_local）${f(w.uRain, 3)}`], r);
}

// ---- I3
if (want('I3')) {
  const r = await page.evaluate(() => {
    const { S, Wx, P, go, texel } = window.__wx; if (!P.desertEdge) return null;
    Wx.lock(null); Wx.setTime(100); const p = { ...P.desertEdge }, E = window.WORLD.destination(p, 90, 9), M = window.WORLD.destination(p, 90, 4.5), q = window.WORLD.lonLatToTown(M.lon, M.lat); go({ xz: [q.x, q.z], lon: M.lon, lat: M.lat }, 20, { frames: 10 });
    const m = Wx.map(); let wet = 0, dry = 0; for (let i = 0; i < m.data.length; i += 4) { if (m.data[i] === 255) wet++; else if (m.data[i] === 0) dry++; }
    const R = S.rain; let shownRain = 0, hiddenRain = 0, wrong = 0; const o = {};
    for (let i = 0; i < R.count; i++) { if (R.park[i]) continue; const x = R.positions[i * 6], z = R.positions[i * 6 + 2], w = Wx.fieldXZ(x, z, o).rain, shown = R.show[i * 6 + 1] > -1000; if (shown) shownRain++; else if (w === 0) hiddenRain++; if (shown !== (R.hash[i] < w)) wrong++; }
    const a = Wx.field(p.lon, p.lat, {}).rain, b = Wx.field(E.lon, E.lat, {}).rain;
    Wx.setTime(null); return { wet, dry, shownRain, hiddenRain, wrong, desert: a, grass: b, place: p };
  });
  const ok = r && r.wet > 0 && r.dry > 0 && r.shownRain > 0 && r.hiddenRain > 0 && r.wrong <= 2 && r.desert === 0 && r.grass === 1;
  out(ok, 'I3 同一时刻两处不同天气（沙漠边 t = 100 s：草原雨、沙漠晴）', r ? [`天气图：雨击 255 的格 ${r.wet}、0 的格 ${r.dry}；场：沙漠点雨 ${r.desert}，东 9 m 草原点雨 ${r.grass}`, `雨箱跨边界：显示 ${r.shownRain} 滴，因所在地无雨而不显示 ${r.hiddenRain} 滴；显示与否不符合“哈希 < 该处雨权重”的 ${r.wrong} 滴（允许 2：本帧刚刷新的边界滴）`] : ['未找到沙漠与草原相邻的地点'], r);
}

// ---- I4
if (want('I4')) {
  const r = await page.evaluate(() => {
    const { S, Wx, W, P, go } = window.__wx, THREE = window.THREE, res = [], D = Math.PI / 180;
    const RD = S.roads.data(), b = RD.bridges.find(q => q.def.id === 'RN01-13') || RD.bridges[0], mid = b.samples[Math.floor(b.samples.length / 2)], deckFlat = (b.alt[Math.floor(b.samples.length / 2)] - 1.6) / Math.cos(mid.lat * D);
    const lm = id => W.landmarks.find(q => q.id === id), sea = P.sea;
    const L1 = lm('LM01'), slope = W.destination(L1, 120, 18);
    const cases = [['高地（雨见岳山顶）', L1, 'snow'], ['坡地（雨见岳东南坡）', slope, 'rain'], ['桥面 ' + b.def.id, mid, 'rain'], ['海面', sea, 'rain'], ['LM04 正殿屋顶', lm('LM04'), 'rain'], ['LM07 冰面', lm('LM07'), 'snow'], ['旧剔除点 [-72, 1.2, -12]', W.townToLonLat(-72, -12), 'rain'], ['旧剔除点 [150, 1.2, 40]', W.townToLonLat(150, 40), 'rain']];
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    for (const [name, ll, st] of cases) { if (!ll) { res.push({ name, missing: true }); continue; }
      const q = W.lonLatToTown(ll.lon, ll.lat); Wx.lock(st); S.view.set({ target: [q.x, 1.2, q.z], dist: 22, pitch: 0.55, yaw: 0.9 }); window.__step(6);
      const R = S.rain; let under = 0, n = 0, floorBad = 0, hits = 0, rays = 0; const shown = R.obj.visible ? R.shown() : 0;
      const targets = []; for (const lmk of ['LM04', 'LM07', 'LM01']) if (name.includes(lmk) || (lmk === 'LM01' && name.includes('雨见岳'))) { const info = S.landmarks.info[lmk]; if (info) targets.push(...info.groups); }
      for (let i = 0; i < R.count; i++) { if (R.park[i] || R.show[i * 6 + 1] < -1000) continue; n++; const x = R.positions[i * 6], y = R.positions[i * 6 + 1], z = R.positions[i * 6 + 2], s = Wx.surfaceY(x, z);
        if (y < R.floor[i] - 1e-3) under++; if (Math.abs(R.floor[i] - (s + 0.2)) > 0.05) floorBad++;
        if (targets.length && rays < 60 && i % 7 === 0) { rays++; ray.set(new THREE.Vector3(x, y, z), down); ray.far = Math.max(0, y - R.floor[i]); const h = ray.intersectObjects(targets, true).filter(q => q.object.isMesh && !(q.object.material.transparent && q.object.material.opacity < 0.3)); if (h.length) hits++; } }
      const sn = Wx.snow(); let sUnder = 0, sShown = 0; if (sn && sn.o.visible) for (let i = 0; i < sn.n; i++) { const y = sn.pos[i * 3 + 1]; if (y < -1000) continue; sShown++; if (y < Wx.surfaceY(sn.pos[i * 3], sn.pos[i * 3 + 2])) sUnder++; }
      let submitted = 0; const keep = R.obj.onBeforeRender; R.obj.onBeforeRender = () => { submitted++; }; S.renderer.render(S.scene, S.camera); R.obj.onBeforeRender = keep;
      res.push({ name, lock: st, surf: +Wx.surfaceY(q.x, q.z).toFixed(2), deck: name.startsWith('桥面') ? +deckFlat.toFixed(2) : null, shown, n, under, floorBad, rays, hits, snowShown: sShown, snowUnder: sUnder, submitted }); }
    Wx.lock(null); return res;
  });
  const ok = r.every(q => q.missing || (q.under === 0 && q.floorBad === 0 && q.hits === 0 && q.snowUnder === 0 && (q.lock !== 'rain' || q.name.includes('冰') || (q.shown > 0 && q.submitted === 1)) && (q.deck === null || q.surf >= q.deck - 0.05)));
  out(ok, 'I4 高度：雨雪终止于接收面（高地、坡地、桥面、海面、地标屋顶、冰面），旧城外剔除点确有雨提交渲染', r.map(q => q.missing ? `${q.name}：未找到` : `${q.name}（锁${q.lock}）：目标接收面 y ${q.surf}${q.deck !== null ? `（桥面 ${q.deck}）` : ''}；雨丝 ${q.shown}，在底面以下 ${q.under}，底面 ≠ 接收面 + 0.2 的 ${q.floorBad}；自上而下射线在雨滴与底面之间碰到实体 ${q.hits}/${q.rays}；雪 ${q.snowShown}，在地表以下 ${q.snowUnder}；雨对象提交渲染 ${q.submitted} 次`), r);
}

// ---- I5
if (want('I5')) {
  const r = await page.evaluate(() => {
    const { S, Wx, P, go, drawn } = window.__wx, T = S.transition, bad = [];
    T.setMode('sphere'); T.step(3); let n = 0;
    for (const st of ['rain', 'after', 'overcast', 'clear', 'snow', 'fog']) for (const pk of ['town', 'forest', 'ice', 'sleet']) for (const d of [9, 40, 140, 400]) { const p = P[pk]; if (!p) continue; Wx.lock(st); go(p, d, { frames: 3 }); n++;
      const dr = drawn(), e = Wx.effects(), g = Wx.gains(), ice = S.cover.objects && S.cover.objects.ice, sea = S.ocean.objects && S.ocean.objects.water;
      const v = { drawn: Object.keys(dr), eff: e.filter(q => q.k !== 0 || q.visible).length, impact: g.impact, uRain: S.ocean.uniforms.uRain.value, fog: S.scene.fog.density, mist: S.cover.objects.mist ? S.cover.objects.mist.material.opacity : 0 };
      if (v.drawn.length || v.eff || v.impact !== 0 || v.uRain !== 0 || v.fog !== 0 || v.mist !== 0) { if (bad.length < 6) bad.push(`${st} ${pk} d=${d} ${JSON.stringify(v)}`); } }
    const keep = { ice: 0, sea: 0 }; S.scene.traverse(o => { if (!o.visible) return; if (/ice/i.test(o.name) && o.isMesh) keep.ice++; if (/sea|water/i.test(o.name) && o.isMesh) keep.sea++; });
    // the switch: u pinned by hand, lock rain at the town (wl = 1 there): coefficients x (1 - u) once
    T.setMode('flat'); T.step(3); Wx.lock('rain'); go(P.town, 34, { pitch: 0.5, yaw: 2.5 }); T.animating = false; const rows = [];
    for (const u of [0, 0.25, 0.5, 0.75, 1]) { S.bend.set(u); window.__step(2); const e = Wx.effects(), drip = e.find(q => q.kind === 'drip' && q.src.startsWith('building')), imp = e.find(q => q.kind === 'impact'), mist = e.find(q => q.kind === 'mist');
      rows.push({ u, rain: S.rain.obj.material.opacity, drip: drip.k, impact: imp.k, mist: mist.k, gain: Wx.gains().impact }); }
    S.bend.set(0); T.setMode('flat'); T.step(3); Wx.lock(null);
    return { n, bad, keep, rows };
  });
  const sw = r.rows.every(q => Math.abs(q.rain - 0.29 * (1 - q.u)) < 1e-9 && Math.abs(q.drip - (1 - q.u)) < 1e-9 && Math.abs(q.impact - (1 - q.u)) < 1e-9 && Math.abs(q.gain - (1 - q.u)) < 1e-9);
  out(r.bad.length === 0 && r.keep.ice > 0 && r.keep.sea > 0 && sw, 'I5 球形：任何距离、地点、锁定下天气效果为 0 且不绘制；永久冰雪与海水保留；切换系数 (1 − u) 只乘一次', [`6 种锁定 × 4 处 × d = 9/40/140/400 = ${r.n} 个画面，违规 ${r.bad.length}`, ...r.bad, `球形下仍显示的冰面网格 ${r.keep.ice}、海/水面网格 ${r.keep.sea}`, ...r.rows.map(q => `u = ${q.u}：雨丝不透明度 ${f(q.rain, 4)}（${f(0.29 * (1 - q.u), 4)}），滴水 ${f(q.drip, 3)}，雨击 ${f(q.impact, 3)}，雾带 ${f(q.mist, 3)}（城镇雨锁、w_local = 1 时都应为 1 − u）`)], r);
}

// ---- I6
if (want('I6')) {
  const r = await page.evaluate(() => {
    const { S, Wx, P, go } = window.__wx, T = S.transition, hemi = S.scene.children.find(o => o.isHemisphereLight), moon = S.scene.children.find(o => o.isDirectionalLight);
    const snap = () => [hemi.intensity, moon.intensity, S.scene.fog.density, S.scene.fog.color.getHexString(), S.scene.background.getHexString()].join('|');
    const res = {};
    for (const pk of ['town', 'forest']) { Wx.lock('rain'); go(P[pk], 30, { frames: 5 }); const a = snap(); for (const s of ['clear', 'fog', 'rain', 'overcast', 'after', 'rain']) { Wx.lock(s); window.__step(4); } const b = snap(); res[pk] = { a, b, same: a === b }; }
    Wx.lock('fog'); go(P.forest, 30, { frames: 5 }); const a = snap(); T.setMode('sphere'); T.step(3); window.__step(3); T.setMode('flat'); T.step(3); window.__step(3); const b = snap(); res.sphere = { a, b, same: a === b };
    // a repeated visit: the same time and camera give the same weather and the same coefficients
    Wx.lock(null); Wx.setTime(1234); go(P.grass, 25, { frames: 3 }); const v1 = JSON.stringify([Wx.get().weights, Wx.effects().map(e => e.k)]); go(P.town, 25); go(P.forest, 60); go(P.grass, 25, { frames: 3 }); const v2 = JSON.stringify([Wx.get().weights, Wx.effects().map(e => e.k)]); Wx.setTime(null);
    res.visit = { same: v1 === v2 }; Wx.lock(null); return res;
  });
  out(r.town.same && r.forest.same && r.sphere.same && r.visit.same, 'I6 无基值漂移：锁定往返与平面 → 球形 → 平面逐值恢复；同一时刻同机位重复到访一致', [`城镇 雨→晴→雾→雨→阴→雨后→雨：${r.town.same ? '逐值相同' : `不同 ${r.town.a} → ${r.town.b}`}`, `森林 同上：${r.forest.same ? '逐值相同' : `不同 ${r.forest.a} → ${r.forest.b}`}`, `森林锁雾 平面→球形→平面：${r.sphere.same ? '逐值相同' : `不同 ${r.sphere.a} → ${r.sphere.b}`}`, `t = 1234 s 草原机位，离开到城镇、森林再回来：天气与全部系数${r.visit.same ? '相同' : '不同'}`], r);
}

// ---- I7
if (want('I7')) {
  const r = await page.evaluate(() => {
    const { S, Wx, W } = window.__wx; let s = 2024; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const heap0 = performance.memory ? performance.memory.usedJSHeapSize : null, cost = []; let maxNodes = 0;
    for (let i = 0; i < 60; i++) { const lon = -180 + rnd() * 360, lat = -76 + rnd() * 152, q = W.lonLatToTown(lon, lat); Wx.lock(['rain', 'snow', null, 'fog'][i % 4]); S.view.set({ target: [S.bend.wrapX(q.x), 1.2, q.z], dist: 15 + rnd() * 60, pitch: 0.5, yaw: rnd() * 6 }); window.__step(4); maxNodes = Math.max(maxNodes, Wx.nodes()); }
    // tick + apply cost at three views (weather_fx alone; mean of 30 frames, the frame driver's clock does not move performance.now, so Date-free timing via a loop)
    for (const [name, st, xz] of [['城镇雨', 'rain', [-7, 20]], ['城外雾', 'fog', null], ['冰原雪', 'snow', null]]) { Wx.lock(st); const p = xz ? { x: xz[0], z: xz[1] } : W.lonLatToTown(...(st === 'fog' ? [-15, -40] : [100, 74])); S.view.set({ target: [p.x, 1.2, p.z], dist: 25, pitch: 0.5, yaw: 1 }); window.__step(5);
      const g = Wx.get(), view = { lonLat: { lon: g.lon, lat: g.lat }, h: g.h, d: g.d, target: [p.x, 1.2, p.z], u: 0 }, N = 30, marks = []; for (let i = 0; i < N; i++) { const a = window.__perfNow(); Wx.tick(100 + i * 0.016, 0.016, view); Wx.apply(); marks.push(window.__perfNow() - a); } marks.sort((a, b) => a - b); cost.push({ name, median: marks[N >> 1], p95: marks[Math.floor(N * 0.95)] }); }
    const sn = Wx.snow(), surf = Wx.surfaces().landmarks.reduce((a, l) => a + l.cells, 0), heap1 = performance.memory ? performance.memory.usedJSHeapSize : null; Wx.lock(null);
    return { maxNodes, nodesCap: window.WEATHER_FX.live && 60000, snowN: sn ? sn.n : 0, rainN: S.rain.count, coverCells: surf, heapMB: heap0 && heap1 ? (heap1 - heap0) / 1048576 : null, cost };
  });
  const low = await open(800, 500, '?quality=low');
  const rl = await low.evaluate(() => { const { S, Wx } = window.__wx; Wx.lock('snow'); window.__wx.go({ xz: [window.WORLD.lonLatToTown(100, 74).x, window.WORLD.lonLatToTown(100, 74).z] }, 16, { frames: 10 }); const sn = Wx.snow(); const o = { tier: S.quality.tier(), rain: S.rain.count, snow: sn ? sn.n : 0, size: sn ? sn.m.size : null, shown: sn ? sn.shown : 0 }; Wx.lock(null); return o; });
  await low.close();
  const ok = r.maxNodes <= r.nodesCap && r.snowN === 900 && r.rainN === 2800 && rl.rain === 2800 && rl.snow === 900 && rl.size === 0.09 && rl.shown > 0;
  out(ok, 'I7 全图平移：缓存有上限、粒子数固定、低档规则与尺度不变；天气每帧开销', [`60 处随机平移（交替锁雨/雪/自然/雾）：格点缓存最多 ${r.maxNodes}（上限 ${r.nodesCap}），雨 ${r.rainN} 滴、雪 ${r.snowN} 片不变，地标接收面栅格共 ${r.coverCells} 格（按需建立）${r.heapMB === null ? '' : `，JS 堆变化 ${f(r.heapMB, 1)} MB`}`, `低档页面（?quality=low，档位 ${JSON.stringify(rl.tier)}）：雨 ${rl.rain}、雪 ${rl.snow}、雪粒大小 ${rl.size}、冰原锁雪显示 ${rl.shown} 片`, ...r.cost.map(c => `${c.name}：weather_fx tick + apply 中位 ${f(c.median, 2)} ms、p95 ${f(c.p95, 2)} ms`)], { ...r, low: rl });
}

// ---- I8 WX-0
if (want('I8')) {
  const r = await page.evaluate(() => {
    const { S, Wx, P, go, drawn, pixels, diff, precip } = window.__wx, T = S.transition, rows = [], bad = [];
    const check = (label) => { const dr = drawn(); const n = Object.values(dr).reduce((a, b) => a + b, 0); rows.push({ label, drawn: n }); if (n && bad.length < 8) bad.push(label + ' ' + JSON.stringify(dr)); return n; };
    for (const pk of ['town', 'repro1', 'forest', 'coast', 'ice']) for (const d of [9, 40, 140, 400]) { const p = P[pk]; if (!p) continue; Wx.lock(pk === 'ice' ? 'snow' : 'rain'); go(p, d, { frames: 3 }); Wx.lock('clear'); window.__step(1); check(`${pk} d=${d} ${pk === 'ice' ? '雪' : '雨'}→晴`); }
    // after-rain -> clear, unlock at a natural clear moment, the rain switch, flat <-> sphere
    Wx.lock('after'); go(P.town, 30, { frames: 5 }); Wx.lock('clear'); window.__step(1); check('城镇 雨后→晴');
    const W = Wx.weather; Wx.lock(null); let tc = null; for (let t = 300; t < 21600 && tc === null; t += 30) { const q = W.sample(0, 0, t); if (q.weights.clear === 1 && W.sample(0, 0, t + 20).weights.clear === 1) tc = t + 10; }   // unlocked: a moment of the town's natural clear weather
    Wx.lock(null); Wx.setTime(tc); go(P.town, 30, { frames: 5 }); check(`城镇 解除锁定、自然晴 t = ${tc} s`);
    S.weather.lock('clear'); window.__step(2); S.weather.lock(null); window.__step(2); check('城镇 自然晴 旧雨开关 关→开');
    T.setMode('sphere'); T.step(3); window.__step(2); T.setMode('flat'); T.step(3); window.__step(2); check('城镇 自然晴 平面→球形→平面');
    // the same frame with every registered precipitation object hidden: identical
    const a = pixels(); const list = precip(), vis = list.map(([, o]) => o.visible); list.forEach(([, o]) => { o.visible = false; }); const b = pixels(); list.forEach(([, o], i) => { o.visible = vis[i]; }); const dd = diff(a, b);
    Wx.setTime(null); Wx.lock(null);
    return { rows, bad, tc, diff: dd, listed: list.length };
  });
  // a cold start in natural clear weather: a fresh page whose first frames are at a clear moment of the town
  const cold = await open();
  const rc = await cold.evaluate(tc => { const { S, Wx, drawn } = window.__wx; Wx.setTime(tc); window.__step(3); const dr = drawn(); return { n: Object.values(dr).reduce((a, b) => a + b, 0), w: Wx.get().weights.clear }; }, r.tc);
  await cold.close();
  const ok = r.bad.length === 0 && r.diff.n === 0 && rc.n === 0 && rc.w === 1;
  out(ok, 'I8 WX-0 晴天无雨丝：所有降水对象在最终渲染时不绘制；同帧隐藏全部降水对象画面逐位相同', [`${r.rows.length} 个情形，绘制了降水对象的 ${r.rows.filter(q => q.drawn).length}`, ...r.bad, `冷启动于自然晴（t = ${r.tc} s，晴权重 ${rc.w}）：绘制降水对象 ${rc.n}`, `同帧差分（自然晴，城镇，${r.listed} 个降水对象：雨丝、雪、建筑与地标滴水、雨击环）：差异像素 ${r.diff.n}，最大通道差 ${r.diff.max}`, '雨线来源（审查结论）：建筑檐滴、窗上雨流、锁链与落水口流水、地标檐滴原先不受天气控制；路面水洼环原先按湿润在阴天与雾里继续；城镇原先一处同时有几种天气而雨丝跟随目标点。现均按所在地天气'], { ...r, cold: rc });
}

// ---- I9
if (want('I9')) {
  const r = await page.evaluate(() => {
    const { S, Wx, go } = window.__wx, W = Wx.weather; let hit = null;
    for (let t = 300; t < 21600 && !hit; t += 300) { const q = W.sample(0, 0, t + 1); if (q.fadeLeft > 0 && q.target.clear === 1 && q.weights.rain > 0.9) hit = t; }
    if (hit === null) return null; Wx.lock(null); const rows = [];
    for (const dt of [0, 12, 24, 36, 47, 49]) { Wx.setTime(hit + dt); go({ xz: [-7, 20] }, 30, { frames: 2, pitch: 0.5, yaw: 2.5 }); const g = Wx.get(); rows.push({ t: hit + dt, rain: +g.weights.rain.toFixed(3), clear: +g.weights.clear.toFixed(3), fadeLeft: +g.fadeLeft.toFixed(1), shown: S.rain.obj.visible ? S.rain.shown() : 0 }); }
    Wx.setTime(null); return rows;
  });
  const ok = r && r[r.length - 1].shown === 0 && r[r.length - 1].rain === 0 && r.every((q, i) => i === 0 || q.shown <= r[i - 1].shown + 40) && r.every(q => Math.abs(q.shown / 2800 - q.rain) < 0.06);
  out(ok, 'I9 自然雨 → 晴渐变：报告权重与剩余时间，雨丝随雨权重变稀，结束为 0', r ? r.map(q => `t = ${q.t} s：雨 ${q.rain}、晴 ${q.clear}、渐变剩余 ${q.fadeLeft} s → 雨丝 ${q.shown}/2800`) : ['6 小时内未找到城镇的雨 → 晴渐变'], r);
}

await page.close();
if (errors.length) { console.log('page errors:', errors.slice(0, 5).join(' | ')); fails.push('page errors'); }
await browser.close();
if (args.includes('--report')) { const dir = path.join(root, 'docs', 'world', 'weather', 'wx2'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify({ date: new Date().toISOString().slice(0, 10), fails, report }, null, 1)); console.log('报告：docs/world/weather/wx2/report.json'); }
console.log(fails.length ? `FAIL weather_integration_check：${fails.join('；')}` : `PASS weather_integration_check（${Object.keys(report).filter(k => k !== 'places').length} 项）`);
process.exitCode = fails.length ? 1 : 0;
