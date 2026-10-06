// Night light band (W5, RD01/RD02 cards): the lit road routes seen from far away. A planet has only a few dozen street lamps, 9 degrees of arc
// apart at worst, so at panorama distance the lamps are not loaded; a soft amber ribbon along each lit route stands for them, and a paler
// reflection ribbon on the sea surface under the bridges. Both are single additive meshes (2 draw calls for the whole planet). The fade with the
// camera distance is set by setLightBand({ distance }) (W8 connects it to the camera; roads.js feeds it the section's ink distance for now).
// The geometry is stored in flat Mercator coordinates like everything else of the planet (positions carry the 1/cos(lat) factor).
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, BASE = 1.6;
const srgb = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lin = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255].map(srgb);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Ribbon data for polylines of {lon, lat, alt}: cols = [[offset (true m), alpha], ...]. Returns merged position / colour(rgba) / index arrays.
function ribbon(polys, cols, lift, colour) {
  const pos = [], col = [], idx = []; let base = 0;
  for (const pts of polys) {
    const n = pts.length; if (n < 2) continue;
    const F = pts.map(p => ({ x: R * p.lon * D, z: -R * Math.asinh(Math.tan(p.lat * D)), k: 1 / Math.cos(p.lat * D) }));
    for (let i = 0; i < n; i++) {
      const a = F[Math.max(0, i - 1)], b = F[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      for (const [o, al] of cols) { pos.push(F[i].x + (-tz) * o * F[i].k, (pts[i].alt + lift - BASE) * F[i].k, F[i].z + tx * o * F[i].k); col.push(colour[0], colour[1], colour[2], al); }
    }
    const m = cols.length;
    for (let i = 0; i + 1 < n; i++) for (let j = 0; j + 1 < m; j++) { const a = base + i * m + j, b = a + 1, c = a + m, d = c + 1; idx.push(a, c, b, b, c, d); }
    base += n * m;
  }
  // winding: every triangle faces up (+y) in the flat frame
  for (let t = 0; t < idx.length; t += 3) { const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3; const ny = (pos[B + 2] - pos[A + 2]) * (pos[C] - pos[A]) - (pos[B] - pos[A]) * (pos[C + 2] - pos[A + 2]); if (ny < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; } }
  return { pos: Float32Array.from(pos), col: Float32Array.from(col), index: Uint32Array.from(idx) };
}

const CORE = [[-3.4, 0], [-1.3, 0.55], [0, 1], [1.3, 0.55], [3.4, 0]];
const SEA = [[-5.0, 0], [-1.8, 0.3], [0, 0.5], [1.8, 0.3], [5.0, 0]];
const AMBER = lin('#ffae5c'), SEACOL = lin('#ffc890');

function make(THREE, root) {
  const st = { built: false, distance: 0, opacity: 0, max: 0.75, meshes: [], stats: {} };
  const mat = () => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -12, side: THREE.DoubleSide });
  const mesh = (d, name) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(d.col, 4));
    const nrm = new Float32Array(d.pos.length); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setIndex(new THREE.BufferAttribute(d.index, 1)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat()); m.name = name; m.matrixAutoUpdate = false; m.renderOrder = 6; m.visible = false; root.add(m); st.meshes.push(m); return m;
  };
  // polys: lit road polylines; sea: the same routes' bridge parts (reflections on the sea surface at altitude 0.03)
  st.build = (polys, sea) => {
    st.core = mesh(ribbon(polys, CORE, 0.2, AMBER), 'lightband:core');
    st.sea = sea.length ? mesh(ribbon(sea, SEA, 0, SEACOL), 'lightband:sea') : null;
    st.stats = { polylines: polys.length, seaPolylines: sea.length, triangles: st.meshes.reduce((s, m) => s + m.geometry.index.count / 3, 0), drawCalls: st.meshes.length };
    st.built = true;
  };
  // distance = the camera's altitude above the surface (m): invisible on the ground (the real lamps are there), fully on from the panorama distance
  st.set = (v = {}) => {
    if (v.distance !== undefined) st.distance = v.distance;
    if (v.max !== undefined) st.max = v.max;
    st.opacity = v.opacity !== undefined ? v.opacity : st.max * smooth(45, 150, st.distance);
    for (const m of st.meshes) { m.material.opacity = m.name.endsWith('sea') ? st.opacity * 0.9 : st.opacity; m.visible = st.opacity > 0.01; }
    return { distance: st.distance, opacity: st.opacity };
  };
  // slow breathing of the band at panorama distance (period 7 s, +-8 %), the one motion of the band
  st.breathe = t => { if (!st.meshes.length || st.opacity <= 0.01) return; const k = 1 + 0.08 * Math.sin(2 * Math.PI * t / 7); st.meshes.forEach(m => { m.material.opacity = Math.min(1, (m.name.endsWith('sea') ? st.opacity * 0.9 : st.opacity) * k); }); };
  return st;
}

const LIGHTBAND = { ribbon, make, CORE, SEA };
if (typeof module !== 'undefined' && module.exports) module.exports = LIGHTBAND;
else global.LIGHTBAND = LIGHTBAND;
})(typeof globalThis !== 'undefined' ? globalThis : this);
