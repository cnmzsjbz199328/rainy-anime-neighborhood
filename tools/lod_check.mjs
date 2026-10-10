// W8g-c C3 (W8_SPEC 13.3): checks of the near / far display of the land cover. Run after `python3 build.py`:
//   node tools/lod_check.mjs [--base pre-w8g-c] [--only L1,L2,L3,L4] [--steps 150]
//   L1 scale: every drawn instance's matrix scale = instance table scale x the flat factor k = 1/cos(lat) (relative error <= 1e-6); canopy groups at their own fixed scale
//   L2 path independence: one camera reached by two paths gives the same instance buffers (counts, matrices, colours, dither windows, table indices)
//   L3 dolly: forest, farmland, grassland x flat night, sphere day; d = 9 -> 400 m in 150 geometric steps, the mean pixel difference between neighbouring steps
//      (fixed clock, clear weather, SwiftShader); peak / median against the same sequence of the base build (must fall below 50 % of it); contact sheets of the
//      hand-over frames in docs/world/w8g/lod/; the ink hull's width at the near -> far hand-over (<= 1 px wherever the hulls show, ruling 2)
//   --veg adds, for reference, the same dolly measured on the vegetation layer alone (each step rendered with and without the land cover; the step-to-step change
//      of their difference), which separates the hand-overs from the camera's own motion
//   L4 performance: the six views of tools/perf_baseline.mjs (docs/world/perf/w8g-d.json, the tier under test, else w8g-c.json; pre-w8g-c.json for the
//      comparison): median <= 17 ms, p95 <= 25 ms
//   D3 (W8g-d): the six views at identical cameras in both tiers (?quality=high / low): the low tier's land cover triangles <= 60 % of high's, its draw calls <= high's
// The tier under test is QUALITY (tools/browser.mjs puts it in every page; default high).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium, QUALITY_TIER } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const VEG = args.includes('--veg'), baseRef = arg('--base', 'pre-w8g-c'), only = arg('--only', 'L1,L2,L3,L4,D3').split(','), STEPS = +arg('--steps', 150), outDir = path.join(root, 'docs/world/w8g/lod');
const FARM = [-71.8 / 90 * 180 / Math.PI, Math.atan(Math.sinh(12.3 / 90)) * 180 / Math.PI];      // the places of tools/distant_check.mjs
const PLACES = [['forest', -15, -40], ['farm', FARM[0], FARM[1]], ['grass', 90, -42]];
const MODES = [['flat', 0.6], ['sphere', 1.0]];                                                  // [mode, pitch]
const results = []; let errors = [];
const report = (id, ok, title, lines = []) => { results.push({ id, ok }); console.log(`${ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL'} ${id} ${title}`); for (const l of lines) console.log('  · ' + l); };

const browser = await launchChromium();
async function open(file, query = '') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }); page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT); await page.goto(pathToFileURL(file).href + query, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window.__scene && window.__scene.view, null, { timeout: 180000 });
  await page.evaluate(() => { const S = window.__scene; S.weather.lock('clear'); S.cover.ensure(); S.section.ensure(); S.roads.ensure(); if (S.ocean) S.ocean.ensure(); S.landmarks.build(); });
  return page;
}
// put the camera at a place (flat or sphere, the transition finished), run the modules' ticks at a fixed time, render once
const placeFn = `(([lo, la, d, mode, pitch]) => { const S = window.__scene, q = WORLD.lonLatToTown(lo, la); S.view.set({ target: [q.x, 1.2, q.z], dist: d, yaw: 0.4, pitch });
  S.transition.setMode(mode); S.transition.step(3); window.__step(1); const c = S.camera; for (const m of [S.cover, S.section, S.roads, S.ocean]) if (m) m.tick(1.2, c); S.renderer.render(S.scene, c); })`;

const cur = only.some(k => ['L1', 'L2', 'L3'].includes(k)) ? await open(path.join(root, 'index.html')) : null;

