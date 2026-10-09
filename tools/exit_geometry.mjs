// W8g-b (W8_SPEC 13.2 B5): geometric checks of the town exits on the meshes the page actually shows (shared by tools/exit_check.mjs and tools/road_check.mjs).
// All functions take a Playwright page with index.html loaded (any renderer); they finish the background generation first.
//   exitRays(page): for every exit head, rows 0 .. K (its first L metres), 9 points across the whole cross-section (footprint: paved + shoulder + ditch), a ray from
//     30 m above straight down to the road (flat state: along -y; sphere state, uBend = 1: along the sphere's radius, the triangles bent on the CPU with BEND.point):
//     the first surface hit must be a road mesh (the start-up heads, the network's road meshes, the section's T03 / T11 strips). Candidates: every visible opaque
//     non-instanced mesh with an identity world matrix outside the town's own objects. Also reports, for information, the network road from L to 24 m (ruling 2).
//   exitSeams(page): the seam between each head and the road beyond it (positions, normals of row K), the step from the road surface to the cut terrain edge, widths.
export const prepare = page => page.evaluate(() => { const S = window.__scene; if (S.worldgen) S.worldgen.finish(); S.terrain.buildRest(); S.section.ensure(); S.roads.ensure(); S.ocean.ensure(); S.cover.ensure(); S.landmarks.build(); return true; });

