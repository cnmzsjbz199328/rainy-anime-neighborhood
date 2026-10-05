# 星球参考图审查与实施时的裁决

状态：已生成 ST01、ST03、ST05、BI01–BI09、TR01–TR07、RD01–RD08（27 / 39），均已审查并记录裁决；ST01 风格已获用户确认，其余 12 张待生成。

## 生成方式

内置 image_gen；ST01 输出 1536 × 1024，JPEG 质量 92、无色度子采样、不裁剪。ST01 使用城镇截图及建筑参考板，后续卡片须使用确认后的 ST01 风格参考。

## 通用裁决

以下规则在生成前就已确定，适用于所有参考图：

- 参考图只用于外观、结构和氛围。位置、尺度、高度、坡度、面积以 world.js（W1 之后）、WORLD_PLAN.md 和设计卡为准，不能从图上量取。
- 图中出现的文字（站名、招牌、标签以外的文字）不作为资产。站名和招牌在实施时使用原创名称，用 CanvasTexture 绘制。
- 跨视图细节不一致（物件数量、位置、颜色）时，以设计卡的"必备细节"为底线，实施时固定一套。
- 道路横断面上的尺寸线只表示比例关系；宽度以道路等级卡为准。
- 全景格中的大陆轮廓只是示意，实际轮廓由 W1 的 world.js 决定。
- 隐藏线索（LM05、LM06、LM07）的图如果线索过于明显，实施时按设计卡的"约束与禁止"减弱，不照搬图中的亮度。
- 参考图中的人物、车辆、动物等违反规格的元素，实施时一律不采用。

## 逐卡记录


### ST01 星球风格总板
- 工具与日期：内置 image_gen，2026-10-05。
- 尝试次数：3；每次独立生成，附 B05-P03/default.png 实景截图与 B05-P03.jpg 建筑参考板作为画风参考。
- 实际提示词：第 1 次使用 IMAGE_PROMPTS.json 中 ST01 的原文；第 2 次在原文末尾追加严格修正；第 3 次在原文末尾追加以下全文（包含第 2 次修正和最终澄清）。

```text
undefined
```

- 输出：1536 × 1024；完整原图转 JPEG，quality=92，subsampling=0，无裁剪。
- 选择：第 3 次。第 1 次火山与冷色线索过亮、全景有云和多余说明；第 2 次改善全景与火山，但线索像亮晶体且色块缺标签；第 3 次修正以上主要问题。
- 审查结果：generated-with-issues。八格与标签顺序正确；七类色板、三距离墨线与六材质齐全；七类光源齐全，火山及隐藏微光已弱化；街角、林间、海岸为雨夜，全景为晴朗月夜；无人、无动物（LIGHTS 的两点萤火虫符合示例）、无移动车辆、无水印、无科幻发光纹路。人造物保持可信人体尺度。
- 残余问题与裁决：便利店招牌仍有细小伪文字，实施时去除并用原创名称；半空树冠内部墨线略密，实施时只保留群落轮廓；两极冰缘不够明确，按 D5 的 8% 面积与 BI07 决定，不能从本图反推地形或面积。色板与墨线样例是材料展示，其浅底不代表引入昼夜循环。
- 风格确认：用户于 2026-10-05 确认 ST01；第二批 ST03、ST05 已完成，详见下方交接。


### ST03 样板断面：城镇边缘到海洋
- 工具与日期：内置 image_gen，2026-10-05。每次独立生成，附 ST01.jpg 为风格参考。
- 尝试次数：3；保留第 3 次。第 1 次多余标题、中文和尺寸注释，林缘灯笼过亮；第 2 次去掉这些内容，但仍有远处田边灯光，雨夜标签未区分；第 3 次修正灯光与标签。
- 输出：[ST03.jpg](references/ST03.jpg)，1536 × 1024，完整原图转 JPEG quality=92、subsampling=0，不裁剪、不缩放。
- 审查结果：generated-with-issues。顶部连续断面与下方 4×2 八格完整、标签正确；中性与雨夜四组为同一地点，主构图和材质一致；墨线、水彩淡洗、低饱和与 ST01 相符；城镇最后路灯与远处灯塔提供暖光，林缘保持无灯；人体尺度可信，涟漪、轻摆、浪花箭头可读；无人物、动物、移动车辆、水印和额外文字。本卡无星球全景，相关全景专项不适用。
- 残余问题与裁决：植被及局部取景在中性/雨夜之间略变，实施时固定一套几何；上方剖面土层出现竖直分缝，不能照搬为地貌硬边；弃耕带偏窄，实施时按卡片保留连续渐变的弃耕地与灌木。上排是中性材料研究，不代表增加白天或昼夜循环。侧剖面比例仅示意，80 m 长度、0–6 m 起伏、4–12 m 树高仍以卡片为准。
- 后续使用：本图作为自然区域补充风格参考，已随 ST05 输入；BI、TR 卡必须同时查看并附上 ST01 与 ST03。

### ST05 天气状态板
- 工具与日期：内置 image_gen，2026-10-05。每次独立生成，参考图依次为 ST01.jpg（总风格）、ST03.jpg（自然区域补充）、B05-P03/default.png（城镇几何）。
- 尝试次数：3；保留第 3 次。第 1 次雪屋偏褐色、火山口偏亮、距离格多余说明且横幅比例不符目标；第 2 次改善尺寸、标签、雪屋及火山亮度，但距离格远端仍有云；第 3 次明确横向渐隐并清空远端云雨。
- 输出：[ST05.jpg](references/ST05.jpg)，1536 × 1024，完整原图转 JPEG quality=92、subsampling=0，不裁剪、不缩放。
- 审查结果：generated-with-issues。八格与八标签齐全；上排同一便利店街角的主体形状、机位与色材一致，雨、雨后、阴、晴夜可辨；下排为橙色极地小屋、雨后森林山谷、晴朗星球、距离过渡。全为夜晚，月光全景无雨无覆盖地表的云；暖光主要来自建筑与道路，火山极弱；雪与雾符合蓝白/灰紫色板；尺度可信，无人物、动物、移动车辆、水印及明显额外标题。没有雷电、风暴、暴雪或白天。
- 残余问题与裁决：DISTANCE BLEND 仍偏概念拼接，不能据此实现两个并列场景，实施必须是同一世界随相机连续拉远，40–120 m 逐渐淡出，120 m 以上无云雨；AFTER RAIN 的檐口滴水不够清楚，需实施补足；SNOW 天线顶红色点光偏亮，实施去除，不增加闪灯；全景单树轮廓偏密、极地冰盖不够明确，按 WORLD_SPEC 距离墨线与 D5/BI07 裁决。上排细小铺地/道具变化不作为天气引起的几何变化。
- 提示词内已有说明歧义：中文必备细节写前六格同一街角，但卡片明确 MIST 为森林山谷、英文版式也明确如此；本次按更具体的 MIST 格要求生成，未修改设计内容或 IMAGE_PROMPTS.json。

### 本轮实际提示词（ST03、ST05）
每次均完整使用 IMAGE_PROMPTS.json 对应 prompt 原文，不删除、不改写；第 1 次无追加。第 2、3 次分别追加以下全文（第 3 次已包含第 2 次的追加内容，不再重复拼接）。

#### ST03 第 2 次追加

```text
Review corrections: Keep the original nine-view layout (one continuous section plus eight views). Output landscape at least 1536 x 1024. Reference image 1 is ST01, a style reference only; do not copy its forest lanterns. Only the eight simple panel labels TOWN EDGE, PADDIES, FOREST EDGE, COAST and their RAINY NIGHT versions may appear. No title, card ID, Chinese text, dimensions, measurements, captions, signs or other lettering. The transect has just the last street lamp at the town edge and a tiny distant offshore lighthouse; forest shrine path stone lanterns are UNLIT, no warm lights in forest or fields. Preserve the same camera and object arrangement between each neutral and rainy pair. Neutral material-study panels use cool desaturated neutral illumination, no peach or golden sunset sky; they are not a daytime game state. Include tiny motion arrows in every ground view: puddle/paddy ripples, tree sway or breathing surf as applicable. Show one continuous shallow relief section with clear ground layers, smooth irregular biome transitions, and a road degrading from asphalt to dirt.
```

#### ST03 第 3 次追加

```text
Review corrections: Keep the original nine-view layout (one continuous section plus eight views). Output landscape at least 1536 x 1024. Reference image 1 is ST01, a style reference only; do not copy its forest lanterns. Only the eight simple panel labels TOWN EDGE, PADDIES, FOREST EDGE, COAST and their RAINY NIGHT versions may appear. No title, card ID, Chinese text, dimensions, measurements, captions, signs or other lettering. The transect has just the last street lamp at the town edge and a tiny distant offshore lighthouse; forest shrine path stone lanterns are UNLIT, no warm lights in forest or fields. Preserve the same camera and object arrangement between each neutral and rainy pair. Neutral material-study panels use cool desaturated neutral illumination, no peach or golden sunset sky; they are not a daytime game state. Include tiny motion arrows in every ground view: puddle/paddy ripples, tree sway or breathing surf as applicable. Show one continuous shallow relief section with clear ground layers, smooth irregular biome transitions, and a road degrading from asphalt to dirt.
Final clarification: The town is ONLY on the extreme left of the transect; beyond the single last streetlamp there are no further streetlamps along the dirt path and no houses across the paddies. Distant coast lighthouse is the only warm light beyond town. Bottom-row labels must read exactly TOWN EDGE RAINY NIGHT, PADDIES RAINY NIGHT, FOREST EDGE RAINY NIGHT, COAST RAINY NIGHT. Keep four ground-view pairs geometrically consistent. Keep the continuous upper section broad and all eight panels uncropped.
```

#### ST05 第 2 次追加

