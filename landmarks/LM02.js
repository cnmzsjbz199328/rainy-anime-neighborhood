// LM02 湯けむり温泉村 (Yu-kemuri hot-spring village) (W7). Local frame: origin = the site anchor (36.00 N 50.00 W, altitude 1.9 m, a levelled platform of radius 15 m with a 10 m
// transition), +Z towards the east entrance (heading 100, 17 m out, the end of RN05-01), +X to the left of +Z; the north-east entrance (heading 41, RN05-02's start) is at local (14.57, 8.76).
// 1 unit = 1 m. Six timber buildings (two 2-storey inns, three houses, a shop) lie round a small plaza along a brook; the open-air spring (5 x 4 m) with a bamboo fence, the source hut and
// its wooden flume, a foot bath, stone-slab paths, a plank bridge, paper lanterns, noren, the village torii, a bus stop and a vending machine. Existing interiors are only lit window panes;
// the WD upgrade target is town-grade construction and visible depth without changing placements. Groups: lm02Ground, lm02Houses, lm02Onsen (pool, hut, flume, fence), lm02Brook, lm02Street (torii, bus stop, vending, lanterns, bridge),
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
  const glass = new THREE.MeshPhysicalMaterial({ color: '#d9e3df', transparent: true, opacity: 0.27, roughness: 0.18, metalness: 0.05, side: THREE.DoubleSide, depthWrite: false });
  const identities = ['玄关旅馆', '溪畔旅馆', '厨居', '工具之家', '静居', '村口商店'];
  const villageHouse = (h, i) => {
    const g = L.sub(h.x, 0, h.z, h.ry), w = h.w, d = h.d, fl = h.floors, height = fl * 2.7, dark = '#473a30', trim = i === 1 ? '#695743' : '#584636';
    g.name = `lm02Building${i + 1}`; g.userData.identity = identities[i];
    const b = (x, y, z, a, c, e, color) => box(x, y, z, a, c, e, color, true, g);
    b(0, 0.1, 0, w + 0.3, 0.2, d + 0.3, '#6a6a68');
    for (let f = 0; f < fl; f++) {
      const y0 = 0.2 + f * 2.7, y1 = y0 + 2.7;
      b(0, y0 + 0.06, 0, w - 0.18, 0.12, d - 0.18, '#836d55');
      for (const side of [-1, 1]) {
        const z = side * d / 2, centers = side > 0 ? [-w * 0.31, 0, w * 0.31] : [-w * 0.26, w * 0.26];
        const openings = centers.map(cx => ({ cx, half: side > 0 && f === 0 && cx === 0 ? 0.56 : 0.53, bottom: side > 0 && f === 0 && cx === 0 ? y0 : y0 + 0.82, top: side > 0 && f === 0 && cx === 0 ? y0 + 2.1 : y0 + 1.92 }));
        let left = -w / 2;
        for (const o of openings) {
          const x0 = o.cx - o.half, x1 = o.cx + o.half;
          if (x0 > left) b((left + x0) / 2, (y0 + y1) / 2, z, x0 - left, 2.7, 0.16, h.wall);
          if (o.bottom > y0) b(o.cx, (y0 + o.bottom) / 2, z, o.half * 2, o.bottom - y0, 0.16, h.wall);
          if (o.top < y1) b(o.cx, (o.top + y1) / 2, z, o.half * 2, y1 - o.top, 0.16, h.wall);
          b(o.cx, o.top + 0.04, z, o.half * 2 + 0.14, 0.08, 0.23, trim);
          if (o.bottom > y0) {
            b(o.cx, o.bottom - 0.04, z, o.half * 2 + 0.16, 0.08, 0.26, trim);
            mesh(new THREE.BoxGeometry(o.half * 2 - 0.06, o.top - o.bottom - 0.1, 0.018), glass, o.cx, (o.bottom + o.top) / 2, z + side * 0.015, false, g);
            b(o.cx, (o.bottom + o.top) / 2, z + side * 0.04, 0.045, o.top - o.bottom, 0.06, dark);
          } else {
            b(o.cx - 0.48, y0 + 1.02, z + side * 0.04, 0.06, 1.93, 0.07, dark);
            b(o.cx + 0.48, y0 + 1.02, z + side * 0.04, 0.06, 1.93, 0.07, dark);
            b(o.cx, y0 + 1.08, z - side * 0.05, 0.94, 1.98, 0.07, i === 5 ? '#735943' : '#5a4333');
            b(o.cx + 0.38, y0 + 1.03, z + side * 0.01, 0.05, 0.12, 0.09, '#c4aa75');
          }
          left = x1;
        }
        if (left < w / 2) b((left + w / 2) / 2, (y0 + y1) / 2, z, w / 2 - left, 2.7, 0.16, h.wall);
      }
      for (const side of [-1, 1]) {
        const x = side * w / 2, zc = i === 1 ? -0.35 : 0;
        b(x, y0 + 1.35, (-d / 2 + zc - 0.53) / 2, 0.16, 2.7, d / 2 + zc - 0.53, h.wall);
        b(x, y0 + 1.35, (d / 2 + zc + 0.53) / 2, 0.16, 2.7, d / 2 - zc - 0.53, h.wall);
        b(x, y0 + 0.41, zc, 0.16, 0.82, 1.06, h.wall);
        b(x, y0 + 2.31, zc, 0.16, 0.78, 1.06, h.wall);
        mesh(new THREE.BoxGeometry(0.02, 1.0, 0.96), glass, x + side * 0.015, y0 + 1.36, zc, false, g);
        b(x + side * 0.03, y0 + 1.36, zc, 0.07, 1.08, 0.045, dark);
      }
      for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) b(x, y0 + 1.35, z, 0.16, 2.7, 0.16, dark);
      b(0, y0 + 2.62, 0, w - 0.12, 0.14, d - 0.12, '#806b52');
      // A visible near-window furnishing, clear central passage, and a rear partition on each floor.
      b(-w * 0.26, y0 + 0.77, d / 2 - 0.72, 1.0, 0.12, 0.58, i === 5 ? '#a18053' : '#715945');
      b(w * 0.22, y0 + 0.47, d / 2 - 1.0, 0.9, 0.14, 0.55, '#79604b');
      b(0, y0 + 1.2, -d / 2 + 0.85, w * 0.48, 2.0, 0.12, '#9b8970');
      b(w * 0.28, y0 + 0.88, -d / 2 + 0.5, 1.0, 1.55, 0.4, i === 5 ? '#89725a' : '#6f5843');
      if (fl > 1) {
        for (let s = 0; s < 7; s++) b(-w / 2 + 0.72, y0 + 0.28 + s * 0.32, -d / 2 + 0.85 + s * 0.28, 0.75, 0.1, 0.32, '#6d5742');
        b(-w / 2 + 0.25, y0 + 1.4, -d / 2 + 1.72, 0.08, 2.1, 2.0, dark);
      }
    }
    for (const z of [-d / 2, d / 2]) b(0, height + 0.17, z, w + 0.8, 0.14, 0.15, trim);
    L.gable(w, d, height + 0.2, fl > 1 ? 1.9 : 1.4, 0.5, i % 2 ? '#353a44' : '#3a3f4a', g);
    for (let k = 0; k < Math.floor(d / 0.48); k++) {
      const z = -d / 2 + (k + 0.5) * d / Math.floor(d / 0.48);
      for (const side of [-1, 1]) b(side * (w / 2 + 0.35), height + 0.17, z, 0.06, 0.05, 0.36, '#50535a');
    }
    b(0, 2.1, d / 2 + 0.22, 1.5, 0.12, 0.44, trim);
    b(0, 0.12, d / 2 + 0.6, 1.5, 0.12, 0.9, '#85817a');
    for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) {
      b(x, height / 2, -d / 2 - 0.12, 0.08, height, 0.09, trim);
      b(x, height + 0.08, -d / 2 - 0.13, 0.16, 0.16, 0.16, '#55555a');
    }
    if (i === 0) { // traditional inn: shoe bays and reception behind the genkan
      for (let k = 0; k < 4; k++) b(-w / 2 + 0.65 + k * 0.34, 0.58, d / 2 - 0.48, 0.29, 0.12, 0.34, '#9d805c');
      b(w / 2 - 1.15, 0.93, -0.35, 1.45, 0.16, 0.58, '#8c6d4d');
      b(0, 0.2, d / 2 + 0.67, 1.8, 0.06, 0.7, '#71543f');
    } else if (i === 1) { // creekside inn: long gallery and low tea seating
      b(0, 0.33, d / 2 + 0.37, w - 0.6, 0.12, 0.55, '#806b50');
      for (const x of [-w / 3, 0, w / 3]) b(x, 0.65, d / 2 + 0.55, 0.1, 0.72, 0.1, trim);
      b(0, 0.47, d / 2 - 1.2, 1.15, 0.12, 0.8, '#92785b');
    } else if (i === 2) { // family home: kitchen and vent on the service side
      b(w / 2 - 0.75, 0.9, -d / 2 + 1.1, 0.72, 0.12, 0.68, '#8c8b82');
      b(w / 2 - 0.75, 1.3, -d / 2 + 1.1, 0.36, 0.65, 0.36, '#575c5d');
    } else if (i === 3) { // tool-keeping home: enclosed side rack
      for (let k = 0; k < 3; k++) b(-w / 2 + 0.6, 0.48 + k * 0.42, -d / 2 + 0.8, 0.75, 0.08, 0.42, '#887056');
      b(-w / 2 + 0.6, 1.25, -d / 2 + 0.55, 0.05, 1.25, 0.08, '#4b5050');
    } else if (i === 4) { // quiet home: mostly unlit, a small reading table
      b(-0.9, 0.48, d / 2 - 1.05, 0.8, 0.1, 0.64, '#8f775b');
      b(-0.9, 0.8, d / 2 - 1.25, 0.11, 0.55, 0.11, '#bbb199');
    } else { // shop: display, rear stock and a framed sign
      for (let k = 0; k < 4; k++) b(-w / 2 + 0.65 + k * 0.37, 0.84, d / 2 - 0.57, 0.26, 0.38, 0.23, k % 2 ? '#a48b65' : '#8e7659');
      b(0, 2.42, d / 2 + 0.1, 1.9, 0.34, 0.1, '#ad9671');
      b(w / 2 - 0.8, 0.9, -d / 2 + 0.7, 0.7, 1.4, 0.5, '#715b45');
    }
    if (i !== 4) mesh(new THREE.BoxGeometry(0.7, 0.24, 0.08), warm('#f5c68a', 0.19), 0, 1.95, -d / 2 + 0.95, false, g);
    return g;
  };
  houses.forEach(villageHouse);
  // inn entrance canopy and a pair of lanterns at each inn (genkan)
  // ---- the open-air spring: a 5 x 4 m pool, stone rim, steaming; bamboo fence on three sides; the source hut and the flume
  const on = group('lm02Onsen'); L.use(on); const OX = -1.0, OZ = -2.0;
  box(OX, 0.04, OZ, 5.6, 0.08, 4.6, '#6f7378', true, on);
  for (const s of [-1, 1]) {
    box(OX + s * 2.65, 0.33, OZ, 0.3, 0.5, 4.6, '#7d8084', true, on);
    box(OX, 0.33, OZ + s * 2.15, 5.0, 0.5, 0.3, '#7d8084', true, on);
    box(OX + s * 2.65, 0.61, OZ, 0.4, 0.09, 4.7, '#9a9894', true, on);
  }
  box(OX, 0.61, OZ - 2.15, 5.0, 0.09, 0.4, '#9a9894', true, on);
  box(OX - 1.45, 0.61, OZ + 2.15, 2.1, 0.09, 0.4, '#9a9894', true, on);
  box(OX + 1.45, 0.61, OZ + 2.15, 2.1, 0.09, 0.4, '#9a9894', true, on);
  const water = mesh(new THREE.BoxGeometry(5.0, 0.04, 4.0), warm('#7fb3b8', 0.16), OX, 0.43, OZ, false, on);
  for (let step = 0; step < 3; step++) box(OX + 1.95, 0.15 + step * 0.13, OZ + 1.55 - step * 0.27, 0.85, 0.1, 0.29, '#8d8982', true, on);
  box(OX + 1.5, 0.13, OZ + 2.45, 1.7, 0.12, 0.26, '#777a7b', true, on);
  box(OX + 1.5, 0.2, OZ + 2.6, 1.45, 0.05, 0.09, '#5d676a', true, on); // overflow channel
  for (let i = 0; i < 9; i++) L.rock(OX + (i % 3 - 1) * 2.7 * (i < 3 ? 1 : 0.0) + (i >= 3 ? (i < 6 ? -2.8 : 2.8) : 0), 0.3, OZ + (i < 3 ? 2.3 : (i % 3 - 1) * 1.8), 0.7 + rnd() * 0.5, '#6f7378', rnd() * 6);
  for (let i = 0; i < 12; i++) { const t = i / 11; box(OX - 3.1, 0.9, OZ - 2.4 + t * 4.8, 0.08, 1.8, 0.12, '#9aa56e', true, on); }                 // bamboo fence, west side
  for (let i = 0; i < 12; i++) { const t = i / 11; box(OX - 3.1 + t * 6.2, 0.9, OZ - 2.6, 0.12, 1.8, 0.08, '#9aa56e', true, on); }                 // north side
  for (let i = 0; i < 6; i++) { const t = i / 5; box(OX + 3.1, 0.9, OZ - 2.4 + t * 2.0, 0.08, 1.8, 0.12, '#9aa56e', true, on); }                    // east side, open towards the plaza
  box(OX - 3.1, 1.85, OZ, 0.14, 0.1, 5.0, '#7a8a54', true, on); box(OX, 1.85, OZ - 2.6, 6.4, 0.1, 0.14, '#7a8a54', true, on);
  const hut = L.sub(OX - 6.2, 0, OZ - 3.4, 0.4); hut.name = 'lm02SourceHut';
  const hb = (x, y, z, w, h, d, c) => box(x, y, z, w, h, d, c, true, hut);
  hb(0, 0.1, 0, 2.8, 0.2, 2.6, '#77726a');
  for (const x of [-1.2, 1.2]) for (const z of [-1.1, 1.1]) hb(x, 1.35, z, 0.16, 2.5, 0.16, '#4f3d30');
  hb(0, 1.35, -1.1, 2.4, 2.5, 0.15, '#6f5c4a');
  hb(-1.2, 1.35, 0, 0.15, 2.5, 2.2, '#6f5c4a');
  hb(1.2, 0.73, 0, 0.15, 1.25, 2.2, '#6f5c4a');
  hb(1.2, 2.17, 0, 0.15, 0.86, 2.2, '#6f5c4a');
  mesh(new THREE.BoxGeometry(0.025, 0.9, 1.3), glass, 1.22, 1.57, 0, false, hut);
  hb(0, 2.58, 0, 2.7, 0.15, 2.5, '#594838');
  L.gable(2.6, 2.4, 2.7, 1.1, 0.35, '#3b4047', hut);
  hb(0, 0.2, 1.3, 1.05, 0.1, 0.55, '#807a70');
  hb(-0.35, 0.68, -0.35, 0.95, 1.05, 0.7, '#665d50'); // spring pump casing
  cyl(-0.35, 1.34, -0.35, 0.25, 0.26, '#727778', hut);
  cyl(0.05, 0.95, -0.35, 0.05, 1.1, '#777a77', hut);
  hb(0.45, 0.98, 0.25, 0.65, 0.09, 0.55, '#80684a'); // inspection bench
  hb(0.45, 1.36, -0.95, 0.8, 0.7, 0.12, '#5c5041');
  hb(0.45, 1.3, -0.85, 0.3, 0.09, 0.08, '#aa8660');
  // wooden flume: from the hut to the pool: a trough of planks on posts
  for (let i = 0; i < 6; i++) { const t = i / 5, x = OX - 5.0 + t * 2.0, z = OZ - 2.9 + t * 1.2; box(x, 1.1 - 0.12 * t * 2, z, 0.5, 0.14, 0.5, '#5a4a3c', true, on); if (i % 2 === 0) cyl(x, 0.55 - 0.12 * t, z, 0.06, 1.1, '#4a382b', on); }
  box(OX - 5.0, 1.08, OZ - 2.9, 0.48, 0.1, 0.14, '#a59b86', true, on);
  box(OX - 3.0, 0.91, OZ - 1.7, 0.38, 0.12, 0.3, '#a59b86', true, on);
  for (let i = 0; i < 4; i++) box(OX - 4.9 + i * 0.57, 0.99 - i * 0.05, OZ - 2.83 + i * 0.34, 0.06, 0.04, 0.52, '#a58b67', true, on); // trough bindings
  for (const [x, z] of [[OX - 3.1, OZ - 2.6], [OX + 3.1, OZ - 2.6], [OX - 3.1, OZ + 2.4]]) {
    box(x, 0.08, z, 0.32, 0.16, 0.32, '#777a73', true, on);
    box(x, 0.9, z, 0.04, 0.1, 0.28, '#a68c62', true, on);
  }
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
  for (const px of [0.92, 2.08]) { box(px, 0.22, bz, 0.12, 0.15, 2.9, '#4b3e33', true, bk); for (const pz of [-1.2, 1.2]) box(px, 0.07, bz + pz, 0.3, 0.14, 0.4, '#77716a', true, bk); }
  for (const pz of [-0.9, 0, 0.9]) box(1.5, 0.26, bz + pz, 1.45, 0.1, 0.08, '#4e4033', true, bk);
  // ---- the street furniture: village torii, bus stop, vending machine, paper lanterns, noren
  const st = group('lm02Street'); L.use(st);
  L.torii(0, 0, 13.5, { w: 3.2, h: 3.4, rot: 0, color: '#8f4a40' });
  box(3.4, 0.9, 14.2, 0.06, 1.8, 0.06, '#7d8794', false, st); box(3.4, 1.75, 14.2, 0.7, 0.5, 0.04, '#e4e8ee', false, st); box(3.4, 1.85, 14.22, 0.7, 0.1, 0.05, '#d58a3a', false, st);   // bus stop sign
  box(3.4, 0.25, 15.3, 1.6, 0.12, 0.5, '#8a6a4c', true, st); box(3.4, 0.6, 15.6, 1.6, 0.6, 0.06, '#8a6a4c', true, st);                                    // its bench
  box(-3.4, 0.9, 14.0, 0.9, 1.8, 0.8, '#5e6a74', true, st); mesh(new THREE.BoxGeometry(0.72, 1.3, 0.03), warm('#dfe9f2', 0.20), -3.4, 1.0, 14.42, false, st);         // vending machine (cool light)
  box(3.4, 0.06, 14.2, 0.32, 0.12, 0.32, '#767a77', true, st);
  for (const bx of [2.75, 4.05]) box(bx, 0.26, 15.3, 0.09, 0.4, 0.45, '#66513e', true, st);
  box(-3.4, 0.08, 14.0, 1.02, 0.16, 0.94, '#777a78', true, st);
  for (let k = 0; k < 3; k++) box(-3.63 + k * 0.23, 1.44, 14.45, 0.18, 0.25, 0.035, k % 2 ? '#b4a17c' : '#9ab4b3', true, st);
  for (let k = 0; k < 4; k++) box(-3.64 + k * 0.16, 0.95, 14.46, 0.07, 0.05, 0.04, '#8c9298', true, st);
  box(-3.1, 0.9, 14.47, 0.12, 0.24, 0.06, '#9ba1a2', true, st); // payment panel
  box(-3.4, 0.43, 14.47, 0.42, 0.18, 0.07, '#303b43', true, st); // pickup door
  box(-3.4, 1.1, 13.56, 0.7, 0.65, 0.04, '#444f55', true, st); // rear service hatch
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
