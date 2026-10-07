// W8e-b checks: the flat map's seam at -85 deg and its edge fog (docs/world/W8_SPEC.md 11.2, D11). Run after build.py.
//   node tools/seam_check.mjs [--shots] [--perf]
//   C1  every planet mesh / line set that follows the seam shift: no triangle or segment has vertices with different shifts (nothing reaches across the map);
//       no vertex at or beyond the second seam (x >= SEAM + 2 pi R); the cut counts
//   C2  bridge T01-13: the deck faces and ink are cut exactly at the seam (west copy SEAM - EPS, east copy SEAM); on the sphere (uBend = 1) the two copies of every cut point
//       land within 1 mm of each other (no crack); in the flat map the west part is drawn at the east end
//   C3  edge fog (CPU mirror of the shader term): 1 at both seam edges, 0 from 12 deg of longitude inside, 0 below 80 deg, 1 from 84.5 deg; LM07's north edge (81.1 deg) thin;
//       0 everywhere in the town; the GPU agrees (rendered edge pixel = background colour, town pixel unchanged with the fog off)
//   C4  target bounds: flat x clamps to [SEAM, SEAM + 2 pi R], latitude +-80 deg; sphere wraps into the same range
//   --shots  docs/world/w8e/: edge-west, edge-east, edge-north, edge-south, seam-bridge (flat west edge | flat east edge | sphere at the seam), lm07 (1280 x 800)
//   --perf   draw calls, triangles and one-frame render time (SwiftShader) of the default view and the whole flat map
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2);
const fails = [], out = (ok, name, lines) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); };
const browser = await launchChromium(), errors = [];
async function open(w = 1280, h = 800) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT); await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__scene && window.__scene.transition, null, { timeout: 120000 }); await page.evaluate(() => window.__step(3)); return page;
}
const page = await open();
// build everything that exists on the planet (the flat map's explore view builds the same set)
await page.evaluate(() => { const S = window.__scene; S.weather.lock('clear'); S.terrain.buildRest(); S.roads.ensure(); S.ocean.ensure(); S.cover.ensure(); S.landmarks.build(); S.view.set({ target: [-120, 1.2, 22], dist: 60 }); window.__step(3); });

