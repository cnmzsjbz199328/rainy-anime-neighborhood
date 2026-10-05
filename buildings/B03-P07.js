// B03-P07 邮政服务站 (Yūbin Service Station): a one-storey neighbourhood post-office counter with a parcel back room,
// north of the main street. Task card docs/buildings/tasks/B03-P07.md, reference docs/buildings/references/B03-P07.jpg.
// Local frame (placed by layout.js `buildings`, rotY π): front +z faces the north street (world N), local +x = world W,
// local -x = world E; door centre at the origin, floor top at rec.floor.
// Pale grey plaster, a thick dark-grey fascia round a flat roof, a smoked-glass entrance canopy under a red 〒 sign,
// a rear roller shutter for parcel loading, rooftop air conditioners.
// Body 5.4 × 4.9: x -3.0…2.4, z -4.9…0 (fascia to x -3.1 / 2.5 and z +0.1 / -5.0, canopy to +0.8: inside the 10 × 6 envelope).
// Groups: post (shell, frame, fascia, roof, canopy, sign, gutters, interior) · postFrontE (red postbox, planter, east
// lamp) · postFrontW (parcel locker terminal, planter) · postSideE (outdoor AC, meters, block wall, shrubs) ·
// postParking (west-side bay, postal scooter, kerb stop, fence) · postRear (shutter hood, step, cage carts, crates) · postGround.
// Plan: lobby behind the glass front (writing desk, bench and ATM along the windows, leaflet rack), a service counter
// with three stations across the middle and a staff gate at its west end; behind it the back room: letter-sorting cases
// on the east wall, a packing table and a floor scale, parcel racks and an office desk on the west wall, the roller
// shutter at the rear with a cage cart, and a staff door in the back-east corner.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B03-P07'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(3307), PI = Math.PI;
  const F = rec.floor, X0 = -3.0, X1 = 2.4, Z0 = 0, Z1 = -4.9, T = 0.15, BASE = 0.19, EF = 3.5, CEIL = 3.1, FT = 3.15;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T, ZC = (Z0 + Z1) / 2, XC = (X0 + X1) / 2;
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FW = [-2.55, -1.05, 0.55, 2.25], FD = [-0.9, 0.9, F, 2.25], FE = [1.05, 2.0, 0.55, 2.25];
  const EW = [-4.5, -2.9, 1.6, 2.3], WW = [-3.2, -2.2, 1.35, 2.2];
  const RS = [-0.9, 1.5, F, 2.3], BD = [-2.2, -1.4, F, 2.2];

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#d4d1c9'), alu = '#3f474f', aluL = '#5d6670', stoneC = '#8f8c86', fasc = '#444a52', metal = '#8a9298', red = '#c23a30', redD = '#8f2a24';
  const wcache = {}, W = (c, k = 0.3) => wcache[c + k] || (wcache[c + k] = warm(c, k));
  const wood = W('#b58a58'), woodD = W('#6f4f3a', 0.26), cream = W('#efe5cf', 0.34), steel = W('#bcc4c8', 0.22), white = W('#f0ece2', 0.34), teal = W('#3f7f84', 0.3);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' });
  const tileF = tex(128, 128, (q, w, h) => { q.fillStyle = '#c9c0ac'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { q.fillStyle = `rgba(${(i + j) % 2 ? '255,250,236' : '96,88,74'},.1)`; q.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
    q.strokeStyle = 'rgba(70,62,50,.4)'; q.lineWidth = 1.5; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 32, 0); q.lineTo(i * 32, h); q.moveTo(0, i * 32); q.lineTo(w, i * 32); q.stroke(); } });
  const pavers = tex(256, 256, (q, w, h) => { q.fillStyle = '#9a9a94'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      q.fillStyle = `rgba(${rnd() < 0.5 ? '66,76,92' : '250,246,236'},${0.05 + rnd() * 0.08})`; q.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    q.strokeStyle = 'rgba(48,56,68,.45)'; q.lineWidth = 2; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); }
    for (let i = 0; i < 900; i++) { q.fillStyle = `rgba(40,48,60,${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1); } });
  const asphalt = tex(128, 128, (q, w, h) => { q.fillStyle = '#62666e'; q.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '28,32,38' : '190,196,204'},${0.05 + rnd() * 0.08})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } });
  const roofT = tex(128, 128, (q, w, h) => { q.fillStyle = '#3d4249'; q.fillRect(0, 0, w, h); for (let i = 0; i < 600; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '10,14,20' : '170,184,200'},${0.04 + rnd() * 0.07})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    q.strokeStyle = 'rgba(15,20,26,.45)'; q.lineWidth = 2; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 32, 0); q.lineTo(i * 32, h); q.stroke(); } });
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: roofT });
  const shutT = tex(64, 128, (q, w, h) => { for (let i = 0; i < 32; i++) { q.fillStyle = i % 2 ? '#8e969c' : '#7c848b'; q.fillRect(0, i * 4, w, 4); q.fillStyle = 'rgba(20,26,32,.5)'; q.fillRect(0, i * 4, w, 1); } });
  const shutM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: shutT });
  const glowT = canvasTex(128, 128, (q, w) => { const g = q.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.33)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, w); });
  const spillT = canvasTex(128, 128, (q, w, h) => { const g = q.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, h);
    q.globalCompositeOperation = 'destination-in'; const s = q.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.18, 'rgba(0,0,0,1)'); s.addColorStop(0.82, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = s; q.fillRect(0, 0, w, h); });
  const additive = (map, c, o) => new THREE.MeshBasicMaterial({ map, color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const pool = additive(glowT, '#ffc988', 0.28);
  const decal = (w, h, x, y, z, heading, m, parent) => { const a = mesh(new THREE.PlaneGeometry(w, h), m, x, y, z, false, parent); a.rotation.set(-PI / 2, Math.atan2(-heading[0], -heading[1]), 0, 'YXZ'); return a; };
  const ab = (axis, u, y, d, w, h, t, c, o = true, p) => axis === 'x' ? box(u, y, d, w, h, t, c, o, p) : box(d, y, u, t, h, w, c, o, p);
  const shapeMesh = (pts, depth, c, x, y, z, ry) => { const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 }); const m = mesh(g, c, x, y, z); m.rotation.y = ry; return m; };
  const rod = (a, b, r, c, parent) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 5, 1, true), typeof c === 'string' ? mat(c) : c, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, false, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  // The postal mark 〒 drawn as shapes (no font dependence).
  const mark = (q, x, y, s, c) => { q.fillStyle = c; q.fillRect(x - s * 0.5, y - s * 0.45, s, s * 0.17); q.fillRect(x - s * 0.5, y - s * 0.12, s, s * 0.17); q.fillRect(x - s * 0.09, y - s * 0.1, s * 0.18, s * 0.6); };

  // ---- plants ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), LEAF = ['#6c9476', '#88a98a', '#5e8a6a'];
  const shrub = (x, y, z, r, n, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(LEAF[i % 3]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.35 + rnd() * r * h, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.45 + rnd() * 0.25)); } };
  const pot = (x, y, z, r, n = 5, h = 1, c = '#8f8a82') => { mesh(new THREE.CylinderGeometry(r, r * 0.76, r * 1.15, 10), mat(c), x, y + r * 0.575, z); shrub(x, y + r * 1.1, z, r, n, h); };
  const planter = (x0, x1, z0, z1, n) => { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; box(cx, BASE + 0.16, cz, x1 - x0, 0.32, z1 - z0, '#a7a49b'); box(cx, BASE + 0.33, cz, x1 - x0 - 0.1, 0.03, z1 - z0 - 0.1, '#4a4034', false);
    for (let i = 0; i < n; i++) shrub(x0 + 0.15 + (i + 0.5) * (x1 - x0 - 0.3) / n, BASE + 0.34, cz, 0.2, 2, 1.4); };

  // ================= shell =================
  group('post');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, EF], [FW, FD, FE], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, EF], [RS, BD], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, EF], [WW], plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, EF], [EW], plaster);
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FD[0], Z0, 1); plinth('x', FD[1], X1, Z0, 1); plinth('x', X0, BD[0], Z1, -1); plinth('x', BD[1], RS[0], Z1, -1); plinth('x', RS[1], X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  // Corner pilasters in a slightly darker plaster.
  for (const [x, z] of [[X0 + 0.04, Z0 - 0.04], [X1 - 0.04, Z0 - 0.04], [X0 + 0.04, Z1 + 0.04], [X1 - 0.04, Z1 + 0.04]]) box(x, (BASE + EF) / 2, z, 0.1, EF - BASE, 0.1, '#bdbab2');
  // Floor: cream tile; counter and back room share it.
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - IZ1), (IX1 - IX0) / 1.2, (IZ0 - IZ1) / 1.2), warm('#ffffff', 0.2, tileF), XC, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  // Interior linings: warm cream plaster with a tan wainscot at the back.
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL], [FW, FD, FE], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL], [WW], cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL], [EW], cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL], [RS, BD], cream);
  box(XC, F + 0.45, IZ1 + 0.01, IX1 - IX0, 0.9, 0.012, W('#d6ccb2', 0.3), false);
  for (const x of [IX0 + 0.006, IX1 - 0.006]) box(x, F + 0.45, (IZ0 + IZ1) / 2, 0.012, 0.9, IZ0 - IZ1, W('#d6ccb2', 0.3), false);

  // ---- glazing: dark aluminium frames, mullions, glass ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = [], louver = 0) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, alu); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, alu);
    ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, alu); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, alu);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.045, q - p, fd * 0.9, alu);
    for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.04, fd * 0.9, alu);
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    if (louver) { const n = Math.floor((q - p) / louver); for (let i = 0; i < n; i++) ab(axis, (a + b) / 2, p + 0.06 + i * louver, at + out * 0.05, b - a - 0.04, 0.025, 0.07, alu, false); }
    if (p > F + 0.05) ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.1, 0.05, 0.15, '#a8a69d');
  }
  glaze('x', -T / 2, 1, FW, [-1.8, -1.35]); glaze('x', -T / 2, 1, FE, [1.5]);
  glaze('z', X1 - T / 2, 1, WW, [-2.7]); glaze('z', X0 + T / 2, -1, EW, [-3.7]);
  // Low bulkhead panels under the shopfront windows (outside), a grey-blue enamel.
  for (const w of [FW, FE]) box((w[0] + w[1]) / 2, (0.32 + w[2] - 0.05) / 2, 0.012, w[1] - w[0] - 0.04, w[2] - 0.05 - 0.32, 0.02, '#58626c');
  // Front door: double automatic sliding glass door in aluminium frames, a sticker and handle strips.
  ab('x', FD[0] + 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, alu); ab('x', FD[1] - 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, alu);
  box(0, FD[3] - 0.03, -T / 2, FD[1] - FD[0], 0.06, 0.16, alu);
  box(0, FD[3] + 0.12, 0.05, 1.9, 0.2, 0.14, '#4d555d');   // sliding-door operator housing
  {
    const z = -0.05, top = FD[3] - 0.06, l = -0.84, r = 0.84;
    for (const x of [l + 0.04, -0.03, 0.03, r - 0.04]) box(x, (F + top) / 2, z, 0.06, top - F, 0.045, aluL);
    box(0, top - 0.04, z, r - l, 0.08, 0.045, aluL); box(0, F + 0.05, z, r - l, 0.1, 0.045, aluL);
    box(0, (F + 0.1 + top - 0.08) / 2, z, r - l - 0.1, top - 0.08 - F - 0.1, 0.012, glass, false);
    for (const x of [-0.14, 0.14]) box(x, 1.1, z + 0.03, 0.025, 0.4, 0.025, '#c9c9c0');
    box(-0.55, 1.35, z + 0.012, 0.2, 0.2, 0.006, '#d8b23a', false); box(0.55, 1.45, z + 0.012, 0.22, 0.12, 0.006, red, false);
  }
  shapeMesh([[0, BASE], [0.52, BASE], [0.52, 0.212], [0, 0.298]], 1.9, '#a8a69d', 0.95, 0, 0, -PI / 2);
  // Rear: roller shutter (slats, hood box, guide rails), staff door with lever handle, lamp.
  box((RS[0] + RS[1]) / 2, (F + RS[3]) / 2, Z1 - 0.02, RS[1] - RS[0] - 0.1, RS[3] - F - 0.05, 0.04, shutM);
  box((RS[0] + RS[1]) / 2, RS[3] + 0.16, Z1 - 0.07, RS[1] - RS[0] + 0.2, 0.3, 0.14, '#6c747a');
  for (const x of [RS[0] - 0.04, RS[1] + 0.04]) box(x, (F + RS[3]) / 2, Z1 - 0.06, 0.08, RS[3] - F, 0.1, alu);
  box((RS[0] + RS[1]) / 2, F + 1.05, Z1 - 0.055, 0.5, 0.06, 0.03, '#2a3036', false);   // shutter handle bar
  ab('x', BD[0] + 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, alu); ab('x', BD[1] - 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, alu);
  box((BD[0] + BD[1]) / 2, BD[3] - 0.03, Z1 + T / 2, BD[1] - BD[0], 0.06, 0.16, alu);
  box((BD[0] + BD[1]) / 2, (F + BD[3] - 0.06) / 2, Z1 + 0.06, BD[1] - BD[0] - 0.12, BD[3] - 0.06 - F, 0.04, '#6a727a');
  box((BD[0] + BD[1]) / 2, 1.85, Z1 + 0.035, BD[1] - BD[0] - 0.3, 0.24, 0.012, '#9aa4ab', false);
  box(BD[1] - 0.14, 1.1, Z1 + 0.02, 0.03, 0.16, 0.04, '#c9c9c0'); box(BD[1] - 0.14, 1.1, Z1 - 0.03, 0.16, 0.025, 0.04, '#c9c9c0');
  box(BD[1] + 0.3, 2.0, Z1 - 0.06, 0.12, 0.17, 0.1, '#3d4a58'); box(BD[1] + 0.3, 1.99, Z1 - 0.06, 0.09, 0.12, 0.105, bulb, false);
  mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.26), BD[1] + 0.3, 2.0, Z1 - 0.004, false).rotation.y = PI;
  // Louvred vent on the west wall (rear half) and a service vent on the east wall.
  for (let i = 0; i < 8; i++) box(X1 + 0.03, 1.75 + i * 0.075, -4.0, 0.04, 0.03, 0.8, '#6a727a', false);
  box(X1 + 0.015, 1.97, -4.0, 0.03, 0.66, 0.86, '#3d444b');
  // Meter boxes and gas pipe on the east wall.
  box(X0 - 0.08, 1.45, -1.3, 0.16, 0.42, 0.34, '#c4c6c0'); box(X0 - 0.165, 1.52, -1.3, 0.01, 0.12, 0.2, '#6f7e87', false); box(X0 - 0.08, 1.45, -0.78, 0.16, 0.3, 0.26, '#b8bbb4');
  line([[X0 - 0.06, 1.2, -1.3], [X0 - 0.06, 0.6, -1.3], [X0 - 0.18, 0.4, -1.3]], '#8a9298', 0.018);
  // Poster case on the left pier: lit leaflets (stamps, parcel rates), frame and a lamp.
  box(-2.78, 1.45, 0.045, 0.4, 0.92, 0.08, '#3a424a'); box(-2.78, 1.45, 0.09, 0.34, 0.86, 0.01, glass, false);
  for (const [dy, c] of [[0.28, '#d8a43a'], [0.0, '#4f8aa8'], [-0.27, '#e8e0cc']]) box(-2.78, 1.45 + dy, 0.088, 0.28, 0.2, 0.004, W(c, 0.5), false);
  K.label('切手', -2.78, 1.72, 0.094, 0.18, 0.06, '#b9382d', '#f3ead0', 62);
  // Wall lanterns either side of the door.
  for (const [x, y] of [[-2.78, 2.12], [2.2, 2.0]]) { box(x, y, 0.07, 0.12, 0.18, 0.1, '#3d4a58'); box(x, y - 0.01, 0.07, 0.09, 0.13, 0.105, bulb, false); mesh(new THREE.PlaneGeometry(0.8, 0.8), additive(glowT, '#ffc27e', 0.26), x, y, 0.05, false); }

  // ================= fascia, sign, glass canopy =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('post').add(roofLayer); K.setRoot(roofLayer);
  {
    const x0 = X0 - 0.1, x1 = X1 + 0.1, zf = Z0 + 0.1, zr = Z1 - 0.1, h = 0.65, y = FT + h / 2 - 0.0;
    box(XC, y, zf - 0.04, x1 - x0, h, 0.08, fasc); box(XC, y, zr + 0.04, x1 - x0, h, 0.08, fasc);
    box(x0 + 0.04, y, ZC, 0.08, h, zf - zr, fasc); box(x1 - 0.04, y, ZC, 0.08, h, zf - zr, fasc);
    box(XC, FT + h + 0.02, zf - 0.04, x1 - x0 + 0.04, 0.05, 0.14, '#2f343b'); box(XC, FT + h + 0.02, zr + 0.04, x1 - x0 + 0.04, 0.05, 0.14, '#2f343b');
    box(x0 + 0.04, FT + h + 0.02, ZC, 0.14, 0.05, zf - zr, '#2f343b'); box(x1 - 0.04, FT + h + 0.02, ZC, 0.14, 0.05, zf - zr, '#2f343b');
    box(XC, FT - 0.01, ZC, x1 - x0 - 0.1, 0.06, zf - zr - 0.1, '#33383f', false);   // soffit board under the fascia
    // Roof membrane with seams, a drainage fall toward the front, and a ceiling below.
    mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0 + 0.1, 0.1, IZ0 - IZ1 + 0.1), 3, 3), roofM, XC, EF + 0.05, ZC, false);
    box(XC, CEIL + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#e6dfcd', 0.34), false);
    for (let i = 1; i < 5; i++) box(XC, CEIL - 0.02, IZ0 - i * (IZ0 - IZ1) / 5, IX1 - IX0, 0.04, 0.07, woodD, false);
    // Roof drain bowls and a stainless overflow pipe.
    for (const [x, z] of [[-2.55, -0.45], [1.85, -4.35]]) { cyl(x, EF + 0.11, z, 0.12, 0.03, '#5d6670'); cyl(x, EF + 0.13, z, 0.07, 0.03, '#252a30'); }
    line([[-2.4, EF + 0.1, -0.45], [-2.4, EF + 0.35, -0.45], [-2.4, EF + 0.35, -2.6]], '#9aa3a6', 0.03);
    // Rooftop equipment: two outdoor AC condensers on rails (round fan grilles), a vent cabinet and pipe runs.
    const ac = (x, z, w, d) => { for (const dz of [-d * 0.35, d * 0.35]) box(x, EF + 0.17, z + dz, w + 0.1, 0.12, 0.08, '#2f363c');
      box(x, EF + 0.58, z, w, 0.9, d, '#d8dad4'); box(x, EF + 1.06, z, w + 0.04, 0.06, d + 0.04, '#aab2b4');
      mesh(new THREE.CircleGeometry(w * 0.34, 18), mat('#2e363e'), x, EF + 0.62, z + d / 2 + 0.006, false);
      for (let i = 0; i < 5; i++) box(x, EF + 0.42 + i * 0.09, z + d / 2 + 0.008, w * 0.6, 0.014, 0.01, '#8a9498', false); };
    ac(-1.6, -3.6, 0.9, 0.42); ac(0.75, -3.6, 0.9, 0.42);
    box(1.75, EF + 0.4, -1.5, 0.6, 0.6, 0.5, '#7d8886'); for (let i = 0; i < 4; i++) box(1.75, EF + 0.28 + i * 0.08, -1.24, 0.46, 0.02, 0.01, '#4a5654', false); box(1.75, EF + 0.72, -1.5, 0.66, 0.05, 0.56, '#566360');
    line([[-1.6, EF + 0.12, -3.4], [-1.6, EF + 0.12, -2.4], [0.75, EF + 0.12, -2.4], [0.75, EF + 0.12, -3.4]], '#9aa3a6', 0.022); line([[1.75, EF + 0.1, -1.7], [1.75, EF + 0.1, -2.4]], '#9aa3a6', 0.022);
    for (const [x, z] of [[-2.9, -4.7], [2.3, -0.4]]) { box(x, EF + 0.15, z, 0.2, 0.05, 0.2, '#5d6670', false); }
  }
  group('post');
  // Front sign: pale board with a red 〒 mark and 邮政服务站 lettering, lit from two goosenecks.
  {
    const s = canvasTex(1024, 256, (q, w, h) => { q.fillStyle = '#e6e1d4'; q.fillRect(0, 0, w, h); q.strokeStyle = '#9a948a'; q.lineWidth = 5; q.strokeRect(6, 6, w - 12, h - 12);
      mark(q, 150, 128, 150, '#c23a30'); q.fillStyle = '#3a3f46'; q.textBaseline = 'middle'; q.textAlign = 'center'; q.font = 'bold 128px sans-serif'; q.fillText('邮政服务站', 610, 124);
      q.fillStyle = '#6a625c'; q.font = 'bold 30px sans-serif'; q.fillText('ゆうびん サービス', 560, 218); });
    const sm = new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, emissive: '#2a2e30', emissiveMap: s });
    box(0, 2.93, 0.04, 4.36, 0.5, 0.08, '#4a5058'); mesh(new THREE.PlaneGeometry(4.2, 0.42), sm, 0, 2.93, 0.083, false);
    for (const x of [-1.5, 1.5]) { rod([x, 3.18, 0.08], [x, 3.28, 0.3], 0.012, '#3a3330'); box(x, 3.28, 0.34, 0.16, 0.05, 0.1, '#3d4a58'); mesh(new THREE.PlaneGeometry(1.8, 0.7), additive(glowT, '#ffe2b0', 0.12), x, 2.95, 0.12, false); }
  }
  // Glass canopy: smoked panels in a dark frame, hung on tie rods, rainwater dripping off the front edge.
  {
    const x0 = -2.1, x1 = 2.1, top = 2.68, low = 2.46, dep = 0.8, len = Math.hypot(dep, top - low), ang = Math.atan2(top - low, dep);
    const e = box(0, (top + low) / 2 + 0.01, dep / 2, x1 - x0, 0.03, len, '#3f5662', false); e.rotation.x = ang;
    const smoke = new THREE.MeshPhysicalMaterial({ color: 0x4d6b78, transparent: true, opacity: 0.5, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
    const g = box(0, (top + low) / 2 + 0.03, dep / 2, x1 - x0 - 0.1, 0.012, len - 0.05, smoke, false); g.rotation.x = ang;
    for (const x of [x0, x1, -0.7, 0.7]) { const r = box(x, (top + low) / 2 + 0.005, dep / 2, 0.05, 0.05, len, alu); r.rotation.x = ang; }
    box(0, low, dep, x1 - x0 + 0.05, 0.07, 0.07, alu); box(0, top, 0.04, x1 - x0 + 0.05, 0.07, 0.07, alu);
    for (const x of [x0 + 0.03, x1 - 0.03]) rod([x, 3.0, 0.02], [x, low - 0.02, dep - 0.04], 0.014, aluL);
    for (const x of [-0.7, 0.7]) rod([x, 3.0, 0.02], [x, low, dep - 0.04], 0.01, aluL);
  }
  // Downpipes (east rear corner and west front corner) with a clamp at mid height.
  for (const [x, z] of [[X0 - 0.07, Z1 + 0.18], [X1 + 0.07, -0.3]]) { const s = Math.sign(x);
    cyl(x, (FT + 0.3) / 2, z, 0.04, FT - 0.3, '#8f979c'); for (const y of [0.9, 2.0, 3.0]) rod([x, y, z], [x - s * 0.07, y, z], 0.012, '#5f6c76');
    box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91'); }
  // Overflow scupper through the fascia above the east pier, spilling onto the grated drain below.
  box(X0 - 0.16, 3.4, -1.95, 0.3, 0.1, 0.14, '#6a727a'); box(X0 - 0.3, 3.35, -1.95, 0.04, 0.08, 0.12, '#2f353b', false);

  // ================= interior =================
  const tube = (x, z, len, axis = 'x') => { const w = axis === 'x' ? len : 0.1, d = axis === 'x' ? 0.1 : len; box(x, CEIL - 0.04, z, w + 0.04, 0.05, d + 0.04, '#7d8b88', false, roofLayer); box(x, CEIL - 0.075, z, w, 0.02, d, W('#fff4d0', 0.95), false, roofLayer); };
  const parcel = (x, y, z, w, h, d, c) => { box(x, y, z, w, h, d, W(c || ['#c9a06a', '#b98f58', '#d4ae78', '#c19a60'][Math.floor(rnd() * 4)], 0.3)); box(x, y + h / 2 + 0.002, z, w * 0.14, 0.004, d + 0.004, W('#e6d2a4', 0.4), false); };
  // Near layer: standing writing desk with form pads at the west... east window; waiting bench and ATM at the west window.
  {
    const dx = -2.0, dz = -0.6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(dx + sx * 0.5, F + 0.5, dz + sz * 0.17, 0.04, 1.0, 0.04, '#59656d', false);
    box(dx, F + 1.02, dz, 1.2, 0.05, 0.46, wood); box(dx, F + 0.3, dz, 1.1, 0.04, 0.4, woodD, false);
    for (let i = 0; i < 3; i++) box(dx - 0.35 + i * 0.35, F + 1.06, dz + 0.04, 0.2, 0.015, 0.28, W(['#f0e6cc', '#d4e4f0', '#f0d8d0'][i], 0.5), false);
    for (const x of [dx - 0.45, dx + 0.45]) { cyl(x, F + 1.1, dz - 0.1, 0.01, 0.12, '#c9c9c0'); line([[x, F + 1.08, dz - 0.1], [x + 0.04, F + 1.0, dz - 0.05]], '#8a9298', 0.006); }
  }
  {
    const bx = 1.5, bz = -0.55;   // bench with a teal seat and two cushions under the west window
    box(bx, F + 0.22, bz, 1.2, 0.05, 0.42, teal); box(bx, F + 0.45, bz - 0.2, 1.2, 0.34, 0.05, teal);
    for (const x of [bx - 0.5, bx + 0.5]) box(x, F + 0.1, bz, 0.05, 0.2, 0.36, '#59656d', false);
    for (const x of [bx - 0.3, bx + 0.3]) box(x, F + 0.27, bz + 0.02, 0.34, 0.05, 0.34, W('#d8c7a0', 0.4), false);
    // leaflet rack beside the bench
    box(2.1, F + 0.55, -1.55, 0.24, 1.1, 0.22, '#59656d'); for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) box(2.1 - 0.05, F + 0.25 + k * 0.25, -1.55 + (j - 1) * 0.06 + 0.12, 0.012, 0.18, 0.05, W(['#d8a43a', '#4f8aa8', '#c0463a', '#e8e0cc'][(k + j) % 4], 0.5), false);
  }
  {
    // ATM: grey cabinet facing the lobby, dark panel, lit card slot and a ledge (no screen graphics).
    const ax = 2.12, az = -1.05;
    box(ax, F + 0.85, az, 0.48, 1.7, 0.6, '#9aa3a8'); box(ax - 0.245, F + 1.3, az, 0.012, 0.3, 0.38, '#1f2a34', false); box(ax - 0.25, F + 1.05, az, 0.02, 0.05, 0.22, W('#9fe4a8', 0.9), false);
    box(ax - 0.28, F + 0.95, az, 0.1, 0.03, 0.4, '#59656d'); box(ax - 0.25, F + 0.62, az, 0.012, 0.05, 0.26, '#2a3036', false);
    box(ax - 0.245, F + 1.62, az, 0.012, 0.12, 0.4, W('#e8f0f0', 0.8), false);
  }
  pot(-2.6, F, -0.35, 0.16, 6, 1.7, '#8f8a82');
  // East lobby wall: framed notices.
  for (const [z, c] of [[-0.55, '#4f8aa8'], [-1.2, '#d8a43a'], [-1.8, '#c0463a']]) { box(IX0 + 0.02, F + 1.5, z, 0.02, 0.5, 0.4, '#59656d', false); box(IX0 + 0.035, F + 1.5, z, 0.01, 0.42, 0.32, W(c, 0.5), false); }
  // Mid layer: service counter with three stations, acrylic dividers, scale, stamp, trays and hanging window numbers.
  {
    const x0 = -2.85, x1 = 0.9, z0 = -2.15, z1 = -2.65, top = F + 0.98, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(cx, F + 0.45, cz, x1 - x0, 0.9, z0 - z1, woodD); box(cx, top - 0.03, cz, x1 - x0 + 0.04, 0.06, z0 - z1 + 0.1, wood);
    for (let i = 1; i < 10; i++) box(x0 + i * (x1 - x0) / 10, F + 0.45, z0 + 0.003, 0.02, 0.76, 0.012, wood, false);
    box(cx, F + 0.2, z0 + 0.012, x1 - x0 - 0.06, 0.2, 0.012, '#4a3a30', false);
    for (const x of [-1.6, -0.35]) { box(x, top + 0.22, cz, 0.02, 0.42, 0.46, glass, false); box(x, top + 0.02, cz, 0.04, 0.04, 0.48, alu, false); }
    // station 1 (west): parcel scale with a display post
    box(-2.35, top + 0.04, cz + 0.02, 0.4, 0.06, 0.34, W('#e9e4d6', 0.3)); box(-2.35, top + 0.08, cz + 0.02, 0.32, 0.02, 0.26, W('#a0aab0', 0.4), false); box(-2.55, top + 0.17, cz - 0.1, 0.14, 0.2, 0.05, W('#2a3036', 0.1));
    box(-2.62, top + 0.04, cz + 0.12, 0.2, 0.06, 0.16, W('#e6dccc', 0.3)); cyl(-2.62, top + 0.12, cz + 0.12, 0.04, 0.1, W('#c23a30', 0.4));
    // station 2: stamping tray, receipt printer, pen holder, a small scales for letters
    box(-1.0, top + 0.05, cz, 0.3, 0.1, 0.26, W('#3f464e', 0.12)); box(-1.0, top + 0.12, cz - 0.02, 0.2, 0.04, 0.18, W('#2a3036', 0.1), false);
    box(-0.75, top + 0.03, cz + 0.08, 0.24, 0.04, 0.2, W('#e9e4d6', 0.3)); cyl(-1.35, top + 0.07, cz + 0.12, 0.035, 0.1, W('#6a8aa8', 0.4));
    for (let i = 0; i < 3; i++) box(-0.9 + i * 0.12, top + 0.025, cz + 0.2, 0.1, 0.01, 0.14, W(['#f0e6cc', '#d8a43a', '#e0d0c0'][i], 0.4), false);
    // station 3 (east): two trays of envelopes and a hand-held scanner on its cradle
    box(0.35, top + 0.03, cz + 0.05, 0.34, 0.05, 0.22, W('#c9bfa8', 0.3)); for (let i = 0; i < 5; i++) box(0.25 + i * 0.05, top + 0.1, cz + 0.05, 0.03, 0.1, 0.18, W(['#f0e6cc', '#dce6ea'][i % 2], 0.5), false);
    box(0.6, top + 0.06, cz - 0.02, 0.12, 0.12, 0.08, W('#3a424a', 0.12)); box(0.6, top + 0.15, cz - 0.04, 0.05, 0.06, 0.1, W('#c23a30', 0.5), false);
    // hanging window signs
    for (const [x, t] of [[-2.35, '包裹'], [-1.0, '邮件'], [0.35, '汇款']]) { rod([x - 0.2, CEIL - 0.04, cz], [x - 0.2, F + 2.45, cz], 0.006, '#59656d'); rod([x + 0.2, CEIL - 0.04, cz], [x + 0.2, F + 2.45, cz], 0.006, '#59656d');
      K.label(t, x, F + 2.4, cz + 0.012, 0.56, 0.24, '#e8e2d0', '#b9382d', 112); box(x, F + 2.4, cz - 0.012, 0.58, 0.26, 0.02, '#59656d', false); }
  }
  // Staff gate at the counter's west end: half-height leaf standing open against the counter.
  box(1.0, F + 0.48, -2.35, 0.04, 0.96, 0.5, woodD, false); box(1.0, F + 0.98, -2.35, 0.06, 0.04, 0.54, wood, false);
  // Short return wall closing the counter to the west wall.
  box((1.8 + IX1) / 2, F + 1.35, -2.4, IX1 - 1.8, 2.7, 0.08, cream); box(1.8, F + 1.35, -2.4, 0.06, 2.7, 0.1, '#8a8276');
  // Back room, east wall: letter-sorting cases (pigeonholes with envelopes) under the east window, and a wall clock.
  {
    const x = IX0 + 0.22, z0 = -2.85, z1 = -4.05, zc = (z0 + z1) / 2, L = z0 - z1;
    box(x, F + 0.65, zc, 0.4, 1.3, L, W('#4a5058', 0.2));
    for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) { box(x + 0.205, F + 0.2 + r * 0.22, z1 + 0.08 + c * (L - 0.16) / 7, 0.012, 0.17, (L - 0.16) / 7 - 0.03, W('#1f2429', 0.12), false);
      if (rnd() < 0.7) box(x + 0.212, F + 0.17 + r * 0.22, z1 + 0.08 + c * (L - 0.16) / 7, 0.012, 0.1, 0.1, W(['#f0e6cc', '#dce6ea', '#f0d8d0'][(r + c) % 3], 0.5), false); }
    for (let r = 0; r <= 5; r++) box(x + 0.2, F + 0.1 + r * 0.22, zc, 0.01, 0.015, L, '#8a9298', false);
    box(x, F + 1.34, zc, 0.44, 0.04, L + 0.04, wood);
    cyl(IX0 + 0.04, F + 2.3, -3.3, 0.16, 0.03, '#f0ece2').rotation.z = PI / 2;
    // locker for the carrier uniforms in the back-east corner
    box(IX0 + 0.28, F + 0.9, IZ1 + 0.3, 0.5, 1.8, 0.5, '#8d979d'); box(IX0 + 0.54, F + 0.9, IZ1 + 0.3, 0.01, 1.7, 0.46, '#7f898f', false); box(IX0 + 0.55, F + 1.0, IZ1 + 0.22, 0.02, 0.2, 0.02, '#59656d');
  }
  // Packing table with tape dispenser, cartons, and the floor scale with its display post.
  {
    const tx = -1.4, tz = -3.3;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(tx + sx * 0.46, F + 0.4, tz + sz * 0.25, 0.05, 0.8, 0.05, '#59656d', false);
    box(tx, F + 0.82, tz, 1.05, 0.05, 0.62, wood); box(tx, F + 0.3, tz, 0.95, 0.03, 0.54, steel, false);
    parcel(tx - 0.2, F + 0.97, tz, 0.4, 0.25, 0.3, '#c9a06a'); parcel(tx + 0.25, F + 0.91, tz + 0.05, 0.25, 0.13, 0.22, '#d4ae78');
    box(tx + 0.4, F + 0.89, tz - 0.2, 0.1, 0.1, 0.06, W('#c23a30', 0.4)); box(tx - 0.42, F + 0.86, tz + 0.2, 0.06, 0.03, 0.1, W('#2f2a26', 0.1), false);
    const sx = -0.15, sz = -3.45;
    box(sx, F + 0.06, sz, 0.6, 0.1, 0.52, W('#59656d', 0.2)); box(sx, F + 0.115, sz, 0.54, 0.012, 0.46, W('#aab3b7', 0.3), false);
    box(sx + 0.3, F + 0.5, sz - 0.2, 0.05, 0.9, 0.05, '#59656d'); box(sx + 0.3, F + 0.95, sz - 0.2, 0.2, 0.14, 0.06, W('#2a3036', 0.1));
    box(sx + 0.3, F + 0.95, sz - 0.168, 0.14, 0.05, 0.004, W('#9fe4a8', 0.9), false);
  }
  // West wall: office desk with chair, lamp and tray under the window; parcel racks along the back-west wall.
  {
    const dx = 2.05, dz = -2.95;
    box(dx, F + 0.74, dz, 0.6, 0.05, 1.2, wood); for (const sz of [-1, 1]) box(dx, F + 0.37, dz + sz * 0.55, 0.5, 0.72, 0.04, woodD);
    box(dx, F + 0.42, dz - 0.1, 0.5, 0.2, 0.7, woodD, false);
    box(dx + 0.15, F + 0.85, dz - 0.05, 0.02, 0.2, 0.34, W('#2a3036', 0.1)); box(dx + 0.12, F + 0.78, dz - 0.05, 0.1, 0.04, 0.2, W('#3a424a', 0.1), false);
    box(dx - 0.12, F + 0.8, dz + 0.4, 0.2, 0.06, 0.26, W('#e0d8c4', 0.4)); rod([dx + 0.2, F + 0.77, dz + 0.4], [dx + 0.1, F + 1.12, dz + 0.4], 0.008, '#59656d'); box(dx + 0.08, F + 1.13, dz + 0.4, 0.12, 0.04, 0.1, W('#ffe8b0', 0.95), false);
    const cx = dx - 0.75, cz = dz; cyl(cx, F + 0.28, cz, 0.04, 0.5, '#59656d'); box(cx, F + 0.5, cz, 0.38, 0.06, 0.38, teal); box(cx - 0.16, F + 0.75, cz, 0.05, 0.4, 0.34, teal);
    for (const a of [0, 1, 2, 3, 4]) box(cx + Math.cos(a * 1.26) * 0.16, 0.22, cz + Math.sin(a * 1.26) * 0.16, 0.04, 0.04, 0.04, '#2f363c', false);
    const rx = IX1 - 0.28, z0 = -3.6, z1 = -4.7, zc = (z0 + z1) / 2, L = z0 - z1;
    for (const z of [z0 - 0.04, z1 + 0.04]) box(rx, F + 1.0, z, 0.5, 2.0, 0.04, '#59656d');
    for (let k = 0; k < 5; k++) { const y = F + 0.2 + k * 0.44; box(rx, y, zc, 0.5, 0.03, L, steel, false);
      for (let i = 0; i < 3; i++) if (rnd() < 0.85) parcel(rx + (rnd() - 0.5) * 0.04, y + 0.14, z1 + 0.2 + i * (L - 0.3) / 2.2, 0.38 + rnd() * 0.06, 0.2 + rnd() * 0.12, 0.28 + rnd() * 0.06); }
    box(rx + 0.24, F + 1.0, zc, 0.02, 2.0, L, '#59656d', false);
  }
  // Back layer: wheeled cage cart of parcels in front of the shutter, a hand trolley, wall shelf with tape and labels.
  {
    const cx = 0.95, cz = -4.1;
    box(cx, F + 0.1, cz, 0.7, 0.04, 0.9, '#59656d'); for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(cx + sx * 0.28, F + 0.04, cz + sz * 0.38, 0.04, 0.04, '#2a2e33').rotation.x = PI / 2;
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(cx + x * 0.33, F + 0.7, cz + z * 0.43, 0.025, 1.2, 0.025, '#59656d', false);
    for (const y of [0.45, 0.95, 1.28]) { box(cx, F + y, cz - 0.43, 0.7, 0.02, 0.02, '#59656d', false); box(cx - 0.33, F + y, cz, 0.02, 0.02, 0.9, '#59656d', false); box(cx + 0.33, F + y, cz, 0.02, 0.02, 0.9, '#59656d', false); }
    parcel(cx - 0.12, F + 0.27, cz - 0.1, 0.4, 0.3, 0.5); parcel(cx + 0.14, F + 0.25, cz + 0.2, 0.3, 0.26, 0.34); parcel(cx, F + 0.62, cz, 0.44, 0.34, 0.5, '#bfa070'); parcel(cx + 0.08, F + 0.97, cz + 0.05, 0.3, 0.26, 0.34);
  }
  box(-1.7, F + 1.0, IZ1 + 0.1, 0.9, 0.04, 0.2, wood); for (let i = 0; i < 4; i++) box(-2.0 + i * 0.2, F + 1.1, IZ1 + 0.1, 0.1, 0.14, 0.1, W(['#c23a30', '#e0b030', '#4f7fb0', '#e8e0cc'][i], 0.4));
  tube(-1.4, -1.2, 1.6, 'x'); tube(1.4, -1.2, 1.2, 'x'); tube(-1.0, -3.0, 2.0, 'z'); tube(1.0, -3.8, 1.8, 'z'); tube(-2.0, -4.4, 1.0, 'x');
  for (const [x, z, r] of [[-1.7, -0.7, 1.5], [1.5, -0.7, 1.5], [-1.0, -1.7, 1.8], [-1.4, -3.5, 1.9], [1.0, -4.0, 1.7], [1.9, -3.0, 1.4]]) decal(r, r, x, F + 0.003, z, [0, -1], pool);

  // ================= forecourt and attachments =================
  group('postFrontE');
  {
    // Red postbox: round cylinder on a base, domed top, two posting slots and a white 〒 plate.
    const px = -3.35, pz = 0.55, by = BASE;
    box(px, by + 0.04, pz, 0.46, 0.08, 0.46, '#7d7a73'); cyl(px, by + 0.7, pz, 0.2, 1.24, red); cyl(px, by + 0.1, pz, 0.22, 0.04, redD);
    mesh(new THREE.SphereGeometry(0.2, 12, 6, 0, PI * 2, 0, PI / 2), mat(red), px, by + 1.32, pz); cyl(px, by + 1.33, pz, 0.215, 0.03, redD); cyl(px, by + 0.78, pz, 0.215, 0.03, redD);
    for (const [y, w] of [[1.15, 0.2], [1.03, 0.2]]) box(px, by + y, pz + 0.205, w, 0.025, 0.012, '#1d1a18', false);
    const pl = canvasTex(64, 64, (q, w, h) => { q.fillStyle = '#efe9da'; q.fillRect(0, 0, w, h); mark(q, 32, 32, 34, '#c23a30'); });
    mesh(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshBasicMaterial({ map: pl, color: '#d8d2c4' }), px, by + 0.9, pz + 0.211, false);
    box(px, by + 0.62, pz + 0.205, 0.14, 0.08, 0.01, '#efe9da', false);
    planter(-2.7, -1.5, 0.1, 0.5, 3);
  }
  group('postFrontW');
  {
    // Parcel-locker terminal on a plinth beside the door, a bin and a planter.
    const lx = 1.8, lz = 0.4, by = BASE;
    box(lx, by + 0.03, lz, 0.5, 0.06, 0.4, '#7d7a73'); box(lx, by + 0.65, lz, 0.42, 1.18, 0.34, '#9aa3a8');
    box(lx, by + 0.98, lz + 0.172, 0.3, 0.3, 0.012, '#1f2a34', false); box(lx, by + 0.7, lz + 0.172, 0.34, 0.04, 0.012, '#c23a30', false);
    for (let i = 0; i < 3; i++) box(lx, by + 0.45 - i * 0.12, lz + 0.173, 0.3, 0.1, 0.01, '#b6bec2', false);
    box(lx + 0.42, by + 0.3, lz - 0.02, 0.3, 0.56, 0.3, '#59656d'); box(lx + 0.42, by + 0.59, lz - 0.02, 0.32, 0.04, 0.32, '#3f474f'); box(lx + 0.42, by + 0.5, lz + 0.14, 0.18, 0.05, 0.01, '#1d1a18', false);
    planter(2.45, 3.0, 0.3, 0.7, 2);
  }
  group('postSideE');
  {
    // Outdoor AC unit on a stand (east wall), a gas cylinder pair, a drain grate and low shrubs; a block wall behind.
    const by = BASE;
    box(-3.4, by + 0.05, -2.6, 0.5, 0.1, 0.94, '#7f8b93'); box(-3.4, by + 0.5, -2.6, 0.42, 0.78, 0.86, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.22, 18), mat('#3b4650'), -3.612, by + 0.55, -2.6, false).rotation.y = -PI / 2;
    for (let i = 0; i < 4; i++) box(-3.615, by + 0.35 + i * 0.08, -2.6, 0.01, 0.012, 0.44, '#9aa6ab', false);
    for (const z of [-4.2, -4.6]) { cyl(-3.35, by + 0.45, z, 0.15, 0.9, '#aeb5b8'); mesh(new THREE.SphereGeometry(0.15, 12, 6, 0, PI * 2, 0, PI / 2), mat('#aeb5b8'), -3.35, by + 0.9, z); cyl(-3.35, by + 0.98, z, 0.04, 0.08, '#59656d'); }
    box(-3.4, by + 0.015, -1.95, 0.5, 0.03, 0.4, '#3a4048', false); for (let i = 0; i < 6; i++) box(-3.4 - 0.2 + i * 0.08, by + 0.032, -1.95, 0.012, 0.012, 0.34, '#8a9298', false);
    planter(-3.9, -3.3, -1.7, -0.5, 3); pot(-3.5, by, -3.5, 0.14, 5, 1.3);
    // low concrete block wall along the east boundary with a cap, and climbing green
    box(-5.65, by + 0.7, -3.3, 0.2, 1.4, 5.2, '#a8a59c'); box(-5.65, by + 1.42, -3.3, 0.26, 0.05, 5.26, '#8a877e');
    for (let i = 0; i < 8; i++) box(-5.55, by + 0.2 + (i % 3) * 0.45, -0.9 - i * 0.6, 0.01, 0.02, 0.58, '#8a877e', false);
    for (let i = 0; i < 6; i++) shrub(-5.2, by + 0.2, -1.2 - i * 0.75, 0.3, 3, 1.6);
  }
  group('postParking');
  {
    // West-side bay for a delivery scooter: kerb stop, white painted outline, small fence; a red postal scooter parked in it.
    const by = BASE, bx = 4.15;
    box(bx, by + 0.045, -4.7, 1.9, 0.09, 0.14, '#d8b23a'); box(5.75, by + 0.7, -2.4, 0.08, 1.4, 5.8, '#a8a59c'); box(5.75, by + 1.42, -2.4, 0.12, 0.05, 5.86, '#8a877e', false);
    for (let i = 0; i < 4; i++) shrub(5.45, by + 0.15, -0.6 - i * 1.3, 0.3, 3, 1.5);
    const sx = bx, sz = -2.9, rotor = new THREE.Group(); rotor.position.set(sx, by, sz); group('postParking').add(rotor);
    const sb = (x, y, z, w, h, d, c) => box(x, y, z, w, h, d, c, true, rotor);
    for (const z of [-0.5, 0.5]) { const w = cyl(0, 0.17, z, 0.17, 0.08, '#2a2e33', rotor); w.rotation.z = PI / 2; }
    sb(0, 0.34, 0.05, 0.22, 0.2, 0.9, red); sb(0, 0.52, -0.1, 0.26, 0.1, 0.5, '#2f353b'); sb(0, 0.42, 0.55, 0.2, 0.34, 0.14, red); sb(0, 0.7, 0.55, 0.5, 0.06, 0.06, '#59656d');
    sb(0, 0.66, 0.66, 0.2, 0.14, 0.04, '#e6e1d4'); sb(0, 0.58, -0.68, 0.46, 0.34, 0.36, red); sb(0, 0.58, -0.87, 0.3, 0.18, 0.02, '#efe9da');
    sb(0.12, 0.27, 0.05, 0.02, 0.1, 0.4, '#8a9298'); sb(0, 0.76, 0.6, 0.12, 0.18, 0.05, '#2f353b');
    const sl = canvasTex(64, 64, (q, w, h) => { q.fillStyle = '#efe9da'; q.fillRect(0, 0, w, h); mark(q, 32, 32, 38, '#c23a30'); });
    mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: sl, color: '#d8d2c4' }), 0, 0.6, -1.056, false, rotor).rotation.y = PI;
    rotor.rotation.y = 0.04;
  }
  group('postRear');
  {
    const by = BASE;
    // Hood over the shutter on two brackets, a loading step with a scraper mat, two folded cage carts, crates and a hand trolley.
    box((RS[0] + RS[1]) / 2, 2.55, Z1 - 0.42, 3.0, 0.05, 0.62, '#444a52'); for (const x of [RS[0] - 0.3, RS[1] + 0.3]) { rod([x, 2.55, Z1 - 0.1], [x, 2.28, Z1 - 0.1], 0.015, aluL); box(x, 2.3, Z1 - 0.62, 0.05, 0.4, 0.05, '#444a52', false); }
    box((RS[0] + RS[1]) / 2, 2.62, Z1 - 0.7, 3.0, 0.1, 0.04, '#33383f', false);
    box(0.3, F - 0.06, Z1 - 0.34, 2.6, 0.12, 0.6, '#a39f96', false); box(0.3, F - 0.005, Z1 - 0.34, 2.4, 0.012, 0.5, '#5d5248', false);
    box(-1.8, by + 0.05, Z1 - 0.3, 0.9, 0.1, 0.4, '#a39f96'); box(-1.8, by + 0.11, Z1 - 0.3, 0.8, 0.014, 0.3, '#5d5248', false);
    for (let i = 0; i < 2; i++) { const cx = 1.55 + i * 0.12, cz = -5.55 - i * 0.05; box(cx, by + 0.32, cz, 0.7, 0.04, 0.8, '#59656d');
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(cx + x * 0.32, by + 0.9, cz + z * 0.38, 0.025, 1.2, 0.025, '#59656d', false);
      for (const y of [0.55, 1.0]) { box(cx, by + y, cz - 0.38, 0.66, 0.02, 0.02, '#59656d', false); box(cx - 0.32, by + y, cz, 0.02, 0.02, 0.76, '#59656d', false); box(cx + 0.32, by + y, cz, 0.02, 0.02, 0.76, '#59656d', false); } if (!i) parcel(cx, by + 0.52, cz, 0.5, 0.34, 0.5); }
    for (let i = 0; i < 3; i++) box(-0.6 + i * 0.0, by + 0.14 + i * 0.26, -5.6, 0.5, 0.24, 0.36, ['#3f6f9a', '#4f7fb0', '#3f6f9a'][i]);
    box(-3.2, by + 0.5, -5.45, 0.04, 1.0, 0.4, '#8a9298', false); box(-3.15, by + 0.12, -5.45, 0.2, 0.04, 0.4, '#8a9298', false);
    cyl(-3.2, by + 0.04, -5.3, 0.06, 0.03, '#2a2e33').rotation.x = PI / 2; cyl(-3.2, by + 0.04, -5.6, 0.06, 0.03, '#2a2e33').rotation.x = PI / 2;
    pot(2.6, by, -5.5, 0.15, 5, 1.4); pot(-2.7, by, -5.7, 0.12, 4, 1.2);
  }
  group('postGround');
  const paveMat = warm('#ffffff', 0, pavers), asphMat = warm('#ffffff', 0, asphalt);
  const pave = (x0, x1, z0, z1, m = paveMat, y = 0.198) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), m, (x0 + x1) / 2, y, (z0 + z1) / 2, false);
  pave(-4.2, 2.7, 0, 1.6); pave(-4.2, -3.0, -5.9, 0); pave(2.4, 2.7, -5.9, 0); pave(-3.0, 2.4, -6.1, -4.9);
  pave(2.7, 5.7, -5.2, 2.3, asphMat, 0.2);
  // Bay markings: white outline, yellow hatching at the entry and a stop line.
  for (const [x, z, w, d] of [[2.8, -1.5, 0.08, 7.0], [5.5, -1.5, 0.08, 7.0], [4.15, 2.0, 2.7, 0.08], [4.15, -4.5, 2.7, 0.08]]) box(x, 0.212, z, w, 0.006, d, '#e6e1d4', false);
  for (let i = 0; i < 5; i++) box(3.1 + i * 0.5, 0.212, 1.5, 0.12, 0.006, 0.7, '#d8b23a', false).rotation.y = 0.5;
  box(0, 0.214, 0.8, 1.4, 0.014, 0.6, '#58626c', false); box(0, 0.222, 0.8, 1.22, 0.004, 0.46, '#7a8590', false);   // entrance mat
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(1.7, 1.0, (FW[0] + FW[1]) / 2, 0.208, 1.0, [0, -1], spill); decal(1.5, 1.0, 0, 0.226, 0.95, [0, -1], spill); decal(1.5, 1.0, (FE[0] + FE[1]) / 2, 0.208, 1.0, [0, -1], spill);
  decal(1.4, 0.8, X0 - 0.45, 0.2, (EW[0] + EW[1]) / 2, [1, 0], additive(spillT, '#ffbf7a', 0.14)); decal(1.2, 0.8, X1 + 0.45, 0.2, (WW[0] + WW[1]) / 2, [-1, 0], additive(spillT, '#ffbf7a', 0.14));
  decal(1.6, 0.8, (RS[0] + RS[1]) / 2, 0.208, Z1 - 0.5, [0, 1], additive(glowT, '#ffc27e', 0.16)); decal(1.2, 0.4, (BD[0] + BD[1]) / 2, 0.208, Z1 - 0.3, [0, 1], additive(glowT, '#ffc27e', 0.2));

  // ================= local animation: counter lamp breathing, rooftop fan, window rain, canopy and scupper drips =================
  const fx = new THREE.Group(); fx.userData.live = true; group('post').add(fx); K.setRoot(fx);
  const lampM = additive(glowT, '#ffd9a0', 0.2); mesh(new THREE.PlaneGeometry(2.6, 2.6), lampM, -0.9, F + 1.4, -1.9, false, fx);
  const fan = new THREE.Group(); fan.userData.live = true; fan.position.set(-1.6, EF + 0.62, -3.6 + 0.21 + 0.012); roofLayer.add(fan);
  for (let i = 0; i < 3; i++) { const b = box(0, 0.09, 0, 0.05, 0.18, 0.012, '#aab2b4', false, fan); b.rotation.z = i * 2.094; b.position.set(-Math.sin(i * 2.094) * 0.09, Math.cos(i * 2.094) * 0.09, 0); }
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6), spout = batch('#d4ecea', 0.55);
  for (const [w, n] of [[FE, 5], [FW, 6]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 0.8, 0.52, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 12; i++) drips.add(-2.05 + i * 0.37 + rnd() * 0.1, 0.4 + rnd() * 1.5, 0.83, 0.09, 0.25, 2.5, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 6; i++) spout.add(X0 - 0.3 + (rnd() - 0.5) * 0.03, 0.3 + i * 0.5, -1.95 + (rnd() - 0.5) * 0.05, 0.22, 0.25, 3.3, 3.0 + rnd() * 0.6);
  runs.seal(); drips.seal(); spout.seal();
  // Reflection of the lit shopfront in the wet paving.
  const refT = tex(256, 64, (q, w, h) => { q.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = rnd() * w, ww = 2 + rnd() * 8, g = q.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(255,220,160,${0.4 + rnd() * 0.5})`); g.addColorStop(1, 'rgba(255,220,160,0)'); q.fillStyle = g; q.fillRect(x, 0, ww, h * (0.5 + rnd() * 0.5)); } });
  const refM = new THREE.MeshBasicMaterial({ map: refT, color: '#ffd8a0', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 });
  group('postGround'); decal(4.4, 1.0, 0, 0.209, 1.35, [0, -1], refM); group('post');
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt); spout.step(dt);
      fan.rotation.z -= dt * (1.8 + 0.4 * Math.sin(t * 0.3));
      lampM.opacity = 0.17 + 0.05 * Math.sin(t * 0.8) * Math.sin(t * 0.31 + 1);
      refT.offset.x = 0.012 * Math.sin(t * 0.6); refM.opacity = 0.15 + 0.05 * Math.sin(t * 0.9) * Math.sin(t * 0.37);
    },
  };
};
