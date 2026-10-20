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
await page.waitForFunction(() => window.__scene && window.__scene.view, null, { timeout: 180000 });   // W10a: the world is generated before the first frame (SwiftShader: slow)
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
// W8e-b: the flat map runs from the seam at -85 deg to 275 deg (x in [xMin, xMax]), latitude +-80 deg; pan towards both corners
const lim = await page.evaluate(()=>{const T=window.__scene.transition;return{x0:T.xMin,x1:T.xMax,z:T.limitZ};});
await page.evaluate(() => { for (let i = 0; i < 400; i++) window.__scene.view.pan(200, 200); });
const v5 = await view();
const inside = t => t[0] >= lim.x0 - 1e-6 && t[0] <= lim.x1 + 1e-6 && Math.abs(t[2]) <= lim.z + 1e-6, atEdge = t => Math.abs(t[0] - lim.x0) < 1e-3 || Math.abs(t[0] - lim.x1) < 1e-3 || Math.abs(Math.abs(t[2]) - lim.z) < 1e-3;
results.push([`平面全图边界（x ${lim.x0.toFixed(1)}…${lim.x1.toFixed(1)}，|z| ≤ ${lim.z.toFixed(1)}）：(${v4.target[0].toFixed(1)}, ${v4.target[2].toFixed(1)}) 与 (${v5.target[0].toFixed(1)}, ${v5.target[2].toFixed(1)})`, inside(v4.target) && inside(v5.target) && atEdge(v4.target) && atEdge(v5.target)]);
await page.evaluate(() => window.__scene.view.set({ dist: 1e4 }));
results.push(['缩放上限 400（缩放不切换地图模式）', (await view()).dist === 400]);
await page.evaluate(() => window.__scene.view.set({ dist: 0 }));
results.push(['缩放下限 9', (await view()).dist === 9]);
// Pan without a right button: Shift + drag, and WASD / arrows relative to the view direction.
await page.evaluate(() => window.__scene.view.set({ yaw: 2.5, pitch: .5, dist: 34, target: [0, 1.2, 0] }));
const q0 = await view();
await page.keyboard.down('Shift'); await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(560, 400, { steps: 4 }); await page.mouse.up(); await page.keyboard.up('Shift');
const q1 = await view();
results.push(['Shift + 左键拖动平移（不改旋转）', (!near(q0.target[0], q1.target[0]) || !near(q0.target[2], q1.target[2])) && near(q0.yaw, q1.yaw) && near(q0.pitch, q1.pitch)]);
const keyPan = async key => {
  await page.evaluate(() => window.__scene.view.set({ yaw: 2.5, pitch: .5, dist: 34, target: [0, 1.2, 0] }));
  const f = await page.evaluate(() => { const s = window.__scene, v = new s.camera.position.constructor(0, 0, -1).applyQuaternion(s.camera.quaternion), r = new s.camera.position.constructor(1, 0, 0).applyQuaternion(s.camera.quaternion); return { f: Math.hypot(v.x, v.z), fx: v.x / Math.hypot(v.x, v.z), fz: v.z / Math.hypot(v.x, v.z), rx: r.x, rz: r.z }; });
  await page.keyboard.down(key); await page.waitForTimeout(300); await page.keyboard.up(key);
  const t = (await view()).target; return { fwd: t[0] * f.fx + t[2] * f.fz, right: t[0] * f.rx + t[2] * f.rz };
};
const kw = await keyPan('w'), kd = await keyPan('d'), ka = await keyPan('ArrowLeft');
results.push([`自由视角 W 向前、D/A 向屏幕右/左平移（${kw.fwd.toFixed(1)} / ${kd.right.toFixed(1)} / ${ka.right.toFixed(1)}）`, kw.fwd > .5 && kd.right > .5 && ka.right < -.5]);
await page.evaluate(() => window.__scene.view.set({ yaw: 2.5, pitch: .5, dist: 34, target: [-7, 1.2, 20] }));

