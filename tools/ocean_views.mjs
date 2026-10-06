// Review shots of the ocean and coast (W6a); renderShot, INIT and the position references come from tools/road_views.mjs.
// { coast: { kind: 'beach' | 'rocky' | 'wall', at: 0..1 }, t, o (metres seaward +, inland -), dy } picks a point of the global coast; { lon, lat, sea: true, dy } a point over the water.
export { INIT, renderShot } from './road_views.mjs';
const c = (kind, at, o = 0, dy = 1.6, t = 0) => ({ coast: { kind, at }, o, dy, t });
const LM08 = { lon: 190, lat: -8 };
export const SHOTS = [
  // BI01 + TR02: a beach, a rocky shore, the sea wall beside a road, at the three distances (rain on ground and aerial), plus clear night and neutral light
  ['coast-beach-ground', { eye: c('beach', 0.3, -3, 1.6), look: c('beach', 0.3, 14, 0.3), fov: 62 }],
  ['coast-beach-aerial', { eye: c('beach', 0.3, 14, 12), look: c('beach', 0.3, -3, 0), fov: 50 }],
  ['coast-beach-clear-night', { eye: c('beach', 0.3, -3, 1.6), look: c('beach', 0.3, 14, 0.3), fov: 62, rain: false }],
  ['coast-beach-neutral-aerial', { eye: c('beach', 0.3, 14, 12), look: c('beach', 0.3, -3, 0), fov: 50, light: 'neutral', rain: false }],
  ['coast-rocky-ground', { eye: c('rocky', 0.4, -2.5, 1.6), look: c('rocky', 0.4, 12, 0.4), fov: 62 }],
  ['coast-rocky-aerial', { eye: c('rocky', 0.4, 12, 12), look: c('rocky', 0.4, -3, 0), fov: 50 }],
  ['coast-rocky-clear-night', { eye: c('rocky', 0.4, -2.5, 1.6), look: c('rocky', 0.4, 12, 0.4), fov: 62, rain: false }],
  ['coast-wall-ground', { eye: c('wall', 0.5, -4, 1.6), look: c('wall', 0.5, 8, 0.8), fov: 62 }],
  ['coast-wall-aerial', { eye: c('wall', 0.5, 12, 11), look: c('wall', 0.5, -2, 0), fov: 50 }],
  ['coast-wall-seaward', { eye: c('wall', 0.5, 9, 1.8, -5), look: c('wall', 0.5, -2, 1.0, 3), fov: 62 }],
  ['coast-road-junction', { eye: c('wall', 0.2, -10, 1.7), look: c('wall', 0.2, 6, 0.6), fov: 62 }],
  // the open sea: ground (ripples), aerial (swell), the three ocean regions
  ['sea-deep-ground', { eye: { lon: 150, lat: -20, sea: true, dy: 1.6 }, look: { lon: 150.5, lat: -20.2, sea: true, dy: 0.2 }, fov: 62 }],
  ['sea-deep-aerial', { eye: { lon: 150, lat: -20, sea: true, dy: 40 }, look: { lon: 151.5, lat: -21, sea: true, dy: 0 }, fov: 50 }],
  ['sea-west-aerial', { eye: { lon: -75, lat: -4, sea: true, dy: 30 }, look: { lon: -72, lat: -6, sea: true, dy: 0 }, fov: 50 }],
  ['sea-strait-aerial', { eye: { lon: 58, lat: -3, sea: true, dy: 28 }, look: { lon: 61, lat: -5, sea: true, dy: 0 }, fov: 50 }],
  ['island-LM08-shore', { eye: { lon: 190, lat: -2.0, sea: true, dy: 2.2 }, look: { ...LM08, sea: true, dy: 0.8 }, fov: 62 }],
  ['island-LM08-aerial', { eye: { lon: 188, lat: -2.0, sea: true, dy: 22 }, look: { ...LM08, sea: true, dy: 0 }, fov: 50 }],
  // night panoramas of the ocean (clear moonlit night), four hemispheres, and the moon's glint on the west sea
  ...[['east', 60], ['back-east', 150], ['back-west', -120], ['west', -40]].map(([n, lon]) => [`ocean-panorama-${n}`, { sphere: [lon, -12], d: 300, fov: 36, light: 'panorama', ink: 'panorama', rain: false, band: true }]),
  ['ocean-panorama-glint', { glintAt: [-75, -8], d: 300, fov: 36, light: 'panorama', ink: 'panorama', rain: false, band: true }],
  ['ocean-panorama-glint-wide', { glintAt: [-75, -8], d: 360, fov: 40, light: 'panorama', ink: 'panorama', rain: false, band: true }],
];
