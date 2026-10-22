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
const weatherFogU = { value: 0 };                                          // the density the weather adds on top of scene.fog (weather_fx.js writes it)

const GLSL = `
uniform float uBend;
uniform vec3 uWrap;
uniform vec3 uBendMat;
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
#ifdef BEND_DRAPE
attribute vec3 drapeA;
attribute vec3 drapeB;
attribute vec3 drapeC;
attribute vec3 drapeW;
// a draped vertex (drape() below) is the same weights of its carrier triangle's bent corners, summed in the view frame (small numbers near the camera)
vec4 bendDrape( float dx ) {
	vec3 s = vec3( dx, 0.0, 0.0 );
	vec4 p = drapeW.x * ( viewMatrix * vec4( bendPosition( drapeA + s ), 1.0 ) ) + drapeW.y * ( viewMatrix * vec4( bendPosition( drapeB + s ), 1.0 ) ) + drapeW.z * ( viewMatrix * vec4( bendPosition( drapeC + s ), 1.0 ) );
	return vec4( p.xyz, 1.0 );
}
#endif
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
	if ( uBend > 0.0 ) {
		#ifdef BEND_DRAPE
			mvPosition = bendDrape( bendDx );
		#else
			bendWP.xyz = bendPosition( bendWP.xyz ); mvPosition = viewMatrix * bendWP;
		#endif
	}
	else if ( bendDx != 0.0 ) { mvPosition = viewMatrix * bendWP; }
	else { mvPosition = modelViewMatrix * mvPosition; }`);
if (PROJECT_CHUNK === THREE.ShaderChunk.project_vertex) throw new Error('bend.js: project_vertex chunk changed, update the patch');
// edge fog after the scene fog (same colour space: after tone mapping and the output conversion); additive materials fade to black instead
const FRAG_PARS = `
uniform float uBend;
uniform vec4 uEdgeFog;
uniform vec3 uBendMat;
uniform float uFogWeather;
varying float vBendEdge;`;
// the scene fog by material (uBendMat.z; docs/world/GRAY_VIEW_FIX_PLAN.md): 0 three's own mix to the fog colour; 1 additive light is only dimmed by the
// transmittance 1 - F (mixing it to a non-black fog colour would add that colour over the whole face: the bright discs of the lamp pools in fog);
// 2 ink lines (userData.inkFog) keep their colour under the base fog and are covered only by the weather's part of it, exp(-(d^2 - b^2) z^2) with b = d - weather
// W8e-c: the sphere is a clear day (uDay = uBend): additive light (lamp pools, the light band, far lights, glows) fades out with it
const FRAG_FOG = `vec3 bendLit = gl_FragColor.rgb;
	#include <fog_fragment>
	#ifdef USE_FOG
	if ( uBendMat.z > 1.5 ) {
		gl_FragColor.rgb = bendLit;
		#ifdef FOG_EXP2
		if ( uFogWeather > 0.0 ) { float bendB = max( fogDensity - uFogWeather, 0.0 ); gl_FragColor.rgb = mix( bendLit, fogColor, 1.0 - exp( - ( fogDensity * fogDensity - bendB * bendB ) * vFogDepth * vFogDepth ) ); }
		#endif
	} else if ( uBendMat.z > 0.5 ) gl_FragColor.rgb = bendLit * ( 1.0 - fogFactor );
	#endif
	if ( uBend > 0.0 && uBendMat.x > 0.5 ) gl_FragColor.rgb *= 1.0 - uBend;
	{ float bendE = vBendEdge * uEdgeFog.x * ( 1.0 - uBend );
	  if ( bendE > 0.0 && uBendMat.x > -0.5 ) { if ( uBendMat.x > 0.5 ) gl_FragColor.rgb *= 1.0 - bendE; else gl_FragColor.rgb = mix( gl_FragColor.rgb, uEdgeFog.yzw, bendE ); } }`;
