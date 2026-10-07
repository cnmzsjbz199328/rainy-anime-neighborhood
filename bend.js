// Bend (W2): rolls the flat town onto a sphere of radius R = 90 in the vertex shader.
// uBend 0 = the flat town (exact identity), 1 = the full sphere, in between = a smooth roll.
// Loaded right after three.min.js, before any material is compiled. Every built-in material shares one
// onBeforeCompile (so one program cache key) and one global uniform object.
//
// Town local frame: x east, z south (north is -z), y up. Sphere centre (0, -R, 0), so the town origin is the sphere's top.
// Mercator mapping (WORLD_PLAN section 4): lambda = x / R, phi = -gd(z / R), gd(t) = atan(sinh t), local scale s = 1 / cosh(z / R).
//   P = (0, -R, 0) + (R + y s) * (cos phi sin lambda, cos phi cos lambda, -sin phi)
// The map is conformal, so normals are rotated by the basis (east, up, south) taken to the sphere.
// Also keeps the CPU side consistent: point lights are moved to the bent position and frustum culling uses bent bounding spheres.
//
// W8e-b flat map edges (W8_SPEC 11.2, D11): the flat map shows the longitudes [-85, 275) with the town at x = 0. Everything west of the seam
// (x < SEAM = R * -85 deg) is moved east by one circumference 2 pi R in the vertex shader; the sphere is periodic in x, so the planet is unchanged.
// The amount is decided per instance (instance origin) or else per vertex; world-frame meshes and lines that cross the seam are cut along x = SEAM once
// they are built (seamSplit), so no triangle reaches across the map and each side moves as a whole. An edge fog (a world-frame term, faded by uBend)
// covers both sides of the seam and the latitudes from 80 deg (opaque at 84.5). At uBend = 0 the town (no shift, no fog) runs the old code path.
(function (global) {
'use strict';
const THREE = global.THREE;
const R = 90;
const uniform = { value: 0 };
const T_MAX = 8;   // clamp of z / R: sinh and cosh stay finite far outside the plinth
const SEAM_LON = -85, SEAM = Math.fround(R * SEAM_LON * Math.PI / 180), PERIOD = Math.fround(2 * Math.PI * R), EPS = 2e-4;   // EPS: the west copy of a cut vertex sits 0.2 mm west of the seam
const EDGE = { lonBand: 12, lat0: 80, lat1: 84.5 };      // edge fog: opaque at the seam and clear 12 deg of longitude inside it; latitudes 80 -> 84.5 deg
const wrapU = { value: new THREE.Vector3(1, SEAM, PERIOD) };              // x: 1 = the flat map wraps at the seam, y: seam x, z: period
const edgeU = { value: new THREE.Vector4(1, 0, 0, 0) };                   // x: 1 = edge fog on (times 1 - uBend in the shader), yzw: the background colour (output colour space)
const shiftOf = x => (wrapU.value.x > 0 ? -PERIOD * Math.floor((x - SEAM) / PERIOD) : 0);

const GLSL = `
uniform float uBend;
uniform vec3 uWrap;
uniform vec2 uBendMat;
varying float vBendEdge;
const float BEND_R = 90.0;
float bendShift( float refX ) { return uWrap.x * uBendMat.y > 0.0 ? - uWrap.z * floor( ( refX - uWrap.y ) / uWrap.z ) : 0.0; }
vec3 bendWrap( vec3 w ) { w.x += bendShift( w.x ); return w; }
float bendEdge( vec3 f ) {
	float ew = min( f.x - uWrap.y, uWrap.y + uWrap.z - f.x );
	float lat = atan( sinh( min( abs( f.z ) / BEND_R, ${T_MAX}.0 ) ) );
	return max( 1.0 - smoothstep( 0.0, ${(R * EDGE.lonBand * Math.PI / 180).toFixed(6)}, ew ), smoothstep( ${(EDGE.lat0 * Math.PI / 180).toFixed(8)}, ${(EDGE.lat1 * Math.PI / 180).toFixed(8)}, lat ) );
}
vec3 bendPosition( vec3 w ) {
	float tz = clamp( w.z / BEND_R, -${T_MAX}.0, ${T_MAX}.0 );
	float lam = w.x / BEND_R, phi = -atan( sinh( tz ) ), s = 1.0 / cosh( tz );
	float cp = cos( phi ), sp = sin( phi ), cl = cos( lam ), sl = sin( lam );
	vec3 P = vec3( 0.0, -BEND_R, 0.0 ) + ( BEND_R + w.y * s ) * vec3( cp * sl, cp * cl, -sp );
	return mix( w, P, uBend );
}
vec3 bendNormal( vec3 w, vec3 n ) {
	float tz = clamp( w.z / BEND_R, -${T_MAX}.0, ${T_MAX}.0 );
	float lam = w.x / BEND_R, phi = -atan( sinh( tz ) );
	float cp = cos( phi ), sp = sin( phi ), cl = cos( lam ), sl = sin( lam );
	vec3 east = vec3( cl, -sl, 0.0 ), up = vec3( cp * sl, cp * cl, -sp ), south = vec3( sp * sl, sp * cl, cp );
	return normalize( mix( n, n.x * east + n.y * up + n.z * south, uBend ) );
}
`;

// the shift is decided by the instance origin (an instance moves whole) or else by the vertex itself; the original expression stays the path of everything
// that is not shifted at uBend = 0
const PROJECT_CHUNK = THREE.ShaderChunk.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;',
  `vec4 bendWP = modelMatrix * mvPosition;
	float bendRef = bendWP.x;
	#ifdef USE_INSTANCING
		bendRef = ( modelMatrix * vec4( instanceMatrix[ 3 ].xyz, 1.0 ) ).x;
	#endif
	float bendDx = bendShift( bendRef );
	bendWP.x += bendDx;
	vBendEdge = bendEdge( bendWP.xyz );
	if ( uBend > 0.0 ) { bendWP.xyz = bendPosition( bendWP.xyz ); mvPosition = viewMatrix * bendWP; }
	else if ( bendDx != 0.0 ) { mvPosition = viewMatrix * bendWP; }
	else { mvPosition = modelViewMatrix * mvPosition; }`);
if (PROJECT_CHUNK === THREE.ShaderChunk.project_vertex) throw new Error('bend.js: project_vertex chunk changed, update the patch');
// edge fog after the scene fog (same colour space: after tone mapping and the output conversion); additive materials fade to black instead
const FRAG_PARS = `
uniform float uBend;
uniform vec4 uEdgeFog;
uniform vec2 uBendMat;
varying float vBendEdge;`;
const FRAG_FOG = `#include <fog_fragment>
	{ float bendE = vBendEdge * uEdgeFog.x * ( 1.0 - uBend );
	  if ( bendE > 0.0 && uBendMat.x > -0.5 ) { if ( uBendMat.x > 0.5 ) gl_FragColor.rgb *= 1.0 - bendE; else gl_FragColor.rgb = mix( gl_FragColor.rgb, uEdgeFog.yzw, bendE ); } }`;
const stats = { programs: 0, projectPatched: 0, normalPatched: 0, spritePatched: 0, fogPatched: 0 };
function patch(shader, material) {
  shader.uniforms.uBend = uniform; shader.uniforms.uWrap = wrapU; shader.uniforms.uEdgeFog = edgeU;
  // per material: x = edge fog mode (-1 none, 1 fade for additive blending, 0 mix to the background colour); y = 1 when the material follows the seam shift
  // (0 for effects already laid out in the display frame around the view target: rain lines, snow; userData.noWrap)
  const ud = (material && material.userData) || {};
  shader.uniforms.uBendMat = { value: new THREE.Vector2(ud.edgeFog === false ? -1 : material && material.blending === THREE.AdditiveBlending ? 1 : 0, ud.noWrap ? 0 : 1) };
  let v = shader.vertexShader;
  v = v.replace('#include <common>', '#include <common>\n' + GLSL);
  const before = v;
  // position: the original chunk with its modelView step wrapped; the original expression stays the uBend = 0 path
  v = v.replace('#include <project_vertex>', PROJECT_CHUNK);
  const projected = v !== before;
  if (projected) stats.projectPatched++;
  // normal: rotate in world space, then back to view space
  const b2 = v;
  v = v.replace('#include <defaultnormal_vertex>',
    `#include <defaultnormal_vertex>
	if ( uBend > 0.0 ) {
		vec4 bendP = vec4( position, 1.0 );
		#ifdef USE_INSTANCING
			bendP = instanceMatrix * bendP;
		#endif
		vec3 bendW = ( modelMatrix * bendP ).xyz;
		vec3 bendN = inverseTransformDirection( transformedNormal, viewMatrix );
		transformedNormal = transformDirection( bendNormal( bendW, bendN ), viewMatrix );
	}`);
  if (v !== b2) stats.normalPatched++;
  // sprites (steam): only the centre is bent (and shifted at the seam); the quad stays camera facing
  const b3 = v;
  v = v.replace('vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );',
    `vec4 mvPosition;
	{ vec3 bendC = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz; float bendDx = bendShift( bendC.x ); bendC.x += bendDx; vBendEdge = bendEdge( bendC );
	  if ( uBend > 0.0 ) { mvPosition = viewMatrix * vec4( bendPosition( bendC ), 1.0 ); }
	  else if ( bendDx != 0.0 ) { mvPosition = viewMatrix * vec4( bendC, 1.0 ); }
	  else { mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ); } }`);
  const sprite = v !== b3;
  if (sprite) stats.spritePatched++;
  shader.vertexShader = v;
  // the edge fog needs vBendEdge, which only the two patched paths write
  if (projected || sprite) {
    const f0 = shader.fragmentShader, f = f0.replace('#include <common>', '#include <common>\n' + FRAG_PARS).replace('#include <fog_fragment>', FRAG_FOG);
    if (f.includes('bendE')) { shader.fragmentShader = f; stats.fogPatched++; }
  }
  stats.programs++;
}

// Chain a material's own onBeforeCompile (none exists today) and keep one cache key for everything else.
const proto = THREE.Material.prototype;
const baseKey = proto.customProgramCacheKey;
function bendCompile(shader, renderer) {
  if (this._bendUserCompile) this._bendUserCompile.call(this, shader, renderer);
  if (this.userData && this.userData.noBend) return;   // meshes built directly in sphere coordinates (polar caps) opt out
  patch(shader, this);
}
Object.defineProperty(proto, 'onBeforeCompile', { configurable: true, get() { return bendCompile; }, set(fn) { this._bendUserCompile = fn; } });
proto.customProgramCacheKey = function () { return 'bend|' + (this.userData && this.userData.noBend ? 'nobend|' : '') + (this._bendUserCompile ? this._bendUserCompile.toString() : ''); };
void baseKey;

// ---- CPU mirror of the shader (checks, lights)
function pointAt(x, y, z, u) {
  const tz = Math.max(-T_MAX, Math.min(T_MAX, z / R)), lam = x / R, phi = -Math.atan(Math.sinh(tz)), s = 1 / Math.cosh(tz);
  const cp = Math.cos(phi), sp = Math.sin(phi), cl = Math.cos(lam), sl = Math.sin(lam), k = R + y * s;
  const P = [k * cp * sl, -R + k * cp * cl, -k * sp];
  return [x + (P[0] - x) * u, y + (P[1] - y) * u, z + (P[2] - z) * u];
}
function basisAt(x, z) {
  const tz = Math.max(-T_MAX, Math.min(T_MAX, z / R)), lam = x / R, phi = -Math.atan(Math.sinh(tz));
  const cp = Math.cos(phi), sp = Math.sin(phi), cl = Math.cos(lam), sl = Math.sin(lam);
  return { east: [cl, -sl, 0], up: [cp * sl, cp * cl, -sp], south: [sp * sl, sp * cl, cp] };
}

// Frustum culling. Flat bounding spheres are wrong once the town is rolled up. Default mode 'bound': the world-space
// bounding sphere is bent (centre mapped, radius scaled) so culling stays conservative and the draw-call count stays near
// the flat one. The local stretch of the map for a point at height y is at most 1 + y/R (largest singular value of the
// Jacobian, sampled over |x|,|z| <= 90: 1.111 / 1.200 / 1.333 / 1.422 for y <= 10 / 20 / 30 / 40); blending with the flat
// town gives 1 + u (y / R). Mode 'off' (the literal W2_SPEC section 5 wording) disables frustumCulled on every object
// while bent; it is kept for comparison.
let cullMode = 'bound';
const FR = THREE.Frustum.prototype, origObject = FR.intersectsObject, origSprite = FR.intersectsSprite, tmpSphere = new THREE.Sphere(), tmpSphere2 = new THREE.Sphere();
function bendSphere(sph) {
  const u = uniform.value, k = 1.02 * (1 + u * Math.max(0, sph.center.y + sph.radius) / R);
  const p = pointAt(sph.center.x, sph.center.y, sph.center.z, u);
  sph.center.set(p[0], p[1], p[2]); sph.radius *= k; return sph;
}
const noBend = o => !!(o.material && o.material.userData && o.material.userData.noBend);
const noWrap = o => !!(o.material && o.material.userData && o.material.userData.noWrap);
// world-frame bounding sphere; an InstancedMesh culls on the sphere around all its instances (object.boundingSphere), not on the one instance geometry (W4)
function worldSphere(object, out) {
  const g = object.geometry;
  let bs = object.isInstancedMesh && object.boundingSphere ? object.boundingSphere : g.boundingSphere;
  if (bs === null) { g.computeBoundingSphere(); bs = g.boundingSphere; }
  return out.copy(bs).applyMatrix4(object.matrixWorld);
}
// W8e-b: a sphere that reaches over a seam is tested at the shift of each of its ends (each part of it moves by its own shift)
function testWrapped(fr, s, bent) {
  const a = shiftOf(s.center.x - s.radius), b = shiftOf(s.center.x + s.radius);
  for (const k of a === b ? [a] : [a, b]) { tmpSphere2.copy(s); tmpSphere2.center.x += k; if (bent) bendSphere(tmpSphere2); if (fr.intersectsSphere(tmpSphere2)) return true; }
  return false;
}
FR.intersectsObject = function (object) {
  if (!object.geometry || noBend(object)) return origObject.call(this, object);
  if (uniform.value > 0 && cullMode === 'bound') return noWrap(object) ? this.intersectsSphere(bendSphere(worldSphere(object, tmpSphere))) : testWrapped(this, worldSphere(object, tmpSphere), true);
  if (uniform.value === 0 && wrapU.value.x > 0 && !noWrap(object)) {
    const s = worldSphere(object, tmpSphere);
    if (shiftOf(s.center.x - s.radius) === 0 && shiftOf(s.center.x + s.radius) === 0) return origObject.call(this, object);   // the town: the old test
    return testWrapped(this, s, false);
  }
  return origObject.call(this, object);
};
FR.intersectsSprite = function (sprite) {
  const u = uniform.value;
  if ((u > 0 && cullMode === 'bound') || (u === 0 && shiftOf(sprite.matrixWorld.elements[12]) !== 0)) {
    tmpSphere.center.set(0, 0, 0); tmpSphere.radius = 0.7071067811865476; tmpSphere.applyMatrix4(sprite.matrixWorld);
    return testWrapped(this, tmpSphere, u > 0);
  }
  return origSprite.call(this, sprite);
};

// ---- W8e-b seam cut: a mesh or line set in the world frame whose primitives cross x = SEAM is cut along that line, in place (attributes are rebuilt, nothing
// shared is written). Triangles: the part west of the seam and the part east of it become separate triangles; the cut vertices are doubled, the west copy at
// SEAM - EPS (it is shifted by the shader), the east copy exactly at SEAM. Every attribute is interpolated linearly along the cut edge (normals re-normalised).
// Instanced meshes, points and sprites need no cut (an instance or a point moves whole). Only identity world matrices are cut (the planet modules' meshes).
const seamStats = { meshes: 0, lines: 0, trianglesCut: 0, segmentsCut: 0, skipped: [] };
function cutGeometry(g, lines) {
  const pos = g.attributes.position, n = pos.count, names = Object.keys(g.attributes), attrs = names.map(k => g.attributes[k]);
  const idx = g.index ? Array.from(g.index.array) : Array.from({ length: n }, (_, i) => i), per = lines ? 2 : 3;
  const xs = i => pos.getX(i), side = i => (xs(i) < SEAM ? -1 : 1);
  let crossing = 0; for (let t = 0; t + per <= idx.length; t += per) { let w = false, e = false; for (let k = 0; k < per; k++) { if (side(idx[t + k]) < 0) w = true; else e = true; } if (w && e) crossing++; }
  if (!crossing) return 0;
  // new vertex data: copies of the old vertices, then the cut points
  const data = attrs.map(a => { const out = []; for (let i = 0; i < n; i++) for (let c = 0; c < a.itemSize; c++) out.push(a.array[i * a.itemSize + c]); return out; });
  let count = n;
  const cutAt = (i0, i1, west) => {          // the point on edge i0-i1 at x = SEAM (west / east copy); returns its new index
    const x0 = xs(i0), x1 = xs(i1), t = (SEAM - x0) / (x1 - x0);
    attrs.forEach((a, k) => { const s = a.itemSize, v = []; for (let c = 0; c < s; c++) v.push(a.array[i0 * s + c] + (a.array[i1 * s + c] - a.array[i0 * s + c]) * t);
      if (names[k] === 'position') v[0] = west ? Math.fround(SEAM - EPS) : SEAM;
      if (names[k] === 'normal') { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; }
      data[k].push(...v); });
    return count++;
  };
  const out = [];
  for (let t = 0; t + per <= idx.length; t += per) {
    const v = idx.slice(t, t + per), s = v.map(side);
    if (s.every(q => q === s[0])) { out.push(...v); continue; }
    if (lines) { const [a, b] = v, w = s[0] < 0; out.push(a, cutAt(a, b, w), cutAt(a, b, !w), b); seamStats.segmentsCut++; continue; }
    // the lone vertex on one side, the pair on the other, keeping the winding (rotate so that the lone one comes first)
    const lone = s.findIndex((q, i) => q !== s[(i + 1) % 3] && q !== s[(i + 2) % 3]), a = v[lone], b = v[(lone + 1) % 3], c = v[(lone + 2) % 3], aw = s[lone] < 0;
    const ab1 = cutAt(a, b, aw), ac1 = cutAt(a, c, aw), ab2 = cutAt(a, b, !aw), ac2 = cutAt(a, c, !aw);
    out.push(a, ab1, ac1, ab2, b, c, ab2, c, ac2); seamStats.trianglesCut++;
  }
  names.forEach((k, j) => { const a = attrs[j], Arr = a.array.constructor; g.setAttribute(k, new THREE.BufferAttribute(new Arr(data[j]), a.itemSize, a.normalized)); });
  g.setIndex(new THREE.BufferAttribute(count > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return crossing;
}
function seamSplit(root) {
  if (!root) return seamStats;
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!(o.isMesh || o.isLineSegments) || o.isInstancedMesh || noBend(o) || noWrap(o) || !o.geometry || !o.geometry.attributes.position || o.userData.seamChecked === o.geometry) return;
    const g = o.geometry; o.userData.seamChecked = g;
    if (!g.boundingBox) g.computeBoundingBox();
    const bb = tmpBox.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
    if (bb.min.x >= SEAM || bb.max.x < SEAM) return;
    if (!o.matrixWorld.equals(IDENTITY) || (g.groups && g.groups.length > 1) || Object.values(g.attributes).some(a => a.isInterleavedBufferAttribute)) { seamStats.skipped.push(o.name || o.type); return; }
    const n = cutGeometry(g, o.isLineSegments);
    if (n) { if (o.isLineSegments) seamStats.lines++; else seamStats.meshes++; o.userData.seamChecked = g; }
  });
  return seamStats;
}
const IDENTITY = new THREE.Matrix4(), tmpBox = new THREE.Box3();

