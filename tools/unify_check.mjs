// W10 unified world checks (docs/world/W10_SPEC.md section 5). Each W10 row adds its checks here; run after `python3 build.py`:  node tools/unify_check.mjs
//   U0 structure: the identifiers that section 3 deletes in this row and the rows before it are gone from the sources (comments aside)
//   U3 one build, one display rule (W10a):
//     U3-first   at the first render the start-up pipeline is done, every module is built, the 10 landmarks exist, auto quality has not sampled yet
//     U3-stable  for 30 s after the first frame (the camera switching between the town, a far flat view and the sphere) no mesh, line set or instance
//                capacity is added: nothing is generated after the first frame
//     U3-display in all three states every module root, every landmark group and every terrain chunk is visible (the views differ only by bend, light,
//                weather and the pixel / altitude rules inside the modules)
//     U3-town    no world layer lies on the town's own streets, nor within 5 cm under them with a polygon offset (added after the user's N08 review)
//   U1-data (W10b) the one road network of world.js against the approved design (docs/world/ROAD_NETWORK_DESIGN_DRAFT.md, its tables read from the document):
//     U1-topology  59 nodes, 66 edges with their ends, classes and source ids, the retired edges gone, connected, the dead ends of the design only
//     U1-CR01      the ring closes, 418.27 m in the town plane, sides on +-54 m, R 8 m arcs, its nodes where the design puts them
//     U1-town      one edge per layout.js street segment, class and width from layout.js, on the street's own centre line
//     U1-exits     the nine exits: a straight 6 m connector along the street's axis to the ring, position and direction at the town edge, radius
//     U1-changes   RN05-01 / RN06-01 outside the ring, RN05-01 on T02-01's line; every edge against the network of `pre-w10b` (unchanged or the design's changes)
//   U2 (W10c): every road's paved row at 0.5 m spacing and 9 cross-section points is ray-tested against the visible scene geometry in flat and sphere states
//              (a branch's row on the CR01 paving is skipped: it was cut there), the CR01 and branch paving within 12 m of each ring node on a 0.5 m grid;
//              the nine town-exit connectors are separately counted from the town edge to 6 m outward.
//   U4 (W10c): frozen town alignment, width, level and layout-driven road details; U4-CR01-junctions rebuilds the CR01 paving from the ring's final
//              indexed triangles round the whole closed ring and tests every other road's whole cross-section against it (CR01_NW_REPAIR_PLAN.md).
//   U5 (W10d): one ground occupancy, no terrain below its marked surfaces, no base wall, no outlet model, plots and instance bounds clear.
//   U6, U7 (W10f): one geometry for both maps; the walk on the one ground sampler (see their block below). --only U0,U6,U7 runs U0 and the listed groups only.
// Real GPU (ANGLE Metal, as the timing tools): the checks are structural, the renderer does not change them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { TOL_PAIR, area as polyArea2D, intersect as clip2D, triangles as stripTriangles, gridIndex, ringParts, ringHeight } from './cr01_geometry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const check = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures++; };