```text
Review corrections: Produce exactly a 1536 x 1024 landscape sheet (3:2 aspect ratio), not a panoramic banner; full eight-panel 4 by 2 grid, uncropped. Input 1 ST01 is the overall style anchor; input 2 ST03 is the natural-material style supplement; input 3 is the town geometry reference. Keep the same town corner geometry and camera in the four upper panels. Only these eight labels may appear: RAIN, AFTER RAIN, OVERCAST, CLEAR NIGHT, SNOW, MIST, GLOBE CLEAR, DISTANCE BLEND. All store fascias, signs and machines must have no lettering. No additional small captions, headings or measurements. SNOW must show a small faded ORANGE observation hut at the polar ice-field edge, not a brown timber cottage; gentle sparse snowfall. MIST is a cool forest valley after rain, not the town, following the explicit panel layout; avoid copying ST01's lanterns. GLOBE CLEAR and the far end of DISTANCE BLEND must be unmistakably cloudless moonlit NIGHT with a legible surface, faint thin road lights and no rain; volcano glow at most a tiny barely visible dark dull red point, no bright orange crater. DISTANCE BLEND is a single continuous horizontal near-to-far transition with progressively weaker rain and clouds, no internal extra frames or labels. Keep all weather gentle.
```

#### ST05 第 3 次追加

```text
Review corrections: Produce exactly a 1536 x 1024 landscape sheet (3:2 aspect ratio), not a panoramic banner; full eight-panel 4 by 2 grid, uncropped. Input 1 ST01 is the overall style anchor; input 2 ST03 is the natural-material style supplement; input 3 is the town geometry reference. Keep the same town corner geometry and camera in the four upper panels. Only these eight labels may appear: RAIN, AFTER RAIN, OVERCAST, CLEAR NIGHT, SNOW, MIST, GLOBE CLEAR, DISTANCE BLEND. All store fascias, signs and machines must have no lettering. No additional small captions, headings or measurements. SNOW must show a small faded ORANGE observation hut at the polar ice-field edge, not a brown timber cottage; gentle sparse snowfall. MIST is a cool forest valley after rain, not the town, following the explicit panel layout; avoid copying ST01's lanterns. GLOBE CLEAR and the far end of DISTANCE BLEND must be unmistakably cloudless moonlit NIGHT with a legible surface, faint thin road lights and no rain; volcano glow at most a tiny barely visible dark dull red point, no bright orange crater. DISTANCE BLEND is a single continuous horizontal near-to-far transition with progressively weaker rain and clouds, no internal extra frames or labels. Keep all weather gentle.
Final correction focused on DISTANCE BLEND: Within this eighth panel show one horizontal LEFT-TO-RIGHT camera-distance strip: rainy close street occupies left third, a smaller receding neighborhood in faint residual haze occupies middle third, small complete planet in EMPTY CLEAR STARFIELD occupies right third. Clouds and rain decrease monotonically to ZERO before the right third; absolutely no foreground clouds, fog banks or wisps below, behind or in front of the far planet. Keep a recognizably continuous zoom progression, not two unrelated floating subjects. SNOW hut walls are visibly muted orange painted metal; keep gentle snowfall. AFTER RAIN shows clearly visible eave droplets but no falling sky rain, puddles and only a thin low mist. Preserve 1536 x 1024, eight labels only and the same four street views.
```

### 交接：2026-10-05 第二批完成
- 用户已确认 ST01 风格；ST01 的残余问题裁决继续有效。历史 ST01 追加提示词区块仅保存了 `undefined`，实际追加文本无法从该记录恢复，本轮不臆造补写。
- 已生成 ST01、ST03、ST05，共 3 / 39；其余 36 张 pending。ST03 和 ST05 各 3 次，均保留第 3 次。
- 下一批：BI01–BI09。先读取最新 main、IMAGE_AGENT_START、WORLD_PLAN、WORLD_SPEC、对应卡与提示词，再查看 ST01 与 ST03；不要重复生成已有卡。
- 本批仅更新 docs/world 参考图、审查和进度，不实施场景；检查记录见本包 README。



### 第三批逐卡审查（2026-10-05）

- 工具：内置 image_gen；每次独立生成，使用 ST01.jpg（整体风格）与 ST03.jpg（自然材质）作为参考输入。BI03–BI09 每张 3 次，共 21 次成功返回；BI01、BI02 为恢复既有图片，本轮 0 次，历史次数未完整核实。
- 提示词：BI03–BI09 第 1 次使用当前 IMAGE_PROMPTS.json 中对应 prompt 原文；第 2、3 次使用同一原文加本记录中的相应追加全文，不串接多次追加。历史 BI01/BI02 的追加文本已恢复，但既有图片的精确提示词组合无法完整确认。
- 输出：九张均为 1536 × 1024 JPEG；BI03–BI09 完整 PNG 转 RGB JPEG，quality=92、subsampling=0，不裁剪、不缩放；BI01/BI02 保留已有文件并核对编码。
- 通用视觉检查：九张均具有八个主格，画风为墨线/淡彩/赛璐璐体积；各成对视图的主要地貌、材质关系一致，细节位置不作工程依据。未见人物、移动车辆、水印或禁用动物；BI02 的少量萤火虫及 BI05 的稻草人为卡片允许项。全景均无覆盖地表的云雨，局部天气按逐卡记录；人为物件尺度仅作概念检查，最终按数值卡实施。TR 渐变/RD 专项本批不适用。
- 审查状态：九张均为 generated-with-issues；这是完成生图与审查，不是宣称视觉无缺陷或已实施。

#### BI01
- 输出：[BI01.jpg](references/BI01.jpg)。
- 八格、三块材质与横向三格浪花动态齐全；两幅全景晴朗无云雨，局部雨夜与灯塔/桥灯倒影可读，色彩与 ST01/ST03 一致。残余：海岸建筑占比偏高、浪花偏密、局部机位细节略变；实施以海洋为主，浪高限制 0.1–0.3 m，固定海岸几何。
- 尝试追溯：本轮 0 次；历史第 2、3 次修正文本已找回，但调用次数和保留编号无法仅凭临时文件确认。沿用已有成果，记录残余问题。

#### BI02
- 输出：[BI02.jpg](references/BI02.jpg)。
- 八格、四类树形、林下蕨/苔石/倒木及横向叶尖滴水齐全；全景无云雨，局部为雨夜，遗迹附近仅少量萤火虫，无暖灯。残余：全景及半空单树轮廓仍密，上排全景偏亮绿，动态叶片有景深感；实施合并远景树冠色块，统一冷蓝夜色，避免摄影式景深。
- 尝试追溯：本轮 0 次；历史第 2、3 次修正文本已找回，但调用次数和保留编号无法仅凭临时文件确认。沿用已有成果，记录残余问题。

#### BI03
- 输出：[BI03.jpg](references/BI03.jpg)。
- 三次尝试，保留第 3 次；全景均为冷色月夜，局部雨夜，草丘、孤树、石堆、低饱和野花与三块材质齐全。残余：MOTION 仍为竖排三格，半空夜景远岸有微小暖点，局部草/灌丛细线偏密；实施改横向分镜阅读、移除草原人工光、远景不描草叶，固定几何。

#### BI04
- 输出：[BI04.jpg](references/BI04.jpg)。
- 三次尝试，保留第 3 次；八格及横向三格齐全，沙丘/岩柱/台地/枯灌木/半埋短轨具备，局部为晴夜，无人工灯光。残余：夜色略浅暖，局部沙纹方向偏一致，动态缺明显连接箭头且有景深感；实施统一淡紫灰夜色、打散纹理方向，以极慢流沙和偶发雨坑实现动态。

#### BI05
- 输出：[BI05.jpg](references/BI05.jpg)。
- 三次尝试，保留第 3 次；八格、横向涟漪/渠水分镜、不规则水田与旱田、水闸、稻架、小屋、电杆、稻草人及小神龛齐全；全景无云雨，田间无灯，暖光集中道路/远处聚落。残余：上排材质研究仍偏夜色，全景田埂线过密、渠口落水偏急；实施降低远景田埂细节和水速，尺度按卡片，不依据图量取。

#### BI06
- 输出：[BI06.jpg](references/BI06.jpg)。
- 三次尝试，保留第 2 次（第 3 次全景更偏暖，田边疑似亮点增加）；八格、横向跌水分镜、沿等高线的梯田与茶树列、窄石阶/水口/防霜风扇齐全；全景无云雨，局部雨夜，田间小屋无灯。残余：全景台阶/树冠线偏密、动态样本有景深感，水口略急；实施远景合并色带，降低水速、维持 0.6–1.2 m 级高与克制描线。

#### BI07
- 输出：[BI07.jpg](references/BI07.jpg)。
- 三次尝试，保留第 3 次；八格、横向飘雪分镜、冰崖/冰隙/浮冰/红白标杆与冰下暗影齐全，无设施暖灯/动物/极光；全景无云雪，局部为雪。残余：冰下矩形暗影仍过于清楚，上排全景较亮、全景冰隙细线偏多；实施进一步模糊和降低暗影对比，保持冷蓝月夜。全景为极地局部示意，不能把画面冰量当成全球面积，严格按 D5 的 8%。

#### BI08
- 输出：[BI08.jpg](references/BI08.jpg)。
- 三次尝试，保留第 3 次；八标签、横向蒸汽分镜、绳状熔岩/裂缝/地衣/先锋植物/硫沉积/塌陷口齐全；全景冷色无云雨蒸汽，无火焰/流动岩浆，局部雨夜。残余：SWATCH 色块缺文字名，三块材质样本为长方形；近处蒸汽仍略粗、远景内部纹理偏细；实施按卡片色材归类，压低蒸汽密度并简化远景，不引入发光硫或火光。

