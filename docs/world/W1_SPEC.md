# W1 精确规格：星球布局数据与勘探

状态：生效，供 [WORLD_AGENT_START.md](WORLD_AGENT_START.md) 的 W1 一轮使用。W1 是单批次交付，本文给出数据结构、算法、阈值、输出文件和停止条件，Agent 不需要再就这些问题请示。与 [WORLD_PLAN.md](../../WORLD_PLAN.md)、[WORLD_SPEC.md](WORLD_SPEC.md)、设计卡冲突时，以 WORLD_PLAN 与 WORLD_SPEC 为准，在对应卡上最小修正并记录。

## 1. 范围

- 新建：`world.js`、`tools/world_check.mjs`、`tools/world_survey.mjs`（出图）、`docs/world/survey/`、`docs/world/WORLD_LAYOUT_V1.md`。
- 不改：`scene.js`、`layout.js`、`build.py`、`index.html`、`buildings/`。`world.js` 不进入页面嵌入列表。
- 纯数据和检查，不做三维渲染。勘探图用 SVG/Canvas 绘制后由现有浏览器工具（`tools/browser.mjs`）转 PNG，与 `layout_check` 出图方式一致。

## 2. 约定

| 项 | 约定 |
| --- | --- |
| 角度 | 度；经度 (−180, 180]，东为正；纬度 [−90, 90]，北为正 |
| 半径与长度 | R = 90；弧长 = R × 弧度；所有「米」都是 R = 90 的球面上的米 |
| 高度 | 相对海平面（0）的米；城镇底面 1.6；海洋为负 |
| 城镇映射 | 经度 = x/R（弧度），纬度 = −gd(z/R)，gd(t) = atan(sinh t)；城镇补丁为经度 ±30.57°、纬度 ±29.15°的矩形。局部 −Z 为北 |
| 城镇出口 | 取自 `require('./layout.js')` 的 `roadNodes`（N01、N03、N04、N08、N09、N10、N11、N12、N13），**不抄坐标**，由映射算出经纬度 |
| 随机 | 不使用 `Math.random`；需要噪声时用固定种子的确定性函数，种子写在 `world.js` 导出里 |
| 导出写法 | 与 `layout.js` 相同：IIFE，`module.exports` / `global.WORLD`，无 THREE、无 DOM |

## 3. world.js 导出结构

必须导出下列键，字段名固定，便于后续阶段直接读取：

- `R`、`SEED`、`TOWN_BASE_HEIGHT`（1.6）、`TOWN_PATCH`（`{lonMin, lonMax, latMin, latMax}`，由映射算出）。
- 工具函数：`townToLonLat(x, z)`、`lonLatToTown(lon, lat)`、`arcDistance(a, b)`（米）、`bearing(a, b)`（相对正北顺时针，度）、`greatCirclePoints(a, b, stepMeters)`、`crossTrack(point, circleA, circleB)`（度）。
- `regions`：区域列表，每项 `{id, zone, kind, shape, priority}`。
  - `zone` ∈ `building | ocean | wild | ice`（对应面积预算四类）；
  - `kind` 为细分，如 `town`、`farmland`、`village`、`ruin`、`east-strait`、`back-ocean`、`west-sea`、`forest`、`grassland`、`desert`、`lava`、`ice-north`、`ice-south`；
  - `shape` 是 `{type:'cap', center, radiusMeters}`、`{type:'polygon', ring:[[lon,lat],…]}`（边为大圆弧）或 `{type:'lat-band', edge(lon)}`（冰盖，边界纬度随经度变化）；
  - 按 `priority` 从高到低判定，未命中任何区域的点归 `wild` 的 `grassland`。
- `regionAt(lon, lat)` → 区域对象。
- `heightField`：`{base: {zone→米}, features:[{id, type, …}], noise:{amp, scale}}` 与 `height(lon, lat)`。
  - `type` 取 `peak`（中心、半径、峰高、剖面指数）、`ridge`（折线、宽度、高度）、`plain`（城镇平缓带）、`basin`（海盆深度）；
  - 高度尺度见 WORLD_PLAN 第 4 节（丘陵 3–8，山脉 15–22，雨见岳 26 且为最高点，浅海 −0.5 至 −2，深海 −6）；
  - 城镇补丁内恒为 `TOWN_BASE_HEIGHT`。
