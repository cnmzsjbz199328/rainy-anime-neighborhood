> **已废止（2026-10-06，S4）**：三栋旧样板已全部升级为独立建筑模块，旧样板代码已从 scene.js 删除，本起始词不再适用。当前建筑审查走新建筑流程与 [docs/AGENT_PROTOCOLS.md](../AGENT_PROTOCOLS.md) 的独立审查；以下内容仅作历史记录。

# 旧样板现状审查起始词

适用于 B05-P01 便利店、B05-P02 拉面店、B05-P05 公寓。每轮只审查一栋已有样板；它与 `AGENT_START.md` 的新建筑实施流程分开。

## 本轮任务

1. 阅读选中样板的任务卡、`layout.js` 中的 `samples` 登记、`scene.js` 对应分组，以及 `screenshots/<地块>/` 下的现状视图。
2. 将实际模型截图与任务卡、`BUILDING_SPEC.md` 和八视图概念图对照，记录现状功能、结构差异和看不清或未建的部分。
3. 以 `layout.js` 和当前场景为事实来源；现状截图记录已有实现，`references/<地块>.jpg` 仍是未来升级概念，二者不可互相替代。
4. 只更新审查记录和链接。不要改 `scene.js`、`layout.js`、样板尺寸或 `implementationStatus`；不要按概念图重建样板。若用户明确要求升级，另开实现任务。

## 现状截图

运行 `node tools/building_views.mjs <地块>`，实际模型截图写入 `docs/buildings/screenshots/<地块>/`。标准视图包括四立面、屋顶、正面玻璃观察、两个斜视、默认视角和全城视角。旧样板没有新建筑模块使用的 roof-layer 剖切标记，因此 `interior.png` 是正面玻璃观察图，不是移除屋顶后的剖视；公寓样板未建室内家具，截图如实保留该状态。

截图来源为当前 Three.js 场景的 Chromium/SwiftShader 渲染，不是 AI 生成图。不要把截图当作工程尺寸测量或真机画质验证。

## 可直接发送的起始词

> 读取 `docs/buildings/SAMPLE_REVIEW_AGENT_START.md`，审查本轮样板：`<地块>`。只核对并记录现有实现，不重建或修改样板；分别使用现状截图和未来升级概念图，明确标注二者差异。
