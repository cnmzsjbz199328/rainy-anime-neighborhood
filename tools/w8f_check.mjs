// W8f-a checks (docs/world/W8_SPEC.md 12.1) and the review shots of 12.0. Run after `python3 build.py`.
//   node tools/w8f_check.mjs [--html <page>] [--only A,B] [--shots] [--only-shots] [--out <dir>]
//   A1  boardwalk T11-01: every plank's long axis at 90 +- 1 deg to the local tangent, centred on the deck (<= 0.05 m), covering +-0.95 m or more; the landing
//       covers 3.0 x 3.0 m (Node, from roadkit.build with world.js heights)
//   B1  the town on the sphere has no holes: sphere mode, magenta sky, 24 deterministic cameras (target inside the town, d 9-80, any yaw, pitch 0.2-1.4). For every pixel
//       the camera ray is intersected with the sphere (radius R, centre (0, -R, 0)); a pixel whose hit lies inside the town patch (flat |x|, |z| <= 47) must not show the sky
//       (magenta within 120 levels): at most 0.02 % of all pixels. Run the same tool with --html on the pre-w8f-a page for the comparison (no new hooks are used).
//   B3  sphere copies of the town (W8f-a hook window.__scene.town.sphere): objects, triangles and segments before / after, first build time; draw calls and triangles of
//       the default view (2374 / 239958) and of a sphere view of the town
//   --shots  docs/world/w8f/ (or --out): the 12.0 cameras (bw-*, je1-*, jt04-*, je2-*, n03-*, town-*), the four other abutments and four junctions from above, day-town
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const html = path.resolve(arg('--html') || path.join(root, 'index.html')), outDir = path.resolve(arg('--out') || path.join(root, 'docs/world/w8f'));
const only = arg('--only') ? arg('--only').split(',') : null, want = k => !args.includes('--only-shots') && (!only || only.includes(k));
const fails = [], out = (ok, name, lines) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); };
const f = (x, n = 2) => (+x).toFixed(n);

// ---------------------------------------------------------------- A1 (Node)
if (want('A')) {
  const require = createRequire(import.meta.url);
  globalThis.LAYOUT = require(path.join(root, 'layout.js'));
  const W = require(path.join(root, 'world.js')), RK = require(path.join(root, 'roadkit.js')), D = Math.PI / 180, R = 90;
  const b = RK.build(W, 'T11-01'), C = b.centre, planks = b.instances.plank || [], n = C.length;
  const flat = p => ({ x: R * p.lon * D, z: -R * Math.asinh(Math.tan(p.lat * D)) });
  const near = p => { let bi = 0, bd = Infinity; C.forEach((q, i) => { const d = W.arcDistance(p, q); if (d < bd) { bd = d; bi = i; } }); return { i: bi, d: bd }; };
  const deck = planks.filter(p => p.s[0] === 1), land = planks.filter(p => p.s[0] !== 1);
  let worstA = 0, worstC = 0;
  for (const p of deck) {
    const { i, d } = near(p), a = flat(C[Math.max(0, i - 1)]), c = flat(C[Math.min(n - 1, i + 1)]), tx = c.x - a.x, tz = c.z - a.z, l = Math.hypot(tx, tz);
    const ax = [Math.cos(p.yaw), -Math.sin(p.yaw)], ang = Math.acos(Math.min(1, Math.abs(ax[0] * tx + ax[1] * tz) / l)) / D;
    worstA = Math.max(worstA, Math.abs(90 - ang)); worstC = Math.max(worstC, d);
  }
  const half = 1.0 * deck[0].s[0];              // plank geometry 2.0 x 0.08 x 0.27 m (flora.js), long axis = local x
  // landing: 10 planks 1.5 x 2.0 m long across, 0.27 m wide, every 0.32 m beyond the last sample
  const lb = b.landing, along = land.map(p => W.arcDistance(lb, p)), acrossLen = 2.0 * land[0].s[0], alongLen = Math.max(...along) - Math.min(...along) + 0.27;
  const lAng = land.map(p => { const a = flat(lb), c = flat(W.destination(lb, lb.brg, 1)), tx = c.x - a.x, tz = c.z - a.z, ax = [Math.cos(p.yaw), -Math.sin(p.yaw)]; return Math.abs(90 - Math.acos(Math.min(1, Math.abs(ax[0] * tx + ax[1] * tz) / Math.hypot(tx, tz))) / D); });
  const ok = worstA <= 1 && worstC <= 0.05 && half >= 0.95 && acrossLen >= 3.0 - 1e-9 && alongLen >= 3.0 && Math.max(...lAng) <= 1;
  out(ok, 'W8f-a A1 栈道 T11-01：板子长轴与切线成 90° ± 1°、居中、横向覆盖 ±0.95 m；末端平台 ≥ 3.0 × 3.0 m', [
    `桥面板 ${deck.length} 块：长轴与当地切线夹角偏离 90° 最大 ${f(worstA, 3)}°，板中心离中线最大 ${f(worstC, 3)} m，板长 ${f(2 * half, 2)} m（横向覆盖 ±${f(half, 2)} m）`,
    `末端平台 ${land.length} 块：横向 ${f(acrossLen, 2)} m × 顺向 ${f(alongLen, 2)} m，长轴偏离 90° 最大 ${f(Math.max(...lAng), 3)}°`]);
}

