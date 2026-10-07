// Weather of the planet (W8b, D8 / ST05): a pure, deterministic function of place and time. No THREE, no DOM, no Math.random.
//   at(lon, lat, t) -> { weights: { rain, after, overcast, clear, snow, fog }, state, category }   (weights sum to 1; state = the heaviest)
// Time is cut into slots of SLOT seconds. Each place follows a fixed cyclic pattern of states for its category (the share of rain is the share of R in the
// pattern, spread evenly so that rain is always the longest state); a smooth value noise on the sphere (spatial scale about 100 m, so the 96 m town is in one
// weather) shifts the pattern's phase from place to place. At the start of every slot the previous state cross-fades into the new one over FADE seconds
// (rate 1 / 48 per second, under the 1 / 40 of W8_SPEC 4.3). Slot 0 (the first five minutes after loading) is the category's base state everywhere: rain in the
// town, so every existing check and review shot sees the town as it always was.
// Categories (W8_SPEC 4.2, from world.js): ice (snow instead of rain, never rain), desert (rain under 5 %), lava, foggy (forest, coast within 24 m, river
// valleys within 10 m: rain-after turns into fog), mountain (height >= 18 m, 20 m round ameni-dake: rain turns into snow above the snow line, sleet in a band
// across it), and the rest (town, farmland, village, ruin, grassland, island: rain, after-rain, overcast, clear; never snow).
(function (global) {
'use strict';
const SLOT = 300, FADE = 48, SEED = 0x5eed8b, R = 90, D = Math.PI / 180;
const STATES = ['rain', 'after', 'overcast', 'clear', 'snow', 'fog'];
// patterns: one letter per slot; R rain, A after-rain, O overcast, C clear, S snow, F fog
const PATTERN = {
  default:  'RARORRCRARRORCRRARCR',             // 12 R of 20 = 60 % (any 12 or more slots in a row: >= 54 %)
  foggy:    'RFRORRCRFRRARCRRFRAR',             // 12 R, 3 F, 2 A, 2 C, 1 O (R 60 %)
  mountain: 'RARORRCRARRORCRRARCR',             // as default; R above the snow line becomes S
  lava:     'RARORRCRARRORCRRARCR',
  desert:   'CCOCCACCOCCCRCCOCCACCCOCC',        // 1 R of 25 = 4 %
  ice:      'SCSCSSCSCSSCSSCSCSSC',             // 12 S, 8 C
};
const LETTER = { R: 'rain', A: 'after', O: 'overcast', C: 'clear', S: 'snow', F: 'fog' };
const BASE = { default: 'rain', foggy: 'rain', mountain: 'rain', lava: 'rain', desert: 'clear', ice: 'snow' };
const hash = (i, j, k, s) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 2147483647) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
function vnoise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const c = (a, b, d) => hash(xi + a, yi + b, zi + d, s), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function make(W) {
  const cache = new Map();
  // the place: category, the phase of its pattern, the snow fraction (mountains: 0 below the snow line, 1 above, sleet in between)
  function place(lon, lat) {
    const key = Math.round(lon * 20) + ',' + Math.round(lat * 20); let p = cache.get(key); if (p) return p;
    const reg = W.regionAt(lon, lat), h = W.height(lon, lat);
    let cat = 'default';
    if (reg.kind === 'ice-north' || reg.kind === 'ice-south') cat = 'ice';
    else if (reg.kind === 'desert') cat = 'desert';
    else if (reg.kind === 'lava') cat = 'lava';
    else if (reg.kind === 'town') cat = 'default';
    else { const peak = W.arcDistance({ lon, lat }, { lon: -25, lat: 56 }) < 30, line = peak ? 20 : 18;
      if (h >= line - 1.5) cat = 'mountain';
      else if (reg.kind === 'forest' || (W.coastDistance(lon, lat) <= 24 && reg.zone !== 'building') || W.riverCrossing(lon, lat) <= 10) cat = 'foggy'; }
    let snowFrac = 0;
    if (cat === 'mountain') { const peak = W.arcDistance({ lon, lat }, { lon: -25, lat: 56 }) < 30, line = peak ? 20 : 18; snowFrac = smooth(line - 0.8, line + 0.8, h); }   // sleet band: +-0.8 m of height (about 10 m across on the usual 8-16 % slopes)
    const cl = Math.cos(lat * D), sx = R * cl * Math.sin(lon * D) / 100, sy = R * cl * Math.cos(lon * D) / 100, sz = R * Math.sin(lat * D) / 100;
    const pat = PATTERN[cat], phase = Math.floor(vnoise3(sx * 1.0, sy * 1.0, sz * 1.0, SEED) * pat.length * 0.999);
    p = { cat, pat, phase, snowFrac, kind: reg.kind }; if (cache.size > 20000) cache.clear(); cache.set(key, p); return p;
  }
  const stateOf = (p, slot) => { if (slot <= 0) return BASE[p.cat]; const s = LETTER[p.pat[(slot - 1 + p.phase) % p.pat.length]]; return s; };
  // a state at a place as weights (rain on a mountain splits into rain and snow by the snow fraction)
  const asWeights = (p, s, k, out) => { if (s === 'rain' && p.snowFrac > 0) { out.rain += k * (1 - p.snowFrac); out.snow += k * p.snowFrac; } else out[s] += k; };
  let locked = null;
  // nearest allowed state for a locked state at a place (lock('rain') on the ice gives snow; fog only in foggy places; never snow in the town)
  function allowed(p, s) {
    if (p.cat === 'ice') return s === 'rain' || s === 'snow' ? 'snow' : 'clear';
    if (s === 'snow' && p.cat !== 'mountain') return 'rain';
    if (s === 'fog' && p.cat !== 'foggy') return 'after';
    return s;
  }
  function at(lon, lat, t) {
    const p = place(lon, lat), w = { rain: 0, after: 0, overcast: 0, clear: 0, snow: 0, fog: 0 };
    if (locked) { asWeights(p, allowed(p, locked), 1, w); }
    else {
      const tt = Math.max(0, t), slot = Math.floor(tt / SLOT), into = tt - slot * SLOT, cur = stateOf(p, slot);
      if (slot > 0 && into < FADE) { const prev = stateOf(p, slot - 1), k = into / FADE; asWeights(p, prev, 1 - k, w); asWeights(p, cur, k, w); }
      else asWeights(p, cur, 1, w);
    }
    let state = 'rain', best = -1; for (const s of STATES) if (w[s] > best) { best = w[s]; state = s; }
    return { weights: w, state, category: p.cat };
  }
  return { at, place, lock(s) { locked = s && STATES.includes(s) ? s : null; return locked; }, locked: () => locked };
}
// distance blend: 1 near (camera height h <= 40 m), 0 at the panorama (h >= 120 m)
const wLocal = h => 1 - smooth(40, 120, h);
const WEATHER = { SLOT, FADE, SEED, STATES, PATTERN, make, wLocal, smooth };
if (typeof module !== 'undefined' && module.exports) module.exports = WEATHER;
else global.WEATHER = WEATHER;
})(typeof globalThis !== 'undefined' ? globalThis : this);
