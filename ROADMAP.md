# 总路线图

状态：生效。起草日期：2026-10-06。这是「现在做什么、做到什么算完、什么时候停手」的唯一依据；各专项计划（ROAD_NETWORK_PLAN、WORLD_PLAN、docs/buildings/SAMPLE_UPGRADE_PLAN）只管自己那一块的细节。

## 1. 目标

1. **平面世界地图**：用经纬度存储整颗星球的区域、地标、面积预算和全球路网，用勘探图检查布局（W1）。
2. **星球地图**：把冻结的城镇卷到球面，铺设地形、道路、地貌和地标，全景晴朗月夜、近处保持雨夜（W2–W8）。
3. **统一世界（W10，D15，2026-10-10）**：城镇布局解冻，去掉底座，城镇街道与全球路网、城镇地面与地形连为一体，全面剔除城镇视图/探索视图等双重设计，不留回退（规格 [W10_SPEC](docs/world/W10_SPEC.md)）。街道中线与宽度、地块和建筑不变。

前提：城镇 v1 已完成（96 × 96 道路、35 栋新建筑、街景漫游 W9a），2026-10-10 起按 D15 解冻（见目标 3）。三栋旧样板升级后城镇才算收尾（S 轨道）。

## 2. 两条轨道与状态表

- **W 轨道**：星球。指令入口 [docs/world/WORLD_AGENT_START.md](docs/world/WORLD_AGENT_START.md)。
- **S 轨道**：三栋旧样板升级。指令入口 [docs/buildings/SAMPLE_UPGRADE_AGENT_START.md](docs/buildings/SAMPLE_UPGRADE_AGENT_START.md)，细节见 [SAMPLE_UPGRADE_PLAN.md](docs/buildings/SAMPLE_UPGRADE_PLAN.md)。

状态值：`待办` · `进行中` · `待确认`（Agent 已交付，等用户验收）· `完成` · `受阻`。每个 Agent 只改自己那一行。

「下一阶段」的取法：本轨道中序号最小、状态为 `待办` 或 `进行中`、且前置全部为 `完成` 的一行。`待确认` 会阻塞以它为前置的后续阶段，但不阻塞另一条轨道。可选行（W9b）只在用户明确要求时执行，选下一阶段时跳过。W10 各行交付后为 `待确认`，用户截图确认（「确认 W10x」）后才改为 `完成`。

