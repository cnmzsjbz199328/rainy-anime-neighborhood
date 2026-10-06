// B05-P02 雨音らーめん: rebuilt one-storey noodle shop for the north-facing corner row.
// Local +Z faces the street; the door centre is the origin. At rotY=PI, local +X is viewer-left/world W.
// Body: x -3.05…3.05, z -5.15…0; tiled eaves to z -5.43…0.42; door world position is frozen at (-23.5, 23.96).
// Groups: ramenShop (shell, roof, interior) · ramenShopFrontWest/East (front pots and menu)
// · ramenShopService (west-side AC/heater) · ramenShopRear (rear bins) · ramenShopGround (entry paving).
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B05-P02'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, label, mat, warm, glow, glass, wall, panel, tileUV } = K;
  const PI = Math.PI, F = rec.floor, X0 = -3.05, X1 = 3.05, Z0 = 0, Z1 = -5.15, T = 0.16;
  const BASE = F, EAVE = F + 2.95, RIDGE = F + 4.28, CEIL = F + 2.68, IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T / 2, IZ1 = Z1 + T / 2;
  const FD = [-0.55, 0.55, BASE, BASE + 2.12];
  const FW = [[-2.86, -0.78, BASE + 0.9, BASE + 2.28], [0.78, 2.86, BASE + 0.9, BASE + 2.28]];
  const REAR = [-2.35, -1.35, BASE, BASE + 2.08];
  const WEST_WIN = [-2.5, -0.95, BASE + 1.02, BASE + 2.15];
  const EAST_WIN = [-1.8, -0.82, BASE + 0.92, BASE + 2.1];
  const stucco = mat('#c9b89d'), wood = mat('#79543e'), woodLight = mat('#9a7253'), darkWood = mat('#4b3834');
  const tile = mat('#444a58'), tileLight = mat('#606574'), stone = mat('#777873'), metal = mat('#89949a');
  const W = (c, k = 0.28) => warm(c, k);
  const cream = W('#ead8b6', 0.3), pale = W('#f0e5ce', 0.28), counter = W('#9b6f4d', 0.26), counterTop = W('#c19a6e', 0.22);
  const steel = W('#aab2b2', 0.15), black = mat('#39404a'), lantern = new THREE.MeshBasicMaterial({ color: '#ffd489' });
  const ab = (axis, u, y, d, w, h, t, c, outline = true, parent) => axis === 'x'
    ? box(u, y, d, w, h, t, c, outline, parent)
    : box(d, y, u, t, h, w, c, outline, parent);
  const shapeMesh = (pts, depth, c, x, y, z, parent, outlined = true) => {
    const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -depth / 2);
    return mesh(geo, c, x, y, z, outlined, parent);
  };
  const plant = (x, z, s, parent) => {
    cyl(x, F + 0.18, z, s * 0.48, 0.36, '#80645a', parent);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4, r = s * (0.15 + (i % 2) * 0.12);
      mesh(new THREE.SphereGeometry(s * (0.31 + (i % 3) * 0.035), 7, 5), W(i % 2 ? '#587e70' : '#71957d', 0.16),
        x + Math.cos(a) * r, F + 0.52 + (i % 3) * 0.09, z + Math.sin(a) * r, false, parent);
    }
  };

  // ── Shell and real wall openings ───────────────────────────────────────────
  const body = group('ramenShop');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, EAVE], [...FW, FD], stucco);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, EAVE], [REAR], stucco);
  wall('z', X0 + T / 2, T, [Z1, Z0, BASE, EAVE], [WEST_WIN], stucco);
  wall('z', X1 - T / 2, T, [Z1, Z0, BASE, EAVE], [EAST_WIN], stucco);
  // Gable ends are also thick walls, not flat facade cards.
  shapeMesh([[X0, EAVE], [X1, EAVE], [0, RIDGE]], T, stucco, 0, 0, Z0, body);
  shapeMesh([[X0, EAVE], [X1, EAVE], [0, RIDGE]], T, stucco, 0, 0, Z1, body);
  // Base course and timber corner posts.
  for (const z of [Z0 + 0.015, Z1 - 0.015]) {
    const holes = z === Z0 + 0.015 ? [...FW, FD] : [REAR];
    const spans = [X0, ...holes.flatMap(h => [h[0], h[1]]), X1].sort((a, b) => a - b);
    for (let i = 0; i + 1 < spans.length; i += 2) box((spans[i] + spans[i + 1]) / 2, F + 0.105, z, spans[i + 1] - spans[i], 0.19, 0.12, wood);
  }
  for (const x of [X0 + 0.04, X1 - 0.04]) {
    box(x, F + 1.55, Z0 - 0.02, 0.12, 2.72, 0.17, wood);
    box(x, F + 1.55, Z1 + 0.02, 0.12, 2.72, 0.17, wood);
  }
  // Plank floor and pale ceiling; the ceiling belongs to the lifted roof layer.
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, 0.12, IZ0 - IZ1), 3.1, 2.5), W('#817461', 0.16), 0, F - 0.025, (IZ0 + IZ1) / 2, false);
  const roof = new THREE.Group(); roof.userData.layer = 'roof'; body.add(roof);
  box(0, CEIL, (IZ0 + IZ1) / 2, IX1 - IX0, 0.035, IZ0 - IZ1, pale, false, roof);
  // Warm interior wall lining around the same openings.
  panel('x', Z0 - T + 0.02, 0.012, [IX0, IX1, BASE, CEIL], [...FW, FD], cream);
  panel('x', Z1 + T - 0.02, 0.012, [IX0, IX1, BASE, CEIL], [REAR], W('#e6ddca', 0.14));
  panel('z', X0 + T - 0.02, 0.012, [Z1, Z0, BASE, CEIL], [WEST_WIN], cream);
  panel('z', X1 - T + 0.02, 0.012, [Z1, Z0, BASE, CEIL], [EAST_WIN], cream);
  panel('x', Z0 - T + 0.005, 0.012, [IX0, IX1, BASE, BASE + 0.82], [...FW, FD], W('#8a5b43', 0.17));

  // Interior threshold and door panels, framed windows with mullions, and timber sills.
  for (const [a, b, p, q] of [...FW, FD, REAR]) {
    const z = p === REAR[2] ? Z1 + T / 2 : Z0 - T / 2;
    const isBack = a === REAR[0] && b === REAR[1];
    for (const x of [a + 0.04, b - 0.04]) box(x, (p + q) / 2, z, 0.075, q - p, 0.12, wood);
    box((a + b) / 2, q - 0.035, z, b - a, 0.07, 0.12, wood);
    if (!isBack && p !== BASE) {
      box((a + b) / 2, p + 0.04, z, b - a, 0.08, 0.12, wood);
      const pane = box((a + b) / 2, (p + q) / 2, z, b - a - 0.1, q - p - 0.12, 0.012, glass, false);
      pane.material.opacity = 0.16;
      if (a === FW[0][0]) {
        box((a + b) / 2, (p + q) / 2, z + 0.035, 0.045, q - p - 0.12, 0.055, wood);
        box((a + b) / 2, p + 0.32, z + 0.035, b - a - 0.1, 0.045, 0.055, wood);
        box((a + b) / 2, p - 0.045, z + 0.15, b - a + 0.18, 0.09, 0.32, woodLight);
      }
    } else if (!isBack) {
      const pane = box((a + b) / 2, (p + q) / 2, z + 0.015, b - a - 0.12, q - p - 0.12, 0.012, glass, false);
      pane.material.opacity = 0.14;
      box((a + b) / 2, p + 0.035, z, b - a, 0.07, 0.12, wood);
      for (const x of [a + 0.22, b - 0.22]) box(x, (p + q) / 2, z + 0.025, 0.055, q - p - 0.1, 0.06, woodLight);
      for (const y of [p + 0.15, q - 0.12]) box((a + b) / 2, y, z + 0.025, b - a - 0.45, 0.04, 0.06, woodLight);
      box(b - 0.19, BASE + 1.1, z + 0.08, 0.035, 0.42, 0.035, '#b98a58');
    } else {
      box((a + b) / 2, (p + q) / 2, z, b - a - 0.09, q - p - 0.08, 0.035, '#52606a');
      box((a + b) / 2, (p + q) / 2 + 0.24, z - 0.03, 0.34, 0.4, 0.012, glass, false);
      box(b - 0.17, BASE + 1.05, z - 0.04, 0.035, 0.16, 0.035, '#b98a58');
    }
  }
  // Side elevation glazing and wooden lintels/sills.
  for (const [x, win] of [[X0 + T / 2, WEST_WIN], [X1 - T / 2, EAST_WIN]]) {
    const [a, b, p, q] = win;
    box(x, (p + q) / 2, (a + b) / 2, 0.014, q - p - 0.12, b - a - 0.12, glass, false);
    box(x, p + 0.05, (a + b) / 2, 0.12, 0.1, b - a + 0.08, wood);
    box(x, q - 0.04, (a + b) / 2, 0.12, 0.08, b - a + 0.08, wood);
    for (const z of [a + 0.04, b - 0.04]) box(x, (p + q) / 2, z, 0.12, q - p, 0.08, wood);
    box(x + (x < 0 ? -0.12 : 0.12), p - 0.04, (a + b) / 2, 0.26, 0.08, b - a + 0.22, woodLight);
  }
  // Interior partition: customer counter in front, separate compact kitchen at the rear.
  const partZ = -3.35, opening = [-0.58, 0.58, BASE, CEIL];
  wall('x', partZ, 0.12, [IX0, IX1, BASE, CEIL], [opening], W('#e8dcc4', 0.18));
  panel('x', partZ + 0.07, 0.012, [IX0, IX1, BASE, CEIL], [opening], W('#eadfc9', 0.2));
  box((IX0 + opening[0]) / 2, (BASE + CEIL) / 2, partZ + 0.07, opening[0] - IX0, CEIL - BASE, 0.025, W('#efe2ca', 0.22), false);
  box((opening[1] + IX1) / 2, (BASE + CEIL) / 2, partZ + 0.07, IX1 - opening[1], CEIL - BASE, 0.025, W('#efe2ca', 0.22), false);
  // Entrance noren: the shop's warm red curtain sits just inside the glazed door.
  const noren = new THREE.Group(); noren.position.set(0, F + 2.15, Z0 + 0.02); body.add(noren);
  for (let i = 0; i < 4; i++) {
    const x = -0.48 + i * 0.32, panelG = new THREE.Group(); panelG.position.set(x, 0, 0); noren.add(panelG);
    box(0, -0.36, 0, 0.28, 0.7, 0.045, i % 2 ? '#984e47' : '#a85a4e', true, panelG);
    box(0, -0.36, 0.03, 0.22, 0.58, 0.018, '#ad6256', false, panelG);
    for (let j = 0; j < 3; j++) box(0, -0.18 - j * 0.12, 0.045, 0.025, 0.02, 0.01, '#e4cfaa', false, panelG);
  }
  box(0, CEIL - 0.08, partZ + 0.11, 1.28, 0.09, 0.12, darkWood);

  // ── Roof: symmetric Japanese tile gable, visible thickness, ridge caps, fascia and chimney ──
  K.setRoot(roof);
  const half = 2.82, rise = RIDGE - EAVE, pitch = Math.atan(rise / half), slope = Math.hypot(half, rise), ridgeZ = -2.57;
  for (const side of [-1, 1]) {
    const frontSide = side > 0, zEave = frontSide ? 0.42 : -5.43;
    const zMid = (ridgeZ + zEave) / 2, yMid = (RIDGE + EAVE) / 2;
    const slab = box(0, yMid, zMid, 6.92, 0.18, slope + 0.12, tile, true, roof);
    slab.rotation.x = frontSide ? pitch : -pitch;
    // Tile courses and standing seams follow each plane's slope.
    for (let i = 1; i <= 8; i++) {
      const f = i / 9, z = ridgeZ + (zEave - ridgeZ) * f, y = RIDGE - rise * f + 0.105;
      const row = line([[X0 - 0.32, y, z], [X1 + 0.32, y, z]], i % 2 ? '#777888' : '#323845', 0.025, roof);
      row.material.transparent = true; row.material.opacity = 0.75;
    }
    for (const x of [-2.7, -1.8, -0.9, 0, 0.9, 1.8, 2.7]) {
      const seam = line([[x, EAVE + 0.1, zEave], [x, RIDGE + 0.1, ridgeZ]], '#343946', 0.018, roof);
      seam.material.transparent = true; seam.material.opacity = 0.55;
    }
    box(0, EAVE - 0.02, zEave, 7.04, 0.17, 0.18, wood, true, roof);
  }
  // Gable vent grilles and timber bargeboards.
  for (const z of [0.09, Z1 - 0.09]) {
    box(0, (EAVE + RIDGE) / 2 + 0.04, z, 0.58, 0.34, 0.045, '#52606a', false, roof);
    for (let i = -2; i <= 2; i++) box(i * 0.09, (EAVE + RIDGE) / 2 + 0.04, z + 0.028, 0.025, 0.28, 0.025, woodLight, false, roof);
    for (const side of [-1, 1]) line([[0, RIDGE, z], [side * 3.47, EAVE - 0.06, z]], darkWood, 0.065, roof);
  }
  // Ridge caps: dark half-round tiles along the full ridge.
  const ridgeGeo = new THREE.CylinderGeometry(0.12, 0.12, 6.95, 10);
  const ridgeMesh = mesh(ridgeGeo, tileLight, 0, RIDGE + 0.08, ridgeZ, true, roof); ridgeMesh.rotation.z = PI / 2;
  for (let x = -3.05; x <= 3.05; x += 0.52) {
    const cap = mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.44, 8), tileLight, x, RIDGE + 0.09, ridgeZ, true, roof);
    cap.rotation.z = PI / 2;
  }
  // Rear kitchen flue with cap, ledge and braces; its tip stays below the 9 m plot cap.
  box(1.72, 5.4, -4.26, 0.46, 2.65, 0.48, '#777776', true, roof);
  box(1.72, 6.76, -4.26, 0.65, 0.16, 0.68, '#484b4c', true, roof);
  box(1.72, 5.06, -4.26, 0.72, 0.11, 0.72, metal, true, roof);
  for (const x of [1.4, 2.04]) line([[x, 4.8, -4.26], [x, 5.18, -4.26]], '#555b60', 0.025, roof);
  // Front awning, amber lanterns and the original shop identity.
  box(0, 2.92, 0.33, 5.9, 0.13, 0.88, '#694c48');
  box(0, 2.7, 0.72, 5.9, 0.42, 0.12, '#8d4c45');
  for (let i = 0; i < 12; i++) box(-2.85 + i * 0.518, 2.69, 0.79, 0.025, 0.32, 0.035, i % 2 ? '#d7b68d' : '#643d3a', false);
  label('雨音らーめん', 0, 2.7, 0.814, 3.1, 0.22, '#8d4c45', '#f1dfbf', 116);
  for (const x of [-2.78, 2.78]) {
    box(x, 2.05, 0.17, 0.17, 0.48, 0.16, '#4b3d3c');
    box(x, 2.05, 0.27, 0.12, 0.32, 0.12, lantern, false);
    box(x, 2.31, 0.18, 0.28, 0.06, 0.2, wood);
  }
  // ── Ramen counter, customer seating and a separate working kitchen ──────────
  K.setRoot(body);
  // Customer seating: near-window ledge, stools, L-shaped counter and bowls.
  box(1.78, F + 0.77, -1.12, 1.72, 0.09, 2.15, counterTop);
  box(1.78, F + 0.4, -1.12, 1.58, 0.7, 1.98, counter);
  box(1.78, F + 0.85, -1.12, 1.8, 0.09, 2.2, woodLight);
  for (const z of [-0.42, -1.12, -1.82]) {
    cyl(0.6, F + 0.47, z, 0.22, 0.36, '#5b4240');
    cyl(0.6, F + 0.66, z, 0.25, 0.07, '#a16b4f');
    cyl(0.6, F + 0.9, z, 0.16, 0.03, '#e7d6bd');
  }
  // L turns toward the back, leaving an uninterrupted 1.0 m central route from the door to the kitchen.
  box(-1.98, F + 0.76, -1.63, 0.95, 0.1, 2.6, counterTop);
  box(-1.98, F + 0.42, -1.63, 0.82, 0.64, 2.44, counter);
  box(-1.32, F + 0.76, -2.72, 1.35, 0.1, 0.63, counterTop);
  box(-1.32, F + 0.42, -2.72, 1.22, 0.64, 0.5, counter);
  for (const z of [-0.76, -1.6, -2.42]) {
    cyl(-1.93, F + 0.47, z, 0.21, 0.36, '#614640');
    cyl(-1.93, F + 0.66, z, 0.24, 0.06, '#b27854');
  }
  const bowl = (x, z, c = '#e8dfcf') => {
    cyl(x, F + 0.91, z, 0.19, 0.08, c);
    mesh(new THREE.TorusGeometry(0.145, 0.022, 7, 16), W('#b58c61', 0.16), x, F + 0.97, z, false);
    for (let i = 0; i < 3; i++) cyl(x - 0.04 + i * 0.045, F + 1.0, z + 0.015, 0.018, 0.025, '#b98b58');
  };
  for (const [x, z] of [[1.3, -0.95], [2.0, -1.55], [1.54, -2.28], [-2.05, -0.82], [-1.92, -1.62]]) bowl(x, z);
  // Kitchen tile floor and stainless worktops at the back of the partition.
  box(0, F + 0.09, -4.25, 5.78, 0.12, 1.64, W('#9b9990', 0.12), false);
  // Ramen boiler / noodle cooker: three pots on a connected stainless range.
  box(0.92, F + 0.47, -4.42, 2.5, 0.7, 0.76, steel);
  box(0.92, F + 0.86, -4.42, 2.64, 0.08, 0.84, '#707c80');
  for (const x of [0.14, 0.92, 1.7]) {
    cyl(x, F + 1.03, -4.4, 0.27, 0.23, '#595c60');
    cyl(x, F + 1.16, -4.4, 0.23, 0.035, '#b8b9ae');
    cyl(x, F + 1.24, -4.4, 0.19, 0.025, '#e4ddca');
    for (let i = 0; i < 4; i++) line([[x - 0.11 + i * 0.07, F + 1.25, -4.4], [x - 0.1 + i * 0.07, F + 1.51, -4.4]], '#e6d6b5', 0.008);
    cyl(x, F + 0.98, -4.4, 0.045, 0.03, '#ce9860');
  }
  // Stainless extraction hood and duct aligned to the roof flue.
  box(1.72, F + 2.28, -4.05, 1.62, 0.18, 0.82, '#7e8587');
  box(1.72, F + 2.03, -4.24, 1.1, 0.28, 0.45, '#8e9799');
  box(1.72, 4.92, -4.26, 0.27, 1.28, 0.27, '#929a99');
  box(1.72, 4.31, -4.26, 0.44, 0.08, 0.44, '#666d70');
  // Rear shelves, refrigerator, sink, prep table and stocked ingredient tubs.
  box(-2.38, F + 1.22, -4.88, 0.92, 1.9, 0.43, '#7b7774');
  box(-2.38, F + 1.22, -4.64, 0.78, 1.64, 0.04, '#b7c0bb', false);
  for (let i = 0; i < 4; i++) {
    box(-2.38, F + 0.55 + i * 0.39, -4.59, 0.7, 0.035, 0.12, '#d2d2c7');
    for (let j = 0; j < 3; j++) cyl(-2.62 + j * 0.23, F + 0.68 + i * 0.39, -4.57, 0.065, 0.16, ['#c7b27d', '#a78367', '#718a7c'][(i + j) % 3]);
  }
  box(-1.32, F + 0.66, -4.65, 1.0, 0.12, 0.72, '#999b97');
  box(-1.32, F + 0.37, -4.65, 0.12, 0.5, 0.62, '#737a7b');
  box(-1.32, F + 0.74, -4.65, 0.56, 0.035, 0.38, '#60696d', false);
  box(-1.32, F + 0.77, -4.65, 0.43, 0.018, 0.27, '#acb3ae', false);
  line([[-1.06, F + 0.78, -4.72], [-1.0, F + 0.62, -4.72], [-1.0, F + 0.5, -4.85]], '#a2adae', 0.022);
  // Wall shelf and hanging utensils.
  box(0.12, F + 2.13, -4.97, 1.05, 0.08, 0.32, wood);
  for (let i = 0; i < 5; i++) {
    box(-0.28 + i * 0.2, F + 2.32, -4.96, 0.13, 0.3, 0.16, ['#bba889', '#d3c7ad', '#91a5a0', '#c59973', '#b2b9ae'][i]);
    line([[-0.25 + i * 0.2, F + 1.75, -5.0], [-0.25 + i * 0.2, F + 1.94, -5.0], [-0.19 + i * 0.2, F + 1.94, -5.0]], '#747b7c', 0.025);
  }
  // Rear exit and a small glazed side window show the working area from both elevations.
  box(-1.85, (REAR[2] + REAR[3]) / 2, Z1 + 0.03, REAR[1] - REAR[0] - 0.12, REAR[3] - REAR[2] - 0.12, 0.045, woodLight);
  box(-1.85, F + 1.4, Z1 + 0.06, 0.3, 0.48, 0.015, glass, false);
  box(X1 - T - 0.02, F + 2.05, -1.0, 0.38, 0.045, 0.62, woodLight);
  const sideLabel = label('厨房', X1 - T + 0.08, F + 2.08, -1.0, 0.46, 0.22, '#efe1c8', '#624d43', 86);
  sideLabel.rotation.y = PI / 2;
  // Warm bowls and wall lamps use baked emissive material; this building adds no realtime lights.
  box(0.75, F + 2.45, 0.08, 1.32, 0.08, 0.08, wood);
  label('いらっしゃいませ', 0.75, F + 2.47, 0.13, 1.15, 0.16, '#e8d6b7', '#684a42', 70);

  // Two soft local motions only: noren sway and low steam above the noodle pots.
  const steam = new THREE.Group(); steam.userData.live = true; body.add(steam);
  const steamBits = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.MeshBasicMaterial({ color: '#e9e5d9', transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide });
    const p = mesh(new THREE.PlaneGeometry(0.15 + (i % 2) * 0.04, 0.28), m,
      0.45 + (i % 2) * 0.42, F + 1.45 + (i % 3) * 0.16, -4.4, false, steam);
    steamBits.push({ p, phase: i * 1.57, y: p.position.y });
  }

  // ── Separate exterior attachments ─────────────────────────────────────────
  group('ramenShopFrontWest');
  plant(3.35, 0.28, 0.52, group('ramenShopFrontWest'));
  // Low planter and stone threshold stay to the viewer-left of the clear doorway.
  box(2.98, F + 0.12, 0.42, 0.62, 0.22, 0.44, '#776d60');
  group('ramenShopFrontEast');
  // Menu stand at viewer-right; the center approach remains clear.
  box(-2.72, F + 0.38, 0.48, 0.62, 0.74, 0.11, darkWood);
  const menu = label('醤油 · 味噌 · 塩', -2.72, F + 0.52, 0.545, 0.5, 0.46, '#d7c7a8', '#5d5147', 54);
  menu.rotation.x = -0.12;
  for (let i = 0; i < 3; i++) box(-2.72, F + 0.08, 0.52, 0.56 - i * 0.05, 0.03, 0.12, '#493d39');

  group('ramenShopService');
  // Exterior west kitchen service: air conditioner, water heater, gas and drain pipes on brackets.
  box(3.43, F + 1.04, -2.8, 0.48, 0.78, 0.9, '#b5b9b4');
  box(3.43, F + 1.04, -2.32, 0.34, 0.52, 0.025, '#65747c', false);
  for (let i = 0; i < 6; i++) box(3.43, F + 0.83 + i * 0.07, -2.28, 0.24, 0.018, 0.035, '#a2adac', false);
  box(3.43, F + 0.61, -2.8, 0.62, 0.09, 1.04, metal);
  box(3.48, F + 1.78, -4.08, 0.5, 0.84, 0.54, '#c4c7bf');
  box(3.48, F + 1.75, -3.79, 0.36, 0.42, 0.025, '#78858a', false);
  line([[3.72, F + 2.16, -4.12], [3.72, F + 2.35, -4.12], [3.72, F + 2.35, -4.72], [3.72, F + 0.25, -4.72]], '#a6a9a4', 0.035);
  box(3.45, F + 0.26, -4.65, 0.68, 0.1, 0.7, '#7f8c91');
  // Compact wall fan, its grille and drain elbow.
  box(3.4, F + 2.05, -1.15, 0.2, 0.48, 0.54, '#a8aeab');
  cyl(3.53, F + 2.05, -1.15, 0.19, 0.04, '#4d5960');
  for (let i = 0; i < 3; i++) line([[3.56, F + 1.9 + i * 0.15, -1.32], [3.56, F + 1.9 + i * 0.15, -0.98]], '#aeb7b3', 0.012);

  group('ramenShopRear');
  // Bins and bottle crate sit inside the rear setback beside the back door.
  for (const [x, c] of [[0.35, '#687c78'], [1.08, '#9d755f']]) {
    box(x, F + 0.42, -5.35, 0.58, 0.72, 0.48, c);
    box(x, F + 0.8, -5.35, 0.62, 0.08, 0.52, '#49535a');
    for (let i = -1; i <= 1; i++) box(x + i * 0.13, F + 0.44, -5.1, 0.035, 0.4, 0.03, '#d3c7ae', false);
  }
  box(-0.55, F + 0.25, -5.36, 0.76, 0.36, 0.52, '#776b5d');
  for (let i = 0; i < 4; i++) cyl(-0.82 + i * 0.18, F + 0.56, -5.33, 0.055, 0.25, '#748a82');

  group('ramenShopGround');
  const paver = mat('#918f87');
  const apron = mesh(tileUV(new THREE.BoxGeometry(7.05, 0.035, 1.1), 2.4, 0.7), paver, 0, F - 0.02, 0.62, false);
  apron.material = paver;
  for (let i = 0; i < 5; i++) line([[-3.4, F + 0.005, 0.2 + i * 0.19], [3.4, F + 0.005, 0.2 + i * 0.19]], '#6c7477', 0.008);
  // Step-free front landing stops short of the public sidewalk; no scenery crosses the door axis.
  const path = mesh(tileUV(new THREE.BoxGeometry(1.45, 0.028, 1.52), 0.8, 1.4), paver, 0, F - 0.03, 1.95, false);
  path.material = paver;
  const pool = glow('#ffc98b', 0.12);
  const lightPool = mesh(new THREE.PlaneGeometry(2.8, 0.72), pool, 0.15, F + 0.005, 0.46, false);
  lightPool.rotation.x = -PI / 2;

  return { update(t) {
    noren.rotation.x = 0.038 * Math.sin(t * 1.15);
    for (const b of steamBits) {
      const v = (t * 0.24 + b.phase / (2 * PI)) % 1;
      b.p.position.y = b.y + v * 0.38;
      b.p.position.x = 0.45 + Math.round(b.phase / 1.57) % 2 * 0.42 + Math.sin(t * 1.2 + b.phase) * 0.055;
      b.p.material.opacity = 0.23 * (1 - v);
    }
  } };
};
