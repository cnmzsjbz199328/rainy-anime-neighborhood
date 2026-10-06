# S3 luminance audit and comparison panels. Requires Pillow.
# Run after: node tools/store_upgrade_check.mjs
from PIL import Image,ImageDraw,ImageStat
from pathlib import Path
import json
base=Path('docs/buildings/screenshots/B05-P01/comparison');e=json.loads((base/'evidence.json').read_text());stats={}
for view in ['default','town']:
 out=Image.new('RGB',(1280,900),'#dddddd');draw=ImageDraw.Draw(out);stats[view]={}
 for j,stage in enumerate(['before','after']):
  im=Image.open(base/f'{stage}-{view}.png').convert('RGB');mask=Image.new('L',im.size,0);d=ImageDraw.Draw(mask)
  for p in e['runs'][stage]['views'][view]['windowPolygons']:d.polygon([tuple(x) for x in p],fill=255)
  rgb=ImageStat.Stat(im,mask).mean;lum=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];stats[view][stage]=lum
  # Crops show both complete framing and the measured window area.
  annotated=im.copy();ad=ImageDraw.Draw(annotated)
  for p in e['runs'][stage]['views'][view]['windowPolygons']:ad.polygon([tuple(x) for x in p],outline='#ff5577',width=2)
  annotated.thumbnail((640,400));out.paste(annotated,(j*640,30));draw.text((j*640+12,10),f'{stage}: mean luminance {lum:.2f}',fill='black')
  bb=mask.getbbox();crop=im.crop((bb[0]-15,bb[1]-15,bb[2]+15,bb[3]+15));scale=min(620/crop.width,420/crop.height);crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS);out.paste(crop,(j*640,450))
 stats[view]['ratio']=stats[view]['after']/stats[view]['before'];draw.text((12,880),f'After / before: {stats[view]["ratio"]:.3f}. Fixed world glazing masks; sign and roof excluded.',fill='black');out.save(base/f'{view}-comparison.png')
(base/'luminance.json').write_text(json.dumps(stats,indent=2));print(json.dumps(stats,indent=2));assert all(v['ratio']>=.9 for v in stats.values())
