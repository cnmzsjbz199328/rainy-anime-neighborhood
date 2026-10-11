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
//   U2, U4-U7 belong to W10c-W10g and are reported as not implemented until then. --no-browser runs U0 and U1 only (Node).
// Real GPU (ANGLE Metal, as the timing tools): the checks are structural, the renderer does not change them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const check = (id, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${detail}`); if (!ok) failures++; };

// ---- U0 (W10a): town view / explore view, the on-demand builds and the background generation
const files = ['scene.js', 'terrain.js', 'section.js', 'roads.js', 'ocean.js', 'landcover.js', 'worldgen.js', 'transition.js', 'quality.js'];
const removed = /\b(?:setExplore|onExplore|setFade|landmarksVisible|buildLandmarks|buildRest|START_DELAY_MS|SLICE_MS|requestIdleCallback|restMat|fadeMaterials|visibilityOf|terrainOf|capsOf|setHeadCaps)\b|\bfunction\s+(?:visibility|ensure)\s*\(|\.explore\b|fade\.rest|opts\.gate|\bgate\s*:/;
const hits = files.flatMap(f => fs.readFileSync(path.join(root, f), 'utf8').split('\n').flatMap((l, i) => (removed.test(l) && !l.trim().startsWith('//') ? [`${f}:${i + 1}`] : [])));
check('U0', !hits.length, `W10a 删除项：${hits.join('、') || '无残留'}`);

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
{
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

// ---- U3 (W10a)
if (process.argv.includes('--no-browser')) console.log('（--no-browser：U3 不跑）');
else {
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
          window.__firstWorld = { nodes, done: S.worldgen.state.done, built: [S.terrain.restBuilt, S.section.state.built, S.roads.state.built, S.ocean.state.built, S.cover.state.built],
            landmarks: Object.keys(S.landmarks.info).filter(k => k.startsWith('LM')).length, probe: S.quality.state.probe.length }; }
        return render(...args); }; } });
  });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?quality=auto');
  await page.waitForFunction(() => window.__firstWorld, null, { timeout: 120000 });
  const first = await page.evaluate(() => window.__firstWorld);
  check('U3-first', first.done && first.built.every(Boolean) && first.landmarks === 10 && first.probe === 0,
    `首帧前启动管线完成 ${first.done}、模块已建 ${first.built.join('/')}、地标 ${first.landmarks}、auto 已采帧 ${first.probe}；网格与线 ${first.nodes.length}`);
  // 30 s after the first frame, the camera cycling through the three states once a second
  const STATES = [{ mapMode: 'flat', target: [-7, 1.2, 20], dist: 34 }, { mapMode: 'flat', target: [-90, 1.2, 60], dist: 30 }, { mapMode: 'sphere', dist: 140 }];
  const rows = [], start = Date.now();
  for (let i = 0; Date.now() - start < 30000; i++) {
    rows.push(await page.evaluate(v => { const S = window.__scene; S.view.set(v); S.transition.step(3);
      const nodes = []; S.scene.traverse(o => { if (o.isMesh || o.isLineSegments) nodes.push([o.uuid, o.instanceMatrix ? o.instanceMatrix.count : 0]); });
      const roots = [S.terrain.root, S.section.state.root, S.section.state.globalInkGroup, S.roads.state.root, S.ocean.state.root, S.cover.state.root, ...Object.values(S.landmarks.info).flatMap(q => (q && q.groups) || [])];
      return { mode: v.mapMode, nodes, visible: roots.every(g => g && g.visible), terrain: S.terrain.ring.concat(S.terrain.rest).every(m => m.visible) }; }, STATES[i % 3]));
    await page.waitForTimeout(1000);
  }
  const same = r => JSON.stringify(r.nodes) === JSON.stringify(first.nodes);
  check('U3-stable', rows.every(same), `首帧后 ${Math.round((Date.now() - start) / 1000)} s、${rows.length} 次采样（城镇 / 平面远处 / 球形轮换）：网格与实例容量${rows.every(same) ? '不变' : '有变化：' + rows.filter(r => !same(r)).map(r => r.mode + ' ' + r.nodes.length).join('、')}`);
  check('U3-display', rows.every(r => r.visible && r.terrain), `三种状态下模块根、全景墨线组、地标组与地形分块都可见${rows.every(r => r.visible && r.terrain) ? '' : '（有隐藏：' + rows.filter(r => !(r.visible && r.terrain)).map(r => r.mode).join('、') + '）'}`);
  // U3-town (W10a rework after the user's review of N08, 2026-10-10): with every module shown in the town view, none may lie on the town's own streets.
  // On every town carriageway (layout.js roads, every 0.5 m, 9 points across; alleys on a 0.5 m grid) a vertical ray must meet a town surface first, and no
  // world ground layer with a polygon offset may lie within 5 cm below it (an offset lets a layer that is under the street win when it is seen obliquely).
  // The exit heads and the town's last 0.25 m are left out: that joint is the heads' by design until W10c replaces them (U1, U2).
  const town = await page.evaluate(() => {
    const S = window.__scene, T = window.THREE, L = window.LAYOUT, world = new Set(), heads = new Set(S.terrain.heads);
    for (const r of [S.section.state.root, S.cover.state.root, S.ocean.state.root, S.roads.state.root, ...S.terrain.ring, ...S.terrain.rest, ...Object.values(S.landmarks.info).flatMap(q => (q && q.groups) || [])]) r.traverse(o => world.add(o));
    const patch = new T.Box3(new T.Vector3(-50, -5, -50), new T.Vector3(50, 5, 50)), box = new T.Box3(), meshes = [];
    S.scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || heads.has(o)) return; for (let q = o; q; q = q.parent) if (!q.visible) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); if (box.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).intersectsBox(patch)) meshes.push(o); });
    const pts = [];
    for (const e of L.roads) { const w = L.ROAD_TYPES[e.type].carriageway; for (let i = 0; i + 1 < e.nodes.length; i++) { const a = L.roadNodes.find(n => n.id === e.nodes[i]), b = L.roadNodes.find(n => n.id === e.nodes[i + 1]), len = Math.hypot(b.x - a.x, b.z - a.z), d = [(b.x - a.x) / len, (b.z - a.z) / len];
      for (let s = 0; s <= len; s += 0.5) for (let k = -4; k <= 4; k++) { const o = k / 4 * (w / 2 - 0.25); pts.push([a.x + d[0] * s - d[1] * o, a.z + d[1] * s + d[0] * o]); } } }
    for (const a of L.alleys) for (let x = a.rect[0] + 0.25; x < a.rect[2]; x += 0.5) for (let z = a.rect[1] + 0.25; z < a.rect[3]; z += 0.5) pts.push([x, z]);
    const name = o => { let n = o.name; for (let q = o.parent; !n && q; q = q.parent) n = q.name; return n || o.type; };
    const rc = new T.Raycaster(), bad = {}; let n = 0, nBad = 0;
    // (the last 0.25 m before the patch edge is the joint with the exit heads: W10c)
    for (const [x, z] of pts) { if (Math.abs(x) > 47.75 || Math.abs(z) > 47.75) continue; n++; rc.set(new T.Vector3(x, 30, z), new T.Vector3(0, -1, 0)); const hits = rc.intersectObjects(meshes, false); if (!hits.length) continue;
      const top = hits[0], wrong = world.has(top.object) ? [top] : hits.slice(1).filter(h => world.has(h.object) && top.point.y - h.point.y < 0.05 && (Array.isArray(h.object.material) ? h.object.material : [h.object.material]).some(m => m.polygonOffset));
      if (wrong.length) { nBad++; for (const h of wrong) { const k = name(h.object); (bad[k] = bad[k] || { n: 0, at: [] }).n++; if (bad[k].at.length < 3) bad[k].at.push(`(${x.toFixed(1)}, ${z.toFixed(1)})`); } } }
    return { n, nBad, bad };
  });
  check('U3-town', town.nBad === 0, `城镇车行道与巷道 ${town.n} 点，被世界图层盖住或下方 5 cm 内埋着带偏移的世界地面层 ${town.nBad} 点${town.nBad ? '：' + Object.entries(town.bad).map(([k, v]) => `${k} ${v.n}（${v.at.join('、')}）`).join('；') : ''}`);
  check('U3-errors', !errors.length, errors.join('；') || '无页面错误');
} finally { await browser.close(); }
}
console.log('TODO U2、U4–U7 属于 W10c–W10g，尚未实施（不算通过）');
process.exitCode = failures ? 1 : 0;
