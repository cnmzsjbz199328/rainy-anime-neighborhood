# 星球布局 v1（W1 冻结清单）

状态：W1 已交付，**待用户确认后冻结**（2026-10-06）。确认之前这些数据仍可在 W1 返工里调整；确认之后，只有缺陷、阻塞或用户决定才能改，且必须在本文第 10 节追加原因（ROADMAP 第 4 节第 4 条）。

数据的唯一来源是仓库根目录的 [world.js](../../world.js)；检查在 [tools/world_check.mjs](../../tools/world_check.mjs)；勘探图在 [survey/](survey/)。本文只列出冻结的内容、最终坐标、检查数值、与初稿相比的全部调整及理由。与 [WORLD_PLAN.md](../../WORLD_PLAN.md) 第 7、8 节的初稿不一致处，以本文和 world.js 为准。

## 1. 冻结的内容与文件

| 项 | 路径 | 说明 |
| --- | --- | --- |
| 星球数据 | [world.js](../../world.js) | 区域、高度骨架、河流、地标、路网、面积预算与工具函数；无 THREE、无 DOM、无 `Math.random`（种子 `SEED = 20261006` 写在导出里）；不进入页面嵌入列表，`build.py` 与 `index.html` 未改 |
| 检查 | [tools/world_check.mjs](../../tools/world_check.mjs) | WC1–WC11 通过，WC12–WC14 打印 PENDING；`--write` 同时写 survey 下的两份报告 |
| 勘探图 | [tools/world_survey.mjs](../../tools/world_survey.mjs) | 在 Chromium 中用 Canvas 绘制并保存 PNG |
| 输出 | [survey/](survey/) | `equirect.png`、`view-front/east/back/west/north/south.png`、`area-report.md`、`check-report.md` |
| 城镇 | `layout.js`、[LAYOUT_V1.md](../layout/LAYOUT_V1.md) | **未改**；城镇出口坐标由 `layout.js` 的 `roadNodes` 经 Mercator 映射算出，没有抄写 |

复现：`node tools/world_check.mjs --write`（约 3 秒，输出逐字节一致）；`node tools/world_survey.mjs`（约 6 秒，需要 Playwright 与 Chromium）。

### world.js 的导出

`R`、`SEED`、`TOWN_BASE_HEIGHT`、`TOWN_PATCH`；`townToLonLat`、`lonLatToTown`、`arcDistance`、`bearing`、`greatCirclePoints`、`crossTrack`、`destination`；`regions`、`regionAt`、`zoneRaster`；`heightField`、`height(lon, lat)`、`coastDistance`、`townPatchDistance`、`insideTownPatch`；`rivers`、`riverCrossing`；`landmarks`；`roadNetwork`（`nodes`、`edges`、`samplePath(edge, stepMeters)`、`edgeLength`）；`areaBudget`、`computeAreaShares(gridDeg)`。字段名与 [W1_SPEC](W1_SPEC.md) 第 3 节一致；新增的字段与取值见第 2 节。

## 2. 约定与 W1 的口径裁决

约定沿用 W1_SPEC 第 2 节：经度 (−180, 180] 东为正，纬度北为正，R = 90 m（1° ≈ 1.5708 m），城镇底面 1.6 m，城镇映射 经度 = x/R、纬度 = −gd(z/R)。城镇补丁为经度 ±30.558°、纬度 ±29.204°的矩形（Mercator 下恰好是 96 × 96）。

W1 实施中做的口径裁决（W1_SPEC 与卡片没有写死数字或互相不一致处；按「最小修正并记录」处理）：

