// R2 rider helpers. Ported from riba2534/claude-opus-5-5-demo, pelican-bike/src/util.js at commit 54adc1fb64155f9dd7c1c90ecae7b8185ac540b8
// (https://github.com/riba2534/claude-opus-5-5-demo/tree/54adc1fb64155f9dd7c1c90ecae7b8185ac540b8/pelican-bike), used with the user's permission (README).
// Changes for this project: a plain global script over the embedded Three.js 0.160.1 (no ESM import); clamp/lerp/smoothstep/damp, loft, DynamicTube, solveTwoBone and
// placeBetween kept as upstream; unitCylinder/cylBetween return geometry only (shadows dropped: the project has none); paint/normalizeForMerge replaced by geom(), which
// gives a part its vertex colour, and merge(), a local stand-in for three/addons mergeGeometries (non-indexed position, normal, uv, colour); new: Rig, which writes several
// rigid parts, each with its own matrix per frame, into one buffer (one draw call for the legs and wings).
(function (global) {
'use strict';
const T = () => global.THREE;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// frame-rate independent exponential damping
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const v3 = (x, y, z) => new (T().Vector3)(x, y, z);

// a cylinder along +Y of length 1, its foot at the origin (with placeBetween: a movable bone)
function unitCylinder(r0, r1, radial = 8) { const g = new (T().CylinderGeometry)(r1, r0, 1, radial, 1, false); g.translate(0, 0.5, 0); return g; }
const _v = () => (global.__riderV || (global.__riderV = new (T().Vector3)()));
function placeBetween(obj, a, b) {
  const v = _v().subVectors(b, a), len = v.length();
  obj.position.copy(a);
  if (len > 1e-6) obj.quaternion.setFromUnitVectors(v3(0, 1, 0), v.multiplyScalar(1 / len));
  obj.scale.set(1, Math.max(len, 1e-4), 1);
}
// a cylinder from a to b, as geometry
function cylBetween(a, b, r0, r1, radial = 8) {
  const g = unitCylinder(r0, r1, radial), o = new (T().Object3D)(); placeBetween(o, a, b); o.updateMatrix(); g.applyMatrix4(o.matrix); return g;
}

// lofted geometry: the section section(t, a) -> [y, z] swept along the centre line center(t); (y, z) = (cos th h, sin th w), th = 2 pi a
function loft({ segs = 24, ring = 12, center, section, color }) {
  const THREE = T(), pos = [], uv = [], col = [], idx = [], c = new THREE.Color();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = center(t);
    for (let j = 0; j <= ring; j++) { const a = j / ring, [y, z] = section(t, a); pos.push(p.x, p.y + y, p.z + z); uv.push(t, a); if (color) { color(t, a, c); col.push(c.r, c.g, c.b); } }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < ring; j++) { const a = i * (ring + 1) + j, b = a + ring + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

// a tube of varying radius rebuilt every frame (the pelican's neck), parallel transport frames so it never twists
class DynamicTube {
  constructor(tub, rad, radiusFn, color) {
    const THREE = T(); this.tub = tub; this.rad = rad; this.radiusFn = radiusFn;
    const n = (tub + 1) * (rad + 1); this.pos = new Float32Array(n * 3); this.nor = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2), col = new Float32Array(n * 3), idx = [], cc = new THREE.Color(color || '#ffffff');
    for (let i = 0; i <= tub; i++) for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; uv[k * 2] = i / tub; uv[k * 2 + 1] = j / rad; col.set([cc.r, cc.g, cc.b], k * 3); }
    for (let i = 0; i < tub; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(), pa = new THREE.BufferAttribute(this.pos, 3), na = new THREE.BufferAttribute(this.nor, 3);
    pa.setUsage(THREE.DynamicDrawUsage); na.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', pa); g.setAttribute('normal', na); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    this.geometry = g; this.curve = new THREE.CatmullRomCurve3([v3(0, 0, 0), v3(0, 1, 0)], false, 'centripetal');
    this._P = []; this._T = []; for (let i = 0; i <= tub; i++) { this._P.push(new THREE.Vector3()); this._T.push(new THREE.Vector3()); }
    this._N = new THREE.Vector3(); this._B = new THREE.Vector3(); this._d = new THREE.Vector3();
  }
  update(points) {
    const { tub, rad, pos, nor, _P, _T, _N, _B, _d } = this;
    this.curve.points = points;
    for (let i = 0; i <= tub; i++) this.curve.getPoint(i / tub, _P[i]);
    for (let i = 0; i <= tub; i++) _T[i].subVectors(_P[Math.min(tub, i + 1)], _P[Math.max(0, i - 1)]).normalize();
    const T0 = _T[0]; _N.set(0, 0, 1); if (Math.abs(T0.dot(_N)) > 0.9) _N.set(1, 0, 0); _N.addScaledVector(T0, -T0.dot(_N)).normalize();
    for (let i = 0; i <= tub; i++) {
      const Ti = _T[i]; if (i > 0) _N.addScaledVector(Ti, -Ti.dot(_N)).normalize(); _B.crossVectors(Ti, _N);
      const r = this.radiusFn(i / tub), P = _P[i];
      for (let j = 0; j <= rad; j++) { const th = (j / rad) * TAU, c = Math.cos(th), s = Math.sin(th), k = (i * (rad + 1) + j) * 3;
        _d.set(_N.x * c + _B.x * s, _N.y * c + _B.y * s, _N.z * c + _B.z * s); pos[k] = P.x + _d.x * r; pos[k + 1] = P.y + _d.y * r; pos[k + 2] = P.z + _d.z * r; nor[k] = _d.x; nor[k + 1] = _d.y; nor[k + 2] = _d.z; }
    }
    this.geometry.attributes.position.needsUpdate = true; this.geometry.attributes.normal.needsUpdate = true;
  }
}

// two-bone IK: hip -> knee -> ankle, the pole sets the bend; returns whether the target is in reach
let _dir, _bend;
function solveTwoBone(A, Tg, a, b, pole, outMid, outEnd) {
  if (!_dir) { _dir = new (T().Vector3)(); _bend = new (T().Vector3)(); }
  _dir.subVectors(Tg, A); let d = _dir.length(); const reach = a + b, ok = d <= reach * 0.999;
  d = clamp(d, Math.abs(a - b) + 1e-4, reach * 0.999); _dir.normalize();
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  _bend.copy(pole).addScaledVector(_dir, -pole.dot(_dir)); if (_bend.lengthSq() < 1e-8) _bend.set(1, 0, 0); _bend.normalize();
  outMid.copy(A).addScaledVector(_dir, a * cosA).addScaledVector(_bend, a * sinA); outEnd.copy(A).addScaledVector(_dir, d);
  return ok;
}

// a part: non-indexed geometry with one vertex colour (unless it has its own colours), uv kept (the paper grain), optional matrix
function geom(g, color, matrix) {
  const THREE = T(); let q = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) q.deleteAttribute(k);
  if (!q.attributes.normal) q.computeVertexNormals();
  if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
  if (!q.attributes.color || color) { const c = new THREE.Color(color || '#ffffff'), n = q.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); q.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
  if (matrix) q.applyMatrix4(matrix);
  q.morphAttributes = {}; return q;
}
// concatenate parts made by geom()
function merge(parts) {
  const THREE = T(), names = ['position', 'normal', 'uv', 'color'], size = { position: 3, normal: 3, uv: 2, color: 3 }, n = parts.reduce((a, p) => a + p.attributes.position.count, 0), out = new THREE.BufferGeometry();
  for (const k of names) { const arr = new Float32Array(n * size[k]); let o = 0; for (const p of parts) { arr.set(p.attributes[k].array, o); o += p.attributes[k].array.length; } out.setAttribute(k, new THREE.BufferAttribute(arr, size[k])); }
  return out;
}
// several rigid parts in one buffer, each placed by its own matrix every frame (CPU, a few thousand vertices): rig.set(i, matrix); rig.commit()
class Rig {
  constructor(parts) {
    const THREE = T(); this.parts = parts; this.base = parts.map(p => ({ pos: p.attributes.position.array.slice(), nor: p.attributes.normal.array.slice() }));
    this.geometry = merge(parts); this.offs = []; let o = 0; for (const p of parts) { this.offs.push(o); o += p.attributes.position.array.length; }
    this.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage); this.geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage); this._n = new THREE.Matrix3();
  }
  set(i, m) {
    const e = m.elements, P = this.geometry.attributes.position.array, N = this.geometry.attributes.normal.array, b = this.base[i], o = this.offs[i], ne = this._n.getNormalMatrix(m).elements;
    for (let k = 0; k < b.pos.length; k += 3) { const x = b.pos[k], y = b.pos[k + 1], z = b.pos[k + 2]; P[o + k] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[o + k + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[o + k + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const a = b.nor[k], c = b.nor[k + 1], d = b.nor[k + 2], nx = ne[0] * a + ne[3] * c + ne[6] * d, ny = ne[1] * a + ne[4] * c + ne[7] * d, nz = ne[2] * a + ne[5] * c + ne[8] * d, l = Math.hypot(nx, ny, nz) || 1; N[o + k] = nx / l; N[o + k + 1] = ny / l; N[o + k + 2] = nz / l; }
  }
  commit() { this.geometry.attributes.position.needsUpdate = true; this.geometry.attributes.normal.needsUpdate = true; this.geometry.computeBoundingSphere(); }
}

const RIDER_UTIL = { TAU, clamp, lerp, smoothstep, damp, v3, unitCylinder, placeBetween, cylBetween, loft, DynamicTube, solveTwoBone, geom, merge, Rig };
if (typeof module !== 'undefined' && module.exports) module.exports = RIDER_UTIL;
else global.RIDER_UTIL = RIDER_UTIL;
})(typeof globalThis !== 'undefined' ? globalThis : this);
