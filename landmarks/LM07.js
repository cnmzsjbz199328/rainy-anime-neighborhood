// LM07 冰封轮廓 (the ice-sealed outline) (W7, hidden clue 3). Local frame: origin = the site anchor (76.00 N 100.00 E, altitude 2.5 m, the ice sheet itself: no platform), +Z towards the west
// entrance (heading 280, 10 m out, the end of T10-01 and of the RD08 pole line), +X to the left of +Z. 1 unit = 1 m. Above the ice there is almost nothing: a half-buried faded-orange observation
// hut 4 x 3 m (antenna fallen across the roof, frosted window), a survey pole, a tripod with its instrument, snow banked on the weather side, a little snow mist drifting low. The clue is in
// the ice: a patch of clearer, deeper-cyan ice about 36 m across (a soft canvas texture on a mesh that follows the ground) and, under it, a regular hexagonal ring of circumradius 15 m
// (side 15 m) at a depth of 3 m: its shadow is painted into that texture at a contrast far below the ice's own unevenness, and a simple translucent hexagon mesh stands for it at y = -3
// (the ice is opaque in the renderer, so the mesh is the data, the texture is what shows). Every 20 s, for about 4 s, the ring gives off a very faint cold cyan-white light (CLUE,
// landmarks/LM00_clue.js), in step with LM05 and LM06. No letters, no sizes, nothing artificial above the ice but the hut, the poles and the tripod. Groups: lm07Ice, lm07Hut, lm07Gear, lm07Live.
(globalThis.LANDMARKS = globalThis.LANDMARKS || {}).LM07 = (K, rec) => {
  const { THREE, group, mesh, box, cyl, mat, warm, canvasTex } = K, L = LMLIB(K), PI = Math.PI, rnd = K.rand(707);
  const out = { stats: {}, update() {}, parts: {} };
  const G = L.groundFn(rec), gy = (x, z) => G(x, z);
  const ICE = '#d3e3ef', SNOW = '#e8f1f8', ORANGE = '#b9763f', DEEP = '#5d8fa3';
  const RC = 15, DEPTH = 3.0, SPAN = 18.5;                                                   // hexagon circumradius, depth, half size of the textured patch
  const ic = group('lm07Ice'); L.use(ic);
  // ---- the textured patch: a polar grid that follows the ground (0.04 m above it); texture = clearer deeper ice + the hexagon's shadow; a second texture (the ring alone) for the clue light
  const hexPath = (q, sc, cx, cy) => { for (let k = 0; k < 6; k++) { const a = k * PI / 3 + PI / 6, x = cx + Math.sin(a) * RC * sc, y = cy + Math.cos(a) * RC * sc; k ? q.lineTo(x, y) : q.moveTo(x, y); } q.closePath(); };
  const TS = 512, SC = TS / (2 * SPAN);
  const blur = (q, px) => { try { q.filter = `blur(${px}px)`; } catch (e) { /* no canvas filters: the strokes stay sharp-edged but very pale */ } };
  const drawPatch = ring => (q, w, h) => {
    q.clearRect(0, 0, w, h);
    const g = q.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2 * 0.97); g.addColorStop(0, 'rgba(70,128,150,0.30)'); g.addColorStop(0.86, 'rgba(70,128,150,0.28)'); g.addColorStop(1, 'rgba(70,128,150,0)'); q.fillStyle = g; q.fillRect(0, 0, w, h);
    if (ring) { blur(q, 5); q.strokeStyle = 'rgba(28,52,84,0.02)'; q.lineWidth = 1.7 * SC; q.lineJoin = 'round'; hexPath(q, SC, w / 2, h / 2); q.stroke(); q.filter = 'none'; }
    const r2 = K.rand(7071); for (let i = 0; i < 26; i++) { q.strokeStyle = `rgba(255,255,255,${0.05 + r2() * 0.05})`; q.lineWidth = 1 + r2() * 1.5; const x = r2() * w, y = r2() * h; q.beginPath(); q.moveTo(x, y); q.lineTo(x + (r2() - 0.5) * 70, y + (r2() - 0.5) * 30); q.stroke(); }
  };
  const patchTex = canvasTex(TS, TS, drawPatch(true)), fillTex = canvasTex(TS, TS, drawPatch(false));
  const ringTex = canvasTex(TS, TS, (q, w, h) => { q.clearRect(0, 0, w, h); blur(q, 6); q.strokeStyle = '#ffffff'; q.lineWidth = 1.5 * SC; q.lineJoin = 'round'; hexPath(q, SC, w / 2, h / 2); q.stroke(); q.filter = 'none'; });
  const NR = 16, NS = 72;
  const gridGeo = () => { const pos = [], uv = [], idx = [];
    for (let i = 0; i <= NR; i++) for (let j = 0; j <= NS; j++) { const r = SPAN * i / NR, a = 2 * PI * j / NS, x = Math.sin(a) * r, z = Math.cos(a) * r; pos.push(x, gy(x, z) + 0.04, z); uv.push(0.5 + x / (2 * SPAN), 0.5 + z / (2 * SPAN)); }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) { const a = i * (NS + 1) + j, b = a + NS + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  const patch = new THREE.Mesh(gridGeo(), new THREE.MeshToonMaterial({ map: patchTex, transparent: true, depthWrite: false, gradientMap: K.ramp, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  patch.renderOrder = 2; patch.userData.layer = 'ice-overlay'; ic.add(patch);
  const glowMat = new THREE.MeshBasicMaterial({ map: ringTex, color: '#000000', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  const glow = new THREE.Mesh(gridGeo(), glowMat); glow.renderOrder = 3; glow.userData.layer = 'ice-overlay'; ic.add(glow);
  // the data mesh: a hexagonal ring (outer R 15.0, inner 14.1) 3 m under the ice, translucent deep blue-grey, no outline
  { const sh = new THREE.Shape(), ho = new THREE.Path(), pt = (r, k) => { const a = k * PI / 3 + PI / 6; return [Math.sin(a) * r, Math.cos(a) * r]; };
    for (let k = 0; k < 6; k++) { const [x, y] = pt(RC, k); k ? sh.lineTo(x, y) : sh.moveTo(x, y); } sh.closePath();
    for (let k = 0; k < 6; k++) { const [x, y] = pt(RC - 0.9, k); k ? ho.lineTo(x, y) : ho.moveTo(x, y); } ho.closePath(); sh.holes.push(ho);
    const hm = mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: '#2a4660', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }), 0, -DEPTH, 0, false, ic); hm.rotation.x = Math.PI / 2; hm.userData.layer = 'ice-overlay'; }
  // ---- the hut (4 x 3 m, half buried: 1.0 m of wall under the ice), the antenna lying across its roof, the frosted window, snow banked against it
  const ht = group('lm07Hut'); L.use(ht);
  const HX = -1.4, HZ = -2.6, HY = 0.38 * PI / PI, HR = 0.32;
  const hg = L.sub(HX, 0, HZ, HR);
  const wallTex = canvasTex(128, 128, (q, w, h) => { q.fillStyle = ORANGE; q.fillRect(0, 0, w, h); for (let i = 0; i < 46; i++) { q.fillStyle = `rgba(${rnd() < 0.5 ? '235,225,205' : '120,70,40'},${0.07 + rnd() * 0.1})`; q.fillRect(rnd() * w, rnd() * h, 4 + rnd() * 30, 2 + rnd() * 18); } });
  const wallM = new THREE.MeshToonMaterial({ map: wallTex, gradientMap: K.ramp });
  mesh(new THREE.BoxGeometry(4, 2.7, 3), wallM, 0, 0.35, 0, true, hg);                                                    // y -1.0 … 1.7
  const roof = mesh(new THREE.BoxGeometry(4.5, 0.14, 3.5), mat('#8d6a4c'), 0, 1.78, 0, true, hg); roof.rotation.z = 0.07;
  box(0, 0.4, 1.52, 0.9, 1.3, 0.06, '#3a2e28', false, hg).rotation.z = 0.02;                                                // door, half under the drift
  const frost = canvasTex(64, 64, (q, w, h) => { q.fillStyle = '#b9d4e2'; q.fillRect(0, 0, w, h); q.strokeStyle = 'rgba(255,255,255,.7)'; q.lineWidth = 1.2; for (let i = 0; i < 14; i++) { q.beginPath(); const x = rnd() * w, y = rnd() * h; q.moveTo(x, y); q.lineTo(x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 30); q.stroke(); } });
  mesh(new THREE.BoxGeometry(0.9, 0.7, 0.05), new THREE.MeshToonMaterial({ map: frost, gradientMap: K.ramp }), -1.35, 0.9, 1.53, true, hg);
  mesh(new THREE.BoxGeometry(0.05, 0.7, 0.9), new THREE.MeshToonMaterial({ map: frost, gradientMap: K.ramp }), 2.03, 0.9, 0.2, true, hg);
  // antenna: a thin mast broken at the roof and lying down the back slope into the snow (a pole 4.6 m, tilted 62 degrees from vertical, with a short crossbar)
  { const m = mesh(new THREE.CylinderGeometry(0.03, 0.04, 4.6, 6), mat('#5a5f66'), 1.2, 1.1, -2.6, true, hg); m.rotation.x = 1.08; m.rotation.z = 0.35; const c = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 5), mat('#5a5f66'), 1.5, 0.45, -3.4, true, hg); c.rotation.z = PI / 2 - 0.3; cyl(0.2, 2.0, 0.5, 0.03, 0.35, '#5a5f66', hg); }
  // snow banked on the weather side (the east of the hut): flat squashed domes
  const drift = (x, z, rx, rz, h) => { const m = mesh(new THREE.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI / 2), mat(SNOW), x, -0.05, z, false, ht); m.scale.set(rx, h, rz); return m; };
  drift(HX + 2.6, HZ - 0.2, 2.6, 2.2, 1.3); drift(HX + 0.2, HZ + 2.3, 2.6, 1.3, 0.75); drift(HX - 2.5, HZ - 1.4, 1.8, 1.4, 0.8); drift(HX + 1.2, HZ - 2.5, 2.4, 1.2, 0.7);
  // ---- the survey pole (2.8 m, alternate red and white bands) and the tripod with its instrument
  const gr = group('lm07Gear'); L.use(gr);
  { const px = 3.6, pz = 1.2; for (let i = 0; i < 5; i++) cyl(px, 0.28 + i * 0.56, pz, 0.045, 0.56, i % 2 ? '#e8e4dc' : '#b8473c', gr); cyl(px, 2.86, pz, 0.06, 0.1, '#2a2a30', gr);
    const tx = -4.2, tz = 2.6, legs = []; for (let k = 0; k < 3; k++) { const a = k * 2 * PI / 3 + 0.4, lx = tx + Math.sin(a) * 0.5, lz = tz + Math.cos(a) * 0.5; const l = mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.55, 5), mat('#6a6e72'), (tx + lx) / 2 + (lx - tx) * 0.0, 0.76, (tz + lz) / 2, true, gr); l.rotation.set(Math.cos(a) * 0.32, 0, -Math.sin(a) * 0.32); legs.push(l); }
    box(tx, 1.6, tz, 0.34, 0.26, 0.28, '#b9763f', true, gr); cyl(tx, 1.82, tz, 0.07, 0.2, '#2a2a30', gr); }
  // ---- live: snow mist drifting low over the ice (10 pale soft cards, slow, symmetric)
  const lv = group('lm07Live'); L.use(lv);
  const mist = []; for (let i = 0; i < 10; i++) { const g = L.sub(-6 + rnd() * 12, 0.5 + rnd() * 0.5, -5 + rnd() * 10, rnd() * 3); g.userData.live = true; const m = new THREE.Mesh(new THREE.PlaneGeometry(3 + rnd() * 2, 0.9), new THREE.MeshBasicMaterial({ map: L.glowTex, color: '#dfeaf2', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide })); g.add(m); mist.push({ g, m, ph: rnd(), x0: g.position.x, z0: g.position.z, y0: g.position.y }); }
  out.parts = { patch, glow, patchTex, fillTex };
  const col = new THREE.Color(CLUE.color);
  const side = 2 * RC * Math.sin(PI / 6);
  out.stats = { hexagon: { circumradius: RC, side, depth: DEPTH, vertices: 6 }, patch: SPAN * 2, hut: [4, 3], period: CLUE.period, peak: CLUE.peak, color: CLUE.color, patchAlpha: 0.30, ringAlpha: 0.02 };
  out.update = (t) => { const e = CLUE.slab(t) * CLUE.peak * 0.22; glowMat.color.setRGB(col.r * e, col.g * e, col.b * e);          // only 0.22 of the clue peak: over bright ice the same linear value would shout
    mist.forEach(s => { const p = (t * 0.05 + s.ph) % 1; s.g.position.x = s.x0 + (p - 0.5) * 8; s.g.position.z = s.z0 + Math.sin(p * 6.28) * 0.6; s.m.material.opacity = 0.4 * Math.sin(PI * p); }); };
  return out;
};
