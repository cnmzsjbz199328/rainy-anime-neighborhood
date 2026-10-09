// W8g-a A1 (W8_SPEC 13.1): cold-start performance of the page, every measurement in a fresh page:
//   - navigation start -> window.__scene, -> the town's first frame;
//   - the background generation (worldgen.js): each step's time, the slices, every long task while it runs (the town keeps orbiting slowly meanwhile);
//   - cold exits: for each of the 9 town exits two fresh pages, (a) leaving as soon as the page is usable, (b) leaving once the background generation is done
//     (a build without it waits 6 s instead); the target moves frame by frame (60 frames, a drag) from the default view to 30 m beyond the exit, and the
//     longest task and the largest frame gap of the next 5 s are kept;
//   - the hot path: on page (b), back to the town and out again;
//   - the sphere button, cold: (a) at once and (b) after the background generation.
// Real GPU timing: headless Chromium with ANGLE on Metal (the GPU string is written to the result); --swiftshader for the deterministic software renderer.
//   node tools/perf_baseline.mjs [--ref pre-w8g-a] [--label <name>] [--out docs/world/perf/<label>.json] [--exits N01,N03] [--swiftshader]
// Output: docs/world/perf/<label>.json (plain text, tracked). The CPU parts compare across machines; the frame figures are this machine only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const ref = arg('--ref', null), soft = args.includes('--swiftshader');
const label = arg('--label', ref || 'current'), outFile = path.resolve(root, arg('--out', `docs/world/perf/${label}.json`));
const require = createRequire(import.meta.url), L = require(path.join(root, 'layout.js'));
const EXITS = ['N01', 'N03', 'N04', 'N08', 'N09', 'N10', 'N11', 'N12', 'N13'].filter(id => !arg('--exits') || arg('--exits').split(',').includes(id));
const WINDOW_MS = 5000, DRAG_FRAMES = 60, NO_GEN_WAIT_MS = 6000;

let pw; try { pw = await import('playwright'); } catch { const g = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(); pw = await import(pathToFileURL(path.join(g, 'playwright', 'index.mjs')).href); }
const chromium = pw.chromium || pw.default.chromium;
const flags = soft ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--use-angle=metal', '--ignore-gpu-blocklist'];

// the build to measure: the current index.html, or a git ref built in a temporary worktree
let html = path.join(root, 'index.html'), cleanup = () => {}, commit, dirty = false;
if (ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-'));
  execFileSync('git', ['worktree', 'add', '--detach', dir, ref], { cwd: root, stdio: 'pipe' });
  execFileSync('python3', ['build.py'], { cwd: dir, stdio: 'pipe' });
  html = path.join(dir, 'index.html'); commit = execFileSync('git', ['rev-parse', ref], { cwd: root, encoding: 'utf8' }).trim();
  cleanup = () => { try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root, stdio: 'pipe' }); } catch { fs.rmSync(dir, { recursive: true, force: true }); } };
} else {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
}

const INIT = `(() => {
  const P = window.__perf = { lt: [], frames: [], firstFrame: null, sceneAt: null };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { cb(ts); const t = performance.now(); P.frames.push(t); if (P.firstFrame === null) P.firstFrame = t; });
  let sc; Object.defineProperty(window, '__scene', { configurable: true, get() { return sc; }, set(v) { sc = v; P.sceneAt = performance.now(); } });
})();`;

