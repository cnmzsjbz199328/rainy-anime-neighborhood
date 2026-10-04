# 参考包完整性检查

设计依据：布局 v1，读取的 layout.js blob SHA 为 71e639fe37144d9cd1edd69699d35da049ca0a70，源提交 bd81c658ba0365b2e15260ae60d9715af94abaca。

执行 check_kit.mjs：38 个地块、38 张任务卡、38 张八视图 JPEG、38 条独立生成提示词全部对应；394 个本地 Markdown 链接存在。参考图约 24.5 MiB，每张 1536×1024。

图像查看与限制见 REFERENCE_REVIEW.md；实际建筑建模和浏览器验收由下一位 Agent 完成。本次没有修改道路或场景代码。

从仓库根目录复核：`node docs/buildings/check_kit.mjs`。
