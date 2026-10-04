// Town layout data: road network, blocks, plots and placement of the existing samples.
// Coordinates: X east(+)/west(-), Z south(+)/north(-), Y up. 1 unit ≈ 1 m (design reference only).
// Roads, blocks and plots are the single source of truth; scene code and checks read from here.
// Check with: node tools/layout_check.mjs   (see PROGRESS.md for the current stage)
(function (global) {
'use strict';
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

const BASE = { half: 48, margin: 2 };          // 96 × 96 plinth; 2-unit trim around the blocks
const SAMPLE_SCALE = 1;                         // one uniform scale for every existing sample (measured, see PROGRESS.md)

// Cross-section from the centreline outward: carriageway half, curb/facility band, clear sidewalk.
// Lamps, poles and drains go in the band so the sidewalk keeps its full clear width.
const ROAD_TYPES = {
  main:   { carriageway: 7, band: 0.5, sidewalk: 2 },   // 7 + 2 × (0.5 + 2) = 12
  branch: { carriageway: 6, band: 1,   sidewalk: 2 },   // 6 + 2 × (1 + 2)   = 12
};
const ALLEY = { width: 3.5 };                   // shared surface, no separate sidewalks
const INTERSECTION = { curbRadius: 3, crosswalk: { width: 3, gap: 1 } };

const roadNodes = [
  { id: 'N01', x: -48, z: 15,     kind: 'edge' },
  { id: 'N02', x: 0,   z: 15,     kind: 'intersection', name: 'X01' },
  { id: 'N03', x: 48,  z: 15,     kind: 'edge' },
  { id: 'N04', x: 0,   z: -48,    kind: 'edge' },
  { id: 'N05', x: 0,   z: -33.5,  kind: 'alley-junction' },
  { id: 'N06', x: 0,   z: -15,    kind: 'intersection', name: 'X02' },
  { id: 'N07', x: 0,   z: 32.25,  kind: 'alley-junction' },
  { id: 'N08', x: 0,   z: 48,     kind: 'edge' },
  { id: 'N09', x: -48, z: -15,    kind: 'edge' },
  { id: 'N10', x: 48,  z: -15,    kind: 'edge' },
  { id: 'N11', x: -48, z: 32.25,  kind: 'edge' },
  { id: 'N12', x: 48,  z: 32.25,  kind: 'edge' },
  { id: 'N13', x: 48,  z: -33.5,  kind: 'edge' },
];

// Roads as node chains; segments (R01-1, R01-2, ...) are derived below.
const roads = [
  { id: 'R01', name: '主街',     type: 'main',   nodes: ['N01', 'N02', 'N03'] },
  { id: 'R02', name: '南北支路', type: 'branch', nodes: ['N04', 'N05', 'N06', 'N02', 'N07', 'N08'] },
  { id: 'R03', name: '社区支路', type: 'branch', nodes: ['N09', 'N06', 'N10'] },
];
const alleys = [
  { id: 'A01', block: 'B05', nodes: ['N11', 'N07'], note: '便利店/拉面店后方，住宅入口巷' },
  { id: 'A02', block: 'B06', nodes: ['N07', 'N12'], note: '与 A01 对齐，跨 R02 的巷口' },
  { id: 'A03', block: 'B02', nodes: ['N05', 'N13'], note: '住宅组团北排入口巷' },
];
const walkways = [
  { id: 'W01', block: 'B05', width: 2, poly: rect(-19, 21, -17, 30.5), connects: ['R01', 'A01'], note: '便利店与拉面店之间的人行通道（原服务小巷）' },
];
// Bus aprons sit behind the sidewalk so shelters never cut into its clear width.
// Japan drives on the left: westbound buses stop on the south side, eastbound on the north side.
const aprons = [
  { id: 'BS01', block: 'B06', kind: 'bus-stop', road: 'R01', direction: 'westbound', poly: rect(26, 21, 36, 22.5) },
  { id: 'BS02', block: 'B04', kind: 'bus-stop', road: 'R01', direction: 'eastbound', poly: rect(26, 7.5, 46, 9), stop: [30, 40] },
];

// Blocks are bounded by road corridors or by the plinth trim, so they follow road edits.
const blocks = [
  { id: 'B01', name: '西北', bounds: { w: 'edge', e: 'R02', n: 'edge', s: 'R03' }, use: '学校/社区中心' },
  { id: 'B02', name: '东北', bounds: { w: 'R02', e: 'edge', n: 'edge', s: 'R03' }, use: '住宅组团' },
  { id: 'B03', name: '西中', bounds: { w: 'edge', e: 'R02', n: 'R03', s: 'R01' }, use: '邻里商店、小型公共设施' },
  { id: 'B04', name: '东中', bounds: { w: 'R02', e: 'edge', n: 'R03', s: 'R01' }, use: '交番/诊所/绿地' },
  { id: 'B05', name: '西南', bounds: { w: 'edge', e: 'R02', n: 'R01', s: 'edge' }, use: '便利店街角与已有样板' },
  { id: 'B06', name: '东南', bounds: { w: 'R02', e: 'edge', n: 'R01', s: 'edge' }, use: '商住与公交停靠' },
];

// Setbacks per edge role; size = plan reference (frontage width × depth) used as a soft check.
const PLOT_TYPES = {
  store:     { setback: { front: 1, side: 0.5, rear: 1 },   maxHeight: 9,  size: [[10, 14], [9, 14]] },
  shop:      { setback: { front: 1, side: 0.5, rear: 1 },   maxHeight: 9,  size: [[6, 9], [8, 12]] },
  mixed:     { setback: { front: 1, side: 0.5, rear: 1 },   maxHeight: 12, size: [[8, 12], [8, 14]] },
  house:     { setback: { front: 2, side: 1, rear: 1.5 },   maxHeight: 9,  size: [[8, 12], [10, 16]] },
  apartment: { setback: { front: 2, side: 1, rear: 1.5 },   maxHeight: 12, size: [[12, 18], [12, 20]] },
  civic:     { setback: { front: 2, side: 1, rear: 1 },     maxHeight: 9,  size: [[8, 16], [8, 14]] },
  school:    { setback: { front: 3, side: 3, rear: 3 },     maxHeight: 14, size: [[30, 44], [20, 30]] },
  park:      { setback: { front: 0.5, side: 0.5, rear: 0.5 }, maxHeight: 4, size: [[10, 24], [8, 20]] },
};

// plot(id, [x0, z0, x1, z1], type, front, opts): front = side the main entrance faces (N/S/E/W).
// opts.frontages lists every edge on a public way (corner plots get front setbacks on both).
// opts.entrance overrides the entrance position along the front edge; default is its midpoint.
function plot(id, r, type, front, opts = {}) {
  return { id, block: id.slice(0, 3), rect: r, poly: rect(...r), type, front,
    frontages: opts.frontages || [front], uses: opts.uses || [], status: opts.status || 'reserved',
    sample: opts.sample || null, entrances: opts.entrances || [{ at: opts.entrance, facing: front, kind: 'pedestrian' }],
    note: opts.note || '' };
}
const plots = [
  // B01: one block-scale plot for a school or community centre (courtyard, parking, service yard inside).
  plot('B01-P01', [-46, -46, -6, -21], 'school', 'S', { frontages: ['S', 'E'], uses: ['学校', '社区中心'],
    entrances: [{ at: -26, facing: 'S', kind: 'pedestrian' }, { at: -40, facing: 'E', kind: 'vehicle' }] }),
  // B02: two rows of houses; the north row is reached from alley A03.
  plot('B02-P01', [6, -31.75, 16, -21], 'house', 'S', { frontages: ['S', 'W'], uses: ['独栋住宅'] }),
  plot('B02-P02', [16, -31.75, 26, -21], 'house', 'S', { uses: ['独栋住宅'] }),
  plot('B02-P03', [26, -31.75, 36, -21], 'house', 'S', { uses: ['独栋住宅'] }),
  plot('B02-P04', [36, -31.75, 46, -21], 'house', 'S', { uses: ['独栋住宅'] }),
  plot('B02-P05', [6, -46, 16, -35.25], 'house', 'S', { frontages: ['S', 'W'], uses: ['独栋住宅', '小公寓'] }),
  plot('B02-P06', [16, -46, 26, -35.25], 'house', 'S', { uses: ['独栋住宅'] }),
  plot('B02-P07', [26, -46, 36, -35.25], 'house', 'S', { uses: ['独栋住宅'] }),
  plot('B02-P08', [36, -46, 46, -35.25], 'house', 'S', { uses: ['独栋住宅'] }),
  // B03: neighbourhood shops face the main street; small public uses face R03.
  plot('B03-P01', [-14, 0, -6, 9], 'shop', 'S', { frontages: ['S', 'E'], uses: ['面包店', '药店'] }),
  plot('B03-P02', [-22, 0, -14, 9], 'shop', 'S', { uses: ['洗衣店', '花店'] }),
  plot('B03-P03', [-30, 0, -22, 9], 'shop', 'S', { uses: ['书店', '花店'] }),
  plot('B03-P04', [-38, 0, -30, 9], 'shop', 'S', { uses: ['小餐馆', '杂货'] }),
  plot('B03-P05', [-46, 0, -38, 9], 'shop', 'S', { uses: ['小店铺'] }),
  plot('B03-P06', [-18, -9, -6, 0], 'civic', 'N', { frontages: ['N', 'E'], uses: ['社区会所', '诊所'] }),
  plot('B03-P07', [-30, -9, -18, 0], 'civic', 'N', { uses: ['小型公共设施'] }),
  plot('B03-P08', [-46, -9, -30, 0], 'park', 'N', { uses: ['口袋公园', '小神社'] }),
  // B04: koban on the main corner, clinic, a pocket park behind the eastbound bus stop.
  plot('B04-P01', [6, 0, 14, 9], 'civic', 'S', { frontages: ['S', 'W'], uses: ['交番'] }),
  plot('B04-P02', [14, 0, 26, 9], 'civic', 'S', { uses: ['诊所'] }),
  plot('B04-P03', [26, -9, 46, 7.5], 'park', 'S', { frontages: ['S', 'N'], uses: ['口袋公园', '绿地'], entrance: 35 }),
  plot('B04-P04', [6, -9, 16, 0], 'civic', 'N', { frontages: ['N', 'W'], uses: ['小神社', '公共设施'] }),
  plot('B04-P05', [16, -9, 26, 0], 'mixed', 'N', { uses: ['商住'] }),
  // B05: existing samples. Store on the X01 corner, ramen beside it, apartment behind on alley A01.
  plot('B05-P01', [-17, 21, -6, 30.5], 'store', 'N', { frontages: ['N', 'E'], uses: ['便利店'], status: 'occupied', sample: 'store' }),
  plot('B05-P02', [-28, 21, -19, 30.5], 'shop', 'N', { uses: ['拉面店'], status: 'occupied', sample: 'ramen' }),
  plot('B05-P03', [-37, 21, -28, 30.5], 'shop', 'N', { uses: ['小店铺', '咖啡店'] }),
  plot('B05-P04', [-46, 21, -37, 30.5], 'shop', 'N', { uses: ['小店铺'] }),
  plot('B05-P05', [-18, 34, -6, 46], 'apartment', 'N', { frontages: ['N', 'E'], uses: ['小公寓'], status: 'occupied', sample: 'apartment' }),
  plot('B05-P06', [-28, 34, -18, 46], 'house', 'N', { uses: ['独栋住宅'] }),
  plot('B05-P07', [-37, 34, -28, 46], 'house', 'N', { uses: ['独栋住宅'] }),
  plot('B05-P08', [-46, 34, -37, 46], 'house', 'N', { uses: ['独栋住宅'] }),
  // B06: shop-houses on the main street (BS01 in front of P03), houses on alley A02.
  plot('B06-P01', [6, 21, 16, 30.5], 'mixed', 'N', { frontages: ['N', 'W'], uses: ['商住', '药店'] }),
  plot('B06-P02', [16, 21, 26, 30.5], 'mixed', 'N', { uses: ['商住'] }),
  plot('B06-P03', [26, 22.5, 36, 30.5], 'mixed', 'N', { uses: ['商住'], note: '前方为公交候车区 BS01' }),
  plot('B06-P04', [36, 21, 46, 30.5], 'mixed', 'N', { uses: ['商住'] }),
  plot('B06-P05', [6, 34, 16, 46], 'house', 'N', { frontages: ['N', 'W'], uses: ['独栋住宅'] }),
  plot('B06-P06', [16, 34, 26, 46], 'house', 'N', { uses: ['独栋住宅'] }),
  plot('B06-P07', [26, 34, 36, 46], 'house', 'N', { uses: ['独栋住宅'] }),
  plot('B06-P08', [36, 34, 46, 46], 'house', 'N', { uses: ['独栋住宅'] }),
];

// Existing samples (scene.js groups). Placement = translate + rotate about Y + uniform SAMPLE_SCALE:
// world = (x, z) + R_y(rotY) · (scale · local). localBounds are measured in Chromium by
// tools/measure_samples.mjs (ground = walking-height footprint [x0, z0, x1, z1], y 0.3–1.8);
// door is the local entrance point, frontDir the local facing (+z).
const samples = [
  { id: 'store', name: 'こもれび MART', plot: 'B05-P01', transform: { x: -10.5, z: 25, rotY: Math.PI },
    door: { x: 1.84, z: 1.8 }, frontDir: [0, 1],
    parts: [
      { group: 'store', role: 'building', localBounds: { min: [-2.83, 0.21, -3.98], max: [4.66, 3.62, 2.6], ground: [-2.67, -3.84, 4.66, 1.86] } },
      { group: 'vending', role: 'attachment', localBounds: { min: [-2.15, 0.21, 1.96], max: [-0.44, 2.08, 2.71], ground: [-2.15, 1.96, -0.44, 2.71] } },
      { group: 'bicycles', role: 'attachment', localBounds: { min: [-3.44, 0.28, -2.48], max: [-3.07, 1.25, 0.58], ground: [-3.44, -2.48, -3.07, 0.58] } },
      { group: 'storeProps', role: 'attachment', localBounds: { min: [2.51, 0.26, -3.23], max: [5.14, 1.31, 2.36], ground: [2.51, -3.23, 5.14, 2.36] } },
    ] },
  { id: 'ramen', name: '雨音らーめん', plot: 'B05-P02', transform: { x: -16.6, z: 25, rotY: Math.PI },
    door: { x: 6.9, z: 1.04 }, frontDir: [0, 1],
    parts: [
      { group: 'ramen', role: 'building', localBounds: { min: [5.09, 0.29, -3.61], max: [8.71, 3.12, 1.79], ground: [5.24, -3.53, 8.56, 1.1] } },
      { group: 'ramenPlants', role: 'attachment', localBounds: { min: [5.47, 0.33, 2.05], max: [7.9, 1.03, 2.45], ground: [5.47, 2.05, 7.9, 2.45] } },
    ] },
  { id: 'apartment', name: 'こもれび荘', plot: 'B05-P05', transform: { x: -11.4, z: 33, rotY: Math.PI },
    door: { x: 0.9, z: -4.88 }, frontDir: [0, 1],
    parts: [
      { group: 'apartment', role: 'building', localBounds: { min: [-2.68, 0.18, -8.41], max: [3.91, 6.2, -4.19], ground: [-2.68, -8.26, 3.75, -4.8] } },
      { group: 'apartmentPlants', role: 'attachment', localBounds: { min: [-1.87, 0.33, -4.72], max: [-0.46, 1.02, -4.35], ground: [-1.87, -4.72, -0.46, -4.35] } },
    ] },
];

// Street furniture from the original L-shaped street. Provisional slots in curb/facility bands;
// P3 finalises signs, lamps and wiring. anchor = local foot of the pole.
const legacyFurniture = [
  { group: 'streetLamp',    anchor: [-3.7, 2.6],   slot: { road: 'R01', x: -6.6,  z: 18.75, rotY: Math.PI },      note: '便利店街角路灯（斑马线与转角圆弧之外）' },
  { group: 'guardRail',     anchor: [-0.85, 3.13], slot: { road: 'R01', x: -12.5, z: 18.75, rotY: Math.PI },      note: '店前护栏' },
  { group: 'trafficSignal', anchor: [5.1, -4.75],  slot: { road: 'R02', x: -3.5,  z: 22,    rotY: 0 },            note: 'X01 南向北进口信号' },
  { group: 'utilityPole',   anchor: [-4.7, -3.85], slot: { road: 'R02', x: -3.5,  z: 29.5,  rotY: -Math.PI / 2 }, note: 'A01 巷口电杆，止まれ朝向出巷车辆' },
];
// Original ground pieces that the new road network replaces (P2) or regenerates (P3).
const legacyGround = [
  { group: 'base',         action: 'P2 替换为 96×96 底座' },
  { group: 'legacyGround', action: 'P2 移除：旧 L 形街道、地台、路缘、斑马线和小巷铺装由道路网络替代' },
  { group: 'wetGround',    action: 'P3 按新道路重新生成水洼与反光' },
];

// ---- Derived geometry (pure functions of the data above) ----
const nodeById = Object.fromEntries(roadNodes.map(n => [n.id, n]));
const roadById = Object.fromEntries(roads.map(r => [r.id, r]));
const half = t => ROAD_TYPES[t].carriageway / 2 + ROAD_TYPES[t].band + ROAD_TYPES[t].sidewalk;
for (const r of roads) {
  const t = ROAD_TYPES[r.type];
  r.corridor = t.carriageway + 2 * (t.band + t.sidewalk);
  const a = nodeById[r.nodes[0]], b = nodeById[r.nodes[r.nodes.length - 1]];
  r.axis = a.z === b.z ? 'x' : 'z';                    // direction of travel
  r.at = r.axis === 'x' ? a.z : a.x;                   // fixed coordinate of the centreline
}
const roadSegments = [];
for (const r of [...roads, ...alleys.map(a => ({ ...a, type: 'alley' }))])
  for (let i = 0; i + 1 < r.nodes.length; i++)
    roadSegments.push({ id: r.nodes.length > 2 ? `${r.id}-${i + 1}` : r.id, road: r.id, type: r.type, from: r.nodes[i], to: r.nodes[i + 1] });

// Rect across a road's centreline between offsets o0..o1 (signed, + = east/south), over s0..s1 along it.
function band(r, o0, o1, s0 = -BASE.half, s1 = BASE.half) {
  return r.axis === 'x' ? [s0, r.at + o0, s1, r.at + o1] : [r.at + o0, s0, r.at + o1, s1];
}
function corridorRect(r) { return band(r, -half(r.type), half(r.type)); }
function blockRect(b) {
  const lim = (side, sign) => b.bounds[side] === 'edge' ? sign * (BASE.half - BASE.margin) : roadById[b.bounds[side]].at - sign * half(roadById[b.bounds[side]].type);
  return [lim('w', -1), lim('n', -1), lim('e', 1), lim('s', 1)];
}
for (const b of blocks) { b.rect = blockRect(b); b.poly = rect(...b.rect); }

// Road surface pieces: carriageway, bands and sidewalks; sidewalks stop at crossing carriageways.
function crossings(r) {
  return roads.filter(o => o !== r && o.axis !== r.axis).map(o => {
    const t = ROAD_TYPES[o.type];
    return [o.at - t.carriageway / 2 - t.band, o.at + t.carriageway / 2 + t.band];
  }).sort((p, q) => p[0] - q[0]);
}
function spans(r) {   // along-road spans outside crossing carriageways
  const out = []; let s = -BASE.half;
  for (const [a, b] of crossings(r)) { if (a > s) out.push([s, a]); s = Math.max(s, b); }
  if (s < BASE.half) out.push([s, BASE.half]);
  return out;
}
const surfaces = [];
for (const r of roads) {
  const t = ROAD_TYPES[r.type], c = t.carriageway / 2;
  surfaces.push({ id: `${r.id}-CW`, road: r.id, kind: 'carriageway', rect: band(r, -c, c) });
  for (const [sgn, side] of [[-1, r.axis === 'x' ? 'N' : 'W'], [1, r.axis === 'x' ? 'S' : 'E']]) {
    const o0 = sgn * c, o1 = sgn * (c + t.band), o2 = sgn * half(r.type);
    spans(r).forEach(([s0, s1], i) => {
      surfaces.push({ id: `${r.id}-BD-${side}${i + 1}`, road: r.id, kind: 'band', side, rect: band(r, Math.min(o0, o1), Math.max(o0, o1), s0, s1) });
      surfaces.push({ id: `${r.id}-SW-${side}${i + 1}`, road: r.id, kind: 'sidewalk', side, rect: band(r, Math.min(o1, o2), Math.max(o1, o2), s0, s1) });
    });
  }
}
for (const a of alleys) {   // alley surface ends where it meets a road corridor
  const p = nodeById[a.nodes[0]], q = nodeById[a.nodes[1]];
  let [x0, x1] = [Math.min(p.x, q.x), Math.max(p.x, q.x)];
  for (const r of roads.filter(r => r.axis === 'z')) {
    const h = half(r.type);
    if (x0 < r.at + h && x0 > r.at - h) x0 = r.at + h;
    if (x1 > r.at - h && x1 < r.at + h) x1 = r.at - h;
  }
  a.rect = [x0, p.z - ALLEY.width / 2, x1, p.z + ALLEY.width / 2];
  surfaces.push({ id: `${a.id}-SURF`, road: a.id, kind: 'alley', rect: a.rect });
}

// Crosswalks on every arm of the two intersections, placed past the curb returns.
const crosswalks = [];
for (const n of roadNodes.filter(n => n.kind === 'intersection')) {
  const ew = roads.find(r => r.axis === 'x' && r.at === n.z), ns = roads.find(r => r.axis === 'z' && r.at === n.x);
  const { curbRadius: R, crosswalk: { width: w, gap } } = INTERSECTION;
  for (const [arm, along, across] of [['N', ns, ew], ['S', ns, ew], ['W', ew, ns], ['E', ew, ns]]) {
    const ta = ROAD_TYPES[along.type], tx = ROAD_TYPES[across.type];
    const sgn = arm === 'N' || arm === 'W' ? -1 : 1;
    const start = across.at + sgn * (tx.carriageway / 2 + R + gap), end = start + sgn * w;
    const span = ta.carriageway / 2 + ta.band;
    crosswalks.push({ id: `${n.name}-CW-${arm}`, node: n.id, road: along.id, kind: 'zebra',
      rect: band(along, -span, span, Math.min(start, end), Math.max(start, end)) });
  }
}
// Alley mouths facing each other across R02: candidate mid-block crossing (P3 decides on markings).
const n07 = nodeById.N07, r02t = ROAD_TYPES[roadById.R02.type];
const s02 = r02t.carriageway / 2 + r02t.band;
crosswalks.push({ id: 'N07-CW', node: 'N07', road: 'R02', kind: 'candidate',
  rect: [-s02, n07.z - INTERSECTION.crosswalk.width / 2, s02, n07.z + INTERSECTION.crosswalk.width / 2] });

// Plot derived data: buildable envelope and entrance points.
const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
for (const p of plots) {
  const [x0, z0, x1, z1] = p.rect, sb = PLOT_TYPES[p.type].setback;
  const opp = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const role = d => p.frontages.includes(d) ? 'front' : d === opp[p.front] ? 'rear' : 'side';
  p.buildable = [x0 + sb[role('W')], z0 + sb[role('N')], x1 - sb[role('E')], z1 - sb[role('S')]];
  p.maxHeight = PLOT_TYPES[p.type].maxHeight;
  p.entrances = p.entrances.map(e => {
    const f = e.facing, mid = f === 'N' || f === 'S' ? (x0 + x1) / 2 : (z0 + z1) / 2;
    const at = e.at ?? mid;
    const pt = { N: [at, z0], S: [at, z1], E: [x1, at], W: [x0, at] }[f];
    return { ...e, x: pt[0], z: pt[1] };
  });
}
// Sample entrances take the door position projected onto the front edge.
const plotById = Object.fromEntries(plots.map(p => [p.id, p]));
function toWorld(s, x, z) {
  const t = s.transform, k = t.scale ?? SAMPLE_SCALE, c = Math.cos(t.rotY), n = Math.sin(t.rotY);
  return [t.x + k * (x * c + z * n), t.z + k * (-x * n + z * c)];
}
for (const s of samples) {
  const p = plotById[s.plot], [dx, dz] = toWorld(s, s.door.x, s.door.z), e = p.entrances[0];
  if (e.facing === 'N' || e.facing === 'S') e.x = Math.round(dx * 100) / 100; else e.z = Math.round(dz * 100) / 100;
  e.door = [Math.round(dx * 100) / 100, Math.round(dz * 100) / 100];
}

// ---- Levels, pavement islands and curb cuts (P2) ----
// Carriageways sit just above the plinth; everything between carriageways is one raised pavement
// island (bands, sidewalks, blocks, alleys), so the curb runs unbroken around each island and the
// corners at intersections are curb returns of radius INTERSECTION.curbRadius.
const LEVELS = { plinth: 0, carriageway: 0.02, pavement: 0.15, plot: 0.19 };
const CURB = LEVELS.pavement - LEVELS.carriageway;
// Step-free crossings: a 1:10 ramp at both ends of every zebra, cut back from the curb line.
// Driveways (alley mouths, vehicle entrances) drop only inside the facility band so the
// sidewalk stays level and continuous across them.
const CURB_CUT = { rampDepth: CURB * 10, driveway: 3, minFlatSidewalk: 1 };
const H = BASE.half;
const cwSpan = r => [r.at - ROAD_TYPES[r.type].carriageway / 2, r.at + ROAD_TYPES[r.type].carriageway / 2];
function gaps(spansList) {
  const out = []; let s = -H;
  for (const [a, b] of spansList.slice().sort((p, q) => p[0] - q[0])) { if (a > s) out.push([s, a]); s = Math.max(s, b); }
  if (s < H) out.push([s, H]);
  return out;
}
const islands = [];
for (const [z0, z1] of gaps(roads.filter(r => r.axis === 'x').map(cwSpan)))
  for (const [x0, x1] of gaps(roads.filter(r => r.axis === 'z').map(cwSpan))) {
    const inX0 = x0 > -H, inX1 = x1 < H, inZ0 = z0 > -H, inZ1 = z1 < H;
    islands.push({ id: `IS${islands.length + 1}`, rect: [x0, z0, x1, z1],
      // a corner is a curb return when both of its edges are carriageway edges
      round: { NW: inX0 && inZ0, NE: inX1 && inZ0, SE: inX1 && inZ1, SW: inX0 && inZ1 } });
  }
// Curb cut on the curb line of `road`: line = the constant coordinate ('x' for N–S roads),
// at = curb line position, dir = +1/−1 pointing into the pavement, [s0, s1] along the curb.
function cut(id, kind, road, side, s0, s1, depth) {
  const r = roadById[road], line = r.axis === 'z' ? 'x' : 'z', at = cwSpan(r)[side > 0 ? 1 : 0];
  const [d0, d1] = [Math.min(at, at + side * depth), Math.max(at, at + side * depth)];
  return { id, kind, road, line, at, dir: side, s0, s1, depth, rect: line === 'x' ? [d0, s0, d1, s1] : [s0, d0, s1, d1] };
}
const curbCuts = [];
for (const c of crosswalks.filter(c => c.kind === 'zebra')) {
  const r = roadById[c.road], [s0, s1] = r.axis === 'z' ? [c.rect[1], c.rect[3]] : [c.rect[0], c.rect[2]];
  for (const side of [-1, 1]) curbCuts.push(cut(`${c.id}-RP${side < 0 ? 'a' : 'b'}`, 'ramp', r.id, side, s0, s1, CURB_CUT.rampDepth));
}
for (const a of alleys) for (const r of roads.filter(r => r.axis === 'z')) {   // alley mouths on N–S roads
  const h = half(r.type);
  if (Math.abs(a.rect[2] - (r.at - h)) < 1e-6) curbCuts.push(cut(`${a.id}-DW`, 'driveway', r.id, -1, a.rect[1], a.rect[3], ROAD_TYPES[r.type].band));
  if (Math.abs(a.rect[0] - (r.at + h)) < 1e-6) curbCuts.push(cut(`${a.id}-DW`, 'driveway', r.id, 1, a.rect[1], a.rect[3], ROAD_TYPES[r.type].band));
}
for (const p of plots) p.entrances.filter(e => e.kind === 'vehicle').forEach((e, i) => {   // plot driveways
  const [x0, z0, x1, z1] = p.rect, f = e.facing;
  const edge = { N: z0, S: z1, W: x0, E: x1 }[f], sgn = f === 'E' || f === 'S' ? 1 : -1;
  const r = roads.find(r => (r.axis === 'z') === (f === 'E' || f === 'W') && Math.abs(r.at - sgn * half(r.type) - edge) < 1e-6);
  if (!r) return;
  const at = f === 'N' || f === 'S' ? e.x : e.z;
  curbCuts.push(cut(`${p.id}-DW${i + 1}`, 'driveway', r.id, -sgn, at - CURB_CUT.driveway / 2, at + CURB_CUT.driveway / 2, ROAD_TYPES[r.type].band));
});

const LAYOUT = { BASE, SAMPLE_SCALE, ROAD_TYPES, ALLEY, INTERSECTION, PLOT_TYPES, DIRS, LEVELS, CURB_CUT,
  roadNodes, roads, alleys, roadSegments, walkways, aprons, blocks, plots, samples,
  legacyFurniture, legacyGround, surfaces, crosswalks, islands, curbCuts, corridorRect, toWorld, rect };
if (typeof module !== 'undefined' && module.exports) module.exports = LAYOUT;
else global.LAYOUT = LAYOUT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