#### BI09
- 输出：[BI09.jpg](references/BI09.jpg)。
- 三次尝试，保留第 3 次；八格及横向雾带/溪流分镜、山脊/碎石坡/河谷/隧道口/积雪线齐全；全景无云雨，半空夜景上部可见雪、低谷为雨，暖光来自道路与隧道。残余：地面夜景和动态格的雨幕仍覆盖远处雪峰投影，远景树冠线偏密、山顶稍尖；实施按三维海拔分区降水并消除高处雨丝，圆化山脊，保留外轮廓墨线。

### 第三批完成交接

- 已生成并审查 ST01、ST03、ST05、BI01–BI09，共 12 / 39；剩余 27 张。ST01 的用户风格确认继续有效。
- 下一批 TR01–TR07，仍以 ST01 与 ST03 为风格参考。参考图不能代替 world.js 的布局和数值，未实施任何场景代码。
- 本批只提交 docs/world 下的参考图、目录、卡片审查及原有 D8/D9 措辞修正；其他工作区任务保持原样。检查结果见 README。

### 第三批续作与实际追加提示词（2026-10-05）

- 接手时 BI01.jpg、BI02.jpg 已存在，但目录与卡片仍为 pending；BI03–BI09 图片缺失，上一轮没有留下完成交接。无法仅凭工作区判断中断原因。
- 已逐张查看城镇 default、town、frontRight 实景和 B05-P03 建筑板，以及已确认的 ST01、ST03。自然区域继续使用 ST01、ST03 为风格输入。
- 接手时已存在的措辞修正予以保留：BI01–BI09 上排 GLOBE 改为晴朗月夜；非全景中性光仅为材质研究；局部夜景按地貌天气。修改同步至提示词与工作流边界说明，不改变 D8/D9 或设计内容。
- 从上一轮临时文件恢复了 BI01、BI02 第 2、3 次追加提示词（如下）。文件存在证明修正文本已准备，但不能单独证明调用成功次数；历史实际调用总数及保留图对应的尝试编号未完整记录，本轮不臆造。既有图片本轮不重复生成。

#### BI01 历史第 2 次追加（恢复文本）

```text
Review corrections: Output a complete landscape sheet at least 1536 x 1024. Input images are ST01 overall style and ST03 natural-material style only. Exactly eight panel labels: GLOBE, AERIAL 50M, GROUND 5M, SWATCH, GLOBE NIGHT, AERIAL NIGHT, GROUND NIGHT, MOTION. No card ID, title, Chinese, captions or extra lettering other than short English palette-chip labels in SWATCH. MOTION must contain three small sequential frames LEFT TO RIGHT with arrows (not stacked vertically). Ocean water must be desaturated grey-cyan in shallows and indigo offshore, not tropical turquoise. Reduce foam to small gentle 0.1-0.3 m ripples. Ocean is the main subject; keep coastal buildings distant and sparse, retain a distant bridge with reflections. No bright volcano glow. Keep the paired cameras and coast geometry identical.
```

#### BI01 历史第 3 次追加（恢复文本）

```text
Review corrections: Output a complete landscape sheet at least 1536 x 1024. Input images are ST01 overall style and ST03 natural-material style only. Exactly eight panel labels: GLOBE, AERIAL 50M, GROUND 5M, SWATCH, GLOBE NIGHT, AERIAL NIGHT, GROUND NIGHT, MOTION. No card ID, title, Chinese, captions or extra lettering other than short English palette-chip labels in SWATCH. MOTION must contain three small sequential frames LEFT TO RIGHT with arrows (not stacked vertically). Ocean water must be desaturated grey-cyan in shallows and indigo offshore, not tropical turquoise. Reduce foam to small gentle 0.1-0.3 m ripples. Ocean is the main subject; keep coastal buildings distant and sparse, retain a distant bridge with reflections. No bright volcano glow. Keep the paired cameras and coast geometry identical.
Final weather correction: GLOBE and GLOBE NIGHT are BOTH the SAME cloudless dry orbital moonlit-night view. ZERO rain strokes, ZERO fog and ZERO clouds anywhere in either globe panel, including above the sea and in front of the planet. Only AERIAL NIGHT and GROUND NIGHT have rain. Do not apply bottom-row rain to GLOBE NIGHT. Keep eight labels exact, the horizontal three-frame motion strip, muted water and three square material samples.
```

#### BI02 历史第 2 次追加（恢复文本）

```text
Review corrections: Reference images 1 ST01 and 2 ST03 are STYLE ONLY. Do not copy their lit lanterns, coastal settlements, bridges or volcano. Main subject is dense temperate mixed FOREST. All stone lanterns in the forest are unlit dark stone in EVERY panel, no warm lights inside forest; only a few extremely faint fireflies near an ancient stone relic are allowed. Four tree types must read: broadleaf rounded crowns, cedar cones, pine, bamboo. Include fallen log, ferns, mossy rocks and shrubs. At aerial distance outline only forest edges, not every tree; at orbital distance no individual tree outlines. Both globe panels are clear moonlit night with ZERO clouds/rain and mostly forest area visible. Use exactly eight original panel labels; no BI02, title, or extra captions except short palette chip names. SWATCH has exactly three SQUARE watercolor material samples. MOTION has three left-to-right sequential ink/watercolor frames of leaf-tip dripping, not photorealistic macro photos. Output 1536 x 1024 or larger landscape; preserve paired geometry.
```

#### BI02 历史第 3 次追加（恢复文本）

```text
Review corrections: Reference images 1 ST01 and 2 ST03 are STYLE ONLY. Do not copy their lit lanterns, coastal settlements, bridges or volcano. Main subject is dense temperate mixed FOREST. All stone lanterns in the forest are unlit dark stone in EVERY panel, no warm lights inside forest; only a few extremely faint fireflies near an ancient stone relic are allowed. Four tree types must read: broadleaf rounded crowns, cedar cones, pine, bamboo. Include fallen log, ferns, mossy rocks and shrubs. At aerial distance outline only forest edges, not every tree; at orbital distance no individual tree outlines. Both globe panels are clear moonlit night with ZERO clouds/rain and mostly forest area visible. Use exactly eight original panel labels; no BI02, title, or extra captions except short palette chip names. SWATCH has exactly three SQUARE watercolor material samples. MOTION has three left-to-right sequential ink/watercolor frames of leaf-tip dripping, not photorealistic macro photos. Output 1536 x 1024 or larger landscape; preserve paired geometry.
Final correction: MOTION is ONE panel containing exactly three NARROW VERTICAL rectangles SIDE BY SIDE, read left to right, separated by right-pointing arrows. Keep illustrated flat cel-shaded leaf surfaces and paper texture, no bokeh or photographic depth of field. At GLOBE and AERIAL distances merge tree crowns into large watercolor masses without interior ink outlines. Fireflies only two or three barely visible dots near the relic. Keep both globe skies cloudless and rainless.
```

#### BI03 第 2 次追加

```text
Review corrections: Output 1536 x 1024 landscape. ST01 and ST03 are style references only. GLOBE and GLOBE NIGHT must BOTH show the same unmistakably cool silver-blue moonlit NIGHT, not warm daytime grass against stars. Exactly eight panels, 4 columns x 2 rows. Inside MOTION put exactly three narrow frames LEFT TO RIGHT with small right arrows, depicting one fixed close-up of grass bending gently and raindrops, not a changing weather montage. Keep flowers sparse. No outlines around grass or individual distant vegetation. Preserve the paired views and all other original requirements.
```

#### BI03 第 3 次追加

```text
Review corrections: Output 1536 x 1024 landscape. ST01 and ST03 are style references only. GLOBE and GLOBE NIGHT must BOTH show the same unmistakably cool silver-blue moonlit NIGHT, not warm daytime grass against stars. Exactly eight panels, 4 columns x 2 rows. Inside MOTION put exactly three narrow frames LEFT TO RIGHT with small right arrows, depicting one fixed close-up of grass bending gently and raindrops, not a changing weather montage. Keep flowers sparse. No outlines around grass or individual distant vegetation. Preserve the paired views and all other original requirements.
Final correction: Both left-column globe panels have IDENTICAL cool blue-grey night exposure and silver-blue grass. No yellow or gold sunlit land anywhere in these two panels. No tiny amber lights on the grassland globe. Remove distant individual tree and grass outlines; keep broad quiet color masses. Keep MOTION horizontal.
```

#### BI04 第 2 次追加

```text
Review corrections: 1536 x 1024 landscape, exactly eight panels in 4x2. Both GLOBE panels identical cool lavender-grey moonlit NIGHT exposure, no golden sunlight. AERIAL NIGHT and GROUND NIGHT show the usual CLEAR DRY NIGHT, no falling rain. Wet patches may be leftover localized marks only. MOTION has three small frames LEFT TO RIGHT with right arrows, gentle sand drift and a few occasional raindrop pits. No long continuous railway: only two short separated half-buried rail fragments, no intact railway or full station complex. Sand ripples have irregular changing directions. References only establish style.
```

#### BI04 第 3 次追加

```text
Review corrections: 1536 x 1024 landscape, exactly eight panels in 4x2. Both GLOBE panels identical cool lavender-grey moonlit NIGHT exposure, no golden sunlight. AERIAL NIGHT and GROUND NIGHT show the usual CLEAR DRY NIGHT, no falling rain. Wet patches may be leftover localized marks only. MOTION has three small frames LEFT TO RIGHT with right arrows, gentle sand drift and a few occasional raindrop pits. No long continuous railway: only two short separated half-buried rail fragments, no intact railway or full station complex. Sand ripples have irregular changing directions. References only establish style.
Final correction: MOTION contains three NARROW VERTICAL rectangles SIDE BY SIDE horizontally, never stacked. Sand is cool pale lavender-grey at night; no orange light. Keep short rail fragments separated. SWATCH includes exactly three square samples. Both night local views are clear, while neutral material studies are not a daytime game state.
```

