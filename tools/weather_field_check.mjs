// WX1 checks of the weather field (weather.js): pure Node, no page, no build (docs/world/WEATHER_COMPLETION_PLAN.md section 4).
//   node tools/weather_field_check.mjs [--before <git ref>] [--report [path]] [--circles N]
//   F1  determinism: the same (lon, lat, t) gives the same weights (|diff| <= 1e-12) whatever was queried before: the recorded counterexample, pairs in one
//       0.05-degree cell (the W8b cache key) warmed in either order, pairs straddling category edges, forward / reverse / shuffled / repeated orders, after a
//       cache clear, longitude +-360; the cache stays bounded
//   F2  place rules and shares: 100 places per category; weights finite, >= 0, sum 1; ice never rain, town and other non-mountain places never snow, fog only
//       in foggy places; desert rain <= 5 %; where rain is allowed rain (mountains: rain + snow) is the largest share and >= 50 %, over a full pattern cycle
//       and over the first 6 hours; every lock falls back to an allowed state
//   F3  time: 1 s steps over 6 hours at 14 places, change <= 1/40 per second across every slot start and end (W8_SPEC 4.3); fadeLeft ends on the target;
//       the town grid has one weather at every time
//   F4  space: 0.5 m steps along 60 great circles and across phase contours, the town edge, the coast and river fog limits, the snow line and the longitude
//       seams (180 and the flat-map seam -85), at 6 times: change <= 0.1 per step (plan section 4). Two kinds of step are judged apart: the hard region edges
//       of world.js (ice, desert, forest / lava / building-zone fog edges, the 18 / 20 m snow line switch 30 m round ameni-dake as in terrain.js), counted and
//       listed with examples, both sides still obeying F2's rules; and the height bands kept at the W8b thresholds (sleet +-0.8 m round the snow line, the fog
//       share over the last metre below the mountains): change <= 0.1 + 1.5 per metre of height crossed (the steepest of those bands), with the change per
//       0.5 m of ground reported
//   F5  API: sample / at / effectsAt / lock / locked / clearCache; effect weights; no camera, THREE, DOM or SECTION in weather.js
// --before <ref> runs the same measurements on weather.js of that commit (git show) for the report; pass / fail is for the working-tree weather.js only.
// --report writes docs/world/weather/wx1/report.json (or the given path); --circles sets the number of great circles in F4 (60).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), require = createRequire(import.meta.url);
const argOf = (k, dflt) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; return v && !v.startsWith('--') ? v : dflt; };
global.LAYOUT = require(path.join(root, 'layout.js'));
const W = require(path.join(root, 'world.js'));
const load = src => { const m = { exports: {} }; vm.runInNewContext(src, { module: m }, { filename: 'weather.js' }); return m.exports; };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const srcNow = fs.readFileSync(path.join(root, 'weather.js'), 'utf8'), NOW = load(srcNow);
const beforeRef = argOf('--before', null), srcBefore = beforeRef ? execFileSync('git', ['show', `${beforeRef}:weather.js`], { cwd: root, encoding: 'utf8' }) : null;
const BEFORE = srcBefore ? load(srcBefore) : null;