// ---------------------------------------------------------------- browser parts
const needBrowser = want('B') || args.includes('--shots') || args.includes('--only-shots');
if (needBrowser) {
  const { launchChromium } = await import('./browser.mjs');
  const { INIT } = await import('./road_views.mjs');
  const browser = await launchChromium(), errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(html).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__scene && window.__scene.transition, null, { timeout: 120000 });
  const def = await page.evaluate(() => { const S = window.__scene; window.__step(3); S.renderer.render(S.scene, S.camera); return { calls: S.renderer.info.render.calls, tri: S.renderer.info.render.triangles }; });

  // the sky colour of a sphere frame becomes magenta for B1 and the magenta shot (scene.onBeforeRender after daylight.js; daylight.js restores the background afterwards)
  await page.evaluate(() => { const sc = window.__scene.scene, prev = sc.onBeforeRender; window.__magenta = false; sc.onBeforeRender = function () { const r = prev.apply(this, arguments); if (window.__magenta && sc.background && sc.background.isColor) sc.background.setHex(0xff00ff); return r; }; });

  if (want('B')) {
    const t0 = Date.now();
    const r = await page.evaluate(() => {
      const S = window.__scene, R = 90, THREE = window.THREE; S.weather.lock('clear'); S.transition.setMode('sphere'); S.transition.step(3); window.__magenta = true;
      let s = 81275; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const cv = document.createElement('canvas'), W = S.renderer.domElement.width, H = S.renderer.domElement.height; cv.width = W; cv.height = H; const q = cv.getContext('2d', { willReadFrequently: true });
      const rows = [], v = new THREE.Vector3(); let bad = 0, inPatch = 0, all = 0, worst = null;
      for (let k = 0; k < 24; k++) {
        const view = { target: [-40 + 80 * rnd(), 1.2, -40 + 80 * rnd()], dist: 9 + 71 * rnd(), yaw: rnd() * 6.283, pitch: 0.2 + 1.2 * rnd() };
        S.view.set(view); window.__step(10); S.renderer.render(S.scene, S.camera); q.drawImage(S.renderer.domElement, 0, 0); const px = q.getImageData(0, 0, W, H).data;
        const cam = S.camera, P0 = cam.position.clone(); let nb = 0, np = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          v.set((x + 0.5) / W * 2 - 1, 1 - (y + 0.5) / H * 2, 0.5).unproject(cam).sub(P0).normalize();
          // ray P0 + t v against the sphere |P - C| = R, C = (0, -R, 0)
          const ox = P0.x, oy = P0.y + R, oz = P0.z, b = ox * v.x + oy * v.y + oz * v.z, c = ox * ox + oy * oy + oz * oz - R * R, disc = b * b - c; if (disc < 0) continue;
          const t = -b - Math.sqrt(disc); if (t <= 0) continue;
          const hx = ox + t * v.x, hy = oy + t * v.y, hz = oz + t * v.z, lam = Math.atan2(hx, hy), phi = Math.asin(Math.max(-1, Math.min(1, -hz / R))), fx = R * lam, fz = R * Math.asinh(-Math.tan(phi));
          if (Math.abs(fx) > 47 || Math.abs(fz) > 47) continue;
          np++; const i = (y * W + x) * 4; if (Math.abs(px[i] - 255) + px[i + 1] + Math.abs(px[i + 2] - 255) < 120) nb++;
        }
        bad += nb; inPatch += np; all += W * H; rows.push({ k, ...view, nb, np, share: nb / (W * H) }); if (!worst || nb > worst.nb) worst = rows[rows.length - 1];
      }
      window.__magenta = false;
      return { rows, bad, inPatch, all, worst };
    });
    const share = r.bad / r.all;
    out(share <= 0.0002, 'W8f-a B1 球形城镇地面无洞（洋红背景、24 个确定性机位、像素射线与球解析求交）', [
      `页面 ${path.relative(root, html) || html}：落在城镇补丁（|x|、|z| ≤ 47）内的像素 ${r.inPatch}/${r.all}，其中显示背景色的 ${r.bad} 个 = ${f(share * 100, 4)}%（上限 0.02%），用时 ${Date.now() - t0} ms`,
      `最差机位 #${r.worst.k}（target ${r.worst.target.map(v => f(v, 1)).join(', ')}，d ${f(r.worst.dist, 1)}，yaw ${f(r.worst.yaw, 2)}，pitch ${f(r.worst.pitch, 2)}）：${r.worst.nb} 个像素`,
      `每个机位的失败像素：${r.rows.map(q => q.nb).join(' ')}`]);
    const st = await page.evaluate(() => { const S = window.__scene, T = S.town && S.town.sphere && S.town.sphere.built; if (!T) return null;
      S.view.set({ target: [0, 1.2, 0], dist: 45, yaw: -0.97, pitch: 0.7 }); window.__step(10); S.renderer.render(S.scene, S.camera); const sp = { calls: S.renderer.info.render.calls, tri: S.renderer.info.render.triangles };
      T.use(false); S.renderer.render(S.scene, S.camera); const flat = { calls: S.renderer.info.render.calls, tri: S.renderer.info.render.triangles }; T.use(true);
      return { ...T.stats, sp, flat }; });
    if (st) out(st.trianglesAfter - st.trianglesBefore <= 150000 && def.calls === 2374 && def.tri === 239958, 'W8f-a B3 球面城镇细分的代价', [
      `细分对象：网格 ${st.meshes}、墨线 ${st.lines}（在 ${st.objects} 个城镇对象中）；三角形 ${st.trianglesBefore} → ${st.trianglesAfter}（+${st.trianglesAfter - st.trianglesBefore}，目标 ≤ 15 万）；线段 ${st.segmentsBefore} → ${st.segmentsAfter}（+${st.segmentsAfter - st.segmentsBefore}）`,
      `首次生成 ${st.ms} ms（SwiftShader，进入球形时一次）；最长边 ≤ ${st.maxEdge} m（R = 90 时弦下沉 ≤ ${f(st.maxEdge ** 2 / 720 * 100, 1)} cm）`,
      `默认视角（平面、细分前）${def.calls} 次绘制调用 / ${def.tri} 三角形（要求 2374 / 239958）；球形城镇 town-sphere-aerial：${st.sp.calls} / ${st.sp.tri}，同一帧换回平面几何 ${st.flat.calls} / ${st.flat.tri}（细分增量 ${st.sp.tri - st.flat.tri} 三角形）`]);
    else out(true, 'W8f-a B3（此页面没有 W8f-a 细分钩子，跳过）', [`默认视角 ${def.calls} / ${def.tri}`]);
  }

  if (args.includes('--shots') || args.includes('--only-shots')) {
    fs.mkdirSync(outDir, { recursive: true });
    // 12.0 cameras (shared with W8f-b) and the extra views of W8f-a: the other four abutments and the four junctions from above (target the node, yaw along the road)
    const V = [
      ['bw-flat-ground', 'flat', -1.9, 89.0, -3.10, 5, 0.28], ['bw-flat-top', 'flat', -1.6, 102.0, -2.34, 9, 1.25], ['bw-sphere-ground', 'sphere', -1.9, 89.0, -3.10, 9, 0.30],
      ['je1-sphere-aerial', 'sphere', 60.5, 15.0, -1.59, 28, 0.62], ['je1-sphere-close', 'sphere', 64.5, 15.0, -1.60, 11, 0.45], ['je1-flat-aerial', 'flat', 60.5, 15.0, -1.59, 28, 0.62],
      ['jt04-sphere-aerial', 'sphere', 60.5, 15.0, -0.67, 22, 0.80], ['je2-sphere-aerial', 'sphere', 127.2, 15.0, 1.60, 28, 0.62], ['n03-sphere-aerial', 'sphere', 52.5, 15.0, 1.57, 26, 0.60],
      ['town-sphere-aerial', 'sphere', 0, 0, -0.97, 45, 0.70], ['town-sphere-aerial-magenta', 'sphere', 0, 0, -0.97, 45, 0.70, true],
      ['day-town', 'sphere', 'w8e-day-town'],
    ];
    const nodes = [['abut-je3-top', 'J-E3', 1], ['abut-jw3-top', 'J-W3', -1], ['abut-jw2-top', 'J-W2', 1], ['abut-jw1-top', 'J-W1', -1], ['junction-jt07-top', 'J-T07', 0], ['junction-jt08-top', 'J-T08', 0], ['junction-jt09-top', 'J-T09', 0], ['junction-lm09-top', 'LM09-north', 0]];
    const list = [];
    for (const v of V) list.push(v);
    for (const [name, id, side] of nodes) for (const mode of ['sphere', 'flat']) list.push([name.replace('-top', `-${mode}-top`), mode, { node: id, side }]);
    for (const v of list) {
      const url = await page.evaluate(v => {
        const S = window.__scene, W = window.WORLD, [name, mode] = v; S.weather.lock('clear'); S.transition.setMode(mode); S.transition.step(3);
        if (v[2] === 'w8e-day-town') S.view.set({ target: [-7, 1.2, 20], dist: 60, yaw: 2.5, pitch: 0.7 });          // the camera of docs/world/w8e/day-town.png (day_check --shots)
        else if (typeof v[2] === 'object') { const nd = W.roadNetwork.nodeById[v[2].node], p = W.lonLatToTown(nd.lon, nd.lat), side = v[2].side;
          // look along the trunk road from 14 m before the node (side 1: the bridge is east of the node, -1: west), nearly from above
          S.view.set({ target: [p.x + side * 4, 1.2, p.z], dist: 30, yaw: side >= 0 ? -1.571 : 1.571, pitch: 1.15 }); }
        else S.view.set({ target: [v[2], 1.2, v[3]], dist: v[5], yaw: v[4], pitch: v[6] });
        window.__magenta = !!v[7]; window.__step(10); S.renderer.render(S.scene, S.camera); const u = S.renderer.domElement.toDataURL('image/png'); window.__magenta = false; return u;
      }, v);
      fs.writeFileSync(path.join(outDir, v[0] + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    }
    console.log(`截图 ${list.length} 张 → ${path.relative(root, outDir)}/`);
  }
  if (errors.length) out(false, '页面错误', errors.slice(0, 5));
  await browser.close();
}
console.log(fails.length ? `\nFAIL w8f_check：${fails.join('；')}` : '\nPASS w8f_check');
process.exitCode = fails.length ? 1 : 0;
