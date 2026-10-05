// B06-P01 ひなた薬局 (Hinata Pharmacy): a three-storey shop-house, pharmacy below, two flats above.
// Task card docs/buildings/tasks/B06-P01.md, reference docs/buildings/references/B06-P01.jpg. Same shop-house plan as B04-P05
// (shop left of the front, residents' door right, U-stair, balconies, hip roof, bicycle shelter on the west side), narrowed to fit
// the 8.5-wide envelope (door x = 11 sits 4.0 from the west limit), green awning with a white cross, pharmacy interior.
// Local frame (placed by layout.js `buildings`, rotY π): front +z faces the north street, local +x = world W, door (shop) at the origin.
// Body 6.6 × 4.7: x -4.2…2.4, z -4.7…0 (roof edges to x -4.45 / 2.65 and z +0.25 / -4.95; awning to +0.85, balconies to +0.95).
// Groups: pharmacy (shell, storeys, stairs, roof, balconies, awning, sign, bicycle shelter) · pharmacyFrontW · pharmacyFrontE · pharmacyRear · pharmacyGround.
// Layers: f2 / f3 (upper storeys), roof. Plan, ground: OTC gondolas, spinner rack and waiting chairs near the window, till and chilled case,
// prescription counter with acrylic screen, drawer cabinet and staff desk at the back; resident lobby with U-stair (flight A towards the back
// to the 1st-floor landing, flight B back to the front for the 2nd floor). Upper floors: living-kitchen-dining, bedroom.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B06-P01'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(4405), PI = Math.PI;
  const F = rec.floor, F2 = F + 2.8, F3 = F2 + 2.8, EF = F3 + 2.7, X0 = -4.15, X1 = 2.4, Z0 = 0, Z1 = -4.7, T = 0.15, BASE = 0.19, SLAB = 0.2;
  const CEIL1 = F2 - SLAB, CEIL2 = F3 - SLAB, CEIL3 = EF - 0.12, SL = 0.5, OV = 0.25, PX = 0.7;   // PX: partition between the shop/flats and the stair hall
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T, FX1 = PX - 0.05;
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FW = [-3.85, -0.75, 0.75, 2.4], FD = [-0.5, 0.5, F, 2.35], RD = [1.0, 1.9, F, 2.3];
  const A2 = [-3.8, -0.6, F2 + 0.15, F2 + 2.05], A3 = [-3.8, -0.6, F3 + 0.15, F3 + 2.05], S2 = [1.2, 1.8, F2 + 0.85, F2 + 1.9], S3 = [1.2, 1.8, F3 + 0.85, F3 + 1.9];
  const BD = [-3.1, -2.2, F, 2.25], RWg = [-1.4, -0.4, 1.3, 2.2], RHg = [1.45, 2.05, 1.4, 2.3];
  const rear = fl => [[-3.5, -2.7, fl + 0.95, fl + 1.95], [-1.6, -0.4, fl + 0.9, fl + 1.95], [1.45, 2.05, fl + 0.95, fl + 1.95]];
  const east = fl => [[-3.4, -2.6, fl + 0.95, fl + 1.95], [-1.6, -0.7, fl + 0.95, fl + 1.95]];
  const EWg = [-3.5, -1.6, 1.0, 2.2], WWg = [-2.6, -2.1, 1.5, 2.3], west = fl => [[-3.1, -2.4, fl + 0.8, fl + 1.9]];
  const DP2 = [-4.45, -3.75, F2, F2 + 2.05], DP3 = [-0.95, -0.15, F3, F3 + 2.05];   // flat doors through the partition

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#cfcdc6'), timber = '#5a4030', timberL = '#a97a4e', slat = '#b98a58', stoneC = '#9a958b', alu = '#4d5a60', trim = '#5b6168';
  const wcache = {}, W = (c, k = 0.3) => wcache[c + k] || (wcache[c + k] = warm(c, k));
  const wood = W('#b0814f'), woodD = W('#6f4a35', 0.26), cream = W('#efe4cc', 0.34), steel = W('#c3cacb', 0.22);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' });
  const slateT = tex(128, 128, (q, w, h) => { q.fillStyle = '#434c5a'; q.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) { const g = q.createLinearGradient(0, r * 16, 0, r * 16 + 16); g.addColorStop(0, '#363f4b'); g.addColorStop(0.6, '#515b6a'); g.addColorStop(1, '#323a45'); q.fillStyle = g; q.fillRect(0, r * 16, w, 16);
      q.fillStyle = 'rgba(12,16,24,.6)'; q.fillRect(0, r * 16, w, 2); for (let c = 0; c < 4; c++) q.fillRect(c * 32 + (r % 2) * 16, r * 16, 1.5, 16); }
    for (let i = 0; i < 500; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '8,12,18' : '190,205,225'},${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 2, 1); } });
  slateT.repeat.set(2, 2);
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: slateT });
  const planks = tex(256, 256, (q, w, h) => { for (let r = 0; r < 8; r++) { q.fillStyle = `hsl(${30 + rnd() * 6},${34 + rnd() * 10}%,${52 + rnd() * 8}%)`; q.fillRect(0, r * 32, w, 32);
    q.fillStyle = 'rgba(70,44,28,.5)'; q.fillRect(0, r * 32, w, 1.5); q.fillRect(rnd() * 200 + 28, r * 32, 1.5, 32); } });
  const tatami = tex(128, 128, (q, w, h) => { q.fillStyle = '#c9c18f'; q.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '90,100,50' : '240,236,190'},.1)`; q.fillRect(0, i * 8, w, 4); }
    q.strokeStyle = 'rgba(60,70,30,.5)'; q.lineWidth = 2; q.strokeRect(1, 1, w - 2, h - 2); });
  const pavers = tex(256, 256, (q, w, h) => { q.fillStyle = '#a2a095'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
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
  const board = (w, h, lines, bg = '#2f3a36') => canvasTex(w, h, (q, W2, H2) => { q.fillStyle = bg; q.fillRect(0, 0, W2, H2); q.textAlign = 'center'; q.textBaseline = 'middle';
    for (const [t, y, size, font = 'sans-serif', col] of lines) { q.fillStyle = col || '#efe9da'; q.font = `bold ${size}px ${font}`; q.fillText(t, W2 / 2, y); } });
  const lit = (map, em = '#2a2e2a') => new THREE.MeshToonMaterial({ map, gradientMap: K.ramp, emissive: em, emissiveMap: map });

  // ---- plants ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), LEAF = ['#6c9476', '#88a98a', '#5e8a6a'];
  const shrub = (x, y, z, r, n, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(LEAF[i % 3]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.35 + rnd() * r * h, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.45 + rnd() * 0.25)); } };
  const pot = (x, y, z, r, n = 5, h = 1, c = '#9b7d68') => { mesh(new THREE.CylinderGeometry(r, r * 0.76, r * 1.15, 10), mat(c), x, y + r * 0.575, z); shrub(x, y + r * 1.1, z, r, n, h); };

  // ================= ground-floor shell =================
  group('pharmacy');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, F2], [FW, FD, RD], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, F2], [BD, RWg, RHg], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, F2], [WWg], plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, F2], [EWg], plaster);
  wall('z', PX, 0.1, [IZ1, IZ0, BASE, F2], [], plaster);   // shop / stair hall partition
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FD[0], Z0, 1); plinth('x', FD[1], RD[0], Z0, 1); plinth('x', RD[1], X1, Z0, 1); plinth('x', X0, BD[0], Z1, -1); plinth('x', BD[1], X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  // Floor bands (slab edges) and corner posts.
  for (const fl of [F2, F3]) { box((X0 + X1) / 2, fl - 0.1, 0.012, X1 - X0 + 0.06, 0.2, 0.04, '#aaa69a'); box((X0 + X1) / 2, fl - 0.1, Z1 - 0.012, X1 - X0 + 0.06, 0.2, 0.04, '#aaa69a');
    for (const [x, o] of [[X0, -1], [X1, 1]]) box(x + o * 0.012, fl - 0.1, (Z0 + Z1) / 2, 0.04, 0.2, Z0 - Z1 + 0.06, '#aaa69a'); }
  for (const [x, z] of [[X0 + 0.05, Z0 - 0.05], [X1 - 0.05, Z0 - 0.05], [X0 + 0.05, Z1 + 0.05], [X1 - 0.05, Z1 + 0.05]]) box(x, (BASE + EF) / 2, z, 0.12, EF - BASE, 0.12, '#a8a498');
  // Ground floor: boards under the shop, tile in the lobby; ceiling lining.
  mesh(tileUV(new THREE.BoxGeometry(PX - 0.05 - IX0, F - BASE, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.2, planks), (IX0 + PX - 0.05) / 2, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  mesh(tileUV(new THREE.BoxGeometry(IX1 - PX - 0.05, F - BASE, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.1, pavers), (PX + 0.05 + IX1) / 2, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL1], [FW, FD, RD], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL1], [WWg], cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL1], [EWg], cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL1], [BD, RWg, RHg], cream);
  box(0, F + 0.45, IZ1 + 0.01, FX1 - IX0, 0.9, 0.012, W('#d9d2bd', 0.3), false);   // low wainscot

  // ---- glazing: dark aluminium frames ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = [], lattice = 0, sill = true) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, alu); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, alu);
    ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, alu); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, alu);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.045, q - p, fd * 0.9, alu);
    for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.04, fd * 0.9, alu);
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    if (lattice) { const d = at + out * 0.1, n = Math.round((b - a) / lattice); for (let i = 0; i <= n; i++) ab(axis, a + 0.02 + i * (b - a - 0.04) / n, (p + q) / 2, d, 0.04, q - p + 0.1, 0.05, slat); }
    if (sill && p > F + 0.05) ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.1, 0.05, 0.15, '#a8a091');
  }
  glaze('x', -T / 2, 1, FW, [-2.7, -1.7], [1.6], 0, false);
  glaze('z', X0 + T / 2, -1, EWg, [-2.55]); glaze('z', X1 - T / 2, 1, WWg);
  glaze('x', Z1 + T / 2, -1, RWg); glaze('x', Z1 + T / 2, -1, RHg);
  // Shop door: glass door in a dark frame with push bars, "OPEN" card; residents' door: wooden panel door with a fanlight-less frame.
  {
    ab('x', FD[0] + 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, alu); ab('x', FD[1] - 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, alu); box(0, FD[3] - 0.04, -T / 2, FD[1] - FD[0], 0.08, 0.16, alu);
    const z = -0.05, top = FD[3] - 0.08;
    for (const x of [-0.46, -0.02, 0.02, 0.46]) box(x, (F + top) / 2, z, 0.06, top - F, 0.045, alu);
    box(0, top - 0.04, z, 0.96, 0.08, 0.045, alu); box(0, F + 0.35, z, 0.96, 0.1, 0.045, alu);
    box(0, (F + 0.4 + top - 0.08) / 2, z, 0.9, top - 0.08 - F - 0.4, 0.012, glass, false);
    for (const x of [-0.14, 0.14]) box(x, 1.1, z + 0.03, 0.03, 0.7, 0.03, '#c9c9c0');
    box(-0.28, 1.45, z + 0.012, 0.16, 0.1, 0.006, '#c9402f', false);
    ab('x', RD[0] + 0.04, (F + RD[3]) / 2, -T / 2, 0.08, RD[3] - F, 0.16, timber); ab('x', RD[1] - 0.04, (F + RD[3]) / 2, -T / 2, 0.08, RD[3] - F, 0.16, timber); box(1.7, RD[3] - 0.04, -T / 2, 1.0, 0.08, 0.16, timber);
    box(1.45, (F + RD[3] - 0.08) / 2, -0.04, 0.84, RD[3] - 0.08 - F, 0.05, '#6a4a34');
    for (let i = 0; i < 3; i++) box(1.45, F + 0.5 + i * 0.6, -0.012, 0.6, 0.38, 0.012, '#7d5a40', false);
    box(1.2, 1.1, 0.0, 0.03, 0.16, 0.05, '#c9c9c0'); box(1.8, 2.05, 0.03, 0.16, 0.1, 0.03, '#8a98a0');
  }
  // Entrance platforms: shop door and resident door, one low step each (flush threshold at the door).
  box(0, 0.255, 0.38, 1.7, 0.1, 0.76, '#a8a091'); box(0, 0.21, 0.74, 1.7, 0.04, 0.2, '#8e8a80');
  for (let i = 0; i < 4; i++) box(-0.6 + i * 0.4, 0.31, 0.74, 0.28, 0.006, 0.12, '#d6b13c', false);
  box(1.45, 0.255, 0.32, 1.2, 0.1, 0.64, '#a8a091'); box(1.45, 0.21, 0.62, 1.2, 0.04, 0.16, '#8e8a80');

  // ---- shop awning (navy canvas) with name on the valance ----
  {
    const x0 = X0 - 0.05, x1 = FX1 + 0.05, dep = 0.85, hi = 2.78, lo = 2.5, len = Math.hypot(dep, hi - lo);
    const cvs = tex(64, 64, (q, w, h) => { q.fillStyle = '#1f5a48'; q.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { q.fillStyle = 'rgba(255,255,255,.05)'; q.fillRect(i * 8, 0, 4, h); } });
    cvs.repeat.set(6, 1);
    const e = box((x0 + x1) / 2, (hi + lo) / 2 + 0.01, dep / 2, x1 - x0, 0.04, len, new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: cvs })); e.rotation.x = Math.atan2(hi - lo, dep);
    for (const x of [x0 + 0.04, x1 - 0.04]) { rod([x, hi, 0.03], [x, lo, dep - 0.04], 0.015, '#3d4a58'); }
    box((x0 + x1) / 2, hi, 0.03, x1 - x0, 0.04, 0.05, '#3d4a58');
    const s = canvasTex(512, 96, (q, w, h) => { q.fillStyle = '#1f5a48'; q.fillRect(0, 0, w, h); q.fillStyle = '#f2f0e4'; q.fillRect(26, 22, 52, 14); q.fillRect(45, 3, 14, 52); q.fillRect(26, 22, 52, 14);
      q.font = 'bold 50px serif'; q.textAlign = 'left'; q.textBaseline = 'middle'; q.fillText('ひなた薬局', 96, h / 2 - 4); q.font = 'bold 22px sans-serif'; q.textAlign = 'right'; q.fillText('処方せん受付', w - 18, h / 2 + 22); });
    mesh(new THREE.PlaneGeometry(x1 - x0 - 0.1, 0.27), new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, emissive: '#10302a', emissiveMap: s }), (x0 + x1) / 2, lo - 0.1, dep + 0.002, false);
    box((x0 + x1) / 2, lo - 0.1, dep - 0.012, x1 - x0, 0.3, 0.025, '#1f5a48');
  }
  for (const x of [-0.4, 0.4]) { box(x + 0.0, 2.4, 0.07, 0.12, 0.16, 0.1, '#3d4a58'); box(x, 2.39, 0.07, 0.09, 0.12, 0.105, bulb, false); }
  // Resident door lamp and house number plate; mailbox cluster is in pharmacyFrontE.
  box(1.45, 2.42, 0.07, 0.16, 0.14, 0.1, '#3d4a58'); box(1.45, 2.41, 0.07, 0.12, 0.1, 0.105, bulb, false);
  mesh(new THREE.PlaneGeometry(1.0, 1.0), additive(glowT, '#ffc27e', 0.25), 1.45, 2.4, 0.04, false); mesh(new THREE.PlaneGeometry(1.0, 1.0), additive(glowT, '#ffc27e', 0.22), 0, 2.4, 0.04, false);
  // Shop back door: steel, pent canopy, step, lamp.
  ab('x', BD[0] + 0.04, (F + BD[3]) / 2, Z1 + T / 2, 0.08, BD[3] - F, 0.16, timber); ab('x', BD[1] - 0.04, (F + BD[3]) / 2, Z1 + T / 2, 0.08, BD[3] - F, 0.16, timber); box((BD[0] + BD[1]) / 2, BD[3] - 0.04, Z1 + T / 2, BD[1] - BD[0], 0.08, 0.16, timber);
  box((BD[0] + BD[1]) / 2, (F + BD[3] - 0.08) / 2, Z1 + 0.06, BD[1] - BD[0] - 0.14, BD[3] - 0.08 - F, 0.04, '#5b4a3e');
  box((BD[0] + BD[1]) / 2, 1.8, Z1 + 0.035, 0.34, 0.5, 0.012, '#8a98a0', false); box(BD[0] + 0.14, 1.1, Z1 + 0.02, 0.03, 0.16, 0.04, '#c9c9c0');
  shapeMesh([[0, BASE], [0.3, BASE], [0.3, 0.3], [0, 0.3]], BD[1] - BD[0] + 0.1, '#a8a091', BD[0] - 0.05, 0, Z1, PI / 2);
  { const e = box((BD[0] + BD[1]) / 2, 2.52, Z1 - 0.22, 1.1, 0.05, 0.46, trim); e.rotation.x = -0.26; }
  box(BD[1] + 0.3, 1.95, Z1 - 0.06, 0.12, 0.17, 0.1, '#3d4a58'); box(BD[1] + 0.3, 1.94, Z1 - 0.06, 0.09, 0.12, 0.105, bulb, false);
  mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.26), BD[1] + 0.3, 1.95, Z1 - 0.004, false).rotation.y = PI;

  // ---- balconies (floors 2 and 3), timber railings with planters ----
  for (const fl of [F2, F3]) {
    const bx0 = X0 - 0.05, bx1 = PX + 0.05, bz = 0.95, rz = bz - 0.04, cx = (bx0 + bx1) / 2;
    box(cx, fl - 0.1, bz / 2, bx1 - bx0, 0.2, bz, '#b4b0a4'); box(cx, fl - 0.03, bz - 0.01, bx1 - bx0, 0.04, 0.03, '#8e8a80', false);
    for (let i = 0; i <= 6; i++) box(bx0 + 0.04 + i * (bx1 - bx0 - 0.08) / 6, fl + 0.52, rz, 0.06, 1.04, 0.06, timber);
    box(cx, fl + 1.06, rz, bx1 - bx0, 0.06, 0.1, timberL);
    for (let k = 0; k < 4; k++) box(cx, fl + 0.18 + k * 0.22, rz, bx1 - bx0 - 0.1, 0.07, 0.03, slat);
    for (const x of [bx0 + 0.04, bx1 - 0.04]) { box(x, fl + 1.06, bz / 2, 0.06, 0.06, bz, timberL); for (let k = 0; k < 4; k++) box(x, fl + 0.18 + k * 0.22, bz / 2, 0.03, 0.07, bz - 0.1, slat); box(x, fl + 0.52, 0.04, 0.06, 1.04, 0.06, timber); }
    // planters on the rail and a laundry pole bracket
    for (const x of [-3.55, -2.5, -0.9]) { box(x, fl + 1.16, rz, 0.5, 0.14, 0.2, '#7d6a5a'); shrub(x, fl + 1.2, rz, 0.17, 5, 1.3); }
    rod([bx0 + 0.04, fl + 1.85, 0.5], [bx1 - 0.04, fl + 1.85, 0.5], 0.018, '#8a98a0');
    for (const x of [bx0 + 0.04, bx1 - 0.04]) rod([x, fl + 1.85, 0.5], [x, fl + 1.2, 0.5], 0.014, '#8a98a0');
    // drip lip under the slab and sliding door sill
    box(cx, fl - 0.21, bz - 0.02, bx1 - bx0, 0.03, 0.04, '#6c7078', false);
  }

  // ================= upper storeys =================
  const stairX = { A: 1.12, B: 1.9 }, rise = (F2 - F) / 14, run = 0.19, ZS = -1.0, ZL = ZS - 14 * run;   // ZL: flight head / landing edge (-3.66)
  const upperWalls = (fl, top, ceil, name, frontOps, rearOps, eastOps, westOps, doorH) => {
    const layer = new THREE.Group(); layer.userData.layer = name; group('pharmacy').add(layer); K.setRoot(layer);
    wall('x', Z0 - T / 2, T, [X0, X1, fl, top], frontOps, plaster); wall('x', Z1 + T / 2, T, [X0, X1, fl, top], rearOps, plaster);
    wall('z', X1 - T / 2, T, [IZ1, IZ0, fl, top], westOps, plaster); wall('z', X0 + T / 2, T, [IZ1, IZ0, fl, top], eastOps, plaster);
    wall('z', PX, 0.1, [IZ1, IZ0, fl, top], [doorH], plaster);
    panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, fl, ceil], frontOps, cream); panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, fl, ceil], rearOps, cream);
    panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, fl, ceil], westOps, cream); panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, fl, ceil], eastOps, cream);
    panel('z', PX - 0.056, 0.012, [IZ1, IZ0, fl, ceil], [doorH], cream);
    return layer;
  };
  // Slab pieces [x0, x1, z0, z1] at floor level fl (top surface), thickness SLAB; planks on the flat side, tatami strip in the living room.
  const slab = (fl, rects, layer) => { for (const [a, b, c, d] of rects) box((a + b) / 2, fl - SLAB / 2, (c + d) / 2, b - a, SLAB, d - c, '#c9c1b0', true, layer); };
  // ---------- floor 2 ----------
  const f2Layer = upperWalls(F2, F3, CEIL2 - 0.0, 'f2', [A2, S2], rear(F2), east(F2), west(F2), DP2);
  slab(F2, [[IX0, FX1, IZ1, IZ0], [FX1, IX1, ZS, IZ0], [FX1, IX1, IZ1, ZL], [1.51, IX1, ZL, ZS]], f2Layer);   // opening over lane A only
  mesh(tileUV(new THREE.BoxGeometry(FX1 - IX0, 0.012, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.22, planks), (IX0 + FX1) / 2, F2 + 0.006, (IZ0 + IZ1) / 2, false, f2Layer);
  mesh(tileUV(new THREE.BoxGeometry(IX1 - PX, 0.012, IZ0 - ZS), 2, 1), warm('#ffffff', 0.12, pavers), (PX + IX1) / 2, F2 + 0.006, (ZS + IZ0) / 2, false, f2Layer);
  box((IX0 + FX1) / 2, CEIL1 - 0.01, (IZ0 + IZ1) / 2, FX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false, f2Layer);
  glaze('x', -T / 2, 1, A2, [-2.1, -1.1], [], 0, false); glaze('x', -T / 2, 1, S2, [], [], 0.1);
  { const g = glaze; K.setRoot(f2Layer); const r = rear(F2); g('x', Z1 + T / 2, -1, r[0]); g('x', Z1 + T / 2, -1, r[1], [-1.0]); g('x', Z1 + T / 2, -1, r[2], [], [], 0.1);
    const e = east(F2); g('z', X0 + T / 2, -1, e[0]); g('z', X0 + T / 2, -1, e[1]); g('z', X1 - T / 2, 1, west(F2)[0], [], [], 0.1); }
  // ---------- floor 3 ----------
  K.setRoot(group('pharmacy'));
  const f3Layer = upperWalls(F3, EF, CEIL3, 'f3', [A3, S3], rear(F3), east(F3), west(F3), DP3);
  slab(F3, [[IX0, FX1, IZ1, IZ0], [FX1, 1.51, IZ1, IZ0], [1.51, IX1, IZ1, ZL], [1.51, IX1, ZS, IZ0]], f3Layer);
  mesh(tileUV(new THREE.BoxGeometry(FX1 - IX0, 0.012, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.22, planks), (IX0 + FX1) / 2, F3 + 0.006, (IZ0 + IZ1) / 2, false, f3Layer);
  box((IX0 + FX1) / 2, CEIL2 - 0.01, (IZ0 + IZ1) / 2, FX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false, f3Layer);
  box((PX + IX1) / 2, CEIL2 - 0.01, (IZ0 + IZ1) / 2, IX1 - PX, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false, f3Layer);
  K.setRoot(f3Layer);
  glaze('x', -T / 2, 1, A3, [-2.1, -1.1], [], 0, false); glaze('x', -T / 2, 1, S3, [], [], 0.1);
  { const r = rear(F3); glaze('x', Z1 + T / 2, -1, r[0]); glaze('x', Z1 + T / 2, -1, r[1], [-1.0]); glaze('x', Z1 + T / 2, -1, r[2], [], [], 0.1);
    const e = east(F3); glaze('z', X0 + T / 2, -1, e[0]); glaze('z', X0 + T / 2, -1, e[1]); glaze('z', X1 - T / 2, 1, west(F3)[0], [], [], 0.1); }
  // Third-floor ceiling is the roof layer's; stair hall top lining.
  // ---------- stair: two flights (A rises towards the back to the 1st-floor landing, B returns to the front) ----------
  K.setRoot(group('pharmacy'));
  const stairMat = W('#b9946a', 0.26);
  const flight = (xc, base, dir, layer) => {   // dir -1: steps proceed towards -z from ZS; +1: towards +z from ZL
    for (let i = 0; i < 14; i++) { const top = base + (i + 1) * rise, z = dir < 0 ? ZS - i * run - run / 2 : ZL + i * run + run / 2;
      box(xc, top - 0.02, z, 0.7, 0.04, run + 0.02, stairMat, true, layer); box(xc, top - rise / 2, z - dir * run / 2, 0.7, rise, 0.02, woodD, false, layer); }
    const a = Math.atan2(rise, run), l = Math.hypot(14 * run, 14 * rise);
    for (const dx of [-0.34, 0.34]) { const s = box(xc + dx, base + 14 * rise / 2 - 0.02, (ZS + ZL) / 2, 0.04, 0.16, l, woodD, true, layer); s.rotation.x = dir < 0 ? a : -a; }
  };
  flight(stairX.A, F, -1, undefined); K.setRoot(f2Layer); flight(stairX.B, F2, 1, f2Layer);
  K.setRoot(group('pharmacy'));
  // Handrail on the wall side of each flight plus guard rails at the openings.
  rod([PX + 0.07, F + 0.9, ZS], [PX + 0.07, F2 + 0.9, ZL], 0.02, '#3d4a58');
  K.setRoot(f2Layer); rod([IX1 - 0.02, F2 + 0.9, ZL], [IX1 - 0.02, F3 + 0.9, ZS], 0.02, '#3d4a58');
  for (const z of [ZS - 0.1, (ZS + ZL) / 2, ZL + 0.1]) box(1.51, F2 + 0.5, z, 0.03, 1.0, 0.03, '#3d4a58'); box(1.51, F2 + 1.0, (ZS + ZL) / 2, 0.04, 0.04, ZS - ZL, '#3d4a58');
  K.setRoot(f3Layer); for (const z of [ZS - 0.1, (ZS + ZL) / 2, ZL + 0.1]) box(1.51, F3 + 0.5, z, 0.03, 1.0, 0.03, '#3d4a58'); box(1.51, F3 + 1.0, (ZS + ZL) / 2, 0.04, 0.04, ZS - ZL, '#3d4a58');
  // Stair-hall lamps, flat doors, number plates.
  K.setRoot(f2Layer);
  { const dz = (DP2[0] + DP2[1]) / 2; box(PX - 0.06, (F2 + DP2[3]) / 2, dz, 0.06, DP2[3] - F2, DP2[1] - DP2[0], '#7d5a40'); box(PX - 0.1, 1.0 + F2, dz + 0.3, 0.03, 0.04, 0.12, '#c9c9c0'); }
  K.setRoot(f3Layer);
  { const dz = (DP3[0] + DP3[1]) / 2; box(PX - 0.06, (F3 + DP3[3]) / 2, dz, 0.06, DP3[3] - F3, DP3[1] - DP3[0], '#7d5a40'); box(PX - 0.1, 1.0 + F3, dz + 0.3, 0.03, 0.04, 0.12, '#c9c9c0'); }
  for (const [fl, layer] of [[F, undefined], [F2, f2Layer], [F3, f3Layer]]) { K.setRoot(layer || group('pharmacy')); const top = fl === F3 ? CEIL3 : fl === F2 ? CEIL2 : CEIL1;
    box(1.5, top - 0.04, -0.9, 0.3, 0.05, 0.3, '#7d8b88', false); box(1.5, top - 0.07, -0.9, 0.26, 0.02, 0.26, W('#fff4d0', 0.95), false);
    box(1.5, top - 0.04, -3.6, 0.3, 0.05, 0.3, '#7d8b88', false); box(1.5, top - 0.07, -3.6, 0.26, 0.02, 0.26, W('#fff4d0', 0.95), false); }

  // ================= interior: ground-floor pharmacy shop =================
  K.setRoot(group('pharmacy'));
  const bookCols = ['#e8e4d6', '#2a8a68', '#9ad0c8', '#e08a48', '#f0d36a', '#c9402f', '#cfd8e6'];
  // shelf: len along axis ('x' or 'z'), depth, height; faces +/-1 along the perpendicular axis; items: small stacks of paper / notebooks
  const shelf = (axis, cx, cz, len, dep, h, face, y0 = F, layer, rows = 4) => {
    const A = (u, y, d, w, hh, t, c, o = true) => axis === 'x' ? box(cx + u, y, cz + d, w, hh, t, c, o, layer) : box(cx + d, y, cz + u, t, hh, w, c, o, layer);
    A(0, y0 + h / 2, 0, len, h, dep, woodD, false);
    for (let k = 0; k < rows; k++) { const y = y0 + 0.14 + k * (h - 0.2) / rows; A(0, y, face * 0.0, len, 0.025, dep + 0.02, wood);
      const n = Math.floor(len / 0.14); for (let i = 0; i < n; i++) A(-len / 2 + 0.09 + i * (len - 0.14) / Math.max(1, n - 1), y + 0.1, face * dep * 0.14, 0.11, 0.17 + rnd() * 0.04, dep * 0.7, W(bookCols[(i * 3 + k * 2 + (rnd() * 2 | 0)) % bookCols.length], 0.34), false); }
  };
  const table = (x, z, w, d, hgt, layer, base = F, top = wood) => { box(x, base + hgt - 0.02, z, w, 0.04, d, top, true, layer);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(x + dx * (w / 2 - 0.05), base + hgt / 2, z + dz * (d / 2 - 0.05), 0.05, hgt - 0.04, 0.05, woodD, false, layer); };
  const chair = (x, z, face, base = F, c = '#6b8a9a', layer) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + dx * 0.17, base + 0.22, z + dz * 0.17, 0.035, 0.44, 0.035, woodD, false, layer);
    box(x, base + 0.45, z, 0.4, 0.04, 0.4, W(c, 0.3), true, layer); const bx = x - face[0] * 0.19, bz = z - face[1] * 0.19; box(bx, base + 0.68, bz, face[0] ? 0.03 : 0.38, 0.4, face[0] ? 0.38 : 0.03, woodD, true, layer); };
  const pendant = (x, z, y, top, c = '#e0cfa8', layer) => { rod([x, top, z], [x, y + 0.08, z], 0.006, '#3a3330', layer); mesh(new THREE.ConeGeometry(0.13, 0.15, 14, 1, true), W(c, 0.3), x, y + 0.07, z, true, layer); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false, layer); };
  // near layer: OTC gondola behind the window, health-product spinner rack, waiting bench with two small chairs
  {
    shelf('x', -2.3, -0.42, 2.2, 0.24, 1.0, 1, F, undefined, 3);   // window-side display rack (back of window)
    for (const z of [-0.6, -1.2]) chair(-3.55, z, [1, 0], F, '#4f9a6a');
    box(-3.95, F + 0.35, -0.9, 0.04, 0.7, 0.9, W('#e8e4d6', 0.3), false);   // leaflet rack on the east wall
    for (let i = 0; i < 4; i++) box(-3.9, F + 0.5 + i * 0.14, -0.9, 0.05, 0.1, 0.7, W(bookCols[(i + 1) % 7], 0.34), false);
    { const x = -1.2, z = -0.95; cyl(x, F + 0.62, z, 0.03, 1.24, '#59656d'); cyl(x, F + 0.9, z, 0.2, 0.5, W('#e8e2cf', 0.3)); for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; box(x + Math.cos(a) * 0.2, F + 0.9, z + Math.sin(a) * 0.2, 0.06, 0.4, 0.06, W(bookCols[i % 7], 0.34), false); } }
  }
  // middle layer: central OTC island (aisle >= 0.9), till counter by the partition, refrigerated case on the east wall
  {
    shelf('x', -2.0, -2.15, 1.6, 0.5, 1.4, 1, F, undefined, 4);
    box(0.3, F + 0.5, -1.55, 0.4, 1.0, 1.0, W('#e8e4d6', 0.3)); box(0.3, F + 1.02, -1.55, 0.46, 0.05, 1.06, W('#c8d6d2', 0.3));
    box(0.3, F + 1.15, -1.35, 0.24, 0.2, 0.28, W('#2f2a26', 0.1)); cyl(0.3, F + 1.12, -1.8, 0.06, 0.12, W('#4f9a6a', 0.3));
    box(IX0 + 0.25, F + 0.9, -3.3, 0.5, 1.8, 0.9, W('#dfe9e6', 0.3)); box(IX0 + 0.5, F + 0.9, -3.3, 0.02, 1.7, 0.8, W('#bfe0e6', 0.9), false);   // refrigerated case with lit glass door
    for (let k = 0; k < 3; k++) for (let i = 0; i < 5; i++) box(IX0 + 0.5, F + 0.35 + k * 0.5, -3.55 + i * 0.14, 0.02, 0.2, 0.1, W(bookCols[(i + k) % 7], 0.5), false);
    // prescription counter (処方せん受付) with an acrylic screen and a tray
    box(-1.2, F + 0.5, -3.25, 2.4, 1.0, 0.5, woodD); box(-1.2, F + 1.02, -3.25, 2.5, 0.05, 0.58, W('#d8d2c0', 0.3));
    box(-1.2, F + 1.4, -3.0, 2.2, 0.7, 0.02, glass, false); box(-1.2, F + 1.06, -3.0, 2.2, 0.03, 0.03, '#c9c9c0', false);
    box(-0.7, F + 1.08, -3.2, 0.3, 0.06, 0.24, W('#2aa07a', 0.4), false); box(-1.8, F + 1.08, -3.2, 0.3, 0.1, 0.22, W('#f3ead0', 0.4), false);
    box(-1.2, F + 1.7, -3.02, 1.3, 0.22, 0.02, W('#2a8a68', 0.5), false);
  }
  // back layer: locked medicine drawer cabinet along the rear wall, staff desk with a monitor, medicine shelves on the east wall
  {
    box(-0.95, F + 0.9, IZ1 + 0.25, 2.5, 1.8, 0.4, woodD); for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) box(-2.05 + c * 0.24, F + 0.2 + r * 0.28, IZ1 + 0.46, 0.2, 0.22, 0.02, W(bookCols[(r + c) % 7], 0.34), false);
    box(-0.95, F + 1.85, IZ1 + 0.25, 2.5, 0.06, 0.44, '#59656d', false);
    table(-0.3, -4.0, 1.0, 0.5, 0.74, undefined, F, W('#d8d2c0', 0.3)); box(-0.3, F + 0.95, -4.15, 0.4, 0.3, 0.04, W('#2f2a26', 0.1)); chair(-0.3, -3.6, [0, -1], F, '#4f9a6a');
    shelf('z', IX0 + 0.17, -1.0, 1.0, 0.3, 1.9, 1, F, undefined, 5);       // OTC wall shelf by the window
    box(-3.3, F + 0.65, -4.1, 0.6, 1.3, 0.5, W('#c9a06a', 0.3)); for (let i = 0; i < 3; i++) box(-3.3, F + 0.2 + i * 0.4, -3.84, 0.5, 0.3, 0.04, W('#d4ae78', 0.3), false);   // stock cartons by the back door
    pendant(-2.4, -0.9, F + 1.95, CEIL1); pendant(-2.0, -2.15, F + 1.95, CEIL1); pendant(-1.2, -3.6, F + 1.9, CEIL1);
    for (const [x, z, l] of [[-2.3, -1.5, 1.6], [-1.2, -3.8, 1.4]]) { box(x, CEIL1 - 0.04, z, l + 0.04, 0.05, 0.14, '#7d8b88', false); box(x, CEIL1 - 0.075, z, l, 0.02, 0.1, W('#f4fff4', 0.95), false); }
    for (const [x, z, r2] of [[-2.0, -0.9, 1.8], [-1.6, -2.7, 1.8], [-0.8, -3.7, 1.4], [0.0, -1.5, 1.2]]) decal(r2, r2, x, F + 0.003, z, [0, -1], pool);
  }
  // resident lobby: mailboxes by the door, shoe rack, umbrella stand, dim lamp
  {
    box(2.22, 1.2, -0.45, 0.04, 0.5, 0.5, '#8a98a0'); for (let i = 0; i < 6; i++) box(2.19, 1.0 + (i % 3) * 0.16 + 0.1, -0.3 - Math.floor(i / 3) * 0.24, 0.02, 0.12, 0.2, '#cfd2cb', false);
    box(0.9, F + 0.2, -0.45, 0.2, 0.4, 0.4, woodD); cyl(0.98, F + 0.25, -0.8, 0.06, 0.5, W('#4f7290', 0.3));
    decal(1.4, 1.4, 1.5, F + 0.003, -0.6, [0, -1], pool);
  }

  // ================= interior: floor 2 (living-dining-kitchen) =================
  K.setRoot(f2Layer);
  {
    // near layer: dining table and chairs behind the balcony window
    table(-2.1, -1.0, 1.3, 0.8, 0.74, f2Layer, F2, wood);
    for (const [dx, dz, f] of [[-0.55, 0, [1, 0]], [0.55, 0, [-1, 0]]]) chair(-2.1 + dx * 1.3, -1.0 + dz, f, F2, '#c9a86a', f2Layer);
    chair(-2.1, -1.7, [0, 1], F2, '#c9a86a', f2Layer); chair(-2.1, -0.3, [0, -1], F2, '#c9a86a', f2Layer);
    for (const dx of [-0.35, 0.1, 0.45]) cyl(-2.1 + dx, F2 + 0.78, -1.0, 0.07, 0.1, W(dx < 0 ? '#f0e8d4' : '#6aa0c0', 0.34), f2Layer);
    // mid layer: sofa and low table with a rug, TV unit on the east wall
    box(-1.2, F2 + 0.01, -2.7, 1.5, 0.02, 1.0, W('#8a6f6a', 0.28), false, f2Layer);
    box(-1.2, F2 + 0.28, -3.2, 1.5, 0.5, 0.45, W('#6b8a9a', 0.3), true, f2Layer); box(-1.2, F2 + 0.55, -3.45, 1.5, 0.45, 0.14, W('#6b8a9a', 0.3), true, f2Layer);
    for (const dx of [-0.75, 0.75]) box(-1.2 + dx, F2 + 0.4, -3.2, 0.12, 0.45, 0.5, W('#5a7a8a', 0.3), true, f2Layer);
    table(-1.2, -2.5, 0.8, 0.4, 0.38, f2Layer, F2, wood);
    box(IX0 + 0.2, F2 + 0.3, -3.0, 0.38, 0.6, 1.4, woodD, true, f2Layer); box(IX0 + 0.1, F2 + 0.85, -3.0, 0.06, 0.5, 0.9, W('#2f2a26', 0.08), true, f2Layer);
    // back layer: kitchen run along the rear wall, fridge, hanging lamps, pot plant
    box(-0.1, F2 + 0.45, IZ1 + 0.3, 1.6, 0.9, 0.6, W('#d6cfba', 0.3)); box(-0.1, F2 + 0.92, IZ1 + 0.3, 1.64, 0.04, 0.64, steel); box(-0.4, F2 + 0.94, IZ1 + 0.3, 0.45, 0.02, 0.4, '#59656d', false);
    for (const dx of [0.1, 0.4]) box(-0.1 + dx, F2 + 0.945, IZ1 + 0.3, 0.2, 0.012, 0.2, '#2a2d31', false);
    box(-0.1, F2 + 1.9, IZ1 + 0.18, 1.6, 0.5, 0.32, wood, true, f2Layer);
    box(0.55, F2 + 0.9, IZ1 + 0.35, 0.5, 1.8, 0.62, W('#dfe3e0', 0.28), true, f2Layer);
    pendant(-2.1, -1.0, F2 + 1.9, CEIL2, '#e8c9a0', f2Layer); pendant(-1.2, -2.8, F2 + 1.95, CEIL2, '#d9c7a0', f2Layer);
    pot(-3.5, F2, IZ1 + 0.3, 0.17, 6, 2, '#8f9aa0');
    for (const [x, z, r2] of [[-2.1, -1.0, 2.2], [-1.2, -3.0, 1.8], [0.0, -4.1, 1.4]]) decal(r2, r2, x, F2 + 0.004, z, [0, -1], pool);
    // curtains
    for (const x of [A2[0] + 0.12, A2[1] - 0.12]) box(x, F2 + 1.2, IZ0 - 0.04, 0.26, 1.9, 0.05, W('#ebe0c6', 0.4), true, f2Layer);
  }
  // ================= interior: floor 3 (bedroom) =================
  K.setRoot(f3Layer);
  {
    // near: desk and chair at the balcony window; mid: bed; back: wardrobe
    table(-3.2, -1.0, 0.6, 1.2, 0.74, f3Layer, F3, wood); box(-3.2, F3 + 0.95, -1.0, 0.04, 0.4, 0.5, W('#2f2a26', 0.1), true, f3Layer); chair(-2.6, -1.0, [-1, 0], F3, '#c9a86a', f3Layer);
    box(-1.6, F3 + 0.22, -2.9, 1.5, 0.3, 2.0, woodD, true, f3Layer); box(-1.6, F3 + 0.45, -2.9, 1.42, 0.16, 1.92, W('#d9d2e6', 0.3), true, f3Layer); box(-1.6, F3 + 0.56, -2.1, 1.1, 0.12, 0.3, W('#f0e8d4', 0.34), true, f3Layer);
    box(-1.6, F3 + 0.58, -3.3, 1.42, 0.06, 1.2, W('#7da0b0', 0.3), true, f3Layer); box(-1.6, F3 + 0.9, -3.92, 1.5, 0.9, 0.08, woodD, true, f3Layer);
    for (const dx of [-0.95, 0.95]) box(-1.6 + dx, F3 + 0.28, -2.15, 0.35, 0.4, 0.35, woodD, true, f3Layer);
    box(-0.15, F3 + 1.0, IZ1 + 0.3, 0.9, 2.0, 0.55, woodD, true, f3Layer); box(-0.15, F3 + 1.0, IZ1 + 0.58, 0.02, 1.9, 0.02, wood, false, f3Layer);
    box(-3.4, F3 + 1.0, IZ1 + 0.3, 0.7, 2.0, 0.5, W('#cfc6b0', 0.3), true, f3Layer);
    box(IX0 + 0.1, F3 + 1.5, -2.0, 0.05, 0.4, 0.6, W('#4a5a50', 0.2), false, f3Layer);   // framed print on the east wall
    box(-1.0, F3 + 0.01, -2.1, 2.0, 0.02, 1.5, W('#8a8f6a', 0.26), false, f3Layer);   // rug
    pendant(-1.6, -2.4, F3 + 1.95, CEIL3, '#e8c9a0', f3Layer); cyl(-0.8, F3 + 0.55, -3.7, 0.02, 1.1, '#3d4a58', f3Layer); mesh(new THREE.ConeGeometry(0.17, 0.2, 12, 1, true), W('#efe0c0', 0.8), -0.8, F3 + 1.15, -3.7, true, f3Layer);
    for (const [x, z, r2] of [[-3.0, -1.0, 1.6], [-1.6, -2.6, 2.4], [-0.2, -4.0, 1.4]]) decal(r2, r2, x, F3 + 0.004, z, [0, -1], pool);
    for (const x of [A3[0] + 0.12, A3[1] - 0.12]) box(x, F3 + 1.2, IZ0 - 0.04, 0.26, 1.9, 0.05, W('#e6d6c0', 0.4), true, f3Layer);
  }

  // ================= hip roof (roof layer) =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('pharmacy').add(roofLayer); K.setRoot(roofLayer);
  box((IX0 + IX1) / 2, CEIL3 + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false);
  const xa = X0 - OV, xb = X1 + OV, za = Z1 - OV, zb = Z0 + OV, ye = EF - OV * SL, hz = (zb - za) / 2, zr = (za + zb) / 2, yr = ye + SL * hz, xr0 = xa + hz, xr1 = xb - hz;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const face = pts => {
    const p0 = pts[0], u = pts[1].clone().sub(p0).normalize(), c = pts[2].clone().sub(p0);
    let n = u.clone().cross(c).normalize(); if (n.y < 0) n.negate();
    const v = n.clone().cross(u), sh = new THREE.Shape(pts.map(P => { const d = P.clone().sub(p0); return new THREE.Vector2(d.dot(u), d.dot(v)); }));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 1 }), o = p0.clone().addScaledVector(n, -0.1);
    const m = mesh(g, roofM, o.x, o.y, o.z); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)); return m;
  };
  face([V(xa, ye, zb), V(xb, ye, zb), V(xr1, yr, zr), V(xr0, yr, zr)]);
  face([V(xb, ye, za), V(xa, ye, za), V(xr0, yr, zr), V(xr1, yr, zr)]);
  face([V(xa, ye, za), V(xa, ye, zb), V(xr0, yr, zr)]);
  face([V(xb, ye, zb), V(xb, ye, za), V(xr1, yr, zr)]);
  box((xr0 + xr1) / 2, yr + 0.1, zr, xr1 - xr0 + 0.2, 0.1, 0.22, '#2a323d');
  for (const [a, b] of [[[xa, ye, zb], [xr0, yr, zr]], [[xb, ye, zb], [xr1, yr, zr]], [[xa, ye, za], [xr0, yr, zr]], [[xb, ye, za], [xr1, yr, zr]]]) rod([a[0], a[1] + 0.08, a[2]], [b[0], b[1] + 0.1, b[2]], 0.06, '#2a323d');
  for (const [z, o] of [[zb, 1], [za, -1]]) { const g = mesh(new THREE.CylinderGeometry(0.065, 0.065, xb - xa, 10, 1, true, 0, PI), mat('#8796a0'), (xa + xb) / 2, ye - 0.04, z + o * 0.04); g.rotation.z = PI / 2; g.rotation.x = o > 0 ? PI : 0; box((xa + xb) / 2, ye + 0.02, z + o * 0.02, xb - xa, 0.1, 0.04, '#2a323d'); }
  for (const [x, o] of [[xa, -1], [xb, 1]]) { const g = mesh(new THREE.CylinderGeometry(0.05, 0.05, zb - za, 8, 1, true), mat('#8796a0'), x + o * 0.04, ye - 0.06, (za + zb) / 2); g.rotation.x = PI / 2; box(x + o * 0.02, ye + 0.02, (za + zb) / 2, 0.04, 0.1, zb - za, '#2a323d'); }
  // Roof skylight hatch, two rooftop AC units on a stand (rear slope side), TV antenna on a mast.
  { const hx = -0.5, hz2 = zr + 0.7, hy = yr - 0.35; box(hx, hy + 0.1, hz2, 0.5, 0.2, 0.5, '#8a9096'); box(hx, hy + 0.22, hz2, 0.4, 0.04, 0.4, '#bcd2d8', false);
    box(xr0 + 0.1, yr - 0.1, zr - 0.5, 0.6, 0.06, 0.4, '#6f7a82'); box(xr0 + 0.1, yr + 0.22, zr - 0.5, 0.54, 0.5, 0.34, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.15, 16), mat('#3b4650'), xr0 + 0.1, yr + 0.22, zr - 0.328, false).rotation.y = PI;
    const mx = xr1 - 0.1, mz = zr + 0.2; rod([mx, yr, mz], [mx, yr + 1.5, mz], 0.02, '#8796a0');
    for (let i = 0; i < 4; i++) rod([mx, yr + 0.7 + i * 0.22, mz - 0.35 + 0.07 * i], [mx, yr + 0.7 + i * 0.22, mz + 0.35 - 0.07 * i], 0.01, '#8796a0');
    rod([mx, yr + 1.4, mz - 0.25], [mx, yr + 1.4, mz + 0.25], 0.012, '#8796a0'); }
  group('pharmacy');
  // Downpipes with refrigerant/gas runs on the stair-hall (west) side wall and the rear-east corner.
  for (const [x, z] of [[X1 + 0.02, Z0 - 0.1], [X0 - 0.02, Z1 + 0.1]]) { cyl(x, (ye - 0.1 + 0.3) / 2, z, 0.04, ye - 0.4, '#8796a0'); for (const y of [0.9, 2.1, 3.8, 5.0, 6.5, 8.0]) rod([x, y, z], [x - Math.sign(x) * 0.0, y, z + (z > -2 ? -0.1 : 0.1)], 0.012, '#5f6c76'); box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91'); }
  for (let i = 0; i < 2; i++) { const z = -1.2 - i * 2.2; cyl(X1 + 0.05, (F + F3 + 2.5) / 2, z - 0.0, 0.025, F3 + 2.5 - F, '#6f7a82'); for (const y of [1.5, 3.4, 5.2, 6.6]) box(X1 + 0.04, y, z, 0.06, 0.04, 0.1, '#5f6c76', false); }
  box(X1 + 0.08, 1.45, -3.5, 0.16, 0.45, 0.3, '#cdd0c9'); box(X1 + 0.165, 1.5, -3.5, 0.01, 0.13, 0.18, '#7b8a92', false);
  box(X0 - 0.04, 2.0, -3.9, 0.08, 0.3, 0.36, '#c4c7c0'); for (let i = 0; i < 4; i++) box(X0 - 0.085, 1.9 + i * 0.07, -3.9, 0.012, 0.012, 0.3, '#7f8b93', false);
  // AC outdoor units on brackets (front wall, right of the balconies) and on the west wall.
  for (const fl of [F2, F3]) { box(1.5, fl + 0.4, 0.22, 0.7, 0.55, 0.3, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.15, 16), mat('#3b4650'), 1.38, fl + 0.4, 0.375, false);
    for (const x of [1.25, 1.75]) box(x, fl + 0.1, 0.1, 0.04, 0.06, 0.2, '#6f7a82', false); }

  // ================= forecourt, residents' door side, bicycle shelter, rear utilities =================
  group('pharmacyFrontW');
  {
    // A-frame blackboard, pens-and-notebooks crate stand and plants beside the shop window
    const bx = -3.2, bz = 1.35, bd = board(256, 320, [['お薬の相談', 44, 30, 'serif', '#f0c987'], ['処方せん受付', 100, 24], ['のど飴 ¥198', 150, 24], ['雨の日は', 210, 22, 'sans-serif', '#c7d0a0'], ['湿気と冷えに', 244, 22, 'sans-serif', '#c7d0a0'], ['ご注意を', 278, 22, 'sans-serif', '#c7d0a0']], '#33403a');
    for (const s of [-1, 1]) { const p = box(bx, 0.19 + 0.45, bz + s * 0.12, 0.62, 0.9, 0.04, '#7a5c44'); p.rotation.x = s * 0.2; }
    { const p = mesh(new THREE.PlaneGeometry(0.54, 0.74), lit(bd, '#1f2a24'), bx, 0.19 + 0.46, bz + 0.13 + 0.01, false); p.rotation.x = -0.2; }
    box(-1.5, 0.19 + 0.3, 0.45, 0.8, 0.6, 0.36, '#a2845c'); for (let i = 0; i < 6; i++) box(-1.78 + i * 0.11, 0.19 + 0.66, 0.45, 0.08, 0.2 + rnd() * 0.05, 0.28, W(bookCols[i % 7], 0.34), false);
    pot(-4.0, 0.19, 0.55, 0.17, 5, 1.4, '#7d6a5a'); pot(-3.6, 0.19, 1.0, 0.13, 4, 1.2, '#9b7d68'); pot(-0.95, 0.19, 1.0, 0.14, 5, 1.2, '#8f9aa0');
  }
  group('pharmacyFrontE');
  {
    // vending-style mailbox post, house plant, shoe-scraper mat, bicycle-free lane to the resident door
    box(2.3, 0.19 + 0.55, 0.62, 0.3, 1.1, 0.12, '#8a98a0'); for (let i = 0; i < 3; i++) box(2.3, 0.19 + 0.3 + i * 0.3, 0.69, 0.22, 0.2, 0.01, '#cfd2cb', false);
    pot(0.95, 0.19, 0.95, 0.15, 5, 1.5, '#7d6a5a'); pot(1.95, 0.19, 1.0, 0.18, 6, 1.8, '#8f9aa0'); box(1.45, 0.275, 0.35, 0.8, 0.012, 0.5, '#5d5248', false);
  }
  group('pharmacy');
  {
    // Polycarbonate-roofed bicycle shelter on the west side (x 3.0…4.5, z -4.2…-0.9), open on the street side, with two bicycles.
    const x0 = 2.65, x1 = 3.75, z0 = -4.2, z1 = -0.9, hi = 2.25, lo = 2.0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (const [x, z] of [[x0 + 0.04, z1 - 0.04], [x1 - 0.04, z1 - 0.04], [x0 + 0.04, z0 + 0.04], [x1 - 0.04, z0 + 0.04]]) box(x, 0.19 + (z > cz ? hi : lo) / 2 + 0.0, z, 0.06, (z > cz ? hi : lo), 0.06, '#59656d');
    const r = box(cx, (hi + lo) / 2 + 0.2, cz, x1 - x0 + 0.1, 0.04, Math.hypot(z1 - z0, hi - lo), new THREE.MeshPhysicalMaterial({ color: 0xbfe0e6, transparent: true, opacity: 0.4, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }), true); r.rotation.x = -Math.atan2(hi - lo, z1 - z0);
    for (const x of [x0, x1]) box(x, hi + 0.14, cz, 0.04, 0.04, z1 - z0, '#59656d', false);
    box(x1 - 0.02, 1.2, cz, 0.02, 1.9, z1 - z0 - 0.1, '#5f6c76', false);   // side panel on the plot-edge side
    for (let i = 0; i < 2; i++) { const x = x0 + 0.3 + i * 0.55;
      for (const z of [cz - 0.65, cz + 0.65]) { const w = mesh(new THREE.TorusGeometry(0.16, 0.014, 6, 16), mat('#2f3338'), x, 0.19 + 0.17, z, false); w.rotation.y = PI / 2; }
      box(x, 0.19 + 0.35, cz, 0.03, 0.03, 1.3, i ? '#4f7290' : '#c3463a'); rod([x, 0.19 + 0.34, cz + 0.65], [x, 0.19 + 0.62, cz + 0.55], 0.012, i ? '#4f7290' : '#c3463a'); box(x, 0.19 + 0.62, cz - 0.3, 0.08, 0.03, 0.2, '#2f3338'); box(x, 0.19 + 0.55, cz + 0.6, 0.2, 0.025, 0.02, '#2f3338');
      box(x, 0.19 + 0.34, cz + 0.3, 0.16, 0.12, 0.003, '#c9c9c9', false); }
    box(x0 + 0.06, 0.19 + 0.55, cz + 1.4, 0.04, 0.5, 0.2, '#59656d'); // wheel-rack end stub
    for (let i = 0; i < 3; i++) box(x0 + 0.1 + i * 0.45, 0.19 + 0.2, cz + 0.2, 0.02, 0.4, 0.8, '#59656d', false);
    shrub(x1 - 0.15, 0.25, z0 - 0.1, 0.18, 4, 1.4);
  }
  group('pharmacyRear');
  {
    // Back-door step mat, two bins, AC outdoor unit stand, utility cabinet
    box(-2.65, 0.19 + 0.015, Z1 - 0.3, 0.9, 0.03, 0.34, '#5d5248', false);
    for (const [x, c] of [[-1.7, '#4f7290'], [-1.25, '#3f6c4f']]) { box(x, 0.19 + 0.3, Z1 - 0.34, 0.38, 0.6, 0.34, c); box(x, 0.19 + 0.62, Z1 - 0.34, 0.42, 0.04, 0.38, '#2f3944'); }
    box(0.1, 0.19 + 0.05, Z1 - 0.3, 1.0, 0.1, 0.42, '#7f8b93'); for (const x of [-0.15, 0.35]) { box(x, 0.19 + 0.4, Z1 - 0.3, 0.5, 0.6, 0.34, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.15, 16), mat('#3b4650'), x - 0.05, 0.19 + 0.4, Z1 - 0.472, false).rotation.y = PI; }
    box(1.9, 0.19 + 0.55, Z1 - 0.28, 0.7, 1.1, 0.34, '#a8aeb0'); box(1.9, 0.19 + 0.55, Z1 - 0.455, 0.66, 1.0, 0.01, '#8f9a9f', false); box(2.05, 0.19 + 0.6, Z1 - 0.47, 0.025, 0.2, 0.025, '#59656d');
    pot(-3.5, 0.19, Z1 - 0.3, 0.15, 5, 1.4);
  }
  group('pharmacyGround');
  const paveMat = warm('#ffffff', 0, pavers), pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-4.4, 2.65, 0, 1.9); pave(-4.4, 2.65, -5.35, -4.7); pave(-4.5, -4.4, -5.35, 1.9); pave(2.65, 3.9, -4.7, 1.9); pave(2.65, 3.9, -5.3, -4.7);
  mesh(tileUV(new THREE.BoxGeometry(1.1, 0.016, 3.4), 1, 2), warm('#ffffff', 0, pavers), 3.2, 0.198, -2.55, false);
  box(0, 0.214, 1.0, 1.7, 0.014, 0.5, '#5d5248', false);
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(3.2, 1.2, -2.2, 0.208, 1.4, [0, -1], spill); decal(1.5, 1.0, 0, 0.226, 1.2, [0, -1], spill); decal(1.4, 0.9, 1.45, 0.226, 1.0, [0, -1], additive(spillT, '#ffbf7a', 0.2));
  decal(0.8, 0.8, X0 - 0.2, 0.2, -2.5, [1, 0], additive(spillT, '#ffbf7a', 0.12));
  decal(1.2, 0.5, (BD[0] + BD[1]) / 2, 0.208, Z1 - 0.3, [0, 1], additive(glowT, '#ffc27e', 0.2));

  // ================= local animation: window rain runs, eave and shelter drips, warm window glow breathing =================
  const fx = new THREE.Group(); fx.userData.live = true; group('pharmacy').add(fx); K.setRoot(fx);
  const upGlow = additive(glowT, '#ffd9a0', 0.1); mesh(new THREE.PlaneGeometry(3.6, 1.8), upGlow, -2.1, F2 + 1.2, 1.1, false, fx);
  const upGlow3 = additive(glowT, '#ffd9a0', 0.07); mesh(new THREE.PlaneGeometry(3.6, 1.8), upGlow3, -2.1, F3 + 1.2, 1.1, false, fx);
  const shopGlow = additive(glowT, '#ffe2b0', 0.2); mesh(new THREE.PlaneGeometry(4.6, 2.2), shopGlow, -2.2, 1.4, 0.2, false, fx);
  const batch = (c, o, par = fx) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; par.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6);
  for (const [w, n] of [[FW, 8], [A2, 7], [A3, 7]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 0.8, w === FW ? 0.06 : 0.1, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 20; i++) drips.add(-4.4 + i * 0.33 + rnd() * 0.1, 3.0 + rnd() * 5.0, 0.4, 0.1, 2.9, 8.5, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 6; i++) drips.add(-3.4 + i * 0.55 + rnd() * 0.1, 0.25 + rnd() * 1.9, 0.86, 0.09, 0.25, 2.5, 2.1 + rnd() * 0.5);
  const bikeFx = new THREE.Group(); bikeFx.userData.live = true; group('pharmacy').add(bikeFx); K.setRoot(bikeFx);
  const bdrips = batch('#cee7e5', 0.6, bikeFx);
  for (let i = 0; i < 6; i++) bdrips.add(2.75 + i * 0.22, 0.3 + rnd() * 1.7, -0.85, 0.1, 0.25, 2.0, 2.2 + rnd() * 0.4);
  runs.seal(); drips.seal(); bdrips.seal();
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt); bdrips.step(dt);
      shopGlow.opacity = 0.17 + 0.05 * Math.sin(t * 0.7) * Math.sin(t * 0.29 + 1);
      upGlow.opacity = 0.09 + 0.025 * Math.sin(t * 0.5 + 2); upGlow3.opacity = 0.065 + 0.02 * Math.sin(t * 0.41 + 4);
    },
  };
};
