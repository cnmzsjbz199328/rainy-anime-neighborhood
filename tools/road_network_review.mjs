#!/usr/bin/env node
// Build a review-only sheet: current global graph + town streets + proposed town ring.
// This script does not change world.js, layout.js, or the rendered scene.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = require(path.join(ROOT, 'world.js'));
const L = require(path.join(ROOT, 'layout.js'));
const outDir = path.join(ROOT, 'docs/world');
const globalImage = fs.readFileSync(path.join(outDir, 'survey/equirect-road-review-base.png')).toString('base64');
const townImage = fs.readFileSync(path.join(ROOT, 'docs/layout/topdown.png')).toString('base64');

const WMAP = 1920, HMAP = 960, MAP_Y = 84;
const TOWN = { left: 34, top: 34, size: 895, pad: 110 };
const INSET = TOWN.size + TOWN.pad * 2;
const WIDTH = 1920, LOWER_Y = 1075, HEIGHT = LOWER_Y + INSET + 76;
const font = "'Noto Sans CJK SC','PingFang SC','Microsoft YaHei',sans-serif";
const globalRouteColor = '#ffc84b';
const clsColor = {
  RD01: globalRouteColor, RD02: '#ff9c33', RD03: '#e8e4dc', RD04: '#9fa5a4',
  RD05: '#d7c39c', RD06: '#ff62a4', RD07: '#67d9a0', RD08: '#73cbe8',
};
const townColor = { R01: globalRouteColor, R02: '#62c8ff', R03: '#faf4e9', alley: '#d6b780' };
const proposed = '#fb5c9d';
const meridian = '#36d8f2';
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const svgText = (x, y, text, size = 18, fill = '#e7edf4', weight = 500, extra = '') =>
  `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(text)}</text>`;
const mx = lon => (lon + 180) / 360 * WMAP;
const my = lat => MAP_Y + (90 - lat) / 180 * HMAP;
const mapPoint = p => [mx(p.lon), my(p.lat)];
const fmt = n => Number(n).toFixed(2);

function chunkedLonLat(points) {
  const chunks = [];
  let chunk = [];
  const add = p => chunk.push(mapPoint(p));
  const flush = () => { if (chunk.length > 1) chunks.push(chunk); chunk = []; };
  if (!points.length) return chunks;
  add(points[0]);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], d = b.lon - a.lon;
    if (Math.abs(d) > 180) {
      const bAdj = b.lon + (d > 180 ? -360 : 360);
      const seam = d > 180 ? -180 : 180;
      const t = (seam - a.lon) / (bAdj - a.lon);
      const lat = a.lat + (b.lat - a.lat) * t;
      chunk.push([mx(seam), my(lat)]);
      flush();
      chunk.push([mx(-seam), my(lat)]);
      add(b);
    } else add(b);
  }
  flush();
  return chunks;
}
const dFromChunks = chunks => chunks.map(c => c.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(x)},${fmt(y)}`).join(' ')).join(' ');
const lonLatD = points => dFromChunks(chunkedLonLat(points));
const pathElement = (d, color, width, dash = '', opacity = 1, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" ${extra}/>`;