#### BI05 第 2 次追加

```text
Review corrections: Output 1536x1024, eight panels in 4x2. MOTION is three NARROW VERTICAL rectangles SIDE BY SIDE with right arrows, same close-up of seedlings, slow canal flow and expanding rain ripples. No extra captions except short SWATCH palette names. Field sheds and farm tracks are unlit; warm streetlights ONLY on the distant paved RD03 road, not paddy embankments. No bright red volcano, only a barely visible dark point or omit distant crater. Keep flooded paddies and dry fields irregular, include water gate, rice rack, shed, poles and scarecrow, same geometry between paired views. Both globe panels clear cool moonlit night.
```

#### BI05 第 3 次追加

```text
Review corrections: Output 1536x1024, eight panels in 4x2. MOTION is three NARROW VERTICAL rectangles SIDE BY SIDE with right arrows, same close-up of seedlings, slow canal flow and expanding rain ripples. No extra captions except short SWATCH palette names. Field sheds and farm tracks are unlit; warm streetlights ONLY on the distant paved RD03 road, not paddy embankments. No bright red volcano, only a barely visible dark point or omit distant crater. Keep flooded paddies and dry fields irregular, include water gate, rice rack, shed, poles and scarecrow, same geometry between paired views. Both globe panels clear cool moonlit night.
Final correction: In BOTH globe panels remove ALL clouds, fog puffs and atmospheric white wisps, including below and around the planetary rim; coastal foam stays attached tightly to the waterline only. No atmospheric decoration around globe. Include one tiny unlit roadside stone shrine. Keep unlit field shed, road-only lighting, horizontal MOTION and irregular paddy layout.
```

#### BI06 第 2 次追加

```text
Review corrections: ST01 and ST03 are style references, do not copy settlements, lighthouses, lanterns or volcano. Focus on contour-following rice terraces and rounded tea rows, narrow stone steps and small water outlets. No lamps in terraces or tea fields, sheds unlit; moonlight reflected in terrace water is the primary night light. BOTH globe views clear cloudless rainless moonlit NIGHT; no cloud puffs or fog anywhere around globe. Local rainy panels may have thin mist only. Output 1536x1024, exactly original eight labels only, no BI06 or extra captions except palette names. Three square material samples. MOTION is three NARROW VERTICAL rectangles SIDE BY SIDE left-to-right with arrows, same tiny water outlet trickling between terraces, no big waterfall.
```

#### BI06 第 3 次追加

```text
Review corrections: ST01 and ST03 are style references, do not copy settlements, lighthouses, lanterns or volcano. Focus on contour-following rice terraces and rounded tea rows, narrow stone steps and small water outlets. No lamps in terraces or tea fields, sheds unlit; moonlight reflected in terrace water is the primary night light. BOTH globe views clear cloudless rainless moonlit NIGHT; no cloud puffs or fog anywhere around globe. Local rainy panels may have thin mist only. Output 1536x1024, exactly original eight labels only, no BI06 or extra captions except palette names. Three square material samples. MOTION is three NARROW VERTICAL rectangles SIDE BY SIDE left-to-right with arrows, same tiny water outlet trickling between terraces, no big waterfall.
Final refinement: At GLOBE distance terraces and tea rows are soft watercolor bands with NO internal dark outlines; outline only planet/coast silhouette. MOTION is flat ink-and-watercolor cel shading with NO bokeh/photographic depth-of-field blur. Keep narrow slow trickle and no field lighting. Both GLOBE panels identical cool night exposure.
```

#### BI07 第 2 次追加

```text
Review corrections: This is an empty natural polar ICE FIELD, not a sci-fi station. NO domes, large buildings, antennas, glowing markers, warm lamps, roads or artificial lights. Only unlit red-white RD08 route poles, ordinary ice cliffs and floating sea ice. One barely perceptible blurred geometric DARK shadow deep under opaque ice near LM07, no distinct outline, no luminous patterns. Snow locally, zero rain; no aurora. Both globe views cloudless clear moonlit NIGHT, no snow particles in orbit view. Exactly eight original short labels only, no parenthetical descriptions, numbered captions or other text beyond palette names. MOTION three NARROW VERTICAL rectangles SIDE BY SIDE with right arrows, same little snow ridge with sparse snow drifting gently. 1536x1024 landscape. Three square material samples.
```

#### BI07 第 3 次追加

```text
Review corrections: This is an empty natural polar ICE FIELD, not a sci-fi station. NO domes, large buildings, antennas, glowing markers, warm lamps, roads or artificial lights. Only unlit red-white RD08 route poles, ordinary ice cliffs and floating sea ice. One barely perceptible blurred geometric DARK shadow deep under opaque ice near LM07, no distinct outline, no luminous patterns. Snow locally, zero rain; no aurora. Both globe views cloudless clear moonlit NIGHT, no snow particles in orbit view. Exactly eight original short labels only, no parenthetical descriptions, numbered captions or other text beyond palette names. MOTION three NARROW VERTICAL rectangles SIDE BY SIDE with right arrows, same little snow ridge with sparse snow drifting gently. 1536x1024 landscape. Three square material samples.
Final refinement: Gentle sparse snowfall and almost invisible low drifting snow, never a blizzard. In GROUND 5M and GROUND NIGHT include a small opaque bluish ice patch containing only a faint blurred straight-edged DARK SHADOW underneath, with no glowing edges or identifiable machine shape. Moonlit globe ice is cool grey-blue, not brilliant white daylight. MOTION flat illustrated ink/watercolor, no photographic bokeh. No extensive sharp mountain peaks, ice relief only 0.5-2 m and coastal cliffs 3-6 m.
```

#### BI08 第 2 次追加

```text
Review corrections: ST01/ST03 are style only, do NOT copy buildings, settlements, lanterns, paths, lighthouse or clouds. This is an ancient cooled charcoal lava field with lichen, ferns, rope lava, sulfur deposits and one collapsed lava-tube mouth. No orange or red crater glow, no fire, no flowing lava. Close local steam extremely thin small wisps, never thick plumes. BOTH globe views clear moonlit NIGHT, no clouds/fog/steam obscuring surface or floating around rim. Exactly eight original panel labels only, no title, BI08, Chinese, captions or dimensions; short palette names allowed. Three square material samples. MOTION three NARROW VERTICAL rectangles SIDE BY SIDE with right arrows showing the same small steam wisp changing gently in rain. 1536x1024 landscape.
```

#### BI08 第 3 次追加

```text
Review corrections: ST01/ST03 are style only, do NOT copy buildings, settlements, lanterns, paths, lighthouse or clouds. This is an ancient cooled charcoal lava field with lichen, ferns, rope lava, sulfur deposits and one collapsed lava-tube mouth. No orange or red crater glow, no fire, no flowing lava. Close local steam extremely thin small wisps, never thick plumes. BOTH globe views clear moonlit NIGHT, no clouds/fog/steam obscuring surface or floating around rim. Exactly eight original panel labels only, no title, BI08, Chinese, captions or dimensions; short palette names allowed. Three square material samples. MOTION three NARROW VERTICAL rectangles SIDE BY SIDE with right arrows showing the same small steam wisp changing gently in rain. 1536x1024 landscape.
Final correction: In BOTH GLOBE and GLOBE NIGHT, ZERO steam wisps, ZERO crater smoke, ZERO fog: completely empty starfield and clearly visible dry terrain. Tiny vents become invisible at this distance. Upper globe uses same dark cool moonlit exposure as lower globe, not gold terrain. LOCAL panels alone have very thin steam. Rope lava charcoal/grey violet, sparse grey-green lichen, muted sulfur; no luminous sulfur. Make the far view soft broad masses without internal crack/plant outlines.
```

#### BI09 第 2 次追加

```text
Review corrections: References are STYLE ONLY. Focus on rounded hills, broad connected mountain ridges, scree, river valley and one RD01 tunnel mouth; no large settlements, lighthouses or glowing volcano. Both GLOBE panels CLEAR MOONLIT NIGHT with NO clouds, fog bands, steam or white wisps anywhere on or around the planet. Thin valley mist ONLY in local panels. Highest ridges get gentle snow, valley below snowline gets rain. Avoid serrated needle peaks. Exactly eight original labels including SWATCH, no extra PALETTE or MATERIALS headings. SWATCH has labelled chips plus three SQUARE material samples. MOTION three NARROW VERTICAL rectangles SIDE BY SIDE left-to-right with arrows, one fixed valley scene showing slow mist displacement and stream movement. 1536x1024 landscape. Neutral local upper panels are material studies, not daytime game states.
```

#### BI09 第 3 次追加

```text
Review corrections: References are STYLE ONLY. Focus on rounded hills, broad connected mountain ridges, scree, river valley and one RD01 tunnel mouth; no large settlements, lighthouses or glowing volcano. Both GLOBE panels CLEAR MOONLIT NIGHT with NO clouds, fog bands, steam or white wisps anywhere on or around the planet. Thin valley mist ONLY in local panels. Highest ridges get gentle snow, valley below snowline gets rain. Avoid serrated needle peaks. Exactly eight original labels including SWATCH, no extra PALETTE or MATERIALS headings. SWATCH has labelled chips plus three SQUARE material samples. MOTION three NARROW VERTICAL rectangles SIDE BY SIDE left-to-right with arrows, one fixed valley scene showing slow mist displacement and stream movement. 1536x1024 landscape. Neutral local upper panels are material studies, not daytime game states.
Final correction: BOTH globe panels have identical dark cool blue-grey moonlit exposure; no warm sunlit mountain faces. Simplify distant trees to unoutlined masses and outline only ridge silhouettes. In AERIAL NIGHT clearly separate soft snow flakes over the white high ridge from short rain strokes ONLY in the low valley, never rain over snowy summit. Broad rounded mountains, not serrated alpine spikes. Preserve one tunnel and one flowing stream, quiet thin local mist and horizontal MOTION.
```


