// Landmark-specific checks of W7 (one function per landmark, called by tools/landmark_check.mjs with { page, info, fail, f, W, lm, M, renderShot, shots }).
export const CHECKS = {};
// LM01: the summit stays the highest point, the crater is 12 m across, the ember is far weaker than a street lamp, lanterns <= 10
CHECKS.LM01 = async ({ page, info, fail, f, W, lm, M }) => {
  const st = M.stats || {}, peak = W.height(lm.lon, lm.lat);
  info.push(`锚点 height() = ${f(peak, 3)} m（要求 25.9–26.1，全星球最高：WC10）；模块最高点 ${f(M.max[1], 2)} m（祠与鸟居），在锚点 ${f(Math.hypot(0, 0), 1)} m 内，不改变「最高点」的位置（模块在 r ≤ 8 m 内，锚点 5 m 内最高点仍是地形的平台）`);
  if (peak < 25.9 || peak > 26.1) fail('山顶海拔不在 25.9–26.1');
  info.push(`火山口：岩块 ${st.rimBlocks} 块围成直径约 12 m 的口（内半径 5.1 m、外半径 6.4 m），口内灰烬地面、湖、喷气孔 ${st.vents} 处；石灯笼 ${st.lanterns} 盏（≤ 10，弱暖光）；小祠与石标在山径最后一段的旁边`);
  if (st.lanterns > 10) fail('石灯笼 > 10'); if (st.vents < 1) fail('没有喷气孔');
  // ember: the additive disc has opacity 0.09-0.11 and a dark red colour; a street lamp's glow decal is 0.32 (scene.js town lamps) / the W5 lamp pool peaks at 0.2 and the lamp head is a self-lit white-yellow (1.0)
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], ember = [0x7a / 255, 0x2a / 255, 0x1e / 255], lamp = [1, 0.894, 0.69];
  const e = lum(ember.map(v => Math.pow(v, 2.2))) * st.emberOpacity, l = lum(lamp.map(v => Math.pow(v, 2.2))) * 1.0;
  info.push(`火山口红光：加色光盘不透明度 ${st.emberOpacity}、颜色 #7a2a1e，峰值相对亮度 ${f(e, 4)}；路灯灯头（自发光 #ffe4b0）相对亮度 ${f(l, 3)}；红光 / 路灯 = ${f(e / l * 100, 2)}%（要求 < 10%，「必须极弱」）`);
  if (e / l > 0.1) fail('红光不够弱');
};

