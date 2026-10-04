// Live top-down check: renders the real scene straight down with an orthographic camera in Chromium
// and overlays the layout.js outlines (curb lines, plots, curb cuts, sample bounds), so the built
// geometry can be compared with the layout data.
//
//   node tools/live_topdown.mjs      → docs/layout/live-topdown.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { launchChromium } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const L = createRequire(import.meta.url)(path.join(root, 'layout.js'));
const H = L.BASE.half;
// Whole plinth, plus a close-up of the store corner and X01 for seams and curb cuts.
const VIEWS = [
  { id: 'all', title: '实景俯视（真实场景正交渲染）+ layout.js 叠加线', win: [-H, -H, H, H], ppu: 12 },
  { id: 'x01', title: 'X01 与便利店街角局部', win: [-20, 4, 12, 36], ppu: 34 },
];

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
await page.waitForFunction(() => window.__scene && window.__scene.view);
await page.waitForTimeout(800);

const shots = {};
for (const v of VIEWS) {
  shots[v.id] = await page.evaluate(({ win, ppu }) => {
    const { scene } = window.__scene;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.22;
    const fog = scene.fog, rain = scene.children.filter(c => c.isLineSegments);
    scene.fog = null; rain.forEach(r => { r.visible = false; });
    const [x0, z0, x1, z1] = win, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const cam = new THREE.OrthographicCamera(x0 - cx, x1 - cx, cz - z0, -(z1 - cz), 1, 200);
    cam.up.set(0, 0, -1); cam.position.set(cx, 100, cz); cam.lookAt(cx, 0, cz);
    renderer.setSize(Math.round((x1 - x0) * ppu), Math.round((z1 - z0) * ppu));
    renderer.render(scene, cam);
    const png = renderer.domElement.toDataURL('image/png');
    scene.fog = fog; rain.forEach(r => { r.visible = true; }); renderer.dispose();
    return png;
  }, v);
}

// ---------- overlay ----------
const sampleRect = (s, [x0, z0, x1, z1]) => {
  const c = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => L.toWorld(s, x, z));
  return [Math.min(...c.map(p => p[0])), Math.min(...c.map(p => p[1])), Math.max(...c.map(p => p[0])), Math.max(...c.map(p => p[1]))];
};
function overlay(win, ppu) {
  const X = x => ((x - win[0]) * ppu).toFixed(1), Z = z => ((z - win[1]) * ppu).toFixed(1);
  const rect = (r, a) => `<rect x="${X(r[0])}" y="${Z(r[1])}" width="${((r[2] - r[0]) * ppu).toFixed(1)}" height="${((r[3] - r[1]) * ppu).toFixed(1)}" ${a}/>`;
  const R = L.INTERSECTION.curbRadius;
  let o = '';
  // Curb lines of the pavement islands (the curb returns as arcs).
  for (const is of L.islands) {
    const [x0, z0, x1, z1] = is.rect, r = is.round, A = (ex, ez, sweep) => `A ${R * ppu} ${R * ppu} 0 0 ${sweep} ${X(ex)} ${Z(ez)}`;
    o += `<path d="M ${X(x0 + (r.NW ? R : 0))} ${Z(z0)} L ${X(x1 - (r.NE ? R : 0))} ${Z(z0)} ${r.NE ? A(x1, z0 + R, 1) : ''} L ${X(x1)} ${Z(z1 - (r.SE ? R : 0))} ${r.SE ? A(x1 - R, z1, 1) : ''} L ${X(x0 + (r.SW ? R : 0))} ${Z(z1)} ${r.SW ? A(x0, z1 - R, 1) : ''} L ${X(x0)} ${Z(z0 + (r.NW ? R : 0))} ${r.NW ? A(x0 + R, z0, 1) : ''} Z" fill="none" stroke="#ffd34d" stroke-width="1.6" stroke-dasharray="6 4"/>`;
  }
  for (const p of L.plots) o += rect(p.rect, `fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity=".75"`) + rect(p.buildable, `fill="none" stroke="#b6f2a0" stroke-width="1" stroke-dasharray="3 3"`);
  for (const k of L.curbCuts) o += rect(k.rect, `fill="none" stroke="${k.kind === 'ramp' ? '#ff6ad5' : '#ff9a3c'}" stroke-width="1.6"`);
  for (const a of L.alleys) o += rect(a.rect, `fill="none" stroke="#e8c27a" stroke-width="1"`);
  for (const s of L.samples) for (const part of s.parts) o += rect(sampleRect(s, [part.localBounds.min[0], part.localBounds.min[2], part.localBounds.max[0], part.localBounds.max[2]]), `fill="none" stroke="${part.role === 'building' ? '#ff3b30' : '#ff9500'}" stroke-width="1.6" ${part.role === 'building' ? '' : 'stroke-dasharray="3 2"'}`);
  for (const f of L.legacyFurniture) o += `<circle cx="${X(f.slot.x)}" cy="${Z(f.slot.z)}" r="${Math.max(3, ppu * .25)}" fill="none" stroke="#c38bff" stroke-width="2"/>`;
  return o;
}
const legend = [['#ffd34d', '6 4', 'layout.js 路缘线（人行岛边界与转角圆弧）'], ['#ffffff', '', '地块边界'], ['#b6f2a0', '3 3', '可建范围'], ['#ff6ad5', '', '过街坡道'], ['#ff9a3c', '', '车辆降坡'], ['#ff3b30', '', '样板建筑实测包围盒'], ['#ff9500', '3 2', '附属设施包围盒'], ['#c38bff', '', '原街道设施位置（圆圈）']];
let html = `<html><body style="margin:0;background:#f4f1ea;font-family:'Noto Sans CJK SC','Noto Sans SC',sans-serif">`;
let width = 0, height = 0;
for (const v of VIEWS) {
  const w = Math.round((v.win[2] - v.win[0]) * v.ppu), h = Math.round((v.win[3] - v.win[1]) * v.ppu);
  html += `<div style="padding:14px 16px 4px;font-weight:800;font-size:17px;color:#273647">${v.title}（${v.ppu} px/单位，北在上）</div>`
    + `<div style="position:relative;margin:0 16px;width:${w}px;height:${h}px"><img src="${shots[v.id]}" style="position:absolute;left:0;top:0;width:${w}px;height:${h}px"><svg style="position:absolute;left:0;top:0" width="${w}" height="${h}">${overlay(v.win, v.ppu)}</svg></div>`;
  width = Math.max(width, w + 32); height += h + 44;
}
html += `<div style="padding:10px 16px 16px;font-size:13px;color:#273647">${legend.map(([c, d, t]) => `<span style="margin-right:18px;white-space:nowrap"><svg width="26" height="10"><line x1="1" y1="5" x2="25" y2="5" stroke="${c}" stroke-width="3" ${d ? `stroke-dasharray="${d}"` : ''} style="filter:drop-shadow(0 0 1px #000)"/></svg> ${t}</span>`).join('')}</div></body></html>`;
height += 70;
await page.setViewportSize({ width, height });
await page.setContent(html);
await page.waitForTimeout(300);
const out = path.join(root, 'docs', 'layout', 'live-topdown.png');
await page.screenshot({ path: out });
await browser.close();
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'page errors: none');
console.log(`wrote ${path.relative(root, out)}`);
process.exit(errors.length ? 1 : 0);
