// B05-P03 雨宿り珈琲 (Amayadori Coffee): a one-storey neighbourhood café on the main street.
// Task card docs/buildings/tasks/B05-P03.md, reference docs/buildings/references/B05-P03.jpg.
// Local frame (placed by layout.js `buildings`): front +z faces the street (world N), -x is the viewer's
// left = world E; door centre at the origin, floor top at rec.floor. Body 5.5 × 6.05: x -2…3.5, z -6.05…0 (awning to +0.97, rear canopy to -6.47: inside the 7.5 buildable depth).
// Groups: cafe (shell, interior, roof, awnings) · cafeFrontE / cafeFrontW (planters, umbrella stand, A-board)
// · cafeUtility (outdoor AC unit) · cafeService (fenced 1.2 × 1.5 bin yard) · cafeGround (forecourt paving,
// rear path, mat and window light on the wet ground). Plan: window counter and two tables in front, coffee
// bar across the middle, centre aisle from the door to the back room (prep counter, fridge, lockers, back door).
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B05-P03'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glow, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(5303), PI = Math.PI;
  const F = rec.floor, X0 = -2, X1 = 3.5, Z0 = 0, Z1 = -6.05, T = 0.15, BASE = 0.19, EAVE = 3.45, CEIL = 3.2, PART = -4.36;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T;
  // Openings [u0, u1, y0, y1]: front/rear along x, sides along z.
  const FW1 = [-1.72, -0.78, 0.95, 2.42], FD = [-0.47, 0.47, F, 2.42], FW2 = [0.66, 3.24, 0.8, 2.42];
  const EW = [-3.55, -0.9, 0.85, 2.42], WW1 = [-1.95, -1.4, 0.95, 2.42], WW2 = [-5.75, -4.75, 1.7, 2.2], RD = [0.1, 0.95, F, 2.32];

  // ---- shared materials and textures ----
  const stucco = mat('#cdbfa3'), skirting = '#8b877e', walnut = '#6b4a3a', walnutL = '#8a624a', awning = '#616674', trim = '#67696c', metal = '#85888a';
  const W = (c, k = 0.3) => warm(c, k);
  const wood = W('#a0704e'), woodD = W('#6f4a37', 0.26), stone = W('#ece1cf', 0.32), steel = W('#b7bfbe', 0.22), cream = W('#f1e3c7', 0.34),
    wains = W('#8e6248', 0.28), cupC = W('#f7f2e8', 0.36), green = W('#6f9a7c', 0.22);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' }), coolPanel = new THREE.MeshBasicMaterial({ color: '#eef0e2' });
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const planks = tex(256, 256, (q, w, h) => { for (let r = 0; r < 8; r++) { q.fillStyle = `hsl(${26 + rnd() * 6},${38 + rnd() * 10}%,${46 + rnd() * 8}%)`; q.fillRect(0, r * 32, w, 32);
    q.fillStyle = 'rgba(60,36,24,.55)'; q.fillRect(0, r * 32, w, 1.5); const j = rnd() * 200 + 28; q.fillRect(j, r * 32, 1.5, 32); }
    for (let i = 0; i < 300; i++) { q.fillStyle = `rgba(70,42,26,${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 8 + rnd() * 30, 1); } });
  const pavers = tex(256, 256, (q, w, h) => { q.fillStyle = '#a8a294'; q.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      q.fillStyle = `rgba(${rnd() < 0.5 ? '70,78,92' : '250,246,236'},${0.05 + rnd() * 0.08})`; q.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    q.strokeStyle = 'rgba(48,56,66,.45)'; q.lineWidth = 2; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); }
    for (let i = 0; i < 900; i++) { q.fillStyle = `rgba(40,48,60,${0.04 + rnd() * 0.06})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1); } });
  const glowT = canvasTex(128, 128, (q, w) => { const g = q.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.33)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, w); });
  // Window light thrown onto the ground: bright at the glass edge (canvas top), fading outwards and at the sides.
  const spillT = canvasTex(128, 128, (q, w, h) => { const g = q.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, h);
    q.globalCompositeOperation = 'destination-in'; const s = q.createLinearGradient(0, 0, w, 0); s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.18, 'rgba(0,0,0,1)'); s.addColorStop(0.82, 'rgba(0,0,0,1)'); s.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = s; q.fillRect(0, 0, w, h); });
  const additive = (map, c, o) => new THREE.MeshBasicMaterial({ map, color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const pool = additive(glowT, '#ffc988', 0.3);
  // Flat decal lying on a surface; its canvas-top edge points along `heading` (local x, z).
  const decal = (w, h, x, y, z, heading, m) => { const a = mesh(new THREE.PlaneGeometry(w, h), m, x, y, z, false); a.rotation.set(-PI / 2, Math.atan2(-heading[0], -heading[1]), 0, 'YXZ'); return a; };
  // Box along a wall: u runs along the wall, d is the depth coordinate across it.
  const ab = (axis, u, y, d, w, h, t, c, o = true, p) => axis === 'x' ? box(u, y, d, w, h, t, c, o, p) : box(d, y, u, t, h, w, c, o, p);
  const shapeMesh = (pts, depth, c, x, y, z, ry) => { const s = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))), g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 }); const m = mesh(g, c, x, y, z); m.rotation.y = ry; return m; };
  // Chalk lettering for boards.
  const chalk = (w, h, lines, bg = '#2f3b36') => canvasTex(w, h, (q, W2, H2) => { q.fillStyle = bg; q.fillRect(0, 0, W2, H2); q.fillStyle = q.strokeStyle = '#efe9da'; q.textAlign = 'center'; q.textBaseline = 'middle';
    for (const [t, y, size, font = 'sans-serif', col] of lines) { q.fillStyle = col || '#efe9da'; q.font = `bold ${size}px ${font}`; q.fillText(t, W2 / 2, y); } return q; });
  const cupIcon = (q, cx, cy, s, c) => { q.strokeStyle = q.fillStyle = c; q.lineWidth = s * 0.09; q.lineCap = 'round'; q.beginPath(); q.moveTo(cx - s * 0.5, cy - s * 0.15); q.lineTo(cx - s * 0.4, cy + s * 0.35); q.lineTo(cx + s * 0.3, cy + s * 0.35); q.lineTo(cx + s * 0.4, cy - s * 0.15); q.closePath(); q.fill();
    q.beginPath(); q.arc(cx + s * 0.45, cy + s * 0.05, s * 0.14, -PI / 2, PI / 2); q.stroke(); q.beginPath(); q.moveTo(cx - s * 0.6, cy + s * 0.45); q.lineTo(cx + s * 0.5, cy + s * 0.45); q.stroke();
    for (const k of [-0.18, 0.08]) { q.beginPath(); q.moveTo(cx + s * k, cy - s * 0.28); q.bezierCurveTo(cx + s * (k - 0.12), cy - s * 0.42, cx + s * (k + 0.12), cy - s * 0.52, cx + s * k, cy - s * 0.68); q.stroke(); } };

  // ================= shell =================
  group('cafe');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, EAVE], [FW1, FD, FW2], stucco);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, EAVE], [RD], stucco);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, EAVE], [EW], stucco);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, EAVE], [WW1, WW2], stucco);
  // Base course and a thin cornice band under the parapet.
  for (const [a, b] of [[X0 - 0.01, FD[0]], [FD[1], X1 + 0.01]]) box((a + b) / 2, 0.305, 0.006, b - a, 0.23, 0.03, skirting);
  for (const [a, b] of [[X0 - 0.01, RD[0]], [RD[1], X1 + 0.01]]) box((a + b) / 2, 0.305, Z1 - 0.006, b - a, 0.23, 0.03, skirting);
  for (const x of [X0 - 0.006, X1 + 0.006]) box(x, 0.305, (Z0 + Z1) / 2, 0.03, 0.23, 6.52, skirting);
  // Floors: oak planks in the café, pale tiles in the prep room; ceiling.
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - PART), (IX1 - IX0) / 1.6, (IZ0 - PART) / 1.6), warm('#ffffff', 0.2, planks), (IX0 + IX1) / 2, (F + BASE) / 2, (IZ0 + PART) / 2, false);
  box((IX0 + IX1) / 2, (F + BASE) / 2, (PART + IZ1) / 2, IX1 - IX0, F - BASE, PART - IZ1, W('#b8bdb2', 0.18), false);
  // Roof layer (ceiling, slab, parapet, rooftop plant): batched on its own so review cutaways can lift it off.
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('cafe').add(roofLayer);
  box((IX0 + IX1) / 2, CEIL + 0.01, (IZ0 + IZ1) / 2, IX1 - IX0, 0.02, IZ0 - IZ1, W('#f3e7cf', 0.38), false, roofLayer);
  // Interior linings (warm plaster above walnut wainscot), so the inner faces read lit through the glass.
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL], [FW1, FD, FW2], cream);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL], [RD], W('#e7e3d6', 0.22));
  panel('z', IX0 + 0.006, 0.012, [IZ1, IZ0, F, CEIL], [EW], cream);
  panel('z', IX1 - 0.006, 0.012, [IZ1, IZ0, F, CEIL], [WW1, WW2], cream);
  panel('x', IZ0 - 0.016, 0.012, [IX0, IX1, F, 0.98], [FW1, FD, FW2], wains);
  panel('z', IX0 + 0.016, 0.012, [PART, IZ0, F, 0.98], [EW], wains);
  panel('z', IX1 - 0.016, 0.012, [PART, IZ0, F, 0.98], [WW1], wains);
  // Partition between café and prep room, doorway with a short noren.
  const DOOR2 = [-0.62, 0.22, F, 2.25];
  box((IX0 + DOOR2[0]) / 2, (F + CEIL) / 2, PART, DOOR2[0] - IX0, CEIL - F, 0.12, cream);
  box((DOOR2[1] + IX1) / 2, (F + CEIL) / 2, PART, IX1 - DOOR2[1], CEIL - F, 0.12, cream);
  box((DOOR2[0] + DOOR2[1]) / 2, (DOOR2[3] + CEIL) / 2, PART, DOOR2[1] - DOOR2[0], CEIL - DOOR2[3], 0.12, cream);
  for (const x of [DOOR2[0] + 0.03, DOOR2[1] - 0.03]) box(x, (F + DOOR2[3]) / 2, PART, 0.06, DOOR2[3] - F, 0.16, woodD);
  box((DOOR2[0] + DOOR2[1]) / 2, DOOR2[3] + 0.03, PART, DOOR2[1] - DOOR2[0] + 0.06, 0.06, 0.16, woodD);
  for (const k of [0, 1]) box(DOOR2[0] + 0.21 + k * 0.42, 1.92, PART + 0.09, 0.4, 0.62, 0.012, W('#3f5878', 0.2));
  panel('x', PART + 0.066, 0.012, [IX0, IX1, F, 0.98], [DOOR2], wains);

  // ---- windows and doors: walnut frames, real mullions, one glass pane per light ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = []) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, walnut); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, walnut);
    ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, walnut); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, walnut);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.05, q - p, fd * 0.9, walnut);
    for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.05, fd * 0.9, walnut);
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    if (p > F + 0.05) ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.12, 0.05, 0.16, '#cfc6b4');   // stone sill
  }
  glaze('x', -T / 2, 1, FW1, [], [2.0]);
  glaze('x', -T / 2, 1, FW2, [1.52, 2.38], [2.0]);
  glaze('z', X0 + T / 2, -1, EW, [-2.67, -1.78], [2.0]);
  glaze('z', X1 - T / 2, 1, WW1, [], [2.0]);
  glaze('z', X1 - T / 2, 1, WW2, [-5.25]);
  // Front door: walnut leaf with a tall glass panel and a brass bar handle; ramp to the forecourt.
  ab('x', FD[0] + 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, walnut); ab('x', FD[1] - 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, walnut);
  box(0, FD[3] - 0.03, -T / 2, FD[1] - FD[0], 0.06, 0.16, walnut);
  {
    const z = -0.05, l = -0.41, r = 0.41, top = FD[3] - 0.06;
    for (const x of [l + 0.045, r - 0.045]) box(x, (F + top) / 2, z, 0.09, top - F, 0.045, walnutL);
    box(0, top - 0.05, z, r - l, 0.1, 0.045, walnutL); box(0, F + 0.17, z, r - l, 0.34, 0.045, walnutL);
    box(0, (F + 0.34 + top - 0.1) / 2, z, r - l - 0.18, top - 0.1 - F - 0.34, 0.012, glass, false);
    box(0.29, 1.3, z + 0.05, 0.03, 0.5, 0.03, '#c9a35b'); box(0.29, 1.3, z - 0.05, 0.03, 0.5, 0.03, W('#c9a35b', 0.2));
    K.label('OPEN', 0, 1.72, z + 0.03, 0.26, 0.1, '#e9dcc0', '#6b4a3a', 70);
  }
  shapeMesh([[0, BASE], [0.48, BASE], [0.48, 0.212], [0, 0.298]], 0.96, '#b9b1a1', 0.48, 0, 0, -PI / 2);   // step-free threshold ramp
  // Back door: painted steel leaf with a small wired-glass light.
  ab('x', RD[0] + 0.03, (F + RD[3]) / 2, Z1 + T / 2, 0.06, RD[3] - F, 0.16, walnut); ab('x', RD[1] - 0.03, (F + RD[3]) / 2, Z1 + T / 2, 0.06, RD[3] - F, 0.16, walnut);
  box((RD[0] + RD[1]) / 2, RD[3] - 0.03, Z1 + T / 2, RD[1] - RD[0], 0.06, 0.16, walnut);
  box((RD[0] + RD[1]) / 2, (F + RD[3] - 0.06) / 2, Z1 + 0.06, RD[1] - RD[0] - 0.12, RD[3] - 0.06 - F, 0.04, '#8b857a');
  box((RD[0] + RD[1]) / 2, 1.85, Z1 + 0.035, 0.3, 0.36, 0.012, glass, false);
  box(RD[0] + 0.15, 1.2, Z1 + 0.02, 0.05, 0.14, 0.04, '#c9cfcc');

  // ================= awnings, signs, roof =================
  // Street awning: grey-blue canvas over the door and the big window, printed valance, iron arms.
  {
    const ax0 = -1.9, ax1 = 3.4, top = 2.98, low = 2.62, dep = 0.95, len = Math.hypot(dep, top - low), cx = (ax0 + ax1) / 2;
    const c = box(cx, (top + low) / 2, dep / 2, ax1 - ax0, 0.035, len, awning); c.rotation.x = Math.atan2(top - low, dep);
    box(cx, 2.5, dep + 0.005, ax1 - ax0, 0.26, 0.025, awning);
    const val = canvasTex(2048, 100, (q, w, h) => { q.fillStyle = '#616674'; q.fillRect(0, 0, w, h); q.fillStyle = '#efe6d2'; q.fillRect(0, 6, w, 3); q.fillRect(0, h - 9, w, 3);
      q.font = 'bold 66px sans-serif'; q.textBaseline = 'middle'; q.textAlign = 'center'; q.fillText('雨宿り珈琲', w * 0.42, h / 2 + 3); cupIcon(q, w * 0.58, h / 2 + 2, 52, '#efe6d2');
      q.font = 'bold 34px sans-serif'; q.fillText('COFFEE & CAKE', w * 0.82, h / 2 + 2); q.fillText('AMAYADORI', w * 0.16, h / 2 + 2); });
    mesh(new THREE.PlaneGeometry(ax1 - ax0 - 0.02, 0.24), new THREE.MeshToonMaterial({ map: val, gradientMap: K.ramp }), cx, 2.5, dep + 0.019, false);
    for (const x of [ax0, ax1]) shapeMesh([[0, top], [dep, low], [dep, 2.37], [0, 2.72]], 0.02, awning, x + (x === ax0 ? 0.02 : 0), 0, 0, -PI / 2);
    for (const x of [ax0 + 0.12, ax1 - 0.12]) line([[x, 2.25, 0.01], [x, 2.45, 0.5], [x, 2.6, dep - 0.04]], '#3d4a58', 0.016);
  }
  // Side awning over the east picture window; small steel canopy over the back door.
  { const out = 0.5, top = 2.74, low = 2.58, z0 = EW[0] - 0.12, z1 = EW[1] + 0.12, c = box(X0 - out / 2, (top + low) / 2, (z0 + z1) / 2, Math.hypot(out, top - low), 0.03, z1 - z0, awning);
    c.rotation.z = Math.atan2(top - low, out); box(X0 - out, 2.5, (z0 + z1) / 2, 0.02, 0.17, z1 - z0, awning); }
  box((RD[0] + RD[1]) / 2, 2.52, Z1 - 0.2, 1.25, 0.05, 0.4, trim);
  for (const x of [RD[0] - 0.05, RD[1] + 0.05]) line([[x, 2.2, Z1], [x, 2.5, Z1 - 0.37]], '#3d4a58', 0.014);
  // Round hanging sign with the cup mark, projecting east from the front corner.
  {
    const s = canvasTex(256, 256, (q, w) => { q.fillStyle = '#6b4a3a'; q.beginPath(); q.arc(w / 2, w / 2, w / 2 - 2, 0, 2 * PI); q.fill(); q.fillStyle = '#f1e6cf'; q.beginPath(); q.arc(w / 2, w / 2, w / 2 - 16, 0, 2 * PI); q.fill();
      cupIcon(q, w / 2 - 6, w / 2 - 4, 120, '#6b4a3a'); q.font = 'bold 34px sans-serif'; q.textAlign = 'center'; q.fillStyle = '#6b4a3a'; q.fillText('珈琲', w / 2, w * 0.86); });
    line([[X0, 2.62, -0.32], [X0 - 0.62, 2.62, -0.32]], '#3d4a58', 0.016); box(X0 - 0.01, 2.62, -0.32, 0.03, 0.12, 0.08, '#3d4a58');
    for (const x of [X0 - 0.2, X0 - 0.52]) line([[x, 2.62, -0.32], [x, 2.5, -0.32]], '#3d4a58', 0.006);
    cyl(X0 - 0.36, 2.26, -0.32, 0.25, 0.03, walnut).rotation.z = PI / 2;
    for (const k of [-1, 1]) { const d = mesh(new THREE.CircleGeometry(0.23, 32), new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, emissive: '#3a2a1c' }), X0 - 0.36 + k * 0.017, 2.26, -0.32, false); d.rotation.y = k * PI / 2; }
  }
  // Wall lanterns: by the front door and the back door (emissive heads, soft halo on the wall).
  for (const [x, z, d] of [[-0.62, Z0, 1], [1.28, Z1, -1]]) {
    box(x, 2.12, z + d * 0.04, 0.06, 0.12, 0.08, '#3d4a58'); box(x, 2.12, z + d * 0.12, 0.13, 0.2, 0.13, '#3d4a58');
    box(x, 2.11, z + d * 0.12, 0.1, 0.15, 0.135, bulb, false);
    const h = mesh(new THREE.PlaneGeometry(1.1, 1.1), additive(glowT, '#ffc27e', 0.32), x, 2.12, z + d * 0.004, false); if (d < 0) h.rotation.y = PI;
  }
  // Flat roof: slab, parapet with coping, membrane, two condensers on rails, extract hood and vent, scupper.
  K.setRoot(roofLayer);
  box((X0 + X1) / 2, (EAVE + 3.6) / 2, (Z0 + Z1) / 2, X1 - X0 + 0.1, 3.6 - EAVE, Z0 - Z1 + 0.1, '#9aa0a2');
  {
    const w = X1 - X0 + 0.1, d = Z0 - Z1 + 0.1, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
    for (const z of [Z0 + 0.05 - 0.07, Z1 - 0.05 + 0.07]) { box(cx, 3.73, z, w, 0.26, 0.14, stucco); box(cx, 3.885, z, w + 0.04, 0.05, 0.2, trim); }
    for (const x of [X0 - 0.05 + 0.07, X1 + 0.05 - 0.07]) { box(x, 3.73, cz, 0.14, 0.26, d - 0.28, stucco); box(x, 3.885, cz, 0.2, 0.05, d - 0.2, trim); }
    box(cx, 3.61, cz, w - 0.28, 0.02, d - 0.28, '#7f7b73', false);
  }
  for (const x of [1.25, 2.4]) {
    for (const z of [-4.72, -5.18]) box(x, 3.66, z, 0.92, 0.06, 0.07, metal);
    box(x, 3.98, -4.95, 0.84, 0.58, 0.36, '#c6cbc6');
    const g = mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), x - 0.1, 3.98, -4.768, false);
    for (let i = 0; i < 3; i++) box(x - 0.1, 3.9 + i * 0.08, -4.765, 0.38, 0.012, 0.01, '#9aa6ab', false);
    box(x + 0.3, 3.98, -4.768, 0.12, 0.42, 0.01, '#9aa6ab', false);
  }
  line([[2.8, 3.8, -4.95], [3.25, 3.8, -4.95], [3.25, 3.7, -4.6], [3.25, 3.7, -3.9]], '#8f9aa0', 0.03);
  box(-0.95, 3.82, -5.15, 0.5, 0.38, 0.5, '#a9b1b2'); box(-0.95, 4.06, -5.15, 0.62, 0.06, 0.62, metal);
  cyl(-1.45, 3.88, -3.9, 0.06, 0.52, '#a9b1b2'); cyl(-1.45, 4.16, -3.9, 0.11, 0.05, metal);
  group('cafe');
  // Downpipes: west front corner (from a parapet scupper) and the east rear corner, each into a splash block.
  for (const [x, z, sx] of [[X1 + 0.07, -0.42, 1], [X0 - 0.07, Z1 + 0.42, -1]]) {
    box(x - sx * 0.05, 3.66, z, 0.14, 0.08, 0.12, metal);
    cyl(x, (3.62 + 0.3) / 2, z, 0.04, 3.32, '#8796a0'); for (const y of [0.9, 2.0, 3.1]) box(x - sx * 0.03, y, z, 0.07, 0.03, 0.1, '#5f6c76');
    box(x + sx * 0.04, 0.22, z, 0.22, 0.06, 0.18, '#a39d91');
  }
  // West wall: gas water heater with its pipes and meter; rear wall: meter box and a louvred vent.
  box(X1 + 0.12, 1.4, -4.35, 0.22, 0.7, 0.48, '#d5d6cf'); box(X1 + 0.235, 1.55, -4.35, 0.01, 0.18, 0.24, '#7b8a92', false);
  line([[X1 + 0.1, 1.05, -4.25], [X1 + 0.1, 0.55, -4.25], [X1 + 0.03, 0.5, -4.25]], '#9aa3a6', 0.018); line([[X1 + 0.1, 1.05, -4.45], [X1 + 0.1, 0.6, -4.45], [X1 + 0.03, 0.55, -4.45]], '#b38a5e', 0.018);
  box(X1 + 0.08, 0.95, -5.25, 0.16, 0.26, 0.22, '#c4c7c0'); line([[X1 + 0.08, 0.82, -5.25], [X1 + 0.08, 0.45, -5.25], [X1 + 0.03, 0.4, -5.25]], '#c9a35b', 0.016);
  box(2.6, 1.65, Z1 - 0.06, 0.38, 0.5, 0.12, '#cdd0c9'); box(2.6, 1.72, Z1 - 0.125, 0.18, 0.12, 0.01, '#7b8a92', false);
  box(-0.9, 2.62, Z1 - 0.03, 0.4, 0.3, 0.06, '#c4c7c0'); for (let i = 0; i < 5; i++) box(-0.9, 2.51 + i * 0.055, Z1 - 0.065, 0.34, 0.012, 0.012, '#7f8b93', false);

  // ================= interior =================
  const chair = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, F, z); g.rotation.y = ry; K.setRoot(g);
    box(0, 0.43, 0, 0.4, 0.04, 0.4, wood); for (const s of [-1, 1]) box(s * 0.18, 0.215, 0, 0.035, 0.43, 0.36, woodD, false);
    box(0, 0.7, -0.19, 0.38, 0.28, 0.035, wood); for (const s of [-1, 1]) box(s * 0.17, 0.55, -0.19, 0.03, 0.3, 0.03, woodD, false); group('cafe').add(g); };
  const table = (x, z) => { cyl(x, F + 0.72, z, 0.32, 0.035, wood); cyl(x, F + 0.36, z, 0.035, 0.7, woodD); cyl(x, F + 0.015, z, 0.2, 0.03, woodD); };
  const cup = (x, y, z) => { cyl(x, y + 0.008, z, 0.065, 0.012, cupC); mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.07, 10), cupC, x, y + 0.05, z, false); mesh(new THREE.CircleGeometry(0.034, 10), W('#5a3726', 0.15), x, y + 0.083, z, false).rotation.x = -PI / 2; };
  const plant = (x, y, z, r, pot = '#b9876d', n = 6, wm = true) => { const M = wm ? W : mat; cyl(x, y + r * 0.6, z, r * 0.7, r * 1.2, M(pot)); for (let i = 0; i < n; i++) mesh(new THREE.SphereGeometry(r * (0.5 + rnd() * 0.25), 7, 5), wm ? green : mat('#6f9a86'), x + (rnd() - 0.5) * r * 1.2, y + r * 1.3 + rnd() * r * 1.1, z + (rnd() - 0.5) * r * 1.2, false); };
  // Furniture blocks drawn in a sub-frame shifted along z (keeps each block's own coordinates readable).
  const zone = dz => { const g = new THREE.Group(); g.position.z = dz; group('cafe').add(g); K.setRoot(g); };
  const pendant = (x, z, y) => { line([[x, CEIL, z], [x, y + 0.08, z]], '#3a3330', 0.006); const s = mesh(new THREE.ConeGeometry(0.13, 0.14, 14), W('#c39a62', 0.25), x, y + 0.07, z); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false); };
  // Front: window counter with three chairs facing the street; two tables for two by the east window.
  box(1.95, F + 0.73, -0.37, 2.5, 0.04, 0.38, wood); for (const x of [0.82, 3.08]) box(x, F + 0.36, -0.37, 0.04, 0.71, 0.3, woodD);
  for (const x of [1.15, 1.95, 2.75]) chair(x, -0.88, 0);
  for (const z of [-1.4, -2.85]) { table(-1.15, z); chair(-1.15, z + 0.55, PI); chair(-1.15, z - 0.55, 0); }
  cup(1.15, F + 0.75, -0.36); cup(2.75, F + 0.75, -0.4); cup(-1.05, F + 0.74, -1.3); cup(-1.25, F + 0.74, -1.5); cup(-1.12, F + 0.74, -2.8);
  cyl(-1.2, F + 0.82, -2.92, 0.03, 0.14, W('#d7e3dd', 0.25)); mesh(new THREE.SphereGeometry(0.05, 7, 5), W('#e9a98f', 0.3), -1.2, F + 0.92, -2.92, false);
  plant(-1.58, F, -0.45, 0.2, '#b9876d', 7); plant(3.1, F + 0.75, -0.36, 0.07, '#d9d2c2', 3);
  pendant(-1.15, -1.4, F + 1.75); pendant(-1.15, -2.85, F + 1.75); pendant(1.95, -0.5, F + 1.9); pendant(1.35, -2.92, F + 1.95); pendant(2.6, -2.92, F + 1.95);
  // Light pools under the pendants: on the table tops (kept inside the top) and on the floor of the aisle.
  for (const [x, z, y, r] of [[-1.15, -1.4, F + 0.741, 0.6], [-1.15, -2.85, F + 0.741, 0.6], [0, -1.9, F + 0.003, 1.8], [0.3, -3.6, F + 0.003, 1.2], [1.95, -1.6, F + 0.003, 1.5]]) decal(r, r, x, y, z, [0, -1], pool);
  // Coffee bar across the middle: refrigerated cake case at the aisle end, register, espresso machine and grinder.
  zone(0.28);
  box(1.0, F + 0.25, -3.2, 0.9, 0.5, 0.6, woodD); box(1.0, F + 1.15, -3.2, 0.9, 0.04, 0.6, woodD);
  box(1.0, F + 0.82, -3.16, 0.86, 0.62, 0.52, glass, false); for (const x of [0.57, 1.43]) box(x, F + 0.82, -3.2, 0.03, 0.62, 0.6, woodD, false);
  box(1.0, F + 1.115, -3.16, 0.8, 0.012, 0.42, new THREE.MeshBasicMaterial({ color: '#ffeccc' }), false);
  const cakes = ['#e9a3a0', '#6b4636', '#f0d79a', '#9fb784', '#f3ece0'];
  for (const [y, k] of [[F + 0.52, 0], [F + 0.82, 2]]) { box(1.0, y, -3.16, 0.82, 0.02, 0.46, stone, false);
    for (let i = 0; i < 4; i++) { cyl(0.72 + i * 0.185, y + 0.045, -3.12, 0.06, 0.07, W(cakes[(i + k) % 5], 0.35)); box(0.72 + i * 0.185, y + 0.09, -3.12, 0.04, 0.02, 0.04, W('#d8545a', 0.4), false); } }
  box(2.4, F + 0.45, -3.2, 1.9, 0.9, 0.6, W('#7a5442', 0.26)); box(2.4, F + 0.925, -3.2, 2.0, 0.05, 0.68, stone);
  for (const x of [1.6, 2.4, 3.2]) box(x, F + 0.45, -2.895, 0.02, 0.8, 0.012, woodD, false);
  box(1.75, F + 0.99, -3.15, 0.3, 0.08, 0.26, W('#3c4146', 0.1)); const scr = box(1.75, F + 1.1, -3.24, 0.22, 0.14, 0.015, W('#9fc9c0', 0.5)); scr.rotation.x = -0.4;
  box(2.55, F + 1.17, -3.25, 0.64, 0.44, 0.46, steel); box(2.55, F + 1.4, -3.25, 0.66, 0.03, 0.48, W('#8a3f35', 0.2));
  for (const x of [2.4, 2.7]) { cyl(x, F + 1.04, -3.52, 0.045, 0.06, W('#5d6366', 0.1)); box(x, F + 1.0, -3.6, 0.03, 0.03, 0.14, W('#2e2a28', 0.05), false); }
  box(2.55, F + 0.965, -3.55, 0.5, 0.02, 0.14, W('#6e7577', 0.1), false); cup(2.4, F + 0.975, -3.55);
  for (let i = 0; i < 3; i++) cup(2.38 + i * 0.12, F + 1.415, -3.22);
  line([[2.88, F + 1.15, -3.45], [2.92, F + 1.0, -3.55]], '#9aa3a6', 0.008);
  box(3.1, F + 1.075, -3.3, 0.18, 0.25, 0.22, W('#3b3f44', 0.08)); mesh(new THREE.CylinderGeometry(0.1, 0.05, 0.22, 10), W('#6b4a36', 0.35), 3.1, F + 1.31, -3.3);
  cyl(3.25, F + 1.0, -3.0, 0.05, 0.12, steel);
  // Back bar against the partition: sink, under-counter fridge, cup racks and the chalk menu.
  zone(0.3);
  box(2.175, F + 0.45, -4.42, 2.35, 0.9, 0.36, W('#7a5442', 0.26)); box(2.175, F + 0.925, -4.42, 2.4, 0.04, 0.42, stone);
  box(1.45, F + 0.947, -4.42, 0.42, 0.006, 0.26, W('#55606a', 0.08), false); line([[1.45, F + 0.95, -4.58], [1.45, F + 1.15, -4.56], [1.45, F + 1.12, -4.45]], '#b9c0c2', 0.012);
  box(2.75, F + 0.45, -4.235, 0.62, 0.72, 0.012, steel);
  for (const y of [F + 1.42, F + 1.78]) { box(2.2, y, -4.5, 2.2, 0.03, 0.22, wood); for (let i = 0; i < 11; i++) mesh(new THREE.CylinderGeometry(0.04, 0.033, 0.075, 8), cupC, 1.25 + i * 0.19, y + 0.053, -4.5, false); }
  for (let i = 0; i < 6; i++) cyl(1.3 + i * 0.36, F + 2.0, -4.52, 0.05, 0.16, W(i % 2 ? '#7c5638' : '#a77a50', 0.3));
  { const m = chalk(512, 200, [['MENU · 本日の珈琲', 34, 32], ['ブレンド  450', 82, 30], ['カフェラテ  520', 122, 30], ['ケーキセット  780', 162, 30]]);
    box(2.2, F + 2.42, -4.585, 1.56, 0.64, 0.03, woodD); mesh(new THREE.PlaneGeometry(1.48, 0.56), new THREE.MeshBasicMaterial({ map: m, color: '#d9cfbd' }), 2.2, F + 2.42, -4.568, false); }
  // Retail shelf of coffee beans by the east wall.
  zone(0.32);
  box(-1.82, F + 0.75, -4.27, 0.03, 1.5, 0.55, woodD); for (const z of [-4.0, -4.54]) box(-1.7, F + 0.75, z, 0.3, 1.5, 0.025, woodD); box(-1.7, F + 1.49, -4.27, 0.3, 0.025, 0.56, woodD);
  for (const y of [F + 0.35, F + 0.8, F + 1.25]) { box(-1.69, y, -4.27, 0.28, 0.025, 0.52, wood, false); for (let i = 0; i < 4; i++) box(-1.62, y + 0.1, -4.47 + i * 0.13, 0.1, 0.17, 0.1, W(i % 2 ? '#b98c5e' : '#8c6a4c', 0.3), false); }
  // Prep room: steel prep counter with sink along the rear wall, fridge, staff lockers, cool ceiling panel.
  zone(0.45);
  box(2.225, F + 0.45, -6.05, 2.25, 0.9, 0.58, steel); box(2.225, F + 0.915, -6.05, 2.3, 0.03, 0.62, W('#cfd5d3', 0.22));
  box(2.75, F + 0.925, -6.05, 0.5, 0.006, 0.38, W('#55606a', 0.06), false); line([[2.75, F + 0.93, -6.3], [2.75, F + 1.22, -6.28], [2.75, F + 1.18, -6.15]], '#b9c0c2', 0.012);
  box(1.6, F + 0.95, -6.0, 0.4, 0.03, 0.28, W('#e9d7b2', 0.3), false); for (let i = 0; i < 3; i++) box(1.35 + i * 0.22, F + 1.0, -6.22, 0.14, 0.14, 0.14, W('#e3e6df', 0.2), false);
  box(2.05, F + 1.62, -6.22, 1.9, 0.03, 0.24, steel); for (let i = 0; i < 7; i++) box(1.3 + i * 0.27, F + 1.72, -6.22, 0.16, 0.17, 0.16, W(i % 3 ? '#e0dbcd' : '#b98c5e', 0.25), false);
  box(-1.47, F + 0.93, -5.98, 0.72, 1.86, 0.64, steel); box(-1.47, F + 1.25, -5.655, 0.7, 0.01, 0.01, W('#7b8588', 0.1), false);
  for (const y of [F + 0.8, F + 1.5]) box(-1.18, y, -5.645, 0.03, 0.3, 0.03, W('#7b8588', 0.1), false);
  box(-1.62, F + 0.9, -5.22, 0.42, 1.8, 0.62, W('#8d9aa0', 0.2)); for (const z of [-5.07, -5.38]) { box(-1.405, F + 0.9, z, 0.01, 1.7, 0.29, W('#a4b0b4', 0.2), false); box(-1.4, F + 1.5, z, 0.012, 0.08, 0.2, W('#5f6a70', 0.1), false); }
  box(1.2, CEIL - 0.02, -5.5, 0.9, 0.03, 0.3, coolPanel, false);
  group('cafe');

  // ================= forecourt and attachments =================
  group('cafeFrontE');
  // Olive tree in a square planter by the door, a fern pot under the side window.
  box(-1.52, 0.42, 0.42, 0.42, 0.46, 0.42, '#9b8f80'); box(-1.52, 0.66, 0.42, 0.46, 0.03, 0.46, '#7b7166');
  line([[-1.52, 0.66, 0.42], [-1.5, 1.2, 0.42], [-1.56, 1.7, 0.4]], '#6f5a48', 0.03);
  for (let i = 0; i < 9; i++) mesh(new THREE.SphereGeometry(0.16 + rnd() * 0.08, 7, 5), mat(i % 3 ? '#6f9688' : '#88a58f'), -1.52 + (rnd() - 0.5) * 0.5, 1.45 + rnd() * 0.55, 0.42 + (rnd() - 0.5) * 0.45, false);
  plant(-2.42, 0.19, -0.5, 0.2, '#a98673', 6, false);
  group('cafeFrontW');
  // Umbrella stand beside the door, chalk A-board at the forecourt edge, low planter under the big window.
  box(0.86, 0.43, 0.3, 0.3, 0.48, 0.24, '#5f6f78'); box(0.86, 0.67, 0.3, 0.32, 0.03, 0.26, '#495862');
  for (let i = 0; i < 3; i++) { const x = 0.77 + i * 0.09; line([[x, 0.6, 0.3], [x, 1.18, 0.3], [x + 0.06, 1.24, 0.3], [x + 0.08, 1.16, 0.3]], '#b1c5c1', 0.013); mesh(new THREE.ConeGeometry(0.05, 0.5, 7), mat(K.colors[(i * 2 + 1) % 6]), x, 0.9, 0.3); }
  {
    const board = chalk(256, 320, [['Coffee', 58, 52, 'serif'], ['本日のケーキ', 238, 26], ['ブレンド ¥450', 284, 26, 'sans-serif', '#f0c987']]);
    const ctx = board.image.getContext('2d'); cupIcon(ctx, 128, 150, 90, '#efe9da'); board.needsUpdate = true;
    const g = new THREE.Group(); g.position.set(2.72, 0.19, 1.38); g.rotation.y = 0.12; K.setRoot(g);
    for (const s of [-1, 1]) { const p = new THREE.Group(); p.rotation.x = -s * 0.2; g.add(p);   // two leaves leaning together: an A-frame
      box(0, 0.47, s * 0.2, 0.5, 0.9, 0.025, walnut, true, p); mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshBasicMaterial({ map: board, color: '#c9c3b6' }), 0, 0.54, s * 0.2 + s * 0.015, false, p).rotation.y = s > 0 ? 0 : PI; }
    group('cafeFrontW').add(g);
  }
  box(2.7, 0.36, 0.28, 1.0, 0.34, 0.3, '#8f877b'); box(2.7, 0.54, 0.28, 1.04, 0.03, 0.34, '#776f65');
  for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(0.11, 7, 5), mat(i % 2 ? '#6f9688' : '#7fa08a'), 2.3 + i * 0.16, 0.62 + rnd() * 0.06, 0.28 + (rnd() - 0.5) * 0.1, false);
  for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.035, 6, 4), mat(['#e7c3c8', '#f1e6c4', '#cfb4d9'][i % 3]), 2.35 + i * 0.25, 0.72, 0.3, false);
  group('cafeUtility');
  // Split-type AC outdoor unit on the west side with its insulated pipe cover running into the wall.
  box(X1 + 0.18, 0.5, -3.3, 0.3, 0.58, 0.8, '#d6d8d2'); for (const z of [-3.62, -2.98]) box(X1 + 0.18, 0.2, z, 0.28, 0.02, 0.06, '#7f8b93', false);
  mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), X1 + 0.335, 0.52, -3.42, false).rotation.y = PI / 2;
  for (let i = 0; i < 4; i++) box(X1 + 0.337, 0.4 + i * 0.08, -3.42, 0.01, 0.012, 0.38, '#9aa6ab', false);
  box(X1 + 0.06, 1.0, -2.82, 0.1, 0.9, 0.1, '#e1ddd2'); box(X1 + 0.06, 0.62, -2.95, 0.1, 0.1, 0.25, '#e1ddd2');
  group('cafeService');
  // Fenced bin yard at the rear east corner: slatted cedar panels on posts, a gate to the rear path.
  {
    const sx0 = -3.35, sx1 = -2.15, sz0 = -6.4, sz1 = -4.9, h = 1.15;
    const slatTexA = canvasTex(128, 64, (q, w, hh) => { for (let i = 0; i < 8; i++) { q.fillStyle = `hsl(25,${22 + rnd() * 8}%,${34 + rnd() * 8}%)`; q.fillRect(i * 16, 0, 12, hh); } });
    slatTexA.wrapS = THREE.RepeatWrapping;
    const slatMat = len => { const t = slatTexA.clone(); t.needsUpdate = true; t.repeat.set(len / 0.9, 1); return new THREE.MeshToonMaterial({ map: t, gradientMap: K.ramp, alphaTest: 0.5, side: THREE.DoubleSide }); };
    for (const [x, z] of [[sx0, sz0], [sx1, sz0], [sx0, sz1], [sx1, sz1]]) box(x, 0.19 + h / 2, z, 0.07, h, 0.07, '#5d4a3c');
    const sides = [['z', sx0, sz0, sz1], ['z', sx1, sz0, sz1], ['x', sz1, sx0, sx1]];
    for (const [ax, at, a, b] of sides) { const len = b - a, m = mesh(new THREE.PlaneGeometry(len - 0.07, h - 0.08), slatMat(len), ax === 'x' ? (a + b) / 2 : at, 0.19 + h / 2, ax === 'x' ? at : (a + b) / 2, false); if (ax === 'z') m.rotation.y = PI / 2;
      for (const y of [0.32, 0.19 + h - 0.08]) ab(ax, (a + b) / 2, y, at, len, 0.04, 0.05, '#5d4a3c'); }
    const gate = mesh(new THREE.PlaneGeometry(0.98, h - 0.12), slatMat(1), sx0 + 0.05 + 0.49 * Math.cos(0.5), 0.19 + h / 2, sz0 + 0.49 * Math.sin(0.5), false); gate.rotation.y = -0.5;
    for (const [x, c] of [[-3.0, '#5f8a74'], [-2.5, '#4f7290']]) { box(x, 0.19 + 0.33, -5.55, 0.42, 0.66, 0.5, c); box(x, 0.19 + 0.68, -5.55, 0.46, 0.05, 0.54, c); }
    box(-2.75, 0.32, -6.1, 0.5, 0.26, 0.34, '#c8b37a'); for (let i = 0; i < 6; i++) cyl(-2.92 + (i % 3) * 0.16, 0.5, -6.18 + Math.floor(i / 3) * 0.16, 0.035, 0.14, '#cfe0dc');
    box(-3.2, 0.62, -5.55, 0.06, 0.82, 0.6, '#b08f6a');
  }
  group('cafeGround');
  // Forecourt pavers from the facade to the sidewalk, the rear path to alley A01, entrance mat.
  const paveMat = warm('#ffffff', 0, pavers);
  mesh(tileUV(new THREE.BoxGeometry(6.7, 0.016, 2), 6.7 / 2, 1), paveMat, 0.75, 0.198, 1.0, false);
  mesh(tileUV(new THREE.BoxGeometry(1.2, 0.016, 7.5 + Z1), 0.6, (7.5 + Z1) / 2), paveMat, (RD[0] + RD[1]) / 2, 0.198, (Z1 - 7.5) / 2, false);   // to the plot's rear edge on A01
  box(0, 0.214, 0.78, 0.92, 0.014, 0.5, '#5e4c44', false); box(0, 0.222, 0.78, 0.74, 0.004, 0.36, '#7d6658', false);
  // Window light on the wet ground (additive, no real lights): street front, east side, back door.
  const spill = additive(spillT, '#ffbf7a', 0.26);
  decal(2.9, 1.7, 1.95, 0.208, 0.88, [0, -1], spill); decal(1.0, 1.1, -1.25, 0.208, 0.6, [0, -1], spill); decal(0.9, 1.2, 0, 0.226, 1.0, [0, -1], spill);
  decal(3.2, 1.3, X0 - 0.66, 0.2, (EW[0] + EW[1]) / 2, [1, 0], spill);
  decal(1.3, 0.9, (RD[0] + RD[1]) / 2, 0.208, Z1 - 0.45, [0, 1], additive(glowT, '#ffc27e', 0.22));

  // ================= local animation: window rain, eave drips, faint coffee steam =================
  group('cafe');
  // Window runs and eave drips are short line segments in two batches (2 draw calls), moved every frame.
  const fx = new THREE.Group(); fx.userData.live = true; group('cafe').add(fx); K.setRoot(fx);
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6), wisps = [];
  for (let i = 0; i < 16; i++) runs.add(FW2[0] + 0.1 + rnd() * (FW2[1] - FW2[0] - 0.2), FW2[2] + 0.1 + rnd() * 1.4, -0.068, 0.07 + rnd() * 0.06, FW2[2] + 0.06, FW2[3] - 0.16, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 10; i++) runs.add(X0 + 0.064, EW[2] + 0.1 + rnd() * 1.4, EW[0] + 0.1 + rnd() * (EW[1] - EW[0] - 0.2), 0.07 + rnd() * 0.06, EW[2] + 0.06, EW[3] - 0.16, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 4; i++) runs.add(-0.25 + rnd() * 0.5, 1.0 + rnd() * 1.1, -0.02, 0.08, 0.75, 2.2, 0.09 + rnd() * 0.05);
  for (let i = 0; i < 13; i++) drips.add(-1.8 + i * 0.4 + rnd() * 0.2, 0.25 + rnd() * 2, 0.965, 0.09, 0.25, 2.27, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 5; i++) drips.add(X0 - 0.5, 0.25 + rnd() * 2, EW[0] + 0.15 + i * 0.68, 0.09, 0.25, 2.31, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 3; i++) drips.add(RD[0] + 0.1 + i * 0.32, 0.25 + rnd() * 2, Z1 - 0.38, 0.09, 0.25, 2.39, 2.1 + rnd() * 0.5);
  runs.seal(); drips.seal();
  const steamT = canvasTex(64, 128, (q, w, h) => { q.strokeStyle = 'rgba(255,255,255,.55)'; q.lineCap = 'round'; q.filter = 'blur(3px)';
    for (const [o, lw] of [[-6, 7], [6, 5]]) { q.lineWidth = lw; q.beginPath(); q.moveTo(w / 2 + o, h - 6); q.bezierCurveTo(w / 2 + o - 16, h * 0.65, w / 2 + o + 16, h * 0.4, w / 2 + o - 4, 8); q.stroke(); } });
  for (const [x, y, z] of [[1.15, F + 0.85, -0.36], [-1.05, F + 0.84, -1.3], [2.4, F + 1.08, -3.27]]) {
    const g = new THREE.Group(); g.position.set(x, y, z); fx.add(g); const m = new THREE.MeshBasicMaterial({ map: steamT, color: '#fff3e2', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    for (const r of [0, PI / 2]) mesh(new THREE.PlaneGeometry(0.1, 0.22), m, 0, 0.11, 0, false, g).rotation.y = r;
    wisps.push({ g, m, y, phase: rnd() * 3 });
  }
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt);
      for (const w of wisps) { const p = ((t + w.phase) % 3.2) / 3.2; w.g.position.y = w.y + p * 0.16; w.g.scale.set(1 + p * 0.6, 1 + p * 0.4, 1 + p * 0.6); w.m.opacity = 0.13 * Math.sin(PI * p); }
    },
  };
};