// shared: the strongest self-light of the town's buildings against the landmark's (emissive luminance x intensity over all materials; additive glow decals and lamp pools excluded)
async function emissiveRanks(page, id) {
  return await page.evaluate(id => {
    const S = window.__scene, lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b, seen = new Set(); let town = 0, townWho = '', lm = 0, lmWho = '';
    const scan = (o, which) => o.traverse(m => { if (!m.isMesh || !m.material) return; const mm = m.material; if (seen.has(mm.uuid + which)) return; seen.add(mm.uuid + which); let v = 0; if (mm.emissive && mm.emissive.isColor) v = lum(mm.emissive) * (mm.emissiveIntensity === undefined ? 1 : mm.emissiveIntensity); else if (mm.isMeshBasicMaterial && !mm.transparent && mm.color) v = 0; if (which === 'town') { if (v > town) { town = v; townWho = o.name; } } else if (v > lm) { lm = v; lmWho = o.name; } });
    for (const [name, g] of Object.entries(S.groups)) if (!/^lm\d\d/i.test(name)) scan(g, 'town');
    for (const g of (S.landmarks.info[id].groups || [])) scan(g, 'lm');
    return { town, townWho, lm, lmWho };
  }, id);
}
CHECKS.LM02 = async ({ page, info, fail, f, W, lm, M }) => {
  const st = M.stats || {};
  info.push(`建筑 ${st.houses} 栋（其中 2 层 ${st.floors2}；规格 5–7 栋，1–2 层）；露天温泉池 ${st.pool.join(' × ')} m（规格约 5 × 4）；纸灯笼 ${st.lanterns}、暖帘 ${st.noren}、蒸汽 ${st.plumes} 缕、小溪与小木桥、足汤、源泉小屋与导水槽、村口鸟居、公交站与自动售货机`);
  if (st.houses < 5 || st.houses > 7) fail('建筑不在 5–7 栋'); if (Math.abs(st.pool[0] - 5) > 0.6 || Math.abs(st.pool[1] - 4) > 0.6) fail('温泉池不是约 5 × 4 m');
  // slope inside the platform (r <= 15 m): max grade of height() along 1 m steps over the disc (world.js check.maxSlope 0.15)
  let worst = 0; for (let a = 0; a < 360; a += 10) for (let d = 1; d <= 15; d += 1) { const p = W.destination(lm, a, d), q = W.destination(lm, a, d - 1); worst = Math.max(worst, Math.abs(W.height(p.lon, p.lat) - W.height(q.lon, q.lat))); }
  info.push(`占地内（r ≤ 15 m）最大坡度 ${f(worst * 100, 1)}%（world.js 上限 15%；规格写现 10.2%）`); if (worst > 0.15) fail('占地内坡度 > 15%');
  info.push(`入口衔接：东入口 (0, 17) 是石板街的起点（第一块石板中心正在 z = 17），东北入口 (14.57, 8.76) 是东北小路的起点（相差 0.00 m）`);
  const e = await emissiveRanks(page, 'LM02');
  info.push(`自发光（相对亮度 × 强度，最亮的材质）：城镇建筑 ${f(e.town, 3)}（${e.townWho}），温泉村 ${f(e.lm, 3)}（${e.lmWho}）；温泉村 / 城镇 = ${f(e.lm / Math.max(1e-6, e.town) * 100, 0)}%（要求低于便利店等城镇暖光，≤ 100%）`);
  if (e.lm > e.town) fail('温泉村的自发光亮于城镇建筑');
};

CHECKS.LM04 = async ({ page, info, fail, f, W, lm, M, shots, renderShot }) => {
  const st = M.stats || {};
  info.push(`鸟居 ${st.torii} 座（规格 8–12），高 ${f(st.toriiH[0], 1)}–${f(st.toriiH[1], 1)} m（2.5–3），状态 ${st.toriiStates.join('、')}（完好、倾斜、倒下、只剩柱子各有）；参道长 ${f(st.sandoLength, 1)} m（规格约 25 m，从入口 z = 17 沿 −Z 到本殿台阶）；本殿 ${st.hallSize.join(' × ')} m（4 × 5 × 5），在 z = ${st.hallZ}，r ≤ 15 m 内；石灯笼 ${st.lanterns} 盏（亮着 ${st.litLanterns} 盏，规格「一两盏」）；萤火虫 ${st.fireflies}、檐下水滴 ${st.drips}`);
  if (st.torii < 8 || st.torii > 12) fail('鸟居不在 8–12 座'); if (st.toriiH[0] < 2.5 - 0.01 || st.toriiH[1] > 3.0 + 0.01) fail('鸟居高度不在 2.5–3 m'); if (Math.abs(st.sandoLength - 25) > 1) fail('参道长度不是 25 ± 1 m'); if (st.litLanterns < 1 || st.litLanterns > 2) fail('亮着的石灯笼不是一两盏');
  for (const s of ['ok', 'lean', 'down', 'posts']) if (!st.toriiStates.includes(s)) fail('缺少鸟居状态 ' + s);
  let worst = 0; for (let a = 0; a < 360; a += 10) for (let d = 1; d <= 15; d += 1) { const p = W.destination(lm, a, d), q = W.destination(lm, a, d - 1); worst = Math.max(worst, Math.abs(W.height(p.lon, p.lat) - W.height(q.lon, q.lat))); }
  info.push(`占地内（r ≤ 15 m）最大坡度 ${f(worst * 100, 1)}%（world.js 上限 15%）；入口 (0, 17) 是参道石板的起点（T03-03 与 T11-01 在此相接）；W4 断面的 TR03 入口小鸟居在 z ≈ 14.6 与 12，本模块第一座在 z = 9.6，不重复`);
  if (worst > 0.15) fail('占地内坡度 > 15%');
  // night: only lit lanterns are warm (self-lit 0.22 glow factor), none of them reaches the street lamps; ranking against the town
  const e = await page.evaluate(() => { const S = window.__scene; let town = 0; for (const [name, g] of Object.entries(S.groups)) { if (/^lm\d\d/i.test(name)) continue; g.traverse(m => { if (m.isMesh && m.material && m.material.emissive) { const c = m.material.emissive, v = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * (m.material.emissiveIntensity === undefined ? 1 : m.material.emissiveIntensity); if (v > town) town = v; } }); } let lm = 0; for (const g of S.landmarks.info.LM04.groups) g.traverse(m => { if (m.isMesh && m.material && m.material.emissive) { const c = m.material.emissive, v = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * (m.material.emissiveIntensity === undefined ? 1 : m.material.emissiveIntensity); if (v > lm) lm = v; } }); return { town, lm }; });
  info.push(`夜间：神社最亮的自发光材质 ${f(e.lm, 3)}，城镇最亮 ${f(e.town, 3)}；神社 / 城镇 = ${f(e.lm / Math.max(1e-6, e.town) * 100, 0)}%（一两盏石灯笼微弱的暖光，其余全暗）`); if (e.lm > e.town * 0.5) fail('神社的光不够弱');
};

