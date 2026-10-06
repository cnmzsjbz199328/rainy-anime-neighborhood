// Review shots of one planet landmark (W7): the eight views of tools/building_views.mjs in the landmark's local frame (origin = anchor, +Z towards the first entrance).
//   FRONT, REAR, LEFT, RIGHT (four elevations at eye height), SITE PLAN (top view, +Z down the page), SECTION (the layers named in `cut` removed, from the front),
//   RAINY NIGHT (front-right oblique, rain), FROM AFAR (uBend = 1, clear moonlit night, over the horizon of the little planet).
// renderShot, INIT and the position references come from tools/road_views.mjs.
export { INIT, renderShot } from './road_views.mjs';
// per-landmark framing: d = distance of the elevation cameras, h = eye height, ty = height of the point looked at, top = height of the site-plan camera, cut = layers removed in the section
export const FRAME = {
  LM01: { d: 24, h: 2.5, ty: 3, top: 36, cut: ['roof'], far: [-25, 56] }, LM02: { d: 34, h: 2.2, ty: 3, top: 55, cut: ['roof'], far: [-50, 36] },
  LM03: { d: 22, h: 2.0, ty: 2, top: 36, cut: ['roof'], far: [86, -27] }, LM04: { d: 30, h: 2.2, ty: 3, top: 50, cut: ['roof'], far: [-15, -42] },
  LM05: { d: 22, h: 2.0, ty: 2, top: 34, cut: ['roof'], far: [-126.9, 33] }, LM06: { d: 36, h: 2.2, ty: 2, top: 60, cut: ['roof'], far: [-115, -32] },
  LM07: { d: 20, h: 1.8, ty: 1.5, top: 32, cut: ['roof'], far: [100, 76] }, LM08: { d: 24, h: 2.5, ty: 5, top: 36, cut: ['roof'], far: [190, -8] },
  LM09: { d: 22, h: 1.8, ty: 1.5, top: 34, cut: ['roof'], far: [-40, -18] }, LM10: { d: 38, h: 2.2, ty: 2, top: 60, cut: ['roof'], far: [106, 5] },
};
export function shots(id) {
  const F = FRAME[id], p = (x, y, z) => ({ lm: id, x, y, z }), c = 0.7071;
  return [
    ['front', { eye: p(0, F.h, F.d), look: p(0, F.ty, 0), fov: 50 }],
    ['rear', { eye: p(0, F.h, -F.d), look: p(0, F.ty, 0), fov: 50 }],
    ['left', { eye: p(F.d, F.h, 0), look: p(0, F.ty, 0), fov: 50 }],
    ['right', { eye: p(-F.d, F.h, 0), look: p(0, F.ty, 0), fov: 50 }],
    ['site-plan', { eye: p(0, F.top, 0), look: p(0, 0, 0), fov: 45, upLocal: [0, 0, -1], light: 'neutral', rain: false }],
    ['section', { eye: p(0, F.h + 1, F.d * 0.9), look: p(0, F.ty * 0.6, 0), fov: 50, lmCut: F.cut, light: 'neutral', rain: false }],
    ['rainy-night', { eye: p(-F.d * c, F.h + 1.5, F.d * c), look: p(0, F.ty, 0), fov: 50 }],
    ['from-afar', { sphere: F.far, d: 130, fov: 34, light: 'panorama', ink: 'panorama', rain: false, band: true }],
  ];
}
