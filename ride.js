// R1 (docs/world/THIRD_PERSON_ROAM_PLAN.md 6.2-6.6, 6.13): the ride, the one way to roam the flat map (W10_SPEC 2.8: one roam). Pure: no THREE, no DOM; it reads the
// one ground sampler (ground.js) and what the ride runs into (ride_world.js). All figures are true metres and m/s, times the display scale s of the surface under the rider.
//   input     throttle and steer in [-1, 1] (keys and the stick add up, clipped); look yaw/pitch and the follow distance from drags, the wheel and pinches
//   speed     cruise 4.2 m/s, start 1.5 m/s2, coast 0.8, brake 3.5; stopped and still braking for 0.3 s: reverse up to 0.8; the cap of the surface (6.13.1), reached at
//             2.0 m/s2, also ahead of a slower surface (two look-ahead samples); stairs and the steep boardwalk: the rider gets off and pushes at 0.8 (U1); on stairs
//             the bike is carried on the shoulder: the body is the rider's circle (radius 0.32, no axis), so the bike can be turned round on a 1.6 m stair
//   steering  kinematic bicycle: the command follows the input at lambda 8, yaw rate = command x min(v / 2.2, 3.0 / v); below 0.5 m/s blended with turning the bike in
//             place at 1.2 rad/s; reversed when backing (A turns left: the heading grows, forward = (sin h, cos h))
//   body      a horizontal capsule, radius 0.32, axis +-0.5, height 0-1.75; pushed out of the boundary records and obstacles of ride_world.js (at most 4 passes per
//             substep); the velocity loses its part into the contact: beyond 60 deg from the boundary line the bike stops, else it slides along it (its heading turned
//             along the boundary, its speed times cos); a substep whose end has no walkable surface, or a height jump no surface allows, is not taken
//   ground    the front and rear wheel contacts each on their own surface (the walker's level: ground.at with a height hint), the rider's root at their middle
//   steps     dt <= 1/60 per substep (a substep moves <= 0.07 m x s: the capsule cannot pass a boundary or a 0.1 m post), a frame at most 0.12 s
//   seam      the display frame wraps: the rider's x moves by one turn, the caller shifts what follows it (onWrap)
//   camera    R2 (6.7): the follow place (focus 0.92 m over the root, 3.5 m behind and 0.70 m up, look 1.6 m ahead and 0.05 m up), turned by the look yaw and pitch, the
//             follow distance 2.5-6 m; damped per axis in the rider's frame (along lambda 6, up 4, across 3); a 0.2 m sphere swept from the focus to the camera against the
//             occluders (ride_world.js I5 boxes, the terrain, the tunnel lining): pulled in at once to the hit - 0.25 m (not under 1.2 m) and raised up to 0.6 m (not in a
//             tunnel), let out again at lambda 2; then kept within 0.5 m of the rideable surface on the rider's level (0 on a deck, the boardwalk and in the tunnel), 0.12 m over the ground
//             below it (0.3 m over a deck), 0.3 m from a tunnel's wall and roof
//   display   W9b: everything here stays in the flat display frame on both maps; ride_view.js maps the camera to the drawn map and scene.js tests the drawn sight line
//             with this sweep's own point test and limits (firstBlocked, reach, floorAt, tunnelOk)
(function (global) {
'use strict';
const CFG = {
  cruise: 4.2, accel: 1.5, coast: 0.8, brake: 3.5, reverse: 0.8, reverseDelay: 0.3, capDecel: 2.0, push: 0.8,
  steerLambda: 8, rMin: 2.2, latMax: 3.0, pivot: 1.2, pivotBelow: 0.5,
  radius: 0.32, half: 0.5, height: 1.75, wheelbase: 0.94, clearLow: 0.12,
  focus: 0.92, back: 3.5, up: 0.70, ahead: 1.6, lookUp: 0.05, fov: 46, near: 0.08, dist: [2.5, 6.0], pitch: [-0.10, 1.05], yawPx: 0.005, pitchPx: 0.003, recentre: 0.4, camClear: 0.12,
  sub: 1 / 60, maxFrame: 0.12, stopAngle: 60 * Math.PI / 180, band: 0.6, passes: 4, pushGrade: [0.15, 0.12],
  damp: { along: 6, up: 4, across: 3, release: 2 }, sweepR: 0.2, minDist: 1.2, hitBack: 0.25, raise: 0.6, outside: 0.5, deckClear: 0.3, tunnelClear: 0.3, tunnel: { r: 4.7, wall: 1.0 },
};
CFG.pitch0 = Math.atan2(CFG.up, CFG.back);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), sgn = v => (v < 0 ? -1 : 1), smooth = t => t * t * (3 - 2 * t);
// the speed cap of a surface (THIRD_PERSON_ROAM_PLAN 6.13.1), true m/s
function capOf(q) {
  if (!q) return CFG.cruise;
  switch (q.kind) {
    case 'stairs': return CFG.push;
    case 'snow': return 3.0;
    case 'boardwalk': return 2.5;
    case 'alley': return 3.5;
    case 'sidewalk': case 'band': case 'ramp': case 'walkway': case 'apron': case 'site': return 2.0;
    case 'driveway': return /^A0/.test(q.town || '') ? 3.5 : 2.0;
    default: return q.cls === 'RD05' ? 3.5 : CFG.cruise;       // carriageway, shoulder, deck, junction (RD05 roads 3.5)
  }
}
// closest points of segments p0-p1 and q0-q1 (2D): [s on p, t on q]
function segSeg(p0x, p0z, p1x, p1z, q0x, q0z, q1x, q1z) {
  const dx = p1x - p0x, dz = p1z - p0z, ex = q1x - q0x, ez = q1z - q0z, rx = p0x - q0x, rz = p0z - q0z, a = dx * dx + dz * dz, e = ex * ex + ez * ez, f = ex * rx + ez * rz;
  let s, t;
  if (a < 1e-12 && e < 1e-12) return [0, 0];
  if (a < 1e-12) { s = 0; t = clamp(f / e, 0, 1); }
  else { const c = dx * rx + dz * rz; if (e < 1e-12) { t = 0; s = clamp(-c / a, 0, 1); } else { const b = dx * ex + dz * ez, den = a * e - b * b; s = den > 1e-12 ? clamp((b * f - c * e) / den, 0, 1) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); } } }
  return [s, t];
}

