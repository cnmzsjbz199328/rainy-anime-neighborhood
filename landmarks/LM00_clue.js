// The three hidden clues LM05 (star-viewing stone ring), LM06 (the half-buried monolith) and LM07 (the hexagon under the ice) pulse together (W7_SPEC section 6): one global phase,
// period 20 s. In every period LM05's stones light one after another (stone k peaks at 0.3 k s, each about 1 s long) in the first 4 s while LM06's monolith outline and LM07's
// hexagon fade in and out over the same 4 s starting at phase 0. The light is a cold cyan-white (WORLD_SPEC: the hidden clues' light) and its peak is far below any street lamp:
// peak self-light luminance = PEAK x luminance(colour) against the dimmest street lamp head (#ffe4b0, luminance 0.80): checked in tools/landmark_specific.mjs.
(function () {
'use strict';
const PERIOD = 20, WINDOW = 4, STEP = 0.3, DWELL = 1.0, PEAK = 0.22, COLOR = '#bfe8ee';
const smooth = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
globalThis.CLUE = {
  period: PERIOD, window: WINDOW, step: STEP, dwell: DWELL, peak: PEAK, color: COLOR,
  phase: t => (((t % PERIOD) + PERIOD) % PERIOD) / PERIOD,
  // 0..1 envelope of LM05's stone k at time t (a raised-cosine pulse centred at STEP * k + DWELL / 2, DWELL wide)
  stone(k, t) { const s = ((t % PERIOD) + PERIOD) % PERIOD, c = STEP * k + DWELL / 2, d = Math.abs(s - c) / (DWELL / 2); return d >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * d); },
  // 0..1 envelope of the monolith / the hexagon: fade in and out over WINDOW seconds from phase 0
  slab(t) { const s = ((t % PERIOD) + PERIOD) % PERIOD; return s >= WINDOW ? 0 : Math.sin(Math.PI * s / WINDOW) ** 2; },
  smooth,
};
})();
