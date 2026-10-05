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
// fit = a typical candidate building (frontage width × depth) plus the ancillary space it needs on
// the plot (parking reached from a frontage, service yard, bike shelter...). The P4 check packs
// each reserved plot with its candidate to prove the reserved land is really buildable.
const PLOT_TYPES = {
  store:     { setback: { front: 1, side: 0.5, rear: 1 },   maxHeight: 9,  size: [[10, 14], [9, 14]] },
  shop:      { setback: { front: 1, side: 0.5, rear: 1 },   maxHeight: 9,  size: [[6, 9], [8, 12]],
    fit: { building: [5.5, 6.5], annexes: [[1.2, 1.5, '后勤/垃圾']] } },
  mixed:     { setback: { front: 1, side: 0.5, rear: 1 },   maxHeight: 12, size: [[8, 12], [8, 14]],
    fit: { building: [7.5, 6], annexes: [[1.5, 2.5, '自行车']] } },
  house:     { setback: { front: 2, side: 1, rear: 1.5 },   maxHeight: 9,  size: [[8, 12], [10, 16]],
    fit: { building: [6.5, 7], annexes: [[2.5, 5, '停车位']] } },
  apartment: { setback: { front: 2, side: 1, rear: 1.5 },   maxHeight: 12, size: [[12, 18], [12, 20]],
    fit: { building: [10, 8], annexes: [[2, 4, '自行车棚'], [1.5, 2, '垃圾站']] } },
  civic:     { setback: { front: 2, side: 1, rear: 1 },     maxHeight: 9,  size: [[8, 16], [8, 14]],
    fit: { building: [6, 6], annexes: [[2.5, 5, '停车位']] } },
  school:    { setback: { front: 3, side: 3, rear: 3 },     maxHeight: 14, size: [[30, 44], [20, 30]],
    fit: { building: [28, 8], annexes: [[24, 9, '操场'], [6, 4, '后勤/车库']] } },
  park:      { setback: { front: 0.5, side: 0.5, rear: 0.5 }, maxHeight: 4, size: [[10, 24], [8, 20]] },
};

// plot(id, [x0, z0, x1, z1], type, front, opts): front = side the main entrance faces (N/S/E/W).
// opts.frontages lists every edge on a public way (corner plots get front setbacks on both).
// opts.entrance overrides the entrance position along the front edge; default is its midpoint.
function plot(id, r, type, front, opts = {}) {
  return { id, block: id.slice(0, 3), rect: r, poly: rect(...r), type, front,
    frontages: opts.frontages || [front], uses: opts.uses || [], status: opts.status || 'reserved',
    sample: opts.sample || null, building: opts.building || null, entrances: opts.entrances || [{ at: opts.entrance, facing: front, kind: 'pedestrian' }],
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
  plot('B03-P01', [-14, 0, -6, 9], 'shop', 'S', { frontages: ['S', 'E'], uses: ['面包店', '药店'], status: 'occupied', building: 'bakery' }),
  plot('B03-P02', [-22, 0, -14, 9], 'shop', 'S', { uses: ['洗衣店', '花店'], status: 'occupied', building: 'laundry' }),
  plot('B03-P03', [-30, 0, -22, 9], 'shop', 'S', { uses: ['书店', '花店'], status: 'occupied', building: 'bookshop' }),
  plot('B03-P04', [-38, 0, -30, 9], 'shop', 'S', { uses: ['小餐馆', '杂货'], status: 'occupied', building: 'diner' }),
  plot('B03-P05', [-46, 0, -38, 9], 'shop', 'S', { uses: ['小店铺'], status: 'occupied', building: 'grocery' }),
  plot('B03-P06', [-18, -9, -6, 0], 'civic', 'N', { frontages: ['N', 'E'], uses: ['社区会所', '诊所'], status: 'occupied', building: 'hall' }),
  plot('B03-P07', [-30, -9, -18, 0], 'civic', 'N', { uses: ['小型公共设施'] }),
  plot('B03-P08', [-46, -9, -30, 0], 'park', 'N', { uses: ['口袋公园', '小神社'] }),
  // B04: koban on the main corner, clinic, a pocket park behind the eastbound bus stop.
  plot('B04-P01', [6, 0, 16, 9], 'civic', 'S', { frontages: ['S', 'W'], uses: ['交番'], note: '10 宽：转角双退界后仍能放下交番与一个巡逻车位' }),
  plot('B04-P02', [16, 0, 26, 9], 'civic', 'S', { uses: ['诊所'] }),
  plot('B04-P03', [26, -9, 46, 7.5], 'park', 'S', { frontages: ['S', 'N'], uses: ['口袋公园', '绿地'], entrance: 35 }),
  plot('B04-P04', [6, -9, 16, 0], 'civic', 'N', { frontages: ['N', 'W'], uses: ['小神社', '公共设施'] }),
  plot('B04-P05', [16, -9, 26, 0], 'mixed', 'N', { uses: ['商住'] }),
  // B05: existing samples. Store on the X01 corner, ramen beside it, apartment behind on alley A01.
  plot('B05-P01', [-17, 21, -6, 30.5], 'store', 'N', { frontages: ['N', 'E'], uses: ['便利店'], status: 'occupied', sample: 'store' }),
  plot('B05-P02', [-28, 21, -19, 30.5], 'shop', 'N', { uses: ['拉面店'], status: 'occupied', sample: 'ramen' }),
  plot('B05-P03', [-37, 21, -28, 30.5], 'shop', 'N', { uses: ['小店铺', '咖啡店'], status: 'occupied', building: 'cafe' }),
  plot('B05-P04', [-46, 21, -37, 30.5], 'shop', 'N', { uses: ['小店铺', '花店'], status: 'occupied', building: 'florist' }),
  plot('B05-P05', [-18, 34, -6, 46], 'apartment', 'N', { frontages: ['N', 'E'], uses: ['小公寓'], status: 'occupied', sample: 'apartment' }),
  plot('B05-P06', [-28, 34, -18, 46], 'house', 'N', { uses: ['独栋住宅'] }),
  plot('B05-P07', [-37, 34, -28, 46], 'house', 'N', { uses: ['独栋住宅'], entrance: -29.5, note: '面宽 9：入口靠东，停车位沿巷' }),
  plot('B05-P08', [-46, 34, -37, 46], 'house', 'N', { uses: ['独栋住宅'], entrance: -38.5, note: '面宽 9：入口靠东，停车位沿巷' }),
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
      { group: 'ramenPlants', role: 'attachment', localBounds: { min: [5.46, 0.33, 2.06], max: [7.93, 1, 2.45], ground: [5.46, 2.06, 7.93, 2.45] } },
    ] },
  { id: 'apartment', name: 'こもれび荘', plot: 'B05-P05', transform: { x: -11.4, z: 33, rotY: Math.PI },
    door: { x: 0.9, z: -4.88 }, frontDir: [0, 1],
    parts: [
      { group: 'apartment', role: 'building', localBounds: { min: [-2.68, 0.18, -8.41], max: [3.91, 6.2, -4.19], ground: [-2.68, -8.26, 3.75, -4.8] } },
      { group: 'apartmentPlants', role: 'attachment', localBounds: { min: [-1.9, 0.33, -4.68], max: [-0.47, 1.01, -4.32], ground: [-1.9, -4.68, -0.47, -4.32] } },
    ] },
];

