// B02-P02 独栋住宅 2 (detached house 2): sage-green two-storey house under a single-pitch grey standing-seam metal roof (high on the left, low on the right),
// three narrow tall windows across the upper front, entrance hood, carport with a polycarbonate roof on the RIGHT, big sliding door to the rear garden,
// air conditioner / water heater / bins behind the carport, timber slat fences and a small front garden on the left.
// Task card docs/buildings/tasks/B02-P02.md, reference docs/buildings/references/B02-P02.jpg. Second house of stage 6; differs from B02-P01 in roof (mono-pitch
// instead of gable), carport side, wall colour, window rhythm, a stair that climbs towards the front, and the rear sliding door.
// Local frame (placed by layout.js `buildings`, rotY 0: front +z faces the south street, local +x = world E): origin = middle of the buildable width (world x 21)
// and the front door (frozen entrance x = 21); the front wall is at z 0.
// House body x -3.4…1.55 (4.95), z -6.0…0; roof edges to x -3.85 / 1.9 and z +0.35 / -6.35; carport x 1.6…3.85, z +0.5…-5.0.
// Groups: house (shell, floors, stair, roof, hood, carport, car) · houseGarden · houseWest · houseEast · houseRear · houseGround.
// Layers: f2 (upper storey), roof. Plan, ground: genkan right of the door, kitchen-dining at the front behind the narrow tall windows, living at the back with the sliding
// door, stair along the right wall rising towards the front, WC at the back-right. Upper: landing over the genkan, bedroom at the front, study at the back, bathroom at the back-right.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B02-P02'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(5302), PI = Math.PI;
  const F = rec.floor, F2 = F + 2.75, X0 = -3.4, X1 = 1.55, Z0 = 0, Z1 = -6.0, T = 0.15, BASE = 0.19, SLAB = 0.2;
  const CEIL1 = F2 - SLAB, CEIL2 = F2 + 2.65, ER = 5.95, EL = 7.45, SLOPE = (EL - ER) / (X1 - X0), OVL = 0.45, OVR = 0.35, OVF = 0.35;   // wall tops: EL on the left, ER on the right
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T;
  const topAt = x => EL - SLOPE * (x - X0);   // roof top line over the walls
  const DXc = 0;
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FD = [-0.45, 0.45, F, F + 2.1], FN = [[-2.55, -2.0, F + 0.5, F + 2.0], [-1.45, -0.9, F + 0.5, F + 2.0]], FR = [0.85, 1.3, F + 0.9, F + 1.7];
  const UN = [[-2.9, -2.4, F2 + 0.5, F2 + 2.1], [-1.9, -1.4, F2 + 0.5, F2 + 2.1], [-0.9, -0.4, F2 + 0.5, F2 + 2.1]], UR = [0.85, 1.3, F2 + 0.9, F2 + 1.8];
  const RS = [-3.0, -0.7, F, F + 2.2], RWC = [0.7, 1.2, F + 1.3, F + 1.9];
  const RUp = [[-2.8, -1.4, F2 + 0.7, F2 + 1.9], [-0.6, 0.0, F2 + 1.0, F2 + 1.9], [0.7, 1.2, F2 + 1.2, F2 + 1.9]];
  const LG = [[-1.4, -0.9, F + 0.7, F + 2.1], [-4.6, -4.1, F + 0.9, F + 1.8]], LU = [[-1.2, -0.7, F2 + 0.5, F2 + 2.1], [-4.4, -3.9, F2 + 0.9, F2 + 1.9]];
  const EGd = [[-3.4, -2.9, F + 0.9, F + 1.9]], EU = [[-3.4, -2.9, F2 + 0.9, F2 + 1.9], [-5.0, -4.5, F2 + 1.2, F2 + 1.9]];
  const ZB = -4.3, ZT = -1.6, SXc = 0.95;   // stair flight: x 0.55…1.35, bottom at z ZB (floor), top at z ZT (2F level), climbing towards the front

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#a9ba9c'), timber = '#5a4030', timberL = '#a97a4e', slat = '#b98a58', stoneC = '#9a958b', alu = '#5e4a38', trim = '#4f6158', green = '#2f5446';
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

  // ---- house materials: sage plaster, dark timber frames, grey standing-seam metal roof ----
  const timberFrame = '#5e4a38';
  const metalT = tex(128, 128, (q, w, h) => { q.fillStyle = '#585e66'; q.fillRect(0, 0, w, h);
    for (let c = 0; c < 4; c++) { const g = q.createLinearGradient(c * 32, 0, c * 32 + 32, 0); g.addColorStop(0, '#454b53'); g.addColorStop(0.5, '#646b74'); g.addColorStop(1, '#41474f'); q.fillStyle = g; q.fillRect(c * 32, 0, 32, h);
      q.fillStyle = 'rgba(10,14,22,.7)'; q.fillRect(c * 32, 0, 2.5, h); q.fillStyle = 'rgba(200,212,228,.25)'; q.fillRect(c * 32 + 2.5, 0, 1.2, h); }
    for (let i = 0; i < 400; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '8,12,18' : '190,205,225'},${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1, 3); } });
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: metalT });
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
  group('house2');
  const ERw = ER - 0.1, ELw = EL - 0.12;
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, F2], [FD, ...FN, FR], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, F2], [RS, RWC], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, F2], EGd, plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, F2], LG, plaster);
  const plinth = (axis, a, b, d, out) => ab(axis, (a + b) / 2, 0.255, d + out * 0.02, b - a, 0.13, 0.04, stoneC);
  plinth('x', X0, FD[0], Z0, 1); plinth('x', FD[1], X1, Z0, 1); plinth('x', X0, RS[0], Z1, -1); plinth('x', RS[1], X1, Z1, -1); plinth('z', Z1, Z0, X1, 1); plinth('z', Z1, Z0, X0, -1);
  box((X0 + X1) / 2, F2 - 0.1, 0.012, X1 - X0 + 0.06, 0.2, 0.04, '#cbd3bd'); box((X0 + X1) / 2, F2 - 0.1, Z1 - 0.012, X1 - X0 + 0.06, 0.2, 0.04, '#cbd3bd');
  for (const [x, o] of [[X0, -1], [X1, 1]]) box(x + o * 0.012, F2 - 0.1, (Z0 + Z1) / 2, 0.04, 0.2, Z0 - Z1 + 0.06, '#cbd3bd');
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.2, planks), (IX0 + IX1) / 2, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  mesh(tileUV(new THREE.BoxGeometry(IX1 + 0.5, 0.014, IZ0 + 1.55), 1, 1), warm('#ffffff', 0.1, pavers), (IX1 - 0.5) / 2, F + 0.007, (IZ0 - 1.55) / 2, false);   // genkan tile (x -0.5…1.4)
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL1], [FD, ...FN, FR], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL1], EGd, cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL1], LG, cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL1], [RS, RWC], cream);
  // ground partitions: stair-hall / WC wall at x 0.5 (doorways into the stair foot and the WC), WC front wall at z -4.3, genkan wall at x -0.5 with a doorway to the dining room
  wall('z', 0.5, 0.1, [IZ1, -1.55, F, CEIL1], [[-4.25, -3.5, F, F + 2.0], [-5.4, -4.6, F, F + 2.0]], plaster);
  wall('x', ZB, 0.1, [0.5, IX1, F, CEIL1], [], plaster);
  wall('z', -0.5, 0.1, [-1.55, IZ0, F, CEIL1], [[-1.3, -0.4, F, F + 2.0]], plaster);

  // ---- exterior: windows, door, hood, porch ----
  for (const w of FN) glaze('x', -T / 2, 1, w);
  glaze('x', -T / 2, 1, FR);
  glaze('x', Z1 + T / 2, -1, RWC, [], [], 0.1);
  glaze('z', X1 - T / 2, 1, EGd[0], [], [], 0.1);
  for (const w of LG) glaze('z', X0 + T / 2, -1, w);
  // rear sliding door to the garden: two sliding leaves with a handle each, wooden threshold
  { const [a, b, p, q] = RS, m = (a + b) / 2, z = Z1 + T / 2, fd = 0.1;
    ab('x', a + 0.03, (p + q) / 2, z, 0.06, q - p, fd, alu); ab('x', b - 0.03, (p + q) / 2, z, 0.06, q - p, fd, alu); ab('x', m, (p + q) / 2, z, 0.06, q - p, fd, alu); ab('x', m, q - 0.03, z, b - a, 0.06, fd, alu); ab('x', m, p + 0.05, z, b - a, 0.1, fd, alu);
    ab('x', (a + m) / 2, (p + q) / 2, z, m - a - 0.06, q - p - 0.08, 0.012, glass, false); ab('x', (m + b) / 2, (p + q) / 2, z, b - m - 0.06, q - p - 0.08, 0.012, glass, false);
    for (const x of [m - 0.1, m + 0.1]) ab('x', x, F + 1.0, z - 0.06, 0.02, 0.2, 0.03, '#c9c9c0'); }
  // Front door: timber leaf with a tall glass slit, handle, lamp; hood roof of grey metal on timber rafters over it.
  {
    ab('x', FD[0] + 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, timberFrame); ab('x', FD[1] - 0.04, (F + FD[3]) / 2, -T / 2, 0.08, FD[3] - F, 0.16, timberFrame); box(DXc, FD[3] - 0.04, -T / 2, 0.9, 0.08, 0.16, timberFrame);
    box(DXc, (F + FD[3] - 0.08) / 2, -0.05, 0.82, FD[3] - 0.08 - F, 0.05, '#9a6e44');
    for (let i = 0; i < 12; i++) box(DXc - 0.37 + i * 0.067, F + 0.95, -0.012, 0.012, 1.8, 0.012, '#7a5a3c', false);   // vertical boarding lines
    box(DXc - 0.2, F + 1.5, 0.0, 0.12, 0.8, 0.012, glass, false);
    box(DXc + 0.3, F + 1.05, 0.0, 0.03, 0.2, 0.05, '#c9c9c0'); box(DXc + 0.58, F + 1.5, 0.0, 0.1, 0.06, 0.03, '#8a98a0');
    box(-0.85, 2.3, 0.07, 0.14, 0.16, 0.1, '#3d4a58'); box(-0.85, 2.29, 0.07, 0.1, 0.12, 0.105, bulb, false);
    mesh(new THREE.PlaneGeometry(1.0, 1.0), additive(glowT, '#ffc27e', 0.22), -0.85, 2.28, 0.04, false);
    const hd = box(DXc, 2.5, 0.22, 1.5, 0.05, 0.62, '#4d535b'); hd.rotation.x = 0.1; box(DXc, 2.43, 0.22, 1.5, 0.03, 0.62, '#2f3338', false);
    for (const x of [DXc - 0.65, DXc, DXc + 0.65]) box(x, 2.4, 0.26, 0.05, 0.08, 0.56, '#8a6a48'); for (const x of [DXc - 0.72, DXc + 0.72]) rod([x, 2.3, 0.03], [x, 2.45, 0.5], 0.015, '#3d4a58');
    box(DXc, 0.255, 0.25, 1.4, 0.1, 0.5, '#a8a091'); box(DXc, 0.215, 0.1, 1.5, 0.03, 0.2, '#8e8a80', false);   // porch slab (the lower steps are in houseGarden)
  }

  // ================= upper storey, slab, stair =================
  const stairMat = W('#b9946a', 0.26), rise = (F2 - F) / 14, run = (ZT - ZB) / 14;
  const upperLayer = new THREE.Group(); upperLayer.userData.layer = 'f2'; group('house2').add(upperLayer); K.setRoot(upperLayer);
  wall('x', Z0 - T / 2, T, [X0, X1, F2, ERw], [...UN, UR], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, F2, ERw], RUp, plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, F2, ERw], EU, plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, F2, ELw], LU, plaster);
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F2, CEIL2], [...UN, UR], cream); panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F2, CEIL2], RUp, cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F2, CEIL2], EU, cream); panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F2, CEIL2], LU, cream);
  // partitions: landing / rooms at x 0.5 (doors to the bedroom at the front and the bathroom at the back), wall between bedroom and study at z -3.0
  wall('z', 0.5, 0.1, [IZ1, IZ0, F2, CEIL2 + 0.01], [[-1.3, -0.4, F2, F2 + 2.0], [-5.4, -4.6, F2, F2 + 2.0]], plaster);
  wall('x', -3.0, 0.1, [IX0, 0.5, F2, CEIL2 + 0.01], [[-1.0, -0.1, F2, F2 + 2.0]], plaster);
  for (const [a, b, c, d] of [[IX0, 0.5, IZ1, IZ0], [0.5, IX1, IZ1, ZB], [0.5, IX1, ZT, IZ0]]) box((a + b) / 2, F2 - SLAB / 2, (c + d) / 2, b - a, SLAB, d - c, '#c9c1b0', true, upperLayer);   // slab with the stair opening x 0.5…1.4, z -4.3…-1.6
  mesh(tileUV(new THREE.BoxGeometry(0.5 - IX0, 0.012, IZ0 - IZ1), 2, 2), warm('#ffffff', 0.22, planks), (IX0 + 0.5) / 2, F2 + 0.006, (IZ0 + IZ1) / 2, false, upperLayer);
  mesh(tileUV(new THREE.BoxGeometry(IX1 - 0.5, 0.012, IZ0 - ZT), 1, 1), warm('#ffffff', 0.22, planks), (0.5 + IX1) / 2, F2 + 0.006, (ZT + IZ0) / 2, false, upperLayer);   // front landing
  mesh(tileUV(new THREE.BoxGeometry(IX1 - 0.5, 0.014, ZB - IZ1), 1, 1), warm('#ffffff', 0.12, pavers), (0.5 + IX1) / 2, F2 + 0.007, (IZ1 + ZB) / 2, false, upperLayer);   // bathroom tile
  box((IX0 + IX1) / 2, CEIL1 - 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false, upperLayer);    // ground ceiling
  for (const w of UN) glaze('x', -T / 2, 1, w); glaze('x', -T / 2, 1, UR, [], [], 0.1);
  for (const r of RUp) glaze('x', Z1 + T / 2, -1, r, r === RUp[0] ? [-2.1] : []);
  for (const e of EU) glaze('z', X1 - T / 2, 1, e, [], [], 0.1); for (const w of LU) glaze('z', X0 + T / 2, -1, w);
  // triangle of front/rear wall above the lower wall top, following the roof line (sunk below the roof surface)
  for (const z of [Z0 - T, Z1]) shapeMesh([[X0, ERw - 0.02], [X1, ERw - 0.02], [X1, ER - 0.07], [X0, EL - 0.07]], T, plaster, 0, 0, z, 0);
  // stair: straight flight along the right wall rising towards the front; handrail on the wall side, guard rail at the opening's back edge
  K.setRoot(group('house2'));
  for (let i = 0; i < 14; i++) { const top = F + (i + 1) * rise, z = ZB + i * run + run / 2; box(SXc, top - 0.02, z, 0.8, 0.04, run + 0.02, stairMat); box(SXc, top - rise / 2, z - run / 2, 0.8, rise, 0.02, woodD, false); }
  { const a = Math.atan2(rise, run), l = Math.hypot(14 * run, 14 * rise); for (const dx of [-0.38, 0.38]) { const s = box(SXc + dx, F + 14 * rise / 2 - 0.02, (ZB + ZT) / 2, 0.04, 0.16, l, woodD); s.rotation.x = -a; } }
  rod([0.58, F + 0.9, ZB], [0.58, F2 + 0.9, ZT], 0.02, '#3d4a58');
  K.setRoot(upperLayer);
  for (const x of [0.6, 1.0, 1.35]) box(x, F2 + 0.5, ZB - 0.05, 0.03, 1.0, 0.03, '#3d4a58'); box(0.98, F2 + 1.0, ZB - 0.05, 0.9, 0.04, 0.04, '#3d4a58');

  // ================= interior: ground floor =================
  K.setRoot(group('house2'));
  const table = (x, z, w, d, hgt, layer, base = F, top = wood) => { box(x, base + hgt - 0.02, z, w, 0.04, d, top, true, layer);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(x + dx * (w / 2 - 0.05), base + hgt / 2, z + dz * (d / 2 - 0.05), 0.05, hgt - 0.04, 0.05, woodD, false, layer); };
  const chair = (x, z, face, base = F, c = '#6b8a9a', layer) => { for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + dx * 0.17, base + 0.22, z + dz * 0.17, 0.035, 0.44, 0.035, woodD, false, layer);
    box(x, base + 0.45, z, 0.4, 0.04, 0.4, W(c, 0.3), true, layer); const bx = x - face[0] * 0.19, bz = z - face[1] * 0.19; box(bx, base + 0.68, bz, face[0] ? 0.03 : 0.38, 0.4, face[0] ? 0.38 : 0.03, woodD, true, layer); };
  const pendant = (x, z, y, top, c = '#e0cfa8', layer) => { rod([x, top, z], [x, y + 0.08, z], 0.006, '#3a3330', layer); mesh(new THREE.ConeGeometry(0.13, 0.15, 14, 1, true), W(c, 0.3), x, y + 0.07, z, true, layer); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false, layer); };
  const chrome = W('#cfd6d8', 0.3);
  wall('x', -1.55, 0.1, [0.5, IX1, F, CEIL1], [], plaster);   // closes the under-stair storage towards the genkan
  {
    // genkan: shoe cabinet along the right wall, shoes on the tile, umbrella stand, hooks on the genkan wall, step beam
    box(1.2, F + 0.55, -0.85, 0.3, 1.1, 0.9, woodD); box(1.2, F + 1.12, -0.85, 0.34, 0.04, 0.96, wood);
    for (let i = 0; i < 3; i++) box(1.04, F + 0.25 + i * 0.3, -0.85, 0.02, 0.22, 0.8, W('#8a6a48', 0.3), false);
    for (let i = 0; i < 3; i++) box(0.5, F + 0.02, -0.4 - i * 0.2, 0.26, 0.04, 0.1, W(['#2f3944', '#c9402f', '#e8e4d6'][i], 0.4), false);
    cyl(0.85, F + 0.28, -1.35, 0.1, 0.56, W('#4f7290', 0.3)); for (const x of [0.81, 0.89]) rod([x, F + 0.5, -1.35], [x + 0.02, F + 0.95, -1.33], 0.012, '#2f3944');
    box(-0.45, F + 1.7, -0.9, 0.05, 0.03, 0.6, wood, false); for (let i = 0; i < 3; i++) cyl(-0.43, F + 1.62, -0.7 - i * 0.2, 0.015, 0.06, '#59656d');
    box(-0.43, F + 1.35, -0.8, 0.06, 0.6, 0.28, W('#6a7a5a', 0.3), true);   // a coat on the hooks
    box(-0.05, F + 0.04, -1.56, 0.1, 0.08, 1.1, woodD, false);
    pendant(0.5, -0.8, F + 2.0, CEIL1, '#e0cfa8');
    // kitchen-dining behind the narrow tall front windows: counter with sink and hob along the left wall, fridge, table for three
    box(-2.95, F + 0.45, -2.0, 0.6, 0.9, 1.9, W('#d6cfba', 0.3)); box(-2.95, F + 0.92, -2.0, 0.64, 0.04, 1.94, steel); box(-2.95, F + 0.94, -1.3, 0.4, 0.02, 0.5, '#59656d', false);
    for (const dz of [0.0, 0.35]) box(-2.95, F + 0.945, -2.15 - dz, 0.22, 0.012, 0.22, '#2a2d31', false); box(-3.05, F + 1.75, -2.2, 0.4, 0.12, 0.7, '#8a9096'); box(-3.1, F + 1.95, -1.2, 0.3, 0.5, 0.9, wood);
    box(-2.9, F + 0.9, -0.5, 0.62, 1.8, 0.62, W('#dfe3e0', 0.28));
    table(-1.5, -1.8, 0.9, 0.8, 0.74, undefined, F, wood); chair(-1.5, -1.2, [0, -1], F, '#c9a86a'); chair(-1.5, -2.4, [0, 1], F, '#c9a86a'); chair(-2.1, -1.8, [1, 0], F, '#c9a86a');
    for (const dx of [-0.2, 0.15]) cyl(-1.5 + dx, F + 0.78, -1.8, 0.07, 0.1, W(dx < 0 ? '#f0e8d4' : '#c9402f', 0.34));
    pendant(-1.5, -1.8, F + 1.95, CEIL1, '#e8c9a0');
    for (const x of [-2.55, -0.9]) box(x, F + 1.2, IZ0 - 0.04, 0.22, 1.9, 0.05, W('#e3dcc4', 0.4), true);
    // living at the back: sofa on the left wall facing a TV unit on the stair-hall wall, rug and low table, floor lamp; curtains at the sliding door
    box(-1.7, F + 0.012, -4.4, 2.2, 0.024, 1.9, W('#8a6f6a', 0.28), false);
    box(-2.8, F + 0.28, -4.4, 0.7, 0.5, 1.7, W('#c9a86a', 0.3)); box(-3.15, F + 0.6, -4.4, 0.14, 0.55, 1.7, W('#c9a86a', 0.3));
    for (const dz of [-0.8, 0.8]) box(-2.8, F + 0.4, -4.4 + dz, 0.7, 0.45, 0.12, W('#b8955a', 0.3));
    table(-1.8, -4.4, 0.5, 0.9, 0.38, undefined, F, wood);
    box(0.2, F + 0.3, -4.4, 0.4, 0.6, 1.3, woodD); box(0.28, F + 0.88, -4.4, 0.06, 0.5, 0.9, W('#2f2a26', 0.08));
    cyl(-2.9, F + 0.7, -5.5, 0.02, 1.4, '#3d4a58'); mesh(new THREE.ConeGeometry(0.17, 0.2, 12, 1, true), W('#efe0c0', 0.8), -2.9, F + 1.45, -5.5, true);
    for (const x of [RS[0] + 0.12, RS[1] - 0.12]) box(x, F + 1.2, IZ1 + 0.04, 0.26, 2.0, 0.05, W('#ebe0c6', 0.4), true);
    pot(-0.5, F, -5.55, 0.15, 6, 2, '#8f9aa0');
    pendant(-1.8, -4.4, F + 1.9, CEIL1, '#d9c7a0');
    // WC at the back-right
    cyl(1.0, F + 0.2, -5.5, 0.17, 0.4, W('#e8eef0', 0.3)); box(1.0, F + 0.5, -5.76, 0.36, 0.4, 0.14, W('#e8eef0', 0.3)); box(1.2, F + 0.85, -5.0, 0.2, 0.08, 0.3, W('#e8eef0', 0.3));
    box(0.95, F + 1.95, -5.0, 0.3, 0.04, 0.3, W('#fff4d0', 0.95), false);
    for (const [x, z, r2] of [[0.6, -0.8, 1.4], [-1.5, -1.8, 2.4], [-1.7, -4.4, 2.6], [1.0, -5.0, 1.0], [-2.9, -1.4, 1.2]]) decal(r2, r2, x, F + 0.003, z, [0, -1], pool);
  }
  // ================= interior: upper floor =================
  K.setRoot(upperLayer);
  {
    // landing over the genkan with a plant and a small console
    pot(1.15, F2, -0.4, 0.14, 6, 1.8, '#8f9aa0'); box(0.9, F2 + 0.4, -1.1, 0.3, 0.8, 0.8, woodD);
    // bedroom at the front behind the three narrow windows: bed with its head on the left wall, wardrobe on the dividing wall, bedside table
    box(-1.6, F2 + 0.012, -1.7, 2.2, 0.024, 1.8, W('#8a8f6a', 0.26), false);
    box(-2.2, F2 + 0.22, -1.7, 2.0, 0.3, 1.5, woodD); box(-2.2, F2 + 0.45, -1.7, 1.92, 0.16, 1.42, W('#d9d2e6', 0.3)); box(-3.0, F2 + 0.56, -1.7, 0.3, 0.12, 1.1, W('#f0e8d4', 0.34));
    box(-1.7, F2 + 0.58, -1.7, 1.0, 0.06, 1.42, W('#9fb88a', 0.3)); box(-3.2, F2 + 0.9, -1.7, 0.08, 0.9, 1.7, woodD);
    for (const dz of [-0.85, 0.85]) box(-3.0, F2 + 0.28, -1.7 + dz, 0.35, 0.4, 0.35, woodD);
    box(-1.5, F2 + 1.0, -2.78, 1.4, 2.0, 0.4, woodD); box(-1.5, F2 + 1.0, -2.57, 0.02, 1.9, 0.02, wood, false);
    pendant(-1.6, -1.7, F2 + 1.95, CEIL2, '#e8c9a0');
    for (const x of [-2.95, -0.35]) box(x, F2 + 1.2, IZ0 - 0.04, 0.22, 1.9, 0.05, W('#e6d6c0', 0.4), true);
    // study at the back: desk under the window, chair, bookcase on the dividing wall, floor cushion
    table(-2.1, -5.55, 1.4, 0.6, 0.74, upperLayer, F2, wood); chair(-2.1, -5.0, [0, 1], F2, '#c9a86a', upperLayer);
    cyl(-1.5, F2 + 0.95, -5.55, 0.05, 0.4, '#3d4a58', upperLayer); mesh(new THREE.ConeGeometry(0.1, 0.14, 10, 1, true), W('#efe0c0', 0.8), -1.5, F2 + 1.2, -5.55, true, upperLayer);
    for (let i = 0; i < 3; i++) box(-2.5 + i * 0.15, F2 + 0.78, -5.55, 0.12, 0.03, 0.2, W(['#e8e4d6', '#2a8a68', '#9ad0c8', '#e08a48', '#f0d36a', '#c9402f', '#cfd8e6', '#d9a7b8'][(i * 3) % 8], 0.4), false);
    box(0.28, F2 + 0.9, -3.8, 0.3, 1.8, 1.1, woodD); for (let k = 0; k < 4; k++) { box(0.42, F2 + 0.2 + k * 0.4, -3.8, 0.02, 0.3, 1.0, W('#e8e4d6', 0.3), false); for (let i = 0; i < 6; i++) box(0.44, F2 + 0.33 + k * 0.4, -3.4 - i * 0.15, 0.05, 0.22, 0.11, W(['#2a8a68', '#c9402f', '#e0b040', '#4f7290', '#e8e4d6'][(i + k) % 5], 0.36), false); }
    box(-1.2, F2 + 0.05, -4.4, 0.5, 0.1, 0.5, W('#c9a03a', 0.3));
    pendant(-1.8, -4.4, F2 + 1.95, CEIL2, '#e0cfa8', upperLayer);
    // bathroom at the back-right: tub under the window
    box(1.0, F2 + 0.28, -5.15, 0.7, 0.56, 1.3, W('#e8eef0', 0.3)); box(1.0, F2 + 0.52, -5.15, 0.58, 0.02, 1.18, '#9fc4d0', false); box(1.15, F2 + 2.0, -5.0, 0.3, 0.04, 0.3, W('#fff4d0', 0.95), false);
    for (const [x, z, r2] of [[-1.6, -1.7, 2.6], [-2.0, -4.6, 2.4], [1.0, -0.8, 1.0]]) decal(r2, r2, x, F2 + 0.004, z, [0, -1], pool);
  }

  // ================= single-pitch roof (roof layer): one standing-seam metal plane high on the left, fascia, gutters, vent stacks =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('house2').add(roofLayer); K.setRoot(roofLayer);
  box((IX0 + IX1) / 2, CEIL2 + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#efe4cc', 0.32), false);   // upper ceiling (belongs to the roof layer)
  const xa = X0 - OVL, xb = X1 + OVR, za = Z1 - OVF, zb = Z0 + OVF, ya = topAt(xa), yb = topAt(xb);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const face = pts => {
    const p0 = pts[0], u = pts[1].clone().sub(p0).normalize(), c = pts[2].clone().sub(p0);
    let n = u.clone().cross(c).normalize(); if (n.y < 0) n.negate();
    const v = n.clone().cross(u), sh = new THREE.Shape(pts.map(P => { const d = P.clone().sub(p0); return new THREE.Vector2(d.dot(u), d.dot(v)); }));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 1 }), o = p0.clone().addScaledVector(n, -0.1);
    const m = mesh(g, roofM, o.x, o.y, o.z); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n)); return m;
  };
  face([V(xa, ya, zb), V(xa, ya, za), V(xb, yb, za), V(xb, yb, zb)]);
  rod([xa, ya - 0.05, zb], [xb, yb - 0.05, zb], 0.045, '#2f3338'); rod([xa, ya - 0.05, za], [xb, yb - 0.05, za], 0.045, '#2f3338');   // front and rear fascia
  box(xa, ya - 0.06, (za + zb) / 2, 0.06, 0.14, zb - za, '#2f3338'); box(xb, yb - 0.06, (za + zb) / 2, 0.06, 0.14, zb - za, '#2f3338');
  for (let i = 0; i < 6; i++) box(xa + 0.2 + i * (xb - xa - 0.4) / 5, topAt(xa + 0.2 + i * (xb - xa - 0.4) / 5) - 0.2, zb - 0.05, 0.06, 0.08, 0.1, '#8a6a48', false);   // timber soffit brackets at the front verge
  for (const [x, o] of [[xb, 1], [xa, -1]]) { const gg = new THREE.CylinderGeometry(0.06, 0.06, zb - za, 8, 1, true, 0, PI); gg.rotateX(PI / 2); gg.rotateZ(-PI / 2); mesh(gg, mat('#8796a0'), x + o * 0.04, topAt(x) - 0.12, (za + zb) / 2); }
  { const roofY = x => topAt(x) - 0.02, sm = mat('#8796a0');
    for (const [x, z] of [[-2.4, -3.8], [-1.6, -4.6]]) { cyl(x, roofY(x) + 0.28, z, 0.045, 0.56, '#8796a0'); mesh(new THREE.ConeGeometry(0.08, 0.07, 8), sm, x, roofY(x) + 0.6, z, false); }
    const mx = -0.6, mz = -2.0, my = roofY(mx); rod([mx, my, mz], [mx, my + 1.3, mz], 0.018, sm); for (let i = 0; i < 4; i++) rod([mx, my + 0.6 + i * 0.2, mz - 0.3 + 0.07 * i], [mx, my + 0.6 + i * 0.2, mz + 0.3 - 0.07 * i], 0.009, sm); }
  group('house2');
  for (const [x, z] of [[xb + 0.02, zb - 0.1], [xa - 0.02, za + 0.1]]) { cyl(x, (topAt(x) - 0.2 + 0.3) / 2, z, 0.04, topAt(x) - 0.5, '#8796a0'); box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91'); for (const y of [1.0, 2.6, 4.2]) box(x - Math.sign(x) * 0.02, y, z, 0.1, 0.04, 0.1, '#5f6c76', false); }

  // ================= carport on the RIGHT: lean-to polycarbonate roof, timber posts, slat fence on the outer side and back, compact car =================
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
    const cxx = 2.75, czz = -1.35, cb = '#cfd2d2';
    box(cxx, G + 0.55, czz, 1.5, 0.5, 3.4, cb); box(cxx, G + 0.9, czz - 0.25, 1.38, 0.5, 1.9, cb);
    box(cxx, G + 0.92, czz - 0.25, 1.4, 0.38, 1.8, glass, false); box(cxx, G + 0.84, czz + 0.7, 1.4, 0.04, 0.06, '#59656d', false);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) { const w = cyl(cxx + dx * 0.72, G + 0.27, czz + dz * 1.05, 0.27, 0.2, '#2a2d31'); w.rotation.z = PI / 2; }
    for (const dx of [-0.5, 0.5]) { box(cxx + dx, G + 0.58, czz + 1.72, 0.28, 0.12, 0.04, '#ffe2a6', false); box(cxx + dx, G + 0.6, czz - 1.72, 0.26, 0.1, 0.04, '#c9402f', false); }
    box(cxx, G + 0.32, czz + 1.72, 1.2, 0.2, 0.04, '#59656d', false);
    mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.012, z1 - z0), 1, 2), warm('#ffffff', 0.04, pavers), cx, 0.2, cz, false);
  }

  // ================= front garden (left), west fence strip, rear garden, rear utilities behind the carport, ground, local animation =================
  const gshrub = (x, z, r, n, h) => shrub(x, 0.19 + 0.36 * r, z, r, n, h);   // keep the foliage above the plot surface
  group('house2Garden');
  {
    // lower steps with a side rail, path stones to the street, low block wall along the front edge of the garden, mailbox post, planters, two trees, garden lights
    box(DXc, 0.225, 0.68, 1.3, 0.06, 0.34, '#8e8a80'); box(DXc, 0.2, 0.95, 1.2, 0.04, 0.2, '#8e8a80', false);
    for (let i = 0; i < 3; i++) box(DXc + (i % 2 ? 0.1 : -0.1), 0.205, 1.4 + i * 0.35, 0.7, 0.03, 0.3, '#a8a091', false);
    rod([-0.72, 0.6, 0.2], [-0.72, 0.4, 0.95], 0.015, '#3d4a58'); rod([-0.72, 0.19, 0.95], [-0.72, 0.5, 0.95], 0.015, '#3d4a58');
    box(-2.85, 0.19 + 0.2, 2.45, 4.1, 0.4, 0.14, '#a29e94'); box(-2.85, 0.19 + 0.42, 2.45, 4.16, 0.05, 0.2, '#bdb8ac');
    box(-1.0, 0.19 + 0.55, 1.9, 0.22, 1.1, 0.22, '#7e8a78'); box(-1.0, 0.19 + 1.12, 1.9, 0.3, 0.05, 0.3, '#59656d'); box(-1.0, 0.19 + 0.8, 2.02, 0.2, 0.18, 0.04, '#8a98a0'); box(-1.0, 0.19 + 1.0, 2.02, 0.14, 0.05, 0.02, '#c9402f', false);
    for (let i = 0; i < 5; i++) shrub(-4.2 + i * 0.5, 0.19 + 0.1, 2.15, 0.2, 5, 1.1);
    for (const [x, z] of [[-1.7, 1.2], [-3.5, 1.0]]) { cyl(x, 0.19 + 0.22, z, 0.015, 0.44, '#59656d'); const p = mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffe2a6' }), x, 0.19 + 0.45, z, false); p.scale.setScalar(1.8); mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.2), x, 0.21, z, false).rotation.x = -PI / 2; }
    pot(-1.05, 0.19, 0.7, 0.15, 5, 1.5, '#9b7d68'); gshrub(-2.5, 0.9, 0.3, 7, 1.6);
  }
  group('house2West');
  {
    // timber slat fence on the west plot edge, AC outdoor unit and a gas water heater on the west wall, planters
    for (let i = 0; i < 24; i++) box(-4.85, 0.19 + 0.55, 0.3 - i * 0.26, 0.04, 1.1, 0.16, i % 2 ? '#9a6e44' : '#b08552');
    box(-4.85, 0.19 + 1.12, -2.9, 0.06, 0.05, 6.5, '#6a5038', false);
    box(-3.75, 0.19 + 0.05, -1.4, 0.4, 0.1, 0.9, '#7f8b93'); box(-3.75, 0.19 + 0.4, -1.4, 0.3, 0.6, 0.8, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.17, 16), mat('#3b4650'), -3.9, 0.19 + 0.4, -1.4, false).rotation.y = -PI / 2;
    box(-3.65, 0.19 + 0.55, -3.3, 0.3, 1.1, 0.5, '#d6d8d2'); box(-3.79, 0.19 + 0.65, -3.3, 0.01, 0.2, 0.3, '#7b8a92', false); box(-3.79, 0.19 + 0.3, -3.3, 0.01, 0.12, 0.2, '#c9402f', false);
    for (const z of [-3.2, -3.4]) rod([-3.55, 0.19 + 1.1, z], [-3.4, 0.19 + 1.5, z], 0.012, '#5f6c76');
    gshrub(-4.3, -4.5, 0.4, 8, 1.8); gshrub(-4.3, -0.2, 0.3, 6, 1.5); pot(-4.1, 0.19, -2.5, 0.15, 5, 1.4, '#7d6a5a');
  }
  group('house2East');
  {
    // behind the carport: bins in three colours, rain barrel, small water heater, a hedge on the east edge
    for (const [x, c] of [[2.2, '#3f6c4f'], [2.7, '#4f7290'], [3.2, '#c9a03a']]) { box(x, 0.19 + 0.3, -5.45, 0.4, 0.6, 0.38, c); box(x, 0.19 + 0.62, -5.45, 0.44, 0.04, 0.42, '#2f3944'); }
    cyl(3.85, 0.19 + 0.35, -5.5, 0.22, 0.7, W('#6d7d84', 0.3)); cyl(3.85, 0.19 + 0.72, -5.5, 0.23, 0.03, '#59656d');
    gshrub(4.45, -2.0, 0.4, 8, 1.8); gshrub(4.45, -4.2, 0.4, 8, 1.8); pot(4.3, 0.19, 0.2, 0.15, 5, 1.4, '#8f9aa0');
  }
  group('house2Rear');
  {
    // rear garden: timber deck step at the sliding door, AC unit on a stand, pots, block wall corner
    box(-1.85, 0.19 + 0.06, Z1 - 0.35, 2.4, 0.12, 0.7, '#a5764a'); for (let i = 0; i < 6; i++) box(-1.85, 0.19 + 0.125, Z1 - 0.35, 2.4, 0.01, 0.01, '#6a5038', false), box(-3.0 + i * 0.45, 0.19 + 0.122, Z1 - 0.35, 0.02, 0.01, 0.68, '#6a5038', false);
    box(0.5, 0.19 + 0.05, Z1 - 0.3, 0.9, 0.1, 0.42, '#7f8b93'); box(0.5, 0.19 + 0.4, Z1 - 0.3, 0.7, 0.6, 0.34, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.2, 16), mat('#3b4650'), 0.45, 0.19 + 0.4, Z1 - 0.472, false).rotation.y = PI;
    pot(-3.2, 0.19, Z1 - 0.3, 0.16, 6, 1.6); pot(-0.5, 0.19, Z1 - 0.9, 0.14, 5, 1.4, '#7d6a5a'); gshrub(1.5, Z1 - 0.5, 0.3, 6, 1.5);
  }
  group('house2Ground');
  const paveMat = warm('#ffffff', 0, pavers), pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-4.7, 1.55, 0.5, 2.5); pave(1.6, 4.0, 0.5, 2.5); pave(1.6, 4.6, -6.0, 0.5); pave(-4.7, 4.6, -7.1, -6.0); pave(-4.7, -3.4, -6.0, 0.5);
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(1.6, 1.4, DXc, 0.226, 0.9, [0, 1], spill); decal(3.0, 1.0, -1.6, 0.208, 0.9, [0, 1], additive(spillT, '#ffbf7a', 0.18)); decal(1.8, 1.6, 2.75, 0.208, 1.2, [0, 1], additive(glowT, '#cfe6ff', 0.12));

  const fx = new THREE.Group(); fx.userData.live = true; group('house2').add(fx); K.setRoot(fx);
  const upGlow = additive(glowT, '#ffd9a0', 0.1); mesh(new THREE.PlaneGeometry(3.4, 1.8), upGlow, -1.6, F2 + 1.3, 0.5, false, fx);
  const dnGlow = additive(glowT, '#ffe2b0', 0.16); mesh(new THREE.PlaneGeometry(3.0, 1.8), dnGlow, -1.7, F + 1.3, 0.5, false, fx);
  // a small tree in the front garden sways slightly
  const gardenFx = new THREE.Group(); gardenFx.userData.live = true; group('house2Garden').add(gardenFx);
  const tree = new THREE.Group(); tree.position.set(-3.5, 0.19, 1.7); gardenFx.add(tree);
  cyl(0, 0.9, 0, 0.06, 1.8, '#6b4c36', tree);
  for (const [dx, dy, dz, r] of [[0, 2.1, 0, 0.55], [0.25, 1.7, 0.15, 0.4], [-0.25, 1.8, -0.1, 0.4], [0.05, 2.5, 0, 0.35]]) { const a = mesh(new THREE.SphereGeometry(1, 7, 5), mat(LEAF[(dx > 0) * 1 + (dz > 0) * 1]), dx, dy, dz, false, tree); a.scale.setScalar(r); }
  const batch = (c, o, par = fx) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; par.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6), cdrips = batch('#cee7e5', 0.6);
  for (const w of [...FN, ...UN]) for (let i = 0; i < 4; i++) runs.add(w[0] + 0.08 + rnd() * (w[1] - w[0] - 0.16), w[2] + 0.1 + rnd() * 0.8, 0.07, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 14; i++) drips.add(1.97, 3.0 + rnd() * 2.8, 0.2 - i * 0.46 + (rnd() - 0.5) * 0.1, 0.1, 2.9, 5.6, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 6; i++) cdrips.add(3.85, 0.3 + rnd() * 1.7, 0.4 - i * 0.85, 0.1, 0.25, 2.1, 2.2 + rnd() * 0.4);
  runs.seal(); drips.seal(); cdrips.seal();
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt); cdrips.step(dt);
      tree.rotation.z = 0.03 * Math.sin(t * 0.8) * (0.7 + 0.3 * Math.sin(t * 0.31)); tree.rotation.x = 0.02 * Math.sin(t * 0.6 + 1);
      dnGlow.opacity = 0.14 + 0.04 * Math.sin(t * 0.6) * Math.sin(t * 0.27 + 1); upGlow.opacity = 0.09 + 0.02 * Math.sin(t * 0.45 + 2);
    },
  };
};