// ---- U0 (W10a): town view / explore view, the on-demand builds and the background generation
const files = ['scene.js', 'terrain.js', 'roads.js', 'ocean.js', 'landcover.js', 'look.js', 'worldgen.js', 'transition.js', 'quality.js'];
const removed = /\b(?:setExplore|onExplore|setFade|landmarksVisible|buildLandmarks|buildRest|START_DELAY_MS|SLICE_MS|requestIdleCallback|restMat|fadeMaterials|visibilityOf|terrainOf|capsOf|setHeadCaps)\b|\bfunction\s+(?:visibility|ensure)\s*\(|\.explore\b|fade\.rest|opts\.gate|\bgate\s*:/;
const hits = files.flatMap(f => fs.readFileSync(path.join(root, f), 'utf8').split('\n').flatMap((l, i) => (removed.test(l) && !l.trim().startsWith('//') ? [`${f}:${i + 1}`] : [])));
check('U0', !hits.length, `W10a 删除项：${hits.join('、') || '无残留'}`);
const w10dFiles = ['scene.js', 'terrain.js', 'landcover.js'];
const w10dRemoved = /group\('base'\)|SHOW_OUTER_DRAIN_OUTLETS|cover:town-edge|townPatchDistance\([^\n]*\)\s*[<]=?\s*24|put\('fenceBamboo'/;
const w10dHits = w10dFiles.flatMap(f => fs.readFileSync(path.join(root, f), 'utf8').split('\n').flatMap((l, i) => w10dRemoved.test(l) && !l.trim().startsWith('//') ? [`${f}:${i + 1}`] : []));
check('U0-W10d', !w10dHits.length, `底座、TR01 独立网格/竹篱、外排水模型及补丁距离特例已删除：${w10dHits.join('、') || '无残留'}`);

// ---- U0 (W10e): retire the independent W4 section and read appearance values through look.js
{
  const core = ['build.py', 'scene.js', 'worldgen.js', 'roads.js', 'ocean.js', 'landcover.js', 'streetlights.js', 'look.js', 'tools/cover_check.mjs', 'tools/road_check.mjs', 'tools/lod_check.mjs'];
  const removed = /\b(?:SECTION_API|SECTION_PLAN|SECTION\.attach|ctx\.section|S\.section|section_plan\.js|section\.js|section_check\.mjs|section\.state|section\.jobs)\b|\bcorridor\s*:/;
  const hits = core.flatMap(f => fs.readFileSync(path.join(root, f), 'utf8').split('\n').flatMap((line, i) => removed.test(line) && !line.trim().startsWith('//') ? [`${f}:${i + 1}`] : []));
  const retired = ['section.js', 'section_plan.js', 'tools/section_check.mjs', 'tools/section_views.mjs', 'tools/section_shots.mjs', 'tools/section_extrapolate.mjs', 'tools/c01_s_clearance.mjs'].filter(f => fs.existsSync(path.join(root, f)));
  check('U0-W10e', !hits.length && !retired.length, `W4 独立模块/模式/排除与专用检查已退役：${[...hits, ...retired].join('、') || '无残留'}`);
}
// ---- U0 (W10f): the sphere copy of the town, the town camera and the town-only walk are gone (W10_SPEC section 3: one geometry, one ground sampler, one walk)
{
  const core = ['scene.js', 'bend.js', 'transition.js', 'ground.js', 'sphere_camera.js', 'tools/transition_check.mjs', 'tools/views.mjs', 'tools/w8f_check.mjs', 'tools/unify_check.mjs'];
  const removed = /\b(?:townSphere|townAvailable|townDistance|tessellate|tessellateGeometry|walkRects|constrainWalk|patchDistance)\b|\.town\.sphere\b|LV\.carriageway\s*\+\s*1\.(?:28|62)/;
  const hits = core.flatMap(f => fs.readFileSync(path.join(root, f), 'utf8').split('\n').flatMap((l, i) => removed.test(l) && !l.trim().startsWith('//') && !(f === 'tools/unify_check.mjs' && /const removed = /.test(l)) ? [`${f}:${i + 1}`] : []));
  check('U0-W10f', !hits.length, `球形换副本、城镇特例相机与仅城镇漫游已删除：${hits.join('、') || '无残留'}`);
}
// ---- U0 (R1, THIRD_PERSON_ROAM_PLAN 6.13.4): one roam, the ride; the W10f walk (its constants, step and camera) is gone and the ride's modules are built
{
  const removed = /\b(?:WALK|walkTo|roamStep|roamCamera)\b|walk:\s*\{config|__scene\.walk\b/;
  const core = ['scene.js', 'tools/views.mjs', 'tools/transition_check.mjs', 'tools/unify_check.mjs'];
  const hits = core.flatMap(f => fs.readFileSync(path.join(root, f), 'utf8').split('\n').flatMap((l, i) => removed.test(l) && !l.trim().startsWith('//') && !(f === 'tools/unify_check.mjs' && /const removed = /.test(l)) ? [`${f}:${i + 1}`] : []));
  const built = ['ride.js', 'ride_world.js'].every(f => fs.readFileSync(path.join(root, 'build.py'), 'utf8').includes(`'${f}'`));
  check('U0-R1', !hits.length && built, `只有一种漫游（骑行）：W10f 步行常量/步进/镜头残留 ${hits.join('、') || '无'}；build.py 收录 ride.js、ride_world.js：${built}`);
}
// --only U0 | --only U0,U6,U7 ... : U0 always runs; the other groups run when listed (no --only: all)
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null, want = id => !ONLY || ONLY.includes(id);
if (ONLY && ONLY.every(k => k === 'U0')) {
  console.log(`${failures ? 'FAIL' : 'PASS'} unify_check --only U0`);
  process.exit(failures ? 1 : 0);
}

// ---- U0 (W10b): the retired roads and the old edge ids are gone as identifiers (whole string literals) from the running code and the tools. world.js keeps the
// old id of an edge only as its source (the second argument of its E( / P( registration line); no table maps old ids to new ones.
{
  const OLD = /(['"`])(?:T(?:0[1-9]|1[01])(?:-(?:0[1-9]|1[0-5]|ridge|west|chain|RD0[1-8]))?|N(?:0[49]|1[0-3])-T0[2-6]|E-N1[123])\1/;
  const list = [...fs.readdirSync(root).filter(f => f.endsWith('.js') && f !== 'three.min.js'), ...fs.readdirSync(path.join(root, 'landmarks')).map(f => 'landmarks/' + f),
    ...fs.readdirSync(path.join(root, 'tools')).filter(f => f.endsWith('.mjs')).map(f => 'tools/' + f)];
  const old = list.flatMap(f => fs.readFileSync(path.join(root, f), 'utf8').split('\n').flatMap((l, i) => {
    const code = l.replace(/\/\/.*$/, '');
    return OLD.test(code) && !(f === 'world.js' && /^\s*[EP]\('RN\d\d-\d\d', '/.test(l)) ? [`${f}:${i + 1}`] : [];
  }));
  check('U0-W10b', !old.length, `旧边 ID、旧路线名与退役节点不再作为标识符出现（world.js 只在登记行的来源列保留旧 ID）：${old.slice(0, 12).join('、') || '无残留'}${old.length > 12 ? ` 等 ${old.length} 处` : ''}`);
}

// ---- U1-data (W10b, W10_SPEC section 5): the network of world.js against the approved design (docs/world/ROAD_NETWORK_DESIGN_DRAFT.md: the exit table of 2.3, the
// node, edge and retirement tables of section 4 and the numbers of section 5, read from the document itself), the town streets against layout.js, the exits'
// first metres, and every changed edge against the network of the baseline `pre-w10b`
if (want('U1')) {
  const require = createRequire(import.meta.url);
  globalThis.LAYOUT = require(path.join(root, 'layout.js'));
  const L = globalThis.LAYOUT, W = require(path.join(root, 'world.js')), NET = W.roadNetwork, D = Math.PI / 180, f = (v, n = 3) => v.toFixed(n);
  const md = fs.readFileSync(path.join(root, 'docs/world/ROAD_NETWORK_DESIGN_DRAFT.md'), 'utf8');
  const part = title => { const a = md.indexOf(title); if (a < 0) throw new Error('设计稿缺少 ' + title); const b = md.indexOf('\n#', a + title.length); return md.slice(a, b < 0 ? undefined : b); };
  const rows = t => t.split('\n').filter(l => /^\|\s*[A-Z]/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
  const num = (re, what) => { const m = md.match(re); if (!m) throw new Error('设计稿缺少 ' + what); return m.slice(1).map(Number); };
  const byId = Object.fromEntries(NET.edges.map(e => [e.id, e])), node = id => NET.nodeById[id], xz = id => W.lonLatToTown(node(id).lon, node(id).lat);
  const dSeg = (p, a, b) => { const dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t); };
  const flatOf = p => W.lonLatToTown(p.lon, p.lat);
  const designNodes = rows(part('### 4.1')), designEdges = rows(part('### 4.2')), retired = rows(part('### 4.3')), goneNodes = [...new Set(part('### 4.3').match(/E-N\d\d/g))];
  const exitRows = rows(part('### 2.3')).filter(r => /^N\d\d$/.test(r[0]));

  // topology
  {
    const probs = [], [nNodes, nEdges] = num(/合并后为 (\d+) 个节点、(\d+) 条道路边/, '节点与边数'), [nGraph] = num(/折为 (\d+) 个图节点/, '图节点数');
    const wantEnds = md.match(/唯一度数为 1 的端点是 ([^；。\n]+)/)[1].split(/、| 与 /).map(s => s.trim()).sort();
    if (new Set(NET.nodes.map(n => n.id)).size !== NET.nodes.length) probs.push('节点 ID 重复');
    if (new Set(NET.edges.map(e => e.id)).size !== NET.edges.length) probs.push('边 ID 重复');
    if (NET.nodes.length !== nNodes || NET.edges.length !== nEdges) probs.push(`节点 ${NET.nodes.length} / 边 ${NET.edges.length}，设计 ${nNodes} / ${nEdges}`);
    for (const [id, src, ends, cls] of designEdges) {
      const e = byId[id], [a, b] = ends.split('→').map(q => q.trim()), s0 = src.replace(/（[^）]*）/g, '').trim(), source = ['新增', 'CR01'].includes(s0) ? null : s0;
      if (!e) { probs.push(`${id} 未登记`); continue; }
      if (e.from !== a || e.to !== b) probs.push(`${id} 端点 ${e.from}→${e.to}，设计 ${a}→${b}`);
      if (e.class !== cls) probs.push(`${id} 等级 ${e.class}，设计 ${cls}`);
      if ((e.source || null) !== source) probs.push(`${id} 来源 ${e.source}，设计 ${source}`);
    }
    for (const e of NET.edges) if (!designEdges.some(r => r[0] === e.id)) probs.push(`${e.id} 不在设计边表内`);
    for (const [id] of retired) if (byId[id] || NET.edges.some(e => e.source === id)) probs.push(`退役边 ${id} 仍在网中`);
    for (const id of goneNodes) if (node(id)) probs.push(`退役端点 ${id} 仍在网中`);
    // the graph with every landmark's entrances merged into one node (as world_check WC3)
    const key = id => node(id).landmark || id, deg = {}, adj = {};
    for (const n of NET.nodes) { deg[key(n.id)] = 0; adj[key(n.id)] = new Set(); }
    for (const e of NET.edges) { const a = key(e.from), b = key(e.to); deg[a]++; deg[b]++; adj[a].add(b); adj[b].add(a); }
    const keys = Object.keys(deg), seen = new Set([keys[0]]), todo = [keys[0]];
    while (todo.length) for (const q of adj[todo.pop()]) if (!seen.has(q)) { seen.add(q); todo.push(q); }
    const ends = keys.filter(k => deg[k] === 1).sort();
    if (keys.length !== nGraph) probs.push(`合并地标入口后 ${keys.length} 个图节点，设计 ${nGraph}`);
    if (seen.size !== keys.length) probs.push(`不连通：${keys.length - seen.size} 个图节点到不了`);
    if (ends.join() !== wantEnds.join()) probs.push(`度数为 1 的节点 ${ends.join('、')}，设计 ${wantEnds.join('、')}`);
    check('U1-topology', !probs.length, `节点 ${NET.nodes.length}、边 ${NET.edges.length}，与设计稿 4.2 的 ${designEdges.length} 行逐边一致（端点、等级、来源）；退役 ${retired.length} 条边与 ${goneNodes.join('、')} 不在网中；合并地标入口后 ${keys.length} 个图节点${seen.size === keys.length ? '全部连通' : '不连通'}，度数为 1 的只有 ${ends.join('、')}${probs.length ? '；问题：' + probs.join('；') : ''}`);
  }

  // CR01
  {
    const probs = [], ring = NET.edges.filter(e => e.route === 'RN04'), C = NET.CR01, [half, radius] = num(/直边坐标位于 x=±([\d.]+) m.*?R=([\d.]+) m 圆弧/, 'CR01 尺寸'), [lenWant] = num(/中心线全长约 ([\d.]+) m/, 'CR01 长度');
    if (C.half !== half || C.radius !== radius) probs.push(`world.js CR01 ±${C.half} m / R ${C.radius} m，设计 ±${half} m / R ${radius} m`);
    ring.forEach((e, k) => { const nx = ring[(k + 1) % ring.length]; if (e.to !== nx.from) probs.push(`${e.id} 与 ${nx.id} 不相接`); });
    let flat = 0, arcs = 0, worstArc = 0, worstLine = 0;
    for (const e of ring) {
      const a = node(e.from), b = node(e.to), A = e.plane && e.plane.arc;
      if (!e.plane) { probs.push(`${e.id} 不在城镇平面上`); continue; }
      if (A) {
        arcs++; flat += A.r * (A.a1 - A.a0);
        if (A.r !== C.radius) probs.push(`${e.id} 半径 ${A.r}`);
        for (const p of NET.samplePath(e, 0.05)) { const t = flatOf(p); worstArc = Math.max(worstArc, Math.abs(Math.hypot(t.x - A.cx, t.z - A.cz) - C.radius)); }
      } else {
        flat += Math.hypot(b.x - a.x, b.z - a.z);
        if (!((a.x === b.x && Math.abs(a.x) === C.half) || (a.z === b.z && Math.abs(a.z) === C.half))) probs.push(`${e.id} 不在 ±${C.half} m 的直边上`);
        for (const p of NET.samplePath(e, 0.05)) worstLine = Math.max(worstLine, dSeg(flatOf(p), a, b));
      }
    }
    let worstNode = 0, worstNodeId = '';
    for (const [id, cell] of designNodes) { const m = cell.match(/\(([-\d.]+),\s*([-\d.]+)\)/), q = node(id); if (!q) { probs.push(`${id} 未登记`); continue; } const t = xz(id), d = Math.hypot(t.x - Number(m[1]), t.z - Number(m[2])); if (d > worstNode) { worstNode = d; worstNodeId = id; } }
    if (Math.abs(flat - lenWant) > 0.01) probs.push(`平面长 ${f(flat)} m，设计 ${lenWant} m`);
    if (worstArc > 0.001) probs.push(`圆角取样离 R ${C.radius} m ${f(worstArc, 4)} m`); if (worstLine > 0.001) probs.push(`直边取样离中线 ${f(worstLine, 4)} m`);
    if (worstNode > 0.001) probs.push(`${worstNodeId} 与设计稿坐标相差 ${f(worstNode, 4)} m`);
    if (ring.length !== designNodes.length) probs.push(`${ring.length} 条边对 ${designNodes.length} 个节点`);
    check('U1-CR01', !probs.length, `${ring.length} 条边首尾相接闭合，平面长 ${f(flat)} m（设计 ${lenWant} m）、真实长 ${f(ring.reduce((s, e) => s + NET.edgeLength(e), 0), 2)} m；直边在 x、z = ±${C.half} m，取样离中线最大 ${f(worstLine, 5)} m；${arcs} 段 R ${C.radius} m 圆弧，取样离半径最大 ${f(worstArc, 5)} m；${designNodes.length} 个节点与设计稿 4.1 最大相差 ${f(worstNode, 6)} m（${worstNodeId}）${probs.length ? '；问题：' + probs.join('；') : ''}`);
  }

  // the town streets: one edge per layout.js segment, its class and width from layout.js, every sample on the segment's centre line
  {
    const probs = [], town = NET.edges.filter(e => /^TOWN_/.test(e.class)), CLASS = { main: 'TOWN_MAIN', branch: 'TOWN_BRANCH', alley: 'TOWN_ALLEY' };
    let worst = 0, n = 0;
    for (const sg of L.roadSegments) {
      const e = town.find(q => q.source === sg.id); if (!e) { probs.push(`${sg.id} 没有对应的边`); continue; }
      if (e.class !== CLASS[sg.type]) probs.push(`${e.id} 等级 ${e.class}，layout.js ${sg.type}`);
      if ([e.from, e.to].sort().join() !== [sg.from, sg.to].sort().join()) probs.push(`${e.id} 端点 ${e.from}–${e.to}，layout.js ${sg.from}–${sg.to}`);
      const want = sg.type === 'alley' ? L.ALLEY.width : L.ROAD_TYPES[sg.type].carriageway; if (NET.townClasses[e.class].carriageway !== want) probs.push(`${e.id} 车行道 ${NET.townClasses[e.class].carriageway} m，layout.js ${want} m`);
      const a = L.roadNodes.find(q => q.id === sg.from), b = L.roadNodes.find(q => q.id === sg.to);
      for (const p of NET.samplePath(e, 0.25)) { worst = Math.max(worst, dSeg(flatOf(p), a, b)); n++; }
    }
    if (town.length !== L.roadSegments.length) probs.push(`城镇等级的边 ${town.length} 条，layout.js 路段 ${L.roadSegments.length} 段`);
    if (worst > 0.001) probs.push(`取样离 layout.js 中线 ${f(worst, 4)} m`);
    check('U1-town', !probs.length, `${town.length} 条城镇等级的边与 layout.js 的 ${L.roadSegments.length} 个路段一一对应（等级、端点、车行道宽度读自 layout.js），${n} 个取样离 layout.js 中线最大 ${f(worst, 6)} m${probs.length ? '；问题：' + probs.join('；') : ''}`);
  }

  // the nine exits: a straight 6 m connector to the ring node of design 2.3, along the street's axis; position and direction at the town edge, radius to the first junction
  {
    const probs = [], LIMIT = { RD03: 12, RD05: 6 }, out = [];
    for (const [exit, ringCell, connCell] of exitRows) {
      const ringId = ringCell.split(/\s/)[0], connId = connCell.split('：')[0], e = byId[connId], n = node(exit);
      if (!e) { probs.push(`${exit} 的接线 ${connId} 未登记`); continue; }
      if ([e.from, e.to].sort().join() !== [exit, ringId].sort().join()) { probs.push(`${connId} 不连 ${exit} 与 ${ringId}`); continue; }
      if (!e.plane || !e.plane.line) probs.push(`${connId} 不是城镇平面上的直线`);
      const street = NET.edges.find(q => /^TOWN_/.test(q.class) && (q.from === exit || q.to === exit)), o = node(street.from === exit ? street.to : street.from), r = node(ringId);
      const u = [n.x - o.x, n.z - o.z], v = [r.x - n.x, r.z - n.z], lu = Math.hypot(...u), lv = Math.hypot(...v), ang = Math.acos(Math.min(1, (u[0] * v[0] + u[1] * v[1]) / lu / lv)) / D;
      // on the sphere: the connector's first 0.5 m and the street's last 0.5 m, as bearings at the exit; the connector's first sample against the exit node
      let S = NET.samplePath(e, 0.25); if (e.to === exit) S = S.slice().reverse();
      let T = NET.samplePath(street, 0.25); if (street.to === exit) T = T.slice().reverse();
      const brgC = W.bearing(S[0], S[2]), brgS = (W.bearing(T[0], T[2]) + 180) % 360, dBrg = Math.abs(((brgC - brgS + 540) % 360) - 180), dPos = W.arcDistance(S[0], n);
      // horizontal radius from 1 m chords of the plane centre line between the exit and the ring node
      const P = S.map(flatOf); let rMin = Infinity;
      for (let i = 4; i + 4 < P.length; i++) { const A = P[i - 4], B = P[i], Cc = P[i + 4], cr = Math.abs((B.x - A.x) * (Cc.z - A.z) - (B.z - A.z) * (Cc.x - A.x)); rMin = Math.min(rMin, cr < 1e-12 ? Infinity : Math.hypot(B.x - A.x, B.z - A.z) * Math.hypot(Cc.x - B.x, Cc.z - B.z) * Math.hypot(Cc.x - A.x, Cc.z - A.z) / (2 * cr)); }
      if (Math.abs(lv - 6) > 1e-9) probs.push(`${connId} 平面长 ${f(lv, 4)} m`);
      if (dPos > 0.01) probs.push(`${exit} 位置差 ${f(dPos, 4)} m`); if (ang > 0.5 || dBrg > 0.5) probs.push(`${exit} 方向差 ${f(ang, 3)}°（平面）/ ${f(dBrg, 3)}°（球面）`);
      if (LIMIT[e.class] && rMin < LIMIT[e.class]) probs.push(`${connId} 半径 ${f(rMin, 1)} m < ${LIMIT[e.class]} m`);
      out.push(`${exit}→${ringId}（${connId} ${e.class}，平面 ${f(lv, 2)} m / 真实 ${f(NET.edgeLength(e), 2)} m，方向差 ${f(Math.max(ang, dBrg), 4)}°，位置差 ${f(dPos, 4)} m，半径 ${rMin > 1000 ? '> 1 km（直线）' : f(rMin, 1) + ' m'}）`);
    }
    if (exitRows.length !== 9 || NET.nodes.filter(q => q.kind === 'town-exit').length !== 9) probs.push('出口不是 9 个');
    check('U1-exits', !probs.length, `九个出口都以 6 m 直线沿街道轴线直出到 CR01：${out.join('；')}${probs.length ? '；问题：' + probs.join('；') : ''}`);
  }

  // RN05-01 and RN06-01 stay outside the ring; RN05-01 is T02-01's own line beyond the cut. The changed edges against pre-w10b.
  {
    const os = await import('node:os'), { execFileSync } = await import('node:child_process'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unify-u1-'));
    for (const fl of ['world.js', 'layout.js']) fs.writeFileSync(path.join(tmp, fl), execFileSync('git', ['show', `pre-w10b:${fl}`], { cwd: root }));
    const OLD = require(path.join(tmp, 'world.js')), ON = OLD.roadNetwork, probs = [], C = NET.CR01;
    const ringDist = p => { const t = flatOf(p), dx = Math.abs(t.x) - (C.half - C.radius), dz = Math.abs(t.z) - (C.half - C.radius); return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - C.radius; };
    const inside = {}; for (const id of ['RN05-01', 'RN06-01']) inside[id] = Math.min(...NET.samplePath(byId[id], 0.05).map(ringDist));
    for (const [id, d] of Object.entries(inside)) if (d < -0.001) probs.push(`${id} 进入环内 ${f(-d, 3)} m`);
    const devTo = (e, o) => { const V = ON.samplePath(o, 0.1).map(p => W.vec(p.lon, p.lat)); let worst = 0; for (const p of NET.samplePath(e, 0.25)) { const v = W.vec(p.lon, p.lat); let best = Infinity; for (let i = 0; i + 1 < V.length; i++) best = Math.min(best, W.arcPointDistance(v, V[i], V[i + 1])); worst = Math.max(worst, best); } return worst; };
    const [cutWant] = num(/交点里程 ([\d.]+) m/, 'T02-01 截去长度'), t02 = ON.edges.find(q => q.id === byId['RN05-01'].source), cut = ON.edgeLength(t02) - NET.edgeLength(byId['RN05-01']), on = devTo(byId['RN05-01'], t02);
    if (Math.abs(cut - cutWant) > 0.01) probs.push(`T02-01 截去 ${f(cut)} m，设计 ${cutWant} m`); if (on > 0.001) probs.push(`RN05-01 离原线 ${f(on, 4)} m`);
    const changed = new Set(designEdges.filter(r => /截点|新分段|截短|改接/.test(r[1])).map(r => r[0])), rows2 = [], same = [];
    for (const e of NET.edges.filter(q => q.source && ON.edges.some(o => o.id === q.source))) {
      const o = ON.edges.find(q => q.id === e.source), identical = JSON.stringify(o.controls) === JSON.stringify(e.controls) && JSON.stringify(ON.samplePath(o, 0.5)) === JSON.stringify(NET.samplePath(e, 0.5));
      if (identical) { same.push(e.id); if (changed.has(e.id)) probs.push(`${e.id} 应按设计改动却与原线相同`); continue; }
      if (!changed.has(e.id)) probs.push(`${e.id} 与原 ${o.id} 不同，设计没有改它`);
      rows2.push(`${e.id}（原 ${o.id}）${e.from}→${e.to} 最大偏差 ${f(devTo(e, o), 3)} m`);
    }
    check('U1-changes', !probs.length, `RN05-01、RN06-01 离环线中线最近 ${f(inside['RN05-01'], 3)} / ${f(inside['RN06-01'], 3)} m（不进环内）；RN05-01 在 T02-01 原线上（偏差 ${f(on, 6)} m），截去 ${f(cut, 3)} m（设计 ${cutWant} m）；对 pre-w10b：${same.length} 条保留边逐位相同，改动 ${rows2.length} 条：${rows2.join('；')}${probs.length ? '；问题：' + probs.join('；') : ''}`);
  }
}

// ---- U1-geometry (W10c): every town edge and its outdoor continuation share one swept route row at the frozen layout boundary
if (want('U1')) {
  const require = createRequire(import.meta.url), W = require(path.join(root, 'world.js')), L = require(path.join(root, 'layout.js'));
  const TERR = require(path.join(root, 'terrain.js'));
  globalThis.LAYOUT = L; globalThis.ROADKIT = require(path.join(root, 'roadkit.js')); globalThis.BRIDGE = require(path.join(root, 'bridge.js')); globalThis.STEPS = require(path.join(root, 'steps.js'));
  const ROADS = require(path.join(root, 'roads.js')), NET = W.roadNetwork, D = Math.PI / 180, H = TERR.sampler(W, { lonMin: -181, lonMax: 181, latMin: -90, latMax: 90 }), TB = TERR.builder(W),
    PLAN = ROADS.plan(W, H, (lo, la) => TB.vertex(lo, la).c), md = fs.readFileSync(path.join(root, 'docs/world/ROAD_NETWORK_DESIGN_DRAFT.md'), 'utf8'),
    part = title => { const a = md.indexOf(title), b = md.indexOf('\n#', a + title.length); return md.slice(a, b < 0 ? undefined : b); },
    rows = t => t.split('\n').filter(l => /^\|\s*[A-Z]/.test(l)).map(l => l.split('|').slice(1, -1).map(c => c.trim())),
    exitRows = rows(part('### 2.3')).filter(r => /^N\d\d$/.test(r[0])), probs = [], out = [], absAng = (a, b) => { const d = Math.abs(((a - b + 540) % 360) - 180); return Math.min(d, 180 - d); };
  for (const [exit, ringCell, connCell] of exitRows) {
    const ringId = ringCell.split(/\s/)[0], connId = connCell.split('：')[0], n = NET.nodeById[exit], e = NET.edges.find(q => q.id === connId),
      rt = PLAN.routes.find(q => q.def.segs.some(sg => sg.id === connId)), i = rt ? rt.samples.reduce((best, p, k) => W.arcDistance(p, n) < W.arcDistance(rt.samples[best], n) ? k : best, 0) : -1;
    if (!rt) { probs.push(`${exit} 没有包含接线与城镇段的共同路线`); continue; }
    const row = rt.samples[i], pos = W.arcDistance(row, n), prev = rt.flatOf[Math.max(0, i - 1)], next = rt.flatOf[Math.min(rt.samples.length - 1, i + 1)], from = W.lonLatToTown(n.lon, n.lat), to = W.lonLatToTown(NET.nodeById[ringId].lon, NET.nodeById[ringId].lat),
      ax = next.x - prev.x, az = next.z - prev.z, bx = to.x - from.x, bz = to.z - from.z, dir = Math.acos(Math.min(1, Math.abs((ax * bx + az * bz) / Math.hypot(ax, az) / Math.hypot(bx, bz)))) / D,
      travel = i < rt.samples.length - 1 ? W.arcDistance(rt.samples[i + 1], n) - W.arcDistance(rt.samples[i], n) : -1, iOut = i === 0 ? 1 : i === rt.samples.length - 1 ? i - 1 : travel >= 0 ? i + 1 : i - 1,
      half = NET.townClasses[NET.edges.find(q => /^TOWN_/.test(q.class) && (q.from === exit || q.to === exit)).class].carriageway / 2,
      streetClass = NET.edges.find(q => /^TOWN_/.test(q.class) && (q.from === exit || q.to === exit)).class, roadLevel = streetClass === 'TOWN_ALLEY' ? L.LEVELS.pavement : L.LEVELS.carriageway,
      h0 = rt.surface(i, 0), groundLevel = W.height(n.lon, n.lat) + roadLevel, heightError = Math.abs(h0 - groundLevel),
      sidewalkOffsets = half < 2 ? [] : [-6, -4, 4, 6], walkStep = sidewalkOffsets.length ? Math.max(...sidewalkOffsets.map(o => Math.abs(rt.surface(i, o) - rt.surface(iOut, o)))) : 0,
      shared = rt.strip.vertexCount >= rt.samples.length * rt.grid.length && rt.strip.index.length > 0 && rt.classes.some(c => /^TOWN_/.test(c)) && rt.classes.some(c => !/^TOWN_/.test(c));
    if (pos > 0.01) probs.push(`${exit} 边界行中线差 ${pos.toFixed(4)} m`); if (dir > 0.5) probs.push(`${exit} 路由方向差 ${dir.toFixed(3)}°`);
    if (heightError > 0.005) probs.push(`${exit} 路面标高差 ${heightError.toFixed(4)} m`);
    if (walkStep > 0.02) probs.push(`${exit} 人行道端头相邻行高差 ${walkStep.toFixed(4)} m`); if (!shared) probs.push(`${exit} 没有同一条城镇-城外扫掠网格`);
    out.push(`${exit}：中线 ${pos.toFixed(4)} m、方向 ${dir.toFixed(3)}°、道路标高 ${heightError.toFixed(4)} m、共用边界行高差 0 m、人行道端头 ${walkStep.toFixed(4)} m、同网格 ${shared}`);
    void e;
  }
  check('U1-geometry', !probs.length, `9 个城镇出口在边界行接入统一扫掠路由（位置 ≤0.01 m、方向 ≤0.5°、标高 ≤0.005 m、路面相邻行 ≤0.01 m、人行道端头 ≤0.02 m）：${out.join('；')}${probs.length ? '；问题：' + probs.join('；') : ''}`);
}

// ---- U4 (W10c): the frozen town layout still drives every town street and street detail
if (want('U4')) {
  const { execFileSync } = await import('node:child_process');
  const require = createRequire(import.meta.url), W = require(path.join(root, 'world.js')), L = require(path.join(root, 'layout.js'));
  globalThis.LAYOUT = L; globalThis.ROADKIT = require(path.join(root, 'roadkit.js')); globalThis.BRIDGE = require(path.join(root, 'bridge.js')); globalThis.STEPS = require(path.join(root, 'steps.js'));
  const TERR = require(path.join(root, 'terrain.js')), ROADS = require(path.join(root, 'roads.js')), H = TERR.sampler(W, { lonMin: -181, lonMax: 181, latMin: -90, latMax: 90 }), TB = TERR.builder(W), PLAN = ROADS.plan(W, H, (lo, la) => TB.vertex(lo, la).c),
    net = W.roadNetwork, nodes = Object.fromEntries(L.roadNodes.map(n => [n.id, n])), townEdges = net.edges.filter(e => /^TOWN_/.test(e.class)), bySource = new Map(L.roads.flatMap(r => r.nodes.slice(1).map((_, i) => [`${r.id}-${i + 1}`, { a: nodes[r.nodes[i]], b: nodes[r.nodes[i + 1]], half: L.ROAD_TYPES[r.type].carriageway / 2 }]))), issues = [];
  for (const alley of L.alleys) bySource.set(alley.id, { a: nodes[alley.nodes[0]], b: nodes[alley.nodes[1]], half: L.ALLEY.width / 2 });
  let centerError = 0, widthError = 0, meshEdgeError = 0, levelError = 0, count = 0;
  for (const e of townEdges) {
    const layout = bySource.get(e.source), rt = PLAN.routes.find(q => q.def.segs.some(s => s.id === e.id));
    if (!layout || !rt) { issues.push(`${e.source || e.id} 没有对应城镇布局或扫掠路由`); continue; }
    const k = rt.def.segs.findIndex(s => s.id === e.id), { a, b, half } = layout, dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz,
      level = e.class === 'TOWN_ALLEY' ? L.LEVELS.pavement : L.LEVELS.carriageway;
    for (let i = 0; i < rt.samples.length; i++) if (rt.edgeOf[i] === k) {
      const p = W.lonLatToTown(rt.samples[i].lon, rt.samples[i].lat), t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)), d = Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t),
        cw = rt.carriageway[i], w = Math.max(Math.abs(cw[0] + half), Math.abs(cw[1] - half)), h = rt.surface(i, 0),
        crossesStreet = e.class === 'TOWN_ALLEY' && L.roads.some(r => r.axis === 'z' && Math.abs(p.x - r.at) <= L.ROAD_TYPES[r.type].carriageway / 2 + 0.5),
        dh = Math.abs(h - W.height(rt.samples[i].lon, rt.samples[i].lat) - (crossesStreet ? 0.015 : level));
      centerError = Math.max(centerError, d); widthError = Math.max(widthError, w); levelError = Math.max(levelError, dh); count++;
      if (rt.joints.every(s => Math.abs(rt.samples[i].s - s) > 20)) {
        const m = rt.grid.length, F = rt.flatOf[i], T = rt.tangent[i], scale = rt.cf[i] * F.k;
        const profile = globalThis.ROADKIT.PROFILES[e.class];
        for (const [j, want] of [[0, profile.pts[0][0]], [m - 1, profile.pts.at(-1)[0]]]) {
          const x = rt.strip.pos[(i * m + j) * 3], z = rt.strip.pos[(i * m + j) * 3 + 2], offset = ((x - F.x) * -T[1] + (z - F.z) * T[0]) / scale;
          meshEdgeError = Math.max(meshEdgeError, Math.abs(offset - want));
        }
      }
    }
  }
  const layoutBytes = fs.readFileSync(path.join(root, 'layout.js')), frozenBytes = execFileSync('git', ['show', 'pre-w10c:layout.js']);
  if (!layoutBytes.equals(frozenBytes)) issues.push('layout.js 与 pre-w10c 不同（冻结的街道、街区岛、横道、篦子或水洼数据被改动）');
  if (centerError > 0.01) issues.push(`城镇路由中线离 layout.js ${centerError.toFixed(4)} m`);
  if (widthError > 0.01) issues.push(`城镇路由半宽离 layout.js ${widthError.toFixed(4)} m`);
  if (meshEdgeError > 0.02) issues.push(`城镇实际网格外沿离本路段断面 ${meshEdgeError.toFixed(4)} m`);
  if (levelError > 0.005) issues.push(`城镇路面标高离 ground + LEVELS ${levelError.toFixed(4)} m`);
  check('U4-data', !issues.length, `layout.js 冻结数据${layoutBytes.equals(frozenBytes) ? '与 pre-w10c 逐字节相同' : '不一致'}；${townEdges.length} 条城镇等级边、${count} 个断面样本：中线最大差 ${centerError.toFixed(5)} m、半宽最大差 ${widthError.toFixed(5)} m、实际网格外沿最大差 ${meshEdgeError.toFixed(5)} m、路面标高最大差 ${levelError.toFixed(5)} m（限 0.01 / 0.01 / 0.02 / 0.005 m）；街区岛、横道、标线、篦子与水洼仍由 layout.js 数据驱动${issues.length ? '；问题：' + issues.join('；') : ''}`);
  const ring = PLAN.routes.find(r => r.def.id === 'CR01'), ringNodes = net.nodes.filter(n => n.id.startsWith('C01-')),
    nearest = (rt, n) => rt.samples.reduce((best, s, i) => { const d = W.arcDistance(s, n); return d < best.d ? { d, i } : best; }, { d: Infinity, i: 0 });
  let maxJointStep = 0, ringCrossings = 0; const jointIssues = [];
  for (const n of ringNodes) {
    const arrivals = PLAN.routes.filter(rt => rt !== ring && rt.def.segs.some(seg => { const e = net.edges.find(q => q.id === seg.id); return e.from === n.id || e.to === n.id; }));
    for (const rt of arrivals) { const a = nearest(ring, n), b = nearest(rt, n), step = Math.abs(ring.surface(a.i, 0) - rt.surface(b.i, 0)); maxJointStep = Math.max(maxJointStep, step); ringCrossings++; if (step > 0.02) jointIssues.push(`${n.id} ${step.toFixed(4)} m`); }
  }
  if (ringCrossings !== 10) jointIssues.push(`环城路交点 ${ringCrossings}，应为 10`);
  let faces = 0, zeroArea = 0, duplicateFaces = 0;
  for (const rt of PLAN.routes) { const { pos, index } = rt.strip, seen = new Set(); for (let k = 0; k < index.length; k += 3) {
    const a = index[k], b = index[k + 1], c = index[k + 2], A = a * 3, B = b * 3, C = c * 3,
      area2 = (pos[B] - pos[A]) * (pos[C + 2] - pos[A + 2]) - (pos[B + 2] - pos[A + 2]) * (pos[C] - pos[A]), key = [a, b, c].sort((x, y) => x - y).join(',');
    if (Math.abs(area2) < 1e-10) zeroArea++; if (seen.has(key)) duplicateFaces++; else seen.add(key); faces++;
  } }
  check('U4-junctions', !jointIssues.length && zeroArea === 0 && duplicateFaces === 0,
    `环城路 ${ringCrossings} 个交点中心标高最大差 ${maxJointStep.toFixed(4)} m（限 0.02 m）；道路网格 ${faces} 个三角面，零面积 ${zeroArea}、重复索引面 ${duplicateFaces}${jointIssues.length ? '；问题：' + jointIssues.join('；') : ''}`);

  // CR01 asphalt remains in its original swept mesh. Branch meshes are trimmed at that mesh;
  // only the ring's outer section opens for each connected arm.
  const expectedCR01 = {
    'C01-N': ['RN02-01', 'RN04-02', 'RN04-03'], 'C01-W-N09': ['RN03-01', 'RN04-16', 'RN04-17'],
    'C01-E-N10': ['RN03-04', 'RN04-06', 'RN04-07'], 'C01-W-N11': ['RN13-01', 'RN04-14', 'RN04-15'],
    'C01-E-N12': ['RN13-04', 'RN04-08', 'RN04-09'], 'C01-E-N13': ['RN14-01', 'RN04-05', 'RN04-06'],
    'C01-T02': ['RN05-01', 'RN04-01', 'RN04-02'], 'C01-W-N01': ['RN01-15', 'RN01-16', 'RN04-15', 'RN04-16'],
    'C01-E-N03': ['RN01-19', 'RN01-01', 'RN04-07', 'RN04-08'], 'C01-S': ['RN02-07', 'RN06-01', 'RN04-11', 'RN04-12'],
  }, expectedNodes = Object.keys(expectedCR01), crJ = PLAN.junctions.filter(q => q.kind === 'CR01'), ringRoad = PLAN.routes.find(q => q.def.id === 'CR01');
  let shoulderLiftError = 0, shoulderColorError = 0;
  const asphaltColor = globalThis.ROADKIT.lin(globalThis.ROADKIT.COL.asphalt), shoulderM = ringRoad.grid.length;
  for (let i = 0; i < ringRoad.samples.length; i++) for (const o of [2.25, 2.3, 2.5, 2.75]) {
    const [lon, lat] = ringRoad.lateral(i, o * ringRoad.cf[i]), relativeLift = ringRoad.surface(i, o) - W.height(lon, lat);
    shoulderLiftError = Math.max(shoulderLiftError, Math.abs(relativeLift - 0.045));
    const j = ringRoad.grid.findIndex(v => Math.abs(v - o) < 1e-6), p = (i * shoulderM + j) * 3;
    if (j >= 0) for (let c = 0; c < 3; c++) shoulderColorError = Math.max(shoulderColorError, Math.abs(ringRoad.strip.col[p + c] - asphaltColor[c]));
  }
  const signedArea = poly => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0),
    inConvex = (p, poly) => { const sign = signedArea(poly) >= 0 ? 1 : -1; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if (((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * sign < -1e-6) return false; } return true; },
    pointSeg = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1e-12))); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t); },
    polyDistance = (p, poly) => inConvex(p, poly) ? 0 : Math.min(...poly.map((a, i) => pointSeg(p, a, poly[(i + 1) % poly.length]))),
    flat = p => [90 * p.lon * Math.PI / 180, -90 * Math.asinh(Math.tan(p.lat * Math.PI / 180))];
  let nodeErrors = [], overlapCount = 0, overlapAreaTotal = 0, instanceLeaks = [], clippedArea = 0, cutTriangles = 0, removedObjects = 0, seamError = 0, seamAt = '', seamSamples = 0;
  const clearance = { weed: 0.8, tuft: 0.8, shrubLow: 0.8, lamp: 1, lampSmall: 1, pole: 0.8, signBus: 0.8, busBench: 1.2, mirror: 0.7, vending: 1, jizo: 0.8, lantern: 0.6, stonePost: 0.6, bollard: 0.5, barrierConcrete: 0.75, gatePost: 0.5, snowPole: 0.45 };
  for (const j of crJ) {
    const expectedEdges = expectedCR01[j.node], actualEdges = net.edges.filter(e => e.from === j.node || e.to === j.node).map(e => e.id).sort();
    if (!expectedEdges || JSON.stringify(actualEdges) !== JSON.stringify(expectedEdges.slice().sort())) nodeErrors.push(`${j.node} 拓扑 ${actualEdges.join('/')}，应为 ${(expectedEdges || []).join('/')}`);
    if (j.strip.index.length || j.paving !== 'continuous-asphalt' || j.area < 1) nodeErrors.push(`${j.node} 仍有独立路口补面或缺少路口边界`);
    clippedArea += j.cuts.reduce((s, c) => s + c.removedArea, 0); cutTriangles += j.cuts.reduce((s, c) => s + c.clippedTriangles, 0); removedObjects += j.removedInstances.length;
  }
  // The whole ring, not a window round each node: the CR01 paving rebuilt from the ring's final indexed triangles (their swept column offset in -2.25 ... 2.75 m),
  // every other route's final triangles (its whole cross-section) against it and against the ring's side bands, and the branch vertices on its outline.
  const RP = ringParts(ringRoad), pavedSet = new Set(RP.paved), others = PLAN.routes.filter(r => r !== ringRoad).flatMap(r => stripTriangles(r.strip, r.def.id).filter(t => t.box[1] > -66 && t.box[0] < 66 && t.box[3] > -66 && t.box[2] < 66));
  const sideIndex = gridIndex(RP.side, 1), overlapBy = {}; let sideOverlap = 0;
  for (const t of others) {
    for (const r of RP.pavedIndex.query(t.box)) { const a = polyArea2D(clip2D(t.v, r.v)); if (a > TOL_PAIR) { overlapCount++; overlapAreaTotal += a; overlapBy[t.owner] = (overlapBy[t.owner] || 0) + a; } }
    for (const r of sideIndex.query(t.box)) { const a = polyArea2D(clip2D(t.v, r.v)); if (a > TOL_PAIR) sideOverlap += a; }
    for (let k = 0; k < 3; k++) { const r = ringHeight(RP, t.v[k][0], t.v[k][1], 1e-6); if (!r || !pavedSet.has(r.t)) continue; const error = Math.abs(t.y[k] - r.h); seamSamples++; if (error > seamError) { seamError = error; seamAt = `${t.owner} (${t.v[k][0].toFixed(2)},${t.v[k][1].toFixed(2)})`; } }
  }
  if (overlapCount) nodeErrors.push(`其他道路仍与 CR01 铺装正面积交叠：${Object.entries(overlapBy).map(([k, a]) => `${k} ${a.toFixed(4)} m²`).join('、')}`);
  if (sideOverlap > 0) nodeErrors.push(`其他道路仍与 CR01 侧带交叠 ${sideOverlap.toFixed(4)} m²`);
  // The paving is the swept one, complete, and the closure row (C01-NW) is one cross-section.
  const rn = ringRoad.samples.length, rm = ringRoad.grid.length, jL = ringRoad.grid.indexOf(-2.25), jR = ringRoad.grid.indexOf(2.75), wantPaved = (rn - 1) * 2 * (jR - jL);
  if (RP.paved.length !== wantPaved || RP.paved.some(t => t.ids.some(k => k >= rn * rm))) nodeErrors.push(`CR01 铺装三角形 ${RP.paved.length}（应为原扫掠 ${wantPaved}）`);
  let closure = 0; for (let k = 0; k < rm * 3; k++) closure = Math.max(closure, Math.abs(ringRoad.strip.pos[k] - ringRoad.strip.pos[(rn - 1) * rm * 3 + k]));
  if (closure > 1e-6) nodeErrors.push(`CR01 闭环首末行不重合 ${closure.toFixed(6)}`);
  // W10c: the road lamps' feet come from one table (streetlights.js), planned here from the same roads and W4 plan (the land cover only moves a lamp along or across its road;
  // tools/streetlight_check.mjs checks the page's final table); a lamp of the ring itself stands beside the carriageway by construction, the others must keep out of the junctions
  const LC = require(path.join(root, 'landcover.js')), W4 = LC.build(W, H, { footprint: LC.LANDCOVER_FOOTPRINT }).w4;
  const SLP = require(path.join(root, 'streetlights.js')).plan({ W: Object.assign(Object.create(W), { height: H }), L, roads: PLAN, RK: ROADS, cover: { cells: [], items: W4.items, w4: W4 }, town: { puddles: [], alleyLamps: [] } });
  const placed = [...PLAN.routes.flatMap(rt => Object.entries(rt.instances || {}).flatMap(([type, list]) => list.map(it => ({ rt: rt.def.id, type, it })))), ...SLP.lamps.filter(q => q.owner !== 'town').map(q => ({ rt: q.line === 'CR01' ? 'CR01' : 'streetlights', type: 'lamp', it: { lon: q.lon, lat: q.lat, station: q.id } }))];
  for (const { rt: routeId, type, it } of placed) {
    const p = flat(it), radius = clearance[type] ?? 0.6;
    let conflict = crJ.find(j => polyDistance(p, j.polygon) <= radius + 1e-6)?.node || null;
    if (!conflict && routeId !== 'CR01' && Math.abs(p[0]) < 66 && Math.abs(p[1]) < 66) {              // anywhere along the ring (RN05 runs beside it for some 25 m)
      const pr = ROADS.project(ringRoad, it.lon, it.lat); if (pr && Math.abs(pr.o) < 10) {
        const nearest = crJ.map(j => { const a = j.arms.filter(q => q.routeId === 'CR01').reduce((best, q) => Math.abs(q.nodeS - pr.s) < best.d ? { d: Math.abs(q.nodeS - pr.s), s: q.nodeS } : best, { d: Infinity, s: 0 }), delta = Math.abs(a.s - pr.s); return { node: j.node, d: Math.min(delta, Math.max(0, ringRoad.length - delta)) }; }).sort((a, b) => a.d - b.d)[0];
        const q = ROADS.atS(ringRoad, pr.s), bounds = ringRoad.carriageway[q.i].map((v, side) => v + (ringRoad.carriageway[q.i + 1][side] - v) * q.t); if (pr.o >= bounds[0] - radius && pr.o <= bounds[1] + radius) conflict = `${nearest.node}/CR01-carriageway`;
      }
    }
    if (conflict) { instanceLeaks.push(`${conflict}/${routeId}/${type} s=${it.station ?? '—'}`); }
  }
  const vegetationProbes = [['N11-C01', 48.41], ['N12-C01', 48.41], ['N13-C01', 48.41], ['N13-C01', 49.11], ['RN05-RD03', 6.18], ['RN05-RD03', 13.97], ['RN05-RD03', 18.04]],
    activeVegetation = vegetationProbes.reduce((n, [id, s]) => { const rt = PLAN.routes.find(q => q.def.id === id); return n + ['weed', 'tuft'].flatMap(t => rt.instances[t] || []).filter(q => Math.abs((q.station ?? -1000) - s) < 0.2).length; }, 0);
  if (instanceLeaks.length) nodeErrors.push(`${instanceLeaks.length} 个路面实例仍侵入路口净空：${instanceLeaks.slice(0, 8).join('、')}`);
  if (crJ.length !== expectedNodes.length || expectedNodes.some(id => !crJ.some(q => q.node === id))) nodeErrors.push(`CR01 统一路口 ${crJ.length} 个，应有 ${expectedNodes.length} 个`);
  if (shoulderLiftError > 0.005) nodeErrors.push(`CR01 内侧 0.5 m 肩带未收平，最大相对抬升误差 ${shoulderLiftError.toFixed(5)} m`);
  if (shoulderColorError > 0.0001) nodeErrors.push(`CR01 内侧 0.5 m 肩带未并入沥青，最大颜色差 ${shoulderColorError.toFixed(6)}`);
  if (seamError > 0.02) nodeErrors.push(`支路与环路铺装边界高度差 ${seamError.toFixed(4)} m（${seamAt}）`);
  check('U4-CR01-junctions', !nodeErrors.length && overlapCount === 0 && instanceLeaks.length === 0,
    `10 节点 ${crJ.length} 个，十字/共用节点 ${crJ.filter(j => expectedCR01[j.node]?.length === 4).map(j => j.node).join('、')}；全环 CR01 铺装（最终索引三角形 ${RP.paved.length} 个重建，含闭环接缝 ${closure.toFixed(6)}）与其他道路完整断面正面积交叠 ${overlapCount} 对 / ${overlapAreaTotal.toFixed(6)} m²，与 CR01 侧带交叠 ${sideOverlap.toFixed(6)} m²；接缝 ${seamSamples} 顶点最大高度差 ${seamError.toFixed(4)} m（${seamAt}）；草簇、杂草及设施与路口/CR01 车行道净空冲突 ${instanceLeaks.length}；已定位植被站位 ${vegetationProbes.length} 处，仍有植被 ${activeVegetation}；内侧肩带最大高度误差 ${shoulderLiftError.toFixed(5)} m、最大沥青色差 ${shoulderColorError.toFixed(6)}；裁切覆盖面积 ${clippedArea.toFixed(2)} m²、边界三角 ${cutTriangles}、移除实例 ${removedObjects}${nodeErrors.length ? '；问题：' + nodeErrors.slice(0, 12).join('；') : ''}${instanceLeaks.length ? '；设施样例：' + instanceLeaks.slice(0, 6).join('、') : ''}`);
}