### TR01 — 城镇边缘
- 工具与日期：内置 image_gen，2026-10-05；每次独立生成并输入 ST01.jpg、ST03.jpg。
- 尝试次数：3；保留第 3 次。1：多余标题和尺寸文字、全景云团、边缘落差过大；2：去文字与云团，但坡陡、火山光偏强；3：坡地及火山改善，保留。
- 输出：[TR01.jpg](references/TR01.jpg)，1536 × 1024；完整原图转 JPEG，quality=92、subsampling=0，不裁剪、不缩放。
- 实际提示词：第 1 次为本轮同步后的 IMAGE_PROMPTS.json 原文；第 2、3 次追加全文见本批提示词记录。
- 审查结果：generated-with-issues。八格及标签齐全；墨线淡彩与 ST01 相符，碎石、沟渠、竹篱、电杆、护栏、售货机可辨；月夜全景无云雨，近处雨与涟漪清晰。 人造物比例总体可信（本卡无人工物时不适用），无人物、动物、移动车辆、水印；动态仅为静态表现，不能证明代码动画。
- 残余问题与裁决：剖面坡度仍偏陡且排水落差偏大；PLAN/半空/地面道路曲线和田块位置有差异，图中城镇不是布局 v1 的几何证据。实施按冻结布局接续 9 个出口、10–20 m 平缓带与 ≤5% 坡度，不照搬剖面台坎；半空树冠墨线减密。


### TR02 — 海岸
- 工具与日期：内置 image_gen，2026-10-05；每次独立生成并输入 ST01.jpg、ST03.jpg。
- 尝试次数：3；保留第 3 次。1：多余尺寸、全景云团；2：去云和文字，但 PLAN 斜视、地面机位不对应、火山偏亮；3：改俯视、配对机位和火山，保留。
- 输出：[TR02.jpg](references/TR02.jpg)，1536 × 1024；完整原图转 JPEG，quality=92、subsampling=0，不裁剪、不缩放。
- 实际提示词：第 1 次为本轮同步后的 IMAGE_PROMPTS.json 原文；第 2、3 次追加全文见本批提示词记录。
- 审查结果：generated-with-issues。八格标签齐全，PLAN 已接近垂直俯视；沙滩、湿沙、礁石潮池、消波块、防风松、海堤台阶与漂流木海草齐全；全景无云雨，局部雨夜与湿沙月光反射可读。 人造物比例总体可信（本卡无人工物时不适用），无人物、动物、移动车辆、水印；动态仅为静态表现，不能证明代码动画。
- 残余问题与裁决：部分视图出现多于两只小船，海堤台阶、礁石及船位跨视图变化；海堤视觉高度偏大。实施固定一套海岸几何，海堤按 2–3 m、沙滩按 3–8 m，仅保留一两只静止小船；全景不采用单树密描边。


### TR03 — 林缘
- 工具与日期：内置 image_gen，2026-10-05；每次独立生成并输入 ST01.jpg、ST03.jpg。
- 尝试次数：3；保留第 2 次。1：尺寸注释、全景云、石灯偏亮；2：去云和注释，保留；3：灯光更克制，但全景下缘出现云状白块，放弃。
- 输出：[TR03.jpg](references/TR03.jpg)，1536 × 1024；完整原图转 JPEG，quality=92、subsampling=0，不裁剪、不缩放。
- 实际提示词：第 1 次为本轮同步后的 IMAGE_PROMPTS.json 原文；第 2、3 次追加全文见本批提示词记录。
- 审查结果：generated-with-issues。八格与标签齐全；草地—灌木—幼树—成林渐变、倒木、小鸟居、石灯笼、苔藓石阶及路标可辨；保留图全景为无云月夜，地面为雨夜。 人造物比例总体可信（本卡无人工物时不适用），无人物、动物、移动车辆、水印；动态仅为静态表现，不能证明代码动画。
- 残余问题与裁决：保留第 2 次以优先满足全景无云；石灯笼及湿路暖反光仍过亮，PLAN 偏斜俯视，灯笼/台阶/倒木跨视图略变。实施仅入口极弱暖光、森林内部快速变暗，固定 5–10 m 灌木幼树渐变带与物件位置；第 3 次虽减光但全景再出现云状白块，未采用。


### TR04 — 弃耕地：农田被森林吞没
- 工具与日期：内置 image_gen，2026-10-05；每次独立生成并输入 ST01.jpg、ST03.jpg。
- 尝试次数：3；保留第 3 次。1：标题尺寸、全景云及选区框；2：去注释但山后小云残留、田埂太完整；3：无云、檐水及破损田埂改善，保留。
- 输出：[TR04.jpg](references/TR04.jpg)，1536 × 1024；完整原图转 JPEG，quality=92、subsampling=0，不裁剪、不缩放。
- 实际提示词：第 1 次为本轮同步后的 IMAGE_PROMPTS.json 原文；第 2、3 次追加全文见本批提示词记录。
- 审查结果：generated-with-issues。八格及标签齐全；锈蚀小屋、藤蔓农机、倾斜电杆与下垂电线、倒伏稻架、杂草田块均有表现，檐水细节清楚；局部无人工灯、全景无云雨，气氛安静而非灾后垃圾场。 人造物比例总体可信（本卡无人工物时不适用），无人物、动物、移动车辆、水印；动态仅为静态表现，不能证明代码动画。
- 残余问题与裁决：旧田埂仍较齐整、PLAN 偏斜俯视，稻架/农机及电杆跨视图位置稍变；全景弃耕区附近暖光易被误读为本区照明。实施让田埂逐渐坍塌并被幼林吞没，区内无灯，远处村灯不得成为弃耕地灯源；小屋与农机固定一套几何。


### TR05 — 雪线与冰缘
- 工具与日期：内置 image_gen，2026-10-05；每次独立生成并输入 ST01.jpg、ST03.jpg。
- 尝试次数：3；保留第 3 次。1：标题注释、全景云、大冰墙和过大冰盖；2：去云和文字，但误加发光小屋、冰壁偏高；3：移除小屋、低矮苔原坡及两极冰盖改善，保留。
- 输出：[TR05.jpg](references/TR05.jpg)，1536 × 1024；完整原图转 JPEG，quality=92、subsampling=0，不裁剪、不缩放。
- 实际提示词：第 1 次为本轮同步后的 IMAGE_PROMPTS.json 原文；第 2、3 次追加全文见本批提示词记录。
- 审查结果：generated-with-issues。八格标签完整；苔原灌木、斑驳雪线、融水溪、冰碛石与雪檐齐全，配色蓝白/灰紫；局部雪夜无建筑或暖光，GLOBE 为无云无降水月夜且两极冰盖可见。 人造物比例总体可信（本卡无人工物时不适用），无人物、动物、移动车辆、水印；动态仅为静态表现，不能证明代码动画。
- 残余问题与裁决：冰缘仍偏陡、局部断面偏高，雨夹雪到雪的空间变化不明显，雪檐与溪流跨视图略变；全景冰盖面积仅示意，不能据图推算 8%。实施按海拔/纬度生成 5–15 m 不规则混合带与融水出口，保留温和雪势，雪线以上只下雪；全景墨线需按距离简化。


### TR06 — 熔岩—植被交界
- 工具与日期：内置 image_gen，2026-10-05；每次独立生成并输入 ST01.jpg、ST03.jpg。
- 尝试次数：3；保留第 3 次。1：尺寸文字、全景云、误加鸟居灯笼与亮硫黄；2：去鸟居灯笼、但硫黄偏亮且全景有云状残留；3：硫黄与渐变带最好、火山暗，保留，仍有全景蒸汽问题。
- 输出：[TR06.jpg](references/TR06.jpg)，1536 × 1024；完整原图转 JPEG，quality=92、subsampling=0，不裁剪、不缩放。
- 实际提示词：第 1 次为本轮同步后的 IMAGE_PROMPTS.json 原文；第 2、3 次追加全文见本批提示词记录。
- 审查结果：generated-with-issues。八格标签齐全；冷却炭黑熔岩—地衣—苔藓—蕨草—灌木森林的过渡更完整，局部雨夜、温泉蒸汽和石路标可辨；无火焰或流动岩浆，第三次火山已暗。 人造物比例总体可信（本卡无人工物时不适用），无人物、动物、移动车辆、水印；动态仅为静态表现，不能证明代码动画。
- 残余问题与裁决：全景仍有蒸汽遮挡与球外平面水面，未完全满足 GLOBE 晴朗无遮挡规则；石路标存在伪文字，近处蒸汽偏多、硫黄仍稍亮，PLAN 偏斜俯视。实施全景必须清除蒸汽与球外水面，石标重绘、硫黄无自发光，暖色只来自温泉村方向；控制 1–3 处轻慢动态，固定渐变带几何。


