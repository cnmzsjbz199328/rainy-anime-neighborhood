// W4 sample section (ST03): town edge -> paddies -> fallow fields -> forest edge -> forest -> grass -> coast -> shallow sea, built from
// world.js through section_plan.js, with the road kit (roadkit.js), the object kit (flora.js) and the water shader (water.js).
// All geometry is stored in flat Mercator coordinates and rolled onto the sphere by bend.js (see docs/world/W3_SPEC.md section 2): every
// instance is scaled by 1/cos(lat) so that bend.js shrinks it back to its true size. The section is built lazily the first time it is
// shown (uBend > 0 or the 'section' view mode), so the default town costs nothing. Test hooks: window.__scene.section.
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const SECTION = {};
SECTION.attach = function (scene, ctx, BEND, TERR) {
  const THREE = global.THREE, W = global.WORLD;
  const S = { built: false, mode: false, settings: { rain: true, light: 'rainy', ink: 'auto' }, stats: {}, root: null, ink: { ground: 1, aerial: 0, panorama: 0, width: 0.03, distance: 0 } };
  const light0 = { hemi: ctx.lights.hemi.intensity, moon: ctx.lights.moon.intensity, fog: scene.fog.density };
  let K = null, WATERK = null, PLAN = null, H = null, WS = null;   // H: height of the rendered terrain mesh; WS: world.js with height() replaced by it (for roadkit)
  const objs = { inst: [], trees: [], hulls: [], glows: [], lines: { aerial: [], coast: [], panorama: [], ground: [] }, strips: [], water: [], wires: null };

  // ---------------------------------------------------------------- helpers
  const flatOf = (lon, lat) => ({ x: R * lon * D, z: -R * Math.asinh(Math.tan(lat * D)), k: 1 / Math.cos(lat * D) });
  const groundAt = (lon, lat, dy = 0) => { const f = flatOf(lon, lat), h = H(lon, lat) + dy; return { x: f.x, y: (h - BASE) * f.k, z: f.z, k: f.k, h }; };
  const tintC = new THREE.Color(), qE = new THREE.Euler(), qQ = new THREE.Quaternion(), mP = new THREE.Vector3(), mS = new THREE.Vector3(), mM = new THREE.Matrix4();
  const matrixOf = it => {
    const g = groundAt(it.lon, it.lat, it.dy ?? it.alt0 ?? 0);
    qE.set(it.lean[0], it.yaw, it.lean[1], 'YXZ'); qQ.setFromEuler(qE);
    mM.compose(mP.set(g.x, g.y, g.z), qQ, mS.set(g.k * it.s[0], g.k * it.s[1], g.k * it.s[2]));
    return mM.clone();
  };
  // roadkit records give the altitude directly
  const matrixOfAlt = it => {
    const f = flatOf(it.lon, it.lat); qE.set(it.lean[0], it.yaw, it.lean[1], 'YXZ'); qQ.setFromEuler(qE);
    mM.compose(mP.set(f.x, (it.alt - BASE) * f.k, f.z), qQ, mS.set(f.k * it.s[0], f.k * it.s[1], f.k * it.s[2]));
    return mM.clone();
  };

  function build() {
    const t0 = Date.now();
    K = global.FLORA.make(THREE); WATERK = global.WATER.make(THREE); PLAN = global.SECTION_PLAN.plan(W);
    H = global.TERRAIN.sampler(W, { lonMin: -16, lonMax: 40, latMin: -72, latMax: -27 }); WS = Object.assign(Object.create(W), { height: H });
    const root = new THREE.Group(); root.name = 'section'; scene.add(root); S.root = root;
    const inkColor = 0x273647;
    // ---- materials
    const floraMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, side: THREE.DoubleSide });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const groundMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const inkW = { value: 0.03 }, T = WATERK.uniforms;
    // canopy sway (one of the three slow motions of the section): the upper part of a tree leans a few centimetres with a slow phase per instance
    const SWAY = `float sw = smoothstep(1.2, 7.0, position.y); transformed.x += sin(uTime * 0.9 + instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.21) * 0.1 * sw; transformed.z += cos(uTime * 0.7 + instanceMatrix[3].z * 0.3) * 0.07 * sw;`;
    const treeMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, side: THREE.DoubleSide });
    treeMat.onBeforeCompile = shader => { shader.uniforms.uTime = T.uTime; shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY); };
    treeMat.customProgramCacheKey = () => 'bend|treeSway';
    const mkHull = sway => {
      const m = new THREE.MeshBasicMaterial({ color: inkColor, side: THREE.BackSide, transparent: true, opacity: 1 });
      m.onBeforeCompile = shader => { shader.uniforms.uInkW = inkW; shader.uniforms.uTime = T.uTime; shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 hnormal;\nuniform float uInkW;\nuniform float uTime;').replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + hnormal * uInkW;' + (sway ? SWAY : '')); };
      m.customProgramCacheKey = () => 'bend|hull|' + sway; return m;
    };
    const hullMat = mkHull(false), treeHullMat = mkHull(true);
    const lineMat = k => new THREE.LineBasicMaterial({ color: inkColor, transparent: true, opacity: 1, fog: false });
    S.materials = { floraMat, treeMat, glowMat, groundMat, hullMat, treeHullMat, inkW };

    // ---- instanced objects: one InstancedMesh (plus outline hull) per type
    const GLOW = { lamp: 'lampGlow', lantern: 'lanternGlow', vending: 'vendingGlow', lampSmall: 'lampSmallGlow' };
    const TREES = ['treeRound', 'cedar', 'pine', 'bamboo'];
    const all = {};
    for (const [t, list] of Object.entries(PLAN.items)) all[t] = list.map(it => ({ ...it, m: matrixOf(it) }));
    // roads: strips and instances
    const roadOut = ['T03-01', 'T03-02', 'T03-03', 'T11-01'].map(id => global.ROADKIT.build(WS, id));
    // T03-01/02/03 are swept as one chain with a gradual cross-section (asphalt -> cracked lane -> dirt track, weeds creeping in); their own strips and edge lines are replaced
    const CH = global.ROADKIT.chain(WS, ['T03-01', 'T03-02', 'T03-03']); S.chain = CH;
    for (const r of roadOut.slice(0, 3)) { r.strips = []; r.lines = {}; }
    for (const [t, list] of Object.entries(CH.instances)) (all[t] = all[t] || []).push(...list.map(it => ({ ...it, m: matrixOfAlt(it) })));
    for (const r of roadOut) for (const [t, list] of Object.entries(r.instances)) (all[t] = all[t] || []).push(...list.map(it => ({ ...it, m: matrixOfAlt(it) })));
    S.roadOut = roadOut;
    const mkInst = (name, list, geoName, withHull, mat = floraMat, hmat = hullMat) => {
      const geo = K.geometries[geoName || name]; if (!geo || !list.length) return null;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length); mesh.name = 'sec:' + name;
      list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, tintC.setRGB(it.tint[0], it.tint[1], it.tint[2])); });   // every instance gets a colour: the buffer starts black
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere();
      root.add(mesh); objs.inst.push(mesh);
      let hull = null;
      if (withHull !== false) { hull = new THREE.InstancedMesh(geo, hmat, list.length); hull.instanceMatrix = mesh.instanceMatrix; hull.count = list.length; hull.computeBoundingSphere(); hull.name = 'sec:' + name + ':ink'; root.add(hull); objs.hulls.push(hull); }
      const gname = GLOW[name];
      if (gname) { const g = new THREE.InstancedMesh(K.geometries[gname], glowMat, list.length); g.instanceMatrix = mesh.instanceMatrix; g.computeBoundingSphere(); g.name = 'sec:' + name + ':glow'; root.add(g); objs.glows.push(g); }
      return { mesh, hull };
    };
    S.counts = {};
    for (const [t, list] of Object.entries(all)) {
      S.counts[t] = list.length;
      if (TREES.includes(t)) {
        // two levels of detail: near (full) and far (simple); the assignment follows the camera (see tick)
        const near = mkInst(t, list, t, true, treeMat, treeHullMat), far = mkInst(t + '_far', list, t + '_far', false, treeMat);
        objs.trees.push({ type: t, list, near, far, last: null });
      } else if (t === 'plank' || t === 'pile' || t === 'ropePost' || t === 'lampSmall' || t === 'lifeRing' || t === 'bollard' || t === 'beam') mkInst(t, list, t, t !== 'plank' && t !== 'pile');
      else mkInst(t, list, t, !['weedShadow', 'seedling', 'tuft', 'weed', 'fern', 'flower'].includes(t));
    }
    // seedlings, tufts, weeds, ferns and flowers get no outline hull (too small / too many); everything else does

    // ---- strips: roads, town edge strips
    const stripMesh = (st, mat) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(st.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(st.col, 3));
      const nrm = new Float32Array(st.pos.length); for (let i = 0; i < nrm.length; i += 3) nrm[i + 1] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setIndex(new THREE.BufferAttribute(st.index, 1)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); m.name = 'sec:' + st.name; m.matrixAutoUpdate = false; root.add(m); objs.strips.push(m); return m;
    };
    stripMesh(CH.strip, groundMat); for (const r of roadOut) for (const st of r.strips) stripMesh(st, groundMat);
    // TR01 town edge: gravel shoulder and grass band along the patch's south edge, in the corridor
    { const pts = []; for (let lon = -9; lon <= 8.001; lon += 0.25) pts.push({ lon, lat: -W.TOWN_PATCH.latMax - 0.02, s: lon });
      stripMesh(global.ROADKIT.sweep(WS, pts, [[0, 0.03, 'gravelD'], [0.1, 0.05, 'lip'], [0.9, 0.04, 'gravel'], [1.0, 0.03, 'gravelD'], [1.1, 0.0, 'grassD'], [3.2, 0, 'grass'], [3.5, 0, 'grassD']].map(([o, l, c]) => [-o, l, c]), 'TR01 edge strip'), groundMat); }

    // ---- paddies and fallow fields: Voronoi plots on a fine grid, ridges 0.36 m wide and 0.2 m high
    { const P = PLAN.plots, nu = Math.round((P.u1 - P.u0) / P.step), nv = Math.round((P.v1 - P.v0) / P.step);
      const pos = [], col = [], idx = [], wpos = [], wcol = [], widx = [], vinfo = [];
      const cDry = new THREE.Color('#5d6b46'), cDry2 = new THREE.Color('#6b7650'), cFall = new THREE.Color('#66744a'), cFall2 = new THREE.Color('#7a7456'), cWater = new THREE.Color('#25414f'), cRidge = new THREE.Color('#6a604e'), cRidgeTop = new THREE.Color('#7b7260');
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const u = P.u0 + i * P.step, v = P.v0 + j * P.step, [lon, lat] = PLAN.toLL(u, v), c = PLAN.cellOf(u, v), seed = P.seeds[c.id], ridge = c.d2 - c.d1 < 0.18;
        const zk = W.regionAt(lon, lat).kind, h = H(lon, lat), rd = PLAN.roadDist(u, v);
        const farm = (zk === 'farmland' || (zk === 'ruin' && v < 23)) && h > 0.5 && rd.d > 1.0;
        const f = flatOf(lon, lat); const off = ridge ? 0.2 : seed.kind === 'water' ? -0.07 : 0.0;
        pos.push(f.x, (h + off + 0.03 - BASE) * f.k, f.z);
        let c3 = ridge ? cRidge.clone().lerp(cRidgeTop, 0.5 + 0.5 * Math.sin(u * 7 + v * 5)) : seed.kind === 'water' ? cWater : seed.kind === 'dry' ? (Math.sin(u * 5.2) > 0 ? cDry : cDry2) : (Math.sin(u * 3 + v * 4) > 0.2 ? cFall : cFall2);
        if (!ridge && seed.kind === 'fallow') c3 = c3.clone().multiplyScalar(0.85 + 0.3 * (0.5 + 0.5 * Math.sin(u * 11 + v * 7)));
        col.push(c3.r, c3.g, c3.b);
        vinfo.push({ farm, water: seed.kind === 'water' && !ridge, id: c.id, h });
        const hw = h - 0.02 - 0.0; wpos.push(f.x, (hw - BASE) * f.k, f.z);
      }
      const nrm = new Float32Array(pos.length); for (let i = 0; i < nrm.length; i += 3) nrm[i + 1] = 1;
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1, va = vinfo[a], vb = vinfo[b], vc = vinfo[c], vd = vinfo[d];
        if (va.farm && vb.farm && vc.farm && vd.farm) idx.push(a, c, b, b, c, d);
        if (va.water && vb.water && vc.water && vd.water && va.id === vb.id && va.id === vc.id && va.id === vd.id) widx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setIndex(idx); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, groundMat); m.name = 'sec:plots'; m.matrixAutoUpdate = false; root.add(m); objs.strips.push(m); S.stats.plotTriangles = idx.length / 3;
      // water in the paddy plots (same grid, ripple material)
      const wc = new Float32Array((wpos.length / 3) * 4), ws = new Float32Array(wpos.length / 3);
      for (let i = 0; i < wc.length; i += 4) { wc[i] = 0.12; wc[i + 1] = 0.26; wc[i + 2] = 0.34; wc[i + 3] = 0.55; }
      ws.fill(9);
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3)); wg.setAttribute('color', new THREE.BufferAttribute(wc, 4)); wg.setAttribute('aShore', new THREE.BufferAttribute(ws, 1)); wg.setIndex(widx); wg.computeBoundingSphere();
      const wm = new THREE.Mesh(wg, WATERK.paddy); wm.name = 'sec:paddy-water'; wm.matrixAutoUpdate = false; wm.renderOrder = 2; root.add(wm); objs.water.push(wm); S.stats.paddyWaterTriangles = widx.length / 3;
    }

    // ---- sea water: grid over the gulf, fading to transparent at the shoreline; the foam line breathes along it
    { const u0 = -16, u1 = 42, v0 = 36, v1 = 63.5, st = 0.5, nu = Math.round((u1 - u0) / st), nv = Math.round((v1 - v0) / st);
      const pos = [], col = [], shore = [], idx = [], hh = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
        const u = u0 + i * st, v = v0 + j * st, [lon, lat] = PLAN.toLL(u, v), f = flatOf(lon, lat), h = W.height(lon, lat), reg = W.regionAt(lon, lat), depth = Math.max(0, -h);
        pos.push(f.x, (0.0 - BASE + 0.01) * f.k, f.z); hh.push(reg.zone === 'ocean' ? h : 1);
        const t = Math.min(1, depth / 0.7), a = reg.zone === 'ocean' ? smooth(0.0, 0.18, depth) * (0.78 - 0.2 * t) : 0;
        const c = new THREE.Color('#44687c').lerp(new THREE.Color('#1a2f58'), t); col.push(c.r, c.g, c.b, a); shore.push(reg.zone === 'ocean' ? depth : 9);
      }
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; if (hh[a] < 0 || hh[b] < 0 || hh[c] < 0 || hh[d] < 0) idx.push(a, c, b, b, c, d); }
      const nrm = new Float32Array(pos.length); for (let i = 0; i < nrm.length; i += 3) nrm[i + 1] = 1;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setAttribute('aShore', new THREE.Float32BufferAttribute(shore, 1)); g.setIndex(idx); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, WATERK.sea); m.name = 'sec:sea'; m.matrixAutoUpdate = false; m.renderOrder = 3; root.add(m); objs.water.push(m); S.stats.seaTriangles = idx.length / 3;
    }

    // ---- wires between the poles (catenary), rope rails of the boardwalk
    { const seg = [], poleLocal = [[-0.8, 7.75, 0], [0, 7.75, 0], [0.8, 7.75, 0]];
      const attach = it => { const M = matrixOf(it), p = poleLocal.map(l => new THREE.Vector3(...l).applyMatrix4(M)); return { p, k: groundAt(it.lon, it.lat).k }; };
      for (const w of PLAN.wires) {
        const A = attach(w.a), B = attach(w.b);
        for (let c = 0; c < 3; c++) { let prev = null; for (let n = 0; n <= 10; n++) { const t = n / 10, x = A.p[c].x + (B.p[c].x - A.p[c].x) * t, z = A.p[c].z + (B.p[c].z - A.p[c].z) * t, y = A.p[c].y + (B.p[c].y - A.p[c].y) * t - w.sag * 4 * t * (1 - t) * A.k; const p = [x, y, z]; if (prev) seg.push(...prev, ...p); prev = p; } }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); g.computeBoundingSphere();
      const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1f2a38, transparent: true, opacity: 0.9 })); l.name = 'sec:wires'; l.matrixAutoUpdate = false; root.add(l); objs.wires = l; S.stats.wireSegments = seg.length / 6;
      const rope = []; for (const r of roadOut) for (const line of (r.lines.ropes || [])) { let prev = null; for (const q of line) { const f = flatOf(q.lon, q.lat), p = [f.x, (q.alt - BASE) * f.k, f.z]; if (prev) rope.push(...prev, ...p); prev = p; } }
      if (rope.length) { const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rope, 3)); rg.computeBoundingSphere(); const rl = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xb59a74, transparent: true, opacity: 0.9 })); rl.name = 'sec:ropes'; rl.matrixAutoUpdate = false; root.add(rl); }
    }

    // ---- ink lines: forest edge, plot ridges, road edges, coast (aerial); coast, ridge and ice outlines (panorama)
    const addLines = (layer, segs) => { if (!segs.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); g.computeBoundingSphere(); const l = new THREE.LineSegments(g, lineMat()); l.name = 'sec:ink:' + layer; l.matrixAutoUpdate = false; root.add(l); objs.lines[layer].push(l); S.stats['ink_' + layer] = (S.stats['ink_' + layer] || 0) + segs.length / 6; };
    const poly = (pts, altOff, out) => { let prev = null; for (const q of pts) { const f = flatOf(q.lon, q.lat), a = (q.alt !== undefined ? q.alt : H(q.lon, q.lat)) + altOff, p = [f.x, (a - BASE) * f.k, f.z]; if (prev) out.push(...prev, ...p); prev = p; } };
    { const segs = [];
      // forest edge: the forest-south polygon boundary inside the corridor
      const reg = W.regions.find(r => r.id === 'forest-south'), ring = reg.shape.ring; const edge = [];
      for (let i = 0; i < ring.length; i++) for (const p of W.greatCirclePoints(ring[i], ring[(i + 1) % ring.length], 0.5)) { const uv = PLAN.toUV(p[0], p[1]); if (Math.abs(uv.u) < 16 && uv.v > 14 && uv.v < 36) edge.push({ lon: p[0], lat: p[1], u: uv.u, v: uv.v }); }
      // polylines per consecutive run
      let run = []; const flush = () => { if (run.length > 1) poly(run, 0.12, segs); run = []; };
      for (let i = 0; i < edge.length; i++) { if (run.length && Math.hypot(edge[i].u - run[run.length - 1].u, edge[i].v - run[run.length - 1].v) > 2) flush(); run.push(edge[i]); } flush();
      // plot ridges: boundaries between neighbouring cells on the fine grid
      const P = PLAN.plots, nu = Math.round((P.u1 - P.u0) / P.step), nv = Math.round((P.v1 - P.v0) / P.step), cellId = [];
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) cellId.push(PLAN.cellOf(P.u0 + i * P.step, P.v0 + j * P.step).id);
      const farmAt = (u, v) => { const [lon, lat] = PLAN.toLL(u, v), k = W.regionAt(lon, lat).kind; return (k === 'farmland' || (k === 'ruin' && v < 23)) && PLAN.roadDist(u, v).d > 1.0; };
      for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
        const a = cellId[j * (nu + 1) + i], u = P.u0 + i * P.step, v = P.v0 + j * P.step;
        if (!farmAt(u + P.step / 2, v + P.step / 2)) continue;
        if (cellId[j * (nu + 1) + i + 1] !== a && i + 1 < nu) { const [lo, la] = PLAN.toLL(u + P.step, v), [lo2, la2] = PLAN.toLL(u + P.step, v + P.step); poly([{ lon: lo, lat: la }, { lon: lo2, lat: la2 }], 0.26, segs); }
        if (cellId[(j + 1) * (nu + 1) + i] !== a && j + 1 < nv) { const [lo, la] = PLAN.toLL(u, v + P.step), [lo2, la2] = PLAN.toLL(u + P.step, v + P.step); poly([{ lon: lo, lat: la }, { lon: lo2, lat: la2 }], 0.26, segs); }
      }
      // road edges
      for (const r of [...roadOut, CH]) { if (r.lines.edgeL) poly(r.lines.edgeL, 0, segs); if (r.lines.edgeR) poly(r.lines.edgeR, 0, segs); }
      addLines('aerial', segs);
      // corridor coast: bisect coastDistance = 0 along each parallel
      const coast = []; for (let u = -16; u <= 42; u += 0.5) { let lo = 34, hi = 50; const f = v => { const [lon, lat] = PLAN.toLL(u, v); return W.coastDistance(lon, lat); }; if (f(lo) <= 0 || f(hi) > 0) continue; for (let n = 0; n < 24; n++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; } const [lon, lat] = PLAN.toLL(u, (lo + hi) / 2); coast.push({ lon, lat, alt: 0.03 }); }
      const csegs = []; poly(coast, 0, csegs); addLines('coast', csegs);
    }
    S.stats.buildMs = Date.now() - t0;
    S.built = true;
    return root;
  }

  // ---- global outlines for the panorama distance (coast, ridges at 10 m, ice edges), built the first time they are needed
  function buildGlobalInk() {
    if (S.globalInk) return; S.globalInk = true;
    const t0 = Date.now(), root = new THREE.Group(), step = 1; root.name = 'globalInk'; S.root.add(root); S.globalInkGroup = root;   // own group: shown only while uBend >= 0.5, so the picture never depends on whether it was built earlier (W8a)
    const nx = 360 / step, ny = 170 / step;
    const sample = (fn) => { const g = new Float32Array((nx + 1) * (ny + 1)); for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) g[j * (nx + 1) + i] = fn(-180 + i * step, -85 + j * step); return g; };
    const contour = (grid, level, altOff) => {
      const out = [];
      const at = (i, j) => grid[j * (nx + 1) + (i % (nx + 1))];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = at(i, j) - level, b = at(i + 1, j) - level, c = at(i + 1, j + 1) - level, d = at(i, j + 1) - level;
        const lon = -180 + i * step, lat = -85 + j * step, pts = [];
        const cross = (p, q, x0, y0, x1, y1) => { if ((p > 0) !== (q > 0)) { const t = p / (p - q); pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); } };
        cross(a, b, lon, lat, lon + step, lat); cross(b, c, lon + step, lat, lon + step, lat + step); cross(c, d, lon + step, lat + step, lon, lat + step); cross(d, a, lon, lat + step, lon, lat);
        if (pts.length === 2) { const f0 = flatOf(pts[0][0], pts[0][1]), f1 = flatOf(pts[1][0], pts[1][1]); out.push(f0.x, (altOff - BASE) * f0.k, f0.z, f1.x, (altOff - BASE) * f1.k, f1.z); }
      }
      return out;
    };
    const addG = segs => { if (!segs.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); g.computeBoundingSphere(); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x273647, transparent: true, opacity: 0, fog: false })); l.matrixAutoUpdate = false; l.name = 'sec:ink:global'; root.add(l); objs.lines.panorama.push(l); S.stats.ink_panorama = (S.stats.ink_panorama || 0) + segs.length / 6; };
    addG(contour(sample((lo, la) => W.coastDistance(lo, la)), 0, 0.2));            // coasts
    addG(contour(sample((lo, la) => W.height(lo, la)), 10, 10.2));                 // ridge and peak outlines at 10 m (drawn at height: flat y = (h - 1.6)/cos)
    const ice = []; for (const r of W.regions.filter(q => q.zone === 'ice')) { for (let lon = -180; lon < 180; lon += 1) { const a = r.shape.edge(lon), b = r.shape.edge(lon + 1), fa = flatOf(lon, a), fb = flatOf(lon + 1, b); ice.push(fa.x, (2.6 - BASE) * fa.k, fa.z, fb.x, (2.6 - BASE) * fb.k, fb.z); } }
    addG(ice);
    S.stats.globalInkMs = Date.now() - t0;
  }

  // ---------------------------------------------------------------- visibility, hooks, per-frame update
  const lerp3 = (v, a, b) => a + (b - a) * v;
  function ensure() { if (!S.built) global.TERRAIN.withPrivateRandom(build); return S.root; }
  function visibility() {
    const show = BEND.get() > 0 || TERR.explore || S.mode;
    if (show) ensure();
    if (S.root) S.root.visible = show;
    for (const m of TERR.stubs) if (m.userData.terrain.exit === 'N08') m.visible = !(show && S.built);   // the RD03 start is replaced by T03-01
    if (show && BEND.get() >= 0.5 && S.built) global.TERRAIN.withPrivateRandom(buildGlobalInk);
    if (S.globalInkGroup) S.globalInkGroup.visible = BEND.get() >= 0.5;
  }
  BEND.onChange(visibility);
  TERR.onExplore(visibility);

  // ink layer by the camera's altitude above the surface (not by the distance to the section: a person standing in it is 'ground' everywhere)
  function distance(camera) {
    const u = BEND.get(), flatAlt = camera.position.y, sphereAlt = Math.hypot(camera.position.x, camera.position.y + R, camera.position.z) - R;
    return Math.max(0.5, flatAlt + (sphereAlt - flatAlt) * u);
  }
  const camLast = new THREE.Vector3(), tmpV = new THREE.Vector3(), fwd = new THREE.Vector3(), oc = new THREE.Vector3();
  function updateLod(camera, force) {
    if (!objs.trees.length) return;
    if (!force && camLast.distanceTo(camera.position) < 1e-9 && S.lodBend === BEND.get()) return;
    camLast.copy(camera.position); S.lodBend = BEND.get(); const u = BEND.get();
    for (const T of objs.trees) {
      const nearM = T.near.mesh, farM = T.far.mesh; let ni = 0, fi = 0;
      T.list.forEach(it => {
        const p = BEND.point(it.m.elements[12], it.m.elements[13], it.m.elements[14], u); tmpV.set(p[0], p[1], p[2]);
        if (tmpV.distanceTo(camera.position) < 26) { nearM.setMatrixAt(ni, it.m); nearM.setColorAt(ni, tintC.setRGB(it.tint[0], it.tint[1], it.tint[2])); ni++; }
        else { farM.setMatrixAt(fi, it.m); farM.setColorAt(fi, tintC.setRGB(it.tint[0], it.tint[1], it.tint[2])); fi++; }
      });
      nearM.count = ni; farM.count = fi; T.near.hull.count = ni;
      nearM.instanceMatrix.needsUpdate = true; farM.instanceMatrix.needsUpdate = true; if (nearM.instanceColor) nearM.instanceColor.needsUpdate = true; if (farM.instanceColor) farM.instanceColor.needsUpdate = true;
      // Instance populations change with the view: update sort/cull bounds together with matrices.
      nearM.computeBoundingSphere(); farM.computeBoundingSphere(); T.near.hull.computeBoundingSphere();
      T.counts = { near: ni, far: fi };
    }
  }
  function applyLight() {
    const L = S.settings.light, h = ctx.lights.hemi, m = ctx.lights.moon;
    if (L === 'panorama') { h.intensity = light0.hemi * 1.5; m.intensity = light0.moon * 1.5; scene.fog.density = 0; }
    else if (L === 'neutral') { h.intensity = light0.hemi * 2.8; m.intensity = light0.moon * 1.6; scene.fog.density = 0; }   // material and form study (not a daytime state, D9)
    else { h.intensity = light0.hemi; m.intensity = light0.moon; scene.fog.density = light0.fog; }
  }
  function tick(t, camera) {
    WATERK && (WATERK.uniforms.uTime.value = t, WATERK.uniforms.uRain.value = (S.settings.rain ? 1 : 0) * (1 - BEND.get()));   // W8e-c: no ripples on the sphere
    if (!S.root || !S.root.visible) return;
    const d = distance(camera); S.ink.distance = d;
    const mode = S.settings.ink;
    let g, a, p;
    if (mode === 'ground') { g = 1; a = 0; p = 0; } else if (mode === 'aerial') { g = 0; a = 1; p = 0; } else if (mode === 'panorama') { g = 0; a = 0; p = 1; }
    else { g = 1 - smooth(8, 22, d); p = smooth(70, 150, d); a = Math.max(0, smooth(8, 22, d) * (1 - p)); }
    S.ink.ground = g; S.ink.aerial = a; S.ink.panorama = p;
    { // the distance to where the camera looks (ray against the planet sphere, flat plane at uBend 0; 25 m when it misses): outlines keep a constant pixel width there
      camera.getWorldDirection(fwd); const bu = BEND.get(); let t = 25;
      if (bu > 0) { oc.set(camera.position.x, camera.position.y + R, camera.position.z); const b = oc.dot(fwd), c = oc.lengthSq() - R * R, disc = b * b - c; if (disc > 0) { const t1 = -b - Math.sqrt(disc); if (t1 > 0) t = t1; } }
      else if (fwd.y < -0.02) t = -camera.position.y / fwd.y;
      S.focus = Math.max(4, Math.min(300, t));
    }
    // constant pixel width: world units per pixel at the distance of the section, 1.5 px
    const wpp = 2 * Math.max(3, S.focus || d) * Math.tan(camera.fov * D / 2) / ctx.renderer.domElement.height;
    S.ink.width = Math.max(0.008, Math.min(0.2, 1.5 * wpp)); S.materials.inkW.value = S.ink.width;
    for (const h of objs.hulls) { h.visible = g > 0.01; }
    S.materials.hullMat.opacity = g; S.materials.treeHullMat.opacity = g;
    for (const l of objs.lines.aerial) { l.material.opacity = a; l.visible = a > 0.01; }
    for (const l of objs.lines.coast) { l.material.opacity = Math.max(a, p, 0); l.visible = (a > 0.01 || p > 0.01); }
    for (const l of objs.lines.panorama) { l.material.opacity = p; l.visible = p > 0.01; }
    updateLod(camera, false);
  }

  const api = {
    ensure, tick, state: S,
    setMode(on) { if (on && global.__scene && !global.__scene.transition.townAvailable()) return; S.mode = !!on; visibility(); },
    set(v) {
      if (v.rain !== undefined) { S.settings.rain = !!v.rain; if (ctx.rainObj) ctx.rainObj.visible = S.settings.rain; }
      if (v.light) { S.settings.light = v.light; applyLight(); }
      if (v.ink) S.settings.ink = v.ink;
      return { ...S.settings };
    },
    get() { return { ...S.settings, ink: { ...S.ink }, mode: S.mode, built: S.built }; },
    forceLod(camera) { updateLod(camera, true); },
    stats() {
      let calls = 0; const tri = [];
      return { counts: S.counts, trees: objs.trees.map(T => ({ type: T.type, ...(T.counts || {}) })), ...S.stats, plan: { seed: PLAN && PLAN.seed } };
    },
    objects: objs, plan: () => PLAN, kit: () => K,
  };
  global.SECTION_API = api;
  return api;
};

if (typeof module !== 'undefined' && module.exports) module.exports = SECTION;
else global.SECTION = SECTION;
})(typeof globalThis !== 'undefined' ? globalThis : this);