const stats = { programs: 0, projectPatched: 0, normalPatched: 0, spritePatched: 0, fogPatched: 0 };
function patch(shader, material) {
  shader.uniforms.uBend = uniform; shader.uniforms.uWrap = wrapU; shader.uniforms.uEdgeFog = edgeU; shader.uniforms.uFogWeather = weatherFogU;
  // per material: x = edge fog mode (-1 none, 1 fade for additive blending, 0 mix to the background colour); y = 1 when the material follows the seam shift
  // (0 for effects already laid out in the display frame around the view target: rain lines, snow; userData.noWrap); z = scene fog mode (FRAG_FOG)
  const ud = (material && material.userData) || {}, additive = !!material && material.blending === THREE.AdditiveBlending;
  shader.uniforms.uBendMat = { value: new THREE.Vector3(ud.edgeFog === false ? -1 : additive ? 1 : 0, ud.noWrap ? 0 : 1, ud.inkFog ? 2 : additive ? 1 : 0) };
  let v = shader.vertexShader;
  v = v.replace('#include <common>', '#include <common>\n' + (ud.drape ? '#define BEND_DRAPE\n' : '') + GLSL);
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
    const f0 = shader.fragmentShader, f = f0.replace('#include <common>', '#include <common>\n' + FRAG_PARS).replace('#include <fog_fragment>', FRAG_FOG)
      // W8e-c: emissive light (lit windows, the warm interiors, embers) goes out in the daytime of the sphere
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\tif ( uBend > 0.0 ) totalEmissiveRadiance *= 1.0 - uBend;');
    if (f.includes('bendE')) { shader.fragmentShader = f; stats.fogPatched++; if (f.includes('totalEmissiveRadiance *= 1.0 - uBend')) stats.emissivePatched = (stats.emissivePatched || 0) + 1; }
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
proto.customProgramCacheKey = function () { return 'bend|' + (this.userData && this.userData.noBend ? 'nobend|' : '') + (this.userData && this.userData.drape ? 'drape|' : '') + (this._bendUserCompile ? this._bendUserCompile.toString() : ''); };
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
const worldBox = new THREE.Box3(), shiftedBox = new THREE.Box3();
FR.intersectsObject = function (object) {
  // W10a: the flat map draws the whole world, so on it a plain mesh or line set is tested by its world box as well as its sphere: a road, coast or field
  // strip many times longer than wide no longer draws whenever its sphere grazes the view. Each end at its own wrap shift, as testWrapped; noWrap ones unshifted.
  if (uniform.value === 0 && !object.isInstancedMesh && object.geometry && !noBend(object)) {
    const fixed = noWrap(object);
    if (fixed ? !origObject.call(this, object) : !testWrapped(this, worldSphere(object, tmpSphere), false)) return false;
    const g = object.geometry; if (!g.boundingBox) g.computeBoundingBox();
    worldBox.copy(g.boundingBox).applyMatrix4(object.matrixWorld);
    const a = fixed ? 0 : shiftOf(worldBox.min.x), b = fixed ? 0 : shiftOf(worldBox.max.x);
    for (const k of a === b ? [a] : [a, b]) { shiftedBox.copy(worldBox); shiftedBox.min.x += k; shiftedBox.max.x += k; if (this.intersectsBox(shiftedBox)) return true; }
    return false;
  }
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

// ---- W10f (W10_SPEC 2.5): one geometry for the flat map and the sphere. The shader only moves vertices, so a face bends as its flat chord (a 96 m town face would sink
// about 24 m below the sphere and show the sky through the streets). subdivide() cuts, once while the world is built, every mesh and line set that has a primitive in the
// region and a horizontal edge (world frame) longer than maxEdge: an edge longer than maxEdge is split at its midpoint, the triangle is re-cut by the edges that were split
// (1, 2 or 3: two, three or four children, winding kept) and the children are cut again until no edge is longer. The decision and the new point depend on the edge alone
// (its two end positions), so two triangles that share an edge split it the same way: no T-junctions, no cracks, also in non-indexed meshes. Every attribute is the mean
// of the two ends (normals re-normalised): on the flat map the cut faces show what they showed before. The groups (BoxGeometry has six) are kept. A chord of 4 m sags
// 4^2 / (8 R) = 2.2 cm at R = 90. The cut geometry replaces the old one for good: the flat map and the sphere draw the same objects (no copies, nothing to swap).
function subdivideGeometry(g, mw, maxEdge, lines) {
  const pos = g.attributes.position;
  if (!pos || Object.keys(g.morphAttributes || {}).length) return null;
  const names = Object.keys(g.attributes), attrs = names.map(k => g.attributes[k]);
  if (attrs.some(a => a.isInterleavedBufferAttribute)) return null;
  const n0 = pos.count, e = mw.elements, X = [], Z = [];
  for (let i = 0; i < n0; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); X.push(e[0] * x + e[4] * y + e[8] * z + e[12]); Z.push(e[2] * x + e[6] * y + e[10] * z + e[14]); }
  const m2 = maxEdge * maxEdge, long = (a, b) => { const dx = X[a] - X[b], dz = Z[a] - Z[b]; return dx * dx + dz * dz > m2; };
  const idx = g.index ? g.index.array : null, total = Math.min(idx ? idx.length : n0, g.drawRange.start + g.drawRange.count), at = k => (idx ? idx[k] : k), per = lines ? 2 : 3;
  let any = false;
  for (let t = 0; t + per <= total && !any; t += per) any = lines ? long(at(t), at(t + 1)) : long(at(t), at(t + 1)) || long(at(t + 1), at(t + 2)) || long(at(t + 2), at(t));
  if (!any) return null;
  const data = attrs.map(a => Array.from(a.array.subarray(0, a.count * a.itemSize)));
  let count = n0; const cache = new Map(), out = [];
  // a landmark's per-vertex local frame (geometry.userData.local, scene.js) goes on with the vertices, its midpoints as the attributes' are
  const local0 = g.userData && g.userData.local && g.userData.local.length === n0 * 3 ? g.userData.local : null, local = local0 ? Array.from(local0) : null;
  const mid = (a, b) => {
    if (a > b) { const t = a; a = b; b = t; }
    const key = a * 4194304 + b; let m = cache.get(key); if (m !== undefined) return m;
    m = count++;
    if (local) for (let c = 0; c < 3; c++) local.push((local[a * 3 + c] + local[b * 3 + c]) / 2);
    attrs.forEach((a2, k) => { const s = a2.itemSize, d = data[k]; for (let c = 0; c < s; c++) d.push((d[a * s + c] + d[b * s + c]) / 2);
      if (names[k] === 'normal' && s === 3) { const o = m * 3, l = Math.hypot(d[o], d[o + 1], d[o + 2]) || 1; d[o] /= l; d[o + 1] /= l; d[o + 2] /= l; } });
    X.push((X[a] + X[b]) / 2); Z.push((Z[a] + Z[b]) / 2); cache.set(key, m); return m;
  };
  const h2 = (a, b) => (X[a] - X[b]) ** 2 + (Z[a] - Z[b]) ** 2;
  const tri = (a0, b0, c0) => {
    const st = [[a0, b0, c0]];
    while (st.length) {
      const [p, q, r] = st.pop(), lp = long(p, q), lq = long(q, r), lr = long(r, p), k = lp + lq + lr;
      if (!k) { out.push(p, q, r); continue; }
      if (k === 3) { const m1 = mid(p, q), m2 = mid(q, r), m3 = mid(r, p); st.push([p, m1, m3], [m1, q, m2], [m3, m2, r], [m1, m2, m3]); continue; }
      if (k === 1) { const [A, B, C] = lp ? [p, q, r] : lq ? [q, r, p] : [r, p, q], m = mid(A, B); st.push([A, m, C], [m, B, C]); continue; }
      // two long edges: rotate so that they are A-B and B-C (the short one C-A), cut the corner at B, the quad A m1 m2 C by its shorter diagonal
      const [A, B, C] = !lr ? [p, q, r] : !lp ? [q, r, p] : [r, p, q], m1 = mid(A, B), m2 = mid(B, C);
      st.push([m1, B, m2]);
      if (h2(A, m2) <= h2(m1, C)) st.push([A, m1, m2], [A, m2, C]); else st.push([A, m1, C], [m1, m2, C]);
    }
  };
  const seg = (a0, b0) => { const st = [[a0, b0]]; while (st.length) { const [p, q] = st.pop(); if (long(p, q)) { const m = mid(p, q); st.push([m, q], [p, m]); } else out.push(p, q); } };
  const groups = g.groups && g.groups.length ? g.groups : [{ start: 0, count: total, materialIndex: 0 }], ng = [];
  for (const gr of groups) { const s0 = out.length, end = Math.min(total, gr.start + gr.count); for (let t = gr.start; t + per <= end; t += per) { if (lines) seg(at(t), at(t + 1)); else tri(at(t), at(t + 1), at(t + 2)); } ng.push({ start: s0, count: out.length - s0, materialIndex: gr.materialIndex }); }
  const G = new THREE.BufferGeometry();
  names.forEach((k, j) => { const a = attrs[j]; G.setAttribute(k, new THREE.BufferAttribute(new a.array.constructor(data[j]), a.itemSize, a.normalized)); });
  G.setIndex(new THREE.BufferAttribute(count > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1));
  if (g.groups && g.groups.length) for (const q of ng) G.addGroup(q.start, q.count, q.materialIndex);
  G.computeBoundingSphere(); G.computeBoundingBox(); G.name = g.name; G.userData = local ? { ...g.userData, local: Float32Array.from(local) } : g.userData;
  return { G, before: total / per, after: out.length / per };
}
// roots: objects to walk; opts.maxEdge (4 m), opts.region [x0, z0, x1, z1] (world frame): an object is cut when the box of one of its triangles or segments overlaps the
// region and one of its edges is longer than maxEdge (then all its long edges are cut, also outside the region: one geometry, no seam between cut and uncut faces).
// Instanced meshes (small parts placed by matrices), points, sprites, line sets under a userData.live node (drips and runs whose vertices the animation rewrites; they are
// vertical), materials flagged noBend / noWrap (rain, snow) and the objects opts.skip(o) names (the overlays that drape() cuts later) are left alone. A geometry
// shared by several objects gets one cut copy per object (its own world matrix).
function subdivide(roots, opts = {}) {
  const skip = opts.skip || (() => false), maxEdge = opts.maxEdge || 4, rg = opts.region || [-Infinity, -Infinity, Infinity, Infinity], t0 = Date.now(), list = [];
  const stats = { objects: 0, meshes: 0, lines: 0, trianglesBefore: 0, trianglesAfter: 0, segmentsBefore: 0, segmentsAfter: 0, ms: 0, maxEdge, region: rg.slice() };
  // a triangle or segment whose box (world x, z) overlaps the region
  const touches = (g, mw, per) => {
    const pos = g.attributes.position, e = mw.elements, idx = g.index ? g.index.array : null, total = Math.min(idx ? idx.length : pos.count, g.drawRange.start + g.drawRange.count);
    for (let t = 0; t + per <= total; t += per) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let k = 0; k < per; k++) { const i = idx ? idx[t + k] : t + k, x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), wx = e[0] * x + e[4] * y + e[8] * z + e[12], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        if (wx < x0) x0 = wx; if (wx > x1) x1 = wx; if (wz < z0) z0 = wz; if (wz > z1) z1 = wz; }
      if (x1 >= rg[0] && x0 <= rg[2] && z1 >= rg[1] && z0 <= rg[3]) return true;
    }
    return false;
  };
  for (const r of roots) {
    r.updateMatrixWorld(true);
    r.traverse(o => {
      if (!(o.isMesh || o.isLineSegments) || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position || noBend(o) || noWrap(o) || skip(o)) return;
      if (o.isLineSegments) for (let p = o; p; p = p.parent) if (p.userData && p.userData.live) return;
      const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
      const bb = tmpBox.copy(g.boundingBox).applyMatrix4(o.matrixWorld); if (bb.max.x < rg[0] || bb.min.x > rg[2] || bb.max.z < rg[1] || bb.min.z > rg[3] || !touches(g, o.matrixWorld, o.isLineSegments ? 2 : 3)) return;
      stats.objects++;
      const res = subdivideGeometry(g, o.matrixWorld, maxEdge, o.isLineSegments); if (!res) return;
      o.geometry = res.G; list.push(o);
      if (o.isLineSegments) { stats.lines++; stats.segmentsBefore += res.before; stats.segmentsAfter += res.after; }
      else { stats.meshes++; stats.trianglesBefore += res.before; stats.trianglesAfter += res.after; }
    });
  }
  stats.ms = Date.now() - t0;
  return { list, stats };
}

