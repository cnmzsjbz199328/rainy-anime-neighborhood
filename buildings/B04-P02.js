// B04-P02 あめまち診療所 (Amemachi Clinic): a one-storey pale-mint neighbourhood clinic with an east carport (B04, middle plot).
// Task card docs/buildings/tasks/B04-P02.md, reference docs/buildings/references/B04-P02.jpg.
// Local frame (placed by layout.js `buildings`, rotY 0): front +z faces the main street (world S), +x = world E
// (the viewer's right, where the carport stands), door centre at the origin, floor top at rec.floor.
// Body 5.2 × 4.9: x -3.7…1.5, z -4.9…0 (parapet to x -3.8 / 1.6 and z +0.1 / -5.0); the carport is part of the main group
// (x 1.5…3.9, z -4.9…0.1) so its roof can be registered as rain shelter; all inside the 8 × 6 envelope.
// Groups: clinic (shell, glazing, door canopy, light-box sign, roof layer with parapet / AC / vents, carport, interior) ·
// clinicFrontW (planter, poster stand) · clinicFrontE (planter, umbrella stand) · clinicSideW (outdoor AC, meter box, shrubs) ·
// clinicRear (back-door step and canopy, two AC units, utility cabinet, bins, rail) · clinicCar (kei van) · clinicGround.
// Plan: waiting chairs behind the front glass → reception counter (monitor, bell) with the medicine cabinet and staff desk behind
// it → a 0.9 m corridor to the rear door; west-rear exam room (half-drawn curtain, couch, stool, desk, basin); east strip with a
// small office and a WC.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B04-P02'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(4402), PI = Math.PI;
  const F = rec.floor, X0 = -3.7, X1 = 1.5, Z0 = 0, Z1 = -4.9, T = 0.15, BASE = 0.19, EF = 3.2, CEIL = 2.9, PAR = 3.55;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T, ZC = (Z0 + Z1) / 2, XC = (X0 + X1) / 2;
  const FW = [-3.35, -0.8, 0.55, 2.45], FD = [-0.65, 0.65, F, 2.3];
  const WW = [-4.5, -3.1, 0.85, 2.2];
  const E1 = [-4.55, -3.85, 1.75, 2.2], E2 = [-3.2, -2.4, 1.2, 2.2];
  const RD = [-0.7, 0.15, F, 2.25], RW = [0.7, 1.2, 1.5, 2.1], RW2 = [-3.1, -1.9, 1.3, 2.1];

  // ---- materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const mint = mat('#a9ccb9'), frame = '#e9e4d2', frameL = '#f6f2e4', stoneC = '#8f918e', metal = '#8a9298', green = '#3f9a64';
  const wcache = {}, W = (c, k = 0.3) => wcache[c + k] || (wcache[c + k] = warm(c, k));
  const wood = W('#c29a68'), woodD = W('#7a5a42', 0.26), cream = W('#f0ede0', 0.36), steel = W('#bcc4c8', 0.22), white = W('#f3f0e6', 0.34), grey = W('#9aa3a8', 0.24), teal = W('#6fae9c', 0.3);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffeab8' });
  let signM;
  const tileF = tex(128, 128, (q, w, h) => { q.fillStyle = '#d9d3bf'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { q.fillStyle = `rgba(${(i + j) % 2 ? '255,252,240' : '110,150,130'},.1)`; q.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
    q.strokeStyle = 'rgba(70,66,56,.38)'; q.lineWidth = 1.5; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 32, 0); q.lineTo(i * 32, h); q.moveTo(0, i * 32); q.lineTo(w, i * 32); q.stroke(); } });
  const pavers = tex(256, 256, (q, w, h) => { q.fillStyle = '#9a9b97'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '66,76,92' : '250,246,236'},${0.05 + rnd() * 0.08})`; q.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    q.strokeStyle = 'rgba(48,56,68,.45)'; q.lineWidth = 2; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); }
    for (let i = 0; i < 800; i++) { q.fillStyle = `rgba(40,48,60,${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1); } });
  const roofT = tex(128, 128, (q, w, h) => { q.fillStyle = '#5a5f66'; q.fillRect(0, 0, w, h); for (let i = 0; i < 600; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '10,14,20' : '170,184,200'},${0.04 + rnd() * 0.07})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    q.strokeStyle = 'rgba(20,26,34,.35)'; q.lineWidth = 2; for (let i = 0; i <= 2; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); } });
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: roofT });
  const glowT = canvasTex(128, 128, (q, w) => { const g = q.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.33)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, w); });
  const spillT = canvasTex(128, 128, (q, w, h) => { const g = q.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, h);
    q.globalCompositeOperation = 'destination-in'; const s = q.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.18, 'rgba(0,0,0,1)'); s.addColorStop(0.82, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = s; q.fillRect(0, 0, w, h); });
  const additive = (map, c, o) => new THREE.MeshBasicMaterial({ map, color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const decal = (w, h, x, y, z, heading, m, parent) => { const a = mesh(new THREE.PlaneGeometry(w, h), m, x, y, z, false, parent); a.rotation.set(-PI / 2, Math.atan2(-heading[0], -heading[1]), 0, 'YXZ'); return a; };
  const ab = (axis, u, y, d, w, h, t, c, o = true, p) => axis === 'x' ? box(u, y, d, w, h, t, c, o, p) : box(d, y, u, t, h, w, c, o, p);
  const rod = (a, b, r, c, parent) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 5, 1, true), typeof c === 'string' ? mat(c) : c, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, false, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  // Original clinic mark: a green cross on a white tile.
  const cross = (q, x, y, s, c) => { q.fillStyle = c; q.fillRect(x - s * 0.15, y - s * 0.45, s * 0.3, s * 0.9); q.fillRect(x - s * 0.45, y - s * 0.15, s * 0.9, s * 0.3); };
  const crossT = canvasTex(128, 128, (q, w, h) => { q.fillStyle = '#f4f6ee'; q.fillRect(0, 0, w, h); q.strokeStyle = '#6f8f80'; q.lineWidth = 6; q.strokeRect(3, 3, w - 6, h - 6); cross(q, 64, 64, 96, '#2f9a5e'); });
  const posterT = canvasTex(256, 384, (q, w, h) => { q.clearRect(0, 0, w, h); q.fillStyle = 'rgba(244,248,240,.82)'; q.fillRect(0, 0, w, h); q.fillStyle = '#2f9a5e'; q.fillRect(0, 0, w, 14);
    q.fillStyle = '#2d4a44'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.font = 'bold 46px sans-serif'; ['一般内科', '小児科', '予防接種', '健康相談'].forEach((s, i) => q.fillText(s, w / 2, 80 + i * 78)); q.fillStyle = '#5f8f7e'; q.font = '24px sans-serif'; q.fillText('予約なしでもどうぞ', w / 2, 360); });
  const curtT = canvasTex(128, 128, (q, w, h) => { q.fillStyle = '#7fbfb2'; q.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { q.fillStyle = `rgba(${i % 2 ? '255,255,255' : '20,60,60'},.16)`; q.fillRect(i * 16, 0, 8, h); } });

  // ---- plants ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), LEAF = ['#6c9476', '#88a98a', '#5e8a6a'];
  const shrub = (x, y, z, r, n, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(LEAF[i % 3]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.8 + rnd() * r * h * 0.7, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.5 + rnd() * 0.25)); } };
  const planter = (x0, x1, z0, z1, n) => { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; box(cx, BASE + 0.16, cz, x1 - x0, 0.32, z1 - z0, '#a7a49b'); box(cx, BASE + 0.33, cz, x1 - x0 - 0.1, 0.03, z1 - z0 - 0.1, '#4a4034', false);
    for (let i = 0; i < n; i++) shrub(x0 + 0.15 + (i + 0.5) * (x1 - x0 - 0.3) / n, BASE + 0.34, cz, 0.2, 2, 1.4); };
  const pot = (x, z, r = 0.22) => { cyl(x, BASE + 0.18, z, r, 0.36, '#9b8f84'); shrub(x, BASE + 0.34, z, r * 1.2, 4, 1.8); };

  // ================= shell =================
  group('clinic');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, EF], [FW, FD], mint);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, EF], [RD, RW, RW2], mint);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, EF], [E1, E2], mint);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, EF], [WW], mint);
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FW[0], Z0, 1); plinth('x', FW[1], FD[0], Z0, 1); plinth('x', FD[1], X1, Z0, 1); plinth('x', X0, RW2[0], Z1, -1); plinth('x', RW2[1], RD[0], Z1, -1); plinth('x', RD[1], X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  // Painted-render joints and slim corner pilasters.
  for (const y of [1.2, 2.5]) for (const [axis, d, a, b, out] of [['x', Z0, X0, X1, 1], ['x', Z1, X0, X1, -1], ['z', X1, Z1, Z0, 1], ['z', X0, Z1, Z0, -1]]) ab(axis, (a + b) / 2, y, d + out * 0.002, b - a, 0.012, 0.01, '#86a898', false);
  for (const [x, z] of [[X0 + 0.04, Z0 - 0.04], [X1 - 0.04, Z0 - 0.04], [X0 + 0.04, Z1 + 0.04], [X1 - 0.04, Z1 + 0.04]]) box(x, (BASE + EF) / 2, z, 0.1, EF - BASE, 0.1, '#bcd9c7');
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - IZ1), (IX1 - IX0) / 1.2, (IZ0 - IZ1) / 1.2), warm('#ffffff', 0.2, tileF), XC + 0.05, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL], [FW, FD], cream); panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL], [E1, E2], cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL], [WW], cream); panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL], [RD, RW, RW2], cream);
  box(XC, F + 0.45, IZ1 + 0.01, IX1 - IX0, 0.9, 0.012, W('#cfe3d8', 0.3), false); for (const x of [IX0 + 0.006, IX1 - 0.006]) box(x, F + 0.45, (IZ0 + IZ1) / 2, 0.012, 0.9, IZ0 - IZ1, W('#cfe3d8', 0.3), false);

  // ---- glazing ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = []) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, frame); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, frame); ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, frame); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, frame);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.045, q - p, fd * 0.9, frame); for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.04, fd * 0.9, frame);
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.1, 0.05, 0.15, '#b9b7ad'); }
  glaze('x', -T / 2, 1, FW, [-2.1], [1.2]); glaze('z', X0 + T / 2, -1, WW, [-3.8]); glaze('z', X1 - T / 2, 1, E1, []); glaze('z', X1 - T / 2, 1, E2, []);
  glaze('x', Z1 + T / 2, -1, RW, []); glaze('x', Z1 + T / 2, -1, RW2, [-2.5]);
  for (let i = 1; i < 4; i++) ab('x', RW2[0] + (RW2[1] - RW2[0]) * i / 4, (RW2[2] + RW2[3]) / 2, Z1 - 0.04, 0.02, RW2[3] - RW2[2], 0.02, '#8aa89a', false);
  box((FW[0] + FW[1]) / 2, (0.32 + FW[2] - 0.05) / 2, 0.012, FW[1] - FW[0] - 0.04, FW[2] - 0.05 - 0.32, 0.02, '#7fa593');
  // Front door: step-free double glass sliding-style door in cream frames, push bars, a threshold plate.
  ab('x', FD[0] + 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, frame); ab('x', FD[1] - 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, frame); box(0, FD[3] - 0.03, -T / 2, FD[1] - FD[0], 0.06, 0.16, frame);
  { const z = -0.05, top = FD[3] - 0.06;
    for (const x of [-0.6, -0.03, 0.03, 0.6]) box(x, (F + top) / 2, z, 0.06, top - F, 0.045, frameL); box(0, top - 0.04, z, 1.26, 0.08, 0.045, frameL); box(0, F + 0.05, z, 1.26, 0.1, 0.045, frameL);
    box(0, (F + 0.1 + top - 0.08) / 2, z, 1.2, top - 0.08 - F - 0.1, 0.012, glass, false);
    for (const x of [-0.16, 0.16]) box(x, 1.05, z + 0.03, 0.025, 0.5, 0.025, '#c9c9c0'); box(0, 1.55, z + 0.012, 0.9, 0.1, 0.006, '#3f9a64', false); }
  box(0, 0.243, 0.35, 1.5, 0.104, 0.7, stoneC, false);   // flush threshold apron: the entrance is step-free
  // Window poster on the glass (services list) and a cross decal on the door.
  mesh(new THREE.PlaneGeometry(0.62, 0.93), new THREE.MeshBasicMaterial({ map: posterT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), -3.0, 1.62, -0.032, false).rotation.y = 0;
  // Rear: grey steel door with a small window, lever, drip cap; wall lamp.
  ab('x', RD[0] + 0.03, (F + RD[3]) / 2, Z1 + T / 2, 0.06, RD[3] - F, 0.16, frame); ab('x', RD[1] - 0.03, (F + RD[3]) / 2, Z1 + T / 2, 0.06, RD[3] - F, 0.16, frame); box((RD[0] + RD[1]) / 2, RD[3] - 0.03, Z1 + T / 2, RD[1] - RD[0], 0.06, 0.16, frame);
  box((RD[0] + RD[1]) / 2, (F + RD[3] - 0.06) / 2, Z1 + 0.06, RD[1] - RD[0] - 0.12, RD[3] - 0.06 - F, 0.04, '#7c8a96'); box((RD[0] + RD[1]) / 2, 1.8, Z1 + 0.035, 0.3, 0.34, 0.012, '#a9bcc0', false);
  box(RD[1] - 0.13, 1.05, Z1 + 0.02, 0.03, 0.16, 0.04, '#c9c9c0'); box(RD[1] - 0.13, 1.05, Z1 - 0.03, 0.16, 0.025, 0.04, '#c9c9c0');
  box(RD[1] + 0.3, 2.05, Z1 - 0.06, 0.12, 0.17, 0.1, '#46535a'); box(RD[1] + 0.3, 2.04, Z1 - 0.06, 0.09, 0.12, 0.105, bulb, false); mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffe8b8', 0.22), RD[1] + 0.3, 2.05, Z1 - 0.004, false).rotation.y = PI;
  // Pipes: downpipes at the front-west and rear-east corners, conduit and a lamp by the door.
  for (const [x, z] of [[X0 - 0.06, Z0 - 0.3], [X1 + 0.06, Z1 + 0.3]]) { const s = Math.sign(x); cyl(x, (PAR + 0.2) / 2, z, 0.04, PAR - 0.2, '#8f979c'); for (const y of [0.9, 2.0, 3.0]) rod([x, y, z], [x - s * 0.06, y, z], 0.012, '#5f6c76'); box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91'); }
  box(1.1, 1.45, 0.05, 0.6, 0.9, 0.08, '#4a5a56'); box(1.1, 1.45, 0.09, 0.54, 0.84, 0.01, glass, false);
  for (const [dx, dy, c] of [[-0.12, 0.2, '#6fae9c'], [0.12, 0.2, '#e8e0cc'], [-0.12, -0.18, '#e8e0cc'], [0.12, -0.18, '#d8a43a']]) box(1.1 + dx, 1.45 + dy, 0.088, 0.2, 0.3, 0.004, W(c, 0.5), false);
  K.label('診療時間 9:00-18:00', 1.1, 1.98, 0.094, 0.52, 0.1, '#1f4a3c', '#f3f0e0', 40);
  // Louvred vent on the east wall (kitchenette-free, so just the WC extractor).
  for (let i = 0; i < 5; i++) box(X1 + 0.03, 2.55 + i * 0.07, -4.2, 0.04, 0.03, 0.4, '#7c8a86', false);

  // ================= roof layer: parapet, membrane, AC, vents =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('clinic').add(roofLayer); K.setRoot(roofLayer);
  {
    const x0 = X0 - 0.1, x1 = X1 + 0.1, zf = Z0 + 0.1, zr = Z1 - 0.1, h = PAR - EF, y = EF + h / 2;
    box(XC, y, zf - 0.05, x1 - x0, h, 0.1, '#b6d2c2'); box(XC, y, zr + 0.05, x1 - x0, h, 0.1, '#b6d2c2'); box(x0 + 0.05, y, ZC, 0.1, h, zf - zr, '#b6d2c2'); box(x1 - 0.05, y, ZC, 0.1, h, zf - zr, '#b6d2c2');
    box(XC, PAR + 0.025, zf - 0.05, x1 - x0 + 0.04, 0.05, 0.16, '#8f9894'); box(XC, PAR + 0.025, zr + 0.05, x1 - x0 + 0.04, 0.05, 0.16, '#8f9894'); box(x0 + 0.05, PAR + 0.025, ZC, 0.16, 0.05, zf - zr, '#8f9894'); box(x1 - 0.05, PAR + 0.025, ZC, 0.16, 0.05, zf - zr, '#8f9894');
    mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0 + 0.1, 0.1, IZ0 - IZ1 + 0.1), 3, 3), roofM, XC, EF + 0.05, ZC, false);
    box(XC, CEIL + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#eceadc', 0.34), false);
    // outdoor AC on rails, with conduit to the roof hatch
    const ac = (x, z, w, d) => { for (const dz of [-d * 0.35, d * 0.35]) box(x, EF + 0.17, z + dz, w + 0.1, 0.12, 0.08, '#2f363c'); box(x, EF + 0.58, z, w, 0.9, d, '#dcdfd8'); box(x, EF + 1.06, z, w + 0.04, 0.06, d + 0.04, '#b0b8b8');
      mesh(new THREE.CircleGeometry(w * 0.34, 18), mat('#2e363e'), x, EF + 0.62, z + d / 2 + 0.006, false); for (let i = 0; i < 5; i++) box(x, EF + 0.42 + i * 0.09, z + d / 2 + 0.008, w * 0.6, 0.014, 0.01, '#8a9498', false); };
    ac(-1.9, -3.3, 0.9, 0.42);
    line([[-1.9, EF + 0.12, -3.1], [-1.9, EF + 0.12, -2.4], [-0.4, EF + 0.12, -2.4]], '#9aa3a6', 0.022);
    // two plumbing vent stacks with rain caps, one small exhaust hood and a roof hatch
    for (const [x, z] of [[-3.2, -0.6], [0.9, -1.3]]) { cyl(x, EF + 0.1, z, 0.1, 0.06, '#6a737a'); cyl(x, EF + 0.55, z, 0.045, 1.0, '#a4acaf'); cyl(x, EF + 1.07, z, 0.075, 0.05, '#7d868a'); }
    box(0.5, EF + 0.2, -4.2, 0.5, 0.28, 0.4, '#8b9593'); box(0.5, EF + 0.36, -4.2, 0.56, 0.05, 0.46, '#68716f');
    box(-0.6, EF + 0.15, -3.9, 0.7, 0.2, 0.7, '#7d8886'); box(-0.6, EF + 0.27, -3.9, 0.76, 0.04, 0.76, '#566360');
  }
  group('clinic');
  // Front sign: wide light box (green cross tile, 診療所, specialties) and a projecting cross sign at the west corner.
  {
    const s = canvasTex(1024, 256, (q, w, h) => { q.fillStyle = '#f7f8f0'; q.fillRect(0, 0, w, h); q.strokeStyle = '#6f8f80'; q.lineWidth = 6; q.strokeRect(6, 6, w - 12, h - 12);
      cross(q, 130, 128, 170, '#2f9a5e'); q.fillStyle = '#25403a'; q.textBaseline = 'middle'; q.textAlign = 'center'; q.font = 'bold 150px sans-serif'; q.fillText('診療所', 520, 112); q.fillStyle = '#4b6c60'; q.font = 'bold 32px sans-serif'; q.fillText('あめまち　内科・小児科・健康相談', 505, 214);
      q.fillStyle = '#2f9a5e'; q.fillRect(830, 52, 6, 150); q.font = 'bold 40px sans-serif'; q.textAlign = 'left'; q.fillStyle = '#25403a'; ['内科', '小児科', '予防接種'].forEach((t, i) => q.fillText(t, 850, 76 + i * 52)); });
    const sm = new THREE.MeshBasicMaterial({ map: s, color: '#ffffff' });
    signM = sm;
    box(-1.1, 2.95, 0.07, 4.7, 0.6, 0.14, '#cfd8d2'); mesh(new THREE.PlaneGeometry(4.58, 0.5), sm, -1.1, 2.95, 0.145, false);
    for (const x of [-3.35, 1.15]) box(x, 2.62, 0.07, 0.08, 0.06, 0.12, frame, false);
    // projecting cross at the west corner (double-sided tile)
    box(X0 - 0.08, 2.35, 0.3, 0.08, 0.62, 0.62, '#d7dcd6'); for (const [s2, rot] of [[-1, -PI / 2], [1, PI / 2]]) mesh(new THREE.PlaneGeometry(0.54, 0.54), new THREE.MeshBasicMaterial({ map: crossT }), X0 - 0.08 + s2 * 0.045, 2.35, 0.3, false).rotation.y = rot;
    box(X0 - 0.04, 2.62, 0.17, 0.05, 0.05, 0.28, '#7d8886');
  }
  // Door canopy: a thin flat acrylic hood on slim rods over the entrance.
  {
    const x0 = -1.1, x1 = 1.1, top = 2.52, dep = 0.75;
    box((x0 + x1) / 2, top, dep / 2, x1 - x0, 0.04, dep, W('#bcd8d0', 0.3)); box((x0 + x1) / 2, top - 0.05, dep, x1 - x0 + 0.04, 0.1, 0.04, '#d6e2dc');
    for (const x of [x0 + 0.1, x1 - 0.1]) rod([x, top + 0.15, 0.03], [x, top - 0.02, dep - 0.04], 0.012, frameL);
  }
  // Carport on the east side: posts, rafters, translucent lean-to roof, floor slab, wall lamp.
  {
    const xa = X1, xb = 3.85, zf = 0.1, zb = -4.9, ya = 2.8, yb = 2.55;
    for (const [x, z] of [[xb, zf - 0.1], [xb, -2.4], [xb, zb + 0.1]]) { box(x, (BASE + yb) / 2, z, 0.1, yb - BASE, 0.1, '#6a7478'); box(x, BASE + 0.03, z, 0.2, 0.06, 0.2, stoneC); }
    const roof = new THREE.MeshPhysicalMaterial({ color: 0x6f8f9a, transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
    const len = Math.hypot(xb - xa, ya - yb), ang = Math.atan2(ya - yb, xb - xa), xm = (xa + xb) / 2, ym = (ya + yb) / 2;
    const sheet = box(xm, ym + 0.03, (zf + zb) / 2, len, 0.015, zf - zb, roof, false); sheet.rotation.z = ang;
    for (let i = 0; i <= 5; i++) { const r = box(xm, ym + 0.005, zb + (zf - zb) * i / 5, len, 0.05, 0.05, '#6a7478'); r.rotation.z = ang; }
    box(xb, yb - 0.02, (zf + zb) / 2, 0.06, 0.08, zf - zb, '#6a7478'); box(xa + 0.02, ya, (zf + zb) / 2, 0.04, 0.06, zf - zb, '#6a727a');
    box((xa + xb) / 2 + 0.02, BASE + 0.015, (zf + zb) / 2, xb - xa, 0.03, zf - zb, '#a7a7a1', false);
    box(2.7, 2.5, -2.4, 0.34, 0.05, 0.12, '#59656d'); box(2.7, 2.47, -2.4, 0.3, 0.02, 0.1, bulb, false); mesh(new THREE.PlaneGeometry(1.6, 1.6), additive(glowT, '#ffe8b8', 0.14), 2.7, 2.2, -2.4, false).rotation.x = -PI / 2;
  }

  // ================= interior =================
  const tube = (x, z, len, axis = 'x') => { const w = axis === 'x' ? len : 0.1, d = axis === 'x' ? 0.1 : len; box(x, CEIL - 0.04, z, w + 0.04, 0.05, d + 0.04, '#7d8b88', false, roofLayer); box(x, CEIL - 0.075, z, w, 0.02, d, W('#f4f8ff', 0.95), false, roofLayer); };
  const chair = (x, z, c) => { box(x, F + 0.42, z, 0.46, 0.06, 0.44, c); box(x, F + 0.68, z - 0.2, 0.46, 0.46, 0.05, c); for (const dx of [-0.19, 0.19]) for (const dz of [-0.17, 0.17]) box(x + dx, F + 0.2, z + dz, 0.035, 0.4, 0.035, '#59656d', false); };
  // Near layer: waiting chairs back to the glass, low table with leaflets, umbrella stand and sanitiser by the door.
  for (const x of [-3.05, -2.5, -1.95]) chair(x, -0.58, teal);
  box(-2.5, F + 0.2, -1.1, 0.8, 0.04, 0.45, wood); for (const dx of [-0.34, 0.34]) for (const dz of [-0.17, 0.17]) box(-2.5 + dx, F + 0.1, -1.1 + dz, 0.035, 0.2, 0.035, '#59656d', false);
  for (const [dx, c] of [[-0.18, '#d8a43a'], [0.0, '#e8e0cc'], [0.2, '#4f8aa8']]) box(-2.5 + dx, F + 0.235, -1.1, 0.16, 0.012, 0.22, W(c, 0.5), false);
  box(-1.2, F + 0.62, -0.5, 0.26, 1.24, 0.22, '#59656d'); for (let k = 0; k < 4; k++) for (let j = 0; j < 2; j++) box(-1.2 + 0.0, F + 0.3 + k * 0.25, -0.5 + (j - 0.5) * 0.08 + 0.12, 0.2, 0.17, 0.012, W(['#6fae9c', '#d8a43a', '#e8e0cc', '#4f8aa8'][(k + j) % 4], 0.5), false);
  cyl(0.95, F + 0.3, -0.45, 0.1, 0.6, '#6a7478'); for (let i = 0; i < 3; i++) cyl(0.95 + (i - 1) * 0.02, F + 0.75 + i * 0.02, -0.45 + (i - 1) * 0.02, 0.025, 0.5, ['#4f8aa8', '#c0463a', '#d8c24a'][i]);
  cyl(1.2, F + 0.45, -0.3, 0.03, 0.9, '#aab3b7'); box(1.2, F + 0.92, -0.3, 0.12, 0.2, 0.1, W('#e9f4ef', 0.5));
  pot(1.15, -0.95, 0.2);
  // Mid layer: reception counter with a low accessible ledge, monitor and bell; staff desk and chair behind; medicine cabinet.
  {
    const x0 = -3.5, x1 = -1.45, z0 = -1.65, z1 = -2.15, top = F + 1.0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(cx, F + 0.5, cz, x1 - x0, 1.0, z0 - z1, W('#e4ecdf', 0.32)); box(cx, top - 0.025, cz, x1 - x0 + 0.04, 0.05, z0 - z1 + 0.1, wood); box(cx, F + 0.2, z0 + 0.012, x1 - x0 - 0.06, 0.2, 0.012, W('#8fb6a6', 0.3), false);
    box((x1 - 0.5), F + 0.84, cz + 0.05, 1.0, 0.04, 0.6, wood); for (const dx of [-0.46, 0.46]) box(x1 - 0.5 + dx, F + 0.42, cz + 0.12, 0.04, 0.84, 0.4, W('#e4ecdf', 0.32), false);
    box(-3.0, top + 0.17, cz - 0.06, 0.42, 0.3, 0.03, W('#2a3036', 0.12)); box(-3.0, top + 0.17, cz - 0.043, 0.36, 0.24, 0.004, W('#bfe0f0', 0.9), false); box(-3.0, top + 0.03, cz - 0.06, 0.06, 0.1, 0.06, '#59656d');
    cyl(-2.1, top + 0.06, cz + 0.12, 0.045, 0.06, '#d8c24a'); box(-2.5, top + 0.03, cz + 0.08, 0.24, 0.02, 0.18, W('#e9e4d6', 0.3), false); box(-2.5, top + 0.1, cz - 0.06, 0.22, 0.14, 0.03, W('#3f9a64', 0.5));
    // staff desk and chair
    const dx = -2.5, dz = -2.62;
    box(dx, F + 0.72, dz, 1.2, 0.04, 0.5, wood); for (const s of [-1, 1]) box(dx + s * 0.55, F + 0.36, dz, 0.04, 0.7, 0.44, '#59656d', false);
    box(dx - 0.2, F + 0.98, dz - 0.08, 0.4, 0.26, 0.03, W('#2a3036', 0.12)); box(dx - 0.2, F + 0.98, dz - 0.063, 0.34, 0.2, 0.004, W('#9fc4e8', 0.9), false); box(dx - 0.2, F + 0.8, dz - 0.08, 0.06, 0.1, 0.06, '#59656d');
    cyl(dx + 0.15, F + 0.26, dz + 0.5, 0.04, 0.46, '#59656d'); box(dx + 0.15, F + 0.48, dz + 0.5, 0.42, 0.06, 0.4, teal); box(dx + 0.15, F + 0.76, dz + 0.69, 0.4, 0.4, 0.05, teal);
    // medicine cabinet on the west wall: glass-fronted shelves lit from inside
    box(IX0 + 0.2, F + 0.9, -2.45, 0.4, 1.8, 0.7, W('#dfe8e0', 0.28)); box(IX0 + 0.405, F + 1.2, -2.45, 0.012, 1.0, 0.62, glass, false);
    for (const y of [0.8, 1.1, 1.4, 1.65]) { box(IX0 + 0.3, F + y, -2.45, 0.2, 0.014, 0.62, '#a7b3ad', false); for (let i = 0; i < 5; i++) box(IX0 + 0.28, F + y + 0.09, -2.7 + i * 0.12, 0.1, 0.16, 0.08, W(['#e8e0cc', '#6fae9c', '#d8a43a', '#4f8aa8', '#c0463a'][(i + Math.round(y * 5)) % 5], 0.5), false); }
    box(IX0 + 0.3, F + 0.38, -2.45, 0.4, 0.7, 0.66, W('#c8d4cb', 0.26), false);
  }
  // Back layer: exam room west-rear (couch, stool, desk, basin, half-drawn curtain); office and WC in the east strip.
  {
    // exam couch along the rear wall
    box(-2.55, F + 0.42, -4.35, 1.9, 0.1, 0.78, '#6a7478'); box(-2.55, F + 0.5, -4.35, 1.86, 0.1, 0.74, W('#9cc6d4', 0.34)); box(-3.3, F + 0.62, -4.35, 0.35, 0.1, 0.5, white);
    for (const x of [-3.4, -1.7]) for (const z of [-4.1, -4.6]) box(x, F + 0.2, z, 0.05, 0.4, 0.05, '#7d868a', false);
    box(-2.9, F + 0.9, IZ1 + 0.03, 0.5, 0.34, 0.03, '#59656d'); box(-2.9, F + 0.9, IZ1 + 0.048, 0.44, 0.28, 0.004, W('#f0f4ea', 0.6), false);
    // rolling stool with a five-star base
    cyl(-2.0, F + 0.3, -3.55, 0.035, 0.5, '#59656d'); cyl(-2.0, F + 0.56, -3.55, 0.17, 0.06, W('#3f5a60', 0.28)); for (let a = 0; a < 5; a++) box(-2.0 + Math.cos(a * 1.257) * 0.16, 0.22, -3.55 + Math.sin(a * 1.257) * 0.16, 0.04, 0.04, 0.04, '#2f363c', false);
    // desk with a monitor under the west window
    box(IX0 + 0.28, F + 0.74, -3.45, 0.55, 0.04, 0.9, wood); for (const z of [-3.85, -3.05]) box(IX0 + 0.28, F + 0.37, z, 0.5, 0.72, 0.04, '#59656d', false);
    box(IX0 + 0.14, F + 0.98, -3.45, 0.04, 0.26, 0.44, W('#2a3036', 0.12)); box(IX0 + 0.165, F + 0.98, -3.45, 0.004, 0.2, 0.38, W('#9fc4e8', 0.9), false);
    // basin on the rear wall with a mirror, towel dispenser
    box(-1.15, F + 0.45, -4.55, 0.5, 0.9, 0.36, steel); box(-1.15, F + 0.92, -4.55, 0.54, 0.04, 0.4, W('#e6eaea', 0.3)); mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 10), W('#aab3b7', 0.3), -1.15, F + 0.95, -4.55, false); box(-1.15, F + 1.15, IZ1 + 0.04, 0.02, 0.24, 0.02, '#8a9298', false); box(-1.15, F + 1.45, IZ1 + 0.02, 0.45, 0.6, 0.02, W('#d6e6ea', 0.5), false); box(-0.9, F + 1.2, IZ1 + 0.05, 0.14, 0.2, 0.08, W('#e9f4ef', 0.5));
    // curtain: track, half-drawn fabric with folds
    box(-2.4, 2.18, -3.0, 2.3, 0.025, 0.04, '#8a9298', false);
    const curtain = new THREE.MeshBasicMaterial({ map: curtT, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
    mesh(new THREE.PlaneGeometry(1.5, 1.85), curtain, -2.75, F + 1.15, -3.0, false); for (let i = 0; i < 6; i++) box(-3.45 + i * 0.28, F + 1.15, -3.0, 0.015, 1.85, 0.03, W('#5f9a8c', 0.4), false);
    // partition x 0.2 between the corridor and the east rooms (doorway to the office, closed WC door)
    const px = 0.2, pt = 0.08;
    box(px, F + 1.3, -2.0, pt, 2.6, 0.2, cream); box(px, F + 1.3, -3.275, pt, 2.6, 0.55, cream); box(px, F + 1.3, -4.5, pt, 2.6, 0.5, cream); box(px, F + 2.5, -2.55, pt, 0.4, 0.9, cream); box(px, F + 2.4, -3.9, pt, 0.4, 0.7, cream);
    box(px, F + 1.0, -3.9, 0.05, 2.0, 0.66, W('#d6c3a4', 0.3)); box(px - 0.04, F + 1.0, -3.7, 0.02, 0.14, 0.04, '#aab3b7', false); box(px - 0.032, F + 1.7, -3.9, 0.012, 0.16, 0.1, W('#3f9a64', 0.5), false);
    box(0.78, F + 1.3, -3.4, 1.15, 2.6, 0.08, cream);
    // office: desk with a monitor at the east window, chair, filing cabinet
    box(1.05, F + 0.74, -2.8, 0.55, 0.04, 1.0, wood); for (const z of [-3.25, -2.35]) box(1.05, F + 0.37, z, 0.5, 0.72, 0.04, '#59656d', false);
    box(1.22, F + 0.98, -2.8, 0.04, 0.26, 0.42, W('#2a3036', 0.12)); box(1.2, F + 0.98, -2.8, 0.004, 0.2, 0.36, W('#9fc4e8', 0.9), false); box(0.9, F + 0.78, -2.45, 0.2, 0.04, 0.14, W('#e0d8c4', 0.4));
    cyl(0.55, F + 0.26, -2.8, 0.04, 0.46, '#59656d'); box(0.55, F + 0.48, -2.8, 0.4, 0.06, 0.42, teal); box(0.4, F + 0.76, -2.8, 0.05, 0.4, 0.4, teal);
    box(0.5, F + 0.65, -2.1, 0.4, 1.3, 0.3, grey); for (const y of [0.3, 0.7, 1.1]) box(0.5, F + y, -1.945, 0.3, 0.3, 0.012, W('#7f8b93', 0.2), false);
    // WC: bowl, tank, small basin
    box(1.0, F + 0.22, -4.45, 0.4, 0.4, 0.5, W('#f2f4ee', 0.4)); box(1.0, F + 0.55, -4.67, 0.36, 0.4, 0.14, W('#f2f4ee', 0.4)); box(0.5, F + 0.8, -4.62, 0.4, 0.16, 0.26, W('#f2f4ee', 0.4)); box(0.5, F + 0.4, -4.62, 0.04, 0.8, 0.04, '#aab3b7', false);
    for (const [x, z, r] of [[-2.4, -0.9, 1.8], [-2.4, -2.5, 1.7], [-2.4, -4.0, 1.4], [-0.3, -2.2, 1.6], [0.8, -3.0, 1.1]]) decal(r, r, x, F + 0.003, z, [0, -1], additive(glowT, '#ffe6b8', 0.26));
  }
  tube(-1.8, -0.9, 2.6, 'x'); tube(-1.8, -2.6, 2.6, 'x'); tube(-2.4, -4.0, 1.8, 'x'); tube(-0.3, -3.0, 3.6, 'z'); tube(0.8, -2.8, 1.0, 'z');

  // ================= attachments =================
  group('clinicFrontW'); {
    // West of the door: standing services board lit from its top, planter and a tall pot at the front-west corner.
    const bx = -2.1, bz = 1.1, by = BASE;
    for (const s of [-1, 1]) box(bx + s * 0.4, by + 0.55, bz, 0.06, 1.1, 0.06, '#59656d'); box(bx, by + 0.9, bz, 0.9, 0.7, 0.07, '#4a5a56'); mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ map: crossT, color: '#e6eadc' }), bx, by + 0.9, bz + 0.04, false);
    K.label('本日 診療中', bx, by + 0.45, bz + 0.04, 0.7, 0.1, '#1f4a3c', '#f3f0e0', 50);
    box(bx, by + 1.3, bz + 0.05, 1.0, 0.04, 0.16, '#59656d'); box(bx, by + 1.28, bz + 0.1, 0.8, 0.02, 0.03, bulb, false);
    planter(-3.55, -2.95, 0.35, 0.95, 2); pot(-3.2, 1.3, 0.24); }
  group('clinicFrontE'); {
    // East of the door: planter by the pier and an umbrella bin.
    planter(0.95, 1.55, 0.35, 0.8, 2);
    cyl(1.85, BASE + 0.3, 0.55, 0.14, 0.6, '#4f6a7a'); for (let i = 0; i < 3; i++) cyl(1.82 + i * 0.04, BASE + 0.72, 0.52 + i * 0.03, 0.02, 0.4, ['#c0463a', '#4f8aa8', '#d8c24a'][i]); }
  group('clinicCar'); {
    // Kei-class van nose-out under the carport (lights off at night, a small amber parking glow).
    const cx = 2.75, y0 = BASE + 0.02, paint = '#d9dfe3', trim = '#2b3138';
    const g = new THREE.Group(); g.position.set(cx, y0, 0); group('clinicCar').add(g);
    box(0, 0.55, -2.3, 1.5, 0.62, 3.2, paint, true, g); box(0, 0.38, -2.3, 1.54, 0.18, 3.24, '#9aa3a8', true, g);
    box(0, 1.15, -2.6, 1.42, 0.7, 2.5, paint, true, g);
    box(0, 1.17, -1.34, 1.3, 0.54, 0.02, '#46586a', false, g); for (const s of [-1, 1]) box(s * 0.716, 1.17, -2.6, 0.02, 0.5, 2.1, '#46586a', false, g);
    box(0, 1.52, -2.6, 1.34, 0.04, 2.4, '#c4cbcf', true, g);
    for (const s of [-1, 1]) { box(s * 0.58, 0.58, -0.68, 0.3, 0.14, 0.04, '#fff0c4', false, g); box(s * 0.58, 0.58, -3.92, 0.22, 0.14, 0.04, '#c8362c', false, g); }
    box(0, 0.42, -0.68, 1.2, 0.2, 0.04, trim, false, g); box(0, 0.4, -0.66, 0.4, 0.12, 0.012, '#e8e8e0', false, g);
    for (const s of [-1, 1]) for (const z of [-1.3, -3.2]) { const w = cyl(s * 0.72, 0.28, z, 0.28, 0.2, '#262c32', g); w.rotation.z = PI / 2; const h = cyl(s * 0.83, 0.28, z, 0.15, 0.04, '#aab3b7', g); h.rotation.z = PI / 2; }
    box(0.0, 0.72, -0.69, 1.46, 0.04, 0.05, '#aab3b7', false, g);
    mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffd890', 0.1), 0, 0.5, -0.4, false, g); }
  group('clinicSideW'); {
    // West street side: outdoor AC on a stand, electricity meter and a gas meter, hedge and a pot along the pavement edge.
    box(-4.1, BASE + 0.05, -1.9, 0.5, 0.1, 0.94, '#7f8b93'); box(-4.1, BASE + 0.5, -1.9, 0.42, 0.78, 0.86, '#dfe2dc'); mesh(new THREE.CircleGeometry(0.22, 18), mat('#3b4650'), -4.312, BASE + 0.55, -1.9, false).rotation.y = -PI / 2;
    for (let i = 0; i < 4; i++) box(-4.315, BASE + 0.35 + i * 0.08, -1.9, 0.01, 0.012, 0.44, '#9aa6ab', false);
    box(-3.82, 1.45, -0.7, 0.14, 0.7, 0.4, '#c4c6c0', false); box(-3.75, 1.5, -0.7, 0.04, 0.16, 0.2, bulb, false); box(-3.82, 1.35, -1.2, 0.14, 0.3, 0.26, '#b8bbb4', false); line([[-3.76, 1.2, -1.2], [-3.76, 0.6, -1.2], [-3.9, 0.4, -1.2]], '#8a9298', 0.018);
    for (let i = 0; i < 4; i++) shrub(-4.45, BASE, -2.9 - i * 0.5, 0.28, 3, 1.5); pot(-4.35, -0.4, 0.22); }
  group('clinicRear'); {
    // Back-door step with a mat and a small canopy, two AC units, a utility cabinet, bins, drain grate, rail along the west end.
    const by = BASE;
    box(-0.28, by + 0.06, Z1 - 0.3, 1.1, 0.12, 0.5, '#a39f96'); box(-0.28, by + 0.125, Z1 - 0.3, 0.9, 0.014, 0.4, '#5d5248', false);
    box(-0.28, 2.5, Z1 - 0.4, 1.5, 0.05, 0.6, '#bcd8d0'); for (const x of [-0.98, 0.42]) rod([x, 2.5, Z1 - 0.1], [x, 2.25, Z1 - 0.1], 0.015, frameL); box(-0.28, 2.58, Z1 - 0.68, 1.5, 0.1, 0.04, '#9bbcb0', false);
    for (const x of [0.95, 1.7]) { box(x, by + 0.05, Z1 - 0.35, 0.65, 0.1, 0.4, '#7f8b93'); box(x, by + 0.42, Z1 - 0.35, 0.58, 0.66, 0.36, '#dfe2dc'); mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), x, by + 0.45, Z1 - 0.535, false).rotation.y = PI; }
    box(2.75, by + 0.8, Z1 - 0.35, 0.7, 1.6, 0.4, '#b9bfba'); box(2.75, by + 0.8, Z1 - 0.552, 0.6, 1.4, 0.012, '#a3aaa5', false); box(2.5, by + 0.95, Z1 - 0.56, 0.04, 0.24, 0.02, '#59656d', false);
    for (const x of [-1.9, -1.35]) { box(x, by + 0.45, Z1 - 0.4, 0.45, 0.9, 0.45, x < -1.6 ? '#5d6c8a' : '#8a7a4a'); box(x, by + 0.93, Z1 - 0.4, 0.5, 0.06, 0.5, '#3a3f46'); }
    box(-0.1, by + 0.015, Z1 - 0.8, 0.5, 0.03, 0.4, '#3a4048', false); for (let i = 0; i < 6; i++) box(-0.3 + i * 0.08, by + 0.032, Z1 - 0.8, 0.012, 0.012, 0.34, '#8a9298', false);
    // low black rail along the west half of the rear yard, with a small gate gap
    for (let i = 0; i < 9; i++) box(-3.7 + i * 0.14, by + 0.45, Z1 - 1.0, 0.03, 0.9, 0.03, '#3a3f46', false); box(-3.1, by + 0.9, Z1 - 1.0, 1.3, 0.04, 0.05, '#2f343a'); box(-3.1, by + 0.3, Z1 - 1.0, 1.3, 0.03, 0.04, '#2f343a', false);
    shrub(-3.55, by, Z1 - 0.35, 0.3, 3, 1.4); shrub(3.2, by, Z1 - 0.5, 0.3, 4, 1.5); }
  group('clinicGround');
  const paveMat = warm('#ffffff', 0, pavers), asphMat = warm('#ffffff', 0, tex(128, 128, (q, w, h) => { q.fillStyle = '#62666e'; q.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '28,32,38' : '190,196,204'},${0.05 + rnd() * 0.08})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } }));
  const pave = (x0, x1, z0, z1, m = paveMat, y = 0.198) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), m, (x0 + x1) / 2, y, (z0 + z1) / 2, false);
  pave(-4.9, 4.9, -0.2, 2.9); pave(-4.9, -2.9, -5.9, -0.2); pave(-2.9, 4.9, -5.9, -5.0); pave(1.6, 4.9, -5.0, -0.2, asphMat, 0.2);
  // Stall markings, wheel stop, tactile strip from the door to the plot edge, entrance mat and light pools.
  for (const x of [1.95, 3.55]) box(x, 0.209, -2.4, 0.06, 0.008, 4.6, '#e8e8e0', false);
  box(2.75, BASE + 0.05, -4.55, 1.4, 0.08, 0.14, '#6a727a', false);
  for (let i = 0; i < 10; i++) box(0, 0.212, 0.5 + i * 0.22, 0.34, 0.01, 0.2, '#d8b23a', false);
  box(0, 0.214, 0.4, 1.4, 0.014, 0.6, '#58626c', false); box(0, 0.222, 0.4, 1.22, 0.004, 0.46, '#7a8590', false);
  const spill = additive(spillT, '#ffe9bd', 0.26);
  decal(2.4, 1.0, (FW[0] + FW[1]) / 2, 0.208, 1.0, [0, -1], spill); decal(1.6, 1.0, 0, 0.226, 0.95, [0, -1], spill);
  decal(1.4, 0.8, X0 - 0.45, 0.2, (WW[0] + WW[1]) / 2, [1, 0], additive(spillT, '#ffe9bd', 0.14));
  decal(1.2, 0.4, (RD[0] + RD[1]) / 2, 0.208, Z1 - 0.3, [0, 1], additive(glowT, '#ffe8b8', 0.2));
  decal(2.6, 1.0, -1.0, 0.205, 1.3, [0, -1], additive(glowT, '#9ff0c0', 0.1));
  const refT = tex(256, 64, (q, w, h) => { q.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = rnd() * w, ww = 2 + rnd() * 8, g = q.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(255,236,190,${0.4 + rnd() * 0.5})`); g.addColorStop(1, 'rgba(255,236,190,0)'); q.fillStyle = g; q.fillRect(x, 0, ww, h * (0.5 + rnd() * 0.5)); } });
  const refM = new THREE.MeshBasicMaterial({ map: refT, color: '#ffe6b8', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 });
  decal(4.0, 1.0, -1.0, 0.209, 1.55, [0, -1], refM);

  // ================= local animation: light-box breathing, window rain, canopy and carport drips =================
  const fx = new THREE.Group(); fx.userData.live = true; group('clinic').add(fx); K.setRoot(fx);
  const signGlow = additive(glowT, '#d8ffe4', 0.22); mesh(new THREE.PlaneGeometry(5.4, 1.4), signGlow, -1.1, 2.95, 0.3, false, fx);
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6);
  for (let i = 0; i < 8; i++) runs.add(FW[0] + 0.1 + rnd() * (FW[1] - FW[0] - 0.2), FW[2] + 0.1 + rnd() * 0.8, 0.52, 0.07 + rnd() * 0.06, FW[2] + 0.06, FW[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 6; i++) drips.add(-1.1 + i * 0.4 + rnd() * 0.1, 0.4 + rnd() * 1.5, 0.78, 0.09, 0.25, 2.4, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 10; i++) drips.add(1.6 + i * 0.25 + rnd() * 0.1, 0.4 + rnd() * 1.5, 0.13, 0.09, 0.25, 2.5, 2.0 + rnd() * 0.5);
  runs.seal(); drips.seal();
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt);
      const v = 0.93 + 0.07 * Math.sin(t * 0.8); signM.color.setRGB(v, v, v); signGlow.opacity = 0.19 + 0.05 * Math.sin(t * 0.8);   // slow breathing, no strobing
      refT.offset.x = 0.012 * Math.sin(t * 0.6); refM.opacity = 0.15 + 0.04 * Math.sin(t * 0.9) * Math.sin(t * 0.37);
    },
  };
};
