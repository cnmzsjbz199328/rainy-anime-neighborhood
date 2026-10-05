// B01-P01 あめまち小学校 (courtyard primary school): a three-storey cream-plaster teaching wing with sage-green window frames under a brick-red standing-seam side-gable roof (classrooms along the
// south, an inner corridor along the north, a stair room with two side-by-side flights at the east end), a one-storey low wing on the west side (community activity room) with its own gable roof, and
// a courtyard between them with a dirt playground, a bicycle shed, a flag pole, benches and trees, closed to the street by a block wall with a green railing, a pedestrian gate (open) opposite the
// main entrance and a vehicle gate on the east side; a rear service strip with an equipment shed, outdoor AC units and a water tank, and an east service yard with the refuse store.
// Task card docs/buildings/tasks/B01-P01.md, reference docs/buildings/references/B01-P01.jpg. The only stage-7 plot; a block-scale plot (40 x 25), S and E frontages, not enlarged.
// Local frame (placed by layout.js `buildings`, rotY 0: front +z faces the south street, local +x = world E): origin = the main entrance door (world x -26 = the frozen pedestrian entrance,
// z -35); the teaching wing's front wall is at local z 0, its rear wall at z -7.2; the street edge of the plot is at local z +14, the gate at local x 0.
// Teaching wing x -13…15 (28), z -7.2…0, floors F 0.3 / 3.6 / 6.9, wall top 10.0, ridge 11.4; low wing x -16.2…-9.8, z 0…9.2 (roof in the main group); courtyard/playground x -9…13.5, z 2.4…10.2.
// Groups: school (wing shell, floors, stairs, roofs, canopy) · schoolLow (low wing walls and interior) · schoolWallS1/S2/N/W/E1/E2 (boundary walls split at the gates) · schoolBikes · schoolPlay (playground
// and paving) · schoolGear (goal, flag pole, benches, planters) · schoolTrees · schoolRear (equipment shed, AC units, tank) · schoolEast (refuse store, bins).
// Layers: f2 and f3 (upper storeys, lifted by the interior cutaways), roof (roofs and ceiling). Plan: ground floor office, library corner, entrance hall, classroom, toilets, stair; storeys 2 and 3: four classrooms
// each, corridor on the north, stair opening at the east end (flight 1 in the ground floor, flight 2 in storey 2).
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B01-P01'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(5801), PI = Math.PI;
  const F = rec.floor, SH = 3.3, T = 0.3, BASE = 0.19, SLAB = 0.25;
  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#ebe3d0'), timber = '#5a4030', slat = '#a97a4e', stoneC = '#9a958b', alu = '#7d9b86', trim = '#4f5559';
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

  // ---- school materials: cream plaster, sage-green frames, brick-red standing-seam metal roof ----
  const redT = tex(128, 128, (q, w, h) => { q.fillStyle = '#9b4b42'; q.fillRect(0, 0, w, h);
    for (let sd = 0; sd < 2; sd++) { const x = sd * 64; const g = q.createLinearGradient(x, 0, x + 64, 0); g.addColorStop(0, '#8a3f38'); g.addColorStop(0.5, '#a65a50'); g.addColorStop(1, '#88403a'); q.fillStyle = g; q.fillRect(x, 0, 64, h);
      q.fillStyle = 'rgba(40,12,10,.7)'; q.fillRect(x, 0, 3, h); q.fillStyle = 'rgba(255,225,215,.22)'; q.fillRect(x + 3, 0, 1.5, h); }
    for (let i = 0; i < 400; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '30,10,8' : '240,200,190'},${0.03 + rnd() * 0.05})`; q.fillRect(rnd() * w, rnd() * h, 1, 2 + rnd() * 6); } });
  redT.repeat.set(3, 1);
  const roofM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: redT }), roofDk = '#5e2a26';
  const sage = '#7d9b86', belt = '#cfc7b3', steelC = '#59656d', boardC = '#2f5a46';
  const dirtT = tex(128, 128, (q, w, h) => { q.fillStyle = '#b89a74'; q.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '90,66,44' : '236,214,180'},${0.05 + rnd() * 0.08})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); } });
  const slotsT = tex(64, 64, (q, w, h) => { q.fillStyle = '#d8d1bd'; q.fillRect(0, 0, w, h); q.fillStyle = 'rgba(60,50,40,.55)'; for (let i = 0; i < 4; i++) q.fillRect(2, 4 + i * 15, w - 4, 2); });
  // ---- shared helpers ----
  const mulls = (a, b) => { const n = Math.max(0, Math.round((b - a) / 1.3) - 1), r = []; for (let i = 1; i <= n; i++) r.push(a + (b - a) * i / (n + 1)); return r; };
  const glazeW = (axis, at, out, w) => glaze(axis, at, out, w, mulls(w[0], w[1]), w[3] - w[2] > 1.2 ? [w[3] - 0.4] : []);
  const table = (x, z, w, d, hgt, base, top = wood, layer) => { box(x, base + hgt - 0.02, z, w, 0.04, d, top, true, layer);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(x + dx * (w / 2 - 0.05), base + hgt / 2, z + dz * (d / 2 - 0.05), 0.04, hgt - 0.04, 0.04, woodD, false, layer); };
  const chairF = (x, z, face, base, c, layer) => { box(x, base + 0.44, z, 0.36, 0.04, 0.36, W(c, 0.3), true, layer); for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(x + dx * 0.15, base + 0.22, z + dz * 0.15, 0.03, 0.44, 0.03, woodD, false, layer);
    box(x - face[0] * 0.17, base + 0.66, z - face[1] * 0.17, face[0] ? 0.03 : 0.34, 0.36, face[0] ? 0.34 : 0.03, woodD, true, layer); };
  const tube = (x, z, y, len, lit, layer, axis = 'x') => box(x, y, z, axis === 'x' ? len : 0.1, 0.05, axis === 'x' ? 0.1 : len, W('#fffbe8', lit ? 0.95 : 0.2), false, layer);
  // ---- main teaching wing geometry (local frame: origin = main entrance door, +z south, +x east) ----
  const F2 = F + SH, F3 = F2 + SH, WT = F3 + 3.1, MX0 = -13, MX1 = 15, MZ1 = -7.2, CZ = -5.0;
  const IX0 = MX0 + T, IX1 = MX1 - T, IZ0 = -T, IZ1 = MZ1 + T;
  const LV = [{ b: F, y0: BASE, y1: F2 }, { b: F2, y0: F2, y1: F3 }, { b: F3, y0: F3, y1: WT }];
  const roomsUp = [[IX0, -6.5], [-6.5, 0], [0, 6.5], [6.5, 12.0]], roomsDn = [[IX0, -8.5], [-8.5, -3.5], [-3.5, 3.5], [3.5, 9.5], [9.5, 12.0]];
  const HOLES = (i, b) => ({
    front: i === 0 ? [[-1.1, 1.1, b, b + 2.4], [-12.0, -9.2, b + 0.9, b + 2.2], [-8.0, -4.0, b + 0.9, b + 2.2], [-3.3, -1.7, b + 0.7, b + 2.3], [1.7, 3.3, b + 0.7, b + 2.3], [4.3, 8.7, b + 0.9, b + 2.2], [10.2, 11.4, b + 1.6, b + 2.3]]
      : [[-12.1, -7.1, b + 0.9, b + 2.3], [-5.9, -0.6, b + 0.9, b + 2.3], [0.6, 5.9, b + 0.9, b + 2.3], [7.1, 11.4, b + 0.9, b + 2.3], [12.5, 14.2, b + 1.3, b + 2.4]],
    rear: i === 0 ? [[-11.6, -9.6, b + 1.0, b + 2.1], [-7.6, -5.2, b + 1.0, b + 2.1], [-0.55, 0.55, b, b + 2.2], [4.6, 8.4, b + 1.0, b + 2.1], [10.2, 11.4, b + 1.6, b + 2.2], [12.6, 14.0, b + 1.2, b + 2.2]]
      : [[-10.5, -8.7, b + 1.0, b + 2.2], [-4.1, -2.4, b + 1.0, b + 2.2], [2.4, 4.1, b + 1.0, b + 2.2], [8.4, 10.1, b + 1.0, b + 2.2], [12.6, 14.0, b + 1.2, b + 2.2]],
    west: [[-4.2, -2.6, b + 1.0, b + 2.2]], east: [[-3.8, -2.6, b + 1.2, b + 2.4]] });
  function shell(i) {
    const { b, y0, y1 } = LV[i], h = HOLES(i, b);
    wall('x', -T / 2, T, [MX0, MX1, y0, y1], h.front, plaster); wall('x', MZ1 + T / 2, T, [MX0, MX1, y0, y1], h.rear, plaster);
    wall('z', MX0 + T / 2, T, [MZ1, 0, y0, y1], h.west, plaster); wall('z', MX1 - T / 2, T, [MZ1, 0, y0, y1], h.east, plaster);
    panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, b, b + 3.05], h.front, cream); panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, b, b + 3.05], h.rear, cream);
    panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, b, b + 3.05], h.west, cream); panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, b, b + 3.05], h.east, cream);
    for (const w of h.front) glazeW('x', -T / 2, 1, w); for (const w of h.rear) glazeW('x', MZ1 + T / 2, -1, w);
    for (const w of h.west) glazeW('z', MX0 + T / 2, -1, w); for (const w of h.east) glazeW('z', MX1 - T / 2, 1, w);
    if (i < 2) { box((MX0 + MX1) / 2, y1 - 0.12, 0.02, MX1 - MX0 + 0.1, 0.26, 0.06, belt); box((MX0 + MX1) / 2, y1 - 0.12, MZ1 - 0.02, MX1 - MX0 + 0.1, 0.26, 0.06, belt);
      for (const [x, o] of [[MX0, -1], [MX1, 1]]) box(x + o * 0.02, y1 - 0.12, MZ1 / 2, 0.06, 0.26, -MZ1 + 0.1, belt); }
  }
  function partitions(i) {
    const { b } = LV[i], top = b + 3.05, xs = i === 0 ? [-8.5, -3.5, 3.5, 9.5, 12.0] : [-6.5, 0, 6.5, 12.0];
    const doors = i === 0 ? [[-10.3, -9.4], [-6.5, -5.6], [-3.0, 3.0], [5.6, 6.5], [10.4, 11.3], [12.3, 14.4]] : [[-10.6, -9.7], [-4.4, -3.5], [2.1, 3.0], [8.6, 9.5], [12.3, 14.4]];
    wall('x', CZ, 0.15, [IX0, IX1, b, top], doors.map(([a, c]) => [a, c, b, b + (c - a > 2 ? 2.4 : 2.1)]), plaster);
    for (const x of xs) wall('z', x, 0.15, x === 12.0 ? [IZ1, IZ0, b, top] : [CZ, IZ0, b, top], x === 12.0 ? [[-6.6, -5.2, b, b + 2.2]] : [], plaster);
  }
  function classroom(x0, x1, b, lit, layer) {
    const zc = (CZ + IZ0) / 2, cols = Math.max(3, Math.floor((x1 - x0 - 2.2) / 1.05));
    box(x0 + 0.12, b + 1.75, zc, 0.05, 1.1, 3.4, boardC, false, layer); box(x0 + 0.17, b + 1.14, zc, 0.12, 0.05, 3.4, wood, false, layer);   // blackboard and chalk tray
    table(x0 + 1.0, zc, 0.55, 1.3, 0.76, b, wood, layer); chairF(x0 + 0.55, zc, [1, 0], b, '#6b8a9a', layer);
    for (let c = 0; c < cols; c++) for (let r = 0; r < 3; r++) { const x = x0 + 2.2 + c * 1.02, z = CZ + 1.0 + r * 1.3; table(x, z, 0.5, 0.6, 0.72, b, wood, layer); chairF(x + 0.38, z, [-1, 0], b, ['#c9a86a', '#6b8a9a', '#a8c096'][(c + r) % 3], layer); }
    for (let k = 0; k < 4; k++) box(x1 - 0.3, b + 0.9, CZ + 0.5 + k * 1.0, 0.3, 1.8, 0.8, W('#b9b3a0', 0.28), true, layer);   // lockers at the back
    for (const x of [(x0 + x1) / 2 - 0.9, (x0 + x1) / 2 + 0.9]) tube(x, zc, b + 3.0, 1.6, lit, layer, 'x');
    if (lit) decal(Math.min(5.5, x1 - x0), 4.0, (x0 + x1) / 2, b + 0.004, zc, [0, -1], pool, layer);
  }
  const slab = (y, hole, layer) => { const hx0 = hole[0], hx1 = hole[1], hz0 = hole[2], hz1 = hole[3];
    for (const [a, c, d, e] of [[IX0, hx0, IZ1, IZ0], [hx1, IX1, IZ1, IZ0], [hx0, hx1, IZ1, hz0]]) box((a + c) / 2, y - SLAB / 2, (d + e) / 2, c - a, SLAB, e - d, '#cdc5b2', true, layer);
    mesh(tileUV(new THREE.BoxGeometry(hx0 - IX0, 0.012, IZ0 - IZ1), 4, 1), warm('#ffffff', 0.22, planks), (IX0 + hx0) / 2, y + 0.006, (IZ0 + IZ1) / 2, false, layer);
    mesh(tileUV(new THREE.BoxGeometry(IX1 - hx1, 0.012, IZ0 - IZ1), 1, 1), warm('#ffffff', 0.22, planks), (hx1 + IX1) / 2, y + 0.006, (IZ0 + IZ1) / 2, false, layer);
    mesh(tileUV(new THREE.BoxGeometry(hx1 - hx0, 0.012, hz0 - IZ1), 1, 1), warm('#ffffff', 0.22, planks), (hx0 + hx1) / 2, y + 0.006, (IZ1 + hz0) / 2, false, layer); };
  const flight = (xc, y0, zb, zt, layer) => { const n = 14, rise = SH / n, run = (zb - zt) / n;
    for (let i = 0; i < n; i++) { const top = y0 + (i + 1) * rise, z = zb - i * run - run / 2; box(xc, top - 0.02, z, 1.2, 0.04, run + 0.02, W('#b9946a', 0.26), true, layer); box(xc, top - rise / 2, z + run / 2, 1.2, rise, 0.02, woodD, false, layer); }
    const a = Math.atan2(rise, run), l = Math.hypot(n * run, n * rise); for (const dx of [-0.58, 0.58]) { const s = box(xc + dx, y0 + n * rise / 2 - 0.02, (zb + zt) / 2, 0.04, 0.18, l, woodD, true, layer); s.rotation.x = a; }
    rod([xc + 0.6, y0 + 0.9, zb], [xc + 0.6, y0 + SH + 0.9, zt], 0.02, steelC, layer); };

  // ================= main teaching wing =================
  group('school');
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - IZ1), 6, 2), warm('#ffffff', 0.2, planks), (IX0 + IX1) / 2, (F + BASE) / 2, (IZ0 + IZ1) / 2, false);
  mesh(tileUV(new THREE.BoxGeometry(7, 0.014, IZ0 - IZ1), 1, 1), warm('#ffffff', 0.1, pavers), 0, F + 0.007, (IZ0 + IZ1) / 2, false);   // entrance hall tile
  mesh(tileUV(new THREE.BoxGeometry(2.5, 0.014, IZ0 - IZ1), 1, 1), warm('#ffffff', 0.1, pavers), 10.75, F + 0.007, (IZ0 + IZ1) / 2, false);   // toilets and stair tile
  shell(0); partitions(0);
  { const plinth = (a, b, z) => box((a + b) / 2, 0.26, z, b - a, 0.14, 0.06, stoneC);
    plinth(MX0, -1.1, 0.02); plinth(1.1, MX1, 0.02); plinth(MX0, MX1, MZ1 - 0.02);
    for (const [x, o] of [[MX0, -1], [MX1, 1]]) box(x + o * 0.02, 0.26, MZ1 / 2, 0.06, 0.14, -MZ1, stoneC); }
  // main entrance: double glass door with a lit transom, door handles, a clock and the school nameplate over the cantilevered canopy
  { const z = -T / 2;
    box(0, F + 2.4, 0.0, 0.1, 0.03, 0.03, steelC, false); for (const x of [-0.3, 0.3]) box(x, F + 1.0, 0.04, 0.03, 0.5, 0.03, '#c9c9c0');
    box(0, F + 2.55, 0.02, 2.2, 0.28, 0.04, W('#fff0c8', 0.7), false);
    const nameT = canvasTex(512, 96, (q, w, h) => { q.fillStyle = '#e9e1cf'; q.fillRect(0, 0, w, h); q.strokeStyle = '#7d9b86'; q.lineWidth = 6; q.strokeRect(5, 5, w - 10, h - 10); q.fillStyle = '#2c4a3c'; q.font = 'bold 54px sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('あめまち小学校', w / 2, h / 2 + 2); });
    mesh(new THREE.PlaneGeometry(4.2, 0.78), new THREE.MeshToonMaterial({ map: nameT, gradientMap: K.ramp, emissive: '#3a3a30', emissiveMap: nameT }), 0, F + 3.95, 0.04, false);
    mesh(new THREE.CircleGeometry(0.38, 24), new THREE.MeshBasicMaterial({ color: '#f4efe0' }), 0, F2 + 2.3, 0.04, false); box(0, F2 + 2.3, 0.045, 0.03, 0.26, 0.01, '#2a2d31', false); box(0.07, F2 + 2.35, 0.045, 0.2, 0.03, 0.01, '#2a2d31', false);
    const cn = box(0, F + 3.05, 0.85, 5.0, 0.1, 1.7, roofM); box(0, F + 2.97, 1.68, 5.0, 0.12, 0.05, roofDk); box(0, F + 3.12, 0.0, 5.0, 0.1, 0.05, roofDk);
    for (const x of [-2.2, 2.2]) rod([x, F + 2.7, 0.02], [x, F + 3.0, 1.5], 0.025, '#3d4a58'); void cn; void z; }
  // ground floor interior: office, library corner, entrance hall (shoe lockers), classroom, toilets, stair room
  { const L = null; void L;
    // office
    for (const [x, z] of [[-11.5, -1.4], [-10.0, -3.4], [-12.2, -3.4]]) { table(x, z, 1.2, 0.65, 0.74, F); chairF(x, z - 0.6, [0, 1], F, '#6b8a9a'); box(x, F + 0.86, z, 0.34, 0.2, 0.05, '#2a2d31'); }
    box(-9.0, F + 0.9, -4.2, 0.5, 1.8, 0.7, W('#b9b3a0', 0.28)); tube(-10.4, -2.6, F + 3.0, 1.6, true); decal(4.0, 4.0, -10.4, F + 0.004, -2.6, [0, -1], pool);
    // library corner
    for (let k = 0; k < 4; k++) { box(-8.2 + 0.0, F + 1.0, -1.0 - k * 1.0, 0.3, 2.0, 0.8, woodD); for (let j = 0; j < 5; j++) box(-8.05, F + 0.2 + j * 0.4, -1.0 - k * 1.0, 0.04, 0.3, 0.7, W(['#2a8a68', '#c9402f', '#e0b040', '#4f7290', '#e8e4d6'][(j + k) % 5], 0.36), false); }
    table(-5.8, -2.4, 1.6, 0.8, 0.72, F); for (const x of [-6.4, -5.2]) chairF(x, -1.7, [0, -1], F, '#a8c096'); for (const x of [-6.4, -5.2]) chairF(x, -3.1, [0, 1], F, '#c9a86a'); tube(-6.0, -2.4, F + 3.0, 1.6, true); decal(4.0, 4.0, -6.0, F + 0.004, -2.4, [0, -1], pool);
    // entrance hall: shoe-locker banks on the partitions, a bench, an umbrella stand
    for (const x of [-3.2, 3.2]) for (let k = 0; k < 3; k++) { box(x, F + 0.7, -1.2 - k * 1.1, 0.32, 1.4, 1.0, W('#c9c1ac', 0.3)); mesh(new THREE.PlaneGeometry(0.9, 1.3), new THREE.MeshToonMaterial({ map: slotsT, gradientMap: K.ramp }), x + (x < 0 ? 0.17 : -0.17), F + 0.75, -1.2 - k * 1.1, false).rotation.y = x < 0 ? PI / 2 : -PI / 2; }
    box(0, F + 0.24, -3.4, 1.8, 0.05, 0.4, wood); cyl(2.4, F + 0.28, -4.2, 0.14, 0.56, W('#4f7290', 0.3)); tube(0, -2.0, F + 3.0, 2.0, true); decal(6.0, 4.0, 0, F + 0.004, -2.4, [0, -1], pool);
    // classroom 1-A
    classroom(3.5, 9.5, F, true);
    // toilets: stall partitions and washbasins
    for (let k = 0; k < 3; k++) { box(10.2 + k * 0.7, F + 0.9, -3.0, 0.04, 1.8, 1.6, W('#d8d1bd', 0.3)); cyl(10.55 + k * 0.7, F + 0.2, -3.7, 0.17, 0.4, W('#e8eef0', 0.3)); }
    box(10.8, F + 0.45, -4.5, 1.6, 0.9, 0.4, W('#d6cfba', 0.3)); tube(10.7, -2.5, F + 3.0, 1.2, true);
    // stair room: flight 1 (floor -> storey 2) and a landing guard rail
    flight(12.8, F, -0.6, -4.3); box(13.5, F + 0.1, -2.3, 0.04, 0.2, 3.9, woodD, false);
  }

  // ================= storeys 2 and 3 (layers f2 / f3): classrooms along the south, corridor along the north, the second stair flight =================
  const litOf = (i, k) => (i + k) % 3 !== 2;
  const L2 = new THREE.Group(); L2.userData.layer = 'f2'; group('school').add(L2); K.setRoot(L2);
  shell(1); partitions(1); slab(F2, [12.1, 13.5, -4.6, -0.4], L2);
  roomsUp.forEach(([x0, x1], k) => classroom(x0, x1, F2, litOf(1, k), L2));
  flight(14.1, F2, -0.6, -4.3, L2); rod([13.5, F2 + 0.9, -4.6], [13.5, F2 + 0.9, -0.4], 0.02, steelC, L2);
  for (const x of [-9, -3, 3, 9]) tube(x, -6.0, F2 + 3.0, 1.4, true, L2);
  const L3 = new THREE.Group(); L3.userData.layer = 'f3'; group('school').add(L3); K.setRoot(L3);
  shell(2); partitions(2); slab(F3, [13.5, 14.7, -4.6, -0.4], L3);
  roomsUp.forEach(([x0, x1], k) => classroom(x0, x1, F3, litOf(2, k), L3));
  rod([13.5, F3 + 0.9, -4.6], [13.5, F3 + 0.9, -0.4], 0.02, steelC, L3);
  for (const x of [-9, -3, 3, 9]) tube(x, -6.0, F3 + 3.0, 1.4, litOf(2, x > 0 ? 1 : 0), L3);
  // corridor details on each storey: notice boards and plants
  for (const [b, lay] of [[F2, L2], [F3, L3]]) { box(-6, b + 1.5, IZ1 + 0.03, 1.6, 0.9, 0.04, '#d6c08f', true, lay); box(5.5, b + 1.5, IZ1 + 0.03, 1.2, 0.9, 0.04, '#cdd6c0', true, lay); pot(-12.0, b, -6.1, 0.18, 6, 1.6, '#8f9aa0'); }
  K.setRoot(group('school'));

  // ================= roofs (roof layer): main side-gable wing and the low wing's gable roof =================
  const R = new THREE.Group(); R.userData.layer = 'roof'; group('school').add(R); K.setRoot(R);
  box((IX0 + IX1) / 2, WT - 0.12, (IZ0 + IZ1) / 2, IX1 - IX0, 0.1, IZ0 - IZ1, W('#efe4cc', 0.32), false);
  const SL = 0.38, RB = WT + 0.02, zm = MZ1 / 2, zf = 0.5, zr = MZ1 - 0.55, xa = MX0 - 0.5, xb = MX1 + 0.5, ye = RB - SL * 0.5, yr = RB + SL * (0 - zm), xc = (xa + xb) / 2;
  face([V(xa, ye, zf), V(xb, ye, zf), V(xb, yr, zm), V(xa, yr, zm)]); face([V(xb, ye, zr), V(xa, ye, zr), V(xa, yr, zm), V(xb, yr, zm)]);
  box(xc, yr + 0.06, zm, xb - xa + 0.1, 0.14, 0.24, roofDk);
  for (const x of [xa, xb]) { rod([x, ye + 0.03, zf], [x, yr + 0.03, zm], 0.05, roofDk); rod([x, ye + 0.03, zr], [x, yr + 0.03, zm], 0.05, roofDk); }
  { const gp = [[MZ1, WT - 0.1], [0, WT - 0.1], [0, RB - 0.07], [zm, yr - 0.07], [MZ1, RB - 0.07]];
    shapeMesh(gp, T, plaster, MX0 + T, 0, 0, -PI / 2); shapeMesh(gp, T, plaster, MX1, 0, 0, -PI / 2);
    for (const [x, o] of [[MX0, -1], [MX1, 1]]) { box(x + o * 0.02, WT + 0.6, zm, 0.05, 0.4, 1.0, '#7d9b86'); for (let i = 0; i < 4; i++) box(x + o * 0.05, WT + 0.48 + i * 0.09, zm, 0.03, 0.025, 0.9, '#d3d4cf', false); } }
  for (const [z, o] of [[zf, 1], [zr, -1]]) { const gg = new THREE.CylinderGeometry(0.07, 0.07, xb - xa, 8, 1, true, 0, PI); gg.rotateZ(-PI / 2); mesh(gg, mat('#7f8a92'), xc, ye - 0.05, z + o * 0.05); box(xc, ye + 0.02, z + o * 0.02, xb - xa, 0.12, 0.05, roofDk); }
  box(8.5, yr + 0.45, -3.4, 0.55, 1.0, 0.55, '#a8806a'); box(8.5, yr + 0.98, -3.4, 0.7, 0.08, 0.7, roofDk);   // boiler chimney
  for (const x of [-9, 1.0]) { cyl(x, yr - 0.3, -2.0, 0.07, 0.6, '#7f8a92'); mesh(new THREE.ConeGeometry(0.12, 0.1, 8), mat('#7f8a92'), x, yr + 0.05, -2.0, false); }
  box(4.0, yr - 0.1, -5.0, 0.9, 0.5, 0.7, '#9aa3ae'); box(4.0, yr + 0.18, -5.0, 0.7, 0.06, 0.5, '#59656d');   // rooftop vent box
  // low wing roof (the wing's walls are in schoolLow): a gable ridge along z, ending against the main wing's front wall
  const LX0 = -16.2, LX1 = -9.8, LZ1 = 9.2, LT = F + 3.5, SLw = 0.5, LRB = LT + 0.02, lxr = (LX0 + LX1) / 2, lxe = LX1 + 0.4, lxw = LX0 - 0.4, lze = LZ1 + 0.5, lye = LRB - SLw * 0.4, lyr = LRB + SLw * (LX1 - lxr);
  face([V(lxe, lye, 0.02), V(lxe, lye, lze), V(lxr, lyr, lze), V(lxr, lyr, 0.02)]); face([V(lxw, lye, lze), V(lxw, lye, 0.02), V(lxr, lyr, 0.02), V(lxr, lyr, lze)]);
  box(lxr, lyr + 0.05, (0.02 + lze) / 2, 0.2, 0.12, lze - 0.02, roofDk);
  for (const x of [lxe, lxw]) rod([x, lye + 0.03, lze], [lxr, lyr + 0.03, lze], 0.045, roofDk);
  shapeMesh([[LX0, LT], [LX1, LT], [lxr, lyr - 0.1]], T, plaster, 0, 0, LZ1 - T, 0); shapeMesh([[LX0, LT], [LX1, LT], [lxr, lyr - 0.1]], T, plaster, 0, 0, -T, 0);
  for (const x of [lxe, lxw]) { const gg = new THREE.CylinderGeometry(0.06, 0.06, lze - 0.02, 8, 1, true, 0, PI); gg.rotateX(PI / 2); gg.rotateZ(-PI / 2); mesh(gg, mat('#7f8a92'), x + Math.sign(x - lxr) * 0.05, lye - 0.05, lze / 2); }
  // downpipes along the main wing (kept away from the entrance line)
  for (const x of [-12.7, -6.5, 6.5, 12.7]) { cyl(x, (ye + 0.3) / 2, zf - 0.1, 0.05, ye - 0.3, '#7f8a92'); cyl(x, (ye + 0.3) / 2, zr + 0.1, 0.05, ye - 0.3, '#7f8a92'); }
  K.setRoot(group('school'));
  for (const x of [-12.7, -6.5, 6.5, 12.7]) { box(x, 0.22, zf - 0.1, 0.2, 0.06, 0.2, '#a39d91'); for (const y of [1.0, 4.0, 7.0]) box(x, y, zf - 0.1 - 0.03, 0.12, 0.04, 0.08, '#5f6c76', false); }

  // ================= low wing: community activity room (walls and interior; its roof is in the main group) =================
  group('schoolLow');
  cyl(lxe + 0.04, (lye + 0.3) / 2, lze - 0.2, 0.05, lye - 0.3, '#7f8a92'); box(lxe + 0.04, 0.22, lze - 0.2, 0.2, 0.06, 0.2, '#a39d91');
  mesh(tileUV(new THREE.BoxGeometry(LX1 - LX0 - 2 * T, F - BASE, LZ1 - T - 0.3), 3, 3), warm('#ffffff', 0.2, planks), lxr, (F + BASE) / 2, (0.3 + LZ1 - T) / 2, false);
  const lowE = [[1.4, 2.9, F + 0.9, F + 2.7], [3.7, 5.2, F + 0.9, F + 2.7], [6.0, 7.5, F + 0.9, F + 2.7], [7.9, 8.9, F, F + 2.2]], lowW = [[2.0, 3.4, F + 1.4, F + 2.5], [5.0, 6.4, F + 1.4, F + 2.5]], lowS = [[-15.2, -13.6, F + 1.0, F + 2.6], [-12.4, -10.8, F + 1.0, F + 2.6]];
  wall('z', LX1 - T / 2, T, [0, LZ1, BASE, LT], lowE, plaster); wall('z', LX0 + T / 2, T, [0, LZ1, BASE, LT], lowW, plaster);
  wall('x', LZ1 - T / 2, T, [LX0, LX1, BASE, LT], lowS, plaster); wall('x', T / 2, T, [LX0, LX1, BASE, LT], [], plaster);
  panel('z', LX1 - T - 0.006, 0.012, [0.3, LZ1 - T, F, LT - 0.1], lowE, cream); panel('z', LX0 + T + 0.006, 0.012, [0.3, LZ1 - T, F, LT - 0.1], lowW, cream); panel('x', LZ1 - T - 0.006, 0.012, [LX0 + T, LX1 - T, F, LT - 0.1], lowS, cream);
  for (const w of lowE) glazeW('z', LX1 - T / 2, 1, w); for (const w of lowW) glazeW('z', LX0 + T / 2, -1, w); for (const w of lowS) glazeW('x', LZ1 - T / 2, 1, w);
  box(lxr, LT - 0.1, (0.3 + LZ1 - T) / 2, LX1 - LX0 - 2 * T, 0.1, LZ1 - T - 0.3, W('#efe4cc', 0.32), false, R);   // ceiling lives in the roof layer so the cutaways show the room
  box((LX0 + LX1) / 2, F2 - 0.1 - 0.0, LZ1 - 0.01, LX1 - LX0 + 0.1, 0.2, 0.05, belt);
  for (const [x, z] of [[-14.2, 3.0], [-14.2, 5.4]]) { table(x, z, 2.6, 0.8, 0.72, F); for (const dx of [-0.9, 0, 0.9]) { chairF(x + dx, z - 0.65, [0, 1], F, '#a8c096'); chairF(x + dx, z + 0.65, [0, -1], F, '#c9a86a'); } }
  box(-15.4, F + 0.55, 7.8, 0.7, 1.1, 1.5, woodD); box(-15.45, F + 1.2, 7.8, 0.5, 0.1, 1.4, W('#2f2a26', 0.1), false); chairF(-14.6, 7.8, [-1, 0], F, '#6b8a9a');   // upright piano and stool
  box(-12.2, F + 1.4, 0.45, 2.6, 1.1, 0.05, W('#f4f0e6', 0.4), true); for (let k = 0; k < 3; k++) box(-12.0, F + 0.9, 8.5, 0.3, 1.8, 0.8, W('#b9b3a0', 0.28));
  for (const x of [-14.2, -11.8]) tube(x, 4.6, LT - 0.15, 3.0, true, undefined, 'z'); decal(4.5, 8.0, lxr + 0.4, F + 0.004, 4.6, [0, -1], pool);
  box(lxr, F + 0.01, 8.5, 2.4, 0.02, 0.8, W('#8a96a8', 0.28), false);   // entrance mat
  K.setRoot(group('school'));

  // ================= boundary walls and gates (split at the gates so the walking route stays open) =================
  const PX0 = -19.7, PX1 = 19.7, PZ0 = -10.7, PZ1 = 13.5, GW = 1.7;
  const fenceSeg = (x0, x1, z0, z1, railing) => { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0, alongX = w > d;
    box(cx, 0.19 + (railing ? 0.45 : 0.9), cz, w, railing ? 0.9 : 1.8, d, '#bdb7a6'); box(cx, 0.19 + (railing ? 0.93 : 1.83), cz, w + 0.04, 0.06, d + 0.06, '#d9d4c4');
    if (railing) { const L = alongX ? w : d, n = Math.floor(L / 0.2); for (let i = 0; i <= n; i++) { const u = -L / 2 + i * L / n; box(alongX ? cx + u : cx, 0.19 + 1.4, alongX ? cz : cz + u, 0.025, 0.9, 0.025, sage, false); }
      box(cx, 0.19 + 1.86, cz, alongX ? w : 0.05, 0.05, alongX ? 0.05 : d, sage, false); } };
  const pillar = (x, z, lamp) => { box(x, 0.19 + 1.1, z, 0.55, 2.2, 0.55, '#cfc8b6'); box(x, 0.19 + 2.24, z, 0.68, 0.08, 0.68, '#a8a091'); if (lamp) { box(x, 0.19 + 2.5, z, 0.3, 0.4, 0.3, W('#ffe2a6', 0.9), false); box(x, 0.19 + 2.76, z, 0.4, 0.06, 0.4, '#59656d'); } };
  group('schoolWallS1');
  fenceSeg(PX0, -GW - 0.3, PZ1 - 0.15, PZ1 + 0.15, true); pillar(-GW - 0.3, PZ1, true);
  { const leaf = (x) => { box(x, 0.19 + 0.95, PZ1 - 0.9, 0.05, 1.6, 1.5, sage); for (let i = 0; i < 7; i++) box(x, 0.19 + 0.95, PZ1 - 0.2 - i * 0.2, 0.03, 1.5, 0.03, '#5e7a68', false); box(x, 0.19 + 1.8, PZ1 - 0.9, 0.06, 0.06, 1.5, '#5e7a68', false); }; leaf(-GW + 0.05); }   // gate leaf swung inward, parallel to the path
  box(-5.5, 0.19 + 1.3, PZ1 - 0.2, 3.0, 1.2, 0.08, '#d6c08f'); box(-5.5, 0.19 + 1.3, PZ1 - 0.25, 3.1, 1.3, 0.04, '#6b4a30');   // notice board on the inside of the wall
  const plaqT = canvasTex(256, 96, (q, w, h) => { q.fillStyle = '#e9e1cf'; q.fillRect(0, 0, w, h); q.strokeStyle = '#2c4a3c'; q.lineWidth = 5; q.strokeRect(4, 4, w - 8, h - 8); q.fillStyle = '#2c4a3c'; q.font = 'bold 34px sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('あめまち小学校', w / 2, h / 2); });
  mesh(new THREE.PlaneGeometry(0.46, 0.17), new THREE.MeshToonMaterial({ map: plaqT, gradientMap: K.ramp, emissive: '#3a3a30', emissiveMap: plaqT }), -GW - 0.3, 0.19 + 1.5, PZ1 + 0.29, false);
  group('schoolWallS2');
  fenceSeg(GW + 0.3, PX1, PZ1 - 0.15, PZ1 + 0.15, true); pillar(GW + 0.3, PZ1, true);
  { const x = GW - 0.05; box(x, 0.19 + 0.95, PZ1 - 0.9, 0.05, 1.6, 1.5, sage); for (let i = 0; i < 7; i++) box(x, 0.19 + 0.95, PZ1 - 0.2 - i * 0.2, 0.03, 1.5, 0.03, '#5e7a68', false); box(x, 0.19 + 1.8, PZ1 - 0.9, 0.06, 0.06, 1.5, '#5e7a68', false); }
  group('schoolWallN'); fenceSeg(PX0, PX1, PZ0 - 0.15, PZ0 + 0.15, false);
  group('schoolWallW'); fenceSeg(PX0 - 0.15 + 0.0, PX0 + 0.15, PZ0, PZ1 - 0.15, false);
  group('schoolWallE1'); fenceSeg(PX1 - 0.15, PX1 + 0.0, PZ0, -6.7, false); pillar(PX1 - 0.1, -6.7, false);
  group('schoolWallE2'); fenceSeg(PX1 - 0.15, PX1 + 0.0, -3.3, PZ1 - 0.15, true); pillar(PX1 - 0.1, -3.3, true);
  for (const z of [-6.45, -3.55]) { box(PX1 - 1.1, 0.19 + 0.95, z, 1.6, 1.6, 0.05, sage); box(PX1 - 1.1, 0.19 + 1.8, z, 1.6, 0.06, 0.06, '#5e7a68', false); }   // vehicle gate leaves swung inward

  // ================= bicycle shed east of the gate =================
  group('schoolBikes');
  { const x0 = 3.2, x1 = 10.8, z0 = 10.2, z1 = 12.9, hh = 2.5;
    for (const [x, z] of [[x0 + 0.1, z0 + 0.1], [x1 - 0.1, z0 + 0.1], [x0 + 0.1, z1 - 0.1], [x1 - 0.1, z1 - 0.1], [(x0 + x1) / 2, z1 - 0.1]]) box(x, 0.19 + hh / 2, z, 0.08, hh, 0.08, steelC);
    const rf = box((x0 + x1) / 2, 0.19 + hh + 0.06, (z0 + z1) / 2, x1 - x0 + 0.5, 0.06, z1 - z0 + 0.4, '#9aa8b4'); rf.rotation.x = -0.06; box((x0 + x1) / 2, 0.19 + hh - 0.02, z1 + 0.2, x1 - x0 + 0.5, 0.1, 0.04, '#59656d');
    for (let i = 0; i < 10; i++) { const x = x0 + 0.6 + i * 0.7; box(x, 0.19 + 0.04, z0 + 0.5, 0.03, 0.04, 1.8, steelC, false);
      for (const dz of [0.15, 1.3]) { const w = mesh(new THREE.TorusGeometry(0.3, 0.02, 5, 14), mat('#2a2d31'), x, 0.19 + 0.32, z0 + 0.4 + dz, false); w.rotation.y = PI / 2; }
      rod([x, 0.19 + 0.32, z0 + 0.55], [x, 0.19 + 0.55, z0 + 0.95], 0.012, ['#5f7aa0', '#c9402f', '#6aa04f', '#d9a03a'][i % 4]); rod([x, 0.19 + 0.55, z0 + 0.95], [x, 0.19 + 0.32, z0 + 1.45], 0.012, ['#5f7aa0', '#c9402f', '#6aa04f', '#d9a03a'][i % 4]); box(x, 0.19 + 0.9, z0 + 0.5, 0.04, 0.04, 0.3, '#2a2d31', false); } }

  // ================= playground, flag pole and benches =================
  const paveMat = warm('#ffffff', 0, pavers), pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  group('schoolPlay');
  mesh(tileUV(new THREE.BoxGeometry(22.5, 0.016, 7.8), 3, 1), new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: dirtT }), 2.25, 0.2, 6.3, false);
  { const lw = 0.08, ly = 0.212, lm = mat('#f4efe0');
    for (const [x, z, w, d] of [[2.25, 2.6, 21.0, lw], [2.25, 10.0, 21.0, lw], [-8.25, 6.3, lw, 7.4], [12.75, 6.3, lw, 7.4], [2.25, 6.3, lw, 7.4]]) mesh(new THREE.BoxGeometry(w, 0.01, d), lm, x, ly, z, false);
    const ring = mesh(new THREE.RingGeometry(1.5, 1.58, 28), new THREE.MeshBasicMaterial({ color: '#f4efe0' }), 2.25, ly + 0.002, 6.3, false); ring.rotation.x = -PI / 2; }
  pave(-1.5, 1.5, 0.2, 13.6); pave(-13, 15, 0.3, 1.8); pave(15.4, 19.7, -10.6, 13.5); pave(-19.6, -16.3, 0.3, 13.5); pave(-19.6, 19.7, -10.6, -7.8); pave(-9, -1.5, 10.2, 13.5);
  group('schoolGoal');
  box(13.3, 0.19 + 1.1, 5.0, 0.08, 2.2, 0.08, '#f4efe0'); box(13.3, 0.19 + 1.1, 7.6, 0.08, 2.2, 0.08, '#f4efe0'); box(13.3, 0.19 + 2.2, 6.3, 0.08, 0.08, 2.7, '#f4efe0');   // soccer goal
  for (let i = 0; i < 6; i++) box(13.7, 0.19 + 1.1, 5.1 + i * 0.5, 0.01, 2.0, 0.01, '#d6d6d0', false);
  group('schoolGearW');
  cyl(-6.0, 0.19 + 3.2, 11.6, 0.05, 6.4, '#d6d6d0'); box(-6.0, 0.19 + 3.5, 11.6, 0.6, 0.4, 0.02, '#f4efe0', false);
  for (const x of [-8]) { box(x, 0.19 + 0.42, 10.9, 1.2, 0.05, 0.35, '#9a6e44'); box(x - 0.5, 0.19 + 0.2, 10.9, 0.05, 0.4, 0.3, '#6a5038', false); box(x + 0.5, 0.19 + 0.2, 10.9, 0.05, 0.4, 0.3, '#6a5038', false); }
  for (const [x, z] of [[-4.0, 12.5]]) { box(x, 0.19 + 0.3, z, 1.6, 0.6, 0.45, '#a29e94'); box(x, 0.19 + 0.55, z, 1.4, 0.04, 0.35, '#4a3a2e', false); gs(x - 0.4, z, 0.2); gs(x + 0.4, z, 0.2); }
  group('schoolGearE');
  { const x = 7; box(x, 0.19 + 0.42, 10.9, 1.2, 0.05, 0.35, '#9a6e44'); box(x - 0.5, 0.19 + 0.2, 10.9, 0.05, 0.4, 0.3, '#6a5038', false); box(x + 0.5, 0.19 + 0.2, 10.9, 0.05, 0.4, 0.3, '#6a5038', false); }
  for (const [x, z] of [[4.0, 12.5]]) { box(x, 0.19 + 0.3, z, 1.6, 0.6, 0.45, '#a29e94'); box(x, 0.19 + 0.55, z, 1.4, 0.04, 0.35, '#4a3a2e', false); gs(x - 0.4, z, 0.2); gs(x + 0.4, z, 0.2); }
  function gs(x, z, r) { shrub(x, 0.19 + 0.36 * r + 0.3, z, r, 5, 1.1); }

  // ================= trees (swaying), rear service strip and east service yard =================
  const trees = [];
  [[17.6, 2.0, 1.1], [17.6, 9.0, 1.0], [-18.0, 11.4, 1.0], [-7.5, 12.2, 0.9], [17.6, -8.0, 1.0]].forEach(([x, z, s], ti) => {
    const treeFx = new THREE.Group(); treeFx.userData.live = true; group('schoolTree' + (ti + 1)).add(treeFx);
    const tg = new THREE.Group(); tg.position.set(x, 0.19, z); tg.scale.setScalar(s); treeFx.add(tg); trees.push(tg);
    cyl(0, 1.1, 0, 0.1, 2.2, '#6b4c36', tg);
    for (const [dx, dy, dz, r] of [[0, 2.8, 0, 0.95], [0.5, 2.3, 0.3, 0.7], [-0.5, 2.4, -0.2, 0.7], [0.1, 3.4, 0, 0.6]]) { const a = mesh(new THREE.SphereGeometry(1, 7, 5), mat(LEAF[(dx > 0) * 1 + (dz > 0) * 1]), dx, dy, dz, false, tg); a.scale.setScalar(r); }
  });
  group('schoolRear');
  box(-14.0, 0.19 + 1.2, -9.3, 6.0, 2.4, 2.0, '#cfc8b6'); { const sr = box(-14.0, 0.19 + 2.55, -9.3, 6.4, 0.1, 2.5, '#9aa8b4'); sr.rotation.x = 0.06; } box(-14.0, 0.19 + 1.0, -8.28, 1.2, 2.0, 0.06, '#7d9b86'); box(-16.4, 0.19 + 0.9, -8.28, 0.9, 1.4, 0.06, '#b9b3a0', false);   // equipment shed
  for (const x of [2.5, 4.5, 6.5]) { box(x, 0.19 + 0.05, -8.0, 0.9, 0.1, 0.45, '#7f8b93'); box(x, 0.19 + 0.42, -8.0, 0.8, 0.65, 0.4, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.2, 16), mat('#3b4650'), x, 0.19 + 0.42, -7.78, false).rotation.y = PI; }
  cyl(11.0, 0.19 + 1.5, -9.2, 0.9, 3.0, W('#cfd4d0', 0.28)); cyl(11.0, 0.19 + 3.05, -9.2, 0.92, 0.1, '#59656d'); for (const dx of [-0.6, 0.6]) rod([11.0 + dx, 0.19, -9.2], [11.0 + dx, 0.19 + 1.6, -9.2], 0.03, steelC);
  pot(-8.0, 0.19, -8.6, 0.2, 6, 1.8, '#7d6a5a'); pot(0.5, 0.19, -8.6, 0.2, 6, 1.8, '#9b7d68');
  group('schoolEast');
  { box(18.0, 0.19 + 1.0, 1.4, 2.2, 2.0, 1.6, '#cfc8b6'); const ws = box(18.0, 0.19 + 2.1, 1.4, 2.6, 0.08, 2.0, '#9aa8b4'); ws.rotation.x = 0.05;   // refuse store
    for (const [z, c] of [[-0.6, '#3f8a5a'], [0.2, '#4f7290'], [1.0, '#3a4a5a']]) { box(16.7, 0.19 + 0.3, z + 3.6, 0.5, 0.6, 0.45, c); box(16.7, 0.19 + 0.62, z + 3.6, 0.54, 0.04, 0.5, '#2f3944'); }
    box(17.4, 0.19 + 0.35, 7.2, 1.0, 0.1, 0.6, steelC); for (const dx of [-0.35, 0.35]) { const w = cyl(17.4 + dx, 0.19 + 0.2, 7.5, 0.18, 0.06, '#2a2d31'); w.rotation.z = PI / 2; } }   // hand cart

  // ================= local animation: eave drips and window rain on the main wing, swaying trees =================
  const fx = new THREE.Group(); fx.userData.live = true; group('school').add(fx); K.setRoot(fx);
  const batch = (c, o, par = fx) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; par.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6), cdrips = batch('#cee7e5', 0.6);
  for (const w of HOLES(1, F2).front.slice(0, 4)) for (let i = 0; i < 3; i++) runs.add(w[0] + 0.2 + rnd() * (w[1] - w[0] - 0.4), w[2] + 0.1 + rnd() * 1.0, 0.07, 0.08 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (const w of HOLES(0, F).front.slice(1, 5)) for (let i = 0; i < 3; i++) runs.add(w[0] + 0.2 + rnd() * (w[1] - w[0] - 0.4), w[2] + 0.1 + rnd() * 0.8, 0.07, 0.08 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 40; i++) drips.add(-13 + rnd() * 28, 8.6 + rnd() * 1.4, zf - 0.02, 0.1, F3 + 3.1 - 0.2 - 3.4 + 0.2, 10.0, 2.1 + rnd() * 0.5);   // front eave
  for (let i = 0; i < 10; i++) cdrips.add(-2.4 + i * 0.52 + rnd() * 0.1, F + 2.9 + rnd() * 0.3, 1.72, 0.1, F + 2.2, F + 3.0, 2.1 + rnd() * 0.5);   // canopy edge
  runs.seal(); drips.seal(); cdrips.seal();
  const flag = new THREE.Group(); flag.position.set(-6.0, 0.19 + 3.5, 11.6); group('schoolGearW').add(flag); flag.userData.live = true; box(0.3, 0, 0, 0.6, 0.4, 0.02, '#f4efe0', false, flag); mesh(new THREE.CircleGeometry(0.1, 14), mat('#c9402f'), 0.3, 0, 0.012, false, flag);
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt); cdrips.step(dt);
      trees.forEach((tg, i) => { tg.rotation.z = 0.03 * Math.sin(t * 0.8 + i * 1.7) * (0.7 + 0.3 * Math.sin(t * 0.31 + i)); tg.rotation.x = 0.02 * Math.sin(t * 0.6 + i); });
      flag.rotation.y = 0.35 * Math.sin(t * 1.4) + 0.1; flag.rotation.z = 0.04 * Math.sin(t * 2.1);
    },
  };
};
