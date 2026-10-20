// W9b (docs/world/SPHERE_RIDING_PLAN.md 4.1-4.4): the ride's display adapter. The ride keeps one state in the flat display frame (ride.js, ground.js, ride_world.js); this
// module only maps it to what is drawn at the bend u of bend.js (0 the flat map, 1 the sphere, between them the switch). Pure: no THREE, no DOM; B = BEND (point, basis).
//   point     D(p, u) = (1 - u) p + u P(p), the shader's own mapping (bend.js bendPosition). The ride's points are in the display frame [SEAM, SEAM + PERIOD) and are not
//             shifted at the seam (the rider's materials are noWrap): a bike across the seam stays in one piece, the sphere is periodic in x
//   frame     the rotation M(u) from the flat axes (x east, y up, z south) to the sphere's east / up / south at a point, slerped from the identity by u. A mix of the flat
//             and the sphere vectors (the free view's frame) falls to zero on the far side of the planet; the slerp never does. Its hemisphere (the shorter turn) is
//             picked when a switch starts and then kept from frame to frame while the switch runs, so the frame turns on continuously when the rider crosses the
//             antimeridian of the town or wraps at the seam during a switch
//   pose      a flat camera (focus, position, look) to the display: the focus by D; the position and the look as offsets from the focus in the rider's local frame,
//             scaled by the display scale there (scale below: (1 - u) + u sb (R + y sb) / R across, (1 - u) + u sb up) and turned by M(u); up = M(u) y. So the
//             follow rig of ride.js (true metres x s) is drawn at the rider's own scale on every map and through the switch -- 3.5 m behind is 3.5 m on the sphere
//             at any latitude. Mapped point by point instead, the rig would stretch with the change of the Mercator scale across it (up to -10 / +17 % at LM07,
//             s = 4) and lean with the flat frame's height convention at altitude (y = alt / cos lat); one rule for every road (W9b 4.1)
//   inverse   the flat point of a display point near a known one: closed form at u = 1, else Newton on D from the guess (the display sight line's samples back in the
//             ride's frame, where ride.js tests them against the occluders, the terrain and the tunnel lining)
//   kept      the share of its scale the bend keeps at a point (the display pass of scene.js stands down where a switch folds the place)
//   scale     display units per flat unit at (y, z): vertical (1 - u) + u sb, horizontal (1 - u) + u sb (R + y sb) / R, sb = 1 / cosh(z / R) (bend.js). The ride measures
//             in true metres x s (ground.js s, flat units per true metre), so a true metre is drawn s x scale long: 1 x (R + alt - 1.6) / R on the sphere outside the
//             town (s = 1 / sb there), sb in the town frame (s = 1) -- the rider, the road and the camera share it; nothing is scaled twice
//   surfaces  the drawn walk surfaces (their triangles, display frame) in an 8 m grid: under a wheel, how far below the bent contact point the drawn face lies
//             (a face is drawn as the chord of its bent corners: up to 2.2 cm under the sphere for the town's 4 m edges); the rider is lowered by it (scene.js)
(function (global) {
'use strict';
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// quaternions [x, y, z, w]
const qRot = (q, v) => { const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]; };
// the rotation whose columns are e, u, s (orthonormal, right-handed: e x u = s)
function qOfBasis(e, u, s) {
  const m00 = e[0], m01 = u[0], m02 = s[0], m10 = e[1], m11 = u[1], m12 = s[1], m20 = e[2], m21 = u[2], m22 = s[2], tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const k = 0.5 / Math.sqrt(tr + 1); q = [(m21 - m12) * k, (m02 - m20) * k, (m10 - m01) * k, 0.25 / k]; }
  else if (m00 > m11 && m00 > m22) { const k = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [0.25 * k, (m01 + m10) / k, (m02 + m20) / k, (m21 - m12) / k]; }
  else if (m11 > m22) { const k = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(m01 + m10) / k, 0.25 * k, (m12 + m21) / k, (m02 - m20) / k]; }
  else { const k = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(m02 + m20) / k, (m12 + m21) / k, 0.25 * k, (m10 - m01) / k]; }
  const l = Math.hypot(q[0], q[1], q[2], q[3]); return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
// the identity slerped toward q by u (q in the hemisphere chosen by the caller: w < 0 turns the long way)
function qPow(q, u) {
  const w = Math.max(-1, Math.min(1, q[3])), half = Math.acos(w), sn = Math.sin(half);
  if (sn < 1e-9) return w > 0 ? [0, 0, 0, 1] : [q[0], q[1], q[2], q[3]];
  const k = Math.sin(u * half) / sn; return [q[0] * k, q[1] * k, q[2] * k, Math.cos(u * half)];
}

