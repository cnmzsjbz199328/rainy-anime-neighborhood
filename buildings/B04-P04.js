// B04-P04 辻の小社 (Tsuji no Hokora): a small street-corner shrine — a one-bay hall under a pyramid (hōgyō) roof with a gabled
// front porch (kohai), inside a low fenced yard on the block corner. Task card docs/buildings/tasks/B04-P04.md, reference
// docs/buildings/references/B04-P04.jpg.
// Local frame (placed by layout.js `buildings`, rotY π): front +z faces the north street (world N), local +x = world W,
// local -x = world E. The origin is the foot of the stone steps on the approach axis (the shrine's "door": the street
// entrance x = 11 lines up with it); the hall door is up the steps at z = -1.45. Plot in local coordinates: x -5 … 5,
// z -5.5 … 3.5 (front fence z = 2.85, rear fence z = -5.33); buildable x -4 … 3, z -4.5 … 1.5 (the west street is local +x).
// Groups: hokora (hall, porch, pyramid roof, steps, bell, interior) · hokoraToriiE/W (two halves of the torii, one post each at
// walking height so the approach stays open) · hokoraLanternE/W · hokoraChozu · hokoraEma · hokoraStele · hokoraJizo ·
// hokoraRain (rain-chain basin) · hokoraFenceE/W/R/FE/FW (stone-footed bamboo fence, one group per side) · hokoraTreeNE/NW/SE ·
// hokoraGround (grass, raked gravel, stone approach, light pools).
// Plan: torii → gravel yard with lanterns, basin, ema rack → three small steps → porch with bell, offering box → lattice doors →
// worship room (cushion, lanterns) → lattice partition → altar with a miniature shrine, and a plank-walled storage cubby.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B04-P04'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(4404), PI = Math.PI;
  const BASE = 0.19, F = 0.55, WT = 2.62, HX = 1.55, ZF = -1.45, ZR = -3.75, T = 0.14, EAVE = 2.66, HW = 2.2, RZ0 = -0.5, RZ1 = -4.35, CEIL = WT - 0.04;
  const ZC = (RZ0 + RZ1) / 2, HD = (RZ0 - RZ1) / 2, RISE = 0.95;
  const IX = HX - T, IZ0 = ZF - T, IZ1 = ZR + T;
  const FD = [-0.62, 0.62, F, F + 1.95], FWa = [-1.3, -0.82, F + 0.85, F + 1.65], FWb = [0.82, 1.3, F + 0.85, F + 1.65];
  const SW = [-3.35, -2.45, F + 0.85, F + 1.65], RW = [-0.45, 0.45, F + 1.0, F + 1.8];

  // ---- textures and materials ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const boardT = tex(128, 128, (q, w, h) => { q.fillStyle = '#5f4a3a'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '30,20,14' : '160,120,86'},${0.08 + rnd() * 0.1})`; q.fillRect(i * 16, 0, 16, h); q.fillStyle = 'rgba(24,16,10,.6)'; q.fillRect(i * 16, 0, 2, h); }
    for (let i = 0; i < 120; i++) { q.fillStyle = `rgba(30,20,14,${0.1 + rnd() * 0.12})`; q.fillRect(rnd() * w, rnd() * h, 1, 4 + rnd() * 14); } });
  const roofT = tex(128, 128, (q, w, h) => { q.fillStyle = '#3a3f48'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '8,12,18' : '150,170,196'},${0.04 + rnd() * 0.07})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    q.fillStyle = 'rgba(10,14,20,.6)'; for (let i = 0; i < 8; i++) q.fillRect(i * 16, 0, 2, h);
    q.fillStyle = 'rgba(10,14,20,.35)'; for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) q.fillRect(i * 16, ((j * 32) + (i % 2) * 16) % h, 16, 2); });
  const floorT = tex(128, 128, (q, w, h) => { q.fillStyle = '#b89a6c'; q.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '90,60,30' : '255,230,190'},.1)`; q.fillRect(0, i * 21, w, 21); q.fillStyle = 'rgba(70,46,24,.5)'; q.fillRect(0, i * 21, w, 2); } });
  const gravelT = tex(256, 256, (q, w, h) => { q.fillStyle = '#9e9f99'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '70,76,86' : '255,255,250'},${0.08 + rnd() * 0.14})`; const r = 0.7 + rnd() * 1.4; q.beginPath(); q.arc(rnd() * w, rnd() * h, r, 0, 6.3); q.fill(); }
    q.strokeStyle = 'rgba(60,66,76,.28)'; q.lineWidth = 1.5; for (let i = 0; i < 16; i++) { q.beginPath(); q.moveTo(i * 16 + 4, 0); q.bezierCurveTo(i * 16 + 8, 80, i * 16, 170, i * 16 + 4, h); q.stroke(); } });
  const grassT = tex(256, 256, (q, w, h) => { q.fillStyle = '#5a7856'; q.fillRect(0, 0, w, h); q.lineCap = 'round';
    for (let i = 0; i < 1400; i++) { q.strokeStyle = `rgba(${rnd() < 0.5 ? '36,66,48' : '120,156,100'},${0.1 + rnd() * 0.16})`; q.lineWidth = 1; const x = rnd() * w, y = rnd() * h, l = 4 + rnd() * 7; q.beginPath(); q.moveTo(x, y); q.lineTo(x + l * 0.4, y - l); q.stroke(); } });
  const paveT = tex(128, 128, (q, w, h) => { q.fillStyle = '#8f8d87'; q.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '50,58,70' : '240,240,232'},${0.05 + rnd() * 0.09})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2); } });
  const glowT = canvasTex(128, 128, (q, w) => { const g = q.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.33)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, w); });
  const spillT = canvasTex(128, 128, (q, w, h) => { const g = q.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, h);
    q.globalCompositeOperation = 'destination-in'; const s = q.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.18, 'rgba(0,0,0,1)'); s.addColorStop(0.82, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = s; q.fillRect(0, 0, w, h); });
  const toon = map => new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map });
  const boardM = toon(boardT), roofM = toon(roofT);
  const wcache = {}, W = (c, k = 0.3) => wcache[c + k] || (wcache[c + k] = warm(c, k));
  const additive = (map, c, o) => new THREE.MeshBasicMaterial({ map, color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' });
  const cream = W('#e9dcc0', 0.34), post = '#4a382b', dark = '#3a2d24', verm = '#c4412e', vermD = '#8f2f25', stone = '#8f8d88', stoneD = '#767670', gold = '#d9b45a';
  const decal = (w, h, x, y, z, heading, m, parent) => { const a = mesh(new THREE.PlaneGeometry(w, h), m, x, y, z, false, parent); a.rotation.set(-PI / 2, Math.atan2(-heading[0], -heading[1]), 0, 'YXZ'); return a; };
  const ab = (axis, u, y, d, w, h, t, c, o = true, p) => axis === 'x' ? box(u, y, d, w, h, t, c, o, p) : box(d, y, u, t, h, w, c, o, p);
  const shapeMesh = (pts, depth, c, x, y, z, ry = 0) => { const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 }); const m = mesh(g, c, x, y, z); m.rotation.y = ry; return m; };
  const rod = (a, b, r, c, parent) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 5, 1, true), typeof c === 'string' ? mat(c) : c, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, false, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  const lattice = (axis, at, [a, b, p, q], n, c, depth = 0.05) => {
    const l = (u, y, w, h) => axis === 'x' ? box(u, y, at, w, h, depth, c, false) : box(at, y, u, depth, h, w, c, false);
    l(a + 0.03, (p + q) / 2, 0.06, q - p); l(b - 0.03, (p + q) / 2, 0.06, q - p); l((a + b) / 2, q - 0.03, b - a, 0.06); l((a + b) / 2, p + 0.03, b - a, 0.06);
    for (let i = 1; i < n; i++) l(a + (b - a) * i / n, (p + q) / 2, 0.025, q - p - 0.1);
    l((a + b) / 2, (p + q) / 2, b - a - 0.1, 0.025);
  };

  // ---- plants ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), GREEN = ['#5f8a5e', '#78a272', '#4d7a58'], PINK = ['#e9a9b8', '#f0bccb', '#d98fa4'], HYD = ['#7b8fd0', '#9b86c4', '#6f7fc0'];
  const shrub = (x, y, z, r, n, cols = GREEN, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(cols[i % cols.length]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.8 + rnd() * r * h * 0.7, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.5 + rnd() * 0.25)); } };
  const tree = (x, z, h, r, cols, n) => {
    mesh(new THREE.CylinderGeometry(0.07, 0.13, h * 0.6, 7), mat('#4d3d30'), x, BASE + h * 0.3, z);
    mesh(new THREE.CylinderGeometry(0.04, 0.07, h * 0.3, 6), mat('#4d3d30'), x + r * 0.25, BASE + h * 0.55, z).rotation.z = -0.5;
    for (let i = 0; i < n; i++) { const a = rnd() * PI * 2, d = rnd() * r * 0.8, s = r * (0.45 + rnd() * 0.3);
      const m = mesh(leafG, mat(cols[i % cols.length]), x + Math.cos(a) * d, BASE + h - r * 0.95 + (rnd() - 0.3) * r * 0.6, z + Math.sin(a) * d, false); m.scale.setScalar(s); }
  };

  // ================= hall =================
  const gHall = group('hokora');
  // Stone plinth, porch base and three small stone steps (the lowest tread stays below walking height).
  box(0, (BASE + F - 0.04) / 2, (ZF + ZR) / 2, 2 * HX + 0.24, F - 0.04 - BASE, ZF - ZR + 0.24, stone);
  box(0, (BASE + F - 0.06) / 2, -0.95, 3.2, F - 0.06 - BASE, 1.0, stoneD);
  box(0, (BASE + 0.42) / 2, -0.36, 2.0, 0.42 - BASE, 0.18, stone); box(0, (BASE + 0.29) / 2, -0.18, 2.0, 0.29 - BASE, 0.18, stone);
  for (const s of [-1, 1]) { box(s * 1.1, 0.3, -0.27, 0.16, 0.22, 0.34, stoneD); box(s * 1.1, 0.4, -0.7, 0.16, 0.42, 0.5, stoneD); }
  // Porch deck, rails, posts.
  box(0, F - 0.03, -0.95, 3.2, 0.06, 1.0, W('#a0804f', 0.26));
  for (let i = 0; i < 5; i++) box(0, F + 0.003, -0.5 - i * 0.17, 3.16, 0.012, 0.012, post, false);
  for (const s of [-1, 1]) { const x = s * 1.45; box(x, F + 0.95, -0.55, 0.1, 1.9, 0.1, post); box(x, F + 0.45, -1.0, 0.06, 0.08, 0.9, post, false); box(x, F + 0.82, -1.0, 0.08, 0.05, 0.9, dark); box(x, F + 0.22, -1.0, 0.04, 0.04, 0.9, post, false); box(x, F + 0.025, -0.55, 0.22, 0.05, 0.22, stoneD); }
  // Walls: dark boarded timber with lattice windows and the double lattice door.
  wall('x', ZF - T / 2, T, [-HX, HX, F - 0.02, WT], [FD, FWa, FWb], boardM);
  wall('x', ZR + T / 2, T, [-HX, HX, F - 0.02, WT], [RW], boardM);
  wall('z', HX - T / 2, T, [ZR, ZF, F - 0.02, WT], [SW], boardM);
  wall('z', -HX + T / 2, T, [ZR, ZF, F - 0.02, WT], [SW], boardM);
  for (const [x, z] of [[-HX, ZF], [HX, ZF], [-HX, ZR], [HX, ZR]]) box(x, (F + WT) / 2, z, 0.14, WT - F, 0.14, post);
  for (const x of [-0.65, 0.65]) box(x, F + 1.0, ZF + 0.02, 0.1, 2.0, 0.1, post);
  box(0, F + 2.0, ZF + 0.03, 1.4, 0.12, 0.12, post); box(0, WT - 0.05, ZF + 0.02, 2 * HX + 0.1, 0.1, 0.12, dark); box(0, WT - 0.05, ZR - 0.02, 2 * HX + 0.1, 0.1, 0.12, dark);
  for (const s of [-1, 1]) box(s * (HX + 0.02), WT - 0.05, (ZF + ZR) / 2, 0.12, 0.1, ZF - ZR + 0.1, dark);
  for (const [axis, at, w, n] of [['x', ZF + 0.03, FWa, 4], ['x', ZF + 0.03, FWb, 4], ['z', HX, SW, 6], ['z', -HX, SW, 6], ['x', ZR, RW, 8]]) lattice(axis, at, w, n, '#4a382b');
  // Door leaves: lattice upper part over a solid lower panel, brass handles.
  for (const s of [-1, 1]) { const x0 = s < 0 ? -0.58 : 0.02, x1 = s < 0 ? -0.02 : 0.58, z = ZF;
    lattice('x', z, [x0, x1, F + 0.5, F + 1.92], 5, '#6d3226'); box((x0 + x1) / 2, F + 0.26, z, x1 - x0, 0.48, 0.05, '#6d3226'); box((x0 + x1) / 2, F + 0.26, z + 0.03, x1 - x0 - 0.12, 0.32, 0.012, '#5a2a20', false);
    box(s * 0.06, F + 1.0, z + 0.04, 0.025, 0.14, 0.025, gold); }
  // Name plaque above the door; rear: vertical battens and an ofuda board; sides: a mid rail.
  K.label('辻の小社', 0, WT - 0.2, ZF + 0.075, 0.8, 0.2, '#d8c9a2', '#3a2d24', 110); box(0, WT - 0.2, ZF + 0.05, 0.86, 0.26, 0.03, dark, false);
  for (const s of [-1, 1]) box(s * (HX + 0.01), F + 1.3, (ZF + ZR) / 2, 0.04, 0.05, ZF - ZR - 0.3, post, false);
  box(0.95, F + 1.4, ZR - 0.05, 0.36, 0.46, 0.04, '#5b4a3a'); box(0.95, F + 1.4, ZR - 0.075, 0.28, 0.38, 0.012, W('#e6dcc0', 0.4), false);

  // ---- roof layer: pyramid (hōgyō) roof, hip ridges, finial, gabled porch roof, gutters, soffit and ceiling ----
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; gHall.add(roofLayer); K.setRoot(roofLayer);
  { const g = new THREE.ConeGeometry(1, RISE, 4); g.rotateY(PI / 4); const c = mesh(g, roofM, 0, EAVE + RISE / 2, ZC); c.scale.set(HW / 0.7071, 1, HD / 0.7071); }
  box(0, EAVE - 0.03, ZC, 2 * HW + 0.06, 0.08, 2 * HD + 0.06, '#2b2f36');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod([sx * HW, EAVE + 0.02, ZC + sz * HD], [0, EAVE + RISE, ZC], 0.045, '#2b2f36');
  cyl(0, EAVE + RISE + 0.12, ZC, 0.05, 0.24, '#2b2f36'); mesh(new THREE.SphereGeometry(0.11, 10, 8), mat(gold), 0, EAVE + RISE + 0.34, ZC); mesh(new THREE.ConeGeometry(0.05, 0.12, 8), mat(gold), 0, EAVE + RISE + 0.5, ZC);
  box(0, EAVE - 0.07, ZC, 2 * HW - 0.1, 0.04, 2 * HD - 0.1, '#3a2d24', false);
  // porch gable roof (kohai): a small gable whose rear end disappears into the front slope
  shapeMesh([[-1.78, 0], [1.78, 0], [0, 0.55]], 1.3, roofM, 0, F + 1.95, -1.15);
  shapeMesh([[-1.84, -0.07], [1.84, -0.07], [0.0, 0.57], [-1.84, -0.07]], 0.07, '#2b2f36', 0, F + 1.95, 0.15);
  { const g = box(0, F + 2.28, 0.19, 0.28, 0.28, 0.04, vermD); g.rotation.z = PI / 4; box(0, F + 2.28, 0.215, 0.09, 0.09, 0.02, gold, false); }
  box(0, F + 1.9, -0.55, 3.2, 0.2, 0.16, post); for (const s of [-1, 1]) { box(s * 1.38, F + 1.8, -0.55, 0.3, 0.1, 0.22, dark); box(s * 1.1, F + 1.83, -0.6, 0.15, 0.13, 0.1, dark); }
  box(0, F + 1.97, -0.9, 3.4, 0.04, 0.9, '#3a2d24', false);
  // ceiling inside, eave gutters, downpipe at the rear west corner, bell, shimenawa with shide, hanging lanterns
  box(0, CEIL, (IZ0 + IZ1) / 2, 2 * IX, 0.04, IZ0 - IZ1, W('#a98b62', 0.3), false); for (let i = 1; i < 3; i++) box(0, CEIL - 0.04, IZ0 - i * (IZ0 - IZ1) / 3, 2 * IX, 0.05, 0.07, '#6f4f3a', false);
  for (const s of [-1, 1]) box(s * (HW - 0.03), EAVE - 0.13, ZC, 0.1, 0.07, 2 * HD - 0.1, '#6d5b45');
  box(0, EAVE - 0.13, RZ1 + 0.04, 2 * HW - 0.1, 0.07, 0.1, '#6d5b45'); box(0, EAVE - 0.13, RZ0 - 0.04, 2 * HW - 0.1, 0.07, 0.1, '#6d5b45');
  cyl(HW - 0.1, 1.4, RZ1 + 0.06, 0.035, 2.4, '#6d5b45'); box(HW - 0.1, 0.25, RZ1 + 0.06, 0.16, 0.05, 0.16, stoneD);
  rod([0, F + 1.82, -0.55], [0, F + 1.7, -0.78], 0.02, '#3a2d24'); mesh(new THREE.SphereGeometry(0.09, 10, 7), mat(gold), 0, F + 1.6, -0.78); cyl(0, F + 1.5, -0.78, 0.09, 0.03, '#b08a3a');
  line([[0, F + 1.5, -0.78], [0, F + 1.0, -0.78]], '#c9c2b0', 0.02); for (const [y, c] of [[F + 1.35, verm], [F + 1.1, '#e8e2d2']]) cyl(0, y, -0.78, 0.027, 0.18, c);
  line([[-1.4, F + 1.78, -0.62], [-0.7, F + 1.66, -0.62], [0, F + 1.72, -0.62], [0.7, F + 1.66, -0.62], [1.4, F + 1.78, -0.62]], '#d8c79a', 0.04);
  for (const x of [-1.05, -0.5, 0.5, 1.05]) { const y = F + 1.7; for (const k of [0, 1]) box(x + (k ? 0.03 : -0.03), y - 0.12 - k * 0.11, -0.62, 0.08, 0.1, 0.012, '#f2eee2', false).rotation.z = k ? 0.3 : -0.3; }
  for (const s of [-1, 1]) { line([[s * 1.0, F + 1.82, -0.6], [s * 1.0, F + 1.66, -0.6]], '#3a2d24', 0.012); box(s * 1.0, F + 1.54, -0.6, 0.16, 0.24, 0.16, '#3d4a58'); box(s * 1.0, F + 1.54, -0.6, 0.12, 0.18, 0.165, bulb, false); box(s * 1.0, F + 1.68, -0.6, 0.2, 0.04, 0.2, '#2b2f36', false);
    mesh(new THREE.PlaneGeometry(0.8, 0.8), additive(glowT, '#ffc27e', 0.26), s * 1.0, F + 1.54, -0.45, false); }

  // ================= interior =================
  group('hokora');
  box(0, F - 0.02, (IZ0 + IZ1) / 2, 2 * IX, 0.04, IZ0 - IZ1, warm('#ffffff', 0.2, floorT));
  panel('x', IZ0 - 0.006, 0.012, [-IX, IX, F, CEIL], [FD, FWa, FWb], cream); panel('x', IZ1 + 0.006, 0.012, [-IX, IX, F, CEIL], [RW], cream);
  panel('z', IX - 0.006, 0.012, [IZ1, IZ0, F, CEIL], [SW], cream); panel('z', -IX + 0.006, 0.012, [IZ1, IZ0, F, CEIL], [SW], cream);
  box(0, F + 0.3, IZ1 + 0.01, 2 * IX, 0.6, 0.012, W('#8f6f4c', 0.3), false);
  // Near layer: worship cushion on a woven mat, two standing paper lanterns.
  box(0, F + 0.012, -2.0, 1.4, 0.024, 0.8, W('#b2a977', 0.28), false); box(0, F + 0.06, -2.0, 0.4, 0.07, 0.4, W('#8f3a3a', 0.4));
  for (const s of [-1, 1]) { box(s * 0.95, F + 0.35, -1.95, 0.03, 0.7, 0.03, '#59402c', false); const l = mesh(new THREE.SphereGeometry(1, 8, 6), bulb, s * 0.95, F + 0.85, -1.95, false); l.scale.set(0.12, 0.16, 0.12); mesh(new THREE.PlaneGeometry(0.8, 0.8), additive(glowT, '#ffc27e', 0.22), s * 0.95, F + 0.85, -1.8, false); }
  // Middle layer: lattice partition with a central opening.
  { const z = -2.75; for (const x of [-1.3, -0.45, 0.45, 1.3]) box(x, F + 0.8, z, 0.07, 1.6, 0.07, '#5a4636', false);
    box(0, F + 1.6, z, 2.7, 0.07, 0.07, '#5a4636', false); for (const s of [-1, 1]) { box(s * 0.88, F + 0.26, z, 0.84, 0.52, 0.04, W('#8a6a48'), false); for (let i = 0; i < 6; i++) box(s * (0.47 + i * 0.14), F + 1.06, z, 0.02, 1.0, 0.03, '#5a4636', false); box(s * 0.88, F + 0.56, z, 0.84, 0.04, 0.05, '#5a4636', false); } }
  // Back layer, centre-east: altar table with offerings and a miniature shrine on a shelf.
  box(-0.35, F + 0.16, -3.3, 0.9, 0.32, 0.46, W('#8a6a48', 0.28)); box(-0.35, F + 0.33, -3.3, 0.96, 0.02, 0.5, W('#8f3a3a', 0.4), false);
  for (const [dx, c] of [[-0.28, '#f2eee2'], [0.0, '#d9bd8a'], [0.28, '#e8e4d8']]) cyl(-0.35 + dx, F + 0.4, -3.28, 0.06, 0.1, W(c, 0.4));
  box(-0.35, F + 0.9, -3.55, 0.8, 0.05, 0.3, W('#6a5a40', 0.3)); box(-0.35, F + 0.62, -3.55, 0.04, 0.55, 0.04, '#59402c', false);
  box(-0.35, F + 1.1, -3.55, 0.5, 0.34, 0.26, W('#c9a553', 0.4)); shapeMesh([[-0.33, 0], [0.33, 0], [0, 0.2]], 0.3, '#2e333b', -0.35, F + 1.27, -3.7);
  box(-0.35, F + 1.1, -3.41, 0.3, 0.26, 0.012, W('#6b3a2a', 0.3), false);
  for (const s of [-1, 1]) { cyl(-0.35 + s * 0.5, F + 0.45, -3.3, 0.045, 0.2, W('#e8e4d8', 0.4)); const g = mesh(leafG, W('#5f8a5a', 0.3), -0.35 + s * 0.5, F + 0.62, -3.3, false); g.scale.set(0.1, 0.14, 0.08); }
  mesh(new THREE.CircleGeometry(0.13, 18), W('#e8d68a', 0.8), -0.35, F + 1.62, IZ1 + 0.012, false); mesh(new THREE.RingGeometry(0.13, 0.16, 18), W('#6a5a40', 0.3), -0.35, F + 1.62, IZ1 + 0.011, false);
  // Back layer, west: plank-walled storage cubby with shelves of boxes, a bucket and rolled mats.
  { const x0 = 0.55, x1 = IX; box(x0, F + 0.95, -3.2, 0.05, 1.9, 0.82, W('#7a5a40', 0.28)); box((x0 + x1) / 2, F + 1.9, -3.2, x1 - x0, 0.05, 0.82, W('#7a5a40', 0.28), false);
    for (const y of [0.5, 1.0, 1.45]) box((x0 + x1) / 2 + 0.02, F + y, -3.3, x1 - x0 - 0.06, 0.04, 0.4, W('#8a6a48', 0.28), false);
    for (let i = 0; i < 3; i++) box(x0 + 0.2 + i * 0.22, F + 0.65, -3.3, 0.18, 0.2, 0.3, W(['#9a7a54', '#b0906a', '#8a6b45'][i], 0.3));
    for (let i = 0; i < 2; i++) box(x0 + 0.25 + i * 0.3, F + 1.14, -3.3, 0.26, 0.2, 0.3, W('#d9bd8a', 0.4));
    cyl(x0 + 0.5, F + 0.2, -3.0, 0.14, 0.38, W('#5d6a72', 0.3)); for (let i = 0; i < 2; i++) cyl(x1 - 0.12 - i * 0.12, F + 0.5, -3.55, 0.05, 0.9, W('#b2a977', 0.3)); }
  for (let i = 0; i < 4; i++) box(IX - 0.012, F + 1.45 + (i % 2) * 0.2, -1.95 - i * 0.15, 0.012, 0.16, 0.11, W('#d9bd8a', 0.5), false);
  for (const [x, z, r] of [[0, -2.0, 1.6], [-0.3, -3.2, 1.3], [0, -1.0, 1.4]]) decal(r, r, x, F + 0.008, z, [0, -1], additive(glowT, '#ffc988', 0.28));
  // Porch: offering box.
  box(0, F + 0.25, -0.9, 0.9, 0.5, 0.42, W('#8a6a48', 0.26)); for (let i = 0; i < 7; i++) box(-0.36 + i * 0.12, F + 0.52, -0.9, 0.05, 0.02, 0.38, W('#3a2d24', 0.15), false);
  decal(1.8, 0.9, 0, F + 0.01, -0.7, [0, -1], additive(spillT, '#ffbf7a', 0.22));

  // ================= yard attachments =================
  const lanternAt = (name, x) => {
    group(name); const z = 1.0;
    box(x, BASE + 0.07, z, 0.5, 0.14, 0.5, stoneD); cyl(x, BASE + 0.2, z, 0.2, 0.1, stone); cyl(x, BASE + 0.5, z, 0.085, 0.5, stone); cyl(x, BASE + 0.78, z, 0.17, 0.08, stone);
    box(x, BASE + 1.0, z, 0.36, 0.36, 0.36, stone); for (const [dx, dz, w, d] of [[0, 0.184, 0.24, 0.012], [0, -0.184, 0.24, 0.012], [0.184, 0, 0.012, 0.24], [-0.184, 0, 0.012, 0.24]]) box(x + dx, BASE + 1.0, z + dz, w, 0.24, d, bulb, false);
    mesh(new THREE.ConeGeometry(0.34, 0.26, 4), mat(stone), x, BASE + 1.31, z).rotation.y = PI / 4; mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(stone), x, BASE + 1.5, z);
    const gm = additive(glowT, '#ffc27e', 0.3); for (const r of [0, PI / 2]) mesh(new THREE.PlaneGeometry(1.2, 1.2), gm, x, BASE + 1.0, z, false).rotation.y = r;
    decal(2.0, 2.0, x, 0.206, z, [0, -1], additive(glowT, '#ffc27e', 0.22)); return gm; };
  const gmE = lanternAt('hokoraLanternE', -1.95), gmW = lanternAt('hokoraLanternW', 1.95);
  const toriiHalf = (name, s) => {
    group(name); const x = s * 1.1, z = 2.15, top = 2.9;
    box(x, BASE + 0.025, z, 0.46, 0.05, 0.46, stoneD); cyl(x, BASE + 0.25, z, 0.17, 0.4, '#25232a'); mesh(new THREE.CylinderGeometry(0.12, 0.15, top - 0.65, 10), mat(verm), x, 0.58 + (top - 0.65) / 2, z);
    box(s * 0.85, top + 0.08, z, 1.7, 0.13, 0.26, '#2b2f36'); box(s * 0.85, top + 0.16, z, 1.74, 0.05, 0.32, '#1f2329'); const e = box(s * 1.65, top + 0.13, z, 0.46, 0.13, 0.26, '#2b2f36'); e.rotation.z = s * 0.28;
    box(s * 0.8, top - 0.1, z, 1.6, 0.1, 0.18, verm); box(s * 0.8, 2.25, z, 1.6, 0.1, 0.15, verm); box(s * 1.35, 2.25, z, 0.36, 0.1, 0.15, vermD, false);
    if (s < 0) { box(0, 2.6, z, 0.5, 0.52, 0.05, '#2b2f36'); K.label('雨町', 0, 2.6, z + 0.03, 0.42, 0.44, '#2b2f36', gold, 190); K.label('雨町', 0, 2.6, z - 0.03, 0.42, 0.44, '#2b2f36', gold, 190).rotation.y = PI; }
    decal(1.5, 1.5, x, 0.206, z, [0, -1], additive(glowT, '#9fb6d8', 0.06)); };
  toriiHalf('hokoraToriiE', -1); toriiHalf('hokoraToriiW', 1);
  const gChozu = group('hokoraChozu'); {
    const x = -3.1, z = 1.4;
    box(x, BASE + 0.18, z, 0.7, 0.36, 0.7, stoneD); cyl(x, BASE + 0.45, z, 0.34, 0.26, stone); cyl(x, BASE + 0.59, z, 0.27, 0.02, '#4f6f86');
    for (const [dx, dz, r] of [[0.5, 0.2, 0.14], [-0.4, -0.3, 0.12], [0.35, -0.55, 0.1]]) mesh(leafG, mat(stone), x + dx, BASE + r * 0.62, z + dz, false).scale.set(r, r * 0.6, r);
    box(x - 0.55, BASE + 0.45, z - 0.3, 0.07, 0.9, 0.07, '#59402c'); rod([x - 0.55, BASE + 0.8, z - 0.3], [x - 0.12, BASE + 0.68, z - 0.05], 0.03, '#9a8f5a');
    box(x + 0.35, BASE + 0.63, z + 0.05, 0.4, 0.015, 0.03, '#9a8f5a', false); cyl(x + 0.55, BASE + 0.63, z + 0.05, 0.05, 0.04, '#9a8f5a');
    shrub(x - 0.7, BASE, z + 0.4, 0.22, 4, GREEN, 1.3); shrub(x + 0.7, BASE, z - 0.3, 0.2, 3, GREEN, 1.2);
    decal(1.8, 1.8, x, 0.206, z, [0, -1], additive(glowT, '#8fb0d8', 0.1)); }
  group('hokoraEma'); {
    const x = 3.1, z = 0.4; for (const s of [-1, 1]) box(x + s * 0.55, BASE + 0.6, z, 0.07, 1.2, 0.07, '#59402c'); box(x, BASE + 1.18, z, 1.3, 0.05, 0.1, '#59402c');
    box(x, BASE + 0.35, z, 1.1, 0.05, 0.08, '#59402c'); shapeMesh([[-0.75, 0], [0.75, 0], [0, 0.22]], 0.5, '#2b2f36', x, BASE + 1.2, z - 0.25);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) { box(x - 0.45 + c * 0.18, BASE + 1.0 - r * 0.34, z, 0.14, 0.2, 0.012, W(['#d9bd8a', '#c9a070', '#e0cca0'][(r + c) % 3], 0.45)); line([[x - 0.45 + c * 0.18, BASE + 1.18, z], [x - 0.45 + c * 0.18, BASE + 1.1 - r * 0.34, z]], '#7a6648', 0.005); }
    mesh(new THREE.PlaneGeometry(1.2, 1.2), additive(glowT, '#ffc27e', 0.1), x, BASE + 0.7, z + 0.1, false); }
  group('hokoraStele'); {
    const x = 2.9, z = 2.35; box(x, BASE + 0.1, z, 0.55, 0.2, 0.4, stoneD); box(x, BASE + 0.75, z, 0.34, 1.1, 0.24, stone);
    const c = canvasTex(128, 384, (q, w, h) => { q.fillStyle = '#7d7b76'; q.fillRect(0, 0, w, h); q.fillStyle = '#2a2a2c'; q.font = 'bold 76px sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; [...'辻の小社'].forEach((ch, i) => q.fillText(ch, w / 2, 56 + i * 92)); });
    mesh(new THREE.PlaneGeometry(0.28, 0.98), new THREE.MeshBasicMaterial({ map: c, color: '#c8c8cc' }), x, BASE + 0.75, z + 0.126, false); shrub(x + 0.5, BASE, z - 0.1, 0.2, 3, GREEN, 1.2); }
  // Jizo statue with a red bib, in the rear east corner of the yard.
  group('hokoraJizo'); {
    const x = -3.5, z = -4.35; box(x, BASE + 0.08, z, 0.55, 0.16, 0.5, stoneD); box(x, BASE + 0.22, z, 0.4, 0.12, 0.36, stone);
    mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.5, 8), mat('#a8a7a1'), x, BASE + 0.53, z); mesh(new THREE.SphereGeometry(0.11, 8, 6), mat('#b3b2ab'), x, BASE + 0.86, z);
    box(x, BASE + 0.76, z + 0.06, 0.2, 0.1, 0.1, verm, false); mesh(new THREE.ConeGeometry(0.13, 0.09, 8), mat(vermD), x, BASE + 0.99, z, false);
    cyl(x + 0.4, BASE + 0.09, z + 0.15, 0.05, 0.13, '#8a6d4a'); mesh(leafG, mat('#e8c15a'), x + 0.4, BASE + 0.19, z + 0.15, false).scale.setScalar(0.05);
    shrub(x - 0.5, BASE, z + 0.05, 0.22, 3, GREEN, 1.2); decal(1.6, 1.6, x, 0.206, z, [0, -1], additive(glowT, '#ffc27e', 0.07)); }
  // Rain-chain basin at the rear east eave: chain of cups into a stone basin.
  const gRain = group('hokoraRain'); {
    const x = -1.9, z = -4.55; box(x, BASE + 0.08, z, 0.6, 0.16, 0.6, stoneD); cyl(x, BASE + 0.28, z, 0.26, 0.24, stone); cyl(x, BASE + 0.4, z, 0.2, 0.02, '#4f6f86');
    line([[x, 2.58, z], [x, BASE + 0.4, z]], '#8a8f92', 0.012); for (let i = 0; i < 9; i++) cyl(x, 2.3 - i * 0.24, z, 0.05, 0.08, '#8a6d4a'); shrub(x - 0.45, BASE, z - 0.1, 0.2, 3, GREEN, 1.2); }
  // Fences: low stone footing, stone posts and bamboo slats; one group per side, with the entrance gap kept clear.
  const fence = (name, axis, d, u0, u1, shrubs) => {
    group(name); const len = u1 - u0, n = Math.max(1, Math.round(len / 1.55)), step = len / n;
    ab(axis, (u0 + u1) / 2, BASE + 0.22, d, len, 0.44, 0.3, stone); ab(axis, (u0 + u1) / 2, BASE + 0.46, d, len + 0.02, 0.04, 0.34, stoneD, false);
    for (let i = 0; i <= n; i++) { const u = u0 + i * step; ab(axis, u, BASE + 0.55, d, 0.2, 0.74, 0.2, stoneD); ab(axis, u, BASE + 0.95, d, 0.26, 0.06, 0.26, stone, false); }
    for (const y of [BASE + 0.66, BASE + 0.9]) ab(axis, (u0 + u1) / 2, y, d, len, 0.04, 0.06, '#8a7a50', false);
    for (let u = u0 + 0.12; u < u1 - 0.1; u += 0.15) if (Math.abs(((u - u0) % step)) > 0.14 && Math.abs(((u - u0) % step) - step) > 0.14) ab(axis, u, BASE + 0.76, d, 0.05, 0.62, 0.05, rnd() < 0.5 ? '#b9a26c' : '#a8935c', false);
    for (const [u, off, r, cols, k] of shrubs || []) shrub(axis === 'x' ? u : d + off, BASE, axis === 'x' ? d + off : u, r, k, cols, 1.2); };
  fence('hokoraFenceE', 'z', -4.8, -5.2, 2.8, [[-4.0, 0.45, 0.32, GREEN, 4], [-1.6, 0.5, 0.28, HYD, 5], [0.6, 0.45, 0.28, GREEN, 4]]);
  fence('hokoraFenceW', 'z', 4.8, -5.2, 2.8, [[-4.2, -0.45, 0.3, HYD, 5], [-2.0, -0.4, 0.28, GREEN, 4], [1.8, -0.45, 0.28, GREEN, 4]]);
  fence('hokoraFenceR', 'x', -5.33, -4.85, 4.85, [[-2.6, 0.5, 0.3, GREEN, 4], [2.6, 0.5, 0.3, HYD, 4]]);
  fence('hokoraFenceFE', 'x', 2.85, -4.85, -1.0, [[-4.1, -0.5, 0.28, HYD, 4], [-2.9, -0.45, 0.24, GREEN, 3]]);
  fence('hokoraFenceFW', 'x', 2.85, 1.0, 4.85, [[4.1, -0.5, 0.28, HYD, 4], [1.8, -0.45, 0.22, GREEN, 3]]);
  // Trees: a cherry in the rear east corner, a camphor behind the west side, a small tree at the front east corner.
  group('hokoraTreeNE'); tree(-3.5, -2.6, 3.1, 1.2, PINK, 11);
  group('hokoraTreeNW'); tree(3.8, -3.9, 3.4, 1.3, GREEN, 12);
  group('hokoraTreeSE'); tree(-4.0, 2.0, 2.4, 0.8, GREEN, 8);

  // ================= ground: lawn, raked gravel, stone approach, light pools =================
  group('hokoraGround');
  const grassM = warm('#ffffff', 0, grassT), paveM = warm('#ffffff', 0, paveT);
  const pad = (x0, x1, z0, z1, m, y0, y1, u = 3) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), (x1 - x0) / u, (z1 - z0) / u), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, false);
  pad(-4.95, 4.95, -5.48, 3.48, mat('#5a7856'), BASE, 0.2); { const g = pad(-4.95, 4.95, -5.48, 3.48, toon(grassT), 0.2, 0.202); g.material.polygonOffset = true; }
  pad(-4.2, 4.2, -0.15, 2.8, toon(gravelT), 0.2, 0.212, 2.5);
  for (let i = 0; i < 5; i++) pad(-0.55, 0.55, 2.7 - i * 0.5 - 0.2, 2.7 - i * 0.5 + 0.2, mat('#8c8a84'), 0.2, 0.226, 1);
  pad(-0.55, 0.55, 2.8, 3.48, paveM, 0.19, 0.205, 1);
  for (const [x, z, r] of [[-4.0, -1.0, 0.8], [4.0, -1.8, 0.7], [-2.2, -4.0, 0.7], [2.8, 2.2, 0.45]]) { const m = mesh(new THREE.CircleGeometry(r, 10), mat('#4f7552'), x, 0.204, z, false); m.rotation.x = -PI / 2; m.scale.y = 0.7; }
  decal(2.2, 1.1, -2.5, 0.214, 0.4, [1, 0], additive(spillT, '#ffbf7a', 0.08)); decal(1.6, 0.9, 2.5, 0.212, 0.1, [-1, 0], additive(spillT, '#ffbf7a', 0.1));
  for (const [x, z, w, h] of [[0.0, 0.8, 2.4, 1.0], [-1.4, 2.0, 1.4, 0.7], [1.4, 1.8, 1.4, 0.7]]) decal(w, h, x, 0.214, z, [0, -1], additive(glowT, '#7e9ccc', 0.07));

  // ================= local animation: basin ripples, eave and chain drips, lantern glow =================
  const ripMat = () => new THREE.MeshBasicMaterial({ color: '#cfe6f2', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const rings = [];
  const addRings = (g, x, y, z, r, n) => { const fx = new THREE.Group(); fx.userData.live = true; g.add(fx); for (let i = 0; i < n; i++) { const m = ripMat(), a = mesh(new THREE.RingGeometry(0.7, 1, 24), m, x, y, z, false, fx); a.rotation.x = -PI / 2; rings.push({ a, m, r, off: i / n }); } };
  addRings(gChozu, -3.1, BASE + 0.6, 1.4, 0.24, 3); addRings(gRain, -1.9, BASE + 0.415, -4.55, 0.18, 2);
  const fx = new THREE.Group(); fx.userData.live = true; gHall.add(fx);
  const batch = (c, o, parent = fx) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; parent.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const eave = batch('#cee7e5', 0.6), chain = batch('#d4ecea', 0.55, (() => { const f = new THREE.Group(); f.userData.live = true; gRain.add(f); return f; })());
  for (let i = 0; i < 12; i++) eave.add(-HW + 0.1 + i * 0.35 + rnd() * 0.08, 0.5 + rnd() * 1.8, RZ0 - 0.05, 0.09, 0.45, 2.6, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 8; i++) eave.add(-HW + 0.1 + i * 0.5 + rnd() * 0.1, 0.5 + rnd() * 1.8, RZ1 + 0.05, 0.09, 0.45, 2.6, 2.1 + rnd() * 0.5);
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) eave.add(s * (HW - 0.04), 0.4 + rnd() * 2, RZ1 + 0.25 + i * 0.5, 0.09, 0.25, 2.6, 2.0 + rnd() * 0.5);
  for (let i = 0; i < 6; i++) chain.add(-1.9 + (rnd() - 0.5) * 0.03, 0.6 + i * 0.35, -4.55, 0.2, 0.55, 2.5, 1.5 + rnd() * 0.4);
  eave.seal(); chain.seal();
  return {
    update(t, dt) {
      eave.step(dt); chain.step(dt);
      for (const r of rings) { const p = (t * 0.55 + r.off) % 1; r.a.scale.setScalar(r.r * (0.25 + 0.75 * p)); r.m.opacity = 0.5 * (1 - p); }
      gmE.opacity = 0.27 + 0.05 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1); gmW.opacity = 0.27 + 0.05 * Math.sin(t * 0.8 + 2) * Math.sin(t * 0.41);
    },
  };
};
