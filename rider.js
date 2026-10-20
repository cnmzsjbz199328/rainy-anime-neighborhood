// R2 (docs/world/THIRD_PERSON_ROAM_PLAN.md 3, 6.5 attitude; design card docs/world/R2_RIDER_CARD.md): the visible rider, the ported pelican on the ported bicycle
// (rider_pelican.js, rider_bicycle.js, rider_util.js: riba2534/claude-opus-5-5-demo pelican-bike at commit 54adc1fb64155f9dd7c1c90ecae7b8185ac540b8).
// The animation coupling follows upstream main.js updateRide: the wheels turn at v / 0.3, an automatic gear keeps the cadence near 86 rpm while pedalling, the lean is
// atan(lateral acceleration / 9.8) x 1.4 within +-0.4 (lambda 7), the bars turn with lambda 10; here the lateral acceleration and the steering come from the kinematic bicycle
// of ride.js (yaw rate w: lean from v w, bars atan(0.94 w / v) within +-0.6), the pitch is the slope between the two wheel contacts, the rider stands on one foot when stopped
// and walks beside the bike pushing it on stairs and the steep boardwalk. Materials: the project's toon ramp and paper grain (vertex colours), ink lines, self-lit lamps, no
// light source. Everything is scaled by the display scale s of the surface under the rider. Built once, before the first frame (hidden until a ride starts).
// W9b (SPHERE_RIDING_PLAN 4.4): on the sphere and through a switch the rider is drawn by the shader's bend like the road under it (bend.js); its materials are noWrap,
// the rider's place being in the flat display frame already, so a bike whose ends lie on both sides of the seam is not cut into two halves a turn apart.
(function (global) {
'use strict';
function create(ctx) {
  const THREE = global.THREE, U = global.RIDER_UTIL, BK = global.RIDER_BICYCLE, PL = global.RIDER_PELICAN, { clamp, damp } = U;
  const M = {
    toon: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, map: ctx.paper }),
    toonDouble: new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ctx.ramp, map: ctx.paper, side: THREE.DoubleSide }),
    light: new THREE.MeshBasicMaterial({ vertexColors: true }),
    ink: new THREE.LineBasicMaterial({ color: ctx.inkColor, transparent: true, opacity: 0.68 }),
    spoke: new THREE.LineBasicMaterial({ color: '#3b4048', transparent: true, opacity: 0.5 }),
    hull: new THREE.MeshBasicMaterial({ color: ctx.inkColor, side: THREE.BackSide }),
  };
  for (const m of Object.values(M)) m.userData.noWrap = true;
  const root = new THREE.Group(); root.name = 'ride:rider'; root.visible = false;
  const frame = new THREE.Group(); frame.rotation.order = 'ZXY'; root.add(frame);
  const bike = BK.createBicycle(M), pelican = PL.createPelican(M);
  bike.group.position.x = -0.01;                      // the hubs at -0.47 and +0.47: the root is the middle of the two wheel contacts (ride.js)
  frame.add(bike.group, pelican.root);
  const PUSH = [-0.05, 0, -0.5];                       // pushing: the pelican walks on the bike's left
  const st = { wheel: 0, crank: 0, gear: 2, lean: 0, steer: 0, pitch: 0, heading: null, stopK: 0, pushK: 0, walk: 0, mode: 'ride', omega: 0 };
  const V = { gripL: new THREE.Vector3(), gripR: new THREE.Vector3(), pedalL: new THREE.Vector3(), pedalR: new THREE.Vector3(), foot: new THREE.Vector3(), standGrip: new THREE.Vector3(), tmp: new THREE.Vector3() };
  const wpi = a => Math.atan2(Math.sin(a), Math.cos(a));
  // r: the ride's state (ride.get()): x, root, z, heading, speed, mode, s, wheels [front, rear], lookYaw, throttle
  function update(dt, r) {
    const s = r.s || 1, v = r.speed;
    const w = st.heading === null || dt <= 0 ? 0 : wpi(r.heading - st.heading) / dt; st.heading = r.heading; st.omega = damp(st.omega, w, 12, dt);
    const push = r.mode === 'push'; st.mode = r.mode;
    // wheels and cranks (upstream: auto gear for ~86 rpm, the crank turns only while pedalling)
    st.wheel += v / BK.WHEEL_R * dt;
    const rpm = Math.abs(v) / BK.WHEEL_R * 60 / (2 * Math.PI); let best = st.gear, err = 1e9; BK.GEARS.forEach(([a, b], i) => { const e = Math.abs(rpm / (a / b) - 86); if (e < err) { err = e; best = i; } });
    const cur = rpm / (BK.GEARS[st.gear][0] / BK.GEARS[st.gear][1]); if (best !== st.gear && (cur > 102 || cur < 68)) st.gear += Math.sign(best - st.gear);
    const pedalling = !push && v > 0.25 && (r.throttle || 0) >= 0;
    st.crank += pedalling ? v / BK.WHEEL_R / (BK.GEARS[st.gear][0] / BK.GEARS[st.gear][1]) * dt : 0;
    // attitude: lean into the turn (lateral acceleration v w; a left turn has w > 0 and leans left: negative about the bike's forward axis), the bars, one foot down when stopped
    st.stopK = damp(st.stopK, !push && Math.abs(v) < (st.stopK > 0.5 ? 0.5 : 0.3) ? 1 : 0, 8, dt);
    st.pushK = damp(st.pushK, push ? 1 : 0, 8, dt);
    const leanT = push ? 0 : clamp(Math.atan(-v * st.omega / 9.8) * 1.4, -0.4, 0.4) * (1 - st.stopK) - 0.08 * st.stopK;
    st.lean = damp(st.lean, leanT, 7, dt);
    const sv = Math.abs(v) < 1e-6 ? 1 : Math.sign(v);
    st.steer = damp(st.steer, clamp(Math.atan(0.94 * st.omega / (Math.max(Math.abs(v), 0.5) * sv)), -0.6, 0.6), 10, dt);
    st.pitch = Math.atan2(r.wheels[0] - r.wheels[1], 0.94 * s);
    root.position.set(r.x, r.root, r.z); root.rotation.y = r.heading - Math.PI / 2; root.scale.setScalar(s);
    frame.rotation.set(st.lean, 0, st.pitch);
    bike.update({ wheelAngle: st.wheel, crankAngle: st.crank, steerAngle: st.steer });
    // the pelican: on the saddle, or walking beside the bike
    const off = st.pushK > 0.5 ? PUSH : [0, 0, 0]; pelican.root.position.set(off[0], off[1], off[2]);
    const sm = bike.steerMatrix(), bo = bike.group.position, rel = p => p.add(bo).sub(pelican.root.position);
    rel(V.gripL.copy(bike.anchors.gripL.position).applyMatrix4(sm)); rel(V.gripR.copy(bike.anchors.gripR.position).applyMatrix4(sm));
    rel(V.pedalL.copy(bike.anchors.pedalL.position)); rel(V.pedalR.copy(bike.anchors.pedalR.position));
    V.standGrip.copy(bike.anchors.gripL.position).applyMatrix4(sm).add(bo).sub(pelican.root.position);
    // the left foot: from its pedal to a ground point beside the bike (the bike leans 0.08 rad toward it)
    let footDown = null; if (st.stopK > 0.01) { V.tmp.set(V.pedalL.x - 0.04, V.pedalL.y + 0.046, V.pedalL.z * 0.92); V.foot.set(-0.05, 0.064, -0.3).sub(pelican.root.position); footDown = V.tmp.lerp(V.foot, st.stopK).clone(); }
    st.walk += push ? Math.abs(v) * dt : 0;
    pelican.update(dt, { t: (st.t = (st.t || 0) + dt), crankAngle: st.crank, pedal: pedalling ? 1 : 0.3, mode: st.pushK > 0.5 ? 'push' : 'ride', stop: st.stopK, grips: { L: V.gripL, R: V.gripR }, pedals: { L: V.pedalL, R: V.pedalR }, footDown, walk: st.walk, lookYaw: r.lookYaw, standGrip: V.standGrip });
  }
  const meshes = [...bike.meshes, ...pelican.meshes];
  function stats() { let tris = 0; for (const m of meshes) { if (!m.isMesh) continue; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } return { drawCalls: meshes.length, meshes: meshes.filter(m => m.isMesh).length, lines: meshes.filter(m => m.isLineSegments).length, triangles: Math.round(tris) }; }
  // the rider's measures for the checks (K9): height above the root, the left foot above the ground, the wheels' bottoms, the angles
  const _b = new THREE.Box3(), _p = new THREE.Vector3();
  function get() {
    root.updateMatrixWorld(true); _b.makeEmpty(); for (const m of meshes) if (m.isMesh) _b.expandByObject(m, true);
    const s = root.scale.x, foot = st.stopK > 0.9 ? (() => { const g = pelican.state.footY, p = _p.set(-0.05, g, -0.3 - (pelican.root.position.z || 0)); return p.applyMatrix4(frame.matrixWorld).y - root.position.y; })() : null;
    const hubs = [[-0.47, 0], [0.47, 0]].map(([x]) => _p.set(x, 0, 0).applyMatrix4(frame.matrixWorld).y - root.position.y);
    return { visible: root.visible, height: (_b.max.y - root.position.y) / s, footDown: st.stopK > 0.9, footY: foot === null ? null : foot / s, wheelBottoms: hubs.map(h => h / s), wheel: st.wheel, crank: st.crank, gear: st.gear, lean: st.lean, steer: st.steer, pitch: st.pitch, omega: st.omega, mode: st.mode, stopK: st.stopK, pushK: st.pushK, ...stats() };
  }
  return { root, update, get, stats, bike, pelican, materials: M, state: st };
}
const RIDER = { create };
if (typeof module !== 'undefined' && module.exports) module.exports = RIDER;
else global.RIDER = RIDER;
})(typeof globalThis !== 'undefined' ? globalThis : this);
