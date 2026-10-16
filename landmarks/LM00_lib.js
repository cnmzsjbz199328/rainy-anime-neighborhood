// Shared helpers of the landmark modules (W7): small builders on top of the building kit (box, cyl, mesh, mat, warm, ...). Every landmark module is written in its own
// local frame (origin = site anchor, +Z towards the first entrance, +X to the left of +Z, 1 unit = 1 m); the loader in scene.js places the top-level groups it creates.
// Helpers add to the current parent set with L.use(group); nothing here makes a real light: windows and lanterns are self-lit toon materials, light pools are additive discs.
(function () {
'use strict';
globalThis.LMLIB = function (K) {
  const { THREE, mesh, box, cyl, mat, warm, canvasTex } = K, PI = Math.PI;
  const rnd = K.rand(777);
  let cur = null;
  const cache = {}, W = (c, k = 0.3) => cache[c + k] || (cache[c + k] = warm(c, k));
  const glowTex = canvasTex(128, 128, (q, w) => { const g = q.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = g; q.fillRect(0, 0, w, w); });
  const glowMat = (c, o) => new THREE.MeshBasicMaterial({ map: glowTex, color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const sub = (x, y, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; cur.add(g); return g; };
  const L = {
    PI, rnd, W, glowMat, glowTex, THREE,
    use(g) { cur = g; return g; }, parent: () => cur, sub,
    // a flat disc of radius r at height y (a levelled patch of ground that hides the lattice tolerance of the terrain under it)
    ground(r, color, y = 0.02) { const m = mesh(new THREE.CircleGeometry(r, 40), mat(color), 0, y, 0, false, cur); m.rotation.x = -PI / 2; return m; },
    pool(x, z, r, c, o, y = 0.05) { const m = mesh(new THREE.PlaneGeometry(2 * r, 2 * r), glowMat(c, o), x, y, z, false, cur); m.rotation.x = -PI / 2; return m; },
    rock(x, y, z, s, c = '#85807f', ry = 0, sy = 0.7) { const m = mesh(new THREE.DodecahedronGeometry(0.5, 0), mat(c), x, y + s * sy * 0.42, z, true, cur); m.scale.set(s, s * sy, s * 0.9); m.rotation.y = ry; return m; },
    // stone lantern (ishi-dōrō): base, post, light box with a weak warm glow, roof, finial; returns the light box (its material is the warm one)
    lantern(x, y, z, o = {}) { const k = o.k || 1;
      box(x, y + 0.1 * k, z, 0.5 * k, 0.2 * k, 0.5 * k, '#8d8a85', true, cur); cyl(x, y + 0.55 * k, z, 0.1 * k, 0.7 * k, '#767570', cur);
      box(x, y + 0.95 * k, z, 0.36 * k, 0.1 * k, 0.36 * k, '#8d8a85', true, cur); const lb = mesh(new THREE.BoxGeometry(0.26 * k, 0.26 * k, 0.26 * k), W(o.glow || '#ffcf8a', o.glowK === undefined ? 0.25 : o.glowK), x, y + 1.13 * k, z, false, cur);
      const roof = mesh(new THREE.ConeGeometry(0.34 * k, 0.26 * k, 4), mat('#8d8a85'), x, y + 1.39 * k, z, true, cur); roof.rotation.y = PI / 4; cyl(x, y + 1.52 * k, z, 0.05 * k, 0.12 * k, '#767570', cur); return lb; },
    // torii: two posts, kasagi and nuki; state 'ok' | 'lean' | 'down' | 'posts'; w = clear width, h = height, rot = yaw about Y
    torii(x, y, z, o = {}) { const w = o.w || 2.0, h = o.h || 2.8, st = o.state || 'ok', c = o.color || '#9a4b3f', cd = '#6a3a34', k = h / 2.8, g = sub(x, y, z, o.rot || 0);
      const post = (cx, hh) => mesh(new THREE.CylinderGeometry(0.11 * k, 0.13 * k, hh, 8), mat(c), cx, hh / 2, 0, true, g);
      const bar = (cy, len, th, col) => mesh(new THREE.BoxGeometry(len, th, 0.26 * k), mat(col), 0, cy, 0, true, g);
      if (st === 'down') { const a = post(-w / 2, h); a.rotation.z = 1.45; a.position.set(-w / 2 + 0.2, 0.15, 0.1); const b = post(w / 2, h * 0.9); b.rotation.z = -1.4; b.position.set(w / 2 + 0.4, 0.14, -0.5); const r = bar(0.12, w * 1.1, 0.16 * k, cd); r.rotation.y = 0.6; r.position.set(0.2, 0.12, -0.1); }
      else if (st === 'posts') { post(-w / 2, h * 0.9); post(w / 2, h * 0.55); }
      else { post(-w / 2, h); post(w / 2, h); bar(h + 0.06 * k, w + 0.9 * k, 0.16 * k, c); bar(h - 0.34 * k, w + 0.1, 0.12 * k, cd); if (st === 'lean') g.rotation.z = 0.12; }
      return g; },
    // simple trees: trunk + blobs (round), stacked cones (cedar), a dead trunk; h = height in metres
    tree(x, y, z, o = {}) { const h = o.h || 6, kind = o.kind || 'round', g = sub(x, y, z, o.rot || 0); mesh(new THREE.CylinderGeometry(0.1 * h / 6, 0.18 * h / 6, h * 0.45, 6), mat('#4a4038'), 0, h * 0.225, 0, true, g);
      if (kind === 'cedar') for (let i = 0; i < 4; i++) mesh(new THREE.ConeGeometry(1.5 * (1 - i * 0.2) * h / 9, h * 0.34, 8), mat(i % 2 ? '#27493f' : '#1f3b36'), 0, h * (0.35 + i * 0.17), 0, true, g);
      else if (kind === 'dead') { mesh(new THREE.CylinderGeometry(0.05, 0.08, h * 0.4, 5), mat('#4a4038'), 0.3, h * 0.55, 0, true, g).rotation.z = -0.6; }
      else for (let i = 0; i < 3; i++) mesh(new THREE.IcosahedronGeometry(1.1 * h / 6, 0), mat(i % 2 ? '#3f6b5a' : '#335e55'), (i - 1) * 0.7 * h / 6, h * (0.6 + 0.12 * (i % 2)), (i % 2) * 0.4, true, g);
      return g; },
    // stone steps going up along -Z from (x, y0, z0): n steps, tread t, riser r, width w
    steps(x, y0, z0, n, w = 1.6, t = 0.34, r = 0.17, c = '#6d7468') { for (let i = 0; i < n; i++) box(x, y0 + r * (i + 0.5), z0 - t * i, w, r, t + 0.02, c, true, cur); },
    // a steam plume: n puffs (two crossed translucent quads each) rise, widen and fade slowly; returns an update(t)
    steam(x, y, z, o = {}) { const n = o.n || 5, h = o.h || 3, g = sub(x, y, z); g.userData.live = true; const ms = [];
      for (let i = 0; i < n; i++) for (let a = 0; a < 2; a++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat(o.color || '#dde6f0', 0)); m.rotation.y = a * PI / 2; m.renderOrder = 6; g.add(m); ms.push([m, i]); }
      return { object: g, update(t) { ms.forEach(([m, i]) => { const p = ((t * (o.speed || 0.08) + i / n) % 1), s = (o.s || 0.9) * (1 + 2.2 * p); m.position.set(Math.sin(t * 0.3 + i) * 0.25 * p, p * h, 0); m.scale.set(s, s, 1); m.material.opacity = (o.o || 0.2) * Math.sin(PI * p) * (1 - 0.3 * p); }); } }; },
  };
  return L;
};
})();
// ---- more helpers appended: gabled and hipped roofs, a small timber house with warm windows, planks, cloth
(function () {
const prev = globalThis.LMLIB;
globalThis.LMLIB = function (K) {
  const L = prev(K), { THREE, mesh, box, cyl, mat, warm } = K, PI = Math.PI;
  const flatGeo = (verts, idx) => { const g = new THREE.BufferGeometry(); const p = []; for (const i of idx) p.push(...verts[i]); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g; };
  // gabled roof over a w x d plan (ridge along d), eaves at y0, ridge height rise, overhang o
  L.gable = (w, d, y0, rise, o = 0.4, color = '#3a3f4a', parent) => { const hw = w / 2 + o, hd = d / 2 + o, v = [[-hw, y0, -hd], [hw, y0, -hd], [hw, y0, hd], [-hw, y0, hd], [0, y0 + rise, -hd], [0, y0 + rise, hd]];
    const g = flatGeo(v, [0, 4, 1, 3, 2, 5, 3, 5, 4, 3, 4, 0, 1, 4, 5, 1, 5, 2, 0, 1, 2, 0, 2, 3]); const m = mesh(g, mat(color), 0, 0, 0, true, parent || L.parent()); return m; };
  L.hip = (w, d, y0, rise, o = 0.4, color = '#3a3f4a', parent) => { const hw = w / 2 + o, hd = d / 2 + o, rl = Math.max(0.01, d / 2 - w / 2 + 0.0), v = [[-hw, y0, -hd], [hw, y0, -hd], [hw, y0, hd], [-hw, y0, hd], [-0.05, y0 + rise, -rl], [0.05, y0 + rise, rl]];
    const g = flatGeo(v, [0, 4, 1, 3, 2, 5, 3, 5, 4, 3, 4, 0, 1, 4, 5, 1, 5, 2, 0, 1, 2, 0, 2, 3]); return mesh(g, mat(color), 0, 0, 0, true, parent || L.parent()); };
  // a timber house (minka / ryokan) at (x, z) rotated by ry (front = +Z of the house): walls, roof, door and windows with warm light, a lantern; returns its group
  L.house = (x, z, ry, o = {}) => { const w = o.w || 6, d = o.d || 5, fl = o.floors || 1, h = fl * 2.7, g = L.sub(x, 0, z, ry), prevCur = L.parent(); L.use(g);
    box(0, h / 2 + 0.2, 0, w, h, d, o.wall || '#7a6552', true, g); box(0, 0.1, 0, w + 0.3, 0.2, d + 0.3, '#6a6a68', true, g);
    if (fl > 1) box(0, 2.9, d / 2 + 0.15, w + 0.2, 0.12, 0.5, '#5a4a3c', true, g);                     // the eave between the floors
    L.gable(w, d, h + 0.2, o.rise || 1.5, 0.5, o.roof || '#3a3f4a', g);
    const wins = []; for (let f = 0; f < fl; f++) { const nw = Math.max(2, Math.round(w / 2.2)); for (let i = 0; i < nw; i++) { const wx = -w / 2 + (i + 0.5) * w / nw; if (f === 0 && Math.abs(wx) < 1.0) continue; const warmK = o.lit === false ? 0.04 : 0.24 + 0.08 * ((i + f) % 2); wins.push(mesh(new THREE.BoxGeometry(1.0, 0.9, 0.05), warm('#ffcf8a', warmK), wx, 0.2 + f * 2.7 + 1.5, d / 2 + 0.02, false, g)); box(wx, 0.2 + f * 2.7 + 1.5, d / 2 + 0.05, 1.12, 0.06, 0.04, '#3a2d24', false, g); } }
    box(0, 1.2, d / 2 + 0.03, 1.0, 2.0, 0.06, '#4a382b', false, g); box(0, 2.1, d / 2 + 0.2, 1.5, 0.12, 0.4, '#5a4a3c', true, g);
    L.use(prevCur); return g; };
  // Full close-up house for WD coast sites. The same timber/window geometry accepts separate room plans.
  L.roomHouse = (x, z, ry, o = {}) => {
    const w = o.w || 6, d = o.d || 5, fl = o.floors || 1, h = fl * 2.7, role = o.role || 'home';
    const g = L.sub(x, 0, z, ry), wall = o.wall || '#7a6552', wood = role === 'warehouse' || role === 'ice' ? '#56615e' : '#594638';
    g.name = `roomHouse-${role}`;
    const b = (x, y, z, sx, sy, sz, c) => box(x, y, z, sx, sy, sz, c, true, g);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#c9d9dc', transparent: true, opacity: 0.28, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide });
    b(0, 0.1, 0, w + 0.3, 0.2, d + 0.3, '#747472');
    for (let f = 0; f < fl; f++) {
      const y = 0.2 + f * 2.7, doorW = f === 0 && role === 'warehouse' ? 3.4 : 1.05, doorH = role === 'warehouse' ? 2.4 : 2.0;
      b(0, y + 0.06, 0, w - 0.18, 0.12, d - 0.18, '#88725a');
      for (const side of [-1, 1]) {
        const z = side * d / 2, cuts = side > 0 ? [-w * 0.32, 0, w * 0.32] : [-w * 0.25, w * 0.25]; let left = -w / 2;
        for (const cx of cuts) {
          const door = side > 0 && f === 0 && cx === 0, half = door ? doorW / 2 : 0.48;
          const lo = cx - half, hi = cx + half, bottom = door ? y : y + 0.84, top = door ? y + doorH : y + 1.92;
          if (lo > left) b((left + lo) / 2, y + 1.35, z, lo - left, 2.7, 0.16, wall);
          if (bottom > y) b(cx, (y + bottom) / 2, z, half * 2, bottom - y, 0.16, wall);
          if (top < y + 2.7) b(cx, (top + y + 2.7) / 2, z, half * 2, y + 2.7 - top, 0.16, wall);
          b(cx, top + 0.035, z, half * 2 + 0.12, 0.07, 0.22, wood);
          if (!door) {
            b(cx, bottom - 0.035, z, half * 2 + 0.12, 0.07, 0.24, wood);
            mesh(new THREE.BoxGeometry(half * 2 - 0.06, top - bottom - 0.08, 0.02), glass, cx, (bottom + top) / 2, z + side * 0.02, false, g);
            b(cx, (bottom + top) / 2, z + side * 0.05, 0.04, top - bottom, 0.05, wood);
          } else {
            for (const sx of [-1, 1]) b(cx + sx * half, y + doorH / 2, z, 0.1, doorH, 0.2, wood);
            if (role !== 'warehouse') b(cx + 0.35, y + 1.0, z - side * 0.09, 0.48, 1.88, 0.07, wood);
          }
          left = hi;
        }
        if (left < w / 2) b((left + w / 2) / 2, y + 1.35, z, w / 2 - left, 2.7, 0.16, wall);
      }
      for (const side of [-1, 1]) { const xx = side * w / 2;
        b(xx, y + 1.35, -d * 0.27, 0.16, 2.7, d * 0.46, wall);
        b(xx, y + 1.35, d * 0.27, 0.16, 2.7, d * 0.46, wall);
        b(xx, y + 0.42, 0, 0.16, 0.84, d * 0.08, wall); b(xx, y + 2.31, 0, 0.16, 0.78, d * 0.08, wall);
        mesh(new THREE.BoxGeometry(0.02, 1.0, d * 0.08), glass, xx + side * 0.02, y + 1.36, 0, false, g);
      }
      for (const xx of [-w / 2, w / 2]) for (const zz of [-d / 2, d / 2]) b(xx, y + 1.35, zz, 0.16, 2.7, 0.16, wood);
      b(0, y + 2.62, 0, w - 0.15, 0.14, d - 0.15, '#8a765d');
      if (role === 'warehouse') {
        for (const xx of [-w * 0.32, w * 0.32]) for (let k = 0; k < 3; k++) b(xx, y + 0.55 + k * 0.55, -d / 2 + 0.85, 1.35, 0.09, 0.55, '#71807c');
        b(0, y + 0.7, -d / 2 + 0.95, 1.2, 1.05, 0.4, '#69736b');
      } else if (role === 'ice') {
        b(0.2, y + 0.88, -0.55, 1.4, 1.55, 0.9, '#9aadb2');
        b(-0.65, y + 0.48, d / 2 - 0.55, 0.68, 0.62, 0.6, '#aabdc0');
      } else {
        b(-w * 0.25, y + 0.73, d / 2 - 0.85, 0.9, 0.12, 0.6, '#886f53');
        b(w * 0.24, y + 0.45, d / 2 - 1.05, 0.75, 0.12, 0.55, '#90785a');
        b(0, y + 1.1, -d / 2 + 0.75, w * 0.4, 1.85, 0.12, '#9c8a70');
        b(w * 0.25, y + 0.75, -d / 2 + 0.5, 0.85, 1.3, 0.38, '#79644c');
        if (role === 'cottage' || (f === 0 && o.lit !== false)) mesh(new THREE.BoxGeometry(0.65, 0.22, 0.07), warm('#ffcf8a', role === 'cottage' ? 0.18 : 0.11), -w * 0.22, y + 1.85, -d / 2 + 0.86, false, g);
      }
      if (fl > 1) for (let k = 0; k < 7; k++) b(-w / 2 + 0.7, y + 0.25 + k * 0.33, -d / 2 + 0.65 + k * 0.29, 0.7, 0.1, 0.3, '#705b45');
    }
    L.gable(w, d, h + 0.2, o.rise || 1.4, 0.5, o.roof || '#3a3f4a', g);
    for (const zz of [-d / 2, d / 2]) b(0, h + 0.2, zz, w + 0.85, 0.12, 0.12, wood);
    for (const xx of [-w / 2 + 0.25, w / 2 - 0.25]) b(xx, h / 2, -d / 2 - 0.1, 0.07, h, 0.08, wood);
    b(0, 0.14, d / 2 + 0.56, role === 'warehouse' ? 3.6 : 1.3, 0.1, 0.82, '#84817a');
    return g;
  };
  return L;
};
})();
// ---- ground sampling for modules on sloping sites (LM08, LM10): the terrain height at a local point relative to the anchor altitude
(function () {
const prev = globalThis.LMLIB;
globalThis.LMLIB = function (K) {
  const L = prev(K);
  // W8g-b (B3): K.ground is the height of the rendered terrain (scene.js: terrain.sampler()); the anchor altitude of the site comes from the same function
  L.groundFn = rec => { const W = globalThis.WORLD, G = K.ground || ((lo, la) => W.height(lo, la)), h0 = G(rec.lon, rec.lat), head = rec.entrances[0].heading, A = { lon: rec.lon, lat: rec.lat };
    const f = (x, z) => { const d = Math.hypot(x, z); const p = d < 1e-9 ? A : W.destination(A, head + Math.atan2(-x, z) * 180 / Math.PI, d); return G(p.lon, p.lat) - h0; }; f.h0 = h0; f.sea = -h0; return f; };
  return L;
};
})();
