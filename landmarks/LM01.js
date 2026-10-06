// LM01 雨見岳 (Ame-mi-dake): the dormant volcano's summit (W7). Local frame: origin = the anchor on the summit (56.00 N 25.00 W, altitude 26.0 m, the highest point of the planet),
// +Z towards the west entrance (heading 300, 10 m out, the end of the T02-02 stone stairs), +X to the left of +Z. 1 unit = 1 m. The mountain itself is terrain (ameni-dake,
// radius 28 m, flat top radius 4.2 m, snow above 20 m from terrain.js); this module replaces the summit inside r = 8 m: a crater of 12 m across (rim, ash floor, lake, two vents with thin
// steam), the small shrine and the stone marker beside the stairs' last flight, and the stone lanterns of the path (<= 10, weak warm light). The north entrance (T10-01) is at the foot
// of the mountain and is not part of the summit model. Groups: lm01Rim, lm01Crater (floor, lake, ember), lm01Vent (live steam), lm01Shrine, lm01Path (steps, marker, lanterns).
(globalThis.LANDMARKS = globalThis.LANDMARKS || {}).LM01 = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm } = K, L = LMLIB(K), PI = Math.PI, rnd = K.rand(101);
  const out = { stats: {}, update() {} };
  // ---- crater rim: 28 rocks round r = 5.6 (inner radius 5.1, outer 6.4), heights 0.5-1.3 m; a gap in the rim towards the entrance side (the path comes in over the lowest block)
  const rim = group('lm01Rim'); L.use(rim);
  const N = 28; let rimMax = 0;
  for (let i = 0; i < N; i++) { const a = i / N * PI * 2, r = 5.6 + (rnd() - 0.5) * 0.5, h = 0.6 + 0.7 * rnd() * (Math.abs(a - 0) < 0.35 ? 0.3 : 1), s = 1.1 + 0.8 * rnd(); L.rock(Math.sin(a) * r, 0, Math.cos(a) * r, s, ['#6f6b78', '#7a7684', '#5f5b68'][i % 3], a, Math.max(0.35, h / s)); rimMax = Math.max(rimMax, h); }
  for (let i = 0; i < 9; i++) { const a = rnd() * PI * 2, r = 6.4 + rnd() * 1.2; L.rock(Math.sin(a) * r, 0, Math.cos(a) * r, 0.5 + rnd() * 0.6, '#6f6b78', a, 0.6); }
  // ---- crater floor, lake, vents, ember
  const cr = group('lm01Crater'); L.use(cr);
  L.ground(5.2, '#4a4650', 0.08); const lake = mesh(new THREE.CircleGeometry(3.4, 36), warm('#1e3446', 0.10), -0.4, 0.16, -0.3, false, cr); lake.rotation.x = -PI / 2;
  const lake2 = mesh(new THREE.RingGeometry(3.4, 3.8, 36), mat('#6a7a86'), -0.4, 0.15, -0.3, false, cr); lake2.rotation.x = -PI / 2;
  // ember: the faint dark-red glow of the crater (WORLD_SPEC: much weaker than any street lamp); a single additive disc under the rim
  const emberMat = L.glowMat('#7a2a1e', 0.10), ember = mesh(new THREE.PlaneGeometry(10, 10), emberMat, 0.2, 0.30, 0.1, false, cr); ember.rotation.x = -PI / 2;
  const ventPos = [[2.6, 1.8], [-3.0, -2.4]];
  for (const [x, z] of ventPos) { cyl(x, 0.08, z, 0.55, 0.3, '#8a8570', cr); mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.04, 8), mat('#d6cf8a'), x, 0.4, z, false, cr); }
  // ---- steam: two thin plumes (live group)
  const vent = group('lm01Vent'); L.use(vent); const plumes = ventPos.map(([x, z]) => { const s = L.steam(x, 0.45, z, { n: 5, h: 3.2, speed: 0.05, s: 0.7, o: 0.17 }); return s; });
  // ---- the little shrine (hokora) on the rim beside the stairs, facing the entrance: base, a 1.3 m box, hip roof, a stone marker
  const sh = group('lm01Shrine'); L.use(sh);
  box(1.8, 0.2, 6.3, 1.5, 0.4, 1.4, '#8a8a88', true, sh); box(1.8, 0.4 + 0.65, 6.3, 1.1, 1.1, 1.0, '#6a5a4a', true, sh); box(1.8, 0.4 + 0.65, 6.81, 0.5, 0.8, 0.04, '#2c2a30', false, sh);
  const roof = mesh(new THREE.ConeGeometry(1.0, 0.7, 4), mat('#4a5058'), 1.8, 0.4 + 1.1 + 0.35, 6.3, true, sh); roof.rotation.y = PI / 4; cyl(1.8, 2.3, 6.3, 0.05, 0.3, '#5a5a58', sh);
  L.torii(1.8, 0, 8.2, { w: 1.5, h: 2.1, rot: 0 });
  // ---- path: the last 9 steps up the rim, a stone marker, lanterns at z = 6.8 ... 10 (5 of them, <= 10), the stairs come from +Z
  const path = group('lm01Path'); L.use(path);
  L.steps(-0.4, 0, 6.0, 6, 1.6, 0.34, 0.17, '#6d7468');
  box(-1.9, 0.6, 8.6, 0.35, 1.2, 0.35, '#8a8a88', true, path); box(-1.9, 1.25, 8.6, 0.45, 0.1, 0.45, '#9a9a96', true, path);
  const lanterns = []; [[-1.7, 7.0], [0.9, 8.0], [-1.7, 9.0], [0.9, 10.0], [-1.7, 5.4]].forEach(([x, z], i) => lanterns.push(L.lantern(x, -0.4 - i * 0.0, z, { k: 1, glowK: 0.22 })));
  out.stats = { lanterns: lanterns.length, rimBlocks: N, vents: ventPos.length, rimMax, emberOpacity: 0.10 };
  out.update = (t) => { for (const p of plumes) p.update(t); emberMat.opacity = 0.09 + 0.02 * Math.sin(t * 0.4); };
  return out;
};
