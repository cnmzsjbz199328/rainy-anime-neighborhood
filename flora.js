// Object kit and instancing for the planet sections (W4): trees, shrubs, rocks, props, road and boardwalk parts.
// Every geometry is built once in metres (1 unit = 1 m), flat-shaded with baked vertex colours (night palette of WORLD_SPEC) and a
// smooth 'hnormal' attribute for the inverted-hull ink outline. All instanced meshes share one toon material, so a type costs one draw
// call (two with its outline). Placement (section.js) scales every instance by 1/cos(lat) because the terrain is stored in flat
// Mercator coordinates and bend.js shrinks it back; see docs/world/W3_SPEC.md section 2.
// Pure geometry code: needs THREE only when `make(THREE)` is called.
(function (global) {
'use strict';

// Night palette (sRGB hex): low saturation, blue-leaning greens, lilac-grey stone, warm light only from lamps.
const PAL = {
  trunk: '#4a4038', trunkD: '#352f2c', bark: '#5a5048', leafA: '#3f6b5a', leafB: '#335e55', leafC: '#4c7660', cedar: '#27493f', cedarD: '#1f3b36',
  pine: '#2f5748', pineB: '#3d6a52', bamboo: '#5f8a64', bambooD: '#3e6a55', shrub: '#3a6a58', shrubB: '#4a7a5e', fern: '#4d7f61', grass: '#6c9867', grassD: '#4f7d5b',
  weed: '#6a8a5a', weedD: '#59704c', dead: '#7a7456', flowerW: '#d9dde6', flowerP: '#a99ccf',
  rock: '#85807f', rockD: '#6a6666', moss: '#4f7a56', mossD: '#3c6150', sand: '#9a9aa4', log: '#6a5a4c', logD: '#4a3e36',
  concrete: '#8a8f99', concreteD: '#6c7280', metal: '#7d8794', rust: '#8a5a44', rustD: '#6a4636', red: '#b24a44', white: '#e4e8ee', wood: '#7a5c44', woodD: '#5a4434', woodL: '#9a7a5a',
  lampHead: '#c9ced6', glowWarm: '#ffd9a0', glowCool: '#dfe9f2', asphalt: '#2f3645', straw: '#b7a56c', strawD: '#8a7a50', cloth: '#7a5a8a', stone: '#8a8d98', stoneD: '#6a6d78',
  torii: '#9a4b3f', toriiD: '#6a3a34', plank: '#8a6a4c', plankD: '#6c5238', vine: '#4a7655', orange: '#d58a3a',
};

function make(THREE) {
  const col = hex => new THREE.Color(hex);
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  const hash3 = (x, y, z) => { let h = Math.imul(Math.round(x * 1000), 374761393) ^ Math.imul(Math.round(y * 1000), 668265263) ^ Math.imul(Math.round(z * 1000), 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296 * 2 - 1; };

  // A builder merges transformed primitives into one non-indexed, flat-shaded geometry with vertex colours.
  function builder() {
    const P = [], C = [];
    const api = {
      add(geo, color, o = {}) {
        const g = geo.index ? geo.toNonIndexed() : geo.clone();
        E.set(...(o.r || [0, 0, 0])); Q.setFromEuler(E);
        M4.compose(V.set(...(o.p || [0, 0, 0])), Q, S.set(...(o.s || [1, 1, 1]))); g.applyMatrix4(M4);
        const pos = g.attributes.position, c0 = col(color), c1 = o.top ? col(o.top) : null;
        let ymin = Infinity, ymax = -Infinity; for (let i = 0; i < pos.count; i++) { ymin = Math.min(ymin, pos.getY(i)); ymax = Math.max(ymax, pos.getY(i)); }
        for (let i = 0; i < pos.count; i++) {
          P.push(pos.getX(i), pos.getY(i), pos.getZ(i));
          const t = c1 ? (pos.getY(i) - ymin) / Math.max(1e-6, ymax - ymin) : 0, c = c1 ? c0.clone().lerp(c1, t) : c0;
          const j = o.noise ? 1 + o.noise * hash3(pos.getX(i), pos.getY(i), pos.getZ(i)) : 1;
          C.push(c.r * j, c.g * j, c.b * j);
        }
        return api;
      },
      build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
        g.computeVertexNormals();
        // smooth normals per unique position for the outline hull
        const pos = g.attributes.position, nor = g.attributes.normal, acc = new Map(), key = i => `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
        for (let i = 0; i < pos.count; i++) { const k = key(i), a = acc.get(k) || [0, 0, 0]; a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i); acc.set(k, a); }
        const h = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; h[i * 3] = a[0] / l; h[i * 3 + 1] = a[1] / l; h[i * 3 + 2] = a[2] / l; }
        g.setAttribute('hnormal', new THREE.BufferAttribute(h, 3));
        g.computeBoundingSphere(); g.computeBoundingBox();
        return g;
      },
    };
    return api;
  }
  // primitives (shared, unit sized)
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = (r0, r1, h, seg = 6) => new THREE.CylinderGeometry(r1, r0, h, seg, 1).translate(0, h / 2, 0), cone = (r, h, seg = 7) => new THREE.ConeGeometry(r, h, seg, 1).translate(0, h / 2, 0);
  const ico = (r, d = 1) => { const g = new THREE.IcosahedronGeometry(r, d); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const j = 1 + 0.14 * hash3(p.getX(i) * 3, p.getY(i) * 3, p.getZ(i) * 3); p.setXYZ(i, p.getX(i) * j, p.getY(i) * j, p.getZ(i) * j); } return g; };
  const dod = r => { const g = new THREE.DodecahedronGeometry(r, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const j = 1 + 0.18 * hash3(p.getX(i) * 5, p.getY(i) * 5, p.getZ(i) * 5); p.setXYZ(i, p.getX(i) * j, p.getY(i) * j, p.getZ(i) * j); } return g; };
  const tor = (r, t) => new THREE.TorusGeometry(r, t, 5, 10);
  const quad = (w, h) => new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0);
  // a grass blade: a triangle tapering to a point (a rectangle card reads as a board close up)
  const blade = (w, h) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, 0, h, 0], 3)); return g; };

  const G = {};   // name -> geometry
  const T = (name, fn) => { G[name] = fn(builder()).build(); };

  // ---- trees (near and far levels)
  T('treeRound', b => b.add(cyl(0.16, 0.1, 2.4, 5), PAL.trunk, { noise: 0.1 }).add(ico(1.5, 1), PAL.leafA, { p: [0, 3.4, 0], top: PAL.leafC, noise: 0.08 }).add(ico(1.1, 1), PAL.leafB, { p: [0.9, 2.8, 0.3], top: PAL.leafA }).add(ico(1.0, 1), PAL.leafB, { p: [-0.8, 2.9, -0.4], top: PAL.leafA }).add(ico(0.9, 1), PAL.leafC, { p: [0.1, 4.4, 0.2], top: PAL.leafC }));
  T('treeRound_far', b => b.add(cyl(0.18, 0.1, 2.4, 4), PAL.trunk).add(ico(2.0, 0), PAL.leafA, { p: [0, 3.5, 0], top: PAL.leafC, s: [1, 0.9, 1] }));
  T('cedar', b => { b.add(cyl(0.2, 0.12, 2.0, 5), PAL.trunkD); for (let i = 0; i < 4; i++) b.add(cone(1.7 - i * 0.32, 2.7, 8), PAL.cedar, { p: [0, 1.6 + i * 1.9, 0], top: PAL.cedarD, noise: 0.07 }); return b; });
  T('cedar_far', b => b.add(cyl(0.2, 0.12, 2.0, 4), PAL.trunkD).add(cone(1.6, 9.0, 6), PAL.cedar, { p: [0, 1.4, 0], top: PAL.cedarD }));
  T('pine', b => b.add(cyl(0.2, 0.12, 3.2, 5), PAL.bark, { r: [0, 0, 0.12], noise: 0.1 }).add(ico(1.4, 1), PAL.pine, { p: [0.5, 3.8, 0], s: [1.5, 0.55, 1.2], top: PAL.pineB }).add(ico(1.2, 1), PAL.pine, { p: [-0.8, 3.0, 0.4], s: [1.4, 0.5, 1.1], top: PAL.pineB }).add(ico(1.0, 1), PAL.pineB, { p: [0.2, 4.6, -0.2], s: [1.3, 0.5, 1.0], top: PAL.pine }));
  T('pine_far', b => b.add(cyl(0.2, 0.12, 3.2, 4), PAL.bark).add(ico(1.9, 0), PAL.pine, { p: [0.1, 3.9, 0], s: [1.5, 0.6, 1.2], top: PAL.pineB }));
  T('bamboo', b => { for (let i = 0; i < 8; i++) { const a = i * 2.4, r = 0.25 + 0.2 * (i % 3), lean = 0.08 + 0.05 * (i % 2); b.add(cyl(0.06, 0.04, 6.4 + (i % 3) * 0.7, 5), i % 2 ? PAL.bamboo : PAL.bambooD, { p: [Math.cos(a) * r, 0, Math.sin(a) * r], r: [Math.sin(a) * lean, 0, -Math.cos(a) * lean] }); } for (let i = 0; i < 6; i++) { const a = i * 1.1; b.add(cone(0.9, 1.5, 5), PAL.bamboo, { p: [Math.cos(a) * 0.5, 5.2 + (i % 3) * 0.7, Math.sin(a) * 0.5], r: [Math.PI, 0, 0], s: [1, 1, 1], top: PAL.bambooD }); } return b; });
  T('bamboo_far', b => b.add(cyl(0.5, 0.3, 6.4, 5), PAL.bamboo).add(cone(1.2, 2.0, 5), PAL.bambooD, { p: [0, 5, 0] }));
  T('shrub', b => b.add(ico(0.7, 1), PAL.shrub, { p: [0, 0.45, 0], s: [1, 0.8, 1], top: PAL.shrubB, noise: 0.1 }).add(ico(0.45, 1), PAL.shrubB, { p: [0.45, 0.3, 0.2], top: PAL.shrub }));
  T('shrubLow', b => b.add(ico(0.55, 0), PAL.shrub, { p: [0, 0.3, 0], s: [1.2, 0.7, 1.2], top: PAL.shrubB }));
  T('tuft', b => { for (let i = 0; i < 5; i++) { const a = i * 1.26; b.add(blade(0.16, 0.55 + 0.2 * (i % 2)), PAL.grass, { r: [0.35, a, 0], p: [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05], top: PAL.grassD }); b.add(blade(0.16, 0.5), PAL.grass, { r: [-0.35, a + 3.14, 0], top: PAL.grassD }); } return b; });
  T('weed', b => { for (let i = 0; i < 6; i++) { const a = i * 1.05; b.add(blade(0.2, 0.9 + 0.35 * (i % 3)), PAL.weed, { r: [0.3, a, 0], p: [Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08], top: PAL.dead }); } return b; });
  T('fern', b => { for (let i = 0; i < 7; i++) { const a = i * 0.9; b.add(blade(0.3, 0.9), PAL.fern, { r: [0.9, a, 0], top: PAL.grassD }); } return b; });
  T('flower', b => { for (let i = 0; i < 4; i++) { const a = i * 1.57; b.add(blade(0.05, 0.4), PAL.grassD, { r: [0.1, a, 0] }); b.add(cone(0.06, 0.12, 4), i % 2 ? PAL.flowerW : PAL.flowerP, { p: [Math.cos(a) * 0.04, 0.4, Math.sin(a) * 0.04] }); } return b; });
  T('seedling', b => { for (let i = 0; i < 7; i++) { const a = i * 0.9; b.add(blade(0.05, 0.38), PAL.grass, { r: [0.2, a, 0], top: PAL.grassD }); } return b; });

  // ---- rocks, logs, stone
  T('rock', b => b.add(dod(0.55), PAL.rock, { p: [0, 0.3, 0], s: [1, 0.7, 0.9], top: PAL.rockD }));
  T('rockBig', b => b.add(dod(1.0), PAL.rock, { p: [0, 0.6, 0], s: [1.1, 0.8, 0.9], top: PAL.rockD, noise: 0.08 }));
  T('mossRock', b => b.add(dod(0.6), PAL.rockD, { p: [0, 0.3, 0], s: [1, 0.75, 0.9], top: PAL.moss }));
  T('reefRock', b => b.add(dod(0.8), PAL.rockD, { p: [0, 0.2, 0], s: [1.2, 0.7, 1.0], top: PAL.rock, noise: 0.1 }));
  T('log', b => b.add(cyl(0.2, 0.16, 3.2, 6), PAL.log, { r: [0, 0, Math.PI / 2], p: [-1.6, 0.22, 0], noise: 0.1 }).add(cyl(0.07, 0.05, 0.9, 4), PAL.logD, { r: [0, 0, 0.9], p: [0.2, 0.3, 0.1] }));
  T('logMoss', b => b.add(cyl(0.22, 0.17, 3.0, 6), PAL.logD, { r: [0, 0, Math.PI / 2], p: [-1.5, 0.22, 0], noise: 0.1 }).add(box, PAL.moss, { p: [0, 0.4, 0], s: [1.8, 0.1, 0.3] }));
  T('cairn', b => b.add(dod(0.35), PAL.rock, { p: [0, 0.2, 0] }).add(dod(0.28), PAL.rockD, { p: [0.03, 0.55, 0] }).add(dod(0.2), PAL.rock, { p: [-0.02, 0.8, 0.02] }).add(dod(0.14), PAL.rockD, { p: [0, 1.0, 0] }));
  T('lantern', b => b.add(box, PAL.stone, { p: [0, 0.12, 0], s: [0.5, 0.24, 0.5] }).add(cyl(0.11, 0.1, 0.7, 6), PAL.stoneD, { p: [0, 0.24, 0] }).add(box, PAL.stone, { p: [0, 1.0, 0], s: [0.36, 0.1, 0.36] }).add(box, PAL.stoneD, { p: [0, 1.18, 0], s: [0.26, 0.26, 0.26] }).add(cone(0.34, 0.26, 4), PAL.stone, { p: [0, 1.3, 0], r: [0, Math.PI / 4, 0] }).add(box, PAL.stoneD, { p: [0, 1.62, 0], s: [0.1, 0.1, 0.1] }));
  T('lanternGlowOut', b => b.add(box, PAL.glowWarm, { p: [0, 1.18, 0], s: [0.34, 0.2, 0.34] }));
  T('lanternGlow', b => b.add(box, PAL.glowWarm, { p: [0, 1.18, 0], s: [0.16, 0.18, 0.16] }));
  T('torii', b => b.add(cyl(0.13, 0.11, 2.6, 8), PAL.torii, { p: [-1.0, 0, 0] }).add(cyl(0.13, 0.11, 2.6, 8), PAL.torii, { p: [1.0, 0, 0] }).add(box, PAL.torii, { p: [0, 2.55, 0], s: [2.9, 0.18, 0.26] }).add(box, PAL.toriiD, { p: [0, 2.3, 0], s: [2.2, 0.12, 0.2] }).add(box, PAL.toriiD, { p: [-1.0, 0, 0], s: [0.34, 0.3, 0.34] }).add(box, PAL.toriiD, { p: [1.0, 0, 0], s: [0.34, 0.3, 0.34] }));
  T('mossStep', b => { for (let i = 0; i < 4; i++) b.add(box, PAL.stone, { p: [0, 0.08 + i * 0.17, -i * 0.34], s: [1.5, 0.17, 0.34], top: i % 2 ? PAL.moss : PAL.stoneD, noise: 0.1 }); return b; });
  T('stonePost', b => b.add(box, PAL.stone, { p: [0, 0.4, 0], s: [0.2, 0.8, 0.2], top: PAL.moss }));

  // ---- farm
  T('rack', b => { b.add(cyl(0.04, 0.04, 1.6, 4), PAL.woodD, { p: [-1.2, 0, 0], r: [0, 0, 0.05] }).add(cyl(0.04, 0.04, 1.6, 4), PAL.woodD, { p: [1.2, 0, 0], r: [0, 0, -0.05] }); for (let i = 0; i < 3; i++) b.add(cyl(0.025, 0.025, 2.6, 4), PAL.wood, { r: [0, 0, Math.PI / 2], p: [-1.3, 0.55 + i * 0.4, 0] }); for (let i = 0; i < 9; i++) b.add(cone(0.12, 0.45, 5), PAL.straw, { p: [-1.0 + i * 0.25, 0.9, 0], r: [Math.PI, 0, 0], top: PAL.strawD }); return b; });
  T('rackFallen', b => b.add(cyl(0.04, 0.04, 1.6, 4), PAL.woodD, { r: [0, 0, 1.45], p: [-0.6, 0.05, 0] }).add(cyl(0.025, 0.025, 2.6, 4), PAL.wood, { r: [0.1, 0.3, Math.PI / 2], p: [-1.3, 0.12, 0.3] }).add(cone(0.12, 0.45, 5), PAL.strawD, { p: [0.3, 0.1, 0.2], r: [1.5, 0, 0] }));
  T('scarecrow', b => b.add(cyl(0.04, 0.04, 1.7, 4), PAL.woodD).add(cyl(0.03, 0.03, 1.3, 4), PAL.wood, { r: [0, 0, Math.PI / 2], p: [-0.65, 1.2, 0] }).add(cone(0.34, 0.2, 8), PAL.straw, { p: [0, 1.62, 0] }).add(box, PAL.cloth, { p: [0, 1.0, 0], s: [0.5, 0.65, 0.12] }).add(ico(0.12, 0), PAL.straw, { p: [0, 1.55, 0] }));
  const shed = (b, rustc, lean) => b.add(box, rustc, { p: [0, 0.95, 0], s: [2.4, 1.9, 1.8], r: [0, 0, lean], noise: 0.06 }).add(box, PAL.rustD, { p: [0, 2.0, 0], s: [2.7, 0.1, 2.1], r: [0, 0, lean + 0.12] }).add(box, PAL.woodD, { p: [0, 0.8, 0.92], s: [0.8, 1.6, 0.05] });
  T('hutFarm', b => shed(b, PAL.concreteD, 0));
  T('hutRusty', b => shed(b, PAL.rust, 0.08).add(ico(0.7, 0), PAL.vine, { p: [0.7, 1.9, 0.2], top: PAL.moss }));
  T('oldMachine', b => b.add(box, PAL.rust, { p: [0, 0.7, 0], s: [1.8, 0.9, 1.1], noise: 0.08 }).add(cyl(0.45, 0.45, 0.2, 8), PAL.rustD, { r: [Math.PI / 2, 0, 0], p: [0.7, 0.45, 0.6] }).add(cyl(0.45, 0.45, 0.2, 8), PAL.rustD, { r: [Math.PI / 2, 0, 0], p: [0.7, 0.45, -0.8] }).add(ico(0.8, 1), PAL.vine, { p: [-0.2, 1.2, 0], top: PAL.moss, s: [1.6, 0.6, 1.0] }).add(cyl(0.05, 0.05, 0.9, 5), PAL.metal, { p: [-0.7, 1.2, 0.3] }));

  // ---- road furniture
  T('pole', b => b.add(cyl(0.14, 0.11, 8.5, 6), PAL.concrete, { noise: 0.05 }).add(box, PAL.woodD, { p: [0, 7.7, 0], s: [1.9, 0.1, 0.1] }).add(box, PAL.woodD, { p: [0, 7.0, 0], s: [1.5, 0.08, 0.08] }).add(cyl(0.04, 0.04, 0.2, 4), PAL.white, { p: [-0.8, 7.75, 0] }).add(cyl(0.04, 0.04, 0.2, 4), PAL.white, { p: [0.8, 7.75, 0] }).add(cyl(0.04, 0.04, 0.2, 4), PAL.white, { p: [0, 7.75, 0] }).add(box, PAL.concreteD, { p: [0.14, 3.2, 0], s: [0.1, 0.6, 0.06] }));
  T('lamp', b => b.add(cyl(0.1, 0.06, 6.2, 6), PAL.metal).add(cyl(0.05, 0.05, 1.6, 5), PAL.metal, { p: [0.45, 5.75, 0], r: [0, 0, -1.2] }).add(box, PAL.lampHead, { p: [1.15, 6.3, 0], s: [0.75, 0.13, 0.28] }));
  T('lampGlow', b => b.add(box, PAL.glowWarm, { p: [1.15, 6.2, 0], s: [0.62, 0.04, 0.2] }));
  T('vending', b => b.add(box, PAL.concreteD, { p: [0, 0.9, 0], s: [1.0, 1.8, 0.8] }).add(box, PAL.metal, { p: [0, 1.82, 0], s: [1.06, 0.06, 0.86] }));
  T('vendingGlow', b => b.add(box, PAL.glowCool, { p: [0, 1.0, 0.41], s: [0.82, 1.4, 0.03] }));
  T('signRound', b => b.add(cyl(0.035, 0.035, 2.4, 4), PAL.metal).add(cyl(0.3, 0.3, 0.03, 12), PAL.white, { p: [0, 2.2, 0.04], r: [Math.PI / 2, 0, 0] }).add(tor(0.27, 0.035), PAL.red, { p: [0, 2.5, 0.06] }));
  T('signTri', b => b.add(cyl(0.035, 0.035, 2.2, 4), PAL.metal).add(cone(0.4, 0.04, 3), PAL.white, { p: [0, 2.3, 0.04], r: [Math.PI / 2, 0, 0] }).add(tor(0.3, 0.03), PAL.red, { p: [0, 2.5, 0.07], r: [0, 0, 0] }));
  T('signBus', b => b.add(cyl(0.035, 0.035, 2.4, 4), PAL.metal).add(box, PAL.white, { p: [0, 2.3, 0], s: [0.5, 0.34, 0.03] }).add(box, PAL.orange, { p: [0, 2.46, 0.02], s: [0.5, 0.06, 0.03] }));
  T('mirror', b => b.add(cyl(0.04, 0.04, 2.6, 4), PAL.orange).add(cyl(0.34, 0.34, 0.05, 12), PAL.metal, { p: [0.1, 2.55, 0], r: [Math.PI / 2, 0, 0] }).add(cyl(0.3, 0.3, 0.03, 12), PAL.glowCool, { p: [0.1, 2.55, 0.04], r: [Math.PI / 2, 0, 0] }));
  T('barrier', b => { for (let i = 0; i < 5; i++) b.add(box, i % 2 ? PAL.white : PAL.red, { p: [-0.8 + i * 0.4, 0.75, 0], s: [0.4, 0.14, 0.06] }); return b.add(box, PAL.metal, { p: [-0.85, 0.4, 0], s: [0.06, 0.8, 0.06] }).add(box, PAL.metal, { p: [0.85, 0.4, 0], s: [0.06, 0.8, 0.06] }); });
  T('signFallen', b => b.add(cyl(0.035, 0.035, 2.2, 4), PAL.rustD, { r: [0, 0, 1.5], p: [-1.0, 0.1, 0] }).add(cyl(0.3, 0.3, 0.03, 12), PAL.concreteD, { r: [0.1, 0, 1.5], p: [0.1, 0.12, 0.1] }));
  T('guardrail', b => { b.add(box, PAL.rust, { p: [0, 0.65, 0], s: [2.0, 0.28, 0.04], noise: 0.08 }); for (const x of [-0.9, 0.9]) b.add(cyl(0.04, 0.04, 0.9, 5), PAL.rustD, { p: [x, 0, 0] }); return b; });
  T('guardrailMetal', b => { b.add(box, PAL.metal, { p: [0, 0.65, 0], s: [2.0, 0.26, 0.04] }); for (const x of [-0.9, 0.9]) b.add(cyl(0.04, 0.04, 0.9, 5), PAL.concreteD, { p: [x, 0, 0] }); return b; });
  T('fenceBamboo', b => { for (const x of [-0.9, 0, 0.9]) b.add(cyl(0.03, 0.03, 1.0, 4), PAL.bamboo, { p: [x, 0, 0] }); for (const y of [0.35, 0.8]) b.add(cyl(0.025, 0.025, 2.0, 4), PAL.bambooD, { r: [0, 0, Math.PI / 2], p: [-1.0, y, 0.03] }); return b; });
  T('fenceWire', b => { for (const x of [-1.0, 1.0]) b.add(cyl(0.025, 0.025, 1.2, 4), PAL.metal, { p: [x, 0, 0] }); for (const y of [0.4, 0.8, 1.15]) b.add(cyl(0.008, 0.008, 2.0, 3), PAL.concreteD, { r: [0, 0, Math.PI / 2], p: [-1.0, y, 0] }); return b; });
  T('bollard', b => b.add(cyl(0.11, 0.1, 0.5, 6), PAL.woodD).add(cyl(0.12, 0.12, 0.05, 6), PAL.concreteD, { p: [0, 0.5, 0] }));

  // ---- boardwalk and coast
  T('plank', b => b.add(box, PAL.plank, { p: [0, 0.04, 0], s: [2.0, 0.08, 0.27], noise: 0.1 }));
  T('pile', b => b.add(cyl(0.09, 0.08, 1.0, 6), PAL.woodD, { noise: 0.08 }));
  T('beam', b => b.add(box, PAL.wood, { p: [0, 0, 0], s: [0.12, 0.14, 1.0], noise: 0.06 }));
  T('ropePost', b => b.add(cyl(0.035, 0.035, 0.95, 5), PAL.woodL));
  T('lifeRing', b => b.add(tor(0.2, 0.06), PAL.orange, { p: [0, 0.78, 0] }).add(tor(0.2, 0.062), PAL.white, { p: [0, 0.78, 0], r: [0, 0, 0.5], s: [1, 1, 0.5] }));
  T('lampSmall', b => b.add(cyl(0.05, 0.04, 1.7, 5), PAL.woodD).add(box, PAL.lampHead, { p: [0, 1.75, 0], s: [0.16, 0.14, 0.16] }));
  T('lampSmallGlow', b => b.add(box, PAL.glowWarm, { p: [0, 1.75, 0], s: [0.1, 0.09, 0.1] }));
  T('tetra', b => { const dirs = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]; for (const d of dirs) { const v = new THREE.Vector3(...d).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); const e = new THREE.Euler().setFromQuaternion(q); b.add(cyl(0.2, 0.15, 0.8, 5), PAL.concrete, { r: [e.x, e.y, e.z], p: [0, 0.55, 0], noise: 0.05 }); } return b; });
  T('drift', b => b.add(cyl(0.16, 0.12, 2.4, 5), PAL.log, { r: [0.1, 0.4, Math.PI / 2], p: [-1.2, 0.18, 0], noise: 0.1 }).add(cyl(0.05, 0.03, 0.7, 4), PAL.logD, { r: [0, 0, 0.7], p: [0.1, 0.25, 0.1] }));
  T('weedShadow', b => b.add(new THREE.CylinderGeometry(0.7, 0.7, 0.02, 7), '#1e3a4a', { p: [0, 0.01, 0], s: [1.3, 1, 0.9] }));
  T('seaMark', b => b.add(cyl(0.06, 0.05, 2.2, 5), PAL.woodD).add(box, PAL.red, { p: [0, 2.1, 0], s: [0.3, 0.3, 0.05] }));
  T('wallBlock', b => b.add(box, PAL.concrete, { p: [0, 0.5, 0], s: [1.9, 1.0, 0.8], noise: 0.05 }));

  // ---- W5 road parts: concrete barrier, milestone, bridge piers (column, cap, waterline foot, footing), navigation light, lamp pool
  T('barrierConcrete', b => { b.add(box, PAL.concrete, { p: [0, 0.4, 0], s: [1.98, 0.8, 0.3], noise: 0.04 }).add(box, PAL.concreteD, { p: [0, 0.78, 0], s: [1.98, 0.08, 0.34] }); for (const x of [-0.99, 0.99]) b.add(box, PAL.concreteD, { p: [x, 0.4, 0], s: [0.04, 0.8, 0.34] }); return b; });
  T('milestone', b => b.add(box, PAL.stone, { p: [0, 0.3, 0], s: [0.22, 0.6, 0.16], top: PAL.white, noise: 0.05 }).add(box, PAL.red, { p: [0, 0.62, 0], s: [0.23, 0.06, 0.17] }));
  T('pierColumn', b => b.add(box, PAL.concrete, { p: [0, 0.5, 0], s: [1.3, 1, 1.3], noise: 0.04, top: PAL.concreteD }));
  T('pierCap', b => b.add(box, PAL.concrete, { p: [0, -0.45, 0], s: [8.4, 0.9, 1.7], noise: 0.04 }).add(box, PAL.concreteD, { p: [0, -0.92, 0], s: [8.4, 0.08, 1.74] }));
  T('pierFoot', b => b.add(box, PAL.concreteD, { p: [0, 0, 0], s: [1.42, 1.7, 1.42], top: '#2e3b48', noise: 0.05 }));
  T('pierFooting', b => b.add(box, PAL.concreteD, { p: [0, 0.4, 0], s: [2.6, 0.8, 2.6], noise: 0.06 }));
  T('navLight', b => b.add(cyl(0.05, 0.05, 0.9, 5), PAL.metal).add(box, PAL.lampHead, { p: [0, 0.95, 0], s: [0.2, 0.16, 0.2] }));
  T('navLightGlow', b => b.add(box, '#ffb870', { p: [0, 0.95, 0], s: [0.14, 0.11, 0.14] }));
  T('lampPool', b => b.add(new THREE.CircleGeometry(3.4, 18).rotateX(-Math.PI / 2), '#ffd9a0', { p: [0, 0.03, 0] }));
  T('pylonTop', b => { for (const x of [-5.9, 5.9]) b.add(box, PAL.concrete, { p: [x, 6.5, 0], s: [1.1, 13, 1.1], noise: 0.04, top: PAL.concreteD }); return b.add(box, PAL.concrete, { p: [0, 12.5, 0], s: [12.9, 1.0, 1.0], noise: 0.04 }).add(box, PAL.concreteD, { p: [0, 7.6, 0], s: [11.8, 0.6, 0.8] }); });
  // ---- W5b: stone step block (origin at its underside, 1 m cube scaled per step), jizo statue, snow-route pole, orange refuge hut, spiral steel stair, gate post
  T('stoneStep', b => b.add(box, PAL.stone, { p: [0, 0.5, 0], s: [1, 1, 1], top: PAL.moss, noise: 0.07 }));
  T('jizo', b => b.add(box, PAL.stoneD, { p: [0, 0.1, 0], s: [0.5, 0.2, 0.5] }).add(cyl(0.18, 0.13, 0.55, 6), PAL.stone, { p: [0, 0.2, 0], noise: 0.06 }).add(ico(0.15, 0), PAL.stone, { p: [0, 0.82, 0] }).add(box, PAL.red, { p: [0, 0.6, 0.12], s: [0.26, 0.12, 0.04] }).add(cone(0.2, 0.14, 6), PAL.stoneD, { p: [0, 0.9, 0] }));
  T('snowPole', b => { for (let i = 0; i < 4; i++) b.add(cyl(0.045, 0.045, 0.5, 6), i % 2 ? PAL.white : PAL.red, { p: [0, i * 0.5, 0] }); return b.add(box, '#e6f4ff', { p: [0, 1.9, 0.05], s: [0.1, 0.2, 0.03] }); });
  T('snowPoleGlow', b => b.add(box, '#bfe4ff', { p: [0, 1.9, 0.075], s: [0.08, 0.16, 0.02] }));
  T('shelterOrange', b => b.add(box, PAL.orange, { p: [0, 0.9, 0], s: [2.6, 1.8, 2.0], noise: 0.05 }).add(box, '#f2f6fa', { p: [0, 1.88, 0], s: [2.8, 0.22, 2.2] }).add(box, PAL.woodD, { p: [0, 0.8, 1.01], s: [0.7, 1.4, 0.05] }).add(box, '#2c3a4c', { p: [0.8, 1.1, 1.01], s: [0.45, 0.4, 0.03] }));
  T('gatePost', b => b.add(box, PAL.stone, { p: [0, 0.7, 0], s: [0.34, 1.4, 0.34], top: PAL.moss, noise: 0.05 }).add(box, PAL.stoneD, { p: [0, 1.42, 0], s: [0.44, 0.1, 0.44] }));
  T('steelStep', b => b.add(box, PAL.metal, { p: [0, 0, 0], s: [0.26, 0.05, 0.8] }).add(box, PAL.concreteD, { p: [0, -0.04, 0], s: [0.22, 0.03, 0.78] }));
  T('steelPlate', b => b.add(box, PAL.metal, { p: [0, 0, 0], s: [1, 0.06, 1] }).add(box, PAL.concreteD, { p: [0, -0.05, 0], s: [0.96, 0.04, 0.96] }));
  T('steelPost', b => b.add(box, PAL.concreteD, { p: [0, 0.45, 0], s: [0.04, 0.9, 0.04] }));
  T('busBench', b => b.add(box, PAL.woodL, { p: [0, 0.45, 0], s: [1.5, 0.08, 0.4] }).add(box, PAL.woodD, { p: [-0.6, 0.22, 0], s: [0.08, 0.44, 0.36] }).add(box, PAL.woodD, { p: [0.6, 0.22, 0], s: [0.08, 0.44, 0.36] }));

  return { geometries: G, palette: PAL, builder, hash3 };
}

const FLORA = { PAL, make };
if (typeof module !== 'undefined' && module.exports) module.exports = FLORA;
else global.FLORA = FLORA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