- `rivers`：`[{id, points:[[lon,lat]…], width}]`，下游方向为点序方向；`riverCrossing(lon, lat)` → 距最近河流的距离减半宽（≤0 为在水中）。
- `landmarks`：TOWN 与 LM01–LM10，每项 `{id, name, lon, lat, heading, baseHeight, zone, kind, entrance:{lon, lat}, card}`。
  - 初稿经纬度取 WORLD_PLAN 第 7 节；LM05 取 33.0°N 126.9°W，使其到经过 LM06、LM07 的大圆距离 ≤ 0.5°（已验证初稿值偏差约 0.02°）；
  - `heading` 为入口朝向；`entrance` 为路网接入点；
  - `baseHeight` 必须等于该点 `height()` 的值（四舍五入到 0.1）。
- `roadNetwork`：
  - `nodes`：`[{id, lon, lat, kind}]`，kind ∈ `town-exit | junction | landmark-entrance | endpoint`；
  - `edges`：`[{id, route, class, controls:[[lon,lat]…], spans:[{type:'bridge'|'tunnel'|'boardwalk', fromMeters, toMeters}]}]`；`class` 为 `RD01`…`RD08`，`route` 为 T01…T11；
  - `samplePath(edge, stepMeters)` → 沿大圆连接控制点的采样点（含高度、里程）。
- `areaBudget`：`computeAreaShares(gridDeg)` → `{zone: share, kind: share}`，按 cos(纬度) 加权的纬经网格积分，默认 0.25°。

## 4. 检查（tools/world_check.mjs）

输出 `PASS/FAIL WCn 说明`，与 `layout_check` 风格一致；失败退出码 1。WC12–WC14 打印 `PENDING 待 W2/W8`，不计失败。

| 编号 | 算法与阈值 |
| --- | --- |
| WC1 | `computeAreaShares(0.25)`：建筑带 30%、海洋 30%、荒野 32%、冰盖 8%，各 ±2 个百分点。同时给出细分占比（城镇按真实映射约 8.3%，WORLD_PLAN 写的「约 9%」在容差内；其余细分以第 5 节为参考，只报告不判失败）。另验证海洋至少 3 个互不连通的片，各自面积 ≥ 3% |
| WC2 | 四个视图中心 (0°,0°)、(0°,90°E)、(0°,180°)、(0°,90°W)；半径 90° 内、按投影面积（cos(纬度) × cos(到视图中心的角距)）加权，`building`、`ocean`、`wild` 各 ≥ 15%；冰盖不计入要求但报告 |
| WC3 | 路网图连通；城镇 9 个出口节点各有至少一条边；10 个目的地都能由 TOWN 经边到达 |
| WC4 | 每条边按 1 m 弧长采样，用 5 m 窗口平均坡度（|Δh| / 弧长）。上限：RD01 6%、RD03 10%、RD05 15%、RD06 可超过 15%（须是石阶 span 或坡度 ≤ 卡片上限）。RD02/RD04/RD07/RD08 的上限从各自设计卡读取；卡上没有数字的，采用 RD05 的 15% 并在 WORLD_LAYOUT_V1.md 记录 |
| WC5 | 采样点高度 < 0（水中）或 `riverCrossing ≤ 0` 的位置，必须落在 `bridge` 或 `boardwalk` span 内（RD02 / RD07 等级） |
| WC6 | 任何采样点不得落入地标 `exclusion` 半径（卡片「尺度」一节给出占地；未给出时用 `entrance` 之外 30 m 为默认，记录）。只允许在 `entrance` 处接入；不得压入城镇补丁（只能从 9 个出口进入） |
| WC7 | 城镇补丁外缘 15 m（球面距离）内：任意点 \|height − 1.6\| ≤ 0.05 × 距补丁边界 + 0.05；任意相邻 1 m 网格坡度 ≤ 5% |
| WC8 | 三个街道视点（局部坐标 (0,−48) N04、(0,−33.5) N05、(0,−15) N06，眼高 1.6）。对每个视点：沿到雨见岳山顶的大圆每 1 m 取中间点，视线仰角用 α(s) = atan2((R+H(s))·cos(s/R) − (R+h₀), (R+H(s))·sin(s/R))（h₀ 为视点高度加 1.6）；要求山顶 α 大于所有中间点 α 至少 0.1°。初稿估算：三点到山顶弧距约 40.5、50.9、66.4 m，在 85.4 m 的地平线+山高极限内 |
| WC9 | 每条河沿点序高度非递增（允许 ≤ 0.05 m 噪声），终点在 `height ≤ 0` 的海洋中；河不穿过城镇补丁 |
| WC10 | 每个地标锚点：区域与设计卡「区域与位置」一致；`baseHeight` 与 `height()` 一致；坡度、高度满足卡片「尺度」一节；任意两个地标锚点距离 ≥ 两者占地半径之和 |
| WC11 | LM05、LM06、LM07 三点共圆：LM05 到 LM06–LM07 大圆的 `crossTrack` ≤ 0.5° |

