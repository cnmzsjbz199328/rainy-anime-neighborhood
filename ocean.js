// BI01 ocean and TR02 coast over the whole planet (W6a). Pure part: build(W, chunks, H, roads) makes, from the terrain lattice that W3 built, the water surface
// (every triangle with a vertex below sea level, at sea level, with a signed water depth per vertex so that the foam line lands exactly on the coast), the coast line
// (the sea-level contour of the terrain triangles), rocks on rocky shores and in the shallows, driftwood on beaches, seaweed shadows, and sea walls with tetrapods
// beside the places where a road reaches the shore. Scene part: attach(...) makes the meshes the first time the planet is shown (uBend > 0 or the 'section' view).
// Geometry is stored in flat Mercator coordinates (docs/world/W3_SPEC.md section 2) and rolled onto the sphere by bend.js; instances are scaled by 1/cos(lat).
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (a, b) => { let h = Math.imul(Math.round(a * 997), 374761393) ^ Math.imul(Math.round(b * 1313), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255].map(srgb);
const SHALLOW = lin('#44687c'), DEEP = lin('#1a2f58');     // night palette of BI01: grey-cyan shallows to indigo deeps (the W4 sea colours)

function build(W, chunks, H, roads) {
  const pos = [], col = [], shore = [], idx = [], coast = [], mids = [], shallow = [];
  for (const c of chunks) {
    const map = new Map();
    const vid = i => { let v = map.get(i); if (v === undefined) { v = pos.length / 3; map.set(i, v);
      const lat = c.lonlat[i * 2 + 1], k = 1 / Math.cos(lat * D), alt = c.alt[i], d = -alt, t = Math.min(1, Math.max(0, d) / 0.7), a = smooth(0, 0.18, d) * (0.78 - 0.2 * t);
      pos.push(c.pos[i * 3], (0.0 - BASE + 0.01) * k, c.pos[i * 3 + 2]);
      col.push(SHALLOW[0] + (DEEP[0] - SHALLOW[0]) * t, SHALLOW[1] + (DEEP[1] - SHALLOW[1]) * t, SHALLOW[2] + (DEEP[2] - SHALLOW[2]) * t, a); shore.push(d); } return v; };
    for (const index of [c.ringIndex, c.restIndex]) if (index) for (let t = 0; t < index.length; t += 3) {
      const a = index[t], b = index[t + 1], cc = index[t + 2], h = [c.alt[a], c.alt[b], c.alt[cc]];
      if (Math.min(...h) >= 0) continue;
      idx.push(vid(a), vid(b), vid(cc));
      // sea-level contour of this triangle: where an edge changes sign
      const pts = [], ids = [a, b, cc];
      for (let e = 0; e < 3; e++) { const i0 = ids[e], i1 = ids[(e + 1) % 3], h0 = c.alt[i0], h1 = c.alt[i1]; if ((h0 < 0) !== (h1 < 0)) { const s = h0 / (h0 - h1); pts.push({ lon: c.lonlat[i0 * 2] + (c.lonlat[i1 * 2] - c.lonlat[i0 * 2]) * s, lat: c.lonlat[i0 * 2 + 1] + (c.lonlat[i1 * 2 + 1] - c.lonlat[i0 * 2 + 1]) * s, x: c.pos[i0 * 3] + (c.pos[i1 * 3] - c.pos[i0 * 3]) * s, z: c.pos[i0 * 3 + 2] + (c.pos[i1 * 3 + 2] - c.pos[i0 * 3 + 2]) * s }); } }
      if (pts.length === 2) {
        const k = 1 / Math.cos(pts[0].lat * D), y = (0.04 - BASE) * k; coast.push(pts[0].x, y, pts[0].z, pts[1].x, y, pts[1].z);
        const dx = pts[1].x - pts[0].x, dz = pts[1].z - pts[0].z, len = Math.hypot(dx, dz) / k;
        if (len > 0.05) mids.push({ lon: (pts[0].lon + pts[1].lon) / 2, lat: (pts[0].lat + pts[1].lat) / 2, tx: dx / Math.hypot(dx, dz), tz: dz / Math.hypot(dx, dz), len });
      } else if (Math.max(...h) < -0.25 && Math.min(...h) > -1.7) {
        // a triangle wholly in the shallows (0.25-1.7 m deep): a candidate for a reef rock or a patch of seaweed
        const lon = (c.lonlat[a * 2] + c.lonlat[b * 2] + c.lonlat[cc * 2]) / 3, lat = (c.lonlat[a * 2 + 1] + c.lonlat[b * 2 + 1] + c.lonlat[cc * 2 + 1]) / 3; shallow.push({ lon, lat });
      }
    }
  }
  // ---- instances
  const inst = [], add = (type, lon, lat, alt, o = {}) => inst.push({ type, lon, lat, alt, yaw: o.yaw || 0, s: o.s || [1, 1, 1], lean: o.lean || [0, 0], tint: o.tint || [1, 1, 1] });
  const near = (lon, lat, list, r) => list.some(p => { const dl = (p.lon - lon) * Math.cos(lat * D) * R * D, dt = (p.lat - lat) * R * D; return dl * dl + dt * dt < r * r; });
  const road = roads || { centre: [], clear: 8, piers: [] };
  const sites = W.landmarks.filter(l => l.id !== 'TOWN');           // no shore detail inside a landmark's site: W7 builds the harbour, the ruins and the lighthouse there
  const inSite = (lon, lat) => sites.some(l => { const dl = (l.lon - lon) * Math.cos(lat * D) * R * D, dt = (l.lat - lat) * R * D; return dl * dl + dt * dt < (l.radius + 0.6) * (l.radius + 0.6); });
  const roadDist = (lon, lat) => { let b = Infinity; for (const p of road.centre) { const dl = (p.lon - lon) * Math.cos(lat * D) * R * D, dt = (p.lat - lat) * R * D, d = Math.hypot(dl, dt); if (d < b) b = d; } return b; };
  const stats = { coastSegments: mids.length, coastLength: 0, rocks: 0, reef: 0, seaweed: 0, drift: 0, wall: 0, tetra: 0 };
  for (const m of mids) stats.coastLength += m.len;
  const flatDir = m => ({ x: m.tx, z: m.tz });
  for (const m of mids) {
    const reg = W.regionAt(m.lon, m.lat), beach = reg.zone === 'building', key = m.lon * 3.1 + m.lat * 7.7, rd = roadDist(m.lon, m.lat);
    if (rd < road.clear || inSite(m.lon, m.lat)) continue;                  // nothing on the shore where a road comes down to it (the sea wall is made there instead)
    // normal pointing out to sea: step 1 m both ways in the flat frame and take the lower side
    const k = 1 / Math.cos(m.lat * D), nx = -m.tz, nz = m.tx, mx = (m.lon * D * R), mz = -R * Math.asinh(Math.tan(m.lat * D));
    const toLL = (x, z) => ({ lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D });
    const p1 = toLL(mx + nx * k, mz + nz * k), p2 = toLL(mx - nx * k, mz - nz * k), sea = H(p1.lon, p1.lat) < H(p2.lon, p2.lat) ? 1 : -1;
    if (beach) {
      if (hash(key, 3) < 0.07) { const q = toLL(mx - sea * nx * k * 0.8, mz - sea * nz * k * 0.8); add('drift', q.lon, q.lat, H(q.lon, q.lat), { yaw: hash(key, 5) * 6.28 }); stats.drift++; }
      if (hash(key, 7) < 0.10) { const q = toLL(mx + sea * nx * k * 0.4, mz + sea * nz * k * 0.4); add('reefRock', q.lon, q.lat, H(q.lon, q.lat) - 0.06, { yaw: hash(key, 9) * 6.28, s: [0.4 + 0.4 * hash(key, 11), 0.4, 0.4 + 0.4 * hash(key, 13)] }); stats.rocks++; }
    } else if (hash(key, 17) < 0.5) {
      // rock size 0.5-3 m across (card); the kit's rocks are about 1.2 m (reefRock, mossRock) and 2.2 m (rockBig) across
      const off = (hash(key, 19) - 0.35) * 1.6, q = toLL(mx + sea * nx * k * off, mz + sea * nz * k * off), sz = 0.5 + 2.5 * Math.pow(hash(key, 23), 2.2), big = sz > 1.7, sc = big ? sz / 2.2 : sz / 1.25;
      add(big ? 'rockBig' : hash(key, 29) < 0.4 ? 'mossRock' : 'reefRock', q.lon, q.lat, H(q.lon, q.lat) - 0.12 * sc, { yaw: hash(key, 31) * 6.28, s: [sc, sc * (0.7 + 0.4 * hash(key, 37)), sc * (0.8 + 0.3 * hash(key, 41))], tint: [0.85 + 0.2 * hash(key, 43), 0.85 + 0.2 * hash(key, 43), 0.85 + 0.2 * hash(key, 43)] }); stats.rocks++;
    }
  }
  shallow.forEach((p, i) => {
    if (roadDist(p.lon, p.lat) < road.clear + 4 || inSite(p.lon, p.lat)) return;
    const r = hash(p.lon * 5.3, p.lat * 9.1);
    if (r < 0.025) { add('reefRock', p.lon, p.lat, H(p.lon, p.lat) - 0.12, { yaw: hash(i, 3) * 6.28, s: [1.0 + 0.6 * hash(i, 4), 0.9, 1.0 + 0.6 * hash(i, 6)] }); stats.reef++; }
    else if (r < 0.10) { add('weedShadow', p.lon, p.lat, H(p.lon, p.lat) + 0.02, { yaw: hash(i, 5) * 6.28, s: [1 + hash(i, 7), 1, 1 + hash(i, 9)] }); stats.seaweed++; }
  });
  // sea walls (two blocks high, 2 m) and tetrapod stacks along the shore 6-24 m from a road's centre line, beside the road, never under the deck
  for (const m of mids) {
    const rd = roadDist(m.lon, m.lat); if (rd < 6 || rd > 24 || inSite(m.lon, m.lat)) continue;
    const key = m.lon * 3.1 + m.lat * 7.7, k = 1 / Math.cos(m.lat * D), nx = -m.tz, nz = m.tx, mx = (m.lon * D * R), mz = -R * Math.asinh(Math.tan(m.lat * D));
    const toLL = (x, z) => ({ lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D });
    const p1 = toLL(mx + nx * k, mz + nz * k), p2 = toLL(mx - nx * k, mz - nz * k), sea = H(p1.lon, p1.lat) < H(p2.lon, p2.lat) ? 1 : -1;
    if (m.len < 0.8) continue;
    const yaw = Math.atan2(-m.tz, m.tx), inl = toLL(mx - sea * nx * k * 1.3, mz - sea * nz * k * 1.3), ext = toLL(mx + sea * nx * k * 0.9, mz + sea * nz * k * 0.9);
    if (hash(key, 51) < 0.55 && stats.wall < 400) { const g = H(inl.lon, inl.lat); add('wallBlock', inl.lon, inl.lat, g - 0.15, { yaw, s: [m.len / 1.9 > 1 ? 1 : 1, 1, 1] }); add('wallBlock', inl.lon, inl.lat, g + 0.85, { yaw, s: [1, 1, 0.85] }); stats.wall++; }
    if (hash(key, 53) < 0.6 && stats.tetra < 600) { const g = H(ext.lon, ext.lat); add('tetra', ext.lon, ext.lat, g - 0.1, { yaw: hash(key, 55) * 6.28, s: [1, 1, 1], lean: [(hash(key, 57) - 0.5) * 0.6, (hash(key, 59) - 0.5) * 0.6] }); stats.tetra++; }
  }
  return { water: { pos: Float32Array.from(pos), col: Float32Array.from(col), shore: Float32Array.from(shore), index: Uint32Array.from(idx) }, coast: Float32Array.from(coast), mids, shallow, instances: inst, stats };
}

const OCEAN = { build, SHALLOW, DEEP };

// ---------------------------------------------------------------- scene part
OCEAN.attach = function (scene, ctx, BEND, TERR, SEC) {
  const THREE = global.THREE, W = global.WORLD;
  const S = { built: false, stats: {}, root: null };
  const uniforms = { uTime: { value: 0 }, uRain: { value: 1 }, uMoon: { value: new THREE.Vector3(-6, 9, 4).normalize() } };
  if (ctx.lights && ctx.lights.moon) uniforms.uMoon.value.copy(ctx.lights.moon.position).normalize();       // the moon is a fixed world direction (it does not bend with the surface)
  const objs = { water: null, coast: null, inst: [], hulls: [] };
  const tintC = new THREE.Color(), qE = new THREE.Euler(), qQ = new THREE.Quaternion(), mP = new THREE.Vector3(), mS = new THREE.Vector3(), mM = new THREE.Matrix4();
  const matrixOf = it => { const lat = it.lat * D, k = 1 / Math.cos(lat), x = R * it.lon * D, z = -R * Math.asinh(Math.tan(lat)); qE.set(it.lean[0], it.yaw, it.lean[1], 'YXZ'); qQ.setFromEuler(qE); mM.compose(mP.set(x, (it.alt - BASE) * k, z), qQ, mS.set(k * it.s[0], k * it.s[1], k * it.s[2])); return mM.clone(); };

  // water material: the W4 rain-ripple rings, a signed-depth foam line that breathes, a slow swell that tilts the normal, and a moon glint computed from the bent surface
  const RIPPLE = `
    float wh(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wh(i), wh(i + vec2(1.0, 0.0)), f.x), mix(wh(i + vec2(0.0, 1.0)), wh(i + vec2(1.0, 1.0)), f.x), f.y); }
    float rippleRings(vec2 q, float t, float cell, float speed) {
      vec2 id = floor(q / cell); float total = 0.0;
      for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) {
        vec2 cid = id + vec2(float(a), float(b));
        vec2 centre = (cid + vec2(wh(cid), wh(cid + 17.0))) * cell;
        float ph = fract(t * speed + wh(cid + 41.0)), r = ph * cell * 0.45, d = length(q - centre);
        total += smoothstep(0.05, 0.0, abs(d - r)) * (1.0 - ph) * step(wh(cid + 7.0), 0.75);
      }
      return total;
    }`;
  const makeMat = () => {
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
    m.onBeforeCompile = shader => {
      shader.uniforms.uTime = uniforms.uTime; shader.uniforms.uRain = uniforms.uRain; shader.uniforms.uMoon = uniforms.uMoon;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aShore;\nvarying vec3 vWP;\nvarying float vShore;\nvarying vec3 vBP;\nvarying vec3 vUp;\nvarying vec3 vEast;\nvarying vec3 vSouth;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;\nvShore = aShore;\nvBP = bendPosition(vWP);\nvUp = bendNormal(vWP, vec3(0.0, 1.0, 0.0));\nvEast = bendNormal(vWP, vec3(1.0, 0.0, 0.0));\nvSouth = bendNormal(vWP, vec3(0.0, 0.0, 1.0));');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uRain;\nuniform vec3 uMoon;\nvarying vec3 vWP;\nvarying float vShore;\nvarying vec3 vBP;\nvarying vec3 vUp;\nvarying vec3 vEast;\nvarying vec3 vSouth;\n${RIPPLE}`)
        .replace('#include <opaque_fragment>', `
          float cph = 1.0 / cosh(vWP.z / 90.0);
          vec2 q = vec2(vWP.x, vWP.z) * cph;
          // the waterline wobbles: a little noise on the signed depth, so that the coast (and the foam line) is not the straight chords of the lattice nor a perfect circle around an island
          float sh = vShore + (vn(q * 0.9) * 0.7 + vn(q * 2.6) * 0.3 - 0.5) * 0.05;
          diffuseColor.a *= smoothstep(-0.006, 0.01, sh);
          float cd = length(cameraPosition - vBP);
          float rg = rippleRings(q, uTime, 0.9, 0.55) * uRain * step(0.0, sh) * (1.0 - smoothstep(18.0, 70.0, cd));   // the rings fade with distance (no bubbles from the air)
          outgoingLight += vec3(0.50, 0.62, 0.78) * rg * 0.55;
          diffuseColor.a = max(diffuseColor.a, rg * 0.55);
          // low swell: slow soft stripes (brightness), and the normal tilted by a slow wave for the glint
          float sw = sin(dot(q, vec2(0.33, 0.21)) * 1.7 + uTime * 0.42) * 0.5 + sin(dot(q, vec2(-0.19, 0.37)) * 2.3 + uTime * 0.31) * 0.5;
          outgoingLight *= 1.0 + 0.07 * sw * smoothstep(0.1, 1.0, vShore);
          vec3 n = normalize(normalize(vUp) + normalize(vEast) * 0.07 * sw + normalize(vSouth) * 0.07 * sin(dot(q, vec2(0.27, -0.31)) * 2.0 + uTime * 0.37));
          vec3 V = normalize(cameraPosition - vBP), Hh = normalize(V + normalize(uMoon));
          float gl = max(dot(n, Hh), 0.0), glint = (pow(gl, 120.0) * 0.85 + pow(gl, 18.0) * 0.10) * smoothstep(0.05, 0.5, vShore);
          outgoingLight += vec3(0.78, 0.86, 1.0) * glint;
          diffuseColor.a = max(diffuseColor.a, glint * 0.75);
          // foam: the water side of the coast line, breathing slowly
          float fz = 0.024 + 0.014 * sin(uTime * 0.9 + vWP.x * cph * 0.6);
          float fo = step(0.0, sh) * (1.0 - smoothstep(0.004, fz, sh)) * (0.75 + 0.25 * sin(uTime * 1.3 + vWP.x * cph));
          outgoingLight = mix(outgoingLight, vec3(0.42, 0.52, 0.62), fo * 0.85);
          diffuseColor.a = max(diffuseColor.a, fo * 0.9);
          #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'bend|ocean-sea'; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
    return m;
  };

  let DATA = null;
  function build_() {
    const t0 = Date.now(), K = SEC.kit(), M = SEC.state.materials, H = TERR.sampler();
    const RD = global.ROADS_API && global.ROADS_API.ensure && (global.ROADS_API.ensure(), global.ROADS_API.data());
    const centre = []; if (RD) { for (const r of RD.routes) for (const p of r.samples) centre.push({ lon: p.lon, lat: p.lat }); for (const b of RD.bridges) for (const p of b.samples) centre.push({ lon: p.lon, lat: p.lat }); for (const s of RD.stairs) for (const p of s.samples) centre.push({ lon: p.lon, lat: p.lat }); }
    DATA = build(W, [...TERR.ringData, ...TERR.restData], H, { centre: centre.filter((_, i) => i % 2 === 0), clear: 8 }); S.data = DATA;
    const root = new THREE.Group(); root.name = 'ocean'; scene.add(root); S.root = root;
    const d = DATA.water, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(d.col, 4)); g.setAttribute('aShore', new THREE.BufferAttribute(d.shore, 1));
    const nrm = new Float32Array(d.pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setIndex(new THREE.BufferAttribute(d.index, 1)); g.computeBoundingSphere();
    const water = new THREE.Mesh(g, makeMat()); water.name = 'ocean:water'; water.matrixAutoUpdate = false; water.renderOrder = 3; root.add(water); objs.water = water;
    const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(DATA.coast, 3)); cg.computeBoundingSphere();
    const coast = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x273647, transparent: true, opacity: 0, fog: false })); coast.name = 'ocean:coast'; coast.matrixAutoUpdate = false; root.add(coast); objs.coast = coast;
    // instances grouped by type
    const by = {}; for (const it of DATA.instances) (by[it.type] = by[it.type] || []).push({ ...it, m: matrixOf(it) });
    S.counts = {};
    for (const [type, list] of Object.entries(by)) {
      const geo = K.geometries[type]; if (!geo) continue; S.counts[type] = list.length;
      const mesh = new THREE.InstancedMesh(geo, M.floraMat, list.length); mesh.name = 'ocean:' + type;
      list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, tintC.setRGB(it.tint[0], it.tint[1], it.tint[2])); });
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); root.add(mesh); objs.inst.push(mesh);
      if (type !== 'weedShadow') { const hull = new THREE.InstancedMesh(geo, M.hullMat, list.length); hull.instanceMatrix = mesh.instanceMatrix; hull.count = list.length; hull.computeBoundingSphere(); hull.name = 'ocean:' + type + ':ink'; root.add(hull); objs.hulls.push(hull); }
    }
    S.stats = { ...DATA.stats, buildMs: Date.now() - t0, waterTriangles: d.index.length / 3, coastSegmentsDrawn: DATA.coast.length / 6 };
    S.built = true; return root;
  }

  function ensure() { if (!S.built) { SEC.ensure(); global.TERRAIN.withPrivateRandom(build_); } return S.root; }
  function visibility() {
    const show = BEND.get() > 0 || TERR.explore || SEC.state.mode;
    if (show) ensure();
    if (S.root) S.root.visible = show;
    // the section's own corridor sea and its corridor coast line give way to the global water (one layer, one line)
    if (S.built && show) { for (const m of SEC.objects.water) if (m.name === 'sec:sea') m.visible = false; for (const l of SEC.objects.lines.coast) l.userData.hidden = true; }
    else if (S.built) for (const m of SEC.objects.water) if (m.name === 'sec:sea') m.visible = true;
  }
  BEND.onChange(visibility);
  TERR.onExplore(visibility);

  function tick(t, camera) {
    uniforms.uTime.value = t; uniforms.uRain.value = SEC.state.settings.rain ? 1 : 0;
    if (!S.built || !S.root.visible) return;
    const ink = SEC.state.ink, g = ink.ground, a = ink.aerial, near = ink.distance < 120;
    objs.coast.material.opacity = a; objs.coast.visible = a > 0.01;
    for (const l of SEC.objects.lines.coast) if (l.userData.hidden) l.visible = false;
    for (const m of objs.inst) m.visible = near; for (const h of objs.hulls) h.visible = near && g > 0.01;
  }

  const api = { ensure, tick, state: S, data: () => DATA, uniforms, objects: objs, stats: () => ({ counts: S.counts, ...S.stats }) };
  global.OCEAN_API = api;
  return api;
};

if (typeof module !== 'undefined' && module.exports) module.exports = OCEAN;
else global.OCEAN = OCEAN;
})(typeof globalThis !== 'undefined' ? globalThis : this);
