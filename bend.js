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
(function (global) {
'use strict';
const THREE = global.THREE;
const R = 90;
const uniform = { value: 0 };
const T_MAX = 8;   // clamp of z / R: sinh and cosh stay finite far outside the plinth

const GLSL = `
uniform float uBend;
const float BEND_R = 90.0;
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

const PROJECT_CHUNK = THREE.ShaderChunk.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;',
  'if ( uBend > 0.0 ) { mvPosition = modelMatrix * mvPosition; mvPosition.xyz = bendPosition( mvPosition.xyz ); mvPosition = viewMatrix * mvPosition; } else { mvPosition = modelViewMatrix * mvPosition; }');
if (PROJECT_CHUNK === THREE.ShaderChunk.project_vertex) throw new Error('bend.js: project_vertex chunk changed, update the patch');
const stats = { programs: 0, projectPatched: 0, normalPatched: 0, spritePatched: 0 };
function patch(shader) {
  shader.uniforms.uBend = uniform;
  let v = shader.vertexShader;
  v = v.replace('#include <common>', '#include <common>\n' + GLSL);
  const before = v;
  // position: the original chunk with its modelView step wrapped; the original expression stays the uBend = 0 path
  v = v.replace('#include <project_vertex>', PROJECT_CHUNK);
  if (v !== before) stats.projectPatched++;
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
  // sprites (steam): only the centre is bent; the quad stays camera facing
  const b3 = v;
  v = v.replace('vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );',
    `vec4 mvPosition;
	if ( uBend > 0.0 ) { mvPosition = viewMatrix * vec4( bendPosition( ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz ), 1.0 ); }
	else { mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ); }`);
  if (v !== b3) stats.spritePatched++;
  shader.vertexShader = v;
  stats.programs++;
}

// Chain a material's own onBeforeCompile (none exists today) and keep one cache key for everything else.
const proto = THREE.Material.prototype;
const baseKey = proto.customProgramCacheKey;
function bendCompile(shader, renderer) {
  if (this._bendUserCompile) this._bendUserCompile.call(this, shader, renderer);
  if (this.userData && this.userData.noBend) return;   // meshes built directly in sphere coordinates (polar caps) opt out
  patch(shader);
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
const FR = THREE.Frustum.prototype, origObject = FR.intersectsObject, origSprite = FR.intersectsSprite, tmpSphere = new THREE.Sphere();
function bendSphere(sph) {
  const u = uniform.value, k = 1.02 * (1 + u * Math.max(0, sph.center.y + sph.radius) / R);
  const p = pointAt(sph.center.x, sph.center.y, sph.center.z, u);
  sph.center.set(p[0], p[1], p[2]); sph.radius *= k; return sph;
}
const noBend = o => !!(o.material && o.material.userData && o.material.userData.noBend);
FR.intersectsObject = function (object) {
  if (uniform.value > 0 && cullMode === 'bound' && object.geometry && !noBend(object)) {
    const g = object.geometry;
    if (g.boundingSphere === null) g.computeBoundingSphere();
    return this.intersectsSphere(bendSphere(tmpSphere.copy(g.boundingSphere).applyMatrix4(object.matrixWorld)));
  }
  return origObject.call(this, object);
};
FR.intersectsSprite = function (sprite) {
  if (uniform.value > 0 && cullMode === 'bound') {
    tmpSphere.center.set(0, 0, 0); tmpSphere.radius = 0.7071067811865476; tmpSphere.applyMatrix4(sprite.matrixWorld);
    return this.intersectsSphere(bendSphere(tmpSphere));
  }
  return origSprite.call(this, sprite);
};

let scene = null;
const listeners = [];
const culled = new WeakMap(), patchedLights = new WeakSet(), lights = [];
function patchLight(l) {
  if (patchedLights.has(l)) return;
  patchedLights.add(l);
  const orig = l.updateMatrixWorld;
  l.updateMatrixWorld = function (force) {
    orig.call(this, force);
    if (uniform.value > 0) {
      // the flat world position comes from the parent chain, which is never modified, so repeated calls cannot bend twice
      const w = this.position.clone();
      if (this.parent) w.applyMatrix4(this.parent.matrixWorld);
      const p = pointAt(w.x, w.y, w.z, uniform.value);
      this.matrixWorld.setPosition(p[0], p[1], p[2]);
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
  attach(s) { scene = s; sync(); },
  cullMode: () => cullMode,
  setCullMode(m) { cullMode = m === 'off' ? 'off' : 'bound'; sync(); return cullMode; },
  point: pointAt, basis: basisAt,
  lightCount: () => lights.length,
};
global.BEND = BEND;
})(typeof globalThis !== 'undefined' ? globalThis : this);
