// W8f-b review of every place where roads meet: the 9 town exits, the 15 network junctions (abutments, bridge joints, T junctions, class changes), the 4 dead ends,
// the 12 landmark entrances and the 2 portals of the T01-05 tunnel. Run after `python3 build.py`:
//   node tools/joint_shots.mjs [--out docs/world/w8f-b/joints] [--only J-E1,N03]
// Per place three frames, the camera along the road through the place: sphere from above (day), sphere along the road, flat along the road (night);
// <out>/<id>-{sphere-top,sphere-along,flat-along}.png and contact sheets <out>/sheet-NN.jpg (two places per sheet, one per row, the centre 960 x 600 of each frame).
// Also checks that no canopy group of W8f-b (E2) stands on a road: crown radius against the half widths landcover.js keeps trees away from roads.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChromium } from './browser.mjs';
import { INIT } from './road_views.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), args = process.argv.slice(2), arg = (n, d) => { const i = args.indexOf(n); return i < 0 ? d : args[i + 1]; };
const outDir = path.resolve(root, arg('--out', 'docs/world/w8f-b/joints')), only = arg('--only') ? arg('--only').split(',') : null;
fs.mkdirSync(outDir, { recursive: true });
const browser = await launchChromium(), page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }), errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/deprecated|GPU stall|ReadPixels/.test(m.text())) errors.push(m.text()); });
await page.addInitScript(INIT); await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__scene && window.__scene.view, null, { timeout: 120000 }); await page.evaluate(() => window.__step(2));

