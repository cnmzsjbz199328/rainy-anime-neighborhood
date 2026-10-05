# 建筑任务队列

38 个地块：21 个待建，14 个新建筑已实现（B05-P03、B05-P04、B03-P01、B03-P02、B03-P03、B03-P04、B03-P05、B03-P06、B03-P07、B03-P08、B04-P01、B04-P02、B04-P03、B04-P04），3 个已有样板只保留/审查。本文用途选择是本次细化后的设计方案；没有改动 layout.js 中的类型、边界或入口。施工中若改变用途，先更新对应卡与参考图映射。

## 实施阶段
- 0：现有便利店、拉面店、公寓仅保留；不自动升级。
- 1：B05-P03 咖啡店，单栋完成验证。
- 2：B05-P04 花店，复用已验证的集成方式。
- 3：B03 沿街商店。
- 4：交番、诊所、社区设施、神社与公园。
- 5：商住楼（不同底层用途），验证楼板与独立住宅楼梯。
- 6：独栋住宅逐栋推进，保留各自变化；不一次填满。
- 7：学校主翼/低翼/院落；不扩大地块。

同一阶段按下表顺序进行。每轮只实施一个地块；学校可拆结构、室内、细化几个提交，但仍在同一地块。真实设备验收欠项贯穿所有阶段。