function townGeoLine(localPoints, step = 1) {
  const pts = [];
  for (let i = 0; i < localPoints.length - 1; i++) {
    const a = localPoints[i], b = localPoints[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, q = W.townToLonLat(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
      pts.push({ lon: q.lon, lat: q.lat });
    }
  }
  const a = localPoints.at(-1), q = W.townToLonLat(a.x, a.z);
  pts.push({ lon: q.lon, lat: q.lat });
  return pts;
}
function localInsetPath(points) {
  return points.map((p, i) => `${i ? 'L' : 'M'}${fmt(TOWN.pad + (p.x + 48) / 96 * TOWN.size)},${fmt(TOWN.pad + (p.z + 48) / 96 * TOWN.size)}`).join(' ');
}
const RING_HALF = 54, RING_RADIUS = 8;
function ringPoints(half = RING_HALF, radius = RING_RADIUS, steps = 8) {
  const c = half - radius, pts = [];
  const corners = [
    [c, -c, -90, 0], [c, c, 0, 90], [-c, c, 90, 180], [-c, -c, 180, 270],
  ];
  for (const [cx, cz, a0, a1] of corners) {
    for (let k = 0; k <= steps; k++) {
      const a = (a0 + (a1 - a0) * k / steps) * Math.PI / 180;
      pts.push({ x: cx + radius * Math.cos(a), z: cz + radius * Math.sin(a) });
    }
  }
  pts.push(pts[0]);
  return pts;
}
const ringLocal = ringPoints();
const ringGeo = ringLocal.map(p => { const q = W.townToLonLat(p.x, p.z); return { lon: q.lon, lat: q.lat }; });
const globalNorth0 = W.townToLonLat(0, -RING_HALF), globalSouth0 = W.townToLonLat(0, RING_HALF);
const globalNorth = W.townToLonLat(0, -RING_HALF - 4), globalSouth = W.townToLonLat(0, RING_HALF + 4);
const roadNode = Object.fromEntries(L.roadNodes.map(n => [n.id, n]));
const exits = L.roadNodes.filter(n => n.kind === 'edge');
function radialRingPoint(n) {
  const h = 54, eps = 1e-7;
  if (Math.abs(n.x + 48) < eps) return { x: -h, z: n.z };
  if (Math.abs(n.x - 48) < eps) return { x: h, z: n.z };
  if (Math.abs(n.z + 48) < eps) return { x: n.x, z: -h };
  return { x: n.x, z: h };
}
const arrow = `<marker id="arrowBlue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${meridian}"/></marker>`;

function ringSignedDistance(p) {
  const q = W.lonLatToTown(p.lon, p.lat);
  const dx = Math.abs(q.x) - (RING_HALF - RING_RADIUS);
  const dz = Math.abs(q.z) - (RING_HALF - RING_RADIUS);
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - RING_RADIUS;
}
function trimEdgeAtRing(edgeId) {
  const edge = W.roadNetwork.edges.find(e => e.id === edgeId);
  const samples = W.roadNetwork.samplePath(edge, 0.05);
  const crossing = samples.findIndex((p, i) => i > 0 && ringSignedDistance(p) >= 0);
  if (crossing < 1) throw new Error(`${edgeId} does not intersect the proposed CR01 boundary`);
  const start = samples[crossing];
  const local = W.lonLatToTown(start.lon, start.lat);
  const stub = samples.slice(crossing).filter(p => p.s <= start.s + 8).map(p => W.lonLatToTown(p.lon, p.lat));
  return {
    path: lonLatD(samples.slice(crossing)),
    trimMeters: start.s,
    ringLocal: { x: local.x, z: local.z },
    townStub: stub,
  };
}
const t02Plan = trimEdgeAtRing('T02-01');
const t03Plan = trimEdgeAtRing('T03-01');
const t02Candidate = t02Plan.path;
const t03Start = W.townToLonLat(0, RING_HALF);
const t03Candidate = lonLatD([
  { lon: t03Start.lon, lat: t03Start.lat },
  ...W.roadNetwork.samplePath(W.roadNetwork.edges.find(e => e.id === 'T03-01'), 0.05)
    .filter(p => p.s > t03Plan.trimMeters + 0.025),
]);
t03Plan.townStub = [{ x: 0, z: RING_HALF }, ...t03Plan.townStub.slice(1)];
if (exits.length !== 9 || ringLocal[0].x !== ringLocal.at(-1).x || ringLocal[0].z !== ringLocal.at(-1).z) {
  throw new Error('CR01 must be closed and connect all nine fixed town exits');
}

// Current retained world.js roads, shown by road class. T04/T05/T06 are excluded because
// the planning decision removes them; the review map shows the resulting network.
let globalRoads = '';
for (const e of W.roadNetwork.edges) {
  if (['T04', 'T05', 'T06'].includes(e.route)) continue;
  // T02-01/T03-01 are redrawn from their CR01 intersections below, trimming their
  // portions inside the proposed perimeter.
  if (e.id === 'T02-01' || e.id === 'T03-01') continue;
  const samples = W.roadNetwork.samplePath(e, 0.5);
  const d = lonLatD(samples);
  globalRoads += pathElement(d, '#102030', 6, '', 0.86);
  globalRoads += pathElement(d, e.route === 'T01' ? globalRouteColor : clsColor[e.class], 3.2, '', 0.98);
}

// Town street graph from layout.js: the bridge across the current gap between N03 and N01
// makes the T01 route continuous through the existing town on the review map.
let townMapRoads = '';
for (const road of L.roads) {
  const pts = road.nodes.map(id => roadNode[id]);
  const d = lonLatD(townGeoLine(pts));
  const color = townColor[road.id];
  const width = road.id === 'R01' ? 3.2 : road.id === 'R02' ? 3.3 : 2.6;
  const casing = road.id === 'R01' ? '#102030' : '#122034';
  townMapRoads += pathElement(d, casing, road.id === 'R01' ? 6 : width + 3, '', 0.9);
  townMapRoads += pathElement(d, color, width, '', 0.98);
}
for (const alley of L.alleys) {
  const d = lonLatD(townGeoLine(alley.nodes.map(id => roadNode[id])));
  townMapRoads += pathElement(d, '#122034', 3.8, '', 0.82);
  townMapRoads += pathElement(d, townColor.alley, 1.8, '', 0.96);
}

const globalRing = lonLatD(ringGeo);
const globalLinks = exits.filter(n => !['N01', 'N03'].includes(n.id)).map(n => {
  const p = radialRingPoint(n), q = W.townToLonLat(p.x, p.z), a = W.townToLonLat(n.x, n.z);
  return lonLatD([{ lon: a.lon, lat: a.lat }, { lon: q.lon, lat: q.lat }]);
}).join(' ');

function tag(lon, lat, label, fill = '#192536') {
  const [x, y] = mapPoint({ lon, lat });
  const width = Math.max(37, label.length * 11 + 14);
  return `<g transform="translate(${fmt(x - width / 2)},${fmt(y - 13)})"><rect width="${width}" height="25" rx="7" fill="${fill}" fill-opacity=".94" stroke="#f3f5f7" stroke-width="1.4"/><text x="${width / 2}" y="17" text-anchor="middle" font-family="${font}" font-size="14" font-weight="700" fill="#fff">${esc(label)}</text></g>`;
}
const routeTags = [
  [-128, 2, 'RN08'], [-112, -17, 'RN09'], [-25, 34, 'RN05'], [2, -36, 'RN06'],
  [83, -1, 'RN07'], [57, 70, 'RN10'], [8, -58, 'RN11'], [-170, -22, 'RN12'],
  [126, -13, 'RN01'], [4, 29, 'RN02'], [-5, 9, 'RN03'], [22, 34, 'RN04'],
].map(([lon, lat, label]) => tag(lon, lat, label)).join('');

// City ring and exit links are accurate in the town Mercator plane, then projected to lon/lat.
let ringOverlay = pathElement(globalRing, '#14202c', 8, '', 0.9) + pathElement(globalRing, proposed, 4.2, '', 1);
ringOverlay += pathElement(globalLinks, '#14202c', 7, '', 0.85) + pathElement(globalLinks, proposed, 3.4, '', 1);
ringOverlay += pathElement(lonLatD([{ lon: globalNorth0.lon, lat: globalNorth0.lat }, { lon: globalNorth.lon, lat: globalNorth.lat }]), meridian, 3.3, '4 7', 1, 'marker-end="url(#arrowBlue)"');
ringOverlay += pathElement(lonLatD([{ lon: globalSouth0.lon, lat: globalSouth0.lat }, { lon: globalSouth.lon, lat: globalSouth.lat }]), meridian, 3.3, '4 7', 1, 'marker-end="url(#arrowBlue)"');
const proposedRegionRoads = pathElement(t02Candidate, '#14202c', 6.3, '', 0.88) + pathElement(t02Candidate, '#54e0cf', 3.4, '', 1) +
  pathElement(t03Candidate, '#14202c', 6.3, '', 0.88) + pathElement(t03Candidate, '#54e0cf', 3.4, '', 1);

// Town inset: crop the plotting rectangle from topdown.png, surround it with 6 m clearance,
// then add the proposed rounded ring and its nine radial access connections.
let townOverlay = '';
const insetR = ringLocal.map(p => `${fmt(TOWN.pad + (p.x + 48) / 96 * TOWN.size)},${fmt(TOWN.pad + (p.z + 48) / 96 * TOWN.size)}`).join(' ');
townOverlay += `<polyline points="${insetR}" fill="none" stroke="#17222e" stroke-width="15" stroke-linejoin="round"/>`;
townOverlay += `<polyline points="${insetR}" fill="none" stroke="${proposed}" stroke-width="8" stroke-linejoin="round"/>`;
for (const n of exits) {
  const p = radialRingPoint(n);
  const d = localInsetPath([{ x: n.x, z: n.z }, p]);
  townOverlay += pathElement(d, '#17222e', 11, '', 0.8) + pathElement(d, proposed, 5.5, '12 8', 1);
}
// Highlight the actual town axes and the actual R03 cross street. These are current layout data.
for (const road of L.roads) {
  const points = road.nodes.map(id => roadNode[id]);
  const d = localInsetPath(points);
  const c = townColor[road.id], w = road.id === 'R01' || road.id === 'R02' ? 5 : 3.4;
  townOverlay += pathElement(d, '#102031', w + 5, '', 0.78) + pathElement(d, c, w, '', 0.98);
}
for (const alley of L.alleys) {
  const d = localInsetPath(alley.nodes.map(id => roadNode[id]));
  townOverlay += pathElement(d, '#102031', 5.5, '', 0.8) + pathElement(d, townColor.alley, 2.4, '', 1);
}
// M01 follows the frozen R02 axis; T03 leaves the common south junction toward LM04.
townOverlay += svgText(TOWN.pad + TOWN.size / 2 + 12, TOWN.pad + TOWN.size / 2 - 18, 'M01 / RN02', 15, meridian, 750);
townOverlay += svgText(TOWN.pad + TOWN.size / 2 + 14, TOWN.pad + TOWN.size - 8, 'T03 → LM04', 14, '#54e0cf', 700);
for (const route of [t02Plan, t03Plan]) {
  const d = localInsetPath(route.townStub);
  townOverlay += pathElement(d, '#14202c', 10, '', 0.9) + pathElement(d, '#54e0cf', 5, '', 1);
}
const exitLabels = exits.map(n => {
  const p = radialRingPoint(n), x = TOWN.pad + (p.x + 48) / 96 * TOWN.size, y = TOWN.pad + (p.z + 48) / 96 * TOWN.size;
  const labelW = 42, labelH = 22;
  let dx = 8, dy = -25;
  if (n.id === 'N04') { dx = -labelW / 2; dy = -29; }
  if (n.id === 'N08') { dx = -labelW / 2; dy = 7; }
  if (n.id === 'N01' || n.id === 'N09' || n.id === 'N11') { dx = -labelW - 8; dy = -labelH / 2; }
  if (n.id === 'N03' || n.id === 'N10' || n.id === 'N12' || n.id === 'N13') { dx = 8; dy = -labelH / 2; }
  return `<g transform="translate(${fmt(x + dx)},${fmt(y + dy)})"><rect width="${labelW}" height="${labelH}" rx="6" fill="#182433" fill-opacity=".95" stroke="${proposed}" stroke-width="1.5"/><text x="${labelW / 2}" y="15.5" text-anchor="middle" font-family="${font}" font-size="13" font-weight="700" fill="#fff">${n.id}</text></g>`;
}).join('');
const cT02 = { x: TOWN.pad + (-33.117867 + 48) / 96 * TOWN.size, y: TOWN.pad + (-54 + 48) / 96 * TOWN.size };
townOverlay += '<g transform="translate(' + fmt(cT02.x - 24) + ',' + fmt(cT02.y - 52) + ')"><rect width="55" height="21" rx="5" fill="#182433" stroke="#54e0cf"/><text x="27.5" y="14.5" text-anchor="middle" font-family="' + font + '" font-size="11" font-weight="700" fill="#fff">T02 接点</text></g>';

function legendItem(x, y, color, label, style = 'solid') {
  const dash = style === 'dash' ? '11 7' : style === 'dot' ? '3 6' : '';
  return `${pathElement(`M${x},${y - 5}L${x + 54},${y - 5}`, color, 5, dash, 1)}${svgText(x + 69, y + 1, label, 17, '#dfe7ef', 500)}`;
}

const sections = [];
sections.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<defs>${arrow}<clipPath id="townCrop"><rect x="${TOWN.pad}" y="${TOWN.pad}" width="${TOWN.size}" height="${TOWN.size}"/></clipPath></defs>
<rect width="100%" height="100%" fill="#111b27"/>
<rect x="0" y="0" width="${WIDTH}" height="70" fill="#1b2837"/>
${svgText(28, 33, '全球与城镇路网设计图（W10-RD）', 26, '#f3f6f9', 750)}
${svgText(28, 57, 'W10-RD 设计已获确认；W10b 前同步 W10_SPEC，layout.js 既有数据不变', 15, '#becbd8', 450)}
<image x="0" y="${MAP_Y}" width="${WMAP}" height="${HMAP}" href="data:image/png;base64,${globalImage}"/>
<g id="existing-world">${globalRoads}</g>
<g id="existing-town">${townMapRoads}</g>
<g id="proposed-ring">${ringOverlay}</g>
<g id="proposed-region-roads">${proposedRegionRoads}</g>
<g id="route-labels">${routeTags}</g>
<rect x="1" y="${MAP_Y}" width="${WMAP - 2}" height="${HMAP}" fill="none" stroke="#26394a" stroke-width="2"/>
<rect x="${WIDTH - 220}" y="${MAP_Y + 15}" width="202" height="39" rx="10" fill="#182433" fill-opacity=".92" stroke="#526476"/>
${svgText(WIDTH - 203, MAP_Y + 41, '全球等距圆柱投影', 16, '#f1f4f7', 600)}
<rect x="18" y="${LOWER_Y - 28}" width="${WIDTH - 36}" height="${INSET + 38}" rx="18" fill="#182433" stroke="#314456" stroke-width="2"/>
${svgText(34, LOWER_Y - 3, '城镇放大：以 topdown.png 为底图', 20, '#f4f6f8', 700)}
<g transform="translate(28 ${LOWER_Y + 10})">
  <rect width="${INSET}" height="${INSET}" fill="#e9e7e0" stroke="#9ba7b2" stroke-width="2"/>
  <image x="${TOWN.pad - TOWN.left}" y="${TOWN.pad - TOWN.top}" width="1776" height="2001" href="data:image/png;base64,${townImage}" clip-path="url(#townCrop)"/>
  ${townOverlay}${exitLabels}
  <path d="M${TOWN.pad},${TOWN.pad}h${TOWN.size}v${TOWN.size}h-${TOWN.size}z" fill="none" stroke="#526476" stroke-width="1.5"/>
</g>
<g id="review-notes" transform="translate(1175 ${LOWER_Y + 18})">
${svgText(0, 25, '图例与拓扑核对', 22, '#f4f6f8', 700)}
${legendItem(0, 65, globalRouteColor, 'RN01 全球纬向主线：含城镇横穿段与桥段，同色')}
${legendItem(0, 101, clsColor.RD03, '其他 RN 路线（按道路等级着色）')}
${legendItem(0, 137, townColor.R02, 'M01 / RN02：R02 北南轴，南端由 RN06 / T03 延至 LM04')}
${legendItem(0, 173, proposed, 'RN04 / CR01：RD03 闭环，九个出口接点')}
${legendItem(0, 209, '#54e0cf', 'RN05 / T02 从西北环点分出；RN06 / T03 从南点出')}
${svgText(0, 263, '设计定值', 18, '#9fe4f4', 700)}
${svgText(0, 291, '• CR01 中线 ±54 m，R8 m 圆角，长度约 418.27 m。', 15, '#dce5ed', 450)}
${svgText(0, 317, '• RD03 断面：4.5 m 沥青、碎石肩、外侧边沟；无步道。', 15, '#dce5ed', 450)}
${svgText(0, 343, '• N04 接正北点；T02-01 在西北环点接入，截短 28.89 m。', 15, '#dce5ed', 450)}
${svgText(0, 369, '• N08 与 T03 共用正南交点；T03-01 截短 5.28 m，不跨环。', 15, '#dce5ed', 450)}
${svgText(0, 395, '• T04/T05/T06 全部移除；九出口与保留地标路仍连通。', 15, '#dce5ed', 450)}
${svgText(0, 437, '农田 / 草地 / 建构筑物审查', 18, '#ff9999', 700)}
${svgText(0, 465, '• 当前道路与田块面相交 0；森林实例相交 0。', 15, '#dce5ed', 450)}
${svgText(0, 491, '• J-T09 有 1 个 T09 路标石堆压入 RN01-11 铺装；实施时抑制。', 15, '#dce5ed', 450)}
${svgText(0, 517, '• CR01 与九条接线不压草地/森林实例；环线位于 farmland-main。', 15, '#dce5ed', 450)}
${svgText(0, 543, '• 未重算田块时有 27 格相交（22 格耕作面进入铺装）。', 15, '#dce5ed', 450)}
${svgText(0, 569, '• 完整采样避让后田块相交 0、净减约 936 m²；地块净距 ≥ 2.01 m。', 15, '#dce5ed', 450)}
${svgText(0, 611, '拓扑核对', 18, '#9fe4f4', 700)}
${svgText(0, 639, '• 59 个节点、66 条边；RN04 由 18 条边闭合。', 15, '#dce5ed', 450)}
${svgText(0, 665, '• RN01 贯通东西环球路与 R01，CR01 在两端平交。', 15, '#dce5ed', 450)}
${svgText(0, 691, '• RN05 到 LM02/LM01/LM07；RN06 到 LM04；支路均有目的地。', 15, '#dce5ed', 450)}
${svgText(0, 733, 'W10b 前先修订 W10_SPEC；本轮未开始 W10b。', 15, '#ffd479', 650)}
${svgText(0, 759, '已确认用途：E-T11 海上栈道末端作为临水观景平台。', 15, '#ffd479', 650)}
</g>
<rect x="0" y="${HEIGHT - 50}" width="${WIDTH}" height="50" fill="#111b27"/>
${svgText(28, HEIGHT - 17, '底图：equirect-road-review-base.png（无预烘焙道路）；城镇放大：docs/layout/topdown.png。实线为保留及新增道路；T04/T05/T06 与田边端点不绘制。', 13, '#9baaba', 450)}
</svg>`);

const svg = sections.join('');
const svgPath = path.join(outDir, 'ROAD_NETWORK_REVIEW.svg');
const pngPath = path.join(outDir, 'ROAD_NETWORK_REVIEW.png');
fs.writeFileSync(svgPath, svg, 'utf8');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:#111b27"><img style="display:block;width:${WIDTH}px;height:${HEIGHT}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`, { waitUntil: 'load' });
  await page.locator('img').evaluate(img => img.decode());
  await page.screenshot({ path: pngPath, fullPage: true, type: 'png' });
} finally { await browser.close(); }
console.log(`Wrote ${path.relative(ROOT, svgPath)}`);
console.log(`Wrote ${path.relative(ROOT, pngPath)}`);
console.log(`Global: ${W.roadNetwork.nodes.length} nodes / ${W.roadNetwork.edges.length} edges; town: ${L.roadNodes.length} nodes / ${L.roadSegments.length} segments; CR01: 9 access connections.`);
console.log(`Trimmed within CR01: T02-01 ${t02Plan.trimMeters.toFixed(2)} m; T03-01 ${t03Plan.trimMeters.toFixed(2)} m.`);