| 序号 | 阶段 | 内容 | 前置 | 状态 | 完成记录 |
| --- | --- | --- | --- | --- | --- |
| W1 | 星球布局数据与勘探 | `world.js`、`tools/world_check.mjs`、勘探图、面积报告、冻结「星球布局 v1」（规格 [W1_SPEC](docs/world/W1_SPEC.md)） | — | 完成 | 2026-10-06 · `342816e`（在 main，未推送）；用户已确认冻结「星球布局 v1」；冻结清单 [WORLD_LAYOUT_V1](docs/world/WORLD_LAYOUT_V1.md) |
| WS | 细化 W3–W8 规格（仅文档） | 依据冻结的 `world.js` 补写 W3_SPEC…W8_SPEC | W1 确认 | 完成 | 2026-10-06 · `b7657d3`（在 main，未推送）；规格 [W3](docs/world/W3_SPEC.md) · [W4](docs/world/W4_SPEC.md) · [W5](docs/world/W5_SPEC.md) · [W6](docs/world/W6_SPEC.md) · [W7](docs/world/W7_SPEC.md) · [W8](docs/world/W8_SPEC.md) |
| S0 | 样板升级：基线与工具 | 打标签、`tools/frozen_diff.mjs`、基线记录、工具兼容空 `samples` | — | 完成 | 2026-10-06 · `05e4b5e`, `6927e2b`, `dd60d15` |
| S1 | 升级拉面店 B05-P02 | 见 SAMPLE_UPGRADE_PLAN | S0 | 完成 | 2026-10-06 · `4233716`（已合并 main） |
| S2 | 升级公寓 B05-P05 | 同上 | S1 | 完成 | 2026-10-06 · `6e89b3a`（已合并 main） |
| S3 | 升级便利店 B05-P01 | 规格 [S3 规格](docs/buildings/SAMPLE_UPGRADE_S3_SPEC.md) | S2 | 完成 | 2026-10-06 · `e16b916`（已合并 main） |
| S4 | 清理旧样板代码 | 同上 | S3 | 完成 | 2026-10-06 · `da92e78`（在 main，未推送） |
| C1 | 相机控制修复（插队） | 修正漫游 A/D 左右反向；漫游拖动改为 360° 环视且不自动回正、与自由视角同向；自由视角增加 Shift/Ctrl 拖动、触屏双指、WASD/方向键平移；只改 `scene.js` 相机段与 `tools/views.mjs`，不动冻结布局，保持 `view.get/set` 接口与默认视角 | S4 | 待确认 | 2026-10-06 · 已合并 main（`114541b`、`727ecc5`；基线标签 `baseline/pre-camera-fix`；未推送） |
| W2 | 弯曲渲染 | 确定性回归基线、弯曲着色器、点光源同步、法线、剔除（规格 [W2_SPEC](docs/world/W2_SPEC.md)） | S4 | 完成 | 2026-10-06 · `e6c8671`（分支 `world/W2` 已合并 main，未推送）；基线标签 `pre-w2`（`68117a6`） |
| W3 | 星球地形网格与城镇边缘 | 球体网格、抬高、城镇边缘渐变、9 个出口（规格 [W3_SPEC](docs/world/W3_SPEC.md)） | W2、WS | 完成 | 2026-10-06 · `2ee15be`（分支 `world/W3` 已合并 main，未推送）；基线标签 `pre-w3`（`a49cb15`） |
| W4 | 样板断面（闸门 G1） | ST03 全质量实现；记录性能；**交付后停下等用户确认**（规格 [W4_SPEC](docs/world/W4_SPEC.md)） | W3 | 完成 | 2026-10-07 用户确认 G1 · 提交 `b4cbc40`、返工 `df660e5`（分支 `world/W4` 已合并 main，未推送）；基线标签 `pre-w4`（`618638c`）；截图 `docs/world/w4/`；外推表与结论见 [PROGRESS](PROGRESS.md) 的「W4 样板断面交付」 |
| W5a | 全球路网 a：RD01、RD02、隧道、出口、光带 | RD01 主干道（含出口 N01/N03 的渐变）、RD02 五段桥（桥墩、斜拉塔、航道灯）、隧道口、RD03/RD05 的 6 个出口（N04/N09/N10/N11/N12/N13）渐变、RD01/RD02 路灯与小设施、夜间光带（规格 [W5_SPEC](docs/world/W5_SPEC.md) 第 9 节）；W5-C1–C6、C9 | W4 确认 | 完成 | 2026-10-07 · 提交 `2d12051`（分支 `world/W5` 已合并 main，未推送）；基线标签 `pre-w5`（`e8b6472`）；截图 `docs/world/w5/`；结果见 [PROGRESS](PROGRESS.md) 的「W5a 全球路网 a」 |
| W5b | 全球路网 b：RD06、RD08、其余边 | RD06 石阶（T02-02、T08-02）、RD08 标杆路线（T10-01）、T07-01、T08-01、T09-01 的 RD05、T11-02 钢制检修楼梯、RD03 路灯与设施、地标入口收口；W5-C7 与余下截图 | W5a | 完成 | 2026-10-07 · 提交 `91ef544`（分支 `world/W5b` 已合并 main，未推送）；基线标签 `pre-w5b`；截图 `docs/world/w5/`；结果见 [PROGRESS](PROGRESS.md) 的「W5b 全球路网 b」 |
| W6a | 地貌 a：海洋与海岸 | BI01 海洋、TR02 海岸：全球水面（深浅渐变、浪花线、月光反光带、雨点涟漪）、海岸线墨线、礁石与海藻暗影、消波块与海堤（只在有道路靠岸处）（规格 [W6_SPEC](docs/world/W6_SPEC.md) 第 2、3.1 节） | W4 确认、W5a | 完成 | 2026-10-07 · 提交 `1836faf`（分支 `world/W6a` 已合并 main，未推送）；基线标签 `pre-w6a`；截图 `docs/world/w6a/`；结果见 [PROGRESS](PROGRESS.md) 的「W6a」 |
| W6b | 地貌 b：农田、梯田、城镇边缘、弃耕地 | BI05 农田、BI06 梯田与茶园、TR01 其余 8 个出口的边缘、TR04 弃耕地 | W4 确认 | 完成 | 2026-10-07 · 提交 `1836faf`（与 W6a 同一分支 `world/W6a`，已合并 main，未推送）；基线标签 `pre-w6b`；截图 `docs/world/w6b/`；结果见 [PROGRESS](PROGRESS.md) 的「W6b」 |
| W6c | 地貌 c：森林与林缘 | BI02 森林、TR03 林缘（实例按相机加载半径） | W4 确认 | 完成 | 2026-10-07 · 提交 `1836faf`（与 W6a 同一分支 `world/W6a`，已合并 main，未推送）；基线标签 `pre-w6b`；截图 `docs/world/w6c/`；结果见 [PROGRESS](PROGRESS.md) 的「W6c」 |
| W6d | 地貌 d：草原、沙漠与过渡 | BI03 草原、BI04 沙漠、TR07 沙漠—草原 | W4 确认 | 完成 | 2026-10-07 · 提交 `1836faf`（同上）；截图 `docs/world/w6d/`；结果见 [PROGRESS](PROGRESS.md) 的「W6d」 |
| W6e | 地貌 e：冰、熔岩、山地与雪线 | BI07 冰原、BI08 熔岩原、BI09 丘陵与高山、TR05 雪线、TR06 熔岩—植被 | W4 确认 | 完成 | 2026-10-07 · 提交 `1836faf`（同上）；截图 `docs/world/w6e/`；结果见 [PROGRESS](PROGRESS.md) 的「W6e」 |
| W7 | 地标逐个实施 | LM01–LM10，每轮一个（规格 [W7_SPEC](docs/world/W7_SPEC.md)，逐地标表；建议顺序见起始词） | W5、W6 | 完成 | 2026-10-07 · 10 个地标行全部完成（LM01–LM10，见下 10 行，均已合并 main，未推送）；总回归与各检查结果见 [PROGRESS](PROGRESS.md) 的「W7 总结」 |
| W7-LM01 | 地标 雨见岳 | `landmarks/LM01.js`、八视图截图、W7-C1–C6（规格 [W7_SPEC](docs/world/W7_SPEC.md) 第 4 节该地标一行） | W6e | 完成 | 2026-10-07 · 提交 `ff203a1`（分支 `world/W7-LM01` 已合并 main，未推送）；基线标签 `pre-w7-lm01`；截图 `docs/world/landmarks/LM01/`；结果见 [PROGRESS](PROGRESS.md) 的「W7-LM01」 |
| W7-LM02 | 地标 湯けむり温泉村 | `landmarks/LM02.js`、八视图截图、W7-C1–C6（规格 [W7_SPEC](docs/world/W7_SPEC.md) 第 4 节该地标一行） | W6b、W6e | 完成 | 2026-10-07 · 提交 `940c1b1`（分支 `world/W7-LM02` 已合并 main，未推送）；基线标签 `pre-w7-lm02`；截图 `docs/world/landmarks/LM02/`；结果见 [PROGRESS](PROGRESS.md) 的「W7-LM02」 |
| W7-LM04 | 地标 森中废神社 | `landmarks/LM04.js`、八视图截图、W7-C1–C6（规格 [W7_SPEC](docs/world/W7_SPEC.md) 第 4 节该地标一行） | W6c | 完成 | 2026-10-07 · 提交 `303e607`（分支 `world/W7-LM04` 已合并 main，未推送）；基线标签 `pre-w7-lm04`；截图 `docs/world/landmarks/LM04/`；结果见 [PROGRESS](PROGRESS.md) 的「W7-LM04」 |
| W7-LM09 | 地标 乡间无人站 | `landmarks/LM09.js`、八视图截图、W7-C1–C6（规格 [W7_SPEC](docs/world/W7_SPEC.md) 第 4 节该地标一行） | W6b | 完成 | 2026-10-07 · 提交 `add58f5`（分支 `world/W7-LM09` 已合并 main，未推送）；基线标签 `pre-w7-lm09`；截图 `docs/world/landmarks/LM09/`；结果见 [PROGRESS](PROGRESS.md) 的「W7-LM09」 |
| W7-LM03 | 地标 苔石古坟群 | `landmarks/LM03.js`、八视图截图、W7-C1–C6（规格 [W7_SPEC](docs/world/W7_SPEC.md) 第 4 节该地标一行） | W6c | 完成 | 2026-10-07 · 提交 `4e6bac0`（分支 `world/W7-LM03` 已合并 main，未推送）；基线标签 `pre-w7-lm03`；截图 `docs/world/landmarks/LM03/`；结果见 [PROGRESS](PROGRESS.md) 的「W7-LM03」 |
| W7-LM10 | 地标 小渔港 | `landmarks/LM10.js`、八视图截图、W7-C1–C6（规格 [W7_SPEC](docs/world/W7_SPEC.md) 第 4 节该地标一行） | W6a、W6b | 完成 | 2026-10-07 · 提交 `aa5fb7c`（分支 `world/W7-LM10` 已合并 main，未推送）；基线标签 `pre-w7-lm10`；截图 `docs/world/landmarks/LM10/`；结果见 [PROGRESS](PROGRESS.md) 的「W7-LM10」 |
| W7-LM08 | 地标 灯塔岛 | `landmarks/LM08.js`、八视图截图、W7-C1–C6（规格 [W7_SPEC](docs/world/W7_SPEC.md) 第 4 节该地标一行） | W6a | 完成 | 2026-10-07 · 提交 `fc26835`（分支 `world/W7-LM08` 已合并 main，未推送）；基线标签 `pre-w7-lm08`；截图 `docs/world/landmarks/LM08/`；结果见 [PROGRESS](PROGRESS.md) 的「W7-LM08」 |
| W7-LM05 | 地标 星见石环（隐藏线索） | `landmarks/LM05.js`、八视图截图、W7-C1–C6（规格 [W7_SPEC](docs/world/W7_SPEC.md) 第 4 节该地标一行） | W6c | 完成 | 2026-10-07 · 提交 `3972db9`（分支 `world/W7-LM05` 已合并 main，未推送）；基线标签 `pre-w7-lm05`；截图 `docs/world/landmarks/LM05/`；结果见 [PROGRESS](PROGRESS.md) 的「W7-LM05」 |
| W7-LM06 | 地标 砂没驿（隐藏线索） | `landmarks/LM06.js`、八视图截图、W7-C1–C6（规格 [W7_SPEC](docs/world/W7_SPEC.md) 第 4 节该地标一行） | W6d | 完成 | 2026-10-07 · 提交 `cc3ddec`（分支 `world/W7-LM06` 已合并 main，未推送）；基线标签 `pre-w7-lm06`；截图 `docs/world/landmarks/LM06/`；结果见 [PROGRESS](PROGRESS.md) 的「W7-LM06」 |
| W7-LM07 | 地标 冰封轮廓（隐藏线索） | `landmarks/LM07.js`、八视图截图、W7-C1–C6（规格 [W7_SPEC](docs/world/W7_SPEC.md) 第 4 节该地标一行） | W6e | 完成 | 2026-10-07 · 提交 `b0d4d6c`（分支 `world/W7-LM07` 已合并 main，未推送）；基线标签 `pre-w7-lm07`；截图 `docs/world/landmarks/LM07/`；结果见 [PROGRESS](PROGRESS.md) 的「W7-LM07」 |
| W8 | 全球表现、天气与真机 | 卷曲过渡 ST04、天气 D8/ST05、光带、真机（规格 [W8_SPEC](docs/world/W8_SPEC.md)；必须拆成 W8a–W8d 四行，开工前在本表加行） | W7 | 待确认 | W8a–W8c 完成、W8d 已交付；2026-10-07 起插入 W8e-a/b/c（视图模式与球形白天，D8/D9 修订、D10–D12）；W8e-a/b/c 已于 2026-10-08 完成；W8d 的真机记录表现在可以让用户填（见 PROGRESS「W8d」，现为「待验证」）；2026-10-08 用户真机反馈 5 项，插入 W8f-a/b 修复（W8_SPEC 第 12 节），W8d 的确认延后到复验 |
| W8a | 卷曲过渡 ST04 | `transition.js`；`uBend` 随相机距离 `smoothstep(150, 300, d)`；相机沿局部上方向与球面平移/缩放；地形·雾·极帽淡入；缩放上限 400 m；`tools/transition_check.mjs`；ST04 八格截图（规格 [W8_SPEC](docs/world/W8_SPEC.md) 第 3 节） | W7 | 完成 | 2026-10-07 · 提交 `6abeae2`（分支 `world/W8a` 已合并 main，未推送）；基线标签 `pre-w8a`；截图 `docs/world/w8/st04-*.png`；结果见 [PROGRESS](PROGRESS.md) 的「W8a」 |
| W8b | 天气 D8/ST05 | `weather.js`、`weather_fx.js`；状态与位置规则、确定性时间函数、锁定与复现、六种状态、随距离淡出；`tools/weather_check.mjs`；`regress.mjs --weather lock:rain`（规格 W8_SPEC 第 4 节） | W8a | 完成 | 2026-10-07 · 提交 `16cf60e`（分支 `world/W8b` 已合并 main，未推送）；基线标签 `pre-w8b`；截图 `docs/world/w8/st05-*.png`；结果见 [PROGRESS](PROGRESS.md) 的「W8b」 |
| W8c | 夜间表现 | `nightlight.js`、`stars.js`；光带与路灯接替、全景可读光照混合、星空、隐藏线索全景可见性；`tools/night_check.mjs`（规格 W8_SPEC 第 5 节） | W8b | 完成 | 2026-10-07 · 提交 `215638c`（分支 `world/W8c` 已合并 main，未推送）；基线标签 `pre-w8c`；截图 `docs/world/w8/night-*.png`；结果见 [PROGRESS](PROGRESS.md) 的「W8c」 |
| W8d | 收尾与真机 | WC12–WC14 复核、交互回归、性能总表、待办池清理、真机记录表（缺项写「待验证」）（规格 W8_SPEC 第 6 节） | W8c，用户提供真机数据 | 待确认 | 2026-10-07 · 提交 `8202513`（分支 `world/W8d` 已合并 main，未推送）；基线标签 `pre-w8d`；WC12–WC14、`views`（24 项）、`world_check` 通过，`transition_check` 的 C5 本轮未等跑完；真机项全部「待验证」；结果见 [PROGRESS](PROGRESS.md) 的「W8d」；2026-10-08 用户真机（Mac Safari）：运行正常（未给帧率）；反馈 3 项视觉缺陷（栈道板子、道路衔接、球形城镇道路空洞）与 2 项体验问题（远景无替身、球形相机难控制），Agent 已截图复现并定位（PROGRESS「W8d」→「真机反馈」，待办池「W8d 真机反馈」），未修 |
| W8e-a | 视图模式：解耦与切换 | 缩放不再驱动 `uBend`；平面/球形按钮（约 2 s 动画，共用经纬度目标）；平面模式去中心化（整图可平移、去掉「拉回底座」）；地形可见度改为 `(目标离城镇距离, d)` 的纯函数；球形缩放 9–400 m 无最近距离；漫游/剖视只在平面城镇内；`transition_check`、`views` 同步更新；默认画面逐像素不变（规格 [W8_SPEC](docs/world/W8_SPEC.md) 第 11 节） | W8（D10、D12 已定） | 完成 | 2026-10-08 · 提交 `e6cf40d`（分支 `world/W8e-a` 已合并 main，未推送）；基线标签 `pre-w8e-a`（`2ad89e1`）；截图 `docs/world/w8e/`；结果见 [PROGRESS](PROGRESS.md) 的「W8e-a」 |
| W8e-b | 平面地图边界 | 接缝移到西海 −85°（按物件整体平移，桥 T01-13 按段）；东西与南北边界雾（80° 起变浓、84.5° 不透明）；平面全图性能实测；边界与高纬度截图（规格第 11 节） | W8e-a | 完成 | 2026-10-08 · 提交 `9da2d21`（分支 `world/W8e-b` 已合并 main，未推送）；基线标签 `pre-w8e-b`（`6714323`）；截图 `docs/world/w8e/edge-*.png`、`seam-bridge-*.png`、`lm07.png`；结果见 [PROGRESS](PROGRESS.md) 的「W8e-b」 |
| W8e-c | 球形晴朗白天 | 球形模式天空背景、日光、全局日间调色（关闭自发光与光带、无星空）、天气恒为晴朗；球面近景（农田/森林/海岸）验收截图；W8c 星空与可读性光照改为仅平面模式（规格第 11 节） | W8e-a | 完成 | 2026-10-08 · 提交 `2dec85d`（分支 `world/W8e-c` 已合并 main，未推送）；基线标签 `pre-w8e-c`（`71ce995`）；截图 `docs/world/w8e/day-*.png`；结果见 [PROGRESS](PROGRESS.md) 的「W8e-c」 |
| W8f-a | 真机反馈修复 a：栈道、道路衔接、球面城镇地面 | 栈道 T11-01 板子朝向；6 个桥台的缓和曲线、桥头引道竖曲线、断面与护栏衔接、连续虚线；5 个 T 形路口铺装；9 个出口的沥青颜色衔接；城镇大网格在球形模式下细分到 ≤ 4 m（规格 [W8_SPEC](docs/world/W8_SPEC.md) 第 12.1 节） | W8e-c（2026-10-08 真机反馈插入；W8d 的确认延后到两行完成后的真机复验） | 完成 | 2026-10-08 · 提交 `796c6f0`（分支 `world/W8f-a` 已合并 main，未推送）；基线标签 `pre-w8f-a`（`54823ed`）；WC12（含锁雨）8/8 逐位相同、默认 2374 / 239958 不变；`road_check` 10 项（新 W5-C10 衔接）、`w8f_check` A1/B1/B3 通过；`night_check` 线索余量 0.8 → 0.95（原因见 PROGRESS）；截图 `docs/world/w8f/`；结果见 [PROGRESS](PROGRESS.md) 的「W8f-a」 |
| W8f-b | 真机反馈修复 b：球形相机（D13）与远景替身 | 球形模式抓取式转星球、可过极点、俯仰到 90°、按弧长计速、远景居中；地表覆盖的远景替身：地形烘焙色、树冠团、加载圈交接（规格第 12.2 节） | W8f-a | 完成 | 2026-10-08 · 提交 `9ee595f`、F1 收尾 `2650334`（分支 `world/W8f-b` 已合并 main，未推送）；基线 `pre-w8f-b`（`5b39428`）；K1–K8、F1–F3 通过，WC12（含锁雨）8/8 逐位相同、默认 2374 / 239958 不变；F1 按用户决定 (a) 改为「与同处真树相差 ≤ 15 级 + 标准差不低于基线」（规格 12.2 记录原因）；`wc14_check` 已按 D9 / D10 修正，B 的两项与 `landmark_check` LM07 / LM08 的动态项是 W8e-c 起既有问题；42 处道路连接截图复核，6 类既有问题转 W8f-c；结果见 [PROGRESS](PROGRESS.md) 的「W8f-b」 |
| W8f-c | 道路衔接的既有问题 | 桥–桥节点 J-P1 / J-LM08 与 LM09-north 折角改缓和曲线，LM09 入口坪退出车道；RD03 出口 N04 / N09 / N10 的浅绿多边形；RD05 草路肩取地形色、端头收口；桥台虚线颜色渐变；平面模式 9 个灰盒出口换成正式出口道路头（WC12 遮罩口径）（规格 [W8_SPEC](docs/world/W8_SPEC.md) 第 12.4 节） | W8f-b | 完成 | 2026-10-09 · 提交 `db486db`（G1–G5）、`f7a7276`（G6）；基线 `pre-w8f-c`=`b71ecaabbc582debe9a46075499c5e90802ee7de`；已合并 main，未推送；检查与遗留项见 [PROGRESS](PROGRESS.md) |
| W8g-a | 统一体系 a：生成提速与后台预生成 | 新建冷启动性能工具 `tools/perf_baseline.mjs`；`W.height` 按河流剪枝提速（输出逐位相同）；去掉边缘地形的重复构建，采样器改为按块构建；统一的生成调度器在城镇首帧后后台分片预生成；首次出城不再冻结（现为 6.1 s）；所有画面逐位不变（规格 [W8_SPEC](docs/world/W8_SPEC.md) 第 13.1 节，D14）。2026-10-09 插入；W9b 仍为可选，排在其后 | W8f-c | 完成 | 2026-10-09 · 提交 `96be057`、`090d5ac`（分支 `world/W8g-a` 已合并 main，未推送）；基线 `pre-w8g-a`=`42354a5`；T1 `height_check` 417,507 点逐位相同；T2 预生成 CPU 1,660 ms；T3 预生成期间最长任务 111 ms；T4 预生成后冷出城无 ≥ 50 ms 长任务（原 5.4 s；页面一可用就出城 1.73–1.76 s）；T5 WC12 两种天气 8/8 逐位、默认 2374 / 240618 不变、`joint_shots` 126/126、冷启动截图 10/10 逐位相同；`bend_check` 唯一失败为既有项；性能 `docs/world/perf/`；结果见 [PROGRESS](PROGRESS.md) 的「W8g-a」 |
| W8g-b | 统一体系 b：一份高度、道路占地、出口与边缘地形 | 删除道路头 `TERR.stubs`，城镇视图直接显示正式道路的前段；去掉 `ringFlat`，平面与球形共用裁切后的边缘网格；贴地几何统一读渲染出来的地形高度；道路占地只输出一份，供地形裁切和植被避让共用；`road_check` 改为检查实际显示的网格（第 13.2 节，按 WC12-M 口径） | W8g-a | 完成 | 2026-10-10 · 提交 `ae4cb19`、`5c837a3`、`77a72ab`、`a96e3e3`（分支 `world/W8g-b` 已合并 main，未推送）；基线 `pre-w8g-b`=`9c3e8ac`；B5 射线遮挡 0 / 1,764（平面、球形各）、接缝差 0、宽度两视图同一网格、接口几何与冷启动序列逐位相同 9/9、植被伸进 0；WC12-M 两种天气 8/8 遮罩外逐位、默认 2374 / 240,618 → 246,290；页面可用 +6.3%（1,582 → 1,681 ms）；裁决 1–7（24 m 裁切只到 L、G6 标线改画在路网上等）见 [PROGRESS](PROGRESS.md) 的「W8g-b」 |
| W8g-c | 统一体系 c：植被远近表现 | 去掉缩放淡入和 30–80 m 加载圈；近模 → 远模 → 树冠团按屏幕像素做抖动交叉淡化；远模墨线与近模一致；显示选择只取决于相机；新建 `tools/lod_check.mjs`（第 13.3 节） | W8g-b | 完成 | 2026-10-10 · 提交 `b872d5b`（分支 `world/W8g-c` 已合并 main，未推送）；基线 `pre-w8g-c`=`ce978d6`；L1 缩放误差 1.5e-7、L2 逐位相同、交接处墨线 ≤ 0.41 px、WC12 两种天气 8/8 逐位、默认 2374 / 246,290 不变；L3 按口径未达（相机推拉主导，两版比值相同）、L4 球形三机位未达 17 / 25 ms（基线同样，来自城镇绘制调用）、`distant_check` F1 草原标准差子项未过；按 2026-10-07 的长期授权标为完成，三项未达保留为待用户决定的事项；见 [PROGRESS](PROGRESS.md) 的「W8g-c」 |
| W8g-d | 统一体系 d：画质分档与性能基线 | 分 `high`、`low` 两档，另有 `auto`（低档只减少数量，不缩小物体）；按帧时间自动选档，运行中只降不升；`perf_baseline` 两档完整记录；真机待用户验证（第 13.4 节） | W8g-c | 完成 | 2026-10-10 · 提交 `0b12871`、`c641b46`（分支 `world/W8g-d` 已合并 main，未推送）；基线 `pre-w8g-d`=`78e080b`；新模块 `quality.js`（high / low / auto）；WC12 两档两种天气及 auto 8/8 逐位、默认 2374 / 246,290 不变；D3 低档地表覆盖三角形 52–56%、绘制调用不超过高档；`auto` 本机选 high（16.7 ms）；`docs/world/perf/w8g-d.json` 两档完整记录；L4 球形三机位两档仍未达（城镇绘制调用，W8g-c 遗留）；真机两档数字待用户填写；见 [PROGRESS](PROGRESS.md) 的「W8g-d」 |
| W9b | 星球行人视角（可选） | 扩展漫游到球面 | W8 | 待办 | |
| W10a | 一次生成、一套显示规则 | 世界在首个画面前一次生成完（加载画面），所有模块在所有视图显示；删除 `explore`/`setFade`/各模块 `visibility()` 与 `worldgen` 的空闲分片和 `gate`；新建 `tools/unify_check.mjs`（U0、U3）（规格 [W10_SPEC](docs/world/W10_SPEC.md) 第 5 节） | W8g-d | 完成 | 2026-10-10 · 提交 `5269b27`，用户审查后返工 `83b2476`、`c0951e6`（N08 路面绿块：断面 TR01 带删除，新增 U3-town；分支 `world/W10a` 已合并 main，未推送）；基线标签 `pre-w10a`（`d03d42e`）；W10a 的数据检查与预算全部通过（LM07、LM08 两项 landmark_check 是 pre-w10a 就有的失败，见待办池；详见 PROGRESS「W10a 实施与交付」）；2026-10-11 用户明确回复「确认 W10a」，交付确认完成 |
| W10-RD | 城镇环路与经纬向路网设计 | 定稿 [路网设计稿](docs/world/ROAD_NETWORK_DESIGN_DRAFT.md)：CR01 中线 ±54 m、R8 圆角、RD03 断面、18 边闭合；逐列九个出口接点；移除 T04/T05/T06；T02-01 在西北环点截短且不跨环；N08 与 T03 共用南交点；M01 经 R02 南接 T03 至 LM04，T02 为西北支线；RN01–RN14 全网逐边映射；复核田块、草地和建筑物相交 | D16 | 完成 | 2026-10-10 · 提交 6d20972；设计与拓扑审计见 ROAD_NETWORK_DESIGN_DRAFT.md、ROAD_NETWORK_REVIEW.png。CR01 位于 farmland-main，未重算田块时 27 格相交（22 格耕作面进铺装）；完整拟建路网按 0.5 m 采样进入避让后，田块相交为 0，模型田面净减约 936 m²。CR01 与九条接线不压草地/森林实例；另发现既有 J-T09 一处 T09-01 石堆进入 RN01-11 铺装，W10c 须按交叉口净空抑制；其余森林实例冲突 0。城镇道路与地块净距 ≥2.01 m、建筑冲突 0。W10c/W10d 对田块全多边形、田埂、草地实例（含石堆）及道路全断面实行零相交验收。W10a 与 W10-RD 均于 2026-10-11 获用户确认；本轮不启动 W10b，开始 W10b 前先修订 W10_SPEC |
| W10b | 一张路网与出城线形 | 按确认后的路网设计，将城镇街道、CR01 环路和保留的全球道路写入统一拓扑；N11/N12/N13 只接 CR01，移除 T06；按图重画 T02/T03 与 M01 接续；U1-数据 | W10a 确认 + W10-RD 确认 | 待确认 | 2026-10-11 · 提交 `0edb57b`（W10_SPEC 第 2、5 节同步）、`4435da6`（登记与渲染随数据）及文档提交（分支 `world/W10b`，**未合并 main**，未推送）；基线 `pre-w10b`=`f43df3f`。59 节点 / 66 边登记完成，U0、U1 全部通过，23 条保留边逐位不变。**阻塞**：CR01 西边与 N11 接线压入 LM09 场地（WC6、W5-C7 未通过），待用户在 A/B/C 中决定（见 PROGRESS「W10b 实施与交付」）。另有 W5-C10-exits 重跑、section/seam/ocean/lod/exit_check 与性能基线未跑完 |
| W10c | 一条路：统一道路生成器 | `roadkit` 生成城镇街道、路口、出城过渡、野外道路与 W4 断面道路；删除道路头、端头封口、出口裁切、城镇整张沥青与城镇路面单独绘制；水洼与标线各一套；U1-几何、U2 路面覆盖 100%、U4 城镇保持；核验草地/森林实例对道路完整断面零相交，J-T09 路口净空抑制压在 RN01 铺装内的 T09 路标石堆 | W10b 确认 | 待办 | |
| W10d | 一份地面：去掉底座 | 删除底座；地形只按一份占地裁切；城镇边缘矮路缘、TR01 边缘带、排水出口；删除城镇补丁特例；LM09 平台止于 N11 路缘；检查田块完整多边形、田埂与道路铺装/路肩/边沟相交（不只查顶点），相交田块剔除或裁切至 0；U5 | W10c 确认 | 待办 | |
| W10e | W4 断面并入全局与外观控制器 | 新建 `look.js`（墨线、光照）；断面的田块、草带、树、水体交给全局生成器；删除断面模式与 `corridor` 排除；`section_check` 退役 | W10d 确认 | 待办 | |
| W10f | 同一份几何、一套相机与漫游 | 城镇网格构建时细分（≤ 4 m），删除 `townSphere` 换副本；相机只用一个地面采样器；漫游在平面地图任何道路上可用，删除 `townAvailable`；U6、U7 | W10e 确认 | 待办 | |
| W10g | 城镇合批与远近 | 城镇静态网格按材质合批、建筑与设施按像素交接；球形 d = 140 / 400 中位数 ≤ 17 ms、p95 ≤ 25 ms | W10f 确认 | 待办 | |
| W10h | 收尾：新基线、工具与文档 | 用户确认画面后打 `w10-baseline` 并作为 `regress.mjs` 默认基线；`docs/world/perf/w10.json`；清理旧工具与文档措辞；过待办池 | W10g 确认 | 待办 | |