// ---- C1
{
  const r = await page.evaluate(() => {
    const S = window.__scene, B = S.bend, v = new THREE.Vector3(), rows = {}; let prims = 0, mixed = 0, beyond = 0, objects = 0; const bad = [];
    S.scene.traverse(o => {
      if (!(o.isMesh || o.isLineSegments) || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position) return;
      const ud = o.material && o.material.userData || {}; if (ud.noBend || ud.noWrap) return;
      const g = o.geometry, pos = g.attributes.position, idx = g.index ? g.index.array : null, cnt = idx ? idx.length : pos.count, per = o.isLineSegments ? 2 : 3; o.updateMatrixWorld();
      const k = new Float64Array(pos.count); for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); k[i] = B.shift(v.x); if (v.x >= B.SEAM + B.PERIOD) beyond++; }
      objects++;
      for (let t = 0; t + per <= cnt; t += per) { prims++; const a = k[idx ? idx[t] : t]; for (let q = 1; q < per; q++) if (k[idx ? idx[t + q] : t + q] !== a) { mixed++; if (bad.length < 5) bad.push(o.name || o.type); break; } }
    });
    return { objects, prims, mixed, beyond, bad, stats: { ...B.seamStats, skipped: B.seamStats.skipped.slice(0, 5) } };
  });
  out(r.mixed === 0 && r.beyond === 0 && !r.stats.skipped.length, 'W8e-b C1 接缝两侧无跨越图元（物件按整段平移）', [
    `跟随平移的网格/线 ${r.objects} 个、图元 ${r.prims}：顶点平移量不一致的图元 ${r.mixed} 个${r.bad.length ? '（' + r.bad.join('、') + '）' : ''}；位于第二条接缝（x ≥ ${(-133.518 + 565.487).toFixed(1)} m）及以东的顶点 ${r.beyond} 个`,
    `构建时沿接缝切开：网格 ${r.stats.meshes} 个、线组 ${r.stats.lines} 个，切开三角形 ${r.stats.trianglesCut}、线段 ${r.stats.segmentsCut}；因世界矩阵非单位或多材质而跳过 ${r.stats.skipped.length} 个`,
    '实例化物件按实例原点整体平移、点按点平移（不需要切）；雨丝与雪粒子在显示坐标里围绕目标点生成（noWrap），不平移']);
}
// ---- C2
{
  const r = await page.evaluate(() => {
    const S = window.__scene, B = S.bend, west = Math.fround(B.SEAM - B.EPS), meshes = S.roads.objects.strips.filter(m => /T01-13/.test(m.name)), lines = S.roads.objects.lines.bridge;
    let cutW = 0, cutE = 0, worst = 0, pairs = 0; const v = new THREE.Vector3();
    for (const m of meshes) { const p = m.geometry.attributes.position, W = [], E = [];
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (x === west) W.push(i); else if (x === B.SEAM) E.push(i); }
      cutW += W.length; cutE += E.length;
      for (const i of W) { let best = 1e9; const a = B.point(p.getX(i), p.getY(i), p.getZ(i), 1); for (const j of E) { const b = B.point(p.getX(j), p.getY(j), p.getZ(j), 1); best = Math.min(best, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); } if (best < 1) { worst = Math.max(worst, best); pairs++; } } }
    let lineW = 0, lineE = 0; for (const l of lines) { const p = l.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (x === west) lineW++; else if (x === B.SEAM) lineE++; } }
    const ids = S.roads.data().bridges.find(b => b.def.id === 'T01-13'), s0 = ids.samples[0], q = window.WORLD.lonLatToTown(s0.lon, s0.lat);
    return { faces: meshes.length, cutW, cutE, pairs, worst, lineW, lineE, westStart: q.x, westStartShown: B.wrapX(q.x) };
  });
  out(r.faces >= 6 && r.cutW > 0 && r.cutW === r.cutE && r.pairs === r.cutW && r.worst < 1e-3 && r.lineW > 0 && r.lineW === r.lineE && r.westStartShown > 380, 'W8e-b C2 桥 T01-13 在接缝处按段平移、球面上无裂缝', [
    `桥面 ${r.faces} 个面：接缝处切点 西侧副本 ${r.cutW} 个（x = 接缝 − 0.2 mm）、东侧副本 ${r.cutE} 个（x = 接缝）；墨线切点 ${r.lineW} / ${r.lineE}`,
    `uBend = 1 时每对切点的球面距离最大 ${(r.worst * 1000).toFixed(3)} mm（< 1 mm），${r.pairs} 对`,
    `西桥头 J-W2 平面 x = ${r.westStart.toFixed(1)} m，显示在 x = ${r.westStartShown.toFixed(1)} m（东端；桥西段整体平移 2πR）`]);
}
// ---- C3
{
  const r = await page.evaluate(() => {
    const S = window.__scene, B = S.bend, W = window.WORLD, z = lat => W.lonLatToTown(0, lat).z, x = lon => W.lonLatToTown(lon, 0).x;
    const at = (lon, lat) => B.edgeAt(B.wrapX(x(lon)), z(lat));
    let town = 0; for (let i = -48; i <= 48; i += 4) for (let j = -48; j <= 48; j += 4) town = Math.max(town, B.edgeAt(i, j));
    return { west: B.edgeAt(B.SEAM, 0), east: B.edgeAt(B.SEAM + B.PERIOD - 1e-6, 0), in12w: at(-73, 0), in12e: at(-97, 0), in6: at(-79, 0), lat80: at(0, 80), lat79: at(0, 79.9), lat845: at(0, 84.5), lat85: at(0, 85), lm07: at(100, 81.1), lm07c: at(100, 76), south80: at(0, -80), south845: at(0, -84.5), town };
  });
  out(r.west === 1 && r.east > 0.999 && r.in12w < 1e-9 && r.in12e < 1e-9 && r.in6 > 0.3 && r.in6 < 0.7 && r.lat80 === 0 && r.lat79 === 0 && r.lat845 === 1 && r.lat85 === 1 && r.south845 === 1 && r.south80 === 0 && r.lm07 > 0.05 && r.lm07 < 0.3 && r.lm07c === 0 && r.town === 0, 'W8e-b C3 边缘雾取值（按世界坐标，平面模式）', [
    `东西：西接缝 ${r.west}、东接缝 ${r.east.toFixed(4)}；向内 6° ${r.in6.toFixed(3)}，向内 12° 西 ${r.in12w.toFixed(6)} / 东 ${r.in12e.toFixed(6)}`,
    `南北：79.9° ${r.lat79}、80° ${r.lat80}、84.5° ${r.lat845}、85° ${r.lat85}；南 80° ${r.south80}、南 84.5° ${r.south845}`,
    `LM07：北缘 81.1° 雾值 ${r.lm07.toFixed(3)}（薄雾中可见），中心 76° ${r.lm07c}；城镇（|x|、|z| ≤ 48）最大 ${r.town}`,
    '强度乘 (1 − uBend)：球形模式无边缘雾；加法混合材质按 (1 − 雾) 变暗，其余混到背景色']);
  // GPU: a pixel right at the west seam (edge fog opaque) is the background; the town frame does not change when the edge fog is switched off
  const g = await page.evaluate(() => {
    const S = window.__scene, B = S.bend, gl = S.renderer.getContext(), px = (x, y) => { const d = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, d); return [...d.slice(0, 3)]; };
    const bg = S.scene.background.clone(), c = new THREE.Color(); bg.getRGB(c, S.renderer.outputColorSpace); const want = [c.r, c.g, c.b].map(v => Math.round(v * 255));
    S.view.set({ target: [B.SEAM + 0.5, 1.2, -40], dist: 30, yaw: 0, pitch: 1.57 }); window.__step(3); S.renderer.render(S.scene, S.camera); const w = S.renderer.domElement.width, h = S.renderer.domElement.height, X = [w / 2 - 40, w / 2 - 12].map(Math.round), Y = Math.round(h / 2);
    const edge = [px(X[0], Y), px(X[1], Y)]; B.setEdgeFog(false); S.renderer.render(S.scene, S.camera); edge.push(px(X[1], Y)); B.setEdgeFog(true);
    S.view.set({ target: [-7, 1.2, 20], dist: 34, yaw: 2.5, pitch: 0.5 }); window.__step(3); S.renderer.render(S.scene, S.camera); const a = S.renderer.domElement.toDataURL();
    B.setEdgeFog(false); S.renderer.render(S.scene, S.camera); const b = S.renderer.domElement.toDataURL(); B.setEdgeFog(true);
    return { edge, want, same: a === b };
  });
  const dd = p => Math.max(...p.map((v, i) => Math.abs(v - g.want[i]))), [dOut, dIn, dFar] = g.edge.map(dd);
  out(dOut <= 2 && dIn <= 2 && dFar > 4 && g.same, 'W8e-b C3 GPU：接缝内外都是背景色（雾遮住了接缝处的海面）、城镇帧不受边缘雾影响', [`西接缝外 1 m 像素 ${g.edge[0].join(',')}、接缝内 0.2 m 像素 ${g.edge[1].join(',')}（关掉边缘雾时同一像素 ${g.edge[2].join(',')}）；背景 ${g.want.join(',')}（差 ${dOut} / ${dIn} / 关雾 ${dFar}）；城镇帧关闭边缘雾前后逐字节相同：${g.same}`]);
}
// ---- C4
{
  const r = await page.evaluate(() => {
    const S = window.__scene, T = S.transition, W = window.WORLD, res = {};
    T.setMode('flat'); T.step(3);
    S.view.set({ target: [0, 1.2, 0], yaw: 0, dist: 25 }); for (let i = 0; i < 2000; i++) S.view.pan(-200, -200); res.ne = S.view.get().target;
    for (let i = 0; i < 4000; i++) S.view.pan(200, 200); res.sw = S.view.get().target;
    T.setMode('sphere'); T.step(3); S.view.set({ target: [T.xMax - 0.5, 1.2, 0], yaw: 0 }); S.view.pan(-100, 0); res.wrap = S.view.get().target;
    T.setMode('flat'); T.step(3);
    res.lim = { x0: T.xMin, x1: T.xMax, z: T.limitZ, z80: Math.abs(W.lonLatToTown(0, 80).z) };
    return res;
  });
  const L = r.lim, ok = Math.abs(r.ne[0] - L.x1) < 1e-9 && Math.abs(Math.abs(r.ne[2]) - L.z) < 1e-9 && Math.abs(r.sw[0] - L.x0) < 1e-9 && Math.abs(Math.abs(r.sw[2]) - L.z) < 1e-9 && Math.abs(L.z - L.z80) < 1e-9 && r.wrap[0] >= L.x0 && r.wrap[0] < L.x0 + 5;
  out(ok, 'W8e-b C4 目标平移范围', [`平面：一角 (${r.ne[0].toFixed(3)}, ${r.ne[2].toFixed(3)})，对角 (${r.sw[0].toFixed(3)}, ${r.sw[2].toFixed(3)})；x ∈ [${L.x0.toFixed(3)}, ${L.x1.toFixed(3)}]（经度 −85°…275°），|z| ≤ ${L.z.toFixed(3)}（纬度 80°）`, `球形：东接缝前 0.5 m 向东平移后回到 x = ${r.wrap[0].toFixed(3)}（西端）`]);
}