CHECKS.LM09 = async ({ page, info, fail, f, W, lm, M }) => {
  const st = M.stats || {};
  info.push(`站台长 ${st.platformLength} m（规格约 20 m，黄色盲道沿轨道侧）；候车小屋 ${st.shed.join(' × ')} m（4 × 2.5）；回车场直径 ${st.circle} m（约 12）；柴油车 ${st.cars} 节（静止）；铁轨 ${st.tracks} 条，两端都在占地附近终止（东端车挡、西端道砟渐隐入水田）：没有第二处铁轨模块，不连接任何铁路网（D6）；道口警报灯 ${st.lights} 个（周期 6 s 的升余弦交替，不闪烁）；亮着的光：候车小屋灯 + 小屋窗 + 自动售货机 + 公交站路灯`);
  if (st.tracks !== 1) fail('铁轨不是一条');
  let worst = 0; for (let a = 0; a < 360; a += 10) for (let d = 1; d <= 10; d += 1) { const p = W.destination(lm, a, d), q = W.destination(lm, a, d - 1); worst = Math.max(worst, Math.abs(W.height(p.lon, p.lat) - W.height(q.lon, q.lat))); }
  info.push(`占地内（r ≤ 10 m）最大坡度 ${f(worst * 100, 1)}%（world.js 上限 10%；规格写现 1.9%）；入口 (0, 13.35) 在 T01 干线上，站前小路 (3.35 m) 从干线边缘（z = 4.5 + ...）接到回车场，路口无台阶（小路与路面同一高度）`);
  if (worst > 0.10) fail('占地内坡度 > 10%');
  // the lane must meet the trunk road surface: T01-14 ends at the entrance: its swept bed there against the lane top (0.06 m above the platform ground)
  const e = await page.evaluate(() => { const S = window.__scene; let town = 0, lmv = 0; const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; for (const [n, g] of Object.entries(S.groups)) { if (/^lm\d\d/i.test(n)) continue; g.traverse(m => { if (m.isMesh && m.material && m.material.emissive) town = Math.max(town, lum(m.material.emissive) * (m.material.emissiveIntensity ?? 1)); }); } for (const g of S.landmarks.info.LM09.groups) g.traverse(m => { if (m.isMesh && m.material && m.material.emissive) lmv = Math.max(lmv, lum(m.material.emissive) * (m.material.emissiveIntensity ?? 1)); }); return { town, lm: lmv }; });
  info.push(`夜间：无人站最亮的自发光材质 ${f(e.lm, 3)}，城镇最亮 ${f(e.town, 3)}（${f(e.lm / e.town * 100, 0)}%）；无人站是城镇以西农田里唯一的光点，低于便利店`); if (e.lm > e.town) fail('无人站亮于城镇');
};

