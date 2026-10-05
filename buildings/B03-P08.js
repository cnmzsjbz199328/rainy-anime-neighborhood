// B03-P08 雨宿神社 (Amayadori Jinja): a small wooden shrine hall with a walled forecourt on the north side of the main street.
// Task card docs/buildings/tasks/B03-P08.md, reference docs/buildings/references/B03-P08.jpg.
// Local frame (placed by layout.js `buildings`, rotY π): front +z faces the north street (world N), local +x = world W,
// local -x = world E. The origin is the foot of the stone steps on the approach axis (the shrine's "door": the street
// entrance x = -38 lines up with it); the hall door is up the steps at z = -1.8. Floor top (hall) at rec.floor-free 0.6.
// Plot envelope in local z: front fence z = 3.0, rear fence z = -5.0; x = ±7.5.
// Groups: shrine (hall, roof, porch, steps, bell, offering box, interior) · shrineToriiE/W (two halves of the torii:
// each only its own post at walking height, so the path between them stays open) · shrineLanternE/W (stone lanterns) ·
// shrineChozu (water basin, bamboo spout) · shrineEma (votive plaque rack) · shrineStele (name stone) · shrineShed
// (tool shed) · shrineRain (rain-chain basin) · shrineFenceE/W/R/FE/FW (stone-footed bamboo fence, one group per side
// so no group box crosses the approach) · shrineTreeNE/NW/SE/SW · shrineGround (grass, raked gravel, paving, light pools).
// Plan: torii → raked gravel court with lanterns, basin, ema rack → two stone steps → porch with bell rope, offering box
// and umbrella rack → lattice doors → prayer hall (tatami, drum, lanterns) → lattice partition → sanctuary on a dais.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B03-P08'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(3308), PI = Math.PI;
  const BASE = 0.18, F = 0.6, WT = 2.9, HX = 2.1, ZF = -1.8, ZR = -4.3, T = 0.14, EAVE = 2.82, RIDGE = 3.55, HW = 2.75, RZ0 = -0.45, RZ1 = -4.75, CEIL = WT - 0.04;
  const IX = HX - T, IZ0 = ZF - T, IZ1 = ZR + T;
  const FD = [-0.7, 0.7, F, F + 2.0], FWa = [-1.75, -1.0, F + 0.85, F + 1.7], FWb = [1.0, 1.75, F + 0.85, F + 1.7];
  const SW = [-3.7, -2.7, F + 0.85, F + 1.7], RW = [-0.55, 0.55, F + 1.0, F + 1.8];

  // ---- textures and materials ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const boardT = tex(128, 128, (q, w, h) => { q.fillStyle = '#6a523f'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '30,20,14' : '160,120,86'},${0.08 + rnd() * 0.1})`; q.fillRect(i * 16, 0, 16, h); q.fillStyle = 'rgba(24,16,10,.6)'; q.fillRect(i * 16, 0, 2, h); }
    for (let i = 0; i < 120; i++) { q.fillStyle = `rgba(30,20,14,${0.1 + rnd() * 0.12})`; q.fillRect(rnd() * w, rnd() * h, 1, 4 + rnd() * 14); } });
  const roofT = tex(128, 128, (q, w, h) => { q.fillStyle = '#363b44'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '8,12,18' : '150,170,196'},${0.04 + rnd() * 0.07})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    q.fillStyle = 'rgba(10,14,20,.6)'; for (let i = 0; i < 8; i++) q.fillRect(i * 16, 0, 2, h);
    q.fillStyle = 'rgba(10,14,20,.35)'; for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) q.fillRect(i * 16, ((j * 32) + (i % 2) * 16) % h, 16, 2); });
  const floorT = tex(128, 128, (q, w, h) => { q.fillStyle = '#c8a878'; q.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '90,60,30' : '255,230,190'},.1)`; q.fillRect(0, i * 21, w, 21); q.fillStyle = 'rgba(70,46,24,.5)'; q.fillRect(0, i * 21, w, 2); } });
  const gravelT = tex(256, 256, (q, w, h) => { q.fillStyle = '#9e9f99'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '70,76,86' : '255,255,250'},${0.08 + rnd() * 0.14})`; const r = 0.7 + rnd() * 1.4; q.beginPath(); q.arc(rnd() * w, rnd() * h, r, 0, 6.3); q.fill(); }
    q.strokeStyle = 'rgba(60,66,76,.28)'; q.lineWidth = 1.5; for (let i = 0; i < 16; i++) { q.beginPath(); q.moveTo(i * 16 + 4, 0); q.bezierCurveTo(i * 16 + 8, 80, i * 16, 170, i * 16 + 4, h); q.stroke(); } });
  const grassT = tex(256, 256, (q, w, h) => { q.fillStyle = '#5c7a56'; q.fillRect(0, 0, w, h); q.lineCap = 'round';
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
  const wood = W('#b58a58'), woodD = W('#6f4f3a', 0.26), cream = W('#e9dcc0', 0.34), post = '#4a382b', dark = '#3a2d24', verm = '#c4412e', vermD = '#8f2f25', stone = '#8f8d88', stoneD = '#767670', gold = '#d9b45a';
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
  const leafG = new THREE.SphereGeometry(1, 5, 4), GREEN = ['#5f8a5e', '#78a272', '#4d7a58'], RED = ['#a8443f', '#c25a46', '#8f3a3a', '#b8683c'], HYD = ['#7b8fd0', '#9b86c4', '#6f7fc0'];
  const shrub = (x, y, z, r, n, cols = GREEN, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(cols[i % cols.length]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.8 + rnd() * r * h * 0.7, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.5 + rnd() * 0.25)); } };
  const tree = (x, z, h, r, cols, n) => {
    mesh(new THREE.CylinderGeometry(0.07, 0.13, h * 0.6, 7), mat('#4d3d30'), x, BASE + h * 0.3, z);
    mesh(new THREE.CylinderGeometry(0.04, 0.07, h * 0.3, 6), mat('#4d3d30'), x + r * 0.25, BASE + h * 0.55, z).rotation.z = -0.5;
    for (let i = 0; i < n; i++) { const a = rnd() * PI * 2, d = rnd() * r * 0.8, s = r * (0.45 + rnd() * 0.3);
      const m = mesh(leafG, mat(cols[i % cols.length]), x + Math.cos(a) * d, BASE + h - r * 0.95 + (rnd() - 0.3) * r * 0.6, z + Math.sin(a) * d, false); m.scale.setScalar(s); }
  };

  // ================= hall =================
  group('shrine');
  // Stone plinth, porch base and two stone steps (tread 1 stays below walking height, tread 2 is the first obstacle).
  box(0, (BASE + F - 0.04) / 2, (ZF + ZR) / 2, 2 * HX + 0.24, F - 0.04 - BASE, ZF - ZR + 0.24, stone);
  box(0, (BASE + F - 0.06) / 2, -1.17, 3.4, F - 0.06 - BASE, 1.26, stoneD);
  box(0, (BASE + 0.295) / 2, -0.135, 2.3, 0.295 - BASE, 0.27, stone); box(0, (BASE + 0.45) / 2, -0.405, 2.3, 0.45 - BASE, 0.27, stone);
  for (const s of [-1, 1]) { box(s * 1.25, 0.34, -0.3, 0.2, 0.32, 0.6, stoneD); box(s * 1.25, 0.5, -0.8, 0.2, 0.64, 0.46, stoneD); }
  // Porch deck, rails, posts.
  box(0, F - 0.03, -1.17, 3.5, 0.06, 1.28, W('#a0804f', 0.26));
  for (let i = 0; i < 7; i++) box(0, F + 0.003, -0.58 - i * 0.18, 3.46, 0.012, 0.012, '#4a382b', false);
  for (const s of [-1, 1]) { const x = s * 1.72; for (const z of [-0.62, -1.2, -1.76]) box(x, F + 0.45, z, 0.07, 0.9, 0.07, post);
    box(x, F + 0.82, -1.19, 0.09, 0.06, 1.2, dark); box(x, F + 0.45, -1.19, 0.04, 0.05, 1.14, post, false); box(x, F + 0.22, -1.19, 0.04, 0.04, 1.14, post, false); }
  for (const s of [-1, 1]) { cyl(s * 1.5, F + 1.02, -0.66, 0.085, 2.04, '#5a4332'); cyl(s * 1.5, F + 0.05, -0.66, 0.13, 0.1, stoneD); }
  // Walls: dark boarded timber with lattice windows and the double lattice door.
  wall('x', ZF - T / 2, T, [-HX, HX, F - 0.02, WT], [FD, FWa, FWb], boardM);
  wall('x', ZR + T / 2, T, [-HX, HX, F - 0.02, WT], [RW], boardM);
  wall('z', HX - T / 2, T, [ZR, ZF, F - 0.02, WT], [[-3.7, -2.7, F + 0.85, F + 1.7]], boardM);
  wall('z', -HX + T / 2, T, [ZR, ZF, F - 0.02, WT], [[-3.7, -2.7, F + 0.85, F + 1.7]], boardM);
  for (const [x, z] of [[-HX, ZF], [HX, ZF], [-HX, ZR], [HX, ZR]]) box(x, (F + WT) / 2, z, 0.14, WT - F, 0.14, post);
  for (const x of [-0.75, 0.75]) box(x, (F + F + 2.0) / 2 + 0.03, ZF + 0.02, 0.1, 2.06, 0.1, post);
  box(0, F + 2.08, ZF + 0.03, 1.7, 0.12, 0.12, post); box(0, WT - 0.05, ZF + 0.02, 2 * HX + 0.1, 0.1, 0.12, dark); box(0, WT - 0.05, ZR - 0.02, 2 * HX + 0.1, 0.1, 0.12, dark);
  for (const s of [-1, 1]) box(s * (HX + 0.02), WT - 0.05, (ZF + ZR) / 2, 0.12, 0.1, ZF - ZR + 0.1, dark);
  for (const [axis, at, w] of [['x', ZF + 0.03, FWa], ['x', ZF + 0.03, FWb], ['z', HX - 0.0, SW], ['z', -HX + 0.0, SW], ['x', ZR - 0.0, RW]]) lattice(axis, at, w, axis === 'x' && w === RW ? 8 : 7, '#4a382b');
  // Door leaves: lattice upper part over a solid lower panel, brass handles.
  for (const s of [-1, 1]) { const x0 = s < 0 ? -0.66 : 0.02, x1 = s < 0 ? -0.02 : 0.66, z = ZF + 0.0;
    lattice('x', z, [x0, x1, F + 0.55, F + 1.97], 6, '#6d3226'); box((x0 + x1) / 2, F + 0.28, z, x1 - x0, 0.52, 0.05, '#6d3226'); box((x0 + x1) / 2, F + 0.28, z + 0.03, x1 - x0 - 0.14, 0.34, 0.012, '#5a2a20', false);
    box(s * 0.06, F + 1.05, z + 0.04, 0.025, 0.14, 0.025, gold); }
  // Name plaque above the door and a lintel plate; rear: vertical battens and an ofuda board; sides: a mid rail.
  K.label('雨宿神社', 0, WT - 0.2, ZF + 0.075, 0.9, 0.2, '#d8c9a2', '#3a2d24', 120); box(0, WT - 0.2, ZF + 0.05, 0.96, 0.26, 0.03, dark, false);
  for (const s of [-1, 1]) { box(s * (HX + 0.01), F + 1.3, (ZF + ZR) / 2 + (s > 0 ? 0.0 : 0.0), 0.04, 0.05, ZF - ZR - 0.3, post, false); }
  box(1.4, F + 1.4, ZR - 0.05, 0.4, 0.5, 0.04, '#5b4a3a'); box(1.4, F + 1.4, ZR - 0.075, 0.32, 0.42, 0.012, W('#e6dcc0', 0.4), false);

  // ---- roof layer: gable roof, barge boards, ridge, katsuogi, chigi, gable boards, porch beams and ceiling ----
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('shrine').add(roofLayer); K.setRoot(roofLayer);
  const roofY = (x, lift = 0) => { const t = Math.min(1, Math.abs(x) / HW); return EAVE + (RIDGE - EAVE) * Math.pow(1 - t, 1.35) + 0.07 * Math.pow(t, 5) + lift; };
  const roofPts = (hw, th, lift = 0) => { const p = [], N = 16; for (let i = 0; i <= N; i++) { const x = -hw + 2 * hw * i / N; p.push([x, roofY(x, lift)]); } for (let i = N; i >= 0; i--) { const x = -hw + 2 * hw * i / N; p.push([x, roofY(x, lift) - th]); } return p; };
  shapeMesh(roofPts(HW, 0.15), RZ0 - RZ1, roofM, 0, 0, RZ1);
  shapeMesh(roofPts(HW + 0.04, 0.32, 0.03), 0.08, '#2b2f36', 0, 0, RZ0); shapeMesh(roofPts(HW + 0.04, 0.32, 0.03), 0.08, '#2b2f36', 0, 0, RZ1 - 0.08);
  box(0, RIDGE + 0.05, (RZ0 + RZ1) / 2, 0.32, 0.1, RZ0 - RZ1 + 0.1, '#2b2f36');
  for (let i = 0; i < 4; i++) { const k = cyl(0, RIDGE + 0.2, -1.35 - i * 0.75, 0.07, 0.62, '#b9a07a'); k.rotation.z = PI / 2; cyl(0.32, RIDGE + 0.2, -1.35 - i * 0.75, 0.065, 0.02, gold).rotation.z = PI / 2; }
  for (const z of [RZ0 + 0.1, RZ1 - 0.1]) for (const a of [-0.45, 0.45]) { const c = box(0, RIDGE + 0.05, z, 0.07, 0.7, 0.05, '#c9b48a'); c.rotation.z = a; }
  // gable boards (front over the porch, rear), lower edge on a tie beam
  for (const [z, face] of [[RZ0 - 0.12, 1], [RZ1 + 0.1, -1]]) { const p = [[-2.55, 2.62], [2.55, 2.62]]; for (let i = 0; i <= 14; i++) { const x = 2.55 - 5.1 * i / 14; p.push([x, roofY(x) - 0.14]); }
    shapeMesh(p, 0.08, boardM, 0, 0, z - 0.04); box(0, 2.58, z, 4.3, 0.18, 0.12, post);
    const g = box(0, 3.16, z + face * 0.06, 0.3, 0.3, 0.04, vermD); g.rotation.z = PI / 4; box(0, 3.16, z + face * 0.085, 0.1, 0.1, 0.02, gold, false); }
  // porch: tie beam across the posts, brackets, soffit
  box(0, 2.6, -0.62, 3.5, 0.2, 0.16, post); for (const s of [-1, 1]) { box(s * 1.5, 2.5, -0.62, 0.3, 0.1, 0.22, dark); box(s * 1.2, 2.55, -0.66, 0.16, 0.14, 0.1, dark); }
  box(0, 2.74, -1.2, 4.4, 0.04, 1.3, '#3a2d24', false);
  box(0, CEIL, (IZ0 + IZ1) / 2, 2 * IX, 0.04, IZ0 - IZ1, W('#a98b62', 0.3), false); for (let i = 1; i < 4; i++) box(0, CEIL - 0.04, IZ0 - i * (IZ0 - IZ1) / 4, 2 * IX, 0.05, 0.07, woodD, false);
  // eave gutters, downpipe on the west side, bell, shimenawa with shide, hanging lanterns
  for (const s of [-1, 1]) box(s * (HW - 0.03), EAVE - 0.17, (RZ0 + RZ1) / 2, 0.1, 0.07, RZ0 - RZ1 - 0.1, '#6d5b45');
  cyl(HW - 0.06, 1.5, -4.5, 0.035, 2.5, '#6d5b45'); box(HW - 0.06, 0.25, -4.5, 0.16, 0.05, 0.16, stoneD);
  rod([0, 2.52, -0.62], [0, 2.42, -0.95], 0.02, '#3a2d24'); mesh(new THREE.SphereGeometry(0.1, 10, 7), mat(gold), 0, 2.3, -0.95); cyl(0, 2.2, -0.95, 0.1, 0.03, '#b08a3a');
  line([[0, 2.2, -0.95], [0, 1.7, -0.95]], '#c9c2b0', 0.02); for (const [y, c] of [[2.05, verm], [1.8, '#e8e2d2']]) cyl(0, y, -0.95, 0.027, 0.18, c);
  line([[-1.45, 2.42, -0.7], [-0.7, 2.3, -0.7], [0, 2.38, -0.7], [0.7, 2.3, -0.7], [1.45, 2.42, -0.7]], '#d8c79a', 0.04);
  for (const x of [-1.1, -0.55, 0.0, 0.55, 1.1]) { const y = 2.3 + 0.05 * (1 - Math.abs(x) / 1.4) - 0.0; for (const k of [0, 1]) box(x + (k ? 0.03 : -0.03), y - 0.12 - k * 0.11, -0.7, 0.08, 0.1, 0.012, '#f2eee2', false).rotation.z = k ? 0.3 : -0.3; }
  for (const s of [-1, 1]) { line([[s * 1.0, 2.52, -0.68], [s * 1.0, 2.34, -0.68]], '#3a2d24', 0.012); box(s * 1.0, 2.2, -0.68, 0.17, 0.26, 0.17, '#3d4a58'); box(s * 1.0, 2.2, -0.68, 0.13, 0.2, 0.175, bulb, false); box(s * 1.0, 2.35, -0.68, 0.22, 0.04, 0.22, '#2b2f36', false);
    mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.26), s * 1.0, 2.2, -0.55, false); }

  // ================= interior =================
  group('shrine');
  box(0, F - 0.02, (IZ0 + IZ1) / 2, 2 * IX, 0.04, IZ0 - IZ1, warm('#ffffff', 0.2, floorT));
  panel('x', IZ0 - 0.006, 0.012, [-IX, IX, F, CEIL], [FD, FWa, FWb], cream); panel('x', IZ1 + 0.006, 0.012, [-IX, IX, F, CEIL], [RW], cream);
  panel('z', IX - 0.006, 0.012, [IZ1, IZ0, F, CEIL], [SW], cream); panel('z', -IX + 0.006, 0.012, [IZ1, IZ0, F, CEIL], [SW], cream);
  box(0, F + 0.3, IZ1 + 0.01, 2 * IX, 0.6, 0.012, W('#8f6f4c', 0.3), false);
  // Near layer: tatami mat with two cushions, drum on a stand, floor lanterns.
  box(0, F + 0.015, -2.6, 2.3, 0.03, 1.1, W('#b2a977', 0.28), false); for (const z of [-2.05, -3.15]) box(0, F + 0.032, z, 2.3, 0.012, 0.05, W('#33422f', 0.2), false);
  box(-0.5, F + 0.06, -2.4, 0.36, 0.06, 0.36, W('#8f3a3a', 0.4)); box(0.5, F + 0.06, -2.4, 0.36, 0.06, 0.36, W('#5a4a80', 0.4));
  { const dx = -1.45, dz = -2.5; for (const s of [-1, 1]) { box(dx + s * 0.2, F + 0.22, dz - 0.1, 0.04, 0.44, 0.04, '#59402c', false); box(dx + s * 0.2, F + 0.22, dz + 0.1, 0.04, 0.44, 0.04, '#59402c', false); }
    const d = cyl(dx, F + 0.62, dz, 0.24, 0.34, W('#c9a05a', 0.3)); d.rotation.x = PI / 2; const h = cyl(dx, F + 0.62, dz + 0.171, 0.22, 0.012, W('#efe5cc', 0.5)); h.rotation.x = PI / 2; box(dx, F + 0.87, dz + 0.04, 0.4, 0.015, 0.015, '#59402c', false); }
  for (const s of [-1, 1]) { box(s * 0.88, F + 0.4, -2.45, 0.03, 0.8, 0.03, '#59402c', false); const l = mesh(new THREE.SphereGeometry(1, 8, 6), bulb, s * 0.88, F + 0.95, -2.45, false); l.scale.set(0.13, 0.17, 0.13); mesh(new THREE.PlaneGeometry(0.8, 0.8), additive(glowT, '#ffc27e', 0.22), s * 0.88, F + 0.95, -2.3, false); }
  // Middle layer: lattice partition with a central opening.
  { const z = -3.3; for (const x of [-1.9, -0.55, 0.55, 1.9]) box(x, F + 0.8, z, 0.07, 1.6, 0.07, '#5a4636', false);
    box(0, F + 1.6, z, 3.9, 0.07, 0.07, '#5a4636', false); for (const s of [-1, 1]) { box(s * 1.22, F + 0.28, z, 1.3, 0.56, 0.04, W('#8a6a48'), false); for (let i = 0; i < 10; i++) box(s * (0.62 + i * 0.12), F + 1.08, z, 0.02, 1.0, 0.03, '#5a4636', false); box(s * 1.22, F + 0.58, z, 1.3, 0.04, 0.05, '#5a4636', false); } }
  // Back layer: sanctuary on a dais — miniature shrine house, sakaki vases, sake bottles, round mirror.
  box(0, F + 0.08, -3.89, 1.9, 0.16, 0.54, W('#8a6a48', 0.28)); box(0, F + 0.165, -3.89, 1.7, 0.012, 0.46, W('#8f3a3a', 0.4), false);
  box(0, F + 0.21, -3.92, 0.74, 0.08, 0.46, W('#6a5a40', 0.3)); box(0, F + 0.56, -3.92, 0.62, 0.62, 0.4, W('#c9a553', 0.4));
  box(0, F + 0.56, -3.71, 0.4, 0.5, 0.012, W('#6b3a2a', 0.3), false); box(0, F + 0.56, -3.705, 0.01, 0.5, 0.01, '#3a2d24', false); for (const s of [-1, 1]) box(s * 0.04, F + 0.52, -3.7, 0.02, 0.05, 0.015, gold, false);
  shapeMesh([[-0.5, 0], [0.5, 0], [0, 0.28]], 0.52, '#2e333b', 0, F + 0.87, -4.18);
  for (const s of [-1, 1]) { cyl(s * 0.72, F + 0.28, -3.85, 0.055, 0.24, W('#e8e4d8', 0.4)); const g = mesh(leafG, W('#5f8a5a', 0.3), s * 0.72, F + 0.5, -3.85, false); g.scale.set(0.12, 0.17, 0.1); cyl(s * 0.95, F + 0.26, -3.8, 0.045, 0.2, W('#dfe4ea', 0.5)); cyl(s * 0.95, F + 0.38, -3.8, 0.02, 0.06, W('#dfe4ea', 0.5)); }
  mesh(new THREE.CircleGeometry(0.15, 18), W('#e8d68a', 0.8), 0, F + 1.5, IZ1 + 0.012, false); mesh(new THREE.RingGeometry(0.15, 0.18, 18), W('#6a5a40', 0.3), 0, F + 1.5, IZ1 + 0.011, false);
  for (const x of [-0.5, 0.5]) line([[x, CEIL - 0.04, -3.6], [x, F + 1.8, -3.6]], '#d8c79a', 0.012);
  box(0, F + 1.82, -3.6, 1.2, 0.05, 0.05, '#d8c79a', false); for (let i = 0; i < 5; i++) box(-0.5 + i * 0.25, F + 1.72, -3.6, 0.08, 0.14, 0.012, '#f2eee2', false);
  // west wall cabinet with votive plaques; east wall: framed rules
  box(IX - 0.16, F + 0.65, -3.75, 0.28, 1.3, 0.8, W('#7a5a40', 0.3)); for (const z of [-3.5, -3.95]) box(IX - 0.305, F + 0.65, z, 0.012, 1.1, 0.36, W('#5a4636', 0.3), false);
  for (let i = 0; i < 6; i++) box(IX - 0.012, F + 1.4 + (i % 2) * 0.2, -2.6 - i * 0.2, 0.012, 0.16, 0.12, W('#d9bd8a', 0.5), false);
  for (const [x, z, r] of [[0, -2.5, 2.0], [0, -3.8, 1.5], [0, -1.3, 1.5]]) decal(r, r, x, F + 0.008, z, [0, -1], additive(glowT, '#ffc988', 0.28));
  // Porch: offering box, umbrella rack (shared umbrellas for rainy visitors).
  box(0, F + 0.26, -1.35, 1.0, 0.52, 0.5, W('#8a6a48', 0.26)); for (let i = 0; i < 8; i++) box(-0.42 + i * 0.12, F + 0.54, -1.35, 0.05, 0.02, 0.46, W('#3a2d24', 0.15), false);
  box(0, F + 0.3, -1.1, 0.8, 0.2, 0.012, W('#d9c08a', 0.5), false);
  { const ux = 1.2, uz = -1.45; box(ux, F + 0.4, uz, 0.5, 0.05, 0.22, '#59402c'); for (const s of [-1, 1]) box(ux + s * 0.25, F + 0.4, uz, 0.04, 0.8, 0.04, '#59402c'); box(ux, F + 0.78, uz, 0.54, 0.04, 0.26, '#59402c');
    [[verm, -0.15], ['#3d4f7a', 0.0], ['#e8e2d2', 0.15]].forEach(([c, dx], i) => { const u = cyl(ux + dx, F + 0.62, uz, 0.025, 0.7 + i * 0.03, '#59402c'); u.rotation.z = dx * 0.4; mesh(new THREE.ConeGeometry(0.06, 0.34, 8), mat(c), ux + dx * 1.0, F + 1.0 + i * 0.03, uz, true).rotation.z = dx * 0.4; }); }
  decal(2.0, 1.0, 0, F + 0.01, -0.95, [0, -1], additive(spillT, '#ffbf7a', 0.22));

  // ================= forecourt and attachments =================
  const lanternAt = (name, x) => {
    group(name); const z = 0.9, s = x > 0 ? 1 : -1;
    box(x, BASE + 0.07, z, 0.5, 0.14, 0.5, stoneD); cyl(x, BASE + 0.2, z, 0.2, 0.1, stone); cyl(x, BASE + 0.5, z, 0.085, 0.5, stone); cyl(x, BASE + 0.78, z, 0.17, 0.08, stone);
    box(x, BASE + 1.0, z, 0.36, 0.36, 0.36, stone); for (const [dx, dz, w, d] of [[0, 0.184, 0.24, 0.012], [0, -0.184, 0.24, 0.012], [0.184, 0, 0.012, 0.24], [-0.184, 0, 0.012, 0.24]]) box(x + dx, BASE + 1.0, z + dz, w, 0.24, d, bulb, false);
    mesh(new THREE.ConeGeometry(0.34, 0.26, 4), mat(stone), x, BASE + 1.31, z).rotation.y = PI / 4; mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(stone), x, BASE + 1.5, z);
    const gm = additive(glowT, '#ffc27e', 0.3); for (const r of [0, PI / 2]) mesh(new THREE.PlaneGeometry(1.4, 1.4), gm, x, BASE + 1.0, z, false).rotation.y = r;
    decal(2.2, 2.2, x, 0.206, z, [0, -1], additive(glowT, '#ffc27e', 0.22)); return gm; };
  const gmE = lanternAt('shrineLanternE', -2.05), gmW = lanternAt('shrineLanternW', 2.05);
  // Torii in two halves around x = 0; each half is its own group so only the posts count at walking height.
  const toriiHalf = (name, s) => {
    group(name); const x = s * 1.2, z = 2.0, top = 3.05;
    box(x, BASE + 0.025, z, 0.5, 0.05, 0.5, stoneD); cyl(x, BASE + 0.25, z, 0.19, 0.4, '#25232a'); mesh(new THREE.CylinderGeometry(0.13, 0.16, top - 0.65, 10), mat(verm), x, 0.58 + (top - 0.65) / 2, z);
    box(s * 0.9, top + 0.08, z, 1.8, 0.14, 0.28, '#2b2f36'); box(s * 0.9, top + 0.17, z, 1.84, 0.05, 0.34, '#1f2329'); const e = box(s * 1.78, top + 0.14, z, 0.5, 0.14, 0.28, '#2b2f36'); e.rotation.z = s * 0.28;
    box(s * 0.85, top - 0.1, z, 1.7, 0.1, 0.2, verm); box(s * 0.85, 2.3, z, 1.7, 0.1, 0.16, verm); box(s * 1.45, 2.3, z, 0.4, 0.1, 0.16, vermD, false);
    if (s < 0) { box(0, 2.67, z, 0.52, 0.56, 0.05, '#2b2f36'); K.label('雨宿', 0, 2.67, z + 0.03, 0.44, 0.48, '#2b2f36', gold, 190); K.label('雨宿', 0, 2.67, z - 0.03, 0.44, 0.48, '#2b2f36', gold, 190).rotation.y = PI; }
    decal(1.6, 1.6, x, 0.206, z, [0, -1], additive(glowT, '#9fb6d8', 0.06)); };
  toriiHalf('shrineToriiE', -1); toriiHalf('shrineToriiW', 1);
  // Water basin (east of the approach): stone basin on a rough block, bamboo spout, ladle, ripples.
  const gChozu = group('shrineChozu'); {
    const x = -3.3, z = 1.3;
    box(x, BASE + 0.18, z, 0.7, 0.36, 0.7, stoneD); cyl(x, BASE + 0.45, z, 0.34, 0.26, stone); cyl(x, BASE + 0.59, z, 0.27, 0.02, '#4f6f86');
    for (const [dx, dz, r] of [[0.5, 0.2, 0.14], [-0.45, -0.3, 0.12], [0.35, -0.55, 0.1]]) mesh(leafG, mat(stone), x + dx, BASE + r * 0.62, z + dz, false).scale.set(r, r * 0.6, r);
    box(x - 0.55, BASE + 0.45, z - 0.3, 0.07, 0.9, 0.07, '#59402c'); rod([x - 0.55, BASE + 0.8, z - 0.3], [x - 0.12, BASE + 0.68, z - 0.05], 0.03, '#9a8f5a');
    box(x + 0.35, BASE + 0.63, z + 0.05, 0.4, 0.015, 0.03, '#9a8f5a', false); cyl(x + 0.55, BASE + 0.63, z + 0.05, 0.05, 0.04, '#9a8f5a');
    shrub(x - 0.8, BASE, z + 0.4, 0.22, 4, GREEN, 1.3); shrub(x + 0.7, BASE, z - 0.2, 0.2, 3, GREEN, 1.2);
    decal(1.8, 1.8, x, 0.206, z, [0, -1], additive(glowT, '#8fb0d8', 0.1)); }
  // Ema rack (west of the approach): two posts, a little roof, a grid of hanging votive plaques.
  group('shrineEma'); {
    const x = 3.45, z = 0.5; for (const s of [-1, 1]) box(x + s * 0.55, BASE + 0.6, z, 0.07, 1.2, 0.07, '#59402c'); box(x, BASE + 1.18, z, 1.3, 0.05, 0.1, '#59402c');
    box(x, BASE + 0.35, z, 1.1, 0.05, 0.08, '#59402c'); shapeMesh([[-0.75, 0], [0.75, 0], [0, 0.22]], 0.5, '#2b2f36', x, BASE + 1.2, z - 0.25);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) { box(x - 0.45 + c * 0.18, BASE + 1.0 - r * 0.34, z, 0.14, 0.2, 0.012, W(['#d9bd8a', '#c9a070', '#e0cca0'][(r + c) % 3], 0.45)); line([[x - 0.45 + c * 0.18, BASE + 1.18, z], [x - 0.45 + c * 0.18, BASE + 1.1 - r * 0.34, z]], '#7a6648', 0.005); }
    mesh(new THREE.PlaneGeometry(1.2, 1.2), additive(glowT, '#ffc27e', 0.1), x, BASE + 0.7, z + 0.1, false); }
  // Name stone beside the entrance gap.
  group('shrineStele'); {
    const x = 2.45, z = 2.35; box(x, BASE + 0.1, z, 0.55, 0.2, 0.4, stoneD); box(x, BASE + 0.75, z, 0.34, 1.1, 0.24, stone);
    const c = canvasTex(128, 384, (q, w, h) => { q.fillStyle = '#7d7b76'; q.fillRect(0, 0, w, h); q.fillStyle = '#2a2a2c'; q.font = 'bold 76px sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; [...'雨宿神社'].forEach((ch, i) => q.fillText(ch, w / 2, 56 + i * 92)); });
    mesh(new THREE.PlaneGeometry(0.28, 0.98), new THREE.MeshBasicMaterial({ map: c, color: '#c8c8cc' }), x, BASE + 0.75, z + 0.126, false); shrub(x + 0.5, BASE, z - 0.1, 0.2, 3, GREEN, 1.2); }
  // Tool shed behind the west side of the hall.
  group('shrineShed'); {
    const x = 3.85, z = -2.9, w = 1.3, d = 1.7, h = 1.7;
    box(x, BASE + h / 2, z, w, h, d, boardM); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(x + dx * w / 2, BASE + h / 2, z + dz * d / 2, 0.08, h, 0.08, post);
    const r = box(x, BASE + h + 0.12, z, w + 0.5, 0.08, d + 0.4, '#2b2f36'); r.rotation.z = 0.14; box(x, BASE + h + 0.02, z, w + 0.1, 0.1, d + 0.1, dark, false);
    box(x - 0.05, BASE + 0.78, z + d / 2 + 0.02, 0.8, 1.5, 0.04, '#6b5240'); for (let i = 1; i < 4; i++) box(x - 0.05 - 0.4 + i * 0.2, BASE + 0.78, z + d / 2 + 0.045, 0.02, 1.46, 0.01, '#3a2d24', false);
    box(x + 0.22, BASE + 0.8, z + d / 2 + 0.06, 0.04, 0.12, 0.03, gold, false); box(x - 0.05, BASE + 1.42, z + d / 2 + 0.05, 0.9, 0.06, 0.05, dark, false);
    for (let i = 0; i < 3; i++) box(x - 0.45 + i * 0.3, BASE + 0.12 + 0.2 * (i % 2), z - d / 2 - 0.2, 0.26, 0.2, 0.3, '#8a6b45'); cyl(x + 0.75, BASE + 0.15, z + 0.5, 0.15, 0.3, '#5d6a72'); box(x + 0.75, BASE + 0.6, z + 0.5, 0.03, 0.6, 0.03, '#59402c', false); }
  // Rain-chain basin at the east rear eave: chain of cups into a stone basin; ripples are animated below.
  const gRain = group('shrineRain'); {
    const x = -2.8, z = -4.45; box(x, BASE + 0.08, z, 0.6, 0.16, 0.6, stoneD); cyl(x, BASE + 0.28, z, 0.26, 0.24, stone); cyl(x, BASE + 0.4, z, 0.2, 0.02, '#4f6f86');
    line([[x, 2.62, z], [x, BASE + 0.4, z]], '#8a8f92', 0.012); for (let i = 0; i < 9; i++) cyl(x, 2.35 - i * 0.24, z, 0.05, 0.08, '#8a6d4a'); shrub(x - 0.45, BASE, z + 0.1, 0.2, 3, GREEN, 1.2); }
  // Fences: low stone footing, stone posts and bamboo slats; one group per side, with the entrance gap kept clear.
  const fence = (name, axis, d, u0, u1, shrubs) => {
    group(name); const len = u1 - u0, n = Math.max(1, Math.round(len / 1.55)), step = len / n;
    ab(axis, (u0 + u1) / 2, BASE + 0.22, d, len, 0.44, 0.3, stone); ab(axis, (u0 + u1) / 2, BASE + 0.46, d, len + 0.02, 0.04, 0.34, stoneD, false);
    for (let i = 0; i <= n; i++) { const u = u0 + i * step; ab(axis, u, BASE + 0.55, d, 0.2, 0.74, 0.2, stoneD); ab(axis, u, BASE + 0.95, d, 0.26, 0.06, 0.26, stone, false); }
    for (const y of [BASE + 0.66, BASE + 0.9]) ab(axis, (u0 + u1) / 2, y, d, len, 0.04, 0.06, '#8a7a50', false);
    for (let u = u0 + 0.12; u < u1 - 0.1; u += 0.15) if (Math.abs(((u - u0) % step)) > 0.14 && Math.abs(((u - u0) % step) - step) > 0.14) ab(axis, u, BASE + 0.76, d, 0.05, 0.62, 0.05, rnd() < 0.5 ? '#b9a26c' : '#a8935c', false);
    for (const [u, off, r, cols, k] of shrubs || []) shrub(axis === 'x' ? u : d + off, BASE, axis === 'x' ? d + off : u, r, k, cols, 1.2); };
  fence('shrineFenceE', 'z', -7.35, -4.85, 2.85, [[-3.5, 0.45, 0.35, GREEN, 4], [-0.5, 0.5, 0.3, HYD, 5], [1.8, 0.45, 0.3, HYD, 4], [-2.3, 0.4, 0.25, GREEN, 3]]);
  fence('shrineFenceW', 'z', 7.35, -4.85, 2.85, [[0.5, -0.45, 0.32, HYD, 5], [-1.2, -0.4, 0.28, GREEN, 4], [2.0, -0.45, 0.3, GREEN, 4]]);
  fence('shrineFenceR', 'x', -4.85, -7.5, 7.5, [[-3.5, 0.5, 0.3, GREEN, 4], [3.0, 0.5, 0.3, HYD, 4], [0.0, 0.5, 0.25, GREEN, 3]]);
  fence('shrineFenceFE', 'x', 2.85, -7.5, -1.0, [[-5.2, -0.5, 0.3, HYD, 5], [-3.2, -0.5, 0.26, GREEN, 4], [-1.9, -0.45, 0.24, HYD, 3]]);
  fence('shrineFenceFW', 'x', 2.85, 1.0, 7.5, [[5.4, -0.5, 0.3, HYD, 5], [3.6, -0.45, 0.26, GREEN, 4], [1.9, -0.45, 0.24, GREEN, 3]]);
  // Trees: a red maple and a camphor behind the hall, two smaller trees at the front corners (all below the 4.0 height limit).
  group('shrineTreeNE'); tree(-5.7, -3.1, 3.1, 1.3, RED, 11); shrub(-6.3, BASE, -1.7, 0.3, 3, RED, 1);
  group('shrineTreeNW'); tree(5.9, -3.4, 3.3, 1.45, GREEN, 12);
  group('shrineTreeSE'); tree(-6.1, 1.6, 2.5, 0.95, GREEN, 8);
  group('shrineTreeSW'); tree(6.2, 1.2, 2.7, 1.0, ['#7aa070', '#5f8a5e', '#9bb06a'], 8);

  // ================= ground: lawn, raked gravel, stone approach, light pools =================
  group('shrineGround');
  const grassM = warm('#ffffff', 0, grassT), gravM = warm('#ffffff', 0, gravelT), paveM = warm('#ffffff', 0, paveT);
  const pad = (x0, x1, z0, z1, m, y0, y1, u = 3) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), (x1 - x0) / u, (z1 - z0) / u), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, false);
  pad(-8, 8, -5.5, 3.5, mat('#5c7a56'), 0.18, 0.2); { const g = pad(-8, 8, -5.5, 3.5, toon(grassT), 0.2, 0.202); g.material.polygonOffset = true; }
  pad(-5.6, 5.6, -0.2, 2.85, toon(gravelT), 0.2, 0.212, 2.5);
  for (let i = 0; i < 6; i++) pad(-0.55, 0.55, 2.75 - i * 0.5 - 0.2, 2.75 - i * 0.5 + 0.2, mat('#8c8a84'), 0.2, 0.226, 1);
  pad(-0.55, 0.55, 2.85, 3.5, paveM, 0.19, 0.205, 1);
  for (const s of [-1, 1]) for (const z of [-0.2, 0.0]) pad(s * 1.1 - 0.15, s * 1.1 + 0.15, z - 0.12, z + 0.12, paveM, 0.2, 0.213, 1);
  for (const [x, z, r] of [[-6.0, -0.5, 0.9], [6.0, -1.2, 0.8], [-4.2, -3.8, 0.7], [4.0, 1.9, 0.5], [-3.6, 2.2, 0.5]]) { const m = mesh(new THREE.CircleGeometry(r, 10), mat('#4f7552'), x, 0.204, z, false); m.rotation.x = -PI / 2; m.scale.y = 0.7; }
  decal(2.4, 1.2, -2.7, 0.214, 0.35, [1, 0], additive(spillT, '#ffbf7a', 0.08)); decal(1.6, 0.9, 2.95, 0.212, -3.1, [-1, 0], additive(spillT, '#ffbf7a', 0.1));
  decal(1.2, 0.8, -2.7, 0.206, -3.1, [1, 0], additive(spillT, '#ffbf7a', 0.12)); decal(1.2, 0.8, 2.7, 0.206, -3.1, [-1, 0], additive(spillT, '#ffbf7a', 0.12));
  for (const [x, z, w, h] of [[0.0, 0.7, 2.6, 1.0], [-1.4, 1.9, 1.5, 0.7], [1.5, 1.6, 1.4, 0.7]]) decal(w, h, x, 0.214, z, [0, -1], additive(glowT, '#7e9ccc', 0.07));

  // ================= local animation: basin ripples, eave and chain drips, lantern glow =================
  const ripMat = () => new THREE.MeshBasicMaterial({ color: '#cfe6f2', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const rings = [];
  const addRings = (g, x, y, z, r, n) => { const fx = new THREE.Group(); fx.userData.live = true; g.add(fx); for (let i = 0; i < n; i++) { const m = ripMat(), a = mesh(new THREE.RingGeometry(0.7, 1, 24), m, x, y, z, false, fx); a.rotation.x = -PI / 2; rings.push({ a, m, r, off: i / n }); } };
  addRings(gChozu, -3.3, BASE + 0.6, 1.3, 0.24, 3); addRings(gRain, -2.8, BASE + 0.415, -4.45, 0.18, 2);
  const fx = new THREE.Group(); fx.userData.live = true; group('shrine').add(fx);
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const eave = batch('#cee7e5', 0.6), chain = batch('#d4ecea', 0.55);
  for (let i = 0; i < 14; i++) eave.add(-2.4 + i * 0.37 + rnd() * 0.1, 0.5 + rnd() * 1.8, RZ0 + 0.04, 0.09, 0.45, 2.7, 2.1 + rnd() * 0.5);
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) eave.add(s * (HW + 0.02), 0.4 + rnd() * 2, -0.9 - i * 0.42, 0.09, 0.25, 2.65, 2.0 + rnd() * 0.5);
  for (let i = 0; i < 6; i++) chain.add(-2.8 + (rnd() - 0.5) * 0.03, 0.6 + i * 0.35, -4.45, 0.2, 0.55, 2.55, 1.5 + rnd() * 0.4);
  eave.seal(); chain.seal();
  return {
    update(t, dt) {
      eave.step(dt); chain.step(dt);
      for (const r of rings) { const p = (t * 0.55 + r.off) % 1; r.a.scale.setScalar(r.r * (0.25 + 0.75 * p)); r.m.opacity = 0.5 * (1 - p); }
      gmE.opacity = 0.27 + 0.05 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1); gmW.opacity = 0.27 + 0.05 * Math.sin(t * 0.8 + 2) * Math.sin(t * 0.41);
    },
  };
};
