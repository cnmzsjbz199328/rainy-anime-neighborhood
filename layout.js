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
  plot('B01-P01', [-46, -46, -6, -21], 'school', 'S', { frontages: ['S', 'E'], uses: ['学校', '社区中心'], status: 'occupied', building: 'school',
    entrances: [{ at: -26, facing: 'S', kind: 'pedestrian' }, { at: -40, facing: 'E', kind: 'vehicle' }] }),
  // B02: two rows of houses; the north row is reached from alley A03.
  plot('B02-P01', [6, -31.75, 16, -21], 'house', 'S', { frontages: ['S', 'W'], uses: ['独栋住宅'], status: 'occupied', building: 'house' }),
  plot('B02-P02', [16, -31.75, 26, -21], 'house', 'S', { uses: ['独栋住宅'], status: 'occupied', building: 'house2' }),
  plot('B02-P03', [26, -31.75, 36, -21], 'house', 'S', { uses: ['独栋住宅'], status: 'occupied', building: 'house3' }),
  plot('B02-P04', [36, -31.75, 46, -21], 'house', 'S', { uses: ['独栋住宅'], status: 'occupied', building: 'house4' }),
  plot('B02-P05', [6, -46, 16, -35.25], 'house', 'S', { frontages: ['S', 'W'], uses: ['独栋住宅', '小公寓'], status: 'occupied', building: 'house5' }),
  plot('B02-P06', [16, -46, 26, -35.25], 'house', 'S', { uses: ['独栋住宅'], status: 'occupied', building: 'house6' }),
  plot('B02-P07', [26, -46, 36, -35.25], 'house', 'S', { uses: ['独栋住宅'], status: 'occupied', building: 'house7' }),
  plot('B02-P08', [36, -46, 46, -35.25], 'house', 'S', { uses: ['独栋住宅'], status: 'occupied', building: 'house8' }),
  // B03: neighbourhood shops face the main street; small public uses face R03.
  plot('B03-P01', [-14, 0, -6, 9], 'shop', 'S', { frontages: ['S', 'E'], uses: ['面包店', '药店'], status: 'occupied', building: 'bakery' }),
  plot('B03-P02', [-22, 0, -14, 9], 'shop', 'S', { uses: ['洗衣店', '花店'], status: 'occupied', building: 'laundry' }),
  plot('B03-P03', [-30, 0, -22, 9], 'shop', 'S', { uses: ['书店', '花店'], status: 'occupied', building: 'bookshop' }),
  plot('B03-P04', [-38, 0, -30, 9], 'shop', 'S', { uses: ['小餐馆', '杂货'], status: 'occupied', building: 'diner' }),
  plot('B03-P05', [-46, 0, -38, 9], 'shop', 'S', { uses: ['小店铺'], status: 'occupied', building: 'grocery' }),
  plot('B03-P06', [-18, -9, -6, 0], 'civic', 'N', { frontages: ['N', 'E'], uses: ['社区会所', '诊所'], status: 'occupied', building: 'hall' }),
  plot('B03-P07', [-30, -9, -18, 0], 'civic', 'N', { uses: ['小型公共设施'], status: 'occupied', building: 'post' }),
  plot('B03-P08', [-46, -9, -30, 0], 'park', 'N', { uses: ['口袋公园', '小神社'], status: 'occupied', building: 'shrine' }),
  // B04: koban on the main corner, clinic, a pocket park behind the eastbound bus stop.
  plot('B04-P01', [6, 0, 16, 9], 'civic', 'S', { frontages: ['S', 'W'], uses: ['交番'], status: 'occupied', building: 'koban', note: '10 宽：转角双退界后仍能放下交番与一个巡逻车位' }),
  plot('B04-P02', [16, 0, 26, 9], 'civic', 'S', { uses: ['诊所'], status: 'occupied', building: 'clinic' }),
  plot('B04-P03', [26, -9, 46, 7.5], 'park', 'S', { frontages: ['S', 'N'], uses: ['口袋公园', '绿地'], entrance: 35, status: 'occupied', building: 'pocketpark' }),
  plot('B04-P04', [6, -9, 16, 0], 'civic', 'N', { frontages: ['N', 'W'], uses: ['小神社', '公共设施'], status: 'occupied', building: 'hokora' }),
  plot('B04-P05', [16, -9, 26, 0], 'mixed', 'N', { uses: ['商住'], status: 'occupied', building: 'stationery' }),
  // B05: legacy store at the X01 corner, upgraded ramen shop beside it, legacy apartment behind on alley A01.
  plot('B05-P01', [-17, 21, -6, 30.5], 'store', 'N', { frontages: ['N', 'E'], uses: ['便利店'], status: 'occupied', sample: 'store' }),
  plot('B05-P02', [-28, 21, -19, 30.5], 'shop', 'N', { uses: ['拉面店'], status: 'occupied', building: 'ramenShop' }),
  plot('B05-P03', [-37, 21, -28, 30.5], 'shop', 'N', { uses: ['小店铺', '咖啡店'], status: 'occupied', building: 'cafe' }),
  plot('B05-P04', [-46, 21, -37, 30.5], 'shop', 'N', { uses: ['小店铺', '花店'], status: 'occupied', building: 'florist' }),
  plot('B05-P05', [-18, 34, -6, 46], 'apartment', 'N', { frontages: ['N', 'E'], uses: ['小公寓'], status: 'occupied', sample: 'apartment' }),
  plot('B05-P06', [-28, 34, -18, 46], 'house', 'N', { uses: ['独栋住宅'], status: 'occupied', building: 'house9' }),
  plot('B05-P07', [-37, 34, -28, 46], 'house', 'N', { uses: ['独栋住宅'], entrance: -29.5, note: '面宽 9：入口靠东，停车位沿巷', status: 'occupied', building: 'house10' }),
  plot('B05-P08', [-46, 34, -37, 46], 'house', 'N', { uses: ['独栋住宅'], entrance: -38.5, note: '面宽 9：入口靠东，停车位沿巷', status: 'occupied', building: 'house11' }),
  // B06: shop-houses on the main street (BS01 in front of P03), houses on alley A02.
  plot('B06-P01', [6, 21, 16, 30.5], 'mixed', 'N', { frontages: ['N', 'W'], uses: ['商住', '药店'], status: 'occupied', building: 'pharmacy' }),
  plot('B06-P02', [16, 21, 26, 30.5], 'mixed', 'N', { uses: ['商住', '理发店'], status: 'occupied', building: 'barber' }),
  plot('B06-P03', [26, 22.5, 36, 30.5], 'mixed', 'N', { uses: ['商住', '文具店'], status: 'occupied', building: 'yamashita', note: '前方为公交候车区 BS01' }),
  plot('B06-P04', [36, 21, 46, 30.5], 'mixed', 'N', { uses: ['商住', '修理铺'], status: 'occupied', building: 'yamada' }),
  plot('B06-P05', [6, 34, 16, 46], 'house', 'N', { frontages: ['N', 'W'], uses: ['独栋住宅'], status: 'occupied', building: 'house12' }),
  plot('B06-P06', [16, 34, 26, 46], 'house', 'N', { uses: ['独栋住宅'], status: 'occupied', building: 'house13' }),
  plot('B06-P07', [26, 34, 36, 46], 'house', 'N', { uses: ['独栋住宅'], status: 'occupied', building: 'house14' }),
  plot('B06-P08', [36, 34, 46, 46], 'house', 'N', { uses: ['独栋住宅'], status: 'occupied', building: 'house15' }),
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
  { id: 'apartment', name: 'こもれび荘', plot: 'B05-P05', transform: { x: -11.4, z: 33, rotY: Math.PI },
    door: { x: 0.9, z: -4.88 }, frontDir: [0, 1],
    parts: [
      { group: 'apartment', role: 'building', localBounds: { min: [-3.4, 0.13, -8.4], max: [3.91, 6.2, -4.19], ground: [-3.36, -8.26, 3.76, -4.56] } },
      { group: 'apartmentPlants', role: 'attachment', localBounds: { min: [-1.9, 0.33, -4.68], max: [-0.47, 1.01, -4.32], ground: [-1.9, -4.68, -0.47, -4.32] } },
    ] },
];

