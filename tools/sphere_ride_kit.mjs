// W9b (docs/world/SPHERE_RIDING_PLAN.md 6): the in-page kit of tools/sphere_ride_check.mjs, installed once per page with page.evaluate(kit): window.__SR.
//   bent      a drawn mesh as the shader draws it at the bend u, on the CPU: its world matrix, the seam shift unless its material is noWrap, bend.js point(); cached per
//             mesh and u (non-instanced meshes, as ride_check K5 and unify_check U7 read them)
//   sight     the drawn sight line from the drawn focus to the drawn camera against the bent opaque meshes near it (the rider aside): the first hit or null
//   down      the drawn surface under a drawn point along the local up (bent walk meshes or every opaque mesh)
//   wheels    the drawn bottoms of the two tyres (the lowest bent vertex of each wheel mesh along the local up at its hub) and their gaps to the drawn walk surface
//   foot      the drawn sole of the left foot when the rider stands (rider.js) and its gap to the drawn ground
//   path      a line of ground.js as a path (its lane offset), and a pure pursuit that gives the input for a frame from the ride's state (the same state, the same input)
export function kit() {
  const S = window.__scene, T = window.THREE, B = S.bend, G = S.ground, RV = S.ride.view(), PER = G.PERIOD;
  const wdx = d => d - PER * Math.round(d / PER), wpi = a => Math.atan2(Math.sin(a), Math.cos(a));
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  S.scene.updateMatrixWorld(true);
  const isRider = o => { for (let p = o; p; p = p.parent) if (/^ride:/.test(p.name || '')) return true; return false; };
  const opaque = m => (Array.isArray(m) ? m : [m]).every(q => q && !q.transparent && q.blending !== T.AdditiveBlending);
  const sightMeshes = [], walkMeshes = [];
  S.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.attributes.position && !isRider(o) && opaque(o.material)) sightMeshes.push(o); });
  S.roads.state.root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && (/^road:(route |junction paving)/.test(o.name) || /^road:bridge .* top$/.test(o.name) || o.name === 'road:plank')) walkMeshes.push(o); });
  S.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.userData.groundOccupancy && !walkMeshes.includes(o)) { let lm = false; for (let q = o; q; q = q.parent) if (/^lm\d/i.test(q.name || '')) lm = true; if (!lm) walkMeshes.push(o); } });
  const visible = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const noWrap = o => (Array.isArray(o.material) ? o.material : [o.material]).some(m => m && m.userData && m.userData.noWrap);
  // the flat (display frame) bounding sphere of a mesh
  const sph = o => { if (!o.userData.__sr) { const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const c = g.boundingSphere.center.clone().applyMatrix4(o.matrixWorld), r = g.boundingSphere.radius * Math.max(o.matrixWorld.getMaxScaleOnAxis(), 1), w = !noWrap(o);
    o.userData.__sr = { c: [w ? B.wrapX(c.x) : c.x, c.y, c.z], r, wrap: w }; } return o.userData.__sr; };
  const cache = new Map(); let bentVerts = 0;
  function bent(o, u) {
    const k = o.uuid + '|' + u; let m = cache.get(k); if (m) return m;
    const g = o.geometry, p = g.attributes.position, n = p.count, arr = new Float32Array(n * 3), e = o.matrixWorld.elements, w = sph(o).wrap;
    for (let i = 0; i < n; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); let wx = e[0] * x + e[4] * y + e[8] * z + e[12]; const wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      if (w) wx += B.shift(wx); const q = B.point(wx, wy, wz, u); arr[i * 3] = q[0]; arr[i * 3 + 1] = q[1]; arr[i * 3 + 2] = q[2]; }
    bentVerts += n;
    const bg = new T.BufferGeometry(); bg.setAttribute('position', new T.BufferAttribute(arr, 3)); if (g.index) bg.setIndex(g.index); for (const gr of g.groups) bg.addGroup(gr.start, gr.count, gr.materialIndex); bg.setDrawRange(g.drawRange.start, g.drawRange.count); bg.computeBoundingSphere();
    m = new T.Mesh(bg, o.material); m.name = o.name; m.userData.src = o; m.matrixAutoUpdate = false; m.updateMatrixWorld(true); cache.set(k, m); return m;
  }
  const nearMeshes = (set, pts, r) => set.filter(o => { const q = sph(o); return pts.some(p => Math.hypot(wdx(q.c[0] - p[0]), q.c[1] - p[1], q.c[2] - p[2]) < q.r + r); }).filter(visible);
  const ray = new T.Raycaster(), vA = new T.Vector3(), vD = new T.Vector3();
  const cast = (list, A, Bp, nearD) => { vD.set(Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]); const len = vD.length(); if (len < 1e-6) return []; vA.set(A[0], A[1], A[2]); ray.set(vA, vD.normalize()); ray.near = nearD || 0; ray.far = len; return ray.intersectObjects(list, false); };
  const topName = o => { let t = o.userData.src || o; while (t.parent && t.parent !== S.scene) t = t.parent; return (o.name || '') + (t.name && t.name !== o.name ? ' < ' + t.name : ''); };
  // the drawn sight line: the drawn focus Fd -> the drawn camera Cd (their flat points F, C pick the meshes)
  function sight(u, F, C, Fd, Cd, s) { const L = Math.hypot(C[0] - F[0], C[1] - F[1], C[2] - F[2]), n = Math.max(1, Math.ceil(L / s)), pts = []; for (let i = 0; i <= n; i++) pts.push([F[0] + (C[0] - F[0]) * i / n, F[1] + (C[1] - F[1]) * i / n, F[2] + (C[2] - F[2]) * i / n]);
    const list = nearMeshes(sightMeshes, pts, 1.0 * s).map(o => bent(o, u)), h = cast(list, Fd, Cd, 0.05 * s); return h.length ? { d: h[0].distance, name: topName(h[0].object), len: Math.hypot(...sub(Cd, Fd)) } : null; }
  // the drawn surface under the drawn point Pd (flat point P) along -up, from `above` over it, within `far`
  function down(u, P, Pd, up, above, far, walk) { const list = nearMeshes(walk ? walkMeshes : sightMeshes, [P], 1.0).map(o => bent(o, u)), A = [Pd[0] + up[0] * above, Pd[1] + up[1] * above, Pd[2] + up[2] * above], Z = [A[0] - up[0] * far, A[1] - up[1] * far, A[2] - up[2] * far], h = cast(list, A, Z, 0);
    return h.length ? { p: h[0].point.toArray(), d: h[0].distance - above, name: topName(h[0].object) } : null; }
  // the tyres as drawn: per wheel mesh the lowest bent vertex along the up at its hub, the drawn walk surface under it
  const riderApi = S.ride.riderApi(), wheelMesh = {};
  riderApi.root.traverse(o => { if (o.isMesh && /^ride:bike (front|rear) wheel$/.test(o.name)) wheelMesh[/front/.test(o.name) ? 'F' : 'R'] = o; });
  function wheels(u) {
    riderApi.root.updateMatrixWorld(true); const g = S.ride.get(), s = g.s, out = {};
    for (const k of ['F', 'R']) {
      const m = wheelMesh[k], p = m.geometry.attributes.position, e = m.matrixWorld.elements, hub = [e[12], e[13], e[14]], up = RV.upAt(hub[0], hub[2], u), sc = RV.scale(hub[1], hub[2], u);
      let best = null, bf = null;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), wx = e[0] * x + e[4] * y + e[8] * z + e[12], wy = e[1] * x + e[5] * y + e[9] * z + e[13], wz = e[2] * x + e[6] * y + e[10] * z + e[14], q = B.point(wx, wy, wz, u), h = dot(q, up);
        if (best === null || h < best.h) { best = { h, q }; bf = [wx, wy, wz]; } }
      const hit = down(u, bf, best.q, up, 0.5 * s * sc.v, 1.5 * s * sc.v, true);
      out[k] = { bottom: best.q, flat: bf, up, hub: B.point(hub[0], hub[1], hub[2], u), gap: hit ? dot(sub(best.q, hit.p), up) / (s * sc.v) : null, under: hit ? hit.name : null };
    }
    return out;
  }
  function foot(u) {
    const r = riderApi.get(); if (!r.footDown) return null; riderApi.root.updateMatrixWorld(true);
    const fr = riderApi.root.children[0], P = new T.Vector3(-0.05, riderApi.pelican.state.footY, -0.3 - (riderApi.pelican.root.position.z || 0)).applyMatrix4(fr.matrixWorld).toArray(), g = S.ride.get(), s = g.s, up = RV.upAt(P[0], P[2], u), sc = RV.scale(P[1], P[2], u), Pd = B.point(P[0], P[1], P[2], u);
    const hit = down(u, P, Pd, up, 0.5 * s * sc.v, 1.5 * s * sc.v, false); return hit ? { gap: dot(sub(Pd, hit.p), up) / (s * sc.v), under: hit.name } : null;
  }
  // a ground.js line as a path at offset o (flat units, + right of travel), from station s0 to s1 (s1 < s0: backwards)
  function linePath(id, s0, s1, o) { const ln = G.lines.find(l => l.id === id); if (!ln) return null; const n = Math.max(2, Math.ceil(Math.abs(s1 - s0) / 0.5)), P = []; let x0 = null;
    for (let k = 0; k <= n; k++) { const s = s0 + (s1 - s0) * k / n, q = ln.point(s, s1 >= s0 ? o : -o); let x = q.x; if (x0 !== null) x = x0 + wdx(x - x0); x0 = x; P.push([x, q.z]); }
    const Lc = [0]; for (let i = 1; i < P.length; i++) Lc.push(Lc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return { P, Lc, ln }; }
  // pure pursuit: the input for the next frame from the state alone (look-ahead 2.5 m x s, speed by the curvature ahead and the cap)
  function pursue(path, vmax) {
    const g = S.ride.get(), s = g.s, P = path.P, n = P.length; let best = null;
    for (let i = 0; i < n - 1; i++) { const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, l2 = dx * dx + dz * dz || 1e-12, px = ax + wdx(g.x - ax), t = Math.max(0, Math.min(1, ((px - ax) * dx + (g.z - az) * dz) / l2)), d = Math.hypot(px - ax - dx * t, g.z - az - dz * t); if (!best || d < best.d) best = { i, t, d, u: path.Lc[i] + Math.sqrt(l2) * t }; }
    const total = path.Lc[n - 1], ua = Math.min(total, best.u + 2.5 * s); let j = best.i; while (j + 1 < n - 1 && path.Lc[j + 1] < ua) j++;
    const tt = Math.max(0, Math.min(1, (ua - path.Lc[j]) / Math.max(1e-9, path.Lc[j + 1] - path.Lc[j]))), tx = P[j][0] + (P[j + 1][0] - P[j][0]) * tt, tz = P[j][1] + (P[j + 1][1] - P[j][1]) * tt;
    const err = wpi(Math.atan2(wdx(tx - g.x), tz - g.z) - g.heading), vt = Math.min(vmax ?? g.cap, g.cap, Math.abs(err) > 1 ? 0.6 : Infinity, Math.sqrt(2 * 2 * Math.max(0, (total - best.u) / s - 0.3)));
    return { throttle: g.speed > vt + 0.05 ? -Math.min(1, (g.speed - vt) / 1.5) : Math.max(0, Math.min(1, vt / g.cap + (vt - g.speed) * 0.5)), steer: Math.max(-1, Math.min(1, -3 * err)), done: total - best.u < 0.5 * s, u: best.u / s };
  }
  // the drawn camera now
  const camNow = () => ({ pos: S.camera.position.toArray(), q: S.camera.quaternion.toArray(), up: S.camera.up.toArray(), fwd: S.camera.getWorldDirection(new T.Vector3()).toArray() });
  window.__SR = { bent, sight, down, wheels, foot, linePath, pursue, camNow, wdx, wpi, sightMeshes, walkMeshes, stats: () => ({ cached: cache.size, bentVerts }), clear: () => { cache.clear(); bentVerts = 0; } };
  return { sight: sightMeshes.length, walk: walkMeshes.length };
}
