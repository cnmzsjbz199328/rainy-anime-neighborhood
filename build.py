from pathlib import Path

root = Path(__file__).resolve().parent
header = '''<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>雨音街角 · 手绘雨夜社区</title><meta name="description" content="可以旋转与缩放的手绘雨夜社区微缩模型"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#252e43}canvas{display:block;cursor:grab}canvas:active{cursor:grabbing}</style></head><body>'''
html = header
# dependency order: renderer, bend (before any material compiles), layout data, planet data and terrain (after layout), building modules (buildings/<plot>.js, register only), scene
sources = ['three.min.js', 'bend.js', 'layout.js', 'world.js', 'terrain.js', 'flora.js', 'section_plan.js', 'roadkit.js', 'bridge.js', 'steps.js', 'lightband.js', 'water.js', 'section.js', 'roads.js', 'ocean.js', 'landcover.js', *sorted(str(p.relative_to(root)) for p in (root / 'buildings').glob('*.js')), *sorted(str(p.relative_to(root)) for p in (root / 'landmarks').glob('*.js')), 'scene.js']
for name in sources:
    code = (root / name).read_text(encoding='utf-8').replace('</script', '<\\/script')
    html += '<script>\n' + code + '\n</script>'
html += '</body></html>'
(root / 'index.html').write_text(html, encoding='utf-8')
print('Built index.html')