// one browser per measurement: nothing (GPU memory, caches) carries over from one page to the next
let version = null;
async function open() {
  const browser = await chromium.launch({ args: flags }); version = version || browser.version();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }), errors = [];
  page.close = () => browser.close();
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(INIT);
  await page.goto(pathToFileURL(html).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.__perf.firstFrame !== null && window.__scene && window.__scene.view, null, { timeout: 120000, polling: 16 });
  page.errors = errors; return page;
}
const hasGen = page => page.evaluate(() => !!window.__scene.worldgen);
// wait for the background generation (orbiting the town slowly meanwhile, as a viewer would); a build without it waits NO_GEN_WAIT_MS
async function waitGen(page) {
  return page.evaluate(([noGenWait]) => new Promise(res => {
    const S = window.__scene, G = S.worldgen, t0 = performance.now(), v0 = S.view.get(); let n = 0;
    const tick = () => { n++; S.view.set({ yaw: v0.yaw + 0.002 * n }); const t = performance.now() - t0;
      if ((G && G.state.done && G.stats().gpu.readyAt) || (!G && t > noGenWait) || t > 60000) { S.view.set({ yaw: v0.yaw }); res({ waitedMs: Math.round(t), done: G ? G.state.done : null }); } else requestAnimationFrame(tick); };
    requestAnimationFrame(tick); }), [NO_GEN_WAIT_MS]);
}
// move the target frame by frame from where it is to `to` (DRAG_FRAMES frames), then keep rendering; returns the longest task and the largest frame gap in WINDOW_MS
async function drive(page, run) {
  return page.evaluate(([run, frames, windowMs]) => new Promise(res => {
    const S = window.__scene, P = window.__perf, t0 = performance.now(), from = S.view.get().target, lt0 = P.lt.length, f0 = P.frames.length;
    let n = 0;
    const step = () => {
      n++;
      if (run.kind === 'target') { const k = Math.min(1, n / frames); S.view.set({ target: [from[0] + (run.to[0] - from[0]) * k, from[1] + (run.to[1] - from[1]) * k, from[2] + (run.to[2] - from[2]) * k] }); }
      if (performance.now() - t0 < windowMs) requestAnimationFrame(step);
      else setTimeout(() => {
        const fr = P.frames.slice(f0 - 1).filter(t => t >= t0 - 100), gaps = fr.slice(1).map((t, i) => t - fr[i]), lts = P.lt.slice(lt0).filter(([s]) => s >= t0 - 1 && s < t0 + windowMs);
        const G = S.worldgen ? S.worldgen.stats() : null;
        res({ longestTaskMs: lts.length ? Math.max(...lts.map(q => q[1])) : 0, maxFrameGapMs: Math.round(Math.max(0, ...gaps)), frames: fr.length, longTasks: lts.map(([s, d]) => [Math.round(s - t0), d]),
          gen: G ? { done: G.done, sync: G.steps.filter(s => s.by === 'sync').map(s => ({ name: s.name, syncMs: s.syncMs })) } : null });
      }, 50);
    };
    if (run.kind === 'sphere') document.getElementById('map-mode-toggle').click();
    requestAnimationFrame(step);
  }), [run, DRAG_FRAMES, WINDOW_MS]);
}
const exitTarget = id => { const n = L.roadNodes.find(q => q.id === id), h = L.BASE.half, side = Math.abs(n.x) >= Math.abs(n.z) ? [Math.sign(n.x), 0] : [0, Math.sign(n.z)];
  void h; return [n.x + 30 * side[0], 1.2, n.z + 30 * side[1]]; };

const result = { tool: 'tools/perf_baseline.mjs', label, ref: ref || null, commit, dirty, date: new Date().toISOString(), renderer: soft ? 'swiftshader' : 'metal', flags, viewport: [1280, 800],
  windowMs: WINDOW_MS, dragFrames: DRAG_FRAMES, noGenWaitMs: NO_GEN_WAIT_MS, loads: [], pregen: null, exits: {}, sphere: {} };
// the machine's state (memory pressure on this machine makes the frame figures noisy: kept with the result)
const machine = () => { let swap = null; try { swap = execFileSync('sysctl', ['-n', 'vm.swapusage'], { encoding: 'utf8' }).trim(); } catch {} return { freeMemMB: Math.round(os.freemem() / 1048576), totalMemMB: Math.round(os.totalmem() / 1048576), loadAvg: os.loadavg().map(v => +v.toFixed(2)), swap }; };
result.machine = { start: machine() };
const genOf = page => page.evaluate(() => { const P = window.__perf, G = window.__scene.worldgen ? window.__scene.worldgen.stats() : null; if (!G) return { cpuMs: null, longestTaskMs: null };
  const to = G.doneAt ? performance.now() - (Date.now() - G.doneAt) : performance.now(), lts = P.lt.filter(([s]) => s > P.firstFrame + 50 && s <= to + 50);
  return { cpuMs: G.steps.reduce((a, s) => a + s.ms, 0), longestTaskMs: lts.length ? Math.max(...lts.map(q => q[1])) : 0 }; });