const dir = path.join(root, 'docs/world/w8e'); fs.mkdirSync(dir, { recursive: true });
const shot = async (p, name) => { const d = await p.evaluate(() => { const S = window.__scene; S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL('image/png'); }); const f = path.join(dir, name + '.png'); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); return f; };
if (args.includes('--shots')) {
  const W = await page.evaluate(() => { const W = window.WORLD, q = (lon, lat) => { const p = W.lonLatToTown(lon, lat); return [window.__scene.bend.wrapX(p.x), p.z]; }; return { lm07: q(100, 76), north: q(10, 76.5), south: q(-20, -76.5), west: q(-72, 8), east: q(262, 8), bridgeW: q(-80.5, -13.8), bridgeE: q(-89.5, -13.8) }; });
  const V = {
    'edge-west':  { target: [W.west[0], 1.2, W.west[1]], dist: 150, yaw: Math.PI / 2, pitch: 0.62 },
    'edge-east':  { target: [W.east[0], 1.2, W.east[1]], dist: 150, yaw: -Math.PI / 2, pitch: 0.62 },
    'edge-north': { target: [W.north[0], 1.2, W.north[1]], dist: 170, yaw: 0, pitch: 0.55 },
    'edge-south': { target: [W.south[0], 1.2, W.south[1]], dist: 170, yaw: Math.PI, pitch: 0.55 },
    'lm07':       { target: [W.lm07[0], 2.5, W.lm07[1]], dist: 70, yaw: 0.35, pitch: 0.5 },
  };
  for (const [name, v] of Object.entries(V)) { await page.evaluate(v => { const S = window.__scene; S.transition.setMode('flat'); S.transition.step(3); S.view.set(v); window.__step(6); }, v); console.log('shot', path.relative(root, await shot(page, name)), JSON.stringify(v)); }
  // the bridge at the seam: the west edge, the east edge (flat, edge fog on) and the sphere at the seam
  for (const [name, v, mode] of [['seam-bridge-flat-west', { target: [W.bridgeW[0], 3, W.bridgeW[1]], dist: 45, yaw: 1.2, pitch: 0.55 }, 'flat'], ['seam-bridge-flat-east', { target: [W.bridgeE[0], 3, W.bridgeE[1]], dist: 45, yaw: -1.2, pitch: 0.55 }, 'flat'], ['seam-bridge-sphere', { target: [await page.evaluate(() => window.__scene.bend.SEAM), 3, W.bridgeW[1]], dist: 40, yaw: 0.9, pitch: 0.45 }, 'sphere']]) {
    await page.evaluate(([v, mode]) => { const S = window.__scene; S.transition.setMode(mode); S.transition.step(3); S.view.set(v); window.__step(6); }, [v, mode]); console.log('shot', path.relative(root, await shot(page, name)), mode, JSON.stringify(v));
  }
  await page.evaluate(() => { const S = window.__scene; S.transition.setMode('flat'); S.transition.step(3); });
}
if (args.includes('--perf')) {
  const p2 = await open();
  const measure = v => p2.evaluate(v => { const S = window.__scene; S.weather.lock('rain'); if (v) { S.transition.setMode(v.mode || 'flat'); S.transition.step(3); S.view.set(v); } window.__step(40); S.renderer.render(S.scene, S.camera); const t0 = Date.now(); S.renderer.render(S.scene, S.camera); S.renderer.getContext().finish(); const ms = Date.now() - t0, i = S.renderer.info.render; return { calls: i.calls, tris: i.triangles, ms }; }, v);
  const rows = [['默认视角（场景起始机位，雨锁定）', await measure(null)]];
  const mid = await p2.evaluate(() => (window.__scene.transition.xMin + window.__scene.transition.xMax) / 2);
  rows.push(['平面全图俯视（目标在图中心 x = ' + mid.toFixed(1) + '，d = 400，俯仰 1.45）', await measure({ target: [mid, 1.2, 0], dist: 400, yaw: 0, pitch: 1.45 })]);
  rows.push(['平面全图斜视（目标在城镇，d = 400，俯仰 0.9）', await measure({ target: [0, 1.2, 0], dist: 400, yaw: 0, pitch: 0.9 })]);
  rows.push(['平面西接缝（d = 150，俯仰 0.62）', await measure({ target: [-115, 1.2, -12], dist: 150, yaw: Math.PI / 2, pitch: 0.62 })]);
  rows.push(['平面东接缝（d = 150，俯仰 0.62）', await measure({ target: [413, 1.2, -12], dist: 150, yaw: -Math.PI / 2, pitch: 0.62 })]);
  for (const [n, r] of rows) console.log(`PERF ${n}：${r.calls} 次绘制调用，${r.tris} 个三角形，${r.ms} ms`);
  fs.mkdirSync(path.join(root, 'tools', 'out'), { recursive: true }); fs.writeFileSync(path.join(root, 'tools', 'out', 'seam_perf.json'), JSON.stringify(rows, null, 1));
  await p2.close();
}
if (errors.length) { console.log('page errors:', errors.slice(0, 5).join(' | ')); fails.push('page errors'); }
await browser.close();
console.log(fails.length ? `FAIL seam_check：${fails.join('；')}` : 'PASS seam_check');
process.exitCode = fails.length ? 1 : 0;
