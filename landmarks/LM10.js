// LM10 小渔港 (the little fishing harbour) (W7). Local frame: origin = the site anchor (5.00 N 106.00 E, altitude 1.65 m), +Z towards the south entrance (heading 180, 22.78 m out, a point of
// the T01 trunk road), +X to the left of +Z = EAST: the sea lies to the east and north-east (the coast runs diagonally from (12, 3) to (22, -12)). Everything stands on the terrain
// (groundFn samples height() under each base: the site has no platform), sea level is local y = -1.65. On land: the fishery co-op warehouse with its roller shutter, the ice hut, two fishermen's
// houses, a drying rack with nets (they sway), a pile of orange floats and fish boxes, the little Ebisu shrine with a torii, a vending machine, lamps; a 20 m concrete breakwater from the
// coast eastwards with a red-and-white light post (a slow glow, period 6 s); five small boats (one shared hull geometry) moored on its sheltered side, each bobbing a few centimetres
// out of phase. The 5.8 m of road between the site circle and the T01 entrance is a short RD03-style lane (not in world.js). Boats and breakwater go beyond the 17 m circle over the
// water (W7_SPEC section 3). Groups: lm10Land, lm10Houses, lm10Port (breakwater, bollards), lm10Boats (live), lm10Live (nets, light post, reflections).
(globalThis.LANDMARKS = globalThis.LANDMARKS || {}).LM10 = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm } = K, L = LMLIB(K), PI = Math.PI, rnd = K.rand(1010);
  const out = { stats: {}, update() {} };
  const G = L.groundFn(rec), SEA = G.sea;                        // sea level in local y
  const gy = (x, z) => G(x, z);
  // ---- land: grass disc under the buildings, the lane to the road
  const ld = group('lm10Land'); L.use(ld);
  L.ground(11.5, '#5d7658', 0.04).position.set(-3, 0.04 + 0.0, 2);
  { const g = ld.children[ld.children.length - 1]; g.position.y = 0.0; }
  const laneM = mat('#46505b'); for (let i = 0; i < 6; i++) { const z = 17.2 + i, y = gy(0, z); box(0, y + 0.04, z, 4.5, 0.08, 1.05, '#46505b', false, ld); box(-2.2, y + 0.07, z, 0.1, 0.05, 1.05, '#c9cfc4', false, ld); box(2.2, y + 0.07, z, 0.1, 0.05, 1.05, '#c9cfc4', false, ld); } void laneM;
  // apron along the quay: a concrete strip east of the buildings
  for (let z = -10; z <= 12; z += 1.5) { const y = gy(8.5, z); box(8.5, y + 0.05, z, 3.2, 0.1, 1.55, '#8d9094', false, ld); }
  // ---- buildings: the co-op warehouse (9 x 6, roller shutter facing the quay), ice hut, two houses
  const hs = group('lm10Houses'); L.use(hs);
  const place = (x, z, ry, o) => { const g = L.house(x, z, ry, o); g.position.y = gy(x, z); return g; };
  const wh = place(3.5, -3.5, PI / 2, { w: 9, d: 6, floors: 1, wall: '#7d8a82', roof: '#5a6a60', rise: 1.0 });
  const sh = mesh(new THREE.BoxGeometry(3.4, 2.4, 0.06), mat('#9aa59a'), 3.5 + 3.05, gy(3.5, -3.5) + 1.4, -3.5, false, hs); sh.rotation.y = PI / 2;
  for (let i = 0; i < 8; i++) { const s = mesh(new THREE.BoxGeometry(3.4, 0.04, 0.08), mat('#6a756a'), 3.5 + 3.1, gy(3.5, -3.5) + 0.35 + i * 0.3, -3.5, false, hs); s.rotation.y = PI / 2; }
  const doorLamp = mesh(new THREE.SphereGeometry(0.15, 8, 6), warm('#ffe0a0', 0.9), 3.5 + 3.2, gy(3.5, -3.5) + 3.0, -1.2, false, hs);
  place(5.2, 7.8, PI / 2, { w: 3.2, d: 3.0, floors: 1, wall: '#a8aeb0', roof: '#5a6a60', rise: 0.8, lit: false });                    // ice hut
  place(-6.5, -7.0, PI / 2 - 0.1, { w: 6.5, d: 5, floors: 2, wall: '#7a6552', rise: 1.7 });
  place(-6.8, 7.0, PI / 2 + 0.12, { w: 6, d: 4.8, floors: 1, wall: '#80705c', rise: 1.4 });
  // ---- drying rack with nets, floats and fish boxes, the shrine, vending machine, lamps
  const pt = group('lm10Port'); L.use(pt);
  for (const z of [-1.4, 1.4]) for (const x of [4.6, 7.4]) cyl(x, gy(x, z) + 1.1, z, 0.06, 2.2, '#5a4a3c', pt);
  box(6.0, gy(6, 0) + 2.2, -1.4, 3.0, 0.08, 0.08, '#5a4a3c', true, pt); box(6.0, gy(6, 0) + 2.2, 1.4, 3.0, 0.08, 0.08, '#5a4a3c', true, pt);
  for (let i = 0; i < 9; i++) { const x = 5.0 + (i % 3) * 0.9, z = -4.8 + Math.floor(i / 3) * 0.8, y = gy(x, z); mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(i % 4 === 0 ? '#e0792a' : '#e8b630'), x, y + 0.3 + (i > 5 ? 0.45 : 0), z + 8.5, true, pt); }
  for (let i = 0; i < 6; i++) { const x = 9.4, z = -6.5 + (i % 3) * 0.7, y = gy(x, z); box(x, y + 0.2 + Math.floor(i / 3) * 0.4, z, 0.6, 0.38, 0.5, i % 2 ? '#bcc4c8' : '#a9b3b8', true, pt); }
  place2(); function place2() {}
  const shr = group('lm10Port'); L.use(pt);
  { const sx = 8.0, sz = 15.5, y = gy(sx, sz); box(sx, y + 0.2, sz, 2.2, 0.4, 2.0, '#8d9094', true, pt); box(sx, y + 0.4 + 0.65, sz, 1.4, 1.3, 1.2, '#7a5f48', true, pt); L.gable(1.4, 1.2, y + 1.7, 0.7, 0.35, '#4a4f58', pt).position.set(sx, 0, sz);
    L.torii(sx + 3.0, y, sz, { w: 1.6, h: 2.3, rot: PI / 2, color: '#a24a3a' }); L.lantern(sx + 1.4, y, sz + 1.8, { k: 0.9, glowK: 0.22 }); }
  { const x = 7.0, z = 10.5, y = gy(x, z); box(x, y + 0.9, z, 0.9, 1.8, 0.8, '#5e6a74', true, pt); mesh(new THREE.BoxGeometry(0.7, 1.3, 0.03), warm('#dfe9f2', 0.20), x + 0.43, y + 1.0, z, false, pt).rotation.y = PI / 2; }
  for (const [x, z] of [[8.6, -8.5], [8.6, 4.5], [6.2, 12.5]]) { const y = gy(x, z); cyl(x, y + 2.2, z, 0.06, 4.4, '#596f80', pt); mesh(new THREE.BoxGeometry(0.5, 0.1, 0.25), warm('#ffe4b0', 0.8), x + 0.35, y + 4.4, z, false, pt); L.pool(x + 0.3, z, 2.6, '#ffcf8a', 0.06, y + 0.08); }
  // ---- the breakwater: z = 3.2, from x = 11 to x = 31 (20 m), 1.8 m wide, crest 1.3 m above the sea, stepped down to the seabed; a red-and-white light post at the end
  const bw = group('lm10Port'); L.use(bw);
  for (let x = 11; x < 31; x += 1) { const base = Math.min(gy(x + 0.5, 3.2), SEA) - 0.3, top = SEA + 1.3; box(x + 0.5, (base + top) / 2, 3.2, 1.02, top - base, 1.8, ((x * 7) | 0) % 2 ? '#8d9094' : '#80848a', true, bw); }
  for (const dz of [-0.9, 0.9]) for (let x = 11.5; x < 31; x += 2) { const base = Math.min(gy(x, 3.2 + dz * 1.4), SEA) - 0.2; mesh(new THREE.DodecahedronGeometry(0.55, 0), mat('#80848a'), x, base + 0.5, 3.2 + dz * 1.6, true, bw); }
  cyl(31.2, SEA + 1.3 + 1.1, 3.2, 0.22, 2.2, '#e8e8e8', bw); cyl(31.2, SEA + 1.3 + 2.35, 3.2, 0.24, 0.5, '#c4412e', bw); cyl(31.2, SEA + 1.3 + 2.7, 3.2, 0.16, 0.2, '#e8e8e8', bw);
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffb870' }); const lamp = mesh(new THREE.SphereGeometry(0.26, 8, 6), lampMat, 31.2, SEA + 1.3 + 3.0, 3.2, false, bw);
  for (let i = 0; i < 7; i++) cyl(12 + i * 3, SEA + 1.3 + 0.2, 3.2 + 0.85, 0.08, 0.4, '#5a4a3c', bw);   // mooring bollards on the sheltered side
  // ---- boats: one hull geometry shared by five (5.2 x 1.8 m); each in its own live group, bobbing
  const bt = group('lm10Boats'); L.use(bt);
  const hullShape = new THREE.Shape(); hullShape.moveTo(-2.6, -0.8); hullShape.lineTo(1.7, -0.9); hullShape.quadraticCurveTo(2.9, -0.2, 2.9, 0); hullShape.quadraticCurveTo(2.9, 0.2, 1.7, 0.9); hullShape.lineTo(-2.6, 0.8); hullShape.lineTo(-2.6, -0.8);
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.8, bevelEnabled: false }); hullGeo.rotateX(-PI / 2); hullGeo.translate(0, -0.25, 0);
  const hullM = mat('#e8ecee'), stripeM = mat('#2e5c8a'), cabinM = mat('#dfe4e6');
  const boats = [[20.5, -2.2, 0.15, '#e8ecee'], [23.0, -5.6, -0.1, '#d9e4ea'], [25.6, -2.4, 0.05, '#e8ecee'], [22.8, -9.2, 0.2, '#dde5e8'], [27.4, -6.6, -0.15, '#e8ecee']].map(([x, z, ry, c], i) => {
    const g = L.sub(x, SEA, z, ry + PI / 2); g.userData.live = true; mesh(hullGeo, mat(c), 0, 0, 0, true, g); box(0, 0.1, 0, 5.4, 0.18, 1.9, '#2e5c8a', false, g).scale.set(1, 1, 0.98);
    box(-1.0, 0.95, 0, 1.5, 0.9, 1.3, '#dfe4e6', true, g); mesh(new THREE.BoxGeometry(0.05, 0.4, 1.0), warm('#ffcf8a', i === 1 ? 0.22 : 0.0), 0.0, 1.0, 0, false, g).position.x = -0.2;
    cyl(-1.4, 1.9, 0, 0.04, 1.8, '#7d8794', g); return { g, ph: i * 1.3 };
  });
  // ---- live: nets (two hanging planes, swaying), the reflections of the lights on the water (additive streaks)
  const lv = group('lm10Live'); L.use(lv);
  const nets = [-1.0, 1.0].map((dz, i) => { const g = L.sub(6.0, gy(6, 0) + 2.15, dz * 1.4); g.userData.live = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.5), new THREE.MeshBasicMaterial({ color: '#2f5a48', side: THREE.DoubleSide, transparent: true, opacity: 0.85 })); m.position.y = -0.75; g.add(m); return { g, ph: i * 2.1 }; });
  const refl = (x, z, len, o) => { const m = mesh(new THREE.PlaneGeometry(0.7, len), L.glowMat('#ffbf78', o), x, SEA + 0.03, z, false, lv); m.rotation.x = -PI / 2; return m; };
  const rl = refl(31.2, 3.2 + 3.2, 6, 0.0); refl(15.0, -2.0, 4, 0.1); const rd = refl(14.0, -3.5, 3, 0.08);
  out.stats = { boats: boats.length, boatSize: [5.2, 1.8], breakwater: 20, buildings: 4, houses2: 1, nets: nets.length, lights: 6 + 2, lampPeriod: 6, ebisu: 1, vending: 1, shared: 'hullGeo' };
  out.update = (t) => {
    boats.forEach(b => { b.g.position.y = SEA + 0.04 * Math.sin(t * 0.8 + b.ph); b.g.rotation.z = 0.02 * Math.sin(t * 0.6 + b.ph * 1.7); });
    nets.forEach(n => { n.g.rotation.x = Math.sin(t * 0.7 + n.ph) * 0.06; });
    const k = 0.5 - 0.5 * Math.cos(2 * PI * (t % 6) / 6), c = 0.35 + 0.65 * k; lampMat.color.setRGB(c, 0.45 * c + 0.1, 0.2 * c + 0.05); rl.material.opacity = 0.16 * k;
  };
  return out;
};