// R1 (THIRD_PERSON_ROAM_PLAN 6.11): the ride. Kept: V enters, W moves, on the walkable surface, the follow camera above the ground, the look drag (over 90 deg, no snap
// back, the heading unchanged), the grab direction, V leaves (W9b: at the rider's place), the three touch items. Retired with the walk: the layout.js rectangles, the town's
// west road limit and the A/D strafe (the walkable surface, the collision probes and the steering sign of tools/ride_check.mjs replace them).
const freeBefore = await view();
await page.keyboard.press('v');
const r0 = await view();
await page.keyboard.down('w'); await page.waitForTimeout(180); const rm = await view();
let r1 = await view(); const moved = v => Math.hypot(v.roam.position[0] - r0.roam.position[0], v.roam.position[2] - r0.roam.position[2]);
const moveDeadline = Date.now() + 15000;   // the bike accelerates from rest; software WebGL renders few frames (each at most 0.12 s of ride)
while (moved(r1) <= .1 && Date.now() < moveDeadline) { await page.waitForTimeout(250); r1 = await view(); }
await page.keyboard.up('w');
results.push(['V 键进入骑行', r0.mode === 'roam']);
results.push([`W 键沿道路骑行（输入 ${JSON.stringify(await page.evaluate(() => window.__scene.ride.input()))}，位置 ${r0.roam.position[0].toFixed(2)},${r0.roam.position[2].toFixed(2)} → ${r1.roam.position[0].toFixed(2)},${r1.roam.position[2].toFixed(2)}）`, moved(r1) > .1]);
void rm;
results.push(['骑行位置在统一可走面上（ground.js）', await page.evaluate(() => { const p = window.__scene.view.get().roam.position; return window.__scene.view.isWalkable([p[0], p[2]]); })]);
results.push(['跟随镜头离地', r1.cameraPosition[1] > .9]);
// steering: moving forward, A turns left (the heading grows), D right
const steerTurn = async key => {
  await page.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2, speed: 2 })); await page.keyboard.down('w'); await page.waitForTimeout(120);
  const h0 = (await view()).roam.heading; await page.keyboard.down(key);
  await page.waitForFunction(h => Math.abs(window.__scene.view.get().roam.heading - h) > .05, h0, { timeout: 10000 }).catch(() => {});
  await page.keyboard.up(key); const h1 = (await view()).roam.heading; await page.keyboard.up('w'); return h1 - h0;
};
const aTurn = await steerTurn('a'), dTurn = await steerTurn('d'), rTurn = await steerTurn('ArrowRight');
results.push([`A 左转、D/→ 右转（航向变化 ${aTurn.toFixed(2)} / ${dTurn.toFixed(2)} / ${rTurn.toFixed(2)} rad）`, aTurn > .05 && dTurn < -.05 && rTurn < -.05]);
await page.waitForFunction(() => Math.abs(window.__scene.ride.get().speed) < .01, null, { timeout: 8000 }).catch(() => {});
// Free look: dragging is grab-style like the free view, covers a full turn range, does not snap back, and does not turn the bike.
await page.evaluate(() => window.__scene.view.set({ position: [-8, 15], heading: -Math.PI / 2 }));
const l0 = (await view()).roam;
await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(1000, 380, { steps: 6 }); await page.mouse.up();
const looked = (await view()).roam; await page.waitForTimeout(2500); const kept = (await view()).roam;
results.push([`骑行拖动环视可超过 90° 且不自动回正、不改航向（环视 ${(looked.lookYaw - l0.lookYaw).toFixed(2)} rad，航向变化 ${Math.abs(looked.heading - l0.heading).toFixed(4)}）`, looked.lookYaw - l0.lookYaw > 1.57 && Math.abs(kept.lookYaw - looked.lookYaw) < 1e-3 && Math.abs(looked.heading - l0.heading) < 1e-3]);
await page.keyboard.press('c'); await page.waitForTimeout(500);
await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(700, 400, { steps: 4 }); await page.mouse.up();
const grab = (await view()).roam;
results.push(['骑行向右拖动与自由视角同向（抓取式：画面右移，视线左转）', grab.lookYaw > 0]);
const rideLast = (await view()).roam;
await page.keyboard.press('v');
const freeAfter = await view();
// W9b (SPHERE_RIDING_PLAN 3): leaving puts the free view at the rider's place (R1 restored the view from before the ride)
void freeBefore;
results.push(['V 键退出：自由视角目标在骑手当前位置（W9b）', freeAfter.mode === 'free' && freeAfter.mapMode === 'flat' && Math.abs(freeAfter.target[0] - rideLast.position[0]) < 1e-6 && Math.abs(freeAfter.target[2] - rideLast.position[2]) < 1e-6 && freeAfter.dist >= 9]);

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
await touchPage.waitForFunction(() => window.__scene && window.__scene.view, null, { timeout: 180000 });
await touchPage.waitForTimeout(500);
const toggleBox = await touchPage.locator('#town-view-toggle').boundingBox();
await touchPage.touchscreen.tap(toggleBox.x + toggleBox.width / 2, toggleBox.y + toggleBox.height / 2);
const touchMode = await touchPage.evaluate(() => window.__scene.view.get().mode);
const stickBox = await touchPage.locator('#town-walk-stick').boundingBox();
results.push(['触屏按钮进入骑行', touchMode === 'roam']);
results.push(['触屏移动摇杆可见', !!stickBox]);
if (stickBox) {
  const x = stickBox.x + stickBox.width / 2, y = stickBox.y + stickBox.height / 2;
  const cdp = await touchPage.context().newCDPSession(touchPage);
  const touch = (type, px, py) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ id: 1, x: px, y: py, radiusX: 8, radiusY: 8, force: 1 }] });
  const p0 = await touchPage.evaluate(() => window.__scene.view.get().roam.position);
  await touch('touchStart', x, y); await touch('touchMove', x, y - 30); await touchPage.waitForTimeout(900); await touch('touchEnd', x, y - 30);   // the stick's vertical: throttle
  const p1 = await touchPage.evaluate(() => window.__scene.view.get().roam.position);
  results.push(['触屏摇杆可骑行', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > .1]);
}
{
  // Two-finger drag in the free view pans the target (pinch alone only zooms).
  await touchPage.touchscreen.tap(toggleBox.x + toggleBox.width / 2, toggleBox.y + toggleBox.height / 2);
  const cdp2 = await touchPage.context().newCDPSession(touchPage);
  const two = (type, dx) => cdp2.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ id: 1, x: 150 + dx, y: 300, radiusX: 8, radiusY: 8, force: 1 }, { id: 2, x: 250 + dx, y: 300, radiusX: 8, radiusY: 8, force: 1 }] });
  const t0 = await touchPage.evaluate(() => window.__scene.view.get());
  await two('touchStart', 0); for (let i = 1; i <= 6; i++) await two('touchMove', i * 12); await two('touchEnd', 72);
  const t1 = await touchPage.evaluate(() => window.__scene.view.get());
  results.push(['触屏双指拖动平移（距离基本不变）', t1.mode === 'free' && Math.hypot(t1.target[0] - t0.target[0], t1.target[2] - t0.target[2]) > .3 && Math.abs(t1.dist - t0.dist) / t0.dist < .05]);
}
await touchPage.close();
await browser.close();

for (const [t, ok] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${t}`);
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'page errors: none');
console.log(`screenshots in ${path.relative(root, outDir)}`);
process.exit(errors.length || results.some(r => !r[1]) ? 1 : 0);
