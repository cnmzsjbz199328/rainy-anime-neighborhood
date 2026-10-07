// What the weather looks like (W8b, ST05), driven by weather.js at the camera's target. Only existing means: the rain lines, the puddle ripples, the two lights,
// the exponential fog, and one new particle layer for snow. Every effect is a multiplier or an addition that is exactly 1 / 0 for rain, so the town under
// rain (the default, and weather.lock('rain')) renders as it always did. Effects fade with the camera's height above the ground: w_local(h) = 1 - smoothstep(40, 120, h);
// at the panorama (h >= 120 m) every weather looks the same (the clear moonlit night of the panorama belongs to the light presets, W8c).
//   rain      the existing rain, ripples, drips (unchanged)
//   after     no rain lines; ripples stay (puddles brightest), a thin ground mist (fog density +), drips go on
//   overcast  no rain; moon 0.55, sky light 0.75
//   clear     no rain, ripples stop; moon 1.25, sky light 1.1
//   snow      fine snow falling (slower, larger, sparser than rain), sky light 1.1 bluish
//   fog       grey-violet fog (density + 0.03), no rain
(function (global) {
'use strict';
const MULT = { rain: [1, 1], after: [1.05, 1], overcast: [0.75, 0.55], clear: [1.1, 1.25], snow: [1.1, 1], fog: [0.9, 0.8] };          // [sky light, moon]
const RAIN = { rain: 1, after: 0, overcast: 0, clear: 0, snow: 0, fog: 0 }, PUDDLE = { rain: 1, after: 1, overcast: 0.6, clear: 0, snow: 0, fog: 0.6 };
const FOG_ADD = { rain: 0, after: 0.006, overcast: 0, clear: 0, snow: 0.004, fog: 0.03 };
function attach(THREE, scene, ctx) {
  const W = global.WEATHER.make(global.WORLD), st = { t0: null, offset: 0, fixed: null, last: null, snow: null };
  const own = { hemi: null, moon: null, fog: null, fogColor: null }, base = { hemi: 0, moon: 0, fog: 0, fogColor: new THREE.Color() }, fogTint = new THREE.Color('#5a5870');
  // the lights and the fog are also written by the light presets (section.js) and the transition: whatever changed them since our last write is the new base
  const sync = () => { const h = ctx.hemi.intensity, m = ctx.moon.intensity, f = scene.fog.density; if (h !== own.hemi) base.hemi = h; if (m !== own.moon) base.moon = m; if (f !== own.fog) base.fog = f;  };
  // snow: 900 flakes in a box round the target, own random stream (the page's Math.random is never touched)
  function snowLayer() {
    if (st.snow) return st.snow; let s = 0x51f0; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const N = 900, pos = new Float32Array(N * 3), sp = new Float32Array(N); for (let i = 0; i < N; i++) { pos[i * 3] = (rnd() - 0.5) * 40; pos[i * 3 + 1] = rnd() * 9; pos[i * 3 + 2] = (rnd() - 0.5) * 40; sp[i] = 0.5 + rnd() * 0.4; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: '#eef4fb', size: 0.09, transparent: true, opacity: 0, depthWrite: false }); m.userData.noWrap = true;   // laid out round the target in the display frame (W8e-b)
    const o = new THREE.Points(g, m); o.frustumCulled = false; o.visible = false; scene.add(o); return (st.snow = { o, m, pos, sp, N, rnd });
  }
  function tick(t, dt, view) {
    const time = st.fixed !== null ? st.fixed : t + st.offset;
    if (st.view) view = st.view;
    const ll = view.lonLat, r = W.at(ll.lon, ll.lat, time), wl = global.WEATHER.wLocal(view.h), w = r.weights; st.last = { ...r, time, h: view.h, wLocal: wl, lon: ll.lon, lat: ll.lat };
    let mh = 0, mm = 0, rain = 0, pud = 0, fogAdd = 0; for (const k in w) { if (!w[k]) continue; mh += w[k] * MULT[k][0]; mm += w[k] * MULT[k][1]; rain += w[k] * RAIN[k]; pud += w[k] * PUDDLE[k]; fogAdd += w[k] * FOG_ADD[k]; }
    // blend towards the rain look with height: 1 + (m - 1) * wl
    mh = 1 + (mh - 1) * wl; mm = 1 + (mm - 1) * wl; pud = 1 + (pud - 1) * wl; fogAdd *= wl; const fogK = w.fog * wl;
    sync();
    if (mh !== 1 || own.hemi !== null) { ctx.hemi.intensity = own.hemi = base.hemi * mh; }
    if (mm !== 1 || own.moon !== null) { ctx.moon.intensity = own.moon = base.moon * mm; }
    if (fogAdd !== 0 || own.fog !== null) { scene.fog.density = own.fog = base.fog + fogAdd; }
    if (fogK > 0) { if (own.fogColor === null) base.fogColor.copy(scene.fog.color); scene.fog.color.copy(base.fogColor).lerp(fogTint, Math.min(1, fogK)); if (scene.background && scene.background.isColor) scene.background.copy(scene.fog.color); own.fogColor = scene.fog.color.clone(); }
    else if (own.fogColor !== null) { scene.fog.color.copy(base.fogColor); if (scene.background && scene.background.isColor) scene.background.copy(base.fogColor); own.fogColor = null; }
    if (rain !== 1) ctx.rainMat.opacity *= rain;
    if (pud !== 1) for (const g of ctx.rings) g.a.material.opacity *= pud;
    // snow: falls round the target, opacity by the snow weight and the height blend
    const sw = w.snow * wl;
    if (sw > 0.001) { const S = snowLayer(), c = view.target; S.o.visible = true; S.m.opacity = 0.85 * sw; S.o.position.set(c[0], 0, c[2]);
      for (let i = 0; i < S.N; i++) { const k = i * 3; S.pos[k + 1] -= dt * S.sp[i]; S.pos[k] += Math.sin(time * 0.7 + i) * dt * 0.15; if (S.pos[k + 1] < 0.1) { S.pos[k + 1] = 9; S.pos[k] = (S.rnd() - 0.5) * 40; S.pos[k + 2] = (S.rnd() - 0.5) * 40; } }
      S.o.geometry.attributes.position.needsUpdate = true; }
    else if (st.snow) st.snow.o.visible = false;
  }
  const api = {
    at: (lon, lat, t) => W.at(lon, lat, t), lock: s => W.lock(s), locked: () => W.locked(),
    setTime(t) { st.fixed = t === null || t === undefined ? null : +t; return st.fixed; },
    get: () => st.last,
    setView(v) { st.view = v || null; },                                    // tools: weather of a given place and height instead of the camera's
    place: (lon, lat) => W.place(lon, lat), tick,
  };
  return api;
}
global.WEATHER_FX = { attach, MULT, RAIN, PUDDLE, FOG_ADD };
})(typeof globalThis !== 'undefined' ? globalThis : this);