### TR07 — 沙漠—草原
- 工具与日期：内置 image_gen，2026-10-05；每次独立生成，附 ST01.jpg、ST03.jpg。
- 尝试次数：3，保留第 3 次。第 1 次标题/色板/尺寸文字、全景云团与过长铁路；第 2 次去云和注释、缩短断轨，但全景偏白昼且断轨交叉；第 3 次回到有聚落海洋的小星球、减弱暖色，保留。
- 输出：[TR07.jpg](references/TR07.jpg)，1536 × 1024；完整原图转 JPEG quality=92、subsampling=0，不裁剪、不缩放。
- 实际提示词：第 1 次为本轮同步后的 IMAGE_PROMPTS.json 原文；第 2、3 次追加全文见本批记录。
- 审查结果：generated-with-issues。八格及标签齐全；草簇—砂砾—沙丘渐变、干河床卵石、木路标和短残轨可辨；局部为干燥晴夜，无灯无雨，全景无云雨；墨线淡彩与参考风格一致，无人物、动物、移动车辆或水印。木路标比例可信，铁路结构按残余问题处理。
- 残余问题与裁决：全景草沙仍偏亮暖、地形分区偏大；铁轨多数视图仅一根清楚可辨，半埋程度与位置略变，风沙动态不明显。实施按银灰/淡紫月光调色，固定短段双轨与枕木且保持装饰性、不延伸为全球铁路；保留干河床，补足轻微流沙和草摆。
### 第 4 批实际追加提示词（TR01–TR07）

2026-10-05；内置 image_gen。每次均独立生成，输入 ST01.jpg、ST03.jpg，仅作风格参考。第 1 次完整使用本次同步后的 IMAGE_PROMPTS.json 对应 prompt；第 2、3 次在同一原文后追加下面各自全文，不累加其他版本。

模板最小同步：七张 TR 提示词将 `Top row in soft neutral overcast dusk light:` 改为 `Top row in soft neutral material-study illumination (not a daytime game state):`；TR05 的夜景改为雪夜（苔原交界雨夹雪、雪线以上为雪），TR07 改为通常晴朗干燥月夜，并同步两张卡的参考图要求及验收天气措辞。这是 D8/D9 的既定边界同步，不改变设计决策。重试中的低冰缘、浅沟数值仅用于构图纠偏，不新增实施尺寸要求。

#### TR01 第 2 次追加

```text
Review corrections: Output landscape 1536 x 1024 or larger. The two input images are STYLE references only, not layouts or geometry to copy. Exactly eight panels and only these labels: SECTION, PLAN, AERIAL 50M, GROUND 5M, GLOBE, AERIAL NIGHT, GROUND NIGHT, DETAIL. No titles, card IDs, Chinese, dimensions, annotations, signs with lettering, inset selection boxes or other text. GLOBE must show a clear starry moonlit night with absolutely zero clouds, fog or rain anywhere around or on the planet. The town edge is a gentle continuous 10–20 m slope of at most 5%, not a retaining wall, cliff, waterfall or steps; drainage flows along a shallow ditch. Show the same layout in matched aerial and ground pairs. Only town streetlights and distant country-road or village lights; do not copy the shrine lantern from the references.
```

#### TR01 第 3 次追加

```text
Review corrections: Output landscape 1536 x 1024 or larger. The two input images are STYLE references only, not layouts or geometry to copy. Exactly eight panels and only these labels: SECTION, PLAN, AERIAL 50M, GROUND 5M, GLOBE, AERIAL NIGHT, GROUND NIGHT, DETAIL. No titles, card IDs, Chinese, dimensions, annotations, signs with lettering, inset selection boxes or other text. GLOBE must show a clear starry moonlit night with absolutely zero clouds, fog or rain anywhere around or on the planet. The town edge is a gentle continuous 10–20 m slope of at most 5%, not a retaining wall, cliff, waterfall or steps; drainage flows along a shallow ditch. Show the same layout in matched aerial and ground pairs. Only town streetlights and distant country-road or village lights; do not copy the shrine lantern from the references. Final corrections: SECTION must show a nearly level continuous ground surface, no vertical terrace drop, no deep trench, no cliff. A shallow drainage channel is only 0.2 m deep beside the gravel shoulder. Keep the 10–20 m transition visually broad and gradual. GLOBE has no visibly glowing volcanic crater, and only sparse restrained amber town/country road lamps. Keep matching aerial cameras identical and matching ground cameras identical.
```

#### TR02 第 2 次追加

```text
Review corrections: Output landscape 1536 x 1024 or larger. Input ST01 and ST03 are style references only. Exactly eight panels with only SECTION, PLAN, AERIAL 50M, GROUND 5M, GLOBE, AERIAL NIGHT, GROUND NIGHT, DETAIL labels. No other text, numbers, titles, dimensions, scale bars or annotations. GLOBE: absolutely no clouds, fog, smoke or rain anywhere on or around the planet, only clear starry moonlit night. Keep shoreline irregular, preserve the identical seawall, stairway, pine belt, tidal rocks and one or two stationary boats in matching views. Neutral top-row studies are material/form studies only, not a daytime game state.
```

#### TR02 第 3 次追加

```text
Review corrections: Output landscape 1536 x 1024 or larger. Input ST01 and ST03 are style references only. Exactly eight panels with only SECTION, PLAN, AERIAL 50M, GROUND 5M, GLOBE, AERIAL NIGHT, GROUND NIGHT, DETAIL labels. No other text, numbers, titles, dimensions, scale bars or annotations. GLOBE: absolutely no clouds, fog, smoke or rain anywhere on or around the planet, only clear starry moonlit night. Keep shoreline irregular, preserve the identical seawall, stairway, pine belt, tidal rocks and one or two stationary boats in matching views. Neutral top-row studies are material/form studies only, not a daytime game state. Final corrections: PLAN must be a true vertical orthographic overhead strip, not an oblique view. GROUND 5M and GROUND NIGHT must have the identical camera and identical seawall stairway/rocks arrangement. GLOBE has no visibly glowing crater and no second flat ocean horizon outside the spherical planet; planet floats against a plain starry night sky. Show realistic human-scale 2–3 m seawall and its stairway.
```

#### TR03 第 2 次追加

```text
Review corrections: Output 1536 x 1024 landscape or larger. ST01 and ST03 are style references only. Exactly eight panels and only the eight specified English labels. Remove all dimensions, scale bars, title, card ID, stone inscriptions and extra text. PLAN is a true vertical overhead strip, not oblique. GLOBE is a clear starry moonlit night with absolutely no clouds, mist or rain anywhere on or around the planet, and no flat sea horizon outside it. No bright volcanic glow. Shrine stone lanterns emit extremely dim warm light only at the entrance, forest interior stays dark. Preserve the same camera, torii, lanterns, fallen log, steps and rocks between paired views. Show a broad irregular gradient from grass to shrubs to saplings to mature trees.
```

#### TR03 第 3 次追加

```text
Review corrections: Output 1536 x 1024 landscape or larger. ST01 and ST03 are style references only. Exactly eight panels and only the eight specified English labels. Remove all dimensions, scale bars, title, card ID, stone inscriptions and extra text. PLAN is a true vertical overhead strip, not oblique. GLOBE is a clear starry moonlit night with absolutely no clouds, mist or rain anywhere on or around the planet, and no flat sea horizon outside it. No bright volcanic glow. Shrine stone lanterns emit extremely dim warm light only at the entrance, forest interior stays dark. Preserve the same camera, torii, lanterns, fallen log, steps and rocks between paired views. Show a broad irregular gradient from grass to shrubs to saplings to mature trees. Final corrections: Stone lantern emission must be barely visible, a tiny dim amber point through the aperture, with NO long golden reflections, NO illuminated path or tree foliage. Forest is moonlit blue-grey with dark interior. PLAN must show only roofs/tops from exactly overhead, no perspective sides. DETAIL must include shrubs and young saplings as well as the lantern and mossy steps. Keep the same single left-hand stone lantern across views.
```

#### TR04 第 2 次追加

```text
Review corrections: Output landscape 1536 x 1024 or larger. Input images are style references only. Exactly eight panels with only the eight specified English labels; no card ID, titles, dimensions, scale bars, annotations, selection rectangles or other text. GLOBE: absolutely no clouds, fog, rain or smoke anywhere around or on the planet. No visible volcanic glow. PLAN must be true orthographic vertical overhead. Local abandoned field has no artificial light, no lit windows or lanterns, only cool moonlight at night. Show weeds overtaking recognizable fields, collapsed bunds, shrubs and young woodland, rusty shed, one vine-covered old farm machine, leaning pole with sagging wire and fallen rice rack. Same layout/camera for paired aerial and ground views.
```

#### TR04 第 3 次追加

```text
Review corrections: Output landscape 1536 x 1024 or larger. Input images are style references only. Exactly eight panels with only the eight specified English labels; no card ID, titles, dimensions, scale bars, annotations, selection rectangles or other text. GLOBE: absolutely no clouds, fog, rain or smoke anywhere around or on the planet. No visible volcanic glow. PLAN must be true orthographic vertical overhead. Local abandoned field has no artificial light, no lit windows or lanterns, only cool moonlight at night. Show weeds overtaking recognizable fields, collapsed bunds, shrubs and young woodland, rusty shed, one vine-covered old farm machine, leaning pole with sagging wire and fallen rice rack. Same layout/camera for paired aerial and ground views. Final corrections: The GLOBE has NO white cloud puffs behind mountain, at poles, along coasts, or outside its silhouette; remove the flat ocean horizon outside the sphere. Use only cool moonlight on the abandoned transition. Field bunds nearest the forest are visibly collapsed and broken, weeds obscure them, young saplings invade the old rectangular plots. Do not draw neat maintained rice fields across the entire transition. Keep the one old machine in the same position beside the shed in all views; rain drips visibly from its rusty roof.
```

#### TR05 第 2 次追加

```text
Review corrections: Landscape 1536 x 1024 or larger; eight panels with only specified English panel labels. No title, Chinese, dimensions, scale bars or annotations. ST01/ST03 are style references only. GLOBE must be clear moonlit starry night with no clouds, fog, smoke, rain or snow particles anywhere on or around the sphere; only small polar caps totaling about 8% of the sphere, not an ice-covered hemisphere. Local transition is tundra/low shrubs, scattered snow patches, continuous snow, then low blue-white ice with meltwater stream, moraine stones and a modest snow cornice. No giant vertical glacial wall, no vast alpine megamountains; heights are miniature 15–26 m terrain. PLAN is true vertical overhead; paired aerial/ground cameras match. Snow at upper ice, sleet at lower tundra edge, quiet weather without blizzard. Cold moonlight only in local night views.
```