const STATES = ['rain', 'after', 'overcast', 'clear', 'snow', 'fog'], D = Math.PI / 180, R = 90, EPS = 1e-12, STEP = 0.5, TIMES = [450, 924, 2000, 3624, 9010, 15000], CIRCLES = +argOf('--circles', 60) || 60;
const results = [], fails = [], out = (ok, name, lines) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); for (const l of lines) console.log('  · ' + l); if (!ok) fails.push(name); };
const f = (x, n = 2) => (+x).toFixed(n), pc = x => f(x * 100, 1) + '%', e = x => (+x).toExponential(1);
const rng = seed => { let s = seed; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const wrap = lon => { if (lon <= 180 && lon > -180) return lon; const l = ((lon + 180) % 360 + 360) % 360 - 180; return l === -180 ? 180 : l; };
const dest = (lon, lat, brg, h) => { const a = h / R, p = lat * D, b = brg * D, sp = Math.max(-1, Math.min(1, Math.sin(p) * Math.cos(a) + Math.cos(p) * Math.sin(a) * Math.cos(b))); return [wrap(lon + Math.atan2(Math.sin(b) * Math.sin(a) * Math.cos(p), Math.cos(a) - Math.sin(p) * sp) / D), Math.asin(sp) / D]; };
const bearingUp = (fn, lon, lat, h = 0.5) => { const E1 = dest(lon, lat, 90, h), E0 = dest(lon, lat, 270, h), N1 = dest(lon, lat, 0, h), N0 = dest(lon, lat, 180, h); return Math.atan2(fn(...E1) - fn(...E0), fn(...N1) - fn(...N0)) / D; };
const diff = (a, b) => { let d = 0; for (const s of STATES) d = Math.max(d, Math.abs(a[s] - b[s])); return d; };
const sumOf = w => STATES.reduce((s, k) => s + w[k], 0);
const valid = w => STATES.every(s => Number.isFinite(w[s]) && w[s] >= 0) && Math.abs(sumOf(w) - 1) <= EPS;
const randomPlace = r => [-180 + r() * 360, Math.asin(-1 + 2 * r()) / D];          // uniform on the sphere
const fogOf = p => (p.fog !== undefined ? p.fog : p.cat === 'foggy' ? 1 : 0);    // W8b places have no fog share: foggy = 1
const lineOf = (lon, lat) => (W.arcDistance({ lon, lat }, { lon: -25, lat: 56 }) < 30 ? 20 : 18);
// F2 rules for one place and its weights: [rule broken] or []
function broken(p, w, lon, lat) {
  const bad = [], kind = W.regionAt(lon, lat).kind;
  if (!valid(w)) bad.push('invalid');
  if (p.cat === 'ice' && w.rain > 0) bad.push('rain on ice');
  if (kind === 'town' && w.snow > 0) bad.push('snow in town');
  if (p.cat !== 'mountain' && p.cat !== 'ice' && w.snow > 0) bad.push('snow off mountains');
  if (p.cat !== 'foggy' && w.fog > 0) bad.push('fog off foggy');
  return bad;
}

// ---------------------------------------------------------------- F1 determinism
function determinism(M) {
  const fresh = (lon, lat, t) => M.make(W).at(lon, lat, t).weights, res = {};
  const acc = () => ({ n: 0, maxDiff: 0, mismatches: 0 }), cmp = (a, w, r) => { const d = diff(w, r); a.n++; if (d > a.maxDiff) a.maxDiff = d; if (d > EPS) a.mismatches++; };
  // the counterexample of the plan (section 2): two 0.05-degree cell neighbours on the south ice, t = 600
  { const a = [152.28, -73.7], b = [152.32, -73.7], A = M.make(W), B = M.make(W); A.place(...a); B.place(...b); const qa = A.at(...a, 600), qb = B.at(...a, 600);
    res.counterexample = { point: a, warmedFirst: [a, b], t: 600, afterWarmA: { state: qa.state, weights: { ...qa.weights } }, afterWarmB: { state: qb.state, weights: { ...qb.weights } }, diff: diff(qa.weights, qb.weights) }; }
  // pairs inside one W8b cache cell (round(lon * 20), round(lat * 20)), the other point queried first
  const r = rng(4242), cell = [], key = (lo, la) => Math.round(lo * 20) + ',' + Math.round(la * 20);
  while (cell.length < 400) { const [lo, la] = randomPlace(r), q = [lo + (r() - 0.5) * 0.048, la + (r() - 0.5) * 0.048]; if (Math.abs(q[1]) < 89.9 && key(lo, la) === key(...q)) cell.push([[lo, la], q]); }
  // pairs straddling a category or region edge (bisected to a few micrometres; labels from fresh instances of the working-tree weather.js)
  const label = (lo, la) => { const p = NOW.make(W).place(lo, la); return W.regionAt(lo, la).kind + '/' + p.cat + '/' + (p.fog > 0 && p.fog < 1 ? 'band' : fogOf(p)); }, edge = [];
  for (let i = 0; i < 40000 && edge.length < 150; i++) {
    const [lo, la] = randomPlace(r); if (Math.abs(la) > 89) continue; let a = [lo, la], b = dest(lo, la, r() * 360, 3); const la0 = label(...a); if (la0 === label(...b)) continue;
    for (let k = 0; k < 20; k++) { const m = [wrap(a[0] + ((b[0] - a[0] + 540) % 360 - 180) / 2), (a[1] + b[1]) / 2]; if (label(...m) === la0) a = m; else b = m; }
    edge.push([a, b]);
  }
  const ts = [600, 1000, 2524, 7777];
  for (const [name, pairs] of [['sameCell', cell], ['edges', edge]]) { const a = acc();
    for (const [p, q] of pairs) for (const t of ts) { const X = M.make(W); X.place(...q); X.at(...q, t); cmp(a, X.at(...p, t).weights, fresh(...p, t)); const Y = M.make(W); Y.at(...p, t); cmp(a, Y.at(...q, t).weights, fresh(...q, t)); }
    res[name] = { pairs: pairs.length, ...a }; }
  // one instance, different orders of the same queries, against a fresh instance per query
  const Q = []; for (const [p, q] of [...cell, ...edge]) for (const t of ts.slice(0, 2)) Q.push([...p, t], [...q, t]);
  for (let i = 0; i < 300; i++) Q.push([...randomPlace(r), r() * 21600]);
  const refs = Q.map(q => fresh(...q)), ord = acc(), run = (idx, clearAt) => { const X = M.make(W); idx.forEach((i, n) => { if (n === clearAt) { if (X.clearCache) X.clearCache(); } cmp(ord, X.at(...Q[i]).weights, refs[i]); }); };
  const idx = Q.map((_, i) => i), sh = idx.slice(); for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; }
  run(idx); run(idx.slice().reverse()); run(sh); run([...idx, ...idx]); run(sh, Math.floor(sh.length / 2));
  res.orders = { queries: Q.length, runs: 'forward, reverse, shuffled, repeated twice, cache cleared halfway', ...ord };
  // longitude +-360 (fresh instances: only the wrap is tested)
  const lon = acc(); let catDiff = 0; for (let i = 0; i < 500; i++) { const [lo, la] = randomPlace(r), t = r() * 21600, a = M.make(W).at(lo, la, t); for (const s of [360, -360]) { const b = M.make(W).at(lo + s, la, t); cmp(lon, b.weights, a.weights); if (b.category !== a.category) catDiff++; } }
  res.lon360 = { ...lon, categoryMismatches: catDiff };
  if (M.make(W).cacheSize) { const X = M.make(W); let peak = 0; for (let i = 0; i < 20000; i++) { X.place(...randomPlace(r)); peak = Math.max(peak, X.cacheSize()); } res.cache = { distinctPlaces: 20000, peak }; }
  return res;
}

