// R0 (docs/world/THIRD_PERSON_ROAM_PLAN.md, section 6): the fixed routes, probes and random sample of the third-person ride checks (R1-R3),
// with a data-only validator. Town legs are waypoints in the town plane (layout.js frame, x east, z south); world legs are node chains of
// world.js roadNetwork. Headings follow scene.js: forward = (sin h, cos h), so h = 0 south, pi north, -pi/2 west, +pi/2 east.
// The validator reads only world.js and layout.js (no browser, no scene code): town waypoints on the rideable town surfaces of layout.js
// (a facility band only inside a curb cut), clearance to the town furniture, world node chains connected by edges, spans, classes and scale.
// Rideability follows the R0 close-out (plan 6.13): stairs and the RN12-01 steel stair are pushed (U1), the I9 sites of ground.js join the network where it has no edge,
// and legs that only a spawn or ride.set can reach (the network gap at LM01) are flagged, not failed.
// Run: node tools/ride_routes.mjs [--json]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const N = Math.PI, E = Math.PI / 2, W_ = -Math.PI / 2, S = 0;

// true metres (section 6.4); the town default free view (target (-7, 20), yaw 2.5) spawns here: R01, westbound, left lane
export const SPAWN_DEFAULT = { x: -7, z: 16.75, heading: W_ };
// left lane centre for carriageways of 4.5 m and more (a quarter of the width, Japan keeps left), the paved centre otherwise
export const LANE = { TOWN_MAIN: 1.75, TOWN_BRANCH: 1.5, RD01: 1.75, RD02: 1.75, RD03: 1.125, RD04: 0, RD05: 0, RD06: 0, RD07: 0, RD08: 0, TOWN_ALLEY: 0 };

const town = (pts, ev) => ({ town: pts, ev: ev || [] });
const world = (nodes, o) => ({ nodes, ...(o || {}) });
const exitsOut = [
  // exit, start 12 m inside on the outbound left lane, heading, CR01 junction, the ring node on the left (U-turn 10 m along the ring: the shortest neighbour edge,
  // C01-E-N13 -> C01-E-NE, is 11.4 m), the inbound left lane (exit edge -> 12 m inside)
  ['N01', [-36, 16.75], W_, 'C01-W-N01', 'C01-W-N11', [[-48, 13.25], [-36, 13.25]]], ['N03', [36, 13.25], E, 'C01-E-N03', 'C01-E-N10', [[48, 16.75], [36, 16.75]]],
  ['N04', [-1.5, -36], N, 'C01-N', 'C01-T02', [[1.5, -48], [1.5, -36]]], ['N08', [1.5, 36], S, 'C01-S', 'C01-SE', [[-1.5, 48], [-1.5, 36]]],
  ['N09', [-36, -13.5], W_, 'C01-W-N09', 'C01-W-N01', [[-48, -16.5], [-36, -16.5]]], ['N10', [36, -16.5], E, 'C01-E-N10', 'C01-E-N13', [[48, -13.5], [36, -13.5]]],
  ['N11', [-36, 32.25], W_, 'C01-W-N11', 'C01-W-SW', [[-48, 32.25], [-36, 32.25]]], ['N12', [36, 32.25], E, 'C01-E-N12', 'C01-E-N03', [[48, 32.25], [36, 32.25]]],
  ['N13', [36, -33.5], E, 'C01-E-N13', 'C01-E-NE', [[48, -33.5], [36, -33.5]]],
];
const RING = ['C01-S', 'C01-SW', 'C01-W-SW', 'C01-W-N11', 'C01-W-N01', 'C01-W-N09', 'C01-W-NW', 'C01-NW', 'C01-T02', 'C01-N', 'C01-NE', 'C01-E-NE',
  'C01-E-N13', 'C01-E-N10', 'C01-E-N03', 'C01-E-N12', 'C01-E-SE', 'C01-SE', 'C01-S'];
const TRUNK = ['C01-E-N03', 'J-T04', 'J-E1', 'J-E2', 'J-T07', 'LM10-south', 'J-E3', 'J-P1', 'J-LM08', 'J-W3', 'J-T08', 'J-T09', 'J-W2', 'J-W1', 'LM09-north',
  'C01-W-N01', 'N01'];

