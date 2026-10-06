// LM05 星見石環 (the star-viewing stone ring) (W7, hidden clue 1). Local frame: origin = the site anchor (33.00 N 126.90 W, altitude 7.9 m: the flat top of the hill hill-lm05, platform radius
// 10 m), +Z towards the west entrance (heading 300, 12 m out, the end of the T08-02 stone stairs), +X to the left of +Z. 1 unit = 1 m. 13 IDENTICAL standing stones (3.2 high, 1.2 wide,
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
  const stoneGeo = new THREE.BoxGeometry(W0, H0, T0), mossGeo = new THREE.BoxGeometry(W0 + 0.02, H0 * 0.42, T0 + 0.02), capGeo = new THREE.BoxGeometry(W0 - 0.1, 0.12, T0 - 0.08);
  const stoneM = mat(GRAN), mossM = mat(MOSS);
  for (let k = 0; k < N; k++) {
    const a = (k + 0.5) * 2 * PI / N, x = Math.sin(a) * R0, z = Math.cos(a) * R0, ry = a;                                   // a = 0 is the +Z axis: the gap is on it
    const g = L.sub(x, 0, z, ry); mesh(stoneGeo, stoneM, 0, H0 / 2, 0, true, g); mesh(mossGeo, mossM, 0, H0 * 0.21, 0, false, g);
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
  out.stats = { stones: stones.map(s => ({ ...s })), N, radius: R0, centreDistance: 2 * R0 * Math.sin(PI / N), slab: [3.0, 2.0], period: CLUE.period, peak: CLUE.peak, color: CLUE.color, mossFraction: 0.42, identicalGeometry: true };
  out.update = (t) => { for (let k = 0; k < N; k++) { const e = CLUE.stone(k, t) * CLUE.peak; capMs[k].color.setRGB(col.r * e, col.g * e, col.b * e); caps[k].visible = e > 0.002; } };
  return out;
};
