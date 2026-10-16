// Checks W7-C1..C5 for one planet landmark. Run after `python3 build.py`:  node tools/landmark_check.mjs LM01 [--no-browser] [--no-shots]
// Data (Node): the registration against world.js. Page: the module's local frame and extents, the true size after the bend, the footprint, the ground contact, the cost and the
// motion; landmark-specific measurements (counts, sizes) come from the module's `stats` and from the checks listed in SPECIFIC below.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const id = process.argv[2]; if (!/^LM\d\d$/.test(id || '')) { console.error('usage: node tools/landmark_check.mjs LMxx [--no-browser] [--no-shots]'); process.exit(2); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
globalThis.LAYOUT = require(path.join(root, 'layout.js'));
const W = require(path.join(root, 'world.js'));
const D = Math.PI / 180, R = 90;
const results = [];
const f = (v, n = 3) => (typeof v === 'number' ? v.toFixed(n) : String(v));
function report(idc, title, info, fails) { results.push({ id: idc, ok: !fails.length }); console.log(`${fails.length ? 'FAIL' : 'PASS'} ${idc} ${title}`); for (const m of fails) console.log('  ✗ ' + m); for (const m of info) console.log('  · ' + m); }
const lm = W.landmarks.find(q => q.id === id);
const noShots = process.argv.includes('--no-shots');

// ---- W7-C1 registration (Node side)
{ const info = [], fails = [];
  info.push(`${lm.id} ${lm.name}：锚点 ${f(lm.lat, 2)}°N ${f(lm.lon, 2)}°E，占地半径 ${lm.radius} m，入口 ${lm.entrances.map(e => `${e.id}（朝向 ${e.heading}°，距锚点 ${e.offset} m，局部 (${f(-e.offset * Math.sin((e.heading - lm.entrances[0].heading) * D), 2)}, ${f(e.offset * Math.cos((e.heading - lm.entrances[0].heading) * D), 2)})）`).join('、')}；底面 ${f(W.height(lm.lon, lm.lat), 2)} m（登记 ${lm.baseHeight} m）`);
  if (Math.abs(W.height(lm.lon, lm.lat) - lm.baseHeight) > 0.06) fails.push('baseHeight 与 height() 相差 > 0.06');
  report('W7-C1a', '登记（world.js）：锚点、朝向、底面、入口', info, fails); }

