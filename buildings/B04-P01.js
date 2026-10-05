// B04-P01 あめまち交番 (Amemachi Koban): a one-storey concrete police box on the main-street corner (B04, next to X01).
// Task card docs/buildings/tasks/B04-P01.md, reference docs/buildings/references/B04-P01.jpg.
// Local frame (placed by layout.js `buildings`, rotY 0): front +z faces the main street (world S), +x = world E
// (the viewer's right, where the patrol-bicycle shelter stands), door centre at the origin, floor top at rec.floor.
// Body 4.4 × 4.3: x -2.8…1.6, z -4.3…0 (parapet to x -2.9 / 1.7 and z +0.1 / -4.4); the bicycle shelter is part of the
// main group (x 1.6…3.9, z -4.2…0.1) so its roof can be registered as rain shelter; all inside the 7 × 6 envelope.
// Groups: koban (shell, glazing, awning, sign with red lamp, roof layer with parapet / AC / antennas, bicycle shelter,
// interior) · kobanFrontW (map board, planter) · kobanFrontE (planter, bollards, notice stand) · kobanSideW (outdoor AC,
// meters, bins, hedge toward the west street) · kobanRear (back-door step and canopy, AC, bins, slat fence) · kobanGround.
// Plan: lobby behind the glass front (visitor bench at the window, leaflet rack), counter with the duty desk behind it
// (two monitors, radio, phone), city map wall, filing cabinets and a comms rack at the rear, a small back room on the
// east with a sink and lockers; back door in the rear wall.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B04-P01'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(4401), PI = Math.PI;
  const F = rec.floor, X0 = -2.8, X1 = 1.6, Z0 = 0, Z1 = -4.3, T = 0.15, BASE = 0.19, EF = 3.3, CEIL = 3.0, PAR = 3.75;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T, ZC = (Z0 + Z1) / 2, XC = (X0 + X1) / 2;
  const FW = [-2.5, -0.8, 0.7, 2.3], FD = [-0.65, 0.65, F, 2.3];
  const WW = [-3.4, -2.2, 1.3, 2.1], EW = [-3.8, -3.0, 1.35, 2.05];
  const RD = [-0.55, 0.25, F, 2.2], RW = [0.6, 1.25, 1.5, 2.1];

  // ---- materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const conc = mat('#b4b6b3'), alu = '#4b5f7d', aluL = '#6f84a3', stoneC = '#8f918e', blueA = '#4c6b9a', metal = '#8a9298', red = '#c8362c';
  const wcache = {}, W = (c, k = 0.3) => wcache[c + k] || (wcache[c + k] = warm(c, k));
  const wood = W('#b58a58'), woodD = W('#6f4f3a', 0.26), cream = W('#eceadf', 0.36), steel = W('#bcc4c8', 0.22), white = W('#f0ece2', 0.34), navy = W('#3d4f73', 0.3), grey = W('#9aa3a8', 0.24);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffeab8' }), redBulb = new THREE.MeshBasicMaterial({ color: '#ff4a3a' });
  const tileF = tex(128, 128, (q, w, h) => { q.fillStyle = '#c9c5b6'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { q.fillStyle = `rgba(${(i + j) % 2 ? '255,252,240' : '96,92,80'},.1)`; q.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
    q.strokeStyle = 'rgba(70,66,56,.4)'; q.lineWidth = 1.5; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 32, 0); q.lineTo(i * 32, h); q.moveTo(0, i * 32); q.lineTo(w, i * 32); q.stroke(); } });
  const pavers = tex(256, 256, (q, w, h) => { q.fillStyle = '#9a9b97'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '66,76,92' : '250,246,236'},${0.05 + rnd() * 0.08})`; q.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    q.strokeStyle = 'rgba(48,56,68,.45)'; q.lineWidth = 2; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); }
    for (let i = 0; i < 800; i++) { q.fillStyle = `rgba(40,48,60,${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1); } });
  const roofT = tex(128, 128, (q, w, h) => { q.fillStyle = '#4b5057'; q.fillRect(0, 0, w, h); for (let i = 0; i < 600; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '10,14,20' : '170,184,200'},${0.04 + rnd() * 0.07})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } });
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: roofT });
  const glowT = canvasTex(128, 128, (q, w) => { const g = q.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.33)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, w); });
  const spillT = canvasTex(128, 128, (q, w, h) => { const g = q.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, h);
    q.globalCompositeOperation = 'destination-in'; const s = q.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.18, 'rgba(0,0,0,1)'); s.addColorStop(0.82, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = s; q.fillRect(0, 0, w, h); });
  const additive = (map, c, o) => new THREE.MeshBasicMaterial({ map, color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const decal = (w, h, x, y, z, heading, m, parent) => { const a = mesh(new THREE.PlaneGeometry(w, h), m, x, y, z, false, parent); a.rotation.set(-PI / 2, Math.atan2(-heading[0], -heading[1]), 0, 'YXZ'); return a; };
  const ab = (axis, u, y, d, w, h, t, c, o = true, p) => axis === 'x' ? box(u, y, d, w, h, t, c, o, p) : box(d, y, u, t, h, w, c, o, p);
  const rod = (a, b, r, c, parent) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 5, 1, true), typeof c === 'string' ? mat(c) : c, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, false, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  const mapT = canvasTex(256, 192, (q, w, h) => { q.fillStyle = '#dfe6e2'; q.fillRect(0, 0, w, h); q.fillStyle = '#a9c8dc'; q.beginPath(); q.moveTo(0, 150); q.bezierCurveTo(70, 120, 150, 170, 256, 110); q.lineTo(256, 135); q.bezierCurveTo(150, 190, 70, 145, 0, 175); q.fill();
    q.strokeStyle = '#f7f4ea'; q.lineWidth = 7; for (const [a, b, c, d] of [[0, 70, 256, 60], [100, 0, 90, 192], [190, 0, 200, 192], [0, 20, 256, 30]]) { q.beginPath(); q.moveTo(a, b); q.lineTo(c, d); q.stroke(); }
    q.strokeStyle = '#c9c4b2'; q.lineWidth = 2; for (let i = 0; i < 14; i++) { q.beginPath(); q.moveTo(rnd() * w, rnd() * h); q.lineTo(rnd() * w, rnd() * h); q.stroke(); }
    q.fillStyle = '#c8362c'; q.beginPath(); q.arc(100, 66, 7, 0, 6.3); q.fill(); q.fillStyle = '#9fc59a'; q.fillRect(20, 85, 55, 38); q.fillRect(205, 30, 40, 30); });
  // Original simplified emblem: a gold disc with eight rays (no official insignia).
  const emblem = (q, x, y, s, c) => { q.fillStyle = c; q.beginPath(); q.arc(x, y, s * 0.34, 0, 6.3); q.fill(); for (let i = 0; i < 8; i++) { const a = i * PI / 4; q.beginPath(); q.moveTo(x + Math.cos(a - 0.2) * s * 0.4, y + Math.sin(a - 0.2) * s * 0.4); q.lineTo(x + Math.cos(a) * s * 0.58, y + Math.sin(a) * s * 0.58); q.lineTo(x + Math.cos(a + 0.2) * s * 0.4, y + Math.sin(a + 0.2) * s * 0.4); q.fill(); } };

  // ---- plants ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), LEAF = ['#6c9476', '#88a98a', '#5e8a6a'];
  const shrub = (x, y, z, r, n, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(LEAF[i % 3]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.8 + rnd() * r * h * 0.7, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.5 + rnd() * 0.25)); } };
  const planter = (x0, x1, z0, z1, n) => { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; box(cx, BASE + 0.16, cz, x1 - x0, 0.32, z1 - z0, '#a7a49b'); box(cx, BASE + 0.33, cz, x1 - x0 - 0.1, 0.03, z1 - z0 - 0.1, '#4a4034', false);
    for (let i = 0; i < n; i++) shrub(x0 + 0.15 + (i + 0.5) * (x1 - x0 - 0.3) / n, BASE + 0.34, cz, 0.2, 2, 1.4); };

  // ================= shell =================
  group('koban');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, EF], [FW, FD], conc);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, EF], [RD, RW], conc);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, EF], [EW], conc);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, EF], [WW], conc);
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FD[0], Z0, 1); plinth('x', FD[1], X1, Z0, 1); plinth('x', X0, RD[0], Z1, -1); plinth('x', RD[1], X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  // Concrete panel joints: horizontal grooves and form-tie dimples.
  for (const y of [1.25, 2.55]) { for (const [axis, d, a, b, out] of [['x', Z0, X0, X1, 1], ['x', Z1, X0, X1, -1], ['z', X1, Z1, Z0, 1], ['z', X0, Z1, Z0, -1]]) ab(axis, (a + b) / 2, y, d + out * 0.002, b - a, 0.015, 0.01, '#8e908d', false); }
  for (const [x, z] of [[X0 + 0.04, Z0 - 0.04], [X1 - 0.04, Z0 - 0.04], [X0 + 0.04, Z1 + 0.04], [X1 - 0.04, Z1 + 0.04]]) box(x, (BASE + EF) / 2, z, 0.1, EF - BASE, 0.1, '#a2a4a1');
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - IZ1), (IX1 - IX0) / 1.2, (IZ0 - IZ1) / 1.2), warm('#ffffff', 0.2, tileF), XC, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL], [FW, FD], cream); panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL], [EW], cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL], [WW], cream); panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL], [RD, RW], cream);
  box(XC, F + 0.45, IZ1 + 0.01, IX1 - IX0, 0.9, 0.012, W('#c9cdd2', 0.3), false); for (const x of [IX0 + 0.006, IX1 - 0.006]) box(x, F + 0.45, (IZ0 + IZ1) / 2, 0.012, 0.9, IZ0 - IZ1, W('#c9cdd2', 0.3), false);

  // ---- glazing ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = []) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, alu); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, alu); ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, alu); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, alu);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.045, q - p, fd * 0.9, alu); for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.04, fd * 0.9, alu);
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.1, 0.05, 0.15, '#a8a69d'); }
  glaze('x', -T / 2, 1, FW, [-1.65], [1.5]); glaze('z', X0 + T / 2, -1, WW, [-2.8]); glaze('z', X1 - T / 2, 1, EW, [-3.4]);
  box((FW[0] + FW[1]) / 2, (0.32 + FW[2] - 0.05) / 2, 0.012, FW[1] - FW[0] - 0.04, FW[2] - 0.05 - 0.32, 0.02, '#5f6c7e');
  // Front door: double glass door in blue frames, push bars; stickers.
  ab('x', FD[0] + 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, alu); ab('x', FD[1] - 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, alu); box(0, FD[3] - 0.03, -T / 2, FD[1] - FD[0], 0.06, 0.16, alu);
  { const z = -0.05, top = FD[3] - 0.06;
    for (const x of [-0.6, -0.03, 0.03, 0.6]) box(x, (F + top) / 2, z, 0.06, top - F, 0.045, aluL); box(0, top - 0.04, z, 1.26, 0.08, 0.045, aluL); box(0, F + 0.05, z, 1.26, 0.1, 0.045, aluL);
    box(0, (F + 0.1 + top - 0.08) / 2, z, 1.2, top - 0.08 - F - 0.1, 0.012, glass, false);
    for (const x of [-0.16, 0.16]) box(x, 1.1, z + 0.03, 0.025, 0.5, 0.025, '#c9c9c0'); box(-0.45, 1.5, z + 0.012, 0.22, 0.14, 0.006, '#d8b23a', false); box(0.45, 1.5, z + 0.012, 0.22, 0.16, 0.006, red, false); }
  box(0, 0.243, 0.35, 1.5, 0.104, 0.7, stoneC, false);   // threshold apron
  // Rear: steel door with a small wired-glass window, lever, drip cap; barred window; wall lamp.
  ab('x', RD[0] + 0.03, (F + RD[3]) / 2, Z1 + T / 2, 0.06, RD[3] - F, 0.16, alu); ab('x', RD[1] - 0.03, (F + RD[3]) / 2, Z1 + T / 2, 0.06, RD[3] - F, 0.16, alu); box((RD[0] + RD[1]) / 2, RD[3] - 0.03, Z1 + T / 2, RD[1] - RD[0], 0.06, 0.16, alu);
  box((RD[0] + RD[1]) / 2, (F + RD[3] - 0.06) / 2, Z1 + 0.06, RD[1] - RD[0] - 0.12, RD[3] - 0.06 - F, 0.04, '#5f7491'); box((RD[0] + RD[1]) / 2, 1.8, Z1 + 0.035, 0.4, 0.34, 0.012, '#9fb1b8', false);
  box(RD[1] - 0.14, 1.1, Z1 + 0.02, 0.03, 0.16, 0.04, '#c9c9c0'); box(RD[1] - 0.14, 1.1, Z1 - 0.03, 0.16, 0.025, 0.04, '#c9c9c0');
  glaze('x', Z1 + T / 2, -1, RW, [], []); for (let i = 1; i < 5; i++) ab('x', RW[0] + (RW[1] - RW[0]) * i / 5, (RW[2] + RW[3]) / 2, Z1 - 0.04, 0.02, RW[3] - RW[2], 0.02, '#3a3f45', false);
  box(RD[1] + 0.35, 2.05, Z1 - 0.06, 0.12, 0.17, 0.1, '#3d4a58'); box(RD[1] + 0.35, 2.04, Z1 - 0.06, 0.09, 0.12, 0.105, bulb, false); mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffe8b8', 0.24), RD[1] + 0.35, 2.05, Z1 - 0.004, false).rotation.y = PI;
  // Pipes: downpipes at the front-west and rear-east corners, conduit along the front pier, wall lamp and a notice case right of the door.
  for (const [x, z] of [[X0 - 0.06, Z0 - 0.3], [X1 + 0.06, Z1 + 0.3]]) { const s = Math.sign(x); cyl(x, (PAR + 0.2) / 2, z, 0.04, PAR - 0.2, '#8f979c'); for (const y of [0.9, 2.0, 3.0]) rod([x, y, z], [x - s * 0.06, y, z], 0.012, '#5f6c76'); box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91'); }
  box(1.2, 1.5, 0.05, 0.62, 0.92, 0.08, '#3a424a'); box(1.2, 1.5, 0.09, 0.56, 0.86, 0.01, glass, false);
  for (const [dx, dy, c] of [[-0.12, 0.2, '#d8a43a'], [0.12, 0.2, '#4f8aa8'], [-0.12, -0.18, '#e8e0cc'], [0.12, -0.18, '#c8362c']]) box(1.2 + dx, 1.5 + dy, 0.088, 0.2, 0.3, 0.004, W(c, 0.5), false);
  K.label('お知らせ', 1.2, 2.02, 0.094, 0.5, 0.1, '#2f3f5c', '#f3ead0', 62);
  box(-2.78, 2.0, 0.07, 0.12, 0.18, 0.1, '#3d4a58'); box(-2.78, 1.99, 0.07, 0.09, 0.13, 0.105, bulb, false); mesh(new THREE.PlaneGeometry(0.4, 0.4), additive(glowT, '#ffe8b8', 0.22), -2.7, 2, 0.05, false);
  // Louvred vent on the east wall, a blank gas meter on the west wall.
  for (let i = 0; i < 6; i++) box(X1 + 0.03, 2.2 + i * 0.07, -1.5, 0.04, 0.03, 0.6, '#6a727a', false);

  // ================= roof layer: parapet, membrane, AC, antennas, tubes =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('koban').add(roofLayer); K.setRoot(roofLayer);
  {
    const x0 = X0 - 0.1, x1 = X1 + 0.1, zf = Z0 + 0.1, zr = Z1 - 0.1, h = PAR - EF, y = EF + h / 2;
    box(XC, y, zf - 0.05, x1 - x0, h, 0.1, '#a7a9a6'); box(XC, y, zr + 0.05, x1 - x0, h, 0.1, '#a7a9a6'); box(x0 + 0.05, y, ZC, 0.1, h, zf - zr, '#a7a9a6'); box(x1 - 0.05, y, ZC, 0.1, h, zf - zr, '#a7a9a6');
    box(XC, PAR + 0.025, zf - 0.05, x1 - x0 + 0.04, 0.05, 0.16, '#85878a'); box(XC, PAR + 0.025, zr + 0.05, x1 - x0 + 0.04, 0.05, 0.16, '#85878a'); box(x0 + 0.05, PAR + 0.025, ZC, 0.16, 0.05, zf - zr, '#85878a'); box(x1 - 0.05, PAR + 0.025, ZC, 0.16, 0.05, zf - zr, '#85878a');
    mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0 + 0.1, 0.1, IZ0 - IZ1 + 0.1), 3, 3), roofM, XC, EF + 0.05, ZC, false);
    box(XC, CEIL + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#e6e4d8', 0.34), false);
    for (const [x, z] of [[-2.4, -0.5], [1.2, -3.9]]) { cyl(x, EF + 0.11, z, 0.12, 0.03, '#5d6670'); cyl(x, EF + 0.13, z, 0.07, 0.03, '#252a30'); }
    const ac = (x, z, w, d) => { for (const dz of [-d * 0.35, d * 0.35]) box(x, EF + 0.17, z + dz, w + 0.1, 0.12, 0.08, '#2f363c'); box(x, EF + 0.58, z, w, 0.9, d, '#d8dad4'); box(x, EF + 1.06, z, w + 0.04, 0.06, d + 0.04, '#aab2b4');
      mesh(new THREE.CircleGeometry(w * 0.34, 18), mat('#2e363e'), x, EF + 0.62, z + d / 2 + 0.006, false); for (let i = 0; i < 5; i++) box(x, EF + 0.42 + i * 0.09, z + d / 2 + 0.008, w * 0.6, 0.014, 0.01, '#8a9498', false); };
    ac(-1.6, -3.4, 0.9, 0.42); ac(0.6, -3.4, 0.9, 0.42);
    line([[-1.6, EF + 0.12, -3.2], [-1.6, EF + 0.12, -2.4], [0.6, EF + 0.12, -2.4], [0.6, EF + 0.12, -3.2]], '#9aa3a6', 0.022);
    // two antenna masts (cross-arms, stays) and a small radio dome
    for (const [x, z, h2] of [[1.2, -0.6, 1.9], [-2.4, -3.8, 1.5]]) { cyl(x, EF + 0.1, z, 0.1, 0.06, '#5d6670'); cyl(x, EF + h2 / 2, z, 0.025, h2, '#9aa3a6'); for (const [dy, w] of [[h2 - 0.15, 0.6], [h2 - 0.5, 0.4]]) box(x, EF + dy, z, w, 0.02, 0.02, '#9aa3a6', false);
      for (const s of [-1, 1]) rod([x, EF + h2 - 0.2, z], [x + s * 0.4, EF + 0.05, z + s * 0.1], 0.006, '#6a727a'); }
    mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, PI * 2, 0, PI / 2), mat('#e6e4da'), 0.0, EF + 0.1, -1.4); cyl(0, EF + 0.06, -1.4, 0.18, 0.08, '#8a9298');
    box(-1.0, EF + 0.15, -1.0, 0.7, 0.2, 0.7, '#7d8886'); box(-1.0, EF + 0.27, -1.0, 0.76, 0.04, 0.76, '#566360');   // roof hatch
  }
  group('koban');
  // Front sign: grey board with 交番 and the emblem, and the red lamp globe on a bracket by the door.
  {
    const s = canvasTex(1024, 256, (q, w, h) => { q.fillStyle = '#e4e6e2'; q.fillRect(0, 0, w, h); q.strokeStyle = '#5b6a82'; q.lineWidth = 6; q.strokeRect(6, 6, w - 12, h - 12);
      emblem(q, 150, 128, 170, '#d8a93a'); q.fillStyle = '#26303f'; q.textBaseline = 'middle'; q.textAlign = 'center'; q.font = 'bold 150px sans-serif'; q.fillText('交番', 560, 124); q.fillStyle = '#5f6a7a'; q.font = 'bold 34px sans-serif'; q.fillText('あめまち  KOBAN', 800, 216); });
    const sm = new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, emissive: '#2a2e32', emissiveMap: s });
    box(-0.55, 2.98, 0.04, 3.0, 0.46, 0.08, '#4a5058'); mesh(new THREE.PlaneGeometry(2.88, 0.36), sm, -0.55, 2.98, 0.083, false);
    rod([1.05, 2.62, 0.04], [1.05, 2.5, 0.28], 0.015, '#3a3f46'); mesh(new THREE.SphereGeometry(0.11, 12, 8), redBulb, 1.05, 2.4, 0.3, false); cyl(1.05, 2.53, 0.3, 0.07, 0.05, '#3a3f46');
  }
  // Blue awning: sloped sheet on tubular brackets, valance, rain dripping off the front edge.
  {
    const x0 = X0 - 0.1, x1 = X1 + 0.1, top = 2.6, low = 2.42, dep = 0.8, len = Math.hypot(dep, top - low), ang = Math.atan2(top - low, dep), cx = (x0 + x1) / 2;
    const e = box(cx, (top + low) / 2 + 0.01, dep / 2, x1 - x0, 0.05, len, blueA); e.rotation.x = ang; box(cx, low - 0.06, dep, x1 - x0 + 0.04, 0.14, 0.05, '#3d567e');
    for (const x of [x0 + 0.1, x1 - 0.1, -0.7, 0.9]) rod([x, top + 0.2, 0.03], [x, low - 0.02, dep - 0.04], 0.012, aluL);
  }
  // Bicycle shelter on the east side: posts, rafters, translucent roof, lean-to against the east wall, floor slab.
  {
    const xa = X1, xb = 3.85, zf = 0.1, zb = -4.2, ya = 2.75, yb = 2.55;
    for (const [x, z] of [[xb, zf - 0.1], [xb, -1.4], [xb, zb + 0.1]]) { box(x, (BASE + yb) / 2, z, 0.1, yb - BASE, 0.1, alu); box(x, BASE + 0.03, z, 0.2, 0.06, 0.2, stoneC); }
    const roof = new THREE.MeshPhysicalMaterial({ color: 0x5c7f98, transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
    const len = Math.hypot(xb - xa, ya - yb), ang = Math.atan2(ya - yb, xb - xa), xm = (xa + xb) / 2, ym = (ya + yb) / 2;
    const sheet = box(xm, ym + 0.03, (zf + zb) / 2, len, 0.015, zf - zb, roof, false); sheet.rotation.z = ang;
    for (let i = 0; i <= 4; i++) { const r = box(xm, ym + 0.005, zb + (zf - zb) * i / 4, len, 0.05, 0.05, alu); r.rotation.z = ang; }
    box(xb, yb - 0.02, (zf + zb) / 2, 0.06, 0.08, zf - zb, alu); box(xa + 0.02, ya, (zf + zb) / 2, 0.04, 0.06, zf - zb, '#6a727a');
    box((xa + xb) / 2 + 0.02, BASE + 0.015, (zf + zb) / 2, xb - xa, 0.03, zf - zb, '#a7a7a1', false);
    // bike rail with two stands and a lamp
    box(2.9, BASE + 0.04, -3.4, 1.6, 0.06, 0.12, '#6a727a', false); box(2.9, BASE + 0.04, -0.7, 1.6, 0.06, 0.12, '#6a727a', false);   // wheel stops
    box(2.7, 2.5, -2.0, 0.34, 0.05, 0.12, '#59656d'); box(2.7, 2.47, -2.0, 0.3, 0.02, 0.1, bulb, false); mesh(new THREE.PlaneGeometry(1.4, 1.4), additive(glowT, '#ffe8b8', 0.16), 2.7, 2.2, -2.0, false).rotation.x = -PI / 2;
  }

  // ================= interior =================
  const tube = (x, z, len, axis = 'x') => { const w = axis === 'x' ? len : 0.1, d = axis === 'x' ? 0.1 : len; box(x, CEIL - 0.04, z, w + 0.04, 0.05, d + 0.04, '#7d8b88', false, roofLayer); box(x, CEIL - 0.075, z, w, 0.02, d, W('#f4f8ff', 0.95), false, roofLayer); };
  // Near layer: visitor bench and a leaflet rack by the east pier; waiting chairs behind the window.
  box(-1.7, F + 0.22, -0.5, 1.4, 0.05, 0.42, navy); box(-1.7, F + 0.45, -0.7, 1.4, 0.36, 0.05, navy); for (const x of [-2.3, -1.1]) box(x, F + 0.1, -0.5, 0.05, 0.2, 0.36, '#59656d', false);
  box(1.25, F + 0.55, -0.5, 0.3, 1.1, 0.22, '#59656d'); for (let k = 0; k < 4; k++) for (let j = 0; j < 2; j++) box(1.25 - 0.01, F + 0.25 + k * 0.25, -0.5 + (j - 0.5) * 0.08 + 0.12, 0.012, 0.18, 0.05, W(['#d8a43a', '#4f8aa8', '#c0463a', '#e8e0cc'][(k + j) % 4], 0.5), false);
  for (const [z, c] of [[-1.0, '#4f8aa8'], [-1.6, '#d8a43a']]) { box(IX1 - 0.02, F + 1.5, z, 0.02, 0.5, 0.4, '#59656d', false); box(IX1 - 0.035, F + 1.5, z, 0.01, 0.42, 0.32, W(c, 0.5), false); }
  // Mid layer: counter with a lowered writing ledge, duty desk behind it with two monitors, radio, phone, lamp and two chairs.
  {
    const x0 = -2.65, x1 = -0.9, z0 = -1.75, z1 = -2.3, top = F + 0.98, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(cx, F + 0.45, cz, x1 - x0, 0.9, z0 - z1, woodD); box(cx, top - 0.03, cz, x1 - x0 + 0.04, 0.06, z0 - z1 + 0.1, wood); box(cx, F + 0.2, z0 + 0.012, x1 - x0 - 0.06, 0.2, 0.012, '#4a3a30', false);
    box(-1.6, top + 0.06, cz + 0.12, 0.3, 0.12, 0.22, W('#3f464e', 0.12)); box(-2.15, top + 0.04, cz + 0.12, 0.3, 0.02, 0.2, W('#e9e4d6', 0.3), false); cyl(-1.0 - 0.1, top + 0.08, cz + 0.1, 0.04, 0.12, W('#c8362c', 0.4));
    const dx = -1.8, dz = -3.3;
    box(dx, F + 0.74, dz, 1.7, 0.05, 0.7, wood); for (const s of [-1, 1]) box(dx + s * 0.8, F + 0.37, dz, 0.05, 0.72, 0.62, woodD); box(dx, F + 0.42, dz - 0.3, 1.6, 0.6, 0.03, woodD, false);
    for (const x of [dx - 0.35, dx + 0.1]) { box(x, F + 1.0, dz - 0.1, 0.42, 0.28, 0.03, W('#2a3036', 0.12)); box(x, F + 1.0, dz - 0.083, 0.36, 0.22, 0.004, W('#9fc4e8', 0.9), false); box(x, F + 0.82, dz - 0.1, 0.06, 0.1, 0.06, '#59656d'); box(x, F + 0.78, dz + 0.1, 0.34, 0.018, 0.12, W('#2a3036', 0.12), false); }
    box(dx + 0.62, F + 0.82, dz - 0.05, 0.22, 0.1, 0.16, W('#59656d', 0.2)); box(dx + 0.62, F + 0.9, dz - 0.12, 0.2, 0.05, 0.02, W('#9fe4a8', 0.8), false); box(dx - 0.65, F + 0.78, dz + 0.12, 0.12, 0.04, 0.2, W('#e0d8c4', 0.4));
    rod([dx - 0.55, F + 0.77, dz - 0.2], [dx - 0.45, F + 1.15, dz - 0.2], 0.008, '#59656d'); box(dx - 0.43, F + 1.16, dz - 0.2, 0.14, 0.04, 0.1, W('#ffeab8', 0.95), false);
    for (const cx2 of [-1.7, -0.9]) { cyl(cx2, F + 0.28, -2.75, 0.04, 0.5, '#59656d'); box(cx2, F + 0.5, -2.75, 0.4, 0.06, 0.4, navy); box(cx2, F + 0.75, -2.55, 0.38, 0.4, 0.05, navy); for (const a of [0, 1, 2, 3, 4]) box(cx2 + Math.cos(a * 1.26) * 0.16, 0.22, -2.75 + Math.sin(a * 1.26) * 0.16, 0.04, 0.04, 0.04, '#2f363c', false); }
  }
  // Back layer: city map wall, file cabinets and a comms rack on the west and rear walls; back room east with sink and lockers.
  { box(-1.6, F + 1.6, IZ1 + 0.02, 1.95, 1.2, 0.03, '#59656d'); mesh(new THREE.PlaneGeometry(1.85, 1.1), new THREE.MeshBasicMaterial({ map: mapT, color: '#d8d8d0' }), -1.6, F + 1.6, IZ1 + 0.04, false);
    cyl(-0.35, F + 2.15, IZ1 + 0.03, 0.15, 0.03, '#f0ece2').rotation.x = PI / 2; box(-0.35, F + 2.15, IZ1 + 0.025, 0.012, 0.12, 0.012, '#2a3036', false);
    for (const z of [-3.5, -3.95]) { box(IX0 + 0.22, F + 0.65, z, 0.4, 1.3, 0.4, grey); for (const y of [0.3, 0.7, 1.1]) box(IX0 + 0.425, F + y, z, 0.012, 0.3, 0.34, W('#7f8b93', 0.2), false); box(IX0 + 0.43, F + 0.7, z, 0.01, 0.04, 0.12, '#59656d', false); }
    box(IX0 + 0.3, F + 0.9, -1.1, 0.5, 1.8, 0.4, '#2f353b'); for (let i = 0; i < 6; i++) box(IX0 + 0.56, F + 0.35 + i * 0.22, -1.1, 0.012, 0.06, 0.3, W(i % 2 ? '#7ae28a' : '#e8a24a', 0.9), false);
    // back room
    box(0.35, F + 1.35, -3.5, 0.08, 2.7, 1.3, cream); box(0.9, F + 1.35, -2.9, 1.1, 2.7, 0.08, cream); box(0.9, F + 2.55, -2.9, 0.74, 0.3, 0.1, W('#c9cdd2', 0.3), false);
    for (const x of [0.5, 1.3]) box(x, F + 1.0, -2.9, 0.05, 2.0, 0.1, '#8a8276', false); box(0.9, F + 2.0, -2.9, 0.8, 0.04, 0.1, '#8a8276', false);
    box(1.05, F + 0.45, -3.9, 0.7, 0.9, 0.4, steel); box(1.05, F + 0.92, -3.9, 0.74, 0.04, 0.44, W('#e6eaea', 0.3)); mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 10), W('#aab3b7', 0.3), 1.05, F + 0.95, -3.88, false); box(1.05, F + 1.18, -4.08, 0.02, 0.24, 0.02, '#8a9298', false); box(1.05, F + 1.3, -4.0, 0.02, 0.02, 0.18, '#8a9298', false);
    box(0.6, F + 0.9, -4.0, 0.3, 1.8, 0.4, '#8d979d'); box(0.45, F + 0.85, -3.7, 0.01, 1.7, 0.1, '#7f898f', false);
    for (const [x, z, r] of [[-1.7, -0.9, 1.5], [-1.5, -2.9, 1.9], [0.0, -1.8, 1.6], [0.9, -3.5, 1.2]]) decal(r, r, x, F + 0.003, z, [0, -1], additive(glowT, '#ffe6b8', 0.26));
  }
  tube(-1.4, -0.9, 1.8, 'x'); tube(-1.4, -2.9, 1.8, 'x'); tube(0.9, -3.5, 0.9, 'x'); tube(0.2, -1.5, 1.2, 'z');

  // ================= attachments =================
  group('kobanFrontW'); {
    // Neighbourhood map board on two posts at the front-west corner, lit by a small canopy lamp; planter beside it.
    const bx = -2.0, bz = 1.15, by = BASE;
    for (const s of [-1, 1]) box(bx + s * 0.62, by + 0.7, bz, 0.07, 1.4, 0.07, alu); box(bx, by + 1.1, bz, 1.4, 0.88, 0.08, '#3a424a'); mesh(new THREE.PlaneGeometry(1.26, 0.74), new THREE.MeshBasicMaterial({ map: mapT, color: '#d0d4cc' }), bx, by + 1.1, bz + 0.045, false);
    box(bx, by + 1.62, bz + 0.05, 1.5, 0.05, 0.2, '#4a5058'); box(bx, by + 1.6, bz + 0.12, 1.2, 0.02, 0.03, bulb, false); mesh(new THREE.PlaneGeometry(1.8, 0.8), additive(glowT, '#ffe8b8', 0.12), bx, by + 1.3, bz + 0.2, false);
    K.label('周辺地図', bx, by + 0.58, bz + 0.047, 0.8, 0.1, '#2f3f5c', '#f3ead0', 60);
    planter(-3.3, -2.75, 0.55, 1.2, 2); }
  group('kobanFrontE'); {
    // East of the door: planter, two bollards at the shelter mouth, a small standing notice sign.
    planter(0.95, 1.55, 0.35, 0.8, 2);
    for (const x of [2.1, 3.7]) { cyl(x, BASE + 0.3, 0.75, 0.05, 0.6, '#6a727a'); cyl(x, BASE + 0.6, 0.75, 0.055, 0.04, '#d8b23a'); }
    box(2.9, BASE + 0.42, 1.1, 0.5, 0.7, 0.04, '#3d567e'); box(2.9, BASE + 0.45, 1.125, 0.42, 0.5, 0.01, W('#e8e0cc', 0.5), false); box(2.9, BASE + 0.05, 1.1, 0.5, 0.1, 0.2, '#6a727a'); }
  group('kobanBikes'); {
    // Two patrol bicycles (wheels, frame lines, basket, light, stand) parked under the shelter.
    const bike = (x, z, c) => { const g = new THREE.Group(); g.position.set(x, BASE + 0.02, z); group('kobanBikes').add(g);
      for (const dz of [-0.5, 0.5]) { const t = mesh(new THREE.TorusGeometry(0.31, 0.03, 8, 20), mat('#253b49'), 0, 0.33, dz, false, g); t.rotation.y = PI / 2; const r = mesh(new THREE.TorusGeometry(0.27, 0.01, 6, 20), mat('#94b3b4'), 0, 0.33, dz, false, g); r.rotation.y = PI / 2; }
      line([[0, 0.33, -0.5], [0, 0.72, -0.2], [0, 0.33, 0.05], [0, 0.33, -0.5], [0, 0.66, 0.38], [0, 0.33, 0.5], [0, 0.33, 0.05]], c, 0.026, g); line([[0, 0.33, 0.5], [0, 0.84, 0.4], [-0.16, 0.9, 0.38]], '#9bb8bc', 0.022, g);
      box(0, 0.76, -0.18, 0.2, 0.05, 0.22, '#344352', true, g); box(0, 0.76, 0.62, 0.32, 0.2, 0.3, '#69848a', true, g); box(0, 0.88, 0.52, 0.05, 0.05, 0.05, bulb, false, g); };
    bike(2.45, -2.0, '#4f7fb0'); bike(3.3, -2.0, '#c4a083'); }
  group('kobanSideW'); {
    // West street side: outdoor AC on a stand, meters, bins and a low hedge along the pavement edge.
    box(-3.2, BASE + 0.05, -2.3, 0.5, 0.1, 0.94, '#7f8b93'); box(-3.2, BASE + 0.5, -2.3, 0.42, 0.78, 0.86, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.22, 18), mat('#3b4650'), -3.412, BASE + 0.55, -2.3, false).rotation.y = -PI / 2;
    for (let i = 0; i < 4; i++) box(-3.415, BASE + 0.35 + i * 0.08, -2.3, 0.01, 0.012, 0.44, '#9aa6ab', false);
    box(-2.95, 1.45, -0.9, 0.16, 0.42, 0.34, '#c4c6c0', false); box(-2.95, 1.5, -1.45, 0.16, 0.3, 0.26, '#b8bbb4', false); line([[-2.88, 1.2, -0.9], [-2.88, 0.6, -0.9], [-3.0, 0.4, -0.9]], '#8a9298', 0.018);
    box(-3.7, BASE + 0.4, -3.5, 0.5, 0.8, 0.5, '#4f6f58'); box(-3.7, BASE + 0.83, -3.5, 0.54, 0.06, 0.54, '#3a5242'); box(-3.7, BASE + 0.4, -4.1, 0.5, 0.8, 0.5, '#8a7a4a'); box(-3.7, BASE + 0.83, -4.1, 0.54, 0.06, 0.54, '#6a5c34');
    planter(-4.6, -3.9, -1.7, -0.3, 3); for (let i = 0; i < 4; i++) shrub(-4.5, BASE, -2.2 - i * 0.55, 0.28, 3, 1.5); }
  group('kobanRear'); {
    // Back-door step with a scraper mat and a small canopy, a second AC unit, bins, drain grate and a dark slat fence to the east.
    const by = BASE;
    box(-0.15, by + 0.06, Z1 - 0.3, 1.1, 0.12, 0.5, '#a39f96'); box(-0.15, by + 0.125, Z1 - 0.3, 0.9, 0.014, 0.4, '#5d5248', false);
    box(-0.15, 2.5, Z1 - 0.4, 1.5, 0.05, 0.6, '#3d567e'); for (const x of [-0.85, 0.55]) rod([x, 2.5, Z1 - 0.1], [x, 2.25, Z1 - 0.1], 0.015, aluL); box(-0.15, 2.58, Z1 - 0.68, 1.5, 0.1, 0.04, '#33475f', false);
    box(-2.1, by + 0.05, Z1 - 0.35, 0.9, 0.1, 0.4, '#7f8b93'); box(-2.1, by + 0.5, Z1 - 0.35, 0.82, 0.78, 0.38, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), -2.1, by + 0.55, Z1 - 0.545, false).rotation.y = PI;
    for (const x of [1.3, 1.85]) { box(x, by + 0.45, Z1 - 0.4, 0.45, 0.9, 0.45, x < 1.5 ? '#5d6c8a' : '#8a7a4a'); box(x, by + 0.93, Z1 - 0.4, 0.5, 0.06, 0.5, '#3a3f46'); }
    box(1.0, by + 0.015, Z1 - 0.9, 0.5, 0.03, 0.4, '#3a4048', false); for (let i = 0; i < 6; i++) box(0.8 + i * 0.08, by + 0.032, Z1 - 0.9, 0.012, 0.012, 0.34, '#8a9298', false);
    for (let i = 0; i < 14; i++) box(1.65 + i * 0.12, by + 0.7, Z1 - 0.1 - 0.0, 0.07, 1.4, 0.04, '#3f3a36', false); box(2.5, by + 1.38, Z1 - 0.1, 1.8, 0.05, 0.08, '#2f2b28'); box(2.5, by + 0.5, Z1 - 0.1, 1.8, 0.05, 0.08, '#2f2b28', false);
    shrub(-2.7, by, Z1 - 0.2, 0.3, 3, 1.4); shrub(3.2, by, Z1 - 0.5, 0.3, 4, 1.5); }
  group('kobanGround');
  const paveMat = warm('#ffffff', 0, pavers), asphMat = warm('#ffffff', 0, tex(128, 128, (q, w, h) => { q.fillStyle = '#62666e'; q.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '28,32,38' : '190,196,204'},${0.05 + rnd() * 0.08})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } }));
  const pave = (x0, x1, z0, z1, m = paveMat, y = 0.198) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), m, (x0 + x1) / 2, y, (z0 + z1) / 2, false);
  pave(-4.9, 4.9, -0.2, 2.9); pave(-4.9, -2.9, -5.9, -0.2); pave(-2.9, 4.9, -5.9, -4.4); pave(1.7, 4.9, -4.4, -0.2, asphMat, 0.2);
  // Tactile paving (yellow strips) from the door to the plot edge, entrance mat and light pools.
  for (let i = 0; i < 10; i++) { box(0, 0.212, 0.5 + i * 0.22, 0.34, 0.01, 0.2, '#d8b23a', false); }
  box(0, 0.214, 0.4, 1.4, 0.014, 0.6, '#58626c', false); box(0, 0.222, 0.4, 1.22, 0.004, 0.46, '#7a8590', false);
  const spill = additive(spillT, '#ffe9bd', 0.26);
  decal(2.0, 1.0, (FW[0] + FW[1]) / 2, 0.208, 1.0, [0, -1], spill); decal(1.6, 1.0, 0, 0.226, 0.95, [0, -1], spill);
  decal(1.4, 0.8, X0 - 0.45, 0.2, (WW[0] + WW[1]) / 2, [1, 0], additive(spillT, '#ffe9bd', 0.14)); decal(1.2, 0.8, X1 + 0.5, 0.2, (EW[0] + EW[1]) / 2, [-1, 0], additive(spillT, '#ffe9bd', 0.14));
  decal(1.2, 0.4, (RD[0] + RD[1]) / 2, 0.208, Z1 - 0.3, [0, 1], additive(glowT, '#ffe8b8', 0.2));
  decal(1.3, 1.3, 1.05, 0.21, 0.35, [0, -1], additive(glowT, '#ff5a46', 0.1));
  const refT = tex(256, 64, (q, w, h) => { q.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = rnd() * w, ww = 2 + rnd() * 8, g = q.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(255,236,190,${0.4 + rnd() * 0.5})`); g.addColorStop(1, 'rgba(255,236,190,0)'); q.fillStyle = g; q.fillRect(x, 0, ww, h * (0.5 + rnd() * 0.5)); } });
  const refM = new THREE.MeshBasicMaterial({ map: refT, color: '#ffe6b8', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 });
  decal(4.0, 1.0, -0.8, 0.209, 1.45, [0, -1], refM);

  // ================= local animation: red lamp breathing, window rain, awning and shelter drips =================
  const fx = new THREE.Group(); fx.userData.live = true; group('koban').add(fx); K.setRoot(fx);
  const lampM = additive(glowT, '#ff3a2a', 0.3); mesh(new THREE.PlaneGeometry(0.9, 0.9), lampM, 1.05, 2.4, 0.34, false, fx);
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6);
  for (let i = 0; i < 6; i++) runs.add(FW[0] + 0.1 + rnd() * (FW[1] - FW[0] - 0.2), FW[2] + 0.1 + rnd() * 0.8, 0.52, 0.07 + rnd() * 0.06, FW[2] + 0.06, FW[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 13; i++) drips.add(X0 - 0.05 + i * 0.38 + rnd() * 0.1, 0.4 + rnd() * 1.5, 0.83, 0.09, 0.25, 2.4, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 8; i++) drips.add(1.75 + i * 0.3 + rnd() * 0.1, 0.4 + rnd() * 1.5, 0.13, 0.09, 0.25, 2.5, 2.0 + rnd() * 0.5);
  runs.seal(); drips.seal();
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt);
      lampM.opacity = 0.26 + 0.06 * Math.sin(t * 1.0);   // slow breathing, no strobing
      refT.offset.x = 0.012 * Math.sin(t * 0.6); refM.opacity = 0.15 + 0.04 * Math.sin(t * 0.9) * Math.sin(t * 0.37);
    },
  };
};
