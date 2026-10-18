// LM05 星見石環 (the star-viewing stone ring) (W7, hidden clue 1). Local frame: origin = the site anchor (33.00 N 126.90 W, altitude 7.9 m: the flat top of the hill hill-lm05, platform radius
// 10 m), +Z towards the west entrance (heading 300, 12 m out, the end of the RN08-02 stone stairs), +X to the left of +Z. 1 unit = 1 m. 13 IDENTICAL standing stones (3.2 high, 1.2 wide,
// 0.6 thick, one geometry shared by all: that sameness is the clue) stand on a circle of radius 9 m, equally spaced (centre distance 2 x 9 x sin(pi/13) = 4.30 m), faces along the
// tangent, the gap between two of them opening on the entrance axis; moss only on the lower half of each stone, weathered but unchipped; in the middle a lying slab of about 3 x 2 m,
// smoother and darker than its surroundings, its edges perfectly straight; a trodden ring path between the stones; a small stone cut with concentric circles. Read first as an ancient
// monument: no saucers, no glowing lines. The hidden light: every 20 s a very faint cool cyan-white glow runs stone to stone round the ring (CLUE, landmarks/LM00_clue.js), synchronised with LM06
// and LM07; its peak is below any street lamp. Groups: lm05Ring, lm05Slab, lm05Path, lm05Live (the caps).
(globalThis.LANDMARKS = globalThis.LANDMARKS || {}).LM05 = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, canvasTex } = K, L = LMLIB(K), PI = Math.PI, rnd = K.rand(505);
  const out = { stats: {}, update() {} };
  const N = 13, R0 = 9.0, W0 = 1.2, H0 = 3.2, T0 = 0.6, GRAN = '#85807f', MOSS = '#3f6048';
  L.use(group('lm05Ring')); const rg = L.parent();
  L.ground(10.4, '#566f52', 0.02);
  const stones = [], caps = [];
  const mossGeo = new THREE.BoxGeometry(W0 + 0.02, H0 * 0.42, T0 + 0.02), capGeo = new THREE.BoxGeometry(W0 - 0.1, 0.12, T0 - 0.08);
  const stoneM = mat(GRAN), mossM = mat(MOSS);
  const profiles = [];
  const stoneGeometry = k => { const shape = new THREE.Shape(), v = 0.045 * Math.sin((k + 1) * 1.7), u = 0.04 * Math.cos((k + 1) * 2.3);
    const pts = [[-0.55, 0], [-0.59 + v, 0.7], [-0.57 - u, 1.55], [-0.53 + v, 2.5], [-0.55, H0], [0.55, H0], [0.54 + u, 2.52], [0.57 - v, 1.55], [0.58 + u, 0.75], [0.55, 0]];
    shape.moveTo(...pts[0]); for (const p of pts.slice(1)) shape.lineTo(...p); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T0, bevelEnabled: false, curveSegments: 1 }); geo.translate(0, 0, -T0 / 2);
    profiles.push(pts.map(p => p.map(q => Math.round(q * 1000) / 1000))); return geo; };
  for (let k = 0; k < N; k++) {
    const a = (k + 0.5) * 2 * PI / N, x = Math.sin(a) * R0, z = Math.cos(a) * R0, ry = a;                                   // a = 0 is the +Z axis: the gap is on it
    const g = L.sub(x, 0, z, ry); g.name = `lm05Stone${k + 1}`;
    mesh(stoneGeometry(k), stoneM, 0, 0, 0, true, g); mesh(mossGeo, mossM, 0, H0 * 0.21, 0, false, g);
    box(0, 0.035, 0, 1.45, 0.07, 0.86, k % 3 ? '#6c685c' : '#686659', false, g);
    for (const sx of [-1, 1]) { const spot = mesh(new THREE.DodecahedronGeometry(0.12, 0), mat(k % 2 ? '#5a7254' : '#596d52'), sx * 0.44, 0.16 + 0.06 * (k % 3), 0.28, false, g); spot.scale.set(1, 0.55, 0.7); }
    stones.push({ k, x, z, ry, w: W0, h: H0, t: T0 });
  }
  const sl = group('lm05Slab'); L.use(sl);
  box(0, 0.35, 0, 3.0, 0.7, 2.0, '#4f5258', true, sl); box(0, 0.72, 0, 2.9, 0.04, 1.9, '#3f4248', false, sl);               // smoother, darker top; straight edges
  // the trodden path: a ring of bare earth between the stones, and the way in from the entrance
  const pt = group('lm05Path'); L.use(pt);
  const ringGeo = new THREE.RingGeometry(R0 - 0.9, R0 + 0.9, 64); const pr = mesh(ringGeo, mat('#6a6252'), 0, 0.04, 0, false, pt); pr.rotation.x = -PI / 2;
  box(0, 0.045, R0 + 1.6, 1.4, 0.04, 3.4, '#6a6252', false, pt);
  // the small stone with concentric circles (a canvas texture on its top)
  const cc = canvasTex(128, 128, (q, w, h) => { q.fillStyle = '#7f7b7a'; q.fillRect(0, 0, w, h); q.strokeStyle = 'rgba(40,40,44,.65)'; q.lineWidth = 2.5; for (let i = 1; i <= 5; i++) { q.beginPath(); q.arc(w / 2, h / 2, i * 10, 0, PI * 2); q.stroke(); } });
  const cs = mesh(new THREE.BoxGeometry(0.9, 0.5, 0.8), new THREE.MeshToonMaterial({ map: cc, gradientMap: K.ramp }), -4.6, 0.25, 6.4, true, pt); cs.rotation.y = 0.5;
  // ---- live: one cold glow cap on every stone, own material (they pulse one after another)
  const lv = group('lm05Live'); L.use(lv);
  const capMs = [];
  for (const s of stones) { const g = L.sub(s.x, H0 + 0.02, s.z, s.ry); g.userData.live = true; const m = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 1, depthWrite: false }); const c = new THREE.Mesh(capGeo, m); c.renderOrder = 8; c.visible = false; g.add(c); capMs.push(m); caps.push(c); }
  const col = new THREE.Color(CLUE.color);
  out.stats = { stones: stones.map(s => ({ ...s })), N, radius: R0, centreDistance: 2 * R0 * Math.sin(PI / N), slab: [3.0, 2.0], period: CLUE.period, peak: CLUE.peak, color: CLUE.color, mossFraction: 0.42, distinctProfiles: new Set(profiles.map(p => JSON.stringify(p))).size };
  out.update = (t) => { for (let k = 0; k < N; k++) { const e = CLUE.stone(k, t) * CLUE.peak; capMs[k].color.setRGB(col.r * e, col.g * e, col.b * e); caps[k].visible = e > 0.002; } };
  return out;
};
