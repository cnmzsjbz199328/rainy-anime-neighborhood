// Shared by tools/section_shots.mjs, tools/section_check.mjs and tools/regress.mjs --views section: the review shots of the W4 sample section.
// Section coordinates (u east, v south of the patch edge, metres) come from section_plan.js; cameras are placed on the sphere with the bend basis.
export const GROUND = {
  'town-edge': { eye: [-1.5, 0.8, 1.6], look: [2, 9, 1.2] },
  paddies: { eye: [0, 3.5, 1.6], look: [3.5, 10, 0.4] },
  'forest-edge': { eye: [-1, 22, 1.6], look: [-3.5, 29, 2] },
  coast: { eye: [-1, 35.5, 1.6], look: [4, 44, 0.3] },
};
export const SHOTS = [
  // ST03 layout: the 59.5 m side profile (long lens from the west along the local east axis, neutral light), then the four ground views in neutral light and in rain
  ['profile-side', { profile: true, d: 150, fov: 15, light: 'neutral', rain: false }],
  ...Object.entries(GROUND).flatMap(([k, g]) => [[`ground-${k}-neutral`, { ...g, fov: 62, light: 'neutral', rain: false }], [`ground-${k}-rain`, { ...g, fov: 62 }]]),
  // three distances (ground 1.6 m, aerial 50 m, panorama 300 m): rain at ground and aerial, clear panorama light at the panorama
  ['aerial-corridor-rain', { eye: [-14, -8, 30], look: [2, 22, 0], fov: 50 }],
  ['aerial-corridor-neutral', { eye: [-14, -8, 30], look: [2, 22, 0], fov: 50, light: 'neutral', rain: false }],
  ['aerial-coast-rain', { eye: [-6, 30, 22], look: [10, 46, 0], fov: 50 }],
  ['panorama-section', { sphere: [1, -45], d: 190, fov: 30, light: 'panorama', ink: 'panorama', rain: false }],
  ['panorama-planet', { sphere: [0, -30], d: 300, fov: 36, light: 'panorama', ink: 'panorama', rain: false }],
  // other local weather: clear night on the ground
  ['ground-clear-night', { eye: [-1, 35.5, 1.6], look: [4, 44, 0.3], fov: 62, rain: false }],
  // five junctions
  ['transition-town-paddies', { eye: [-1.5, 6, 1.7], look: [-1.5, -2, 2.0], fov: 62 }],
  ['transition-paddies-fallow-forest', { eye: [-4, 14, 2.5], look: [0, 24, 1.5], fov: 62 }],
  ['transition-forest-grass', { eye: [-1, 28, 1.7], look: [1, 36, 1.0], fov: 62 }],
  ['transition-grass-coast', { eye: [3, 34.5, 2.0], look: [3.5, 41, 0.3], fov: 62 }],
  ['transition-coast-sea', { eye: [-3, 41.5, 2.2], look: [-1, 50, -0.3], fov: 62 }],
];

export const INIT = `(() => {
  let s = 0x2f6e2b1;
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const queue = []; let frame = 0;
  window.requestAnimationFrame = cb => { queue.push(cb); return queue.length; };
  window.__step = n => { for (let i = 0; i < n; i++) { frame++; const ts = frame * 16.667, cbs = queue.splice(0); for (const cb of cbs) cb(ts); } return frame; };
  performance.now = () => frame * 16.667;
})();`;


// Render one shot on a page that already has INIT and the built scene; returns the canvas as a PNG data URL plus renderer info and the ink weights.
export async function renderShot(page, v, opts = {}) {
  return await page.evaluate(([v, opts]) => {
    const S = window.__scene, T = window.THREE, R = 90, D = Math.PI / 180, B = S.bend, cam = S.camera, SEC = S.section;
    B.set(1); SEC.setMode(true); SEC.ensure();
    const PL = SEC.plan();
    SEC.set({ rain: v.rain !== false, light: v.light || 'rainy', ink: v.ink || 'auto' });
    const fog0 = S.scene.fog.density, basis = (x, z) => { const b = B.basis(x, z); return { east: new T.Vector3(...b.east), up: new T.Vector3(...b.up), south: new T.Vector3(...b.south) }; };
    const flat = (lon, lat) => [R * lon * D, -R * Math.asinh(Math.tan(lat * D))];
    const ground = (u, v2, dy) => { const [lon, lat] = PL.toLL(u, v2), [x, z] = flat(lon, lat), h = window.WORLD.height(lon, lat) + dy, k = 1 / Math.cos(lat * D); return { x, z, p: B.point(x, (h - 1.6) * k, z, 1), b: basis(x, z) }; };
    if (v.eye && !opts.noStep) { const e0 = ground(v.eye[0], v.eye[1], 0); S.view.set({ mode: 'section', target: [e0.x, 0.8, e0.z] }); window.__step(3); }   // the rain box follows the view target
    cam.near = 0.1; cam.far = 600;
    if (v.sphere) {
      const [lon, lat] = v.sphere, cp = Math.cos(lat * D), dir = new T.Vector3(cp * Math.sin(lon * D), cp * Math.cos(lon * D), -Math.sin(lat * D));
      const north = new T.Vector3(-Math.sin(lat * D) * Math.sin(lon * D), -Math.sin(lat * D) * Math.cos(lon * D), -cp), c = new T.Vector3(0, -R, 0);
      cam.position.copy(c).addScaledVector(dir, v.d); cam.up.copy(north); cam.lookAt(c);
    } else if (v.profile) {
      const t = ground(0, 30, 3), cp = new T.Vector3(...t.p).addScaledVector(t.b.east, -v.d);
      cam.position.copy(cp); cam.up.copy(t.b.up); cam.lookAt(new T.Vector3(...t.p));
    } else {
      const e = ground(v.eye[0], v.eye[1], v.eye[2]), l = ground(v.look[0], v.look[1], v.look[2]);
      cam.position.set(...e.p); cam.up.copy(e.b.up); cam.lookAt(new T.Vector3(...l.p));
    }
    cam.fov = v.fov || 36; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    S.scene.fog.density = ['panorama', 'neutral'].includes(v.light) ? 0 : fog0;
    const t = opts.t ?? 1.2; SEC.tick(t, cam); SEC.tick(t, cam); SEC.forceLod(cam);
    if (opts.hide) SEC.state.root.visible = false;
    const t0 = Date.now(); S.renderer.render(S.scene, cam); S.renderer.getContext().finish(); const ms = Date.now() - t0;
    let instances = 0; if (!opts.hide) SEC.state.root.traverse(o => { if (o.isInstancedMesh && o.visible) instances += o.count; });
    if (opts.hide) SEC.state.root.visible = true;
    const url = S.renderer.domElement.toDataURL('image/png'), info = { calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles, ms, instances, textures: S.renderer.info.memory.textures, geometries: S.renderer.info.memory.geometries, programs: S.renderer.info.programs.length };
    cam.fov = 36; cam.near = 0.25; cam.far = 400; cam.up.set(0, 1, 0); cam.updateProjectionMatrix(); S.scene.fog.density = fog0; SEC.set({ light: 'rainy', ink: 'auto' });
    return { url, info, ink: SEC.get().ink };
  }, [v, opts]);
}
