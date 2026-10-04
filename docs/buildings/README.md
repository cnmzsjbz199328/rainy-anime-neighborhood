# 雨夜漫画小城：建筑实施参考包

38 个地块：35 个待建，3 个现有样板保留审查。38 张八视图设计板已全部生成并配齐，状态见 catalog.json。

- [统一构建规格](BUILDING_SPEC.md)
- [逐栋实施队列](BUILDING_QUEUE.md)
- [下一位 Agent 的完整启动提示词](AGENT_START.md)
- [最初便利店提示词](ORIGINAL_PROMPT.md)
- [地块状态清单](catalog.json)
- [参考图生成提示词](IMAGE_PROMPTS.json)
- [任务卡](tasks/README.md)
- [八视图参考图](references/README.md)

首先只实现 B05-P03 咖啡店，验收后再做 B05-P04 花店。尺寸与入口以 layout.js 为准，参考图用于外观和空间细节，不是精确工程图。

- [38 张参考板图库](GALLERY.md)
- [参考图审查与建模裁决](REFERENCE_REVIEW.md)

参考包完整性检查：`node docs/buildings/check_kit.mjs`（从仓库根目录运行）。图片使用内置 image_gen 生成，完整生图提示词见 IMAGE_PROMPTS.json。
