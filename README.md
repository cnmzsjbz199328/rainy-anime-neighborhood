# 雨音街角 · Rainy Anime Neighborhood

交互式 Three.js 日本雨夜社区微缩模型。当前版本是 96 × 96 的小城道路网（布局 v1）：三条道路、两个十字路口（信号与停车让行）、六个街区和 38 块地块，带斑马线与无台阶坡道、排水、路灯、电杆电线和雨夜水洼；便利店、拉面店和三层公寓已就位，新建筑「雨宿り珈琲」咖啡店（B05-P03）、「はなや しずく」花店（B05-P04）与「こむぎ堂」转角面包店（B03-P01）已建成，其余 32 块地块留作将来的建筑用地，每块都验证过放得下候选建筑及其停车/后勤空间；采用墨线轮廓、程序化淡彩颗粒与分层明暗。

## 运行

直接使用现代浏览器打开 `index.html`，无需安装依赖或访问外部 CDN。浏览器需要支持 WebGL。也可以运行 `python3 -m http.server 8000`，然后访问 http://localhost:8000。

拖动旋转，滚轮或双指缩放，鼠标右键拖动平移。没有可见 UI，也没有人物。

## 文件

- `index.html`：包含渲染库、布局数据和场景脚本的单文件交付版。
- `scene.js`：可编辑的场景源码；已有样板按命名分组（store、ramen、apartment 等），便于整体放置。
- `layout.js`：道路、街区、地块与样板放置的布局数据（坐标约定见文件头）；`buildings` 登记新建筑的放置、实测包围盒与遮雨区。
- `buildings/<地块>.js`：逐栋新建筑的建模源码（目前 `B05-P03.js` 咖啡店、`B05-P04.js` 花店、`B03-P01.js` 面包店），用 scene.js 提供的同一套墨线、toon、纸纹工具绘制。
- `tools/`：布局与浏览器检查工具。`measure_samples.mjs` 在 Chromium 中实测样板与新建筑尺寸；`layout_check.mjs` 检查布局（C12 检查新建筑实测模型）并生成 `docs/layout/` 下的俯视检查图和报告；`building_views.mjs` 输出新建筑的八视图实景截图与渲染成本；`live_topdown.mjs` 渲染实景俯视并叠加布局线；`views.mjs` 检查首帧、控制台和交互，并输出审查截图。
- `PROGRESS.md`：分阶段进度、检查结果和待验证项。
- `docs/layout/LAYOUT_V1.md`：冻结的首版道路与地块坐标，以及新增建筑时的变更规则。
- `ROAD_NETWORK_PLAN.md`：道路与用地建设计划。
- `WORLD_PLAN.md`：星球化建设计划（城镇以外的地形、区域、全球路网和地标）；参考包在 `docs/world/`。
- `three.min.js`：Three.js 0.160.1，保留原始版权头。
- `build.py`：将源码（three.min.js、layout.js、buildings/*.js、scene.js）按依赖顺序内嵌到单文件 HTML。
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

建筑设计参考包已就绪：覆盖 38 个地块，含 38 张任务卡与 38 张八视图设计板。B05-P03 咖啡店（[实际模型截图](docs/buildings/screenshots/B05-P03/)）、B05-P04 花店（[实际模型截图](docs/buildings/screenshots/B05-P04/)）与 B03-P01 转角面包店（[实际模型截图](docs/buildings/screenshots/B03-P01/)）已实现，32 个地块待建，3 个已有样板仅审查保留。

- [建筑参考包入口](docs/buildings/README.md)
- [统一规格](docs/buildings/BUILDING_SPEC.md)
- [实施队列](docs/buildings/BUILDING_QUEUE.md)
- [38 张八视图图库](docs/buildings/GALLERY.md)
- [逐栋实施提示词（通用模板）](docs/buildings/AGENT_START.md)：每轮只需告诉 Agent「读取 docs/buildings/AGENT_START.md 并执行，本轮地块：B03-P02」

下一轮只实现 B03-P02 洗衣店，复用咖啡店/花店/面包店的集成方式（buildings/ 模块 + `buildings` 登记 + C12 + building_views）。尺寸、入口和高度以 layout.js 为准，参考图只是外观/结构概念。参考包自检：`node docs/buildings/check_kit.mjs`。


## 规划中：星球化

计划把城镇放到一颗可旋转的手绘小星球上，城镇以外有农田、森林、山脉、火山、海洋、冰盖、遗迹，由全球路网连接。星球全景总是晴朗的月夜，近处保持现在的雨夜，并按时间和位置切换局部天气。目前处于 W0 规划阶段：总计划、统一规格和 39 张设计卡已就绪，参考图待生成，代码尚未实施。逐栋建筑可以与之并行。

- [星球计划](WORLD_PLAN.md)
- [星球规划参考包](docs/world/README.md)
- [参考图生成提示词（图像 Agent 通用模板）](docs/world/IMAGE_AGENT_START.md)：每轮只需告诉 Agent「读取 docs/world/IMAGE_AGENT_START.md 并执行，本轮卡片：ST01」
