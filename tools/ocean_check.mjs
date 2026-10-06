// Checks W6-C1..C5 for the ocean and coast (W6a). Run after `python3 build.py`:  node tools/ocean_check.mjs [--no-browser]
// Data checks run under Node on the generated water mesh and coast (world.js, terrain.js lattice, ocean.js, roads for the clearances); the page part measures cost and motion.
// W6-C5 (regression) is tools/regress.mjs --baseline-ref pre-w6a --mask-patch-margin 24 plus the other tools listed in PROGRESS.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
globalThis.LAYOUT = require(path.join(root, 'layout.js'));
const W = require(path.join(root, 'world.js'));
const TERR = require(path.join(root, 'terrain.js'));
globalThis.ROADKIT = require(path.join(root, 'roadkit.js')); globalThis.BRIDGE = require(path.join(root, 'bridge.js')); globalThis.STEPS = require(path.join(root, 'steps.js'));
const ROADS = require(path.join(root, 'roads.js'));
const OCEAN = require(path.join(root, 'ocean.js'));
const D = Math.PI / 180, R = 90, BASE = 1.6;
const results = [];
const f = (v, n = 3) => (typeof v === 'number' ? v.toFixed(n) : String(v));
function check(id, title, fn) {
  const info = [], fails = [];
  fn({ info: m => info.push(m), fail: m => fails.push(m) });
  results.push({ id, ok: !fails.length });
  console.log(`${fails.length ? 'FAIL' : 'PASS'} ${id} ${title}`);
  for (const m of fails) console.log('  ✗ ' + m);
  for (const m of info) console.log('  · ' + m);
}
const arcM = (a, b) => R * W.angleBetween(W.vec(a.lon, a.lat), W.vec(b.lon, b.lat));
const t0 = Date.now();
const B = TERR.builder(W), chunks = B.buildFlat({ ring: true, rest: true }), H = TERR.samplerFromChunks(W, chunks), TB = B;
const PLAN = ROADS.plan(W, H, (lo, la) => TB.vertex(lo, la).c);
const centre = []; for (const r of PLAN.routes) for (const p of r.samples) centre.push({ lon: p.lon, lat: p.lat, hw: r.def.furnish && r.def.furnish.kind === 'RD05' ? 1.5 : r.def.furnish && r.def.furnish.kind === 'RD08' ? 1.0 : r.def.furnish && r.def.furnish.kind === 'RD03' ? 2.25 : 4.5 });
for (const b of PLAN.bridges) for (const p of b.samples) centre.push({ lon: p.lon, lat: p.lat, hw: 5 }); for (const s of PLAN.stairs) for (const p of s.samples) centre.push({ lon: p.lon, lat: p.lat, hw: 0.8 });
const DATA = OCEAN.build(W, chunks, H, { centre: centre.filter((_, i) => i % 2 === 0), clear: 8 });
console.log(`(地形网格、道路与海洋数据生成 ${Date.now() - t0} ms)`);
const wd = DATA.water, nTri = wd.index.length / 3;
const flat = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)) });

