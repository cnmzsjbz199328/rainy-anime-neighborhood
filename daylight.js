// The clear daytime of the sphere (W8e-c, W8_SPEC 11.3, D9 revised 2026-10-07). One global uDay = uBend: 0 on the flat map (the night, untouched), 1 on the sphere.
// Applied at render time only (scene.onBeforeRender, undone in scene.onAfterRender), so the night systems that write the lights and the sky every frame (weather_fx.js,
// nightlight.js, the light presets of section.js) keep reading their own values, and nothing at all is touched while uDay = 0:
//   sky      the background and the fog colour go from the night blue to a day sky
//   sun      the moon light becomes the sun: warm white, from a fixed direction in the frame of the view target (SUN_LOCAL: about 50 deg above the horizon, from the
//            south-west), so wherever the sphere is turned the side in view is in daylight
//   sky light the hemisphere light turns bright and points along the target's local up
//   sea      the moon glint of the ocean follows the sun and turns warm (ocean.js uGlint)
// Emissive light (windows, lamps) and the additive glows fade with (1 - uBend) in the shader (bend.js); stars, the light band, the far lights and the readable panorama light
// with (1 - uBend) in nightlight.js; the weather with (1 - uBend) in weather_fx.js (W8_SPEC 11.4).
(function (global) {
'use strict';
const DAY = {
  sky: '#a3c6e1', hemiSky: '#eef3f8', hemiGround: '#8c8a7a', hemi: 1.55,
  sun: '#fff0d8', sunI: 2.6, SUN_LOCAL: [-0.45, 0.76, 0.47],            // east, up, south components (normalised below)
  glint: [1.0, 0.93, 0.78],
};
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// the local frame of the view target, blended from the world axes (flat) to the sphere's east / up / south by u (as transition.js frame())
function frameAt(B, x, z, u) {
  const b = B.basis(x, z), up = norm(mix([0, 1, 0], b.up, u)), e0 = mix([1, 0, 0], b.east, u), k = e0[0] * up[0] + e0[1] * up[1] + e0[2] * up[2];
  const east = norm([e0[0] - k * up[0], e0[1] - k * up[1], e0[2] - k * up[2]]), south = cross(east, up);
  return { east, up, south };
}
function sunDir(B, x, z, u) {
  const f = frameAt(B, x, z, u), s = norm(DAY.SUN_LOCAL);
  return norm([f.east[0] * s[0] + f.up[0] * s[1] + f.south[0] * s[2], f.east[1] * s[0] + f.up[1] * s[1] + f.south[1] * s[2], f.east[2] * s[0] + f.up[2] * s[1] + f.south[2] * s[2]]);
}
// ctx = { THREE, scene, hemi, moon, BEND, target: () => [x, y, z] (flat frame), glint: () => { uMoon, uGlint } uniforms of the sea or null }
function attach(ctx) {
  const T = ctx.THREE, sc = ctx.scene, C = { sky: new T.Color(DAY.sky), hemiSky: new T.Color(DAY.hemiSky), hemiGround: new T.Color(DAY.hemiGround), sun: new T.Color(DAY.sun) };
  const saved = { bg: new T.Color(), fog: new T.Color(), hemiColor: new T.Color(), hemiGround: new T.Color(), hemiI: 0, hemiPos: new T.Vector3(), moonColor: new T.Color(), moonI: 0, moonPos: new T.Vector3(), uMoon: new T.Vector3(), uGlint: new T.Vector3() };
  const st = { active: false, last: null };
  const prevB = sc.onBeforeRender, prevA = sc.onAfterRender;
  sc.onBeforeRender = function () {
    const u = ctx.BEND.get(); st.active = u > 0;
    if (st.active) {
      const h = ctx.hemi, m = ctx.moon, t = ctx.target(), g = ctx.glint && ctx.glint();
      if (sc.background && sc.background.isColor) { saved.bg.copy(sc.background); sc.background.lerp(C.sky, u); }
      if (sc.fog) { saved.fog.copy(sc.fog.color); sc.fog.color.lerp(C.sky, u); }
      saved.hemiColor.copy(h.color); saved.hemiGround.copy(h.groundColor); saved.hemiI = h.intensity; saved.hemiPos.copy(h.position);
      saved.moonColor.copy(m.color); saved.moonI = m.intensity; saved.moonPos.copy(m.position);
      const f = frameAt(ctx.BEND, t[0], t[2], u), sun = sunDir(ctx.BEND, t[0], t[2], u), moonDir = norm(m.position.toArray()), dir = norm(mix(moonDir, sun, u)), len = m.position.length();
      h.color.lerp(C.hemiSky, u); h.groundColor.lerp(C.hemiGround, u); h.intensity += (DAY.hemi - h.intensity) * u;
      h.position.set(...norm(mix(norm(h.position.toArray()), f.up, u))); h.updateMatrixWorld();
      m.color.lerp(C.sun, u); m.intensity += (DAY.sunI - m.intensity) * u; m.position.set(dir[0] * len, dir[1] * len, dir[2] * len); m.updateMatrixWorld();
      if (g) { saved.uMoon.copy(g.uMoon.value); saved.uGlint.copy(g.uGlint.value); g.uMoon.value.set(...norm(mix(saved.uMoon.toArray(), sun, u))); g.uGlint.value.set(...mix(saved.uGlint.toArray(), DAY.glint, u)); }
      st.last = { u, sun, up: f.up, sky: sc.background && sc.background.getHexString(), hemi: h.intensity, sunI: m.intensity };
    }
    return prevB.apply(this, arguments);
  };
  sc.onAfterRender = function () {
    if (st.active) {
      const h = ctx.hemi, m = ctx.moon, g = ctx.glint && ctx.glint();
      if (sc.background && sc.background.isColor) sc.background.copy(saved.bg);
      if (sc.fog) sc.fog.color.copy(saved.fog);
      h.color.copy(saved.hemiColor); h.groundColor.copy(saved.hemiGround); h.intensity = saved.hemiI; h.position.copy(saved.hemiPos); h.updateMatrixWorld();
      m.color.copy(saved.moonColor); m.intensity = saved.moonI; m.position.copy(saved.moonPos); m.updateMatrixWorld();
      if (g) { g.uMoon.value.copy(saved.uMoon); g.uGlint.value.copy(saved.uGlint); }
      st.active = false;
    }
    return prevA.apply(this, arguments);
  };
  return { state: st, DAY, sunDir: (x, z, u) => sunDir(ctx.BEND, x, z, u) };
}
global.DAYLIGHT = { attach, DAY, sunDir, frameAt };
})(typeof globalThis !== 'undefined' ? globalThis : this);
