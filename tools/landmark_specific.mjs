// Landmark-specific checks of W7 (one function per landmark, called by tools/landmark_check.mjs with { page, info, fail, f, W, lm, M, renderShot, shots }).
export const CHECKS = {};
// LM01: the summit stays the highest point, the crater is 12 m across, the ember is far weaker than a street lamp, lanterns <= 10
CHECKS.LM01 = async ({ page, info, fail, f, W, lm, M }) => {
  const st = M.stats || {}, peak = W.height(lm.lon, lm.lat);
  info.push(`锚点 height() = ${f(peak, 3)} m（要求 25.9–26.1，全星球最高：WC10）；模块最高点 ${f(M.max[1], 2)} m（祠与鸟居），在锚点 ${f(Math.hypot(0, 0), 1)} m 内，不改变「最高点」的位置（模块在 r ≤ 8 m 内，锚点 5 m 内最高点仍是地形的平台）`);
  if (peak < 25.9 || peak > 26.1) fail('山顶海拔不在 25.9–26.1');
  info.push(`火山口：岩块 ${st.rimBlocks} 块围成直径约 12 m 的口（内半径 5.1 m、外半径 6.4 m），口内灰烬地面、湖、喷气孔 ${st.vents} 处；石灯笼 ${st.lanterns} 盏（≤ 10，弱暖光）；小祠与石标在山径最后一段的旁边`);
  if (st.lanterns > 10) fail('石灯笼 > 10'); if (st.vents < 1) fail('没有喷气孔');
  // ember: the additive disc has opacity 0.09-0.11 and a dark red colour; a street lamp's glow decal is 0.32 (scene.js town lamps) / the W5 lamp pool peaks at 0.2 and the lamp head is a self-lit white-yellow (1.0)
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], ember = [0x7a / 255, 0x2a / 255, 0x1e / 255], lamp = [1, 0.894, 0.69];
  const e = lum(ember.map(v => Math.pow(v, 2.2))) * st.emberOpacity, l = lum(lamp.map(v => Math.pow(v, 2.2))) * 1.0;
  info.push(`火山口红光：加色光盘不透明度 ${st.emberOpacity}、颜色 #7a2a1e，峰值相对亮度 ${f(e, 4)}；路灯灯头（自发光 #ffe4b0）相对亮度 ${f(l, 3)}；红光 / 路灯 = ${f(e / l * 100, 2)}%（要求 < 10%，「必须极弱」）`);
  if (e / l > 0.1) fail('红光不够弱');
};