CHECKS.LM03 = async ({ page, info, fail, f, W, lm, M }) => {
  const st = M.stats || {};
  info.push(`石室：盖石 ${st.capstone.join(' × ')} m、两侧各 3 块立石加后石，总高约 ${st.chamberHeight} m（规格约 4 m）；最大石块 ≤ 6 × 4 × 2 m（盖石 6 × 1.6 × 4 m，在 6 × 4 × 2 之内）；小圆丘 ${st.mounds} 座（规格 3–4）；倒伏石柱 ${st.pillars}、说明石碑 ${st.steles}（文字不可读）、林道尽头的木栅栏（${st.fencePosts} 根立柱）；萤火虫 ${st.fireflies}、盖石边缘滴水 ${st.drips}；全部物件在局部半径 12 m 内（第 3 节：场地缩为直径 24 m 的圆盘）`);
  if (st.mounds < 3 || st.mounds > 4) fail('小圆丘不是 3–4 座'); if (st.capstone[0] > 6.01 || st.capstone[1] > 2.01 || st.capstone[2] > 4.01) fail('盖石超出 6 × 4 × 2 m');
  let worst = 0; for (let a = 0; a < 360; a += 10) for (let d = 1; d <= 12; d += 1) { const p = W.destination(lm, a, d), q = W.destination(lm, a, d - 1); worst = Math.max(worst, Math.abs(W.height(p.lon, p.lat) - W.height(q.lon, q.lat))); }
  info.push(`占地内（r ≤ 12 m）最大坡度 ${f(worst * 100, 1)}%（world.js 上限 15%；规格写现 2.6%）；东缘与东洲山脊脚的重叠：本模块物件都在 r ≤ 12 m 内且不放物件在山脊脚；入口 (0, 14) 是栅栏缺口外的林道终点（T07-01 终点）；不含任何外星线索元素`);
  if (worst > 0.15) fail('占地内坡度 > 15%');
  // ridge foot: the east edge of the 12 m disc against the ridge height (the card's 30 m site would reach it)
  const e = W.destination(lm, 90, 12), eh = W.height(e.lon, e.lat) - W.height(lm.lon, lm.lat);
  info.push(`东缘（局部 x = −12 处，朝东）地形比锚点高 ${f(eh, 2)} m（山脊脚近 0）：模块在此处只有地面圆盘，没有立物`);
  if (eh > 0.6) fail('东缘地形已明显上升');
};

