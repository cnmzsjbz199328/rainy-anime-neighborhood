// B02-P04 独栋住宅 4 (detached house 4): modern two-storey cube in pale blue-grey plaster with a flat roof and parapet (rooftop air-conditioner units), a concrete
// ledge band over the whole front at the floor line, a timber-clad panel with a corner window on the upper right, big living-room sliding window, carport with a flat
// polycarbonate roof on steel posts on the LEFT, block wall + black railing round the garden, bins and water heater on the east side.
// Task card docs/buildings/tasks/B02-P04.md, reference docs/buildings/references/B02-P04.jpg. Fourth house of stage 6: flat roof (the others are gable / mono-pitch /
// tile gable), carport on the left with the door and the window arranged as in the reference front (door left, window right).
// Local frame (placed by layout.js `buildings`, rotY 0: front +z faces the south street, local +x = world E): origin = middle of the buildable width (world x 41)
// and the front door (frozen entrance x = 41); the front wall is at z 0.
// House body x -1.65…3.45 (5.1), z -6.0…0; ledge to z +0.45; carport x -3.9…-1.7, z +0.5…-5.0; parapet top 6.0, rooftop units to 6.9.
// Groups: house4 (shell, floors, stair, roof, parapet, ledge, carport, car) · house4Gate · house4Garden · house4East · house4Rear · house4Ground.
// Layers: f2 (upper storey), roof (slab, parapet, rooftop equipment). Plan, ground: genkan left of the door, living room with the big window at the front-right, stair along
// the left wall rising towards the front, kitchen-dining at the back with the sliding door, WC at the back-left. Upper: landing over the genkan, master bedroom with the corner
// window at the front, study at the back, bathroom at the back-left.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B02-P04'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(5504), PI = Math.PI;
  const F = rec.floor, F2 = F + 2.75, EF = F2 + 2.55, X0 = -1.65, X1 = 3.45, Z0 = 0, Z1 = -6.0, T = 0.15, BASE = 0.19, SLAB = 0.2, PAR = 0.4;
  const CEIL1 = F2 - SLAB, CEIL2 = EF - 0.12;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T;
  const DXc = 0;
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FD = [-0.45, 0.45, F, F + 2.1], FL = [0.9, 3.0, F + 0.3, F + 2.1], FS = [-1.3, -0.8, F + 0.7, F + 1.9];
  const UL = [-1.25, -0.8, F2 + 0.7, F2 + 1.9], UF = [1.8, 3.2, F2 + 0.7, F2 + 1.9];
  const RS = [0.6, 2.8, F, F + 2.2], RWC = [-1.3, -0.8, F + 1.3, F + 1.9];
  const RU = [[0.6, 2.4, F2 + 0.8, F2 + 1.9], [-1.3, -0.8, F2 + 1.2, F2 + 1.9]];
  const EG = [[-4.0, -3.2, F + 1.0, F + 1.8]], EU = [[-1.3, -0.4, F2 + 0.7, F2 + 1.9], [-4.6, -3.8, F2 + 1.3, F2 + 1.7]];   // EU[0]: the corner window, next to the front corner
  const LG = [[-3.3, -2.8, F + 0.9, F + 1.9], [-5.3, -4.8, F + 1.3, F + 1.9]], LU = [[-1.4, -0.9, F2 + 0.5, F2 + 2.1], [-5.0, -4.5, F2 + 1.2, F2 + 1.9]];
  const ZB = -4.3, ZT = -1.6, SXc = -1.1;   // stair flight: x -1.5…-0.7, bottom at z ZB (floor), top at z ZT (2F level), climbing towards the front

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#b4c1ce'), timber = '#5a4030', timberL = '#a97a4e', slat = '#b98a58', stoneC = '#9a958b', alu = '#4a4f57', trim = '#4f6158', green = '#2f5446';
  const wcache = {}, W = (c, k = 0.3) => wcache[c + k] || (wcache[c + k] = warm(c, k));
  const wood = W('#b0814f'), woodD = W('#6f4a35', 0.26), cream = W('#efe4cc', 0.34), steel = W('#c3cacb', 0.22);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' });
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

  // ---- house materials: pale blue-grey plaster, dark steel frames, timber cladding, grey roof membrane ----
  const plankV = tex(128, 128, (q, w, h) => { for (let c = 0; c < 8; c++) { q.fillStyle = `hsl(${28 + rnd() * 6},${38 + rnd() * 8}%,${44 + rnd() * 8}%)`; q.fillRect(c * 16, 0, 16, h); q.fillStyle = 'rgba(50,30,18,.55)'; q.fillRect(c * 16, 0, 1.5, h); }
    for (let i = 0; i < 180; i++) { q.fillStyle = 'rgba(40,24,14,.12)'; q.fillRect(rnd() * w, rnd() * h, 1, 5 + rnd() * 8); } });
  const claddingM = warm('#ffffff', 0.22, plankV);
  const steelC = '#4a4f57', coping = '#cfd6de';
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

  // ================= ground-floor shell =================
  group('house4');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, F2], [FD, FL, FS], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, F2], [RS, RWC], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, F2], EG, plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, F2], LG, plaster);
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FD[0], Z0, 1); plinth('x', FD[1], X1, Z0, 1); plinth('x', X0, RS[0], Z1, -1); plinth('x', RS[1], X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  // concrete ledge band over the whole front at the floor line (also a canopy for the door and the window), slab edge bands on the other sides
  box((X0 + X1) / 2, F2 - 0.12, 0.225, X1 - X0 + 0.1, 0.26, 0.45, coping); box((X0 + X1) / 2, F2 - 0.27, 0.43, X1 - X0 + 0.1, 0.04, 0.04, '#9aa3ae', false);
  box((X0 + X1) / 2, F2 - 0.1, Z1 - 0.012, X1 - X0 + 0.06, 0.2, 0.04, '#cfd6de');
  for (const [x, o] of [[X0, -1], [X1, 1]]) box(x + o * 0.012, F2 - 0.1, (Z0 + Z1) / 2 - 0.2, 0.04, 0.2, Z0 - Z1 + 0.06 - 0.4, '#cfd6de');
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.2, planks), (IX0 + IX1) / 2, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  mesh(tileUV(new THREE.BoxGeometry(0.65 - IX0, 0.014, IZ0 + 1.55), 1, 1), warm('#ffffff', 0.1, pavers), (IX0 + 0.65) / 2, F + 0.007, (IZ0 - 1.55) / 2, false);   // genkan tile (x -1.5…0.65)
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL1], [FD, FL, FS], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL1], EG, cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL1], LG, cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL1], [RS, RWC], cream);
  // ground partitions: stair-hall wall at x -0.6 (doorways into the stair foot and the WC), WC front wall at z -4.3, under-stair closet wall at z -1.55, genkan wall at x 0.65 with a doorway into the living room
  wall('z', -0.6, 0.1, [IZ1, -1.55, F, CEIL1], [[-4.25, -3.5, F, F + 2.0], [-5.4, -4.6, F, F + 2.0]], plaster);
  wall('x', ZB, 0.1, [IX0, -0.6, F, CEIL1], [], plaster);
  wall('x', -1.55, 0.1, [IX0, -0.6, F, CEIL1], [], plaster);
  wall('z', 0.65, 0.1, [-1.55, IZ0, F, CEIL1], [[-1.3, -0.4, F, F + 2.0]], plaster);

  // ---- exterior: windows, door ----
  glaze('x', -T / 2, 1, FS, [], [], 0.1); glaze('x', -T / 2, 1, FL, [1.95]);
  glaze('x', Z1 + T / 2, -1, RWC, [], [], 0.1);
  glaze('z', X1 - T / 2, 1, EG[0], [], [], 0.1);
  for (const w of LG) glaze('z', X0 + T / 2, -1, w, [], [], 0.1);
  // rear sliding door to the garden: two leaves with handles
  { const [a, b, p, q] = RS, m = (a + b) / 2, z = Z1 + T / 2, fd = 0.1;
    ab('x', a + 0.03, (p + q) / 2, z, 0.06, q - p, fd, alu); ab('x', b - 0.03, (p + q) / 2, z, 0.06, q - p, fd, alu); ab('x', m, (p + q) / 2, z, 0.06, q - p, fd, alu); ab('x', m, q - 0.03, z, b - a, 0.06, fd, alu); ab('x', m, p + 0.05, z, b - a, 0.1, fd, alu);
    ab('x', (a + m) / 2, (p + q) / 2, z, m - a - 0.06, q - p - 0.08, 0.012, glass, false); ab('x', (m + b) / 2, (p + q) / 2, z, b - m - 0.06, q - p - 0.08, 0.012, glass, false);
    for (const x of [m - 0.1, m + 0.1]) ab('x', x, F + 1.0, z - 0.06, 0.02, 0.2, 0.03, '#c9c9c0'); }
  // Front door under the ledge: timber leaf with a tall lit glass slit, long vertical handle, number plate, wall lamp
  {
    ab('x', FD[0] + 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, steelC); ab('x', FD[1] - 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, steelC); box(DXc, FD[3] - 0.04, -T / 2, 0.9, 0.08, 0.16, steelC);
    box(DXc, (F + FD[3] - 0.08) / 2, -0.05, 0.82, FD[3] - 0.08 - F, 0.05, '#9a6e44');
    for (let i = 0; i < 10; i++) box(DXc - 0.32 + i * 0.07, F + 0.95, -0.012, 0.012, 1.8, 0.012, '#7a5a3c', false);
    box(DXc - 0.25, F + 1.45, 0.0, 0.1, 1.0, 0.012, W('#fff0c8', 0.9), false); box(DXc + 0.3, F + 1.1, 0.02, 0.025, 0.8, 0.03, '#c9c9c0');
    box(0.75, 1.5, 0.03, 0.12, 0.08, 0.03, '#8a98a0'); box(-0.85, 2.2, 0.07, 0.14, 0.16, 0.1, '#3d4a58'); box(-0.85, 2.19, 0.07, 0.1, 0.12, 0.105, bulb, false);
    mesh(new THREE.PlaneGeometry(1.0, 1.0), additive(glowT, '#ffc27e', 0.22), -0.85, 2.18, 0.04, false);
    box(DXc, 0.255, 0.25, 1.5, 0.1, 0.5, '#a8a091'); box(DXc, 0.215, 0.1, 1.6, 0.03, 0.2, '#8e8a80', false);   // porch slab (the lower steps are in house4Gate)
  }

  // ================= upper storey, slab, stair =================
  const stairMat = W('#b9946a', 0.26), rise = (F2 - F) / 14, run = (ZT - ZB) / 14;
  const upperLayer = new THREE.Group(); upperLayer.userData.layer = 'f2'; group('house4').add(upperLayer); K.setRoot(upperLayer);
  wall('x', Z0 - T / 2, T, [X0, X1, F2, EF], [UL, UF], plaster);
  wall('x', 0.02, 0.04, [1.2, X1, F2, EF], [UF], claddingM);   // timber-clad panel on the upper right with the front half of the corner window
  wall('x', Z1 + T / 2, T, [X0, X1, F2, EF], RU, plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, F2, EF], EU, plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, F2, EF], LU, plaster);
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F2, CEIL2], [UL, UF], cream); panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F2, CEIL2], RU, cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F2, CEIL2], EU, cream); panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F2, CEIL2], LU, cream);
  // partitions: landing / rooms at x -0.6 (doors to the master bedroom at the front and the study at the back), bathroom front wall at z -4.3, wall between master bedroom and study at z -3.0
  wall('z', -0.6, 0.1, [IZ1, IZ0, F2, CEIL2 + 0.01], [[-1.2, -0.4, F2, F2 + 2.0], [-5.4, -4.6, F2, F2 + 2.0]], plaster);
  wall('x', ZB, 0.1, [IX0, -0.6, F2, CEIL2 + 0.01], [], plaster);
  wall('x', -3.0, 0.1, [-0.6, IX1, F2, CEIL2 + 0.01], [[1.2, 2.0, F2, F2 + 2.0]], plaster);
  for (const [a, b, c, d] of [[-0.6, IX1, IZ1, IZ0], [IX0, -0.6, IZ1, ZB], [IX0, -0.6, ZT, IZ0]]) box((a + b) / 2, F2 - SLAB / 2, (c + d) / 2, b - a, SLAB, d - c, '#c9c1b0', true, upperLayer);   // slab with the stair opening x -1.5…-0.6, z -4.3…-1.6
  mesh(tileUV(new THREE.BoxGeometry(IX1 + 0.6, 0.012, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.22, planks), (IX1 - 0.6) / 2, F2 + 0.006, (IZ0 + IZ1) / 2, false, upperLayer);
  mesh(tileUV(new THREE.BoxGeometry(-0.6 - IX0, 0.012, IZ0 - ZT), 1, 1), warm('#ffffff', 0.22, planks), (IX0 - 0.6) / 2, F2 + 0.006, (ZT + IZ0) / 2, false, upperLayer);   // front landing
  mesh(tileUV(new THREE.BoxGeometry(-0.6 - IX0, 0.014, ZB - IZ1), 1, 1), warm('#ffffff', 0.12, pavers), (IX0 - 0.6) / 2, F2 + 0.007, (IZ1 + ZB) / 2, false, upperLayer);   // bathroom tile
  box((IX0 + IX1) / 2, CEIL1 - 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false, upperLayer);    // ground ceiling
  glaze('x', -T / 2, 1, UL, [], [], 0.1); glaze('x', -T / 2, 1, UF, [2.5]);
  for (const r of RU) glaze('x', Z1 + T / 2, -1, r, r === RU[0] ? [1.5] : []);
  glaze('z', X1 - T / 2, 1, EU[0], [], [], 0, false); glaze('z', X1 - T / 2, 1, EU[1], [], [], 0.1);   // corner window: the side half continues the front one
  for (const w of LU) glaze('z', X0 + T / 2, -1, w);
  // stair: straight flight along the left wall rising towards the front; handrail on the wall side
  K.setRoot(group('house4'));
  for (let i = 0; i < 14; i++) { const top = F + (i + 1) * rise, z = ZB + i * run + run / 2; box(SXc, top - 0.02, z, 0.76, 0.04, run + 0.02, stairMat); box(SXc, top - rise / 2, z - run / 2, 0.76, rise, 0.02, woodD, false); }
  { const a = Math.atan2(rise, run), l = Math.hypot(14 * run, 14 * rise); for (const dx of [-0.36, 0.36]) { const s = box(SXc + dx, F + 14 * rise / 2 - 0.02, (ZB + ZT) / 2, 0.04, 0.16, l, woodD); s.rotation.x = -a; } }
  rod([-0.66, F + 0.9, ZB], [-0.66, F2 + 0.9, ZT], 0.02, '#3d4a58');
  K.setRoot(group('house4'));
  const table = (x, z, w, d, hgt, layer, base = F, top = wood) => { box(x, base + hgt - 0.02, z, w, 0.04, d, top, true, layer);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(x + dx * (w / 2 - 0.05), base + hgt / 2, z + dz * (d / 2 - 0.05), 0.05, hgt - 0.04, 0.05, woodD, false, layer); };
  const chair = (x, z, face, base = F, c = '#6b8a9a', layer) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + dx * 0.17, base + 0.22, z + dz * 0.17, 0.035, 0.44, 0.035, woodD, false, layer);
    box(x, base + 0.45, z, 0.4, 0.04, 0.4, W(c, 0.3), true, layer); const bx = x - face[0] * 0.19, bz = z - face[1] * 0.19; box(bx, base + 0.68, bz, face[0] ? 0.03 : 0.38, 0.4, face[0] ? 0.38 : 0.03, woodD, true, layer); };
  const pendant = (x, z, y, top, c = '#e0cfa8', layer) => { rod([x, top, z], [x, y + 0.08, z], 0.006, '#3a3330', layer); mesh(new THREE.ConeGeometry(0.13, 0.15, 14, 1, true), W(c, 0.3), x, y + 0.07, z, true, layer); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false, layer); };
  const chrome = W('#cfd6d8', 0.3);
  // ================= interior: ground floor =================
  {
    // genkan: shoe cabinet on the left wall, shoes, umbrella stand, hooks on the genkan wall, step beam
    box(-1.3, F + 0.55, -0.85, 0.3, 1.1, 0.9, woodD); box(-1.3, F + 1.12, -0.85, 0.34, 0.04, 0.96, wood);
    for (let i = 0; i < 3; i++) box(-1.14, F + 0.25 + i * 0.3, -0.85, 0.02, 0.22, 0.8, W('#8a6a48', 0.3), false);
    for (let i = 0; i < 3; i++) box(-0.4 + i * 0.2, F + 0.02, -0.4, 0.1, 0.04, 0.26, W(['#2f3944', '#c9402f', '#e8e4d6'][i], 0.4), false);
    cyl(0.4, F + 0.28, -1.35, 0.1, 0.56, W('#4f7290', 0.3)); for (const x of [0.36, 0.44]) rod([x, F + 0.5, -1.35], [x + 0.02, F + 0.95, -1.33], 0.012, '#2f3944');
    box(0.65, F + 1.7, -0.9, 0.05, 0.03, 0.6, wood, false); for (let i = 0; i < 3; i++) cyl(0.63, F + 1.62, -0.7 - i * 0.2, 0.015, 0.06, '#59656d');
    box(0.63, F + 1.35, -0.8, 0.06, 0.6, 0.28, W('#6a7a8a', 0.3), true);   // a coat on the hooks
    box(0.7, F + 0.04, -1.56, 0.1, 0.08, 1.0, woodD, false);
    pendant(-0.4, -0.8, F + 2.0, CEIL1, '#e0cfa8');
    // living room behind the big sliding window: armchair and plant near the glass, sofa on the east wall facing a TV unit by the stair-hall wall, rug, low table, floor lamp
    box(2.0, F + 0.012, -2.3, 2.4, 0.024, 2.0, W('#7a8a9a', 0.28), false);
    box(1.6, F + 0.28, -0.7, 0.7, 0.5, 0.7, W('#c9a86a', 0.3)); box(1.6, F + 0.6, -0.4, 0.7, 0.55, 0.12, W('#c9a86a', 0.3)); for (const dx of [-0.38, 0.38]) box(1.6 + dx, F + 0.42, -0.7, 0.1, 0.35, 0.7, W('#b8955a', 0.3));
    pot(2.8, F, -0.5, 0.17, 6, 2, '#8f9aa0');
    box(3.0, F + 0.28, -2.5, 0.7, 0.5, 1.7, W('#8a9aaa', 0.3)); box(3.35, F + 0.6, -2.5, 0.14, 0.55, 1.7, W('#8a9aaa', 0.3));
    for (const dz of [-0.8, 0.8]) box(3.0, F + 0.4, -2.5 + dz, 0.7, 0.45, 0.12, W('#7a8a9a', 0.3));
    table(1.9, -2.5, 0.5, 0.9, 0.38, undefined, F, wood);
    box(0.95, F + 0.3, -2.5, 0.4, 0.6, 1.3, woodD); box(1.05, F + 0.88, -2.5, 0.06, 0.5, 0.9, W('#2f2a26', 0.08));
    cyl(3.0, F + 0.7, -1.2, 0.02, 1.4, '#3d4a58'); mesh(new THREE.ConeGeometry(0.17, 0.2, 12, 1, true), W('#efe0c0', 0.8), 3.0, F + 1.45, -1.2, true);
    for (const x of [FL[0] + 0.12, FL[1] - 0.12]) box(x, F + 1.2, IZ0 - 0.04, 0.24, 1.9, 0.05, W('#e3e0d4', 0.4), true);   // curtains
    pendant(1.9, -1.4, F + 1.95, CEIL1, '#e8c9a0');
    // kitchen-dining at the back: counter with sink and hob along the east wall, fridge in the corner, dining table for four by the sliding door
    box(3.0, F + 0.45, -4.4, 0.6, 0.9, 1.8, W('#d6cfba', 0.3)); box(3.0, F + 0.92, -4.4, 0.64, 0.04, 1.84, steel); box(3.0, F + 0.94, -4.1, 0.4, 0.02, 0.5, '#59656d', false);
    for (const dz of [0.3, 0.65]) box(3.0, F + 0.945, -4.4 - dz, 0.22, 0.012, 0.22, '#2a2d31', false); box(3.15, F + 1.75, -4.4, 0.4, 0.12, 0.6, '#8a9096'); box(3.15, F + 1.95, -3.6, 0.3, 0.5, 0.7, wood);
    box(3.0, F + 0.9, -5.5, 0.62, 1.8, 0.62, W('#dfe3e0', 0.28));
    table(1.2, -4.4, 1.1, 0.8, 0.74, undefined, F, wood); chair(0.5, -4.4, [1, 0], F, '#c9a86a'); chair(1.9, -4.4, [-1, 0], F, '#c9a86a'); chair(1.2, -3.8, [0, -1], F, '#c9a86a'); chair(1.2, -5.0, [0, 1], F, '#c9a86a');
    for (const dx of [-0.25, 0.1, 0.35]) cyl(1.2 + dx, F + 0.78, -4.4, 0.07, 0.1, W(dx < 0 ? '#f0e8d4' : '#c9402f', 0.34));
    pendant(1.2, -4.4, F + 1.9, CEIL1, '#d9c7a0');
    for (const x of [RS[0] + 0.12, RS[1] - 0.12]) box(x, F + 1.2, IZ1 + 0.04, 0.26, 2.0, 0.05, W('#e3dcc4', 0.4), true);
    pot(0.0, F, -5.55, 0.14, 6, 2, '#8f9aa0');
    // WC at the back-left
    cyl(-1.05, F + 0.2, -5.5, 0.17, 0.4, W('#e8eef0', 0.3)); box(-1.05, F + 0.5, -5.76, 0.36, 0.4, 0.14, W('#e8eef0', 0.3)); box(-0.8, F + 0.85, -5.0, 0.2, 0.08, 0.3, W('#e8eef0', 0.3));
    box(-1.0, F + 1.95, -5.0, 0.3, 0.04, 0.3, W('#fff4d0', 0.95), false);
    for (const [x, z, r2] of [[-0.4, -0.8, 1.4], [1.9, -2.3, 3.0], [1.2, -4.4, 2.6], [-1.0, -5.0, 1.0]]) decal(r2, r2, x, F + 0.003, z, [0, -1], pool);
  }
  // ================= interior: upper floor =================
  K.setRoot(upperLayer);
  {
    // landing: plant and a small console
    pot(-0.95, F2, -0.4, 0.14, 6, 1.8, '#8f9aa0'); box(-1.2, F2 + 0.4, -1.1, 0.3, 0.8, 0.7, woodD);
    // master bedroom at the front (corner window): bed with its head on the dividing wall, bedside tables, wardrobe on the z -3.0 wall, desk by the corner window
    box(1.4, F2 + 0.012, -1.8, 2.2, 0.024, 1.8, W('#7a8a9a', 0.26), false);
    box(0.7, F2 + 0.22, -1.8, 1.9, 0.3, 1.5, woodD); box(0.7, F2 + 0.45, -1.8, 1.82, 0.16, 1.42, W('#dfe0ea', 0.3)); box(-0.2, F2 + 0.56, -1.8, 0.3, 0.12, 1.1, W('#f0e8d4', 0.34));
    box(1.2, F2 + 0.58, -1.8, 0.9, 0.06, 1.42, W('#7da0b0', 0.3)); box(-0.4, F2 + 0.9, -1.8, 0.08, 0.9, 1.6, woodD);
    for (const dz of [-0.9, 0.9]) box(-0.2, F2 + 0.28, -1.8 + dz, 0.35, 0.4, 0.35, woodD);
    box(1.7, F2 + 1.0, -2.78, 1.6, 2.0, 0.4, woodD); box(1.7, F2 + 1.0, -2.57, 0.02, 1.9, 0.02, wood, false);
    table(2.7, -0.55, 1.0, 0.55, 0.74, upperLayer, F2, wood); chair(2.7, -1.1, [0, 1], F2, '#c9a86a', upperLayer);
    pendant(1.2, -1.6, F2 + 1.95, CEIL2, '#e8c9a0', upperLayer);
    for (const x of [UF[0] + 0.15, UF[1] - 0.15]) box(x, F2 + 1.2, IZ0 - 0.04, 0.26, 1.9, 0.05, W('#e6d6c0', 0.4), true);
    // study at the back: desk under the window, chair, bookcase on the east wall, floor cushion
    table(1.5, -5.55, 1.4, 0.6, 0.74, upperLayer, F2, wood); chair(1.5, -5.0, [0, 1], F2, '#c9a86a', upperLayer);
    cyl(2.1, F2 + 0.95, -5.55, 0.05, 0.4, '#3d4a58', upperLayer); mesh(new THREE.ConeGeometry(0.1, 0.14, 10, 1, true), W('#efe0c0', 0.8), 2.1, F2 + 1.2, -5.55, true, upperLayer);
    box(3.1, F2 + 0.9, -4.0, 0.3, 1.8, 1.2, woodD); for (let k = 0; k < 4; k++) { box(2.96, F2 + 0.2 + k * 0.4, -4.0, 0.02, 0.3, 1.1, W('#e8e4d6', 0.3), false); for (let i = 0; i < 7; i++) box(2.94, F2 + 0.33 + k * 0.4, -3.5 - i * 0.15, 0.05, 0.22, 0.11, W(['#2a8a68', '#c9402f', '#e0b040', '#4f7290', '#e8e4d6'][(i + k) % 5], 0.36), false); }
    box(0.4, F2 + 0.05, -4.2, 0.5, 0.1, 0.5, W('#c9a03a', 0.3));
    pendant(1.4, -4.4, F2 + 1.95, CEIL2, '#e0cfa8', upperLayer);
    // bathroom at the back-left: tub under the window
    box(-1.05, F2 + 0.28, -5.1, 0.7, 0.56, 1.3, W('#e8eef0', 0.3)); box(-1.05, F2 + 0.52, -5.1, 0.58, 0.02, 1.18, '#9fc4d0', false); box(-1.05, F2 + 2.0, -5.0, 0.3, 0.04, 0.3, W('#fff4d0', 0.95), false);
    for (const [x, z, r2] of [[1.4, -1.8, 2.8], [1.6, -4.6, 2.4], [-1.0, -0.9, 1.0]]) decal(r2, r2, x, F2 + 0.004, z, [0, -1], pool);
  }

  // ================= flat roof (roof layer): slab, grey membrane, parapet with coping, rooftop AC units, hatch, vent and antenna; downpipes =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('house4').add(roofLayer); K.setRoot(roofLayer);
  const cxm = (X0 + X1) / 2, czm = (Z0 + Z1) / 2;
  box((IX0 + IX1) / 2, CEIL2 + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false);
  box(cxm, EF - 0.1, czm, X1 - X0 + 0.1, 0.2, Z0 - Z1 + 0.05, '#c9c1b0');
  box(cxm, EF + 0.012, czm, X1 - X0 - 0.2, 0.024, Z0 - Z1 - 0.2, new THREE.MeshToonMaterial({ color: '#8f99a5', gradientMap: K.ramp }), false);
  box(cxm, EF + PAR / 2, Z0 - T / 2, X1 - X0, PAR, T, plaster); box(cxm, EF + PAR / 2, Z1 + T / 2, X1 - X0, PAR, T, plaster);
  box(X1 - T / 2, EF + PAR / 2, czm, T, PAR, Z0 - Z1 - 2 * T, plaster); box(X0 + T / 2, EF + PAR / 2, czm, T, PAR, Z0 - Z1 - 2 * T, plaster);
  box(cxm, EF + PAR + 0.03, Z0 - T / 2, X1 - X0 + 0.1, 0.06, T + 0.1, coping); box(cxm, EF + PAR + 0.03, Z1 + T / 2, X1 - X0 + 0.1, 0.06, T + 0.1, coping);
  box(X1 - T / 2, EF + PAR + 0.03, czm, T + 0.1, 0.06, Z0 - Z1, coping); box(X0 + T / 2, EF + PAR + 0.03, czm, T + 0.1, 0.06, Z0 - Z1, coping);
  // rooftop equipment: two condensing units on steel stands, an access hatch, a vent pipe and a TV antenna
  for (const [x, z] of [[2.5, -3.6], [0.7, -1.2]]) {
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + dx * 0.38, EF + 0.1, z + dz * 0.22, 0.05, 0.2, 0.05, steelC, false);
    box(x, EF + 0.42, z, 0.9, 0.5, 0.5, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.17, 16), mat('#3b4650'), x - 0.15, EF + 0.42, z + 0.255, false); box(x + 0.3, EF + 0.42, z + 0.255, 0.18, 0.3, 0.01, '#7b8a92', false);
  }
  box(-0.7, EF + 0.2, -4.8, 0.9, 0.4, 0.8, '#a8aeb4'); box(-0.7, EF + 0.42, -4.8, 1.0, 0.05, 0.9, '#7f8b93'); box(-0.7, EF + 0.2, -4.38, 0.5, 0.3, 0.02, '#59656d', false);
  cyl(1.6, EF + 0.35, -5.4, 0.05, 0.7, '#8796a0'); mesh(new THREE.ConeGeometry(0.09, 0.08, 8), mat('#8796a0'), 1.6, EF + 0.74, -5.4, false);
  rod([0.1, EF, -2.4], [0.1, EF + 1.5, -2.4], 0.018, '#8796a0'); for (let i = 0; i < 4; i++) rod([0.1, EF + 0.7 + i * 0.2, -2.7 + 0.07 * i], [0.1, EF + 0.7 + i * 0.2, -2.1 - 0.07 * i], 0.009, '#8796a0');
  group('house4');
  // downpipes with scupper heads at the front-right and rear-left corners, a second pipe on the right wall, pipe clips
  for (const [x, z] of [[X1 + 0.03, Z0 - 0.08], [X0 - 0.03, Z1 + 0.08]]) { cyl(x, (EF - 0.2 + 0.3) / 2, z, 0.04, EF - 0.5, '#8796a0'); box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91'); box(x, EF - 0.12, z, 0.14, 0.18, 0.14, '#7f8a92'); for (const y of [1.0, 2.6, 4.2]) box(x - Math.sign(x) * 0.02, y, z, 0.1, 0.04, 0.1, '#5f6c76', false); }
  cyl(X1 + 0.05, (EF + 0.3) / 2 - 0.1, -4.5, 0.025, EF - 0.4, '#6f7a82'); for (const y of [1.5, 3.4, 5.0]) box(X1 + 0.04, y, -4.5, 0.06, 0.04, 0.1, '#5f6c76', false);

  // ================= carport on the left: lean-to polycarbonate roof on steel posts, slat fence, compact car =================
  {
    const x0 = -3.9, x1 = X0 - 0.02, z0 = -5.0, z1 = 0.5, hi = 2.7, lo = 2.3, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, G = 0.19, fr = '#4a4f57';
    for (const [x, z, h] of [[x0 + 0.04, z1 - 0.04, lo], [x0 + 0.04, -2.2, lo], [x0 + 0.04, z0 + 0.04, lo], [x1 - 0.05, z1 - 0.04, hi], [x1 - 0.05, z0 + 0.04, hi]]) box(x, G + h / 2, z, 0.07, h, 0.07, fr);
    const ang = -Math.atan2(hi - lo, x1 - x0) * -1;
    const r = box(cx, G + (hi + lo) / 2 + 0.02, cz, Math.hypot(x1 - x0, hi - lo) + 0.1, 0.04, z1 - z0 + 0.1, new THREE.MeshPhysicalMaterial({ color: 0xbfe0e6, transparent: true, opacity: 0.4, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }), true); r.rotation.z = ang;
    for (let i = 0; i <= 5; i++) { const z = z0 + i * (z1 - z0) / 5, b = box(cx, G + (hi + lo) / 2 + 0.05, z, Math.hypot(x1 - x0, hi - lo) + 0.1, 0.05, 0.05, fr, false); b.rotation.z = ang; }
    box(cx, G + hi + 0.01, z1 - 0.02, x1 - x0, 0.06, 0.06, fr, false);
    // slat fence along the outer edge behind the car, and a back panel
    for (let i = 0; i < 8; i++) box(x0 - 0.01, G + 0.55, z0 + 0.1 + i * 0.22, 0.03, 1.1, 0.14, i % 2 ? '#a5764a' : '#b98a58');
    box(x0 - 0.01, G + 1.12, (z0 - 2.2) / 2 + 0.05, 0.05, 0.05, 2.9, fr, false);
    // compact car, nose to the street (+z): body, cabin, glass, wheels, lights
    const cxx = -2.8, czz = -1.3, cb = '#e4e6e4';
    box(cxx, G + 0.55, czz, 1.5, 0.5, 3.4, cb); box(cxx, G + 0.9, czz - 0.25, 1.38, 0.5, 1.9, cb);
    box(cxx, G + 0.92, czz - 0.25, 1.4, 0.38, 1.8, glass, false); box(cxx, G + 0.84, czz + 0.7, 1.4, 0.04, 0.06, '#59656d', false);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) { const w = cyl(cxx + dx * 0.72, G + 0.27, czz + dz * 1.05, 0.27, 0.2, '#2a2d31'); w.rotation.z = PI / 2; }
    for (const dx of [-0.5, 0.5]) { box(cxx + dx, G + 0.58, czz + 1.72, 0.28, 0.12, 0.04, '#ffe2a6', false); box(cxx + dx, G + 0.6, czz - 1.72, 0.26, 0.1, 0.04, '#c9402f', false); }
    box(cxx, G + 0.32, czz + 1.72, 1.2, 0.2, 0.04, '#59656d', false);
    mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.012, z1 - z0), 1, 2), warm('#ffffff', 0.04, pavers), cx, 0.2, cz, false);
  }

  // ================= gate side, front garden (right), east side strip, rear garden, ground, local animation =================
  const gshrub = (x, z, r, n, h) => shrub(x, 0.19 + 0.36 * r, z, r, n, h);   // keep the foliage above the plot surface
  group('house4Gate');
  {
    // wide low steps to the door, gatepost with mailbox and intercom left of the door, path stones, a pot (everything stays left of x -0.8 or below walking height)
    box(DXc, 0.225, 0.68, 1.4, 0.06, 0.34, '#8e8a80'); box(DXc, 0.2, 0.95, 1.3, 0.04, 0.2, '#8e8a80', false);
    for (let i = 0; i < 3; i++) box(DXc + (i % 2 ? 0.1 : -0.1), 0.205, 1.4 + i * 0.35, 0.7, 0.03, 0.3, '#a8a091', false);
    box(-1.15, 0.19 + 0.55, 1.75, 0.24, 1.1, 0.24, '#7e8794'); box(-1.15, 0.19 + 1.12, 1.75, 0.32, 0.05, 0.32, '#4a4f57'); box(-1.15, 0.19 + 0.8, 1.88, 0.2, 0.18, 0.04, '#8a98a0'); box(-1.15, 0.19 + 1.0, 1.88, 0.14, 0.05, 0.02, '#c9402f', false);
    pot(-1.15, 0.19, 1.2, 0.14, 5, 1.4, '#9b7d68');
  }
  group('house4Garden');
  {
    // front garden in front of the living-room window: block wall with a black railing, shrubs and grasses, stepping stones, garden lights, a small tree
    box(2.9, 0.19 + 0.2, 2.45, 4.0, 0.4, 0.14, '#a29e94'); box(2.9, 0.19 + 0.42, 2.45, 4.06, 0.05, 0.2, '#bdb8ac');
    for (let i = 0; i < 16; i++) box(0.95 + i * 0.25, 0.19 + 0.75, 2.45, 0.02, 0.6, 0.02, '#2a2d31', false); box(2.9, 0.19 + 1.05, 2.45, 4.0, 0.03, 0.03, '#2a2d31', false);
    for (let i = 0; i < 5; i++) gshrub(1.0 + i * 0.75, 2.0, 0.22, 5, 1.1);
    for (let i = 0; i < 3; i++) box(2.4 + i * 0.5, 0.205, 1.1 + (i % 2) * 0.4, 0.4, 0.03, 0.3, '#a8a091', false);
    for (const [x, z] of [[1.0, 1.4], [4.3, 1.5]]) { cyl(x, 0.19 + 0.22, z, 0.015, 0.44, '#59656d'); const p = mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffe2a6' }), x, 0.19 + 0.45, z, false); p.scale.setScalar(1.8); mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.2), x, 0.21, z, false).rotation.x = -PI / 2; }
    gshrub(1.2, 0.9, 0.28, 6, 1.5); gshrub(4.3, 0.7, 0.3, 7, 1.6);
  }
  group('house4East');
  {
    // east strip: black railing on a block base, bins in three colours, gas water heater on the east wall, shrubs
    box(4.85, 0.19 + 0.2, -2.9, 0.12, 0.4, 6.4, '#a29e94');
    for (let i = 0; i < 28; i++) box(4.85, 0.19 + 0.65, 0.2 - i * 0.23, 0.02, 0.5, 0.02, '#2a2d31', false);
    box(4.85, 0.19 + 0.92, -2.9, 0.04, 0.04, 6.4, '#2a2d31', false);
    for (const [z, c] of [[-1.0, '#3f6c4f'], [-1.45, '#4f7290'], [-1.9, '#c9a03a']]) { box(X1 + 0.4, 0.19 + 0.3, z, 0.4, 0.6, 0.38, c); box(X1 + 0.4, 0.19 + 0.62, z, 0.44, 0.04, 0.42, '#2f3944'); }
    box(X1 + 0.2, 0.19 + 0.55, -3.0, 0.3, 1.1, 0.5, '#d6d8d2'); box(X1 + 0.36, 0.19 + 0.65, -3.0, 0.01, 0.2, 0.3, '#7b8a92', false); box(X1 + 0.36, 0.19 + 0.3, -3.0, 0.01, 0.12, 0.2, '#c9402f', false);
    for (const z of [-2.9, -3.1]) rod([X1 + 0.1, 0.19 + 1.1, z], [X1 + 0.03, 0.19 + 1.5, z], 0.012, '#5f6c76');
    gshrub(X1 + 0.9, -4.6, 0.35, 8, 1.8); gshrub(X1 + 0.9, -0.3, 0.3, 6, 1.5); pot(X1 + 0.5, 0.19, -4.2, 0.14, 5, 1.4, '#7d6a5a');
  }
  group('house4Rear');
  {
    // rear garden: timber deck at the sliding door, AC outdoor unit, pots, rain barrel, shrubs
    box(1.7, 0.19 + 0.06, Z1 - 0.4, 2.5, 0.12, 0.8, '#a5764a'); for (let i = 0; i < 6; i++) box(0.5 + i * 0.45, 0.19 + 0.122, Z1 - 0.4, 0.02, 0.01, 0.78, '#6a5038', false);
    box(-0.4, 0.19 + 0.05, Z1 - 0.3, 0.9, 0.1, 0.42, '#7f8b93'); box(-0.4, 0.19 + 0.4, Z1 - 0.3, 0.7, 0.6, 0.34, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.2, 16), mat('#3b4650'), -0.45, 0.19 + 0.4, Z1 - 0.472, false).rotation.y = PI;
    cyl(3.3, 0.19 + 0.35, Z1 - 0.4, 0.22, 0.7, W('#6d7d84', 0.3)); cyl(3.3, 0.19 + 0.72, Z1 - 0.4, 0.23, 0.03, '#59656d');
    pot(-1.3, 0.19, Z1 - 0.3, 0.16, 6, 1.6); pot(0.1, 0.19, Z1 - 0.9, 0.14, 5, 1.4, '#7d6a5a'); gshrub(-2.3, Z1 - 0.5, 0.3, 6, 1.5);
  }
  group('house4Ground');
  const paveMat = warm('#ffffff', 0, pavers), pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-4.0, -1.6, 0.5, 2.5); pave(-1.6, 4.6, 0.5, 2.4); pave(X1, 4.7, -6.0, 0.5); pave(-4.7, 4.6, -7.1, -6.0); pave(-4.7, -4.0, -6.0, 0.5);
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(1.6, 1.4, DXc, 0.226, 0.9, [0, 1], spill); decal(3.4, 1.0, 2.0, 0.208, 0.9, [0, 1], additive(spillT, '#ffbf7a', 0.2)); decal(1.8, 1.6, -2.8, 0.208, 1.2, [0, 1], additive(glowT, '#cfe6ff', 0.12));

  const fx = new THREE.Group(); fx.userData.live = true; group('house4').add(fx); K.setRoot(fx);
  const upGlow = additive(glowT, '#ffd9a0', 0.1); mesh(new THREE.PlaneGeometry(2.8, 1.8), upGlow, 2.5, F2 + 1.3, 0.5, false, fx);
  const dnGlow = additive(glowT, '#ffe2b0', 0.18); mesh(new THREE.PlaneGeometry(3.0, 1.8), dnGlow, 2.0, F + 1.3, 0.5, false, fx);
  // a small tree in the front garden sways slightly
  const gardenFx = new THREE.Group(); gardenFx.userData.live = true; group('house4Garden').add(gardenFx);
  const tree = new THREE.Group(); tree.position.set(4.3, 0.19, 1.8); gardenFx.add(tree);
  cyl(0, 0.9, 0, 0.06, 1.8, '#6b4c36', tree);
  for (const [dx, dy, dz, r] of [[0, 2.1, 0, 0.55], [0.25, 1.7, 0.15, 0.4], [-0.25, 1.8, -0.1, 0.4], [0.05, 2.5, 0, 0.35]]) { const a = mesh(new THREE.SphereGeometry(1, 7, 5), mat(LEAF[(dx > 0) * 1 + (dz > 0) * 1]), dx, dy, dz, false, tree); a.scale.setScalar(r); }
  const batch = (c, o, par = fx) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; par.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6), cdrips = batch('#cee7e5', 0.6);
  for (const [w, n] of [[FL, 8], [UF, 7]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 0.8, w === FL ? 0.06 : 0.1, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 12; i++) drips.add(-1.1 + i * 0.42 + rnd() * 0.1, 2.4 + rnd() * 0.5, 0.44, 0.1, 2.6, 2.95, 2.1 + rnd() * 0.5);   // drips off the ledge edge
  for (let i = 0; i < 6; i++) cdrips.add(-3.9, 0.3 + rnd() * 1.7, 0.4 - i * 0.85, 0.1, 0.25, 2.1, 2.2 + rnd() * 0.4);
  runs.seal(); drips.seal(); cdrips.seal();
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt); cdrips.step(dt);
      tree.rotation.z = 0.03 * Math.sin(t * 0.8) * (0.7 + 0.3 * Math.sin(t * 0.31)); tree.rotation.x = 0.02 * Math.sin(t * 0.6 + 1);
      dnGlow.opacity = 0.16 + 0.04 * Math.sin(t * 0.6) * Math.sin(t * 0.27 + 1); upGlow.opacity = 0.09 + 0.02 * Math.sin(t * 0.45 + 2);
    },
  };
};
