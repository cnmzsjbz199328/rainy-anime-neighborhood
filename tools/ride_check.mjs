// R1-R3 (docs/world/THIRD_PERSON_ROAM_PLAN.md 6.11, 6.13): machine checks of the ride on the built page (real GPU, ANGLE Metal, as unify_check).
//   node tools/ride_check.mjs [--only K1,K2,...] [--routes RT-01,RT-02,...] [--json path]
// Deterministic items run on a page whose animation frames are driven by hand (road_views.mjs INIT): only window.__scene.ride.step() moves the rider, at dt = 1/60 s.
// A pure-pursuit driver (look-ahead 2.5 m x s, speed by the curvature ahead v <= sqrt(3.0 / k), by the surface cap and by the distance to the next stop) follows the lane
// lines of tools/ride_routes.mjs (town legs: their waypoints; network legs: each edge's line at its left-lane offset; I9 site legs: the site's path) and plays the
// events (stop, hold, pivot, U-turn, reverse, look round, recentre).
//   K1  every selected route reaches its end within length / (0.6 x cap) + 10 s (+ the events' own time); no substep without a walkable surface
//   K2  the wheel contacts on the I1 surface (<= 0.01 m x s); the root's change per substep <= move x 0.15 + 0.005 m x s (stairs, the boardwalk planks and site edges listed apart)
//   K3  on a bridge the rider is on the deck layer; in the tunnel on the tunnel layer; layer changes only within 3 m x s of a link (abutment, portal, stair end, gate)
//   K4  the collision probes RC-01..RC-10 at 90 and 30 deg at the surface cap: penetration <= 0.02 m x s; 90 deg stops (RC-02 passes); 30 deg slides keeping >= 50 %;
//       a 0.12 s frame does not pass a post
//   K6  real input events (desktop and touch pages, live frames)
//   K7  the spawn probes RS-01..RS-12 (6.3)
//   K8  the seam: one wrap per crossing, heading and speed unbroken, the camera without a jump
//   K11 the W9a town corridors, RT-01/RT-02/RT-03 town legs and the 20 random pieces outside the town ride through; no page errors
//   K5  (R2) the camera along ridden routes (--k5routes): never inside an occluder, 0.12 m x s over the surface, the horizontal limit, the sight line blocked <= 1 % of the
//       steps and never longer than 0.2 s, >= 1.2 m in alleys and W01, inside the tunnel lining with 0.3 m; rays from the focus to the camera against the rendered scene
//   K9  (R2) the rider: height <= 1.75 m x s, both wheels on the ground, wheel rate v / 0.3, lean and bars with the turn, pitch with the slope, one foot down when stopped
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { INIT } from './road_views.mjs';
import { ROUTES, LANE, COLLISION_PROBES, SPAWN_PROBES, random20 } from './ride_routes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url), argv = process.argv.slice(2);
const opt = k => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : null);
const ONLY = opt('--only') ? opt('--only').split(',') : null, want = k => !ONLY || ONLY.includes(k);
const R1_ROUTES = ['RT-01', 'RT-02', 'RT-03a', 'RT-03b', 'RT-03c', 'RT-03d', 'RT-03e', 'RT-03f', 'RT-03g', 'RT-03h', 'RT-03i', 'RT-06b'];
const SEL = opt('--routes') === 'all' ? ROUTES.map(r => r.id) : opt('--routes') ? opt('--routes').split(',') : R1_ROUTES;
const L = require(path.join(root, 'layout.js')), W = require(path.join(root, 'world.js'));
const results = [], report = { checks: {}, routes: [], probes: [], spawns: [], inputs: [] };
const check = (id, ok, detail, lines = []) => { results.push([id, ok]); report.checks[id] = { ok, detail }; console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); for (const l of lines) console.log('  · ' + l); };
const f = (v, n = 3) => (v === null || v === undefined ? '—' : (+v).toFixed(n));

const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const errors = [];
async function open({ init = false, touch = false } = {}) {
  const page = await browser.newPage(touch ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 800 } });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
  if (init) await page.addInitScript(INIT);
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?quality=high', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__scene && window.__scene.ride && window.__scene.ground, null, { timeout: 180000, polling: 200 });
  if (init) await page.evaluate(() => window.__step(3)); else await page.waitForTimeout(800);
  return page;
}

