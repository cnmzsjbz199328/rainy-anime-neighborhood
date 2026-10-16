// What the weather looks like (W8b, ST05; WX2 2026-10-16), driven by weather.js. One source of truth (weather.js), sampled where each effect is:
//   the view      the weights at the camera's target drive the sky light, the moon and the fog (the whole picture: these stay a view-level look)
//   the field     field(lon, lat) gives the effect weights { rain, snow, wetness, drip, mist } anywhere, bilinear over a lattice of NODE degrees (1.57 m, the
//                 terrain's lattice) whose nodes keep their place() object and are re-evaluated every REFRESH weather seconds or when the lock changes; across a
//                 hard region edge (the four nodes of a cell in different categories) the nearest node of a lattice FINE times finer is taken (0.39 m), so no
//                 forbidden state leaks over it by more than that
//   the map       the surface map: a MAP.N x MAP.N texture of the field on a lattice MAP.STEP degrees apart round the target (R rain impacts, G wetness, B snow,
//                 A weather mist), for the shaders of the water surfaces (sea, paddies: WEATHER_FX.surface)
//   particles     the rain lines (scene.js) and the snow (here) are thinned per particle by the field at the particle (a particle shows when its own hash is below
//                 the local weight) and fall onto the receiving surface below them (surfaceY: the town's ground, the rendered terrain, the sea, road decks, the
//                 landmarks' roofs and grounds)
//   effects       registered weather effects of buildings and landmarks (drips, window runs, rain rings, snow mist) and the mist belt of ameni-dake: their
//                 coefficient comes from the field at their place (register / apply)
// The map mode is applied once, at the end: dry = 1 - uBend multiplies every weather effect (the sphere is a clear day at every distance, D8 / D9 revised). With the
// camera's height above the ground, w_local(h) = 1 - smoothstep(40, 120, h): looks (lights, fog, mist) blend towards the rain-night look, particles, rain impacts and
// drips fade out (the rain lines and drips with the camera distance, (110 - d) / 60, as the rain always did); at the panorama (h >= 120 m) every weather looks the same.
// The lights and the fog have explicit bases (ctx.look: written by the light presets of section.js, the map transition and the walk; WX-G): every frame the weather
// writes base x multiplier and base fog + added fog, never reading back what someone else might have changed.
//   rain      rain lines, rain impacts (ripples), drips, wet ground (unchanged look in the town)
//   after     no rain lines and no impacts; wet ground and drips go on, a thin ground mist (fog density +)
//   overcast  no rain; moon 0.55, sky light 0.75
//   clear     no rain, no impacts, no drips; moon 1.25, sky light 1.1
//   snow      fine snow falling onto the ground below it, sky light 1.1
//   fog       grey-violet fog (density + 0.03), no rain
// The weather's fog never hides the view target (docs/world/GRAY_VIEW_FIX_PLAN.md): at the camera-target distance d the whole fog keeps a transmittance of at least
// FOG_SEE, exp(-(density * d)^2) >= FOG_SEE, so the added density is at most sqrt(-ln FOG_SEE) / d - base (never below 0: the base fog of the rain night stays).
(function (global) {
'use strict';
const MULT = { rain: [1, 1], after: [1.05, 1], overcast: [0.75, 0.55], clear: [1.1, 1.25], snow: [1.1, 1], fog: [0.9, 0.8] };          // [sky light, moon]
const RAIN = { rain: 1, after: 0, overcast: 0, clear: 0, snow: 0, fog: 0 }, PUDDLE = { rain: 1, after: 1, overcast: 0.6, clear: 0, snow: 0, fog: 0.6 };
const FOG_ADD = { rain: 0, after: 0.006, overcast: 0, clear: 0, snow: 0.004, fog: 0.03 };
const FOG_SEE = 0.2, FOG_DEPTH = Math.sqrt(-Math.log(FOG_SEE));   // optical depth (density * d) at which the view target is FOG_SEE visible
const R = 90, D = Math.PI / 180, BASE = 1.6, TOWN_HALF = 48;
const NODE = 1, FINE = 4, REFRESH = 0.5, NODES_MAX = 60000;       // field lattice (degrees), its subdivision at hard edges, weather seconds between node updates (<= 1.1 %
// weight change), node cache cap
const MAP = { N: 64, STEP: 2, PER_FRAME: 256, REFRESH: 2 };       // surface map: texels, degrees between texels (about 100 m each way at the equator), texels filled per frame
// (a fixed count, not a time budget, so a replayed frame sequence fills the same texels in the same frames), weather seconds between two time refreshes (<= 4.2 %)
const SNOW = { N: 900, BOX: 40, H: 8.9, LIFT: 0.1, SIZE: 0.09, OPACITY: 0.85 };   // flakes, box width, column height above the receiving surface + LIFT, size
const LINE_FADE = d => Math.max(0, Math.min(1, (110 - d) / 60));    // the rain lines' distance fade (scene.js), shared by the drips
const hash = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const llOf = (x, z) => ({ lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D });
// GLSL for the water shaders: the weather at a flat world position (vWP before bend.js moves it): x rain impacts, y wetness, z snow, w mist; outside the map the edge texel
const GLSL = `
uniform sampler2D uWxMap; uniform vec4 uWxBox;
vec4 wxAt(vec3 wp) {
  float lon = degrees(wp.x / 90.0), lat = degrees(atan(sinh(-wp.z / 90.0)));
  float dl = mod(lon - uWxBox.x + 180.0, 360.0) - 180.0;
  return texture2D(uWxMap, (vec2(dl, lat - uWxBox.y) * uWxBox.z + 0.5) / uWxBox.w);
}`;
const EMPTY = Object.freeze({ rain: 0, snow: 0, wetness: 0, drip: 0, mist: 0 });

function attach(THREE, scene, ctx) {
  const WX = global.WEATHER, W = WX.make(global.WORLD), fogW = ctx.bend.weatherFogUniform, look = ctx.look;
  const st = { offset: 0, fixed: null, last: null, view: null, snow: null, stamp: 0, bucket: -1, lv: -1, time: 0, gains: { impact: 1, wet: 1, dry: 1, wl: 1, line: 1 } };
  const fogTint = new THREE.Color('#5a5870'), fogMixed = new THREE.Color();
  const priv = fn => (global.TERRAIN && global.TERRAIN.withPrivateRandom ? global.TERRAIN.withPrivateRandom(fn) : fn());   // three.js ids draw from Math.random: the town's rain keeps its stream

  // ---- the field: lattice nodes (place objects kept here, weights re-evaluated per stamp)
  const nodes = new Map();
  // node (i, j) of the lattice of step NODE / f (f = 1 or FINE); i is the wrapped longitude index
  function node(i, j, f = 1) {
    const key = f === 1 ? i * 512 + j + 256 : -1 - (i * 2048 + j + 1024); let n = nodes.get(key);
    if (!n) { if (nodes.size >= NODES_MAX) nodes.clear(); const p = W.place(i * NODE / f, j * NODE / f); n = { p, s: -1, e: { rain: 0, snow: 0, wetness: 0, drip: 0, mist: 0 }, cat: p.cat }; nodes.set(key, n); }
    if (n.s !== st.stamp) { const w = W.samplePlace(n.p, st.time).weights, e = n.e; e.rain = e.snow = e.wetness = e.drip = e.mist = 0;
      for (const s of WX.STATES) { const k = w[s]; if (!k) continue; const E = WX.EFFECT[s]; e.rain += k * E.rain; e.snow += k * E.snow; e.wetness += k * E.wetness; e.drip += k * E.drip; e.mist += k * E.mist; }
      n.s = st.stamp; }
    return n;
  }
  const lonIndex = i => ((i % (360 / NODE)) + 360 / NODE) % (360 / NODE);
  // the effect weights at (lon, lat) now, into out (no allocation)
  function field(lon, lat, out = {}) {
    const l = ((lon % 360) + 360) % 360 / NODE, la = Math.max(-90 / NODE, Math.min(90 / NODE - 1e-9, lat / NODE)), i0 = Math.floor(l), j0 = Math.floor(la), fx = l - i0, fy = la - j0;
    const a = node(lonIndex(i0), j0), b = node(lonIndex(i0 + 1), j0), c = node(lonIndex(i0), j0 + 1), d = node(lonIndex(i0 + 1), j0 + 1);
    if (a.cat === b.cat && a.cat === c.cat && a.cat === d.cat) {
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      for (const k of WX.EFFECTS) out[k] = a.e[k] * w00 + b.e[k] * w10 + c.e[k] * w01 + d.e[k] * w11;
    } else { const fl = Math.round(l * FINE), fj = Math.max(-90 * FINE / NODE, Math.min(90 * FINE / NODE, Math.round(la * FINE))), n = node(((fl % (360 * FINE / NODE)) + 360 * FINE / NODE) % (360 * FINE / NODE), fj, FINE); for (const k of WX.EFFECTS) out[k] = n.e[k]; }
    return out;
  }
  const fieldXZ = (x, z, out) => { const ll = llOf(x, z); return field(ll.lon, ll.lat, out); };

  // ---- the receiving surface below a flat point (flat y): the town's ground (LEVELS.plinth: streets, pavements and plots sit 0-0.19 above it), else the highest of the
  // rendered terrain, the sea, the roads and decks (streetlights.js's line table) and the landmarks' own meshes (roofs, eaves, grounds: a 0.5 m height raster)
  const surf = { terrain: null, roads: null, landmarks: [] };
  function surfaceY(x, z) {
    if (Math.abs(x) <= TOWN_HALF && Math.abs(z) <= TOWN_HALF) return 0;
    const ll = llOf(x, z), k = 1 / Math.cos(ll.lat * D); let alt = surf.terrain ? surf.terrain(ll.lon, ll.lat) : global.WORLD.height(ll.lon, ll.lat);
    if (alt == null) alt = global.WORLD.height(ll.lon, ll.lat);
    alt = Math.max(alt, 0); if (surf.roads) { const r = surf.roads(x, z); if (r != null && r > alt) alt = r; }
    let y = (alt - BASE) * k;
    for (const lm of surf.landmarks) if (Math.abs(x - lm.x) < lm.r && Math.abs(z - lm.z) < lm.r) { const c = lm.top(x, z); if (c != null && c > y) y = c; }
    return y;
  }
  // the landmarks' roofs and grounds: every non-animated mesh triangle raises the cells of its box to its top (0.5 m cells, flat frame), built the first time a query
  // comes near the landmark (a few ms, once)
  function landmarkCover(lm, groups) {
    const f = global.WORLD.lonLatToTown(lm.lon, lm.lat), r = (lm.radius || 15) * 1.6 / Math.cos(lm.lat * D) + 4, C = 0.5; let cells = null;
    const build = () => { cells = new Map(); const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (const g of groups) { if (g.userData && g.userData.live) continue; g.updateMatrixWorld(true); g.traverse(o => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; for (let p = o.parent; p; p = p.parent) if (p.userData && p.userData.live) return;
        if (o.material && (o.material.transparent && o.material.opacity < 0.3)) return;        // glow cards, light pools: not a roof
        const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count, M = o.matrixWorld;
        for (let t = 0; t + 2 < n; t += 3) { const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
          a.fromBufferAttribute(pos, i0).applyMatrix4(M); b.fromBufferAttribute(pos, i1).applyMatrix4(M); c.fromBufferAttribute(pos, i2).applyMatrix4(M);
          const top = Math.max(a.y, b.y, c.y), x0 = Math.floor(Math.min(a.x, b.x, c.x) / C), x1 = Math.floor(Math.max(a.x, b.x, c.x) / C), z0 = Math.floor(Math.min(a.z, b.z, c.z) / C), z1 = Math.floor(Math.max(a.z, b.z, c.z) / C);
          if ((x1 - x0 + 1) * (z1 - z0 + 1) > 4096) continue;                                // a huge sheet (none expected): skip rather than flood the raster
          for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const key = i * 1048576 + j; const h = cells.get(key); if (h === undefined || top > h) cells.set(key, top); } }
      }); } };
    return { id: lm.id, x: f.x, z: f.z, r, top(x, z) { if (!cells) build(); const h = cells.get(Math.floor(x / C) * 1048576 + Math.floor(z / C)); return h === undefined ? null : h; }, cells: () => (cells ? cells.size : 0) };
  }

  // ---- the surface map (water shaders)
  const N = MAP.N, uniforms = { uWxMap: { value: null }, uWxBox: { value: new THREE.Vector4(0, 0, 1 / MAP.STEP, N) } };
  const mapSt = { data: new Uint8Array(N * N * 4), next: new Uint8Array(N * N * 4), box: null, nextBox: null, pending: 0, stamp: -1, fills: 0, full: false };
  priv(() => { const tex = new THREE.DataTexture(mapSt.data, N, N, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true; uniforms.uWxMap.value = tex; });
  function mapBox(lon, lat) { const s = MAP.STEP; return { lon0: Math.round(lon / s) * s - (N / 2) * s, lat0: Math.max(-90, Math.min(90 - (N - 1) * s, Math.round(lat / s) * s - (N / 2) * s)) }; }
  function fillTexel(buf, box, q) {
    const a = q % N, b = (q / N) | 0, s = MAP.STEP, n = node(lonIndex(Math.round((box.lon0 + a * s) / NODE)), Math.round(Math.max(-90, Math.min(90, box.lat0 + b * s)) / NODE)), e = n.e, o = q * 4;
    buf[o] = Math.round(e.rain * 255); buf[o + 1] = Math.round(e.wetness * 255); buf[o + 2] = Math.round(e.snow * 255); buf[o + 3] = Math.round(Math.min(1, e.mist) * 255);
  }
  function mapStep(lon, lat, force) {
    const want = mapBox(lon, lat), cur = mapSt.box, far = !cur || Math.abs((((want.lon0 - cur.lon0) % 360) + 540) % 360 - 180) > N / 4 * MAP.STEP || Math.abs(want.lat0 - cur.lat0) > N / 4 * MAP.STEP;
    if (far && (!mapSt.nextBox || mapSt.nextBox.lon0 !== want.lon0 || mapSt.nextBox.lat0 !== want.lat0)) { mapSt.nextBox = want; mapSt.pending = 0; }
    const mb = Math.floor(st.time / MAP.REFRESH); if (!mapSt.nextBox && (mapSt.bucket !== mb || mapSt.lv !== st.lv)) { mapSt.nextBox = cur; mapSt.pending = 0; mapSt.stamp = st.stamp; mapSt.bucket = mb; mapSt.lv = st.lv; }
    if (!mapSt.nextBox) return;
    const box = mapSt.nextBox, buf = mapSt.next, end = force ? N * N : Math.min(N * N, mapSt.pending + MAP.PER_FRAME);
    while (mapSt.pending < end) fillTexel(buf, box, mapSt.pending++);
    if (mapSt.pending >= N * N) { mapSt.data.set(buf); mapSt.box = box; mapSt.nextBox = null; mapSt.stamp = st.stamp; mapSt.bucket = Math.floor(st.time / MAP.REFRESH); mapSt.lv = st.lv; mapSt.fills++; uniforms.uWxBox.value.set(box.lon0, box.lat0, 1 / MAP.STEP, N); uniforms.uWxMap.value.needsUpdate = true; }
  }

  // ---- snow: SNOW.N flakes on addressable paths (seed + flake id + page time, never the frame order): flake i falls at its speed through a column of SNOW.H above the
  // receiving surface; each fall (cycle c) has its own spot in a SNOW.BOX tile anchored to the world, shown inside the box round the target (wrapped), so panning
  // never makes them jump; a flake shows when its hash is below the field's snow weight at its spot
  function snowLayer() {
    if (st.snow) return st.snow;
    const n = SNOW.N, pos = new Float32Array(n * 3), sp = new Float32Array(n), ph = new Float32Array(n), dr = new Float32Array(n), hs = new Float32Array(n);
    const key = new Float64Array(n).fill(NaN), base = new Float32Array(n), weight = new Float32Array(n), stamp = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) { sp[i] = 0.5 + hash(i, 2) * 0.4; ph[i] = hash(i, 1); dr[i] = hash(i, 5) * 6.283; hs[i] = hash(i, 7); }
    let o; priv(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color: '#eef4fb', size: SNOW.SIZE, transparent: true, opacity: 0, depthWrite: false }); m.userData.noWrap = true;   // laid out in the display frame (W8e-b)
      o = new THREE.Points(g, m); o.frustumCulled = false; o.visible = false; scene.add(o); });
    return (st.snow = { o, m: o.material, pos, sp, ph, dr, hs, key, base, weight, stamp, n, shown: 0 });
  }
  const wrapIn = (v, c, w) => c + ((((v - c + w / 2) % w) + w) % w) - w / 2;
  function snowStep(t, centre, k, out) {
    const S = snowLayer(), B = SNOW.BOX; let shown = 0;
    for (let i = 0; i < S.n; i++) {
      const u = t * S.sp[i] / SNOW.H + S.ph[i], c = Math.floor(u), f = u - c, X = hash(i * 7919 + c, 11) * B, Z = hash(i * 7919 + c, 13) * B;
      const x = wrapIn(X + Math.cos(t * 0.7 + S.dr[i]) * -0.21, centre[0], B), z = wrapIn(Z, centre[2], B), cell = Math.floor(x / B) * 4096 + Math.floor(z / B), kk = c * 1e7 + cell;
      if (S.key[i] !== kk) { S.key[i] = kk; S.base[i] = surfaceY(x, z) + SNOW.LIFT; S.stamp[i] = -1; }
      if (S.stamp[i] !== st.stamp) { S.weight[i] = fieldXZ(x, z, out).snow; S.stamp[i] = st.stamp; }
      const o = i * 3; if (S.hs[i] < S.weight[i] && k > 0) { S.pos[o] = x; S.pos[o + 1] = S.base[i] + SNOW.H * (1 - f); S.pos[o + 2] = z; shown++; } else { S.pos[o] = x; S.pos[o + 1] = -1e4; S.pos[o + 2] = z; }
    }
    S.o.geometry.attributes.position.needsUpdate = true; S.shown = shown; return shown;
  }

  // ---- registered weather effects (buildings, landmarks, the mist belt): { obj, mat, kind, lon, lat, owner } with kind
  //   drip    eave drips, window runs, leaf tips: drip x dry x the line fade          impact  rain rings in ponds: rain x switch x dry x w_local
  //   mist    weather mist (snow mist, the mist belt): look rule 1 + (k - 1) w_local, x dry, k = max(mist, wetness) or snow (snow-mist)
  // owner = 'reset' when the owner writes the opacity every frame (it is multiplied after), 'fixed' when the opacity is a constant of the material (base x k)
  const effects = [], effTmp = {};
  function register(obj, o) {
    const mat = obj.material; if (!mat || effects.some(e => e.obj === obj)) return null;
    const e = { obj, mat, kind: o.kind, src: o.src || '', lon: o.lon, lat: o.lat, key: o.kind + '|' + o.lon.toFixed(3) + ',' + o.lat.toFixed(3), owner: o.owner || 'fixed', base: mat.opacity, wrote: null, ownerVal: mat.opacity, k: 1, keepsVisible: !!o.keepsVisible };
    effects.push(e); return e;
  }
  const kOf = (e, cache) => {
    const key = e.key; let k = cache.get(key); if (k !== undefined) return k;
    const g = st.gains, f = field(e.lon, e.lat, effTmp);
    if (e.kind === 'drip') k = f.drip * g.dry * g.line;
    else if (e.kind === 'impact') k = f.rain * g.impact;
    else if (e.kind === 'snow-mist') k = (1 + (f.snow - 1) * g.wl) * g.dry;
    else k = (1 + (Math.max(f.mist, f.wetness) - 1) * g.wl) * g.dry;     // mist
    cache.set(key, k); return k;
  };
  function apply() {
    const cache = new Map();
    for (const e of effects) {
      const k = kOf(e, cache); e.k = k;
      if (e.owner === 'reset') { if (e.wrote === null || e.mat.opacity !== e.wrote) e.ownerVal = e.mat.opacity; e.mat.opacity = e.wrote = e.ownerVal * k; }
      else e.mat.opacity = e.base * k;
      if (e.keepsVisible) { if (!(k > 0.001)) e.obj.visible = false; } else e.obj.visible = k > 0.001;
    }
  }

  function tick(t, dt, view) {
    const time = st.fixed !== null ? st.fixed : t + st.offset;
    if (st.view) view = st.view;
    if (!(view.d >= 0)) throw new Error('weather_fx: the view needs d, the camera-target distance');
    // W8e-c (D8 revised, W8_SPEC 11.4): on the sphere the weather is always clear; the mode switch fades every effect linearly with uBend (dry = 1 - uBend), once
    const dry = view.u > 0 ? 1 - view.u : 1, lv = W.lockVersion(), bucket = Math.floor(time / REFRESH);
    if (bucket !== st.bucket || lv !== st.lv) { st.stamp++; st.bucket = bucket; st.lv = lv; } st.time = time;
    const ll = view.lonLat, r = W.at(ll.lon, ll.lat, time), wl0 = WX.wLocal(view.h), wl = wl0 * dry, w = r.weights;
    const rainOn = !global.SECTION_API || global.SECTION_API.state.settings.rain;
    st.gains = { dry, wl: wl0, impact: (rainOn ? 1 : 0) * dry * wl0, wet: dry, line: LINE_FADE(view.d), rainOn };
    let mh = 0, mm = 0, rain = 0, pud = 0, fogAdd = 0; for (const k in w) { if (!w[k]) continue; mh += w[k] * MULT[k][0]; mm += w[k] * MULT[k][1]; rain += w[k] * RAIN[k]; pud += w[k] * PUDDLE[k]; fogAdd += w[k] * FOG_ADD[k]; }
    // looks blend towards the rain look with height: 1 + (m - 1) * wl
    mh = 1 + (mh - 1) * wl; mm = 1 + (mm - 1) * wl; pud = (1 + (pud - 1) * wl) * dry; rain *= dry; fogAdd *= wl; const fogK = w.fog * wl;
    fogAdd = Math.min(fogAdd, Math.max(0, FOG_DEPTH / view.d - look.fog));
    const night = ctx.nightGain ? ctx.nightGain() : 1;
    ctx.hemi.intensity = look.hemi * night * mh; ctx.moon.intensity = look.moon * night * mm; scene.fog.density = look.fog + fogAdd;
    fogW.value = fogAdd;                                                   // ink lines are covered by this part of the fog only (bend.js)
    fogMixed.copy(look.fogColor); if (fogK > 0) fogMixed.lerp(fogTint, Math.min(1, fogK));
    scene.fog.color.copy(fogMixed); if (scene.background && scene.background.isColor) scene.background.copy(fogMixed);
    st.last = { ...r, time, h: view.h, wLocal: wl, dry, lon: ll.lon, lat: ll.lat, d: view.d, puddleWeight: pud, fogAdd, rainAtTarget: rain, stamp: st.stamp };
    // snow: thinned by the field, opacity by the height blend and the map mode; hidden and not updated when nothing would show
    const sk = SNOW.OPACITY * wl, tgt = view.target, anySnow = sk > 0.001 && (field(ll.lon, ll.lat, effTmp).snow > 0 || boxHas(tgt, 'snow'));
    if (anySnow) { const S = snowLayer(); S.m.opacity = sk; const n = snowStep(t, tgt, sk, effTmp); S.o.visible = n > 0; }
    else if (st.snow) { st.snow.o.visible = false; st.snow.shown = 0; }
    mapStep(ll.lon, ll.lat, lv !== st.mapLv || !mapSt.box); st.mapLv = lv;
  }
  // any of the given effect in the box round the target (the corners and the middle of the edges: the field is smooth over 15 m, the box is 40 m)
  function boxHas(c, kind) { const h = SNOW.BOX / 2; for (const [dx, dz] of [[-h, -h], [h, -h], [-h, h], [h, h], [0, -h], [0, h], [-h, 0], [h, 0]]) if (fieldXZ(c[0] + dx, c[2] + dz, effTmp)[kind] > 0) return true; return false; }

  const api = {
    at: (lon, lat, t) => W.at(lon, lat, t), lock: s => W.lock(s), locked: () => W.locked(),
    setTime(t) { st.fixed = t === null || t === undefined ? null : +t; return st.fixed; },
    get: () => st.last,
    setView(v) { st.view = v || null; },                                    // tools: weather of a given place { lonLat, h, d, target } instead of the camera's
    place: (lon, lat) => W.place(lon, lat), tick, apply, register,
    field, fieldXZ, surfaceY, boxHas, stamp: () => st.stamp, bucket: () => st.bucket, lockVersion: () => st.lv, gains: () => st.gains, time: () => st.time,
    setSurface(o) { if (o.terrain !== undefined) surf.terrain = o.terrain; if (o.roads !== undefined) surf.roads = o.roads; if (o.landmark) surf.landmarks.push(landmarkCover(o.landmark, o.groups)); },
    surfaces: () => ({ terrain: !!surf.terrain, roads: !!surf.roads, landmarks: surf.landmarks.map(l => ({ id: l.id, cells: l.cells() })) }),
    effects: () => effects.map(e => ({ kind: e.kind, src: e.src, owner: e.owner, k: e.k, opacity: e.mat.opacity, visible: e.obj.visible, lon: e.lon, lat: e.lat, type: e.obj.type })),
    effectObjects: () => effects.map(e => e.obj),
    snow: () => st.snow, map: () => ({ box: mapSt.box, fills: mapSt.fills, stamp: mapSt.stamp, data: mapSt.data, N, STEP: MAP.STEP }),
    nodes: () => nodes.size, uniforms, weather: W,
  };
  global.WEATHER_FX.surface = { uniforms, GLSL, EMPTY };
  global.WEATHER_FX.live = api;
  return api;
}
global.WEATHER_FX = { attach, MULT, RAIN, PUDDLE, FOG_ADD, FOG_SEE, NODE, FINE, REFRESH, MAP, SNOW, GLSL, LINE_FADE, surface: null, live: null };
})(typeof globalThis !== 'undefined' ? globalThis : this);