// ---- SLF (docs/world/SPHERE_SURFACE_LINE_FIX_PLAN.md): an overlay laid flat on a surface (paint, drains and puddles on a street, a paving strip on a pavement island)
// bends as its own chords, not as its carrier's: a 3 m zebra stripe sagged 12.5 mm under the street at R = 90 and the street showed through its middle. drape() cuts
// each overlay triangle along the up-facing triangles of its carriers (flat x, z) and gives every new vertex the three corners of its carrier triangle (world frame)
// and its weights in it (drapeA/B/C, drapeW); its flat position is that point of the carrier's flat plane. The vertex shader (BEND_DRAPE) draws it as the same
// weights of the bent corners, so the overlay lies in its carrier's drawn plane in every bend state and the materials' depth offsets alone decide what shows, as on
// the flat map. A piece's carrier is the triangle within opts.win (3 cm) of the overlay's own height there, the highest first where two carriers overlap (each point
// gets one); a piece with none keeps its own vertices (bent as before; counted). Every attribute is interpolated in the overlay triangle (normals re-normalised);
// the object's transform goes into the geometry (its parent must be in the world frame) and it gets a copy of its material marked userData.drape (one copy per
// material). The carriers are not changed. Returns the cut overlays and statistics.
function drape(overlays, carriers, opts = {}) {
  const win = opts.win || 0.03, t0 = Date.now(), CELL = 1, EPS = 1e-10;
  const stats = { overlays: 0, trianglesBefore: 0, trianglesAfter: 0, carrierTriangles: 0, unsupportedTriangles: 0, unsupportedArea: 0, area: 0, drawnArea: 0, ms: 0 };
  const worldOf = (g, mw) => { const p = g.attributes.position, e = mw.elements, V = new Float64Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); V[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12]; V[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; V[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
    return V; };
  const trisOf = g => { const ix = g.index, n = Math.min(ix ? ix.count : g.attributes.position.count, g.drawRange.start + g.drawRange.count), out = []; for (let t = 0; t + 2 < n; t += 3) out.push(ix ? [ix.getX(t), ix.getX(t + 1), ix.getX(t + 2)] : [t, t + 1, t + 2]); return out; };
  const cross2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);      // in (x, z); < 0: the face looks up (+y)
  const area = P => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
  // the part of a convex polygon (x, z) on the left of a -> b (inside a triangle wound with cross2 > 0)
  const half = (P, a, b) => { const out = [], side = q => (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
    for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p); if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } }
    return out; };
  const bary = (x, z, a, b, c) => { const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]), w0 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d, w1 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d; return [w0, w1, 1 - w0 - w1]; };
  // the overlays' region and the carriers' up-facing triangles in it, wound with cross2 > 0, in a grid (x, z)
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const o of overlays) { o.updateMatrixWorld(true); const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const bb = tmpBox.copy(g.boundingBox).applyMatrix4(o.matrixWorld); x0 = Math.min(x0, bb.min.x - 1); z0 = Math.min(z0, bb.min.z - 1); x1 = Math.max(x1, bb.max.x + 1); z1 = Math.max(z1, bb.max.z + 1); }
  const grid = new Map(), key = (i, j) => i * 100003 + j, ctris = [];
  for (const c of carriers) { c.updateMatrixWorld(true); if (!c.geometry.boundingBox) c.geometry.computeBoundingBox(); const cb = tmpBox.copy(c.geometry.boundingBox).applyMatrix4(c.matrixWorld);
    if (cb.max.x < x0 || cb.min.x > x1 || cb.max.z < z0 || cb.min.z > z1) continue;
    const V = worldOf(c.geometry, c.matrixWorld), at = i => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]];
    for (const t of trisOf(c.geometry)) { let [a, b, d] = t.map(at); const s = cross2([a[0], a[2]], [b[0], b[2]], [d[0], d[2]]), l = Math.hypot((b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), -s, (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]));
      if (!(l > 0) || -s / l < 0.2) continue;                                                                       // up-facing only (the tops the overlays lie on)
      const bx0 = Math.min(a[0], b[0], d[0]), bx1 = Math.max(a[0], b[0], d[0]), bz0 = Math.min(a[2], b[2], d[2]), bz1 = Math.max(a[2], b[2], d[2]);
      if (bx1 < x0 || bx0 > x1 || bz1 < z0 || bz0 > z1) continue;
      [b, d] = [d, b];                                                                                              // cross2 > 0 for the clipping
      const ct = { v: [a, b, d], box: [bx0, bz0, bx1, bz1], k: ctris.length }; ctris.push(ct);
      for (let i = Math.floor(bx0 / CELL); i <= Math.floor(bx1 / CELL); i++) for (let j = Math.floor(bz0 / CELL); j <= Math.floor(bz1 / CELL); j++) { const k = key(i, j); let l2 = grid.get(k); if (!l2) grid.set(k, l2 = []); l2.push(ct); } } }
  stats.carrierTriangles = ctris.length; stats.msCarriers = Date.now() - t0;
  const mats = new Map(), out = [];
  for (const o of overlays) {
    const g = o.geometry, names = Object.keys(g.attributes);
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || (g.groups && g.groups.length > 1) || names.some(k => g.attributes[k].isInterleavedBufferAttribute) || Object.keys(g.morphAttributes || {}).length) throw new Error(`bend.js drape: ${o.name || o.type} is not a plain mesh`);
    if (!o.parent || !o.parent.matrixWorld.equals(IDENTITY)) throw new Error(`bend.js drape: ${o.name || o.type} is not in the world frame`);
    const V = worldOf(g, o.matrixWorld), nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld), attrs = names.filter(k => k !== 'position').map(k => [k, g.attributes[k]]);
    const P = [], N = attrs.map(() => []), DA = [], DB = [], DC = [], DW = [], I = [];
    // the overlay triangle's corner values of every attribute (normals turned to the world frame), taken once per triangle
    const cornersOf = T => T.vals || (T.vals = attrs.map(([k, a]) => [0, 1, 2].map(c => { const v = []; for (let q = 0; q < a.itemSize; q++) v.push(a.getComponent(T.i[c], q));
      if (k === 'normal' && a.itemSize === 3) { const n = new THREE.Vector3(v[0], v[1], v[2]).applyMatrix3(nm); v[0] = n.x; v[1] = n.y; v[2] = n.z; } return v; })));
    const vert = (x, y, z, T, ct) => {           // T: the overlay triangle (its corners' world positions and indices), ct: the carrier triangle or null
      const b = bary(x, z, ...T.v), C = cornersOf(T);
      attrs.forEach(([k, a], j) => { const s = a.itemSize, c0 = C[j][0], c1 = C[j][1], c2 = C[j][2], d = N[j], o = d.length; for (let c = 0; c < s; c++) d.push(b[0] * c0[c] + b[1] * c1[c] + b[2] * c2[c]);
        if (k === 'normal' && s === 3) { const l = Math.hypot(d[o], d[o + 1], d[o + 2]) || 1; d[o] /= l; d[o + 1] /= l; d[o + 2] /= l; } });
      if (ct) { const W = bary(x, z, ...ct.v); y = W[0] * ct.v[0][1] + W[1] * ct.v[1][1] + W[2] * ct.v[2][1]; DA.push(ct.v[0][0], ct.v[0][1], ct.v[0][2]); DB.push(ct.v[1][0], ct.v[1][1], ct.v[1][2]); DC.push(ct.v[2][0], ct.v[2][1], ct.v[2][2]); DW.push(W[0], W[1], W[2]); }
      else { DA.push(x, y, z); DB.push(x, y, z); DC.push(x, y, z); DW.push(1, 0, 0); }
      P.push(x, y, z); return P.length / 3 - 1; };
    const emit = (poly, T, ct, up) => {           // a convex piece as a fan, wound as its overlay triangle
      const vs = poly.map(([x, z]) => { const b = bary(x, z, ...T.v); return vert(x, b[0] * T.v[0][1] + b[1] * T.v[1][1] + b[2] * T.v[2][1], z, T, ct); });
      const f = (i, c) => Math.fround(P[i * 3 + c]);                                                               // the face as drawn (float32): no empty sliver
      for (let k = 1; k + 1 < vs.length; k++) { const a = vs[0], b = vs[k], c = vs[k + 1], s = cross2([f(a, 0), f(a, 2)], [f(b, 0), f(b, 2)], [f(c, 0), f(c, 2)]);
        if (Math.abs(s) < 1e-9) continue; stats.drawnArea += Math.abs(s) / 2; if ((s < 0) === up) I.push(a, b, c); else I.push(a, c, b); } };
    // the overlay's faces first merged into convex polygons (neighbours in one plane whose height and attributes follow one affine map: a stripe's two triangles,
    // a puddle's fan, a strip cut at 4 m), so that a carrier triangle under the overlay is cut once and not once per overlay triangle
    const tris = trisOf(g); stats.trianglesBefore += tris.length;
    const ids = new Map(), cid = i => { const k = Math.round(V[i * 3] * 1e6) + ',' + Math.round(V[i * 3 + 2] * 1e6); let c = ids.get(k); if (c === undefined) ids.set(k, c = i); return c; };
    const xz = i => [V[i * 3], V[i * 3 + 2]], polys = [];
    for (const t of tris) { const v = t.map(i => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]]), s0 = cross2(...v.map(q => [q[0], q[2]]));
      if (Math.abs(s0) < 2 * EPS) continue;                                                                          // a vertical or empty face of a flat overlay: nothing to lay
      stats.area += Math.abs(s0) / 2; polys.push({ loop: s0 < 0 ? [t[0], t[2], t[1]] : t.slice(), T: { i: t, v }, up: s0 < 0 }); }   // loops counter-clockwise in (x, z)
    const fits = (p, i) => { const b = bary(V[i * 3], V[i * 3 + 2], ...p.T.v);
      if (Math.abs(b[0] * p.T.v[0][1] + b[1] * p.T.v[1][1] + b[2] * p.T.v[2][1] - V[i * 3 + 1]) > 1e-6) return false;
      for (const [, a] of attrs) for (let c = 0; c < a.itemSize; c++) if (Math.abs(b[0] * a.getComponent(p.T.i[0], c) + b[1] * a.getComponent(p.T.i[1], c) + b[2] * a.getComponent(p.T.i[2], c) - a.getComponent(i, c)) > 1e-5) return false;
      return true; };
    for (let again = true; again;) { again = false; const edges = new Map(), touched = new Set();
      polys.forEach((p, k) => { if (!p.dead) p.loop.forEach((i, e) => edges.set(cid(i) + ',' + cid(p.loop[(e + 1) % p.loop.length]), [k, e])); });
      polys.forEach((p, k) => { if (p.dead || touched.has(k)) return;
        for (let e = 0; e < p.loop.length; e++) { const n = p.loop.length, hit = edges.get(cid(p.loop[(e + 1) % n]) + ',' + cid(p.loop[e])); if (!hit || hit[0] === k || touched.has(hit[0])) continue;
          const q = polys[hit[0]], f = hit[1], m = q.loop.length; if (q.dead || q.up !== p.up) continue;
          const loop = []; for (let s2 = 1; s2 <= n; s2++) loop.push(p.loop[(e + s2) % n]); for (let s2 = 2; s2 < m; s2++) loop.push(q.loop[(f + s2) % m]);   // p from b round to a, then q on to b
          let convex = true; for (let j = 0; j < loop.length && convex; j++) { const A = xz(loop[j]), Bq = xz(loop[(j + 1) % loop.length]), C = xz(loop[(j + 2) % loop.length]), c = cross2(A, Bq, C);
            convex = c > 1e-12 || (c >= -1e-12 && (Bq[0] - A[0]) * (C[0] - Bq[0]) + (Bq[1] - A[1]) * (C[1] - Bq[1]) > 0); }        // a straight corner goes on, never back
          if (!convex || !q.loop.every(i => fits(p, i))) continue;
          p.loop = loop; q.dead = true; touched.add(k); touched.add(hit[0]); again = true; return; } }); }
    for (const pl of polys) {
      if (pl.dead) continue;
      const T = pl.T, up = pl.up, poly0 = pl.loop.map(xz);
      const bx0 = Math.min(...poly0.map(q => q[0])), bx1 = Math.max(...poly0.map(q => q[0])), bz0 = Math.min(...poly0.map(q => q[1])), bz1 = Math.max(...poly0.map(q => q[1]));
      const cand = new Set(); for (let i = Math.floor(bx0 / CELL); i <= Math.floor(bx1 / CELL); i++) for (let j = Math.floor(bz0 / CELL); j <= Math.floor(bz1 / CELL); j++) for (const ct of grid.get(key(i, j)) || []) if (!(ct.box[2] < bx0 || ct.box[0] > bx1 || ct.box[3] < bz0 || ct.box[1] > bz1)) cand.add(ct);
      // the carriers by their height at the polygon's centre, highest first (a stable order where two are level)
      const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, hOf = ct => { const W = bary(cx, cz, ...ct.v); return W[0] * ct.v[0][1] + W[1] * ct.v[1][1] + W[2] * ct.v[2][1]; };
      const list = [...cand].map(ct => [hOf(ct), ct]).sort((p, q) => q[0] - p[0] || p[1].k - q[1].k).map(q => q[1]);
      const boxOf = P => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const q of P) { if (q[0] < a) a = q[0]; if (q[0] > c) c = q[0]; if (q[1] < b) b = q[1]; if (q[1] > d) d = q[1]; } P.box = [a, b, c, d]; return P; };
      let rest = [boxOf(poly0)];
      for (const ct of list) { if (!rest.length) break; const C = ct.v.map(q => [q[0], q[2]]), next = [], cb = ct.box;
        for (const R of rest) { if (R.box[2] < cb[0] || R.box[0] > cb[2] || R.box[3] < cb[1] || R.box[1] > cb[3]) { next.push(R); continue; }   // apart: nothing to cut
          let cur = R; const outs = [];
          for (let e = 0; e < 3 && cur.length >= 3; e++) { const a = C[e], b = C[(e + 1) % 3], o2 = half(cur, b, a); if (o2.length >= 3 && area(o2) > EPS) outs.push(boxOf(o2)); cur = half(cur, a, b); }
          if (cur.length < 3 || area(cur) <= EPS) { next.push(R); continue; }
          // the piece is this carrier's only if the carrier lies within win of the overlay there
          let mx = 0, mz = 0; for (const q of cur) { mx += q[0] / cur.length; mz += q[1] / cur.length; } const bo = bary(mx, mz, ...T.v), bc = bary(mx, mz, ...ct.v);
          if (Math.abs(bo[0] * T.v[0][1] + bo[1] * T.v[1][1] + bo[2] * T.v[2][1] - (bc[0] * ct.v[0][1] + bc[1] * ct.v[1][1] + bc[2] * ct.v[2][1])) > win) { next.push(R); continue; }
          emit(cur, T, ct, up); next.push(...outs); }
        rest = next; }
      for (const R of rest) if (R.length >= 3 && area(R) > EPS) { stats.unsupportedArea += area(R); stats.unsupportedTriangles++; emit(R, T, null, up); }
    }
    const G = new THREE.BufferGeometry();
    G.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    attrs.forEach(([k, a], j) => G.setAttribute(k, new THREE.BufferAttribute(new Float32Array(N[j]), a.itemSize)));          // getComponent gave them as floats
    G.setAttribute('drapeA', new THREE.BufferAttribute(new Float32Array(DA), 3)); G.setAttribute('drapeB', new THREE.BufferAttribute(new Float32Array(DB), 3));
    G.setAttribute('drapeC', new THREE.BufferAttribute(new Float32Array(DC), 3)); G.setAttribute('drapeW', new THREE.BufferAttribute(new Float32Array(DW), 3));
    G.setIndex(new THREE.BufferAttribute(P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I), 1));
    G.computeBoundingSphere(); G.computeBoundingBox(); G.name = g.name; G.userData = g.userData;
    o.geometry = G; o.position.set(0, 0, 0); o.quaternion.identity(); o.scale.set(1, 1, 1); o.updateMatrix(); o.updateMatrixWorld(true);
    let m = mats.get(o.material); if (!m) { m = o.material.clone(); m.userData.drape = true; mats.set(o.material, m); } o.material = m;
    stats.overlays++; stats.trianglesAfter += I.length / 3; out.push(o);
  }
  stats.ms = Date.now() - t0;
  return { list: out, stats };
}

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
  SEAM, PERIOD, SEAM_LON, EDGE, EPS, wrapUniform: wrapU, edgeUniform: edgeU, weatherFogUniform: weatherFogU,
  shift: shiftOf, wrapX: x => x + shiftOf(x),
  seamSplit, seamStats, subdivide, drape,
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
