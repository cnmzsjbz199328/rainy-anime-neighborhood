// B06-P05 独栋住宅 12 (detached house 12): pale blue-grey two-storey cube with a flat roof and parapet (rooftop AC units and a hatch), the upper storey set back 1.2 behind the ground-floor front so the front
// annex's flat roof becomes a small terrace (low parapet, planters, a bench, laundry swaying on a pole) that also shelters the front door, corner windows, a carport with a flat polycarbonate roof on the east
// (the viewer's right), a block-wall and railing garden with the street (west) side planted, AC unit / water heater / bins on the west strip, deeper rear yard; the corner plot (N and W frontages) of the B06 south row.
// Task card docs/buildings/tasks/B06-P05.md, reference docs/buildings/references/B06-P05.jpg. Twelfth house of stage 6. The card repeats B02-P04's pale blue-grey flat-roofed cube; this one differs in massing
// (stepped front with a roof terrace), carport side (viewer's right, local -x because it faces north), mirrored plan (stair along the carport-side wall rising to the back), bathroom upstairs at the back and laundry.
// Local frame (placed by layout.js `buildings`, rotY pi: front +z faces the alley to the NORTH (world -z), local +x = world W = the viewer's left when facing the front): origin = the front door (world x 11);
// the front wall is at local z 0 = world z 36.6; buildable local x -4…3 (the west setback is doubled on this corner plot), z +0.6…-7.9.
// House body x -1.55…2.85 (4.4), z -6.5…0 (upper storey z -1.2…-6.5); front terrace/ledge to z +0.45; carport x -3.9…-1.6, z +0.5…-5.0; parapet top 6.0, rooftop units to 6.9.
// Groups: house12 (shell, floors, stair, terrace, roof, parapet, carport, car) · house12Step · house12Garden · house12FrontE · house12West · house12East · house12Rear · house12Ground.
// Layers: f2 (upper storey), roof. Plan, ground: genkan east of the door, stair along the east (carport-side) wall behind it rising to the back with the WC behind the stair, living room at the front-west,
// kitchen-dining along the west wall and the rear sliding door. Upper: bedroom at the front opening onto the terrace, study at the back, bath at the back-west corner, landing over the WC.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B06-P05'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(5712), PI = Math.PI;
  const F = rec.floor, F2 = F + 2.75, EF = F2 + 2.55, X0 = -1.55, X1 = 2.85, Z0 = 0, Z1 = -6.5, ZU = -1.2, T = 0.15, BASE = 0.19, SLAB = 0.2, PAR = 0.4, TP = 0.4;
  const CEIL1 = F2 - SLAB, CEIL2 = EF - 0.12;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T, IZU = ZU - T;
  const DXc = 0;
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z (z negative towards the back).
  const FD = [-0.45, 0.45, F, F + 2.1], FW = [0.9, 2.6, F + 0.45, F + 1.95], FS = [-1.2, -0.75, F + 0.9, F + 1.7];
  const UD = [0.45, 2.3, F2 + 0.05, F2 + 2.0], UW = [-1.2, -0.75, F2 + 0.9, F2 + 1.8];
  const RS = [0.6, 2.5, F, F + 2.2], RWC = [-1.2, -0.75, F + 1.3, F + 1.9];
  const RU = [[0.0, 1.0, F2 + 0.8, F2 + 1.9], [1.7, 2.4, F2 + 1.1, F2 + 1.9]];
  const EG = [[-3.4, -2.9, F + 0.7, F + 2.0], [-5.7, -5.2, F + 1.3, F + 1.9]], EU = [[-1.6, -2.6, F2 + 0.7, F2 + 1.9], [-5.0, -4.5, F2 + 1.2, F2 + 1.9]];   // EU[0]: corner window next to the front corner
  const LG = [[-1.5, -0.9, F + 0.9, F + 1.9], [-4.8, -4.0, F + 0.9, F + 1.8]], LU = [[-1.8, -2.9, F2 + 0.7, F2 + 1.9], [-5.0, -4.4, F2 + 1.2, F2 + 1.9]];
  const ZS = -1.6, ZL = -4.3, SXc = -0.95, HW = -0.52;   // stair flight along the east wall: x -1.33…-0.57, bottom at z ZS (floor), head at z ZL (2F level), climbing towards the back; HW: x of the stair-hall wall

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#98a9c0'), timber = '#5a4030', slat = '#a97a4e', stoneC = '#9a958b', alu = '#3a4350', trim = '#4f5559';
  const wcache = {}, W = (c, k = 0.3) => wcache[c + k] || (wcache[c + k] = warm(c, k));
  const wood = W('#b0814f'), woodD = W('#6f4a35', 0.26), cream = W('#efe4cc', 0.34), steel = W('#c3cacb', 0.22);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' });
  const planks = tex(256, 256, (q, w, h) => { for (let r = 0; r < 8; r++) { q.fillStyle = `hsl(${30 + rnd() * 6},${34 + rnd() * 10}%,${52 + rnd() * 8}%)`; q.fillRect(0, r * 32, w, 32);
    q.fillStyle = 'rgba(70,44,28,.5)'; q.fillRect(0, r * 32, w, 1.5); q.fillRect(rnd() * 200 + 28, r * 32, 1.5, 32); } });
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

  // ---- plants ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), LEAF = ['#6c9476', '#88a98a', '#5e8a6a'];
  const shrub = (x, y, z, r, n, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(LEAF[i % 3]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.35 + rnd() * r * h, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.45 + rnd() * 0.25)); } };
  const pot = (x, y, z, r, n = 5, h = 1, c = '#9b7d68') => { mesh(new THREE.CylinderGeometry(r, r * 0.76, r * 1.15, 10), mat(c), x, y + r * 0.575, z); shrub(x, y + r * 1.1, z, r, n, h); };

  // ---- house materials: pale blue-grey plaster, dark steel frames, timber cladding ----
  const plankV = tex(128, 128, (q, w, h) => { for (let c = 0; c < 8; c++) { q.fillStyle = `hsl(${28 + rnd() * 6},${38 + rnd() * 8}%,${44 + rnd() * 8}%)`; q.fillRect(c * 16, 0, 16, h); q.fillStyle = 'rgba(50,30,18,.55)'; q.fillRect(c * 16, 0, 1.5, h); }
    for (let i = 0; i < 180; i++) { q.fillStyle = 'rgba(40,24,14,.12)'; q.fillRect(rnd() * w, rnd() * h, 1, 5 + rnd() * 8); } });
  const claddingM = warm('#ffffff', 0.22, plankV);
  const steelC = '#4a4f57', coping = '#cfd6de', belt = '#8d9db3';
  // ---- glazing: near-black aluminium frames ----
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

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const face = pts => {
    const p0 = pts[0], u = pts[1].clone().sub(p0).normalize(), c = pts[2].clone().sub(p0);
    let n = u.clone().cross(c).normalize(); if (n.y < 0) n.negate();
    const v = n.clone().cross(u), sh = new THREE.Shape(pts.map(P => { const d = P.clone().sub(p0); return new THREE.Vector2(d.dot(u), d.dot(v)); }));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 1 }), o = p0.clone().addScaledVector(n, -0.1);
    const m = mesh(g, roofM, o.x, o.y, o.z); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)); return m;
  };

  // ================= ground-floor shell =================
  group('house12');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, F2], [FD, FW, FS], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, F2], [RS, RWC], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, F2], LG, plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, F2], EG, plaster);
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FD[0], Z0, 1); plinth('x', FD[1], X1, Z0, 1); plinth('x', X0, RS[0], Z1, -1); plinth('x', RS[1], X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  box((X0 + X1) / 2, F2 - 0.1, Z1 - 0.012, X1 - X0 + 0.06, 0.2, 0.04, belt);
  for (const [x, o] of [[X0, -1], [X1, 1]]) box(x + o * 0.012, F2 - 0.1, Z0 + (Z1 - Z0) / 2, 0.04, 0.2, Z0 - Z1 + 0.06, belt);
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.2, planks), (IX0 + IX1) / 2, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  mesh(tileUV(new THREE.BoxGeometry(0.5 - IX0, 0.014, IZ0 + 1.55), 1, 1), warm('#ffffff', 0.1, pavers), (IX0 + 0.5) / 2, F + 0.007, (IZ0 - 1.55) / 2, false);   // genkan tile (x -1.4…0.5)
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL1], [FD, FW, FS], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL1], LG, cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL1], EG, cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL1], [RS, RWC], cream);
  // ground partitions: stair-hall wall at x HW (doorway to the WC at the back), WC front wall at z -4.3, genkan wall at x 0.5 with a doorway into the living room
  wall('z', HW, 0.1, [IZ1, ZS, F, CEIL1], [[-5.5, -4.7, F, F + 2.0]], plaster);
  wall('x', ZL, 0.1, [IX0, HW, F, CEIL1], [], plaster);
  wall('z', 0.5, 0.1, [-1.55, IZ0, F, CEIL1], [[-1.3, -0.4, F, F + 2.0]], plaster);

  // ---- exterior: windows, rear sliding door, front door ----
  glaze('x', -T / 2, 1, FS, [], [], 0.1); glaze('x', -T / 2, 1, FW, [1.75]);
  glaze('x', Z1 + T / 2, -1, RWC, [], [], 0.1);
  for (const w of LG) glaze('z', X1 - T / 2, 1, w, [], [], w === LG[0] ? 0.1 : 0);
  for (const w of EG) glaze('z', X0 + T / 2, -1, w, [], [], 0.1);
  // rear sliding door to the garden: two leaves with handles
  { const [a, b, p, q] = RS, m = (a + b) / 2, z = Z1 + T / 2, fd = 0.1;
    ab('x', a + 0.03, (p + q) / 2, z, 0.06, q - p, fd, alu); ab('x', b - 0.03, (p + q) / 2, z, 0.06, q - p, fd, alu); ab('x', m, (p + q) / 2, z, 0.06, q - p, fd, alu); ab('x', m, q - 0.03, z, b - a, 0.06, fd, alu); ab('x', m, p + 0.05, z, b - a, 0.1, fd, alu);
    ab('x', (a + m) / 2, (p + q) / 2, z, m - a - 0.06, q - p - 0.08, 0.012, glass, false); ab('x', (m + b) / 2, (p + q) / 2, z, b - m - 0.06, q - p - 0.08, 0.012, glass, false);
    for (const x of [m - 0.1, m + 0.1]) ab('x', x, F + 1.0, z - 0.06, 0.02, 0.2, 0.03, '#c9c9c0'); }
  // Front door under the terrace slab: timber leaf with a tall lit glass slit, long vertical handle, wall lamp
  {
    ab('x', FD[0] + 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, steelC); ab('x', FD[1] - 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, steelC); box(DXc, FD[3] - 0.04, -T / 2, 0.9, 0.08, 0.16, steelC);
    box(DXc, (F + FD[3] - 0.08) / 2, -0.05, 0.82, FD[3] - 0.08 - F, 0.05, '#9a6e44');
    for (let i = 0; i < 10; i++) box(DXc - 0.32 + i * 0.07, F + 0.95, -0.012, 0.012, 1.8, 0.012, '#7a5a3c', false);
    box(DXc + 0.25, F + 1.45, 0.0, 0.1, 1.0, 0.012, W('#fff0c8', 0.9), false); box(DXc - 0.3, F + 1.1, 0.02, 0.025, 0.8, 0.03, '#c9c9c0');
    box(0.75, 1.5, 0.03, 0.12, 0.08, 0.03, '#8a98a0'); box(0.7, 2.2, 0.07, 0.14, 0.16, 0.1, '#3d4a58'); box(0.7, 2.19, 0.07, 0.1, 0.12, 0.105, bulb, false);
    mesh(new THREE.PlaneGeometry(1.0, 1.0), additive(glowT, '#ffc27e', 0.22), 0.7, 2.18, 0.04, false);
    box(DXc, 0.255, 0.25, 1.5, 0.1, 0.5, '#a8a091'); box(DXc, 0.215, 0.1, 1.6, 0.03, 0.2, '#8e8a80', false);   // porch slab (the lower steps are in house12Step)
  }
  // front terrace on the ground-floor roof: slab to z 0.45 with a thick edge, low parapet on three sides, planters, bench, laundry pole (the laundry sways below); in the f2 layer so the ground-floor cutaway lifts it
  const terrLayer = new THREE.Group(); terrLayer.userData.layer = 'f2'; group('house12').add(terrLayer); K.setRoot(terrLayer);
  {
    box((X0 + X1) / 2, F2 - 0.1, (0.45 + ZU) / 2, X1 - X0 + 0.1, 0.2, 0.45 - ZU, coping); box((X0 + X1) / 2, F2 - 0.27, 0.43, X1 - X0 + 0.1, 0.04, 0.04, '#9aa3ae', false);
    mesh(tileUV(new THREE.BoxGeometry(X1 - X0 - 0.1, 0.014, 0.45 - ZU - 0.1), 2, 1), warm('#ffffff', 0.1, pavers), (X0 + X1) / 2, F2 + 0.007, (0.4 + ZU) / 2, false);
    box((X0 + X1) / 2, F2 + TP / 2, 0.42, X1 - X0 + 0.1, TP, 0.08, '#aebbd0'); box((X0 + X1) / 2, F2 + TP + 0.02, 0.42, X1 - X0 + 0.14, 0.04, 0.14, coping);
    for (const x of [X0 + 0.02, X1 - 0.02]) { box(x, F2 + TP / 2, (0.42 + ZU) / 2, 0.08, TP, 0.42 - ZU, '#aebbd0'); box(x, F2 + TP + 0.02, (0.42 + ZU) / 2, 0.14, 0.04, 0.42 - ZU + 0.04, coping); }
    for (const [x, c] of [[-1.15, '#7d6a5a'], [2.4, '#8f9aa0']]) { pot(x, F2, 0.22, 0.16, 6, 1.6, c); }
    box(0.1, F2 + 0.4, -0.1, 0.9, 0.05, 0.3, '#9a6e44'); for (const x of [-0.3, 0.5]) box(x, F2 + 0.2, -0.1, 0.05, 0.4, 0.26, '#6a5038', false);   // bench against the upper front wall
    rod([2.35, F2, 0.2], [2.35, F2 + 1.5, 0.2], 0.015, '#59656d'); rod([2.0, F2 + 1.45, 0.2], [2.7, F2 + 1.45, 0.2], 0.012, '#59656d');
  }
  K.setRoot(group('house12'));

  // ================= upper storey, slab, stair =================
  const stairMat = W('#b9946a', 0.26), rise = (F2 - F) / 14, run = (ZS - ZL) / 14;
  const upperLayer = new THREE.Group(); upperLayer.userData.layer = 'f2'; group('house12').add(upperLayer); K.setRoot(upperLayer);
  wall('x', ZU - T / 2, T, [X0, X1, F2, EF], [UD, UW], plaster);
  wall('x', ZU + 0.01, 0.03, [2.32, X1, F2, EF], [], claddingM);   // timber-clad strip on the upper front, west of the terrace door
  wall('x', Z1 + T / 2, T, [X0, X1, F2, EF], RU, plaster);
  wall('z', X1 - T / 2, T, [IZ1, ZU, F2, EF], LU, plaster);
  wall('z', X0 + T / 2, T, [IZ1, ZU, F2, EF], EU, plaster);
  panel('x', IZU - 0.006, 0.012, [IX0, IX1, F2, CEIL2], [UD, UW], cream); panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F2, CEIL2], RU, cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZU, F2, CEIL2], LU, cream); panel('z', IX0 + 0.006, 0.012, [IZ1, IZU, F2, CEIL2], EU, cream);
  box((X0 + X1) / 2, F2 - 0.1, ZU - 0.012, X1 - X0 + 0.06, 0.2, 0.04, belt, true, upperLayer);
  // partitions: wall at x HW (study door at the back), wall between bedroom and study at z -3.4 (door), bath: wall z -4.2 and wall x 1.3 with a door
  wall('z', HW, 0.1, [IZ1, IZU, F2, CEIL2 + 0.01], [[-5.5, -4.7, F2, F2 + 2.0]], plaster);
  wall('x', -3.4, 0.1, [HW, IX1, F2, CEIL2 + 0.01], [[1.3, 2.1, F2, F2 + 2.0]], plaster);
  wall('x', -4.2, 0.1, [1.3, IX1, F2, CEIL2 + 0.01], [], plaster);
  wall('z', 1.3, 0.1, [IZ1, -4.2, F2, CEIL2 + 0.01], [[-5.3, -4.5, F2, F2 + 2.0]], plaster);
  for (const [a, b, c, d] of [[HW, IX1, IZ1, IZU], [IX0, HW, IZ1, ZL]]) box((a + b) / 2, F2 - SLAB / 2, (c + d) / 2, b - a, SLAB, d - c, '#c9c1b0', true, upperLayer);   // slab with the stair opening x -1.4…-0.52, z -4.3…-1.35
  mesh(tileUV(new THREE.BoxGeometry(IX1 - HW, 0.012, IZU - IZ1), 2, 2), warm('#ffffff', 0.22, planks), (HW + IX1) / 2, F2 + 0.006, (IZU + IZ1) / 2, false, upperLayer);
  mesh(tileUV(new THREE.BoxGeometry(HW - IX0, 0.012, IZ1 - ZL), 1, 1), warm('#ffffff', 0.22, planks), (IX0 + HW) / 2, F2 + 0.006, (IZ1 + ZL) / 2, false, upperLayer);   // landing
  mesh(tileUV(new THREE.BoxGeometry(IX1 - 1.3, 0.014, -4.2 - IZ1), 1, 1), warm('#ffffff', 0.12, pavers), (1.3 + IX1) / 2, F2 + 0.007, (-4.2 + IZ1) / 2, false, upperLayer);   // bath tile
  box((IX0 + IX1) / 2, CEIL1 - 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false, upperLayer);    // ground ceiling
  glaze('x', ZU - T / 2, 1, UD, [1.375], [], 0, false); glaze('x', ZU - T / 2, 1, UW, [], [], 0.1);
  for (const r of RU) glaze('x', Z1 + T / 2, -1, r);
  for (const w of LU) glaze('z', X1 - T / 2, 1, w); for (const e of EU) glaze('z', X0 + T / 2, -1, e, [], [], e === EU[1] ? 0.1 : 0);
  // stair: straight flight along the east wall rising towards the back; handrail on the hall side, guard rail at the opening's back edge
  K.setRoot(group('house12'));
  for (let i = 0; i < 14; i++) { const top = F + (i + 1) * rise, z = ZS - i * run - run / 2; box(SXc, top - 0.02, z, 0.76, 0.04, run + 0.02, stairMat); box(SXc, top - rise / 2, z + run / 2, 0.76, rise, 0.02, woodD, false); }
  { const a = Math.atan2(rise, run), l = Math.hypot(14 * run, 14 * rise); for (const dx of [-0.36, 0.36]) { const s = box(SXc + dx, F + 14 * rise / 2 - 0.02, (ZS + ZL) / 2, 0.04, 0.16, l, woodD); s.rotation.x = a; } }
  rod([-0.59, F + 0.9, ZS], [-0.59, F2 + 0.9, ZL], 0.02, '#3d4a58');
  K.setRoot(upperLayer);
  for (const x of [-1.3, -0.95, -0.6]) box(x, F2 + 0.5, ZL + 0.05, 0.03, 1.0, 0.03, '#3d4a58'); box(-0.95, F2 + 1.0, ZL + 0.05, 0.9, 0.04, 0.04, '#3d4a58');
  K.setRoot(group('house12'));
  const table = (x, z, w, d, hgt, layer, base = F, top = wood) => { box(x, base + hgt - 0.02, z, w, 0.04, d, top, true, layer);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(x + dx * (w / 2 - 0.05), base + hgt / 2, z + dz * (d / 2 - 0.05), 0.05, hgt - 0.04, 0.05, woodD, false, layer); };
  const chair = (x, z, face, base = F, c = '#6b8a9a', layer) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + dx * 0.17, base + 0.22, z + dz * 0.17, 0.035, 0.44, 0.035, woodD, false, layer);
    box(x, base + 0.45, z, 0.4, 0.04, 0.4, W(c, 0.3), true, layer); const bx = x - face[0] * 0.19, bz = z - face[1] * 0.19; box(bx, base + 0.68, bz, face[0] ? 0.03 : 0.38, 0.4, face[0] ? 0.38 : 0.03, woodD, true, layer); };
  const pendant = (x, z, y, top, c = '#e0cfa8', layer) => { rod([x, top, z], [x, y + 0.08, z], 0.006, '#3a3330', layer); mesh(new THREE.ConeGeometry(0.13, 0.15, 14, 1, true), W(c, 0.3), x, y + 0.07, z, true, layer); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false, layer); };
  // ================= interior: ground floor =================
  {
    // genkan: shoe cabinet on the east wall under the slit window, shoes on the tile, umbrella stand, hooks on the genkan wall
    box(-1.22, F + 0.55, -0.85, 0.3, 1.1, 0.9, woodD); box(-1.22, F + 1.12, -0.85, 0.34, 0.04, 0.96, wood);
    for (let i = 0; i < 3; i++) box(-1.06, F + 0.25 + i * 0.3, -0.85, 0.02, 0.22, 0.8, W('#8a6a48', 0.3), false);
    for (let i = 0; i < 3; i++) box(-0.4, F + 0.02, -0.4 - i * 0.2, 0.26, 0.04, 0.1, W(['#2f3944', '#c9402f', '#e8e4d6'][i], 0.4), false);
    cyl(0.3, F + 0.28, -1.35, 0.1, 0.56, W('#4f7290', 0.3)); for (const x of [0.26, 0.34]) rod([x, F + 0.5, -1.35], [x + 0.02, F + 0.95, -1.33], 0.012, '#2f3944');
    box(0.45, F + 1.7, -0.9, 0.05, 0.03, 0.6, wood, false); for (let i = 0; i < 3; i++) cyl(0.43, F + 1.62, -0.7 - i * 0.2, 0.015, 0.06, '#59656d');
    pendant(-0.5, -0.8, F + 2.0, CEIL1, '#e0cfa8');
    // living room at the front-west behind the big window: armchair and plant near the glass, sofa on the west wall facing a TV unit on the hall wall, rug and low table
    box(1.45, F + 0.012, -2.0, 2.2, 0.024, 2.1, W('#8a96a8', 0.28), false);
    box(1.6, F + 0.28, -0.75, 0.7, 0.5, 0.7, W('#c98a6a', 0.3)); box(1.6, F + 0.6, -0.42, 0.7, 0.55, 0.12, W('#c98a6a', 0.3)); for (const dx of [-0.38, 0.38]) box(1.6 + dx, F + 0.42, -0.75, 0.1, 0.35, 0.7, W('#b97a5a', 0.3));
    pot(2.55, F, -0.45, 0.15, 6, 2, '#8f9aa0');
    box(2.35, F + 0.28, -2.2, 0.7, 0.5, 1.6, W('#7d8fa0', 0.3)); box(2.65, F + 0.6, -2.2, 0.14, 0.55, 1.6, W('#7d8fa0', 0.3));
    for (const dz of [-0.75, 0.75]) box(2.35, F + 0.4, -2.2 + dz, 0.7, 0.45, 0.12, W('#6d7f90', 0.3));
    table(1.4, -2.2, 0.5, 0.9, 0.38, undefined, F, wood);
    box(-0.28, F + 0.3, -2.5, 0.34, 0.6, 1.2, woodD); box(-0.14, F + 0.88, -2.5, 0.06, 0.5, 0.85, W('#2f2a26', 0.08));
    for (const x of [FW[0] - 0.05, FW[1] + 0.05]) box(x, F + 1.2, IZ0 - 0.04, 0.24, 1.9, 0.05, W('#e8dfcc', 0.4), true);   // curtains
    pendant(1.4, -1.4, F + 1.95, CEIL1, '#e8c9a0');
    // kitchen-dining at the back-west: counter with sink and hob along the west wall, fridge by the rear wall, dining table for four before the sliding door, pendant
    box(2.45, F + 0.45, -4.7, 0.6, 0.9, 1.9, W('#d6cfba', 0.3)); box(2.45, F + 0.92, -4.7, 0.64, 0.04, 1.94, steel); box(2.45, F + 0.94, -4.4, 0.4, 0.02, 0.5, '#59656d', false);
    for (const dz of [0.3, 0.65]) cyl(2.45, F + 0.945, -4.7 - dz, 0.1, 0.012, '#2a2d31'); box(2.6, F + 1.75, -4.7, 0.4, 0.12, 0.6, '#8a9096'); box(2.6, F + 1.95, -3.8, 0.3, 0.5, 0.7, wood);
    box(2.4, F + 0.9, -6.03, 0.62, 1.8, 0.62, W('#dfe3e0', 0.28));
    table(1.1, -4.4, 1.1, 0.8, 0.74, undefined, F, wood); chair(0.35, -4.4, [-1, 0], F, '#c9a86a'); chair(1.85, -4.4, [1, 0], F, '#c9a86a'); chair(1.1, -3.8, [0, 1], F, '#c9a86a'); chair(1.1, -5.0, [0, -1], F, '#c9a86a');
    for (const dx of [-0.25, 0.1, 0.35]) cyl(1.1 + dx, F + 0.78, -4.4, 0.07, 0.1, W(dx < 0 ? '#f0e8d4' : '#6aa0c0', 0.34));
    pendant(1.1, -4.4, F + 1.9, CEIL1, '#d9c7a0');
    for (const x of [RS[0] + 0.12, RS[1] - 0.12]) box(x, F + 1.2, IZ1 + 0.04, 0.26, 2.0, 0.05, W('#e3dcc4', 0.4), true);
    pot(0.15, F, -6.0, 0.14, 6, 2, '#8f9aa0');
    // WC behind the stair
    cyl(-0.95, F + 0.2, -5.6, 0.17, 0.4, W('#e8eef0', 0.3)); box(-0.95, F + 0.5, -5.95, 0.36, 0.4, 0.14, W('#e8eef0', 0.3)); box(-1.2, F + 0.85, -4.85, 0.2, 0.08, 0.3, W('#e8eef0', 0.3));
    box(-0.95, F + 1.95, -5.1, 0.3, 0.04, 0.3, W('#fff4d0', 0.95), false);
    for (const [x, z, r2] of [[-0.5, -0.8, 1.2], [1.4, -1.8, 2.8], [1.1, -4.6, 2.6], [-0.95, -5.1, 0.8]]) decal(r2, r2, x, F + 0.003, z, [0, -1], pool);
  }
  // ================= interior: upper floor =================
  K.setRoot(upperLayer);
  {
    // bedroom at the front opening onto the terrace: bed with its head on the hall wall, bedside tables, wardrobe on the dividing wall, plant by the terrace door
    box(1.2, F2 + 0.012, -2.35, 3.0, 0.024, 1.9, W('#8f7a8a', 0.26), false);
    box(0.5, F2 + 0.22, -2.45, 2.0, 0.3, 1.5, woodD); box(0.5, F2 + 0.45, -2.45, 1.92, 0.16, 1.42, W('#e6dde0', 0.3)); box(-0.3, F2 + 0.56, -2.45, 0.2, 0.12, 1.1, W('#f0e8d4', 0.34));
    box(0.9, F2 + 0.58, -2.45, 1.0, 0.06, 1.42, W('#8f9ab8', 0.3)); box(-0.4, F2 + 0.9, -2.45, 0.08, 0.9, 1.7, woodD);
    for (const dz of [-1.75, -3.15]) box(-0.3, F2 + 0.28, dz, 0.35, 0.4, 0.35, woodD);
    box(1.9, F2 + 1.0, -3.18, 1.2, 2.0, 0.36, woodD); box(1.9, F2 + 1.0, -2.99, 0.02, 1.9, 0.02, wood, false);
    pendant(1.2, -2.3, F2 + 1.95, CEIL2, '#e8c9a0');
    for (const x of [UD[0] - 0.05, UD[1] + 0.05]) box(x, F2 + 1.15, IZU - 0.04, 0.24, 1.9, 0.05, W('#e0dce8', 0.4), true);
    pot(2.55, F2, -1.7, 0.14, 6, 1.8, '#8f9aa0');
    // bath at the back-west corner: tub along the west wall, washbasin, mirror
    box(2.45, F2 + 0.28, -5.5, 0.6, 0.56, 1.3, W('#e8eef0', 0.3)); box(2.45, F2 + 0.52, -5.5, 0.5, 0.02, 1.18, '#9fc4d0', false); box(1.6, F2 + 0.45, -4.5, 0.5, 0.9, 0.4, W('#d6cfba', 0.3)); box(1.6, F2 + 0.92, -4.5, 0.54, 0.04, 0.44, steel); box(1.6, F2 + 1.3, -4.28, 0.4, 0.5, 0.02, W('#dfeaf0', 0.5), false);
    box(2.0, F2 + 2.0, -5.2, 0.3, 0.04, 0.3, W('#fff4d0', 0.95), false);
    // study at the back: desk under the window, chair, bookcase on the hall wall, floor cushion
    table(0.5, -6.05, 1.2, 0.6, 0.74, upperLayer, F2, wood); chair(0.5, -5.5, [0, 1], F2, '#6b8a9a', upperLayer);
    cyl(1.0, F2 + 0.95, -6.05, 0.05, 0.4, '#3d4a58', upperLayer); mesh(new THREE.ConeGeometry(0.1, 0.14, 10, 1, true), W('#efe0c0', 0.8), 1.0, F2 + 1.2, -6.05, true, upperLayer);
    box(-0.35, F2 + 0.9, -4.0, 0.3, 1.8, 1.0, woodD); for (let k = 0; k < 4; k++) { box(-0.2, F2 + 0.2 + k * 0.4, -4.0, 0.02, 0.3, 0.9, W('#e8e4d6', 0.3), false); for (let i = 0; i < 6; i++) box(-0.18, F2 + 0.33 + k * 0.4, -3.65 - i * 0.14, 0.05, 0.22, 0.1, W(['#2a8a68', '#c9402f', '#e0b040', '#4f7290', '#e8e4d6'][(i + k) % 5], 0.36), false); }
    box(0.5, F2 + 0.05, -4.4, 0.5, 0.1, 0.5, W('#c9a03a', 0.3));
    pendant(0.6, -4.8, F2 + 1.95, CEIL2, '#e0cfa8', upperLayer);
    pot(-1.1, F2, -5.9, 0.14, 6, 1.8, '#8f9aa0');   // landing plant
    for (const [x, z, r2] of [[1.0, -2.3, 2.6], [0.5, -5.2, 1.8], [-1.0, -5.3, 0.8]]) decal(r2, r2, x, F2 + 0.004, z, [0, -1], pool);
  }

  // ================= flat roof (roof layer): roof slab, parapet with coping on all sides, rooftop AC units and hatch, vent pipes =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('house12').add(roofLayer); K.setRoot(roofLayer);
  box((IX0 + IX1) / 2, CEIL2 + 0.01, (IZU + IZ1) / 2, IX1 - IX0, 0.02, IZU - IZ1, W('#efe4cc', 0.32), false);
  box((X0 + X1) / 2, EF - 0.1, (ZU + Z1) / 2, X1 - X0 + 0.06, 0.2, ZU - Z1 + 0.06, '#8d9099');   // roof slab
  box((X0 + X1) / 2, EF + 0.005, (ZU + Z1) / 2, X1 - X0 - 0.1, 0.02, ZU - Z1 - 0.1, '#7a7f88', false);
  for (const [x, z, w, d] of [[(X0 + X1) / 2, ZU - 0.02, X1 - X0 + 0.04, 0.12], [(X0 + X1) / 2, Z1 + 0.02, X1 - X0 + 0.04, 0.12], [X0 + 0.02, (ZU + Z1) / 2, 0.12, ZU - Z1], [X1 - 0.02, (ZU + Z1) / 2, 0.12, ZU - Z1]]) { box(x, EF + PAR / 2, z, w, PAR, d, plaster); box(x, EF + PAR + 0.025, z, w + 0.04, 0.05, d + 0.04, coping); }
  for (const x of [-0.5, 1.2]) { box(x, EF + 0.07, -5.2, 0.8, 0.14, 0.5, '#7f8b93'); box(x, EF + 0.55, -5.2, 0.7, 0.8, 0.45, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.2, 16), mat('#3b4650'), x, EF + 0.55, -4.97, false); }
  box(1.9, EF + 0.2, -2.8, 0.7, 0.4, 0.7, '#9aa3ae'); box(1.9, EF + 0.42, -2.8, 0.78, 0.05, 0.78, coping);   // roof hatch
  for (const [x, z] of [[2.4, -4.2], [-1.1, -3.0]]) { cyl(x, EF + 0.3, z, 0.04, 0.6, '#7f8a92'); mesh(new THREE.ConeGeometry(0.08, 0.07, 8), mat('#7f8a92'), x, EF + 0.63, z, false); }
  group('house12');
  for (const [x, z] of [[X1 + 0.04, 0.3], [X0 - 0.04, Z1 + 0.1]]) { cyl(x, (EF - 0.1 + 0.3) / 2, z, 0.04, EF - 0.4, '#7f8a92'); box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91'); for (const y of [1.0, 2.6, 4.2]) box(x - Math.sign(x) * 0.02, y, z, 0.1, 0.04, 0.1, '#5f6c76', false); }

  // ================= carport on the EAST (the viewer's right, local -x): flat polycarbonate roof on steel posts, slat fence on the outer side and back, compact car =================
  {
    const xo = -3.9, xh = X0 - 0.05, z0 = -5.0, z1 = 0.5, hi = 2.7, lo = 2.35, cx = (xo + xh) / 2, cz = (z0 + z1) / 2, G = 0.19;
    for (const [x, z, h] of [[xo + 0.04, z1 - 0.04, lo], [xo + 0.04, -2.2, lo], [xo + 0.04, z0 + 0.04, lo], [xh - 0.1, z1 - 0.04, hi], [xh - 0.1, z0 + 0.04, hi]]) box(x, G + h / 2, z, 0.07, h, 0.07, steelC);
    const ang = Math.atan2(hi - lo, xh - xo);
    const r = box(cx, G + (hi + lo) / 2 + 0.02, cz, Math.hypot(xh - xo, hi - lo) + 0.1, 0.04, z1 - z0 + 0.1, new THREE.MeshPhysicalMaterial({ color: 0xbfe0e6, transparent: true, opacity: 0.4, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }), true); r.rotation.z = ang;
    for (let i = 0; i <= 5; i++) { const z = z0 + i * (z1 - z0) / 5, b = box(cx, G + (hi + lo) / 2 + 0.05, z, Math.hypot(xh - xo, hi - lo) + 0.1, 0.05, 0.05, steelC, false); b.rotation.z = ang; }
    for (let i = 0; i < 9; i++) box(xo - 0.02, G + 0.6, z0 + 0.1 + i * 0.24, 0.03, 1.2, 0.15, i % 2 ? '#7a5a3c' : '#936b46');   // slat fence behind the car on the outer edge
    box(xo - 0.02, G + 1.22, (z0 - 2.2) / 2 + 0.05, 0.05, 0.05, 2.9, steelC, false);
    for (let i = 0; i < 9; i++) box(xo + 0.15 + i * 0.25, G + 0.6, z0 - 0.02, 0.15, 1.2, 0.03, i % 2 ? '#7a5a3c' : '#936b46');   // back panel
    // compact hatchback, nose to the street (+z): silver body, cabin, glass, wheels, lights
    const cxx = -2.75, czz = -1.35, cb = '#c4c9cf';
    box(cxx, G + 0.55, czz, 1.5, 0.5, 3.4, cb); box(cxx, G + 0.9, czz - 0.25, 1.38, 0.5, 1.9, cb);
    box(cxx, G + 0.92, czz - 0.25, 1.4, 0.38, 1.8, glass, false); box(cxx, G + 0.84, czz + 0.7, 1.4, 0.04, 0.06, '#59656d', false);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) { const w = cyl(cxx + dx * 0.72, G + 0.27, czz + dz * 1.05, 0.27, 0.2, '#2a2d31'); w.rotation.z = PI / 2; }
    for (const dx of [-0.5, 0.5]) { box(cxx + dx, G + 0.58, czz + 1.72, 0.28, 0.12, 0.04, '#ffe2a6', false); box(cxx + dx, G + 0.6, czz - 1.72, 0.26, 0.1, 0.04, '#c9402f', false); }
    box(cxx, G + 0.32, czz + 1.72, 1.2, 0.2, 0.04, '#59656d', false);
    mesh(tileUV(new THREE.BoxGeometry(xh - xo, 0.012, z1 - z0), 1, 2), warm('#ffffff', 0.04, pavers), cx, 0.2, cz, false);
  }

  // ================= front garden, door steps, front-east pots, west street side, east strip, rear yard, ground, local animation =================
  const gshrub = (x, z, r, n, h) => shrub(x, 0.19 + 0.36 * r, z, r, n, h);   // keep the foliage above the plot surface
  group('house12Step');
  {
    box(DXc, 0.225, 0.68, 1.4, 0.06, 0.34, '#8e8a80'); box(DXc, 0.2, 0.95, 1.3, 0.04, 0.2, '#8e8a80', false);
    for (let i = 0; i < 3; i++) box(DXc + (i % 2 ? 0.1 : -0.1), 0.205, 1.4 + i * 0.35, 0.7, 0.03, 0.3, '#a8a091', false);
  }
  group('house12Garden');
  {
    // garden west of the door: block wall along the alley edge and the street (west) edge, raised planter in front of the living window, gatepost with mailbox, small tree, garden lights
    box(2.8, 0.19 + 0.2, 2.45, 4.2, 0.4, 0.14, '#a29e94'); box(2.8, 0.19 + 0.42, 2.45, 4.26, 0.05, 0.2, '#bdb8ac');
    box(2.5, 0.19 + 0.2, 1.1, 2.2, 0.4, 0.8, '#a29e94'); box(2.5, 0.19 + 0.38, 1.1, 2.0, 0.04, 0.6, '#4a3a2e', false);   // raised planter bed
    for (let i = 0; i < 7; i++) { const c = ['#e8e4d6', '#c9a0d8', '#f0d36a', '#d98aa6'][i % 4]; mesh(new THREE.SphereGeometry(0.07, 6, 4), mat(c), 1.55 + i * 0.28 + (rnd() - 0.5) * 0.1, 0.19 + 0.55 + rnd() * 0.15, 1.1 + (rnd() - 0.5) * 0.4, false); }
    gshrub(1.9, 1.1, 0.25, 6, 1.3); gshrub(3.0, 1.2, 0.22, 5, 1.2);
    box(1.0, 0.19 + 0.55, 1.95, 0.24, 1.1, 0.24, '#8a7a68'); box(1.0, 0.19 + 1.12, 1.95, 0.32, 0.05, 0.32, '#3d4a58'); box(1.0, 0.19 + 0.8, 1.82, 0.2, 0.18, 0.04, '#8a98a0'); box(1.0, 0.19 + 1.0, 1.82, 0.14, 0.05, 0.02, '#c9402f', false);
    for (let i = 0; i < 3; i++) gshrub(3.0 + i * 0.5, 2.1, 0.2, 5, 1.1);
    for (const [x, z] of [[0.75, 0.9], [3.9, 0.8]]) { cyl(x, 0.19 + 0.22, z, 0.015, 0.44, '#59656d'); const p = mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffe2a6' }), x, 0.19 + 0.45, z, false); p.scale.setScalar(1.8); mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.2), x, 0.21, z, false).rotation.x = -PI / 2; }
  }
  group('house12FrontE');
  {
    // between the door and the carport: pots under the slit window (x ≤ -0.75, away from the door route)
    pot(-0.95, 0.19, 0.8, 0.15, 5, 1.5, '#7d6a5a'); pot(-1.3, 0.19, 0.45, 0.12, 4, 1.2, '#8f9aa0');
  }
  group('house12West');
  {
    // street (west) side: block wall with a black railing along the plot edge, AC unit and gas water heater on the west wall, bins, planters
    box(4.85, 0.19 + 0.2, -2.0, 0.1, 0.4, 7.2, '#a29e94');
    for (let i = 0; i < 30; i++) box(4.85, 0.19 + 0.65, 1.5 - i * 0.24, 0.02, 0.5, 0.02, '#2a2d31', false);
    box(4.85, 0.19 + 0.92, -2.0, 0.04, 0.04, 7.2, '#2a2d31', false);
    box(3.35, 0.19 + 0.05, -2.6, 0.4, 0.1, 0.9, '#7f8b93'); box(3.35, 0.19 + 0.4, -2.6, 0.3, 0.6, 0.8, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.17, 16), mat('#3b4650'), 3.5, 0.19 + 0.4, -2.6, false).rotation.y = PI / 2;
    cyl(3.4, 0.19 + 0.7, -4.8, 0.2, 1.4, W('#dfe3e0', 0.28)); cyl(3.4, 0.19 + 1.42, -4.8, 0.21, 0.04, '#59656d'); rod([3.3, 0.19 + 1.3, -4.7], [3.1, 0.19 + 1.5, -4.4], 0.012, '#5f6c76');
    for (const [z, c] of [[-1.2, '#3f8a5a'], [-1.65, '#4f7290']]) { box(3.4, 0.19 + 0.3, z, 0.4, 0.6, 0.38, c); box(3.4, 0.19 + 0.62, z, 0.44, 0.04, 0.42, '#2f3944'); }
    gshrub(4.3, -0.2, 0.3, 6, 1.5); gshrub(4.3, -3.6, 0.3, 6, 1.5); gshrub(4.3, 1.2, 0.3, 6, 1.5); pot(4.0, 0.19, -1.0, 0.14, 5, 1.4, '#7d6a5a');
  }
  group('house12East');
  {
    // east strip behind the carport: hedge along the plot edge, a rain barrel and a compost box
    cyl(-3.5, 0.19 + 0.35, -5.5, 0.22, 0.7, W('#6d7d84', 0.3)); cyl(-3.5, 0.19 + 0.72, -5.5, 0.23, 0.03, '#59656d');
    box(-2.6, 0.19 + 0.25, -5.65, 0.7, 0.5, 0.5, '#7a5a3c'); box(-2.6, 0.19 + 0.52, -5.65, 0.76, 0.04, 0.56, '#5a3d27');
    for (let i = 0; i < 5; i++) gshrub(-4.5, 1.6 - i * 1.4, 0.3, 7, 1.7);
  }
  group('house12Rear');
  {
    // deeper rear yard: bench and stepping stones at the sliding door, AC unit, gravel strip, hedge along the back
    box(1.6, 0.19 + 0.35, Z1 - 0.45, 1.0, 0.05, 0.3, '#9a6e44'); for (const x of [1.2, 2.0]) box(x, 0.19 + 0.17, Z1 - 0.45, 0.05, 0.34, 0.26, '#6a5038', false);
    box(-0.5, 0.19 + 0.05, Z1 - 0.3, 0.8, 0.1, 0.4, '#7f8b93'); box(-0.5, 0.19 + 0.38, Z1 - 0.3, 0.64, 0.58, 0.32, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.17, 16), mat('#3b4650'), -0.5, 0.19 + 0.38, Z1 - 0.47, false).rotation.y = PI;
    pot(0.6, 0.19, Z1 - 0.45, 0.16, 6, 1.6); pot(2.7, 0.19, Z1 - 0.5, 0.14, 5, 1.4, '#7d6a5a');
    for (let i = 0; i < 4; i++) box(1.9 - i * 0.4, 0.2, Z1 - 1.0 - (i % 2) * 0.1, 0.34, 0.02, 0.28, '#a8a091', false);
    for (let i = 0; i < 8; i++) gshrub(-3.6 + i * 1.1, -8.5, 0.3, 6, 1.5);
    pot(-2.6, 0.19, -7.4, 0.2, 7, 1.8, '#7d6a5a');
  }
  group('house12Ground');
  const paveMat = warm('#ffffff', 0, pavers), pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-4.9, 4.9, 0.5, 2.5); pave(-4.9, -3.9, -6.5, 0.5); pave(X1, 4.9, -6.5, 0.5); pave(-4.9, 4.9, -8.9, -6.5);
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(1.6, 1.4, DXc, 0.226, 0.9, [0, 1], spill); decal(3.0, 1.0, 1.8, 0.208, 0.9, [0, 1], additive(spillT, '#ffbf7a', 0.2)); decal(1.8, 1.6, -2.75, 0.208, 1.2, [0, 1], additive(glowT, '#cfe6ff', 0.12));

  const fx = new THREE.Group(); fx.userData.live = true; group('house12').add(fx); K.setRoot(fx);
  const upGlow = additive(glowT, '#ffd9a0', 0.1); mesh(new THREE.PlaneGeometry(2.4, 1.8), upGlow, 1.4, F2 + 1.2, 0.5, false, fx);
  const dnGlow = additive(glowT, '#ffe2b0', 0.18); mesh(new THREE.PlaneGeometry(2.4, 1.8), dnGlow, 1.8, F + 1.3, 0.5, false, fx);
  // laundry on the terrace pole: a shirt and a towel sway lightly
  const laundry = new THREE.Group(); laundry.position.set(2.35, F2 + 1.4, 0.2); fx.add(laundry);
  { const sh = new THREE.Group(); sh.position.set(-0.2, 0, 0); laundry.add(sh); box(0, -0.2, 0, 0.3, 0.38, 0.02, W('#e6edf5', 0.5), false, sh); box(-0.2, -0.13, 0, 0.14, 0.12, 0.02, W('#e6edf5', 0.5), false, sh); box(0.2, -0.13, 0, 0.14, 0.12, 0.02, W('#e6edf5', 0.5), false, sh);
    const tw = new THREE.Group(); tw.position.set(0.25, 0, 0); laundry.add(tw); box(0, -0.25, 0, 0.26, 0.5, 0.02, W('#f2c9b8', 0.5), false, tw); laundry.userData.parts = [sh, tw]; }
  // a small tree in the front garden sways slightly
  const gardenFx = new THREE.Group(); gardenFx.userData.live = true; group('house12Garden').add(gardenFx);
  const tree = new THREE.Group(); tree.position.set(4.2, 0.19, 1.5); gardenFx.add(tree);
  cyl(0, 0.9, 0, 0.06, 1.8, '#6b4c36', tree);
  for (const [dx, dy, dz, r] of [[0, 2.1, 0, 0.55], [0.25, 1.7, 0.15, 0.4], [-0.25, 1.8, -0.1, 0.4], [0.05, 2.5, 0, 0.35]]) { const a = mesh(new THREE.SphereGeometry(1, 7, 5), mat(LEAF[(dx > 0) * 1 + (dz > 0) * 1]), dx, dy, dz, false, tree); a.scale.setScalar(r); }
  const batch = (c, o, par = fx) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; par.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6), cdrips = batch('#cee7e5', 0.6);
  for (const [w, n] of [[FW, 8], [UD, 6]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 0.8, w === UD ? ZU + 0.08 : 0.08, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 14; i++) drips.add(-1.5 + i * 0.32 + rnd() * 0.1, 2.0 + rnd() * 0.5, 0.52, 0.1, 1.9, 2.7, 2.1 + rnd() * 0.5);   // drips off the terrace edge
  for (let i = 0; i < 6; i++) cdrips.add(-3.9, 0.3 + rnd() * 1.7, 0.4 - i * 0.85, 0.1, 0.25, 2.1, 2.2 + rnd() * 0.4);
  runs.seal(); drips.seal(); cdrips.seal();
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt); cdrips.step(dt);
      tree.rotation.z = 0.03 * Math.sin(t * 0.8) * (0.7 + 0.3 * Math.sin(t * 0.31)); tree.rotation.x = 0.02 * Math.sin(t * 0.6 + 1);
      laundry.userData.parts.forEach((p, i) => { p.rotation.z = 0.12 * Math.sin(t * 1.5 + i * 1.3) * (0.6 + 0.4 * Math.sin(t * 0.37)); p.rotation.x = 0.1 * Math.sin(t * 1.1 + i); });
      dnGlow.opacity = 0.16 + 0.04 * Math.sin(t * 0.6) * Math.sin(t * 0.27 + 1); upGlow.opacity = 0.09 + 0.03 * Math.sin(t * 0.45 + 2);
    },
  };
};