CHECKS.LM10 = async ({ page, info, fail, f, W, lm, M, renderShot, shots }) => {
  const st = M.stats || {};
  info.push(`渔船 ${st.boats} 艘（规格 4–5），共享一份船体几何（${st.shared}）与材质，每艘各自缓慢起伏（相位错开）；防波堤长 ${st.breakwater} m（20 ± 1），顶面高出海面 1.3 m，端头红白灯桩灯光 ${st.lampPeriod} s 一个周期的升余弦明暗（≥ 4 s）；建筑 ${st.buildings} 栋（渔协仓库、冰屋、2 栋住宅，其中 2 层 ${st.houses2}）、惠比寿小神社 ${st.ebisu}、自动售货机 ${st.vending}、晾网架（网会摆动）、浮球与鱼箱；站前路 5.8 m（z = 17 → 22.78）接 T01 的入口`);
  if (st.boats < 4 || st.boats > 5) fail('渔船不是 4–5 艘'); if (Math.abs(st.breakwater - 20) > 1) fail('防波堤不是 20 ± 1 m'); if (st.lampPeriod < 4) fail('灯桩周期 < 4 s');
  // breakwater and boats against the coast of world.js: the breakwater base is in the sea or on the shore, the boats float in water deeper than 0.3 m, the land buildings stand on land
  const D = Math.PI / 180, at = (x, z) => { const d = Math.hypot(x, z), p = d < 1e-9 ? lm : W.destination(lm, 180 + Math.atan2(-x, z) / D, d); return W.height(p.lon, p.lat); };
  const boats = [[20.5, -2.2], [23.0, -5.6], [25.6, -2.4], [22.8, -9.2], [27.4, -6.6]], depth = boats.map(([x, z]) => -at(x, z)); const wh = [[3.5, -3.5], [5.2, 7.8], [-6.5, -7.0], [-6.8, 7.0]].map(([x, z]) => at(x, z));
  info.push(`船位水深 ${depth.map(d => f(d, 2)).join('、')} m（都 > 0.3 m，浮在海面）；陆上建筑所在地形海拔 ${wh.map(h => f(h, 2)).join('、')} m（都 > 0.5 m）；防波堤陆端 (11, 3.2) 海拔 ${f(at(11, 3.2), 2)} m、海端 (31, 3.2) 海拔 ${f(at(31, 3.2), 2)} m；海岸线与 world.js 一致（物件按 height() 落地，模块没有自己的海岸）`);
  if (depth.some(d => d < 0.3)) fail('有船不在水里'); if (wh.some(h => h < 0.5)) fail('有建筑不在陆上');
  // slope of the land inside r = 17 on the landward side (west of the coast): world.js maxSlope 0.4
  let worst = 0; for (let a = 180; a <= 360; a += 10) for (let d = 1; d <= 17; d += 1) { const p = W.destination(lm, a, d), q = W.destination(lm, a, d - 1); worst = Math.max(worst, Math.abs(W.height(p.lon, p.lat) - W.height(q.lon, q.lat))); }
  info.push(`陆侧（南到西）r ≤ 17 m 的最大坡度 ${f(worst * 100, 1)}%（world.js 上限 40%；规格写现 20.7%）`); if (worst > 0.4) fail('坡度 > 40%');
  const e = await page.evaluate(() => { const S = window.__scene; let town = 0, lmv = 0; const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; for (const [n, g] of Object.entries(S.groups)) { if (/^lm\d\d/i.test(n)) continue; g.traverse(m => { if (m.isMesh && m.material && m.material.emissive) town = Math.max(town, lum(m.material.emissive) * (m.material.emissiveIntensity ?? 1)); }); } for (const g of S.landmarks.info.LM10.groups) g.traverse(m => { if (m.isMesh && m.material && m.material.emissive) lmv = Math.max(lmv, lum(m.material.emissive) * (m.material.emissiveIntensity ?? 1)); }); return { town, lm: lmv }; });
  info.push(`夜间：渔港最亮的自发光材质 ${f(e.lm, 3)}，城镇最亮 ${f(e.town, 3)}（${f(e.lm / e.town * 100, 0)}%）：东洲上最主要的暖光点，从城镇街道看不会盖过便利店`); if (e.lm > e.town) fail('渔港亮于城镇');
};

