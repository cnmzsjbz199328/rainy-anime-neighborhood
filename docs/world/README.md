# 雨夜漫画小星球：星球规划参考包

本包是 [WORLD_PLAN.md](../../WORLD_PLAN.md) 的 W0 阶段交付：把城镇的精细度和美术语言扩展到整颗星球。共 39 张设计卡，规格已就绪，参考图已生成 27 / 39（ST01 风格已确认；ST03、ST05、BI01–BI09、TR01–TR07、RD01–RD08 已审查并记录裁决，其余 12 张待生成），代码尚未实施。

- [星球计划](../../WORLD_PLAN.md)：原则、已确定的决策（D1–D9）、坐标与尺度、天气、面积预算、目的地、全球路网、阶段计划、检查项
- [星球统一规格](WORLD_SPEC.md)：色板、三个观看距离、墨线、光与天气、动态、尺度、验收
- [设计卡清单](cards/README.md)：5 张全局风格板（含天气状态板）、9 张地貌系统卡、7 张过渡带卡、8 张道路等级卡、10 张地标卡
- [参考图生成提示词（图像 Agent 通用模板）](IMAGE_AGENT_START.md)：每轮一句话指定卡片即可
- [卡片状态清单](catalog.json)
- [生图提示词](IMAGE_PROMPTS.json)
- [参考图](references/README.md)
- [参考图审查与裁决](REFERENCE_REVIEW.md)

参考图由有图像生成能力的 Agent 生成。ST01 风格已确认，ST03、ST05、BI01–BI09、TR01–TR07、RD01–RD02 已完成；下一批为 LM01–LM10，使用 ST01 作为风格参考：

> 读取 docs/world/IMAGE_AGENT_START.md 并执行，本轮卡片：LM01–LM10。

参考包完整性检查（从仓库根目录运行）：`node docs/world/check_kit.mjs`；全部参考图生成后用 `--refs` 检查。

与城镇的关系：城镇的布局 v1 和建筑参考包（[docs/buildings/](../buildings/README.md)）不受影响，逐栋建筑可以与星球规划并行推进。

本批验收（2026-10-05）：RD03–RD05 各 2 次，RD06–RD08 各 1 次。六张均为 1536 × 1024；以 JPEG 高质量编码、4:4:4 色度采样保存，未裁剪。逐卡残余问题和提示词修订见 REFERENCE_REVIEW。

`node docs/world/check_kit.mjs`：PASS，39 张卡、39 条提示词、422 个本地链接；27 张已生成、12 张待生成，隐藏线索大圆对齐。图片链接与状态一致性通过；`git diff --check -- docs/world` 通过。全部 39 张尚未齐全，本轮不运行 `--refs`。
