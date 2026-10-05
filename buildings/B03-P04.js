// B03-P04 ひだまり食堂 (Hidamari Shokudo): a one-storey neighbourhood diner on the main street.
// Task card docs/buildings/tasks/B03-P04.md, reference docs/buildings/references/B03-P04.jpg.
// Local frame (placed by layout.js `buildings`, rotY 0): front +z faces the main street (world S), +x is the
// viewer's right = world E (the bookshop B03-P03 next door); door centre at the origin, floor top at rec.floor.
// Warm grey plaster with a timber frame, red noren over a double sliding door, lattice windows, a low
// mono-pitch dark steel roof that falls to the street, with a short steel front awning.
// Body 5.2 × 5.2: x -2.6…2.6, z -5.2…0 (roof edges to ±2.95 / +0.3 / -5.5, front awning to +0.76, flue to -5.9:
// inside the 7.0 × 7.0 buildable envelope).
// Groups: diner (shell, frame, roof, awning, sign, gutters, flue, interior) · dinerFrontW (food-model case, bench,
// pots) · dinerFrontE (standing lantern sign, A-board, pots) · dinerSideW (pots) · dinerSideE (AC unit, gas
// cylinder, meter) · dinerRear (back-door step, crates) · dinerService (fenced 1.6 × 0.75 bin yard) · dinerGround.
// Plan: two-seat tables behind the west window and the east lattice window; a counter with four red stools
// across the hall (z -3.0…-3.45) divides it from the open kitchen behind; staff opening and register at the
// east end of the counter; kitchen: range under a hood (west), prep table, back door, fridge and sink (east).
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B03-P04'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(3304), PI = Math.PI;
  const F = rec.floor, X0 = -2.6, X1 = 2.6, Z0 = 0, Z1 = -5.2, T = 0.15, BASE = 0.19, EF = 3.0, ER_ = 3.75, CEIL = 2.75, CT = -3.0;
  const SL = (ER_ - EF) / (Z0 - Z1), TH = Math.atan(SL), OVS = 0.35, OVF = 0.3, OVR = 0.3;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T;
  const roofY = z => EF + (Z0 - z) * SL;   // roof underside height at depth z
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FW = [-2.4, -1.0, 0.95, 2.2], FD = [-0.9, 0.9, F, 2.2], FE = [1.2, 1.8, 0.7, 2.2];
  const WL = [-2.7, -1.5, 1.0, 2.1], ER = [-3.4, -2.2, 1.0, 2.1], BD = [0.3, 1.1, F, 2.2], RW = [-1.15, -0.25, 1.3, 2.05];

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#cfc2ae'), timber = '#5a4030', timberL = '#7d5c45', stoneC = '#9a958b', metal = '#8a8f92', steelD = '#3d4a58';
  const W = (c, k = 0.3) => warm(c, k);
  const wood = W('#b0814f'), woodD = W('#6f4a35', 0.26), cream = W('#efe0c0', 0.34), floorW = W('#a7764c', 0.26), steel = W('#c3cacb', 0.22), white = W('#f1ece0', 0.34);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' });
  // Standing-seam steel roof: seams run down the slope.
  const seamT = tex(128, 128, (q, w, h) => { q.fillStyle = '#5b6168'; q.fillRect(0, 0, w, h); const g = q.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#4a5058'); g.addColorStop(0.5, '#6a7078'); g.addColorStop(1, '#464c54'); q.fillStyle = g; q.fillRect(0, 0, w, h);
    q.fillStyle = '#2b333c'; q.fillRect(0, 0, 4, h); q.fillStyle = 'rgba(190,205,220,.35)'; q.fillRect(4, 0, 2, h);
    for (let i = 0; i < 500; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '10,16,24' : '200,215,230'},${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1, 1 + rnd() * 5); } });
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: seamT });
  const planks = tex(256, 256, (q, w, h) => { for (let r = 0; r < 8; r++) { q.fillStyle = `hsl(${24 + rnd() * 6},${36 + rnd() * 10}%,${42 + rnd() * 8}%)`; q.fillRect(0, r * 32, w, 32);
    q.fillStyle = 'rgba(60,36,24,.55)'; q.fillRect(0, r * 32, w, 1.5); q.fillRect(rnd() * 200 + 28, r * 32, 1.5, 32); } });
  const kitchenT = tex(128, 128, (q, w, h) => { q.fillStyle = '#7f898c'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { q.fillStyle = `rgba(${(i + j) % 2 ? '255,255,255' : '40,50,56'},.08)`; q.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
    q.strokeStyle = 'rgba(40,50,56,.5)'; q.lineWidth = 1.5; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 32, 0); q.lineTo(i * 32, h); q.moveTo(0, i * 32); q.lineTo(w, i * 32); q.stroke(); } });
  const pavers = tex(256, 256, (q, w, h) => { q.fillStyle = '#a19c90'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
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
  const chalk = (w, h, lines, bg = '#2f3a36') => canvasTex(w, h, (q, W2, H2) => { q.fillStyle = bg; q.fillRect(0, 0, W2, H2); q.textAlign = 'center'; q.textBaseline = 'middle';
    for (const [t, y, size, font = 'sans-serif', col] of lines) { q.fillStyle = col || '#efe9da'; q.font = `bold ${size}px ${font}`; q.fillText(t, W2 / 2, y); } });

  // ---- plants outside ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), LEAF = ['#6c9476', '#88a98a', '#5e8a6a'];
  const shrub = (x, y, z, r, n, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(LEAF[i % 3]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.35 + rnd() * r * h, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.45 + rnd() * 0.25)); } };
  const pot = (x, y, z, r, n = 5, h = 1, c = '#9b7d68') => { mesh(new THREE.CylinderGeometry(r, r * 0.76, r * 1.15, 10), mat(c), x, y + r * 0.575, z); shrub(x, y + r * 1.1, z, r, n, h); };

  // ================= shell =================
  group('diner');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, EF], [FW, FD, FE], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, ER_], [BD, RW], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, EF], [ER], plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, EF], [WL], plaster);
  // Side walls rise to the rear: wedge between the front and rear wall tops.
  shapeMesh([[IZ0, EF - 0.01], [IZ1, EF - 0.01], [IZ1, ER_]], T, plaster, X1, 0, 0, -PI / 2);
  shapeMesh([[IZ0, EF - 0.01], [IZ1, EF - 0.01], [IZ1, ER_]], T, plaster, X0 + T, 0, 0, -PI / 2);
  // Stone plinth, timber corner posts, rails and plate beams.
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FD[0], Z0, 1); plinth('x', FD[1], X1, Z0, 1); plinth('x', X0, BD[0], Z1, -1); plinth('x', BD[1], X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  const post = (x, z, y1) => box(x, (BASE + y1) / 2, z, 0.13, y1 - BASE, 0.13, timber);
  post(X0 + 0.05, Z0 - 0.05, EF); post(X1 - 0.05, Z0 - 0.05, EF); post(X0 + 0.05, Z1 + 0.05, ER_); post(X1 - 0.05, Z1 + 0.05, ER_);
  box(0, 2.34, 0.015, X1 - X0 + 0.04, 0.14, 0.06, timber); box(0, EF - 0.07, 0.015, X1 - X0 + 0.04, 0.14, 0.06, timber);
  box(0, ER_ - 0.07, Z1 - 0.015, X1 - X0 + 0.04, 0.14, 0.06, timber); box(0, 1.0, Z1 - 0.015, X1 - X0 + 0.04, 0.08, 0.06, timber);
  for (const [x, o] of [[X0, -1], [X1, 1]]) {
    for (const z of [-1.85, -3.6]) box(x + o * 0.012, (BASE + roofY(z) - 0.1) / 2, z, 0.05, roofY(z) - 0.1 - BASE, 0.12, timber);
    box(x + o * 0.015, 0.98, (Z0 + Z1) / 2, 0.06, 0.08, Z0 - Z1 + 0.06, timber);
    const rail = box(x + o * 0.015, (EF + ER_) / 2 - 0.08, (Z0 + Z1) / 2, 0.06, 0.12, Math.hypot(Z0 - Z1, ER_ - EF), timber); rail.rotation.x = TH;
  }
  // Floors: oiled planks in the hall, grey tile in the kitchen (marks the divide).
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - CT), (IX1 - IX0) / 2, (IZ0 - CT) / 2), warm('#ffffff', 0.2, planks), 0, (F + BASE) / 2, (IZ0 + CT) / 2, false);
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, CT - IZ1), (IX1 - IX0) / 1, (CT - IZ1) / 1), warm('#ffffff', 0.16, kitchenT), 0, (F + BASE) / 2, (CT + IZ1) / 2, false);
  // Interior linings: warm plaster; the kitchen half has white tile above the work surfaces.
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL], [FW, FD, FE], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL], [ER], cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL], [WL], cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL], [BD, RW], cream);
  box(0, F + 1.2, IZ1 + 0.01, IX1 - IX0, 0.7, 0.012, white, false); for (const [z0, z1] of [[IZ1, CT]]) for (const x of [IX0 + 0.006, IX1 - 0.006]) box(x, F + 1.2, (z0 + z1) / 2, 0.012, 0.7, z1 - z0, white, false);

  // ---- glazing: tea-brown wooden frames with lattice ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = [], lattice = 0) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, timberL); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, timberL);
    ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, timberL); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, timberL);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.045, q - p, fd * 0.9, timberL);
    for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.04, fd * 0.9, timberL);
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    if (lattice) { const d = at + out * 0.09, n = Math.round((b - a) / lattice); for (let i = 1; i < n; i++) ab(axis, a + i * (b - a) / n, (p + q) / 2, d, 0.028, q - p, 0.03, timber);
      for (const y of [p + 0.03, q - 0.03]) ab(axis, (a + b) / 2, y, d, b - a, 0.04, 0.05, timber);
      const e = ab(axis, (a + b) / 2, q + 0.1, at + out * 0.16, b - a + 0.28, 0.04, 0.3, '#3d4a58'); if (axis === 'x') e.rotation.x = out * 0.35; else e.rotation.z = -out * 0.35; }
    if (p > F + 0.05) ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.1, 0.05, 0.15, '#a8a091');
  }
  glaze('x', -T / 2, 1, FW, [-1.7], [1.6]);
  glaze('x', -T / 2, 1, FE, [], [], 0.1);
  glaze('z', X1 - T / 2, 1, ER, [], [], 0.1);
  glaze('z', X0 + T / 2, -1, WL, [], [], 0.1);
  glaze('x', Z1 + T / 2, -1, RW, [], [], 0.1);
  // Low board panel under the east window (outside).
  box((FE[0] + FE[1]) / 2, (0.32 + FE[2] - 0.05) / 2, 0.012, FE[1] - FE[0] - 0.04, FE[2] - 0.05 - 0.32, 0.02, timberL);
  // Front door: double sliding door, wooden frame, lattice glass above a board panel, pull handles.
  ab('x', FD[0] + 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, timberL); ab('x', FD[1] - 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, timberL);
  box(0, FD[3] - 0.03, -T / 2, FD[1] - FD[0], 0.06, 0.16, timberL);
  {
    const z = -0.05, top = FD[3] - 0.06, l = -0.84, r = 0.84;
    for (const x of [l + 0.04, -0.02, 0.02, r - 0.04]) box(x, (F + top) / 2, z, 0.06, top - F, 0.045, timber);
    box(0, top - 0.04, z, r - l, 0.08, 0.045, timber); box(0, F + 0.3, z, r - l, 0.6, 0.045, timberL);
    box(0, (F + 0.6 + top - 0.08) / 2, z, r - l - 0.1, top - 0.08 - F - 0.6, 0.012, glass, false);
    for (const x of [-0.63, -0.42, -0.21, 0.21, 0.42, 0.63]) box(x, (F + 0.6 + top - 0.08) / 2, z + 0.01, 0.022, top - 0.08 - F - 0.6, 0.03, timber, false);
    for (const y of [0.95, 1.35, 1.75]) box(0, y, z + 0.01, r - l - 0.1, 0.022, 0.03, timber, false);
    for (const x of [-0.14, 0.14]) box(x, 1.1, z + 0.03, 0.025, 0.24, 0.025, '#c9a35b');
  }
  shapeMesh([[0, BASE], [0.48, BASE], [0.48, 0.212], [0, 0.298]], 1.9, '#a8a091', 0.95, 0, 0, -PI / 2);
  // Back door: steel door in a timber frame, small steel eave, step, lamp, vent hood.
  ab('x', BD[0] + 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, timber); ab('x', BD[1] - 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, timber);
  box((BD[0] + BD[1]) / 2, BD[3] - 0.03, Z1 + T / 2, BD[1] - BD[0], 0.06, 0.16, timber);
  box((BD[0] + BD[1]) / 2, (F + BD[3] - 0.06) / 2, Z1 + 0.06, BD[1] - BD[0] - 0.12, BD[3] - 0.06 - F, 0.04, '#6a747a');
  for (const y of [0.9, 1.6]) box((BD[0] + BD[1]) / 2, y, Z1 + 0.035, BD[1] - BD[0] - 0.22, 0.02, 0.012, '#4f585e', false);
  box(BD[0] + 0.12, 1.15, Z1 + 0.02, 0.03, 0.16, 0.04, '#c9a35b');
  shapeMesh([[0, BASE], [0.3, BASE], [0.3, 0.3], [0, 0.3]], BD[1] - BD[0] + 0.1, '#a8a091', BD[0] - 0.05, 0, Z1, PI / 2);
  { const e = box((BD[0] + BD[1]) / 2, 2.42, Z1 - 0.2, 1.05, 0.05, 0.42, steelD); e.rotation.x = -0.3; }
  for (const x of [BD[0] - 0.05, BD[1] + 0.05]) box(x, 2.3, Z1 - 0.12, 0.05, 0.05, 0.26, timber);
  box(BD[1] + 0.25, 2.0, Z1 - 0.06, 0.12, 0.17, 0.1, '#3d4a58'); box(BD[1] + 0.25, 1.99, Z1 - 0.06, 0.09, 0.12, 0.105, bulb, false);
  mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.28), BD[1] + 0.25, 2.0, Z1 - 0.004, false).rotation.y = PI;

  // ================= front awning, name board, lamps =================
  {
    const x0 = -2.88, x1 = 2.88, top = 2.55, low = 2.3, dep = 0.76, len = Math.hypot(dep, top - low);
    const e = box(0, (top + low) / 2 + 0.03, dep / 2, x1 - x0, 0.05, len, roofM); e.rotation.x = Math.atan2(top - low, dep);
    box(0, low - 0.01, dep - 0.01, x1 - x0, 0.1, 0.05, '#2f3944');   // front fascia
    for (const x of [-2.6, 0, 2.6]) { box(x, top - 0.02, dep * 0.45, 0.07, 0.07, dep * 0.9, timber); rod([x, 2.0, 0.02], [x, top - 0.04, dep * 0.8], 0.022, timber); }
  }
  // Name board on the wall above the awning: dark timber, cream lettering; an enamel plate on its right.
  {
    const s = canvasTex(512, 96, (q, w, h) => { q.fillStyle = '#4d3629'; q.fillRect(0, 0, w, h); q.strokeStyle = '#8a6a4c'; q.lineWidth = 4; q.strokeRect(6, 6, w - 12, h - 12);
      q.fillStyle = '#f0e2c0'; q.font = 'bold 60px serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('ひだまり食堂', w / 2, h / 2 + 4, w - 60); });
    mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, emissive: '#3a2c20', emissiveMap: s }), 0, 2.78, 0.012, false);
    box(0, 2.78, 0.0, 2.5, 0.52, 0.02, timber);
  }
  // Wall lantern west of the door under the awning, and one by the east window.
  for (const x of [-1.2, 1.5]) { box(x, 2.0, 0.07, 0.12, 0.18, 0.1, '#3d4a58'); box(x, 1.99, 0.07, 0.09, 0.13, 0.105, bulb, false);
    mesh(new THREE.PlaneGeometry(0.8, 0.8), additive(glowT, '#ffc27e', 0.28), x, 2.0, 0.05, false); }

  // ================= mono-pitch roof (roof layer) =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('diner').add(roofLayer); K.setRoot(roofLayer);
  box(0, CEIL + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#e6dcc4', 0.34), false);   // ceiling boards
  for (let i = 1; i < 5; i++) box(0, CEIL - 0.02, IZ0 - i * (IZ0 - IZ1) / 5, IX1 - IX0, 0.04, 0.07, woodD, false);
  {
    const zf = Z0 + OVF, zr = Z1 - OVR, D = zf - zr, Ds = D / Math.cos(TH), Wd = X1 - X0 + 2 * OVS, cz = (zf + zr) / 2, cy = roofY(cz) + 0.07;
    const g = tileUV(new THREE.BoxGeometry(Wd, 0.1, Ds), Wd / 0.5, 1);
    mesh(g, roofM, 0, cy, cz).rotation.x = TH;
    box(0, cy - 0.05, cz, Wd - 0.02, 0.07, Ds - 0.02, '#4a3a30', false).rotation.x = TH;   // underside boards
    // Side fascia boards, front gutter, rear bargeboard.
    for (const s of [-1, 1]) { const f = box(s * (Wd / 2 - 0.02), cy - 0.04, cz, 0.05, 0.2, Ds, '#2f3944'); f.rotation.x = TH; }
    const fy = roofY(zf) - 0.02;
    const gut = mesh(new THREE.CylinderGeometry(0.065, 0.065, Wd, 10, 1, true, 0, PI), mat('#8796a0'), 0, fy - 0.03, zf + 0.04); gut.rotation.z = PI / 2; gut.rotation.x = PI;
    box(0, roofY(zr) + 0.07, zr - 0.02, Wd, 0.2, 0.05, '#2f3944');
    const rg = mesh(new THREE.CylinderGeometry(0.06, 0.06, Wd, 10, 1, true, 0, PI), mat('#8796a0'), 0, roofY(zr) - 0.03, zr - 0.04); rg.rotation.z = PI / 2; rg.rotation.x = PI;
    // Rooftop air-conditioner on a stand near the rear (reference ROOF TOP), pipe cover to the flue side.
    const ax = 1.55, az = -4.35, ay = roofY(az) + 0.12;
    for (const dx of [-0.32, 0.32]) box(ax + dx, ay + 0.05, az, 0.07, 0.1, 0.5, steelD);
    box(ax, ay + 0.4, az, 0.82, 0.58, 0.34, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), ax - 0.15, ay + 0.4, az + 0.172, false);
    for (let i = 0; i < 4; i++) box(ax - 0.15, ay + 0.3 + i * 0.07, az + 0.174, 0.38, 0.012, 0.01, '#9aa6ab', false);
  }
  group('diner');
  // Flue: hood duct through the rear wall, out beyond the roof edge, up past the ridge, capped.
  {
    const fx = -1.95, fz = Z1 - 0.6;
    box(fx, 2.5, (-4.85 + Z1) / 2, 0.3, 0.3, 0.62, steel);   // horizontal run through the wall (outside part continues below)
    box(fx, 2.5, (Z1 + fz) / 2, 0.26, 0.26, Z1 - fz + 0.26, '#aeb5b8');
    cyl(fx, (2.4 + 4.75) / 2, fz, 0.13, 4.75 - 2.4, '#aeb5b8');
    for (const y of [3.1, 3.9]) cyl(fx, y, fz, 0.155, 0.06, '#7f8b93');
    cyl(fx, 4.78, fz, 0.17, 0.05, '#7f8b93'); mesh(new THREE.ConeGeometry(0.19, 0.14, 12), mat('#59656d'), fx, 4.9, fz);
    for (const y of [2.8, 3.6]) rod([fx, y, fz], [fx, y, Z1 - 0.12], 0.012, '#5f6c76');
  }
  // Downpipes: east at the front corner, west at the rear corner.
  for (const [x, z, y0] of [[X1 + OVS - 0.05, 0.25, roofY(0.3)], [X0 - OVS + 0.05, Z1 - 0.2, roofY(-5.5)]]) {
    const ey = y0 - 0.1, s = Math.sign(x);
    cyl(x, (ey + 0.3) / 2, z, 0.04, ey - 0.3, '#8796a0'); for (const y of [0.9, 2.0]) rod([x, y, z], [s * (X1 + 0.02), y, z], 0.012, '#5f6c76');
    box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91');
  }
  // Meter boxes on the east wall, a vent on the west wall.
  box(X1 + 0.08, 1.55, -1.3, 0.16, 0.42, 0.3, '#cdd0c9'); box(X1 + 0.165, 1.63, -1.3, 0.01, 0.12, 0.18, '#7b8a92', false);
  line([[X1 + 0.06, 1.33, -1.3], [X1 + 0.06, 0.45, -1.3]], '#9aa3a6', 0.018);
  box(X0 - 0.03, 2.5, -4.3, 0.06, 0.28, 0.36, '#c4c7c0'); for (let i = 0; i < 4; i++) box(X0 - 0.065, 2.41 + i * 0.06, -4.3, 0.012, 0.012, 0.3, '#7f8b93', false);

  // ================= interior =================
  const pendant = (x, z, y, c = '#c9a774') => { rod([x, CEIL, z], [x, y + 0.08, z], 0.006, '#3a3330'); mesh(new THREE.ConeGeometry(0.13, 0.15, 14, 1, true), W(c, 0.3), x, y + 0.07, z, true); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false); };
  // Near layer: two-seat tables behind the west window and the east lattice window, with plates of food.
  const redC = W('#a8342e', 0.3);
  const chair = (x, z, face) => { const s = face;   // face = direction the sitter looks: [dx, dz]
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + dx * 0.17, F + 0.22, z + dz * 0.17, 0.035, 0.44, 0.035, woodD, false);
    box(x, F + 0.45, z, 0.4, 0.04, 0.4, wood);
    const bx = x - s[0] * 0.19, bz = z - s[1] * 0.19; box(bx, F + 0.68, bz, s[0] ? 0.03 : 0.38, 0.4, s[0] ? 0.38 : 0.03, woodD); box(bx, F + 0.88, bz, s[0] ? 0.04 : 0.42, 0.04, s[0] ? 0.42 : 0.04, wood); };
  const plate = (x, y, z, kind) => {
    cyl(x, y + 0.01, z, 0.1, 0.02, '#f4efe2');
    if (kind === 0) { const o = mesh(new THREE.SphereGeometry(0.08, 10, 6), mat('#e8bd4c'), x, y + 0.04, z); o.scale.set(1.15, 0.55, 0.8); box(x, y + 0.075, z, 0.1, 0.012, 0.025, '#b9382d', false); }
    else if (kind === 1) { cyl(x - 0.03, y + 0.035, z, 0.07, 0.03, '#f2ecd4'); const c = mesh(new THREE.SphereGeometry(0.075, 10, 6), mat('#7a4a2a'), x + 0.04, y + 0.04, z); c.scale.set(1, 0.5, 0.9); }
    else { for (let i = 0; i < 3; i++) box(x - 0.05 + i * 0.05, y + 0.04, z, 0.04, 0.045, 0.1, '#c98d45', false); box(x, y + 0.025, z + 0.07, 0.12, 0.03, 0.04, '#7da45a', false); } };
  const bowl = (x, y, z, c) => { cyl(x, y + 0.03, z, 0.055, 0.06, '#e9e3d4'); mesh(new THREE.SphereGeometry(0.05, 8, 5), mat(c), x, y + 0.065, z).scale.y = 0.55; };
  for (const [tx, tz, ax] of [[-1.75, -1.0, 'x'], [-1.75, -1.9, 'x'], [1.85, -1.0, 'z']]) {
    const w = ax === 'x' ? 0.62 : 0.72, d = ax === 'x' ? 0.72 : 0.62, top = F + 0.74;
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(tx + dx * (w / 2 - 0.04), F + 0.36, tz + dz * (d / 2 - 0.04), 0.05, 0.72, 0.05, woodD, false);
    box(tx, top - 0.02, tz, w, 0.04, d, wood); box(tx, F + 0.12, tz, w - 0.08, 0.02, d - 0.08, woodD, false);
    box(tx, top + 0.003, tz, w - 0.04, 0.004, d - 0.04, W('#d8c8a8', 0.32), false);
    // tea pot, cups, chopsticks, a plate each
    cyl(tx, top + 0.06, tz, 0.045, 0.1, W('#7da0b0', 0.3)); box(tx + (ax === 'x' ? 0 : 0.14), top + 0.012, tz + (ax === 'x' ? -0.2 : 0.14), 0.12, 0.02, 0.012, '#6f4a35', false);
    if (ax === 'x') { chair(tx - 0.46, tz, [1, 0]); chair(tx + 0.46, tz, [-1, 0]); plate(tx - 0.17, top, tz, (tz < -1.5) ? 1 : 0); plate(tx + 0.17, top, tz, 2); }
    else { chair(tx, tz - 0.45, [0, 1]); chair(tx, tz + 0.45, [0, -1]); plate(tx, top, tz - 0.16, 1); plate(tx, top, tz + 0.16, 0); }
  }
  pendant(-1.75, -1.0, F + 1.95); pendant(-1.75, -1.9, F + 1.95); pendant(1.85, -1.0, F + 1.95);
  // Middle: counter with four red stools; menu valance above its east half; sauce rack, tea urn and plates on the counter.
  {
    const x0 = IX0, x1 = 0.85, z0 = CT, z1 = -3.45, top = F + 1.0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(cx, F + 0.46, cz, x1 - x0, 0.92, z0 - z1, woodD); box(cx, top - 0.03, cz, x1 - x0 + 0.04, 0.06, z0 - z1 + 0.1, wood);
    for (let i = 1; i < 9; i++) box(x0 + i * (x1 - x0) / 9, F + 0.46, z0 + 0.003, 0.02, 0.8, 0.012, wood, false);
    box(cx, F + 0.1, z0 + 0.006, x1 - x0 - 0.04, 0.12, 0.014, '#4a3a30', false);
    for (const x of [-1.7, -0.95, -0.2, 0.55]) { const z = -2.6;
      cyl(x, F + 0.22, z, 0.025, 0.44, '#3d4a58'); cyl(x, F + 0.015, z, 0.14, 0.03, '#3d4a58'); mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 14), redC, x, F + 0.47, z); box(x, F + 0.11, z + 0.0, 0.2, 0.02, 0.02, '#59656d', false); }
    plate(-1.35, top, -3.17, 0); plate(-0.6, top, -3.17, 2); bowl(0.15, top, -3.17, '#d8b45a'); bowl(0.4, top, -3.2, '#8c3d2a');
    box(-2.0, top + 0.1, -3.2, 0.34, 0.2, 0.12, W('#8d6a4a', 0.28)); for (const x of [-2.1, -2.0, -1.9]) cyl(x, top + 0.23, -3.2, 0.025, 0.07, W(['#b9382d', '#4f7a56', '#8a6a3a'][Math.round((x + 2.1) * 10)], 0.35));
    box(0.7, top + 0.14, -3.3, 0.1, 0.24, 0.1, steel); cyl(0.7, top + 0.31, -3.3, 0.06, 0.1, steel);
    // Menu valance: wooden slats with a chalk menu, hanging from the ceiling over the east half of the counter.
    const menu = chalk(512, 192, [['お品書き', 34, 34, 'serif', '#f0c987'], ['生姜焼き定食 ¥850   唐揚げ定食 ¥800', 90, 26], ['カレーライス ¥700   オムライス ¥780', 130, 26], ['日替わり 味噌汁つき ¥750', 168, 26, 'sans-serif', '#c7d0a0']]);
    box(-0.05, CEIL - 0.25, CT - 0.02, 1.8, 0.5, 0.05, woodD); mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshToonMaterial({ map: menu, gradientMap: K.ramp, emissive: '#2a2418', emissiveMap: menu }), -0.05, CEIL - 0.25, CT + 0.008, false);
    pendant(-1.25, -2.85, F + 1.9); pendant(-0.2, -2.85, F + 1.9); pendant(0.55, -2.85, F + 1.9);
    // Staff opening east of the counter, register and tip tray on the return.
    const rx0 = 1.85, rz0 = CT, rz1 = -3.45, rc = (rx0 + IX1) / 2, rzc = (rz0 + rz1) / 2;
    box(rc, F + 0.46, rzc, IX1 - rx0, 0.92, rz0 - rz1, woodD); box(rc, top - 0.03, rzc, IX1 - rx0 + 0.02, 0.06, rz0 - rz1 + 0.06, wood);
    box(rc + 0.05, top + 0.1, rzc, 0.3, 0.14, 0.26, W('#5a4a3c', 0.14)); box(rc + 0.05, top + 0.2, rzc - 0.02, 0.22, 0.04, 0.2, W('#2f2a26', 0.08), false); K.label('お会計', rx0 - 0.002, F + 0.62, rzc, 0.28, 0.08, '#efe3c6', '#5a4030', 70).rotation.y = -PI / 2;
    cyl(rc - 0.1, top + 0.035, rzc + 0.12, 0.06, 0.05, W('#b9382d', 0.3));
  }
  // Back layer: open kitchen. Range under a hood on the rear west corner, prep table, fridge, sink, dish shelf.
  {
    const rx = -1.9, rz = -4.78;
    box(rx, F + 0.45, rz, 1.0, 0.9, 0.55, steel); box(rx, F + 0.9, rz, 1.0, 0.04, 0.58, W('#6b757a', 0.2));
    for (const x of [-0.25, 0.25]) { cyl(rx + x, F + 0.93, rz - 0.02, 0.1, 0.02, '#2a2f33'); cyl(rx + x, F + 0.945, rz - 0.02, 0.05, 0.01, '#d96a3a'); }
    for (let i = 0; i < 4; i++) cyl(rx - 0.33 + i * 0.22, F + 0.6, rz + 0.285, 0.022, 0.03, '#2a2f33');
    box(rx, F + 0.3, rz + 0.285, 0.88, 0.5, 0.012, '#8f9a9f', false);
    // stock pot and a pan on the burners
    cyl(rx - 0.25, F + 1.03, rz - 0.02, 0.12, 0.22, W('#aab3b5', 0.26)); cyl(rx - 0.25, F + 1.15, rz - 0.02, 0.125, 0.02, W('#8b9598', 0.2));
    cyl(rx + 0.27, F + 0.955, rz - 0.02, 0.1, 0.02, W('#2f2a26', 0.1)); box(rx + 0.46, F + 0.97, rz - 0.02, 0.18, 0.015, 0.03, W('#2f2a26', 0.1), false);
    // hood: slanted skirt over the range, duct to the rear wall
    box(rx, F + 1.78, rz, 1.12, 0.32, 0.64, steel); box(rx, F + 1.6, rz + 0.04, 1.14, 0.06, 0.62, W('#9aa4a8', 0.24));
    box(-1.95, F + 2.2, -4.9, 0.3, 0.5, 0.3, steel);
    box(rx, F + 1.58, rz + 0.33, 1.0, 0.03, 0.02, W('#fff1cf', 0.7), false);   // hood light strip
    // prep table with chopping board, knives rail on the rear wall under the window
    box(-0.75, F + 0.43, rz + 0.0, 0.9, 0.86, 0.55, W('#9aa4a8', 0.22)); box(-0.75, F + 0.88, rz, 0.94, 0.04, 0.58, steel);
    box(-0.8, F + 0.91, rz, 0.4, 0.025, 0.28, W('#d9b782', 0.3)); box(-0.8, F + 0.93, rz - 0.02, 0.2, 0.04, 0.05, W('#7a9a52', 0.3), false); cyl(-0.45, F + 0.96, rz + 0.05, 0.05, 0.1, W('#e9e3d4', 0.3));
    box(-0.75, F + 0.48, rz, 0.8, 0.02, 0.5, W('#6b757a', 0.2), false);
    rod([-1.1, F + 1.65, IZ1 + 0.03], [-0.3, F + 1.65, IZ1 + 0.03], 0.008, '#3a3330'); for (let i = 0; i < 6; i++) { const x = -1.05 + i * 0.14; rod([x, F + 1.64, IZ1 + 0.03], [x, F + 1.5 - (i % 2) * 0.06, IZ1 + 0.03], 0.012, i % 2 ? '#aab3b5' : W('#3a3330', 0.2)); }
    // fridge: two-door, rear east corner; sink with a tap on the east wall; wall shelf of bowls on the west wall
    const fx = 2.05, fz = -4.72;
    box(fx, F + 0.88, fz, 0.7, 1.76, 0.66, W('#dfe3e0', 0.28)); box(fx, F + 1.25, fz - 0.332, 0.69, 0.012, 0.01, '#8f9a9f', false); box(fx - 0.28, F + 1.35, fz - 0.34, 0.02, 0.3, 0.025, '#59656d'); box(fx - 0.28, F + 0.7, fz - 0.34, 0.02, 0.4, 0.025, '#59656d');
    box(IX1 - 0.3, F + 0.43, -3.95, 0.6, 0.86, 0.7, W('#9aa4a8', 0.22)); box(IX1 - 0.3, F + 0.88, -3.95, 0.62, 0.04, 0.72, steel); box(IX1 - 0.3, F + 0.9, -3.95, 0.4, 0.015, 0.5, '#59656d', false);
    rod([IX1 - 0.12, F + 0.94, -3.95], [IX1 - 0.12, F + 1.14, -3.95], 0.012, '#aab3b5'); rod([IX1 - 0.12, F + 1.14, -3.95], [IX1 - 0.28, F + 1.12, -3.95], 0.012, '#aab3b5');
    for (let k = 0; k < 2; k++) { const y = F + 1.15 + k * 0.4; box(IX0 + 0.13, y, -4.0, 0.26, 0.03, 0.9, wood);
      for (let i = 0; i < 4; i++) { bowl(IX0 + 0.13, y + 0.015, -3.7 - i * 0.2, ['#e9e3d4', '#6b8a9a', '#e9e3d4', '#b9a88a'][i]); } }
  }
  // Stove steam spot light and counter glow pools on the floor
  for (const [x, z, r] of [[-1.75, -1.0, 1.5], [-1.75, -1.9, 1.5], [1.85, -1.0, 1.4], [-0.7, -2.4, 1.8], [0.4, -4.2, 1.8], [-1.9, -4.4, 1.4], [0.3, -0.9, 1.5]]) decal(r, r, x, F + 0.003, z, [0, -1], pool);

  // ================= forecourt and attachments =================
  group('dinerFrontW');
  // Food-model display case in front of the west window: lit shelves with plates, on a timber stand; bench beside.
  {
    const x0 = -2.35, x1 = -1.05, z0 = 0.0, z1 = 0.5, y0 = 0.45, y1 = 1.3, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (const x of [x0 + 0.05, x1 - 0.05]) for (const z of [z0 + 0.06, z1 - 0.06]) box(x, (0.19 + y0) / 2, z, 0.06, y0 - 0.19, 0.06, timber);
    box(cx, y0 - 0.03, cz, x1 - x0 + 0.08, 0.06, z1 - z0 + 0.06, timber);
    for (const x of [x0, x1]) box(x, (y0 + y1) / 2, cz, 0.04, y1 - y0, z1 - z0, timber); box(cx, y1 + 0.03, cz, x1 - x0 + 0.06, 0.06, z1 - z0 + 0.06, timber);
    box(cx, (y0 + y1) / 2, z0 + 0.02, x1 - x0, y1 - y0, 0.02, woodD);
    box(cx, (y0 + y1) / 2, z1 - 0.01, x1 - x0 - 0.04, y1 - y0 - 0.02, 0.012, glass, false);
    for (const x of [x0 + 0.01, x1 - 0.01]) box(x, (y0 + y1) / 2, cz, 0.012, y1 - y0 - 0.02, z1 - z0 - 0.04, glass, false);
    box(cx, y1 - 0.03, z1 - 0.08, x1 - x0 - 0.1, 0.02, 0.03, W('#fff1cf', 0.7), false);
    for (const y of [y0 + 0.03, y0 + 0.42]) { box(cx, y, cz, x1 - x0 - 0.04, 0.02, z1 - z0 - 0.04, W('#e9dcc2', 0.34));
      for (let i = 0; i < 4; i++) plate(x0 + 0.2 + i * 0.3, y + 0.01, cz + 0.02, (i + (y > 0.6 ? 1 : 0)) % 3); }
    K.label('サンプル · 本日の定食', cx, y1 + 0.03, z1 + 0.025, 0.7, 0.05, '#5a4030', '#efe3c6', 50);
    // low timber bench under the awning west of the case
    box(-2.7, 0.19 + 0.2, 0.4, 0.28, 0.04, 0.8, wood); for (const z of [0.1, 0.7]) box(-2.7, 0.19 + 0.1, z, 0.24, 0.2, 0.05, timber);
  }
  pot(-2.85, 0.19, 0.95, 0.17, 7, 1.8, '#7d6a5a'); pot(-1.35, 0.19, 0.9, 0.12, 5, 1.2, '#8f9aa0');
  group('dinerFrontE');
  // Standing lantern sign (andon): timber frame with glowing 食堂 panels; chalk A-board; pots.
  {
    const s = canvasTex(256, 512, (q, w, h) => { q.fillStyle = '#f0e2bc'; q.fillRect(0, 0, w, h); q.strokeStyle = '#6b4a35'; q.lineWidth = 8; q.strokeRect(8, 8, w - 16, h - 16);
      q.fillStyle = '#7a2a24'; q.font = 'bold 150px serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('食', w / 2, 150); q.fillText('堂', w / 2, 320);
      q.font = 'bold 36px sans-serif'; q.fillStyle = '#5a4030'; q.fillText('営業中', w / 2, 450); });
    const lx = 2.2, lz = 0.6;
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(lx + dx * 0.19, 0.19 + 0.09, lz + dz * 0.14, 0.05, 0.18, 0.05, timber);
    box(lx, 0.19 + 0.2, lz, 0.46, 0.04, 0.34, timber);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(lx + dx * 0.22, 0.19 + 0.2 + 0.55, lz + dz * 0.16, 0.04, 1.1, 0.04, timber);
    box(lx, 1.55, lz, 0.5, 0.05, 0.38, timber); box(lx, 1.6, lz, 0.38, 0.05, 0.28, timber);
    for (const s2 of [1, -1]) { const m = mesh(new THREE.PlaneGeometry(0.42, 1.0), new THREE.MeshBasicMaterial({ map: s, color: '#fff0cf' }), lx, 0.19 + 0.2 + 0.55, lz + s2 * 0.15, false); if (s2 < 0) m.rotation.y = PI; }
    for (const dx of [-0.2, 0.2]) { const m = mesh(new THREE.PlaneGeometry(0.28, 1.0), new THREE.MeshBasicMaterial({ map: s, color: '#fff0cf' }), lx + dx * 1.07, 0.19 + 0.2 + 0.55, lz, false); m.rotation.y = dx > 0 ? PI / 2 : -PI / 2; }
    mesh(new THREE.PlaneGeometry(1.5, 2.0), additive(glowT, '#ffd9a0', 0.22), lx, 1.25, lz + 0.3, false);
  }
  {
    const board = chalk(256, 320, [['本日のおすすめ', 44, 28, 'serif', '#f0c987'], ['生姜焼き定食', 108, 32], ['¥850', 150, 26, 'sans-serif', '#c7d0a0'], ['ごはん おかわり自由', 214, 22], ['みそ汁 · 小鉢つき', 258, 22, 'sans-serif', '#c7d0a0']]);
    const g = new THREE.Group(); g.position.set(1.45, 0.25, 0.45); g.rotation.y = -0.2; K.setRoot(g);
    for (const s of [-1, 1]) { const p = new THREE.Group(); p.rotation.x = -s * 0.2; g.add(p);
      box(0, 0.47, s * 0.2, 0.46, 0.9, 0.025, timberL, true, p); mesh(new THREE.PlaneGeometry(0.38, 0.62), new THREE.MeshBasicMaterial({ map: board, color: '#c9c3b6' }), 0, 0.54, s * 0.2 + s * 0.015, false, p).rotation.y = s > 0 ? 0 : PI; }
    group('dinerFrontE').add(g);
  }
  pot(2.95, 0.19, 0.35, 0.15, 6, 1.5, '#7d6a5a'); pot(3.15, 0.19, 0.75, 0.12, 5, 1.2, '#8f9aa0');
  group('dinerSideW');
  pot(X0 - 0.3, 0.19, -1.9, 0.14, 5, 1.2); pot(X0 - 0.3, 0.19, -2.35, 0.11, 4, 1, '#8f9aa0'); pot(X0 - 0.3, 0.19, -2.85, 0.13, 5, 1.4, '#7d6a5a');
  group('dinerSideE');
  // AC outdoor unit on a stand under the east window, gas cylinder with its hose at the rear.
  box(3.0, 0.19 + 0.05, -3.4, 0.4, 0.1, 0.84, '#7f8b93');
  box(3.0, 0.19 + 0.42, -3.4, 0.36, 0.64, 0.8, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), 3.183, 0.64, -3.3, false).rotation.y = PI / 2;
  for (let i = 0; i < 4; i++) box(3.185, 0.55 + i * 0.08, -3.3, 0.01, 0.012, 0.38, '#9aa6ab', false);
  box(2.7, 1.35, -3.9, 0.1, 1.4, 0.1, '#e1ddd2');
  cyl(3.02, 0.19 + 0.45, -4.5, 0.2, 0.9, '#aeb5b8'); mesh(new THREE.SphereGeometry(0.2, 12, 6, 0, PI * 2, 0, PI / 2), mat('#aeb5b8'), 3.02, 0.19 + 0.9, -4.5); cyl(3.02, 0.19 + 1.0, -4.5, 0.05, 0.1, '#59656d');
  line([[3.02, 1.2, -4.5], [2.85, 1.35, -4.5], [2.72, 1.0, -4.45], [2.66, 0.6, -4.4]], '#3d4a58', 0.014);
  group('dinerRear');
  // Back-door step with a scraper mat, beer crates and a bucket beside the door.
  box(0.7, 0.19 + 0.015, Z1 - 0.3, 0.6, 0.03, 0.34, '#5d5248', false);
  for (let i = 0; i < 3; i++) box(-0.45, 0.19 + 0.15 + i * 0.3, Z1 - 0.28, 0.4, 0.28, 0.3, i % 2 ? '#c3463a' : '#a8342e');
  box(1.35, 0.19 + 0.15, Z1 - 0.27, 0.34, 0.3, 0.3, '#4f7290');
  group('dinerService');
  // Fenced bin yard at the rear east: board fence, sorted bins, a grease can.
  {
    const x0 = 1.55, x1 = 3.1, z0 = Z1 - 0.1, z1 = Z1 - 0.8, h = 1.2;
    for (let i = 0; i <= 9; i++) box(x0 + i * (x1 - x0) / 9, 0.19 + h / 2, z1, 0.12, h, 0.025, '#6f5240');
    for (let i = 0; i <= 3; i++) box(x1, 0.19 + h / 2, z1 + i * (z0 - z1) / 3, 0.025, h, 0.12, '#6f5240');
    for (const y of [0.4, 1.1]) { box((x0 + x1) / 2, y, z1 + 0.02, x1 - x0, 0.06, 0.03, timber); box(x1 - 0.02, y, (z0 + z1) / 2, 0.03, 0.06, z0 - z1, timber); }
    for (const [x, c] of [[1.85, '#5f8a74'], [2.35, '#4f7290'], [2.8, '#8f6a4a']]) { box(x, 0.19 + 0.33, z1 + 0.32, 0.38, 0.66, 0.4, c); box(x, 0.19 + 0.68, z1 + 0.32, 0.42, 0.05, 0.44, c); }
    cyl(1.65, 0.19 + 0.2, z0 - 0.2, 0.14, 0.4, '#6a747a');
  }
  group('dinerGround');
  const paveMat = warm('#ffffff', 0, pavers);
  const pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-3.5, 3.5, 0, 1.0); pave(-3.3, 0.9, -6.1, -5.2); pave(-3.5, -2.7, -5.2, 0);
  box(0, 0.214, 0.55, 1.4, 0.014, 0.6, '#5d5248', false); box(0, 0.222, 0.55, 1.22, 0.004, 0.46, '#7a6a58', false);
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(1.6, 1.0, (FW[0] + FW[1]) / 2, 0.208, 0.85, [0, -1], spill); decal(1.5, 1.0, 0, 0.226, 0.9, [0, -1], spill); decal(0.9, 1.0, (FE[0] + FE[1]) / 2, 0.208, 0.8, [0, -1], spill);
  decal(1.4, 0.8, X0 - 0.45, 0.2, (WL[0] + WL[1]) / 2, [1, 0], additive(spillT, '#ffbf7a', 0.14)); decal(1.4, 0.8, X1 + 0.45, 0.2, (ER[0] + ER[1]) / 2, [-1, 0], additive(spillT, '#ffbf7a', 0.14));
  decal(1.2, 0.9, (BD[0] + BD[1]) / 2, 0.208, Z1 - 0.45, [0, 1], additive(glowT, '#ffc27e', 0.2));

  // ================= local animation: stove steam, flue steam, swaying noren, breathing lantern glow =================
  const fx = new THREE.Group(); fx.userData.live = true; group('diner').add(fx); K.setRoot(fx);
  // Noren: three red panels with slits, hanging in front of the door head; pivot at the rod, a very slow sway.
  const norenT = canvasTex(512, 224, (q, w, h) => { q.fillStyle = '#9c2f2c'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '60,10,10' : '230,180,150'},${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 6 + rnd() * 30); }
    q.fillStyle = '#f3e6c8'; q.font = 'bold 150px serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('食 堂', w / 2, h / 2 + 8);
    q.fillStyle = '#6b1f1e'; q.fillRect(0, 0, w, 14); q.fillRect(0, h - 10, w, 10); });
  const norenPiv = [];
  for (let k = 0; k < 3; k++) {
    const piv = new THREE.Group(); piv.position.set(-0.6 + k * 0.6, 2.18, 0.07); fx.add(piv);
    const g = new THREE.PlaneGeometry(0.56, 0.6), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, (k + uv.getX(i) * 0.94 + 0.03) / 3);
    const p = new THREE.Mesh(g, new THREE.MeshToonMaterial({ map: norenT, gradientMap: K.ramp, side: THREE.DoubleSide, emissive: new THREE.Color('#5a1a14'), emissiveMap: norenT })); p.position.y = -0.3; piv.add(p); norenPiv.push(piv);
  }
  const rodN = mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.84, 6), mat('#3a3330'), 0, 2.19, 0.065, false); rodN.rotation.z = PI / 2;
  // Steam: soft sprites rising from the stock pot and the flue cap, drifting a little and fading.
  // The sprites live in an unregistered root placed like the building (rec.transform), so their motion never changes the measured bounds.
  const steam = new THREE.Group(); steam.name = 'dinerSteam'; steam.userData.live = true; steam.position.set(rec.transform.x, 0, rec.transform.z); steam.rotation.y = rec.transform.rotY; group('diner').parent.add(steam);
  const steamM = (o) => new THREE.SpriteMaterial({ map: glowT, color: '#e8f0f2', transparent: true, opacity: o, depthWrite: false });
  const wisps = [];
  const wisp = (x, y0, y1, z, size, spd, o, drift) => { const m = steamM(0); const s = new THREE.Sprite(m); s.position.set(x, y0, z); steam.add(s); wisps.push({ s, m, x, y0, y1, z, size, spd, o, drift, ph: rnd() }); };
  for (let i = 0; i < 5; i++) wisp(-2.15, F + 1.3, F + 1.8, -4.8, 0.28, 0.18, 0.5, 0.05);
  for (let i = 0; i < 6; i++) wisp(-1.95, 4.9, 5.9, Z1 - 0.6, 0.4, 0.22, 0.55, 0.12);
  // Lantern glow breathes slowly (additive plane near the standing sign).
  const lampGlow = additive(glowT, '#ffd9a0', 0.2); mesh(new THREE.PlaneGeometry(1.3, 1.4), lampGlow, 2.2, 1.0, 0.8, false, fx);
  // Rain runs on the front glass and drips from the awning edge.
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6);
  for (const [w, n] of [[FE, 5], [FW, 8]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 0.8, 0.52, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 14; i++) drips.add(-2.8 + i * 0.4 + rnd() * 0.12, 0.25 + rnd() * 1.9, 0.79, 0.09, 0.25, 2.2, 2.1 + rnd() * 0.5);
  runs.seal(); drips.seal();
  // Reflection of the lit shopfront in the wet paving (static geometry sits in the ground group; only the material moves).
  const refT = tex(256, 64, (q, w, h) => { q.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = rnd() * w, ww = 2 + rnd() * 8, g = q.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(255,220,160,${0.4 + rnd() * 0.5})`); g.addColorStop(1, 'rgba(255,220,160,0)'); q.fillStyle = g; q.fillRect(x, 0, ww, h * (0.5 + rnd() * 0.5)); } });
  const refM = new THREE.MeshBasicMaterial({ map: refT, color: '#ffd8a0', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 });
  group('dinerGround'); decal(4.6, 1.0, 0, 0.209, 1.3, [0, -1], refM); group('diner');
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt);
      norenPiv.forEach((p, i) => { p.rotation.x = 0.04 * Math.sin(t * 0.9 + i * 0.8) + 0.015 * Math.sin(t * 2.3 + i); });
      for (const w of wisps) { const k = (t * w.spd + w.ph) % 1; w.s.position.set(w.x + Math.sin(k * 5 + w.ph * 6) * w.drift * k, w.y0 + (w.y1 - w.y0) * k, w.z); w.s.scale.setScalar(w.size * (0.5 + k)); w.m.opacity = w.o * Math.sin(k * PI) * 0.7; }
      lampGlow.opacity = 0.18 + 0.05 * Math.sin(t * 0.8) * Math.sin(t * 0.31);
      refT.offset.x = 0.012 * Math.sin(t * 0.6); refM.opacity = 0.15 + 0.05 * Math.sin(t * 0.9) * Math.sin(t * 0.37);
    },
  };
};
