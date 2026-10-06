// LM08 灯塔岛 (the lighthouse island) (W7). Local frame: origin = the site anchor (8.00 S 170.00 W, altitude 1.53 m: the island's top), +Z towards the south entrance (heading 180, 9.5 m out, the
// island's south shore: the end of T11-02, where the bridge's steel maintenance stair of W5b lands), +X to the left of +Z = EAST. The island (world.js: a 10 m cone, the land ends at r = 10 m) is terrain;
// the module stands on it through groundFn. White round lighthouse 12.0 m high (a tapering shaft, a gallery ring, a glazed lantern room with a roof and finial) at (0, -1); the keeper's
// cottage 5 x 4 m with a red tile roof and one lit window at (-3.6, 2.4); a 6 m timber jetty on the NORTH shore with a small boat tied up (never on the south: the bridge deck is 14.9 m south of
// the anchor); rocks and tide pools round the shore; a weather vane and a clothes line. The beam: one soft additive cone that turns once in 12 s, 40 m long, faint (peak opacity 0.10): it
// sweeps the sea but never reads as a searchlight. Groups: lm08Island, lm08Tower, lm08Cottage, lm08Jetty, lm08Rocks, lm08Beam (live), lm08Live (boat bob, line sway).
(globalThis.LANDMARKS = globalThis.LANDMARKS || {}).LM08 = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm } = K, L = LMLIB(K), PI = Math.PI, rnd = K.rand(808);
  const out = { stats: {}, update() {} };
  const G = L.groundFn(rec), SEA = G.sea, gy = (x, z) => Math.max(G(x, z), SEA + 0.0);
  const isl = group('lm08Island'); L.use(isl);
  // levelled grass cap on the island top (r 6.5), the path of slabs to the south shore
  { const g = L.ground(6.4, '#5d7658', 0.02); g.position.y = 0.0; }
  for (let i = 0; i < 8; i++) { const z = 0.5 + i * 1.1, y = gy(0.2, z); box(0.2, y + 0.04, z, 1.2, 0.08, 0.9, '#8a8d90', false, isl); }
  // ---- the lighthouse: base ring, shaft (tapering 1.5 -> 1.05 m radius), a red band, the gallery at 9.4 m, the lantern room 9.6-11.1 m, the roof and finial to 12.0 m
  const tw = group('lm08Tower'); L.use(tw); const TX = 0, TZ = -1.0, T0 = gy(TX, TZ);
  mesh(new THREE.CylinderGeometry(1.75, 1.9, 0.6, 16), mat('#8d8a85'), TX, T0 + 0.3, TZ, true, tw);
  mesh(new THREE.CylinderGeometry(1.05, 1.5, 8.8, 16), mat('#eceeee'), TX, T0 + 0.6 + 4.4, TZ, true, tw);
  mesh(new THREE.CylinderGeometry(1.2, 1.29, 1.1, 16), mat('#c4412e'), TX, T0 + 0.6 + 3.2, TZ, false, tw);
  mesh(new THREE.CylinderGeometry(1.75, 1.45, 0.3, 16), mat('#6a6e72'), TX, T0 + 9.55, TZ, true, tw);                    // gallery floor
  { const r = mesh(new THREE.TorusGeometry(1.7, 0.04, 5, 24), mat('#4a4f56'), TX, T0 + 10.45, TZ, false, tw); r.rotation.x = PI / 2; for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; cyl(TX + Math.cos(a) * 1.7, T0 + 10.0, TZ + Math.sin(a) * 1.7, 0.025, 0.9, '#4a4f56', tw); } }
  const lanternMat = new THREE.MeshBasicMaterial({ color: '#ffe8b8' }), lantern = mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 12), lanternMat, TX, T0 + 10.5, TZ, false, tw); lantern.scale.set(0.82, 1, 0.82);
  mesh(new THREE.CylinderGeometry(0.93, 0.93, 1.5, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#bfe6ea', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }), TX, T0 + 10.5, TZ, false, tw);
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; cyl(TX + Math.cos(a) * 0.93, T0 + 10.5, TZ + Math.sin(a) * 0.93, 0.03, 1.5, '#3a3f46', tw); }
  mesh(new THREE.ConeGeometry(1.15, 0.7, 12), mat('#c4412e'), TX, T0 + 11.6, TZ, true, tw); cyl(TX, T0 + 11.85, TZ, 0.05, 0.3, '#3a3f46', tw);
  box(TX + 1.05, T0 + 1.0, TZ + 0.3, 0.5, 1.5, 0.7, '#4a382b', true, tw);                                                 // the door (a dark slab on the shaft)
  // ---- the keeper's cottage 5 x 4 m: white-washed walls, red tile roof, one lit window facing the south shore
  const ct = group('lm08Cottage'); L.use(ct); const CX = -3.7, CZ = 2.6, C0 = gy(CX, CZ);
  const house = L.house(CX, CZ, 0.0, { w: 5, d: 4, floors: 1, wall: '#d8d6cc', roof: '#a8412e', rise: 1.5, lit: true }); house.position.y = C0;
  // ---- jetty on the north shore: 6 m of planks on piles, a boat
  const jt = group('lm08Jetty'); L.use(jt); const JZ0 = -9.2;
  for (let i = 0; i < 12; i++) { const z = JZ0 - i * 0.5; box(0.0, SEA + 0.75, z, 1.6, 0.08, 0.46, '#7a5f48', true, jt); }
  for (let i = 0; i < 7; i++) for (const sx of [-0.7, 0.7]) { const z = JZ0 - i * 1.0, base = Math.min(gy(sx, z), SEA) - 0.3; cyl(sx, (base + SEA + 0.72) / 2, z, 0.07, SEA + 0.72 - base, '#4a382b', jt); }
  cyl(0.5, SEA + 1.1, JZ0 - 5.8, 0.05, 0.7, '#4a382b', jt);
  // ---- rocks and tide pools
  const rk = group('lm08Rocks'); L.use(rk);
  for (let i = 0; i < 30; i++) { const a = rnd() * PI * 2, r = 6.2 + rnd() * 3.4; const x = Math.sin(a) * r, z = -Math.cos(a) * r; if (Math.abs(x) < 1.6 && z < -7.5) continue; const s = 0.5 + 1.6 * rnd() * rnd(); L.rock(x, Math.max(gy(x, z), SEA - 0.4) - 0.1, z, s, ['#6f6b68', '#7d7875', '#625e5c'][i % 3], a, 0.7); }
  for (const [x, z] of [[4.4, 4.8], [-1.8, 6.4], [5.0, -3.0]]) { const g = gy(x, z); const p = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.03, 10), warm('#4a7f8e', 0.1), x, g + 0.04, z, false, rk); p.scale.z = 0.7; }
  // ---- weather vane on the cottage, clothes line
  L.use(ct); cyl(CX + 1.8, C0 + 3.4, CZ - 0.5, 0.025, 1.2, '#3a3f46', ct); box(CX + 1.8, C0 + 3.95, CZ - 0.5, 0.5, 0.06, 0.04, '#3a3f46', false, ct);
  cyl(CX - 1.8, C0 + 1.0, CZ + 3.0, 0.03, 2.0, '#6a5240', ct); cyl(CX + 1.6, C0 + 1.0, CZ + 3.0, 0.03, 2.0, '#6a5240', ct); box(CX - 0.1, C0 + 1.95, CZ + 3.0, 3.4, 0.015, 0.015, '#d8c9a0', false, ct);
  // ---- the beam: a cone 40 m long whose alpha fades along its length, in its own live group at the lantern, turning once per 12 s; the boat bobs at the jetty (live)
  const bm = group('lm08Beam'); L.use(bm);
  const seg = 14, ring = 14, pos = [], col = [], idx = [];
  for (let j = 0; j <= seg; j++) { const t = j / seg, r = 0.25 + 2.6 * t * t, a = 0.10 * Math.pow(1 - t, 1.6) * (0.4 + 0.6 * Math.min(1, t * 6)); for (let k = 0; k <= ring; k++) { const th = k / ring * PI * 2; pos.push(t * 40, Math.cos(th) * r, Math.sin(th) * r); col.push(1.0, 0.92, 0.72, a); } }
  for (let j = 0; j < seg; j++) for (let k = 0; k < ring; k++) { const a = j * (ring + 1) + k, b = a + 1, c = a + ring + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); bg.setIndex(idx);
  const beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); beam.renderOrder = 7;
  const bw = L.sub(TX, T0 + 10.5, TZ); bw.userData.live = true; bw.add(beam); const beam2 = beam.clone(); beam2.rotation.y = PI; bw.add(beam2);
  const bb = L.sub(0.9, SEA, JZ0 - 3.0, 0.2); bb.userData.live = true;
  { const hs = new THREE.Shape(); hs.moveTo(-1.6, -0.55); hs.lineTo(1.0, -0.6); hs.quadraticCurveTo(1.8, -0.1, 1.8, 0); hs.quadraticCurveTo(1.8, 0.1, 1.0, 0.6); hs.lineTo(-1.6, 0.55); hs.lineTo(-1.6, -0.55); const g = new THREE.ExtrudeGeometry(hs, { depth: 0.5, bevelEnabled: false }); g.rotateX(-PI / 2); g.translate(0, -0.2, 0); mesh(g, mat('#dfe5e8'), 0, 0, 0, true, bb); box(-0.4, 0.45, 0, 0.9, 0.5, 0.8, '#cfd6da', true, bb); }
  const line = L.sub(CX - 0.1, C0 + 1.9, CZ + 3.0); line.userData.live = true; const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), new THREE.MeshBasicMaterial({ color: '#e8e4d8', side: THREE.DoubleSide })); cloth.position.set(-0.5, -0.45, 0); line.add(cloth);
  const L2 = { beamPeak: 0.10, period: 12 };
  out.stats = { lighthouseHeight: 11.85 + 0.15, period: L2.period, beamPeak: L2.beamPeak, beamLength: 40, cottage: [5, 4], jetty: 6, jettyZ: [JZ0, JZ0 - 6], island: 10, rocks: 30, towerBase: T0 };
  out.update = (t) => { bw.rotation.y = (t / 12) * PI * 2; bb.position.y = SEA + 0.04 * Math.sin(t * 0.8); bb.rotation.z = 0.02 * Math.sin(t * 0.6); line.rotation.z = 0.05 * Math.sin(t * 0.7); cloth.rotation.y = 0.2 * Math.sin(t * 0.9); };
  return out;
};