let scene = null;
const listeners = [];
const culled = new WeakMap(), patchedLights = new WeakSet(), lights = [];
function patchLight(l) {
  if (patchedLights.has(l)) return;
  patchedLights.add(l);
  const orig = l.updateMatrixWorld;
  l.updateMatrixWorld = function (force) {
    orig.call(this, force);
    if (uniform.value > 0 || wrapU.value.x > 0) {
      // the flat world position comes from the parent chain, which is never modified, so repeated calls cannot bend twice
      const w = this.position.clone();
      if (this.parent) w.applyMatrix4(this.parent.matrixWorld);
      const dx = shiftOf(w.x);                       // W8e-b: a light west of the seam moves with what it lights
      if (uniform.value > 0) { const p = pointAt(w.x + dx, w.y, w.z, uniform.value); this.matrixWorld.setPosition(p[0], p[1], p[2]); }
      else if (dx !== 0) this.matrixWorld.setPosition(w.x + dx, w.y, w.z);
    }
  };
  lights.push(l);
}
function sync() {
  if (!scene) return;
  const on = uniform.value > 0 && cullMode === 'off';
  scene.traverse(o => {
    if (o.isPointLight) { patchLight(o); o.matrixWorldNeedsUpdate = true; }
    if (!(o.isMesh || o.isLine || o.isPoints || o.isSprite) || noBend(o)) return;
    if (on) { if (!culled.has(o)) { culled.set(o, o.frustumCulled); o.frustumCulled = false; } }
    else if (culled.has(o)) { o.frustumCulled = culled.get(o); culled.delete(o); }
  });
}

