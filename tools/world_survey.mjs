// Survey maps for the planet layout (W1). Run: node tools/world_survey.mjs
// Writes docs/world/survey/: equirect.png (1920x960), view-front/east/back/west.png and view-north/south.png (1024x1024).
// Data comes from world.js only; the maps are drawn on a canvas inside Chromium (tools/browser.mjs) and saved as PNG.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChromium } from './browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const W = require(path.join(root, 'world.js'));
const outDir = path.join(root, 'docs/world/survey');
fs.mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- data for the page
const PALETTE = {
  town: '#e8b04a', farmland: '#b9c46c', village: '#e58a3a', ruin: '#a07ccb', forest: '#3f7d55', grassland: '#8fbf72', desert: '#d9c07a',
  lava: '#6a2f26', island: '#cfc48a', 'ice-north': '#e8f2fa', 'ice-south': '#e8f2fa', 'east-strait': '#4a86a8', 'west-sea': '#4a86a8', 'back-ocean': '#4a86a8',
};
const kinds = Object.keys(PALETTE);
const GRID = 0.1875, ras = W.zoneRaster(GRID);                          // 1920 x 960 cells, one per equirect pixel
const kindIdx = new Uint8Array(ras.cell.length);
for (let i = 0; i < ras.cell.length; i++) { const r = ras.cell[i] ? W.regions[ras.cell[i] - 1] : { kind: 'grassland' }; kindIdx[i] = kinds.indexOf(r.kind); }

const HG = 0.5, hnx = 720, hny = 360, hgrid = new Float32Array(hnx * hny);
for (let y = 0; y < hny; y++) for (let x = 0; x < hnx; x++) hgrid[y * hnx + x] = W.height(-180 + (x + 0.5) * HG, -90 + (y + 0.5) * HG);
const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

const NET = W.roadNetwork;
const edges = NET.edges.map(e => ({ id: e.id, cls: e.class, spans: e.spans.map(s => ({ type: s.type, a: s.fromMeters, b: s.toMeters === 'end' ? NET.edgeLength(e) : s.toMeters })), pts: NET.samplePath(e, 1.5).map(p => [p.lon, p.lat, p.s]) }));
const rivers = W.rivers.map(r => { const pts = []; for (let i = 0; i + 1 < r.points.length; i++) { const seg = W.greatCirclePoints(r.points[i], r.points[i + 1], 1.5); seg.pop(); pts.push(...seg); } pts.push(r.points[r.points.length - 1]); return { id: r.id, width: r.width, pts }; });
const nodes = NET.nodes.map(n => ({ id: n.id, lon: n.lon, lat: n.lat, kind: n.kind }));
const lms = W.landmarks.map(l => ({ id: l.id, name: l.name, lon: l.lon, lat: l.lat, r: l.radius, zone: l.zone }));
const ice = ['N', 'S'].map(h => { const r = W.regions.find(q => q.shape.hemisphere === h); const pts = []; for (let lon = -180; lon <= 180; lon += 1) pts.push([lon, r.shape.edge(lon)]); return pts; });
const patch = W.TOWN_PATCH;
const shares = W.computeAreaShares(0.25);

const payload = { PALETTE, kinds, nx: ras.nx, ny: ras.ny, kindIdx: b64(kindIdx), hnx, hny, HG, hgrid: b64(hgrid), edges, rivers, nodes, lms, ice, patch, shares: shares.zone };