export async function exitRays(page, { beyond = 24 } = {}) {
  await prepare(page);
  return page.evaluate(([beyond]) => {
    const S = window.__scene, T = window.THREE, B = S.bend, out = {};
    const setState = st => { S.transition.auto = false; if (st === 'sphere') { S.transition.setMode('sphere'); S.transition.step(3); } else { S.transition.setMode('flat'); S.transition.step(3); S.bend.set(0); } S.terrain.setExplore(true); S.terrain.setFade(1); window.__step ? window.__step(2) : 0; };
    // left out: the town's own objects, and the landmarks' (things that stand at a road, like the lamp posts; LM09's entrance lane overlays the road on purpose, W8f-c G2)
    const townSet = new Set(); for (const r of S.town.roots) r.traverse(o => townSet.add(o)); for (const lm of Object.values(S.landmarks.info)) if (lm && lm.groups) for (const g of lm.groups) g.traverse(o => townSet.add(o));
    const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    const roadSet = new Set([...S.terrain.heads]); S.roads.state.root.traverse(o => { if (o.isMesh) roadSet.add(o); });
    S.section.state.root.traverse(o => { if (o.isMesh && /T03|T11/.test(o.name)) roadSet.add(o); });
    const heads = S.terrain.exitHeads, routes = S.roads.data().routes;
    const colPt = (st, m, i, j) => [st.pos[(i * m + j) * 3], st.pos[(i * m + j) * 3 + 1], st.pos[(i * m + j) * 3 + 2]];
    const atO = (rt, i, o) => { const g = rt.grid, m = g.length; let j = 0; while (j + 2 < m && g[j + 1] < o) j++; const t = Math.max(0, Math.min(1, (o - g[j]) / (g[j + 1] - g[j]))), a = colPt(rt.strip, m, i, j), b = colPt(rt.strip, m, i, j + 1); return [0, 1, 2].map(k => a[k] + (b[k] - a[k]) * t); };
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const hit = (o, d, A, Bv, C) => { const e1 = sub(Bv, A), e2 = sub(C, A), p = cr(d, e2), det = dt(e1, p); if (Math.abs(det) < 1e-14) return null; const inv = 1 / det, s = sub(o, A), u = dt(s, p) * inv; if (u < -1e-7 || u > 1 + 1e-7) return null; const q = cr(s, e1), v = dt(d, q) * inv; if (v < -1e-7 || u + v > 1 + 1e-7) return null; const t = dt(e2, q) * inv; return t > 0 ? t : null; };
    for (const st of ['flat', 'sphere']) {
      setState(st); const u = st === 'sphere' ? 1 : 0, bend = p => (u ? B.point(p[0], p[1], p[2], 1) : p);
      // candidate triangles near the exits (flat x, z within 30 m of a head's first row), bucketed by 1 m cell of the flat frame
      const cand = []; S.scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || townSet.has(o) || !shown(o) || !o.geometry || !o.geometry.attributes.position) return; const m = o.material; if (Array.isArray(m) || m.transparent || m.blending === T.AdditiveBlending) return; o.updateMatrixWorld(); if (!o.matrixWorld.equals(new T.Matrix4())) return; cand.push(o); });
      const near = heads.map(h => { const p = colPt(h.rt.strip, h.rt.grid.length, 0, Math.floor(h.rt.grid.length / 2)); return [p[0], p[2]]; }), cells = new Map();
      for (const o of cand) { const pos = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : pos.count, road = roadSet.has(o);
        for (let t = 0; t + 2 < n; t += 3) { const v = [0, 1, 2].map(k => { const i = idx ? idx.getX(t + k) : t + k; return [pos.getX(i), pos.getY(i), pos.getZ(i)]; }), x0 = Math.min(v[0][0], v[1][0], v[2][0]), x1 = Math.max(v[0][0], v[1][0], v[2][0]), z0 = Math.min(v[0][2], v[1][2], v[2][2]), z1 = Math.max(v[0][2], v[1][2], v[2][2]);
          if (!near.some(([x, z]) => x1 > x - 32 && x0 < x + 32 && z1 > z - 32 && z0 < z + 32)) continue;
          const tri = { v: v.map(bend), road, name: (o.name || o.parent?.name || 'mesh') + (o.userData.terrain ? ':' + o.userData.terrain.kind : '') };
          for (let ix = Math.floor(x0 - 0.05); ix <= Math.floor(x1 + 0.05); ix++) for (let iz = Math.floor(z0 - 0.05); iz <= Math.floor(z1 + 0.05); iz++) { const k = ix * 100000 + iz; let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(tri); } } }
      const first = p => { const top = bend([p[0], p[1] + 30, p[2]]), dir = (() => { const q = sub(bend(p), top), l = Math.hypot(...q); return q.map(c => c / l); })(); let best = null;
        for (const tri of cells.get(Math.floor(p[0]) * 100000 + Math.floor(p[2])) || []) { const t = hit(top, dir, ...tri.v); if (t !== null && (!best || t < best.t - 1e-4 || (Math.abs(t - best.t) <= 1e-4 && tri.road && !best.road))) best = { t, road: tri.road, name: tri.name }; } return best; };
      const res = { rays: 0, occluded: 0, missed: 0, examples: [], beyondRays: 0, beyondOccluded: 0, beyondExamples: [] };
      const testRow = (rt, i, exit, s, isBeyond) => { const fp = rt.footprint[i]; for (let k = 0; k <= 8; k++) { const o = fp[2] + (fp[3] - fp[2]) * k / 8, p = atO(rt, i, o), h = first(p);
        if (isBeyond) { res.beyondRays++; if (h && !h.road) { res.beyondOccluded++; if (res.beyondExamples.length < 6) res.beyondExamples.push(`${exit}@${s.toFixed(1)}m,o${o.toFixed(2)} ${h.name}`); } continue; }
        res.rays++; if (!h) { res.missed++; if (res.examples.length < 8) res.examples.push(`${exit}@${s.toFixed(1)}m,o${o.toFixed(2)} 无命中`); } else if (!h.road) { res.occluded++; if (res.examples.length < 8) res.examples.push(`${exit}@${s.toFixed(1)}m,o${o.toFixed(2)} ${h.name}`); } } };
      for (const h of heads) {
        // rows inside the head: s = 0 is the patch edge itself, where the town begins; row K is the seam, where the explore view's road continues over the terrain (ruling 2)
        for (let i = 1; i < h.K; i++) testRow(h.rt, i, h.exit, h.rt.samples[i].s, false);
        const net = h.exit === 'N08' ? S.section.state.chain : routes.find(r => r.def.exit === h.exit);
        if (net && net.footprint) for (let i = h.K + 1; i < net.samples.length && net.samples[i].s <= beyond + 1e-9; i++) testRow(net, i, h.exit, net.samples[i].s, true);
      }
      out[st] = res;
    }
    S.transition.setMode('flat'); S.transition.step(3); S.bend.set(0); S.transition.auto = true;
    return out;
  }, [beyond]);
}