## 5. 区域与目的地的设计默认值（可在检查通过的前提下调整）

- 建筑带必须拆成城镇加外围聚落，否则背面没有建筑（WORLD_PLAN 第 11 节验证结论）：本洲（城镇、温泉村 LM02、田地）、东洲（LM03、LM10）、西洲（LM05、LM06）、再加至少一处位于背面偏南的聚落（LM04 区域或 LM09 一带的田地），确保 WC2 的四个方向都 ≥ 15%。
- 海洋至少三片：东海峡（本洲与东洲之间，窄）、背面大洋（含 LM08 小岛）、西海。
- 冰盖：|纬度| ≳ 67° 的两片，边界不规则；总计 8%。
- 河流：从雨见岳向南流，绕城镇西侧，在南岸入海；城镇排水出口可接入，但不进入城镇补丁。
- 路网：T01–T11 按 WORLD_PLAN 第 8 节；每个目的地都在路网上；荒野道路最少。手工给控制点，用检查迭代，不实现自动寻路。

## 6. 输出

- `docs/world/survey/`：
  - `equirect.png`（等距圆柱全图，1920×960，叠加区域、等高线、河流、路网、地标标注、经纬网）；
  - `view-front.png`、`view-east.png`、`view-back.png`、`view-west.png`（正射半球，1024×1024，圆盘边界清晰）；
  - `view-north.png`、`view-south.png`（极视图）；
  - `area-report.md`（WC1 的全部数字、WC2 的四方向占比、细分表）；
  - `check-report.md`（`world_check.mjs` 完整输出）。
- `docs/world/WORLD_LAYOUT_V1.md`：冻结内容清单、每个目的地的最终经纬度表、路网路线表、各检查的数值、与初稿相比的所有调整及理由、WC12–WC14 待办说明。
- **逐张查看全部 PNG**，在 PROGRESS 记录看到的问题（标注重叠、路线穿地标、区域边界锯齿等），并修正后重新生成。

## 7. 验收

1. `node tools/world_check.mjs` 退出码 0，WC1–WC11 全 PASS，WC12–WC14 PENDING。
2. `node docs/world/check_kit.mjs --refs` 仍通过；`git status` 中没有 `scene.js`、`layout.js`、`build.py`、`index.html`、`buildings/` 的改动。
3. `world.js` 重复运行输出完全一致（确定性）。
4. ROADMAP 的 W1 行改为 `待确认`；最后回复按统一格式，并列出需要用户重点看的三处（区域分布、路网走向、隐藏线索共圆）。

## 8. 停止条件

- 某项检查在合理调整后仍无法通过且需要改 WORLD_PLAN 的决策（D1–D9）：停下报告，不自行改决策。
- 设计卡之间互相矛盾且 WORLD_PLAN 未裁决：记录两种方案和建议，选建议方案继续，在 WORLD_LAYOUT_V1.md 标明。
- 需要改动 `layout.js` 才能接入某个出口：停下报告。