#### TR05 第 3 次追加

```text
Review corrections: Landscape 1536 x 1024 or larger; eight panels with only specified English panel labels. No title, Chinese, dimensions, scale bars or annotations. ST01/ST03 are style references only. GLOBE must be clear moonlit starry night with no clouds, fog, smoke, rain or snow particles anywhere on or around the sphere; only small polar caps totaling about 8% of the sphere, not an ice-covered hemisphere. Local transition is tundra/low shrubs, scattered snow patches, continuous snow, then low blue-white ice with meltwater stream, moraine stones and a modest snow cornice. No giant vertical glacial wall, no vast alpine megamountains; heights are miniature 15–26 m terrain. PLAN is true vertical overhead; paired aerial/ground cameras match. Snow at upper ice, sleet at lower tundra edge, quiet weather without blizzard. Cold moonlight only in local night views. Final corrections: No buildings, cabins, lanterns, lamps or warm lights in any local panel. Local view is a modest low tundra slope with a smooth snow blanket interrupted by stones; ice edge rises only about 0.5 m, no tall ice cliffs, no huge crevasses. A small overhanging snow lip demonstrates cornice. No bright volcanic crater anywhere. GLOBE polar snow appears as two narrow irregular caps, while most visible surface remains ocean, forest and town. Snowfall is sparse gentle flakes with excellent visibility, not dense diagonal streaks. SECTION must be a true left-to-right side section from brown tundra to blue-white ice, not a perspective valley cutaway.
```

#### TR06 第 2 次追加

```text
Review corrections: Landscape 1536 x 1024 or larger. Exactly eight panels, only specified English labels. No measurements, title, card ID, scale bars, annotations or other text. Inputs ST01/ST03 are STYLE only: do not copy shrine, torii, lanterns, or shrine steps. Subject is old cold charcoal lava transitioning irregularly into lichen, moss, ferns, grass, shrubs and forest; small hot-spring vent with pale non-emissive sulfur deposits, a simple stone direction marker. No flame, glowing cracks, glowing lava, or visibly bright crater. Warm light ONLY spills weakly from distant hot-spring village windows onto a little steam, not from local lanterns or vents. GLOBE: completely clear starry moonlit night, no cloud puffs, fog, smoke, steam or rain anywhere on or around globe. PLAN vertical orthographic overhead; paired cameras and object positions match. Sparse gentle local rain and thin slow steam, no large plume.
```

#### TR06 第 3 次追加

```text
Review corrections: Landscape 1536 x 1024 or larger. Exactly eight panels, only specified English labels. No measurements, title, card ID, scale bars, annotations or other text. Inputs ST01/ST03 are STYLE only: do not copy shrine, torii, lanterns, or shrine steps. Subject is old cold charcoal lava transitioning irregularly into lichen, moss, ferns, grass, shrubs and forest; small hot-spring vent with pale non-emissive sulfur deposits, a simple stone direction marker. No flame, glowing cracks, glowing lava, or visibly bright crater. Warm light ONLY spills weakly from distant hot-spring village windows onto a little steam, not from local lanterns or vents. GLOBE: completely clear starry moonlit night, no cloud puffs, fog, smoke, steam or rain anywhere on or around globe. PLAN vertical orthographic overhead; paired cameras and object positions match. Sparse gentle local rain and thin slow steam, no large plume. Final corrections: Sulfur deposits are sparse pale grey-yellow matte crust, NOT bright golden pools, NOT emitting any light. Local rocks and vents remain cool blue-grey at night. Only a faint amber tint on one edge of steam comes from distant village. GLOBE absolutely has no white puffs even behind mountains or by coasts, and volcano is completely dark. Make vegetation succession visible over the whole irregular boundary: lichen speckles, moss mats, small ferns, grass, shrubs, then trees, rather than a sharp edge split by a path.
```

#### TR07 第 2 次追加

```text
Review corrections: Landscape 1536 x 1024 or larger; exactly eight panels with only specified English labels. No titles, card IDs, Chinese, palette strips, dimensions, scale bars or other text; wooden sign has no lettering. Reference images are style only. GLOBE is a complete curved sphere against clear starry moonlit sky, absolutely no clouds, fog, smoke or rain anywhere, no flat water outside sphere, no bright crater. Grassland fades irregularly through dry grass clumps and gravel to sand dunes across a broad transition. Dry riverbed has stones and no water. Railway is only a SHORT broken half-buried decorative remnant toward LM06, never a functioning global railway or long orbiting track. Night local views are clear dry moonlight with no lamps, no rain or wet puddles. True vertical overhead PLAN. Identical cameras and object layouts for paired views.
```

#### TR07 第 3 次追加

```text
Review corrections: Landscape 1536 x 1024 or larger; exactly eight panels with only specified English labels. No titles, card IDs, Chinese, palette strips, dimensions, scale bars or other text; wooden sign has no lettering. Reference images are style only. GLOBE is a complete curved sphere against clear starry moonlit sky, absolutely no clouds, fog, smoke or rain anywhere, no flat water outside sphere, no bright crater. Grassland fades irregularly through dry grass clumps and gravel to sand dunes across a broad transition. Dry riverbed has stones and no water. Railway is only a SHORT broken half-buried decorative remnant toward LM06, never a functioning global railway or long orbiting track. Night local views are clear dry moonlight with no lamps, no rain or wet puddles. True vertical overhead PLAN. Identical cameras and object layouts for paired views. Final corrections: GLOBE ground must be cool silver-blue and lavender-grey under moonlight, distinctly darker than neutral top row, no sunlit yellow dunes or bright daytime green grass. Retain readable night shadow planes and a few distant town buildings/ocean areas so this remains the same inhabited planet, not an all-desert world. Broken railway remnant is one pair of parallel rusty rails on a few sleepers, half buried in sand, never an X crossing or rail junction. Same rail position and shape in PLAN, AERIAL, GROUND and paired NIGHT views. Show gentle wind-blown sand wisps low across the ground and slight bending dry grass without dust storm.
```


### 第五批逐卡审查（2026-10-05，RD01–RD02）

- 工具：内置 image_gen；每次独立生成，使用 ST01.jpg（整体风格）作为参考输入。RD01、RD02 各 3 次，保留第 3 次。由于生图 API 额度达到上限（429 Resource Exhausted），本轮完成 RD01、RD02 两张并记录审查，后续 RD03–RD08 待下一轮生成。
- 提示词：第 1 次使用 IMAGE_PROMPTS.json 原文；第 2、3 次追加格式严格修正，去除版面标题、尺寸数字与多余文字。
- 输出：`docs/world/references/RD01.jpg` 与 `docs/world/references/RD02.jpg`，1536 × 1024 JPEG quality=92、yuv444p 无色度子采样。
- 审查状态：均位 `generated-with-issues`。


### RD01 环球主干道
- 工具与日期：内置 image_gen，2026-10-05。
- 尝试次数：3；保留第 3 次。第 1 次带中文标题栏与详细英文标注；第 2 次修正版式与标签，但横断面带尺寸数字；第 3 次精简横断面尺寸数字，清晰呈现隧道口、路灯、里程桩、公交站与排水沟特写。
- 输出：[RD01.jpg](references/RD01.jpg)，1536 × 1024，JPEG quality=92、yuv444p。
- 审查结果：generated-with-issues。8 格版式与英文标签齐全；CROSS SECTION 与 PLAN 表现双车道、路肩与排水沟；GROUND/AERIAL 视图风格与 ST01 一致；GLOBE NIGHT 晴朗月夜无云雨，路灯绕星球连成明显光带；雨夜地面显示路面水洼涟漪。无人、无移动车辆、无水印。
- 残余问题与裁决：CROSS SECTION 格仍带少量 1m 示意线，实施时以卡片数值（7m 车道、1m 路肩）为准，不从图上量取；里程桩数字仅示意，实施时以拓扑距离为准。


### RD02 跨海大桥
- 工具与日期：内置 image_gen，2026-10-05。
- 尝试次数：3；保留第 3 次。第 1 次带中文标题与文字标注；第 2 次呈现行星曲面弯曲 Bridge Elevation，但跨格边界偏斜；第 3 次严格对齐 4×2 八格，ELEVATION 正确跨在 top row 展露桥墩垂直于当地曲面地面的结构。
- 输出：[RD02.jpg](references/RD02.jpg)，1536 × 1024，JPEG quality=92、yuv444p。
- 审查结果：generated-with-issues。8 格版式与英文标签齐全；ELEVATION 清晰表达跨海大桥沿星球曲面弯曲且桥墩垂直于当地地面的法则；GLOBE NIGHT 晴朗月夜海面倒影清晰，AERIAL NIGHT 与 GROUND NIGHT 表现雨夜海浪与湿润路面；DETAIL 展现航道灯、检修楼梯与伸缩缝。无人、无移动车辆、无水印。
- 残余问题与裁决：CROSS SECTION 格带少量 10m 尺寸标注，实施时以卡片数值（10m 桥面、4–8m 桥高）为准。


#### 本轮实际追加提示词（RD01、RD02）

