// LM06 砂没驿与半埋巨碑 (the sand-swallowed station and the half-buried monolith) (W7, hidden clue 2). Local frame: origin = the site anchor (32.00 S 115.00 W, altitude 1.9 m, a levelled
// platform of radius 15 m in the desert), +Z towards the north entrance (heading 0, 17 m out, the end of T09-01), +X to the left of +Z. 1 unit = 1 m. First of all a forgotten Japanese country
// station: a platform 15 m long of which only the edge shows between sand drifts, a 3 x 2.5 m waiting shed whose roof has half fallen in, a faded name board (no readable letters), one rusted
// single car 12 m long on a track that is half buried and runs into a dune, a signal lying on its side, sand sliding slowly off the car roof. Then, 25 m away along -Z on its own flat
// round disc of sand (radius 4 m: too regular for the wind), the monolith: 7.0 m above the sand, 2.5 m wide, 0.8 m thick, near-black, leaning 8 degrees, smooth as new, drawn with one clean straight
// outline: no marks, no letters. Its only light is the 20 s clue glow (landmarks/LM00_clue.js), synchronised with LM05 and LM07: a cold outline and a faint halo card, peak below any street lamp.
// The monolith lies beyond the 15 m site circle by design (W7_SPEC section 3). Groups: lm06Ground, lm06Station, lm06Car, lm06Track, lm06Mono, lm06Live (sand, the glow).
(globalThis.LANDMARKS = globalThis.LANDMARKS || {}).LM06 = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, canvasTex } = K, L = LMLIB(K), PI = Math.PI, rnd = K.rand(606);
  const out = { stats: {}, update() {} };
  const G = L.groundFn(rec), gy = (x, z) => G(x, z);
  const SAND = '#8f8896', SANDL = '#9d96a3', RUST = '#8a4a3a', WOOD = '#6f655c';
  const gr = group('lm06Ground'); L.use(gr);
  L.ground(15.6, SAND, 0.03);
  // sand drifts: squashed spheres of sand colour over the ends of the platform, the track, the shed's foot
  const drift = (x, z, rx, rz, h, c = SANDL) => { const m = mesh(new THREE.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI / 2), mat(c), x, 0.0, z, false, gr); m.scale.set(rx, h, rz); return m; };
  [[-9.2, -2.0, 3.2, 2.6, 1.1], [9.0, -2.2, 3.0, 2.4, 0.9], [10.5, -6.2, 4.0, 3.0, 1.2], [-10.8, -6.0, 3.4, 2.8, 1.0], [-6.8, 0.6, 2.0, 1.4, 0.45], [3.6, -4.2, 2.0, 1.2, 0.35], [-1.0, 5.0, 2.6, 1.6, 0.3], [5.0, 9.0, 3.0, 2.0, 0.35], [-6.0, 10.0, 2.6, 1.8, 0.3]].forEach(a => drift(...a));
  // ---- the station: platform (x -7.5..7.5, z -3.3..-0.7), 0.35 m proud of the ground, the central 8 m clear of sand
  const st = group('lm06Station'); L.use(st);
  box(0, 0.17, -2.0, 15, 0.34, 2.6, '#8d9094', true, st); box(0, 0.36, -3.15, 15, 0.04, 0.3, '#b9a24a', false, st);
  // the shed 3 x 2.5 m on the platform's west part, its roof half fallen in: the east slope still on, the west one down inside
  const SX = -3.8, SZ = -2.0;
  box(SX, 0.35 + 1.1, SZ, 3.0, 2.2, 2.5, WOOD, true, st); box(SX, 0.35 + 1.1, SZ + 1.27, 2.0, 1.7, 0.05, '#2a2420', false, st);
  { const rf = mesh(new THREE.BoxGeometry(2.0, 0.1, 3.0), mat('#4a4f58'), SX + 0.75, 0.35 + 2.2 + 0.5, SZ, true, st); rf.rotation.z = -0.5; const rf2 = mesh(new THREE.BoxGeometry(1.7, 0.1, 2.9), mat('#3d424a'), SX - 0.7, 0.35 + 1.6, SZ, true, st); rf2.rotation.z = 0.95; rf2.rotation.x = 0.1; }
  for (let i = 0; i < 7; i++) box(SX - 1.2 + i * 0.4, 0.35 + 1.1, SZ + 1.28, 0.06, 2.1, 0.04, '#3a3029', false, st);                                    // vertical boards on the front
  box(SX, 0.35 + 2.3, SZ - 1.1, 3.3, 0.1, 0.12, '#4a382b', true, st); box(SX + 1.2, 0.35 + 1.3, SZ - 1.1, 0.12, 2.6, 0.12, '#4a382b', true, st);
  // the faded name board: a post with a pale board, no text (a smear of blotches only)
  const bt = canvasTex(128, 64, (q, w, h) => { q.fillStyle = '#c9c4b8'; q.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '120,110,100' : '230,226,214'},${0.15 + rnd() * 0.2})`; q.fillRect(rnd() * w, rnd() * h, 8 + rnd() * 26, 3 + rnd() * 9); } });
  cyl(2.6, 0.35 + 1.0, -1.0, 0.05, 2.0, '#5a4a3c', st); const bd = mesh(new THREE.BoxGeometry(1.6, 0.6, 0.05), new THREE.MeshToonMaterial({ map: bt, gradientMap: K.ramp }), 2.6, 0.35 + 2.0, -1.0, true, st); bd.rotation.z = 0.05;
  // a signal lying on its side
  { const sp = mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.0, 6), mat('#6a6e72'), 6.0, 0.12, 2.0, true, st); sp.rotation.z = PI / 2 - 0.05; sp.rotation.y = 0.4; const sh = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.25), mat('#4a4f56'), 4.6, 0.2, 1.4, true, st); sh.rotation.y = 0.4; }
  // ---- the track and the single car (12 m, rusted); rails and sleepers end under a dune on the east, and are cut off on the west
  const tk = group('lm06Track'); L.use(tk); const TZ = -6.0;
  for (let x = -9.0; x <= 6.4; x += 0.7) box(x, 0.06, TZ, 0.2, 0.1, 1.5, '#4a382b', false, tk).rotation.y = (rnd() - 0.5) * 0.06;
  for (const dz of [-0.72, 0.72]) box(-1.3, 0.18, TZ + dz, 15.6, 0.08, 0.07, '#7a5a4a', false, tk);
  const car = group('lm06Car'); L.use(car); const CX = -1.0, CL = 12;
  box(CX, 1.35, TZ, CL, 2.2, 2.6, RUST, true, car); box(CX, 0.7, TZ, CL + 0.02, 0.4, 2.64, '#6e3a30', false, car); box(CX, 2.55, TZ, CL - 0.6, 0.18, 2.3, '#7a6a5a', true, car);
  for (let i = 0; i < 7; i++) box(CX - 5.1 + i * 1.7, 1.7, TZ + 1.31, 1.0, 0.7, 0.05, i % 3 === 1 ? '#201e22' : '#3a3438', false, car);         // dark windows, a few broken
  for (const bx of [CX - 4.5, CX + 4.5]) for (const dz of [-0.9, 0.9]) cyl(bx, 0.22, TZ + dz, 0.45, 0.4, '#3a2e2a', car).rotation.x = PI / 2;
  drift(CX - 4.5, TZ + 1.2, 3.0, 1.1, 0.5, SAND); drift(CX + 5.2, TZ + 1.0, 3.2, 1.3, 0.6, SAND);                                                     // the car stands in sand
  // ---- the monolith, 25 m away on -Z: a flat disc of smoother, paler sand r = 4, then the slab
  const mo = group('lm06Mono'); L.use(mo); const MZ = -25, M0 = gy(0, MZ);
  { const d = mesh(new THREE.CircleGeometry(4.0, 40), mat('#a39cab'), 0, M0 + 0.05, MZ, false, mo); d.rotation.x = -PI / 2; const d2 = mesh(new THREE.RingGeometry(4.0, 5.0, 40), mat('#9a93a2'), 0, M0 + 0.04, MZ, false, mo); d2.rotation.x = -PI / 2; }
  const TILT = 0.14, EXP = 7.0, LEN = EXP / Math.cos(TILT) + 1.5, MW = 2.5, MT = 0.8;
  const pivot = L.sub(0, M0 - 1.5, MZ, 0); pivot.rotation.x = 0; L.use(pivot);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(MW, LEN, MT), new THREE.MeshToonMaterial({ color: '#17181d', gradientMap: K.ramp })); slab.position.y = LEN / 2; slab.rotation.z = 0; pivot.add(slab);
  pivot.rotation.z = TILT; slab.add(new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), new THREE.LineBasicMaterial({ color: '#05060a', transparent: true, opacity: 0.9 })));
  // ---- live: the glow of the clue (an outline and a faint halo card on the monolith, both cold), sand sliding off the car roof (6 grains-cards), the sand drifts' dust
  const lv = group('lm06Live'); L.use(lv);
  const col = new THREE.Color(CLUE.color);
  const gw = L.sub(0, M0 - 1.5, MZ, 0); gw.rotation.z = TILT;
  const outMat = new THREE.LineBasicMaterial({ color: '#000000', transparent: true, opacity: 1, depthWrite: false, fog: false }), halo = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide });
  const ol = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(MW + 0.06, LEN + 0.06, MT + 0.06)), outMat); ol.position.y = LEN / 2; ol.renderOrder = 8; gw.add(ol);
  const hc = new THREE.Mesh(new THREE.BoxGeometry(MW + 0.5, LEN + 0.3, MT + 0.5), halo); hc.position.y = LEN / 2 + 0.1; hc.renderOrder = 7; gw.add(hc);                 // an inverted hull: only a rim shows around the black slab
  const sand = []; for (let i = 0; i < 6; i++) { const g = L.sub(CX - 4 + i * 1.6, 2.6, TZ + 1.3); g.userData.live = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.35), new THREE.MeshBasicMaterial({ color: '#b3a58e', transparent: true, opacity: 0.55, depthWrite: false })); g.add(m); sand.push({ g, m, ph: i * 0.19 }); }
  out.stats = { platformLength: 15, shed: [3, 2.5], car: 12, monolith: { exposed: EXP, width: MW, thickness: MT, tilt: TILT, z: MZ, ground: M0, disc: 4 }, distance: Math.abs(MZ), period: CLUE.period, peak: CLUE.peak, color: CLUE.color };
  out.update = (t) => { const e = CLUE.slab(t) * CLUE.peak; outMat.color.setRGB(col.r * e, col.g * e, col.b * e); halo.color.setRGB(col.r * e * 0.6, col.g * e * 0.6, col.b * e * 0.6);
    sand.forEach(s => { const p = (t * 0.12 + s.ph) % 1; s.g.position.y = 2.6 - p * 1.9; s.g.position.z = TZ + 1.3 + p * 0.9; s.m.material.opacity = 0.55 * Math.sin(PI * p); }); };
  return out;
};