1. **锚点与入口**：WORLD_SPEC 写「地标局部坐标原点在主入口」，W1_SPEC 同时要求 `lon/lat` 与 `entrance`。裁决：`lon/lat` 是**场地锚点**（场地中心，隐藏线索共圆按场地锚点），`entrance` 是路网接入点，沿 `heading` 偏离锚点 `offset` 米。W7 每个地标开工时再决定局部原点放在锚点还是入口，换算用 `entrance` 相对锚点的偏移。地标多于一个接入点时登记 `entrances[]`（LM01、LM02 各两个），`entrance` 取第一个。
2. **占地半径**：取设计卡「尺度」一节的场地半径，LM01 取火山口与山顶局部模型范围（8 m），不取 60 m 山脚直径——山脚是地形的一部分，不是局部模型。WC6、WC10 都按这个半径。
3. **地标 zone**：LM08 灯塔岛是海中小岛，登记为 `zone: 'wild'`、`kind: 'island'`（0.31%），不占海洋份额。
4. **span 类型**：W1_SPEC 写 `bridge | tunnel | boardwalk`。RD06 的石阶需要免坡度限制，新增 `stairs`；WC4 对石阶单独设上限 60%（踏步高 0.17 / 踏面 0.28）。河上的小桥（T01 以外）本阶段没有，WC5 对桥的等级不限。
5. **坡度上限**：RD02、RD04、RD07、RD08 的卡片没有坡度数字，采用 RD05 的 15%；RD06 非石阶段 15%；RD01 6%、RD03 10%、RD05 15% 按 WORLD_PLAN。桥、隧道、栈道、石阶的窗口不按地形坡度计，但隧道两端口的高差坡度必须 ≤ 该等级上限。
6. **区域形状**：W1_SPEC 列了 `cap`、`polygon`、`lat-band`；城镇补丁是经纬度矩形，新增 `lonlat-rect`。多边形的边按大圆弧加密后用经纬度平面做点在多边形内判定（多边形不含极点，极区由 `lat-band` 承担）。
7. **WC8 的比较方式**：W1_SPEC 要求「山顶 α 大于所有中间点 α 至少 0.1°」。平顶山体靠近视点的点仰角必然大于山顶中心，字面执行永远不成立。裁决：以雨见岳山体范围（半径 30 m）**之外**的中间点作比较，要求天际线最高点位于山顶 10% 高度之内（≥ 23.4 m），并增加一条：山顶要高出视点的球面地平线（视点高 3.2 m 时地平线在水平线下 15.06°）至少 0.1°。
8. **RD02 桥长**：卡片「桥长 30–100 m」按单段理解。跨洋大桥分为多段（中间节点 `J-P1` 是分段点），每段 42–96 m。桥台一律设在海岸向内 ≥ 14 m（滩坡宽度）处，因为滩坡最陡约 21%，超过 RD01 的 6%，桥 span 把滩坡一并含在内。
9. **T01 的纬度**：初稿写「大致沿 10°S」。取城镇 R01 中心线的纬度 9.51°S（出口 N01、N03 的纬度），洲上为避开山脊与海岸局部取 12°S。

### 高度与地形的构成

| 部分 | 取值 |
| --- | --- |
| 区域基准高度 | 建筑 1.9 m、荒野 2.1 m、冰盖 2.5 m；按 0.5° 网格归一化盒式模糊两遍（半径 6 格 ≈ 4.7 m），避免区域边界出现台阶 |
| 海岸 | 到海岸的有符号距离取自 0.5° 栅格的陆/水边界；陆地高度 = 滩坡 smoothstep(0, 14 m) × (基准 + 山 + 噪声)；海洋深度 = 深度 × smoothstep(0, 24 m)，东海峡 2 m、西海 3 m、背面大洋 6 m |
| 噪声 | 单位球面上的 3D 值噪声两层：0.06 m @ 32 m、0.02 m @ 14 m；雨见岳山顶平台内为 0，保证它是唯一最高点 |
| 山与脊 | 取最大值而不是求和，山脊并入山体不会叠高；钟形剖面 0.5(1+cos πu)^sharp |
| 地标平台 | 占地内按锚点处的地形高度压平（半径 = 占地半径，外延 10 m 过渡）：LM02、LM03、LM04、LM05、LM06、LM09 |
| 河流 | 河床 = min(地形 − 0.35 m, 上游河床)，沿点序非递增；谷宽 = 河宽/2 + 5 m |
| 城镇平缓带 | 补丁内恒为 1.6 m；补丁外 24 m 内按 smoothstep 过渡到周围地形（TR01 卡写 10–20 m，取 24 m 以满足 WC7 的 5% 坡度） |

#### 山、脊、丘

