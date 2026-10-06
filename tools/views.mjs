// Real-browser check of the built scene: first frame, console errors, input handling and review shots.
//
//   node tools/views.mjs [outDir]        (default docs/layout/views)
//
// Shots: far view of the whole plinth, default view, store corner close-up, low intersection
// close-up (seams / z-fighting), straight top-down, and the new street-walk camera.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'docs', 'layout', 'views'));
fs.mkdirSync(outDir, { recursive: true });

export const VIEWS = {
  far:          { yaw: 2.5,  pitch: 0.82, dist: 140, target: [0, 0, 0] },
  storeCorner:  { yaw: 2.75, pitch: 0.2,  dist: 13,  target: [-9, 1.4, 22] },
  intersection: { yaw: 1.57, pitch: 0.2, dist: 16,  target: [0, 0.3, 15] },
  top:          { yaw: 0,    pitch: 1.45, dist: 150, target: [0, 0, 0] },
  roamStreet:   { mode: 'roam', position: [-8, 15], heading: -Math.PI / 2 },
};

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__scene && window.__scene.view);
await page.waitForTimeout(1500);

const results = [];
await page.screenshot({ path: path.join(outDir, 'default.png') });   // the scene's own start view
const view = () => page.evaluate(() => window.__scene.view.get());
const near = (a, b) => Math.abs(a - b) < 1e-6;

// Input: orbit (left drag), zoom (wheel), pan (right drag), and the pan limit.
const v0 = await view();
await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(700, 430, { steps: 4 }); await page.mouse.up();
const v1 = await view();
results.push(['左键拖动旋转', !near(v0.yaw, v1.yaw) && !near(v0.pitch, v1.pitch)]);
await page.mouse.wheel(0, 600); await page.waitForTimeout(100);
const v2 = await view();
results.push(['滚轮缩放', v2.dist > v1.dist]);
await page.mouse.move(640, 400); await page.mouse.down({ button: 'right' }); await page.mouse.move(560, 360, { steps: 4 }); await page.mouse.up({ button: 'right' });
const v3 = await view();
results.push(['右键平移（目标点在地面上移动，高度不变）', (!near(v2.target[0], v3.target[0]) || !near(v2.target[2], v3.target[2])) && near(v2.target[1], v3.target[1])]);
await page.evaluate(() => { for (let i = 0; i < 400; i++) window.__scene.view.pan(-200, -200); });
const v4 = await view();
const lim = 46;
results.push([`平移边界（目标点限制在 ±${lim}）：(${v4.target[0].toFixed(1)}, ${v4.target[2].toFixed(1)})`, Math.abs(v4.target[0]) <= lim + 1e-6 && Math.abs(v4.target[2]) <= lim + 1e-6 && (Math.abs(v4.target[0]) > lim - 1e-3 || Math.abs(v4.target[2]) > lim - 1e-3)]);
await page.evaluate(() => window.__scene.view.set({ dist: 1e4 }));
results.push(['缩放上限 150', (await view()).dist === 150]);
await page.evaluate(() => window.__scene.view.set({ dist: 0 }));
results.push(['缩放下限 9', (await view()).dist === 9]);

// W9a: keyboard toggle and forward movement stay inside layout-derived street corridors.
const freeBefore = await view();
await page.keyboard.press('v');
const r0 = await view();
await page.keyboard.down('w'); await page.waitForTimeout(180); const rm = await view();
let r1 = await view(); const moved = v => Math.hypot(v.roam.position[0] - r0.roam.position[0], v.roam.position[2] - r0.roam.position[2]);
const moveDeadline = Date.now() + 3000;
while (moved(r1) <= .1 && Date.now() < moveDeadline) { await page.waitForTimeout(250); r1 = await view(); }
await page.keyboard.up('w');
results.push(['V 键进入漫游', r0.mode === 'roam']);
results.push([`W 键沿道路移动（输入 ${rm.input.join(',')}，位置 ${r0.roam.position[0].toFixed(2)},${r0.roam.position[2].toFixed(2)} → ${r1.roam.position[0].toFixed(2)},${r1.roam.position[2].toFixed(2)}）`, moved(r1) > .1]);
results.push(['漫游位置留在 layout.js 道路/巷道范围', await page.evaluate(() => { const p = window.__scene.view.get().roam.position; return window.__scene.view.isWalkable([p[0], p[2]]); })]);
results.push(['跟随镜头离地', r1.cameraPosition[1] > .9]);
await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(680, 390, { steps: 4 }); await page.mouse.up();
const looked = await view(); await page.waitForTimeout(2500); const returned = await view();
results.push(['拖动可临时环视并自动回正', Math.abs(looked.roam.lookYaw) > .05 && Math.abs(returned.roam.lookYaw) < Math.abs(looked.roam.lookYaw)]);
await page.evaluate(() => window.__scene.view.set({ position: [-47.5, 15], heading: -Math.PI / 2 }));
await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
const edge = await view();
results.push(['城镇西侧道路边界限制', edge.roam.position[0] >= -48 && edge.roam.position[0] <= -47.5 && await page.evaluate(() => { const p = window.__scene.view.get().roam.position; return window.__scene.view.isWalkable([p[0], p[2]]); })]);
await page.keyboard.press('v');
const freeAfter = await view();
results.push(['V 键退出并恢复原自由视角', freeAfter.mode === 'free' && freeAfter.yaw === freeBefore.yaw && freeAfter.pitch === freeBefore.pitch && freeAfter.dist === freeBefore.dist && freeAfter.target.every((v, i) => v === freeBefore.target[i])]);

