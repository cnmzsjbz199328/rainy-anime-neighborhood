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
//   WX3          the wetness memory of weather.js (the ground dries slowly after the rain) in the field and the map; surface responses in the shaders (snowCover:
//                 a thin whitening of the ground where it snows, duneWet: dark wet patches on the dunes that shrink as they dry, poolWet: lamp pools and puddle
//                 reflections brighter on wet ground, the paddies' mirror after the rain in water.js); local pieces round the target (leaf drips under the
//                 forest's trees, low ground mist in foggy places, snow mist where it snows, thin steam where rain falls on the lava field, the fumaroles of
//                 BI08 on ameni-dake's north slope: not weather, always on the flat map, clearer on clear nights)
// The map mode is applied once, at the end: dry = 1 - uBend multiplies every weather effect (the sphere is a clear day at every distance, D8 / D9 revised). With the
// camera's height above the ground, w_local(h) = 1 - smoothstep(40, 120, h): looks (lights, fog, mist) blend towards the rain-night look, particles, rain impacts and
// drips fade out (the rain lines and drips with the camera distance, (110 - d) / 60, as the rain always did); at the panorama (h >= 120 m) every weather looks the same.
// The lights and the fog have explicit bases (ctx.look: written by look.js, the map transition and the walk; WX-G): every frame the weather
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
const WET_REFRESH = 5;                                              // weather seconds between two evaluations of a node's wetness memory (drying <= 2.2 % per 10 s)
const GLSL_NOISE = `
float wxHash(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float wxNoise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f); return mix(mix(wxHash(i), wxHash(i + vec2(1.0, 0.0)), u.x), mix(wxHash(i + vec2(0.0, 1.0)), wxHash(i + vec2(1.0, 1.0)), u.x), u.y); }`;
// WX3 surface responses: shader patches (onBeforeCompile; named functions, so bend.js's program key stays one per patch). The flat position before bend.js moves it is
// captured in vWxP; uWxK = w_local x (1 - uBend): every response is 0 at the panorama and on the sphere, and exactly nothing where the map says 0
function wxPrelude(shader) {
  const U = global.WEATHER_FX.surface.uniforms; shader.uniforms.uWxMap = U.uWxMap; shader.uniforms.uWxBox = U.uWxBox; shader.uniforms.uWxK = U.uWxK;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWxP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWxP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWxP;\nuniform float uWxK;\n' + GLSL + GLSL_NOISE);
}
// snowCover: where it snows (the map's snow is 0 everywhere snow is not allowed) the ground whitens by up to SNOW_COVER (the permanent snow line of terrain.js stays)
// (each response is inside `if (uWxK > 0.0)`: one branch for the whole draw, so the sphere and the panorama, where the planet's ground fills the screen, skip the lookup)
function snowCover(shader) { wxPrelude(shader); shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n\tif (uWxK > 0.0) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.94, 0.98), 0.28 * wxAt(vWxP).b * uWxK);'); }
// duneWet (BI04): after the rare rain the sand shows dark wet patches; the patches are the noise above a threshold that rises as the wetness memory falls
function duneWet(shader) { wxPrelude(shader); shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
	if (uWxK > 0.0) { float w = wxAt(vWxP).g * uWxK; float n = wxNoise(vWxP.xz * 0.55) * 0.7 + wxNoise(vWxP.xz * 1.9) * 0.3; float th = 1.0 - 0.75 * w; diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(th, th + 0.12, n) * step(0.001, w); }`); }
// poolWet: the light pools and the lamps' reflections in puddles follow the wetness: full on wet ground (rain, after it), POOL_DRY on dry ground; the look rule (1 at
// the panorama and on the sphere)
function poolWet(shader) { wxPrelude(shader); shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', '\tif (uWxK > 0.0) outgoingLight *= mix(1.0, mix(0.6, 1.0, wxAt(vWxP).g), uWxK);\n#include <opaque_fragment>'); }

function attach(THREE, scene, ctx) {
  const WX = global.WEATHER, W = WX.make(global.WORLD), fogW = ctx.bend.weatherFogUniform, look = ctx.look;
  const st = { offset: 0, fixed: null, last: null, view: null, snow: null, stamp: 0, bucket: -1, lv: -1, wetStamp: 0, wetBucket: -1, time: 0, gains: { impact: 1, wet: 1, dry: 1, wl: 1, line: 1 } };
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
      if (n.ws !== st.wetStamp) { n.wm = W.wetnessOf(n.p, st.time); n.ws = st.wetStamp; } if (n.wm > e.wetness) e.wetness = n.wm;      // WX3: the ground dries slowly
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
  const N = MAP.N, uniforms = { uWxMap: { value: null }, uWxBox: { value: new THREE.Vector4(0, 0, 1 / MAP.STEP, N) }, uWxK: { value: 1 } };
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
    if (bucket !== st.bucket || lv !== st.lv) { st.stamp++; st.bucket = bucket; st.lv = lv; const wb = Math.floor(time / WET_REFRESH); if (wb !== st.wetBucket || lv !== st.wetLv) { st.wetStamp++; st.wetBucket = wb; st.wetLv = lv; } } st.time = time;
    const ll = view.lonLat, r = W.at(ll.lon, ll.lat, time), wl0 = WX.wLocal(view.h), wl = wl0 * dry, w = r.weights;
    const rainOn = true;
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
    uniforms.uWxK.value = wl;                                              // the surface responses (snowCover, duneWet, poolWet, the paddies' mirror): w_local x (1 - uBend)
    localStep(t, tgt, view);
  }
  // ---- WX3: local pieces round the target. Each pool is one draw call, hidden (and not updated) when none of its pieces shows; pieces sit on world-anchored spots
  // wrapped into the box (like the snow) and on the receiving surface; each shows where the field gives its effect (its hash below the local weight). The cards are
  // additive (fog and the daylight of the sphere dim additive light: bend.js), one soft round texture.
  const LOCAL = { BOX: 40, DRIPS: 360, TREES: 120, MIST: 28, SNOWMIST: 24, STEAM: 24, VENTS: 6, PUFFS: 5 };
  const loc = { built: false };
  function buildLocal() {
    if (loc.built) return loc; loc.built = true;
    priv(() => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const q = c.getContext('2d'), g = q.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c), card = new THREE.PlaneGeometry(1, 1);
      const pool = (name, n, color) => { const m = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); m.userData.noWrap = true;
        const o = new THREE.InstancedMesh(card, m, n); o.name = 'weather:' + name; o.frustumCulled = false; o.visible = false; o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); for (let i = 0; i < n; i++) o.setColorAt(i, new THREE.Color(0, 0, 0)); scene.add(o); return o; };
      loc.mist = pool('ground-mist', LOCAL.MIST, '#ffffff'); loc.snowMist = pool('snow-mist', LOCAL.SNOWMIST, '#ffffff'); loc.steam = pool('rain-steam', LOCAL.STEAM, '#ffffff'); loc.vents = pool('fumarole', LOCAL.VENTS * LOCAL.PUFFS, '#ffffff');
      const dg = new THREE.BufferGeometry(); loc.dripPos = new Float32Array(LOCAL.DRIPS * 6); dg.setAttribute('position', new THREE.BufferAttribute(loc.dripPos, 3));
      const dm = new THREE.LineBasicMaterial({ color: '#cee7e5', transparent: true, opacity: 0.6, depthWrite: false }); dm.userData.noWrap = true;
      loc.drips = new THREE.LineSegments(dg, dm); loc.drips.name = 'weather:leaf-drips'; loc.drips.frustumCulled = false; loc.drips.visible = false; scene.add(loc.drips);
    });
    loc.m4 = new THREE.Matrix4(); loc.q = new THREE.Quaternion(); loc.e = new THREE.Euler(); loc.v = new THREE.Vector3(); loc.sc = new THREE.Vector3(); loc.col = new THREE.Color();
    loc.trees = null; loc.treeKey = ''; loc.sel = []; loc.shown = { drips: 0, mist: 0, snowMist: 0, steam: 0, vents: 0 };
    return loc;
  }
  // the trees of the forest (landcover.js) by 8 m flat cells, once
  function treeIndex() {
    if (loc.trees) return loc.trees; const C = global.LANDCOVER_API, D0 = C && C.data && C.data(); if (!D0 || !D0.forest) return null;
    const cells = new Map(), list = [], T = new Set(['treeRound', 'cedar', 'pine', 'bamboo']);
    for (const it of D0.forest.items) { if (!T.has(it.type)) continue; const f = global.WORLD.lonLatToTown(it.lon, it.lat), k = 1 / Math.cos(it.lat * D), i = list.length;
      list.push({ x: f.x, z: f.z, y: (it.alt - BASE) * k, h: (it.type === 'bamboo' ? 2.2 : it.type === 'treeRound' ? 2.0 : 2.6) * (it.s[1] || 1) * k, r: 0.9 * (it.s[0] || 1) * k, i });
      const key = Math.floor(f.x / 8) * 65536 + Math.floor(f.z / 8); let l = cells.get(key); if (!l) cells.set(key, l = []); l.push(i); }
    return (loc.trees = { cells, list });
  }
  // BI08: the fumaroles, VENTS points of the lava field on ameni-dake's north and north-west slope (12-34 m from the summit), at least 6 m apart, off the roads and
  // outside LM01's summit model; picked once from a fixed scatter
  function fumaroles() {
    const W0 = global.WORLD, lm = W0.landmarks.find(q => q.id === 'LM01'), out = []; if (!lm) return out;
    for (let i = 0; i < 400 && out.length < LOCAL.VENTS; i++) {
      const brg = 270 + hash(i, 31) * 135, r = 12 + hash(i, 37) * 22, p = W0.destination(lm, brg % 360, r); if (W.place(p.lon, p.lat).cat !== 'lava') continue;
      const f = W0.lonLatToTown(p.lon, p.lat); if (surf.roads && surf.roads(f.x, f.z) != null) continue;
      if (out.some(o => Math.hypot(o.x - f.x, o.z - f.z) * Math.cos(p.lat * D) < 6)) continue;
      out.push({ lon: p.lon, lat: p.lat, x: f.x, z: f.z, ph: hash(i, 41) });
    }
    return out;
  }
  const vents = () => loc.ventList || (loc.ventList = fumaroles());
  const hide = (o, i) => { loc.m4.makeScale(0, 0, 0); o.setMatrixAt(i, loc.m4); o.setColorAt(i, loc.col.setRGB(0, 0, 0)); };
  const putCard = (o, i, x, y, z, sx, sy, yaw, a) => { loc.e.set(0, yaw, 0); loc.q.setFromEuler(loc.e); loc.m4.compose(loc.v.set(x, y, z), loc.q, loc.sc.set(sx, sy, 1)); o.setMatrixAt(i, loc.m4); o.setColorAt(i, loc.col.setRGB(a, a, a)); };
  function localStep(t, centre, view) {
    const g = st.gains, kLook = g.wl * g.dry, B = LOCAL.BOX, o = {};
    // anything to do? the box's field (corners and edges) and the vents' distance; otherwise every pool stays hidden and untouched
    const any = { drip: boxHas(centre, 'drip'), mist: boxHas(centre, 'mist'), snow: boxHas(centre, 'snow'), rain: boxHas(centre, 'rain') };
    const ventNear = vents().some(v => Math.abs(v.x - centre[0]) < 60 && Math.abs(v.z - centre[2]) < 60);
    if (!(kLook > 0.001) && !(g.dry > 0.001 && ventNear) || !(any.drip || any.mist || any.snow || any.rain || ventNear)) { if (loc.built) { loc.drips.visible = loc.mist.visible = loc.snowMist.visible = loc.steam.visible = loc.vents.visible = false; for (const k in loc.shown) loc.shown[k] = 0; } return; }
    const L = buildLocal(), cam = view.cam || [centre[0] + 1, centre[2] + 1], camYaw = Math.atan2(cam[0] - centre[0], cam[1] - centre[2]);   // the cards face the camera
    // leaf drips: three per selected tree in the box (trees picked by their own hash, at most TREES), falling from the canopy's underside to the ground
    let nd = 0; const TI = any.drip && kLook > 0.001 ? treeIndex() : null;
    if (TI) {
      const key = Math.round(centre[0] / 2) + ',' + Math.round(centre[2] / 2) + ',' + st.stamp;
      if (key !== L.treeKey) { L.treeKey = key; L.sel = []; for (let a = Math.floor((centre[0] - B / 2) / 8); a <= Math.floor((centre[0] + B / 2) / 8); a++) for (let b = Math.floor((centre[2] - B / 2) / 8); b <= Math.floor((centre[2] + B / 2) / 8); b++) for (const i of TI.cells.get(a * 65536 + b) || []) { const tr = TI.list[i]; if (Math.abs(tr.x - centre[0]) < B / 2 && Math.abs(tr.z - centre[2]) < B / 2 && hash(i, 3) < 0.6) L.sel.push(tr); }
        L.sel.sort((p, q) => hash(p.i, 5) - hash(q.i, 5)); L.sel.length = Math.min(L.sel.length, LOCAL.TREES); for (const tr of L.sel) tr.w = fieldXZ(tr.x, tr.z, o).drip; }
      for (let s = 0; s < L.sel.length; s++) { const tr = L.sel[s]; for (let k = 0; k < 3; k++) { const j = tr.i * 3 + k; if (!(hash(j, 7) < tr.w)) continue;
        const a = hash(j, 9) * 6.283, rr = tr.r * (0.35 + 0.6 * hash(j, 11)), x = tr.x + Math.cos(a) * rr, z = tr.z + Math.sin(a) * rr, top = tr.y + tr.h, f = (t * (0.55 + 0.25 * hash(j, 13)) + hash(j, 15)) % 1, y = top - f * (top - tr.y), n = nd * 6;
        L.dripPos[n] = L.dripPos[n + 3] = x; L.dripPos[n + 2] = L.dripPos[n + 5] = z; L.dripPos[n + 1] = y; L.dripPos[n + 4] = y + 0.1; nd++; if (nd >= LOCAL.DRIPS) break; } if (nd >= LOCAL.DRIPS) break; }
      for (let n = nd * 6; n < LOCAL.DRIPS * 6; n++) L.dripPos[n] = n % 3 === 1 ? -1e4 : 0;
      L.drips.geometry.attributes.position.needsUpdate = true; L.drips.geometry.setDrawRange(0, Math.max(2, nd * 2));
    }
    L.drips.material.opacity = 0.6 * g.dry * g.line; L.drips.visible = nd > 0 && L.drips.material.opacity > 0.001; L.shown.drips = L.drips.visible ? nd : 0;
    // ground mist, snow mist, rain steam: cards on spots of a BOX tile, slow drift; a card shows where its effect is (mist only in foggy places, steam only on lava)
    const cards = (o3, n, salt, want, fn) => { let shown = 0; if (!want || !(kLook > 0.001)) { o3.visible = false; return 0; }
      for (let i = 0; i < n; i++) { const X = hash(i, salt) * B, Z = hash(i, salt + 1) * B, x = wrapIn(X + t * 0.05 * (hash(i, salt + 2) - 0.5), centre[0], B), z = wrapIn(Z, centre[2], B), r = fn(i, x, z, salt);
        if (r) { putCard(o3, i, x, r.y, z, r.sx, r.sy, camYaw + r.yaw, r.a); shown++; } else hide(o3, i); }
      o3.instanceMatrix.needsUpdate = true; o3.instanceColor.needsUpdate = true; o3.visible = shown > 0; return shown; };
    const catAt = (x, z) => { const ll = llOf(x, z); return W.place(Math.round(ll.lon * 8) / 8, Math.round(ll.lat * 8) / 8).cat; };
    L.shown.mist = cards(L.mist, LOCAL.MIST, 101, any.mist, (i, x, z) => { const e = fieldXZ(x, z, o); if (!(hash(i, 99) < e.mist) || catAt(x, z) !== 'foggy') return null; const a = 0.10 * kLook * (0.75 + 0.25 * Math.sin(t * 0.21 + i)); return { y: surfaceY(x, z) + 0.5 + 0.4 * hash(i, 98), sx: 4 + 2 * hash(i, 97), sy: 1.1, yaw: 0, a }; });
    L.shown.snowMist = cards(L.snowMist, LOCAL.SNOWMIST, 201, any.snow, (i, x, z) => { const e = fieldXZ(x, z, o); if (!(hash(i, 199) < e.snow)) return null; const a = 0.13 * kLook * (0.7 + 0.3 * Math.sin(t * 0.4 + i * 1.7)); return { y: surfaceY(x, z) + 0.35 + 0.3 * hash(i, 198), sx: 3 + 2 * hash(i, 197), sy: 0.8, yaw: 0, a }; });
    L.shown.steam = cards(L.steam, LOCAL.STEAM, 301, any.rain, (i, x, z) => { const e = fieldXZ(x, z, o); if (!(hash(i, 299) < e.rain) || catAt(x, z) !== 'lava') return null; const f = (t * 0.12 + hash(i, 298)) % 1, a = 0.09 * kLook * Math.sin(Math.PI * f); return { y: surfaceY(x, z) + 0.2 + 1.4 * f, sx: 0.5 + 0.6 * f, sy: 1.2 + 0.8 * f, yaw: 0, a }; });
    // the fumaroles: PUFFS puffs per vent rise 3 m, widen and fade (the steam of LM00_lib, one draw call); not weather: on whenever the map is flat, x (0.8 + 0.4 clear)
    let nv = 0; if (ventNear && g.dry > 0.001) { const ll0 = llOf(centre[0], centre[2]), clear = W.at(ll0.lon, ll0.lat, st.time).weights.clear;
      vents().forEach((v, vi) => { const k0 = 0.11 * g.dry * (0.8 + 0.4 * clear * g.wl); for (let p = 0; p < LOCAL.PUFFS; p++) { const i = vi * LOCAL.PUFFS + p, f = (t * 0.06 + p / LOCAL.PUFFS + v.ph) % 1;
        putCard(L.vents, i, v.x + Math.sin(t * 0.3 + p) * 0.25 * f, surfaceY(v.x, v.z) + 0.3 + 3.2 * f, v.z, 0.7 * (1 + 2.2 * f), 0.7 * (1 + 2.2 * f), camYaw, k0 * Math.sin(Math.PI * f)); nv++; } });
      for (let i = vents().length * LOCAL.PUFFS; i < LOCAL.VENTS * LOCAL.PUFFS; i++) hide(L.vents, i); L.vents.instanceMatrix.needsUpdate = true; L.vents.instanceColor.needsUpdate = true; }
    L.vents.visible = nv > 0; L.shown.vents = nv;
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
    snow: () => st.snow, local: () => loc, fumaroles: () => vents(), map: () => ({ box: mapSt.box, fills: mapSt.fills, stamp: mapSt.stamp, data: mapSt.data, N, STEP: MAP.STEP }),
    nodes: () => nodes.size, uniforms, weather: W,
  };
  global.WEATHER_FX.surface = { uniforms, GLSL, EMPTY };
  global.WEATHER_FX.live = api;
  return api;
}
global.WEATHER_FX = { attach, MULT, RAIN, PUDDLE, FOG_ADD, FOG_SEE, NODE, FINE, REFRESH, MAP, SNOW, GLSL, LINE_FADE, snowCover, duneWet, poolWet, surface: null, live: null };
})(typeof globalThis !== 'undefined' ? globalThis : this);