// ---------------------------------------------------------------- F2 place rules and shares
const CATS = ['town', 'default', 'foggy', 'mountain', 'lava', 'desert', 'ice'];
function places() {   // 100 places per category, by the working-tree weather.js (fresh instance), the same list for both versions
  const r = rng(99), X = NOW.make(W), got = Object.fromEntries(CATS.map(k => [k, []]));
  for (let i = 0; i < 600000 && CATS.some(k => got[k].length < 100); i++) {
    const [lon, lat] = randomPlace(r), reg = W.regionAt(lon, lat), p = X.place(lon, lat), cat = reg.kind === 'town' ? 'town' : p.cat;
    if (reg.zone === 'ocean' && cat !== 'foggy') continue; if (got[cat].length < 100) got[cat].push([lon, lat]);
  }
  return got;
}
function shares(M, got) {
  const X = M.make(W), res = {}, bad = {};
  const sim = (lon, lat, t0, T, step) => { const c = Object.fromEntries(STATES.map(s => [s, 0])); let n = 0; for (let t = t0; t < t0 + T; t += step) { const q = X.at(lon, lat, t); n++; for (const s of STATES) c[s] += q.weights[s]; const b = broken(X.place(lon, lat), q.weights, lon, lat); for (const k of b) bad[k] = (bad[k] || 0) + 1; } for (const s of STATES) c[s] /= n; return c; };
  for (const k of CATS) {
    const q = { n: got[k].length, cycle: { leadMin: 1, rainMax: 0, largestOk: 0 }, sixHours: { leadMin: 1, rainMax: 0, largestOk: 0 }, snowMax: 0, fogPlaces: 0, fogMin: 1 };
    for (const [lon, lat] of got[k]) {
      const p = X.place(lon, lat), L = (p.pat || 'x'.repeat(20)).length * M.SLOT;
      for (const [name, c] of [['cycle', sim(lon, lat, 30 * M.SLOT, L, 6)], ['sixHours', sim(lon, lat, 0, 21601, 30)]]) {
        const lead = k === 'ice' ? c.snow : k === 'desert' ? c.clear : c.rain + (k === 'mountain' ? c.snow : 0), Q = q[name];
        Q.leadMin = Math.min(Q.leadMin, lead); Q.rainMax = Math.max(Q.rainMax, c.rain); if (STATES.every(s => c[s] <= lead + 1e-9)) Q.largestOk++;
        q.snowMax = Math.max(q.snowMax, c.snow); if (name === 'cycle') { if (c.fog > 0) q.fogPlaces++; if (k === 'foggy') q.fogMin = Math.min(q.fogMin, c.fog); }
      }
    }
    res[k] = q;
  }
  // every lock at every place falls back to an allowed state
  let lockBad = 0, lockN = 0, lockMountainSnow = 0; for (const s of STATES) { X.lock(s); for (const k of CATS) for (const [lon, lat] of got[k]) { const q = X.at(lon, lat, 1234), p = X.place(lon, lat); lockN++; if (broken(p, q.weights, lon, lat).length) lockBad++; if (s === 'snow' && p.cat === 'mountain' && q.weights.snow > p.snowFrac + 1e-9) lockMountainSnow++; } } X.lock(null);
  return { cats: res, violations: bad, lock: { samples: lockN, violations: lockBad, mountainSnowAboveFraction: lockMountainSnow } };
}