export const ROUTES = [
  { id: 'RT-01', name: '城镇主街与两路口', start: SPAWN_DEFAULT, legs: [
    town([[-7, 16.75], [-30, 16.75]], [{ at: 0, do: 'look360' }, { at: 0, do: 'recentre' }, { at: 1, do: 'stop' }, { at: 1, do: 'pivot', to: E }]),
    town([[-30, 16.75], [-22, 13.25], [-4.75, 13.25], ['arc', [-4.75, 10], 3.25, 90, 0], [-1.5, -10], ['arc', [-5, -10], 3.5, 0, -90], [-40, -13.5]],
      [{ at: 'end', do: 'stop' }, { at: 'end', do: 'pivot', to: E }]),
    town([[-40, -13.5], [-32, -16.5], [-11.5, -16.5]], [{ at: 'end', do: 'stop', hold: 1 }]),     // X02: R02 has priority, the R03 approaches stop
    town([[-11.5, -16.5], [40, -16.5]], [{ at: 'end', do: 'stop' }]),
  ] },
  { id: 'RT-02', name: '窄巷、W01 通道与坡口', start: { x: -1.5, z: 42, heading: N }, legs: [
    town([[-1.5, 42], [-1.5, 35.5], ['arc', [-5, 35.5], 3.5, 0, -90], [-18, 32.25]], [{ at: 'end', do: 'stop' }, { at: 'end', do: 'pivot', to: N }]),  // A01-DW
    town([[-18, 32.25], [-18, 26]], [{ at: 'end', do: 'stop' }, { at: 'end', do: 'reverse', m: 2 }]),   // back 2 m, then forward over the same 2 m
    town([[-18, 26], [-18, 20]], [{ at: 'end', do: 'stop' }, { at: 'end', do: 'pivot', to: E }]),                      // W01, 2 m
    town([[-18, 20], [-8.5, 20]], [{ at: 'end', do: 'stop' }, { at: 'end', do: 'pivot', to: N }]),                   // R01 south sidewalk
    town([[-8.5, 20], [-8.5, 16.75]], [{ at: 'end', do: 'stop' }]),                                                 // X01-CW-W-RPb down
  ] },
  ...exitsOut.map(([ex, [x, z], h, jn, left, back], k) => ({ id: 'RT-03' + 'abcdefghi'[k], name: `出口 ${ex} 进出与 CR01 掉头`, start: { x, z, heading: h }, legs: [
    town([[x, z], [h === W_ ? -48 : h === E ? 48 : x, h === N ? -48 : h === S ? 48 : z]]),
    world([ex, jn]), world([jn, left], { until: 10, ev: [{ at: 'end', do: 'stop' }, { at: 'end', do: 'uturn' }] }), world([left, jn], { from: 'len-10' }), world([jn, ex]),
    town(back, [{ at: 'end', do: 'stop' }]),
  ] })),
  { id: 'RT-04', name: 'CR01 顺时针全环', start: { node: 'C01-S', toward: 'C01-SW' }, legs: [world(RING, { ev: [{ at: 'C01-W-N01', do: 'stop', hold: 1 }, { at: 'C01-E-N03', do: 'stop', hold: 1 }] })] },
  { id: 'RT-05', name: 'RN01 环球主干道：五座桥、隧道、最陡坡、接缝', start: { node: 'C01-E-N03', toward: 'J-T04' }, legs: [
    world(TRUNK, { ev: [{ at: ['RN01-03', 'mid'], do: 'stop', look: true }, { at: ['RN01-05', 18], do: 'stop', look: true }, { at: 'J-LM08', do: 'stop' }, { at: 'seam', do: 'wrap' }] }),
    town([[-48, 13.25], [48, 13.25]]),              // R01 eastbound through X01
    world(['N03', 'C01-E-N03'], { ev: [{ at: 'end', do: 'stop' }] }),
  ] },
  { id: 'RT-06a', name: '隧道与桥面停车、环视、掉头', start: { node: 'J-E2', toward: 'J-T07' }, legs: [
    world(['J-E2', 'J-T07', 'LM10-south'], { until: 2.8 + 18, ev: [{ at: 'end', do: 'stop', look: true }, { at: 'end', do: 'uturn' }] }),
    world(['LM10-south', 'J-T07', 'J-E2', 'J-E1'], { from: 38.7 - 18, until: 38.7 + 2.8 + 27.8, ev: [{ at: 'end', do: 'stop', look: true }, { at: 'end', do: 'probe', probe: 'RC-06' }, { at: 'end', do: 'uturn' }] }),
    world(['J-E1', 'J-E2'], { from: 27.8, ev: [{ at: 'end', do: 'stop' }] }),
  ] },
  { id: 'RT-06b', name: 'RN01-13 跨接缝往返', start: { node: 'J-W1', toward: 'J-W2' }, legs: [
    world(['J-W1', 'J-W2'], { untilSeam: 10, ev: [{ at: 'seam', do: 'wrap' }, { at: 'end', do: 'stop' }, { at: 'end', do: 'uturn' }] }),
    world(['J-W2', 'J-W1'], { fromSeam: 10, ev: [{ at: 'seam', do: 'wrap' }, { at: 'end', do: 'stop' }] }),
  ] },
  { id: 'RT-07', name: 'M01 南线：等级渐变、窄路与栈道', start: { x: 1.5, z: 36, heading: S }, legs: [
    town([[1.5, 36], [1.5, 48]]),
    world(['N08', 'C01-S', 'J-T03a', 'J-T03b', 'LM04-southeast', 'E-T11'], { ev: [{ at: 'end', do: 'stop', look: true }, { at: 'end', do: 'pivot', to: 'back' }] }),
    world(['E-T11', 'LM04-southeast'], { ev: [{ at: 'end', do: 'stop' }] }),
  ] },
  { id: 'RT-08a', name: 'J-T07 支路到 LM03', start: { node: 'J-T07', toward: 'LM03-north' }, legs: [
    world(['J-T07', 'LM03-north'], { ev: [{ at: 'end', do: 'stop' }, { at: 'end', do: 'uturn' }] }), world(['LM03-north', 'J-T07']) ] },
  { id: 'RT-08b', name: 'J-T09 支路坡接到 LM06 沙漠', start: { node: 'J-T09', toward: 'LM06-north' }, legs: [
    world(['J-T09', 'LM06-north'], { ev: [{ at: 'end', do: 'stop' }, { at: 'end', do: 'uturn' }] }), world(['LM06-north', 'J-T09']) ] },
  { id: 'RT-08c', name: 'RN08 到 LM05 石阶', start: { node: 'J-T08', toward: 'J-T08b' }, depends: ['U1'], legs: [
    world(['J-T08', 'J-T08b', 'LM05-west'], { ev: [{ at: 'end', do: 'stop' }, { at: 'end', do: 'pivot', to: 'back' }] }), world(['LM05-west', 'J-T08b']) ] },
  // R0 close-out (plan 6.13.5): LM01-west (the stair top, 21.6 m) and LM01-north (the foot, 26.7 m away on a ~70 % lava slope) are not connected, so the north line is two routes
  { id: 'RT-09a', name: '北线：LM02 场地与 RN05-02 石阶推车到 LM01-west', start: { x: -1.5, z: -36, heading: N }, depends: ['U1', 'I9-LM02'], legs: [
    town([[-1.5, -36], [-1.5, -48]]),
    world(['N04', 'C01-N', 'C01-T02', 'LM02-east']), { site: ['LM02-east', 'LM02-northeast'] },
    world(['LM02-northeast', 'LM01-west'], { ev: [{ at: 'end', do: 'stop' }, { at: 'end', do: 'pivot', to: 'back' }] }), world(['LM01-west', 'LM02-northeast']),
  ] },
  { id: 'RT-09b', name: '北线：RN10-01 雪道到 LM07（显示比例到 4.05）', start: { node: 'LM01-north', toward: 'LM07-west' }, depends: ['set-only'], legs: [
    world(['LM01-north', 'LM07-west'], { ev: [{ at: 'end', do: 'stop', look: true }, { at: 'end', do: 'uturn' }] }), world(['LM07-west', 'LM01-north']),
  ] },
  { id: 'RT-10', name: 'J-LM08 护栏门与检修梯到灯塔岛', start: { node: 'J-LM08', toward: 'LM08-south' }, depends: ['U1'], legs: [
    world(['J-LM08', 'LM08-south'], { ev: [{ at: 'end', do: 'stop' }, { at: 'end', do: 'pivot', to: 'back' }] }), world(['LM08-south', 'J-LM08']) ] },
  // LM09 facility fix (docs/world/LM09_BRIDGE_FACILITY_FIX_PLAN.md): the westbound left lane of N01-west's bridge approach ran through the station's old bus sign and stop lamp
  { id: 'RT-11', name: 'LM09 桥头引道往返（原站牌、站灯位置）', start: { node: 'C01-W-N01', toward: 'LM09-north' }, legs: [
    world(['C01-W-N01', 'LM09-north', 'J-W1'], { ev: [{ at: 'end', do: 'stop' }, { at: 'end', do: 'uturn' }] }), world(['J-W1', 'LM09-north', 'C01-W-N01'], { ev: [{ at: 'end', do: 'stop' }] }) ] },
];

