// Stars (W8c, W8_SPEC 5.2): a sky sphere of points that follows the camera, only on the clear panorama (NIGHTLIGHT.starsOf). The points come from a hash of a
// fixed grid on the sphere (one candidate per cell, kept when the hash is above a threshold, jittered inside its cell, brightness from a second hash): the idea of the
// usual "hash a grid in the shader" star field, done once on the CPU. They are not bent (userData.noBend) and ignore the fog.
(function (global) {
'use strict';
const hash = (i, j, s) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
function attach(THREE, scene) {
  // built on first use, inside the terrain's private random stream: three.js draws object ids from Math.random, and the town's rain must keep its sequence (WC12)
  let o = null, m = null, count = 0;
  function build() {
    const pos = [], col = [], NLAT = 90, NLON = 180, RAD = 560;          // beyond the far side of the planet's visible disc (camera far plane 600 m on the planet)
    for (let j = 0; j < NLAT; j++) for (let i = 0; i < NLON; i++) {
      if (hash(i, j, 11) < 0.90) continue;                                   // about 10 % of the 16200 cells hold a star
      const lat = -Math.PI / 2 + (j + hash(i, j, 12)) * Math.PI / NLAT, lon = (i + hash(i, j, 13)) * 2 * Math.PI / NLON, c = Math.cos(lat);
      pos.push(RAD * c * Math.cos(lon), RAD * Math.sin(lat), RAD * c * Math.sin(lon));
      const b = 0.35 + 0.65 * Math.pow(hash(i, j, 14), 3), tint = hash(i, j, 15); col.push(b * (0.85 + 0.1 * tint), b * 0.92, b);   // mostly white, a little blue
    }
    const make = () => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      m = new THREE.PointsMaterial({ size: 2.0, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
      m.userData = { noBend: true };
      o = new THREE.Points(g, m); o.name = 'stars'; o.frustumCulled = false; o.visible = false; o.renderOrder = -1; scene.add(o);
    };
    if (global.TERRAIN && global.TERRAIN.withPrivateRandom) global.TERRAIN.withPrivateRandom(make); else make();
    count = pos.length / 3; api.object = o; api.count = count;
  }
  const api = {
    object: { visible: false, material: { opacity: 0 } }, count: 0,
    tick(camera, v) { if (!o) { if (!(v > 0.002)) return; build(); } o.visible = v > 0.002; if (!o.visible) return; m.opacity = v; o.position.copy(camera.position); },
  };
  return api;
}
global.STARS = { attach };
})(typeof globalThis !== 'undefined' ? globalThis : this);
