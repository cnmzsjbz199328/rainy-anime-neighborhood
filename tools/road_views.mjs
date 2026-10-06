// Shared by tools/road_shots.mjs, tools/road_check.mjs and tools/regress.mjs --views roads: the review shots of the W5 road network.
// A position is a reference into the generated roads: { route | bridge, s (metres along, may be negative or past the end: extended along the tangent), o (metres to the
// right of travel), dy (metres above the surface there) }, or { lon, lat, dy } over the terrain, or { sphere: [lon, lat], d } for a view from space.
// Cameras sit on the sphere with the bend basis, like tools/section_views.mjs.
export const INIT = `(() => {
  let s = 0x2f6e2b1;
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const queue = []; let frame = 0;
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.__step = n => { for (let i = 0; i < n; i++) { frame++; const ts = frame * 16.667, cbs = queue.splice(0); for (const cb of cbs) cb(ts); } return frame; };
  performance.now = () => frame * 16.667;
})();`;

const rt = (route, s, o = 0, dy = 1.6) => ({ route, s, o, dy });
const ch = (s, o = 0, dy = 1.6) => ({ chain: true, s, o, dy });      // the T03 chain of the W4 section (exit N08)
const br = (bridge, s, o = 0, dy = 1.6) => ({ bridge, s, o, dy });
const st = (stairs, s, o = 0, dy = 1.6) => ({ stairs, s, o, dy });
const pr = (bridge, pier, o = 0, dy = 1.6) => ({ bridge, pier, s: 0, o, dy });
const T2 = 'T02-02', T8 = 'T08-02', BR1 = 'T01-03', BR2 = 'T01-07+08+09', BR3 = 'T01-13';
// the nine town exits, ground view (eye 1.6 m in the left lane at the exit, looking out along the road) and a collage of all nine
export const EXITS = [['N01', rt('N01-west', 0.6, -1.4), rt('N01-west', 22, 0, 1.3)], ['N03', rt('N03-east', 0.6, -1.4), rt('N03-east', 19, 0, 1.3)], ['N04', rt('N04-T02', 0.6, -1.2), rt('N04-T02', 22, 0, 1.0)],
  ['N08', ch(0.6, -1.2), ch(24, 0, 1.0)], ['N09', rt('N09-T05', 0.6, -1.2), rt('N09-T05', 22, 0, 1.0)], ['N10', rt('N10-T04', 0.6, -1.2), rt('N10-T04', 22, 0, 1.0)],
  ['N11', rt('N11-T06', 0.4, -0.9), rt('N11-T06', 9.5, 0, 0.9)], ['N12', rt('N12-T06', 0.4, -0.9), rt('N12-T06', 7, 0, 0.9)], ['N13', rt('N13-T06', 0.4, -0.9), rt('N13-T06', 7, 0, 0.9)]];
