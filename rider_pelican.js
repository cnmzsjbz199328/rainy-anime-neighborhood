// R2 pelican rider. Ported from riba2534/claude-opus-5-5-demo, pelican-bike/src/pelican.js at commit 54adc1fb64155f9dd7c1c90ecae7b8185ac540b8
// (https://github.com/riba2534/claude-opus-5-5-demo/tree/54adc1fb64155f9dd7c1c90ecae7b8185ac540b8/pelican-bike), used with the user's permission (README).
// Kept from upstream: the body shape (deformed sphere with the cream chest), BODY_POS / BODY_PITCH, the anchors (hips, shoulders, neck), the bone lengths (thigh 0.36,
// shin 0.37, humerus 0.22, forearm 0.23, beak 0.4 m), the S-shaped dynamic neck, the head (skull, forehead, throat, crest, eyes), the lofted upper and lower beak and the
// pouch, the feet, the wing panels and primaries, and update(): pedalling bob and sway, two-bone IK of the legs to the pedals and of the wings to the grips, the steadied head.
// Changed for this project (R2 design card docs/world/R2_RIDER_CARD.md): toon colours on the project's paper-grain material instead of the PBR, sheen and feather textures;
// a pen outline as a back-face hull of the body and the head; the helmet and the sunglasses replaced by the card's rain gear (a mustard rain cape over the body, a navy
// brimmed rain hat) and the red scarf knot kept; no blink, honk, gulp, trick or wing spreading; the legs and wings are one buffer of rigid parts placed per frame
// (RIDER_UTIL.Rig), the body and the head one mesh each, so the pelican costs 6 draw calls; new poses for this project: one foot down when stopped, walking beside the bike
// when pushing it (stairs, steep boardwalk: decision U1); segment counts lowered.
(function (global) {
'use strict';
const BODY_POS = [-0.13, 0.965, 0], BODY_PITCH = 0.35, THIGH = 0.36, SHIN = 0.37, HUMERUS = 0.22, FOREARM = 0.23, BEAK_L = 0.4;
const COL = { white: '#f3f0e8', cream: '#f2dfa4', grey: '#dfdcd4', black: '#2a2b30', panel: '#ebe7dc', skin: '#efbf98', eye: '#1c120e', iris: '#b5473a', leg: '#e88a3a',
  beakBase: '#eda07e', beakMid: '#f0c060', beakTip: '#e48c3c', nail: '#c44a32', pouch: '#e9b25c', cape: '#d2ae52', capeDark: '#a9893c', hat: '#3e4b5e', hatBrim: '#323d4d', scarf: '#c8443e' };

function createPelican(M) {
  const THREE = global.THREE, U = global.RIDER_UTIL, { v3, loft, DynamicTube, solveTwoBone, geom, merge, Rig, unitCylinder, clamp, lerp, damp, smoothstep, TAU } = U;
  const root = new THREE.Group(); root.name = 'ride:pelican';
  const mtx = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, order = 'XYZ') => new THREE.Matrix4().compose(v3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, order)), v3(sx, sy, sz));
  const hullOf = (g, d) => { const q = g.clone(), p = q.attributes.position, n = q.attributes.normal; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d); return q; };
  const named = (m, name) => { m.name = name; m.frustumCulled = false; return m; };

  // ---- body: deformed sphere with the cream chest (upstream bodyGeometry), the tail feathers, the rain cape, the scarf knot at the neck's root
  const bodyGeometry = () => { const g = new THREE.SphereGeometry(1, 28, 18), p = g.attributes.position, col = new Float32Array(p.count * 3), white = new THREE.Color(COL.white), cream = new THREE.Color(COL.cream), grey = new THREE.Color(COL.grey), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), taper = x < 0 ? 1 - 0.5 * Math.pow(-x, 1.7) : 1 - 0.14 * x * x; let X = x * 0.4, Y = y * 0.215 * taper * (y < 0 ? 0.92 : 1); const Z = z * 0.2 * taper;
      if (x < -0.35) Y += (-x - 0.35) * 0.06; if (x > 0.2 && y > 0) X += y * 0.05 * (x - 0.2); p.setXYZ(i, X, Y, Z);
      c.copy(white).lerp(cream, smoothstep(0.35, 0.85, x) * smoothstep(-0.6, 0.1, y) * 0.8).lerp(grey, smoothstep(0.2, 0.9, y) * smoothstep(0.2, -0.6, x) * 0.5); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g; };
  const featherShape = (len, width) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(len * 0.12, width * 0.55, len * 0.5, width * 0.5); s.quadraticCurveTo(len * 0.92, width * 0.42, len, 0); s.quadraticCurveTo(len * 0.9, -width * 0.42, len * 0.5, -width * 0.5); s.quadraticCurveTo(len * 0.12, -width * 0.55, 0, 0); const g = new THREE.ShapeGeometry(s, 3); g.rotateX(Math.PI / 2); return g; };
  const bodyGeo = bodyGeometry();
  const body = new THREE.Group(); body.position.set(...BODY_POS); body.rotation.z = BODY_PITCH; root.add(body);
  const B = [geom(bodyGeo)];
  for (let i = 0; i < 7; i++) B.push(geom(featherShape(0.17, 0.06), COL.panel, new THREE.Matrix4().multiplyMatrices(mtx(-0.37, 0.035 - Math.abs(i - 3) * 0.003, 0), mtx(0, 0, 0, 0, Math.PI + (i - 3) * 0.16, 0.25))));
  // the rain cape (card U3): the body's upper half, 14 % larger, hanging a little lower at the sides, with a darker hem
  { const g = new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI * 0.62), p = g.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(COL.cape), d = new THREE.Color(COL.capeDark);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), taper = x < 0 ? 1 - 0.45 * Math.pow(-x, 1.7) : 1 - 0.14 * x * x; p.setXYZ(i, x * 0.43, y * 0.25 * taper + (y < 0.2 ? -0.03 : 0), z * 0.235 * taper); const c = y < 0.0 ? d : a; col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); B.push(geom(g, undefined, mtx(0.0, 0.012, 0))); }
  B.push(geom(new THREE.TorusGeometry(0.068, 0.022, 6, 14), COL.scarf, mtx(0.29, 0.13, 0, 0, Math.PI / 2, 0.9)));
  const bodyMesh = named(new THREE.Mesh(merge(B), M.toon), 'ride:pelican body'); body.add(bodyMesh);
  const bodyHull = named(new THREE.Mesh(hullOf(bodyGeo, 0.011), M.hull), 'ride:pelican body outline'); body.add(bodyHull);
  const anchor = (x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); body.add(o); return o; };
  const A = { hipL: anchor(-0.05, -0.125, -0.09), hipR: anchor(-0.05, -0.125, 0.09), shL: anchor(0.14, 0.085, -0.17), shR: anchor(0.14, 0.085, 0.17), neck: anchor(0.3, 0.1, 0) };

  // ---- neck (rebuilt every frame)
  const neck = new DynamicTube(16, 10, t => lerp(0.085, 0.05, smoothstep(0.0, 0.45, t)) + 0.004 * Math.sin(t * Math.PI) + (t > 0.85 ? (t - 0.85) * 0.05 : 0), COL.white);
  const neckMesh = named(new THREE.Mesh(neck.geometry, M.toon), 'ride:pelican neck'); root.add(neckMesh);

  // ---- head: skull, forehead, throat, crest, eye patches and eyes, the lofted beak and pouch (upstream), the card's rain hat
  const head = new THREE.Group(); root.add(head);
  const Hp = [], hullParts = [];
  { const skull = new THREE.SphereGeometry(0.075, 16, 10).scale(1.3, 1.0, 0.9), fore = new THREE.SphereGeometry(0.05, 12, 8).scale(1.45, 0.85, 0.85).translate(0.05, -0.006, 0), thr = new THREE.SphereGeometry(0.045, 10, 8).translate(0.02, -0.045, 0);
    for (const g of [skull, fore, thr]) { Hp.push(geom(g, COL.white)); hullParts.push(geom(hullOf(g.index ? g.toNonIndexed() : g, 0.009), COL.white)); } }
  for (let i = 0; i < 5; i++) Hp.push(geom(new THREE.ConeGeometry(0.012, 0.07, 5), COL.white, mtx(-0.085, 0.02 + i * 0.006, (i - 2) * 0.012, 0, 0, Math.PI / 2 + 0.5 + (i % 2) * 0.2)));
  for (const s of [-1, 1]) { Hp.push(geom(new THREE.SphereGeometry(0.03, 10, 8).scale(1.25, 0.8, 0.45), COL.skin, mtx(0.048, 0.004, s * 0.05)), geom(new THREE.SphereGeometry(0.0128, 8, 6), COL.eye, mtx(0.05, 0.008, s * 0.06)),
    geom(new THREE.SphereGeometry(0.006, 6, 4), COL.iris, mtx(0.054, 0.009, s * 0.0715)), geom(new THREE.SphereGeometry(0.0035, 6, 4), COL.eye, mtx(0.0555, 0.009, s * 0.0752))); }
  const beakM = mtx(0.078, -0.016, 0, 0, 0, -0.3);
  const upperBeak = loft({ segs: 18, ring: 10, center: t => v3(t * BEAK_L, -0.006 * t - 0.012 * t * t * t, 0), section: (t, a) => { const th = a * TAU, close = Math.sqrt(Math.max(0, 1 - Math.pow(t, 10))), w = (0.034 * (1 - 0.55 * t) + 0.007) * close, h = (0.017 * (1 - 0.5 * t) + 0.004) * close, c = Math.cos(th); return [c > 0 ? c * h * (c > 0.9 ? 1.18 : 1) : c * h * 0.3, Math.sin(th) * w]; },
    color: (t, a, c) => { c.set(COL.beakBase).lerp(new THREE.Color(COL.beakMid), smoothstep(0, 0.35, t)).lerp(new THREE.Color(COL.beakTip), smoothstep(0.5, 0.95, t)); if (t > 0.94) c.set(COL.nail); } });
  const lowerBeak = loft({ segs: 14, ring: 8, center: t => v3(t * BEAK_L * 0.97, -0.018 - 0.008 * t - 0.012 * t * t * t, 0), section: (t, a) => { const th = a * TAU, close = Math.sqrt(Math.max(0, 1 - Math.pow(t, 10))); return [Math.cos(th) * (0.007 * close + 0.001), Math.sin(th) * (0.032 * (1 - 0.55 * t) + 0.006) * close]; },
    color: (t, a, c) => c.set(COL.beakMid).lerp(new THREE.Color(COL.beakTip), t) });
  const pouch = loft({ segs: 14, ring: 10, center: t => v3(t * BEAK_L * 0.95, -0.02 - 0.008 * t - 0.012 * t * t * t, 0), section: (t, a) => { const phi = a * Math.PI, close = Math.sqrt(Math.max(0, 1 - Math.pow(t, 8))), bell = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 1.25); return [-Math.sin(phi) * (0.07 * bell + 0.004) * close, Math.cos(phi) * (0.031 * (1 - 0.5 * t) + 0.004) * close]; } });
  Hp.push(geom(upperBeak, undefined, beakM), geom(lowerBeak, undefined, beakM), geom(pouch, COL.pouch, beakM));
  // the rain hat (card U3): a low crown and a brim that dips at the back, tilted a little forward
  { const hm = mtx(-0.012, 0.045, 0, 0, 0, -0.12), crown = new THREE.SphereGeometry(0.082, 14, 6, 0, TAU, 0, Math.PI * 0.5).scale(1.25, 0.8, 1.05), brim = new THREE.CylinderGeometry(0.15, 0.17, 0.012, 16, 1).translate(-0.01, 0.0, 0);
    Hp.push(geom(crown, COL.hat, hm), geom(brim, COL.hatBrim, hm), geom(new THREE.TorusGeometry(0.098, 0.006, 4, 16).rotateX(Math.PI / 2).scale(1.25, 1, 1.05), COL.hatBrim, new THREE.Matrix4().multiplyMatrices(hm, mtx(0, 0.008, 0))));
    hullParts.push(geom(hullOf(crown.toNonIndexed(), 0.008), COL.white, hm)); }
  const headMesh = named(new THREE.Mesh(merge(Hp), M.toon), 'ride:pelican head'), headHull = named(new THREE.Mesh(merge(hullParts), M.hull), 'ride:pelican head outline'); head.add(headMesh, headHull);

  // ---- legs and wings: one rig of rigid parts
  const footGeometry = () => { const s = new THREE.Shape(); s.moveTo(-0.02, 0.012); s.quadraticCurveTo(0.04, 0.03, 0.1, 0.05); s.quadraticCurveTo(0.09, 0.028, 0.105, 0.022); s.quadraticCurveTo(0.11, 0.01, 0.125, 0.0); s.quadraticCurveTo(0.11, -0.01, 0.105, -0.022); s.quadraticCurveTo(0.09, -0.028, 0.1, -0.05); s.quadraticCurveTo(0.04, -0.03, -0.02, -0.012); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 4 }); g.rotateX(-Math.PI / 2); return g; };
  const panelGeometry = (len, depth, n) => { const s = new THREE.Shape(); s.moveTo(0, -0.01); s.lineTo(len, -0.01); for (let i = 0; i <= n; i++) { const x = len - (i / n) * len, d = depth * (0.75 + 0.25 * Math.sin((i / n) * Math.PI)); s.quadraticCurveTo(x + len / n / 2, d * 1.08, x, d * 0.9); } s.lineTo(0, -0.01); const g = new THREE.ShapeGeometry(s, 3); g.rotateX(Math.PI / 2); return g; };
  const parts = [], idx = {};
  const part = (name, g) => { idx[name] = parts.length; parts.push(g); };
  for (const s of [-1, 1]) { const k = s < 0 ? 'L' : 'R';
    part('thigh' + k, geom(unitCylinder(0.064, 0.042, 8), COL.white)); part('knee' + k, geom(new THREE.SphereGeometry(0.043, 8, 6), COL.white)); part('shin' + k, geom(unitCylinder(0.024, 0.019, 6), COL.leg));
    part('ankle' + k, geom(new THREE.SphereGeometry(0.021, 6, 4), COL.leg)); part('foot' + k, geom(footGeometry(), COL.leg)); }
  const primaries = [0.2, 0.24, 0.27, 0.28, 0.27, 0.24];
  for (const s of [-1, 1]) { const k = s < 0 ? 'L' : 'R';
    part('sh' + k, merge([geom(new THREE.SphereGeometry(1, 8, 6), COL.white, mtx(HUMERUS / 2, 0, 0.018, 0, 0, 0, HUMERUS / 2 + 0.025, 0.036, 0.07)), geom(panelGeometry(HUMERUS, 0.14, 4), COL.panel, mtx(0, -0.004, 0))]));
    part('el' + k, merge([geom(new THREE.SphereGeometry(1, 8, 6), COL.white, mtx(FOREARM / 2, 0, 0.014, 0, 0, 0, FOREARM / 2 + 0.02, 0.03, 0.058)), geom(panelGeometry(FOREARM, 0.085, 5), COL.panel, mtx(0, 0.002, 0)), geom(panelGeometry(FOREARM, 0.165, 6), COL.black, mtx(0, -0.004, 0))]));
    part('wr' + k, merge([geom(new THREE.SphereGeometry(1, 8, 6), COL.white, mtx(0.02, 0, 0, 0, 0, 0, 0.05, 0.03, 0.038)), ...primaries.map((l, i) => geom(featherShape(l, 0.05), COL.black, new THREE.Matrix4().multiplyMatrices(mtx(0.01, -0.003 - i * 0.0015, 0.004 * i), mtx(0, 0, 0, 0, -(Math.PI - 0.12 - i * 0.05), 0))))])); }
  const rig = new Rig(parts), rigMesh = named(new THREE.Mesh(rig.geometry, M.toonDouble), 'ride:pelican legs and wings'); root.add(rigMesh);

  // ---- animation
  const st = { yaw: 0, yawGoal: 0, pitch: 0, headBob: 0, stand: 0 };
  // RI-02 (docs/world/RIDE_INTERACTION_FIX_PLAN.md 3): the head's turn toward the view. lookYaw is the camera's bearing from the heading over any number of turns
  // (ride.js keeps adding the drag), so the goal is made periodic in 2 pi and continuous: w is lookYaw wrapped to [-pi, pi]; in front, within 1 / 0.6 rad
  // (95.5 deg), 0.6 w as before (same sign: the head turns the way the view does); past that the 1 rad limit eases back (smoothstep) to straight ahead where the
  // camera looks back at the rider (w = +-pi), so the camera passing behind never flips the head from one limit to the other. Damped at lambda 4 as before.
  const LOOK_FOLLOW = 0.6, LOOK_LIMIT = 1.0;
  const headYaw = lookYaw => { const w = lookYaw - TAU * Math.round(lookYaw / TAU), a = Math.abs(w); return Math.sign(w) * Math.min(LOOK_FOLLOW * a, LOOK_LIMIT) * (1 - smoothstep(LOOK_LIMIT / LOOK_FOLLOW, Math.PI, a)); };
  const V = {}; for (const k of ['hip', 'knee', 'ank', 'tgt', 'sh', 'el', 'wr', 'pole', 'tmp', 'trail', 'headPos', 'neckBase', 'up']) V[k] = new THREE.Vector3();
  const neckPts = [v3(0, 0, 0), v3(0, 0, 0), v3(0, 0, 0), v3(0, 0, 0), v3(0, 0, 0)];
  const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _mb = new THREE.Matrix4(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), UPV = v3(0, 1, 0), ONE = v3(1, 1, 1);
  const local = (a, out) => out.copy(a.position).applyMatrix4(body.matrix);
  const bone = (name, a, b) => { _bx.subVectors(b, a); const len = _bx.length(); _q.setFromUnitVectors(UPV, len > 1e-6 ? _bx.multiplyScalar(1 / len) : UPV); rig.set(idx[name], _m.compose(a, _q, V.up.set(1, Math.max(len, 1e-4), 1))); };
  const at = (name, p, q) => rig.set(idx[name], _m.compose(p, q || _q.identity(), ONE));
  // a joint frame from the bone direction and a trailing-edge hint (upstream orientJoint)
  const joint = (name, from, to, trailHint) => { _bx.subVectors(to, from).normalize(); _bz.copy(trailHint).addScaledVector(_bx, -trailHint.dot(_bx)); if (_bz.lengthSq() < 1e-6) _bz.set(0, -1, 0); _bz.normalize(); _by.crossVectors(_bz, _bx); _mb.makeBasis(_bx, _by, _bz); _q.setFromRotationMatrix(_mb); rig.set(idx[name], _m.compose(from, _q, ONE)); };
  // ctx: t, crankAngle, pedal (0..1), grips {L, R}, pedals {L, R} (root frame), mode 'ride' | 'stop' | 'push', footDown (the left foot's ground point, root frame),
  // walk (metres walked, for the stride), lookYaw (the head turns toward the view: headYaw), standGrip (push: the bike's left grip, root frame)
  function update(dt, ctx) {
    const { t, crankAngle, pedal, mode } = ctx, push = mode === 'push';
    st.stand = damp(st.stand, push ? 1 : 0, 8, dt);
    const k = st.stand, bob = -Math.abs(Math.sin(crankAngle)) * 0.012 * pedal * (1 - k);
    const sk = (ctx.stop || 0) * (1 - k);     // stopped on the bike: off the saddle, a little forward and down (the leg is 0.73 m)
    body.position.set(lerp(BODY_POS[0], -0.02, k) + 0.1 * sk, lerp(BODY_POS[1], 0.84, k) - 0.09 * sk + bob + (push ? Math.abs(Math.sin(ctx.walk * Math.PI / 0.55)) * 0.012 : 0), 0);
    body.rotation.set(Math.sin(crankAngle) * 0.035 * pedal * (1 - k), 0, lerp(BODY_PITCH, 0.14, k) - 0.08 * sk); body.updateMatrix();
    // legs
    for (const s of [-1, 1]) { const L = s < 0 ? 'L' : 'R';
      local(s < 0 ? A.hipL : A.hipR, V.hip);
      if (push) { const ph = ctx.walk * Math.PI / 0.55 + (s < 0 ? 0 : Math.PI); V.tgt.set(0.02 + Math.sin(ph) * 0.16, 0.03 + Math.max(0, Math.cos(ph)) * 0.05, s * 0.1); }
      else if (s < 0 && ctx.footDown) V.tgt.copy(ctx.footDown);
      else { const p = s < 0 ? ctx.pedals.L : ctx.pedals.R; V.tgt.set(p.x - 0.04, p.y + 0.046, p.z * 0.92); }
      V.pole.set(1, 0.15, s * 0.32);
      solveTwoBone(V.hip, V.tgt, THIGH, SHIN, V.pole, V.knee, V.ank);
      bone('thigh' + L, V.hip, V.knee); at('knee' + L, V.knee); bone('shin' + L, V.knee, V.ank); at('ankle' + L, V.ank);
      _q.setFromEuler(new THREE.Euler(0, 0, push || (s < 0 && ctx.footDown) ? 0 : -0.08 + Math.sin(-crankAngle + (s > 0 ? 0 : Math.PI) + 0.6) * 0.12)); at('foot' + L, V.tmp.set(V.ank.x - 0.012, V.ank.y - 0.04, V.ank.z), _q.clone());
      if (s < 0) st.footY = V.ank.y - 0.04; }
    // wings: to the grips (riding), the right wing to the bike's left grip and the left wing at rest (pushing)
    for (const s of [-1, 1]) { const L = s < 0 ? 'L' : 'R';
      local(s < 0 ? A.shL : A.shR, V.sh);
      const grip = push ? (s > 0 ? ctx.standGrip : V.tmp.set(V.sh.x + 0.05, V.sh.y - 0.38, V.sh.z - 0.06)) : (s < 0 ? ctx.grips.L : ctx.grips.R);
      V.pole.set(-0.25, 0.75, s * 0.85); solveTwoBone(V.sh, grip, HUMERUS, FOREARM, V.pole, V.el, V.wr);
      V.trail.set(-1, -0.7, 0);
      joint('sh' + L, V.sh, V.el, V.trail); joint('el' + L, V.el, V.wr, V.trail);
      V.tmp.subVectors(V.wr, V.el).normalize().multiplyScalar(0.1).add(V.wr); joint('wr' + L, V.wr, V.tmp, V.trail); }
    rig.commit();
    // head: steadied against the bob, turned a little toward the view
    local(A.neck, V.neckBase);
    st.headBob = damp(st.headBob, bob * 0.25, 10, dt);
    V.headPos.set(V.neckBase.x + 0.092, V.neckBase.y + 0.355 - bob * 0.75 + st.headBob, 0);
    st.yawGoal = headYaw(ctx.lookYaw || 0); st.yaw = damp(st.yaw, st.yawGoal, 4, dt); st.pitch = damp(st.pitch, -0.05, 6, dt);
    head.position.copy(V.headPos); head.rotation.set(Math.sin(t * 1.3) * 0.03, st.yaw, st.pitch, 'YZX'); head.updateMatrix();
    // the S-shaped neck
    neckPts[0].copy(V.neckBase).add(V.tmp.set(-0.03, -0.03, 0)); neckPts[1].copy(V.neckBase).add(V.tmp.set(0.035, 0.07, 0)); neckPts[2].copy(V.neckBase).lerp(V.headPos, 0.45).add(V.tmp.set(0.035, 0, 0));
    neckPts[3].set(-0.075, -0.1, 0).applyMatrix4(head.matrix).lerp(V.tmp.copy(V.headPos).add(_by.set(-0.075, -0.1, 0)), 0.4); neckPts[4].set(-0.03, -0.03, 0).applyMatrix4(head.matrix);
    neck.update(neckPts);
  }
  return { root, body, head, update, state: st, rig, rigIndex: idx, meshes: [bodyMesh, bodyHull, neckMesh, headMesh, headHull, rigMesh] };
}

const RIDER_PELICAN = { createPelican, COL, BODY_POS, BODY_PITCH };
if (typeof module !== 'undefined' && module.exports) module.exports = RIDER_PELICAN;
else global.RIDER_PELICAN = RIDER_PELICAN;
})(typeof globalThis !== 'undefined' ? globalThis : this);