// ---------------------------------------------------------------- F3 time
function timeline(M, got) {
  const X = M.make(W), rows = []; let fadeChecks = 0, fadeWorst = 0;
  for (const k of CATS) for (const [lon, lat] of got[k].slice(0, 2)) {
    let prev = null, maxRate = 0, at = 0;
    for (let t = 0; t <= 21600; t++) { const q = X.at(lon, lat, t), w = q.weights; if (prev) { const d = diff(w, prev); if (d > maxRate) { maxRate = d; at = t; } } prev = w;
      if (q.fadeLeft > 0 && t % 7 === 0) { fadeChecks++; fadeWorst = Math.max(fadeWorst, diff(X.at(lon, lat, t + q.fadeLeft).weights, q.target)); } }
    rows.push({ cat: k, lon, lat, maxRate, at });
  }
  // the town grid: one weather at every time (21 x 21 points, x and z in [-47, 47]; every 37 s over 6 hours)
  const grid = []; for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) { const q = W.townToLonLat(-47 + 4.7 * i, -47 + 4.7 * j); grid.push([q.lon, q.lat]); }
  let townDiff = 0, townTimesSplit = 0, townStates = 0; const splitAt = {};
  for (let t = 0; t <= 21600; t += 37) { const w0 = X.at(...grid[0], t).weights, seen = new Set(); let d = 0; for (const g of grid) { const q = X.at(...g, t); d = Math.max(d, diff(q.weights, w0)); seen.add(q.state); } townDiff = Math.max(townDiff, d); if (d > EPS) townTimesSplit++; townStates = Math.max(townStates, seen.size); }
  for (const t of [600, 900, 1200]) { const s = new Set(); for (let x = -40; x <= 40; x += 10) for (let z = -40; z <= 40; z += 10) { const q = W.townToLonLat(x, z); s.add(X.at(q.lon, q.lat, t).state); } splitAt[t] = [...s]; }
  return { rows, maxRate: Math.max(...rows.map(q => q.maxRate)), fade: { checks: fadeChecks, worst: fadeWorst }, town: { points: grid.length, times: Math.floor(21600 / 37) + 1, maxDiff: townDiff, timesSplit: townTimesSplit, maxStates: townStates, plan10m: splitAt } };
}

