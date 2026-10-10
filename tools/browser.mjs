// Shared Playwright launcher for the layout tools. Uses a local install if present,
// otherwise the globally installed package (npm root -g).
import { execSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function launchChromium() {
  let pw;
  try {
    pw = await import('playwright');
  } catch {
    const root = execSync('npm root -g', { encoding: 'utf8' }).trim();
    pw = await import(pathToFileURL(path.join(root, 'playwright', 'index.mjs')).href);
  }
  const chromium = pw.chromium || pw.default.chromium;
  // SwiftShader keeps WebGL available on machines without a GPU (CI, containers).
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  // W8g-d (W8_SPEC 13.4 D2): the check tools always name the quality tier (quality.js reads window.__QUALITY when the URL has no ?quality=):
  // high unless QUALITY=low (or auto) is set in the environment
  // W10a: window.__scene appears only after the start-up pipeline (worldgen.js, asynchronous); the tools' INIT scripts take requestAnimationFrame over to
  // drive frames by hand, so waitForFunction polls on a 100 ms timer instead of animation frames (unless a tool asks for its own polling)
  const timerPolling = p => { const wait = p.waitForFunction.bind(p); p.waitForFunction = (fn, arg, opts = {}) => wait(fn, arg, { polling: 100, ...opts }); return p; };
  const quality = QUALITY_TIER, put = q => { window.__QUALITY = q; };
  const newPage = browser.newPage.bind(browser), newContext = browser.newContext.bind(browser);
  browser.newPage = async (...a) => { const p = await newPage(...a); await p.addInitScript(put, quality); return timerPolling(p); };
  browser.newContext = async (...a) => { const c = await newContext(...a); await c.addInitScript(put, quality); const np = c.newPage.bind(c); c.newPage = async (...b) => timerPolling(await np(...b)); return c; };
  return browser;
}
export const QUALITY_TIER = ['high', 'low', 'auto'].includes(process.env.QUALITY) ? process.env.QUALITY : 'high';
