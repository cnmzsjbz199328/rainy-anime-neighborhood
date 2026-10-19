// R2 bicycle. Ported from riba2534/claude-opus-5-5-demo, pelican-bike/src/bicycle.js at commit 54adc1fb64155f9dd7c1c90ecae7b8185ac540b8
// (https://github.com/riba2534/claude-opus-5-5-demo/tree/54adc1fb64155f9dd7c1c90ecae7b8185ac540b8/pelican-bike), used with the user's permission (README).
// Kept from upstream: the frame geometry points (P), WHEEL_R 0.3 m, wheelbase 0.94 m, the crank (0.15 m), chainring and cog radii and GEARS, the frame / fork / steer / wheel /
// crank / pedal / fender / bar / basket layout and the update({ wheelAngle, crankAngle, steerAngle }) contract with its anchors (grips, pedals) and steerMatrix().
// Changed for this project (docs/world/THIRD_PERSON_ROAM_PLAN.md section 3, R2 design card docs/world/R2_RIDER_CARD.md): the PBR materials, decal, wicker and fish textures
// are gone: every part is a toon colour (vertex colours on the project's paper-grain toon material); the 0.0014 m spokes and the chain links are ink lines; the gear teeth
// are dropped; parts are merged per moving piece (frame, steer, each wheel, crank, both pedals) so the bike costs 11 draw calls; no spot light and no shadows (the lamp and
// tail light are self-lit faces); the bell and the fish are replaced by the design card's basket (a convenience-store bag with a leek); segment counts are lowered.
(function (global) {
'use strict';
const WHEEL_R = 0.3;
const GEARS = [[44, 28], [44, 22], [44, 18], [44, 15], [44, 12]];
const CRANK = 0.15, RING_R = 0.1, COG_R = 0.042;
// the R2 design card's colours
const COL = { frame: '#5b8783', frameDark: '#3f5d5b', chrome: '#b7bec2', dark: '#2b2d31', tire: '#26282c', wall: '#b39a74', leather: '#6e4a30', cream: '#e6dcc2', grip: '#5a3e2a',
  wicker: '#a8845a', wickerDark: '#7d5f3e', bag: '#ece8de', bagStripe: '#5f9c95', leek: '#7aa65a', leekWhite: '#e7e4d4', lamp: '#fff0c8', tail: '#ff4a3a', reflector: '#ff9a3a' };

function createBicycle(M) {
  const THREE = global.THREE, U = global.RIDER_UTIL, { v3, cylBetween, geom, merge, Rig, TAU } = U;
  const P = { rearHub: v3(-0.46, WHEEL_R, 0), frontHub: v3(0.48, WHEEL_R, 0), bb: v3(-0.06, 0.25, 0), seat: v3(-0.2, 0.64, 0), saddle: v3(-0.235, 0.705, 0), headTop: v3(0.32, 0.72, 0), headBot: v3(0.36, 0.57, 0) };
  const group = new THREE.Group(); group.name = 'ride:bicycle';
  const mtx = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(v3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), v3(sx, sy, sz));
  const mesh = (parts, mat, name) => { const m = new THREE.Mesh(merge(parts), mat); m.name = name; m.frustumCulled = false; return m; };

  // ---- frame (rigid)
  const axis = P.headTop.clone().sub(P.headBot).normalize();
  const ht0 = P.headTop.clone().addScaledVector(axis, 0.025), ht1 = P.headBot.clone().addScaledVector(axis, -0.02);
  const F = [], FL = [];
  F.push(geom(cylBetween(ht1, ht0, 0.021, 0.021), COL.frame));
  F.push(geom(cylBetween(P.seat, P.headTop.clone().addScaledVector(axis, -0.02), 0.016, 0.016), COL.frame));
  F.push(geom(cylBetween(P.bb, P.headBot.clone().addScaledVector(axis, 0.03), 0.02, 0.019), COL.frame));
  F.push(geom(cylBetween(P.bb, P.seat.clone().addScaledVector(v3(0.35, -1, 0).normalize(), -0.03), 0.018, 0.017), COL.frame));
  for (const s of [-1, 1]) {
    F.push(geom(cylBetween(P.bb.clone().setZ(s * 0.02), P.rearHub.clone().setZ(s * 0.05), 0.011, 0.008, 6), COL.frame));
    F.push(geom(cylBetween(P.seat.clone().add(v3(0, -0.02, s * 0.015)), P.rearHub.clone().setZ(s * 0.05), 0.009, 0.007, 6), COL.frame));
    F.push(geom(new THREE.BoxGeometry(0.035, 0.03, 0.006), COL.chrome, mtx(P.rearHub.x, P.rearHub.y, s * 0.052)));
  }
  for (const p of [P.seat, ht0, ht1]) F.push(geom(new THREE.SphereGeometry(0.024, 8, 6), COL.chrome, mtx(p.x, p.y, p.z)));
  F.push(geom(new THREE.CylinderGeometry(0.025, 0.025, 0.085, 10).rotateX(Math.PI / 2), COL.chrome, mtx(P.bb.x, P.bb.y, 0)));
  F.push(geom(cylBetween(P.seat, P.saddle.clone().add(v3(0.005, -0.02, 0)), 0.012, 0.012, 6), COL.chrome));
  // the saddle: a sphere pressed into a sprung leather seat (upstream shape)
  const saddleGeo = new THREE.SphereGeometry(1, 16, 8); { const p = saddleGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nose = x > 0 ? 1 - 0.68 * Math.pow(x, 1.3) : 1 + 0.08 * x; p.setXYZ(i, x * 0.13, y * (y > 0 ? 0.03 : 0.012), z * 0.085 * nose); } saddleGeo.computeVertexNormals(); }
  F.push(geom(saddleGeo, COL.leather, mtx(P.saddle.x + 0.01, P.saddle.y + 0.018, 0)));
  for (const s of [-1, 1]) F.push(geom(new THREE.CylinderGeometry(0.012, 0.012, 0.045, 6), COL.chrome, mtx(P.saddle.x - 0.08, P.saddle.y - 0.017, s * 0.045)));
  // rear fender, cog, derailleur, a rear rack light
  const fender = (a0, len) => new THREE.CylinderGeometry(WHEEL_R + 0.022, WHEEL_R + 0.022, 0.055, 20, 1, true, a0, len).rotateX(Math.PI / 2);
  F.push(geom(fender(Math.PI * 0.72, Math.PI * 0.92), COL.cream, mtx(P.rearHub.x, P.rearHub.y, 0)));
  F.push(geom(new THREE.TorusGeometry(COG_R, 0.006, 4, 16), COL.chrome, mtx(P.rearHub.x, P.rearHub.y, 0.058)));
  F.push(geom(new THREE.BoxGeometry(0.02, 0.07, 0.012), COL.dark, mtx(P.rearHub.x + 0.005, P.rearHub.y - 0.07, 0.06, 0, 0, 0.3)));
  FL.push(geom(new THREE.BoxGeometry(0.02, 0.035, 0.03), COL.tail, mtx(P.seat.x - 0.025, P.seat.y, 0)));
  FL.push(geom(new THREE.BoxGeometry(0.006, 0.02, 0.05), COL.reflector, mtx(P.rearHub.x - WHEEL_R - 0.024, P.rearHub.y + 0.08, 0, 0, 0, 0.4)));
  const frameMesh = mesh(F, M.toon, 'ride:bike frame'), frameLights = mesh(FL, M.light, 'ride:bike lights');
  group.add(frameMesh, frameLights);

  // ---- wheels: tire, cream wall, rim, hub (one geometry, two meshes); spokes as ink (one line set, two objects)
  const wheelGeo = merge([geom(new THREE.TorusGeometry(WHEEL_R - 0.018, 0.018, 6, 36), COL.tire), geom(new THREE.TorusGeometry(WHEEL_R - 0.031, 0.011, 4, 36), COL.wall),
    geom(new THREE.TorusGeometry(WHEEL_R - 0.04, 0.007, 4, 36), COL.chrome), geom(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8).rotateX(Math.PI / 2), COL.chrome)]);
  const spokePts = []; for (let i = 0; i < 28; i++) { const side = i % 2 ? 1 : -1, lace = (Math.floor(i / 2) % 2 ? 1 : -1) * 0.42, ar = (i / 28) * TAU, ah = ar + lace; spokePts.push(Math.cos(ah) * 0.024, Math.sin(ah) * 0.024, side * 0.034, Math.cos(ar) * (WHEEL_R - 0.045), Math.sin(ar) * (WHEEL_R - 0.045), side * 0.004); }
  const spokeGeo = new THREE.BufferGeometry(); spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(spokePts, 3));
  const wheel = name => { const g = new THREE.Group(), rot = new THREE.Group(), m = new THREE.Mesh(wheelGeo, M.toon), l = new THREE.LineSegments(spokeGeo, M.spoke); m.name = name; l.name = name + ' spokes'; m.frustumCulled = l.frustumCulled = false; rot.add(m, l); g.add(rot); return { group: g, rot }; };
  const rear = wheel('ride:bike rear wheel'); rear.group.position.copy(P.rearHub); group.add(rear.group);

  // ---- chainring and cranks (one mesh, turns about the bottom bracket), pedals (one rig, kept level)
  const crank = new THREE.Group(); crank.position.copy(P.bb); group.add(crank);
  const C = [geom(new THREE.TorusGeometry(RING_R, 0.006, 4, 24), COL.chrome, mtx(0, 0, 0.065))];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; C.push(geom(new THREE.BoxGeometry(RING_R * 0.95, 0.012, 0.006), COL.chrome, mtx(Math.cos(a) * RING_R * 0.47, Math.sin(a) * RING_R * 0.47, 0.066, 0, 0, a))); }
  const arm = () => new THREE.BoxGeometry(CRANK, 0.022, 0.012).translate(CRANK / 2, 0, 0);
  C.push(geom(arm(), COL.chrome, mtx(0, 0, 0.078)), geom(arm(), COL.chrome, mtx(0, 0, -0.078, 0, 0, Math.PI)));
  const crankMesh = mesh(C, M.toon, 'ride:bike crank'); crank.add(crankMesh);
  const pedalPart = () => merge([geom(new THREE.BoxGeometry(0.085, 0.016, 0.075), COL.dark), geom(new THREE.BoxGeometry(0.01, 0.018, 0.04), COL.reflector, mtx(0.045, 0, 0)), geom(new THREE.BoxGeometry(0.01, 0.018, 0.04), COL.reflector, mtx(-0.045, 0, 0))]);
  const pedals = new Rig([pedalPart(), pedalPart()]), pedalMesh = new THREE.Mesh(pedals.geometry, M.toon); pedalMesh.name = 'ride:bike pedals'; pedalMesh.frustumCulled = false; group.add(pedalMesh);
  const pedalR = new THREE.Object3D(), pedalL = new THREE.Object3D(); group.add(pedalR, pedalL);

  // ---- chain: the upstream path (chainring front arc, lower run, cog arc, upper run) as one ink loop
  const chainGeo = (() => { const c1 = new THREE.Vector2(P.bb.x, P.bb.y), c2 = new THREE.Vector2(P.rearHub.x, P.rearHub.y), r1 = RING_R + 0.004, r2 = COG_R + 0.004, d = c1.distanceTo(c2), th = Math.atan2(c2.y - c1.y, c2.x - c1.x), be = Math.acos((r1 - r2) / d), topA = th - be, botA = th + be, pts = [];
    for (let i = 0; i <= 16; i++) { const a = topA + (botA - TAU - topA) * i / 16; pts.push([c1.x + Math.cos(a) * r1, c1.y + Math.sin(a) * r1]); }
    for (let i = 0; i <= 8; i++) { const a = botA + (topA - botA) * i / 8; pts.push([c2.x + Math.cos(a) * r2, c2.y + Math.sin(a) * r2]); }
    const seg = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; seg.push(a[0], a[1], 0.062, b[0], b[1], 0.062); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); return g; })();
  const chain = new THREE.LineSegments(chainGeo, M.ink); chain.name = 'ride:bike chain'; chain.frustumCulled = false; group.add(chain);

  // ---- steer assembly: fork, crown, front wheel, fender, stem, bar, grips, the basket and its bag, the lamp (turns about the head tube)
  const steer = new THREE.Group(); steer.position.copy(P.headBot); group.add(steer);
  const local = p => p.clone().sub(P.headBot), S = [], SL = [];
  for (const s of [-1, 1]) { const pts = [local(P.headBot.clone().addScaledVector(axis, -0.02)).setZ(s * 0.03), local(P.headBot.clone().addScaledVector(axis, -0.14)).setZ(s * 0.05), local(P.frontHub.clone().add(v3(-0.03, 0.06, 0))).setZ(s * 0.052), local(P.frontHub).setZ(s * 0.052)];
    S.push(geom(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.011, 6), COL.frame)); }
  { const c = local(P.headBot.clone().addScaledVector(axis, -0.03)); S.push(geom(new THREE.BoxGeometry(0.04, 0.03, 0.12), COL.chrome, mtx(c.x, c.y, c.z, 0, 0, Math.atan2(axis.y, axis.x) - Math.PI / 2))); }
  { const fh = local(P.frontHub); S.push(geom(fender(Math.PI * 0.5, Math.PI * 0.72), COL.cream, mtx(fh.x, fh.y, 0))); }
  const stemBase = P.headTop.clone().addScaledVector(axis, 0.02), stemTop = P.headTop.clone().addScaledVector(axis, 0.1), barC = stemTop.clone().add(v3(0.04, 0.012, 0));
  S.push(geom(cylBetween(local(stemBase), local(stemTop), 0.012, 0.012, 6), COL.chrome), geom(cylBetween(local(stemTop), local(barC), 0.011, 0.011, 6), COL.chrome));
  const barPts = [v3(0.19, 0.866, -0.255), v3(0.26, 0.866, -0.232), v3(0.315, 0.848, -0.13), v3(barC.x, barC.y, 0), v3(0.315, 0.848, 0.13), v3(0.26, 0.866, 0.232), v3(0.19, 0.866, 0.255)].map(local);
  S.push(geom(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(barPts, false, 'centripetal'), 24, 0.0105, 6), COL.chrome));
  const grips = {};
  for (const s of [-1, 1]) { S.push(geom(cylBetween(local(v3(0.255, 0.866, s * 0.234)), local(v3(0.185, 0.866, s * 0.256)), 0.016, 0.017, 6), COL.grip));
    const a = new THREE.Object3D(); a.position.copy(local(v3(0.222, 0.868, s * 0.245))); steer.add(a); grips[s > 0 ? 'R' : 'L'] = a; }
  // basket (wicker cone, rim) with the card's contents: a convenience-store bag and a leek
  { const b = local(v3(0.53, 0.78, 0)), bm = (x, y, z, rx = 0, ry = 0, rz = 0) => mtx(b.x + x, b.y + y, b.z + z, rx, ry, rz);
    S.push(geom(new THREE.CylinderGeometry(0.15, 0.125, 0.15, 12, 1, true), COL.wicker, bm(0, 0, 0)), geom(new THREE.CircleGeometry(0.125, 12).rotateX(-Math.PI / 2), COL.wickerDark, bm(0, -0.075, 0)),
      geom(new THREE.TorusGeometry(0.15, 0.008, 4, 16).rotateX(Math.PI / 2), COL.wickerDark, bm(0, 0.075, 0)));
    for (let i = 0; i < 3; i++) S.push(geom(new THREE.TorusGeometry(0.138 - i * 0.008, 0.003, 3, 16).rotateX(Math.PI / 2), COL.wickerDark, bm(0, 0.035 - i * 0.035, 0)));
    S.push(geom(new THREE.SphereGeometry(0.1, 10, 8).scale(0.9, 1.05, 0.8), COL.bag, bm(-0.01, 0.06, 0.02)), geom(new THREE.CylinderGeometry(0.081, 0.081, 0.02, 10), COL.bagStripe, bm(-0.01, 0.07, 0.02, 0, 0, 0)));
    S.push(geom(cylBetween(v3(0, 0, 0), v3(-0.06, 0.32, -0.05), 0.016, 0.014, 6), COL.leekWhite, bm(0.03, 0.04, -0.03)), geom(cylBetween(v3(-0.06, 0.32, -0.05), v3(-0.1, 0.46, -0.1), 0.014, 0.008, 6), COL.leek, bm(0.03, 0.04, -0.03))); }
  S.push(geom(cylBetween(local(v3(0.44, 0.66, 0)), local(v3(0.5, 0.71, 0)), 0.006, 0.006, 4), COL.chrome));
  // the lamp: chrome body, a self-lit lens (no light source)
  { const l = local(v3(0.695, 0.745, 0)); S.push(geom(new THREE.CylinderGeometry(0.03, 0.026, 0.055, 10).rotateZ(Math.PI / 2), COL.chrome, mtx(l.x, l.y, l.z))); SL.push(geom(new THREE.CircleGeometry(0.026, 10).rotateY(Math.PI / 2), COL.lamp, mtx(l.x + 0.029, l.y, l.z))); }
  const steerMesh = mesh(S, M.toon, 'ride:bike steer'), steerLights = mesh(SL, M.light, 'ride:bike lamp'); steer.add(steerMesh, steerLights);
  const front = wheel('ride:bike front wheel'); front.group.position.copy(local(P.frontHub)); steer.add(front.group);
  const _m = new THREE.Matrix4();
  // the per-frame update (upstream contract): wheel and crank angles, steering about the head tube, the pedals level at the crank ends
  function update({ wheelAngle, crankAngle, steerAngle }) {
    rear.rot.rotation.z = -wheelAngle; front.rot.rotation.z = -wheelAngle; crank.rotation.z = -crankAngle;
    pedalR.position.set(P.bb.x + Math.cos(-crankAngle) * CRANK, P.bb.y + Math.sin(-crankAngle) * CRANK, 0.125);
    pedalL.position.set(P.bb.x - Math.cos(-crankAngle) * CRANK, P.bb.y - Math.sin(-crankAngle) * CRANK, -0.125);
    pedals.set(0, _m.makeTranslation(pedalR.position.x, pedalR.position.y, pedalR.position.z)); pedals.set(1, _m.makeTranslation(pedalL.position.x, pedalL.position.y, pedalL.position.z)); pedals.commit();
    steer.quaternion.setFromAxisAngle(axis, steerAngle); steer.updateMatrix();
  }
  update({ wheelAngle: 0, crankAngle: 0, steerAngle: 0 });
  return { group, update, P, anchors: { gripL: grips.L, gripR: grips.R, pedalL, pedalR }, steerMatrix: () => steer.matrix, meshes: [frameMesh, frameLights, rear.rot.children[0], rear.rot.children[1], crankMesh, pedalMesh, chain, steerMesh, steerLights, front.rot.children[0], front.rot.children[1]] };
}

const RIDER_BICYCLE = { createBicycle, WHEEL_R, GEARS, CRANK, RING_R, COG_R, COL };
if (typeof module !== 'undefined' && module.exports) module.exports = RIDER_BICYCLE;
else global.RIDER_BICYCLE = RIDER_BICYCLE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
