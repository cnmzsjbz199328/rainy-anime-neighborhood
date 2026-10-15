// Shared geometry of the CR01 merge checks (tools/cr01_merge_check.mjs and U4 of tools/unify_check.mjs, docs/world/CR01_NW_REPAIR_PLAN.md section 5).
// Everything works on the final indexed triangles of the swept strips in the flat frame (x east, z south), never on the ranges roads.js used to cut them:
// the CR01 paving is the union of the ring's referenced triangles whose three vertices lie in its paved columns (the swept column offset, clipOffset,
// -2.25 m outside to 2.75 m with the inner asphalt shoulder), round the whole closed ring.
const R = 90, D = Math.PI / 180;
// Two triangles that only share an edge still overlap by Float32 rounding (|x| ~ 60 m: 4 µm per coordinate). 1e-5 m² is a 0.5 m edge 20 µm wide;
// anything above it is a positive-area overlap.
export const TOL_PAIR = 1e-5;
export const flatOf = (lon, lat) => [R * lon * D, -R * Math.asinh(Math.tan(lat * D))];
export const lonLatOf = (x, z) => ({ lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D });
export const metresY = (y, z) => y / Math.cosh(z / R) + 1.6;          // a strip's flat y (Mercator-scaled height above BASE) back to an altitude

const signed = p => p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0);
export const area = p => (p.length < 3 ? 0 : Math.abs(signed(p)) / 2);
// p clipped to the left of a->b (with the clip polygon's orientation)
function clipEdge(p, a, b, s) {
  const v = q => ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) * s, out = [];
  let prev = p[p.length - 1], vp = v(prev);
  for (const cur of p) { const vc = v(cur); if ((vc >= 0) !== (vp >= 0)) { const t = vp / (vp - vc); out.push([prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t]); } if (vc >= 0) out.push(cur); prev = cur; vp = vc; }
  return out;
}
// the intersection of two convex polygons ([[x, z], ...]) and its area
export function intersect(a, b) { let q = a; const s = signed(b) >= 0 ? 1 : -1; for (let i = 0; i < b.length && q.length >= 3; i++) q = clipEdge(q, b[i], b[(i + 1) % b.length], s); return q.length >= 3 ? q : []; }
export const overlapArea = (a, b) => area(intersect(a, b));
// barycentric weights of (x, z) in a flat triangle, or null outside it (tolerance tol in weight units)
export function bary(v, x, z, tol = 0) {
  const [a, b, c] = v, den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-14) return null;
  const w0 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / den, w1 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / den, w2 = 1 - w0 - w1;
  return w0 >= -tol && w1 >= -tol && w2 >= -tol ? [w0, w1, w2] : null;
}
// distance from a point to a convex polygon's outline (0 inside it)
export function distance(p, poly) {
  const s = signed(poly) >= 0 ? 1 : -1; let inside = true, d = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-24;
    if ((dx * (p[1] - a[1]) - dz * (p[0] - a[0])) * s < 0) inside = false;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)); d = Math.min(d, Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t));
  }
  return inside ? 0 : d;
}
// the referenced triangles of a strip: flat outline, heights (altitudes in metres), vertex ids and the vertex attributes the strip carries
export function triangles(strip, owner) {
  const P = strip.pos, ix = strip.index, out = [], O = strip.clipOffset, PV = strip.clipPaved;
  for (let t = 0; t < ix.length; t += 3) {
    const ids = [ix[t], ix[t + 1], ix[t + 2]], v = ids.map(k => [P[k * 3], P[k * 3 + 2]]), y = ids.map(k => metresY(P[k * 3 + 1], P[k * 3 + 2]));
    const xs = v.map(q => q[0]), zs = v.map(q => q[1]);
    out.push({ owner, ids, v, y, o: O ? ids.map(k => O[k]) : null, paved: PV ? ids.map(k => [PV[k * 2], PV[k * 2 + 1]]) : null,
      box: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] });
  }
  return out;
}
// a uniform grid over boxes [x0, x1, z0, z1]
export function gridIndex(items, cell = 1) {
  const cells = new Map(), key = (a, b) => a * 1048576 + b;
  items.forEach((it, id) => { for (let a = Math.floor(it.box[0] / cell); a <= Math.floor(it.box[1] / cell); a++) for (let b = Math.floor(it.box[2] / cell); b <= Math.floor(it.box[3] / cell); b++) { const k = key(a, b); let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(id); } });
  return {
    query(box, pad = 0) { const out = new Set(); for (let a = Math.floor((box[0] - pad) / cell); a <= Math.floor((box[1] + pad) / cell); a++) for (let b = Math.floor((box[2] - pad) / cell); b <= Math.floor((box[3] + pad) / cell); b++) for (const id of cells.get(key(a, b)) || []) out.add(id);
      return [...out].map(id => items[id]).filter(it => it.box[1] >= box[0] - pad && it.box[0] <= box[1] + pad && it.box[3] >= box[2] - pad && it.box[2] <= box[3] + pad); },
    at(x, z) { return (cells.get(key(Math.floor(x / cell), Math.floor(z / cell))) || []).map(id => items[id]); },
  };
}
// the CR01 paving and side bands from the ring's final triangles; `paved` is CR01's paved range (outer asphalt edge, inner asphalt shoulder edge)
export function ringParts(ring, paved = [-2.25, 2.75], eps = 1e-4) {
  if (!ring.strip.clipOffset) throw new Error('CR01 strip has no clipOffset (the swept column offset of each vertex)');
  const all = triangles(ring.strip, 'CR01'), pavedTris = [], side = [];
  for (const t of all) (t.o.every(o => o >= paved[0] - eps && o <= paved[1] + eps) ? pavedTris : side).push(t);
  return { all, paved: pavedTris, side, index: gridIndex(all, 1), pavedIndex: gridIndex(pavedTris, 1) };
}
// the ring's surface altitude at (x, z) from its final triangles, or null off the ring
export function ringHeight(parts, x, z, tol = 1e-6) {
  for (const t of parts.index.at(x, z)) { const w = bary(t.v, x, z, tol); if (w) return { h: w[0] * t.y[0] + w[1] * t.y[1] + w[2] * t.y[2], o: w[0] * t.o[0] + w[1] * t.o[1] + w[2] * t.o[2], t }; }
  return null;
}
