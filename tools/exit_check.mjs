// W8g-b exit checks (W8_SPEC 13.2 B5) on the page's own meshes. Run after `python3 build.py`:  node tools/exit_check.mjs
//   B5-1 ray occlusion: tools/exit_geometry.mjs exitRays, flat and sphere state, every exit head's L metres (ruling 2 of the W8g-b breakdown); L .. 24 m for information
//   B5-2 seams: head row K = the road beyond it (position <= 0.001 m, normal), road surface to the cut terrain edge <= 0.01 m
//   B5-3 widths at s = 0, 7, 14 m: every view shows the same head mesh; widths printed (N11-N13 4.5 m at the town edge)
//   B5-4 retired in W10a (it compared the town and the explore state, which no longer exist)
//   B5-5 plants: no tree crown (canopy groups and tree instances) reaches into a road's whole cross-section (footprint outer edge)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';
import { exitRays, exitSeams, prepare } from './exit_geometry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [], check = (id, title, ok, lines) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${title}`); for (const l of lines) console.log('  · ' + l); };
const f = (v, n = 3) => (v === null || v === undefined ? '—' : (+v).toFixed(n));
const browser = await launchChromium(), page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }), errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await page.addInitScript(INIT);
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__scene && window.__scene.view, null, { timeout: 180000 });
await page.evaluate(() => window.__step(2));

// B5-4 first, on the fresh page (nothing of the planet shown yet)
// W10a: one display rule. B5-4 (the town and the explore state rendered bit for bit the same) is retired with the two states (unify_check U3 checks that
// every module shows in every view); B5-6: the network road continues every head in every view, so the end caps stay folded in all of them
const capState = await page.evaluate(() => { const S = window.__scene, out = {}; S.transition.auto = false;
  for (const [k, v] of [['town', { mapMode: 'flat', target: [-7, 1.2, 20], dist: 34 }], ['far', { mapMode: 'flat', target: [-90, 1.2, 60], dist: 30 }], ['sphere', { mapMode: 'sphere', dist: 140 }]]) { S.view.set(v); S.transition.step(3); window.__step(2); out[k] = S.terrain.headCaps(); }
  S.view.set({ mapMode: 'flat', target: [-7, 1.2, 20], dist: 34 }); S.transition.step(3); S.transition.auto = true; return out; });
check('B5-6', '道路头端头封口（裁决 6，W10a 改写）：路网在所有视图都接着道路头，城镇、平面远处、球形三种状态都收起', Object.values(capState).every(c => c.every(v => v === 0)), [Object.entries(capState).map(([k, c]) => `${k} ${c.join('/')}`).join('，') + '（路网出口 / N08）']);

const rays = await exitRays(page);
for (const st of ['flat', 'sphere']) { const r = rays[st];
  check(`B5-1-${st}`, `射线遮挡（${st === 'flat' ? '平面探索' : '球形 uBend = 1'}）：9 个出口道路头 L 米内，全横断面 9 点 × 每 0.5 m，首个命中都是道路网格`, r.occluded === 0 && r.missed === 0,
    [`${r.rays} 条射线，被遮挡 ${r.occluded}，未命中 ${r.missed}${r.examples.length ? '：' + r.examples.join('；') : ''}`, `（参考，裁决 2）L 到 24 m 的正式道路：${r.beyondRays} 条，其中首个命中不是道路 ${r.beyondOccluded}${r.beyondExamples.length ? '，例 ' + r.beyondExamples.join('；') : ''}`]); }

const seams = await exitSeams(page);
check('B5-2', '接缝：道路头最后一行与后续路段顶点 ≤ 0.001 m、颜色相同、法线相同；路面到裁切后地形边缘（道路条带外缘，裁决 5）的高差 ≤ 0.01 m', seams.every(q => q.dPos <= 0.001 && q.dCol === 0 && (q.dNrm === null || q.dNrm === 0) && q.dEdge <= 0.01),
  seams.map(q => `${q.exit}：L ${f(q.L, 2)} m（K = ${q.K}${q.whole ? '，整条路线' : '，截断后'}），接缝位置差 ${f(q.dPos, 6)} m，颜色差 ${f(q.dCol, 6)}，法线差 ${q.dNrm === null ? '（无后续路面或上向法线）' : f(q.dNrm, 6)}，路面到地形边缘 ${f(q.dEdge, 4)} m，建路网时接手的行与截断计算相差 ${f(q.maxChange, 6)} m`));
