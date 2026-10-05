// B03-P05 みどり屋 雑貨店 (Midoriya Zakkaten): a one-storey greengrocer / general store at the west end of the main street.
// Task card docs/buildings/tasks/B03-P05.md, reference docs/buildings/references/B03-P05.jpg.
// Local frame (placed by layout.js `buildings`, rotY 0): front +z faces the main street (world S), +x is the
// viewer's right = world E; door centre at the origin, floor top at rec.floor.
// Pale apricot plaster, green corrugated steel gable roof (ridge along x), a striped canvas awning and a front kanban sign.
// Body 5.6 × 5.6: x -2.8…2.8, z -5.6…0 (roof edges to ±3.1 / +0.3 / -5.9, awning to +0.8: inside the 7.0 × 7.0 envelope).
// Groups: grocery (shell, frame, roof, awning, sign, gutters, interior) · groceryFrontW (west produce stand, pots) ·
// groceryFrontE (east produce stand, delivery crates, pots) · grocerySideW (AC unit, gas cylinders) · grocerySideE (hand
// cart, crates, pots) · groceryRear (back-door step, sink, locker, crates) · groceryGround.
// Plan: produce rack along the west wall, a two-sided gondola mid-hall, rice sacks and condiment shelves along the east
// wall, a cashier counter (register, scale) at the east back, drink coolers across the west back wall, shelves under the
// rear window, and a storeroom behind a partition in the east back corner (back door beside it).
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B03-P05'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(3305), PI = Math.PI;
  const F = rec.floor, X0 = -2.8, X1 = 2.8, Z0 = 0, Z1 = -5.6, T = 0.15, BASE = 0.19, EF = 3.0, RH = 3.95, CEIL = 2.75, ZR = (Z0 + Z1) / 2;
  const SL = (RH - EF) / (Z0 - ZR), TH = Math.atan(SL), OVS = 0.3, OVF = 0.3;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T;
  const roofY = z => RH - Math.abs(z - ZR) * SL;   // roof underside height at depth z
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FW = [-2.65, -0.95, 0.7, 2.2], FD = [-0.85, 0.85, F, 2.2], FE = [0.95, 2.65, 0.7, 2.2];
  const WL = [-3.4, -2.2, 1.35, 2.15], ER = [-3.5, -2.3, 1.3, 2.1], BD = [1.5, 2.3, F, 2.2], RW = [-0.1, 0.9, 1.35, 2.15];

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#d8c5a0'), alu = '#46544f', aluL = '#5f706a', stoneC = '#9a958b', metal = '#8a8f92', greenD = '#2d5648', timber = '#5a4030';
  const wcache = {}, W = (c, k = 0.3) => wcache[c + k] || (wcache[c + k] = warm(c, k));
  const wood = W('#b0814f'), woodD = W('#6f4a35', 0.26), cream = W('#efe0c0', 0.34), steel = W('#c3cacb', 0.22), white = W('#f1ece0', 0.34);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' });
  // Green corrugated steel roof: ribs run down the slope.
  const ribT = tex(128, 128, (q, w, h) => { q.fillStyle = '#3f6b5c'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) { const g = q.createLinearGradient(i * 32, 0, i * 32 + 32, 0); g.addColorStop(0, '#2f5a4c'); g.addColorStop(0.45, '#4f8672'); g.addColorStop(1, '#2c5446'); q.fillStyle = g; q.fillRect(i * 32, 0, 32, h); q.fillStyle = 'rgba(15,32,28,.55)'; q.fillRect(i * 32, 0, 2, h); }
    for (let i = 0; i < 400; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '8,20,18' : '190,220,205'},${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1, 1 + rnd() * 6); } });
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: ribT });
  const tileF = tex(128, 128, (q, w, h) => { q.fillStyle = '#c8bda4'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { q.fillStyle = `rgba(${(i + j) % 2 ? '255,248,230' : '90,80,64'},.1)`; q.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
    q.strokeStyle = 'rgba(70,60,48,.45)'; q.lineWidth = 1.5; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 32, 0); q.lineTo(i * 32, h); q.moveTo(0, i * 32); q.lineTo(w, i * 32); q.stroke(); } });
  const pavers = tex(256, 256, (q, w, h) => { q.fillStyle = '#9d9a8f'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      q.fillStyle = `rgba(${rnd() < 0.5 ? '70,78,92' : '250,246,236'},${0.05 + rnd() * 0.08})`; q.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    q.strokeStyle = 'rgba(48,56,66,.45)'; q.lineWidth = 2; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); }
    for (let i = 0; i < 900; i++) { q.fillStyle = `rgba(40,48,60,${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1); } });
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

  // ---- plants and produce ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), LEAF = ['#6c9476', '#88a98a', '#5e8a6a'];
  const shrub = (x, y, z, r, n, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(LEAF[i % 3]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.35 + rnd() * r * h, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.45 + rnd() * 0.25)); } };
  const pot = (x, y, z, r, n = 5, h = 1, c = '#9b7d68') => { mesh(new THREE.CylinderGeometry(r, r * 0.76, r * 1.15, 10), mat(c), x, y + r * 0.575, z); shrub(x, y + r * 1.1, z, r, n, h); };
  const PROD = ['#c9372c', '#e08a2c', '#7aa845', '#d8c23c', '#7b3f86', '#4f8d3f', '#e05a3a'];
  const ballG = new THREE.SphereGeometry(1, 7, 5);
  const fruit = (x, y, z, r, c, interior) => { const m = mesh(ballG, interior ? W(c, 0.34) : mat(c), x, y, z, false); m.scale.setScalar(r); return m; };
  // A row of produce along x or z on top of a crate.
  const row = (axis, a, b, y, c0, n, r, interior) => { for (let i = 0; i < n; i++) { const u = a + (i + 0.5) * (b - a) / n, c = PROD[Math.floor(rnd() * PROD.length)];
    if (axis === 'x') fruit(u, y + r * 0.7, c0 + (rnd() - 0.5) * 0.03, r * (0.85 + rnd() * 0.3), c, interior); else fruit(c0 + (rnd() - 0.5) * 0.03, y + r * 0.7, u, r * (0.85 + rnd() * 0.3), c, interior); } };
  const GOODS = ['#c9372c', '#e0b030', '#4f7aa8', '#6aa05a', '#f0e6cc', '#a8602c', '#d86a3a', '#8a6aa8'];
  // Shelf stock: cans and cartons along a shelf board, facing `dir` (+1 / -1 along z, or along x when axis = 'z').
  const stock = (axis, a, b, y, c0, n, interior = true) => { for (let i = 0; i < n; i++) { const u = a + (i + 0.5) * (b - a) / n, c = GOODS[Math.floor(rnd() * GOODS.length)], can = rnd() < 0.5, h = 0.1 + rnd() * 0.08;
    const x = axis === 'x' ? u : c0, z = axis === 'x' ? c0 : u;
    if (can) cyl(x, y + h / 2, z, 0.03 + rnd() * 0.012, h, W(c, 0.34)); else box(x, y + h / 2, z, axis === 'x' ? 0.07 : 0.1, h, axis === 'x' ? 0.1 : 0.07, W(c, 0.34), false); } };

  // ================= shell =================
  group('grocery');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, EF], [FW, FD, FE], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, EF], [BD, RW], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, EF], [ER], plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, EF], [WL], plaster);
  // Gable triangles above both side walls (apex at the ridge z = ZR).
  shapeMesh([[IZ0, EF - 0.01], [IZ1, EF - 0.01], [ZR, RH]], T, plaster, X1, 0, 0, -PI / 2);
  shapeMesh([[IZ0, EF - 0.01], [IZ1, EF - 0.01], [ZR, RH]], T, plaster, X0 + T, 0, 0, -PI / 2);
  // Stone plinth, painted corner posts, a belt rail and the eave beams.
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FD[0], Z0, 1); plinth('x', FD[1], X1, Z0, 1); plinth('x', X0, BD[0], Z1, -1); plinth('x', BD[1], X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  const post = (x, z) => box(x, (BASE + EF) / 2, z, 0.13, EF - BASE, 0.13, '#8a7a62');
  post(X0 + 0.05, Z0 - 0.05); post(X1 - 0.05, Z0 - 0.05); post(X0 + 0.05, Z1 + 0.05); post(X1 - 0.05, Z1 + 0.05);
  box(0, EF - 0.07, 0.015, X1 - X0 + 0.04, 0.14, 0.06, '#8a7a62'); box(0, EF - 0.07, Z1 - 0.015, X1 - X0 + 0.04, 0.14, 0.06, '#8a7a62');
  for (const [x, o] of [[X0, -1], [X1, 1]]) { box(x + o * 0.015, 1.0, (Z0 + Z1) / 2, 0.05, 0.07, Z0 - Z1 + 0.06, '#8a7a62'); box(x + o * 0.015, EF - 0.07, (Z0 + Z1) / 2, 0.06, 0.14, Z0 - Z1 + 0.06, '#8a7a62'); }
  // Floor: cream tile throughout (counter area and storeroom use the same tile).
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - IZ1), (IX1 - IX0) / 1.2, (IZ0 - IZ1) / 1.2), warm('#ffffff', 0.2, tileF), 0, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  // Interior linings: warm cream plaster, tiled wainscot behind the produce rack side.
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL], [FW, FD, FE], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL], [ER], cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL], [WL], cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL], [BD, RW], cream);
  box(0, F + 0.45, IZ1 + 0.01, IX1 - IX0, 0.9, 0.012, W('#cfd8cc', 0.3), false);
  for (const x of [IX0 + 0.006, IX1 - 0.006]) box(x, F + 0.45, (IZ0 + IZ1) / 2, 0.012, 0.9, IZ0 - IZ1, W('#cfd8cc', 0.3), false);

  // ---- glazing: dark-green aluminium frames, grilles on the side and rear windows ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = [], grille = 0) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, alu); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, alu);
    ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, alu); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, alu);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.045, q - p, fd * 0.9, alu);
    for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.04, fd * 0.9, alu);
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    if (grille) { const d = at + out * 0.09, n = Math.round((b - a) / grille); for (let i = 1; i < n; i++) ab(axis, a + i * (b - a) / n, (p + q) / 2, d, 0.022, q - p, 0.03, '#3d4640');
      for (const y of [p + 0.03, (p + q) / 2, q - 0.03]) ab(axis, (a + b) / 2, y, d, b - a, 0.035, 0.05, '#3d4640'); }
    if (p > F + 0.05) ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.1, 0.05, 0.15, '#a8a091');
  }
  glaze('x', -T / 2, 1, FW, [-1.8, -1.35], [1.65]);
  glaze('x', -T / 2, 1, FE, [1.35, 1.8], [1.65]);
  glaze('z', X1 - T / 2, 1, ER, [-2.9], [], 0.12);
  glaze('z', X0 + T / 2, -1, WL, [-2.8], [], 0.12);
  glaze('x', Z1 + T / 2, -1, RW, [], [], 0.12);
  // Low stall boards under the shopfront windows (outside), painted green.
  for (const w of [FW, FE]) box((w[0] + w[1]) / 2, (0.32 + w[2] - 0.05) / 2, 0.012, w[1] - w[0] - 0.04, w[2] - 0.05 - 0.32, 0.02, greenD);
  // Front door: double sliding glass door in aluminium frames, push strips, a sticker.
  ab('x', FD[0] + 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, alu); ab('x', FD[1] - 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, alu);
  box(0, FD[3] - 0.03, -T / 2, FD[1] - FD[0], 0.06, 0.16, alu);
  {
    const z = -0.05, top = FD[3] - 0.06, l = -0.84, r = 0.84;
    for (const x of [l + 0.04, -0.03, 0.03, r - 0.04]) box(x, (F + top) / 2, z, 0.06, top - F, 0.045, aluL);
    box(0, top - 0.04, z, r - l, 0.08, 0.045, aluL); box(0, F + 0.05, z, r - l, 0.1, 0.045, aluL);
    box(0, (F + 0.1 + top - 0.08) / 2, z, r - l - 0.1, top - 0.08 - F - 0.1, 0.012, glass, false);
    for (const x of [-0.14, 0.14]) box(x, 1.1, z + 0.03, 0.025, 0.4, 0.025, '#c9c9c0');
    box(0.5, 1.25, z + 0.012, 0.18, 0.18, 0.006, '#d8b23a', false);
  }
  shapeMesh([[0, BASE], [0.52, BASE], [0.52, 0.212], [0, 0.298]], 1.9, '#a8a091', 0.95, 0, 0, -PI / 2);
  // Back door: green steel door in a frame, small canopy, step, lamp.
  ab('x', BD[0] + 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, alu); ab('x', BD[1] - 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, alu);
  box((BD[0] + BD[1]) / 2, BD[3] - 0.03, Z1 + T / 2, BD[1] - BD[0], 0.06, 0.16, alu);
  box((BD[0] + BD[1]) / 2, (F + BD[3] - 0.06) / 2, Z1 + 0.06, BD[1] - BD[0] - 0.12, BD[3] - 0.06 - F, 0.04, '#3f6256');
  box((BD[0] + BD[1]) / 2, 1.8, Z1 + 0.035, BD[1] - BD[0] - 0.3, 0.3, 0.012, '#6a8a7c', false);
  for (const y of [0.9, 1.45]) box((BD[0] + BD[1]) / 2, y, Z1 + 0.035, BD[1] - BD[0] - 0.22, 0.02, 0.012, '#2a4036', false);
  box(BD[0] + 0.12, 1.1, Z1 + 0.02, 0.03, 0.16, 0.04, '#c9c9c0');
  shapeMesh([[0, BASE], [0.3, BASE], [0.3, 0.3], [0, 0.3]], BD[1] - BD[0] + 0.1, '#a8a091', BD[0] - 0.05, 0, Z1, PI / 2);
  { const e = box((BD[0] + BD[1]) / 2, 2.4, Z1 - 0.22, 1.05, 0.05, 0.46, '#2f5a4c'); e.rotation.x = -0.28; }
  for (const x of [BD[0] - 0.05, BD[1] + 0.05]) box(x, 2.28, Z1 - 0.13, 0.05, 0.05, 0.28, '#5a4030');
  box(BD[0] - 0.28, 1.95, Z1 - 0.06, 0.12, 0.17, 0.1, '#3d4a58'); box(BD[0] - 0.28, 1.94, Z1 - 0.06, 0.09, 0.12, 0.105, bulb, false);
  mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.26), BD[0] - 0.28, 1.95, Z1 - 0.004, false).rotation.y = PI;

  // ================= striped canvas awning, kanban sign, lamps =================
  {
    const x0 = -2.85, x1 = 2.85, top = 2.62, low = 2.3, dep = 0.8, len = Math.hypot(dep, top - low);
    const stripeT = canvasTex(384, 64, (q, w, h) => { for (let i = 0; i < 24; i++) { q.fillStyle = i % 2 ? '#efe6cc' : '#3f7a60'; q.fillRect(i * 16, 0, 16, h); }
      q.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < 80; i++) q.fillRect(rnd() * w, rnd() * h, 2, 1 + rnd() * 4); });
    const awnM = new THREE.MeshToonMaterial({ map: stripeT, gradientMap: K.ramp });
    const e = box(0, (top + low) / 2 + 0.02, dep / 2, x1 - x0, 0.04, len, awnM); e.rotation.x = Math.atan2(top - low, dep);
    // scalloped valance: a hanging strip with the same stripes
    box(0, low - 0.09, dep - 0.005, x1 - x0, 0.2, 0.025, awnM);
    for (const x of [-2.6, -0.9, 0.9, 2.6]) { rod([x, 2.62, 0.02], [x, top - 0.03, 0.02], 0.01, '#3a3330'); rod([x, 2.0, 0.03], [x, low - 0.03, dep * 0.85], 0.02, aluL); }
    box(0, low - 0.19, dep - 0.005, x1 - x0, 0.03, 0.04, '#2f5a4c');
  }
  // Kanban sign standing in front of the roof edge on three brackets: dark green board, cream lettering, fruit emblem.
  {
    const s = canvasTex(1024, 192, (q, w, h) => { q.fillStyle = '#2d5648'; q.fillRect(0, 0, w, h); q.strokeStyle = '#d9cfa8'; q.lineWidth = 6; q.strokeRect(8, 8, w - 16, h - 16);
      q.strokeStyle = 'rgba(217,207,168,.5)'; q.lineWidth = 2; q.strokeRect(18, 18, w - 36, h - 36);
      q.fillStyle = '#f1e9c8'; q.beginPath(); q.arc(120, 100, 62, 0, PI * 2); q.fill();
      q.fillStyle = '#d4492f'; q.beginPath(); q.arc(104, 112, 28, 0, PI * 2); q.fill(); q.fillStyle = '#e8a53a'; q.beginPath(); q.arc(140, 108, 24, 0, PI * 2); q.fill(); q.fillStyle = '#6aa04c'; q.beginPath(); q.ellipse(122, 66, 20, 11, -0.4, 0, PI * 2); q.fill();
      q.fillStyle = '#f1e9c8'; q.textBaseline = 'middle'; q.textAlign = 'center'; q.font = 'bold 118px serif'; q.fillText('雑貨店', 470, 104);
      q.font = 'bold 28px serif'; q.fillStyle = '#d9cfa8'; q.fillText('みどり屋', 470, 38);
      q.font = 'bold 30px sans-serif'; q.textAlign = 'left'; q.fillStyle = '#f1e9c8'; q.fillText('やさい', 800, 60); q.fillText('くだもの', 800, 98); q.fillText('日用品', 800, 136); });
    const sm = new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, emissive: '#2a3a30', emissiveMap: s });
    box(0, 3.08, 0.4, 5.34, 0.78, 0.07, '#24443a'); mesh(new THREE.PlaneGeometry(5.2, 0.7), sm, 0, 3.08, 0.438, false);
    for (const x of [-2.4, 0, 2.4]) box(x, 2.72, 0.2, 0.06, 0.05, 0.4, '#24443a');
    box(0, 3.5, 0.4, 5.4, 0.05, 0.1, '#24443a');
    // sign lights: two gooseneck lamps over the board
    for (const x of [-1.6, 1.6]) { rod([x, 3.52, 0.4], [x, 3.62, 0.62], 0.012, '#3a3330'); box(x, 3.61, 0.66, 0.16, 0.05, 0.1, '#3d4a58'); mesh(new THREE.PlaneGeometry(1.8, 0.8), additive(glowT, '#ffe2b0', 0.13), x, 3.2, 0.47, false); }
  }
  // Wall lanterns under the awning either side of the door.
  for (const x of [-1.05, 1.05]) { box(x, 2.0, 0.07, 0.12, 0.18, 0.1, '#3d4a58'); box(x, 1.99, 0.07, 0.09, 0.13, 0.105, bulb, false);
    mesh(new THREE.PlaneGeometry(0.8, 0.8), additive(glowT, '#ffc27e', 0.26), x, 2.0, 0.05, false); }

  // ================= gable roof (roof layer) =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('grocery').add(roofLayer); K.setRoot(roofLayer);
  box(0, CEIL + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#e6dcc4', 0.34), false);   // ceiling boards
  for (let i = 1; i < 5; i++) box(0, CEIL - 0.02, IZ0 - i * (IZ0 - IZ1) / 5, IX1 - IX0, 0.04, 0.07, woodD, false);
  {
    const Wd = X1 - X0 + 2 * OVS, zf = Z0 + OVF, zr = Z1 - OVF;
    for (const [za, zb, s] of [[zf, ZR, 1], [ZR, zr, -1]]) {
      const run = Math.abs(za - zb), Ds = run / Math.cos(TH), cz = (za + zb) / 2, cy = roofY(cz) + 0.07;
      mesh(tileUV(new THREE.BoxGeometry(Wd, 0.1, Ds), Wd / 0.5, 1), roofM, 0, cy, cz).rotation.x = s * TH;
      box(0, cy - 0.05, cz, Wd - 0.02, 0.07, Ds - 0.02, '#4a3a30', false).rotation.x = s * TH;   // underside boards
      for (const sx of [-1, 1]) { const f = box(sx * (Wd / 2 - 0.02), cy - 0.04, cz, 0.05, 0.2, Ds, '#24443a'); f.rotation.x = s * TH; }   // barge boards
    }
    // Ridge cap and gutters (front and rear).
    box(0, RH + 0.12, ZR, Wd, 0.08, 0.34, '#2f5a4c');
    const gut = (z, o) => { const g = mesh(new THREE.CylinderGeometry(0.065, 0.065, Wd, 10, 1, true, 0, PI), mat('#8796a0'), 0, roofY(z) - 0.03, z + o * 0.04); g.rotation.z = PI / 2; g.rotation.x = o > 0 ? PI : 0; };
    gut(zf, 1); gut(zr, -1);
    box(0, roofY(zf) + 0.05, zf + 0.02, Wd, 0.12, 0.04, '#24443a'); box(0, roofY(zr) + 0.05, zr - 0.02, Wd, 0.12, 0.04, '#24443a');
    // Rooftop outdoor AC on a stand on the rear slope, vent cabinet beside it (reference ROOF TOP), TV antenna at the east gable.
    const ax = -1.7, az = -4.1, ay = roofY(az) + 0.16;
    for (const dx of [-0.32, 0.32]) box(ax + dx, ay + 0.05, az, 0.07, 0.2, 0.5, '#3d4a58');
    box(ax, ay + 0.45, az, 0.82, 0.58, 0.34, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), ax - 0.15, ay + 0.45, az + 0.172, false);
    for (let i = 0; i < 4; i++) box(ax - 0.15, ay + 0.35 + i * 0.07, az + 0.174, 0.38, 0.012, 0.01, '#9aa6ab', false);
    const vz = -4.0, vy = roofY(vz) + 0.1; box(0.3, vy + 0.3, vz, 0.7, 0.5, 0.5, '#7d8a88');
    for (let i = 0; i < 4; i++) box(0.3, vy + 0.22 + i * 0.08, vz + 0.255, 0.56, 0.02, 0.01, '#4a5654', false);
    box(0.3, vy + 0.58, vz, 0.76, 0.05, 0.56, '#566360');
    line([[-1.3, roofY(-4.0) + 0.5, -4.1], [-0.6, roofY(-4.0) + 0.5, -4.1], [0.0, roofY(-4.0) + 0.45, -4.0]], '#9aa3a6', 0.022);
    const mx = 2.15, mz = -3.3, my = roofY(mz);
    rod([mx, my, mz], [mx, my + 2.6, mz], 0.025, '#59656d');
    for (const [y, l] of [[1.0, 0.6], [1.6, 0.52], [2.1, 0.42], [2.5, 0.3]]) { rod([mx, my + y, mz - l], [mx, my + y, mz + l], 0.012, '#59656d'); }
    rod([mx, my + 1.0, mz - 0.6], [mx, my + 2.5, mz], 0.008, '#59656d'); rod([mx, my + 1.0, mz + 0.6], [mx, my + 2.5, mz], 0.008, '#59656d');
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) rod([mx, my + 1.4, mz], [mx + dx * 0.5, my + 0.03, mz + dz * 0.5], 0.006, '#3a3330');
  }
  group('grocery');
  // Downpipes: east at the front corner, west at the rear corner; stainless vent pipe at the west eave.
  for (const [x, z, y0] of [[X1 + OVS - 0.06, 0.27, roofY(0.3)], [X0 - OVS + 0.06, Z1 - 0.27, roofY(-5.9)]]) {
    const ey = y0 - 0.1, s = Math.sign(x);
    cyl(x, (ey + 0.3) / 2, z, 0.04, ey - 0.3, '#8796a0'); for (const y of [0.9, 2.0]) rod([x, y, z], [s * (X1 + 0.02), y, z], 0.012, '#5f6c76');
    box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91');
  }
  // Meter boxes on the east wall (rear), a vent grille on the west wall.
  box(X1 + 0.08, 1.55, -4.7, 0.16, 0.42, 0.3, '#cdd0c9'); box(X1 + 0.165, 1.63, -4.7, 0.01, 0.12, 0.18, '#7b8a92', false);
  line([[X1 + 0.06, 1.33, -4.7], [X1 + 0.06, 0.45, -4.7]], '#9aa3a6', 0.018);
  box(X0 - 0.03, 2.5, -4.6, 0.06, 0.28, 0.36, '#c4c7c0'); for (let i = 0; i < 4; i++) box(X0 - 0.065, 2.41 + i * 0.06, -4.6, 0.012, 0.012, 0.3, '#7f8b93', false);

  // ================= interior =================
  const tube = (x, z, len, axis = 'x') => { const w = axis === 'x' ? len : 0.1, d = axis === 'x' ? 0.1 : len; box(x, CEIL - 0.04, z, w + 0.04, 0.05, d + 0.04, '#7d8b88', false, roofLayer); box(x, CEIL - 0.075, z, w, 0.02, d, W('#fff4d0', 0.95), false, roofLayer); };
  // Near layer, west window: low display table of oranges, mandarin boxes and a price easel; east window: snack and noodle shelf.
  {
    const tx = -1.65, tz = -0.55;
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(tx + dx * 0.62, F + 0.26, tz + dz * 0.22, 0.05, 0.52, 0.05, woodD, false);
    box(tx, F + 0.54, tz, 1.4, 0.05, 0.56, wood); box(tx, F + 0.62, tz + 0.12, 1.3, 0.1, 0.3, W('#e0b878', 0.3));
    for (let i = 0; i < 7; i++) fruit(tx - 0.55 + i * 0.185, F + 0.72, tz + 0.12, 0.075, i % 3 ? '#e08a2c' : '#d8c23c', true);
    for (let i = 0; i < 6; i++) fruit(tx - 0.5 + i * 0.2, F + 0.66, tz - 0.14, 0.07, ['#c9372c', '#7aa845', '#e05a3a'][i % 3], true);
    box(tx + 0.4, F + 0.82, tz - 0.17, 0.3, 0.2, 0.012, W('#f0e6cc', 0.4), false);
  }
  {
    const sx = 1.65, sz = -0.42;
    box(sx, F + 0.32, sz, 1.5, 0.64, 0.4, woodD);
    for (const y of [F + 0.64, F + 0.34]) { box(sx, y, sz, 1.46, 0.025, 0.38, wood, false); stock('x', sx - 0.7, sx + 0.7, y + 0.012, sz - 0.02, 11); }
    for (let i = 0; i < 5; i++) box(sx - 0.55 + i * 0.27, F + 0.74, sz, 0.2, 0.2, 0.12, W(GOODS[(i * 3) % GOODS.length], 0.34), false);   // noodle packs on top
  }
  // Left side, west wall: three-tier produce rack running z -1.15 … -3.65, items sloping to the aisle.
  {
    const zA = -1.15, zB = -3.65, zc = (zA + zB) / 2, L = zA - zB;
    const tiers = [[-2.3, 0.4, 0.5], [-2.52, 0.8, 0.46], [-2.67, 1.18, 0.34]];
    for (const [x, h, w] of tiers) { box(x, F + h / 2, zc, w, h, L, woodD); box(x + w / 2 - 0.02, F + h - 0.07, zc, 0.03, 0.14, L + 0.02, wood); box(x, F + h + 0.005, zc, w - 0.02, 0.012, L - 0.02, W('#d7b27a', 0.32), false); }
    tiers.forEach(([x, h, w], i) => { const n = 16 - i * 2; row('z', zB + 0.08, zA - 0.08, F + h + 0.01, x - 0.07, n, 0.075, true); row('z', zB + 0.08, zA - 0.08, F + h + 0.01, x + 0.1, n, 0.07, true); });
    for (let i = 0; i < 6; i++) { box(-2.35, F + 1.52, zA - 0.2 - i * 0.37, 0.18, 0.3, 0.3, W(['#7aa845', '#4f8d3f', '#e8e0b0'][i % 3], 0.34), false); }   // cabbage and daikon top shelf
    box(-2.64, F + 1.42, zc, 0.08, 0.04, L, wood, false);
    // hanging price flags
    for (let i = 0; i < 4; i++) box(-2.12, F + 0.82, zA - 0.35 - i * 0.7, 0.012, 0.12, 0.22, W('#f3ead0', 0.4), false);
  }
  // Mid layer: two-sided gondola, five levels.
  {
    const gx = -0.68, z0 = -1.85, z1 = -3.85, zc = (z0 + z1) / 2, L = z0 - z1, top = 1.45;
    box(gx, F + 0.12, zc, 0.52, 0.24, L, woodD); box(gx, F + top / 2, zc, 0.04, top, L, W('#8d6a4a', 0.28));
    for (const sx of [-0.25, 0.25]) box(gx + sx, F + top / 2, zc, 0.02, top, L, '#59656d');
    box(gx, F + top + 0.03, zc, 0.54, 0.06, L + 0.06, wood);
    for (let k = 0; k < 4; k++) { const y = F + 0.3 + k * 0.28; box(gx - 0.12, y, zc, 0.22, 0.02, L - 0.04, steel, false); box(gx + 0.12, y, zc, 0.22, 0.02, L - 0.04, steel, false);
      stock('z', z1 + 0.1, z0 - 0.1, y + 0.01, gx - 0.12, 9); stock('z', z1 + 0.1, z0 - 0.1, y + 0.01, gx + 0.12, 9); }
    box(gx, F + top + 0.2, zc, 0.06, 0.3, 0.9, W('#f0e6cc', 0.4)); K.label('特売', gx - 0.035, F + top + 0.2, zc - 0.0, 0.5, 0.2, '#b9382d', '#f0e6cc', 90).rotation.y = -PI / 2;
  }
  // Right side, east wall: condiment shelves (three tiers) and rice sacks stacked on a pallet.
  {
    const x = IX1 - 0.17, z0 = -0.5, z1 = -2.2, zc = (z0 + z1) / 2, L = z0 - z1;
    box(x + 0.15, F + 1.2, zc, 0.02, 2.0, L, W('#8d6a4a', 0.28), false);
    for (let k = 0; k < 4; k++) { const y = F + 0.75 + k * 0.38; box(x, y, zc, 0.32, 0.03, L, wood); stock('z', z1 + 0.08, z0 - 0.08, y + 0.015, x - 0.04, 11);
      for (let i = 0; i < 5; i++) cyl(x + 0.04, y + 0.12, z1 + 0.2 + i * 0.3, 0.035, 0.18, W(['#6b3a22', '#a8602c', '#c9372c'][i % 3], 0.34)); }
    for (const z of [z0 - 0.05, z1 + 0.05]) box(x + 0.02, F + 1.1, z, 0.3, 1.8, 0.03, '#59656d', false);
    // sacks of rice, 2 columns × 3 high, two rows deep — each a squat pillow with a tied neck
    const px = 1.9, pz0 = -0.75, pz1 = -2.15;
    box(px, F + 0.05, (pz0 + pz1) / 2, 0.84, 0.1, pz0 - pz1 + 0.08, woodD);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) for (let h = 0; h < 3 - (r === 2 ? 1 : 0); h++) {
      const sx = px + (c - 0.5) * 0.38, sz = pz0 - 0.2 - r * 0.45, sy = F + 0.1 + h * 0.18 + 0.09; const s = mesh(new THREE.BoxGeometry(0.36, 0.17, 0.42), W(['#e6dcc0', '#d9cfae', '#efe6cc'][(r + c + h) % 3], 0.34), sx, sy, sz); s.rotation.y = (rnd() - 0.5) * 0.14;
      if (h === 0 || r === 2) box(sx, sy + 0.1, sz, 0.18, 0.02, 0.14, W('#b94a3a', 0.32), false); }
    K.label('新米', px - 0.25, F + 0.78, pz0 - 0.2 + 0.22, 0.2, 0.1, '#b9382d', '#f3ead0', 60);
  }
  // Back layer: drink coolers across the west back wall, shelving under the rear window, storeroom partition.
  {
    const cz = IZ1 + 0.38, cw = 0.6, ch = 1.9, cx0 = IX0 + 0.05;
    for (let i = 0; i < 3; i++) { const cx = cx0 + cw / 2 + i * (cw + 0.02);
      box(cx, F + ch / 2, cz, cw, ch, 0.62, '#dfe3e0'); box(cx, F + ch + 0.04, cz, cw + 0.02, 0.08, 0.64, '#59656d');
      box(cx, F + ch / 2 + 0.02, cz + 0.312, cw - 0.06, ch - 0.2, 0.01, W('#d9f2f2', 0.95), false);
      for (let k = 0; k < 5; k++) { const y = F + 0.3 + k * 0.33; box(cx, y, cz + 0.29, cw - 0.08, 0.015, 0.1, '#9aa6ab', false);
        for (let j = 0; j < 5; j++) cyl(cx - 0.2 + j * 0.1, y + 0.1, cz + 0.29, 0.032, 0.18, W(['#c9372c', '#e0b030', '#4f7aa8', '#6aa05a', '#f0e6cc', '#8a6aa8'][(j + k * 2 + i) % 6], 0.45)); }
      box(cx, F + ch / 2 + 0.02, cz + 0.318, cw - 0.04, ch - 0.16, 0.012, glass, false);
      box(cx - cw / 2 + 0.03, F + ch / 2, cz + 0.325, 0.03, ch - 0.1, 0.03, '#59656d', false); box(cx + cw / 2 - 0.03, F + ch / 2, cz + 0.325, 0.03, ch - 0.1, 0.03, '#59656d', false);
      box(cx + 0.18, F + 0.95, cz + 0.34, 0.025, 0.4, 0.03, '#c9c9c0', false); }
    K.label('ドリンク', cx0 + 0.9, F + ch + 0.04, cz + 0.325, 0.9, 0.06, '#d9f2f2', '#2d5648', 50);
    // rear wall shelving between the coolers and the partition (below the rear window)
    for (let k = 0; k < 3; k++) { const y = F + 0.5 + k * 0.28; box(0.15, y, IZ1 + 0.19, 1.5, 0.03, 0.34, wood); stock('x', -0.55, 0.85, y + 0.015, IZ1 + 0.19, 13); }
    for (const x of [-0.62, 0.92]) box(x, F + 0.55, IZ1 + 0.19, 0.04, 1.1, 0.34, woodD, false);
    box(0.15, F + 0.22, IZ1 + 0.19, 1.5, 0.44, 0.34, woodD);
    // storeroom partition at z = -4.35 with a doorway x 1.45 … 2.25, door standing open flat to the wall
    const pz = -4.35;
    box((IX1 + 2.25) / 2, F + 1.25, pz, IX1 - 2.25, 2.5, 0.08, cream); box((1.0 + 1.45) / 2, F + 1.25, pz, 0.45, 2.5, 0.08, cream);
    box(1.85, F + 2.4, pz, 0.85, 0.2, 0.08, cream); box(1.0, F + 1.25, pz - 0.01, 0.06, 2.5, 0.1, '#8a7a62'); box(1.45, F + 1.2, pz + 0.045, 0.04, 2.4, 0.06, '#8a7a62'); box(2.25, F + 1.2, pz + 0.045, 0.04, 2.4, 0.06, '#8a7a62');
    // storeroom: cartons and a shelf unit seen through the doorway
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2 - (i === 2 ? 1 : 0); j++) box(2.3 + (i % 2) * 0.05, F + 0.15 + j * 0.3, -4.7 - i * 0.28, 0.5, 0.28, 0.26, W(['#c9a06a', '#b98f58', '#d4ae78'][(i + j) % 3], 0.3));
    box(1.2, F + 1.0, -5.2, 0.34, 2.0, 0.9, woodD, false); for (let k = 0; k < 4; k++) { box(1.2, F + 0.3 + k * 0.5, -5.2, 0.34, 0.03, 0.9, wood); stock('z', -5.6 + 0.2, -4.75, F + 0.32 + k * 0.5, 1.2, 7); }
    box(1.55, F + 0.55, -5.1, 0.5, 1.1, 0.5, W('#9aa4a8', 0.2));
    tube(1.85, -4.95, 1.2, 'x');
  }
  // Cashier counter at the east back: register, electronic scale, bags, candy jars, a招き猫.
  {
    const x0 = 0.6, x1 = 1.95, z0 = -3.05, z1 = -3.55, top = F + 0.95, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(cx, F + 0.45, cz, x1 - x0, 0.9, z0 - z1, woodD); box(cx, top - 0.03, cz, x1 - x0 + 0.04, 0.06, z0 - z1 + 0.08, wood);
    for (let i = 1; i < 7; i++) box(x0 + i * (x1 - x0) / 7, F + 0.45, z0 + 0.003, 0.02, 0.76, 0.012, wood, false);
    box(cx + 0.35, top + 0.1, cz, 0.3, 0.14, 0.26, W('#5a4a3c', 0.14)); box(cx + 0.35, top + 0.2, cz - 0.02, 0.22, 0.04, 0.2, W('#2f2a26', 0.08), false);
    box(cx - 0.2, top + 0.03, cz + 0.04, 0.34, 0.05, 0.26, W('#e9e3d4', 0.3)); box(cx - 0.2, top + 0.085, cz + 0.04, 0.26, 0.02, 0.2, W('#9aa4a8', 0.4), false); box(cx - 0.2, top + 0.14, cz - 0.1, 0.12, 0.09, 0.02, W('#1f2a24', 0.2));
    for (let i = 0; i < 3; i++) cyl(x0 + 0.12 + i * 0.1, top + 0.08, z0 - 0.05, 0.04, 0.12, W(['#e05a3a', '#d8c23c', '#6aa04c'][i], 0.4));
    mesh(new THREE.SphereGeometry(0.06, 8, 6), W('#f1ece0', 0.4), x1 - 0.12, top + 0.1, z0 - 0.06); mesh(new THREE.SphereGeometry(0.045, 8, 6), W('#f1ece0', 0.4), x1 - 0.12, top + 0.19, z0 - 0.06);
    box(cx, F + 0.2, z0 + 0.012, x1 - x0 - 0.06, 0.2, 0.012, '#4a3a30', false);
    box(x0 - 0.1, F + 0.25, cz, 0.22, 0.5, 0.3, W('#e9d9a8', 0.3));   // bag stock bin
  }
  // Pendant strip lights (cool-white tubes) over the aisles.
  tube(-1.65, -1.0, 1.4, 'x'); tube(1.4, -1.0, 1.4, 'x'); tube(-0.68, -2.8, 2.0, 'z'); tube(0.2, -3.7, 1.8, 'x'); tube(-1.7, -4.7, 1.8, 'x'); tube(-1.7, -2.4, 1.6, 'z');
  // Glow pools on the floor and the cooler spill.
  for (const [x, z, r] of [[-1.65, -0.6, 1.5], [1.65, -0.5, 1.5], [0.1, -1.9, 1.9], [-1.4, -3.3, 1.8], [1.2, -3.8, 1.6], [-1.6, -4.7, 1.6], [1.9, -1.4, 1.4]]) decal(r, r, x, F + 0.003, z, [0, -1], pool);
  decal(2.0, 1.2, -1.65, F + 0.004, IZ1 + 1.3, [0, -1], additive(glowT, '#cfeff0', 0.2));

  // ================= forecourt and attachments =================
  // Produce stand: timber frame with three sloping crate tiers (high at the back), fruit and vegetables in rows.
  const stand = (x0, x1, kind) => {
    const L = x1 - x0, cx = (x0 + x1) / 2, z0 = 0.06, z1 = 0.74;
    for (const x of [x0 + 0.04, x1 - 0.04]) for (const z of [z0 + 0.05, z1 - 0.05]) box(x, 0.44, z, 0.06, 0.5, 0.06, timber);
    const lv = [[z1 - 0.14, 0.28, 0.32], [z0 + 0.4, 0.28, 0.5], [z0 + 0.14, 0.26, 0.68]];   // [z, depth, top y]
    lv.forEach(([z, d, y], i) => { box(cx, y - 0.03, z, L - 0.04, 0.05, d, '#b0814f'); box(cx, y + 0.02, z + d / 2 - 0.01, L - 0.04, 0.12, 0.02, '#c19560'); box(cx, 0.19 + (y - 0.24) / 2, z + d / 2 - 0.02, L - 0.1, y - 0.24, 0.02, timber);
      const items = kind === 0 ? 7 : 6; for (let k = 0; k < items; k++) { const u = x0 + 0.14 + (k + 0.5) * (L - 0.28) / items, c = kind === 0 ? PROD[(k + i * 2) % PROD.length] : ['#6aa04c', '#e0b030', '#c9372c', '#8a6aa8', '#e8e0b0', '#e08a2c'][(k + i) % 6];
        for (let m = 0; m < 2; m++) fruit(u + (m - 0.5) * 0.06, y + 0.06, z + (m - 0.5) * 0.08 + 0.03 * (k % 2), 0.065 + 0.012 * ((k + m) % 3), c); } });
    for (let i = 0; i < 4; i++) box(x0 + 0.2 + i * (L - 0.4) / 3, 0.19 + 0.78 + 0.24, z0 + 0.04, 0.012, 0.3, 0.012, '#3a3330', false);
    K.label(kind === 0 ? '本日の果物 ¥198' : 'やさい 朝どれ ¥98', cx, 0.19 + 0.52, z1 + 0.0, L - 0.2, 0.1, '#2f2a26', '#f3ead0', 54);
  };
  group('groceryFrontW');
  stand(-2.8, -1.1, 0);
  pot(-3.15, 0.19, 0.4, 0.17, 7, 1.8, '#7d6a5a');
  { const g = new THREE.Group(); g.position.set(-3.0, 0.25, 0.85); g.rotation.y = -0.2; K.setRoot(g);
    const board = canvasTex(256, 320, (q, w, h) => { q.fillStyle = '#2f3a36'; q.fillRect(0, 0, w, h); q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillStyle = '#f0c987'; q.font = 'bold 40px serif'; q.fillText('本日の特売', w / 2, 52); q.fillStyle = '#efe9da'; q.font = 'bold 34px sans-serif'; q.fillText('トマト 3個 ¥198', w / 2, 128); q.fillText('たまご 1パック ¥228', w / 2, 188); q.fillStyle = '#c7d0a0'; q.fillText('お米 5kg ¥2,480', w / 2, 248); });
    for (const s of [-1, 1]) { const p = new THREE.Group(); p.rotation.x = -s * 0.2; g.add(p);
      box(0, 0.47, s * 0.2, 0.46, 0.9, 0.025, '#7d5c45', true, p); mesh(new THREE.PlaneGeometry(0.38, 0.62), new THREE.MeshBasicMaterial({ map: board, color: '#c9c3b6' }), 0, 0.54, s * 0.2 + s * 0.015, false, p).rotation.y = s > 0 ? 0 : PI; }
    group('groceryFrontW').add(g); }
  group('groceryFrontE');
  stand(1.1, 2.65, 1);
  // Blue delivery crates (stack of three) and a basket beside the east stand, a hanging-sign A-board.
  for (let i = 0; i < 3; i++) { box(2.95, 0.19 + 0.13 + i * 0.26, 0.58, 0.46, 0.25, 0.34, i % 2 ? '#3f6f9a' : '#4f7fb0'); box(2.95, 0.19 + 0.13 + i * 0.26, 0.58 + 0.172, 0.34, 0.05, 0.01, '#2a4a6a', false); }
  box(2.72, 0.19 + 0.12, 0.2, 0.34, 0.22, 0.3, '#c3463a');
  pot(3.2, 0.19, 0.12, 0.13, 5, 1.4, '#7d6a5a');
  group('grocerySideW');
  // Outdoor AC unit on a stand and two gas cylinders at the west wall (reference LEFT view).
  box(-3.05, 0.19 + 0.05, -2.3, 0.4, 0.1, 0.84, '#7f8b93');
  box(-3.05, 0.19 + 0.42, -2.3, 0.36, 0.64, 0.8, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), -3.233, 0.64, -2.2, false).rotation.y = -PI / 2;
  for (let i = 0; i < 4; i++) box(-3.235, 0.55 + i * 0.08, -2.2, 0.01, 0.012, 0.38, '#9aa6ab', false);
  for (const z of [-4.3, -4.72]) { cyl(-3.0, 0.19 + 0.45, z, 0.17, 0.9, '#aeb5b8'); mesh(new THREE.SphereGeometry(0.17, 12, 6, 0, PI * 2, 0, PI / 2), mat('#aeb5b8'), -3.0, 0.19 + 0.9, z); cyl(-3.0, 0.19 + 1.0, z, 0.045, 0.1, '#59656d'); }
  line([[-3.0, 1.2, -4.3], [-2.9, 1.3, -4.3], [-2.85, 0.5, -4.3]], '#3d4a58', 0.014);
  pot(-3.2, 0.19, -1.2, 0.14, 5, 1.2); pot(-3.25, 0.19, -0.7, 0.1, 4, 1, '#8f9aa0');
  group('grocerySideE');
  // Red delivery hand cart with crates, blue crates and pots along the east wall.
  {
    const cx = 3.2, cz = -2.0;
    box(cx, 0.19 + 0.9, cz - 0.0, 0.04, 1.6, 0.62, '#b23a32'); for (const y of [0.45, 0.85, 1.25, 1.65]) box(cx, 0.19 + y, cz, 0.04, 0.03, 0.62, '#b23a32', false);
    box(cx - 0.2, 0.19 + 0.2, cz, 0.5, 0.04, 0.6, '#b23a32'); for (const z of [-0.3, 0.3]) cyl(cx - 0.05, 0.19 + 0.1, cz + z, 0.1, 0.05, '#2f3338').rotation.x = PI / 2;
    for (let i = 0; i < 2; i++) box(cx - 0.2, 0.19 + 0.36 + i * 0.22, cz, 0.38, 0.2, 0.5, i ? '#4f7fb0' : '#e0b030');
  }
  for (let i = 0; i < 3; i++) box(3.0, 0.19 + 0.12 + i * 0.24, -3.4, 0.36, 0.22, 0.46, i % 2 ? '#3f6f9a' : '#4f7fb0');
  box(3.0, 0.19 + 0.12, -3.95, 0.36, 0.22, 0.46, '#4f8d3f'); box(3.0, 0.19 + 0.36, -3.95, 0.36, 0.22, 0.46, '#e0b030');
  pot(3.05, 0.19, -0.6, 0.13, 5, 1.3, '#9b7d68'); pot(3.15, 0.19, -1.05, 0.1, 4, 1, '#8f9aa0');
  group('groceryRear');
  // Back-door step with a scraper mat, a sink with tap on a stand, a steel locker and crates by the door.
  box(1.9, 0.19 + 0.015, Z1 - 0.3, 0.6, 0.03, 0.34, '#5d5248', false);
  box(0.3, 0.19 + 0.33, Z1 - 0.28, 0.62, 0.05, 0.4, '#9aa4a8'); for (const dx of [-0.27, 0.27]) for (const dz of [-0.15, 0.15]) box(0.3 + dx, 0.19 + 0.15, Z1 - 0.28 + dz, 0.04, 0.3, 0.04, '#7f8b93', false);
  box(0.3, 0.19 + 0.38, Z1 - 0.28, 0.5, 0.06, 0.32, '#b8c0c2'); rod([0.3, 0.19 + 0.4, Z1 - 0.12], [0.3, 0.19 + 0.68, Z1 - 0.12], 0.014, '#aab3b5'); rod([0.3, 0.19 + 0.68, Z1 - 0.12], [0.3, 0.19 + 0.66, Z1 - 0.28], 0.014, '#aab3b5');
  box(-0.7, 0.19 + 0.85, Z1 - 0.28, 0.5, 1.7, 0.42, '#a0a8aa'); box(-0.7, 0.19 + 0.85, Z1 - 0.49, 0.46, 1.6, 0.01, '#8a9496', false); box(-0.62, 0.19 + 1.0, Z1 - 0.5, 0.02, 0.2, 0.02, '#59656d');
  for (let i = 0; i < 3; i++) box(-1.35, 0.19 + 0.14 + i * 0.27, Z1 - 0.28, 0.44, 0.25, 0.32, ['#c3463a', '#e0b030', '#4f7fb0'][i]);
  box(1.0, 0.19 + 0.14, Z1 - 0.28, 0.4, 0.25, 0.32, '#4f8d3f');
  group('groceryGround');
  const paveMat = warm('#ffffff', 0, pavers);
  const pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-3.5, 3.5, 0, 1.15); pave(-3.5, -2.8, -5.9, 0); pave(2.8, 3.5, -5.9, 0); pave(-2.8, 2.8, -6.1, -5.6);
  box(0, 0.214, 0.6, 1.4, 0.014, 0.6, '#3f6f58', false); box(0, 0.222, 0.6, 1.22, 0.004, 0.46, '#5b8a72', false);
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(1.9, 1.0, (FW[0] + FW[1]) / 2, 0.208, 1.0, [0, -1], spill); decal(1.5, 1.0, 0, 0.226, 0.95, [0, -1], spill); decal(1.9, 1.0, (FE[0] + FE[1]) / 2, 0.208, 1.0, [0, -1], spill);
  decal(1.4, 0.8, X0 - 0.45, 0.2, (WL[0] + WL[1]) / 2, [1, 0], additive(spillT, '#ffbf7a', 0.14)); decal(1.4, 0.8, X1 + 0.45, 0.2, (ER[0] + ER[1]) / 2, [-1, 0], additive(spillT, '#ffbf7a', 0.14));
  decal(1.2, 0.4, (BD[0] + BD[1]) / 2, 0.208, Z1 - 0.3, [0, 1], additive(glowT, '#ffc27e', 0.2));

  // ================= local animation: cooler glow breathing, swaying price tags, window rain and awning drips =================
  const fx = new THREE.Group(); fx.userData.live = true; group('grocery').add(fx); K.setRoot(fx);
  // Cold-white cooler light spilling on the floor and the neighbouring shelves; breathes slowly.
  const coolM = additive(glowT, '#cfeff0', 0.16); mesh(new THREE.PlaneGeometry(2.4, 2.4), coolM, -1.65, F + 1.1, IZ1 + 1.1, false, fx);
  // Paper price tags hanging from the awning edge on short cords; each pivots at the valance.
  const tagT = canvasTex(64, 96, (q, w, h) => { q.fillStyle = '#f3ead0'; q.fillRect(0, 0, w, h); q.fillStyle = '#b9382d'; q.fillRect(0, 0, w, 18); q.font = 'bold 40px serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillStyle = '#2f2a26'; q.fillText('特', w / 2, 52); q.font = 'bold 20px sans-serif'; q.fillText('¥98', w / 2, 82); });
  const tags = [];
  [-2.35, -1.85, -1.4, 1.4, 1.85, 2.35].forEach((x, i) => { const piv = new THREE.Group(); piv.position.set(x, 2.14, 0.76); fx.add(piv);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.22), new THREE.MeshBasicMaterial({ map: tagT, side: THREE.DoubleSide, color: '#e8dcc0' })); p.position.y = -0.14; piv.add(p); tags.push(piv);
    mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 4), mat('#3a3330'), x, 2.16, 0.76, false, fx); });
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6);
  for (const [w, n] of [[FE, 6], [FW, 6]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 0.8, 0.52, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 14; i++) drips.add(-2.8 + i * 0.43 + rnd() * 0.12, 0.25 + rnd() * 1.9, 0.83, 0.09, 0.25, 2.2, 2.1 + rnd() * 0.5);
  runs.seal(); drips.seal();
  // Reflection of the lit shopfront in the wet paving (static geometry in the ground group; only the material moves).
  const refT = tex(256, 64, (q, w, h) => { q.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = rnd() * w, ww = 2 + rnd() * 8, g = q.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(255,220,160,${0.4 + rnd() * 0.5})`); g.addColorStop(1, 'rgba(255,220,160,0)'); q.fillStyle = g; q.fillRect(x, 0, ww, h * (0.5 + rnd() * 0.5)); } });
  const refM = new THREE.MeshBasicMaterial({ map: refT, color: '#ffd8a0', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 });
  group('groceryGround'); decal(4.8, 1.0, 0, 0.209, 1.35, [0, -1], refM); group('grocery');
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt);
      tags.forEach((p, i) => { p.rotation.z = 0.09 * Math.sin(t * 1.3 + i * 1.1) + 0.03 * Math.sin(t * 3.1 + i); p.rotation.x = 0.04 * Math.sin(t * 0.9 + i * 0.7); });
      coolM.opacity = 0.14 + 0.05 * Math.sin(t * 0.7) * Math.sin(t * 0.29 + 1);
      refT.offset.x = 0.012 * Math.sin(t * 0.6); refM.opacity = 0.15 + 0.05 * Math.sin(t * 0.9) * Math.sin(t * 0.37);
    },
  };
};
