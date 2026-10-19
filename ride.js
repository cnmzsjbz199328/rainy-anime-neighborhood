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
//   camera    R1: the follow place of 6.7 (focus 0.92 m over the root, 3.5 m behind and 0.70 m up, look 1.6 m ahead and 0.05 m up), turned by the look yaw and pitch,
//             the follow distance 2.5-6 m, never under the ground below it + 0.12 m; R2 adds damping, occlusion and the limits
(function (global) {
'use strict';
const CFG = {
  cruise: 4.2, accel: 1.5, coast: 0.8, brake: 3.5, reverse: 0.8, reverseDelay: 0.3, capDecel: 2.0, push: 0.8,
  steerLambda: 8, rMin: 2.2, latMax: 3.0, pivot: 1.2, pivotBelow: 0.5,
  radius: 0.32, half: 0.5, height: 1.75, wheelbase: 0.94, clearLow: 0.12,
  focus: 0.92, back: 3.5, up: 0.70, ahead: 1.6, lookUp: 0.05, fov: 46, near: 0.08, dist: [2.5, 6.0], pitch: [-0.10, 1.05], yawPx: 0.005, pitchPx: 0.003, recentre: 0.4, camClear: 0.12,
  sub: 1 / 60, maxFrame: 0.12, stopAngle: 60 * Math.PI / 180, band: 0.6, passes: 4, pushGrade: [0.15, 0.12],
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
    if (Math.abs(wrap) > 1) { st.wraps++; if (st.onWrap) st.onWrap(wrap); }
    wheels(); st.mode = modeOf(q); st.carry = st.mode === 'push' && ([q, st.qF, st.qB].some(w => w && w.kind === 'stairs') || st.nearStair);
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
      wheels(); st.mode = modeOf(st.sample); st.carry = st.mode === 'push' && ([st.sample, st.qF, st.qB].some(w => w && w.kind === 'stairs') || st.nearStair); return st.sample;
    },
    // start riding for a free view target (I8 spawn, 6.3); returns the spawn
    enter(tx, tz, dir) {
      const sp = G.spawn(tx, tz, dir); if (!sp) return null;
      if (!api.townReady) { api.townMs = Wd.prepareTown(); api.townReady = true; }
      st.active = true; st.lookYaw = 0; st.lookPitch = CFG.pitch0; st.dist = CFG.back; st.recentre = null; st.wraps = 0; st.rejected = 0; st.offSurface = 0;
      api.place(sp.x, sp.z, sp.heading, { layer: sp.layer, line: sp.line });
      st.spawn = { x: sp.x, z: sp.z, heading: sp.heading, distance: sp.distance, line: sp.line, edge: sp.edge, route: sp.route, kind: sp.kind, from: sp.from };
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
      st.ms = now() - t0; return st;
    },
    // look: a drag of (dx, dy) pixels (grab style: dragging right turns the view left, dragging down lifts the view), the wheel / pinch factor, recentre (C, double tap)
    look(dx, dy) { st.recentre = null; st.lookYaw += dx * CFG.yawPx; st.lookPitch = clamp(st.lookPitch - dy * CFG.pitchPx, CFG.pitch[0], CFG.pitch[1]); },
    zoom(f) { st.dist = clamp(st.dist * f, CFG.dist[0], CFG.dist[1]); },
    recentre() { let y = st.lookYaw % (2 * Math.PI); if (y > Math.PI) y -= 2 * Math.PI; if (y < -Math.PI) y += 2 * Math.PI; st.lookYaw = y; st.recentre = { t: 0, yaw: y, pitch: st.lookPitch }; },
    // the follow camera (R1): position, look point, focus (flat frame)
    camera() {
      const s = st.s, yaw = st.heading + st.lookYaw, dx = Math.sin(yaw), dz = Math.cos(yaw), fy = st.root + CFG.focus * s, Rc = st.dist / Math.cos(CFG.pitch0) * s, p = st.lookPitch;
      const pos = [st.x - dx * Rc * Math.cos(p), fy + Rc * Math.sin(p), st.z - dz * Rc * Math.cos(p)];
      const q = at(pos[0], pos[2], fy), gy = Math.max(q ? q.y : -Infinity, G.y(pos[0], pos[2]));
      if (pos[1] < gy + CFG.camClear * s) pos[1] = gy + CFG.camClear * s;
      return { position: pos, look: [st.x + dx * CFG.ahead * s, fy + CFG.lookUp * s, st.z + dz * CFG.ahead * s], focus: [st.x, fy, st.z], fov: CFG.fov, near: CFG.near };
    },
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
