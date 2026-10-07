// Night light of the planet by the camera's height (W8c, W8_SPEC section 5). Pure curves first (no DOM, no THREE), then attach(), which every frame drives the parts that
// already exist from h = the camera's height above the ground at the target (the same h as the weather: scene.js weatherView) and uBend:
//   lampOf(h)   = 1 - smoothstep(40, 60, h)      the real lamps of the roads, their light pools: instances load within 60 m (W4); roads.js applies it
//   bandOf(h)   = smoothstep(40, 120, h)         the light band (lightband.js, W5) that stands for the lamps from far away; full from 120 m; crosses the lamps between 40 and 60 m
//   far lights  = bandOf(h)                      warm dots for the places that "can become the focus of the panorama" (WORLD_SPEC): the convenience store (the anchor of the
//                                                town), the onsen village LM02, the harbour LM10 and the lighthouse lamp LM08. They stand for windows, lanterns and the light post, which are
//                                                sub-pixel from far away; their cores are a little brighter than the band's core (one layer) and wider than it. The volcano's ember (LM01) and the
//                                                hidden clues keep their own very weak lights.
//   panoramaK(h, u) = (1 - w_local(h)) * smoothstep(0, 0.2, u)
//                 the share of the readable 'panorama' light (the W4 preset: sky light and moon x 1.5, cold, still night) that is blended in; 1 on the planet from h = 120 m.
//   starsOf(h, u) = smoothstep(0.5, 1, 1 - w_local(h)) * smoothstep(0, 0.2, u)     invisible while w_local > 0.5 (h < 80 m), full at the panorama (stars.js)
// The factor in uBend (smoothstep(0, 0.2, u)) is the one departure from "by w_local alone": the flat town (uBend = 0) must not change at all (WC12 / WC13), and the old views reach
// camera heights over 40 m (the 'far' and 'top' views reach 100 and 150 m). On the rolled-up planet (u >= 0.2) the blend is by w_local exactly as in the spec.
(function (global) {
'use strict';
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wLocal = h => 1 - sm(40, 120, h);
const D = Math.PI / 180, BAND_MAX = 0.75;
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = hex => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255].map(srgb);

// the far lights: [{ id, lon, lat, alt, w }]; positions are true metres (alt = metres above the sea) on the planet; local = in a landmark's frame (origin the anchor, +Z towards
// the first entrance, +X to the left of +Z: W7_SPEC section 2), the same mapping scene.js uses to place the landmark's own parts
function farLights(W, town) {
  const out = [], at = (id, lon, lat, w, lift = 3) => out.push({ id, lon, lat, alt: Math.max(0, W.height(lon, lat)) + lift, w });
  const local = (lm, x, z) => { const d = Math.hypot(x, z); if (d < 1e-9) return { lon: lm.lon, lat: lm.lat }; const head = lm.entrances[0] ? lm.entrances[0].heading : 0, q = W.destination({ lon: lm.lon, lat: lm.lat }, head + Math.atan2(-x, z) / D, d); return { lon: lm.lon + (((q.lon - lm.lon + 540) % 360) - 180), lat: q.lat }; };
  const lm = id => W.landmarks.find(q => q.id === id);
  { const p = W.townToLonLat(town.store[0], town.store[1]); at('store', p.lon, p.lat, 1.0, 3.2); }
  for (const [x, z] of [[0, 0], [8, 6], [-8, -5]]) { const p = local(lm('LM02'), x, z); at('LM02', p.lon, p.lat, x === 0 ? 1.0 : 0.9); }          // the village: square, inn and the onsen
  { const p = local(lm('LM10'), 31.2, 3.2); at('LM10', p.lon, p.lat, 1.0, 4.3); }                                                    // the red-and-white light post at the end of the breakwater
  { const p = local(lm('LM10'), 6.7, -1.2); at('LM10', p.lon, p.lat, 0.9); }                                                         // the warehouse door lamp
  at('LM08', lm('LM08').lon, lm('LM08').lat, 1.0, 11);                                                                              // the lamp room of the lighthouse (12 m tower on the island's anchor)
  return out;
}

const NL = {
  BAND_MAX, GAIN: 0.5, FAR_COLOR: '#ffcf8f', FAR_RADIUS: 4.0, FAR_GAIN: 1.5,
  smoothstep: sm, wLocal, farLights,
  bandOf: h => sm(40, 120, h),
  lampOf: h => 1 - sm(40, 60, h),
  panoramaK: (h, u) => (1 - wLocal(h)) * sm(0, 0.2, u),
  starsOf: (h, u) => sm(0.5, 1, 1 - wLocal(h)) * sm(0, 0.2, u),
  // ctx = { THREE, scene, camera, hemi, moon, getSetting, stars, town: { store: [x, z] } }; the light blend only runs under the default 'rainy' setting (tools that ask for 'panorama'
  // or 'neutral' keep them). It writes absolute values from the base, and once the exact base when the blend returns to 0, so the flat town is untouched.
  attach(ctx) {
    const lights = { hemi: ctx.hemi, moon: ctx.moon }, base = { hemi: ctx.hemi.intensity, moon: ctx.moon.intensity }, st = { lastK: 0, far: null, last: null };
    // built on first use (the planet only), inside the terrain's private random stream: three.js draws object ids from Math.random and the town's rain must keep its sequence (WC12)
    function buildFar() {
      const THREE = ctx.THREE, LB = global.LIGHTBAND, pts = farLights(global.WORLD, ctx.town);
      const make = () => { const m = LB.glowMesh(THREE, LB.discs(pts.map(p => ({ ...p, w: p.w * NL.FAR_GAIN })), NL.FAR_RADIUS, lin(NL.FAR_COLOR), 0), 'night:far'); ctx.scene.add(m); return m; };
      const mesh = global.TERRAIN && global.TERRAIN.withPrivateRandom ? (() => { let m; global.TERRAIN.withPrivateRandom(() => { m = make(); }); return m; })() : make();
      st.far = { mesh, points: pts };
    }
    return {
      base, state: st,
      // wv = { h, u } as the weather gets it; returns the values applied
      tick(wv) {
        // W8e-c (D9 revised): the sphere is a clear day, so the night panorama (readable light, stars, light band, far lights) is off whenever uBend > 0; on the flat map
        // (uBend = 0) everything is as before (the readable light and the stars are 0 there by their own uBend factor)
        const h = wv.h, u = wv.u || 0, night = u > 0 ? 0 : 1, band = NL.bandOf(h) * night, lamp = NL.lampOf(h);
        const k = ctx.getSetting() === 'rainy' ? NL.panoramaK(h, u) * night : 0;
        if (k > 0 || st.lastK > 0) { lights.hemi.intensity = base.hemi * (1 + NL.GAIN * k); lights.moon.intensity = base.moon * (1 + NL.GAIN * k); }
        st.lastK = k;
        const sky = NL.starsOf(h, u) * night; ctx.stars.tick(ctx.camera, sky);
        const R = global.ROADS_API, planet = !!(R && R.state.built && R.state.root.visible);
        if (planet) { R.setNight({ band, lamp }); if (!st.far) buildFar(); st.far.mesh.material.opacity = BAND_MAX * band; st.far.mesh.visible = band > 0.01; }
        else if (st.far) st.far.mesh.visible = false;
        return (st.last = { h, u, wLocal: wLocal(h), band, lamp, stars: sky, k });
      },
      k: () => st.lastK, get: () => st.last, far: () => st.far,
    };
  },
};
if (typeof module !== 'undefined' && module.exports) module.exports = NL;
else global.NIGHTLIGHT = NL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
