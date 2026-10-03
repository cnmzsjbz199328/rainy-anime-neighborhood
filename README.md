# 雨音街角 · Rainy Anime Neighborhood

交互式 Three.js 日本雨夜社区微缩模型。当前初始版本包括便利店、拉面店、三层公寓和服务小巷；采用墨线轮廓、程序化淡彩颗粒与分层明暗。

## 运行

直接使用现代浏览器打开 `index.html`，无需安装依赖或访问外部 CDN。浏览器需要支持 WebGL。也可以运行 `python3 -m http.server 8000`，然后访问 http://localhost:8000。

拖动旋转，滚轮或双指缩放，鼠标右键拖动平移。没有可见 UI，也没有人物。

## 文件

- `index.html`：包含渲染库和场景脚本的单文件交付版。
- `scene.js`：可编辑的场景源码。
- `three.min.js`：Three.js 0.160.1，保留原始版权头。
- `build.py`：将源码重新内嵌到单文件 HTML。
- `DESIGN.md`：风格约束与扩展路线。
- `THIRD_PARTY_NOTICES.md`：第三方许可说明。

修改 `scene.js` 后运行 `python3 build.py`，更新 `index.html`；不要同时手工编辑生成文件和源码。

## 当前效果

雨丝、屋檐滴水、玻璃雨滴、水洼涟漪、间歇自动门、灯箱轻微闪烁、交通灯变化；可见商店货架、冷柜、拉面吧台和厨房。

在线演示：https://komorebi-rainy-corner.nxnp5gf8sp.chatgpt.site

该演示目前独立通过 Sites 发布。GitHub 提交尚未配置自动部署。

## 验证状态

JavaScript 语法检查通过，模拟环境下场景构造和动画初始化通过。尚未完成真实浏览器中的视觉、交互和移动设备性能验证。不要把这些检查当作视觉质量验收。
