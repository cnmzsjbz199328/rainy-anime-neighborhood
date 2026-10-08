# 雨音街角 · Rainy Anime Neighborhood

交互式 Three.js 日本雨夜社区微缩模型。当前版本是 96 × 96 的小城道路网（布局 v1）：三条道路、两个十字路口（信号与停车让行）、六个街区和 38 块地块，带斑马线与无台阶坡道、排水、路灯、电杆电线和雨夜水洼；便利店「こもれび MART」、拉面店「雨音らーめん」与三层公寓「こもれび荘」均已升级为独立新建筑；新建筑「雨宿り珈琲」咖啡店（B05-P03）、「はなや しずく」花店（B05-P04）、「こむぎ堂」转角面包店（B03-P01）、「コインランドリー ふわり」洗衣店（B03-P02）、「古書 しおり堂」旧书店（B03-P03）、「ひだまり食堂」食堂（B03-P04）、「みどり屋」雑貨店（B03-P05）「あじさい会館」社区会所（B03-P06）「邮政服务站」（B03-P07）与「雨宿神社」小神社（B03-P08）、「あめまち交番」（B04-P01）「あめまち診療所」（B04-P02）「雨だまり公園」口袋公园（B04-P03）与「辻の小社」街角小神社（B04-P04）「ことのは文具店」三层商住楼（B04-P05）与「ひなた薬局」三层商住楼（B06-P01）、「やまの理髪店」三层商住楼（B06-P02）、「やました文具店」三层商住楼（B06-P03）、「山田修理舗」三层商住楼（B06-P04）、独栋住宅 1（B02-P01）、独栋住宅 2（B02-P02）、独栋住宅 3（B02-P03）、独栋住宅 4（B02-P04）、独栋住宅 5（B02-P05）、独栋住宅 6（B02-P06）、独栋住宅 7（B02-P07）、独栋住宅 8（B02-P08）、独栋住宅 9（B05-P06）、独栋住宅 10（B05-P07）、独栋住宅 11（B05-P08）、独栋住宅 12（B06-P05）、独栋住宅 13（B06-P06）、独栋住宅 14（B06-P07）、独栋住宅 15（B06-P08）与「あめまち小学校」（B01-P01）已建成，35 个原预留地块已全部建成，另完成 S1–S3 三栋样板升级，共 38 栋达到新建筑标准；采用墨线轮廓、程序化淡彩颗粒与分层明暗。

## 运行

直接使用现代浏览器打开 `index.html`，无需安装依赖或访问外部 CDN。浏览器需要支持 WebGL。也可以运行 `python3 -m http.server 8000`，然后访问 http://localhost:8000。

平面模式自由视角：拖动旋转，滚轮或双指缩放。平移（移动旋转中心）有四种方式：鼠标右键拖动、Shift/Ctrl + 左键拖动、触屏双指拖动，或 WASD/方向键（相对当前视线方向）。按 V 或右上角的「街景漫游」切换视角。漫游时桌面用 WASD/方向键相对镜头方向移动（A/← 向左、D/→ 向右）；拖动画面可 360° 环视并保持朝向，不会自动回正，拖动方向与自由视角一致（抓取式）；触屏用左下摇杆移动、拖动画面环视，按钮或 V 返回自由视角。没有人物；雨夜与场景动画在两种视角下持续运行。

球形地图：点击「球形地图」切换。左键或单指拖动抓取并转动星球，可连续翻过两极；右键、Shift/Ctrl + 左键或双指拖动环视，俯仰可到正上方。滚轮或双指捏合缩放（9–400 m）；WASD/方向键沿当前视线在球面移动，速度最高 40 m/s。拉远时星球自动居中，切回平面时目标纬度限制到 ±80°。

## 文件