## 3. 需要用户本人做的事

| 事项 | 时机 | 说明 |
| --- | --- | --- |
| 真机验证（iPad/手机/带 GPU 桌面）：构图、帧率、漫游触屏手感 | 每个里程碑末至少一次；S4 后做「城镇 v1.0」验收 | Agent 只有 SwiftShader，不能代替 |
| 确认 W1：逐张看勘探图，确认「星球布局 v1」冻结 | W1 交付后 | 之后改布局属于变更，要写原因 |
| 确认 W4：风格与性能是否可作为全球铺设基准（闸门 G1） | W4 交付后 | 不通过则回到 W2/W3 调整，不进入 W5 |
| 决定是否推送 main | 每次合并后 | 推送会触发 Cloudflare 自动部署；Agent 默认不推送 |

## 4. 防止无休止调细节的规则

1. **一轮一阶段**：Agent 完成一个阶段的退出标准就停，不顺手做下一个。
2. **「够了」的定义**：以任务卡/专项计划的验收清单和参考图水准为上限；超过参考图水准的打磨一律不做。
3. **待办池**：轮次中发现的非阻塞问题、想改进的点，记到 [docs/BACKLOG.md](docs/BACKLOG.md)，不当场修。每个里程碑结束时统一过一遍，由用户挑选进入哪一轮。
4. **冻结点**：星球布局 v1（W1 确认后）、W4 风格基准确认后，只有缺陷、阻塞或用户决定才能改，且必须写明原因。「看着还能更好」不算。城镇布局 v1 已于 2026-10-10 按 D15 解冻：街道中线与宽度、地块、建筑仍不改，底座和城镇与世界的衔接按 [W10_SPEC](docs/world/W10_SPEC.md) 重做；W10b 对星球布局出口线形的改动记入 WORLD_LAYOUT_V1 第 10 节。
5. **插队规则**：不在本表上的工作，先把它写进本表（并说明替换或延后了什么）再做。W9a 提前就是这样的先例。
6. **性能预算**：以 S0 记录的基线为准（默认视角绘制调用已超 3800，远景超 11000）。任何阶段使默认视角绘制调用上升超过 10%，视为阻塞，报告后再决定；其余性能问题进待办池。该比例是默认值，用户可调。
7. **受阻就报告**：遇到需要改冻结数据、缺凭证或决策冲突，停下报告，不自行扩大范围。

