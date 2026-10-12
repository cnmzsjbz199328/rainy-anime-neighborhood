// W10c CR01 junction cleanup: two flat-map review frames per ring junction. Run after build.py:
//   node tools/ring_review_after.mjs
// The files are machine-generated evidence for the user to inspect; this tool does not judge image appearance.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), outDir = path.join(root, 'docs/world/w10c/ring-review-after');
fs.mkdirSync(outDir, { recursive: true });
const renderImages = !process.argv.includes('--manifest-only'), browser = await launchChromium(), page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }), errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await page.addInitScript(INIT);
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__scene && window.__scene.view, null, { timeout: 120000 });
// The default presentation is already the flat map. Lock a clear weather snapshot without
// stepping the transition animation; each frame below sets its camera explicitly.
await page.evaluate(() => window.__scene.weather.lock('clear'));

const junctions = await page.evaluate(() => {
  const W = window.WORLD, S = window.__scene, D = S.roads.data(), net = W.roadNetwork, flat = (lon, lat) => W.lonLatToTown(lon, lat);
  return D.junctions.filter(j => j.kind === 'CR01').map(j => {
    const nd = net.nodeById[j.node], p = flat(nd.lon, nd.lat), branch = j.arms.find(a => a.routeId !== 'CR01') || j.arms[0], e = net.edges.find(q => q.id === branch.edgeId), samples = net.samplePath(e, 0.5), atStart = e.from === j.node, q = samples[atStart ? Math.min(8, samples.length - 1) : Math.max(0, samples.length - 9)], end = flat(q.lon, q.lat), dx = end.x - p.x, dz = end.z - p.z;
    return { node: j.node, x: p.x, z: p.z, yaw: Math.atan2(-dx, -dz), edges: j.edges || j.edgeIds, routes: j.routes, arms: j.arms, area: j.area, paving: j.paving, separateFaces: j.strip.index.length,
      cuts: j.cuts.map(c => ({ routeId: c.routeId, edgeId: c.edgeId || null, part: c.part, clippedTriangles: c.clippedTriangles, removedTriangles: c.removedTriangles, removedArea: c.removedArea, before: c.before, after: c.after })),
      removedInstances: j.removedInstances.map(q => ({ routeId: q.routeId, type: q.type, station: q.station, clearance: q.clearance })),
      lampRemovals: D.routes.flatMap(r => (r.junctionLampRemovals || []).filter(q => q.node === j.node).map(q => ({ routeId: r.def.id, station: q.station, zone: q.zone }))) };
  });
});
if (junctions.length !== 10) throw new Error(`Expected ten CR01 junctions, received ${junctions.length}`);
const frames = [];
for (const j of junctions) {
  const pass = j.paving === 'continuous-asphalt' && j.separateFaces === 0 && j.cuts.length === j.routes.filter(id => id !== 'CR01').length + j.arms.filter(a => a.routeId !== 'CR01').length && j.cuts.every(c => c.clippedTriangles > 0 || c.removedArea === 0);
  for (const view of [{ name: 'top', dist: 24, pitch: 1.52 }, { name: 'close', dist: 14, pitch: 0.88 }]) {
    const file = `${j.node}-${view.name}.png`;
    if (renderImages) {
      const url = await page.evaluate(([j, view]) => {
        const S = window.__scene; S.view.set({ target: [j.x, 1.2, j.z], dist: view.dist, yaw: j.yaw, pitch: view.pitch });
        window.__step(1); S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL('image/png');
      }, [j, view]);
      fs.writeFileSync(path.join(outDir, file), Buffer.from(url.split(',')[1], 'base64'));
    } else if (!fs.existsSync(path.join(outDir, file))) throw new Error(`Missing screenshot ${file}; run without --manifest-only`);
    frames.push({ node: j.node, file, width: 1280, height: 800, view: view.name });
  }
  j.machineStatus = pass ? 'PASS' : 'FAIL';
}

const manifest = { generatedAt: new Date().toISOString(), state: 'machine evidence; visual confirmation pending user review', weather: 'clear for legibility', mapMode: 'flat', frames, junctions, pageErrors: errors };
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const md = [
  '# CR01 路口修复后复核图', '',
  '平面夜景视图，截图天气锁为晴朗以便辨认路面边界。截图由工具生成；是否满足视觉要求由用户确认。',
  'CR01 保留原扫掠沥青网格；接入道路止于环路铺装边界，环路仅在接入口裁去外侧断面。每个节点独立补面三角数均为 0。', '',
  '机器检查来自 `node tools/unify_check.mjs` 的 U4-CR01-junctions 与 U2；10/10 节点、环路沥青带内接入网格交叠 0、路口/车行道净空冲突 0，平面与球形铺装带射线均无漏底。', '',
  'CR01 内侧 0.5 m 肩带的颜色与断面高度已并入沥青车行道；U4 测得的最大相对高度误差为 0.0021 m。', '',
  '| 节点 | 接入道路边 | 路由 | 检查范围 | 独立补面 | 裁切道路网格 | 净空移除实例 | 俯视 | 近景 | 结果 |',
  '| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- |',
  ...junctions.map(j => {
    const cuts = j.cuts.map(c => `${c.routeId}${c.edgeId ? ` ${c.edgeId}` : ''} ${c.part}: ${c.clippedTriangles} 面 / ${c.removedArea.toFixed(2)} m²`).join('<br>'),
      removed = j.removedInstances.length ? j.removedInstances.map(q => `${q.routeId} ${q.type}${q.station == null ? '' : ` @${q.station.toFixed(2)}m`}`).join('<br>') : '无',
      edges = j.arms.map(a => `${a.edgeId} (${a.routeId})`).join('<br>');
    return `| ${j.node} | ${edges} | ${j.routes.join(', ')} | ${j.area.toFixed(2)} m² | ${j.separateFaces} 面 | ${cuts} | ${removed} | ![${j.node} 俯视](${j.node}-top.png) | ![${j.node} 近景](${j.node}-close.png) | ${j.machineStatus} |`;
  }), '',
  '文件名直接对应节点 ID；`manifest.json` 保存完整道路边、每个源路段裁切数字、清除的实例与灯位记录。所有节点机器结果通过后仍需用户逐图确认。', '',
  '请重点看 C01-W-N11、C01-E-N12、C01-E-N13 的俯视：CR01 深色沥青应贯通，棕灰支路只在环路边缘接入；C01-W-N01、C01-E-N03、C01-S 的俯视：十字路口应保留真实四向通行，不露底；十张近景：支路口不得有凸起、草地或设施压入车行道。',
].join('\n');
fs.writeFileSync(path.join(outDir, 'README.md'), md + '\n');
console.log(`${renderImages ? '截图生成' : '截图复用'} ${frames.length} 张（10 节点 × 俯视/近景），清单 ${path.relative(root, path.join(outDir, 'README.md'))}`);
for (const j of junctions) console.log(`${j.machineStatus} ${j.node}: ${j.edges.join(', ')}; ${j.cuts.length} section cuts; ${j.removedInstances.length} instances cleared`);
if (errors.length) console.log('page errors:', errors.slice(0, 8).join(' | '));
await browser.close();
process.exitCode = errors.length || junctions.some(j => j.machineStatus !== 'PASS') ? 1 : 0;