export async function exitSeams(page) {
  await prepare(page);
  return page.evaluate(() => {
    const S = window.__scene, T = window.THREE, TT = window.TERRAIN, H = S.terrain.sampler(), R = 90, D = Math.PI / 180, routes = S.roads.data().routes, out = [];
    const unflat = (x, z) => ({ lon: x / (R * D), lat: Math.atan(Math.sinh(-z / R)) / D });
    for (const h of S.terrain.exitHeads) {
      const rt = h.rt, m = rt.grid.length, K = h.K, net = h.exit === 'N08' ? S.section.state.chain : routes.find(r => r.def.exit === h.exit), n = net ? net.samples.length : 0;
      let dPos = 0, dCol = 0; if (net && K < n) for (let k = K * m * 3; k < (K + 1) * m * 3; k++) { dPos = Math.max(dPos, Math.abs(net.strip.pos[k] - rt.strip.pos[k])); dCol = Math.max(dCol, Math.abs(net.strip.col[k] - rt.strip.col[k])); }
      // normals of the seam row: the head's (cells of rows 0 .. K + 1) against the road mesh's own normal attribute (built from the cells of rows K - 1 .. end)
      let dNrm = null;
      if (!h.upNormals && net && K + 1 < n) { const hn = TT.stripNormals(T, rt.strip.pos, rt.strip.index, m, 0, Math.min(K + 1, rt.samples.length - 1)), mesh = S.roads.objects.strips.find(q => q.geometry.attributes.position.array === net.strip.pos), nn = mesh ? mesh.geometry.attributes.normal.array : null;
        if (nn) { dNrm = 0; for (let k = K * m * 3; k < (K + 1) * m * 3; k++) dNrm = Math.max(dNrm, Math.abs(nn[k] - hn[k])); } }
      // the step from the road's surface to the cut terrain edge: at the footprint's edges + 0.3 m on rows 0 .. K (the road's verge columns there) against the terrain's height
      let dEdge = 0; const surfAt = (i, o) => { const g = rt.grid; let j = 0; while (j + 2 < m && g[j + 1] < o) j++; const t = Math.max(0, Math.min(1, (o - g[j]) / (g[j + 1] - g[j]))), a = (i * m + j) * 3, b = a + 3, p = [0, 1, 2].map(c => rt.strip.pos[a + c] + (rt.strip.pos[b + c] - rt.strip.pos[a + c]) * t); return p; };
      // (the cut follows the strip's outer edge, ruling 5)
      for (let i = 0; i <= K; i++) for (const o of [rt.grid[0], rt.grid[m - 1]]) { const p = surfAt(i, o), ll = unflat(p[0], p[2]), k = 1 / Math.cos(ll.lat * D), y = (H(ll.lon, ll.lat) - 1.6) * k; dEdge = Math.max(dEdge, Math.abs(p[1] - y) / k); }
      // paved width (true metres, flat frame / k) at s = 0, 7, 14 m: the same head mesh shows in the town and the explore view
      const widthAt = s => { let i = 0; while (i + 1 <= K && rt.samples[i + 1].s <= s + 1e-9) i++; const a = surfAt(i, rt.paved[i][0]), b = surfAt(i, rt.paved[i][1]), la = unflat(a[0], a[2]), lb = unflat(b[0], b[2]); return { s: rt.samples[i].s, w: window.WORLD.arcDistance(la, lb) }; };
      out.push({ exit: h.exit, L: h.L, K, whole: h.whole, net: !!net, dPos, dCol, dNrm, dEdge, widths: [0, 7, 14].filter(s => s <= h.L + 1e-9).map(widthAt), maxChange: net && net.head ? net.head.maxChange : null });
    }
    return out;
  });
}
