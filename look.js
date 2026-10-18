// One world-wide controller for ink distance, light presets and the shared object materials.
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6;
const flatOf = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) });
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const PARAMS = Object.freeze({
  inkColor: 0x273647, utilityWireColor: 0x1f2a38, inkPixels: 1.5,
  focusMin: 4, focusMax: 300, focusFallback: 25, widthMin: 0.008, widthMax: 0.2,
  groundNear: 8, groundFar: 22, panoramaNear: 70, panoramaFar: 150,
  light: Object.freeze({ rainy: [1, 1, 1], panorama: [1.5, 1.5, 0], neutral: [2.8, 1.6, 0] }),
  treeSway: Object.freeze({ x: 0.1, z: 0.07, xRate: 0.9, zRate: 0.7 })
});

const LOOK = {};
LOOK.PARAMS = PARAMS;
LOOK.attach = function (scene, ctx, BEND, TERR) {
  const THREE = global.THREE, W = global.WORLD, light0 = { hemi: ctx.lights.hemi.intensity, moon: ctx.lights.moon.intensity, fog: scene.fog.density };
  const S = { built: false, stats: {}, root: null, globalInkGroup: null, settings: { light: 'rainy', ink: 'auto' },
    ink: { ground: 1, aerial: 0, panorama: 0, width: 0.03, distance: 0 }, materials: null };
  const objs = { lines: [] }, TIME = { value: 0 }, kit = global.FLORA.make(THREE);
  const floraMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, side: THREE.DoubleSide });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const groundMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  groundMat.onBeforeCompile = global.WEATHER_FX.snowCover;
  const sway = `float sw = smoothstep(1.2, 7.0, position.y); transformed.x += sin(uTime * ${PARAMS.treeSway.xRate} + instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.21) * ${PARAMS.treeSway.x} * sw; transformed.z += cos(uTime * ${PARAMS.treeSway.zRate} + instanceMatrix[3].z * 0.3) * ${PARAMS.treeSway.z} * sw;`;
  const treeMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, side: THREE.DoubleSide });
  treeMat.onBeforeCompile = shader => { shader.uniforms.uTime = TIME; shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\n' + sway); };
  treeMat.customProgramCacheKey = () => 'bend|treeSway';
  const inkW = { value: 0.03 }, mkHull = tree => {
    const m = new THREE.MeshBasicMaterial({ color: PARAMS.inkColor, side: THREE.BackSide, transparent: true, opacity: 1 });
    m.onBeforeCompile = shader => { shader.uniforms.uInkW = inkW; shader.uniforms.uTime = TIME;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 hnormal;\nuniform float uInkW;\nuniform float uTime;').replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + hnormal * uInkW;' + (tree ? sway : '')); };
    m.customProgramCacheKey = () => 'bend|hull|' + tree; return m;
  };
  const hullMat = mkHull(false), treeHullMat = mkHull(true);
  const lineMat = (opacity = 1) => new THREE.LineBasicMaterial({ color: PARAMS.inkColor, transparent: true, opacity, userData: { inkFog: true } });
  S.materials = { floraMat, treeMat, glowMat, groundMat, hullMat, treeHullMat, inkW };
  const root = new THREE.Group(); root.name = 'look'; root.visible = false; scene.add(root); S.root = root;

  function buildGlobalInk() {
    const t0 = Date.now(), group = new THREE.Group(), step = 1; group.name = 'look:global-ink'; root.add(group); S.globalInkGroup = group;
    const nx = 360 / step, ny = 170 / step;
    const sample = fn => { const g = new Float32Array((nx + 1) * (ny + 1)); for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) g[j * (nx + 1) + i] = fn(-180 + i * step, -85 + j * step); return g; };
    const contour = (grid, level, altOff) => {
      const out = [], at = (i, j) => grid[j * (nx + 1) + (i % (nx + 1))];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = at(i, j) - level, b = at(i + 1, j) - level, c = at(i + 1, j + 1) - level, d = at(i, j + 1) - level;
        const lon = -180 + i * step, lat = -85 + j * step, pts = [];
        const cross = (p, q, x0, y0, x1, y1) => { if ((p > 0) !== (q > 0)) { const t = p / (p - q); pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); } };
        cross(a, b, lon, lat, lon + step, lat); cross(b, c, lon + step, lat, lon + step, lat + step); cross(c, d, lon + step, lat + step, lon, lat + step); cross(d, a, lon, lat + step, lon, lat);
        if (pts.length === 2) { const f0 = flatOf(pts[0][0], pts[0][1]), f1 = flatOf(pts[1][0], pts[1][1]); out.push(f0.x, (altOff - BASE) * f0.k, f0.z, f1.x, (altOff - BASE) * f1.k, f1.z); }
      }
      return out;
    };
    const add = segs => { if (!segs.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); g.computeBoundingSphere(); const line = new THREE.LineSegments(g, lineMat(0)); line.name = 'look:ink:global'; line.matrixAutoUpdate = false; group.add(line); objs.lines.push(line); };
    add(contour(sample((lo, la) => W.coastDistance(lo, la)), 0, 0.2));
    add(contour(sample((lo, la) => W.height(lo, la)), 10, 10.2));
    const ice = []; for (const r of W.regions.filter(q => q.zone === 'ice')) for (let lon = -180; lon < 180; lon += 1) {
      const a = r.shape.edge(lon), b = r.shape.edge(lon + 1), fa = flatOf(lon, a), fb = flatOf(lon + 1, b); ice.push(fa.x, (2.6 - BASE) * fa.k, fa.z, fb.x, (2.6 - BASE) * fb.k, fb.z);
    }
    add(ice); S.stats.globalInkMs = Date.now() - t0;
  }
  const inkJob = global.TERRAIN.job(function* () { buildGlobalInk(); if (BEND.seamSplit) BEND.seamSplit(S.globalInkGroup); root.visible = true; S.built = true; return root; });
  const distance = camera => { const u = BEND.get(), flat = camera.position.y, sphere = Math.hypot(camera.position.x, camera.position.y + R, camera.position.z) - R; return Math.max(0.5, flat + (sphere - flat) * u); };
  const camLast = new THREE.Vector3(), fwd = new THREE.Vector3(), oc = new THREE.Vector3();
  function applyLight() {
    const preset = PARAMS.light[S.settings.light] || PARAMS.light.rainy, h = ctx.lights.hemi, m = ctx.lights.moon;
    h.intensity = light0.hemi * preset[0]; m.intensity = light0.moon * preset[1]; scene.fog.density = preset[2] === 0 ? 0 : light0.fog * preset[2];
    if (ctx.lightBase) { ctx.lightBase.hemi = h.intensity; ctx.lightBase.moon = m.intensity; ctx.lightBase.fog = scene.fog.density; }
  }
  function tick(t, camera) {
    TIME.value = t;
    if (!S.built) return;
    const d = distance(camera); S.ink.distance = d;
    const mode = S.settings.ink; let g, a, p;
    if (mode === 'ground') { g = 1; a = 0; p = 0; } else if (mode === 'aerial') { g = 0; a = 1; p = 0; } else if (mode === 'panorama') { g = 0; a = 0; p = 1; }
    else { g = 1 - smooth(PARAMS.groundNear, PARAMS.groundFar, d); p = smooth(PARAMS.panoramaNear, PARAMS.panoramaFar, d); a = Math.max(0, smooth(PARAMS.groundNear, PARAMS.groundFar, d) * (1 - p)); }
    S.ink.ground = g; S.ink.aerial = a; S.ink.panorama = p;
    camera.getWorldDirection(fwd); const bend = BEND.get(); let focus = PARAMS.focusFallback;
    if (bend > 0) { oc.set(camera.position.x, camera.position.y + R, camera.position.z); const b = oc.dot(fwd), c = oc.lengthSq() - R * R, disc = b * b - c; if (disc > 0) { const hit = -b - Math.sqrt(disc); if (hit > 0) focus = hit; } }
    else if (fwd.y < -0.02) focus = -camera.position.y / fwd.y;
    S.focus = Math.max(PARAMS.focusMin, Math.min(PARAMS.focusMax, focus));
    const wpp = 2 * Math.max(3, S.focus || d) * Math.tan(camera.fov * D / 2) / ctx.renderer.domElement.height;
    S.ink.width = Math.max(PARAMS.widthMin, Math.min(PARAMS.widthMax, PARAMS.inkPixels * wpp)); inkW.value = S.ink.width;
    hullMat.opacity = treeHullMat.opacity = g;
    for (const line of objs.lines) { line.material.opacity = p; line.visible = p > 0.01; }
    camLast.copy(camera.position); S.lodBend = bend;
  }
  const api = { tick, state: S, params: PARAMS, kit: () => kit, lineMat, jobs: { ink: inkJob },
    set(v) { if (v.light) { S.settings.light = v.light; applyLight(); } if (v.ink) S.settings.ink = v.ink; return { ...S.settings }; },
    get() { return { ...S.settings, ink: { ...S.ink }, built: S.built }; }, stats() { return { ...S.stats }; } };
  global.LOOK_API = api;
  return api;
};
if (typeof module !== 'undefined' && module.exports) module.exports = LOOK;
else global.LOOK = LOOK;
})(typeof globalThis !== 'undefined' ? globalThis : this);