// ---- U3 (W10a)
if (process.argv.includes('--no-browser')) console.log('（--no-browser：U3 不跑）');
else if (want('U2') || want('U3') || want('U5')) {
const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // the scene graph at the very first render: every mesh / line set with its instance capacity, the pipeline and module state, the auto probe
  await page.addInitScript(() => {
    let value;
    Object.defineProperty(window, '__scene', { get: () => value, set: S => { value = S; const render = S.renderer.render.bind(S.renderer);
      S.renderer.render = (...args) => {
        if (!window.__firstWorld) { const nodes = []; S.scene.traverse(o => { if (o.isMesh || o.isLineSegments) nodes.push([o.uuid, o.instanceMatrix ? o.instanceMatrix.count : 0]); });
          window.__firstWorld = { nodes, done: S.worldgen.state.done, built: [S.terrain.restBuilt, S.look.state.built, S.roads.state.built, S.ocean.state.built, S.cover.state.built],
            landmarks: Object.keys(S.landmarks.info).filter(k => k.startsWith('LM')).length, probe: S.quality.state.probe.length }; }
        return render(...args); }; } });
  });
  // TERRAIN_HOLE_REPAIR_PLAN 4.2: a geometry is valid before any ray or overlap test reads it (an index past the position count read as NaN and its triangle was
  // skipped unseen: 39 terrain meshes up to 2026-10-20); U2, U3-town and U5 fail on an invalid mesh instead of passing over it
  await page.addInitScript(() => { window.__geomIssues = g => { const out = [], pos = g && g.attributes && g.attributes.position; if (!pos) return ['no position'];
    for (const [k, a] of Object.entries(g.attributes)) { if (!k) out.push('empty attribute key'); else if (a.count !== pos.count && !a.isInstancedBufferAttribute) out.push(`${k} count ${a.count} != ${pos.count}`); }
    let bad = 0; for (let i = 0; i < pos.count; i++) if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) bad++; if (bad) out.push(`${bad} non-finite positions`);
    if (g.index) { let wrong = 0; for (let i = 0; i < g.index.count; i++) { const v = g.index.getX(i); if (!(Number.isInteger(v) && v >= 0 && v < pos.count)) wrong++; } if (wrong) out.push(`${wrong} indices outside [0, ${pos.count})`); }
    return out; }; });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?quality=auto');
  await page.waitForFunction(() => window.__firstWorld, null, { timeout: 120000 });
  const first = await page.evaluate(() => window.__firstWorld);
  check('U3-first', first.done && first.built.every(Boolean) && first.landmarks === 10 && first.probe === 0,
    `首帧前启动管线完成 ${first.done}、模块已建 ${first.built.join('/')}、地标 ${first.landmarks}、auto 已采帧 ${first.probe}；网格与线 ${first.nodes.length}`);
  // ---- U2 (W10c): cast against the actual visible, static mesh triangles. Road rows are 0.5 m apart; each row has nine points across its paved width.
  const u2 = await page.evaluate(() => {
    const S = window.__scene, T = window.THREE, B = S.bend, W = window.WORLD, D = S.roads.data(), roadSet = new Set(), surfaceSet = new Set(), probes = [], exitCounts = {};
    const ringJunctions = D.junctions.filter(j => j.kind === 'CR01');
    // the CR01 paving round the whole ring (one quad per swept row cell, roads.js mergeCr01): a branch's row there was cut out of its strip
    const pavingCells = new Map(); D.cr01.paving.forEach((q, id) => { for (let a = Math.floor(Math.min(...q.map(v => v[0]))); a <= Math.floor(Math.max(...q.map(v => v[0]))); a++) for (let b = Math.floor(Math.min(...q.map(v => v[1]))); b <= Math.floor(Math.max(...q.map(v => v[1]))); b++) { const k = `${a},${b}`; if (!pavingCells.has(k)) pavingCells.set(k, []); pavingCells.get(k).push(id); } });
    const inPoly = (p, poly) => { let sign = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); if (Math.abs(c) < 1e-5) continue; if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); } return true; };
    S.roads.state.root.traverse(o => { if (o.isMesh && !o.isInstancedMesh) { roadSet.add(o); if (o.name.startsWith('road:route ') || /^road:bridge .* top$/.test(o.name) || o.name === 'road:junction paving') surfaceSet.add(o); } });
    const atO = (strip, grid, i, o) => {
      let j = 0; while (j + 2 < grid.length && grid[j + 1] < o) j++;
      const a = (i * grid.length + j) * 3, b = a + 3, t = Math.max(0, Math.min(1, (o - grid[j]) / (grid[j + 1] - grid[j]))), p = strip.pos;
      return [0, 1, 2].map(k => p[a + k] + (p[b + k] - p[a + k]) * t);
    };
    const addRow = (rt, i, tag = null) => {
      const [a, b] = rt.paved[i]; for (let k = 0; k <= 8; k++) { const o = a + 0.02 + (b - a - 0.04) * k / 8, p = atO(rt.strip, rt.grid, i, o);
        if (rt.def.id !== 'CR01' && (pavingCells.get(`${Math.floor(p[0])},${Math.floor(p[2])}`) || []).some(id => inPoly([p[0], p[2]], D.cr01.paving[id]))) continue;
        probes.push({ p, tag, route: rt.def.id }); if (tag) exitCounts[tag] = (exitCounts[tag] || 0) + 1; }
    };
    for (const rt of D.routes) for (let i = 0; i < rt.samples.length; i++) if (rt.samples[i].span !== 'tunnel' && rt.samples[i].span !== 'bridge') addRow(rt, i);
    // A bridge deck is a road surface too; test its full 10 m deck, including the shoulder and kerbs.
    for (const br of D.bridges) { const st = br.strips[0], grid = br.topCols; for (let i = 0; i < br.samples.length; i++) for (let k = 0; k <= 8; k++) probes.push({ p: atO(st, grid, i, grid[0] + 0.02 + (grid[grid.length - 1] - grid[0] - 0.04) * k / 8), tag: null, route: br.def?.id || br.id }); }
    // Nine named exit checks, from each frozen town boundary node out along its approved 6 m connector.
    const L = window.LAYOUT, nodeById = Object.fromEntries(L.roadNodes.map(n => [n.id, n])), townExits = ['N01', 'N03', 'N04', 'N08', 'N09', 'N10', 'N11', 'N12', 'N13'];
    for (const id of townExits) {
      const e = W.roadNetwork.edges.find(q => q.from === id && /^C01-/.test(q.to) || q.to === id && /^C01-/.test(q.from));
      if (!e) { exitCounts[id] = -1; continue; }
      const other = e.from === id ? e.to : e.from, n0 = nodeById[id], end = W.lonLatToTown(W.roadNetwork.nodeById[other].lon, W.roadNetwork.nodeById[other].lat), dx = end.x - n0.x, dz = end.z - n0.z, len = Math.hypot(dx, dz), rt = D.routes.find(q => q.def.segs.some(s => s.id === e.id));
      if (!rt) { exitCounts[id] = -1; continue; }
      exitCounts[id] = 0;
      for (let i = 0; i < rt.samples.length; i++) { const p = rt.flatOf[i], s = ((p.x - n0.x) * dx + (p.z - n0.z) * dz) / len, side = Math.abs((p.x - n0.x) * dz - (p.z - n0.z) * dx) / len;
        if (s >= -0.02 && s <= 6.02 && side <= 0.02) addRow(rt, i, id);
      }
    }
    // The continuous CR01 asphalt receives independent area probes at every junction.
    const crJunctions = ringJunctions, signed = poly => poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0),
      inside = (p, poly) => { const sign = signed(poly) >= 0 ? 1 : -1; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if (((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * sign < -1e-5) return false; } return true; },
      toLonLat = (x, z) => ({ lon: x / (90 * Math.PI / 180), lat: Math.atan(Math.sinh(-z / 90)) / (Math.PI / 180) });
    for (const j of crJunctions) {
      const nd = W.roadNetwork.nodeById[j.node], nx = 90 * nd.lon * Math.PI / 180, nz = -90 * Math.asinh(Math.tan(nd.lat * Math.PI / 180)), close = q => Math.hypot(q.reduce((s, v) => s + v[0], 0) / q.length - nx, q.reduce((s, v) => s + v[1], 0) / q.length - nz) <= 12;
      const areas = [...D.cr01.paving.filter(close), ...D.cr01.branchPaving.map(q => q.poly).filter(close)], seen = new Set();      // the ring's paving and the branches' own within 12 m of the node
      for (const poly of areas) {
        const minX = Math.min(...poly.map(p => p[0])), maxX = Math.max(...poly.map(p => p[0])), minZ = Math.min(...poly.map(p => p[1])), maxZ = Math.max(...poly.map(p => p[1]));
        for (let x = Math.ceil(minX * 2) / 2; x <= maxX + 1e-8; x += 0.5) for (let z = Math.ceil(minZ * 2) / 2; z <= maxZ + 1e-8; z += 0.5) if (inside([x, z], poly)) {
          const key = `${x},${z}`; if (seen.has(key)) continue; seen.add(key);
          const ll = toLonLat(x, z), k = 1 / Math.cos(ll.lat * Math.PI / 180), h = W.height(ll.lon, ll.lat) + 0.045; probes.push({ p: [x, (h - 1.6) * k, z], tag: null, route: `junction ${j.node}`, junction: j.node });
        }
      }
    }
    S.scene.updateMatrixWorld(true);
    const visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }, identity = new T.Matrix4(), interest = new Set(), key = (x, z) => `${Math.floor(x)},${Math.floor(z)}`, wrap = p => [B.wrapX(p[0]), p[1], p[2]];
    for (const q of probes) { q.p = wrap(q.p); interest.add(key(q.p[0], q.p[2])); }
    const cells = new Map(), sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const rayHit = (o, d, A, C, E) => { const e1 = sub(C, A), e2 = sub(E, A), p = cross(d, e2), det = dot(e1, p); if (Math.abs(det) < 1e-13) return null; const inv = 1 / det, s = sub(o, A), u = dot(s, p) * inv; if (u < -1e-7 || u > 1 + 1e-7) return null; const q = cross(s, e1), v = dot(d, q) * inv; if (v < -1e-7 || u + v > 1 + 1e-7) return null; const t = dot(e2, q) * inv; return t > 0 ? t : null; };
    const idMatrix = new T.Matrix4(), worldVertex = new T.Vector3(), invalid = []; let triangles = 0;
    S.scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes?.position || !visible(o)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material]; if (mats.some(m => !m || (m.transparent && m.opacity <= 0) || m.blending === T.AdditiveBlending)) return;
      o.updateMatrixWorld(true); const transformed = !o.matrixWorld.equals(idMatrix);
      const g = o.geometry, pos = g.attributes.position, ix = g.index, count = ix ? ix.count : pos.count, road = roadSet.has(o), surface = surfaceSet.has(o), name = o.name || o.parent?.name || o.type;
      const why = window.__geomIssues(g); if (why.length) { invalid.push(`${name}: ${why.join(', ')}`); return; }
      for (let t = 0; t + 2 < count; t += 3) {
        const v = [0, 1, 2].map(k => { const n = ix ? ix.getX(t + k) : t + k; if (transformed) { worldVertex.set(pos.getX(n), pos.getY(n), pos.getZ(n)).applyMatrix4(o.matrixWorld); return [B.wrapX(worldVertex.x), worldVertex.y, worldVertex.z]; } return [B.wrapX(pos.getX(n)), pos.getY(n), pos.getZ(n)]; }), x0 = Math.floor(Math.min(v[0][0], v[1][0], v[2][0])), x1 = Math.floor(Math.max(v[0][0], v[1][0], v[2][0])), z0 = Math.floor(Math.min(v[0][2], v[1][2], v[2][2])), z1 = Math.floor(Math.max(v[0][2], v[1][2], v[2][2]));
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 2500) continue;
        const tri = { v, road, surface, name };
        for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = `${x},${z}`; if (!interest.has(k)) continue; let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(tri); triangles++; }
      }
    });
    const tally = { rays: 0, occluded: 0, missed: 0, examples: [], exits: exitCounts, triangles, invalid, junctionProbes: Object.fromEntries(crJunctions.map(j => [j.node, 0])) };
    for (const state of ['flat', 'sphere']) {
      const u = state === 'sphere' ? 1 : 0, count = { rays: 0, occluded: 0, missed: 0, raised: 0, raisedBy: {}, examples: [], blockers: {}, misses: [], junctionProbes: Object.fromEntries(crJunctions.map(j => [j.node, 0])) };
      const bend = p => { const q = wrap(p); return u ? B.point(q[0], q[1], q[2], 1) : q; };
      const baryXZ = (p, v) => {
        const [a, b, c] = v, den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
        if (Math.abs(den) < 1e-12) return null;
        const x = ((b[2] - c[2]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[2] - c[2])) / den,
          y = ((c[2] - a[2]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[2] - c[2])) / den, z = 1 - x - y;
        // The seam split keeps a 0.2 mm west copy; float32 row coordinates can therefore sit
        // up to 0.5 mm beyond that exact edge. Accept only this sub-millimetre numeric sliver,
        // then project the barycentrics back onto the rendered triangle before casting.
        if (Math.min(x, y, z) < -1e-3) return null;
        const w = [Math.max(0, x), Math.max(0, y), Math.max(0, z)], sum = w[0] + w[1] + w[2];
        return w.map(v => v / sum);
      };
      for (const q of probes) {
        if (q.junction) count.junctionProbes[q.junction]++;
        const p = q.p, nearby = cells.get(key(p[0], p[2])) || []; let roadSurface = null;
        // First locate the sampled point on the actual flat road triangles. On a sphere the
        // shader bends triangle vertices, so bending the ideal point separately can put the
        // test ray a fraction of a millimetre above the rendered chord and report a false gap.
        for (const tri of nearby) if (tri.surface) {
          const w = baryXZ(p, tri.v); if (!w) continue;
          const y = w[0] * tri.v[0][1] + w[1] * tri.v[1][1] + w[2] * tri.v[2][1];
          if (!roadSurface || y > roadSurface.y) roadSurface = { tri, w, y };
        }
        const flatTarget = roadSurface && [0, 1, 2].map(k => roadSurface.w.reduce((s, w, i) => s + w * roadSurface.tri.v[i][k], 0));
        const A = roadSurface && bend([flatTarget[0], flatTarget[1] + 80, flatTarget[2]]),
          Z = roadSurface && (u ? roadSurface.w.reduce((sum, w, i) => { const v = bend(roadSurface.tri.v[i]); return sum.map((x, k) => x + w * v[k]); }, [0, 0, 0]) : flatTarget);
        let best = null;
        if (roadSurface) {
          const delta = sub(Z, A), len = Math.hypot(...delta), dir = delta.map(v => v / len);
          for (const tri of nearby) { const v = tri.v.map(bend), d = rayHit(A, dir, ...v); if (d !== null && (!best || d < best.d - 1e-4 || (Math.abs(d - best.d) <= 1e-4 && tri.road && !best.road))) best = { d, road: tri.road, name: tri.name }; }
        }
        count.rays++; if (!q.junction && roadSurface && roadSurface.y > p[1] + 0.06) { count.raised++; const by = count.raisedBy[q.route] || (count.raisedBy[q.route] = { n: 0, at: [] }); by.n++; if (by.at.length < 3) by.at.push(`${p[0].toFixed(2)},${p[2].toFixed(2)} +${(roadSurface.y - p[1]).toFixed(2)} ${roadSurface.tri.name}`); if (count.examples.length < 8) count.examples.push(`${q.tag || q.route} (${p[0].toFixed(3)},${p[2].toFixed(3)}) 被其他道路抬高 ${(roadSurface.y - p[1]).toFixed(3)} m`); }
        if (!best) { count.missed++; if (count.misses.length < 8) count.misses.push(`${q.tag || q.route} (${p[0].toFixed(3)},${p[2].toFixed(3)}) 附近 ${[...new Set(nearby.map(t => t.name))].slice(0, 8).join('|')}`); if (count.examples.length < 8) count.examples.push(`${q.tag || q.route} (${p[0].toFixed(3)},${p[2].toFixed(3)}) 无命中`); }
        else if (!best.road) { count.occluded++; const who = count.blockers[best.name] || (count.blockers[best.name] = { n: 0, at: [] }); who.n++; if (who.at.length < 5) who.at.push(`${q.tag || q.route} (${p[0].toFixed(3)},${p[2].toFixed(3)})`); if (count.examples.length < 8) count.examples.push(`${q.tag || q.route} (${p[0].toFixed(3)},${p[2].toFixed(3)}) 被 ${best.name} 遮挡`); }
      }
      tally[state] = count;
    }
    tally.junctionProbes = tally.flat.junctionProbes;
    return tally;
  });
  const junctionProbeOK = Object.keys(u2.junctionProbes).length === 10 && Object.values(u2.junctionProbes).every(n => n > 0) && ['flat', 'sphere'].every(s => Object.keys(u2[s].junctionProbes).length === 10 && Object.values(u2[s].junctionProbes).every(n => n > 0));
  const u2ok = !u2.invalid.length && ['flat', 'sphere'].every(s => u2[s].rays > 0 && u2[s].occluded === 0 && u2[s].missed === 0 && u2[s].raised === 0) && Object.keys(u2.exits).length === 9 && Object.values(u2.exits).every(n => n > 0) && junctionProbeOK;
  check('U2', u2ok, `实际路网可见三角面竖直射线，铺装每 0.5 m 一行、每行 9 点，CR01 十个路口的连续沥青带和接入口另加 0.5 m 网格；平面 ${u2.flat.rays} 点（遮挡 ${u2.flat.occluded}、无命中 ${u2.flat.missed}、其他道路抬高 ${u2.flat.raised}），球形 ${u2.sphere.rays} 点（遮挡 ${u2.sphere.occluded}、无命中 ${u2.sphere.missed}、其他道路抬高 ${u2.sphere.raised}）；路口采样 ${Object.entries(u2.junctionProbes).map(([k, n]) => `${k} ${n}`).join('、')}；九出口 0–6 m 探针 ${Object.entries(u2.exits).map(([k, n]) => `${k} ${n}`).join('、')}；参与相交三角形 ${u2.triangles}、非法网格 ${u2.invalid.length}${u2.invalid.length ? `（${u2.invalid.slice(0, 4).join('；')}）` : ''}${!u2ok ? `；遮挡物 ${JSON.stringify({ flat: u2.flat.blockers, sphere: u2.sphere.blockers })}；抬高分布 ${JSON.stringify(u2.flat.raisedBy)}；无命中例 ${JSON.stringify({ flat: u2.flat.misses, sphere: u2.sphere.misses })}；例：${[...u2.flat.examples, ...u2.sphere.examples].slice(0, 8).join('；')}` : ''}`);
  // 30 s after the first frame, the camera cycling through the three states once a second
  const STATES = [{ mapMode: 'flat', target: [-7, 1.2, 20], dist: 34 }, { mapMode: 'flat', target: [-90, 1.2, 60], dist: 30 }, { mapMode: 'sphere', dist: 140 }];
  const rows = [], start = Date.now();
  for (let i = 0; Date.now() - start < 30000; i++) {
    rows.push(await page.evaluate(v => { const S = window.__scene; S.view.set(v); S.transition.step(3);
      const nodes = []; S.scene.traverse(o => { if (o.isMesh || o.isLineSegments) nodes.push([o.uuid, o.instanceMatrix ? o.instanceMatrix.count : 0]); });
      const roots = [S.terrain.root, S.look.state.root, S.look.state.globalInkGroup, S.roads.state.root, S.ocean.state.root, S.cover.state.root, ...Object.values(S.landmarks.info).flatMap(q => (q && q.groups) || [])];
      return { mode: v.mapMode, nodes, visible: roots.every(g => g && g.visible), terrain: S.terrain.ring.concat(S.terrain.rest).every(m => m.visible) }; }, STATES[i % 3]));
    await page.waitForTimeout(1000);
  }
  const same = r => JSON.stringify(r.nodes) === JSON.stringify(first.nodes);
  check('U3-stable', rows.every(same), `首帧后 ${Math.round((Date.now() - start) / 1000)} s、${rows.length} 次采样（城镇 / 平面远处 / 球形轮换）：网格与实例容量${rows.every(same) ? '不变' : '有变化：' + rows.filter(r => !same(r)).map(r => r.mode + ' ' + r.nodes.length).join('、')}`);
  check('U3-display', rows.every(r => r.visible && r.terrain), `三种状态下模块根、全景墨线组、地标组与地形分块都可见${rows.every(r => r.visible && r.terrain) ? '' : '（有隐藏：' + rows.filter(r => !(r.visible && r.terrain)).map(r => r.mode).join('、') + '）'}`);
  // U3-town: terrain, landcover and landmarks must not cover the town streets; the road module owns its own markings and roadside details.
  // On every town carriageway (layout.js roads, every 0.5 m, 9 points across; alleys on a 0.5 m grid) a vertical ray must meet a town surface first, and no
  // world ground layer with a polygon offset may lie within 5 cm below it (an offset lets a layer that is under the street win when it is seen obliquely).
  const town = await page.evaluate(() => {
    const S = window.__scene, T = window.THREE, L = window.LAYOUT, world = new Set();
    for (const r of [S.look.state.root, S.cover.state.root, S.ocean.state.root, ...S.terrain.ring, ...S.terrain.rest, ...Object.values(S.landmarks.info).flatMap(q => (q && q.groups) || [])]) r.traverse(o => world.add(o));
    const patch = new T.Box3(new T.Vector3(-50, -5, -50), new T.Vector3(50, 5, 50)), box = new T.Box3(), CELL = 1, cells = new Map(), broad = [], cellKey = (x, z) => `${x},${z}`, invalid = [];
    const visible = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; }, addTriangle = tri => {
      const x0 = Math.max(-50, Math.floor(Math.min(...tri.v.map(p => p[0])))), x1 = Math.min(50, Math.floor(Math.max(...tri.v.map(p => p[0])))), z0 = Math.max(-50, Math.floor(Math.min(...tri.v.map(p => p[2])))), z1 = Math.min(50, Math.floor(Math.max(...tri.v.map(p => p[2]))));
      if (x0 > x1 || z0 > z1) return; const count = (x1 - x0 + 1) * (z1 - z0 + 1); if (count > 2500) { broad.push(tri); return; }
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = cellKey(x, z); let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(tri); }
    };
    S.scene.updateMatrixWorld(true);
    S.scene.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || !visible(o) || !o.geometry?.attributes?.position) return;
      const g = o.geometry, pos = g.attributes.position; if (!g.boundingBox) g.computeBoundingBox(); if (!box.copy(g.boundingBox).applyMatrix4(o.matrixWorld).intersectsBox(patch)) return;
      const why = window.__geomIssues(g); if (why.length) { invalid.push(`${o.name || o.parent?.name || o.type}: ${why.join(', ')}`); return; }
      const ix = g.index, total = ix ? ix.count : pos.count, start = Math.max(0, g.drawRange.start || 0), end = Math.min(total, start + (Number.isFinite(g.drawRange.count) ? g.drawRange.count : total)), e = o.matrixWorld.elements;
      for (let t = start - start % 3; t + 2 < end; t += 3) {
        const material = Array.isArray(o.material) ? (g.groups.find(q => t >= q.start && t + 2 < q.start + q.count) ? o.material[g.groups.find(q => t >= q.start && t + 2 < q.start + q.count).materialIndex] : null) : o.material;
        if (!material) continue; const v = [];
        for (let k = 0; k < 3; k++) { const n = ix ? ix.getX(t + k) : t + k, x = pos.getX(n), y = pos.getY(n), z = pos.getZ(n); v.push([e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]); }
        const ab = [v[1][0] - v[0][0], v[1][2] - v[0][2]], ac = [v[2][0] - v[0][0], v[2][2] - v[0][2]], area = ab[0] * ac[1] - ab[1] * ac[0], normalY = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]);
        if (Math.abs(area) < 1e-12 || material.side === T.FrontSide && normalY <= 0 || material.side === T.BackSide && normalY >= 0) continue;
        addTriangle({ v, object: o });
      }
    });
    const pts = [];
    for (const e of L.roads) { const w = L.ROAD_TYPES[e.type].carriageway; for (let i = 0; i + 1 < e.nodes.length; i++) { const a = L.roadNodes.find(n => n.id === e.nodes[i]), b = L.roadNodes.find(n => n.id === e.nodes[i + 1]), len = Math.hypot(b.x - a.x, b.z - a.z), d = [(b.x - a.x) / len, (b.z - a.z) / len];
      for (let s = 0; s <= len; s += 0.5) for (let k = -4; k <= 4; k++) { const o = k / 4 * (w / 2 - 0.25); pts.push([a.x + d[0] * s - d[1] * o, a.z + d[1] * s + d[0] * o]); } } }
    for (const a of L.alleys) for (let x = a.rect[0] + 0.25; x < a.rect[2]; x += 0.5) for (let z = a.rect[1] + 0.25; z < a.rect[3]; z += 0.5) pts.push([x, z]);
    const name = o => { let n = o.name; for (let q = o.parent; !n && q; q = q.parent) n = q.name; return n || o.type; };
    const bad = {}; let n = 0, nBad = 0;
    for (const [x, z] of pts) { if (Math.abs(x) > 47.75 || Math.abs(z) > 47.75) continue; n++;
      const hits = [], candidates = [...(cells.get(cellKey(Math.floor(x), Math.floor(z))) || []), ...broad];
      for (const tri of candidates) { const [a, b, c] = tri.v, den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-12) continue;
        const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den, v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den, w = 1 - u - v;
        if (u < -1e-8 || v < -1e-8 || w < -1e-8) continue; const y = u * a[1] + v * b[1] + w * c[1]; if (y <= 30 + 1e-8) hits.push({ object: tri.object, y }); }
      hits.sort((a, b) => b.y - a.y); if (!hits.length) continue;
      const top = hits[0], wrong = world.has(top.object) ? [top] : hits.slice(1).filter(h => world.has(h.object) && top.y - h.y < 0.05 && (Array.isArray(h.object.material) ? h.object.material : [h.object.material]).some(m => m.polygonOffset));
      if (wrong.length) { nBad++; for (const h of wrong) { const k = name(h.object); (bad[k] = bad[k] || { n: 0, at: [] }).n++; if (bad[k].at.length < 3) bad[k].at.push(`(${x.toFixed(1)}, ${z.toFixed(1)})`); } } }
    return { n, nBad, bad, invalid };
  });
  check('U3-town', town.nBad === 0 && !town.invalid.length, `城镇车行道与巷道 ${town.n} 点，被世界图层盖住或下方 5 cm 内埋着带偏移的世界地面层 ${town.nBad} 点；非法网格 ${town.invalid.length}${town.invalid.length ? `（${town.invalid.slice(0, 4).join('；')}）` : ''}${town.nBad ? '：' + Object.entries(town.bad).map(([k, v]) => `${k} ${v.n}（${v.at.join('、')}）`).join('；') : ''}`);
  const u5 = await page.evaluate(() => {
    const S = window.__scene, T = window.THREE, CELL = 2, key = (x, z) => `${x},${z}`, cells = new Map(), occupancy = [], terrain = S.terrain.ring.concat(S.terrain.rest), visible = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    S.scene.updateMatrixWorld(true);
    const add = tri => { const b = [Math.min(...tri.map(p => p[0])), Math.max(...tri.map(p => p[0])), Math.min(...tri.map(p => p[1])), Math.max(...tri.map(p => p[1]))], id = occupancy.length; occupancy.push({ tri, b });
      for (let x = Math.floor(b[0] / CELL); x <= Math.floor(b[1] / CELL); x++) for (let z = Math.floor(b[2] / CELL); z <= Math.floor(b[3] / CELL); z++) { const k = key(x, z); let a = cells.get(k); if (!a) cells.set(k, a = []); a.push(id); } };
    const invalid = []; for (const m of terrain) { const why = window.__geomIssues(m.geometry); if (why.length) invalid.push(`terrain ${m.userData.terrain?.kind} ${m.userData.terrain?.cx},${m.userData.terrain?.cy}: ${why.join(', ')}`); }
    S.scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !visible(o) || !o.userData.groundOccupancy || !o.geometry?.attributes?.position) return; const g = o.geometry, p = g.attributes.position, ix = g.index, e = o.matrixWorld.elements, n = ix ? ix.count : p.count;
      { const why = window.__geomIssues(g); if (why.length) { invalid.push(`${o.name || o.parent?.name}: ${why.join(', ')}`); return; } }
      for (let t = 0; t + 2 < n; t += 3) { const v = [0,1,2].map(k => { const i = ix ? ix.getX(t+k) : t+k, x=p.getX(i), y=p.getY(i), z=p.getZ(i); return [e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]]; });
        const ny=(v[1][2]-v[0][2])*(v[2][0]-v[0][0])-(v[1][0]-v[0][0])*(v[2][2]-v[0][2]); if (ny>1e-10) add(v.map(q=>[q[0],q[2]])); }
    });
    const area = p => Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0)/2), clip = (subject, edgeA, edgeB, sign) => { const out=[], val=p=>((edgeB[0]-edgeA[0])*(p[1]-edgeA[1])-(edgeB[1]-edgeA[1])*(p[0]-edgeA[0]))*sign; let a=subject.at(-1), da=val(a); for (const b of subject) { const db=val(b); if ((da<0)!==(db<0)) { const t=da/(da-db); out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]); } if (db>=-1e-10) out.push(b); a=b; da=db; } return out; };
    // a positive overlap thinner than 0.1 mm is Float32 rounding of the cut's new vertices along a shared edge (|x| ~ 200 m: ~1.5e-5 m), not ground under the occupancy;
    // counted apart (TERRAIN_HOLE_REPAIR_PLAN: before 2026-10-21 these terrain triangles were invalid and dropped out of this test unseen)
    let terrainTriangles=0, tested=0, overlapPairs=0, overlapArea=0, floatSlivers=0, sliverWidth=0;
    for (const m of terrain) { const g=m.geometry,p=g.attributes.position,ix=g.index,n=ix?ix.count:p.count; if (window.__geomIssues(g).length) continue; for (let t=0;t+2<n;t+=3) { const tri=[0,1,2].map(k=>{const i=ix?ix.getX(t+k):t+k;return[p.getX(i),p.getZ(i)];}), box=[Math.min(...tri.map(q=>q[0])),Math.max(...tri.map(q=>q[0])),Math.min(...tri.map(q=>q[1])),Math.max(...tri.map(q=>q[1]))], ids=new Set(); terrainTriangles++;
        for(let x=Math.floor(box[0]/CELL);x<=Math.floor(box[1]/CELL);x++)for(let z=Math.floor(box[2]/CELL);z<=Math.floor(box[3]/CELL);z++)for(const id of cells.get(key(x,z))||[])ids.add(id);
        for(const id of ids){const o=occupancy[id],b=o.b;if(b[1]<=box[0]+1e-7||b[0]>=box[1]-1e-7||b[3]<=box[2]+1e-7||b[2]>=box[3]-1e-7)continue;tested++;let q=tri, sign=((o.tri[1][0]-o.tri[0][0])*(o.tri[2][1]-o.tri[0][1])-(o.tri[1][1]-o.tri[0][1])*(o.tri[2][0]-o.tri[0][0]))>=0?1:-1;for(let e=0;e<3&&q.length>=3;e++)q=clip(q,o.tri[e],o.tri[(e+1)%3],sign);const a=q.length>=3?area(q):0;if(a>1e-6){let le=0;for(let i=0;i<q.length;i++){const u=q[i],w=q[(i+1)%q.length];le=Math.max(le,Math.hypot(u[0]-w[0],u[1]-w[1]));}const wd=2*a/le;if(wd>1e-4){overlapPairs++;overlapArea+=a;}else{floatSlivers++;sliverWidth=Math.max(sliverWidth,wd);}} }
      } }
    let boundaryWalls=0, outletMeshes=0;
    S.scene.traverse(o=>{ if (!o.isMesh || !visible(o) || !o.geometry?.attributes?.position) return; if (/outlet/i.test(o.name||'')) outletMeshes++; const g=o.geometry,p=g.attributes.position,ix=g.index,n=ix?ix.count:p.count,e=o.matrixWorld.elements;
      for(let t=0;t+2<n;t+=3){const v=[0,1,2].map(k=>{const i=ix?ix.getX(t+k):t+k,x=p.getX(i),y=p.getY(i),z=p.getZ(i);return[e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]];});const y=v.map(q=>q[1]),x=v.map(q=>q[0]),z=v.map(q=>q[2]),vertical=area(v.map(q=>[q[0],q[2]]))<1e-8,boundary=v.every(q=>Math.min(Math.abs(Math.abs(q[0])-48),Math.abs(Math.abs(q[2])-48))<0.05);if(vertical&&boundary&&Math.max(...y)-Math.min(...y)>0.2&&Math.min(...y)<0)boundaryWalls++; }
    });
    const cover=S.cover.stats(), patch=window.WORLD.TOWN_PATCH, W=window.WORLD; let heightEdgeError=0;
    for(let i=0;i<=100;i++){const t=i/100, lat=patch.latMin+(patch.latMax-patch.latMin)*t, lon=patch.lonMin+(patch.lonMax-patch.lonMin)*t; for(const q of [[patch.lonMin,lat],[patch.lonMax,lat],[lon,patch.latMin],[lon,patch.latMax]]) heightEdgeError=Math.max(heightEdgeError,Math.abs(W.height(q[0],q[1])-1.6));}
    return { invalid, occupancyTriangles:occupancy.length, terrainTriangles, tested, overlapPairs, overlapArea, floatSlivers, sliverWidth, boundaryWalls, outletMeshes, outletData:window.LAYOUT.outlets.length, taggedMeshes:S.terrain.stats.occupancyCut?.meshesTagged||0, clippedMeshes:S.terrain.stats.occupancyCut?.meshes||0, culled:cover.instanceOccupancyCulled||{}, before:cover.instancesBeforeOccupancy||0, after:cover.items||0, heightEdgeError, townPatch:[patch.lonMin,patch.lonMax,patch.latMin,patch.latMax] };
  });
  const u5ok = !u5.invalid.length && u5.occupancyTriangles > 0 && u5.taggedMeshes > 0 && u5.overlapPairs === 0 && u5.overlapArea < 1e-5 && u5.clippedMeshes > 0 && u5.heightEdgeError <= 0.01 && u5.boundaryWalls === 0 && u5.outletMeshes === 0 && u5.after <= u5.before;
  check('U5', u5ok, `非法网格 ${u5.invalid.length}${u5.invalid.length ? `（${u5.invalid.slice(0, 4).join('；')}）` : ''}；占地上方网格 ${u5.occupancyTriangles} 个投影三角面；对 ${u5.terrainTriangles} 个地形三角面精确相交检查 ${u5.tested} 对，正面积残留 ${u5.overlapPairs} 对 / ${u5.overlapArea.toExponential(2)} m²（宽 < 0.1 mm 的 Float32 细缝 ${u5.floatSlivers} 对不计，最宽 ${(u5.sliverWidth * 1e3).toFixed(4)} mm）；边界高于 0.2 m 的底座竖面 ${u5.boundaryWalls}，外围出口模型 ${u5.outletMeshes}（layout.js 数据仍为 ${u5.outletData} 条）；平原边界高差 ${u5.heightEdgeError.toFixed(4)} m；实例 ${u5.before} → ${u5.after}，占地筛除 ${JSON.stringify(u5.culled)}`);
  check('U3-errors', !errors.length, errors.join('；') || '无页面错误');
} finally { await browser.close(); }
}
// ---- U6 / U7 (W10f, W10_SPEC 2.5, 2.8): one geometry for the flat map and the sphere, one ground sampler for the camera and the walk
//   U6-same   the scene graph (every mesh, line set, point set and sprite: object, geometry, vertex and index counts, instance capacity) is identical in the flat map,
//             on the sphere and back on the flat map (the instances drawn this frame follow the camera's pixel rule, D14, not the map mode)
//   U6-edges  every non-instanced mesh and line set that bends (rain and snow aside) has no horizontal edge (world frame) over 4 m on a triangle or segment whose box
//             overlaps the town frame |x|, |z| <= 48 (the same rule bend.js subdivide() cuts by)
//   U7        R1 (THIRD_PERSON_ROAM_PLAN 6.13.4): the ride replaces the walk; the same paths (the 20 random pieces outside the town, tools/ride_routes.mjs random20,
//             seed 20261018; the W9a town corridors and RT-01/RT-02 town legs) ridden with window.__scene.ride.step: the wheel contacts on the rendered walk surfaces and the
//             camera's nominal height (ground + 1.62 m) on straight level settled stretches, both within 0.01 m (true metres: flat units / s); every ride reaches its end
//   U7-exits  the nine exits, the RN01 tunnel and the seam of the flat map (RN01-13): ridden along their roads, the same checks, the seam crossed once
if (!process.argv.includes('--no-browser') && (want('U6') || want('U7'))) {
  const require = createRequire(import.meta.url);
  globalThis.LAYOUT = globalThis.LAYOUT || require(path.join(root, 'layout.js'));
  const L = globalThis.LAYOUT, W = require(path.join(root, 'world.js')), RR = await import(pathToFileURL(path.join(root, 'tools/ride_routes.mjs')).href);
  const f = (v, n = 3) => (+v).toFixed(n);
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?quality=high');
    await page.waitForFunction(() => window.__scene && window.__scene.ground, null, { timeout: 120000 });
    if (want('U6')) {
      const snap = () => page.evaluate(() => { const S = window.__scene, a = []; S.scene.traverse(o => { if (o.isMesh || o.isLine || o.isPoints || o.isSprite) { const g = o.geometry, p = g && g.attributes.position; a.push([o.uuid, g ? g.uuid : '', p ? p.count : 0, g && g.index ? g.index.count : 0, o.isInstancedMesh ? o.instanceMatrix.count : -1]); } }); return a; });
      const setMode = m => page.evaluate(m => { const S = window.__scene; S.view.set({ mode: 'free', mapMode: m, target: [0, 1.2, 0], dist: m === 'sphere' ? 140 : 60 }); S.transition.step(3); }, m);
      await setMode('flat'); await page.waitForTimeout(1500); const flat = await snap();
      await setMode('sphere'); await page.waitForTimeout(1500); const sphere = await snap();
      const edges = await page.evaluate(() => {
        const S = window.__scene, B = 48, M2 = 16 + 1e-6; let objects = 0, prims = 0, long = 0, worst = 0; const bad = {};
        S.scene.updateMatrixWorld(true);
        S.scene.traverse(o => {
          if (!(o.isMesh || o.isLineSegments) || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position) return;
          const m = o.material; if (m && m.userData && (m.userData.noBend || m.userData.noWrap)) return;
          const g = o.geometry, p = g.attributes.position, ix = g.index, n = Math.min(ix ? ix.count : p.count, g.drawRange.start + g.drawRange.count), e = o.matrixWorld.elements, per = o.isLineSegments ? 2 : 3;
          let touched = false;
          for (let t = 0; t + per <= n; t += per) {
            const v = []; for (let k = 0; k < per; k++) { const i = ix ? ix.getX(t + k) : t + k, x = p.getX(i), y = p.getY(i), z = p.getZ(i); v.push([e[0] * x + e[4] * y + e[8] * z + e[12], e[2] * x + e[6] * y + e[10] * z + e[14]]); }
            if (Math.max(...v.map(q => q[0])) < -B || Math.min(...v.map(q => q[0])) > B || Math.max(...v.map(q => q[1])) < -B || Math.min(...v.map(q => q[1])) > B) continue;
            touched = true; prims++;
            for (let k = 0; k < per; k++) { const a = v[k], b = v[(k + 1) % per], d2 = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; if (d2 > worst) worst = d2; if (d2 > M2) { long++; let top = o; while (top.parent && top.parent !== S.scene) top = top.parent; const key = top.name || o.name || o.type; bad[key] = (bad[key] || 0) + 1; break; } }
          }
          if (touched) objects++;
        });
        return { objects, prims, long, worst: Math.sqrt(worst), bad, stats: S.town.geometry };
      });
      await setMode('flat'); await page.waitForTimeout(1500); const back = await snap();
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      check('U6-same', flat.length > 0 && same(flat, sphere) && same(flat, back), `平面 ${flat.length}、球形 ${sphere.length}、回到平面 ${back.length} 个绘制对象；对象、几何、顶点/索引数与实例数${same(flat, sphere) && same(flat, back) ? '逐项相同' : '有差异'}`);
      const st = edges.stats;
      check('U6-edges', edges.long === 0 && edges.objects > 0, `城镇范围（|x|、|z| ≤ 48）内 ${edges.objects} 个网格/墨线、${edges.prims} 个三角形或线段，水平边 > 4 m 的 ${edges.long} 个，最长 ${f(edges.worst, 3)} m${edges.long ? '：' + JSON.stringify(edges.bad) : ''}；启动时细分 网格 ${st.meshes}、墨线 ${st.lines}（检查 ${st.objects} 个对象），三角形 ${st.trianglesBefore} → ${st.trianglesAfter}，线段 ${st.segmentsBefore} → ${st.segmentsAfter}，用时 ${st.ms} ms`);
    }
    if (want('U7')) {
      // R1 (THIRD_PERSON_ROAM_PLAN 6.13.4): the ride replaces the walk. The same paths as W10f's U7, ridden with window.__scene.ride.step (dt 1/60, pure pursuit 2.5 m x s
      // ahead, speed by the surface cap and the curvature ahead): the 20 random pieces outside the town, the W9a town corridors and RT-01/RT-02 town legs, the nine exits, the
      // RN01 tunnel and the seam on RN01-13. At every third step a vertical ray against the rendered walk surfaces under the front and the rear wheel contact: within 0.01 m x s.
      // The camera's nominal height (focus 0.92 + 0.70 = ground + 1.62 m x s) is checked where the road is straight and level and the camera settled (both wheels level to
      // 0.1 %, heading rate < 0.05 rad/s for >= 1 s, the look and distance at their defaults, the rendered ground under the camera within 4 mm of the rider's): within 0.01 m x s.
      const arc = ([, c, r, a0, a1]) => { const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 5)), out = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } return out; };
      const legsOf = id => { const rt = RR.ROUTES.find(q => q.id === id), pts = []; for (const leg of rt.legs) if (leg.town) for (const q of leg.town.flatMap(q => (q[0] === 'arc' ? arc(q) : [q]))) { const last = pts[pts.length - 1]; if (!last || Math.hypot(last[0] - q[0], last[1] - q[1]) > 1e-6) pts.push(q); } return pts; };
      const node = id => L.roadNodes.find(n => n.id === id), town = [];
      for (const r of L.roads) for (let i = 0; i + 1 < r.nodes.length; i++) { const a = node(r.nodes[i]), b = node(r.nodes[i + 1]); town.push({ name: `W9a ${r.id} ${r.nodes[i]}–${r.nodes[i + 1]}`, P: [[a.x, a.z], [b.x, b.z]] }); }
      for (const a of L.alleys) { const zc = (a.rect[1] + a.rect[3]) / 2; town.push({ name: `W9a ${a.id}`, P: [[a.rect[0] + 1.2, zc], [a.rect[2] - 1.2, zc]] }); }
      town.push({ name: 'RT-01 城内', P: legsOf('RT-01') }, { name: 'RT-02 城内', P: legsOf('RT-02') });
      const pieces = RR.random20(W);
      const res = await page.evaluate(({ town, pieces }) => {
        const S = window.__scene, G = S.ground, T = window.THREE, W = window.WORLD, PER = G.PERIOD, HALF = PER / 2, D = Math.PI / 180, R = 90, dt = 1 / 60;
        const wdx = d => d - PER * Math.round(d / PER), canon = x => x - PER * Math.floor((x + HALF) / PER), wpi = a => Math.atan2(Math.sin(a), Math.cos(a));
        S.view.set({ mode: 'free', mapMode: 'flat', target: [-7, 1.2, 20], yaw: 2.5, pitch: 0.5, dist: 34 }); S.transition.step(3); S.view.set({ mode: 'roam' });
        const entered = S.view.get().mode === 'roam';
        const meshes = [];
        S.roads.state.root.traverse(o => { if (o.isMesh && (/^road:(route |junction paving)/.test(o.name) || /^road:bridge .* top$/.test(o.name) || o.name === 'road:plank')) meshes.push(o); });
        S.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.userData.groundOccupancy && !meshes.includes(o)) { let lm = false; for (let q = o; q; q = q.parent) if (/^lm\d/i.test(q.name || '')) lm = true; if (!lm) meshes.push(o); } });
        S.scene.updateMatrixWorld(true);
        const boxes = meshes.map(o => { if (o.isInstancedMesh) o.computeBoundingBox(); else if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); return { o, b: (o.isInstancedMesh ? o.boundingBox.clone() : o.geometry.boundingBox.clone()).applyMatrix4(o.matrixWorld) }; });
        const ray = new T.Raycaster(), down = new T.Vector3(0, -1, 0), from = new T.Vector3();
        const cast = (x, y0, z) => { let best = null; for (const cx of [canon(x), canon(x) + PER, canon(x) - PER]) { const list = boxes.filter(q => cx >= q.b.min.x - 0.01 && cx <= q.b.max.x + 0.01 && z >= q.b.min.z - 0.01 && z <= q.b.max.z + 0.01).map(q => q.o); if (!list.length) continue;
          from.set(cx, y0, z); ray.set(from, down); ray.far = 50; const h = ray.intersectObjects(list, false); if (h.length && (best === null || h[0].point.y > best.y)) best = { y: h[0].point.y, plank: h[0].object.name === 'road:plank' }; } return best; };
        const rendered = (x, y0, z, kind, h, s) => { const c = cast(x, y0, z); if (kind !== 'boardwalk' || (c && c.plank)) return c ? c.y : null; let y = null; for (const d of [0.15, -0.15, 0.3, -0.3]) { const q = cast(x + Math.sin(h) * d * s, y0, z + Math.cos(h) * d * s); if (q && q.plank && (y === null || q.y > y)) y = q.y; } return y; };
        const CFG = S.ride.cfg;
        const ride = (name, P) => {
          const n = P.length, Lc = [0]; for (let i = 1; i < n; i++) Lc.push(Lc[i - 1] + Math.hypot(wdx(P[i][0] - P[i - 1][0]), P[i][1] - P[i - 1][1]));
          const total = Lc[n - 1], at = u => { let i = 0; while (i + 2 < n && Lc[i + 1] < u) i++; const t = Math.max(0, Math.min(1, (u - Lc[i]) / Math.max(1e-9, Lc[i + 1] - Lc[i]))); return [P[i][0] + wdx(P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t]; };
          const out = { name, length: +total.toFixed(2), steps: 0, reached: false, wheel: 0, eye: 0, eyeN: 0, misses: 0, rays: 0, dy: 0, wraps: 0, kinds: {}, layers: {}, s: [Infinity, 0], worst: null };
          let placed = null; for (let i0 = 0; i0 < Math.min(n - 1, 8) && !placed; i0++) placed = S.ride.set({ x: G.wrap(P[i0][0]), z: P[i0][1], heading: Math.atan2(wdx(P[i0 + 1][0] - P[i0][0]), P[i0 + 1][1] - P[i0][1]) });
          if (!placed) return { ...out, start: 'off' };
          let g = S.ride.get(), ux = P[0][0] + wdx(g.x - P[0][0]), j = 0, u = 0, prevRoot = g.root, prevX = g.x, prevH = g.heading, settled = 0; const w0 = g.wraps;
          const max = Math.ceil(total / (0.5 * 2.0 * dt)) + 900;
          for (let k = 0; k < max; k++) {
            let best = null; for (let i = j; i < Math.min(n - 1, j + 60) && Lc[i] <= u + 3 * g.s; i++) { const ax = P[i][0], az = P[i][1], dx = wdx(P[i + 1][0] - ax), dz = P[i + 1][1] - az, l2 = dx * dx + dz * dz || 1e-12, px = ax + wdx(ux - ax), t = Math.max(0, Math.min(1, ((px - ax) * dx + (g.z - az) * dz) / l2)), d = Math.hypot(px - ax - dx * t, g.z - az - dz * t); if (!best || d < best.d - 1e-9) best = { i, d, u: Lc[i] + Math.sqrt(l2) * t }; }
            j = best.i; u = Math.max(u, best.u);
            if (total - u < 0.35 * g.s || (g.contact && Math.abs(g.speed) < 0.02 && total - u < (CFG.half + CFG.radius + 0.5) * g.s)) { out.reached = true; break; }
            const tg = at(Math.min(total, u + 2.5 * g.s)), err = wpi(Math.atan2(wdx(tg[0] - ux), tg[1] - g.z) - g.heading);
            let kmax = 0; for (let i = j; i < n - 1 && Lc[i] < u + 4 * g.s; i++) { const a = Math.atan2(wdx(P[i + 1][0] - P[i][0]), P[i + 1][1] - P[i][1]), b = i + 2 < n ? Math.atan2(wdx(P[i + 2][0] - P[i + 1][0]), P[i + 2][1] - P[i + 1][1]) : a; kmax = Math.max(kmax, Math.abs(wpi(b - a)) / Math.max(1e-6, (Lc[i + 1] - Lc[i]) / g.s)); }
            const vt = Math.min(g.cap, Math.sqrt(3.0 / Math.max(kmax, 1e-6)), Math.abs(err) > 1.0 ? 0.6 : Infinity, Math.sqrt(2 * 2.0 * Math.max(0, (total - u) / g.s - 0.2)));
            g = S.ride.step(dt, { throttle: g.speed > vt + 0.05 ? -Math.min(1, (g.speed - vt) / 1.5) : Math.max(0, Math.min(1, vt / g.cap)), steer: Math.max(-1, Math.min(1, -3 * err)) }); out.steps++;
            ux += wdx(g.x - prevX); prevX = g.x;
            out.kinds[g.kind] = (out.kinds[g.kind] || 0) + 1; out.layers[g.layer] = (out.layers[g.layer] || 0) + 1; out.s[0] = Math.min(out.s[0], g.s); out.s[1] = Math.max(out.s[1], g.s);
            const dy = Math.abs(g.root - prevRoot) / g.s; if (dy > out.dy) out.dy = dy; prevRoot = g.root;
            const hr = Math.abs(wpi(g.heading - prevH)) / dt; prevH = g.heading;
            const level = Math.abs(g.wheels[0] - g.wheels[1]) / (CFG.wheelbase * g.s) < 0.001 && hr < 0.05 && Math.abs(g.lookYaw) < 1e-9 && Math.abs(g.lookPitch - Math.atan2(CFG.up, CFG.back)) < 1e-9 && Math.abs(g.dist - CFG.back) < 1e-9;
            settled = level ? settled + 1 : 0;
            if (k % 3 === 0) {
              const fx = Math.sin(g.heading), fz = Math.cos(g.heading), hw = CFG.wheelbase / 2 * g.s;
              for (const [sg, wy, wk] of [[1, g.wheels[0], g.wheelKinds[0]], [-1, g.wheels[1], g.wheelKinds[1]]]) { const x = g.x + sg * fx * hw, z = g.z + sg * fz * hw, r = rendered(x, wy + 0.6 * g.s, z, wk, g.heading, g.s); out.rays++;
                if (r === null) { out.misses++; if (!out.worst) out.worst = { miss: [+x.toFixed(2), +z.toFixed(2)], kind: wk }; continue; } const e = Math.abs(wy - r) / g.s; if (e > out.wheel) { out.wheel = e; if (e > 0.01) out.worst = { at: [+x.toFixed(2), +z.toFixed(2)], wy, r, kind: wk }; } }
              if (settled >= 60) { const cam = S.camera.position, rc = rendered(cam.x, cam.y, cam.z, null, g.heading, g.s);
                if (rc !== null && Math.abs(rc - g.root) < 0.004 * g.s) { out.eyeN++; const e = Math.abs((cam.y - rc) / g.s - (CFG.focus + CFG.up)); if (e > out.eye) out.eye = e; } }
            }
          }
          out.wraps = g.wraps - w0;
          return { ...out, wheel: +out.wheel.toFixed(4), eye: +out.eye.toFixed(4), dy: +out.dy.toFixed(4), s: out.s.map(v => +v.toFixed(3)), u: +u.toFixed(2) };
        };
        const flatPt = (lon, lat) => [R * lon * D, -R * Math.asinh(Math.tan(lat * D))];
        const town_ = town.map(t => { const P = []; for (let i = 0; i + 1 < t.P.length; i++) { const [a, b] = [t.P[i], t.P[i + 1]], m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5)); for (let k = i ? 1 : 0; k <= m; k++) P.push([a[0] + (b[0] - a[0]) * k / m, a[1] + (b[1] - a[1]) * k / m]); } return ride(t.name, P); });
        const random = pieces.map(pc => { const e = W.roadNetwork.edges.find(q => q.id === pc.edge), sp = W.roadNetwork.samplePath(e, 0.5).filter(q => q.s >= pc.s0 - 1e-6 && q.s <= pc.s1 + 1e-6), P = [];
          for (const q of sp) { const f = flatPt(q.lon, q.lat); if (P.length) f[0] = P[P.length - 1][0] + wdx(f[0] - P[P.length - 1][0]); P.push(f); }
          return ride(`${pc.edge} ${pc.s0}–${pc.s1}`, P); });
        const exits = [];
        for (const ln of G.lines.filter(l => l.kind === 'route' && /^(N\d\d-|M01-south)/.test(l.id))) {
          const edgeS = (() => { for (let i = 0; i < ln.n; i++) { const f = ln.F[i]; if (Math.max(Math.abs(f.x), Math.abs(f.z)) > 48) return ln.S[i].s; } return ln.length; })();
          const s0 = Math.max(0, edgeS - 12), s1 = Math.min(ln.length - 0.5, edgeS + 12), P = []; for (let s = s0; s <= s1 + 1e-6; s += 0.5) { const q = ln.point(Math.min(s, s1), 0); P.push([q.x, q.z]); }
          exits.push(ride(`${ln.id} 出城`, P));
        }
        { const ln = G.lines.find(l => l.tunnel), P = []; for (let s = 0.5; s <= ln.length - 0.5; s += 0.5) { const q = ln.point(s, 0); P.push([q.x, q.z]); } exits.push(ride(`${ln.id} 隧道`, P)); }
        { const ln = G.lines.find(l => l.id === 'RN01-13'), P = []; let sx = null, px = null; for (let s = 0; s <= ln.length; s += 0.5) { const x = G.wrap(ln.point(s, 0).x); if (sx === null && px !== null && Math.abs(x - px) > HALF) sx = s; px = x; }
          for (let s = Math.max(0.5, sx - 15); s <= Math.min(ln.length - 0.5, sx + 15); s += 0.5) { const q = ln.point(s, 0); P.push([q.x, q.z]); } exits.push({ ...ride(`${ln.id} 平面接缝（第 ${sx.toFixed(1)} m）`, P), seam: true }); }
        S.view.set({ mode: 'free' });
        return { entered, meshes: meshes.length, town: town_, random, exits };
      }, { town, pieces });
      const ok = q => q.reached && q.misses === 0 && q.wheel <= 0.01 && q.eye <= 0.01;
      const line = q => `${q.name}${q.reached ? '' : `（未走通：${q.u}/${q.length} m）`} ${q.length} m、${q.steps} 步、射线 ${q.rays}${q.misses ? `、未命中 ${q.misses}` : ''}，轮 ${q.wheel} m、镜头标称高度 ${q.eye} m（${q.eyeN} 次）、单步高差 ${q.dy} m、s ${q.s.join('–')}${q.wraps ? `、跨接缝 ${q.wraps} 次` : ''}、${Object.keys(q.kinds).join('/')}${q.layers.deck || q.layers.tunnel ? `、层 ${Object.entries(q.layers).map(([k, v]) => k + ' ' + v).join(' ')}` : ''}${q.worst && !ok(q) ? '；例 ' + JSON.stringify(q.worst) : ''}`;
      console.log(`INFO U7 骑行进入 ${res.entered}，射线检查的可走面网格 ${res.meshes} 个`);
      for (const q of [...res.random, ...res.town, ...res.exits]) console.log('  · ' + line(q));
      const worst = list => ({ wheel: Math.max(...list.map(q => q.wheel)), eye: Math.max(...list.map(q => q.eye)), n: list.reduce((a, q) => a + q.eyeN, 0) });
      const wr = worst(res.random), wt = worst(res.town), we = worst(res.exits);
      check('U7', res.entered && res.random.length === 20 && res.random.every(ok), `骑行（R1 起取代步行）城外随机 20 段（种子 20261018）走通 ${res.random.filter(q => q.reached).length}/20，前后轮接地点与渲染路面最大差 ${f(wr.wheel, 4)} m，平直处镜头标称高度（地面 + 1.62 m）最大差 ${f(wr.eye, 4)} m（${wr.n} 次；真实米，≤ 0.01）`);
      check('U7-town', res.town.every(ok), `W9a 城镇路线 ${res.town.length} 条（街道段 ${res.town.filter(q => /^W9a R/.test(q.name)).length}、巷道 ${res.town.filter(q => /^W9a A/.test(q.name)).length}、RT-01/RT-02 城内段）骑通 ${res.town.filter(q => q.reached).length}/${res.town.length}，轮 ${f(wt.wheel, 4)} m、镜头标称高度 ${f(wt.eye, 4)} m（${wt.n} 次）`);
      check('U7-exits', res.exits.every(q => ok(q)) && res.exits.filter(q => q.seam).every(q => q.wraps === 1), `九个出口出城、RN01 隧道与平面接缝 ${res.exits.length} 条骑通 ${res.exits.filter(q => q.reached).length}/${res.exits.length}，轮 ${f(we.wheel, 4)} m、镜头标称高度 ${f(we.eye, 4)} m（${we.n} 次）、单步最大高差 ${f(Math.max(...res.exits.map(q => q.dy)), 4)} m`);
    }
    check('U6-U7-errors', !errors.length, errors.join('；') || '无页面错误');
  } finally { await browser.close(); }
}
console.log(`${failures ? 'FAIL' : 'PASS'} unify_check${ONLY ? ' --only ' + ONLY.join(',') : ''}`);
process.exitCode = failures ? 1 : 0;
