// B06-P04 山田修理舗 (Yamada Repair Shop): a three-storey shop-house, bicycle repair shop below, two flats above.
// Task card docs/buildings/tasks/B06-P04.md, reference docs/buildings/references/B06-P04.jpg. Same shop-house family as B04-P05 … B06-P03
// (shop left of the front, residents' door right, U-stair, two balconies) but on the deepest plot of the family (buildable 9 × 7.5): body 5.8 × 5.6, almost
// square, so the standing-seam roof is a near-pyramid hip with a louvred vent box at the apex (the earlier houses have a long ridge). Own details: dark-brown
// fascia sign with a bicycle and a hanging wheel sign that turns, repair shop interior (display bike, repair stand with a spinning wheel, workbench with
// pegboard tool wall, parts drawers, tyre rack, compressor, reception counter), timber-slat blinds on the side windows, a polycarbonate lean-to bicycle
// shed on the residents' (west) side with a block wall, a tree and gas cylinders behind it.
// Local frame (placed by layout.js `buildings`, rotY π): front +z faces the north street, local +x = world W, door (shop) at the origin.
// Body x -2.9…2.9, z -5.6…0 (roof edges to x ±3.2 and z +0.3 / -5.9, balconies to +0.8, shed to x 4.4). Door at x 0 = frozen entrance x.
// Groups: yamada (shell, storeys, stairs, roof, balconies, fascia, bicycle shed) · yamadaFrontW · yamadaFrontE · yamadaEast · yamadaWest · yamadaRear · yamadaGround.
// Layers: f2 / f3 (upper storeys), roof. Upper floors: dining-living-kitchen with a washer, bedroom with a desk.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B06-P04'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(4704), PI = Math.PI;
  const F = rec.floor, F2 = F + 2.8, F3 = F2 + 2.8, EF = F3 + 2.7, X0 = -2.9, X1 = 2.9, Z0 = 0, Z1 = -5.6, T = 0.15, BASE = 0.19, SLAB = 0.2;
  const CEIL1 = F2 - SLAB, CEIL2 = F3 - SLAB, CEIL3 = EF - 0.12, SL = 0.42, OV = 0.3, PX = 0.9;   // PX: partition between the shop/flats and the stair hall
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T, FX1 = PX - 0.05;
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FW = [-2.6, -0.6, 0.5, 2.4], FD = [-0.5, 0.5, F, 2.35], RD = [1.4, 2.3, F, 2.3], DX = (RD[0] + RD[1]) / 2, GX = 1.84;   // DX: residents' door centre; GX: stair guard line
  const A2 = [-2.6, -0.2, F2 + 0.15, F2 + 2.05], A3 = [-2.6, -0.2, F3 + 0.15, F3 + 2.05], S2 = [1.45, 2.25, F2 + 0.85, F2 + 1.9], S3 = [1.45, 2.25, F3 + 0.85, F3 + 1.9];
  const BD = [-0.05, 0.8, F, 2.25], RWg = [-1.35, -0.4, 1.3, 2.2], RHg = [1.7, 2.3, 1.4, 2.3];   // back door by the partition, window between the drawer chest and the door
  const rear = fl => [[-2.6, -1.8, fl + 0.95, fl + 1.95], [-0.8, 0.3, fl + 0.9, fl + 1.95], [1.7, 2.3, fl + 0.95, fl + 1.95]];
  const east = fl => [[-1.9, -1.1, fl + 0.95, fl + 1.95], [-4.2, -3.4, fl + 0.95, fl + 1.95]];
  const WWg = [-3.0, -2.5, 1.5, 2.3], west = fl => [[-3.0, -2.3, fl + 0.8, fl + 1.9]];   // no ground-floor east window: workbench and pegboard are on that wall
  const DP2 = [-4.9, -4.1, F2, F2 + 2.05], DP3 = [-0.93, -0.18, F3, F3 + 2.05];   // flat doors through the partition (landing at the back for 2F, at the front for 3F)

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#cdccc6'), timber = '#5a4030', timberL = '#a97a4e', slat = '#b98a58', stoneC = '#9a958b', alu = '#46545a', trim = '#4f6158', green = '#2f5446';
  const wcache = {}, W = (c, k = 0.3) => wcache[c + k] || (wcache[c + k] = warm(c, k));
  const wood = W('#b0814f'), woodD = W('#6f4a35', 0.26), cream = W('#efe4cc', 0.34), steel = W('#c3cacb', 0.22);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' });
  const seamT = tex(128, 128, (q, w, h) => { q.fillStyle = '#3e4a58'; q.fillRect(0, 0, w, h);
    for (let c = 0; c < 4; c++) { const g = q.createLinearGradient(c * 32, 0, c * 32 + 32, 0); g.addColorStop(0, '#2f3945'); g.addColorStop(0.5, '#4a5767'); g.addColorStop(1, '#2d3642'); q.fillStyle = g; q.fillRect(c * 32, 0, 32, h);
      q.fillStyle = 'rgba(10,14,22,.7)'; q.fillRect(c * 32, 0, 2.5, h); q.fillStyle = 'rgba(190,205,225,.22)'; q.fillRect(c * 32 + 2.5, 0, 1.2, h); }
    for (let i = 0; i < 400; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '8,12,18' : '190,205,225'},${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1, 3); } });
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: seamT });
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
  group('yamada');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, F2], [FW, FD, RD], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, F2], [BD, RWg, RHg], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, F2], [WWg], plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, F2], [], plaster);
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
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL1], [], cream);
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
  glaze('x', -T / 2, 1, FW, [-1.6], [1.6], 0, false);
  glaze('z', X1 - T / 2, 1, WWg);
  glaze('x', Z1 + T / 2, -1, RWg); glaze('x', Z1 + T / 2, -1, RHg);
  // Shop door: glass door in a dark frame with push bars, "営業中" card; residents' door: wooden panel door.
  {
    ab('x', FD[0] + 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, alu); ab('x', FD[1] - 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, alu); box(0, FD[3] - 0.04, -T / 2, FD[1] - FD[0], 0.08, 0.16, alu);
    const z = -0.05, top = FD[3] - 0.08;
    for (const x of [-0.46, -0.02, 0.02, 0.46]) box(x, (F + top) / 2, z, 0.06, top - F, 0.045, alu);
    box(0, top - 0.04, z, 0.96, 0.08, 0.045, alu); box(0, F + 0.35, z, 0.96, 0.1, 0.045, alu);
    box(0, (F + 0.4 + top - 0.08) / 2, z, 0.9, top - 0.08 - F - 0.4, 0.012, glass, false);
    for (const x of [-0.14, 0.14]) box(x, 1.1, z + 0.03, 0.03, 0.7, 0.03, '#c9c9c0');
    box(0.28, 1.45, z + 0.012, 0.16, 0.1, 0.006, '#e8e2cf', false); box(0.28, 1.45, z + 0.016, 0.1, 0.05, 0.004, green, false);
    ab('x', RD[0] + 0.04, (F + RD[3]) / 2, -T / 2, 0.08, RD[3] - F, 0.16, timber); ab('x', RD[1] - 0.04, (F + RD[3]) / 2, -T / 2, 0.08, RD[3] - F, 0.16, timber); box(DX, RD[3] - 0.04, -T / 2, RD[1] - RD[0], 0.08, 0.16, timber);
    box(DX, (F + RD[3] - 0.08) / 2, -0.04, 0.84, RD[3] - 0.08 - F, 0.05, '#6a4a34');
    for (let i = 0; i < 3; i++) box(DX, F + 0.5 + i * 0.6, -0.012, 0.6, 0.38, 0.012, '#7d5a40', false);
    box(DX - 0.3, 1.1, 0.0, 0.03, 0.16, 0.05, '#c9c9c0'); box(DX + 0.35, 2.05, 0.03, 0.16, 0.1, 0.03, '#8a98a0');
  }
  // Entrance platforms: shop door and resident door, one low step each (flush threshold at the door).
  box(0, 0.255, 0.38, 1.7, 0.1, 0.76, '#a8a091'); box(0, 0.21, 0.74, 1.7, 0.04, 0.2, '#8e8a80');
  for (let i = 0; i < 4; i++) box(-0.6 + i * 0.4, 0.31, 0.74, 0.28, 0.006, 0.12, '#d6b13c', false);
  box(DX, 0.255, 0.32, 1.2, 0.1, 0.64, '#a8a091'); box(DX, 0.21, 0.62, 1.2, 0.04, 0.16, '#8e8a80');

  // ---- helpers for this building: timber-slat blind, spoked wheel, bicycle ----
  const blind = (axis, at, out, [a, b, p, q], drop = 0.55) => { const n = 9, h = (q - p) * drop;
    for (let i = 0; i < n; i++) ab(axis, (a + b) / 2, q - 0.05 - i * h / n, at + out * 0.075, b - a - 0.06, 0.03, 0.03, i % 2 ? '#9a7248' : '#b08552');
    ab(axis, (a + b) / 2, q - 0.02, at + out * 0.08, b - a - 0.02, 0.05, 0.06, timber); };
  const wheel = (r, c = '#2f3338') => { const g = new THREE.Group(), t = mesh(new THREE.TorusGeometry(r, 0.016, 6, 20), mat(c), 0, 0, 0, false, g); t.rotation.y = PI / 2;
    for (let k = 0; k < 4; k++) { const a = k * PI / 4, s = Math.sin(a) * (r - 0.02), q = Math.cos(a) * (r - 0.02); rod([0, s, q], [0, -s, -q], 0.004, '#9aa4a8', g); }
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 8), mat('#59656d'), 0, 0, 0, false, g).rotation.z = PI / 2; return g; };
  // bicycle with its wheels along z (axis 'z') or x (axis 'x'); (x, y, z) = point on the floor under the middle of the frame; rear wheel can be left out (live wheel)
  const bike = (x, y, z, axis, c, rearWheel = true, flip = 1) => {
    const P = (u, v, w) => axis === 'z' ? [x + u, y + v, z + w * flip] : [x + w * flip, y + v, z - u];
    for (const s of rearWheel ? [-0.55, 0.55] : [0.55]) { const w0 = P(0, 0.35, s), m = mesh(new THREE.TorusGeometry(0.33, 0.016, 6, 18), mat('#2f3338'), w0[0], w0[1], w0[2], false); if (axis === 'z') m.rotation.y = PI / 2;
      for (let k = 0; k < 3; k++) { const a = k * PI / 3; rod(P(0, 0.35 + Math.sin(a) * 0.3, s + Math.cos(a) * 0.3), P(0, 0.35 - Math.sin(a) * 0.3, s - Math.cos(a) * 0.3), 0.004, '#9aa4a8'); } }
    const bb = P(0, 0.3, -0.1), st = P(0, 0.88, -0.28), hd = P(0, 0.97, 0.38), rw = P(0, 0.35, -0.55), fw = P(0, 0.35, 0.55);
    rod(rw, bb, 0.014, c); rod(bb, st, 0.014, c); rod(st, hd, 0.014, c); rod(bb, hd, 0.014, c); rod(rw, st, 0.012, c); rod(fw, hd, 0.012, '#59656d');
    const sd = P(0, 0.93, -0.32), hb = P(0, 1.0, 0.4);
    box(sd[0], sd[1], sd[2], axis === 'z' ? 0.12 : 0.22, 0.04, axis === 'z' ? 0.22 : 0.12, '#2f3338', false);
    box(hb[0], hb[1], hb[2], axis === 'z' ? 0.5 : 0.04, 0.03, axis === 'z' ? 0.04 : 0.5, '#2f3338', false);
    const cr = P(0, 0.3, -0.1); cyl(cr[0], cr[1], cr[2], 0.07, 0.02, '#59656d').rotation.z = axis === 'z' ? PI / 2 : 0; };

  // ---- shop fascia: dark-brown sign board with the name and a bicycle, slanted charcoal valance, bracket for the wheel sign at the left end ----
  {
    const x0 = X0 - 0.05, x1 = FX1 + 0.05, w = x1 - x0, cx = (x0 + x1) / 2, y0 = 2.47, y1 = 2.87;
    box(cx, (y0 + y1) / 2, 0.06, w, y1 - y0, 0.12, '#3a2a22');
    box(cx, y1 + 0.02, 0.1, w + 0.06, 0.04, 0.2, '#2a1e19'); box(cx, y0 - 0.02, 0.09, w + 0.04, 0.03, 0.18, '#2a1e19');
    const sg = canvasTex(1024, 104, (q, W2, H2) => { q.fillStyle = '#45322a'; q.fillRect(0, 0, W2, H2);
      q.strokeStyle = '#c9a96a'; q.lineWidth = 3; q.strokeRect(10, 10, W2 - 20, H2 - 20);
      q.fillStyle = '#f0d9a0'; q.font = 'bold 64px serif'; q.textAlign = 'left'; q.textBaseline = 'middle'; q.fillText('山田修理舗', 60, H2 / 2 + 4);
      q.fillStyle = '#c9a96a'; q.font = 'bold 22px sans-serif'; q.fillText('自転車  ·  部品  ·  パンク修理', 440, H2 / 2 + 4);
      // bicycle icon: two wheels, frame, saddle and handlebar
      q.strokeStyle = '#f0d9a0'; q.lineWidth = 5; q.lineCap = 'round'; q.beginPath(); q.arc(850, 62, 20, 0, 7); q.stroke(); q.beginPath(); q.arc(940, 62, 20, 0, 7); q.stroke();
      q.beginPath(); q.moveTo(850, 62); q.lineTo(880, 34); q.lineTo(920, 34); q.lineTo(940, 62); q.moveTo(880, 34); q.lineTo(896, 62); q.lineTo(850, 62); q.moveTo(896, 62); q.lineTo(920, 34); q.moveTo(872, 28); q.lineTo(890, 28); q.moveTo(920, 34); q.lineTo(924, 22); q.lineTo(936, 22); q.stroke(); });
    mesh(new THREE.PlaneGeometry(w - 0.08, y1 - y0 - 0.06), new THREE.MeshToonMaterial({ map: sg, gradientMap: K.ramp, emissive: '#b8ad98', emissiveMap: sg }), cx, (y0 + y1) / 2, 0.122, false);
    { const v = box(cx, 2.4, 0.2, w - 0.1, 0.1, 0.26, '#2e2824'); v.rotation.x = 0.3; box(cx, 2.34, 0.31, w - 0.1, 0.03, 0.02, '#c9a96a', false); }
    for (const x of [-1.9, -0.3]) { box(x, 2.3, 0.07, 0.1, 0.14, 0.09, '#2a1e19'); box(x, 2.29, 0.07, 0.07, 0.1, 0.095, bulb, false); mesh(new THREE.PlaneGeometry(1.1, 1.0), additive(glowT, '#ffc27e', 0.18), x, 2.27, 0.04, false); }
    box(-2.8, 2.32, 0.28, 0.05, 0.05, 0.5, '#2a1e19'); rod([-2.8, 2.3, 0.52], [-2.8, 2.26, 0.52], 0.01, '#59656d');   // bracket for the wheel sign (the wheel itself is in the live group)
  }
  // Resident door lamp; mailbox cluster is in yamadaFrontE.
  box(DX, 2.42, 0.07, 0.16, 0.14, 0.1, '#3d4a58'); box(DX, 2.41, 0.07, 0.12, 0.1, 0.105, bulb, false);
  mesh(new THREE.PlaneGeometry(1.0, 1.0), additive(glowT, '#ffc27e', 0.25), DX, 2.4, 0.04, false);
  // Shop back door (stockroom): steel, pent canopy, step, lamp.
  ab('x', BD[0] + 0.04, (F + BD[3]) / 2, Z1 + T / 2, 0.08, BD[3] - F, 0.16, timber); ab('x', BD[1] - 0.04, (F + BD[3]) / 2, Z1 + T / 2, 0.08, BD[3] - F, 0.16, timber); box((BD[0] + BD[1]) / 2, BD[3] - 0.04, Z1 + T / 2, BD[1] - BD[0], 0.08, 0.16, timber);
  box((BD[0] + BD[1]) / 2, (F + BD[3] - 0.08) / 2, Z1 + 0.06, BD[1] - BD[0] - 0.14, BD[3] - 0.08 - F, 0.04, '#59605e');
  box((BD[0] + BD[1]) / 2, 1.8, Z1 + 0.035, 0.34, 0.5, 0.012, '#8a98a0', false); box(BD[0] + 0.14, 1.1, Z1 + 0.02, 0.03, 0.16, 0.04, '#c9c9c0');
  shapeMesh([[0, BASE], [0.3, BASE], [0.3, 0.3], [0, 0.3]], BD[1] - BD[0] + 0.1, '#a8a091', BD[0] - 0.05, 0, Z1, PI / 2);
  { const e = box((BD[0] + BD[1]) / 2, 2.52, Z1 - 0.2, 1.1, 0.05, 0.42, trim); e.rotation.x = -0.26; }
  box(BD[1] + 0.3, 1.95, Z1 - 0.06, 0.12, 0.17, 0.1, '#3d4a58'); box(BD[1] + 0.3, 1.94, Z1 - 0.06, 0.09, 0.12, 0.105, bulb, false);
  mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.26), BD[1] + 0.3, 1.95, Z1 - 0.004, false).rotation.y = PI;

  // ---- balconies (floors 2 and 3), timber railings with planters ----
  for (const fl of [F2, F3]) {
    const bx0 = X0 - 0.05, bx1 = PX + 0.05, bz = 0.8, rz = bz - 0.04, cx = (bx0 + bx1) / 2;
    box(cx, fl - 0.1, bz / 2, bx1 - bx0, 0.2, bz, '#b4b0a4'); box(cx, fl - 0.03, bz - 0.01, bx1 - bx0, 0.04, 0.03, '#8e8a80', false);
    for (let i = 0; i <= 8; i++) box(bx0 + 0.04 + i * (bx1 - bx0 - 0.08) / 8, fl + 0.52, rz, 0.06, 1.04, 0.06, timber);
    box(cx, fl + 1.06, rz, bx1 - bx0, 0.06, 0.1, timberL);
    for (let k = 0; k < 4; k++) box(cx, fl + 0.18 + k * 0.22, rz, bx1 - bx0 - 0.1, 0.07, 0.03, slat);
    for (const x of [bx0 + 0.04, bx1 - 0.04]) { box(x, fl + 1.06, bz / 2, 0.06, 0.06, bz, timberL); for (let k = 0; k < 4; k++) box(x, fl + 0.18 + k * 0.22, bz / 2, 0.03, 0.07, bz - 0.1, slat); box(x, fl + 0.52, 0.04, 0.06, 1.04, 0.06, timber); }
    // planters on the rail and a laundry pole bracket
    for (const x of [-2.7, -1.6, -0.3]) { box(x, fl + 1.16, rz - 0.05, 0.5, 0.14, 0.2, '#7d6a5a'); shrub(x, fl + 1.2, rz - 0.05, 0.16, 5, 1.3); }
    rod([bx0 + 0.04, fl + 1.85, 0.45], [bx1 - 0.04, fl + 1.85, 0.45], 0.018, '#8a98a0');
    for (const x of [bx0 + 0.04, bx1 - 0.04]) rod([x, fl + 1.85, 0.45], [x, fl + 1.2, 0.45], 0.014, '#8a98a0');
    box(cx, fl - 0.21, bz - 0.02, bx1 - bx0, 0.03, 0.04, '#6c7078', false);   // drip lip under the slab
  }

  // ================= upper storeys =================
  const stairX = { A: 1.3, B: 2.38 }, rise = (F2 - F) / 14, run = 0.19, ZS = -0.9, ZL = ZS - 14 * run;   // ZL: flight head / landing edge (-3.28)
  const upperWalls = (fl, top, ceil, name, frontOps, rearOps, eastOps, westOps, doorH) => {
    const layer = new THREE.Group(); layer.userData.layer = name; group('yamada').add(layer); K.setRoot(layer);
    wall('x', Z0 - T / 2, T, [X0, X1, fl, top], frontOps, plaster); wall('x', Z1 + T / 2, T, [X0, X1, fl, top], rearOps, plaster);
    wall('z', X1 - T / 2, T, [IZ1, IZ0, fl, top], westOps, plaster); wall('z', X0 + T / 2, T, [IZ1, IZ0, fl, top], eastOps, plaster);
    wall('z', PX, 0.1, [IZ1, IZ0, fl, top], [doorH], plaster);
    panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, fl, ceil], frontOps, cream); panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, fl, ceil], rearOps, cream);
    panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, fl, ceil], westOps, cream); panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, fl, ceil], eastOps, cream);
    panel('z', PX - 0.056, 0.012, [IZ1, IZ0, fl, ceil], [doorH], cream);
    return layer;
  };
  // Slab pieces [x0, x1, z0, z1] at floor level fl (top surface), thickness SLAB.
  const slab = (fl, rects, layer) => { for (const [a, b, c, d] of rects) box((a + b) / 2, fl - SLAB / 2, (c + d) / 2, b - a, SLAB, d - c, '#c9c1b0', true, layer); };
  // ---------- floor 2 ----------
  const f2Layer = upperWalls(F2, F3, CEIL2, 'f2', [A2, S2], rear(F2), east(F2), west(F2), DP2);
  slab(F2, [[IX0, FX1, IZ1, IZ0], [FX1, IX1, ZS, IZ0], [FX1, IX1, IZ1, ZL], [GX, IX1, ZL, ZS]], f2Layer);   // opening over lane A only
  mesh(tileUV(new THREE.BoxGeometry(FX1 - IX0, 0.012, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.22, planks), (IX0 + FX1) / 2, F2 + 0.006, (IZ0 + IZ1) / 2, false, f2Layer);
  mesh(tileUV(new THREE.BoxGeometry(IX1 - PX, 0.012, IZ0 - ZS), 2, 1), warm('#ffffff', 0.12, pavers), (PX + IX1) / 2, F2 + 0.006, (ZS + IZ0) / 2, false, f2Layer);
  box((IX0 + FX1) / 2, CEIL1 - 0.01, (IZ0 + IZ1) / 2, FX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false, f2Layer);
  glaze('x', -T / 2, 1, A2, [-1.8, -0.95], [], 0, false); glaze('x', -T / 2, 1, S2, [], [], 0.1);
  { K.setRoot(f2Layer); const r = rear(F2); glaze('x', Z1 + T / 2, -1, r[0]); glaze('x', Z1 + T / 2, -1, r[1], [-0.25]); glaze('x', Z1 + T / 2, -1, r[2], [], [], 0.1);
    const e = east(F2); glaze('z', X0 + T / 2, -1, e[0]); glaze('z', X0 + T / 2, -1, e[1]); glaze('z', X1 - T / 2, 1, west(F2)[0], [], [], 0.1); }
  // ---------- floor 3 ----------
  K.setRoot(group('yamada'));
  const f3Layer = upperWalls(F3, EF, CEIL3, 'f3', [A3, S3], rear(F3), east(F3), west(F3), DP3);
  slab(F3, [[IX0, FX1, IZ1, IZ0], [FX1, GX, IZ1, IZ0], [GX, IX1, IZ1, ZL], [GX, IX1, ZS, IZ0]], f3Layer);
  mesh(tileUV(new THREE.BoxGeometry(FX1 - IX0, 0.012, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.22, planks), (IX0 + FX1) / 2, F3 + 0.006, (IZ0 + IZ1) / 2, false, f3Layer);
  box((IX0 + FX1) / 2, CEIL2 - 0.01, (IZ0 + IZ1) / 2, FX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false, f3Layer);
  box((PX + IX1) / 2, CEIL2 - 0.01, (IZ0 + IZ1) / 2, IX1 - PX, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false, f3Layer);
  K.setRoot(f3Layer);
  glaze('x', -T / 2, 1, A3, [-1.8, -0.95], [], 0, false); glaze('x', -T / 2, 1, S3, [], [], 0.1);
  { const r = rear(F3); glaze('x', Z1 + T / 2, -1, r[0]); glaze('x', Z1 + T / 2, -1, r[1], [-0.25]); glaze('x', Z1 + T / 2, -1, r[2], [], [], 0.1);
    const e = east(F3); glaze('z', X0 + T / 2, -1, e[0]); glaze('z', X0 + T / 2, -1, e[1]); glaze('z', X1 - T / 2, 1, west(F3)[0], [], [], 0.1); }
  // ---------- stair: two flights (A rises towards the back to the 1st-floor landing, B returns to the front) ----------
  K.setRoot(group('yamada'));
  const stairMat = W('#b9946a', 0.26);
  const flight = (xc, base, dir, layer) => {   // dir -1: steps proceed towards -z from ZS; +1: towards +z from ZL
    for (let i = 0; i < 14; i++) { const top = base + (i + 1) * rise, z = dir < 0 ? ZS - i * run - run / 2 : ZL + i * run + run / 2;
      box(xc, top - 0.02, z, 0.7, 0.04, run + 0.02, stairMat, true, layer); box(xc, top - rise / 2, z - dir * run / 2, 0.7, rise, 0.02, woodD, false, layer); }
    const a = Math.atan2(rise, run), l = Math.hypot(14 * run, 14 * rise);
    for (const dx of [-0.34, 0.34]) { const s = box(xc + dx, base + 14 * rise / 2 - 0.02, (ZS + ZL) / 2, 0.04, 0.16, l, woodD, true, layer); s.rotation.x = dir < 0 ? a : -a; }
  };
  flight(stairX.A, F, -1, undefined); K.setRoot(f2Layer); flight(stairX.B, F2, 1, f2Layer);
  K.setRoot(group('yamada'));
  // Handrail on the wall side of each flight plus guard rails at the openings.
  rod([PX + 0.07, F + 0.9, ZS], [PX + 0.07, F2 + 0.9, ZL], 0.02, '#3d4a58');
  K.setRoot(f2Layer); rod([IX1 - 0.02, F2 + 0.9, ZL], [IX1 - 0.02, F3 + 0.9, ZS], 0.02, '#3d4a58');
  for (const z of [ZS - 0.1, (ZS + ZL) / 2, ZL + 0.1]) box(GX, F2 + 0.5, z, 0.03, 1.0, 0.03, '#3d4a58'); box(GX, F2 + 1.0, (ZS + ZL) / 2, 0.04, 0.04, ZS - ZL, '#3d4a58');
  K.setRoot(f3Layer); for (const z of [ZS - 0.1, (ZS + ZL) / 2, ZL + 0.1]) box(GX, F3 + 0.5, z, 0.03, 1.0, 0.03, '#3d4a58'); box(GX, F3 + 1.0, (ZS + ZL) / 2, 0.04, 0.04, ZS - ZL, '#3d4a58');
  // Flat doors, number plates.
  K.setRoot(f2Layer);
  { const dz = (DP2[0] + DP2[1]) / 2; box(PX - 0.06, (F2 + DP2[3]) / 2, dz, 0.06, DP2[3] - F2, DP2[1] - DP2[0], '#7d5a40'); box(PX - 0.1, 1.0 + F2, dz + 0.3, 0.03, 0.04, 0.12, '#c9c9c0'); }
  K.setRoot(f3Layer);
  { const dz = (DP3[0] + DP3[1]) / 2; box(PX - 0.06, (F3 + DP3[3]) / 2, dz, 0.06, DP3[3] - F3, DP3[1] - DP3[0], '#7d5a40'); box(PX - 0.1, 1.0 + F3, dz + 0.3, 0.03, 0.04, 0.12, '#c9c9c0'); }
  // Stair-hall ceiling lamps, one per floor at both ends of the hall.
  for (const [fl, layer] of [[F, undefined], [F2, f2Layer], [F3, f3Layer]]) { K.setRoot(layer || group('yamada')); const top = fl === F3 ? CEIL3 : fl === F2 ? CEIL2 : CEIL1;
    for (const z of [-0.6, -4.6]) { box(1.9, top - 0.04, z, 0.3, 0.05, 0.3, '#7d8b88', false); box(1.9, top - 0.07, z, 0.26, 0.02, 0.26, W('#fff4d0', 0.95), false); } }

  // ================= interior: ground-floor bicycle repair shop =================
  K.setRoot(group('yamada'));
  const paperCols = ['#e8e4d6', '#2a8a68', '#9ad0c8', '#e08a48', '#f0d36a', '#c9402f', '#cfd8e6', '#d9a7b8'];
  // shelf unit: len along axis ('x' or 'z'); small stacks of paper pads, notebooks and boxes of pens on each row
  const shelf = (axis, cx, cz, len, dep, h, y0 = F, layer, rows = 4, both = false) => {
    const A = (u, y, d, w, hh, t, c, o = true) => axis === 'x' ? box(cx + u, y, cz + d, w, hh, t, c, o, layer) : box(cx + d, y, cz + u, t, hh, w, c, o, layer);
    A(0, y0 + h / 2, 0, len, h, dep, woodD, false);
    for (const sd of both ? [-1, 1] : [1]) for (let k = 0; k < rows; k++) { const y = y0 + 0.14 + k * (h - 0.2) / rows; A(0, y, 0, len, 0.025, dep + 0.02, wood);
      const n = Math.floor(len / 0.16); for (let i = 0; i < n; i++) A(-len / 2 + 0.1 + i * (len - 0.18) / Math.max(1, n - 1), y + 0.07 + (k % 2) * 0.01, sd * dep * 0.22, 0.12, 0.11 + rnd() * 0.04, dep * (both ? 0.4 : 0.6), W(paperCols[(i * 3 + k * 2 + (rnd() * 2 | 0)) % paperCols.length], 0.34), false); }
  };
  const table = (x, z, w, d, hgt, layer, base = F, top = wood) => { box(x, base + hgt - 0.02, z, w, 0.04, d, top, true, layer);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(x + dx * (w / 2 - 0.05), base + hgt / 2, z + dz * (d / 2 - 0.05), 0.05, hgt - 0.04, 0.05, woodD, false, layer); };
  const chair = (x, z, face, base = F, c = '#6b8a9a', layer) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + dx * 0.17, base + 0.22, z + dz * 0.17, 0.035, 0.44, 0.035, woodD, false, layer);
    box(x, base + 0.45, z, 0.4, 0.04, 0.4, W(c, 0.3), true, layer); const bx = x - face[0] * 0.19, bz = z - face[1] * 0.19; box(bx, base + 0.68, bz, face[0] ? 0.03 : 0.38, 0.4, face[0] ? 0.38 : 0.03, woodD, true, layer); };
  const pendant = (x, z, y, top, c = '#e0cfa8', layer) => { rod([x, top, z], [x, y + 0.08, z], 0.006, '#3a3330', layer); mesh(new THREE.ConeGeometry(0.13, 0.15, 14, 1, true), W(c, 0.3), x, y + 0.07, z, true, layer); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false, layer); };
  const chrome = W('#cfd6d8', 0.3), tape = W('#9fc0b0', 0.3);
  // near layer: display bike on a low riser in the window, parts rack on the east wall, floor pump; reception counter with till and key board on the partition
  {
    box(-1.65, F + 0.06, -0.65, 1.9, 0.12, 0.62, woodD); box(-1.65, F + 0.13, -0.65, 1.94, 0.03, 0.66, wood);
    bike(-1.65, F + 0.14, -0.65, 'x', '#c3463a');
    box(-2.62, F + 0.9, -0.7, 0.2, 1.8, 0.8, woodD, false);
    for (let k = 0; k < 6; k++) for (let i = 0; i < 3; i++) box(-2.5, F + 0.3 + k * 0.26, -0.45 - i * 0.22, 0.02, 0.18, 0.15, W(paperCols[(k * 3 + i) % 8], 0.4), false);   // bells, lights and locks on cards
    cyl(-0.75, F + 0.4, -0.4, 0.035, 0.8, '#59656d'); box(-0.75, F + 0.82, -0.4, 0.2, 0.03, 0.04, '#2f3338'); box(-0.75, F + 0.03, -0.4, 0.24, 0.06, 0.16, '#59656d');   // floor pump
    box(0.6, F + 0.5, -1.5, 0.5, 1.0, 1.4, woodD); box(0.6, F + 1.02, -1.5, 0.56, 0.05, 1.48, W('#d8d2c0', 0.3));
    box(0.62, F + 1.16, -1.05, 0.24, 0.18, 0.28, W('#2f2a26', 0.1)); cyl(0.5, F + 1.1, -1.9, 0.04, 0.06, chrome); box(0.5, F + 1.07, -1.55, 0.14, 0.05, 0.1, W('#e8e4d6', 0.3), false);
    box(0.75, F + 1.7, -1.5, 0.05, 0.6, 1.0, woodD, false); for (let i = 0; i < 9; i++) { box(0.72, F + 1.5 + Math.floor(i / 3) * 0.18, -1.2 - (i % 3) * 0.3, 0.02, 0.1, 0.05, i % 2 ? '#c9a03a' : '#c3cacb', false); rod([0.72, F + 1.45 + Math.floor(i / 3) * 0.18, -1.2 - (i % 3) * 0.3], [0.72, F + 1.55 + Math.floor(i / 3) * 0.18, -1.2 - (i % 3) * 0.3], 0.004, '#2f3944'); }   // key board
  }
  // middle layer: workbench with vise and pegboard tool wall on the east wall, repair stand with a bike (rear wheel is live), tyre rack on the partition
  {
    box(-2.55, F + 0.45, -3.0, 0.4, 0.9, 3.1, woodD); box(-2.55, F + 0.92, -3.0, 0.46, 0.05, 3.16, '#8a6a48');
    box(-2.5, F + 1.05, -2.0, 0.14, 0.2, 0.2, '#59656d'); box(-2.5, F + 1.13, -2.0, 0.1, 0.04, 0.3, '#3a4349');   // vise
    for (const z of [-3.0, -3.7, -4.3]) { box(-2.52, F + 0.98, z, 0.28, 0.06, 0.3, W('#c9402f', 0.3)); for (let i = 0; i < 3; i++) box(-2.52 + (i - 1) * 0.07, F + 1.04, z + (i - 1) * 0.05, 0.03, 0.03, 0.22, chrome, false); }   // tool trays
    cyl(-2.5, F + 1.08, -2.7, 0.06, 0.2, W('#4f7290', 0.3));   // oil can
    box(-2.72, F + 1.6, -3.0, 0.03, 1.0, 3.0, W('#b8a888', 0.3));   // pegboard
    for (let i = 0; i < 16; i++) { const z = -1.65 - i * 0.18, y = F + 1.3 + (i % 3) * 0.28, c = ['#c3cacb', '#c9402f', '#2f3944', '#c9a03a'][i % 4]; box(-2.69, y, z, 0.02, 0.2 + (i % 2) * 0.08, 0.035, c, false); rod([-2.69, y + 0.12, z], [-2.69, y + 0.2, z], 0.004, '#2f3944'); }
    box(-2.66, F + 2.0, -3.0, 0.2, 0.05, 3.0, wood); for (let i = 0; i < 8; i++) cyl(-2.66, F + 2.1, -1.7 - i * 0.35, 0.05, 0.14, W(['#c9402f', '#e0b040', '#4f7290', '#e8e4d6'][i % 4], 0.38));   // shelf of lubricant tins
    // repair stand: heavy base, pole, clamp; bike lifted off the floor
    box(-1.15, F + 0.03, -2.95, 0.7, 0.06, 0.1, '#3a4349'); box(-1.15, F + 0.03, -2.95, 0.1, 0.06, 0.7, '#3a4349'); cyl(-1.15, F + 0.55, -2.95, 0.03, 1.1, '#c3463a'); box(-1.15, F + 1.14, -2.95, 0.14, 0.08, 0.1, '#2f3338');
    bike(-1.15, F + 0.5, -2.9, 'z', '#3f6c4f', false);
    box(-1.65, F + 0.006, -2.95, 1.7, 0.012, 2.3, W('#3d4a58', 0.12), false);   // rubber mat
    // tyre rack and parts on the partition: tyres on pegs, tubes on a rail, boxed parts
    for (let i = 0; i < 5; i++) { const t = mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 18), mat('#2a2d31'), 0.78, F + 1.55 + (i % 2) * 0.05, -2.8 - i * 0.28, false); t.rotation.y = PI / 2; }
    box(0.76, F + 1.2, -3.5, 0.05, 0.05, 1.5, wood, false); for (let i = 0; i < 6; i++) { const t = mesh(new THREE.TorusGeometry(0.1, 0.03, 5, 12), mat(['#c9a03a', '#4f7290', '#c9402f'][i % 3]), 0.76, F + 1.1, -2.9 - i * 0.24, false); t.rotation.y = PI / 2; }
    box(0.7, F + 0.45, -3.5, 0.3, 0.9, 1.7, woodD, false); for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) box(0.54, F + 0.2 + k * 0.28, -2.8 - i * 0.4, 0.02, 0.2, 0.32, W(paperCols[(k * 2 + i) % 8], 0.38), false);
    for (let i = 0; i < 2; i++) { const t = mesh(new THREE.TorusGeometry(0.33, 0.03, 6, 18), mat('#2f3338'), 0.4 - i * 0.04, F + 0.35, -4.7 + 0.02 * i, false); t.rotation.y = PI / 2; }   // spare wheels leaning at the back
  }
  // back layer: tall parts drawer chest, compressor under the window, stock shelf by the back door, hanging lamps
  {
    box(-2.1, F + 1.0, IZ1 + 0.25, 1.2, 2.0, 0.4, woodD);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) { box(-2.55 + c * 0.3, F + 0.2 + r * 0.27, IZ1 + 0.46, 0.27, 0.23, 0.02, W(paperCols[(r + c * 2) % 8], 0.3), false); box(-2.55 + c * 0.3, F + 0.2 + r * 0.27, IZ1 + 0.475, 0.1, 0.02, 0.02, chrome, false); }
    const cp = cyl(-0.85, F + 0.35, IZ1 + 0.3, 0.2, 0.7, W('#c9402f', 0.3)); cp.rotation.z = PI / 2; box(-0.85, F + 0.12, IZ1 + 0.3, 0.7, 0.04, 0.3, '#3a4349'); cyl(-0.55, F + 0.62, IZ1 + 0.3, 0.07, 0.15, '#59656d'); rod([-0.55, F + 0.7, IZ1 + 0.3], [-0.4, F + 0.2, IZ1 + 0.7], 0.012, '#2f3944');
    box(-1.0, F + 0.5, IZ1 + 0.28, 0.5, 0.05, 0.4, wood, false); for (let i = 0; i < 3; i++) box(-1.15 + i * 0.15, F + 0.3, IZ1 + 0.28, 0.12, 0.3, 0.3, W('#c9a06a', 0.3), false);
    box(0.5, F + 0.3, IZ1 + 0.45, 0.4, 0.6, 0.4, W('#c9a06a', 0.3)); box(0.45, F + 0.8, IZ1 + 0.45, 0.32, 0.4, 0.32, W('#d4ae78', 0.3));   // stock cartons by the door
    pendant(-2.15, -1.9, F + 1.95, CEIL1, '#d0c0a0'); pendant(-1.15, -2.9, F + 1.95, CEIL1, '#d0c0a0'); pendant(-1.65, -0.65, F + 1.95, CEIL1); pendant(-1.2, -4.6, F + 1.95, CEIL1, '#d0c0a0');
    for (const [x, z, l] of [[-2.0, -3.7, 1.8], [-0.4, -2.2, 1.8]]) { box(x, CEIL1 - 0.04, z, 0.14, 0.05, l + 0.04, '#7d8b88', false); box(x, CEIL1 - 0.075, z, 0.1, 0.02, l, W('#f4fff4', 0.95), false); }
    for (const [x, z, r2] of [[-1.65, -0.65, 1.8], [-1.15, -2.9, 2.6], [-2.1, -1.9, 1.6], [0.2, -1.5, 1.6], [-1.2, -4.6, 1.8]]) decal(r2, r2, x, F + 0.003, z, [0, -1], pool);
  }
  // resident lobby: mailboxes by the door, shoe rack, umbrella stand, dim lamp
  {
    box(2.82, 1.2, -0.45, 0.04, 0.5, 0.5, '#8a98a0'); for (let i = 0; i < 6; i++) box(2.79, 1.0 + (i % 3) * 0.16 + 0.1, -0.3 - Math.floor(i / 3) * 0.24, 0.02, 0.12, 0.2, '#cfd2cb', false);
    box(1.15, F + 0.2, -0.4, 0.3, 0.4, 0.4, woodD); cyl(1.15, F + 0.5, -0.6, 0.07, 0.4, W('#4f7290', 0.3), undefined);
    decal(1.4, 1.4, 1.9, F + 0.003, -0.6, [0, -1], pool);
  }

  // ================= interior: floor 2 (dining-living-kitchen) =================
  K.setRoot(f2Layer);
  for (const e of east(F2)) blind('z', X0 + T / 2, -1, e, 0.6);
  {
    // near: dining table for four with a pendant lamp behind the balcony window
    table(-1.5, -1.0, 1.2, 0.8, 0.74, f2Layer, F2, wood);
    chair(-2.35, -1.0, [1, 0], F2, '#c9a86a', f2Layer); chair(-0.65, -1.0, [-1, 0], F2, '#c9a86a', f2Layer); chair(-1.5, -1.7, [0, 1], F2, '#c9a86a', f2Layer); chair(-1.5, -0.4, [0, -1], F2, '#c9a86a', f2Layer);
    for (const dx of [-0.3, 0.1, 0.4]) cyl(-1.5 + dx, F2 + 0.78, -1.0, 0.07, 0.1, W(dx < 0 ? '#f0e8d4' : '#c9402f', 0.34), f2Layer);
    // mid: sofa against the east wall facing a TV unit on the partition, rug and low table, floor lamp
    box(-1.3, F2 + 0.012, -3.0, 1.9, 0.024, 1.9, W('#8a6f6a', 0.28), false, f2Layer);
    box(-2.2, F2 + 0.28, -3.0, 0.7, 0.5, 1.8, W('#6b8a9a', 0.3), true, f2Layer); box(-2.55, F2 + 0.6, -3.0, 0.14, 0.55, 1.8, W('#6b8a9a', 0.3), true, f2Layer);
    for (const dz of [-0.85, 0.85]) box(-2.2, F2 + 0.4, -3.0 + dz, 0.7, 0.45, 0.12, W('#5a7a8a', 0.3), true, f2Layer);
    table(-1.3, -3.0, 0.5, 0.9, 0.38, f2Layer, F2, wood);
    box(0.62, F2 + 0.3, -3.0, 0.4, 0.6, 1.4, woodD, true, f2Layer); box(0.74, F2 + 0.88, -3.0, 0.06, 0.5, 0.9, W('#2f2a26', 0.08), true, f2Layer);
    cyl(-0.3, F2 + 0.7, -4.0, 0.02, 1.4, '#3d4a58', f2Layer); mesh(new THREE.ConeGeometry(0.17, 0.2, 12, 1, true), W('#efe0c0', 0.8), -0.3, F2 + 1.45, -4.0, true, f2Layer);
    // back: kitchen run along the rear wall (sink, hob, hood), fridge in the east corner, washing machine by the landing door
    box(-1.25, F2 + 0.45, IZ1 + 0.3, 1.3, 0.9, 0.6, W('#d6cfba', 0.3)); box(-1.25, F2 + 0.92, IZ1 + 0.3, 1.34, 0.04, 0.64, steel); box(-1.55, F2 + 0.94, IZ1 + 0.3, 0.45, 0.02, 0.4, '#59656d', false);
    for (const dx of [0.15, 0.45]) box(-1.25 + dx, F2 + 0.945, IZ1 + 0.3, 0.2, 0.012, 0.2, '#2a2d31', false); box(-0.95, F2 + 1.75, IZ1 + 0.28, 0.6, 0.12, 0.4, '#8a9096', true, f2Layer);
    box(-1.55, F2 + 1.95, IZ1 + 0.18, 0.7, 0.5, 0.32, wood, true, f2Layer);
    box(-2.4, F2 + 0.9, IZ1 + 0.35, 0.6, 1.8, 0.62, W('#dfe3e0', 0.28), true, f2Layer);
    box(-0.3, F2 + 0.42, IZ1 + 0.32, 0.6, 0.84, 0.6, W('#e6e9e6', 0.3), true, f2Layer); { const d = mesh(new THREE.CircleGeometry(0.2, 18), W('#6f8a96', 0.4), -0.3, F2 + 0.44, IZ1 + 0.625, false, f2Layer); d.rotation.y = 0; }
    pot(-2.5, F2, -4.7, 0.15, 6, 2, '#8f9aa0');
    pendant(-1.5, -1.0, F2 + 1.9, CEIL2, '#e8c9a0', f2Layer); pendant(-1.3, -3.0, F2 + 1.9, CEIL2, '#d9c7a0', f2Layer);
    for (const [x, z, r2] of [[-1.5, -1.0, 2.2], [-1.3, -3.0, 2.2], [-1.2, -4.9, 1.8], [0.3, -3.0, 1.4]]) decal(r2, r2, x, F2 + 0.004, z, [0, -1], pool);
    for (const x of [A2[0] + 0.12, A2[1] - 0.12]) box(x, F2 + 1.2, IZ0 - 0.04, 0.26, 1.9, 0.05, W('#ebe0c6', 0.4), true, f2Layer);   // curtains
  }
  // ================= interior: floor 3 (bedroom and desk) =================
  K.setRoot(f3Layer);
  for (const e of east(F3)) blind('z', X0 + T / 2, -1, e, 0.35);
  {
    // near: desk and chair at the balcony window, bookshelf on the east wall; mid: rug and bed with its head on the east wall; back: chest of drawers, wardrobe on the partition
    table(-1.5, -0.6, 1.4, 0.6, 0.74, f3Layer, F3, wood); chair(-1.5, -1.1, [0, 1], F3, '#c9a86a', f3Layer);
    cyl(-0.9, F3 + 0.95, -0.55, 0.05, 0.4, '#3d4a58', f3Layer); mesh(new THREE.ConeGeometry(0.1, 0.14, 10, 1, true), W('#efe0c0', 0.8), -0.9, F3 + 1.2, -0.55, true, f3Layer);
    for (let i = 0; i < 3; i++) box(-1.9 + i * 0.15, F3 + 0.78, -0.55, 0.12, 0.03, 0.2, W(paperCols[(i * 3) % 8], 0.4), false, f3Layer);
    shelf('z', -2.6, -2.0, 1.4, 0.3, 1.8, F3, f3Layer, 4);
    box(-1.3, F3 + 0.01, -3.4, 2.2, 0.02, 1.6, W('#8a8f6a', 0.26), false, f3Layer);
    box(-1.7, F3 + 0.22, -3.7, 2.0, 0.3, 1.5, woodD, true, f3Layer); box(-1.7, F3 + 0.45, -3.7, 1.92, 0.16, 1.42, W('#d9d2e6', 0.3), true, f3Layer); box(-2.45, F3 + 0.56, -3.7, 0.3, 0.12, 1.1, W('#f0e8d4', 0.34), true, f3Layer);
    box(-1.2, F3 + 0.58, -3.7, 1.0, 0.06, 1.42, W('#7da0b0', 0.3), true, f3Layer); box(-2.62, F3 + 0.9, -3.7, 0.08, 0.9, 1.6, woodD, true, f3Layer);
    for (const dz of [-1.0, 1.0]) box(-2.4, F3 + 0.28, -3.7 + dz, 0.35, 0.4, 0.35, woodD, true, f3Layer);   // bedside tables
    box(0.58, F3 + 1.0, -3.4, 0.5, 2.0, 1.3, woodD, true, f3Layer); box(0.32, F3 + 1.0, -3.4, 0.02, 1.9, 0.02, wood, false, f3Layer);   // wardrobe on the partition
    box(-0.8, F3 + 0.45, IZ1 + 0.3, 1.1, 0.9, 0.5, W('#cfc6b0', 0.3), true, f3Layer); for (let i = 0; i < 3; i++) box(-0.8, F3 + 0.2 + i * 0.28, IZ1 + 0.56, 1.0, 0.02, 0.02, wood, false, f3Layer);
    box(IX0 + 0.1, F3 + 1.7, -3.4, 0.05, 0.4, 0.6, W('#4a5a50', 0.2), false, f3Layer);   // framed print on the east wall
    pot(-0.2, F3, -1.5, 0.15, 6, 1.8, '#8f9aa0');
    pendant(-1.5, -3.2, F3 + 1.95, CEIL3, '#e8c9a0', f3Layer); pendant(-1.5, -0.6, F3 + 1.95, CEIL3, '#e0cfa8', f3Layer);
    for (const [x, z, r2] of [[-1.5, -0.7, 1.8], [-1.4, -3.2, 2.6], [-0.3, -4.8, 1.4]]) decal(r2, r2, x, F3 + 0.004, z, [0, -1], pool);
    for (const x of [A3[0] + 0.12, A3[1] - 0.12]) box(x, F3 + 1.2, IZ0 - 0.04, 0.26, 1.9, 0.05, W('#e6d6c0', 0.4), true, f3Layer);
  }

  // ================= standing-seam hip roof (roof layer): near-pyramid, vent box at the apex =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('yamada').add(roofLayer); K.setRoot(roofLayer);
  box((IX0 + IX1) / 2, CEIL3 + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false);
  const xa = X0 - OV, xb = X1 + OV, za = Z1 - OV, zb = Z0 + OV, ye = EF - OV * SL, W2 = xb - xa, D2 = zb - za, hh = Math.min(W2, D2) / 2, yr = ye + SL * hh;
  const xc = (xa + xb) / 2, zc = (za + zb) / 2, rx0 = xc - (W2 / 2 - hh), rx1 = xc + (W2 / 2 - hh), rz0 = zc - (D2 / 2 - hh), rz1 = zc + (D2 / 2 - hh);   // ridge segment, nearly a point
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const face = pts => {
    pts = pts.filter((p, i) => p.distanceTo(pts[(i + pts.length - 1) % pts.length]) > 1e-4);
    const p0 = pts[0], u = pts[1].clone().sub(p0).normalize(), c = pts[2].clone().sub(p0);
    let n = u.clone().cross(c).normalize(); if (n.y < 0) n.negate();
    const v = n.clone().cross(u), sh = new THREE.Shape(pts.map(P => { const d = P.clone().sub(p0); return new THREE.Vector2(d.dot(u), d.dot(v)); }));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 1 }), o = p0.clone().addScaledVector(n, -0.1);
    const m = mesh(g, roofM, o.x, o.y, o.z); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)); return m;
  };
  face([V(xa, ye, zb), V(xb, ye, zb), V(rx1, yr, rz1), V(rx0, yr, rz1)]);
  face([V(xb, ye, za), V(xa, ye, za), V(rx0, yr, rz0), V(rx1, yr, rz0)]);
  face([V(xa, ye, za), V(xa, ye, zb), V(rx0, yr, rz1), V(rx0, yr, rz0)]);
  face([V(xb, ye, zb), V(xb, ye, za), V(rx1, yr, rz0), V(rx1, yr, rz1)]);
  box(xc, yr + 0.1, zc, rx1 - rx0 + 0.3, 0.1, 0.3, '#2a323d');
  for (const [a, b] of [[[xa, ye, zb], [rx0, yr, rz1]], [[xb, ye, zb], [rx1, yr, rz1]], [[xa, ye, za], [rx0, yr, rz0]], [[xb, ye, za], [rx1, yr, rz0]]]) rod([a[0], a[1] + 0.08, a[2]], [b[0], b[1] + 0.1, b[2]], 0.06, '#2a323d');
  for (const [z, o] of [[zb, 1], [za, -1]]) { const g = mesh(new THREE.CylinderGeometry(0.065, 0.065, xb - xa, 10, 1, true, 0, PI), mat('#8796a0'), (xa + xb) / 2, ye - 0.04, z + o * 0.04); g.rotation.z = PI / 2; g.rotation.x = o > 0 ? PI : 0; box((xa + xb) / 2, ye + 0.02, z + o * 0.02, xb - xa, 0.1, 0.04, '#2a323d'); }
  for (const [x, o] of [[xa, -1], [xb, 1]]) { const g = mesh(new THREE.CylinderGeometry(0.05, 0.05, zb - za, 8, 1, true), mat('#8796a0'), x + o * 0.04, ye - 0.06, (za + zb) / 2); g.rotation.x = PI / 2; box(x + o * 0.02, ye + 0.02, (za + zb) / 2, 0.04, 0.1, zb - za, '#2a323d'); }
  // Louvred vent box on legs over the apex, roof hatch on the front slope, TV antenna on a mast on the front-west slope.
  { const roofY = (x, z) => ye + SL * Math.min(x - xa, xb - x, z - za, zb - z), sm = mat('#8796a0'), py = yr + 0.42;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const x = xc + dx * 0.36, z = zc + dz * 0.32; rod([x, roofY(x, z) - 0.03, z], [x, py, z], 0.03, sm); }
    box(xc, py + 0.03, zc, 0.88, 0.06, 0.76, '#5f6c76'); box(xc, py + 0.4, zc, 0.84, 0.7, 0.72, W('#b7c0c2', 0.2)); box(xc, py + 0.78, zc, 0.94, 0.06, 0.82, '#4b5660');
    for (let i = 0; i < 6; i++) { box(xc, py + 0.16 + i * 0.1, zc + 0.365, 0.7, 0.045, 0.02, '#6d7a82', false); box(xc + 0.425, py + 0.16 + i * 0.1, zc, 0.02, 0.045, 0.6, '#6d7a82', false); }
    cyl(xc, py + 0.88, zc, 0.07, 0.14, '#59656d'); mesh(new THREE.ConeGeometry(0.12, 0.08, 8), sm, xc, py + 0.99, zc, false);
    const hx = -1.4, hz2 = zc + 1.3, hy = roofY(hx, hz2); box(hx, hy + 0.1, hz2, 0.5, 0.2, 0.5, '#8a9096'); box(hx, hy + 0.22, hz2, 0.4, 0.04, 0.4, '#bcd2d8', false);
    const mx = 1.3, mz = zc + 1.4, my = roofY(mx, mz) - 0.02; rod([mx, my, mz], [mx, my + 1.5, mz], 0.02, sm);
    for (let i = 0; i < 4; i++) rod([mx, my + 0.7 + i * 0.22, mz - 0.35 + 0.07 * i], [mx, my + 0.7 + i * 0.22, mz + 0.35 - 0.07 * i], 0.01, sm);
    rod([mx, my + 1.4, mz - 0.25], [mx, my + 1.4, mz + 0.25], 0.012, sm); }
  group('yamada');
  // Downpipes with refrigerant/gas runs on the stair-hall (west) side wall and the rear-east corner.
  for (const [x, z] of [[X1 + 0.02, Z0 - 0.1], [X0 - 0.02, Z1 + 0.1]]) { cyl(x, (ye - 0.1 + 0.3) / 2, z, 0.04, ye - 0.4, '#8796a0'); for (const y of [0.9, 2.1, 3.8, 5.0, 6.5, 8.0]) rod([x, y, z], [x, y, z + (z > -2 ? -0.1 : 0.1)], 0.012, '#5f6c76'); box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91'); }
  for (let i = 0; i < 2; i++) { const z = -1.0 - i * 3.6; cyl(X1 + 0.05, (F + F3 + 2.5) / 2, z, 0.025, F3 + 2.5 - F, '#6f7a82'); for (const y of [1.5, 3.4, 5.2, 6.6]) box(X1 + 0.04, y, z, 0.06, 0.04, 0.1, '#5f6c76', false); }
  box(X1 + 0.08, 1.45, -3.8, 0.16, 0.45, 0.3, '#cdd0c9'); box(X1 + 0.165, 1.5, -3.8, 0.01, 0.13, 0.18, '#7b8a92', false);
  box(X0 - 0.04, 3.5, -5.0, 0.08, 0.3, 0.36, '#c4c7c0'); for (let i = 0; i < 4; i++) box(X0 - 0.085, 3.4 + i * 0.07, -5.0, 0.012, 0.012, 0.3, '#7f8b93', false);
  // AC outdoor units on brackets under the small hall windows (front wall, right of the balconies).
  for (const fl of [F2, F3]) { box(2.62, fl + 0.38, 0.22, 0.56, 0.5, 0.3, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.14, 16), mat('#3b4650'), 2.55, fl + 0.38, 0.375, false);
    for (const x of [2.4, 2.84]) box(x, fl + 0.08, 0.1, 0.04, 0.06, 0.2, '#6f7a82', false); }

  // ================= lean-to bicycle shed on the residents' (west) side, front half; sloping polycarbonate roof, timber frame =================
  {
    const x0 = 3.05, x1 = 4.35, z0 = -4.0, z1 = -0.45, hi = 2.55, lo = 2.15, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, G = 0.19, fr = '#7a5a3c';
    for (const [x, z, h] of [[x1 - 0.04, z1 - 0.04, lo], [x1 - 0.04, z0 + 0.04, lo], [x1 - 0.04, cz, lo], [x0 + 0.04, z1 - 0.04, hi], [x0 + 0.04, z0 + 0.04, hi]]) box(x, G + h / 2, z, 0.07, h, 0.07, fr);
    const r = box(cx, G + (hi + lo) / 2 + 0.02, cz, Math.hypot(x1 - x0, hi - lo) + 0.1, 0.04, z1 - z0 + 0.1, new THREE.MeshPhysicalMaterial({ color: 0xbfe0e6, transparent: true, opacity: 0.4, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }), true); r.rotation.z = -Math.atan2(hi - lo, x1 - x0);
    for (let i = 0; i <= 4; i++) { const z = z0 + i * (z1 - z0) / 4, b = box(cx, G + (hi + lo) / 2 + 0.05, z, Math.hypot(x1 - x0, hi - lo) + 0.1, 0.05, 0.05, fr, false); b.rotation.z = -Math.atan2(hi - lo, x1 - x0); }   // rafters
    // low timber-slat fence on the plot-edge side and a block half wall at the back
    for (let i = 0; i < 10; i++) box(x1, G + 0.35, z0 + 0.1 + i * (z1 - z0 - 0.2) / 9, 0.03, 0.7, 0.2, i % 2 ? '#a5764a' : '#b98a58');
    box(x1, G + 0.72, cz, 0.05, 0.05, z1 - z0, fr, false);
    box(cx, G + 0.45, z0 - 0.02, x1 - x0, 0.9, 0.08, '#a29e94');
    bike(3.5, G + 0.0, -1.35, 'z', '#c3463a'); bike(4.05, G + 0.0, -1.15, 'z', '#4f7290'); bike(3.55, G + 0.0, -3.0, 'z', '#3f6c4f');
    for (let i = 0; i < 3; i++) box(x0 + 0.2 + i * 0.4, G + 0.2, z1 - 0.1, 0.02, 0.4, 0.4, '#59656d', false);   // wheel-rack hoops at the street end
    mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.012, z1 - z0), 1, 2), warm('#ffffff', 0.04, pavers), cx, 0.2, cz, false);
  }

  // ================= forecourt, residents' door side, east side wall and tree, west block wall, rear utilities =================
  group('yamadaFrontW');
  {
    // chalkboard A-frame by the shop door, two bikes for sale, spare tyres, planters
    const bx = -0.98, bz = 1.15, bd = board(256, 320, [['山田修理舗', 40, 26, 'serif', '#f0c987'], ['パンク修理', 100, 26], ['¥1,200 ~', 140, 22, 'sans-serif', '#c7d0a0'], ['雨の日の', 210, 22, 'sans-serif', '#c7d0a0'], ['ブレーキ点検', 244, 22, 'sans-serif', '#c7d0a0'], ['無料です', 278, 22, 'sans-serif', '#c7d0a0']], '#25312c');
    for (const s of [-1, 1]) { const p = box(bx, 0.19 + 0.45, bz + s * 0.12, 0.6, 0.9, 0.04, '#7a5c44'); p.rotation.x = s * 0.2; }
    { const p = mesh(new THREE.PlaneGeometry(0.52, 0.74), lit(bd, '#1f2a24'), bx, 0.19 + 0.46, bz + 0.13 + 0.01, false); p.rotation.x = -0.2; }
    bike(-2.35, 0.19, 1.1, 'x', '#4f7290'); box(-2.35, 0.19 + 0.2, 1.1, 0.02, 0.02, 0.02, '#2f3338', false);
    for (let i = 0; i < 4; i++) { const t = mesh(new THREE.TorusGeometry(0.28, 0.045, 6, 16), mat('#2a2d31'), -3.6, 0.19 + 0.05 + i * 0.09, 0.7, false); t.rotation.x = PI / 2; }   // stack of tyres
    pot(-3.5, 0.19, 1.6, 0.14, 4, 1.3, '#9b7d68'); pot(-1.45, 0.19, 0.5, 0.15, 5, 1.4, '#7d6a5a');
  }
  group('yamadaFrontE');
  {
    box(2.5, 0.19 + 0.55, 0.62, 0.3, 1.1, 0.12, '#8a98a0'); for (let i = 0; i < 3; i++) box(2.5, 0.19 + 0.3 + i * 0.3, 0.69, 0.22, 0.2, 0.01, '#cfd2cb', false);
    pot(1.1, 0.19, 0.95, 0.15, 5, 1.5, '#7d6a5a'); pot(2.1, 0.19, 1.2, 0.18, 6, 1.8, '#8f9aa0'); box(DX, 0.275, 0.35, 0.8, 0.012, 0.5, '#5d5248', false);
    cyl(1.0, 0.19 + 0.28, 0.4, 0.1, 0.56, W('#4f7290', 0.3)); for (const x of [0.96, 1.04]) rod([x, 0.19 + 0.5, 0.4], [x + 0.02, 0.19 + 0.95, 0.42], 0.012, '#2f3944');
  }
  group('yamadaEast');
  {
    // concrete-block wall along the east plot edge with shrubs, a meter box and a drain cover; a tree behind the workshop
    const bx = -4.4, z0 = -5.9, z1 = -0.5, cz = (z0 + z1) / 2;
    box(bx, 0.19 + 0.45, cz, 0.14, 0.9, z1 - z0, '#a29e94'); box(bx, 0.19 + 0.92, cz, 0.2, 0.05, z1 - z0 + 0.04, '#bdb8ac');
    for (let r = 0; r < 4; r++) box(bx + 0.074, 0.19 + 0.12 + r * 0.23, cz, 0.006, 0.01, z1 - z0, '#6f6b63', false);
    for (let i = 0; i < 14; i++) box(bx + 0.074, 0.19 + 0.45, z0 + 0.17 + i * 0.37, 0.006, 0.9, 0.012, '#6f6b63', false);
    shrub(-4.1, 0.19 + 0.3, -1.2, 0.2, 6, 1.6); shrub(bx, 1.15, -3.0, 0.14, 5, 1.4); shrub(-4.05, 0.19 + 0.3, -3.6, 0.22, 7, 1.8);
    cyl(-3.75, 0.19 + 1.0, -5.0, 0.09, 2.0, '#6b4c36');   // trunk
    for (const [dx, dy, dz, r] of [[0, 2.4, 0, 0.75], [0.3, 2.0, 0.25, 0.55], [-0.3, 2.1, -0.25, 0.55], [0.1, 2.9, -0.1, 0.5], [-0.35, 2.6, 0.3, 0.45]]) { const a = mesh(new THREE.SphereGeometry(1, 7, 5), mat(LEAF[(dx > 0) * 1 + (dz > 0) * 1]), -3.75 + dx, 0.19 + dy, -5.0 + dz, false); a.scale.setScalar(r); }
    box(-4.2, 0.19 + 0.3, -4.3, 0.1, 0.5, 0.3, '#b7bbb6'); box(-4.145, 0.19 + 0.36, -4.3, 0.01, 0.22, 0.2, '#7b8a92', false);
  }
  group('yamadaWest');
  {
    // block wall behind the shed on the west plot edge with a timber gate, planter and a rain barrel
    const bx = 4.4, z0 = -6.0, z1 = -4.15, cz = (z0 + z1) / 2;
    box(bx, 0.19 + 0.55, cz, 0.14, 1.1, z1 - z0, '#a29e94'); box(bx, 0.19 + 1.12, cz, 0.2, 0.05, z1 - z0 + 0.04, '#bdb8ac');
    for (let r = 0; r < 5; r++) box(bx - 0.074, 0.19 + 0.12 + r * 0.23, cz, 0.006, 0.01, z1 - z0, '#6f6b63', false);
    for (let i = 0; i < 5; i++) box(3.4, 0.19 + 0.8, -4.3 - i * 0.12, 0.03, 1.6, 0.1, i % 2 ? '#8a6a48' : '#a5764a', false);   // timber gate boards leaning at the rear corner
    cyl(3.5, 0.19 + 0.35, -5.5, 0.22, 0.7, W('#6d7d84', 0.3)); cyl(3.5, 0.19 + 0.72, -5.5, 0.23, 0.03, '#59656d');
    pot(3.2, 0.19, -4.35, 0.15, 5, 1.4, '#7d6a5a');
  }
  group('yamadaRear');
  {
    // back-door step mat, two bins, AC outdoor units on a stand, meter cabinet, two LPG cylinders chained to the wall
    box((BD[0] + BD[1]) / 2, 0.19 + 0.015, Z1 - 0.3, 0.9, 0.03, 0.34, '#5d5248', false);
    for (const [x, c] of [[-1.3, '#4f7290'], [-0.85, '#3f6c4f']]) { box(x, 0.19 + 0.3, Z1 - 0.34, 0.38, 0.6, 0.34, c); box(x, 0.19 + 0.62, Z1 - 0.34, 0.42, 0.04, 0.38, '#2f3944'); }
    box(1.55, 0.19 + 0.05, Z1 - 0.3, 1.0, 0.1, 0.42, '#7f8b93'); for (const x of [1.3, 1.8]) { box(x, 0.19 + 0.4, Z1 - 0.3, 0.46, 0.6, 0.34, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.15, 16), mat('#3b4650'), x - 0.04, 0.19 + 0.4, Z1 - 0.472, false).rotation.y = PI; }
    box(2.55, 0.19 + 0.55, Z1 - 0.28, 0.6, 1.1, 0.34, '#a8aeb0'); box(2.55, 0.19 + 0.55, Z1 - 0.455, 0.56, 1.0, 0.01, '#8f9a9f', false); box(2.7, 0.19 + 0.6, Z1 - 0.47, 0.025, 0.2, 0.025, '#59656d');
    for (const x of [-2.45, -2.1]) { cyl(x, 0.19 + 0.4, Z1 - 0.3, 0.15, 0.8, W('#9aa7a2', 0.25)); cyl(x, 0.19 + 0.84, Z1 - 0.3, 0.1, 0.08, '#c9402f'); cyl(x, 0.19 + 0.9, Z1 - 0.3, 0.025, 0.05, '#c3cacb'); }
    rod([-2.65, 0.19 + 0.6, Z1 - 0.3], [-1.95, 0.19 + 0.6, Z1 - 0.3], 0.01, '#3a4349'); box(-2.28, 0.19 + 0.6, Z1 - 0.12, 0.7, 0.03, 0.03, '#3a4349', false);
    pot(-3.0, 0.19, Z1 - 0.3, 0.15, 5, 1.4);
  }
  group('yamadaGround');
  const paveMat = warm('#ffffff', 0, pavers), pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-4.45, 4.45, 0, 2.0); pave(-4.45, 4.45, -6.6, -5.6); pave(3.0, 4.45, -5.6, 0); pave(-4.45, -2.9, -5.6, 0);
  box(0, 0.214, 1.0, 1.7, 0.014, 0.5, '#5d5248', false);
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(3.0, 1.2, -1.7, 0.208, 1.4, [0, -1], spill); decal(1.5, 1.0, 0, 0.226, 1.2, [0, -1], spill); decal(1.4, 0.9, DX, 0.226, 1.0, [0, -1], additive(spillT, '#ffbf7a', 0.2));
  decal(1.2, 0.5, (BD[0] + BD[1]) / 2, 0.208, Z1 - 0.3, [0, 1], additive(glowT, '#ffc27e', 0.2));

  // ================= local animation: hanging wheel sign and the repair-stand wheel turn, window rain runs, eave and shed drips, warm window glow breathing =================
  const fx = new THREE.Group(); fx.userData.live = true; group('yamada').add(fx); K.setRoot(fx);
  const signWheel = wheel(0.28, '#2a1e19'); signWheel.position.set(-2.8, 1.97, 0.52); fx.add(signWheel);
  mesh(new THREE.PlaneGeometry(0.9, 1.0), additive(glowT, '#ffd9a0', 0.12), -2.8, 1.97, 0.52, false, fx).rotation.y = -PI / 2;
  const standWheel = wheel(0.33); standWheel.position.set(-1.15, F + 0.5 + 0.35, -2.9 - 0.55); fx.add(standWheel);
  const upGlow = additive(glowT, '#ffd9a0', 0.1); mesh(new THREE.PlaneGeometry(3.4, 1.8), upGlow, -1.4, F2 + 1.2, 1.0, false, fx);
  const upGlow3 = additive(glowT, '#ffd9a0', 0.07); mesh(new THREE.PlaneGeometry(3.4, 1.8), upGlow3, -1.4, F3 + 1.2, 1.0, false, fx);
  const shopGlow = additive(glowT, '#ffe2b0', 0.2); mesh(new THREE.PlaneGeometry(3.6, 2.0), shopGlow, -1.5, 1.35, 0.2, false, fx);
  const batch = (c, o, par = fx) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; par.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6);
  for (const [w, n] of [[FW, 8], [A2, 7], [A3, 7]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 0.8, w === FW ? 0.06 : 0.1, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 18; i++) drips.add(-3.0 + i * 0.36 + rnd() * 0.1, 3.0 + rnd() * 5.0, 0.4, 0.1, 2.9, 8.5, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 6; i++) drips.add(-2.6 + i * 0.65 + rnd() * 0.1, 0.25 + rnd() * 1.9, 0.76, 0.09, 0.25, 2.5, 2.1 + rnd() * 0.5);
  const shedFx = new THREE.Group(); shedFx.userData.live = true; group('yamada').add(shedFx); K.setRoot(shedFx);
  const sdrips = batch('#cee7e5', 0.6, shedFx);
  for (let i = 0; i < 6; i++) sdrips.add(4.4, 0.3 + rnd() * 1.7, -0.5 - i * 0.58, 0.1, 0.25, 2.1, 2.2 + rnd() * 0.4);
  runs.seal(); drips.seal(); sdrips.seal();
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt); sdrips.step(dt);
      signWheel.rotation.x += dt * 0.5;   // the hanging wheel sign turns slowly in the draught
      standWheel.rotation.x -= dt * (1.2 + 0.6 * Math.sin(t * 0.5));   // the wheel on the repair stand spins, easing up and down
      shopGlow.opacity = 0.17 + 0.05 * Math.sin(t * 0.7) * Math.sin(t * 0.29 + 1);
      upGlow.opacity = 0.09 + 0.025 * Math.sin(t * 0.5 + 2); upGlow3.opacity = 0.065 + 0.02 * Math.sin(t * 0.41 + 4);
    },
  };
};
