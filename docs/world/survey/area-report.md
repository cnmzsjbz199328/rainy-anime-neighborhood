# 星球面积报告

由 `node tools/world_check.mjs --write` 生成。按球面面积计算：每个 0.25° 网格按 cos(纬度) 加权。

## WC1 面积预算

| 类别 | 占比 | 目标 | 容差 | 结果 |
| --- | --- | --- | --- | --- |
| building | 30.13% | 30.00% | ±2 个百分点 | 通过 |
| ocean | 30.96% | 30.00% | ±2 个百分点 | 通过 |
| wild | 30.65% | 32.00% | ±2 个百分点 | 通过 |
| ice | 8.26% | 8.00% | ±2 个百分点 | 通过 |

### 细分

| 细分 | 占比 |
| --- | --- |
| grassland | 19.44% |
| back-ocean | 15.42% |
| farmland | 14.51% |
| west-sea | 11.28% |
| town | 8.28% |
| forest | 7.08% |
| village | 4.74% |
| east-strait | 4.25% |
| ice-north | 4.13% |
| ice-south | 4.13% |
| desert | 2.72% |
| ruin | 2.61% |
| lava | 1.10% |
| island | 0.31% |

### 按区域

| 区域 | zone/kind | 占比 |
| --- | --- | --- |
| default-grassland | wild/grassland | 19.44% |
| back-ocean | ocean/back-ocean | 15.42% |
| west-sea | ocean/west-sea | 11.28% |
| farmland-main | building/farmland | 8.49% |
| town | building/town | 8.28% |
| east-strait | ocean/east-strait | 4.25% |
| ice-north | ice/ice-north | 4.13% |
| ice-south | ice/ice-south | 4.13% |
| forest-east | wild/forest | 3.97% |
| desert-west | wild/desert | 2.72% |
| farmland-west-coast | building/farmland | 2.39% |
| farmland-east | building/farmland | 2.17% |
| hamlets-back-south | building/village | 1.71% |
| farmland-west | building/farmland | 1.46% |
| forest-west | wild/forest | 1.38% |
| village-lm10 | building/village | 1.12% |
| lava-north | wild/lava | 1.10% |
| forest-south | wild/forest | 1.04% |
| hamlets-back-north | building/village | 1.02% |
| village-lm02 | building/village | 0.89% |
| ruin-lm06 | building/ruin | 0.79% |
| forest-northeast | wild/forest | 0.69% |
| ruin-lm04 | building/ruin | 0.69% |
| ruin-lm03 | building/ruin | 0.60% |
| ruin-lm05 | building/ruin | 0.52% |
| island-lm08 | wild/island | 0.31% |

### 海洋分片（互不连通）

| 片 | 占比 |
| --- | --- |
| west-sea | 11.28% |
| east-strait | 4.25% |
| back-ocean | 15.42% |

## WC2 四个方向的可见面积占比

视图中心的 90° 内，按投影面积 cos(纬度) × cos(到视图中心的角距) 加权。

| 方向 | 中心 | 建筑 | 海洋 | 荒野 | 冰盖 |
| --- | --- | --- | --- | --- | --- |
| front | (0°, 0°) | 60.74% | 15.85% | 20.66% | 2.76% |
| east | (0°, 90°) | 26.66% | 29.43% | 40.99% | 2.92% |
| back | (0°, 180°) | 19.55% | 50.76% | 26.93% | 2.76% |
| west | (0°, -90°) | 31.33% | 38.45% | 27.30% | 2.92% |
