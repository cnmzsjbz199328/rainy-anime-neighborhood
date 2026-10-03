# 雨音街角 · Rainy Anime Neighborhood

交互式 Three.js 日本雨夜社区微缩模型。当前初始版本包括便利店、拉面店、三层公寓和服务小巷；采用墨线轮廓、程序化淡彩颗粒与分层明暗。

## 运行

直接使用现代浏览器打开 `index.html`，无需安装依赖或访问外部 CDN。浏览器需要支持 WebGL。也可以运行 `python3 -m http.server 8000`，然后访问 http://localhost:8000。

拖动旋转，滚轮或双指缩放，鼠标右键拖动平移。没有可见 UI，也没有人物。

## 文件

- `index.html`：包含渲染库、布局数据和场景脚本的单文件交付版。
- `scene.js`：可编辑的场景源码；已有样板按命名分组（store、ramen、apartment 等），便于整体放置。
- `layout.js`：道路、街区、地块与样板放置的布局数据（坐标约定见文件头）。
- `tools/`：布局工具。`measure_samples.mjs` 在 Chromium 中实测样板尺寸；`layout_check.mjs` 检查布局并生成 `docs/layout/` 下的俯视检查图和报告。
- `PROGRESS.md`：分阶段进度、检查结果和待验证项。
- `ROAD_NETWORK_PLAN.md`：道路与用地建设计划。
- `three.min.js`：Three.js 0.160.1，保留原始版权头。
- `build.py`：将源码重新内嵌到单文件 HTML。
- `DESIGN.md`：风格约束与扩展路线。
- `THIRD_PARTY_NOTICES.md`：第三方许可说明。

修改 `scene.js` 或 `layout.js` 后运行 `python3 build.py`，更新 `index.html`；不要同时手工编辑生成文件和源码。

布局检查需要 Node 与 Playwright（Chromium）：先运行 `node tools/measure_samples.mjs`，再运行 `node tools/layout_check.mjs --png`。

## 当前效果

雨丝、屋檐滴水、玻璃雨滴、水洼涟漪、间歇自动门、灯箱轻微闪烁、交通灯变化；可见商店货架、冷柜、拉面吧台和厨房。

在线演示：https://komorebi-rainy-corner.nxnp5gf8sp.chatgpt.site

该演示目前独立通过 Sites 发布。GitHub 提交尚未配置自动部署。

## 验证状态

已在无头 Chromium（SwiftShader 软件 WebGL）中检查：首帧渲染、无控制台错误，旋转、缩放和平移均有响应。尚未在真实 GPU、iPad/手机上验证视觉效果和性能。道路建设的阶段进度见 PROGRESS.md。
