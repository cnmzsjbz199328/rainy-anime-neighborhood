// B04-P03 雨だまり公園 (Amadamari Park): a pocket park behind the eastbound bus stop, with a hip-roofed pavilion and a rain garden.
// Task card docs/buildings/tasks/B04-P03.md, reference docs/buildings/references/B04-P03.jpg.
// Local frame (placed by layout.js `buildings`, rotY 0): front +z faces the south street / bus apron (world S), local +x = world E.
// The origin is the entrance gap on the path axis (world x = 35, the frozen entrance); the plot front edge is z = +1.1,
// the rear edge z = -15.4, plot x = -9 … +11 (the entrance is not centred). Buildable envelope: x -8.5 … 10.5, z -14.9 … 0.6.
// Groups: park (pavilion: plinth, posts, benches, lantern, hip roof on the 'roof' layer, eave drips) · parkSign (name stone) ·
// parkBin (sorted bins) · parkBenchA/B/C (benches, one group each so the path stays open) · parkPond (rain-garden basin, stones, iris) ·
// parkTree* (each tree its own group; some canopies sway) · parkEdgeW/E/N/FW/FE (low stone kerb wall, hedges and gate pillars; the
// front wall is split into two halves around the 2.2 m entrance gap) · parkLamp* (bollard lamps) · parkGround (lawn, flagstone paths,
// plaza, drain slot, tactile strip, light pools).
// Plan: bus apron → tactile strip and drain slot → path axis between two gate pillars → east branch to the pavilion, west branch to the
// pond bench → circular plaza with a raised tree ring and two benches → cherry, camphor and rear trees along the walls.
(globalThis.BUILDINGS = globalThis.BUILDINGS || {})['B04-P03'] = (K, rec) => {
  const { THREE, group, mesh, box, cyl, line, mat, warm, canvasTex, tileUV } = K;
  const rnd = K.rand(4403), PI = Math.PI;
  const BASE = 0.19;
  const PX = 5.8, PZ = -5.4;               // pavilion centre
  const PS = 1.5, RS = 2.2;                // posts at ±PS, roof half width RS
  const POSTH = 2.2, FLOOR = 0.31;        // post height above the plinth

  // ---- textures and materials ----
  const tex = (w, h, draw) => { const t = canvasTex(w, h, draw); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const toon = map => new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: K.ramp, map });
  const roofT = tex(128, 128, (q, w, h) => { q.fillStyle = '#3a404a'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '8,12,18' : '150,170,196'},${0.04 + rnd() * 0.07})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    q.fillStyle = 'rgba(10,14,20,.55)'; for (let i = 0; i < 8; i++) q.fillRect(i * 16, 0, 2, h); });
  const paveT = tex(128, 128, (q, w, h) => { q.fillStyle = '#8c8b87'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 560; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '50,58,70' : '240,240,232'},${0.05 + rnd() * 0.09})`; q.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2); }
    q.strokeStyle = 'rgba(40,48,58,.42)'; q.lineWidth = 2;
    for (const [x0, y0, x1, y1] of [[0, 40, 128, 38], [0, 90, 128, 92], [34, 0, 36, 40], [88, 0, 86, 40], [60, 38, 62, 92], [20, 92, 18, 128], [100, 92, 102, 128]]) { q.beginPath(); q.moveTo(x0, y0); q.lineTo(x1, y1); q.stroke(); } });
  const grassT = tex(256, 256, (q, w, h) => { q.fillStyle = '#58765a'; q.fillRect(0, 0, w, h); q.lineCap = 'round';
    for (let i = 0; i < 1500; i++) { q.strokeStyle = `rgba(${rnd() < 0.5 ? '34,64,48' : '118,156,104'},${0.1 + rnd() * 0.16})`; q.lineWidth = 1; const x = rnd() * w, y = rnd() * h, l = 4 + rnd() * 7; q.beginPath(); q.moveTo(x, y); q.lineTo(x + l * 0.4, y - l); q.stroke(); } });
  const gravelT = tex(256, 256, (q, w, h) => { q.fillStyle = '#a2a39d'; q.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '70,76,86' : '255,255,250'},${0.08 + rnd() * 0.14})`; const r = 0.7 + rnd() * 1.4; q.beginPath(); q.arc(rnd() * w, rnd() * h, r, 0, 6.3); q.fill(); } });
  const glowT = canvasTex(128, 128, (q, w) => { const g = q.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.33)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, w); });
  const roofM = toon(roofT), paveM = warm('#ffffff', 0, paveT);
  const wcache = {}, W = (c, k = 0.3) => wcache[c + k] || (wcache[c + k] = warm(c, k));
  const additive = (map, c, o) => new THREE.MeshBasicMaterial({ map, color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const bulb = new THREE.MeshBasicMaterial({ color: '#ffe2a6' });
  const stone = '#8d8c88', stoneD = '#6f706f', iron = '#2f343a', wood = '#9a7650', woodD = '#5a4332', gold = '#d9b45a';
  const decal = (w, h, x, y, z, m, parent) => { const a = mesh(new THREE.PlaneGeometry(w, h), m, x, y, z, false, parent); a.rotation.x = -PI / 2; return a; };
  const ab = (axis, u, y, d, w, h, t, c, o = true, p) => axis === 'x' ? box(u, y, d, w, h, t, c, o, p) : box(d, y, u, t, h, w, c, o, p);
  const rod = (a, b, r, c, parent) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 5, 1, true), typeof c === 'string' ? mat(c) : c, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, false, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m; };

  // ---- plants ----
  const leafG = new THREE.SphereGeometry(1, 5, 4), GREEN = ['#5f8a5e', '#78a272', '#4d7a58'], DEEP = ['#4d7a58', '#44704f', '#5a8660'], PINK = ['#e9a9b8', '#f0bccb', '#d98fa4'], HYD = ['#7b8fd0', '#9b86c4', '#6f7fc0'], FLOW = ['#e8c15a', '#d98aa0', '#f0eadc'];
  const shrub = (x, z, r, n, cols = GREEN, h = 1) => { for (let i = 0; i < n; i++) { const a = mesh(leafG, mat(cols[i % cols.length]), x + (rnd() - 0.5) * r * 1.3, BASE + r * 0.8 + rnd() * r * h * 0.7, z + (rnd() - 0.5) * r * 1.3, false); a.scale.setScalar(r * (0.5 + rnd() * 0.25)); } };
  const rock = (x, z, r, c = stone) => { const m = mesh(leafG, mat(c), x, BASE + r * 0.5, z, true); m.scale.set(r, r * 0.55, r * 0.8); m.rotation.y = rnd() * 3; };
  // A tree: static core blobs plus (optionally) interior blobs in a live group that sway a little; the outer blobs stay still,
  // so the registered bounds do not drift while the canopy moves. `top` is the exact height of the highest leaf.
  const swayers = [];
  const tree = (name, x, z, top, r, cols, n, live) => {
    const g = group(name), bl = [];
    for (let i = 0; i < n; i++) { const a = rnd() * PI * 2, d = r * 0.85 * Math.sqrt(rnd()), s = r * (0.4 + 0.24 * rnd()); bl.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: (rnd() - 0.4) * 0.8 * r, s, c: cols[i % cols.length] }); }
    const shift = top - Math.max(...bl.map(b => b.y + b.s)), ext = Math.max(...bl.map(b => Math.hypot(b.x, b.z) + b.s)), lo = Math.min(...bl.map(b => b.y + shift - b.s));
    bl.forEach(b => b.y += shift);
    const cy = top - r * 0.95, trunkTop = Math.max(cy - r * 0.2, BASE + 1);
    mesh(new THREE.CylinderGeometry(0.07 + r * 0.03, 0.12 + r * 0.05, trunkTop - BASE, 7), mat('#4d3d30'), x, BASE + (trunkTop - BASE) / 2, z);
    for (const a of [0.9, 3.9]) { const m = mesh(new THREE.CylinderGeometry(0.035, 0.06, r * 0.9, 5), mat('#4d3d30'), x + Math.cos(a) * r * 0.18, trunkTop - 0.1 + r * 0.25, z + Math.sin(a) * r * 0.18, false); m.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
    const fx = new THREE.Group(); fx.userData.live = true; fx.position.set(x, 0, z); g.add(fx);
    for (const b of bl) {
      const inner = live && Math.hypot(b.x, b.z) + b.s < ext * 0.62 && b.y + b.s < top - 0.3 && b.y - b.s > lo + 0.3;
      const m = mesh(leafG, mat(b.c), inner ? b.x : x + b.x, b.y, inner ? b.z : z + b.z, false, inner ? fx : g); m.scale.setScalar(b.s);
      if (inner) swayers.push({ m, x: b.x, y: b.y, z: b.z, s: b.s, p: rnd() * 6.3, q: rnd() * 6.3 }); }
    return g; };

  // ---- lamp glows (animated opacity) and shared pieces ----
  const lampGlows = [];
  const bollardLamp = (x, z, parent) => {
    cyl(x, BASE + 0.4, z, 0.055, 0.8, iron, parent); box(x, BASE + 0.05, z, 0.22, 0.1, 0.22, stoneD, true, parent);
    box(x, BASE + 0.9, z, 0.22, 0.3, 0.22, '#3d4650', true, parent); box(x, BASE + 0.9, z, 0.17, 0.24, 0.225, bulb, false, parent); box(x, BASE + 1.09, z, 0.3, 0.05, 0.3, iron, false, parent);
    const gm = additive(glowT, '#ffc27e', 0.3); for (const r of [0, PI / 2]) mesh(new THREE.PlaneGeometry(1.1, 1.1), gm, x, BASE + 0.9, z, false, parent).rotation.y = r;
    decal(2.4, 2.4, x, 0.215, z, additive(glowT, '#ffc27e', 0.2), parent); lampGlows.push(gm); };
  const bench = (name, x, z, ry) => {
    const g = group(name), p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
    for (const s of [-1, 1]) { box(s * 0.68, BASE + 0.22, 0, 0.07, 0.44, 0.4, iron, true, p); box(s * 0.68, BASE + 0.62, -0.19, 0.06, 0.5, 0.05, iron, true, p); }
    for (let i = 0; i < 3; i++) box(0, BASE + 0.45, -0.14 + i * 0.14, 1.5, 0.04, 0.12, wood, true, p);
    for (let i = 0; i < 2; i++) box(0, BASE + 0.66 + i * 0.16, -0.2, 1.5, 0.1, 0.035, wood, true, p);
    decal(2.2, 1.4, 0, 0.214, 0.05, additive(glowT, '#ffc27e', 0.05), p); return g; };

  // ================= pavilion (main group) =================
  const gMain = group('park');
  box(PX, BASE + 0.06, PZ, 3.7, 0.12, 3.7, stoneD); box(PX, FLOOR - 0.02, PZ, 3.4, 0.04, 3.4, warm('#c9b79a', 0.26));
  for (let i = 1; i < 5; i++) { box(PX - 1.7 + i * 0.68, FLOOR + 0.001, PZ, 0.012, 0.012, 3.4, '#6a5a48', false); }
  box(PX, BASE + 0.03, PZ + 2.05, 1.5, 0.06, 0.4, stoneD);   // entrance step on the south side
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = PX + sx * PS, z = PZ + sz * PS;
    box(x, FLOOR + 0.07, z, 0.3, 0.14, 0.3, stone); box(x, FLOOR + 0.14 + POSTH / 2, z, 0.14, POSTH, 0.14, woodD); box(x, FLOOR + 0.14 + POSTH, z, 0.22, 0.06, 0.22, '#3a2d24'); }
  const topY = FLOOR + 0.14 + POSTH;
  for (const s of [-1, 1]) { box(PX, topY + 0.1, PZ + s * PS, 2 * PS + 0.4, 0.14, 0.14, woodD); box(PX + s * PS, topY + 0.1, PZ, 0.14, 0.14, 2 * PS + 0.4, woodD);
    box(PX, topY - 0.28, PZ + s * PS, 2 * PS - 0.14, 0.08, 0.06, '#7a5a40', false); box(PX + s * PS, topY - 0.28, PZ, 0.06, 0.08, 2 * PS - 0.14, '#7a5a40', false); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const b = box(PX + sx * (PS - 0.25), topY - 0.18, PZ + sz * PS, 0.4, 0.07, 0.06, '#5a4332', false); b.rotation.z = -sx * 0.7; const c = box(PX + sx * PS, topY - 0.18, PZ + sz * (PS - 0.25), 0.06, 0.07, 0.4, '#5a4332', false); c.rotation.x = sz * 0.7; }
  // Rails on the east and north sides, bench seats inside (seat height 0.45 above the floor)
  for (const y of [0.45, 0.9]) { box(PX + PS, FLOOR + y, PZ, 0.05, 0.05, 2 * PS - 0.2, woodD, false); box(PX, FLOOR + y, PZ - PS, 2 * PS - 0.2, 0.05, 0.05, woodD, false); }
  box(PX, FLOOR + 0.45, PZ - 1.15, 2.4, 0.05, 0.42, wood); box(PX + 1.15, FLOOR + 0.45, PZ + 0.1, 0.42, 0.05, 1.9, wood);
  for (const [x, z, w, d] of [[PX - 1.0, PZ - 1.15, 0.06, 0.36], [PX + 1.0, PZ - 1.15, 0.06, 0.36], [PX + 1.15, PZ - 0.6, 0.36, 0.06], [PX + 1.15, PZ + 0.8, 0.36, 0.06]]) box(x, FLOOR + 0.22, z, w, 0.44, d, woodD, false);
  // Name plaque on the south beam, brass bell chain at the south-west post
  K.label('雨宿り', PX, topY + 0.1, PZ + PS + 0.075, 0.9, 0.2, '#d8c9a2', '#3a2d24', 120);
  // Hanging paper lantern over the seats, warm floor spill
  line([[PX, topY - 0.05, PZ - 0.2], [PX, topY - 0.45, PZ - 0.2]], '#3a2d24', 0.012);
  mesh(new THREE.SphereGeometry(1, 10, 8), bulb, PX, topY - 0.7, PZ - 0.2, false).scale.set(0.2, 0.26, 0.2); box(PX, topY - 0.46, PZ - 0.2, 0.18, 0.04, 0.18, iron, false);
  const pgm = additive(glowT, '#ffc27e', 0.3); lampGlows.push(pgm); for (const r of [0, PI / 2]) mesh(new THREE.PlaneGeometry(1.5, 1.5), pgm, PX, topY - 0.7, PZ - 0.2, false).rotation.y = r;
  decal(3.3, 3.3, PX, FLOOR + 0.01, PZ, additive(glowT, '#ffbf7a', 0.32));
  // Rain chain from the south-east eave into a gravel basin (the pavilion's rain collection point)
  { const x = PX + PS + 0.5, z = PZ + PS + 0.5; line([[x, topY + 0.1, z], [x, BASE + 0.3, z]], '#8a8f92', 0.012); for (let i = 0; i < 8; i++) cyl(x, topY - 0.1 - i * 0.28, z, 0.05, 0.08, '#8a6d4a');
    cyl(x, BASE + 0.15, z, 0.3, 0.3, stoneD); cyl(x, BASE + 0.31, z, 0.24, 0.02, '#4f6f86'); }
  // Roof layer: hip roof with eaves, ridge cap, finial, gutter and soffit (lifted off in the cutaway view)
  const roofLayer = new THREE.Group(); roofLayer.userData.layer = 'roof'; gMain.add(roofLayer); K.setRoot(roofLayer);
  box(PX, topY + 0.27, PZ, 2 * RS + 0.1, 0.1, 2 * RS + 0.1, '#2b2f36'); box(PX, topY + 0.17, PZ, 2 * PS + 0.7, 0.1, 2 * PS + 0.7, '#3a2d24', false);
  { const rf = mesh(new THREE.ConeGeometry(RS * Math.SQRT2 - 0.1, 0.7, 4), roofM, PX, topY + 0.32 + 0.35, PZ); rf.rotation.y = PI / 4; }
  cyl(PX, topY + 0.98, PZ, 0.03, 0.3, gold, roofLayer); mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(gold), PX, topY + 0.88, PZ, false);
  box(PX, topY + 0.22, PZ - RS, 2 * RS + 0.1, 0.07, 0.07, '#6d5b45', false); box(PX, topY + 0.22, PZ + RS, 2 * RS + 0.1, 0.07, 0.07, '#6d5b45', false);
  box(PX - RS, topY + 0.22, PZ, 0.07, 0.07, 2 * RS + 0.1, '#6d5b45', false); box(PX + RS, topY + 0.22, PZ, 0.07, 0.07, 2 * RS + 0.1, '#6d5b45', false);
  box(PX, topY + 0.13, PZ, 2 * RS, 0.04, 2 * RS, '#3a2d24', false);
  gMain.add(roofLayer); group('park');
  // Eave drips (animated line batch, kept inside the roof rectangle)
  const fx = new THREE.Group(); fx.userData.live = true; gMain.add(fx);
  const drips = { items: [], l: new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#cee7e5', transparent: true, opacity: 0.6, depthWrite: false })) };
  drips.l.frustumCulled = false; fx.add(drips.l);
  for (let i = 0; i < 26; i++) { const side = i % 4, u = -RS + 0.08 + rnd() * (2 * RS - 0.16), e = RS - 0.04;
    const [x, z] = side === 0 ? [PX + u, PZ + e] : side === 1 ? [PX + u, PZ - e] : side === 2 ? [PX + e, PZ + u] : [PX - e, PZ + u];
    drips.items.push({ x, z, y: 0.5 + rnd() * 2, len: 0.1, lo: 0.45, hi: topY + 0.15, v: 2.1 + rnd() * 0.5 }); }
  drips.l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(drips.items.length * 6), 3));
  const writeDrips = () => { const a = drips.l.geometry.attributes.position; drips.items.forEach((d, i) => a.array.set([d.x, d.y, d.z, d.x, d.y + d.len, d.z], i * 6)); a.needsUpdate = true; };
  writeDrips();

  // ================= sign, bins =================
  group('parkSign'); {
    const x = -2.15, z = 0.05; box(x, BASE + 0.08, z, 1.1, 0.16, 0.5, stoneD); box(x, BASE + 0.5, z, 0.95, 0.7, 0.3, stone);
    K.label('雨だまり公園', x, BASE + 0.52, z + 0.155, 0.84, 0.3, '#d8d2c0', '#2f3a44', 92); shrub(x - 0.75, z - 0.1, 0.22, 3, GREEN, 1.2); }
  group('parkBin'); {
    const x = 2.4, z = -0.1; box(x, BASE + 0.05, z, 1.0, 0.1, 0.5, stoneD);
    for (const [dx, c, t] of [[-0.24, '#7a3c3c', '燃'], [0.24, '#3b5f7e', '資']]) { box(x + dx, BASE + 0.45, z, 0.42, 0.7, 0.38, '#3d4650'); box(x + dx, BASE + 0.83, z, 0.46, 0.06, 0.42, iron, false); box(x + dx, BASE + 0.45, z + 0.2, 0.3, 0.3, 0.012, c, false); K.label(t, x + dx, BASE + 0.5, z + 0.21, 0.18, 0.18, c, '#e8e2d2', 130); box(x + dx, BASE + 0.66, z + 0.2, 0.26, 0.04, 0.012, '#15181c', false); } }

  // ================= benches, pond, trees =================
  bench('parkBenchA', -3.2, -2.55, 0);            // on the west branch, facing south toward the entrance
  bench('parkBenchB', 0, -11.55, 0);              // plaza rear, facing the tree ring
  bench('parkBenchC', 3.45, -8.8, -PI / 2);       // plaza east, facing west
  const gPond = group('parkPond'); const PCX = -5.6, PCZ = -9.4;
  { const w = mesh(new THREE.CircleGeometry(1, 28), '#3f5f78', PCX, 0.205, PCZ, false); w.rotation.x = -PI / 2; w.scale.set(1.35, 0.85, 1);
    for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, r = 0.2 + rnd() * 0.12; rock(PCX + Math.cos(a) * 1.55, PCZ + Math.sin(a) * 1.05, r, i % 3 ? stone : stoneD); }
    for (let i = 0; i < 9; i++) { const a = rnd() * 6.3, d = 1.7 + rnd() * 0.4; for (let k = 0; k < 3; k++) { const hh = 0.8 + rnd() * 0.3, c = cyl(PCX + Math.cos(a) * d + k * 0.04, BASE + hh / 2 + 0.03, PCZ + Math.sin(a) * d * 0.7, 0.012, hh, '#4f8a58'); c.rotation.z = (rnd() - 0.5) * 0.4; } }
    shrub(PCX - 1.9, PCZ + 0.6, 0.28, 4, HYD, 1.1); shrub(PCX + 0.6, PCZ - 1.25, 0.26, 4, FLOW, 1.0);
    decal(4.2, 3.0, PCX, 0.208, PCZ, additive(glowT, '#8fb0d8', 0.12)); }
  const rings = [], ripMat = () => new THREE.MeshBasicMaterial({ color: '#cfe6f2', transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  { const fxp = new THREE.Group(); fxp.userData.live = true; gPond.add(fxp);
    [[-0.3, 0.1, 0.5], [0.45, -0.25, 0.55], [-0.05, 0.3, 0.45], [0.2, 0.05, 0.4]].forEach(([dx, dz, r], i) => { const m = ripMat(), a = mesh(new THREE.RingGeometry(0.7, 1, 24), m, PCX + dx, 0.212, PCZ + dz, false, fxp); a.rotation.x = -PI / 2; rings.push({ a, m, r, off: i / 4 }); }); }

  tree('parkTreeW', -6.6, -4.2, 3.75, 1.55, GREEN, 15, true);         // big camphor west of the path
  tree('parkTreeC', 0.1, -8.6, 3.25, 1.5, DEEP, 12, true);             // plaza tree in the raised ring
  const gCh = tree('parkTreeCh', 8.2, -10.3, 3.05, 1.35, PINK, 13, true);   // cherry, east side
  gCh.add(mesh(new THREE.PlaneGeometry(1.8, 1.8), additive(glowT, '#f2a4b8', 0.16), 8.2, 2.35, -9.9, false));
  tree('parkTreeNW', -6.0, -13.0, 3.6, 1.45, DEEP, 12, false);
  tree('parkTreeN', 3.0, -13.2, 3.7, 1.5, GREEN, 12, false);
  tree('parkTreeNE', 8.6, -13.3, 3.55, 1.35, ['#7aa070', '#5f8a5e', '#9bb06a'], 11, false);
  tree('parkTreeFW', -6.8, -0.9, 2.6, 1.05, GREEN, 8, false);
  tree('parkTreeFE', 8.9, -0.9, 2.7, 1.1, ['#7aa070', '#5f8a5e', '#9bb06a'], 8, false);
  // Tree ring in the plaza: raised stone ring (0.4 above the paving) around the centre tree, planted with low flowers
  group('parkTreeC'); { cyl(0.1, BASE + 0.2, -8.6, 1.25, 0.4, stoneD); cyl(0.1, BASE + 0.41, -8.6, 1.12, 0.03, '#4a3a2e'); shrub(-0.7, -8.0, 0.22, 3, FLOW, 0.9); shrub(0.8, -9.1, 0.22, 3, HYD, 0.9); }

  // ================= low kerb walls, hedges and gate pillars =================
  const edge = (name, axis, d, u0, u1, shrubs, ends) => {
    group(name); const len = u1 - u0, n = Math.max(1, Math.round(len / 1.8)), step = len / n;
    ab(axis, (u0 + u1) / 2, BASE + 0.2, d, len, 0.4, 0.3, '#5a5f66'); ab(axis, (u0 + u1) / 2, BASE + 0.42, d, len + 0.02, 0.05, 0.36, stone, false);
    for (let i = 0; i < n; i++) ab(axis, u0 + (i + 0.5) * step, BASE + 0.2, d + (axis === 'x' ? 0.152 : 0.152), 0.012, 0.36, 0.01, '#3c4047', false);
    for (let i = 0; i <= n; i++) { const u = u0 + i * step; if (i % 2 === 0) { ab(axis, u, BASE + 0.62, d, 0.07, 0.4, 0.07, iron); ab(axis, u, BASE + 0.84, d, 0.12, 0.05, 0.12, '#3d4650', false); } }
    for (const [u, off, r, cols, k] of shrubs || []) shrub(axis === 'x' ? u : d + off, axis === 'x' ? d + off : u, r, k, cols, 1.2);
    for (const e of ends || []) { const [x, z] = axis === 'x' ? [e, d] : [d, e]; box(x, BASE + 0.45, z, 0.24, 0.9, 0.24, stoneD); box(x, BASE + 0.93, z, 0.3, 0.06, 0.3, stone, false); box(x, BASE + 1.1, z, 0.18, 0.26, 0.18, '#3d4650'); box(x, BASE + 1.1, z, 0.14, 0.2, 0.185, bulb, false); box(x, BASE + 1.26, z, 0.26, 0.04, 0.26, iron, false);
      const gm = additive(glowT, '#ffc27e', 0.3); lampGlows.push(gm); for (const r of [0, PI / 2]) mesh(new THREE.PlaneGeometry(0.4, 0.4), gm, x, BASE + 1.1, z, false).rotation.y = r; decal(2.0, 2.0, x, 0.215, z - 0.9, additive(glowT, '#ffc27e', 0.16)); } };
  edge('parkEdgeW', 'z', -8.75, -15.2, 0.95, [[-13.2, 0.55, 0.35, GREEN, 5], [-10.8, 0.5, 0.3, HYD, 5], [-2.6, 0.55, 0.3, GREEN, 4], [-0.6, 0.5, 0.28, FLOW, 4]]);
  edge('parkEdgeE', 'z', 10.75, -15.2, 0.95, [[-12.0, -0.5, 0.32, HYD, 5], [-6.8, -0.55, 0.3, GREEN, 5], [-2.6, -0.5, 0.3, FLOW, 4], [-0.8, -0.5, 0.26, GREEN, 3]]);
  edge('parkEdgeN', 'x', -15.2, -8.9, 10.9, [[-7.5, 0.55, 0.32, GREEN, 4], [-3.3, 0.5, 0.3, HYD, 5], [0.0, 0.55, 0.3, GREEN, 4], [6.0, 0.5, 0.3, FLOW, 4], [9.8, 0.5, 0.3, GREEN, 4]]);
  edge('parkEdgeFW', 'x', 0.85, -8.9, -1.3, [[-5.2, -0.5, 0.3, HYD, 5], [-3.6, -0.45, 0.26, GREEN, 4], [-8.0, -0.45, 0.28, GREEN, 4]], [-1.2]);
  edge('parkEdgeFE', 'x', 0.85, 1.3, 10.9, [[4.6, -0.5, 0.3, HYD, 5], [6.6, -0.45, 0.26, GREEN, 4], [9.4, -0.45, 0.28, FLOW, 4]], [1.2]);

  // ================= bollard lamps along the paths =================
  group('parkLampW'); bollardLamp(-1.7, -5.2, K.root); bollardLamp(-4.2, -11.9, K.root);
  group('parkLampC'); bollardLamp(1.55, -3.3, K.root); bollardLamp(-2.9, -6.2, K.root);
  group('parkLampE'); bollardLamp(2.55, -12.0, K.root); bollardLamp(4.0, -2.0, K.root); bollardLamp(7.9, -2.0, K.root);

  // ================= ground: lawn, flagstone paths, plaza, drain slot, tactile strip =================
  group('parkGround');
  const pad = (x0, x1, z0, z1, m, y0, y1, u = 3) => mesh(tileUV(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), (x1 - x0) / u, (z1 - z0) / u), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, false);
  pad(-8.9, 10.9, -15.3, 1.05, mat('#58765a'), BASE, 0.2); { const g = pad(-8.9, 10.9, -15.3, 1.05, toon(grassT), 0.2, 0.202); g.material.polygonOffset = true; }
  const P = (x0, x1, z0, z1) => pad(x0, x1, z0, z1, paveM, 0.2, 0.226, 2);
  P(-1.1, 1.1, -5.7, 1.05); P(-4.9, -1.0, -4.45, -3.2); P(1.0, 5.9, -2.65, -1.45); P(5.2, 6.5, -3.8, -1.45); P(-5.4, -4.2, -7.6, -3.2);
  { const pl = mesh(tileUV(new THREE.CylinderGeometry(3.3, 3.3, 0.026, 40), 5, 5), paveM, 0, 0.213, -8.6, false); pl.position.y = 0.213; }
  for (const [r0, r1, c] of [[1.38, 1.5, '#4a4f58'], [2.85, 2.97, '#4a4f58']]) { const m = mesh(new THREE.RingGeometry(r0, r1, 40), mat(c), 0.0, 0.2275, -8.6, false); m.rotation.x = -PI / 2; }
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, b = mesh(new THREE.PlaneGeometry(1.35, 0.05), mat('#4a4f58'), Math.cos(a) * 2.18, 0.2278, -8.6 + Math.sin(a) * 2.18, false); b.rotation.set(-PI / 2, 0, -a); }
  // rain-garden swale (pebble channel) from the camphor bed down to the pond, pond apron
  pad(-6.1, -5.3, -7.6, -5.4, toon(gravelT), 0.2, 0.209, 1.6); { const g = mesh(new THREE.CircleGeometry(1, 28), toon(gravelT), PCX, 0.2, PCZ, false); g.rotation.x = -PI / 2; g.scale.set(2.1, 1.6, 1); g.position.y = 0.203; }
  for (const [x, z] of [[-4.9, -6.4], [-4.45, -7.4], [-4.8, -8.5]]) mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.05, 9), mat(stone), x, 0.225, z, false);
  // drain slot and tactile paving at the entrance, the yellow strip pairs with the bus apron outside
  pad(-1.05, 1.05, 0.26, 0.4, mat('#252a30'), 0.2, 0.232, 1); for (let i = 0; i < 11; i++) pad(-1.0 + i * 0.2, -0.95 + i * 0.2, 0.26, 0.4, mat('#4a525a'), 0.232, 0.236, 1);
  for (let i = 0; i < 6; i++) pad(-1.05, 1.05, 0.55 + i * 0.07, 0.59 + i * 0.07, mat('#d9b43a'), 0.226, 0.236, 1);
  // warm light pools on the paths, cool wet sheen
  for (const [x, z, w, h] of [[0, -2.5, 2.8, 4.2], [0, -8.6, 5.4, 5.4], [5.8, -2.0, 3.2, 1.6], [-3.0, -3.8, 3.0, 1.4]]) decal(w, h, x, 0.228, z, additive(glowT, '#7e9ccc', 0.07));

  // ================= local animation: canopy sway, pond ripples, lamp glow, eave drips =================
  return {
    update(t, dt) {
      for (const d of drips.items) { d.y -= dt * d.v; if (d.y < d.lo) d.y = d.hi; } writeDrips();
      for (const w of swayers) { w.m.position.set(w.x + 0.05 * Math.sin(t * 0.8 + w.p), w.y + 0.025 * Math.sin(t * 0.6 + w.q), w.z + 0.05 * Math.sin(t * 0.7 + w.q)); w.m.scale.setScalar(w.s * (1 + 0.03 * Math.sin(t * 0.9 + w.p))); }
      for (const r of rings) { const p = (t * 0.5 + r.off) % 1; r.a.scale.setScalar(r.r * (0.25 + 0.75 * p)); r.m.opacity = 0.5 * (1 - p); }
      lampGlows.forEach((g, i) => { g.opacity = 0.27 + 0.05 * Math.sin(t * 0.8 + i * 1.7) * Math.sin(t * 0.37 + i); });
    },
  };
};
