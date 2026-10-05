# 星球参考图审查与实施时的裁决

状态：已生成 ST01、ST03、ST05（3 / 39），均已审查；ST01 风格已获用户确认，其余 36 张待生成。

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
