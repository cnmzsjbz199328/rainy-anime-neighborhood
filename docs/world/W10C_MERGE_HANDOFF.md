# W10c 合并前收尾交接

2026-10-16。核对起点：`world/W10c`=`2e78e1c`，本地 `main`=`5a0c86e`；当前分支领先 main 22 个提交，核对时工作树干净。本文是收尾任务说明，阶段状态仍以 ROADMAP 为准。本轮只核对 Git、源码与实施记录，没有重跑浏览器或判断画面。

## 合并前还缺什么

1. **关闭性能门槛。** 最新 CR01 返工记录只有一次加载：首个完整画面 4,213 ms，超过 4,000 ms 预算；路网构建 735→954 ms。默认 calls 2,403 未超 2,611，但不足以证明全部性能通过。用最终代码、Metal GPU、至少三次冷启动补齐正式结果；默认中位≤17 ms、p95≤25 ms，球形 d140/d400 与 `pre-w10a` 相比不恶化超过10%，HTML 增量≤0.6 MB，低档 calls 不高于高档。超过5 s按规格停下报告；4–5 s也不能写预算通过，应在本阶段内定位优化，压不回则报告具体未达项，由用户决定是否调整预算。
2. **形成一个最终提交对应的机器交付记录。** 最新运行代码为 `09d0b67`，其后至核对起点只有文档变化；已有 CR01、road、unify、layout、桥隧、路灯通过记录可用，不应称全部失效。独立收尾需复核最终构建及相关门槛，并补齐后续改动影响的回归；既有失败必须有基线证据，不能直接豁免新失败。
3. **用户确认累计画面。** CR01 全环及西北接入、人行道/九接口与 C01-S 设施、统一路灯、桥下海床/隧道覆土、浓雾可读性及城镇锁雨光池变化尚待确认。机器通过不替代该闸门。用户明确确认 W10c 后才改完成并合并本地 main。

## 下一位独立实施 agent 的任务

只执行「W10c 合并前收尾」，先读 AGENTS.md、README、DESIGN、ROADMAP、PROGRESS 首段及各 W10c 交付记录、W10_SPEC §5 W10c/§6、AGENT_PROTOCOLS 和本文件。写阶段细化后开始；保持街道中线/宽度、地块、建筑、摆放及世界拓扑不变。

1. 检查工作树和分支是否前进，记录实际起点。用自己的隔离工作树实施，不在他人的工作树切分支或清理文件。
2. 先采集性能，再决定是否需要优化。阅读 `tools/perf_baseline.mjs` 参数，使用 `--views-only --quality high --loads 3`，并在相同空闲时间窗口测 `--ref pre-w10a`；补低档。性能不要与 WX2 或其他浏览器性能任务同时跑。记录 GPU、各次启动、median/p95/calls、HTML 字节数和准确比较基线，最终摘要写 `docs/world/perf/w10c-merge-ready.json`。修复仅限本阶段性能/回归缺陷，遵循 W10_SPEC 的算法提速→构建时预计算顺序，不恢复旧路径或提前做 W10g。
3. 最终源码按顺序 `python3 build.py` → `node tools/measure_samples.mjs` → `node tools/layout_check.mjs --png`。运行 `cr01_merge_check`、`unify_check`（U0–U4）、`road_check`、`town_pavement_check`、`c01_s_clearance`、`terrain_structure_check`、`streetlight_check`、`fog_view_check`、`weather_check`（不带 --shots）、`day_check`；根据实际修改复跑 terrain/ocean/cover/seam 等受影响检查。先读工具参数，限定 W10c，不能通过下调阈值让失败消失。
4. 更新 ROADMAP 的 W10c 摘要与 PROGRESS，使其覆盖最新全环实现、机器结果、性能及遗留问题；已确认历史不重写。维护一份短看点清单，最终状态为 `待确认`。不用旧图证明新提交通过；必要输出只生成并报路径，不打开作视觉判断、不跑截图审查链。
5. 显式暂存本任务文件，本地提交；截图不入库，意外再生的已跟踪截图恢复原样。交付提交哈希、逐项结果、未达项和看点。用户确认前不合并 main、不推送、不进入 W10d。

## 用户看点入口

- 西北 CR01/RN05：平面 target `[-48,1.2,-54]`、dist 15、yaw π/4、pitch 0.8；再球形 target `[-46,1.2,-53]`、dist 34、pitch 1.1。铺装连续、无重复碎片与穿路旧描边。参考本地 `docs/world/w10c/nw-road-review/manifest.json`；并抽看其他九路口。已知 RN05 端头 cap 空缝、C01-S 折叠仍在 BACKLOG。
- 人行道/接口、南口设施：`docs/world/w10c/pavement-review/`、`docs/world/w10c/c01-s-furniture-review/` 的原机位；在最终构建确认没有抬高侧带、铺砖重复面或设施侵路。
- 路灯：按 PROGRESS「道路路灯规范化」机位检查城镇、CR01、桥面与球形；灯体尺度、落地和光池待用户判断。
- 桥隧：按 PROGRESS「桥下海床与隧道覆土」的 RN01-03/07–09/13 桥下及 RN01-05 洞口机位；海床连续、山体盖住隧道且入口不堵。隧道上方无植被带是已记录遗留。
- 灰屏：按 PROGRESS「特定角度灰屏修正」LM08 锁雾 dist 65 机位，推拉35–160；确认目标可读。再看城镇锁雨默认/远景光池变化，球形往返恢复。旧锁雨像素不同已有归因，不能宣称逐像素不变。

## 天气分支与后续边界

- 核对时 `world/weather-WX2` 工作树位于 `/Users/tangjiang/My project/rainy-anime-neighborhood-wx2`，HEAD=`ff72599`，已合入 WX1；存在未提交的天气源码与 `tools/weather_integration_check.mjs`。这是在途改动，尚不是 WX2 交付。不得覆盖、重置、代提交或把它当完成结果。
- WEATHER_COMPLETION_PLAN 中「WX2 未开始」已落后于该 Git 状态；由天气实施者在交付时更新进度，不从当前脏工作树导入半成品。
- 推荐先把 W10c 作为道路阶段收尾，WX2 按自己的专项计划完成、审查、用户确认后再独立集成；现有规范没有把 WX2/WX3 完成列为 W10c 合并前置。若之后选择先合天气进 W10c，则以合入后的最终提交重新检查受影响项，不能复用旧构建的验收结论。
- WX3 需 WX2 用户确认后另开一轮。W10d–W10h、球形17/25ms最终目标、可选 W9b 与 BACKLOG 非阻塞项都不扩入本轮。
- 本地 main 合并与远端部署是两件事。核对时 main 相对本地 origin/main 引用领先41提交（未 fetch，不代表实时远端状态）；默认不推送。

## 可直接发送的指令

> 读取 docs/world/W10C_MERGE_HANDOFF.md，执行 W10c 合并前收尾。先在隔离工作树补齐最终版本性能测量，定位并修复本阶段预算未达/回归问题，完成相关机器检查和交付记录。保留天气 WX2 工作树的在途改动，不重复实施天气，不开始 W10d。只本地提交，状态待用户确认，不合并、不推送；交付明确的用户看点与剩余阻塞项。
