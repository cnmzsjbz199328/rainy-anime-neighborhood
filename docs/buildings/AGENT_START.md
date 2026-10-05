# 逐栋建筑实施提示词（通用模板）

你是本仓库的 Three.js 建筑实施 Agent。每一轮只在当前 main 上完成**一个地块**，交付可验收的实现，不要只返回计划。

## 如何使用本模板

每轮只需给 Agent 一句话：

> 读取 docs/buildings/AGENT_START.md 并执行，本轮地块：B05-P04。

- **本轮地块**以用户给出的编号为准。若用户没给，取 [BUILDING_QUEUE.md](BUILDING_QUEUE.md) 中阶段最小、排序最前的「待建」地块，并在开始时说明选了哪一个。
- 下文中的 `<地块>` 指本轮地块编号（如 `B05-P04`），`<入口x>` 指任务卡「入口」一行给出的坐标（南北朝向的地块看 x，东西朝向的地块看 z）。
- 名称、用途、尺寸、入口、限高全部从 `docs/buildings/tasks/<地块>.md` 和实际 `layout.js` 读取，本模板不写死任何一栋的数值。
- 已有样板（B05-P01 便利店、B05-P02 拉面店、B05-P05 公寓）的升级不属于本模板，需要单独任务。

## 本轮范围

- 只实现 `<地块>` 一栋。道路布局 v1 已冻结；三栋旧样板、已完成的新建筑和其他空地都保持原状。
- 不要顺手实施队列里的下一栋，也不要自动做整份 38 地块清单。完成并验收本栋后停止。

## 先读

1. AGENTS.md（若存在）、README.md、PROGRESS.md（尤其「P5」各节），docs/layout/LAYOUT_V1.md，实际 layout.js。
2. [BUILDING_SPEC.md](BUILDING_SPEC.md)、[REFERENCE_REVIEW.md](REFERENCE_REVIEW.md)、catalog.json 与 IMAGE_PROMPTS.json 中本地块的条目。
3. `docs/buildings/tasks/<地块>.md` 与 `docs/buildings/references/<地块>.jpg`。**直接查看参考图，不要只读文件名。**图中门窗、屋顶如跨视图矛盾，以任务卡结构和 layout.js 尺寸为准，并在任务卡记录裁决。
4. **参考实现**（必须读，照它的方式做）：
   - [buildings/B05-P03.js](../../buildings/B05-P03.js)：咖啡店建模源码，文件头说明了本地坐标、分组和平面；
   - [tasks/B05-P03.md](tasks/B05-P03.md) 的「实施记录」：尺寸、裁决和残留问题的写法；
   - scene.js 中 `warm` / `wall` / `panel` / `bake` 与建筑加载段；layout.js 的 `buildings` 登记；tools/layout_check.mjs 的 C12；tools/building_views.mjs。

## 必须沿用的集成方式

这些约定已在 B05-P03 验证过，不要另起一套。