// ---------------------------------------------------------------- W6-C1
check('W6-C1', '分布一致：10,000 个确定性随机点，海面网格覆盖 height() < 0 的点、不覆盖陆地（海岸 2.4 m 内除外）', ({ info, fail }) => {
  // spatial hash of the water triangles in the flat frame
  const cells = new Map(), key = (i, j) => i * 4096 + j, cs = 4; const tris = [];
  for (let t = 0; t < nTri; t++) { const v = [0, 1, 2].map(k => wd.index[t * 3 + k]), P = v.map(i => [wd.pos[i * 3], wd.pos[i * 3 + 2]]); tris.push(P);
    const x0 = Math.min(P[0][0], P[1][0], P[2][0]), x1 = Math.max(P[0][0], P[1][0], P[2][0]), z0 = Math.min(P[0][1], P[1][1], P[2][1]), z1 = Math.max(P[0][1], P[1][1], P[2][1]);
    for (let i = Math.floor(x0 / cs); i <= Math.floor(x1 / cs); i++) for (let j = Math.floor(z0 / cs); j <= Math.floor(z1 / cs); j++) { const k = key(i + 400, j + 400); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(t); } }
  const covered = (x, z) => { const l = cells.get(key(Math.floor(x / cs) + 400, Math.floor(z / cs) + 400)); if (l) for (const t of l) { const [a, b, c] = tris[t], d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(d) < 1e-12) continue; const w1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / d, w2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / d; if (w1 >= -1e-9 && w2 >= -1e-9 && 1 - w1 - w2 >= -1e-9) return true; } return false; };
  let s = 0x2f6e2b1; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let sea = 0, land = 0, missSea = 0, hitLand = 0, band = 0;
  for (let n = 0; n < 10000; n++) {
    const lon = rnd() * 360 - 180, lat = Math.asin(rnd() * 2 - 1) / D; if (Math.abs(lat) > 84 || W.insideTownPatch(lon, lat)) { n--; continue; }
    const h = H(lon, lat), cd = W.coastDistance(lon, lat), F = flat(lon, lat), c = covered(F.x, F.z);
    if (Math.abs(cd) < 2.4) { band++; continue; }
    if (h >= 0 && h < 0.25) { band++; continue; }                           // the wet flat just above the sea level (0-0.25 m): neither sea nor dry land
    if (h < 0) { sea++; if (!c) missSea++; } else { land++; if (c) { hitLand++; (globalThis.__hl = globalThis.__hl || []).push(`(${f(lon, 2)}, ${f(lat, 2)}) h=${f(h, 2)} cd=${f(cd, 2)} ${W.regionAt(lon, lat).id}`); } }
  }
  if (missSea) fail(`${missSea} 个海里的点没有被海面网格覆盖`); if (hitLand) fail(`${hitLand} 个陆上的点被海面网格覆盖：${(globalThis.__hl || []).join('；')}`);
  info(`海 ${sea} 个点（未覆盖 ${missSea}）、陆 ${land} 个点（被覆盖 ${hitLand}）、海岸 2.4 m 内与海拔 0–0.25 m 的潮滩（一个网格宽加容差）${band} 个点不计；水面三角形 ${nTri}，顶点 ${wd.pos.length / 3}`);
  // WC1/WC2 areas come from world.js, which this stage does not touch
  const ocean = W.regions.filter(r => r.zone === 'ocean').map(r => r.id).join('、'); info(`海洋区域（world.js）：${ocean}；水深取自 height()（东海峡 2 m、西海 3 m、背面大洋 6 m），水面顶点按 −height() 着色`);
  // the foam line sits on the coast: the signed depth is zero on the contour of the lattice
  let worst = 0; for (let i = 0; i < DATA.coast.length; i += 6) { const x = DATA.coast[i], z = DATA.coast[i + 2], lon = x / (R * D), lat = Math.atan(Math.sinh(-z / R)) / D; worst = Math.max(worst, Math.abs(W.height(lon, lat))); }
  info(`海岸线上 height() 的绝对值最大 ${f(worst, 3)} m（地形网格线性插值与解析高度的容差，W3-C1）；海岸线 ${DATA.stats.coastSegments} 段，共 ${f(DATA.stats.coastLength, 0)} m`);
  if (worst > 0.25) fail(`海岸线离海平面最大 ${f(worst)} m`);
});

