// LM02 湯けむり温泉村 (Yu-kemuri hot-spring village) (W7). Local frame: origin = the site anchor (36.00 N 50.00 W, altitude 1.9 m, a levelled platform of radius 15 m with a 10 m
// transition), +Z towards the east entrance (heading 100, 17 m out, the end of T02-01), +X to the left of +Z; the north-east entrance (heading 41, T02-02's start) is at local (14.57, 8.76).
// 1 unit = 1 m. Six timber buildings (two 2-storey inns, three houses, a shop) lie round a small plaza along a brook; the open-air spring (5 x 4 m) with a bamboo fence, the source hut and
// its wooden flume, a foot bath, stone-slab paths, a plank bridge, paper lanterns, noren, the village torii, a bus stop and a vending machine. Detail is one level below the town's;
// interiors are only the lit window panes. Groups: lm02Ground, lm02Houses, lm02Onsen (pool, hut, flume, fence), lm02Brook, lm02Street (torii, bus stop, vending, lanterns, bridge),
// lm02Live (steam, noren, brook texture).
(globalThis.LANDMARKS = globalThis.LANDMARKS || {}).LM02 = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, canvasTex } = K, L = LMLIB(K), PI = Math.PI, rnd = K.rand(202);
  const out = { stats: {}, update() {} };
  // ---- ground: grass disc r 15.6, a stone-slab street from the east entrance to the plaza, the north-east path, the plaza
  const gr = group('lm02Ground'); L.use(gr);
  L.ground(15.6, '#5d7658', 0.02);
  const slab = (x, z, w, d, c = '#8a8d90') => box(x, 0.06, z, w, 0.1, d, c, false, gr);
  for (let z = 17; z > -5; z -= 1.1) slab(((z * 7) % 3 - 1.5) * 0.04, z, 2.6 + (rnd() - 0.5) * 0.3, 1.0, rnd() < 0.5 ? '#8a8d90' : '#7d8084');
  L.ground(4.6, '#8a8d90', 0.05);                                              // the plaza (stone paving)
  for (let i = 0; i < 10; i++) { const t = i / 9; slab(14.57 - t * 12.4, 8.76 - t * 7.6, 1.5, 1.0, '#80838a'); }   // path from the north-east entrance (14.57, 8.76)
  // ---- houses round the plaza (front faces the plaza)
  const hs = group('lm02Houses'); L.use(hs);
  const houses = [
    { x: -8.5, z: -4.5, ry: PI / 2 + 0.25, w: 9, d: 6, floors: 2, wall: '#7a6552', name: 'inn A' },
    { x: 1.0, z: -10.2, ry: 0.0, w: 8, d: 5.5, floors: 2, wall: '#6f5c4a', name: 'inn B' },
    { x: 9.0, z: -6.0, ry: -PI / 2 - 0.2, w: 6.5, d: 5, floors: 1, wall: '#80705c', name: 'house 1' },
    { x: -9.2, z: 6.5, ry: PI / 2 - 0.15, w: 5.5, d: 4.8, floors: 1, wall: '#75604d', name: 'house 2' },
    { x: 8.6, z: 5.8, ry: -PI / 2 + 0.1, w: 5.2, d: 4.5, floors: 1, wall: '#7c6955', name: 'house 3' },
    { x: -4.2, z: 11.2, ry: PI * 0.92, w: 5, d: 4.2, floors: 1, wall: '#6a5848', name: 'shop' },
  ];
  houses.forEach((h, i) => L.house(h.x, h.z, h.ry, { w: h.w, d: h.d, floors: h.floors, wall: h.wall, rise: h.floors > 1 ? 1.9 : 1.4, roof: i % 2 ? '#353a44' : '#3a3f4a', lit: i !== 4 }));
  // inn entrance canopy and a pair of lanterns at each inn (genkan)
  // ---- the open-air spring: a 5 x 4 m pool, stone rim, steaming; bamboo fence on three sides; the source hut and the flume
  const on = group('lm02Onsen'); L.use(on); const OX = -1.0, OZ = -2.0;
  box(OX, 0.15, OZ, 5.6, 0.3, 4.6, '#7d8084', true, on); const water = mesh(new THREE.BoxGeometry(5.0, 0.04, 4.0), warm('#7fb3b8', 0.16), OX, 0.33, OZ, false, on);
  for (let i = 0; i < 9; i++) L.rock(OX + (i % 3 - 1) * 2.7 * (i < 3 ? 1 : 0.0) + (i >= 3 ? (i < 6 ? -2.8 : 2.8) : 0), 0.3, OZ + (i < 3 ? 2.3 : (i % 3 - 1) * 1.8), 0.7 + rnd() * 0.5, '#6f7378', rnd() * 6);
  for (let i = 0; i < 12; i++) { const t = i / 11; box(OX - 3.1, 0.9, OZ - 2.4 + t * 4.8, 0.08, 1.8, 0.12, '#9aa56e', true, on); }                 // bamboo fence, west side
  for (let i = 0; i < 12; i++) { const t = i / 11; box(OX - 3.1 + t * 6.2, 0.9, OZ - 2.6, 0.12, 1.8, 0.08, '#9aa56e', true, on); }                 // north side
  for (let i = 0; i < 6; i++) { const t = i / 5; box(OX + 3.1, 0.9, OZ - 2.4 + t * 2.0, 0.08, 1.8, 0.12, '#9aa56e', true, on); }                    // east side, open towards the plaza
  box(OX - 3.1, 1.85, OZ, 0.14, 0.1, 5.0, '#7a8a54', true, on); box(OX, 1.85, OZ - 2.6, 6.4, 0.1, 0.14, '#7a8a54', true, on);
  const hut = L.house(OX - 6.2, OZ - 3.4, 0.4, { w: 2.6, d: 2.4, wall: '#6f5c4a', rise: 1.1, lit: false });
  // wooden flume: from the hut to the pool: a trough of planks on posts
  for (let i = 0; i < 6; i++) { const t = i / 5, x = OX - 5.0 + t * 2.0, z = OZ - 2.9 + t * 1.2; box(x, 1.1 - 0.12 * t * 2, z, 0.5, 0.14, 0.5, '#5a4a3c', true, on); if (i % 2 === 0) cyl(x, 0.55 - 0.12 * t, z, 0.06, 1.1, '#4a382b', on); }
  // foot bath near the plaza: a wooden basin and a bench
  box(4.8, 0.2, -1.2, 2.2, 0.4, 1.0, '#6a5240', true, on); mesh(new THREE.BoxGeometry(1.9, 0.04, 0.7), warm('#8fc0c0', 0.14), 4.8, 0.4, -1.2, false, on); box(4.8, 0.45, -0.3, 2.0, 0.1, 0.4, '#5a4a3c', true, on);
  // ---- brook with a plank bridge: a strip of water from (13, -2.5) to (-13, -8.5) with a scrolling texture (live)
  const bk = group('lm02Brook'); L.use(bk);
  const brookT = canvasTex(256, 64, (q, w, h) => { q.fillStyle = '#4a7f8e'; q.fillRect(0, 0, w, h); q.strokeStyle = 'rgba(210,235,240,.5)'; q.lineWidth = 2; for (let i = 0; i < 9; i++) { q.beginPath(); q.moveTo(0, 8 + i * 6.5); q.bezierCurveTo(w * 0.3, 2 + i * 6.5, w * 0.6, 14 + i * 6.5, w, 8 + i * 6.5); q.stroke(); } });
  brookT.wrapS = brookT.wrapT = THREE.RepeatWrapping; brookT.repeat.set(5, 1);
  const bm = new THREE.MeshBasicMaterial({ map: brookT, color: '#b9d8e0' }); const BR = [[13.5, -2.4], [8, -3.4], [3, -5.6], [-3, -7.6], [-8.5, -8.0], [-14, -9.4]];
  for (let i = 0; i + 1 < BR.length; i++) { const [x0, z0] = BR[i], [x1, z1] = BR[i + 1], l = Math.hypot(x1 - x0, z1 - z0), m = mesh(new THREE.BoxGeometry(l + 0.4, 0.04, 1.6), bm, (x0 + x1) / 2, 0.02, (z0 + z1) / 2, false, bk); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); for (const sd of [-1, 1]) { const rr = mesh(new THREE.BoxGeometry(l + 0.4, 0.3, 0.3), mat('#6a6e72'), (x0 + x1) / 2 - sd * Math.sin(Math.atan2(z1 - z0, x1 - x0)) * 0.95, 0.15, (z0 + z1) / 2 - sd * Math.cos(Math.atan2(z1 - z0, x1 - x0)) * 0.95 * -1, true, bk); rr.rotation.y = -Math.atan2(z1 - z0, x1 - x0); } }
  // plank bridge over the brook at x = 1.5: 8 planks and two rails
  const bz = -5.2; for (let i = 0; i < 9; i++) box(1.5, 0.35, bz - 1.2 + i * 0.3, 1.5, 0.08, 0.28, '#6a5240', true, bk); box(0.8, 0.8, bz, 0.08, 0.1, 2.9, '#5a4a3c', true, bk); box(2.2, 0.8, bz, 0.08, 0.1, 2.9, '#5a4a3c', true, bk); for (const px of [0.8, 2.2]) for (const pz of [-1.3, 1.3]) cyl(px, 0.42, bz + pz, 0.05, 0.85, '#4a382b', bk);
  // ---- the street furniture: village torii, bus stop, vending machine, paper lanterns, noren
  const st = group('lm02Street'); L.use(st);
  L.torii(0, 0, 13.5, { w: 3.2, h: 3.4, rot: 0, color: '#8f4a40' });
  box(3.4, 0.9, 14.2, 0.06, 1.8, 0.06, '#7d8794', false, st); box(3.4, 1.75, 14.2, 0.7, 0.5, 0.04, '#e4e8ee', false, st); box(3.4, 1.85, 14.22, 0.7, 0.1, 0.05, '#d58a3a', false, st);   // bus stop sign
  box(3.4, 0.25, 15.3, 1.6, 0.12, 0.5, '#8a6a4c', true, st); box(3.4, 0.6, 15.6, 1.6, 0.6, 0.06, '#8a6a4c', true, st);                                    // its bench
  box(-3.4, 0.9, 14.0, 0.9, 1.8, 0.8, '#5e6a74', true, st); mesh(new THREE.BoxGeometry(0.72, 1.3, 0.03), warm('#dfe9f2', 0.20), -3.4, 1.0, 14.42, false, st);         // vending machine (cool light)
  const lanterns = []; for (const [x, z, y] of [[-2.2, 9.0, 2.6], [2.2, 9.0, 2.6], [-2.2, 4.0, 2.6], [2.2, 4.0, 2.6], [-6.0, -0.8, 2.4], [-5.2, -7.6, 2.4], [4.2, -7.4, 2.4], [9.6, 1.0, 2.2]]) lanterns.push(mesh(new THREE.SphereGeometry(0.28, 10, 8), warm(rnd() < 0.5 ? '#e0603c' : '#e8a050', 0.5), x, y, z, false, st));
  for (const [x, z] of [[-2.2, 9.0], [2.2, 9.0], [-2.2, 4.0], [2.2, 4.0]]) cyl(x, 1.3, z, 0.07, 2.6, '#5a4a3c', st);
  L.pool(0, 6.5, 6.0, '#ffcf8a', 0.06, 0.08); L.pool(-8.5, -4.5, 4.5, '#ffcf8a', 0.05, 0.08); L.pool(1, -10, 4.0, '#ffcf8a', 0.05, 0.08);
  // ---- live: steam plumes over the pool and the flume, noren (cloth strips that sway), brook texture scroll
  const lv = group('lm02Live'); L.use(lv);
  const plumes = [L.steam(OX - 1.0, 0.4, OZ - 0.5, { n: 6, h: 3.4, s: 1.4, o: 0.2, speed: 0.045 }), L.steam(OX + 1.2, 0.4, OZ + 0.8, { n: 6, h: 3.0, s: 1.2, o: 0.18, speed: 0.05 }), L.steam(OX - 4.6, 1.0, OZ - 2.7, { n: 3, h: 2.0, s: 0.6, o: 0.14, speed: 0.06 })];
  const noren = []; const nm = new THREE.MeshBasicMaterial({ color: '#8a2f3a', side: THREE.DoubleSide });
  houses.forEach((h, i) => { if (i === 4) return; const fx = h.x + Math.sin(h.ry) * (h.d / 2 + 0.2), fz = h.z + Math.cos(h.ry) * (h.d / 2 + 0.2), outer = L.sub(fx, 2.15, fz, h.ry), swing = new THREE.Group(); outer.userData.live = true; outer.add(swing);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.8), nm); c.position.set((k - 1) * 0.5, -0.4, 0); swing.add(c); } swing.userData.phase = i * 1.3; noren.push(swing); });
  out.stats = { houses: houses.length, floors2: houses.filter(h => h.floors === 2).length, pool: [5.0, 4.0], lanterns: lanterns.length, plumes: plumes.length, noren: noren.length, brook: true, bridge: true };
  out.update = (t) => { plumes.forEach(p => p.update(t)); brookT.offset.x = -t * 0.12; noren.forEach(n => { n.rotation.x = Math.sin(t * 0.8 + n.userData.phase) * 0.08; }); };
  return out;
};
