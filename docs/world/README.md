# 雨夜漫画小星球：星球规划参考包

本包是 [WORLD_PLAN.md](../../WORLD_PLAN.md) 的 W0 阶段交付：把城镇的精细度和美术语言扩展到整颗星球。共 39 张设计卡，规格已就绪，参考图已生成 19 / 39（ST01 风格已确认；ST03、ST05、BI01–BI09、TR01–TR07 已审查并记录残余问题，其余 20 张待生成），代码尚未实施。

- [星球计划](../../WORLD_PLAN.md)：原则、已确定的决策（D1–D9）、坐标与尺度、天气、面积预算、目的地、全球路网、阶段计划、检查项
- [星球统一规格](WORLD_SPEC.md)：色板、三个观看距离、墨线、光与天气、动态、尺度、验收
- [设计卡清单](cards/README.md)：5 张全局风格板（含天气状态板）、9 张地貌系统卡、7 张过渡带卡、8 张道路等级卡、10 张地标卡
- [参考图生成提示词（图像 Agent 通用模板）](IMAGE_AGENT_START.md)：每轮一句话指定卡片即可
- [卡片状态清单](catalog.json)
- [生图提示词](IMAGE_PROMPTS.json)
- [参考图](references/README.md)
- [参考图审查与裁决](REFERENCE_REVIEW.md)

参考图由有图像生成能力的 Agent 生成。ST01 风格已确认，ST03、ST05、BI01–BI09、TR01–TR07 已完成；下一批为 RD01–RD08，使用 ST01 作为风格参考：

> 读取 docs/world/IMAGE_AGENT_START.md 并执行，本轮卡片：RD01–RD08。

参考包完整性检查（从仓库根目录运行）：`node docs/world/check_kit.mjs`；全部参考图生成后用 `--refs` 检查。

与城镇的关系：城镇的布局 v1 和建筑参考包（[docs/buildings/](../buildings/README.md)）不受影响，逐栋建筑可以与星球规划并行推进。

本批验收（2026-10-05）：TR01–TR07 各 3 次，TR03 保留第 2 次，其余保留第 3 次。七张均记录为 generated-with-issues，逐卡残余问题、裁决和完整追加提示词见 REFERENCE_REVIEW。七张 JPEG 均为 1536 × 1024、质量 92、无色度子采样、不裁剪。TR05/TR07 的旧模板天气措辞及七张 TR 的中性光说明已按 D8/D9 最小同步。

`node docs/world/check_kit.mjs`：PASS，39 张卡、39 条提示词、389 个本地链接；19 张已生成、20 张待生成，隐藏线索大圆对齐。七张图片解码、尺寸、质量 92 量化表、4:4:4 采样及卡片/目录状态一致性通过；`git diff --check -- docs/world` 通过。全部 39 张尚未齐全，本轮不运行 `--refs`。
