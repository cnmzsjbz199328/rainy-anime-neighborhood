// Weather of the planet (W8b, D8 / ST05; WX1 2026-10-15): a pure, deterministic function of place and time. No THREE, no DOM, no camera, no Math.random.
//   sample(lon, lat, t) -> { weights: { rain, after, overcast, clear, snow, fog }, state, category, kind, slot, fadeLeft, target }
//     weights sum to 1; state = the heaviest (a label only: read the weights); fadeLeft = seconds left in a slot cross-fade that changes the weights
//     (0 otherwise); target = the weights once that fade is over.   at = sample (the W8b name).
//   effectsAt(lon, lat, t) -> { rain, snow, wetness, drip, mist }: physical effect weights in [0, 1] (EFFECT below). Rain impacts follow rain only; wetness
//     and drips go on after the rain. Map mode, distance fade and debug switches belong to the presentation (weather_fx.js), applied there once.
//   t is the weather time (seconds since load, or fixed by setTime in weather_fx.js); particle, ripple and drip animation keep their own clock.
// Time is cut into slots of SLOT seconds. Each place follows a fixed cyclic pattern of states for its category (the share of rain is the share of R in the
// pattern, spread evenly so that rain is always the longest state). A smooth value noise on the sphere (scale 100 m) gives every place a continuous phase
// PHASES * noise; inside a phase band a place follows its pattern shifted by that whole phase, and across each phase contour the two neighbouring phases mix
// their weights over BAND metres or more, so the weather is continuous in space (phase contours are at least 21 m apart: tools/weather_field_check.mjs).
// The town patch is one weather zone: every place on it takes the weights of one pure phase (the town centre's); over TOWN_BAND metres outside the patch those
// weights blend linearly into the field's.
// At the start of every slot the previous state cross-fades into the new one over FADE seconds (rate 1 / 48 per second, under the 1 / 40 of W8_SPEC 4.3).
// Slot 0 (the first five minutes after loading) is the category's base state everywhere: rain in the town, so every check and review shot sees the town as it
// always was.
// Categories (W8_SPEC 4.2, from world.js): ice (snow instead of rain, never rain), desert (rain under 5 %), lava, mountain (height >= 18 m, 20 m round
// ameni-dake: rain turns into snow above the snow line, sleet in a band across it), foggy (forest, coast within 24 m, river valleys within 10 m: rain-after
// turns into fog; the fog share eases out over the last FOG_BAND metres inside the coast and river limits and over the last metre of height below the
// mountains), and the rest (town, farmland, village, ruin, grassland, island: rain, after-rain, overcast, clear; never snow). Region edges of world.js (ice,
// desert, lava, forest, building zones by the coast) stay hard, so no state leaks across them into a place that does not allow it. The sleet band and the
// fog share below the mountains follow height (the W8b thresholds), so on steep slopes they are narrow across the ground.
(function (global) {
'use strict';
const SLOT = 300, FADE = 48, SEED = 0x5eed8b, R = 90, D = Math.PI / 180;
const PHASES = 5, BAND = 15, MIX_MIN = 0.1, FOG_BAND = 10, TOWN_BAND = 15, CACHE = 4096;   // phases per unit of noise; the phase mix width (m) and its least
// half-width in phase units; the fog share's ramp inside the coast and river limits (m); the town's blend ring (m); places kept in the cache
const STATES = ['rain', 'after', 'overcast', 'clear', 'snow', 'fog'];
// patterns: one letter per slot; R rain, A after-rain, O overcast, C clear, S snow, F fog
const PATTERN = {
  default:  'RARORRCRARRORCRRARCR',             // 12 R of 20 = 60 % (any 12 or more slots in a row: >= 54 %)
  foggy:    'RFRORRCRFRRARCRRFRAR',             // 12 R, 3 F, 2 A, 2 C, 1 O (R 60 %); R in the same slots as default, so the two mix without a rain jump
  mountain: 'RARORRCRARRORCRRARCR',             // as default; R above the snow line becomes S
  lava:     'RARORRCRARRORCRRARCR',
  desert:   'CCOCCACCOCCCRCCOCCACCCOCC',        // 1 R of 25 = 4 %
  ice:      'SCSCSSCSCSSCSSCSCSSC',             // 12 S, 8 C
};
const LETTER = { R: 'rain', A: 'after', O: 'overcast', C: 'clear', S: 'snow', F: 'fog' };
const BASE = { default: 'rain', foggy: 'rain', mountain: 'rain', lava: 'rain', desert: 'clear', ice: 'snow' };
// effect weights of each state (WX1 start values for WX2): rain = rain lines and impacts; snow = snowflakes; wetness = wet surfaces (puddles, reflections:
// weather_fx PUDDLE); drip = eaves and leaf tips; mist = weather mist near the ground (weather_fx FOG_ADD / 0.03), never steam
const EFFECT = {
  rain:     { rain: 1, snow: 0, wetness: 1,   drip: 1,   mist: 0 },
  after:    { rain: 0, snow: 0, wetness: 1,   drip: 1,   mist: 0.2 },
  overcast: { rain: 0, snow: 0, wetness: 0.6, drip: 0,   mist: 0 },
  clear:    { rain: 0, snow: 0, wetness: 0,   drip: 0,   mist: 0 },
  snow:     { rain: 0, snow: 1, wetness: 0,   drip: 0,   mist: 0.13 },
  fog:      { rain: 0, snow: 0, wetness: 0.6, drip: 0.5, mist: 1 },
};
const EFFECTS = ['rain', 'snow', 'wetness', 'drip', 'mist'];
const hash = (i, j, k, s) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
function vnoise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const c = (a, b, d) => hash(xi + a, yi + b, zi + d, s), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrapLon = lon => { if (lon <= 180 && lon > -180) return lon; const l = ((lon + 180) % 360 + 360) % 360 - 180; return l === -180 ? 180 : l; };
const mod = (i, n) => ((i % n) + n) % n;
const noise = (lon, lat) => { const cl = Math.cos(lat * D); return vnoise3(R * cl * Math.sin(lon * D) / 100, R * cl * Math.cos(lon * D) / 100, R * Math.sin(lat * D) / 100, SEED); };
// the point h metres from (lon, lat) along the bearing brg (degrees, 0 north, 90 east)
function offset(lon, lat, brg, h) {
  const a = h / R, p = lat * D, b = brg * D, sp = Math.max(-1, Math.min(1, Math.sin(p) * Math.cos(a) + Math.cos(p) * Math.sin(a) * Math.cos(b)));
  return [wrapLon(lon + Math.atan2(Math.sin(b) * Math.sin(a) * Math.cos(p), Math.cos(a) - Math.sin(p) * sp) / D), Math.asin(sp) / D];
}
// weights -> effect weights (EFFECT); also for weights a presentation has interpolated from a grid of samples
function effectsOf(w) { const e = {}; for (const k of EFFECTS) { let v = 0; for (const s of STATES) if (w[s]) v += w[s] * EFFECT[s][k]; e[k] = Math.max(0, Math.min(1, v)); } return e; }
function make(W) {
  const PEAK = { lon: -25, lat: 56 }, phaseAt = (lon, lat) => PHASES * noise(lon, lat);
  // ---- the continuous field. The phase mix: phases lo and lo + 1, weight b on lo + 1. Round the nearest contour (an integer phase m) the two mix over BAND
  // metres, measured with the phase gradient G (central differences 0.25 m apart), and over at least +-MIX_MIN of phase where G is small (wider than BAND,
  // and steady where G varies near flat spots); where two contours are closer than BAND the mix spans the whole gap between them (still continuous)
  function field(lon, lat) {
    const ph = phaseAt(lon, lat), e = 0.25, E1 = offset(lon, lat, 90, e), E0 = offset(lon, lat, 270, e), N1 = offset(lon, lat, 0, e), N0 = offset(lon, lat, 180, e);
    const G = Math.hypot(phaseAt(E1[0], E1[1]) - phaseAt(E0[0], E0[1]), phaseAt(N1[0], N1[1]) - phaseAt(N0[0], N0[1])) / (2 * e);
    const m = Math.round(ph), a = Math.min(0.5, Math.max(MIX_MIN, BAND / 2 * G));
    return { phase: ph, grad: G, lo: m - 1, b: smooth(-a, a, ph - m) };
  }
  // the town zone: one place with the pure phase of the town centre; places within TOWN_BAND of the patch blend towards it (townK = 0 on the patch, 1 outside)
  const c = W.townToLonLat(0, 0), PH_TOWN = phaseAt(c.lon, c.lat);
  const TOWN = Object.freeze({ cat: 'default', kind: 'town', snowFrac: 0, fog: 0, pat: PATTERN.default, phase: PH_TOWN, grad: 0, lo: Math.floor(PH_TOWN), b: 0, townK: 1 });
  // ---- the place's landform (world.js regions and height): category, snow fraction (mountains: 0 below the snow line, 1 above, sleet in between) and the
  // fog share of foggy places (1 in forests, eased out over the last FOG_BAND metres of the coast and river limits and over the last metre below the mountains)
  function landform(lon, lat) {
    const reg = W.regionAt(lon, lat), kind = reg.kind;
    if (kind === 'ice-north' || kind === 'ice-south') return { cat: 'ice', kind, snowFrac: 0, fog: 0 };
    if (kind === 'desert' || kind === 'lava') return { cat: kind, kind, snowFrac: 0, fog: 0 };
    if (kind === 'town') return { cat: 'default', kind, snowFrac: 0, fog: 0 };
    const h = W.height(lon, lat), line = W.arcDistance({ lon, lat }, PEAK) < 30 ? 20 : 18;
    if (h >= line - 1.5) return { cat: 'mountain', kind, snowFrac: smooth(line - 0.8, line + 0.8, h), fog: 0 };   // sleet band: +-0.8 m of height (W8b; under 1 m across on the steepest slopes)
    let fog = Math.max(kind === 'forest' ? 1 : 0, reg.zone !== 'building' ? smooth(24, 24 - FOG_BAND, W.coastDistance(lon, lat)) : 0, smooth(10, 10 - FOG_BAND, W.riverCrossing(lon, lat)));
    if (fog > 0) fog *= 1 - smooth(line - 2.5, line - 1.5, h);
    return { cat: fog > 0 ? 'foggy' : 'default', kind, snowFrac: 0, fog };
  }
  // exact coordinates (longitude wrapped to (-180, 180]), so the result never depends on which query came first; the cache only saves work
  const cache = new Map();
  function place(lon, lat) {
    lon = wrapLon(+lon); lat = Math.max(-90, Math.min(90, +lat));
    const key = lon + ',' + lat; let p = cache.get(key); if (p) return p;
    const lf = landform(lon, lat), f = field(lon, lat);
    p = Object.freeze({ ...lf, pat: PATTERN[lf.cat], phase: f.phase, grad: f.grad, lo: f.lo, b: f.b, townK: smooth(0, TOWN_BAND, W.townPatchDistance(lon, lat)) });
    if (cache.size >= CACHE) cache.clear(); cache.set(key, p); return p;
  }
  // a state at a place, moved to the nearest allowed one (W8_SPEC 4.2, also the lock fallback): on the ice rain is snow and the rest clear; on mountains rain
  // and snow are one precipitation split by the snow fraction; snow elsewhere is rain (never in the town); fog only where the place is foggy, else after-rain
  function addState(p, s, k, w) {
    if (!(k > 0)) return;
    if (p.cat === 'ice') s = s === 'rain' || s === 'snow' ? 'snow' : 'clear';
    else if (s === 'rain' || s === 'snow') { if (p.cat === 'mountain' && p.snowFrac > 0) { w.rain += k * (1 - p.snowFrac); w.snow += k * p.snowFrac; return; } s = 'rain'; }
    else if (s === 'fog' && !(p.fog > 0)) s = 'after';
    w[s] += k;
  }
  // one slot of the place's pattern shifted by phase j; the foggy pattern mixes with the default one by the fog share
  function addSlot(p, j, slot, k, w) {
    if (!(k > 0)) return;
    if (slot <= 0) return addState(p, BASE[p.cat], k, w);
    const i = slot - 1 + j;
    if (p.cat === 'foggy' && p.fog < 1) { addState(p, LETTER[PATTERN.foggy[mod(i, PATTERN.foggy.length)]], k * p.fog, w); addState(p, LETTER[PATTERN.default[mod(i, PATTERN.default.length)]], k * (1 - p.fog), w); }
    else addState(p, LETTER[p.pat[mod(i, p.pat.length)]], k, w);
  }
  const zero = () => ({ rain: 0, after: 0, overcast: 0, clear: 0, snow: 0, fog: 0 });
  const slotWeights = (p, slot) => { const w = zero(); addSlot(p, p.lo, slot, 1 - p.b, w); addSlot(p, p.lo + 1, slot, p.b, w); return w; };
  const normalise = w => { let sum = 0; for (const s of STATES) sum += w[s]; for (const s of STATES) w[s] /= sum; return w; };
  let locked = null;
  // the weights of one place at time t, and the weights once the current fade is over
  function own(p, slot, into) {
    if (locked) { const w = zero(); if (locked === 'fog') { addState(p, 'fog', p.fog, w); addState(p, 'after', 1 - p.fog, w); } else addState(p, locked, 1, w); return { w, target: w, fading: false }; }
    const target = slotWeights(p, slot); if (!(slot > 0 && into < FADE)) return { w: target, target, fading: false };
    const prev = slotWeights(p, slot - 1), k = into / FADE, w = zero(); for (const s of STATES) w[s] = prev[s] * (1 - k) + target[s] * k;
    return { w, target, fading: STATES.some(s => prev[s] !== target[s]) };
  }
  function sample(lon, lat, t) {
    const p = place(lon, lat), time = Math.max(0, +t || 0), slot = Math.floor(time / SLOT), into = time - slot * SLOT;
    let q = own(p.townK < 1 ? TOWN : p, slot, into);
    if (p.townK > 0 && p.townK < 1) { const o = own(p, slot, into), k = p.townK, w = zero(), target = zero(); for (const s of STATES) { w[s] = q.w[s] * (1 - k) + o.w[s] * k; target[s] = q.target[s] * (1 - k) + o.target[s] * k; } q = { w, target, fading: q.fading || o.fading }; }
    const w = normalise({ ...q.w }), target = normalise({ ...q.target });
    let state = 'rain', best = -1; for (const s of STATES) if (w[s] > best) { best = w[s]; state = s; }
    return { weights: w, state, category: p.cat, kind: p.kind, slot, fadeLeft: q.fading ? FADE - into : 0, target };
  }
  return {
    at: sample, sample, place,
    effectsAt: (lon, lat, t) => effectsOf(sample(lon, lat, t).weights),
    lock(s) { locked = s && STATES.includes(s) ? s : null; return locked; }, locked: () => locked,
    clearCache() { cache.clear(); }, cacheSize: () => cache.size,
  };
}
// distance blend: 1 near (camera height h <= 40 m), 0 at the panorama (h >= 120 m)
const wLocal = h => 1 - smooth(40, 120, h);
const WEATHER = { SLOT, FADE, SEED, PHASES, BAND, MIX_MIN, FOG_BAND, TOWN_BAND, STATES, PATTERN, EFFECT, EFFECTS, make, effectsOf, wLocal, smooth };
if (typeof module !== 'undefined' && module.exports) module.exports = WEATHER;
else global.WEATHER = WEATHER;
})(typeof globalThis !== 'undefined' ? globalThis : this);
