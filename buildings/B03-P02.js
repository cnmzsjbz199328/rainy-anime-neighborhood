// B03-P02 コインランドリー ふわり (Fuwari Coin Laundry): a one-storey neighbourhood laundromat on the main street.
// Task card docs/buildings/tasks/B03-P02.md, reference docs/buildings/references/B03-P02.jpg.
// Local frame (placed by layout.js `buildings`, rotY 0): front +z faces the main street (world S), +x is the
// viewer's right = world E (the bakery B03-P01 next door); door centre at the origin, floor top at rec.floor.
// Body 5.6 × 5.6: x -2.8…2.8, z -5.6…0 (canopy to +0.55, back canopy and dryer duct to about -5.95; side
// duct and AC to x 3.3: inside the 7.0 × 7.0 buildable envelope).
// Groups: laundry (shell, interior, roof, canopy, signboard, spot lamps, dryer duct, ladder) · launFrontW (pots
// and an umbrella stand) · launFrontE (vending machine for drinks and detergent, pot) · launSideE (AC outdoor unit)
// · launGas (fenced gas cylinder cage, rear west) · launService (bin box and sorted bins, rear east) ·
// launGround (forecourt, rear path, mat, window light on the wet ground).
// Plan: waiting bench behind the west glass, coin changer behind the east front wall; three large washer-dryers
// along the west wall, stacked dryers (two high, three columns) along the east wall, folding table and carts in
// the middle; cleaning sink and detergent vending at the back of the shop; central aisle through the staff door
// into the maintenance room (water heater, lint bins, shelves of detergent, mop sink, back door on the same axis).
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B03-P02'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(3202), PI = Math.PI;
  const F = rec.floor, X0 = -2.8, X1 = 2.8, Z0 = 0, Z1 = -5.6, T = 0.15, BASE = 0.19, EAVE = 3.6, CEIL = 3.0, ROOF = 3.75, PAR = 3.95, PART = -4.45;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T;
  // Openings [u0, u1, y0, y1]: front/rear/partition along x, sides along z.
  const FW1 = [-2.5, -0.58, 0.45, 2.45], FD = [-0.52, 0.52, F, 2.45], FW2 = [0.58, 1.3, 0.45, 2.45];
  const EW = [-3.3, -2.1, 2.1, 2.55], WW = [-3.0, -2.0, 1.75, 2.25], BD = [-0.42, 0.42, F, 2.25], PD = [-0.42, 0.42, F, 2.2], RV = [-1.9, -1.4];
  const DUCT = [X1 + 0.2, -5.05];   // dryer exhaust riser on the east wall: x, z

  // ---- shared materials and textures ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  // Grey-white wall tiles (8 per 2 units, the wall() UV scale) with soft grout lines.
  const tileT = tex(256, 256, (q, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const l = 86 + rnd() * 4; q.fillStyle = `hsl(${200 + rnd() * 20},${6 + rnd() * 4}%,${l}%)`; q.fillRect(i * 32, j * 32, 32, 32); }
    q.strokeStyle = 'rgba(96,106,116,.24)'; q.lineWidth = 1.5; for (let i = 0; i <= 8; i++) { q.beginPath(); q.moveTo(i * 32, 0); q.lineTo(i * 32, h); q.moveTo(0, i * 32); q.lineTo(w, i * 32); q.stroke(); }
    for (let i = 0; i < 700; i++) { q.fillStyle = `rgba(60,70,84,${0.03 + rnd() * 0.05})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1); } });
  const tiles = new THREE.MeshToonMaterial({ color: '#f2f1ea', gradientMap: K.ramp, map: tileT });
  const teal = '#5f8f9a', tealD = '#4a7480', tealL = '#86b2ba', trim = '#677078', metal = '#8a8f92', duct = '#b4bcbf';
  const W = (c, k = 0.3) => warm(c, k);
  const white = W('#f3efe4', 0.36), whiteD = W('#e2ddd0', 0.3), steel = W('#c3cacb', 0.24), steelD = W('#7f878a', 0.14), cream = W('#f4efe2', 0.34),
    tealW = W('#6f9fa8', 0.26), blueSeat = W('#5f86b0', 0.26), wood = W('#c9a77a', 0.3), black = W('#34383c', 0.08), tileIn = W('#ece6d8', 0.3);
  const bulb = new THREE.MeshBasicMaterial({ color: '#fff0cc' }), panelLight = new THREE.MeshBasicMaterial({ color: '#fff4dc' });
  const ledG = new THREE.MeshBasicMaterial({ color: '#8fe0b0' }), ledA = new THREE.MeshBasicMaterial({ color: '#ffc870' });
  const floorT = tex(256, 256, (q, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { q.fillStyle = `hsl(40,${10 + rnd() * 6}%,${80 + rnd() * 4}%)`; q.fillRect(i * 64, j * 64, 64, 64); }
    q.strokeStyle = 'rgba(100,96,86,.45)'; q.lineWidth = 2.5; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); } });
  const concreteT = tex(256, 256, (q, w, h) => { q.fillStyle = '#b9bcb6'; q.fillRect(0, 0, w, h); for (let i = 0; i < 1500; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '60,64,70' : '250,250,246'},${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1); } });
  const pavers = tex(256, 256, (q, w, h) => { q.fillStyle = '#a3a39c'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      q.fillStyle = `rgba(${rnd() < 0.5 ? '70,78,92' : '250,246,236'},${0.05 + rnd() * 0.08})`; q.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    q.strokeStyle = 'rgba(48,56,66,.45)'; q.lineWidth = 2; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); }
    for (let i = 0; i < 900; i++) { q.fillStyle = `rgba(40,48,60,${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1); } });
  const glowT = canvasTex(128, 128, (q, w) => { const g = q.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.33)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, w); });
  const spillT = canvasTex(128, 128, (q, w, h) => { const g = q.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, h);
    q.globalCompositeOperation = 'destination-in'; const s = q.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.18, 'rgba(0,0,0,1)'); s.addColorStop(0.82, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = s; q.fillRect(0, 0, w, h); });
  const additive = (map, c, o) => new THREE.MeshBasicMaterial({ map, color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const pool = additive(glowT, '#ffc988', 0.3);
  const decal = (w, h, x, y, z, heading, m, parent) => { const a = mesh(new THREE.PlaneGeometry(w, h), m, x, y, z, false, parent); a.rotation.set(-PI / 2, Math.atan2(-heading[0], -heading[1]), 0, 'YXZ'); return a; };
  const ab = (axis, u, y, d, w, h, t, c, o = true, p) => axis === 'x' ? box(u, y, d, w, h, t, c, o, p) : box(d, y, u, t, h, w, c, o, p);
  const shapeMesh = (pts, depth, c, x, y, z, ry) => { const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 }); const m = mesh(g, c, x, y, z); m.rotation.y = ry; return m; };
  const rod = (a, b, r, c, parent) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 5, 1, true), typeof c === 'string' ? mat(c) : c, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, false, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  // Washing-machine mark (rounded body, porthole with bubbles) for the signboard and the hours plate.
  const washerIcon = (q, cx, cy, s, body = '#3f7c9a', glassC = '#cfe6ee') => { const r = s * 0.12; q.fillStyle = body; q.beginPath(); q.roundRect(cx - s / 2, cy - s / 2, s, s, r); q.fill();
    q.fillStyle = '#f4f6f2'; q.beginPath(); q.arc(cx, cy + s * 0.06, s * 0.32, 0, 2 * PI); q.fill(); q.fillStyle = glassC; q.beginPath(); q.arc(cx, cy + s * 0.06, s * 0.24, 0, 2 * PI); q.fill();
    q.fillStyle = '#f4f6f2'; for (const [a, b, rr] of [[-0.08, 0.02, 0.05], [0.07, 0.12, 0.035], [0.02, -0.07, 0.03]]) { q.beginPath(); q.arc(cx + a * s, cy + b * s, rr * s, 0, 2 * PI); q.fill(); }
    q.fillRect(cx - s * 0.36, cy - s * 0.42, s * 0.2, s * 0.06); q.beginPath(); q.arc(cx + s * 0.3, cy - s * 0.39, s * 0.045, 0, 2 * PI); q.fill(); };

  // ---- laundry: clothes, towels and bags share one palette texture, so they bake into one mesh ----
  const CLOTH = ['#e8a0a8', '#9fc3e0', '#f4efe2', '#b8d4a8', '#f2d27e', '#8a9ec4', '#d9c2e0', '#f0b98a', '#6f7f96'];
  const atlas = canvasTex(64, 4, q => CLOTH.forEach((c, i) => { q.fillStyle = c; q.fillRect(i * 4, 0, 4, 4); }));
  atlas.magFilter = atlas.minFilter = THREE.NearestFilter; atlas.generateMipmaps = false;
  const clothM = new THREE.MeshToonMaterial({ map: atlas, gradientMap: K.ramp, emissive: new THREE.Color('#ffb36b').multiplyScalar(0.28), emissiveMap: atlas });
  const tinted = {}, tint = (g, c) => { const k = g.uuid + c; if (!tinted[k]) { const q = g.clone(), uv = q.attributes.uv, u = (CLOTH.indexOf(c) + 0.5) / 16; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, 0.5); tinted[k] = q; } return tinted[k]; };
  const ballG = new THREE.SphereGeometry(1, 6, 4), cubeG = new THREE.BoxGeometry(1, 1, 1);
  const pick = () => CLOTH[Math.floor(rnd() * CLOTH.length)];
  const lump = (x, y, z, s, c = pick(), parent) => { const a = mesh(tint(ballG, c), clothM, x, y, z, false, parent); a.scale.set(s * (0.8 + rnd() * 0.5), s * (0.5 + rnd() * 0.3), s * (0.8 + rnd() * 0.5)); a.rotation.y = rnd() * PI; return a; };
  const folded = (x, y, z, n, w = 0.24, d = 0.18, ry = 0) => { for (let i = 0; i < n; i++) { const a = mesh(tint(cubeG, pick()), clothM, x + (rnd() - 0.5) * 0.02, y + 0.025 + i * 0.05, z, false); a.scale.set(w, 0.045, d); a.rotation.y = ry + (rnd() - 0.5) * 0.1; } };
  const basket = (x, y, z, c = '#9fc3e0') => { box(x, y + 0.11, z, 0.42, 0.22, 0.3, W(c, 0.3)); for (const dx of [-0.12, 0, 0.12]) box(x + dx, y + 0.13, z + 0.151, 0.06, 0.1, 0.004, W('#6f8fa8', 0.2), false); for (let i = 0; i < 3; i++) lump(x - 0.1 + i * 0.1, y + 0.2, z, 0.08); };

  // ---- plants outside ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), LEAF = ['#6c9476', '#88a98a', '#5e8a6a'];
  const blob = (g, m, x, y, z, s, sy = s) => { const a = mesh(g, m, x, y, z, false); a.scale.set(s, sy, s); return a; };
  const shrub = (x, y, z, r, n, h = 1) => { for (let i = 0; i < n; i++) blob(leafG, mat(LEAF[i % 3]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.35 + rnd() * r * h, z + (rnd() - 0.5) * r * 1.3, r * (0.45 + rnd() * 0.25)); };
  const pot = (x, y, z, r, n = 5, h = 1, c = '#a7aba6') => { mesh(new THREE.CylinderGeometry(r, r * 0.78, r * 1.2, 10), mat(c), x, y + r * 0.6, z); shrub(x, y + r * 1.15, z, r, n, h); };

  // ================= shell =================
  group('laundry');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, EAVE], [FW1, FD, FW2], tiles);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, EAVE], [BD], tiles);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, EAVE], [EW], tiles);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, EAVE], [WW], tiles);
  // Dark grey base course; teal band at the eaves (the reference's blue-framed cornice).
  const skirt = (a, b, d, axis) => ab(axis, (a + b) / 2, 0.29, d, b - a, 0.2, 0.03, '#6c737a');
  skirt(X0 - 0.01, FW1[0], 0.006, 'x'); skirt(FW2[1], X1 + 0.01, 0.006, 'x'); skirt(X0 - 0.01, BD[0], Z1 - 0.006, 'x'); skirt(BD[1], X1 + 0.01, Z1 - 0.006, 'x');
  skirt(Z1 - 0.01, Z0 + 0.01, X1 + 0.006, 'z'); skirt(Z1 - 0.01, Z0 + 0.01, X0 - 0.006, 'z');
  box(0, EAVE - 0.06, Z1 - 0.03, X1 - X0 + 0.08, 0.12, 0.06, teal);
  for (const x of [X0 - 0.03, X1 + 0.03]) box(x, EAVE - 0.06, (Z0 + Z1) / 2, 0.06, 0.12, Z0 - Z1 + 0.12, teal);
  // Floors: warm pale tiles in the shop, concrete in the maintenance room.
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - PART), (IX1 - IX0) / 1.6, (IZ0 - PART) / 1.6), warm('#ffffff', 0.2, floorT), 0, (F + BASE) / 2, (IZ0 + PART) / 2, false);
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, PART - IZ1), (IX1 - IX0) / 2, (PART - IZ1) / 2), warm('#ffffff', 0.14, concreteT), 0, (F + BASE) / 2, (PART + IZ1) / 2, false);
  // Roof layer (ceiling, ceiling lights, slab, parapet, rooftop plant): batched on its own for review cutaways.
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('laundry').add(roofLayer);
  box(0, CEIL + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#f4f2ea', 0.36), false, roofLayer);
  for (const z of [-1.2, -2.4, -3.6]) box(0, CEIL - 0.006, z, 2.6, 0.012, 0.22, panelLight, false, roofLayer);
  box(0, CEIL - 0.006, -5.0, 1.0, 0.012, 0.18, new THREE.MeshBasicMaterial({ color: '#eef1ec' }), false, roofLayer);
  // Interior linings: white tile wainscot to 1.2 and pale plaster above in the shop, plain walls in the back.
  const plaster = W('#f3ead8', 0.36);
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL], [FW1, FD, FW2], plaster);
  panel('z', IX1 - 0.006, 0.012, [PART, IZ0, F, CEIL], [EW], plaster);
  panel('z', IX0 + 0.006, 0.012, [PART, IZ0, F, CEIL], [WW], plaster);
  panel('z', IX1 - 0.016, 0.012, [PART, IZ0, F, 1.2], [], tileIn);
  panel('z', IX0 + 0.016, 0.012, [PART, IZ0, F, 1.2], [], tileIn);
  panel('z', IX1 - 0.006, 0.012, [IZ1, PART, F, CEIL], [], W('#dfe2dc', 0.22));
  panel('z', IX0 + 0.006, 0.012, [IZ1, PART, F, CEIL], [], W('#dfe2dc', 0.22));
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL], [BD], W('#dfe2dc', 0.22));
  // Partition: staff door on the central aisle, notice board on the shop side.
  wall('x', PART, 0.12, [IX0, IX1, F, CEIL], [PD], plaster);
  panel('x', PART + 0.066, 0.012, [IX0, IX1, F, 1.2], [PD], tileIn);

  // ---- glazing: teal aluminium frames, real mullions, one pane per light ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = [], fc = teal, sill = true) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, fc); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, fc);
    ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, fc); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, fc);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.05, q - p, fd * 0.9, fc);
    for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.045, fd * 0.9, fc);
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    if (sill && p > F + 0.05) ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.1, 0.05, 0.15, '#c9ccc6');
  }
  glaze('x', -T / 2, 1, FW1, [-1.86, -1.22], [2.1]);
  glaze('x', -T / 2, 1, FW2, [0.94], [2.1]);
  glaze('z', X1 - T / 2, 1, EW, [-2.7]);
  glaze('z', X0 + T / 2, -1, WW, [-2.5]);
  // Low panels under the shop glass (outside), teal.
  for (const w of [FW1, FW2]) box((w[0] + w[1]) / 2, (0.4 + w[2] - 0.05) / 2, 0.01, w[1] - w[0] - 0.04, w[2] - 0.05 - 0.4 + 0.02, 0.02, tealD);
  // Front door: pair of glass sliding leaves in teal frames (closed), push bar, opening hours stencil.
  ab('x', FD[0] + 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, teal); ab('x', FD[1] - 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, teal);
  box(0, FD[3] - 0.03, -T / 2, FD[1] - FD[0], 0.06, 0.16, teal); box(0, FD[3] + 0.08, -0.02, FD[1] - FD[0] + 0.1, 0.16, 0.06, tealD);   // door header / track box
  for (const [x, z] of [[-0.24, -0.04], [0.24, -0.08]]) {
    const l = x - 0.24, r = x + 0.24, top = FD[3] - 0.07;
    for (const xx of [l + 0.03, r - 0.03]) box(xx, (F + top) / 2, z, 0.05, top - F, 0.04, tealL);
    box(x, top - 0.03, z, r - l, 0.05, 0.04, tealL); box(x, F + 0.04, z, r - l, 0.08, 0.04, tealL);
    box(x, (F + 0.08 + top - 0.05) / 2, z, r - l - 0.08, top - 0.05 - F - 0.08, 0.01, glass, false);
    box(x + (x < 0 ? 0.17 : -0.17), 1.2, z + (x < 0 ? 0.03 : -0.03), 0.025, 0.36, 0.025, '#c9cfcc');
  }
  K.label('ご自由にお入りください', -0.24, 1.6, -0.012, 0.4, 0.05, '#e8f0ee', '#3f6c78', 40);
  shapeMesh([[0, BASE], [0.48, BASE], [0.48, 0.212], [0, 0.298]], 1.1, '#b9b6ad', 0.55, 0, 0, -PI / 2);   // threshold ramp
  // Back door: blue steel leaf with a louvre, lever, step, canopy, lamp.
  ab('x', BD[0] + 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, trim); ab('x', BD[1] - 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, trim);
  box(0, BD[3] - 0.03, Z1 + T / 2, BD[1] - BD[0], 0.06, 0.16, trim);
  box(0, (F + BD[3] - 0.06) / 2, Z1 + 0.06, BD[1] - BD[0] - 0.12, BD[3] - 0.06 - F, 0.04, '#5f7d94');
  for (let i = 0; i < 5; i++) box(0, 0.5 + i * 0.06, Z1 + 0.035, 0.4, 0.012, 0.012, '#4c6478', false);
  box(BD[1] - 0.15, 1.2, Z1 + 0.02, 0.12, 0.03, 0.04, '#c9cfcc');
  shapeMesh([[0, BASE], [0.3, BASE], [0.3, 0.3], [0, 0.3]], BD[1] - BD[0] + 0.1, '#b9b6ad', BD[0] - 0.05, 0, Z1, PI / 2);
  box(0, 2.48, Z1 - 0.18, 1.1, 0.05, 0.36, teal);
  for (const x of [BD[0] - 0.08, BD[1] + 0.08]) rod([x, 2.2, Z1], [x, 2.46, Z1 - 0.33], 0.014, '#3d4a58');
  // Staff door in the partition: plain leaf standing ajar into the maintenance room.
  {
    const g = new THREE.Group(); g.position.set(PD[1] - 0.02, 0, PART); g.rotation.y = -0.6; group('laundry').add(g);
    const w = PD[1] - PD[0] - 0.05; box(-w / 2, (F + PD[3] - 0.04) / 2, -0.03, w, PD[3] - 0.05 - F, 0.04, W('#c8d4d6', 0.28), true, g);
    box(-w + 0.08, 1.15, -0.06, 0.03, 0.14, 0.03, steel, false, g);
    for (const x of [PD[0] + 0.03, PD[1] - 0.03]) box(x, (F + PD[3]) / 2, PART, 0.06, PD[3] - F, 0.16, tealW);
    box(0, PD[3] + 0.03, PART, PD[1] - PD[0] + 0.06, 0.06, 0.16, tealW);
    K.label('STAFF ONLY', 0, PD[3] + 0.17, PART + 0.07, 0.42, 0.09, '#e8f0ee', '#3f6c78', 64);
  }

  // ================= canopy, signboard, lamps =================
  // Thin teal steel canopy across the front on two tie rods.
  {
    const x0 = -2.75, x1 = 2.75, y = 2.62, dep = 0.55;
    box(0, y, dep / 2, x1 - x0, 0.06, dep, teal); box(0, y - 0.05, dep - 0.01, x1 - x0, 0.06, 0.03, tealD);
    for (const x of [x0 + 0.3, x1 - 0.3]) rod([x, y + 0.6, 0.0], [x, y + 0.03, dep - 0.05], 0.012, '#3d4a58');
    for (let i = 0; i < 4; i++) { const x = -1.8 + i * 1.2; box(x, y - 0.035, dep * 0.5, 0.22, 0.012, 0.08, panelLight, false); }   // downlights in the soffit
  }
  // Signboard band: white panel, washer mark, original name; two box spot lamps on the parapet.
  {
    const sx = -0.2, sw = 4.6, sy = 3.12, sh = 0.62;
    const s = canvasTex(1024, 138, (q, w, h) => { q.fillStyle = '#f4f6f2'; q.fillRect(0, 0, w, h); q.fillStyle = '#5f8f9a'; q.fillRect(0, h - 12, w, 12);
      washerIcon(q, 120, h / 2 - 4, 96); q.textBaseline = 'middle'; q.textAlign = 'left'; q.fillStyle = '#2f5f78'; q.font = 'bold 74px sans-serif'; q.fillText('コインランドリー', 200, h / 2 - 12);
      q.font = 'bold 26px sans-serif'; q.fillStyle = '#5f8f9a'; q.fillText('COIN LAUNDRY', 205, h / 2 + 40); q.textAlign = 'right'; q.font = 'bold 60px serif'; q.fillStyle = '#e48f9c'; q.fillText('ふわり', w - 40, h / 2 + 2); });
    box(sx, sy, 0.035, sw + 0.08, sh + 0.08, 0.07, tealD);
    mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, emissive: '#4a4a44', emissiveMap: s }), sx, sy, 0.072, false);
    for (const x of [sx - 1.4, sx + 1.4]) {
      box(x, 3.72, 0.03, 0.06, 0.06, 0.06, '#3d4a58'); rod([x, 3.72, 0.03], [x, 3.82, 0.4], 0.012, '#3d4a58');
      const h = box(x, 3.8, 0.42, 0.14, 0.09, 0.16, '#3d4a58'); h.rotation.x = 0.6; box(x, 3.765, 0.44, 0.1, 0.01, 0.1, bulb, false).rotation.x = 0.6;
      mesh(new THREE.PlaneGeometry(1.8, 0.8), additive(glowT, '#fff0d0', 0.3), x, sy, 0.08, false);
    }
  }
  // Hours plate on the solid wall east of the glass; a small notice frame below it.
  {
    const p = canvasTex(256, 360, (q, w, h) => { q.fillStyle = '#f4f6f2'; q.fillRect(0, 0, w, h); q.strokeStyle = '#5f8f9a'; q.lineWidth = 8; q.strokeRect(6, 6, w - 12, h - 12);
      q.textAlign = 'center'; q.fillStyle = '#2f5f78'; q.font = 'bold 30px sans-serif'; q.fillText('営業時間', w / 2, 52); q.font = 'bold 64px sans-serif'; q.fillText('6:00', w / 2, 128); q.fillText('23:00', w / 2, 248);
      q.fillRect(w / 2 - 8, 162, 16, 40); q.font = 'bold 24px sans-serif'; q.fillStyle = '#5f8f9a'; q.fillText('年中無休', w / 2, 316); });
    mesh(new THREE.PlaneGeometry(0.38, 0.54), new THREE.MeshToonMaterial({ map: p, gradientMap: K.ramp, emissive: '#3a3a36', emissiveMap: p }), 1.56, 1.75, 0.012, false);
    const n = canvasTex(256, 200, (q, w, h) => { q.fillStyle = '#e8f0ee'; q.fillRect(0, 0, w, h); washerIcon(q, 70, 80, 80); washerIcon(q, 180, 80, 80, '#d98f8f');
      q.fillStyle = '#2f5f78'; q.font = 'bold 26px sans-serif'; q.textAlign = 'center'; q.fillText('洗濯 · 乾燥', w / 2, 170); });
    mesh(new THREE.PlaneGeometry(0.38, 0.3), new THREE.MeshToonMaterial({ map: n, gradientMap: K.ramp, emissive: '#3a3a36', emissiveMap: n }), 1.56, 1.12, 0.012, false);
  }
  // Wall lamp beside the back door.
  box(0.65, 2.0, Z1 - 0.04, 0.06, 0.12, 0.08, '#3d4a58'); box(0.65, 2.0, Z1 - 0.12, 0.12, 0.19, 0.12, '#3d4a58'); box(0.65, 1.99, Z1 - 0.12, 0.09, 0.14, 0.125, bulb, false);
  mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffd59a', 0.28), 0.65, 2.0, Z1 - 0.004, false).rotation.y = PI;

  // ================= roof, parapet, rooftop plant =================
  K.setRoot(roofLayer);
  box(0, (EAVE - 0.15 + ROOF) / 2, (IZ0 + IZ1) / 2, IX1 - IX0, ROOF - EAVE + 0.15, IZ0 - IZ1, '#9aa0a2');
  {
    const cz = (Z0 + Z1) / 2;
    for (const z of [Z0 - T / 2, Z1 + T / 2]) { box(0, (EAVE + PAR) / 2, z, X1 - X0, PAR - EAVE, T, tiles); box(0, PAR + 0.03, z, X1 - X0 + 0.06, 0.06, 0.22, teal); }
    for (const x of [X0 + T / 2, X1 - T / 2]) { box(x, (EAVE + PAR) / 2, cz, T, PAR - EAVE, Z0 - Z1 - 2 * T, tiles); box(x, PAR + 0.03, cz, 0.22, 0.06, Z0 - Z1 - 0.16, teal); }
    box(0, ROOF + 0.005, cz, IX1 - IX0, 0.01, IZ0 - IZ1, '#6f767c', false);
    for (let i = 1; i < 4; i++) box(0, ROOF + 0.012, Z0 - i * 1.4, IX1 - IX0 - 0.02, 0.004, 0.02, '#5d6266', false);
  }
  // Condenser for the shop air conditioning (rear east), a water tank vent, a TV-style antenna mast.
  for (const z of [-3.9, -4.4]) box(1.4, ROOF + 0.04, z, 1.0, 0.06, 0.07, metal);
  box(1.4, ROOF + 0.37, -4.15, 0.9, 0.6, 0.42, '#c6cbc6');
  mesh(new THREE.CircleGeometry(0.21, 18), mat('#3b4650'), 1.3, ROOF + 0.37, -3.938, false);
  for (let i = 0; i < 3; i++) box(1.3, ROOF + 0.29 + i * 0.08, -3.935, 0.4, 0.012, 0.01, '#9aa6ab', false);
  line([[0.94, ROOF + 0.2, -4.15], [0.6, ROOF + 0.2, -4.15], [0.6, ROOF + 0.08, -3.7], [0.6, ROOF + 0.08, -3.0]], '#8f9aa0', 0.03);
  box(-1.6, ROOF + 0.18, -1.5, 0.5, 0.36, 0.5, '#a7adae'); box(-1.6, ROOF + 0.38, -1.5, 0.56, 0.04, 0.56, trim);
  cyl(-2.2, ROOF + 0.55, -0.6, 0.025, 1.1, '#8f979a'); for (const y of [0.85, 1.0]) box(-2.2, ROOF + y, -0.6, 0.5, 0.02, 0.02, '#8f979a');
  cyl(0.2, ROOF + 0.2, -2.6, 0.06, 0.4, '#a9b1b2'); mesh(new THREE.SphereGeometry(0.12, 10, 5, 0, 2 * PI, 0, PI / 2), mat('#b6bdbe'), 0.2, ROOF + 0.4, -2.6);
  group('laundry');
  // Dryer exhaust: stainless duct out of the east wall at the rear, up past the parapet, mushroom cap.
  {
    const [x, z] = DUCT, r = 0.15;
    box(X1 + 0.1, 2.35, z, 0.2, 0.34, 0.34, duct);
    cyl(x, (2.2 + 4.3) / 2, z, r, 4.3 - 2.2, duct);
    for (const y of [2.8, 3.4, 4.0]) { cyl(x, y, z, r + 0.015, 0.04, '#8f979a'); box((X1 + x) / 2, y, z, x - X1, 0.04, 0.05, '#8f979a'); }
    rod([x, 4.3, z], [x, 4.42, z], 0.06, '#8f979a'); mesh(new THREE.SphereGeometry(0.22, 14, 6, 0, 2 * PI, 0, PI / 2), mat('#9aa2a5'), x, 4.4, z);
  }
  // Roof access ladder on the rear wall (east of the door), with hoops above the parapet.
  {
    const x = 1.75, z = Z1 - 0.12;
    for (const dx of [-0.2, 0.2]) { box(x + dx, (1.0 + PAR + 0.5) / 2, z, 0.04, PAR + 0.5 - 1.0, 0.04, '#7f878a'); box(x + dx, 1.4, Z1 - 0.05, 0.04, 0.04, 0.14, '#7f878a'); box(x + dx, 3.4, Z1 - 0.05, 0.04, 0.04, 0.14, '#7f878a'); }
    for (let y = 1.1; y < PAR + 0.45; y += 0.3) box(x, y, z, 0.4, 0.03, 0.03, '#7f878a');
  }
  // Downpipes (front west corner, rear east corner), rear louvre, meter box on the west wall, gas pipe.
  for (const [x, z, sx] of [[X0 - 0.07, -0.35, -1], [X1 + 0.07, Z1 + 0.25, 1]]) {
    box(x - sx * 0.05, 3.8, z, 0.14, 0.08, 0.12, metal);
    cyl(x, (3.76 + 0.3) / 2, z, 0.04, 3.46, '#8796a0'); for (const y of [0.9, 2.0, 3.0]) box(x - sx * 0.03, y, z, 0.07, 0.03, 0.1, '#5f6c76');
    box(x + sx * 0.04, 0.22, z, 0.22, 0.06, 0.18, '#a39d91');
  }
  box((RV[0] + RV[1]) / 2, 2.3, Z1 - 0.03, RV[1] - RV[0], 0.4, 0.06, '#c4c7c0'); for (let i = 0; i < 5; i++) box((RV[0] + RV[1]) / 2, 2.15 + i * 0.075, Z1 - 0.065, RV[1] - RV[0] - 0.06, 0.012, 0.012, '#7f8b93', false);
  box(X0 - 0.08, 1.5, -4.0, 0.16, 0.42, 0.3, '#cdd0c9'); box(X0 - 0.165, 1.58, -4.0, 0.01, 0.12, 0.18, '#7b8a92', false);
  line([[X0 - 0.06, 1.28, -4.0], [X0 - 0.06, 0.45, -4.0]], '#9aa3a6', 0.018);
  line([[-2.2, 0.75, Z1 - 0.05], [-1.0, 0.75, Z1 - 0.05], [-1.0, 0.75, Z1 + 0.01]], '#c9a35b', 0.018);   // gas line from the cage
  box(X1 + 0.03, 1.1, -1.2, 0.06, 0.3, 0.3, '#c4c7c0'); for (let i = 0; i < 4; i++) box(X1 + 0.065, 1.0 + i * 0.065, -1.2, 0.012, 0.012, 0.24, '#7f8b93', false);

  // ================= interior =================
  // Front-load drum unit (washer or dryer) facing ±x: body, control strip, porthole with a drum behind it.
  const drums = [];
  const drumUnit = (x, y, z, s, w, h, d, dir, kind) => {   // x = front face, dir = +1 faces +x, -1 faces -x; y = base
    const cx = x - dir * d / 2;
    box(cx, y + h / 2, z, d, h, w, kind === 'dryer' ? whiteD : white);
    box(x + dir * 0.003, y + h - 0.1, z, 0.012, 0.14, w - 0.06, W('#cfd7da', 0.3), false);   // control strip
    box(x + dir * 0.008, y + h - 0.1, z + w * 0.28, 0.006, 0.05, 0.08, ledG, false);
    box(x + dir * 0.008, y + h - 0.1, z - w * 0.05, 0.006, 0.06, 0.18, W('#3a4650', 0.06), false);   // display
    box(x + dir * 0.006, y + h - 0.1, z - w * 0.32, 0.01, 0.06, 0.08, W('#c9a35b', 0.3), false);   // coin slot
    const cy = y + (kind === 'dryer' ? h * 0.46 : h * 0.5), r = s;
    const ring = mesh(new THREE.TorusGeometry(r, 0.035, 6, 24), W('#b8c2c6', 0.26), x + dir * 0.02, cy, z, true); ring.rotation.y = PI / 2;
    const gl = mesh(new THREE.CircleGeometry(r, 24), glass, x + dir * 0.025, cy, z, false); gl.rotation.y = dir * PI / 2;
    const drum = mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, d * 0.55, 18, 1, true), W('#9aa4a8', 0.18), x - dir * d * 0.27, cy, z, false); drum.rotation.z = PI / 2;
    const back = mesh(new THREE.CircleGeometry(r * 0.95, 18), W('#7f878a', 0.14), x - dir * d * 0.54, cy, z, false); back.rotation.y = dir * PI / 2;
    for (let i = 0; i < 4; i++) box(x - dir * d * 0.27, cy + Math.sin(i * PI / 2) * r * 0.85, z + Math.cos(i * PI / 2) * r * 0.85, d * 0.5, 0.03, 0.03, W('#b8c2c6', 0.2), false);
    drums.push({ x, cy, z, r, d, dir, kind });
    return cy;
  };
  // West wall: three large washer-dryers (the middle one turns, see animation), labels above.
  const WX = IX0 + 0.75;
  for (const [i, z] of [-1.65, -2.5, -3.35].entries()) {
    box(IX0 + 0.38, F + 0.05, z, 0.76, 0.1, 0.82, W('#9aa4a8', 0.18));
    drumUnit(WX, F + 0.1, z, 0.28, 0.8, 1.45, 0.74, 1, 'washer');
    K.label(['洗濯乾燥 22kg', '洗濯乾燥 22kg', '洗濯 12kg'][i], WX - 0.2, F + 1.85, z, 0.5, 0.11, '#e8f0ee', '#2f5f78', 60).rotation.y = PI / 2;
  }
  // Clothes resting in the two still washers.
  for (const z of [-1.65, -3.35]) for (let i = 0; i < 5; i++) lump(WX - 0.22 - rnd() * 0.25, F + 0.1 + 0.55 + rnd() * 0.08, z + (rnd() - 0.5) * 0.3, 0.09);
  // East wall: stacked dryers, three columns of two on a plinth.
  const DX = IX1 - 0.72;
  for (const z of [-1.6, -2.4, -3.2]) {
    box(IX1 - 0.36, F + 0.075, z, 0.72, 0.15, 0.78, W('#9aa4a8', 0.18));
    for (const k of [0, 1]) { drumUnit(DX, F + 0.15 + k * 0.8, z, 0.25, 0.76, 0.78, 0.7, -1, 'dryer');
      if ((z === -2.4) !== (k === 1)) for (let i = 0; i < 4; i++) lump(DX + 0.2 + rnd() * 0.25, F + 0.15 + k * 0.8 + 0.2 + rnd() * 0.06, z + (rnd() - 0.5) * 0.25, 0.08); }
  }
  K.label('乾燥機 10分 ¥100', DX + 0.2, F + 1.88, -2.4, 0.9, 0.11, '#e8f0ee', '#2f5f78', 60).rotation.y = -PI / 2;
  // Front: waiting bench (three blue seats) behind the west glass, small side table with magazines and a plant.
  {
    const x0 = -2.35, x1 = -1.05, z = -0.62, cx = (x0 + x1) / 2;
    for (const x of [x0 + 0.06, x1 - 0.06]) box(x, F + 0.19, z, 0.04, 0.38, 0.4, steelD);
    box(cx, F + 0.39, z, x1 - x0, 0.03, 0.42, steelD);
    for (let i = 0; i < 3; i++) { const x = x0 + 0.22 + i * 0.43; box(x, F + 0.43, z - 0.02, 0.4, 0.06, 0.38, blueSeat); const b = box(x, F + 0.69, z + 0.19, 0.4, 0.42, 0.05, blueSeat); b.rotation.x = -0.12; }
    box(-0.8, F + 0.25, -0.6, 0.32, 0.5, 0.32, wood); for (let i = 0; i < 3; i++) box(-0.8, F + 0.51 + i * 0.012, -0.6, 0.22, 0.01, 0.28, W(['#e8a0a8', '#9fc3e0', '#f2d27e'][i], 0.3), false);
    mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 10), W('#c47f5c', 0.3), -0.72, F + 0.6, -0.68, false);
    for (let i = 0; i < 4; i++) mesh(leafG, W('#6f9a6c', 0.2), -0.72 + (rnd() - 0.5) * 0.08, F + 0.7 + rnd() * 0.08, -0.68 + (rnd() - 0.5) * 0.08, false).scale.setScalar(0.06);
  }
  // Coin changer behind the east front wall (between the glass and the dryers).
  {
    const x = 2.32, z = -0.42;
    box(x, F + 0.72, z, 0.5, 1.44, 0.4, W('#e9ece6', 0.3)); box(x - 0.251, F + 1.15, z, 0.006, 0.36, 0.3, W('#2f5f78', 0.12), false);
    box(x - 0.252, F + 0.85, z, 0.006, 0.12, 0.18, W('#c9a35b', 0.3), false); box(x - 0.252, F + 0.45, z, 0.01, 0.12, 0.28, W('#5f6c76', 0.12), false);
    K.label('両替機', x - 0.256, F + 1.36, z, 0.3, 0.08, '#e8f0ee', '#2f5f78', 70).rotation.y = -PI / 2;
  }
  // Middle: folding table with baskets and folded stacks; two laundry carts.
  {
    const x0 = -0.55, x1 = 0.55, z0 = -1.95, z1 = -3.05, top = F + 0.9;
    for (const x of [x0 + 0.05, x1 - 0.05]) for (const z of [z0 - 0.05, z1 + 0.05]) box(x, F + 0.44, z, 0.05, 0.88, 0.05, steelD);
    box(0, top - 0.02, (z0 + z1) / 2, x1 - x0, 0.04, z0 - z1, W('#f2f0e8', 0.36)); box(0, F + 0.2, (z0 + z1) / 2, x1 - x0 - 0.1, 0.02, z0 - z1 - 0.1, steelD, false);
    basket(-0.25, top, -2.2); basket(0.22, top, -2.8, '#e8a0a8'); folded(0.22, top, -2.2, 4); folded(-0.25, top, -2.8, 3, 0.28, 0.2, 0.3);
    basket(0, F + 0.22, -2.5, '#b8d4a8');
  }
  const cart = (x, z) => { for (const dx of [-0.2, 0.2]) for (const dz of [-0.15, 0.15]) { box(x + dx, F + 0.42, z + dz, 0.025, 0.8, 0.025, steel); cyl(x + dx, F + 0.03, z + dz, 0.03, 0.05, black); }
    box(x, F + 0.82, z, 0.44, 0.025, 0.34, steel); box(x, F + 0.62, z, 0.38, 0.36, 0.28, W('#b9cfe0', 0.28), false); for (let i = 0; i < 3; i++) lump(x - 0.1 + i * 0.1, F + 0.82, z, 0.08);
    rod([x - 0.22, F + 0.82, z - 0.17], [x - 0.22, F + 1.0, z - 0.17], 0.012, steel); rod([x + 0.22, F + 0.82, z - 0.17], [x + 0.22, F + 1.0, z - 0.17], 0.012, steel); rod([x - 0.22, F + 1.0, z - 0.17], [x + 0.22, F + 1.0, z - 0.17], 0.012, steel); };
  cart(1.0, -1.35); cart(-1.2, -3.9);
  // Back of the shop: cleaning sink (west), detergent vending (east), notice board and clock on the partition.
  {
    const x0 = IX0, x1 = -2.0, z0 = -3.88, z1 = PART - 0.07, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = F + 0.86;
    box(cx, F + 0.42, cz, x1 - x0, 0.84, z0 - z1, steel); box(cx, top - 0.02, cz, x1 - x0 + 0.02, 0.04, z0 - z1 + 0.02, steel);
    box(cx + 0.02, top - 0.005, cz, 0.38, 0.006, 0.36, W('#55606a', 0.08), false);
    line([[IX0 + 0.05, top, cz], [IX0 + 0.05, top + 0.3, cz], [IX0 + 0.15, top + 0.34, cz], [IX0 + 0.24, top + 0.25, cz]], '#b9c0c2', 0.014);
    K.label('スニーカー洗い場', IX0 + 0.02, F + 1.45, cz, 0.42, 0.09, '#e8f0ee', '#2f5f78', 52).rotation.y = PI / 2;
  }
  {
    const x0 = 2.05, x1 = IX1, z0 = -3.72, z1 = -4.32, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = 1.7;
    box(cx, F + h / 2, cz, x1 - x0, h, z0 - z1, W('#d8e6ea', 0.3)); box(x0 - 0.003, F + 1.05, cz, 0.006, 0.8, 0.5, W('#f6f7f2', 0.45), false);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) box(x0 + 0.05, F + 0.8 + r * 0.25, z0 - 0.1 - i * 0.135, 0.08, 0.14, 0.09, W(['#f2d27e', '#9fc3e0', '#e8a0a8', '#b8d4a8'][(i + r) % 4], 0.34), false);
    box(x0 - 0.004, F + 1.05, cz, 0.006, 0.82, 0.52, glass, false);
    box(x0 - 0.004, F + 0.45, cz, 0.01, 0.12, 0.34, W('#5f6c76', 0.12), false);
    K.label('洗剤 · 柔軟剤', x0 - 0.008, F + 1.58, cz, 0.42, 0.09, '#2f5f78', '#f4f6f2', 60).rotation.y = -PI / 2;
  }
  {
    const nb = canvasTex(256, 160, (q, w, h) => { q.fillStyle = '#c9a77a'; q.fillRect(0, 0, w, h); q.fillStyle = '#e8d8b8'; q.fillRect(8, 8, w - 16, h - 16);
      for (const [x, y, c] of [[20, 20, '#f4f6f2'], [100, 26, '#e8f0ee'], [176, 18, '#fbe3c4'], [30, 92, '#e8f0ee'], [120, 96, '#f4efe2']]) { q.fillStyle = c; q.fillRect(x, y, 64, 52); q.fillStyle = '#5f8f9a'; q.fillRect(x + 8, y + 10, 40, 5); q.fillRect(x + 8, y + 22, 30, 4); q.fillStyle = '#d98f8f'; q.beginPath(); q.arc(x + 32, y + 2, 4, 0, 2 * PI); q.fill(); } });
    mesh(new THREE.PlaneGeometry(1.0, 0.62), new THREE.MeshToonMaterial({ map: nb, gradientMap: K.ramp, emissive: '#3a3226', emissiveMap: nb }), -1.2, F + 1.65, PART + 0.067, false);
    mesh(new THREE.CircleGeometry(0.13, 16), W('#f4f6f2', 0.4), 1.2, F + 2.25, PART + 0.067, false); box(1.2, F + 2.25, PART + 0.07, 0.006, 0.1, 0.004, black, false);
  }
  // Light pools on the shop floor.
  for (const [x, z, r] of [[0, -1.2, 1.9], [0, -2.5, 1.9], [0, -3.7, 1.6], [-1.7, -0.7, 1.2], [1.6, -2.4, 1.2]]) decal(r, r, x, F + 0.003, z, [0, -1], pool);
  // ---- maintenance room (behind the partition) ----
  {
    // Gas water heater and boiler on the west, pipes across the wall.
    cyl(-2.25, F + 0.8, -5.0, 0.3, 1.6, W('#e9ece6', 0.26)); cyl(-2.25, F + 1.62, -5.0, 0.31, 0.04, steel);
    box(-2.25, F + 0.9, -4.68, 0.2, 0.14, 0.02, W('#3a4650', 0.06), false); box(-2.18, F + 0.9, -4.668, 0.04, 0.03, 0.004, ledA, false);
    for (const y of [1.9, 2.05]) line([[-2.25, F + 1.64, -5.0], [-2.25, F + y, -5.0], [-1.0, F + y, IZ1 + 0.06], [1.8, F + y, IZ1 + 0.06]], y > 2 ? '#c27f62' : '#9fb0b8', 0.025);
    // Lint bins and a mop sink east of the back door; steel shelves of detergent along the east wall.
    for (const x of [0.8, 1.15]) { mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.5, 12), W('#b9cfe0', 0.26), x, F + 0.25, -5.15); }
    box(1.9, F + 0.3, -5.2, 0.5, 0.6, 0.4, steel); box(1.9, F + 0.59, -5.2, 0.42, 0.006, 0.32, W('#55606a', 0.08), false);
    rod([1.6, F, -5.05], [1.55, F + 1.3, -5.3], 0.014, '#9a7a58'); box(1.6, F + 0.06, -5.0, 0.26, 0.1, 0.1, W('#6f8fa8', 0.2));
    const sx = IX1 - 0.2;
    for (const y of [0.3, 0.8, 1.3, 1.8]) { box(sx, F + y, -4.95, 0.36, 0.025, 0.85, steel, false);
      for (let i = 0; i < 4; i++) (i + Math.round(y * 10)) % 3 ? box(sx, F + y + 0.12, -4.62 - i * 0.2, 0.2, 0.22, 0.14, W(['#f2d27e', '#9fc3e0', '#e9ece6'][i % 3], 0.3), false)
        : mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 10), W('#e8a0a8', 0.3), sx, F + y + 0.13, -4.62 - i * 0.2, false); }
    for (const z of [-4.55, -5.35]) for (const dx of [-0.17, 0.17]) box(sx + dx, F + 1.0, z, 0.025, 2.0, 0.025, steel);
    decal(1.4, 1.2, 0, F + 0.003, -4.95, [0, -1], additive(glowT, '#f4f2e6', 0.2));
  }
  group('laundry');

  // ================= forecourt and attachments =================
  group('launFrontW');
  // Two potted plants at the west corner and an umbrella stand by the glass.
  pot(-2.5, 0.19, 0.35, 0.16, 6, 1.6); pot(-2.05, 0.19, 0.32, 0.11, 4, 1.0, '#8f9aa0');
  {
    const x = -0.9, z = 0.3;
    mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.45, 12, 1, true), mat('#8fa6ad'), x, 0.19 + 0.225, z); mesh(new THREE.TorusGeometry(0.14, 0.014, 4, 14), mat('#3d4a58'), x, 0.19 + 0.45, z).rotation.x = PI / 2;
    for (let i = 0; i < 3; i++) { const a = i * 2.1, ux = x + Math.cos(a) * 0.05, uz = z + Math.sin(a) * 0.05; mesh(new THREE.ConeGeometry(0.05, 0.55, 7), mat(['#9fc3e0', '#3d4a58', '#e8a0a8'][i]), ux, 0.19 + 0.6, uz); rod([ux, 0.19 + 0.86, uz], [ux, 0.19 + 0.98, uz], 0.01, '#6b4a32'); }
  }
  group('launFrontE');
  // Vending machine (drinks and travel-size detergent) east of the door, a plant beside it.
  {
    const x = 2.4, z = 0.42, w = 0.72, d = 0.62, h = 1.82;
    box(x, 0.19 + h / 2, z, w, h, d, '#e9ece6'); box(x, 0.19 + 1.15, z + d / 2 + 0.005, w - 0.12, 0.9, 0.012, '#2c3e4c', false);
    const colsV = ['#e8a0a8', '#9fc3e0', '#f2d27e', '#b8d4a8', '#f4efe2'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) { cyl(x - 0.24 + i * 0.12, 0.19 + 0.82 + r * 0.28, z + d / 2 + 0.03, 0.035, 0.15, colsV[(i + r) % 5]); box(x - 0.24 + i * 0.12, 0.19 + 0.72 + r * 0.28, z + d / 2 + 0.03, 0.06, 0.025, 0.015, '#d3dbbf', false); }
    box(x, 0.19 + 1.15, z + d / 2 + 0.04, w - 0.12, 0.9, 0.006, glass, false);
    box(x + 0.22, 0.19 + 0.5, z + d / 2 + 0.01, 0.12, 0.18, 0.03, '#90a6ad'); box(x - 0.08, 0.19 + 0.3, z + d / 2 + 0.01, 0.4, 0.14, 0.035, '#2c3e4c');
    K.label('つめたい · 洗剤', x, 0.19 + 1.7, z + d / 2 + 0.008, w - 0.12, 0.12, '#d6ece2', '#2f5f78', 70);
    mesh(new THREE.PlaneGeometry(1.2, 1.2), additive(glowT, '#cfeef0', 0.18), x, 0.19 + 1.1, z + d / 2 + 0.05, false);
  }
  pot(1.65, 0.19, 0.95, 0.12, 5, 1.2, '#8f9aa0');
  group('launSideE');
  // Split AC outdoor unit on the east side, its pipe cover up the wall.
  box(X1 + 0.2, 0.19 + 0.31, -3.9, 0.3, 0.58, 0.8, '#d6d8d2'); for (const z of [-4.22, -3.58]) box(X1 + 0.2, 0.2, z, 0.28, 0.02, 0.06, '#7f8b93', false);
  mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), X1 + 0.355, 0.52, -4.02, false).rotation.y = PI / 2;
  for (let i = 0; i < 4; i++) box(X1 + 0.357, 0.4 + i * 0.08, -4.02, 0.01, 0.012, 0.38, '#9aa6ab', false);
  box(X1 + 0.06, 1.25, -3.45, 0.1, 1.4, 0.1, '#e1ddd2'); box(X1 + 0.06, 0.6, -3.57, 0.1, 0.1, 0.25, '#e1ddd2');
  group('launGas');
  // Fenced cage of LP gas cylinders (for the dryers) at the rear west corner.
  {
    const x0 = -2.75, x1 = -1.95, z0 = Z1 - 0.08, z1 = Z1 - 0.62, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(cx, 0.19 + 0.04, cz, x1 - x0, 0.08, z0 - z1, '#a8aaa4');
    for (const x of [x0 + 0.17, x0 + 0.42, x0 + 0.65]) { cyl(x, 0.27 + 0.5, cz, 0.12, 1.0, '#b9c0c4'); mesh(new THREE.SphereGeometry(0.12, 10, 5, 0, 2 * PI, 0, PI / 2), mat('#b9c0c4'), x, 1.27, cz); cyl(x, 1.42, cz, 0.04, 0.12, '#7f878a'); }
    for (const x of [x0, x1]) for (const z of [z0, z1]) box(x, 0.19 + 0.7, z, 0.04, 1.4, 0.04, '#5f6c76');
    for (const y of [0.35, 1.55]) { box(cx, y, z1, x1 - x0, 0.03, 0.03, '#5f6c76'); for (const x of [x0, x1]) box(x, y, cz, 0.03, 0.03, z0 - z1, '#5f6c76'); }
    for (let i = 0; i < 9; i++) box(x0 + 0.04 + i * (x1 - x0 - 0.08) / 8, 0.95, z1, 0.008, 1.2, 0.008, '#7f878a', false);
    for (let i = 0; i < 6; i++) for (const x of [x0, x1]) box(x, 0.95, z0 - 0.04 - i * (z0 - z1 - 0.08) / 5, 0.008, 1.2, 0.008, '#7f878a', false);
  }
  group('launService');
  // Green storage box (bins) and two small sorted bins at the rear east, beside the back door.
  {
    const z = Z1 - 0.38;
    box(1.25, 0.19 + 0.36, z, 0.95, 0.72, 0.55, '#5f8a74'); const lid = box(1.25, 0.19 + 0.75, z, 0.99, 0.06, 0.6, '#527a66'); lid.rotation.x = -0.04;
    for (const x of [0.95, 1.55]) box(x, 0.19 + 0.55, z + 0.28, 0.12, 0.03, 0.02, '#3d4a58', false);
    box(2.05, 0.19 + 0.33, z, 0.4, 0.66, 0.46, '#4f7290'); box(2.05, 0.19 + 0.68, z, 0.44, 0.05, 0.5, '#4f7290');
    box(2.5, 0.19 + 0.3, z, 0.36, 0.6, 0.42, '#8f969a'); box(2.5, 0.19 + 0.62, z, 0.4, 0.04, 0.46, '#7c8387');
  }
  group('launGround');
  // Forecourt pavers to the sidewalk, rear path and service pad; entrance mat; window light on the wet ground.
  const paveMat = warm('#ffffff', 0, pavers);
  const pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-3.6, 3.6, 0, 1.9); pave(-2.9, 2.9, -6.9, -5.6);
  box(0, 0.214, 0.75, 1.0, 0.014, 0.5, '#4f5a5f', false); box(0, 0.222, 0.75, 0.82, 0.004, 0.36, '#6d7d82', false);
  const spill = additive(spillT, '#ffd9a0', 0.26);
  decal(2.0, 1.7, (FW1[0] + FW1[1]) / 2, 0.208, 0.88, [0, -1], spill); decal(1.1, 1.5, 0, 0.226, 0.9, [0, -1], spill); decal(1.2, 1.4, (FW2[0] + FW2[1]) / 2, 0.208, 0.8, [0, -1], spill);
  decal(1.3, 0.9, 0, 0.208, Z1 - 0.45, [0, 1], additive(glowT, '#ffd59a', 0.22));

  // ================= local animation: window rain, one turning drum, a breathing status light =================
  const fx = new THREE.Group(); fx.userData.live = true; group('laundry').add(fx); K.setRoot(fx);
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6);
  for (const [w, n] of [[FW1, 14], [FW2, 7]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.2 + rnd() * 1.5, -0.066, 0.07 + rnd() * 0.06, w[2] + 0.1, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 4; i++) runs.add(-0.4 + rnd() * 0.8, 0.8 + rnd() * 1.3, 0.0, 0.08, 0.5, 2.3, 0.09 + rnd() * 0.05);
  for (let i = 0; i < 14; i++) drips.add(-2.65 + i * 0.4 + rnd() * 0.12, 0.25 + rnd() * 2, 0.56, 0.09, 0.25, 2.5, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 3; i++) drips.add(-0.5 + i * 0.5, 0.25 + rnd() * 2, Z1 - 0.34, 0.09, 0.25, 2.4, 2.1 + rnd() * 0.5);
  runs.seal(); drips.seal();
  // The middle washer runs: its load tumbles slowly (one turn every ~5 s) behind the porthole, a soft blue light inside.
  const run = drums[1], tumble = new THREE.Group(); tumble.position.set(run.x - run.dir * run.d * 0.27, run.cy, run.z); fx.add(tumble);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 2 * PI, rr = run.r * (0.45 + rnd() * 0.35); lump(0, Math.sin(a) * rr, Math.cos(a) * rr, 0.09, undefined, tumble); }
  const foam = mesh(new THREE.CircleGeometry(run.r * 0.9, 20), new THREE.MeshBasicMaterial({ color: '#bfe4f0', transparent: true, opacity: 0.22, depthWrite: false }), run.x - run.dir * 0.03, run.cy, run.z, false); foam.rotation.y = PI / 2;
  // Status light of the running machine: amber, breathing slowly (no flicker).
  const status = new THREE.MeshBasicMaterial({ color: '#ffc870', transparent: true, opacity: 0.9, depthWrite: false });
  box(run.x + 0.009, F + 0.1 + 1.45 - 0.1, run.z + 0.8 * 0.28, 0.006, 0.05, 0.08, status, false);
  const halo = mesh(new THREE.PlaneGeometry(0.3, 0.3), additive(glowT, '#ffc870', 0.25), run.x + 0.012, F + 1.45, run.z + 0.22, false); halo.rotation.y = PI / 2;
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt);
      tumble.rotation.x = t * 1.25;
      const k = 0.5 + 0.5 * Math.sin(t * 1.1); status.opacity = 0.55 + 0.4 * k; halo.material.opacity = 0.12 + 0.16 * k; foam.material.opacity = 0.16 + 0.08 * Math.sin(t * 0.7);
    },
  };
};
