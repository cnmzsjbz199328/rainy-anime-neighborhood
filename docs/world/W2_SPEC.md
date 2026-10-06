# W2 精确规格：弯曲渲染

状态：生效，供 [WORLD_AGENT_START.md](WORLD_AGENT_START.md) 的 W2 一轮使用。W2 是单批次交付，本文给出基线方法、弯曲数学、改动点、检查与停止条件。与 [WORLD_PLAN.md](../../WORLD_PLAN.md) 第 2 节原则 2–3、第 4 节坐标约定一致；冲突时以 WORLD_PLAN 为准。

## 1. 范围

- 做：弯曲着色器、点光源同步、剔除、法线、确定性回归工具、检查与截图。
- 不做：球体地形网格（W3）、用户可见的弯曲控制或过渡动画（W8）、天气、世界数据（W1）。对外只暴露测试钩子 `window.__scene.bend`。
- 前置：S4 已完成（旧样板已迁到 kit，`scene.js` 中没有旧样板材质路径）。S4 未完成则停下报告。
- 分支 `world/W2`，验收全过后才合并 main，不推送。

## 2. 第一步：确定性回归基线（先做，再碰着色器）

WC12 要求「弯曲为 0 时现有检查与截图与改动前一致」。现有截图含 `Math.random` 的雨滴、涟漪和实时时钟，无法逐像素比较，所以必须先建确定性回归工具。

- 新建 `tools/regress.mjs`：
  - 在页面脚本加载前注入：`Math.random` 换成固定种子的确定性函数；`requestAnimationFrame` 回调的时间戳改为 `帧序号 × 16.667`；`performance.now` 同步。
  - 视角取 `tools/views.mjs` 的 `VIEWS`（far、storeCorner、intersection、top、roamStreet）加默认视角、一栋新建筑的正面（如 B05-P03）、一个剖视（`building_views` 的 `interior`）。每个视角等待固定帧数后截图。
  - 对比方式：`--baseline-ref <git ref>` 在临时工作树里构建该提交并截图，再与当前构建逐像素比较；**不把基线图存入仓库**。判定：任一通道差 ≤ 2 且超差像素 ≤ 0.01%。
  - 先对同一提交自比较两次，必须全部通过，证明工具本身确定；不确定则修工具，不是放宽阈值。
- 基线提交打标签 `pre-w2`。

## 3. 弯曲数学

坐标：城镇局部系，x 东、z 南（北为 −z）、y 上；R = 90。球心在 (0, −R, 0)，使城镇原点 (0,0,0) 落在球顶。

- 墨卡托映射（WORLD_PLAN 第 4 节）：经度 λ = x/R，纬度 φ = −gd(z/R)，gd(t) = atan(sinh t)；局部缩放 s = 1/cosh(z/R)；高度同比缩放。
- 球面位置：`P = (0,−R,0) + (R + y·s) · (cosφ·sinλ,  cosφ·cosλ,  −sinφ)`。
- 弯曲量 `uBend ∈ [0,1]`：`bent = mix(flat, P, uBend)` 作用在**世界空间位置**上（`modelMatrix × position` 之后、`viewMatrix` 之前）。0 为原样，1 为完整球面，中间是平滑过渡。要求：
  - `uBend = 0` 时必须走精确恒等（着色器里用 `if (uBend > 0.0)` 包住，避免浮点残差）；
  - 对 `|x| ≤ 48`、`|z| ≤ 48` 的城镇范围连续、无 NaN；城镇外（雨、边缘）的 `|z/R|` 可能更大，必须用夹紧或解析稳定的 gd 实现，不得产生 inf。
- 法线：用同一映射在该点的旋转部分（东、北、上基向量在球面与平面之间的旋转）变换，按 `uBend` 混合后归一化。顶点法线、`transformedNormal` 和玻璃/Toon 渐变所依赖的法线都要走这一路径。
- 太阳/月光：`DirectionalLight` 方向在 W2 保持城镇系固定（`uBend` 变化不改变方向）；月光随球面的处理留到 W8。

## 4. 实现方式（已定，不再比较方案）

三个原因决定了不逐材质打补丁：材质散布在 `scene.js` 与 `buildings/*.js` 的数百处 `new THREE.Mesh*Material`；`bake()` 会合并几何；将来 W6 会用实例化。