|阶段|地块|设计对象|用途/状态|任务卡|八视图|
|---|---|---|---|---|---|
|0|B05-P01|现有便利店样板|已有样板，审查保留|[规格](tasks/B05-P01.md)|[参考图](references/B05-P01.jpg)|
|0|B05-P02|现有拉面店样板|已有样板，审查保留|[规格](tasks/B05-P02.md)|[参考图](references/B05-P02.jpg)|
|0|B05-P05|现有公寓样板|已有样板，审查保留|[规格](tasks/B05-P05.md)|[参考图](references/B05-P05.jpg)|
|1|B05-P03|雨宿咖啡店|已实现（[截图](screenshots/B05-P03/)）|[规格](tasks/B05-P03.md)|[参考图](references/B05-P03.jpg)|
|2|B05-P04|邻里花店|已实现（[截图](screenshots/B05-P04/)）|[规格](tasks/B05-P04.md)|[参考图](references/B05-P04.jpg)|
|3|B03-P01|转角面包店|已实现（[截图](screenshots/B03-P01/)）|[规格](tasks/B03-P01.md)|[参考图](references/B03-P01.jpg)|
|3|B03-P02|洗衣店|已实现（[截图](screenshots/B03-P02/)）|[规格](tasks/B03-P02.md)|[参考图](references/B03-P02.jpg)|
|3|B03-P03|旧书店|已实现（[截图](screenshots/B03-P03/)）|[规格](tasks/B03-P03.md)|[参考图](references/B03-P03.jpg)|
|3|B03-P04|食堂|已实现（[截图](screenshots/B03-P04/)）|[规格](tasks/B03-P04.md)|[参考图](references/B03-P04.jpg)|
|3|B03-P05|杂货店|已实现（[截图](screenshots/B03-P05/)）|[规格](tasks/B03-P05.md)|[参考图](references/B03-P05.jpg)|
|4|B03-P06|社区会所|已实现（[截图](screenshots/B03-P06/)）|[规格](tasks/B03-P06.md)|[参考图](references/B03-P06.jpg)|
|4|B03-P07|邮政服务站|已实现（[截图](screenshots/B03-P07/)）|[规格](tasks/B03-P07.md)|[参考图](references/B03-P07.jpg)|
|4|B03-P08|小神社与庭院|已实现（[截图](screenshots/B03-P08/)）|[规格](tasks/B03-P08.md)|[参考图](references/B03-P08.jpg)|
|4|B04-P01|交番|已实现（[截图](screenshots/B04-P01/)）|[规格](tasks/B04-P01.md)|[参考图](references/B04-P01.jpg)|
|4|B04-P02|诊所|已实现（[截图](screenshots/B04-P02/)）|[规格](tasks/B04-P02.md)|[参考图](references/B04-P02.jpg)|
|4|B04-P03|公交旁口袋公园|已实现（[截图](screenshots/B04-P03/)）|[规格](tasks/B04-P03.md)|[参考图](references/B04-P03.jpg)|
|4|B04-P04|街角小神社|已实现（[截图](screenshots/B04-P04/)）|[规格](tasks/B04-P04.md)|[参考图](references/B04-P04.jpg)|
|5|B04-P05|底层文具店商住楼|待建|[规格](tasks/B04-P05.md)|[参考图](references/B04-P05.jpg)|
|5|B06-P01|底层药店商住楼|待建|[规格](tasks/B06-P01.md)|[参考图](references/B06-P01.jpg)|
|5|B06-P02|底层理发店商住楼|待建|[规格](tasks/B06-P02.md)|[参考图](references/B06-P02.jpg)|
|5|B06-P03|底层小文具店商住楼|待建|[规格](tasks/B06-P03.md)|[参考图](references/B06-P03.jpg)|
|5|B06-P04|底层修理铺商住楼|待建|[规格](tasks/B06-P04.md)|[参考图](references/B06-P04.jpg)|
|6|B02-P01|独栋住宅 1|待建|[规格](tasks/B02-P01.md)|[参考图](references/B02-P01.jpg)|
|6|B02-P02|独栋住宅 2|待建|[规格](tasks/B02-P02.md)|[参考图](references/B02-P02.jpg)|
|6|B02-P03|独栋住宅 3|待建|[规格](tasks/B02-P03.md)|[参考图](references/B02-P03.jpg)|
|6|B02-P04|独栋住宅 4|待建|[规格](tasks/B02-P04.md)|[参考图](references/B02-P04.jpg)|
|6|B02-P05|独栋住宅 5|待建|[规格](tasks/B02-P05.md)|[参考图](references/B02-P05.jpg)|
|6|B02-P06|独栋住宅 6|待建|[规格](tasks/B02-P06.md)|[参考图](references/B02-P06.jpg)|
|6|B02-P07|独栋住宅 7|待建|[规格](tasks/B02-P07.md)|[参考图](references/B02-P07.jpg)|
|6|B02-P08|独栋住宅 8|待建|[规格](tasks/B02-P08.md)|[参考图](references/B02-P08.jpg)|
|6|B05-P06|独栋住宅 9|待建|[规格](tasks/B05-P06.md)|[参考图](references/B05-P06.jpg)|
|6|B05-P07|独栋住宅 10|待建|[规格](tasks/B05-P07.md)|[参考图](references/B05-P07.jpg)|
|6|B05-P08|独栋住宅 11|待建|[规格](tasks/B05-P08.md)|[参考图](references/B05-P08.jpg)|
|6|B06-P05|独栋住宅 12|待建|[规格](tasks/B06-P05.md)|[参考图](references/B06-P05.jpg)|
|6|B06-P06|独栋住宅 13|待建|[规格](tasks/B06-P06.md)|[参考图](references/B06-P06.jpg)|
|6|B06-P07|独栋住宅 14|待建|[规格](tasks/B06-P07.md)|[参考图](references/B06-P07.jpg)|
|6|B06-P08|独栋住宅 15|待建|[规格](tasks/B06-P08.md)|[参考图](references/B06-P08.jpg)|
|7|B01-P01|院落型小学|待建|[规格](tasks/B01-P01.md)|[参考图](references/B01-P01.jpg)|

## 状态规则
“规格就绪/参考图生成”不等于“代码已实现”。catalog.json 的 imageStatus 只表示图片交付。implementationStatus 记录未开始、实现中、已实现待验收、验收完成；只有代码/截图/检查都具备才能置完成。