// New buildings (P5 on), one per plot, modelled in buildings/<plot>.js. Same placement rule and measured
// bounds as the samples, kept in their own list so the old samples stay review-only. parts: building =
// main volume incl. awnings and eaves (must stay in the buildable envelope); attachment = planters,
// service yard, outdoor units (must stay on the plot); ground = paving and light decals on the plot.
// shelter = local [x0, z0, x1, z1] of the roof and each awning: the rain never falls under them.
const buildings = [
  { id: 'cafe', name: '雨宿り珈琲', plot: 'B05-P03', module: 'B05-P03', transform: { x: -32.5, z: 23, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 1,
    shelter: [[-2.05, -6.1, 3.55, 0.05], [-1.9, 0, 3.4, 0.97], [-2.5, -3.67, -2, -0.78], [-0.1, -6.45, 1.15, -6.05]],   // roof, street awning, side awning, back-door canopy
    parts: [
      { group: 'cafe', role: 'building', localBounds: { min: [-2.62, 0.18, -6.46], max: [3.74, 4.28, 0.97], ground: [-2.11, -6.29, 3.74, 0.24] } },
      { group: 'cafeFrontE', role: 'attachment', localBounds: { min: [-2.66, 0.18, -0.73], max: [-1.08, 2.16, 0.75], ground: [-2.66, -0.73, -1.08, 0.75] } },
      { group: 'cafeFrontW', role: 'attachment', localBounds: { min: [0.69, 0.18, 0.1], max: [3.22, 1.25, 1.62], ground: [0.69, 0.1, 3.22, 1.62] } },
      { group: 'cafeUtility', role: 'attachment', localBounds: { min: [3.5, 0.19, -3.71], max: [3.84, 1.46, -2.76], ground: [3.5, -3.71, 3.84, -2.76] } },
      { group: 'cafeService', role: 'attachment', localBounds: { min: [-3.39, 0.18, -6.44], max: [-2.11, 1.35, -4.86], ground: [-3.39, -6.44, -2.11, -4.86] } },
      { group: 'cafeGround', role: 'ground', localBounds: { min: [-3.31, 0.19, -7.5], max: [4.1, 0.23, 2], ground: null } },
    ] },
  { id: 'florist', name: 'はなや しずく', plot: 'B05-P04', module: 'B05-P04', transform: { x: -41.5, z: 23, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 1,
    shelter: [[-2.8, -6.05, 2.8, 0.05], [-2.65, 0, 2.65, 0.76], [1.35, -6.4, 2.5, -6.0]],   // roof, street awning, back-door canopy
    parts: [
      { group: 'florist', role: 'building', localBounds: { min: [-3.37, 0.18, -6.41], max: [2.97, 4.18, 0.77], ground: [-3.13, -6.3, 2.92, 0.06] } },
      { group: 'florFrontE', role: 'attachment', localBounds: { min: [-3.21, 0.18, -1.83], max: [-0.84, 2.54, 1.59], ground: [-3.21, -1.82, -0.85, 1.59] } },
      { group: 'florFrontW', role: 'attachment', localBounds: { min: [0.84, 0.18, -2.02], max: [3.29, 1.02, 0.59], ground: [0.85, -2.02, 3.28, 0.59] } },
      { group: 'florSideE', role: 'attachment', localBounds: { min: [-3.2, 0.18, -5.38], max: [-2.78, 1.53, -4.17], ground: [-3.19, -5.37, -2.79, -4.18] } },
      { group: 'florUtility', role: 'attachment', localBounds: { min: [2.75, 0.19, -6.69], max: [3.68, 1.99, -4.42], ground: [2.76, -6.69, 3.68, -4.42] } },
      { group: 'florRear', role: 'attachment', localBounds: { min: [-0.86, 0.18, -6.37], max: [1.07, 1.59, -6], ground: [-0.85, -6.36, 1.07, -6] } },
      { group: 'florService', role: 'attachment', localBounds: { min: [-2.62, 0.18, -7.15], max: [-1.18, 1.5, -6.04], ground: [-2.61, -7.15, -1.19, -6.04] } },
      { group: 'florGround', role: 'ground', localBounds: { min: [-3.7, 0.19, -7.5], max: [3.7, 0.23, 2], ground: null } },
    ] },
  { id: 'bakery', name: 'こむぎ堂', plot: 'B03-P01', module: 'B03-P01', transform: { x: -10, z: 7.1, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 1,
    shelter: [[-3.15, -5.6, 2.55, 0.05], [-3, 0, 2.4, 0.8], [2.5, -1.85, 2.95, -0.35], [-1.45, -5.95, -0.3, -5.55]],   // roof, street awning, side awning, back-door canopy
    parts: [
      { group: 'bakery', role: 'building', localBounds: { min: [-3.32, 0.18, -5.96], max: [2.98, 6.25, 0.82], ground: [-3.21, -5.85, 2.7, 0.06] } },
      { group: 'bakFrontW', role: 'attachment', localBounds: { min: [-3.14, 0.18, 0.23], max: [-0.95, 1.22, 0.71], ground: [-3.14, 0.23, -0.95, 0.7] } },
      { group: 'bakFrontE', role: 'attachment', localBounds: { min: [0.62, 0.18, 0.22], max: [2.42, 1.19, 1.45], ground: [0.62, 0.22, 2.41, 1.45] } },
      { group: 'bakSideE', role: 'attachment', localBounds: { min: [2.53, 0.19, -1.72], max: [2.86, 0.86, -0.48], ground: [2.54, -1.72, 2.86, -0.48] } },
      { group: 'bakShed', role: 'attachment', localBounds: { min: [2.58, 0.18, -5.69], max: [3.82, 2.17, -4.4], ground: [2.62, -5.6, 3.77, -4.47] } },
      { group: 'bakUtility', role: 'attachment', localBounds: { min: [-3.5, 0.19, -4.05], max: [-3.1, 1.86, -1.06], ground: [-3.5, -4.05, -3.11, -1.06] } },
      { group: 'bakService', role: 'attachment', localBounds: { min: [-2.07, 0.18, -6.25], max: [2.16, 1.1, -5.69], ground: [-2.07, -6.24, 2.15, -5.69] } },
      { group: 'bakGround', role: 'ground', localBounds: { min: [-3.6, 0.19, -6.75], max: [3.9, 0.23, 1.9], ground: null } },
    ] },
  { id: 'laundry', name: 'コインランドリー ふわり', plot: 'B03-P02', module: 'B03-P02', transform: { x: -18, z: 7.1, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 1,
    shelter: [[-2.85, -5.65, 2.85, 0.05], [-2.75, 0, 2.75, 0.55], [-0.55, -5.95, 0.55, -5.6]],   // roof, street canopy, back-door canopy
    parts: [
      { group: 'laundry', role: 'building', localBounds: { min: [-3.03, 0.18, -5.97], max: [3.22, 4.85, 0.56], ground: [-2.97, -5.9, 2.91, 0.06] } },
      { group: 'launFrontW', role: 'attachment', localBounds: { min: [-2.65, 0.19, 0.15], max: [-0.75, 1.17, 0.53], ground: [-2.65, 0.15, -0.75, 0.53] } },
      { group: 'launFrontE', role: 'attachment', localBounds: { min: [1.53, 0.18, 0.1], max: [3, 2.01, 1.09], ground: [1.53, 0.11, 2.76, 1.09] } },
      { group: 'launSideE', role: 'attachment', localBounds: { min: [2.8, 0.19, -4.31], max: [3.16, 1.96, -3.39], ground: [2.81, -4.3, 3.16, -3.4] } },
      { group: 'launGas', role: 'attachment', localBounds: { min: [-2.78, 0.18, -6.25], max: [-1.92, 1.6, -5.65], ground: [-2.77, -6.24, -1.93, -5.66] } },
      { group: 'launService', role: 'attachment', localBounds: { min: [0.75, 0.18, -6.29], max: [2.7, 0.99, -5.67], ground: [0.75, -6.28, 2.7, -5.68] } },
      { group: 'launGround', role: 'ground', localBounds: { min: [-3.6, 0.19, -6.9], max: [3.6, 0.23, 1.9], ground: null } },
    ] },
  { id: 'bookshop', name: '古書 しおり堂', plot: 'B03-P03', module: 'B03-P03', transform: { x: -26, z: 7.1, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 1,
    shelter: [[-3.15, -5.95, 3.15, 0.4], [-2.88, 0.4, 2.88, 0.8], [-1.65, -6, -0.5, -5.95]],   // gable roof, front eave beyond the verge, back-door eave beyond the rear verge
    parts: [
      { group: 'bookshop', role: 'building', localBounds: { min: [-3.23, 0.18, -6.04], max: [3.23, 5.16, 0.85], ground: [-3.14, -5.9, 3.14, 0.44] } },
      { group: 'bookFrontW', role: 'attachment', localBounds: { min: [-2.75, 0.19, 0.53], max: [-1.14, 1.44, 1.46], ground: [-2.75, 0.53, -1.15, 1.46] } },
      { group: 'bookFrontE', role: 'attachment', localBounds: { min: [0.7, 0.19, 0.23], max: [2.59, 1.17, 1.44], ground: [0.7, 0.23, 2.59, 1.44] } },
      { group: 'bookSideW', role: 'attachment', localBounds: { min: [-3.14, 0.19, -3.34], max: [-2.85, 0.62, -2.15], ground: [-3.14, -3.34, -2.85, -2.15] } },
      { group: 'bookUtility', role: 'attachment', localBounds: { min: [0.03, 0.19, -6.04], max: [0.86, 2.16, -5.61], ground: [0.05, -6.04, 0.85, -5.61] } },
      { group: 'bookService', role: 'attachment', localBounds: { min: [1.18, 0.18, -6.97], max: [2.82, 1.55, -5.64], ground: [1.19, -6.96, 2.81, -5.64] } },
      { group: 'bookGround', role: 'ground', localBounds: { min: [-3.6, 0.19, -6.8], max: [3.6, 0.23, 1.9], ground: null } },
    ] },
  { id: 'diner', name: 'ひだまり食堂', plot: 'B03-P04', module: 'B03-P04', transform: { x: -34, z: 7.1, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 1,
    shelter: [[-2.95, -5.5, 2.95, 0.3], [-2.88, 0.3, 2.88, 0.76], [0.15, -5.62, 1.25, -5.5]],   // mono-pitch roof, street awning, back-door eave
    parts: [
      { group: 'diner', role: 'building', localBounds: { min: [-3.01, 0.18, -5.99], max: [3.01, 4.97, 0.8], ground: [-2.94, -5.5, 2.94, 0.29] } },
      { group: 'dinerFrontW', role: 'attachment', localBounds: { min: [-3.06, 0.18, -0.04], max: [-1, 1.37, 1.13], ground: [-3.06, -0.03, -1.01, 1.13] } },
      { group: 'dinerFrontE', role: 'attachment', localBounds: { min: [1.18, 0.18, 0.16], max: [3.28, 2.25, 0.9], ground: [1.18, 0.16, 3.28, 0.87] } },
      { group: 'dinerSideW', role: 'attachment', localBounds: { min: [-3.06, 0.19, -2.98], max: [-2.77, 0.64, -1.76], ground: [-3.06, -2.98, -2.77, -1.76] } },
      { group: 'dinerSideE', role: 'attachment', localBounds: { min: [2.64, 0.18, -4.7], max: [3.22, 2.06, -2.97], ground: [2.65, -4.7, 3.22, -3] } },
      { group: 'dinerRear', role: 'attachment', localBounds: { min: [-0.66, 0.18, -5.67], max: [1.53, 1.09, -5.31], ground: [-0.65, -5.63, 1.52, -5.32] } },
      { group: 'dinerService', role: 'attachment', localBounds: { min: [1.48, 0.18, -6.06], max: [3.16, 1.4, -5.23], ground: [1.49, -6.06, 3.16, -5.24] } },
      { group: 'dinerGround', role: 'ground', localBounds: { min: [-3.5, 0.19, -6.1], max: [3.5, 0.23, 1.8], ground: null } },
    ] },
  { id: 'grocery', name: 'みどり屋 雑貨店', plot: 'B03-P05', module: 'B03-P05', transform: { x: -42, z: 7.15, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 1,
    shelter: [[-3.1, -5.9, 3.1, 0.3], [-2.85, 0.3, 2.85, 0.8], [0.95, -6.03, 2.05, -5.9]],   // gable roof, street awning, back-door canopy
    parts: [
      { group: 'grocery', role: 'building', localBounds: { min: [-3.14, 0.18, -6.05], max: [3.15, 6.38, 0.83], ground: [-3.08, -5.91, 3.08, 0.31] } },
      { group: 'groceryFrontW', role: 'attachment', localBounds: { min: [-3.31, 0.18, 0.06], max: [-1.1, 1.36, 1.1], ground: [-3.31, 0.07, -1.11, 1.1] } },
      { group: 'groceryFrontE', role: 'attachment', localBounds: { min: [1.1, 0.18, -0.01], max: [3.33, 1.36, 0.76], ground: [1.11, -0.01, 3.33, 0.76] } },
      { group: 'grocerySideW', role: 'attachment', localBounds: { min: [-3.35, 0.18, -4.89], max: [-2.83, 1.31, -0.6], ground: [-3.35, -4.89, -2.83, -0.6] } },
      { group: 'grocerySideE', role: 'attachment', localBounds: { min: [2.74, 0.19, -4.19], max: [3.25, 1.9, -0.46], ground: [2.75, -4.18, 3.25, -0.46] } },
      { group: 'groceryRear', role: 'attachment', localBounds: { min: [-1.58, 0.18, -6.12], max: [2.2, 1.9, -5.66], ground: [-1.57, -6.11, 1.2, -5.67] } },
      { group: 'groceryGround', role: 'ground', localBounds: { min: [-3.65, 0.19, -6.1], max: [3.65, 0.23, 1.85], ground: null } },
    ] },
  { id: 'hall', name: 'あじさい会館', plot: 'B03-P06', module: 'B03-P06', transform: { x: -12, z: -6.1, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.85, -4.95, 2.25, 0.35]],   // hip roof with eaves
    parts: [
      { group: 'hall', role: 'building', localBounds: { min: [-3.94, 0.18, -5.05], max: [2.74, 7.25, 0.87], ground: [-3.83, -4.94, 2.55, 0.8] } },
      { group: 'hallRamp', role: 'attachment', localBounds: { min: [-3.3, 0.19, 0.08], max: [-0.85, 1.2, 0.83], ground: [-3.3, 0.1, -0.85, 0.83] } },
      { group: 'hallNotice', role: 'attachment', localBounds: { min: [-3.78, 0.18, 1.57], max: [-1.79, 1.79, 1.97], ground: [-3.78, 1.57, -1.79, 1.96] } },
      { group: 'hallBike', role: 'attachment', localBounds: { min: [1.53, 0.19, 0.55], max: [2.9, 0.83, 1.6], ground: [1.53, 0.55, 2.9, 1.6] } },
      { group: 'hallBed', role: 'attachment', localBounds: { min: [-4.17, 0.18, -4.05], max: [-3.74, 0.57, 0.55], ground: [-4.17, -4.04, -3.74, 0.54] } },
      { group: 'hallParking', role: 'attachment', localBounds: { min: [2.84, 0.18, -5.05], max: [4.96, 1.4, 0.17], ground: [2.84, -5.05, 4.95, 0.16] } },
      { group: 'hallRear', role: 'attachment', localBounds: { min: [-2.66, 0.18, -5.12], max: [2.2, 1.29, -4.68], ground: [-2.65, -5.11, 2.2, -4.71] } },
      { group: 'hallGround', role: 'ground', localBounds: { min: [-4.4, 0.19, -5.9], max: [4.97, 0.23, 2.3], ground: null } },
    ] },
];
const structures = [...samples, ...buildings];

// Street furniture from the original L-shaped street. Provisional slots in curb/facility bands;
// P3 finalises signs, lamps and wiring. anchor = local foot of the pole.
const legacyFurniture = [
  { group: 'streetLamp',    anchor: [-3.7, 2.6],   slot: { road: 'R01', x: -6.6,  z: 18.75, rotY: Math.PI },      note: '便利店街角路灯（斑马线与转角圆弧之外）' },
  { group: 'guardRail',     anchor: [-0.85, 3.13], slot: { road: 'R01', x: -12.5, z: 18.75, rotY: Math.PI },      note: '店前护栏' },
  { group: 'trafficSignal', anchor: [5.1, -4.75],  slot: { road: 'R02', x: -3.5,  z: 22,    rotY: 0 },            note: 'X01 南向北进口信号' },
  { group: 'utilityPole',   anchor: [-4.7, -3.85], slot: { road: 'R02', x: -3.5,  z: 29.5,  rotY: -Math.PI / 2 }, note: 'A01 巷口电杆，止まれ朝向出巷车辆',
    wireAttach: [[-5.2, 5.49, -3.85], [-4.7, 5.49, -3.85], [-4.2, 5.49, -3.85]] },   // insulator tops (local); P3 wires start here
];
// Original ground pieces that the new road network replaces (P2) or regenerates (P3).
const legacyGround = [
  { group: 'base',         action: 'P2 替换为 96×96 底座' },
  { group: 'legacyGround', action: 'P2 移除：旧 L 形街道、地台、路缘、斑马线和小巷铺装由道路网络替代' },
  { group: 'wetGround',    action: 'P3 已移除，水洼、涟漪与反光由 wetStreet 按新道路生成' },
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
// Sample and building entrances take the door position projected onto the front edge.
const plotById = Object.fromEntries(plots.map(p => [p.id, p]));
function toWorld(s, x, z) {
  const t = s.transform, k = t.scale ?? SAMPLE_SCALE, c = Math.cos(t.rotY), n = Math.sin(t.rotY);
  return [t.x + k * (x * c + z * n), t.z + k * (-x * n + z * c)];
}
for (const s of structures) {
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

// ---- P3: markings, drainage, street furniture and puddles ----
// Japan drives on the left. Each intersection arm has one approach lane (the half of the carriageway
// that leads into the junction). X01 is signalised; at X02 the branch road R02 has priority and R03 stops.
const CONTROL = { X01: { kind: 'signal' }, X02: { kind: 'priority', major: 'R02' } };
const MARKING = { line: 0.15, stop: 0.45, stopGap: 1, stripe: 0.45, stripeGap: 0.45, stripeInset: 0.25,
  dash: [3, 3], solidBefore: 12, edgeInset: 0.25, diamond: [1.2, 3], diamondBefore: 10, text: [2.4, 2.2], textBefore: 2.6 };
const cwHalf = r => ROAD_TYPES[r.type].carriageway / 2;
const alongRect = (r, a0, a1, s0, s1) =>   // a = across offset from the centreline, s = along
  band(r, Math.min(a0, a1), Math.max(a0, a1), Math.min(s0, s1), Math.max(s0, s1));
const approaches = [];
for (const n of roadNodes.filter(n => n.kind === 'intersection')) for (const r of roads) {
  if (r.at !== (r.axis === 'x' ? n.z : n.x)) continue;
  const o = roads.find(q => q.axis !== r.axis && q.at === (r.axis === 'x' ? n.x : n.z)), c = o.at;
  const edge = cwHalf(o) + INTERSECTION.curbRadius + INTERSECTION.crosswalk.gap + INTERSECTION.crosswalk.width;
  const ctl = CONTROL[n.name], control = ctl.kind === 'signal' ? 'signal' : r.id === ctl.major ? 'priority' : 'stop';
  for (const side of [-1, 1]) {   // side of the junction the traffic comes from (along the road axis)
    const arm = r.axis === 'x' ? (side < 0 ? 'W' : 'E') : (side < 0 ? 'N' : 'S');
    approaches.push({ id: `${n.name}-${arm}`, node: n.id, road: r.id, arm, side, at: c, edge, control,
      lane: r.axis === 'x' ? side : -side,                  // across sign of the approach half
      heading: r.axis === 'x' ? [-side, 0] : [0, -side],   // direction of travel
      stop: c + side * (edge + MARKING.stopGap),            // stop-line face nearest the junction
      crosswalk: `${n.name}-CW-${arm}` });
  }
}
const markings = [];   // { id, kind, rect } or { id, kind, x, z, heading, size }
for (const a of approaches) {
  const r = roadById[a.road], h = cwHalf(r);
  if (a.control !== 'priority') markings.push({ id: `${a.id}-STOP`, kind: 'stop-line', rect: alongRect(r, 0, a.lane * h, a.stop, a.stop + a.side * MARKING.stop) });
  const lc = r.at + a.lane * h / 2, pt = s => r.axis === 'x' ? [s, lc] : [lc, s];
  const ds = a.stop + a.side * (MARKING.stop + MARKING.diamondBefore), clear = approaches.every(b => b.road !== a.road || b.node === a.node || Math.abs(ds - b.at) > b.edge + 4);
  if (Math.abs(ds) < BASE.half - 3 && clear) { const [x, z] = pt(ds); markings.push({ id: `${a.id}-DIA`, kind: 'diamond', x, z, heading: a.heading, size: MARKING.diamond }); }
  if (a.control === 'stop') { const [x, z] = pt(a.stop + a.side * (MARKING.stop + MARKING.textBefore)); markings.push({ id: `${a.id}-TXT`, kind: 'text', text: '止まれ', x, z, heading: a.heading, size: MARKING.text }); }
}
for (const c of crosswalks.filter(c => c.kind === 'zebra')) {   // stripes run with the traffic, carriageway only
  const r = roadById[c.road], h = cwHalf(r), [s0, s1] = r.axis === 'x' ? [c.rect[0], c.rect[2]] : [c.rect[1], c.rect[3]];
  let k = 0;
  for (let o = -h + MARKING.stripeInset; o + MARKING.stripe <= h - MARKING.stripeInset + 1e-6; o += MARKING.stripe + MARKING.stripeGap)
    markings.push({ id: `${c.id}-Z${++k}`, kind: 'zebra', rect: alongRect(r, o, o + MARKING.stripe, s0, s1) });
}
for (const r of roads) {   // centre line: dashed, solid for the last stretch before each junction
  const h = cwHalf(r), mine = approaches.filter(a => a.road === r.id);
  const gapsAt = [...new Set(mine.map(a => a.at))].map(c => { const as = mine.filter(a => a.at === c), reach = Math.max(...as.map(a => a.edge + (a.control === 'priority' ? 0 : MARKING.stopGap + MARKING.stop))); return [c - reach, c + reach]; });
  for (const [s0, s1] of gaps(gapsAt)) {
    const solid0 = gapsAt.some(g => Math.abs(g[1] - s0) < 1e-6) ? s0 + MARKING.solidBefore : s0, solid1 = gapsAt.some(g => Math.abs(g[0] - s1) < 1e-6) ? s1 - MARKING.solidBefore : s1;
    if (solid0 > s0) markings.push({ id: `${r.id}-CL-${markings.length}`, kind: 'centre', rect: alongRect(r, -MARKING.line / 2, MARKING.line / 2, s0, Math.min(solid0, s1)) });
    for (let s = solid0 + MARKING.dash[1] / 2; s + MARKING.dash[0] <= solid1; s += MARKING.dash[0] + MARKING.dash[1])
      markings.push({ id: `${r.id}-CL-${markings.length}`, kind: 'centre', rect: alongRect(r, -MARKING.line / 2, MARKING.line / 2, s, s + MARKING.dash[0]) });
    if (solid1 < s1 && solid1 >= solid0) markings.push({ id: `${r.id}-CL-${markings.length}`, kind: 'centre', rect: alongRect(r, -MARKING.line / 2, MARKING.line / 2, solid1, s1) });
    if (r.type === 'main') for (const sg of [-1, 1]) {   // edge lines on the main street
      const o = sg * (h - MARKING.edgeInset);
      markings.push({ id: `${r.id}-EL-${markings.length}`, kind: 'edge', rect: alongRect(r, o, o - sg * MARKING.line, s0, s1) });
    }
  }
}

// Drainage: an L-gutter along every straight curb, grates every ~12 m and beside each ramp,
// a covered channel down the middle of each alley, and outlets in the plinth face where they leave.
const DRAIN = { gutter: 0.3, grate: [0.7, 0.3], spacing: 12, channel: 0.3 };
const gutters = [], grates = [], outlets = [];
for (const is of islands) {
  const [x0, z0, x1, z1] = is.rect, R = INTERSECTION.curbRadius, g = DRAIN.gutter, rd = is.round;
  const runs = [   // [rect, line, at, s0, s1, outward]
    z0 > -H && [[x0 + (rd.NW ? R : 0), z0 - g, x1 - (rd.NE ? R : 0), z0], 'z', z0, x0 + (rd.NW ? R : 0), x1 - (rd.NE ? R : 0), -1],
    z1 < H && [[x0 + (rd.SW ? R : 0), z1, x1 - (rd.SE ? R : 0), z1 + g], 'z', z1, x0 + (rd.SW ? R : 0), x1 - (rd.SE ? R : 0), 1],
    x0 > -H && [[x0 - g, z0 + (rd.NW ? R : 0), x0, z1 - (rd.SW ? R : 0)], 'x', x0, z0 + (rd.NW ? R : 0), z1 - (rd.SW ? R : 0), -1],
    x1 < H && [[x1, z0 + (rd.NE ? R : 0), x1 + g, z1 - (rd.SE ? R : 0)], 'x', x1, z0 + (rd.NE ? R : 0), z1 - (rd.SE ? R : 0), 1],
  ].filter(Boolean);
  for (const [rect, line, at, s0, s1, out] of runs) {
    const id = `${is.id}-G${gutters.length + 1}`, mid = at + out * g / 2, pt = s => line === 'z' ? [s, mid] : [mid, s];
    gutters.push({ id, rect, line });
    const cuts = curbCuts.filter(k => k.line === line && Math.abs(k.at - at) < 1e-6 && k.s0 >= s0 - 1e-6 && k.s1 <= s1 + 1e-6);
    const taken = cuts.map(k => [k.s0 - 0.6, k.s1 + 0.6]);
    const ok = s => s >= s0 + 0.5 && s <= s1 - 0.5 && !taken.some(([a, b]) => s > a && s < b);
    const add = (s, why, shift = 0) => {   // run grates may slide up to `shift` to clear driveways and ramps
      for (const d of [0, ...Array.from({ length: shift * 2 }, (_, i) => (i % 2 ? -1 : 1) * (Math.floor(i / 2) + 1) * 0.5)]) if (ok(s + d)) {
        taken.push([s + d - 2, s + d + 2]); const [x, z] = pt(s + d); grates.push({ id: `${id}-GR${grates.length + 1}`, x, z, line, why }); return; } };
    for (const k of cuts.filter(k => k.kind === 'ramp')) { add(k.s0 - 0.9, 'ramp'); add(k.s1 + 0.9, 'ramp'); }
    for (let s = s0 + DRAIN.spacing / 2; s < s1; s += DRAIN.spacing) add(s, 'run', 4);
    for (const [e, face] of [[s0, -1], [s1, 1]]) if (Math.abs(Math.abs(e) - H) < 1e-6) { const [x, z] = pt(e); outlets.push({ id: `${id}-OUT`, x, z, face: line === 'z' ? [face, 0] : [0, face] }); }
  }
}
const channels = alleys.map(a => {
  const zc = (a.rect[1] + a.rect[3]) / 2, rect = [a.rect[0], zc - DRAIN.channel / 2, a.rect[2], zc + DRAIN.channel / 2];
  for (const e of [a.rect[0], a.rect[2]]) if (Math.abs(Math.abs(e) - H) < 1e-6) outlets.push({ id: `${a.id}-OUT`, x: e, z: zc, face: [Math.sign(e), 0] });
  return { id: `${a.id}-CH`, alley: a.id, rect };
});

// Street furniture in the facility bands. Signals and stop signs follow the approaches; utility poles
// run along one band of each road (the pole/cable corridor), lamps along both bands, staggered.
const FURNITURE = { lampSpacing: 16, poleSpacing: 22, maxSpan: 30, minGap: 2, entranceClear: 1.5, edgeClear: 1.5,
  poleSide: { R01: -1, R02: -1, R03: 1 }, alleyLampSpacing: 14 };
const bandPt = (r, side, s) => { const t = ROAD_TYPES[r.type], o = r.at + side * (t.carriageway / 2 + t.band / 2); return r.axis === 'x' ? [s, o] : [o, s]; };
const furniture = legacyFurniture.map(f => ({ id: f.group, kind: 'legacy', group: f.group, road: f.slot.road, x: f.slot.x, z: f.slot.z,
  extent: f.group === 'guardRail' ? 1.3 : 0 }));
function blockedAlong(r, side) {   // along-road spans of this band where nothing may stand
  const out = [];
  for (const c of crosswalks.filter(c => c.road === r.id)) out.push(r.axis === 'x' ? [c.rect[0] - 0.8, c.rect[2] + 0.8] : [c.rect[1] - 0.8, c.rect[3] + 0.8]);
  for (const k of curbCuts.filter(k => k.road === r.id && k.dir === side)) out.push([k.s0 - 0.5, k.s1 + 0.5]);
  for (const o of roads.filter(o => o.axis !== r.axis)) { const e = cwHalf(o) + INTERSECTION.curbRadius + 0.3; out.push([o.at - e, o.at + e]); }
  for (const p of plots) for (const e of p.entrances) {   // keep entrances on this side of the road clear
    const [dx, dz] = DIRS[e.facing], s = r.axis === 'x' ? e.x : e.z, across = r.axis === 'x' ? e.z : e.x;
    const faces = r.axis === 'x' ? dz !== 0 : dx !== 0, edge = r.at + side * half(r.type);
    if (faces && Math.abs(across - edge) < 1e-6) out.push([s - FURNITURE.entranceClear, s + FURNITURE.entranceClear]);
  }
  out.push([-Infinity, -H + FURNITURE.edgeClear], [H - FURNITURE.edgeClear, Infinity]);
  return out;
}
function place(r, side, s, kind, extra = {}) {
  const blocked = blockedAlong(r, side);
  for (const d of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 3, -3, 4, -4, 5, -5]) {
    const t = s + d, [x, z] = bandPt(r, side, t);
    if (blocked.some(([a, b]) => t > a && t < b)) continue;
    if (furniture.some(f => Math.hypot(f.x - x, f.z - z) < FURNITURE.minGap + (f.extent || 0))) continue;
    const f = { id: `${kind}-${r.id}-${furniture.length + 1}`, kind, road: r.id, side, s: t, x, z, ...extra };
    furniture.push(f); return f;
  }
  return null;
}
for (const a of approaches) {   // signals at the junction side of the crosswalk, stop signs at the stop line
  const r = roadById[a.road], s = a.control === 'signal' ? a.at + a.side * (a.edge - INTERSECTION.crosswalk.width - 0.5) : a.stop + a.side * (MARKING.stop + 0.4);
  if (a.control === 'priority') continue;
  const [x, z] = bandPt(r, a.lane, s), legacy = furniture.find(f => f.kind === 'legacy' && Math.hypot(f.x - x, f.z - z) < 0.3);
  const face = r.axis === 'x' ? [a.side, 0] : [0, a.side];   // towards the approaching traffic
  if (legacy) { legacy.approach = a.id; continue; }
  furniture.push({ id: `${a.control === 'signal' ? 'SIG' : 'STOP'}-${a.id}`, kind: a.control === 'signal' ? 'signal' : 'stop-sign', road: r.id, side: a.lane, s, x, z, face, approach: a.id });
}
for (const a of alleys) for (const r of roads.filter(r => r.axis === 'z')) {   // stop signs for traffic leaving the alleys
  const h = half(r.type), mouthW = Math.abs(a.rect[2] - (r.at - h)) < 1e-6, mouthE = Math.abs(a.rect[0] - (r.at + h)) < 1e-6;
  if (!mouthW && !mouthE) continue;
  const heading = mouthW ? 1 : -1, x = mouthW ? a.rect[2] - 0.6 : a.rect[0] + 0.6, z = heading > 0 ? a.rect[1] + 0.25 : a.rect[3] - 0.25;   // left of the exiting car
  if (furniture.some(f => Math.hypot(f.x - x, f.z - z) < 3.5 && f.group === 'utilityPole')) continue;   // A01: the old pole carries its 止まれ
  furniture.push({ id: `STOP-${a.id}`, kind: 'stop-sign', alley: a.id, x, z, face: [-heading, 0] });
}
const poleLines = [];
function freeAt(r, side, t) {
  const [x, z] = bandPt(r, side, t);
  return !blockedAlong(r, side).some(([a, b]) => t > a && t < b) && !furniture.some(f => Math.hypot(f.x - x, f.z - z) < FURNITURE.minGap + (f.extent || 0));
}
for (const r of roads) {   // greedy walk: next pole ~poleSpacing on, pulled back to a free spot, never > maxSpan
  const side = FURNITURE.poleSide[r.id], legacy = furniture.find(f => f.group === 'utilityPole' && f.road === r.id);
  const line = legacy ? [legacy] : [], add = s => { const [x, z] = bandPt(r, side, s), p = { id: `pole-${r.id}-${furniture.length + 1}`, kind: 'pole', road: r.id, side, s, x, z, across: r.axis === 'x' ? [0, 1] : [1, 0] }; furniture.push(p); line.push(p); return s; };
  const start = legacy ? (r.axis === 'x' ? legacy.x : legacy.z) : (() => { for (let t = -H + 4; t < 0; t += 0.5) if (freeAt(r, side, t)) return add(t); })();
  for (const dir of legacy ? [-1, 1] : [1]) {
    let prev = start;
    for (;;) {
      const target = prev + dir * FURNITURE.poleSpacing, limit = dir * (H - 2.5);
      if (dir * target > dir * limit && dir * (limit - prev) < 8) break;
      const want = dir * target > dir * limit ? limit : target;
      let got = null;
      for (let d = 0; d <= FURNITURE.maxSpan; d += 0.5) {   // back towards prev first, then further out
        for (const t of [want - dir * d, want + dir * d]) if (dir * (t - prev) >= 6 && dir * (t - prev) <= FURNITURE.maxSpan && Math.abs(t) <= H - 2 && freeAt(r, side, t)) { got = t; break; }
        if (got !== null) break;
      }
      if (got === null) break;
      prev = add(got);
    }
  }
  line.sort((p, q) => (r.axis === 'x' ? p.x - q.x : p.z - q.z));
  const spans = [];
  for (let i = 0; i + 1 < line.length; i++) spans.push([line[i].id, line[i + 1].id]);
  poleLines.push({ road: r.id, side, poles: line.map(p => p.id), spans });
}
for (const r of roads) for (const side of [-1, 1]) {   // lamps, staggered between the two bands
  for (let s = -H + 6 + (side > 0 ? FURNITURE.lampSpacing / 2 : 0); s < H - 2; s += FURNITURE.lampSpacing)
    place(r, side, s, 'lamp', { face: r.axis === 'x' ? [0, -side] : [-side, 0] });
}
for (const a of alleys) {   // small security lamps on alternating alley edges
  const len = a.rect[2] - a.rect[0];
  for (let i = 0, s = a.rect[0] + 4; s < a.rect[2] - 2; s += FURNITURE.alleyLampSpacing, i++) {
    const z = i % 2 ? a.rect[1] + 0.25 : a.rect[3] - 0.25;
    if (furniture.some(f => Math.hypot(f.x - s, f.z - z) < FURNITURE.minGap)) continue;
    furniture.push({ id: `ALAMP-${a.id}-${i + 1}`, kind: 'alley-lamp', alley: a.id, x: s, z, face: [0, i % 2 ? 1 : -1] });
  }
}

// Puddles collect along gutters, in alley channels and at low corners (deterministic seed).
let pseed = 20240917;
const prnd = () => ((pseed = (pseed * 1664525 + 1013904223) >>> 0) / 4294967296);
const puddles = [];
for (const g of gutters) {
  const len = g.line === 'z' ? g.rect[2] - g.rect[0] : g.rect[3] - g.rect[1], n = Math.floor(len / 9);
  for (let i = 0; i < n; i++) {
    const s = (g.line === 'z' ? g.rect[0] : g.rect[1]) + (i + 0.2 + prnd() * 0.6) * len / n;
    const curbAt = g.line === 'z' ? (g.rect[1] + g.rect[3]) / 2 : (g.rect[0] + g.rect[2]) / 2;
    const isl = islands.find(is => g.line === 'z' ? Math.abs(is.rect[1] - g.rect[3]) < 1e-6 || Math.abs(is.rect[3] - g.rect[1]) < 1e-6 : Math.abs(is.rect[0] - g.rect[2]) < 1e-6 || Math.abs(is.rect[2] - g.rect[0]) < 1e-6);
    const out = isl ? (g.line === 'z' ? (Math.abs(isl.rect[1] - g.rect[3]) < 1e-6 ? -1 : 1) : (Math.abs(isl.rect[0] - g.rect[2]) < 1e-6 ? -1 : 1)) : 1;
    const across = curbAt + out * (0.35 + prnd() * 0.5), rl = 0.8 + prnd() * 1.4, rw = 0.25 + prnd() * 0.35;
    puddles.push(g.line === 'z' ? { x: s, z: across, rx: rl, rz: rw, on: 'road' } : { x: across, z: s, rx: rw, rz: rl, on: 'road' });
  }
}
for (const c of channels) for (let s = c.rect[0] + 3; s < c.rect[2] - 2; s += 5 + prnd() * 4)
  puddles.push({ x: s, z: (c.rect[1] + c.rect[3]) / 2 + (prnd() - 0.5) * 0.8, rx: 0.6 + prnd() * 0.9, rz: 0.3 + prnd() * 0.3, on: 'alley' });

const LAYOUT = { BASE, SAMPLE_SCALE, ROAD_TYPES, ALLEY, INTERSECTION, PLOT_TYPES, DIRS, LEVELS, CURB_CUT,
  roadNodes, roads, alleys, roadSegments, walkways, aprons, blocks, plots, samples, buildings, structures,
  legacyFurniture, legacyGround, surfaces, crosswalks, islands, curbCuts, CONTROL, MARKING, DRAIN, FURNITURE,
  approaches, markings, gutters, grates, channels, outlets, furniture, poleLines, puddles, corridorRect, toWorld, rect };
if (typeof module !== 'undefined' && module.exports) module.exports = LAYOUT;
else global.LAYOUT = LAYOUT;
})(typeof globalThis !== 'undefined' ? globalThis : this);
