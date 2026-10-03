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
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