// Animation: rain falls, ripples grow, the X01 signals change phase (30 s cycle; sample over ~20 s).
const anim = () => page.evaluate(() => {
  const { scene, groups } = window.__scene, rain = scene.children.find(c => c.isLineSegments);
  const rings = []; groups.wetStreet.traverse(o => { if (o.geometry && o.geometry.type === 'RingGeometry') rings.push(o.scale.x); });
  const lamps = []; groups.streetFurniture.traverse(o => { if (o.geometry && o.geometry.type === 'SphereGeometry') lamps.push(o.material.color.getHexString()); });
  return { rainY: rain.geometry.attributes.position.array[1], rings: rings.slice(0, 5), lamps: lamps.join(',') };
});
const a0 = await anim(); await page.waitForTimeout(4000); const a1 = await anim();
results.push(['降雨动画（雨滴高度变化）', a0.rainY !== a1.rainY]);
results.push(['水洼涟漪动画', a0.rings.some((v, i) => Math.abs(v - a1.rings[i]) > 1e-4)]);
const seen = new Set([a0.lamps, a1.lamps]);
for (let i = 0; i < 6 && seen.size < 2; i++) { await page.waitForTimeout(3500); seen.add((await anim()).lamps); }
results.push(['X01 信号灯相位切换', seen.size >= 2]);

for (const [name, v] of Object.entries(VIEWS)) {
  await page.evaluate(v => window.__scene.view.set(v), v);
  await page.waitForTimeout(1200);   // SwiftShader: let a few frames render
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

// Touch emulation: confirm the unobtrusive mode button and on-screen movement stick work.
await page.close();
const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
await touchPage.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
await touchPage.waitForFunction(() => window.__scene && window.__scene.view, null, { timeout: 60000 });
await touchPage.waitForTimeout(500);
const toggleBox = await touchPage.locator('#town-view-toggle').boundingBox();
await touchPage.touchscreen.tap(toggleBox.x + toggleBox.width / 2, toggleBox.y + toggleBox.height / 2);
const touchMode = await touchPage.evaluate(() => window.__scene.view.get().mode);
const stickBox = await touchPage.locator('#town-walk-stick').boundingBox();
results.push(['触屏按钮切换视角', touchMode === 'roam']);
results.push(['触屏移动摇杆可见', !!stickBox]);
if (stickBox) {
  const x = stickBox.x + stickBox.width / 2, y = stickBox.y + stickBox.height / 2;
  const cdp = await touchPage.context().newCDPSession(touchPage);
  const touch = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ id: 1, x: px, y: py, radiusX: 8, radiusY: 8, force: 1 }] });
  const p0 = await touchPage.evaluate(() => window.__scene.view.get().roam.position);
  await touch('touchStart', x, y); await touch('touchMove', x + 25, y); await touchPage.waitForTimeout(500); await touch('touchEnd', x + 25, y);
  const p1 = await touchPage.evaluate(() => window.__scene.view.get().roam.position);
  results.push(['触屏摇杆可移动', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > .1]);
}
await touchPage.close();
await browser.close();

for (const [t, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${t}`);
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'page errors: none');
console.log(`screenshots in ${path.relative(root, outDir)}`);
process.exit(errors.length || results.some(r => !r[1]) ? 1 : 0);