// ---------------------------------------------------------------- L1
if (only.includes('L1')) {
  const r = await cur.evaluate(async ([placeSrc, places, modes]) => {
    const place = eval(placeSrc), S = window.__scene, LC = window.LANDCOVER_API, items = LC.data().items, D = Math.PI / 180; let worst = 0, n = 0, groups = 0, gWorst = 0; const at = [];
    const scaleOf = (A, b) => [Math.hypot(A[b], A[b + 1], A[b + 2]), Math.hypot(A[b + 4], A[b + 5], A[b + 6]), Math.hypot(A[b + 8], A[b + 9], A[b + 10])];
    for (const [, lo, la] of places) for (const [mode, pitch] of modes) for (const d of [30, 150]) {
      place([lo, la, d, mode, pitch]);
      for (const o of Object.values(LC.objects.inst)) { const A = o.mesh.instanceMatrix.array; for (let q = 0; q < o.mesh.count; q++) { const it = items[o.idx[q]], k = 1 / Math.cos(it.lat * D), got = scaleOf(A, q * 16);
        for (let c = 0; c < 3; c++) { const want = k * it.s[c], e = Math.abs(got[c] - want) / want; if (e > worst) worst = e; } n++; } }
      const C = LC.objects.canopy; if (C) { const A = C.mesh.instanceMatrix.array, G = LC.groups(); for (let q = 0; q < C.mesh.count; q++) { const g = G[C.idx[q]], got = scaleOf(A, q * 16), want = [g.F.k * g.scale, g.F.k * 2.4, g.F.k * g.scale];
        for (let c = 0; c < 3; c++) gWorst = Math.max(gWorst, Math.abs(got[c] - want[c]) / want[c]); groups++; } }
      at.push(`${mode} d = ${d}：${Object.values(LC.objects.inst).reduce((a, o) => a + o.mesh.count, 0)}`);
    }
    return { worst, n, groups, gWorst, at };
  }, [placeFn, PLACES, MODES]);
  report('L1', r.worst <= 1e-6 && r.gWorst <= 1e-6, '缩放：可见实例的缩放 = 实例表缩放 × 平面因子（相对误差 ≤ 1e-6），树冠团为固定尺寸', [`12 个机位（3 处 × 平面 / 球形 × d = 30 / 150 m）共 ${r.n} 个实例，最大相对误差 ${r.worst.toExponential(2)}；树冠团 ${r.groups} 个，最大相对误差 ${r.gWorst.toExponential(2)}`, `每个机位的实例数：${r.at.join('、')}`]);
}

// ---------------------------------------------------------------- L2
if (only.includes('L2')) {
  const r = await cur.evaluate(async ([placeSrc, places]) => {
    const place = eval(placeSrc), S = window.__scene, LC = window.LANDCOVER_API, c = S.camera;
    const dump = () => { const out = []; for (const [k, o] of Object.entries(LC.objects.inst)) { const n = o.mesh.count; out.push([k, n, Array.from(o.mesh.instanceMatrix.array.subarray(0, n * 16)), Array.from(o.mesh.instanceColor.array.subarray(0, n * 3)), Array.from(o.win.array.subarray(0, n * 2)), Array.from(o.idx.subarray(0, n))]); }
      const C = LC.objects.canopy; if (C) { const n = C.mesh.count; out.push(['canopy', n, Array.from(C.mesh.instanceMatrix.array.subarray(0, n * 16)), Array.from(C.win.array.subarray(0, n * 2)), Array.from(C.idx.subarray(0, n))]); } return JSON.stringify(out); };
    const rows = [];
    for (const [lo, la, d, mode, pitch] of [[places[0][1], places[0][2], 30, 'flat', 0.6], [places[2][1], places[2][2], 90, 'sphere', 1.0]]) {
      place([lo, la, d, mode, pitch]); LC.reload(c); const A = dump(), pos = c.position.toArray(), quat = c.quaternion.toArray();
      // the other path: two other places in the other mode, then back; the camera is put at the first path's pose exactly
      place([places[1][1], places[1][2], 200, mode === 'flat' ? 'sphere' : 'flat', 0.8]); place([places[2][1], places[2][2], 15, 'flat', 0.5]); place([lo, la, d, mode, pitch]);
      c.position.fromArray(pos); c.quaternion.fromArray(quat); c.updateMatrixWorld(); LC.reload(c); const B = dump();
      rows.push({ mode, d, same: A === B, bytes: A.length, counts: JSON.parse(A).reduce((a, q) => a + q[1], 0) });
    }
    return rows;
  }, [placeFn, PLACES]);
  report('L2', r.every(q => q.same), '路径无关：同一相机从两条路径到达，实例缓冲（数量、矩阵、颜色、淡化窗口、实例表序号）逐位相同', r.map(q => `${q.mode} d = ${q.d}：${q.same ? '相同' : '不同'}（${q.counts} 个实例）`));
}