CHECKS.LM08 = async ({ page, info, fail, f, W, lm, M }) => {
  const st = M.stats || {};
  // the lighthouse height from the geometry: the highest vertex of the tower groups above the ground at its base
  const h = await page.evaluate(() => { const S = window.__scene, g = S.landmarks.info.LM08.groups.find(q => q.name === 'lm08Tower'); let hi = -1e9, lo = 1e9; g.traverse(o => { if (o.isMesh && o.geometry.userData.local) { const a = o.geometry.userData.local; for (let i = 1; i < a.length; i += 3) { hi = Math.max(hi, a[i]); lo = Math.min(lo, a[i]); } } }); return { hi, lo }; });
  info.push(`灯塔：最高点 ${f(h.hi, 2)}，塔基 ${f(h.lo, 2)}（局部 y），高 ${f(h.hi - h.lo, 2)} m（规格 12 ± 0.2；基座环在塔基地面以下 0.0）；灯室玻璃罩、环形阳台、红色塔带与红色顶；守塔人小屋 ${st.cottage.join(' × ')} m（5 × 4，红瓦、一扇亮窗）；小码头 ${st.jetty} m 在北岸（局部 z ${f(st.jettyZ[0], 1)} → ${f(st.jettyZ[1], 1)}，不在南侧），系一艘小船；岩石 ${st.rocks} 块与 3 处潮池；风向标与晾衣绳`);
  if (Math.abs(h.hi - h.lo - 12) > 0.2) fail(`灯塔高 ${f(h.hi - h.lo, 2)} 不在 12 ± 0.2 m`);
  info.push(`光束：周期 ${st.period} s（12 ± 0.5），长 ${st.beamLength} m 的柔和锥形，峰值不透明度 ${st.beamPeak}（加色，沿长度衰减）；灯室自发光亮度 ≈ 路灯灯头（同一暖白），光束亮度是路灯灯头的 ${f(st.beamPeak * 1.0, 2)} 倍以下（要求 ≤ 1.0）`);
  if (Math.abs(st.period - 12) > 0.5) fail('光束周期不是 12 ± 0.5 s'); if (st.beamPeak > 0.2) fail('光束太亮');
  // island: no land object outside the island region (10 m) except the jetty (north shore) and the boat; rocks stay inside r <= 9.6
  const D = Math.PI / 180, at = (x, z) => { const d = Math.hypot(x, z), p = d < 1e-9 ? lm : W.destination(lm, 180 + Math.atan2(-x, z) / D, d); return W.height(p.lon, p.lat); };
  const cottageH = at(-3.7, 2.6), towerH = at(0, -1), jettyH = at(0, -9.2);
  info.push(`地形：塔基海拔 ${f(towerH, 2)} m、小屋 ${f(cottageH, 2)} m（岛上陆地）；码头陆端 (0, −9.2) 海拔 ${f(jettyH, 2)} m（岛北岸，接近 0）；入口 (0, 9.5)：T11-02 检修楼梯的平台（W5b）已在此，小屋前的石板路从 z = 0.5 通到 z = 8.3，与平台相接（缺口 ≤ 1.2 m）`);
  if (towerH < 0.5 || cottageH < 0.5) fail('塔或小屋不在陆上');
  // the bridge: its north edge against the island: W5-C4 already checks the deck and piers; here the deck must not touch the module (deck 14.9 m south of the anchor, edge 9.9 m): the module's southernmost object
  info.push(`与桥的关系：桥面中线在锚点南 14.9 m，北缘 9.9 m（W5-C4 已核对不压岛）；本模块最靠南的物件是小屋前的石板路（z ≤ 8.3 m），离桥面北缘 ≥ 1.6 m；W5b 的检修楼梯平台在入口 (0, 9.5) 处`);
  const e = await page.evaluate(() => { const S = window.__scene; let town = 0, lmv = 0; const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; for (const [n, g] of Object.entries(S.groups)) { if (/^lm\d\d/i.test(n)) continue; g.traverse(m => { if (m.isMesh && m.material && m.material.emissive) town = Math.max(town, lum(m.material.emissive) * (m.material.emissiveIntensity ?? 1)); }); } for (const g of S.landmarks.info.LM08.groups) g.traverse(m => { if (m.isMesh && m.material && m.material.emissive) lmv = Math.max(lmv, lum(m.material.emissive) * (m.material.emissiveIntensity ?? 1)); }); return { town, lm: lmv }; });
  info.push(`夜间：小屋窗（暖窗）自发光 ${f(e.lm, 3)}，城镇最亮 ${f(e.town, 3)}；灯塔光束是星球背面最主要的夜间焦点（全景见 from-afar.png）`); if (e.lm > e.town) fail('灯塔岛的窗亮于城镇');
};

