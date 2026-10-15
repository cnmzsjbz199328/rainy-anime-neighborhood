// Grey view at some angles and heights (docs/world/GRAY_VIEW_FIX_PLAN.md): the weather fog, additive light and ink lines under fog. Run after `python3 build.py`:
//   node tools/fog_view_check.mjs [--html <file>] [--ablation]
//   G1  additive light under fog, read back from a render target through the real bend.js patch: a black additive face adds nothing at any fog density (exp2 and
//       linear), a white one is the transmittance T = 1 - F, fog: false stays unfogged, a normal face still mixes to the fog colour
//   G2  ink lines (userData.inkFog): over the base fog exactly their unfogged colour, under the weather's fog mixed by the weather's part of it only
//   G3  LM08 (the lighthouse island) at a fixed weather time: locks rain / after / fog / clear (the lock must hold there), pitch 0.25..1.2 x dist 35..160 x two yaws,
//       forward and back: the view target keeps a transmittance >= 0.2 (exp(-(density * depth)^2) at the camera-target depth), finite density, the same density and
//       colour on the way back; the grey share of the frame (pixels within 10 of the fog colour) is printed as an alarm figure only, it is no visual verdict
//   G4  the same place under fog with uBend 0 / 0.5 / 1 / 0: the weather's fog fades with the bend, none on the sphere, the flat state comes back exactly
//   --ablation  one fixed frame at LM08 (fog, pitch 0.5, dist 65, yaw 2.5) rendered as is, without fog, without the lamp pools, the sea, the coast ink: grey share
//               and changed pixels (diagnostic numbers, not a gate)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const html = path.resolve(arg('--html') || path.join(root, 'index.html'));
const results = [], fails = [], out = (ok, name, lines) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); };
const f = (x, n = 3) => (+x).toFixed(n);
const browser = await launchChromium(), errors = [];
const page = await browser.newPage({ viewport: { width: 480, height: 300 }, deviceScaleFactor: 1 });
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await page.addInitScript(INIT); await page.goto(pathToFileURL(html).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__scene && window.__scene.worldgen.stats().done, null, { timeout: 180000 }); await page.evaluate(() => window.__step(2));
console.log(`页面：${html}`);

