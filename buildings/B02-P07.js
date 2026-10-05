// B02-P07 独栋住宅 7 (detached house 7): mist-white two-storey house under a warm-grey standing-seam metal salt-box roof (side gable, ridge pushed to the back so the front slope is long),
// a metal lean-to canopy across the ground-floor front, ribbon windows, a timber front door at the left end of the front, a wide living-room window, a carport with a polycarbonate roof
// on the LEFT (west) side, a block-planter front garden with a gatepost mailbox on the right, AC units, water heater and sorted bins on the east side, a bicycle at the back;
// the north-row plot faces the alley A03.
// Task card docs/buildings/tasks/B02-P07.md, reference docs/buildings/references/B02-P07.jpg. Seventh house of stage 6 (third of the north row; the previous houses use gable,
// mono-pitch, tile gable, flat, side-gable-with-cross-gable and hip roofs); the plan is the stair-along-the-side family of B02-P03/P06 mirrored, with a different envelope and layout of rooms.
// Local frame (placed by layout.js `buildings`, rotY 0: front +z faces the alley to the south, local +x = world E): origin = the front door (frozen entrance x = 31), the front wall is at z 0.
// House body x -1.5…3.3 (4.8), z -6.0…0; roof to x -1.8 / 3.6 and z +0.35 / -6.35 (ridge at z -3.6); front canopy z 0…0.55; carport x -3.9…-1.55, z +0.5…-5.0.
// Groups: house7 (shell, floors, stair, roof, canopy, carport, car) · house7Step · house7Garden (right of the door) · house7FrontW · house7West · house7East · house7Rear · house7Ground.
// Layers: f2 (upper storey), roof. Plan, ground: genkan at the front-left (door, shoe cabinet), living room at the front-right with the wide window, island kitchen along the back wall,
// stair along the west (left) wall rising towards the back with the WC behind it. Upper: main bedroom at the front-right with the ribbon window, wash room over the genkan, rear room with
// desk and a single bed, landing over the WC.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B02-P07'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(5707), PI = Math.PI;
  const F = rec.floor, F2 = F + 2.75, EF = F2 + 2.55, X0 = -1.5, X1 = 3.3, Z0 = 0, Z1 = -6.0, T = 0.15, BASE = 0.19, SLAB = 0.2;
  const CEIL1 = F2 - SLAB, CEIL2 = EF - 0.12, SF = 0.4, SR = 0.6, ZR = -3.6, OV = 0.3, OVF = 0.35, OVR = 0.35, RB = EF + 0.02;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T;
  const DXc = 0;
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FD = [-0.45, 0.45, F, F + 2.1], FW = [0.85, 3.0, F + 0.55, F + 1.9], FS = [-1.15, -0.8, F + 0.9, F + 1.8];
  const U1 = [0.0, 2.95, F2 + 0.8, F2 + 1.75], U2 = [-1.15, -0.8, F2 + 0.9, F2 + 1.8];
  const RK = [0.5, 2.4, F + 1.05, F + 1.8], RWC = [-1.2, -0.8, F + 1.3, F + 1.9];
  const RU = [[-1.2, -0.8, F2 + 0.9, F2 + 1.8], [0.4, 1.7, F2 + 0.9, F2 + 1.8], [2.2, 2.95, F2 + 1.0, F2 + 1.8]];
  const LG = [[-4.5, -3.7, F + 1.0, F + 1.8]], LU = [[-5.0, -4.0, F2 + 1.0, F2 + 1.8], [-3.0, -1.7, F2 + 0.9, F2 + 1.7]];
  const EG = [[-4.5, -3.7, F + 1.0, F + 1.8], [-2.6, -1.4, F + 0.9, F + 1.9]], EU = [[-2.4, -1.2, F2 + 0.9, F2 + 1.75], [-5.0, -4.2, F2 + 1.0, F2 + 1.8]];
  const ZS = -1.6, ZL = -4.3, SXc = -0.95, HW = -0.52;   // stair flight along the west wall: x -1.33…-0.57, bottom at z ZS (floor), head at z ZL (2F level), climbing towards the back; HW: x of the stair-hall wall

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#dfe2e3'), timber = '#5a4030', slat = '#a97a4e', stoneC = '#9a958b', alu = '#33383c', trim = '#4f5559';
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

  // ---- house materials: mist-white plaster, near-black frames, warm-grey standing-seam metal roof ----
  const metalT = tex(128, 128, (q, w, h) => { q.fillStyle = '#7a7572'; q.fillRect(0, 0, w, h);
    for (let s = 0; s < 2; s++) { const x = s * 64; const g = q.createLinearGradient(x, 0, x + 64, 0); g.addColorStop(0, '#6c6764'); g.addColorStop(0.5, '#84807c'); g.addColorStop(1, '#6a6562'); q.fillStyle = g; q.fillRect(x, 0, 64, h);
      q.fillStyle = 'rgba(30,28,28,.7)'; q.fillRect(x, 0, 3, h); q.fillStyle = 'rgba(235,232,226,.28)'; q.fillRect(x + 3, 0, 1.5, h); }
    for (let i = 0; i < 400; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '20,18,18' : '210,206,200'},${0.03 + rnd() * 0.05})`; q.fillRect(rnd() * w, rnd() * h, 1, 2 + rnd() * 6); } });
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: metalT });
  const metalC = metalT.clone(); metalC.repeat.set(5, 1); metalC.needsUpdate = true;
  const canopyM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: metalC });
  const roofDk = '#4b4745';
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

  // ================= ground-floor shell =================
  group('house7');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, F2], [FD, FW, FS], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, F2], [RK, RWC], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, F2], EG, plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, F2], LG, plaster);
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FD[0], Z0, 1); plinth('x', FD[1], X1, Z0, 1); plinth('x', X0, X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  const belt = '#c4cacc';
  box((X0 + X1) / 2, F2 - 0.1, 0.012, X1 - X0 + 0.06, 0.2, 0.04, belt); box((X0 + X1) / 2, F2 - 0.1, Z1 - 0.012, X1 - X0 + 0.06, 0.2, 0.04, belt);
  for (const [x, o] of [[X0, -1], [X1, 1]]) box(x + o * 0.012, F2 - 0.1, (Z0 + Z1) / 2, 0.04, 0.2, Z0 - Z1 + 0.06, belt);
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.2, planks), (IX0 + IX1) / 2, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  mesh(tileUV(new THREE.BoxGeometry(0.5 - IX0, 0.014, IZ0 + 1.55), 1, 1), warm('#ffffff', 0.1, pavers), (IX0 + 0.5) / 2, F + 0.007, (IZ0 - 1.55) / 2, false);   // genkan tile (x -1.35…0.5)
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL1], [FD, FW, FS], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL1], EG, cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL1], LG, cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL1], [RK, RWC], cream);
  // ground partitions: stair-hall wall at x HW (doorway to the WC at the back), WC front wall at z -4.3, genkan wall at x 0.5 with a doorway into the living room
  wall('z', HW, 0.1, [IZ1, ZS, F, CEIL1], [[-5.4, -4.6, F, F + 2.0]], plaster);
  wall('x', ZL, 0.1, [IX0, HW, F, CEIL1], [], plaster);
  wall('z', 0.5, 0.1, [-1.55, IZ0, F, CEIL1], [[-1.3, -0.4, F, F + 2.0]], plaster);

  // ---- exterior: windows, door, front canopy ----
  glaze('x', -T / 2, 1, FW, [1.92]); glaze('x', -T / 2, 1, FS, [], [], 0.1);
  glaze('x', Z1 + T / 2, -1, RK, [1.45]); glaze('x', Z1 + T / 2, -1, RWC, [], [], 0.1);
  for (const w of EG) glaze('z', X1 - T / 2, 1, w);
  for (const w of LG) glaze('z', X0 + T / 2, -1, w);
  // Front door (left end of the front): vertical-timber leaf with a lit slit, handle, lamp; the canopy runs across the whole front on slim brackets.
  {
    ab('x', FD[0] + 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, alu); ab('x', FD[1] - 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, alu); box(DXc, FD[3] - 0.04, -T / 2, 0.9, 0.08, 0.16, alu);
    box(DXc, (F + FD[3] - 0.08) / 2, -0.05, 0.82, FD[3] - 0.08 - F, 0.05, '#9a6a3c');
    for (let i = 0; i < 10; i++) box(DXc - 0.32 + i * 0.07, F + 0.95, -0.012, 0.012, 1.8, 0.012, '#6d4527', false);
    box(DXc + 0.28, F + 1.6, 0.0, 0.07, 0.8, 0.012, W('#fff0c8', 0.9), false); box(DXc + 0.2, F + 1.05, 0.0, 0.03, 0.4, 0.05, '#c9c9c0');
    box(0.67, 2.2, 0.07, 0.14, 0.16, 0.1, '#3d4a58'); box(0.67, 2.19, 0.07, 0.1, 0.12, 0.105, bulb, false);
    mesh(new THREE.PlaneGeometry(1.0, 1.0), additive(glowT, '#ffc27e', 0.22), 0.67, 2.18, 0.04, false);
    const cn = box(0.9, F + 2.35, 0.27, 5.0, 0.07, 0.56, canopyM); cn.rotation.x = 0.2;
    box(0.9, F + 2.24, 0.555, 5.0, 0.07, 0.04, roofDk); box(0.9, F + 2.41, 0.0, 5.0, 0.08, 0.04, roofDk);
    for (const x of [-1.3, 1.6, 3.2]) rod([x, F + 2.2, 0.02], [x, F + 2.3, 0.5], 0.015, '#3d4a58');
    box(DXc, 0.255, 0.25, 1.5, 0.1, 0.5, '#a8a091'); box(DXc, 0.215, 0.1, 1.6, 0.03, 0.2, '#8e8a80', false);   // porch slab (the lower steps are in house7Step)
  }

  // ================= upper storey, slab, stair =================
  const stairMat = W('#b9946a', 0.26), rise = (F2 - F) / 14, run = (ZS - ZL) / 14;
  const upperLayer = new THREE.Group(); upperLayer.userData.layer = 'f2'; group('house7').add(upperLayer); K.setRoot(upperLayer);
  wall('x', Z0 - T / 2, T, [X0, X1, F2, EF], [U1, U2], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, F2, EF], RU, plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, F2, EF], EU, plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, F2, EF], LU, plaster);
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F2, CEIL2], [U1, U2], cream); panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F2, CEIL2], RU, cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F2, CEIL2], EU, cream); panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F2, CEIL2], LU, cream);
  // partitions: landing / rooms at x HW (wash-room door at the front, rear-room door at the back), wash-room rear wall at z ZS, wall between main bedroom and rear room at z -3.0
  wall('z', HW, 0.1, [IZ1, IZ0, F2, CEIL2 + 0.01], [[-1.2, -0.4, F2, F2 + 2.0], [-5.4, -4.6, F2, F2 + 2.0]], plaster);
  wall('x', ZS, 0.1, [IX0, HW, F2, CEIL2 + 0.01], [], plaster);
  wall('x', -3.0, 0.1, [HW, IX1, F2, CEIL2 + 0.01], [[1.1, 1.9, F2, F2 + 2.0]], plaster);
  for (const [a, b, c, d] of [[HW, IX1, IZ1, IZ0], [IX0, HW, IZ1, ZL], [IX0, HW, ZS, IZ0]]) box((a + b) / 2, F2 - SLAB / 2, (c + d) / 2, b - a, SLAB, d - c, '#c9c1b0', true, upperLayer);   // slab with the stair opening x -1.35…-0.52, z -4.3…-1.6
  mesh(tileUV(new THREE.BoxGeometry(IX1 - HW, 0.012, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.22, planks), (HW + IX1) / 2, F2 + 0.006, (IZ0 + IZ1) / 2, false, upperLayer);
  mesh(tileUV(new THREE.BoxGeometry(HW - IX0, 0.012, IZ1 - ZL), 1, 1), warm('#ffffff', 0.22, planks), (IX0 + HW) / 2, F2 + 0.006, (IZ1 + ZL) / 2, false, upperLayer);   // landing
  mesh(tileUV(new THREE.BoxGeometry(HW - IX0, 0.014, IZ0 - ZS), 1, 1), warm('#ffffff', 0.12, pavers), (IX0 + HW) / 2, F2 + 0.007, (ZS + IZ0) / 2, false, upperLayer);   // wash-room tile
  box((IX0 + IX1) / 2, CEIL1 - 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false, upperLayer);    // ground ceiling
  glaze('x', -T / 2, 1, U1, [0.98, 1.96]); glaze('x', -T / 2, 1, U2, [], [], 0.1);
  for (const r of RU) glaze('x', Z1 + T / 2, -1, r);
  for (const e of EU) glaze('z', X1 - T / 2, 1, e); for (const w of LU) glaze('z', X0 + T / 2, -1, w);
  // stair: straight flight along the west wall rising towards the back; handrail on the hall side
  K.setRoot(group('house7'));
  for (let i = 0; i < 14; i++) { const top = F + (i + 1) * rise, z = ZS - i * run - run / 2; box(SXc, top - 0.02, z, 0.76, 0.04, run + 0.02, stairMat); box(SXc, top - rise / 2, z + run / 2, 0.76, rise, 0.02, woodD, false); }
  { const a = Math.atan2(rise, run), l = Math.hypot(14 * run, 14 * rise); for (const dx of [-0.36, 0.36]) { const s = box(SXc + dx, F + 14 * rise / 2 - 0.02, (ZS + ZL) / 2, 0.04, 0.16, l, woodD); s.rotation.x = a; } }
  rod([-0.59, F + 0.9, ZS], [-0.59, F2 + 0.9, ZL], 0.02, '#3d4a58');
  K.setRoot(group('house7'));
  const table = (x, z, w, d, hgt, layer, base = F, top = wood) => { box(x, base + hgt - 0.02, z, w, 0.04, d, top, true, layer);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(x + dx * (w / 2 - 0.05), base + hgt / 2, z + dz * (d / 2 - 0.05), 0.05, hgt - 0.04, 0.05, woodD, false, layer); };
  const chair = (x, z, face, base = F, c = '#6b8a9a', layer) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + dx * 0.17, base + 0.22, z + dz * 0.17, 0.035, 0.44, 0.035, woodD, false, layer);
    box(x, base + 0.45, z, 0.4, 0.04, 0.4, W(c, 0.3), true, layer); const bx = x - face[0] * 0.19, bz = z - face[1] * 0.19; box(bx, base + 0.68, bz, face[0] ? 0.03 : 0.38, 0.4, face[0] ? 0.38 : 0.03, woodD, true, layer); };
  const stool = (x, z) => { cyl(x, F + 0.32, z, 0.025, 0.64, '#59656d'); cyl(x, F + 0.65, z, 0.17, 0.05, W('#c9a86a', 0.3)); cyl(x, F + 0.02, z, 0.15, 0.02, '#59656d'); };
  const pendant = (x, z, y, top, c = '#e0cfa8', layer) => { rod([x, top, z], [x, y + 0.08, z], 0.006, '#3a3330', layer); mesh(new THREE.ConeGeometry(0.13, 0.15, 14, 1, true), W(c, 0.3), x, y + 0.07, z, true, layer); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false, layer); };
  // ================= interior: ground floor =================
  {
    // genkan: shoe cabinet on the west wall, shoes on the tile, umbrella stand against the genkan wall
    box(-1.2, F + 0.55, -1.0, 0.3, 1.1, 0.9, woodD); box(-1.2, F + 1.12, -1.0, 0.34, 0.04, 0.96, wood);
    for (let i = 0; i < 3; i++) box(-1.04, F + 0.25 + i * 0.3, -1.0, 0.02, 0.22, 0.8, W('#8a6a48', 0.3), false);
    for (let i = 0; i < 3; i++) box(-0.72, F + 0.02, -0.4 - i * 0.2, 0.26, 0.04, 0.1, W(['#2f3944', '#c9402f', '#e8e4d6'][i], 0.4), false);
    cyl(0.32, F + 0.28, -1.4, 0.1, 0.56, W('#4f7290', 0.3)); for (const x of [0.28, 0.36]) rod([x, F + 0.5, -1.4], [x + 0.02, F + 0.95, -1.38], 0.012, '#2f3944');
    pendant(-0.3, -0.8, F + 2.0, CEIL1, '#e0cfa8');
    // living room at the front-right behind the wide window: armchair and plant near the glass, sofa on the east wall facing a TV unit on the hall wall, rug and low table
    box(1.9, F + 0.012, -1.9, 2.0, 0.024, 2.0, W('#8f98a8', 0.28), false);
    box(2.3, F + 0.28, -0.75, 0.7, 0.5, 0.7, W('#c98a6a', 0.3)); box(2.3, F + 0.6, -0.42, 0.7, 0.55, 0.12, W('#c98a6a', 0.3)); for (const dx of [-0.38, 0.38]) box(2.3 + dx, F + 0.42, -0.75, 0.1, 0.35, 0.7, W('#b97a5a', 0.3));
    pot(3.0, F, -0.4, 0.15, 6, 2, '#8f9aa0');
    box(2.75, F + 0.28, -2.0, 0.7, 0.5, 1.7, W('#7d8fa0', 0.3)); box(3.05, F + 0.6, -2.0, 0.14, 0.55, 1.7, W('#7d8fa0', 0.3));
    for (const dz of [-0.8, 0.8]) box(2.75, F + 0.4, -2.0 + dz, 0.7, 0.45, 0.12, W('#6d7f90', 0.3));
    table(1.75, -2.0, 0.5, 0.9, 0.38, undefined, F, wood);
    box(-0.28, F + 0.3, -2.4, 0.34, 0.6, 1.2, woodD); box(-0.42, F + 0.88, -2.4, 0.06, 0.5, 0.85, W('#2f2a26', 0.08));
    for (const x of [FW[0] - 0.05, FW[1] + 0.05]) box(x, F + 1.2, IZ0 - 0.04, 0.24, 1.9, 0.05, W('#e6e0d0', 0.4), true);   // curtains
    pendant(1.9, -1.4, F + 1.95, CEIL1, '#e8c9a0');
    // kitchen at the back: counter with sink and hob along the rear wall, fridge, island with three stools, pendants
    box(1.2, F + 0.45, -5.55, 2.6, 0.9, 0.6, W('#d6cfba', 0.3)); box(1.2, F + 0.92, -5.55, 2.64, 0.04, 0.64, steel);
    box(1.45, F + 0.94, -5.55, 0.5, 0.02, 0.4, '#59656d', false); rod([1.45, F + 0.97, -5.72], [1.45, F + 1.2, -5.72], 0.012, '#c3cacb'); rod([1.45, F + 1.2, -5.72], [1.45, F + 1.2, -5.62], 0.012, '#c3cacb');
    for (const dx of [-0.15, 0.15]) cyl(0.2 + dx, F + 0.945, -5.55, 0.1, 0.012, '#2a2d31');
    box(0.2, F + 1.65, -5.65, 0.7, 0.12, 0.4, '#8a9096'); box(-0.15, F + 1.9, -5.65, 0.4, 0.5, 0.35, wood);
    box(2.85, F + 0.9, -5.5, 0.6, 1.8, 0.62, W('#dfe3e0', 0.28));
    box(1.5, F + 0.45, -3.95, 1.6, 0.9, 0.7, W('#c9a86a', 0.3)); box(1.5, F + 0.92, -3.95, 1.68, 0.05, 0.76, W('#efe8da', 0.34));
    for (const x of [1.0, 1.5, 2.0]) stool(x, -3.4);
    for (const dx of [-0.25, 0.1]) cyl(1.5 + dx, F + 0.99, -3.95, 0.07, 0.1, W(dx < 0 ? '#f0e8d4' : '#6aa0c0', 0.34));
    pendant(1.1, -3.95, F + 1.85, CEIL1, '#d9c7a0'); pendant(1.9, -3.95, F + 1.85, CEIL1, '#d9c7a0');
    for (const x of [RK[0] - 0.08, RK[1] + 0.08]) box(x, F + 1.45, IZ1 + 0.04, 0.2, 0.9, 0.05, W('#e3dcc4', 0.4), true);
    pot(2.55, F, -3.0, 0.12, 5, 2, '#8f9aa0');
    // WC behind the stair
    cyl(-0.95, F + 0.2, -5.45, 0.17, 0.4, W('#e8eef0', 0.3)); box(-0.95, F + 0.5, -5.72, 0.36, 0.4, 0.14, W('#e8eef0', 0.3)); box(-1.15, F + 0.85, -4.75, 0.2, 0.08, 0.3, W('#e8eef0', 0.3));
    box(-0.95, F + 1.95, -5.0, 0.3, 0.04, 0.3, W('#fff4d0', 0.95), false);
    for (const [x, z, r2] of [[-0.45, -0.8, 1.2], [1.7, -1.8, 2.8], [1.5, -4.5, 2.6], [-0.95, -5.0, 0.8]]) decal(r2, r2, x, F + 0.003, z, [0, -1], pool);
  }
  // ================= interior: upper floor =================
  K.setRoot(upperLayer);
  {
    // main bedroom at the front-right: bed with its head on the east wall, bedside tables, wardrobe on the dividing wall, plant by the ribbon window
    box(1.9, F2 + 0.012, -1.7, 2.8, 0.024, 2.2, W('#8f7a8a', 0.26), false);
    box(2.15, F2 + 0.22, -1.7, 2.0, 0.3, 1.5, woodD); box(2.15, F2 + 0.45, -1.7, 1.92, 0.16, 1.42, W('#e6dde0', 0.3)); box(2.98, F2 + 0.56, -1.7, 0.2, 0.12, 1.1, W('#f0e8d4', 0.34));
    box(1.7, F2 + 0.58, -1.7, 1.0, 0.06, 1.42, W('#8fa0b8', 0.3)); box(3.08, F2 + 0.9, -1.7, 0.08, 0.9, 1.7, woodD);
    for (const dz of [-0.75, 0.75]) box(2.95, F2 + 0.28, -1.7 + dz * 1.15, 0.35, 0.4, 0.35, woodD);
    box(0.25, F2 + 1.0, -2.75, 1.3, 2.0, 0.4, woodD); box(0.25, F2 + 1.0, -2.54, 0.02, 1.9, 0.02, wood, false);
    pendant(1.9, -1.4, F2 + 1.95, CEIL2, '#e8c9a0');
    for (const x of [U1[0] - 0.05, U1[1] + 0.05]) box(x, F2 + 1.2, IZ0 - 0.04, 0.24, 1.9, 0.05, W('#dcd8e0', 0.4), true);
    pot(0.0, F2, -0.4, 0.14, 6, 1.8, '#8f9aa0');
    // wash room over the genkan: vanity under the window, washing machine, mirror
    box(-1.08, F2 + 0.45, -0.45, 0.5, 0.9, 0.55, W('#d6cfba', 0.3)); box(-1.08, F2 + 0.92, -0.45, 0.54, 0.04, 0.6, steel); box(-1.08, F2 + 1.2, -0.12, 0.4, 0.5, 0.02, W('#dfeaf0', 0.5), false);
    box(-1.05, F2 + 0.45, -1.25, 0.55, 0.9, 0.55, W('#e8eef0', 0.3)); cyl(-0.78, F2 + 0.55, -1.25, 0.17, 0.02, '#59656d').rotation.z = PI / 2; box(-1.05, F2 + 2.0, -0.8, 0.3, 0.04, 0.3, W('#fff4d0', 0.95), false);
    // rear room: desk under the window, chair, bookcase on the hall wall, single bed under the east windows
    table(1.05, -5.55, 1.3, 0.6, 0.74, upperLayer, F2, wood); chair(1.05, -5.0, [0, 1], F2, '#6b8a9a', upperLayer);
    cyl(1.6, F2 + 0.95, -5.55, 0.05, 0.4, '#3d4a58', upperLayer); mesh(new THREE.ConeGeometry(0.1, 0.14, 10, 1, true), W('#efe0c0', 0.8), 1.6, F2 + 1.2, -5.55, true, upperLayer);
    box(-0.35, F2 + 0.9, -3.8, 0.3, 1.8, 1.2, woodD); for (let k = 0; k < 4; k++) { box(-0.2, F2 + 0.2 + k * 0.4, -3.8, 0.02, 0.3, 1.1, W('#e8e4d6', 0.3), false); for (let i = 0; i < 7; i++) box(-0.18, F2 + 0.33 + k * 0.4, -3.3 - i * 0.15, 0.05, 0.22, 0.11, W(['#2a8a68', '#c9402f', '#e0b040', '#4f7290', '#e8e4d6'][(i + k) % 5], 0.36), false); }
    box(2.6, F2 + 0.2, -4.7, 0.95, 0.3, 2.0, woodD); box(2.6, F2 + 0.4, -4.7, 0.9, 0.12, 1.94, W('#e0d8c6', 0.3)); box(2.6, F2 + 0.5, -4.2, 0.9, 0.06, 1.0, W('#c98a6a', 0.3)); box(2.6, F2 + 0.5, -5.45, 0.5, 0.08, 0.3, W('#f0e8d4', 0.34));
    pendant(1.2, -4.3, F2 + 1.95, CEIL2, '#e0cfa8', upperLayer);
    pot(-0.95, F2, -5.5, 0.14, 6, 1.8, '#8f9aa0');   // landing plant
    for (const [x, z, r2] of [[1.7, -1.7, 2.6], [1.4, -4.6, 2.4], [-0.95, -0.9, 0.8]]) decal(r2, r2, x, F2 + 0.004, z, [0, -1], pool);
  }

  // ================= warm-grey metal salt-box roof (roof layer): two standing-seam faces, ridge cap, barge boards, gutters, gable-end walls and louvres, vents =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('house7').add(roofLayer); K.setRoot(roofLayer);
  box((IX0 + IX1) / 2, CEIL2 + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false);
  const xa = X0 - OV, xb = X1 + OV, zf = Z0 + OVF, zr = Z1 - OVR, yr = RB + SF * -ZR, yef = RB - SF * OVF, yer = RB - SR * OVR, xc = (xa + xb) / 2;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const face = pts => {
    const p0 = pts[0], u = pts[1].clone().sub(p0).normalize(), c = pts[2].clone().sub(p0);
    let n = u.clone().cross(c).normalize(); if (n.y < 0) n.negate();
    const v = n.clone().cross(u), sh = new THREE.Shape(pts.map(P => { const d = P.clone().sub(p0); return new THREE.Vector2(d.dot(u), d.dot(v)); }));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 1 }), o = p0.clone().addScaledVector(n, -0.1);
    const m = mesh(g, roofM, o.x, o.y, o.z); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)); return m;
  };
  face([V(xa, yef, zf), V(xb, yef, zf), V(xb, yr, ZR), V(xa, yr, ZR)]);
  face([V(xb, yer, zr), V(xa, yer, zr), V(xa, yr, ZR), V(xb, yr, ZR)]);
  box(xc, yr + 0.05, ZR, xb - xa + 0.1, 0.12, 0.2, roofDk);
  // gable-end walls (asymmetric: the apex sits at the ridge, z ZR), barge boards on both slopes, a small louvre in each gable
  { const gp = [[Z1, EF], [Z0, EF], [ZR, yr - 0.1]];
    shapeMesh(gp, T, plaster, X0 + T, 0, 0, -PI / 2); shapeMesh(gp, T, plaster, X1, 0, 0, -PI / 2);
    for (const [x, o] of [[xa, -1], [xb, 1]]) { rod([x, yef + 0.02, zf], [x, yr + 0.02, ZR], 0.04, roofDk); rod([x, yer + 0.02, zr], [x, yr + 0.02, ZR], 0.04, roofDk); }
    for (const [x, o] of [[X0, -1], [X1, 1]]) { box(x + o * 0.03, EF + 0.75, ZR, 0.04, 0.34, 0.74, '#4b4745'); for (let i = 0; i < 4; i++) box(x + o * 0.05, EF + 0.62 + i * 0.09, ZR, 0.03, 0.02, 0.68, '#7d8588', false); } }
  for (const [z, y, o] of [[zf, yef, 1], [zr, yer, -1]]) { const gg = new THREE.CylinderGeometry(0.06, 0.06, xb - xa, 8, 1, true, 0, PI); gg.rotateZ(-PI / 2); mesh(gg, mat('#7f8a92'), xc, y - 0.04, z + o * 0.04); box(xc, y + 0.02, z + o * 0.02, xb - xa, 0.1, 0.04, roofDk); }
  { const roofY = (x, z) => z >= ZR ? RB + SF * -z : RB + SR * (z - Z1), sm = mat('#7f8a92');
    for (const [x, z] of [[1.6, -4.9], [0.2, -5.4]]) { cyl(x, roofY(x, z) + 0.25, z, 0.045, 0.5, '#7f8a92'); mesh(new THREE.ConeGeometry(0.08, 0.07, 8), sm, x, roofY(x, z) + 0.53, z, false); }
    const mx = 2.4, mz = -2.4, my = roofY(mx, mz) - 0.02; rod([mx, my, mz], [mx, my + 1.0, mz], 0.018, sm); for (let i = 0; i < 4; i++) rod([mx - 0.3, my + 0.45 + i * 0.16, mz + 0.07 * i], [mx + 0.3, my + 0.45 + i * 0.16, mz - 0.07 * i], 0.009, sm); }
  group('house7');
  for (const [x, z, ye] of [[xb + 0.02, zf - 0.1, yef], [xa - 0.02, zr + 0.1, yer]]) { cyl(x, (ye - 0.1 + 0.3) / 2, z, 0.04, ye - 0.4, '#7f8a92'); box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91'); for (const y of [1.0, 2.6, 4.2]) box(x - Math.sign(x) * 0.02, y, z, 0.1, 0.04, 0.1, '#5f6c76', false); }

  // ================= carport on the LEFT: lean-to polycarbonate roof, timber posts, slat fence on the outer side and back, compact car =================
  {
    const x0 = -3.9, x1 = X0 - 0.05, z0 = -5.0, z1 = 0.5, hi = 2.7, lo = 2.35, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, G = 0.19, fr = '#4a4f54';
    for (const [x, z, h] of [[x0 + 0.04, z1 - 0.04, lo], [x0 + 0.04, -2.2, lo], [x0 + 0.04, z0 + 0.04, lo], [x1 - 0.15, z1 - 0.04, hi], [x1 - 0.15, z0 + 0.04, hi]]) box(x, G + h / 2, z, 0.07, h, 0.07, fr);
    const ang = Math.atan2(hi - lo, x1 - x0);
    const r = box(cx, G + (hi + lo) / 2 + 0.02, cz, Math.hypot(x1 - x0, hi - lo) + 0.1, 0.04, z1 - z0 + 0.1, new THREE.MeshPhysicalMaterial({ color: 0xbfe0e6, transparent: true, opacity: 0.4, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }), true); r.rotation.z = ang;
    for (let i = 0; i <= 5; i++) { const z = z0 + i * (z1 - z0) / 5, b = box(cx, G + (hi + lo) / 2 + 0.05, z, Math.hypot(x1 - x0, hi - lo) + 0.1, 0.05, 0.05, fr, false); b.rotation.z = ang; }
    for (let i = 0; i < 9; i++) box(x0, G + 0.6, z0 + 0.1 + i * 0.24, 0.03, 1.2, 0.15, i % 2 ? '#8a6a48' : '#a5794a');   // slat fence behind the car on the outer edge
    box(x0, G + 1.22, (z0 - 2.2) / 2 + 0.05, 0.05, 0.05, 2.9, fr, false);
    for (let i = 0; i < 9; i++) box(x0 + 0.15 + i * 0.25, G + 0.6, z0 - 0.02, 0.15, 1.2, 0.03, i % 2 ? '#8a6a48' : '#a5794a');   // back panel
    // compact hatchback, nose to the street (+z): blue-grey body, cabin, glass, wheels, lights
    const cxx = -2.7, czz = -1.35, cb = '#8f9fb0';
    box(cxx, G + 0.55, czz, 1.5, 0.5, 3.4, cb); box(cxx, G + 0.9, czz - 0.25, 1.38, 0.5, 1.9, cb);
    box(cxx, G + 0.92, czz - 0.25, 1.4, 0.38, 1.8, glass, false); box(cxx, G + 0.84, czz + 0.7, 1.4, 0.04, 0.06, '#59656d', false);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) { const w = cyl(cxx + dx * 0.72, G + 0.27, czz + dz * 1.05, 0.27, 0.2, '#2a2d31'); w.rotation.z = PI / 2; }
    for (const dx of [-0.5, 0.5]) { box(cxx + dx, G + 0.58, czz + 1.72, 0.28, 0.12, 0.04, '#ffe2a6', false); box(cxx + dx, G + 0.6, czz - 1.72, 0.26, 0.1, 0.04, '#c9402f', false); }
    box(cxx, G + 0.32, czz + 1.72, 1.2, 0.2, 0.04, '#59656d', false);
    mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.012, z1 - z0), 1, 2), warm('#ffffff', 0.04, pavers), cx, 0.2, cz, false);
  }

  // ================= front garden (right), door steps, front-left pots, west fence, east side, rear yard, ground, local animation =================
  const gshrub = (x, z, r, n, h) => shrub(x, 0.19 + 0.36 * r, z, r, n, h);   // keep the foliage above the plot surface
  group('house7Step');
  {
    // lower steps in front of the door and path stones (below walking height, so they never block the door route)
    box(DXc, 0.225, 0.68, 1.4, 0.06, 0.34, '#8e8a80'); box(DXc, 0.2, 0.95, 1.3, 0.04, 0.2, '#8e8a80', false);
    for (let i = 0; i < 3; i++) box(DXc + (i % 2 ? 0.1 : -0.1), 0.205, 1.4 + i * 0.35, 0.7, 0.03, 0.3, '#a8a091', false);
  }
  group('house7Garden');
  {
    // block-planter garden right of the door: low wall along the alley edge, raised planter in front of the wide window, gatepost with mailbox and intercom, small tree, garden lights
    box(2.6, 0.19 + 0.2, 2.45, 3.8, 0.4, 0.14, '#a29e94'); box(2.6, 0.19 + 0.42, 2.45, 3.86, 0.05, 0.2, '#bdb8ac');
    box(2.5, 0.19 + 0.2, 1.1, 2.4, 0.4, 0.8, '#a29e94'); box(2.5, 0.19 + 0.38, 1.1, 2.2, 0.04, 0.6, '#4a3a2e', false);   // raised planter bed
    for (let i = 0; i < 8; i++) { const c = ['#d98aa6', '#f0d36a', '#c9a0d8', '#e8e4d6'][i % 4]; mesh(new THREE.SphereGeometry(0.07, 6, 4), mat(c), 1.5 + i * 0.28 + (rnd() - 0.5) * 0.1, 0.19 + 0.55 + rnd() * 0.15, 1.1 + (rnd() - 0.5) * 0.4, false); }
    gshrub(1.9, 1.1, 0.25, 6, 1.3); gshrub(3.1, 1.2, 0.22, 5, 1.2);
    box(1.0, 0.19 + 0.55, 1.95, 0.24, 1.1, 0.24, '#8a7a68'); box(1.0, 0.19 + 1.12, 1.95, 0.32, 0.05, 0.32, '#3d4a58'); box(1.0, 0.19 + 0.8, 1.82, 0.2, 0.18, 0.04, '#8a98a0'); box(1.0, 0.19 + 1.0, 1.82, 0.14, 0.05, 0.02, '#c9402f', false);
    for (let i = 0; i < 3; i++) gshrub(3.2 + i * 0.5, 2.1, 0.2, 5, 1.1);
    for (const [x, z] of [[0.75, 0.9], [4.1, 0.8]]) { cyl(x, 0.19 + 0.22, z, 0.015, 0.44, '#59656d'); const p = mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffe2a6' }), x, 0.19 + 0.45, z, false); p.scale.setScalar(1.8); mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.2), x, 0.21, z, false).rotation.x = -PI / 2; }
  }
  group('house7FrontW');
  {
    // between the door and the carport: a pot and a shrub under the slit window (x ≤ -0.7, away from the door route)
    pot(-1.0, 0.19, 0.8, 0.15, 5, 1.5, '#7d6a5a'); pot(-1.3, 0.19, 0.45, 0.12, 4, 1.2, '#8f9aa0');
  }
  group('house7West');
  {
    // black railing on a block base along the west edge, planters and shrubs outside the carport
    box(-4.9, 0.19 + 0.2, -2.0, 0.1, 0.4, 7.2, '#a29e94');
    for (let i = 0; i < 30; i++) box(-4.9, 0.19 + 0.65, 1.5 - i * 0.24, 0.02, 0.5, 0.02, '#2a2d31', false);
    box(-4.9, 0.19 + 0.92, -2.0, 0.04, 0.04, 7.2, '#2a2d31', false);
    gshrub(-4.4, -0.2, 0.3, 6, 1.5); gshrub(-4.4, -3.2, 0.3, 6, 1.5); gshrub(-4.4, 1.2, 0.3, 6, 1.5); pot(-4.3, 0.19, -1.7, 0.14, 5, 1.4, '#7d6a5a');
    box(-4.4, 0.19 + 0.2, -4.6, 0.7, 0.4, 0.9, '#a29e94'); box(-4.4, 0.19 + 0.38, -4.6, 0.6, 0.04, 0.8, '#4a3a2e', false); gshrub(-4.4, -4.6, 0.25, 5, 1.3);
  }
  group('house7East');
  {
    // east side: two AC outdoor units and a gas water heater on the wall, three sorted bins, a hedge on the east edge
    for (const z of [-1.0, -2.2]) { box(3.62, 0.19 + 0.05, z, 0.42, 0.1, 0.9, '#7f8b93'); box(3.62, 0.19 + 0.42, z, 0.34, 0.65, 0.8, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.17, 16), mat('#3b4650'), 3.78, 0.19 + 0.42, z, false).rotation.y = PI / 2; }
    cyl(3.65, 0.19 + 0.7, -3.0, 0.2, 1.4, W('#dfe3e0', 0.28)); cyl(3.65, 0.19 + 1.42, -3.0, 0.21, 0.04, '#59656d'); rod([3.55, 0.19 + 1.3, -2.9], [3.35, 0.19 + 1.5, -2.7], 0.012, '#5f6c76');
    for (const [z, c] of [[-4.2, '#3f8a5a'], [-4.7, '#4f7290'], [-5.2, '#3a4a5a']]) { box(3.7, 0.19 + 0.3, z, 0.4, 0.6, 0.38, c); box(3.7, 0.19 + 0.62, z, 0.44, 0.04, 0.42, '#2f3944'); }
    box(3.9, 0.19 + 0.2, -5.7, 0.3, 0.4, 0.3, W('#8a8a82', 0.25));
    for (let i = 0; i < 5; i++) gshrub(4.4, 1.6 - i * 1.3, 0.35, 8, 1.8);
  }
  group('house7Rear');
  {
    // rear yard: bicycle against the rear wall, pots, step stones along the wall
    for (const dx of [-0.42, 0.42]) { const wh = mesh(new THREE.TorusGeometry(0.3, 0.02, 5, 14), mat('#2a2d31'), -0.4 + dx, 0.19 + 0.32, Z1 - 0.45, false); void wh; }
    rod([-0.4 - 0.42, 0.19 + 0.32, Z1 - 0.45], [-0.45, 0.19 + 0.38, Z1 - 0.45], 0.012, '#5f6c76'); rod([-0.45, 0.19 + 0.38, Z1 - 0.45], [-0.4 + 0.42, 0.19 + 0.32, Z1 - 0.45], 0.012, '#5f6c76'); rod([-0.45, 0.19 + 0.38, Z1 - 0.45], [-0.55, 0.19 + 0.78, Z1 - 0.45], 0.012, '#5f6c76');
    rod([-0.4 + 0.42, 0.19 + 0.32, Z1 - 0.45], [-0.4 + 0.36, 0.19 + 0.82, Z1 - 0.45], 0.012, '#5f6c76'); box(-0.4 + 0.36, 0.19 + 0.86, Z1 - 0.45, 0.04, 0.04, 0.34, '#2a2d31', false); box(-0.58, 0.19 + 0.8, Z1 - 0.45, 0.2, 0.04, 0.1, '#2a2d31', false);
    pot(1.2, 0.19, Z1 - 0.35, 0.16, 6, 1.6); pot(2.0, 0.19, Z1 - 0.7, 0.14, 5, 1.4, '#7d6a5a'); gshrub(2.9, Z1 - 0.4, 0.28, 6, 1.5); gshrub(-1.2, Z1 - 0.4, 0.28, 6, 1.5);
    for (let i = 0; i < 4; i++) box(0.9 + i * 0.4, 0.2, Z1 - 0.8 - (i % 2) * 0.08, 0.34, 0.02, 0.28, '#a8a091', false);
  }
  group('house7Ground');
  const paveMat = warm('#ffffff', 0, pavers), pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-4.9, 4.6, 0.5, 2.5); pave(X1, 4.6, -6.0, 0.5); pave(-4.9, 4.6, -7.1, -6.0); pave(-4.9, -3.9, -6.0, 0.5);
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(1.6, 1.4, DXc, 0.226, 0.9, [0, 1], spill); decal(3.0, 1.0, 1.9, 0.208, 0.9, [0, 1], additive(spillT, '#ffbf7a', 0.2)); decal(1.8, 1.6, -2.7, 0.208, 1.2, [0, 1], additive(glowT, '#cfe6ff', 0.12));

  const fx = new THREE.Group(); fx.userData.live = true; group('house7').add(fx); K.setRoot(fx);
  const upGlow = additive(glowT, '#ffd9a0', 0.1); mesh(new THREE.PlaneGeometry(3.4, 1.8), upGlow, 1.5, F2 + 1.3, 0.5, false, fx);
  const dnGlow = additive(glowT, '#ffe2b0', 0.18); mesh(new THREE.PlaneGeometry(2.8, 1.8), dnGlow, 1.9, F + 1.2, 0.5, false, fx);
  // a small tree in the front garden sways slightly
  const gardenFx = new THREE.Group(); gardenFx.userData.live = true; group('house7Garden').add(gardenFx);
  const tree = new THREE.Group(); tree.position.set(4.0, 0.19, 1.5); gardenFx.add(tree);
  cyl(0, 0.9, 0, 0.06, 1.8, '#6b4c36', tree);
  for (const [dx, dy, dz, r] of [[0, 2.1, 0, 0.55], [0.25, 1.7, 0.15, 0.4], [-0.25, 1.8, -0.1, 0.4], [0.05, 2.5, 0, 0.35]]) { const a = mesh(new THREE.SphereGeometry(1, 7, 5), mat(LEAF[(dx > 0) * 1 + (dz > 0) * 1]), dx, dy, dz, false, tree); a.scale.setScalar(r); }
  const batch = (c, o, par = fx) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; par.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6), cdrips = batch('#cee7e5', 0.6);
  for (const [w, n] of [[FW, 8], [U1, 8]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 0.8, 0.08, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 14; i++) drips.add(-1.4 + i * 0.35 + rnd() * 0.1, 2.3 + rnd() * 0.3, 0.57, 0.1, 1.95, 2.6, 2.1 + rnd() * 0.5);   // drips off the canopy edge
  for (let i = 0; i < 12; i++) drips.add(-1.6 + rnd() * 5.2, 3.0 + rnd() * 2.3, 0.36, 0.1, 2.9, 5.4, 2.1 + rnd() * 0.5);   // front eave
  for (let i = 0; i < 6; i++) cdrips.add(-3.9, 0.3 + rnd() * 1.7, 0.4 - i * 0.85, 0.1, 0.25, 2.1, 2.2 + rnd() * 0.4);
  runs.seal(); drips.seal(); cdrips.seal();
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt); cdrips.step(dt);
      tree.rotation.z = 0.03 * Math.sin(t * 0.8) * (0.7 + 0.3 * Math.sin(t * 0.31)); tree.rotation.x = 0.02 * Math.sin(t * 0.6 + 1);
      dnGlow.opacity = 0.16 + 0.04 * Math.sin(t * 0.6) * Math.sin(t * 0.27 + 1); upGlow.opacity = 0.09 + 0.03 * Math.sin(t * 0.45 + 2);
    },
  };
};
