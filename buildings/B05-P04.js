// B05-P04 はなや しずく (Shizuku Flowers): a one-storey neighbourhood florist on the main street.
// Task card docs/buildings/tasks/B05-P04.md, reference docs/buildings/references/B05-P04.jpg.
// Local frame (placed by layout.js `buildings`): front +z faces the street (world N), -x is the viewer's
// left = world E; door centre at the origin, floor top at rec.floor. Body 5.5 × 6.0: x -2.75…2.75, z -6…0 (awning to +0.78, rear canopy to -6.42: inside the 7.5 buildable depth).
// Groups: florist (shell, interior, roof, awning, hanging sign, baskets) · florFrontE / florFrontW (outdoor flower
// stands, A-board, trellis, crates) · florSideE (east plant shelf) · florUtility (west AC unit, potted tree)
// · florRear (plant rack, tap and hose reel) · florService (1.5 × 1.2 bin yard) · florGround (forecourt, rear path,
// yard pad, mat, window light on the wet ground). Plan: stepped flower displays behind both windows, tiered plant
// shelf on the east wall, cut-flower bucket island, centre aisle to the sink; wrapping and register counter on
// the west with the ribbon and paper rack behind it; cold flower case and sink against the partition, back room
// (stock shelves, back door) behind it.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B05-P04'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(5404), PI = Math.PI;
  const F = rec.floor, X0 = -2.75, X1 = 2.75, Z0 = 0, Z1 = -6.0, T = 0.15, BASE = 0.19, EAVE = 3.35, CEIL = 3.05, PART = -4.45;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T;
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FW1 = [-2.45, -0.72, 0.72, 2.42], FD = [-0.5, 0.5, F, 2.42], FW2 = [0.72, 2.45, 0.72, 2.42];
  const EW = [-3.4, -2.2, 1.5, 2.25], WW = [-3.35, -2.15, 1.62, 2.25], RD = [1.5, 2.35, F, 2.32], DOOR2 = [1.45, 2.3, F, 2.42];

  // ---- shared materials and textures ----
  const sage = mat('#b0b58f'), skirting = '#8d8a80', frame = '#b08458', frameL = '#c9a274', canvasC = '#eee3c6', trim = '#5e6268', fascia = '#86603f', metal = '#85888a';
  const W = (c, k = 0.3) => warm(c, k);
  const wood = W('#c0925f'), woodD = W('#7f5b40', 0.26), cream = W('#f2e7cf', 0.34), wains = W('#d2b48c', 0.28), zinc = W('#b3bbb9', 0.22),
    steel = W('#bcc3c2', 0.22), stone = W('#ece4d4', 0.32), stem = W('#5f8a58', 0.2), terra = W('#c47f5c', 0.3);
  const stemO = mat('#5c7f63');
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' }), coolPanel = new THREE.MeshBasicMaterial({ color: '#eef3ea' });
  const PAL = ['#f2a7b5', '#f7d27a', '#f6f0e6', '#c7a7dc', '#f29d7a', '#e86f7d', '#fbe3c4'];
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  // Warm terracotta-and-cream floor tiles in the shop.
  const tiles = tex(256, 256, (q, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { q.fillStyle = `hsl(${28 + rnd() * 8},${36 + rnd() * 10}%,${(i + j) % 2 ? 74 : 64 + rnd() * 4}%)`; q.fillRect(i * 64, j * 64, 64, 64); }
    q.strokeStyle = 'rgba(96,74,58,.55)'; q.lineWidth = 2.5; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); }
    for (let i = 0; i < 500; i++) { q.fillStyle = `rgba(90,60,40,${0.03 + rnd() * 0.05})`; q.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 1); } });
  const pavers = tex(256, 256, (q, w, h) => { q.fillStyle = '#a7a396'; q.fillRect(0, 0, w, h); for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) {
      q.fillStyle = `rgba(${rnd() < 0.5 ? '70,78,92' : '250,246,236'},${0.05 + rnd() * 0.08})`; q.fillRect(i * 86 + (r % 2) * 43 - 43 + 2, r * 64 + 2, 82, 60); q.fillRect(i * 86 + (r % 2) * 43 + 215, r * 64 + 2, 82, 60); }
    q.strokeStyle = 'rgba(48,56,66,.45)'; q.lineWidth = 2; for (let r = 0; r <= 4; r++) { q.beginPath(); q.moveTo(0, r * 64); q.lineTo(w, r * 64); q.stroke(); }
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) { const x = i * 86 + (r % 2) * 43; q.beginPath(); q.moveTo(x, r * 64); q.lineTo(x, r * 64 + 64); q.stroke(); }
    for (let i = 0; i < 900; i++) { q.fillStyle = `rgba(40,48,60,${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1); } });
  const glowT = canvasTex(128, 128, (q, w) => { const g = q.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.33)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, w); });
  // Window light thrown onto the ground: bright at the glass edge (canvas top), fading outwards and at the sides.
  const spillT = canvasTex(128, 128, (q, w, h) => { const g = q.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, h);
    q.globalCompositeOperation = 'destination-in'; const s = q.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.18, 'rgba(0,0,0,1)'); s.addColorStop(0.82, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = s; q.fillRect(0, 0, w, h); });
  const additive = (map, c, o) => new THREE.MeshBasicMaterial({ map, color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const pool = additive(glowT, '#ffc988', 0.28);
  // Flat decal lying on a surface; its canvas-top edge points along `heading` (local x, z).
  const decal = (w, h, x, y, z, heading, m, parent) => { const a = mesh(new THREE.PlaneGeometry(w, h), m, x, y, z, false, parent); a.rotation.set(-PI / 2, Math.atan2(-heading[0], -heading[1]), 0, 'YXZ'); return a; };
  // Box along a wall: u runs along the wall, d is the depth coordinate across it.
  const ab = (axis, u, y, d, w, h, t, c, o = true, p) => axis === 'x' ? box(u, y, d, w, h, t, c, o, p) : box(d, y, u, t, h, w, c, o, p);
  const shapeMesh = (pts, depth, c, x, y, z, ry) => { const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 }); const m = mesh(g, c, x, y, z); m.rotation.y = ry; return m; };
  // Five-petal flower mark used on the sign, the awning valance and the A-board.
  const flowerIcon = (q, cx, cy, s, petal, heart) => { q.fillStyle = petal; for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * 2 * PI / 5; q.beginPath(); q.ellipse(cx + Math.cos(a) * s * 0.3, cy + Math.sin(a) * s * 0.3, s * 0.24, s * 0.17, a, 0, 2 * PI); q.fill(); }
    q.fillStyle = heart; q.beginPath(); q.arc(cx, cy, s * 0.14, 0, 2 * PI); q.fill(); };
  const sprig = (q, x, y, s, c) => { q.strokeStyle = q.fillStyle = c; q.lineWidth = s * 0.06; q.lineCap = 'round'; q.beginPath(); q.moveTo(x - s * 0.5, y + s * 0.15); q.quadraticCurveTo(x, y - s * 0.1, x + s * 0.5, y - s * 0.05); q.stroke();
    for (let i = 0; i < 4; i++) { const u = x - s * 0.35 + i * s * 0.25, v = y + s * 0.05 - i * s * 0.04; for (const k of [-1, 1]) { q.beginPath(); q.ellipse(u + s * 0.05, v + k * s * 0.09, s * 0.1, s * 0.045, k * 0.6, 0, 2 * PI); q.fill(); } } };
  const chalk = (w, h, lines, bg = '#33403a') => canvasTex(w, h, (q, W2, H2) => { q.fillStyle = bg; q.fillRect(0, 0, W2, H2); q.textAlign = 'center'; q.textBaseline = 'middle';
    for (const [t, y, size, font = 'sans-serif', col] of lines) { q.fillStyle = col || '#efe9da'; q.font = `bold ${size}px ${font}`; q.fillText(t, W2 / 2, y); } return q; });

  // ---- plants and flowers: shared unit geometry, scaled per use ----
  const bloomG = new THREE.OctahedronGeometry(1, 0), leafG = new THREE.SphereGeometry(1, 5, 4);   // low-poly: blooms are 3–5 cm, leaves 5–20 cm
  // Every bloom and leaf colour sits on one small palette texture, so all foliage bakes into one mesh per group
  // (warm inside, plain toon outside): each unit geometry is tinted by pointing all its UVs at one palette cell.
  const LEAF = ['#6f9a6c', '#8db27c'], LEAFO = ['#6c9476', '#88a98a'], ATL = [...PAL, ...LEAF, ...LEAFO];
  const atlas = canvasTex(64, 4, q => ATL.forEach((c, i) => { q.fillStyle = c; q.fillRect(i * 4, 0, 4, 4); }));
  atlas.magFilter = atlas.minFilter = THREE.NearestFilter; atlas.generateMipmaps = false;
  const plantW = new THREE.MeshToonMaterial({ map: atlas, gradientMap: K.ramp, emissive: new THREE.Color('#ffb36b').multiplyScalar(0.3), emissiveMap: atlas }), plantO = new THREE.MeshToonMaterial({ map: atlas, gradientMap: K.ramp });
  const tinted = {}, tint = (g, c) => { const k = g.uuid + c; if (!tinted[k]) { const q = g.clone(), uv = q.attributes.uv, u = (ATL.indexOf(c) + 0.5) / 16; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, 0.5); tinted[k] = q; } return tinted[k]; };
  const leaf = (ext, alt, x, y, z, s, parent) => blob(tint(leafG, (ext ? LEAFO : LEAF)[alt ? 1 : 0]), ext ? plantO : plantW, x, y, z, s, s, parent);
  // Straight thin rod between two points (cords, chains, hangers): a 5-sided open cylinder instead of a 32-step tube.
  const rod = (a, b, r, c, parent) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 5, 1, true), typeof c === 'string' ? mat(c) : c, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, false, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  const blob = (g, m, x, y, z, s, sy = s, parent) => { const a = mesh(g, m, x, y, z, false, parent); a.scale.set(s, sy, s); return a; };
  const blooms = (x, y, z, r, n, M, cols = PAL, parent) => { const c0 = Math.floor(rnd() * cols.length);
    for (let i = 0; i < n; i++) { const a = rnd() * 2 * PI, d = Math.sqrt(rnd()) * r; blob(tint(bloomG, cols[(c0 + (i % 2)) % cols.length]), M === mat ? plantO : plantW, x + Math.cos(a) * d, y + rnd() * 0.06, z + Math.sin(a) * d, 0.042 + rnd() * 0.016, undefined, parent); } };
  // Zinc bucket of cut flowers: bucket, stem bundle, a little foliage, blooms on top.
  const bucket = (x, y, z, r, h, M = W, cols) => { const ext = M === mat;
    mesh(new THREE.CylinderGeometry(r, r * 0.82, h, 10), ext ? mat('#9aa3a3') : zinc, x, y + h / 2, z);
    mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.45, 0.24, 7), ext ? stemO : stem, x, y + h + 0.1, z, false);
    for (let i = 0; i < 2; i++) leaf(ext, i, x + (rnd() - 0.5) * r, y + h + 0.12, z + (rnd() - 0.5) * r, r * 0.5);
    blooms(x, y + h + 0.22, z, r * 1.05, 8, M, cols); };
  // Potted plant: tapered terracotta pot and a leafy crown.
  const potted = (x, y, z, r, M = W, n = 5, hi = 1) => { const ext = M === mat;
    mesh(new THREE.CylinderGeometry(r, r * 0.74, r * 1.15, 10), ext ? mat('#b9806a') : terra, x, y + r * 0.575, z);
    for (let i = 0; i < n; i++) leaf(ext, i % 2, x + (rnd() - 0.5) * r * 1.3, y + r * 1.25 + rnd() * r * hi, z + (rnd() - 0.5) * r * 1.3, r * (0.55 + rnd() * 0.25)); };
  const floweringPot = (x, y, z, r, M = W) => { potted(x, y, z, r, M, 4, 0.6); blooms(x, y + r * 1.75, z, r * 0.8, 5, M); };

  // ================= shell =================
  group('florist');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, EAVE], [FW1, FD, FW2], sage);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, EAVE], [RD], sage);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, EAVE], [EW], sage);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, EAVE], [WW], sage);
  // Stone base course; wooden fascia band under the roof edge.
  for (const [a, b] of [[X0 - 0.01, FD[0]], [FD[1], X1 + 0.01]]) box((a + b) / 2, 0.305, 0.006, b - a, 0.23, 0.03, skirting);
  for (const [a, b] of [[X0 - 0.01, RD[0]], [RD[1], X1 + 0.01]]) box((a + b) / 2, 0.305, Z1 - 0.006, b - a, 0.23, 0.03, skirting);
  for (const x of [X0 - 0.006, X1 + 0.006]) box(x, 0.305, (Z0 + Z1) / 2, 0.03, 0.23, Z0 - Z1 + 0.04, skirting);
  box(0, EAVE - 0.09, 0.012, X1 - X0 + 0.04, 0.16, 0.035, fascia); box(0, EAVE - 0.09, Z1 - 0.012, X1 - X0 + 0.04, 0.16, 0.035, fascia);
  for (const x of [X0 - 0.012, X1 + 0.012]) box(x, EAVE - 0.09, (Z0 + Z1) / 2, 0.035, 0.16, Z0 - Z1 + 0.06, fascia);
  // Floors: warm tiles in the shop, grey concrete in the back room.
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - PART), (IX1 - IX0) / 1.2, (IZ0 - PART) / 1.2), warm('#ffffff', 0.2, tiles), 0, (F + BASE) / 2, (IZ0 + PART) / 2, false);
  box(0, (F + BASE) / 2, (PART + IZ1) / 2, IX1 - IX0, F - BASE, PART - IZ1, W('#b4b8b0', 0.16), false);
  // Roof layer (ceiling, slab, parapet, skylight, rooftop plant): batched on its own so review cutaways can lift it off.
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('florist').add(roofLayer);
  box(0, CEIL + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#f5ebd6', 0.38), false, roofLayer);
  box(0, CEIL - 0.005, -2.4, 0.9, 0.012, 0.7, new THREE.MeshBasicMaterial({ color: '#ffe8c0' }), false, roofLayer);   // skylight well, lit
  // Interior linings: warm plaster above a pale-wood wainscot.
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL], [FW1, FD, FW2], cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL], [RD], W('#e5e4da', 0.2));
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL], [EW], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL], [WW], cream);
  panel('x', IZ0 - 0.016, 0.012, [IX0, IX1, F, 0.95], [FW1, FD, FW2], wains);
  panel('z', IX0 + 0.016, 0.012, [PART, IZ0, F, 0.95], [], wains);
  panel('z', IX1 - 0.016, 0.012, [PART, IZ0, F, 0.95], [], wains);
  // Partition between shop and back room, staff doorway on the west with a sage noren.
  box((IX0 + DOOR2[0]) / 2, (F + CEIL) / 2, PART, DOOR2[0] - IX0, CEIL - F, 0.12, cream);
  box((DOOR2[1] + IX1) / 2, (F + CEIL) / 2, PART, IX1 - DOOR2[1], CEIL - F, 0.12, cream);
  box((DOOR2[0] + DOOR2[1]) / 2, (DOOR2[3] + CEIL) / 2, PART, DOOR2[1] - DOOR2[0], CEIL - DOOR2[3], 0.12, cream);
  for (const x of [DOOR2[0] + 0.03, DOOR2[1] - 0.03]) box(x, (F + DOOR2[3]) / 2, PART, 0.06, DOOR2[3] - F, 0.16, woodD);
  box((DOOR2[0] + DOOR2[1]) / 2, DOOR2[3] + 0.03, PART, DOOR2[1] - DOOR2[0] + 0.06, 0.06, 0.16, woodD);
  for (const k of [0, 1]) box(DOOR2[0] + 0.22 + k * 0.41, 2.08, PART + 0.09, 0.39, 0.6, 0.012, W('#7f9c78', 0.22));
  panel('x', PART + 0.066, 0.012, [IX0, IX1, F, 0.95], [DOOR2], wains);

  // ---- windows and doors: light-wood frames, real mullions, one glass pane per light ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = [], mun = []) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, frame); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, frame);
    ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, frame); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, frame);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.05, q - p, fd * 0.9, frame);
    for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.05, fd * 0.9, frame);
    for (const u of mun) ab(axis, u, (tran[0] + q) / 2, at, 0.03, q - tran[0], fd * 0.7, frameL);   // small panes in the transom band
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    if (p > F + 0.05) ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.12, 0.05, 0.16, '#cfc6b4');   // stone sill
  }
  glaze('x', -T / 2, 1, FW1, [-1.585], [2.0], [-2.15, -1.87, -1.3, -1.02]);
  glaze('x', -T / 2, 1, FW2, [1.585], [2.0], [1.02, 1.3, 1.87, 2.15]);
  glaze('z', X0 + T / 2, -1, EW, [-2.8]);
  glaze('z', X1 - T / 2, 1, WW, [-2.75]);
  // Wooden panel under the shop windows (outside), as on the reference front.
  for (const w of [FW1, FW2]) { box((w[0] + w[1]) / 2, (0.34 + w[2] - 0.05) / 2, 0.012, w[1] - w[0] - 0.08, w[2] - 0.05 - 0.34, 0.02, frame);
    box((w[0] + w[1]) / 2, (0.34 + w[2] - 0.05) / 2, 0.025, w[1] - w[0] - 0.3, w[2] - 0.05 - 0.48, 0.012, frameL, false); }
  // Front door: light-wood leaf with a six-light glass panel and a brass pull; step-free ramp to the forecourt.
  ab('x', FD[0] + 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, frame); ab('x', FD[1] - 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, frame);
  box(0, FD[3] - 0.03, -T / 2, FD[1] - FD[0], 0.06, 0.16, frame);
  {
    const z = -0.05, l = -0.44, r = 0.44, top = FD[3] - 0.06;
    for (const x of [l + 0.05, r - 0.05]) box(x, (F + top) / 2, z, 0.1, top - F, 0.045, frame);
    box(0, top - 0.05, z, r - l, 0.1, 0.045, frame); box(0, F + 0.2, z, r - l, 0.4, 0.045, frame);
    box(0, (F + 0.4 + top - 0.1) / 2, z, r - l - 0.2, top - 0.1 - F - 0.4, 0.012, glass, false);
    box(0, (F + 0.4 + top - 0.1) / 2, z, 0.03, top - 0.1 - F - 0.4, 0.035, frameL, false);
    for (const y of [1.25, 1.75]) box(0, y, z, r - l - 0.2, 0.03, 0.035, frameL, false);
    box(0.32, 1.22, z + 0.05, 0.03, 0.42, 0.03, '#c9a35b'); box(0.32, 1.22, z - 0.05, 0.03, 0.42, 0.03, W('#c9a35b', 0.2));
    K.label('OPEN', 0, 0.48, z + 0.03, 0.3, 0.1, '#f0e6cf', '#5d7356', 70);
  }
  shapeMesh([[0, BASE], [0.48, BASE], [0.48, 0.212], [0, 0.298]], 1.0, '#b9b1a1', 0.5, 0, 0, -PI / 2);   // threshold ramp
  // Back door: painted steel leaf with a small wired-glass light.
  ab('x', RD[0] + 0.03, (F + RD[3]) / 2, Z1 + T / 2, 0.06, RD[3] - F, 0.16, frame); ab('x', RD[1] - 0.03, (F + RD[3]) / 2, Z1 + T / 2, 0.06, RD[3] - F, 0.16, frame);
  box((RD[0] + RD[1]) / 2, RD[3] - 0.03, Z1 + T / 2, RD[1] - RD[0], 0.06, 0.16, frame);
  box((RD[0] + RD[1]) / 2, (F + RD[3] - 0.06) / 2, Z1 + 0.06, RD[1] - RD[0] - 0.12, RD[3] - 0.06 - F, 0.04, '#7f8481');
  box((RD[0] + RD[1]) / 2, 1.85, Z1 + 0.035, 0.28, 0.34, 0.012, glass, false);
  box(RD[0] + 0.15, 1.2, Z1 + 0.02, 0.05, 0.14, 0.04, '#c9cfcc');
  shapeMesh([[0, BASE], [0.3, BASE], [0.3, 0.3], [0, 0.3]], RD[1] - RD[0], '#b9b1a1', RD[0], 0, Z1, PI / 2);   // back step

  // ================= awning, sign, lamps, roof =================
  // Short cream canvas awning across the front, valance printed with the shop name, iron arms.
  {
    const ax0 = -2.65, ax1 = 2.65, top = 2.95, low = 2.7, dep = 0.75, len = Math.hypot(dep, top - low), cx = (ax0 + ax1) / 2;
    const c = box(cx, (top + low) / 2, dep / 2, ax1 - ax0, 0.035, len, canvasC); c.rotation.x = Math.atan2(top - low, dep);
    box(cx, 2.6, dep + 0.005, ax1 - ax0, 0.22, 0.025, canvasC);
    const val = canvasTex(2048, 90, (q, w, h) => { q.fillStyle = '#eee3c6'; q.fillRect(0, 0, w, h); q.fillStyle = '#7d9474'; q.fillRect(0, 5, w, 3); q.fillRect(0, h - 8, w, 3);
      q.font = 'bold 56px sans-serif'; q.textBaseline = 'middle'; q.textAlign = 'center'; q.fillStyle = '#5d7356'; q.fillText('はなや しずく', w * 0.45, h / 2 + 2);
      flowerIcon(q, w * 0.6, h / 2, 56, '#e6a3ad', '#f0c96a'); q.font = 'bold 30px sans-serif'; q.fillStyle = '#5d7356'; q.fillText('FLOWERS & GREEN', w * 0.8, h / 2 + 2);
      sprig(q, w * 0.16, h / 2, 90, '#7d9474'); sprig(q, w * 0.93, h / 2, 70, '#7d9474'); });
    mesh(new THREE.PlaneGeometry(ax1 - ax0 - 0.02, 0.2), new THREE.MeshToonMaterial({ map: val, gradientMap: K.ramp }), cx, 2.6, dep + 0.019, false);
    for (const x of [ax0, ax1]) shapeMesh([[0, top], [dep, low], [dep, 2.49], [0, 2.76]], 0.02, canvasC, x + (x === ax0 ? 0.02 : 0), 0, 0, -PI / 2);
    for (const x of [ax0 + 0.12, ax1 - 0.12]) line([[x, 2.3, 0.01], [x, 2.5, 0.42], [x, 2.66, dep - 0.04]], '#3d4a58', 0.016);
  }
  // Round hanging sign with the flower mark, projecting east from the front corner.
  {
    const s = canvasTex(256, 256, (q, w) => { q.fillStyle = '#86603f'; q.beginPath(); q.arc(w / 2, w / 2, w / 2 - 2, 0, 2 * PI); q.fill(); q.fillStyle = '#f3ead4'; q.beginPath(); q.arc(w / 2, w / 2, w / 2 - 16, 0, 2 * PI); q.fill();
      flowerIcon(q, w / 2, w / 2 - 12, 120, '#e6a3ad', '#f0c96a'); sprig(q, w / 2, w * 0.7, 70, '#6f8a66'); q.font = 'bold 30px sans-serif'; q.textAlign = 'center'; q.fillStyle = '#5d7356'; q.fillText('しずく', w / 2, w * 0.87); });
    rod([X0, 2.72, -0.3], [X0 - 0.62, 2.72, -0.3], 0.016, '#3d4a58'); box(X0 - 0.01, 2.72, -0.3, 0.03, 0.12, 0.08, '#3d4a58');
    rod([X0, 2.48, -0.3], [X0 - 0.3, 2.72, -0.3], 0.01, '#3d4a58');
    for (const x of [X0 - 0.22, X0 - 0.5]) rod([x, 2.72, -0.3], [x, 2.6, -0.3], 0.006, '#3d4a58');
    cyl(X0 - 0.36, 2.36, -0.3, 0.25, 0.03, fascia).rotation.z = PI / 2;
    for (const k of [-1, 1]) { const d = mesh(new THREE.CircleGeometry(0.23, 32), new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, emissive: '#3a3020' }), X0 - 0.36 + k * 0.017, 2.36, -0.3, false); d.rotation.y = k * PI / 2; }
  }
  // Wall lanterns: west of the front door and beside the back door (emissive heads, soft halo on the wall).
  for (const [x, z, d] of [[0.61, Z0, 1], [1.22, Z1, -1]]) {
    box(x, 2.12, z + d * 0.04, 0.06, 0.12, 0.08, '#3d4a58'); box(x, 2.12, z + d * 0.12, 0.12, 0.19, 0.12, '#3d4a58');
    box(x, 2.11, z + d * 0.12, 0.09, 0.14, 0.125, bulb, false);
    const h = mesh(new THREE.PlaneGeometry(1.0, 1.0), additive(glowT, '#ffc27e', 0.3), x, 2.12, z + d * 0.004, false); if (d < 0) h.rotation.y = PI;
  }
  // Steel canopy over the back door.
  box((RD[0] + RD[1]) / 2, 2.55, Z1 - 0.2, 1.15, 0.05, 0.4, trim);
  for (const x of [RD[0] - 0.05, RD[1] + 0.05]) rod([x, 2.25, Z1], [x, 2.53, Z1 - 0.37], 0.014, '#3d4a58');
  // Flat roof: slab, parapet with dark coping, membrane, lit skylight, condenser on rails, vents, chimney stub.
  K.setRoot(roofLayer);
  box(0, (EAVE + 3.5) / 2, (Z0 + Z1) / 2, X1 - X0 + 0.1, 3.5 - EAVE, Z0 - Z1 + 0.1, '#9aa0a2');
  {
    const w = X1 - X0 + 0.1, d = Z0 - Z1 + 0.1, cz = (Z0 + Z1) / 2;
    for (const z of [Z0 + 0.05 - 0.07, Z1 - 0.05 + 0.07]) { box(0, 3.63, z, w, 0.26, 0.14, sage); box(0, 3.785, z, w + 0.04, 0.05, 0.2, trim); }
    for (const x of [X0 - 0.05 + 0.07, X1 + 0.05 - 0.07]) { box(x, 3.63, cz, 0.14, 0.26, d - 0.28, sage); box(x, 3.785, cz, 0.2, 0.05, d - 0.2, trim); }
    box(0, 3.51, cz, w - 0.28, 0.02, d - 0.28, '#6f7377', false);
    for (let i = 1; i < 5; i++) box(0, 3.522, Z0 - i * 1.2, w - 0.3, 0.004, 0.02, '#5d6266', false);   // membrane seams
  }
  // Skylight over the shop: curb, frame, glass, warm light below.
  box(0, 3.58, -2.4, 1.1, 0.14, 0.9, '#a7adae');
  for (const z of [-1.97, -2.83]) box(0, 3.67, z, 1.14, 0.04, 0.08, trim);
  for (const x of [-0.53, 0.53]) box(x, 3.67, -2.4, 0.08, 0.04, 0.78, trim);
  box(0, 3.656, -2.4, 0.98, 0.008, 0.78, new THREE.MeshBasicMaterial({ color: '#ffd9a0' }), false); box(0, 3.685, -2.4, 0.98, 0.01, 0.78, glass, false);
  box(0, 3.69, -2.4, 0.03, 0.02, 0.78, trim, false);
  // Condenser on rails at the rear-west corner, its pipe run to the parapet.
  for (const z of [-4.78, -5.22]) box(1.75, 3.56, z, 0.92, 0.06, 0.07, metal);
  box(1.75, 3.88, -5.0, 0.84, 0.58, 0.36, '#c6cbc6');
  mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), 1.65, 3.88, -4.818, false);
  for (let i = 0; i < 3; i++) box(1.65, 3.8 + i * 0.08, -4.815, 0.38, 0.012, 0.01, '#9aa6ab', false);
  box(2.05, 3.88, -4.818, 0.12, 0.42, 0.01, '#9aa6ab', false);
  line([[2.17, 3.7, -5.0], [2.5, 3.7, -5.0], [2.5, 3.6, -4.6], [2.5, 3.6, -3.9]], '#8f9aa0', 0.03);
  cyl(-1.55, 3.78, -4.7, 0.06, 0.52, '#a9b1b2'); cyl(-1.55, 4.06, -4.7, 0.11, 0.05, metal);
  cyl(-1.05, 3.7, -5.2, 0.045, 0.36, '#a9b1b2');
  box(-2.15, 3.72, -0.65, 0.32, 0.42, 0.32, '#8a6a52'); box(-2.15, 3.95, -0.65, 0.38, 0.05, 0.38, trim);   // flue stub
  group('florist');
  // Downpipes: west front corner (from a parapet scupper) and the east rear corner, each into a splash block.
  for (const [x, z, sx] of [[X1 + 0.07, -0.42, 1], [X0 - 0.07, Z1 + 0.42, -1]]) {
    box(x - sx * 0.05, 3.56, z, 0.14, 0.08, 0.12, metal);
    cyl(x, (3.52 + 0.3) / 2, z, 0.04, 3.22, '#8796a0'); for (const y of [0.9, 2.0, 3.0]) box(x - sx * 0.03, y, z, 0.07, 0.03, 0.1, '#5f6c76');
    box(x + sx * 0.04, 0.22, z, 0.22, 0.06, 0.18, '#a39d91');
  }
  // West wall: meter box with conduit, louvred vent; east wall: vent; rear wall: louvred vent.
  box(X1 + 0.08, 1.5, -3.85, 0.16, 0.42, 0.3, '#cdd0c9'); box(X1 + 0.165, 1.58, -3.85, 0.01, 0.12, 0.18, '#7b8a92', false);
  line([[X1 + 0.06, 1.28, -3.85], [X1 + 0.06, 0.45, -3.85], [X1 + 0.03, 0.4, -3.85]], '#9aa3a6', 0.018);
  for (const [x, z, s] of [[X1 + 0.03, -1.0, 1], [X0 - 0.03, -5.0, -1]]) { box(x, 2.6, z, 0.06, 0.28, 0.36, '#c4c7c0'); for (let i = 0; i < 4; i++) box(x + s * 0.035, 2.5 + i * 0.065, z, 0.012, 0.012, 0.3, '#7f8b93', false); }
  box(-0.4, 2.62, Z1 - 0.03, 0.4, 0.3, 0.06, '#c4c7c0'); for (let i = 0; i < 5; i++) box(-0.4, 2.51 + i * 0.055, Z1 - 0.065, 0.34, 0.012, 0.012, '#7f8b93', false);
  // Window box under the east window.
  box(X0 - 0.13, EW[2] - 0.13, (EW[0] + EW[1]) / 2, 0.22, 0.16, EW[1] - EW[0], frame);
  for (let i = 0; i < 6; i++) leaf(true, i % 2, X0 - 0.14, EW[2] - 0.02 + rnd() * 0.05, EW[0] + 0.12 + i * 0.19, 0.09);
  blooms(X0 - 0.14, EW[2] + 0.06, (EW[0] + EW[1]) / 2, 0.45, 9, mat, ['#f2a7b5', '#f6f0e6', '#c7a7dc']);

  // ================= interior =================
  const pendant = (x, z, y, parent) => { rod([x, CEIL, z], [x, y + 0.08, z], 0.006, '#3a3330', parent); mesh(new THREE.ConeGeometry(0.13, 0.14, 14), W('#c39a62', 0.25), x, y + 0.07, z, true, parent); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false, parent); };
  // Near layer: stepped flower displays behind both shop windows (rising inwards, so the street sees every step).
  for (const [x0, x1] of [[-2.42, -0.86], [0.86, 2.42]]) {
    const cx = (x0 + x1) / 2, w = x1 - x0;
    for (const [z, h] of [[-0.36, 0.22], [-0.64, 0.42], [-0.92, 0.62]]) { box(cx, F + h / 2, z, w, h, 0.28, wood); box(cx, F + h - 0.01, z + 0.135, w, 0.02, 0.02, woodD, false); }
    for (let i = 0; i < 4; i++) { const x = x0 + 0.2 + i * (w - 0.4) / 3; floweringPot(x, F + 0.22, -0.36, 0.09); }
    for (let i = 0; i < 3; i++) bucket(x0 + 0.3 + i * (w - 0.6) / 2, F + 0.42, -0.64, 0.11, 0.24);
    for (let i = 0; i < 3; i++) potted(x0 + 0.3 + i * (w - 0.6) / 2, F + 0.62, -0.92, 0.12, W, 6, 1.4);
  }
  pendant(-1.64, -0.75, F + 2.0); pendant(1.64, -0.75, F + 2.0);
  // East wall: tall tiered plant shelf (four boards on ladder frames).
  {
    const x = -2.42, z0 = -1.25, z1 = -3.6;
    for (const z of [z0, (z0 + z1) / 2, z1]) { box(x, F + 0.8, z, 0.34, 1.6, 0.04, woodD); }
    for (const [y, d] of [[0.3, 0.34], [0.72, 0.3], [1.12, 0.26], [1.5, 0.22]]) {
      box(x + (0.34 - d) / 2, F + y, (z0 + z1) / 2, d, 0.03, z0 - z1 + 0.04, wood);
      for (let i = 0; i < 5; i++) { const z = z0 - 0.22 - i * 0.475, xx = x + (0.34 - d) / 2; (i + Math.round(y * 10)) % 3 ? potted(xx, F + y + 0.015, z, 0.075 + d * 0.12) : floweringPot(xx, F + y + 0.015, z, 0.08); }
    }
  }
  // Middle: cut-flower bucket island, three tiers stepping up towards the east shelf.
  {
    const x0 = -1.6, x1 = -0.72, z0 = -1.75, z1 = -3.25, cz = (z0 + z1) / 2;
    box((x0 + x1) / 2, F + 0.12, cz, x1 - x0, 0.24, z0 - z1, woodD);
    box(x0 + 0.3, F + 0.36, cz, 0.6, 0.24, z0 - z1 - 0.1, wood);
    box(x0 + 0.15, F + 0.6, cz, 0.3, 0.24, z0 - z1 - 0.2, wood);
    for (let i = 0; i < 4; i++) bucket(x1 - 0.14, F + 0.24, z0 - 0.2 - i * 0.37, 0.12, 0.26);
    for (let i = 0; i < 4; i++) bucket(x0 + 0.42, F + 0.48, z0 - 0.22 - i * 0.35, 0.11, 0.26);
    for (let i = 0; i < 3; i++) bucket(x0 + 0.15, F + 0.72, z0 - 0.35 - i * 0.4, 0.1, 0.28);
    K.label('季節の花', x1 + 0.006, F + 0.13, cz, 0.5, 0.12, '#f3ead4', '#5d7356', 80).rotation.y = PI / 2;
  }
  pendant(-1.15, -2.5, F + 1.95);
  // West: wrapping and register counter facing the aisle, pale wood with board panelling.
  {
    const x0 = 0.95, x1 = 1.55, z0 = -1.8, z1 = -3.5, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = F + 0.95;
    box(cx, F + 0.45, cz, x1 - x0, 0.9, z0 - z1, wood); box(cx, top - 0.025, cz, x1 - x0 + 0.06, 0.05, z0 - z1 + 0.06, stone);
    for (let i = 1; i < 6; i++) box(x0 - 0.003, F + 0.45, z0 - i * (z0 - z1) / 6, 0.012, 0.8, 0.015, woodD, false);
    box(x0 - 0.005, F + 0.06, cz, 0.012, 0.12, z0 - z1, woodD, false);
    // Register at the front end, kraft paper sheet and a half-wrapped bouquet in the middle, ribbon spools, tape.
    box(cx + 0.05, top + 0.05, -2.05, 0.3, 0.1, 0.26, W('#3c4146', 0.1)); const scr = box(cx - 0.02, top + 0.15, -2.05, 0.02, 0.12, 0.2, W('#a9cfc0', 0.5)); scr.rotation.z = -0.35;
    box(cx, top + 0.003, -2.75, 0.5, 0.004, 0.62, W('#cfa677', 0.34), false);
    const cone = mesh(new THREE.ConeGeometry(0.11, 0.4, 10, 1, true), W('#d9b88c', 0.34), cx - 0.02, top + 0.09, -2.72, false); cone.rotation.x = PI / 2;
    blooms(cx - 0.02, top + 0.1, -2.5, 0.08, 6, W);
    for (let i = 0; i < 3; i++) { const sp = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12), W(['#e48f9c', '#f2d27e', '#a8c5a0'][i], 0.36), cx + 0.15, top + 0.025, -3.1 - i * 0.11, false); }
    box(cx - 0.1, top + 0.04, -3.3, 0.12, 0.08, 0.06, W('#6b7d84', 0.15));
    potted(cx + 0.12, top, -1.9, 0.05, W, 3, 0.5);
  }
  // Work lamp over the wrapping table (its halo breathes slowly, below in the effects group).
  pendant(1.25, -2.72, F + 1.62);
  // Ribbon and paper-roll rack on the west wall behind the counter: two rows of wrapping rolls, a rod of ribbon spools.
  {
    const x = 2.47, z0 = -1.85, z1 = -3.55, cz = (z0 + z1) / 2;
    for (const z of [z0, z1]) box(x, F + 0.7, z, 0.26, 1.4, 0.04, woodD);
    box(x, F + 0.06, cz, 0.26, 0.04, z0 - z1, woodD); box(x, F + 1.38, cz, 0.28, 0.04, z0 - z1 + 0.04, wood);
    const rolls = ['#c8a579', '#e7b7c0', '#a9c3a0', '#efe6d2', '#a9bfd6', '#d9c2e0'];
    for (const [y, k] of [[F + 0.42, 0], [F + 0.8, 3]]) {
      cyl(x, y, cz, 0.012, z0 - z1 - 0.04, woodD).rotation.x = PI / 2;
      for (let i = 0; i < 3; i++) { const r = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.48, 14), W(rolls[(i + k) % 6], 0.34), x, y, z0 - 0.32 - i * 0.53, true); r.rotation.x = PI / 2; }
    }
    cyl(x - 0.03, F + 1.15, cz, 0.008, z0 - z1 - 0.04, woodD).rotation.x = PI / 2;
    for (let i = 0; i < 9; i++) { const sp = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), W(['#e48f9c', '#f2d27e', '#a8c5a0', '#c7a7dc', '#f6f0e6', '#e86f7d'][i % 6], 0.36), x - 0.03, F + 1.15, z0 - 0.14 - i * 0.18, false); sp.rotation.x = PI / 2; }
    // Kraft sheet hanging off the lower roll towards the floor.
    box(x - 0.08, F + 0.24, z0 - 0.32, 0.004, 0.34, 0.44, W('#c8a579', 0.34), false);
  }
  // Light pools: on the floor of the aisle and in front of the displays; the counter's pool breathes (effects group).
  for (const [x, z, r] of [[0, -1.6, 1.8], [-1.15, -2.5, 1.3], [0, -3.4, 1.3], [-1.64, -0.75, 1.0], [1.64, -0.75, 1.0]]) decal(r, r, x, F + 0.003, z, [0, -1], pool);
  // Rear layer against the partition: refrigerated flower case (east) and the work sink (on the aisle axis).
  {
    const x0 = -2.58, x1 = -1.05, z0 = -3.8, z1 = PART - 0.065, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = 2.0;
    box(cx, F + h / 2, z1 + 0.03, x1 - x0, h, 0.06, steel);
    for (const x of [x0 + 0.03, x1 - 0.03, cx]) box(x, F + h / 2, cz, 0.06, h, z0 - z1, steel);
    box(cx, F + h - 0.06, cz, x1 - x0, 0.12, z0 - z1, steel); box(cx, F + 0.08, cz, x1 - x0, 0.16, z0 - z1, steel);
    box(cx, F + h - 0.18, z1 + 0.065, x1 - x0 - 0.12, 0.012, 0.012, coolPanel, false);
    box(cx, F + 1.0, z1 + 0.064, x1 - x0 - 0.1, 1.7, 0.006, W('#e3ece6', 0.3), false);
    for (const y of [F + 0.75, F + 1.3]) box(cx, y, cz, x1 - x0 - 0.1, 0.02, z0 - z1 - 0.06, W('#dfe6e3', 0.25), false);
    for (const [y, n] of [[F + 0.16, 3], [F + 0.77, 3], [F + 1.32, 4]]) for (let i = 0; i < n; i++) bucket(x0 + 0.24 + i * (x1 - x0 - 0.48) / (n - 1), y, cz, n > 3 ? 0.07 : 0.09, n > 3 ? 0.16 : 0.22);
    for (const [a, b] of [[x0 + 0.06, cx], [cx, x1 - 0.06]]) box((a + b) / 2, F + h / 2, z0 + 0.01, b - a - 0.02, h - 0.3, 0.012, glass, false);
    for (const x of [cx - 0.07, cx + 0.07]) box(x, F + 1.05, z0 + 0.03, 0.025, 0.5, 0.03, W('#d4d9d7', 0.2), false);
    K.label('冷蔵 · FRESH', cx, F + h - 0.06, z0 - 0.002, 0.7, 0.1, '#dfe9e3', '#4f6b6a', 70);
  }
  {
    const x0 = -0.85, x1 = 0.85, z0 = -3.86, z1 = PART - 0.065, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = F + 0.9;
    box(cx, F + 0.42, cz, x1 - x0, 0.84, z0 - z1, W('#a7b6a8', 0.24)); box(cx, top - 0.03, cz, x1 - x0 + 0.04, 0.06, z0 - z1 + 0.04, steel);
    for (const x of [-0.4, 0.4]) { box(x, top - 0.005, cz + 0.02, 0.62, 0.006, 0.36, W('#55606a', 0.08), false); box(x, F + 0.42, z0 - 0.005, 0.7, 0.7, 0.012, W('#b7c4b5', 0.24), false); }
    line([[0, top, z1 + 0.06], [0, top + 0.32, z1 + 0.06], [0, top + 0.36, z1 + 0.16], [0, top + 0.26, z1 + 0.26]], '#b9c0c2', 0.014);
    // Shelf of glass vases and a pegboard of tools above the sink.
    box(cx, F + 1.55, z1 + 0.11, x1 - x0, 0.03, 0.2, wood);
    for (let i = 0; i < 7; i++) mesh(new THREE.CylinderGeometry(0.045 + (i % 3) * 0.01, 0.035, 0.16 + (i % 2) * 0.08, 10), W(i % 3 ? '#cfe3df' : '#e8d7b8', 0.3), -0.72 + i * 0.24, F + 1.65 + (i % 2) * 0.04, z1 + 0.1, false);
    box(cx, F + 2.0, z1 + 0.01, 1.2, 0.5, 0.012, W('#c9a982', 0.3), false);
    for (let i = 0; i < 4; i++) box(-0.42 + i * 0.28, F + 2.0, z1 + 0.03, 0.04, 0.22, 0.02, W('#6b7d84', 0.15), false);
    for (const x of [-0.45, 0.45]) bucket(x, F, z0 - 0.02, 0.1, 0.24);   // stock buckets in front of the cabinet doors
  }
  // Back room: steel stock shelving, buckets, boxes of floral foam, broom; cool ceiling panel.
  {
    const x0 = -2.55, x1 = -0.55, z = -5.62, cx = (x0 + x1) / 2;
    for (const x of [x0 + 0.02, x1 - 0.02]) for (const dz of [-0.18, 0.18]) box(x, F + 0.95, z + dz, 0.03, 1.9, 0.03, steel);
    for (const y of [0.12, 0.6, 1.1, 1.6]) { box(cx, F + y, z, x1 - x0, 0.025, 0.4, steel, false);
      for (let i = 0; i < 5; i++) { const k = (i + Math.round(y * 10)) % 3, xx = x0 + 0.22 + i * 0.39;
        if (k === 0) box(xx, F + y + 0.1, z, 0.3, 0.18, 0.3, W('#c8a579', 0.3), false);
        else if (k === 1) mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.2, 10), W('#cfe3df', 0.28), xx, F + y + 0.11, z, false);
        else box(xx, F + y + 0.06, z, 0.3, 0.1, 0.24, W('#7fae7a', 0.3), false); } }
    for (let i = 0; i < 3; i++) bucket(0.0 + i * 0.32, F, -5.55, 0.12, 0.3);
    rod([1.25, F + 0.02, -5.8], [1.3, F + 1.4, -5.78], 0.014, '#9a7a58'); box(1.25, F + 0.08, -5.78, 0.24, 0.1, 0.06, W('#6f8a66', 0.2));
    box(0.4, CEIL - 0.02, -5.2, 0.9, 0.03, 0.3, coolPanel, false);
  }
  group('florist');

  // ================= forecourt and attachments =================
  // Outdoor stand: two-tier slatted rack under the awning, pots on top and buckets below.
  const stand = (x0, x1) => { const cx = (x0 + x1) / 2, w = x1 - x0;
    for (const x of [x0 + 0.03, x1 - 0.03]) for (const z of [0.12, 0.56]) box(x, 0.19 + 0.3, z, 0.05, 0.6, 0.05, '#8d6a4c');
    box(cx, 0.19 + 0.26, 0.34, w, 0.03, 0.5, '#a57d58'); box(cx, 0.19 + 0.58, 0.24, w, 0.03, 0.28, '#a57d58');
    for (let i = 0; i < 3; i++) bucket(x0 + 0.25 + i * (w - 0.5) / 2, 0.19 + 0.275, 0.42, 0.11, 0.22, mat);
    for (let i = 0; i < 4; i++) { const x = x0 + 0.18 + i * (w - 0.36) / 3; i % 2 ? floweringPot(x, 0.19 + 0.595, 0.24, 0.085, mat) : potted(x, 0.19 + 0.595, 0.24, 0.085, mat, 5, 1); }
    for (let i = 0; i < 2; i++) potted(x0 + 0.35 + i * (w - 0.7), 0.19, 0.22 + 0.02, 0.1, mat, 4, 0.8); };
  group('florFrontE');
  stand(-2.35, -0.85);
  // Chalk A-board at the forecourt edge.
  {
    const board = chalk(256, 320, [['Flowers', 52, 46, 'serif'], ['季節の花束', 236, 28], ['ミニブーケ ¥800', 282, 24, 'sans-serif', '#f0c987']]);
    const ctx = board.image.getContext('2d'); flowerIcon(ctx, 128, 148, 110, '#e8b7bf', '#f0c96a'); sprig(ctx, 128, 196, 80, '#9fc29a'); board.needsUpdate = true;
    const g = new THREE.Group(); g.position.set(-2.3, 0.19, 1.35); g.rotation.y = -0.15; K.setRoot(g);
    for (const s of [-1, 1]) { const p = new THREE.Group(); p.rotation.x = -s * 0.2; g.add(p);   // two leaves leaning together: an A-frame
      box(0, 0.47, s * 0.2, 0.5, 0.9, 0.025, frame, true, p); mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshBasicMaterial({ map: board, color: '#c9c3b6' }), 0, 0.54, s * 0.2 + s * 0.015, false, p).rotation.y = s > 0 ? 0 : PI; }
    group('florFrontE').add(g);
  }
  // Cedar trellis on the east wall with a climbing rose in a planter box.
  {
    const x = X0 - 0.06, z0 = -0.85, z1 = -1.75, y0 = 0.6, y1 = 2.45;
    for (const z of [z0, (z0 + z1) / 2, z1]) box(x, (y0 + y1) / 2, z, 0.03, y1 - y0, 0.035, '#8d6a4c');
    for (let i = 0; i < 6; i++) box(x - 0.02, y0 + 0.15 + i * 0.32, (z0 + z1) / 2, 0.025, 0.03, z0 - z1, '#8d6a4c');
    box(X0 - 0.22, 0.19 + 0.2, (z0 + z1) / 2, 0.32, 0.4, 1.0, '#9b8f80'); box(X0 - 0.22, 0.6, (z0 + z1) / 2, 0.36, 0.03, 1.04, '#7b7166');
    for (let i = 0; i < 16; i++) { const y = 0.7 + rnd() * 1.75, z = z0 - 0.05 - rnd() * 0.8; leaf(true, !(i % 3), X0 - 0.14 - rnd() * 0.06, y, z, 0.1 + rnd() * 0.06); }
    blooms(X0 - 0.2, 1.6, (z0 + z1) / 2, 0.42, 10, mat, ['#f2a7b5', '#e86f7d']); blooms(X0 - 0.2, 2.15, (z0 + z1) / 2, 0.3, 6, mat, ['#f2a7b5', '#f6f0e6']);
  }
  group('florFrontW');
  stand(0.85, 2.35);
  // Crates of seedlings and two large pots at the west front corner.
  for (const [z, y] of [[-0.78, 0.19], [-0.78, 0.47], [-1.24, 0.19]]) { box(X1 + 0.32, y + 0.13, z, 0.42, 0.26, 0.4, '#a57d58'); for (let i = 0; i < 4; i++) leaf(true, i % 2, X1 + 0.22 + (i % 2) * 0.2, y + 0.28, z - 0.09 + Math.floor(i / 2) * 0.18, 0.08); }
  blooms(X1 + 0.32, 0.79, -0.78, 0.14, 5, mat, ['#f7d27a', '#f6f0e6']);
  potted(X1 + 0.3, 0.19, -1.8, 0.17, mat, 7, 1.6);
  group('florSideE');
  // Three-tier plant shelf against the east wall towards the rear.
  {
    const x = X0 - 0.24, z0 = -4.2, z1 = -5.35, cz = (z0 + z1) / 2;
    for (const z of [z0, z1]) for (const dx of [-0.17, 0.17]) box(x + dx, 0.19 + 0.55, z, 0.04, 1.1, 0.04, '#8d6a4c');
    for (const y of [0.3, 0.68, 1.06]) { box(x, 0.19 + y, cz, 0.4, 0.03, z0 - z1, '#a57d58');
      for (let i = 0; i < 3; i++) (i + Math.round(y * 10)) % 2 ? floweringPot(x, 0.19 + y + 0.015, z0 - 0.2 - i * 0.37, 0.09, mat) : potted(x, 0.19 + y + 0.015, z0 - 0.2 - i * 0.37, 0.09, mat, 5, 1); }
    potted(x, 0.19, cz, 0.12, mat, 5, 1);
  }
  group('florUtility');
  // Split-type AC outdoor unit on the west side with its insulated pipe cover; potted olive at the rear-west corner.
  box(X1 + 0.18, 0.5, -4.95, 0.3, 0.58, 0.8, '#d6d8d2'); for (const z of [-5.27, -4.63]) box(X1 + 0.18, 0.2, z, 0.28, 0.02, 0.06, '#7f8b93', false);
  mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), X1 + 0.335, 0.52, -5.07, false).rotation.y = PI / 2;
  for (let i = 0; i < 4; i++) box(X1 + 0.337, 0.4 + i * 0.08, -5.07, 0.01, 0.012, 0.38, '#9aa6ab', false);
  box(X1 + 0.06, 1.0, -4.47, 0.1, 0.9, 0.1, '#e1ddd2'); box(X1 + 0.06, 0.62, -4.6, 0.1, 0.1, 0.25, '#e1ddd2');
  mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.42, 12), mat('#9b8f80'), X1 + 0.55, 0.19 + 0.21, Z1 - 0.3);
  line([[X1 + 0.55, 0.6, Z1 - 0.3], [X1 + 0.53, 1.1, Z1 - 0.3], [X1 + 0.58, 1.5, Z1 - 0.32]], '#6f5a48', 0.03);
  for (let i = 0; i < 9; i++) leaf(true, !(i % 3), X1 + 0.55 + (rnd() - 0.5) * 0.5, 1.3 + rnd() * 0.5, Z1 - 0.3 + (rnd() - 0.5) * 0.45, 0.15 + rnd() * 0.07);
  group('florRear');
  // Slatted plant rack against the rear wall; wall tap with its hose on a reel.
  {
    const x0 = -0.85, x1 = 0.25, cx = (x0 + x1) / 2, z = Z1 - 0.2;
    for (const x of [x0 + 0.02, x1 - 0.02]) for (const dz of [-0.14, 0.14]) box(x, 0.19 + 0.62, z + dz, 0.035, 1.24, 0.035, '#7d8481');
    for (const y of [0.3, 0.72, 1.14]) { box(cx, 0.19 + y, z, x1 - x0, 0.025, 0.32, '#949a97');
      for (let i = 0; i < 3; i++) (i + Math.round(y * 10)) % 2 ? floweringPot(x0 + 0.2 + i * 0.35, 0.19 + y + 0.013, z, 0.08, mat) : potted(x0 + 0.2 + i * 0.35, 0.19 + y + 0.013, z, 0.08, mat, 4, 1); }
    line([[0.78, 0.19, Z1 - 0.04], [0.78, 0.72, Z1 - 0.04], [0.78, 0.74, Z1 - 0.12]], '#9aa3a6', 0.02);
    box(0.78, 0.76, Z1 - 0.13, 0.05, 0.04, 0.05, '#c9a35b'); cyl(0.78, 0.8, Z1 - 0.13, 0.035, 0.02, '#c65a4a');
    const reel = mesh(new THREE.TorusGeometry(0.17, 0.045, 8, 20), mat('#4f7f5f'), 0.85, 0.42, Z1 - 0.2); reel.rotation.y = 0;
    box(0.85, 0.3, Z1 - 0.2, 0.32, 0.22, 0.06, '#5d6670');
    line([[0.78, 0.72, Z1 - 0.14], [0.86, 0.6, Z1 - 0.22], [0.9, 0.5, Z1 - 0.22]], '#4f7f5f', 0.018);
  }
  group('florService');
  // Bin yard at the rear east corner: sorted bins (burnable, plastics, cans) and a tall utility cabinet on a paved pad.
  {
    box(-2.42, 0.19 + 0.65, Z1 - 0.24, 0.38, 1.3, 0.4, '#b8bcb6'); box(-2.42, 1.0, Z1 - 0.445, 0.3, 0.6, 0.01, '#9da3a0', false); box(-2.3, 0.95, Z1 - 0.45, 0.03, 0.12, 0.02, '#5f6a70', false);
    for (const [x, c] of [[-1.92, '#5f8a74'], [-1.42, '#4f7290']]) { box(x, 0.19 + 0.33, Z1 - 0.38, 0.42, 0.66, 0.5, c); box(x, 0.19 + 0.68, Z1 - 0.38, 0.46, 0.05, 0.54, c); }
    box(-1.65, 0.19 + 0.24, Z1 - 0.95, 0.4, 0.48, 0.36, '#8f969a'); box(-1.65, 0.19 + 0.5, Z1 - 0.95, 0.44, 0.04, 0.4, '#7c8387');
    box(-2.3, 0.19 + 0.15, Z1 - 0.95, 0.42, 0.3, 0.32, '#c8b37a');   // stacked flower boxes for recycling
  }
  group('florGround');
  // Forecourt pavers from the facade to the sidewalk, the rear path to alley A01, bin-yard pad, entrance mat.
  const paveMat = warm('#ffffff', 0, pavers);
  mesh(tileUV(new THREE.BoxGeometry(6.7, 0.016, 2), 6.7 / 2, 1), paveMat, 0, 0.198, 1.0, false);
  mesh(tileUV(new THREE.BoxGeometry(1.1, 0.016, 7.5 + Z1), 0.55, (7.5 + Z1) / 2), paveMat, (RD[0] + RD[1]) / 2, 0.198, (Z1 - 7.5) / 2, false);   // to the plot's rear edge on A01
  mesh(tileUV(new THREE.BoxGeometry(1.6, 0.016, 1.25), 0.8, 0.6), paveMat, -1.85, 0.198, Z1 - 0.625, false);
  box(0, 0.214, 0.78, 0.92, 0.014, 0.5, '#55604f', false); box(0, 0.222, 0.78, 0.74, 0.004, 0.36, '#6f7d66', false);
  // Window light on the wet ground (additive, no real lights): street front, both side windows, back door.
  const spill = additive(spillT, '#ffbf7a', 0.26);
  decal(1.9, 1.6, -1.585, 0.208, 0.84, [0, -1], spill); decal(1.9, 1.6, 1.585, 0.208, 0.84, [0, -1], spill); decal(0.9, 1.2, 0, 0.226, 1.0, [0, -1], spill);
  decal(1.5, 0.9, X0 - 0.5, 0.2, (EW[0] + EW[1]) / 2, [1, 0], additive(spillT, '#ffbf7a', 0.16)); decal(1.5, 0.9, X1 + 0.5, 0.2, (WW[0] + WW[1]) / 2, [-1, 0], additive(spillT, '#ffbf7a', 0.16));
  decal(1.3, 0.9, (RD[0] + RD[1]) / 2, 0.208, Z1 - 0.45, [0, 1], additive(glowT, '#ffc27e', 0.22));

  // ================= local animation: window rain, awning drips, swaying baskets, breathing work lamp =================
  group('florist');
  const fx = new THREE.Group(); fx.userData.live = true; group('florist').add(fx); K.setRoot(fx);
  // Window runs and eave drips are short line segments in two batches (2 draw calls), moved every frame.
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6);
  for (const w of [FW1, FW2]) for (let i = 0; i < 11; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 1.4, -0.068, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.16, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 4; i++) runs.add(-0.25 + rnd() * 0.5, 1.0 + rnd() * 1.1, -0.02, 0.08, 0.75, 2.2, 0.09 + rnd() * 0.05);
  for (let i = 0; i < 4; i++) runs.add(X0 + 0.064, EW[2] + 0.05 + rnd() * 0.5, EW[0] + 0.1 + rnd() * (EW[1] - EW[0] - 0.2), 0.06, EW[2] + 0.04, EW[3] - 0.1, 0.07 + rnd() * 0.05);
  for (let i = 0; i < 4; i++) runs.add(X1 - 0.064, WW[2] + 0.05 + rnd() * 0.5, WW[0] + 0.1 + rnd() * (WW[1] - WW[0] - 0.2), 0.06, WW[2] + 0.04, WW[3] - 0.1, 0.07 + rnd() * 0.05);
  for (let i = 0; i < 14; i++) drips.add(-2.55 + i * 0.38 + rnd() * 0.15, 0.25 + rnd() * 2, 0.765, 0.09, 0.25, 2.37, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 3; i++) drips.add(RD[0] - 0.05 + i * 0.47, 0.25 + rnd() * 2, Z1 - 0.38, 0.09, 0.25, 2.42, 2.1 + rnd() * 0.5);
  runs.seal(); drips.seal();
  // Hanging baskets under the awning: each one fused into a few meshes, swinging a few degrees on its hook.
  const fuse = list => { const P = [], N = [], U = []; for (const [g, m] of list) { const q = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m), a = q.attributes; P.push(...a.position.array); N.push(...a.normal.array); U.push(...a.uv.array); q.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); return g; };
  const at = (x, y, z, s, sy = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(s, sy, s));
  const baskets = [];
  for (const [x, ph, cols] of [[-1.62, 0, ['#f2a7b5', '#f6f0e6']], [1.62, 1.9, ['#c7a7dc', '#f7d27a']]]) {
    const g = new THREE.Group(); g.position.set(x, 2.78, 0.44); fx.add(g);
    for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3; rod([0, 0, 0], [Math.cos(a) * 0.15, -0.42, Math.sin(a) * 0.15], 0.005, '#3d4a58', g); }
    mesh(new THREE.SphereGeometry(0.16, 12, 6, 0, 2 * PI, PI / 2, PI / 2), mat('#8d6a4c'), 0, -0.42, 0, true, g);
    const lv = [], bl = [];
    for (let i = 0; i < 12; i++) { const a = rnd() * 2 * PI, d = 0.06 + rnd() * 0.1; lv.push([tint(leafG, LEAFO[i % 2]), at(Math.cos(a) * d, -0.38 + rnd() * 0.08, Math.sin(a) * d, 0.07 + rnd() * 0.03)]); }
    for (let i = 0; i < 6; i++) { const a = i * PI / 3 + rnd() * 0.4; for (let k = 0; k < 3; k++) lv.push([tint(leafG, LEAFO[k % 2]), at(Math.cos(a) * (0.16 + k * 0.015), -0.48 - k * 0.1, Math.sin(a) * (0.16 + k * 0.015), 0.045)]); }
    for (let i = 0; i < 9; i++) { const a = rnd() * 2 * PI, d = rnd() * 0.13; bl.push([tint(bloomG, cols[i % 2]), at(Math.cos(a) * d, -0.32 + rnd() * 0.05, Math.sin(a) * d, 0.035)]); }
    mesh(fuse([...lv, ...bl]), plantO, 0, 0, 0, false, g);
    baskets.push({ g, ph });
  }
  // Work lamp halo on the wrapping table and around the shade: a slow, shallow warm breath (no flicker).
  const breath = [decal(0.9, 0.9, 1.25, F + 0.958, -2.72, [0, -1], additive(glowT, '#ffc98a', 0.3)), mesh(new THREE.PlaneGeometry(0.5, 0.5), additive(glowT, '#ffd59a', 0.25), 1.25, F + 1.62, -2.72, false)];
  breath[1].rotation.y = PI / 2;
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt);
      for (const b of baskets) { b.g.rotation.z = 0.035 * Math.sin(t * 0.9 + b.ph); b.g.rotation.x = 0.025 * Math.sin(t * 0.67 + b.ph * 1.3); }
      const k = 1 + 0.12 * Math.sin(t * 0.8); breath[0].material.opacity = 0.3 * k; breath[1].material.opacity = 0.25 * k;
    },
  };
};