| id | 类型 | 位置 | 尺寸 |
| --- | --- | --- | --- |
| ameni-dake | peak | 56.00°N 25.00°W | 半径 28 m，山顶 26 m（绝对），平顶 15% 半径，sharp 1.6 |
| hill-lm05 | peak | 33.00°N 126.90°W | 半径 22 m，隆起 6 m，平顶 45% 半径，sharp 1 |
| hill-terraces-ameni | peak | 50.00°N 4.00°W | 半径 12 m，隆起 5 m，平顶 0% 半径，sharp 1 |
| hill-south-forest | peak | 50.00°S 22.00°E | 半径 14 m，隆起 5 m，平顶 0% 半径，sharp 1 |
| mesa-desert | peak | 46.00°S 132.00°W | 半径 12 m，隆起 7 m，平顶 30% 半径，sharp 1 |
| ridge-ameni-west | ridge | (60, -44) → (62, -52) → (64, -58)（纬度, 经度） | 半宽 14 m，高 17 m，sharp 1.3 |
| ridge-east-spine | ridge | (-56, 100) → (-40, 100) → (-27, 100) → (-14, 95) → (-4, 90) → (8, 89) → (24, 89) → (40, 91) → (54, 89)（纬度, 经度） | 半宽 9 m，高 18 m，sharp 1.3 |
| ridge-west-spine | ridge | (22, -140) → (36, -141) → (50, -139)（纬度, 经度） | 半宽 10 m，高 14 m，sharp 1.3 |
| ridge-back-north | ridge | (60, 152) → (62, 172) → (60, 192)（纬度, 经度） | 半宽 12 m，高 16 m，sharp 1.3 |
| ridge-back-south | ridge | (-52, 150) → (-55, 172) → (-54, 196)（纬度, 经度） | 半宽 10 m，高 12 m，sharp 1.3 |

全球最高点是雨见岳山顶 26.00 m；其余山脊最高 20.1 m（山脉 15–22 m）；丘陵 5–7 m；城镇建筑 3–14 m 不在此列。

## 3. 区域（25 个 + 默认草原）

按 priority 从高到低判定，未命中任何区域的点是 wild/grassland（默认草原）。形状摘要；顶点坐标在 world.js 的 `regions`。

| id | zone / kind | priority | 形状 | 占球面 |
| --- | --- | --- | --- | --- |
| ice-north | ice / ice-north | 100 | lat-band：北极，边界纬度 66.6° ± 波动（约 62.9°–70.3°） | 4.13% |
| ice-south | ice / ice-south | 100 | lat-band：南极，边界纬度 66.6° ± 波动（约 62.9°–70.3°） | 4.13% |
| east-strait | ocean / east-strait | 80 | polygon：28 个顶点 | 4.25% |
| west-sea | ocean / west-sea | 80 | polygon：36 个顶点 | 11.28% |
| back-ocean | ocean / back-ocean | 80 | polygon：27 个顶点 | 15.42% |
| island-lm08 | wild / island | 95 | cap：中心 8.00°S 170.00°W，半径 10 m | 0.31% |
| town | building / town | 90 | lonlat-rect：城镇补丁 | 8.28% |
| farmland-main | building / farmland | 40 | polygon：24 个顶点 | 8.49% |
| farmland-east | building / farmland | 40 | polygon：10 个顶点 | 2.17% |
| farmland-west | building / farmland | 40 | polygon：8 个顶点 | 1.46% |
| hamlets-back-south | building / village | 40 | polygon：8 个顶点 | 1.71% |
| hamlets-back-north | building / village | 40 | polygon：8 个顶点 | 1.02% |
| farmland-west-coast | building / farmland | 40 | polygon：7 个顶点 | 2.39% |
| village-lm02 | building / village | 60 | cap：中心 36.00°N 50.00°W，半径 17 m | 0.89% |
| ruin-lm03 | building / ruin | 60 | cap：中心 27.00°S 86.00°E，半径 14 m | 0.60% |
| ruin-lm04 | building / ruin | 60 | cap：中心 42.00°S 15.00°W，半径 15 m | 0.69% |
| ruin-lm05 | building / ruin | 60 | cap：中心 33.00°N 126.90°W，半径 13 m | 0.52% |
| ruin-lm06 | building / ruin | 60 | cap：中心 32.00°S 115.00°W，半径 16 m | 0.79% |
| village-lm10 | building / village | 60 | cap：中心 5.00°N 106.00°E，半径 20 m | 1.12% |
| forest-south | wild / forest | 30 | polygon：15 个顶点 | 1.04% |
| forest-northeast | wild / forest | 30 | polygon：6 个顶点 | 0.69% |
| forest-east | wild / forest | 30 | polygon：8 个顶点 | 3.97% |
| forest-west | wild / forest | 30 | polygon：7 个顶点 | 1.38% |
| desert-west | wild / desert | 30 | polygon：6 个顶点 | 2.72% |
| lava-north | wild / lava | 30 | cap：中心 61.00°N 28.00°W，半径 22 m | 1.10% |
| default-grassland | wild / grassland | 0 | 其余全部 | 19.44% |

