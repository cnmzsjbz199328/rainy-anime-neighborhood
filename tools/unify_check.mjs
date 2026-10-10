// W10 unified world checks (docs/world/W10_SPEC.md section 5). Each W10 row adds its checks here; run after `python3 build.py`:  node tools/unify_check.mjs
//   U0 structure: the identifiers that section 3 deletes in this row and the rows before it are gone from the sources (comments aside)
//   U3 one build, one display rule (W10a):
//     U3-first   at the first render the start-up pipeline is done, every module is built, the 10 landmarks exist, auto quality has not sampled yet
//     U3-stable  for 30 s after the first frame (the camera switching between the town, a far flat view and the sphere) no mesh, line set or instance
//                capacity is added: nothing is generated after the first frame
//     U3-display in all three states every module root, every landmark group and every terrain chunk is visible (the views differ only by bend, light,
//                weather and the pixel / altitude rules inside the modules)
//   U1, U2, U4-U7 belong to W10b-W10g and are reported as not implemented until then.
// Real GPU (ANGLE Metal, as the timing tools): the checks are structural, the renderer does not change them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const check = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures++; };

// ---- U0 (W10a): town view / explore view, the on-demand builds and the background generation
const files = ['scene.js', 'terrain.js', 'section.js', 'roads.js', 'ocean.js', 'landcover.js', 'worldgen.js', 'transition.js', 'quality.js'];
const removed = /\b(?:setExplore|onExplore|setFade|landmarksVisible|buildLandmarks|buildRest|START_DELAY_MS|SLICE_MS|requestIdleCallback|restMat|fadeMaterials|visibilityOf|terrainOf|capsOf|setHeadCaps)\b|\bfunction\s+(?:visibility|ensure)\s*\(|\.explore\b|fade\.rest|opts\.gate|\bgate\s*:/;
const hits = files.flatMap(f => fs.readFileSync(path.join(root, f), 'utf8').split('\n').flatMap((l, i) => (removed.test(l) && !l.trim().startsWith('//') ? [`${f}:${i + 1}`] : [])));
check('U0', !hits.length, `W10a 删除项：${hits.join('、') || '无残留'}`);

// ---- U3 (W10a)
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // the scene graph at the very first render: every mesh / line set with its instance capacity, the pipeline and module state, the auto probe
  await page.addInitScript(() => {
    let value;
    Object.defineProperty(window, '__scene', { get: () => value, set: S => { value = S; const render = S.renderer.render.bind(S.renderer);
      S.renderer.render = (...args) => {
        if (!window.__firstWorld) { const nodes = []; S.scene.traverse(o => { if (o.isMesh || o.isLineSegments) nodes.push([o.uuid, o.instanceMatrix ? o.instanceMatrix.count : 0]); });
          window.__firstWorld = { nodes, done: S.worldgen.state.done, built: [S.terrain.restBuilt, S.section.state.built, S.roads.state.built, S.ocean.state.built, S.cover.state.built],
            landmarks: Object.keys(S.landmarks.info).filter(k => k.startsWith('LM')).length, probe: S.quality.state.probe.length }; }
        return render(...args); }; } });
  });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?quality=auto');
  await page.waitForFunction(() => window.__firstWorld, null, { timeout: 120000 });
  const first = await page.evaluate(() => window.__firstWorld);
  check('U3-first', first.done && first.built.every(Boolean) && first.landmarks === 10 && first.probe === 0,
    `首帧前启动管线完成 ${first.done}、模块已建 ${first.built.join('/')}、地标 ${first.landmarks}、auto 已采帧 ${first.probe}；网格与线 ${first.nodes.length}`);
  // 30 s after the first frame, the camera cycling through the three states once a second
  const STATES = [{ mapMode: 'flat', target: [-7, 1.2, 20], dist: 34 }, { mapMode: 'flat', target: [-90, 1.2, 60], dist: 30 }, { mapMode: 'sphere', dist: 140 }];
  const rows = [], start = Date.now();
  for (let i = 0; Date.now() - start < 30000; i++) {
    rows.push(await page.evaluate(v => { const S = window.__scene; S.view.set(v); S.transition.step(3);
      const nodes = []; S.scene.traverse(o => { if (o.isMesh || o.isLineSegments) nodes.push([o.uuid, o.instanceMatrix ? o.instanceMatrix.count : 0]); });
      const roots = [S.terrain.root, S.section.state.root, S.section.state.globalInkGroup, S.roads.state.root, S.ocean.state.root, S.cover.state.root, ...Object.values(S.landmarks.info).flatMap(q => (q && q.groups) || [])];
      return { mode: v.mapMode, nodes, visible: roots.every(g => g && g.visible), terrain: S.terrain.ring.concat(S.terrain.rest).every(m => m.visible) }; }, STATES[i % 3]));
    await page.waitForTimeout(1000);
  }
  const same = r => JSON.stringify(r.nodes) === JSON.stringify(first.nodes);
  check('U3-stable', rows.every(same), `首帧后 ${Math.round((Date.now() - start) / 1000)} s、${rows.length} 次采样（城镇 / 平面远处 / 球形轮换）：网格与实例容量${rows.every(same) ? '不变' : '有变化：' + rows.filter(r => !same(r)).map(r => r.mode + ' ' + r.nodes.length).join('、')}`);
  check('U3-display', rows.every(r => r.visible && r.terrain), `三种状态下模块根、全景墨线组、地标组与地形分块都可见${rows.every(r => r.visible && r.terrain) ? '' : '（有隐藏：' + rows.filter(r => !(r.visible && r.terrain)).map(r => r.mode).join('、') + '）'}`);
  check('U3-errors', !errors.length, errors.join('；') || '无页面错误');
  console.log('TODO U1、U2、U4–U7 属于 W10b–W10g，尚未实施（不算通过）');
} finally { await browser.close(); }
process.exitCode = failures ? 1 : 0;