// New buildings (P5 on), one per plot, modelled in buildings/<plot>.js. Same placement rule and measured
// bounds as the samples, kept in their own list so the old samples stay review-only. parts: building =
// main volume incl. awnings and eaves (must stay in the buildable envelope); attachment = planters,
// service yard, outdoor units (must stay on the plot); ground = paving and light decals on the plot.
// shelter = local [x0, z0, x1, z1] of the roof and each awning: the rain never falls under them.
const buildings = [
  { id: 'ramenShop', name: '雨音らーめん', plot: 'B05-P02', module: 'B05-P02', transform: { x: -23.5, z: 23.96, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 1,
    shelter: [[-3.50, -5.43, 3.50, 0.42], [-2.95, 0.05, 2.95, 0.78]],
    parts: [
      { group: 'ramenShop', role: 'building', localBounds: { min: [-3.53, 0.22, -5.53], max: [3.53, 6.85, 0.81], ground: [-3.22, -5.22, 3.22, 0.23] } },
      { group: 'ramenShopFrontWest', role: 'attachment', localBounds: { min: [2.67, 0.30, 0.02], max: [3.60, 1.20, 0.65], ground: [2.67, 0.02, 3.60, 0.64] } },
      { group: 'ramenShopFrontEast', role: 'attachment', localBounds: { min: [-3.04, 0.30, 0.42], max: [-2.40, 1.06, 0.59], ground: [-3.03, 0.43, -2.41, 0.58] } },
      { group: 'ramenShopService', role: 'attachment', localBounds: { min: [3.10, 0.51, -5.00], max: [3.79, 2.76, -0.87], ground: [3.11, -5.00, 3.79, -2.26] } },
      { group: 'ramenShopRear', role: 'attachment', localBounds: { min: [-0.94, 0.35, -5.63], max: [1.40, 1.15, -5.08], ground: [-0.93, -5.62, 1.39, -5.09] } },
      { group: 'ramenShopGround', role: 'ground', localBounds: { min: [-3.53, 0.26, 0.07], max: [3.53, 0.31, 2.71], ground: [-3.40, 0.19, 3.40, 0.97] } },
    ] },
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
  { id: 'post', name: '邮政服务站', plot: 'B03-P07', module: 'B03-P07', transform: { x: -24, z: -6.1, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 1,
    shelter: [[-3.1, -5.0, 2.5, 0.1], [-2.1, 0.1, 2.1, 0.8]],   // flat roof inside the fascia, glass entrance canopy
    parts: [
      { group: 'post', role: 'building', localBounds: { min: [-3.32, 0.18, -5.04], max: [2.6, 4.6, 0.84], ground: [-3.19, -5.01, 2.51, 0.09] } },
      { group: 'postFrontE', role: 'attachment', localBounds: { min: [-3.58, 0.18, 0.09], max: [-1.5, 1.71, 0.79], ground: [-3.57, 0.1, -1.5, 0.77] } },
      { group: 'postFrontW', role: 'attachment', localBounds: { min: [1.54, 0.18, 0.19], max: [3.01, 1.44, 0.71], ground: [1.59, 0.22, 3, 0.71] } },
      { group: 'postSideE', role: 'attachment', localBounds: { min: [-5.79, 0.18, -5.94], max: [-3.14, 1.64, -0.5], ground: [-5.78, -5.93, -3.19, -0.5] } },
      { group: 'postParking', role: 'attachment', localBounds: { min: [3.2, 0.19, -5.33], max: [5.81, 1.63, 0.53], ground: [3.89, -5.33, 5.81, 0.53] } },
      { group: 'postRear', role: 'attachment', localBounds: { min: [-3.26, 0.17, -6], max: [2.74, 2.67, -4.94], ground: [-3.25, -6, 2.74, -4.94] } },
      { group: 'postGround', role: 'ground', localBounds: { min: [-4.2, 0.19, -6.1], max: [5.7, 0.23, 2.3], ground: null } },
    ] },
  { id: 'shrine', name: '雨宿神社', plot: 'B03-P08', module: 'B03-P08', transform: { x: -38, z: -5.5, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.6, floors: 1,
    shelter: [[-2.75, -4.75, 2.75, -0.45]],   // gable roof with the extended front eave over the porch
    parts: [
      { group: 'shrine', role: 'building', localBounds: { min: [-2.81, 0.17, -4.88], max: [2.79, 3.94, 0.01], ground: [-2.22, -4.53, 2.72, 0] } },
      { group: 'shrineToriiE', role: 'attachment', localBounds: { min: [-2.05, 0.17, 1.2], max: [0.27, 3.33, 2.8], ground: [-1.39, 1.81, -1.01, 2.19] } },
      { group: 'shrineToriiW', role: 'attachment', localBounds: { min: [-0.02, 0.17, 1.2], max: [2.05, 3.33, 2.8], ground: [1.01, 1.81, 1.39, 2.19] } },
      { group: 'shrineLanternE', role: 'attachment', localBounds: { min: [-3.15, 0.18, -0.2], max: [-0.95, 1.88, 2], ground: [-2.3, 0.65, -1.8, 1.15] } },
      { group: 'shrineLanternW', role: 'attachment', localBounds: { min: [0.95, 0.17, -0.2], max: [3.15, 1.88, 2], ground: [1.8, 0.65, 2.3, 1.15] } },
      { group: 'shrineChozu', role: 'attachment', localBounds: { min: [-4.32, 0.17, 0.4], max: [-2.4, 1.09, 2.2], ground: [-4.32, 0.65, -2.47, 1.93] } },
      { group: 'shrineEma', role: 'attachment', localBounds: { min: [2.7, 0.17, 0.25], max: [4.2, 1.6, 0.75], ground: [2.7, 0.25, 4.2, 0.75] } },
      { group: 'shrineStele', role: 'attachment', localBounds: { min: [2.17, 0.18, 2.08], max: [3.15, 1.49, 2.56], ground: [2.17, 2.08, 3.15, 2.55] } },
      { group: 'shrineShed', role: 'attachment', localBounds: { min: [2.95, 0.17, -4.11], max: [4.75, 2.17, -1.84], ground: [3.16, -4.1, 4.75, -1.98] } },
      { group: 'shrineRain', role: 'attachment', localBounds: { min: [-3.46, 0.17, -4.76], max: [-2.5, 2.62, -4.13], ground: [-3.46, -4.75, -2.5, -4.13] } },
      { group: 'shrineFenceE', role: 'attachment', localBounds: { min: [-7.52, 0.17, -4.98], max: [-6.56, 1.25, 2.98], ground: [-7.52, -4.98, -6.56, 2.98] } },
      { group: 'shrineFenceW', role: 'attachment', localBounds: { min: [6.61, 0.17, -4.98], max: [7.52, 1.25, 2.98], ground: [6.61, -4.98, 7.52, 2.98] } },
      { group: 'shrineFenceR', role: 'attachment', localBounds: { min: [-7.63, 0.17, -5.02], max: [7.63, 1.25, -3.98], ground: [-7.63, -5.02, 7.63, -3.98] } },
      { group: 'shrineFenceFE', role: 'attachment', localBounds: { min: [-7.63, 0.18, 2.02], max: [-0.87, 1.25, 3.02], ground: [-7.63, 2.02, -0.87, 3.02] } },
      { group: 'shrineFenceFW', role: 'attachment', localBounds: { min: [0.87, 0.17, 2], max: [7.63, 1.25, 3.02], ground: [0.87, 2, 7.63, 3.02] } },
      { group: 'shrineTreeNE', role: 'attachment', localBounds: { min: [-7.04, 0.18, -4.71], max: [-4.21, 3.32, -1.36], ground: [-7.04, -4.71, -4.21, -1.36] } },
      { group: 'shrineTreeNW', role: 'attachment', localBounds: { min: [4.69, 0.18, -4.8], max: [7.7, 3.37, -1.63], ground: [4.69, -4.8, 7.7, -1.63] } },
      { group: 'shrineTreeSE', role: 'attachment', localBounds: { min: [-7.25, 0.18, 0.36], max: [-5.25, 2.77, 2.64], ground: [-7.25, 0.36, -5.25, 2.64] } },
      { group: 'shrineTreeSW', role: 'attachment', localBounds: { min: [5.08, 0.18, 0.52], max: [6.96, 2.91, 2.67], ground: [5.08, 0.52, 6.96, 2.67] } },
      { group: 'shrineGround', role: 'ground', localBounds: { min: [-8, 0.18, -5.5], max: [8, 0.23, 3.5], ground: null } },
    ] },
  { id: 'koban', name: 'あめまち交番', plot: 'B04-P01', module: 'B04-P01', transform: { x: 11, z: 6.1, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 1,
    shelter: [[-2.9, -4.4, 3.9, 0.1], [-2.9, 0.1, 1.7, 0.8]],   // flat roof with the east bicycle shelter, front awning
    parts: [
      { group: 'koban', role: 'building', localBounds: { min: [-2.97, 0.18, -4.44], max: [3.96, 5.2, 0.83], ground: [-2.9, -4.36, 3.9, 0.1] } },
      { group: 'kobanFrontW', role: 'attachment', localBounds: { min: [-3.3, 0.18, 0.54], max: [-1.1, 1.89, 1.35], ground: [-3.3, 0.55, -1.25, 1.3] } },
      { group: 'kobanFrontE', role: 'attachment', localBounds: { min: [0.94, 0.18, 0.33], max: [3.76, 0.97, 1.21], ground: [0.95, 0.33, 3.76, 1.13] } },
      { group: 'kobanBikes', role: 'attachment', localBounds: { min: [2.28, 0.2, -2.84], max: [3.47, 1.13, -1.16], ground: [2.28, -2.84, 3.46, -1.16] } },
      { group: 'kobanSideW', role: 'attachment', localBounds: { min: [-4.85, 0.18, -4.38], max: [-2.85, 1.66, -0.29], ground: [-4.85, -4.37, -2.85, -0.3] } },
      { group: 'kobanRear', role: 'attachment', localBounds: { min: [-3.09, 0.18, -5.4], max: [3.41, 2.63, -4.12], ground: [-3.09, -5.15, 3.4, -4.12] } },
      { group: 'kobanGround', role: 'ground', localBounds: { min: [-4.9, 0.19, -5.9], max: [4.9, 0.23, 2.9], ground: null } },
    ] },
  { id: 'clinic', name: 'あめまち診療所', plot: 'B04-P02', module: 'B04-P02', transform: { x: 21, z: 6.1, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 1,
    shelter: [[-3.8, -5.0, 3.9, 0.1], [-1.1, 0.1, 1.1, 0.75]],   // flat roof with the east carport, door canopy
    parts: [
      { group: 'clinic', role: 'building', localBounds: { min: [-3.87, 0.18, -5.04], max: [3.96, 4.3, 0.78], ground: [-3.8, -4.96, 3.9, 0.09] } },
      { group: 'clinicFrontW', role: 'attachment', localBounds: { min: [-3.56, 0.18, 0.35], max: [-1.6, 1.51, 1.64], ground: [-3.55, 0.35, -1.6, 1.64] } },
      { group: 'clinicFrontE', role: 'attachment', localBounds: { min: [0.94, 0.19, 0.35], max: [1.99, 1.11, 0.81], ground: [0.95, 0.35, 1.99, 0.8] } },
      { group: 'clinicCar', role: 'attachment', localBounds: { min: [1.9, 0.21, -3.94], max: [3.6, 1.75, -0.4], ground: [1.9, -3.94, 3.6, -0.65] } },
      { group: 'clinicSideW', role: 'attachment', localBounds: { min: [-4.75, 0.18, -4.57], max: [-3.72, 1.8, -0.09], ground: [-4.75, -4.57, -3.72, -0.09] } },
      { group: 'clinicRear', role: 'attachment', localBounds: { min: [-3.95, 0.18, -5.93], max: [3.53, 2.63, -4.9], ground: [-3.95, -5.93, 3.53, -4.9] } },
      { group: 'clinicGround', role: 'ground', localBounds: { min: [-4.9, 0.19, -5.9], max: [4.9, 0.28, 2.9], ground: null } },
    ] },
  { id: 'pocketpark', name: '雨だまり公園', plot: 'B04-P03', module: 'B04-P03', transform: { x: 35, z: 6.4, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.19, floors: 0,
    shelter: [[3.6, -7.6, 8.0, -3.2]],   // pavilion hip roof
    parts: [
      { group: 'park', role: 'building', localBounds: { min: [3.54, 0.18, -7.66], max: [8.1, 3.78, -3.1], ground: [3.95,  -7.25,  8.1,  -3.1] } },
      { group: 'parkSign', role: 'attachment', localBounds: { min: [-3.14, 0.18, -0.29], max: [-1.6, 1.04, 0.31], ground: [-3.14,  -0.29,  -1.6,  0.3] } },
      { group: 'parkBin', role: 'attachment', localBounds: { min: [1.89, 0.19, -0.36], max: [2.91, 1.05, 0.16], ground: [1.93,  -0.31,  2.87,  0.11] } },
      { group: 'parkBenchA', role: 'attachment', localBounds: { min: [-4.3, 0.19, -3.2], max: [-2.1, 1.07, -1.8], ground: [-3.95,  -2.77,  -2.45,  -2.35] } },
      { group: 'parkBenchB', role: 'attachment', localBounds: { min: [-1.1, 0.18, -12.2], max: [1.1, 1.07, -10.8], ground: [-0.75,  -11.77,  0.75,  -11.35] } },
      { group: 'parkBenchC', role: 'attachment', localBounds: { min: [2.7, 0.18, -9.9], max: [4.1, 1.07, -7.7], ground: [3.25,  -9.55,  3.67,  -8.05] } },
      { group: 'parkPond', role: 'attachment', localBounds: { min: [-7.76, 0.17, -10.95], max: [-3.5, 1.3, -7.9], ground: [-7.76,  -10.95,  -3.82,  -8.13] } },
      { group: 'parkTreeW', role: 'attachment', localBounds: { min: [-8.51, 0.19, -5.78], max: [-4.56, 3.75, -2.19], ground: [-8.51,  -5.78,  -4.56,  -2.19] } },
      { group: 'parkTreeC', role: 'attachment', localBounds: { min: [-1.58, 0.19, -10.02], max: [1.86, 3.25, -6.68], ground: [-1.58,  -10.02,  1.86,  -6.68] } },
      { group: 'parkTreeCh', role: 'attachment', localBounds: { min: [6.53, 0.19, -11.79], max: [9.86, 3.25, -8.79], ground: [6.53,  -11.79,  9.86,  -8.79] } },
      { group: 'parkTreeNW', role: 'attachment', localBounds: { min: [-7.65, 0.19, -14.61], max: [-4.57, 3.6, -11.29], ground: [-7.65,  -14.61,  -4.86,  -11.29] } },
      { group: 'parkTreeN', role: 'attachment', localBounds: { min: [1.07, 0.19, -14.95], max: [4.9, 3.7, -11.53], ground: [1.07,  -14.95,  4.9,  -11.53] } },
      { group: 'parkTreeNE', role: 'attachment', localBounds: { min: [7.53, 0.19, -14.63], max: [10.35, 3.55, -11.62], ground: [8.17,  -14.24,  10.35,  -11.87] } },
      { group: 'parkTreeFW', role: 'attachment', localBounds: { min: [-7.81, 0.19, -2.01], max: [-5.9, 2.6, 0.38], ground: [-7.81,  -2.01,  -5.9,  0.38] } },
      { group: 'parkTreeFE', role: 'attachment', localBounds: { min: [7.62, 0.19, -2.3], max: [10.16, 2.7, 0.34], ground: [7.62,  -2.3,  10.16,  0.34] } },
      { group: 'parkEdgeW', role: 'attachment', localBounds: { min: [-8.93, 0.19, -15.26], max: [-7.91, 1.05, 0.96], ground: [-8.93,  -15.26,  -7.91,  0.96] } },
      { group: 'parkEdgeE', role: 'attachment', localBounds: { min: [9.87, 0.18, -15.26], max: [10.93, 1.05, 0.96], ground: [9.87,  -15.26,  10.93,  0.96] } },
      { group: 'parkEdgeN', role: 'attachment', localBounds: { min: [-8.96, 0.18, -15.38], max: [10.91, 1.05, -14.34], ground: [-8.96,  -15.38,  10.91,  -14.34] } },
      { group: 'parkEdgeFW', role: 'attachment', localBounds: { min: [-8.96, 0.18, -1.05], max: [-0.2, 1.49, 1.05], ground: [-8.96,  0.03,  -1.05,  1.03] } },
      { group: 'parkEdgeFE', role: 'attachment', localBounds: { min: [0.2, 0.18, -1.05], max: [10.91, 1.49, 1.05], ground: [1.05,  0.02,  10.91,  1.03] } },
      { group: 'parkLampW', role: 'attachment', localBounds: { min: [-5.4, 0.18, -13.1], max: [-0.5, 1.64, -4], ground: [-4.35,  -12.05,  -1.55,  -5.05] } },
      { group: 'parkLampC', role: 'attachment', localBounds: { min: [-4.1, 0.18, -7.4], max: [2.75, 1.64, -2.1], ground: [-3.05,  -6.35,  1.7,  -3.15] } },
      { group: 'parkLampE', role: 'attachment', localBounds: { min: [1.35, 0.18, -13.2], max: [9.1, 1.64, -0.8], ground: [2.4,  -12.15,  8.05,  -1.85] } },
      { group: 'parkGround', role: 'ground', localBounds: { min: [-8.9, 0.19, -15.3], max: [10.9, 0.25, 1.05], ground: null } },
    ] },
  { id: 'hokora', name: '辻の小社', plot: 'B04-P04', module: 'B04-P04', transform: { x: 11, z: -5.5, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.55, floors: 1,
    shelter: [[-2.2, -4.35, 2.2, -0.5], [-1.78, -1.15, 1.78, 0.15]],   // pyramid roof, gabled front porch roof
    parts: [
      { group: 'hokora', role: 'building', localBounds: { min: [-2.23, 0.18, -4.39], max: [2.23, 4.17, 0.22], ground: [-1.67,  -4.32,  2.13,  -0.1] } },
      { group: 'hokoraToriiE', role: 'attachment', localBounds: { min: [-1.9, 0.19, 1.4], max: [0.26, 3.16, 2.9], ground: [-1.27,  1.98,  -0.93,  2.32] } },
      { group: 'hokoraToriiW', role: 'attachment', localBounds: { min: [-0.03, 0.18, 1.4], max: [1.89, 3.16, 2.9], ground: [0.93,  1.98,  1.27,  2.32] } },
      { group: 'hokoraLanternE', role: 'attachment', localBounds: { min: [-2.95, 0.18, 0], max: [-0.95, 1.79, 2], ground: [-2.2,  0.75,  -1.7,  1.25] } },
      { group: 'hokoraLanternW', role: 'attachment', localBounds: { min: [0.95, 0.19, 0], max: [2.95, 1.79, 2], ground: [1.7,  0.75,  2.2,  1.25] } },
      { group: 'hokoraChozu', role: 'attachment', localBounds: { min: [-4, 0.18, 0.5], max: [-2.19, 1.1, 2.3], ground: [-3.98,  0.75,  -2.19,  2.03] } },
      { group: 'hokoraEma', role: 'attachment', localBounds: { min: [2.35, 0.18, 0.15], max: [3.85, 1.61, 0.65], ground: [2.35,  0.15,  3.85,  0.65] } },
      { group: 'hokoraStele', role: 'attachment', localBounds: { min: [2.62, 0.18, 2.03], max: [3.59, 1.49, 2.56], ground: [2.63,  2.03,  3.59,  2.55] } },
      { group: 'hokoraJizo', role: 'attachment', localBounds: { min: [-4.3, 0.18, -5.15], max: [-2.7, 1.23, -3.55], ground: [-4.25,  -4.6,  -3.05,  -4.1] } },
      { group: 'hokoraRain', role: 'attachment', localBounds: { min: [-2.4,0.19,-4.86], max: [-1.59,2.67,-4.25], ground: [-2.4,-4.85,-1.6,-4.25] } },
      { group: 'hokoraFenceE', role: 'attachment', localBounds: { min: [-4.97, 0.18, -5.33], max: [-4.01, 1.26, 2.93], ground: [-4.97,  -5.33,  -4.01,  2.93] } },
      { group: 'hokoraFenceW', role: 'attachment', localBounds: { min: [4.05, 0.18, -5.33], max: [4.97, 1.26, 2.93], ground: [4.05,  -5.33,  4.97,  2.93] } },
      { group: 'hokoraFenceR', role: 'attachment', localBounds: { min: [-4.98, 0.18, -5.5], max: [4.98, 1.26, -4.5], ground: [-4.98,  -5.5,  4.98,  -4.5] } },
      { group: 'hokoraFenceFE', role: 'attachment', localBounds: { min: [-4.98, 0.18, 2.01], max: [-0.87, 1.26, 3.02], ground: [-4.98,  2.01,  -0.87,  3.02] } },
      { group: 'hokoraFenceFW', role: 'attachment', localBounds: { min: [0.87, 0.18, 2.1], max: [4.98, 1.26, 3.02], ground: [0.87,  2.1,  4.98,  3.02] } },
      { group: 'hokoraTreeNE', role: 'attachment', localBounds: { min: [-4.92, 0.19, -3.91], max: [-2.21, 3.33, -1.1], ground: [-4.92,  -3.91,  -2.21,  -1.1] } },
      { group: 'hokoraTreeNW', role: 'attachment', localBounds: { min: [2.18, 0.19, -4.8], max: [4.68, 3.54, -2.06], ground: [2.3,  -4.62,  4.68,  -2.06] } },
      { group: 'hokoraTreeSE', role: 'attachment', localBounds: { min: [-4.79, 0.19, 1.08], max: [-3.13, 2.58, 2.71], ground: [-4.79,  1.08,  -3.13,  2.71] } },
      { group: 'hokoraGround', role: 'ground', localBounds: { min: [-4.95, 0.19, -5.48], max: [4.95, 0.23, 3.48], ground: null } },
    ] },
  { id: 'stationery', name: 'ことのは文具店', plot: 'B04-P05', module: 'B04-P05', transform: { x: 21, z: -6.3, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 3,
    shelter: [[-4.35, -5.05, 4.45, 0.35], [-4.05, 0, 0.9, 0.95], [-3.15, -5.15, -2.1, -4.7]],   // hip roof merged with the west bicycle shelter (the two small yard corners beside it are treated as covered), balcony slab, rear canopy
    parts: [
      { group: 'stationery', role: 'building', localBounds: { min: [-4.5,0.18,-5.16], max: [4.46,11.27,1.1], ground: [-4.06,-5,4.46,0.95] } },
      { group: 'stationeryFrontW', role: 'attachment', localBounds: { min: [-4.01,0.18,0.27], max: [-0.82,1.09,1.58], ground: [-4.01,0.27,-0.82,1.58] } },
      { group: 'stationeryFrontE', role: 'attachment', localBounds: { min: [1.04,0.18,0.1], max: [2.61,1.3,1.18], ground: [1.04,0.56,2.6,1.18] } },
      { group: 'stationeryRear', role: 'attachment', localBounds: { min: [-3.69,0.18,-5.24], max: [2.26,1.3,-4.79], ground: [-3.69,-5.23,2.25,-4.81] } },
      { group: 'stationeryGround', role: 'ground', localBounds: { min: [-4.9,0.19,-5.35], max: [4.6,0.23,2], ground: null } },
    ] },
  { id: 'pharmacy', name: 'ひなた薬局', plot: 'B06-P01', module: 'B06-P01', transform: { x: 11, z: 23.4, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 3,
    shelter: [[-4.4, -4.95, 3.75, 0.25], [-4.2, 0, 0.9, 0.95], [-3.15, -5.15, -2.1, -4.7]],   // hip roof merged with the west bicycle shelter, balcony slab, rear canopy
    parts: [
      { group: 'pharmacy', role: 'building', localBounds: { min: [-4.5,0.18,-5.15], max: [3.85,11.27,1.1], ground: [-4.21,-5,3.8,0.95] } },
      { group: 'pharmacyFrontW', role: 'attachment', localBounds: { min: [-4.19,0.18,0.27], max: [-0.82,1.09,1.58], ground: [-4.19,0.27,-0.82,1.58] } },
      { group: 'pharmacyFrontE', role: 'attachment', localBounds: { min: [0.79,0.19,0.1], max: [2.46,1.3,1.18], ground: [0.79,0.56,2.45,1.18] } },
      { group: 'pharmacyRear', role: 'attachment', localBounds: { min: [-3.69,0.18,-5.24], max: [2.25,1.3,-4.78], ground: [-3.69,-5.23,2.25,-4.81] } },
      { group: 'pharmacyGround', role: 'ground', localBounds: { min: [-4.75,0.19,-5.35], max: [3.9,0.23,2], ground: null } },
    ] },
  { id: 'barber', name: 'やまの理髪店', plot: 'B06-P02', module: 'B06-P02', transform: { x: 21, z: 23.4, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 3,
    shelter: [[-4.4, -5.5, 4.4, 0.3], [-4.2, 0, 0.9, 0.95], [-3.15, -5.15, -2.1, -4.7]],   // hip roof merged with the west bicycle shelter (the yard corners beside it are treated as covered), balcony slab, rear canopy
    parts: [
      { group: 'barber', role: 'building', localBounds: { min: [-4.5,0.18,-5.65], max: [4.46,11.3,1.1], ground: [-4.16,-5.5,4.44,0.95] } },
      { group: 'barberFrontW', role: 'attachment', localBounds: { min: [-4.21,0.18,0.19], max: [-0.82,1.4,1.64], ground: [-4.21,0.2,-0.82,1.63] } },
      { group: 'barberFrontE', role: 'attachment', localBounds: { min: [0.8,0.19,0.1], max: [2.56,1.29,1.18], ground: [0.8,0.56,2.55,1.18] } },
      { group: 'barberEast', role: 'attachment', localBounds: { min: [-4.47,0.18,-5.33], max: [-4.03,1.57,-1.28], ground: [-4.47,-5.32,-4.03,-1.28] } },
      { group: 'barberRear', role: 'attachment', localBounds: { min: [-4.12,0.18,-5.74], max: [2.25,1.3,-5.28], ground: [-4.12,-5.73,2.25,-5.31] } },
      { group: 'barberGround', role: 'ground', localBounds: { min: [-4.5,0.19,-5.75], max: [4.45,0.23,2], ground: null } },
    ] },
  { id: 'yamashita', name: 'やました文具店', plot: 'B06-P03', module: 'B06-P03', transform: { x: 31, z: 24.6, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 3,
    shelter: [[-4.4, -4.7, 3.3, 0.3], [-3.05, 0, 0.95, 0.8], [-2.4, -4.8, -1.3, -4.4]],   // hip roof merged with the east bicycle shed (the front-corner yard beside it is treated as covered), balcony slab, rear canopy
    parts: [
      { group: 'yamashita', role: 'building', localBounds: { min: [-4.41,0.18,-4.81], max: [3.39,10.92,1], ground: [-4.39,-4.7,3.17,0.84] } },
      { group: 'yamashitaFrontW', role: 'attachment', localBounds: { min: [-3.95,0.18,0.29], max: [-0.67,1.44,1.41], ground: [-3.95,0.3,-0.68,1.4] } },
      { group: 'yamashitaFrontE', role: 'attachment', localBounds: { min: [0.9,0.18,0.1], max: [2.96,1.3,1.4], ground: [0.9,0.3,2.95,1.4] } },
      { group: 'yamashitaWest', role: 'attachment', localBounds: { min: [3.05,0.18,-3.79], max: [4.51,1.23,-0.09], ground: [3.22,-3.78,4.51,-0.09] } },
      { group: 'yamashitaRear', role: 'attachment', localBounds: { min: [-3,0.18,-5.17], max: [2.66,1.3,-4.49], ground: [-2.95,-5.13,2.65,-4.51] } },
      { group: 'yamashitaGround', role: 'ground', localBounds: { min: [-4.45,0.19,-5.45], max: [4.45,0.23,2], ground: null } },
    ] },
  { id: 'yamada', name: '山田修理舗', plot: 'B06-P04', module: 'B06-P04', transform: { x: 41, z: 23.3, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 3,
    shelter: [[-3.2, -5.9, 4.4, 0.3], [-2.95, 0, 0.95, 0.8], [-0.2, -5.95, 0.95, -5.6]],   // pyramid hip roof merged with the west bicycle shed (the front-corner yard beside it is treated as covered), balcony slab, rear canopy
    parts: [
      { group: 'yamada', role: 'building', localBounds: { min: [-3.3,0.18,-6.02], max: [4.41,11.23,1], ground: [-2.96,-5.9,4.38,0.84] } },
      { group: 'yamadaFrontW', role: 'attachment', localBounds: { min: [-3.92,0.19,0.35], max: [-0.67,1.21,1.74], ground: [-3.92,0.35,-0.68,1.74] } },
      { group: 'yamadaFrontE', role: 'attachment', localBounds: { min: [0.9,0.18,0.1], max: [2.66,1.3,1.43], ground: [0.9,0.3,2.65,1.43] } },
      { group: 'yamadaEast', role: 'attachment', localBounds: { min: [-4.57,0.18,-5.93], max: [-2.98,3.59,-0.47], ground: [-4.57,-5.92,-2.98,-0.48] } },
      { group: 'yamadaWest', role: 'attachment', localBounds: { min: [3.02,0.18,-6.03], max: [4.51,1.79,-4.12], ground: [3.02,-6.02,4.5,-4.13] } },
      { group: 'yamadaRear', role: 'attachment', localBounds: { min: [-3.14,0.18,-6.14], max: [2.86,1.3,-5.68], ground: [-3.14,-6.13,2.85,-5.7] } },
      { group: 'yamadaGround', role: 'ground', localBounds: { min: [-4.45,0.19,-6.6], max: [4.45,0.23,2], ground: null } },
    ] },
  { id: 'house', name: '独栋住宅 1', plot: 'B02-P01', module: 'B02-P01', transform: { x: 11.5, z: -23.6, rotY: 0 },
    door: { x: -0.5, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.4, -6.4, 3.35, 0.5]],   // gable roof merged with the left carport (the rear-left yard corner beside it is treated as covered)
    parts: [
      { group: 'house', role: 'building', localBounds: { min: [-3.46,0.18,-6.46], max: [3.48,7.59,0.56], ground: [-3.43,-6.25,3.41,0.5] } },
      { group: 'houseGarden', role: 'attachment', localBounds: { min: [-1.16,0.18,0.43], max: [4.44,3.04,2.56], ground: [-0.03,0.43,4.43,2.55] } },
      { group: 'houseEast', role: 'attachment', localBounds: { min: [3.12,0.18,-5.12], max: [4.41,1.59,-0.2], ground: [3.12,-5.12,4.41,-0.2] } },
      { group: 'houseRear', role: 'attachment', localBounds: { min: [-1.08,0.18,-6.84], max: [2.73,0.93,-6.08], ground: [-1.08,-6.84,2.73,-6.12] } },
      { group: 'houseGround', role: 'ground', localBounds: { min: [-3.4,0.19,-6.55], max: [4.3,0.23,2.5], ground: null } },
    ] },
  { id: 'house2', name: '独栋住宅 2', plot: 'B02-P02', module: 'B02-P02', transform: { x: 21, z: -23.6, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.9, -6.35, 3.88, 0.5]],   // single-pitch roof merged with the right carport (the rear corner beside it is treated as covered)
    parts: [
      { group: 'house2', role: 'building', localBounds: { min: [-3.98,0.18,-6.39], max: [3.91,7.88,0.55], ground: [-3.91,-6.3,3.88,0.5] } },
      { group: 'house2Garden', role: 'attachment', localBounds: { min: [-4.93,0.18,0.2], max: [0.66,3.04,2.55], ground: [-4.93,0.2,-0.71,2.55] } },
      { group: 'house2West', role: 'attachment', localBounds: { min: [-4.88,0.18,-6.15], max: [-3.39,1.69,0.39], ground: [-4.88,-6.15,-3.39,0.38] } },
      { group: 'house2East', role: 'attachment', localBounds: { min: [1.98,0.18,-5.73], max: [4.84,1.35,0.35], ground: [1.98,-5.73,4.84,0.35] } },
      { group: 'house2Rear', role: 'attachment', localBounds: { min: [-3.41,0.18,-7.04], max: [1.82,0.93,-5.99], ground: [-3.41,-7.04,1.82,-6] } },
      { group: 'house2Ground', role: 'ground', localBounds: { min: [-4.7,0.19,-7.1], max: [4.6,0.23,2.5], ground: null } },
    ] },
  { id: 'house3', name: '独栋住宅 3', plot: 'B02-P03', module: 'B02-P03', transform: { x: 31, z: -23.6, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.85, -6.4, 3.88, 0.5], [-3.4, 0, -0.9, 0.5], [-0.75, 0, 1.75, 0.5]],   // tile gable roof merged with the right carport (the rear corner beside it is treated as covered), balcony slab, door hood
    parts: [
      { group: 'house3', role: 'building', localBounds: { min: [-3.98,0.18,-6.51], max: [3.93,7.51,0.56], ground: [-3.91,-6.35,3.92,0.51] } },
      { group: 'house3Garden', role: 'attachment', localBounds: { min: [-4.83,0.18,0.51], max: [0.65,3.04,2.56], ground: [-4.83,0.52,-0.86,2.55] } },
      { group: 'house3West', role: 'attachment', localBounds: { min: [-4.89,0.18,-5.85], max: [-3.49,1.69,0.41], ground: [-4.88,-5.85,-3.49,0.41] } },
      { group: 'house3East', role: 'attachment', localBounds: { min: [2.02,0.19,-5.73], max: [4.89,1.39,0.35], ground: [2.02,-5.73,4.89,0.35] } },
      { group: 'house3Rear', role: 'attachment', localBounds: { min: [-3.38,0.18,-6.97], max: [1.64,1.01,-6.08], ground: [-3.38,-6.95,1.46,-6.11] } },
      { group: 'house3Ground', role: 'ground', localBounds: { min: [-4.7,0.19,-7.1], max: [4.6,0.23,2.5], ground: null } },
    ] },
  { id: 'house4', name: '独栋住宅 4', plot: 'B02-P04', module: 'B02-P04', transform: { x: 41, z: -23.6, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.9, -6.0, 3.5, 0.5]],   // flat roof + front ledge merged with the left carport (the rear-left corner beside it is treated as covered)
    parts: [
      { group: 'house4', role: 'building', localBounds: { min: [-3.96,0.18,-6.07], max: [3.9,7.1,0.56], ground: [-3.93,-6.06,3.53,0.5] } },
      { group: 'house4Gate', role: 'attachment', localBounds: { min: [-1.32,0.18,0.5], max: [0.71,1.34,2.25], ground: [-1.32,1.03,-0.99,1.91] } },
      { group: 'house4Garden', role: 'attachment', localBounds: { min: [0.55,0.19,0.42], max: [4.94,3.04,2.56], ground: [0.87,0.42,4.94,2.55] } },
      { group: 'house4East', role: 'attachment', localBounds: { min: [3.47,0.18,-6.11], max: [4.92,1.69,0.31], ground: [3.47,-6.1,4.91,0.3] } },
      { group: 'house4Rear', role: 'attachment', localBounds: { min: [-2.63,0.18,-7.05], max: [3.53,0.93,-5.99], ground: [-2.63,-7.05,3.53,-6] } },
      { group: 'house4Ground', role: 'ground', localBounds: { min: [-4.7,0.19,-7.1], max: [4.7,0.23,2.5], ground: null } },
    ] },
  { id: 'house5', name: '独栋住宅 5', plot: 'B02-P05', module: 'B02-P05', transform: { x: 11.5, z: -37.85, rotY: 0 },
    door: { x: -0.5, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.35, -6.3, 3.4, 0.5], [-3.2, 0, 1.5, 0.55]],   // tile roof merged with the right carport (the rear corner beside it is treated as covered), pent hood across the front
    parts: [
      { group: 'house5', role: 'building', localBounds: { min: [-3.48,0.18,-6.4], max: [3.43,7.43,0.58], ground: [-3.41,-6.25,3.42,0.5] } },
      { group: 'house5Step', role: 'attachment', localBounds: { min: [-1.16,0.18,0.5], max: [0.16,0.26,2.25], ground: null } },
      { group: 'house5Garden', role: 'attachment', localBounds: { min: [-4.94,0.18,0.07], max: [-0.96,3.04,2.56], ground: [-4.93,0.07,-0.97,2.55] } },
      { group: 'house5FrontE', role: 'attachment', localBounds: { min: [0.36,0.19,0.36], max: [1.43,0.87,1.35], ground: [0.36,0.36,1.43,1.35] } },
      { group: 'house5West', role: 'attachment', localBounds: { min: [-4.96,0.18,-5.7], max: [-3.39,1.69,1.7], ground: [-4.95,-5.7,-3.39,1.7] } },
      { group: 'house5East', role: 'attachment', localBounds: { min: [1.68,0.18,-5.73], max: [4.32,1.24,0.35], ground: [1.68,-5.73,4.32,0.35] } },
      { group: 'house5Rear', role: 'attachment', localBounds: { min: [-3.05,0.19,-6.95], max: [1.39,0.98,-6.08], ground: [-3.05,-6.94,1.39,-6.1] } },
      { group: 'house5Ground', role: 'ground', localBounds: { min: [-4.9,0.19,-7.1], max: [4.45,0.23,2.5], ground: null } },
    ] },
  { id: 'house6', name: '独栋住宅 6', plot: 'B02-P06', module: 'B02-P06', transform: { x: 21, z: -37.85, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.6, -6.3, 3.88, 0.5], [-0.65, 0, 1.05, 0.55], [-2.85, -6.55, -0.45, -6.0]],   // hip roof merged with the right carport (the rear corner beside it is treated as covered), door hood, rear awning
    parts: [
      { group: 'house6', role: 'building', localBounds: { min: [-3.73,0.18,-6.61], max: [3.91,7.23,0.56], ground: [-3.66,-6.25,3.88,0.5] } },
      { group: 'house6Step', role: 'attachment', localBounds: { min: [-0.7,0.18,0.5], max: [0.71,0.26,2.25], ground: null } },
      { group: 'house6Garden', role: 'attachment', localBounds: { min: [-4.94,0.18,0.35], max: [-0.55,3.04,2.56], ground: [-4.93,0.7,-0.87,2.55] } },
      { group: 'house6FrontE', role: 'attachment', localBounds: { min: [0.41,0.19,0.37], max: [1.52,0.86,1.41], ground: [0.41,0.37,1.52,1.41] } },
      { group: 'house6West', role: 'attachment', localBounds: { min: [-4.96,0.18,-5.61], max: [-3.39,1.7,1.61], ground: [-4.95,-5.6,-3.39,1.6] } },
      { group: 'house6East', role: 'attachment', localBounds: { min: [1.77,0.18,-5.73], max: [4.41,1.2,0.39], ground: [1.78,-5.73,4.41,0.39] } },
      { group: 'house6Rear', role: 'attachment', localBounds: { min: [-3.29,0.18,-7.06], max: [1.87,1.02,-6.08], ground: [-3.29,-7.06,1.87,-6.13] } },
      { group: 'house6Ground', role: 'ground', localBounds: { min: [-4.9,0.19,-7.1], max: [4.6,0.23,2.5], ground: null } },
    ] },
  { id: 'house7', name: '独栋住宅 7', plot: 'B02-P07', module: 'B02-P07', transform: { x: 31, z: -37.85, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.9, -6.35, 3.6, 0.5], [-1.6, 0, 3.4, 0.56]],   // salt-box roof merged with the left carport (the rear corner beside it is treated as covered), front canopy
    parts: [
      { group: 'house7', role: 'building', localBounds: { min: [-3.96,0.18,-6.45], max: [3.73,7.56,0.58], ground: [-3.92,-6.3,3.66,0.5] } },
      { group: 'house7Step', role: 'attachment', localBounds: { min: [-0.7,0.18,0.5], max: [0.7,0.26,2.25], ground: null } },
      { group: 'house7Garden', role: 'attachment', localBounds: { min: [0.3,0.18,0.35], max: [4.56,3.04,2.56], ground: [0.67,0.7,4.56,2.55] } },
      { group: 'house7FrontW', role: 'attachment', localBounds: { min: [-1.43,0.19,0.32], max: [-0.85,0.57,0.95], ground: [-1.43,0.32,-0.85,0.95] } },
      { group: 'house7West', role: 'attachment', localBounds: { min: [-4.96,0.18,-5.61], max: [-4.05,1.13,1.61], ground: [-4.95,-5.6,-4.05,1.6] } },
      { group: 'house7East', role: 'attachment', localBounds: { min: [3.34,0.18,-5.86], max: [4.79,1.7,2.03], ground: [3.34,-5.85,4.79,2.03] } },
      { group: 'house7Rear', role: 'attachment', localBounds: { min: [-1.53,0.19,-7.02], max: [3.14,1.07,-6.05], ground: [-1.53,-6.84,3.14,-6.05] } },
      { group: 'house7Ground', role: 'ground', localBounds: { min: [-4.9,0.19,-7.1], max: [4.6,0.23,2.5], ground: null } },
    ] },
  { id: 'house8', name: '独栋住宅 8', plot: 'B02-P08', module: 'B02-P08', transform: { x: 41, z: -37.85, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.6, -6.3, 3.88, 0.5], [-3.15, 0, 1.35, 0.58]],   // hip roof merged with the right carport (the rear corner beside it is treated as covered), balcony and its tile canopy
    parts: [
      { group: 'house8', role: 'building', localBounds: { min: [-3.73,0.18,-6.4], max: [3.91,7.51,0.6], ground: [-3.66,-6.25,3.88,0.5] } },
      { group: 'house8Step', role: 'attachment', localBounds: { min: [-0.7,0.18,0.51], max: [0.7,0.26,2.25], ground: null } },
      { group: 'house8Garden', role: 'attachment', localBounds: { min: [-4.94,0.18,0.35], max: [-0.55,3.04,2.56], ground: [-4.93,0.7,-0.87,2.55] } },
      { group: 'house8FrontE', role: 'attachment', localBounds: { min: [0.46,0.19,0.37], max: [1.52,0.82,1.38], ground: [0.46,0.37,1.52,1.38] } },
      { group: 'house8West', role: 'attachment', localBounds: { min: [-4.96,0.18,-5.61], max: [-3.39,1.7,1.61], ground: [-4.95,-5.6,-3.39,1.6] } },
      { group: 'house8East', role: 'attachment', localBounds: { min: [1.67,0.18,-5.73], max: [4.33,1.14,0.35], ground: [1.68,-5.73,4.33,0.35] } },
      { group: 'house8Rear', role: 'attachment', localBounds: { min: [-3.28,0.18,-7.07], max: [1.9,1.04,-6.09], ground: [-3.28,-7.07,1.9,-6.13] } },
      { group: 'house8Ground', role: 'ground', localBounds: { min: [-4.9,0.19,-7.1], max: [4.6,0.23,2.5], ground: null } },
    ] },
  { id: 'house9', name: '独栋住宅 9', plot: 'B05-P06', module: 'B05-P06', transform: { x: -23, z: 36.6, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.6, -6.3, 3.88, 0.5], [-1, 0, 1, 0.55], [-3.05, 0, -0.85, 0.55], [-2.85, -6.55, -0.45, -6]],   // gable roof merged with the carport (the rear corner beside it is treated as covered), door hood, window hood, rear hood
    parts: [
      { group: 'house9', role: 'building', localBounds: { min: [-3.73,0.18,-6.61], max: [3.91,7.43,0.58], ground: [-3.66,-6.3,3.88,0.5] } },
      { group: 'house9Step', role: 'attachment', localBounds: { min: [-0.71,0.18,0.5], max: [0.71,0.26,2.25], ground: null } },
      { group: 'house9Garden', role: 'attachment', localBounds: { min: [-4.93,0.18,0.35], max: [-0.55,3.04,2.55], ground: [-4.93,0.7,-0.87,2.55] } },
      { group: 'house9FrontE', role: 'attachment', localBounds: { min: [0.46,0.19,0.37], max: [1.54,0.85,1.38], ground: [0.46,0.37,1.54,1.38] } },
      { group: 'house9West', role: 'attachment', localBounds: { min: [-4.96,0.18,-5.61], max: [-3.39,1.7,1.61], ground: [-4.95,-5.6,-3.39,1.6] } },
      { group: 'house9East', role: 'attachment', localBounds: { min: [1.77,0.18,-5.73], max: [4.37,1.29,0.35], ground: [1.78,-5.73,4.37,0.35] } },
      { group: 'house9Rear', role: 'attachment', localBounds: { min: [-4.59,0.18,-8.89], max: [4.17,1.12,-6.08], ground: [-4.59,-8.89,4.17,-6.13] } },
      { group: 'house9Ground', role: 'ground', localBounds: { min: [-4.9,0.19,-8.9], max: [4.6,0.23,2.5], ground: null } },
    ] },
  { id: 'house10', name: '独栋住宅 10', plot: 'B05-P07', module: 'B05-P07', transform: { x: -29.5, z: 36.6, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-0.4, -6.85, 6.4, 0.5], [-0.4, 0, 1.4, 0.58], [2.65, -7.1, 3.85, -6.5]],   // single-pitch roof merged with the left carport (the rear corner beside it is treated as covered), front canopy, back-door hood
    parts: [
      { group: 'house10', role: 'building', localBounds: { min: [-0.47,0.18,-7.1], max: [6.46,7.47,0.6], ground: [-0.46,-6.8,6.41,0.5] } },
      { group: 'house10Step', role: 'attachment', localBounds: { min: [-0.71,0.18,0.5], max: [0.7,0.26,2.25], ground: null } },
      { group: 'house10Garden', role: 'attachment', localBounds: { min: [0.3,0.18,0.35], max: [4.46,3.04,2.56], ground: [0.7,0.7,4.46,2.55] } },
      { group: 'house10East', role: 'attachment', localBounds: { min: [-1.37,0.18,-5.62], max: [-0.44,1.7,1.86], ground: [-1.37,-5.61,-0.44,1.86] } },
      { group: 'house10West', role: 'attachment', localBounds: { min: [6.51,0.18,-5.6], max: [7.26,1.62,1.61], ground: [6.51,-5.6,7.25,1.6] } },
      { group: 'house10Rear', role: 'attachment', localBounds: { min: [-1.24,0.18,-8.92], max: [7.04,1.1,-6.59], ground: [-1.24,-8.92,7.04,-6.64] } },
      { group: 'house10Ground', role: 'ground', localBounds: { min: [-1.4,0.19,-8.9], max: [7.4,0.23,2.5], ground: null } },
    ] },
  { id: 'house11', name: '独栋住宅 11', plot: 'B05-P08', module: 'B05-P08', transform: { x: -38.5, z: 36.6, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-0.4, -6.85, 6.4, 0.5], [-0.4, 0, 1.0, 0.55], [1.2, 0, 3.6, 0.5]],   // half-hip roof merged with the left carport (the rear corner beside it is treated as covered), door hood, balcony deck
    parts: [
      { group: 'house11', role: 'building', localBounds: { min: [-0.47,0.18,-7.1], max: [6.46,7.43,0.6], ground: [-0.46,-6.8,6.41,0.5] } },
      { group: 'house11Step', role: 'attachment', localBounds: { min: [-0.71,0.18,0.5], max: [0.71,0.26,2.25], ground: null } },
      { group: 'house11Garden', role: 'attachment', localBounds: { min: [0.3,0.18,0.35], max: [4.46,3.04,2.55], ground: [0.7,0.7,4.46,2.55] } },
      { group: 'house11East', role: 'attachment', localBounds: { min: [-1.36,0.18,-5.62], max: [-0.44,1.7,1.81], ground: [-1.36,-5.61,-0.44,1.81] } },
      { group: 'house11West', role: 'attachment', localBounds: { min: [6.51,0.18,-5.61], max: [7.26,1.62,1.61], ground: [6.51,-5.6,7.25,1.6] } },
      { group: 'house11Rear', role: 'attachment', localBounds: { min: [-1.22,0.18,-8.92], max: [7.07,1.12,-6.59], ground: [-1.22,-8.92,7.07,-6.64] } },
      { group: 'house11Ground', role: 'ground', localBounds: { min: [-1.4,0.19,-8.9], max: [7.4,0.23,2.5], ground: null } },
    ] },
  { id: 'house12', name: '独栋住宅 12', plot: 'B06-P05', module: 'B06-P05', transform: { x: 11, z: 36.6, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.9, -6.5, 2.85, 0.5]],   // flat roof and front terrace slab merged with the east carport (the rear corner beside it is treated as covered)
    parts: [
      { group: 'house12', role: 'building', localBounds: { min: [-3.96,0.18,-6.57], max: [3,6.56,0.55], ground: [-3.94,-6.56,2.93,0.5] } },
      { group: 'house12Step', role: 'attachment', localBounds: { min: [-0.71,0.18,0.5], max: [0.71,0.26,2.25], ground: null } },
      { group: 'house12Garden', role: 'attachment', localBounds: { min: [0.3,0.18,0.35], max: [4.94,3.04,2.56], ground: [0.67,0.7,4.93,2.55] } },
      { group: 'house12FrontE', role: 'attachment', localBounds: { min: [-1.42,0.19,0.33], max: [-0.81,0.66,0.98], ground: [-1.42,0.33,-0.81,0.98] } },
      { group: 'house12West', role: 'attachment', localBounds: { min: [3.09,0.18,-5.61], max: [4.91,1.7,1.61], ground: [3.09,-5.6,4.9,1.6] } },
      { group: 'house12East', role: 'attachment', localBounds: { min: [-4.84,0.19,-5.94], max: [-2.22,1.11,1.77], ground: [-4.84,-5.93,-2.22,1.77] } },
      { group: 'house12Rear', role: 'attachment', localBounds: { min: [-3.88,0.18,-8.88], max: [4.41,1.04,-6.59], ground: [-3.88,-8.88,4.41,-6.64] } },
      { group: 'house12Ground', role: 'ground', localBounds: { min: [-4.9,0.19,-8.9], max: [4.9,0.23,2.5], ground: null } },
    ] },
  { id: 'house13', name: '独栋住宅 13', plot: 'B06-P06', module: 'B06-P06', transform: { x: 21, z: 36.6, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.9, -6.85, 3.15, 0.5], [-1.65, -1.2, 0.7, 0.5], [0.6, 0, 2.9, 0.58]],   // double-gable roof merged with the east carport (the rear corner beside it is treated as covered), east lean-to, west hood
    parts: [
      { group: 'house13', role: 'building', localBounds: { min: [-3.96,0.18,-6.91], max: [3.28,7.32,0.6], ground: [-3.94,-6.8,3.21,0.5] } },
      { group: 'house13Step', role: 'attachment', localBounds: { min: [-0.71,0.18,0.5], max: [0.71,0.26,2.25], ground: null } },
      { group: 'house13Garden', role: 'attachment', localBounds: { min: [0.3,0.18,0.35], max: [4.93,3.04,2.56], ground: [0.67,0.7,4.93,2.55] } },
      { group: 'house13FrontE', role: 'attachment', localBounds: { min: [-1.42,0.19,0.33], max: [-0.81,0.67,0.95], ground: [-1.42,0.33,-0.81,0.95] } },
      { group: 'house13West', role: 'attachment', localBounds: { min: [3.09,0.18,-5.61], max: [4.9,1.7,1.61], ground: [3.09,-5.6,4.9,1.6] } },
      { group: 'house13East', role: 'attachment', localBounds: { min: [-4.88,0.18,-5.94], max: [-2.21,1.08,1.98], ground: [-4.88,-5.93,-2.22,1.98] } },
      { group: 'house13Rear', role: 'attachment', localBounds: { min: [-3.91,0.18,-8.88], max: [4.42,1.01,-6.59], ground: [-3.91,-8.88,4.42,-6.64] } },
      { group: 'house13Ground', role: 'ground', localBounds: { min: [-4.9,0.19,-8.9], max: [4.9,0.23,2.5], ground: null } },
    ] },
  { id: 'house14', name: '独栋住宅 14', plot: 'B06-P07', module: 'B06-P07', transform: { x: 31, z: 36.6, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.6, -6.35, 3.88, 0.5], [-0.65, 0, 1.05, 0.55], [-2.85, -6.55, -0.45, -6]],   // front-gable/rear-hip roof merged with the left carport (the rear corner beside it is treated as covered), door hood, rear awning
    parts: [
      { group: 'house14', role: 'building', localBounds: { min: [-3.73,0.18,-6.61], max: [3.91,7.31,0.57], ground: [-3.66,-6.3,3.88,0.5] } },
      { group: 'house14Step', role: 'attachment', localBounds: { min: [-0.7,0.18,0.5], max: [0.71,0.26,2.25], ground: null } },
      { group: 'house14Garden', role: 'attachment', localBounds: { min: [-4.93,0.18,0.35], max: [-0.55,3.04,2.56], ground: [-4.93,0.7,-0.87,2.55] } },
      { group: 'house14FrontE', role: 'attachment', localBounds: { min: [0.43,0.19,0.37], max: [1.54,0.86,1.42], ground: [0.43,0.37,1.54,1.42] } },
      { group: 'house14West', role: 'attachment', localBounds: { min: [-4.96,0.18,-5.61], max: [-3.39,1.7,1.61], ground: [-4.95,-5.6,-3.39,1.6] } },
      { group: 'house14East', role: 'attachment', localBounds: { min: [1.77,0.18,-5.73], max: [4.35,1.23,0.35], ground: [1.78,-5.73,4.35,0.35] } },
      { group: 'house14Rear', role: 'attachment', localBounds: { min: [-4.5,0.18,-8.88], max: [4.14,1.11,-6.08], ground: [-4.5,-8.88,4.14,-6.12] } },
      { group: 'house14Ground', role: 'ground', localBounds: { min: [-4.9,0.19,-8.9], max: [4.6,0.23,2.5], ground: null } },
    ] },
  { id: 'house15', name: '独栋住宅 15', plot: 'B06-P08', module: 'B06-P08', transform: { x: 41, z: 36.6, rotY: Math.PI },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 2,
    shelter: [[-3.9, -6.9, 3.15, 0.55]],   // side-gable roof and front hood merged with the east carport (the rear corner beside it is treated as covered)
    parts: [
      { group: 'house15', role: 'building', localBounds: { min: [-3.96,0.18,-7], max: [3.27,7.22,0.6], ground: [-3.94,-6.85,3.21,0.5] } },
      { group: 'house15Step', role: 'attachment', localBounds: { min: [-0.71,0.18,0.5], max: [0.71,0.26,2.25], ground: null } },
      { group: 'house15Garden', role: 'attachment', localBounds: { min: [0.3,0.18,0.35], max: [4.94,3.04,2.56], ground: [0.67,0.7,4.93,2.55] } },
      { group: 'house15FrontE', role: 'attachment', localBounds: { min: [-1.44,0.19,0.32], max: [-0.81,0.65,0.99], ground: [-1.44,0.32,-0.81,0.99] } },
      { group: 'house15West', role: 'attachment', localBounds: { min: [3.09,0.18,-5.61], max: [4.91,1.7,1.6], ground: [3.09,-5.6,4.9,1.6] } },
      { group: 'house15East', role: 'attachment', localBounds: { min: [-4.87,0.19,-5.94], max: [-2.21,1.07,1.93], ground: [-4.87,-5.93,-2.22,1.93] } },
      { group: 'house15Rear', role: 'attachment', localBounds: { min: [-3.91,0.18,-8.85], max: [4.4,1.02,-6.59], ground: [-3.91,-8.85,4.4,-6.64] } },
      { group: 'house15Ground', role: 'ground', localBounds: { min: [-4.9,0.19,-8.9], max: [4.9,0.23,2.5], ground: null } },
    ] },
  { id: 'school', name: 'あめまち小学校', plot: 'B01-P01', module: 'B01-P01', transform: { x: -26, z: -35, rotY: 0 },
    door: { x: 0, z: 0 }, frontDir: [0, 1], floor: 0.3, floors: 3,
    shelter: [[-13.5, -7.75, 15.5, 0.5], [-16.6, 0, -9.4, 9.7], [-2.6, 0, 2.6, 1.75]],   // teaching-wing roof, low-wing roof, entrance canopy
    parts: [
      { group: 'school', role: 'building', localBounds: { min: [-16.71,0.18,-7.87], max: [15.56,12.41,9.74], ground: [-13.05,-7.7,15.05,0.45] } },
      { group: 'schoolLow', role: 'building', localBounds: { min: [-16.26,0.18,0], max: [-9.26,3.8,9.61], ground: [-16.2,0,-9.31,9.55] } },
      { group: 'schoolWallS1', role: 'attachment', localBounds: { min: [-19.73,0.18,11.84], max: [-1.62,2.99,13.85], ground: [-19.72,11.85,-1.62,13.79] } },
      { group: 'schoolWallS2', role: 'attachment', localBounds: { min: [1.62,0.18,11.85], max: [19.73,2.99,13.85], ground: [1.63,11.85,19.72,13.77] } },
      { group: 'schoolWallN', role: 'attachment', localBounds: { min: [-19.72,0.18,-10.89], max: [19.73,2.05,-10.51], ground: [-19.7,-10.85,19.7,-10.55] } },
      { group: 'schoolWallW', role: 'attachment', localBounds: { min: [-19.88,0.18,-10.74], max: [-19.52,2.06,13.38], ground: [-19.85,-10.7,-19.55,13.35] } },
      { group: 'schoolWallE1', role: 'attachment', localBounds: { min: [19.25,0.18,-10.74], max: [19.95,2.48,-6.35], ground: [19.33,-10.7,19.88,-6.43] } },
      { group: 'schoolWallE2', role: 'attachment', localBounds: { min: [17.79,0.18,-6.48], max: [19.94,2.98,13.39], ground: [17.8,-6.47,19.88,13.38] } },
      { group: 'schoolBikes', role: 'attachment', localBounds: { min: [2.94,0.18,9.8], max: [11.06,2.88,13.13], ground: [2.95,9.8,11.05,13.12] } },
      { group: 'schoolGoal', role: 'attachment', localBounds: { min: [13.25,0.18,4.94], max: [13.7,2.43,7.66], ground: [13.26,4.96,13.7,7.64] } },
      { group: 'schoolGearW', role: 'attachment', localBounds: { min: [-8.61,0.18,10.72], max: [-3.19,6.59,12.75], ground: [-8.6,10.73,-3.2,12.75] } },
      { group: 'schoolGearE', role: 'attachment', localBounds: { min: [3.19,0.18,10.72], max: [7.61,0.94,12.73], ground: [3.2,10.73,7.6,12.73] } },
      { group: 'schoolTree1', role: 'attachment', localBounds: { min: [16.25,0.19,1.07], max: [18.76,4.59,3.09], ground: [17.44,1.89,17.71,2.15] } },
      { group: 'schoolTree2', role: 'attachment', localBounds: { min: [16.41,0.19,8.17], max: [18.68,4.19,10], ground: [17.41,8.69,18.68,10] } },
      { group: 'schoolTree3', role: 'attachment', localBounds: { min: [-19.11,0.19,10.53], max: [-16.83,4.19,12.36], ground: [-18.11,11.06,-16.83,12.36] } },
      { group: 'schoolTree4', role: 'attachment', localBounds: { min: [-8.55,0.19,11.37], max: [-6.51,3.79,13.03], ground: [-8.55,11.41,-6.51,13.03] } },
      { group: 'schoolTree5', role: 'attachment', localBounds: { min: [16.4,0.19,-8.94], max: [18.67,4.19,-7.09], ground: [17.47,-8.14,17.7,-7.9] } },
      { group: 'schoolRear', role: 'attachment', localBounds: { min: [-17.21,0.18,-10.56], max: [11.92,3.29,-7.77], ground: [-17,-10.3,11.9,-7.78] } },
      { group: 'schoolEast', role: 'attachment', localBounds: { min: [16.42,0.18,0.39], max: [19.31,2.38,7.68], ground: [16.43,0.6,19.1,7.68] } },
      { group: 'schoolPlay', role: 'ground', localBounds: { min: [-19.6,0.19,-10.6], max: [19.7,0.22,13.6], ground: null } },
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
