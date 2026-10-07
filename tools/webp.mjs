// Compose and compress review images in Chromium's canvas (no image library needed): crop, tile into a grid, scale to a width, write WebP (or PNG).
//   node tools/webp.mjs <out.webp|out.png> [--width 1280] [--quality 0.82] [--cols N] [--crop x,y,w,h] [--label] <in1.png> [in2.png ...]
// --crop applies to every input; --cols lays the inputs out row by row (default: all in one row); --label writes each file name in the corner.
// Prints the output size; repository images should stay <= 1280 px wide and <= 200 KB (AGENTS.md).
import fs from 'node:fs';
import path from 'node:path';
import { launchChromium } from './browser.mjs';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; }, flag = n => { const i = argv.indexOf(n); if (i < 0) return false; argv.splice(i, 1); return true; };
const width = +opt('--width', 1280), quality = +opt('--quality', 0.82), crop = opt('--crop', null), label = flag('--label'), colsArg = +opt('--cols', 0);
const [outFile, ...inputs] = argv, cols = colsArg || inputs.length;
if (!outFile || !inputs.length) { console.log('usage: node tools/webp.mjs out.webp [--width W] [--quality Q] [--cols N] [--crop x,y,w,h] [--label] in.png ...'); process.exit(1); }
const browser = await launchChromium(), page = await browser.newPage();
const srcs = inputs.map(f => ({ name: path.basename(f, path.extname(f)), url: 'data:image/png;base64,' + fs.readFileSync(f).toString('base64') }));
const type = outFile.endsWith('.png') ? 'image/png' : 'image/webp';
const data = await page.evaluate(async ([srcs, width, quality, crop, cols, label, type]) => {
  const imgs = await Promise.all(srcs.map(async s => { const i = new Image(); i.src = s.url; await i.decode(); return i; }));
  const c = crop ? crop.split(',').map(Number) : null, cw = c ? c[2] : imgs[0].width, ch = c ? c[3] : imgs[0].height, rows = Math.ceil(imgs.length / cols), gap = imgs.length > 1 ? 4 : 0;
  const fullW = cols * cw + (cols - 1) * gap, k = Math.min(1, width / fullW), W = Math.round(fullW * k), H = Math.round((rows * ch + (rows - 1) * gap) * k);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const q = cv.getContext('2d'); q.fillStyle = '#10151f'; q.fillRect(0, 0, W, H); q.imageSmoothingQuality = 'high';
  imgs.forEach((im, n) => { const x = (n % cols) * (cw + gap) * k, y = Math.floor(n / cols) * (ch + gap) * k; q.drawImage(im, c ? c[0] : 0, c ? c[1] : 0, cw, ch, x, y, cw * k, ch * k);
    if (label) { q.font = '13px sans-serif'; q.fillStyle = 'rgba(0,0,0,.55)'; const t = srcs[n].name, tw = q.measureText(t).width; q.fillRect(x + 6, y + 6, tw + 10, 20); q.fillStyle = '#e8e5d9'; q.fillText(t, x + 11, y + 21); } });
  return { url: cv.toDataURL(type, quality), W, H };
}, [srcs, width, quality, crop, cols, label, type]);
fs.writeFileSync(outFile, Buffer.from(data.url.split(',')[1], 'base64'));
console.log(`${outFile}: ${data.W} x ${data.H}, ${fs.statSync(outFile).size} bytes`);
await browser.close();