面积（0.25° 网格，cos 纬度加权）：建筑 30.13%、海洋 30.96%、荒野 30.65%、冰盖 8.26%（目标 30 / 30 / 32 / 8，±2 个百分点）。城镇 8.28%（真实映射，WORLD_PLAN 写「约 9%」在容差内）。细分与分片见 [survey/area-report.md](survey/area-report.md)。

建筑带拆成城镇、本洲郊外农田、东洲农田与村落、西洲农田与遗迹、背面南北两处聚落（WORLD_PLAN 第 11 节的验证结论：只有一块建筑带时背面完全没有建筑）。海洋是互不连通的三片：东海峡、西海（含本洲南面的海湾）、背面大洋。

## 4. 目的地（地标）

| ID | 名称 | 锚点 | 区域（zone / region） | 底面高度 | 占地半径 | 入口（朝向、距锚点、位置） |
| --- | --- | --- | --- | --- | --- | --- |
| TOWN | 雨音街角 | 0.00°N 0.00°E | building / town | 1.6 m | 48 m | 城镇 9 个出口 |
| LM01 | 雨见岳 | 56.00°N 25.00°W | wild / lava-north | 26 m | 8 m | west（300°，10 m：58.75°N 35.67°W）；north（15°，27.5 m：72.39°N 10.09°W） |
| LM02 | 湯けむり温泉村 | 36.00°N 50.00°W | building / village-lm02 | 1.9 m | 15 m | east（100°，17 m：33.43°N 37.20°W）；northeast（41°，17 m：43.79°N 40.18°W） |
| LM03 | 苔石古坟群 | 27.00°S 86.00°E | building / ruin-lm03 | 1.9 m | 12 m | north（0°，14 m：18.09°S 86.00°E） |
| LM04 | 森中废神社 | 42.00°S 15.00°W | building / ruin-lm04 | 1.9 m | 15 m | southeast（120°，17 m：46.64°S 1.30°W） |
| LM05 | 星见石环 | 33.00°N 126.90°W | building / ruin-lm05 | 7.9 m | 10 m | west（300°，12 m：36.55°N 135.14°W） |
| LM06 | 砂没驿 | 32.00°S 115.00°W | building / ruin-lm06 | 1.9 m | 15 m | north（0°，17 m：21.18°S 115.00°W） |
| LM07 | 冰封轮廓 | 76.00°N 100.00°E | ice / ice-north | 2.5 m | 8 m | west（280°，10 m：75.69°N 73.78°E） |
| LM08 | 灯塔岛 | 8.00°S 170.00°W | wild / island-lm08 | 1.5 m | 8 m | south（180°，9.5 m：14.05°S 170.00°W） |
| LM09 | 乡间无人站 | 18.00°S 40.00°W | building / farmland-main | 1.8 m | 10 m | north（0°，13.35 m：9.50°S 40.00°W） |
| LM10 | 小渔港 | 5.00°N 106.00°E | building / village-lm10 | 1.7 m | 17 m | south（180°，22.78 m：9.50°S 106.00°E） |

`baseHeight` 由 `height()` 在锚点处算出（四舍五入到 0.1 m），WC10 复核。LM05、LM06、LM07 的共圆偏差见第 8 节。

## 5. 河流

| 河流 | 宽 | 源头 → 河口 | 说明 |
| --- | --- | --- | --- |
| ameni-gawa | 3 m | 24.00°N 49.00°W → 58.00°S 45.00°W | 从温泉村东南的泉水出发向南，绕城镇西侧，在本洲南面海湾入海；不进入城镇补丁；城镇排水出口可接入 |
| east-river | 2.5 m | 24.00°N 92.00°E → 33.00°N 130.00°E | 东洲山脊东坡 → 背面大洋 |
| west-river | 2.5 m | 42.00°N 139.00°W → 40.00°N 155.00°W | 西洲山脊 → 背面大洋 |

## 6. 全球路网

节点 40 个、边 32 条，总长 951 m。手工给控制点，用检查迭代，没有自动寻路。边按等级拆分，水上的边整条是桥或栈道；T01 的陆上段是 RD01。

### 路线