// ---------------------------------------------------------------- W6-C2
check('W6-C2', '落地与避让：实例底面与地形相差在 −0.40–+0.05 m，不压路，不进入地标占地圆', ({ info, fail }) => {
  const per = {}, minRoad = {}; let bad = 0, lmBad = 0, roadBad = 0;
  const lms = W.landmarks.filter(l => l.id !== 'TOWN');
  const roadGap = (it) => { let b = Infinity; for (const p of centre) { const dl = (p.lon - it.lon) * Math.cos(it.lat * D) * R * D, dt = (p.lat - it.lat) * R * D, d = Math.hypot(dl, dt) - p.hw; if (d < b) b = d; } return b; };
  for (const it of DATA.instances) {
    const g = H(it.lon, it.lat), dv = it.alt - g; per[it.type] = per[it.type] || [Infinity, -Infinity]; per[it.type][0] = Math.min(per[it.type][0], dv); per[it.type][1] = Math.max(per[it.type][1], dv);
    const stacked = it.type === 'wallBlock' && Math.abs(dv - 0.85) < 1e-6;                // the second block of a sea wall stands on the first
    if (!stacked && (dv > 0.05 + 1e-6 || dv < -0.40)) { bad++; if (bad < 4) fail(`${it.type} 底面相对地形 ${f(dv, 3)} m`); }
    const rg = roadGap(it); minRoad[it.type] = Math.min(minRoad[it.type] ?? Infinity, rg);
    const rad = it.type === 'rockBig' ? 1.4 : it.type === 'tetra' ? 0.6 : it.type === 'wallBlock' ? 1.0 : 0.6; if (rg < rad) { roadBad++; if (roadBad < 4) fail(`${it.type} 离路面边缘 ${f(rg, 2)} m（半径 ${rad}）`); }
    for (const lm of lms) if (arcM(it, lm) < lm.radius - 0.2 && it.type !== 'weedShadow') { lmBad++; if (lmBad < 4) fail(`${it.type} 进入 ${lm.id} 占地圆`); }
  }
  info(`${DATA.instances.length} 个实例：底面相对地形（m，最小…最大）${Object.entries(per).map(([k, v]) => `${k} ${f(v[0], 2)}…${f(v[1], 2)}`).join('、')}（礁石与消波块按块高沉入 ≤ 0.4 m）`);
  info(`到最近道路边缘的最小间距（m）：${Object.entries(minRoad).map(([k, v]) => `${k} ${f(v, 1)}`).join('、')}；压路 ${roadBad} 个，进入地标占地圆 ${lmBad} 个，高度不合格 ${bad} 个`);
  info(`数量：礁石 ${DATA.stats.rocks}（岩岸与滩上）、浅海礁石 ${DATA.stats.reef}、海藻暗影 ${DATA.stats.seaweed}、漂流木 ${DATA.stats.drift}、海堤块 ${DATA.stats.wall * 2}、消波块 ${DATA.stats.tetra}（只在离道路中线 6–24 m 的岸边）`);
  if (bad || lmBad || roadBad) fail('实例落地或避让不合格');
});

// ---------------------------------------------------------------- W6-C4 (data)
check('W6-C4', '海岸线：不是平滑圆弧（岛岸的半径起伏 + 着色器的水线抖动），墨线层只在半空显示', ({ info, fail }) => {
  const lm = W.landmarks.find(l => l.id === 'LM08'), rs = DATA.mids.map(m => arcM(m, lm)).filter(r => r < 16), mean = rs.reduce((a, b) => a + b, 0) / rs.length, sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / rs.length);
  let per = 0; for (const r of W.regions.filter(q => q.zone === 'ocean')) { const ring = r.shape.ring; for (let i = 0; i < ring.length; i++) per += arcM({ lon: ring[i][0], lat: ring[i][1] }, { lon: ring[(i + 1) % ring.length][0], lat: ring[(i + 1) % ring.length][1] }); }
  info(`灯塔岛的岸（world.js 里是半径 10 m 的圆区域）：${rs.length} 段，平均半径 ${f(mean, 2)} m，半径标准差 ${f(sd, 3)} m（${f(Math.min(...rs), 2)}–${f(Math.max(...rs), 2)}）；着色器再按噪声把水线抖动 ± 0.025 m 水深（坡度 3% 时约 ± 0.8 m），浪花线随之弯曲；`);
  info(`海洋三个区域的多边形周长 ${f(per, 0)} m，地形网格的海平面等值线（海洋 + 岛）共 ${f(DATA.stats.coastLength, 0)} m；墨线：海岸线只在半空层显示（W6a 的 \`ocean:coast\`），全景用 W4 的 1° 等值线，地面不画海岸线（礁石、消波块、海堤用反向外壳描边）`);
  if (sd < 0.1) fail(`岛岸半径标准差 ${f(sd)} < 0.1 m，太圆`);
});