// ---------------------------------------------------------------- in-page helpers (installed once per deterministic page)
function install(data) {
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

// ---------------------------------------------------------------- deterministic page
const page = await open({ init: true });
await page.evaluate(install, { LANE });
await page.evaluate(() => { const S = window.__scene; S.view.set({ mode: 'free', mapMode: 'flat', target: [-7, 1.2, 20], yaw: 2.5, pitch: 0.5, dist: 34 }); window.__step(2); S.view.set({ mode: 'roam' }); window.__step(1); });
const prep = await page.evaluate(() => ({ mode: window.__scene.view.get().mode, townMs: window.__scene.ride.api().townMs, stats: { ...window.__scene.ride.world().stats }, boxes: window.__scene.ride.landmarkBoxes.length }));
console.log(`INFO 骑行进入 ${prep.mode}；城镇边界预建 ${prep.townMs} ms；候选边 ${prep.stats.candidates}、已建网格 ${prep.stats.cellsBuilt}、边界记录 ${prep.stats.records}、障碍 ${prep.stats.obstacles}（地标实体盒 ${prep.boxes}）`);

// ---- K1-K3 (and K8 on the seam routes): the fixed routes
if (want('K1') || want('K2') || want('K3') || want('K8')) {
  const res = [];
  for (const id of SEL) {
    const rt = ROUTES.find(q => q.id === id); if (!rt) { console.log(`WARN 没有路线 ${id}`); continue; }
    const tr = opt('--trace') ? opt('--trace').split(',').map(Number) : null;
    const r = await page.evaluate(({ rt, tr }) => { const { P, Lc, ev } = window.__RT.routePath(rt); return window.__RT.drive(rt.id, P, Lc, ev, { trace: tr }); }, { rt, tr });
    res.push(r); report.routes.push(r);
    console.log(`  · ${r.name} ${r.reached ? '到达' : `未到（${f(r.u, 1)}/${f(r.total, 1)} m${r.stuckAt ? '，卡在 ' + JSON.stringify(r.stuckAt) : ''}）`} ${f(r.length, 1)} m、用时 ${f(r.t, 1)}/${f(r.limit, 1)} s、离面 ${r.off}、拒步 ${r.rejected}、偏离 ${f(r.dev, 2)} m、接触步 ${r.contacts}、轮 ${f(r.wheel, 4)} m、平顺超限 ${r.smooth.n}${r.smooth.n ? ' ' + JSON.stringify(r.smooth.at) : ''}${Object.keys(r.apart).length ? '、另判 ' + JSON.stringify(r.apart) : ''}、换层 ${r.layerChanges.length}${r.layerBad.length ? ' 越界 ' + JSON.stringify(r.layerBad) : ''}${r.wraps ? `、跨接缝 ${r.wraps}` : ''}、s ${f(r.s[0], 2)}–${f(r.s[1], 2)}、${Object.keys(r.kinds).join('/')}`);
  }
  if (want('K1')) check('K1', res.length > 0 && res.every(r => r.reached && r.t <= r.limit && r.off === 0), `固定路线走通 ${res.filter(r => r.reached && r.t <= r.limit).length}/${res.length}（${res.map(r => r.name).join('、')}），离开可走面 ${res.reduce((a, r) => a + r.off, 0)} 次`);
  if (want('K2')) { const wheel = Math.max(...res.map(r => r.wheel)), sm = res.reduce((a, r) => a + r.smooth.n, 0), apart = {}; for (const r of res) for (const [k, v] of Object.entries(r.apart)) { apart[k] = apart[k] || { n: 0, worst: 0 }; apart[k].n += v.n; apart[k].worst = Math.max(apart[k].worst, v.worst); }
    check('K2', wheel <= 0.01 && sm === 0, `前后轮接地点与 I1 面最大差 ${f(wheel, 4)} m（≤ 0.01 m × s）；根节点逐步高差超过「位移 × 0.15 + 0.005 m」${sm} 步${Object.keys(apart).length ? '；另判 ' + Object.entries(apart).map(([k, v]) => `${k} ${v.n} 步、最大 ${f(v.worst, 3)} m`).join('，') : ''}`); }
  if (want('K3')) check('K3', res.every(r => r.layerBad.length === 0 && r.deckBad === 0), `换层 ${res.reduce((a, r) => a + r.layerChanges.length, 0)} 次，全部在连接处 3 m × s 内：${res.every(r => r.layerBad.length === 0)}；桥面范围内不在桥面层的步 ${res.reduce((a, r) => a + r.deckBad, 0)}`);
  if (want('K8')) { const seam = res.filter(r => r.wraps); check('K8', seam.length > 0 && seam.every(r => r.wraps >= 1 && (r.wrapHead ?? 0) < 0.05 && (r.wrapSpeed ?? 0) < 0.1 && (r.wrapCam ?? 0) < 0.5), seam.length ? seam.map(r => `${r.name} 跨接缝 ${r.wraps} 次、该步航向变化 ${f(r.wrapHead, 4)} rad、速度变化 ${f(r.wrapSpeed, 3)} m/s、镜头位移 ${f(r.wrapCam, 3)} m`).join('；') : '所选路线没有经过平面接缝（需 RT-05 或 RT-06b）'); }
}

// ---- K4: the collision probes
if (want('K4')) {
  const rows = await page.evaluate(({ probes }) => {
    const S = window.__scene, G = S.ground, RT = window.__RT, L = window.LAYOUT, dt = 1 / 60, out = [], CFG = S.ride.cfg;
    const lineEdge = (edge, s, side) => { const ln = RT.lineOf(edge), [s0, s1] = RT.range(ln, edge), st = s === 'mid' ? (s0 + s1) / 2 : s0 + s, w = ln.walk[Math.min(ln.n - 1, Math.max(0, Math.round(st / 0.5)))] || [-1, 1], o = side === 'left' ? w[0] : w[1], p = ln.point(st, o), c = ln.point(st, 0), nl = Math.hypot(p.x - c.x, p.z - c.z) || 1; return { p: [p.x, p.z], n: [(p.x - c.x) / nl, (p.z - c.z) / nl] }; };
    const geo = pr => {
      if (pr.id === 'RC-01') return { p: [-20, 18.5], n: [0, 1] };
      if (pr.id === 'RC-02') return { p: [-8.5, 18.5], n: [0, 1] };
      if (pr.id === 'RC-03') { const f = L.furniture.find(q => q.id === 'ALAMP-A01-3'); return { p: [f.x, f.z], n: [-1, 0], post: 0.045 }; }
      if (pr.id === 'RC-04') return { p: [-17, 26], n: [1, 0], narrow: true };
      if (pr.id === 'RC-05') { const ln = G.lines.find(l => l.id === 'CR01'), [a] = RT.range(ln, window.WORLD.roadNetwork.edges.find(e => (e.from === 'C01-S' && e.to === 'C01-SW') || (e.to === 'C01-S' && e.from === 'C01-SW')).id), st = a + 20, i = Math.round(st / 0.5), w = ln.walk[i], c = ln.point(st, 0), pl = ln.point(st, w[0]), pr2 = ln.point(st, w[1]), outer = Math.abs(pl.z) > Math.abs(pr2.z) ? pl : pr2, nl = Math.hypot(outer.x - c.x, outer.z - c.z); return { p: [outer.x, outer.z], n: [(outer.x - c.x) / nl, (outer.z - c.z) / nl] }; }
      if (pr.id === 'RC-06') return lineEdge('RN01-03', 'mid', 'left');
      if (pr.id === 'RC-07') return lineEdge('RN01-05', 18, 'left');
      if (pr.id === 'RC-08') return { ...lineEdge('RN11-01', 'mid', 'left'), narrow90: true };
      if (pr.id === 'RC-09') return { p: [-6.5, 11.5], n: [0, -1] };
      if (pr.id === 'RC-10') { const st = G.sites.find(q => q.id === 'LM02'), a = st.toFlat(-1.3, 14.0, 0.06), b = st.toFlat(-0.3, 14.0, 0.06), nl = Math.hypot(a.x - b.x, a.z - b.z); return { p: [a.x, a.z], n: [(a.x - b.x) / nl, (a.z - b.z) / nl] }; }
    };
    for (const pr of probes) {
      const g0 = geo(pr); if (!g0) continue; const q0 = G.at(g0.p[0] - g0.n[0] * 0.6, g0.p[1] - g0.n[1] * 0.6), s = q0 ? q0.s : 1;
      for (const ang of g0.narrow ? [90] : [90, 30]) {
        const tx = -g0.n[1], tz = g0.n[0], th = ang * Math.PI / 180, dir = ang === 90 ? g0.n : [tx * Math.cos(th) + g0.n[0] * Math.sin(th), tz * Math.cos(th) + g0.n[1] * Math.sin(th)];
        const back = g0.narrow || (g0.narrow90 && ang === 90) ? (CFG.half + CFG.radius + 0.12) * s : (CFG.half + CFG.radius + 1.6) * s, lat = g0.post && ang === 30 ? (CFG.radius + g0.post) * Math.sin(60 * Math.PI / 180) * s : 0;
        // a post: the glancing start offset to whichever side has the room
        let side = 1; if (g0.post && ang === 30) { const a = G.at(g0.p[0] - g0.n[0] * back + tx * lat, g0.p[1] - g0.n[1] * back + tz * lat); if (!a || !G.at(g0.p[0] + tx * (lat + CFG.radius * s), g0.p[1] + tz * (lat + CFG.radius * s))) side = -1; }
        const dirB = g0.post ? g0.n : dir, sx = g0.p[0] - dirB[0] * back + side * tx * lat, sz = g0.p[1] - dirB[1] * back + side * tz * lat, dirP = g0.post && ang === 30 ? g0.n : dir;
        const place = S.ride.set({ x: sx, z: sz, heading: Math.atan2(dirP[0], dirP[1]), y: q0 ? q0.y : undefined }); if (!place) { out.push({ id: pr.id, ang, start: 'off' }); continue; }
        const cap = S.ride.get().cap; S.ride.set({ x: sx, z: sz, heading: Math.atan2(dirP[0], dirP[1]), speed: cap, y: q0 ? q0.y : undefined });
        let g = S.ride.get(), pen = 0, v0 = g.speed, vAfter = null, contactT = null, crossed = false, passKind = null;
        for (let i = 0; i < 180; i++) { const before = g.speed; g = S.ride.step(dt, { throttle: 1, steer: 0 }); pen = Math.max(pen, g.pen); if (g.contact && contactT === null) { contactT = i; v0 = before; vAfter = g.speed; }
          const fx = Math.sin(g.heading), fz = Math.cos(g.heading), hl = (g.carry ? 0 : CFG.half) * g.s, front = [g.x + fx * hl - g0.p[0], g.z + fz * hl - g0.p[1]], sd = RT.wdx(front[0]) * g0.n[0] + front[1] * g0.n[1];
          if (sd > 0.05 * g.s) { crossed = true; passKind = g.kind; } }
        const r = { id: pr.id, what: pr.what, expect: pr.expect, ang, cap, pen: +pen.toFixed(4), v0: +v0.toFixed(2), vAfter: vAfter === null ? null : +vAfter.toFixed(2), contact: contactT !== null, crossed, passKind, end: [+g.x.toFixed(2), +g.z.toFixed(2)], speedEnd: +g.speed.toFixed(2), contactType: g.contact && g.contact.type };
        if (pr.expect === 'pass') r.ok = ang === 90 ? crossed && !!passKind : true;
        else r.ok = pen <= 0.02 && (!crossed || (g0.post && ang === 30)) && contactT !== null && (ang === 90 ? Math.abs(g.speed) < 0.05 || (vAfter !== null && vAfter < 0.05) : vAfter !== null && vAfter >= 0.5 * v0);
        out.push(r);
      }
      // a 0.12 s frame against a post
      if (g0.post) { const s2 = s, sx = g0.p[0] - g0.n[0] * (CFG.half + CFG.radius + 0.9) * s2, sz = g0.p[1] - g0.n[1] * (CFG.half + CFG.radius + 0.9) * s2; S.ride.set({ x: sx, z: sz, heading: Math.atan2(g0.n[0], g0.n[1]), speed: 3.5 });
        let g; for (let i = 0; i < 12; i++) g = S.ride.step(0.12, { throttle: 1, steer: 0 }); const sd = RT.wdx(g.x - g0.p[0]) * g0.n[0] + (g.z - g0.p[1]) * g0.n[1]; out.push({ id: pr.id, long: true, ok: sd < 0, sd: +sd.toFixed(3), pen: +g.pen.toFixed(4) }); }
    }
    return out;
  }, { probes: COLLISION_PROBES });
  report.probes = rows;
  check('K4', rows.length > 0 && rows.every(r => r.ok), `碰撞探针 ${rows.filter(r => r.ok).length}/${rows.length} 项通过，最大穿透 ${f(Math.max(...rows.map(r => r.pen || 0)), 4)} m（≤ 0.02 m × s）`,
    rows.map(r => r.long ? `${r.id} 0.12 s 长帧：停在立杆前（有符号距离 ${r.sd} m）${r.ok ? '' : ' ✗'}` : `${r.id} ${r.ang}° ${r.what}：期望 ${r.expect === 'pass' ? '通过' : '阻挡'}，入射 ${r.v0} m/s，接触后 ${f(r.vAfter, 2)} m/s，末速 ${r.speedEnd}，穿透 ${r.pen} m，${r.crossed ? '越过（' + r.passKind + '）' : '未越过'}${r.contactType ? '，接触 ' + r.contactType : ''}${r.ok ? '' : ' ✗'}`));
}

// ---- K7: the spawn probes
if (want('K7')) {
  const rows = await page.evaluate(({ probes }) => {
    const S = window.__scene, G = S.ground, RT = window.__RT, W = window.WORLD, out = [];
    const DRIVE = new Set(['carriageway', 'deck', 'boardwalk', 'snow', 'junction', 'alley']);
    for (const pr of probes) {
      let tgt;
      if (pr.target) tgt = pr.target; else if (pr.lonLat) tgt = RT.flat(pr.lonLat[0], pr.lonLat[1]); else if (pr.edge || pr.node) {
        const id = pr.edge || W.roadNetwork.edges.find(e => (e.from === pr.node[0] && e.to === pr.node[1]) || (e.to === pr.node[0] && e.from === pr.node[1])).id, ln = RT.lineOf(id), [s0, s1] = RT.range(ln, id);
        const st = pr.s === 'mid' ? (s0 + s1) / 2 : s0 + (pr.edge ? pr.s : pr.s); const p = ln.point(st, 0); tgt = [p.x, p.z]; }
      S.view.set({ mode: 'free' }); S.view.set({ target: [tgt[0], 1.2, tgt[1]], yaw: pr.yaw ?? 2.5, pitch: 0.5, dist: 34 }); window.__step(1);
      const cam = S.camera.position, dir = [S.view.get().target[0] - cam.x, S.view.get().target[2] - cam.z];
      S.view.set({ mode: 'roam' }); const v = S.view.get(), g = S.ride.get(), hint = document.getElementById('ride-hint');
      if (!v.roam) { out.push({ id: pr.id, ok: false, why: 'no spawn' }); continue; }
      const sp = v.roam.spawn, d = sp.distance / g.s, fx = Math.sin(sp.heading), fz = Math.cos(sp.heading), dl = Math.hypot(dir[0], dir[1]) || 1, dot = (fx * dir[0] + fz * dir[1]) / dl;
      const q = G.at(sp.x, sp.z, { y: g.y }), shown = hint && hint.style.display === 'block';
      const r = { id: pr.id, what: pr.what, at: [+sp.x.toFixed(2), +sp.z.toFixed(2)], heading: +sp.heading.toFixed(3), kind: g.kind, layer: g.layer, line: g.line, edge: g.edge, distance: +d.toFixed(2), dot: +dot.toFixed(2), offset: q && q.offset != null ? +q.offset.toFixed(2) : null, hint: shown, hintText: shown ? hint.textContent : '' };
      r.spawnKind = sp.kind; let ok = DRIVE.has(sp.kind) && g.layer !== 'tunnel' && (dot > -0.2) && (shown === d > 2);
      if (pr.id === 'RS-01') ok = ok && Math.abs(sp.x + 7) < 0.01 && Math.abs(sp.z - 16.75) < 0.01 && Math.abs(RT.wpi(sp.heading + Math.PI / 2)) < 0.01;
      if (pr.id === 'RS-02') ok = ok && g.kind === 'alley';
      if (pr.id === 'RS-06') ok = ok && g.layer === 'deck' && g.edge === 'RN01-03';
      if (pr.id === 'RS-07') ok = ok && g.layer === 'ground' && g.line === 'RN01-ridge';
      if (pr.id === 'RS-08') ok = ok && g.kind !== 'stairs';
      if (pr.id === 'RS-10') ok = ok && g.kind === 'snow';
      if (pr.id === 'RS-12') ok = ok && g.layer === 'deck' && g.edge === 'RN01-13' && sp.x >= S.transition.xMin && sp.x < S.transition.xMax;
      r.ok = ok; out.push(r); S.view.set({ mode: 'free' });
    }
    return out;
  }, { probes: SPAWN_PROBES });
  report.spawns = rows;
  check('K7', rows.length === SPAWN_PROBES.length && rows.every(r => r.ok), `出生探针 ${rows.filter(r => r.ok).length}/${rows.length}`, rows.map(r => `${r.id} ${r.what}：出生面 ${r.spawnKind}（骑手 ${r.kind}）/${r.layer} ${r.edge || r.line} (${r.at})，朝向 ${r.heading}（视线点积 ${r.dot}），横向 ${f(r.offset, 2)} m，距目标 ${r.distance} m，提示 ${r.hint ? '「' + r.hintText + '」' : '无'}${r.ok ? '' : ' ✗'}`));
}

// ---- K11: the W9a town corridors and the 20 random pieces outside the town
if (want('K11')) {
  const node = id => L.roadNodes.find(n => n.id === id), town = [];
  for (const r of L.roads) for (let i = 0; i + 1 < r.nodes.length; i++) { const a = node(r.nodes[i]), b = node(r.nodes[i + 1]); town.push({ name: `W9a ${r.id} ${r.nodes[i]}–${r.nodes[i + 1]}`, P: [[a.x, a.z], [b.x, b.z]] }); }
  for (const a of L.alleys) { const zc = (a.rect[1] + a.rect[3]) / 2; town.push({ name: `W9a ${a.id}`, P: [[a.rect[0] + 1.2, zc], [a.rect[2] - 1.2, zc]] }); }
  const pieces = random20(W);
  const res = await page.evaluate(({ town, pieces, LANE }) => {
    const S = window.__scene, RT = window.__RT, W = window.WORLD, out = { town: [], random: [] };
    const run = (name, P) => { const Lc = [0]; for (let i = 1; i < P.length; i++) Lc.push(Lc[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return RT.drive(name, P, Lc, []); };
    for (const t of town) { const P = []; const n = Math.max(2, Math.ceil(Math.hypot(t.P[1][0] - t.P[0][0], t.P[1][1] - t.P[0][1]) / 0.5)); for (let k = 0; k <= n; k++) P.push([t.P[0][0] + (t.P[1][0] - t.P[0][0]) * k / n, t.P[0][1] + (t.P[1][1] - t.P[0][1]) * k / n]); out.town.push(run(t.name, P)); }
    for (const pc of pieces) { const e = W.roadNetwork.edges.find(q => q.id === pc.edge), ln = RT.lineOf(e.id), [s0, s1] = RT.range(ln, e.id), lane = LANE[e.class] ?? 0, P = [];
      const pf = RT.nodeXZ(e.from), A = ln.point(s0, 0), B = ln.point(s1, 0), fwd = Math.hypot(RT.wdx(A.x - pf[0]), A.z - pf[1]) <= Math.hypot(RT.wdx(B.x - pf[0]), B.z - pf[1]);
      const a = fwd ? s0 + pc.s0 : s1 - pc.s0, b = fwd ? s0 + pc.s1 : s1 - pc.s1, n = Math.max(2, Math.ceil(Math.abs(b - a) / 0.5)); for (let k = 0; k <= n; k++) { const q = ln.point(a + (b - a) * k / n, fwd ? -lane : lane); const pv = P[P.length - 1]; P.push([pv ? pv[0] + RT.wdx(q.x - pv[0]) : q.x, q.z]); }
      out.random.push(run(`${pc.edge} ${pc.s0}–${pc.s1}`, P)); }
    return out;
  }, { town, pieces, LANE });
  const line = r => `${r.name} ${r.reached ? '到达' : `未到（${f(r.u, 1)}/${f(r.total, 1)} m${r.stuckAt ? ' 卡在 ' + JSON.stringify(r.stuckAt) : ''}）`} ${f(r.length, 1)} m、${f(r.t, 1)} s、离面 ${r.off}、偏离 ${f(r.dev, 2)} m、s ${f(r.s[0], 2)}–${f(r.s[1], 2)}、${Object.keys(r.kinds).join('/')}`;
  for (const r of [...res.town, ...res.random]) console.log('  · ' + line(r));
  const routeTown = report.routes.filter(r => /^RT-0[123]/.test(r.name));
  check('K11', res.town.every(r => r.reached && r.off === 0) && res.random.length === 20 && res.random.every(r => r.reached && r.off === 0) && routeTown.every(r => r.reached),
    `W9a 城镇走廊 ${res.town.filter(r => r.reached).length}/${res.town.length}、城外随机 20 段 ${res.random.filter(r => r.reached).length}/20 走通（种子 20261018）；RT-01/02/03 城内段见 K1（${routeTown.filter(r => r.reached).length}/${routeTown.length}）`);
  report.k11 = res;
}
// ---- K9 (R2): the rider: height, both wheels on the ground, wheel rate, lean and bars with the turn, pitch with the slope, one foot down when stopped
if (want('K9')) {
  const r = await page.evaluate(() => {
    const S = window.__scene, G = S.ground, dt = 1 / 60, out = {};
    if (S.view.get().mode !== 'roam') { S.view.set({ mode: 'free', mapMode: 'flat' }); S.view.set({ mode: 'roam' }); }
    const R = () => S.ride.rider(), g = () => S.ride.get();
    // straight at speed on R01: the wheel rate, the height, the wheels on the ground
    S.ride.set({ x: -7, z: 16.75, heading: -Math.PI / 2, speed: 3.0 }); for (let i = 0; i < 30; i++) S.ride.step(dt, { throttle: 0.72, steer: 0 });
    const w0 = R().wheel; let vsum = 0; for (let i = 0; i < 60; i++) { S.ride.step(dt, { throttle: 0.72, steer: 0 }); vsum += g().speed * dt; } const w1 = R().wheel;
    out.wheelRate = (w1 - w0) / (vsum / 0.3);
    const a = R(), b = g(); out.height = a.height; out.wheelGap = Math.max(Math.abs(a.wheelBottoms[1] - (b.wheels[0] - b.root) / b.s), Math.abs(a.wheelBottoms[0] - (b.wheels[1] - b.root) / b.s));
    out.drawCalls = a.drawCalls; out.triangles = a.triangles;
    // a left turn in X01 at 2 m/s: lean, bars and the turn have one sign (left: w > 0, the lean negative about the forward axis, the bars positive)
    S.ride.set({ x: 2, z: 15, heading: -Math.PI / 2, speed: 2.0 }); for (let i = 0; i < 45; i++) S.ride.step(dt, { throttle: 0.48, steer: -0.6 });
    const t = R(); out.turn = { omega: t.omega, lean: t.lean, steer: t.steer, ok: t.omega > 0.05 && -t.lean > 0.01 && t.steer > 0.01 };
    S.ride.set({ x: 2, z: 15, heading: -Math.PI / 2, speed: 2.0 }); for (let i = 0; i < 45; i++) S.ride.step(dt, { throttle: 0.48, steer: 0.6 });
    const u = R(); out.turnR = { omega: u.omega, lean: u.lean, steer: u.steer, ok: u.omega < -0.05 && -u.lean < -0.01 && u.steer < -0.01 };
    // the pitch on RN01-06 (5.3 %): the slope between the two wheel contacts and the road's own slope
    const ln = G.lines.find(l => l.id === 'RN01-ridge'), e6 = window.__RT.range(ln, 'RN01-06'), st = (e6[0] + e6[1]) / 2, p0 = ln.point(st, -1.75), p1 = ln.point(st + 0.5, -1.75);
    S.ride.set({ x: p0.x, z: p0.z, heading: Math.atan2(p1.x - p0.x, p1.z - p0.z), speed: 3 }); for (let i = 0; i < 20; i++) S.ride.step(dt, { throttle: 0.7, steer: 0 });
    const c = R(), d = g(), q = G.at(d.x, d.z, { y: d.y }); out.pitch = { rider: c.pitch, contacts: Math.atan2(d.wheels[0] - d.wheels[1], 0.94 * d.s), road: Math.atan(q.slope * Math.cos(d.heading - q.heading)), grade: q.slope };
    // stopped: one foot down
    S.ride.set({ x: -7, z: 16.75, heading: -Math.PI / 2, speed: 2 }); for (let i = 0; i < 90; i++) S.ride.step(dt, { throttle: i < 40 ? -1 : 0, steer: 0 }); for (let i = 0; i < 60; i++) S.ride.step(dt, { throttle: 0, steer: 0 });
    const e = R(); out.stop = { footDown: e.footDown, footY: e.footY, speed: g().speed };
    // pushing on a stair: walking beside the bike
    const sl = G.lines.find(l => l.id === 'RN08-02'), sp = sl.point(20, 0), sq = sl.point(20.5, 0); S.ride.set({ x: sp.x, z: sp.z, heading: Math.atan2(sq.x - sp.x, sq.z - sp.z) }); for (let i = 0; i < 60; i++) S.ride.step(dt, { throttle: 1, steer: 0 });
    out.push = { mode: g().mode, riderMode: R().mode, pushK: R().pushK };
    return out;
  });
  const ok = r.height <= 1.75 && r.wheelGap <= 0.01 && Math.abs(r.wheelRate - 1) <= 0.01 && r.turn.ok && r.turnR.ok && Math.abs(r.pitch.rider - r.pitch.contacts) <= 0.01 && Math.abs(r.pitch.rider - r.pitch.road) <= 0.01 && r.stop.footDown && r.stop.footY !== null && Math.abs(r.stop.footY) <= 0.03;
  check('K9', ok, `主体总高 ${f(r.height, 3)} m（≤ 1.75 m × s）；两轮离地差 ${f(r.wheelGap, 4)} m；轮角速度 / (v / 0.3) = ${f(r.wheelRate, 4)}（±1%）；左转 ω ${f(r.turn.omega, 3)}、倾角 ${f(r.turn.lean, 3)}、把手角 ${f(r.turn.steer, 3)}，右转 ω ${f(r.turnR.omega, 3)}、倾角 ${f(r.turnR.lean, 3)}、把手角 ${f(r.turnR.steer, 3)}（同号：${r.turn.ok && r.turnR.ok}）；RN01-06 俯仰 ${f(r.pitch.rider, 4)} rad、轮接地点坡度 ${f(r.pitch.contacts, 4)}、路面坡度 ${f(r.pitch.road, 4)}（±0.01）；停住单脚落地 ${r.stop.footDown}，脚底离地 ${f(r.stop.footY, 3)} m；石阶推车 ${r.push.mode}/${r.push.riderMode}；绘制调用 ${r.drawCalls}、三角形 ${r.triangles}`);
  report.k9 = r;
}

// ---- K5 (R2): the camera on ridden routes: never inside an occluder, 0.12 m over the surface, the horizontal limit, the sight line, the narrow places and the tunnel;
// and, independent of the occluder boxes, rays from the focus to the camera against the rendered scene every 15 steps
if (want('K5')) {
  const names = opt('--k5routes') === 'all' ? ROUTES.map(r => r.id) : (opt('--k5routes') || 'RT-01,RT-02,RT-05,RT-06a').split(',');
  const rows = [];
  for (const id of names) {
    const rt = ROUTES.find(q => q.id === id);
    const r = await page.evaluate(({ rt }) => {
      const S = window.__scene, G = S.ground, T = window.THREE, W = S.ride.world(), CFG = S.ride.cfg, dt = 1 / 60;
      const { P, Lc, ev } = window.__RT.routePath(rt);
      const out = { name: rt.id, steps: 0, inside: 0, low: 0, horiz: 0, blocked: 0, blockRun: 0, maxRun: 0, narrow: 0, narrowMin: Infinity, tunnel: 0, rays: 0, rayHits: 0, clamped: {}, pulled: 0 };
      const meshes = []; S.scene.traverse(o => { if (o.isMesh && o.visible && !o.isInstancedMesh && o.material && !o.material.transparent && o.material.blending !== T.AdditiveBlending) { let rider = false; for (let p = o; p; p = p.parent) if (/^ride:/.test(p.name || '')) rider = true; if (!rider) meshes.push(o); } });
      const ray = new T.Raycaster(), A = new T.Vector3(), B = new T.Vector3();
      const boxDist = (Pp, x, z) => { let inside = true, d = Infinity; for (let i = 0, n = Pp.length; i < n; i++) { const a = Pp[i], b = Pp[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez || 1e-12, t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / l2)); d = Math.min(d, Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t)); if ((x - a[0]) * ez - (z - a[1]) * ex > 0) inside = false; } return inside ? 0 : d; };
      const hook = () => {
        const g = S.ride.get(), c = S.ride.camera(), s = g.s, p = c.position, f = c.focus; out.steps++;
        if (c.pulled) { out.pulled++; if (c.why) { out.why = out.why || {}; out.why[c.why] = (out.why[c.why] || 0) + 1; } } for (const k of (c.clamped || '').trim().split(' ').filter(Boolean)) out.clamped[k] = (out.clamped[k] || 0) + 1;
        const boxes = W.occluders(p[0] - 0.3, p[2] - 0.3, p[0] + 0.3, p[2] + 0.3); if (boxes.some(o => p[1] > o.y0 - 0.15 * s && p[1] < o.y1 + 0.15 * s && boxDist(o.pts, p[0], p[2]) < 0.15 * s - 1e-6)) out.inside++;
        const q0 = G.at(p[0], p[2], { y: g.y }), q = q0 && Math.abs(q0.y - g.y) < 3 * s ? q0 : null, floor = q ? q.y : G.y(p[0], p[2]); if (p[1] < floor + 0.12 * s - 1e-6) out.low++;
        const allowed = g.layer === 'deck' || g.layer === 'tunnel' || g.kind === 'boardwalk' ? 0 : 0.5 * s;
        if (!q) { const dx = f[0] - p[0], dz = f[2] - p[2], l = Math.hypot(dx, dz) || 1, q2 = allowed > 0 ? G.at(p[0] + dx / l * (allowed + 0.02 * s), p[2] + dz / l * (allowed + 0.02 * s), { y: g.y }) : null; if (allowed <= 0 || !q2 || Math.abs(q2.y - g.y) >= 3 * s) out.horiz++; }
        if (c.blocked) { out.blocked++; out.blockRun++; out.maxRun = Math.max(out.maxRun, out.blockRun); } else out.blockRun = 0;
        if (g.kind === 'alley' || g.kind === 'walkway') { const d = Math.hypot(p[0] - f[0], p[1] - f[1], p[2] - f[2]) / s; out.narrowMin = Math.min(out.narrowMin, d); if (d < 1.2 - 1e-6) out.narrow++; }
        if (g.layer === 'tunnel' && q && q.layer === 'tunnel') { const o = Math.abs(q.offset || 0), h = (p[1] - q.y) / s; if (o > CFG.tunnel.r - CFG.tunnelClear + 1e-6 || h > CFG.tunnel.wall + Math.sqrt(Math.max(0, (CFG.tunnel.r - CFG.tunnelClear) ** 2 - o * o)) + 1e-6) out.tunnel++; }
        if (out.steps % 15 === 0) { A.set(f[0], f[1], f[2]); B.set(p[0], p[1], p[2]); const d = B.clone().sub(A), len = d.length(); if (len > 0.05) { ray.set(A, d.normalize()); ray.far = len; ray.near = 0.05; out.rays++; const near = meshes.filter(m => { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); const bs = m.geometry.boundingSphere, c2 = bs.center.clone().applyMatrix4(m.matrixWorld); return c2.distanceTo(A) < bs.radius * Math.max(m.scale.x, m.scale.y, m.scale.z, 1) + len + 1; }); const hh = ray.intersectObjects(near.filter(m => { for (let q = m; q; q = q.parent) if (!q.visible) return false; return true; }), false); // the terrain met inside the RN01-05 bore is counted as well (no allowance: the terrain is cut out of the tunnel's volume)
              const tunnelTerrain = hh.length && g.layer === 'tunnel' && /^terrain/.test(((x => { let t = x; while (t.parent && t.parent !== S.scene) t = t.parent; return t.name || x.name; })(hh[0].object)) || '');
              if (tunnelTerrain) out.tunnelTerrain = (out.tunnelTerrain || 0) + 1;
              if (hh.length) { out.rayHits++; let top = hh[0].object; while (top.parent && top.parent !== S.scene) top = top.parent; const qf = G.at(f[0], f[2], { y: g.y }), qp = G.at(p[0], p[2], { y: g.y }), key = (hh[0].object.name || top.name || '?') + ' @' + hh[0].distance.toFixed(2) + '/' + len.toFixed(2) + ' focus s ' + (qf && qf.station != null ? qf.station.toFixed(1) : '-') + ' ' + (qf && qf.layer) + ' cam s ' + (qp && qp.station != null ? qp.station.toFixed(1) : '-') + ' o ' + (qp && qp.offset != null ? qp.offset.toFixed(2) : '-') + ' h ' + (qp ? ((p[1] - qp.y) / s).toFixed(2) : '-') + ' ' + (qp && qp.layer); out.rayWhat = out.rayWhat || []; if (out.rayWhat.length < 8) out.rayWhat.push(key + ' ' + g.kind + ' ' + g.line); } } }
      };
      S.scene.updateMatrixWorld(true); S.ride.api().state.debugCam = true;
      const orig = S.ride.step; S.ride.step = (dt2, input) => { const res = orig(dt2, input); hook(); return res; };
      const drv = window.__RT.drive(rt.id, P, Lc, ev); S.ride.step = orig; S.ride.api().state.debugCam = false;
      return { ...out, reached: drv.reached, narrowMin: out.narrowMin === Infinity ? null : +out.narrowMin.toFixed(3) };
    }, { rt });
    rows.push(r);
  }
  const ok = rows.every(r => r.reached && r.inside === 0 && r.low === 0 && r.horiz === 0 && r.blocked <= 0.01 * r.steps && r.maxRun <= 12 && r.narrow === 0 && r.tunnel === 0 && !r.tunnelTerrain && r.rayHits <= Math.max(0, Math.floor(0.01 * r.rays)));
  check('K5', ok, `镜头：${rows.map(r => r.name).join('、')} 共 ${rows.reduce((a, r) => a + r.steps, 0)} 步`, rows.map(r => `${r.name}${r.reached ? '' : '（未走通）'} ${r.steps} 步：在遮挡体内 ${r.inside}、离面 < 0.12 m ${r.low}、超出水平约束 ${r.horiz}、视线被挡 ${r.blocked} 步（最长连续 ${r.maxRun} 步）、窄处 < 1.2 m ${r.narrow}（最近 ${r.narrowMin ?? '—'} m）、隧道越限 ${r.tunnel}、收近 ${r.pulled} 步、约束 ${JSON.stringify(r.clamped)}；渲染网格射线 ${r.rays} 条命中 ${r.rayHits}${r.tunnelTerrain ? `（其中 ${r.tunnelTerrain} 条命中隧道内的地形面，不允许）` : ''}${r.rayWhat ? ' ' + JSON.stringify(r.rayWhat) : ''}${r.why ? '；收近原因 ' + JSON.stringify(r.why) : ''}`));
  report.k5 = rows;
}
await page.close();

