// LM09 乡间无人站 (an unmanned country station) (W7). Local frame: origin = the site anchor (18.00 S 40.00 W, altitude 1.8 m, a levelled platform of radius 10 m), +Z towards the north
// entrance (heading 0, 13.35 m out: a point of the T01 trunk road, where T05-01 also ends), +X to the left of +Z. 1 unit = 1 m. From the road a 3.35 m station lane leads to a bus turning circle
// (12 m across, with a stop sign and a shelter light) and on to the platform (20 m long, yellow tactile strip, one side) with the timber waiting shed (4 x 2.5 m, bench, timetable, one lamp),
// a vending machine, a bicycle rack, a phone box; one cream-and-red single diesel car stands still on the only track, which runs a short way east to a buffer and west into the paddy and ends
// there (D6: no railway network); a foot crossing with a warning light that alternates very slowly. Groups: lm09Ground, lm09Platform, lm09Shed, lm09Track, lm09Car, lm09Street, lm09Live.
(globalThis.LANDMARKS = globalThis.LANDMARKS || {}).LM09 = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm } = K, L = LMLIB(K), PI = Math.PI, rnd = K.rand(909);
  const out = { stats: {}, update() {} };
  const gr = group('lm09Ground'); L.use(gr);
  L.ground(10.6, '#5d7658', 0.02);
  box(0, 0.06, 9.2, 2.6, 0.1, 8.6, '#8a8d90', true, gr);                                      // station lane from the road (z 13.35) down to the turning circle
  const cd = L.ground(6.0, '#767a7e', 0.05); cd.position.z = 1.0; const cg = mesh(new THREE.RingGeometry(5.6, 6.0, 40), mat('#a8a8a0'), 0, 0.08, 1.0, false, gr); cg.rotation.x = -PI / 2;
  box(0, 0.06, -1.6, 2.4, 0.1, 2.4, '#8a8d90', true, gr);                                      // the way from the circle to the platform
  // ---- platform: 20 m long (x -10..10), 3 m wide (z -5.2..-2.2), height 0.9 m, tactile strip along the track edge
  const pf = group('lm09Platform'); L.use(pf);
  box(0, 0.45, -3.7, 20, 0.9, 3.0, '#8d9094', true, pf); box(0, 0.92, -4.95, 20, 0.04, 0.45, '#d8b84a', false, pf);
  for (let i = 0; i < 40; i++) box(-9.75 + i * 0.5, 0.93, -4.95, 0.12, 0.02, 0.4, '#bf9f38', false, pf);
  for (let i = 0; i < 5; i++) box(0, 0.09 + 0.18 * i, -1.9 + 0.0 - 0.0, 2.4, 0.18, 0.3, '#8d9094', true, pf).position.z = -1.5 - 0.3 * i + 0.0;       // five slope steps up from the lane (stepless ramp is on the other side)
  // ---- waiting shed 4 x 2.5 m on the platform (west end), bench, timetable, lamp
  const sh = group('lm09Shed'); L.use(sh); const SX = -5.5, SZ = -3.7;
  box(SX, 0.9 + 1.2, SZ, 4.0, 2.4, 2.5, '#7a5f48', true, sh); box(SX, 0.9 + 1.2, SZ + 1.26, 3.2, 1.7, 0.06, '#2c2420', false, sh);        // open front (dark inside)
  mesh(new THREE.BoxGeometry(2.6, 0.5, 0.05), warm('#ffcf8a', 0.3), SX, 0.9 + 1.65, SZ + 1.22, false, sh);                                  // lit window strip
  L.gable(4.0, 2.5, 0.9 + 2.4, 0.9, 0.5, '#4a4f58', sh).position.set(SX, 0, SZ); box(SX, 0.9 + 0.45, SZ + 0.7, 2.6, 0.08, 0.4, '#6a5240', true, sh); box(SX, 0.9 + 0.2, SZ + 0.7, 2.4, 0.4, 0.08, '#5a4a3c', false, sh);
  box(SX + 1.5, 0.9 + 1.4, SZ + 1.28, 0.6, 0.8, 0.04, '#e8e4d8', false, sh);                                                                     // timetable board
  const lampM = mesh(new THREE.SphereGeometry(0.16, 8, 6), warm('#ffe0a0', 0.6), SX, 0.9 + 2.1, SZ + 1.5, false, sh); cyl(SX, 0.9 + 1.05, SZ + 1.5, 0.04, 2.1, '#5a4a3c', sh);
  box(SX, 0.9 + 2.52, SZ + 0.0, 4.2, 0.12, 0.2, '#3a2d24', true, sh);                                                                           // fascia with the (original) station name board
  box(SX + 4.5, 0.9 + 1.0, SZ + 1.0, 0.04, 0.5, 1.4, '#f2f4f6', false, sh);
  // ---- vending machine, bicycle rack, phone box, bus stop and shelter light
  const st = group('lm09Street'); L.use(st);
  box(1.8, 0.9 + 0.9, -3.0, 0.9, 1.8, 0.8, '#5e6a74', true, st); mesh(new THREE.BoxGeometry(0.7, 1.3, 0.03), warm('#dfe9f2', 0.20), 1.8, 0.9 + 1.0, -2.58, false, st);
  for (let i = 0; i < 6; i++) { box(5.0 + i * 0.4, 0.3, -1.0, 0.04, 0.6, 0.04, '#7d8794', false, st); box(5.0 + i * 0.4, 0.04, -1.0, 0.04, 0.04, 0.9, '#7d8794', false, st); }
  for (let i = 0; i < 4; i++) { const b = mesh(new THREE.TorusGeometry(0.28, 0.025, 5, 12), mat('#2a2e34'), 5.2 + i * 0.8, 0.32, -1.0, false, st); b.rotation.y = PI / 2; const b2 = mesh(new THREE.TorusGeometry(0.28, 0.025, 5, 12), mat('#2a2e34'), 5.2 + i * 0.8, 0.32, -0.55, false, st); b2.rotation.y = PI / 2; box(5.2 + i * 0.8, 0.55, -0.78, 0.04, 0.04, 0.6, '#c0552e', false, st); }
  box(7.2, 1.15, 5.0, 1.0, 2.3, 1.0, '#c4412e', true, st); mesh(new THREE.BoxGeometry(0.8, 1.6, 0.04), warm('#e8eef0', 0.22), 7.2, 1.25, 5.52, false, st);         // phone box
  cyl(-3.0, 1.2, 9.0, 0.035, 2.4, '#7d8794', st); box(-3.0, 2.3, 9.0, 0.5, 0.34, 0.03, '#e8ecf2', false, st); box(-3.0, 2.48, 9.02, 0.5, 0.06, 0.03, '#d58a3a', false, st);   // bus stop sign
  cyl(3.0, 2.6, 8.0, 0.06, 5.2, '#596f80', st); const hd = mesh(new THREE.BoxGeometry(0.6, 0.12, 0.3), warm('#ffe4b0', 0.8), 3.4, 5.1, 8.0, false, st); cyl(3.2, 5.1, 8.0, 0.04, 0.5, '#596f80', st).rotation.z = PI / 2;
  L.pool(3.4, 8.0, 3.0, '#ffcf8a', 0.06, 0.08); L.pool(-5.5, -1.5, 3.0, '#ffcf8a', 0.05, 0.08); L.pool(1.8, -1.2, 2.2, '#dfe9f2', 0.05, 0.08);
  // ---- the track: one line along X at z = -6.4, sleepers every 0.7 m, two rails, ballast; from x -13 (the paddy end) to x +11 (buffer stop); the diesel car; a foot crossing at x = 8.6
  const tk = group('lm09Track'); L.use(tk);
  box(0, 0.06, -6.4, 22, 0.12, 1.9, '#7a7872', false, tk).position.x = -0.5; for (let x = -10.9; x <= 10.4; x += 0.7) box(x, 0.15, -6.4, 0.2, 0.08, 1.5, '#4a382b', false, tk);
  for (const dz of [-0.72, 0.72]) box(-0.5, 0.22, -6.4 + dz, 22, 0.08, 0.07, '#7d8794', false, tk);
  box(10.8, 0.4, -6.4, 0.3, 0.6, 1.6, '#c4412e', true, tk);                                                                                  // buffer stop
  for (let i = 0; i < 2; i++) { const x = -11.5 - i * 0.7; box(x, 0.1 - 0.03 * i, -6.4, 0.7, 0.1, 1.9 - 0.4 * i, '#59634c', false, tk); }                       // the ballast fades into the paddy: the line ends
  for (let x = 7.6; x <= 9.6; x += 0.5) box(x, 0.2, -6.4, 0.4, 0.06, 1.8, '#6a5240', true, tk);                                              // foot crossing planks
  const car = group('lm09Car'); L.use(car);
  const CZ = -6.4, CL = 13.0, CX = -1.5;
  box(CX, 1.5, CZ, CL, 2.5, 2.6, '#e6dcc2', true, car); box(CX, 1.0, CZ, CL + 0.02, 0.45, 2.64, '#8a2f3a', false, car);
  for (let i = 0; i < 7; i++) mesh(new THREE.BoxGeometry(1.0, 0.8, 2.66), warm('#ffe0a0', 0.05), CX - 5.2 + i * 1.7, 1.9, CZ, false, car);        // dark windows (the car is unlit)
  box(CX, 2.85, CZ, CL - 0.6, 0.2, 2.3, '#9a968c', true, car); for (const bx of [CX - 4.6, CX + 4.6]) for (const dz of [-0.9, 0.9]) cyl(bx, 0.45, CZ + dz, 0.45, 0.4, '#2a2e34', car).rotation.x = PI / 2;
  mesh(new THREE.BoxGeometry(0.1, 0.5, 1.4), warm('#ffe8b0', 0.1), CX + CL / 2 + 0.04, 1.9, CZ, false, car);                                          // headlamp (dark)
  // ---- crossing warning posts (live: the two lamps alternate with a period of 6 s, soft ramps)
  const lv = group('lm09Live'); L.use(lv);
  const posts = [[8.0, -4.6], [9.3, -8.2]].map(([x, z]) => { box(x, 0.9, z, 0.08, 1.8, 0.08, '#e8e4d8', true, lv); const a = mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: '#d28d8e' }), x - 0.14, 1.65, z, false, lv), b = mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: '#d28d8e' }), x + 0.14, 1.65, z, false, lv); return [a, b]; });
  // eave drips (live)
  const dr = []; for (let i = 0; i < 6; i++) { const g = L.sub(SX - 1.5 + i * 0.6, 3.2, SZ + 1.4); g.userData.live = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.28), new THREE.MeshBasicMaterial({ color: '#cfe4ee', transparent: true, opacity: 0.7, depthWrite: false })); g.add(m); dr.push({ g, m, ph: i * 0.17 }); }
  out.stats = { platformLength: 20, shed: [4, 2.5], circle: 12, cars: 1, tracks: 1, trackEnds: 2, lights: 4, lampsOn: 3 };
  out.update = (t) => {
    const p = (t % 6) / 6, a = 0.5 - 0.5 * Math.cos(p * PI * 2), b = 1 - a;                                       // 6 s period, raised cosine: no flashing
    posts.forEach(([l, r]) => { l.material.color.setRGB(0.35 + 0.65 * a, 0.12 + 0.12 * a, 0.12 + 0.12 * a); r.material.color.setRGB(0.35 + 0.65 * b, 0.12 + 0.12 * b, 0.12 + 0.12 * b); });
    dr.forEach(d => { const q = (t * 0.9 + d.ph) % 1; d.g.position.y = 3.2 - q * 2.2; d.m.material.opacity = 0.7 * (q < 0.9 ? 1 : (1 - q) * 10); });
  };
  return out;
};