| 路线 | 实际走向 | 等级 |
| --- | --- | --- |
| T01 环球主干道 | N03 → 东海峡大桥 → 东洲（隧道穿过山脊）→ LM10 港口后方 → 跨洋大桥（两段，经 LM08 灯塔岛南侧，岛上有码头栈道）→ 西洲 → 西海大桥 → 本洲，经河上桥台 → LM09 → N01 | RD01、RD02 |
| T02 | N04 → 农田 → LM02 温泉村东口；LM02 东北口 → 石阶山径绕雨见岳一圈（86 m）→ LM01 火山口 | RD03、RD06 |
| T03 | N08 → 郊外 → 废弃道路 → 森林土路 → LM04 废神社 | RD03、RD04、RD05 |
| T04 | N10 → 东侧农田 → T01 | RD03 |
| T05 | N09 → 河边农田 → LM09 | RD03 |
| T06 | N11、N12、N13 → 各 7–10 m 的田间土路，在田边结束 | RD05 |
| T07 | T01（东洲）→ LM03 古坟群 | RD05 |
| T08 | T01（西洲）→ 林道 → 石阶绕小山丘一圈 → LM05 星见石环 | RD05、RD06 |
| T09 | T01（西洲）→ 沙漠 → LM06 砂没驿 | RD05 |
| T10 | LM01 北山脚（冰上）→ 北冰原 → LM07 | RD08 |
| T11 | LM04 → 南岸木栈道（向东沿岸）；T01 桥上 → LM08 码头 | RD05 → RD07 |

### 边

| 边 | 路线 | 等级 | 起点 → 终点 | 长度 | span |
| --- | --- | --- | --- | --- | --- |
| T01-01 | T01 | RD01 | N03 → J-T04 | 12.3 m | — |
| T01-02 | T01 | RD01 | J-T04 → J-E1 | 7.4 m | — |
| T01-03 | T01 | RD02 | J-E1 → J-E2 | 55.6 m | bridge 0.0–55.6 m |
| T01-04 | T01 | RD01 | J-E2 → J-T07 | 2.8 m | — |
| T01-05 | T01 | RD01 | J-T07 → LM10-south | 38.7 m | tunnel 6.5–29.5 m |
| T01-06 | T01 | RD01 | LM10-south → J-E3 | 16.9 m | — |
| T01-07 | T01 | RD02 | J-E3 → J-P1 | 53.0 m | bridge 0.0–53.0 m |
| T01-08 | T01 | RD02 | J-P1 → J-LM08 | 59.0 m | bridge 0.0–59.0 m |
| T01-09 | T01 | RD02 | J-LM08 → J-W3 | 42.0 m | bridge 0.0–42.0 m |
| T01-10 | T01 | RD01 | J-W3 → J-T08 | 22.9 m | — |
| T01-11 | T01 | RD01 | J-T08 → J-T09 | 18.4 m | — |
| T01-12 | T01 | RD01 | J-T09 → J-W2 | 11.1 m | — |
| T01-13 | T01 | RD02 | J-W2 → J-W1 | 95.8 m | bridge 0.0–95.8 m |
| T01-14 | T01 | RD01 | J-W1 → LM09-north | 10.5 m | — |
| T01-15 | T01 | RD01 | LM09-north → N01 | 14.6 m | — |
| T02-01 | T02 | RD03 | N04 → LM02-east | 50.2 m | — |
| T02-02 | T02 | RD06 | LM02-northeast → LM01-west | 85.9 m | stairs 0.0–85.9 m |
| T03-01 | T03 | RD03 | N08 → J-T03a | 6.1 m | — |
| T03-02 | T03 | RD04 | J-T03a → J-T03b | 9.5 m | — |
| T03-03 | T03 | RD05 | J-T03b → LM04-southeast | 12.6 m | — |
| T04-01 | T04 | RD03 | N10 → J-T04 | 34.6 m | — |
| T05-01 | T05 | RD03 | N09 → LM09-north | 33.3 m | — |
| T06-01 | T06 | RD05 | N11 → E-N11 | 10.5 m | — |
| T06-02 | T06 | RD05 | N12 → E-N12 | 7.4 m | — |
| T06-03 | T06 | RD05 | N13 → E-N13 | 7.4 m | — |
| T07-01 | T07 | RD05 | J-T07 → LM03-north | 15.5 m | — |
| T08-01 | T08 | RD05 | J-T08 → J-T08b | 42.4 m | — |
| T08-02 | T08 | RD06 | J-T08b → LM05-west | 84.8 m | stairs 0.0–84.8 m |
| T09-01 | T09 | RD05 | J-T09 → LM06-north | 14.5 m | — |
| T10-01 | T10 | RD08 | LM01-north → LM07-west | 33.5 m | — |
| T11-01 | T11 | RD07 | LM04-southeast → E-T11 | 36.2 m | boardwalk 0.0–36.2 m |
| T11-02 | T11 | RD07 | J-LM08 → LM08-south | 5.4 m | boardwalk 0.0–5.4 m |