export const SHOTS = [
  ...EXITS.map(([n, eye, look]) => [`exit-${n}`, { eye, look, fov: 62 }]),
  // ---- night panorama (clear moonlit night, light band on): four hemispheres along the T01 ring (about 12 degrees south), and the north pole
  ...[['east', 60], ['back-east', 150], ['back-west', -120], ['west', -40]].map(([n, lon]) => [`panorama-${n}`, { sphere: [lon, -12], d: 300, fov: 36, light: 'panorama', ink: 'panorama', rain: false, band: true }]),
  ['exit-N11-aerial', { eye: rt('N11-T06', 3, 7, 7), look: rt('N11-T06', 7, 0, 0), fov: 50 }],
  ['exit-N04-aerial', { eye: rt('N04-T02', 12, 12, 14), look: rt('N04-T02', 14, 0, 0), fov: 50 }],
  ['exit-N10-aerial', { eye: rt('N10-T04', 12, 12, 14), look: rt('N10-T04', 14, 0, 0), fov: 50 }],
  // ---- RD01: the town exit N03 (asphalt street -> RD01 with gravel shoulders), the exit N01, ground and aerial, rain
  ['rd01-exit-ground', { eye: rt('N03-east', 1, -1.7, 1.6), look: rt('N03-east', 26, 0.5, 1.2), fov: 62 }],
  ['rd01-exit-aerial', { eye: rt('N03-east', 4, 14, 17), look: rt('N03-east', 14, 0, 0), fov: 50 }],
  ['rd01-exit-looking-back', { eye: rt('N03-east', 24, 1.7, 1.7), look: rt('N03-east', 2, 0, 1.6), fov: 62 }],
  ['rd01-west-exit-ground', { eye: rt('N01-west', 1, -1.7, 1.6), look: rt('N01-west', 24, 0, 1.2), fov: 62 }],
  ['rd01-ridge-ground', { eye: rt('T01-ridge', 0.5, -1.7, 1.6), look: rt('T01-ridge', 18, 0, 2.0), fov: 62 }],
  // ---- RD02
  ['bridge-east-strait-ground', { eye: br(BR1, 6, -1.7, 1.7), look: br(BR1, 40, 0, 2.2), fov: 62 }],
  ['bridge-east-strait-aerial', { eye: br(BR1, 20, 26, 18), look: br(BR1, 27, 0, 0), fov: 50 }],
  ['bridge-pylon-ground', { eye: br(BR2, 100, -1.7, 1.7), look: br(BR2, 125, 0, 9), fov: 62 }],
  ['bridge-pylon-aerial', { eye: br(BR2, 128, 34, 22), look: br(BR2, 112, 0, 6), fov: 50 }],
  ['bridge-dateline-seam', { eye: br(BR2, 90, 14, 6), look: br(BR2, 99, 0, 3), fov: 55 }],
  ['bridge-pylon-sea', { eye: br(BR2, 96, 22, 1.2), look: br(BR2, 112, 0, 8), fov: 55 }],
  ['bridge-navlight-close', { eye: pr(BR2, 5, 9, 1.6), look: pr(BR2, 5, 3.38, 1.4), fov: 45 }],
  ['bridge-navlight-night', { eye: pr(BR2, 5, 14, 2.0), look: pr(BR2, 6, 0, 3.0), fov: 55, rain: false }],
  ['junction-abutment-J-E1', { eye: rt('N03-east', 6, 8, 4), look: br(BR1, 8, 0, 1.0), fov: 62 }],
  ['junction-abutment-aerial', { eye: rt('N03-east', 8, 20, 16), look: br(BR1, 6, 0, 2), fov: 50 }],
  ['tunnel-portal-east', { eye: rt('T01-ridge', 0.5, -1.7, 1.6), look: rt('T01-ridge', 12, 0, 2.5), fov: 62 }],
  ['tunnel-portal-aerial', { eye: rt('T01-ridge', -2, 16, 14), look: rt('T01-ridge', 11, 0, 3), fov: 50 }],
  ['tunnel-portal-west-ground', { eye: rt('T01-ridge', 43, -1.7, 1.6), look: rt('T01-ridge', 30, 0, 2.5), fov: 62 }],
  ['rd01-west-ground', { eye: rt('T01-west', 2, -1.7, 1.6), look: rt('T01-west', 30, 0, 1.2), fov: 62 }],
  ['rd01-west-aerial', { eye: rt('T01-west', 6, 16, 16), look: rt('T01-west', 22, 0, 0), fov: 50 }],
  ['junction-T04-aerial', { eye: rt('N10-T04', 22, 14, 14), look: rt('N10-T04', 30, 0, 0), fov: 50 }],
  // other local weather (clear night) and the neutral-light material study (not a daytime state, D9)
  ['bridge-clear-night', { eye: br(BR1, 6, -1.7, 1.7), look: br(BR1, 40, 0, 2.2), fov: 62, rain: false }],
  ['rd01-clear-night-aerial', { eye: rt('T01-west', 6, 16, 16), look: rt('T01-west', 22, 0, 0), fov: 50, rain: false }],
  ['bridge-neutral-aerial', { eye: br(BR1, 20, 26, 18), look: br(BR1, 27, 0, 0), fov: 50, light: 'neutral', rain: false }],
  // ---- W5b: RD06 stone stairs (T02-02 up the volcano, T08-02 to the stone circle), RD08 snow route, RD05 branches, RD03 furniture, the T11-02 maintenance stair, entrances
  ['stairs-T02-ground', { eye: st(T2, 3, 0, 1.7), look: st(T2, 24, 0, 3.0), fov: 62 }],
  ['stairs-T02-steep-ground', { eye: st(T2, 40, 0.3, 1.7), look: st(T2, 58, 0, 4.5), fov: 62 }],
  ['stairs-T02-aerial', { eye: st(T2, 38, 16, 14), look: st(T2, 46, 0, 5), fov: 50 }],
  ['stairs-T02-lanterns', { eye: st(T2, 66, 2.5, 2.0), look: st(T2, 84, 0, 5), fov: 62 }],
  ['stairs-T02-clear-night', { eye: st(T2, 66, 2.5, 2.0), look: st(T2, 84, 0, 5), fov: 62, rain: false }],
  ['stairs-T08-ground', { eye: st(T8, 2, 0, 1.7), look: st(T8, 26, 0, 1.8), fov: 62 }],
  ['stairs-T08-aerial', { eye: st(T8, 60, 14, 12), look: st(T8, 64, 0, 5), fov: 50 }],
  ['junction-T08b-rd05-rd06', { eye: rt('T08-RD05', 36, 1.2, 1.7), look: st(T8, 5, 0, 1.0), fov: 62 }],
  ['rd08-ground', { eye: rt('T10-RD08', 0.5, 0, 1.6), look: rt('T10-RD08', 26, 0, 1.6), fov: 62 }],
  ['rd08-aerial', { eye: rt('T10-RD08', 6, 12, 12), look: rt('T10-RD08', 16, 0, 0), fov: 50 }],
  ['rd08-shelter', { eye: rt('T10-RD08', 12, 7, 2.0), look: rt('T10-RD08', 17.5, 3.6, 1.0), fov: 55 }],
  ['rd08-poles-dashed', { eye: rt('T10-RD08', -2, 3, 9), look: rt('T10-RD08', 30, 0, 0), fov: 50, rain: false }],
  ['panorama-north', { sphere: [30, 75], d: 300, fov: 36, light: 'panorama', ink: 'panorama', rain: false, band: true }],
  ['rd05-T07-ground', { eye: rt('T07-RD05', 0.5, 0, 1.6), look: rt('T07-RD05', 9, 0, 1.2), fov: 62 }],
  ['rd05-T09-stakes-ground', { eye: rt('T09-RD05', 0.5, 0, 1.6), look: rt('T09-RD05', 8, 0, 1.0), fov: 62 }],
  ['rd05-T08-aerial', { eye: rt('T08-RD05', 8, 12, 12), look: rt('T08-RD05', 16, 0, 0), fov: 50 }],
  ['rd03-N04-ground', { eye: rt('N04-T02', 8, -1.0, 1.6), look: rt('N04-T02', 36, 0.5, 2.5), fov: 62 }],
  ['rd03-N04-aerial', { eye: rt('N04-T02', 22, 14, 14), look: rt('N04-T02', 26, 0, 3), fov: 50 }],
  ['rd03-N10-junction', { eye: rt('N10-T04', 14, 1.6, 1.6), look: rt('N10-T04', 27, 0, 1.6), fov: 62 }],
  ['rd03-N09-jizo', { eye: rt('N09-T05', 20, 1.2, 1.6), look: rt('N09-T05', 31, 3, 1.0), fov: 62 }],
  ['t11-02-stair-ground', { eye: { ...br(BR2, 121, -10.5, 1.7), g: true }, look: br(BR2, 114.5, -6.3, 3.0), fov: 62 }],
  ['t11-02-stair-aerial', { eye: br(BR2, 124, -22, 14), look: br(BR2, 114, -6, 3), fov: 50 }],
  ['t11-02-landing', { eye: { ...br(BR2, 118, -9.0, 1.7), g: true }, look: br(BR2, 112.5, -5.6, 1.2), fov: 55 }],
  ['entrance-LM02-east', { eye: rt('N04-T02', 40, 0, 1.6), look: rt('N04-T02', 50.2, 0, 1.2), fov: 62 }],
  ['entrance-LM03-north', { eye: rt('T07-RD05', 6, 0, 1.6), look: rt('T07-RD05', 15.5, 0, 1.0), fov: 62 }],
  ['entrance-LM01-west', { eye: st(T2, 74, 0, 1.7), look: st(T2, 85.9, 0, 3), fov: 62 }],
  ['entrance-LM06-north', { eye: rt('T09-RD05', 5, 0, 1.6), look: rt('T09-RD05', 14, 0, 1.0), fov: 62 }],
  ['bridge-piers-close', { eye: br(BR1, 30, 16, 1.5), look: br(BR1, 28, 0, -1.2), fov: 55 }],
];

