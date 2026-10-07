// W8e-a: mode animation is independent of zoom; camera frames remain shared.
(function (global) {
'use strict';
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const TR = {
  ZOOM: [9, 400], FAR_NEAR: 400, FAR_FAR: 600, DURATION: 2, TERRAIN: [60, 150], CAPS: 0.98,
  smoothstep: sm,
  bendOf: phase => sm(0, 1, phase),
  patchDistance: (x, z, half) => Math.hypot(Math.max(0, Math.abs(x)-half), Math.max(0, Math.abs(z)-half)),
  visibilityOf: (d, away) => Math.max(sm(60, 150, d), sm(0, 24, away)),
  terrainOf: d => sm(60, 150, d),
  capsOf: u => sm(0.98, 1, u),
  fogOf: u => 1 - u,
  // camera far plane: the old 400 m while the view is the old one, 600 m for the planet (the far side of the sphere is behind the horizon, the target is up to 400 m away)
  farOf: mode => mode === 'sphere' ? 600 : 400,
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