// ---------------------------------------------------------------- F4 space
function spaceScan(M) {
  const X = M.make(W), stats = {}, hard = {}, bad = {}, grad = { max: 0, at: null };
  const info = (lon, lat) => { const p = X.place(lon, lat); if (p.grad > grad.max) { grad.max = p.grad; grad.at = [+f(lon, 4), +f(lat, 4)]; } return { p, kind: W.regionAt(lon, lat).kind, h: W.height(lon, lat), line: lineOf(lon, lat), ws: TIMES.map(t => X.at(lon, lat, t).weights) }; };
  const classify = (a, b) => {
    if (a.line !== b.line && Math.max(a.h, b.h) >= Math.min(a.line, b.line) - 2.5) return 'hard';                       // the 18 / 20 m snow line switch (terrain.js)
    // a region edge where the fog share jumps by more than its 10 m ramps allow in one step (0.075)
    if (a.kind !== b.kind && ((a.p.cat !== b.p.cat && ['ice', 'desert'].some(c => c === a.p.cat || c === b.p.cat)) || Math.abs(fogOf(a.p) - fogOf(b.p)) > 0.08)) return 'hard';
    return Math.max(a.h, b.h) >= a.line - 2.5 && Math.min(a.h, b.h) <= a.line + 0.8 ? 'height' : 'smooth';
  };
  const walk = (set, pts) => {
    const S = stats[set] || (stats[set] = { walks: 0, steps: 0, maxStep: 0, over: 0, worst: null, hardSteps: 0, height: { steps: 0, over: 0, maxExcess: -1, maxStep: 0, maxDh: 0 } }); S.walks++;
    let prev = null; for (const [lon, lat] of pts) {
      const cur = info(lon, lat); for (let i = 0; i < TIMES.length; i++) for (const k of broken(cur.p, cur.ws[i], lon, lat)) bad[k] = (bad[k] || 0) + 1;
      if (prev) { let d = 0; for (let i = 0; i < TIMES.length; i++) d = Math.max(d, diff(cur.ws[i], prev.ws[i])); S.steps++; const kind = classify(prev, cur);
        if (kind === 'hard') { S.hardSteps++; if (d > 0) { const kk = prev.line !== cur.line ? `snow line ${prev.line} | ${cur.line} m (ameni-dake 30 m)` : [prev.kind + ':' + prev.p.cat, cur.kind + ':' + cur.p.cat].sort().join(' | '), H = hard[kk] || (hard[kk] = { steps: 0, maxJump: 0, example: null }); H.steps++; if (d > H.maxJump) { H.maxJump = d; H.example = [[+f(prev.lon, 4), +f(prev.lat, 4)], [+f(lon, 4), +f(lat, 4)]]; } } }
        else if (kind === 'height') { const Hh = S.height, dh = Math.abs(cur.h - prev.h), x = d - (0.1 + 1.5 * dh); Hh.steps++; if (x > 0) Hh.over++; Hh.maxExcess = Math.max(Hh.maxExcess, x); Hh.maxStep = Math.max(Hh.maxStep, d); Hh.maxDh = Math.max(Hh.maxDh, dh); }
        else { if (d > 0.1) S.over++; if (d > S.maxStep) { S.maxStep = d; S.worst = [+f(lon, 4), +f(lat, 4)]; } } }
      prev = { ...cur, lon, lat };
    }
  };
  const line = (lon, lat, brg, from, to) => { const pts = []; for (let s = from; s <= to + 1e-9; s += STEP) pts.push(dest(lon, lat, brg, s)); return pts; };
  const r = rng(2026), N = NOW.make(W);
  // great circles (random poles), the whole way round
  for (let i = 0; i < CIRCLES; i++) { const [lon, lat] = randomPlace(r); walk('greatCircles', line(lon, lat, r() * 360, 0, 2 * Math.PI * R)); }
  // the town edge: 72 rays from the centre to 30 m beyond the patch (plane coordinates; about 0.5 m steps on the sphere)
  for (let a = 0; a < 360; a += 5) { const c = Math.cos(a * D), s = Math.sin(a * D), re = 48 / Math.max(Math.abs(c), Math.abs(s)), pts = []; for (let d = re - 20; d <= re + 30; d += STEP) { const q = W.townToLonLat(c * d, s * d); pts.push([q.lon, q.lat]); } walk('townEdge', pts); }
  // seeds by a scalar field, then a walk along its gradient: coast (fog limit 24 m), rivers (10 m), the snow line, phase contours (of the working tree)
  const seeds = (n, pick) => { const out = []; for (let i = 0; i < 400000 && out.length < n; i++) { const [lon, lat] = randomPlace(r); if (Math.abs(lat) < 88 && pick(lon, lat)) out.push([lon, lat]); } return out; };
  const along = (set, list, fn, half) => { for (const [lon, lat] of list) walk(set, line(lon, lat, bearingUp(fn, lon, lat), -half, half)); };
  along('coast', seeds(200, (lo, la) => { const d = W.coastDistance(lo, la); return d > 16 && d < 22 && W.regionAt(lo, la).zone !== 'building'; }), W.coastDistance, 16);
  along('river', seeds(120, (lo, la) => { const d = W.riverCrossing(lo, la); return d > 2 && d < 8 && W.regionAt(lo, la).zone !== 'building'; }), W.riverCrossing, 12);
  along('snowLine', seeds(150, (lo, la) => { const p = N.place(lo, la); return p.cat === 'mountain' && p.snowFrac > 0.05 && p.snowFrac < 0.95; }), W.height, 30);
  along('mountainEdge', seeds(100, (lo, la) => { const h = W.height(lo, la), l = lineOf(lo, la), k = W.regionAt(lo, la).kind; return h > l - 2.6 && h < l - 1.4 && !/ice|desert|lava|town/.test(k); }), W.height, 20);
  along('phaseContours', seeds(200, (lo, la) => { const p = N.place(lo, la); return W.townPatchDistance(lo, la) > 12 && Math.abs(p.phase - Math.round(p.phase)) < 0.08; }), (lo, la) => N.place(lo, la).phase, 15);
  // longitude seams: 180 and the flat-map seam -85, every 5 degrees of latitude
  for (const s of [180, -85]) for (let la = -80; la <= 80; la += 5) walk('seams', line(s, la, 90, -15, 15));
  return { stats, hard, violations: bad, phaseGradient: grad };
}

