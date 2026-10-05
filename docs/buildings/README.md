# 雨夜漫画小城：建筑实施参考包

38 个地块：13 个待建，B05-P03 咖啡店、B05-P04 花店、B03-P01 面包店、B03-P02 洗衣店、B03-P03 旧书店、B03-P04 食堂、B03-P05 杂货店、B03-P06 社区会所、B03-P07 邮政服务站、B03-P08 雨宿神社、B04-P01 交番、B04-P02 诊所、B04-P03 口袋公园、B04-P04 街角小神社、B04-P05 文具店商住楼、B06-P01 药店商住楼、B06-P02 理发店商住楼、B06-P03 小文具店商住楼、B06-P04 修理铺商住楼、B02-P01 独栋住宅 1、B02-P02 独栋住宅 2、B02-P03 独栋住宅 3 已实现，3 个现有样板保留审查。38 张八视图设计板已全部生成并配齐，状态见 catalog.json。

- [统一构建规格](BUILDING_SPEC.md)
- [逐栋实施队列](BUILDING_QUEUE.md)
- [逐栋实施提示词（通用模板）](AGENT_START.md)：每轮一句话指定地块即可
- [最初便利店提示词](ORIGINAL_PROMPT.md)
- [地块状态清单](catalog.json)
- [参考图生成提示词](IMAGE_PROMPTS.json)
- [任务卡](tasks/README.md)
- [八视图参考图](references/README.md)

B05-P03 咖啡店（[实际截图](screenshots/B05-P03/)）、B05-P04 花店（[实际截图](screenshots/B05-P04/)）、B03-P01 转角面包店（[实际截图](screenshots/B03-P01/)）、B03-P02 洗衣店（[实际截图](screenshots/B03-P02/)）、B03-P03 旧书店（[实际截图](screenshots/B03-P03/)）、B03-P04 食堂（[实际截图](screenshots/B03-P04/)）、B03-P05 杂货店（[实际截图](screenshots/B03-P05/)）B03-P06 社区会所（[实际截图](screenshots/B03-P06/)）B03-P07 邮政服务站（[实际截图](screenshots/B03-P07/)）、B03-P08 雨宿神社（[实际截图](screenshots/B03-P08/)）、B04-P01 交番（[实际截图](screenshots/B04-P01/)）B04-P02 诊所（[实际截图](screenshots/B04-P02/)）与 B04-P03 口袋公园（[实际截图](screenshots/B04-P03/)）、B04-P04 街角小神社（[实际截图](screenshots/B04-P04/)）、B04-P05 文具店商住楼（[实际截图](screenshots/B04-P05/)）、B06-P01 药店商住楼（[实际截图](screenshots/B06-P01/)）、B06-P02 理发店商住楼（[实际截图](screenshots/B06-P02/)）、B06-P03 小文具店商住楼（[实际截图](screenshots/B06-P03/)）、B06-P04 修理铺商住楼（[实际截图](screenshots/B06-P04/)）、B02-P01 独栋住宅 1（[实际截图](screenshots/B02-P01/)）、B02-P02 独栋住宅 2（[实际截图](screenshots/B02-P02/)）与 B02-P03 独栋住宅 3（[实际截图](screenshots/B02-P03/)）已实现并验收，下一轮为 B02-P04 独栋住宅 4。尺寸与入口以 layout.js 为准，参考图用于外观和空间细节，不是精确工程图。

- [38 张参考板图库](GALLERY.md)
- [参考图审查与建模裁决](REFERENCE_REVIEW.md)

参考包完整性检查：`node docs/buildings/check_kit.mjs`（从仓库根目录运行）。图片使用内置 image_gen 生成，完整生图提示词见 IMAGE_PROMPTS.json。
