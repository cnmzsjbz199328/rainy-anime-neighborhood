// B03-P06 あじさい会館 (Ajisai Kaikan): a two-storey neighbourhood community hall north of the main street.
// Task card docs/buildings/tasks/B03-P06.md, reference docs/buildings/references/B03-P06.jpg.
// Local frame (placed by layout.js `buildings`, rotY π): front +z faces the north street (world N), local +x = world W,
// local -x = world E (towards the corner road R03); door centre at the origin, ground floor top at rec.floor.
// Cream plaster, timber louvre panels, a slate-grey hip roof, a short pent canopy with a name board over the door.
// Body 5.4 × 4.6: x -3.5…1.9, z -4.6…0 (roof edges to x -3.85 / 2.25 and z +0.35 / -4.95; canopy to +0.85;
// inside the 9 × 6 buildable envelope). Parking bay for one small car on the west side (x 2.45…4.95).
// Groups: hall (shell, frame, roof, canopy, sign, gutters, both storeys, stairs) · hallRamp (access ramp and rails) ·
// hallNotice (notice board, flower bed) · hallBike (bicycle rack) · hallBed (hydrangea bed, east side) · hallParking
// (car, kerb stops, fence) · hallRear (AC units, meter box, back-door step) · hallGround.
// Storeys: ground floor (layer none) and upper storey (userData.layer 'f2': slab, walls, furniture) so a cutaway
// can lift it off; roof and ceilings sit in layer 'roof'.
// Plan, ground: hall with two round tables behind the front window, reception desk, document shelves on the east wall,
// tea kitchenette on the back wall, storeroom in the back-east corner, a straight stair along the west wall rising to
// the front. Plan, upper: meeting room with a long table, whiteboard, cabinet, curtains; stair head at the front west.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B03-P06'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(3306), PI = Math.PI;
  const F = rec.floor, F2 = F + 2.8, X0 = -3.5, X1 = 1.9, Z0 = 0, Z1 = -4.6, T = 0.15, BASE = 0.19, SLAB = 0.2, EF = 5.9, CEIL1 = F2 - SLAB, CEIL2 = 5.6;
  const SL = 0.5, OV = 0.35;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T;
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FW = [-3.2, -0.95, 0.8, 2.3], FD = [-0.55, 0.55, F, 2.3], FE = [1.05, 1.65, 1.1, 2.2];
  const F2W = [-1.9, 0.8, 3.9, 5.2], F2L = [-3.2, -2.3, 3.9, 5.2], F2R = [1.1, 1.65, 3.9, 5.2];
  const EW = [-3.3, -1.7, 1.0, 2.2], EW2 = [-4.2, -3.6, 1.5, 2.2], E2 = [-3.7, -1.0, 3.9, 5.2];
  const WW = [-2.3, -1.5, 1.4, 2.2], W2 = [-3.6, -2.4, 3.9, 5.1], W2b = [-1.5, -0.7, 3.9, 5.1];
  const BD = [-0.2, 0.6, F, 2.2], RW = [-3.1, -2.4, 1.5, 2.3], RW2 = [1.0, 1.6, 1.4, 2.2], R2W = [-2.6, 0.2, 3.9, 5.2], R2S = [1.0, 1.6, 4.0, 5.1];

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#e6dcc4'), timber = '#5a4030', timberL = '#b98d5e', slat = '#c49a68', stoneC = '#9a958b', alu = '#4d5a60', trim = '#5b6168';
  const wcache = {}, W = (c, k = 0.3) => wcache[c + k] || (wcache[c + k] = warm(c, k));
  const wood = W('#b0814f'), woodD = W('#6f4a35', 0.26), cream = W('#f1e4c8', 0.34), steel = W('#c3cacb', 0.22), white = W('#f1ece0', 0.34);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' });
  // Slate roof: horizontal courses along the eave, joints staggered.
  const slateT = tex(128, 128, (q, w, h) => { q.fillStyle = '#4b535b'; q.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) { const g = q.createLinearGradient(0, r * 16, 0, r * 16 + 16); g.addColorStop(0, '#3c444c'); g.addColorStop(0.6, '#59626b'); g.addColorStop(1, '#394047'); q.fillStyle = g; q.fillRect(0, r * 16, w, 16);
      q.fillStyle = 'rgba(15,20,26,.6)'; q.fillRect(0, r * 16, w, 2); for (let c = 0; c < 4; c++) q.fillRect(c * 32 + (r % 2) * 16, r * 16, 1.5, 16); }
    for (let i = 0; i < 500; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '8,12,18' : '190,205,220'},${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 2, 1); } });
  slateT.repeat.set(2, 2);
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: slateT });
  const planks = tex(256, 256, (q, w, h) => { for (let r = 0; r < 8; r++) { q.fillStyle = `hsl(${30 + rnd() * 6},${34 + rnd() * 10}%,${52 + rnd() * 8}%)`; q.fillRect(0, r * 32, w, 32);
    q.fillStyle = 'rgba(70,44,28,.5)'; q.fillRect(0, r * 32, w, 1.5); q.fillRect(rnd() * 200 + 28, r * 32, 1.5, 32); } });
  const pavers = tex(256, 256, (q, w, h) => { q.fillStyle = '#a2a095'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      q.fillStyle = `rgba(${rnd() < 0.5 ? '70,78,92' : '250,246,236'},${0.05 + rnd() * 0.08})`; q.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    q.strokeStyle = 'rgba(48,56,66,.45)'; q.lineWidth = 2; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); }
    for (let i = 0; i < 900; i++) { q.fillStyle = `rgba(40,48,60,${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1); } });
  const asphalt = tex(128, 128, (q, w, h) => { q.fillStyle = '#6b6f76'; q.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '30,34,40' : '190,196,204'},${0.05 + rnd() * 0.08})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } });
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
  const chalk = (w, h, lines, bg = '#2f3a36') => canvasTex(w, h, (q, W2, H2) => { q.fillStyle = bg; q.fillRect(0, 0, W2, H2); q.textAlign = 'center'; q.textBaseline = 'middle';
    for (const [t, y, size, font = 'sans-serif', col] of lines) { q.fillStyle = col || '#efe9da'; q.font = `bold ${size}px ${font}`; q.fillText(t, W2 / 2, y); } });

  // ---- plants ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), LEAF = ['#6c9476', '#88a98a', '#5e8a6a'], HYD = ['#7b8fc8', '#a98bc8', '#d891b8', '#8fb3d8'];
  const shrub = (x, y, z, r, n, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(LEAF[i % 3]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.35 + rnd() * r * h, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.45 + rnd() * 0.25)); } };
  const pot = (x, y, z, r, n = 5, h = 1, c = '#9b7d68') => { mesh(new THREE.CylinderGeometry(r, r * 0.76, r * 1.15, 10), mat(c), x, y + r * 0.575, z); shrub(x, y + r * 1.1, z, r, n, h); };
  const hydrangea = (x, y, z, r) => { shrub(x, y, z, r, 4, 0.8); for (let i = 0; i < 5; i++) { const a = mesh(leafG, mat(HYD[Math.floor(rnd() * 4)]), x + (rnd() - 0.5) * r * 1.4, y + r * (0.8 + rnd() * 0.5), z + (rnd() - 0.5) * r * 1.4, false); a.scale.setScalar(r * (0.32 + rnd() * 0.12)); } };

  // ================= ground-floor shell =================
  group('hall');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, F2], [FW, FD, FE], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, F2], [BD, RW, RW2], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, F2], [WW], plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, F2], [EW, EW2], plaster);
  // Plinth, corner posts, floor-line band.
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FD[0], Z0, 1); plinth('x', FD[1], X1, Z0, 1); plinth('x', X0, BD[0], Z1, -1); plinth('x', BD[1], X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  box(0, F2 - 0.1, 0.012, X1 - X0 + 0.06, 0.2, 0.04, '#8a7a62'); box(0, F2 - 0.1, Z1 - 0.012, X1 - X0 + 0.06, 0.2, 0.04, '#8a7a62');
  for (const [x, o] of [[X0, -1], [X1, 1]]) box(x + o * 0.012, F2 - 0.1, (Z0 + Z1) / 2, 0.04, 0.2, Z0 - Z1 + 0.06, '#8a7a62');
  for (const [x, z] of [[X0 + 0.05, Z0 - 0.05], [X1 - 0.05, Z0 - 0.05], [X0 + 0.05, Z1 + 0.05], [X1 - 0.05, Z1 + 0.05]]) box(x, (BASE + EF) / 2, z, 0.12, EF - BASE, 0.12, '#8a7a62');
  // Floors and ceilings (ground ceiling = underside of the first-floor slab; part of the f2 layer below).
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - IZ1), (IX1 - IX0) / 2, (IZ0 - IZ1) / 2), warm('#ffffff', 0.2, planks), 0, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL1], [FW, FD, FE], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL1], [WW], cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL1], [EW, EW2], cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL1], [BD, RW, RW2], cream);
  box(0, F + 0.45, IZ1 + 0.01, IX1 - IX0, 0.9, 0.012, W('#d9d2bd', 0.3), false);   // low wainscot

  // ---- glazing: dark aluminium-brown frames ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = [], lattice = 0) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, alu); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, alu);
    ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, alu); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, alu);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.045, q - p, fd * 0.9, alu);
    for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.04, fd * 0.9, alu);
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    if (lattice) { const d = at + out * 0.1, n = Math.round((b - a) / lattice); for (let i = 0; i <= n; i++) ab(axis, a + 0.02 + i * (b - a - 0.04) / n, (p + q) / 2, d, 0.04, q - p + 0.1, 0.05, slat);
      for (const y of [p - 0.04, q + 0.04]) ab(axis, (a + b) / 2, y, d, b - a + 0.06, 0.06, 0.06, timberL); }
    if (p > F + 0.05) ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.1, 0.05, 0.15, '#a8a091');
  }
  glaze('x', -T / 2, 1, FW, [-2.1, -1.5], [1.65]); glaze('x', -T / 2, 1, FE, [], [], 0.1);
  glaze('z', X0 + T / 2, -1, EW, [-2.5], []); glaze('z', X0 + T / 2, -1, EW2); glaze('z', X1 - T / 2, 1, WW, [-1.9]);
  glaze('x', Z1 + T / 2, -1, RW); glaze('x', Z1 + T / 2, -1, RW2, [], [], 0.1);
  // Front door: wooden-framed glass double door (accessible: wide leaf), push bars, sidelights above.
  ab('x', FD[0] + 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, timber); ab('x', FD[1] - 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, timber);
  box(0, FD[3] - 0.04, -T / 2, FD[1] - FD[0], 0.08, 0.16, timber);
  {
    const z = -0.05, top = FD[3] - 0.08, l = -0.5, r = 0.5;
    for (const x of [l + 0.04, -0.02, 0.02, r - 0.04]) box(x, (F + top) / 2, z, 0.06, top - F, 0.045, timber);
    box(0, top - 0.04, z, r - l, 0.08, 0.045, timber); box(0, F + 0.4, z, r - l, 0.1, 0.045, timber);
    box(0, (F + 0.45 + top - 0.08) / 2, z, r - l - 0.1, top - 0.08 - F - 0.45, 0.012, glass, false);
    for (const x of [-0.14, 0.14]) box(x, 1.15, z + 0.03, 0.03, 0.7, 0.03, '#c9c9c0');
    box(-0.25, 1.3, z + 0.012, 0.1, 0.1, 0.006, '#d8b23a', false);   // door sticker
  }
  // Louvre panel right of the door (timber slats over the wall) and the slit window.
  for (let i = 0; i <= 8; i++) box(1.0 + i * 0.1, (0.3 + 2.4) / 2, 0.05, 0.05, 2.1, 0.06, slat);
  box(1.45, 2.38, 0.05, 0.9, 0.06, 0.08, timberL); box(1.45, 0.32, 0.05, 0.9, 0.06, 0.08, timberL);
  // Back door: brown steel door with a small pent canopy, step and lamp.
  ab('x', BD[0] + 0.04, (F + BD[3]) / 2, Z1 + T / 2, 0.08, BD[3] - F, 0.16, timber); ab('x', BD[1] - 0.04, (F + BD[3]) / 2, Z1 + T / 2, 0.08, BD[3] - F, 0.16, timber);
  box((BD[0] + BD[1]) / 2, BD[3] - 0.04, Z1 + T / 2, BD[1] - BD[0], 0.08, 0.16, timber);
  box((BD[0] + BD[1]) / 2, (F + BD[3] - 0.08) / 2, Z1 + 0.06, BD[1] - BD[0] - 0.14, BD[3] - 0.08 - F, 0.04, '#5b4a3e');
  box((BD[0] + BD[1]) / 2, 1.8, Z1 + 0.035, 0.34, 0.5, 0.012, '#8a98a0', false); box(BD[0] + 0.14, 1.1, Z1 + 0.02, 0.03, 0.16, 0.04, '#c9c9c0');
  shapeMesh([[0, BASE], [0.3, BASE], [0.3, 0.3], [0, 0.3]], BD[1] - BD[0] + 0.1, '#a8a091', BD[0] - 0.05, 0, Z1, PI / 2);
  { const e = box((BD[0] + BD[1]) / 2, 2.52, Z1 - 0.22, 1.1, 0.05, 0.46, trim); e.rotation.x = -0.26; }
  for (const x of [BD[0] - 0.06, BD[1] + 0.06]) box(x, 2.4, Z1 - 0.13, 0.05, 0.05, 0.28, '#5a4030');
  box(BD[1] + 0.3, 1.95, Z1 - 0.06, 0.12, 0.17, 0.1, '#3d4a58'); box(BD[1] + 0.3, 1.94, Z1 - 0.06, 0.09, 0.12, 0.105, bulb, false);
  mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.26), BD[1] + 0.3, 1.95, Z1 - 0.004, false).rotation.y = PI;
  // Entrance platform and one low step (accessible entrance; ramp is a separate group).
  box(0, 0.255, 0.38, 1.7, 0.1, 0.76, '#a8a091'); box(0, 0.21, 0.74, 1.7, 0.04, 0.2, '#8e8a80');
  for (let i = 0; i < 4; i++) box(-0.6 + i * 0.4, 0.31, 0.74, 0.28, 0.006, 0.12, '#d6b13c', false);   // tactile warning blocks

  // ---- entrance canopy, name board, lamps ----
  {
    const x0 = -1.3, x1 = 1.3, dep = 0.85, hi = 2.86, lo = 2.64, len = Math.hypot(dep, hi - lo);
    const e = box(0, (hi + lo) / 2 + 0.03, dep / 2, x1 - x0, 0.06, len, roofM); e.rotation.x = Math.atan2(hi - lo, dep);
    box(0, lo - 0.01, dep - 0.01, x1 - x0, 0.1, 0.05, '#2f3944');
    for (const x of [x0 + 0.12, x1 - 0.12]) { rod([x, 2.0, 0.05], [x, hi - 0.04, dep * 0.85], 0.02, '#4d5a60'); box(x, hi - 0.03, dep * 0.4, 0.06, 0.06, dep * 0.8, timber); }
    const s = canvasTex(512, 96, (q, w, h) => { q.fillStyle = '#5a4030'; q.fillRect(0, 0, w, h); q.strokeStyle = '#a98560'; q.lineWidth = 4; q.strokeRect(6, 6, w - 12, h - 12);
      q.fillStyle = '#f0e2c0'; q.font = 'bold 56px serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('社区会所', w / 2 + 40, h / 2 + 4); q.font = 'bold 28px serif'; q.textAlign = 'left'; q.fillText('あじさい', 24, h / 2 - 4); });
    mesh(new THREE.PlaneGeometry(1.9, 0.36), new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, emissive: '#3a2c20', emissiveMap: s }), 0, 2.45, dep + 0.002, false);
    box(0, 2.45, dep - 0.01, 1.96, 0.42, 0.02, timber);
  }
  for (const x of [-0.85, 0.85]) { box(x, 2.1, 0.07, 0.12, 0.18, 0.1, '#3d4a58'); box(x, 2.09, 0.07, 0.09, 0.13, 0.105, bulb, false); mesh(new THREE.PlaneGeometry(0.8, 0.8), additive(glowT, '#ffc27e', 0.26), x, 2.1, 0.05, false); }

  // ================= upper storey (layer f2) =================
  const f2Layer = new THREE.Group(); f2Layer.userData.layer = 'f2'; group('hall').add(f2Layer); K.setRoot(f2Layer);
  // First-floor slab with the stair opening (x 0.95…1.75, z -4.35…-1.15), ceiling boards below.
  {
    const hx = 0.95, hz0 = -4.35, hz1 = -1.15, t = SLAB, y = F2 - t / 2;
    box((IX0 + hx) / 2, y, (IZ0 + IZ1) / 2, hx - IX0, t, IZ0 - IZ1, '#cdbfa0'); box((hx + IX1) / 2, y, (hz1 + IZ0) / 2, IX1 - hx, t, IZ0 - hz1, '#cdbfa0'); box((hx + IX1) / 2, y, (IZ1 + hz0) / 2, IX1 - hx, t, hz0 - IZ1, '#cdbfa0');
    mesh(tileUV(new THREE.BoxGeometry(hx - IX0, 0.012, IZ0 - IZ1), (hx - IX0) / 2, (IZ0 - IZ1) / 2), warm('#ffffff', 0.22, planks), (IX0 + hx) / 2, F2 + 0.006, (IZ0 + IZ1) / 2, false);
    mesh(tileUV(new THREE.BoxGeometry(IX1 - hx, 0.012, IZ0 - hz1), (IX1 - hx) / 2, (IZ0 - hz1) / 2), warm('#ffffff', 0.22, planks), (hx + IX1) / 2, F2 + 0.006, (hz1 + IZ0) / 2, false);
    box((IX0 + IX1) / 2, CEIL1 - 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#e6dcc4', 0.32), false);
    for (let i = 1; i < 4; i++) box((IX0 + IX1) / 2, CEIL1 - 0.04, IZ0 - i * (IZ0 - IZ1) / 4, IX1 - IX0, 0.05, 0.08, woodD, false);
  }
  wall('x', Z0 - T / 2, T, [X0, X1, F2, EF], [F2W, F2L, F2R], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, F2, EF], [R2W, R2S], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, F2, EF], [W2, W2b], plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, F2, EF], [E2], plaster);
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F2, CEIL2], [F2W, F2L, F2R], cream); panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F2, CEIL2], [R2W, R2S], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F2, CEIL2], [W2, W2b], cream); panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F2, CEIL2], [E2], cream);
  glaze('x', -T / 2, 1, F2W, [-1.1, -0.3], [4.8]); glaze('x', -T / 2, 1, F2L, [], [], 0.1); glaze('x', -T / 2, 1, F2R, [], [], 0.1);
  glaze('x', Z1 + T / 2, -1, R2W, [-1.9, -1.1, -0.4], [4.8]); glaze('x', Z1 + T / 2, -1, R2S);
  glaze('z', X0 + T / 2, -1, E2, [-2.3, -1.65], [], 0.1); glaze('z', X1 - T / 2, 1, W2, [], [4.6]); glaze('z', X1 - T / 2, 1, W2b);
  // Louvre boards left of the front window and on the east wall, warm light behind them.
  for (let i = 0; i <= 6; i++) { box(-3.28 + i * 0.12, 4.55, 0.04, 0.06, 1.55, 0.05, slat, true, f2Layer); }
  // Upper-floor details: sill band, small eaves lamp.
  box(0, 3.62, 0.03, X1 - X0 + 0.02, 0.05, 0.08, '#a8a091');

  // ---- interior, ground floor (children of the base group, not of f2) ----
  group('hall');
  const pendant = (x, z, y, c = '#d9c7a0', top = CEIL1) => { rod([x, top, z], [x, y + 0.08, z], 0.006, '#3a3330'); mesh(new THREE.ConeGeometry(0.13, 0.15, 14, 1, true), W(c, 0.3), x, y + 0.07, z, true); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false); };
  const chair = (x, z, face, base = F) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + dx * 0.17, base + 0.22, z + dz * 0.17, 0.035, 0.44, 0.035, woodD, false);
    box(x, base + 0.45, z, 0.4, 0.04, 0.4, W('#6b8a9a', 0.3)); const bx = x - face[0] * 0.19, bz = z - face[1] * 0.19; box(bx, base + 0.68, bz, face[0] ? 0.03 : 0.38, 0.4, face[0] ? 0.38 : 0.03, woodD); box(bx, base + 0.88, bz, face[0] ? 0.04 : 0.42, 0.04, face[0] ? 0.42 : 0.04, wood); };
  // Near layer: two round tables with chairs behind the big front window; flyers on one.
  for (const [tx, tz] of [[-2.55, -0.75], [-1.45, -1.05]]) {
    cyl(tx, F + 0.37, tz, 0.04, 0.74, woodD); cyl(tx, F + 0.02, tz, 0.2, 0.04, woodD); cyl(tx, F + 0.75, tz, 0.4, 0.04, wood); cyl(tx, F + 0.775, tz, 0.37, 0.006, W('#d8c8a8', 0.32));
    cyl(tx + 0.1, F + 0.82, tz - 0.08, 0.05, 0.1, W('#7da0b0', 0.3)); for (const a of [0.4, 2.0]) cyl(tx + Math.cos(a) * 0.2, F + 0.8, tz + Math.sin(a) * 0.2, 0.04, 0.05, W('#f4efe2', 0.34));
    chair(tx - 0.5, tz + 0.05, [1, 0]); chair(tx + 0.1, tz - 0.5, [0, 1]);
  }
  pendant(-2.55, -0.75, F + 1.95); pendant(-1.45, -1.05, F + 1.95);
  // East wall: document shelves (資料架) and a bulletin board with flyers; reception desk mid-room.
  {
    const x = IX0 + 0.18, z0 = -1.9, z1 = -3.2, zc = (z0 + z1) / 2, L = z0 - z1;
    box(x, F + 0.95, zc, 0.34, 1.9, L, woodD, false); for (let k = 0; k < 5; k++) { const y = F + 0.2 + k * 0.38; box(x, y, zc, 0.34, 0.03, L, wood);
      for (let i = 0; i < 11; i++) box(x - 0.03, y + 0.15, z1 + 0.08 + i * (L - 0.16) / 10, 0.2, 0.26, 0.07, W(['#8a5a3a', '#5a7a9a', '#c9a86a', '#6a8a6a', '#a8604a'][(i + k) % 5], 0.34), false); }
    const cx = -2.6, cz = -2.55; // reception desk with the window onto the hall
    box(-1.6, F + 0.5, -2.55, 1.5, 1.0, 0.55, woodD); box(-1.6, F + 1.02, -2.55, 1.56, 0.05, 0.62, wood);
    box(-1.6, F + 1.3, -2.8, 0.5, 0.3, 0.06, W('#e9e3d4', 0.3)); box(-1.35, F + 1.09, -2.45, 0.28, 0.12, 0.22, W('#2f2a26', 0.1)); box(-1.9, F + 1.08, -2.5, 0.2, 0.08, 0.28, W('#f3ead0', 0.4), false);
    cyl(-0.95, F + 1.07, -2.5, 0.05, 0.1, W('#b9382d', 0.3)); K.label('受付', -1.6, F + 0.55, -2.236, 0.5, 0.14, '#efe3c6', '#5a4030', 70);
    const bd = chalk(256, 192, [['お知らせ', 34, 26, 'serif', '#f0c987'], ['夏祭り 準備会', 84, 22], ['7/20 19:00', 120, 20, 'sans-serif', '#c7d0a0'], ['お茶のみ会 毎週水', 160, 20]], '#4a5a50');
    mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshToonMaterial({ map: bd, gradientMap: K.ramp, emissive: '#1f2a24', emissiveMap: bd }), IX0 + 0.012, F + 1.5, -1.05, false).rotation.y = PI / 2;
  }
  // Back layer: kitchenette across the back wall, storeroom in the back-east corner behind a partition, stair on the west wall.
  {
    const kz = IZ1 + 0.3, kx0 = -1.55, kx1 = 0.35, kc = (kx0 + kx1) / 2;
    box(kc, F + 0.45, kz, kx1 - kx0, 0.9, 0.6, W('#cfc6b0', 0.3)); box(kc, F + 0.92, kz, kx1 - kx0 + 0.02, 0.04, 0.64, steel); box(kc - 0.4, F + 0.94, kz, 0.5, 0.02, 0.4, '#59656d', false);
    rod([kc - 0.4, F + 0.95, kz - 0.18], [kc - 0.4, F + 1.2, kz - 0.18], 0.014, '#aab3b5'); rod([kc - 0.4, F + 1.2, kz - 0.18], [kc - 0.4, F + 1.18, kz - 0.04], 0.014, '#aab3b5');
    cyl(kc + 0.4, F + 1.04, kz, 0.1, 0.18, W('#c3463a', 0.3)); box(kc + 0.1, F + 1.0, kz + 0.05, 0.22, 0.12, 0.18, W('#e9e3d4', 0.3));
    box(kc, F + 1.9, kz - 0.12, kx1 - kx0, 0.55, 0.34, wood); for (let i = 1; i < 3; i++) box(kx0 + i * (kx1 - kx0) / 3, F + 1.9, kz + 0.056, 0.012, 0.5, 0.012, woodD, false);
    box(-2.0, F + 0.9, IZ1 + 0.35, 0.6, 1.8, 0.64, W('#dfe3e0', 0.28)); box(-2.0, F + 1.2, IZ1 + 0.68, 0.58, 0.012, 0.01, '#8f9aa0', false);   // fridge beside the kitchenette
    // storeroom: partition x -3.35…-2.35? — a closet in the back-east corner with an open doorway facing the hall
    const px = -2.45, pz = -3.0; box(px, F + 1.3, (pz + IZ1) / 2, 0.08, 2.6, pz - IZ1, cream); box((IX0 + 0.85 + px) / 2, F + 1.3, pz, px - IX0 - 0.85, 2.6, 0.08, cream);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) box(IX0 + 0.3 + i * 0.3, F + 0.14 + j * 0.28, -4.1, 0.28, 0.26, 0.4, W(['#c9a06a', '#b98f58', '#d4ae78'][(i + j) % 3], 0.3));
    box(IX0 + 0.2, F + 1.15, -3.5, 0.3, 0.03, 0.8, wood);
    // stair along the west wall: 16 risers rising toward the front, open treads, stringers and a handrail on the open side
    const sx = 1.35, sw = 0.8, n = 16, rise = 0.175, run = 0.2, zb = -4.35;
    for (let i = 0; i < n; i++) { const top = F + (i + 1) * rise, z = zb + i * run + run / 2; box(sx, top - 0.02, z, sw, 0.04, run + 0.02, wood); box(sx, top - rise / 2, z - run / 2 + 0.01, sw, rise, 0.02, woodD, false); }
    const sa = Math.atan2(rise, run), sl = Math.hypot(n * run, n * rise);
    for (const x of [sx - sw / 2, sx + sw / 2 - 0.03]) { const s = box(x + 0.015, F + n * rise / 2 - 0.08, zb + n * run / 2, 0.05, 0.22, sl - 0.3, woodD); s.rotation.x = -sa; }
    for (let i = 0; i <= n; i += 4) { const y = F + i * rise, z = zb + i * run; box(sx - sw / 2 - 0.01, y + 0.5, Math.min(z, -1.2), 0.03, 0.9, 0.03, '#3d4a58'); }
    rod([sx - sw / 2 - 0.01, F + 0.9, zb], [sx - sw / 2 - 0.01, F + n * rise + 0.9, zb + n * run], 0.02, '#3d4a58');
    box(sx, F + 0.5, zb - 0.0, sw, 1.0, 0.03, cream, false); // back panel at the foot of the stair
  }
  tubeLights();
  function tubeLights() { for (const [x, z, l, ax] of [[-1.9, -1.4, 1.8, 'x'], [-1.2, -3.5, 1.6, 'x']]) { const w = ax === 'x' ? l : 0.1, d = ax === 'x' ? 0.1 : l; box(x, CEIL1 - 0.04, z, w + 0.04, 0.05, d + 0.04, '#7d8b88', false, f2Layer); box(x, CEIL1 - 0.075, z, w, 0.02, d, W('#fff4d0', 0.95), false, f2Layer); } }
  for (const [x, z, r] of [[-2.0, -0.9, 1.8], [-1.6, -2.7, 1.8], [-0.1, -3.9, 1.5], [0.2, -1.5, 1.4], [1.35, -3.0, 1.2]]) decal(r, r, x, F + 0.003, z, [0, -1], pool);

  // ---- interior, upper storey: meeting room ----
  K.setRoot(f2Layer);
  {
    const tx = -1.55, tz = -2.4, top = F2 + 0.74;
    box(tx, top - 0.02, tz, 2.4, 0.04, 0.92, wood); for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(tx + dx * 1.1, F2 + 0.36, tz + dz * 0.4, 0.06, 0.72, 0.06, woodD, false);
    box(tx, F2 + 0.64, tz, 2.2, 0.03, 0.08, woodD, false);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) chair(tx - 0.9 + i * 0.6, tz + s * 0.68, [0, -s], F2);
    for (const [dx, c] of [[-0.8, '#f4efe2'], [0, '#7da0b0'], [0.7, '#f4efe2']]) cyl(tx + dx, top + 0.04, tz, 0.045, 0.07, W(c, 0.34));
    for (let i = 0; i < 4; i++) box(tx - 0.8 + i * 0.5, top + 0.003, tz + (i % 2 ? 0.2 : -0.2), 0.2, 0.004, 0.28, W('#f3ead0', 0.4), false);
    for (const x of [-2.4, -1.55, -0.7]) { rod([x, CEIL2, tz], [x, F2 + 1.9, tz], 0.006, '#3a3330'); mesh(new THREE.ConeGeometry(0.16, 0.16, 14, 1, true), W('#d9c7a0', 0.3), x, F2 + 1.87, tz, true); mesh(new THREE.SphereGeometry(0.05, 10, 8), bulb, x, F2 + 1.78, tz, false); }
    // whiteboard on the east wall, wall cabinet, floor lamp, a tall plant
    const wb = chalk(256, 160, [['夏祭り 打合せ', 36, 26, 'serif', '#2a3a4a'], ['1. 屋台の割当', 76, 22, 'sans-serif', '#3a4a5a'], ['2. 提灯の準備', 108, 22, 'sans-serif', '#3a4a5a'], ['3. 雨天の場合', 140, 22, 'sans-serif', '#a8342e']], '#e9ede8');
    box(IX0 + 0.015, F2 + 1.5, -2.4, 0.03, 0.8, 1.6, '#8a98a0'); mesh(new THREE.PlaneGeometry(1.5, 0.72), new THREE.MeshToonMaterial({ map: wb, gradientMap: K.ramp, emissive: '#2a2e2a', emissiveMap: wb }), IX0 + 0.034, F2 + 1.5, -2.4, false).rotation.y = PI / 2;
    box(-2.3, F2 + 0.45, IZ1 + 0.25, 1.0, 0.9, 0.4, woodD); box(-2.3, F2 + 0.92, IZ1 + 0.25, 1.04, 0.04, 0.44, wood); for (let i = 0; i < 5; i++) box(-2.65 + i * 0.16, F2 + 1.1, IZ1 + 0.22, 0.12, 0.3, 0.2, W(['#8a5a3a', '#5a7a9a', '#c9a86a', '#6a8a6a'][i % 4], 0.34), false);
    cyl(-0.25, F2 + 0.7, IZ1 + 0.3, 0.02, 1.4, '#3d4a58'); mesh(new THREE.ConeGeometry(0.2, 0.25, 12, 1, true), W('#efe0c0', 0.8), -0.25, F2 + 1.52, IZ1 + 0.3, true);
    pot(0.2, F2, IZ1 + 0.3, 0.17, 6, 2, '#8f9aa0');
    // stair rail around the opening and curtains at the front window
    for (let z = -4.35; z <= -1.15; z += 0.8) box(0.93, F2 + 0.5, z, 0.03, 1.0, 0.03, '#3d4a58'); box(0.93, F2 + 1.0, -2.75, 0.04, 0.04, 3.2, '#3d4a58');
    for (const x of [F2W[0] + 0.12, F2W[1] - 0.12]) box(x, 4.55, IZ0 - 0.04, 0.24, 1.4, 0.05, W('#e9dfc8', 0.4));
    box(0, 5.28, IZ0 - 0.03, F2W[1] - F2W[0] + 0.2, 0.025, 0.03, '#3a3330', false);
    for (const [x, z, r] of [[-1.55, -2.4, 2.4], [0.4, -0.7, 1.6], [-1.2, -4.0, 1.5]]) decal(r, r, x, F2 + 0.004, z, [0, -1], pool);
  }
  // ================= hip roof (roof layer) =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('hall').add(roofLayer); K.setRoot(roofLayer);
  box((IX0 + IX1) / 2, CEIL2 + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#e6dcc4', 0.32), false);
  for (let i = 1; i < 4; i++) box((IX0 + IX1) / 2, CEIL2 - 0.02, IZ0 - i * (IZ0 - IZ1) / 4, IX1 - IX0, 0.05, 0.08, woodD, false);
  const xa = X0 - OV, xb = X1 + OV, za = Z1 - OV, zb = Z0 + OV, ye = EF - OV * SL, hz = (zb - za) / 2, zr = (za + zb) / 2, yr = ye + SL * hz, xr0 = xa + hz, xr1 = xb - hz;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const face = pts => {   // thick slab for one planar roof face; pts[0], pts[1] form the base edge (eave), the rest follow
    const p0 = pts[0], u = pts[1].clone().sub(p0).normalize(), c = pts[2].clone().sub(p0);
    let n = u.clone().cross(c).normalize(); if (n.y < 0) n.negate();
    const v = n.clone().cross(u), sh = new THREE.Shape(pts.map(P => { const d = P.clone().sub(p0); return new THREE.Vector2(d.dot(u), d.dot(v)); }));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 1 }), o = p0.clone().addScaledVector(n, -0.1);
    const m = mesh(g, roofM, o.x, o.y, o.z); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)); return m;
  };
  face([V(xa, ye, zb), V(xb, ye, zb), V(xr1, yr, zr), V(xr0, yr, zr)]);       // front slope (trapezoid)
  face([V(xb, ye, za), V(xa, ye, za), V(xr0, yr, zr), V(xr1, yr, zr)]);       // rear slope
  face([V(xa, ye, za), V(xa, ye, zb), V(xr0, yr, zr)]);                        // east end hip (triangle)
  face([V(xb, ye, zb), V(xb, ye, za), V(xr1, yr, zr)]);                        // west end hip
  // Ridge, hip ridges, eave boards and gutters.
  box((xr0 + xr1) / 2, yr + 0.1, zr, xr1 - xr0 + 0.2, 0.1, 0.22, '#2f3944');
  for (const [a, b] of [[[xa, ye, zb], [xr0, yr, zr]], [[xb, ye, zb], [xr1, yr, zr]], [[xa, ye, za], [xr0, yr, zr]], [[xb, ye, za], [xr1, yr, zr]]]) rod([a[0], a[1] + 0.08, a[2]], [b[0], b[1] + 0.1, b[2]], 0.06, '#2f3944');
  for (const [z, o] of [[zb, 1], [za, -1]]) { const g = mesh(new THREE.CylinderGeometry(0.065, 0.065, xb - xa, 10, 1, true, 0, PI), mat('#8796a0'), (xa + xb) / 2, ye - 0.04, z + o * 0.04); g.rotation.z = PI / 2; g.rotation.x = o > 0 ? PI : 0; box((xa + xb) / 2, ye + 0.02, z + o * 0.02, xb - xa, 0.1, 0.04, '#2f3944'); }
  for (const [x, o] of [[xa, -1], [xb, 1]]) { const g = mesh(new THREE.CylinderGeometry(0.05, 0.05, zb - za, 8, 1, true), mat('#8796a0'), x + o * 0.04, ye - 0.06, (za + zb) / 2); g.rotation.x = PI / 2; box(x + o * 0.02, ye + 0.02, (za + zb) / 2, 0.04, 0.1, zb - za, '#2f3944'); }
  // Roof vent cap and a small chimney-style vent at the ridge's rear side.
  { const vx = -0.55, vz = zr - 0.55, vy = yr - 0.55; box(vx, vy + 0.35, vz, 0.3, 0.7, 0.3, '#8a9096'); box(vx, vy + 0.72, vz, 0.4, 0.05, 0.4, '#59656d'); }
  group('hall');
  // Downpipes: west at the front corner, east at the rear corner.
  for (const [x, z, y0] of [[xb - 0.06, zb - 0.05, ye], [xa + 0.06, za + 0.05, ye]]) {
    cyl(x, (y0 - 0.1 + 0.3) / 2, z, 0.04, y0 - 0.4, '#8796a0'); for (const y of [0.9, 2.1, 3.8, 5.0]) rod([x, y, z], [x - Math.sign(x) * 0.05, y, z + (z > 0 ? -0.2 : 0.2) * 0.6], 0.012, '#5f6c76'); box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91');
  }
  // Wall-mounted meters and a vent grille.
  box(X1 + 0.07, 1.6, -3.0, 0.14, 0.4, 0.28, '#cdd0c9'); box(X1 + 0.145, 1.68, -3.0, 0.01, 0.12, 0.17, '#7b8a92', false);
  box(X0 - 0.03, 2.0, -3.9, 0.06, 0.3, 0.36, '#c4c7c0'); for (let i = 0; i < 4; i++) box(X0 - 0.065, 1.9 + i * 0.07, -3.9, 0.012, 0.012, 0.3, '#7f8b93', false);

  // ================= forecourt, east bed, west parking, rear utilities =================
  group('hallRamp');
  // Accessible ramp running east along the front wall to the door platform, handrail on the street side.
  {
    const x0 = -3.3, x1 = -0.85, z0 = 0.1, z1 = 0.8;
    shapeMesh([[0, BASE], [x1 - x0, BASE], [x1 - x0, 0.3]], z1 - z0, '#a8a091', x0, 0, z0, 0);   // wedge, rising toward the door (x1)
    box((x0 + x1) / 2, 0.215, z0 - 0.01, x1 - x0, 0.05, 0.03, '#8e8a80', false);
    for (const x of [x0 + 0.05, (x0 + x1) / 2, x1 - 0.05]) box(x, 0.9 * 0.5 + 0.2 + (x - x0) / (x1 - x0) * 0.1, z1 + 0.01, 0.035, 0.9, 0.035, '#3d4a58');
    rod([x0, 1.05, z1 + 0.01], [x1, 1.15, z1 + 0.01], 0.022, '#3d4a58'); rod([x0, 0.75, z1 + 0.01], [x1, 0.85, z1 + 0.01], 0.014, '#3d4a58');
    for (let i = 0; i < 5; i++) box(x0 + 0.3 + i * 0.45, 0.205 + i * 0.02, (z0 + z1) / 2, 0.28, 0.006, 0.4, '#d6b13c', false);
  }
  group('hallNotice');
  // Notice board (公告栏) on two posts with a small lamp, and flower pots beside it.
  {
    const nx = -2.75, nz = 1.8, board = canvasTex(256, 192, (q, w, h) => { q.fillStyle = '#4a5a50'; q.fillRect(0, 0, w, h); q.fillStyle = '#efe9da'; q.font = 'bold 22px serif'; q.textAlign = 'center'; q.fillText('町内会だより', w / 2, 30);
      for (const [x, y, c] of [[24, 48, '#f3d98a'], [96, 48, '#bfe0e6'], [168, 48, '#f0b8b8'], [24, 112, '#d8e6b8'], [96, 112, '#f3d98a'], [168, 112, '#c8c0e6']]) { q.fillStyle = c; q.fillRect(x, y, 66, 52); q.fillStyle = 'rgba(60,50,40,.5)'; for (let i = 0; i < 4; i++) q.fillRect(x + 6, y + 10 + i * 10, 54, 2); } });
    for (const dx of [-0.5, 0.5]) box(nx + dx, 0.19 + 0.6, nz, 0.06, 1.2, 0.06, timber);
    box(nx, 0.19 + 1.1, nz, 1.2, 0.8, 0.07, '#7a5c44'); mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshToonMaterial({ map: board, gradientMap: K.ramp, emissive: '#26302a', emissiveMap: board }), nx, 0.19 + 1.1, nz + 0.04, false);
    box(nx, 0.19 + 1.56, nz + 0.06, 1.3, 0.06, 0.2, '#3d4a58', true); mesh(new THREE.PlaneGeometry(1.6, 1.0), additive(glowT, '#ffe2b0', 0.0), nx, 1.0, nz + 0.15, false);
    pot(nx - 0.85, 0.19, nz, 0.14, 5, 1.4, '#7d6a5a'); pot(nx + 0.85, 0.19, nz - 0.1, 0.12, 5, 1.2, '#8f9aa0');
  }
  group('hallBike');
  // Bicycle rack with two bikes, right of the door.
  {
    const rx = 1.95, rz = 1.1;
    for (let i = 0; i < 4; i++) { const x = rx - 0.4 + i * 0.27; box(x, 0.19 + 0.2, rz, 0.02, 0.4, 0.5, '#59656d', false); box(x, 0.19 + 0.4, rz, 0.04, 0.03, 0.5, '#59656d', false); }
    for (const [x, c] of [[rx - 0.27, '#c3463a'], [rx + 0.27, '#4f7290']]) {
      for (const z of [rz - 0.3, rz + 0.3]) { const w = mesh(new THREE.TorusGeometry(0.16, 0.014, 6, 16), mat('#2f3338'), x, 0.19 + 0.17, z, false); w.rotation.y = PI / 2; }
      box(x, 0.19 + 0.35, rz, 0.03, 0.03, 0.6, c); rod([x, 0.19 + 0.34, rz + 0.3], [x, 0.19 + 0.62, rz + 0.22], 0.012, c); box(x, 0.19 + 0.62, rz - 0.15, 0.08, 0.03, 0.2, '#2f3338'); box(x, 0.19 + 0.55, rz + 0.3, 0.2, 0.025, 0.02, '#2f3338');
      box(x, 0.19 + 0.34, rz + 0.5, 0.16, 0.12, 0.003, '#c9c9c0', false); }
    pot(rx + 0.75, 0.19, rz - 0.4, 0.12, 5, 1.2); pot(rx + 0.85, 0.19, rz + 0.1, 0.1, 4, 1, '#8f9aa0');
  }
  group('hallBed');
  // Hydrangea bed along the east wall (reference LEFT/RIGHT views): stone kerb, shrubs and flowers.
  {
    const bx = X0 - 0.3, z0 = -4.0, z1 = 0.5;
    box(bx, 0.19 + 0.1, (z0 + z1) / 2, 0.08, 0.2, z1 - z0, '#9a958b'); box(bx - 0.32, 0.19 + 0.1, (z0 + z1) / 2, 0.08, 0.2, z1 - z0, '#9a958b');
    for (const z of [z0, z1]) box(bx - 0.16, 0.19 + 0.1, z, 0.4, 0.2, 0.08, '#9a958b');
    mesh(new THREE.BoxGeometry(0.4, 0.1, z1 - z0), mat('#4a3b30'), bx - 0.16, 0.19 + 0.06, (z0 + z1) / 2, false);
    for (let i = 0; i < 6; i++) hydrangea(bx - 0.16 + (rnd() - 0.5) * 0.12, 0.26, z1 - 0.3 - i * 0.7, 0.17);
  }
  group('hallParking');
  // Parking bay on the west: wheel stops, a small grey car (nose to the rear), board fence on the plot side.
  {
    const cx = 3.7, cz = -2.7;
    for (const z of [-4.5, -0.4]) box(cx, 0.19 + 0.05, z, 1.0, 0.1, 0.12, '#bfbab0');
    box(cx, 0.19 + 0.44, cz, 1.5, 0.5, 3.2, '#c7ccce'); box(cx, 0.19 + 0.82, cz + 0.1, 1.38, 0.34, 1.7, '#bfc5c7');
    box(cx, 0.19 + 0.84, cz + 0.1, 1.4, 0.26, 1.6, glass, false); for (const z of [cz + 0.85, cz - 0.65]) box(cx, 0.19 + 0.84, z, 1.42, 0.3, 0.025, '#59656d', false);
    for (const dx of [-0.76, 0.76]) for (const dz of [-1.0, 1.0]) { const w = cyl(cx + dx, 0.19 + 0.28, cz + dz, 0.26, 0.2, '#2a2d31'); w.rotation.z = PI / 2; }
    for (const dx of [-0.5, 0.5]) { box(cx + dx, 0.19 + 0.5, cz - 1.62, 0.26, 0.12, 0.03, '#d8dcc8'); box(cx + dx, 0.19 + 0.5, cz + 1.62, 0.26, 0.1, 0.03, '#a8342e'); }
    box(cx, 0.19 + 0.27, cz - 1.6, 1.4, 0.18, 0.06, '#59656d', false);
    const fx = 4.93; for (let i = 0; i <= 14; i++) box(fx, 0.19 + 0.6, -4.7 + i * 0.34, 0.04, 1.2, 0.2, '#9a7452'); for (const y of [0.4, 1.0]) box(fx, 0.19 + y, -2.3, 0.05, 0.06, 4.9, '#5a4030');
    shrub(4.6, 0.25, -4.8, 0.25, 4, 1.4); shrub(4.6, 0.25, -0.2, 0.2, 3, 1.2);
  }
  group('hallRear');
  // Rear utilities: two AC outdoor units on a stand, a steel utility cabinet, back-door step mat, water meter box and crates.
  box(-1.1, 0.19 + 0.05, Z1 - 0.3, 1.2, 0.1, 0.42, '#7f8b93');
  for (const x of [-1.4, -0.8]) { box(x, 0.19 + 0.42, Z1 - 0.3, 0.5, 0.64, 0.34, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.15, 16), mat('#3b4650'), x - 0.05, 0.19 + 0.42, Z1 - 0.472, false).rotation.y = PI; }
  box(-2.3, 0.19 + 0.55, Z1 - 0.3, 0.7, 1.1, 0.36, '#a8aeb0'); box(-2.3, 0.19 + 0.55, Z1 - 0.485, 0.66, 1.0, 0.01, '#8f9a9f', false); box(-2.15, 0.19 + 0.6, Z1 - 0.5, 0.025, 0.2, 0.025, '#59656d');
  box(0.2, 0.19 + 0.015, Z1 - 0.3, 0.7, 0.03, 0.34, '#5d5248', false);
  for (let i = 0; i < 2; i++) box(1.35, 0.19 + 0.14 + i * 0.27, Z1 - 0.3, 0.42, 0.25, 0.3, i ? '#4f7290' : '#c3463a');
  shrub(2.0, 0.26, Z1 - 0.3, 0.2, 3, 1.2);
  group('hallGround');
  const paveMat = warm('#ffffff', 0, pavers), pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-3.2, 2.45, 0, 2.2); pave(-3.2, 2.45, -5.9, -5.0); pave(-4.1, -3.2, -5.9, 2.2);
  mesh(tileUV(new THREE.BoxGeometry(2.5, 0.016, 5.3), 1.5, 3), warm('#ffffff', 0, asphalt), 3.7, 0.198, -2.4, false);
  for (const z of [-4.8, -0.15]) box(2.45, 0.21, z, 0.05, 0.004, 0.2, '#e8e4d8', false); for (const x of [2.45, 4.95]) box(x, 0.209, -2.4, 0.05, 0.004, 5.0, '#e8e4d8', false);
  box(0, 0.214, 1.0, 1.7, 0.014, 0.5, '#5d5248', false);
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(2.2, 1.0, (FW[0] + FW[1]) / 2, 0.208, 1.4, [0, -1], spill); decal(1.5, 1.0, 0, 0.226, 1.3, [0, -1], spill);
  decal(1.4, 0.8, X0 - 0.5, 0.2, (EW[0] + EW[1]) / 2, [1, 0], additive(spillT, '#ffbf7a', 0.14));
  decal(1.2, 0.5, (BD[0] + BD[1]) / 2, 0.208, Z1 - 0.3, [0, 1], additive(glowT, '#ffc27e', 0.2));

  // ================= local animation: notice-board lamp glow, upstairs lamp, window rain, eave drips =================
  const fx = new THREE.Group(); fx.userData.live = true; group('hall').add(fx); K.setRoot(fx);
  const nfx = new THREE.Group(); nfx.userData.live = true; group('hallNotice').add(nfx); K.setRoot(nfx); group('hall');
  const lampGlow = additive(glowT, '#ffe2b0', 0.2); mesh(new THREE.PlaneGeometry(1.5, 1.2), lampGlow, -2.75, 1.0, 1.95, false, nfx); K.setRoot(fx);
  const upGlow = additive(glowT, '#ffd9a0', 0.1); mesh(new THREE.PlaneGeometry(3.0, 1.6), upGlow, -0.5, 4.5, 0.18, false, fx);
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6);
  for (const [w, n, z] of [[FW, 7, 0.06], [F2W, 7, 0.06]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 0.8, z, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 18; i++) drips.add(-3.7 + i * 0.34 + rnd() * 0.1, 3.0 + rnd() * 2.6, 0.38, 0.1, 2.9, 5.7, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 5; i++) drips.add(-1.0 + i * 0.5 + rnd() * 0.1, 0.25 + rnd() * 1.9, 0.86, 0.09, 0.25, 2.5, 2.1 + rnd() * 0.5);
  runs.seal(); drips.seal();
  const refT = tex(256, 64, (q, w, h) => { q.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = rnd() * w, ww = 2 + rnd() * 8, g = q.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(255,220,160,${0.4 + rnd() * 0.5})`); g.addColorStop(1, 'rgba(255,220,160,0)'); q.fillStyle = g; q.fillRect(x, 0, ww, h * (0.5 + rnd() * 0.5)); } });
  const refM = new THREE.MeshBasicMaterial({ map: refT, color: '#ffd8a0', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 });
  group('hallGround'); decal(4.4, 1.0, -0.8, 0.209, 1.8, [0, -1], refM); group('hall');
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt);
      lampGlow.opacity = 0.17 + 0.06 * Math.sin(t * 0.8) * Math.sin(t * 0.33 + 1);
      upGlow.opacity = 0.09 + 0.025 * Math.sin(t * 0.5 + 2);
      refT.offset.x = 0.012 * Math.sin(t * 0.6); refM.opacity = 0.15 + 0.05 * Math.sin(t * 0.9) * Math.sin(t * 0.37);
    },
  };
};