const loadOf = page => page.evaluate(() => ({ sceneMs: Math.round(window.__perf.sceneAt), firstFrameMs: Math.round(window.__perf.firstFrame) }));
let errors = [];
try {
  // one page for the start-up and the background generation in detail, then its own cold exit is not used
  { const page = await open(); result.loads.push(await loadOf(page));
    result.gpu = await page.evaluate(() => { const gl = window.__scene.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); });
    result.parallelShaderCompile = await page.evaluate(() => !!window.__scene.renderer.getContext().getExtension('KHR_parallel_shader_compile'));
    result.chromium = version;
    const gen = await hasGen(page), w = await waitGen(page);
    result.pregen = await page.evaluate(([gen, w]) => { const P = window.__perf, S = window.__scene, G = gen ? S.worldgen.stats() : null, from = P.firstFrame, to = G && G.doneAt ? performance.now() - (Date.now() - G.doneAt) : performance.now();
      const lts = P.lt.filter(([s]) => s > from + 50 && s <= to + 50);
      return { present: gen, waitedMs: w.waitedMs, worldgen: G, startDelayMs: G ? G.startDelayMs : null, longTasks: lts, longestTaskMs: lts.length ? Math.max(...lts.map(q => q[1])) : 0,
        moduleMs: { rest: S.terrain.stats.restBuildMs ?? null, section: S.section.state.stats.buildMs ?? null, roads: S.roads.state.stats.buildMs ?? null, ocean: S.ocean.state.stats.buildMs ?? null, cover: S.cover.state.stats.buildMs ?? null, landmarks: S.landmarks.info.buildMs ?? null } }; }, [gen, w]);
    errors.push(...page.errors); await page.close(); }
  for (const id of EXITS) {
    const to = exitTarget(id), r = {};
    { const page = await open(); result.loads.push(await loadOf(page)); r.immediate = await drive(page, { kind: 'target', to }); errors.push(...page.errors); await page.close(); }
    { const page = await open(); result.loads.push(await loadOf(page)); const w = await waitGen(page); await page.waitForTimeout(500);
      const gen = await genOf(page);                                 // every page (b) also records its own background generation (the medians are more robust)
      r.afterPregen = { waitedMs: w.waitedMs, genCpuMs: gen.cpuMs, genLongestTaskMs: gen.longestTaskMs, ...(await drive(page, { kind: 'target', to })) };
      const home = await page.evaluate(() => { const v = window.__scene.view.get(); return [-7, 1.2, 20]; }); await drive(page, { kind: 'target', to: home }); await page.waitForTimeout(1000);
      r.hot = await drive(page, { kind: 'target', to }); errors.push(...page.errors); await page.close(); }
    result.exits[id] = r;
    console.log(`${id}：立即出城 最长任务 ${r.immediate.longestTaskMs} ms / 最大帧间隔 ${r.immediate.maxFrameGapMs} ms；预生成后 ${r.afterPregen.longestTaskMs} / ${r.afterPregen.maxFrameGapMs} ms；热路径 ${r.hot.longestTaskMs} / ${r.hot.maxFrameGapMs} ms`);
  }
  { const page = await open(); result.loads.push(await loadOf(page)); result.sphere.immediate = await drive(page, { kind: 'sphere' }); errors.push(...page.errors); await page.close(); }
  { const page = await open(); result.loads.push(await loadOf(page)); await waitGen(page); await page.waitForTimeout(500); result.sphere.afterPregen = await drive(page, { kind: 'sphere' }); errors.push(...page.errors); await page.close(); }
  console.log(`球形按钮：立即 最长任务 ${result.sphere.immediate.longestTaskMs} ms / 最大帧间隔 ${result.sphere.immediate.maxFrameGapMs} ms；预生成后 ${result.sphere.afterPregen.longestTaskMs} / ${result.sphere.afterPregen.maxFrameGapMs} ms`);
} finally { cleanup(); }
const ex = Object.values(result.exits), max = (list, f) => list.length ? Math.max(...list.map(f)) : null, med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
result.summary = {
  sceneMsMedian: med(result.loads.map(q => q.sceneMs)), firstFrameMsMedian: med(result.loads.map(q => q.firstFrameMs)),
  pregenCpuMs: result.pregen.worldgen ? result.pregen.worldgen.steps.reduce((a, s) => a + s.ms, 0) : null,
  pregenLongestTaskMs: result.pregen.present ? result.pregen.longestTaskMs : null,
  pregenCpuMsMedian: result.pregen.present ? med(ex.map(r => r.afterPregen.genCpuMs)) : null, pregenCpuMsRange: result.pregen.present ? [Math.min(...ex.map(r => r.afterPregen.genCpuMs)), Math.max(...ex.map(r => r.afterPregen.genCpuMs))] : null,
  pregenLongestTaskMsMedian: result.pregen.present ? med(ex.map(r => r.afterPregen.genLongestTaskMs)) : null, pregenLongestTaskMsMax: result.pregen.present ? Math.max(...ex.map(r => r.afterPregen.genLongestTaskMs), result.pregen.longestTaskMs) : null,
  immediateExitLongestTaskMs: max(ex, r => r.immediate.longestTaskMs), afterPregenExitLongestTaskMs: max(ex, r => r.afterPregen.longestTaskMs), hotExitLongestTaskMs: max(ex, r => r.hot.longestTaskMs),
  immediateExitMaxFrameGapMs: max(ex, r => r.immediate.maxFrameGapMs), afterPregenExitMaxFrameGapMs: max(ex, r => r.afterPregen.maxFrameGapMs), hotExitMaxFrameGapMs: max(ex, r => r.hot.maxFrameGapMs),
  sphereImmediateLongestTaskMs: result.sphere.immediate.longestTaskMs, sphereAfterPregenLongestTaskMs: result.sphere.afterPregen.longestTaskMs,
  pageErrors: errors.length,
};
result.errors = [...new Set(errors)].slice(0, 10);
result.machine.end = machine();
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(result, null, 1) + '\n');
console.log(`GPU：${result.gpu}；提交 ${commit.slice(0, 7)}${dirty ? '（工作区有改动）' : ''}`);
console.log('摘要：' + JSON.stringify(result.summary));
console.log(`→ ${path.relative(root, outFile)}`);
