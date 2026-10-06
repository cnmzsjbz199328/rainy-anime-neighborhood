// Checks for the bend (W2). Run after `python3 build.py`:  node tools/bend_check.mjs
//   1. API: window.__scene.bend { get, set, R }; uBend = 0 leaves culling and lights as they were
//   2. point lights follow the bent position: matrix position vs the analytic formula of W2_SPEC section 3 (error < 1e-4)
//   3. the GPU vertex path agrees with that formula: probe quads land where the projected bent points say (<= 1.5 px)
//   4. normals: a flat probe facing up is shaded with the rotated normal (MeshNormalMaterial colour within 3/255)
//   5. frustum culling is switched off while bent and restored afterwards; cost in draw calls, triangles, frame time, programs
//   6. no page errors
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.__scene && window.__scene.bend);
await page.waitForTimeout(1500);

const out = await page.evaluate(async () => {
  const S = window.__scene, B = S.bend, R = 90, res = {}, startView = S.view.get();
  const render = () => S.renderer.render(S.scene, S.camera);
  const frames = (n = 2) => new Promise(res => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });   // let the scene's own loop move the camera
  // independent analytic mapping (written out again from the spec, not taken from bend.js)
  const analytic = (x, y, z, u) => {
    const gd = t => Math.atan(Math.sinh(t)), phi = -gd(z / R), lam = x / R, s = 1 / Math.cosh(z / R), k = R + y * s;
    const P = [k * Math.cos(phi) * Math.sin(lam), -R + k * Math.cos(phi) * Math.cos(lam), -k * Math.sin(phi)];
    return [x + (P[0] - x) * u, y + (P[1] - y) * u, z + (P[2] - z) * u];
  };
  res.api = { get: typeof B.get, set: typeof B.set, R: B.R };
  // objects with culling on, before any bend
  const meshes = []; S.scene.traverse(o => { if (o.isMesh || o.isLine || o.isPoints || o.isSprite) meshes.push(o); });
  const culledBefore = meshes.filter(o => o.frustumCulled).length;
  const lights = []; S.scene.traverse(o => { if (o.isPointLight) lights.push(o); });
  const flatLight = lights.map(l => { render(); const p = new l.position.constructor().setFromMatrixPosition(l.matrixWorld); return p.toArray(); });
  // 2. lights
  res.lights = { count: lights.length, maxError: 0, atZero: 0 };
  for (const u of [0.25, 0.5, 0.75, 1]) {
    B.set(u); render();
    lights.forEach((l, i) => {
      const f = flatLight[i], want = analytic(f[0], f[1], f[2], u), got = new l.position.constructor().setFromMatrixPosition(l.matrixWorld).toArray();
      res.lights.maxError = Math.max(res.lights.maxError, ...want.map((v, k) => Math.abs(v - got[k])));
    });
  }
  B.set(1); render(); render();   // a second pass must not bend twice
  lights.forEach((l, i) => { const f = flatLight[i], want = analytic(f[0], f[1], f[2], 1), got = new l.position.constructor().setFromMatrixPosition(l.matrixWorld).toArray(); res.lights.maxError = Math.max(res.lights.maxError, ...want.map((v, k) => Math.abs(v - got[k]))); });
  B.set(0); render();
  lights.forEach((l, i) => { const got = new l.position.constructor().setFromMatrixPosition(l.matrixWorld).toArray(); res.lights.atZero = Math.max(res.lights.atZero, ...got.map((v, k) => Math.abs(v - flatLight[i][k]))); });
  // 5a. culling restored
  res.cull = { before: culledBefore, afterZero: meshes.filter(o => o.frustumCulled).length };
  B.set(1); res.cull.bound = meshes.filter(o => o.frustumCulled).length;                      // default mode keeps the flags
  B.setCullMode('off'); res.cull.whileOff = meshes.filter(o => o.frustumCulled).length;        // literal spec mode switches them off
  B.set(0); res.cull.restored = meshes.filter(o => o.frustumCulled).length; B.setCullMode('bound');

  // 3 + 4. probes: unlit magenta quads (position) and normal-material quads (normal)
  const THREE = window.THREE;
  const probes = [[40, 1.5, 15], [-40, 1.5, 15], [0, 1.5, 0], [0, 1.5, 40], [0, 1.5, -40]];   // above road centres: clear of markings and kerbs
  const group = new THREE.Group(); S.scene.add(group);
  const pm = new THREE.MeshBasicMaterial({ color: 0xff00ff }), nm = new THREE.MeshNormalMaterial();
  const makeProbe = ([x, y, z], mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2).rotateX(-Math.PI / 2), mat); m.position.set(x, y, z); group.add(m); return m; };
  S.view.set({ yaw: 0.6, pitch: 0.9, dist: 120, target: [0, 0, 0] }); await frames();
  const gl = S.renderer.getContext(), W = S.renderer.domElement.width, H = S.renderer.domElement.height;
  const project = p => { const v = new THREE.Vector3(p[0], p[1], p[2]).project(S.camera); return [(v.x * 0.5 + 0.5) * W, (1 - (v.y * 0.5 + 0.5)) * H]; };
  res.pos = []; res.normal = [];
  for (const u of [0.5, 1]) {
    B.set(u); await frames();
    for (const kind of ['pos', 'normal']) {
      group.clear();
      const ms = probes.map(p => makeProbe(p, kind === 'pos' ? pm : nm));
      S.camera.updateMatrixWorld(); S.scene.updateMatrixWorld(true); render();
      const buf = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      probes.forEach((p, i) => {
        const b = analytic(p[0], p[1], p[2], u), e = project(b);
        if (kind === 'pos') {
          // centroid of magenta pixels within 14 px of the expected point
          let sx = 0, sy = 0, n = 0;
          for (let y = Math.max(0, Math.round(e[1]) - 14); y < Math.min(H, Math.round(e[1]) + 14); y++) for (let x = Math.max(0, Math.round(e[0]) - 14); x < Math.min(W, Math.round(e[0]) + 14); x++) {
            const k = ((H - 1 - y) * W + x) * 4; if (buf[k] > 110 && buf[k + 2] > 110 && buf[k + 1] < 0.55 * Math.min(buf[k], buf[k + 2])) { sx += x; sy += y; n++; }
          }
          res.pos.push({ u, probe: i, pixels: n, error: n ? Math.hypot(sx / n - e[0], sy / n - e[1]) : null });
        } else {
          // expected view-space normal of the rotated up vector
          const lam = p[0] / R, phi = -Math.atan(Math.sinh(p[2] / R)), up = [Math.cos(phi) * Math.sin(lam), Math.cos(phi) * Math.cos(lam), -Math.sin(phi)];
          const n = [u * up[0], 1 + u * (up[1] - 1), u * up[2]]; const len = Math.hypot(...n); n[0] /= len; n[1] /= len; n[2] /= len;
          const nv = new THREE.Vector3(n[0], n[1], n[2]).transformDirection(S.camera.matrixWorldInverse);
          const want = [nv.x * 0.5 + 0.5, nv.y * 0.5 + 0.5, nv.z * 0.5 + 0.5].map(v => v * 255);
          const cx = Math.round(e[0]), cy = Math.round(e[1]), k = ((H - 1 - cy) * W + cx) * 4, got = [buf[k], buf[k + 1], buf[k + 2]];
          res.normal.push({ u, probe: i, got, want: want.map(Math.round), error: Math.max(...got.map((v, j) => Math.abs(v - want[j]))) });
        }
      });
    }
  }
  S.scene.remove(group); B.set(0);

  // 5b. cost and culling: draw calls, triangles, mean render time per cull mode; 'bound' and 'off' must draw the same image
  const cost = {}, hash = () => { const W2 = S.renderer.domElement.width, H2 = S.renderer.domElement.height, b = new Uint8Array(W2 * H2 * 4); gl.readPixels(0, 0, W2, H2, gl.RGBA, gl.UNSIGNED_BYTE, b); let h = 2166136261; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
  const measure = async (name, v) => {
    S.view.set(v); await frames(3);
    const row = {};
    for (const [label, u, mode] of [['flat', 0, 'bound'], ['bound', 1, 'bound'], ['off', 1, 'off'], ['bound.5', 0.5, 'bound'], ['off.5', 0.5, 'off']]) {
      B.set(u); B.setCullMode(mode);
      for (let i = 0; i < 3; i++) render();
      const t0 = performance.now(); for (let i = 0; i < 6; i++) render(); const ms = (performance.now() - t0) / 6;
      render(); row[label] = { calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles, ms: Math.round(ms * 10) / 10, hash: hash() };
    }
    B.set(0); B.setCullMode('bound');
    cost[name] = row;
  };
  S.view.set({ mode: 'free' });
  await measure('start', { yaw: startView.yaw, pitch: startView.pitch, dist: startView.dist, target: startView.target });
  await measure('far', { yaw: 2.5, pitch: 0.82, dist: 140, target: [0, 0, 0] });
  await measure('intersection', { yaw: 1.57, pitch: 0.2, dist: 16, target: [0, 0.3, 15] });
  await measure('storeCorner', { yaw: 2.75, pitch: 0.2, dist: 13, target: [-9, 1.4, 22] });
  res.cost = cost; res.programs = S.renderer.info.programs.length;
  return res;
});