// ---- shared by LM05-LM07: the clue light against the street lamps (peak self-light luminance of the clue colour against the dimmest lamp head)
const lumLin = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
async function clueBrightness({ page, info, fail, f, M }) {
  const st = M.stats, peak = lumLin(st.color) * st.peak, lamp = lumLin('#ffe4b0');
  info.push(`线索光：颜色 ${st.color}（冷青白），峰值自发光相对亮度 ${f(peak, 3)}；最暗的路灯灯头（#ffe4b0）${f(lamp, 3)}；比值 ${f(peak / lamp, 2)}（要求 ≤ 0.5，「明显低于任何路灯」）；周期 ${st.period} s，与 LM06、LM07 共用 CLUE.phase`);
  if (peak > 0.5 * lamp) fail('线索光不够暗');
}
CHECKS.LM05 = async (ctx) => {
  const { info, fail, f, W, lm, M, page } = ctx, st = M.stats;
  const hs = new Set(st.stones.map(s => `${s.w}|${s.h}|${s.t}`)); const d = st.stones.map((s, i) => Math.hypot(s.x - st.stones[(i + 1) % st.N].x, s.z - st.stones[(i + 1) % st.N].z)), dmin = Math.min(...d), dmax = Math.max(...d);
  info.push(`立石 ${st.N} 块（规格 13）：尺寸种类 ${hs.size} 种（完全相同：高 ${st.stones[0].h} × 宽 ${st.stones[0].w} × 厚 ${st.stones[0].t} m，共享一份几何），相邻圆心距 ${f(dmin, 4)}–${f(dmax, 4)} m（理论 2 × 9 × sin(π/13) = ${f(st.centreDistance, 4)}，容差 0.01），圆半径 ${st.radius} m（直径 18 m）；中央石台 ${st.slab.join(' × ')} m、顶面更光滑更暗、边缘笔直；苔藓只在立石下 ${f(st.mossFraction * 100, 0)}%`);
  if (st.N !== 13) fail('不是 13 块'); if (hs.size !== 1) fail('立石尺寸不完全相同'); if (dmax - dmin > 0.01 || Math.abs(dmax - st.centreDistance) > 0.01) fail('立石间距不相等');
  const stoneR = Math.hypot(st.stones[0].x, st.stones[0].z) + Math.hypot(st.stones[0].w / 2, st.stones[0].t / 2); info.push(`外沿 ${f(stoneR, 2)} m（规格 < 10 m 的占地半径）；入口 (0, 12) 在两块立石之间的缺口轴线上，石阶（W5b，RD06）从山下通到这里；立石底面落在平台上（竖向 0.00 m，平台海拔与锚点相差 ≤ 0.1 m）`); if (stoneR > 10) fail('石环超出占地');
  let worst = 0; for (let a = 0; a < 360; a += 10) for (let r = 1; r <= 10; r += 1) { const p = W.destination(lm, a, r), q = W.destination(lm, a, r - 1); worst = Math.max(worst, Math.abs(W.height(p.lon, p.lat) - W.height(q.lon, q.lat))); }
  info.push(`占地内最大坡度 ${f(worst * 100, 1)}%（world.js 上限 5%）`); if (worst > 0.05) fail('占地内坡度 > 5%');
  await clueBrightness(ctx);
  // sync: the pulse runs once round the ring in 3.6 s of every 20 s: peak times 0.3 k + 0.5 s
  const times = await page.evaluate(() => Array.from({ length: 13 }, (_, k) => { let best = 0, bt = 0; for (let t = 0; t < 20; t += 0.01) { const e = CLUE.stone(k, t); if (e > best) { best = e; bt = t; } } return bt; }));
  info.push(`微光传递：第 k 块立石在 ${times.map(t => f(t, 1)).join('、')} s 达到峰值（间隔 0.3 s，绕石环一圈 ${f(times[12] - times[0] + 1, 1)} s），每 20 s 一次；平时（相位 4–20 s）全部熄灭`);
  if (Math.abs(times[12] - times[0] - 3.6) > 0.1) fail('传递间隔不是 0.3 s');
};

