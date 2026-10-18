// W10a (W10_SPEC 2.4): one start-up pipeline. The whole world is built before the first frame, behind the loading screen: the modules hand over their
// stepped builds (TERRAIN.job) with explicit dependencies (the land beyond the ring, the sampler index, the global look outlines, the
// road network, the ocean, the land cover, the landmarks) and run them in that order, one step at a time. Between steps the pipeline yields to the
// browser (a MessageChannel message: no timer clamping), so the progress bar moves and input stays alive. The first frame is the complete world.
// No THREE; the DOM only through the progress callback.
(function (global) {
'use strict';
const WORLDGEN = {};
// opts.steps: [{ name, deps: [names], label, job (TERRAIN.job) }] in order; opts.progress(fraction, label) for the loading screen
WORLDGEN.create = function (opts) {
  const steps = opts.steps, byName = Object.fromEntries(steps.map(s => [s.name, s]));
  const state = { started: false, done: false, startAt: null, doneAt: null, firstFrameAt: null, firstCompleteFrameMs: null };
  const progress = (f, label) => { if (opts.progress) opts.progress(f, label); };
  let promise = null;
  async function run() {
    const channel = new MessageChannel(); let resume = null;
    channel.port1.onmessage = () => resume();
    const yieldUI = () => new Promise(r => { resume = r; channel.port2.postMessage(0); });
    state.started = true; state.startAt = Date.now();
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      for (const d of s.deps || []) if (!byName[d] || !byName[d].job.done) throw new Error('worldgen: ' + s.name + ' needs ' + d);
      progress(i / steps.length, s.label || '正在铺设世界'); await yieldUI();
      while (!s.job.done) { s.job.step(); await yieldUI(); }
    }
    channel.port1.close(); channel.port2.close();
    state.done = true; state.doneAt = Date.now(); progress(1, '即将进入雨音街角');
  }
  return {
    state,
    // the pipeline's promise (one run, however often it is asked for)
    start() { return promise || (promise = run()); },
    // called by scene.js after every rendered frame; true for the first one (the complete world: scene.js lifts the loading screen)
    frame() { if (state.firstFrameAt !== null) return false; state.firstFrameAt = Date.now(); state.firstCompleteFrameMs = performance.now(); return true; },
    stats() {
      const sum = a => a.reduce((x, y) => x + y, 0);
      return { ...state, steps: steps.map(s => ({ name: s.name, done: s.job.done, steps: s.job.stats.length, ms: sum(s.job.stats), longestMs: Math.max(0, ...s.job.stats) })) };
    },
  };
};
global.WORLDGEN = WORLDGEN;
})(typeof globalThis !== 'undefined' ? globalThis : this);