// Render one shot on a page that already has INIT and the built scene; returns the canvas as a PNG data URL plus renderer info and the ink weights.
export async function renderShot(page, v, opts = {}) {
  return await page.evaluate(([v, opts]) => {
    const S = window.__scene, T = window.THREE, R = 90, D = Math.PI / 180, B = S.bend, cam = S.camera, SEC = S.section, RD = S.roads;
    B.set(1); SEC.setMode(true); SEC.ensure(); RD.ensure(); S.landmarks.build(); const OC = S.ocean; if (OC) OC.ensure(); const LC = S.cover; if (LC) LC.ensure();
    SEC.set({ rain: v.rain !== false, light: v.light || 'rainy', ink: v.ink || 'auto' });
    const fog0 = S.scene.fog.density, DATA = RD.data();
    const flat = (lon, lat) => [R * lon * D, -R * Math.asinh(Math.tan(lat * D))];
    const basis = (x, z) => { const b = B.basis(x, z); return { east: new T.Vector3(...b.east), up: new T.Vector3(...b.up), south: new T.Vector3(...b.south) }; };
    // resolve a reference to { lon, lat, alt }: along a route or bridge by distance s (extended past the ends along the end tangent), lateral offset o to the right
    const resolve = ref => {
      if (ref.chain) { const CH = SEC.state.chain, Sm = CH.samples; let i = 0, s = Math.max(0, Math.min(CH.length, ref.s)); while (i + 2 < Sm.length && Sm[i + 1].s < s) i++; const t = (s - Sm[i].s) / Math.max(1e-6, Sm[i + 1].s - Sm[i].s), W = window.WORLD, brg = W.bearing(Sm[i], Sm[i + 1]); let p = { lon: Sm[i].lon + (Sm[i + 1].lon - Sm[i].lon) * t, lat: Sm[i].lat + (Sm[i + 1].lat - Sm[i].lat) * t }; if (ref.o) p = W.destination(p, brg + (ref.o > 0 ? 90 : -90), Math.abs(ref.o)); return { lon: p.lon, lat: p.lat, alt: Sm[i].h + 0.03 + (ref.dy || 0) }; }
      if (ref.lm) {                            // a point in a landmark's local frame: { lm: 'LM01', x, y, z } (origin = anchor, +Z towards the first entrance, +X to the left of +Z, y above the anchor altitude)
        const W = window.WORLD, lm = W.landmarks.find(q => q.id === ref.lm), info = S.landmarks.info[ref.lm], x = ref.x || 0, z = ref.z || 0;
        const d = Math.hypot(x, z), brg = info.heading + (d < 1e-9 ? 0 : Math.atan2(-x, z) / D); const p = d < 1e-9 ? { lon: lm.lon, lat: lm.lat } : W.destination({ lon: lm.lon, lat: lm.lat }, brg, d);
        return { lon: p.lon, lat: p.lat, alt: info.height + (ref.y || 0) };
      }
      if (ref.cover) {                         // a point in the fields: { cover: { kind: 'water' | 'dry' | 'fallow' | 'terrace' | 'edge', at }, de, dn (metres east / north), dy }
        const W = window.WORLD, LD = window.LANDCOVER_API.data(); let p;
        const pickItem = (types, pred) => { const list = LD.items.filter(i => types.includes(i.type) && (!pred || pred(i))); if (!list.length) throw new Error('no item ' + types); return list[Math.floor(list.length * ref.cover.at)]; };
        if (ref.cover.kind === 'lava') p = W.regions.find(q => q.kind === 'lava').shape.center ? { lon: W.regions.find(q => q.kind === 'lava').shape.center[0], lat: W.regions.find(q => q.kind === 'lava').shape.center[1] } : null;
        else if (ref.cover.kind === 'ice') p = { lon: ref.cover.lon ?? 40, lat: ref.cover.lat ?? 80 };
        else if (ref.cover.kind === 'icecliff') { const e = W.regions.find(q => q.id === 'ice-north').shape.edge, lo = ref.cover.lon ?? 100; p = { lon: lo, lat: e(lo) + 1.0 / (R * D) }; }
        else if (ref.cover.kind === 'peak') { const mp = W.heightField.features.find(q => q.id === (ref.cover.id || 'ameni-dake')); p = W.destination({ lon: mp.lon, lat: mp.lat }, ref.cover.bearing ?? 200, ref.cover.dist ?? 18); }
        else if (ref.cover.kind === 'grass') { const it = pickItem(['tuft'], i => W.regionAt(i.lon, i.lat).kind === 'grassland' && W.regionAt(i.lon, i.lat).id === 'default-grassland' && W.townPatchDistance(i.lon, i.lat) > 20 && Math.abs(i.lat) < 60 && W.height(i.lon, i.lat) < 4); p = { lon: it.lon, lat: it.lat }; }
        else if (ref.cover.kind === 'desert') { const it = pickItem(['dryShrub'], i => true); p = { lon: it.lon, lat: it.lat }; }
        else if (ref.cover.kind === 'desertedge') { const it = pickItem(['weed'], i => W.regionAt(i.lon, i.lat).kind === 'grassland' && W.regionAt(i.lon, i.lat).id === 'default-grassland' && i.lon < -100 && i.lon > -150 && i.lat < -10 && i.lat > -66); p = { lon: it.lon, lat: it.lat }; }
        else if (ref.cover.kind === 'pillar') { const it = pickItem(['rockPillar'], i => true); p = { lon: it.lon, lat: it.lat }; }
        else if (ref.cover.kind === 'forest') { const it = pickItem(['cedar', 'treeRound'], i => W.regionAt(i.lon, i.lat).id === (ref.cover.region || 'forest-east')); p = { lon: it.lon, lat: it.lat }; }
        else if (ref.cover.kind === 'forestedge') { const it = pickItem(['treeRound'], i => i.s[0] < 0.8 && i.s[0] > 0.4 && W.regionAt(i.lon, i.lat).id === (ref.cover.region || 'forest-east')); p = { lon: it.lon, lat: it.lat }; }
        else if (ref.cover.kind === 'terrace') p = { lon: -4, lat: 50 }; else if (ref.cover.kind === 'edge') p = W.townToLonLat(48 + 2, ref.cover.at * 40 - 20); else { const list = LD.cells.filter(c => c.kind === ref.cover.kind && c.area > 18 && c.group === 'farm' && W.townPatchDistance(c.seed.lon, c.seed.lat) > 6 && W.townPatchDistance(c.seed.lon, c.seed.lat) < 30); if (!list.length) throw new Error('no ' + ref.cover.kind + ' cell'); const c = list[Math.floor(list.length * ref.cover.at)]; p = { lon: c.seed.lon, lat: c.seed.lat }; }
        if (ref.de) p = W.destination(p, ref.de > 0 ? 90 : 270, Math.abs(ref.de)); if (ref.dn) p = W.destination(p, ref.dn > 0 ? 0 : 180, Math.abs(ref.dn));
        return { lon: p.lon, lat: p.lat, alt: Math.max(0, W.height(p.lon, p.lat)) + (ref.dy || 0) };
      }
      if (ref.coast) {                       // a point on the coast: { coast: { kind: 'beach' | 'rocky' | 'wall', at: 0..1 }, t: metres along, o: metres seaward (+) or inland (-), dy }
        const W = window.WORLD, OD = window.OCEAN_API.data(); let m;
        if (ref.coast.kind === 'wall') { const list = OD.instances.filter(q => q.type === 'wallBlock'); const q = list[Math.floor(list.length * ref.coast.at)]; m = OD.mids.reduce((b, c) => { const d = Math.hypot(c.lon - q.lon, c.lat - q.lat); return d < b.d ? { d, c } : b; }, { d: 9, c: null }).c; }
        else { const rs = [...DATA.routes.flatMap(r => r.samples.filter((_, i) => i % 4 === 0)), ...DATA.bridges.flatMap(b => b.samples.filter((_, i) => i % 4 === 0)), ...DATA.stairs.flatMap(s => s.samples.filter((_, i) => i % 4 === 0))];
          const farFromRoads = c => rs.every(p => Math.abs(p.lat - c.lat) * R * D > 30 || W.arcDistance(p, c) > 30);
          const list = OD.mids.filter(c => c.len > 0.8 && farFromRoads(c) && (ref.coast.kind === 'beach' ? W.regionAt(c.lon, c.lat).zone === 'building' : W.regionAt(c.lon, c.lat).zone === 'wild' && W.regionAt(c.lon, c.lat).kind !== 'ice-north' && W.regionAt(c.lon, c.lat).id !== 'island-lm08')); if (!list.length) throw new Error('no coast point for ' + ref.coast.kind); m = list[Math.floor(list.length * ref.coast.at)]; }
        const tb = Math.atan2(m.tx, -m.tz) / D; let p = ref.t ? W.destination(m, tb, ref.t) : m;
        const a = W.destination(p, tb + 90, 2), b = W.destination(p, tb - 90, 2), seaB = W.height(a.lon, a.lat) < W.height(b.lon, b.lat) ? tb + 90 : tb - 90;
        if (ref.o) p = W.destination(p, ref.o > 0 ? seaB : seaB + 180, Math.abs(ref.o));
        return { lon: p.lon, lat: p.lat, alt: Math.max(0, W.height(p.lon, p.lat)) + (ref.dy || 0) };
      }
      if (ref.lon !== undefined) return { lon: ref.lon, lat: ref.lat, alt: (ref.sea ? Math.max(0, window.WORLD.height(ref.lon, ref.lat)) : window.WORLD.height(ref.lon, ref.lat)) + (ref.dy || 0) };
      if (ref.pier !== undefined) ref = { ...ref, s: DATA.bridges.find(b => b.def.id === ref.bridge).piers[ref.pier].s };
      const item = ref.stairs ? DATA.stairs.find(q => q.id === ref.stairs) : ref.route ? DATA.routes.find(r => r.def.id === ref.route) : DATA.bridges.find(b => b.def.id === ref.bridge), Sm = item.samples, alt = ref.stairs ? item.profile : ref.route ? (item.bed || item.samples.map((p, i) => item.surface(i, 0))) : item.alt;
      const L = Sm[Sm.length - 1].s; let s = Math.max(0, Math.min(L, ref.s)), i = 0; while (i + 2 < Sm.length && Sm[i + 1].s < s) i++;
      const t = (s - Sm[i].s) / Math.max(1e-6, Sm[i + 1].s - Sm[i].s), lon = Sm[i].lon + (Sm[i + 1].lon - Sm[i].lon) * t, lat = Sm[i].lat + (Sm[i + 1].lat - Sm[i].lat) * t, a0 = alt[i] + (alt[i + 1] - alt[i]) * t;
      const W = window.WORLD, brg = W.bearing(Sm[i], Sm[i + 1]); let p = { lon, lat };
      if (ref.s < 0 || ref.s > L) { const q = W.destination(p, ref.s < 0 ? brg + 180 : brg, Math.abs(ref.s < 0 ? ref.s : ref.s - L)); p = q; }
      if (ref.o) p = W.destination(p, brg + (ref.o > 0 ? 90 : -90), Math.abs(ref.o));
      // altitude: on the bed or deck along the road; beside it follow the terrain when more than the road half width away
      const g = W.height(p.lon, p.lat), onRoad = Math.abs(ref.o || 0) < 5.2;
      return { lon: p.lon, lat: p.lat, alt: (ref.g ? g : onRoad ? a0 : Math.max(g, a0 - 2)) + (ref.dy || 0) };
    };
    const place = ref => { const r = resolve(ref), [x, z] = flat(r.lon, r.lat), k = 1 / Math.cos(r.lat * D); return { x, z, p: B.point(x, (r.alt - 1.6) * k, z, 1), b: basis(x, z), r }; };
    if (v.eye && !opts.noStep) { const e0 = place({ ...v.eye, dy: 0 }); S.view.set({ mode: 'section', target: [e0.x, 0.8, e0.z] }); window.__step(3); }
    cam.near = 0.1; cam.far = 700;
    if (v.glintAt) {                          // the camera placed so that the moon's mirror image falls on the planet at [lon, lat]
      const [lon, lat] = v.glintAt, cp = Math.cos(lat * D), n = new T.Vector3(cp * Math.sin(lon * D), cp * Math.cos(lon * D), -Math.sin(lat * D)), L = S.ocean.uniforms.uMoon.value.clone().normalize(), Vd = n.clone().multiplyScalar(2 * n.dot(L)).sub(L).normalize();
      const north = new T.Vector3(-Math.sin(lat * D) * Math.sin(lon * D), -Math.sin(lat * D) * Math.cos(lon * D), -cp), c = new T.Vector3(0, -R, 0);
      cam.position.copy(c).addScaledVector(Vd, v.d); cam.up.copy(new T.Vector3(0, 1, 0)); cam.lookAt(c);
    } else if (v.sphere) {
      const [lon, lat] = v.sphere, cp = Math.cos(lat * D), dir = new T.Vector3(cp * Math.sin(lon * D), cp * Math.cos(lon * D), -Math.sin(lat * D));
      const north = new T.Vector3(-Math.sin(lat * D) * Math.sin(lon * D), -Math.sin(lat * D) * Math.cos(lon * D), -cp), c = new T.Vector3(0, -R, 0);
      cam.position.copy(c).addScaledVector(dir, v.d); cam.up.copy(north); cam.lookAt(c);
    } else {
      const e = place(v.eye), l = place(v.look);
      cam.position.set(...e.p); cam.up.copy(e.b.up);
      if (v.upLocal) { const o = place({ lm: v.eye.lm, x: 0, y: 0, z: 0 }), q = place({ lm: v.eye.lm, x: v.upLocal[0], y: v.upLocal[1], z: v.upLocal[2] }); cam.up.set(q.p[0] - o.p[0], q.p[1] - o.p[1], q.p[2] - o.p[2]).normalize(); }
      cam.lookAt(new T.Vector3(...l.p));
    }
    cam.fov = v.fov || 36; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    S.scene.fog.density = ['panorama', 'neutral'].includes(v.light) ? 0 : fog0;
    if (v.band) RD.setLightBand({ distance: 300 }); else RD.setLightBand({ auto: true });
    const t = opts.t ?? 1.2; SEC.tick(t, cam); RD.tick(t, cam); OC && OC.tick(t, cam); LC && LC.tick(t, cam); SEC.tick(t, cam); RD.tick(t, cam); OC && OC.tick(t, cam); LC && (LC.tick(t, cam), LC.reload(cam)); SEC.forceLod(cam);
    if (v.lmT != null) for (const q of S.landmarks.fx) q.update(v.lmT);                  // freeze the landmark clue light at a phase (W7)
    const hiddenCut = []; if (v.lmCut) for (const g of Object.values(S.landmarks.info).flatMap(q => q.groups || [])) g.traverse(o => { if (o.userData && v.lmCut.includes(o.userData.layer) && o.visible) { o.visible = false; hiddenCut.push(o); } });
    if (opts.noOcean && OC) OC.state.root.visible = false; if (opts.noCover && LC) LC.state.root.visible = false; if (opts.noLandmarks) for (const g of Object.values(S.landmarks.info).flatMap(q => q.groups || [])) { g.userData._v = g.visible; g.visible = false; } if (opts.noRoads) RD.state.root.visible = false;     // cost measurement with the same camera
    const t0 = Date.now(); S.renderer.render(S.scene, cam); S.renderer.getContext().finish(); const ms = Date.now() - t0;
    const url = S.renderer.domElement.toDataURL('image/png'), info = { calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles, ms };
    for (const o of hiddenCut) o.visible = true;
    if (opts.noOcean && OC) OC.state.root.visible = true; if (opts.noCover && LC) LC.state.root.visible = true; if (opts.noLandmarks) for (const g of Object.values(S.landmarks.info).flatMap(q => q.groups || [])) g.visible = g.userData._v; if (opts.noRoads) RD.state.root.visible = true;
    cam.fov = 36; cam.near = 0.25; cam.far = 400; cam.up.set(0, 1, 0); cam.updateProjectionMatrix(); S.scene.fog.density = fog0; SEC.set({ light: 'rainy', ink: 'auto' });
    return { url, info, ink: SEC.get().ink };
  }, [v, opts]);
}