- **源码位置**：新建 `buildings/<地块>.js`，注册 `BUILDINGS['<地块>'] = (K, rec) => { …; return { update(t, dt) {…} }; }`。build.py 会按 three → layout → buildings/*.js → scene 的顺序自动嵌入，不需要改 build.py。
- **本地坐标**：前方 +Z 朝向地块入口，门中心作原点，地坪高度取 `rec.floor`。放置只用平移、绕 Y 旋转 90° 的倍数、统一尺度 1（朝 N 时 `rotY: Math.PI`）。
- **分组命名**：以建筑 id 为前缀，例如 `florist`、`floristFrontE`、`floristService`、`floristGround`。主体一个分组（role `building`，含雨棚、檐口、招牌、落水管）。附属设施按位置分成几个小分组（role `attachment`），**不要把门两侧的东西放进同一分组**：C7/C12 按分组包围盒找通行路径，合成一个会堵住门口。地坪铺装与光斑用 role `ground`。
- **共享工具**：只用 kit 提供的 `mat`、`warm`（室内暖色自发光）、`wall`（带洞口整墙）、`panel`（室内饰面）、`glass`、`glow`、`label`、`canvasTex` 等，沿用同一套墨线、toon 色阶和纸纹。确实缺少的通用工具加到 scene.js 的 kit 里，并保持对旧样板无影响。
- **合批与分层**：加载器会对每个登记分组执行 `bake()`，所以静态细节不必顾虑绘制调用数量。动画物件放在 `userData.live = true` 的分组里；屋顶、女儿墙、屋顶设备和天花板放在 `userData.layer = 'roof'` 的分组里，剖视截图会移除这一层。多层建筑的楼层可用 `layer: 'f2'` 等，如截图需要分层剖视，扩展 building_views.mjs。
- **登记数据**：在 layout.js 的 `buildings` 中登记（**不要放进 `samples`**），字段照 `cafe`：`id, name, plot, module, transform, door, frontDir, floor, floors, shelter, parts`。地块改为 `status: 'occupied', building: '<id>'`。`parts` 的 localBounds 必须是 `node tools/measure_samples.mjs` 的实测值。
- **遮雨**：`shelter` 列出屋顶与每个雨棚的本地矩形，场景据此排除雨滴。C12 会检查遮雨区都在实测主体内，并且屋顶覆盖墙体。
- **入口**：门的世界坐标必须落在冻结入口 `<入口x>` 上。入口决定路灯和电杆的避让区，门位偏移会移动街道设施，C12 会报错。

## 工作步骤

1. **检查与计划**：查看 git 状态与未提交变更，保留他人的工作；确认 Node 与全局 Playwright 可用。先输出本栋的简短计划，包括：
   - 占地、退界、入口和门位；
   - 楼层与屋顶高度；
   - 家具平面与主通路；
   - 分组及其 role；
   - 参考图的左右对应哪个世界方向（LEFT/RIGHT 按站在正面看理解）。

   然后继续实现，不要停下等确认。
2. **粗模先实测**：先建外壳、雨棚、附属位置，执行 `python3 build.py` 和 `node tools/measure_samples.mjs`，确认整体在可建范围内后再细化。
   - 前雨棚、后门雨棚和外摆都占可建进深。咖啡店按建议进深 6.5 实测时，后雨棚越过后退界 0.5，最终改为 6.05。
   - 任务卡的建议尺寸是候选，不是放置证明。
3. **外观**：四个立面和屋顶都要完整，背面不能是白墙。要有真实墙厚、门窗框和竖梃、窗台、基座、檐口或女儿墙、落水管、设备支架。招牌原创，用 CanvasTexture 绘制。
4. **室内**：透过玻璃要能读出近、中、后三层：靠窗陈列或家具、中部通路、后部设备或隔墙。主通路 ≥ 0.9；柜台 0.85–1.05，门净高 2.0–2.2，椅面 0.42–0.48。用途必须和已建各栋明显不同，不套模板。
5. **雨夜与动画**：外部冷蓝，室内柔暖；用 `warm` 材质加叠加光斑，**不新增实时光源**（确需新增时说明性能代价）。局部动画 1–3 处，动作要轻，不复制便利店的自动门、闪烁灯，也不复制咖啡店的热气，除非本栋用途确实需要。全局降雨、水洼和街道反光直接复用。
6. **登记与检查**：把实测包围盒写进 layout.js，补齐 `shelter`；运行下方全部验收命令。失败时修模型，**不能缩放道路或改地块来适配建筑**。
7. **截图**：`node tools/building_views.mjs <地块>` 会输出四立面、屋顶、剖视、两个斜视、透窗近景、默认视角和全城视角，保存在 `docs/buildings/screenshots/<地块>/`。**逐张查看**，确认：
   - 雨不穿屋顶；
   - 窗后家具可见；
   - 台阶、花盆和设备落地；
   - 透明面不闪烁；
   - 邻栋不遮挡便利店主要窗面。

   截图必须是实际实现，不得用参考图冒充。
8. **文档**：按下方清单更新。
9. **提交**：在 main 上提交一次，提交范围只含本栋及必要的集成改动，然后 `git push -u origin main`。推送会触发 Cloudflare 自动部署，所以只推送检查全部通过的版本。

## 验收命令（全部通过才提交）

```
python3 build.py
node tools/measure_samples.mjs          # recorded bounds match measurement，页面无错误
node tools/layout_check.mjs --png       # C1–C12 全部 PASS（C12 必须列出本栋）
node tools/live_topdown.mjs             # 实景俯视与登记包围盒对齐（裁剪本地块查看）
node tools/views.mjs                    # 9 项交互/动画检查通过，控制台无错误
node tools/building_views.mjs <地块>    # 无页面错误，局部动画在动；记录绘制调用/三角形/帧时间
node docs/buildings/check_kit.mjs       # 参考包与 layout.js 一致
```

另外建议把冻结数据与 `origin/main` 逐项比对：`roads`、`furniture`、`poleLines`、`puddles`、`samples` 等派生数据都应完全一致，只允许本地块的记录变化（方法见 PROGRESS.md「P5 B05-P03」）。

## 文档更新清单

- `docs/buildings/tasks/<地块>.md`：
  - 勾选验收清单；
  - 「实施记录」写明实际尺寸与放置、设计裁决、残留与待验证项；
  - 状态改为已实现。
- `docs/buildings/catalog.json`：本条 `status`、`implementationStatus` 改为 `implemented`；`entrances` 补上 layout.js 派生的 `door`，否则 check_kit 会报 stale entrances。只改本条，保持原格式。
- 以下文件中本地块的状态与链接：
  - `BUILDING_QUEUE.md`；
  - `GALLERY.md`；
  - `docs/buildings/README.md`；
  - `docs/layout/LAYOUT_V1.md`（地块表和新建筑放置列表）；
  - 根目录 `README.md`（概述里的建成数量）。
- `PROGRESS.md`：
  - 阶段表加一行；
  - 新增「P5 <地块> <名称>」一节，写清集成改动、实际尺寸、检查结果、性能成本（显示/隐藏本栋的绘制调用与三角形差值）、残留问题；
  - 更新「下一阶段第一项具体任务」。

## 不得做

- 不改道路、交叉口、街区边界、`LEVELS`、街道设施，也不改其他地块和已有建筑。冻结布局确需修改时，停下来报告具体原因。
- 不把新建筑登记进 `samples`，也不修改三栋旧样板的建模代码或尺度。
- 不手工编辑 index.html（只用 build.py 生成），不引入外网依赖，不把参考图嵌入运行页面。
- 不虚报真实设备测试：SwiftShader 的帧时间只代表本环境，真机项保留为「待验证」。

## 遇到阻碍

先修复能独立解决的问题。以下情况停下并报告具体阻碍和已完成的部分：

- 地块的实际边界、入口与任务卡不一致；
- 缺少外部凭证；
- 确实需要修改冻结布局。

已知环境问题：SwiftShader 很慢，截图前要等相机生效（工具里已等待两帧）。live_topdown 偶发截图超时的问题已修复；如再出现，先单独重跑确认。

## 最后回复用户

给出以下内容：

- 提交链接；
- 可用预览地址（仅限本轮实际验证过的）；
- 实际截图路径；
- 每条检查的结果；
- 性能成本；
- 尚未解决的事项；
- 下一轮地块编号。

## 已完成轮次

| 地块 | 名称 | 提交 | 截图 |
| --- | --- | --- | --- |
| B05-P03 | 雨宿り珈琲 咖啡店（参考实现） | 8095761 | [screenshots/B05-P03](screenshots/B05-P03/) |
| B05-P04 | はなや しずく 邻里花店 | b9a4245 | [screenshots/B05-P04](screenshots/B05-P04/) |
| B03-P01 | こむぎ堂 转角面包店 | b2263a3 | [screenshots/B03-P01](screenshots/B03-P01/) |
| B03-P02 | コインランドリー ふわり 洗衣店 | 535bf67 | [screenshots/B03-P02](screenshots/B03-P02/) |
| B03-P03 | 古書 しおり堂 旧书店 | c58009c | [screenshots/B03-P03](screenshots/B03-P03/) |
| B03-P04 | ひだまり食堂 食堂 | b9e1511 | [screenshots/B03-P04](screenshots/B03-P04/) |
| B03-P05 | みどり屋 雑貨店 杂货店 | 89a33b3 | [screenshots/B03-P05](screenshots/B03-P05/) |
| B03-P06 | あじさい会館 社区会所（首个两层） | 见 PROGRESS.md「P5 B03-P06」 | [screenshots/B03-P06](screenshots/B03-P06/) |
| B03-P07 | 邮政服务站 | 见 PROGRESS.md「P5 B03-P07」 | [screenshots/B03-P07](screenshots/B03-P07/) |
| B03-P08 | 雨宿神社 小神社与庭院（首个公园/神社） | 见 PROGRESS.md「P5 B03-P08」 | [screenshots/B03-P08](screenshots/B03-P08/) |
| B04-P01 | あめまち交番 | 见 PROGRESS.md「P5 B04-P01」 | [screenshots/B04-P01](screenshots/B04-P01/) |
| B04-P02 | あめまち診療所 诊所 | 见 PROGRESS.md「P5 B04-P02」 | [screenshots/B04-P02](screenshots/B04-P02/) |
| B04-P03 | 雨だまり公園 公交旁口袋公园 | 见 PROGRESS.md「P5 B04-P03」 | [screenshots/B04-P03](screenshots/B04-P03/) |
| B04-P04 | 辻の小社 街角小神社 | 见 PROGRESS.md「P5 B04-P04」 | [screenshots/B04-P04](screenshots/B04-P04/) |
| B04-P05 | ことのは文具店 底层文具店商住楼（首个三层） | 见 PROGRESS.md「P5 B04-P05」 | [screenshots/B04-P05](screenshots/B04-P05/) |
| B06-P01 | ひなた薬局 底层药店商住楼 | 见 PROGRESS.md「P5 B06-P01」 | [screenshots/B06-P01](screenshots/B06-P01/) |
| B06-P02 | やまの理髪店 底层理发店商住楼 | 见 PROGRESS.md「P5 B06-P02」 | [screenshots/B06-P02](screenshots/B06-P02/) |
| B06-P03 | やました文具店 底层小文具店商住楼 | 见 PROGRESS.md「P5 B06-P03」 | [screenshots/B06-P03](screenshots/B06-P03/) |
| B06-P04 | 山田修理舗 底层修理铺商住楼 | 见 PROGRESS.md「P5 B06-P04」 | [screenshots/B06-P04](screenshots/B06-P04/) |
| B02-P01 | 独栋住宅 1（首个独栋住宅） | 见 PROGRESS.md「P5 B02-P01」 | [screenshots/B02-P01](screenshots/B02-P01/) |
| B02-P02 | 独栋住宅 2 | 见 PROGRESS.md「P5 B02-P02」 | [screenshots/B02-P02](screenshots/B02-P02/) |
| B02-P03 | 独栋住宅 3 | 见 PROGRESS.md「P5 B02-P03」 | [screenshots/B02-P03](screenshots/B02-P03/) |
| B02-P04 | 独栋住宅 4 | 见 PROGRESS.md「P5 B02-P04」 | [screenshots/B02-P04](screenshots/B02-P04/) |
| B02-P05 | 独栋住宅 5（北排第一栋） | 见 PROGRESS.md「P5 B02-P05」 | [screenshots/B02-P05](screenshots/B02-P05/) |
| B02-P06 | 独栋住宅 6 | 见 PROGRESS.md「P5 B02-P06」 | [screenshots/B02-P06](screenshots/B02-P06/) |
| B02-P07 | 独栋住宅 7 | 见 PROGRESS.md「P5 B02-P07」 | [screenshots/B02-P07](screenshots/B02-P07/) |

每轮完成后在此表追加一行。
