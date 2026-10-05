// B03-P03 古書 しおり堂 (Shiori-do Old Books): a one-storey second-hand bookshop on the main street.
// Task card docs/buildings/tasks/B03-P03.md, reference docs/buildings/references/B03-P03.jpg.
// Local frame (placed by layout.js `buildings`, rotY 0): front +z faces the main street (world S), +x is the
// viewer's right = world E (the laundry B03-P02 next door); door centre at the origin, floor top at rec.floor.
// A small machiya-style shop: timber frame on beige plaster, charred-board lower walls, dark green tiled gable
// roof (ridge front to back, gable end to the street) with a short tiled front eave over the shopfront.
// Body 5.4 × 5.6: x -2.7…2.7, z -5.6…0 (side eaves and gutters to ±3.2, front eave to +0.8, rear verge and back
// door eave to -6.0: inside the 7.0 × 7.0 buildable envelope).
// Groups: bookshop (shell, frame, roof, front eave, glazed display case, book-shaped sign, lamps, gutters,
// interior) · bookFrontW (bargain-book wagon, pot) · bookFrontE (umbrella stand, A-board, pot) · bookSideW
// (pots along the west wall) · bookUtility (AC outdoor unit, rear) · bookService (fenced 1.5 × 1.2 bin yard,
// rear east) · bookGround (forecourt, side and rear paths, mat, window light on the wet ground).
// Plan: bargain bin behind the west glass and a slanted magazine rack behind the east glass; tall shelves on
// both walls with low shelves under the lattice windows; two display tables of recommended books on the west
// of the central aisle; register counter with a reading lamp and a packing table behind it on the east;
// stationery drawer cabinet against the partition; stock room (stock cabinets, cartons, back door) behind.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B03-P03'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(3303), PI = Math.PI;
  const F = rec.floor, X0 = -2.7, X1 = 2.7, Z0 = 0, Z1 = -5.6, T = 0.15, BASE = 0.19, EAVE = 3.2, CEIL = 2.95, PART = -4.4;
  const SL = 0.55, TH = Math.atan(SL), OVS = 0.45, OVF = 0.4, OVR = 0.35, RIDGE = EAVE + X1 * SL;   // roof slope, overhangs, ridge underside
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T;
  // Openings [u0, u1, y0, y1]: front/rear/partition along x, sides along z.
  const FW = [-2.45, -0.75, 0.62, 2.3], FD = [-0.5, 0.5, F, 2.3], FE = [0.75, 2.42, 0.62, 2.3];
  const WL = [-3.6, -2.0, 1.32, 2.3], ER = [-3.6, -2.0, 1.32, 2.3], ES = [-4.95, -4.5, 1.6, 2.1], BD = [-1.5, -0.65, F, 2.2], PD = [1.3, 2.05, F, 2.1];

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const plaster = mat('#e3d4b8'), timber = '#5e4232', timberL = '#7a5a44', board = '#4a4440', stoneC = '#9a958b', trim = '#5b6168', metal = '#8a8f92';
  const W = (c, k = 0.3) => warm(c, k);
  const wood = W('#b0814f'), woodD = W('#6f4a35', 0.26), cream = W('#f1e4c8', 0.34), floorW = W('#a7764c', 0.26), steel = W('#c3cacb', 0.22), paperW = W('#d8b98a', 0.34);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' });
  // Dark green roof tiles: channels run down the slope (texture rows), courses across it (columns).
  const tileT = tex(256, 256, (q, w, h) => { q.fillStyle = '#3f5a52'; q.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) { const g = q.createLinearGradient(0, r * 32, 0, r * 32 + 32); g.addColorStop(0, '#2f463f'); g.addColorStop(0.45, '#4f6d63'); g.addColorStop(1, '#2c413b'); q.fillStyle = g; q.fillRect(0, r * 32, w, 32); }
    q.strokeStyle = 'rgba(20,30,28,.55)'; q.lineWidth = 2; for (let c = 0; c <= 8; c++) { q.beginPath(); q.moveTo(c * 32, 0); q.lineTo(c * 32, h); q.stroke(); }
    for (let i = 0; i < 700; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '10,20,18' : '200,220,210'},${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1); } });
  const tileM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: tileT });
  // Charred cedar boards (yakisugi) for the lower walls.
  const boardT = tex(256, 128, (q, w, h) => { for (let i = 0; i < 16; i++) { q.fillStyle = `hsl(25,${8 + rnd() * 6}%,${24 + rnd() * 6}%)`; q.fillRect(i * 16, 0, 16, h); q.fillStyle = 'rgba(0,0,0,.45)'; q.fillRect(i * 16, 0, 1.5, h); }
    for (let i = 0; i < 300; i++) { q.fillStyle = `rgba(255,240,220,${0.03 + rnd() * 0.04})`; q.fillRect(rnd() * w, rnd() * h, 1, 4 + rnd() * 10); } });
  const boardM = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map: boardT });
  const planks = tex(256, 256, (q, w, h) => { for (let r = 0; r < 8; r++) { q.fillStyle = `hsl(${24 + rnd() * 6},${36 + rnd() * 10}%,${42 + rnd() * 8}%)`; q.fillRect(0, r * 32, w, 32);
    q.fillStyle = 'rgba(60,36,24,.55)'; q.fillRect(0, r * 32, w, 1.5); q.fillRect(rnd() * 200 + 28, r * 32, 1.5, 32); } });
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
  const chalk = (w, h, lines, bg = '#33403a') => canvasTex(w, h, (q, W2, H2) => { q.fillStyle = bg; q.fillRect(0, 0, W2, H2); q.textAlign = 'center'; q.textBaseline = 'middle';
    for (const [t, y, size, font = 'sans-serif', col] of lines) { q.fillStyle = col || '#efe9da'; q.font = `bold ${size}px ${font}`; q.fillText(t, W2 / 2, y); } });

  // ---- books: one spine texture; a shelf row is a single box whose front face shows dozens of spines ----
  const SPINE = ['#7a3b34', '#3f5a7a', '#5f7a4f', '#a8743a', '#e2d6bc', '#4a3f5a', '#9a5a4a', '#c9b48a', '#2f4a48', '#b8a27a', '#6b2f2f', '#8aa0a8'];
  const spineT = tex(512, 64, (q, w, h) => { let x = 0; while (x < w) { const sw = 6 + Math.floor(rnd() * 10), c = SPINE[Math.floor(rnd() * SPINE.length)], top = Math.floor(rnd() * 14);
      q.fillStyle = '#2a2420'; q.fillRect(x, 0, sw, h); q.fillStyle = c; q.fillRect(x + 0.5, top, sw - 1, h - top);
      if (rnd() < 0.5) { q.fillStyle = 'rgba(232,200,120,.75)'; q.fillRect(x + 1, top + 8, sw - 2, 2); q.fillRect(x + 1, h - 12, sw - 2, 2); }
      if (rnd() < 0.4) { q.fillStyle = 'rgba(245,236,214,.6)'; q.fillRect(x + sw / 2 - 1, top + 16, 2, 18); }
      x += sw; } });
  const bookM = new THREE.MeshToonMaterial({ map: spineT, gradientMap: K.ramp, emissive: new THREE.Color('#ffb36b').multiplyScalar(0.3), emissiveMap: spineT });
  const bookO = new THREE.MeshToonMaterial({ map: spineT, gradientMap: K.ramp });
  // Row of books standing on a shelf along the given axis, spines facing `dir` (±1 along the depth axis).
  const row = (axis, u0, u1, y, d, depth, h, m = bookM) => { const len = Math.abs(u1 - u0), g = new THREE.BoxGeometry(axis === 'x' ? len : depth, h, axis === 'x' ? depth : len), uv = g.attributes.uv, off = rnd();
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 1.6 + off, uv.getY(i));
    return mesh(g, m, axis === 'x' ? (u0 + u1) / 2 : d, y + h / 2, axis === 'x' ? d : (u0 + u1) / 2, false); };
  // Flat stacks and face-out covers share a small palette texture (one mesh after baking).
  const atlas = canvasTex(64, 4, q => SPINE.forEach((c, i) => { q.fillStyle = c; q.fillRect(i * 4, 0, 4, 4); }));
  atlas.magFilter = atlas.minFilter = THREE.NearestFilter; atlas.generateMipmaps = false;
  const stackM = new THREE.MeshToonMaterial({ map: atlas, gradientMap: K.ramp, emissive: new THREE.Color('#ffb36b').multiplyScalar(0.3), emissiveMap: atlas });
  const tinted = {}, cubeG = new THREE.BoxGeometry(1, 1, 1), tint = c => { if (!tinted[c]) { const q = cubeG.clone(), uv = q.attributes.uv, u = (SPINE.indexOf(c) + 0.5) / 16; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, 0.5); tinted[c] = q; } return tinted[c]; };
  const pick = () => SPINE[Math.floor(rnd() * SPINE.length)];
  const stack = (x, y, z, n, w = 0.17, d = 0.24, m = stackM) => { let yy = y; for (let i = 0; i < n; i++) { const t = 0.025 + rnd() * 0.02, a = mesh(tint(pick()), m, x + (rnd() - 0.5) * 0.02, yy + t / 2, z + (rnd() - 0.5) * 0.02, false);
      a.scale.set(w * (0.85 + rnd() * 0.3), t, d * (0.85 + rnd() * 0.3)); a.rotation.y = (rnd() - 0.5) * 0.2; yy += t; } return yy; };
  // Bookcase along a wall: carcass, shelves, a row of books on each (u along the wall, d = wall-side x/z, dir = facing sign).
  const bookcase = (axis, u0, u1, d, dir, h, shelves) => { const depth = 0.32, c = d + dir * depth / 2, len = u1 - u0;
    ab(axis, (u0 + u1) / 2, F + h / 2, d + dir * 0.01, len, h, 0.02, woodD, false);
    for (const u of [u0 + 0.015, u1 - 0.015]) ab(axis, u, F + h / 2, c, 0.03, h, depth, woodD);
    ab(axis, (u0 + u1) / 2, F + h - 0.015, c, len, 0.03, depth + 0.02, wood);
    const n = Math.max(1, Math.round(len / 0.8)); for (let k = 1; k < n; k++) ab(axis, u0 + k * len / n, F + h / 2, c, 0.025, h, depth, woodD);
    for (let s = 0; s < shelves; s++) { const y = F + 0.08 + s * (h - 0.1) / shelves; ab(axis, (u0 + u1) / 2, y, c, len - 0.03, 0.025, depth, wood);
      row(axis, u0 + 0.04, u1 - 0.04, y + 0.0125, c + dir * 0.02, 0.2, Math.min(0.26, (h - 0.1) / shelves - 0.06) * (0.85 + rnd() * 0.15)); } };

  // ---- plants outside ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), LEAF = ['#6c9476', '#88a98a', '#5e8a6a'];
  const shrub = (x, y, z, r, n, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(LEAF[i % 3]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.35 + rnd() * r * h, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.45 + rnd() * 0.25)); } };
  const pot = (x, y, z, r, n = 5, h = 1, c = '#9b7d68') => { mesh(new THREE.CylinderGeometry(r, r * 0.76, r * 1.15, 10), mat(c), x, y + r * 0.575, z); shrub(x, y + r * 1.1, z, r, n, h); };

  // ================= shell =================
  group('bookshop');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, EAVE], [FW, FD, FE], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, EAVE], [BD], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, EAVE], [ER, ES], plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, EAVE], [WL], plaster);
  // Charred-board lower walls on the sides and the rear (up to 1.0), stone plinth below.
  const lower = (axis, a, b, d, out, holes = []) => { for (const [p, q] of holes.reduce((s, [h0, h1]) => s.flatMap(([p, q]) => [[p, Math.min(q, h0)], [Math.max(p, h1), q]]).filter(([p, q]) => q - p > 0.01), [[a, b]])) {
      const len = q - p, g = new THREE.BoxGeometry(axis === 'x' ? len : 0.025, 1.0 - 0.32, axis === 'x' ? 0.025 : len), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 1.0);
      mesh(g, boardM, axis === 'x' ? (p + q) / 2 : d + out * 0.0125, (1.0 + 0.32) / 2, axis === 'x' ? d + out * 0.0125 : (p + q) / 2);
      ab(axis, (p + q) / 2, 0.255, d + out * 0.02, len, 0.13, 0.04, stoneC); } };
  lower('z', Z1, Z0, X1, 1); lower('z', Z1, Z0, X0, -1); lower('x', X0, X1, Z1, -1, [[BD[0], BD[1]]]);
  for (const [a, b] of [[X0 - 0.01, FD[0]], [FD[1], X1 + 0.01]]) box((a + b) / 2, 0.255, 0.02, b - a, 0.13, 0.04, stoneC);
  // Timber frame: corner and intermediate posts, head beam over the shopfront, rails at 1.0 and at the wall plate.
  const post = (x, z, y0 = BASE, y1 = EAVE) => box(x, (y0 + y1) / 2, z, 0.13, y1 - y0, 0.13, timber);
  for (const x of [X0 + 0.05, X1 - 0.05]) for (const z of [Z0 - 0.05, Z1 + 0.05]) post(x, z);
  for (const x of [-0.625, 0.625]) box(x, (BASE + 2.5) / 2, 0.012, 0.13, 2.5 - BASE, 0.05, timber);
  box(0, 2.44, 0.015, X1 - X0 + 0.04, 0.14, 0.06, timber); box(0, EAVE - 0.07, 0.015, X1 - X0 + 0.04, 0.14, 0.06, timber);
  for (const [x, o] of [[X0, -1], [X1, 1]]) {
    for (const z of [-1.85, -3.75]) box(x + o * 0.012, (BASE + EAVE) / 2, z, 0.05, EAVE - BASE, 0.12, timber);
    box(x + o * 0.015, 1.02, (Z0 + Z1) / 2, 0.06, 0.1, Z0 - Z1 + 0.06, timber); box(x + o * 0.015, EAVE - 0.07, (Z0 + Z1) / 2, 0.06, 0.14, Z0 - Z1 + 0.06, timber);
  }
  box(0, 1.02, Z1 - 0.015, X1 - X0 + 0.04, 0.1, 0.06, timber); box(0, EAVE - 0.07, Z1 - 0.015, X1 - X0 + 0.04, 0.14, 0.06, timber);
  for (const x of [-2.0, 1.0]) box(x, (1.07 + EAVE - 0.14) / 2, Z1 - 0.012, 0.12, EAVE - 0.14 - 1.07, 0.05, timber);
  // Floors: oiled planks in the shop, plain boards in the stock room.
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - PART), (IX1 - IX0) / 2, (IZ0 - PART) / 2), warm('#ffffff', 0.2, planks), 0, (F + BASE) / 2, (IZ0 + PART) / 2, false);
  box(0, (F + BASE) / 2, (PART + IZ1) / 2, IX1 - IX0, F - BASE, PART - IZ1, W('#8e7a64', 0.16), false);
  // Interior linings: warm plaster, dark wainscot rail.
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL], [FW, FD, FE], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL], [ER, ES], cream);
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL], [WL], cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL], [BD], cream);
  wall('x', PART, 0.1, [IX0, IX1, F, CEIL], [PD], cream);
  for (const x of [PD[0] + 0.03, PD[1] - 0.03]) box(x, (F + PD[3]) / 2, PART, 0.06, PD[3] - F, 0.14, woodD);
  box((PD[0] + PD[1]) / 2, PD[3] + 0.03, PART, PD[1] - PD[0] + 0.06, 0.06, 0.14, woodD);
  // A short indigo noren in the stock-room doorway.
  for (const k of [0, 1]) box(PD[0] + 0.2 + k * 0.36, PD[3] - 0.25, PART + 0.07, 0.34, 0.46, 0.01, W('#3f5a7a', 0.2));
  K.label('しおり', (PD[0] + PD[1]) / 2, PD[3] - 0.22, PART + 0.077, 0.3, 0.1, '#3f5a7a', '#efe6cf', 70);

  // ---- glazing: tea-brown wooden frames; lattice bars on the side windows ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = [], lattice = 0) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, timberL); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, timberL);
    ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, timberL); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, timberL);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.045, q - p, fd * 0.9, timberL);
    for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.04, fd * 0.9, timberL);
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    if (lattice) { const d = at + out * 0.09, n = Math.round((b - a) / lattice); for (let i = 1; i < n; i++) ab(axis, a + i * (b - a) / n, (p + q) / 2, d, 0.028, q - p, 0.03, timber);
      for (const y of [p + 0.03, q - 0.03]) ab(axis, (a + b) / 2, y, d, b - a, 0.04, 0.05, timber);
      const e = ab(axis, (a + b) / 2, q + 0.12, at + out * 0.18, b - a + 0.3, 0.04, 0.34, tileM); if (axis === 'x') e.rotation.x = out * 0.35; else e.rotation.z = -out * 0.35; }   // little eave over it
    else if (p > F + 0.05) ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.1, 0.05, 0.15, '#a8a091');
  }
  glaze('x', -T / 2, 1, FW, [-1.6], [1.95]);
  glaze('x', -T / 2, 1, FE, [1.58], [1.95]);
  glaze('z', X1 - T / 2, 1, ER, [], [], 0.08);
  glaze('z', X0 + T / 2, -1, WL, [], [], 0.08);
  glaze('z', X1 - T / 2, 1, ES, [], []);
  // Low board panel under the east shop window (outside).
  box((FE[0] + FE[1]) / 2, (0.32 + FE[2] - 0.05) / 2, 0.012, FE[1] - FE[0] - 0.04, FE[2] - 0.05 - 0.32, 0.02, timberL);
  // Front door: wooden sliding door with a lattice of small glass panes, brass pull; step-free ramp.
  ab('x', FD[0] + 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, timberL); ab('x', FD[1] - 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, timberL);
  box(0, FD[3] - 0.03, -T / 2, FD[1] - FD[0], 0.06, 0.16, timberL);
  {
    const z = -0.05, l = -0.44, r = 0.44, top = FD[3] - 0.06;
    for (const x of [l + 0.04, r - 0.04]) box(x, (F + top) / 2, z, 0.08, top - F, 0.045, timber);
    box(0, top - 0.04, z, r - l, 0.08, 0.045, timber); box(0, F + 0.2, z, r - l, 0.4, 0.045, timber);
    box(0, (F + 0.4 + top - 0.08) / 2, z, r - l - 0.16, top - 0.08 - F - 0.4, 0.012, glass, false);
    for (const x of [-0.18, 0, 0.18]) box(x, (F + 0.4 + top - 0.08) / 2, z + 0.01, 0.025, top - 0.08 - F - 0.4, 0.03, timber, false);
    for (const y of [1.15, 1.6, 2.0]) box(0, y, z + 0.01, r - l - 0.16, 0.025, 0.03, timber, false);
    box(0.36, 1.2, z + 0.03, 0.03, 0.2, 0.02, '#c9a35b');
    K.label('営業中', 0, 0.48, z + 0.03, 0.3, 0.1, '#efe6cf', '#6b2f2f', 70);
  }
  shapeMesh([[0, BASE], [0.48, BASE], [0.48, 0.212], [0, 0.298]], 1.0, '#a8a091', 0.5, 0, 0, -PI / 2);
  // Back door: plain timber door, small tiled eave, step, lamp.
  ab('x', BD[0] + 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, timber); ab('x', BD[1] - 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, timber);
  box((BD[0] + BD[1]) / 2, BD[3] - 0.03, Z1 + T / 2, BD[1] - BD[0], 0.06, 0.16, timber);
  box((BD[0] + BD[1]) / 2, (F + BD[3] - 0.06) / 2, Z1 + 0.06, BD[1] - BD[0] - 0.12, BD[3] - 0.06 - F, 0.04, timberL);
  for (const y of [0.8, 1.5]) box((BD[0] + BD[1]) / 2, y, Z1 + 0.035, BD[1] - BD[0] - 0.24, 0.02, 0.012, timber, false);
  box(BD[1] - 0.15, 1.15, Z1 + 0.02, 0.03, 0.16, 0.04, '#c9a35b');
  shapeMesh([[0, BASE], [0.3, BASE], [0.3, 0.3], [0, 0.3]], BD[1] - BD[0] + 0.1, '#a8a091', BD[0] - 0.05, 0, Z1, PI / 2);
  { const e = box((BD[0] + BD[1]) / 2, 2.42, Z1 - 0.2, 1.15, 0.05, 0.42, tileM); e.rotation.x = -0.3; }
  for (const x of [BD[0] - 0.05, BD[1] + 0.05]) box(x, 2.3, Z1 - 0.12, 0.05, 0.05, 0.26, timber);
  box(BD[1] + 0.25, 2.0, Z1 - 0.06, 0.12, 0.17, 0.1, '#3d4a58'); box(BD[1] + 0.25, 1.99, Z1 - 0.06, 0.09, 0.12, 0.105, bulb, false);
  mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.28), BD[1] + 0.25, 2.0, Z1 - 0.004, false).rotation.y = PI;

  // ================= front eave, display case, sign, lamps =================
  // Short tiled front eave (hisashi) on timber brackets across the shopfront.
  {
    const x0 = -2.88, x1 = 2.88, top = 2.7, low = 2.44, dep = 0.8, len = Math.hypot(dep, top - low);
    const g = tileUV(new THREE.BoxGeometry(x1 - x0, 0.06, len), (x1 - x0) / 2, len / 2), uv = g.attributes.uv;   // swapped below: channels down the slope
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), uv.getX(i));
    const e = mesh(g, tileM, 0, (top + low) / 2 + 0.03, dep / 2, true); e.rotation.x = Math.atan2(top - low, dep);
    box(0, low - 0.01, dep - 0.01, x1 - x0, 0.06, 0.05, timberL);   // fascia
    box(0, low + 0.03, dep + 0.01, x1 - x0, 0.07, 0.07, '#2f463f');   // eave tiles' end row
    for (const x of [-2.55, 0, 2.55]) { box(x, 2.48, dep * 0.45, 0.08, 0.08, dep * 0.9, timber); rod([x, 2.0, 0.02], [x, 2.44, dep * 0.75], 0.025, timber); }
  }
  // Closed glazed display case on the facade in front of the west window: books face out under the eave.
  {
    const x0 = -2.42, x1 = -0.78, z0 = 0.0, z1 = 0.42, y0 = 0.42, y1 = 1.52, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(cx, y0 - 0.06, cz, x1 - x0 + 0.06, 0.12, z1 - z0 + 0.04, timber);
    for (const x of [x0, x1]) box(x, (y0 + y1) / 2, cz, 0.05, y1 - y0, z1 - z0, timber);
    box(cx, y1 + 0.03, cz, x1 - x0 + 0.06, 0.06, z1 - z0 + 0.04, timber); box(cx, (y0 + y1) / 2, z0 + 0.02, x1 - x0, y1 - y0, 0.02, woodD);
    box(cx, (y0 + y1) / 2, z1 - 0.01, x1 - x0 - 0.06, y1 - y0 - 0.02, 0.012, glass, false);
    box(cx, y1 - 0.03, z1 - 0.06, x1 - x0 - 0.1, 0.02, 0.03, W('#fff1cf', 0.6), false);   // case light strip
    for (const [y, tilt] of [[y0 + 0.02, 0.25], [y0 + 0.55, 0.25]]) { box(cx, y, cz, x1 - x0 - 0.08, 0.02, z1 - z0 - 0.06, wood);
      for (let i = 0; i < 5; i++) { const b = mesh(tint(pick()), stackM, x0 + 0.2 + i * 0.31, y + 0.18, cz - 0.02, false); b.scale.set(0.22, 0.3, 0.03); b.rotation.x = -tilt;
        box(x0 + 0.2 + i * 0.31, y + 0.24, cz + 0.02, 0.12, 0.05, 0.004, W('#f1e4c8', 0.4), false).rotation.x = -tilt; } }
    K.label('稀覯本 · 初版', cx, y1 + 0.03, z1 + 0.025, 0.6, 0.05, '#5e4232', '#f1e4c8', 50);
  }
  // Book-shaped sign in the front gable, a bracket lamp above it.
  {
    const s = canvasTex(512, 220, (q, w, h) => { q.clearRect(0, 0, w, h); q.fillStyle = '#5e4232';
      q.beginPath(); q.moveTo(8, 30); q.quadraticCurveTo(w * 0.25, 4, w / 2 - 4, 28); q.lineTo(w / 2 + 4, 28); q.quadraticCurveTo(w * 0.75, 4, w - 8, 30); q.lineTo(w - 8, h - 14); q.quadraticCurveTo(w * 0.75, h - 36, w / 2 + 4, h - 10); q.lineTo(w / 2 - 4, h - 10); q.quadraticCurveTo(w * 0.25, h - 36, 8, h - 14); q.closePath(); q.fill();
      q.fillStyle = '#f1e4c8'; q.beginPath(); q.moveTo(22, 40); q.quadraticCurveTo(w * 0.25, 18, w / 2 - 6, 40); q.lineTo(w / 2 - 6, h - 26); q.quadraticCurveTo(w * 0.25, h - 46, 22, h - 26); q.closePath(); q.fill();
      q.beginPath(); q.moveTo(w - 22, 40); q.quadraticCurveTo(w * 0.75, 18, w / 2 + 6, 40); q.lineTo(w / 2 + 6, h - 26); q.quadraticCurveTo(w * 0.75, h - 46, w - 22, h - 26); q.closePath(); q.fill();
      q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillStyle = '#4a2f24'; q.font = 'bold 72px serif'; q.fillText('古書', w * 0.27, h / 2 + 4); q.font = 'bold 50px serif'; q.fillText('しおり堂', w * 0.735, h / 2 + 4, w * 0.4);
      q.fillStyle = '#7a3b34'; q.fillRect(w / 2 - 6, 26, 12, h * 0.8); q.beginPath(); q.moveTo(w / 2 - 6, 26 + h * 0.8); q.lineTo(w / 2, 20 + h * 0.86); q.lineTo(w / 2 + 6, 26 + h * 0.8); q.fill(); });
    const sm = new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, alphaTest: 0.5, emissive: '#4a3a28', emissiveMap: s });
    box(0, 3.72, 0.03, 0.08, 0.1, 0.06, timber);
    mesh(new THREE.PlaneGeometry(1.5, 0.64), sm, 0, 3.72, 0.07, false);
    const back = mesh(new THREE.PlaneGeometry(1.5, 0.64), new THREE.MeshToonMaterial({ color: '#5e4232', gradientMap: K.ramp, map: s, alphaTest: 0.5 }), 0, 3.72, 0.062, false); back.rotation.y = PI;
    rod([0, 4.28, 0.0], [0, 4.28, 0.36], 0.014, '#3d4a58'); rod([0, 4.12, 0.0], [0, 4.28, 0.2], 0.01, '#3d4a58'); rod([0, 4.28, 0.36], [0, 4.18, 0.36], 0.01, '#3d4a58');
    mesh(new THREE.ConeGeometry(0.13, 0.12, 12, 1, true), mat('#3d4a58'), 0, 4.12, 0.36, true); mesh(new THREE.SphereGeometry(0.04, 8, 6), bulb, 0, 4.07, 0.36, false);
    mesh(new THREE.PlaneGeometry(2.0, 1.1), additive(glowT, '#ffd9a0', 0.3), 0, 3.8, 0.1, false);
  }
  // Wall lantern east of the door under the eave.
  box(0.625, 2.05, 0.06, 0.12, 0.18, 0.1, '#3d4a58'); box(0.625, 2.04, 0.06, 0.09, 0.13, 0.105, bulb, false);
  mesh(new THREE.PlaneGeometry(0.8, 0.8), additive(glowT, '#ffc27e', 0.28), 0.625, 2.05, 0.04, false);

  // ================= gable roof (roof layer) =================
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('bookshop').add(roofLayer); K.setRoot(roofLayer);
  box(0, CEIL + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#e8dcc2', 0.34), false);   // ceiling boards
  for (let i = 1; i < 6; i++) box(0, CEIL - 0.01, IZ0 - i * (IZ0 - IZ1) / 6, IX1 - IX0, 0.03, 0.06, woodD, false);   // ceiling joists
  // Gable triangles (front and rear) above the wall plate, with a king post and a tie beam in timber.
  for (const [z, out] of [[-T, 1], [Z1, -1]]) {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(X0, EAVE), new THREE.Vector2(X1, EAVE), new THREE.Vector2(0, RIDGE)]), { depth: T, bevelEnabled: false }); tileUV(g, 0.5, 0.5);
    mesh(g, plaster, 0, 0, z);
    const zf = out > 0 ? 0.015 : Z1 - 0.015;
    box(0, (EAVE + RIDGE) / 2, zf, 0.12, RIDGE - EAVE, 0.05, timber);
    for (const s of [-1, 1]) { const b = box(s * X1 / 2, (EAVE + RIDGE) / 2 - 0.02, zf, Math.hypot(X1, RIDGE - EAVE), 0.11, 0.05, timber); b.rotation.z = -s * TH; }
  }
  // Roof planes: tiled slabs from the ridge to the side eaves, barge boards on both gables, ridge with end tiles.
  const L = (X1 + OVS) / Math.cos(TH) + 0.04, D = Z0 + OVF - (Z1 - OVR), cz = (Z0 + OVF + Z1 - OVR) / 2;
  for (const s of [-1, 1]) {
    const g = tileUV(new THREE.BoxGeometry(L, 0.12, D), L / 2, D / 2), uv = g.attributes.uv;
    const cx = s * (L / 2 - 0.04) * Math.cos(TH) + s * 0.06 * Math.sin(TH), cy = RIDGE - (L / 2 - 0.04) * Math.sin(TH) + 0.06 * Math.cos(TH);
    const r = mesh(g, tileM, cx, cy, cz); r.rotation.z = -s * TH;
    box(cx, cy - 0.02, cz, L, 0.1, D - 0.02, '#4a3a30', false).rotation.z = -s * TH;   // underside boards
    for (const zb of [Z0 + OVF + 0.02, Z1 - OVR - 0.02]) { const b = box(cx - s * 0.01, cy - 0.06, zb, L, 0.2, 0.05, timber); b.rotation.z = -s * TH; }
    // Eave line: tile end row and a half-round gutter.
    const ex = s * (X1 + OVS) , ey = EAVE - OVS * SL;
    box(ex, ey + 0.08, cz, 0.1, 0.1, D, '#2f463f');
    const gut = mesh(new THREE.CylinderGeometry(0.065, 0.065, D, 10, 1, true, 0, PI), mat('#8796a0'), ex + s * 0.02, ey - 0.02, cz); gut.rotation.x = PI / 2; gut.rotation.y = s < 0 ? PI : 0;
  }
  const RT = RIDGE + 0.12 / Math.cos(TH);
  box(0, RT + 0.06, cz, 0.24, 0.16, D + 0.04, '#2f463f'); cyl(0, RT + 0.16, cz, 0.07, 0.01, '#2f463f');
  { const rr = mesh(new THREE.CylinderGeometry(0.075, 0.075, D + 0.04, 10), mat('#3a564d'), 0, RT + 0.15, cz); rr.rotation.x = PI / 2; }
  for (const z of [Z0 + OVF + 0.04, Z1 - OVR - 0.04]) { box(0, RT + 0.18, z, 0.32, 0.3, 0.08, '#2f463f'); mesh(new THREE.CircleGeometry(0.09, 14), mat('#5a7a70'), 0, RT + 0.2, z + Math.sign(z) * 0.041, false).rotation.y = z > 0 ? 0 : PI; }
  group('bookshop');
  // Downpipes from the gutters: west at the front corner, east at the rear corner; chain-free, with splash blocks.
  for (const [x, z] of [[X0 - OVS + 0.05, -0.25], [X1 + OVS - 0.05, Z1 + 0.25]]) {
    const ey = EAVE - OVS * SL - 0.02, s = Math.sign(x);
    cyl(x, (ey + 0.3) / 2, z, 0.04, ey - 0.3, '#8796a0'); for (const y of [0.9, 2.0]) rod([x, y, z], [s * (X1 + 0.02), y, z], 0.012, '#5f6c76');
    box(x, 0.22, z, 0.2, 0.06, 0.2, '#a39d91');
  }
  // Meter boxes on the east wall, a vent on the west wall.
  box(X1 + 0.08, 1.55, -4.15, 0.16, 0.42, 0.3, '#cdd0c9'); box(X1 + 0.165, 1.63, -4.15, 0.01, 0.12, 0.18, '#7b8a92', false);
  line([[X1 + 0.06, 1.33, -4.15], [X1 + 0.06, 0.45, -4.15]], '#9aa3a6', 0.018);
  box(X0 - 0.03, 2.55, -4.8, 0.06, 0.28, 0.36, '#c4c7c0'); for (let i = 0; i < 4; i++) box(X0 - 0.065, 2.46 + i * 0.06, -4.8, 0.012, 0.012, 0.3, '#7f8b93', false);

  // ================= interior =================
  const pendant = (x, z, y) => { rod([x, CEIL, z], [x, y + 0.08, z], 0.006, '#3a3330'); mesh(new THREE.ConeGeometry(0.13, 0.15, 14, 1, true), W('#c9a774', 0.3), x, y + 0.07, z, true); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false); };
  // Walls of books: tall cases, low cases under the lattice windows.
  bookcase('z', -1.95, -0.65, IX0, 1, 2.15, 6); bookcase('z', -3.65, -1.95, IX0, 1, 0.98, 3); bookcase('z', -4.34, -3.65, IX0, 1, 2.15, 6);
  bookcase('z', -1.95, -0.65, IX1, -1, 2.15, 6); bookcase('z', -2.8, -1.95, IX1, -1, 0.98, 3);
  // A step stool by the west shelves.
  box(-2.05, F + 0.18, -1.3, 0.3, 0.03, 0.26, wood); box(-2.05, F + 0.38, -1.38, 0.3, 0.03, 0.14, wood); for (const x of [-2.18, -1.92]) box(x, F + 0.2, -1.33, 0.03, 0.4, 0.24, woodD);
  // Near layer: bargain bin behind the west glass (books on end, tops up) and a slanted magazine rack behind the east glass.
  {
    const x0 = -2.4, x1 = -0.85, z0 = -0.3, z1 = -0.78, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = 0.55;
    box(cx, F + h / 2, cz, x1 - x0, h, z0 - z1, wood); box(cx, F + h - 0.02, cz, x1 - x0 - 0.06, 0.02, z0 - z1 - 0.06, woodD, false);
    for (const z of [z0 - 0.12, cz, z1 + 0.12]) row('x', x0 + 0.05, x1 - 0.05, F + h - 0.03, z, 0.13, 0.2);
    K.label('均一 ¥100', cx, F + 0.3, z0 + 0.003, 0.5, 0.1, '#f1e4c8', '#7a3b34', 70);
  }
  {
    const x0 = 0.85, x1 = 2.2, cx = (x0 + x1) / 2, mags = canvasTex(512, 128, (q, w, h) => { for (let i = 0; i < 8; i++) { q.fillStyle = SPINE[(i * 5) % SPINE.length]; q.fillRect(i * 64 + 3, 4, 58, h - 8);
        q.fillStyle = 'rgba(245,236,214,.85)'; q.fillRect(i * 64 + 10, 12, 44, 14); q.fillStyle = `rgba(${i % 2 ? '240,200,140' : '200,220,230'},.8)`; q.fillRect(i * 64 + 12, 40, 40, 50); } });
    mags.wrapS = THREE.RepeatWrapping;
    for (const x of [x0 + 0.03, x1 - 0.03]) box(x, F + 0.65, -0.48, 0.04, 1.3, 0.36, woodD);
    for (let k = 0; k < 3; k++) { const y = F + 0.35 + k * 0.38, z = -0.42 - k * 0.06;
      const sh = box(cx, y, z, x1 - x0 - 0.06, 0.32, 0.02, wood); sh.rotation.x = -0.32;
      const g = new THREE.PlaneGeometry(x1 - x0 - 0.1, 0.27), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.75 + k * 0.33);
      const m = mesh(g, new THREE.MeshToonMaterial({ map: mags, gradientMap: K.ramp, emissive: new THREE.Color('#ffb36b').multiplyScalar(0.28), emissiveMap: mags }), cx, y + 0.01, z + 0.02, false); m.rotation.x = -0.32;
      box(cx, y - 0.15, z + 0.06, x1 - x0 - 0.06, 0.04, 0.02, woodD, false); }
    K.label('雑誌 · バックナンバー', cx, F + 1.42, -0.5, 0.7, 0.08, '#5e4232', '#f1e4c8', 50);
  }
  // Middle: two display tables of recommended books (flat stacks, a few standing, handwritten cards).
  for (const [z0, z1] of [[-1.3, -2.2], [-2.5, -3.4]]) {
    const x0 = -1.45, x1 = -0.65, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = F + 0.75;
    for (const x of [x0 + 0.04, x1 - 0.04]) for (const z of [z0 - 0.04, z1 + 0.04]) box(x, F + 0.36, z, 0.05, 0.72, 0.05, woodD);
    box(cx, top - 0.02, cz, x1 - x0, 0.04, z0 - z1, wood); box(cx, F + 0.12, cz, x1 - x0 - 0.08, 0.02, z0 - z1 - 0.08, woodD, false);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) stack(cx - 0.18 + i * 0.36, top, z0 - 0.15 - j * 0.3, 2 + Math.floor(rnd() * 4));
    for (let j = 0; j < 2; j++) { const b = mesh(tint(pick()), stackM, cx, top + 0.13, z0 - 0.3 - j * 0.3, false); b.scale.set(0.16, 0.24, 0.03); b.rotation.set(-0.2, PI / 2, 0); }
    for (let j = 0; j < 3; j++) { const c = box(cx + (j % 2 ? 0.18 : -0.18), top + 0.2, z0 - 0.18 - j * 0.28, 0.12, 0.08, 0.004, W('#f6eedc', 0.4), false); c.rotation.y = PI / 2; }
    rod([cx + 0.18, top, z0 - 0.18], [cx + 0.18, top + 0.17, z0 - 0.18], 0.004, woodD);
  }
  pendant(-1.05, -1.75, F + 2.0); pendant(-1.05, -2.95, F + 2.0); pendant(0.3, -1.0, F + 2.1);
  // East: register counter facing the aisle, with a green-shaded reading lamp; packing table behind against the wall.
  {
    const x0 = 1.2, x1 = 1.72, z0 = -2.9, z1 = -4.05, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = F + 0.95;
    box(cx, F + 0.45, cz, x1 - x0, 0.9, z0 - z1, wood); box(cx, top - 0.025, cz, x1 - x0 + 0.06, 0.05, z0 - z1 + 0.04, woodD);
    for (let i = 1; i < 5; i++) box(x0 - 0.003, F + 0.45, z0 - i * (z0 - z1) / 5, 0.012, 0.8, 0.015, woodD, false);
    box(cx + 0.05, top + 0.07, -3.1, 0.3, 0.14, 0.28, W('#5a4a3c', 0.14)); box(cx - 0.05, top + 0.15, -3.1, 0.14, 0.04, 0.24, W('#2f2a26', 0.08), false);   // old register
    stack(cx, top, -3.5, 7, 0.2, 0.26);
    // Reading lamp: brass stem, green glass shade, steady warm light on the counter.
    const lx = cx + 0.08, lz = -3.82;
    box(lx, top + 0.015, lz, 0.16, 0.03, 0.12, W('#b08a4a', 0.3)); rod([lx, top + 0.03, lz], [lx, top + 0.26, lz], 0.01, W('#b08a4a', 0.3));
    const shade = mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.08, 12, 1, true, 0, PI), W('#3f6e55', 0.45), lx, top + 0.29, lz, true); shade.rotation.z = PI / 2; shade.rotation.y = PI / 2;
    box(lx, top + 0.27, lz, 0.02, 0.012, 0.14, bulb, false);
    decal(0.7, 0.7, lx, top + 0.004, lz, [0, -1], additive(glowT, '#ffd28e', 0.4));
    mesh(new THREE.SphereGeometry(0.12, 10, 6), additive(glowT, '#ffd28e', 0.3), lx, top + 0.27, lz, false);
    K.label('お会計', x0 - 0.002, F + 0.75, cz, 0.3, 0.08, '#f1e4c8', '#5e4232', 70).rotation.y = -PI / 2;
  }
  {
    const x0 = 2.18, x1 = IX1, z0 = -2.9, z1 = -4.3, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = F + 0.85;
    box(cx, F + 0.42, cz, x1 - x0, 0.84, z0 - z1, woodD); box(cx, top - 0.02, cz, x1 - x0 + 0.02, 0.04, z0 - z1, wood);
    const roll = cyl(cx, top + 0.08, -3.05, 0.06, 0.32, paperW); roll.rotation.x = PI / 2;
    box(cx, top + 0.003, -3.45, 0.3, 0.004, 0.4, paperW, false); for (let i = 0; i < 3; i++) box(cx, top + 0.03 + i * 0.045, -3.95, 0.2, 0.04, 0.26, paperW, false);
    cyl(cx - 0.05, top + 0.04, -3.65, 0.04, 0.06, W('#e8dcc2', 0.3));   // string
    for (let i = 0; i < 2; i++) box(IX1 - 0.12, F + 1.5 + i * 0.4, cz, 0.24, 0.025, 1.2, wood);
    for (let i = 0; i < 2; i++) row('z', z0 - 0.1, z1 + 0.1, F + 1.51 + i * 0.4, IX1 - 0.12, 0.18, 0.24);
  }
  // Stationery drawer cabinet against the partition (west): a grid of small drawers, pens and notebooks on top.
  {
    const x0 = -2.2, x1 = -0.95, z = PART + 0.05 + 0.17, h = 1.05, cx = (x0 + x1) / 2;
    box(cx, F + h / 2, z, x1 - x0, h, 0.34, woodD);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) { const x = x0 + 0.1 + c * 0.21, y = F + 0.12 + r * 0.19;
      box(x, y, z + 0.171, 0.19, 0.17, 0.01, wood, false); box(x, y, z + 0.18, 0.04, 0.015, 0.01, W('#c9a35b', 0.3), false); box(x, y + 0.05, z + 0.177, 0.08, 0.025, 0.004, W('#f1e4c8', 0.4), false); }
    for (let i = 0; i < 4; i++) stack(x0 + 0.2 + i * 0.27, F + h, z, 2, 0.15, 0.2);
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 10), W('#3f5a7a', 0.25), x1 - 0.12, F + h + 0.05, z, false);
    for (let i = 0; i < 5; i++) rod([x1 - 0.12 + (i - 2) * 0.012, F + h + 0.05, z], [x1 - 0.12 + (i - 2) * 0.02, F + h + 0.2, z + 0.01], 0.005, W(SPINE[i], 0.3));
    K.label('文具 · 便箋', cx, F + h + 0.25, PART + 0.052, 0.5, 0.1, '#5e4232', '#f1e4c8', 64);
  }
  // Calendar print and clock on the partition between the cabinet and the stock-room door.
  box(0.2, F + 1.7, PART + 0.054, 0.5, 0.66, 0.006, W('#efe6cf', 0.36), false); box(0.2, F + 1.85, PART + 0.058, 0.4, 0.26, 0.004, W('#8aa0a8', 0.3), false);
  mesh(new THREE.CircleGeometry(0.12, 16), W('#f4efe2', 0.4), 0.2, F + 2.35, PART + 0.056, false);
  for (const [x, z, r] of [[-0.1, -1.0, 1.7], [-1.05, -1.75, 1.3], [-1.05, -2.95, 1.3], [0.4, -2.6, 1.4], [1.45, -3.5, 1.0]]) decal(r, r, x, F + 0.003, z, [0, -1], pool);
  // Stock room: cabinets with doors along the rear wall (east of the back door), cartons, a hand truck.
  {
    for (let i = 0; i < 3; i++) { const x = 0.0 + i * 0.8, z = IZ1 + 0.21;
      box(x + 0.4, F + 0.95, z, 0.78, 1.9, 0.42, woodD); for (const k of [-1, 1]) box(x + 0.4 + k * 0.19, F + 0.95, z + 0.212, 0.36, 1.8, 0.01, wood, false);
      box(x + 0.4, F + 1.5, z + 0.22, 0.03, 0.12, 0.02, W('#c9a35b', 0.3), false); }
    for (const [x, z, n] of [[-2.25, -4.75, 3], [-2.25, -5.2, 2], [-1.85, -5.2, 1]]) for (let i = 0; i < n; i++) box(x, F + 0.15 + i * 0.3, z, 0.38, 0.29, 0.36, paperW);
    decal(1.2, 1.0, 0.6, F + 0.003, -4.95, [0, -1], additive(glowT, '#f4f2e6', 0.18));
  }
  group('bookshop');

  // ================= forecourt and attachments =================
  group('bookFrontW');
  // Bargain-book wagon on castors at the forecourt, a pot of bamboo at the west corner.
  {
    const x0 = -2.0, x1 = -1.15, z0 = 0.95, z1 = 1.45, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (const x of [x0 + 0.04, x1 - 0.04]) for (const z of [z0 + 0.04, z1 - 0.04]) { box(x, 0.19 + 0.3, z, 0.04, 0.5, 0.04, timber); cyl(x, 0.19 + 0.04, z, 0.04, 0.03, '#2f2a26'); }
    box(cx, 0.19 + 0.6, cz, x1 - x0, 0.22, z1 - z0, timberL); box(cx, 0.19 + 0.13, cz, x1 - x0 - 0.06, 0.02, z1 - z0 - 0.06, timber);
    for (const z of [z0 + 0.12, cz, z1 - 0.12]) row('x', x0 + 0.05, x1 - 0.05, 0.19 + 0.55, z, 0.12, 0.2, bookO);
    const g = new THREE.Group(); g.position.set(cx, 0.19 + 0.75, z1 + 0.005); K.setRoot(g); K.label('一冊 ¥100', 0, 0, 0, 0.5, 0.09, '#f1e4c8', '#7a3b34', 70); group('bookFrontW').add(g);
  }
  pot(-2.55, 0.19, 0.7, 0.16, 7, 2.2, '#7d6a5a'); for (let i = 0; i < 3; i++) rod([-2.55 + (i - 1) * 0.04, 0.4, 0.7], [-2.55 + (i - 1) * 0.07, 1.2 + i * 0.12, 0.7 + (i - 1) * 0.03], 0.012, '#7a8f5a');
  group('bookFrontE');
  // Umbrella stand by the door, chalk A-board, a pot at the east corner.
  {
    const x = 0.85, z = 0.38;
    mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.46, 12, 1, true), mat('#6b5a4a'), x, 0.19 + 0.23, z); mesh(new THREE.TorusGeometry(0.14, 0.014, 4, 14), mat('#3d4a58'), x, 0.19 + 0.46, z).rotation.x = PI / 2;
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.5, ux = x + Math.cos(a) * 0.05, uz = z + Math.sin(a) * 0.05; mesh(new THREE.ConeGeometry(0.05, 0.55, 7), mat(['#3f5a7a', '#7a3b34', '#3d4a58'][i]), ux, 0.19 + 0.6, uz); rod([ux, 0.19 + 0.86, uz], [ux, 0.19 + 0.98, uz], 0.01, '#6b4a32'); }
  }
  {
    const board = chalk(256, 320, [['古書', 46, 44, 'serif'], ['買取いたします', 120, 26], ['文庫 · 全集 · 絵本', 170, 22, 'sans-serif', '#f0c987'], ['今週の一冊', 232, 24], ['「雨の日の本」', 272, 24, 'serif', '#c7d0a0']]);
    const g = new THREE.Group(); g.position.set(1.6, 0.19, 1.2); g.rotation.y = 0.15; K.setRoot(g);
    for (const s of [-1, 1]) { const p = new THREE.Group(); p.rotation.x = -s * 0.2; g.add(p);
      box(0, 0.47, s * 0.2, 0.5, 0.9, 0.025, timberL, true, p); mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshBasicMaterial({ map: board, color: '#c9c3b6' }), 0, 0.54, s * 0.2 + s * 0.015, false, p).rotation.y = s > 0 ? 0 : PI; }
    group('bookFrontE').add(g);
  }
  pot(2.45, 0.19, 0.55, 0.15, 6, 1.4, '#7d6a5a');
  group('bookSideW');
  // Pots along the west wall below the lattice window.
  pot(X0 - 0.28, 0.19, -2.3, 0.14, 5, 1.2); pot(X0 - 0.28, 0.19, -2.75, 0.11, 4, 1, '#8f9aa0'); pot(X0 - 0.28, 0.19, -3.2, 0.13, 5, 1.4, '#7d6a5a');
  group('bookUtility');
  // AC outdoor unit on a stand behind the shop (rear centre), its pipe cover up the wall.
  box(0.45, 0.19 + 0.045, Z1 - 0.28, 0.82, 0.09, 0.3, '#7f8b93');
  box(0.45, 0.19 + 0.38, Z1 - 0.28, 0.8, 0.58, 0.3, '#d6d8d2'); mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), 0.33, 0.57, Z1 - 0.432, false).rotation.y = PI;
  for (let i = 0; i < 4; i++) box(0.33, 0.45 + i * 0.08, Z1 - 0.434, 0.38, 0.012, 0.01, '#9aa6ab', false);
  box(0.75, 1.4, Z1 - 0.06, 0.1, 1.5, 0.1, '#e1ddd2');
  group('bookService');
  // Fenced bin yard at the rear east: board fence with a gate, sorted bins, bundled paper for recycling.
  {
    const x0 = 1.25, x1 = 2.75, z0 = Z1 - 0.1, z1 = Z1 - 1.3, h = 1.35;
    for (let i = 0; i <= 9; i++) box(x0 + i * (x1 - x0) / 9, 0.19 + h / 2, z1, 0.12, h, 0.025, '#6f5240');
    for (let i = 0; i <= 7; i++) box(x1, 0.19 + h / 2, z1 + i * (z0 - z1) / 7, 0.025, h, 0.12, '#6f5240');
    for (const y of [0.4, 1.3]) { box((x0 + x1) / 2, y, z1 + 0.02, x1 - x0, 0.06, 0.03, timber); box(x1 - 0.02, y, (z0 + z1) / 2, 0.03, 0.06, z0 - z1, timber); }
    for (const [x, c] of [[1.55, '#5f8a74'], [2.0, '#4f7290']]) { box(x, 0.19 + 0.33, z1 + 0.42, 0.4, 0.66, 0.46, c); box(x, 0.19 + 0.68, z1 + 0.42, 0.44, 0.05, 0.5, c); }
    for (let i = 0; i < 3; i++) box(2.42, 0.19 + 0.06 + i * 0.12, z0 - 0.35, 0.34, 0.11, 0.26, '#d8c9a8');   // tied paper bundles
    rod([2.25, 0.19 + 0.36, z0 - 0.35], [2.6, 0.19 + 0.36, z0 - 0.35], 0.006, '#c9b07a');
  }
  group('bookGround');
  // Forecourt pavers to the sidewalk, rear path, west side strip; entrance mat; window light on the wet ground.
  const paveMat = warm('#ffffff', 0, pavers);
  const pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-3.6, 3.6, 0, 1.9); pave(-2.9, 1.2, -6.8, -5.6); pave(-3.5, -2.7, -5.6, 0);
  box(0, 0.214, 0.75, 0.92, 0.014, 0.5, '#5d5248', false); box(0, 0.222, 0.75, 0.74, 0.004, 0.36, '#7a6a58', false);
  const spill = additive(spillT, '#ffbf7a', 0.24);
  decal(1.9, 1.4, (FW[0] + FW[1]) / 2, 0.208, 0.95, [0, -1], spill); decal(0.9, 1.2, 0, 0.226, 1.0, [0, -1], spill); decal(1.8, 1.4, (FE[0] + FE[1]) / 2, 0.208, 0.85, [0, -1], spill);
  decal(1.4, 0.8, X0 - 0.45, 0.2, (WL[0] + WL[1]) / 2, [1, 0], additive(spillT, '#ffbf7a', 0.14)); decal(1.4, 0.8, X1 + 0.45, 0.2, (ER[0] + ER[1]) / 2, [-1, 0], additive(spillT, '#ffbf7a', 0.14));
  decal(1.2, 0.9, (BD[0] + BD[1]) / 2, 0.208, Z1 - 0.45, [0, 1], additive(glowT, '#ffc27e', 0.2));

  // ================= local animation: window rain, eave drips, a faint reflection on the wet forecourt =================
  const fx = new THREE.Group(); fx.userData.live = true; group('bookshop').add(fx); K.setRoot(fx);
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6);
  for (const [w, n] of [[FE, 10], [[FW[0], FW[1], 1.6, FW[3]], 7]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 0.8, -0.066, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 6; i++) runs.add(-1.55 - rnd() * 0.75, 0.6 + rnd() * 0.8, 0.418, 0.06, 0.48, 1.45, 0.07 + rnd() * 0.04);   // display case glass
  for (let i = 0; i < 14; i++) drips.add(-2.75 + i * 0.4 + rnd() * 0.12, 0.25 + rnd() * 2, 0.83, 0.09, 0.25, 2.38, 2.1 + rnd() * 0.5);
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) drips.add(s * (X1 + OVS + 0.04), 0.25 + rnd() * 2.4, -0.3 - i * 0.68 - rnd() * 0.2, 0.09, 0.25, 2.88, 2.1 + rnd() * 0.5);
  runs.seal(); drips.seal();
  // Reflection of the lit shopfront in the wet paving: vertical light streaks that waver slowly (UV drift, opacity).
  const refT = tex(256, 64, (q, w, h) => { q.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = rnd() * w, ww = 2 + rnd() * 8, g = q.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(255,220,160,${0.4 + rnd() * 0.5})`); g.addColorStop(1, 'rgba(255,220,160,0)'); q.fillStyle = g; q.fillRect(x, 0, ww, h * (0.5 + rnd() * 0.5)); } });
  const refM = new THREE.MeshBasicMaterial({ map: refT, color: '#ffd8a0', transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 });
  // On the ground group (static geometry, so the measured building stays inside its envelope); only the material moves.
  group('bookGround'); decal(4.6, 1.0, -0.2, 0.209, 1.32, [0, -1], refM); group('bookshop');
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt);
      refT.offset.x = 0.012 * Math.sin(t * 0.6); refM.opacity = 0.15 + 0.05 * Math.sin(t * 0.9) * Math.sin(t * 0.37);
    },
  };
};
