// B02-P03 独栋住宅 3 (detached house 3): peach-grey two-storey house with a traditional dark-grey tile gable roof (kirizuma, gable to the street), a small second-floor
// balcony over the big living-room window, a tiled pent hood over the front door, carport with a polycarbonate roof on the right, black railing fence and the bins /
// water heater strip on the left, front garden with a gatepost mailbox on the left.
// Task card docs/buildings/tasks/B02-P03.md, reference docs/buildings/references/B02-P03.jpg. Third house of stage 6 (B02-P01: gable + timber strip + left carport,
// B02-P02: mono-pitch + sage + right carport); this one differs in walls, tile roof with deeper pitch, balcony and hood, and its plan (living room at the front).
// Local frame (placed by layout.js `buildings`, rotY 0: front +z faces the south street, local +x = world E): origin = middle of the buildable width (world x 31)
// and the front door (frozen entrance x = 31); the front wall is at z 0.
// House body x -3.6…1.65 (5.25), z -6.0…0; roof edges to x -3.85 / 1.9 and z +0.4 / -6.4; carport x 1.7…3.85, z +0.5…-5.0; balcony x -3.4…-0.9, z 0…+0.5.
// Groups: house3 (shell, floors, stair, roof, balcony, hood, carport, car) · house3Garden · house3West · house3Rear · house3Ground.
// Layers: f2 (upper storey), roof. Plan, ground: living room with the big window at the front-left, genkan right of the door, stair along the right wall rising towards the back,
// kitchen-dining at the back, WC at the back-right. Upper: master bedroom (balcony) at the front with an ensuite bath over the genkan, study at the back, landing over the WC.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B02-P03'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(5403), PI = Math.PI;
  const F = rec.floor, F2 = F + 2.75, EF = F2 + 2.55, X0 = -3.6, X1 = 1.65, Z0 = 0, Z1 = -6.0, T = 0.15, BASE = 0.19, SLAB = 0.2;
  const CEIL1 = F2 - SLAB, CEIL2 = EF - 0.12, SLP = 0.6, OVS = 0.25, OVF = 0.4;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T, XM = (X0 + X1) / 2, HG = (X1 - X0) / 2 * SLP;   // HG: gable height above the wall top
  const DXc = 0;
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FD = [-0.45, 0.45, F, F + 2.1], FL = [-3.2, -0.95, F + 0.4, F + 2.1], FS = [0.75, 1.3, F + 0.9, F + 1.7];
  const UD = [-3.2, -1.1, F2, F2 + 2.1], UW = [-0.35, 0.35, F2 + 0.8, F2 + 1.9], UB = [0.8, 1.3, F2 + 0.9, F2 + 1.8];
  const RK = [-2.6, -1.3, F + 1.0, F + 1.9], RK2 = [-0.9, -0.3, F + 1.0, F + 1.7], RWC = [0.8, 1.3, F + 1.3, F + 1.9];
  const RU = [[-2.8, -1.4, F2 + 0.8, F2 + 1.9], [-0.8, -0.2, F2 + 1.2, F2 + 1.9]];
  const LG = [[-1.5, -0.7, F + 0.8, F + 1.8], [-4.7, -3.9, F + 0.8, F + 1.8]], LU = [[-1.3, -0.8, F2 + 0.8, F2 + 1.9], [-4.6, -4.1, F2 + 1.0, F2 + 1.9]];
  const EGd = [[-3.3, -2.6, F + 1.0, F + 1.8]], EU = [[-3.3, -2.6, F2 + 0.9, F2 + 1.9], [-5.0, -4.5, F2 + 1.2, F2 + 1.9]];
  const ZS = -1.6, ZL = -4.3, SXc = 1.08;   // stair flight along the right wall: x 0.7…1.46, bottom at z ZS (floor), head at z ZL (2F level), climbing towards the back

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#d6baa9'), timber = '#5a4030', timberL = '#a97a4e', slat = '#b98a58', stoneC = '#9a958b', alu = '#5a4636', trim = '#4f6158', green = '#2f5446';
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

  // ---- house materials: peach-grey plaster, dark-brown frames, dark grey tile roof ----
  const timberFrame = '#5a4636';
  const slateT = tex(128, 128, (q, w, h) => { q.fillStyle = '#3d424b'; q.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) { const g = q.createLinearGradient(0, r * 16, 0, r * 16 + 16); g.addColorStop(0, '#31353d'); g.addColorStop(0.6, '#4a505a'); g.addColorStop(1, '#2d3138'); q.fillStyle = g; q.fillRect(0, r * 16, w, 16);
      q.fillStyle = 'rgba(10,12,18,.65)'; q.fillRect(0, r * 16, w, 2); for (let c = 0; c < 4; c++) q.fillRect(c * 32 + (r % 2) * 16, r * 16, 1.5, 16); }
    for (let i = 0; i < 500; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '8,12,18' : '190,205,225'},${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 2, 1); } });
  slateT.repeat.set(2, 2);
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: slateT });
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
  group('house3');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, F2], [FD, FL, FS], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, F2], [RK, RK2, RWC], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, F2], EGd, plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, F2], LG, plaster);
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FD[0], Z0, 1); plinth('x', FD[1], X1, Z0, 1); plinth('x', X0, X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  box((X0 + X1) / 2, F2 - 0.1, 0.012, X1 - X0 + 0.06, 0.2, 0.04, '#e0cbbd'); box((X0 + X1) / 2, F2 - 0.1, Z1 - 0.012, X1 - X0 + 0.06, 0.2, 0.04, '#e0cbbd');
  for (const [x, o] of [[X0, -1], [X1, 1]]) box(x + o * 0.012, F2 - 0.1, (Z0 + Z1) / 2, 0.04, 0.2, Z0 - Z1 + 0.06, '#e0cbbd');
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.2, planks), (IX0 + IX1) / 2, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  mesh(tileUV(new THREE.BoxGeometry(IX1 + 0.5, 0.014, IZ0 + 1.55), 1, 1), warm('#ffffff', 0.1, pavers), (IX1 - 0.5) / 2, F + 0.007, (IZ0 - 1.55) / 2, false);   // genkan tile (x -0.5…1.5)
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL1], [FD, FL, FS], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL1], EGd, cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL1], LG, cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL1], [RK, RK2, RWC], cream);
  // ground partitions: stair-hall wall at x 0.6 (with the WC door at the back), WC front wall at z -4.3, genkan wall at x -0.5 with a doorway to the living room
  wall('z', 0.6, 0.1, [IZ1, ZS, F, CEIL1], [[-5.4, -4.6, F, F + 2.0]], plaster);
  wall('x', ZL, 0.1, [0.6, IX1, F, CEIL1], [], plaster);
  wall('z', -0.5, 0.1, [-1.55, IZ0, F, CEIL1], [[-1.3, -0.4, F, F + 2.0]], plaster);

  // ---- exterior: windows, door, hood, porch ----
  glaze('x', -T / 2, 1, FL, [-2.07]); glaze('x', -T / 2, 1, FS, [], [], 0.1);
  glaze('x', Z1 + T / 2, -1, RK, [-1.95]); glaze('x', Z1 + T / 2, -1, RK2); glaze('x', Z1 + T / 2, -1, RWC, [], [], 0.1);
  glaze('z', X1 - T / 2, 1, EGd[0], [], [], 0.1);
  for (const w of LG) glaze('z', X0 + T / 2, -1, w, [], [], 0.1);
  // Front door: timber leaf with a tall glass slit, handle, lamp; tiled pent hood (庇) over the door on slim posts.
  {
    ab('x', FD[0] + 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, timberFrame); ab('x', FD[1] - 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, timberFrame); box(DXc, FD[3] - 0.04, -T / 2, 0.9, 0.08, 0.16, timberFrame);
    box(DXc, (F + FD[3] - 0.08) / 2, -0.05, 0.82, FD[3] - 0.08 - F, 0.05, '#8f6439');
    for (const y of [0.7, 1.2, 1.7]) box(DXc, F + y - 0.3, -0.012, 0.7, 0.4, 0.012, '#a87a4c', false);
    box(DXc - 0.2, F + 1.55, 0.0, 0.14, 0.7, 0.012, glass, false);
    box(DXc + 0.3, F + 1.05, 0.0, 0.03, 0.2, 0.05, '#c9c9c0'); box(DXc + 0.58, F + 1.5, 0.0, 0.1, 0.06, 0.03, '#8a98a0');
    box(0.7, 2.1, 0.07, 0.14, 0.16, 0.1, '#3d4a58'); box(0.7, 2.09, 0.07, 0.1, 0.12, 0.105, bulb, false);
    mesh(new THREE.PlaneGeometry(1.0, 1.0), additive(glowT, '#ffc27e', 0.22), 0.7, 2.08, 0.04, false);
    const hd = box(0.5, 2.62, 0.25, 2.5, 0.08, 0.62, roofM); hd.rotation.x = 0.25; box(0.5, 2.7, 0.0, 2.5, 0.08, 0.04, '#2f343c'); box(0.5, 2.52, 0.54, 2.5, 0.05, 0.05, '#2f343c', false);
    for (const x of [-0.7, 1.7]) rod([x, 2.3, 0.02], [x, 2.62, 0.48], 0.015, '#3d4a58'); box(1.7, 1.3, 0.48, 0.07, 2.2, 0.07, '#5a4636');
    box(DXc, 0.255, 0.25, 1.4, 0.1, 0.5, '#a8a091'); box(DXc, 0.215, 0.1, 1.5, 0.03, 0.2, '#8e8a80', false);   // porch slab (the lower steps are in house3Garden)
  }
  // Second-floor balcony over the living-room window: slab, timber balustrade, drip lip
  {
    const bx0 = -3.4, bx1 = -0.9, bz = 0.5, cx = (bx0 + bx1) / 2, rz = bz - 0.03;
    box(cx, F2 - 0.1, bz / 2, bx1 - bx0, 0.2, bz, '#cdb7a8'); box(cx, F2 - 0.03, bz - 0.01, bx1 - bx0, 0.04, 0.03, '#a8968a', false);
    for (let i = 0; i <= 10; i++) box(bx0 + 0.04 + i * (bx1 - bx0 - 0.08) / 10, F2 + 0.5, rz, 0.04, 1.0, 0.04, '#4a3a2e');
    box(cx, F2 + 1.02, rz, bx1 - bx0, 0.06, 0.08, '#8a6a48'); box(cx, F2 + 0.12, rz, bx1 - bx0, 0.06, 0.04, '#4a3a2e'); box(cx, F2 + 0.55, rz, bx1 - bx0 - 0.1, 0.04, 0.02, '#4a3a2e', false);
    for (const x of [bx0 + 0.03, bx1 - 0.03]) { box(x, F2 + 1.02, bz / 2, 0.06, 0.06, bz, '#8a6a48'); box(x, F2 + 0.5, 0.04, 0.05, 1.0, 0.05, '#4a3a2e'); }
    pot(-1.3, F2, 0.3, 0.14, 5, 1.6, '#8f9aa0'); pot(-3.1, F2, 0.3, 0.12, 4, 1.3, '#9b7d68'); box(cx, F2 - 0.21, bz - 0.02, bx1 - bx0, 0.03, 0.04, '#6c7078', false);
  }

  // ================= upper storey, slab, stair =================
  const stairMat = W('#b9946a', 0.26), rise = (F2 - F) / 14, run = (ZS - ZL) / 14;
  const upperLayer = new THREE.Group(); upperLayer.userData.layer = 'f2'; group('house3').add(upperLayer); K.setRoot(upperLayer);
  wall('x', Z0 - T / 2, T, [X0, X1, F2, EF], [UD, UW, UB], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, F2, EF], RU, plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, F2, EF], EU, plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, F2, EF], LU, plaster);
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F2, CEIL2], [UD, UW, UB], cream); panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F2, CEIL2], RU, cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F2, CEIL2], EU, cream); panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F2, CEIL2], LU, cream);
  // partitions: landing / rooms at x 0.6 (ensuite door at the front, study door at the back), bath rear wall at z -1.6, wall between master bedroom and study at z -3.0
  wall('z', 0.6, 0.1, [IZ1, IZ0, F2, CEIL2 + 0.01], [[-1.2, -0.4, F2, F2 + 2.0], [-5.4, -4.6, F2, F2 + 2.0]], plaster);
  wall('x', ZS, 0.1, [0.6, IX1, F2, CEIL2 + 0.01], [], plaster);
  wall('x', -3.0, 0.1, [IX0, 0.6, F2, CEIL2 + 0.01], [[-2.0, -1.2, F2, F2 + 2.0]], plaster);
  for (const [a, b, c, d] of [[IX0, 0.6, IZ1, IZ0], [0.6, IX1, IZ1, ZL], [0.6, IX1, ZS, IZ0]]) box((a + b) / 2, F2 - SLAB / 2, (c + d) / 2, b - a, SLAB, d - c, '#c9c1b0', true, upperLayer);   // slab with the stair opening x 0.6…1.5, z -4.3…-1.6
  mesh(tileUV(new THREE.BoxGeometry(0.6 - IX0, 0.012, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.22, planks), (IX0 + 0.6) / 2, F2 + 0.006, (IZ0 + IZ1) / 2, false, upperLayer);
  mesh(tileUV(new THREE.BoxGeometry(IX1 - 0.6, 0.012, ZL - IZ1 < 0 ? IZ1 - ZL : ZL - IZ1), 1, 1), warm('#ffffff', 0.22, planks), (0.6 + IX1) / 2, F2 + 0.006, (IZ1 + ZL) / 2, false, upperLayer);   // landing
  mesh(tileUV(new THREE.BoxGeometry(IX1 - 0.6, 0.014, IZ0 - ZS), 1, 1), warm('#ffffff', 0.12, pavers), (0.6 + IX1) / 2, F2 + 0.007, (ZS + IZ0) / 2, false, upperLayer);   // ensuite bathroom tile
  box((IX0 + IX1) / 2, CEIL1 - 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false, upperLayer);    // ground ceiling
  glaze('x', -T / 2, 1, UD, [-2.15], [], 0, false); glaze('x', -T / 2, 1, UW, [], [], 0.1); glaze('x', -T / 2, 1, UB, [], [], 0.1);
  for (const r of RU) glaze('x', Z1 + T / 2, -1, r);
  for (const e of EU) glaze('z', X1 - T / 2, 1, e, [], [], 0.1); for (const w of LU) glaze('z', X0 + T / 2, -1, w);
  // stair: straight flight along the right wall rising towards the back; handrail on the open side
  K.setRoot(group('house3'));
  for (let i = 0; i < 14; i++) { const top = F + (i + 1) * rise, z = ZS - i * run - run / 2; box(SXc, top - 0.02, z, 0.76, 0.04, run + 0.02, stairMat); box(SXc, top - rise / 2, z + run / 2, 0.76, rise, 0.02, woodD, false); }
  { const a = Math.atan2(rise, run), l = Math.hypot(14 * run, 14 * rise); for (const dx of [-0.36, 0.36]) { const s = box(SXc + dx, F + 14 * rise / 2 - 0.02, (ZS + ZL) / 2, 0.04, 0.16, l, woodD); s.rotation.x = a; } }
  rod([0.66, F + 0.9, ZS], [0.66, F2 + 0.9, ZL], 0.02, '#3d4a58');
  // triangle gables are in the roof layer; interiors follow
  K.setRoot(group('house3'));
  const table = (x, z, w, d, hgt, layer, base = F, top = wood) => { box(x, base + hgt - 0.02, z, w, 0.04, d, top, true, layer);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(x + dx * (w / 2 - 0.05), base + hgt / 2, z + dz * (d / 2 - 0.05), 0.05, hgt - 0.04, 0.05, woodD, false, layer); };
  const chair = (x, z, face, base = F, c = '#6b8a9a', layer) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + dx * 0.17, base + 0.22, z + dz * 0.17, 0.035, 0.44, 0.035, woodD, false, layer);
    box(x, base + 0.45, z, 0.4, 0.04, 0.4, W(c, 0.3), true, layer); const bx = x - face[0] * 0.19, bz = z - face[1] * 0.19; box(bx, base + 0.68, bz, face[0] ? 0.03 : 0.38, 0.4, face[0] ? 0.38 : 0.03, woodD, true, layer); };
  const pendant = (x, z, y, top, c = '#e0cfa8', layer) => { rod([x, top, z], [x, y + 0.08, z], 0.006, '#3a3330', layer); mesh(new THREE.ConeGeometry(0.13, 0.15, 14, 1, true), W(c, 0.3), x, y + 0.07, z, true, layer); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false, layer); };
  const chrome = W('#cfd6d8', 0.3);
  // ================= interior: ground floor =================
  {
    // genkan: shoe cabinet on the right wall, shoes, umbrella stand, hooks on the genkan wall
    box(1.2, F + 0.55, -0.85, 0.3, 1.1, 0.9, woodD); box(1.2, F + 1.12, -0.85, 0.34, 0.04, 0.96, wood);
    for (let i = 0; i < 3; i++) box(1.04, F + 0.25 + i * 0.3, -0.85, 0.02, 0.22, 0.8, W('#8a6a48', 0.3), false);
    for (let i = 0; i < 3; i++) box(0.4, F + 0.02, -0.4 - i * 0.2, 0.26, 0.04, 0.1, W(['#2f3944', '#c9402f', '#e8e4d6'][i], 0.4), false);
    cyl(0.25, F + 0.28, -1.35, 0.1, 0.56, W('#4f7290', 0.3)); for (const x of [0.21, 0.29]) rod([x, F + 0.5, -1.35], [x + 0.02, F + 0.95, -1.33], 0.012, '#2f3944');
    box(-0.45, F + 1.7, -0.9, 0.05, 0.03, 0.6, wood, false); for (let i = 0; i < 3; i++) cyl(-0.43, F + 1.62, -0.7 - i * 0.2, 0.015, 0.06, '#59656d');
    pendant(0.5, -0.8, F + 2.0, CEIL1, '#e0cfa8');
    // living room at the front-left behind the big window: armchair and plant near the glass, sofa facing a TV unit on the left wall, rug and low table
    box(-2.0, F + 0.012, -2.0, 2.4, 0.024, 2.2, W('#a8826a', 0.28), false);
    box(-2.0, F + 0.28, -0.7, 0.7, 0.5, 0.7, W('#8a9a7a', 0.3)); box(-2.0, F + 0.6, -0.4, 0.7, 0.55, 0.12, W('#8a9a7a', 0.3)); for (const dx of [-0.38, 0.38]) box(-2.0 + dx, F + 0.42, -0.7, 0.1, 0.35, 0.7, W('#7a8a6a', 0.3));
    pot(-3.1, F, -0.5, 0.17, 6, 2, '#8f9aa0');
    box(-1.15, F + 0.28, -2.2, 0.7, 0.5, 1.7, W('#9a8a9a', 0.3)); box(-0.8, F + 0.6, -2.2, 0.14, 0.55, 1.7, W('#9a8a9a', 0.3));
    for (const dz of [-0.8, 0.8]) box(-1.15, F + 0.4, -2.2 + dz, 0.7, 0.45, 0.12, W('#8a7a8a', 0.3));
    table(-2.1, -2.2, 0.5, 0.9, 0.38, undefined, F, wood);
    box(-3.2, F + 0.3, -2.2, 0.4, 0.6, 1.3, woodD); box(-3.1, F + 0.88, -2.2, 0.06, 0.5, 0.9, W('#2f2a26', 0.08));
    cyl(-0.8, F + 0.7, -3.0, 0.02, 1.4, '#3d4a58'); mesh(new THREE.ConeGeometry(0.17, 0.2, 12, 1, true), W('#efe0c0', 0.8), -0.8, F + 1.45, -3.0, true);
    for (const x of [FL[0] + 0.12, FL[1] - 0.12]) box(x, F + 1.2, IZ0 - 0.04, 0.24, 1.9, 0.05, W('#ebdcc6', 0.4), true);   // curtains
    pendant(-2.0, -1.4, F + 1.95, CEIL1, '#e8c9a0');
    // kitchen-dining at the back: counter along the rear wall under the window, fridge in the corner, table for four, pendant
    box(-1.7, F + 0.45, IZ1 + 0.3, 1.8, 0.9, 0.6, W('#d6cfba', 0.3)); box(-1.7, F + 0.92, IZ1 + 0.3, 1.84, 0.04, 0.64, steel); box(-2.0, F + 0.94, IZ1 + 0.3, 0.5, 0.02, 0.4, '#59656d', false);
    for (const dx of [0.35, 0.7]) box(-1.7 + dx, F + 0.945, IZ1 + 0.3, 0.2, 0.012, 0.2, '#2a2d31', false); box(-1.3, F + 1.75, IZ1 + 0.28, 0.6, 0.12, 0.4, '#8a9096');
    box(-3.1, F + 0.9, IZ1 + 0.35, 0.6, 1.8, 0.62, W('#dfe3e0', 0.28));
    table(-1.6, -4.1, 1.1, 0.8, 0.74, undefined, F, wood); chair(-2.35, -4.1, [1, 0], F, '#c9a86a'); chair(-0.85, -4.1, [-1, 0], F, '#c9a86a'); chair(-1.6, -3.5, [0, -1], F, '#c9a86a'); chair(-1.6, -4.7, [0, 1], F, '#c9a86a');
    for (const dx of [-0.25, 0.1, 0.35]) cyl(-1.6 + dx, F + 0.78, -4.1, 0.07, 0.1, W(dx < 0 ? '#f0e8d4' : '#6aa0c0', 0.34));
    pendant(-1.6, -4.1, F + 1.9, CEIL1, '#d9c7a0');
    pot(-0.2, F, -5.5, 0.14, 6, 2, '#8f9aa0');
    // WC at the back-right
    cyl(1.05, F + 0.2, -5.5, 0.17, 0.4, W('#e8eef0', 0.3)); box(1.05, F + 0.5, -5.76, 0.36, 0.4, 0.14, W('#e8eef0', 0.3)); box(1.2, F + 0.85, -5.0, 0.2, 0.08, 0.3, W('#e8eef0', 0.3));
    box(1.0, F + 1.95, -5.0, 0.3, 0.04, 0.3, W('#fff4d0', 0.95), false);
    for (const [x, z, r2] of [[0.6, -0.8, 1.4], [-2.0, -1.8, 3.0], [-1.6, -4.2, 2.6], [1.0, -5.0, 1.0]]) decal(r2, r2, x, F + 0.003, z, [0, -1], pool);
  }
  // ================= interior: upper floor =================
  K.setRoot(upperLayer);
  {
    // master bedroom at the front (balcony door): bed with its head on the left wall, bedside tables, wardrobe on the dividing wall, dresser
    box(-1.9, F2 + 0.012, -1.7, 2.2, 0.024, 1.8, W('#8f7a6a', 0.26), false);
    box(-2.4, F2 + 0.22, -1.65, 2.0, 0.3, 1.5, woodD); box(-2.4, F2 + 0.45, -1.65, 1.92, 0.16, 1.42, W('#e6d6d6', 0.3)); box(-3.2, F2 + 0.56, -1.65, 0.3, 0.12, 1.1, W('#f0e8d4', 0.34));
    box(-1.9, F2 + 0.58, -1.65, 1.0, 0.06, 1.42, W('#c9a0a8', 0.3)); box(-3.4, F2 + 0.9, -1.65, 0.08, 0.9, 1.7, woodD);
    for (const dz of [-0.9, 0.9]) box(-3.2, F2 + 0.28, -1.65 + dz, 0.35, 0.4, 0.35, woodD);
    box(-1.7, F2 + 1.0, -2.78, 1.6, 2.0, 0.4, woodD); box(-1.7, F2 + 1.0, -2.57, 0.02, 1.9, 0.02, wood, false);
    box(0.35, F2 + 0.4, -2.5, 0.4, 0.8, 0.9, woodD);
    pendant(-1.9, -1.4, F2 + 1.95, CEIL2, '#e8c9a0');
    for (const x of [UD[0] + 0.12, UD[1] - 0.12]) box(x, F2 + 1.2, IZ0 - 0.04, 0.26, 1.9, 0.05, W('#e6d6c0', 0.4), true);
    // ensuite bath over the genkan: tub under the window, basin
    box(1.1, F2 + 0.28, -0.8, 0.7, 0.56, 1.2, W('#e8eef0', 0.3)); box(1.1, F2 + 0.52, -0.8, 0.58, 0.02, 1.08, '#9fc4d0', false); box(0.9, F2 + 0.4, -1.4, 0.3, 0.8, 0.3, W('#d6cfba', 0.3)); box(1.05, F2 + 2.0, -0.8, 0.3, 0.04, 0.3, W('#fff4d0', 0.95), false);
    // study at the back: desk under the window, chair, bookcase on the left wall, floor cushion
    table(-2.1, -5.55, 1.4, 0.6, 0.74, upperLayer, F2, wood); chair(-2.1, -5.0, [0, 1], F2, '#c9a86a', upperLayer);
    cyl(-1.5, F2 + 0.95, -5.55, 0.05, 0.4, '#3d4a58', upperLayer); mesh(new THREE.ConeGeometry(0.1, 0.14, 10, 1, true), W('#efe0c0', 0.8), -1.5, F2 + 1.2, -5.55, true, upperLayer);
    box(-3.3, F2 + 0.9, -4.3, 0.3, 1.8, 1.2, woodD); for (let k = 0; k < 4; k++) { box(-3.16, F2 + 0.2 + k * 0.4, -4.3, 0.02, 0.3, 1.1, W('#e8e4d6', 0.3), false); for (let i = 0; i < 7; i++) box(-3.14, F2 + 0.33 + k * 0.4, -3.8 - i * 0.15, 0.05, 0.22, 0.11, W(['#2a8a68', '#c9402f', '#e0b040', '#4f7290', '#e8e4d6'][(i + k) % 5], 0.36), false); }
    box(-0.9, F2 + 0.05, -4.4, 0.5, 0.1, 0.5, W('#c9a03a', 0.3));
    pendant(-1.7, -4.4, F2 + 1.95, CEIL2, '#e0cfa8', upperLayer);
    pot(1.15, F2, -5.5, 0.14, 6, 1.8, '#8f9aa0');   // landing plant
    for (const [x, z, r2] of [[-1.9, -1.7, 2.8], [-1.8, -4.6, 2.4], [1.1, -0.9, 1.0]]) decal(r2, r2, x, F2 + 0.004, z, [0, -1], pool);
  }

  // ================= tile gable roof (roof layer): two dark tile slopes, plaster gables with a round louver, ridge with end tiles, gutters, vents =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('house3').add(roofLayer); K.setRoot(roofLayer);
  box((IX0 + IX1) / 2, CEIL2 + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false);
  const xa = X0 - OVS, xb = X1 + OVS, za = Z1 - OVF, zb = Z0 + OVF, ye = EF - OVS * SLP, yr = ye + SLP * (XM - xa);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const face = pts => {
    const p0 = pts[0], u = pts[1].clone().sub(p0).normalize(), c = pts[2].clone().sub(p0);
    let n = u.clone().cross(c).normalize(); if (n.y < 0) n.negate();
    const v = n.clone().cross(u), sh = new THREE.Shape(pts.map(P => { const d = P.clone().sub(p0); return new THREE.Vector2(d.dot(u), d.dot(v)); }));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 1 }), o = p0.clone().addScaledVector(n, -0.1);
    const m = mesh(g, roofM, o.x, o.y, o.z); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)); return m;
  };
  face([V(xa, ye, zb), V(xa, ye, za), V(XM, yr, za), V(XM, yr, zb)]);
  face([V(xb, ye, za), V(xb, ye, zb), V(XM, yr, zb), V(XM, yr, za)]);
  box(XM, yr + 0.08, (za + zb) / 2, 0.26, 0.14, zb - za + 0.1, '#2a2e35');
  for (const z of [zb, za]) { const e = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10), mat('#2a2e35'), XM, yr + 0.2, z + Math.sign(z - (za + zb) / 2) * 0.03, false); e.rotation.x = PI / 2; }   // ridge end tiles
  shapeMesh([[X0, EF], [X1, EF], [XM, EF + HG - 0.08]], T, plaster, 0, 0, Z0 - T, 0); shapeMesh([[X0, EF], [X1, EF], [XM, EF + HG - 0.08]], T, plaster, 0, 0, Z1, 0);   // apex sunk below the tile surface (avoids z-fighting)
  for (const [z, o] of [[zb, 1], [za, -1]]) { rod([xa, ye + 0.04, z + o * 0.02], [XM, yr + 0.05, z + o * 0.02], 0.045, '#2a2e35'); rod([xb, ye + 0.04, z + o * 0.02], [XM, yr + 0.05, z + o * 0.02], 0.045, '#2a2e35'); }
  { const g = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 14), mat('#7a6a55'), XM, EF + 0.8, 0.02, false); g.rotation.x = PI / 2; mesh(new THREE.TorusGeometry(0.13, 0.015, 5, 14), mat('#4a3a2e'), XM, EF + 0.8, 0.03, false); }
  for (const [x, o] of [[xa, -1], [xb, 1]]) { const gg = new THREE.CylinderGeometry(0.06, 0.06, zb - za, 8, 1, true, 0, PI); gg.rotateX(PI / 2); gg.rotateZ(-PI / 2); mesh(gg, mat('#7f8a92'), x + o * 0.04, ye - 0.04, (za + zb) / 2); box(x + o * 0.02, ye + 0.02, (za + zb) / 2, 0.04, 0.1, zb - za, '#2a2e35'); }
  { const roofY = (x, z) => ye + SLP * Math.min(x - xa, xb - x), sm = mat('#7f8a92');
    for (const [x, z] of [[-2.6, -4.0], [-1.6, -4.8]]) { cyl(x, roofY(x, z) + 0.25, z, 0.045, 0.5, '#7f8a92'); mesh(new THREE.ConeGeometry(0.08, 0.07, 8), sm, x, roofY(x, z) + 0.53, z, false); }
    const mx = 0.6, mz = -2.5, my = roofY(mx, mz) - 0.02; rod([mx, my, mz], [mx, my + 1.3, mz], 0.018, sm); for (let i = 0; i < 4; i++) rod([mx, my + 0.6 + i * 0.2, mz - 0.3 + 0.07 * i], [mx, my + 0.6 + i * 0.2, mz + 0.3 - 0.07 * i], 0.009, sm); }
  group('house3');
  for (const [x, z] of [[xb + 0.02, zb - 0.1], [xa - 0.02, za + 0.1]]) { cyl(x, (ye - 0.1 + 0.3) / 2, z, 0.04, ye - 0.4, '#7f8a92'); box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91'); for (const y of [1.0, 2.6, 4.2]) box(x - Math.sign(x) * 0.02, y, z, 0.1, 0.04, 0.1, '#5f6c76', false); }

  // ================= carport on the right: lean-to polycarbonate roof, timber posts, slat fence on the outer side and back, compact car =================
  {
    const x0 = X1 + 0.05, x1 = 3.85, z0 = -5.0, z1 = 0.5, hi = 2.7, lo = 2.35, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, G = 0.19, fr = '#6a5038';
    for (const [x, z, h] of [[x1 - 0.04, z1 - 0.04, lo], [x1 - 0.04, -2.2, lo], [x1 - 0.04, z0 + 0.04, lo], [x0 + 0.15, z1 - 0.04, hi], [x0 + 0.15, z0 + 0.04, hi]]) box(x, G + h / 2, z, 0.07, h, 0.07, fr);
    const ang = -Math.atan2(hi - lo, x1 - x0);
    const r = box(cx, G + (hi + lo) / 2 + 0.02, cz, Math.hypot(x1 - x0, hi - lo) + 0.1, 0.04, z1 - z0 + 0.1, new THREE.MeshPhysicalMaterial({ color: 0xbfe0e6, transparent: true, opacity: 0.4, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }), true); r.rotation.z = ang;
    for (let i = 0; i <= 5; i++) { const z = z0 + i * (z1 - z0) / 5, b = box(cx, G + (hi + lo) / 2 + 0.05, z, Math.hypot(x1 - x0, hi - lo) + 0.1, 0.05, 0.05, fr, false); b.rotation.z = ang; }
    for (let i = 0; i < 9; i++) box(x1 + 0.0, G + 0.6, z0 + 0.1 + i * 0.24, 0.03, 1.2, 0.15, i % 2 ? '#9a6e44' : '#b08552');   // slat fence behind the car on the outer edge
    box(x1, G + 1.22, (z0 - 2.2) / 2 + 0.05, 0.05, 0.05, 2.9, fr, false);
    for (let i = 0; i < 9; i++) box(x0 + 0.15 + i * 0.25, G + 0.6, z0 - 0.02, 0.15, 1.2, 0.03, i % 2 ? '#9a6e44' : '#b08552');   // back panel
    // compact car, nose to the street (+z): silver body, cabin, glass, wheels, lights
    const cxx = 2.75, czz = -1.35, cb = '#a9b3c4';
    box(cxx, G + 0.55, czz, 1.5, 0.5, 3.4, cb); box(cxx, G + 0.9, czz - 0.25, 1.38, 0.5, 1.9, cb);
    box(cxx, G + 0.92, czz - 0.25, 1.4, 0.38, 1.8, glass, false); box(cxx, G + 0.84, czz + 0.7, 1.4, 0.04, 0.06, '#59656d', false);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) { const w = cyl(cxx + dx * 0.72, G + 0.27, czz + dz * 1.05, 0.27, 0.2, '#2a2d31'); w.rotation.z = PI / 2; }
    for (const dx of [-0.5, 0.5]) { box(cxx + dx, G + 0.58, czz + 1.72, 0.28, 0.12, 0.04, '#ffe2a6', false); box(cxx + dx, G + 0.6, czz - 1.72, 0.26, 0.1, 0.04, '#c9402f', false); }
    box(cxx, G + 0.32, czz + 1.72, 1.2, 0.2, 0.04, '#59656d', false);
    mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.012, z1 - z0), 1, 2), warm('#ffffff', 0.04, pavers), cx, 0.2, cz, false);
  }

  // ================= front garden (left), left strip with black railing fence / bins / water heater, rear garden, ground, local animation =================
  const gshrub = (x, z, r, n, h) => shrub(x, 0.19 + 0.36 * r, z, r, n, h);   // keep the foliage above the plot surface
  group('house3Garden');
  {
    // lower steps with a side rail, path stones to the street, low block wall along the front edge of the garden, mailbox post, planters, a maple, garden lights
    box(DXc, 0.225, 0.68, 1.3, 0.06, 0.34, '#8e8a80'); box(DXc, 0.2, 0.95, 1.2, 0.04, 0.2, '#8e8a80', false);
    for (let i = 0; i < 3; i++) box(DXc + (i % 2 ? 0.1 : -0.1), 0.205, 1.4 + i * 0.35, 0.7, 0.03, 0.3, '#a8a091', false);
    box(-2.85, 0.19 + 0.2, 2.45, 3.9, 0.4, 0.14, '#a29e94'); box(-2.85, 0.19 + 0.42, 2.45, 3.96, 0.05, 0.2, '#bdb8ac');
    box(-1.1, 0.19 + 0.55, 1.9, 0.22, 1.1, 0.22, '#5e4a3c'); box(-1.1, 0.19 + 1.12, 1.9, 0.3, 0.05, 0.3, '#3d4a58'); box(-1.1, 0.19 + 0.8, 2.02, 0.2, 0.18, 0.04, '#8a98a0'); box(-1.1, 0.19 + 1.0, 2.02, 0.14, 0.05, 0.02, '#c9402f', false);
    for (let i = 0; i < 5; i++) gshrub(-4.2 + i * 0.55, 2.15, 0.2, 5, 1.1);
    for (const [x, z] of [[-1.8, 1.3], [-3.7, 1.2]]) { cyl(x, 0.19 + 0.22, z, 0.015, 0.44, '#59656d'); const p = mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffe2a6' }), x, 0.19 + 0.45, z, false); p.scale.setScalar(1.8); mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.2), x, 0.21, z, false).rotation.x = -PI / 2; }
    pot(-1.0, 0.19, 0.7, 0.15, 5, 1.5, '#9b7d68'); gshrub(-2.6, 1.0, 0.3, 7, 1.6); gshrub(-4.1, 0.8, 0.26, 6, 1.5);
  }
  group('house3West');
  {
    // black railing fence on the west plot edge with a low block wall, bins in three colours and a gas water heater on the west wall, gravel strip
    for (let i = 0; i < 28; i++) box(-4.85, 0.19 + 0.55, 0.4 - i * 0.22, 0.02, 1.0, 0.02, '#2a2d31', false);
    box(-4.85, 0.19 + 1.05, -2.75, 0.04, 0.04, 6.2, '#2a2d31', false); box(-4.85, 0.19 + 0.2, -2.75, 0.06, 0.4, 6.2, '#a29e94');
    for (const [z, c] of [[-4.6, '#4f7290'], [-5.05, '#3f6c4f'], [-5.5, '#c9a03a']]) { box(-4.1, 0.19 + 0.3, z, 0.4, 0.6, 0.38, c); box(-4.1, 0.19 + 0.62, z, 0.44, 0.04, 0.42, '#2f3944'); }
    box(-3.75, 0.19 + 0.55, -2.7, 0.3, 1.1, 0.5, '#d6d8d2'); box(-3.89, 0.19 + 0.65, -2.7, 0.01, 0.2, 0.3, '#7b8a92', false); box(-3.89, 0.19 + 0.3, -2.7, 0.01, 0.12, 0.2, '#c9402f', false);
    for (const z of [-2.6, -2.8]) rod([-3.65, 0.19 + 1.1, z], [-3.5, 0.19 + 1.5, z], 0.012, '#5f6c76');
    box(-3.75, 0.19 + 0.05, -3.35, 0.4, 0.1, 0.9, '#7f8b93'); box(-3.75, 0.19 + 0.4, -3.35, 0.3, 0.6, 0.8, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.17, 16), mat('#3b4650'), -3.9, 0.19 + 0.4, -3.35, false).rotation.y = -PI / 2;
    gshrub(-4.4, -0.2, 0.3, 6, 1.5); gshrub(-4.4, -3.2, 0.25, 5, 1.5); pot(-4.15, 0.19, -1.2, 0.14, 5, 1.4, '#7d6a5a');
  }
  group('house3East');
  {
    // behind the carport: rain barrel, pots and a hedge on the east edge
    cyl(3.85, 0.19 + 0.35, -5.5, 0.22, 0.7, W('#6d7d84', 0.3)); cyl(3.85, 0.19 + 0.72, -5.5, 0.23, 0.03, '#59656d');
    gshrub(4.45, -2.0, 0.4, 8, 1.8); gshrub(4.45, -4.2, 0.4, 8, 1.8); pot(4.3, 0.19, 0.2, 0.15, 5, 1.4, '#8f9aa0'); pot(2.2, 0.19, -5.45, 0.14, 5, 1.3, '#9b7d68');
  }
  group('house3Rear');
  {
    // rear garden: AC outdoor unit on a stand, step mat at the kitchen window, pots, gravel
    box(-0.2, 0.19 + 0.05, Z1 - 0.3, 0.9, 0.1, 0.42, '#7f8b93'); box(-0.2, 0.19 + 0.4, Z1 - 0.3, 0.7, 0.6, 0.34, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.2, 16), mat('#3b4650'), -0.25, 0.19 + 0.4, Z1 - 0.472, false).rotation.y = PI;
    pot(-3.2, 0.19, Z1 - 0.3, 0.16, 6, 1.6); pot(-1.5, 0.19, Z1 - 0.8, 0.14, 5, 1.4, '#7d6a5a'); gshrub(1.2, Z1 - 0.5, 0.3, 6, 1.5);
    for (let i = 0; i < 14; i++) box(-3.2 + rnd() * 4.8, 0.2, Z1 - 0.45 - rnd() * 0.5, 0.12, 0.02, 0.1, '#bfb9a8', false);   // gravel
  }
  group('house3Ground');
  const paveMat = warm('#ffffff', 0, pavers), pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-4.7, 1.55, 0.5, 2.5); pave(1.6, 4.0, 0.5, 2.5); pave(1.6, 4.6, -6.0, 0.5); pave(-4.7, 4.6, -7.1, -6.0); pave(-4.7, -3.6, -6.0, 0.5);
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(1.6, 1.4, DXc, 0.226, 0.9, [0, 1], spill); decal(3.4, 1.0, -2.0, 0.208, 0.9, [0, 1], additive(spillT, '#ffbf7a', 0.2)); decal(1.8, 1.6, 2.8, 0.208, 1.2, [0, 1], additive(glowT, '#cfe6ff', 0.12));

  const fx = new THREE.Group(); fx.userData.live = true; group('house3').add(fx); K.setRoot(fx);
  const upGlow = additive(glowT, '#ffd9a0', 0.1); mesh(new THREE.PlaneGeometry(3.4, 1.8), upGlow, -2.1, F2 + 1.3, 0.5, false, fx);
  const dnGlow = additive(glowT, '#ffe2b0', 0.18); mesh(new THREE.PlaneGeometry(3.4, 1.8), dnGlow, -2.1, F + 1.3, 0.5, false, fx);
  // a maple in the front garden sways slightly
  const gardenFx = new THREE.Group(); gardenFx.userData.live = true; group('house3Garden').add(gardenFx);
  const tree = new THREE.Group(); tree.position.set(-4.0, 0.19, 1.5); gardenFx.add(tree);
  cyl(0, 0.9, 0, 0.06, 1.8, '#5e4636', tree);
  for (const [dx, dy, dz, r, c] of [[0, 2.1, 0, 0.55, '#a8553f'], [0.25, 1.7, 0.15, 0.4, '#c0603f'], [-0.25, 1.8, -0.1, 0.4, '#8f4a3a'], [0.05, 2.5, 0, 0.35, '#b85a3f']]) { const a = mesh(new THREE.SphereGeometry(1, 7, 5), mat(c), dx, dy, dz, false, tree); a.scale.setScalar(r); }
  const batch = (c, o, par = fx) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; par.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6), cdrips = batch('#cee7e5', 0.6);
  for (const [w, n] of [[FL, 8], [UD, 8]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 0.8, w === FL ? 0.06 : 0.1, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 14; i++) drips.add(i % 2 ? 1.95 : -3.9, 3.0 + rnd() * 4.0, -0.3 - i * 0.42 + (rnd() - 0.5) * 0.1, 0.1, 2.9, 7.0, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 6; i++) cdrips.add(3.85, 0.3 + rnd() * 1.7, 0.4 - i * 0.85, 0.1, 0.25, 2.1, 2.2 + rnd() * 0.4);
  runs.seal(); drips.seal(); cdrips.seal();
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt); cdrips.step(dt);
      tree.rotation.z = 0.03 * Math.sin(t * 0.8) * (0.7 + 0.3 * Math.sin(t * 0.31)); tree.rotation.x = 0.02 * Math.sin(t * 0.6 + 1);
      dnGlow.opacity = 0.16 + 0.04 * Math.sin(t * 0.6) * Math.sin(t * 0.27 + 1); upGlow.opacity = 0.09 + 0.02 * Math.sin(t * 0.45 + 2);
    },
  };
};
