# 雨夜漫画小星球：星球规划参考包

本包是 [WORLD_PLAN.md](../../WORLD_PLAN.md) 的 W0 阶段交付：把城镇的精细度和美术语言扩展到整颗星球。共 39 张设计卡，规格和参考图均已就绪，39 / 39 张参考图已逐张审查；代码尚未实施。

- [星球计划](../../WORLD_PLAN.md)：原则、已确定的决策（D1–D9）、坐标与尺度、天气、面积预算、目的地、全球路网、阶段计划、检查项
- [星球统一规格](WORLD_SPEC.md)：色板、三个观看距离、墨线、光与天气、动态、尺度、验收
- [设计卡清单](cards/README.md)：5 张全局风格板（含天气状态板）、9 张地貌系统卡、7 张过渡带卡、8 张道路等级卡、10 张地标卡
- [参考图生成提示词（图像 Agent 通用模板）](IMAGE_AGENT_START.md)：每轮一句话指定卡片即可
- [卡片状态清单](catalog.json)
- [生图提示词](IMAGE_PROMPTS.json)
- [参考图](references/README.md)
- [参考图审查与裁决](REFERENCE_REVIEW.md)

参考图由有图像生成能力的 Agent 生成。ST01 风格已确认；ST02、ST04 于 2026-10-06 完成，全部 39 张参考图齐全。逐卡审查和裁决见 [REFERENCE_REVIEW.md](REFERENCE_REVIEW.md)。

参考包完整性检查（从仓库根目录运行）：`node docs/world/check_kit.mjs`；全部参考图生成后用 `--refs` 检查。

与城镇的关系：城镇的布局 v1 和建筑参考包（[docs/buildings/](../buildings/README.md)）不受影响，逐栋建筑可以与星球规划并行推进。

本批验收（2026-10-05）：RD03–RD05 各 2 次，RD06–RD08 各 1 次。六张均为 1536 × 1024；以 JPEG 高质量编码、4:4:4 色度采样保存，未裁剪。逐卡残余问题和提示词修订见 REFERENCE_REVIEW。

本批验收（2026-10-06）：ST02、ST04 均为 1536 × 1024；JPEG quality=92、4:4:4 色度采样，无裁剪。`node docs/world/check_kit.mjs` 与 `node docs/world/check_kit.mjs --refs` 均 PASS：39 张卡、39 条提示词、471 个本地链接、39 张参考图；`git diff --check -- docs/world` PASS。

本批验收（2026-10-05）：LM01–LM10 已独立生成并逐张审查，1536 × 1024；JPEG 高质量 4:4:4 保存，无裁切。LM02、LM05–LM08 有重试；LM07 保留含线索但带尺寸字样的第二版；LM08 的柔光修正曾遇 429，额度重置后重跑成功。LM06、LM07 残余项见审查记录。逐卡残余问题和提示词修订见 REFERENCE_REVIEW。

2026-10-06 续审：LM06、LM08 已替换为修正版；LM07 完成第 3 次尝试并保留有线索的第 2 版。ST02、ST04 于同日完成，W0 参考图包现为 39 / 39。
