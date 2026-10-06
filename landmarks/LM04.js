// LM04 森中废神社与鸟居残迹 (the forgotten forest shrine and its torii) (W7). Local frame: origin = the site anchor (42.00 S 15.00 W, altitude 1.9 m, a levelled platform of radius 15 m),
// +Z towards the south-east entrance (heading 120, 17 m out, the end of T03-03 and the start of the T11-01 boardwalk), +X to the left of +Z. 1 unit = 1 m. The approach (sando) runs from the
// entrance along -Z for 25 m: moss-covered slabs and steps through ten small torii (2.5-3 m: whole, leaning, fallen, only posts), stone lanterns (two still faintly lit), a pair of komainu and
// three stone Buddhas, a dry hand-washing basin, a great sacred tree with a shimenawa, and at the end the tilted little hall (4 x 5 m, 5 m high, a roof of moss) with its steps, a rope and
// lattice doors; rain drips from its eaves and a few fireflies drift about. W4's two entrance torii of the TR03 edge stand at about z = 14.6 and 12 and are not repeated: the first torii
// of this module is at z = 9.6. Groups: lm04Sando, lm04Torii, lm04Hall, lm04Tree, lm04Stones, lm04Live (fireflies, drips, shimenawa paper).
(globalThis.LANDMARKS = globalThis.LANDMARKS || {}).LM04 = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm } = K, L = LMLIB(K), PI = Math.PI, rnd = K.rand(404);
  const out = { stats: {}, update() {} };
  const MOSS = '#4f7a56', MOSSD = '#3c6150', STONE = '#7d8083';
  // ---- ground: a mossy disc, the sando of slabs (25 m from the entrance), steps up to the hall
  const sd = group('lm04Sando'); L.use(sd);
  L.ground(15.6, '#3f5f4e', 0.02);
  for (let z = 17; z > -8.0; z -= 0.9) box(((z * 13) % 2 - 1) * 0.08, 0.05 + (z < 1.5 ? 0 : 0), z, 1.9 + (rnd() - 0.5) * 0.3, 0.1, 0.8, rnd() < 0.4 ? MOSS : '#6d7468', true, sd);
  for (let i = 0; i < 5; i++) box(0, 0.12 + 0.17 * i, -8.0 - 0.34 * i - 0.2, 2.2, 0.17, 0.4, i % 2 ? MOSSD : '#6d7468', true, sd);       // steps up to the hall (the hall floor is at 0.95)
  // ---- ten torii along the sando (state, height): 2.5-3 m
  const to = group('lm04Torii'); L.use(to);
  const T = [[9.6, 'ok', 2.8], [8.0, 'lean', 2.7], [6.5, 'ok', 2.6], [5.0, 'posts', 2.8], [3.6, 'ok', 3.0], [2.2, 'down', 2.6], [0.8, 'ok', 2.8], [-0.5, 'lean', 2.5], [-1.8, 'ok', 2.9], [-3.0, 'posts', 2.7]];
  T.forEach(([z, st, h], i) => L.torii((rnd() - 0.5) * 0.15, 0, z, { w: 1.9 + 0.1 * (i % 3), h, state: st, rot: (rnd() - 0.5) * 0.06, color: i % 3 === 0 ? '#8f4a40' : i % 3 === 1 ? '#9a5a48' : '#7d4538' }));
  // ---- the hall: a tilted 4 x 5 m building 5 m tall on a stone base; moss roof, lattice doors, a rope with paper streamers
  const hl = group('lm04Hall'); L.use(hl); const HZ = -11.5;
  const hall = L.sub(0, 0, HZ, 0); hall.rotation.z = 0.045; hall.rotation.x = -0.02; L.use(hall);
  box(0, 0.4, 0, 4.8, 0.8, 5.8, '#6f7478', true, hall); box(0, 0.8 + 1.4, 0, 3.6, 2.8, 4.6, '#5a4538', true, hall);
  box(0, 0.8 + 1.4, 2.32, 2.6, 2.4, 0.08, '#2c2420', true, hall); for (let i = 0; i < 6; i++) box(-1.1 + i * 0.44, 0.8 + 1.4, 2.38, 0.05, 2.3, 0.04, '#6a5240', false, hall);
  L.gable(3.6, 4.6, 0.8 + 2.8, 1.9, 0.9, MOSSD, hall); L.gable(3.8, 4.8, 0.8 + 2.75, 1.85, 0.95, '#4a6a50', hall);
  box(0, 0.8 + 2.9, 2.6, 3.4, 0.12, 0.9, '#4a382b', true, hall);                                  // front eave beam
  box(0, 1.6, 3.0, 1.4, 0.8, 1.0, '#7a7d80', true, hall);                                         // offering platform
  // ---- rope across the front of the hall with 4 paper streamers (live, sway)
  const rope = mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 6), mat('#d8c9a0'), 0, 3.0, HZ + 3.1, false, hl); rope.rotation.z = PI / 2;
  // ---- the great tree beside the hall: a trunk 1.0 m thick, a canopy of cedar cones, shimenawa ring
  const tr = group('lm04Tree'); L.use(tr);
  L.tree(-4.2, 0, HZ - 0.8, { h: 13, kind: 'cedar' }); cyl(-4.2, 2.0, HZ - 0.8, 0.9, 4.0, '#4a4038', tr);
  const ring = mesh(new THREE.TorusGeometry(1.0, 0.07, 6, 18), mat('#d8c9a0'), -4.2, 1.9, HZ - 0.8, false, tr); ring.rotation.x = PI / 2;
  for (const [x, z, h, k] of [[5.0, -4.0, 8, 'cedar'], [6.5, -9.5, 9, 'cedar'], [-6.5, -2.5, 6, 'round'], [4.5, -12.5, 7, 'round'], [-7.5, -9, 7, 'cedar'], [7.2, 3.5, 6.5, 'round'], [-7.0, 8.0, 7, 'cedar'], [6.8, 9.5, 8, 'cedar']]) L.tree(x, 0, z, { h, kind: k });
  // ---- stones: komainu pair, three stone Buddhas, the dry basin, lanterns
  const sn = group('lm04Stones'); L.use(sn);
  for (const sx of [-1, 1]) { box(sx * 1.9, 0.3, -5.0, 0.7, 0.6, 0.9, '#7d8083', true, sn); mesh(new THREE.SphereGeometry(0.28, 8, 6), mat('#868a8c'), sx * 1.9, 0.9, -4.9, true, sn); box(sx * 1.9, 0.78, -5.35, 0.4, 0.35, 0.5, '#868a8c', true, sn); box(sx * 1.9, 0.05, -5.0, 0.9, 0.1, 1.1, MOSS, false, sn); }
  [[-3.4, -6.5], [-3.9, -4.0], [3.6, -7.0]].forEach(([x, z], i) => { box(x, 0.25, z, 0.5, 0.5, 0.4, '#7d8083', true, sn); mesh(new THREE.SphereGeometry(0.19, 8, 6), mat('#868a8c'), x, 0.7, z, true, sn); box(x, 0.45, z + 0.12, 0.4, 0.5, 0.3, i % 2 ? '#868a8c' : '#7d8083', true, sn); });
  box(3.4, 0.35, -1.0, 1.1, 0.7, 0.9, '#767a7e', true, sn); mesh(new THREE.CylinderGeometry(0.4, 0.35, 0.16, 10), mat('#2a2e32'), 3.4, 0.72, -1.0, false, sn);   // dry temizuya basin
  cyl(3.9, 0.55, -1.0, 0.02, 1.1, '#9aa56e', sn);                                                                                       // a bamboo ladle laid against it
  const lamps = []; [[-1.6, 12.0, 0], [1.6, 10.5, 0], [-1.6, 6.0, 1], [1.6, 3.0, 0], [-1.6, -2.0, 0], [1.7, -6.5, 1]].forEach(([x, z, lit]) => lamps.push({ lb: L.lantern(x, 0, z, { k: 1, glowK: lit ? 0.22 : 0.0 }), lit }));
  box(0, 0.4, 11.4, 0.5, 0.8, 0.5, '#7d8083', true, sn);                                                                          // the sando's first marker stone
  // ---- live: fireflies (8), drips under the eaves (6), rope streamers (4)
  const lv = group('lm04Live'); L.use(lv);
  const ff = []; for (let i = 0; i < 8; i++) { const g = L.sub((rnd() - 0.5) * 9, 0, HZ + (rnd() - 0.2) * 7 + 3); g.userData.live = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), L.glowMat('#c8e8a0', 0.0)); g.add(m); ff.push({ g, m, ph: rnd() * 6.28, x0: g.position.x, z0: g.position.z, y0: 0.8 + rnd() * 1.8 }); }
  const dr = []; for (let i = 0; i < 6; i++) { const x = -1.9 + (i % 3) * 1.9, z = HZ + 2.9 + 0.25 * (i >> 1), g = L.sub(x * 1.0, 0, z); g.userData.live = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.28), new THREE.MeshBasicMaterial({ color: '#cfe4ee', transparent: true, opacity: 0.7, depthWrite: false })); g.add(m); dr.push({ g, m, ph: rnd() }); }
  const st = []; for (let i = 0; i < 4; i++) { const g = L.sub(-1.2 + i * 0.8, 2.9, HZ + 3.12); g.userData.live = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.6), new THREE.MeshBasicMaterial({ color: '#e8e4d8', side: THREE.DoubleSide })); m.position.y = -0.3; g.add(m); st.push({ g, m, ph: i * 1.1 }); }
  out.stats = { torii: T.length, toriiH: [Math.min(...T.map(t => t[2])), Math.max(...T.map(t => t[2]))], toriiStates: [...new Set(T.map(t => t[1]))], sandoLength: 17 - -8.0, hallZ: HZ, hallSize: [4, 5, 5], lanterns: lamps.length, litLanterns: lamps.filter(l => l.lit).length, fireflies: ff.length, drips: dr.length };
  out.update = (t) => {
    ff.forEach(f => { const p = t * 0.2 + f.ph; f.g.position.set(f.x0 + Math.sin(p * 1.7) * 1.2, f.y0 + Math.sin(p * 2.3) * 0.4, f.z0 + Math.cos(p * 1.3) * 1.2); f.m.material.opacity = 0.5 * Math.max(0, Math.sin(t * 0.7 + f.ph * 3)) ** 2; });
    dr.forEach(d => { const p = (t * 0.9 + d.ph) % 1; d.g.position.y = 2.9 - p * 2.1; d.m.material.opacity = 0.7 * (p < 0.9 ? 1 : (1 - p) * 10); });
    st.forEach(s => { s.g.rotation.x = Math.sin(t * 0.8 + s.ph) * 0.08; });
  };
  return out;
};