// ---- G1, G2: one face 40 m in front of a camera at the origin, into an 8 x 8 render target (working colour space: fog colour and result are linear)
{
  const r = await page.evaluate(() => {
    const T = window.THREE, S = window.__scene, R = S.renderer, B = S.bend, Z = 40, rt = new T.WebGLRenderTarget(8, 8), cam = new T.PerspectiveCamera(20, 1, 0.1, 1000);
    const fogC = new T.Color('#5a5870'), px = new Uint8Array(4), wU = B.weatherFogUniform || null, w0 = wU ? wU.value : 0;
    // the face is 40 m wide: well inside the flat map (the seam at x = -133.5 would move the west part of a wider face by one circumference)
    const run = (fog, mat, weather = 0) => {
      const sc = new T.Scene(); sc.background = new T.Color(0, 0, 0); sc.fog = fog; const m = new T.Mesh(new T.PlaneGeometry(40, 40), mat); m.position.set(0, 0, -Z); sc.add(m);
      if (wU) wU.value = weather; const prev = R.getRenderTarget(); R.setRenderTarget(rt); R.render(sc, cam); R.readRenderTargetPixels(rt, 4, 4, 1, 1, px); R.setRenderTarget(prev);
      m.geometry.dispose(); mat.dispose(); if (wU) wU.value = w0; return [px[0], px[1], px[2]];
    };
    const add = (c, fog = true) => new T.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog });
    const exp2 = d => new T.FogExp2(fogC.clone(), d), lin = () => new T.Fog(fogC.clone(), 10, 80), Fexp = d => 1 - Math.exp(-d * d * Z * Z), Flin = (t => t * t * (3 - 2 * t))((Z - 10) / 70);
    const g1 = [];
    for (const [name, fog, F] of [['exp2 0.0055', exp2(0.0055), Fexp(0.0055)], ['exp2 0.0195', exp2(0.0195), Fexp(0.0195)], ['exp2 0.0355', exp2(0.0355), Fexp(0.0355)], ['linear 10–80', lin(), Flin]]) {
      const black = run(fog, add(0x000000)), white = run(fog, add(0xffffff)), off = run(fog, add(0xffffff, false)), c = new T.Color(0.6, 0.3, 0.1), normal = run(fog, new T.MeshBasicMaterial({ color: c }));
      const wantN = [c.r, c.g, c.b].map((v, k) => Math.round(255 * (v + ([fogC.r, fogC.g, fogC.b][k] - v) * F)));
      g1.push({ name, F, black, white, wantWhite: Math.round(255 * (1 - F)), off, normal, wantN });
    }
    // G2: an ink face (the same fog chunk as a line) at the base density with no weather, and with the weather adding 0.014 on top of 0.0055
    const ink = c => { const m = new T.MeshBasicMaterial({ color: c }); m.userData.inkFog = true; return m; }, c = new T.Color(0.15, 0.2, 0.28);
    const plain = run(null, new T.MeshBasicMaterial({ color: c })), base = run(exp2(0.0055), ink(c), 0), a = 0.014, d = 0.0055 + a, weather = run(exp2(d), ink(c), a);
    const Fw = 1 - Math.exp(-(d * d - 0.0055 * 0.0055) * Z * Z), wantW = [c.r, c.g, c.b].map((v, k) => Math.round(255 * (v + ([fogC.r, fogC.g, fogC.b][k] - v) * Fw)));
    rt.dispose(); return { g1, g2: { plain, base, weather, wantW, Fw, hasUniform: !!wU } };
  });
  const near = (a, b, t = 2) => a.every((v, k) => Math.abs(v - b[k]) <= t);
  let ok = true; const L = [];
  for (const q of r.g1) {
    const good = q.black.every(v => v === 0) && q.white.every(v => Math.abs(v - q.wantWhite) <= 2) && q.off.every(v => v >= 254) && near(q.normal, q.wantN); if (!good) ok = false;
    L.push(`${q.name}（F ${f(q.F)}）：黑色加法 [${q.black}]（应 0），白色加法 [${q.white}]（应 ${q.wantWhite}），fog:false [${q.off}]（应 255），普通面 [${q.normal}]（应 [${q.wantN}]）`);
  }
  out(ok, 'G1 加法光在雾中只按透射率衰减，不向雾色插值（exp2 / linear，fog:false 与普通材质不变）', L);
  const g = r.g2, ok2 = g.hasUniform && g.base.every((v, k) => v === g.plain[k]) && near(g.weather, g.wantW);
  out(ok2, 'G2 墨线：基础雾下与无雾逐位相同，只被天气附加的那部分雾覆盖', [`无雾 [${g.plain}]；基础雾 0.0055、天气 0 [${g.base}]（应与无雾相同）；天气 +0.014 [${g.weather}]（应 [${g.wantW}]，F ${f(g.Fw)}）；天气雾 uniform ${g.hasUniform ? '有' : '无'}`]);
}