### 节点

| 节点 | 类型 | 位置 |
| --- | --- | --- |
| N01 | town-exit | 9.51°S 30.56°W |
| N03 | town-exit | 9.51°S 30.56°E |
| N04 | town-exit | 29.20°N 0.00°E |
| N08 | town-exit | 29.20°S 0.00°E |
| N09 | town-exit | 9.51°N 30.56°W |
| N10 | town-exit | 9.51°N 30.56°E |
| N11 | town-exit | 20.11°S 30.56°W |
| N12 | town-exit | 20.11°S 30.56°E |
| N13 | town-exit | 20.85°N 30.56°E |
| J-T04 | junction | 9.51°S 38.50°E |
| J-E1 | junction | 9.51°S 43.30°E |
| J-E2 | junction | 9.51°S 79.20°E |
| J-T07 | junction | 9.51°S 81.00°E |
| J-E3 | junction | 9.51°S 116.90°E |
| J-P1 | junction | 14.50°S 151.00°E |
| J-LM08 | junction | 17.50°S 170.00°W |
| J-W3 | junction | 12.00°S 142.90°W |
| J-T08 | junction | 12.00°S 128.00°W |
| J-T09 | junction | 12.00°S 116.00°W |
| J-W2 | junction | 12.00°S 108.80°W |
| J-W1 | junction | 12.00°S 46.30°W |
| J-T03a | junction | 33.00°S 1.00°E |
| J-T03b | junction | 39.00°S 2.00°E |
| J-T08b | junction | 15.00°N 127.50°W |
| E-N11 | endpoint | 25.00°S 35.50°W |
| E-N12 | endpoint | 21.00°S 35.50°E |
| E-N13 | endpoint | 22.00°N 35.50°E |
| E-T11 | endpoint | 61.00°S 24.00°E |
| LM01-west | landmark-entrance（LM01） | 58.75°N 35.67°W |
| LM01-north | landmark-entrance（LM01） | 72.39°N 10.09°W |
| LM02-east | landmark-entrance（LM02） | 33.43°N 37.20°W |
| LM02-northeast | landmark-entrance（LM02） | 43.79°N 40.18°W |
| LM03-north | landmark-entrance（LM03） | 18.09°S 86.00°E |
| LM04-southeast | landmark-entrance（LM04） | 46.64°S 1.30°W |
| LM05-west | landmark-entrance（LM05） | 36.55°N 135.14°W |
| LM06-north | landmark-entrance（LM06） | 21.18°S 115.00°W |
| LM07-west | landmark-entrance（LM07） | 75.69°N 73.78°E |
| LM08-south | landmark-entrance（LM08） | 14.05°S 170.00°W |
| LM09-north | landmark-entrance（LM09） | 9.50°S 40.00°W |
| LM10-south | landmark-entrance（LM10） | 9.50°S 106.00°E |

城镇 9 个出口：N01、N03（R01 西、东端）、N04、N08（R02 北、南端）、N09、N10（R03 西、东端）、N11、N12、N13（A01、A02、A03 巷口）；出口位置由 `layout.js` 的 `roadNodes` 映射得到，没有任何改动。

桥与隧道：T01-03 东海峡大桥 55.6 m；T01-07、T01-08 跨洋大桥两段 53.0 m、59.0 m（含滩坡）；T01-09 灯塔岛至西洲 42.0 m；T01-13 西海大桥 95.8 m（桥下含 ameni-gawa 的入海口一带）；T01-05 隧道 23.0 m，穿过东洲山脊（脊高约 20 m）。栈道：T11-01（LM04 至南岸，36.2 m）、T11-02（LM08 码头，5.4 m）。

## 7. 勘探图

逐张查看过的 PNG（1920 × 960 与 1024 × 1024）：

- [survey/equirect.png](survey/equirect.png)：等距圆柱全图，叠加区域底色、山体阴影、等高线 5/10/15/20/25 m、海岸线、河流、路网（按等级着色，桥/栈道加粗，隧道虚线，石阶点线）、地标占地圆与标注、经纬网、图例。
- [view-front](survey/view-front.png)（0°, 0°）、[view-east](survey/view-east.png)（0°, 90°E）、[view-back](survey/view-back.png)（0°, 180°）、[view-west](survey/view-west.png)（0°, 90°W）：正射半球。
- [view-north](survey/view-north.png)、[view-south](survey/view-south.png)：极视图。
- 数字报告：[area-report.md](survey/area-report.md)、[check-report.md](survey/check-report.md)。