// ---------------------------------------------------------------- F5 API
function api() {
  const X = NOW.make(W), L = [], ok = [];
  const has = ['sample', 'at', 'effectsAt', 'place', 'lock', 'locked', 'clearCache', 'cacheSize'].filter(k => typeof X[k] === 'function'); ok.push(has.length === 8 && X.at === X.sample); L.push(`接口：${has.join(' / ')}；at 即 sample：${X.at === X.sample}`);
  const r = rng(5), find = want => { for (;;) { const [lon, lat] = randomPlace(r); if (want(X.place(lon, lat))) return { lon, lat }; } };
  const town = W.townToLonLat(-7, 20), ice = find(p => p.cat === 'ice'), foggy = find(p => p.cat === 'foggy' && p.fog === 1);
  const fx = (s, lon, lat) => { X.lock(s); const e = X.effectsAt(lon, lat, 1000); X.lock(null); return e; };
  const cases = [['rain', town, { rain: 1, snow: 0, wetness: 1, drip: 1 }], ['clear', town, { rain: 0, snow: 0, wetness: 0, drip: 0, mist: 0 }], ['after', town, { rain: 0, snow: 0, wetness: 1, drip: 1 }],
    ['snow', town, { rain: 1, snow: 0 }], ['snow', ice, { rain: 0, snow: 1 }], ['rain', ice, { rain: 0, snow: 1 }], ['fog', foggy, { rain: 0, mist: 1 }], ['fog', town, { mist: 0.2 }]];
  for (const [s, p, want] of cases) { const e = fx(s, p.lon, p.lat), good = Object.entries(want).every(([k, v]) => Math.abs(e[k] - v) <= 1e-12); ok.push(good); L.push(`lock('${s}') ${p === town ? '城镇 (-7, 20)' : p === ice ? '冰原' : '雾区（雾份额 1）'}：${Object.entries(e).map(([k, v]) => k + ' ' + f(v)).join(' ')}${good ? '' : '（应为 ' + JSON.stringify(want) + '）'}`); }
  let range = true; for (let i = 0; i < 3000; i++) { const [lo, la] = randomPlace(r), e = X.effectsAt(lo, la, r() * 21600); if (Object.values(e).some(v => !(v >= 0 && v <= 1))) range = false; } ok.push(range); L.push(`3000 个随机样本的效果权重都在 [0, 1]：${range}`);
  ok.push(X.lock('bogus') === null && X.lock(null) === null && X.locked() === null); L.push("lock('bogus') 与 lock(null) 解除锁定：" + (X.locked() === null));
  const code = srcNow.replace(/\/\/.*$/gm, ''), refs = code.match(/\b(THREE|document|window|SECTION|camera|Math\.random|performance|Date)\b/g); ok.push(!refs); L.push('weather.js（去掉注释）不读相机、THREE、DOM、SECTION、随机数或时钟：' + (refs ? '有 ' + refs.join(',') : '无'));
  return { ok: ok.every(Boolean), lines: L };
}

// ---------------------------------------------------------------- run
const t0 = Date.now(), report = { stage: 'WX1', date: new Date().toLocaleDateString('sv-SE'), plan: 'docs/world/WEATHER_COMPLETION_PLAN.md §4', tool: 'tools/weather_field_check.mjs',
  sources: { 'weather.js': { now: sha(srcNow), before: srcBefore ? sha(srcBefore) : null, beforeRef } }, params: { CIRCLES, SLOT: NOW.SLOT, FADE: NOW.FADE, SEED: NOW.SEED, PHASES: NOW.PHASES, BAND: NOW.BAND, MIX_MIN: NOW.MIX_MIN, FOG_BAND: NOW.FOG_BAND, TOWN_BAND: NOW.TOWN_BAND, STEP, TIMES }, now: {}, before: {} };
const versions = [['now', NOW], ...(BEFORE ? [['before', BEFORE]] : [])];
const got = places();
for (const [name, M] of versions) { report[name].determinism = determinism(M); report[name].shares = shares(M, got); report[name].time = timeline(M, got); report[name].space = spaceScan(M); }
const A = report.now, B = BEFORE ? report.before : null;
// ---- F1
{ const d = A.determinism, worst = Math.max(d.sameCell.maxDiff, d.edges.maxDiff, d.orders.maxDiff, d.lon360.maxDiff, d.counterexample.diff);
  const ok = worst <= EPS && d.lon360.categoryMismatches === 0 && d.cache.peak <= 4096;
  const b = B && B.determinism, was = b ? `（变更前：反例 ${b.counterexample.afterWarmA.state} / ${b.counterexample.afterWarmB.state}；同格错 ${b.sameCell.mismatches}/${b.sameCell.n}，跨边界错 ${b.edges.mismatches}/${b.edges.n}，顺序错 ${b.orders.mismatches}/${b.orders.n}，±360° 错 ${b.lon360.mismatches}/${b.lon360.n}）` : '';
  out(ok, 'WX1-F1 确定性：同一 (lon, lat, t) 与查询顺序、缓存预热、缓存清理、经度 ±360° 无关（误差 ≤ 1e-12）', [
    `计划第 2 节反例 [152.28, -73.7] t = 600：先预热自身 ${d.counterexample.afterWarmA.state}，先预热 [152.32, -73.7] ${d.counterexample.afterWarmB.state}，差 ${e(d.counterexample.diff)}${was}`,
    `同一 0.05° 旧缓存格的 ${d.sameCell.pairs} 对、跨类别/区域边界的 ${d.edges.pairs} 对（双向预热、4 个时刻）：${d.sameCell.n + d.edges.n} 次比较，最大差 ${e(Math.max(d.sameCell.maxDiff, d.edges.maxDiff))}，不一致 ${d.sameCell.mismatches + d.edges.mismatches}`,
    `${d.orders.queries} 个查询 × 5 种顺序（${d.orders.runs}）：最大差 ${e(d.orders.maxDiff)}，不一致 ${d.orders.mismatches}；经度 ±360°：${d.lon360.n} 次，最大差 ${e(d.lon360.maxDiff)}，类别不同 ${d.lon360.categoryMismatches}`,
    `缓存：${d.cache.distinctPlaces} 个不同地点后峰值 ${d.cache.peak}（上限 4096）`]); }