// ---- G3, G4, ablation at LM08
const setup = () => page.evaluate(() => { const S = window.__scene, W = window.WORLD, lm = W.landmarks.find(q => q.id === 'LM08'), q = W.lonLatToTown(lm.lon, lm.lat); S.weather.setTime(600); return [q.x, 1.2, q.z]; });
const target = await setup();
const sample = (v, grey) => page.evaluate(([v, grey]) => {
  const S = window.__scene, T = window.THREE; S.view.set(v); window.__step(1);
  const g = S.weather.get(), cam = S.camera.position, lt = S.transition.lookTarget(S.bend.get()), depth = Math.hypot(cam.x - lt[0], cam.y - lt[1], cam.z - lt[2]), d = S.scene.fog.density;
  const r = { state: g.state, w: g.weights, wl: g.wLocal, h: g.h, density: d, color: S.scene.fog.color.getHexString(), depth, T: Math.exp(-d * d * depth * depth) };
  if (grey) {
    S.renderer.render(S.scene, S.camera); const gl = S.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const c = new T.Color(); S.scene.fog.color.getRGB(c, T.SRGBColorSpace); const fc = [c.r, c.g, c.b].map(v => Math.round(v * 255)); let n = 0;
    for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - fc[0]) <= 10 && Math.abs(px[i + 1] - fc[1]) <= 10 && Math.abs(px[i + 2] - fc[2]) <= 10) n++;
    r.grey = n / (W * H);
  }
  return r;
}, [v, grey]);
{
  const PITCH = [0.25, 0.5, 0.8, 1.2], DIST = [35, 65, 100, 160], YAW = [2.5, 2.5 + Math.PI], STATES = ['rain', 'after', 'fog', 'clear'];
  let ok = true, minT = { T: 2 }, nanN = 0, lockBad = [], drift = 0, n = 0; const L = [], greyRows = [];
  for (const st of STATES) {
    await page.evaluate(s => window.__scene.weather.lock(s), st);
    for (const yaw of YAW) {
      const grid = []; for (const pitch of PITCH) for (const dist of DIST) grid.push({ pitch, dist });
      const fwd = [], back = [];
      for (const q of grid) fwd.push(await sample({ mapMode: 'flat', target, yaw, ...q }, st === 'fog' && yaw === YAW[0]));
      for (const q of [...grid].reverse()) back.unshift(await sample({ mapMode: 'flat', target, yaw, ...q }, false));
      grid.forEach((q, i) => {
        const a = fwd[i], b = back[i]; n++;
        if (!Number.isFinite(a.density) || !Number.isFinite(b.density)) nanN++;
        if (a.state !== st || !(a.w[st] > 0.999)) lockBad.push(`${st}→${a.state}`);
        if (a.density !== b.density || a.color !== b.color) drift++;
        if (a.T < minT.T) minT = { ...a, st, yaw, ...q };
        if (a.grey !== undefined) greyRows.push(`p${q.pitch}/d${q.dist}: h ${f(a.h, 1)} wl ${f(a.wl, 2)} 密度 ${f(a.density, 4)} T ${f(a.T)} 灰 ${f(a.grey * 100, 1)}%`);
      });
    }
  }
  ok = minT.T >= 0.195 && nanN === 0 && lockBad.length === 0 && drift === 0;
  L.push(`LM08 目标 [${target.map(v => f(v, 1))}]，天气时间 600 s；${n} 个机位（4 天气 × 2 方向 × 4 俯仰 × 4 距离），每个机位正向与反向各一次`);
  L.push(`目标处最小透射率 ${f(minT.T)}（${minT.st}, pitch ${minT.pitch}, dist ${minT.dist}, yaw ${f(minT.yaw, 2)}：密度 ${f(minT.density, 4)}，深度 ${f(minT.depth, 1)} m，h ${f(minT.h, 1)}）；门槛 0.2`);
  L.push(`锁定未生效 ${lockBad.length}${lockBad.length ? '（' + [...new Set(lockBad)].join('、') + '）' : ''}；非有限密度 ${nanN}；往返密度/颜色不一致 ${drift}`);
  L.push('雾（yaw 2.5）灰色占比（报警指标，非视觉结论）：' + greyRows.join('；'));
  out(ok, 'G3 LM08 扫俯仰 × 距离 × 方向：雾中目标透射率 ≥ 0.2，锁定生效，往返无漂移', L);
}
{
  const r = await page.evaluate(t => {
    const S = window.__scene, B = S.bend; S.weather.lock('fog'); S.view.set({ mapMode: 'flat', target: t, dist: 65, yaw: 2.5, pitch: 0.5 }); window.__step(1);
    const rec = () => { const g = S.weather.get(); return { u: B.get(), dry: g.dry, density: S.scene.fog.density, color: S.scene.fog.color.getHexString(), weather: S.bend.weatherFogUniform ? S.bend.weatherFogUniform.value : null }; };
    const out = []; for (const u of [0, 0.5, 1, 0]) { B.set(u); window.__step(1); out.push(rec()); } return out;
  }, target);
  const [a, h, s, b] = r, ok = s.density === 0 && s.dry === 0 && h.density < a.density && h.density > 0 && b.density === a.density && b.color === a.color && (a.weather === null || s.weather === 0);
  out(ok, 'G4 雾中切弯曲 0 / 0.5 / 1 / 0：随 uBend 淡出，球形无雾，回平面逐值恢复', r.map(q => `u ${q.u}：dry ${f(q.dry, 2)} 密度 ${f(q.density, 4)} 颜色 #${q.color}${q.weather !== null ? ` 天气雾 ${f(q.weather, 4)}` : ''}`));
}
if (args.includes('--ablation')) {
  const r = await page.evaluate(t => {
    const S = window.__scene, T = window.THREE, sc = S.scene; S.weather.lock('fog'); S.view.set({ mapMode: 'flat', target: t, dist: 65, yaw: 2.5, pitch: 0.5 }); window.__step(1);
    const gl = S.renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, c = new T.Color(); sc.fog.color.getRGB(c, T.SRGBColorSpace); const fc = [c.r, c.g, c.b].map(v => Math.round(v * 255));
    const grab = () => { S.renderer.render(sc, S.camera); const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    const grey = px => { let n = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - fc[0]) <= 10 && Math.abs(px[i + 1] - fc[1]) <= 10 && Math.abs(px[i + 2] - fc[2]) <= 10) n++; return n / (W * H); };
    const diff = (a, b) => { let n = 0, mx = 0; for (let i = 0; i < a.length; i += 4) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > 2) n++; mx = Math.max(mx, d); } return { n, mx }; };
    const base = grab(), rows = [{ name: '原样', grey: grey(base), d: { n: 0, mx: 0 }, density: sc.fog.density }];
    const hide = (name, fn) => { const undo = fn(); const px = grab(); undo(); rows.push({ name, grey: grey(px), d: diff(base, px) }); };
    hide('雾密度 0（直接渲染）', () => { const d = sc.fog.density; sc.fog.density = 0; return () => { sc.fog.density = d; }; });
    for (const [label, name] of [['隐藏光池', 'streetlights:pool'], ['隐藏海面', 'ocean:water'], ['隐藏海岸墨线', 'ocean:coast'], ['隐藏林缘墨线', 'cover:ink:forest-edge']]) hide(label, () => { const o = sc.getObjectByName(name); if (!o) return () => {}; const v = o.visible; o.visible = false; return () => { o.visible = v; }; });
    const after = grab(), back = diff(base, after); return { rows, back, fc };
  }, target);
  out(r.back.n === 0, '消融（LM08 雾，pitch 0.5 dist 65 yaw 2.5；诊断数字，非门槛）', [...r.rows.map(q => `${q.name}：灰色占比 ${f(q.grey * 100, 1)}%，与原样差异像素 ${q.d.n}（最大 ${q.d.mx}）${q.density !== undefined ? `，密度 ${f(q.density, 4)}` : ''}`), `雾色 sRGB [${r.fc}]；恢复后与原样差异像素 ${r.back.n}`]);
}
await page.evaluate(() => { const Wx = window.__scene.weather; Wx.lock(null); Wx.setTime(null); });
await page.close();
if (errors.length) { console.log('page errors:', errors.slice(0, 5).join(' | ')); fails.push('page errors'); }
await browser.close();
console.log(fails.length ? `FAIL fog_view_check：${fails.join('；')}` : `PASS fog_view_check（${results.length} 项）`);
process.exitCode = fails.length ? 1 : 0;
