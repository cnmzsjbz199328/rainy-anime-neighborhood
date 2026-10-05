// B03-P01 こむぎ堂 (Komugi-do Bakery): a one-storey corner bakery on the main street at X01.
// Task card docs/buildings/tasks/B03-P01.md, reference docs/buildings/references/B03-P01.jpg.
// Local frame (placed by layout.js `buildings`, rotY 0): front +z faces the main street (world S), +x is the
// viewer's right = world E = the R02 corner side; door centre at the origin, floor top at rec.floor.
// Body 5.6 × 5.55: x -3.1…2.5, z -5.55…0 (front awning to +0.8, east side awning to x 2.95, back canopy and
// exhaust hood to z -5.95: inside the 7.0 × 6.5 buildable envelope).
// Groups: bakery (shell, interior, roof, awnings, signboard and lamps, hanging sign, exhaust duct) · bakFrontW
// (bench, potted bay tree) · bakFrontE (umbrella stand, A-board, planter) · bakSideE (herb box under the side
// window) · bakShed (east-rear storage shed) · bakUtility (west AC unit and pots) · bakService (rear bins, bread
// crate stack, pots) · bakGround (forecourt, side and rear paths, mat, window light on the wet ground).
// Plan: shop in front (bread stage behind the big window, grid shelf on the west wall, two-tier island, tray and
// tongs stand by the door, glass case and register counter on the east with the staff aisle behind), partition
// with a wide window onto the bakery: moulding bench under the window, two-deck oven at the rear east (flue up
// the east wall), proofer and tray trolley on the west wall, sink and back door at the rear, spiral mixer.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B03-P01'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, glass, wall, panel, canvasTex, tileUV } = K;
  const rnd = K.rand(3101), PI = Math.PI;
  const F = rec.floor, X0 = -3.1, X1 = 2.5, Z0 = 0, Z1 = -5.55, T = 0.15, BASE = 0.19, EAVE = 3.75, CEIL = 3.1, ROOF = 3.9, PAR = 4.1, PART = -3.1;
  const IX0 = X0 + T, IX1 = X1 - T, IZ0 = Z0 - T, IZ1 = Z1 + T;
  // Openings [u0, u1, y0, y1]: front/rear/partition along x, sides along z.
  const FW = [-2.85, -0.75, 0.72, 2.35], FD = [-0.5, 0.5, F, 2.3], FE = [0.85, 2.2, 0.95, 2.35];
  const SW = [-1.75, -0.45, 0.95, 2.35], KW = [-4.3, -3.4, 1.65, 2.2], WW = [-2.2, -1.35, 1.45, 2.2];
  const BD = [-1.3, -0.45, F, 2.3], RW = [-2.6, -1.85, 1.55, 2.1], PW = [-1.2, 1.45, 1.25, 2.25], SD = [1.6, 2.25, F, 2.2];
  const DUCT = [X1 + 0.22, -4.95];   // oven flue: x, z of the riser on the east wall

  // ---- shared materials and textures ----
  const plaster = mat('#ead9bb'), tileBase = '#8d6a54', oak = '#b4844f', oakL = '#cfa36c', blue = '#7891ad', blueD = '#5f7894', trim = '#676b70', metal = '#8a8f92', duct = '#b4bcbf';
  const W = (c, k = 0.3) => warm(c, k);
  const wood = W('#c4935c'), woodD = W('#8a5f3e', 0.26), cream = W('#f4e8cf', 0.34), wains = W('#c99a63', 0.28), steel = W('#c3cacb', 0.24),
    stone = W('#efe7d6', 0.32), tileW = W('#e6eae3', 0.24), black = W('#3a3634', 0.1), wicker = W('#c39a5f', 0.32), paper = W('#d8b98a', 0.34);
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' }), coolPanel = new THREE.MeshBasicMaterial({ color: '#f1efe4' });
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  // Shop floor: small cream and honey tiles; bakery floor: grey-green quarry tiles.
  const tilesShop = tex(256, 256, (q, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { q.fillStyle = (i + j) % 2 ? `hsl(38,${40 + rnd() * 8}%,${80 + rnd() * 3}%)` : `hsl(34,${44 + rnd() * 8}%,${66 + rnd() * 4}%)`; q.fillRect(i * 32, j * 32, 32, 32); }
    q.strokeStyle = 'rgba(110,86,60,.5)'; q.lineWidth = 2; for (let i = 0; i <= 8; i++) { q.beginPath(); q.moveTo(i * 32, 0); q.lineTo(i * 32, h); q.moveTo(0, i * 32); q.lineTo(w, i * 32); q.stroke(); } });
  const tilesKit = tex(256, 256, (q, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { q.fillStyle = `hsl(${150 + rnd() * 20},${8 + rnd() * 6}%,${64 + rnd() * 6}%)`; q.fillRect(i * 64, j * 64, 64, 64); }
    q.strokeStyle = 'rgba(60,70,66,.5)'; q.lineWidth = 3; for (let i = 0; i <= 4; i++) { q.beginPath(); q.moveTo(i * 64, 0); q.lineTo(i * 64, h); q.moveTo(0, i * 64); q.lineTo(w, i * 64); q.stroke(); } });
  const pavers = tex(256, 256, (q, w, h) => { q.fillStyle = '#a6a196'; q.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let i = 0; i < 4; i++) {
      q.fillStyle = `rgba(${rnd() < 0.5 ? '70,78,92' : '250,246,236'},${0.05 + rnd() * 0.08})`; q.fillRect(i * 64 + (r % 2) * 32 + 2, r * 32 + 2, 60, 28); q.fillRect(i * 64 + (r % 2) * 32 - 254, r * 32 + 2, 60, 28); }
    q.strokeStyle = 'rgba(48,56,66,.45)'; q.lineWidth = 2; for (let r = 0; r <= 8; r++) { q.beginPath(); q.moveTo(0, r * 32); q.lineTo(w, r * 32); q.stroke(); }
    for (let r = 0; r < 8; r++) for (let i = 0; i < 4; i++) { const x = i * 64 + (r % 2) * 32; q.beginPath(); q.moveTo(x, r * 32); q.lineTo(x, r * 32 + 32); q.stroke(); }
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
  // Straight thin rod between two points (brackets, hangers, cords): a 5-sided open cylinder.
  const rod = (a, b, r, c, parent) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 5, 1, true), typeof c === 'string' ? mat(c) : c, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, false, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };
  // Loaf mark used on the signboard, the hanging sign and the A-board.
  const loafIcon = (q, cx, cy, s, crust = '#d8913f', score = '#f6deb0') => { q.fillStyle = crust; q.beginPath(); q.ellipse(cx, cy, s * 0.5, s * 0.27, -0.08, 0, 2 * PI); q.fill();
    q.strokeStyle = score; q.lineWidth = s * 0.05; q.lineCap = 'round'; for (let i = -1; i <= 1; i++) { q.beginPath(); q.moveTo(cx + i * s * 0.22 - s * 0.07, cy + s * 0.12); q.lineTo(cx + i * s * 0.22 + s * 0.08, cy - s * 0.13); q.stroke(); } };
  const wheat = (q, x, y, s, c) => { q.strokeStyle = q.fillStyle = c; q.lineWidth = s * 0.05; q.lineCap = 'round'; q.beginPath(); q.moveTo(x, y + s * 0.5); q.lineTo(x, y - s * 0.45); q.stroke();
    for (let i = 0; i < 4; i++) for (const k of [-1, 1]) { q.beginPath(); q.ellipse(x + k * s * 0.09, y - s * 0.3 + i * s * 0.17, s * 0.1, s * 0.05, k * 0.7, 0, 2 * PI); q.fill(); } };
  const chalk = (w, h, lines, bg = '#33403a') => canvasTex(w, h, (q, W2, H2) => { q.fillStyle = bg; q.fillRect(0, 0, W2, H2); q.textAlign = 'center'; q.textBaseline = 'middle';
    for (const [t, y, size, font = 'sans-serif', col] of lines) { q.fillStyle = col || '#efe9da'; q.font = `bold ${size}px ${font}`; q.fillText(t, W2 / 2, y); } });
  // Awning valance with a scalloped hem (alpha-tested, so it sorts like an opaque surface).
  const scallops = n => canvasTex(64 * n, 64, (q, w) => { q.fillStyle = '#7891ad'; q.fillRect(0, 0, w, 36); q.fillStyle = '#efe6cf'; q.fillRect(0, 6, w, 3);
    q.fillStyle = '#7891ad'; for (let i = 0; i < n; i++) { q.beginPath(); q.arc(i * 64 + 32, 34, 30, 0, PI); q.fill(); } });
  const valance = (n, w, x, y, z, ry) => { const t = scallops(n); const m = mesh(new THREE.PlaneGeometry(w, 0.2), new THREE.MeshToonMaterial({ map: t, gradientMap: K.ramp, alphaTest: 0.5, side: THREE.DoubleSide }), x, y, z, false); m.rotation.y = ry; return m; };

  // ---- bread: shared unit geometries tinted from one palette texture, so all bread bakes into one mesh ----
  const BREAD = ['#e3a85c', '#c98a45', '#a8672f', '#f1d9a6', '#dcb276', '#7a4a2c', '#f6eedc', '#e8c46c', '#d8574a', '#6f9a5c', '#b8743a', '#efc98a'];
  const atlas = canvasTex(64, 4, q => BREAD.forEach((c, i) => { q.fillStyle = c; q.fillRect(i * 4, 0, 4, 4); }));
  atlas.magFilter = atlas.minFilter = THREE.NearestFilter; atlas.generateMipmaps = false;
  const breadM = new THREE.MeshToonMaterial({ map: atlas, gradientMap: K.ramp, emissive: new THREE.Color('#ffb36b').multiplyScalar(0.32), emissiveMap: atlas });
  const tinted = {}, tint = (g, c) => { const k = g.uuid + c; if (!tinted[k]) { const q = g.clone(), uv = q.attributes.uv, u = (BREAD.indexOf(c) + 0.5) / 16; for (let i = 0; i < uv.count; i++) uv.setXY(i, u, 0.5); tinted[k] = q; } return tinted[k]; };
  const G = { ball: new THREE.SphereGeometry(1, 7, 5), dome: new THREE.SphereGeometry(1, 8, 3, 0, 2 * PI, 0, PI / 2), ring: new THREE.TorusGeometry(1, 0.45, 4, 7, PI * 1.25), cone: new THREE.ConeGeometry(1, 1, 7), cube: new THREE.BoxGeometry(1, 1, 1) };
  const piece = (g, c, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, parent) => { const a = mesh(tint(g, c), breadM, x, y, z, false, parent); a.scale.set(sx, sy, sz); a.rotation.set(rx, ry, rz); return a; };
  // Bread sitting on a surface at height y.
  const B = {
    bun: (x, y, z, s, c = '#e3a85c') => piece(G.ball, c, x, y + s * 0.5, z, s, s * 0.6, s),
    melon: (x, y, z, s) => piece(G.dome, '#efc98a', x, y, z, s, s * 0.62, s),
    an: (x, y, z, s) => { piece(G.ball, '#a8672f', x, y + s * 0.42, z, s, s * 0.5, s); piece(G.ball, '#f6eedc', x, y + s * 0.84, z, s * 0.18, s * 0.08, s * 0.18); },
    croissant: (x, y, z, s, ry = rnd() * PI) => piece(G.ring, '#c98a45', x, y + s * 0.42, z, s, s, s * 0.95, PI / 2, 0, ry),
    danish: (x, y, z, s) => { piece(G.dome, '#e8c46c', x, y, z, s, s * 0.35, s); piece(G.ball, rnd() < 0.5 ? '#d8574a' : '#efc98a', x, y + s * 0.3, z, s * 0.4, s * 0.18, s * 0.4); },
    cornet: (x, y, z, s, ry = rnd() * PI) => piece(G.cone, '#7a4a2c', x, y + s * 0.38, z, s * 0.38, s * 1.5, s * 0.38, PI / 2, 0, ry),
    loaf: (x, y, z, s, ry = 0) => { const a = piece(G.cube, '#dcb276', x, y + s * 0.38, z, s, s * 0.76, s * 1.55, 0, ry); piece(G.dome, '#b8743a', x, y + s * 0.74, z, s * 0.52, s * 0.22, s * 0.78, 0, ry); return a; },
    baguette: (x, y, z, len, ry = 0, tilt = 0) => piece(G.ball, '#c98a45', x, y, z, 0.036, 0.033, len / 2, tilt, ry, 0, undefined),
    sandwich: (x, y, z, s) => { piece(G.cube, '#f6eedc', x, y + s * 0.28, z, s, s * 0.56, s * 0.55); piece(G.cube, '#6f9a5c', x, y + s * 0.28, z, s * 1.02, s * 0.1, s * 0.5); },
  };
  const kinds = ['bun', 'melon', 'an', 'croissant', 'danish', 'cornet'];
  // A tray (or board) of one kind of bread: a grid of pieces filling [x0, x1] × [z0, z1] at height y.
  const fill = (kind, x0, x1, z0, z1, y, s) => { const nx = Math.max(1, Math.floor((x1 - x0) / (s * 2.3))), nz = Math.max(1, Math.floor(Math.abs(z1 - z0) / (s * 2.3)));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) B[kind](x0 + (i + 0.5) * (x1 - x0) / nx + (rnd() - 0.5) * s * 0.3, y, z0 + (j + 0.5) * (z1 - z0) / nz + (rnd() - 0.5) * s * 0.3, s * (0.9 + rnd() * 0.2)); };
  const tray = (x0, x1, z0, z1, y, kind, s, c = black) => { box((x0 + x1) / 2, y + 0.01, (z0 + z1) / 2, Math.abs(x1 - x0), 0.02, Math.abs(z1 - z0), c, false); fill(kind, x0 + 0.03, x1 - 0.03, z0 - Math.sign(z0 - z1) * 0.03, z1 + Math.sign(z0 - z1) * 0.03, y + 0.02, s); };
  const basket = (x, y, z, r, h, kind, s) => { mesh(new THREE.CylinderGeometry(r, r * 0.85, h, 10, 1, true), wicker, x, y + h / 2, z); mesh(new THREE.CircleGeometry(r * 0.85, 10), wicker, x, y + 0.01, z, false).rotation.x = -PI / 2;
    for (let i = 0; i < 5; i++) { const a = rnd() * 2 * PI, d = Math.sqrt(rnd()) * r * 0.55; B[kind](x + Math.cos(a) * d, y + h * 0.55, z + Math.sin(a) * d, s); } };
  const tag = (x, y, z, ry = 0) => { const a = box(x, y, z, 0.07, 0.045, 0.006, stone, false); a.rotation.y = ry; };

  // ---- plants outside: low-poly leaf clusters ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), LEAF = ['#6c9476', '#88a98a', '#5e8a6a'];
  const blob = (g, m, x, y, z, s, sy = s, parent) => { const a = mesh(g, m, x, y, z, false, parent); a.scale.set(s, sy, s); return a; };
  const shrub = (x, y, z, r, n, h = 1) => { for (let i = 0; i < n; i++) blob(leafG, mat(LEAF[i % 3]), x + (rnd() - 0.5) * r * 1.3, y + r * 0.35 + rnd() * r * h, z + (rnd() - 0.5) * r * 1.3, r * (0.45 + rnd() * 0.25)); };
  const pot = (x, y, z, r, n = 5, h = 1, c = '#b9806a') => { mesh(new THREE.CylinderGeometry(r, r * 0.74, r * 1.15, 10), mat(c), x, y + r * 0.575, z); shrub(x, y + r * 1.1, z, r, n, h); };
  const flowerG = new THREE.OctahedronGeometry(1, 0);
  const flowers = (x, y, z, rx, rz, n, cols) => { for (let i = 0; i < n; i++) { const a = rnd() * 2 * PI, d = Math.sqrt(rnd()); blob(flowerG, mat(cols[i % cols.length]), x + Math.cos(a) * d * rx, y + rnd() * 0.06, z + Math.sin(a) * d * rz, 0.04); } };

  // ================= shell =================
  group('bakery');
  wall('x', Z0 - T / 2, T, [X0, X1, BASE, EAVE], [FW, FD, FE], plaster);
  wall('x', Z1 + T / 2, T, [X0, X1, BASE, EAVE], [BD, RW], plaster);
  wall('z', X1 - T / 2, T, [IZ1, IZ0, BASE, EAVE], [SW, KW], plaster);
  wall('z', X0 + T / 2, T, [IZ1, IZ0, BASE, EAVE], [WW], plaster);
  // Brown tile base course with joints; light cornice band under the parapet.
  const skirt = (a, b, d, axis) => { ab(axis, (a + b) / 2, 0.315, d, b - a, 0.25, 0.03, tileBase); for (let u = a + 0.25; u < b - 0.05; u += 0.25) ab(axis, u, 0.315, d, 0.012, 0.25, 0.036, '#6f5241', false); };
  skirt(X0 - 0.01, FD[0], 0.006, 'x'); skirt(FD[1], X1 + 0.01, 0.006, 'x');
  skirt(X0 - 0.01, BD[0], Z1 - 0.006, 'x'); skirt(BD[1], X1 + 0.01, Z1 - 0.006, 'x');
  skirt(Z1 - 0.01, Z0 + 0.01, X1 + 0.006, 'z'); skirt(Z1 - 0.01, Z0 + 0.01, X0 - 0.006, 'z');
  box((X0 + X1) / 2, EAVE - 0.05, 0.03, X1 - X0 + 0.08, 0.1, 0.06, '#d9ccb2'); box((X0 + X1) / 2, EAVE - 0.05, Z1 - 0.03, X1 - X0 + 0.08, 0.1, 0.06, '#d9ccb2');
  for (const x of [X0 - 0.03, X1 + 0.03]) box(x, EAVE - 0.05, (Z0 + Z1) / 2, 0.06, 0.1, Z0 - Z1 + 0.12, '#d9ccb2');
  // Floors: honey tiles in the shop, quarry tiles in the bakery.
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, IZ0 - PART), (IX1 - IX0) / 1.2, (IZ0 - PART) / 1.2), warm('#ffffff', 0.2, tilesShop), (IX0 + IX1) / 2, (F + BASE) / 2, (IZ0 + PART) / 2, false);
  mesh(tileUV(new THREE.BoxGeometry(IX1 - IX0, F - BASE, PART - IZ1), (IX1 - IX0) / 1.6, (PART - IZ1) / 1.6), warm('#ffffff', 0.18, tilesKit), (IX0 + IX1) / 2, (F + BASE) / 2, (PART + IZ1) / 2, false);
  // Roof layer (ceiling, slab, parapet, rooftop plant): batched on its own so review cutaways can lift it off.
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; group('bakery').add(roofLayer);
  box((IX0 + IX1) / 2, CEIL + 0.01, (IZ0 + PART) / 2, IX1 - IX0, 0.02, IZ0 - PART, W('#f6ecd8', 0.38), false, roofLayer);
  box((IX0 + IX1) / 2, CEIL + 0.01, (PART + IZ1) / 2, IX1 - IX0, 0.02, PART - IZ1, W('#eef0ea', 0.3), false, roofLayer);
  for (const [x, z] of [[-1.0, -3.85], [0.2, -4.85]]) box(x, CEIL - 0.005, z, 1.0, 0.012, 0.3, coolPanel, false, roofLayer);   // bakery strip lights
  // Interior linings: warm plaster above a honey-wood wainscot in the shop, white tiles in the bakery.
  panel('x', IZ0 - 0.006, 0.012, [IX0, IX1, F, CEIL], [FW, FD, FE], cream);
  panel('z', IX1 - 0.006, 0.012, [PART, IZ0, F, CEIL], [SW], cream);
  panel('z', IX0 + 0.006, 0.012, [PART, IZ0, F, CEIL], [WW], cream);
  panel('x', IZ0 - 0.016, 0.012, [IX0, IX1, F, 0.95], [FW, FD, FE], wains);
  panel('z', IX1 - 0.016, 0.012, [PART, IZ0, F, 0.95], [], wains);
  panel('z', IX0 + 0.016, 0.012, [PART, IZ0, F, 0.95], [], wains);
  panel('z', IX1 - 0.006, 0.012, [IZ1, PART, F, CEIL], [KW], tileW);
  panel('z', IX0 + 0.006, 0.012, [IZ1, PART, F, CEIL], [], tileW);
  panel('x', IZ1 + 0.006, 0.012, [IX0, IX1, F, CEIL], [BD, RW], tileW);
  // Partition between shop and bakery: wide glazed window onto the bench and oven, staff door behind the counter.
  wall('x', PART, 0.12, [IX0, IX1, F, CEIL], [PW, SD], cream);
  panel('x', PART + 0.066, 0.012, [IX0, IX1, F, 0.95], [SD], wains);
  panel('x', PART - 0.066, 0.012, [IX0, IX1, F, 1.6], [PW, SD], tileW);

  // ---- windows and doors: oak frames, real mullions, one glass pane per light ----
  function glaze(axis, at, out, [a, b, p, q], mull = [], tran = [], mun = [], fc = oak, sill = true) {
    const fw = 0.06, fd = 0.1;
    ab(axis, a + fw / 2, (p + q) / 2, at, fw, q - p, fd, fc); ab(axis, b - fw / 2, (p + q) / 2, at, fw, q - p, fd, fc);
    ab(axis, (a + b) / 2, q - fw / 2, at, b - a, fw, fd, fc); ab(axis, (a + b) / 2, p + fw / 2, at, b - a, fw, fd, fc);
    for (const u of mull) ab(axis, u, (p + q) / 2, at, 0.05, q - p, fd * 0.9, fc);
    for (const y of tran) ab(axis, (a + b) / 2, y, at, b - a, 0.05, fd * 0.9, fc);
    for (const u of mun) ab(axis, u, (tran[0] + q) / 2, at, 0.03, q - tran[0], fd * 0.7, oakL);   // small panes in the transom band
    ab(axis, (a + b) / 2, (p + q) / 2, at, b - a - 0.04, q - p - 0.04, 0.012, glass, false);
    if (sill && p > F + 0.05) ab(axis, (a + b) / 2, p - 0.025, at + out * 0.06, b - a + 0.12, 0.05, 0.16, '#d8cdb8');   // sill
  }
  glaze('x', -T / 2, 1, FW, [-2.15, -1.45], [2.0], [-2.5, -1.8, -1.1]);
  glaze('x', -T / 2, 1, FE, [], [2.0], [1.3, 1.75]);
  glaze('z', X1 - T / 2, 1, SW, [-1.1], [2.0], [-1.45, -0.78]);
  glaze('z', X1 - T / 2, 1, KW, [-3.85]);
  glaze('z', X0 + T / 2, -1, WW, []);
  glaze('x', Z1 + T / 2, -1, RW, []);
  glaze('x', PART, 1, PW, [-0.3, 0.6], [], [], woodD);
  // Tiled kick panels under the shop windows (outside), as on the reference front.
  for (const [w, axis, d] of [[FW, 'x', 0.012], [FE, 'x', 0.012], [SW, 'z', X1 + 0.012]]) {
    ab(axis, (w[0] + w[1]) / 2, (0.44 + w[2] - 0.05) / 2, d, w[1] - w[0] - 0.04, w[2] - 0.05 - 0.44, 0.02, oak);
    ab(axis, (w[0] + w[1]) / 2, (0.44 + w[2] - 0.05) / 2, d + (axis === 'x' ? 0.013 : 0.013), w[1] - w[0] - 0.26, w[2] - 0.05 - 0.58, 0.012, oakL, false);
  }
  // Front door: oak leaf with a tall glass light, brass bar handle, OPEN plate; step-free ramp to the forecourt.
  ab('x', FD[0] + 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, oak); ab('x', FD[1] - 0.03, (F + FD[3]) / 2, -T / 2, 0.06, FD[3] - F, 0.16, oak);
  box(0, FD[3] - 0.03, -T / 2, FD[1] - FD[0], 0.06, 0.16, oak);
  {
    const z = -0.05, l = -0.44, r = 0.44, top = FD[3] - 0.06;
    for (const x of [l + 0.06, r - 0.06]) box(x, (F + top) / 2, z, 0.12, top - F, 0.045, '#9a6a3e');
    box(0, top - 0.06, z, r - l, 0.12, 0.045, '#9a6a3e'); box(0, F + 0.25, z, r - l, 0.5, 0.045, '#9a6a3e');
    box(0, F + 0.25, z + 0.025, r - l - 0.2, 0.32, 0.01, oakL, false);
    box(0, (F + 0.5 + top - 0.12) / 2, z, r - l - 0.24, top - 0.12 - F - 0.5, 0.012, glass, false);
    rod([0.3, 0.95, z + 0.06], [0.3, 1.45, z + 0.06], 0.014, '#c9a35b'); for (const y of [0.98, 1.42]) rod([0.3, y, z + 0.02], [0.3, y, z + 0.06], 0.01, '#c9a35b');
    K.label('OPEN 7:00–18:00', 0, 1.62, z + 0.03, 0.42, 0.09, '#f3e6c6', '#6b4a32', 52);
  }
  shapeMesh([[0, BASE], [0.48, BASE], [0.48, 0.212], [0, 0.298]], 1.0, '#b9b1a1', 0.5, 0, 0, -PI / 2);   // threshold ramp
  // Back door: blue steel leaf with a wired-glass light, lever, step; small canopy and lamp.
  ab('x', BD[0] + 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, trim); ab('x', BD[1] - 0.03, (F + BD[3]) / 2, Z1 + T / 2, 0.06, BD[3] - F, 0.16, trim);
  box((BD[0] + BD[1]) / 2, BD[3] - 0.03, Z1 + T / 2, BD[1] - BD[0], 0.06, 0.16, trim);
  box((BD[0] + BD[1]) / 2, (F + BD[3] - 0.06) / 2, Z1 + 0.06, BD[1] - BD[0] - 0.12, BD[3] - 0.06 - F, 0.04, '#6a8098');
  for (const y of [0.75, 1.45]) box((BD[0] + BD[1]) / 2, y, Z1 + 0.035, BD[1] - BD[0] - 0.26, 0.012, 0.012, '#57697d', false);
  K.label('搬入口', (BD[0] + BD[1]) / 2, 1.58, Z1 + 0.037, 0.3, 0.08, '#efe4cc', '#4f5f70', 70).rotation.y = PI;
  box((BD[0] + BD[1]) / 2, 1.85, Z1 + 0.035, 0.26, 0.34, 0.012, glass, false);
  box(BD[1] - 0.15, 1.2, Z1 + 0.02, 0.12, 0.03, 0.04, '#c9cfcc');
  shapeMesh([[0, BASE], [0.3, BASE], [0.3, 0.3], [0, 0.3]], BD[1] - BD[0] + 0.1, '#b9b1a1', BD[0] - 0.05, 0, Z1, PI / 2);   // back step
  box((BD[0] + BD[1]) / 2, 2.52, Z1 - 0.2, 1.15, 0.05, 0.4, trim);
  for (const x of [BD[0] - 0.08, BD[1] + 0.08]) rod([x, 2.22, Z1], [x, 2.5, Z1 - 0.37], 0.014, '#3d4a58');
  // Staff swing door in the partition: leaf ajar into the bakery, round porthole.
  {
    const g = new THREE.Group(); g.position.set(SD[1] - 0.02, 0, PART); g.rotation.y = -0.45; group('bakery').add(g);
    const w = SD[1] - SD[0] - 0.06; box(-w / 2, (F + 0.02 + SD[3] - 0.04) / 2, -0.03, w, SD[3] - 0.06 - F, 0.04, W('#d9cbb0', 0.3), true, g);
    mesh(new THREE.CircleGeometry(0.11, 16), glass, -w / 2, 1.6, -0.008, false, g); mesh(new THREE.TorusGeometry(0.11, 0.015, 4, 16), steel, -w / 2, 1.6, -0.008, false, g);
    box(-w / 2, 1.05, -0.006, 0.32, 0.22, 0.008, steel, false, g);
    for (const x of [SD[0] + 0.03, SD[1] - 0.03]) box(x, (F + SD[3]) / 2, PART, 0.06, SD[3] - F, 0.16, woodD);
    box((SD[0] + SD[1]) / 2, SD[3] + 0.03, PART, SD[1] - SD[0] + 0.06, 0.06, 0.16, woodD);
    K.label('STAFF', (SD[0] + SD[1]) / 2, SD[3] + 0.18, PART + 0.07, 0.36, 0.1, '#efe4cc', '#6b4a32', 70);
  }

  // ================= awnings, signboard, lamps, hanging sign =================
  // Misty-blue canvas awning across the shop front, scalloped valance, iron arms.
  {
    const ax0 = -3.0, ax1 = 2.4, top = 2.92, low = 2.58, dep = 0.8, len = Math.hypot(dep, top - low), cx = (ax0 + ax1) / 2;
    const c = box(cx, (top + low) / 2, dep / 2, ax1 - ax0, 0.035, len, blue); c.rotation.x = Math.atan2(top - low, dep);
    for (let i = 1; i < 9; i++) { const s = box(ax0 + i * (ax1 - ax0) / 9, (top + low) / 2 + 0.02, dep / 2, 0.012, 0.012, len, blueD, false); s.rotation.x = c.rotation.x; }   // seams
    box(cx, low - 0.01, dep, ax1 - ax0, 0.04, 0.04, blueD);
    valance(27, ax1 - ax0, cx, low - 0.12, dep + 0.022, 0);
    for (const x of [ax0, ax1]) shapeMesh([[0, top], [dep, low], [dep, low - 0.03], [0, top - 0.3]], 0.02, blue, x + (x === ax0 ? 0.02 : 0), 0, 0, -PI / 2);
    for (const x of [ax0 + 0.1, cx, ax1 - 0.1]) line([[x, 2.4, 0.01], [x, 2.5, 0.42], [x, 2.6, dep - 0.04]], '#3d4a58', 0.014);
  }
  // Side awning over the east display window (faces the R02 corner).
  {
    const z0 = SW[0] - 0.1, z1 = SW[1] + 0.1, top = 2.72, low = 2.48, dep = 0.45, len = Math.hypot(dep, top - low), cz = (z0 + z1) / 2;
    const c = box(X1 + dep / 2, (top + low) / 2, cz, len, 0.035, z1 - z0, blue); c.rotation.z = -Math.atan2(top - low, dep);
    box(X1 + dep, low - 0.01, cz, 0.04, 0.04, z1 - z0, blueD);
    valance(8, z1 - z0, X1 + dep + 0.022, low - 0.12, cz, PI / 2);
    for (const z of [z0, z1]) shapeMesh([[0, top], [dep, low], [dep, low - 0.03], [0, top - 0.25]], 0.02, blue, X1, 0, z + (z === z0 ? 0.02 : 0), 0);
    for (const z of [z0 + 0.1, z1 - 0.1]) line([[X1 + 0.01, 2.3, z], [X1 + 0.25, 2.4, z], [X1 + dep - 0.03, 2.47, z]], '#3d4a58', 0.012);
  }
  // Wooden signboard with the original name, lit by three gooseneck lamps from the parapet.
  {
    const sx = -0.3, sw = 4.1, sy = 3.3, sh = 0.62;
    const s = canvasTex(1024, 156, (q, w, h) => { q.fillStyle = '#f3e6c6'; q.fillRect(0, 0, w, h); q.strokeStyle = '#8a5f3e'; q.lineWidth = 6; q.strokeRect(10, 10, w - 20, h - 20);
      loafIcon(q, 150, h / 2, 170); wheat(q, 70, h / 2, 90, '#b48a50'); wheat(q, w - 70, h / 2, 90, '#b48a50');
      q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillStyle = '#6b4a32'; q.font = 'bold 96px serif'; q.fillText('こむぎ堂', w * 0.47, h / 2 + 4);
      q.font = 'bold 30px sans-serif'; q.fillStyle = '#7891ad'; q.fillText('BAKERY', w * 0.79, h / 2 - 20); q.fillStyle = '#8a5f3e'; q.fillText('焼きたて · 毎朝7時', w * 0.79, h / 2 + 24); });
    box(sx, sy, 0.04, sw + 0.12, sh + 0.12, 0.08, '#7a5236');
    mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, emissive: '#5a4630', emissiveMap: s }), sx, sy, 0.082, false);
    for (const x of [sx - 1.55, sx, sx + 1.55]) {
      box(x, 3.98, 0.02, 0.08, 0.1, 0.04, '#3d4a58');
      line([[x, 3.98, 0.03], [x, 4.08, 0.22], [x, 4.0, 0.42], [x, 3.9, 0.46]], '#3d4a58', 0.013);
      const sh2 = mesh(new THREE.ConeGeometry(0.08, 0.1, 12, 1, true), mat('#3d4a58'), x, 3.86, 0.46, true); sh2.rotation.x = -0.5;
      mesh(new THREE.SphereGeometry(0.03, 8, 6), bulb, x, 3.83, 0.44, false);
      mesh(new THREE.PlaneGeometry(1.4, 0.75), additive(glowT, '#ffd9a0', 0.32), x, 3.3, 0.09, false);
    }
  }
  // Round hanging sign at the west front corner, projecting over the forecourt (read from the sidewalk).
  {
    const s = canvasTex(256, 256, (q, w) => { q.fillStyle = '#7a5236'; q.beginPath(); q.arc(w / 2, w / 2, w / 2 - 2, 0, 2 * PI); q.fill(); q.fillStyle = '#f3e6c6'; q.beginPath(); q.arc(w / 2, w / 2, w / 2 - 16, 0, 2 * PI); q.fill();
      loafIcon(q, w / 2, w / 2 - 14, 150); q.font = 'bold 34px serif'; q.textAlign = 'center'; q.fillStyle = '#6b4a32'; q.fillText('こむぎ', w / 2, w * 0.8); });
    const x = X0 + 0.22, y = 3.12, z = 0.38;
    rod([x, 3.42, 0], [x, 3.42, 0.66], 0.016, '#3d4a58'); box(x, 3.42, 0.01, 0.08, 0.12, 0.03, '#3d4a58'); rod([x, 3.6, 0], [x, 3.42, 0.3], 0.01, '#3d4a58');
    for (const zz of [z - 0.14, z + 0.14]) rod([x, 3.42, zz], [x, 3.33, zz], 0.006, '#3d4a58');
    cyl(x, y, z, 0.24, 0.03, '#7a5236').rotation.z = PI / 2;
    for (const k of [-1, 1]) { const d = mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshToonMaterial({ map: s, gradientMap: K.ramp, emissive: '#3a3020' }), x + k * 0.017, y, z, false); d.rotation.y = k * PI / 2; }
  }
  // Wall lanterns: east of the front door (under the awning) and beside the back door.
  for (const [x, z, d] of [[0.675, Z0, 1], [-0.2, Z1, -1]]) {
    box(x, 2.0, z + d * 0.04, 0.06, 0.12, 0.08, '#3d4a58'); box(x, 2.0, z + d * 0.12, 0.12, 0.19, 0.12, '#3d4a58');
    box(x, 1.99, z + d * 0.12, 0.09, 0.14, 0.125, bulb, false);
    const h = mesh(new THREE.PlaneGeometry(0.9, 0.9), additive(glowT, '#ffc27e', 0.3), x, 2.0, z + d * 0.004, false); if (d < 0) h.rotation.y = PI;
  }

  // ================= roof, parapet, rooftop plant, flue =================
  K.setRoot(roofLayer);
  box((IX0 + IX1) / 2, (EAVE - 0.15 + ROOF) / 2, (IZ0 + IZ1) / 2, IX1 - IX0, ROOF - EAVE + 0.15, IZ0 - IZ1, '#9aa0a2');
  {
    const cz = (Z0 + Z1) / 2, cx = (X0 + X1) / 2;
    for (const z of [Z0 - T / 2, Z1 + T / 2]) { box(cx, (EAVE + PAR) / 2, z, X1 - X0, PAR - EAVE, T, plaster); box(cx, PAR + 0.03, z, X1 - X0 + 0.06, 0.06, 0.22, trim); }
    for (const x of [X0 + T / 2, X1 - T / 2]) { box(x, (EAVE + PAR) / 2, cz, T, PAR - EAVE, Z0 - Z1 - 2 * T, plaster); box(x, PAR + 0.03, cz, 0.22, 0.06, Z0 - Z1 - 0.16, trim); }
    box(cx, ROOF + 0.005, cz, IX1 - IX0, 0.01, IZ0 - IZ1, '#71767a', false);
    for (let i = 1; i < 5; i++) box(cx, ROOF + 0.012, Z0 - i * 1.1, IX1 - IX0 - 0.02, 0.004, 0.02, '#5d6266', false);   // membrane seams
  }
  // Condenser on rails (rear west), mushroom vent, roof hatch, small vent pipes.
  for (const z of [-4.1, -4.55]) box(-1.9, ROOF + 0.04, z, 0.95, 0.06, 0.07, metal);
  box(-1.9, ROOF + 0.36, -4.32, 0.86, 0.58, 0.38, '#c6cbc6');
  mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), -2.0, ROOF + 0.36, -4.128, false);
  for (let i = 0; i < 3; i++) box(-2.0, ROOF + 0.28 + i * 0.08, -4.125, 0.38, 0.012, 0.01, '#9aa6ab', false);
  line([[-1.47, ROOF + 0.2, -4.32], [-1.2, ROOF + 0.2, -4.32], [-1.2, ROOF + 0.08, -3.9], [-1.2, ROOF + 0.08, -3.2]], '#8f9aa0', 0.03);
  cyl(0.4, ROOF + 0.18, -2.1, 0.09, 0.36, '#a9b1b2'); mesh(new THREE.SphereGeometry(0.2, 12, 6, 0, 2 * PI, 0, PI / 2), mat('#b6bdbe'), 0.4, ROOF + 0.36, -2.1);
  box(-1.2, ROOF + 0.09, -1.4, 0.8, 0.18, 0.8, '#a7adae'); box(-1.2, ROOF + 0.2, -1.4, 0.86, 0.04, 0.86, trim);
  cyl(1.4, ROOF + 0.2, -3.2, 0.045, 0.4, '#a9b1b2'); cyl(-2.4, ROOF + 0.15, -1.0, 0.04, 0.3, '#a9b1b2');
  group('bakery');
  // Oven flue: stainless duct out of the east wall, up past the parapet, rain cap on top (mist rises from it).
  {
    const [x, z] = DUCT, r = 0.13;
    box(X1 + 0.12, 2.55, z, 0.24, 0.3, 0.3, duct); box(x, 2.55, z, 0.3, 0.34, 0.34, duct);
    cyl(x, (2.72 + 4.62) / 2, z, r, 4.62 - 2.72, duct);
    for (const y of [3.0, 3.6, 4.2]) { cyl(x, y, z, r + 0.015, 0.04, '#8f979a'); box((X1 + x) / 2, y, z, x - X1, 0.04, 0.05, '#8f979a'); }
    for (const k of [-1, 1]) rod([x + k * 0.1, 4.62, z - 0.1], [x + k * 0.1, 4.74, z - 0.1], 0.01, '#8f979a');
    mesh(new THREE.ConeGeometry(0.24, 0.14, 14), mat('#9aa2a5'), x, 4.82, z);
    // Kitchen exhaust fan hood on the rear wall (above the rear window), with a louvred face.
    box(-2.22, 2.55, Z1 - 0.17, 0.5, 0.42, 0.34, duct); const lip = box(-2.22, 2.31, Z1 - 0.3, 0.5, 0.05, 0.12, duct); lip.rotation.x = 0.4;
    for (let i = 0; i < 3; i++) box(-2.22, 2.42 + i * 0.09, Z1 - 0.345, 0.42, 0.015, 0.01, '#7f8b93', false);
  }
  // Downpipes: west front corner and east wall middle, each from a parapet scupper into a splash block.
  for (const [x, z, sx] of [[X0 - 0.07, -0.35, -1], [X1 + 0.07, -2.75, 1], [X0 - 0.07, Z1 + 0.35, -1]]) {
    box(x - sx * 0.05, 3.95, z, 0.14, 0.08, 0.12, metal);
    cyl(x, (3.92 + 0.3) / 2, z, 0.04, 3.62, '#8796a0'); for (const y of [0.9, 2.0, 3.0]) box(x - sx * 0.03, y, z, 0.07, 0.03, 0.1, '#5f6c76');
    box(x + sx * 0.04, 0.22, z, 0.22, 0.06, 0.18, '#a39d91');
  }
  // East wall: meter box with conduit, gas meter; west wall: louvred kitchen vent; rear: meter.
  box(X1 + 0.08, 1.5, -2.2, 0.16, 0.42, 0.3, '#cdd0c9'); box(X1 + 0.165, 1.58, -2.2, 0.01, 0.12, 0.18, '#7b8a92', false);
  line([[X1 + 0.06, 1.28, -2.2], [X1 + 0.06, 0.45, -2.2], [X1 + 0.03, 0.4, -2.2]], '#9aa3a6', 0.018);
  box(X1 + 0.1, 0.95, -3.1, 0.2, 0.3, 0.26, '#d9dcd6'); line([[X1 + 0.1, 0.8, -3.1], [X1 + 0.1, 0.5, -3.1], [X1 + 0.02, 0.5, -3.1]], '#c9a35b', 0.018);
  box(X0 - 0.03, 2.6, -4.4, 0.06, 0.3, 0.4, '#c4c7c0'); for (let i = 0; i < 4; i++) box(X0 - 0.065, 2.5 + i * 0.065, -4.4, 0.012, 0.012, 0.34, '#7f8b93', false);
  box(0.55, 1.5, Z1 - 0.07, 0.3, 0.4, 0.14, '#cdd0c9'); line([[0.55, 1.28, Z1 - 0.05], [0.55, 0.45, Z1 - 0.05]], '#9aa3a6', 0.018);

  // ================= interior =================
  const pendant = (x, z, y, parent) => { rod([x, CEIL, z], [x, y + 0.08, z], 0.006, '#3a3330', parent); mesh(new THREE.ConeGeometry(0.12, 0.14, 14, 1, true), W('#e8dcc0', 0.3), x, y + 0.07, z, true, parent); mesh(new THREE.SphereGeometry(0.045, 10, 8), bulb, x, y - 0.01, z, false, parent); };
  // Near layer: two-step bread stage behind the big window (baskets, a loaf pyramid, a jar of breadsticks).
  {
    const x0 = -2.82, x1 = -0.8, cx = (x0 + x1) / 2, w = x1 - x0;
    box(cx, F + 0.22, -0.32, w, 0.44, 0.3, wood); box(cx, F + 0.37, -0.6, w, 0.74, 0.26, wood);
    for (const [z, h] of [[-0.18, 0.44], [-0.48, 0.74]]) box(cx, F + h - 0.01, z, w, 0.02, 0.02, woodD, false);
    basket(-2.5, F + 0.44, -0.32, 0.16, 0.1, 'bun', 0.055); basket(-1.95, F + 0.44, -0.32, 0.16, 0.1, 'croissant', 0.06); basket(-1.38, F + 0.44, -0.32, 0.16, 0.1, 'melon', 0.06);
    tag(-2.5, F + 0.6, -0.15); tag(-1.95, F + 0.6, -0.15); tag(-1.38, F + 0.6, -0.15);
    box(-1.0, F + 0.45, -0.32, 0.3, 0.02, 0.24, woodD, false); B.loaf(-1.0, F + 0.46, -0.32, 0.1, 0.1);
    for (let i = 0; i < 3; i++) B.loaf(-2.5 + i * 0.16, F + 0.74, -0.6, 0.09, PI / 2);
    B.loaf(-2.42, F + 0.86, -0.6, 0.085, PI / 2); B.loaf(-2.26, F + 0.86, -0.6, 0.085, PI / 2);
    mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.32, 12, 1, true), W('#d8e8e4', 0.2), -1.7, F + 0.9, -0.6, false);
    for (let i = 0; i < 6; i++) B.baguette(-1.7 + (rnd() - 0.5) * 0.06, F + 1.0, -0.6 + (rnd() - 0.5) * 0.06, 0.4, rnd() * PI, PI / 2 + (rnd() - 0.5) * 0.2);
    basket(-1.15, F + 0.74, -0.6, 0.15, 0.09, 'danish', 0.055);
    K.label('焼きたて', -2.0, F + 0.24, -0.165, 0.5, 0.11, '#f3e6c6', '#6b4a32', 80);
  }
  pendant(-2.2, -0.45, F + 2.15); pendant(-1.35, -0.45, F + 2.15);
  // West wall: grid bread shelf (three slanted trays, three bays each), the window above it.
  {
    const x = -2.76, z0 = -0.9, z1 = -2.9, cz = (z0 + z1) / 2, d = 0.38;
    for (const z of [z0, z0 + (z1 - z0) / 3, z0 + 2 * (z1 - z0) / 3, z1]) box(x, F + 0.56, z, d, 1.12, 0.03, woodD);
    box(x, F + 1.13, cz, d + 0.02, 0.03, z0 - z1 + 0.04, wood); box(x - 0.17, F + 0.56, cz, 0.02, 1.12, z0 - z1, wood);
    let k = 0;
    for (const y of [0.32, 0.67, 1.0]) {
      const sh = box(x, F + y, cz, d, 0.025, z0 - z1, wood); sh.rotation.z = -0.12;
      box(x + d / 2 - 0.01, F + y - 0.01, cz, 0.02, 0.05, z0 - z1, woodD, false);
      for (let b = 0; b < 3; b++) { const za = z0 + b * (z1 - z0) / 3 - 0.06, zb = za + (z1 - z0) / 3 + 0.12;
        fill(kinds[k++ % kinds.length], x - 0.12, x + 0.13, za, zb, F + y + 0.02, 0.05); tag(x + d / 2 + 0.005, F + y + 0.02, (za + zb) / 2, PI / 2); }
    }
  }
  // Middle: two-tier island table with trays and a basket of upright baguettes.
  {
    const x0 = -1.75, x1 = -0.85, z0 = -1.3, z1 = -2.4, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = F + 0.78;
    for (const x of [x0 + 0.05, x1 - 0.05]) for (const z of [z0 - 0.05, z1 + 0.05]) box(x, F + 0.38, z, 0.05, 0.76, 0.05, woodD);
    box(cx, top - 0.02, cz, x1 - x0, 0.04, z0 - z1, wood); box(cx, F + 0.15, cz, x1 - x0 - 0.1, 0.02, z0 - z1 - 0.1, woodD, false);
    box(cx, top + 0.14, cz, 0.36, 0.28, z0 - z1 - 0.3, woodD); box(cx, top + 0.29, cz, 0.42, 0.03, z0 - z1 - 0.24, wood);
    tray(x0 + 0.03, x0 + 0.24, z0 - 0.05, cz + 0.02, top, 'melon', 0.05); tray(x0 + 0.03, x0 + 0.24, cz - 0.02, z1 + 0.05, top, 'croissant', 0.05);
    tray(x1 - 0.24, x1 - 0.03, z0 - 0.05, cz + 0.02, top, 'an', 0.05); tray(x1 - 0.24, x1 - 0.03, cz - 0.02, z1 + 0.05, top, 'danish', 0.05);
    tray(cx - 0.18, cx + 0.18, z0 - 0.2, cz - 0.02, top + 0.3, 'bun', 0.045); tray(cx - 0.18, cx + 0.18, cz + 0.02, z1 + 0.2, top + 0.3, 'cornet', 0.05);
    mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.26, 10, 1, true), wicker, cx, top + 0.6, cz);
    for (let i = 0; i < 7; i++) B.baguette(cx + (rnd() - 0.5) * 0.1, top + 0.72, cz + (rnd() - 0.5) * 0.1, 0.55, rnd() * PI, PI / 2 + (rnd() - 0.5) * 0.25);
    K.label('本日のおすすめ', cx, top + 0.2, z0 - 0.15, 0.36, 0.08, '#f3e6c6', '#6b4a32', 70);
  }
  pendant(-1.3, -1.55, F + 2.05); pendant(-1.3, -2.15, F + 2.05);
  // Tray and tongs stand just inside the door (east side).
  {
    const x = 0.78, z = -0.5;
    box(x, F + 0.4, z, 0.32, 0.8, 0.32, wood); box(x, F + 0.81, z, 0.36, 0.02, 0.36, woodD);
    for (let i = 0; i < 6; i++) box(x - 0.02, F + 0.83 + i * 0.016, z, 0.26, 0.012, 0.32, W(i % 2 ? '#a77f52' : '#9a7048', 0.3), false);
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 10), steel, x + 0.12, F + 0.9, z - 0.12, false);
    for (let i = 0; i < 3; i++) rod([x + 0.11 + i * 0.012, F + 0.9, z - 0.12], [x + 0.1 + i * 0.02, F + 1.1, z - 0.1 - i * 0.01], 0.006, steel);
    K.label('トレー · トング', x, F + 0.6, z + 0.165, 0.28, 0.07, '#f3e6c6', '#6b4a32', 60);
  }
  // East: glass bread case (towards the door) and the register counter, staff aisle behind.
  {
    const x0 = 1.05, x1 = 1.6, cx = (x0 + x1) / 2, z0 = -0.95, zm = -1.85, z1 = -2.8, top = F + 0.95;
    box(cx, F + 0.28, (z0 + zm) / 2, x1 - x0, 0.56, z0 - zm, woodD); box(x0 + 0.005, F + 0.28, (z0 + zm) / 2, 0.012, 0.4, z0 - zm - 0.1, wood, false);
    for (const z of [z0 - 0.02, zm + 0.02]) box(cx, F + 0.76, z, x1 - x0, 0.4, 0.03, steel);
    box(cx, top - 0.01, (z0 + zm) / 2, x1 - x0, 0.02, z0 - zm, glass, false); box(x0 + 0.01, F + 0.76, (z0 + zm) / 2, 0.012, 0.38, z0 - zm - 0.04, glass, false);
    box(cx, F + 0.58, (z0 + zm) / 2, x1 - x0 - 0.04, 0.02, z0 - zm - 0.06, W('#f5eedc', 0.4), false);
    box(cx + 0.06, F + 0.76, (z0 + zm) / 2, x1 - x0 - 0.16, 0.015, z0 - zm - 0.06, W('#e6e8e2', 0.3), false);
    for (let i = 0; i < 5; i++) { B.sandwich(cx - 0.12, F + 0.59, z0 - 0.12 - i * 0.16, 0.08); B.danish(cx + 0.1, F + 0.59, z0 - 0.12 - i * 0.16, 0.05); }
    for (let i = 0; i < 6; i++) B[i % 2 ? 'danish' : 'croissant'](cx + 0.06, F + 0.775, z0 - 0.1 - i * 0.135, 0.045);
    box(cx, top - 0.06, zm + 0.02, x1 - x0, 0.04, 0.03, W('#fff1cf', 0.6), false);   // case lighting strip
    K.label('サンドイッチ · デニッシュ', x0 - 0.002, F + 0.42, (z0 + zm) / 2, 0.6, 0.07, '#f3e6c6', '#6b4a32', 52).rotation.y = -PI / 2;
    // Register counter: oak with board panelling, stone top, register, paper bags, tray return.
    box(cx, F + 0.45, (zm + z1) / 2, x1 - x0, 0.9, zm - z1, wood); box(cx, top - 0.025, (zm + z1) / 2, x1 - x0 + 0.06, 0.05, zm - z1 + 0.04, stone);
    for (let i = 1; i < 6; i++) box(x0 - 0.003, F + 0.45, zm - i * (zm - z1) / 6, 0.012, 0.8, 0.015, woodD, false);
    box(cx + 0.05, top + 0.05, -2.05, 0.3, 0.1, 0.26, W('#3c4146', 0.1)); const scr = box(cx - 0.02, top + 0.15, -2.05, 0.02, 0.12, 0.2, W('#a9cfc0', 0.5)); scr.rotation.z = 0.35;
    box(cx, top + 0.01, -2.4, 0.3, 0.02, 0.3, W('#9a7048', 0.3), false); for (let i = 0; i < 3; i++) B.bun(cx - 0.06 + i * 0.06, top + 0.02, -2.4, 0.04);
    for (let i = 0; i < 3; i++) box(cx + 0.12, top + 0.09 + i * 0.002, -2.62 - i * 0.04, 0.16, 0.18, 0.1, paper, false);
    // Back shelf on the east wall behind the counter: paper bags, rusks, jam jars; a chalk menu above.
    for (const y of [F + 1.25, F + 1.65]) { box(IX1 - 0.12, y, -2.4, 0.24, 0.025, 0.95, wood);
      for (let i = 0; i < 5; i++) i % 2 ? mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 10), W(['#d8574a', '#e8c46c', '#9a5a8a'][i % 3], 0.34), IX1 - 0.12, y + 0.06, -2.05 - i * 0.17, false)
        : box(IX1 - 0.12, y + 0.08, -2.05 - i * 0.17, 0.12, 0.15, 0.1, paper, false); }
    const menu = chalk(256, 160, [['MENU', 26, 26, 'serif'], ['食パン 1斤 ¥380', 66, 20], ['クロワッサン ¥220', 96, 20], ['メロンパン ¥180', 126, 20]]);
    mesh(new THREE.PlaneGeometry(0.66, 0.41), new THREE.MeshToonMaterial({ map: menu, gradientMap: K.ramp, emissive: '#2a2a20' }), IX1 - 0.02, F + 2.15, -2.4, false).rotation.y = -PI / 2;
  }
  pendant(1.3, -1.4, F + 2.1); pendant(1.3, -2.35, F + 2.1);
  // Light pools on the shop floor.
  for (const [x, z, r] of [[0.1, -1.4, 1.8], [-1.3, -1.85, 1.3], [0.2, -2.6, 1.3], [-1.8, -0.75, 1.1], [1.3, -1.9, 1.0]]) decal(r, r, x, F + 0.003, z, [0, -1], pool);
  // ---- bakery (behind the partition) ----
  // Moulding bench under the partition window: dough balls, a rolling pin, scale and a flour dredger.
  {
    const x0 = -2.25, x1 = 1.2, z0 = PART - 0.07, z1 = PART - 0.67, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = F + 0.88;
    for (const x of [x0 + 0.04, x1 - 0.04, cx]) box(x, F + 0.42, cz, 0.05, 0.84, z0 - z1 - 0.06, steel);
    box(cx, top - 0.03, cz, x1 - x0, 0.06, z0 - z1, W('#d9b582', 0.32)); box(cx, F + 0.12, cz, x1 - x0 - 0.06, 0.02, z0 - z1 - 0.06, steel, false);
    box(cx - 0.4, top + 0.002, cz, 1.2, 0.004, 0.45, W('#f7f1e4', 0.36), false);   // flour dusting
    for (let i = 0; i < 8; i++) piece(G.ball, '#f6eedc', -1.4 + (i % 4) * 0.17, top + 0.03, cz + (i < 4 ? 0.1 : -0.1), 0.055, 0.035, 0.055);
    cyl(0.2, top + 0.03, cz, 0.03, 0.42, W('#c4935c', 0.3)).rotation.z = PI / 2;
    box(0.75, top + 0.04, cz, 0.22, 0.08, 0.22, steel); box(0.75, top + 0.085, cz, 0.18, 0.01, 0.18, W('#dfe6e3', 0.3), false);
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), steel, 1.0, top + 0.06, cz - 0.1, false);
    for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.42, 12), W('#e3e1d6', 0.26), -1.6 + i * 0.5, F + 0.21, cz);   // flour and sugar bins
  }
  // Two-deck oven at the rear east: stainless body, dark glass doors glowing (animated below), hood and flue.
  const OV = { x0: 0.9, x1: 2.3, z0: -4.6, z1: -5.38 };
  {
    const { x0, x1, z0, z1 } = OV, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (const x of [x0 + 0.05, x1 - 0.05]) box(x, F + 0.22, cz, 0.06, 0.44, z0 - z1 - 0.1, steel);
    box(cx, F + 0.05, cz, x1 - x0 - 0.1, 0.03, z0 - z1 - 0.12, steel, false);
    for (let i = 0; i < 3; i++) box(cx, F + 0.1 + i * 0.008, cz, x1 - x0 - 0.3, 0.006, z0 - z1 - 0.3, W('#9a8f84', 0.2), false);   // spare trays
    for (const [y0, y1] of [[0.45, 1.03], [1.07, 1.65]]) {
      box(cx, F + (y0 + y1) / 2, cz, x1 - x0, y1 - y0, z0 - z1, steel);
      box(cx - 0.12, F + (y0 + y1) / 2, z0 + 0.012, x1 - x0 - 0.5, y1 - y0 - 0.16, 0.02, W('#2f2b29', 0.06));
      box(cx - 0.12, F + y1 - 0.09, z0 + 0.04, x1 - x0 - 0.6, 0.03, 0.04, W('#d4d9d7', 0.2));
      box(x1 - 0.15, F + (y0 + y1) / 2, z0 + 0.012, 0.18, y1 - y0 - 0.16, 0.02, W('#4a4f52', 0.1));
      for (let k = 0; k < 2; k++) cyl(x1 - 0.15, F + (y0 + y1) / 2 + 0.06 - k * 0.12, z0 + 0.03, 0.025, 0.02, W('#e0d6c6', 0.3)).rotation.x = PI / 2;
    }
    box(cx, F + 1.72, cz, x1 - x0, 0.14, z0 - z1, W('#a9b1b2', 0.22));
    box(cx, F + 2.3, cz - 0.02, x1 - x0 + 0.1, 0.32, z0 - z1 + 0.15, steel); box(cx, F + 2.12, z0 + 0.04, x1 - x0 + 0.1, 0.04, 0.06, steel, false);
    box(X1 - T - 0.15, F + 2.6, -4.95, 0.3, 0.28, 0.3, steel);
  }
  // West wall: proofing cabinet with a glass door (trays of rising dough), rack trolley of baked rolls.
  {
    const x0 = IX0, x1 = -2.35, z0 = -3.22, z1 = -3.92, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = 1.85;
    box(cx, F + h / 2, cz, x1 - x0, h, z0 - z1, steel); box(x1 + 0.005, F + 1.0, cz, 0.012, 1.4, z0 - z1 - 0.12, W('#efe2c4', 0.5), false);
    for (let i = 0; i < 6; i++) { const y = F + 0.42 + i * 0.22; box(x1 + 0.0, y, cz, 0.02, 0.012, z0 - z1 - 0.16, W('#b8b6ae', 0.2), false);
      for (let k = 0; k < 3; k++) piece(G.ball, '#f6eedc', x1 + 0.03, y + 0.03, z0 - 0.17 - k * 0.18, 0.045, 0.028, 0.045); }
    box(x1 + 0.011, F + 1.0, cz, 0.01, 1.42, z0 - z1 - 0.1, glass, false);
    box(x1 + 0.02, F + 1.78, cz, 0.012, 0.08, 0.3, W('#5a7f6c', 0.2), false);
    K.label('発酵', x1 + 0.03, F + 1.78, cz, 0.24, 0.07, '#5a7f6c', '#efe9da', 70).rotation.y = PI / 2;
  }
  {
    const x0 = -2.9, x1 = -2.42, z0 = -4.05, z1 = -4.62, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (const x of [x0, x1]) for (const z of [z0, z1]) box(x, F + 0.85, z, 0.03, 1.6, 0.03, steel);
    for (const x of [x0, x1]) for (const z of [z0, z1]) cyl(x, F + 0.03, z, 0.03, 0.06, black);
    for (let i = 0; i < 7; i++) { const y = F + 0.2 + i * 0.2; box(cx, y, cz, x1 - x0 - 0.02, 0.012, z0 - z1 - 0.02, W('#a9a49a', 0.2), false);
      if (i % 3 !== 2) fill(i % 2 ? 'bun' : 'croissant', x0 + 0.04, x1 - 0.04, z0 - 0.03, z1 + 0.03, y + 0.008, 0.045); }
  }
  // Rear: sink under the rear window, spiral mixer by the oven.
  {
    const x0 = IX0, x1 = -2.0, z0 = -4.98, z1 = IZ1, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, top = F + 0.86;
    box(cx, F + 0.42, cz, x1 - x0, 0.84, z0 - z1, steel); box(cx, top - 0.02, cz, x1 - x0 + 0.02, 0.04, z0 - z1 + 0.02, steel);
    box(cx, top - 0.005, cz + 0.02, 0.6, 0.006, 0.28, W('#55606a', 0.08), false);
    line([[cx, top, z1 + 0.04], [cx, top + 0.3, z1 + 0.04], [cx, top + 0.34, z1 + 0.14], [cx, top + 0.25, z1 + 0.22]], '#b9c0c2', 0.014);
    box(x1 - 0.02, F + 1.45, cz, 0.04, 0.3, 0.25, W('#e9eee9', 0.3));   // towel dispenser
  }
  {
    const x = 0.35, z = -5.0;
    box(x, F + 0.3, z, 0.42, 0.6, 0.55, W('#d8ddd9', 0.24)); mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.32, 14, 1, true), steel, x, F + 0.76, z + 0.05, true);
    box(x, F + 1.0, z - 0.22, 0.36, 0.5, 0.14, W('#d8ddd9', 0.24)); box(x, F + 1.18, z + 0.02, 0.3, 0.12, 0.32, W('#d8ddd9', 0.24));
    piece(G.dome, '#f6eedc', x, F + 0.7, z + 0.05, 0.17, 0.08, 0.17);
  }
  // Flour sacks on a low pallet between the sink and the back door.
  box(-1.68, F + 0.04, -5.12, 0.5, 0.08, 0.44, woodD);
  for (let i = 0; i < 4; i++) { const s = box(-1.68 + (i % 2 ? 0.02 : -0.02), F + 0.16 + i * 0.13, -5.12, 0.44, 0.13, 0.36, W(i % 2 ? '#e7dcc4' : '#eee5d0', 0.3)); s.rotation.y = (rnd() - 0.5) * 0.15; }
  K.label('小麦粉', -1.68, F + 0.35, -4.935, 0.24, 0.07, '#eee5d0', '#7a5236', 70);
  // Wall shelf of baking tins over the bench end and a clock above the staff door (kitchen side).
  box(-0.5, F + 2.1, IZ1 + 0.13, 1.5, 0.03, 0.25, steel); for (let i = 0; i < 5; i++) box(-1.1 + i * 0.3, F + 2.17, IZ1 + 0.13, 0.22, 0.1, 0.18, W('#9a8f84', 0.2), false);
  mesh(new THREE.CircleGeometry(0.12, 16), W('#f4efe2', 0.4), 0.3, F + 2.45, PART - 0.067, false).rotation.y = PI;
  group('bakery');

  // ================= forecourt and attachments =================
  group('bakFrontW');
  // Slatted bench under the display window, a potted bay tree at the west corner.
  {
    const x0 = -2.55, x1 = -1.25, z = 0.52, cx = (x0 + x1) / 2;
    for (const x of [x0 + 0.08, x1 - 0.08]) { box(x, 0.19 + 0.21, z, 0.04, 0.42, 0.36, '#3d4a58'); }
    for (let i = 0; i < 4; i++) box(cx, 0.19 + 0.44, z - 0.13 + i * 0.087, x1 - x0, 0.03, 0.07, '#a57d58');
    box(cx, 0.19 + 0.08, z, x1 - x0 - 0.2, 0.02, 0.03, '#3d4a58', false);
  }
  pot(-2.88, 0.19, 0.5, 0.16, 6, 1.6); line([[-2.88, 0.38, 0.5], [-2.88, 0.9, 0.5]], '#6f5a48', 0.025); shrub(-2.88, 0.85, 0.5, 0.22, 8, 0.8);
  pot(-1.05, 0.19, 0.42, 0.1, 4, 0.8);
  group('bakFrontE');
  // Umbrella stand by the door, chalk A-board at the forecourt edge, a planter at the east corner.
  {
    const x = 0.78, z = 0.38;
    mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.48, 12, 1, true), mat('#5e7d85'), x, 0.19 + 0.24, z);
    mesh(new THREE.TorusGeometry(0.15, 0.015, 4, 14), mat('#3d4a58'), x, 0.19 + 0.48, z).rotation.x = PI / 2;
    const cols = ['#7891ad', '#c98a7f', '#3d4a58', '#e8c46c'];
    for (let i = 0; i < 4; i++) { const a = i * PI / 2 + 0.4, ux = x + Math.cos(a) * 0.05, uz = z + Math.sin(a) * 0.05;
      mesh(new THREE.ConeGeometry(0.05, 0.55, 7), mat(cols[i]), ux, 0.19 + 0.62, uz); rod([ux, 0.19 + 0.88, uz], [ux, 0.19 + 1.0, uz], 0.01, '#6b4a32'); }
  }
  {
    const board = chalk(256, 320, [['Bakery', 48, 44, 'serif'], ['本日のおすすめ', 212, 26], ['メロンパン ¥180', 252, 22, 'sans-serif', '#f0c987'], ['クロワッサン ¥220', 284, 22, 'sans-serif', '#f0c987']]);
    const ctx = board.image.getContext('2d'); loafIcon(ctx, 128, 132, 130, '#e8b46a', '#33403a'); wheat(ctx, 40, 150, 60, '#c7d0a0'); wheat(ctx, 216, 150, 60, '#c7d0a0'); board.needsUpdate = true;
    const g = new THREE.Group(); g.position.set(1.75, 0.19, 1.2); g.rotation.y = 0.18; K.setRoot(g);
    for (const s of [-1, 1]) { const p = new THREE.Group(); p.rotation.x = -s * 0.2; g.add(p);   // two leaves leaning together: an A-frame
      box(0, 0.47, s * 0.2, 0.5, 0.9, 0.025, oak, true, p); mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshBasicMaterial({ map: board, color: '#c9c3b6' }), 0, 0.54, s * 0.2 + s * 0.015, false, p).rotation.y = s > 0 ? 0 : PI; }
    group('bakFrontE').add(g);
  }
  box(2.18, 0.19 + 0.17, 0.42, 0.42, 0.34, 0.34, '#9b8f80'); box(2.18, 0.54, 0.42, 0.46, 0.03, 0.38, '#7b7166'); shrub(2.18, 0.55, 0.42, 0.15, 6, 0.6);
  flowers(2.18, 0.72, 0.42, 0.14, 0.12, 6, ['#f6f0e6', '#f7d27a']);
  group('bakSideE');
  // Herb box under the east display window.
  {
    const x = X1 + 0.2, z0 = SW[0] + 0.05, z1 = SW[1] - 0.05, cz = (z0 + z1) / 2;
    box(x, 0.19 + 0.2, cz, 0.28, 0.4, z1 - z0, '#9b8f80'); box(x, 0.6, cz, 0.32, 0.03, z1 - z0 + 0.04, '#7b7166');
    for (let i = 0; i < 6; i++) shrub(x, 0.58, z0 + 0.12 + i * (z1 - z0 - 0.24) / 5, 0.09, 3, 0.6);
    flowers(x, 0.76, cz, 0.08, 0.5, 8, ['#c7a7dc', '#f6f0e6']);
  }
  group('bakShed');
  // Storage shed on the east side towards the rear (flour sacks and crates): board walls, mono-pitch roof.
  {
    const x0 = 2.62, x1 = 3.72, z0 = -4.48, z1 = -5.6, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(cx, 0.19 + 0.9, cz, x1 - x0, 1.8, z0 - z1, '#8a6a4c');
    for (let i = 1; i < 8; i++) box(x0 + i * (x1 - x0) / 8, 0.19 + 0.9, z0 + 0.008, 0.012, 1.78, 0.012, '#6f5240', false);
    for (let i = 1; i < 8; i++) box(x1 + 0.008, 0.19 + 0.9, z0 - i * (z0 - z1) / 8, 0.012, 1.78, 0.012, '#6f5240', false);
    const r = box(cx + 0.03, 2.06, cz, x1 - x0 + 0.14, 0.05, z0 - z1 + 0.16, '#5e6268'); r.rotation.z = -0.12;
    box(x1 + 0.012, 0.19 + 0.85, cz, 0.02, 1.6, 0.68, '#9a7a58'); box(x1 + 0.03, 0.19 + 0.85, cz + 0.25, 0.03, 0.12, 0.03, '#c9a35b');
    box(cx, 0.19 + 0.04, cz, x1 - x0 + 0.06, 0.08, z0 - z1 + 0.06, '#6f5240');
  }
  group('bakUtility');
  // West side: split AC outdoor unit with its pipe cover; pots of herbs under the small window.
  box(X0 - 0.2, 0.19 + 0.31, -3.65, 0.3, 0.58, 0.8, '#d6d8d2'); for (const z of [-3.97, -3.33]) box(X0 - 0.2, 0.2, z, 0.28, 0.02, 0.06, '#7f8b93', false);
  mesh(new THREE.CircleGeometry(0.2, 18), mat('#3b4650'), X0 - 0.355, 0.52, -3.77, false).rotation.y = -PI / 2;
  for (let i = 0; i < 4; i++) box(X0 - 0.357, 0.4 + i * 0.08, -3.77, 0.01, 0.012, 0.38, '#9aa6ab', false);
  box(X0 - 0.06, 1.2, -3.2, 0.1, 1.3, 0.1, '#e1ddd2'); box(X0 - 0.06, 0.6, -3.32, 0.1, 0.1, 0.25, '#e1ddd2');
  pot(X0 - 0.25, 0.19, -1.55, 0.14, 5, 1.2); pot(X0 - 0.25, 0.19, -1.95, 0.11, 4, 1); pot(X0 - 0.25, 0.19, -1.18, 0.1, 4, 0.8, '#9b8f80');
  group('bakService');
  // Rear service yard: sorted bins (burnable, plastics, cans), a stack of bread crates, pots by the back door.
  {
    const z = Z1 - 0.42;
    for (const [x, c] of [[0.15, '#4f7290'], [0.62, '#5f8a74'], [1.09, '#8f969a']]) { box(x, 0.19 + 0.33, z, 0.42, 0.66, 0.5, c); box(x, 0.19 + 0.68, z, 0.46, 0.05, 0.54, c); }
    for (let i = 0; i < 6; i++) { const y = 0.19 + 0.08 + i * 0.15; box(1.85, y, z, 0.6, 0.15, 0.42, i % 2 ? '#c9b07a' : '#c4a86f'); box(1.85, y, z + 0.215, 0.5, 0.06, 0.01, '#8f7a52', false); }
    pot(-1.62, 0.19, Z1 - 0.3, 0.14, 5, 1.2); pot(-1.95, 0.19, Z1 - 0.32, 0.1, 4, 0.8, '#9b8f80');
  }
  group('bakGround');
  // Forecourt pavers to the sidewalk, east side yard, rear path and service pad; entrance mat; window light.
  const paveMat = warm('#ffffff', 0, pavers);
  const pave = (x0, x1, z0, z1) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, 0.016, z1 - z0), (x1 - x0) / 2, (z1 - z0) / 2), paveMat, (x0 + x1) / 2, 0.198, (z0 + z1) / 2, false);
  pave(-3.6, 3.9, 0, 1.9); pave(2.5, 3.9, -5.7, 0); pave(-2.4, 2.5, -6.75, -5.55);
  box(0, 0.214, 0.78, 0.92, 0.014, 0.5, '#5d5a4f', false); box(0, 0.222, 0.78, 0.74, 0.004, 0.36, '#7a6f5c', false);
  const spill = additive(spillT, '#ffbf7a', 0.26);
  decal(2.1, 1.6, (FW[0] + FW[1]) / 2, 0.208, 0.84, [0, -1], spill); decal(1.4, 1.4, (FE[0] + FE[1]) / 2, 0.208, 0.78, [0, -1], spill); decal(0.9, 1.2, 0, 0.226, 1.0, [0, -1], spill);
  decal(1.3, 1.0, X1 + 0.6, 0.208, (SW[0] + SW[1]) / 2, [-1, 0], additive(spillT, '#ffbf7a', 0.2)); decal(1.0, 0.8, X1 + 0.5, 0.208, (KW[0] + KW[1]) / 2, [-1, 0], additive(spillT, '#fff0d0', 0.12));
  decal(1.3, 0.9, (BD[0] + BD[1]) / 2, 0.208, Z1 - 0.45, [0, 1], additive(glowT, '#ffc27e', 0.22));

  // ================= local animation: window rain and eave drips, flue mist, oven glow =================
  const fx = new THREE.Group(); fx.userData.live = true; group('bakery').add(fx); K.setRoot(fx);
  // Window runs and eave drips are short line segments in two batches (2 draw calls), moved every frame.
  const batch = (c, o) => { const items = [], l = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false }));
    l.frustumCulled = false; fx.add(l); return { items, l, add(x, y, z, len, lo, hi, v) { items.push({ x, y, z, len, lo, hi, v }); },
      seal() { l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(items.length * 6), 3)); this.write(); },
      write() { const a = l.geometry.attributes.position; items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; },
      step(dt) { for (const d of items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } this.write(); } }; };
  const runs = batch('#c1e4df', 0.45), drips = batch('#cee7e5', 0.6);
  for (const [w, n] of [[FW, 13], [FE, 7]]) for (let i = 0; i < n; i++) runs.add(w[0] + 0.1 + rnd() * (w[1] - w[0] - 0.2), w[2] + 0.1 + rnd() * 1.3, -0.066, 0.07 + rnd() * 0.06, w[2] + 0.06, w[3] - 0.12, 0.08 + rnd() * 0.06);
  for (let i = 0; i < 6; i++) runs.add(X1 + 0.008 - T / 2 + 0.075, SW[2] + 0.1 + rnd() * 1.2, SW[0] + 0.1 + rnd() * (SW[1] - SW[0] - 0.2), 0.07, SW[2] + 0.05, SW[3] - 0.12, 0.07 + rnd() * 0.05);
  for (let i = 0; i < 15; i++) drips.add(-2.9 + i * 0.35 + rnd() * 0.12, 0.25 + rnd() * 2, 0.805, 0.09, 0.25, 2.36, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 4; i++) drips.add(X1 + 0.455, 0.25 + rnd() * 2, SW[0] - 0.02 + i * 0.4, 0.09, 0.25, 2.26, 2.1 + rnd() * 0.5);
  for (let i = 0; i < 3; i++) drips.add(BD[0] - 0.05 + i * 0.47, 0.25 + rnd() * 2, Z1 - 0.38, 0.09, 0.25, 2.4, 2.1 + rnd() * 0.5);
  runs.seal(); drips.seal();
  // Flue mist: soft puffs leaving the rain cap and drifting west over the roof, each one a pair of crossed
  // planes; a fixed faint haze plane spans their whole path, so the measured bounds never change.
  const mistT = canvasTex(64, 64, (q, w) => { const g = q.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, w); });
  const [mx, mz] = DUCT, my = 4.95;
  const crossed = (m, w, h, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); fx.add(g); for (const ry of [0, PI / 2]) mesh(new THREE.PlaneGeometry(w, h), m, 0, 0, 0, false, g).rotation.y = ry; return g; };
  crossed(new THREE.MeshBasicMaterial({ map: mistT, color: '#cfd9e3', transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }), mx + 0.18 - (mx - 0.68), 1.36, (mx + 0.18 + mx - 0.68) / 2, my + 0.62, mz);
  const puffs = [];
  for (let i = 0; i < 5; i++) { const m = new THREE.MeshBasicMaterial({ map: mistT, color: '#e3e9ee', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    puffs.push({ g: crossed(m, 1, 1, mx, my, mz), m, ph: i / 5 }); }
  // Oven glow: both deck windows and the light they throw on the floor warm up and settle on a slow cycle.
  const ovenM = new THREE.MeshBasicMaterial({ color: '#e08a40' }), ovenCool = new THREE.Color('#b8592a'), ovenHot = new THREE.Color('#ffb466');
  for (const [y0, y1] of [[0.45, 1.03], [1.07, 1.65]]) box((OV.x0 + OV.x1) / 2 - 0.12, F + (y0 + y1) / 2, OV.z0 + 0.025, OV.x1 - OV.x0 - 0.62, y1 - y0 - 0.26, 0.006, ovenM, false);
  const ovenPool = decal(1.6, 1.2, (OV.x0 + OV.x1) / 2, F + 0.004, OV.z0 + 0.55, [0, -1], additive(glowT, '#ffa860', 0.3));
  return {
    update(t, dt) {
      runs.step(dt); drips.step(dt);
      for (const p of puffs) { const k = (t * 0.16 + p.ph) % 1, s = 0.2 + k * 0.5;
        p.g.position.set(mx - k * 0.5, my + k * 0.95, mz); p.g.scale.setScalar(s); p.m.opacity = 0.2 * Math.sin(PI * k) * (1 - k * 0.4); }
      const h = 0.5 + 0.5 * Math.sin(t * 0.45); ovenM.color.copy(ovenCool).lerp(ovenHot, h); ovenPool.material.opacity = 0.2 + 0.14 * h;
    },
  };
};