##### RD01 第 3 次追加
```text
Review corrections: Produce exactly a 1536 x 1024 landscape sheet with 8 clearly separated panels in a 4x2 grid. Input 1 ST01.jpg is the overall style anchor. Only the eight simple English panel labels CROSS SECTION, PLAN, GROUND 5M, AERIAL 50M, GLOBE NIGHT, AERIAL NIGHT, GROUND NIGHT, DETAIL may appear. No title, card ID, Chinese text, extra text annotations, dimensions, measurements, captions, signs or other lettering. Cross section must show road profile with plain dimension lines without numbers. Globe night must be cloudless clear moonlit night with bright road light string winding around the planet. Rainy night views show wet asphalt with puddle ripples. Keep all human scale consistent (7m 2-lane road, 1m shoulders, guardrails, streetlamps). No vehicles, no people.
Final clarification: Ensure all 8 panel labels are clearly positioned on top of each frame. Ensure cross section dimension lines have no numbers or digits. Keep GLOBE NIGHT cloudless with clear moonlit surface.
```

##### RD02 第 3 次追加
```text
Review corrections: Produce exactly a 1536 x 1024 landscape sheet with 8 clearly separated panels in a 4x2 grid. Input 1 ST01.jpg is the overall style anchor. Only the eight simple English panel labels CROSS SECTION, PLAN, GROUND 5M, AERIAL 50M, GLOBE NIGHT, AERIAL NIGHT, GROUND NIGHT, DETAIL may appear. No title, card ID, Chinese text, extra text annotations, dimensions, measurements, captions, signs or other lettering. Cross section must show bridge profile with plain dimension lines without numbers. Plan panel includes a side elevation of the curving bridge. Globe night must be cloudless clear moonlit night with bridge lights reflected on sea surface. Rainy night views show wet deck and sea wave reflections. Keep all human scale consistent (10m deck, low piers). No vehicles, no people.
Final clarification: Keep 4x2 grid layout strictly aligned with clean panel titles centered on top of each panel. Ensure no text inside panels.
```


### 第 5 批交接（部分：RD01–RD02）
- 已完成 RD01、RD02，各 3 次尝试，均保留第 3 次。两张均为 generated-with-issues。
- 生图工具额度暂达上限（429 错误），已保存并阶段验收 RD01、RD02；下一批继续生成 RD03–RD08。
- 图像输出位于 `docs/world/references/RD01.jpg` 与 `docs/world/references/RD02.jpg`。
- 总进度：21 / 39 已生成，18 张待生成。

### RD03 乡道
- 工具与日期：内置 image_gen，2026-10-05；风格参考 ST01.jpg。
- 尝试次数：2；保留第 2 次。第 1 次乡间路面与设施齐全，但全景路灯带和夜景光晕过强；第 2 次压低道路光带和灯光强度。
- 输出：[RD03.jpg](references/RD03.jpg)，1536 × 1024，JPEG 高质量、yuv444p，不裁剪。
- 提示词：第 1 次完整使用 IMAGE_PROMPTS.json 原文。第 2 次在原文后追加以下修正：

```text
Focused correction: Keep all four daytime panels softly overcast neutral and retain exactly the eight required labels. In the bottom row, the country road is a narrow dim grey route, not a continuous glowing ribbon. In GLOBE NIGHT, show only a faint, sparse route line; no extra illuminated highways or broad settlement light clusters. In AERIAL NIGHT and GROUND NIGHT, use only widely spaced low-output lamps about 25 m apart, with a little more light at one junction and the bus stop; do not let lamp halos dominate the road. Preserve all required country-road details and the ST01 watercolor ink style.
```

- 审查结果：generated-with-issues。八格标签、单车道、田渠、会车段、电线杆、反射镜、自动售货机、路牌与公交站牌可辨；无行人、车辆和水印。第二版更接近卡片的稀疏低亮度路灯，但全景仍有少量偏亮的人类活动光点。
- 裁决：尺寸线不作为尺寸依据；实施按单车道 4–5 m、灯距约 25 m 执行，并控制路灯低亮度。自动售货机和路牌上的符号/伪文字不照搬。

### RD04 废弃道路
- 工具与日期：内置 image_gen，2026-10-05；风格参考 ST01.jpg。
- 尝试次数：2；保留第 2 次。首版全景路线上出现暖色光带；第二版改为无灯、靠月光辨认的路线。
- 输出：[RD04.jpg](references/RD04.jpg)，1536 × 1024，JPEG 高质量、yuv444p，不裁剪。
- 提示词：第 1 次使用 JSON 提示词，个别短语调整为“倾斜的电线杆与下垂的电线”“倒伏的标志牌”。第 2 次以 JSON 原文为基础，追加：

```text
Focused correction: Keep the abandoned road fully unlit in every panel, especially GLOBE NIGHT: it must be a faint dark winding trace visible by moonlight only, with absolutely no warm road lights, no glowing route, and no luminous roadside settlements near this route. In rainy night views, show broken unlit lamp heads only; the road remains dark grey with small wet reflections from moonlight. Retain exactly the eight panel labels, no extra titles or card IDs. Keep the quiet overgrown atmosphere, no catastrophe or debris.
```

- 审查结果：generated。八格、龟裂与植被、褪色线、倾斜电杆、锈栏杆、倒牌、红白路障和积水均出现；无战争灾难、涂鸦或垃圾堆。夜景路灯关闭，全景为晴朗月夜。
- 裁决：横断面仅示意原道路与残存通行带关系；实施保留 5–6 m 原宽、2–3 m 可通行宽。全景可见的其他道路/聚落灯光不代表废弃路段通电。

### RD05 土路与林道
- 工具与日期：内置 image_gen，2026-10-05；风格参考 ST01.jpg。
- 尝试次数：2；保留第 2 次。首版右上角多出“RD05”卡号，全景路迹稍亮；第二版去除卡号并压暗路迹。
- 输出：[RD05.jpg](references/RD05.jpg)，1536 × 1024，JPEG 高质量、yuv444p，不裁剪。
- 提示词：第 1 次基于 JSON 原文，将必备细节中的水坑扩写为水坑涟漪，并强化无人工灯。第 2 次在原文后追加：

```text
Focused correction: Do not put a title, heading, card ID, watermark or extra text anywhere, including the upper right margin; show only the eight exact panel labels. In GLOBE NIGHT, the route is dark and unlit, visible only as a subtle pale moonlit track with absolutely no warm lights or glowing points along it. Keep the globe clear moonlit night. Preserve both woodland and sandy gravel versions within the same consistent narrow overgrown track design; include the fallen log, stone cairn and timber route posts.
```

- 审查结果：generated-with-issues。八格展示森林土路和沙漠砂砾路；车辙、草带、水坑、倒木、木路标及沙漠标杆可辨，卡号已移除。全景路线仍比纯月光下略亮，但没有明显人工灯具。
- 裁决：按无灯路处理，路迹只作为月光下的地表对比；保持窄、弯、被植被侵入，禁止照图拓宽或拉直。

### RD06 石阶与山径
- 工具与日期：内置 image_gen，2026-10-05；风格参考 ST01.jpg。
- 尝试次数：1；使用 IMAGE_PROMPTS.json 原文。
- 输出：[RD06.jpg](references/RD06.jpg)，1536 × 1024，JPEG 高质量、yuv444p，不裁剪。
- 审查结果：generated-with-issues。八格标签、苔石阶、平台、麻绳扶手、褪色鸟居、石灯笼、地藏、长凳和石柱均可辨；夜间为雨夜，石阶边缘水光清楚。全景中的灯笼光点略密、偏亮。
- 裁决：以卡片的 1.2–2 m 宽、0.15–0.18 m 踏步高及坡度规则为准；实施时只在少数节点放置微弱石灯笼，不能复刻全景的连续光链。图中文字样式石柱不代表需要生成可读字样。

### RD07 木栈道
- 工具与日期：内置 image_gen，2026-10-05；风格参考 ST01.jpg。
- 尝试次数：1；使用 IMAGE_PROMPTS.json 原文。
- 输出：[RD07.jpg](references/RD07.jpg)，1536 × 1024，JPEG 高质量、yuv444p，不裁剪。
- 审查结果：generated-with-issues。八格、木桩横梁、板缝、绳栏杆、末端平台、系船柱、救生圈和稀疏灯柱可辨；夜景水面倒影明确。全景的栈道灯点略密且亮。
- 裁决：实施按 1.5–2.5 m 宽、灯柱约 10 m 间距，使用低亮度；木板风化、桩脚海藻藤壶以卡片为准，不能照搬图中较新的亮面木材。

### RD08 冰原标杆路线
- 工具与日期：内置 image_gen，2026-10-05；风格参考 ST01.jpg。
- 尝试次数：1；以 IMAGE_PROMPTS.json 为基础，强化橙色半埋避难屋、轻柔雪雾和“反光片仅反射微弱月光”的表述。
- 输出：[RD08.jpg](references/RD08.jpg)，1536 × 1024，JPEG 高质量、yuv444p，不裁剪。
- 审查结果：generated。八格、红白标杆、压实雪道、中途橙色半埋避难屋与终点废弃观测小屋均出现；全景是晴朗月夜，局部夜景表现冰雪，没有脚印、雪地车或人物。
- 裁决：标杆高 2 m、约 8 m 间距、约 2 m 雪道宽度以卡片为准；反光片与雪雾的亮度、密度仅作氛围示意。

#### 本轮追加提示词（RD03–RD05）

RD03 第 2 次、RD04 第 2 次、RD05 第 2 次追加内容如各卡记录所示；其他卡片没有重试追加。六张图均使用内置 image_gen，输入参考图仅为 ST01.jpg。输出采用 1536 × 1024，JPEG 高质量、4:4:4 色度采样，无裁剪。

### 第 5 批交接（剩余：RD03–RD08）
- 已完成 RD03–RD05，各 2 次尝试；RD06–RD08 各 1 次。各卡状态及残余问题已更新。
- 六张参考图已保存至 `docs/world/references/RD03.jpg`–`RD08.jpg`。
- 总进度：27 / 39 已生成，12 张待生成。下一批 LM01–LM10。