const ok = (cond, name, detail) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); return cond; };
let all = true;
all &= ok(out.api.get === 'function' && out.api.set === 'function' && out.api.R === 90, 'window.__scene.bend { get, set, R = 90 }');
all &= ok(out.lights.count > 0 && out.lights.maxError < 1e-4, '点光源位置与解析映射一致', `${out.lights.count} 盏，uBend 0.25/0.5/0.75/1 与重复渲染的最大误差 ${out.lights.maxError.toExponential(2)}`);
all &= ok(out.lights.atZero === 0, 'uBend 回到 0 后点光源位置与原来逐位相同', `最大差 ${out.lights.atZero}`);
all &= ok(out.cull.afterZero === out.cull.before && out.cull.bound === out.cull.before && out.cull.whileOff === 0 && out.cull.restored === out.cull.before, '视锥剔除标志：默认模式不改，关闭模式全关，回 0 后恢复', `开 ${out.cull.before} → 弯曲(包围球模式) ${out.cull.bound} → 弯曲(关闭模式) ${out.cull.whileOff} → 恢复 ${out.cull.restored}`);
const posBad = out.pos.filter(r => r.error === null || r.error > 1.5);
all &= ok(posBad.length === 0, 'GPU 顶点位置与投影后的解析点一致（≤ 1.5 px）', out.pos.map(r => `u=${r.u}#${r.probe}:${r.error === null ? '未命中' : r.error.toFixed(2) + 'px'}`).join(' '));
const nBad = out.normal.filter(r => r.error > 3);
all &= ok(nBad.length === 0, '法线随映射旋转（MeshNormalMaterial 颜色误差 ≤ 3/255）', out.normal.map(r => `u=${r.u}#${r.probe}:${r.error}`).join(' '));
for (const [name, row] of Object.entries(out.cost)) {
  const f = row.flat, b = row.bound, o = row.off;
  console.log(`INFO ${name}：uBend 0 → 1  绘制调用 ${f.calls} → ${b.calls}（剔除用弯曲包围球，${((b.calls / f.calls - 1) * 100).toFixed(1)}%）/ ${o.calls}（关闭剔除，${((o.calls / f.calls - 1) * 100).toFixed(1)}%）；三角形 ${f.triangles} → ${b.triangles} / ${o.triangles}；渲染耗时 ${f.ms} → ${b.ms} / ${o.ms} ms（SwiftShader，仅供对比）`);
  all &= ok(row.bound.hash === row.off.hash && row['bound.5'].hash === row['off.5'].hash, `${name}：弯曲包围球剔除与不剔除画面逐位相同（uBend 1 与 0.5）`);
}
console.log(`INFO 着色器程序数 ${out.programs}`);
all &= ok(errors.length === 0, '无页面错误', errors.join(' | '));
await browser.close();
console.log(all ? 'PASS bend_check' : 'FAIL bend_check');
process.exit(all ? 0 : 1);