// ---------------------------------------------------------------- L3
if (only.includes('L3')) {
  fs.mkdirSync(outDir, { recursive: true });
  const baseFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lod-')), 'index.html'); fs.writeFileSync(baseFile, execFileSync('git', ['show', `${baseRef}:index.html`], { cwd: root, maxBuffer: 64e6 }));
  const base = await open(baseFile);
  const seq = (page, lo, la, mode, pitch, ink) => page.evaluate(async ([placeSrc, lo, la, mode, pitch, steps, ink, veg]) => {
    const place = eval(placeSrc), S = window.__scene, gl = S.renderer.getContext(), w = 1280, h = 800, buf = new Uint8Array(w * h * 4), diffs = [], thumbs = [];
    const tc = document.createElement('canvas'); tc.width = 320; tc.height = 200; const tq = tc.getContext('2d'); let prev = null, inkMax = 0, inkFrames = 0;
    const bufB = veg ? new Uint8Array(w * h * 4) : null, vegDiffs = []; let prevV = null;
    for (let i = 0; i < steps; i++) {
      const d = 9 * Math.pow(400 / 9, i / (steps - 1)); place([lo, la, d, mode, pitch]);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      if (prev) { let sum = 0; for (let k = 0; k < buf.length; k += 4) sum += Math.abs(buf[k] - prev[k]) + Math.abs(buf[k + 1] - prev[k + 1]) + Math.abs(buf[k + 2] - prev[k + 2]); diffs.push(sum / (w * h * 3)); }
      prev = buf.slice(); tq.drawImage(S.renderer.domElement, 0, 0, 320, 200); thumbs.push(tc.toDataURL('image/jpeg', 0.8));
      if (veg) { const r0 = S.cover.state.root, was = r0.visible; r0.visible = false; S.renderer.render(S.scene, S.camera); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, bufB); r0.visible = was;
        const V = new Int16Array(w * h * 3); for (let k = 0, j = 0; k < buf.length; k += 4, j += 3) { V[j] = buf[k] - bufB[k]; V[j + 1] = buf[k + 1] - bufB[k + 1]; V[j + 2] = buf[k + 2] - bufB[k + 2]; }
        if (prevV) { let sum = 0; for (let j = 0; j < V.length; j++) sum += Math.abs(V[j] - prevV[j]); vegDiffs.push(sum / V.length); } prevV = V; }
      // ruling 2: the ink at the near -> far hand-over, where the hulls show (the hull shell is uInkW in model space, scaled like the tree)
      if (ink) { const LC = window.LANDCOVER_API, T = LC.lodTable && LC.lodTable(), g = S.section.state.ink.ground; if (T && g > 0.01) { inkFrames++; const u = S.bend.get(), wW = S.section.state.ink.width, c = S.camera.position, H = S.renderer.domElement.height, PPM = H / (2 * Math.tan(S.camera.fov * Math.PI / 360)), items = LC.data().items;
        for (let q = 0; q < T.n; q++) { if (!T.far[q]) continue; const fx = T.F[q * 3], sx = fx + S.bend.shift(fx), dx = sx + (T.P[q * 3] - sx) * u - c.x, dy = T.F[q * 3 + 1] + (T.P[q * 3 + 1] - T.F[q * 3 + 1]) * u - c.y, dz = T.F[q * 3 + 2] + (T.P[q * 3 + 2] - T.F[q * 3 + 2]) * u - c.z;
          const kd = T.k[q] + (1 - T.k[q]) * u, r = Math.max(0.01, Math.hypot(dx, dy, dz)), px = T.size[q] * kd * PPM / r; if (px < 36 || px > 44) continue; const s = Math.max(...items[q].s), ipx = wW * s * kd * PPM / r; if (ipx > inkMax) inkMax = ipx; } } }
    }
    return { diffs, thumbs, inkMax, inkFrames, vegDiffs };
  }, [placeFn, lo, la, mode, pitch, STEPS, ink, VEG]);
  const stat = diffs => { const s = [...diffs].sort((a, b) => a - b), median = s[Math.floor(s.length / 2)], peak = s[s.length - 1]; return { median, peak, ratio: peak / Math.max(1e-9, median), at: diffs.indexOf(peak) + 1 }; };
  const sheet = async (name, A, B, picks) => {          // rows: base, current; columns: the picked steps
    const url = await cur.evaluate(async ([A, B, picks, name]) => { const W0 = 240, H0 = 150, c = document.createElement('canvas'); c.width = picks.length * (W0 + 2); c.height = 2 * (H0 + 16) + 18; const q = c.getContext('2d'); q.fillStyle = '#fff'; q.fillRect(0, 0, c.width, c.height); q.fillStyle = '#000'; q.font = '12px sans-serif'; q.fillText(name + '（上：基线，下：当前；列为步号与 d）', 4, 13);
      const load = async s => { const im = new Image(); im.src = s; await im.decode(); return im; };
      for (let k = 0; k < picks.length; k++) { const i = picks[k], d = 9 * Math.pow(400 / 9, i / 149); q.fillText(`#${i} d=${d.toFixed(1)}`, k * (W0 + 2) + 2, 30); q.drawImage(await load(A[i]), k * (W0 + 2), 34, W0, H0); q.drawImage(await load(B[i]), k * (W0 + 2), 34 + H0 + 16, W0, H0); }
      return c.toDataURL('image/jpeg', 0.85); }, [A, B, picks, name]);
    fs.writeFileSync(path.join(outDir, name + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
  };
  let allOk = true; const lines = [], inkLines = [], vegLines = []; let inkWorst = 0;
  for (const [name, lo, la] of PLACES) for (const [mode, pitch] of MODES) {
    const b = await seq(base, lo, la, mode, pitch, false), c = await seq(cur, lo, la, mode, pitch, true), sb = stat(b.diffs), sc = stat(c.diffs), ok = sc.ratio <= 0.5 * sb.ratio;
    allOk = allOk && ok; inkWorst = Math.max(inkWorst, c.inkMax);
    lines.push(`${name} ${mode}：基线 峰值 ${sb.peak.toFixed(3)} / 中位数 ${sb.median.toFixed(3)} = ${sb.ratio.toFixed(2)}（第 ${sb.at} 步），当前 ${sc.peak.toFixed(3)} / ${sc.median.toFixed(3)} = ${sc.ratio.toFixed(2)}（第 ${sc.at} 步），比值 ${(sc.ratio / sb.ratio * 100).toFixed(0)}%${ok ? '' : '（> 50%）'}`);
    if (VEG) { const vb = stat(b.vegDiffs), vc = stat(c.vegDiffs); vegLines.push(`${name} ${mode}：植被层 基线 峰值 ${vb.peak.toFixed(3)} / 中位数 ${vb.median.toFixed(3)} = ${vb.ratio.toFixed(2)}（第 ${vb.at} 步），当前 ${vc.peak.toFixed(3)} / ${vc.median.toFixed(3)} = ${vc.ratio.toFixed(2)}（第 ${vc.at} 步），比值 ${(vc.ratio / vb.ratio * 100).toFixed(0)}%`); }
    inkLines.push(`${name} ${mode}：显示墨线外壳的帧 ${c.inkFrames}，交接带（36–44 px）内树的墨线最大 ${c.inkMax.toFixed(2)} px`);
    // the frames around each build's three largest differences and every 30th step
    const top = d => d.map((v, i) => [v, i + 1]).sort((x, y) => y[0] - x[0]).slice(0, 3).map(q => q[1]);
    const picks = [...new Set([0, 30, 60, 90, 120, STEPS - 1, ...top(b.diffs).flatMap(i => [i - 1, i]), ...top(c.diffs).flatMap(i => [i - 1, i])])].filter(i => i >= 0 && i < STEPS).sort((x, y) => x - y);
    await sheet(`${name}-${mode}`, b.thumbs, c.thumbs, picks);
    fs.writeFileSync(path.join(outDir, `${name}-${mode}-diffs.json`), JSON.stringify({ base: b.diffs, current: c.diffs, ...(VEG ? { vegBase: b.vegDiffs, vegCurrent: c.vegDiffs } : {}) }) + '\n');
  }
  report('L3', allOk, '推拉序列：d = 9 → 400 m 150 步，相邻帧平均像素差的“峰值 / 中位数”降到基线的 50% 以下', [...lines, `联系表与逐步差值：${path.relative(root, outDir)}/`]);
  if (VEG) report('L3-veg', null, '（参考）只看植被层的推拉序列：每步有、无地表覆盖各渲染一次，二者之差的逐步变化“峰值 / 中位数”', vegLines);
  report('L3-ink', inkWorst <= 1, '远模墨线（裁决 2）：近模 → 远模交接处墨线不超过 1 px', inkLines);
  await base.close(); fs.rmSync(path.dirname(baseFile), { recursive: true, force: true });
}

// ---------------------------------------------------------------- L4
if (only.includes('L4')) {
  const read = f => { try { return JSON.parse(fs.readFileSync(path.join(root, 'docs/world/perf', f), 'utf8')); } catch { return null; } };
  const dP = read('w8g-d.json'), curP = dP && dP.tiers ? { ...dP.tiers[QUALITY_TIER], gpu: dP.gpu, commit: dP.commit, dirty: dP.dirty } : read('w8g-c.json'), baseP = read('pre-w8g-c.json');
  if (!curP || !curP.views) report('L4', false, '性能：先运行 node tools/perf_baseline.mjs --label w8g-c（与 --ref pre-w8g-c）');
  else {
    const lines = [], fails = [];
    for (const [name, v] of Object.entries(curP.views)) { const b = baseP && baseP.views ? baseP.views[name] : null, ok = v.medianMs <= 17 && v.p95Ms <= 25; if (!ok) fails.push(name);
      lines.push(`${name}：中位数 ${v.medianMs} ms、p95 ${v.p95Ms} ms，${v.calls} 次绘制调用、${v.triangles} 个三角形、${v.instances} 个实例${b ? `（基线 ${b.medianMs} / ${b.p95Ms} ms，${b.calls} 次、${b.triangles} 个三角形、${b.instances} 个实例）` : ''}${ok ? '' : ' —— 未达目标'}`); }
    lines.push(`GPU ${curP.gpu}；${curP.commit.slice(0, 7)}${curP.dirty ? '（工作区有改动）' : ''}`);
    report('L4', fails.length === 0, `性能（档位 ${QUALITY_TIER}）：6 个固定机位帧间隔中位数 ≤ 17 ms、p95 ≤ 25 ms（数据来自 docs/world/perf/${dP && dP.tiers ? 'w8g-d' : 'w8g-c'}.json）`, lines);
  }
}
// ---------------------------------------------------------------- D3
if (only.includes('D3')) {
  const VIEWS = [['forest-near-flat', -15, -40, 'flat', 12, 0, 0.45], ['farm-flat', FARM[0], FARM[1], 'flat', 30, 2.5, 0.55], ['coast-flat', -15, -54, 'flat', 30, 0, 0.55], ['sphere-70', -15, -40, 'sphere', 70, 0, 1.2], ['sphere-140', -15, -40, 'sphere', 140, 0, 1.2], ['sphere-400', -15, -40, 'sphere', 400, 0, 1.2]];
  const cost = (page, v) => page.evaluate(([lo, la, mode, dist, yaw, pitch]) => { const S = window.__scene, q = WORLD.lonLatToTown(lo, la); S.view.set({ target: [q.x, 1.2, q.z], dist, yaw, pitch }); S.transition.setMode(mode); S.transition.step(3); window.__step(1);
    const c = S.camera; for (const m of [S.cover, S.section, S.roads, S.ocean]) if (m) m.tick(1.2, c); const R = S.cover.state.root; S.renderer.render(S.scene, c); const on = { ...S.renderer.info.render }; R.visible = false; S.renderer.render(S.scene, c); const off = { ...S.renderer.info.render }; R.visible = true;
    return { tier: S.quality.tier(), calls: on.calls - off.calls, triangles: on.triangles - off.triangles, frameCalls: on.calls, instances: S.cover.state.loaded, pos: c.position.toArray() }; }, v.slice(1));
  const hi = await open(path.join(root, 'index.html'), '?quality=high'), lo = await open(path.join(root, 'index.html'), '?quality=low'), lines = []; let ok = true;
  for (const v of VIEWS) { const a = await cost(hi, v), b = await cost(lo, v), same = a.pos.every((x, i) => x === b.pos[i]), good = b.triangles <= 0.6 * a.triangles && b.calls <= a.calls && b.frameCalls <= a.frameCalls && same && a.tier === 'high' && b.tier === 'low'; ok = ok && good;
    lines.push(`${v[0]}：高档 ${a.calls} 次 / ${a.triangles} 三角形 / ${a.instances} 实例，低档 ${b.calls} 次 / ${b.triangles} 三角形 / ${b.instances} 实例（${(b.triangles / Math.max(1, a.triangles) * 100).toFixed(0)}%）；整帧 ${a.frameCalls} → ${b.frameCalls} 次${same ? '' : '（相机不同）'}${good ? '' : ' —— 未达'}`); }
  report('D3', ok, '低档口径（W8g-d）：同一相机下低档地表覆盖三角形 ≤ 高档 60%，绘制调用不超过高档', lines);
  await hi.close(); await lo.close();
}
report('页面错误', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : '无');
await browser.close();
const bad = results.filter(r => r.ok === false).map(r => r.id);
console.log(`${bad.length ? 'FAIL' : 'PASS'} lod_check${bad.length ? '：' + bad.join(', ') : ''}`);
process.exitCode = bad.length ? 1 : 0;
