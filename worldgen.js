// W8g-a (W8_SPEC 13.1 A4, D14): one scheduler for everything the planet builds after the town. The deferred modules hand over their stepped builds
// (TERRAIN.job) in their old creation order with explicit dependencies: the land beyond the ring, the sampler index, the W4 section, the road network,
// the ocean, the land cover, the landmarks; last come the shader programs of all of it. Once the town's first frame has been
// on screen for a second the scheduler steps them in idle time, in slices of at most 50 ms of steps (one step is meant to stay under 150 ms). Nothing it
// builds is shown: each module's own visibility rule is applied the moment its build ends, so the picture of the town does not change, and the objects
// are created in the order the old on-demand builds created them (scene graph order matters for the drawing order of transparent things).
// Leaving the town before it is done needs nothing here: the modules' ensure() run the rest of their jobs synchronously (stats: 'sync').
// No THREE, no DOM beyond requestIdleCallback / setTimeout; the GPU step is a callback.
(function (global) {
'use strict';
const SLICE_MS = 50, START_DELAY_MS = 1000;
const WORLDGEN = {};
// opts.steps: [{ name, deps: [names], job (TERRAIN.job), after () (optional, once the job is done) }] in order; opts.gpu: [() => promise|void, ...] one per step
WORLDGEN.create = function (opts) {
  const steps = opts.steps.map(s => ({ ...s, deps: s.deps || [], ran: 0, ms: 0, by: null, afterDone: false }));
  const gpu = { list: opts.gpu || [], next: 0, ms: [], pending: 0, readyAt: null };
  const S = { firstFrameAt: null, startAt: null, doneAt: null, started: false, done: false, slices: [], longestStep: null, auto: opts.auto !== false };
  const gate = opts.gate || (() => true);          // W8g-d: auto quality measures the town's first 90 frames; the background work waits for it (explicit tiers: no wait)
  const now = () => Date.now(), byName = Object.fromEntries(steps.map(s => [s.name, s]));
  const sum = a => a.reduce((x, y) => x + y, 0);
  // a job finished outside the scheduler (a module's ensure()): the steps it ran itself are the scheduler's, the rest was synchronous
  function settle(s) {
    if (!s.job.done || s.afterDone) return;
    s.afterDone = true; if (!s.by) s.by = s.ran === s.job.stats.length ? 'idle' : 'sync';
    s.syncMs = sum(s.job.stats.slice(s.ran));
    if (s.after) s.after();
  }
  const ready = s => s.deps.every(d => byName[d].job.done);
  function nextStep() { for (const s of steps) { settle(s); if (!s.job.done && ready(s)) return s; } return null; }
  // the expected length of the next piece of work: the job's previous step (a slice does not start a step that would end past its budget)
  function estimate() { const s = nextStep(); if (s) return s.job.stats.length ? s.job.stats[s.job.stats.length - 1] : 0; return gpu.ms.length ? gpu.ms[gpu.ms.length - 1] : 0; }
  // one step of work: a job step, or one GPU root; false when everything is done
  function work() {
    const s = nextStep();
    if (s) {
      const t = now(); s.job.step(); s.ran++; const ms = now() - t; s.ms += ms;
      if (!S.longestStep || ms > S.longestStep.ms) S.longestStep = { name: s.name, step: s.ran, ms };
      settle(s); return true;
    }
    if (gpu.next < gpu.list.length) {
      const t = now(), p = gpu.list[gpu.next++](); gpu.ms.push(now() - t);
      if (p && p.then) { gpu.pending++; p.then(() => { if (--gpu.pending === 0 && gpu.next >= gpu.list.length) gpu.readyAt = now(); }); }
      else if (gpu.pending === 0 && gpu.next >= gpu.list.length) gpu.readyAt = now();
      return true;
    }
    return false;
  }
  const idle = global.requestIdleCallback ? cb => global.requestIdleCallback(cb, { timeout: 120 }) : cb => setTimeout(cb, 0);   // Safari: no requestIdleCallback
  function slice() {
    const t0 = now(); let n = 0;
    while (now() - t0 < SLICE_MS) { if (n && now() - t0 + estimate() > SLICE_MS) break; if (!work()) break; n++; }
    if (n) S.slices.push(now() - t0);
    if (nextStep() || gpu.next < gpu.list.length) idle(slice);
    else { S.done = true; S.doneAt = now(); }
  }
  function start() { if (S.started) return; S.started = true; S.startAt = now(); idle(slice); }
  return {
    state: S,
    // called by scene.js after every rendered frame: the first one starts the clock
    frame() { if (S.firstFrameAt === null) { S.firstFrameAt = now(); const go = () => (gate() ? start() : setTimeout(go, 100)); if (S.auto) setTimeout(go, START_DELAY_MS); } },
    start,
    // finish everything now (tools); the GPU promises may still be pending
    finish() { while (work()); for (const s of steps) settle(s); if (!S.done) { S.done = true; S.doneAt = now(); } },
    stats() {
      for (const s of steps) settle(s);
      return { started: S.started, done: S.done, startDelayMs: START_DELAY_MS, sliceBudgetMs: SLICE_MS, startAt: S.startAt, doneAt: S.doneAt, firstFrameAt: S.firstFrameAt,
        slices: S.slices.length, longestSliceMs: S.slices.length ? Math.max(...S.slices) : 0, longestStep: S.longestStep,
        steps: steps.map(s => ({ name: s.name, done: s.job.done, by: s.by, steps: s.job.stats.length, ms: sum(s.job.stats), longestMs: s.job.stats.length ? Math.max(...s.job.stats) : 0, syncMs: s.syncMs || 0 })),
        gpu: { roots: gpu.list.length, compiled: gpu.next, ms: gpu.ms, readyAt: gpu.readyAt } };
    },
  };
};
global.WORLDGEN = WORLDGEN;
})(typeof globalThis !== 'undefined' ? globalThis : this);
