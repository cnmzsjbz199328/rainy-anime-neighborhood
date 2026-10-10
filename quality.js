// W8g-d (W8_SPEC 13.4, D14): quality tiers. Two tiers, high and low, and auto. A tier has three parameters only: the density of the land cover's
// instances (a deterministic thinning by instance hash, no scaling), the pixel thresholds of the near / far display (W8g-c C2)
// and the detail of the canopy groups. (W10a: the town's default view shows the land cover around the town too, so the tiers differ there as well.)
// Choice: the URL (?quality=high|low|auto) first, then a tier a test tool put in window.__QUALITY before the page ran, else auto.
// auto: the frame intervals of the first 90 frames of the default view (W10a: the complete world, the first frame comes after the start-up build); a median
// above 20 ms picks low. While running, it only steps down (never up), and only when the camera has not moved for 5 s and the median of those 5 s is
// above 25 ms.
// No THREE, no DOM beyond location.
(function (global) {
'use strict';
const TIERS = {
  high: { density: 1, nearFar: [36, 44], farCanopy: [5, 7], fadeOut: [1.5, 2.5], canopyDetail: 1 },
  // low only takes away: half the instances (trees too) by hash, the small things fade out a pixel earlier, 8-face canopy groups; the hand-over thresholds
  // between models stay those of high, so every mesh the low tier draws is one the high tier draws as well (no more draw calls than high)
  low: { density: 0.5, nearFar: [36, 44], farCanopy: [5, 7], fadeOut: [2.5, 3.5], canopyDetail: 0 },
};
const AUTO = { probeFrames: 90, probeMs: 20, dropMs: 25, dropWindowMs: 5000 };
const NAMES = ['high', 'low', 'auto'];
const QUALITY = { TIERS, AUTO };
QUALITY.create = function () {
  let url = null; try { url = new URLSearchParams(global.location ? global.location.search : '').get('quality'); } catch (e) { url = null; }
  const hook = global.__QUALITY, mode = NAMES.includes(url) ? url : NAMES.includes(hook) ? hook : 'auto';
  const S = { mode, source: NAMES.includes(url) ? 'url' : NAMES.includes(hook) ? 'hook' : 'default', tier: mode === 'low' ? 'low' : 'high', decided: mode !== 'auto',
    probe: [], probeMedianMs: null, dropped: null, changes: [] };
  const listeners = [];
  const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
  function setTier(t, why) { if (t === S.tier || !TIERS[t]) return; S.tier = t; S.changes.push({ tier: t, why, at: Date.now() }); for (const f of listeners) f(t); }
  let last = null, still = [], camKey = '';
  return {
    state: S,
    tier: () => S.tier,
    params: () => TIERS[S.tier],
    onChange(f) { listeners.push(f); },
    // called after every rendered frame with its timestamp (ms) and the camera; the first frames of the town are the probe of auto
    frame(t, camera) {
      const dt = last === null ? null : t - last; last = t; if (dt === null || S.mode !== 'auto') return;
      if (!S.decided) { S.probe.push(dt); if (S.probe.length >= AUTO.probeFrames) { S.probeMedianMs = median(S.probe); S.decided = true; setTier(S.probeMedianMs > AUTO.probeMs ? 'low' : 'high', 'probe'); } return; }
      if (S.tier === 'low') return;                                    // never steps up
      const e = camera.matrixWorld.elements, key = e.join(',');
      if (key !== camKey) { camKey = key; still = []; return; }        // a moving camera restarts the window
      still.push([t, dt]); while (still.length && t - still[0][0] > AUTO.dropWindowMs) still.shift();
      if (still.length > 10 && t - still[0][0] >= AUTO.dropWindowMs - 100) { const m = median(still.map(q => q[1])); if (m > AUTO.dropMs) { S.dropped = { medianMs: m, at: Date.now() }; setTier('low', 'drop'); } }
    },
  };
};
if (typeof module !== 'undefined' && module.exports) module.exports = QUALITY;
else global.QUALITY = QUALITY;
})(typeof globalThis !== 'undefined' ? globalThis : this);