- 新建 `bend.js`，加入 `build.py` 的嵌入列表，位置在 `three.min.js` 之后、`layout.js` 之前，保证在任何材质编译前生效。
- 覆盖 `THREE.Material.prototype.onBeforeCompile`（three 默认是空函数，`customProgramCacheKey` 取其 `toString()`，所有材质共用同一个缓存键，不会膨胀着色器变体）：在其中改写 `shader.vertexShader`，并给 `shader.uniforms.uBend` 绑定**全局共享的对象** `{ value: 0 }`，一处赋值全场生效。
- 覆盖范围：`MeshToonMaterial`、`MeshBasicMaterial`、`MeshPhysicalMaterial`（玻璃）、`LineBasicMaterial`（墨线、雨）。着色器改写点：`project_vertex`（并处理 `USE_INSTANCING` 的 `instanceMatrix`，即使现在没有实例化）和 `beginnormal_vertex`。
- 如发现有材质自带 `onBeforeCompile`，链式调用它再改写，不覆盖。
- 暴露 `window.__scene.bend = { get(), set(v), R }`，仅用于检查与截图。

## 5. 必须处理的边角

| 项 | 要求 |
| --- | --- |
| 点光源 | 旧便利店的 3 个 `PointLight`（S3 之后可能已减少）和任何新增的，其世界位置在 CPU 上按第 3 节同一映射同步：`uBend` 改变时更新一次；光方向与射程不变。用脚本核对映射后位置与解析值误差 < 1e-4 |
| 视锥剔除 | 平面下的包围球在弯曲后不再准确。`uBend = 0` 时保持现状；`uBend > 0` 时对受影响对象关闭 `frustumCulled`（切换由 `bend.set` 统一完成，`uBend` 回 0 时恢复原值），并记录绘制成本 |
| 射线拾取 | 当前 `scene.js` 没有 `Raycaster`，记录为不适用；若检索发现使用，则按第 3 节反向映射 |
| 烘焙分组 | `bake()` 合并后的几何在分组局部系内，弯曲在世界空间，不受影响；核对没有接缝裂开 |
| 雨与线段 | 雨 `LineSegments` 与墨线同样弯曲；雨的盒体仍跟随目标点 |
| 相机 | 不改相机控制；`uBend = 1` 的截图用 `view.set` 设机位 |
| 深度与远裁剪 | 球直径 180，现有 far = 400 足够；若 `uBend = 1` 出现深度闪烁，记录并调 near/far，不改场景 |

## 6. 检查与截图

1. **WC12**：`uBend = 0` 下，`node tools/regress.mjs --baseline-ref pre-w2` 全部视角通过。
2. 现有检查全部通过：`python3 build.py`、`node tools/measure_samples.mjs`、`node tools/layout_check.mjs --png`、`node tools/views.mjs`、`node tools/frozen_diff.mjs pre-w2`（除新增文件外无变化）、`node docs/buildings/check_kit.mjs`。
3. **弯曲截图**（`docs/world/w2/`，逐张查看）：`uBend = 1` 时城镇四角、R01 路口、一栋新建筑正面、电线、雨与墨线共 8 张；`uBend = 0.25 / 0.5 / 0.75` 同一视角 3 张。检查：无裂缝、无倒置法线造成的暗面、无新的 z-fighting、墨线与几何一致、灯光随建筑。
4. 性能：绘制调用不变（弯曲只在顶点着色器）；记录 `uBend = 1` 的帧时间与 0 的对比、着色器程序数；ROADMAP 第 4 节第 6 条的 10% 上限适用，关闭剔除导致的上升要计入。
5. 无新增页面错误。

## 7. 交付

- `bend.js`、`build.py` 的嵌入列表改动、`tools/regress.mjs`、`docs/world/w2/`、PROGRESS 一节、ROADMAP 的 W2 行改为 `完成`（分支已合并 main）。
- 最后回复按统一格式，并单独列出：`uBend = 0` 的回归结果、点光源同步误差、关闭剔除的成本、`uBend = 1` 时发现的任何视觉问题（进待办池或 W3/W8 前置）。

## 8. 停止条件

- `uBend = 0` 回归无法达到零差异，且原因不是工具不确定性：停下报告，不合并。
- 需要改动 `layout.js`、建筑模块的几何或材质创建方式才能完成：停下报告。
- 关闭剔除后默认视角绘制调用或帧时间上升超过 ROADMAP 预算：停下报告，给出剔除方案选项。