check('B5-3', '宽度：所有视图是同一个道路头网格（差 0）；s = 0 / 7 / 14 m 处铺装宽', seams.every(q => q.widths.length && (!['N11', 'N12', 'N13'].includes(q.exit) || Math.abs(q.widths[0].w - 4.5) <= 0.01)),
  seams.map(q => `${q.exit}：${q.widths.map(w => `s = ${f(w.s, 1)} m ${f(w.w, 3)} m`).join('，')}`));

const veg = await page.evaluate(() => {
  const S = window.__scene, T = window.THREE, R = 90, D = Math.PI / 180, K = S.section.kit(), routes = [...S.roads.data().routes, ...(S.section.state.chain ? [S.section.state.chain] : [])];
  const pts = []; for (const rt of routes) rt.samples.forEach((p, i) => { if (rt.footprint) pts.push([p.lon, p.lat, Math.max(Math.abs(rt.footprint[i][2]), Math.abs(rt.footprint[i][3])), rt.def ? rt.def.id : 'T03-chain']); });
  const cells = new Map(); for (const p of pts) { const k = Math.floor(p[0]) * 1000 + Math.floor(p[1]); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(p); }
  const gap = (lon, lat, r) => { let worst = Infinity, who = null; for (let a = -9; a <= 9; a++) for (let b = -7; b <= 7; b++) for (const [lo, la, w, id] of cells.get((Math.floor(lon) + a) * 1000 + Math.floor(lat) + b) || []) { const d = R * D * Math.hypot((((lo - lon + 540) % 360) - 180) * Math.cos(lat * D), la - lat), g = d - w - r; if (g < worst) { worst = g; who = id; } } return { worst, who }; };
  const crown = {}; for (const t of ['treeRound', 'cedar', 'pine', 'bamboo']) { const g = K.geometries[t]; if (!g) continue; g.computeBoundingBox(); const bb = g.boundingBox; crown[t] = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z); }
  let trees = 0, hits = [], worst = Infinity;
  for (const it of S.cover.data().items) { if (!crown[it.type]) continue; trees++; const r = crown[it.type] * it.s[0], q = gap(it.lon, it.lat, r); if (q.worst < worst) worst = q.worst; if (q.worst < 0 && hits.length < 8) hits.push(`${it.type} (${it.lon.toFixed(2)}, ${it.lat.toFixed(2)}) ${q.who} ${q.worst.toFixed(2)} m`); if (q.worst < 0) hits.n = (hits.n || 0) + 1; }
  // canopy groups (all shown from the panorama distance, as joint_shots.mjs does)
  S.transition.setMode('sphere'); S.transition.step(3); S.view.set({ target: [0, 1.2, 0], dist: 350, yaw: 0, pitch: 1.2 }); window.__step(4); S.cover.tick(1.2, S.camera);
  const can = S.scene.getObjectByName('cover:canopy-proxy'), m = new T.Matrix4(), p = new T.Vector3(), sc = new T.Vector3(), qq = new T.Quaternion(); let cHits = 0, cWorst = Infinity; const cEx = [];
  for (let i = 0; i < can.count; i++) { can.getMatrixAt(i, m); m.decompose(p, qq, sc); const lat = Math.atan(Math.sinh(-p.z / R)) / D, lon = p.x / (R * D), k = 1 / Math.cos(lat * D), r = sc.x / k, q = gap(lon, lat, r); if (q.worst < cWorst) cWorst = q.worst; if (q.worst < 0) { cHits++; if (cEx.length < 6) cEx.push(`(${lon.toFixed(2)}, ${lat.toFixed(2)}) ${q.who} ${q.worst.toFixed(2)} m`); } }
  S.transition.setMode('flat'); S.transition.step(3);
  return { trees, treeHits: hits.n || 0, treeEx: hits, worst, groups: can.count, cHits, cWorst, cEx };
});
check('B5-5', '植被避让：树冠边缘不进入道路全横断面外缘（树实例与远景树冠团）', veg.treeHits === 0 && veg.cHits === 0,
  [`树实例 ${veg.trees} 棵，伸进 ${veg.treeHits}，最小间距 ${f(veg.worst, 2)} m${veg.treeEx.length ? '：' + veg.treeEx.join('；') : ''}`, `树冠团 ${veg.groups} 团，伸进 ${veg.cHits}，最小间距 ${f(veg.cWorst, 2)} m${veg.cEx.length ? '：' + veg.cEx.join('；') : ''}`]);
check('B5-0', '页面无错误', !errors.length, [errors.slice(0, 4).join(' | ') || '无']);
await browser.close();
const ok = results.every(Boolean);
console.log(`${ok ? 'PASS' : 'FAIL'} exit_check：${results.filter(Boolean).length}/${results.length}`);
process.exitCode = ok ? 0 : 1;