- `index.html`：包含渲染库、布局数据和场景脚本的单文件交付版。
- `sphere_camera.js`：W8f-b 球形抓取、跨极点朝向与弧长移动；`tools/sphere_camera_check.mjs` 用鼠标、键盘和触屏事件验证 K2–K8，`tools/distant_check.mjs` 比较 `pre-w8f-b` 的远景与加载交接，`tools/joint_shots.mjs` 逐处截图路网全部 42 个连接处（出口、节点、尽头、地标入口、隧道洞口）并检查树冠团不压路，输出 `docs/world/w8f-b/`。
- `scene.js`：可编辑的场景源码；已有样板按命名分组（store、ramen、apartment 等），便于整体放置。
- `layout.js`：道路、街区、地块与样板放置的布局数据（坐标约定见文件头）；`buildings` 登记新建筑的放置、实测包围盒与遮雨区。
- `buildings/<地块>.js`：逐栋新建筑的建模源码（目前 `B05-P01.js` 便利店、`B05-P05.js` 公寓、`B05-P02.js` 拉面店、`B05-P03.js` 咖啡店、`B05-P04.js` 花店、`B03-P01.js` 面包店、`B03-P02.js` 洗衣店、`B03-P03.js` 旧书店、`B03-P04.js` 食堂、`B03-P05.js` 杂货店、`B03-P06.js` 社区会所、`B03-P07.js` 邮政服务站、`B03-P08.js` 雨宿神社、`B04-P01.js` 交番、`B04-P02.js` 诊所、`B04-P03.js` 口袋公园、`B04-P04.js` 街角小神社、`B04-P05.js` 文具店商住楼、`B06-P01.js` 药店商住楼、`B06-P02.js` 理发店商住楼、`B06-P03.js` 小文具店商住楼、`B06-P04.js` 修理铺商住楼、`B02-P01.js` 独栋住宅 1、`B02-P02.js` 独栋住宅 2、`B02-P03.js` 独栋住宅 3、`B02-P04.js` 独栋住宅 4、`B02-P05.js` 独栋住宅 5、`B02-P06.js` 独栋住宅 6、`B02-P07.js` 独栋住宅 7、`B02-P08.js` 独栋住宅 8、`B05-P06.js` 独栋住宅 9、`B05-P07.js` 独栋住宅 10、`B05-P08.js` 独栋住宅 11、`B06-P05.js` 独栋住宅 12、`B06-P06.js` 独栋住宅 13、`B06-P07.js` 独栋住宅 14、`B06-P08.js` 独栋住宅 15、`B01-P01.js` 小学），用 scene.js 提供的同一套墨线、toon、纸纹工具绘制。
- `tools/`：布局与浏览器检查工具。`measure_samples.mjs` 在 Chromium 中实测样板与新建筑尺寸；`layout_check.mjs` 检查布局（C12 检查新建筑实测模型）并生成 `docs/layout/` 下的俯视检查图和报告；`building_views.mjs` 输出新建筑的八视图实景截图与渲染成本；`live_topdown.mjs` 渲染实景俯视并叠加布局线；`views.mjs` 检查首帧、控制台和交互，并输出审查截图。
- `PROGRESS.md`：分阶段进度、检查结果和待验证项。
- `docs/layout/LAYOUT_V1.md`：冻结的首版道路与地块坐标，以及新增建筑时的变更规则。
- `ROAD_NETWORK_PLAN.md`：道路与用地建设计划。
- `WORLD_PLAN.md`：星球化建设计划（城镇以外的地形、区域、全球路网和地标）；参考包在 `docs/world/`。
- `bend.js`：弯曲渲染（W2）：把平面城镇按墨卡托映射卷到半径 90 的球面，只在顶点着色器里发生；`uBend` 为 0 时与原来逐位相同，W8e-a 已通过地图模式按钮控制，测试钩子 `window.__scene.bend.set(0..1)` 保留；W8e-b 起平面图经度为 [−85°, 275°)：接缝以西的内容在着色器里平移 2πR（实例按原点、其余按顶点；跨接缝的世界坐标网格与线在构建后由 `BEND.seamSplit` 沿接缝切开），加上按世界坐标的边缘雾（东西接缝处不透明、向内 12° 渐清，南北 80° 起、84.5° 不透明，强度 ×(1 − uBend)），`tools/seam_check.mjs` 检查；`tools/regress.mjs` 做确定性像素回归，`tools/bend_check.mjs` 检查点光源、顶点与法线，`tools/bend_shots.mjs` 出弯曲截图（`docs/world/w2/`）。W8f-a：`BEND.tessellate` 给城镇里水平边长于 4 m 的网格与墨线生成细分副本（按边中点递归切分，两侧切法相同、无裂缝，球面下沉 ≤ 2.2 cm），首次进入球形时生成、`uBend > 0` 时换上，平面城镇仍画原几何；`tools/w8f_check.mjs`（A1 栈道板子、B1 洋红背景下的城镇无洞、B3 代价，`--shots` 出 `docs/world/w8f/`）。
- `terrain.js`：星球地形网格（W3）：把 `world.js` 的高度与区域建成平面（墨卡托）坐标的网格，交给 `bend.js` 卷到球面；补丁外 24 m 的渐变带（TR01）与 9 个出口的道路起点在 `uBend = 0` 时可见，其余地形与两极帽在 `uBend > 0` 时出现；`tools/terrain_check.mjs` 检查 W3-C0–C6，`tools/terrain_shots.mjs` 出截图（`docs/world/w3/`）。
- `world.js`：星球布局数据（W1）：经纬度区域、高度骨架、河流、地标锚点与全球路网，无 THREE/DOM，不进入页面；`tools/world_check.mjs` 检查 WC1–WC11，`tools/world_survey.mjs` 生成勘探图（`docs/world/survey/`）；冻结清单见 `docs/world/WORLD_LAYOUT_V1.md`。
- `three.min.js`：Three.js 0.160.1，保留原始版权头。
- `flora.js`、`section_plan.js`、`roadkit.js`、`water.js`、`section.js`：W4 样板断面（ST03，补丁南缘到南海湾对岸 59.5 m）：实例化物件库、由 `world.js` 驱动的放置计划、沿 `samplePath` 扫出的道路横断面（RD03/04/05/07）、水面涟漪着色器、断面装配与墨线分级；断面在 `uBend > 0` 或 `view.set({ mode: 'section' })` 时才生成并显示（默认画面不构建）。测试钩子 `window.__scene.section.set({ rain, light: 'rainy'|'neutral'|'panorama', ink: 'auto'|'ground'|'aerial'|'panorama' })`；`tools/section_check.mjs`（W4-C1–C8）、`tools/section_shots.mjs`（`docs/world/w4/`）、`tools/section_extrapolate.mjs`（外推表）、`node tools/regress.mjs --views section`（确定性）。
- `roads.js`、`bridge.js`、`steps.js`、`lightband.js`：W5 全球路网（W5a + W5b，W5_SPEC）：`steps.js` 是 RD06 石阶（踏步沿地形等高切出，绳索扶手、鸟居、灯笼、地藏、长凳）；`roadkit.js` 的 `route()` 把任意一串边扫成一条连续的路面（相邻等级渐变、城镇出口的磨损、RD01 的路基与路灯），`bridge.js` 做 RD02 箱梁桥（桥墩、斜拉塔、航道灯），`roads.js` 装配全部 RD01/RD02/RD03/RD05/RD06/RD08、隧道口、9 个出口的渐变、路灯、电杆电线、检修楼梯、地标入口导引柱与涟漪，`lightband.js` 是夜间全景的光带；在 `uBend > 0` 或 `view.set({ mode: 'section' })` 时才构建（默认画面不构建）。测试钩子 `window.__scene.roads`（`setLightBand({ distance })`、`stats()`、`data()`）；`tools/road_check.mjs`（W5-C1–C7、C9、C10 衔接、C11 预算与动态）、`tools/road_shots.mjs`（`docs/world/w5/`）。W8f-a 衔接：6 个桥台由路与桥共用一条公共切线的过渡曲线（每侧 ≤ 12 m），路侧桥头引道带竖曲线（≤ 14 m，填方抬高、桥面不降低），断面渐变为桥面断面（RD01B），护栏块与桥栏无缝相接，虚线按 T01 全线连续里程，桥台端墙；5 个 T 形路口（J-T04、J-T07、J-T08、J-T09、LM09-north）有带圆角的路口铺装、口门内边沟填平且无护栏，支路末端坡接；9 个出口头 6 m 用城镇自己的沥青材质，再 8 m 渐变到道路等级的颜色。
- `ocean.js`：W6a 海洋与海岸（BI01、TR02）：全球水面网格（由 W3 地形网格的顶点高度生成，带符号水深）、水面着色器（雨点涟漪、低涌浪、月光反光带、浪花线）、海岸线墨线、礁石、海藻暗影、有路靠岸处的海堤与消波块；在 `uBend > 0` 或 `view.set({ mode: 'section' })` 时才构建；测试钩子 `window.__scene.ocean`；`tools/ocean_check.mjs`（W6-C1–C4）、`tools/ocean_shots.mjs`（`docs/world/w6a/`）。
- `landcover.js`：W6b–W6e 地表覆盖：农田（BI05、BI06、TR04、TR01：Voronoi 田块、梯田与茶树、城镇四边的路肩草带与竹篱）、森林与林缘（BI02、TR03）、草原与沙漠（BI03、BI04、TR07：草丛、岩柱、沙丘覆盖网格）、冰原、熔岩原、山地碎石与雨见岳雾带（BI07、BI08、BI09），全部小物件建成全球实例表、按相机周围 16 m 瓦片加载（加载圈外缘 10 m 缩放淡入，离地 90–110 m 渐隐；更远处由密度烘焙地表色与 16 m 瓦片树冠团接替）；地形顶点色（terrain.js）负责雪线、岩色与区域边界软化（TR05–TR07）；测试钩子 `window.__scene.cover`；`tools/cover_check.mjs`（W6-C1–C3，含 W6c–W6e 各项）、`tools/cover_shots.mjs`、`tools/forest_shots.mjs`、`tools/grass_shots.mjs`、`tools/highland_shots.mjs`（`docs/world/w6b/` … `w6e/`）。
- `transition.js`：W8e-a 视图模式：右上角按钮在平面/球形之间约 2 秒可逆切换；缩放只调远近，两种模式均为 9–400 m，共享目标位置。平面可平移到全图，城镇外近景显示地形、道路与地貌；漫游/剖视仅平面城镇内可用。`window.__scene.transition.setMode('flat'|'sphere')`、`view.set({mapMode})`；`TR.auto=false` 与 `bend.set()` 保留。检查 `tools/transition_check.mjs`，截图 `docs/world/w8e/`。W8e-b：平移范围 x ∈ [接缝, 接缝 + 2πR]（`TR.xMin/xMax`），纬度 ±80°，球形经度环绕到同一区间；截图 `docs/world/w8e/edge-*.png`、`seam-bridge-*.png`、`lm07.png`。球形白天与天气待 W8e-c。
- `daylight.js`：W8e-c 球形晴朗白天（D9 修订）：uDay = uBend，只在渲染时（`scene.onBeforeRender` 设、`onAfterRender` 还原）把背景与雾色换成白天天空、月光换成固定方向（目标点局部天空里高约 49°、来自西南）的暖白日光、天光沿局部向上、海面反光随日光；自发光与加法混合的光由 `bend.js` 片元 × (1 − uBend)；不做每栋建筑的日间状态。`window.__scene.day`；检查 `tools/day_check.mjs`（球形下天气恒为晴朗、线性淡出、日光与还原、中间帧无闪烁），截图 `docs/world/w8e/day-*.png`。
- `weather.js`、`weather_fx.js`：W8b 天气（D8 / ST05）：按位置与时间确定性地给出雨、雨后、阴、晴夜、雪、雾六种状态（渐变 ≥ 40 s，雨最久，无 `Math.random`），表现只用已有的雨丝、涟漪、天光月光、雾与一层雪粒子，按相机离地高度 `w_local(h)` 淡出，全景永远是晴夜；`window.__scene.weather`（`lock`、`setTime`、`get`、`at`）；`tools/weather_check.mjs`、`node tools/regress.mjs --weather lock:rain`；截图 `docs/world/w8/st05-*.png`。 W8e-c：球形模式在任何距离都晴朗（所有天气效果 × (1 − uBend)，切换时线性淡出/淡入），`weather_check` 与 `regress --weather lock:rain` 针对平面模式。
- `nightlight.js`、`stars.js`：W8c 夜间表现：路灯（40–60 m 淡出）与光带（40–120 m 淡入）按相机高度交接、全景可读光照（天光与月光按 `1 − w_local(h)` 混到 ×1.5，只在 `uBend > 0` 时）、便利店 / 温泉村 / 渔港 / 灯塔的远景暖光点、星空；`window.__scene.night`；`tools/night_check.mjs`（C1–C4，`--shots` 出 `docs/world/w8/night-*.png`）。W8d：`tools/wc14_check.mjs`（WC14：全景无天气、四个方向可读）、`tools/w8_perf.mjs`（性能总表）。 W8e-c：星空、光带、远景暖光点与可读性光照在 `uBend > 0` 时为 0（平面模式不变），`night_check` 改为只检查平面模式。 W8f-b：`wc14_check` 的 A 与 B 的应用路径走球形模式，C、D（夜间光带与远景光点）改在平面夜间离地 350 m 的四处测。
- `build.py`：将源码（three.min.js、bend.js、layout.js、world.js、terrain.js、flora.js、section_plan.js、roadkit.js、bridge.js、steps.js、lightband.js、water.js、section.js、roads.js、ocean.js、landcover.js、transition.js、weather.js、weather_fx.js、nightlight.js、stars.js、daylight.js、buildings/*.js、landmarks/*.js、scene.js）按依赖顺序内嵌到单文件 HTML。
- `DESIGN.md`：风格约束与扩展路线。
- `THIRD_PARTY_NOTICES.md`：第三方许可说明。

修改 `scene.js`、`layout.js` 或 `buildings/` 后运行 `python3 build.py`，更新 `index.html`；不要同时手工编辑生成文件和源码。

布局检查需要 Node 与 Playwright（Chromium）：先运行 `node tools/measure_samples.mjs`，再运行 `node tools/layout_check.mjs --png`；实景检查运行 `node tools/live_topdown.mjs` 与 `node tools/views.mjs`；新建筑截图与成本运行 `node tools/building_views.mjs B05-P03`。

## 当前效果

雨丝、屋檐滴水、玻璃雨滴、沿边沟和内巷的水洼涟漪、路灯光斑与水面倒影、间歇自动门、灯箱轻微闪烁、X01 四向信号灯相位切换；可见商店货架、冷柜、拉面吧台和厨房；咖啡店透窗可见靠窗座、双人桌、咖啡吧与备料间，有窗雨、檐水和极淡咖啡热气。

在线演示：https://komorebi-rainy-corner.nxnp5gf8sp.chatgpt.site

该演示目前独立通过 Sites 发布。

## 部署到 Cloudflare Workers

`wrangler.jsonc` 将项目配置为纯静态资源 Worker；`.assetsignore` 保证只公开 `index.html`。

通过 Cloudflare 的 Git 集成自动部署（Workers Builds）：

1. Cloudflare 控制台 → Workers & Pages → Create → Import a repository，选择本仓库。
2. 项目名填 `rainy-anime-neighborhood`（需与 `wrangler.jsonc` 中的 `name` 一致）。
3. Build command 留空（`index.html` 已提交在仓库中）；Deploy command 保持 `npx wrangler deploy`。
4. 保存后，每次推送到 `main` 都会自动部署到 `https://rainy-anime-neighborhood.<子域>.workers.dev`。

也可以本地手动部署：`npx wrangler login && npx wrangler deploy`。

## 验证状态

已在无头 Chromium（SwiftShader 软件 WebGL）中检查：首帧渲染、无控制台错误，旋转、缩放、平移及其边界，降雨、涟漪和信号灯动画；布局检查 C1–C12 全部通过。尚未在真实 GPU、iPad/手机上验证视觉效果和性能。道路建设的阶段进度见 PROGRESS.md。

## 下一阶段：逐栋建筑构建

建筑设计参考包已就绪：覆盖 38 个地块，含 38 张任务卡与 38 张八视图设计板。B05-P02 雨音らーめん（[实际模型截图](docs/buildings/screenshots/B05-P02/)）、B05-P05 こもれび荘三层公寓（[实际模型截图](docs/buildings/screenshots/B05-P05/)）、B05-P03 咖啡店（[实际模型截图](docs/buildings/screenshots/B05-P03/)）、B05-P04 花店（[实际模型截图](docs/buildings/screenshots/B05-P04/)）、B03-P01 转角面包店（[实际模型截图](docs/buildings/screenshots/B03-P01/)）、B03-P02 洗衣店（[实际模型截图](docs/buildings/screenshots/B03-P02/)）、B03-P03 旧书店（[实际模型截图](docs/buildings/screenshots/B03-P03/)）、B03-P04 食堂（[实际模型截图](docs/buildings/screenshots/B03-P04/)）、B03-P05 杂货店（[实际模型截图](docs/buildings/screenshots/B03-P05/)）B03-P06 社区会所（[实际模型截图](docs/buildings/screenshots/B03-P06/)）B03-P07 邮政服务站（[实际模型截图](docs/buildings/screenshots/B03-P07/)）、B03-P08 雨宿神社（[实际模型截图](docs/buildings/screenshots/B03-P08/)）、B04-P01 交番（[实际模型截图](docs/buildings/screenshots/B04-P01/)）B04-P02 诊所（[实际模型截图](docs/buildings/screenshots/B04-P02/)）B04-P03 口袋公园（[实际模型截图](docs/buildings/screenshots/B04-P03/)）与 B04-P04 街角小神社（[实际模型截图](docs/buildings/screenshots/B04-P04/)）、B04-P05 文具店商住楼（[实际模型截图](docs/buildings/screenshots/B04-P05/)）、B06-P01 药店商住楼（[实际模型截图](docs/buildings/screenshots/B06-P01/)）、B06-P02 理发店商住楼（[实际模型截图](docs/buildings/screenshots/B06-P02/)）、B06-P03 小文具店商住楼（[实际模型截图](docs/buildings/screenshots/B06-P03/)）、B06-P04 修理铺商住楼（[实际模型截图](docs/buildings/screenshots/B06-P04/)）、B02-P01 独栋住宅 1（[实际模型截图](docs/buildings/screenshots/B02-P01/)）、B02-P02 独栋住宅 2（[实际模型截图](docs/buildings/screenshots/B02-P02/)）、B02-P03 独栋住宅 3（[实际模型截图](docs/buildings/screenshots/B02-P03/)）、B02-P04 独栋住宅 4（[实际模型截图](docs/buildings/screenshots/B02-P04/)）、B02-P05 独栋住宅 5（[实际模型截图](docs/buildings/screenshots/B02-P05/)）、B02-P06 独栋住宅 6（[实际模型截图](docs/buildings/screenshots/B02-P06/)）、B02-P07 独栋住宅 7（[实际模型截图](docs/buildings/screenshots/B02-P07/)）、B02-P08 独栋住宅 8（[实际模型截图](docs/buildings/screenshots/B02-P08/)）、B05-P06 独栋住宅 9（[实际模型截图](docs/buildings/screenshots/B05-P06/)）、B05-P07 独栋住宅 10（[实际模型截图](docs/buildings/screenshots/B05-P07/)）、B05-P08 独栋住宅 11（[实际模型截图](docs/buildings/screenshots/B05-P08/)）、B06-P05 独栋住宅 12（[实际模型截图](docs/buildings/screenshots/B06-P05/)）、B06-P06 独栋住宅 13（[实际模型截图](docs/buildings/screenshots/B06-P06/)）、B06-P07 独栋住宅 14（[实际模型截图](docs/buildings/screenshots/B06-P07/)）、B06-P08 独栋住宅 15（[实际模型截图](docs/buildings/screenshots/B06-P08/)）已实现，B01-P01 院落型小学（[实际模型截图](docs/buildings/screenshots/B01-P01/)）也已完成，35 个原预留地块全部建成，三栋旧样板均已升级；下一步 S4 清理退役代码。

- [建筑参考包入口](docs/buildings/README.md)
- [统一规格](docs/buildings/BUILDING_SPEC.md)
- [实施队列](docs/buildings/BUILDING_QUEUE.md)
- [38 张八视图图库](docs/buildings/GALLERY.md)
- [逐栋实施提示词（通用模板）](docs/buildings/AGENT_START.md)：每轮只需告诉 Agent「读取 docs/buildings/AGENT_START.md 并执行，本轮地块：B01-P01（35 个预留地块已全部建成，此例仅示范格式）」

35 个原预留地块已建成，S1–S3 已升级拉面店、公寓与便利店（共 38 栋达到新建筑标准）；下一阶段 S4 清理旧代码。尺寸、入口和高度以 layout.js 为准，参考图只是外观/结构概念。参考包自检：`node docs/buildings/check_kit.mjs`。


## 规划中：星球化

计划把城镇放到一颗可旋转的手绘小星球上，城镇以外有农田、森林、山脉、火山、海洋、冰盖、遗迹，由全球路网连接。平面地图（含城镇）是夜晚，按时间和位置切换局部天气；球形地图（按钮切换）是晴朗白天（D8/D9 于 2026-10-07 修订）。目前 W0、W1（星球布局 v1 已冻结）、W2（弯曲渲染）、WS（W3–W8 规格）、W3（地形网格）、W4（样板断面，已确认）、W5a（RD01/RD02 全球主干道与桥、光带）与 W5b（石阶、雪道标杆、RD03 设施、检修楼梯、地标入口）已完成：W3–W8 的精确规格在 [docs/world/](docs/world/README.md)；总计划、统一规格和 39 张设计卡已就绪，39/39 张参考图已生成并审查（`check_kit.mjs --refs` 通过，ST01 风格已确认）；`world.js` 与勘探图（[星球布局 v1](docs/world/WORLD_LAYOUT_V1.md)）已出，`node tools/world_check.mjs` WC1–WC11 全部通过；地形、道路、地貌与 10 个地标（W6、W7）、卷曲过渡（W8a）、天气（W8b）与夜间表现（W8c）已进入页面，W8e-a 已把缩放与形态解耦，通过按钮从平面地图切换到球形地图；W8e-b 把平面图接缝移到西海 −85° 并加边界雾；W8e-c 起球形模式是晴朗白天（无雨雪雾云），平面地图保持夜景与局部天气。W8d 真机项待 W8e 完成后验证。

- [星球计划](WORLD_PLAN.md)
- [星球规划参考包](docs/world/README.md)
- [参考图生成提示词（图像 Agent 通用模板）](docs/world/IMAGE_AGENT_START.md)：每轮只需告诉 Agent「读取 docs/world/IMAGE_AGENT_START.md 并执行，本轮卡片：ST01」