// ---- F2
{ const s = A.shares, C = s.cats, viol = Object.entries(s.violations), L = [];
  let ok = viol.length === 0 && s.lock.violations === 0 && s.lock.mountainSnowAboveFraction === 0;
  for (const k of CATS) { const q = C[k], need = k === 'desert' ? q.cycle.rainMax <= 0.05 && q.sixHours.rainMax <= 0.05 : q.cycle.leadMin >= 0.5 && q.sixHours.leadMin >= 0.5;
    const largest = q.cycle.largestOk === q.n && q.sixHours.largestOk === q.n, fogOk = k === 'foggy' ? q.fogPlaces === q.n : q.fogPlaces === 0, snowOk = k === 'mountain' || k === 'ice' || q.snowMax === 0;
    if (q.n < 100 || !need || !largest || !fogOk || !snowOk || (k === 'ice' && q.cycle.rainMax > 0)) ok = false;
    const lead = k === 'ice' ? '雪' : k === 'desert' ? '晴夜' : k === 'mountain' ? '雨+雪' : '雨';
    L.push(`${k}：${q.n} 处；${lead}占比 完整周期 ≥ ${pc(q.cycle.leadMin)}、6 小时 ≥ ${pc(q.sixHours.leadMin)}，最大项正确 ${q.cycle.largestOk}/${q.n}、${q.sixHours.largestOk}/${q.n}；雨最大 ${pc(Math.max(q.cycle.rainMax, q.sixHours.rainMax))}，雪最大 ${pc(q.snowMax)}，出现雾 ${q.fogPlaces} 处${k === 'foggy' ? `（雾占比最低 ${pc(q.fogMin)}）` : ''}`); }
  L.push(`全部样本逐点规则（有限、非负、和为 1；冰原无雨、城镇与非山地无雪、雾只在雾区）：违规 ${viol.length ? viol.map(([k, v]) => k + ' ' + v).join('，') : 0}`);
  L.push(`六种锁定 × ${CATS.length * 100} 处回退到合法状态：违规 ${s.lock.violations}/${s.lock.samples}；山地锁雪按雪线比例分雨雪（超出比例 ${s.lock.mountainSnowAboveFraction}）`);
  if (B) { const b = B.shares; L.push(`变更前：逐点违规 ${Object.entries(b.violations).map(([k, v]) => k + ' ' + v).join('，') || 0}；锁定违规 ${b.lock.violations}，山地锁雪超出雪线比例 ${b.lock.mountainSnowAboveFraction}`); }
  out(ok, 'WX1-F2 地点规则与长期占比（每类 100 处；完整周期与开头 6 小时）', L); }
// ---- F3
{ const q = A.time, ok = q.maxRate <= 1 / 40 + 1e-12 && q.fade.worst <= 1e-9 && q.town.maxDiff <= EPS;
  out(ok, 'WX1-F3 时间：每 1 s 采样 6 小时变化率 ≤ 1/40；渐变剩余时间准确；城镇同一时刻同一天气', [
    `${q.rows.length} 处（每类 2 处）× 21601 个时刻：最大变化 ${f(q.maxRate, 4)} /s（上限 0.025，渐变 ${NOW.FADE} s）`,
    `渐变中抽查 ${q.fade.checks} 次：t + fadeLeft 时的权重与 target 最大差 ${e(q.fade.worst)}`,
    `城镇 ${q.town.points} 个格点 × ${q.town.times} 个时刻：同一时刻最大差 ${e(q.town.maxDiff)}，分裂的时刻 ${q.town.timesSplit}，同时出现的状态最多 ${q.town.maxStates} 种；计划第 2 节的 10 m 网格 t = 600/900/1200：${Object.entries(q.town.plan10m).map(([t, s]) => t + ' ' + s.join('/')).join('，')}`,
    ...(B ? [`变更前：最大变化 ${f(B.time.maxRate, 4)} /s；城镇分裂的时刻 ${B.time.town.timesSplit}/${B.time.town.times}，同时最多 ${B.time.town.maxStates} 种；10 m 网格 ${Object.entries(B.time.town.plan10m).map(([t, s]) => t + ' ' + s.join('/')).join('，')}`] : [])]); }
