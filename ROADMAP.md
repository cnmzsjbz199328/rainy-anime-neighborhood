# 总路线图

状态：生效。起草日期：2026-10-06。这是「现在做什么、做到什么算完、什么时候停手」的唯一依据；各专项计划（ROAD_NETWORK_PLAN、WORLD_PLAN、docs/buildings/SAMPLE_UPGRADE_PLAN）只管自己那一块的细节。

## 1. 目标

1. **平面世界地图**：用经纬度存储整颗星球的区域、地标、面积预算和全球路网，用勘探图检查布局（W1）。
2. **星球地图**：把冻结的城镇卷到球面，铺设地形、道路、地貌和地标，全景晴朗月夜、近处保持雨夜（W2–W8）。

前提：城镇 v1 已完成并冻结（96 × 96 道路、35 栋新建筑、街景漫游 W9a）。三栋旧样板升级后城镇才算收尾（S 轨道）。

## 2. 两条轨道与状态表

- **W 轨道**：星球。指令入口 [docs/world/WORLD_AGENT_START.md](docs/world/WORLD_AGENT_START.md)。
- **S 轨道**：三栋旧样板升级。指令入口 [docs/buildings/SAMPLE_UPGRADE_AGENT_START.md](docs/buildings/SAMPLE_UPGRADE_AGENT_START.md)，细节见 [SAMPLE_UPGRADE_PLAN.md](docs/buildings/SAMPLE_UPGRADE_PLAN.md)。

状态值：`待办` · `进行中` · `待确认`（Agent 已交付，等用户验收）· `完成` · `受阻`。每个 Agent 只改自己那一行。

「下一阶段」的取法：本轨道中序号最小、状态为 `待办` 或 `进行中`、且前置全部为 `完成` 的一行。`待确认` 会阻塞以它为前置的后续阶段，但不阻塞另一条轨道。

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
| W8 | 全球表现、天气与真机 | 卷曲过渡 ST04、天气 D8/ST05、光带、真机（规格 [W8_SPEC](docs/world/W8_SPEC.md)；必须拆成 W8a–W8d 四行，开工前在本表加行） | W7 | 待确认 | W8a–W8c 完成、W8d 已交付；2026-10-07 起插入 W8e-a/b/c（视图模式与球形白天，D8/D9 修订、D10–D12）；W8d 的真机记录表在 W8e 完成后再让用户填（见 PROGRESS「W8d」，现为「待验证」） |
| W8a | 卷曲过渡 ST04 | `transition.js`；`uBend` 随相机距离 `smoothstep(150, 300, d)`；相机沿局部上方向与球面平移/缩放；地形·雾·极帽淡入；缩放上限 400 m；`tools/transition_check.mjs`；ST04 八格截图（规格 [W8_SPEC](docs/world/W8_SPEC.md) 第 3 节） | W7 | 完成 | 2026-10-07 · 提交 `6abeae2`（分支 `world/W8a` 已合并 main，未推送）；基线标签 `pre-w8a`；截图 `docs/world/w8/st04-*.png`；结果见 [PROGRESS](PROGRESS.md) 的「W8a」 |
| W8b | 天气 D8/ST05 | `weather.js`、`weather_fx.js`；状态与位置规则、确定性时间函数、锁定与复现、六种状态、随距离淡出；`tools/weather_check.mjs`；`regress.mjs --weather lock:rain`（规格 W8_SPEC 第 4 节） | W8a | 完成 | 2026-10-07 · 提交 `16cf60e`（分支 `world/W8b` 已合并 main，未推送）；基线标签 `pre-w8b`；截图 `docs/world/w8/st05-*.png`；结果见 [PROGRESS](PROGRESS.md) 的「W8b」 |
| W8c | 夜间表现 | `nightlight.js`、`stars.js`；光带与路灯接替、全景可读光照混合、星空、隐藏线索全景可见性；`tools/night_check.mjs`（规格 W8_SPEC 第 5 节） | W8b | 完成 | 2026-10-07 · 提交 `215638c`（分支 `world/W8c` 已合并 main，未推送）；基线标签 `pre-w8c`；截图 `docs/world/w8/night-*.png`；结果见 [PROGRESS](PROGRESS.md) 的「W8c」 |
| W8d | 收尾与真机 | WC12–WC14 复核、交互回归、性能总表、待办池清理、真机记录表（缺项写「待验证」）（规格 W8_SPEC 第 6 节） | W8c，用户提供真机数据 | 待确认 | 2026-10-07 · 提交 `8202513`（分支 `world/W8d` 已合并 main，未推送）；基线标签 `pre-w8d`；WC12–WC14、`views`（24 项）、`world_check` 通过，`transition_check` 的 C5 本轮未等跑完；真机项全部「待验证」；结果见 [PROGRESS](PROGRESS.md) 的「W8d」 |
| W8e-a | 视图模式：解耦与切换 | 缩放不再驱动 `uBend`；平面/球形按钮（约 2 s 动画，共用经纬度目标）；平面模式去中心化（整图可平移、去掉「拉回底座」）；地形可见度改为 `(目标离城镇距离, d)` 的纯函数；球形缩放 9–400 m 无最近距离；漫游/剖视只在平面城镇内；`transition_check`、`views` 同步更新；默认画面逐像素不变（规格 [W8_SPEC](docs/world/W8_SPEC.md) 第 11 节） | W8（D10、D12 已定） | 完成 | 2026-10-08 · 提交 `e6cf40d`（分支 `world/W8e-a` 已合并 main，未推送）；基线标签 `pre-w8e-a`（`2ad89e1`）；截图 `docs/world/w8e/`；结果见 [PROGRESS](PROGRESS.md) 的「W8e-a」 |
| W8e-b | 平面地图边界 | 接缝移到西海 −85°（按物件整体平移，桥 T01-13 按段）；东西与南北边界雾（80° 起变浓、84.5° 不透明）；平面全图性能实测；边界与高纬度截图（规格第 11 节） | W8e-a | 待办 | |
| W8e-c | 球形晴朗白天 | 球形模式天空背景、日光、全局日间调色（关闭自发光与光带、无星空）、天气恒为晴朗；球面近景（农田/森林/海岸）验收截图；W8c 星空与可读性光照改为仅平面模式（规格第 11 节） | W8e-a | 待办 | |
| W9b | 星球行人视角（可选） | 扩展漫游到球面 | W8 | 待办 | |

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
4. **冻结点**：城镇布局 v1、星球布局 v1（W1 确认后）、W4 风格基准确认后，只有缺陷、阻塞或用户决定才能改，且必须写明原因。「看着还能更好」不算。
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

## 6. 每轮的协议

开工前写阶段细化，交付后可做独立审查，有问题走返工，视觉缺陷按统一清单检查：见 [docs/AGENT_PROTOCOLS.md](docs/AGENT_PROTOCOLS.md)。

## 7. 每轮结束时的统一交付

Agent 的最后回复固定为：阶段与状态一行；提交哈希；每条检查的结果；待办池新增；需要用户决策或真机的事项；ROADMAP 里的下一阶段及对应指令。用户只需看这几项并决定是否继续。