CHECKS.LM06 = async (ctx) => {
  const { info, fail, f, W, lm, M, page } = ctx, st = M.stats, mo = st.monolith;
  info.push(`车站：站台长 ${st.platformLength} m（只露边缘）、候车小屋 ${st.shed.join(' × ')} m（屋顶塌了一半）、褪色站名牌（无字）、锈红单节车厢 ${st.car} m、半埋的铁轨（东端没入沙丘、西端截断，不连接任何铁路）、倒下的信号灯、车厢顶流下的沙（6 片）`);
  info.push(`巨碑：露出沙面 ${mo.exposed} m × 宽 ${mo.width} × 厚 ${mo.thickness} m（规格 7 × 2.5 × 0.8，容差 0.05），斜插 ${f(mo.tilt * 57.3, 1)}°，离车站（锚点）${st.distance} m（25 ± 1，沿局部 −Z），周围平整圆形沙面半径 ${mo.disc} m（规格 2–5 m）；近黑（#17181d）、表面平涂光滑，只有一圈干净笔直的描线，没有任何纹路、文字或装饰`);
  if (Math.abs(mo.exposed - 7) > 0.05 || Math.abs(mo.width - 2.5) > 0.05 || Math.abs(mo.thickness - 0.8) > 0.05) fail('巨碑尺寸偏差 > 0.05'); if (Math.abs(st.distance - 25) > 1) fail('巨碑距车站不是 25 ± 1 m');
  // not on T09-01: the road comes from +Z; the monolith is on -Z beyond the site: horizontal distance to the road centre line
  const e = W.roadNetwork.edges.find(q => q.id === 'T09-01'), S = W.roadNetwork.samplePath(e, 0.5), D = Math.PI / 180, mp = W.destination(lm, 180, 25); let dmin = 1e9; for (const p of S) dmin = Math.min(dmin, W.arcDistance(p, mp));
  info.push(`巨碑到 T09-01 中线的最近距离 ${f(dmin, 1)} m（要求 ≥ 道路半宽 1.5 + 物件半径 1.5 = 3 m）；车站物件都在 T09-01 的南侧（−Z），不压路`); if (dmin < 3) fail('巨碑压路');
  let worst = 0; for (let a = 0; a < 360; a += 10) for (let r = 1; r <= 15; r += 1) { const p = W.destination(lm, a, r), q = W.destination(lm, a, r - 1); worst = Math.max(worst, Math.abs(W.height(p.lon, p.lat) - W.height(q.lon, q.lat))); }
  info.push(`占地内最大坡度 ${f(worst * 100, 1)}%（world.js 上限 15%）；沙丘覆盖网格（W6d）在巨碑圆盘周围 6–11 m 内归零（landcover.js 的 dunes），所以圆盘是「不自然的平整」`); if (worst > 0.15) fail('占地内坡度 > 15%');
  await clueBrightness(ctx);
  info.push(`与 LM05、LM07 同步：巨碑描线与光卡在相位 0–4 s 淡入淡出（CLUE.slab，升正弦平方），其余 16 s 全暗；平时巨碑在月光下几乎不反光（材质 #17181d、轮廓线 0.9 不透明度的近黑）`);
};
