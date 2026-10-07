// Town-to-planet transition (W8a, ST04): pure functions, no THREE, no DOM. scene.js drives `uBend` from the camera distance d (the distance from the camera to its target, metres);
// d <= 150 (the old zoom limit) is always uBend = 0, so every existing view stays pixel for pixel the same. The numbers come from W8_SPEC 3.1:
//   uBend(d) = smoothstep(150, 300, d)        the town rolls up between 150 and 300 m (a sphere of radius 90 fills a 36 degree view at about 277 m)
//   terrain(d) = smoothstep(60, 150, d)       the land around the town fades in out of the fog while the town is still flat
//   caps(u) = smoothstep(0.98, 1, u)          the two ice caps (beyond 85 degrees) fade in last
//   fog(u) = 1 - u                            the fog gives way to the curvature (the multiplier of the base density)
// frame() is the camera rig: target and camera follow the local up of the sphere under the target. With u = 0 it returns exactly the old expressions; with u > 0 the offset
// (east, up, south) is taken in a basis that is the sphere's local frame blended with the identity by u and re-orthonormalised, so the horizon never tilts.
(function (global) {
'use strict';
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const TR = {
  ZOOM: [9, 400], FAR_NEAR: 400, FAR_FAR: 600, BEND: [150, 300], TERRAIN: [60, 150], CAPS: 0.98,
  smoothstep: sm,
  bendOf: d => sm(150, 300, d),
  terrainOf: d => sm(60, 150, d),
  capsOf: u => sm(0.98, 1, u),
  fogOf: u => 1 - u,
  // camera far plane: the old 400 m while the view is the old one, 600 m for the planet (the far side of the sphere is behind the horizon, the target is up to 400 m away)
  farOf: (d, u) => (u > 0 || d > 150 ? 600 : 400),
  // B = BEND (point, basis); target = [x, y, z] in the flat town frame; returns { position, lookAt, up }
  frame(B, target, dist, yaw, pitch, u) {
    const dx = dist * Math.sin(yaw) * Math.cos(pitch), dy = dist * Math.sin(pitch), dz = dist * Math.cos(yaw) * Math.cos(pitch);
    if (!(u > 0)) return { position: [target[0] + dx, target[1] + dy, target[2] + dz], lookAt: [target[0], target[1], target[2]], up: [0, 1, 0] };
    const P = B.point(target[0], target[1], target[2], u), b = B.basis(target[0], target[2]);
    const upn = norm(mix([0, 1, 0], b.up, u)), e0 = mix([1, 0, 0], b.east, u), k = dot(e0, upn), en = norm([e0[0] - k * upn[0], e0[1] - k * upn[1], e0[2] - k * upn[2]]), sn = cross(en, upn);
    return { position: [P[0] + en[0] * dx + upn[0] * dy + sn[0] * dz, P[1] + en[1] * dx + upn[1] * dy + sn[1] * dz, P[2] + en[2] * dx + upn[2] * dy + sn[2] * dz], lookAt: P, up: upn };
  },
};
if (typeof module !== 'undefined' && module.exports) module.exports = TR;
else global.TRANSITION = TR;
})(typeof globalThis !== 'undefined' ? globalThis : this);