// boundary probes: ride into the boundary at 90 deg and 30 deg at the surface's speed cap (section 6.5)
export const COLLISION_PROBES = [
  { id: 'RC-01', what: 'R01 南侧路缘 0.13 m（非坡口）', at: [-20, 17.5], heading: S, expect: 'block' },
  { id: 'RC-02', what: '同一路缘的坡口 X01-CW-W-RPb', at: [-8.5, 17.5], heading: S, expect: 'pass' },
  { id: 'RC-03', what: '巷道路灯 ALAMP-A01-3 正面', at: [-10, 33.75], heading: W_, expect: 'block' },
  { id: 'RC-04', what: 'W01 东侧墙（便利店）', at: [-18, 26], heading: E, expect: 'block' },
  { id: 'RC-05', what: 'CR01 南段外侧边沟', node: ['C01-S', 'C01-SW'], s: 20, side: 'outer', expect: 'block' },
  { id: 'RC-06', what: 'RN01-03 桥护栏（跨中北侧）', edge: 'RN01-03', s: 'mid', side: 'left', expect: 'block' },
  { id: 'RC-07', what: 'RN01-05 隧道侧墙（s = 18）', edge: 'RN01-05', s: 18, side: 'left', expect: 'block' },
  { id: 'RC-08', what: 'RN11-01 栈道绳栏（跨中）', edge: 'RN11-01', s: 'mid', side: 'left', expect: 'block' },
  { id: 'RC-09', what: 'X01 信号灯杆 SIG-X01-W 所在设施带', at: [-6.5, 12.5], heading: N, expect: 'block' },
  { id: 'RC-10', what: '地标场地设施（LM02 售货机、公交牌）', site: 'LM02', expect: 'block', depends: ['I9-LM02'] },
];
// spawn probes: free-view targets and the expected snap (section 6.3)
export const SPAWN_PROBES = [
  { id: 'RS-01', what: '默认自由视角', target: [-7, 20], yaw: 2.5, expect: { x: -7, z: 16.75, heading: W_ } },
  { id: 'RS-02', what: '便利店地块中心', target: [-11.5, 25.75], expect: 'A01 巷道中线（到 A01 路面边 4.75 m，到 R01 车行道边 7.25 m）' },
  { id: 'RS-03', what: 'R01 北侧人行道', target: [20, 10], expect: 'R01 车行道，按视线取向' },
  { id: 'RS-04', what: 'CR01 路面上', node: ['C01-SE', 'C01-S'], s: 10, expect: '原地（左侧车道）' },
  { id: 'RS-05', what: '城南森林，距路 > 10 m', lonLat: [15, -42], expect: '最近道路（CR01 或 RN06），提示移动距离' },
  { id: 'RS-06', what: 'RN01-03 桥下海面', edge: 'RN01-03', s: 'mid', below: true, expect: '桥面同一断面（不落在桥下）' },
  { id: 'RS-07', what: 'RN01-05 隧道正上方山体', edge: 'RN01-05', s: 18, above: true, expect: '较近洞口外 5 m 的 RN01 路面' },
  { id: 'RS-08', what: 'RN05-02 石阶中段', edge: 'RN05-02', s: 'mid', expect: '石阶下端外的路面（不出生在石阶上）' },
  { id: 'RS-09', what: 'LM02 村内场地', lonLat: [-38.5, 38.5], expect: 'RN05-01（I9 场地不是出生面）' },
  { id: 'RS-10', what: 'LM07 冰原（显示比例 4）', lonLat: [72, 76.5], expect: 'RN10-01 雪道' },
  { id: 'RS-11', what: '开阔海面', lonLat: [0, -60], expect: '最近道路（可能很远），提示距离' },
  { id: 'RS-12', what: '平面接缝西海', lonLat: [-85, -12], expect: 'RN01-13 桥面，x 在 [xMin, xMax) 内' },
];