## 8. 检查数值

完整输出见 [survey/check-report.md](survey/check-report.md)。摘要：

| 检查 | 结果 | 关键数值 |
| --- | --- | --- |
| WC1 面积预算 | 通过 | 建筑 30.13%、海洋 30.96%、荒野 30.65%、冰盖 8.26%；海洋三片 11.28%、4.25%、15.42%，各 ≥ 3% |
| WC2 四向全景 | 通过 | 正面 建筑 60.7 / 海洋 15.9 / 荒野 20.7；东 26.7 / 29.4 / 41.0；背面 19.6 / 50.8 / 26.9；西 31.3 / 38.5 / 27.3（%，均 ≥ 15%；正面海洋余量最小） |
| WC3 连通 | 通过 | 40 节点、32 边、1 个连通分量；9 个出口各有接续；10 个目的地可达 |
| WC4 坡度 | 通过 | 陆上段最大坡度 RD01 2.55%（上限 6%）；石阶最大 45%（T02-02）、32%（T08-02）；隧道端口间坡度 0.66% |
| WC5 跨水 | 通过 | 水面采样点 247 个，全部在桥或栈道 span 内 |
| WC6 地标与城镇 | 通过 | 与地标占地圆最小间隙 1.5 m；无采样点进入城镇补丁 |
| WC7 城镇边缘 | 通过 | 7410 个点；max(\|h−1.6\| − 0.05d) = −0.042 m（须 ≤ 0.05）；最大坡度 4.59%（须 ≤ 5%） |
| WC8 街道视线 | 通过 | N04/N05/N06 到山顶 50.5 / 62.5 / 79.2 m；山顶高出球面地平线 23.7° / 15.1° / 5.4° |
| WC9 河流 | 通过 | 三条河最大回升 0.000 m，终点在海洋且高度 ≤ 0 |
| WC10 地标 | 通过 | 区域、底面高度、占地内坡度、互不重叠；全球最高点 26.00 m 在雨见岳，其余山脉最高 20.1 m |
| WC11 共圆 | 通过 | LM05 到 LM06–LM07 大圆偏差 −0.023°（≤ 0.5°） |
| WC12–WC14 | 待办 | 见第 10 节 |

## 9. 与初稿相比的调整及理由

W1_SPEC 第 5 节允许「在检查通过的前提下调整」设计默认值；以下是 WORLD_PLAN 第 6–8 节初稿与本冻结数据的全部差异。