// ---------------------------------------------------------------- drawing code (runs in the page)
const pageCode = `(data) => {
const D = Math.PI / 180;
const dec = (s, T) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
const kindIdx = dec(data.kindIdx, Uint8Array), hgrid = dec(data.hgrid, Float32Array);
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const pal = data.kinds.map(k => hex(data.PALETTE[k]));
const CLS = { RD01: ['#ffd23f', 3.2], RD02: ['#ff8c1a', 3.6], RD03: ['#f4f4f4', 2.4], RD04: ['#9c9c9c', 2.2], RD05: ['#d8bf94', 2.0], RD06: ['#ff6fa3', 2.2], RD07: ['#5ee6d2', 2.4], RD08: ['#c8ecff', 2.4] };

const hAt = (lon, lat) => {
  const fx = (lon + 180) / data.HG - 0.5, fy = Math.min(Math.max((lat + 90) / data.HG - 0.5, 0), data.hny - 1.001);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, nx = data.hnx;
  const g = (x, y) => hgrid[y * nx + (((x % nx) + nx) % nx)];
  return (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
};
// colour of a surface point: palette colour of the zone, depth shading for water, hill shading from the height grid
const surface = (lon, lat) => {
  lon = ((lon + 540) % 360) - 180;
  const x = Math.min(data.nx - 1, Math.floor((lon + 180) / 360 * data.nx)), y = Math.min(data.ny - 1, Math.floor((lat + 90) / 180 * data.ny));
  const k = kindIdx[y * data.nx + x], c = pal[k], h = hAt(lon, lat);
  if (k >= data.kinds.indexOf('east-strait') && k <= data.kinds.indexOf('back-ocean')) { const t = Math.min(1, -h / 6); return [c[0] * (1 - 0.55 * t), c[1] * (1 - 0.5 * t), c[2] * (1 - 0.35 * t)]; }
  const e = 0.5, cl = Math.max(0.15, Math.cos(lat * D));
  const gx = (hAt(lon + e, lat) - hAt(lon - e, lat)) / (2 * e * cl), gy = (hAt(lon, lat + e) - hAt(lon, lat - e)) / (2 * e);
  const sh = Math.min(1.35, Math.max(0.6, 1 + 0.16 * (-gx * 0.7 + gy * 0.7)));
  const lift = 1 + Math.min(0.25, Math.max(0, h) / 100);
  return [Math.min(255, c[0] * sh * lift), Math.min(255, c[1] * sh * lift), Math.min(255, c[2] * sh * lift)];
};

// contour segments from the height grid (marching squares), in lon/lat
const contours = {};
for (const level of [0, 5, 10, 15, 20, 25]) {
  const segs = [], nx = data.hnx, ny = data.hny, v = (x, y) => hgrid[y * nx + (x % nx)];
  for (let y = 0; y + 1 < ny; y++) for (let x = 0; x < nx; x++) {
    const a = v(x, y), b = v(x + 1, y), c = v(x + 1, y + 1), d = v(x, y + 1);
    const idx = (a > level) | ((b > level) << 1) | ((c > level) << 2) | ((d > level) << 3);
    if (idx === 0 || idx === 15) continue;
    const lon = -180 + (x + 0.5) * data.HG, lat = -90 + (y + 0.5) * data.HG, g = data.HG;
    const t = (p, q) => (level - p) / (q - p);
    const E = { b: [lon + g * t(a, b), lat], r: [lon + g, lat + g * t(b, c)], t: [lon + g * t(d, c), lat + g], l: [lon, lat + g * t(a, d)] };
    const table = { 1: ['l', 'b'], 2: ['b', 'r'], 3: ['l', 'r'], 4: ['r', 't'], 5: ['l', 't', 'b', 'r'], 6: ['b', 't'], 7: ['l', 't'], 8: ['l', 't'], 9: ['b', 't'], 10: ['l', 'b', 'r', 't'], 11: ['r', 't'], 12: ['l', 'r'], 13: ['b', 'r'], 14: ['l', 'b'] };
    const p = table[idx];
    for (let i = 0; i < p.length; i += 2) segs.push([E[p[i]], E[p[i + 1]]]);
  }
  contours[level] = segs;
}

const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const edgeDash = (ctx, sp) => { ctx.setLineDash(sp); };

// projections: return [px, py, visible]
const equirect = (W_, H_) => (lon, lat) => [((lon + 180) / 360) * W_, ((90 - lat) / 180) * H_, true];
const ortho = (lon0, lat0, cx, cy, rad) => (lon, lat) => {
  const dl = (lon - lon0) * D, f = lat * D, f0 = lat0 * D;
  const cosc = Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(dl);
  const x = Math.cos(f) * Math.sin(dl), y = Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(dl);
  return [cx + rad * x, cy - rad * y, cosc > 0.02];
};

const strokePath = (ctx, pts, proj, wrap) => {
  let open = false, prev = null;
  for (const p of pts) {
    const q = proj(p[0], p[1]);
    if (!q[2] || (wrap && prev && Math.abs(p[0] - prev[0]) > 180)) { if (open) { ctx.stroke(); open = false; } prev = p; if (!q[2]) continue; }
    if (!open) { ctx.beginPath(); ctx.moveTo(q[0], q[1]); open = true; } else ctx.lineTo(q[0], q[1]);
    prev = p;
  }
  if (open) ctx.stroke();
};

function overlays(ctx, proj, wrap, opts) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // graticule
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([]);
  for (let lon = -180; lon <= 180; lon += 30) { const pts = []; for (let lat = -90; lat <= 90; lat += 2) pts.push([lon, lat]); strokePath(ctx, pts, proj, false); }
  for (let lat = -60; lat <= 60; lat += 30) { const pts = []; for (let lon = -180; lon <= 180; lon += 2) pts.push([lon, lat]); strokePath(ctx, pts, proj, false); }
  if (opts.equirect) {
    ctx.font = 'bold 12px sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,12,22,0.9)'; ctx.fillStyle = '#fff';
    for (let lon = -150; lon <= 150; lon += 30) { const q = proj(lon, -90); ctx.strokeText(lon + '°', q[0] + 3, opts.h - 6); ctx.fillText(lon + '°', q[0] + 3, opts.h - 6); }
    for (let lat = -60; lat <= 60; lat += 30) { const q = proj(-180, lat); ctx.strokeText(lat + '°', 4, q[1] - 3); ctx.fillText(lat + '°', 4, q[1] - 3); }
  }
  // contours
  for (const level of [5, 10, 15, 20, 25]) {
    ctx.strokeStyle = level >= 20 ? 'rgba(40,20,10,0.75)' : 'rgba(40,30,20,0.4)'; ctx.lineWidth = level >= 20 ? 1.2 : 0.8;
    ctx.beginPath();
    for (const [a, b] of contours[level]) { const p = proj(a[0], a[1]), q = proj(b[0], b[1]); if (p[2] && q[2] && Math.abs(a[0] - b[0]) < 5) { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); } }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(15,25,40,0.85)'; ctx.lineWidth = 1.3; ctx.beginPath();           // coastline
  for (const [a, b] of contours[0]) { const p = proj(a[0], a[1]), q = proj(b[0], b[1]); if (p[2] && q[2] && Math.abs(a[0] - b[0]) < 5) { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); } }
  ctx.stroke();
  // ice cap edges
  ctx.strokeStyle = '#3f78c0'; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]);
  for (const e of data.ice) strokePath(ctx, e, proj, wrap);
  ctx.setLineDash([]);
  // town patch
  { const P = data.patch, ring = []; for (let lon = P.lonMin; lon <= P.lonMax; lon += 2) ring.push([lon, P.latMax]); ring.push([P.lonMax, P.latMax]); for (let lat = P.latMax; lat >= P.latMin; lat -= 2) ring.push([P.lonMax, lat]); ring.push([P.lonMax, P.latMin]);
    for (let lon = P.lonMax; lon >= P.lonMin; lon -= 2) ring.push([lon, P.latMin]); ring.push([P.lonMin, P.latMin]); for (let lat = P.latMin; lat <= P.latMax; lat += 2) ring.push([P.lonMin, lat]); ring.push([P.lonMin, P.latMax]);
    ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = 1.6; strokePath(ctx, ring, proj, false); }
  // rivers
  for (const r of data.rivers) { ctx.strokeStyle = '#1b5fa8'; ctx.lineWidth = 2.6; strokePath(ctx, r.pts, proj, wrap); ctx.strokeStyle = '#7fc4ff'; ctx.lineWidth = 1.2; strokePath(ctx, r.pts, proj, wrap); }
  // roads: dark casing first, then the class colour; bridges wider, tunnels dashed, stairs dotted
  for (const pass of ['case', 'fill']) for (const e of data.edges) {
    const [col, w] = CLS[e.cls];
    const segs = []; let cur = null;
    for (const p of e.pts) { const sp = e.spans.find(s => p[2] >= s.a - 1e-6 && p[2] <= s.b + 1e-6); const t = sp ? sp.type : null; if (!cur || cur.t !== t) { cur = { t, pts: [] }; segs.push(cur); if (segs.length > 1) cur.pts.push(segs[segs.length - 2].pts[segs[segs.length - 2].pts.length - 1]); } cur.pts.push(p); }
    for (const s of segs) {
      const k = opts.scale || 1, bw = (s.t === 'bridge' || s.t === 'boardwalk') ? 1.6 : 1;
      if (pass === 'case') { ctx.strokeStyle = 'rgba(10,14,24,0.9)'; ctx.lineWidth = (w * bw + 2.4) * k; ctx.setLineDash([]); }
      else { ctx.strokeStyle = s.t === 'tunnel' ? '#2a2a2a' : col; ctx.lineWidth = w * bw * k; ctx.setLineDash(s.t === 'tunnel' ? [4, 3] : s.t === 'stairs' ? [2, 3] : s.t === 'boardwalk' ? [1, 0] : []); }
      strokePath(ctx, s.pts, proj, wrap);
    }
  }
  ctx.setLineDash([]);
  // nodes
  for (const n of data.nodes) {
    const q = proj(n.lon, n.lat); if (!q[2]) continue;
    ctx.beginPath(); ctx.arc(q[0], q[1], n.kind === 'town-exit' ? 3.2 : n.kind === 'landmark-entrance' ? 3.4 : 2.4, 0, 7);
    ctx.fillStyle = n.kind === 'town-exit' ? '#ffffff' : n.kind === 'landmark-entrance' ? '#ff4d6d' : n.kind === 'endpoint' ? '#bbbbbb' : '#222'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  // landmarks: footprint circle, marker, label
  ctx.font = (opts.font || 13) + 'px sans-serif';
  for (const l of data.lms) {
    const q = proj(l.lon, l.lat); if (!q[2]) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath();
    const ring = []; for (let a = 0; a <= 360; a += 15) { const f = l.lat * D, th = a * D, dr = l.r / 90, f2 = Math.asin(Math.sin(f) * Math.cos(dr) + Math.cos(f) * Math.sin(dr) * Math.cos(th)), l2 = l.lon * D + Math.atan2(Math.sin(th) * Math.sin(dr) * Math.cos(f), Math.cos(dr) - Math.sin(f) * Math.sin(f2)); ring.push([l2 / D, f2 / D]); }
    strokePath(ctx, ring, proj, wrap);
    ctx.beginPath(); ctx.moveTo(q[0], q[1] - 6); ctx.lineTo(q[0] + 5, q[1] + 4); ctx.lineTo(q[0] - 5, q[1] + 4); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    const label = l.id === 'TOWN' ? 'TOWN 雨音街角' : l.id + ' ' + l.name, off = (opts.labelOff && opts.labelOff[l.id]) || [8, -8];
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(8,12,22,0.9)'; ctx.strokeText(label, q[0] + off[0], q[1] + off[1]); ctx.fillStyle = '#fff'; ctx.fillText(label, q[0] + off[0], q[1] + off[1]);
  }
}

const legend = (ctx, x, y) => {
  const rows = [['town', '城镇'], ['farmland', '农田'], ['village', '村落'], ['ruin', '遗迹'], ['forest', '森林'], ['grassland', '草原'], ['desert', '沙漠'], ['lava', '熔岩原'], ['ice-north', '冰盖'], ['east-strait', '海洋']];
  ctx.fillStyle = 'rgba(8,12,22,0.86)'; ctx.fillRect(x - 8, y - 18, 440, Math.ceil(rows.length / 2) * 17 + 4 * 17 + 62); ctx.font = '12px sans-serif';
  rows.forEach((r, i) => { const cx = x + (i % 2) * 96, cy = y + Math.floor(i / 2) * 17; ctx.fillStyle = data.PALETTE[r[0]]; ctx.fillRect(cx, cy - 10, 14, 11); ctx.fillStyle = '#fff'; ctx.fillText(r[1], cx + 20, cy); });
  const base = y + Math.ceil(rows.length / 2) * 17 + 6;
  Object.entries(CLS).forEach(([k, v], i) => { const cx = x + (i % 2) * 140, cy = base + Math.floor(i / 2) * 17; ctx.strokeStyle = v[0]; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx + 22, cy - 4); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(k, cx + 28, cy); });
  const by = base + 4 * 17 + 4; ctx.fillStyle = '#ddd'; ctx.fillText('粗线 = 桥/栈道；虚线 = 隧道；点线 = 石阶；白点 = 城镇出口；红点 = 地标入口', x - 2, by);
  ctx.fillText('等高线 5 / 10 / 15 / 20 / 25 m；虚线蓝白 = 冰盖边缘；1° ≈ 1.57 m', x - 2, by + 16);
};

const out = {};
// ---- equirect
{
  const w = 1920, h = 960, c = makeCanvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = surface(-180 + (x + 0.5) * 360 / w, 90 - (y + 0.5) * 180 / h), i = (y * w + x) * 4; img.data[i] = s[0]; img.data[i + 1] = s[1]; img.data[i + 2] = s[2]; img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  overlays(ctx, equirect(w, h), true, { equirect: true, h, scale: 1, font: 14, labelOff: { LM02: [-120, -10], LM10: [8, 22], LM04: [8, 22], LM03: [8, 20], LM06: [8, 20], LM09: [-130, 20], LM08: [8, -10], LM05: [-150, -10] } });
  legend(ctx, 14, 52);
  ctx.fillStyle = 'rgba(8,12,22,0.9)'; ctx.fillRect(0, 0, 560, 30); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('星球布局 v1 勘探图 · 等距圆柱（R = 90 m，1° ≈ 1.57 m）', 12, 22);
  out['equirect.png'] = c.toDataURL('image/png');
}
// ---- orthographic hemispheres and polar views
const VIEWS = [['view-front', 0, 0, '正面 FRONT  中心 (0°, 0°)'], ['view-east', 90, 0, '东 EAST  中心 (0°, 90°E)'], ['view-back', 180, 0, '背面 BACK  中心 (0°, 180°)'], ['view-west', -90, 0, '西 WEST  中心 (0°, 90°W)'], ['view-north', 0, 90, '北极 NORTH  经度 0° 在下方'], ['view-south', 0, -90, '南极 SOUTH  经度 0° 在上方']];
for (const [name, lon0, lat0, title] of VIEWS) {
  const S = 1024, rad = 480, cx = 512, cy = 520, c = makeCanvas(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, S, S);
  const img = ctx.getImageData(0, 0, S, S), f0 = lat0 * D;
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = (px - cx) / rad, y = (cy - py) / rad, rho = Math.hypot(x, y);
    if (rho > 1) continue;
    const cc = Math.asin(rho), sc = Math.sin(cc), cosc = Math.cos(cc);
    const lat = rho < 1e-9 ? lat0 : Math.asin(cosc * Math.sin(f0) + (y * sc * Math.cos(f0)) / rho) / D;
    const lon = lon0 + Math.atan2(x * sc, rho * Math.cos(f0) * cosc - y * Math.sin(f0) * sc) / D;
    const s = surface(lon, lat), dark = 0.35 + 0.65 * Math.pow(cosc, 0.45), i = (py * S + px) * 4;
    img.data[i] = s[0] * dark; img.data[i + 1] = s[1] * dark; img.data[i + 2] = s[2] * dark; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  overlays(ctx, ortho(lon0, lat0, cx, cy, rad), false, { scale: 1.1, font: 14, labelOff: { LM02: [-130, -10], LM09: [-130, 20], LM04: [8, 20], LM05: [-120, -12], LM06: [8, 20], LM03: [8, 20], LM10: [8, 22], LM08: [8, -12] } });
  ctx.strokeStyle = '#d9e4f2'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, rad + 1, 0, 7); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(title, 16, 30);
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#c8d4e6'; ctx.fillText('正射半球；圆盘外为背向半球。等高线 5–25 m，粗线 = 桥/栈道，虚线 = 隧道', 16, 1010);
  out[name + '.png'] = c.toDataURL('image/png');
}
return out;
}`;

const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.setContent('<!doctype html><html><body></body></html>');
  const out = await page.evaluate(`(${pageCode})(${JSON.stringify(payload)})`);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  for (const [name, url] of Object.entries(out)) {
    fs.writeFileSync(path.join(outDir, name), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote docs/world/survey/' + name);
  }
} finally { await browser.close(); }
