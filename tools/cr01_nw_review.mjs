// W10c CR01 NW repair (docs/world/CR01_NW_REPAIR_PLAN.md section 5): the four review frames for the user, written to docs/world/w10c/nw-road-review/ with the exact
// camera of each in manifest.json. Run after build.py:  node tools/cr01_nw_review.mjs
// Machine-generated evidence only: this tool does not judge how the images look (the user does). The weather is locked clear so that the road edges can be read.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), outDir = path.join(root, 'docs/world/w10c/nw-road-review');
fs.mkdirSync(outDir, { recursive: true });
// yaw 0 looks north (screen up = north), pi/4 looks north-west; pitch is the camera's elevation above the target (radians), dist its distance (flat metres)
const VIEWS = [
  { file: 'overview.png', what: '学校 B01-P01（−26, −35）与西北弯道同框，北朝上', view: { mapMode: 'flat', target: [-40, 1.2, -45], dist: 62, yaw: 0, pitch: 1.35 } },
  { file: 'close.png', what: '西北弯道近景（约 x −48、z −54），从城内向西北看', view: { mapMode: 'flat', target: [-48, 1.2, -54], dist: 15, yaw: Math.PI / 4, pitch: 0.8 } },
  { file: 'junction.png', what: 'C01-T02 至 RN04-18 圆角整段（RN05-01 贴环浅角接入），北朝上', view: { mapMode: 'flat', target: [-44, 1.2, -54.5], dist: 30, yaw: 0, pitch: 1.3 } },
  { file: 'sphere.png', what: '同区球形地图（晴朗白天）', view: { mapMode: 'sphere', target: [-46, 1.2, -53], dist: 34, yaw: 0, pitch: 1.1 } },
];
const browser = await launchChromium(), page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }), errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await page.addInitScript(INIT);
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => window.__scene && window.__scene.view, null, { timeout: 180000 });
await page.evaluate(() => window.__scene.weather.lock('clear'));
const frames = [];
for (const v of VIEWS) {
  const r = await page.evaluate(view => {
    const S = window.__scene; S.view.set(view);
    for (let k = 0; k < 40 && S.transition.animating; k++) { S.transition.step(0.25); window.__step(1); }      // finish the flat <-> sphere roll
    window.__step(2); S.renderer.render(S.scene, S.camera);
    return { url: S.renderer.domElement.toDataURL('image/png'), camera: S.view.get(), bend: S.bend.get() };
  }, v.view);
  fs.writeFileSync(path.join(outDir, v.file), Buffer.from(r.url.split(',')[1], 'base64'));
  const c = r.camera;
  frames.push({ file: v.file, what: v.what, width: 1280, height: 800, requested: v.view, mapMode: c.mapMode, bend: r.bend, target: c.target, yaw: c.yaw, pitch: c.pitch, dist: c.dist, cameraPosition: c.cameraPosition });
}
const merge = await page.evaluate(() => { const D = window.__scene.roads.data(); return D.cr01 ? D.cr01.stats : null; });
const manifest = { generatedAt: new Date().toISOString(), state: 'machine-generated review frames; visual confirmation pending user review', weather: 'clear (locked for legibility; the default flat map is a rainy night)',
  plan: 'docs/world/CR01_NW_REPAIR_PLAN.md', checks: 'node tools/cr01_merge_check.mjs; node tools/cr01_nw_audit.mjs', frames, merge, pageErrors: errors };
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`复核图 ${frames.length} 张：${frames.map(q => path.relative(root, path.join(outDir, q.file))).join('、')}；清单 ${path.relative(root, path.join(outDir, 'manifest.json'))}；页面错误 ${errors.length}`);
await browser.close();
process.exitCode = errors.length ? 1 : 0;