// stairs: the RD06 stone stairs (world.js span 'stairs') and RN12-01, a boardwalk span in world.js that bridge.js builds as the two-flight steel
// maintenance stair on the girder of RN01-08/09: both are pushed, not ridden (decision U1)
export const isStairEdge = e => e.id === 'RN12-01' || e.spans.some(s => s.type === 'stairs');
const mulberry32 = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// U7 / R3: 20 fixed 15 m pieces of the roads outside the town (no town class, no stairs), stratified so that the ring does not dominate:
// 8 on the RN01 trunk, 6 on CR01 (RN04), 6 on the connectors and branches; within a group weighted by length, seed 20261018
export function random20(W) {
  const RN = W.roadNetwork, rnd = mulberry32(20261018), out = [];
  const ok = e => !/^TOWN_/.test(e.class) && !isStairEdge(e);
  const groups = [[8, e => e.route === 'RN01'], [6, e => e.route === 'RN04'], [6, e => e.route !== 'RN01' && e.route !== 'RN04']];
  for (const [count, inG] of groups) {
    const el = RN.edges.filter(e => ok(e) && inG(e)).map(e => ({ e, len: RN.edgeLength(e) })), total = el.reduce((a, q) => a + q.len, 0);
    for (let got = 0; got < count;) {
      let r = rnd() * total, q = el[0]; for (const c of el) { if (r < c.len) { q = c; break; } r -= c.len; }
      const span = Math.min(15, q.len), s0 = (q.len - span) * rnd();
      if (out.some(o => o.edge === q.e.id && Math.abs(o.s0 - s0) < 15)) continue;
      out.push({ edge: q.e.id, class: q.e.class, s0: +s0.toFixed(2), s1: +(s0 + span).toFixed(2), spans: q.e.spans.filter(s => s.fromMeters < s0 + span && (s.toMeters === 'end' ? q.len : s.toMeters) > s0).map(s => s.type) });
      got++;
    }
  }
  return out;
}