const BEND = {
  R, uniform, stats,
  get: () => uniform.value,
  set(v) { uniform.value = Math.max(0, Math.min(1, +v || 0)); sync(); for (const f of listeners) f(uniform.value); return uniform.value; },
  onChange(f) { listeners.push(f); },
  attach(s) {
    scene = s; sync();
    // the edge fog takes the background colour (else the fog colour) in the colour space the scene fog uses (output space on screen, working space in a render target)
    const prev = s.onBeforeRender, col = new THREE.Color();
    s.onBeforeRender = function (renderer, sc, camera, target) {
      const c = sc.background && sc.background.isColor ? sc.background : sc.fog ? sc.fog.color : null;
      if (c) { c.getRGB(col, target ? THREE.ColorManagement.workingColorSpace : renderer.outputColorSpace); edgeU.value.set(edgeU.value.x, col.r, col.g, col.b); }
      return prev.apply(this, arguments);
    };
  },
  cullMode: () => cullMode,
  setCullMode(m) { cullMode = m === 'off' ? 'off' : 'bound'; sync(); return cullMode; },
  point: pointAt, basis: basisAt,
  lightCount: () => lights.length,
  // W8e-b seam and edges: the flat x range is [SEAM, SEAM + PERIOD); shift(x) is what the shader adds to a point at x; wrapX(x) = x + shift(x)
  SEAM, PERIOD, SEAM_LON, EDGE, EPS, wrapUniform: wrapU, edgeUniform: edgeU,
  shift: shiftOf, wrapX: x => x + shiftOf(x),
  seamSplit, seamStats,
  setWrap(on) { wrapU.value.x = on ? 1 : 0; sync(); return wrapU.value.x; },
  setEdgeFog(on) { edgeU.value.x = on ? 1 : 0; return edgeU.value.x; },
  // CPU mirror of the edge fog (before the 1 - uBend factor) at a point of the flat display frame
  edgeAt(x, z) {
    const sm = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); }, D = Math.PI / 180;
    const ew = Math.min(x - SEAM, SEAM + PERIOD - x), lat = Math.atan(Math.sinh(Math.min(Math.abs(z) / R, T_MAX)));
    return Math.max(1 - sm(0, R * EDGE.lonBand * D, ew), sm(EDGE.lat0 * D, EDGE.lat1 * D, lat));
  },
};
global.BEND = BEND;
})(typeof globalThis !== 'undefined' ? globalThis : this);
