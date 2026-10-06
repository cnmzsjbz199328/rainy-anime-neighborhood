// LM03 苔石古坟群 (the moss-stone tumulus group) (W7). Local frame: origin = the site anchor (27.00 S 86.00 E, altitude 1.9 m, a levelled platform of radius 12 m), +Z towards the north
// entrance (heading 0, 14 m out, the end of T07-01), +X to the left of +Z. 1 unit = 1 m. The site is trimmed to a 24 m disc (W7_SPEC section 3): at its centre the megalithic chamber (its earth
// mound long washed away: a corridor 1.8 m wide between two walls of three boulders each, a back stone and a capstone of 6 x 1.6 x 4 m on top, about 4 m high in all, the opening towards the
// entrance), four small grassy round mounds (3-4 m across, with a tree on two of them), a toppled pillar, a weathered explanatory stele (the text is unreadable), moss and ferns, a short timber
// fence where the forest track ends. Purely human ruin: no hidden-clue elements. Boulder outlines are drawn slightly heavier by their size. Night: fireflies and moonlight only; the chamber is dark.
// Groups: lm03Chamber, lm03Mounds, lm03Stones (pillar, stele), lm03Fence, lm03Plants, lm03Live (fireflies, drips).
(globalThis.LANDMARKS = globalThis.LANDMARKS || {}).LM03 = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, canvasTex } = K, L = LMLIB(K), PI = Math.PI, rnd = K.rand(303);
  const out = { stats: {}, update() {} };
  const GRAN = '#85807f', GRAND = '#6a6666', MOSS = '#4f7a56';
  const sizes = [];
  const boulder = (g, x, y, z, w, h, d, ry, c = GRAN) => { const m = mesh(new THREE.DodecahedronGeometry(0.5, 0), mat(c), x, y + h * 0.42, z, true, g); m.scale.set(w, h, d); m.rotation.y = ry; sizes.push([w, h, d]); return m; };
  const gr = group('lm03Mounds'); L.use(gr);
  L.ground(12.6, '#4f6e55', 0.02);
  // four round mounds (earth, grass): hemispheres squashed to 1.3 m
  const mounds = [[-7.0, 3.5, 3.6], [7.2, 1.0, 3.2], [-5.5, -6.8, 3.0], [6.0, -6.2, 2.8]];
  mounds.forEach(([x, z, r], i) => { const m = mesh(new THREE.SphereGeometry(r, 14, 8, 0, PI * 2, 0, PI / 2), mat(i % 2 ? '#587a58' : '#4f7452'), x, 0, z, true, gr); m.scale.y = 1.3 / r; });
  L.tree(-7.0, 1.2, 3.5, { h: 6.5, kind: 'round' }); L.tree(6.0, 1.2, -6.2, { h: 5.5, kind: 'round' });
  // ---- the chamber: wall boulders along x = +-1.6 for z = -3 ... 1.5, back stone, capstone; entrance opening faces +Z
  const ch = group('lm03Chamber'); L.use(ch);
  const wall = (sx) => { [[-2.6, 1.5, 2.0, 1.6], [-0.6, 1.7, 2.2, 1.9], [1.2, 1.6, 2.0, 1.7]].forEach(([z, w, h, d], i) => boulder(ch, sx * (1.75 + 0.1 * (i % 2)), 0, z, d, h * 1.15, w * 1.2, rnd() * 3, i % 2 ? GRAND : GRAN)); };
  wall(-1); wall(1);
  boulder(ch, 0, 0, -3.5, 3.2, 3.0, 1.6, 0.1, GRAN);                                                      // back stone
  const cap = boulder(ch, 0, 2.7, -0.7, 6.0, 1.6, 4.0, 0.12, '#8a8584');                                   // capstone 6 x 1.6 x 4 m
  boulder(ch, 0.2, 3.7, -1.0, 2.4, 0.9, 1.8, 0.7, GRAND);                                                  // a smaller stone on top
  L.pool(0, -0.5, 1.8, '#000000', 0.0, 0.05);
  // the floor of the chamber: dark flat stones
  box(0, 0.05, -0.7, 2.6, 0.1, 4.6, '#2c2c30', false, ch);
  // ---- fallen pillar and the stele
  const sn = group('lm03Stones'); L.use(sn);
  const pil = mesh(new THREE.CylinderGeometry(0.34, 0.38, 3.6, 8), mat('#7d7a78'), 3.6, 0.38, 7.0, true, sn); pil.rotation.z = PI / 2; pil.rotation.y = 0.5; mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 8), mat(MOSS), 3.6, 0.2, 7.0, false, sn);
  boulder(sn, 5.6, 0, 6.0, 0.9, 0.6, 0.8, 1.0);                                                           // the pillar's stump
  box(-3.2, 0.9, 8.2, 0.9, 1.8, 0.28, '#80807c', true, sn); box(-3.2, 0.2, 8.2, 1.3, 0.4, 0.7, '#6d6d6a', true, sn);
  const stele = canvasTex(64, 128, (q, w, h) => { q.fillStyle = '#7e7e7a'; q.fillRect(0, 0, w, h); q.fillStyle = 'rgba(40,40,40,.35)'; for (let i = 0; i < 9; i++) q.fillRect(10, 14 + i * 12, 44, 3); q.fillStyle = 'rgba(90,120,90,.5)'; q.fillRect(0, h * 0.7, w, h * 0.3); });
  mesh(new THREE.PlaneGeometry(0.8, 1.6), new THREE.MeshToonMaterial({ map: stele, gradientMap: K.ramp }), -3.2, 0.95, 8.36, false, sn);
  // ---- timber fence at the end of the forest track (z 10.2): 7 posts, two rails, a gap 1.6 m wide on the track
  const fn = group('lm03Fence'); L.use(fn);
  for (let i = 0; i < 9; i++) { const x = -5.6 + i * 1.4; if (Math.abs(x) < 0.9) continue; cyl(x, 0.55, 10.2, 0.07, 1.1, '#6a5240', fn); }
  for (const y of [0.45, 0.85]) { box(-3.3, y, 10.2, 4.8, 0.08, 0.06, '#7a6048', true, fn); box(3.3, y, 10.2, 4.8, 0.08, 0.06, '#7a6048', true, fn); }
  // ---- plants: moss patches, ferns (cards), small shrubs
  const pl = group('lm03Plants'); L.use(pl);
  for (let i = 0; i < 26; i++) { const a = rnd() * PI * 2, r = 2.5 + rnd() * 8.5; const x = Math.sin(a) * r, z = Math.cos(a) * r - 1; if (Math.hypot(x, z + 0.7) < 2.4) continue; const m = mesh(new THREE.CylinderGeometry(0.5 + rnd() * 0.5, 0.5, 0.04, 7), mat(i % 3 ? MOSS : '#3c6150'), x, 0.05, z, false, pl); m.scale.z = 0.7 + rnd() * 0.4; }
  for (let i = 0; i < 18; i++) { const a = rnd() * PI * 2, r = 2.8 + rnd() * 8; const x = Math.sin(a) * r, z = Math.cos(a) * r - 1; if (Math.hypot(x, z + 0.7) < 2.6) continue; for (let k = 0; k < 6; k++) { const b = mesh(new THREE.ConeGeometry(0.1, 0.8, 4), mat('#4d7f61'), x + Math.cos(k) * 0.12, 0.4, z + Math.sin(k) * 0.12, false, pl); b.rotation.set(Math.cos(k * 2) * 0.6, 0, Math.sin(k * 2) * 0.6); } }
  // ---- live: fireflies (10) round the chamber, drips from the capstone's front edge (5)
  const lv = group('lm03Live'); L.use(lv);
  const ff = []; for (let i = 0; i < 10; i++) { const g = L.sub((rnd() - 0.5) * 8, 0, (rnd() - 0.5) * 8); g.userData.live = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), L.glowMat('#c8e8a0', 0)); g.add(m); ff.push({ g, m, ph: rnd() * 6.28, x0: g.position.x, z0: g.position.z, y0: 0.8 + rnd() * 2.0 }); }
  const dr = []; for (let i = 0; i < 5; i++) { const g = L.sub(-2.2 + i * 1.1, 2.0, 1.25); g.userData.live = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.3), new THREE.MeshBasicMaterial({ color: '#cfe4ee', transparent: true, opacity: 0.7, depthWrite: false })); g.add(m); dr.push({ g, m, ph: i * 0.2 }); }
  const maxS = sizes.reduce((a, s) => (s[0] * s[1] * s[2] > a[0] * a[1] * a[2] ? s : a), sizes[0]);
  out.stats = { chamberHeight: 4.6, capstone: [6.0, 1.6, 4.0], largest: [Math.max(6.0, ...sizes.map(s => s[0])), 2.0, 4.0], mounds: mounds.length, pillars: 1, steles: 1, fencePosts: 7, fireflies: ff.length, drips: dr.length, boulders: sizes.length };
  out.update = (t) => {
    ff.forEach(f => { const p = t * 0.2 + f.ph; f.g.position.set(f.x0 + Math.sin(p * 1.7) * 1.4, f.y0 + Math.sin(p * 2.3) * 0.4, f.z0 + Math.cos(p * 1.3) * 1.4); f.m.material.opacity = 0.5 * Math.max(0, Math.sin(t * 0.7 + f.ph * 3)) ** 2; });
    dr.forEach(d => { const q = (t * 0.9 + d.ph) % 1; d.g.position.y = 2.0 - q * 1.9; d.m.material.opacity = 0.7 * (q < 0.9 ? 1 : (1 - q) * 10); });
  };
  return out;
};