function create(B) {
  const R = B.R, C = [0, -R, 0], TURN = 2 * Math.PI * R;          // the sphere's own period (bend.js PERIOD is its float32 copy)
  const sbOf = z => 1 / Math.cosh(Math.max(-8, Math.min(8, z / R)));
  const point = (p, u) => B.point(p[0], p[1], p[2], u);
  const st = { ref: null, flips: 0 };
  // the sphere frame at (x, z) as a quaternion, and M(u)
  function sphereQ(x, z) { const b = B.basis(x, z); return qOfBasis(b.east, b.up, b.south); }
  function frame(x, z, u) {
    if (!(u > 0)) { st.ref = null; return [0, 0, 0, 1]; }
    let q = sphereQ(x, z);
    if (u >= 1) { st.ref = null; return q; }
    if (!st.ref) { if (q[3] < 0) q = q.map(v => -v); }
    else if (q[0] * st.ref[0] + q[1] * st.ref[1] + q[2] * st.ref[2] + q[3] * st.ref[3] < 0) { q = q.map(v => -v); }
    st.ref = q; return qPow(q, u);
  }
  // a flat pose { focus, position, look } at u: { focus, position, look, up, q } in display coordinates (u = 0: the flat pose itself)
  function pose(fp, u) {
    const F = fp.focus;
    if (!(u > 0)) { st.ref = null; return { focus: F.slice(), position: fp.position.slice(), look: fp.look.slice(), up: [0, 1, 0], q: [0, 0, 0, 1] }; }
    const M = frame(F[0], F[2], u), Fd = point(F, u), sc = scale(F[1], F[2], u);
    const map = X => { const o0 = sub(X, F), r = qRot(M, [o0[0] * sc.h, o0[1] * sc.v, o0[2] * sc.h]); return [Fd[0] + r[0], Fd[1] + r[1], Fd[2] + r[2]]; };
    return { focus: Fd, position: map(fp.position), look: map(fp.look), up: qRot(M, [0, 1, 0]), q: M };
  }
  // the flat point w with D(w, u) = P, near the flat point g; null when Newton does not settle within 1 mm (where the bend folds the far side mid-switch)
  function inverse(P, u, g) {
    if (!(u > 0)) return P.slice();
    if (u >= 1) {
      const vx = P[0] - C[0], vy = P[1] - C[1], vz = P[2] - C[2], r = Math.hypot(vx, vy, vz), lam = Math.atan2(vx, vy), phi = Math.asin(Math.max(-1, Math.min(1, -vz / r)));
      let x = R * lam; x += TURN * Math.round((g[0] - x) / TURN);
      const z = -R * Math.asinh(Math.tan(phi)), sb = Math.cos(phi); return [x, (r - R) / sb, z];
    }
    let w = g.slice();
    for (let it = 0; it < 8; it++) {
      const d = point(w, u), e = sub(d, P); if (Math.hypot(e[0], e[1], e[2]) < 1e-6) return w;
      const h = 1e-3, J = [0, 1, 2].map(k => { const v = w.slice(); v[k] += h; const q = point(v, u); return [(q[0] - d[0]) / h, (q[1] - d[1]) / h, (q[2] - d[2]) / h]; });   // columns
      const c0 = J[0], c1 = J[1], c2 = J[2], det = dot(c0, cross(c1, c2)); if (Math.abs(det) < 1e-9) return null;
      const r0 = cross(c1, c2), r1 = cross(c2, c0), r2 = cross(c0, c1);
      w = [w[0] - dot(r0, e) / det, w[1] - dot(r1, e) / det, w[2] - dot(r2, e) / det];
    }
    const e = sub(point(w, u), P); return Math.hypot(e[0], e[1], e[2]) < 1e-3 ? w : null;
  }
  const scale = (y, z, u) => { const sb = sbOf(z), v = 1 - u + u * sb; return { v, h: 1 - u + u * sb * (R + y * sb) / R, sb }; };
  // how much of its scale the bend keeps at a flat point: sqrt(det J / (v h^2)), J = dD / dp (numeric). 1 for a turned and scaled copy of the place; toward 0 where the
  // switch draws the place as a sheet (the far side of the planet mid-switch: (1 - u) I + u Q collapses when Q turns by about 180 deg)
  function kept(p, u) {
    if (!(u > 0) || u >= 1) return 1;
    const d = point(p, u), h = 1e-3 * Math.max(1, Math.abs(p[1]) * 1e-3), J = [0, 1, 2].map(k => { const v = p.slice(); v[k] += h; const q = point(v, u); return [(q[0] - d[0]) / h, (q[1] - d[1]) / h, (q[2] - d[2]) / h]; });
    const det = dot(J[0], cross(J[1], J[2])), sc = scale(p[1], p[2], u); return Math.sqrt(Math.max(0, det) / (sc.v * sc.h * sc.h));
  }
  // the local up of the display at a flat point (the bent normal of a level face: bend.js bendNormal of (0, 1, 0))
  const upAt = (x, z, u) => { const b = B.basis(x, z), v = [b.up[0] * u, (1 - u) + b.up[1] * u, b.up[2] * u], l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

  // ---- the drawn walk surfaces: list = [{ pos (Float32Array, x y z per vertex, display frame), index (or null) }]
  function surfaces(list) {
    const CELL = 8, grid = new Map(), meshes = [];
    let tris = 0;
    const key = (i, j) => i * 100003 + j;
    list.forEach((m, mi) => {
      const P = m.pos, I = m.index, n = I ? I.length : P.length / 3; meshes.push(m);
      for (let t = 0; t + 3 <= n; t += 3) {
        const a = I ? I[t] : t, b = I ? I[t + 1] : t + 1, c = I ? I[t + 2] : t + 2;
        const x0 = Math.min(P[a * 3], P[b * 3], P[c * 3]), x1 = Math.max(P[a * 3], P[b * 3], P[c * 3]), z0 = Math.min(P[a * 3 + 2], P[b * 3 + 2], P[c * 3 + 2]), z1 = Math.max(P[a * 3 + 2], P[b * 3 + 2], P[c * 3 + 2]);
        if (x1 - x0 > 64 || z1 - z0 > 64) continue;
        for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) { const k = key(i, j); let c2 = grid.get(k); if (!c2) grid.set(k, c2 = []); c2.push(mi, t); }
        tris++;
      }
    });
    const vtx = (m, i) => [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]];
    // how far the drawn surface lies under the bent point of its own flat height at (x, z) along the display up (display units, + when it is lower; 0 on the flat map),
    // and that flat height: of the faces within tol of y (two road meshes meet at a junction, each its own triangles), the one drawn highest, which is the one seen
    function sag(x, y, z, u, tol) {
      const c0 = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))); if (!c0) return null;
      const up = u > 0 ? upAt(x, z, u) : null; let best = null;
      for (let k = 0; k < c0.length; k += 2) {
        const m = meshes[c0[k]], t = c0[k + 1], I = m.index, A0 = vtx(m, I ? I[t] : t), B0 = vtx(m, I ? I[t + 1] : t + 1), C0 = vtx(m, I ? I[t + 2] : t + 2);
        const d = (B0[2] - C0[2]) * (A0[0] - C0[0]) + (C0[0] - B0[0]) * (A0[2] - C0[2]); if (Math.abs(d) < 1e-12) continue;
        const l1 = ((B0[2] - C0[2]) * (x - C0[0]) + (C0[0] - B0[0]) * (z - C0[2])) / d, l2 = ((C0[2] - A0[2]) * (x - C0[0]) + (A0[0] - C0[0]) * (z - C0[2])) / d, l3 = 1 - l1 - l2;
        if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue;
        const fy = l1 * A0[1] + l2 * B0[1] + l3 * C0[1]; if (Math.abs(fy - y) > tol) continue;
        let sg = 0;
        if (up) { const A = point(A0, u), Bp = point(B0, u), Cp = point(C0, u), p = point([x, fy, z], u); let n = cross(sub(Bp, A), sub(Cp, A)); const l = Math.hypot(n[0], n[1], n[2]); if (l < 1e-12) continue; n = [n[0] / l, n[1] / l, n[2] / l]; if (dot(n, up) < 0) n = [-n[0], -n[1], -n[2]];
          const c = dot(n, up); if (c < 0.2) continue; sg = dot(sub(p, A), n) / c; }
        const h = fy - sg / (up ? scale(fy, z, u).v : 1);             // the drawn height of the face in flat units
        if (!best || h > best.h) best = { h, sag: sg, y: fy };
      }
      return best ? { sag: best.sag, y: best.y } : null;
    }
    return { sag, stats: { meshes: meshes.length, triangles: tris, cells: grid.size } };
  }
  return { point, frame, pose, inverse, scale, kept, upAt, sphereQ, surfaces, state: st, qRot, qPow };
}
const RIDE_VIEW = { create, qOfBasis, qPow, qRot };
if (typeof module !== 'undefined' && module.exports) module.exports = RIDE_VIEW;
else global.RIDE_VIEW = RIDE_VIEW;
})(typeof globalThis !== 'undefined' ? globalThis : this);