if (!process.argv.includes('--no-browser')) {
  const { launchChromium } = await import('./browser.mjs');
  const { INIT, shots, renderShot } = await import('./landmark_views.mjs');
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.landmarks, null, { timeout: 90000 });
  const def = await page.evaluate(() => { window.__step(3); const S = window.__scene; S.renderer.render(S.scene, S.camera); return { calls: S.renderer.info.render.calls, tri: S.renderer.info.render.triangles, built: Object.keys(S.landmarks.info).filter(k => k.startsWith('LM')).length, visible: Object.values(S.landmarks.info).flatMap(q => (q && q.groups) || []).every(g => g.visible) }; });
  // measurements inside the page: local extents of the module's baked meshes, true size after the bend, footprint, lowest point
  const M = await page.evaluate(id => {
    const S = window.__scene, T = window.THREE, B = S.bend; B.set(1);
    const info = S.landmarks.info[id]; if (!info || !info.groups) return { missing: true };
    const lm = window.WORLD.landmarks.find(q => q.id === id), meshes = [], groupBounds = {}, needGroupBounds = id === 'LM09'; let calls = 0, tris = 0;
    for (const g of info.groups) { const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; g.traverse(o => { if ((o.isMesh || o.isLineSegments) && o.geometry) { meshes.push(o); calls++; if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; const a = needGroupBounds && o.geometry.userData.local; if (a) for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a[i + k]); hi[k] = Math.max(hi[k], a[i + k]); } } }); if (needGroupBounds) groupBounds[g.name] = { min: lo, max: hi }; }
    let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9], maxR = 0, lowest = 1e9; const meshSamples = [];
    for (const o of meshes) { if (o.isLineSegments || (o.userData && ['ice-overlay', 'light-effect'].includes(o.userData.layer))) continue;                  /* non-structural overlays do not define real component size or occupied ground */ const loc = o.geometry.userData.local; if (!loc) continue; const step = Math.max(1, Math.floor(loc.length / 3 / 400)), samples = [];
      for (let i = 0; i < loc.length; i += 3 * step) { const l = [loc[i], loc[i + 1], loc[i + 2]]; for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], l[k]); max[k] = Math.max(max[k], l[k]); } maxR = Math.max(maxR, Math.hypot(l[0], l[2])); lowest = Math.min(lowest, l[1]); const w = o.geometry.attributes.position; samples.push([l, [w.array[i], w.array[i + 1], w.array[i + 2]]]); } meshSamples.push({ name: o.name || o.parent?.name || 'mesh', samples }); }
    // The landmark follows curved terrain. Compare horizontal spans at one elevation and
    // radial heights separately; a diagonal between different heights is not a rigid length
    // under the W7 height-dependent geodesic map (scene.js map()).
    const horizontal = [], vertical = []; let worstPair = null;
    for (const { name, samples } of meshSamples) {
      if (samples.length < 2) continue;
      const selected = new Set();
      for (let axis = 0; axis < 3; axis++) {
        let lo = 0, hi = 0;
        for (let i = 1; i < samples.length; i++) {
          if (samples[i][0][axis] < samples[lo][0][axis]) lo = i;
          if (samples[i][0][axis] > samples[hi][0][axis]) hi = i;
        }
        selected.add(lo); selected.add(hi);
      }
      const picks = [...selected].map(i => samples[i]);
      for (let i = 0; i < picks.length; i++) for (let j = i + 1; j < picks.length; j++) {
        const a = picks[i], b = picks[j], dy = Math.abs(a[0][1] - b[0][1]);
        const d0 = Math.hypot(a[0][0] - b[0][0], a[0][2] - b[0][2]);
        let kind, actual, expected;
        if (dy <= 0.05 && d0 >= 0.5 && d0 <= (({ LM06: 24 })[id] || 30)) {
          kind = 'horizontal'; expected = d0;
          const A = B.point(...a[1], 1), Bp = B.point(...b[1], 1);
          actual = Math.hypot(...A.map((v, k) => v - Bp[k]));
        } else if (dy >= 0.5) {
          kind = 'vertical'; expected = dy;
          const A = B.point(...a[1], 1), Bp = B.point(...b[1], 1);
          actual = Math.abs(Math.hypot(A[0], A[1] + 90, A[2]) - Math.hypot(Bp[0], Bp[1] + 90, Bp[2]));
        } else continue;
        const error = Math.abs(actual / expected - 1);
        (kind === 'horizontal' ? horizontal : vertical).push(error);
        if (!worstPair || error > worstPair.error) worstPair = { kind, mesh: name, a: a[0], b: b[0], d0: expected, d1: actual, error };
      }
    }
    const pairs = horizontal.concat(vertical);
    return { min, max, maxR, maxAllowed: Math.max(lm.radius, ...lm.entrances.map(e => e.offset)) + 1.5 + (({ LM10: 10, LM08: 5, LM06: 12 })[id] || 0), seabed: ({ LM10: -6, LM08: -7, LM06: -1.6, LM07: -1.05 })[id] ?? -0.6, lowest, calls, tris, worstScale: pairs.length ? Math.max(...pairs) : 0, worstPair, pairs: pairs.length, horizontal: horizontal.length, vertical: vertical.length, stats: info.fx && info.fx.stats ? info.fx.stats : null, groups: info.groups.map(g => g.name), groupBounds, radius: lm.radius, buildMs: S.landmarks.info.buildMs };
  }, id);
  { const info = [], fails = [];
    if (M.missing) fails.push('模块没有注册或没有构建'); else {
      info.push(`模块分组：${M.groups.join('、')}；构建 ${M.buildMs} ms（全部地标，首次显示一次，SwiftShader）`);
      info.push(`局部范围（m，x 左、y 上、z 朝入口）：x ${f(M.min[0], 1)}…${f(M.max[0], 1)}，y ${f(M.min[1], 2)}…${f(M.max[1], 1)}，z ${f(M.min[2], 1)}…${f(M.max[2], 1)}；离锚点的最大水平距离 ${f(M.maxR, 1)} m（占地半径 ${M.radius} m；各地标的例外见实施记录）`);
      info.push(`弯曲后真实尺寸：同构件包围端点，水平 ${M.horizontal} 对（同高差 ≤ 0.05 m，0.5–${({ LM06: 24 })[id] || 30} m）、径向高度 ${M.vertical} 对（高差 ≥ 0.5 m），最大相对差 ${f(M.worstScale * 100, 2)}%（要求 ≤ 1%）`);
      if (M.worstScale > 0.01 && M.worstPair) info.push(`最大偏差样本（${M.worstPair.kind}, ${M.worstPair.mesh}）：局部 ${M.worstPair.a.map(v => f(v, 2)).join(', ')} ↔ ${M.worstPair.b.map(v => f(v, 2)).join(', ')}，距离 ${f(M.worstPair.d0, 3)} → ${f(M.worstPair.d1, 3)} m`);
      if (M.maxR > M.maxAllowed) fails.push(`物件超出占地：最大水平距离 ${f(M.maxR, 1)} m > 占地半径与入口偏移的较大者 + 1.5 m = ${f(M.maxAllowed, 1)} m`);
      if (!M.horizontal || !M.vertical) fails.push(`真实尺寸抽样不足：水平 ${M.horizontal} 对、径向高度 ${M.vertical} 对`);
      if (M.worstScale > 0.01) fails.push(`弯曲后尺寸偏差 ${f(M.worstScale * 100, 2)}% > 1%`);
      if (M.lowest < M.seabed) fails.push(`有物件低于局部地面 ${f(M.lowest, 2)} m（允许到 ${M.seabed} m：靠海地标的防波堤基础与码头桩在海床上）`);
    }
    report('W7-C2', '尺寸与占地：局部范围、弯曲后真实尺寸 ≤ 1%、物件在占地内', info, fails); }
  if (!noShots) { const info = [], fails = [];
    // W10a (W10_SPEC 2.4, 6): the landmarks are built before the first frame and show in every view; the default view's budget is pre-w10a 2,374 + 10 %
    if (def.built !== 10 || !def.visible) fails.push(`默认画面地标 ${def.built} 个、全部可见 ${def.visible}（W10a：首帧前生成 10 个、所有视图显示）`); if (def.calls > 2611) fails.push(`默认视角绘制调用 ${def.calls} 超过 W10 预算 2611`);
    info.push(`默认视角（uBend = 0）：${def.calls} 次绘制调用 / ${def.tri} 个三角形，10 个地标已构建并显示（W10 预算 ≤ 2611 = pre-w10a 2,374 + 10%）`);
    if (!M.missing) info.push(`模块自身：${M.calls} 个网格/线对象（bake 之后）、${Math.round(M.tris)} 个三角形`);
    const SH = Object.fromEntries(shots(id)); const rows = [];
    for (const [label, name] of [['近景', 'front'], ['半空', 'site-plan'], ['远眺', 'from-afar']]) { const on = await renderShot(page, SH[name]), off = (await renderShot(page, SH[name], { noLandmarks: true })).info; rows.push(`${label}（${name}）：整帧 ${on.info.calls} 次调用 / ${on.info.triangles} 三角形；不含地标 ${off.calls} / ${off.triangles}；地标新增 ${on.info.calls - off.calls} 次调用 / ${on.info.triangles - off.triangles} 三角形`); }
    info.push(rows.join('；') + '（SwiftShader，真机待验证）');
    // motion: two renders of the rainy night view 1.0 s apart with the rain off differ (steam, flame, beam, water...)
    const diff = async (a, b) => page.evaluate(async ([a, b]) => { const load = async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const q = c.getContext('2d'); q.drawImage(i, 0, 0); return q.getImageData(0, 0, c.width, c.height).data; }; const A = await load(a), B = await load(b); let n = 0; for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 6) n++; return n; }, [a, b]);
    const v = { ...SH['rainy-night'], rain: false }; const a = await renderShot(page, v, { t: 2.0 }), b = await renderShot(page, v, { t: 3.7 }), n = await diff(a.url, b.url);
    info.push(`动态（雨夜近景关雨，t = 2.0 与 3.7 s）：差异像素 ${n}`); if (n <= 0) fails.push('近景没有动态');
    if (errors.length) fails.push('页面错误：' + errors.join(' | '));
    report('W7-C5', '预算与动态：默认画面在 W10 预算内、记录成本、近景有动态、无页面错误', info, fails); }
  // landmark-specific checks (module stats and measurements)
  const spec = await import('./landmark_specific.mjs').catch(() => null);
  if (spec && spec.CHECKS[id]) { const info = [], fails = []; await spec.CHECKS[id]({ page, info, fail: m => fails.push(m), f, W, lm, M, renderShot, shots: Object.fromEntries(shots(id)) }); report('W7-C3/C4', `${lm.name} 专有检查（落地、衔接、动态与光、亮度排序）`, info, fails); }
  await browser.close();
}
console.log(results.every(r => r.ok) ? `\nPASS landmark_check ${id}（${results.length} 项）` : `\nFAIL landmark_check ${id}：${results.filter(r => !r.ok).map(r => r.id).join(', ')}`);
process.exitCode = results.every(r => r.ok) ? 0 : 1;