// ctx = { ground, world: ride_world }
function create(ctx) {
  const G = ctx.ground, Wd = ctx.world, now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const st = { active: false, x: 0, z: 0, y: 0, heading: 0, speed: 0, steerCmd: 0, s: 1, sample: null, yF: 0, yB: 0, root: 0, pitch: 0, mode: 'ride', stopT: 0,
    lookYaw: 0, lookPitch: CFG.pitch0, dist: CFG.back, recentre: null, contact: null, pen: 0, wraps: 0, rejected: 0, offSurface: 0, ms: 0, spawn: null, onWrap: null, throttle: 0, steer: 0, cap: CFG.cruise };
  const at = (x, z, y) => G.at(x, z, y == null ? undefined : { y });
  // a surface on the rider's level only (the sampler gives the nearest in height even when that is a level below, e.g. a stair's foot under its gangway)
  const atLevel = (x, z, y, s) => { const q = at(x, z, y); return q && Math.abs(q.y - y) <= 0.35 * s ? q : null; };
  // the stairs' ends and RN12-01's gate (ground.links): within 1.6 m x s of one the rider is already off the bike, room to turn the carried bike to the stairs
  const stairEnds = G.links().filter(l => l.kind === 'stair-end' || l.kind === 'gate'), PER = G.PERIOD, wdx = d => d - PER * Math.round(d / PER);
  // the capsule at (x, z), heading f, pushed out of what it overlaps; (px, pz) the centre before the move decides which side of a one-sided record the rider is on
  function resolve(x, z, fx, fz, s, y, px, pz) {
    const r = CFG.radius * s, hl = st.carry ? 0 : CFG.half * s, near = Wd.near(x, z, y, hl + r + 0.75 * s, CFG.band * s);
    const recs = [], obs = [];
    // a record applies when the axis before the move lies on its free side (the far face of a two-sided curb is never the rider's)
    const o0x = px - fx * hl, o0z = pz - fz * hl, o1x = px + fx * hl, o1z = pz + fz * hl;
    for (const q of near.records) { const [a, b] = segSeg(o0x, o0z, o1x, o1z, q.ax, q.az, q.bx, q.bz), wx = o0x + (o1x - o0x) * a - (q.ax + (q.bx - q.ax) * b), wz = o0z + (o1z - o0z) * a - (q.az + (q.bz - q.az) * b);
      if (wx * q.nx + wz * q.nz > -0.5 * r) recs.push(q); }
    for (const o of near.obstacles) if (o.y1 > y + CFG.clearLow * s && o.y0 < y + CFG.height * s) obs.push(o);
    let first = null, pen = 0;
    const deepest = () => {
      const p0x = x - fx * hl, p0z = z - fz * hl, p1x = x + fx * hl, p1z = z + fz * hl; let best = null;
      const take = (p, nx, nz, what) => { if (p > 1e-6 && (!best || p > best.pen)) best = { pen: p, nx, nz, what }; };
      for (const q of recs) {
        const [a, b] = segSeg(p0x, p0z, p1x, p1z, q.ax, q.az, q.bx, q.bz), ax = p0x + (p1x - p0x) * a, az = p0z + (p1z - p0z) * a, bx = q.ax + (q.bx - q.ax) * b, bz = q.az + (q.bz - q.az) * b;
        const wx = ax - bx, wz = az - bz, d = Math.hypot(wx, wz), sd = wx * q.nx + wz * q.nz, end = b <= 1e-6 || b >= 1 - 1e-6;
        if (end) { if (d < r) take(r - d, d > 1e-9 ? wx / d : q.nx, d > 1e-9 ? wz / d : q.nz, q); }
        else if (sd >= 0) { if (d < r) take(r - d, q.nx, q.nz, q); }
        else take(r - sd, q.nx, q.nz, q);
      }
      for (const o of obs) {
        if (o.c || o.seg) { const sx = o.c ? o.c[0] : o.seg[0], sz = o.c ? o.c[1] : o.seg[1], ex = o.c ? o.c[0] : o.seg[2], ez = o.c ? o.c[1] : o.seg[3], [a, b] = segSeg(p0x, p0z, p1x, p1z, sx, sz, ex, ez);
          const wx = p0x + (p1x - p0x) * a - (sx + (ex - sx) * b), wz = p0z + (p1z - p0z) * a - (sz + (ez - sz) * b), d = Math.hypot(wx, wz), rr = r + o.r * 1;
          if (d < rr) take(rr - d, d > 1e-9 ? wx / d : -fx, d > 1e-9 ? wz / d : -fz, o); continue; }
        // a box (convex, counter-clockwise in x/z as stored): outside -> the nearest feature; crossing -> the edge with the least overlap
        const P = o.pts, n = P.length; let inside = true, dmin = Infinity, best2 = null;
        for (let i = 0; i < n; i++) { const A = P[i], B = P[(i + 1) % n], [a, b] = segSeg(p0x, p0z, p1x, p1z, A[0], A[1], B[0], B[1]), wx = p0x + (p1x - p0x) * a - (A[0] + (B[0] - A[0]) * b), wz = p0z + (p1z - p0z) * a - (A[1] + (B[1] - A[1]) * b), d = Math.hypot(wx, wz);
          if (d < dmin) { dmin = d; best2 = [wx, wz]; } const ex = B[0] - A[0], ez = B[1] - A[1], onx = ez, onz = -ex; if ((x - A[0]) * onx + (z - A[1]) * onz > 0) inside = false; }
        const crossing = dmin < 1e-9 || inside;
        if (!crossing) { if (dmin < r) take(r - dmin, best2[0] / dmin, best2[1] / dmin, o); continue; }
        let bo = Infinity, bn = null;
        for (let i = 0; i < n; i++) { const A = P[i], B = P[(i + 1) % n], ex = B[0] - A[0], ez = B[1] - A[1], l = Math.hypot(ex, ez) || 1, nx = ez / l, nz = -ex / l, e = A[0] * nx + A[1] * nz, cmin = Math.min(p0x * nx + p0z * nz, p1x * nx + p1z * nz) - r, ov = e - cmin; if (ov < bo) { bo = ov; bn = [nx, nz]; } }
        take(bo, bn[0], bn[1], o);
      }
      return best;
    };
    for (let k = 0; k < CFG.passes; k++) { const b = deepest(); if (!b) break; x += b.nx * (b.pen + 1e-5 * s); z += b.nz * (b.pen + 1e-5 * s); if (!first) first = b; }
    const left = deepest(); pen = left ? left.pen : 0;
    return { x, z, contact: first, pen };
  }
  const stepTol = (a, b, move, s) => (((a && a.kind === 'stairs') || (b && b.kind === 'stairs') ? 0.26 : (a && a.kind === 'boardwalk') || (b && b.kind === 'boardwalk') ? 0.17 : 0.06) + 0.16 * move) * s;
  function wheels() {
    const s = st.s, fx = Math.sin(st.heading), fz = Math.cos(st.heading), h = CFG.wheelbase / 2 * s;
    const qf = atLevel(st.x + fx * h, st.z + fz * h, st.y, s), qb = atLevel(st.x - fx * h, st.z - fz * h, st.y, s);
    st.yF = qf ? qf.y : st.y; st.yB = qb ? qb.y : st.y; st.root = (st.yF + st.yB) / 2; st.pitch = Math.atan2(st.yF - st.yB, CFG.wheelbase * s);
    st.qF = qf; st.qB = qb;
  }
  function modeOf(q) {
    if (!q) return st.mode;
    // off the bike as soon as its front (or, backing, its rear) reaches the stairs: the bike is then carried and passes a stair's torii
    if (q.kind === 'stairs' || (st.qF && st.qF.kind === 'stairs') || (st.qB && st.qB.kind === 'stairs')) return 'push';
    { const s = st.s, fx = Math.sin(st.heading), fz = Math.cos(st.heading), e = (CFG.half + CFG.radius + 0.05) * s, a = atLevel(st.x + fx * e, st.z + fz * e, st.y, s), b = atLevel(st.x - fx * e, st.z - fz * e, st.y, s);
      const nearEnd = stairEnds.some(l => Math.abs(wdx(l.x - st.x)) < 1.6 * s && Math.abs(l.z - st.z) < 1.6 * s && Math.hypot(wdx(l.x - st.x), l.z - st.z) < 1.6 * s && Math.abs(G.at(l.x, l.z, { y: st.y }) ? G.at(l.x, l.z, { y: st.y }).y - st.y : 1) < 0.5 * s);
      if ((a && a.kind === 'stairs') || (b && b.kind === 'stairs') || nearEnd) { st.nearStair = true; return 'push'; } st.nearStair = false; }
    if (q.kind !== 'boardwalk') return 'ride';
    const s = st.s, fx = Math.sin(st.heading), fz = Math.cos(st.heading), a = atLevel(st.x + fx * s, st.z + fz * s, st.y, s), b = atLevel(st.x - fx * s, st.z - fz * s, st.y, s);
    const grade = a && b ? Math.abs(a.alt - b.alt) / 2 : 0;
    return grade > CFG.pushGrade[0] || (st.mode === 'push' && grade > CFG.pushGrade[1]) ? 'push' : 'ride';
  }
  function sub(dt, thr, steer) {
    st.steerCmd += (steer - st.steerCmd) * (1 - Math.exp(-CFG.steerLambda * dt));
    const s = st.s, cap = st.mode === 'push' ? CFG.push : capOf(st.sample); st.cap = cap;
    let v = st.speed;
    if (thr > 1e-3) { st.stopT = 0; if (v < -1e-6) v = Math.min(0, v + CFG.brake * dt); else { const vt = thr * cap; if (v < vt) v = Math.min(vt, v + CFG.accel * dt); else if (v > vt && v <= cap) v = Math.max(vt, v - CFG.coast * dt); } }
    else if (thr < -1e-3) {
      if (v > 1e-6) { st.stopT = 0; v = Math.max(0, v - CFG.brake * -thr * dt); }
      else { st.stopT += dt; const want = -thr > 0.5 && st.stopT >= CFG.reverseDelay ? -CFG.reverse * Math.min(1, (-thr - 0.5) / 0.4) : 0; if (v > want) v = Math.max(want, v - CFG.accel * dt); else if (v < want) v = Math.min(want, v + CFG.brake * dt); }
    } else { st.stopT = 0; v = v > 0 ? Math.max(0, v - CFG.coast * dt) : Math.min(0, v + CFG.coast * dt); }
    if (v > cap) v = Math.max(cap, v - CFG.capDecel * dt);
    if (v < -CFG.reverse) v = -CFG.reverse;
    // look ahead: a slower surface within the distance the cap deceleration needs is approached at the speed that reaches its cap at its edge
    if (v > CFG.push + 0.05) { const fx = Math.sin(st.heading), fz = Math.cos(st.heading), lead = (CFG.half + CFG.radius) * s;
      for (const target of [CFG.push, 2.0]) { if (v <= target) continue; const dd = (v * v - target * target) / (2 * CFG.capDecel), q = atLevel(st.x + fx * (lead / s + dd) * s, st.z + fz * (lead / s + dd) * s, st.y, s); if (!q) continue;
        const c = capOf(q); if (c < v) { const allow = Math.sqrt(c * c + 2 * CFG.capDecel * dd * 0.5); if (v > allow) v = Math.max(allow, v - CFG.capDecel * dt); } } }
    // heading
    const av = Math.abs(v), b = Math.min(1, av / CFG.pivotBelow), wm = Math.min(Math.max(av, 0.5) / CFG.rMin, CFG.latMax / Math.max(av, 0.5));
    st.heading -= st.steerCmd * ((1 - b) * CFG.pivot + b * wm * sgn(v)) * dt;
    // the move
    const fx = Math.sin(st.heading), fz = Math.cos(st.heading), d = v * dt * s, tx = st.x + fx * d, tz = st.z + fz * d;
    const res = resolve(tx, tz, fx, fz, s, st.y, st.x, st.z);
    st.contact = res.contact ? { nx: res.contact.nx, nz: res.contact.nz, type: res.contact.what.type || 'obstacle', src: res.contact.what.src } : null; st.pen = res.pen / s;
    if (res.contact && Math.abs(v) > 1e-6) {
      const m = sgn(v), dot = (fx * res.contact.nx + fz * res.contact.nz) * m;
      if (dot < -1e-6) { const th = Math.asin(Math.min(1, -dot));
        if (th > CFG.stopAngle) v = 0;
        else { const tX = m * fx - dot * res.contact.nx, tZ = m * fz - dot * res.contact.nz, l = Math.hypot(tX, tZ); if (l > 1e-9) { v *= Math.cos(th); st.heading = Math.atan2(m * tX / l, m * tZ / l); } } }
    }
    const q = at(res.x, res.z, st.y), move = Math.hypot(res.x - st.x, res.z - st.z) / s;
    if (!q || Math.abs(q.y - st.y) > stepTol(st.sample, q, move, s) || res.pen > 0.05 * s) { st.rejected++; if (!q) st.offSurface++; st.speed = 0; return; }
    const wrap = q.x - res.x;
    st.x = q.x; st.z = q.z; st.y = q.y; st.s = q.s; st.sample = q; st.speed = v;
    if (Math.abs(wrap) > 1) { st.wraps++; if (st.cam) st.cam.pos[0] += wrap; if (st.onWrap) st.onWrap(wrap); }
    wheels(); st.mode = modeOf(q); st.carry = st.mode === 'push' && ([q, st.qF, st.qB].some(w => w && w.kind === 'stairs') || st.nearStair);
  }
  // ---- the chase camera (6.7)
  const P3 = (x, y, z) => [x, y, z];
  function ideal() { const s = st.s, yaw = st.heading + st.lookYaw, dx = Math.sin(yaw), dz = Math.cos(yaw), fy = st.root + CFG.focus * s, Rc = st.dist / Math.cos(CFG.pitch0) * s, p = st.lookPitch;
    return { focus: P3(st.x, fy, st.z), pos: P3(st.x - dx * Rc * Math.cos(p), fy + Rc * Math.sin(p), st.z - dz * Rc * Math.cos(p)), look: P3(st.x + dx * CFG.ahead * s, fy + CFG.lookUp * s, st.z + dz * CFG.ahead * s), len: Rc }; }
  const inTunnel = () => !!(st.sample && st.sample.layer === 'tunnel');
  // the ground under a point: the walkable surface on the rider's level if there is one (a tunnel's floor, a road in a cut: the terrain sampler knows neither), else the terrain
  const groundUnder = (x, z) => { const q = G.at(x, z, { y: st.y }); return q && Math.abs(q.y - st.y) < 3 * st.s ? q : null; };
  // inside the tunnel's lining with a margin: offset within the radius, height under the roof (1 m walls, a 4.7 m half circle)
  function tunnelOk(x, y, z, margin) { const q = G.at(x, z, { y: st.y }); if (!q || q.layer !== 'tunnel') return true; const s = q.s, o = Math.abs(q.offset || 0), h = (y - q.y) / s, R = CFG.tunnel.r - margin; return o <= R && h <= CFG.tunnel.wall + Math.sqrt(Math.max(0, R * R - o * o)); }
  // distance from a point to a convex polygon (0 inside)
  function boxDist(P, x, z) { let inside = true, d = Infinity; for (let i = 0, n = P.length; i < n; i++) { const A = P[i], B = P[(i + 1) % n], ex = B[0] - A[0], ez = B[1] - A[1], l2 = ex * ex + ez * ez || 1e-12, t = Math.max(0, Math.min(1, ((x - A[0]) * ex + (z - A[1]) * ez) / l2)); d = Math.min(d, Math.hypot(x - A[0] - ex * t, z - A[1] - ez * t)); if ((x - A[0]) * ez - (z - A[1]) * ex > 0) inside = false; } return inside ? 0 : d; }
  // one point of a sweep: what a sphere of radius r at (x, y, z) meets -- the ground on the rider's level or the terrain, (in the tunnel) the lining, an occluder box; '' if none
  function blockedAt(x, y, z, r, boxes, tun) {
    const gq = groundUnder(x, z); if (y < (gq ? gq.y : G.y(x, z)) + r) return gq ? 'ground ' + gq.kind : 'terrain';
    if (tun && !tunnelOk(x, y, z, CFG.tunnelClear * st.s)) return 'tunnel';
    for (const o of boxes) { if (y < o.y0 - r || y > o.y1 + r || x < o.bb[0] - r || x > o.bb[2] + r || z < o.bb[1] - r || z > o.bb[3] + r) continue; if (boxDist(o.pts, x, z) < r) return 'box ' + o.src; }
    return '';
  }
  // the first fraction along f -> p where a sphere of radius r meets an occluder box, the terrain or (in the tunnel) the lining; 1 if none
  function sweep(f, p, r) {
    const s = st.s, dx = p[0] - f[0], dy = p[1] - f[1], dz = p[2] - f[2], len = Math.hypot(dx, dy, dz); if (len < 1e-6) return 1;
    const boxes = Wd.occluders(Math.min(f[0], p[0]) - r, Math.min(f[2], p[2]) - r, Math.max(f[0], p[0]) + r, Math.max(f[2], p[2]) + r), n = Math.max(2, Math.ceil(len / (0.25 * s))), tun = inTunnel();     // samples 0.25 m apart: within the 0.2 m sphere, no wall falls between two
    for (let i = 1; i <= n; i++) { const t = i / n, why = blockedAt(f[0] + dx * t, f[1] + dy * t, f[2] + dz * t, r, boxes, tun); if (why) { sweep.why = why; return (i - 1) / n; } }
    return 1;
  }
  // the horizontal limit: within `allowed` of the rideable surface (the point that much nearer the focus stands on it)
  // (a surface on the rider's level: within 3 m x s in height, so a deck overhead or a beach below does not count)
  function horizOk(f, x, z, allowed) { const lv = (a, b) => { const q = G.at(a, b, { y: st.y }); return !!q && Math.abs(q.y - st.y) < 3 * st.s; }; if (lv(x, z)) return true; if (allowed <= 0) return false; const dx = f[0] - x, dz = f[2] - z, l = Math.hypot(dx, dz) || 1; return lv(x + dx / l * allowed, z + dz / l * allowed); }
  function cameraStep(dt) {
    const s = st.s, I = ideal(), c = st.cam || (st.cam = { pos: I.pos.slice(), d: I.len, raise: 0, init: false });
    // occlusion along the ideal ray: in at once, out at lambda 2
    const hit = sweep(I.focus, I.pos, CFG.sweepR * s); c.why = hit < 1 ? sweep.why : ''; const want = hit < 1 ? Math.max(CFG.minDist * s, hit * I.len - CFG.hitBack * s) : I.len;
    c.d = !c.init || want < c.d ? Math.min(want, I.len) : want - c.d < 1e-3 * s ? want : c.d + (want - c.d) * (1 - Math.exp(-CFG.damp.release * dt));
    c.pulled = c.d < I.len - 1e-6;
    const raiseT = inTunnel() ? 0 : CFG.raise * s * Math.max(0, Math.min(1, (I.len - c.d) / Math.max(1e-6, I.len - CFG.minDist * s)));
    c.raise = !c.init || raiseT > c.raise ? raiseT : c.raise - raiseT < 1e-3 * s ? raiseT : c.raise + (raiseT - c.raise) * (1 - Math.exp(-CFG.damp.release * dt));
    const k = c.d / I.len, target = [I.focus[0] + (I.pos[0] - I.focus[0]) * k, I.focus[1] + (I.pos[1] - I.focus[1]) * k + c.raise, I.focus[2] + (I.pos[2] - I.focus[2]) * k];
    // damping per axis in the rider's frame
    if (!c.init || dt <= 0) c.pos = target.slice();
    else { const fx = Math.sin(st.heading), fz = Math.cos(st.heading), ex = target[0] - c.pos[0], ey = target[1] - c.pos[1], ez = target[2] - c.pos[2], al = ex * fx + ez * fz, ac = -ex * fz + ez * fx;
      const ka = 1 - Math.exp(-CFG.damp.along * dt), ku = 1 - Math.exp(-CFG.damp.up * dt), kc = 1 - Math.exp(-CFG.damp.across * dt);
      c.pos[0] += fx * al * ka - fz * ac * kc; c.pos[2] += fz * al * ka + fx * ac * kc; c.pos[1] += ey * ku; }
    c.init = true;
    // the limits in order: nothing between the focus and the camera; the horizontal limit; the height; the tunnel lining
    const q0 = st.sample || {}, allowed = q0.layer === 'deck' || q0.layer === 'tunnel' || q0.kind === 'boardwalk' ? 0 : CFG.outside * s;
    const back = t => [I.focus[0] + (c.pos[0] - I.focus[0]) * t, I.focus[1] + (c.pos[1] - I.focus[1]) * t, I.focus[2] + (c.pos[2] - I.focus[2]) * t];
    c.clamped = '';
    const h2 = sweep(I.focus, c.pos, CFG.sweepR * s); if (h2 < 1) { const L2 = Math.hypot(c.pos[0] - I.focus[0], c.pos[1] - I.focus[1], c.pos[2] - I.focus[2]) || 1; c.pos = back(Math.max(0, (h2 * L2 - 0.05 * s) / L2)); c.clamped += 'occluder '; }
    if (!horizOk(I.focus, c.pos[0], c.pos[2], allowed)) { let lo = 0, hi = 1; for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2, p = back(m); if (horizOk(I.focus, p[0], p[2], allowed)) lo = m; else hi = m; } c.pos = back(lo); c.clamped += 'surface '; }
    const qc = groundUnder(c.pos[0], c.pos[2]), floor = qc ? qc.y + (qc.layer === 'deck' ? CFG.deckClear : CFG.camClear) * s : G.y(c.pos[0], c.pos[2]) + CFG.camClear * s;
    if (c.pos[1] < floor) { c.pos[1] = floor; c.clamped += 'height '; }
    if (inTunnel() && !tunnelOk(c.pos[0], c.pos[1], c.pos[2], CFG.tunnelClear * s)) { let lo = 0, hi = 1; for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2, p = back(m); if (tunnelOk(p[0], p[1], p[2], CFG.tunnelClear * s)) lo = m; else hi = m; } c.pos = back(lo); c.clamped += 'tunnel '; }
    c.focus = I.focus; c.look = I.look; c.blocked = st.debugCam ? sweep(I.focus, c.pos, 0.02 * s) < 1 : null;     // the sight line's own test only when a check asks (st.debugCam)
  }
  const api = {
    CFG, capOf, state: st,
    // place the rider at (x, z) (display frame or any), heading h; on the layer nearest y if given
    place(x, z, heading, opt = {}) {
      // a given line's own surface first (a spawn at a road's end that an I9 site overlaps stays on the road)
      const own = opt.line ? G.layers(x, z).find(c => c.line === opt.line && (!opt.layer || c.layer === opt.layer)) : null;
      const q = own || (opt.y != null ? at(x, z, opt.y) : opt.layer ? G.at(x, z, { layer: opt.layer }) : at(x, z));
      if (!q) return null;
      Wd.prefetch(q.x, q.z, 3 * CFG.back * q.s);
      st.x = q.x; st.z = q.z; st.y = q.y; st.s = q.s; st.sample = q; st.heading = heading ?? st.heading; st.speed = opt.speed || 0; st.steerCmd = 0; st.stopT = 0; st.contact = null;
      const fx = Math.sin(st.heading), fz = Math.cos(st.heading), res = resolve(st.x, st.z, fx, fz, st.s, st.y, st.x, st.z), q2 = (own && G.layers(res.x, res.z).find(c => c.line === own.line && c.layer === own.layer)) || at(res.x, res.z, st.y);
      if (q2) { st.x = q2.x; st.z = q2.z; st.y = q2.y; st.s = q2.s; st.sample = q2; }
      wheels(); st.mode = modeOf(st.sample); st.carry = st.mode === 'push' && ([st.sample, st.qF, st.qB].some(w => w && w.kind === 'stairs') || st.nearStair); st.cam = null; cameraStep(0); return st.sample;
    },
    // start riding for a free view target (I8 spawn, 6.3); returns the spawn
    enter(tx, tz, dir) {
      const sp = G.spawn(tx, tz, dir); if (!sp) return null;
      if (!api.townReady) { api.townMs = Wd.prepareTown(); api.townReady = true; }
      st.lookYaw = 0; st.lookPitch = CFG.pitch0; st.dist = CFG.back; st.recentre = null;
      // RI-01: the rider stands on the spawn's surface or the ride does not start (a failed place left the rider where the last ride ended)
      if (!api.place(sp.x, sp.z, sp.heading, { layer: sp.layer, line: sp.line })) return null;
      st.active = true; st.wraps = 0; st.rejected = 0; st.offSurface = 0;
      st.spawn = { x: sp.x, z: sp.z, y: sp.y, layer: sp.layer, heading: sp.heading, distance: sp.distance, line: sp.line, edge: sp.edge, route: sp.route, kind: sp.kind, from: sp.from };
      return st.spawn;
    },
    exit() { st.active = false; st.speed = 0; st.steerCmd = 0; st.throttle = 0; st.steer = 0; st.recentre = null; },
    // advance by elapsed seconds with { throttle, steer } (the frame is cut to 0.12 s and into substeps of <= 1/60 s)
    step(elapsed, input = {}) {
      const t0 = now(), total = Math.min(CFG.maxFrame, Math.max(0, elapsed)), n = Math.max(1, Math.ceil(total / CFG.sub - 1e-9)), dt = total / n;
      const thr = clamp(input.throttle || 0, -1, 1), steer = clamp(input.steer || 0, -1, 1); st.throttle = thr; st.steer = steer;
      if (total > 0) for (let i = 0; i < n; i++) sub(dt, thr, steer);
      if (st.recentre) { st.recentre.t = Math.min(1, st.recentre.t + total / CFG.recentre); const k = smooth(st.recentre.t); st.lookYaw = st.recentre.yaw * (1 - k); st.lookPitch = st.recentre.pitch + (CFG.pitch0 - st.recentre.pitch) * k; if (st.recentre.t >= 1) st.recentre = null; }
      Wd.prefetch(st.x, st.z, 2.5 * CFG.back * st.s, 2);
      cameraStep(total);
      st.ms = now() - t0; return st;
    },
    // look: a drag of (dx, dy) pixels (grab style: dragging right turns the view left, dragging down lifts the view), the wheel / pinch factor, recentre (C, double tap)
    look(dx, dy) { st.recentre = null; st.lookYaw += dx * CFG.yawPx; st.lookPitch = clamp(st.lookPitch - dy * CFG.pitchPx, CFG.pitch[0], CFG.pitch[1]); },
    zoom(f) { st.dist = clamp(st.dist * f, CFG.dist[0], CFG.dist[1]); },
    recentre() { let y = st.lookYaw % (2 * Math.PI); if (y > Math.PI) y -= 2 * Math.PI; if (y < -Math.PI) y += 2 * Math.PI; st.lookYaw = y; st.recentre = { t: 0, yaw: y, pitch: st.lookPitch }; },
    // the chase camera (R2, 6.7): its pose this frame (flat frame); state in st.cam, advanced by cameraStep in step()
    // W9b (SPHERE_RIDING_PLAN 4.3): the tests of the display pass (scene.js) on flat points taken back from the drawn sight line: the first of pts (flat points, null
    // skipped) that a sphere of radius r meets (sweep's test), the floor under a point on the rider's level (or the terrain), the tunnel lining
    firstBlocked(pts, r) {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const p of pts) if (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
      if (x0 === Infinity) return { i: -1, why: '' };
      const boxes = Wd.occluders(x0 - r, z0 - r, x1 + r, z1 + r), tun = inTunnel();
      for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (!p) continue; const why = blockedAt(p[0], p[1], p[2], r, boxes, tun); if (why) return { i, why }; }
      return { i: -1, why: '' };
    },
    // the horizontal limit of the camera (6.7 rule 2) at a flat point, for the camera as it stands this frame
    reach(x, z) { const q0 = st.sample || {}, allowed = q0.layer === 'deck' || q0.layer === 'tunnel' || q0.kind === 'boardwalk' ? 0 : CFG.outside * st.s, f = st.cam && st.cam.focus ? st.cam.focus : [st.x, st.y, st.z]; return horizOk(f, x, z, allowed); },
    floorAt(x, z) { const q = groundUnder(x, z); return q ? { y: q.y, deck: q.layer === 'deck', kind: q.kind } : { y: G.y(x, z), deck: false, kind: 'terrain' }; },
    tunnelOk: (x, y, z, margin) => tunnelOk(x, y, z, margin), inTunnel,
    camera() { if (!st.cam) cameraStep(0); const c = st.cam; return { position: c.pos.slice(), look: c.look.slice(), focus: c.focus.slice(), fov: CFG.fov, near: CFG.near, pulled: c.pulled, dist: c.d, raise: c.raise, blocked: c.blocked, clamped: c.clamped, why: c.why }; },
    get() {
      const q = st.sample || {};
      return { active: st.active, x: st.x, y: st.y, z: st.z, root: st.root, heading: st.heading, speed: st.speed, steerCmd: st.steerCmd, throttle: st.throttle, steer: st.steer, mode: st.mode, carry: !!st.carry, cap: st.cap, s: st.s,
        kind: q.kind, layer: q.layer, line: q.line, edge: q.edge, route: q.route, cls: q.cls, town: q.town, slope: q.slope, wheels: [st.yF, st.yB], wheelKinds: [st.qF && st.qF.kind, st.qB && st.qB.kind], pitch: st.pitch,
        contact: st.contact, pen: st.pen, lookYaw: st.lookYaw, lookPitch: st.lookPitch, dist: st.dist, wraps: st.wraps, rejected: st.rejected, offSurface: st.offSurface, ms: st.ms, spawn: st.spawn };
    },
    townReady: false, townMs: 0,
  };
  return api;
}

const RIDE = { create, CFG, capOf };
if (typeof module !== 'undefined' && module.exports) module.exports = RIDE;
else global.RIDE = RIDE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
