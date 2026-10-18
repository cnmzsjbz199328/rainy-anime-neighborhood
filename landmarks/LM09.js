// LM09 乡间无人站 (an unmanned country station) (W7). Local frame: origin = the site anchor (18.00 S 40.00 W, altitude 1.8 m, a levelled platform of radius 10 m), +Z towards the north
// entrance (heading 0, 13.35 m out: a point of the RN01 trunk road; T05-01 also ended here until W10b retired it), +X to the left of +Z. 1 unit = 1 m. From the road a 3.35 m station lane leads to a bus turning circle
// (12 m across, with a stop sign and a shelter light) and on to the platform (15.5 m long after W10b decision A, yellow tactile strip, one side) with the timber waiting shed (4 x 2.5 m, bench, timetable, one lamp),
// a vending machine, a bicycle rack, a phone box; one cream-and-red single diesel car stands still on the only track, which stops at a buffer west of CR01 and extends west into the paddy and ends
// there (D6: no railway network); a foot crossing with a warning light that alternates very slowly. Groups: lm09Ground, lm09Platform, lm09Shed, lm09Track, lm09Car, lm09Street, lm09Live.
(globalThis.LANDMARKS = globalThis.LANDMARKS || {}).LM09 = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm } = K, L = LMLIB(K), PI = Math.PI, rnd = K.rand(909);
  const out = { stats: {}, update() {} };
  const gr = group('lm09Ground'); L.use(gr);
  // W8f-c G2: trim the north side of the site lawn before the T01 curb; the entrance lane still reaches the road centreline.
  const lawnR = 10.6, lawnNorth = 7.4, cut = Math.acos(lawnNorth / lawnR), boundary = [];
  for (let i = 0; i <= 40; i++) { const a = cut + (2 * PI - 2 * cut) * i / 40; boundary.push([lawnR * Math.sin(a), 0.02, lawnR * Math.cos(a)]); }
  const lawnGeo = new THREE.BufferGeometry(), lawnPos = [0, 0.02, 0], lawnIdx = [];
  boundary.forEach(p => lawnPos.push(...p));
  for (let i = 0; i < boundary.length; i++) lawnIdx.push(0, i + 1, (i + 1) % boundary.length + 1);
  lawnGeo.setAttribute('position', new THREE.Float32BufferAttribute(lawnPos, 3)); lawnGeo.setIndex(lawnIdx); lawnGeo.computeVertexNormals();
  mesh(lawnGeo, mat('#5d7658'), 0, 0, 0, false, gr);
  box(0, 0.06, 9.2, 2.6, 0.1, 8.6, '#8a8d90', true, gr);                                      // station lane from the road (z 13.35) down to the turning circle
  const cd = L.ground(6.0, '#767a7e', 0.05); cd.position.z = 1.0; const cg = mesh(new THREE.RingGeometry(5.6, 6.0, 40), mat('#a8a8a0'), 0, 0.08, 1.0, false, gr); cg.rotation.x = -PI / 2;
  box(0, 0.06, -1.6, 2.4, 0.1, 2.4, '#8a8d90', true, gr);                                      // the way from the circle to the platform
  // W10b decision A: CR01 keeps its approved line. W10d choice C ends the platform 0.15 m clear of the N11 road edge: x -4.54..10 (14.54 m total).
  // ---- platform: 14.54 m long (x -4.54..10), 3 m wide (z -5.2..-2.2), height 0.9 m, tactile strip along the track edge
  const pf = group('lm09Platform'); L.use(pf);
  const PLATFORM_LENGTH = 14.54, PLATFORM_X = 10 - PLATFORM_LENGTH / 2, PLATFORM_MIN_X = PLATFORM_X - PLATFORM_LENGTH / 2;
  box(PLATFORM_X, 0.45, -3.7, PLATFORM_LENGTH, 0.9, 3.0, '#8d9094', true, pf); box(PLATFORM_X, 0.92, -4.95, PLATFORM_LENGTH, 0.04, 0.45, '#d8b84a', false, pf);
  for (let x = PLATFORM_MIN_X + 0.25; x <= 10 - 0.25 + 1e-6; x += 0.5) box(x, 0.93, -4.95, 0.12, 0.02, 0.4, '#bf9f38', false, pf);
  for (const z of [-5.12, -2.29]) box(PLATFORM_X, 0.88, z, PLATFORM_LENGTH - 0.04, 0.1, 0.12, '#a9a8a2', true, pf); // cast edge caps
  for (let i = 1; i < 13; i++) box(PLATFORM_MIN_X + i * (PLATFORM_LENGTH / 13), 0.86, -2.25, 0.025, 0.1, 0.055, '#666b6d', false, pf); // expansion joints
  for (const x of [-3.8, 0.6, 5.0, 9.1]) {
    box(x, 0.2, -2.205, 0.44, 0.16, 0.05, '#4f5555', false, pf); // drainage outlets below the rear cap
    box(x, 0.13, -2.32, 0.54, 0.055, 0.22, '#74787a', false, pf);
  }
  for (let i = 0; i < 5; i++) box(0, 0.09 + 0.18 * i, -1.9 + 0.0 - 0.0, 2.4, 0.18, 0.3, '#8d9094', true, pf).position.z = -1.5 - 0.3 * i + 0.0;       // five slope steps up from the lane (stepless ramp is on the other side)
  // ---- waiting shed 4 x 2.5 m on the platform, moved 3 m west to keep the shelter behind the road edge
  const sh = group('lm09Shed'); L.use(sh); const SX = -2.5, SZ = -3.7;
  // Open timber frame. The platform, posts and roof stay inside the approved 4 x 2.5 m shed envelope.
  box(SX, 0.96, SZ, 3.9, 0.12, 2.4, '#67645e', true, sh); // raised floor, visible at the entrance
  for (const x of [SX - 1.85, SX + 1.85]) for (const z of [SZ - 1.1, SZ + 1.1]) {
    box(x, 2.08, z, 0.16, 2.25, 0.16, '#674b37', true, sh);
    box(x, 1.01, z, 0.27, 0.12, 0.27, '#898884', true, sh); // post shoe
  }
  box(SX, 2.08, SZ - 1.15, 3.75, 2.1, 0.1, '#846c54', true, sh); // back wall
  for (let i = 1; i < 13; i++) box(SX - 1.85 + i * 0.285, 2.08, SZ - 1.087, 0.014, 2.05, 0.012, '#604b3c', false, sh);
  for (const x of [SX - 1.85, SX + 1.85]) {
    box(x, 2.75, SZ, 0.09, 0.1, 2.28, '#594432', true, sh); // side rails
    box(x, 1.25, SZ - 0.73, 0.08, 0.45, 0.7, '#6e5741', true, sh); // short rear windscreen
  }
  const ROOF_X = SX + 0.06, ROOF_W = 3.88; // W10d: trim the east eave by 0.12 m at the N11 side
  for (const z of [SZ - 1.08, SZ + 1.08]) box(ROOF_X, 3.23, z, ROOF_W - 0.08, 0.15, 0.16, '#594432', true, sh);
  for (const x of [SX - 1.82, SX, SX + 1.82]) box(x, 3.27, SZ, 0.09, 0.12, 2.4, '#594432', true, sh); // exposed rafters
  L.gable(ROOF_W, 2.5, 3.3, 0.9, 0.48, '#4a4f58', sh).position.set(ROOF_X, 0, SZ);
  box(ROOF_X, 3.23, SZ + 1.26, ROOF_W - 0.04, 0.15, 0.1, '#3a2d24', true, sh); // fascia
  box(ROOF_X, 3.13, SZ - 1.28, ROOF_W - 0.2, 0.11, 0.12, '#6b7076', true, sh); // rear rain gutter
  cyl(SX + 1.82, 1.98, SZ - 1.27, 0.05, 2.0, '#6b7076', sh); // downpipe
  // Bench: legs, seat, back and clear walking space in front.
  for (const x of [SX - 1.23, SX + 1.23]) for (const z of [SZ - 0.8, SZ - 0.27]) box(x, 1.17, z, 0.1, 0.34, 0.1, '#594432', true, sh);
  for (let i = 0; i < 3; i++) box(SX, 1.35, SZ - 0.8 + i * 0.25, 2.65, 0.08, 0.19, '#76583e', true, sh);
  for (let i = 0; i < 2; i++) box(SX, 1.68 + i * 0.22, SZ - 0.99, 2.65, 0.16, 0.08, '#76583e', true, sh);
  const signTex = K.canvasTex(256, 64, (q, w, h) => { q.fillStyle = '#eee9dc'; q.fillRect(0, 0, w, h); q.fillStyle = '#354b56'; q.font = 'bold 38px sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('雨田駅', w / 2, h / 2); });
  mesh(new THREE.PlaneGeometry(1.45, 0.35), new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide }), SX, 3.02, SZ + 1.322, false, sh);
  box(SX + 1.28, 2.14, SZ - 1.01, 0.62, 0.88, 0.08, '#e8e4d8', true, sh); // timetable on the back wall
  for (let i = 0; i < 7; i++) box(SX + 1.27, 2.45 - i * 0.1, SZ - 0.961, 0.46, 0.014, 0.006, '#7d8794', false, sh);
  box(SX - 1.38, 1.47, SZ - 1.0, 0.55, 0.78, 0.24, '#6d6253', true, sh); // ticket box
  box(SX - 1.38, 1.88, SZ - 0.86, 0.4, 0.035, 0.06, '#2a2e34', false, sh);
  const lampM = mesh(new THREE.SphereGeometry(0.16, 8, 6), warm('#ffe0a0', 0.6), SX, 3.06, SZ, false, sh);
  // ---- vending machine, bicycle rack, phone box, bus stop and shelter light
  const st = group('lm09Street'); L.use(st);
  // Serviceable vending machine, facing +Z. All controls are geometry; small product labels can use texture later.
  const VX = 1.8, VZ = -3.0;
  box(VX, 1.8, VZ, 0.9, 1.8, 0.8, '#5e6a74', true, st);
  box(VX, 0.92, VZ, 1.0, 0.04, 0.85, '#7d8084', true, st); // anchored plinth
  box(VX - 0.07, 2.06, VZ + 0.41, 0.67, 1.1, 0.04, '#dfe9f2', true, st);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    box(VX - 0.31 + col * 0.16, 2.42 - row * 0.25, VZ + 0.435, 0.1, 0.17, 0.025, row === 1 ? '#bbd0d9' : '#d9a873', false, st);
    box(VX - 0.31 + col * 0.16, 2.31 - row * 0.25, VZ + 0.452, 0.09, 0.025, 0.02, '#344b57', false, st);
  }
  box(VX + 0.34, 2.12, VZ + 0.45, 0.14, 0.42, 0.04, '#445760', true, st); // payment panel
  box(VX + 0.34, 2.28, VZ + 0.48, 0.07, 0.035, 0.02, '#e8d9b5', false, st); // coin slot
  box(VX + 0.34, 2.03, VZ + 0.48, 0.08, 0.08, 0.02, '#8fb6bb', false, st); // card reader
  box(VX - 0.12, 1.22, VZ + 0.45, 0.56, 0.25, 0.04, '#273843', true, st); // delivery opening
  box(VX + 0.34, 1.31, VZ + 0.46, 0.13, 0.11, 0.02, '#7d8794', true, st); // change return
  box(VX - 0.46, 1.8, VZ + 0.05, 0.025, 1.62, 0.06, '#344b57', false, st); // service door hinge
  for (let i = 0; i < 5; i++) box(VX, 1.27 + i * 0.09, VZ - 0.406, 0.52, 0.018, 0.015, '#344b57', false, st); // rear vent
  box(VX + 0.31, 1.23, VZ - 0.405, 0.26, 0.21, 0.02, '#45545b', true, st); // rear power access
  box(VX + 0.31, 1.12, VZ - 0.42, 0.17, 0.035, 0.025, '#a8a39a', false, st);
  box(VX + 0.31, 0.99, VZ - 0.39, 0.08, 0.25, 0.08, '#586369', true, st); // conduit into the anchored plinth
  const tube = (a, b, r, color, parent = st) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = new THREE.Vector3().subVectors(B, A); const m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), mat(color), (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, false, parent); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  // Parked bicycles and anchored U-racks; the racks still occupy the same small paved bay.
  for (let i = 0; i < 6; i++) {
    const x = 5.0 + i * 0.4;
    for (const z of [-1.29, -0.31]) box(x, 0.07, z, 0.14, 0.14, 0.16, '#777f81', true, st);
    box(x, 0.37, -0.8, 0.04, 0.58, 0.04, '#7d8794', false, st);
    box(x, 0.65, -0.8, 0.04, 0.04, 0.96, '#7d8794', false, st);
  }
  for (let i = 0; i < 4; i++) {
    const x = 5.2 + i * 0.8, front = -1.27, rear = -0.33, c = i % 2 ? '#63787a' : '#a45744';
    for (const z of [front, rear]) { const wheel = mesh(new THREE.TorusGeometry(0.27, 0.025, 5, 12), mat('#2a2e34'), x, 0.32, z, false, st); wheel.rotation.y = PI / 2; cyl(x, 0.32, z, 0.045, 0.08, '#6b7076', st).rotation.z = PI / 2; }
    tube([x, 0.33, front], [x, 0.7, -0.72], 0.024, c);
    tube([x, 0.7, -0.72], [x, 0.33, rear], 0.024, c);
    tube([x, 0.33, rear], [x, 0.63, -0.51], 0.024, c);
    tube([x, 0.63, -0.51], [x, 0.7, -0.72], 0.024, c);
    tube([x, 0.7, -0.72], [x, 0.86, -0.87], 0.02, '#50575b'); // handle stem
    box(x, 0.86, -0.88, 0.32, 0.035, 0.04, '#50575b', false, st);
    box(x, 0.68, -0.48, 0.23, 0.04, 0.12, '#35383a', false, st); // saddle
  }
  // Telephone booth: red frame with transparent panes and a real handset behind the glass.
  const PX = 7.2, PZ = 5.0;
  box(PX, 0.08, PZ, 1.0, 0.16, 1.0, '#7d8084', true, st);
  for (const x of [PX - 0.45, PX + 0.45]) for (const z of [PZ - 0.45, PZ + 0.45]) box(x, 1.16, z, 0.09, 2.17, 0.09, '#a53b33', true, st);
  box(PX, 2.25, PZ, 1.0, 0.15, 1.0, '#a53b33', true, st);
  box(PX, 2.02, PZ + 0.46, 0.9, 0.12, 0.07, '#a53b33', true, st);
  box(PX, 0.2, PZ + 0.47, 0.9, 0.1, 0.06, '#a53b33', true, st);
  const boothGlass = new THREE.MeshPhysicalMaterial({ color: '#d9e5e7', transparent: true, opacity: 0.15, roughness: 0.13, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  for (const x of [PX - 0.43, PX + 0.43]) mesh(new THREE.PlaneGeometry(0.85, 1.73), boothGlass, x, 1.13, PZ, false, st).rotation.y = PI / 2;
  mesh(new THREE.PlaneGeometry(0.84, 1.73), boothGlass, PX, 1.13, PZ - 0.43, false, st);
  mesh(new THREE.PlaneGeometry(0.84, 1.72), boothGlass, PX, 1.13, PZ + 0.46, false, st);
  box(PX + 0.27, 1.08, PZ + 0.495, 0.04, 0.16, 0.07, '#e8e4d8', true, st); // door handle
  box(PX, 1.38, PZ - 0.33, 0.64, 0.9, 0.15, '#45545b', true, st); // telephone body
  box(PX, 0.94, PZ - 0.23, 0.66, 0.055, 0.37, '#6b7076', true, st); // writing shelf below the controls
  box(PX, 1.25, PZ - 0.24, 0.38, 0.22, 0.05, '#e8e4d8', true, st); // dial/keypad face
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) box(PX - 0.1 + col * 0.1, 1.28 - row * 0.07, PZ - 0.205, 0.04, 0.04, 0.015, '#6c7377', false, st);
  box(PX - 0.13, 1.65, PZ - 0.2, 0.28, 0.09, 0.1, '#252c31', true, st); // handset
  cyl(PX - 0.27, 1.56, PZ - 0.21, 0.025, 0.18, '#252c31', st);
  for (let i = 0; i < 8; i++) {
    const a = i * PI * 2 / 7;
    tube([PX - 0.26 + 0.035 * Math.sin(a), 1.52 - i * 0.055, PZ - 0.22 + 0.035 * Math.cos(a)],
      [PX - 0.26 + 0.035 * Math.sin(a + PI * 2 / 7), 1.465 - i * 0.055, PZ - 0.22 + 0.035 * Math.cos(a + PI * 2 / 7)], 0.012, '#252c31');
  }
  box(PX - 0.39, 0.48, PZ + 0.46, 0.05, 0.16, 0.05, '#852e2b', true, st); // door lower hinge
  box(PX - 0.39, 1.89, PZ + 0.46, 0.05, 0.16, 0.05, '#852e2b', true, st); // door upper hinge
  box(PX, 1.06, PZ - 0.48, 0.62, 0.37, 0.025, '#8c3832', true, st); // rear service hatch
  box(PX + 0.21, 1.06, PZ - 0.5, 0.055, 0.07, 0.018, '#d3c9ae', false, st);
  // W10d / CR01 clearance: keep the entrance board, waiting bench and stop lamp outside N01-west's paved shoulder.
  const BOARD_X = 6.0, BENCH_X = 6.5, STOP_LAMP_X = 6.5;
  box(BOARD_X, 0.1, 9.0, 0.32, 0.2, 0.32, '#898884', true, st);
  cyl(BOARD_X, 1.2, 9.0, 0.045, 2.4, '#7d8794', st);
  for (const z of [8.96, 9.04]) { box(BOARD_X, 2.3, z, 0.5, 0.34, 0.025, '#e8ecf2', false, st); box(BOARD_X, 2.48, z + 0.014, 0.5, 0.06, 0.03, '#d58a3a', false, st); }
  box(BOARD_X, 1.54, 9.05, 0.37, 0.46, 0.035, '#e8e4d8', true, st); // route and timetable board
  for (let i = 0; i < 4; i++) box(BOARD_X, 1.69 - i * 0.1, 9.072, 0.3, 0.013, 0.008, '#7d8794', false, st);
  for (const x of [BENCH_X - 0.57, BENCH_X + 0.57]) { box(x, 0.27, 4.7, 0.09, 0.46, 0.1, '#5a4a3c', true, st); box(x, 0.16, 5.01, 0.1, 0.23, 0.08, '#5a4a3c', true, st); }
  box(BENCH_X, 0.5, 4.7, 1.35, 0.1, 0.49, '#76583e', true, st); box(BENCH_X, 0.77, 5.0, 1.35, 0.53, 0.1, '#76583e', true, st); // bus stop bench
  cyl(STOP_LAMP_X, 2.6, 8.0, 0.06, 5.2, '#596f80', st); const hd = mesh(new THREE.BoxGeometry(0.6, 0.12, 0.3), warm('#ffe4b0', 0.8), STOP_LAMP_X + 0.4, 5.1, 8.0, false, st); cyl(STOP_LAMP_X + 0.2, 5.1, 8.0, 0.04, 0.5, '#596f80', st).rotation.z = PI / 2;
  L.pool(STOP_LAMP_X + 0.4, 8.0, 3.0, '#ffcf8a', 0.06, 0.08); L.pool(-5.5, -1.5, 3.0, '#ffcf8a', 0.05, 0.08); L.pool(1.8, -1.2, 2.2, '#dfe9f2', 0.05, 0.08);
  // ---- the track: one line along X at z = -6.4; its eastern end stops clear of CR01 at x = -4.47, with the buffer stop; the paddy end still fades west
  const tk = group('lm09Track'); L.use(tk);
  const TRACK_EAST = -4.47, TRACK_WEST = 10.5, TRACK_LENGTH = TRACK_WEST - TRACK_EAST, TRACK_MID = (TRACK_EAST + TRACK_WEST) / 2;
  box(TRACK_MID, 0.06, -6.4, TRACK_LENGTH, 0.12, 1.9, '#7a7872', false, tk); for (let x = TRACK_EAST + 0.2; x <= TRACK_WEST - 0.1; x += 0.7) box(x, 0.15, -6.4, 0.2, 0.08, 1.5, '#4a382b', false, tk);
  for (let i = 0, x = TRACK_EAST + 0.45; x <= TRACK_WEST - 0.4; i++, x += 0.88) { for (const z of [-7.12, -5.68]) box(x, 0.11, z, 0.4, 0.06, 0.21, i % 3 ? '#827f79' : '#aaa59b', false, tk); } // visible ballast shoulders
  for (const dz of [-0.72, 0.72]) box(TRACK_MID, 0.22, -6.4 + dz, TRACK_LENGTH, 0.08, 0.07, '#7d8794', false, tk);
  for (let x = TRACK_EAST + 0.2; x <= TRACK_WEST - 0.1; x += 1.4) for (const dz of [-0.72, 0.72]) box(x, 0.27, -6.4 + dz, 0.16, 0.03, 0.18, '#555a5c', false, tk); // rail clips
  box(TRACK_EAST - 0.3, 0.4, -6.4, 0.3, 0.6, 1.6, '#c4412e', true, tk);                                                                                  // buffer stop at the track's west end, toward CR01
  for (let i = 0; i < 2; i++) { const x = 11.5 + i * 0.7; box(x, 0.1 - 0.03 * i, -6.4, 0.7, 0.1, 1.9 - 0.4 * i, '#59634c', false, tk); }                       // the ballast fades into the paddy: the line ends
  for (let x = 8.8; x <= 9.8; x += 0.5) box(x, 0.2, -6.4, 0.4, 0.06, 1.8, '#6a5240', true, tk);                                              // foot crossing planks, beyond the car
  const car = group('lm09Car'); L.use(car);
  const CZ = -6.4, CL = 13.0, CX = 2.03;
  // A hollow carbody: the window line exposes seats, central aisle and two driver partitions.
  box(CX, 0.68, CZ, CL, 0.16, 2.6, '#665f57', true, car); // floor
  box(CX, 0.38, CZ, CL - 0.2, 0.27, 1.95, '#4f5356', true, car); // continuous underframe
  const carGlass = new THREE.MeshPhysicalMaterial({ color: '#c4d4d3', transparent: true, opacity: 0.22, roughness: 0.16, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
  for (const side of [-1, 1]) {
    const z = CZ + side * 1.27;
    box(CX, 1.18, z, CL, 0.97, 0.12, '#e6dcc2', true, car);
    box(CX, 0.89, z + side * 0.068, CL + 0.01, 0.38, 0.018, '#8a2f3a', false, car); // red stripe
    box(CX, 2.55, z, CL, 0.4, 0.12, '#e6dcc2', true, car);
    for (let i = 0; i <= 8; i++) box(CX - 6.37 + i * 1.59, 1.99, z, 0.1, 0.79, 0.14, '#a8a39a', true, car);
    for (let i = 0; i < 8; i++) {
      const x = CX - 5.57 + i * 1.59;
      mesh(new THREE.PlaneGeometry(1.46, 0.74), carGlass, x, 1.99, z + side * 0.08, false, car).rotation.y = side < 0 ? PI : 0;
      box(x, 1.58, z + side * 0.08, 1.48, 0.07, 0.06, '#7d8794', false, car);
    }
    // Two passenger doors on each side, with a step and handrail.
    for (const x of [CX - 4.75, CX + 4.75]) {
      box(x, 1.49, z + side * 0.1, 0.88, 1.49, 0.055, '#d3c9ae', true, car);
      box(x, 2.01, z + side * 0.139, 0.56, 0.42, 0.025, '#889fa4', false, car);
      box(x, 0.66, z + side * 0.2, 0.85, 0.08, 0.23, '#54585a', true, car);
      box(x + 0.31, 1.37, z + side * 0.154, 0.045, 0.24, 0.04, '#6b7076', true, car);
    }
  }
  for (const x of [CX - 6.43, CX + 6.43]) {
    box(x, 1.16, CZ, 0.13, 0.93, 2.6, '#e6dcc2', true, car);
    box(x, 2.55, CZ, 0.13, 0.4, 2.6, '#e6dcc2', true, car);
    for (const z of [CZ - 1.24, CZ + 1.24]) box(x, 2.0, z, 0.13, 0.75, 0.12, '#a8a39a', true, car);
    mesh(new THREE.PlaneGeometry(2.35, 0.76), carGlass, x + (x > CX ? 0.07 : -0.07), 2.0, CZ, false, car).rotation.y = PI / 2;
    box(x + (x > CX ? -0.32 : 0.32), 1.23, CZ - 0.45, 0.5, 0.1, 0.36, '#555a5c', true, car); // driver's console
    box(x + (x > CX ? 0.02 : -0.02), 0.27, CZ, 0.16, 0.18, 0.66, '#4f5356', true, car); // coupler within the approved length
  }
  // Passenger seating leaves an unobstructed aisle down the centre.
  for (let i = 0; i < 5; i++) for (const side of [-1, 1]) {
    const x = CX - 3.7 + i * 1.8, z = CZ + side * 0.77;
    box(x, 1.06, z, 0.78, 0.12, 0.72, '#6c5143', true, car);
    box(x - 0.34, 1.43, z, 0.1, 0.68, 0.72, '#6c5143', true, car);
    box(x, 0.86, z, 0.08, 0.3, 0.08, '#5a5e60', true, car);
  }
  for (const x of [CX - 5.2, CX + 5.2]) {
    for (const side of [-1, 1]) box(x, 1.73, CZ + side * 0.82, 0.08, 1.75, 0.69, '#a8a39a', true, car);
    box(x, 2.51, CZ, 0.08, 0.2, 0.95, '#a8a39a', true, car); // doorway between aisle and cab
  }
  box(CX, 2.84, CZ, CL - 0.2, 0.2, 2.55, '#9a968c', true, car);
  for (const z of [CZ - 1.13, CZ + 1.13]) box(CX, 2.73, z, CL - 0.3, 0.055, 0.08, '#6b7076', false, car); // roof drainage
  for (const bx of [CX - 4.6, CX + 4.6]) {
    box(bx, 0.36, CZ, 1.52, 0.25, 2.0, '#3e4346', true, car); // bogie frame
    for (const dx of [-0.48, 0.48]) for (const dz of [-0.94, 0.94]) cyl(bx + dx, 0.42, CZ + dz, 0.36, 0.22, '#2a2e34', car).rotation.x = PI / 2;
    for (const dz of [-0.92, 0.92]) box(bx, 0.38, CZ + dz, 1.4, 0.1, 0.08, '#6b7076', false, car); // brake linkage
  }
  for (const x of [CX - 1.9, CX + 2.1]) box(x, 0.23, CZ, 1.65, 0.28, 1.1, '#555a5c', true, car); // fuel / equipment boxes
  mesh(new THREE.BoxGeometry(0.08, 0.32, 0.8), warm('#ffe8b0', 0.1), CX + CL / 2 + 0.01, 1.96, CZ, false, car); // dim headlamp
  // ---- crossing warning posts (live: the two lamps alternate with a period of 6 s, soft ramps)
  const lv = group('lm09Live'); L.use(lv);
  const posts = [[9.3, -4.6], [9.3, -8.2]].map(([x, z]) => {
    box(x, 0.13, z, 0.28, 0.26, 0.28, '#898884', true, lv); // fixed concrete foot
    box(x, 0.9, z, 0.08, 1.8, 0.08, '#e8e4d8', true, lv);
    box(x, 2.03, z, 0.42, 0.09, 0.09, '#e8e4d8', true, lv); // crossbuck
    box(x, 0.63, z + 0.1, 0.24, 0.33, 0.12, '#6b7076', true, lv); // control enclosure
    const a = mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: '#d28d8e' }), x - 0.14, 1.65, z, false, lv), b = mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: '#d28d8e' }), x + 0.14, 1.65, z, false, lv);
    return [a, b];
  });
  // eave drips (live)
  const dr = []; for (let i = 0; i < 6; i++) { const g = L.sub(SX - 1.5 + i * 0.6, 3.2, SZ + 1.4); g.userData.live = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.28), new THREE.MeshBasicMaterial({ color: '#cfe4ee', transparent: true, opacity: 0.7, depthWrite: false })); m.name = 'lm09EaveDrip'; m.userData.weather = 'drip'; g.add(m); dr.push({ g, m, ph: i * 0.17 }); }   // WX2: a weather effect
  out.stats = { platformLength: PLATFORM_LENGTH, platformExtent: [PLATFORM_MIN_X, 10], shed: [4, 2.5], shedX: SX, circle: 12, cars: 1, tracks: 1, trackEnds: 2,
    trackEast: TRACK_EAST, trackWest: TRACK_WEST, bufferX: TRACK_EAST - 0.3, carX: CX, carExtent: [CX - 6.5, CX + 6.5], crossingExtent: [8.8, 9.8], lights: 4, lampsOn: 3 };
  out.update = (t) => {
    const p = (t % 6) / 6, a = 0.5 - 0.5 * Math.cos(p * PI * 2), b = 1 - a;                                       // 6 s period, raised cosine: no flashing
    posts.forEach(([l, r]) => { l.material.color.setRGB(0.35 + 0.65 * a, 0.12 + 0.12 * a, 0.12 + 0.12 * a); r.material.color.setRGB(0.35 + 0.65 * b, 0.12 + 0.12 * b, 0.12 + 0.12 * b); });
    dr.forEach(d => { const q = (t * 0.9 + d.ph) % 1; d.g.position.y = 3.2 - q * 2.2; d.m.material.opacity = 0.7 * (q < 0.9 ? 1 : (1 - q) * 10); });   // the weather's drip coefficient: weather_fx.js (registered by scene.js)
  };
  return out;
};