| 项 | 初稿 | 冻结值 | 理由 |
| --- | --- | --- | --- |
| LM01 雨见岳 | 46°N 25°W | 56°N 25°W | WC7 要求城镇补丁外缘 15 m 内坡度 ≤ 5%、高度偏差 ≤ 0.05d + 0.05。按卡片山脚半径约 28 m，山裙在离山顶 ≥ 26 m 才平缓到 5% 以下，再加 15 m 带宽，山顶需离补丁北缘 ≥ 约 42 m。山顶仍可从三个街道视点越过地平线（WC8：50.5 / 62.5 / 79.2 m，地平线加山高极限 92 m）；初稿估算的 40.5 / 50.9 / 66.4 m 对应旧位置。山顶北侧山裙落入北冰盖，熔岩原压缩到山体北坡下部 |
| LM02 温泉村 | 38°N 36°W | 36°N 50°W | 村落要一块 30 m 的平地，山顶到村落中心 41.1 m 才能让村落占地基本落在山裙之外（占地内最大坡度 10.2%）；原位置距山顶只有约 18 m，且紧邻西海岸滩坡（现距海岸 18 m） |
| LM03 古坟群 | 20°S 75°E | 27°S 86°E | 东海峡东岸 14 m 滩坡、24 m 遗迹占地和东洲山脊在原来的陆带上排不下；山脊在该纬度向东偏到约 99.5°E，LM03 置于其西坡林间空地（占地东缘与山脊脚下重叠约 3 m，该处山脊高度近 0，占地内最大坡度 2.6%） |
| LM04 废神社 | 45°S 15°W | 42°S 15°W | 入口（T03 终点、T11 栈道起点）离南岸 13.1 m，基本避开 14 m 滩坡，RD05 才能 ≤ 15% |
| LM09 乡间无人站 | 10°S 45°W | 18°S 40°W | 初稿位置落在 T01 上（R01 中心线 9.51°S）；车站要在路旁，入口节点就是 T01 上的 LM09-north；同时锚点离 ameni-gawa 17.9 m、离城镇补丁 14.1 m |
| LM10 渔港 | 5°N 100°E | 5°N 106°E | 占地圆西缘与东洲山脊东脚相切（间隙 0.1 m），东缘含海湾头（港区在水边）；T01 从港口南侧 9.5°S 经过，入口节点在 T01 上 |
| LM05–LM08 | 33.0°N 126.9°W；32°S 115°W；76°N 100°E；8°S 170°W | 不变 | WC11 偏差 −0.023°；其余没有冲突 |
| 河流 | 从雨见岳向南流 | 起于 24°N 49°W 的泉水（温泉村东南），向南绕城镇西侧，入本洲南面海湾；另加 east-river、west-river | 雨见岳山裙和 T02 占据南坡，河流若从山上下来必须穿过 T02 与石阶山径；改为泉水发源仍满足「绕城镇西侧、南岸入海、不进入城镇」。WORLD_PLAN 只写一条河，另两条是背面的自然水系 |
| 东洲山脊 | 南北向 | 99.5°E → 89°E 折向（半宽 9 m，高 18 m） | 让开 LM03 与 LM10 的占地，同时仍是东洲的脊梁；T01 在 9.5°S 处用 23 m 隧道穿过 |
| 背面聚落 | 「至少一处」 | hamlets-back-south、hamlets-back-north、farmland-west-coast | WC2 背面建筑 ≥ 15%；这三处没有道路接入，作为远景聚落；是否加支线留给 W5（已入待办池） |
| T01 纬度 | 大致 10°S | 洲上 9.51°S，西洲 12°S | R01 中心线 9.51°S；西洲避开山丘与沙漠边界 |
| T10 | RD08 | 全程 RD08，起点在雨见岳北山脚（72.4°N 10.1°W，冰上）| 山顶到北冰盖只有约 14 m，北坡直接落入冰原，没有熔岩原上的 RD05 段；LM01 内部的山径留给 W7 |
| T11 | 城镇南岸与 LM08 周边 | 拆为 LM04 → 南岸栈道（T11-01）与 T01 桥上 → LM08 码头（T11-02） | 栈道要从陆路节点接入，才能满足连通 |
| 城镇平缓带 | TR01 卡 10–20 m | 24 m（过渡带） | WC7 要求 5% 坡度，平缓带过窄会超限；表现层，不改布局 v1 |

## 10. 变更规则

确认冻结后修改任何一项（区域、高度骨架、目的地、河流、路网）都属于变更：先在本节追加一行「日期 · 项 · 原因 · 影响的检查」，再改 world.js，重跑 `node tools/world_check.mjs --write` 与 `node tools/world_survey.mjs`，并重新逐张查看勘探图。W3 对城镇底座边缘的表现层改动不属于变更，但要在 [LAYOUT_V1.md](../layout/LAYOUT_V1.md) 记录。

| 日期 | 项 | 原因 | 影响 |
| --- | --- | --- | --- |
| — | 尚无 | — | — |

## 11. WC12–WC14 待办说明

| 检查 | 阶段 | 说明 |
| --- | --- | --- |
| WC12 弯曲为 0 时现有检查与截图一致 | W2 | 需要弯曲着色器；W2_SPEC 的回归基线（`pre-w2`）负责 |
| WC13 天气锁定为雨时现有检查与截图一致；天气可复现 | W8 | 天气系统（D8、ST05）实现后检查 |
| WC14 全景距离无雨丝和遮挡地表的云层，四向都能看清地貌、道路和地标 | W8 | 需要真实渲染的全景截图 |

`world_check.mjs` 对它们打印 `PENDING 待 W2/W8`，不计失败。

## 12. 给后续阶段的提示

- W2 以后读 `world.js`，不要抄数字；`height()` 对 0.5° 栅格做双线性采样（首次调用约 0.15 s）。W3 生成网格时可一次采样后缓存。
- 区域边界目前是粗多边形（直边），地貌边界的自然化（噪声扰动、过渡宽度）留给 W6；背面两处聚落和山脊的「跑道形」等高线也是占位形状。这些已入 [待办池](../BACKLOG.md)。
- LM01 的石阶山径（T02-02）按绕山一圈（约 86 m）设计以满足石阶坡度，W7 实施 LM01 时可以重排，但入口位置与高度要保持。
