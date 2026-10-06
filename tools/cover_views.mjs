// Review shots of the land cover (W6b: fields, terraces, town edges); renderShot, INIT and the position references come from tools/road_views.mjs.
// { cover: { kind: 'water' | 'dry' | 'fallow' | 'terrace' | 'edge', at: 0..1 }, de, dn (metres east / north), dy } picks a point in the fields.
export { INIT, renderShot } from './road_views.mjs';
const f = (kind, at, de = 0, dn = 0, dy = 1.6) => ({ cover: { kind, at }, de, dn, dy });
export const SHOTS = [
  // BI05 paddies, dry fields, TR04 fallow fields: ground and aerial in rain, clear night, neutral aerial
  ['farm-paddy-ground', { eye: f('water', 0.3, -4, 0, 1.6), look: f('water', 0.3, 8, 0, 0.3), fov: 62 }],
  ['farm-paddy-aerial', { eye: f('water', 0.3, -12, -6, 14), look: f('water', 0.3, 2, 0, 0), fov: 50 }],
  ['farm-paddy-clear-night', { eye: f('water', 0.3, -4, 0, 1.6), look: f('water', 0.3, 8, 0, 0.3), fov: 62, rain: false }],
  ['farm-paddy-neutral-aerial', { eye: f('water', 0.3, -12, -6, 14), look: f('water', 0.3, 2, 0, 0), fov: 50, light: 'neutral', rain: false }],
  ['farm-dry-ground', { eye: f('dry', 0.4, -4, 0, 1.6), look: f('dry', 0.4, 8, 0, 0.4), fov: 62 }],
  ['farm-dry-aerial', { eye: f('dry', 0.4, -12, -6, 14), look: f('dry', 0.4, 2, 0, 0), fov: 50 }],
  ['farm-fallow-ground', { eye: f('fallow', 0.5, -4, 0, 1.6), look: f('fallow', 0.5, 8, 0, 0.6), fov: 62 }],
  ['farm-fallow-aerial', { eye: f('fallow', 0.5, -12, -6, 14), look: f('fallow', 0.5, 2, 0, 0), fov: 50 }],
  ['farm-mixed-aerial', { eye: f('water', 0.6, -26, -20, 30), look: f('water', 0.6, 0, 0, 0), fov: 55 }],
  // BI06 terraces and tea
  ['terrace-ground', { eye: f('terrace', 0, 13, -9, 1.6), look: f('terrace', 0, 0, 0, 5.0), fov: 62 }],
  ['terrace-aerial', { eye: f('terrace', 0, 22, -14, 20), look: f('terrace', 0, 0, 0, 3), fov: 50 }],
  ['terrace-tea-close', { eye: f('terrace', 0, 9, -5, 7.0), look: f('terrace', 0, 2, 0, 3.0), fov: 55 }],
  ['terrace-clear-night', { eye: f('terrace', 0, 22, -14, 20), look: f('terrace', 0, 0, 0, 3), fov: 50, rain: false }],
  // TR01 town edge
  ['edge-ground', { eye: f('edge', 0.2, 4, 0, 1.6), look: f('edge', 0.2, 0, 14, 1.2), fov: 62 }],
  ['edge-aerial', { eye: f('edge', 0.3, 14, -10, 14), look: f('edge', 0.3, -2, 6, 0), fov: 50 }],
  // BI02 forest and TR03 forest edge (W6c): ground and aerial in rain, clear night, neutral aerial, the edge, a clearing; the four forest regions
  ['forest-ground', { eye: f('forest', 0.4, -3, 0, 1.6), look: f('forest', 0.4, 7, 2, 2.4), fov: 62 }],
  ['forest-aerial', { eye: f('forest', 0.4, -14, -8, 22), look: f('forest', 0.4, 2, 0, 3), fov: 50 }],
  ['forest-clear-night', { eye: f('forest', 0.4, -3, 0, 1.6), look: f('forest', 0.4, 7, 2, 2.4), fov: 62, rain: false }],
  ['forest-neutral-aerial', { eye: f('forest', 0.4, -14, -8, 22), look: f('forest', 0.4, 2, 0, 3), fov: 50, light: 'neutral', rain: false }],
  ['forest-edge-ground', { eye: f('forestedge', 0.3, -4, -3, 1.6), look: f('forestedge', 0.3, 8, 4, 1.4), fov: 62 }],
  ['forest-edge-aerial', { eye: f('forestedge', 0.3, -10, -14, 16), look: f('forestedge', 0.3, 2, 2, 0), fov: 50 }],
  ['forest-edge-clear-night', { eye: f('forestedge', 0.3, -4, -3, 1.6), look: f('forestedge', 0.3, 8, 4, 1.4), fov: 62, rain: false }],
  ['forest-west-aerial', { eye: { ...f('forest', 0.5, -12, -8, 20), cover: { kind: 'forest', at: 0.5, region: 'forest-west' } }, look: { ...f('forest', 0.5, 2, 0, 3), cover: { kind: 'forest', at: 0.5, region: 'forest-west' } }, fov: 50 }],
  ['forest-south-aerial', { eye: { ...f('forest', 0.5, -12, -8, 20), cover: { kind: 'forest', at: 0.5, region: 'forest-south' } }, look: { ...f('forest', 0.5, 2, 0, 3), cover: { kind: 'forest', at: 0.5, region: 'forest-south' } }, fov: 50 }],
  ...[['east', 95, 0], ['northeast', 25, 52], ['west', -128, 38], ['south', -10, -45]].map(([n, lon, lat]) => [`forest-panorama-${n}`, { sphere: [lon, lat], d: 300, fov: 36, light: 'panorama', ink: 'panorama', rain: false, band: true }]),
  // BI03 grassland, BI04 desert, TR07 (W6d)
  ['grass-ground', { eye: f('grass', 0.4, -3, 0, 1.6), look: f('grass', 0.4, 9, 2, 0.9), fov: 62 }],
  ['grass-aerial', { eye: f('grass', 0.4, -14, -8, 20), look: f('grass', 0.4, 2, 0, 0), fov: 50 }],
  ['grass-clear-night', { eye: f('grass', 0.4, -3, 0, 1.6), look: f('grass', 0.4, 9, 2, 0.9), fov: 62, rain: false }],
  ['grass-neutral-aerial', { eye: f('grass', 0.4, -14, -8, 20), look: f('grass', 0.4, 2, 0, 0), fov: 50, light: 'neutral', rain: false }],
  ['desert-ground', { eye: f('desert', 0.4, -4, 0, 1.6), look: f('desert', 0.4, 10, 3, 1.2), fov: 62 }],
  ['desert-aerial', { eye: f('desert', 0.4, -16, -10, 24), look: f('desert', 0.4, 2, 0, 0), fov: 50 }],
  ['desert-clear-night', { eye: f('desert', 0.4, -4, 0, 1.6), look: f('desert', 0.4, 10, 3, 1.2), fov: 62, rain: false }],
  ['desert-neutral-aerial', { eye: f('desert', 0.4, -16, -10, 24), look: f('desert', 0.4, 2, 0, 0), fov: 50, light: 'neutral', rain: false }],
  ['desert-pillar-ground', { eye: f('pillar', 0.3, -9, -2, 1.8), look: f('pillar', 0.3, 0, 0, 5), fov: 62 }],
  ['desert-edge-ground', { eye: f('desertedge', 0.3, -4, 0, 1.6), look: f('desertedge', 0.3, 12, 2, 0.6), fov: 62 }],
  ['desert-edge-aerial', { eye: f('desertedge', 0.3, -14, -8, 18), look: f('desertedge', 0.3, 4, 0, 0), fov: 50 }],
  ...[['west', -125, -40], ['southwest', -125, -55], ['grass-south', 20, -35]].map(([n, lon, lat]) => [`desert-panorama-${n}`, { sphere: [lon, lat], d: 300, fov: 36, light: 'panorama', ink: 'panorama', rain: false, band: true }]),
  // BI07 ice, BI08 lava, BI09 mountains and TR05 snow line, TR06 lava edge (W6e)
  ['ice-ground', { eye: f('ice', 0, 0, 0, 1.6), look: f('ice', 0, 10, 4, 0.8), fov: 62 }],
  ['ice-aerial', { eye: f('ice', 0, -14, -10, 18), look: f('ice', 0, 2, 0, 0), fov: 50 }],
  ['ice-clear-night', { eye: f('ice', 0, 0, 0, 1.6), look: f('ice', 0, 10, 4, 0.8), fov: 62, rain: false }],
  ['ice-neutral-aerial', { eye: f('ice', 0, -14, -10, 18), look: f('ice', 0, 2, 0, 0), fov: 50, light: 'neutral', rain: false }],
  ['ice-cliff-aerial', { eye: f('icecliff', 0, 0, -12, 14), look: f('icecliff', 0, 0, 2, 2), fov: 50 }],
  ['ice-cliff-ground', { eye: f('icecliff', 0, 0, -10, 1.8), look: f('icecliff', 0, 0, 2, 3), fov: 62 }],
  ['lava-ground', { eye: f('lava', 0, -5, 0, 1.6), look: f('lava', 0, 6, 2, 0.4), fov: 62 }],
  ['lava-aerial', { eye: f('lava', 0, -14, -10, 18), look: f('lava', 0, 0, 0, 0), fov: 50 }],
  ['lava-clear-night', { eye: f('lava', 0, -5, 0, 1.6), look: f('lava', 0, 6, 2, 0.4), fov: 62, rain: false }],
  ['lava-neutral-aerial', { eye: f('lava', 0, -14, -10, 18), look: f('lava', 0, 0, 0, 0), fov: 50, light: 'neutral', rain: false }],
  ['mountain-ground', { eye: f('peak', 0, 0, 0, 3.0), look: { ...f('peak', 0, 0, 0, 12), cover: { kind: 'peak', at: 0, dist: 4, bearing: 20 } }, fov: 62 }],
  ['mountain-aerial', { eye: { ...f('peak', 0, 0, 0, 22), cover: { kind: 'peak', dist: 40, bearing: 200 } }, look: { ...f('peak', 0, 0, 0, 12), cover: { kind: 'peak', dist: 3, bearing: 20 } }, fov: 50 }],
  ['mountain-clear-night', { eye: { ...f('peak', 0, 0, 0, 3.0), cover: { kind: 'peak', dist: 24, bearing: 200 } }, look: { ...f('peak', 0, 0, 0, 12), cover: { kind: 'peak', dist: 3, bearing: 20 } }, fov: 62, rain: false }],
  ['mountain-snowline-aerial', { eye: { ...f('peak', 0, 0, 0, 14), cover: { kind: 'peak', dist: 30, bearing: 150 } }, look: { ...f('peak', 0, 0, 0, 16), cover: { kind: 'peak', dist: 4, bearing: 330 } }, fov: 50, rain: false }],
  ...[['north', 10, 70], ['volcano', -25, 40], ['east-ridge', 90, 5], ['south-ice', 150, -72]].map(([n, lon, lat]) => [`highland-panorama-${n}`, { sphere: [lon, lat], d: 300, fov: 36, light: 'panorama', ink: 'panorama', rain: false, band: true }]),
  // night panoramas of the main farmland (clear moonlit night)
  ...[['town', 0, -20], ['east', 70, 0], ['west', -70, 0], ['far-west', -126, 0]].map(([n, lon, lat]) => [`farm-panorama-${n}`, { sphere: [lon, lat], d: 300, fov: 36, light: 'panorama', ink: 'panorama', rain: false, band: true }]),
];