// ---------------------------------------------------------------- K6: real input events (live frames)
if (want('K6')) {
  const rows = [], add = (name, ok, detail = '') => rows.push([name, ok, detail]);
  const p = await open();
  const get = () => p.evaluate(() => ({ v: window.__scene.view.get(), r: window.__scene.ride.get(), input: window.__scene.ride.input(), btn: { disabled: document.getElementById('town-view-toggle').disabled, text: document.getElementById('town-view-toggle').textContent } }));
  const until = async (fn, ms, arg) => { try { await p.waitForFunction(fn, arg, { timeout: ms, polling: 16 }); return true; } catch { return false; } };
  await p.evaluate(() => window.__scene.view.set({ mode: 'free', target: [-7, 1.2, 20], yaw: 2.5, pitch: 0.5, dist: 34 })); await p.waitForTimeout(300);
  const free0 = (await get()).v;
  await p.keyboard.press('v'); await p.waitForTimeout(200); let s = await get();
  add('V 键进入骑行（按钮文字「自由视角  V」）', s.v.mode === 'roam' && s.btn.text.includes('自由视角'));
  await p.keyboard.down('w'); await p.waitForTimeout(4000); s = await get();
  add(`按 W 4 s 后速度 4.2 ± 0.1 m/s（${f(s.r.speed, 2)}）`, Math.abs(s.r.speed - 4.2) <= 0.1);
  await p.keyboard.up('w'); await p.waitForTimeout(1000); const coast = (await get()).r.speed;
  add(`松开后滑行减速（1 s 后 ${f(coast, 2)} m/s）`, coast > 2.5 && coast < 4.15);
  await p.keyboard.down('s'); const t0 = Date.now(); const stopped = await until(() => window.__scene.ride.get().speed <= 0.001, 2500); const tStop = (Date.now() - t0) / 1000;
  await p.waitForTimeout(1500); const rev = (await get()).r.speed; await p.keyboard.up('s');
  add(`按 S ${f(tStop, 2)} s 停住（≤ 1.6），继续按倒推 ${f(rev, 2)} m/s（≥ −0.8）`, stopped && tStop <= 1.6 && rev < -0.05 && rev >= -0.8 - 1e-6);
  await until(() => Math.abs(window.__scene.ride.get().speed) < 0.01, 3000);
  // steering sign while moving
  await p.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2, speed: 2.0 }));
  await p.keyboard.down('w'); await p.waitForTimeout(150); let h0 = (await get()).r.heading; await p.keyboard.down('a'); await p.waitForTimeout(450); await p.keyboard.up('a'); let h1 = (await get()).r.heading;
  await p.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2, speed: 2.0 })); await p.waitForTimeout(150); let h2 = (await get()).r.heading; await p.keyboard.down('d'); await p.waitForTimeout(450); await p.keyboard.up('d'); let h3 = (await get()).r.heading; await p.keyboard.up('w');
  add(`A 左转、D 右转（以骑手坐标：左转航向增大）（${f(h1 - h0, 3)} / ${f(h3 - h2, 3)} rad）`, h1 - h0 > 0.05 && h3 - h2 < -0.05);
  await until(() => Math.abs(window.__scene.ride.get().speed) < 0.01, 4000);
  await p.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2 })); await p.waitForTimeout(100); h0 = (await get()).r.heading; await p.keyboard.down('d'); await p.waitForTimeout(500); await p.keyboard.up('d'); s = await get();
  add(`停住时 D 原地扶车转向（航向 ${f(s.r.heading - h0, 3)} rad，速度 ${f(s.r.speed, 3)}）`, s.r.heading - h0 < -0.2 && Math.abs(s.r.speed) < 0.05);
  // look
  await p.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2 })); await p.waitForTimeout(100); let a = (await get()).r;
  await p.mouse.move(640, 400); await p.mouse.down(); await p.mouse.move(1000, 400, { steps: 8 }); await p.mouse.up(); let b = (await get()).r; await p.waitForTimeout(3000); let c2 = (await get()).r;
  add(`拖动只改环视：向右拖 360 px 环视 ${f(b.lookYaw - a.lookYaw, 2)} rad（> 90°、抓取式为正），航向变化 ${f(Math.abs(b.heading - a.heading), 5)}，松手 3 s 后 ${f(c2.lookYaw, 2)}（不回正）`, b.lookYaw - a.lookYaw > Math.PI / 2 && Math.abs(b.heading - a.heading) < 1e-3 && Math.abs(c2.lookYaw - b.lookYaw) < 1e-6);
  await p.keyboard.press('c'); await p.waitForTimeout(600); const rc = (await get()).r.lookYaw;
  await p.mouse.move(640, 400); await p.mouse.down(); await p.mouse.move(800, 380, { steps: 4 }); await p.mouse.up(); await p.mouse.dblclick(640, 400); await p.waitForTimeout(600); const rd = (await get()).r.lookYaw;
  add(`C 与双击回正（${f(rc, 4)} / ${f(rd, 4)}）`, Math.abs(rc) < 1e-3 && Math.abs(rd) < 1e-3);
  await p.mouse.move(640, 400); await p.mouse.wheel(0, 4000); await p.waitForTimeout(150); const dMax = (await get()).r.dist; await p.mouse.wheel(0, -8000); await p.waitForTimeout(150); const dMin = (await get()).r.dist;
  add(`滚轮跟随距离在 [2.5, 6]（${f(dMax, 2)} / ${f(dMin, 2)}）`, Math.abs(dMax - 6) < 1e-9 && Math.abs(dMin - 2.5) < 1e-9);
  // blur
  await p.keyboard.down('w'); await p.waitForTimeout(200); await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.waitForTimeout(100); s = await get(); await p.keyboard.up('w');
  add(`失焦清空输入（油门 ${s.input.throttle}、转向 ${s.input.steer}）`, s.input.throttle === 0 && s.input.steer === 0);
  // leave three ways
  const same = (x, y) => x.mode === 'free' && x.yaw === y.yaw && x.pitch === y.pitch && x.dist === y.dist && x.target.every((q, i) => q === y.target[i]);
  await p.keyboard.press('v'); await p.waitForTimeout(150); const outV = (await get()).v;
  await p.keyboard.press('v'); await p.waitForTimeout(150); await p.keyboard.press('Escape'); await p.waitForTimeout(150); const outE = (await get()).v;
  await p.keyboard.press('v'); await p.waitForTimeout(150); await p.click('#town-view-toggle'); await p.waitForTimeout(150); const outB = (await get()).v;
  add('V、Esc、按钮退出后自由视角 target/yaw/pitch/dist 逐位恢复', same(outV, free0) && same(outE, free0) && same(outB, free0));
  await p.keyboard.press('v'); await p.waitForTimeout(150); await p.click('#map-mode-toggle'); await p.waitForTimeout(100); s = await get();
  const disAnim = s.btn.disabled; await p.waitForTimeout(2600); s = await get(); await p.keyboard.press('v'); await p.waitForTimeout(150); const sv = await get();
  add(`切球形自动退出；切换中与球形按钮禁用（${disAnim} / ${sv.btn.disabled}），球形按 V 不进入`, s.v.mode === 'free' && s.v.mapMode === 'sphere' && disAnim && sv.btn.disabled && sv.v.mode === 'free');
  await p.click('#map-mode-toggle'); await p.waitForTimeout(2600);
  // keyboard and stick give the same input: keys here, the stick on the touch page below
  await p.keyboard.down('w'); await p.keyboard.down('d'); await p.keyboard.press('v'); await p.waitForTimeout(100); const kin = (await get()).input; await p.keyboard.up('w'); await p.keyboard.up('d'); await p.keyboard.press('v');
  await p.close();
  const tp = await open({ touch: true });
  const tget = () => tp.evaluate(() => ({ v: window.__scene.view.get(), r: window.__scene.ride.get(), input: window.__scene.ride.input() }));
  const tb = await tp.locator('#town-view-toggle').boundingBox(); await tp.touchscreen.tap(tb.x + tb.width / 2, tb.y + tb.height / 2); await tp.waitForTimeout(200); let ts = await tget();
  add('触屏按钮进入骑行', ts.v.mode === 'roam');
  const sb = await tp.locator('#town-walk-stick').boundingBox(); add('触屏摇杆可见', !!sb);
  const cdp = await tp.context().newCDPSession(tp), touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ id: q.id ?? i + 1, x: q.x, y: q.y, radiusX: 6, radiusY: 6, force: 1 })) });
  if (sb) {
    const cx = sb.x + sb.width / 2, cy = sb.y + sb.height / 2;
    await touch('touchStart', [{ x: cx, y: cy }]); await touch('touchMove', [{ x: cx + 40, y: cy - 40 }]); await tp.waitForTimeout(120); const sin = (await tget()).input; await touch('touchEnd', []);
    add(`摇杆推满与键盘同输入：键盘 W+D (${kin.throttle}, ${kin.steer})，摇杆右上推满 (${f(sin.throttle, 3)}, ${f(sin.steer, 3)})（死区 0.12 后线性；斜推满为 0.707 → ${f((0.7071 - 0.12) / 0.88, 3)}）`, kin.throttle === 1 && kin.steer === 1 && Math.abs(sin.throttle - (0.7071 - 0.12) / 0.88) < 0.02 && Math.abs(sin.steer - (0.7071 - 0.12) / 0.88) < 0.02);
    await tp.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2 })); await touch('touchStart', [{ x: cx, y: cy }]); await touch('touchMove', [{ x: cx, y: cy - 45 }]); await tp.waitForTimeout(2000); const sv2 = (await tget()).r; await touch('touchEnd', []);
    // the same 2 s with the keyboard on a desktop page would give v = 1.5 x 2 = 3.0 m/s; the stick straight up is throttle 1
    add(`摇杆向上推满 2 s 速度 ${f(sv2.speed, 2)} m/s（键盘同输入为 1.5 m/s² × 2 s = 3.0，差 ≤ 5%）`, Math.abs(sv2.speed - 3.0) / 3.0 <= 0.05);
    await tp.waitForTimeout(100);
  }
  await tp.evaluate(() => window.__scene.ride.set({ x: -10, z: 16.75, heading: -Math.PI / 2 })); ts = await tget();
  const ly0 = ts.r.lookYaw, hh0 = ts.r.heading; await touch('touchStart', [{ x: 250, y: 400 }]); for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: 250 + i * 15, y: 400 }]); await touch('touchEnd', []); ts = await tget();
  add(`摇杆以外单指拖动环视（${f(ts.r.lookYaw - ly0, 3)} rad，航向不变 ${f(Math.abs(ts.r.heading - hh0), 5)}）`, ts.r.lookYaw - ly0 > 0.2 && Math.abs(ts.r.heading - hh0) < 1e-3);
  const d0 = ts.r.dist; await touch('touchStart', [{ id: 1, x: 180, y: 400 }, { id: 2, x: 220, y: 400 }]); for (let i = 1; i <= 6; i++) await touch('touchMove', [{ id: 1, x: 180 - i * 12, y: 400 }, { id: 2, x: 220 + i * 12, y: 400 }]); await touch('touchEnd', []); ts = await tget();
  add(`双指捏合调跟随距离（${f(d0, 2)} → ${f(ts.r.dist, 2)}）`, ts.r.dist < d0 - 0.2 && ts.r.dist >= 2.5);
  await touch('touchStart', [{ x: 250, y: 500 }]); await touch('touchEnd', []); await tp.waitForTimeout(80); await touch('touchStart', [{ x: 252, y: 501 }]); await touch('touchEnd', []); await tp.waitForTimeout(600); ts = await tget();
  add(`双击画面回正（${f(ts.r.lookYaw, 4)}）`, Math.abs(ts.r.lookYaw) < 1e-3);
  await tp.close();
  report.inputs = rows;
  check('K6', rows.every(r => r[1]), `输入 ${rows.filter(r => r[1]).length}/${rows.length}`, rows.map(r => `${r[1] ? 'PASS' : 'FAIL'} ${r[0]}`));
}
await browser.close();
check('errors', !errors.length, errors.length ? errors.slice(0, 5).join(' | ') : '无页面错误');
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(report, null, 1));
const bad = results.filter(r => !r[1]);
console.log(`${bad.length ? 'FAIL' : 'PASS'} ride_check${ONLY ? ' --only ' + ONLY.join(',') : ''} (${results.length - bad.length}/${results.length})`);
process.exitCode = bad.length ? 1 : 0;
