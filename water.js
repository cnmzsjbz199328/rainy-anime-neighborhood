// Water surfaces for the planet sections (W4): the rain-ripple shader shared by the paddies and the sea.
// Large areas of rain ripples are procedural rings on a hashed grid (BORROWING_NOTES: the per-puddle RingGeometry of the town does not scale);
// the look matches the town's puddle ripples, the implementation differs. The foam line breathes along the shore (aShore = water depth).
// The materials are built-in MeshBasicMaterial with an injected onBeforeCompile, so bend.js still bends them (its patch chains after ours).
(function (global) {
'use strict';

function make(THREE) {
  const uniforms = { uTime: { value: 0 }, uRain: { value: 1 } };
  // one ring per hashed cell with a random centre; the 3 x 3 neighbouring cells are summed so rings cross cell borders
  const RIPPLE2 = `
    float wh(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
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
  const compile = (foam, cell) => shader => {
    shader.uniforms.uTime = uniforms.uTime; shader.uniforms.uRain = uniforms.uRain;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aShore;\nvarying vec3 vWP;\nvarying float vShore;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;\nvShore = aShore;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nuniform float uRain;\nvarying vec3 vWP;\nvarying float vShore;\n${RIPPLE2}`)
      .replace('#include <opaque_fragment>', `
        float cph = 1.0 / cosh(vWP.z / 90.0);
        vec2 q = vec2(vWP.x, vWP.z) * cph;
        float rg = rippleRings(q, uTime, ${cell.toFixed(2)}, 0.55) * uRain;
        outgoingLight += vec3(0.50, 0.62, 0.78) * rg * 0.55;
        diffuseColor.a = max(diffuseColor.a, rg * 0.55);
        ${foam ? `float fz = 0.05 + 0.025 * sin(uTime * 0.9 + vWP.x * cph * 0.6);
        float fo = (1.0 - smoothstep(0.01, fz, vShore)) * (0.75 + 0.25 * sin(uTime * 1.3 + vWP.x * cph));
        outgoingLight = mix(outgoingLight, vec3(0.42, 0.52, 0.62), fo * 0.85);
        diffuseColor.a = max(diffuseColor.a, fo * 0.9);` : ''}
        #include <opaque_fragment>`);
  };
  // the two closures print the same text and bend.js keys programs by function text, so each material gets its own key
  const mk = (foam, cell) => { const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }); m.onBeforeCompile = compile(foam, cell); m.customProgramCacheKey = () => `bend|water|${foam}|${cell}`; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1; return m; };
  return { uniforms, sea: mk(true, 0.9), paddy: mk(false, 0.7) };
}

const WATER = { make };
if (typeof module !== 'undefined' && module.exports) module.exports = WATER;
else global.WATER = WATER;
})(typeof globalThis !== 'undefined' ? globalThis : this);