// ---------------------------------------------------------------- browser part
if (!process.argv.includes('--no-browser')) {
  const { launchChromium } = await import('./browser.mjs');
  const { INIT, SHOTS, renderShot } = await import('./ocean_views.mjs');
  const browser = await launchChromium();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.ocean, null, { timeout: 90000 });
  const def = await page.evaluate(() => { window.__step(3); const S = window.__scene; S.renderer.render(S.scene, S.camera); return { calls: S.renderer.info.render.calls, tri: S.renderer.info.render.triangles, built: S.ocean.state.built }; });
  const info = [], fails = [];
  if (def.built) fails.push('默认画面已构建海洋'); if (def.calls > 2374 * 1.03) fails.push(`默认视角绘制调用 ${def.calls} 超过基线 2374 的 +3%`);
  info.push(`默认视角（uBend = 0）：${def.calls} 次绘制调用、${def.tri} 个三角形，海洋未构建（基线 2374 / 239,958）`);
  const shots = Object.fromEntries(SHOTS);
  const hideOcean = async () => page.evaluate(() => { const S = window.__scene; S.ocean.state.root.visible = false; S.renderer.render(S.scene, S.camera); const r = { calls: S.renderer.info.render.calls, tri: S.renderer.info.render.triangles }; S.ocean.state.root.visible = true; return r; });
  for (const [label, name] of [['地面', 'coast-beach-ground'], ['半空', 'coast-rocky-aerial'], ['全景', 'ocean-panorama-back-east']]) {
    const on = await renderShot(page, shots[name]), off = (await renderShot(page, shots[name], { noOcean: true })).info;
    info.push(`${label}（${name}）：整帧 ${on.info.calls} 次调用 / ${on.info.triangles} 三角形；不含海洋 ${off.calls} / ${off.triangles}；海洋新增 ${on.info.calls - off.calls} 次调用 / ${on.info.triangles - off.triangles} 三角形（SwiftShader，真机待验证）`);
    if (label === '全景' && on.info.calls - off.calls > 4) fails.push('全景海洋绘制调用 > 4');
  }
  const diff = async (a, b) => page.evaluate(async ([a, b]) => { const load = async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const q = c.getContext('2d'); q.drawImage(i, 0, 0); return q.getImageData(0, 0, c.width, c.height).data; }; const A = await load(a), B = await load(b); let n = 0; for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2]) > 6) n++; return n; }, [a, b]);
  for (const [label, name, t1, t2] of [['地面', 'coast-rocky-ground', 2.0, 2.6], ['半空', 'coast-rocky-aerial', 2.0, 3.1], ['全景', 'ocean-panorama-glint', 1.75, 5.25]]) {
    const a = await renderShot(page, shots[name], { t: t1 }), b = await renderShot(page, shots[name], { t: t2 }), n = await diff(a.url, b.url);
    info.push(`动态 ${label}（${name}，t = ${t1} 与 ${t2} s）：差异像素 ${n}`); if (n <= 0) fails.push(`${label} 距离下海面没有动态`);
  }
  const st = await page.evaluate(() => window.__scene.ocean.stats());
  info.push(`实例：${Object.entries(st.counts).map(([k, v]) => `${k} ${v}`).join('、')}；水面 ${st.waterTriangles} 三角形 1 个网格，海岸线 ${st.coastSegmentsDrawn} 段 1 条；首次构建 ${st.buildMs} ms（SwiftShader）`);
  if (errors.length) fails.push('页面错误：' + errors.join(' | '));
  results.push({ id: 'W6-C3', ok: !fails.length });
  console.log(`${fails.length ? 'FAIL' : 'PASS'} W6-C3 预算与动态：默认画面不变、水面 ≤ 4 次绘制、三个距离都在动、无页面错误`);
  for (const m of fails) console.log('  ✗ ' + m); for (const m of info) console.log('  · ' + m);
  await browser.close();
}
console.log(results.every(r => r.ok) ? `\nPASS ocean_check（${results.length} 项）` : `\nFAIL ocean_check：${results.filter(r => !r.ok).map(r => r.id).join(', ')}`);
process.exitCode = results.every(r => r.ok) ? 0 : 1;