// ---- F4
{ const S = A.space.stats, need = { greatCircles: CIRCLES, townEdge: 72, coast: 150, river: 60, snowLine: 100, mountainEdge: 50, phaseContours: 150, seams: 66 }, L = [];
  let ok = Object.keys(A.space.violations).length === 0;
  for (const [k, n] of Object.entries(need)) { const q = S[k], Hh = q && q.height, b = B && B.space.stats[k]; if (!q || q.walks < n || q.over > 0 || q.maxStep > 0.1 || Hh.over > 0) ok = false;
    L.push(`${k}：${q ? q.walks : 0} 条（要求 ≥ ${n}），${q ? q.steps : 0} 步 × ${TIMES.length} 个时刻；平滑步最大变化 ${q ? f(q.maxStep, 3) : '-'}${q && q.worst ? ' @ ' + q.worst.join(', ') : ''}，超过 0.1 的 ${q ? q.over : '-'}`
      + `；高度带 ${Hh.steps} 步（每步高差最大 ${f(Hh.maxDh, 2)} m，每 0.5 m 地面最大变化 ${f(Hh.maxStep, 3)}，超出 0.1 + 1.5·Δh 的 ${Hh.over}）；硬边界步 ${q.hardSteps}`
      + (b ? `（变更前：平滑步最大 ${f(b.maxStep, 3)}，超过 0.1 的 ${b.over}/${b.steps - b.hardSteps - b.height.steps}；高度带超出 ${b.height.over}/${b.height.steps}）` : '')); }
  const H = Object.entries(A.space.hard).sort((a, b) => b[1].steps - a[1].steps);
  L.push(`硬边界（world.js 区域边缘，按规则不混合）：${H.length} 类，${H.map(([k, v]) => `${k} ${v.steps} 步、最大跳变 ${f(v.maxJump)}`).join('；') || '无'}`);
  L.push(`扫描点的相位梯度最大 ${f(A.space.phaseGradient.max, 4)} /m（@ ${A.space.phaseGradient.at}）：相邻相位等值线至少相距 ${f(1 / A.space.phaseGradient.max, 1)} m（混合带 ${NOW.BAND} m）`);
  L.push(`扫描到的每个点（含硬边界两侧）逐点规则违规：${Object.entries(A.space.violations).map(([k, v]) => k + ' ' + v).join('，') || 0}`);
  out(ok, 'WX1-F4 空间连续：0.5 m 步进、6 个时刻，平滑带内每步权重变化 ≤ 0.1（相位等值线、城界、海岸、河谷、雪线、山地边、经度接缝）', L); }
// ---- F5
{ const q = api(); report.now.api = q; out(q.ok, 'WX1-F5 接口：sample / effectsAt / lock 回退，纯数据模块', q.lines); }
// ---- fixed samples for the report (before / after): the town corner of the review shots, the plan's counterexample, the first F2 place of each category
{ const tc = W.townToLonLat(-7, 20), pts = [['town (-7, 20)', tc.lon, tc.lat], ['plan counterexample', 152.28, -73.7], ...CATS.filter(k => k !== 'town').map(k => [k, ...got[k][0]])];
  report.samples = pts.map(([name, lon, lat]) => ({ name, lon: +f(lon, 4), lat: +f(lat, 4), at: [0, 600, 924, 1500, 3000, 9010].map(t => Object.fromEntries(versions.map(([v, M]) => { const q = M.make(W).at(lon, lat, t); return [v, { t, state: q.state, weights: Object.fromEntries(STATES.filter(s => q.weights[s] > 0).map(s => [s, q.weights[s]])) }]; }))) })); }
console.log(`耗时 ${f((Date.now() - t0) / 1000, 1)} s`);
report.pass = fails.length === 0; report.fails = fails;
const rp = args.includes('--report') ? path.resolve(root, argOf('--report', 'docs/world/weather/wx1/report.json')) : null;
if (rp) { fs.mkdirSync(path.dirname(rp), { recursive: true }); fs.writeFileSync(rp, JSON.stringify(report, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(6) : v), 1) + '\n'); console.log('report: ' + path.relative(root, rp)); }
console.log(fails.length ? `FAIL weather_field_check：${fails.join('；')}` : `PASS weather_field_check（${results.length} 项）`);
process.exitCode = fails.length ? 1 : 0;