function arcPts([, c, r, a0, a1]) {
  const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 5)), out = [];
  for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  return out;
}
const flat = pts => pts.flatMap(p => (p[0] === 'arc' ? arcPts(p) : [p]));
const inR = (r, x, z, e = 1e-6) => x >= r[0] - e && x <= r[2] + e && z >= r[1] - e && z <= r[3] + e;

function validate() {
  const W = require(path.join(root, 'world.js')), L = require(path.join(root, 'layout.js')), RN = W.roadNetwork, D = Math.PI / 180;
  const node = id => L.roadNodes.find(n => n.id === id);
  const surf = [];
  for (const sg of L.roadSegments.filter(q => L.ROAD_TYPES[q.type])) { const a = node(sg.from), b = node(sg.to), h = L.ROAD_TYPES[sg.type].carriageway / 2; surf.push({ kind: 'carriageway', id: sg.id, r: a.z === b.z ? [Math.min(a.x, b.x), a.z - h, Math.max(a.x, b.x), a.z + h] : [a.x - h, Math.min(a.z, b.z), a.x + h, Math.max(a.z, b.z)] }); }
  for (const s of L.surfaces) if (s.kind === 'alley' || s.kind === 'sidewalk') surf.push({ kind: s.kind, id: s.id, r: s.rect });
  for (const w of L.walkways) { const xs = w.poly.map(p => p[0]), zs = w.poly.map(p => p[1]); surf.push({ kind: 'walkway', id: w.id, r: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] }); }
  for (const c of L.curbCuts) surf.push({ kind: c.kind, id: c.id, r: c.rect });
  const bands = L.surfaces.filter(s => s.kind === 'band').map(s => s.rect), posts = L.furniture.filter(f => f.x !== undefined);
  const edgeOf = (a, b) => { const e = RN.edges.find(q => (q.from === a && q.to === b) || (q.from === b && q.to === a)); return e ? { e, rev: e.from !== a } : null; };
  const errors = [], flags = [], rows = [];
  for (const rt of ROUTES) {
    let len = 0, kinds = {}, classes = new Set(), spans = new Set(), kmin = Infinity, kmax = 0, minPost = Infinity, postId = '', grade = 0;
    for (const [li, leg] of rt.legs.entries()) {
      const tag = `${rt.id} leg ${li + 1}`, prev = rt.legs[li - 1];
      if (leg.town) {
        const pts = flat(leg.town);
        if (prev && prev.town) { const e = flat(prev.town).at(-1); if (Math.hypot(pts[0][0] - e[0], pts[0][1] - e[1]) > 0.05) errors.push(`${tag}: starts at ${pts[0]}, not at the previous end ${e}`); }
        if (prev && prev.nodes) { const nd = node(prev.nodes.at(-1)); if (!nd || Math.hypot(pts[0][0] - nd.x, pts[0][1] - nd.z) > 4) errors.push(`${tag}: starts at ${pts[0]}, not at the exit ${prev.nodes.at(-1)}`); }
        for (let i = 0; i + 1 < pts.length; i++) {
          const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], l = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(l / 0.1)); len += l;
          for (let k = 0; k <= n; k++) {
            const x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n, hit = surf.filter(q => inR(q.r, x, z));
            if (!hit.length) { errors.push(`${tag}: (${x.toFixed(2)}, ${z.toFixed(2)}) is on no rideable town surface`); break; }
            const cut = hit.some(q => q.kind === 'ramp' || q.kind === 'driveway');
            if (bands.some(r => inR(r, x, z, -1e-6)) && !cut) { errors.push(`${tag}: (${x.toFixed(2)}, ${z.toFixed(2)}) crosses a facility band outside a curb cut`); break; }
            if (k < n) { const kind = cut ? 'ramp' : hit.some(q => q.kind === 'carriageway') ? 'carriageway' : hit[0].kind; kinds[kind] = (kinds[kind] || 0) + l / n; }
            for (const p of posts) { const d = Math.hypot(p.x - x, p.z - z); if (d < minPost) { minPost = d; postId = p.id; } }
          }
        }
        kmin = Math.min(kmin, 1); kmax = Math.max(kmax, 1);
      } else if (leg.nodes) {
        if (prev && prev.town) { const e = flat(prev.town).at(-1), nd = node(leg.nodes[0]); if (!nd || Math.hypot(e[0] - nd.x, e[1] - nd.z) > 4) errors.push(`${tag}: starts at ${leg.nodes[0]}, away from the town leg end ${e}`); }
        if (prev && prev.nodes && prev.nodes.at(-1) !== leg.nodes[0]) errors.push(`${tag}: starts at ${leg.nodes[0]}, the previous leg ends at ${prev.nodes.at(-1)}`);
        let chain = 0, seamAt = null;
        for (let i = 0; i + 1 < leg.nodes.length; i++) {
          const q = edgeOf(leg.nodes[i], leg.nodes[i + 1]);
          if (!q) { errors.push(`${tag}: no edge between ${leg.nodes[i]} and ${leg.nodes[i + 1]}`); continue; }
          const el = RN.edgeLength(q.e), Sm = RN.samplePath(q.e, 0.5), wrap = l => ((l + 85) % 360 + 360) % 360; classes.add(q.e.class); for (const sp of q.e.spans) spans.add(sp.type); if (isStairEdge(q.e)) spans.add('stairs');
          for (let j = 1; j < Sm.length; j++) {
            if (!Sm[j].span && !Sm[j - 1].span) grade = Math.max(grade, Math.abs(Sm[j].h - Sm[j - 1].h) / (Sm[j].s - Sm[j - 1].s));
            if (seamAt === null && Math.abs(wrap(Sm[j].lon) - wrap(Sm[j - 1].lon)) > 180) { seamAt = chain + (q.rev ? el - Sm[j].s : Sm[j].s); flags.push(`${rt.id}: flat-map seam on ${q.e.id}, ${seamAt.toFixed(1)} m into leg ${li + 1}`); }
          }
          for (const id of [q.e.from, q.e.to]) { const nd = RN.nodeById[id], k = 1 / Math.cos(nd.lat * D); kmin = Math.min(kmin, k); kmax = Math.max(kmax, k); }
          chain += el;
        }
        if ((leg.untilSeam !== undefined || leg.fromSeam !== undefined) && seamAt === null) errors.push(`${tag}: no flat-map seam (lon -85) on this leg`);
        const from = leg.from === 'len-10' ? chain - 10 : leg.fromSeam !== undefined ? seamAt - leg.fromSeam : leg.from || 0,
          until = leg.untilSeam !== undefined ? seamAt + leg.untilSeam : leg.until !== undefined ? leg.until : chain;
        if (!(from >= 0 && until <= chain + 1e-6 && from < until)) errors.push(`${tag}: run ${from}-${until} m outside the chain of ${chain.toFixed(1)} m`);
        len += until - from;
      } else if (leg.site) flags.push(`${rt.id}: ${leg.site.join(' -> ')} has no network edge; ridden on the I9 site of ground.js (R1)`);
    }
    if (rt.start && rt.start.node) { const q = edgeOf(rt.start.node, rt.start.toward); if (!q) errors.push(`${rt.id}: start ${rt.start.node} -> ${rt.start.toward} is not an edge`); }
    if (spans.has('stairs')) flags.push(`${rt.id}: stairs (pushed at 0.8 m/s, U1)`);
    for (const d of rt.depends || []) if (d === 'set-only') flags.push(`${rt.id}: no network edge reaches its start (network gap at LM01): started by ride.set or a spawn`); else if (d !== 'U1') flags.push(`${rt.id}: uses ${d}`);
    if (minPost < 0.6) errors.push(`${rt.id}: passes ${minPost.toFixed(2)} m from ${postId} (< 0.6 m: rider 0.32 + post + margin)`);
    rows.push({ id: rt.id, name: rt.name, length: +len.toFixed(1), town: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, +v.toFixed(1)])), classes: [...classes], spans: [...spans],
      scale: kmax ? [+kmin.toFixed(3), +kmax.toFixed(3)] : null, maxGrade: +(grade * 100).toFixed(1), nearestPost: minPost < Infinity ? `${postId} ${minPost.toFixed(2)} m` : null });
  }
  for (const p of COLLISION_PROBES.concat(SPAWN_PROBES)) {
    if (p.edge && !RN.edges.find(e => e.id === p.edge)) errors.push(`${p.id}: no edge ${p.edge}`);
    if (p.node && !edgeOf(p.node[0], p.node[1])) errors.push(`${p.id}: no edge between ${p.node.join(' and ')}`);
    if (p.at && p.expect !== 'pass' && !surf.some(s => inR(s.r, p.at[0], p.at[1])) && !bands.some(b => inR(b, p.at[0], p.at[1]))) errors.push(`${p.id}: start (${p.at}) is not on a town surface`);
  }
  const lamp = posts.find(f => f.id === 'ALAMP-A01-3'); if (!lamp || !L.surfaces.some(s => s.kind === 'alley' && inR(s.rect, lamp.x, lamp.z))) errors.push('RC-03: ALAMP-A01-3 is not inside the A01 surface');
  return { rows, flags, errors, random20: random20(W) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const res = validate();
  if (process.argv.includes('--json')) console.log(JSON.stringify(res, null, 1));
  else {
    for (const r of res.rows) console.log(`${r.id.padEnd(7)} ${String(r.length).padStart(7)} m  ${r.name}\n        town ${JSON.stringify(r.town)}  classes ${r.classes.join(',') || '-'}  spans ${r.spans.join(',') || '-'}  scale ${r.scale ? r.scale.join('-') : '-'}  grade ${r.maxGrade}%  post ${r.nearestPost || '-'}`);
    console.log('\nrandom 20 (seed 20261018):'); for (const q of res.random20) console.log(`  ${q.edge.padEnd(8)} ${q.class.padEnd(5)} ${q.s0.toFixed(2).padStart(7)}-${q.s1.toFixed(2).padStart(7)} ${q.spans.join(',')}`);
    console.log('\nflags:'); for (const f of res.flags) console.log('  ' + f);
    console.log(`\n${res.errors.length ? 'FAIL' : 'PASS'}: ${ROUTES.length} routes, ${COLLISION_PROBES.length} collision probes, ${SPAWN_PROBES.length} spawn probes, ${res.errors.length} errors`);
    for (const e of res.errors) console.log('  ERROR ' + e);
  }
  process.exitCode = res.errors.length ? 1 : 0;
}
