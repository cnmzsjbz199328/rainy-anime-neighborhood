# 旧样板升级实施提示词（S 轨道）

你是本仓库的建筑升级 Agent。每一轮只完成 S 轨道的**一个阶段**，交付可验收的结果，不要只返回计划。

## 如何使用

每轮给 Agent 一句话：

> /goal 读取 docs/buildings/SAMPLE_UPGRADE_AGENT_START.md 并执行下一阶段

- 阶段由 [ROADMAP.md](../../ROADMAP.md) 的状态表决定：S 轨道中序号最小、状态为 `待办` 或 `进行中`、且前置全部 `完成` 的一行。前置是 `待确认` 时不要开工，报告并停止。
- 用户指令里若写「确认 <阶段>」，先把该行改为 `完成`（写日期和提交）。
- 开始时用一行说明选了哪个阶段，然后直接开工，不等确认。

## 开工前与交付后

- 开工前按 [docs/AGENT_PROTOCOLS.md](../AGENT_PROTOCOLS.md) 第 1 节写「阶段细化」（约 20 行，进 PROGRESS），然后直接开工。
- 截图审查按该文件第 4 节「视觉缺陷清单」逐项检查并记录。
- 交付后用户可另起 Agent 做「独立审查」或「返工」，协议见同一文件第 2、3 节。

## 先读

1. AGENTS.md、ROADMAP.md（第 4 节规则）、docs/BACKLOG.md。
2. **[SAMPLE_UPGRADE_PLAN.md](SAMPLE_UPGRADE_PLAN.md) 全文**：风险 R1–R10、安全原则、阶段计划、替换流程、验收门槛、默认裁决、回滚、停止条件。本文件不重复它。
3. S1–S3：再读 [AGENT_START.md](AGENT_START.md) 的「先读」「必须沿用的集成方式」「工作步骤」「不得做」（其中「不得改三栋旧样板」被本任务明确取代，其余照旧）、BUILDING_SPEC.md、对应任务卡、`references/<地块>.jpg`（升级概念图，要看图）、`screenshots/<地块>/`（现状）。

## 规则

- **S3 另读 [SAMPLE_UPGRADE_S3_SPEC.md](SAMPLE_UPGRADE_S3_SPEC.md)**：便利店的功能清单、方位、视觉锚点要求与验收，以它为准。S1、S2 先例可参考其实施记录。

- 每个阶段对应 SAMPLE_UPGRADE_PLAN 同名阶段：S0=阶段 0，S1=阶段 1（B05-P02），S2=阶段 2（B05-P05），S3=阶段 3（B05-P01），S4=阶段 4。
- S1–S3 在分支 `upgrade/<地块>` 上工作，全部验收通过后合并到 main。**不要推送**，除非用户指令里写了「并推送」。
- 冻结布局、入口、可建包络、门的世界坐标、其余 35 栋都不改；统一尺度 1，不做非等比缩放。
- 不手改 `index.html`，只用 `python3 build.py`。
- 非阻塞发现记入 docs/BACKLOG.md，不当场修；做到与其他建筑一致即可，不追求超越参考图。
- 遇到 SAMPLE_UPGRADE_PLAN 第 9 节的停止条件，停下报告已完成部分。

## 完成时

1. ROADMAP 状态表本阶段一行改为 `完成`（S1–S3 在验收全过、已合并 main 后），写日期与提交哈希。
2. 更新文档：S1–S3 按 SAMPLE_UPGRADE_PLAN 第 5 节第 7 步；S4 另外废止 [SAMPLE_REVIEW_AGENT_START.md](SAMPLE_REVIEW_AGENT_START.md)（文件头注明已废止）并更新 AGENT_START.md 中关于旧样板的说明；S0 写入 `docs/buildings/sample-upgrade-baseline.md`。
3. 在 PROGRESS.md 增加简洁中文一节：输出路径、检查结果、性能差值、遗留问题；真机项写「待验证」。
4. 最后回复固定格式：
   - 阶段与状态一行；
   - 提交哈希与分支（说明未推送）；
   - SAMPLE_UPGRADE_PLAN 第 6 节每条门槛的结果；
   - 截图的准确路径；
   - 待办池新增；
   - 需要用户决策或真机的事项；
   - ROADMAP 的下一阶段，以及下一句指令。
