// R1-R3 (tools/ride_check.mjs) and W9b (tools/sphere_ride_check.mjs): the in-page route driver, installed once per deterministic page with
// page.evaluate(install, { LANE }): window.__RT = { routePath, drive, chain, ... } (moved out of ride_check.mjs unchanged).
// in-page helpers (installed once per deterministic page)
export function install(data) {
  const S = window.__scene, G = S.ground, Wd = window.WORLD, NET = Wd.roadNetwork, R = 90, D = Math.PI / 180, PER = G.PERIOD, HALF = PER / 2;
  const wdx = d => d - PER * Math.round(d / PER), wpi = a => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  const flat = (lon, lat) => [R * lon * D, -R * Math.asinh(Math.tan(lat * D))];
  const nodeXZ = id => { const n = NET.nodeById[id]; return flat(n.lon, n.lat); };
  const DIR = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 };
  const lineOf = id => G.lines.find(ln => (ln.kind === 'route' && ln.rt.def.segs.some(s => s.id === id)) || (ln.kind === 'bridge' && ln.b.ids.includes(id)) || ((ln.kind === 'stairs' || ln.kind === 'boardwalk') && ln.id === id));
  const range = (ln, id) => {
    if (ln.kind === 'route') { let i0 = -1, i1 = -1; for (let i = 0; i < ln.n; i++) if (ln.rt.def.segs[ln.rt.edgeOf[i]].id === id) { if (i0 < 0) i0 = i; i1 = i; } return [ln.S[i0].s, ln.S[i1].s]; }
    if (ln.kind === 'bridge') { const k = ln.b.ids.indexOf(id), J = ln.b.joints || []; return [k ? J[k - 1] : 0, k < J.length ? J[k] : ln.length]; }
    return [0, ln.length];
  };
  // a network chain at its left lane: points [x, z, chain m]; the seam's chain metre (where the display x jumps)
  const partsOf = id => G.lines.filter(ln => ln.kind === 'stairs' && (ln.edgeId || ln.id) === id);
  const chain = nodes => {
    const pts = []; let base = 0, seam = null;
    for (let i = 0; i + 1 < nodes.length; i++) {
      const e = NET.edges.find(q => (q.from === nodes[i] && q.to === nodes[i + 1]) || (q.from === nodes[i + 1] && q.to === nodes[i]));
      const parts = partsOf(e.id); if (parts.length > 1) { const pf0 = nodeXZ(nodes[i]), a0 = parts[0].point(0, 0), fwd0 = Math.hypot(wdx(a0.x - pf0[0]), a0.z - pf0[1]) < Math.hypot(wdx(parts[parts.length - 1].point(parts[parts.length - 1].length, 0).x - pf0[0]), parts[parts.length - 1].point(parts[parts.length - 1].length, 0).z - pf0[1]);
        for (const ln of fwd0 ? parts : parts.slice().reverse()) { const n = Math.max(2, Math.ceil(ln.length / 0.25)); for (let k = 0; k <= n; k++) { const s = fwd0 ? ln.length * k / n : ln.length * (1 - k / n), q = ln.point(s, 0), cm = base + ln.length * k / n; if (pts.length) { const pv = pts[pts.length - 1]; if (Math.hypot(wdx(q.x - pv[0]), q.z - pv[1]) < 1e-4) continue; } pts.push([q.x, q.z, cm, q.x, e.id]); } base += ln.length; }
        continue; }
      const ln = lineOf(e.id), [s0, s1] = range(ln, e.id);
      const pf = nodeXZ(nodes[i]), a = ln.point(s0, 0), b = ln.point(s1, 0), da = Math.hypot(wdx(a.x - pf[0]), a.z - pf[1]), db = Math.hypot(wdx(b.x - pf[0]), b.z - pf[1]), fwd = da <= db;
      const lane = data.LANE[e.class] ?? 0, o = fwd ? -lane : lane, n = Math.max(2, Math.ceil(Math.abs(s1 - s0) / 0.5));
      // a stair is entered along its axis: an approach point 1.3 m x s before its first tread (on the surface before it), and one after its last
      const axisPt = (sa, sb, d) => { const a = ln.point(sa, 0), b = ln.point(sb, 0), l = Math.hypot(b.x - a.x, b.z - a.z) || 1, q = G.at(a.x - (b.x - a.x) / l * d, a.z - (b.z - a.z) / l * d, { y: G.at(a.x, a.z) ? G.at(a.x, a.z).y : undefined }); return q && Math.abs(q.y - (G.at(a.x, a.z) || q).y) < 0.3 * q.s ? [a.x - (b.x - a.x) / l * d, a.z - (b.z - a.z) / l * d] : null; };
      if (ln.kind === 'stairs') { const sa = fwd ? s0 : s1, sb = fwd ? s0 + 0.5 : s1 - 0.5, ap = axisPt(sa, sb, 1.3 * (G.at(ln.point(sa, 0).x, ln.point(sa, 0).z) || { s: 1 }).s); if (ap) pts.push([ap[0], ap[1], base - 0.01, ap[0], e.id]); }
      for (let k = 0; k <= n; k++) { const s = fwd ? s0 + (s1 - s0) * k / n : s1 - (s1 - s0) * k / n, q = ln.point(s, o), cm = base + Math.abs(s1 - s0) * k / n;
        if (pts.length) { const pv = pts[pts.length - 1]; if (seam === null && Math.abs(G.wrap(q.x) - G.wrap(pv[3])) > HALF) seam = cm; if (Math.hypot(wdx(q.x - pv[0]), q.z - pv[1]) < 1e-4) continue; }
        pts.push([q.x, q.z, cm, q.x, e.id]); }
      if (ln.kind === 'stairs') { const sa = fwd ? s1 : s0, sb = fwd ? s1 - 0.5 : s0 + 0.5, ap = axisPt(sa, sb, 1.3 * (G.at(ln.point(sa, 0).x, ln.point(sa, 0).z) || { s: 1 }).s); if (ap && i + 2 < nodes.length) pts.push([ap[0], ap[1], base + Math.abs(s1 - s0) + 0.01, ap[0], e.id]); }
      base += Math.abs(s1 - s0);
    }
    return { pts, length: base, seam };
  };
  const arc = ([, c, r, a0, a1]) => { const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 5)), out = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * D; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } return out; };
  const SITE_PATHS = { 'LM02-east>LM02-northeast': ['LM02', [[0, 17.2], [0, 10.0], [11.0, 10.0], [11.9, 8.4], [12.6, 7.45], [14.63, 7.45]]] };
  // a route as one path: P [[x (continuous), z]], cumulative flat length, events at path indices
  const routePath = rt => {
    const P = [], ev = [], add = (x, z) => { if (P.length) { const pv = P[P.length - 1]; x = pv[0] + wdx(x - pv[0]); if (Math.hypot(x - pv[0], z - pv[1]) < 1e-4) return P.length - 1; } P.push([x, z]); return P.length - 1; };
    for (const leg of rt.legs) {
      let i0 = P.length ? P.length - 1 : 0, i1;
      if (leg.town) { const pts = leg.town.flatMap(q => (q[0] === 'arc' ? arc(q) : [q])); i0 = add(pts[0][0], pts[0][1]); for (const q of pts) i1 = add(q[0], q[1]); }
      else if (leg.nodes) { const c = chain(leg.nodes), from = leg.from === 'len-10' ? c.length - 10 : leg.fromSeam !== undefined ? c.seam - leg.fromSeam : leg.from || 0, until = leg.untilSeam !== undefined ? c.seam + leg.untilSeam : leg.until !== undefined ? leg.until : c.length;
        const sel = c.pts.filter(q => q[2] >= from - 1e-6 && q[2] <= until + 1e-6); i0 = add(sel[0][0], sel[0][1]); for (const q of sel) i1 = add(q[0], q[1]);
        for (const e of leg.ev || []) { let k = null;
          if (e.at === 'end') k = i1; else if (e.at === 0) k = i0; else if (e.at === 'seam') { if (c.seam !== null) { const q = sel.findIndex(p => p[2] >= c.seam); k = q >= 0 ? i0 + q : null; } }
          else if (typeof e.at === 'string') { const n = nodeXZ(e.at); let best = null; for (let j = i0; j <= i1; j++) { const d = Math.hypot(wdx(P[j][0] - n[0]), P[j][1] - n[1]); if (!best || d < best[0]) best = [d, j]; } k = best ? best[1] : null; }
          else if (Array.isArray(e.at)) { const idx = sel.map((p, j) => [p, j]).filter(([p]) => p[4] === e.at[0]); if (idx.length) { const pick = e.at[1] === 'mid' ? idx[Math.floor(idx.length / 2)] : idx.find(([p]) => p[2] - idx[0][0][2] >= e.at[1]) || idx[idx.length - 1]; k = i0 + pick[1]; } }
          if (k !== null) ev.push({ k, ...e }); }
        continue; }
      else if (leg.site) { const sp = SITE_PATHS[leg.site.join('>')], st = G.sites.find(q => q.id === sp[0]); i0 = P.length - 1; for (const [x, z] of sp[1]) { const q = st.toFlat(x, z, 0.06); i1 = add(q.x, q.z); } continue; }
      for (const e of leg.ev || []) ev.push({ k: e.at === 'end' ? i1 : e.at === 0 ? i0 : typeof e.at === 'number' ? (e.at === 1 ? i1 : i0) : i1, ...e });
    }
    const Lc = [0]; for (let i = 1; i < P.length; i++) Lc.push(Lc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    ev.sort((a, b) => a.k - b.k);
    return { P, Lc, ev };
  };
  const links = G.links();
  // ---- the driver
  const drive = (name, P, Lc, ev, o = {}) => {
    const n = P.length, total = Lc[n - 1], dt = 1 / 60, out = { name, reached: false, t: 0, limit: 0, steps: 0, off: 0, rejected: 0, dev: 0, wheel: 0, smooth: { n: 0, worst: 0, at: null }, apart: {}, layerChanges: [], layerBad: [], deckBad: 0, tunnelBad: 0,
      wraps: 0, contacts: 0, s: [Infinity, 0], kinds: {}, maxHeadJump: 0, camJump: 0, events: [], lookHead: 0, length: 0 };
    // the time allowed: each path piece at 0.6 x the cap of its surface, + 10 s, + the events
    let limit = 10; for (let i = 1; i < n; i++) { const q = G.at(P[i][0], P[i][1]), s = q ? q.s : 1, cap = S.ride.cfg && q ? window.RIDE.capOf(q) : 4.2; limit += (Lc[i] - Lc[i - 1]) / s / (0.6 * cap); out.length += (Lc[i] - Lc[i - 1]) / s; }
    for (const e of ev) limit += e.do === 'look360' ? 4 : e.do === 'pivot' || e.do === 'uturn' ? 4 : e.do === 'reverse' ? 8 : e.do === 'stop' ? 1 + (e.hold || 0) : 0.6;
    out.limit = limit;
    if (S.view.get().mode !== 'roam') { S.view.set({ mode: 'free', mapMode: 'flat' }); S.view.set({ mode: 'roam' }); }
    // start at the first path point with a walkable surface (a network leg may start exactly on a bridge end or a line end)
    let placed = null, i0 = 0; for (; i0 < Math.min(n - 1, 8) && !placed; i0++) { const h0 = Math.atan2(P[i0 + 1][0] - P[i0][0], P[i0 + 1][1] - P[i0][1]); placed = S.ride.set({ x: G.wrap(P[i0][0]), z: P[i0][1], heading: o.heading ?? h0, layer: o.layer, y: o.y }); }
    if (!placed) { out.start = 'off'; return out; }
    let g = S.ride.get(), ux = P[0][0] + wdx(g.x - P[0][0]), j = 0, u = 0, ei = 0, t = 0, prevRoot = g.root, prevLayer = g.layer, prevCam = S.ride.camera().position, prevH = g.heading, prevX = g.x, prevSpeed = g.speed;
    const offStart = g.offSurface, rejStart = g.rejected, wrapStart = g.wraps;
    // the nearest path point ahead; on a path that passes over itself in plan (a stair's foot under its gangway) never further on than 3 m x s past the progress
    let selfOver = false; for (let a = 0; a < n && !selfOver; a += 2) for (let b = a + 2; b < n; b += 2) if (Lc[b] - Lc[a] > 6 && Math.hypot(wdx(P[b][0] - P[a][0]), P[b][1] - P[a][1]) < 1.0) { selfOver = true; break; }
    out.selfOver = selfOver;
    const proj = () => { let best = null; for (let i = j; i < Math.min(n - 1, j + 90) && (!selfOver || Lc[i] <= u + 3 * g.s); i++) { const ax = P[i][0], az = P[i][1], dx = P[i + 1][0] - ax, dz = P[i + 1][1] - az, l2 = dx * dx + dz * dz || 1e-12, tt = Math.max(0, Math.min(1, ((ux - ax) * dx + (g.z - az) * dz) / l2)), d = Math.hypot(ux - ax - dx * tt, g.z - az - dz * tt); if (!best || d < best.d - 1e-9) best = { i, d, u: Lc[i] + Math.sqrt(l2) * tt }; } return best; };
    const at = uu => { let i = Math.max(0, j - 2); while (i > 0 && Lc[i] > uu) i--; while (i + 2 < n && Lc[i + 1] < uu) i++; const tt = Math.max(0, Math.min(1, (uu - Lc[i]) / Math.max(1e-9, Lc[i + 1] - Lc[i]))); return [P[i][0] + (P[i + 1][0] - P[i][0]) * tt, P[i][1] + (P[i + 1][1] - P[i][1]) * tt]; };
    // the curvature at each path point (heading change over +-0.5 flat units), then the largest within a window ahead
    const HD = P.map((_, i) => { let a = i, b = i; while (a > 0 && Lc[i] - Lc[a] < 0.5) a--; while (b < n - 1 && Lc[b] - Lc[i] < 0.5) b++; return Math.atan2(P[b][0] - P[a][0], P[b][1] - P[a][1]); });
    const KP = P.map((_, i) => { let b = i; while (b < n - 1 && Lc[b] - Lc[i] < 0.5) b++; return b > i ? Math.abs(wpi(HD[b] - HD[i])) / Math.max(1e-6, Lc[b] - Lc[i]) : 0; });
    const kappa = (u0, len) => { let k = 0; for (let i = j; i < n && Lc[i] <= u0 + len; i++) if (Lc[i] >= u0 - 0.5) k = Math.max(k, KP[i]); return k; };
    const step = input => {
      g = S.ride.step(dt, input); t += dt; out.steps++;
      const s = g.s; out.s[0] = Math.min(out.s[0], s); out.s[1] = Math.max(out.s[1], s); out.kinds[g.kind] = (out.kinds[g.kind] || 0) + 1; if (g.contact) { out.contacts++; const ck = g.contact.type + ' ' + g.contact.src; out.contactSrc = out.contactSrc || {}; out.contactSrc[ck] = (out.contactSrc[ck] || 0) + 1; }
      if (g.rejected > (out._rj ?? g.rejected)) { out.rejAt = out.rejAt || []; if (out.rejAt.length < 6) out.rejAt.push([+g.x.toFixed(2), +g.z.toFixed(2), g.kind, g.mode]); } out._rj = g.rejected;
      if (Math.abs(g.x - prevX) > HALF) { /* wrapped */ }
      ux = ux + wdx(g.x - prevX);
      // K2: the wheels on I1, the root's change
      const fx = Math.sin(g.heading), fz = Math.cos(g.heading), hw = 0.47 * s;
      // a carried bike's wheels touch nothing (listed apart); a wheel over no surface of its level is counted
      if (!g.carry) for (const [sg, y] of [[1, g.wheels[0]], [-1, g.wheels[1]]]) { const q = G.at(g.x + sg * fx * hw, g.z + sg * fz * hw, { y }); if (q && Math.abs(q.y - y) <= 0.35 * s) out.wheel = Math.max(out.wheel, Math.abs(q.y - y) / s); else out.wheelOff = (out.wheelOff || 0) + 1; }
      const move = Math.hypot(wdx(g.x - prevX), 0) + 0, mv = Math.hypot(wdx(g.x - prevX), g.z - (out._pz ?? g.z)) / s, dRoot = Math.abs(g.root - prevRoot) / s, lim = mv * 0.15 + 0.005;
      void move;
      if (dRoot > lim) { const atLink = links.some(l => (l.kind === 'abutment' || l.kind === 'portal') && Math.hypot(wdx(l.x - g.x), l.z - g.z) < 3 * s);
        const wk = [g.kind, ...(g.wheelKinds || [])], joint = g.line !== out._line || g.kind === 'junction', key = g.mode === 'push' || wk.includes('stairs') ? 'push' : wk.includes('boardwalk') ? 'boardwalk' : wk.includes('site') ? 'site' : atLink ? 'abutment' : joint ? 'joint' : null;
        if (key) { const a = out.apart[key] || (out.apart[key] = { n: 0, worst: 0 }); a.n++; a.worst = Math.max(a.worst, dRoot); }
        else { out.smooth.n++; if (dRoot - lim > out.smooth.worst) { out.smooth.worst = dRoot - lim; out.smooth.at = [+g.x.toFixed(2), +g.z.toFixed(2), g.kind, g.line, +dRoot.toFixed(4)]; } } }
      // K3: layers
      if (g.layer !== prevLayer) { const near = links.reduce((m, l) => Math.min(m, Math.hypot(wdx(l.x - g.x), l.z - g.z) / s), Infinity); out.layerChanges.push([prevLayer, g.layer, +near.toFixed(2)]); if (near > 3) out.layerBad.push([prevLayer, g.layer, +g.x.toFixed(1), +g.z.toFixed(1), +near.toFixed(1)]); }
      if (G.layers(g.x, g.z).some(c => c.layer === 'deck' && Math.abs(c.y - g.y) < 0.6 * s) && g.layer !== 'deck') out.deckBad++;
      // K8: heading, speed and camera unbroken across a wrap
      const cam = S.ride.camera().position, w = g.wraps - (out._w ?? wrapStart); out._w = g.wraps;
      const dc = Math.hypot(wdx(cam[0] - prevCam[0]), cam[1] - prevCam[1], cam[2] - prevCam[2]) / s; if (w) { out.wrapCam = Math.max(out.wrapCam || 0, dc); out.wrapHead = Math.abs(wpi(g.heading - prevH)); out.wrapSpeed = Math.abs(g.speed - prevSpeed); }
      out.camJump = Math.max(out.camJump, dc);
      out._line = g.line; prevRoot = g.root; prevLayer = g.layer; prevCam = cam; prevH = g.heading; prevX = g.x; prevSpeed = g.speed; out._pz = g.z;
      return g;
    };
    const stopNow = (hold = 0.2) => { let k = 0; while (Math.abs(g.speed) > 0.01 && k++ < 600) step({ throttle: g.speed > 0 ? -1 : 1, steer: 0 }); for (let i = 0; i < Math.round(hold / dt); i++) step({ throttle: 0, steer: 0 }); };
    const pivotTo = h => { let k = 0; while (Math.abs(wpi(h - g.heading)) > 0.03 && k++ < 600) step({ throttle: 0, steer: wpi(h - g.heading) > 0 ? -1 : 1 }); for (let i = 0; i < 12; i++) step({ throttle: 0, steer: 0 }); };
    const play = e => {
      const rec = { do: e.do, k: e.k, at: [+g.x.toFixed(2), +g.z.toFixed(2)] };
      if (e.do === 'stop') stopNow(e.hold || 0.2);
      if (e.do === 'pivot') { stopNow(); pivotTo(e.to === 'back' ? g.heading + Math.PI : typeof e.to === 'string' ? DIR[e.to] : e.to); }
      if (e.do === 'uturn') { stopNow(); pivotTo(g.heading + Math.PI); }
      if (e.do === 'reverse') { stopNow(); const x0 = g.x, z0 = g.z; let k = 0; while (Math.hypot(wdx(g.x - x0), g.z - z0) / g.s < (e.m || 2) && k++ < 900) step({ throttle: -1, steer: 0 }); stopNow(); rec.back = +(Math.hypot(wdx(g.x - x0), g.z - z0) / g.s).toFixed(2); }
      if (e.do === 'look360' || e.look) { if (e.do !== 'stop') stopNow(); const h = g.heading, api = S.ride.api(); for (let i = 0; i < 180; i++) { api.look(2 * Math.PI / 0.005 / 180, 0); step({ throttle: 0, steer: 0 }); } rec.dHead = Math.abs(wpi(g.heading - h)); out.lookHead = Math.max(out.lookHead, rec.dHead); api.recentre(); for (let i = 0; i < 30; i++) step({ throttle: 0, steer: 0 }); rec.yawAfter = +S.ride.get().lookYaw.toFixed(4); }
      if (e.do === 'recentre') { S.ride.api().recentre(); for (let i = 0; i < 30; i++) step({ throttle: 0, steer: 0 }); }
      out.events.push(rec);
    };
    while (t < limit) {
      const q = proj(); j = q.i; u = Math.max(u, q.u); out.dev = Math.max(out.dev, q.d / g.s);
      const next = ei < ev.length ? ev[ei] : null, goal = next ? Lc[next.k] : total, s = g.s, dGoal = (goal - u) / s;
      const halts = e => ['stop', 'pivot', 'uturn', 'reverse', 'look360', 'recentre'].includes(e.do) || e.look;
      if (next && !halts(next) && (u >= goal || dGoal < 0.25)) { out.events.push({ do: next.do, k: next.k }); ei++; continue; }
      if (dGoal < 0.25) { if (next) { play(next); ei++; continue; } if (Math.abs(g.speed) < 0.02) { out.reached = true; break; } }
      const la = Math.min((g.mode === 'push' ? 0.8 : 2.5) * s, Math.max(0.3 * s, goal - u)), tgt = at(Math.min(goal, u + la)), dx = tgt[0] - ux, dz = tgt[1] - g.z;
      const err = Math.hypot(dx, dz) > 1e-6 ? wpi(Math.atan2(dx, dz) - g.heading) : 0, steer = Math.max(-1, Math.min(1, -3 * err));
      const k = kappa(u / 1, 4 * s) / s, vt = Math.min(g.cap, Math.sqrt(3.0 / Math.max(k, 1e-6)), Math.sqrt(2 * 2.0 * Math.max(0, dGoal - 0.15)), Math.abs(err) > 1.0 ? 0.6 : Infinity);
      const throttle = g.speed > vt + 0.05 ? -Math.max(0.15, Math.min(1, (g.speed - vt) / 1.5)) : Math.max(0, Math.min(1, vt / g.cap + (vt - g.speed) * 0.5));
      step({ throttle, steer });
      if (o.trace && out.steps % 6 === 0 && u / g.s >= o.trace[0] && u / g.s <= o.trace[1]) (out.trace = out.trace || []).push([+(u / g.s).toFixed(2), +g.x.toFixed(2), +g.z.toFixed(2), +g.heading.toFixed(2), +steer.toFixed(2), +throttle.toFixed(2), +g.speed.toFixed(2), g.mode, g.carry, g.kind, g.contact && g.contact.type + ' ' + g.contact.src]);
      if (Math.abs(g.speed) < 0.02 && dGoal > 0.25 && g.contact) { out.stuck = (out.stuck || 0) + 1;
        // a dead end (a line's end at a landmark entrance): the body stops (0.5 + 0.32) m x s before the end; blocked that close to the goal counts as there
        if (out.stuck > 30 && dGoal < (S.ride.cfg.half + S.ride.cfg.radius + 0.5)) { out.deadEnd = (out.deadEnd || 0) + 1; u = goal; out.stuck = 0; if (next) { play(next); ei++; } else { out.reached = true; break; } continue; }
        if (out.stuck === 45 && (out.backs || 0) < 6) { out.backs = (out.backs || 0) + 1; const side = (g.contact.nx * Math.cos(g.heading) - g.contact.nz * Math.sin(g.heading)) > 0 ? 1 : -1; for (let i = 0; i < 40; i++) step({ throttle: -1, steer: side }); stopNow(); }
        if (out.stuck > 240) { out.stuckAt = [+g.x.toFixed(2), +g.z.toFixed(2), g.contact.type, g.contact.src]; break; } } else out.stuck = 0;
    }
    out.t = t; out.off = g.offSurface - offStart; out.rejected = g.rejected - rejStart; out.wraps = g.wraps - wrapStart; out.u = u / (g.s || 1); out.total = total / (g.s || 1);
    delete out._w; delete out._pz; delete out._rj; delete out._line; return out;
  };
  window.__RT = { routePath, drive, chain, wdx, wpi, nodeXZ, lineOf, range, flat, links };
  return { lines: G.lines.length, links: links.length };
}