// the places: centre (lon, lat) and the road direction through it in the flat map (dx, dz), from world.js's network
const places = await page.evaluate(() => {
  const W = window.WORLD, N = W.roadNetwork, out = [], flat = (lon, lat) => W.lonLatToTown(lon, lat);
  const along = (edge, atStart, m) => { const s = N.samplePath(edge, 1), i = Math.min(m, s.length - 1); return atStart ? s[i] : s[s.length - 1 - i]; };
  for (const nd of N.nodes) {
    const ins = N.edges.filter(e => e.to === nd.id), outs = N.edges.filter(e => e.from === nd.id), trunk = e => e.route === 'T01';
    const a = ins.find(trunk) || ins[0], b = outs.find(trunk) || outs[0];
    // from 6 m before the place to 6 m after it (one side only at an end of the network)
    const p0 = a ? along(a, false, 6) : nd, p1 = b ? along(b, true, 6) : nd, c = flat(nd.lon, nd.lat), q0 = flat(p0.lon, p0.lat), q1 = flat(p1.lon, p1.lat);
    let dx = q1.x - q0.x, dz = q1.z - q0.z; if (Math.hypot(dx, dz) < 1e-6) { dx = 1; dz = 0; }
    out.push({ id: nd.id, kind: nd.kind, lon: nd.lon, lat: nd.lat, x: c.x, z: c.z, dx, dz, edges: [...ins, ...outs].map(e => `${e.id} ${e.class}`) });
  }
  // the tunnel portals of T01-05 (spans in metres along the edge)
  const t = N.edges.find(e => e.id === 'T01-05'), sp = t.spans.find(s => s.type === 'tunnel'), S = N.samplePath(t, 0.5);
  for (const [id, m] of [['T01-05-portal-a', sp.fromMeters], ['T01-05-portal-b', sp.toMeters]]) { const k = S.findIndex(q => q.s >= m), p = S[k], q0 = flat(S[Math.max(0, k - 12)].lon, S[Math.max(0, k - 12)].lat), q1 = flat(S[Math.min(S.length - 1, k + 12)].lon, S[Math.min(S.length - 1, k + 12)].lat), c = flat(p.lon, p.lat);
    out.push({ id, kind: 'tunnel-portal', lon: p.lon, lat: p.lat, x: c.x, z: c.z, dx: q1.x - q0.x, dz: q1.z - q0.z, edges: ['T01-05 RD01'] }); }
  return out;
});
const list = places.filter(p => !only || only.includes(p.id));
const VIEWS = [['sphere-top', 'sphere', 24, 1.45], ['sphere-along', 'sphere', 16, 0.55], ['flat-along', 'flat', 16, 0.55]];
for (const [tag, mode, dist, pitch] of VIEWS) {
  await page.evaluate(mode => { const S = window.__scene; S.weather.lock('clear'); S.transition.setMode(mode); S.transition.step(3); window.__step(2); }, mode);
  for (const p of list) {
    const url = await page.evaluate(([p, dist, pitch]) => { const S = window.__scene, yaw = Math.atan2(-p.dx, -p.dz);    // the camera behind the place, looking along (dx, dz)
      S.view.set({ target: [p.x, 1.2, p.z], dist, yaw, pitch }); window.__step(10); S.renderer.render(S.scene, S.camera); return S.renderer.domElement.toDataURL('image/png'); }, [p, dist, pitch]);
    fs.writeFileSync(path.join(outDir, `${p.id}-${tag}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
}
// contact sheets: two places per sheet, the three frames of a place in one row, labelled
for (let i = 0; i < list.length; i += 2) {
  const rows = list.slice(i, i + 2).map(p => ({ label: `${p.id} (${p.kind}; ${p.edges.join(', ')})`, files: VIEWS.map(v => 'data:image/png;base64,' + fs.readFileSync(path.join(outDir, `${p.id}-${v[0]}.png`)).toString('base64')) }));
  const jpg = await page.evaluate(async rows => { const TW = 426, TH = 266, c = document.createElement('canvas'); c.width = TW * 3 + 4; c.height = rows.length * (TH + 22); const q = c.getContext('2d'); q.fillStyle = '#fff'; q.fillRect(0, 0, c.width, c.height);
    for (let r = 0; r < rows.length; r++) { q.fillStyle = '#000'; q.font = '13px sans-serif'; q.fillText(rows[r].label, 4, r * (TH + 22) + 15);
      for (let k = 0; k < 3; k++) { const im = new Image(); im.src = rows[r].files[k]; await im.decode(); q.drawImage(im, 160, 100, 960, 600, k * (TW + 2), r * (TH + 22) + 20, TW, TH); } }
    return c.toDataURL('image/jpeg', 0.9); }, rows);
  fs.writeFileSync(path.join(outDir, `sheet-${String(i / 2 + 1).padStart(2, '0')}.jpg`), Buffer.from(jpg.split(',')[1], 'base64'));
}
// canopy groups on roads: all groups are shown at panorama height; centre against every road sample (1 m), crown radius = instance scale / k
const onRoad = await page.evaluate(() => {
  const S = window.__scene, W = window.WORLD, N = W.roadNetwork, T = window.THREE, R = 90, D = Math.PI / 180;
  S.transition.setMode('sphere'); S.transition.step(3); S.view.set({ target: [0, 1.2, 0], dist: 350, yaw: 0, pitch: 1.2 }); window.__step(4); S.cover.tick(1.2, S.camera);
  const can = S.scene.getObjectByName('cover:canopy-proxy'), HW = { RD01: 4.6, RD02: 5.2, RD03: 2.4, RD04: 2.4, RD05: 1.5, RD06: 1.0, RD07: 1.0, RD08: 1.0 }, pts = [];
  for (const e of N.edges) for (const q of N.samplePath(e, 1)) pts.push([q.lon, q.lat, q.span === 'bridge' ? HW.RD02 : (HW[e.class] || 4.6), e.id]);
  const m = new T.Matrix4(), p = new T.Vector3(), sc = new T.Vector3(), qq = new T.Quaternion(), hits = []; let worst = Infinity;
  for (let i = 0; i < can.count; i++) { can.getMatrixAt(i, m); m.decompose(p, qq, sc); const lat = Math.atan(Math.sinh(-p.z / R)) / D, lon = p.x / (R * D), k = 1 / Math.cos(lat * D), r = sc.x / k;
    for (const [lo, la, hw, id] of pts) { const d = R * D * Math.hypot((((lo - lon + 540) % 360) - 180) * Math.cos(lat * D), la - lat), gap = d - hw - r; if (gap < worst) worst = gap; if (gap < 0) { hits.push({ i, lon: +lon.toFixed(2), lat: +lat.toFixed(2), r: +r.toFixed(2), edge: id, gap: +gap.toFixed(2) }); break; } } }
  return { groups: can.count, hits, worst };
});
console.log(`${onRoad.hits.length ? 'FAIL' : 'PASS'} 树冠团不压路：${onRoad.groups} 团，树冠边缘到路面边缘最小间距 ${onRoad.worst.toFixed(2)} m${onRoad.hits.length ? '；压路 ' + JSON.stringify(onRoad.hits.slice(0, 10)) : ''}`);
console.log(`截图 ${list.length} 处 × ${VIEWS.length} 张、${Math.ceil(list.length / 2)} 张总览 → ${path.relative(root, outDir)}/`);
for (const p of list) console.log(`  ${p.id}（${p.kind}）：${p.edges.join('、')}`);
if (errors.length) console.log('page errors:', errors.slice(0, 5).join(' | '));
await browser.close();
process.exitCode = onRoad.hits.length || errors.length ? 1 : 0;