## 5. 里程碑

| 里程碑 | 包含 | 完成标志 |
| --- | --- | --- |
| M1 城镇收尾 | S0–S4 + 真机验证 | 38 个地块全部为新建筑标准；用户验收后冻结「城镇 v1.0」 |
| M2 平面世界地图 | W1 | 勘探图与面积报告通过检查，用户确认「星球布局 v1」 |
| M3 星球可看 | W2–W4 | 弯曲为 0 时现有检查与截图不变；W4 样板断面通过闸门 G1 |
| M4 星球铺满 | W5–W7 | 路网、地貌、10 个地标完成，四方向全景通过 |
| M5 星球完整 | W8（可选 W9b） | 天气与过渡完成，真机结果如实记录 |
| M6 统一世界 | W10a–W10h | 城镇与世界一体（一张路网、一份地面、一套显示规则），双重设计全部删除；用户截图确认，新基线 `w10-baseline` 建立 |

## 6. 每轮的协议

开工前写阶段细化，交付后可做独立审查，有问题走返工，视觉缺陷按统一清单检查：见 [docs/AGENT_PROTOCOLS.md](docs/AGENT_PROTOCOLS.md)。

## 7. 每轮结束时的统一交付

Agent 的最后回复固定为：阶段与状态一行；提交哈希；每条检查的结果；待办池新增；需要用户决策或真机的事项；ROADMAP 里的下一阶段及对应指令。用户只需看这几项并决定是否继续。
